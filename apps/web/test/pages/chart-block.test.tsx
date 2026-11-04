// @vitest-environment happy-dom
// The chart block keeps one chart per block (D1021): making a lightweight-charts chart lays out the
// whole page, and a page hands the block a new model on every rebuild at max speed, so a new model
// swaps the series and the chart stays. lightweight-charts (a canvas) is a stub that counts calls.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ created: 0, removed: 0, added: 0, seriesRemoved: 0 }));

vi.mock("lightweight-charts", () => {
  const series = () => ({ setData: () => {}, createPriceLine: () => {} });
  return {
    CandlestickSeries: {},
    HistogramSeries: {},
    LineSeries: {},
    ColorType: { Solid: "solid" },
    LineStyle: { Solid: 0, Dotted: 1, Dashed: 2 },
    createChart: () => {
      calls.created++;
      return {
        addSeries: () => {
          calls.added++;
          return series();
        },
        removeSeries: () => {
          calls.seriesRemoved++;
        },
        applyOptions: () => {},
        timeScale: () => ({ fitContent: () => {} }),
        remove: () => {
          calls.removed++;
        },
      };
    },
  };
});

globalThis.ResizeObserver ??= class {
  observe() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const { ChartBlock } = await import("../../src/pages/ChartBlock.tsx");
type ChartModel = import("../../src/pages/doc.ts").ChartModel;

const model = (values: number[]): ChartModel => ({
  title: "World GDP",
  labels: values.map((_, i) => `${1995 + i}`),
  series: [{ k: "line", name: "GDP", values, tone: "cyan" }],
  format: "Money",
  reference: null,
});

afterEach(() => {
  cleanup();
  Object.assign(calls, { created: 0, removed: 0, added: 0, seriesRemoved: 0 });
});

describe("ChartBlock", () => {
  it("swaps the series for a new model and keeps the chart (D1021)", () => {
    const { rerender, unmount } = render(<ChartBlock chart={model([1, 2])} />);
    expect(calls).toMatchObject({ created: 1, added: 1, seriesRemoved: 0 });
    for (let i = 3; i < 10; i++) rerender(<ChartBlock chart={model([1, 2, i])} />);
    expect(calls).toMatchObject({ created: 1, added: 8, seriesRemoved: 7, removed: 0 });
    unmount();
    expect(calls.removed).toBe(1);
  });
});
