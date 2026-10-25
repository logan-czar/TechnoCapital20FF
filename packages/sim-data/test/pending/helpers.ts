// Shared helpers for the sim-data integration tests (the Rust tests' world() and
// expect_error in crates/sim-data/tests/checks.rs).
//
// Expects:
//   "@tc20ff/sim-data"       check, type WorldData, type DataError (file, line: number | null,
//                            field: string | null, message)
//   "@tc20ff/sim-data/node"  loadWorld, defaultDataDir (Node helpers; loadWorld reads the
//                            directory and returns Result<WorldData, DataError>, synchronously)
import { check, type DataError, type WorldData } from "@tc20ff/sim-data";
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { expect } from "vitest";

let cached: WorldData | undefined;

const TICK = String.fromCharCode(96);

/** DataError::fmt: file[:line][: field <tick>f<tick>]: message. */
export function errText(e: DataError): string {
  let s = e.file;
  if (e.line !== null) s += `:${e.line}`;
  if (e.field !== null) s += `: field ${TICK}${e.field}${TICK}`;
  return `${s}: ${e.message}`;
}

/** Today's data, loaded once (Rust: load_world(&default_data_dir()).unwrap_or_else(panic)). */
export function worldOnce(): WorldData {
  if (cached === undefined) {
    const r = loadWorld(defaultDataDir());
    if (!r.ok) throw new Error(errText(r.error));
    cached = r.value;
  }
  return cached;
}

/** A fresh copy the test may edit (WorldData is plain data, so structuredClone is a deep copy). */
export function world(): WorldData {
  return structuredClone(worldOnce());
}

/** The checks' errors after edit, which must include one at file, line, field. */
export function expectError(edit: (w: WorldData) => void, file: string, line: number, field: string): void {
  const w = world();
  edit(w);
  const errors = check(w);
  const hit = (e: DataError) => e.file === file && e.line === line && e.field === field;
  expect(
    errors.some(hit),
    `no error at ${file}:${line} ${field}; got ${JSON.stringify(errors, null, 2)}`,
  ).toBe(true);
}
