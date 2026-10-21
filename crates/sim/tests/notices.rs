//! `Sim::step` returns the spec 9.3 notices of each tick, in order (build-plan M1.6; D10).

use sim::time::{Date, DateTime, Month, Quarter};
use sim::{Notice, Sim};

#[test]
fn a_year_of_notices() {
    let data = sim_data::load_world(&sim_data::default_data_dir()).unwrap();
    let mut s = Sim::new(data, 3).unwrap();
    let end = DateTime::midnight(Date::ymd(2021, 1, 1));
    let (mut days, mut months, mut released, mut locked, mut ticks) = (0, 0, vec![], vec![], 0);
    while s.now() < end {
        let n = s.step();
        assert_eq!(n.last(), Some(&Notice::TickDone(s.now())));
        for notice in n {
            match notice {
                Notice::DayDone(d) => {
                    assert_eq!(d.add_days(1), s.now().date());
                    days += 1;
                }
                Notice::MonthDone(m) => {
                    assert_eq!(m.next(), s.now().date().month_of());
                    months += 1;
                }
                Notice::EarningsReleased(q) => released.push(q),
                Notice::PlanLocked(q) => locked.push(q),
                Notice::TickDone(_) => ticks += 1,
                _ => {}
            }
        }
    }
    assert_eq!((ticks, days, months), (8784, 366, 12));
    let q = |year, q| Quarter { year, q };
    assert_eq!(released, [q(2019, 4), q(2020, 1), q(2020, 2), q(2020, 3)]);
    assert_eq!(locked, [q(2020, 1), q(2020, 2), q(2020, 3), q(2020, 4)]);
    assert_eq!(
        Month {
            year: 2020,
            month: 12
        }
        .next(),
        s.now().date().month_of()
    );
}
