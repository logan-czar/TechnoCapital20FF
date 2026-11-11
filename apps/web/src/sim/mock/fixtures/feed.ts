// The mock's press (v_feed; pivot 8.2, 8.7, 8.8): a wire, five national outlets across the
// spectrum and a regional paper per state, each with a slant and a reliability, the articles they
// publish and each one's morning front page. The text is written here from small templates, a
// stand-in for the offline template bank of pivot 8.7.

import {
  type Article,
  type ArticleKind,
  type ArticleSource,
  type DateTime,
  dateTimeDate,
  type EntityRef,
  type FeedView,
  type FrontPage,
  type OutletId,
  type OutletKind,
  type Party,
  type SimDate,
} from "@tc20ff/sim";
import type { MockGeo } from "./geo.ts";
import type { MockRng } from "./rng.ts";

/** name, slant in points toward party A, reliability. The first is the wire. */
const NATIONAL_TABLE: readonly (readonly [string, OutletKind, number, number])[] = [
  ["Continental Wire", "Wire", 0, 0.96],
  ["The Meridian Post", "National", 12, 0.86],
  ["Liberty Ledger", "National", -14, 0.8],
  ["The Daily Circuit", "National", 3, 0.9],
  ["Hardline Dispatch", "National", -26, 0.55],
  ["Neon Tribune", "National", 21, 0.45],
];
const REGIONAL_NAMES = ["Sentinel", "Courier", "Register", "Standard", "Observer", "Gazette"];

/** Outlet ids the script names. */
export const OUTLET = {
  wire: 0 as OutletId,
  /** The least reliable national: it runs the false rumour and makes the wrong call. */
  careless: 5 as OutletId,
} as const;

/** A slant past this many points frames a story for its side. */
const SLANT_SPIN = 8;
/** Stories on a front page (pivot 8.8). */
const FRONT_PAGE_STORIES = 5;

export interface MockOutlet {
  id: OutletId;
  name: string;
  kind: OutletKind;
  /** `MockState.idx` of a regional paper. */
  state: number | null;
  /** Hidden (pivot 8.1). */
  slant: number;
  reliability: number;
}

export interface FeedState {
  outlets: MockOutlet[];
  articles: Article[];
  /** By outlet id; null until the outlet has published. */
  front_pages: (FrontPage | null)[];
  /** Every front page so far, oldest first: the `front_pages` slice by date (D1037). */
  archive: FrontPage[];
}

/** What an article says, before an outlet prints it. */
export interface Story {
  headline: string;
  body: string;
  refs: EntityRef[];
  /** What kind of article it makes (D1037); a report when absent. */
  kind?: ArticleKind;
  /** The article or post it follows. */
  source?: ArticleSource;
}

export function genFeed(geo: MockGeo, rng: MockRng): FeedState {
  const outlets: MockOutlet[] = NATIONAL_TABLE.map(([name, kind, slant, reliability], i) => ({
    id: i as OutletId,
    name,
    kind,
    state: null,
    slant: slant === 0 ? 0 : slant + 2 * rng.normal(),
    reliability,
  }));
  for (const st of geo.states) {
    outlets.push({
      id: outlets.length as OutletId,
      name: `${st.name} ${rng.pick(REGIONAL_NAMES)}`,
      kind: "Regional",
      state: st.idx,
      slant: st.lean * 0.3 + 4 * rng.normal(),
      reliability: rng.range(0.7, 0.9),
    });
  }
  return { outlets, articles: [], front_pages: outlets.map(() => null), archive: [] };
}

/** The regional paper of a state. */
export function regionalOf(fs: FeedState, state: number): MockOutlet {
  return fs.outlets.find((o) => o.state === state) as MockOutlet;
}

/** How an outlet frames news that is good for `party`: 1 warmly, -1 coldly, 0 straight (pivot 8.2). */
export function spin(o: MockOutlet, party: Party | null): -1 | 0 | 1 {
  if (party === null || Math.abs(o.slant) < SLANT_SPIN) return 0;
  return o.slant > 0 === (party === "Democrats") ? 1 : -1;
}

export function publish(
  fs: FeedState,
  t: DateTime,
  outlet: OutletId,
  s: Story,
  unconfirmed = false,
): Article {
  const a: Article = {
    id: fs.articles.length,
    time: t,
    outlet,
    kind: s.kind ?? "Report",
    source: s.source ?? null,
    headline: s.headline,
    body: s.body,
    refs: s.refs,
    unconfirmed,
    corrected: false,
  };
  fs.articles.push(a);
  return a;
}

/** Marks an article corrected (pivot 8.2): the row is replaced, never changed in place. */
export function correct(fs: FeedState, id: number, note: string): void {
  const a = fs.articles[id] as Article;
  fs.articles[id] = { ...a, corrected: true, body: `${a.body} Correction: ${note}` };
}

/** Each outlet ranks the past day's stories (pivot 8.8): its own, the longest first as a stand-in for weight. */
export function rankFrontPages(fs: FeedState, t: DateTime): void {
  const since = t - 24;
  const mine: number[][] = fs.outlets.map(() => []);
  for (let i = fs.articles.length - 1; i >= 0; i--) {
    const a = fs.articles[i] as Article;
    if (a.time < since) break;
    (mine[a.outlet] as number[]).push(a.id);
  }
  fs.outlets.forEach((o) => {
    const ids = mine[o.id] as number[];
    if (ids.length === 0) return;
    ids.sort(
      (x, y) => (fs.articles[y] as Article).body.length - (fs.articles[x] as Article).body.length || x - y,
    );
    const page: FrontPage = {
      outlet: o.id,
      date: dateTimeDate(t),
      articles: ids.slice(0, FRONT_PAGE_STORIES),
    };
    fs.front_pages[o.id] = page;
    fs.archive.push(page);
  });
}

/** Every outlet's front page of `date`, in outlet id order: the `front_pages` slice (D1037). */
export function frontPagesOf(fs: FeedState, date: SimDate): FrontPage[] {
  return fs.archive.filter(
    (p) => p.date.year === date.year && p.date.month === date.month && p.date.day === date.day,
  );
}

/** v_feed: slant and reliability only for Omniscient (pivot 8.1). */
export function feedView(fs: FeedState, geo: MockGeo, omniscient: boolean): FeedView {
  return {
    outlets: fs.outlets.map((o) => ({
      id: o.id,
      name: o.name,
      kind: o.kind,
      state: o.state === null ? null : (geo.states[o.state]?.id ?? null),
      slant: omniscient ? o.slant : null,
      reliability: omniscient ? o.reliability : null,
    })),
    articles: fs.articles.slice(),
    front_pages: fs.front_pages.filter((p): p is FrontPage => p !== null),
  };
}

// ---------------------------------------------------------------- the stories

const pts = (m: number) => `${Math.abs(m).toFixed(1)} points`;
const money = (usd: number) =>
  usd >= 1e6 ? `$${(usd / 1e6).toFixed(1)} million` : `$${Math.floor(usd / 1000)},000`;
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
/** 12345 as "12,345", with no locale. */
export const thousands = (n: number) => String(Math.floor(n)).replace(/\B(?=(\d{3})+$)/g, ",");

/** The templates. `tone` is the outlet's `spin` toward whoever the news is good for. */
export const STORY = {
  poll(
    tone: number,
    firm: string,
    race: string,
    leader: string,
    trailer: string,
    margin: number,
    sample: number,
    refs: EntityRef[],
  ): Story {
    const tight = Math.abs(margin) < 2;
    const headline = tight
      ? `${race}: ${leader} and ${trailer} neck and neck, ${firm} finds`
      : tone > 0
        ? `${leader} pulls ahead in ${race}, new ${firm} poll shows`
        : tone < 0
          ? `${trailer} within reach in ${race} despite ${firm} numbers`
          : `${firm}: ${leader} leads ${trailer} by ${pts(margin)} in ${race}`;
    return {
      headline,
      body: `A ${firm} survey of ${thousands(sample)} likely voters puts ${leader} ${pts(margin)} ahead of ${trailer} in the race for ${race}. ${
        tone < 0
          ? "The firm's past surveys have drawn criticism for their turnout assumptions, and the trailing campaign called the race wide open."
          : tight
            ? "The gap is inside the margin of error, and both campaigns claimed momentum."
            : "The lead is outside the poll's margin of error."
      }`,
      refs,
    };
  },
  forecast(leaderParty: Party, chance: number, refs: EntityRef[]): Story {
    return {
      kind: "Analysis",
      headline: `Forecast gives ${leaderParty} a ${pct(chance)} chance at the presidency`,
      body: `The public forecast model, which blends published polls with each state's past vote, now rates the ${leaderParty === "Democrats" ? "Democratic" : "Republican"} ticket a ${pct(chance)} favourite. Its authors caution that a normal polling miss would still change the outcome in the closest states.`,
      refs,
    };
  },
  filing(race: string, top: string, raised: number, cash: number, refs: EntityRef[]): Story {
    return {
      headline: `${top} leads the money race in ${race}`,
      body: `Campaign finance reports filed with the election commission show ${top} raised ${money(raised)} in the period and ended it with ${money(cash)} on hand, the most in the race for ${race}.`,
      refs,
    };
  },
  rollCall(
    tone: number,
    bill: string,
    chamber: string,
    question: string,
    yeas: number,
    nays: number,
    passed: boolean,
    refs: EntityRef[],
  ): Story {
    const verb = passed ? (question === "On passage" ? "passes" : "clears a key vote in") : "fails in";
    return {
      headline:
        tone > 0 && passed
          ? `${chamber} delivers: ${bill} ${verb === "passes" ? "passes" : "advances"}`
          : tone < 0 && passed
            ? `${chamber} pushes ${bill} through over objections`
            : `${bill} ${verb} the ${chamber}, ${yeas} to ${nays}`,
      body: `The ${chamber} voted ${yeas} to ${nays} ${question.toLowerCase()} of the ${bill}. ${
        passed
          ? "Supporters called the vote overdue; opponents said the costs had not been reckoned."
          : "Its sponsors said they would try again in the next session."
      }`,
      refs,
    };
  },
  signed(bill: string, president: string, refs: EntityRef[]): Story {
    return {
      headline: `President ${president} signs the ${bill} into law`,
      body: `President ${president} signed the ${bill} at a ceremony this afternoon. Its provisions take effect at the start of next year.`,
      refs,
    };
  },
  veto(bill: string, president: string, refs: EntityRef[]): Story {
    return {
      headline: `President ${president} vetoes the ${bill}`,
      body: `President ${president} returned the ${bill} to Congress unsigned, calling it a tax on working families. Its sponsors said they would seek the two thirds of each chamber needed to override.`,
      refs,
    };
  },
  stage(bill: string, what: string, refs: EntityRef[]): Story {
    return {
      headline: `${bill} ${what}`,
      body: `The ${bill} ${what}, according to the congressional record published today.`,
      refs,
    };
  },
  debate(tone: number, winner: string, loser: string, refs: EntityRef[]): Story {
    return {
      headline:
        tone > 0
          ? `${winner} commands the stage in presidential debate`
          : tone < 0
            ? `${loser} holds firm as debate turns bitter`
            : `${winner} judged the winner of a sharp presidential debate`,
      body: `${winner} and ${loser} clashed over taxes, trade and the grid in the only debate of the general election. Snap surveys of viewers gave the night to ${winner}${tone < 0 ? ", though such surveys have missed before" : ""}.`,
      refs,
    };
  },
  rally(candidate: string, race: string, place: string, refs: EntityRef[]): Story {
    return {
      headline: `${candidate} rallies supporters in ${place}`,
      body: `${candidate}, running for ${race}, drew a crowd in ${place} and promised to fight for the county's jobs. The campaign said it has opened three field offices in the area this month.`,
      refs,
    };
  },
  endorsement(endorser: string, candidate: string, race: string, refs: EntityRef[]): Story {
    return {
      headline: `${endorser} endorses ${candidate} for ${race}`,
      body: `${endorser} endorsed ${candidate} in the race for ${race}, calling the candidate "the steady hand this moment needs".`,
      refs,
    };
  },
  rumour(claim: string, refs: EntityRef[]): Story {
    return {
      headline: `Sources: ${claim}`,
      body: `Two people familiar with the matter say ${claim}. Neither would be named, and the claim could not be independently confirmed.`,
      refs,
    };
  },
  confirmed(what: string, detail: string, refs: EntityRef[]): Story {
    return { headline: what, body: detail, refs };
  },
  debunked(who: string, claim: string, refs: EntityRef[]): Story {
    return {
      headline: `${who} denies report: "${claim}" is false`,
      body: `${who} said on the record today that the report was false and released a full schedule of events through election day. No outlet has produced evidence for the claim.`,
      refs,
    };
  },
  nomination(president: string, nominee: string, post: string, refs: EntityRef[]): Story {
    return {
      headline: `${president} names ${nominee} for ${post}`,
      body: `President ${president} will nominate ${nominee} to be ${post}, the White House said. The Senate is not expected to take up the nomination before the election.`,
      refs,
    };
  },
  electionDay(refs: EntityRef[]): Story {
    return {
      headline: "Election day: polls open across the country",
      body: "Voters choose a president, twelve senators, thirty representatives and five governors today. The first polls close at 19:00 and the last at 22:00; mail ballots in several states will take days to count.",
      refs,
    };
  },
  call(
    tone: number,
    outlet: string,
    winner: string,
    race: string,
    reporting: number,
    refs: EntityRef[],
  ): Story {
    return {
      kind: "Call",
      headline: tone > 0 ? `${winner} wins ${race}` : `${outlet} projects ${winner} to win ${race}`,
      body: `With ${pct(reporting)} of the expected vote counted, ${outlet} projects that ${winner} will win ${race}.`,
      refs,
    };
  },
  retraction(outlet: string, race: string, refs: EntityRef[]): Story {
    return {
      kind: "Correction",
      headline: `${outlet} withdraws its call in ${race}`,
      body: `${outlet} has withdrawn its earlier projection in ${race} after late-counted ballots erased the lead it was based on. The race is too close to call.`,
      refs,
    };
  },
  recount(race: string, margin: number, refs: EntityRef[]): Story {
    return {
      headline: `${race} heads to a recount`,
      body: `The final count in ${race} left the candidates ${pts(margin)} apart, inside the margin that triggers an automatic recount. Officials expect it to take about a week.`,
      refs,
    };
  },
  certified(race: string, winner: string, margin: number, refs: EntityRef[]): Story {
    return {
      headline: `${race} certified: ${winner} wins by ${pts(margin)}`,
      body: `Election officials certified the result in ${race} today. ${winner} won by ${pts(margin)}.`,
      refs,
    };
  },
  market(title: string, from: number, to: number, refs: EntityRef[]): Story {
    return {
      headline: `Bettors ${to > from ? "pile into" : "flee"} "${title}"`,
      body: `The contract "${title}" traded at ${to} cents today, ${to > from ? "up" : "down"} from ${from} a day ago, on the betting exchange.`,
      refs,
    };
  },
  company(name: string, industry: string, up: boolean, refs: EntityRef[]): Story {
    return {
      headline: up
        ? `${name} shares climb as ${industry} firms eye the election`
        : `${name} slips; ${industry} investors wary of new rules`,
      body: `Shares of ${name} ${up ? "rose" : "fell"} in afternoon trading. Analysts said ${industry} companies are among the most exposed to what Congress does next year.`,
      refs,
    };
  },
} as const;

/** The outlets that cover a story: the wire, the state's paper, and each national with chance `reach`. */
export function coverage(fs: FeedState, rng: MockRng, state: number | null, reach: number): MockOutlet[] {
  const out: MockOutlet[] = [];
  for (const o of fs.outlets) {
    if (o.kind === "Wire") out.push(o);
    else if (o.kind === "Regional") {
      if (o.state === state) out.push(o);
    } else if (rng.chance(reach * o.reliability)) out.push(o);
  }
  return out;
}
