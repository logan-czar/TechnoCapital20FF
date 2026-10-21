//! Estimate bands (D420 to D422; Logan's 2026-10-21 ruling replacing spec 1's "?"): over a
//! two-year run, every money figure the views give for a company that does not publish (private,
//! or a new listing before its first release after listing, spec 5.20.1) is a band whose
//! endpoints and estimate are never the true value, and no true value of such a company appears
//! anywhere in its rows of the views while Omniscient is off. A company that publishes shows
//! exact figures.
//!
//! Each view is checked on the ticks it is rebuilt (its dirty flag), against the world as it
//! stands after that tick: the state it was built from.

mod common;

use std::collections::BTreeSet;

use common::{assert_figure, data};
use sim::Sim;
use sim::finance::statements::{Statement, trailing_four};
use sim::market::fair_value::shown_value;
use sim::time::{Date, DateTime};
use sim::views::estimate::{Figure, StatementLine, shows_estimates};
use sim::views::statements::published;
use sim::world::{CompanyId, Ordinal, World};

/// The numbers in a Debug dump: runs of digits, '.', '-', '+' and 'e'.
fn numbers(s: &str) -> impl Iterator<Item = &str> {
    s.split(|c: char| !(c.is_ascii_digit() || matches!(c, '.' | '-' | '+' | 'e')))
        .filter(|t| t.chars().any(|c| c.is_ascii_digit()))
}

/// Money figures this small are left out of the text scan (scores, counts and shares sit in
/// the same rows); the structural checks still cover them.
const SCAN_MIN_USD: f64 = 1_000.0;

/// Every true money value of company `id` the views could show, as Debug strings.
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
    ];
    let quarters = c.finance.quarters();
    let n = quarters
        .iter()
        .take_while(|q| published(q, w.clock))
        .count();
    let ttm = trailing_four(&quarters[..n]).unwrap_or_default();
    out.extend([ttm.revenue, ttm.net_income()]);
    for st in quarters.iter().chain(c.finance.years()) {
        out.extend(StatementLine::ALL.iter().map(|l| l.of(st)));
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
            u.shared_m,
            u.ebit_m(),
            u.capex_m,
        ]);
    }
    if let Some(r) = &w.recap
        && let Some(p) = r.companies.iter().find(|p| p.company == id)
    {
        out.extend([
            p.range.0,
            p.range.1,
            p.expected.projection,
            p.expected.consensus,
        ]);
    }
    out.into_iter()
        .filter(|x| x.abs() >= SCAN_MIN_USD)
        .map(|x| format!("{x:?}"))
        .collect()
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
        assert_figure(*fig, l.of(s), banded, l.label());
    }
}

#[test]
fn private_figures_are_bands_that_never_show_the_truth() {
    let mut sim = Sim::new(data(), 6).unwrap();
    let end = DateTime::midnight(Date::ymd(2022, 1, 1));
    let mut banded_seen = BTreeSet::new();
    let mut listed_in_play = BTreeSet::new();
    let mut checks = 0u64;
    while sim.now() < end {
        sim.step();
        let w = sim.world();
        let v = sim.views();
        assert!(!sim.controls().omniscient);
        let banded: Vec<bool> = w.companies.ids().map(|id| shows_estimates(w, id)).collect();
        let is_banded = |id: CompanyId| banded[id.index()];
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
                }
                if b {
                    assert_no_truth(&format!("{d:?}"), &truths_of(d.id), "v_company_detail");
                } else if c.cash_usd.abs() >= SCAN_MIN_USD {
                    // The scan is not vacuous: a published cash figure is found in its row.
                    let cash = format!("{:?}", c.cash_usd);
                    assert!(numbers(&format!("{d:?}")).any(|t| t == cash), "{cash}");
                }
            }
        }
        if v.units.is_dirty() {
            for r in &v.units.get().units {
                let b = is_banded(r.company);
                let u = &w.units[r.id];
                for (f, t) in [
                    (r.gross_assets, u.gross_assets),
                    (r.asset_book, u.asset_book),
                    (r.assets_eff, u.assets_eff()),
                    (r.revenue_m, u.revenue_m),
                    (r.variable_m, u.variable_m),
                    (r.fixed_m, u.fixed_m),
                    (r.rd_m, u.rd_m),
                    (r.dep_m, u.dep_m),
                    (r.shared_m, u.shared_m),
                    (r.ebit_m, u.ebit_m()),
                    (r.capex_m, u.capex_m),
                ] {
                    assert_figure(f, t, b, "unit figure");
                }
                if b {
                    assert_no_truth(&format!("{r:?}"), &truths_of(r.company), "v_units");
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
                        let f: Vec<(StatementLine, Figure)> = StatementLine::ALL
                            .iter()
                            .map(|&l| (l, Figure::Band(e.line(l))))
                            .collect();
                        line_figures(true, s, &f);
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
                    .find(|s| s.period == sim::finance::statements::Period::Quarter(fl.quarter))
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
                    assert_no_truth(&format!("{r:?}"), &truths_of(r.id), "v_projection");
                }
            }
        }
        if v.recap.is_dirty()
            && let Some(recap) = &w.recap
        {
            let view = v.recap.get();
            for (p, t) in view.companies.iter().zip(&recap.companies) {
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
            let page = view.world.as_ref().unwrap();
            for e in page.expected_beats.iter().chain(&page.expected_misses) {
                if is_banded(e.company) {
                    assert!(e.projection.is_band() && e.consensus.is_band());
                }
            }
        }
        if v.industry_detail.is_dirty() {
            for ind in &v.industry_detail.get().industries {
                for ic in &ind.companies {
                    let b = is_banded(ic.company);
                    let revenue: f64 = w.companies[ic.company]
                        .units
                        .iter()
                        .map(|&u| w.units[u].revenue_m)
                        .sum();
                    assert_figure(ic.revenue_m, revenue, b, "industry revenue");
                    if b {
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
    // The run covers the 184 starting private companies, the 2020-21 births and listings.
    let w = sim.world();
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
        assert!(!shows_estimates(w, *id) || w.market.stocks[*id].exchange.is_some());
    }
    println!(
        "{checks} company rows checked; {} companies banded at some point; {} listed in play",
        banded_seen.len(),
        listed_in_play.len()
    );
}
