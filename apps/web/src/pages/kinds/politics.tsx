// The US politics page (politics POC, D980 to D988; 4-politics 4.2.1): the executive, both chambers,
// the courts and every vote so far, from the politics view. Read only, like the rest of the MVP.
// Judges hear no cases yet; no law, lobbying or money runs through any of this.

import type { CourtRow, ElectionResult, Party, PoliticianRow, SimDate } from "@tc20ff/sim";
import type { NameIndex } from "../../links/names.ts";
import { type Cell, date } from "../../widgets/cells.ts";
import { type Block, emptyDoc, field, type PageDoc, type Span, span, type TableDoc } from "../doc.ts";
import { kindName, type PageRef } from "../ref.ts";
import type { SectionSpec } from "../sections.ts";
import { definePage } from "../spec.ts";
import type { ViewsData } from "../views.ts";

export const SECTIONS: readonly SectionSpec[] = [
  { id: "executive", title: "Executive" },
  { id: "legislature", title: "Legislature" },
  { id: "judiciary", title: "Judiciary" },
  { id: "elections", title: "Elections" },
];

const PAGE: PageRef = { kind: "politics" };
const dash: Cell = { k: "text", v: "-" };
/** Characters the seat bars are drawn in. */
const BAR_WIDTH = 30;

const PARTY_COLOR = { Democrats: "cyan", Republicans: "magenta" } as const;

const note = (text: string): Block => ({ k: "line", spans: [span.muted(text)] });

function partyLetter(p: Party): string {
  return p === "Democrats" ? "D" : "R";
}

/** Whole bar cells for a party's share of seats (rounded half up, UI only). */
function barSpans(seats: readonly [number, number]): Span[] {
  const total = seats[0] + seats[1];
  if (total === 0) return [];
  const dem = Math.round((seats[0] / total) * BAR_WIDTH);
  return [
    span.colored("█".repeat(dem), PARTY_COLOR.Democrats),
    span.colored("█".repeat(BAR_WIDTH - dem), PARTY_COLOR.Republicans),
  ];
}

function seatLine(label: string, seats: readonly [number, number]): Block {
  return {
    k: "line",
    spans: [span.text(`${label}: ${seats[0]} D, ${seats[1]} R  `), ...barSpans(seats)],
  };
}

function skillsText(r: PoliticianRow): string {
  const s = r.skills;
  return `${s.finance}/${s.operations}/${s.persuasion}/${s.intrigue}/${s.tech}/${s.hustle}`;
}

/** The columns every office table shares. */
const PERSON_COLUMNS = [
  { title: "Name", width: 180 },
  { title: "Party", width: 50 },
  { title: "Age", width: 45 },
  { title: "Ideology", width: 130 },
  { title: "Traits", width: 170 },
  { title: "Skills", width: 120, hint: "Finance, operations, persuasion, intrigue, tech, hustle" },
  { title: "Since", width: 96 },
];

function personCells(r: PoliticianRow): Cell[] {
  return [
    { k: "text", v: r.name },
    { k: "text", v: partyLetter(r.party) },
    { k: "int", v: r.age },
    { k: "text", v: r.ideology },
    { k: "text", v: r.traits.join(", ") },
    { k: "text", v: skillsText(r) },
    { k: "date", v: r.since },
  ];
}

export function executiveTable(rows: readonly PoliticianRow[]): TableDoc {
  return {
    id: "politics.executive",
    columns: [{ title: "Office", width: 280 }, ...PERSON_COLUMNS],
    rows: rows.map((r): Cell[] => [{ k: "text", v: r.title }, ...personCells(r)]),
  };
}

function chamberTable(id: string, rows: readonly PoliticianRow[], index: NameIndex): TableDoc {
  return {
    id,
    columns: [{ title: "Seat", width: 190 }, ...PERSON_COLUMNS, { title: "Home", width: 170 }],
    rows: rows.map((r): Cell[] => [
      { k: "text", v: r.title },
      ...personCells(r),
      r.province === null
        ? dash
        : {
            k: "link",
            text: index.title({ kind: "province", id: r.province }),
            page: { kind: "province", id: r.province },
          },
    ]),
  };
}

export function courtTable(c: CourtRow): TableDoc {
  return {
    id: `politics.court.${c.level}`,
    columns: [
      { title: "Bench", width: 240 },
      ...PERSON_COLUMNS,
      { title: "Integrity", width: 70, hint: "0 to 100 (4.21.1)" },
      { title: "Leaning", width: 80, hint: "Bias in cases between these sides (4.21.1)" },
    ],
    rows: c.judges.map((r): Cell[] => [
      { k: "text", v: r.title },
      ...personCells(r),
      r.integrity === null ? dash : { k: "int", v: r.integrity },
      { k: "text", v: r.leaning ?? "-" },
    ]),
  };
}

export function electionsTable(rows: readonly ElectionResult[]): TableDoc {
  return {
    id: "politics.elections",
    columns: [
      { title: "Date", width: 96 },
      { title: "President", width: 200 },
      { title: "Party", width: 50 },
      { title: "Vote", width: 70, hint: "Winner's share of the direct national vote (4.6.2)" },
      { title: "Beat", width: 180 },
      { title: "House", width: 90, hint: "Democrats, Republicans" },
      { title: "Senate", width: 90, hint: "Democrats, Republicans" },
      { title: "Class up", width: 60 },
    ],
    rows: rows.map((e): Cell[] => {
      const p = e.president;
      return [
        { k: "date", v: e.date },
        p === null ? { k: "text", v: "(midterm)" } : { k: "text", v: p.winner },
        p === null ? dash : { k: "text", v: partyLetter(p.party) },
        p === null ? dash : { k: "percent", v: p.party === "Democrats" ? p.shares[0] : p.shares[1] },
        p === null ? dash : { k: "text", v: p.loser },
        { k: "text", v: `${e.house[0]} D, ${e.house[1]} R` },
        { k: "text", v: `${e.senate[0]} D, ${e.senate[1]} R` },
        { k: "int", v: e.senate_class },
      ];
    }),
  };
}

function nextLine(next: SimDate | null, presidential: boolean, senateClass: number): string {
  if (next === null) return "-";
  const races = presidential ? "President, House" : "House";
  return `${date(next)}: ${races}, Senate class ${senateClass}`;
}

/** The whole page as data. */
export function politicsDoc(v: ViewsData, index: NameIndex): PageDoc {
  const doc = emptyDoc(PAGE, index.title(PAGE), kindName("politics"));
  const p = v.politics;
  if (!p?.active) {
    doc.head.push(note("No politics in this world."));
    return doc;
  }
  const pres = p.president;
  doc.head.push({
    k: "fields",
    fields: [
      field.text(
        "President",
        pres === null ? "-" : `${pres.name} (${partyLetter(pres.party)}), term ${p.president_terms}`,
      ),
      field.text("Next vote", nextLine(p.next_election, p.next_is_presidential, p.next_senate_class)),
    ],
  });
  const executive = [
    ...(pres === null ? [] : [pres]),
    ...(p.vice_president === null ? [] : [p.vice_president]),
    ...p.cabinet,
  ];
  doc.sections = [
    { id: "executive", blocks: [{ k: "table", table: executiveTable(executive) }] },
    {
      id: "legislature",
      blocks: [
        seatLine("House", p.house_seats),
        seatLine("Senate", p.senate_seats),
        { k: "heading", text: "Senate" },
        { k: "table", table: chamberTable("politics.senate", p.senate, index) },
        { k: "heading", text: "House" },
        { k: "table", table: chamberTable("politics.house", p.house, index) },
      ],
    },
    {
      id: "judiciary",
      blocks: [
        note("Judges are appointed and confirmed, but they hear no cases yet."),
        ...p.courts.flatMap((c): Block[] => [
          seatLine(`${c.level} (appointees)`, c.seats),
          { k: "table", table: courtTable(c) },
        ]),
      ],
    },
    {
      id: "elections",
      blocks:
        p.elections.length === 0
          ? [note("No vote yet: the first is November 2020.")]
          : [{ k: "table", table: electionsTable(p.elections) }],
    },
  ];
  return doc;
}

export const pages = [
  definePage({
    kind: "politics",
    views: ["politics", "countries", "places"],
    sections: SECTIONS,
    tabs: true,
    doc: (_page, v, index) => politicsDoc(v, index),
  }),
];
