// Hover name cards' content (crates/game/src/links/cards.rs; 20-ui 20.3.3; D454, D463): a few
// compact facts and links for each page kind, read from the views only (spec 9). Every money
// figure goes through figureCell (D461): a company that does not publish shows estimate bands, as
// the views serve them (D420), and never the estimate inside a band.
//
// Not ported here: zone_hover_card (the map's Financial zones mode card): it belongs to the map
// lane with the other map modes.

import type { Figure } from "@tc20ff/sim";
import type { Shown, Tone } from "../pages/doc.ts";
import { kindName, type PageRef } from "../pages/ref.ts";
import { byId, byKey, type ViewsData } from "../pages/views.ts";
import {
  type Cell,
  cellTone,
  date,
  display,
  figureCell,
  fixed,
  int,
  money,
  percent,
  price,
  ratingLabel,
  type Unit,
} from "../widgets/cells.ts";
import { controllerPage, type NameIndex, place, role } from "./names.ts";

/** Most roles a character card lists before it sums the rest. */
export const CARD_ROLES = 4;
/** HQs a province card names before it sums the rest. */
export const CARD_HQS = 3;

/** One fact: a label and a value, maybe colored or a link. */
export interface CardLine {
  label: string;
  value: string;
  tone: Tone | null;
  link: PageRef | null;
}

/** A name card. */
export interface Card {
  title: string;
  kind: string;
  lines: CardLine[];
}

const line = (label: string, value: string): CardLine => ({ label, value, tone: null, link: null });
const linkLine = (label: string, value: string, page: PageRef): CardLine => ({
  label,
  value,
  tone: null,
  link: page,
});
const colored = (label: string, value: string, tone: Tone): CardLine => ({ label, value, tone, link: null });
const cellLine = (label: string, c: Cell): CardLine => ({
  label,
  value: display(c),
  tone: cellTone(c),
  link: null,
});
/** A view's figure (D461): exact as is, a band as its range in the estimate color. */
const figureLine = (label: string, f: Figure, unit: Unit): CardLine => cellLine(label, figureCell(f, unit));
const gainLine = (label: string, v: number): CardLine => cellLine(label, { k: "gain", v, unit: "percent" });
/** The line that says a card's figures are estimates. */
const estimateNote = (): CardLine => colored("Figures", "estimates: not published", "band");

/** Rust `{:+.N}`: a sign always. */
export function signed(x: number, decimals: number): string {
  const s = fixed(x, decimals);
  return s.startsWith("-") ? s : `+${s}`;
}

/** Rust Figure::sum: exact when every part is, else a band of the summed ends. */
function figureSum(parts: readonly Figure[]): Figure {
  let exact = true;
  let [est, low, high] = [0, 0, 0];
  for (const p of parts) {
    if (p.kind === "Exact") {
      est += p.value;
      low += p.value;
      high += p.value;
    } else {
      exact = false;
      est += p.band.estimate;
      low += p.band.low;
      high += p.band.high;
    }
  }
  return exact ? { kind: "Exact", value: est } : { kind: "Band", band: { estimate: est, low, high } };
}

/** The card of `page`. */
export function card(page: PageRef, v: ViewsData, index: NameIndex): Card {
  const lines: CardLine[] = [];
  const name = (p: PageRef): [string, PageRef] => [index.title(p), p];
  switch (page.kind) {
    case "company":
      companyLines(page.id, v, index, lines);
      break;
    case "industry": {
      const r = byId(v.industry_rows?.rows, page.id);
      if (!r) break;
      lines.push(line("Sector", r.sector), line("Phase", r.phase_label), gainLine("Growth", r.growth_annual));
      lines.push(line("Long-term", percent(r.lt)));
      lines.push(
        figureLine("Supply S", r.supply_ratio, "ratio"),
        figureLine("Fringe", r.fringe_share, "percent"),
      );
      const top = r.top_companies[0];
      if (top !== undefined) lines.push(linkLine("Largest", ...name({ kind: "company", id: top })));
      if (r.estimated) lines.push(estimateNote());
      break;
    }
    case "zone": {
      const z = byId(v.zones?.zones, page.id);
      if (!z) break;
      lines.push(line("Zone", String(z.number)));
      const [n, p] = name({ kind: "exchange", id: z.id });
      lines.push(linkLine("Exchange", `${z.exchange_code} ${n}`, p));
      lines.push(line("Effect", signed(z.effect, 3)), line("Credit spread", percent(z.credit_spread)));
      lines.push(line("Confidence", signed(z.confidence, 0)));
      if (z.index_close !== null) lines.push(line("Index", `${z.index_name} ${fixed(z.index_close, 1)}`));
      lines.push(line("GDP share", percent(z.gdp_share)), line("Countries", int(z.members.length)));
      break;
    }
    case "exchange": {
      const x = byKey(v.exchanges?.exchanges, (e) => e.zone, page.id);
      if (!x) break;
      lines.push(line("Code", x.code));
      const hub = place(v, x.hub_province);
      lines.push(hub ? linkLine("Hub", ...hub) : line("Hub", x.hub_city));
      lines.push(line("Index", `${x.index_name} ${x.level === null ? "?" : fixed(x.level, 1)}`));
      lines.push(line("Listed", int(x.listed_count)), line("Confidence", signed(x.confidence, 0)));
      lines.push(linkLine("Zone", ...name({ kind: "zone", id: x.zone })));
      break;
    }
    case "province":
      provinceLines(page.id, v, index, lines);
      break;
    case "country": {
      const c = byId(v.countries?.countries, page.id);
      if (!c) break;
      lines.push(line("ISO3", c.iso3), line("Region", c.superregion));
      lines.push(linkLine("Zone", ...name({ kind: "zone", id: c.zone })));
      lines.push(line("GDP", money(c.gdp_usd)), line("Corp tax", percent(c.corp_tax_rate)));
      lines.push(line("Sovereign", `${ratingLabel(c.sovereign_rating)} (+${percent(c.sovereign_spread)})`));
      lines.push(line("HQ companies", int(c.hq_companies.length)));
      break;
    }
    case "character": {
      const c = v.characters?.full.find((x) => x.id.kind === "Full" && x.id.id === page.id);
      if (!c) break;
      lines.push(line("Age", String(c.age)));
      if (c.home) {
        const home = place(v, c.home.province) ?? [
          `${c.home.province_name}, ${c.home.country_name}`,
          { kind: "country", id: c.home.country },
        ];
        lines.push(linkLine("Home", ...home));
      }
      if (c.tier !== "") lines.push(line("Tier", c.tier));
      for (const r of c.roles.slice(0, CARD_ROLES)) {
        const [label, co] = role(r);
        lines.push(linkLine(label, ...name({ kind: "company", id: co })));
      }
      if (c.roles.length > CARD_ROLES) lines.push(line("Roles", `${c.roles.length} in all`));
      if (c.holdings.length > 0) lines.push(line("Holdings", `${c.holdings.length} companies`));
      break;
    }
    case "event": {
      const e = v.births?.events.find((x) => x.id === page.id);
      if (!e) break;
      lines.push(line("Event", e.name), line("Date", date(e.date)));
      for (const i of e.industries.slice(0, 3))
        lines.push(linkLine("Industry", ...name({ kind: "industry", id: i })));
      lines.push(line("Startups", int(e.startups.length)));
      break;
    }
    case "recap":
      lines.push(line("Quarter", `Q${page.quarter.q} ${page.quarter.year}`));
      lines.push(line("Opens", "in the pre-quarter-end week (spec 8)"));
      break;
    case "headline": {
      const h = v.news?.feed[page.id];
      if (!h) break;
      lines.push(line("Date", date(h.date)), line("Headline", h.text));
      if (h.company !== null) lines.push(linkLine("Company", ...name({ kind: "company", id: h.company })));
      if (h.industry !== null)
        lines.push(linkLine("Industry", ...name({ kind: "industry", id: h.industry })));
      break;
    }
    default: {
      const n = listLen(page, v);
      if (n !== null) lines.push(line("Entries", int(n)));
    }
  }
  return { title: index.title(page), kind: kindName(page.kind), lines };
}

/** A province's development as one line: "C 9 / I 12 / P 16, total 37". */
export function developmentText(c: {
  commerce: number;
  industry: number;
  population: number;
  total: number;
}): string {
  return `C ${c.commerce} / I ${c.industry} / P ${c.population}, total ${c.total}`;
}

/**
 * The province card (spec 8 Map row; D704): its country, region, development and largest track,
 * resource, terrain, Metro, key city and contested tag, then its HQs (the first CARD_HQS as
 * links) and its units with their gross assets summed as v_units shows them (a band when any unit
 * there is banded, D420, D430).
 */
function provinceLines(id: number, v: ViewsData, index: NameIndex, lines: CardLine[]): void {
  const c = v.province_cards?.cards[id];
  if (!c) return;
  const country: PageRef = { kind: "country", id: c.country };
  lines.push(linkLine("Country", index.title(country), country));
  lines.push(line("Region", c.area === c.region || c.area === "" ? c.region : `${c.region} (${c.area})`));
  lines.push(line("Development", developmentText(c)));
  lines.push(
    line(
      "Largest",
      c.largest_track === "Commerce"
        ? "Commerce"
        : c.largest_track === "Industry"
          ? "Industry"
          : "Commerce and Industry (tie)",
    ),
  );
  lines.push(line("Resource", c.resource), line("Terrain", c.coastal ? `${c.terrain}, coastal` : c.terrain));
  lines.push(line("Metro", c.metro ?? "none"), line("Key city", c.key_city ?? "none"));
  if (c.contested !== null) lines.push(colored("Contested", c.contested, "magenta"));
  lines.push(line("HQs", int(c.hqs.length)));
  for (const co of c.hqs.slice(0, CARD_HQS)) {
    const p: PageRef = { kind: "company", id: co };
    lines.push(linkLine("", index.title(p), p));
  }
  if (c.hqs.length > CARD_HQS) lines.push(line("", `and ${c.hqs.length - CARD_HQS} more`));
  const here = c.units.flatMap((u) => {
    const row = byId(v.units?.units, u);
    return row ? [row] : [];
  });
  const companies = new Set(here.map((u) => u.company));
  lines.push(line("Units", `${int(here.length)} of ${int(companies.size)} companies`));
  if (here.length > 0) {
    lines.push(figureLine("Unit assets", figureSum(here.map((u) => u.gross_assets)), "money"));
    if (here.some((u) => u.estimated)) lines.push(estimateNote());
  }
}

/**
 * A company's card lines: ticker, industry, HQ place, status, the quote (listed and quoted),
 * rating, the TTM figures and value (bands for a company that does not publish), controller.
 */
function companyLines(id: number, v: ViewsData, index: NameIndex, lines: CardLine[]): void {
  const name = (p: PageRef): [string, PageRef] => [index.title(p), p];
  const r = byId(v.company_rows?.rows, id);
  if (!r) return;
  const detail = byId(v.company_detail?.companies, id);
  const listed = r.public && r.ticker !== "";
  lines.push(line("Ticker", listed ? r.ticker : "private"));
  lines.push(linkLine("Industry", ...name({ kind: "industry", id: r.industry })));
  const hq = (detail ? place(v, detail.hq_province) : null) ?? name({ kind: "country", id: r.hq_country });
  lines.push(linkLine("HQ", ...hq));
  if (r.status !== "Active") lines.push(colored("Status", r.status, "magenta"));
  const q = byId(v.quotes?.rows, id);
  if (q) {
    lines.push(
      line("Price", price(q.last)),
      gainLine("Day", q.change_pct),
      line("Mkt cap", money(q.market_cap)),
    );
    lines.push(line("Est. value", `${price(q.efv)} (${price(q.efv_low)}-${price(q.efv_high)})`));
    lines.push(linkLine("Exchange", ...name({ kind: "exchange", id: q.exchange })));
  }
  if (listed) lines.push(line("Rating", ratingLabel(r.rating)));
  lines.push(
    figureLine("Revenue TTM", r.revenue_ttm, "money"),
    figureLine("Net income", r.net_income_ttm, "money"),
  );
  // A quoted company's value is its market cap at EFV (above); the rest show 5.13 step 6's value,
  // a band while the company does not publish.
  if (!q) lines.push(figureLine("Value", r.value, "money"));
  if (r.estimated) lines.push(estimateNote());
  const cp = controllerPage(r.controller);
  if (cp && r.controller_name !== null) lines.push(linkLine("Controller", r.controller_name, cp));
}

/** How many entries a list page has, from the views. */
export function listLen(page: PageRef, v: ViewsData): number | null {
  switch (page.kind) {
    case "companies":
      return v.company_rows?.rows.filter((r) => r.status !== "Removed").length ?? null;
    case "industries":
      return v.industry_rows?.rows.length ?? null;
    case "news":
      return v.news?.feed.length ?? null;
    case "exchanges":
      return v.exchanges?.exchanges.length ?? null;
    case "zones":
      return v.zones?.zones.length ?? null;
    case "events":
      return v.births?.events.length ?? null;
    case "characters":
      return v.characters?.full.length ?? null;
    case "countries":
      return v.countries?.countries.length ?? null;
    default:
      return null;
  }
}

/** The views a card reads. */
export const CARD_VIEWS = [
  "company_rows",
  "company_detail",
  "quotes",
  "industry_rows",
  "zones",
  "exchanges",
  "countries",
  "characters",
  "births",
  "news",
  "places",
  "province_cards",
  "units",
] as const;

/** A line's text and color, for the renderer. */
export function lineShown(l: CardLine): Shown {
  return { text: l.value, tone: l.tone ?? (l.link ? "link" : "text") };
}
