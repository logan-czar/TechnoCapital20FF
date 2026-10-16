# 9. Time and turns

## 9.1 Hourly turns

The game is **turn-based**, and **one turn is one in-game hour**.

- On their turn the player spends the dynasty head's **time** (and delegates to family and board members) on actions: meetings, pitches, trades, calls, travel.
- Actions have a duration in hours. A pitch meeting might take 2 hours; flying to another hub takes 12. While an action runs, that character is busy.
- Markets trade hourly during each exchange's local hours; prices, FX rates and news update every turn.
- Night hours have little activity, so **auto-advance** controls let the player skip:
  - to the next event or decision,
  - to the next morning, end of week, or end of month,
  - until a chosen condition (a stock price, a date, a scheme completing).
- Auto-advance stops on anything important: events, margin calls, ultimatums, deaths.

## 9.2 Calculation schedule

Heavy calculations are offloaded to longer intervals:

| Interval | What runs |
|---|---|
| **Hourly** (every turn) | Player and AI actions, market prices and order flow, FX rates, action timers, travel |
| **Daily** | Market close and settlement, news cycle, scheme progress rolls, influence campaign decay, character schedules |
| **Weekly** | Opinion and stress updates, bloc membership checks, faction strength, supply chain shipments and stock levels, labor hiring, temporary influence decay, AI strategic decisions |
| **Monthly** | Production and sales, company income and costs, dividends and tribute, rent, interest, loan payments, trust distributions, taxes, central bank decisions, population needs and unrest, influence recalculation |
| **Quarterly** | Earnings reports, board meetings, funding-round milestones, credit rating reviews |
| **Yearly** | Aging, births and deaths checks, education progress, annual shareholder meetings, budgets, scheduled elections |

## 9.3 Performance notes

- The hourly loop touches only what changes hourly (markets, timers). Everything else is batched.
- The simulation is deterministic given a seed, so turns can be replayed and tested.
- AI holders and companies decide on weekly or monthly cadences, not hourly, to keep turns fast.
