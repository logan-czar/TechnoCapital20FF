// A dormant industry stays out of the pages' lists until it emerges (1995-rework 5.2).
import { dateTimeMidnight, simDateYmd, simNew } from "@tc20ff/sim";
import { loadWorld, worldDataDir } from "@tc20ff/sim-data/node";
import { describe, expect, it } from "vitest";
import { nameIndexOf } from "../../src/links/names.ts";
import { industriesTable } from "../../src/pages/kinds/industries.tsx";
import { viewsData } from "../../src/pages/views.ts";

function new1995() {
  const d = loadWorld(worldDataDir("1995"));
  if (!d.ok) throw new Error("no data");
  const made = simNew(d.value, 1, { scenario: "stable" });
  if (!made.ok) throw new Error("no sim");
  return made.value;
}

describe("dormant industries", () => {
  it("are left out of the table and the names until they emerge", () => {
    const sim = new1995();
    const views = sim.views();
    const rows = views.industry_rows.data.rows;
    const dormant = rows.filter((r) => r.dormant);
    expect(dormant.length).toBeGreaterThan(0);
    const index = nameIndexOf(views);
    const table = industriesTable(viewsData(views), index);
    expect(table.rows.length).toBe(rows.length - dormant.length);
    const shown = JSON.stringify(table.rows);
    for (const r of dormant) expect(shown).not.toContain(`"${r.name}"`);
  });

  it("join the table when they emerge", () => {
    const sim = new1995();
    const before = sim.views().industry_rows.data.rows.filter((r) => r.dormant).length;
    const end = dateTimeMidnight(simDateYmd(2000, 1, 1));
    while (sim.now() < end) sim.step();
    expect(sim.views().industry_rows.data.rows.filter((r) => r.dormant).length).toBeLessThan(before);
  }, 240_000);
});
