// One place for the RNG test constructors, so a naming difference in rng.ts is a one-file fix.
// The Rust tests build RngStreams::new(seed), NoNoise and ScriptedDraws::new(); by the porting
// rules those become the helpers below over src/rng.ts (ported in Step 1).
//
// Expects (all exist in src/rng.ts):
//   rngStreamsNew(seed) -> RngStreams, rngStreamsDraws(rng) -> DrawSource,
//   NoNoise (a DrawSource constant), scriptedDraws() -> ScriptedDraws { push, remaining }
import {
  NoNoise,
  type RngStreams,
  rngStreamsDraws,
  rngStreamsNew,
  type ScriptedDraws,
  scriptedDraws,
} from "../../src/rng.ts";
import type { DrawSource, Stream } from "../../src/types/draws.ts";

/** RngStreams::new(seed) as plain state (for tests that save, clone or compare it). */
export function newRngStreams(seed: number): RngStreams {
  return rngStreamsNew(seed);
}

/**
 * RngStreams::new(seed) as a DrawSource. The generator is new (D951), so seeds do not reproduce
 * Rust draws; tests that asserted exact draws assert determinism or ranges instead.
 */
export function newRng(seed: number): DrawSource {
  return rngStreamsDraws(rngStreamsNew(seed));
}

/** NoNoise: the no-rolls source of the spec 5.16 projections. */
export function newNoNoise(): DrawSource {
  return NoNoise;
}

export type Scripted = ScriptedDraws;

export function newScripted(): Scripted {
  return scriptedDraws();
}

export function scriptedPush(s: Scripted, stream: Stream, values: Iterable<number>): void {
  s.push(stream, values);
}

export function scriptedRemaining(s: Scripted, stream: Stream): number {
  return s.remaining(stream);
}
