//! Spec M1 done line (build-plan M1.9): 10 years tick headless and the job order matches section
//! 4 on every tick. The expected order here is written straight from the spec 4 text, apart from
//! the scheduler's own due rules, so the two check each other.

use sim::time::{Date, DateTime, Slot};
use sim::{Notice, Sim};

/// The slots spec 4 runs at `t`, in order.
fn spec_order(t: DateTime) -> Vec<Slot> {
    use Slot::*;
    let (d, h) = (t.date(), t.hour());
    let quarter_month = matches!(d.month, 1 | 4 | 7 | 10);
    let new_year = d.month == 1 && d.day == 1;
    let release = quarter_month && d.day == 2 && h == 0;
    let mut v = vec![AdvanceClock];
    // 4.1: prices every hour, except all of 1 January and the release tick (4.4).
    if !new_year && !release {
        v.push(SharePrices);
    }
    // 4.1 step 3 and the 4.4 price move: 01:00 on the 2nd of Jan, Apr, Jul and Oct.
    if quarter_month && d.day == 2 && h == 1 {
        v.extend([
            PriceMoveFairValue,
            PriceMoveEarningsJump,
            PriceMoveBuzz,
            PriceMoveRatingReview,
            PriceMoveCreditLineReview,
            PriceMoveResultHeadlines,
        ]);
    }
    v.push(Alerts);
    if h != 0 {
        return v;
    }
    // 4.2 daily; reaction week on the 3rd to the 8th of a release month.
    v.extend([DailyPriceBars, DailyFairValue]);
    if quarter_month && (3..=8).contains(&d.day) {
        v.push(DailyReactionWeek);
    }
    v.extend([DailyProjections, DailyNews, DailyZoneConfidence]);
    // 4.3 monthly on the 1st; step 1 only at a quarter start.
    if d.day == 1 {
        if quarter_month {
            v.extend([
                MonthlyAiEvents,
                MonthlyIndustryLt,
                MonthlyCycle,
                MonthlyZoneSpreads,
                MonthlyGrowthDraws,
            ]);
        }
        v.extend([
            MonthlyDemand,
            MonthlyFringe,
            MonthlyLaborSeats,
            MonthlyCompute,
            MonthlySupply,
            MonthlyRevenue,
            MonthlyData,
            MonthlyExpenses,
            MonthlyProductivity,
            MonthlyAssets,
            MonthlyInterest,
            MonthlyCashSettle,
            MonthlyLedger,
        ]);
    }
    // 4.4 quarterly, in table order.
    if d.day == 1 && quarter_month {
        v.extend([CloseStatements, CloseTax, CloseResultTags]);
    }
    if release {
        v.push(ReleasePublish);
    }
    if quarter_month && d.day == 9 {
        v.extend([
            LockFixedStartupEvents,
            LockRandomStartupEvents,
            LockIpoVotes,
            LockAiPlans,
            LockConsensus,
        ]);
    }
    if matches!((d.month, d.day), (3, 26) | (6, 25) | (9, 25) | (12, 26)) {
        v.push(RecapBuild);
    }
    // 4.5 yearly, after the Q4 close.
    if new_year {
        v.extend([YearlyAnnualStatements, YearlyArchive]);
    }
    v
}

#[test]
fn ten_years_tick_in_spec_order() {
    let data = sim_data::load_world(&sim_data::default_data_dir()).unwrap();
    let mut sim = Sim::new(data, 2020).unwrap();
    sim.set_trace(true);
    let end = DateTime::midnight(Date::ymd(2030, 1, 1));
    let (mut ticks, mut months, mut releases, mut locks) = (0u32, 0, 0, 0);
    let mut recaps = 0;
    while sim.now() < end {
        let notices = sim.step();
        ticks += 1;
        assert_eq!(
            sim.last_trace(),
            spec_order(sim.now()).as_slice(),
            "{}",
            sim.now()
        );
        for n in &notices {
            match n {
                Notice::MonthDone(_) => months += 1,
                Notice::EarningsReleased(_) => releases += 1,
                Notice::PlanLocked(_) => locks += 1,
                _ => {}
            }
        }
        recaps += u32::from(sim.last_trace().contains(&Slot::RecapBuild));
    }
    // 2020 to 2029: 3 leap years.
    assert_eq!(ticks, (365 * 10 + 3) * 24);
    assert_eq!((months, releases, locks, recaps), (120, 40, 40, 40));
}
