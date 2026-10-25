// Port of crates/sim-data/tests/load_errors.rs: a bad row is rejected with its file, line and
// field (spec 10 M0, build-plan M0.3).
//
// Expects:
//   "@tc20ff/sim-data": parseWorld(files: Record<string, string>) -> Result<WorldData, DataError>;
//   DataError { file, line: number | null, field: string | null, message }.
//   "@tc20ff/sim-data/node": defaultDataDir.
//
// Changed from the Rust: load_table::<Country>(dir, file) is not part of the agreed pure API, so
// each case feeds the fixture text to parseWorld as countries.csv (the first table load_world
// reads, so its error is the one returned) beside the other files of the real data. The reported
// file is therefore "countries.csv" instead of the fixture name; line, field and message are
// asserted as in the Rust. The fixtures are CRLF files but .gitattributes folds packages/** to
// LF on checkout, so fixture() restores CRLF (the crlf test needs it).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DataError } from "@tc20ff/sim-data";
import { parseWorld } from "@tc20ff/sim-data";
import { defaultDataDir } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { errText } from "./helpers.ts";

// test/fixtures from test/pending, and from test/ once promoted.
const FIXTURES =
  [join(import.meta.dirname, "fixtures"), join(import.meta.dirname, "..", "fixtures")].find((p) =>
    existsSync(p),
  ) ?? "";

/** Every CSV of the data directory (relative path with / separators to text). */
function realFiles(): Record<string, string> {
  const root = defaultDataDir();
  const out: Record<string, string> = {};
  const walk = (rel: string): void => {
    for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
      const r = rel === "" ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) walk(r);
      else if (r.endsWith(".csv")) out[r] = readFileSync(join(root, r), "utf8");
    }
  };
  walk("");
  return out;
}

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8").replace(/\r?\n/g, "\r\n");
}

function loadErr(name: string): DataError {
  const files = realFiles();
  files["countries.csv"] = fixture(name);
  const r = parseWorld(files);
  if (r.ok) throw new Error(`fixture should fail to load: ${name}`);
  return r.error;
}

function assertAt(e: DataError, line: number | null, field: string | null): void {
  expect(e.file, errText(e)).toBe("countries.csv");
  expect(e.line, errText(e)).toBe(line);
  expect(e.field, errText(e)).toBe(field);
}

describe("load errors", () => {
  it("bad_number_names_line_and_field", () => {
    const e = loadErr("bad-number.csv");
    assertAt(e, 3, "gdp_usd_bn");
    const tick = String.fromCharCode(96);
    expect(errText(e).startsWith(`countries.csv:3: field ${tick}gdp_usd_bn${tick}:`)).toBe(true);
  });

  it("bad_yes_no_names_line_and_field", () => {
    const e = loadErr("bad-yes-no.csv");
    assertAt(e, 3, "major");
    expect(e.message, errText(e)).toContain("expected Y or N");
  });

  it("short_row_names_line", () => {
    const e = loadErr("short-row.csv");
    assertAt(e, 4, null);
    expect(e.message, errText(e)).toContain("3 fields");
  });

  it("missing_column_is_named", () => {
    assertAt(loadErr("missing-column.csv"), 2, "population_m");
  });

  it("unknown_column_is_rejected", () => {
    assertAt(loadErr("unknown-column.csv"), 2, "wage_level");
  });

  it("line_counts_quoted_newlines", () => {
    // The first row spans lines 2 and 3, so the bad row starts on line 4.
    assertAt(loadErr("multiline-negative.csv"), 4, "wealth_index");
  });

  it("missing_file_is_named", () => {
    const files = realFiles();
    delete files["countries.csv"];
    const r = parseWorld(files);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.file).toBe("countries.csv");
    expect(r.error.line).toBeNull();
  });

  it("good_rows_load", () => {
    const r = parseWorld(realFiles());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.countries.lines[0]).toBe(2);
    expect(r.value.countries.rows[0]?.iso3).toBe("USA");
  });

  it("crlf_first_row_is_line_2", () => {
    // The csv crate own line counter says 1 here; lines are counted from the bytes.
    assertAt(loadErr("crlf-first-row.csv"), 2, "gdp_usd_bn");
  });
});
