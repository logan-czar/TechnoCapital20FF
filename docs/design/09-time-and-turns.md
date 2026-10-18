# 9. Time and turns

_Updated 2026-10-17 (Logan, batch 29): pausable real time with hourly ticks; endless sandbox; single player._

## 9.1 Pausable real time, hourly ticks (Logan, 2026-10-17)

The game runs in **pausable real time**, like Crusader Kings, and **one tick is one in-game hour**. This replaces the earlier strict turn-based design.

- **Speeds (T)**: Paused, and 5 speeds: 1 (an hour every 2 seconds), 2 (1 second), 3 (0.5 seconds), 4 (0.2 seconds) and 5 (as fast as the simulation runs). The player can act while paused or running.
- **Hours** (Logan, batch 64): there is **no daily budget of hours**. Most actions are instant; **only certain actions burn ticks** (travel, in-person meetings, galas, vacations, opening a scheme; [detailed/1-corporate-core.md](detailed/1-corporate-core.md) 1.1.6). While one runs, that character is busy.
- Markets trade hourly during each exchange's local hours; prices, FX rates and news update every tick.
- **Auto-pause** (Logan): the game pauses on events that need a choice, and on alerts the player turns on. Default alerts **(T)**: takeover bids and stakes crossing a disclosure line in the player's companies, margin calls, deaths and health events in the family, market crashes, wars, and the crash. Every alert type can be switched between pause, notify only, or off.
- **Skip ahead**: jump to the next morning, the next event, end of week or end of month, or until a chosen condition (a stock price, a date, an action finishing).
- **Single player** only for now (Logan).

## 9.2 Calculation schedule

Heavy calculations are offloaded to longer intervals:

| Interval | What runs |
|---|---|
| **Hourly** (every tick) | Player and AI actions, market prices and order flow, FX rates, action timers, travel progress |
| **Daily** | Market close and settlement, news cycle, schemes (one-roll, 1.1.8) and travel arrivals, influence campaign decay, character schedules and hour budgets |
| **Weekly** | The economy: industry demand and price indices ([10-industry-economy.md](detailed/10-industry-economy.md)), real estate rents, labor; opinion, stress and addiction checks; bloc checks, faction strength, temporary influence decay, AI strategic decisions |
| **Monthly** | Company finances (revenue, costs, growth plans), dividends and tribute, rent, interest, loan payments, trust distributions, taxes, central bank decisions, population needs and unrest, influence recalculation |
| **Quarterly** | Earnings reports, board meetings, funding-round milestones, credit rating reviews |
| **Yearly** | Aging health checks (1.1.9), births, education progress, annual shareholder meetings, budgets, scheduled elections |

## 9.3 Performance notes

- The hourly loop touches only what changes hourly (markets, timers). Everything else is batched.
- The simulation is deterministic given a seed, so turns can be replayed and tested.
- AI holders and companies decide on weekly or monthly cadences, not hourly, so high speeds stay smooth.

## 9.4 Length of a game (Logan, 2026-10-17)

The game is an **endless sandbox**: it starts in January 2020 and runs as long as the dynasty has a successor. The optional end date set at game start (1.11.0) is off by default.
