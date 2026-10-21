//! M9 A2b: the UI foundation on lane A1's views, tested on the pure builders (no app): a private
//! company's hover card and list row show estimate bands and never the truth (D461, D463), the
//! chart's EFV band comes from the view's bars (D465), and names come from the A1 views (D464).

mod common;

use common::data;
use game::chart::{Ohlc, Series, weekly};
use game::command::index::NameIndex;
use game::links::cards::card;
use game::pages::PageRef;
use game::pages::lists::list_model;
use game::pages::placeholder::placeholder_chart;
use game::table::format::{self, BAND_TEXT};
use game::table::{Cell, TableModel, Unit, sort_order};
use sim::views::price_bars::Resolution;
use sim::{Control, Sim};

/// The row of `page` in a list model (its first cell links to it).
fn row_of(m: &TableModel, page: &PageRef) -> usize {
    (0..m.len())
        .find(|&r| m.cell(r, 0).link() == Some(page))
        .unwrap_or_else(|| panic!("no row for {page:?}"))
}

/// A private company with Omniscient off: its card's revenue, net income and value lines and
/// its Companies row are bands (the estimate color, the band's range), and neither shows the
/// truth, which (debug builds) Omniscient reveals: strictly inside each band, equal to no
/// endpoint, and nowhere in the card's or the row's text. With Omniscient on the same card
/// shows the exact figures, with no branch of its own. The revenue column sorts by midpoint.
#[test]
fn a_private_company_shows_bands_and_never_the_truth() {
    let mut sim = Sim::new(data(), 42).unwrap();
    assert!(!sim.controls().omniscient);
    let v = sim.views().clone();
    let index = NameIndex::build(&v);
    let row = v
        .company_rows
        .get()
        .rows
        .iter()
        .find(|r| r.estimated && !r.public)
        .expect("a private company")
        .clone();
    let page = PageRef::Company(row.id);
    let figures = [
        ("Revenue TTM", row.revenue_ttm),
        ("Net income", row.net_income_ttm),
        ("Value", row.value),
    ];
    let c = card(&page, &v, &index);
    let mut shown = Vec::new();
    for (label, f) in figures {
        let b = f.band().unwrap_or_else(|| panic!("{label} is a band"));
        let line = c
            .lines
            .iter()
            .find(|l| l.label == label)
            .unwrap_or_else(|| panic!("no {label} line in {c:?}"));
        assert_eq!(line.value, format::band(b.low, b.high), "{label}");
        assert_eq!(line.color, Some(BAND_TEXT), "{label}");
        shown.push(line.value.clone());
    }
    assert!(
        c.lines.iter().any(|l| l.label == "Figures"),
        "marked as estimates"
    );
    let model = list_model(&PageRef::Companies, &v, &index).unwrap();
    let r = row_of(&model, &page);
    for (key, f) in [
        ("Revenue TTM", row.revenue_ttm),
        ("Net income", row.net_income_ttm),
        ("Value", row.value),
    ] {
        let col = model.column_by_key(key).unwrap();
        let b = f.band().unwrap();
        assert_eq!(
            model.cell(r, col),
            &Cell::Band {
                low: b.low,
                high: b.high,
                unit: Unit::Money
            },
            "{key}"
        );
    }
    let mut text: Vec<String> = c.lines.iter().map(|l| l.value.clone()).collect();
    text.extend((0..model.columns.len()).map(|col| model.display(r, col).to_owned()));
    let text = text.join(" | ");

    // Sorting by revenue goes by what the cells show (midpoints, exact values), never a truth.
    let col = model.column_by_key("Revenue TTM").unwrap();
    let order = sort_order(&model, col, true);
    let sorted: Vec<f64> = order
        .iter()
        .filter_map(|&i| model.cell(i as usize, col).number())
        .collect();
    assert!(sorted.windows(2).all(|w| w[0] <= w[1]));

    if !cfg!(debug_assertions) {
        return; // Omniscient is debug-only (spec 1): no truth to compare in release.
    }
    sim.apply(Control::SetOmniscient(true)).unwrap();
    let t = sim.views().clone();
    let truth = t
        .company_rows
        .get()
        .rows
        .iter()
        .find(|r| r.id == row.id)
        .unwrap()
        .clone();
    for ((label, f), x) in
        figures
            .iter()
            .zip([truth.revenue_ttm, truth.net_income_ttm, truth.value])
    {
        let x = x.exact().expect("Omniscient figures are exact");
        let b = f.band().unwrap();
        assert!(b.low < x && x < b.high, "{label}: the truth is inside");
        assert!(b.low != x && b.high != x && b.estimate != x, "{label}");
        assert!(
            !text.contains(&format::money(x)),
            "{label}: the truth {} appears in {text}",
            format::money(x)
        );
    }
    let open = card(&page, &t, &NameIndex::build(&t));
    let line = |l: &str| open.lines.iter().find(|x| x.label == l).unwrap().clone();
    assert_eq!(
        line("Revenue TTM").value,
        format::money(truth.revenue_ttm.exact().unwrap())
    );
    assert_eq!(line("Revenue TTM").color, None);
    assert!(!open.lines.iter().any(|l| l.label == "Figures"));
    assert_ne!(shown[0], line("Revenue TTM").value);
}

/// The F3 chart's EFV band comes from the bars (D424, D465): each daily candle spans its bar's
/// `efv_low()` to `efv_high()`, and the chart's weekly bars carry each week's last EFV, as
/// v_price_bars' weekly resolution does. The title no longer waits for lane A1.
#[test]
fn the_chart_band_comes_from_the_bars() {
    let mut sim = Sim::new(data(), 42).unwrap();
    for _ in 0..24 * 15 {
        sim.step();
    }
    let v = sim.views();
    let h = v
        .price_bars
        .get()
        .companies
        .iter()
        .find(|h| h.bars.len() >= 10)
        .expect("a company with bars");
    let bars: Vec<_> = h.bars.iter().copied().collect();
    let m = placeholder_chart(&PageRef::Company(h.id), v).unwrap();
    assert!(!m.title.contains("A1"), "{}", m.title);
    let Series::Candles(c) = &m.series[0] else {
        panic!("candles");
    };
    assert_eq!(c.len(), bars.len());
    for (o, b) in c.iter().zip(&bars) {
        assert!(b.efv > 0.0);
        assert_eq!(o.band, Some((b.efv_low(), b.efv_high())), "{}", b.date);
        assert_eq!((o.open, o.close), (b.open, b.close));
    }
    let daily: Vec<Ohlc> = bars.iter().map(Ohlc::from_bar).collect();
    let ours = weekly(&daily);
    let (first, last) = (bars[0].date, bars[bars.len() - 1].date);
    let theirs = v
        .price_bars
        .get()
        .get_price_history(h.id, Resolution::Weekly, first, last);
    assert!(theirs.len() >= 2);
    assert_eq!(ours.len(), theirs.len());
    for (o, w) in ours.iter().zip(&theirs) {
        assert_eq!(o.date, w.date);
        assert_eq!(o.band, Some((w.efv_low(), w.efv_high())), "{}", w.date);
    }
}

/// Names come from lane A1's views (D464): every country and full character is in the name
/// index under its view name (no "Country #n"), the index finds them by name (and a country
/// by its iso3), and the list pages link each one.
#[test]
fn names_come_from_the_a1_views() {
    let sim = Sim::new(data(), 42).unwrap();
    let v = sim.views();
    let index = NameIndex::build(v);
    for c in &v.countries.get().countries {
        assert_eq!(index.title(&PageRef::Country(c.id)), c.name);
    }
    for c in &v.characters.get().full {
        let sim::views::characters::CharacterRef::Full(id) = c.id else {
            unreachable!()
        };
        assert_eq!(index.title(&PageRef::Character(id)), c.name);
    }
    assert!(!index.entries().iter().any(|e| e.name.contains('#')));
    let canada = v.countries.get().by_iso3("CAN").unwrap();
    let hit = index.search("CAN", 14);
    assert!(
        hit.iter()
            .any(|h| index.entries()[h.entry].page == PageRef::Country(canada.id))
    );
    let model = list_model(&PageRef::Countries, v, &index).unwrap();
    assert_eq!(model.len(), v.countries.get().countries.len());
    assert_eq!(
        model.cell(row_of(&model, &PageRef::Country(canada.id)), 0),
        &Cell::Link(PageRef::Country(canada.id), canada.name.clone())
    );
    let model = list_model(&PageRef::Characters, v, &index).unwrap();
    assert_eq!(model.len(), v.characters.get().full.len());
    // A character's home is a place link to its country.
    let home = model.column_by_key("Home").unwrap();
    let c0 = &v.characters.get().full[0];
    let sim::views::characters::CharacterRef::Full(id0) = c0.id else {
        unreachable!()
    };
    let h = c0.home.as_ref().unwrap();
    assert_eq!(
        model.cell(row_of(&model, &PageRef::Character(id0)), home),
        &Cell::Link(
            PageRef::Country(h.country),
            format!("{}, {}", h.province_name, h.country_name)
        )
    );
}
