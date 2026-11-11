// What the Account page and the Order ticket share: how a position or an order names its company or
// contract, and the list of open orders with Cancel (pivot 11.1: `CancelOrder`).

import { actErrorMessage, type CompanyRow, type EntityRef, type OrderId, type OrderRow } from "@tc20ff/sim";
import { useCallback, useMemo, useState } from "react";
import { useSim, useViewData, useViewDataThrottled } from "../../sim/hooks.ts";
import { EntityLink } from "../_shared/index.ts";
import { priceAt, whenOf } from "./fmt.ts";

/** Names things the account holds: "ARDR Ardor Systems" for a company, a contract's title. */
export type Labeler = (ref: EntityRef) => string;

export function makeLabeler(
  companies: readonly CompanyRow[] | undefined,
  contracts: readonly { id: number; title: string }[] | undefined,
): Labeler {
  return (ref) => {
    if (ref.kind === "Company") {
      const c = companies?.find((r) => r.id === ref.id);
      if (c === undefined) return `Company ${ref.id}`;
      return c.public && c.ticker !== "" ? `${c.ticker} ${c.name}` : c.name;
    }
    if (ref.kind === "Contract")
      return contracts?.find((r) => r.id === ref.id)?.title ?? `Contract ${ref.id}`;
    return `${ref.kind} ${ref.id}`;
  };
}

/** The labeler over the live views: companies, and contract titles (read slowly: they move hourly). */
export function useLabeler(): Labeler {
  const companies = useViewData("company_rows")?.rows;
  const markets = useViewDataThrottled("markets", 2000);
  return useMemo(() => makeLabeler(companies, markets?.contracts), [companies, markets]);
}

/** A name that links to the thing it names. */
export function Named({ to, label }: { to: EntityRef; label: string }) {
  return <EntityLink to={to}>{label}</EntityLink>;
}

/** Sends `CancelOrder`; `error` is the sim's reason when it refuses. */
export function useCancel(): {
  cancel: (id: OrderId) => void;
  error: string | null;
  pending: OrderId | null;
} {
  const sim = useSim();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<OrderId | null>(null);
  const cancel = useCallback(
    (id: OrderId) => {
      setError(null);
      setPending(id);
      sim
        .act({ kind: "CancelOrder", order: id })
        .then((r) => {
          if (r.kind === "ActError") setError(actErrorMessage(r.error));
          else if (r.kind !== "Ok") setError("The order could not be cancelled.");
        })
        .catch(() => setError("The order could not be cancelled."))
        .finally(() => setPending(null));
    },
    [sim],
  );
  return { cancel, error, pending };
}

/** The player's open orders, each with Cancel. */
export function OpenOrders({ orders, label }: { orders: readonly OrderRow[]; label: Labeler }) {
  const open = useMemo(() => orders.filter((o) => o.status === "Open"), [orders]);
  const { cancel, error, pending } = useCancel();
  return (
    <section className="term-block" data-testid="term-open-orders">
      <h3>Open orders</h3>
      {open.length === 0 ? (
        <p className="term-empty">No open orders.</p>
      ) : (
        <div className="term-scroll">
          <table className="term-table">
            <thead>
              <tr>
                <th>Placed</th>
                <th>Venue</th>
                <th>Instrument</th>
                <th>Side</th>
                <th className="num">Qty</th>
                <th className="num">Filled</th>
                <th className="num">Limit</th>
                <th>Good</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {open.map((o) => (
                <tr key={o.id} data-testid={`order-row-${o.id}`}>
                  <td>{whenOf(o.placed)}</td>
                  <td>{o.venue}</td>
                  <td>
                    <Named to={o.what} label={label(o.what)} />
                  </td>
                  <td>{o.side}</td>
                  <td className="num">{o.qty}</td>
                  <td className="num">{o.filled}</td>
                  <td className="num">{o.limit === null ? "Market" : priceAt(o.venue, o.limit)}</td>
                  <td>{o.tif === "Gtc" ? "GTC" : "Day"}</td>
                  <td>
                    <button
                      type="button"
                      className="term-btn"
                      data-testid={`order-cancel-${o.id}`}
                      disabled={pending === o.id}
                      onClick={() => cancel(o.id)}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error !== null && (
        <p className="term-error" role="alert" data-testid="order-cancel-error">
          {error}
        </p>
      )}
    </section>
  );
}
