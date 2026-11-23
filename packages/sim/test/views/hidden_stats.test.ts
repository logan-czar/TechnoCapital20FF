// D1060 (pivot 5.11): the views carry hidden stats, what is read from them, and the AI's private
// intent only in Omniscient, so no page or app has them to show. One sim, the same tick: every
// hidden field is null with Omniscient off and set once it is toggled on (the views rebuild).
import { describe, expect, it } from "vitest";
import { simApply, simNew, simStep, simViews } from "../../src/lib.ts";
import { data, unwrap } from "../common/index.ts";

/** Past the 9 January 2020 plan lock (tick 192), so the boards, plans and statements are built. */
const TICKS = 200;

type Views = ReturnType<typeof simViews>;

function hiddenOf(v: Views) {
  const c = v.company_detail.data.companies.find((x) => x.board.some((s) => s.holder !== null));
  if (c === undefined) throw new Error("no seated company");
  const seat = c.board.find((s) => s.holder !== null);
  const unit = v.units.data.units[0];
  const person = v.characters.data.partial[0];
  const official = v.politics.data.president;
  const published = v.statements.data.companies.find((s) => s.quarters.length > 0);
  return {
    management_score: c.management_score,
    confidence_factor: c.confidence_factor,
    archetype: c.archetype,
    skill_used: seat?.skill_used ?? null,
    seat_skills: seat?.holder?.skills ?? null,
    seat_traits: seat?.holder?.traits ?? null,
    growth_plan: unit?.growth_plan ?? null,
    rd_plan: unit?.rd_plan ?? null,
    character_skills: person?.skills ?? null,
    character_traits: person?.traits ?? null,
    official_skills: official?.skills ?? null,
    official_traits: official?.traits ?? null,
    statement_management: published?.quarters.at(-1)?.key.management_score ?? null,
  };
}

describe("hidden stats in the views (pivot 5.11, D1060)", () => {
  it("are null for the observer and set in Omniscient, on the same tick", () => {
    const sim = unwrap(simNew(data(), 3, { debug: true }), "Sim::new");
    for (let i = 0; i < TICKS; i++) simStep(sim);
    const observer = hiddenOf(simViews(sim));
    for (const [k, value] of Object.entries(observer)) expect(value, k).toBeNull();

    unwrap(simApply(sim, { kind: "SetOmniscient", on: true }), "SetOmniscient");
    const omniscient = hiddenOf(simViews(sim));
    for (const [k, value] of Object.entries(omniscient)) expect(value, k).not.toBeNull();

    // What stays public: names, ages, the published operating figures.
    const v = simViews(sim);
    expect(v.units.data.units[0]?.productivity).not.toBeNull();
    unwrap(simApply(sim, { kind: "SetOmniscient", on: false }), "SetOmniscient off");
    const off = simViews(sim);
    expect(off.units.data.units[0]?.productivity).toEqual(v.units.data.units[0]?.productivity);
    expect(off.characters.data.partial[0]?.name).toBe(v.characters.data.partial[0]?.name);
    for (const [k, value] of Object.entries(hiddenOf(off)))
      expect(value, `${k} after toggling off`).toBeNull();
  });
});
