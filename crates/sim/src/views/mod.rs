//! `SimViews`: the read-only query tables the UI reads (spec 9, 9.2, 9.4; build-plan M1.6, M7.3).
//!
//! The sim builds every view after each tick on the spec 9.4 cadence and hands out
//! [`SimViews`] by reference ([`crate::Sim::views`]); the Bevy bridge clones it once per frame
//! into a resource. UI code never touches sim tables (spec 9). Each view carries a version (the
//! refresh it was last rebuilt in) and a dirty flag (rebuilt in the latest refresh), so the bridge
//! copies only what changed.
//!
//! **One file per view.** Each view is a struct in its own file that implements [`ViewData`]:
//! its cadence and its `build` from the [`ViewInput`]. Filling a view touches only its file.
//! Adding a view is a new file plus one line in the `sim_views!` list below, which generates the
//! module, the [`SimViews`] field and the build and refresh code. M1 fills the clock view, M2 the
//! industry rows, industry detail and cycle views, M3 the units, tech and company detail views,
//! M4 the statements, filings, ratings and company rows, M5 the quotes, price bars, exchanges
//! and market stats (and prices in the company rows and detail, confidence in the cycle view);
//! the others are empty placeholders on their cadence.

use std::fmt;
use std::sync::Arc;

use crate::map::MapData;
use crate::time::control::Controls;
use crate::time::scheduler::{TickFacts, TickObserver, TickPart};
use crate::world::World;

pub mod estimate;

/// How often a view is rebuilt (spec 9.4).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Cadence {
    EveryTick,
    /// At 00:00.
    Daily,
    /// On the 1st at 00:00, and on load.
    Monthly,
    /// Monthly, and at the plan lock, when companies are born and list (5.19, 5.20; D159): the
    /// company views, so a newborn is in every table the tick it is born.
    MonthlyAndLock,
    /// On the quarter's compile, release (and its 01:00 price move), lock and recap ticks.
    Quarterly,
    /// Once at load.
    OnceAtLoad,
}

impl Cadence {
    /// A month's or a quarter's cadence: rebuilt on a few costly ticks, so worth a worker
    /// thread (D801); every-tick and daily views are cheap and stay on the sim's thread.
    pub fn is_periodic(self) -> bool {
        matches!(
            self,
            Cadence::Monthly | Cadence::MonthlyAndLock | Cadence::Quarterly
        )
    }

    /// Whether a view of this cadence is rebuilt after the tick `f`.
    pub fn is_due(self, f: &TickFacts) -> bool {
        match self {
            Cadence::EveryTick => true,
            Cadence::Daily => f.is_midnight(),
            Cadence::Monthly => f.is_month_start(),
            Cadence::MonthlyAndLock => f.is_month_start() || f.is_lock_tick(),
            Cadence::Quarterly => {
                f.is_quarter_start()
                    || f.is_release_tick()
                    || f.is_price_move_tick()
                    || f.is_lock_tick()
                    || f.is_recap_tick()
            }
            Cadence::OnceAtLoad => false,
        }
    }
}

/// What a view is built from: the state after the latest tick and the controls. Views read; they
/// never change anything.
pub struct ViewInput<'a> {
    pub world: &'a World,
    pub controls: &'a Controls,
    /// The game seed: the estimate bands hash it (D421). Views never see the RNG streams.
    pub seed: u64,
    /// The static map data (province tags and, with lane P's assets, the shapes; M8). Not
    /// world state: never saved or hashed.
    pub map: &'a crate::map::MapData,
}

impl ViewInput<'_> {
    /// The estimate maker for this build (D420).
    pub fn estimator(&self) -> estimate::Estimator {
        estimate::Estimator::new(self.seed, self.controls.omniscient, self.world.clock)
    }
}

/// One view's data: its cadence and how to build it.
pub trait ViewData: Clone + PartialEq + fmt::Debug {
    /// When it is rebuilt (spec 9.4). Every view is also built at a new game and on load.
    const CADENCE: Cadence;
    /// Also rebuilt after a control (speed, pause, skip), between ticks.
    const ON_CONTROL: bool = false;
    /// Also rebuilt after a control that turns Omniscient on or off (D423): the views whose
    /// figures are estimate bands unless Omniscient shows the truth.
    const ON_OMNISCIENT: bool = false;

    fn build(input: &ViewInput<'_>) -> Self;

    /// The view overrides [`ViewData::rebuild`] to reuse its last build (its allocations, D402,
    /// or its archived estimates, D435). A view that does not is built anew on each rebuild, so
    /// a copy a reader still holds is never cloned for it (D775).
    const REBUILD_IN_PLACE: bool = false;

    /// Rebuilds this view in place from `input`; the result must equal [`ViewData::build`]'s.
    /// The default builds a new one; a view rebuilt every tick overrides it to reuse its
    /// allocations (D402), and sets [`ViewData::REBUILD_IN_PLACE`].
    fn rebuild(&mut self, input: &ViewInput<'_>) {
        *self = Self::build(input);
    }

    /// [`ViewData::rebuild`] of a copy of `prev`, for a [`ViewData::REBUILD_IN_PLACE`] view
    /// whose last build a reader still holds (D775); the result must equal `build`'s. The
    /// default clones `prev` and rebuilds the clone; a view whose rebuild only reads its last
    /// build overrides it to skip the clone.
    fn rebuild_from(prev: &Self, input: &ViewInput<'_>) -> Self {
        let mut v = prev.clone();
        v.rebuild(input);
        v
    }
}

/// One view with its version and dirty flag (spec 9.4, 12.3). The data is shared (D775): a
/// copy of the view (the Bevy bridge's, once a frame) shares it until the sim rebuilds the
/// view, so copying a view costs the same whatever its size.
#[derive(Debug, Clone, PartialEq)]
pub struct View<T> {
    data: Arc<T>,
    version: u64,
    dirty: bool,
}

impl<T: ViewData> View<T> {
    fn built(input: &ViewInput<'_>, version: u64) -> Self {
        View {
            data: Arc::new(T::build(input)),
            version,
            dirty: true,
        }
    }

    pub fn get(&self) -> &T {
        &self.data
    }

    pub fn cadence(&self) -> Cadence {
        T::CADENCE
    }

    /// The refresh this view was last rebuilt in.
    pub fn version(&self) -> u64 {
        self.version
    }

    /// Rebuilt in the latest refresh.
    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    fn after_tick(&mut self, facts: &TickFacts, input: &ViewInput<'_>, version: u64) {
        self.dirty = T::CADENCE.is_due(facts);
        if self.dirty {
            if T::REBUILD_IN_PLACE {
                match Arc::get_mut(&mut self.data) {
                    Some(data) => data.rebuild(input),
                    // A reader still holds the last build: rebuild from it into a new one.
                    None => self.data = Arc::new(T::rebuild_from(&self.data, input)),
                }
            } else {
                self.data = Arc::new(T::build(input));
            }
            self.version = version;
        }
    }

    /// Rebuilds after a control if this view follows controls (or Omniscient, and it was
    /// toggled) and changed; true if it did.
    fn after_control(&mut self, input: &ViewInput<'_>, version: u64, toggled: bool) -> bool {
        if !(T::ON_CONTROL || (T::ON_OMNISCIENT && toggled)) {
            return false;
        }
        let data = T::build(input);
        if data == *self.data {
            return false;
        }
        self.data = Arc::new(data);
        self.version = version;
        self.dirty = true;
        true
    }
}

/// Most worker threads one view refresh builds its views on (D801), besides the sim's own.
pub const VIEW_WORKERS: usize = 6;

/// The view rebuilds of one refresh that may run on worker threads (D801).
#[derive(Default)]
struct Jobs<'a>(Vec<Box<dyn FnOnce() + Send + 'a>>);

impl Jobs<'_> {
    /// Runs every job: on this thread when there is one, else on up to [`VIEW_WORKERS`] scoped
    /// threads and this one, each taking the next job until none is left. A job's result lands
    /// in its own view, so which thread ran it and when changes nothing.
    fn run(self) {
        let n = self.0.len();
        if n <= 1 {
            self.0.into_iter().for_each(|job| job());
            return;
        }
        let queue = std::sync::Mutex::new(self.0.into_iter());
        let work = || {
            loop {
                let job = queue.lock().map(|mut q| q.next()).unwrap_or(None);
                match job {
                    Some(job) => job(),
                    None => break,
                }
            }
        };
        let workers = (n - 1).min(VIEW_WORKERS);
        std::thread::scope(|s| {
            for _ in 0..workers {
                s.spawn(work);
            }
            work();
        });
    }
}

/// Declares every view: `field: module::Type;`. Generates the modules, the `SimViews` fields and
/// the build and refresh passes, in this order.
macro_rules! sim_views {
    ($($field:ident: $module:ident::$ty:ident;)*) => {
        $(
            pub mod $module;
            pub use $module::$ty;
        )*

        /// Every view the UI reads (spec 9.4).
        #[derive(Debug, Clone, PartialEq)]
        pub struct SimViews {
            refresh: u64,
            /// Omniscient at the last build, so a control that toggles it rebuilds the
            /// `ON_OMNISCIENT` views (D423).
            omniscient: bool,
            $(pub $field: View<$ty>,)*
        }

        impl SimViews {
            /// Every view built from the state, all dirty, at refresh 1: the first build of a
            /// `Sim` (spec 9.4).
            pub(crate) fn build(
                world: &World,
                controls: &Controls,
                seed: u64,
                map: &MapData,
            ) -> SimViews {
                let input = ViewInput { world, controls, seed, map };
                SimViews {
                    refresh: 1,
                    omniscient: controls.omniscient,
                    $($field: View::built(&input, 1),)*
                }
            }

            /// Every view rebuilt from a new state, all dirty, at the next refresh number: at a
            /// NewGame and on load (spec 9.4). The refresh counter and every view's version keep
            /// climbing, so a reader that copies views by version never mistakes a new game's
            /// views for ones it already has.
            pub(crate) fn rebuild(
                &mut self,
                world: &World,
                controls: &Controls,
                seed: u64,
                map: &MapData,
            ) {
                self.refresh += 1;
                self.omniscient = controls.omniscient;
                let input = ViewInput { world, controls, seed, map };
                $(self.$field = View::built(&input, self.refresh);)*
            }

            /// Every view holds the same data as in `other`, whatever their versions and dirty
            /// flags (for checking that a copy shows a given state).
            pub fn same_data(&self, other: &SimViews) -> bool {
                true $(&& self.$field.get() == other.$field.get())*
            }

            /// Makes this copy show `src`: every view whose version differs is cloned in, the
            /// others are left alone, and the refresh number follows. Generated over the whole
            /// list, so a reader (the Bevy bridge) that copies views by version cannot miss one.
            pub fn copy_changed_from(&mut self, src: &SimViews) {
                $(if self.$field.version() != src.$field.version() {
                    self.$field.clone_from(&src.$field);
                })*
                self.refresh = src.refresh;
                self.omniscient = src.omniscient;
            }

            /// After a tick: rebuilds the views due on this tick and clears the others' dirty
            /// flags (spec 9.4).
            ///
            /// With an `observer`, each view rebuilt is timed as a [`TickPart::View`] (D400), one
            /// after another. Without one, the views of a month's or a quarter's tick (cadence
            /// [`Cadence::is_periodic`]) are built on worker threads at once (D801): each view is
            /// a pure function of the state, built by the same code into its own field, so the
            /// views are the same whichever thread builds them and in whatever order.
            pub(crate) fn refresh_after_tick(
                &mut self,
                world: &World,
                controls: &Controls,
                seed: u64,
                map: &MapData,
                mut observer: Option<&mut dyn TickObserver>,
            ) {
                self.refresh += 1;
                let facts = TickFacts::new(world.clock);
                let input = ViewInput { world, controls, seed, map };
                if observer.is_none() {
                    let refresh = self.refresh;
                    let (facts, input) = (&facts, &input);
                    let mut jobs = Jobs::default();
                    $(
                        let v = &mut self.$field;
                        if v.cadence().is_periodic() && v.cadence().is_due(facts) {
                            jobs.0.push(Box::new(move || v.after_tick(facts, input, refresh)));
                        } else {
                            v.after_tick(facts, input, refresh);
                        }
                    )*
                    jobs.run();
                    return;
                }
                $(
                    let watch = self.$field.cadence().is_due(&facts);
                    if watch && let Some(o) = &mut observer {
                        o.started(TickPart::View(stringify!($field)));
                    }
                    self.$field.after_tick(&facts, &input, self.refresh);
                    if watch && let Some(o) = &mut observer {
                        o.finished(TickPart::View(stringify!($field)));
                    }
                )*
            }

            /// After a control: rebuilds the views that follow controls (the clock), and those
            /// that follow Omniscient when it was toggled (D423).
            pub(crate) fn refresh_after_control(
                &mut self,
                world: &World,
                controls: &Controls,
                seed: u64,
                map: &MapData,
            ) {
                let input = ViewInput { world, controls, seed, map };
                let next = self.refresh + 1;
                let toggled = controls.omniscient != self.omniscient;
                self.omniscient = controls.omniscient;
                let mut changed = false;
                $(changed |= self.$field.after_control(&input, next, toggled);)*
                if changed {
                    self.refresh = next;
                }
            }
        }
    };
}

sim_views! {
    clock: clock::ClockView;
    places: places::PlacesView;
    countries: countries::CountriesView;
    zones: zones::ZonesView;
    rates: rates::RatesView;
    characters: characters::CharactersView;
    cap_table: cap_table::CapTableView;
    quotes: quotes::QuotesView;
    price_bars: price_bars::PriceBarsView;
    exchanges: exchanges::ExchangesView;
    market_stats: market_stats::MarketStatsView;
    news: news::NewsView;
    births: births::BirthsView;
    projection: projection::ProjectionView;
    company_rows: company_rows::CompanyRowsView;
    company_detail: company_detail::CompanyDetailView;
    units: units::UnitsView;
    tech: tech::TechView;
    industry_rows: industry_rows::IndustryRowsView;
    industry_detail: industry_detail::IndustryDetailView;
    cycle: cycle::CycleView;
    map_layers: map_layers::MapLayersView;
    province_cards: province_cards::ProvinceCardsView;
    statements: statements::StatementsView;
    filings: filings::FilingsView;
    ratings: ratings::RatingsView;
    recap: recap::RecapView;
    map_static: map_static::MapStaticView;
}

impl SimViews {
    /// The latest refresh number.
    pub fn refresh(&self) -> u64 {
        self.refresh
    }

    /// The clock (spec 9.1 `clock()`).
    pub fn clock(&self) -> &ClockView {
        self.clock.get()
    }

    /// `get_map_layer(mode, param)` (spec 9.2, 8 Map row): every mode, the Financial zones one
    /// with v_cycle's zone effects and phase and v_exchanges' hubs and index levels (D700).
    pub fn get_map_layer(&self, mode: map_layers::MapMode) -> map_layers::MapLayer {
        let zones = matches!(mode, map_layers::MapMode::FinancialZones)
            .then(|| (self.cycle.get(), self.exchanges.get()));
        self.map_layers.get().layer(mode, zones)
    }

    /// The versions of the views `get_map_layer(mode)` reads (v_map_layers, and for the
    /// Financial zones mode v_cycle and v_exchanges; 0 for a view the mode does not read): the
    /// map rewrites its colour table only when these move (m8-plan risks).
    pub fn map_layer_versions(&self, mode: map_layers::MapMode) -> [u64; 3] {
        match mode {
            map_layers::MapMode::FinancialZones => [
                self.map_layers.version(),
                self.cycle.version(),
                self.exchanges.version(),
            ],
            _ => [self.map_layers.version(), 0, 0],
        }
    }
}
