// One place for the RNG test constructors, so a naming difference in rng.ts is a one-file fix.
// The Rust tests build RngStreams::new(seed), NoNoise and ScriptedDraws::new(); by the porting
// rules those become the free functions below (rng.ts, lane W3).
//
// Expects:
//   ../../../src/rng.ts  rngStreamsNew(seed) -> DrawSource, noNoise() -> DrawSource (the unit
//                        struct NoNoise: every draw the middle of its range, spec 5.16),
//                        scriptedDrawsNew() -> ScriptedDraws, scriptedDrawsPush(s, stream, values),
//                        scriptedDrawsRemaining(s, stream) -> number; ScriptedDraws is a DrawSource
import {
  noNoise,
  rngStreamsNew,
  type ScriptedDraws,
  scriptedDrawsNew,
  scriptedDrawsPush,
  scriptedDrawsRemaining,
} from "../../../src/rng.ts";
import type { DrawSource, Stream } from "../../../src/types/draws.ts";

/** RngStreams::new(seed). The generator is new (D951), so seeds do not reproduce Rust draws. */
export function newRng(seed: number): DrawSource {
  return rngStreamsNew(seed);
}

/** NoNoise: the no-rolls source of the spec 5.16 projections. */
export function newNoNoise(): DrawSource {
  return noNoise();
}

export type Scripted = ScriptedDraws;

export function newScripted(): Scripted {
  return scriptedDrawsNew();
}

export function scriptedPush(s: Scripted, stream: Stream, values: Iterable<number>): void {
  scriptedDrawsPush(s, stream, values);
}

export function scriptedRemaining(s: Scripted, stream: Stream): number {
  return scriptedDrawsRemaining(s, stream);
}
