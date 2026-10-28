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
import { canonicalEncodeChunked, canonicalString } from "../src/canonical.ts";
import { fnv1a64Hex, fnvWasmRuns, hashOfCanonical, stateHashOfText } from "../src/hash.ts";
import { simControls, simNew, simStateHash, simStep, simViews, simWorld } from "../src/lib.ts";
import { dateTimeDate, dateTimeHour, dateTimeMidnight, simDateYmd } from "../src/time/calendar.ts";
import { VIEW_NAMES } from "../src/types/views/index.ts";
import type { ViewInput } from "../src/views/index.ts";
import { buildNews, rebuildNewsFrom } from "../src/views/news.ts";
import { postedViewsNone, viewsPatchSince } from "../src/views/patch.ts";
import { appendBufFromRows } from "../src/world/log.ts";
import { referenceCanonicalString } from "./common/canonical_reference.ts";
import { data, macrotask, unwrap } from "./common/index.ts";

// Re-recorded for D975: v_clock gained the watchlist and Omniscient, so the clock and monthly digests moved; the state hash and patch digests are unchanged (controls are not hashed, D13).
// Re-recorded for D974: LOW_PRODUCTIVITY_ADJ is +1.0 (was +0.5), so the R&D plan, productivity and everything after it moved: the state hash, the monthly and patch digests and the views that carry the economy.
// Re-recorded for D973: R&D above the norm has diminishing returns by default (spec 5.6 has no curve), so productivity and everything after it moved: the state hash, the monthly and patch digests and the views that carry the economy.
// Re-recorded for D970: the world gained a `profile` field, so its hash moved; every view, monthly and patch digest below is unchanged (legacy behaviour is identical).
const GOLDEN_STATE = "a2398e39d3da8d5b4b3e4d3a8f5a248b";
const GOLDEN_MONTHLY = "e8bbac3c479a262a85658fa9";
const GOLDEN_PATCHES = "21ec381f13a34346cf190ba5";
/** Each view's canonical JSON digest and version at 2021-01-01 00:00, seed 1. */
const GOLDEN_VIEWS: Record<string, [string, number]> = {
  clock: ["c1ac8c59305fb039b9c693fe", 8785],
  places: ["0bbcb0e819952b7c5f894c81", 1],
  countries: ["c301b680d07687f003502ff1", 8785],
  zones: ["d76cb24168a522eeb27c74f9", 8785],
  rates: ["efc3668ad8d3cca8ad0790ce", 8785],
  characters: ["6711368fd570d5be67b4907c", 8785],
  cap_table: ["431cb986a2a22582a02c7a6b", 8785],
  quotes: ["41ec241f7f471bd22f926d8b", 8785],
  price_bars: ["5bf7fdf81de8b00d59e62ba8", 8785],
  exchanges: ["d18ac097c3d27f7efcb07e5d", 8785],
  market_stats: ["a1582f6405cdddfbecad511a", 8785],
  news: ["bc2ffd401b4d07827d53a1b3", 8785],
  births: ["b3db0f5c4a252cec3e1517c3", 8785],
  projection: ["0c778df1102d9f85d7b4f70d", 8785],
  company_rows: ["1f5cb5e7861bdfaf9d43d382", 8785],
  company_detail: ["88d2f838c64882fc37512a34", 8785],
  units: ["89153622085915ad4dcf3713", 8785],
  tech: ["b0d0fee2792120332eb342fd", 8785],
  industry_rows: ["2dc0da72c16ca74a2b9ef6d1", 8785],
  industry_detail: ["9d77e1ffa2c3053b6d8370c5", 8785],
  cycle: ["469076c6b66956ef69ed5fc8", 8785],
  map_layers: ["1390cfbc031a839e20797d59", 8785],
  province_cards: ["8cf4549c5ca68b7068b6b210", 8785],
  statements: ["57735a2af1583dea573ab927", 8785],
  filings: ["049b14e3e9a396103c33c3c9", 8785],
  ratings: ["1a54c9b62e8689965e82403e", 8785],
  recap: ["a92bb2a99f2107f1c5229475", 8785],
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
    // Otherwise every comparison below would set the JS lanes against themselves.
    expect(fnvWasmRuns()).toBe(true);
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

  it("the encoder cuts long flat arrays into pieces near the chunk size", () => {
    const value = {
      nums: Array.from({ length: 50_000 }, (_, i) => i * 0.25),
      strs: Array(5_000).fill("é漢🎉"),
    };
    const pieces: string[] = [];
    canonicalEncodeChunked(value, (p) => pieces.push(p), 1_000);
    expect(pieces.join("")).toBe(canonicalString(value));
    expect(pieces.length).toBeGreaterThan(100);
    // A piece goes over the chunk by at most one element.
    for (const p of pieces) expect(p.length).toBeLessThan(1_100);
  });
});
