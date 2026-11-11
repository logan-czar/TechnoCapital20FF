// F8 Account (pivot 14.1, 14.2): the player's money from v_account, all of it the player's own to
// see: cash at each venue, positions with their average cost and unrealised gain, open orders with
// Cancel, recent fills. A value the view leaves null (an order's mean price before its first fill)
// is a dash, never a guess.

import type { FillRow, PositionRow } from "@tc20ff/sim";
import { useViewData } from "../../sim/hooks.ts";
import { priceAt, signedUsd, tone, usd, whenOf } from "./fmt.ts";
import { Named, OpenOrders, useLabeler } from "./orders.tsx";

/** Fills shown: the latest; the view holds every one (v_account `fills`). */
export const RECENT_FILLS = 30;

function Empty({ children }: { children: string }) {
  return (
    <div className="term-page term-empty-page" data-testid="term-account-empty">
      <p className="term-empty">{children}</p>
    </div>
  );
}

export function AccountPage() {
  const account = useViewData("account");
  const label = useLabeler();
  if (account === undefined) return <Empty>Waiting for the account...</Empty>;
  if (!account.open) return <Empty>No account is open yet.</Empty>;

  const fills: FillRow[] = account.fills.slice(-RECENT_FILLS).reverse();
  return (
    <div className="term-page" data-testid="term-account">
      <div className="term-summary">
        <span>
          Net worth <strong data-testid="account-net-worth">{usd(account.net_worth)}</strong>
        </span>
        <span>
          Realised this tax year{" "}
          <strong className={`t-${tone(account.realised_gains)}`}>{signedUsd(account.realised_gains)}</strong>
        </span>
        <span>
          Tax due in April <strong>{usd(account.tax_due)}</strong>
        </span>
        {account.bankrupt && <span className="term-error">Bankrupt: the run is over.</span>}
      </div>

      <section className="term-block">
        <h3>Cash</h3>
        <table className="term-table" data-testid="account-cash">
          <thead>
            <tr>
              <th>Venue</th>
              <th className="num">Cash</th>
              <th className="num">Reserved</th>
              <th className="num">Available</th>
            </tr>
          </thead>
          <tbody>
            {account.cash.map((c) => (
              <tr key={c.venue} data-testid={`account-cash-${c.venue}`}>
                <td>{c.venue}</td>
                <td className="num">{usd(c.cash)}</td>
                <td className="num">{usd(c.reserved)}</td>
                <td className="num">{usd(c.cash - c.reserved)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="term-block">
        <h3>Positions</h3>
        {account.positions.length === 0 ? (
          <p className="term-empty">No positions.</p>
        ) : (
          <div className="term-scroll">
            <table className="term-table" data-testid="account-positions">
              <thead>
                <tr>
                  <th>Holding</th>
                  <th>Venue</th>
                  <th>Side</th>
                  <th className="num">Qty</th>
                  <th className="num">Avg cost</th>
                  <th className="num">Mark</th>
                  <th className="num">Unrealised</th>
                </tr>
              </thead>
              <tbody>
                {account.positions.map((p: PositionRow) => (
                  <tr
                    key={`${p.venue}-${p.instrument}-${p.side}`}
                    data-testid={`position-row-${p.instrument}`}
                  >
                    <td>
                      <Named to={p.what} label={label(p.what)} />
                    </td>
                    <td>{p.venue}</td>
                    <td>{p.side}</td>
                    <td className="num">{p.qty}</td>
                    <td className="num">{priceAt(p.venue, p.avg_cost)}</td>
                    <td className="num">{priceAt(p.venue, p.mark)}</td>
                    <td className={`num t-${tone(p.unrealised)}`}>{signedUsd(p.unrealised)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <OpenOrders orders={account.orders} label={label} />

      <section className="term-block">
        <h3>Recent fills</h3>
        {fills.length === 0 ? (
          <p className="term-empty">No fills yet.</p>
        ) : (
          <div className="term-scroll">
            <table className="term-table" data-testid="account-fills">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Instrument</th>
                  <th>Side</th>
                  <th className="num">Qty</th>
                  <th className="num">Price</th>
                  <th className="num">Fee</th>
                  <th className="num">Realised</th>
                </tr>
              </thead>
              <tbody>
                {fills.map((f, i) => (
                  <tr key={`${f.order}-${f.time}-${i}`} data-testid={`fill-row-${f.order}-${f.time}`}>
                    <td>{whenOf(f.time)}</td>
                    <td>
                      <Named to={f.what} label={label(f.what)} />
                    </td>
                    <td>{f.side}</td>
                    <td className="num">{f.qty}</td>
                    <td className="num">{priceAt(f.venue, f.price)}</td>
                    <td className="num">{usd(f.fee)}</td>
                    <td className={`num t-${tone(f.realised)}`}>
                      {f.side === "Sell" ? signedUsd(f.realised) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
