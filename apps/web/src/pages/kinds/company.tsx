// The Company page (crates/game/src/pages/company.rs, M9.2 and M9.7; spec 8 Company and Startups
// and listings, 20-ui 20.7.2): a header with the name, ticker, HQ, industry, owner of record and
// controller, and the "Founded [date] ([event])" and "Listed [date] on [exchange] at $[price]"
// lines; then the six spec 8 tabs as sections (Overview, Board, Cap table, Units, Financials,
// Tech) and a price chart over the EFV band for a listed company. The header's tab strip shows one
// section at a time, or all (D481).
//
// Everything comes from the views (spec 9). Every figure goes through `figureCell` (D461), so a
// company that does not publish (private, or a new listing before its first release) shows
// estimate bands and never its truth; Omniscient (debug builds) makes the views exact. IPO ballots
// show each member's vote and never the odds (20-ui 20.1, D482).
//
// Also here: placeholder.rs `placeholder_chart` for a company and chart/data.rs `weekly`,
// `last_years` and `ten_year_view` (the 10-year weekly view, M9.1, D465).

import {
  type Archetype,
  barRows,
  type CapHolder,
  type CharacterId,
  type CompanyDetail,
  type CompanyId,
  type CompanyRow,
  type CompanyStatus,
  cmpDate,
  type DailyBar,
  dateTimeDate,
  type EstimatedStatement,
  type Figure,
  figureSum,
  formatQuarter,
  lockTick,
  type OperatingFigures,
  type Period,
  type Seat,
  type SeatCard,
  type SeatPerson,
  type SimDate,
  type Skills,
  STATEMENT_LINE_LABELS,
  STATEMENT_LINE_VALUES,
  type Statement,
  type StatementLine,
  simDateDaysSinceEpoch,
  simDateWeekday,
  statementLineOf,
  type Trait,
  WEEKDAY_VALUES,
} from "@tc20ff/sim";
import { signed } from "../../links/cards.ts";
import { controllerPage, eventName, type NameIndex, place, placeSpans, seatName } from "../../links/names.ts";
import { type Cell, date, figureCell, fixed, number, price } from "../../widgets/cells.ts";
import {
  type Block,
  bps,
  type CardDoc,
  type ChartModel,
  emptyDoc,
  type Field,
  field,
  notFound,
  type Ohlc,
  type PageDoc,
  type Span,
  span,
  type TableDoc,
  type Tone,
} from "../doc.ts";
import { kindName, type PageRef } from "../ref.ts";
import type { SectionSpec } from "../sections.ts";
import { definePage } from "../spec.ts";
import { linkCell, statusText } from "../tables.ts";
import { byId, byKey, type ViewsData } from "../views.ts";

/** The Company page's sections, in default order: the six spec 8 tabs and the price chart. */
export const SECTIONS: readonly SectionSpec[] = [
  { id: "overview", title: "Overview" },
  { id: "chart", title: "Price chart" },
  { id: "board", title: "Board" },
  { id: "cap_table", title: "Cap table" },
  { id: "units", title: "Units" },
  { id: "financials", title: "Financials" },
  { id: "tech", title: "Tech" },
];

/** Quarters the quarterly statements table shows (newest first). */
export const STATEMENT_QUARTERS = 8;
/** Years the yearly table shows (the archive keeps 5, D228). */
export const STATEMENT_YEARS = 5;
/** Years the long chart view covers (3-markets 3.13.1: weekly bars up to 10 years). */
export const LONG_VIEW_YEARS = 10;
/** Days back from the last bar past which the chart switches to the 10-year weekly view (D465). */
export const DAILY_VIEW_DAYS = 365;
/** The EFV band's half width, a fraction (3.14.2: EFV × (1 ± 15%); sim EFV_ERROR_WIDTH). */
export const EFV_ERROR_WIDTH = 0.15;

/**
 * The views the page reads. It rebuilds when the monthly, lock and quarterly ones move, and on
 * the daily bars (the chart); the every-tick and daily figures (price, projection) follow by
 * themselves (live spans).
 */
export const VIEWS = [
  "company_rows",
  "company_detail",
  "units",
  "tech",
  "statements",
  "ratings",
  "cap_table",
  "characters",
  "births",
  "countries",
  "places",
  "price_bars",
] as const;

// ---------------------------------------------------------------- chart (chart/data.rs)

/** A daily bar with its EFV band at the close (chart/data.rs `Ohlc::from_bar`). */
export function ohlcOf(b: DailyBar): Ohlc {
  const band: [number, number] | null =
    Number.isFinite(b.efv) && b.efv > 0
      ? [b.efv * (1 - EFV_ERROR_WIDTH), b.efv * (1 + EFV_ERROR_WIDTH)]
      : null;
  return { date: b.date, open: b.open, high: b.high, low: b.low, close: b.close, band };
}

/**
 * Daily bars into Monday-to-Sunday weeks, each dated by its first bar: the first open, the last
 * close, the highest high and lowest low, and the band of the week's last bar (D457, D424).
 */
export function weekly(daily: readonly Ohlc[]): Ohlc[] {
  const key = (d: SimDate) => simDateDaysSinceEpoch(d) - WEEKDAY_VALUES.indexOf(simDateWeekday(d));
  const out: Ohlc[] = [];
  let lastKey: number | null = null;
  for (const b of daily) {
    const k = key(b.date);
    const w = out[out.length - 1];
    if (w && lastKey === k) {
      w.high = Math.max(w.high, b.high);
      w.low = Math.min(w.low, b.low);
      w.close = b.close;
      w.band = b.band;
    } else {
      out.push({ ...b });
      lastKey = k;
    }
  }
  return out;
}

/** The bars of the last `years` years up to the last bar (dates after the same day `years` earlier). */
export function lastYears(daily: readonly Ohlc[], years: number): readonly Ohlc[] {
  const last = daily[daily.length - 1];
  if (!last) return daily;
  // 29 Feb falls back to 28 Feb in a non-leap year: comparing by (year, month, day) does that.
  const from: SimDate = { ...last.date, year: last.date.year - years };
  const after = (b: Ohlc) => cmpDate(b.date, from) > 0;
  let lo = 0;
  let hi = daily.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (after(daily[mid] as Ohlc)) hi = mid;
    else lo = mid + 1;
  }
  return daily.slice(lo);
}

/** The 10-year view: the last ten years in weekly bars. */
export function tenYearView(daily: readonly Ohlc[]): Ohlc[] {
  return weekly(lastYears(daily, LONG_VIEW_YEARS));
}

/** A candle chart (chart/data.rs `ChartModel::candles`). */
export function candles(title: string, bars: Ohlc[]): ChartModel {
  return {
    title,
    labels: bars.map((b) => date(b.date)),
    series: [{ k: "candles", bars }],
    format: "Price",
    reference: null,
  };
}

/**
 * The price chart of a company with bars (placeholder.rs `placeholder_chart`): daily bars over each
 * day's EFV band, or the 10-year weekly view once it has more than a year (M9.1, D465).
 */
export function priceChart(id: CompanyId, v: ViewsData): ChartModel | null {
  const h = byId(v.price_bars?.companies, id);
  if (!h) return null;
  const daily = barRows(h.bars).map(ohlcOf);
  const last = daily[daily.length - 1];
  const first = daily[0];
  if (!last || !first) return null;
  const yearAgo = simDateDaysSinceEpoch(last.date) - DAILY_VIEW_DAYS;
  return simDateDaysSinceEpoch(first.date) < yearAgo
    ? candles("10 years, weekly bars over the EFV band", tenYearView(daily))
    : candles("Daily bars over the EFV band", daily);
}

/** A cast ballot (5.20.1). */
type Ballot = NonNullable<CompanyDetail["ipo_last_vote"]>["result"]["ballots"][number];
type VoterRole = Ballot["role"];
type BallotVoter = NonNullable<Ballot["voter"]>;

// ---------------------------------------------------------------- text helpers

/** "Fin 7 Ops 5 Per 3 Int 4 Tec 6 Hus 2" (spec 3.7 skills). */
export function skillsText(s: Skills): string {
  return `Fin ${s.finance} Ops ${s.operations} Per ${s.persuasion} Int ${s.intrigue} Tec ${s.tech} Hus ${s.hustle}`;
}

/** The traits, or "none" (Rust `Trait::name` is the variant name). */
export function traitsText(t: readonly Trait[]): string {
  return t.length === 0 ? "none" : t.join(", ");
}

/** Spec 6.1 archetype names (Rust `Archetype::name`). */
const ARCHETYPE_NAME: Readonly<Record<Archetype, string>> = {
  StateChampion: "State champion",
  Startup: "Startup",
  AggressiveGrower: "Aggressive grower",
  CashCow: "Cash cow",
  Incumbent: "Incumbent",
};

function statusTone(s: CompanyStatus): Tone {
  switch (s) {
    case "Active":
      return "green";
    case "Distressed":
      return "amber";
    default:
      return "magenta";
  }
}

/** A seat's labor unit, 1 to 5 (Rust `Seat::labor_unit`); null for the Chair. */
function laborUnit(seat: Seat): number | null {
  return seat === "Chair" ? null : (["Ceo", "Cfo", "Cio", "Cmo", "Coo"] as const).indexOf(seat) + 1;
}

/** A character's name as a link. */
function characterSpan(index: NameIndex, id: CharacterId): Span {
  const p: PageRef = { kind: "character", id };
  return span.link(index.title(p), p);
}

// ---------------------------------------------------------------- the page

/** The whole Company page as data. */
export function companyDoc(id: CompanyId, v: ViewsData, index: NameIndex): PageDoc {
  const page: PageRef = { kind: "company", id };
  const doc = emptyDoc(page, index.title(page), kindName("company"));
  const d = byId(v.company_detail?.companies, id);
  const row = byId(v.company_rows?.rows, id);
  if (!d) {
    doc.head.push(notFound("company"));
    return doc;
  }
  doc.chips.push(span.colored(statusText(d.status), statusTone(d.status)));
  if (d.estimated) doc.chips.push(span.colored("Figures: estimates (not published)", "band"));
  doc.head = header(d, row, v, index);
  doc.sections = [
    { id: "overview", blocks: overview(d, row, v) },
    { id: "chart", blocks: chart(id, d, v) },
    { id: "board", blocks: board(d, v, index) },
    { id: "cap_table", blocks: capTable(id, v) },
    { id: "units", blocks: units(id, v, index) },
    { id: "financials", blocks: financials(id, d, v) },
    { id: "tech", blocks: tech(id, v, index) },
  ];
  return doc;
}

/** The header: identity fields, then the Founded and Listed lines (spec 8; D428). */
function header(d: CompanyDetail, row: CompanyRow | undefined, v: ViewsData, index: NameIndex): Block[] {
  const t = (p: PageRef) => span.link(index.title(p), p);
  const owner =
    row?.owner_of_record != null && row.owner_of_record_name != null
      ? span.link(row.owner_of_record_name, { kind: "character", id: row.owner_of_record })
      : span.muted("none named");
  const ctrlPage = row ? controllerPage(row.controller) : null;
  const controller =
    ctrlPage && row?.controller_name != null
      ? span.link(row.controller_name, ctrlPage)
      : span.muted("widely held");
  const f: Field[] = [
    field.text("Ticker", d.ticker === "" ? "-" : d.ticker),
    field.new("HQ", placeSpans(v, d.hq_province) ?? [t({ kind: "country", id: d.hq_country })]),
    field.new("Industry", [t({ kind: "industry", id: d.industry })]),
    field.new("Owner of record", [owner]),
    field.new("Controller", [controller]),
    field.text("Archetype", ARCHETYPE_NAME[d.archetype]),
    field.text("Company id", d.key === "" ? "born in play" : d.key),
  ];
  const blocks: Block[] = [{ k: "fields", fields: f }];
  // "Founded [date] ([event])" (spec 8 Startups and listings).
  if (d.origin.kind === "Born") {
    const ev = d.origin.event;
    const e = byId(v.births?.events, ev);
    const name = e ? eventName(e) : index.title({ kind: "event", id: ev });
    blocks.push({
      k: "line",
      spans: [
        span.text(`Founded ${date(d.origin.date)}`),
        span.muted("("),
        span.link(name, { kind: "event", id: ev }),
        span.muted(")"),
      ],
    });
  } else {
    blocks.push({ k: "line", spans: [span.text("Founded before 2020 (a starting company)")] });
  }
  // "Listed [date] on [exchange] at $[price]", or "listed before 2020" (D428).
  const listing = row?.listing ?? { kind: "Private" };
  switch (listing.kind) {
    case "Private":
      blocks.push({ k: "line", spans: [span.text("Private: not listed")] });
      break;
    case "BeforeStart":
      blocks.push({
        k: "line",
        spans: [span.text("Listed before 2020 on"), t({ kind: "exchange", id: listing.exchange })],
      });
      break;
    case "InPlay":
      blocks.push({
        k: "line",
        spans: [
          span.text(`Listed ${date(listing.date)} on`),
          t({ kind: "exchange", id: listing.exchange }),
          span.text(`at ${price(listing.ipo_price)}`),
        ],
      });
      break;
  }
  return blocks;
}

/**
 * The Overview tab (spec 8): value, price, confidence, management score, cash, line, rating, next
 * release; with the TTM figures and the shares.
 */
function overview(d: CompanyDetail, row: CompanyRow | undefined, v: ViewsData): Block[] {
  const id = d.id;
  const quoted = d.exchange !== null && d.quoted;
  const f: Field[] = [];
  if (row) f.push(field.figure("Value", row.value, "money"));
  f.push(field.figure("Value a share", d.shown_value_per_share, "price"));
  if (quoted) {
    f.push(
      field.new("Price", [
        span.live({ k: "Price", company: id }),
        span.live({ k: "DayChange", company: id }),
      ]),
    );
    f.push(field.live("EFV", { k: "Efv", company: id }));
    f.push(field.live("Market cap", { k: "MarketCap", company: id }));
  } else {
    f.push(field.new("Price", [span.muted(d.exchange !== null ? "delisted" : "not listed")]));
  }
  const zone = byId(v.countries?.countries, d.hq_country)?.zone;
  const conf: Span[] = [span.cell({ k: "ratio", v: d.confidence_factor }), span.muted("factor")];
  if (zone !== undefined) conf.push(span.muted("| zone"), span.live({ k: "ZoneConfidence", zone }));
  f.push(field.new("Confidence", conf));
  f.push(field.text("Management score", `${fixed(d.management_score, 1)} / 100`));
  f.push(field.figure("Cash", d.cash_usd, "money"));
  f.push(
    field.new("Credit line", [
      span.figure(d.line_drawn_usd, "money"),
      span.muted("drawn of"),
      span.figure(d.line_limit_usd, "money"),
    ]),
  );
  const r = byId(v.ratings?.companies, id);
  if (r) {
    f.push(
      field.new("Line rate", [
        span.cell({ k: "percent", v: r.line_rate }),
        span.muted(`(home spread ${bps(r.home_spread)})`),
      ]),
    );
  }
  f.push(field.cell("Rating", { k: "rating", v: d.rating }));
  f.push(field.live("Next release", { k: "NextRelease" }));
  if (row) {
    f.push(field.figure("Revenue TTM", row.revenue_ttm, "money"));
    f.push(field.figure("Net income TTM", row.net_income_ttm, "money"));
  }
  f.push(field.cell("Shares out", { k: "int", v: d.shares_out }));
  f.push(field.text("Buzz", signed(d.buzz, 0)));
  return [{ k: "fields", fields: f }];
}

function chart(id: CompanyId, d: CompanyDetail, v: ViewsData): Block[] {
  const m = priceChart(id, v);
  if (m) return [{ k: "chart", chart: m }];
  // An empty chart: the page lists v_price_bars, so the first close draws on the next rebuild.
  if (d.exchange !== null)
    return [{ k: "chart", chart: candles("No bars yet: the chart fills from the first daily close.", []) }];
  return [
    { k: "line", spans: [span.muted("Not listed: a private company has no price history (spec 5.14).")] },
  ];
}

function personFields(p: SeatPerson): Field[] {
  return [
    field.text("Age", String(p.age)),
    field.text("Skills", skillsText(p.skills)),
    field.text("Traits", traitsText(p.traits)),
  ];
}

/** A seat's holder: a link for a full character; a partial one marked and not linked (spec 8). */
function holderSpans(p: SeatPerson, index: NameIndex): Span[] {
  return p.character !== null && !p.partial
    ? [characterSpan(index, p.character)]
    : [span.text(p.name), span.colored("(partial)", "muted")];
}

function seatCard(s: SeatCard, index: NameIndex): CardDoc {
  const unit = laborUnit(s.seat) ?? 0;
  const head: Span[] = [span.colored(seatName(s.seat), "cyan"), span.muted(`labor unit ${unit}`)];
  if (!s.open) {
    head.push(span.muted("closed"));
    return {
      head,
      fields: [
        field.text("Seat", `opens with labor unit ${unit}`),
        field.text("Skill used", fixed(s.skill_used, 1)),
      ],
      bar: null,
      dim: true,
    };
  }
  const fields: Field[] = [
    s.holder
      ? field.new("Holder", holderSpans(s.holder, index))
      : field.new("Holder", [span.muted("vacant")]),
  ];
  if (s.holder) fields.push(...personFields(s.holder));
  fields.push(field.text("Skill used", fixed(s.skill_used, 1)));
  return { head, fields, bar: null, dim: false };
}

/** The role a ballot was cast from (5.20.1 step 2). */
function voterLabel(role: VoterRole): string {
  switch (role.kind) {
    case "Seat":
      return seatName(role.seat);
    case "Director":
      return `Director ${role.position + 1}`;
    case "Controller":
      return "Controller";
  }
}

/**
 * The Board tab (spec 8): seat cards for labor units 1 to 5 with the skill used, founders' cards
 * (skills, traits, home province), directors, and the last IPO vote with each member's vote and
 * the next vote date (5.20.1). Never the ballot odds (D482).
 */
export function board(d: CompanyDetail, v: ViewsData, index: NameIndex): Block[] {
  const out: Block[] = [{ k: "heading", text: "Seats" }];
  out.push({
    k: "cards",
    cards: d.board.filter((s) => laborUnit(s.seat) !== null).map((s) => seatCard(s, index)),
  });
  out.push({ k: "heading", text: "Founders" });
  if (d.founders.length === 0) {
    out.push({
      k: "line",
      spans: [span.muted("A starting company: no founders (founders come with a birth, 5.19.3).")],
    });
  } else {
    const chars = v.characters?.full;
    out.push({
      k: "cards",
      cards: d.founders.map((ch, i): CardDoc => {
        const head = [characterSpan(index, ch)];
        if (i === 0) head.push(span.muted("lead founder"));
        const c = byKey(chars, (r) => r.id.id, ch);
        const fields: Field[] = [];
        if (c) {
          fields.push(
            field.text("Age", String(c.age)),
            field.text("Skills", skillsText(c.skills)),
            field.text("Traits", traitsText(c.traits)),
          );
          if (c.home) {
            const pl = place(v, c.home.province);
            fields.push(
              field.new("Home", [
                pl
                  ? span.link(pl[0], pl[1])
                  : span.link(c.home.country_name, { kind: "country", id: c.home.country }),
              ]),
            );
          }
        }
        return { head, fields, bar: null, dim: false };
      }),
    });
  }
  // The directors in seat position order, as the view lists them (D541).
  out.push({ k: "heading", text: `Directors (${d.directors.length})` });
  if (d.directors.length === 0) {
    out.push({ k: "line", spans: [span.muted("No directors without a labor seat.")] });
  } else {
    out.push({
      k: "fields",
      fields: d.directors.map((p, i) =>
        field.new(voterLabel({ kind: "Director", position: i }), [
          ...holderSpans(p, index),
          span.muted(`age ${p.age}, ${skillsText(p.skills)}`),
        ]),
      ),
    });
  }
  out.push({ k: "heading", text: "IPO vote" });
  out.push(...ipoVote(d, index));
  return out;
}

/** Who holds a ballot's role today, if anyone; the controller's extra vote has no seat. */
function holderNow(d: CompanyDetail, role: VoterRole): SeatPerson | null {
  switch (role.kind) {
    case "Seat":
      return d.board.find((s) => s.seat === role.seat)?.holder ?? null;
    case "Director":
      return d.directors[role.position] ?? null;
    case "Controller":
      return null;
  }
}

/** True if `p` is the member who cast the ballot. */
function isVoter(p: SeatPerson, v: BallotVoter): boolean {
  switch (v.kind) {
    case "Full":
      return p.character === v.character;
    case "Partial":
      return p.partial_id === v.id;
    case "State":
      return false;
  }
}

/** A ballot's voter: a full character linked, a partial one marked (D486), the state. */
function voterSpans(v: BallotVoter, index: NameIndex): Span[] {
  switch (v.kind) {
    case "Full":
      return [characterSpan(index, v.character)];
    case "Partial":
      return [span.text(v.name), span.colored("(partial)", "muted")];
    case "State":
      return [span.text("the state")];
  }
}

/**
 * The last IPO vote, each member's vote and the next vote date (spec 8, 5.20.1). Each ballot names
 * who cast it, and who holds the role today only when that is someone else (D542). The ballots'
 * odds stay in the view and are never shown (20-ui 20.1, D482).
 */
export function ipoVote(d: CompanyDetail, index: NameIndex): Block[] {
  const out: Block[] = [];
  const rec = d.ipo_last_vote;
  if (rec) {
    const r = rec.result;
    const line: Span[] = [
      span.text(`Last vote ${date(rec.date)}: ${r.passed ? "passed" : "failed"} ${r.yes} to ${r.no}`),
    ];
    if (rec.capped)
      line.push(span.colored("(passed, but the world cap of 3 listings a quarter turned it back)", "amber"));
    out.push({ k: "line", spans: line });
    const fields = r.ballots.map((b) => {
      const value: Span[] = [b.yes ? span.colored("yes", "gain") : span.colored("no", "loss")];
      const now = holderNow(d, b.role);
      const voter = b.voter;
      if (voter) value.push(...voterSpans(voter, index));
      // A director who voted and still sits, whatever position the directors before them
      // leaving moved them to, is no change.
      const stillDirector =
        b.role.kind === "Director" && voter !== null && d.directors.some((p) => isVoter(p, voter));
      const moved = stillDirector
        ? false
        : now === null
          ? false
          : voter === null
            ? true
            : !isVoter(now, voter);
      if (stillDirector) {
        // no note
      } else if (moved && now) {
        value.push(span.muted(`(held now by ${now.name}${now.partial ? " (partial)" : ""})`));
      } else if (voter !== null && now === null && b.role.kind !== "Controller") {
        value.push(span.muted("(vacant now)"));
      }
      return field.new(voterLabel(b.role), value);
    });
    out.push({ k: "fields", fields });
  } else {
    out.push({
      k: "line",
      spans: [
        span.muted(d.exchange !== null ? "Listed: its board no longer votes on an IPO." : "No IPO vote yet."),
      ],
    });
  }
  const q = d.ipo_next_vote;
  out.push({
    k: "line",
    spans: q
      ? [span.text(`Next vote ${date(dateTimeDate(lockTick(q)))} (the ${formatQuarter(q)} plan lock)`)]
      : [span.muted("No vote scheduled.")],
  });
  return out;
}

function capKind(h: CapHolder): string {
  switch (h.kind) {
    case "Controller":
      return "Controller";
    case "OtherHolders":
      return "Other holders";
    case "Founder":
      return "Founder";
    case "SeedInvestors":
      return "Seed investors";
    case "PublicFloat":
      return "Public float";
    case "NewInvestors":
      return "New investors";
  }
}

/** The Cap table tab (spec 8 "static holders"; D153, D425). */
function capTable(id: CompanyId, v: ViewsData): Block[] {
  const ct = byKey(v.cap_table?.companies, (c) => c.company, id);
  if (!ct) return [{ k: "line", spans: [span.muted("No cap table.")] }];
  const rows = ct.lines.map((l): Cell[] => {
    const page =
      l.holder.kind === "Controller"
        ? controllerPage(l.holder.controller)
        : l.holder.kind === "Founder"
          ? ({ kind: "character", id: l.holder.character } as PageRef)
          : null;
    return [
      page ? { k: "link", text: l.name, page } : { k: "text", v: l.name },
      { k: "text", v: capKind(l.holder) },
      { k: "int", v: l.shares },
      { k: "percent", v: l.share },
    ];
  });
  return [
    { k: "fields", fields: [field.cell("Shares out", { k: "int", v: ct.shares_out })] },
    {
      k: "table",
      table: {
        id: "company.cap_table",
        columns: [
          { title: "Holder", width: 220 },
          { title: "Kind", width: 110 },
          { title: "Shares", width: 120 },
          { title: "Share", width: 70, hint: "Share of shares outstanding" },
        ],
        rows,
      },
    },
  ];
}

/**
 * The Units tab (spec 8): industry, base province, assets, productivity, growth, R&D, revenue and
 * expenses of every unit, last month's, as figures (D420, D436).
 */
function units(id: CompanyId, v: ViewsData, index: NameIndex): Block[] {
  const rows = (v.units?.units ?? [])
    .filter((u) => u.company === id)
    .map((u): Cell[] => {
      const expenses = figureSum([u.variable_m, u.fixed_m, u.rd_m, u.dep_m, u.shared_m]);
      const pl = place(v, u.base_province);
      return [
        linkCell(index, { kind: "industry", id: u.industry }),
        pl ? { k: "link", text: pl[0], page: pl[1] } : { k: "unknown" },
        figureCell(u.gross_assets, "money"),
        figureCell(u.asset_book, "money"),
        figureCell(u.assets_eff, "money"),
        figureCell(u.productivity, "number"),
        figureCell(u.p_pre, "number"),
        { k: "percent", v: u.growth_plan },
        { k: "percent", v: u.rd_plan },
        figureCell(u.revenue_m, "money"),
        figureCell(expenses, "money"),
        figureCell(u.variable_m, "money"),
        figureCell(u.fixed_m, "money"),
        figureCell(u.rd_m, "money"),
        figureCell(u.dep_m, "money"),
        figureCell(u.shared_m, "money"),
        figureCell(u.ebit_m, "money"),
        figureCell(u.capex_m, "money"),
      ];
    });
  return [
    {
      k: "table",
      table: {
        id: "company.units",
        columns: [
          { title: "Industry", width: 170 },
          { title: "Base province", width: 190 },
          { title: "Assets", width: 120, hint: "Business assets at cost" },
          { title: "Book", width: 120 },
          { title: "Effective", width: 120, hint: "Assets less the 20% shortfall of ramping tranches (5.2)" },
          { title: "Productivity", width: 100 },
          { title: "P pre", width: 100, hint: "Productivity + PC bonus + location" },
          { title: "Growth", width: 70, hint: "The locked plan's annual growth" },
          { title: "R&D", width: 60, hint: "R&D plan, share of revenue" },
          { title: "Revenue", width: 120, hint: "Last month" },
          { title: "Expenses", width: 120, hint: "Last month: every 5.5 line" },
          { title: "Variable", width: 110 },
          { title: "Fixed", width: 110 },
          { title: "R&D cost", width: 110, hint: "R&D spend" },
          { title: "Depreciation", width: 110 },
          { title: "Compute", width: 100, hint: "Compute and licences (3.8)" },
          { title: "EBIT", width: 110 },
          { title: "Capex", width: 110 },
        ],
        rows,
      },
    },
  ];
}

/** One statement column: its period label, its line figures and its key figures. */
interface StatementCol {
  label: string;
  lines: Figure[];
  op: OperatingFigures;
}

function periodLabel(p: Period, synthetic: boolean): string {
  const base = p.kind === "Quarter" ? formatQuarter(p.quarter) : `FY ${p.year}`;
  return synthetic ? `${base}*` : base;
}

const exact = (value: number): Figure => ({ kind: "Exact", value });

function exactCol(s: Statement): StatementCol {
  const k = s.key;
  return {
    label: periodLabel(s.period, s.synthetic),
    lines: STATEMENT_LINE_VALUES.map((l) => exact(statementLineOf(l, s))),
    op: {
      productivity: k.productivity,
      pc_bonus: k.pc_bonus,
      labor_units: k.labor_units,
      held_tb: exact(k.held_tb),
      free_rd_pct: k.free_rd_pct,
      management_score: k.management_score,
      rating: k.rating,
    },
  };
}

function estimatedCol(s: EstimatedStatement): StatementCol {
  return { label: periodLabel(s.period, s.synthetic), lines: s.lines, op: s.operating };
}

/**
 * A company's last `n` statements of a period, newest first: exact when it publishes, else the
 * views' estimates (D420).
 */
function statementCols(id: CompanyId, v: ViewsData, period: "Quarter" | "Year", n: number): StatementCol[] {
  const c = byId(v.statements?.companies, id);
  if (!c) return [];
  const cols = c.estimated
    ? (period === "Quarter" ? c.estimated_quarters : c.estimated_years).slice(-n).map(estimatedCol)
    : (period === "Quarter" ? c.quarters : c.years).slice(-n).map(exactCol);
  return cols.reverse();
}

const OP_ROWS: readonly (readonly [string, (o: OperatingFigures) => Cell])[] = [
  ["Productivity", (o) => ({ k: "number", v: o.productivity })],
  ["PC bonus", (o) => ({ k: "int", v: o.pc_bonus })],
  ["Labor units", (o) => ({ k: "int", v: o.labor_units })],
  ["Held TB", (o) => figureCell(o.held_tb, "number")],
  ["Free R&D", (o) => ({ k: "percent", v: o.free_rd_pct / 100 })],
  ["Management score", (o) => ({ k: "number", v: o.management_score })],
  ["Rating", (o) => ({ k: "rating", v: o.rating })],
];

function statementsTable(id: string, cols: readonly StatementCol[]): TableDoc {
  const rows: Cell[][] = STATEMENT_LINE_VALUES.map((l, i) => [
    { k: "text", v: STATEMENT_LINE_LABELS[l] },
    ...cols.map((c) => figureCell(c.lines[i] as Figure, "money")),
  ]);
  for (const [label, f] of OP_ROWS) rows.push([{ k: "text", v: label }, ...cols.map((c) => f(c.op))]);
  return {
    id,
    columns: [{ title: "Line", width: 170 }, ...cols.map((c) => ({ title: c.label, width: 124 }))],
    rows,
  };
}

const lineIndex = (l: StatementLine) => STATEMENT_LINE_VALUES.indexOf(l);

/**
 * The Financials tab (spec 8; 21.5.3): the Quarter view (last results, this quarter's consensus
 * and projection range), the quarterly statements and the years; bands for a company that does
 * not publish (D420).
 */
function financials(id: CompanyId, d: CompanyDetail, v: ViewsData): Block[] {
  const out: Block[] = [];
  if (d.estimated) {
    out.push({
      k: "line",
      spans: [
        span.colored(
          "Not published (private, or listed since the last release): every figure is an estimate band.",
          "band",
        ),
      ],
    });
  }
  const quarters = statementCols(id, v, "Quarter", STATEMENT_QUARTERS);
  out.push({ k: "heading", text: "Quarter view" });
  const q: Field[] = [];
  const last = quarters[0];
  if (last) {
    const fig = (l: StatementLine) => last.lines[lineIndex(l)] as Figure;
    q.push(
      field.new("Last results", [
        span.text(last.label),
        span.muted("revenue"),
        span.figure(fig("Revenue"), "money"),
        span.muted("net income"),
        span.figure(fig("NetIncome"), "money"),
      ]),
    );
    q.push(
      field.new("Guidance", [
        span.figure(fig("GuidanceLow"), "money"),
        span.muted("to"),
        span.figure(fig("GuidanceHigh"), "money"),
      ]),
    );
  } else {
    q.push(field.new("Last results", [span.muted("none published yet")]));
  }
  q.push(field.live("Consensus", { k: "Consensus", company: id }));
  q.push(field.live("Projection range", { k: "ProjectionRange", company: id }));
  q.push(field.live("Next release", { k: "NextRelease" }));
  out.push({ k: "fields", fields: q });
  out.push({
    k: "heading",
    text: `Quarterly statements (last ${quarters.length}, newest first; * from the 2019 run rate)`,
  });
  out.push({ k: "table", table: statementsTable("company.statements.quarters", quarters) });
  const years = statementCols(id, v, "Year", STATEMENT_YEARS);
  if (years.length > 0) {
    out.push({ k: "heading", text: "Years" });
    out.push({ k: "table", table: statementsTable("company.statements.years", years) });
  }
  return out;
}

/**
 * The Tech tab (spec 8; 10.0.11.7): labor split, stations, PC and the next step, compute, and a
 * data quests card per industry with a progress bar and inflow against decay.
 */
function tech(id: CompanyId, v: ViewsData, index: NameIndex): Block[] {
  const t = byKey(v.tech?.companies, (c) => c.company, id);
  if (!t) return [{ k: "line", spans: [span.muted("No tech data.")] }];
  const s = t.stations;
  const stations = s.productivity + s.enterprise + s.fifty_fifty + s.research + s.idle;
  const stored = figureSum(t.data.flatMap((x) => [x.held_tb, x.unstructured_tb]));
  const f: Field[] = [
    field.cell("Labor units", { k: "int", v: t.labor_units }),
    field.text(
      "Labor split",
      `productivity ${s.productivity}  enterprise ${s.enterprise}  50/50 ${s.fifty_fifty}  research ${s.research}  idle ${s.idle}`,
    ),
    field.cell("Stations", { k: "int", v: stations }),
    field.new("PC", [span.cell({ k: "number", v: t.pc }), span.muted(`bonus +${fixed(t.pc_bonus, 0)}`)]),
    field.text("Next step", `at PC ${fixed(t.next_bonus_pc, 1)}`),
    field.text(
      "Compute",
      `extra base ${t.compute.extra_base_compute}  data ${t.compute.data_compute}  licences ${t.compute.licences}`,
    ),
    field.cell("Compute bill", { k: "money", v: t.compute.monthly_usd }),
    field.figure("Stored TB", stored, "number"),
  ];
  const out: Block[] = [
    { k: "fields", fields: f },
    { k: "heading", text: "Data quests" },
  ];
  if (t.data.length === 0) {
    out.push({ k: "line", spans: [span.muted("No data held yet.")] });
    return out;
  }
  out.push({
    k: "cards",
    cards: t.data.map((dq): CardDoc => {
      const ind: PageRef = { kind: "industry", id: dq.industry };
      return {
        head: [span.link(index.title(ind), ind)],
        fields: [
          field.figure("Held TB", dq.held_tb, "number"),
          field.new("Unstructured", [
            span.figure(dq.unstructured_tb, "number"),
            span.muted(`TB in ${dq.buckets} buckets`),
          ]),
          field.text("Free R&D", `${dq.free_rd_pct}%${dq.grace ? " (drop in grace)" : ""}`),
          field.text("Next step", `at ${number(dq.next_step_tb)} TB`),
          field.new("Inflow", [
            span.figure(dq.inflow_tb, "number"),
            span.muted("TB a month vs decay"),
            span.figure(dq.decay_tb, "number"),
          ]),
          field.text("Conversion", `${number(dq.conversion_tb)} TB a month`),
        ],
        bar: { value: dq.held_tb, max: dq.next_step_tb },
        dim: false,
      };
    }),
  });
  return out;
}

export const pages = [
  definePage({
    kind: "company",
    views: VIEWS,
    sections: SECTIONS,
    tabs: true,
    doc: (page, v, index) => companyDoc(page.id, v, index),
  }),
];
