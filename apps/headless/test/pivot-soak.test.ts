// The pivot soak's Coarse against Full test (pivot 3.3; D1056): the two-sample KS statistic.
import { describe, expect, it } from "vitest";
import { ks } from "../src/pivot-soak.ts";

describe("the two-sample KS test", () => {
  const xs = Array.from({ length: 40 }, (_, i) => i / 40);

  it("passes two samples of one distribution", () => {
    expect(ks(xs, xs)).toEqual({ d: 0, p: 1 });
    expect(
      ks(
        xs,
        xs.map((x) => x + 0.01),
      ).p,
    ).toBeGreaterThan(0.9);
  });

  it("fails two samples apart", () => {
    const r = ks(
      xs,
      xs.map((x) => x + 0.5),
    );
    expect(r.d).toBeCloseTo(0.5, 9);
    expect(r.p).toBeLessThan(0.001);
  });
});
