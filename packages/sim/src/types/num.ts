// Numeric helpers that keep Rust's f64 and integer semantics (docs/build/ts-migration-plan.md,
// "Things that would bite" 2 and 3). Sim code never calls Math.round or truncates a float to an
// integer inline: it calls these, so a port reads like the Rust it replaces.
//
// Money is f64 USD and share counts are whole numbers (D3). JS numbers are f64, so u64 share
// counts are exact only up to 2^53 - 1. The largest start value is about 1.8e9, but a raise can
// issue up to 20% more shares (ai/raise.rs), so about 85 raises in a row would pass 2^53: every
// share helper asserts the count stays a safe integer, and the TS soak reports the largest
// shares_out it saw (plan Step 4) so the bound is measured, not assumed.

/** Rust `f64::round`: halves round away from zero (2.5 → 3, -2.5 → -3). JS Math.round sends -2.5 to -2. */
export function roundHalfAway(x: number): number {
  return x < 0 ? -Math.round(-x) : Math.round(x);
}

/** Rust `f64::round_ties_even` and Python 3 `round` (banker's rounding): 2.5 → 2, 3.5 → 4. */
export function roundTiesEven(x: number): number {
  if (!Number.isFinite(x)) return x;
  const r = Math.round(x);
  // Math.round sends every x.5 up; step back to the even neighbour when x was exactly halfway.
  return r - x === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** Rust `f64::trunc`. */
export function trunc(x: number): number {
  return Math.trunc(x);
}

/** The largest whole number a JS number holds exactly (2^53 - 1). */
export const MAX_SAFE_COUNT = Number.MAX_SAFE_INTEGER;

/**
 * Rust `x as u64` for an f64: truncates toward zero, saturates at 0 and at the top, and sends NaN
 * to 0. The top is MAX_SAFE_COUNT, not u64::MAX: past it a JS number is no longer exact.
 */
export function toU64Sat(x: number): number {
  if (Number.isNaN(x) || x <= 0) return 0;
  if (x >= MAX_SAFE_COUNT) return MAX_SAFE_COUNT;
  return Math.trunc(x);
}

/** Rust `x as u32` for an f64: truncates, saturates at 0 and 2^32 - 1, NaN to 0. */
export function toU32Sat(x: number): number {
  if (Number.isNaN(x) || x <= 0) return 0;
  if (x >= 0xffff_ffff) return 0xffff_ffff;
  return Math.trunc(x);
}

/** Rust `x as i64` for an f64: truncates, saturates at ±MAX_SAFE_COUNT, NaN to 0. */
export function toI64Sat(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x >= MAX_SAFE_COUNT) return MAX_SAFE_COUNT;
  if (x <= -MAX_SAFE_COUNT) return -MAX_SAFE_COUNT;
  return Math.trunc(x);
}

/** Asserts a share count (or any u64 count) is a whole, non-negative, exactly held number. */
export function assertCount(n: number, what = "count"): number {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new RangeError(`${what} ${n} is not a whole number in 0..2^53`);
  }
  return n;
}

/** u64 addition that throws where Rust would overflow-panic in a debug build. */
export function addCount(a: number, b: number): number {
  return assertCount(assertCount(a) + assertCount(b), "sum");
}

/** u64 subtraction that throws where Rust would underflow-panic in a debug build. */
export function subCount(a: number, b: number): number {
  const d = assertCount(a) - assertCount(b);
  if (d < 0) throw new RangeError(`count underflow: ${a} - ${b}`);
  return d;
}

/** Rust `u64::saturating_sub`. */
export function saturatingSubCount(a: number, b: number): number {
  return Math.max(0, assertCount(a) - assertCount(b));
}

/** Rust integer division `a / b` for whole numbers: truncates toward zero, throws on b = 0. */
export function divInt(a: number, b: number): number {
  if (b === 0) throw new RangeError("integer division by zero");
  return Math.trunc(a / b);
}

/**
 * Rust `div_euclid` for whole numbers: the quotient q with a = q*b + r and 0 <= r < |b| (floors for
 * a positive divisor, so -7 div_euclid 4 is -2). Throws on b = 0.
 */
export function divEuclid(a: number, b: number): number {
  if (b === 0) throw new RangeError("integer division by zero");
  const q = Math.trunc(a / b);
  if (a - q * b < 0) return (b > 0 ? q - 1 : q + 1) + 0;
  return q + 0;
}

/** Rust `rem_euclid` for whole numbers: never negative (-7 rem_euclid 4 is 1). Throws on b = 0. */
export function remEuclid(a: number, b: number): number {
  if (b === 0) throw new RangeError("integer division by zero");
  const r = a % b;
  return (r < 0 ? r + Math.abs(b) : r) + 0;
}

/**
 * Rust `f64::total_cmp` for sorting floats: -0 sorts before +0 and NaN sorts last (positive NaN).
 * Use it in place of `(a, b) => a - b`, which breaks a sort when a NaN slips in.
 */
export function totalCmp(a: number, b: number): number {
  if (Number.isNaN(a)) return Number.isNaN(b) ? 0 : 1;
  if (Number.isNaN(b)) return -1;
  if (a < b) return -1;
  if (a > b) return 1;
  if (a === 0 && b === 0) return Object.is(a, -0) === Object.is(b, -0) ? 0 : Object.is(a, -0) ? -1 : 1;
  return 0;
}

/**
 * Compares strings by UTF-16 code unit, the deterministic order sim code uses. CSV ids are ASCII,
 * where this equals Rust's byte order (D4). Never use localeCompare in sim code: it differs by machine.
 */
export function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Rust `f64::max`: if one operand is NaN, the other is returned (Math.max returns NaN). */
export function maxF(a: number, b: number): number {
  if (Number.isNaN(a)) return b;
  if (Number.isNaN(b)) return a;
  return Math.max(a, b);
}

/** Rust `f64::min`: if one operand is NaN, the other is returned (Math.min returns NaN). */
export function minF(a: number, b: number): number {
  if (Number.isNaN(a)) return b;
  if (Number.isNaN(b)) return a;
  return Math.min(a, b);
}

/**
 * Rust `f64::clamp`: x itself when inside (so -0 stays -0), NaN stays NaN, and it throws where
 * Rust panics (lo > hi, or a NaN bound).
 */
export function clamp(x: number, lo: number, hi: number): number {
  if (!(lo <= hi)) throw new RangeError(`clamp bounds ${lo} > ${hi} or NaN`);
  return x < lo ? lo : x > hi ? hi : x;
}

/**
 * Rust `f64::powi` for a whole exponent: repeated squaring (compiler-rt `__powidf2`), the same
 * multiplications Rust does, where `Math.pow` may differ in the last bit.
 */
export function powi(base: number, exp: number): number {
  let a = base;
  let b = Math.trunc(exp);
  const recip = b < 0;
  if (recip) b = -b;
  let r = 1.0;
  for (;;) {
    if (b % 2 === 1) r *= a;
    b = Math.trunc(b / 2);
    if (b === 0) break;
    a *= a;
  }
  return recip ? 1.0 / r : r;
}
