// Port of crates/sim/tests/m9_views.rs: the M9 views (docs/build/m9-plan.md section 2; spec 9.2,
// 9.4): cap table, characters, countries, places, zones, rates, the clock's next release, the
// company row additions, the births column and event names, the Omniscient toggle, the EFV
// history, and the rule that building views never moves an RNG stream (the past-recaps test is in
// pending/views/m9_views.test.ts). Expected values come from the data tables and the spec.
//
// Expects:
//   ../../src/lib.ts                 simNew, simApply, simStep, simNow, simWorld, simViews,
//                                       simClock, simControls, simStateHash; startWorld(data,
//                                       draws) -> Result<World, LoadError>
//   ../../src/jobs.ts                scheduler()
//   ../../src/time/scheduler.ts      schedulerRunTick(s, world, draws, notices, controls, null)
//   ../../src/hash.ts                stateHash(world, rng)                    [hash::state_hash]
//   ../../src/rng.ts                 rngStreamsNew, rngStreamsDraws (exist)
//   ../../src/people/traits.ts       traitFromName(name) -> Trait | null     [Trait::from_name]
//   ../../src/views/places.ts        placesViewPlaceName(view, province) -> string | null
//   ../../src/views/price_bars.ts    priceBarsViewGetPriceHistory
//   ../../src/views/statements.ts    companyStatementsQuarters(cs) -> Statement[] (published
//                                       quarters when exact) [CompanyStatements::quarters; the
//                                       estimated view holds none]
//   ../../src/market/daily.ts        dailyBarEfvLow(bar), dailyBarEfvHigh(bar)
//                                       [DailyBar::efv_low, ::efv_high]
//   ../common/ops.ts                    company, companyRow, runTo
//
// Changed from the Rust:
// - Seeds (1, 2, 4, 9) are the new generator (D951). Facts checked here come from the CSVs and
//   the spec (cap tables, Terry's roles, countries and rates), from structure (births counted in
//   the last four quarters), or from a rule that holds for any draw. Two
//   assertions name events the draws decide and keep the Rust's expectation: "F1 fires at the
//   9 April 2020 lock" is a fixed event (startup-events.csv trigger, not a draw), and `counted >=
//   2` is F1's 2 AI labs.
// - building_views_moves_no_rng_stream compares a bare scheduler run (state, RNG streams) with a
//   Sim run: the same seed gives the same World and the same state hash. `assert_eq!(world,
//   *sim.world())` is numbersDiffer == null.
// - `Trait::from_name(n.trim())` with filter_map drops names that are not traits (D113): the
//   same filter on traitFromName.
import { type Character as CharacterRow, type WorldData, worldDataAllProvinces } from "@tc20ff/sim-data";
import { describe, expect, it } from "vitest";
import { stateHash } from "../../src/hash.ts";
import { scheduler } from "../../src/jobs.ts";
import {
  simApply,
  simClock,
  simControls,
  simNew,
  simNow,
  simStateHash,
  simStep,
  simViews,
  simWorld,
  startWorld,
} from "../../src/lib.ts";
import { dailyBarEfvHigh, dailyBarEfvLow } from "../../src/market/daily.ts";
import { traitFromName } from "../../src/people/traits.ts";
import { rngStreamsDraws, rngStreamsNew } from "../../src/rng.ts";
import { dateTimeAt, dateTimeMidnight, simDateQuarter, simDateYmd } from "../../src/time/calendar.ts";
import { controlsDefault } from "../../src/time/control.ts";
import { schedulerRunTick } from "../../src/time/scheduler.ts";
import { cmpQuarter } from "../../src/types/calendar.ts";
import type { CharacterId, CompanyId } from "../../src/types/ids.ts";
import type { Notice } from "../../src/types/world.ts";
import { placesViewPlaceName } from "../../src/views/places.ts";
import { priceBarsViewGetPriceHistory } from "../../src/views/price_bars.ts";
import { chunkLogRows } from "../../src/world/log.ts";
import { data, numbersDiffer, unwrap } from "../common/index.ts";
import { company, companyRow, runTo } from "../common/ops.ts";
import { byField, byId, figBand, figExact } from "../common/views.ts";

function character(d: WorldData, key: string): CharacterRow {
  const c = d.characters.rows.find((c) => c.id === key);
  if (c === undefined) throw new Error(`no character ${key}`);
  return c;
}

describe("m9 views", () => {
  it("cap_tables_split_the_starting_block_by_the_controller_stake", () => {
    const d = data();
    const sim = unwrap(simNew(structuredClone(d), 1), "Sim::new");
    const w = simWorld(sim);
    const v = simViews(sim).cap_table.data;
    w.companies.forEach((c, i) => {
      const t = byField(v.companies, "company", i as CompanyId);
      expect(t?.lines.reduce((acc, l) => acc + l.shares, 0)).toBe(c.shares_out);
    });
    // Arrowhead (CO-0001): Terry Tippacanoe (CH-0002) holds 60% of 6,666,667 shares
    // (companies.csv, company-start.csv): 4,000,000 rounded; the other holders the rest.
    const a = byField(v.companies, "company", company(w, "CO-0001"));
    if (a === undefined) throw new Error("no cap table");
    const row = companyRow(d, "CO-0001");
    const shares = d.company_start.rows.find((s) => s.id === "CO-0001")?.shares;
    expect(shares).toBe(6_666_667);
    expect(row.controller_stake_pct).toBe(60.0);
    expect(a.lines.length).toBe(2);
    expect(a.lines[0]?.name).toBe(character(d, "CH-0002").name);
    expect(
      a.lines[0]?.holder.kind === "Controller" && a.lines[0].holder.controller.kind === "Character",
    ).toBe(true);
    expect(a.lines[0]?.shares).toBe(4_000_000);
    expect(a.lines[1]?.holder).toEqual({ kind: "OtherHolders" });
    expect(a.lines[1]?.shares).toBe(2_666_667);
    expect(Math.abs((a.lines[0]?.share as number) - 0.6) < 1e-6).toBe(true);
    // A state champion (CO-0138, Saudi Arabia 98%) and a widely held company (CO-0123).
    const ghawar = byField(v.companies, "company", company(w, "CO-0138"));
    expect(ghawar?.lines[0]?.name).toBe("Saudi Arabia");
    expect(Math.abs((ghawar?.lines[0]?.share as number) - 0.98) < 1e-6).toBe(true);
    const lacoste = byField(v.companies, "company", company(w, "CO-0123"));
    expect(lacoste?.lines.length).toBe(1);
    expect(lacoste?.lines[0]?.holder).toEqual({ kind: "OtherHolders" });
    // A subsidiary (CO-0134, 100% CO-0132) names its parent company and has no other holders.
    const halcyon = byField(v.companies, "company", company(w, "CO-0134"));
    expect(halcyon?.lines.length).toBe(1);
    expect(halcyon?.lines[0]?.name).toBe(companyRow(d, "CO-0132").name);
  });

  it("characters_list_terry_with_his_roles_and_holdings", () => {
    const d = data();
    const sim = unwrap(simNew(structuredClone(d), 1), "Sim::new");
    const w = simWorld(sim);
    const v = simViews(sim).characters.data;
    expect(v.full.length).toBe(d.characters.rows.length);
    const idOf = (key: string): CharacterId => {
      const i = w.characters.findIndex((c) => c.key === key);
      if (i < 0) throw new Error(`no character ${key}`);
      return i as CharacterId;
    };
    const terryId = idOf("CH-0002");
    const t = v.full.find((c) => c.id.kind === "Full" && c.id.id === terryId);
    if (t === undefined) throw new Error("no Terry");
    const csv = character(d, "CH-0002");
    expect([t.name, t.age]).toEqual([csv.name, csv.age]);
    expect([t.skills.finance, t.skills.operations, t.skills.persuasion]).toEqual([
      csv.finance,
      csv.operations,
      csv.persuasion,
    ]);
    expect([t.skills.intrigue, t.skills.tech, t.skills.hustle]).toEqual([csv.intrigue, csv.tech, csv.hustle]);
    const traits = csv.traits.map((n) => traitFromName(n.trim())).filter((x) => x !== null);
    expect(t.traits).toEqual(traits);
    expect(t.full && t.id.kind === "Full" && t.id.id === terryId).toBe(true);
    const home = t.home;
    if (home === null) throw new Error("no home");
    expect([home.province_name, home.country_name]).toEqual(["Edmonton", "Canada"]);
    // companies.csv: Terry controls CO-0001 to CO-0003 (60%, 100%, 100%).
    const controls = t.roles.flatMap((r) => (r.kind === "Controller" ? [w.companies[r.company]?.key] : []));
    expect(controls).toEqual(["CO-0001", "CO-0002", "CO-0003"]);
    expect(t.holdings.length).toBe(3);
    expect(Math.abs((t.holdings[0]?.share as number) - 0.6) < 1e-6).toBe(true);
    expect(Math.abs((t.holdings[1]?.share as number) - 1.0) < 1e-12).toBe(true);
    // A proxy: CH-0107 is the owner of record of CO-0031 and CO-0032 (companies.csv).
    const proxyId = idOf("CH-0107");
    const proxy = v.full.find((c) => c.id.kind === "Full" && c.id.id === proxyId);
    const owned = (proxy?.roles ?? []).flatMap((r) =>
      r.kind === "OwnerOfRecord" ? [w.companies[r.company]?.key] : [],
    );
    expect(owned).toEqual(["CO-0031", "CO-0032"]);
    // Every seated simple character is listed once, as partial, with its seat.
    const seated = w.companies.reduce(
      (acc, c) => acc + c.board.filter((h) => h !== null && h.kind === "Simple").length,
      0,
    );
    expect(v.partial.length).toBe(seated);
    expect(v.partial.every((p) => !p.full && p.home === null && p.roles.length === 1)).toBe(true);
    for (let i = 0; i + 1 < v.partial.length; i++) {
      const [a, b] = [v.partial[i]?.id, v.partial[i + 1]?.id];
      expect(a?.kind === "Partial" && b?.kind === "Partial" && a.id < b.id).toBe(true);
    }
  });

  it("countries_places_zones_and_rates_read_the_data", () => {
    const d = data();
    const sim = unwrap(simNew(structuredClone(d), 1), "Sim::new");
    const v = simViews(sim);
    const countries = v.countries.data;
    expect(countries.countries.length).toBe(d.countries.rows.length);
    // countries.csv and country-economy.csv: the United States.
    const usa = countries.countries.find((c) => c.iso3 === "USA");
    if (usa === undefined) throw new Error("no USA");
    expect([usa.name, usa.superregion]).toEqual(["United States", "North America"]);
    expect(usa.sovereign_rating).toEqual("Aaa");
    expect([usa.sovereign_spread, usa.corp_tax_rate]).toEqual([0.0, 0.258]);
    const hqUsa = d.companies.rows.filter((c) => c.hq_country === "USA").length;
    expect(usa.hq_companies.length).toBe(hqUsa);
    expect(hqUsa).toBe(109);
    const total = countries.countries.reduce((acc, c) => acc + c.hq_companies.length, 0);
    expect(total).toBe(651);

    const places = v.places.data;
    expect(places.provinces.length).toBe(worldDataAllProvinces(d).length);
    expect(places.provinces.length).toBe(3963);
    const edmonton = places.provinces.find((p) => p.key === "CA-0033");
    if (edmonton === undefined) throw new Error("no Edmonton");
    expect(placesViewPlaceName(places, edmonton.id)).toBe("Edmonton, Canada");

    // 26 zones (spec 5.1.2, batch 154); every country in exactly one; spreads as v_cycle.
    const zones = v.zones.data;
    expect(zones.zones.length).toBe(26);
    const members = zones.zones.reduce((acc, z) => acc + z.members.length, 0);
    expect(members).toBe(countries.countries.length);
    zones.zones.forEach((z, i) => {
      const c = v.cycle.data.zones[i];
      expect([z.id, z.credit_spread, z.confidence]).toEqual([c?.id, c?.credit_spread, c?.confidence]);
      for (const m of z.members) expect(byId(countries.countries, m)?.zone).toBe(z.id);
    });

    // F7 Bonds (spec 5.12 table, batch 155): base 3%, AAA 40 bps to CC 1,600 bps.
    const rates = v.rates.data;
    expect(rates.base_rate).toBe(0.03);
    expect(rates.rating_spreads.length).toBe(18);
    expect(rates.rating_spreads[0]).toEqual({ rating: "Aaa", spread: 0.004 });
    expect(rates.rating_spreads[17]).toEqual({ rating: "Cc", spread: 0.16 });
    expect(rates.zones.length).toBe(26);
    const usaRate = byField(rates.sovereigns, "country", usa.id);
    expect([usaRate?.rating, usaRate?.spread]).toEqual(["Aaa", 0.0]);
  });

  it("the_clock_shows_the_next_release", () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    // Spec 4.4 row 1: releases at 00:00 on 2 January, April, July and October.
    expect(simClock(sim).next_release).toBe(dateTimeMidnight(simDateYmd(2020, 1, 2)));
    runTo(sim, simDateYmd(2020, 1, 2));
    expect(simClock(sim).next_release).toBe(dateTimeMidnight(simDateYmd(2020, 4, 2)));
  });

  it("company_rows_carry_archetype_origin_listing_and_control", () => {
    const d = data();
    const sim = unwrap(simNew(structuredClone(d), 1), "Sim::new");
    const w = simWorld(sim);
    const rows = simViews(sim).company_rows.data.rows;
    const row = (key: string) => {
      const r = rows.find((r) => r.key === key);
      if (r === undefined) throw new Error(`no row ${key}`);
      return r;
    };
    const a = row("CO-0001");
    expect(a.origin).toEqual({ kind: "Start" });
    expect(a.archetype).toEqual(w.companies[a.id]?.archetype);
    expect(a.listing.kind, "listed before 2020").toBe("BeforeStart");
    // Listing::date() is None before the start; Listing::exchange() is the row's exchange.
    expect(a.listing.kind === "BeforeStart" ? a.listing.exchange : null).toBe(a.exchange);
    expect(a.controller_name).toBe("Terry Tippacanoe");
    expect(a.owner_of_record).toBeNull();
    expect(!a.estimated && figExact(a.revenue_ttm) !== null).toBe(true);
    // CO-0031 is private, held for CH-0011 by its owner of record CH-0107 (companies.csv).
    const b = row("CO-0031");
    expect(b.listing).toEqual({ kind: "Private" });
    expect(b.controller_name).toBe(character(d, "CH-0011").name);
    expect(b.owner_of_record_name).toBe(character(d, "CH-0107").name);
    expect(b.estimated && figBand(b.revenue_ttm) !== null && figBand(b.value) !== null).toBe(true);
    // A widely held company has no controller.
    expect(row("CO-0123").controller).toEqual({ kind: "None" });
    expect(row("CO-0123").controller_name).toBeNull();
  });

  it("births_count_the_last_four_quarters_and_name_their_events", () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    // F1 fires at the 9 April 2020 plan lock (startup-events.csv) with 2 AI labs.
    runTo(sim, simDateYmd(2020, 4, 9));
    const v = structuredClone(simViews(sim).births.data);
    const f1 = v.events.find((e) => e.kind.kind === "Fixed" && e.kind.id === "F1");
    if (f1 === undefined) throw new Error("F1 fired");
    expect(f1.name).toBe("The transformer paper: researchers leave to build on it");
    for (const b of v.births) expect(v.events.some((e) => e.id === b.event)).toBe(true);
    expect(v.births_column_quarters.length).toBe(4);
    const counted = v.births_by_industry.reduce((acc, n) => acc + n, 0);
    expect(counted, "every 2020 birth is in the last 4 quarters").toBe(v.births.length);
    expect(counted >= 2).toBe(true);
    // A year and a half on, the Q2 2020 births have left the column.
    runTo(sim, simDateYmd(2021, 10, 9));
    const v2 = simViews(sim).births.data;
    const first = v2.births_column_quarters[0];
    if (first === undefined) throw new Error("no quarters");
    const want = v2.births.filter((b) => cmpQuarter(simDateQuarter(b.date), first) >= 0).length;
    expect(v2.births_by_industry.reduce((acc, n) => acc + n, 0)).toBe(want);
    expect(want < v2.births.length).toBe(true);
  }, 120_000);

  it("omniscient_toggles_rebuild_the_banded_views_at_once", () => {
    // Changed from the Rust: SetOmniscient is debug-only (Rust cfg!(debug_assertions), on in
    // tests), so the TS sim is made with { debug: true } and the rest of the test runs.
    const sim = unwrap(simNew(data(), 1, { debug: true }), "Sim::new");
    runTo(sim, simDateYmd(2020, 2, 10));
    const priv = company(simWorld(sim), "CO-0002");
    const before = simViews(sim).statements.version;
    expect(byField(simViews(sim).statements.data.companies, "id", priv)?.estimated).toBe(true);
    // A speed change rebuilds none of them (D423).
    unwrap(simApply(sim, { kind: "SetSpeed", speed: 3 }), "SetSpeed");
    expect(simViews(sim).statements.version).toBe(before);
    // Omniscient is debug-only (spec 1): skip the rest when it is not accepted.
    if (!simApply(sim, { kind: "SetOmniscient", on: true }).ok) return;
    const v = simViews(sim);
    expect(v.statements.version > before && v.statements.dirty).toBe(true);
    const s = byField(v.statements.data.companies, "id", priv);
    expect(
      s !== undefined && !s.estimated && s.estimated_quarters.length === 0 && s.quarters.length > 0,
    ).toBe(true);
    const truth = simWorld(sim).companies[priv]?.cash_usd;
    expect(figExact(byField(v.company_detail.data.companies, "id", priv)?.cash_usd as never)).toBe(truth);
    unwrap(simApply(sim, { kind: "SetOmniscient", on: false }), "SetOmniscient");
    const s2 = byField(simViews(sim).statements.data.companies, "id", priv);
    expect(
      s2 !== undefined && s2.estimated && s2.quarters.length === 0 && s2.estimated_quarters.length > 0,
    ).toBe(true);

    // The quarterly rebuild reuses archived quarters' estimates (D435): after a year of
    // rebuilds, a fresh build (the toggle) gives the same view.
    runTo(sim, simDateYmd(2021, 4, 2));
    const rebuilt = structuredClone(simViews(sim).statements.data);
    const banded = rebuilt.companies.filter((c) => c.estimated).length;
    expect(banded > 100).toBe(true);
    unwrap(simApply(sim, { kind: "SetOmniscient", on: true }), "SetOmniscient");
    unwrap(simApply(sim, { kind: "SetOmniscient", on: false }), "SetOmniscient");
    expect(simViews(sim).statements.data).toEqual(rebuilt);
  }, 300_000);

  it("daily_bars_keep_the_day_s_efv", () => {
    const sim = unwrap(simNew(data(), 4), "Sim::new");
    const a = company(simWorld(sim), "CO-0001");
    runTo(sim, simDateYmd(2020, 3, 3));
    // At 23:00 the quote shows the EFV in force; the 00:00 close stores it with the bar (D424),
    // before the day's fair value refresh.
    while (simNow(sim) < dateTimeAt(simDateYmd(2020, 3, 3), 23)) simStep(sim);
    const efv = byField(simViews(sim).quotes.data.rows, "id", a)?.efv as number;
    simStep(sim);
    const bars = chunkLogRows(simWorld(sim).market.stocks[a]?.bars.log as never) as {
      date: never;
      efv: number;
    }[];
    const bar = bars[bars.length - 1] as unknown as Parameters<typeof dailyBarEfvLow>[0];
    expect(bar.date).toEqual(simDateYmd(2020, 3, 3));
    expect(bar.efv).toBe(efv);
    expect(dailyBarEfvLow(bar) < bar.efv && bar.efv < dailyBarEfvHigh(bar)).toBe(true);
    // The view serves it; a weekly bar takes its last day's EFV.
    const pb = simViews(sim).price_bars.data;
    const daily = priceBarsViewGetPriceHistory(pb, a, "Daily", simDateYmd(2020, 1, 1), bar.date);
    expect(daily.at(-1)?.efv).toBe(efv);
    expect(daily.every((b) => b.efv > 0.0)).toBe(true);
    const weekly = priceBarsViewGetPriceHistory(pb, a, "Weekly", simDateYmd(2020, 1, 1), bar.date);
    expect(weekly.at(-1)?.efv).toBe(efv);
  }, 120_000);

  it("building_views_moves_no_rng_stream", () => {
    // The same seed run through a bare scheduler (no views at all) and through Sim (views after
    // every tick, and Omniscient and watchlist controls rebuilding views between ticks) ends in
    // the same world and the same RNG positions (D421).
    const d = data();
    const seed = 9;
    // { debug: true }: SetOmniscient is debug-only (Rust cfg!(debug_assertions), on in tests).
    const sim = unwrap(simNew(structuredClone(d), seed, { debug: true }), "Sim::new");
    const rng = rngStreamsNew(seed);
    const draws = rngStreamsDraws(rng);
    const world = unwrap(startWorld(structuredClone(d), draws), "start_world");
    const sched = scheduler();
    const controls = controlsDefault();
    const end = dateTimeMidnight(simDateYmd(2020, 7, 10));
    let tick = 0;
    while (simNow(sim) < end) {
      simStep(sim);
      const notices: Notice[] = [];
      schedulerRunTick(sched, world, draws, notices, controls, null);
      tick += 1;
      if (tick % 500 === 0) {
        const on = !simControls(sim).omniscient;
        unwrap(simApply(sim, { kind: "SetOmniscient", on }), "SetOmniscient");
        unwrap(simApply(sim, { kind: "WatchlistAdd", company: (tick % 651) as CompanyId }), "WatchlistAdd");
      }
    }
    expect(numbersDiffer(world, simWorld(sim))).toBeNull();
    expect(simStateHash(sim)).toBe(stateHash(world, rng));
  }, 300_000);
});
