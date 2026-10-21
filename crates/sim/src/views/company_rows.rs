//! v_company_row: `list_companies(filter)` (spec 9.2). M4 fills the rows the books allow: id,
//! name, ticker, industry, HQ, public, revenue TTM, net income TTM, rating and status, from the
//! published statements (D130). M5 adds the exchange, price, day change and shown value at the
//! rebuild (the live price is in v_quotes). M9 adds the archetype, origin, listing, owner of
//! record and controller (spec 8 Company header, F10 Screener filters by origin and listing
//! date), and shows a private company's or new listing's money figures as estimate bands
//! (D420). Removed companies are left out (5.12 step 3: off the lists). Rebuilt monthly, at the
//! plan lock and on load (spec 9.4), and when Omniscient is toggled (D423).

use super::cap_table::{controller_name, controller_of};
use super::estimate::{Field, Figure};
use super::statements::published;
use super::{Cadence, ViewData, ViewInput};
use crate::ai::archetype::Archetype;
use crate::finance::distress::CompanyStatus;
use crate::finance::rating::Rating;
use crate::finance::statements::trailing_four;
use crate::market::fair_value::shown_value;
use crate::time::Date;
use crate::world::{CharacterId, CompanyId, ControllerRef, CountryId, IndustryId, Origin, ZoneId};

/// Where a company is listed (spec 3.5 `listed_date`, 8 Company header "Listed [date] on
/// [exchange] at $[price]").
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Listing {
    Private,
    /// One of the 467 listed at load: "listed before 2020" (no date; D428).
    BeforeStart { exchange: ZoneId },
    /// Listed in play at a plan lock (5.20.1).
    InPlay {
        exchange: ZoneId,
        date: Date,
        ipo_price: f64,
    },
}

impl Listing {
    pub fn exchange(self) -> Option<ZoneId> {
        match self {
            Listing::Private => None,
            Listing::BeforeStart { exchange } | Listing::InPlay { exchange, .. } => Some(exchange),
        }
    }

    /// The listing date; None while private and for "listed before 2020".
    pub fn date(self) -> Option<Date> {
        match self {
            Listing::InPlay { date, .. } => Some(date),
            _ => None,
        }
    }
}

/// One row of the company list.
#[derive(Debug, Clone, PartialEq)]
pub struct CompanyRow {
    pub id: CompanyId,
    pub key: String,
    pub name: String,
    pub ticker: String,
    pub industry: IndustryId,
    pub hq_country: CountryId,
    pub public: bool,
    /// Trailing four published quarters (spec 5.13 TTM; D228); a band for a private company or
    /// a new listing (D420).
    pub revenue_ttm: Figure,
    pub net_income_ttm: Figure,
    pub rating: Rating,
    pub status: CompanyStatus,
    /// The listing exchange (spec 5.14), `None` while private.
    pub exchange: Option<ZoneId>,
    /// P and the day's change at the rebuild (5.14); 0 for a private or delisted company.
    pub price: f64,
    pub change: f64,
    /// The value shown (spec 5.13 step 6): a listed company's market cap at its estimated fair
    /// value (3.14.2), exact (it is already an estimate, D140); a private company's 0.7 × fair
    /// value as a band (D420); 0 once Bankrupt.
    pub value: Figure,
    /// Spec 6.1 (spec 9.2 `list_companies` archetype filter).
    pub archetype: Archetype,
    /// Start or Born (spec 3.5; F10 Screener origin filter).
    pub origin: Origin,
    /// Private, listed before 2020, or listed in play with its date (F10 listing-date filter).
    pub listing: Listing,
    /// companies.csv `owner_of_record` and its name (spec 8 header; D425).
    pub owner_of_record: Option<CharacterId>,
    pub owner_of_record_name: Option<String>,
    /// The controller (companies.csv's, or a startup's lead founder) and its name; widely held
    /// companies have none (spec 8 header).
    pub controller: ControllerRef,
    pub controller_name: Option<String>,
    /// The figures are estimate bands (D420).
    pub estimated: bool,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct CompanyRowsView {
    /// Every company still in the game, in company id order.
    pub rows: Vec<CompanyRow>,
}

impl ViewData for CompanyRowsView {
    const CADENCE: Cadence = Cadence::MonthlyAndLock;
    const ON_OMNISCIENT: bool = true;

    fn build(input: &ViewInput<'_>) -> Self {
        let w = input.world;
        let est = input.estimator();
        let rows = w
            .companies
            .iter()
            .filter(|(_, c)| c.finance.in_game())
            .map(|(id, c)| {
                let banded = est.banded(w, id);
                let quarters = c.finance.quarters();
                let n = quarters
                    .iter()
                    .take_while(|s| published(s, w.clock))
                    .count();
                let ttm = trailing_four(&quarters[..n]).unwrap_or_default();
                let s = &w.market.stocks[id];
                let value = match s.exchange {
                    Some(_) => Figure::Exact(s.fair_value * (1.0 + s.efv_error)),
                    None => est.current(
                        banded,
                        id,
                        Field::Value,
                        shown_value(s.fair_value, false),
                    ),
                };
                let listing = match (s.exchange, s.listed_on) {
                    (None, _) => Listing::Private,
                    (Some(exchange), None) => Listing::BeforeStart { exchange },
                    (Some(exchange), Some(date)) => Listing::InPlay {
                        exchange,
                        date,
                        ipo_price: s.ipo_price,
                    },
                };
                let owner = c.start_control.as_ref().and_then(|sc| sc.owner_of_record);
                let controller = controller_of(c);
                CompanyRow {
                    id,
                    key: c.key.clone(),
                    name: c.name.clone(),
                    ticker: c.ticker.clone(),
                    industry: c.industry,
                    hq_country: c.hq_country,
                    public: c.public,
                    revenue_ttm: est.current(banded, id, Field::RevenueTtm, ttm.revenue),
                    net_income_ttm: est.current(
                        banded,
                        id,
                        Field::NetIncomeTtm,
                        ttm.net_income(),
                    ),
                    rating: c.finance.rating,
                    status: c.finance.status(),
                    exchange: s.exchange,
                    price: s.price,
                    change: s.price - s.prev_close,
                    value,
                    archetype: c.archetype,
                    origin: c.origin,
                    listing,
                    owner_of_record: owner,
                    owner_of_record_name: owner.map(|ch| w.characters[ch].name.clone()),
                    controller,
                    controller_name: controller_name(w, controller),
                    estimated: banded,
                }
            })
            .collect();
        CompanyRowsView { rows }
    }
}
