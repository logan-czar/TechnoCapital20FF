// Pins a year of seed 1 to the results main gave before the ts4 speed-ups (the yearly state hash
// encoder and WebAssembly lanes, the projection copy sharing archives, the RNG without closures,
// and the news, recap and statements views reusing their last builds). Not a Rust test.
//
// The golden digests below were recorded on main 00564ee (before any of those changes) by
// running exactly this loop, and re-recorded for the politics POC (D980: the state and
// `news` moved and `politics` is new; a 10-year main comparison kept the economy views
// byte-identical). They change ONLY with an intended change of behaviour (a new job, a
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

// Re-recorded for D1042 (lane P, the player): v_account and v_notifications have builders now, rebuilt every tick, so their versions (1 to 8785), the monthly digest and the patch digest moved; their data (empty: this world never hydrates, so it has no player), the state hash and every other view are unchanged.
// Re-recorded for D1037 (the pivot's M2 contracts): the world gained `persons`, `elections`, `player` and four geo tables, so the state hash moved; v_clock gained `fixed_pauses` and five pivot views' empty values gained fields (forecast `states`, people `chambers`, account `settlements`, notifications `read_through`, usmap_layers `turnout` and `last_votes`), so those digests and the monthly digest moved; the patch digest is unchanged. A probe of 24 month starts of this world and 36 of the 1995 world found the state hash without the new fields, and the 30 older views (the clock without `fixed_pauses`), equal to the base's at every one.
// Re-recorded for D1029 (the pivot's M1 contracts): the world gained `fidelity`, `levers` and `geo`, each industry `row_assets`, and the saved RNG five streams, so the state hash moved; 13 unported pivot views joined the list, each empty at version 1, so the monthly digest moved. The hash of the state without those fields and streams is still a56475a84805444ae625018f75a3481a, and the 30 older views' digests, the monthly digest over those 30 (d7d84581a03b2f6844e20a4e) and the patch digest are unchanged.
// Re-recorded for D1022: the profile gained `exits`, so the state hash moved; every view, monthly and patch digest below is unchanged (legacy behaviour is identical).
// Re-recorded for D1023: the profile gained `winners` (after D1022's `exits`), so the state hash moved; every view, monthly and patch digest below is unchanged (legacy behaviour is identical).
// Re-recorded for D1024: the Events stream joined the saved RNG and the profile gained `seat_events` (after D1022's `exits` and D1023's `winners`), so the state hash moved; every view, monthly and patch digest below is unchanged (legacy plays no seat event).
// Re-recorded for D996: v_history gained the sector series, so its digest and the monthly digest moved; the state hash, the patch digest and every other view are unchanged.
// Re-recorded for D995: v_history gained the macro series, so its digest and the monthly digest moved; the state hash, the patch digest and every other view are unchanged.
// Re-recorded for D994: the Era stream joined the saved RNG (the state hash moved) and v_history is new (the monthly and patch digests moved); every other view digest is unchanged, and a 10-year soak's economy columns are identical.
// Re-recorded for D989: full characters are removed (no founders, no character table; controllers are base characters), so startup draws and the births, characters, cap_table, company_rows and company_detail views moved and the economy after the first births with them.
// Re-recorded for D975: v_clock gained the watchlist and Omniscient, so the clock and monthly digests moved; the state hash and patch digests are unchanged (controls are not hashed, D13).
// Re-recorded for D974: LOW_PRODUCTIVITY_ADJ is +1.0 (was +0.5), so the R&D plan, productivity and everything after it moved: the state hash, the monthly and patch digests and the views that carry the economy.
// Re-recorded for D973: R&D above the norm has diminishing returns by default (spec 5.6 has no curve), so productivity and everything after it moved: the state hash, the monthly and patch digests and the views that carry the economy.
// Re-recorded for D970: the world gained a `profile` field, so its hash moved; every view, monthly and patch digest below is unchanged (legacy behaviour is identical).
const GOLDEN_STATE = "17bb726a620fc38aa6dd8b7c34df917a";
const GOLDEN_MONTHLY = "2c9818ae80154800b8c1bbde";
const GOLDEN_PATCHES = "76530ecc32a826c2e358bd73";
/** Each view's canonical JSON digest and version at 2021-01-01 00:00, seed 1. */
const GOLDEN_VIEWS: Record<string, [string, number]> = {
  clock: ["f7cc508c07c87cda3927d6d8", 8785],
  places: ["0bbcb0e819952b7c5f894c81", 1],
  countries: ["9de3a27ea9c7d773796efa55", 8785],
  zones: ["f5a9ead33682b6eadff6ec2a", 8785],
  rates: ["efc3668ad8d3cca8ad0790ce", 8785],
  characters: ["4e22b8cb324effaa5debfe43", 8785],
  cap_table: ["a0e42ad318ea2122ca3376f4", 8785],
  quotes: ["493e8991f053c61006873dd9", 8785],
  price_bars: ["c6009fc44df02a5b8efe0ccf", 8785],
  exchanges: ["f9ad17ddceb82daf963d9dc5", 8785],
  market_stats: ["a4767a4f080e65d7ae867fa9", 8785],
  news: ["a12bfa1a835b9ceb39410afb", 8785],
  births: ["a25a57ae0f74c20a3e245545", 8785],
  projection: ["c6ead432d10a12fb7292f298", 8785],
  company_rows: ["c2fa4edb1243e15ddceaee77", 8785],
  company_detail: ["94b36e84ab7e1705cbf2e0de", 8785],
  units: ["cb69926b999a5370e0151a1c", 8785],
  tech: ["873075c31033e457e97081cd", 8785],
  industry_rows: ["d23253d17d86f236ddd85de4", 8785],
  industry_detail: ["6835abecc510d882dd17e967", 8785],
  cycle: ["b157722d749ca2fbcd91539e", 8785],
  map_layers: ["3cad1ea7b12b8809ad9cbddf", 8785],
  province_cards: ["99af44d8ca87df8c02fe718d", 8785],
  statements: ["4b85ccb062ebd376e1b33ac8", 8785],
  filings: ["a5919099c8619a549d618894", 8785],
  ratings: ["5c79f5bdbb0789c46f43032d", 8785],
  recap: ["c8717fb08e77f7127d3aefac", 8785],
  map_static: ["5a7fcdac19a0f147f840d02c", 1],
  politics: ["caa00cde3b21fa9198792d48", 8785],
  history: ["0259c604ed0adc2b0ebe9e35", 8785],
  feed: ["8440424e3e953d9ce88266ab", 1],
  social: ["41acd9a2c224b075b28c0aaf", 1],
  polls: ["66f490e3432976fdbfc95485", 1],
  forecast: ["e3ae3632c2838aeb6d729301", 1],
  races: ["59923a8a46fcb9581c1acb8a", 1],
  people: ["26707fe6db39003d15281499", 1],
  records: ["6df68f989ab8c28290a21f7d", 1],
  markets: ["3312b062bb7ccfa55b0b7d0a", 1],
  account: ["39647396081a417498294a57", 8785],
  notifications: ["924140588434f28477897e50", 8785],
  districts: ["d2162f6f6799d28562484c4a", 1],
  usmap_layers: ["12fc1f378991a03ed0dc45e6", 1],
  returns: ["2492e5a3c809942bb06a61ed", 1],
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
