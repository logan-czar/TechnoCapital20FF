//! SimViews (build-plan M1.6, spec 9.1 `clock()` and the 9.4 cadences), read only through the
//! `Sim` API.

use sim::Sim;
use sim::time::{Control, Date, DateTime, QuarterPhase, Weekday};
use sim::views::Cadence;
use sim::world::SkipKind;

fn sim() -> Sim {
    let data = sim_data::load_world(&sim_data::default_data_dir()).unwrap();
    Sim::new(data, 5).unwrap()
}

fn run_until(s: &mut Sim, t: DateTime) {
    while s.now() < t {
        s.step();
    }
}

#[test]
fn clock_view_at_start_and_after_ticks() {
    let mut s = sim();
    let c = s.clock().clone();
    assert_eq!(c.now, DateTime::START);
    assert_eq!(
        (c.date, c.hour, c.weekday),
        (Date::ymd(2020, 1, 1), 0, Weekday::Wed)
    );
    assert_eq!((c.speed, c.selected_speed, c.paused), (0, 1, true));
    assert_eq!(c.quarter_phase, QuarterPhase::PreQuarterEnd);
    assert_eq!(c.days_to_next_phase, 1);

    run_until(&mut s, DateTime::at(Date::ymd(2020, 1, 2), 1));
    let c = s.clock();
    assert_eq!((c.hour, c.weekday), (1, Weekday::Thu));
    assert_eq!(c.quarter_phase, QuarterPhase::Reaction);
    assert_eq!(c.next_phase, QuarterPhase::Locked);
    assert_eq!(c.days_to_next_phase, 7);

    // Controls show at once, between ticks.
    s.apply(Control::SkipTo(SkipKind::NextLock)).unwrap();
    assert_eq!(s.clock().speed, 5);
    assert_eq!(s.clock().skipping, Some(SkipKind::NextLock));
}

#[test]
fn views_rebuild_on_their_cadence() {
    let mut s = sim();
    let v = s.views();
    assert!(v.clock.is_dirty() && v.map_static.is_dirty() && v.statements.is_dirty());
    assert_eq!(v.map_static.cadence(), Cadence::OnceAtLoad);

    // A plain hour: only the every-tick views.
    s.step();
    let v = s.views();
    assert!(v.clock.is_dirty() && v.quotes.is_dirty());
    assert!(!v.price_bars.is_dirty() && !v.company_rows.is_dirty() && !v.map_static.is_dirty());

    // Midnight of 2 Jan: daily, and quarterly for the release.
    run_until(&mut s, DateTime::midnight(Date::ymd(2020, 1, 2)));
    let v = s.views();
    assert!(v.price_bars.is_dirty() && v.news.is_dirty() && v.statements.is_dirty());
    assert!(!v.company_rows.is_dirty());

    // 1 Feb: monthly, not quarterly.
    run_until(&mut s, DateTime::midnight(Date::ymd(2020, 2, 1)));
    let v = s.views();
    assert!(v.company_rows.is_dirty() && v.province_cards.is_dirty());
    assert!(!v.statements.is_dirty() && !v.map_static.is_dirty());
    assert_eq!(v.company_rows.version(), v.refresh());
    assert_eq!(v.map_static.version(), 1);
}

/// Versions of a spread of views: every tick, daily, monthly, quarterly and once at load.
fn versions(s: &Sim) -> Vec<u64> {
    let v = s.views();
    vec![
        v.refresh(),
        v.clock.version(),
        v.price_bars.version(),
        v.industry_rows.version(),
        v.cycle.version(),
        v.statements.version(),
        v.map_static.version(),
    ]
}

#[test]
fn versions_keep_climbing_across_new_game_and_load() {
    // The bridge copies views by version (spec 9.4), so a NewGame or a Load must never hand out a
    // version it has handed out before.
    let mut s = sim();
    run_until(&mut s, DateTime::midnight(Date::ymd(2020, 2, 3)));
    let before = versions(&s);
    let top = *before.iter().max().unwrap();
    s.apply(Control::NewGame { seed: 6 }).unwrap();
    let after = versions(&s);
    assert!(after.iter().all(|&v| v > top), "{before:?} then {after:?}");
    assert_eq!(s.now(), DateTime::START);
    assert!(s.views().map_static.is_dirty() && s.views().cycle.is_dirty());

    run_until(&mut s, DateTime::midnight(Date::ymd(2020, 1, 5)));
    let save = s.save_bytes();
    run_until(&mut s, DateTime::midnight(Date::ymd(2020, 3, 2)));
    let before = versions(&s);
    let top = *before.iter().max().unwrap();
    s.load_bytes(&save).unwrap();
    let after = versions(&s);
    assert!(after.iter().all(|&v| v > top), "{before:?} then {after:?}");
    assert_eq!(s.now(), DateTime::midnight(Date::ymd(2020, 1, 5)));
    assert!(s.views().map_static.is_dirty());
}

/// Watches nothing: a step with it builds its views one after another (D400).
struct Sequential;

impl sim::time::TickObserver for Sequential {
    fn started(&mut self, _: sim::time::TickPart) {}
    fn finished(&mut self, _: sim::time::TickPart) {}
}

/// D801: the views of a month's or a quarter's tick, built on worker threads, are exactly the
/// views built one after another (an observed step), through a plan lock, a recap, a quarter's
/// start, its release and its price move.
#[test]
fn views_built_on_worker_threads_match_views_built_in_turn() {
    let (mut par, mut seq) = (sim(), sim());
    let end = DateTime::midnight(Date::ymd(2020, 4, 3));
    let mut checked = 0;
    while par.now() < end {
        let (a, b) = (par.step(), seq.step_observed(&mut Sequential));
        assert_eq!(a, b, "notices at {}", par.now());
        if par.now().hour() == 0 {
            assert!(par.views() == seq.views(), "views at {}", par.now());
            checked += 1;
        }
    }
    assert!(checked > 90);
    assert_eq!(par.state_hash(), seq.state_hash());
}
