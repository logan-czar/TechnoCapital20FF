// v_history (1995-rework 8.1): which world and when it started, for any page, and a historical
// world's long history. The 2020 world's holds only its start.

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
}
