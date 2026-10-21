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
//! module, the [`SimViews`] field and the build and refresh code. M1 fills the clock view; the
//! others are empty placeholders on their cadence.

use std::fmt;

use crate::time::control::Controls;
use crate::time::scheduler::TickFacts;
use crate::world::World;

/// How often a view is rebuilt (spec 9.4).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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

/// What a view is built from: the state after the latest tick and the controls. Views read; they
/// never change anything.
pub struct ViewInput<'a> {
    pub world: &'a World,
    pub controls: &'a Controls,
}

/// One view's data: its cadence and how to build it.
pub trait ViewData: Clone + PartialEq + fmt::Debug {
    /// When it is rebuilt (spec 9.4). Every view is also built at a new game and on load.
    const CADENCE: Cadence;
    /// Also rebuilt after a control (speed, pause, skip), between ticks.
    const ON_CONTROL: bool = false;

    fn build(input: &ViewInput<'_>) -> Self;
}

/// One view with its version and dirty flag (spec 9.4, 12.3).
#[derive(Debug, Clone, PartialEq)]
pub struct View<T> {
    data: T,
    version: u64,
    dirty: bool,
}

impl<T: ViewData> View<T> {
    fn built(input: &ViewInput<'_>, version: u64) -> Self {
        View {
            data: T::build(input),
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
            self.data = T::build(input);
            self.version = version;
        }
    }

    /// Rebuilds after a control if this view follows controls and changed; true if it did.
    fn after_control(&mut self, input: &ViewInput<'_>, version: u64) -> bool {
        if !T::ON_CONTROL {
            return false;
        }
        let data = T::build(input);
        if data == self.data {
            return false;
        }
        self.data = data;
        self.version = version;
        self.dirty = true;
        true
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
            $(pub $field: View<$ty>,)*
        }

        impl SimViews {
            /// Every view built from the state, all dirty: at a new game and on load (spec 9.4).
            pub(crate) fn build(world: &World, controls: &Controls) -> SimViews {
                let input = ViewInput { world, controls };
                SimViews {
                    refresh: 1,
                    $($field: View::built(&input, 1),)*
                }
            }

            /// After a tick: rebuilds the views due on this tick and clears the others' dirty
            /// flags (spec 9.4).
            pub(crate) fn refresh_after_tick(&mut self, world: &World, controls: &Controls) {
                self.refresh += 1;
                let facts = TickFacts::new(world.clock);
                let input = ViewInput { world, controls };
                $(self.$field.after_tick(&facts, &input, self.refresh);)*
            }

            /// After a control: rebuilds the views that follow controls (the clock).
            pub(crate) fn refresh_after_control(&mut self, world: &World, controls: &Controls) {
                let input = ViewInput { world, controls };
                let next = self.refresh + 1;
                let mut changed = false;
                $(changed |= self.$field.after_control(&input, next);)*
                if changed {
                    self.refresh = next;
                }
            }
        }
    };
}

sim_views! {
    clock: clock::ClockView;
    quotes: quotes::QuotesView;
    price_bars: price_bars::PriceBarsView;
    news: news::NewsView;
    projection: projection::ProjectionView;
    company_rows: company_rows::CompanyRowsView;
    company_detail: company_detail::CompanyDetailView;
    units: units::UnitsView;
    tech: tech::TechView;
    industry_rows: industry_rows::IndustryRowsView;
    industry_detail: industry_detail::IndustryDetailView;
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
}
