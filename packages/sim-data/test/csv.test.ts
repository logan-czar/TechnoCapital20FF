import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/csv.ts";

// The Rust csv reader behaviours the data files rely on (load.rs): BOM, CRLF, quoted newlines,
// empty lines, and the start line of each record.
describe("parseCsv", () => {
  it("drops a BOM and reads CRLF", () => {
    const r = parseCsv("\uFEFFa,b\r\n1,2\r\n3,4\r\n");
    expect(r.records).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
    expect(r.lines).toEqual([1, 2, 3]);
  });

  it("keeps quoted commas, escaped quotes and newlines, and counts lines", () => {
    const r = parseCsv('a,b\n"x,1","he said ""hi"""\n"two\nlines",z\nlast,row');
    expect(r.records[1]).toEqual(["x,1", 'he said "hi"']);
    expect(r.records[2]).toEqual(["two\nlines", "z"]);
    expect(r.lines).toEqual([1, 2, 3, 5]);
  });

  it("skips empty lines and reads a trailing comma as an empty field", () => {
    const r = parseCsv("a,b\n\n1,\n");
    expect(r.records).toEqual([
      ["a", "b"],
      ["1", ""],
    ]);
    expect(r.lines).toEqual([1, 3]);
  });
});
