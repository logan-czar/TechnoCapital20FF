//! Estimate bands (D420 to D434; Logan's 2026-10-21 rulings replacing spec 1's "?"): over a
//! two-year run, every money and data figure the views give for a company that does not publish
//! (private, or a new listing before its first release after listing, spec 5.20.1) is a band
//! whose endpoints and estimate are never the true value; no true value of such a company
//! appears anywhere in its rows of the views while Omniscient is off; an industry with one or
//! two such companies shows its totals as bands; averaging a company's revenue estimates does
//! not find its revenue; and the 5.9 data book no longer rebuilds a monthly revenue. A company
//! that publishes shows exact figures.
//!
//! Each view is checked on the ticks it is rebuilt (its dirty flag), against the world as it
//! stands after that tick: the state it was built from.

mod common;

use std::collections::{BTreeMap, BTreeSet};

use common::{assert_figure, data};
use sim::Sim;
use sim::economy::supply::{M_MAX, M_MIN, p_pre};
use sim::finance::statements::{Period, Statement, trailing_four};
use sim::market::fair_value::shown_value;
use sim::ops::data::{RETENTION_MONTHS, decay_rate};
use sim::time::{Date, DateTime, Quarter};
use sim::views::estimate::{Figure, StatementLine, shows_estimates};
use sim::views::statements::published;
use sim::views::units::UnitRow;
use sim::world::units::USD_PER_MILLION;
use sim::world::{CompanyId, INDUSTRY_UNPUBLISHED_BELOW, IndustryId, Ordinal, UnitId, World};

/// The numbers in a Debug dump: runs of digits, '.', '-', '+' and 'e'.
fn numbers(s: &str) -> impl Iterator<Item = &str> {
    s.split(|c: char| !(c.is_ascii_digit() || matches!(c, '.' | '-' | '+' | 'e')))
        .filter(|t| t.chars().any(|c| c.is_ascii_digit()))
}

/// Money figures this small are left out of the text scan (scores, counts and shares sit in
/// the same rows); the structural checks still cover them.
const SCAN_MIN_USD: f64 = 1_000.0;
/// The same for data figures, TB.
const SCAN_MIN_TB: f64 = 1.0;

fn debug_set(values: impl IntoIterator<Item = f64>, min: f64) -> BTreeSet<String> {
    values
        .into_iter()
        .filter(|x| x.abs() >= min && x.fract() != 0.0)
        .map(|x| format!("{x:?}"))
        .collect()
}

/// Every true money and data value of company `id` the views could show, as Debug strings (the
/// compute and licences line is exact by D434 and left out).
fn truths(w: &World, id: CompanyId) -> BTreeSet<String> {
    let c = &w.companies[id];
    let s = &w.market.stocks[id];
    let mut out: Vec<f64> = vec![
        c.cash_usd,
        c.finance.line.drawn,
        c.finance.line.limit,
        shown_value(s.fair_value, false),
        shown_value(s.value, false),
        s.consensus_ni,
        s.projection_ni,
        c.revenue_usd,
    ];
    let quarters = c.finance.quarters();
    let n = quarters
        .iter()
        .take_while(|q| published(q, w.clock))
        .count();
    let ttm = trailing_four(&quarters[..n]).unwrap_or_default();
    out.extend([ttm.revenue, ttm.net_income()]);
    for st in quarters.iter().chain(c.finance.years()) {
        out.extend(
            StatementLine::ALL
                .iter()
                .filter(|&&l| l != StatementLine::Shared)
                .map(|l| l.of(st)),
        );
    }
    for &u in &c.units {
        let u = &w.units[u];
        out.extend([
            u.gross_assets,
            u.asset_book,
            u.assets_eff(),
            u.revenue_m,
            u.variable_m,
            u.fixed_m,
            u.rd_m,
            u.dep_m,
            u.ebit_m(),
            u.capex_m,
        ]);
    }
    for r in &w.recaps {
        if let Some(p) = r.companies.iter().find(|p| p.company == id) {
            out.extend([
                p.range.0,
                p.range.1,
                p.expected.projection,
                p.expected.consensus,
            ]);
        }
    }
    let mut set = debug_set(out, SCAN_MIN_USD);
    let mut tb = Vec::new();
    for d in &c.data {
        let p = &w.industries[d.industry].params;
        let b = &d.book;
        tb.extend([
            b.held,
            b.unstructured_tb(),
            b.held + b.unstructured_tb(),
            b.held * decay_rate(b.held, p.data_decay_base),
        ]);
    }
    for st in quarters.iter().chain(c.finance.years()) {
        tb.push(st.key.held_tb);
    }
    set.extend(debug_set(tb, SCAN_MIN_TB));
    set
}

fn assert_no_truth(dump: &str, truths: &BTreeSet<String>, what: &str) {
    for t in numbers(dump) {
        assert!(
            !truths.contains(t),
            "{what}: the true value {t} is in the view"
        );
    }
}

fn line_figures(banded: bool, s: &Statement, f: &[(StatementLine, Figure)]) {
    for (l, fig) in f {
        if *l == StatementLine::Shared {
            assert_eq!(
                fig.exact(),
                Some(l.of(s)),
                "the compute line is exact (D434)"
            );
        } else {
            assert_figure(*fig, l.of(s), banded, l.label());
        }
    }
}

/// The 5.9 data book run backwards (the review's probe): from held and unstructured TB at two
/// month closes, the TB created in the month, so the month's revenue. With no data dropped (fewer
/// than 12 buckets before), `held₁ = m × (1 − rate(m))` with `m = held₀ + converted`, and
/// `created = unstructured₁ − unstructured₀ + converted`.
fn rebuilt_revenue(h0: f64, u0: f64, h1: f64, u1: f64, decay_base: f64, tb_per_musd: f64) -> f64 {
    let f = |m: f64| m * (1.0 - decay_rate(m, decay_base)) - h1;
    let (mut lo, mut hi) = (h1.min(h0).max(0.0) * 0.5, h1 * 2.0 + 10.0);
    for _ in 0..200 {
        let mid = 0.5 * (lo + hi);
        if f(mid) > 0.0 {
            hi = mid;
        } else {
            lo = mid;
        }
    }
    let converted = 0.5 * (lo + hi) - h0;
    (u1 - u0 + converted) / tb_per_musd * USD_PER_MILLION
}

/// How close the probe gets on the true book: a rebuild this close is exact.
const PROBE_EXACT: f64 = 1e-6;

/// A published peer's true unit and data figures, for the scan of its unit and tech rows.
fn unit_truths(w: &World, id: CompanyId) -> BTreeSet<String> {
    let c = &w.companies[id];
    let mut money = Vec::new();
    let mut tb = Vec::new();
    for &u in &c.units {
        let u = &w.units[u];
        money.extend([
            u.gross_assets,
            u.asset_book,
            u.assets_eff(),
            u.revenue_m,
            u.variable_m,
            u.fixed_m,
            u.rd_m,
            u.dep_m,
            u.ebit_m(),
            u.capex_m,
        ]);
    }
    for d in &c.data {
        let p = &w.industries[d.industry].params;
        let b = &d.book;
        tb.extend([
            b.held,
            b.unstructured_tb(),
            b.held + b.unstructured_tb(),
            b.held * decay_rate(b.held, p.data_decay_base),
        ]);
    }
    let mut set = debug_set(money, SCAN_MIN_USD);
    set.extend(debug_set(tb, SCAN_MIN_TB));
    set
}

/// A unit at the last month close: true and shown assets_eff and p_pre (the M probe's inputs).
#[derive(Clone, Copy)]
struct UnitSnap {
    assets_eff: f64,
    p_pre: f64,
    shown_assets_eff: f64,
    shown_p_pre: f64,
}

/// One month close's data book of a banded company: true and shown held and unstructured TB.
#[derive(Clone, Copy)]
struct Book {
    held: f64,
    unstructured: f64,
    buckets: usize,
    shown_held: f64,
    shown_unstructured: f64,
}

#[test]
fn private_figures_are_bands_that_never_show_the_truth() {
    let mut sim = Sim::new(data(), 6).unwrap();
    let end = DateTime::midnight(Date::ymd(2022, 1, 3));
    let mut banded_seen = BTreeSet::new();
    let mut listed_in_play = BTreeSet::new();
    let mut estimated_industries = BTreeSet::new();
    let mut checks = 0u64;
    // Revenue estimates and truths per company, for the averaging check (D429).
    let mut revenue: BTreeMap<CompanyId, (f64, f64)> = BTreeMap::new();
    let mut books: BTreeMap<CompanyId, Book> = BTreeMap::new();
    let (mut probes, mut probe_exact, mut probe_fooled) = (0u32, 0u32, 0u32);
    // The review's M probe (D436): attempts, exact on the true figures, exact on the shown.
    let (mut m_probes, mut m_exact, mut m_shown_exact) = (0u32, 0u32, 0u32);
    let mut snaps: BTreeMap<UnitId, UnitSnap> = BTreeMap::new();
    // Each industry's class at each quarter's close, as the live row showed it (D437).
    let mut class_at_close: BTreeMap<(IndustryId, Quarter), bool> = BTreeMap::new();
    let mut probe_within_1pct = 0u32;
    while sim.now() < end {
        sim.step();
        let w = sim.world();
        let v = sim.views();
        assert!(!sim.controls().omniscient);
        let banded: Vec<bool> = w.companies.ids().map(|id| shows_estimates(w, id)).collect();
        let is_banded = |id: CompanyId| banded[id.index()];
        let classes: Vec<bool> = w
            .industries
            .ids()
            .map(|i| w.industry_estimated_at(i, w.clock))
            .collect();
        // A unit's figures are bands for a company that does not publish, or any company in an
        // estimated industry (D436).
        let unit_b = |id: CompanyId| is_banded(id) || classes[w.companies[id].industry.index()];
        let mut truth_cache: Vec<Option<BTreeSet<String>>> = vec![None; banded.len()];
        let mut truths_of = |id: CompanyId| -> BTreeSet<String> {
            truth_cache[id.index()]
                .get_or_insert_with(|| truths(w, id))
                .clone()
        };
        for (id, s) in w.market.stocks.iter() {
            if s.listed_on.is_some() {
                listed_in_play.insert(id);
            }
        }

        if v.cap_table.is_dirty() {
            for (id, c) in w.companies.iter() {
                let t = v.cap_table.get().get(id).unwrap();
                assert_eq!(t.lines.iter().map(|l| l.shares).sum::<u64>(), c.shares_out);
            }
        }
        if v.company_rows.is_dirty() {
            for r in &v.company_rows.get().rows {
                let b = is_banded(r.id);
                assert_eq!(r.estimated, b);
                let c = &w.companies[r.id];
                let q = c.finance.quarters();
                let n = q.iter().take_while(|s| published(s, w.clock)).count();
                let ttm = trailing_four(&q[..n]).unwrap_or_default();
                assert_figure(r.revenue_ttm, ttm.revenue, b, "revenue TTM");
                assert_figure(r.net_income_ttm, ttm.net_income(), b, "net income TTM");
                let s = &w.market.stocks[r.id];
                if s.exchange.is_none() {
                    assert_figure(r.value, shown_value(s.fair_value, false), b, "value");
                }
                if b {
                    banded_seen.insert(r.id);
                    assert_no_truth(&format!("{r:?}"), &truths_of(r.id), "v_company_row");
                    let e = revenue.entry(r.id).or_default();
                    e.0 += r.revenue_ttm.shown();
                    e.1 += ttm.revenue;
                }
                checks += 1;
            }
        }
        if v.company_detail.is_dirty() {
            for d in &v.company_detail.get().companies {
                let b = is_banded(d.id);
                let c = &w.companies[d.id];
                assert_figure(d.cash_usd, c.cash_usd, b, "cash");
                assert_figure(d.line_drawn_usd, c.finance.line.drawn, b, "line drawn");
                assert_figure(d.line_limit_usd, c.finance.line.limit, b, "line limit");
                let s = &w.market.stocks[d.id];
                if s.exchange.is_none() {
                    assert_figure(
                        d.shown_value_per_share,
                        shown_value(s.value, false),
                        b,
                        "value a share",
                    );
                    // Derived from the total's band (D430): the two agree.
                    let row = v.company_rows.get().rows.iter().find(|r| r.id == d.id);
                    if let (Some(row), true) = (row, v.company_rows.is_dirty()) {
                        let per = row.value.shown() / c.shares_out.max(1) as f64;
                        assert!((d.shown_value_per_share.shown() - per).abs() <= 1e-9 * per.abs());
                    }
                }
                if b {
                    assert_no_truth(&format!("{d:?}"), &truths_of(d.id), "v_company_detail");
                } else if c.cash_usd.abs() >= SCAN_MIN_USD && c.cash_usd.fract() != 0.0 {
                    // The scan is not vacuous: a published cash figure is found in its row.
                    let cash = format!("{:?}", c.cash_usd);
                    assert!(numbers(&format!("{d:?}")).any(|t| t == cash), "{cash}");
                }
            }
        }
        if v.units.is_dirty() {
            for r in &v.units.get().units {
                let b = unit_b(r.company);
                let u = &w.units[r.id];
                let c = &w.companies[r.company];
                assert_figure(r.productivity, u.productivity, b, "productivity");
                assert_figure(r.p_pre, p_pre(u, c), b, "p_pre");
                if b && !is_banded(r.company) {
                    assert_no_truth(&format!("{r:?}"), &unit_truths(w, r.company), "peer unit");
                }
                for (f, t) in [
                    (r.gross_assets, u.gross_assets),
                    (r.asset_book, u.asset_book),
                    (r.assets_eff, u.assets_eff()),
                    (r.revenue_m, u.revenue_m),
                    (r.variable_m, u.variable_m),
                    (r.fixed_m, u.fixed_m),
                    (r.rd_m, u.rd_m),
                    (r.dep_m, u.dep_m),
                    (r.ebit_m, u.ebit_m()),
                    (r.capex_m, u.capex_m),
                ] {
                    assert_figure(f, t, b, "unit figure");
                }
                assert_eq!(r.shared_m.exact(), Some(u.shared_m));
                if is_banded(r.company) {
                    assert_no_truth(&format!("{r:?}"), &truths_of(r.company), "v_units");
                    if w.clock.date().day == 1 && w.clock.hour() == 0 {
                        let e = revenue.entry(r.company).or_default();
                        e.0 += 12.0 * r.revenue_m.shown();
                        e.1 += 12.0 * u.revenue_m;
                    }
                }
            }
        }
        if v.units.is_dirty() && w.clock.date().day == 1 && w.clock.hour() == 0 {
            // The review's probe (D436): in an estimated industry with one company that does not
            // publish and a published peer, M from the peer's revenue over its capacity at the
            // last close, supply = demand / M^2, and the private revenue as
            // (supply - the peers' capacity - the fringe) x M / 12, the fringe given true.
            let rows = &v.units.get().units;
            for (iid, ind) in w.industries.iter() {
                let m = ind.market_factor;
                if !classes[iid.index()] || m <= M_MIN || m >= M_MAX {
                    continue;
                }
                let live = |r: &&UnitRow| {
                    r.industry == iid && w.companies[r.company].finance.bankrupt_on.is_none()
                };
                let private: Vec<&UnitRow> = rows
                    .iter()
                    .filter(live)
                    .filter(|r| is_banded(r.company))
                    .collect();
                let peers: Vec<&UnitRow> = rows
                    .iter()
                    .filter(live)
                    .filter(|r| !is_banded(r.company))
                    .collect();
                let Some(lead) = peers.iter().find(|r| w.units[r.id].revenue_m > 0.0) else {
                    continue;
                };
                if private.len() != 1 || peers.iter().any(|r| !snaps.contains_key(&r.id)) {
                    continue;
                }
                let turnover = ind.params.asset_turnover;
                let fringe = ind.fringe_assets * turnover;
                let truth = w.units[private[0].id].revenue_m;
                let rebuild = |shown: bool| -> f64 {
                    let at = |r: &UnitRow| {
                        let s = snaps[&r.id];
                        if shown {
                            (s.shown_assets_eff, s.shown_p_pre)
                        } else {
                            (s.assets_eff, s.p_pre)
                        }
                    };
                    let rev = if shown {
                        lead.revenue_m.shown()
                    } else {
                        w.units[lead.id].revenue_m
                    };
                    let (ae, pp) = at(lead);
                    let m = rev * 1200.0 / (ae * turnover * pp);
                    let supply = ind.demand / (m * m);
                    let peers_cap: f64 = peers
                        .iter()
                        .map(|r| {
                            let (ae, pp) = at(r);
                            ae * turnover * pp / 100.0
                        })
                        .sum();
                    (supply - peers_cap - fringe) * m / 12.0
                };
                m_probes += 1;
                m_exact += u32::from((rebuild(false) / truth - 1.0).abs() < PROBE_EXACT);
                m_shown_exact += u32::from((rebuild(true) / truth - 1.0).abs() < PROBE_EXACT);
            }
            for r in rows {
                let u = &w.units[r.id];
                snaps.insert(
                    r.id,
                    UnitSnap {
                        assets_eff: u.assets_eff(),
                        p_pre: p_pre(u, &w.companies[r.company]),
                        shown_assets_eff: r.assets_eff.shown(),
                        shown_p_pre: r.p_pre.shown(),
                    },
                );
            }
        }
        if v.tech.is_dirty() {
            for t in &v.tech.get().companies {
                let b = unit_b(t.company);
                let c = &w.companies[t.company];
                for (d, book) in t.data.iter().zip(&c.data) {
                    let p = &w.industries[book.industry].params;
                    let bk = &book.book;
                    assert_figure(d.held_tb, bk.held, b, "held TB");
                    assert_figure(
                        d.unstructured_tb,
                        bk.unstructured_tb(),
                        b,
                        "unstructured TB",
                    );
                    let decay = bk.held * decay_rate(bk.held, p.data_decay_base);
                    assert_figure(d.decay_tb, decay, b, "decay TB");
                }
                if is_banded(t.company) {
                    assert_no_truth(&format!("{t:?}"), &truths_of(t.company), "v_tech");
                } else if b {
                    assert_no_truth(&format!("{t:?}"), &unit_truths(w, t.company), "peer tech");
                }
                // The probe, at each month close, on books that dropped no data.
                if b && w.clock.date().day == 1 && w.clock.hour() == 0 && c.data.len() == 1 {
                    let (d, bk) = (&t.data[0], &c.data[0]);
                    let p = &w.industries[bk.industry].params;
                    let now = Book {
                        held: bk.book.held,
                        unstructured: bk.book.unstructured_tb(),
                        buckets: bk.book.unstructured.len(),
                        shown_held: d.held_tb.shown(),
                        shown_unstructured: d.unstructured_tb.shown(),
                    };
                    let rev = c.units.iter().map(|&u| w.units[u].revenue_m).sum::<f64>();
                    if let Some(before) = books.insert(t.company, now)
                        && before.buckets < RETENTION_MONTHS
                        && rev > 1.0e6
                    {
                        let (base, rate) = (p.data_decay_base, p.data_tb_per_musd);
                        let exact = rebuilt_revenue(
                            before.held,
                            before.unstructured,
                            now.held,
                            now.unstructured,
                            base,
                            rate,
                        );
                        let shown = rebuilt_revenue(
                            before.shown_held,
                            before.shown_unstructured,
                            now.shown_held,
                            now.shown_unstructured,
                            base,
                            rate,
                        );
                        probes += 1;
                        probe_exact += u32::from((exact / rev - 1.0).abs() < PROBE_EXACT);
                        // Fooled: not rebuilt to the precision the probe has on the true book.
                        probe_fooled += u32::from((shown / rev - 1.0).abs() > PROBE_EXACT);
                        probe_within_1pct += u32::from((shown / rev - 1.0).abs() < 0.01);
                    }
                }
            }
        }
        if v.statements.is_dirty() {
            for cs in &v.statements.get().companies {
                let b = is_banded(cs.id);
                assert_eq!(cs.estimated, b);
                let c = &w.companies[cs.id];
                let pubq: Vec<&Statement> = c
                    .finance
                    .quarters()
                    .iter()
                    .filter(|s| published(s, w.clock))
                    .collect();
                let puby: Vec<&Statement> = c
                    .finance
                    .years()
                    .iter()
                    .filter(|s| published(s, w.clock))
                    .collect();
                if b {
                    assert!(cs.quarters().is_empty() && cs.years().is_empty());
                    assert_eq!(cs.estimated_quarters.len(), pubq.len());
                    assert_eq!(cs.estimated_years.len(), puby.len());
                    for (e, s) in cs
                        .estimated_quarters
                        .iter()
                        .zip(&pubq)
                        .chain(cs.estimated_years.iter().zip(&puby))
                    {
                        assert_eq!(e.period, s.period);
                        let f: Vec<(StatementLine, Figure)> =
                            StatementLine::ALL.iter().map(|&l| (l, e.line(l))).collect();
                        line_figures(true, s, &f);
                        assert_figure(e.operating.held_tb, s.key.held_tb, true, "statement TB");
                    }
                    // A year's revenue is its quarters' summed (D430).
                    for y in &cs.estimated_years {
                        let Period::Year(year) = y.period else {
                            unreachable!()
                        };
                        let qs: Vec<_> = cs
                            .estimated_quarters
                            .iter()
                            .filter(|q| matches!(q.period, Period::Quarter(q) if q.year == year))
                            .collect();
                        if qs.len() == 4 {
                            let sum: f64 = qs
                                .iter()
                                .map(|q| q.line(StatementLine::Revenue).shown())
                                .sum();
                            let shown = y.line(StatementLine::Revenue).shown();
                            assert!((shown - sum).abs() <= 1e-9 * sum.abs().max(1.0));
                        }
                    }
                    assert_no_truth(&format!("{cs:?}"), &truths_of(cs.id), "v_statements");
                } else {
                    assert_eq!(cs.quarters().len(), pubq.len());
                    assert!(cs.estimated_quarters.is_empty());
                }
            }
        }
        if v.filings.is_dirty() {
            let f = v.filings.get();
            for fl in &f.filings {
                let b = is_banded(fl.company);
                let c = &w.companies[fl.company];
                let s = c
                    .finance
                    .quarters()
                    .iter()
                    .find(|s| s.period == Period::Quarter(fl.quarter))
                    .unwrap();
                line_figures(
                    b,
                    s,
                    &[
                        (StatementLine::Revenue, fl.revenue),
                        (StatementLine::Ebit, fl.ebit),
                        (StatementLine::Ebitda, fl.ebitda),
                        (StatementLine::NetIncome, fl.net_income),
                        (StatementLine::OperatingCash, fl.operating_cash),
                        (StatementLine::Cash, fl.cash),
                        (StatementLine::BalanceLineDrawn, fl.line_drawn),
                        (StatementLine::Equity, fl.equity),
                    ],
                );
                if b {
                    // The same estimate as the statement's (D429).
                    let st = v.statements.get().get(fl.company).unwrap();
                    if let Some(e) = st.estimated_quarters.iter().find(|e| e.period == s.period) {
                        assert_eq!(e.line(StatementLine::Revenue), fl.revenue);
                    }
                    assert_no_truth(&format!("{fl:?}"), &truths_of(fl.company), "v_filings");
                }
            }
        }
        if v.ratings.is_dirty() {
            for r in &v.ratings.get().companies {
                let b = is_banded(r.id);
                let c = &w.companies[r.id];
                assert_figure(r.line_drawn, c.finance.line.drawn, b, "ratings line drawn");
                assert_figure(r.line_limit, c.finance.line.limit, b, "ratings line limit");
                if b {
                    assert_no_truth(&format!("{r:?}"), &truths_of(r.id), "v_ratings");
                }
            }
        }
        if v.projection.is_dirty() {
            for r in &v.projection.get().companies {
                let b = is_banded(r.id);
                let consensus = w.market.stocks[r.id].consensus_ni;
                assert_figure(r.consensus_ni, consensus, b, "consensus");
                let (lo, hi) = sim::market::projection::range(consensus, r.width);
                assert_figure(r.range.0, lo, b, "range low");
                assert_figure(r.range.1, hi, b, "range high");
                assert!(
                    r.range.0.shown() <= r.range.1.shown(),
                    "the ends keep their order"
                );
                if b {
                    // The ends are derived from the consensus band (D430): the width shown
                    // and the ends shown give back the estimate, not the consensus.
                    let back = 0.5 * (r.range.0.shown() + r.range.1.shown());
                    assert!((back - r.consensus_ni.shown()).abs() <= 1e-6 * back.abs().max(1.0));
                    assert_no_truth(&format!("{r:?}"), &truths_of(r.id), "v_projection");
                }
            }
        }
        if v.recap.is_dirty() && !w.recaps.is_empty() {
            let view = v.recap.get();
            assert_eq!(view.recaps.len(), w.recaps.len());
            for (rq, recap) in view.recaps.iter().zip(&w.recaps) {
                assert_eq!(rq.world.quarter, recap.world.quarter);
                for (p, t) in rq.companies.iter().zip(&recap.companies) {
                    let b = is_banded(p.company);
                    assert_figure(p.range.0, t.range.0, b, "recap range low");
                    assert_figure(p.range.1, t.range.1, b, "recap range high");
                    assert_figure(
                        p.expected.projection,
                        t.expected.projection,
                        b,
                        "recap projection",
                    );
                    assert_figure(
                        p.expected.consensus,
                        t.expected.consensus,
                        b,
                        "recap consensus",
                    );
                    if b {
                        assert_no_truth(&format!("{p:?}"), &truths_of(p.company), "v_recap");
                    }
                }
                for e in rq
                    .world
                    .expected_beats
                    .iter()
                    .chain(&rq.world.expected_misses)
                {
                    if is_banded(e.company) {
                        assert!(e.projection.is_band() && e.consensus.is_band());
                    }
                }
            }
        }
        if v.births.is_dirty() {
            for br in &v.births.get().births {
                let b = is_banded(br.id);
                assert_figure(br.size_usd, w.companies[br.id].revenue_usd, b, "birth size");
                if b {
                    assert_no_truth(&format!("{br:?}"), &truths_of(br.id), "v_births");
                }
            }
        }
        if v.news.is_dirty() {
            // Every headline about a banded company carries no true figure of it.
            for h in v
                .news
                .get()
                .feed
                .iter()
                .filter(|h| h.date == w.clock.date())
            {
                if let Some(c) = h.company
                    && is_banded(c)
                {
                    assert_no_truth(&format!("{h:?}"), &truths_of(c), "v_news");
                }
            }
        }
        if v.industry_rows.is_dirty() {
            let ranked = sim::views::industry_rows::companies_by_revenue(w);
            for row in &v.industry_rows.get().rows {
                let list = &ranked[row.id.index()];
                let n = list
                    .iter()
                    .filter(|(c, _)| is_banded(*c) && !w.companies[*c].finance.status().is_frozen())
                    .count();
                let want = (1..INDUSTRY_UNPUBLISHED_BELOW).contains(&n);
                assert_eq!(row.estimated, want, "{}", row.key);
                let d = w.clock.date();
                if d.day == 1 && w.clock.hour() == 0 && d.is_quarter_first_month() {
                    class_at_close.insert((row.id, d.quarter().prev()), want);
                }
                let ind = &w.industries[row.id];
                let named: f64 = list.iter().map(|(_, r)| r).sum();
                assert_figure(row.named_revenue_m, named, want, "named revenue");
                assert_figure(row.supply, ind.supply, want, "supply");
                assert_figure(row.supply_ratio, ind.supply_ratio, want, "S");
                assert_figure(row.market_factor, ind.market_factor, want, "M");
                assert_figure(row.fringe_revenue_m, ind.fringe_revenue_m, want, "fringe");
                if want {
                    estimated_industries.insert(row.id);
                    let t = debug_set(
                        [
                            named,
                            ind.supply,
                            ind.supply_ratio,
                            ind.market_factor,
                            ind.fringe_revenue_m,
                        ],
                        0.0,
                    );
                    assert_no_truth(&format!("{row:?}"), &t, "v_industry_row");
                }
                // The top 5 rank by the revenue shown, as the detail list does.
                if v.industry_detail.is_dirty() {
                    let detail = v.industry_detail.get().get(row.id).unwrap();
                    let first: Vec<CompanyId> =
                        detail.companies.iter().take(5).map(|c| c.company).collect();
                    assert_eq!(row.top_companies, first);
                    assert!(detail.companies.windows(2).all(|p| {
                        p[0].revenue_m.shown() > p[1].revenue_m.shown()
                            || (p[0].revenue_m.shown() == p[1].revenue_m.shown()
                                && p[0].company < p[1].company)
                    }));
                }
            }
        }
        if v.industry_detail.is_dirty() {
            for ind in &v.industry_detail.get().industries {
                for ic in &ind.companies {
                    let b = unit_b(ic.company);
                    let revenue: f64 = w.companies[ic.company]
                        .units
                        .iter()
                        .map(|&u| w.units[u].revenue_m)
                        .sum();
                    assert_figure(ic.revenue_m, revenue, b, "industry revenue");
                    if is_banded(ic.company) {
                        assert!(ic.share.is_band());
                        assert_no_truth(
                            &format!("{ic:?}"),
                            &truths_of(ic.company),
                            "v_industry_detail",
                        );
                    }
                }
            }
        }
    }
    let w = sim.world();
    // The run covers the 184 starting private companies, the 2020-21 births and listings.
    let private_at_load = 651 - 467;
    assert!(banded_seen.len() > private_at_load, "{}", banded_seen.len());
    assert!(
        !listed_in_play.is_empty(),
        "a listing in play to check its window"
    );
    for id in &listed_in_play {
        assert!(
            banded_seen.contains(id),
            "a new listing is banded until its first release"
        );
    }
    assert!(
        !estimated_industries.is_empty(),
        "an industry with one or two banded companies"
    );

    // History (D437): every recorded quarter's supply is a band exactly when the industry was
    // estimated at that quarter's close, whatever its class now.
    let (mut checked, mut kept_banded) = (0, 0);
    for ind in &sim.views().industry_detail.get().industries {
        for h in &ind.history {
            if let Some(&was) = class_at_close.get(&(ind.id, h.quarter)) {
                assert_eq!(h.supply.is_band(), was, "{:?} {}", ind.id, h.quarter);
                checked += 1;
                kept_banded += usize::from(was && !ind.estimated);
            }
        }
    }
    println!(
        "M probe: {m_probes} industry-months, exact on the truth {m_exact}, exact on the shown \
         {m_shown_exact}; history: {checked} quarters checked, {kept_banded} banded in an \
         industry exact now"
    );
    assert!(checked > 100);
    assert!(
        kept_banded > 0,
        "an industry left the estimated class and kept its banded past"
    );
    assert!(
        m_probes >= 20 && m_exact * 10 >= m_probes * 8,
        "{m_exact} of {m_probes}"
    );
    assert_eq!(
        m_shown_exact, 0,
        "the shown units never give the private revenue"
    );

    // Averaging (D429): every revenue estimate of a company (8 published quarters, the TTMs and
    // the monthly unit revenues of the two years) leans the same way, so the average stays
    // more than 5% from the truth for a large majority of companies.
    let mut quarters_seen = 0usize;
    let st = sim.views().statements.get();
    for (&id, e) in revenue.iter_mut() {
        if let Some(cs) = st.get(id).filter(|c| c.estimated) {
            let c = &w.companies[id];
            for (q, s) in cs.estimated_quarters.iter().zip(c.finance.quarters()) {
                if matches!(
                    q.period,
                    Period::Quarter(Quarter {
                        year: 2020 | 2021,
                        ..
                    })
                ) {
                    e.0 += 4.0 * q.line(StatementLine::Revenue).shown();
                    e.1 += 4.0 * s.lines.revenue;
                    quarters_seen += 1;
                }
            }
        }
    }
    let judged: Vec<f64> = revenue
        .values()
        .filter(|(_, t)| *t > 0.0)
        .map(|(s, t)| s / t - 1.0)
        .collect();
    let off = judged.iter().filter(|r| r.abs() > 0.05).count();
    println!(
        "{checks} company rows; {} banded; {} listed in play; {} estimated industries; \
         averaging: {off} of {} companies more than 5% off ({quarters_seen} quarters); \
         data-book probe: {probes} months, exact on the truth {probe_exact}, fooled {probe_fooled} \
         ({probe_within_1pct} by chance within 1%)",
        banded_seen.len(),
        listed_in_play.len(),
        estimated_industries.len(),
        judged.len()
    );
    assert!(quarters_seen > 0 && judged.len() > private_at_load);
    assert!(off * 10 >= judged.len() * 9, "{off} of {}", judged.len());
    // The probe rebuilds the revenue from the true book (so it is a real probe), and the shown
    // book never gives it.
    assert!(probes > 100);
    assert_eq!(probe_exact, probes, "the probe works on the true book");
    assert_eq!(
        probe_fooled, probes,
        "the shown book never gives the revenue"
    );
    let _ = IndustryId::from_index(0);
}
