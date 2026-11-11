// The encyclopedia's articles and search, built from the mock's views (pivot 15.3, 5.11, 1.2;
// D1047): every entity kind has an article, hidden stats are absent while null and present with
// Omniscient, links stay inside the browser or go to the app that shows the thing better, and a
// scripted event shows in the article of what it changes.

import { describe, expect, it } from "vitest";
import {
  type Article,
  type ArticleBlock,
  buildArticle,
  hiddenFacts,
  homeArticle,
  type Inline,
  indexArticle,
  inlineText,
  isRef,
  noArticle,
  officialsOf,
} from "../../../src/apps/browser/articles.ts";
import { ARTICLE_KINDS, INDEX_KINDS, parseRoute } from "../../../src/apps/browser/route.ts";
import { buildSearchIndex, searchArticle, searchEntries } from "../../../src/apps/browser/search.ts";
import { type ViewsData, viewsData } from "../../../src/pages/views.ts";
import { SCRIPT } from "../../../src/sim/mock/fixtures/script.ts";
import { newGame } from "../../mock/common.ts";

/** Every piece of text an article shows. */
function texts(a: Article): string[] {
  const out: string[] = [a.title, a.kind, ...a.lead.map(inlineOf)];
  for (const f of a.facts) out.push(f.label, inlineText(f.value));
  for (const s of a.sections) {
    out.push(s.title);
    for (const b of s.blocks) out.push(...blockTexts(b));
  }
  return out;
}
const inlineOf = (i: Inline): string => (isRef(i) ? i.text : i);
function blockTexts(b: ArticleBlock): string[] {
  switch (b.k) {
    case "text":
      return [inlineText(b.spans)];
    case "muted":
      return [b.text];
    case "list":
      return b.items.map(inlineText);
    case "table":
      return [...b.columns, ...b.rows.flatMap((r) => r.map((c) => inlineText(Array.isArray(c) ? c : [c])))];
  }
}

/** Every link of an article. */
function refs(a: Article) {
  const out = [...a.lead, ...a.facts.flatMap((f) => f.value)].filter(isRef);
  for (const s of a.sections)
    for (const b of s.blocks) {
      if (b.k === "text") out.push(...b.spans.filter(isRef));
      else if (b.k === "list") out.push(...b.items.flat().filter(isRef));
      else if (b.k === "table") out.push(...b.rows.flat(2).filter(isRef));
    }
  return [...out, ...a.elsewhere];
}

const first = <T>(xs: readonly T[] | undefined): T => {
  if (xs === undefined || xs.length === 0) throw new Error("the mock has none");
  return xs[0] as T;
};

describe("the encyclopedia over the mock world", () => {
  const game = newGame(7, { debug: true });
  const plain = viewsData(game.views());
  // The same game's views with Omniscient on: hidden fields filled in.
  const omni = (() => {
    const g = newGame(7, { debug: true });
    expect(g.control({ kind: "SetOmniscient", on: true }).kind).toBe("Ok");
    return viewsData(g.views());
  })();

  const ids: Record<(typeof ARTICLE_KINDS)[number], number> = {
    person: first(plain.people?.people).id,
    race: first(plain.races?.races).id,
    bill: first(plain.records?.bills).id,
    state: first(plain.usmap_layers?.states).id,
    county: 0,
    district: first(plain.districts?.districts).id,
    outlet: first(plain.feed?.outlets).id,
    pollster: first(plain.polls?.pollsters).id,
  };

  it("has an article for every kind, and none of them is the 'no article' page", () => {
    for (const kind of ARTICLE_KINDS) {
      const a = buildArticle(kind, ids[kind], plain);
      expect(a.title, kind).not.toBe("No article yet");
      expect(a.lead.length, kind).toBeGreaterThan(0);
      expect(a.route).toBe(`${kind}/${ids[kind]}`);
      // The article's own route reads back to the article it is.
      expect(parseRoute(a.route)).toEqual({ kind: "article", article: kind, id: ids[kind] });
    }
  });

  it("answers an unknown id with a clean page that names the route", () => {
    for (const kind of ARTICLE_KINDS) {
      const a = buildArticle(kind, 987654, plain);
      expect(a.title).toBe("No article yet");
      expect(a.route).toBe(`${kind}/987654`);
    }
    expect(noArticle("x/1", "this thing").facts).toEqual([]);
  });

  it("builds every index with a row per entity", () => {
    const counts: Record<(typeof INDEX_KINDS)[number], number> = {
      people: plain.people?.people.length ?? 0,
      states: plain.usmap_layers?.states.length ?? 0,
      races: plain.races?.races.length ?? 0,
      bills: plain.records?.bills.length ?? 0,
      outlets: plain.feed?.outlets.length ?? 0,
      pollsters: plain.polls?.pollsters.length ?? 0,
    };
    for (const list of INDEX_KINDS) {
      const a = indexArticle(list, plain);
      const table = a.sections[0]?.blocks[0];
      expect(table?.k).toBe("table");
      expect(table?.k === "table" ? table.rows.length : -1, list).toBe(counts[list]);
      expect(counts[list], list).toBeGreaterThan(0);
    }
  });

  it("links stay in the browser, or go to the app that shows the thing better", () => {
    const apps = new Set(["browser", "polls", "records", "news", "usmap", "social"]);
    for (const kind of ARTICLE_KINDS) {
      for (const r of refs(buildArticle(kind, ids[kind], plain)))
        expect(apps.has(r.app), `${kind}: ${r.app}`).toBe(true);
    }
    const bill = buildArticle("bill", ids.bill, plain);
    expect(bill.elsewhere).toContainEqual({
      text: "The full record, with roll calls",
      app: "records",
      route: `bill/${ids.bill}`,
    });
    const race = buildArticle("race", ids.race, plain);
    expect(race.elsewhere.some((r) => r.app === "polls" && r.route === `race/${ids.race}`)).toBe(true);
  });

  it("a person's article lists their offices and elections, with no hidden stat while it is null", () => {
    const holder = (plain.people?.people ?? []).find((p) => p.career.length > 0 && p.office !== null);
    expect(holder).toBeDefined();
    const p = holder as NonNullable<typeof holder>;
    const a = buildArticle("person", p.id, plain);
    expect(a.sections.some((s) => s.id === "career")).toBe(true);
    expect(texts(a).join("\n")).toContain(p.office as string);
    expect(a.sections.some((s) => s.id === "hidden")).toBe(false);
    expect(a.facts.map((f) => f.label)).toEqual([
      "Age",
      "Party",
      "Ideology",
      "Home state",
      "Status",
      "Office",
    ]);
    for (const q of plain.people?.people ?? []) {
      expect(
        q.skills === null && q.traits === null && q.integrity === null && q.xp === null && q.level === null,
      ).toBe(true);
      expect(hiddenFacts(q)).toEqual([]);
    }
    const hiddenWords = [
      "Skills",
      "Traits",
      "Integrity",
      "Experience",
      "strength",
      "Campaign strength",
      "(debug)",
    ];
    for (const q of (plain.people?.people ?? []).slice(0, 40)) {
      const t = texts(buildArticle("person", q.id, plain)).join("\n");
      for (const w of hiddenWords) expect(t, `${q.name}: ${w}`).not.toContain(w);
    }
  });

  it("shows the hidden stats only when the views carry them (Omniscient)", () => {
    const p = first(omni.people?.people);
    expect(p.skills).not.toBeNull();
    const a = buildArticle("person", p.id, omni);
    const hidden = a.sections.find((s) => s.id === "hidden");
    expect(hidden).toBeDefined();
    const t = texts(a).join("\n");
    expect(t).toContain("Skills");
    expect(t).toContain("Integrity");
    expect(hiddenFacts(p).map((f) => f.label)).toEqual(["Skills", "Traits", "Integrity", "Experience"]);
    // Campaign strength, house effect, slant and a district's lean appear with them and not without.
    const race = (omni.races?.races ?? []).find((r) => r.candidates.some((c) => c.strength !== null));
    expect(race).toBeDefined();
    expect(texts(buildArticle("race", (race as NonNullable<typeof race>).id, omni)).join("\n")).toContain(
      "Campaign strength",
    );
    expect(
      texts(buildArticle("race", (race as NonNullable<typeof race>).id, plain)).join("\n"),
    ).not.toContain("Campaign strength");
    expect(texts(buildArticle("pollster", ids.pollster, omni)).join("\n")).toContain("House effect (debug)");
    expect(texts(buildArticle("pollster", ids.pollster, plain)).join("\n")).not.toContain("House effect");
    expect(texts(buildArticle("outlet", ids.outlet, omni)).join("\n")).toContain("Slant (debug)");
    expect(texts(buildArticle("outlet", ids.outlet, plain)).join("\n")).not.toContain("Slant");
    expect(texts(buildArticle("district", ids.district, omni)).join("\n")).toContain("Mean lean (debug)");
    expect(texts(buildArticle("district", ids.district, plain)).join("\n")).not.toContain("lean");
    expect(texts(buildArticle("county", 0, omni)).join("\n")).toContain("True lean (debug)");
    expect(texts(buildArticle("county", 0, plain)).join("\n")).not.toContain("lean");
  });

  it("a state's article names its officials, districts and counties and links to the map", () => {
    const s = first(plain.usmap_layers?.states);
    const a = buildArticle("state", s.id, plain);
    expect(a.title).toBe(s.name);
    expect(a.sections.map((x) => x.id)).toEqual(
      expect.arrayContaining(["officials", "districts", "counties"]),
    );
    expect(a.elsewhere).toContainEqual({ text: "Open on the map", app: "usmap", route: `state/${s.id}` });
    const officials = officialsOf(plain, s.name);
    expect(officials.length).toBeGreaterThan(0);
    for (const o of officials) expect(o.office).toContain(s.name);
    const districts = (plain.districts?.districts ?? []).filter((d) => d.state === s.id);
    const table = a.sections.find((x) => x.id === "districts")?.blocks[0];
    expect(table?.k === "table" ? table.rows.length : -1).toBe(districts.length);
  });

  it("the home page names the president and lists what is coming", () => {
    const h = homeArticle(plain);
    expect(h.route).toBeNull();
    expect(h.title).toBe("Almanac");
    expect(h.facts.map((f) => f.label)).toContain("President");
    expect(h.sections.map((s) => s.id)).toEqual(["browse", "upcoming"]);
  });

  it("search finds a person by a word of their name, a state, a county, and ranks an exact name first", () => {
    const index = buildSearchIndex(plain);
    const p = first(plain.people?.people);
    const word = p.name.split(" ").at(-1) as string;
    expect(searchEntries(index, word).some((e) => e.kind === "person" && e.id === p.id)).toBe(true);
    const st = first(plain.usmap_layers?.states);
    expect(searchEntries(index, st.name)[0]).toMatchObject({ kind: "state", id: st.id });
    expect(searchEntries(index, st.name.toLowerCase())[0]).toMatchObject({ kind: "state", id: st.id });
    const county = plain.usmap_layers?.counties.name[0] as string;
    expect(searchEntries(index, county)[0]?.kind).toBe("county");
    expect(searchEntries(index, "")).toEqual([]);
    expect(searchEntries(index, "zzzzqqq")).toEqual([]);
    const page = searchArticle(st.name, index);
    expect(page.route).toBe(`search/${st.name}`);
    expect(page.sections[0]?.blocks[0]?.k).toBe("table");
    expect(searchArticle("zzzzqqq", index).lead.join("")).toContain("Nothing here matches");
  });

  it("search leaves out other countries' companies", () => {
    const rows = plain.company_rows?.rows ?? [];
    expect(rows.length).toBeGreaterThan(0);
    const us = plain.places?.countries.find((c) => c.iso3 === "USA");
    expect(us).toBeDefined();
    const index = buildSearchIndex(plain);
    const companies = index.filter((e) => e.kind === "company").map((e) => e.id);
    const foreign = rows.filter((r) => r.hq_country !== us?.id).map((r) => r.id);
    expect(foreign.length).toBeGreaterThan(0);
    for (const id of foreign) expect(companies).not.toContain(id);
    for (const r of rows.filter((x) => x.hq_country === us?.id && x.status !== "Removed"))
      expect(companies).toContain(r.id);
  });

  it("a scripted event shows in the article of what it changes: the infrastructure bill becomes law", () => {
    const g = newGame(7, { debug: true });
    const bill = g.views().records.data.bills.find((b) => b.stage === "SenateFloor");
    expect(bill).toBeDefined();
    const id = (bill as NonNullable<typeof bill>).id;
    const before = buildArticle("bill", id, viewsData(g.views()));
    expect(texts(before).join("\n")).toContain("On the Senate floor");
    // 10-30 12:00: signed into law.
    g.runTo(SCRIPT.bill_signed + 1);
    const after: ViewsData = viewsData(g.views());
    const a = buildArticle("bill", id, after);
    const facts = new Map(a.facts.map((f) => [f.label, inlineText(f.value)]));
    expect(facts.get("Stage")).toBe("Law");
    expect(texts(a).join("\n")).not.toBe(texts(before).join("\n"));
  });
});
