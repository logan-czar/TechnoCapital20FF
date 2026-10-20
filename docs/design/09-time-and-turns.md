# 9. Time and turns

_Batch 143 (Logan): the quarterly cycle, [detailed/21-quarterly-cycle.md](detailed/21-quarterly-cycle.md): a one-tick trading window at release, a reaction week, the board meeting chain, a locked quarter and a pre-quarter-end week with a trading lockout (9.2). Batch 134 (Logan): one alert scale (Pause, Notify, Log, Off; a few types locked on Pause), set out in detailed/20-ui.md 20.4. Batch 125 (Logan): every value is in USD in the simulation; local currencies are flavor only; FX is post-POC; one world base rate from the Federal Monetary Board. FX rates do not tick in the POC, and the monthly rate decision is the Federal Monetary Board's. Batch 117: no stress checks; the optional end date is removed. Batch 116: rewritten to the current design: 24/7 markets closed only on 1 January, no hours budget, game over when the player character dies. Updated 2026-10-17 (Logan, batch 29): pausable real time with hourly ticks; endless sandbox; single player._

## 9.1 Pausable real time, hourly ticks (Logan, 2026-10-17)

The game runs in **pausable real time**, like Crusader Kings, and **one tick is one in-game hour**. There are no turns.

- **Speeds (T)**: Paused, and 5 speeds: 1 (an hour every 2 seconds), 2 (1 second), 3 (0.5 seconds), 4 (0.2 seconds) and 5 (as fast as the simulation runs). The player can act while paused or running.
- **Actions** (Logan, batch 64): there is **no daily budget of hours**. Most actions are instant; **only certain actions take ticks** (travel, in-person meetings, galas, vacations, opening a scheme; [detailed/1-corporate-core.md](detailed/1-corporate-core.md) 1.1.6). While one runs, that character is busy.
- **Markets** trade **24/7** and are **closed only on 1 January** (Logan). Prices and news update every tick (FX rates are post-POC, batch 125). All quarterly earnings release at **00:00 on 2 January, 2 April, 2 July and 2 October**, which makes those days a frenzy ([07-markets.md](07-markets.md)).
- **Auto-pause** (Logan): the game pauses on events that need a choice, and on alerts the player turns on. Default alerts **(T)**: takeover bids and stakes crossing a disclosure line in the player's companies, margin calls, John's own health events, deaths of characters close to John, market crashes, wars, and the crash. Every alert type has one of four levels: **Pause**, **Notify**, **Log** or **Off**; a few urgent types are locked on Pause (Logan, batch 134). The full alert table and defaults are in [detailed/20-ui.md](detailed/20-ui.md) 20.4.
- **Skip ahead**: jump to the next morning, the next event, end of week or end of month, or until a chosen condition (a stock price, a date, an action finishing).
- **Single player** only for now (Logan).

## 9.2 Calculation schedule

Heavy calculations are offloaded to longer intervals:

| Interval | What runs |
|---|---|
| **Hourly** (every tick) | Player and AI actions, market prices and order flow, action timers, travel progress, news stories |
| **Daily** | Trade settlement, the news cycle and Heat decay (4-politics 4.17.4), schemes (one-roll, 1.1.8) and travel arrivals, influence campaign decay, character schedules |
| **Weekly** | The economy: industry demand and price indices ([detailed/10-industry-economy.md](detailed/10-industry-economy.md)), real estate rents, labor; relationship tag and addiction checks; bloc checks, temporary influence decay, AI strategic decisions |
| **Monthly** | Company finances (revenue, costs, growth plans), dividends and tribute, rent, interest, loan payments, trust payouts, taxes, central bank decisions (only the Federal Monetary Board at start), population needs and unrest, influence recalculation |
| **Quarterly** | The quarterly cycle ([detailed/21-quarterly-cycle.md](detailed/21-quarterly-cycle.md)): earnings reports at 00:00 on the 2nd with prices moving at 01:00; the reaction week; the board meeting event chain at the end of that week (grades, firing votes, plan lock); the pre-quarter-end week 7 days before the next release (auto-pause, the recap screen, the player's trading lockout, one event per board member per day); credit rating reviews |
| **Yearly** | Aging health checks (1.1.9), annual shareholder meetings, budgets, scheduled elections |

## 9.3 Performance notes

- The hourly loop touches only what changes hourly (markets, timers). Everything else is batched.
- The simulation is deterministic given a seed, so ticks can be replayed and tested.
- AI holders and companies decide on weekly or monthly cadences, not hourly, so high speeds stay smooth.
- Heavy simulation (for example Techno-Capital) runs in the background as dollar effects on business units; the player touches it only through events and character levers (batch 116).

## 9.4 Length of a game (Logan, 2026-10-17)

The game is an **endless sandbox**: it starts at 00:00 on 1 January 2020 and runs until **John Techno dies** (health 0), which is **game over** (batch 116). There is no successor and no end date (Logan, batch 117: the optional end date is removed).
