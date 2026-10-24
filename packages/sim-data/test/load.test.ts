import { describe, expect, it } from "vitest";
import { type DataError, dataErrorToString } from "../src/error.ts";
import { f64, loadTable, rowSpec, semiList, str, u32, yesNo } from "../src/load.ts";

interface Row {
  id: string;
  n: number;
  flag: boolean;
  tags: string[];
}
const SPEC = rowSpec<Row>({ id: str, n: u32, flag: yesNo, tags: semiList });

function fail(text: string): DataError {
  const r = loadTable({ "t.csv": text }, "t.csv", SPEC);
  if (r.ok) throw new Error("expected an error");
  return r.error;
}

describe("loadTable", () => {
  it("loads rows with their lines", () => {
    const r = loadTable({ "t.csv": "id,n,flag,tags\r\na,1,Y,x;y\r\nb,2,N,\r\n" }, "t.csv", SPEC);
    expect(r.ok && r.value.rows).toEqual([
      { id: "a", n: 1, flag: true, tags: ["x", "y"] },
      { id: "b", n: 2, flag: false, tags: [] },
    ]);
    expect(r.ok && r.value.lines).toEqual([2, 3]);
  });

  it("names the line and field of a bad value", () => {
    const e = fail("id,n,flag,tags\na,1,Y,\nb,-3,N,\n");
    expect([e.file, e.line, e.field]).toEqual(["t.csv", 3, "n"]);
    expect(dataErrorToString(e)).toBe("t.csv:3: field `n`: invalid digit found in string");
    expect(fail("id,n,flag,tags\na,1,maybe,\n").message).toBe("expected Y or N, found `maybe`");
  });

  it("names a short row, a missing column and an unknown column", () => {
    const short = fail("id,n,flag,tags\na,1,Y,\nb,2\n");
    expect([short.line, short.field, short.message]).toEqual([3, null, "row has 2 fields, the header has 4"]);
    const missing = fail("id,n,flag\na,1,Y\n");
    expect([missing.line, missing.field]).toEqual([2, "tags"]);
    const unknown = fail("id,n,flag,tags,extra\na,1,Y,,1\n");
    expect([unknown.line, unknown.field]).toEqual([2, "extra"]);
  });

  it("reports a missing file by name", () => {
    const r = loadTable({}, "none.csv", SPEC);
    expect(!r.ok && [r.error.file, r.error.line]).toEqual(["none.csv", null]);
  });
});

describe("f64", () => {
  it("parses like Rust str::parse::<f64>", () => {
    for (const [s, v] of [
      ["1.5", 1.5],
      ["-2", -2],
      ["+3", 3],
      [".5", 0.5],
      ["5.", 5],
      ["1e3", 1000],
      ["inf", Number.POSITIVE_INFINITY],
      ["-Infinity", Number.NEGATIVE_INFINITY],
    ] as const) {
      expect(f64(s)).toEqual({ ok: true, value: v });
    }
    expect(f64("").ok).toBe(false);
    for (const s of ["1_0", " 1", "1 ", ".", "e5", "1e", "0x10"]) expect(f64(s).ok).toBe(false);
  });
});
