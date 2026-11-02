// v_history (1995-rework 8.1): which world and when it started, for any page, and a historical
// world's long history. The 2020 world's holds only its start.

import type { CompanyId } from "../ids.ts";
import type { Party } from "../state/politics.ts";

export interface HistoryView {
  /** The world's manifest id. */
  world_id: string;
  /** Whole number: the year the game started in. */
  start_year: number;
  /** The scenario's name; null in the 2020 world, and until the reveal under Random (1995-rework 8.4). */
  scenario: string | null;
  /** One entry per closed year, oldest first; the arrays run in step. */
  years: number[];
  /** World GDP at each year's close, USD (1995-rework 6.1). */
  gdp_usd: number[];
  /** Named companies not removed at each year's close. */
  companies: number[];
  /** The policy rate at each year's close (1995-rework 6.2). */
  base_rate: number[];
  /** Per year, each zone's GDP in zone id order, USD (1995-rework 6.4). */
  zone_gdp_usd: number[][];
  /** The year each recession started. */
  recessions: number[];
  /** Per year, each industry's demand in id order, USD (1995-rework 8.1). */
  industry_demand_usd: number[][];
  /** Companies gone bankrupt or removed by each year's close. */
  failures: number[];
  /** Every fifth year and the run's last: the largest listed companies by market cap. */
  top10: { year: number; companies: { company: CompanyId; name: string; cap_usd: number }[] }[];
  /** When each industry emerged, in order (1995-rework 5.3). */
  emergences: { year: number; industry: string }[];
  /** A historical world's run beyond those series; absent in the 2020 world (1995-rework 8.1). */
  run?: RunHistory;
}

/** What only a historical world's history has. */
export interface RunHistory {
  /** The run has reached its end, so the scenario shows and past here is untuned (1995-rework 8.3). */
  ended: boolean;
  /** Whole number; null for a world with no end. */
  reveal_year: number | null;
  /** Whole number: Democratic House seats on the first day (1995-rework 7.2). */
  start_house_dem: number;
  /** Each president from the start, with the year they took office. */
  presidents: { year: number; name: string; party: Party }[];
  /** The US corporate tax rate at each year's close (1995-rework 7.5). */
  us_corp_tax: number[];
  /** Each named character's founding (1995-rework 7.7). */
  founders: { year: number; name: string; company: CompanyId; company_name: string }[];
  /** Each controller's death and heir (1995-rework 7.8). */
  successions: { year: number; company: CompanyId; company_name: string; from: string; to: string }[];
  /** Each large company's bankruptcy (1995-rework 8.1). */
  major_failures: { year: number; company: CompanyId; company_name: string }[];
  /** Each industry's sector, in id order. */
  sectors: string[];
  /** Companies removed from the game, whose pages are gone. */
  removed: CompanyId[];
}
