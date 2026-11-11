// The mock's social feed (v_social; pivot 8.3): accounts for politicians, campaigns, pundits,
// pollsters, outlets and anonymous posters, and every post so far. Rumours start here; whether one
// is true is the script's to know (../pivot.ts), and the view says only Open, Confirmed or Debunked.

import type {
  DateTime,
  EntityRef,
  HandleId,
  HandleKind,
  PersonId,
  Post,
  RumourStatus,
  SocialView,
} from "@tc20ff/sim";
import type { FeedState } from "./feed.ts";
import type { MockPolling } from "./polls.ts";
import type { MockPolitics, MockRace } from "./races.ts";
import type { MockRng } from "./rng.ts";

export interface MockHandle {
  id: HandleId;
  name: string;
  kind: HandleKind;
  owner: EntityRef | null;
}

export interface SocialState {
  handles: MockHandle[];
  posts: Post[];
  /** A politician's handle, by person. */
  of_person: Map<PersonId, HandleId>;
  pundits: HandleId[];
  anonymous: HandleId[];
  /** By pollster id and by outlet id; absent for a firm or an outlet with no account. */
  of_pollster: Map<number, HandleId>;
  of_outlet: Map<number, HandleId>;
}

const PUNDITS = ["@margin_of_terror", "@the_whip_count", "@beltway_brat", "@poll_goblin"];
const ANONYMOUS = ["@deep_cloakroom", "@hill_staffer_anon", "@ballot_box_ghost"];
/** How many of the closest Senate races have both nominees on the feed. */
const SENATE_RACES_ON_FEED = 4;

const tag = (name: string) => `@${name.replace(/[^A-Za-z]/g, "")}`;

export function genSocial(
  pol: MockPolitics,
  polling: MockPolling,
  feed: FeedState,
  extra: PersonId[],
): SocialState {
  const ss: SocialState = {
    handles: [],
    posts: [],
    of_person: new Map(),
    pundits: [],
    anonymous: [],
    of_pollster: new Map(),
    of_outlet: new Map(),
  };
  const add = (name: string, kind: HandleKind, owner: EntityRef | null): HandleId => {
    const id = ss.handles.length as HandleId;
    ss.handles.push({ id, name, kind, owner });
    return id;
  };
  const person = (id: PersonId) => {
    if (ss.of_person.has(id)) return;
    const p = pol.people[id] as { name: string };
    ss.of_person.set(id, add(tag(p.name), "Politician", { kind: "Person", id }));
  };
  person(pol.president);
  person(pol.challenger);
  const senate = pol.races
    .filter((r) => r.office === "Senate")
    .sort((a, b) => Math.abs(a.final_margin) - Math.abs(b.final_margin) || a.id - b.id)
    .slice(0, SENATE_RACES_ON_FEED);
  for (const r of senate) for (const i of r.ballot) person((r.candidates[i] as { person: PersonId }).person);
  for (const id of extra) person(id);
  const pres = pol.races[0] as MockRace;
  add(`@Team${tag((pol.people[pol.president] as { name: string }).name).slice(1)}`, "Campaign", {
    kind: "Race",
    id: pres.id,
  });
  add(`@Team${tag((pol.people[pol.challenger] as { name: string }).name).slice(1)}`, "Campaign", {
    kind: "Race",
    id: pres.id,
  });
  for (const name of PUNDITS) ss.pundits.push(add(name, "Pundit", null));
  for (const f of polling.pollsters.slice(0, 3)) {
    ss.of_pollster.set(f.id, add(tag(f.name), "Pollster", { kind: "Pollster", id: f.id }));
  }
  for (const o of feed.outlets.slice(0, 3)) {
    ss.of_outlet.set(o.id, add(tag(o.name), "Outlet", { kind: "Outlet", id: o.id }));
  }
  for (const name of ANONYMOUS) ss.anonymous.push(add(name, "Anonymous", null));
  return ss;
}

export function post(
  ss: SocialState,
  t: DateTime,
  handle: HandleId,
  text: string,
  refs: EntityRef[],
  rumour: RumourStatus | null = null,
): Post {
  const p: Post = { id: ss.posts.length, time: t, handle, text, refs, rumour };
  ss.posts.push(p);
  return p;
}

/** A rumour is confirmed or debunked (pivot 8.3): the post's row is replaced, never changed in place. */
export function settleRumour(ss: SocialState, id: number, status: RumourStatus): void {
  ss.posts[id] = { ...(ss.posts[id] as Post), rumour: status };
}

/** What a candidate posts on an ordinary day, in a voice (pivot 8.3 "voice from traits", much reduced). */
export function candidateLine(rng: MockRng, race: string, place: string): string {
  return rng.pick([
    `Great crowd in ${place} tonight. ${race} is ours to win. Knock on one more door.`,
    `My opponent voted against ${place}'s jobs three times. On 3 November, remember it.`,
    `Thank you ${place}! Early voting is open. Bring a neighbour.`,
    `We out-raised them again this quarter, and not one cent of it from a lobbyist.`,
    `Fourteen stops in four days. ${place}, see you at noon by the courthouse.`,
  ]);
}

export function punditLine(rng: MockRng, what: string): string {
  return rng.pick([
    `${what}. Told you so.`,
    `${what}. Everyone calm down, it is one data point.`,
    `Hot take: ${what}, and nobody priced it in.`,
    `${what}. The market has not caught up yet.`,
    `If you are surprised that ${what}, you have not been paying attention.`,
  ]);
}

/** v_social: `followed` is what the player follows now. */
export function socialView(ss: SocialState, followed: ReadonlySet<number>): SocialView {
  return {
    handles: ss.handles.map((h) => ({ ...h, followed: followed.has(h.id) })),
    posts: ss.posts.slice(),
  };
}
