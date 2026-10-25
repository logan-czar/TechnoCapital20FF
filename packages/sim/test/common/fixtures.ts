/// <reference types="node" />
// Reads the golden fixtures the Rust tests read through env!("CARGO_MANIFEST_DIR"): the CSVs in
// packages/sim/test/fixtures (copied from crates/sim/tests/fixtures; the .tc20ffsave is not,
// D953). Lives in test/pending/common until promoted to test/common; finds fixtures from either.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function fixturesDir(): string {
  for (const rel of ["..", join("..", "..")]) {
    const dir = join(import.meta.dirname, rel, "fixtures");
    if (existsSync(dir)) return dir;
  }
  throw new Error(`no fixtures folder next to ${import.meta.dirname}`);
}

/** The text of fixtures/name, with Windows line endings folded to LF. */
export function fixtureText(name: string): string {
  return readFileSync(join(fixturesDir(), name), "utf8").replace(/\r\n/g, "\n");
}

/** Rust str::lines: split on LF, no trailing empty line. */
export function lines(text: string): string[] {
  const out = text.split("\n");
  if (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out;
}
