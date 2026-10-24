// Saves (spec 9.1 `Save`, `Load`; build-plan 2.2, M1.7): the whole World, the RNG state and the
// controls. Ported from crates/sim/src/save.rs. D953: a save is versioned canonical JSON
// (./canonical.ts), gzipped with fflate, instead of postcard and flate2. Everything in the state
// is plain data, so a new field is saved with no extra code. A loaded game continues with exactly
// the ticks and draws it would have made (same hashes, build-plan 4.3).
//
// The format is the 8-byte SAVE_MAGIC, then gzip of the UTF-8 JSON of `{ version, state }`, where
// `state` is `{ controls, rng, world }`. A save from another version is refused rather than
// misread. Rust saves (version 11, postcard) do not carry over (D953): they fail at the magic.

import { gunzipSync, gzipSync } from "fflate";
import { canonicalRevive, canonicalString } from "./canonical.ts";
import type { RngStreams } from "./rng.ts";
import type { Controls } from "./types/control.ts";
import { STREAM_COUNT } from "./types/draws.ts";
import type { SaveError } from "./types/sim-api.ts";
import type { Result, World } from "./types/world.ts";

export type { SaveError } from "./types/sim-api.ts";

/** The first bytes of every save ("TC20FFJS": the Rust saves began "TC20FFSV"). */
export const SAVE_MAGIC: Uint8Array = new TextEncoder().encode("TC20FFJS");

/**
 * Bumped whenever the saved layout changes (any new field in any table). The TS port starts at 1
 * (D953); Rust's versions (up to 11) do not carry over.
 */
export const SAVE_VERSION = 1;

/** The decoded state of a save. */
export interface SaveState {
  world: World;
  rng: RngStreams;
  controls: Controls;
}

/** Why a save of another version does not load (Rust `version_message`; D826 is Rust-only). */
function versionMessage(found: number): string {
  return found < SAVE_VERSION
    ? `this save is version ${found}, older than this build's version ${SAVE_VERSION}`
    : `this save is version ${found}, newer than this build's version ${SAVE_VERSION}`;
}

/** The text of a SaveError (Rust `Display`): see `SaveError` in types/sim-api.ts. */
export function saveErrorMessage(e: SaveError): string {
  switch (e.kind) {
    case "Io":
      return `save file: ${e.message}`;
    case "BadMagic":
      return "not a TechnoCapital20FF save";
    case "Version":
      return versionMessage(e.found);
    case "Format":
      return `save data: ${e.message}`;
  }
}

/** Encodes `{ version, state }` as save bytes. `version` is a parameter so tests can write old ones. */
export function encodeVersioned(
  version: number,
  world: World,
  rng: RngStreams,
  controls: Controls,
): Uint8Array {
  const json = canonicalString({ version, state: { controls, rng, world } });
  const body = gzipSync(new TextEncoder().encode(json), { mtime: 0 });
  const out = new Uint8Array(SAVE_MAGIC.length + body.length);
  out.set(SAVE_MAGIC, 0);
  out.set(body, SAVE_MAGIC.length);
  return out;
}

/** Encodes a save. */
export function encode(world: World, rng: RngStreams, controls: Controls): Uint8Array {
  return encodeVersioned(SAVE_VERSION, world, rng, controls);
}

function format(message: string): Result<never, SaveError> {
  return { ok: false, error: { kind: "Format", message } };
}

function isRng(v: unknown): v is RngStreams {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  const wordsOk = (s: unknown) =>
    Array.isArray(s) && s.length === 4 && s.every((w) => Number.isInteger(w) && w >= 0 && w < 2 ** 32);
  return (
    Number.isSafeInteger(r.seed) &&
    Array.isArray(r.state) &&
    r.state.length === STREAM_COUNT &&
    r.state.every(wordsOk) &&
    Array.isArray(r.spare) &&
    r.spare.length === STREAM_COUNT &&
    r.spare.every((x) => x === null || typeof x === "number")
  );
}

/** Decodes a save. */
export function decode(bytes: Uint8Array): Result<SaveState, SaveError> {
  if (bytes.length < SAVE_MAGIC.length || !SAVE_MAGIC.every((b, i) => bytes[i] === b)) {
    return { ok: false, error: { kind: "BadMagic" } };
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(gunzipSync(bytes.subarray(SAVE_MAGIC.length)));
  } catch (e) {
    return format(e instanceof Error ? e.message : String(e));
  }
  let tree: unknown;
  try {
    tree = JSON.parse(text);
  } catch (e) {
    return format(e instanceof Error ? e.message : String(e));
  }
  if (
    typeof tree !== "object" ||
    tree === null ||
    !Number.isInteger((tree as { version?: unknown }).version)
  ) {
    return format("no version");
  }
  const found = (tree as { version: number }).version;
  if (found !== SAVE_VERSION) return { ok: false, error: { kind: "Version", found } };
  let state: Record<string, unknown>;
  try {
    state = canonicalRevive((tree as { state?: unknown }).state) as Record<string, unknown>;
  } catch (e) {
    return format(e instanceof Error ? e.message : String(e));
  }
  if (typeof state !== "object" || state === null) return format("no state");
  const { world, rng, controls } = state;
  if (typeof world !== "object" || world === null) return format("no world");
  if (!isRng(rng)) return format("bad rng state");
  if (typeof controls !== "object" || controls === null) return format("no controls");
  return { ok: true, value: { world: world as World, rng, controls: controls as Controls } };
}
