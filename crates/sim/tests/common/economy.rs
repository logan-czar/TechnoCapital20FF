//! Helpers for the M2 economy tests: a world at load from any draw source, and the monthly
//! economy run month by month through the economy's own jobs only (so later milestones' jobs in
//! the same slots, which draw from other streams, never reach a scripted source).

use sim::DrawSource;
use sim::time::scheduler::Group;
use sim::time::{Date, DateTime, JobCtx, Scheduler, Slot, TickFacts};
use sim::world::{IndustryId, Notice, World};

/// The world after load and the 7.3 start draws from `draws`.
pub fn world_at_load(data: &sim_data::WorldData, draws: &mut dyn DrawSource) -> World {
    let mut w = World::from_data(data).unwrap();
    sim::economy::start(&mut w, draws);
    w
}

/// A scheduler with only the economy's jobs.
pub fn economy_scheduler() -> Scheduler {
    let mut s = Scheduler::new();
    sim::economy::register(&mut s);
    s
}

/// Runs the monthly job due at 00:00 on `date` (a 1st): the step 1 slots on quarter starts, then
/// steps 2 to 14. Returns the notices the jobs posted (alerts are raised at their default
/// levels).
pub fn run_month(
    s: &Scheduler,
    w: &mut World,
    draws: &mut dyn DrawSource,
    date: Date,
) -> Vec<Notice> {
    assert_eq!(date.day, 1);
    w.clock = DateTime::midnight(date);
    let facts = TickFacts::new(w.clock);
    let due: Vec<Slot> = Slot::ALL
        .iter()
        .copied()
        .filter(|s| s.group() == Group::Monthly && s.is_due(&facts))
        .collect();
    let mut notices = Vec::new();
    let controls = sim::Controls::default();
    let mut ctx = JobCtx::new(facts, draws, &mut notices, &controls);
    s.run_slots(&due, w, &mut ctx);
    notices
}

/// The 1st of every month from `first` (inclusive) to `last` (inclusive).
pub fn month_starts(first: Date, last: Date) -> Vec<Date> {
    let mut out = Vec::new();
    let mut m = first.month_of();
    while m.first_day() <= last {
        out.push(m.first_day());
        m = m.next();
    }
    out
}

/// The industry with this industries.csv id.
pub fn industry(w: &World, key: &str) -> IndustryId {
    w.industries
        .iter()
        .find(|(_, i)| i.key == key)
        .map(|(id, _)| id)
        .unwrap_or_else(|| panic!("no industry {key}"))
}

/// Relative difference.
pub fn rel(a: f64, b: f64) -> f64 {
    (a - b).abs() / b.abs().max(f64::MIN_POSITIVE)
}
