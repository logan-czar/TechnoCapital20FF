//! The AI boom and the bubble (spec 5.1.1, Logan batches 151 and 153; 4.3 steps 1a and 1b).
//!
//! AI labs' long-term rate is a regime switch read from ai-boom.csv by stage and boom year; the
//! quarterly draw of 5.1 is unchanged. Every industry's `lt = trend_growth + boom_uplift ×
//! (AI labs LT − preboom LT)`. The boom fires at 00:00 on 1 January 2030; the pop on the first
//! day of the quarter rolled at load (2040 ± 2, quarter 1 to 4): demand ×(1 − crash_drop) once,
//! then 8 quarters of bust and the post-crash rate.

use crate::rng::{DrawSource, Stream};
use crate::time::{Date, JobCtx, Quarter};
use crate::world::{AiBoom, AiSchedule, AiStage, AlertKind, AlertPayload, PhaseLabel, World};

/// The boom event: 00:00 on 1 January 2030 (spec 5.1.1, scripted).
pub const BOOM_YEAR: i32 = 2030;
/// The pop's base year (spec 5.1.1, A)...
pub const POP_BASE_YEAR: i32 = 2040;
/// ...plus a whole number from −2 to +2...
pub const POP_YEAR_ROLL: i64 = 2;
/// ...and a quarter from 1 to 4.
pub const POP_QUARTERS: (i64, i64) = (1, 4);
/// The bust lasts 8 quarters from the pop, then the post-crash rate holds (spec 5.1.1, T).
pub const BUST_QUARTERS: i64 = 8;
/// Linked industries read Boom for the boom's first 4 quarters (spec 5.1.1, A).
pub const BOOM_LABEL_QUARTERS: i64 = 4;

/// The boom event date.
pub fn boom_date() -> Date {
    Date::ymd(BOOM_YEAR, 1, 1)
}

/// A quarter's position on one running count (year × 4 + quarter − 1).
pub fn quarter_index(q: Quarter) -> i64 {
    i64::from(q.year) * 4 + i64::from(q.q) - 1
}

/// The stage on `date` and how many whole quarters into it (spec 5.1.1).
pub fn stage_at(date: Date, boom: Date, pop: Date) -> (AiStage, i64) {
    let (q, qb, qp) = (
        quarter_index(date.quarter()),
        quarter_index(boom.quarter()),
        quarter_index(pop.quarter()),
    );
    if q < qb {
        (AiStage::Preboom, 0)
    } else if q < qp {
        (AiStage::Boom, q - qb)
    } else if q < qp + BUST_QUARTERS {
        (AiStage::Bust, q - qp)
    } else {
        (AiStage::Postcrash, q - qp - BUST_QUARTERS)
    }
}

/// AI labs' long-term rate in a stage (spec 5.1.1): the boom year is whole years into the boom,
/// the last schedule row holding for every later year ("Boom year 10 and later").
pub fn ai_labs_lt(schedule: &AiSchedule, stage: AiStage, quarters_in: i64) -> f64 {
    match stage {
        AiStage::Preboom => schedule.preboom_lt,
        AiStage::Boom => {
            let year = usize::try_from(quarters_in / 4).unwrap_or(0);
            let last = schedule.boom_lt.len().saturating_sub(1);
            schedule
                .boom_lt
                .get(year.min(last))
                .copied()
                .unwrap_or(schedule.preboom_lt)
        }
        AiStage::Bust => schedule.bust_lt,
        AiStage::Postcrash => schedule.postcrash_lt,
    }
}

/// `lt = trend_growth + boom_uplift × (AI labs LT − preboom LT)` (spec 5.1.1, batch 153 Q2).
pub fn linked_lt(trend_growth: f64, boom_uplift: f64, ai_lt: f64, preboom_lt: f64) -> f64 {
    trend_growth + boom_uplift * (ai_lt - preboom_lt)
}

/// The pop date, rolled at load from the gen stream (spec 5.1.1, A): 2040 plus −2 to +2, the
/// first day of quarter 1 to 4.
pub fn roll_pop_date(draws: &mut dyn DrawSource) -> Date {
    let year = draws.int_inclusive(Stream::Gen, -POP_YEAR_ROLL, POP_YEAR_ROLL);
    let q = draws.int_inclusive(Stream::Gen, POP_QUARTERS.0, POP_QUARTERS.1);
    Quarter {
        year: POP_BASE_YEAR + i32::try_from(year).expect("small roll"),
        q: u8::try_from(q).expect("quarter 1 to 4"),
    }
    .first_day()
}

/// The label the boom forces on a linked industry (boom_uplift above 0): Boom for the boom's
/// first 4 quarters, Bust for the 8 bust quarters, whatever the gap (spec 5.1.1).
pub fn forced_label(boom_uplift: f64, ai: &AiBoom, date: Date) -> Option<PhaseLabel> {
    if boom_uplift <= 0.0 {
        return None;
    }
    match stage_at(date, ai.boom_date, ai.pop_date) {
        (AiStage::Boom, q) if q < BOOM_LABEL_QUARTERS => Some(PhaseLabel::Boom),
        (AiStage::Bust, _) => Some(PhaseLabel::Bust),
        _ => None,
    }
}

/// 4.3 step 1a: the scripted AI events due today. On the boom, every linked industry carries over
/// from its new lt_q (D103) and a World event alert fires. On the pop, every industry's demand_core
/// and trend_demand fall by crash_drop once, linked industries carry over from the new lt_q, and a
/// World event alert fires. The bust's end needs no event: lt moves to the post-crash rate.
pub fn ai_events_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    let (stage, _) = stage_at(ctx.facts.date, world.ai.boom_date, world.ai.pop_date);
    if stage == world.ai.stage {
        return;
    }
    world.ai.stage = stage;
    match stage {
        AiStage::Boom => {
            mark_linked_carry_reset(world);
            ctx.raise_alert(AlertKind::WorldEvent, AlertPayload::None);
        }
        AiStage::Bust => {
            for (_, ind) in world.industries.iter_mut() {
                let keep = 1.0 - ind.params.crash_drop;
                ind.demand_core *= keep;
                ind.trend_demand *= keep;
            }
            mark_linked_carry_reset(world);
            ctx.raise_alert(AlertKind::WorldEvent, AlertPayload::None);
        }
        AiStage::Postcrash | AiStage::Preboom => {}
    }
}

fn mark_linked_carry_reset(world: &mut World) {
    for (_, ind) in world.industries.iter_mut() {
        if ind.params.boom_uplift > 0.0 {
            ind.carry_reset = true;
        }
    }
}

/// Sets AI labs' rate for `date` and every industry's lt; the old lt is kept as prev_lt (D100).
pub fn set_industry_lt(world: &mut World, date: Date) {
    let (stage, quarters_in) = stage_at(date, world.ai.boom_date, world.ai.pop_date);
    let ai_lt = ai_labs_lt(&world.ai.schedule, stage, quarters_in);
    world.ai.ai_labs_lt = ai_lt;
    let pre = world.ai.schedule.preboom_lt;
    for (_, ind) in world.industries.iter_mut() {
        ind.prev_lt = ind.lt;
        ind.lt = linked_lt(ind.params.trend_growth, ind.params.boom_uplift, ai_lt, pre);
    }
}

/// 4.3 step 1b: every industry's lt.
pub fn industry_lt_job(world: &mut World, ctx: &mut JobCtx<'_>) {
    set_industry_lt(world, ctx.facts.date);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn schedule() -> AiSchedule {
        AiSchedule {
            preboom_lt: 0.05,
            boom_lt: vec![1.0, 1.0, 0.9, 0.8, 0.6, 0.45, 0.35, 0.25, 0.2, 0.15, 0.12],
            bust_lt: -0.1,
            postcrash_lt: 0.08,
        }
    }

    #[test]
    fn stages_by_date() {
        let (b, p) = (boom_date(), Date::ymd(2040, 4, 1));
        assert_eq!(
            stage_at(Date::ymd(2029, 12, 1), b, p),
            (AiStage::Preboom, 0)
        );
        assert_eq!(stage_at(Date::ymd(2030, 1, 1), b, p), (AiStage::Boom, 0));
        assert_eq!(stage_at(Date::ymd(2040, 1, 1), b, p), (AiStage::Boom, 40));
        assert_eq!(stage_at(Date::ymd(2040, 4, 1), b, p), (AiStage::Bust, 0));
        assert_eq!(stage_at(Date::ymd(2042, 3, 1), b, p), (AiStage::Bust, 7));
        assert_eq!(
            stage_at(Date::ymd(2042, 4, 1), b, p),
            (AiStage::Postcrash, 0)
        );
        let s = schedule();
        assert_eq!(ai_labs_lt(&s, AiStage::Boom, 9), 0.9);
        assert_eq!(ai_labs_lt(&s, AiStage::Boom, 40), 0.12);
        assert_eq!(ai_labs_lt(&s, AiStage::Boom, 80), 0.12);
    }

    #[test]
    fn linked_rates_in_boom_year_zero_and_the_bust() {
        // Spec 5.1.1: Data centers 29% (15% + 14 pp), Cloud 25%, Semiconductors 15% in boom year
        // 0; in the bust Data centers 13%, Cloud 19%, Semiconductors 3.5%.
        let close = |got: f64, want: f64| assert!((got - want).abs() < 1e-12, "{got} vs {want}");
        close(linked_lt(0.15, 0.15, 1.0, 0.05), 0.2925);
        close(linked_lt(0.20, 0.05, 1.0, 0.05), 0.2475);
        close(linked_lt(0.05, 0.10, 1.0, 0.05), 0.145);
        close(linked_lt(0.15, 0.15, -0.1, 0.05), 0.1275);
        close(linked_lt(0.20, 0.05, -0.1, 0.05), 0.1925);
        close(linked_lt(0.05, 0.10, -0.1, 0.05), 0.035);
    }
}
