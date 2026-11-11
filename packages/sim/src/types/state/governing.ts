// What government holds over the economy (pivot 4.3): `World.levers`. Types only. M1 gives every
// world a neutral set (governing/levers.ts `leversNeutral`); the economy does not read them yet
// (lane S3 moves it off the era-only fields of era/policy.ts), and nothing moves them until laws
// and executive actions do (pivot 7.7, M3). Bills and executive actions join this file in M3.

/**
 * The levers (pivot 4.3). Government acts on the economy only through these, and they move only
 * when a law or an executive action says so (pivot 7.7). Every value here is the neutral one at
 * load: the economy with neutral levers is the economy with none.
 *
 * The per-industry arrays are indexed by `IndustryId` and the per-state one by `UsStateId`, each as
 * long as its table.
 */
export interface Levers {
  /**
   * pivot 4.3 `corp_tax`: the national corporate tax rate (mvp-spec 5.11), a fraction. Neutral: the
   * USA's `corp_tax_rate` in country-economy.csv, so reading it gives today's tax.
   */
  corp_tax: number;
  /**
   * pivot 4.3 `fiscal`: the demand push, as a share of US demand (1995-rework 7.5's fiscal push).
   * Neutral: 0.
   */
  fiscal: number;
  /**
   * pivot 4.3 `rate_bias`: added to the policy rate's target; set by the Fed chair. Neutral: 0.
   */
  rate_bias: number;
  /**
   * pivot 4.3 `regulation`, per industry: raises operating cost, as a share of it. Neutral: 0.
   */
  regulation: number[];
  /** pivot 4.3 `subsidy`, per industry: raises demand, as a share of it. Neutral: 0. */
  subsidy: number[];
  /**
   * pivot 4.3 `antitrust`, per industry: caps the largest firm's growth plan. 0 is no cap and 1 the
   * hardest; what a level caps is S3's and M3's to set (T). Neutral: 0.
   */
  antitrust: number[];
  /**
   * pivot 4.3 `tariff`, per industry: scales the rest-of-world block's supply (`Industry.row_assets`,
   * pivot 4.2) by `1 − tariff`. 0 to 1. Neutral: 0.
   */
  tariff: number[];
  /**
   * pivot 4.3 `state_growth`, per US state: shifts the growth of its counties' population and of the
   * firms headquartered there, a year. Neutral: 0.
   */
  state_growth: number[];
  /**
   * pivot 4.3 `gains_tax` (player scope; pivot 14.2): the rate on the player's realised gains, a
   * fraction. Neutral: 0, until the player lane (M2) sets the starting rate from data.
   */
  gains_tax: number;
  /**
   * pivot 4.3 `income_tax` (player scope; pivot 14.2): the rate on the player's interest income, a
   * fraction. Neutral: 0, until the player lane (M2) sets the starting rate from data.
   */
  income_tax: number;
}
