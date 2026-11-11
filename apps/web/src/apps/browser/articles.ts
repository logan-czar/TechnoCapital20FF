// The encyclopedia's own articles (pivot 15.3, 5.7 to 5.11, 6, 7, 8.6; D1047): a page for each
// public entity the pivot names, written as data from the views and drawn by ArticleView.tsx, as the
// pages/ framework's docs are (pages/doc.ts), so a test reads what a page says without a DOM.
//
// Public facts only (pivot 5.11): a hidden stat (skills, traits, integrity, XP, a candidate's
// strength, a district's lean and gerrymander strength, an outlet's slant, a pollster's house
// effect) is shown only when the view carries it, which is only with the Omniscient debug toggle.
// A link to a thing another app shows better (the full bill record, the polls, the map) is a `Ref`
// to that app; every other link stays in this app.

import {
  type BillRow,
  type CandidateRow,
  type DistrictPlanRow,
  type DistrictRow,
  districtRefId,
  districtRefParts,
  type OutletRow,
  type Party,
  type PersonRow,
  type PollsterRow,
  type RaceRow,
  type UsMapState,
} from "@tc20ff/sim";
import { byId, byKey, type ViewsData } from "../../pages/views.ts";
import { formatDay, formatMargin, formatPct, formatUsd } from "../_shared/format.ts";
import { partyAdjective, partyLetter } from "../_shared/party.ts";
import { type ArticleKind, articleRoute, type IndexKind } from "./route.ts";

// ---------------------------------------------------------------- the model

/** A link: inside this app (`app` "browser") or to another app. */
export interface Ref {
  text: string;
  app: string;
  route: string | null;
  /** A person's party colours the link; undefined for no colour. */
  party?: Party | null;
}

/** A piece of a line. */
export type Inline = string | Ref;
/** A table cell: one piece or a run of them. */
export type TableCell = Inline | Inline[];

export interface Fact {
  label: string;
  value: Inline[];
}

export type ArticleBlock =
  | { k: "text"; spans: Inline[] }
  | { k: "muted"; text: string }
  | { k: "list"; items: Inline[][] }
  /** `rows[i][j]` is under `columns[j]`; a long table shows its first rows and a button for the rest. */
  | { k: "table"; id: string; columns: string[]; rows: TableCell[][] };

export interface ArticleSection {
  id: string;
  title: string;
  blocks: ArticleBlock[];
}

export interface Article {
  /** The route text it answers to (route.ts). */
  route: string | null;
  title: string;
  /** "Person", "Race": shown under the title. */
  kind: string;
  /** The lead sentence(s). */
  lead: Inline[];
  /** The infobox. */
  facts: Fact[];
  sections: ArticleSection[];
  /** Links to the same thing in other apps ("Open in Polls"). */
  elsewhere: Ref[];
}

/** An article for a route that has no entity behind it. */
export function noArticle(route: string | null, what: string): Article {
  return {
    route,
    title: "No article yet",
    kind: "Not found",
    lead: [`There is no article for ${what}. It may not exist, or this encyclopedia may not cover it.`],
    facts: [],
    sections: [],
    elsewhere: [],
  };
}

// ---------------------------------------------------------------- links

/** A link to an article of this app. */
export const here = (article: ArticleKind, id: number, text: string, party?: Party | null): Ref => ({
  text,
  app: "browser",
  route: articleRoute(article, id),
  ...(party === undefined ? {} : { party }),
});

/** A link to a route of this app. */
export const hereRoute = (route: string | null, text: string): Ref => ({ text, app: "browser", route });

/** A link to another app (`route` in its own grammar). */
export const elsewhere = (app: string, route: string | null, text: string): Ref => ({ text, app, route });

const NAME_UNKNOWN = "Unknown";

/** Name lookups over the views a builder was given. */
class Names {
  constructor(readonly v: ViewsData) {}
  person(id: number): PersonRow | undefined {
    return byId(this.v.people?.people, id);
  }
  state(id: number): UsMapState | undefined {
    return byId(this.v.usmap_layers?.states, id);
  }
  stateName(id: number): string {
    return this.state(id)?.name ?? NAME_UNKNOWN;
  }
  personRef(id: number): Ref {
    const p = this.person(id);
    return here("person", id, p?.name ?? NAME_UNKNOWN, p?.party ?? null);
  }
  stateRef(id: number): Ref {
    return here("state", id, this.stateName(id));
  }
  race(id: number): RaceRow | undefined {
    return byId(this.v.races?.races, id);
  }
  raceRef(id: number): Ref {
    return here("race", id, this.race(id)?.title ?? NAME_UNKNOWN);
  }
  bill(id: number): BillRow | undefined {
    return byId(this.v.records?.bills, id);
  }
  outlet(id: number): OutletRow | undefined {
    return byId(this.v.feed?.outlets, id);
  }
  pollster(id: number): PollsterRow | undefined {
    return byId(this.v.polls?.pollsters, id);
  }
  districtRef(state: number, number: number): Ref {
    return here("district", districtRefId(state as never, number), `${this.stateName(state)} ${number}`);
  }
  countyName(id: number): string {
    return this.v.usmap_layers?.counties.name[id] ?? NAME_UNKNOWN;
  }
}

/** "EffectiveAltruists" as "Effective Altruists". */
export function words(camel: string): string {
  return camel.replace(/([a-z])([A-Z])/g, "$1 $2");
}

const partyText = (p: Party | null): string => partyAdjective(p);

function personLead(p: PersonRow): string {
  const who = `${p.name} (${partyLetter(p.party)}) is a ${p.age}-year-old ${partyText(p.party)} politician`;
  switch (p.status) {
    case "InOffice":
      return `${who} who now holds the office of ${p.office ?? "an office"}.`;
    case "Candidate":
      return `${who} who is running for office.`;
    case "Retired":
      return `${who} who has left public life.`;
    case "Dead":
      return `${p.name} (${partyLetter(p.party)}), a ${partyText(p.party)} politician, has died.`;
    default:
      return `${who} who holds no office now.`;
  }
}

const STATUS_NAME: Readonly<Record<PersonRow["status"], string>> = {
  Bench: "Out of office",
  Candidate: "Candidate",
  InOffice: "In office",
  Retired: "Retired",
  Dead: "Dead",
};

const HOW_NAME = {
  Start: "Held at the start",
  Elected: "Elected",
  Special: "Special election",
  Appointed: "Appointed",
  Succeeded: "Succeeded",
} as const;

const EXIT_NAME = {
  TermEnded: "Term ended",
  Defeated: "Defeated",
  Retired: "Retired",
  Resigned: "Resigned",
  Died: "Died",
  Promoted: "Promoted",
  Removed: "Removed",
} as const;

const CANDIDATE_STATUS: Readonly<Record<CandidateRow["status"], string>> = {
  Running: "Running",
  DroppedOut: "Dropped out",
  LostPrimary: "Lost the primary",
  Nominee: "Nominee",
  Won: "Won",
  Lost: "Lost",
};

const RACE_STATUS: Readonly<Record<RaceRow["status"], string>> = {
  Filing: "Candidates filing",
  Primaries: "In the primaries",
  General: "General election",
  Counting: "Votes being counted",
  Recount: "In a recount",
  Certified: "Certified",
};

const BILL_STAGE = {
  Drafted: "Drafted",
  Committee: "In committee",
  HouseFloor: "On the House floor",
  SenateFloor: "On the Senate floor",
  Conference: "In conference",
  President: "With the president",
  Law: "Law",
  Dead: "Dead",
} as const;

const dayOf = formatDay;

// ---------------------------------------------------------------- person

/** Skills as the debug view prints them. */
function skillsText(s: NonNullable<PersonRow["skills"]>): string {
  return `Finance ${s.finance}, Operations ${s.operations}, Persuasion ${s.persuasion}, Intrigue ${s.intrigue}, Tech ${s.tech}, Hustle ${s.hustle}`;
}

/** Hidden facts, present only when the view carries them (Omniscient; pivot 5.11). */
export function hiddenFacts(p: PersonRow): Fact[] {
  const out: Fact[] = [];
  if (p.skills !== null) out.push({ label: "Skills", value: [skillsText(p.skills)] });
  if (p.traits !== null)
    out.push({ label: "Traits", value: [p.traits.length === 0 ? "none" : p.traits.join(", ")] });
  if (p.integrity !== null) out.push({ label: "Integrity", value: [String(p.integrity)] });
  if (p.xp !== null)
    out.push({ label: "Experience", value: [`${p.xp}${p.level === null ? "" : `, level ${p.level}`}`] });
  return out;
}

export function personArticle(id: number, v: ViewsData): Article {
  const n = new Names(v);
  const p = n.person(id);
  const route = articleRoute("person", id);
  if (p === undefined) return noArticle(route, "this person");
  const facts: Fact[] = [
    { label: "Age", value: [String(p.age)] },
    { label: "Party", value: [p.party === null ? "Independent" : p.party] },
    { label: "Ideology", value: [words(p.ideology)] },
    { label: "Home state", value: [n.stateRef(p.home_state)] },
    { label: "Status", value: [STATUS_NAME[p.status]] },
    { label: "Office", value: [p.office ?? "none"] },
  ];
  const sections: ArticleSection[] = [];
  if (p.career.length > 0) {
    sections.push({
      id: "career",
      title: "Offices held",
      blocks: [
        {
          k: "table",
          id: "person.career",
          columns: ["Office", "How", "From", "To", "Left"],
          rows: [...p.career]
            .reverse()
            .map((c) => [
              c.title,
              HOW_NAME[c.how],
              dayOf(c.from),
              c.to === null ? "now" : dayOf(c.to),
              c.exit === null ? "-" : EXIT_NAME[c.exit],
            ]),
        },
      ],
    });
  }
  const runs = (v.races?.races ?? []).flatMap((r) => {
    const c = r.candidates.find((x) => x.person === id);
    return c === undefined ? [] : [{ r, c }];
  });
  if (runs.length > 0) {
    const showStrength = runs.some(({ c }) => c.strength !== null);
    sections.push({
      id: "elections",
      title: "Elections",
      blocks: [
        {
          k: "table",
          id: "person.elections",
          columns: [
            "Race",
            "Election day",
            "Result",
            "Votes",
            "Raised",
            "Cash on hand",
            ...(showStrength ? ["Campaign strength"] : []),
          ],
          rows: runs.map(({ r, c }) => {
            const ret = byKey(v.returns?.races, (x) => x.race, r.id);
            const votes = ret?.votes.find((x) => x.person === id)?.votes;
            const total = ret?.votes.reduce((s, x) => s + x.votes, 0) ?? 0;
            return [
              n.raceRef(r.id),
              dayOf(r.general),
              CANDIDATE_STATUS[c.status] + (c.incumbent ? " (incumbent)" : ""),
              votes === undefined || total === 0
                ? "-"
                : `${votes.toLocaleString("en-US")} (${formatPct(votes / total)})`,
              c.raised === null ? "-" : formatUsd(c.raised),
              c.cash === null ? "-" : formatUsd(c.cash),
              ...(showStrength ? [c.strength === null ? "-" : c.strength.toFixed(1)] : []),
            ];
          }),
        },
      ],
    });
  }
  const bills = (v.records?.bills ?? []).filter((b) => b.sponsor === id);
  if (bills.length > 0) {
    sections.push({
      id: "bills",
      title: "Bills sponsored",
      blocks: [
        {
          k: "table",
          id: "person.bills",
          columns: ["Bill", "Stage", "Last action"],
          rows: bills.map((b) => [here("bill", b.id, b.title), BILL_STAGE[b.stage], dayOf(b.last_action)]),
        },
      ],
    });
  }
  const hidden = hiddenFacts(p);
  if (hidden.length > 0) {
    sections.push({
      id: "hidden",
      title: "Hidden stats (debug)",
      blocks: [
        { k: "muted", text: "Shown only with the Omniscient debug toggle; the game never publishes these." },
        { k: "list", items: hidden.map((f) => [`${f.label}: `, ...f.value]) },
      ],
    });
  }
  return {
    route,
    title: p.name,
    kind: "Person",
    lead: [personLead(p)],
    facts,
    sections,
    elsewhere: [elsewhere("social", `person/${id}`, "Posts about them on Social")],
  };
}

// ---------------------------------------------------------------- race

export function raceArticle(id: number, v: ViewsData): Article {
  const n = new Names(v);
  const r = n.race(id);
  const route = articleRoute("race", id);
  if (r === undefined) return noArticle(route, "this race");
  const facts: Fact[] = [
    { label: "Office", value: [r.office + (r.special ? " (special election)" : "")] },
    { label: "Status", value: [RACE_STATUS[r.status]] },
    { label: "Election day", value: [dayOf(r.general)] },
    { label: "Certified by", value: [dayOf(r.certify)] },
    { label: "Seat now held by", value: [r.incumbent_party === null ? "no party" : r.incumbent_party] },
  ];
  if (r.state !== null) facts.splice(1, 0, { label: "State", value: [n.stateRef(r.state)] });
  if (r.state !== null && r.district !== null)
    facts.splice(2, 0, { label: "District", value: [n.districtRef(r.state, r.district)] });
  if (r.senate_class !== null) facts.push({ label: "Senate class", value: [String(r.senate_class)] });
  if (r.electoral_votes !== null)
    facts.push({ label: "Electoral votes to win", value: [String(r.electoral_votes)] });
  const ret = byKey(v.returns?.races, (x) => x.race, r.id);
  const total = ret?.votes.reduce((s, x) => s + x.votes, 0) ?? 0;
  const showStrength = r.candidates.some((c) => c.strength !== null);
  const sections: ArticleSection[] = [
    {
      id: "candidates",
      title: "Candidates",
      blocks:
        r.candidates.length === 0
          ? [{ k: "muted", text: "No candidate has filed." }]
          : [
              {
                k: "table",
                id: "race.candidates",
                columns: [
                  "Candidate",
                  "Party",
                  "Status",
                  "Votes",
                  "Raised",
                  "Cash on hand",
                  ...(showStrength ? ["Campaign strength"] : []),
                ],
                rows: r.candidates.map((c) => {
                  const votes = ret?.votes.find((x) => x.person === c.person)?.votes;
                  return [
                    n.personRef(c.person),
                    c.party === null ? "Independent" : c.party,
                    CANDIDATE_STATUS[c.status] + (c.incumbent ? " (incumbent)" : ""),
                    votes === undefined || total === 0
                      ? "-"
                      : `${votes.toLocaleString("en-US")} (${formatPct(votes / total)})`,
                    c.raised === null ? "-" : formatUsd(c.raised),
                    c.cash === null ? "-" : formatUsd(c.cash),
                    ...(showStrength ? [c.strength === null ? "-" : c.strength.toFixed(1)] : []),
                  ];
                }),
              },
            ],
    },
  ];
  if (r.primaries.length > 0) {
    sections.push({
      id: "primaries",
      title: "Primaries",
      blocks: [
        {
          k: "table",
          id: "race.primaries",
          columns: ["Party", "Date", "Ballot", "Winner"],
          rows: r.primaries.map((p) => [
            p.party,
            dayOf(p.date),
            p.ballot.flatMap((pid, i): Inline[] => (i === 0 ? [n.personRef(pid)] : [", ", n.personRef(pid)])),
            p.winner === null ? "-" : n.personRef(p.winner),
          ]),
        },
      ],
    });
  }
  const result: ArticleBlock[] = [];
  if (r.winner !== null) result.push({ k: "text", spans: ["Winner: ", n.personRef(r.winner)] });
  if (ret !== undefined && ret.calls.length > 0) {
    result.push({
      k: "list",
      items: ret.calls.map((c) => [
        here("outlet", c.outlet, n.outlet(c.outlet)?.name ?? NAME_UNKNOWN),
        ` called it for `,
        n.personRef(c.person),
        c.retracted ? " (retracted)" : "",
      ]),
    });
  }
  if (ret?.recount) result.push({ k: "muted", text: "A recount is under way." });
  if (ret?.certified != null) result.push({ k: "muted", text: `Certified ${dayOf(ret.certified)}.` });
  if (result.length > 0) sections.push({ id: "result", title: "Result", blocks: result });
  return {
    route,
    title: r.title,
    kind: "Race",
    lead: [
      `${r.title} is ${r.special ? "a special election" : "an election"} for ${r.office}, set for ${dayOf(r.general)}.`,
    ],
    facts,
    sections,
    elsewhere: [
      elsewhere("polls", `race/${id}`, "Polls and forecast"),
      ...(r.state === null ? [] : [elsewhere("usmap", `state/${r.state}`, "On the map")]),
    ],
  };
}

// ---------------------------------------------------------------- bill (brief: the full record is the records app's)

/** How many of a bill's latest actions its article lists. */
export const BILL_ACTIONS_SHOWN = 5;

export function billArticle(id: number, v: ViewsData): Article {
  const n = new Names(v);
  const b = n.bill(id);
  const route = articleRoute("bill", id);
  if (b === undefined) return noArticle(route, "this bill");
  const actions = b.actions.slice(-BILL_ACTIONS_SHOWN).reverse();
  return {
    route,
    title: b.title,
    kind: "Bill",
    lead: [b.summary],
    facts: [
      { label: "Sponsor", value: [n.personRef(b.sponsor)] },
      { label: "Subject", value: [b.subject] },
      { label: "Introduced", value: [`${b.chamber_of_origin}, ${dayOf(b.introduced)}`] },
      { label: "Stage", value: [BILL_STAGE[b.stage]] },
      { label: "Last action", value: [dayOf(b.last_action)] },
      { label: "In effect", value: [b.effective === null ? "not yet" : dayOf(b.effective)] },
    ],
    sections: [
      {
        id: "actions",
        title: `Latest actions (${actions.length} of ${b.actions.length})`,
        blocks:
          actions.length === 0
            ? [{ k: "muted", text: "No action yet." }]
            : [
                {
                  k: "table",
                  id: "bill.actions",
                  columns: ["Date", "Action"],
                  rows: actions.map((a) => [dayOf(a.date), a.text]),
                },
              ],
      },
    ],
    elsewhere: [elsewhere("records", `bill/${id}`, "The full record, with roll calls")],
  };
}

// ---------------------------------------------------------------- state, county, district

/** The officials of a state: those whose office is named for it (a governor, a senator, a member). */
export function officialsOf(v: ViewsData, stateName: string): PersonRow[] {
  return (v.people?.people ?? [])
    .filter((p) => p.status === "InOffice" && p.office !== null && p.office.includes(stateName))
    .sort((a, b) =>
      (a.office as string) < (b.office as string)
        ? -1
        : (a.office as string) > (b.office as string)
          ? 1
          : a.id - b.id,
    );
}

export function stateArticle(id: number, v: ViewsData): Article {
  const n = new Names(v);
  const s = n.state(id);
  const route = articleRoute("state", id);
  if (s === undefined) return noArticle(route, "this state");
  const facts: Fact[] = [
    { label: "Population", value: [s.population.toLocaleString("en-US")] },
    { label: "House seats", value: [String(s.house_seats)] },
    { label: "Electoral votes", value: [String(s.electoral_votes)] },
    { label: "Governor's party", value: [s.governor === null ? "-" : s.governor] },
    {
      label: "Last presidential result",
      value: [
        s.last_winner === null || s.last_margin === null
          ? "none yet"
          : `${s.last_winner}, ${formatMargin(s.last_margin)}`,
      ],
    },
  ];
  const sections: ArticleSection[] = [];
  const officials = officialsOf(v, s.name);
  sections.push({
    id: "officials",
    title: "Officials",
    blocks:
      officials.length === 0
        ? [{ k: "muted", text: "No official is listed." }]
        : [
            {
              k: "table",
              id: "state.officials",
              columns: ["Office", "Holder", "Party"],
              rows: officials.map((p) => [
                p.office ?? "",
                here("person", p.id, p.name, p.party),
                p.party ?? "Independent",
              ]),
            },
          ],
  });
  const districts = (v.districts?.districts ?? []).filter((d) => d.state === id);
  if (districts.length > 0) {
    sections.push({
      id: "districts",
      title: "House districts",
      blocks: [
        {
          k: "table",
          id: "state.districts",
          columns: ["District", "People", "Member"],
          rows: districts.map((d) => [
            n.districtRef(id, d.number),
            d.population.toLocaleString("en-US"),
            d.member === null ? "vacant" : n.personRef(d.member),
          ]),
        },
      ],
    });
  }
  const races = (v.races?.races ?? []).filter((r) => r.state === id);
  if (races.length > 0) {
    sections.push({
      id: "races",
      title: "Elections",
      blocks: [
        {
          k: "table",
          id: "state.races",
          columns: ["Race", "Status", "Election day", "Winner"],
          rows: races.map((r) => [
            n.raceRef(r.id),
            RACE_STATUS[r.status],
            dayOf(r.general),
            r.winner === null ? "-" : n.personRef(r.winner),
          ]),
        },
      ],
    });
  }
  const pres = (v.returns?.races ?? []).flatMap((r) =>
    (r.states ?? []).filter((x) => x.state === id).map((x) => ({ r, x })),
  );
  if (pres.length > 0) {
    sections.push({
      id: "results",
      title: "Recent presidential results",
      blocks: pres.map(({ r, x }) => ({
        k: "text" as const,
        spans: [
          n.raceRef(r.race),
          ": ",
          ...(x.called === null ? ["not called"] : ["called for ", n.personRef(x.called)]),
          `, ${formatPct(x.reporting)} reporting`,
        ],
      })),
    });
  }
  const c = v.usmap_layers?.counties;
  const counties = c === undefined ? [] : c.state.flatMap((st, i) => (st === id ? [i] : []));
  if (c !== undefined && counties.length > 0) {
    sections.push({
      id: "counties",
      title: `Counties (${counties.length})`,
      blocks: [
        {
          k: "table",
          id: "state.counties",
          columns: ["County", "People", "Last presidential vote"],
          rows: counties.map((i) => [
            here("county", i, c.name[i] ?? NAME_UNKNOWN),
            (c.population[i] ?? 0).toLocaleString("en-US"),
            c.last_winner[i] == null || c.last_margin[i] == null
              ? "-"
              : `${c.last_winner[i]}, ${formatMargin(c.last_margin[i] as number)}`,
          ]),
        },
      ],
    });
  }
  return {
    route,
    title: s.name,
    kind: "State",
    lead: [
      `${s.name} sends ${s.house_seats} ${s.house_seats === 1 ? "member" : "members"} to the House and has ${s.electoral_votes} electoral votes.`,
    ],
    facts,
    sections,
    elsewhere: [elsewhere("usmap", `state/${id}`, "Open on the map")],
  };
}

export function countyArticle(id: number, v: ViewsData): Article {
  const n = new Names(v);
  const c = v.usmap_layers?.counties;
  const route = articleRoute("county", id);
  if (c === undefined || id >= c.fips.length) return noArticle(route, "this county");
  const state = c.state[id] as number;
  const name = c.name[id] as string;
  const facts: Fact[] = [
    { label: "State", value: [n.stateRef(state)] },
    { label: "FIPS code", value: [c.fips[id] as string] },
    { label: "Population", value: [(c.population[id] ?? 0).toLocaleString("en-US")] },
    { label: "Turnout", value: [formatPct(c.turnout[id] ?? 0)] },
  ];
  const dist = c.district[id] ?? 0;
  if (dist > 0) facts.push({ label: "Largest share in district", value: [n.districtRef(state, dist)] });
  const winner = c.last_winner[id];
  const margin = c.last_margin[id];
  facts.push({
    label: "Last presidential vote",
    value: [
      winner == null || margin == null
        ? "none yet"
        : `${winner}, ${formatMargin(margin)} (${(c.last_votes[id] ?? 0).toLocaleString("en-US")} votes)`,
    ],
  });
  if (c.lean !== null) facts.push({ label: "True lean (debug)", value: [formatMargin(c.lean[id] ?? 0)] });
  return {
    route,
    title: name,
    kind: "County",
    lead: [`${name} is a county of ${n.stateName(state)}.`],
    facts,
    sections: [],
    elsewhere: [elsewhere("usmap", `county/${id}`, "Open on the map")],
  };
}

export function districtArticle(id: number, v: ViewsData): Article {
  const n = new Names(v);
  const route = articleRoute("district", id);
  const d: DistrictRow | undefined = byId(v.districts?.districts, id);
  if (d === undefined) return noArticle(route, "this district");
  const plan: DistrictPlanRow | undefined = byKey(v.districts?.plans, (p) => p.state, d.state);
  const title = `${n.stateName(d.state)} ${d.number}`;
  const facts: Fact[] = [
    { label: "State", value: [n.stateRef(d.state)] },
    { label: "People", value: [d.population.toLocaleString("en-US")] },
    { label: "Member", value: [d.member === null ? "vacant" : n.personRef(d.member)] },
  ];
  if (plan !== undefined) {
    facts.push({
      label: "Map drawn",
      value: [`${plan.census_year} census, in force since ${dayOf(plan.since)}`],
    });
    facts.push({ label: "Drawn by", value: [plan.drawn_by === null ? "no party" : plan.drawn_by] });
    if (plan.struck)
      facts.push({ label: "Court ruling", value: ["The map has been struck down; a redraw is pending."] });
    if (plan.strength !== null)
      facts.push({ label: "Gerrymander strength (debug)", value: [plan.strength.toFixed(2)] });
  }
  if (d.lean !== null) facts.push({ label: "Mean lean (debug)", value: [formatMargin(d.lean)] });
  return {
    route,
    title,
    kind: "House district",
    lead: [`${title} is a district of the House of Representatives in ${n.stateName(d.state)}.`],
    facts,
    sections: [
      {
        id: "counties",
        title: "Counties",
        blocks: [
          {
            k: "table",
            id: "district.counties",
            columns: ["County", "Share in the district"],
            rows: d.shares.map((s) => [
              here("county", s.county, n.countyName(s.county)),
              s.from === 0 && s.to === 1 ? "whole" : formatPct(s.to - s.from),
            ]),
          },
        ],
      },
    ],
    elsewhere: [elsewhere("usmap", `district/${id}`, "Open on the map")],
  };
}

/** The number a district ref id holds (re-exported for the tests and search). */
export const districtParts = districtRefParts;

// ---------------------------------------------------------------- outlet and pollster

/** How many recent items an outlet's or a pollster's article lists. */
export const RECENT_SHOWN = 8;

export function outletArticle(id: number, v: ViewsData): Article {
  const n = new Names(v);
  const o = n.outlet(id);
  const route = articleRoute("outlet", id);
  if (o === undefined) return noArticle(route, "this outlet");
  const facts: Fact[] = [{ label: "Kind", value: [o.kind] }];
  if (o.state !== null) facts.push({ label: "State", value: [n.stateRef(o.state)] });
  if (o.slant !== null) facts.push({ label: "Slant (debug)", value: [formatMargin(o.slant)] });
  if (o.reliability !== null) facts.push({ label: "Reliability (debug)", value: [formatPct(o.reliability)] });
  const recent = (v.feed?.articles ?? [])
    .filter((a) => a.outlet === id)
    .slice(-RECENT_SHOWN)
    .reverse();
  return {
    route,
    title: o.name,
    kind: "News outlet",
    lead: [`${o.name} is a ${o.kind.toLowerCase()} news outlet.`],
    facts,
    sections:
      recent.length === 0
        ? []
        : [
            {
              id: "recent",
              title: "Recent headlines",
              blocks: [{ k: "list", items: recent.map((a) => [`${a.headline}`]) }],
            },
          ],
    elsewhere: [elsewhere("news", `outlet/${id}`, "Read it in News")],
  };
}

export function pollsterArticle(id: number, v: ViewsData): Article {
  const n = new Names(v);
  const p = n.pollster(id);
  const route = articleRoute("pollster", id);
  if (p === undefined) return noArticle(route, "this polling firm");
  const polls = (v.polls?.polls ?? []).filter((x) => x.pollster === id);
  const facts: Fact[] = [{ label: "Polls published", value: [String(polls.length)] }];
  if (p.house_effect !== null)
    facts.push({ label: "House effect (debug)", value: [formatMargin(p.house_effect)] });
  return {
    route,
    title: p.name,
    kind: "Polling firm",
    lead: [`${p.name} is a polling firm.`],
    facts,
    sections:
      polls.length === 0
        ? []
        : [
            {
              id: "recent",
              title: "Recent polls",
              blocks: [
                {
                  k: "table",
                  id: "pollster.polls",
                  columns: ["Published", "Race", "Sample", "Margin of error"],
                  rows: polls
                    .slice(-RECENT_SHOWN)
                    .reverse()
                    .map((x) => [
                      dayOf(x.published),
                      n.raceRef(x.race),
                      x.sample.toLocaleString("en-US"),
                      `${x.margin_of_error.toFixed(1)} points`,
                    ]),
                },
              ],
            },
          ],
    elsewhere: [elsewhere("polls", `pollster/${id}`, "Its polls in Polls")],
  };
}

// ---------------------------------------------------------------- the index pages

/** The views each article kind reads. */
export const ARTICLE_VIEWS: Readonly<Record<ArticleKind, readonly (keyof ViewsData)[]>> = {
  person: ["people", "usmap_layers", "races", "returns", "records"],
  race: ["races", "people", "usmap_layers", "returns", "feed"],
  bill: ["records", "people"],
  state: ["usmap_layers", "people", "districts", "races", "returns"],
  county: ["usmap_layers", "districts"],
  district: ["districts", "usmap_layers", "people"],
  outlet: ["feed", "usmap_layers"],
  pollster: ["polls", "races"],
};

/** The views an index page reads. */
export const INDEX_VIEWS: Readonly<Record<IndexKind, readonly (keyof ViewsData)[]>> = {
  people: ["people", "usmap_layers"],
  states: ["usmap_layers"],
  races: ["races", "usmap_layers"],
  bills: ["records", "people"],
  outlets: ["feed", "usmap_layers"],
  pollsters: ["polls"],
};

const INDEX_TITLE: Readonly<Record<IndexKind, string>> = {
  people: "People in politics",
  states: "States",
  races: "Elections",
  bills: "Bills",
  outlets: "News outlets",
  pollsters: "Polling firms",
};

export function indexArticle(list: IndexKind, v: ViewsData): Article {
  const n = new Names(v);
  let columns: string[] = [];
  let rows: Inline[][] = [];
  switch (list) {
    case "people":
      columns = ["Name", "Party", "Office", "Home state", "Age"];
      rows = (v.people?.people ?? []).map((p) => [
        here("person", p.id, p.name, p.party),
        partyLetter(p.party),
        p.office ?? STATUS_NAME[p.status],
        n.stateRef(p.home_state),
        String(p.age),
      ]);
      break;
    case "states":
      columns = ["State", "People", "House seats", "Electoral votes"];
      rows = (v.usmap_layers?.states ?? []).map((s) => [
        here("state", s.id, s.name),
        s.population.toLocaleString("en-US"),
        String(s.house_seats),
        String(s.electoral_votes),
      ]);
      break;
    case "races":
      columns = ["Race", "Status", "Election day"];
      rows = (v.races?.races ?? []).map((r) => [
        here("race", r.id, r.title),
        RACE_STATUS[r.status],
        dayOf(r.general),
      ]);
      break;
    case "bills":
      columns = ["Bill", "Sponsor", "Stage", "Last action"];
      rows = (v.records?.bills ?? []).map((b) => [
        here("bill", b.id, b.title),
        n.personRef(b.sponsor),
        BILL_STAGE[b.stage],
        dayOf(b.last_action),
      ]);
      break;
    case "outlets":
      columns = ["Outlet", "Kind", "State"];
      rows = (v.feed?.outlets ?? []).map((o) => [
        here("outlet", o.id, o.name),
        o.kind,
        o.state === null ? "-" : n.stateRef(o.state),
      ]);
      break;
    case "pollsters":
      columns = ["Polling firm"];
      rows = (v.polls?.pollsters ?? []).map((p) => [here("pollster", p.id, p.name)]);
      break;
  }
  return {
    route: list,
    title: INDEX_TITLE[list],
    kind: "Index",
    lead: [`${rows.length} ${rows.length === 1 ? "entry" : "entries"}.`],
    facts: [],
    sections: [
      { id: list, title: INDEX_TITLE[list], blocks: [{ k: "table", id: `index.${list}`, columns, rows }] },
    ],
    elsewhere: [],
  };
}

// ---------------------------------------------------------------- home

export const HOME_VIEWS: readonly (keyof ViewsData)[] = ["people", "races", "clock", "usmap_layers"];

/** How many upcoming elections the home page lists. */
export const HOME_RACES_SHOWN = 6;

export function homeArticle(v: ViewsData): Article {
  const n = new Names(v);
  const holders = (office: string) =>
    (v.people?.people ?? []).filter((p) => p.status === "InOffice" && p.office === office);
  const key: Fact[] = [];
  for (const office of ["President", "Vice President"]) {
    const h = holders(office)[0];
    if (h !== undefined) key.push({ label: office, value: [n.personRef(h.id)] });
  }
  const today = v.clock?.date;
  const open = (v.races?.races ?? [])
    .filter((r) => r.status !== "Certified")
    .sort(
      (a, b) =>
        a.general.year - b.general.year ||
        a.general.month - b.general.month ||
        a.general.day - b.general.day ||
        a.id - b.id,
    )
    .slice(0, HOME_RACES_SHOWN);
  return {
    route: null,
    title: "Almanac",
    kind: "The public record",
    lead: [
      "Who holds office, who is running, what the law says and who owns what: the facts anyone may look up.",
      today === undefined ? "" : ` Today is ${dayOf(today)}.`,
    ].filter((s) => s !== ""),
    facts: key,
    sections: [
      {
        id: "browse",
        title: "Browse",
        blocks: [
          {
            k: "list",
            items: [
              [hereRoute("people", "People in politics")],
              [hereRoute("states", "States")],
              [hereRoute("races", "Elections")],
              [hereRoute("bills", "Bills")],
              [hereRoute("outlets", "News outlets")],
              [hereRoute("pollsters", "Polling firms")],
              [hereRoute("companies", "Companies")],
              [hereRoute("industries", "Industries")],
              [hereRoute("exchanges", "Stock exchanges")],
              [hereRoute("world-history", "History of the world so far")],
            ],
          },
        ],
      },
      ...(open.length === 0
        ? []
        : [
            {
              id: "upcoming",
              title: "Coming elections",
              blocks: [
                {
                  k: "table" as const,
                  id: "home.races",
                  columns: ["Race", "Status", "Election day"],
                  rows: open.map((r): Inline[] => [
                    here("race", r.id, r.title),
                    RACE_STATUS[r.status],
                    dayOf(r.general),
                  ]),
                },
              ],
            },
          ]),
    ],
    elsewhere: [],
  };
}

// ---------------------------------------------------------------- dispatch

/** The article a route names, built from the views. */
export function buildArticle(kind: ArticleKind, id: number, v: ViewsData): Article {
  switch (kind) {
    case "person":
      return personArticle(id, v);
    case "race":
      return raceArticle(id, v);
    case "bill":
      return billArticle(id, v);
    case "state":
      return stateArticle(id, v);
    case "county":
      return countyArticle(id, v);
    case "district":
      return districtArticle(id, v);
    case "outlet":
      return outletArticle(id, v);
    case "pollster":
      return pollsterArticle(id, v);
  }
}

/** True when `text` is a string inline. */
export const isRef = (i: Inline): i is Ref => typeof i !== "string";
/** The plain text of a line of inlines. */
export const inlineText = (line: readonly Inline[]): string =>
  line.map((i) => (typeof i === "string" ? i : i.text)).join("");
