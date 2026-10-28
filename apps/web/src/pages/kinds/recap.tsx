// The Quarterly recap (crates/game/src/pages/recap.rs, M9.5; spec 8 Quarterly recap; 20-ui
// 20.7.9; 21.6.2).
//
// A recap is built at the start of its quarter's pre-quarter-end week (spec 4.4 row 5, D164) and
// the World keeps the last 20 (D433), each reachable as `recap/<quarter>`.
//
// - World page: the global phase and g_t, the industries by phase label, and the biggest expected
//   beats and misses by projection (D280).
// - Company pages (the watchlist companies): the anticipated earnings range, the expected
//   reaction, the confidence and the outlook (phase label, loss quarters, rating and rating watch).
//   No guidance choice (spec 8).
//
// Figures go through `figureCell` (D461): a company that does not publish shows its projection,
// consensus and range as bands, and its expected surprise and reaction are worked out from those
// estimates in the view (D420, D430), so the recap never shows a hidden value.
//
// The recap opens in a pane when its alert pauses the game (D513): the pane already showing a
// recap, else a new pane (shell/Workspace.tsx). Clicking the alert opens it in the focused pane
// (D304; panes/AlertsPane.tsx). The watchlist is v_clock's (D975), so a watchlist change shows on
// every quarter's page.

import {
  type CompanyId,
  cmpDateTime,
  cmpQuarter,
  dateTimeDate,
  formatQuarter,
  type Notice,
  type Quarter,
  quarterEq,
  type RecapQuarter,
  recapTick,
  roundHalfAway,
  simDateQuarter,
} from "@tc20ff/sim";
import { FIRST_QUARTER, type NameIndex } from "../../links/names.ts";
import { type Cell, date, figureCell, gain } from "../../widgets/cells.ts";
import { type Block, emptyDoc, type PageDoc, type Span, span, type TableDoc } from "../doc.ts";
import { kindName, type PageRef } from "../ref.ts";
import type { SectionSpec } from "../sections.ts";
import { definePage } from "../spec.ts";
import { linkCell } from "../tables.ts";
import type { ViewsData } from "../views.ts";

/** The quarters a recap page links to, at most (the World keeps 20, D433; sim RECAPS_KEPT). */
export const RECAP_QUARTERS = 20;

export const SECTIONS: readonly SectionSpec[] = [
  { id: "world", title: "World" },
  { id: "beats", title: "Biggest expected beats and misses" },
  { id: "companies", title: "Watchlist companies" },
];

/** The recap of quarter `q`, if kept. */
export function recapOf(v: ViewsData, q: Quarter): RecapQuarter | undefined {
  return v.recap?.recaps.find((r) => quarterEq(r.world.quarter, q));
}

/**
 * The quarter whose recap a notice opens: a QuarterlyRecap alert names its quarter (else the
 * clock's). The workspace opens one at the Pause level only (D513); the alerts list links any.
 */
export function recapAlertQuarter(n: Notice, now: Quarter | null, pauseOnly = true): Quarter | null {
  if (n.kind !== "Alert" || n.alert_kind !== "QuarterlyRecap") return null;
  if (pauseOnly && n.level !== "Pause") return null;
  return n.payload.kind === "Quarter" ? n.payload.quarter : now;
}

/**
 * The expected beats and misses (spec 8 "by projection"; D280): company, projection, consensus,
 * the surprise the projection would make, and which list.
 */
export function expectedTable(r: RecapQuarter, index: NameIndex): TableDoc {
  const row = (e: RecapQuarter["world"]["expected_beats"][number], which: string): Cell[] => [
    { k: "text", v: which },
    linkCell(index, { kind: "company", id: e.company }),
    figureCell(e.projection, "money"),
    figureCell(e.consensus, "money"),
    { k: "gain", v: e.expected_surprise, unit: "percent" },
    { k: "text", v: e.projection.kind === "Band" || e.consensus.kind === "Band" ? "estimates" : "-" },
  ];
  const w = r.world;
  return {
    id: "recap.expected",
    columns: [
      { title: "List", width: 50 },
      { title: "Company", width: 230 },
      { title: "Projection", width: 130, hint: "The no-rolls projection (D164)" },
      { title: "Consensus", width: 130 },
      { title: "Expected s", width: 90, hint: "(projection - consensus) / |consensus| (5.15; D280)" },
      { title: "Figures", width: 80, hint: "Bands for a company that does not publish" },
    ],
    rows: [...w.expected_beats.map((e) => row(e, "Beat")), ...w.expected_misses.map((e) => row(e, "Miss"))],
  };
}

/** The watchlist companies' pages of a recap (spec 8 Company page): one row each, in id order. */
export function companyPagesTable(
  r: RecapQuarter,
  watchlist: readonly CompanyId[],
  index: NameIndex,
): TableDoc {
  const rows = watchlist.flatMap((c): Cell[][] => {
    const p = r.companies.find((x) => x.company === c);
    if (!p) return [];
    const watch = p.outlook.rating_watch;
    return [
      [
        linkCell(index, { kind: "company", id: p.company }),
        figureCell(p.range[0], "money"),
        figureCell(p.range[1], "money"),
        figureCell(p.expected.consensus, "money"),
        { k: "gain", v: p.expected.expected_surprise, unit: "percent" },
        { k: "gain", v: p.expected_reaction, unit: "percent" },
        { k: "ratio", v: p.confidence_factor },
        p.exchange_confidence === null
          ? { k: "text", v: "-" }
          : { k: "int", v: roundHalfAway(p.exchange_confidence) },
        { k: "text", v: p.outlook.label },
        { k: "int", v: p.outlook.loss_quarters },
        { k: "rating", v: p.outlook.rating },
        { k: "text", v: watch === "Upgrade" ? "upgrade" : watch === "Downgrade" ? "downgrade" : "-" },
        { k: "text", v: p.estimated ? "estimates" : "-" },
      ],
    ];
  });
  return {
    id: "recap.companies",
    columns: [
      { title: "Company", width: 220 },
      { title: "Range low", width: 120, hint: "The anticipated earnings range (5.16), low end" },
      { title: "Range high", width: 120, hint: "The anticipated earnings range, high end" },
      { title: "Consensus", width: 120 },
      { title: "Expected s", width: 80, hint: "The surprise the projection makes (5.15)" },
      { title: "Reaction", width: 76, hint: "The expected price move at the release (5.15)" },
      { title: "Conf.", width: 56, hint: "The company's confidence factor (5.7)" },
      { title: "Exch. conf.", width: 70, hint: "Its exchange's investor confidence (5.1.2)" },
      { title: "Phase", width: 60, hint: "Outlook: its industry's phase label" },
      { title: "Losses", width: 56, hint: "Outlook: loss quarters" },
      { title: "Rating", width: 56 },
      { title: "Watch", width: 76, hint: "Outlook: rating watch" },
      { title: "Figures", width: 76 },
    ],
    rows,
  };
}

/** A labelled group of links as a line ("Boom (3): Oil, Gas"); nothing when there are none. */
function linkGroup(label: string, links: readonly PageRef[], index: NameIndex): Block[] {
  if (links.length === 0) return [];
  return [{ k: "line", spans: [span.muted(`${label}:`), ...links.map((p) => span.link(index.title(p), p))] }];
}

/** The whole recap page of quarter `q` as data. */
export function recapDoc(q: Quarter, v: ViewsData, index: NameIndex): PageDoc {
  const page: PageRef = { kind: "recap", quarter: q };
  const doc = emptyDoc(page, index.title(page), kindName("recap"));
  const r = recapOf(v, q);
  if (r?.companies.some((p) => p.estimated))
    doc.chips.push(span.colored("Companies that do not publish show estimate bands", "amber"));
  // Selectable by quarter: every recap kept, and this quarter's.
  const quarters = (v.recap?.recaps ?? []).map((x) => x.world.quarter);
  const clock = v.clock;
  const now = clock ? simDateQuarter(clock.date) : null;
  if (now && !quarters.some((x) => quarterEq(x, now))) quarters.push(now);
  doc.head.push(
    ...linkGroup(
      "Quarters",
      [...quarters].reverse().map((x): PageRef => ({ kind: "recap", quarter: x })),
      index,
    ),
  );
  if (!r) {
    // A quarter before the game has no recap tick on the clock (it starts 1 Jan 2020).
    const when = cmpQuarter(q, FIRST_QUARTER) >= 0 ? recapTick(q) : null;
    const text =
      when !== null && clock && cmpDateTime(when, clock.now) > 0
        ? `The ${formatQuarter(q)} recap opens in its pre-quarter-end week, on ${date(dateTimeDate(when))}.`
        : `No ${formatQuarter(q)} recap is kept (the last ${RECAP_QUARTERS} are).`;
    doc.head.push({ k: "line", spans: [span.muted(text)] });
    return doc;
  }
  const w = r.world;
  const facts: Span[] = [
    span.muted("Global phase"),
    span.colored(w.phase, "cyan"),
    span.muted("g_t"),
    span.colored(gain(w.g_t, "percent"), w.g_t >= 0 ? "gain" : "loss"),
    span.muted("Opened"),
    span.text(date(dateTimeDate(recapTick(q)))),
  ];
  const world: Block[] = [{ k: "line", spans: facts }];
  for (const [label, ids] of w.industries_by_label) {
    world.push(
      ...linkGroup(
        `${label} (${ids.length})`,
        ids.map((i): PageRef => ({ kind: "industry", id: i })),
        index,
      ),
    );
  }
  const expected = expectedTable(r, index);
  const watchlist = clock?.watchlist ?? [];
  const companies = companyPagesTable(r, watchlist, index);
  doc.sections = [
    { id: "world", blocks: world },
    {
      id: "beats",
      blocks:
        expected.rows.length === 0
          ? [{ k: "line", spans: [span.muted("No quoted company expects a beat or a miss.")] }]
          : [{ k: "table", table: expected }],
    },
    {
      id: "companies",
      blocks:
        companies.rows.length === 0
          ? [
              {
                k: "line",
                spans: [
                  span.muted(
                    "No watchlist company has a page: add companies to the watchlist (Pdoomberg F2, click a row) to see their pages.",
                  ),
                ],
              },
            ]
          : [{ k: "table", table: companies }],
    },
  ];
  return doc;
}

export const pages = [
  definePage({
    kind: "recap",
    // recap.rs read v_recap and v_industry_row, and the runner controls for the watchlist; the
    // watchlist and the clock are v_clock's here (D975). The doc is small, so following v_clock
    // at the page pace is cheap.
    views: ["recap", "industry_rows", "clock"],
    sections: SECTIONS,
    doc: (page, v, index) => recapDoc(page.quarter, v, index),
  }),
];
