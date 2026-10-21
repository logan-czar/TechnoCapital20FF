//! `SimViews`: the read-only query tables the UI reads (spec 9, 9.2, 9.4; build-plan M1.6, M7.3).
//!
//! The sim builds every view after each tick on the spec 9.4 cadence and hands out
//! [`SimViews`] by reference ([`crate::Sim::views`]); the Bevy bridge clones it once per frame
//! into a resource. UI code never touches sim tables (spec 9). Each view carries a version (the
//! refresh it was last rebuilt in) and a dirty flag (rebuilt in the latest refresh), so the bridge
//! copies only what changed.
//!
//! M1 fills the clock view (spec 9.1 `clock()`). The others are empty placeholders on their
//! cadence; the milestone that owns each one fills its struct and builder.

use serde::{Deserialize, Serialize};

use crate::time::control::Controls;
use crate::time::quarter::{QuarterPhase, phase_at};
use crate::time::scheduler::TickFacts;
use crate::time::{Date, DateTime, Weekday};
use crate::world::{SkipKind, World};

/// How often a view is rebuilt (spec 9.4).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Cadence {
    EveryTick,
    /// At 00:00.
    Daily,
    /// On the 1st at 00:00, and on load.
    Monthly,
    /// On the quarter's compile, release (and its 01:00 price move), lock and recap ticks.
    Quarterly,
    /// Once at load.
    OnceAtLoad,
}

impl Cadence {
    /// Whether a view of this cadence is rebuilt after the tick `f`.
    pub fn is_due(self, f: &TickFacts) -> bool {
        match self {
            Cadence::EveryTick => true,
            Cadence::Daily => f.is_midnight(),
            Cadence::Monthly => f.is_month_start(),
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

/// One view with its version and dirty flag (spec 9.4, 12.3).
#[derive(Debug, Clone, PartialEq)]
pub struct View<T> {
    data: T,
    cadence: Cadence,
    version: u64,
    dirty: bool,
}

impl<T> View<T> {
    fn new(cadence: Cadence, data: T, version: u64) -> Self {
        View {
            data,
            cadence,
            version,
            dirty: true,
        }
    }

    pub fn get(&self) -> &T {
        &self.data
    }

    pub fn cadence(&self) -> Cadence {
        self.cadence
    }

    /// The refresh this view was last rebuilt in.
    pub fn version(&self) -> u64 {
        self.version
    }

    /// Rebuilt in the latest refresh.
    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    fn set(&mut self, data: T, version: u64) {
        self.data = data;
        self.version = version;
        self.dirty = true;
    }
}

/// The clock (spec 9.1 `clock()`, the spec 8 top bar and quarter clock).
#[derive(Debug, Clone, PartialEq)]
pub struct ClockView {
    pub now: DateTime,
    pub date: Date,
    pub hour: u8,
    pub weekday: Weekday,
    /// The speed the runner runs at: 0 paused, 5 while skipping (spec 9.1).
    pub speed: u8,
    /// The speed picked (1 to 5), kept while paused.
    pub selected_speed: u8,
    pub paused: bool,
    pub skipping: Option<SkipKind>,
    pub quarter_phase: QuarterPhase,
    pub next_phase: QuarterPhase,
    /// Calendar days to the next phase start (D7).
    pub days_to_next_phase: u32,
}

impl ClockView {
    fn build(world: &World, controls: &Controls) -> ClockView {
        let now = world.clock;
        let phase = phase_at(now);
        ClockView {
            now,
            date: now.date(),
            hour: now.hour(),
            weekday: now.weekday(),
            speed: controls.effective_speed(),
            selected_speed: controls.speed,
            paused: controls.paused,
            skipping: controls.skip.map(|s| s.kind),
            quarter_phase: phase.phase,
            next_phase: phase.next_phase,
            days_to_next_phase: phase.days_to_next_phase(now.date()),
        }
    }
}

macro_rules! placeholder_views {
    ($($(#[$m:meta])* $name:ident;)*) => {$(
        $(#[$m])*
        ///
        /// Placeholder: filled by the milestone that owns it.
        #[derive(Debug, Clone, Default, PartialEq)]
        pub struct $name {}
    )*};
}

placeholder_views! {
    /// v_quotes, every tick: `get_quotes` (spec 9.2; M5).
    QuotesView;
    /// v_price_bars, daily: `get_price_history` (M5).
    PriceBarsView;
    /// v_news, daily: `get_news` (M6.5).
    NewsView;
    /// v_projection, daily: `get_company_projection` (M6.4).
    ProjectionView;
    /// v_company_row, monthly: `list_companies` (M2 on).
    CompanyRowsView;
    /// v_company_detail, monthly: `get_company`, board, cap table (M3, M4).
    CompanyDetailView;
    /// v_units, monthly: `get_company_units` (M2).
    UnitsView;
    /// v_tech, monthly: `get_company_tech` (M3).
    TechView;
    /// v_industry_row, monthly: `list_industries` (M2).
    IndustryRowsView;
    /// v_industry_detail, monthly: `get_industry` (M2).
    IndustryDetailView;
    /// v_map_layers, monthly: `get_map_layer` for industry assets and HQs (M8).
    MapLayersView;
    /// v_province_card, monthly: `get_province` (M8.7).
    ProvinceCardsView;
    /// v_statements, quarterly: `get_company_statements` (M4).
    StatementsView;
    /// v_filings, quarterly: `get_filings` (M4).
    FilingsView;
    /// v_ratings, quarterly: ratings (M4.5).
    RatingsView;
    /// v_recap, quarterly: `get_recap` (M6.5).
    RecapView;
    /// v_map_static, once at load: development, political, Metros, key cities (M8).
    MapStaticView;
}

/// Every view the UI reads (spec 9.4).
#[derive(Debug, Clone, PartialEq)]
pub struct SimViews {
    refresh: u64,
    pub clock: View<ClockView>,
    pub quotes: View<QuotesView>,
    pub price_bars: View<PriceBarsView>,
    pub news: View<NewsView>,
    pub projection: View<ProjectionView>,
    pub company_rows: View<CompanyRowsView>,
    pub company_detail: View<CompanyDetailView>,
    pub units: View<UnitsView>,
    pub tech: View<TechView>,
    pub industry_rows: View<IndustryRowsView>,
    pub industry_detail: View<IndustryDetailView>,
    pub map_layers: View<MapLayersView>,
    pub province_cards: View<ProvinceCardsView>,
    pub statements: View<StatementsView>,
    pub filings: View<FilingsView>,
    pub ratings: View<RatingsView>,
    pub recap: View<RecapView>,
    pub map_static: View<MapStaticView>,
}

/// Runs `$body` with `$v` bound to each placeholder view.
macro_rules! for_each_placeholder {
    ($views:expr, |$v:ident| $body:block) => {{
        let s = $views;
        for_each_placeholder!(@each s, $v, $body, quotes price_bars news projection company_rows
            company_detail units tech industry_rows industry_detail map_layers province_cards
            statements filings ratings recap map_static);
    }};
    (@each $s:ident, $v:ident, $body:block, $($field:ident)*) => {
        $({
            let $v = &mut $s.$field;
            $body
        })*
    };
}

/// Rebuilds a placeholder view (they hold nothing yet).
fn rebuild_placeholder<T: Default>(view: &mut View<T>, version: u64) {
    view.set(T::default(), version);
}

impl SimViews {
    /// Every view built from the state, all dirty: at a new game and on load (spec 9.4).
    pub(crate) fn build(world: &World, controls: &Controls) -> SimViews {
        let v = 1;
        SimViews {
            refresh: v,
            clock: View::new(Cadence::EveryTick, ClockView::build(world, controls), v),
            quotes: View::new(Cadence::EveryTick, QuotesView::default(), v),
            price_bars: View::new(Cadence::Daily, PriceBarsView::default(), v),
            news: View::new(Cadence::Daily, NewsView::default(), v),
            projection: View::new(Cadence::Daily, ProjectionView::default(), v),
            company_rows: View::new(Cadence::Monthly, CompanyRowsView::default(), v),
            company_detail: View::new(Cadence::Monthly, CompanyDetailView::default(), v),
            units: View::new(Cadence::Monthly, UnitsView::default(), v),
            tech: View::new(Cadence::Monthly, TechView::default(), v),
            industry_rows: View::new(Cadence::Monthly, IndustryRowsView::default(), v),
            industry_detail: View::new(Cadence::Monthly, IndustryDetailView::default(), v),
            map_layers: View::new(Cadence::Monthly, MapLayersView::default(), v),
            province_cards: View::new(Cadence::Monthly, ProvinceCardsView::default(), v),
            statements: View::new(Cadence::Quarterly, StatementsView::default(), v),
            filings: View::new(Cadence::Quarterly, FilingsView::default(), v),
            ratings: View::new(Cadence::Quarterly, RatingsView::default(), v),
            recap: View::new(Cadence::Quarterly, RecapView::default(), v),
            map_static: View::new(Cadence::OnceAtLoad, MapStaticView::default(), v),
        }
    }

    /// After a tick: clears the dirty flags, then rebuilds the views due on this tick (spec 9.4).
    pub(crate) fn refresh_after_tick(&mut self, world: &World, controls: &Controls) {
        self.refresh += 1;
        let v = self.refresh;
        let facts = TickFacts::new(world.clock);
        self.clock
            .set(ClockView::build(world, controls), self.refresh);
        for_each_placeholder!(&mut *self, |view| {
            view.dirty = false;
            if view.cadence.is_due(&facts) {
                rebuild_placeholder(view, v);
            }
        });
    }

    /// After a control: only the clock view changes (speed, pause, skip).
    pub(crate) fn refresh_clock(&mut self, world: &World, controls: &Controls) {
        let clock = ClockView::build(world, controls);
        if clock != self.clock.data {
            self.refresh += 1;
            self.clock.set(clock, self.refresh);
        }
    }

    /// The latest refresh number.
    pub fn refresh(&self) -> u64 {
        self.refresh
    }

    /// The clock (spec 9.1 `clock()`).
    pub fn clock(&self) -> &ClockView {
        self.clock.get()
    }
}
