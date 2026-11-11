// F4 Order (pivot 13.1, 1.3, 14.1): the brokerage's order ticket, replacing the old terminal's
// locked page. The player picks a ticker, buys or sells a whole number of shares at market or at a
// limit, day or good till cancelled, sees an estimate and the 5% holding cap, and sends
// `PlaceOrder` (the instrument is `stockInstrument(company)`, types/action.ts). The sim decides:
// a refusal comes back as an `ActError` and its reason is shown as it is. Open orders list below
// with Cancel.
//
// Stocks fill at once at the hourly price plus the spread (pivot 13.1), so a stock order rests
// only if the sim says so; the list shows it either way. Neither rate is in v_account or v_quotes,
// so the estimate shows the quote and the commission last charged (order.ts).

import {
  actErrorMessage,
  type CompanyId,
  type CompanyRow,
  type OrderId,
  type OrderSide,
  type Reply,
  stockInstrument,
  type TimeInForce,
} from "@tc20ff/sim";
import { type FormEvent, useEffect, useState } from "react";
import { byId } from "../../pages/views.ts";
import { useSim, useViewData, useViewDataThrottled } from "../../sim/hooks.ts";
import { priceAt, usd } from "./fmt.ts";
import {
  capOf,
  estimate,
  freeBrokerageCash,
  inputProblem,
  lastCommission,
  limitOf,
  type OrderType,
  PLAYER_MAX_STAKE,
  sharesOf,
  type TicketInput,
  warnings,
} from "./order.ts";
import { OpenOrders, useLabeler } from "./orders.tsx";
import { companySegment } from "./route.ts";

/** How often the ticket re-reads the quote, in ms. */
const QUOTE_MS = 500;

/** The sentence for a reply that is not `Ok`. */
export function replyMessage(r: Reply): string {
  switch (r.kind) {
    case "ActError":
      return actErrorMessage(r.error);
    case "SimError":
    case "Refused":
      return "The order was not accepted.";
    default:
      return "The order was not accepted.";
  }
}

type Sent = { kind: "refused"; message: string } | { kind: "sent"; order: OrderId | null };

function Toggle<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="term-toggle" aria-label={name}>
      {options.map(([v, text]) => (
        <button
          type="button"
          key={v}
          aria-pressed={v === value}
          className={v === value ? "on" : ""}
          data-testid={`order-${name.toLowerCase()}-${v}`}
          onClick={() => onChange(v)}
        >
          {text}
        </button>
      ))}
    </fieldset>
  );
}

export function OrderTicket({
  company,
  onCompany,
}: {
  company: CompanyId | null;
  /** The company chosen in the ticker field (a route segment), or null once the field is cleared. */
  onCompany: (segment: string | null) => void;
}) {
  const sim = useSim();
  const rows = useViewData("company_rows")?.rows;
  const quotes = useViewDataThrottled("quotes", QUOTE_MS)?.rows;
  const account = useViewData("account");
  const row: CompanyRow | undefined = rows?.find((r) => r.id === company);
  const quote = company === null ? undefined : byId(quotes, company);

  const [tickerText, setTickerText] = useState(row?.ticker ?? "");
  const [side, setSide] = useState<OrderSide>("Buy");
  const [qtyText, setQtyText] = useState("");
  const [type, setType] = useState<OrderType>("Market");
  const [limitText, setLimitText] = useState("");
  const [tif, setTif] = useState<TimeInForce>("Day");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);

  // A company loaded from elsewhere (the route) fills the field; typing in it does the reverse.
  const rowTicker = row?.ticker;
  useEffect(() => {
    if (rowTicker !== undefined) setTickerText(rowTicker);
  }, [rowTicker]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new company clears the last result
  useEffect(() => {
    setSent(null);
  }, [company]);

  const input: TicketInput = {
    side,
    qty: qtyText.trim() === "" ? Number.NaN : Number(qtyText),
    type,
    limit: limitText.trim() === "" ? Number.NaN : Number(limitText),
    tif,
  };
  const problem = inputProblem(input);

  const positions = account?.positions ?? [];
  const held =
    positions.find((p) => p.venue === "Brokerage" && p.what.kind === "Company" && p.what.id === company)
      ?.qty ?? 0;
  const shares = quote === undefined ? null : sharesOf(quote.market_cap, quote.last);
  const cap = capOf(shares, held);
  const commission = lastCommission(account?.fills ?? []);
  const est =
    quote === undefined || problem !== null ? null : estimate(side, input.qty, quote.last, commission);
  const free = account === undefined ? 0 : freeBrokerageCash(account);
  const warn = warnings(side, input.qty, est, cap, free);
  const label = useLabeler();

  const onTicker = (text: string) => {
    setTickerText(text);
    const t = text.trim().toUpperCase();
    const hit = t === "" ? undefined : rows?.find((r) => r.public && r.ticker.toUpperCase() === t);
    if (hit !== undefined) onCompany(companySegment(hit));
    else if (t === "" && company !== null) onCompany(null);
  };

  const canSend =
    company !== null && quote !== undefined && problem === null && !busy && account?.open === true;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSend || company === null) return;
    const instrument = stockInstrument(company);
    const before = Math.max(-1, ...(account?.orders ?? []).map((o) => o.id));
    setBusy(true);
    setSent(null);
    try {
      const r = await sim.act({
        kind: "PlaceOrder",
        venue: "Brokerage",
        instrument,
        side,
        qty: input.qty,
        limit: limitOf(input),
        tif,
      });
      if (r.kind !== "Ok") {
        setSent({ kind: "refused", message: replyMessage(r) });
        return;
      }
      // The frame with the order arrives before the reply (client.ts), so it is in the store now.
      const orders = sim.store.getView("account")?.data.orders ?? [];
      const mine = orders.filter((o) => o.instrument === instrument && o.id > before);
      setSent({ kind: "sent", order: mine.at(-1)?.id ?? null });
    } catch {
      setSent({ kind: "refused", message: "The order was not accepted." });
    } finally {
      setBusy(false);
    }
  };

  const placed =
    sent?.kind === "sent" && sent.order !== null
      ? account?.orders.find((o) => o.id === sent.order)
      : undefined;

  return (
    <div className="term-page term-order" data-testid="term-order">
      <form className="term-ticket" onSubmit={submit} aria-label="Order ticket">
        <h3>Brokerage order</h3>
        <label className="term-field">
          <span>Ticker</span>
          <input
            data-testid="order-ticker"
            value={tickerText}
            onChange={(e) => onTicker(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            maxLength={12}
          />
        </label>
        <div className="term-field">
          <span>Side</span>
          <Toggle
            name="Side"
            value={side}
            options={[
              ["Buy", "Buy"],
              ["Sell", "Sell"],
            ]}
            onChange={setSide}
          />
        </div>
        <label className="term-field">
          <span>Quantity</span>
          <input
            data-testid="order-qty"
            inputMode="numeric"
            value={qtyText}
            onChange={(e) => setQtyText(e.target.value)}
            autoComplete="off"
          />
        </label>
        <div className="term-field">
          <span>Type</span>
          <Toggle
            name="Type"
            value={type}
            options={[
              ["Market", "Market"],
              ["Limit", "Limit"],
            ]}
            onChange={setType}
          />
        </div>
        {type === "Limit" && (
          <label className="term-field">
            <span>Limit price</span>
            <input
              data-testid="order-limit"
              inputMode="decimal"
              value={limitText}
              onChange={(e) => setLimitText(e.target.value)}
              autoComplete="off"
            />
          </label>
        )}
        <div className="term-field">
          <span>Good for</span>
          <Toggle
            name="Tif"
            value={tif}
            options={[
              ["Day", "Day"],
              ["Gtc", "GTC"],
            ]}
            onChange={setTif}
          />
        </div>
        <button type="submit" className="term-btn term-submit" data-testid="order-submit" disabled={!canSend}>
          {busy ? "Sending..." : `${side} ${row?.ticker ?? ""}`.trim()}
        </button>
        {problem !== null && qtyText !== "" && <p className="term-warn">{problem}</p>}
        {sent?.kind === "refused" && (
          <p className="term-error" role="alert" data-testid="order-refused">
            Refused: {sent.message}
          </p>
        )}
        {sent?.kind === "sent" && (
          <output className="term-ok" data-testid="order-result">
            {placed === undefined
              ? "Order sent."
              : placed.status === "Filled"
                ? `Filled ${placed.filled} at ${priceAt(placed.venue, placed.avg_price)}.`
                : placed.status === "Open"
                  ? `Resting: order ${placed.id}, ${placed.filled} of ${placed.qty} filled.`
                  : `Order ${placed.id} ${placed.status.toLowerCase()}${placed.reason === null ? "" : `: ${placed.reason}`}.`}
          </output>
        )}
      </form>

      <div className="term-quote" data-testid="order-estimate">
        <h3>{row === undefined ? "No company loaded" : label({ kind: "Company", id: row.id })}</h3>
        {company === null ? (
          <p className="term-empty">Type a ticker to load a company.</p>
        ) : quote === undefined ? (
          <p className="term-empty">Not quoted: it cannot be traded.</p>
        ) : (
          <dl>
            <dt>Last</dt>
            <dd data-testid="order-last">{usd(quote.last)}</dd>
            <dt>Estimate</dt>
            <dd data-testid="order-estimate-total">
              {est === null ? "Enter a quantity." : `${usd(est.gross)} for ${input.qty} shares`}
            </dd>
            <dt>Commission</dt>
            <dd>
              {est === null
                ? "-"
                : est.commission === null
                  ? "charged at the fill"
                  : `${usd(est.commission)} (as last charged)`}
            </dd>
            <dt>Spread</dt>
            <dd>added at the fill (not published)</dd>
            {est !== null && (
              <>
                <dt>{side === "Buy" ? "Cash out" : "Cash in"}</dt>
                <dd data-testid="order-cash">{usd(est.total)}</dd>
              </>
            )}
            <dt>Free cash</dt>
            <dd>{usd(free)}</dd>
            <dt>Holding cap</dt>
            <dd data-testid="order-cap">
              {cap === null
                ? `${PLAYER_MAX_STAKE * 100}% of the company`
                : `${PLAYER_MAX_STAKE * 100}% of the company: ${cap.cap} shares; you hold ${cap.held}, room for ${cap.room}`}
            </dd>
          </dl>
        )}
        {warn.map((w) => (
          <p key={w} className="term-warn" data-testid="order-warning">
            {w}
          </p>
        ))}
      </div>

      <div className="term-orders">
        <OpenOrders orders={account?.orders ?? []} label={label} />
      </div>
    </div>
  );
}
