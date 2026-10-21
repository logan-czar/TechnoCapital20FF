//! The scheduler (spec 4; build-plan M1.3). One tick is one hour. Each tick advances the clock,
//! then visits the named [`Slot`]s in spec 4 order (hourly, daily, monthly, quarterly, yearly),
//! running every slot that is due at the new time. Each job reads the state the one before left.
//!
//! The order of slots is fixed here, now, for every milestone. A later milestone fills a slot by
//! calling [`Scheduler::register`] from its own module (wired in `lib.rs`'s `register_jobs`), never
//! by editing this file. A due slot with no job still runs (and shows in the trace), so the
//! golden job-order trace locks the order before the jobs exist.
//!
//! Jobs follow the pure step contract (`world` module docs): `fn(&mut World, &mut JobCtx)`, with
//! all randomness from `ctx.draws`. Monthly steps can therefore be re-run on a cloned `World` with
//! [`NoNoise`](crate::rng::NoNoise) draws through [`Scheduler::run_slots`] (spec 5.16).

use super::calendar::{Date, DateTime};
use super::quarter::{
    PLAN_LOCK_DAY, PRICE_MOVE_HOUR, REACTION_FIRST_DAY, REACTION_LAST_DAY, RELEASE_DAY,
    is_recap_day,
};
use crate::rng::DrawSource;
use crate::world::{AlertKind, AlertLevel, AlertLevels, AlertPayload, Notice, PauseReason, World};

/// A scheduled job (the pure step contract).
pub type JobFn = fn(&mut World, &mut JobCtx<'_>);

/// Calendar facts about the tick being run, worked out once per tick.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TickFacts {
    pub now: DateTime,
    pub date: Date,
    pub hour: u8,
}

impl TickFacts {
    pub fn new(now: DateTime) -> TickFacts {
        TickFacts {
            now,
            date: now.date(),
            hour: now.hour(),
        }
    }

    /// 00:00: the daily, monthly, quarterly and yearly jobs may run (spec 4).
    pub fn is_midnight(&self) -> bool {
        self.hour == 0
    }

    /// 00:00 on the 1st: the monthly job (spec 4.3).
    pub fn is_month_start(&self) -> bool {
        self.is_midnight() && self.date.day == 1
    }

    /// 00:00 on 1 January, April, July or October: the quarterly draw (4.3 step 1) and the close
    /// (4.4).
    pub fn is_quarter_start(&self) -> bool {
        self.is_month_start() && self.date.is_quarter_first_month()
    }

    /// 00:00 on 1 January: the yearly job (spec 4.5).
    pub fn is_year_start(&self) -> bool {
        self.is_month_start() && self.date.month == 1
    }

    /// 00:00 on the 2nd of a quarter's first month: the release (spec 4.4 row 1).
    pub fn is_release_tick(&self) -> bool {
        self.is_midnight() && self.date.day == RELEASE_DAY && self.date.is_quarter_first_month()
    }

    /// 01:00 on a release day: the price move and earnings jump (spec 4.1 step 3, 4.4).
    pub fn is_price_move_tick(&self) -> bool {
        self.hour == PRICE_MOVE_HOUR
            && self.date.day == RELEASE_DAY
            && self.date.is_quarter_first_month()
    }

    /// 00:00 on the 9th of a quarter's first month: the plan lock (spec 4.4 row 3).
    pub fn is_lock_tick(&self) -> bool {
        self.is_midnight() && self.date.day == PLAN_LOCK_DAY && self.date.is_quarter_first_month()
    }

    /// 00:00 on the first day of the pre-quarter-end week: the recap (spec 4.4 row 5).
    pub fn is_recap_tick(&self) -> bool {
        self.is_midnight() && is_recap_day(self.date)
    }

    /// 1 January is a market holiday (spec 4.1 step 2, 3.1.0).
    pub fn markets_closed(&self) -> bool {
        self.date.month == 1 && self.date.day == 1
    }

    /// 00:00 on the 3rd to the 8th of a release month (spec 4.2 step 3).
    pub fn is_reaction_week_day(&self) -> bool {
        self.is_midnight()
            && self.date.is_quarter_first_month()
            && (REACTION_FIRST_DAY..=REACTION_LAST_DAY).contains(&self.date.day)
    }
}

/// When a slot's group runs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Group {
    Hourly,
    PriceMove,
    Daily,
    Monthly,
    Close,
    Release,
    PlanLock,
    Recap,
    Yearly,
}

impl Group {
    /// Trace label.
    pub fn label(self) -> &'static str {
        match self {
            Group::Hourly => "hourly",
            Group::PriceMove => "quarterly.price_move",
            Group::Daily => "daily",
            Group::Monthly => "monthly",
            Group::Close => "quarterly.close",
            Group::Release => "quarterly.release",
            Group::PlanLock => "quarterly.plan_lock",
            Group::Recap => "quarterly.recap",
            Group::Yearly => "yearly",
        }
    }
}

macro_rules! slots {
    ($($(#[$m:meta])* $name:ident = ($group:ident, $step:literal);)*) => {
        /// The named job slots, in the order a tick visits them (spec 4).
        #[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
        pub enum Slot {
            $($(#[$m])* $name,)*
        }

        impl Slot {
            /// Every slot, in run order.
            pub const ALL: &'static [Slot] = &[$(Slot::$name,)*];

            pub fn group(self) -> Group {
                match self {
                    $(Slot::$name => Group::$group,)*
                }
            }

            /// The step label within the group, numbered as in the spec.
            pub fn step(self) -> &'static str {
                match self {
                    $(Slot::$name => $step,)*
                }
            }
        }
    };
}

slots! {
    // 4.1 Hourly (every tick).
    /// 4.1 step 1: the clock advances (done by the scheduler before any slot); controls apply
    /// when sent (D5).
    AdvanceClock = (Hourly, "1.advance_clock");
    /// 4.1 step 2: share prices of listed companies (5.14); not on 1 January (3.1.0) and frozen on
    /// the release tick (4.4, 21.2).
    SharePrices = (Hourly, "2.share_prices");
    // 4.1 step 3 = the 4.4 price move, 01:00 on release days, in the 4.4 order.
    /// Full fair value recalculation (5.13).
    PriceMoveFairValue = (PriceMove, "1.full_fair_value");
    /// Earnings jump x1.5 (5.15).
    PriceMoveEarningsJump = (PriceMove, "2.earnings_jump");
    /// Buzz (3.10, 5.15).
    PriceMoveBuzz = (PriceMove, "3.buzz");
    /// Rating review (5.12).
    PriceMoveRatingReview = (PriceMove, "4.rating_review");
    /// Credit line review (5.12).
    PriceMoveCreditLineReview = (PriceMove, "5.credit_line_review");
    /// Result headlines (5.18).
    PriceMoveResultHeadlines = (PriceMove, "6.result_headlines");
    /// 4.1 step 4: alerts due this hour; auto-pause (D6).
    Alerts = (Hourly, "4.alerts");

    // 4.2 Daily (00:00).
    /// Daily price bar closes; buzz decays 25%.
    DailyPriceBars = (Daily, "1.price_bars");
    /// Fair value refresh (5.13).
    DailyFairValue = (Daily, "2.fair_value");
    /// Reaction week reversion, the 3rd to the 8th of a release month (21.3.1).
    DailyReactionWeek = (Daily, "3.reaction_week");
    /// Projection ranges (5.16).
    DailyProjections = (Daily, "4.projections");
    /// News: post the day's headlines (5.18).
    DailyNews = (Daily, "5.news");
    /// Zone exchange confidence (5.1.2).
    DailyZoneConfidence = (Daily, "6.zone_confidence");

    // 4.3 Monthly (00:00 on the 1st). Step 1 only on 1 Jan, Apr, Jul and Oct, in its order.
    /// Scripted AI events due today (5.1.1).
    MonthlyAiEvents = (Monthly, "1a.ai_events");
    /// Every industry's lt (5.1.1).
    MonthlyIndustryLt = (Monthly, "1b.industry_lt");
    /// The global cycle advances one quarter (5.1).
    MonthlyCycle = (Monthly, "1c.cycle");
    /// Every zone's effective credit spread (5.1.2).
    MonthlyZoneSpreads = (Monthly, "1d.zone_spreads");
    /// Every industry draws its q_growth (5.1).
    MonthlyGrowthDraws = (Monthly, "1e.growth_draws");
    /// Demand, rate term, phase labels (5.1).
    MonthlyDemand = (Monthly, "2.demand");
    /// Fringe pools (5.3).
    MonthlyFringe = (Monthly, "3.fringe");
    /// Labor units, seats, stations (5.10).
    MonthlyLaborSeats = (Monthly, "4.labor_seats");
    /// Productive compute and PC bonus (5.8).
    MonthlyCompute = (Monthly, "5.compute");
    /// Supply, S and M (5.2).
    MonthlySupply = (Monthly, "6.supply");
    /// Unit revenue (5.4).
    MonthlyRevenue = (Monthly, "7.revenue");
    /// Data (5.9).
    MonthlyData = (Monthly, "8.data");
    /// Expenses (5.5, 5.11).
    MonthlyExpenses = (Monthly, "9.expenses");
    /// Productivity (5.6).
    MonthlyProductivity = (Monthly, "10.productivity");
    /// Asset decay, growth plan, ramping, new seats' characters (5.10, 3.7.1).
    MonthlyAssets = (Monthly, "11.assets");
    /// Interest, line fees, interest on cash (5.12).
    MonthlyInterest = (Monthly, "12.interest");
    /// Cash settles; line auto-draw or repay; distress and bankruptcy (5.12).
    MonthlyCashSettle = (Monthly, "13.cash_settle");
    /// Post the monthly ledger; tax accrues (5.11).
    MonthlyLedger = (Monthly, "14.ledger");

    // 4.4 Quarterly (exact days).
    /// Close and compile, after the monthly job: build the quarter's statements (unpublished).
    CloseStatements = (Close, "1.statements");
    /// Pay the quarter's tax (5.11).
    CloseTax = (Close, "2.tax");
    /// Tag result types (21.3.2).
    CloseResultTags = (Close, "3.result_tags");
    /// Release: statements published to Filings.
    ReleasePublish = (Release, "1.publish");
    /// Plan lock: fixed startup events due (5.19.2).
    LockFixedStartupEvents = (PlanLock, "1.fixed_startup_events");
    /// Random startup events (5.19.1).
    LockRandomStartupEvents = (PlanLock, "2.random_startup_events");
    /// IPO board votes and listings (5.20.1).
    LockIpoVotes = (PlanLock, "3.ipo_votes_and_listings");
    /// Every company's Lite AI plan in one batch (6).
    LockAiPlans = (PlanLock, "4.ai_plans");
    /// Consensus set (5.16).
    LockConsensus = (PlanLock, "5.consensus");
    /// Pre-quarter-end week: the quarterly recap is built (8, 21.6.2).
    RecapBuild = (Recap, "1.build");

    // 4.5 Yearly (1 January 00:00, after the Q4 close).
    /// Annual statements (sum of four quarters).
    YearlyAnnualStatements = (Yearly, "1.annual_statements");
    /// Archive: 20 quarters of statements, 10 years of daily bars.
    YearlyArchive = (Yearly, "2.archive");
}

impl Slot {
    /// Number of slots.
    pub const COUNT: usize = Slot::ALL.len();

    pub fn index(self) -> usize {
        self as usize
    }

    /// `group.step`, for messages.
    pub fn name(self) -> String {
        format!("{}.{}", self.group().label(), self.step())
    }

    /// Whether this slot runs on the tick described by `f` (spec 4).
    pub fn is_due(self, f: &TickFacts) -> bool {
        match self.group() {
            Group::Hourly => match self {
                Slot::SharePrices => !f.markets_closed() && !f.is_release_tick(),
                _ => true,
            },
            Group::PriceMove => f.is_price_move_tick(),
            Group::Daily => match self {
                Slot::DailyReactionWeek => f.is_reaction_week_day(),
                _ => f.is_midnight(),
            },
            Group::Monthly => match self {
                Slot::MonthlyAiEvents
                | Slot::MonthlyIndustryLt
                | Slot::MonthlyCycle
                | Slot::MonthlyZoneSpreads
                | Slot::MonthlyGrowthDraws => f.is_quarter_start(),
                _ => f.is_month_start(),
            },
            Group::Close => f.is_quarter_start(),
            Group::Release => f.is_release_tick(),
            Group::PlanLock => f.is_lock_tick(),
            Group::Recap => f.is_recap_tick(),
            Group::Yearly => f.is_year_start(),
        }
    }

    /// The spec 9.3 notice posted once this slot has run, if it ends a job (D10).
    fn notice_after(self, f: &TickFacts) -> Option<Notice> {
        match self {
            Slot::DailyZoneConfidence => Some(Notice::DayDone(f.date.add_days(-1))),
            Slot::MonthlyLedger => Some(Notice::MonthDone(f.date.month_of().prev())),
            Slot::ReleasePublish => Some(Notice::EarningsReleased(f.date.quarter().prev())),
            Slot::LockConsensus => Some(Notice::PlanLocked(f.date.quarter())),
            _ => None,
        }
    }
}

/// What a job may touch besides the `World` (the pure step contract).
pub struct JobCtx<'a> {
    /// The tick being run.
    pub facts: TickFacts,
    /// Every random number comes from here.
    pub draws: &'a mut dyn DrawSource,
    notices: &'a mut Vec<Notice>,
    alert_levels: &'a AlertLevels,
    /// False while a SkipTo runs: Pause alerts then only notify (D6).
    pause_on_alert: bool,
    pause: Option<PauseReason>,
}

impl<'a> JobCtx<'a> {
    pub fn new(
        facts: TickFacts,
        draws: &'a mut dyn DrawSource,
        notices: &'a mut Vec<Notice>,
        alert_levels: &'a AlertLevels,
        pause_on_alert: bool,
    ) -> Self {
        JobCtx {
            facts,
            draws,
            notices,
            alert_levels,
            pause_on_alert,
            pause: None,
        }
    }

    /// Posts a notice (spec 9.3).
    pub fn notice(&mut self, notice: Notice) {
        self.notices.push(notice);
    }

    /// Fires an alert at its set level: Off posts nothing; Pause also pauses after this tick
    /// (spec 4.1 step 4, 8; D6).
    pub fn raise_alert(&mut self, kind: AlertKind, payload: AlertPayload) {
        let level = self.alert_levels.get(kind);
        if level == AlertLevel::Off {
            return;
        }
        self.notices.push(Notice::Alert {
            kind,
            level,
            payload,
        });
        if level == AlertLevel::Pause && self.pause_on_alert && self.pause.is_none() {
            self.pause = Some(PauseReason::Alert(kind));
        }
    }

    /// The pause an alert asked for this tick, if any.
    pub fn pause_request(&self) -> Option<PauseReason> {
        self.pause
    }
}

/// The registered jobs of every slot.
#[derive(Clone)]
pub struct Scheduler {
    jobs: Vec<Vec<(&'static str, JobFn)>>,
}

impl Default for Scheduler {
    fn default() -> Self {
        Self::new()
    }
}

impl Scheduler {
    /// A scheduler with every slot empty.
    pub fn new() -> Scheduler {
        Scheduler {
            jobs: vec![Vec::new(); Slot::COUNT],
        }
    }

    /// Adds `job` to `slot`. Jobs in one slot run in registration order.
    pub fn register(&mut self, slot: Slot, name: &'static str, job: JobFn) {
        self.jobs[slot.index()].push((name, job));
    }

    /// The jobs registered in `slot`, with their names.
    pub fn jobs(&self, slot: Slot) -> &[(&'static str, JobFn)] {
        &self.jobs[slot.index()]
    }

    /// Runs one tick: advances `world.clock` one hour, then every due slot in order (spec 4).
    /// Pushes each visited slot to `trace` when given.
    pub fn run_tick(
        &self,
        world: &mut World,
        ctx_draws: &mut dyn DrawSource,
        notices: &mut Vec<Notice>,
        alert_levels: &AlertLevels,
        pause_on_alert: bool,
        mut trace: Option<&mut Vec<Slot>>,
    ) -> Option<PauseReason> {
        // 4.1 step 1: advance the clock.
        world.clock = world.clock.next();
        let facts = TickFacts::new(world.clock);
        let mut ctx = JobCtx::new(facts, ctx_draws, notices, alert_levels, pause_on_alert);
        for &slot in Slot::ALL {
            if !slot.is_due(&facts) {
                continue;
            }
            if let Some(t) = trace.as_deref_mut() {
                t.push(slot);
            }
            for (_, job) in self.jobs(slot) {
                job(world, &mut ctx);
            }
            if let Some(n) = slot.notice_after(&facts) {
                ctx.notice(n);
            }
        }
        let pause = ctx.pause_request();
        notices.push(Notice::TickDone(facts.now));
        pause
    }

    /// Runs the given slots once, in the order given, on the tick `ctx.facts` describes, without
    /// advancing the clock or checking due rules. For re-running steps on a cloned world, such as
    /// the monthly economy for the spec 5.16 projections.
    pub fn run_slots(&self, slots: &[Slot], world: &mut World, ctx: &mut JobCtx<'_>) {
        for &slot in slots {
            for (_, job) in self.jobs(slot) {
                job(world, ctx);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slots_are_in_spec_group_order() {
        // Hourly (with the 01:00 price move as step 3), daily, monthly, quarterly, yearly.
        let order = |g: Group| Slot::ALL.iter().position(|s| s.group() == g).unwrap();
        assert!(order(Group::Hourly) < order(Group::PriceMove));
        assert!(order(Group::PriceMove) < order(Group::Daily));
        assert!(order(Group::Daily) < order(Group::Monthly));
        assert!(order(Group::Monthly) < order(Group::Close));
        assert!(order(Group::Close) < order(Group::Release));
        assert!(order(Group::Release) < order(Group::PlanLock));
        assert!(order(Group::PlanLock) < order(Group::Recap));
        assert!(order(Group::Recap) < order(Group::Yearly));
        assert_eq!(Slot::ALL.last(), Some(&Slot::YearlyArchive));
        assert_eq!(
            Slot::ALL
                .iter()
                .filter(|s| s.group() == Group::Monthly)
                .count(),
            18,
            "14 steps, step 1 in five parts"
        );
        for (i, s) in Slot::ALL.iter().enumerate() {
            assert_eq!(s.index(), i);
        }
    }
}
