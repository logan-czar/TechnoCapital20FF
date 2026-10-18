# 9. Gambling, crypto and prediction markets: detailed design

_Status: draft v0.1 (2026-10-17). From Logan's answers in the design Q&A. Crypto itself is shallow; it lives inside a deep **gambling system**, which is part of the **addiction system** (still to be designed). Builds on [3-markets-and-fx.md](3-markets-and-fx.md) (3.23 crypto) and [1-corporate-core.md](1-corporate-core.md) (characters, stress). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 9.7.

---

## 9.1 Decided by Logan

| Topic | Decision |
|---|---|
| Where | The whole gambling system lives in the **phone tab**. |
| Crypto | Not deep. Various coins go up and down randomly, with boom and bust cycles of varying volatility, intensity and length. Coins trade **only inside the phone-tab gambling system**; there is no crypto exchange industry (Logan, batch 51). |
| Prediction markets | Bet on events happening in the game world, including events the player influences or has knowledge of. |
| Crypto casinos | Crypto currencies can be gambled in casinos. |
| Addiction | Gambling is part of the addiction system (to be designed). |

## 9.2 The phone tab

The phone is a tab in the UI. Its gambling apps **(A)**:

| App | What it does |
|---|---|
| **Wallet** | Holds the character's coins; buy and sell at the current price (spread 1% **(T)**) |
| **Markets** | Prediction markets (9.4) |
| **Casino** | Crypto casinos (9.5) |

## 9.3 Coins

- **Coins at start (A)**: Ledgerbit (LBT, the big one) plus about 10 smaller coins. New memecoins appear about once a month **(T)** and most die.
- **Price model (A)**: each coin follows a random walk whose drift and volatility come from its current **cycle**:

| Cycle phase | Length **(T)** | Drift per day **(T)** | Daily volatility **(T)** |
|---|---|---|---|
| **Boom** | 2 to 26 weeks | +0.5% to +4% | 4% to 15% |
| **Bust** | 1 to 20 weeks | -1% to -6% | 6% to 20% |
| **Drift** | 4 to 40 weeks | -0.2% to +0.2% | 2% to 6% |

- At the end of each phase the next is rolled (Boom → Bust 70%, Drift 30%; Bust → Drift 60%, Boom 20%, death 20% for small coins; Drift → Boom 40%, Bust 20%, Drift 40%) **(T)**. Intensity and length are rolled per phase, so no two cycles look the same.
- Ledgerbit never dies and its moves are half the size of small coins' **(T)**.
- Coins have no fundamental value. Events (a hack, a celebrity tweet, a ban) can force a phase change.

## 9.4 Prediction markets

Players and AI characters bet on yes-or-no questions about the game world.

- **Questions (A)**: elections, mergers, launches, bankruptcies, scandals, the crash year, wars, sports results, a named character's death. New questions are generated from scheduled events and active quests.
- **Pricing (A)**: each question has a price from 1¢ to 99¢ for a Yes share that pays $1. The price moves with bets (AI bettors bet toward the true odds plus noise) and with news.
- **Inside knowledge**: the player can bet on events they influence or know about, for example betting against a merger they plan to block. That is the point (Logan).
- **No risk** (Logan): betting on events you control or know about carries no exposure. Offshore markets on the Freeport Night Market are just another venue.

## 9.5 Crypto casinos

- Games **(A)**: slots, crash games, roulette, blackjack, high-stakes poker against named characters.
- Stakes are in coins, so a coin's boom or bust changes what the winnings are worth.
- House edge 2% to 6% by game **(T)**. Poker against characters uses Intrigue and vril, not just chance.
- Casinos can be owned: a casino is a company with the Crypto exchange business line ([3-markets-and-fx.md](3-markets-and-fx.md) 3.17.1) or a Front Company vassal ([1-corporate-core.md](1-corporate-core.md) 1.7.4) **(A)**.

## 9.6 Links to the addiction system

> The addiction system is now designed in [11-addiction.md](11-addiction.md). Gambling is one of its five vices.

The addiction system covers **gambling, drugs, cyberware, doomscrolling and sex** (Logan, 2026-10-17: AI addiction swapped out for sex for now), all on characters.


- Gambling builds an **addiction** score on the character **(A)**: each session adds to it, big losses add more, and a high score triggers urges (events that push the character to gamble) and stress.
- AI characters gamble too; a Glitterati or Noble with a gambling addiction is a target for hooks and blackmail.
- Underclass slop includes freemium gambling apps (2.8.0), so gambling also feeds population stability.

## 9.7 Assumptions and open items

1. The phone tab's three apps.
2. Coin roster and the cycle table.
3. Prediction market question types and pricing.
4. Casino games, house edge and ownership.
5. The addiction score.
