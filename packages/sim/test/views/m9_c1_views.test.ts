// Port of crates/sim/tests/m9_c1_views.rs: M9 Phase C lane C1's sim requests (docs/build/m9-plan.md;
// the requests lanes B1 and B2 logged): the index history in v_exchanges (D540), directors by
// position in v_company_detail (D541), IPO ballot voters (D542), startup headlines carrying their
// event (D543) and stable headline ids (D544). Expected values come from the spec: every headline
// index is 1,000 at load (5.14) and closes once a day at 00:00 (4.2 step 6).
//
// Expects:
//   ../../src/lib.ts                simNew, simStep, simViews, simClock, simWorld, simSaveBytes,
//                                      simLoadBytes; (via ../common/ops.ts) runTo
//   ../../src/market/exchange_index.ts       INDEX_BASE (1000)             [market::index::INDEX_BASE]
//   ../../src/world/log.ts          chunkLogRows, chunkLogSharesWith (exist)
//   (view data is plain, types/views/; v_news `get(id)` is a local find over feed)
//
// Changed from the Rust:
// - Seeds are the new generator (D951). The first test's "33 closes 2 January to 3 February" and
//   the 1,000 start are calendar and spec facts. The directors, ballots and headline tests wait
//   for a born company / the first lock; the Rust loops 2020..2026 locks to find directors and
//   asserts one exists, which depends on the births draws. It keeps that loop and its assertion
//   (`with > 0`), so a seed/RNG that never births a startup with directors in six years fails
//   loudly and the seed can be changed here (seed 1 kept).
// - View sharing: `v.exchanges...closes.shares_with(&w.market.index_history[z])` (D148) is
//   chunkLogSharesWith on the logs. It holds only when the views are not structured-cloned
//   (in-process Sim); if W1 clones views on the way out, drop that last assertion.
// - Rust Debug-free: `v.get(HeadlineId(n))` is a find over feed by id.
import { describe, expect, it } from "vitest";
import { simClock, simLoadBytes, simNew, simSaveBytes, simStep, simViews, simWorld } from "../../src/lib.ts";
import { INDEX_BASE } from "../../src/market/exchange_index.ts";
import { simDateYmd } from "../../src/time/calendar.ts";
import { cmpDate, type SimDate } from "../../src/types/calendar.ts";
import type { CompanyId, HeadlineId } from "../../src/types/ids.ts";
import type { SeatPerson } from "../../src/types/views/company_detail.ts";
import { chunkLogRows, chunkLogSharesWith } from "../../src/world/log.ts";
import { data, unwrap } from "../common/index.ts";
import { runTo } from "../common/ops.ts";
import { byField, byId } from "../common/views.ts";

describe("m9 c1 views", () => {
  it("exchanges_serve_each_index_s_daily_closes_from_2020", () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    const start = simDateYmd(2020, 1, 1);
    {
      const v = simViews(sim);
      v.exchanges.data.exchanges.forEach((e, i) => {
        const z = v.zones.data.zones[i];
        if (z === undefined) throw new Error("zone row");
        const c = chunkLogRows(e.closes.log);
        if (z.index_close !== null) {
          expect(c.length, `${e.code}: the load level`).toBe(1);
          expect(c[0]?.date).toEqual(start);
          expect(Math.abs((c[0]?.level as number) - INDEX_BASE) < 1e-9, "1,000 at load (5.14)").toBe(true);
        } else {
          expect(c.length, `${e.code}: no level, no close`).toBe(0);
        }
      });
    }
    // Each day's 00:00 close joins the history, dated that day, at v_zones' last close.
    let seen: [SimDate, number][][] = [];
    const end = simDateYmd(2020, 2, 3);
    for (;;) {
      simStep(sim);
      const v = simViews(sim);
      const today = simClock(sim).date;
      if (seen.length === 0) seen = v.zones.data.zones.map(() => []);
      v.zones.data.zones.forEach((z, i) => {
        const list = seen[i] as [SimDate, number][];
        const last = list.at(-1);
        if (
          z.index_close !== null &&
          (last === undefined || cmpDate(last[0], today) !== 0) &&
          simClock(sim).hour === 0
        ) {
          list.push([today, z.index_close]);
        }
      });
      if (cmpDate(today, end) >= 0 && simClock(sim).hour === 0) break;
    }
    const v = simViews(sim);
    let checked = 0;
    v.exchanges.data.exchanges.forEach((e, i) => {
      const c: [SimDate, number][] = chunkLogRows(e.closes.log).map((x) => [x.date, x.level]);
      if (c.length === 0) return;
      checked += 1;
      expect(c[0]?.[0]).toEqual(start);
      expect(c.slice(1), e.code).toEqual(seen[i]);
      for (let k = 0; k + 1 < c.length; k++) {
        expect(
          cmpDate((c[k] as [SimDate, number])[0], (c[k + 1] as [SimDate, number])[0]) < 0,
          "one close a day",
        ).toBe(true);
      }
      expect(c.length, `${e.code}: 1 January, then 2 January to 3 February`).toBe(1 + 33);
      expect(byField(v.exchanges.data.exchanges, "zone", e.zone)?.code).toBe(e.code);
    });
    expect(checked > 0).toBe(true);
    // The view shares the World's chunks (D148): in-process only, see the header.
    const w = simWorld(sim);
    const first = v.exchanges.data.exchanges[0];
    if (first === undefined) throw new Error("no exchanges");
    expect(
      chunkLogSharesWith(first.closes.log, (w.market.index_history[first.zone] as { log: never }).log),
    ).toBe(true);
  }, 120_000);

  // Each startup headline carries the id of the event it reports (D543), and every event fired
  // is reported by exactly one posted headline.
  it("startup_headlines_carry_their_event", () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    runTo(sim, simDateYmd(2020, 4, 11));
    const w = simWorld(sim);
    const reports = new Array<number>(w.births.events.length).fill(0);
    for (const h of chunkLogRows(w.news.feed)) {
      const startup =
        h.kind.kind === "FixedStartupEvent" ||
        h.kind.kind === "StartupLaunch" ||
        h.kind.kind === "HotCluster";
      expect(h.event !== null, h.text).toBe(startup);
      if (h.event === null) continue;
      const e = w.births.events[h.event];
      if (e === undefined) throw new Error("event");
      expect(e.id).toBe(h.event);
      expect(e.date, "dated at the plan lock").toEqual(h.date);
      switch (h.kind.kind) {
        case "StartupLaunch":
          expect(e.companies).toEqual([h.company]);
          break;
        case "HotCluster":
          expect(e.companies.length).toBe(h.kind.startups);
          break;
        case "FixedStartupEvent":
          expect(e.kind.kind === "Fixed" && e.kind.id === h.kind.event).toBe(true);
          break;
        default:
          throw new Error("unreachable");
      }
      reports[h.event] = (reports[h.event] as number) + 1;
    }
    expect(reports.length > 0).toBe(true);
    expect(
      reports.every((n) => n === 1),
      `${reports}`,
    ).toBe(true);
  }, 120_000);

  // Each posted headline has a stable id, its place in post order from 0 (D544); v_news finds any
  // headline by it, and a save keeps it.
  it("headlines_have_stable_ids", () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    runTo(sim, simDateYmd(2020, 7, 12));
    const v = simViews(sim).news.data;
    const ids = v.feed.map((h) => h.id as number);
    expect(ids.length > 50, "a half year of headlines").toBe(true);
    expect(ids).toEqual(ids.map((_, i) => i));
    const find = (id: number) => v.feed.find((h) => h.id === id) ?? null;
    for (const h of v.feed) expect(find(h.id)).toEqual(h);
    expect(find(ids.length as HeadlineId)).toBeNull();
    for (const h of simWorld(sim).news.today) {
      expect(find(h.id)?.id, "today's posts carry their ids").toBe(h.id);
    }
    const bytes = simSaveBytes(sim);
    const back = unwrap(simNew(data(), 2), "Sim::new");
    unwrap(simLoadBytes(back, bytes), "load_bytes");
    expect(simViews(back).news.data.feed).toEqual(v.feed);
  }, 120_000);

  // A company's directors in seat position order (5.19.4 step 4; D541): the detail view lists
  // them as the World holds them, each a full character by id or a partial one by its 3.7.1 id.
  it("company_detail_lists_directors_by_position", () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    // Directors come with a startup whose cast outnumbers its labor seats: run lock by lock
    // until one is born.
    for (let year = 2020; year < 2026; year++) {
      runTo(sim, simDateYmd(year, 1, 10));
      if (simWorld(sim).companies.some((c) => c.directors.length > 0)) break;
    }
    const w = simWorld(sim);
    const v = simViews(sim).company_detail.data;
    let withDirectors = 0;
    w.companies.forEach((c, idx) => {
      const d = byId(v.companies, idx as CompanyId);
      if (d === undefined) throw new Error(`no detail ${c.key}`);
      expect(d.directors.length).toBe(c.directors.length);
      d.directors.forEach((p, i) => {
        const dir = c.directors[i];
        if (dir === undefined) throw new Error("director");
        if (dir.kind === "Full") {
          expect(p.character).toBe(dir.character);
          expect(!p.partial && p.partial_id === null).toBe(true);
          expect(p.name).toBe(w.characters[dir.character]?.name);
        } else {
          expect(p.partial_id).toBe(dir.seat.id);
          expect(p.partial && p.character === null).toBe(true);
          expect(p.name).toBe(dir.seat.character.name);
        }
      });
      withDirectors += c.directors.length > 0 ? 1 : 0;
    });
    expect(withDirectors > 0, "a startup with directors").toBe(true);
  }, 120_000);

  // Each IPO ballot names who held the role at the vote (D542): right after the first lock the
  // board has not moved, so every seat and director ballot names today's holder.
  it("ipo_ballots_name_their_voters", () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    runTo(sim, simDateYmd(2020, 1, 10));
    const w = simWorld(sim);
    const v = simViews(sim).company_detail.data;
    let ballots = 0;
    for (const d of v.companies) {
      const rec = d.ipo_last_vote;
      if (rec === null) continue;
      const c = w.companies[d.id];
      if (c === undefined) throw new Error("company");
      for (const b of rec.result.ballots) {
        ballots += 1;
        const voter = b.voter;
        if (voter === null) throw new Error("a voter");
        const same = (p: SeatPerson): boolean => {
          switch (voter.kind) {
            case "Full":
              return p.character === voter.character;
            case "Partial":
              return p.partial_id === voter.id && p.name === voter.name;
            default:
              return false;
          }
        };
        switch (b.role.kind) {
          case "Seat": {
            const seat = b.role.seat;
            const card = d.board.find((s) => s.seat === seat);
            expect(card?.holder !== null && card?.holder !== undefined && same(card.holder), d.name).toBe(
              true,
            );
            break;
          }
          case "Director": {
            const person = d.directors[b.role.position];
            expect(person !== undefined && same(person)).toBe(true);
            break;
          }
          case "Controller":
            if (voter.kind === "State") expect(c.state_controlled).toBe(true);
            else if (voter.kind === "Full") expect(c.controller).toBe(voter.character);
            else throw new Error("a controller is full or the state");
            break;
        }
      }
    }
    expect(ballots > 0, "votes at the first lock").toBe(true);
  }, 120_000);
});
