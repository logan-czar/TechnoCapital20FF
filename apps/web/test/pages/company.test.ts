// The Company page read as data (PageDoc, D480) from the views of a real game: lane A's share of
// crates/game/tests/b1_pages.rs (every_entity_page_builds, company_pages_show_every_spec8_field,
// a_private_company_page_shows_bands_and_never_the_truth, pages_link_their_names,
// no_ballot_odds_anywhere, a_director_who_moved_up_still_counts_as_the_voter,
// board_lists_directors_by_position), a1_views.rs the_chart_band_comes_from_the_bars,
// m8_province.rs province_names_link_to_their_pages_everywhere (the company part) and
// workspace.rs a_private_company_card_shows_bands. The DOM half (sections, tabs, live values) is
// lane-a-dom.test.tsx.

import {
  barRows,
  type CompanyDetail,
  type Figure,
  type SeatPerson,
  type Sim,
  STATEMENT_LINE_VALUES,
  simNew,
} from "@tc20ff/sim";
import type { WorldData } from "@tc20ff/sim-data";
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { beforeAll, describe, expect, it } from "vitest";
import { priceBarsViewGetPriceHistory } from "../../../../packages/sim/src/views/price_bars.ts";
import { card } from "../../src/links/cards.ts";
import { buildNameIndex, controllerPage } from "../../src/links/names.ts";
import {
  type Block,
  docFields,
  docLinks,
  docTable,
  docTexts,
  type PageDoc,
  type Span,
} from "../../src/pages/doc.ts";
import {
  board,
  companyDoc,
  EFV_ERROR_WIDTH,
  ipoVote,
  ohlcOf,
  priceChart,
  SECTIONS,
  weekly,
} from "../../src/pages/kinds/company.tsx";
import { PAGE_BUDGET_MS } from "../../src/pages/PagePane.tsx";
import { type PageRef, pageEq, setProvinceKeys } from "../../src/pages/ref.ts";
import { type ViewsData, viewsData } from "../../src/pages/views.ts";
import { type Cell, date, display, money, price } from "../../src/widgets/cells.ts";

/** Ticks to the end of the first plan lock (9 January 2020 00:00 is tick 192, b1_pages.rs). */
const AFTER_FIRST_LOCK = 200;
const SEED = 42;

let data: WorldData;
let fresh: ViewsData;
let after: ViewsData;
/** An Omniscient twin of `after` (D961: a debug Sim of the same seed, then SetOmniscient). */
let truth: ViewsData;
/** The notices of the first 200 ticks. */
const notices: string[] = [];

function newSim(debug = false): Sim {
  const made = simNew(data, SEED, { debug });
  if (!made.ok) throw new Error(JSON.stringify(made.error));
  return made.value;
}

beforeAll(() => {
  const loaded = loadWorld(defaultDataDir());
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  data = loaded.value;
  fresh = viewsData(newSim().views());
  const sim = newSim();
  for (let i = 0; i < AFTER_FIRST_LOCK; i++) for (const n of sim.step()) notices.push(n.kind);
  after = viewsData(sim.views());
  const twin = newSim(true);
  for (let i = 0; i < AFTER_FIRST_LOCK; i++) twin.step();
  const r = twin.apply({ kind: "SetOmniscient", on: true });
  if (!r.ok) throw new Error("SetOmniscient");
  truth = viewsData(twin.views());
  return () => setProvinceKeys(null);
});

const has = (links: PageRef[], p: PageRef) => links.some((l) => pageEq(l, p));
const texts = (d: PageDoc, v: ViewsData) => docTexts(d, v).join(" | ");
const labels = (d: PageDoc) => new Set(docFields(d).map((f) => f.label));
const section = (d: PageDoc, id: string) => {
  const s = d.sections.find((x) => x.id === id);
  if (!s) throw new Error(`section ${id}`);
  return s;
};
/** The texts of one section alone. */
const sectionText = (d: PageDoc, id: string, v: ViewsData) =>
  texts({ ...d, head: [], chips: [], sections: [section(d, id)] }, v);
const rows = (v: ViewsData) => v.company_rows?.rows ?? [];
const detail = (v: ViewsData, id: number) =>
  v.company_detail?.companies.find((d) => d.id === id) as CompanyDetail;

/** The figures a page shows as fields, by label. */
function figureFields(d: PageDoc): [string, Figure[]][] {
  return docFields(d)
    .map((f): [string, Figure[]] => [f.label, f.value.flatMap((s) => (s.k === "figure" ? [s.figure] : []))])
    .filter(([, f]) => f.length > 0);
}

describe("the Company page", () => {
  it("builds for every company, fresh and past the first lock, with its sections (every_entity_page_builds)", () => {
    for (const v of [fresh, after]) {
      const index = buildNameIndex(v);
      const kinds = new Set<boolean>();
      for (const r of rows(v)) {
        const d = companyDoc(r.id, v, index);
        expect(d.title).toBe(r.name);
        expect(d.sections.map((s) => s.id)).toEqual(SECTIONS.map((s) => s.id));
        expect(texts(d, v), r.name).not.toContain("No such");
        kinds.add(r.public);
      }
      expect(kinds.size, "public and private companies").toBe(2);
    }
  });

  it("shows every spec 8 field on a listed, a private, a born and a listing-in-play company (company_pages_show_every_spec8_field)", () => {
    const v = after;
    const index = buildNameIndex(v);
    const listed = rows(v).find((r) => r.listing.kind === "BeforeStart");
    const priv = rows(v).find((r) => r.listing.kind === "Private" && r.origin.kind === "Start");
    const born = rows(v).find((r) => r.origin.kind === "Born");
    const inPlay = rows(v).find((r) => r.listing.kind === "InPlay");
    if (!(listed && priv && born && inPlay)) throw new Error("a listed, private, born and in-play company");
    for (const r of [listed, priv, born, inPlay]) {
      const doc = companyDoc(r.id, v, index);
      const l = labels(doc);
      const all = texts(doc, v);
      // Header (spec 8): name, ticker, HQ, industry, owner of record, controller.
      expect(doc.title).toBe(r.name);
      for (const want of ["Ticker", "HQ", "Industry", "Owner of record", "Controller"])
        expect(l.has(want), `${r.name}: header ${want}`).toBe(true);
      expect(all).toContain("Founded");
      expect(all.includes("Listed") || all.includes("Private: not listed"), r.name).toBe(true);
      // Overview.
      for (const want of [
        "Value",
        "Price",
        "Confidence",
        "Management score",
        "Cash",
        "Credit line",
        "Rating",
        "Next release",
      ])
        expect(l.has(want), `${r.name}: overview ${want}`).toBe(true);
      // Board: five seat cards with the skill used, founders, directors, the IPO vote.
      const cards = section(doc, "board").blocks.flatMap((b) => (b.k === "cards" ? [b.cards] : []));
      expect(cards[0]?.length, "five seat cards").toBe(5);
      expect(cards[0]?.every((c) => c.fields.some((f) => f.label === "Skill used"))).toBe(true);
      const bt = sectionText(doc, "board", v);
      for (const want of ["Seats", "Founders", "Directors", "IPO vote"])
        expect(bt, `${r.name}: ${want}`).toContain(want);
      // Cap table: the holders, summing to the shares out.
      const ct = docTable(doc, "company.cap_table");
      const sum = (ct?.rows ?? []).reduce((s, row) => {
        const c = row[2];
        if (c?.k !== "int") throw new Error("an int shares cell");
        return s + c.v;
      }, 0);
      expect(sum, r.name).toBe(detail(v, r.id).shares_out);
      // Units.
      const u = docTable(doc, "company.units");
      const titles = u?.columns.map((c) => c.title) ?? [];
      for (const want of [
        "Industry",
        "Base province",
        "Assets",
        "Productivity",
        "Growth",
        "R&D",
        "Revenue",
        "Expenses",
      ])
        expect(titles, `units ${want}`).toContain(want);
      expect(u?.rows.length).toBe(v.units?.units.filter((x) => x.company === r.id).length);
      // Financials: the quarterly statements and the Quarter view; a born company has no
      // quarter closed yet, a starting one has its 2019 history.
      const s = docTable(doc, "company.statements.quarters");
      expect(s?.rows.length).toBeGreaterThanOrEqual(STATEMENT_LINE_VALUES.length);
      expect((s?.columns.length ?? 0) > 1, `${r.name}: published quarters`).toBe(r.origin.kind === "Start");
      for (const want of ["Last results", "Projection range", "Consensus"])
        expect(l.has(want), `${r.name}: financials ${want}`).toBe(true);
      // Tech.
      for (const want of ["Labor split", "Stations", "PC", "Next step", "Inflow"])
        expect(l.has(want), `${r.name}: tech ${want}`).toBe(true);
      const quests = section(doc, "tech").blocks.find((b) => b.k === "cards");
      expect(quests, "data quests cards").toBeDefined();
      if (quests?.k === "cards")
        expect(
          quests.cards.every((c) => c.bar !== null),
          "progress bars",
        ).toBe(true);
      // The price chart for a listed company (a listing of this lock has no bars until its
      // first close, so its chart starts empty).
      const chart = section(doc, "chart").blocks.find((b) => b.k === "chart");
      const bars = (v.price_bars?.companies ?? []).some((h) => h.id === r.id);
      expect(chart !== undefined, `${r.name}: chart`).toBe(r.public);
      if (chart?.k === "chart") expect(chart.chart.labels.length > 0, `${r.name}: bars`).toBe(bars);
      expect(bars || r.listing.kind !== "BeforeStart").toBe(true);
    }
    // Founded [date] ([event]): a born company names its event; founders' cards show skills,
    // traits and the home province.
    const doc = companyDoc(born.id, v, index);
    if (born.origin.kind !== "Born") throw new Error("born");
    const origin = born.origin;
    const founded = doc.head.find(
      (b): b is Extract<Block, { k: "line" }> =>
        b.k === "line" && b.spans.some((s) => s.k === "text" && s.text.startsWith("Founded")),
    );
    expect(founded?.spans).toContainEqual({ k: "text", text: `Founded ${date(origin.date)}` });
    expect(
      founded?.spans.some((s) => s.k === "link" && pageEq(s.page, { kind: "event", id: origin.event })),
    ).toBe(true);
    expect(sectionText(doc, "board", v)).toContain("lead founder");
    for (const want of ["Skills", "Traits", "Home"])
      expect(labels(doc).has(want), `founder card ${want}`).toBe(true);
    // Listed [date] on [exchange] at $[price].
    const listing = inPlay.listing;
    if (listing.kind !== "InPlay") throw new Error("in play");
    const ip = companyDoc(inPlay.id, v, index);
    expect(texts(ip, v)).toContain(`Listed ${date(listing.date)} on`);
    expect(texts(ip, v)).toContain(`at ${price(listing.ipo_price)}`);
    expect(has(docLinks(ip), { kind: "exchange", id: listing.exchange })).toBe(true);
    // A listed starting company: "listed before 2020".
    expect(texts(companyDoc(listed.id, v, index), v)).toContain("Listed before 2020 on");
  });

  it("a private company page shows bands and never the truth, against an Omniscient twin (a_private_company_page_shows_bands_and_never_the_truth)", () => {
    const v = after;
    const index = buildNameIndex(v);
    expect(v.clock?.omniscient).toBe(false);
    const row = rows(v).find((r) => r.estimated && !r.public && r.status === "Active");
    if (!row) throw new Error("a private company");
    const doc = companyDoc(row.id, v, index);
    const shown = figureFields(doc);
    for (const want of ["Value", "Value a share", "Cash", "Credit line", "Revenue TTM", "Net income TTM"]) {
      const f = shown.find(([l]) => l === want);
      expect(f, want).toBeDefined();
      expect(
        f?.[1].every((x) => x.kind === "Band"),
        `${want} is a band`,
      ).toBe(true);
    }
    // Every money cell of the statements and units tables is a band, but the compute line (exact
    // by D434).
    for (const id of ["company.statements.quarters", "company.units"]) {
      const t = docTable(doc, id);
      if (!t) throw new Error(id);
      let bands = 0;
      for (const r of t.rows) {
        r.slice(1).forEach((c, i) => {
          const col = t.columns[i + 1]?.title ?? "";
          if (c.k === "money") {
            const line = display(r[0] as Cell);
            expect(line.includes("Compute") || col.includes("Compute"), `${id} ${line} ${col}: a band`).toBe(
              true,
            );
          } else if (c.k === "band") bands++;
        });
      }
      expect(bands, id).toBeGreaterThan(0);
    }
    expect(texts(doc, v)).toContain("estimates");
    // The texts that are not bands: a band shows only its own range, whose ends can round to the
    // same three digits as the truth inside it.
    const plain = docTexts(doc, v)
      .filter((t) => !(t.includes("-$") || t.includes(" to ")))
      .join(" | ");
    const truthDoc = companyDoc(row.id, truth, buildNameIndex(truth));
    const exact = figureFields(truthDoc);
    let checked = 0;
    for (const [label, figs] of shown) {
      const real = exact.find(([l]) => l === label)?.[1];
      if (!real) continue;
      figs.forEach((f, i) => {
        const x = real[i];
        if (f.kind !== "Band" || x?.kind !== "Exact") return;
        expect(f.band.low, `${label}: inside`).toBeLessThan(x.value);
        expect(f.band.high, `${label}: inside`).toBeGreaterThan(x.value);
        expect(f.band.estimate).not.toBe(x.value);
        if (Math.abs(x.value) >= 1e6) {
          expect(plain, `${label}: the truth shows`).not.toContain(money(x.value));
          checked++;
        }
      });
    }
    // The statements: each banded quarter against the twin's exact one of the same period.
    const ours = docTable(doc, "company.statements.quarters");
    const theirs = docTable(truthDoc, "company.statements.quarters");
    if (!(ours && theirs)) throw new Error("statements");
    for (let c = 1; c < ours.columns.length; c++) {
      const tc = theirs.columns.findIndex((x) => x.title === ours.columns[c]?.title);
      expect(tc, "the twin has the quarter").toBeGreaterThan(0);
      ours.rows.forEach((r, i) => {
        const a = r[c];
        const b = theirs.rows[i]?.[tc];
        if (a?.k !== "band" || b?.k !== "money") return;
        expect(a.low, display(r[0] as Cell)).toBeLessThan(b.v);
        expect(a.high, display(r[0] as Cell)).toBeGreaterThan(b.v);
        if (Math.abs(b.v) >= 1e6) {
          expect(plain).not.toContain(money(b.v));
          checked++;
        }
      });
    }
    expect(checked, "truths checked").toBeGreaterThan(20);
    // With Omniscient on, the same page shows exact figures.
    expect(exact.every(([, f]) => f.every((x) => x.kind === "Exact"))).toBe(true);
    expect(texts(truthDoc, truth)).not.toContain("Figures: estimates");
  });

  it("links its industry, HQ, exchange, controller, owner of record, event, founders and board (pages_link_their_names; m8_province company part)", () => {
    const v = after;
    const index = buildNameIndex(v);
    const all = rows(v);
    for (const r of [...all.slice(0, 80), ...all.filter((x) => x.origin.kind === "Born")]) {
      const links = docLinks(companyDoc(r.id, v, index));
      const d = detail(v, r.id);
      expect(has(links, { kind: "industry", id: r.industry }), r.name).toBe(true);
      expect(has(links, { kind: "country", id: r.hq_country }), r.name).toBe(true);
      expect(has(links, { kind: "province", id: d.hq_province }), r.name).toBe(true);
      if (r.exchange !== null) expect(has(links, { kind: "exchange", id: r.exchange })).toBe(true);
      const cp = controllerPage(r.controller);
      if (cp) expect(has(links, cp), `${r.name}: controller`).toBe(true);
      if (r.owner_of_record !== null)
        expect(has(links, { kind: "character", id: r.owner_of_record })).toBe(true);
      if (r.origin.kind === "Born") {
        expect(has(links, { kind: "event", id: r.origin.event })).toBe(true);
        for (const f of d.founders) expect(has(links, { kind: "character", id: f }), "founder").toBe(true);
      }
      for (const u of v.units?.units ?? [])
        if (u.company === r.id) expect(has(links, { kind: "province", id: u.base_province })).toBe(true);
      // Full seat holders link; partial ones are marked and not linked.
      for (const s of d.board) {
        const p = s.holder;
        if (p && p.character !== null && !p.partial)
          expect(has(links, { kind: "character", id: p.character })).toBe(true);
      }
    }
  });
});

/** Rust's odds formats of a chance: "61%", "61.4%", "0.61", "0.614". */
const oddsTexts = (chance: number) => [
  `${(chance * 100).toFixed(0)}%`,
  `${(chance * 100).toFixed(1)}%`,
  chance.toFixed(2),
  chance.toFixed(3),
];

/** A doc of one board section, as b1_pages.rs builds it around `board`. */
function boardDoc(d: CompanyDetail, v: ViewsData): PageDoc {
  return {
    page: { kind: "company", id: d.id },
    title: d.name,
    kind: "Company",
    chips: [],
    head: [],
    sections: [{ id: "board", blocks: board(d, v, buildNameIndex(v)) }],
  };
}

describe("the Board tab", () => {
  it("never shows ballot odds, on every real vote and a hand-made one (no_ballot_odds_anywhere)", () => {
    expect(notices).toContain("IpoVote");
    const v = after;
    const index = buildNameIndex(v);
    let voted = 0;
    for (const d of v.company_detail?.companies ?? []) {
      const rec = d.ipo_last_vote;
      if (!rec) continue;
      voted++;
      const doc = companyDoc(d.id, v, index);
      const bt = sectionText(doc, "board", v);
      expect(bt, d.name).toContain("Last vote");
      for (const b of rec.result.ballots)
        for (const s of oddsTexts(b.chance)) expect(bt, d.name).not.toContain(s);
      const all = texts(doc, v).toLowerCase();
      expect(all.includes("odds") || all.includes("chance")).toBe(false);
    }
    expect(voted, "votes at the first lock").toBeGreaterThan(0);
    // A hand-made vote with distinctive odds: the CEO who voted has since left (another partial),
    // the CFO who voted still sits, Director 1 is a full character, and the controller's vote is
    // the state's.
    const d: CompanyDetail = structuredClone(v.company_detail?.companies[0] as CompanyDetail);
    const holder = (i: number) => {
      const h = d.board[i]?.holder;
      if (!h) throw new Error("a seated board");
      return h;
    };
    const [ceo, cfo] = [holder(0), holder(1)];
    const full = v.characters?.full[0];
    if (full?.id.kind !== "Full" || cfo.partial_id === null)
      throw new Error("a full character and a partial CFO");
    const fullId = full.id.id;
    d.ipo_last_vote = {
      date: { year: 2020, month: 4, day: 9 },
      result: {
        ballots: [
          {
            role: { kind: "Seat", seat: "Ceo" },
            chance: 0.6137,
            yes: true,
            voter: { kind: "Partial", id: 9_999, name: "Ona Gone" },
          },
          {
            role: { kind: "Seat", seat: "Cfo" },
            chance: 0.4413,
            yes: true,
            voter: { kind: "Partial", id: cfo.partial_id, name: cfo.name },
          },
          {
            role: { kind: "Director", position: 0 },
            chance: 0.2291,
            yes: false,
            voter: { kind: "Full", character: fullId },
          },
          { role: { kind: "Controller" }, chance: 0.8846, yes: true, voter: { kind: "State" } },
        ],
        yes: 3,
        no: 1,
        passed: true,
      },
      capped: true,
    };
    d.ipo_next_vote = { year: 2020, q: 3 };
    const doc = boardDoc(d, v);
    const bt = texts(doc, v);
    for (const want of [
      "CEO",
      "Director 1",
      "Controller",
      "yes",
      "no",
      "passed 3 to 1",
      "Ona Gone",
      "the state",
    ])
      expect(bt).toContain(want);
    // The voter, and today's holder only where it is someone else (D542).
    const fields = [...(doc.sections[0]?.blocks ?? [])]
      .reverse()
      .find((b) => b.k === "fields" && b.fields.some((f) => f.label === "Controller"));
    if (fields?.k !== "fields") throw new Error("the ballots");
    const line = (label: string): Span[] => fields.fields.find((f) => f.label === label)?.value ?? [];
    const held = (s: Span[]) => s.some((x) => x.k === "muted" && x.text.startsWith("(held now by"));
    expect(line("CEO")).toContainEqual({ k: "text", text: "Ona Gone" });
    expect(line("CEO")).toContainEqual({ k: "muted", text: `(held now by ${ceo.name} (partial))` });
    expect(line("CFO")).toContainEqual({ k: "text", text: cfo.name });
    expect(held(line("CFO")), "the CFO who voted still sits").toBe(false);
    expect(line("Director 1")).toContainEqual({
      k: "link",
      text: index.title({ kind: "character", id: fullId }),
      page: { kind: "character", id: fullId },
    });
    expect(line("Director 1"), "no director sits at position 1 now").toContainEqual({
      k: "muted",
      text: "(vacant now)",
    });
    expect(bt).toContain("Next vote 09 Jul 2020");
    expect(bt).toContain("world cap");
    for (const c of [0.6137, 0.4413, 0.2291, 0.8846])
      for (const s of oddsTexts(c)) expect(bt).not.toContain(s);
    expect(bt, "no percent on the vote").not.toContain("%");
  });

  it("a director who voted and still sits is no change after moving up (a_director_who_moved_up_still_counts_as_the_voter)", () => {
    const v = after;
    const d: CompanyDetail = structuredClone(v.company_detail?.companies[0] as CompanyDetail);
    const stays: SeatPerson = {
      name: "Bo Stays",
      age: 50,
      skills: (d.board[0]?.holder as SeatPerson).skills,
      traits: [],
      partial: true,
      character: null,
      partial_id: 8_002,
    };
    // At the vote: Director 1 was a partial who has since left, Director 2 was Bo. Now Bo is the
    // only director, at position 1.
    d.directors = [stays];
    const ballot = (n: number, id: number, name: string) => ({
      role: { kind: "Director" as const, position: n },
      chance: 0.5,
      yes: true,
      voter: { kind: "Partial" as const, id, name },
    });
    d.ipo_last_vote = {
      date: { year: 2020, month: 4, day: 9 },
      result: {
        ballots: [ballot(0, 8_001, "Al Gone"), ballot(1, 8_002, "Bo Stays")],
        yes: 2,
        no: 0,
        passed: true,
      },
      capped: false,
    };
    const blocks = ipoVote(d, buildNameIndex(v));
    const fields = blocks.find((b) => b.k === "fields");
    if (fields?.k !== "fields") throw new Error("the ballots");
    const line = (label: string) => fields.fields.find((f) => f.label === label)?.value ?? [];
    const muted = (s: Span[]) => s.filter((x) => x.k === "muted");
    expect(muted(line("Director 1"))).toEqual([{ k: "muted", text: "(held now by Bo Stays (partial))" }]);
    expect(line("Director 2")).toContainEqual({ k: "text", text: "Bo Stays" });
    expect(muted(line("Director 2")), "Bo still sits").toEqual([]);
  });

  it("lists directors by seat position, a full one linked and a partial one marked (board_lists_directors_by_position)", () => {
    const v = after;
    const index = buildNameIndex(v);
    const d: CompanyDetail = structuredClone(v.company_detail?.companies[0] as CompanyDetail);
    const full = v.characters?.full[0];
    if (full?.id.kind !== "Full") throw new Error("a full character");
    const fullId = full.id.id;
    const person = (name: string, character: number | null, partialId: number | null): SeatPerson => ({
      name,
      age: 41,
      skills: full.skills,
      traits: [],
      partial: partialId !== null,
      character: character as SeatPerson["character"],
      partial_id: partialId,
    });
    d.directors = [person("Ada Partial", null, 9_001), person(full.name, fullId, null)];
    const doc = boardDoc(d, v);
    const blocks = doc.sections[0]?.blocks ?? [];
    const at = blocks.findIndex((b) => b.k === "heading" && b.text === "Directors (2)");
    expect(at, "the directors heading").toBeGreaterThanOrEqual(0);
    const f = blocks[at + 1];
    if (f?.k !== "fields") throw new Error("the directors' fields");
    expect(f.fields.map((x) => x.label)).toEqual(["Director 1", "Director 2"]);
    expect(f.fields[0]?.value[0]).toEqual({ k: "text", text: "Ada Partial" });
    expect(f.fields[0]?.value[1]).toMatchObject({ k: "colored", text: "(partial)" });
    expect(f.fields[1]?.value[0]).toEqual({
      k: "link",
      text: index.title({ kind: "character", id: fullId }),
      page: { kind: "character", id: fullId },
    });
    expect(has(docLinks(doc), { kind: "character", id: fullId })).toBe(true);
  });
});

describe("the price chart", () => {
  it("its band comes from the bars, daily and weekly (a1_views the_chart_band_comes_from_the_bars)", () => {
    const sim = newSim();
    for (let i = 0; i < 24 * 15; i++) sim.step();
    const v = viewsData(sim.views());
    const pb = v.price_bars;
    const h = pb?.companies.find((x) => barRows(x.bars).length >= 10);
    if (!(pb && h)) throw new Error("a company with bars");
    const bars = priceBarsViewGetPriceHistory(
      pb,
      h.id,
      "Daily",
      { year: 2000, month: 1, day: 1 },
      { year: 2100, month: 1, day: 1 },
    );
    const m = priceChart(h.id, v);
    const c = m?.series[0];
    if (c?.k !== "candles") throw new Error("candles");
    expect(m?.title).not.toContain("A1");
    expect(c.bars.length).toBe(bars.length);
    c.bars.forEach((o, i) => {
      const b = bars[i];
      if (!b) throw new Error("bar");
      expect(b.efv).toBeGreaterThan(0);
      expect(o.band, formatKey(b.date)).toEqual([
        b.efv * (1 - EFV_ERROR_WIDTH),
        b.efv * (1 + EFV_ERROR_WIDTH),
      ]);
      expect([o.open, o.close]).toEqual([b.open, b.close]);
    });
    // The chart's weekly bars against v_price_bars' weekly resolution.
    const ours = weekly(bars.map(ohlcOf));
    const first = bars[0]?.date;
    const last = bars[bars.length - 1]?.date;
    if (!(first && last)) throw new Error("dates");
    const theirs = priceBarsViewGetPriceHistory(pb, h.id, "Weekly", first, last);
    expect(theirs.length).toBeGreaterThanOrEqual(2);
    expect(ours.length).toBe(theirs.length);
    ours.forEach((o, i) => {
      const w = theirs[i];
      if (!w) throw new Error("week");
      expect(o.date).toEqual(w.date);
      expect(o.band).toEqual([w.efv * (1 - EFV_ERROR_WIDTH), w.efv * (1 + EFV_ERROR_WIDTH)]);
    });
  });
});

const formatKey = (d: { year: number; month: number; day: number }) => `${d.year}-${d.month}-${d.day}`;

describe("the company hover card", () => {
  it("shows bands for a private company, and the truth with Omniscient (workspace a_private_company_card_shows_bands)", () => {
    const v = after;
    const row = rows(v).find((r) => r.estimated && !r.public);
    if (!row) throw new Error("a private company");
    const page: PageRef = { kind: "company", id: row.id };
    const c = card(page, v, buildNameIndex(v));
    for (const [label, f] of [
      ["Revenue TTM", row.revenue_ttm],
      ["Net income", row.net_income_ttm],
      ["Value", row.value],
    ] as const) {
      if (f.kind !== "Band") throw new Error(`${label} is a band`);
      const line = c.lines.find((l) => l.label === label);
      expect(line?.value, label).toBe(
        display({ k: "band", unit: "money", low: f.band.low, high: f.band.high }),
      );
      expect(line?.tone, label).toBe("band");
    }
    expect(
      c.lines.some((l) => l.label === "Figures"),
      "marked as estimates",
    ).toBe(true);
    const open = card(page, truth, buildNameIndex(truth));
    const real = truth.company_rows?.rows.find((r) => r.id === row.id);
    if (real?.revenue_ttm.kind !== "Exact") throw new Error("Omniscient is exact");
    const line = open.lines.find((l) => l.label === "Revenue TTM");
    expect(line?.value).toBe(money(real.revenue_ttm.value));
    expect(line?.tone).toBeNull();
    expect(open.lines.some((l) => l.label === "Figures")).toBe(false);
  });
});

describe("the open budget", () => {
  it(`builds the heaviest company page in under ${PAGE_BUDGET_MS} ms`, () => {
    const index = buildNameIndex(after);
    // The company with the most units (the Units table is the page's biggest).
    const counts = new Map<number, number>();
    for (const u of after.units?.units ?? []) counts.set(u.company, (counts.get(u.company) ?? 0) + 1);
    const [big] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    if (big === undefined) throw new Error("units");
    companyDoc(big as never, after, index);
    let worst = 0;
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      companyDoc(big as never, after, index);
      worst = Math.max(worst, performance.now() - t0);
    }
    expect(worst).toBeLessThan(PAGE_BUDGET_MS);
  });
});
