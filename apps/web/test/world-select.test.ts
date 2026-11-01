// Picking the starting world from the page URL (1995-rework 3.2; sim/world.ts).

import { describe, expect, it } from "vitest";
import { knownWorld, worldDataBase } from "../src/sim/world.ts";

describe("the starting world", () => {
  it("is one of the known worlds, else the 2020 world", () => {
    expect(knownWorld("1995")).toBe("1995");
    expect(knownWorld("1984")).toBeNull();
    expect(knownWorld("")).toBeNull();
    expect(knownWorld("../secrets")).toBeNull();
    expect(knownWorld(null)).toBeNull();
    expect(knownWorld(undefined)).toBeNull();
  });

  it("names where its CSVs are served", () => {
    expect(worldDataBase(null)).toBe("/data/design/");
    expect(worldDataBase("1995")).toBe("/data/worlds/1995/");
  });
});
