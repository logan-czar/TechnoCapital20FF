// The mock's own random numbers and hashes (no Math.random): every mock fixture draws from these,
// so the same seed gives the same mock world and the same frames.

export { hashStr, unitHash } from "../mockWorld.ts";

/** A small seeded generator (sfc32): the mock's own, so mock numbers never touch the sim's streams. */
export class MockRng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  constructor(seed: number) {
    this.a = 0x9e3779b9;
    this.b = 0x243f6a88;
    this.c = 0xb7e15162;
    this.d = seed >>> 0;
    for (let i = 0; i < 12; i++) this.next();
  }
  next(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }
  /** Roughly standard normal (sum of three uniforms, scaled). */
  normal(): number {
    return (this.next() + this.next() + this.next() - 1.5) * 2;
  }
  /** A whole number in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
  /** A value in [lo, hi). */
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }
  /** One of `items` (which must not be empty). */
  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)] as T;
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}
