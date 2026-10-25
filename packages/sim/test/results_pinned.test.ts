// Pins a year of seed 1 to the results main gave before the ts4 speed-ups (the yearly state hash
// encoder and WebAssembly lanes, the projection copy sharing archives, the RNG without closures,
// and the news, recap and statements views reusing their last builds). Not a Rust test.
//
// The golden digests below were recorded on main 00564ee (before any of those changes) by
// running exactly this loop. They change ONLY with an intended change of behaviour (a new job, a
// new view field, a tuning value): then re-record them in the same commit and say why. A speed-up
// must leave every one of them as it is.
//
// - the state hash at 2021-01-01 00:00;
// - each view's canonical JSON (sha-256, first 24 hex digits) and version there;
// - one digest of every view's data, version and dirty flag at every month start of the year;
// - one digest of the patches a frame poster would take every 7 ticks (`viewsPatchSince`: which
//   views moved, the headlines appended, the news resets and versions).
//
// Beside them, src/canonical.ts is held to the plain reference encoder
// (common/canonical_reference.ts) on the whole world and every view, and the WebAssembly hash
// lanes to the JS lanes and to FNV-1a over TextEncoder's bytes.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalString } from "../src/canonical.ts";
import { fnv1a64Hex, hashOfCanonical, stateHashOfText } from "../src/hash.ts";
import { simControls, simNew, simStateHash, simStep, simViews, simWorld } from "../src/lib.ts";
import { dateTimeDate, dateTimeHour, dateTimeMidnight, simDateYmd } from "../src/time/calendar.ts";
import { VIEW_NAMES } from "../src/types/views/index.ts";
import type { ViewInput } from "../src/views/index.ts";
import { buildNews, rebuildNewsFrom } from "../src/views/news.ts";
import { postedViewsNone, viewsPatchSince } from "../src/views/patch.ts";
import { appendBufFromRows } from "../src/world/log.ts";
import { referenceCanonicalString } from "./common/canonical_reference.ts";
import { data, macrotask, unwrap } from "./common/index.ts";

const GOLDEN_STATE = "6a04f7eff61994ac71d7944c64a40dbc";
const GOLDEN_MONTHLY = "686d3fbf8b3a5e00662f58cf";
const GOLDEN_PATCHES = "5255589d8f89b3abce9997f7";
/** Each view's canonical JSON digest and version at 2021-01-01 00:00, seed 1. */
const GOLDEN_VIEWS: Record<string, [string, number]> = {
  clock: ["7711de731a6e84765f70ffdc", 8785],
  places: ["0bbcb0e819952b7c5f894c81", 1],
  countries: ["c301b680d07687f003502ff1", 8785],
  zones: ["ecea51eb9c56476f825bc273", 8785],
  rates: ["efc3668ad8d3cca8ad0790ce", 8785],
  characters: ["44e67a66b197e6aac748be3e", 8785],
  cap_table: ["f4e6a9b98e8664282e45d80e", 8785],
  quotes: ["9fb8824f7a9c360afb2c411a", 8785],
  price_bars: ["6ef477abf9dbb399e571f697", 8785],
  exchanges: ["673f8deed3bb2d615555a3ab", 8785],
  market_stats: ["3ee256e016da5f3dd93c42b8", 8785],
  news: ["1f42baddbf9f639470712bf1", 8785],
  births: ["6939ca2f173eee99be7a1a95", 8785],
  projection: ["2215ba0b7723158b52a26401", 8785],
  company_rows: ["95796cf016b79feea9d74e2d", 8785],
  company_detail: ["3bb822e0940b23b92533941b", 8785],
  units: ["f3bf6357aa2dc94f7988306f", 8785],
  tech: ["6a71d0dab59ef9fb9673db86", 8785],
  industry_rows: ["acd1ec3d6fa8a2699bc99aa3", 8785],
  industry_detail: ["fcf6dc098a2fa768ca33914a", 8785],
  cycle: ["29a667585bfb5f443462d90d", 8785],
  map_layers: ["53a49aa9ee9a10d107e12055", 8785],
  province_cards: ["8cf4549c5ca68b7068b6b210", 8785],
  statements: ["89d7064efd02453bcf8e99c0", 8785],
  filings: ["1d40b2a19e345faf2d954388", 8785],
  ratings: ["9107f7c7b59743b0007cc460", 8785],
  recap: ["f002a1b0460fe0c893421824", 8785],
  map_static: ["5a7fcdac19a0f147f840d02c", 1],
};

const sha = (s: string): string => createHash("sha256").update(s).digest("hex").slice(0, 24);

describe("results pinned to main", () => {
  it("a year of seed 1 gives main's state hash, views and patches", async () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    const views = () =>
      simViews(sim) as unknown as Record<string, { data: unknown; version: number; dirty: boolean }>;
    const monthly = createHash("sha256");
    const patches = createHash("sha256");
    const posted = postedViewsNone();
    const end = dateTimeMidnight(simDateYmd(2021, 1, 1));
    let tick = 0;
    while (sim.now() < end) {
      simStep(sim);
      tick += 1;
      if (tick % 7 === 0) {
        const p = viewsPatchSince(simViews(sim), posted);
        patches.update(
          Object.keys(p).sort().join(",") +
            canonicalString(p.news_appended ?? null) +
            String(p.news_reset) +
            String(p.news_version) +
            String(p.refresh),
        );
      }
      const now = sim.now();
      if (dateTimeHour(now) === 0 && dateTimeDate(now).day === 1) {
        const v = views();
        for (const n of VIEW_NAMES) {
          const view = v[n]!;
          monthly.update(n + canonicalString(view.data) + view.version + view.dirty);
        }
        await macrotask();
      }
    }
    expect(simStateHash(sim)).toBe(GOLDEN_STATE);
    const v = views();
    const got: Record<string, [string, number]> = {};
    for (const n of VIEW_NAMES) got[n] = [sha(canonicalString(v[n]!.data)), v[n]!.version];
    expect(got).toEqual(GOLDEN_VIEWS);
    expect(monthly.digest("hex").slice(0, 24)).toBe(GOLDEN_MONTHLY);
    expect(patches.digest("hex").slice(0, 24)).toBe(GOLDEN_PATCHES);

    // The encoder against the reference, on the whole world and every view.
    const world = simWorld(sim);
    expect(canonicalString(world)).toBe(referenceCanonicalString(world));
    for (const n of VIEW_NAMES)
      expect(canonicalString(v[n]!.data)).toBe(referenceCanonicalString(v[n]!.data));
    // The JS lanes give the WebAssembly lanes' state hash.
    expect(hashOfCanonical(world, false)).toBe(hashOfCanonical(world, true));
  }, 120_000);

  it("the encoder writes every edge case as the reference does", () => {
    const shared = { a: 1 };
    const buf = appendBufFromRows([1, 2, 3]);
    (buf.slots as number[]).push(4); // a row another copy appended: not this copy's
    const many: Record<string, number> = {};
    for (let i = 0; i < 40; i++) many[`k${(i * 7) % 40}`] = i; // past the shape cache's key limit
    const values: unknown[] = [
      0,
      -0,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      1e21,
      5e-324,
      -1.5,
      "plain",
      'quote " backslash \\ tab \t newline \n',
      "é ü 漢字 🎉 \u0000  ",
      "lone \ud800 surrogate",
      true,
      false,
      null,
      [],
      {},
      [[], {}, [1, [2, [3]]]],
      { b: 1, a: 2, c: { z: 1, y: [1, 2] } },
      { a: 2, b: 1 },
      { a: 1, b: undefined, c: 3 },
      { only: undefined },
      { ä: 1, a: 2, B: 3, _: 4, "10": 5, "9": 6 },
      Object.assign(Object.create(null), { y: 1, x: 2 }),
      new Map<number | string, unknown>([
        [3, "c"],
        ["b", 2],
        [1, shared],
        ["a", [shared]],
      ]),
      new Set<number | string>([3, "b", 1, "a"]),
      buf,
      { slots: [1, 2], len: 1 },
      { slots: [1, 2], len: 1, extra: true },
      { slots: "not rows", len: 1 },
      many,
      // Same first key, different layouts, interleaved: the cache must tell them apart.
      [
        { k: 1, a: 2 },
        { k: 1, b: 2 },
        { k: 1, a: 2, b: 3 },
        { k: 1, a: 2 },
      ],
    ];
    for (const v of values) expect(canonicalString(v)).toBe(referenceCanonicalString(v));
    expect(canonicalString(values)).toBe(referenceCanonicalString(values));
    const bad: unknown[] = [
      [undefined],
      { $: 1 },
      new Float64Array(1),
      new Date(0),
      1n,
      () => 1,
      Symbol("s"),
    ];
    for (const v of bad) {
      expect(() => canonicalString(v)).toThrow();
      expect(() => referenceCanonicalString(v)).toThrow();
    }
  });

  it("the news feed rebuilt from the last build equals a fresh build and leaves the last alone", async () => {
    const sim = unwrap(simNew(data(), 2), "Sim::new");
    const other = unwrap(simNew(data(), 3), "Sim::new");
    const input = (s: typeof sim): ViewInput =>
      ({ world: simWorld(s), controls: simControls(s), seed: 2, map: null }) as unknown as ViewInput;
    const end = dateTimeMidnight(simDateYmd(2020, 4, 1));
    for (const s of [sim, other]) while (s.now() < dateTimeMidnight(simDateYmd(2020, 1, 20))) simStep(s);
    let checked = 0;
    while (sim.now() < end) {
      const before = simViews(sim).news.data;
      const kept = before.feed.slice();
      simStep(sim);
      if (dateTimeHour(sim.now()) !== 0) continue;
      const fresh = buildNews(input(sim));
      expect(rebuildNewsFrom(before, input(sim))).toEqual(fresh);
      expect(before.feed).toEqual(kept); // the last build is unchanged
      // A last build from another game is not a prefix of this feed: built afresh.
      expect(rebuildNewsFrom(simViews(other).news.data, input(sim))).toEqual(fresh);
      checked += 1;
      if (checked % 30 === 0) await macrotask();
    }
    expect(simViews(sim).news.data.feed.length).toBeGreaterThan(0);
  }, 60_000);

  it("the WebAssembly lanes hash the bytes the JS lanes and TextEncoder do", () => {
    const pieces = ["", "a", "foobar", "é", "漢字", "🎉", "\ud800", "x\udc00y", "\ud83c", '{"k":1.5}'];
    // A text longer than the WebAssembly memory, so it is fed in several pieces.
    let long = "";
    for (let i = 0; long.length < 400_000; i++) long += `${pieces[i % pieces.length]}${i * 0.1},`;
    for (const s of [...pieces, pieces.join(""), long]) {
      const wasm = stateHashOfText(s, true);
      expect(stateHashOfText(s, false)).toBe(wasm);
      // Lane A is plain FNV-1a 64 of the UTF-8 bytes.
      expect(wasm.slice(0, 16)).toBe(fnv1a64Hex(new TextEncoder().encode(s)));
    }
    expect(stateHashOfText("a", true).slice(0, 16)).toBe("af63dc4c8601ec8c");
  });
});
