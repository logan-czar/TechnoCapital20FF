import { describe, expect, it } from "vitest";
import { type DataError, dataErrorToString } from "../src/error.ts";
import { f64, loadTable, oneOf, optF64, rowSpec, semiList, str, u8, u32, yesNo } from "../src/load.ts";

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

describe("serde-compatible details", () => {
  it("formats expected lists like serde OneOf", () => {
    expect(oneOf([])).toBe("there are no fields");
    expect(oneOf(["a"])).toBe("expected `a`");
    expect(oneOf(["a", "b"])).toBe("expected `a` or `b`");
    expect(oneOf(["a", "b", "c"])).toBe("expected one of `a`, `b`, `c`");
    const e = fail("id,n,flag,tags,x\na,1,Y,,1\n");
    expect(e.message).toBe("unknown field `x`, expected one of `id`, `n`, `flag`, `tags`");
  });

  it("reads a 0x prefix as hex in integer columns", () => {
    expect(u32("0x1F")).toEqual({ ok: true, value: 31 });
    expect(u8("0x100").ok).toBe(false);
    expect(u32("0x").ok).toBe(false);
    expect(u32("0xZ").ok).toBe(false);
    const r = loadTable({ "t.csv": "id,n,flag,tags\na,0x10,Y,\n" }, "t.csv", SPEC);
    expect(r.ok && r.value.rows[0]?.n).toBe(16);
  });

  it("fills a wholly missing Option column with null", () => {
    interface O {
      id: string;
      v: number | null;
    }
    const spec = rowSpec<O>({ id: str, v: optF64 });
    const r = loadTable({ "o.csv": "id\na\n" }, "o.csv", spec);
    expect(r.ok && r.value.rows).toEqual([{ id: "a", v: null }]);
  });

  it("reports invalid UTF-8 with its line and field", () => {
    const bytes = new Uint8Array([
      ...new TextEncoder().encode("id,n,flag,tags\na,1,Y,\nb"),
      0xff,
      ...new TextEncoder().encode(",2,N,\n"),
    ]);
    const r = loadTable({ "t.csv": bytes }, "t.csv", SPEC);
    expect(!r.ok && [r.error.line, r.error.field, r.error.message]).toEqual([3, "id", "not valid UTF-8"]);
  });
});
