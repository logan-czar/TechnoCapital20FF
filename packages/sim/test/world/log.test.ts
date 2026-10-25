import { describe, expect, it } from "vitest";
import {
  appendBufClone,
  appendBufFromRows,
  appendBufNew,
  appendBufPush,
  appendBufRows,
  appendBufSharesWith,
  chunkLogClone,
  chunkLogDropWhile,
  chunkLogFindSorted,
  chunkLogFromRepr,
  chunkLogIsEmpty,
  chunkLogIterFrom,
  chunkLogLast,
  chunkLogLen,
  chunkLogNew,
  chunkLogOpenChunk,
  chunkLogPush,
  chunkLogRows,
  chunkLogSharesWith,
  chunkLogToRepr,
} from "../../src/world/log.ts";

const byTen = (a: number, b: number) => Math.floor(a / 10) === Math.floor(b / 10);

describe("world/log.ts", () => {
  it("chunks by key and drops a prefix", () => {
    const log = chunkLogNew<number>();
    for (const i of [1, 2, 11, 12, 13, 25, 31]) chunkLogPush(log, i, byTen);
    expect(chunkLogRows(log)).toEqual([1, 2, 11, 12, 13, 25, 31]);
    expect([chunkLogLen(log), chunkLogLast(log)]).toEqual([7, 31]);
    expect([...chunkLogOpenChunk(log)]).toEqual([31]);
    const copy = chunkLogClone(log);
    expect(chunkLogSharesWith(copy, log)).toBe(true);
    chunkLogPush(log, 32, byTen);
    expect(chunkLogSharesWith(copy, log)).toBe(false);
    expect(chunkLogLen(copy)).toBe(7); // the copy keeps what it saw
    chunkLogDropWhile(log, (r) => r < 12);
    expect(chunkLogRows(log)).toEqual([12, 13, 25, 31, 32]);
    chunkLogDropWhile(log, (r) => r < 40);
    expect(chunkLogIsEmpty(log)).toBe(true);
    expect(chunkLogLast(log)).toBeNull();
  });

  it("copies that both push keep their own rows", () => {
    const a = chunkLogNew<number>();
    for (const i of [1, 2, 3]) chunkLogPush(a, i, byTen);
    const b = chunkLogClone(a);
    chunkLogPush(a, 4, byTen);
    // b's next slot is taken by a: b copies and goes its own way.
    chunkLogPush(b, 9, byTen);
    chunkLogPush(b, 10, byTen);
    expect(chunkLogRows(a)).toEqual([1, 2, 3, 4]);
    expect(chunkLogRows(b)).toEqual([1, 2, 3, 9, 10]);
    // Across many chunks, a copy taken before each push keeps its length.
    const c = chunkLogNew<number>();
    const want: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const keep = chunkLogClone(c);
      chunkLogPush(c, i, (x, y) => Math.floor(x / 100) === Math.floor(y / 100));
      want.push(i);
      expect(chunkLogLen(keep)).toBe(want.length - 1);
    }
    expect(chunkLogRows(c)).toEqual(want);
    expect([...chunkLogOpenChunk(c)].length).toBe(100);
  });

  it("an append buffer fills a free slot in place and copies on a clash", () => {
    const a = appendBufFromRows([1, 2]);
    const b = appendBufClone(a);
    expect(appendBufSharesWith(a, b)).toBe(true);
    appendBufPush(a, 3);
    expect(a.slots).toBe(b.slots); // filled in place
    expect(appendBufRows(b)).toEqual([1, 2]); // b never sees slot 2
    appendBufPush(b, 9); // slot taken: b copies
    expect(b.slots).not.toBe(a.slots);
    expect(appendBufRows(a)).toEqual([1, 2, 3]);
    expect(appendBufRows(b)).toEqual([1, 2, 9]);
    expect(appendBufRows(appendBufNew<number>())).toEqual([]);
  });

  it("finds a row by its sorted key", () => {
    const log = chunkLogNew<number>();
    const rows = Array.from({ length: 500 }, (_, i) => i * 3);
    for (const i of rows) chunkLogPush(log, i, (a, b) => Math.floor(a / 40) === Math.floor(b / 40));
    const id = (r: number) => r;
    for (const i of rows) {
      expect(chunkLogFindSorted(log, i, id)).toBe(i);
      expect(chunkLogFindSorted(log, i + 1, id)).toBeNull();
    }
    expect(chunkLogFindSorted(log, 5000, id)).toBeNull();
    chunkLogDropWhile(log, (r) => r < 100);
    expect(chunkLogFindSorted(log, 102, id)).toBe(102);
    expect(chunkLogFindSorted(log, 99, id)).toBeNull(); // dropped
    expect(chunkLogFindSorted(chunkLogNew<number>(), 0, id)).toBeNull();
    // From a key on: every later row, in order, whatever chunk the key falls in.
    for (const k of [0, 100, 101, 119, 120, 600, 1497, 1498, 2000]) {
      const want = chunkLogRows(log).filter((r) => r >= k);
      expect([...chunkLogIterFrom(log, k, id)]).toEqual(want);
    }
    // Non-descending keys: the first row of a run.
    const runs = chunkLogNew<number>();
    for (let i = 0; i < 300; i++) chunkLogPush(runs, i, (a, b) => Math.floor(a / 50) === Math.floor(b / 50));
    const from = [...chunkLogIterFrom(runs, 10, (r) => Math.floor(r / 7))].slice(0, 3);
    expect(from).toEqual([70, 71, 72]);
  });

  it("converts to and from the saved repr (the pre-D401 layout)", () => {
    const log = chunkLogNew<number>();
    for (const i of [1, 2, 11, 12, 13, 25, 31, 32]) chunkLogPush(log, i, byTen);
    const copy = chunkLogClone(log);
    chunkLogPush(copy, 33, byTen); // fills a slot the original must not own
    const repr = chunkLogToRepr(log);
    expect(repr).toEqual({ closed: [[1, 2], [11, 12, 13], [25]], open: [31, 32] });
    const back = chunkLogFromRepr(JSON.parse(JSON.stringify(repr)));
    expect(chunkLogRows(back)).toEqual(chunkLogRows(log));
    expect(chunkLogToRepr(copy).open).toEqual([31, 32, 33]);
  });
});
