// The page framework's pure parts, ported from crates/game/src/pages/mod.rs's tests
// (page_keys_round_trip, sections_follow_the_config, pdoomberg_functions_parse), doc.rs's tab
// helpers, and the history half of crates/game/tests/workspace.rs (panes_keep_their_own_history:
// the pane model; the shell half is in pages-dom.test.tsx).

import type {
  CharacterId,
  CompanyId,
  CountryId,
  HeadlineId,
  ProvinceId,
  StartupEventId,
  ZoneId,
} from "@tc20ff/sim";
import { afterEach, describe, expect, it } from "vitest";
import { defaultConfig, type UiConfig } from "../../src/config/settings.ts";
import {
  HISTORY_CAP,
  historyBack,
  historyBackTo,
  historyForward,
  historyFromSaved,
  historyNew,
  historyOpen,
  historyToSaved,
} from "../../src/pages/history.ts";
import {
  PAGE_KINDS,
  type PageRef,
  pageEq,
  pageFromKey,
  pageKey,
  parsePdbFunction,
  parseProvince,
  provinceKey,
  setProvinceKeys,
} from "../../src/pages/ref.ts";
import {
  applySectionOp,
  arrangeSections,
  currentTab,
  type SectionSpec,
  selectTab,
} from "../../src/pages/sections.ts";

afterEach(() => setProvinceKeys(null));

describe("PageRef", () => {
  it("round-trips every kind through its key (mod.rs page_keys_round_trip)", () => {
    const pages: PageRef[] = [
      { kind: "world" },
      { kind: "company", id: 12 as CompanyId },
      { kind: "industry", id: 3 as never },
      { kind: "character", id: 295 as CharacterId },
      { kind: "country", id: 40 as CountryId },
      { kind: "province", id: 3254 as ProvinceId },
      { kind: "zone", id: 2 as ZoneId },
      { kind: "exchange", id: 25 as ZoneId },
      { kind: "event", id: 0 as StartupEventId },
      { kind: "recap", quarter: { year: 2021, q: 4 } },
      { kind: "headline", id: 1234 as HeadlineId },
      { kind: "companies" },
      { kind: "industries" },
      { kind: "news" },
      { kind: "characters" },
      { kind: "countries" },
      { kind: "exchanges" },
      { kind: "zones" },
      { kind: "events" },
      { kind: "settings" },
    ];
    expect(new Set(pages.map((p) => p.kind)).size).toBe(PAGE_KINDS.length);
    for (const p of pages) {
      const back = pageFromKey(pageKey(p));
      expect(back, pageKey(p)).not.toBeNull();
      expect(pageEq(back as PageRef, p), pageKey(p)).toBe(true);
    }
    expect(pageKey({ kind: "company", id: 12 as CompanyId })).toBe("company/12");
    expect(pageKey({ kind: "headline", id: 7 as HeadlineId })).toBe("headline/7");
    expect(pageKey({ kind: "province", id: 9 as ProvinceId })).toBe("province/9");
    expect(pageKey({ kind: "recap", quarter: { year: 2020, q: 1 } })).toBe("recap/2020-Q1");
    // The old "nth headline of its day" key (D451) no longer names a page (D544).
    expect(pageFromKey("headline/2020-03-02/0")).toBeNull();
    for (const bad of [
      "",
      "company",
      "company/x",
      "company/1/2",
      "recap/2020-Q5",
      "headline/2020-02-30/0",
      "nope/1",
      "world/1",
    ]) {
      expect(pageFromKey(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("saves a province by its CSV key once the keys are known (D828)", () => {
    const keys = ["AE-0001", "JP-0001", "US-0053"];
    expect(provinceKey(1, keys)).toBe("JP-0001");
    expect(parseProvince("JP-0001", keys)).toBe(1);
    expect(parseProvince("145", keys)).toBeNull();
    expect(parseProvince("XX-0001", keys)).toBeNull();
    expect(parseProvince("1", null)).toBe(1);
    setProvinceKeys(keys);
    expect(pageKey({ kind: "province", id: 2 as ProvinceId })).toBe("province/US-0053");
    expect(pageFromKey("province/US-0053")).toEqual({ kind: "province", id: 2 });
    expect(pageFromKey("province/2"), "an ordinal key no longer names a province").toBeNull();
  });

  it("parses Pdoomberg's function keys (mod.rs pdoomberg_functions_parse)", () => {
    expect(parsePdbFunction("f3")).toBe("F3");
    expect(parsePdbFunction("F10")).toBe("F10");
    expect(parsePdbFunction("scrn")).toBe("F10");
    expect(parsePdbFunction("F1")).toBeNull();
    expect(parsePdbFunction("F8")).toBeNull();
  });
});

describe("sections", () => {
  const defaults: SectionSpec[] = [
    { id: "a", title: "A" },
    { id: "b", title: "B" },
    { id: "c", title: "C" },
  ];
  const ids = (cfg: UiConfig) =>
    arrangeSections(defaults, cfg.sections.company).map((x) => [x.section.id, x.collapsed] as const);

  it("follow the config (mod.rs sections_follow_the_config)", () => {
    let cfg = defaultConfig();
    expect(ids(cfg)).toEqual([
      ["a", false],
      ["b", false],
      ["c", false],
    ]);
    cfg = applySectionOp(cfg, "company", defaults, "c", "Up");
    expect(ids(cfg)).toEqual([
      ["a", false],
      ["c", false],
      ["b", false],
    ]);
    cfg = applySectionOp(cfg, "company", defaults, "a", "Up");
    expect(ids(cfg)[0]?.[0], "the top stays the top").toBe("a");
    cfg = applySectionOp(cfg, "company", defaults, "b", "Hide");
    cfg = applySectionOp(cfg, "company", defaults, "a", "ToggleCollapse");
    expect(ids(cfg)).toEqual([
      ["a", true],
      ["c", false],
    ]);
    cfg = applySectionOp(cfg, "company", defaults, "c", "Down");
    expect(ids(cfg), "past a hidden one").toEqual([
      ["a", true],
      ["c", false],
    ]);
    cfg = applySectionOp(cfg, "company", defaults, "b", "Show");
    cfg = applySectionOp(cfg, "company", defaults, "a", "ToggleCollapse");
    expect(ids(cfg)).toEqual([
      ["a", false],
      ["b", false],
      ["c", false],
    ]);
    // A config naming a section the page no longer has, and missing a new one.
    const odd: UiConfig = {
      ...defaultConfig(),
      sections: { company: { order: ["gone", "c"], collapsed: [], hidden: [] } },
    };
    expect(ids(odd)).toEqual([
      ["c", false],
      ["a", false],
      ["b", false],
    ]);
  });

  it("show one tab at a time and keep it (doc.rs select_tab, current_tab; D481)", () => {
    let cfg = defaultConfig();
    expect(currentTab(cfg, "company", defaults)).toBeNull();
    cfg = applySectionOp(cfg, "company", defaults, "b", "Hide");
    cfg = selectTab(cfg, "company", defaults, "b");
    expect(currentTab(cfg, "company", defaults)).toBe("b");
    expect(cfg.sections.company?.hidden, "a tab shows its hidden section").toEqual([]);
    expect(ids(cfg)).toEqual([
      ["a", true],
      ["b", false],
      ["c", true],
    ]);
    cfg = selectTab(cfg, "company", defaults, null);
    expect(currentTab(cfg, "company", defaults)).toBeNull();
    expect(ids(cfg).every(([, c]) => !c)).toBe(true);
  });

  it("leave the input config alone (each op returns a new one)", () => {
    const cfg = defaultConfig();
    applySectionOp(cfg, "company", defaults, "a", "Hide");
    expect(cfg.sections).toEqual({});
  });
});

describe("pane history", () => {
  const co = (n: number): PageRef => ({ kind: "company", id: n as CompanyId });

  it("opens, goes back and forward, and jumps back by breadcrumb (workspace.rs history)", () => {
    let h = historyNew({ kind: "world" });
    h = historyOpen(h, co(0));
    h = historyOpen(h, { kind: "industries" });
    h = historyOpen(h, co(3));
    expect(h.current).toEqual(co(3));
    expect(historyOpen(h, co(3)), "opening the page shown does nothing").toBe(h);
    h = historyBack(h);
    expect(h.current).toEqual({ kind: "industries" });
    h = historyBack(h);
    expect(h.current).toEqual(co(0));
    h = historyForward(h);
    expect(h.current).toEqual({ kind: "industries" });
    // A new page clears the forward list, as in a browser.
    const branched = historyOpen(h, co(5));
    expect(branched.forward).toEqual([]);
    // A breadcrumb jump: back to World, the rest ahead.
    h = historyBackTo(h, 0);
    expect(h.current).toEqual({ kind: "world" });
    expect(h.forward.length).toBeGreaterThan(0);
    expect(historyForward(h).current).toEqual(co(0));
    expect(historyBack(historyNew({ kind: "world" })).back).toEqual([]);
  });

  it("keeps at most HISTORY_CAP pages behind", () => {
    let h = historyNew({ kind: "world" });
    for (let i = 0; i < HISTORY_CAP + 10; i++) h = historyOpen(h, co(i));
    expect(h.back.length).toBe(HISTORY_CAP);
  });

  it("round-trips through a pane's params, dropping keys that name no page (D452)", () => {
    let h = historyNew({ kind: "world" });
    h = historyOpen(h, co(1));
    h = historyOpen(h, { kind: "recap", quarter: { year: 2020, q: 2 } });
    h = historyBack(h);
    const saved = historyToSaved(h);
    expect(saved).toEqual({ back: ["world"], current: "company/1", forward: ["recap/2020-Q2"] });
    const back = historyFromSaved(JSON.parse(JSON.stringify(saved)));
    expect(back && historyToSaved(back)).toEqual(saved);
    const odd = historyFromSaved({ back: ["company/zz", "news"], current: "nope/1", forward: [7] });
    expect(odd && historyToSaved(odd)).toEqual({ back: ["news"], current: "world", forward: [] });
    expect(historyFromSaved(null)).toBeNull();
    expect(historyFromSaved({ back: [] })).toBeNull();
  });
});
