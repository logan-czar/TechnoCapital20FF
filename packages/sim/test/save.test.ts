import { gzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { canonicalRevive, canonicalString } from "../src/canonical.ts";
import { fnv1a64Hex, HASH_FORMAT, stateHash, stateHashShort } from "../src/hash.ts";
import { rngStreamsDraws, rngStreamsEq, rngStreamsNew } from "../src/rng.ts";
import { decode, encode, encodeVersioned, SAVE_MAGIC, SAVE_VERSION, saveErrorMessage } from "../src/save.ts";
import type { Controls } from "../src/types/control.ts";
import { STREAM_VALUES } from "../src/types/draws.ts";
import type { World } from "../src/types/world.ts";
import {
  appendBufRows,
  type ChunkLog,
  chunkLogClone,
  chunkLogNew,
  chunkLogPush,
  chunkLogRows,
} from "../src/world/log.ts";
import { alertLevelsDefault } from "../src/world/notice.ts";

type Bar = { day: number; close: number };
const month = (a: Bar, b: Bar) => Math.floor(a.day / 30) === Math.floor(b.day / 30);

/** A world-shaped value with every encoding case: floats, a chunk log, nested tables. */
function fakeWorld(): World {
  const log: ChunkLog<Bar> = chunkLogNew();
  for (let i = 0; i < 70; i++) chunkLogPush(log, { day: i, close: 100 + i / 3 }, month);
  return {
    clock: 123,
    zones: [{ key: "Z1", intensity: 1.0, confidence: -0 }],
    base_rate: 0.1 + 0.2,
    cycle: { phase: "Expansion", g_history: [0.01, Number.NaN, Number.POSITIVE_INFINITY] },
    market: { log },
    name_books: { ok: true, nothing: null },
  } as unknown as World;
}

function marketLog(w: World): ChunkLog<Bar> {
  return (w.market as unknown as { log: ChunkLog<Bar> }).log;
}

function controls(): Controls {
  return {
    speed: 3,
    paused: true,
    skip: null,
    alerts: alertLevelsDefault(),
    omniscient: false,
    watchlist: new Set([9, 2, 5]) as Controls["watchlist"],
  };
}

describe("canonical encoding", () => {
  it("writes keys sorted and round-trips NaN, infinities, -0 and shortest floats exactly", () => {
    const a = [
      Number.NaN,
      -0,
      0,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      0.1 + 0.2,
      5e-324,
      1e21,
    ];
    const text = canonicalString({ b: 1, a });
    expect(text.startsWith('{"a":[')).toBe(true);
    const back = (canonicalRevive(JSON.parse(text)) as { a: number[] }).a;
    expect(back.length).toBe(a.length);
    for (let i = 0; i < a.length; i++) expect(Object.is(back[i], a[i])).toBe(true);
  });

  it("is independent of key insertion order and sorts Map and Set contents", () => {
    expect(canonicalString({ x: 1, y: 2 })).toBe(canonicalString({ y: 2, x: 1 }));
    const m1 = new Map<number, string>([
      [2, "b"],
      [1, "a"],
    ]);
    const m2 = new Map<number, string>([
      [1, "a"],
      [2, "b"],
    ]);
    expect(canonicalString(m1)).toBe(canonicalString(m2));
    expect(canonicalString(new Set([3, 1, 2]))).toBe(canonicalString(new Set([1, 2, 3])));
    const back = canonicalRevive(JSON.parse(canonicalString({ m: m1, s: new Set(["b", "a"]) }))) as {
      m: Map<number, string>;
      s: Set<string>;
    };
    expect([...back.m]).toEqual([
      [1, "a"],
      [2, "b"],
    ]);
    expect([...back.s]).toEqual(["a", "b"]);
  });

  it("refuses typed arrays and what it cannot hold", () => {
    expect(() => canonicalString({ t: new Float64Array([1, 2.5]) })).toThrow(/typed arrays/);
    expect(() => canonicalRevive(JSON.parse('{"__proto__":{"x":1}}'))).toThrow();
    expect(() => canonicalString({ f: () => 1 })).toThrow();
    expect(() => canonicalString({ d: new Date(0) })).toThrow();
    expect(() => canonicalString({ n: 10n })).toThrow();
    expect(() => canonicalString([undefined])).toThrow();
    expect(() => canonicalString({ $: 1 })).toThrow();
    expect(canonicalString({ skipped: undefined, kept: 1 })).toBe('{"kept":1}');
  });

  it("writes an append buffer as only the rows it owns", () => {
    const a = chunkLogNew<number>();
    for (const i of [1, 2, 3]) chunkLogPush(a, i, () => true);
    const b = chunkLogClone(a);
    chunkLogPush(a, 4, () => true); // fills a slot past b's length
    expect(canonicalString(b)).not.toContain("4");
    const back = canonicalRevive(JSON.parse(canonicalString(a))) as typeof a;
    expect(appendBufRows(back.open)).toEqual([1, 2, 3, 4]);
    expect(chunkLogRows(back)).toEqual([1, 2, 3, 4]);
  });
});

describe("save.ts", () => {
  it("round-trips the world, the RNG positions with spare normals, and the controls", () => {
    const world = fakeWorld();
    const rng = rngStreamsNew(11);
    const d = rngStreamsDraws(rng);
    STREAM_VALUES.forEach((s, i) => {
      for (let k = 0; k < 10 * i + 3; k++) d.normal(s);
    });
    const ctl = controls();
    const bytes = encode(world, rng, ctl);
    expect([...bytes.subarray(0, 8)]).toEqual([...SAVE_MAGIC]);
    const r = decode(bytes);
    if (!r.ok) throw new Error(saveErrorMessage(r.error));
    const back = r.value;
    expect(canonicalString(back.world)).toBe(canonicalString(world));
    expect(Object.is((back.world.zones[0] as unknown as { confidence: number }).confidence, -0)).toBe(true);
    expect(rngStreamsEq(back.rng, rng)).toBe(true);
    expect([...back.controls.watchlist]).toEqual([2, 5, 9]);
    expect(back.controls.alerts).toEqual(ctl.alerts);
    const db = rngStreamsDraws(back.rng);
    for (const s of STREAM_VALUES) {
      for (let k = 0; k < 50; k++) expect(Object.is(db.normal(s), d.normal(s))).toBe(true);
    }
  });

  it("saves are deterministic bytes", () => {
    const a = encode(fakeWorld(), rngStreamsNew(1), controls());
    const b = encode(fakeWorld(), rngStreamsNew(1), controls());
    expect(a).toEqual(b);
  });

  it("refuses saves of another version, older or newer", () => {
    const old = (v: number) => encodeVersioned(v, fakeWorld(), rngStreamsNew(5), controls());
    for (const v of [0, SAVE_VERSION + 1, SAVE_VERSION + 10]) {
      const r = decode(old(v));
      if (r.ok) throw new Error("should refuse");
      expect(r.error).toEqual({ kind: "Version", found: v });
    }
    const older = decode(old(0));
    expect(!older.ok && saveErrorMessage(older.error)).toContain("older");
    const newer = decode(old(SAVE_VERSION + 1));
    expect(!newer.ok && saveErrorMessage(newer.error)).toContain("newer");
    expect(decode(old(SAVE_VERSION)).ok).toBe(true);
  });

  it("refuses bad saves", () => {
    expect(decode(new TextEncoder().encode("nope"))).toEqual({ ok: false, error: { kind: "BadMagic" } });
    expect(decode(new Uint8Array())).toEqual({ ok: false, error: { kind: "BadMagic" } });
    const kind = (bytes: Uint8Array) => {
      const r = decode(bytes);
      return r.ok ? "ok" : r.error.kind;
    };
    const wrap = (body: Uint8Array) => new Uint8Array([...SAVE_MAGIC, ...body]);
    const json = (o: unknown) => wrap(gzipSync(new TextEncoder().encode(JSON.stringify(o))));
    expect(kind(wrap(new TextEncoder().encode("not gzip")))).toBe("Format");
    expect(kind(wrap(gzipSync(new TextEncoder().encode("{oops"))))).toBe("Format"); // not JSON
    expect(kind(json({}))).toBe("Format");
    expect(kind(json({ version: SAVE_VERSION, state: {} }))).toBe("Format");
    // A truncated save.
    const full = encode(fakeWorld(), rngStreamsNew(1), controls());
    expect(kind(full.subarray(0, full.length - 20))).toBe("Format");
    // A bad rng block.
    const e = decode(
      json({
        version: SAVE_VERSION,
        state: { world: {}, controls: {}, rng: { seed: 1, state: [], spare: [] } },
      }),
    );
    expect(!e.ok && saveErrorMessage(e.error)).toContain("bad rng");
  });
});

describe("hash.ts", () => {
  it("FNV-1a 64 matches the published test vectors", () => {
    const enc = (s: string) => new TextEncoder().encode(s);
    expect(fnv1a64Hex(enc(""))).toBe("cbf29ce484222325");
    expect(fnv1a64Hex(enc("a"))).toBe("af63dc4c8601ec8c");
    expect(fnv1a64Hex(enc("foobar"))).toBe("85944171f73967e8");
  });

  it("same state gives the same hash, and any field change gives another", () => {
    const h = stateHash(fakeWorld(), rngStreamsNew(7));
    expect(h).toMatch(/^[0-9a-f]{32}$/);
    expect(stateHashShort(h)).toBe(h.slice(0, 16));
    expect(stateHash(fakeWorld(), rngStreamsNew(7))).toBe(h);
    expect(HASH_FORMAT).toBe(1);

    const changes: ((w: World) => void)[] = [
      (w) => {
        w.clock += 1;
      },
      (w) => {
        w.base_rate = 0.3; // one ulp from 0.1 + 0.2
      },
      (w) => {
        (w.zones[0] as unknown as { confidence: number }).confidence = 0; // -0 vs 0
      },
      (w) => {
        w.cycle.g_history[1] = 0; // NaN vs 0
      },
      (w) => {
        (w as unknown as { extra: number }).extra = 1;
      },
      (w) => {
        chunkLogPush(marketLog(w), { day: 70, close: 1 }, month);
      },
    ];
    const seen = new Set<string>([h]);
    for (const [i, change] of changes.entries()) {
      const w = fakeWorld();
      change(w);
      const h2 = stateHash(w, rngStreamsNew(7));
      expect(seen.has(h2), `change ${i}`).toBe(false);
      seen.add(h2);
    }
    // The RNG is part of the hash: seed, position and spare normal.
    expect(stateHash(fakeWorld(), rngStreamsNew(8))).not.toBe(h);
    const rng = rngStreamsNew(7);
    rngStreamsDraws(rng).uniform("Cycle");
    expect(stateHash(fakeWorld(), rng)).not.toBe(h);
    const rng2 = rngStreamsNew(7);
    rngStreamsDraws(rng2).normal("Cycle");
    const rng3 = rngStreamsNew(7);
    rngStreamsDraws(rng3).normal("Cycle");
    rngStreamsDraws(rng3).normal("Cycle"); // uses the spare: same positions, spare gone
    expect(stateHash(fakeWorld(), rng2)).not.toBe(stateHash(fakeWorld(), rng3));
  });

  it("does not see rows another copy appended to a shared buffer", () => {
    const w = fakeWorld();
    const before = stateHash(w, rngStreamsNew(1));
    const other = chunkLogClone(marketLog(w));
    chunkLogPush(other, { day: 70, close: 2 }, month);
    expect(stateHash(w, rngStreamsNew(1))).toBe(before);
  });

  it("a saved and loaded state hashes the same", () => {
    const world = fakeWorld();
    const rng = rngStreamsNew(3);
    rngStreamsDraws(rng).normal("Prices");
    const r = decode(encode(world, rng, controls()));
    if (!r.ok) throw new Error("decode");
    expect(stateHash(r.value.world, r.value.rng)).toBe(stateHash(world, rng));
  });
});
