// What must hold of the 13 pivot views at any tick (pivot 5 to 14): every id and `EntityRef` names
// something another view holds, lists are in id order, prices and votes are in range, a group's
// prices sum to about 100, and hidden fields are null unless Omniscient (pivot 5.11).

import type { EntityRef, SimViews } from "@tc20ff/sim";
import { expect } from "vitest";

/** A group's quoted prices may miss 100 by half a cent of rounding a contract, and a little slack. */
export const GROUP_SUM_SLACK = 1;

export function checkPivotViews(v: SimViews, omniscient: boolean): void {
  const feed = v.feed.data;
  const social = v.social.data;
  const polls = v.polls.data;
  const forecast = v.forecast.data;
  const races = v.races.data;
  const people = v.people.data.people;
  const records = v.records.data;
  const markets = v.markets.data.contracts;
  const account = v.account.data;
  const notes = v.notifications.data.items;
  const districts = v.districts.data;
  const map = v.usmap_layers.data;
  const returns = v.returns.data;

  const inOrder = (rows: { id: number }[], what: string) => {
    rows.forEach((r, i) => {
      if (r.id !== i) throw new Error(`${what} ${i} has id ${r.id}`);
    });
  };
  inOrder(feed.outlets, "outlet");
  inOrder(feed.articles, "article");
  inOrder(social.handles, "handle");
  inOrder(social.posts, "post");
  inOrder(polls.pollsters, "pollster");
  inOrder(polls.polls, "poll");
  inOrder(races.races, "race");
  inOrder(people, "person");
  inOrder(records.bills, "bill");
  inOrder(records.roll_calls, "roll call");
  inOrder(records.actions, "action");
  inOrder(markets, "contract");
  inOrder(notes, "notification");

  const states = new Set(map.states.map((s) => s.id as number));
  const counties = map.counties.fips.length;
  const has: Record<EntityRef["kind"], (id: number) => boolean> = {
    Person: (id) => id < people.length,
    Race: (id) => id < races.races.length,
    Bill: (id) => id < records.bills.length,
    Company: (id) => id < v.company_rows.data.rows.length,
    Industry: (id) => id < v.industry_rows.data.rows.length,
    State: (id) => states.has(id),
    County: (id) => id < counties,
    District: (id) => id < districts.districts.length,
    Outlet: (id) => id < feed.outlets.length,
    Pollster: (id) => id < polls.pollsters.length,
    Handle: (id) => id < social.handles.length,
    Contract: (id) => id < markets.length,
  };
  const ref = (r: EntityRef | null, where: string) => {
    if (r === null) return;
    if (!(Number.isInteger(r.id) && r.id >= 0 && has[r.kind](r.id))) {
      throw new Error(`${where}: ${r.kind} ${r.id} does not exist`);
    }
  };
  const person = (id: number | null, where: string) =>
    ref(id === null ? null : { kind: "Person", id }, where);
  const race = (id: number, where: string) => ref({ kind: "Race", id }, where);
  const whole = (n: number, where: string) => {
    if (!(Number.isInteger(n) && n >= 0)) throw new Error(`${where}: ${n} is not a whole number`);
  };
  const share = (x: number, where: string) => {
    if (!(x >= 0 && x <= 1)) throw new Error(`${where}: ${x} is not a share`);
  };

  // v_feed
  for (const o of feed.outlets) {
    if (o.state !== null) ref({ kind: "State", id: o.state }, `outlet ${o.name}`);
    expect(o.slant === null, `outlet ${o.name} slant`).toBe(!omniscient);
    expect(o.reliability === null).toBe(!omniscient);
  }
  let last = Number.NEGATIVE_INFINITY;
  for (const a of feed.articles) {
    ref({ kind: "Outlet", id: a.outlet }, `article ${a.id}`);
    for (const r of a.refs) ref(r, `article ${a.id} "${a.headline}"`);
    expect(a.time, `article ${a.id} is in time order`).toBeGreaterThanOrEqual(last);
    last = a.time;
    expect(a.time).toBeLessThanOrEqual(v.clock.data.now);
    expect(a.headline.length).toBeGreaterThan(0);
    expect(a.body.length).toBeGreaterThan(0);
  }
  for (const p of feed.front_pages) {
    ref({ kind: "Outlet", id: p.outlet }, "front page");
    expect(p.articles.length).toBeGreaterThan(0);
    for (const id of p.articles)
      expect(feed.articles[id]?.outlet, `front page of outlet ${p.outlet}`).toBe(p.outlet);
  }

  // v_social
  for (const h of social.handles) ref(h.owner, `handle ${h.name}`);
  expect(new Set(social.handles.map((h) => h.name)).size).toBe(social.handles.length);
  for (const p of social.posts) {
    ref({ kind: "Handle", id: p.handle }, `post ${p.id}`);
    for (const r of p.refs) ref(r, `post ${p.id}`);
    expect(p.time).toBeLessThanOrEqual(v.clock.data.now);
  }
  const followed = new Set(account.follows.filter((f) => f.kind === "Handle").map((f) => f.id));
  for (const h of social.handles) expect(h.followed, `handle ${h.name} followed`).toBe(followed.has(h.id));

  // v_races and v_people
  for (const r of races.races) {
    if (r.state !== null) ref({ kind: "State", id: r.state }, r.title);
    expect(r.office === "President").toBe(r.state === null);
    expect(r.office === "House").toBe(r.district !== null);
    for (const c of r.candidates) {
      person(c.person, r.title);
      expect(c.strength === null, `${r.title} strength`).toBe(!omniscient);
      if (c.raised !== null) expect(c.raised).toBeGreaterThanOrEqual(0);
      if (c.cash !== null) expect(c.cash).toBeGreaterThanOrEqual(0);
    }
    person(r.winner, r.title);
    expect(r.winner !== null, `${r.title} winner`).toBe(r.status === "Certified");
    if (r.winner !== null) {
      expect(r.candidates.filter((c) => c.status === "Won").map((c) => c.person)).toEqual([r.winner]);
    }
  }
  for (const p of people) {
    ref({ kind: "State", id: p.home_state }, p.name);
    for (const f of [p.skills, p.traits, p.integrity, p.xp, p.level])
      expect(f === null, `${p.name} hidden`).toBe(!omniscient);
    expect(p.office !== null, `${p.name} office`).toBe(p.status === "InOffice");
  }
  expect(new Set(people.map((p) => p.name)).size).toBe(people.length);

  // v_polls and v_forecast
  for (const f of polls.pollsters) expect(f.house_effect === null).toBe(!omniscient);
  for (const p of polls.polls) {
    ref({ kind: "Pollster", id: p.pollster }, `poll ${p.id}`);
    race(p.race, `poll ${p.id}`);
    const cands = new Set(races.races[p.race]?.candidates.map((c) => c.person as number));
    let sum = p.undecided;
    for (const s of p.shares) {
      expect(cands.has(s.person), `poll ${p.id} polls a candidate of its race`).toBe(true);
      share(s.share, `poll ${p.id}`);
      sum += s.share;
    }
    expect(sum).toBeGreaterThan(0.98);
    expect(sum).toBeLessThan(1.02);
    whole(p.sample, `poll ${p.id} sample`);
    expect(p.stage === "Primary").toBe(p.party !== null);
  }
  for (const f of forecast.races) {
    race(f.race, "forecast");
    let sum = 0;
    for (const o of f.odds) {
      person(o.person, "forecast");
      share(o.win, "forecast odds");
      sum += o.win;
    }
    expect(sum).toBeGreaterThan(0.98);
    expect(sum).toBeLessThan(1.02);
    expect(f.margin[0]).toBeLessThanOrEqual(f.margin[1]);
    expect(f.margin[1]).toBeLessThanOrEqual(f.margin[2]);
  }
  for (const c of forecast.chambers) {
    expect(c.parties.map((p) => p.party)).toEqual(["Democrats", "Republicans"]);
    expect((c.parties[0]?.control ?? 0) + (c.parties[1]?.control ?? 0)).toBeCloseTo(1, 2);
    for (const p of c.parties) for (const s of p.seats) whole(s, `${c.chamber} seats`);
  }

  // v_records
  for (const b of records.bills) {
    person(b.sponsor, b.title);
    for (const c of b.changes) {
      if (c.index !== null && c.lever !== "state_growth") ref({ kind: "Industry", id: c.index }, b.title);
      if (c.lever === "state_growth") ref({ kind: "State", id: c.index as number }, b.title);
    }
    expect(b.effective !== null, `${b.title} effective`).toBe(b.stage === "Law");
  }
  for (const r of records.roll_calls) {
    ref({ kind: "Bill", id: r.bill }, `roll call ${r.id}`);
    whole(r.yeas, "yeas");
    whole(r.nays, "nays");
  }
  for (const a of records.actions) {
    person(a.actor, `action ${a.id}`);
    person(a.subject, `action ${a.id}`);
  }
  for (const f of records.filings) {
    race(f.race, "filing");
    person(f.person, "filing");
    for (const x of [f.raised, f.spent, f.cash]) expect(x).toBeGreaterThanOrEqual(0);
  }

  // v_markets
  const groups = new Map<number, typeof markets>();
  for (const c of markets) {
    expect(c.instrument as number).toBe(c.id);
    ref(c.subject, c.title);
    expect(c.rule.length, `${c.title} has a written rule`).toBeGreaterThan(20);
    for (const p of [c.bid, c.ask, c.last]) {
      if (p !== null) {
        whole(p, `${c.title} price`);
        expect(p).toBeGreaterThanOrEqual(1);
        expect(p).toBeLessThanOrEqual(99);
      }
    }
    if (c.bid !== null && c.ask !== null) expect(c.bid, `${c.title} is not crossed`).toBeLessThan(c.ask);
    expect(c.outcome !== null, `${c.title} outcome`).toBe(c.status === "Resolved");
    if (c.status !== "Open") expect([c.bid, c.ask]).toEqual([null, null]);
    whole(c.volume, "volume");
    whole(c.open_interest, "open interest");
    if (c.group !== null) groups.set(c.group, [...(groups.get(c.group) ?? []), c]);
  }
  for (const [g, cs] of groups) {
    if (cs.every((c) => c.status === "Open")) {
      // Group contract prices sum to about 100 (pivot 10.3): each quote's middle, an empty side counting as 0 or 100.
      const sum = cs.reduce((a, c) => a + ((c.bid ?? 0) + (c.ask ?? 100)) / 2, 0);
      expect(Math.abs(sum - 100), `group ${g} sums to ${sum}`).toBeLessThanOrEqual(
        cs.length / 2 + GROUP_SUM_SLACK,
      );
    }
    if (cs.every((c) => c.status === "Resolved")) {
      expect(cs.filter((c) => c.outcome === true).length, `group ${g} has one winner`).toBe(1);
    }
  }

  // v_account and v_notifications
  if (account.open) {
    expect(account.cash.map((c) => c.venue)).toEqual(["Brokerage", "Exchange"]);
    let worth = 0;
    for (const c of account.cash) {
      expect(c.cash, `${c.venue} cash`).toBeGreaterThanOrEqual(-1e-6);
      worth += c.cash;
    }
    for (const p of account.positions) {
      ref(p.what, "position");
      expect(p.what.kind).toBe(p.venue === "Exchange" ? "Contract" : "Company");
      expect(Number.isInteger(p.qty) && p.qty !== 0).toBe(true);
      const unit = p.venue === "Exchange" ? 0.01 : 1;
      worth += p.venue === "Exchange" && p.qty < 0 ? -p.qty * (100 - p.mark) * unit : p.qty * p.mark * unit;
    }
    expect(account.net_worth).toBeCloseTo(worth, 4);
    const orders = new Set<number>();
    for (const o of account.orders) {
      ref(o.what, "order");
      whole(o.qty, "order qty");
      whole(o.filled, "order filled");
      expect(o.filled).toBeLessThanOrEqual(o.qty);
      expect(o.status === "Filled").toBe(o.filled === o.qty);
      orders.add(o.id);
    }
    for (const f of account.fills) {
      whole(f.qty, "fill qty");
      expect(f.fee).toBeGreaterThanOrEqual(0);
    }
    for (const f of account.follows) ref(f, "follow");
    for (const r of account.alert_rules) ref(r.rule.target, "alert rule");
  }
  for (const n of notes) {
    for (const r of n.refs) ref(r, `notification ${n.id}`);
    expect(n.kind === "Alert").toBe(n.rule !== null);
    expect(n.text.length).toBeGreaterThan(0);
  }

  // v_districts and v_usmap_layers
  const cols = map.counties;
  for (const col of [
    cols.state,
    cols.name,
    cols.population,
    cols.district,
    cols.last_winner,
    cols.last_margin,
  ]) {
    expect(col.length).toBe(counties);
  }
  expect(cols.lean === null).toBe(!omniscient);
  if (cols.lean !== null) expect(cols.lean.length).toBe(counties);
  expect([...cols.fips].sort()).toEqual(cols.fips);
  expect(new Set(cols.fips).size).toBe(counties);
  cols.state.forEach((s) => {
    ref({ kind: "State", id: s }, "county");
  });
  const covered = new Array<number>(counties).fill(0);
  const seats = new Map<number, number>();
  for (const d of districts.districts) {
    ref({ kind: "State", id: d.state }, "district");
    person(d.member, "district");
    expect(d.lean === null).toBe(!omniscient);
    seats.set(d.state, (seats.get(d.state) ?? 0) + 1);
    expect(d.number).toBe(seats.get(d.state));
    let pop = 0;
    let prev = -1;
    for (const s of d.shares) {
      ref({ kind: "County", id: s.county }, "district share");
      expect(cols.state[s.county]).toBe(d.state);
      expect(s.county, "shares are in county order").toBeGreaterThanOrEqual(prev);
      prev = s.county;
      expect(s.from).toBeGreaterThanOrEqual(0);
      expect(s.to).toBeLessThanOrEqual(1);
      expect(s.to).toBeGreaterThan(s.from);
      covered[s.county] = (covered[s.county] as number) + s.to - s.from;
      pop += (s.to - s.from) * (cols.population[s.county] as number);
    }
    expect(Math.abs(pop - d.population)).toBeLessThanOrEqual(1);
  }
  // The shares of one county together cover it (pivot 5.4).
  covered.forEach((c, i) => {
    expect(c, `county ${i} is covered once`).toBeCloseTo(1, 9);
  });
  for (const s of map.states) {
    expect(seats.get(s.id), `${s.name} seats`).toBe(s.house_seats);
    expect(s.electoral_votes).toBe(s.house_seats + 2);
  }
  for (const p of districts.plans) {
    ref({ kind: "State", id: p.state }, "plan");
    expect(p.strength === null).toBe(!omniscient);
  }

  // v_returns
  for (const r of returns.races) {
    race(r.race, "returns");
    share(r.reporting, "reporting");
    for (const x of r.votes) {
      person(x.person, "returns");
      whole(x.votes, "votes");
    }
    if (r.polls_closed === null) expect(r.votes.every((x) => x.votes === 0)).toBe(true);
    for (const c of r.calls) {
      ref({ kind: "Outlet", id: c.outlet }, "call");
      person(c.person, "call");
    }
    expect(r.electoral_votes !== null).toBe(races.races[r.race]?.office === "President");
  }
}
