// The politics POC running on the real world (D980 to D988): seats stay full across decades of
// elections, the calendar fires on its days, and the same seed gives the same government.
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { type Sim, simNew, simStep, simViews, simWorld } from "../src/lib.ts";
import { electionDay } from "../src/politics/calendar.ts";
import { partySeats } from "../src/politics/state.ts";
import { dateTimeDate } from "../src/time/calendar.ts";
import { cmpDate } from "../src/types/calendar.ts";
import type { PoliticsState } from "../src/types/state/politics.ts";

const loaded = loadWorld(defaultDataDir());
if (!loaded.ok) throw new Error("data does not load");
const DATA = loaded.value;

function politics(sim: Sim): PoliticsState {
  return simWorld(sim).politics as PoliticsState;
}

function start(seed: number): Sim {
  const s = simNew(DATA, seed);
  if (!s.ok) throw new Error("no world");
  return s.value;
}

function seatCounts(p: PoliticsState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of p.politicians) out[c.office.kind] = (out[c.office.kind] ?? 0) + 1;
  return out;
}

const FULL = { President: 1, VicePresident: 1, Cabinet: 15, House: 435, Senate: 100, Judge: 34 };

describe("politics POC at the start", () => {
  it("fills every office with class Politician", () => {
    const p = politics(start(1));
    expect(seatCounts(p)).toEqual(FULL);
    expect(p.politicians.every((c) => c.class === "Politician")).toBe(true);
    expect(p.president_terms).toBe(1);
  });

  it("gives each state its real seats", () => {
    const p = politics(start(1));
    const seats = p.states.map((_, i) => p.districts.filter((d) => d.state === i).length);
    expect(seats).toEqual(p.states.map((s) => s.house_seats));
    const senate = p.states.map(
      (_, i) => p.politicians.filter((c) => c.office.kind === "Senate" && c.office.state === i).length,
    );
    expect(senate).toEqual(p.states.map((s) => s.senate_classes.length));
  });

  it("is the same for the same seed", () => {
    expect(politics(start(7)).politicians).toEqual(politics(start(7)).politicians);
    expect(politics(start(7)).politicians).not.toEqual(politics(start(8)).politicians);
  });
});

describe("politics POC in play", () => {
  it("keeps every seat full through the 2020 vote and its handovers", () => {
    const sim = start(1);
    const vote = electionDay(2020);
    while (cmpDate(dateTimeDate(simWorld(sim).clock), vote) < 0) simStep(sim);
    simStep(sim);
    const p = politics(sim);
    expect(p.elections.length).toBe(1);
    const r = p.elections[0]!;
    expect(r.house[0] + r.house[1]).toBe(435);
    expect(r.senate[0] + r.senate[1]).toBe(100);
    expect(r.president).not.toBeNull();
    // The wire posts the result the same day, and the politics view has it at once.
    const feed = simViews(sim).news.data.feed.filter((h) => h.kind.kind === "Politics");
    expect(feed.some((h) => h.text.includes("wins the US presidency"))).toBe(true);
    expect(simViews(sim).politics.data.elections[0]).toEqual(r);
    while (dateTimeDate(simWorld(sim).clock).year < 2021 || dateTimeDate(simWorld(sim).clock).day < 21)
      simStep(sim);
    const after = politics(sim);
    expect(seatCounts(after)).toEqual(FULL);
    expect(after.pending).toBeNull();
    expect(partySeats(after.politicians.filter((c) => c.office.kind === "House"))).toEqual(r.house);
    expect(partySeats(after.politicians.filter((c) => c.office.kind === "Senate"))).toEqual(r.senate);
    expect(after.politicians.map((c) => c.id)).toEqual(
      after.politicians.map((c) => c.id).sort((a, b) => a - b),
    );
  }, 240_000);
});
