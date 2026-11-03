// Number formatting as Rust's `{:.N}` prints it, so the tables stay byte-identical to the Rust
// mapgen's (D1017).

/**
 * `v` with `digits` decimals, rounded as Rust does: to the nearest, an exact tie to even. JS's
 * `toFixed` is exact too but breaks a tie upward (12.25 to "12.3" where Rust prints "12.2").
 */
export function fixed(v: number, digits: number): string {
  const up = v.toFixed(digits);
  // the exact decimal expansion, to see whether `v` sits exactly halfway between two outputs
  const exact = Math.abs(v).toFixed(100);
  const point = exact.indexOf(".");
  const rest = exact.slice(point + 1 + digits);
  if (!/^50*$/.test(rest)) return up;
  const down = (v < 0 ? "-" : "") + exact.slice(0, digits === 0 ? point : point + 1 + digits);
  const last = down.at(-1)!;
  return Number(last) % 2 === 0 ? down : up;
}
