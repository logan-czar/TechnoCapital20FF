//! M9.8 leak test (m9-plan 3 Phase C, D574): with Omniscient off, every page of the workspace,
//! every Company tab, the hover name card, the command bar's result rows and Pdoomberg's F3 are
//! drawn for every company that does not publish, and every list, entity, recap, news and
//! function page once, on a fresh 2020 world and again after the first quarter's recap. All
//! their text (every Text in the pane or terminal, every row of every table model, every
//! chart's readout at every slot) is scanned for any true private value: the Omniscient value
//! of a figure the screen shows as a band, formatted every way the UI formats a figure. The
//! test fails if one shows. It also checks every band against its truth: strictly inside,
//! never at an endpoint (D422).
//!
//! The truth comes from an Omniscient twin of the same state (a save loaded into a second
//! `Sim`, Omniscient on, and loaded again so every view is built with it). Omniscient is
//! debug-only in the sim (spec 1), so the release run builds the sim crate with debug
//! assertions while the game crate stays a plain release build (docs/build/m9-checks.md):
//!
//! ```text
//! cargo test --release -p game --test m9_leak --config profile.release.package.sim.debug-assertions=true
//! ```
//!
//! Without that, a release run stops with a message saying so instead of passing unchecked.
//!
//! M8 (D705): the shell runs on a synthetic map of every province (one island per province
//! file), so the map's screens are scanned too: every map mode's legend and readouts (each
//! development track, the Industry track and every industry's assets, the HQ pins with every
//! filter kind, the zones), the HQ pins' sizes (never by a true revenue), the heat values, the
//! province hover card of every province where a banded company has its HQ or a unit, and the
//! zone hover card of every zone.

mod common;

use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::time::Instant;

use bevy::picking::hover::Hovered;
use bevy::prelude::*;
use bevy::time::TimeUpdateStrategy;
use common::{FRAME, data, frames};
use game::bridge::{SimBridgePlugin, Views};
use game::chart::Chart;
use game::chart::data::readout;
use game::command::CommandBar;
use game::command::ResultRow;
use game::command::index::NameIndex;
use game::config::UiConfig;
use game::links::{HOVER_DELAY_SECS, HoverCard, HoverCardPanel, Link};
use game::map::card::{MapCard, MapCardPanel};
use game::map::modes::MapModeInput;
use game::map::picking::MapBitmap;
use game::map::pins::{PinNode, pin_px};
use game::map::{MapInput, MapState, MapView};
use game::pages::{OpenPdoomberg, PageKind, PageRef, PdbFunction};
use game::pdoomberg::PdoombergUi;
use game::table::format::{self, GainUnit};
use game::table::{Table, TableModel};
use game::ui::ShellPlugin;
use game::workspace::{OpenPage, OpenTarget, PaneFrame, Workspace};
use sim::time::Quarter;
use sim::time::quarter::recap_tick;
use sim::views::estimate::StatementLine;
use sim::views::map_layers::{DevTrack, HqFilter, LayerValues, MapMode, PinTarget};
use sim::views::statements::StatementPeriod;
use sim::world::{CompanyId, IndustryId};
use sim::world::{Ordinal, ProvinceId};
use sim::{Control, Sim, SimViews};

/// The bench's world (D459): seed 1.
const SEED: u64 = 1;
const Q1: Quarter = Quarter { year: 2020, q: 1 };
/// Leaks printed before the test fails.
const SHOWN: usize = 40;
/// The synthetic world map's width (D705).
const MAP_WIDTH: u32 = 1024;

/// The folder the synthetic world map is written to (removed when the test ends).
fn map_dir() -> &'static std::path::Path {
    static DIR: std::sync::OnceLock<std::path::PathBuf> = std::sync::OnceLock::new();
    DIR.get_or_init(|| {
        let d = std::env::temp_dir().join(format!("tc20ff-leak-map-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    })
}

/// Removes the synthetic map's folder when dropped (at the test's end, pass or panic).
struct MapDirGuard;

impl Drop for MapDirGuard {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(map_dir());
    }
}

/// The starting data with the synthetic world map (D705).
fn mdata() -> sim_data::WorldData {
    static DATA: std::sync::OnceLock<sim_data::WorldData> = std::sync::OnceLock::new();
    DATA.get_or_init(|| game::test_support::with_world_map(data(), map_dir(), MAP_WIDTH))
        .clone()
}

// ---- Numbers in text and in views ----

/// The number-like tokens of a screen text with their byte spans: an optional sign (only at
/// the start of a word, so the hyphen of a band "$1.20M-$1.80M" is a separator), an optional
/// "$", digits with commas and a point, and a unit suffix (T, B, M, K, %, x, or " bps").
fn spans(s: &str) -> Vec<(usize, usize)> {
    let b = s.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while i < b.len() {
        let word_start = i == 0 || matches!(b[i - 1], b' ' | b'(' | b'[' | b':' | b'/' | b'\t');
        let mut j = i;
        if word_start && matches!(b[j], b'+' | b'-') {
            j += 1;
        }
        if j < b.len() && b[j] == b'$' {
            j += 1;
        }
        let digits = j;
        while j < b.len() && (b[j].is_ascii_digit() || b[j] == b',' || b[j] == b'.') {
            j += 1;
        }
        // Inside a word (F3, Q1, x2): not a figure.
        let in_word = i > 0 && (b[i - 1].is_ascii_alphanumeric() || b[i - 1] == b'_');
        if j > digits && b[digits].is_ascii_digit() && !in_word {
            if j < b.len() && matches!(b[j], b'T' | b'B' | b'M' | b'K' | b'%' | b'x') {
                j += 1;
            }
            let mut end = i + s[i..j].trim_end_matches([',', '.']).len();
            // Basis points carry their unit as a word: "245 bps".
            if end == j && s[j..].starts_with(" bps") {
                end += 4;
                j = end;
            }
            out.push((i, end));
            i = j;
        } else {
            i += 1;
        }
    }
    out
}

/// The number-like tokens of a screen text.
fn tokens(s: &str) -> Vec<&str> {
    spans(s).into_iter().map(|(a, b)| &s[a..b]).collect()
}

/// The tokens that stand as a figure of their own: not the end of an estimate band
/// ("low-high", "low to high", and the guidance's "low to high to low to high"). A band's
/// ends are never a truth: every view band holds its truth strictly inside (checked figure by
/// figure here, D422), and a band the UI derives from one (`Figure::map`, sums) keeps it inside
/// (D430), so an end that renders like some other figure's truth is a coincidence.
fn figure_tokens(s: &str) -> Vec<&str> {
    let sp = spans(s);
    let joined = |k: usize| {
        let gap = |a: usize, b: usize| &s[sp[a].1..sp[b].0];
        let band_gap = |g: &str| g == "-" || g == " to ";
        (k > 0 && band_gap(gap(k - 1, k))) || (k + 1 < sp.len() && band_gap(gap(k, k + 1)))
    };
    (0..sp.len())
        .filter(|&k| !joined(k))
        .map(|k| &s[sp[k].0..sp[k].1])
        .collect()
}

/// Every way the UI writes a figure `x` (format.rs: `Unit::fmt` for each unit and the gains; a
/// chart's two-decimal number; basis points; a figure is never a count, `Cell::figure`),
/// leaving out renderings with no non-zero digit ("$0", "0.0%"): those say nothing.
fn renderings(x: f64) -> Vec<String> {
    let mut out = vec![
        format::money(x),
        format::price(x),
        format::percent(x),
        format::ratio(x),
        format::number(x),
        format::gain(x, GainUnit::Percent),
        format::gain(x, GainUnit::Money),
        format::gain(x, GainUnit::Price),
        // A chart's Number axis and readout (ValueFormat::Number).
        format!("{x:.2}"),
    ];
    // Basis points, "245 bps" (doc::bps; the scan reads the unit with the number).
    if x.abs() < 1.0 {
        out.push(game::pages::doc::bps(x));
    }
    out.retain(|s| s.bytes().any(|c| (b'1'..=b'9').contains(&c)));
    out
}

/// Every float literal in a `Debug` text (one with a point or an exponent; integers, ids and
/// dates are not figures).
fn floats(s: &str) -> Vec<f64> {
    let b = s.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while i < b.len() {
        let starts =
            b[i].is_ascii_digit() || (b[i] == b'-' && i + 1 < b.len() && b[i + 1].is_ascii_digit());
        let in_word = i > 0 && (b[i - 1].is_ascii_alphanumeric() || b[i - 1] == b'_');
        if !starts || in_word {
            i += 1;
            continue;
        }
        let start = i;
        i += 1;
        while i < b.len()
            && (b[i].is_ascii_digit()
                || matches!(b[i], b'.' | b'e' | b'E')
                || (matches!(b[i], b'-' | b'+') && matches!(b[i - 1], b'e' | b'E')))
        {
            i += 1;
        }
        let tok = &s[start..i];
        if (tok.contains('.') || tok.contains('e'))
            && let Ok(x) = tok.parse::<f64>()
            && x.is_finite()
        {
            out.push(x);
        }
    }
    out
}

/// A view figure as its `Debug` shows it.
#[derive(Debug, Clone, Copy)]
enum Fig {
    Exact(f64),
    Band(f64, f64),
}

/// The figures of a `Debug` text, in order.
fn figures(s: &str) -> Vec<Fig> {
    let mut out = Vec::new();
    let mut rest = s;
    loop {
        let e = rest.find("Exact(");
        let b = rest.find("Band(Band {");
        let num = |t: &str| {
            t.trim()
                .trim_end_matches([')', '}', ','])
                .trim()
                .parse::<f64>()
        };
        match (e, b) {
            (Some(e), b) if b.is_none_or(|b| e < b) => {
                let t = &rest[e + 6..];
                let end = t.find(')').unwrap_or(t.len());
                if let Ok(x) = num(&t[..end]) {
                    out.push(Fig::Exact(x));
                }
                rest = &t[end..];
            }
            (_, Some(b)) => {
                let t = &rest[b..];
                let end = t.find('}').unwrap_or(t.len());
                let body = &t[..end];
                let field = |k: &str| {
                    body.find(k).and_then(|i| {
                        let v = &body[i + k.len()..];
                        num(v.split(',').next().unwrap_or(""))
                            .ok()
                            .or_else(|| num(v).ok())
                    })
                };
                if let (Some(l), Some(h)) = (field("low: "), field("high: ")) {
                    out.push(Fig::Band(l, h));
                }
                rest = &t[end..];
            }
            _ => break,
        }
    }
    out
}

// ---- The subjects: companies that do not publish, and estimated industries ----

/// One subject's view entries, each as (label, Debug text), the same labels in both builds.
fn company_entries(v: &SimViews, id: CompanyId) -> Vec<(String, String)> {
    let mut out = Vec::new();
    let mut push = |label: String, d: String| out.push((label, d));
    push(
        "row".into(),
        format!(
            "{:?}",
            v.company_rows.get().rows.iter().find(|r| r.id == id)
        ),
    );
    push(
        "detail".into(),
        format!("{:?}", v.company_detail.get().get(id)),
    );
    for u in v.units.get().units.iter().filter(|u| u.company == id) {
        push(format!("unit {:?}", u.id), format!("{u:?}"));
    }
    push("tech".into(), format!("{:?}", v.tech.get().get(id)));
    push("rating".into(), format!("{:?}", v.ratings.get().get(id)));
    push(
        "filing".into(),
        format!("{:?}", v.filings.get().of_company(id)),
    );
    push(
        "projection".into(),
        format!("{:?}", v.projection.get().get(id)),
    );
    for q in &v.recap.get().recaps {
        let qn = q.world.quarter;
        push(format!("recap {qn:?}"), format!("{:?}", q.company(id)));
        for (i, e) in q
            .world
            .expected_beats
            .iter()
            .chain(&q.world.expected_misses)
            .filter(|e| e.company == id)
            .enumerate()
        {
            push(format!("expected {qn:?} {i}"), format!("{e:?}"));
        }
    }
    let births = v.births.get();
    for b in births.births.iter().filter(|b| b.id == id) {
        push("birth".into(), format!("{b:?}"));
    }
    for l in births.listings.iter().filter(|l| l.id == id) {
        push("listing".into(), format!("{l:?}"));
    }
    for d in &v.industry_detail.get().industries {
        for c in d.companies.iter().filter(|c| c.company == id) {
            push(format!("industry {:?}", d.id), format!("{c:?}"));
        }
    }
    // Last: its shape differs (an archive when Omniscient, estimates when not), so it is
    // paired by period, not by position.
    push(
        "statements".into(),
        format!("{:?}", v.statements.get().get(id)),
    );
    out
}

fn industry_entries(v: &SimViews, id: IndustryId) -> Vec<(String, String)> {
    vec![
        ("row".into(), format!("{:?}", v.industry_rows.get().get(id))),
        (
            "detail".into(),
            format!("{:?}", v.industry_detail.get().get(id)),
        ),
    ]
}

/// Views whose figures are public and may sit on any page: their numbers are not leaks.
fn context(v: &SimViews) -> String {
    format!(
        "{:?}{:?}{:?}{:?}{:?}",
        v.countries.get(),
        v.zones.get(),
        v.rates.get(),
        v.cycle.get(),
        v.clock()
    )
}

/// What the scan looks for and what the band check found.
#[derive(Default)]
struct Truths {
    /// Each subject's true renderings: the Omniscient numbers its non-Omniscient entries do
    /// not hold, minus every rendering of the numbers they (and the public context) do hold.
    /// Each rendering maps to the true value and the entry it came from (for the report).
    hidden: BTreeMap<PageRef, HashMap<String, (f64, String)>>,
    /// Company and industry names, for rows that name a subject without a link.
    names: HashMap<String, PageRef>,
    bands: usize,
    unpaired: Vec<String>,
    bad_bands: Vec<String>,
    /// Money-sized bands (a truth of $1M or more) with an end that renders like its truth (a
    /// band narrow against its figure, as a sum with a large exact part would be): not the
    /// truth, but it would read like it.
    close_ends: Vec<String>,
}

fn bits(xs: &[f64]) -> BTreeSet<u64> {
    xs.iter().map(|x| x.to_bits()).collect()
}

fn add_subject(
    t: &mut Truths,
    page: PageRef,
    shown: &[(String, String)],
    truth: &[(String, String)],
    public: &HashSet<String>,
) {
    let shown_text: String = shown.iter().map(|(_, d)| d.as_str()).collect();
    let shown_bits = bits(&floats(&shown_text));
    let mut legit: HashSet<String> = public.clone();
    for x in floats(&shown_text) {
        legit.extend(renderings(x));
    }
    let mut hidden = HashMap::new();
    for (label, d) in truth {
        for x in floats(d) {
            if x != 0.0 && !shown_bits.contains(&x.to_bits()) {
                for r in renderings(x).into_iter().filter(|r| !legit.contains(r)) {
                    hidden.entry(r).or_insert((x, label.clone()));
                }
            }
        }
    }
    // Every band against its truth, entry by entry, figure by figure.
    for ((label, s), (_, x)) in shown.iter().zip(truth) {
        if label == "statements" {
            continue;
        }
        let (a, b) = (figures(s), figures(x));
        if a.len() != b.len() {
            t.unpaired
                .push(format!("{page:?} {label}: {} vs {}", a.len(), b.len()));
            continue;
        }
        for (i, (f, g)) in a.iter().zip(&b).enumerate() {
            if let (Fig::Band(l, h), Fig::Exact(x)) = (f, g) {
                t.bands += 1;
                if !(*l < *x && *x < *h) {
                    t.bad_bands
                        .push(format!("{page:?} {label} figure {i}: {l} < {x} < {h}"));
                }
                let m = format::money(*x);
                if x.abs() >= 1e6 && (format::money(*l) == m || format::money(*h) == m) {
                    t.close_ends
                        .push(format!("{page:?} {label} figure {i}: {l} < {x} < {h}"));
                }
            }
        }
    }
    if !hidden.is_empty() {
        t.hidden.insert(page, hidden);
    }
}

/// Statements are paired by period: each estimated line against the archive's.
fn check_statements(t: &mut Truths, n: &SimViews, o: &SimViews, id: CompanyId) {
    let (Some(est), Some(_)) = (n.statements.get().get(id), o.statements.get().get(id)) else {
        return;
    };
    for (estimated, period) in [
        (&est.estimated_quarters, StatementPeriod::Quarter),
        (&est.estimated_years, StatementPeriod::Year),
    ] {
        let truth = o.statements.get().statements(id, period, usize::MAX);
        for e in estimated {
            let Some(s) = truth.iter().find(|s| s.period == e.period) else {
                t.unpaired
                    .push(format!("company {id:?} statement {:?}", e.period));
                continue;
            };
            for (j, line) in StatementLine::ALL.iter().enumerate() {
                if let Some(b) = e.lines[j].band() {
                    t.bands += 1;
                    let x = line.of(s);
                    if !(b.low < x && x < b.high) {
                        t.bad_bands.push(format!(
                            "company {id:?} {:?} {line:?}: {} < {x} < {}",
                            e.period, b.low, b.high
                        ));
                    }
                }
            }
        }
    }
}

/// The truths of every banded company and industry of `n`, from its Omniscient twin `o`.
fn truths(n: &SimViews, o: &SimViews) -> Truths {
    let mut t = Truths::default();
    let public: HashSet<String> = floats(&context(n))
        .into_iter()
        .flat_map(renderings)
        .collect();
    for r in &n.company_rows.get().rows {
        t.names.insert(r.name.clone(), PageRef::Company(r.id));
        if !r.estimated {
            continue;
        }
        let (a, b) = (company_entries(n, r.id), company_entries(o, r.id));
        add_subject(&mut t, PageRef::Company(r.id), &a, &b, &public);
        check_statements(&mut t, n, o, r.id);
    }
    for r in &n.industry_rows.get().rows {
        t.names.insert(r.name.clone(), PageRef::Industry(r.id));
        if r.estimated {
            let (a, b) = (industry_entries(n, r.id), industry_entries(o, r.id));
            add_subject(&mut t, PageRef::Industry(r.id), &a, &b, &public);
        }
    }
    t
}

/// The Omniscient twin of `sim`'s state: its save loaded into a second sim, Omniscient on, and
/// loaded again so every view (the recap and projection too) is built with it.
fn omniscient_twin(sim: &Sim) -> SimViews {
    let mut twin = Sim::new(mdata(), SEED).unwrap();
    twin.load_bytes(&sim.save_bytes()).unwrap();
    if twin.apply(Control::SetOmniscient(true)).is_err() {
        panic!(
            "the leak test needs Omniscient for the truth, which the sim allows only with debug \
             assertions; in a release build run it with --config \
             profile.release.package.sim.debug-assertions=true (docs/build/m9-checks.md)"
        );
    }
    let bytes = twin.save_bytes();
    twin.load_bytes(&bytes).unwrap();
    assert!(twin.controls().omniscient);
    twin.views().clone()
}

// ---- Scanning the screens ----

/// What one screen shows: its loose texts, its table rows and its chart readouts.
#[derive(Default)]
struct Screen {
    texts: Vec<String>,
    /// Table rows: the cells' texts and the pages the row links to.
    rows: Vec<(Vec<String>, Vec<PageRef>)>,
    /// Pages linked from loose text.
    links: Vec<PageRef>,
}

fn table_rows(
    m: &TableModel,
    names: &HashMap<String, PageRef>,
) -> Vec<(Vec<String>, Vec<PageRef>)> {
    (0..m.len())
        .map(|r| {
            let cells: Vec<String> = (0..m.columns.len())
                .map(|c| m.display(r, c).to_owned())
                .collect();
            let mut links: Vec<PageRef> = (0..m.columns.len())
                .filter_map(|c| m.cell(r, c).link().cloned())
                .collect();
            links.extend(cells.iter().filter_map(|s| names.get(s).cloned()));
            (cells, links)
        })
        .collect()
}

/// Everything under `root`: a table is read from its model (every row, not only the pooled
/// ones), a chart from its readout at every slot.
fn scan(app: &App, root: Entity, names: &HashMap<String, PageRef>, out: &mut Screen) {
    let mut stack = vec![root];
    while let Some(e) = stack.pop() {
        let w = app.world();
        if let Some(t) = w.get::<Table>(e) {
            out.rows.extend(table_rows(t.model(), names));
            for c in &t.model().columns {
                out.texts.push(c.title.clone());
            }
            continue;
        }
        if let Some(c) = w.get::<Chart>(e) {
            let m = c.model();
            for i in 0..m.slots() {
                out.texts.push(readout(m, i));
            }
        }
        if let Some(t) = w.get::<Text>(e) {
            out.texts.push(t.0.clone());
        }
        if let Some(l) = w.get::<Link>(e) {
            out.links.push(l.0.clone());
        }
        if let Some(c) = w.get::<Children>(e) {
            stack.extend(c.iter());
        }
    }
}

/// One leak: where, whose truth, the rendering and the text it is in.
type Leak = String;

/// Checks a screen: its loose texts and charts against the truths of the subject it is about
/// (or, on a page about no banded subject, a list or a function page, of every subject it
/// links to); each table row against the truths of `about` and of the subjects the row links
/// to or names.
fn check(t: &Truths, what: &str, about: &[PageRef], s: &Screen, leaks: &mut Vec<Leak>) {
    let mut find = |subjects: &mut dyn Iterator<Item = &PageRef>, texts: &[String]| {
        let subjects: BTreeSet<&PageRef> = subjects.collect();
        for p in subjects {
            let Some(h) = t.hidden.get(p) else {
                continue;
            };
            for text in texts {
                for tok in figure_tokens(text) {
                    if let Some((x, entry)) = h.get(tok) {
                        leaks.push(format!(
                            "{what}: {p:?}'s true {tok} ({x}, {entry}) in {text:?}"
                        ));
                    }
                }
            }
        }
    };
    if about.iter().any(|p| t.hidden.contains_key(p)) {
        find(&mut about.iter(), &s.texts);
    } else {
        find(&mut s.links.iter(), &s.texts);
    }
    // A row is about the first subject it links to or names (a company's row links its
    // industry and country too, whose figures are not in it).
    for (cells, links) in &s.rows {
        find(&mut about.iter().chain(links.first()), cells);
    }
}

/// The game's state for the scan: the shell over `sim`, every banded company on the
/// watchlist (so F2 and the recap list them).
fn shell_app(sim: Sim) -> App {
    let mut app = App::new();
    app.add_plugins((MinimalPlugins, bevy::input::InputPlugin))
        .insert_resource(TimeUpdateStrategy::ManualDuration(FRAME))
        .add_plugins(SimBridgePlugin::new(sim))
        .add_plugins(ShellPlugin);
    app.update();
    game::test_support::install_map_bitmap(app.world_mut(), map_dir());
    frames(&mut app, 2);
    app
}

fn focused_frame(app: &mut App) -> PaneFrame {
    let pane = app.world().resource::<Workspace>().focused();
    app.world_mut()
        .query::<&PaneFrame>()
        .iter(app.world())
        .find(|f| f.pane == pane)
        .unwrap()
        .clone()
}

/// Opens `page` in the focused pane and reads it (header and body).
fn read_page(app: &mut App, page: &PageRef, names: &HashMap<String, PageRef>) -> Screen {
    app.world_mut().write_message(OpenPage {
        page: page.clone(),
        target: OpenTarget::Focused,
    });
    frames(app, 3);
    let f = focused_frame(app);
    assert_eq!(f.drawn_page(), Some(page), "the pane drew {page:?}");
    let mut s = Screen::default();
    scan(app, f.header, names, &mut s);
    scan(app, f.body, names, &mut s);
    s
}

fn read_pdoomberg(
    app: &mut App,
    function: PdbFunction,
    company: Option<CompanyId>,
    names: &HashMap<String, PageRef>,
) -> Screen {
    app.world_mut()
        .write_message(OpenPdoomberg { function, company });
    frames(app, 3);
    let ui = app.world().resource::<PdoombergUi>();
    let (root, built) = (ui.root, ui.built);
    assert!(
        built.is_some_and(|r| r.function == function),
        "Pdoomberg built {function:?}"
    );
    let mut s = Screen::default();
    scan(app, root, names, &mut s);
    s
}

/// The hover name card of `page`, drawn by hovering a link to it.
fn read_card(app: &mut App, page: &PageRef, names: &HashMap<String, PageRef>) -> Screen {
    let probe = app
        .world_mut()
        .spawn(game::links::link("probe", page.clone()))
        .id();
    app.world_mut().entity_mut(probe).insert(Hovered(true));
    // Coarse frames: the card waits HOVER_DELAY_SECS of time (the game is paused).
    let step = std::time::Duration::from_secs_f32(HOVER_DELAY_SECS / 2.0);
    app.insert_resource(TimeUpdateStrategy::ManualDuration(step));
    frames(app, 4);
    app.insert_resource(TimeUpdateStrategy::ManualDuration(FRAME));
    assert_eq!(
        app.world().resource::<HoverCard>().shown.as_ref(),
        Some(page),
        "the card of {page:?} shows"
    );
    let panel = app
        .world_mut()
        .query_filtered::<Entity, With<HoverCardPanel>>()
        .single(app.world())
        .unwrap();
    let mut s = Screen::default();
    scan(app, panel, names, &mut s);
    app.world_mut().entity_mut(probe).despawn();
    frames(app, 1);
    s
}

/// The command bar's result rows for `query`.
fn read_command(app: &mut App, query: &str, names: &HashMap<String, PageRef>) -> Screen {
    {
        let mut bar = app.world_mut().resource_mut::<CommandBar>();
        bar.open();
        bar.type_text(query);
    }
    frames(app, 2);
    let rows: Vec<Entity> = app
        .world_mut()
        .query_filtered::<Entity, With<ResultRow>>()
        .iter(app.world())
        .collect();
    assert!(!rows.is_empty(), "the bar found {query:?}");
    let mut s = Screen::default();
    for r in rows {
        scan(app, r, names, &mut s);
    }
    app.world_mut().resource_mut::<CommandBar>().close();
    frames(app, 1);
    s
}

/// The scan finds a truth that is on screen: one of `page`'s true renderings, written into its
/// open page as a text, is reported (the plumbing works end to end).
fn canary(app: &mut App, t: &Truths, page: &PageRef) {
    let Some(truth) = t
        .hidden
        .get(page)
        .and_then(|h| h.keys().find(|k| k.starts_with('$')))
    else {
        panic!("{page:?} has true renderings");
    };
    let body = focused_frame(app).body;
    let e = app
        .world_mut()
        .spawn(Text::new(format!("Revenue {truth}")))
        .id();
    app.world_mut().entity_mut(body).add_child(e);
    let mut s = Screen::default();
    scan(app, body, &t.names, &mut s);
    let mut found = Vec::new();
    check(t, "canary", std::slice::from_ref(page), &s, &mut found);
    assert!(
        found.iter().any(|l| l.contains(truth.as_str())),
        "the canary {truth} was not found: {found:?}"
    );
    app.world_mut().entity_mut(e).despawn();
    // A table row whose first link is the subject, on a screen about no subject (as a list
    // page): found through the row's attribution.
    let model = TableModel::new(
        vec![
            game::table::Column::text("Name", 100.0),
            game::table::Column::number("Revenue", 100.0),
        ],
        vec![vec![
            game::table::Cell::Link(page.clone(), "canary".into()),
            game::table::Cell::Text(truth.clone()),
        ]],
    );
    let table = {
        let mut commands = app.world_mut().commands();
        game::table::spawn_table_with_id(&mut commands, body, std::sync::Arc::new(model), "canary")
    };
    app.world_mut().flush();
    let mut s = Screen::default();
    scan(app, body, &t.names, &mut s);
    let mut found = Vec::new();
    check(t, "canary row", &[], &s, &mut found);
    assert!(
        found.iter().any(|l| l.contains(truth.as_str())),
        "the canary row {truth} was not found: {found:?}"
    );
    app.world_mut().entity_mut(table).despawn();
}

// ---- The map's screens (M8, D705) ----

/// Every mode the scan shows: each development track, the Industry track and every industry's
/// assets, the HQ pins unfiltered, listed, private and by each industry, and the zones.
fn scan_modes(v: &SimViews) -> Vec<MapMode> {
    let n = v.industry_rows.get().rows.len();
    let mut out = vec![MapMode::Political];
    out.extend(DevTrack::ALL.iter().map(|&t| MapMode::Development(t)));
    out.push(MapMode::Industry(None));
    for i in 0..n {
        out.push(MapMode::Industry(Some(sim::world::IndustryId::from_index(
            i,
        ))));
    }
    for listed in [None, Some(true), Some(false)] {
        out.push(MapMode::CompanyHqs(HqFilter {
            listed,
            ..HqFilter::default()
        }));
    }
    for i in 0..n {
        out.push(MapMode::CompanyHqs(HqFilter {
            industry: Some(sim::world::IndustryId::from_index(i)),
            ..HqFilter::default()
        }));
    }
    out.push(MapMode::FinancialZones);
    out
}

fn set_mode(app: &mut App, m: MapMode) {
    app.world_mut().write_message(MapModeInput::Set(m));
    frames(app, 2);
    assert_eq!(
        app.world()
            .resource::<game::map::modes::CurrentLayer>()
            .layer
            .mode,
        m
    );
}

/// Everything on the map node: the bar, the legend, the labels and the pins (their links).
fn read_map(app: &mut App, names: &HashMap<String, PageRef>) -> Screen {
    let view = app
        .world_mut()
        .query_filtered::<Entity, With<MapView>>()
        .single(app.world())
        .unwrap();
    let mut s = Screen::default();
    scan(app, view, names, &mut s);
    s
}

/// An industry heat map colours a province by its units' assets as shown: where a banded
/// company has a unit of the industry, the value is never the true sum (the Omniscient twin's
/// layer). The values are colours, not text; the legend's printed stops are scanned with the
/// map's texts. Returns how many banded provinces it checked.
fn check_heat(
    app: &App,
    i: sim::world::IndustryId,
    n: &SimViews,
    o: &SimViews,
    what: &str,
    leaks: &mut Vec<Leak>,
) -> usize {
    let layer = &app
        .world()
        .resource::<game::map::modes::CurrentLayer>()
        .layer;
    let truth = o.get_map_layer(MapMode::Industry(Some(i)));
    let (LayerValues::Scalars(shown), LayerValues::Scalars(truth)) = (&layer.values, &truth.values)
    else {
        panic!("a heat map")
    };
    let mut banded: BTreeSet<usize> = BTreeSet::new();
    for u in &n.units.get().units {
        if u.industry == i && u.gross_assets.is_band() {
            banded.insert(u.base_province.index());
        }
    }
    for &p in &banded {
        if shown[p] == truth[p] && truth[p] != 0.0 {
            leaks.push(format!(
                "{what}: province {p} is coloured by its true assets {}",
                truth[p]
            ));
        }
    }
    // The legend's scale is the shown values' (its top their largest), never the truth's.
    let top = shown.iter().copied().fold(0.0f32, f32::max);
    let scale = layer.scale.as_ref().unwrap();
    assert_eq!(scale.high as f32, top, "{what}: the scale's top");
    let true_top = truth.iter().copied().fold(0.0f32, f32::max);
    let at_top = shown.iter().position(|&x| x == top);
    if at_top.is_some_and(|p| banded.contains(&p)) && scale.high as f32 == true_top {
        leaks.push(format!("{what}: the legend's top is the true {true_top}"));
    }
    banded.len()
}

/// Every HQ pin is sized by the revenue the views show: the layer's size is the plain row's
/// shown revenue, never the Omniscient truth of a banded company, and the pin's diameter
/// follows it. Returns how many banded pins it checked.
fn check_pins(app: &App, n: &SimViews, o: &SimViews, what: &str, leaks: &mut Vec<Leak>) -> usize {
    let layer = &app
        .world()
        .resource::<game::map::modes::CurrentLayer>()
        .layer;
    let rows = &n.company_rows.get().rows;
    let truth = &o.company_rows.get().rows;
    let mut checked = 0;
    for p in &layer.pins {
        let PinTarget::Company(c) = p.target else {
            continue;
        };
        let r = rows.iter().find(|r| r.id == c).unwrap();
        assert_eq!(p.size, r.revenue_ttm.shown(), "{what}: {}'s pin", r.name);
        if r.estimated {
            let t = truth.iter().find(|r| r.id == c).unwrap().revenue_ttm;
            let t = t.exact().expect("the twin's revenue is exact");
            // Between the smallest and largest pin the diameter grows strictly with the revenue,
            // so a diameter equal to the truth's would be sized by it.
            let d = pin_px(t);
            let clamped = d <= game::map::pins::PIN_MIN_PX || d >= game::map::pins::PIN_MAX_PX;
            if p.size == t || (pin_px(p.size) == d && !clamped) {
                leaks.push(format!(
                    "{what}: {}'s pin is sized by its true revenue {t}",
                    r.name
                ));
            }
            checked += 1;
        }
    }
    let mut world = app.world().try_query::<&PinNode>().unwrap();
    for pin in world.iter(app.world()) {
        if !matches!(pin.target, PinTarget::Company(_)) {
            continue;
        }
        if let Some(p) = layer.pins.iter().find(|p| p.target == pin.target) {
            assert_eq!(pin.diameter, pin_px(p.size), "{what}: the pin's diameter");
        }
    }
    checked
}

/// Hovers province `p` on the map (zoomed in on its label point) and reads the hover card.
fn read_map_card(app: &mut App, p: ProvinceId, names: &HashMap<String, PageRef>) -> Screen {
    let shape = *app
        .world()
        .resource::<Views>()
        .map_static
        .get()
        .shape(p)
        .unwrap_or_else(|| panic!("province {} is on the map", p.0));
    let size = app.world().resource::<MapBitmap>().size();
    let m = Vec2::new(shape.label.0 as f32, shape.label.1 as f32);
    let at = {
        let mut state = app.world_mut().resource_mut::<MapState>();
        let view = state.view;
        let cam = state.camera.as_mut().unwrap();
        cam.zoom(size, view, 30.0, view / 2.0);
        cam.scale = cam.target;
        cam.center = m;
        cam.pan(size, view, Vec2::ZERO);
        cam.to_view(size, view, m)
    };
    app.world_mut().write_message(MapInput::Hover(Some(at)));
    frames(app, 2);
    assert_eq!(
        app.world().resource::<MapState>().hover,
        Some(p),
        "hovering {}",
        p.0
    );
    assert!(app.world().resource::<MapCard>().card.is_some());
    let panel = app
        .world_mut()
        .query_filtered::<Entity, With<MapCardPanel>>()
        .single(app.world())
        .unwrap();
    let mut s = Screen::default();
    scan(app, panel, names, &mut s);
    s
}

/// The map card canary: a true value written into the hover card is found by the scan.
fn map_canary(app: &mut App, t: &Truths, page: &PageRef) {
    let Some(truth) = t
        .hidden
        .get(page)
        .and_then(|h| h.keys().find(|k| k.starts_with('$')))
        .cloned()
    else {
        panic!("{page:?} has true renderings");
    };
    let panel = app
        .world_mut()
        .query_filtered::<Entity, With<MapCardPanel>>()
        .single(app.world())
        .unwrap();
    let e = app
        .world_mut()
        .spawn(Text::new(format!("Unit assets {truth}")))
        .id();
    app.world_mut().entity_mut(panel).add_child(e);
    let mut s = Screen::default();
    scan(app, panel, &t.names, &mut s);
    let mut found = Vec::new();
    check(t, "map canary", std::slice::from_ref(page), &s, &mut found);
    assert!(
        found.iter().any(|l| l.contains(truth.as_str())),
        "the map canary {truth} was not found: {found:?}"
    );
    app.world_mut().entity_mut(e).despawn();
}

/// The companies whose figures are bands in `v`.
fn banded(v: &SimViews) -> Vec<CompanyId> {
    v.company_rows
        .get()
        .rows
        .iter()
        .filter(|r| r.estimated)
        .map(|r| r.id)
        .collect()
}

/// Scans every screen of one game state, `sim` with its views `v` (the views the truths were
/// read against); returns how many screens it read.
fn scan_state(
    sim: Sim,
    v: &SimViews,
    o: &SimViews,
    label: &str,
    t: &Truths,
    leaks: &mut Vec<Leak>,
) -> usize {
    let private = banded(v);
    assert!(private.len() > 100, "{} banded companies", private.len());
    let mut app = shell_app(sim);
    // The shell shows exactly the views the truths were checked against.
    assert!(
        app.world().resource::<Views>().same_data(v),
        "{label}: the shell's views drifted from the scanned ones"
    );
    let names = &t.names;
    let index = app.world().resource::<NameIndex>().clone();
    let mut screens = 0;
    let mut pin_checks = 0;
    let mut map_canaried = false;
    let mut heat_checks = 0;
    let mut read = |what: String, about: &[PageRef], s: Screen, leaks: &mut Vec<Leak>| {
        check(t, &format!("{label} {what}"), about, &s, leaks);
        screens += 1;
    };
    let sections = game::pages::company::SECTIONS;
    let mut linked: BTreeSet<PageRef> = BTreeSet::new();
    for &c in &private {
        let page = PageRef::Company(c);
        let about = [page.clone()];
        // Every section, then each tab alone (the others folded, as the tab strip does).
        for tab in std::iter::once(None).chain(sections.iter().map(|s| Some(s.0))) {
            {
                let mut cfg = app.world_mut().resource_mut::<UiConfig>();
                game::pages::doc::select_tab(&mut cfg, PageKind::Company, sections, tab);
            }
            let s = read_page(&mut app, &page, names);
            if c == private[0] && tab.is_none() {
                canary(&mut app, t, &page);
            }
            if tab.is_none() {
                linked.extend(s.links.iter().cloned());
                for (_, l) in &s.rows {
                    linked.extend(l.iter().cloned());
                }
            }
            read(format!("{} tab {tab:?}", page.key()), &about, s, leaks);
        }
        let s = read_card(&mut app, &page, names);
        read(format!("card {}", page.key()), &about, s, leaks);
        let s = read_command(&mut app, &index.title(&page), names);
        read(format!("command {}", page.key()), &about, s, leaks);
        let s = read_pdoomberg(&mut app, PdbFunction::F3, Some(c), names);
        read(format!("F3 {}", page.key()), &about, s, leaks);
    }
    {
        let mut cfg = app.world_mut().resource_mut::<UiConfig>();
        game::pages::doc::select_tab(&mut cfg, PageKind::Company, sections, None);
    }
    // Every other page: the lists, every industry, the entities the companies' pages link to
    // (controllers, HQ countries, zones, exchanges), every event, recap and headline.
    let mut pages: BTreeSet<PageRef> = [
        PageRef::World,
        PageRef::Companies,
        PageRef::Industries,
        PageRef::News,
        PageRef::Characters,
        PageRef::Countries,
        PageRef::Exchanges,
        PageRef::Zones,
        PageRef::Events,
        PageRef::Settings,
        PageRef::Recap(v.clock().date.quarter()),
    ]
    .into_iter()
    .collect();
    for e in index.entries() {
        if matches!(
            e.page,
            PageRef::Industry(_)
                | PageRef::Zone(_)
                | PageRef::Exchange(_)
                | PageRef::Event(_)
                | PageRef::Recap(_)
        ) {
            pages.insert(e.page.clone());
        }
    }
    for q in &v.recap.get().recaps {
        pages.insert(PageRef::Recap(q.world.quarter));
    }
    pages.extend(linked.into_iter().filter(|p| {
        matches!(
            p,
            PageRef::Character(_) | PageRef::Country(_) | PageRef::Industry(_)
        )
    }));
    for h in v.news.get().feed.iter().take(20) {
        pages.insert(PageRef::Headline(h.id));
    }
    // M8: the Province page of every province where a banded company has its HQ or a unit
    // (lane MB's page will show the units' assets there; D631, D637).
    for c in v.company_detail.get().companies.iter() {
        if private.contains(&c.id) {
            pages.insert(PageRef::Province(c.hq_province));
        }
    }
    for u in &v.units.get().units {
        if private.contains(&u.company) {
            pages.insert(PageRef::Province(u.base_province));
        }
    }
    for page in &pages {
        let s = read_page(&mut app, page, names);
        read(page.key(), std::slice::from_ref(page), s, leaks);
    }
    // M8 (D705): every map mode's legend, pins and readouts, with the subjects each shows.
    for m in scan_modes(v) {
        set_mode(&mut app, m);
        // The HQ mode is about every banded company it pins. An industry heat map's printed
        // stops are its own scale, a function of the shown values only (checked raw by
        // `check_heat`), so its legend is scanned as a screen about no subject.
        let about: Vec<PageRef> = match m {
            MapMode::CompanyHqs(_) => private.iter().map(|&c| PageRef::Company(c)).collect(),
            _ => Vec::new(),
        };
        let s = read_map(&mut app, names);
        read(format!("map mode {m:?}"), &about, s, leaks);
        if let MapMode::Industry(Some(i)) = m {
            heat_checks += check_heat(&app, i, v, o, &format!("{label} {m:?}"), leaks);
        }
        pin_checks += check_pins(&app, v, o, &format!("{label} {m:?}"), leaks);
    }
    assert!(pin_checks > 100, "{pin_checks} banded pins checked");
    assert!(heat_checks > 50, "{heat_checks} banded heat values checked");
    // The province hover card of every province where a banded company has its HQ or a unit.
    set_mode(&mut app, MapMode::Political);
    let provinces: BTreeSet<ProvinceId> = pages
        .iter()
        .filter_map(|p| match p {
            PageRef::Province(id) => Some(*id),
            _ => None,
        })
        .collect();
    for &p in &provinces {
        let about: Vec<PageRef> = v
            .province_cards
            .get()
            .get(p)
            .map(|c| {
                c.hqs
                    .iter()
                    .copied()
                    .chain(
                        c.units
                            .iter()
                            .filter_map(|&u| v.units.get().get(u).map(|u| u.company)),
                    )
                    .filter(|c| private.contains(c))
                    .map(PageRef::Company)
                    .collect()
            })
            .unwrap_or_default();
        let s = read_map_card(&mut app, p, names);
        if let Some(c) = about.first().filter(|_| !map_canaried) {
            map_canary(&mut app, t, c);
            map_canaried = true;
        }
        read(format!("map card province/{}", p.0), &about, s, leaks);
    }
    assert!(map_canaried, "the map card canary ran");
    // The zone hover card of every zone, at its hub.
    set_mode(&mut app, MapMode::FinancialZones);
    for x in &v.exchanges.get().exchanges {
        let s = read_map_card(&mut app, x.hub_province, names);
        read(format!("map zone card {}", x.code), &[], s, leaks);
    }
    set_mode(&mut app, MapMode::Political);
    println!(
        "{label}: map: {} modes, {pin_checks} banded HQ pins, {heat_checks} banded heat values, {} province cards, {} zone cards",
        scan_modes(v).len(),
        provinces.len(),
        v.exchanges.get().exchanges.len()
    );
    for f in PdbFunction::ALL {
        let s = read_pdoomberg(&mut app, f, None, names);
        read(format!("pdoomberg {}", f.code()), &[], s, leaks);
    }
    screens
}

/// Runs the scan on one state: its truths from the twin, the band check, then every screen.
///
/// A load rebuilds every view at the current tick, while a running game keeps each slower
/// view as of its last rebuild, so the screens and the truth must come from the same kind of
/// build: the state is saved and loaded into a plain (non-Omniscient) sim, which drives the
/// shell, and the Omniscient twin is loaded from that same save.
fn leaks_of(sim: Sim, label: &str) -> (Truths, Vec<Leak>, usize) {
    let mut plain = Sim::new(mdata(), SEED).unwrap();
    plain.load_bytes(&sim.save_bytes()).unwrap();
    // Every banded company on the watchlist, so F2 and the recap list them (a control: it
    // moves no figure).
    for c in banded(plain.views()) {
        plain.apply(Control::WatchlistAdd(c)).unwrap();
    }
    assert!(!plain.controls().omniscient);
    let n = plain.views().clone();
    let o = omniscient_twin(&plain);
    // The twin is the same state: a plain load of the same save shows the same views.
    let mut check_twin = Sim::new(mdata(), SEED).unwrap();
    check_twin.load_bytes(&plain.save_bytes()).unwrap();
    assert!(
        check_twin.views().same_data(&n),
        "{label}: a reload of the save shows other views than the scanned ones"
    );
    let t = truths(&n, &o);
    let mut leaks = Vec::new();
    let screens = scan_state(plain, &n, &o, label, &t, &mut leaks);
    (t, leaks, screens)
}

#[test]
fn no_true_private_value_on_any_screen() {
    // The synthetic map's folder goes when the test ends, pass or panic.
    let _map = MapDirGuard;
    let start = Instant::now();
    let fresh = Sim::new(data(), SEED).unwrap();
    let mut later = Sim::new(data(), SEED).unwrap();
    while later.views().clock().now <= recap_tick(Q1) {
        later.step();
    }
    let mut report = Vec::new();
    let mut all = Vec::new();
    for (sim, label) in [(fresh, "fresh"), (later, "after the Q1 recap")] {
        let (t, leaks, screens) = leaks_of(sim, label);
        let subjects = t.hidden.len();
        let renderings: usize = t.hidden.values().map(HashMap::len).sum();
        report.push(format!(
            "{label}: {screens} screens, {subjects} subjects, {renderings} true renderings, {} \
             bands checked (none at or past its truth, no money end reading as it), {} \
             entries unpaired",
            t.bands,
            t.unpaired.len(),
        ));
        assert!(
            t.bad_bands.is_empty(),
            "{label}: bands at or past their truth:\n{}",
            t.bad_bands.join("\n")
        );
        assert!(
            t.close_ends.is_empty(),
            "{label}: band ends that read as the truth:\n{}",
            t.close_ends.join("\n")
        );
        assert!(t.bands > 1000, "{label}: {} bands", t.bands);
        assert!(subjects > 100, "{label}: {subjects} subjects");
        all.extend(leaks);
    }
    println!(
        "M9.8 leak scan ({} build, {:.1} s):\n{}",
        if cfg!(debug_assertions) {
            "debug"
        } else {
            "release"
        },
        start.elapsed().as_secs_f64(),
        report.join("\n")
    );
    assert!(
        all.is_empty(),
        "{} true private values on screen; the first {SHOWN}:\n{}",
        all.len(),
        all.iter()
            .take(SHOWN)
            .cloned()
            .collect::<Vec<_>>()
            .join("\n")
    );
}

/// The scanners themselves: tokens split bands and keep signs at word starts only; every
/// rendering of a figure is found in its own formatted text.
#[test]
fn scanner_reads_every_format() {
    assert_eq!(
        tokens("$12.0M-$18.0M"),
        ["$12.0M", "$18.0M"],
        "a band's hyphen is no minus"
    );
    assert_eq!(tokens("-$5.00M to $3.00M"), ["-$5.00M", "$3.00M"]);
    assert_eq!(
        tokens("F3 Q1 x2 1.23x +1.2% (12.3%)"),
        ["1.23x", "+1.2%", "12.3%"]
    );
    assert_eq!(tokens("1,234.5 and $1,234.50."), ["1,234.5", "$1,234.50"]);
    assert_eq!(tokens("spread 245 bps, 3 seats"), ["245 bps", "3"]);
    assert_eq!(
        figure_tokens("$1.00M, $12.0M-$18.0M, -$5.00M to $3.00M, 4.5x"),
        ["$1.00M", "4.5x"],
        "band ends are not figures of their own"
    );
    assert_eq!(
        figure_tokens("-$50.5K to $410K to -$41.6K to $497K (+/-10%)"),
        ["-10%"]
    );
    for x in [12.345e6, -2.5e6, 0.123, 45.67, 1.5e12, 987.0] {
        for r in renderings(x) {
            assert!(
                tokens(&format!("a {r} b")).contains(&r.as_str()),
                "{r} of {x}"
            );
        }
    }
    assert!(renderings(0.0).is_empty());
    assert_eq!(floats("Exact(1.5), id: 3, x: -2e-3, f32: 4"), [1.5, -2e-3]);
    let f = figures("Band(Band { estimate: 2.0, low: 1.0, high: 3.0 }), Exact(4.5)");
    assert!(matches!(f[..], [Fig::Band(1.0, 3.0), Fig::Exact(4.5)]));
}
