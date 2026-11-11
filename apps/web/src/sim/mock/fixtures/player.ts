// The mock player's first eight weeks (v_account's starting state): the trades, follows and alerts
// the pre-rolled history makes on the player's behalf, so a new mock game opens with cash at both
// venues, positions, open and closed orders, fills and notifications. Each goes through the same
// `PlayerAction` path as a real click (../pivot.ts `apply`), so the books always add up.

import {
  type CompanyId,
  type ContractId,
  type DateTime,
  dateTimeAt,
  type HandleId,
  type InstrumentId,
  type OrderSide,
  type PlayerAction,
  simDateYmd,
} from "@tc20ff/sim";
import type { MockPivot } from "../pivot.ts";
import { contractInstrument, stockInstrument } from "./account.ts";
import type { MockContract } from "./markets.ts";
import type { MockRace } from "./races.ts";
import { BILL } from "./records.ts";
import { SCRIPT } from "./script.ts";

/** An action the script takes at a tick; `run` reads the market as it stands then. Null skips it. */
export interface ScriptedAction {
  at: DateTime;
  run: () => PlayerAction | null;
}

/** Cash the player moves to the exchange on opening, USD. */
const EXCHANGE_DEPOSIT = 15_000;
/** USD of each of the two stocks bought. */
const STOCK_BUYS = [6000, 4500] as const;

const at = (month: number, day: number, hour: number): DateTime =>
  dateTimeAt(simDateYmd(2020, month, day), hour);

export function playerScript(p: MockPivot): ScriptedAction[] {
  const ms = p.markets;
  const pol = p.pol;
  const pres = pol.races[0] as MockRace;
  const winner = (race: number, person: number): MockContract =>
    ms.contracts.find((c) => {
      if (c.fair.kind !== "RaceWinner" || c.fair.race !== race) return false;
      const r = pol.races[race] as MockRace;
      return (r.candidates[r.ballot[c.fair.ballot] as number] as { person: number }).person === person;
    }) as MockContract;
  const challenger = winner(pres.id, pol.challenger);
  const tight = pol.races[pol.dropout_race] as MockRace;
  const tightLeader = winner(
    tight.id,
    (
      tight.candidates[tight.ballot[tight.final_margin >= 0 ? tight.dem : tight.rep] as number] as {
        person: number;
      }
    ).person,
  );
  const recount = pol.races[pol.recount_race] as MockRace;
  const recountFirst = winner(
    recount.id,
    (recount.candidates[recount.ballot[0] as number] as { person: number }).person,
  );
  const named = (key: string) => ms.contracts[ms.named[key] as ContractId] as MockContract;
  const stocks = p.hooks.largest();

  const order = (
    c: MockContract,
    side: OrderSide,
    qty: number,
    limit: number | null,
    tif: "Day" | "Gtc" = "Gtc",
  ): PlayerAction => ({
    kind: "PlaceOrder",
    venue: "Exchange",
    instrument: contractInstrument(c.id),
    side,
    qty,
    limit,
    tif,
  });
  const stock = (i: number, usd: number): PlayerAction | null => {
    const id = stocks[i] as CompanyId | undefined;
    const price = id === undefined ? null : p.hooks.stockPrice(id);
    if (id === undefined || price === null) return null;
    const qty = Math.floor(usd / price);
    return qty < 1
      ? null
      : {
          kind: "PlaceOrder",
          venue: "Brokerage",
          instrument: stockInstrument(id),
          side: "Buy",
          qty,
          limit: null,
          tif: "Day",
        };
  };
  const follow = (kind: "Handle" | "Race" | "Bill" | "Person", id: number): PlayerAction => ({
    kind: "Follow",
    target: { kind, id },
  });
  const clamp = (x: number) => Math.min(99, Math.max(1, x));

  const open = SCRIPT.player_opens;
  const script: ScriptedAction[] = [
    {
      at: open,
      run: () => ({ kind: "Transfer", from: "Brokerage", to: "Exchange", amount: EXCHANGE_DEPOSIT }),
    },
    { at: open, run: () => follow("Handle", p.social.pundits[0] as HandleId) },
    { at: open, run: () => follow("Handle", p.social.of_person.get(pol.president) as HandleId) },
    { at: open, run: () => follow("Handle", p.social.anonymous[0] as HandleId) },
    { at: open, run: () => follow("Race", pres.id) },
    { at: open, run: () => follow("Bill", BILL.infrastructure) },
    { at: open, run: () => follow("Person", pol.challenger) },
    { at: at(8, 25, 15), run: () => stock(0, STOCK_BUYS[0]) },
    { at: at(9, 3, 11), run: () => order(challenger, "Buy", 1500, null) },
    { at: at(9, 10, 15), run: () => stock(3, STOCK_BUYS[1]) },
    { at: at(9, 22, 14), run: () => order(named("infra_law"), "Buy", 800, null) },
    {
      at: at(10, 1, 9),
      run: () => ({
        kind: "AlertRuleAdd",
        rule: {
          target: { kind: "Contract", id: named("leaves").id },
          when: { kind: "PriceAbove", price: 30 },
          pause: false,
        },
      }),
    },
    {
      at: at(10, 1, 9),
      run: () => ({
        kind: "AlertRuleAdd",
        rule: { target: { kind: "Bill", id: BILL.tax }, when: { kind: "Any" }, pause: true },
      }),
    },
    {
      at: at(10, 1, 9),
      run: () => {
        const id = stocks[0];
        const price = id === undefined ? null : p.hooks.stockPrice(id);
        if (id === undefined || price === null) return null;
        return {
          kind: "AlertRuleAdd",
          rule: {
            target: { kind: "Company", id },
            when: { kind: "PriceBelow", price: Math.floor(price * 85) / 100 },
            pause: false,
          },
        };
      },
    },
    { at: at(10, 5, 10), run: () => order(named("leaves"), "Buy", 500, null) },
    // Selling Yes with none held: the No side (pivot 10.5).
    { at: at(10, 9, 13), run: () => order(tightLeader, "Sell", 300, null) },
    { at: at(10, 12, 10), run: () => order(recountFirst, "Buy", 400, null) },
    { at: at(10, 16, 11), run: () => order(challenger, "Buy", 500, clamp((challenger.bid ?? 40) - 4)) },
    { at: at(10, 18, 10), run: () => order(named("infra_law"), "Sell", 200, 97) },
    {
      at: at(10, 18, 15),
      run: () => {
        const i = contractInstrument(named("infra_law").id) as InstrumentId;
        const o = p.account.orders.find((x) => x.status === "Open" && x.instrument === i);
        return o === undefined ? null : { kind: "CancelOrder", order: o.id };
      },
    },
    // A day order that is not reached expires at midnight.
    {
      at: at(10, 19, 10),
      run: () => order(challenger, "Sell", 300, clamp((challenger.ask ?? 60) + 6), "Day"),
    },
    { at: at(10, 19, 12), run: () => order(challenger, "Sell", 400, clamp((challenger.ask ?? 60) + 5)) },
  ];
  return script.sort((a, b) => a.at - b.at);
}
