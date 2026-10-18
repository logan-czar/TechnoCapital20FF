# 12. Game setup, AI fairness, the player's score and saves: detailed design

_Status: draft v0.3 (2026-10-18). Batch 116: no character pick (John Techno is the only playable character; the rivals have AI goals); the dynasty score becomes the player's score; intel is secrets learned, not a level (A2); no fab points (A11). v0.2, consistency pass, batch 74. v0.1 (2026-10-17). From Logan's answers in the design Q&A (batch 30). Builds on [7-starting-world.md](7-starting-world.md) (starting characters), [09-time-and-turns.md](../09-time-and-turns.md) (endless sandbox) and [1-corporate-core.md](1-corporate-core.md). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 12.6.

---

## 12.1 Decided by Logan

| Topic | Decision |
|---|---|
| Difficulty | **One fixed difficulty.** No presets. |
| AI | **Fair**: AI characters see what a character in their position would see. No hidden bonuses, no cheating. |
| Score | A **player's score** with milestones and a history log; there are no victory conditions (endless sandbox). It was the dynasty score until batch 116; it now measures the player character, John Techno. |
| Setup | **No setup choices** (Logan, batches 75 and 116): one scenario, January 2020, and **John Techno is the only playable character**. Difficulty is fixed. |
| Saves | **Free saving**: save and load at any time. No ironman mode. |
| Game over | When John Techno dies (health 0), the game is over (batch 116). There is no successor. |

## 12.2 Setup

1. **New game** starts at 00:00 on 1 January 2020, paused, as John Techno ([7-starting-world.md](7-starting-world.md) 7.3.0). There is no character pick (A20).
2. An optional end date can be set; it is off by default.

Everything else is fixed or rolled out of sight for each save **(A)**:
- The crash year (2035 ± 2, [8-quest-lines.md](8-quest-lines.md) 8.5) and the AI boom rate (3% to 10% a month, [6-technocapital.md](6-technocapital.md) 6.7.0) are rolled at game start and never shown.
- The tipped lab is rolled (7-starting-world).
- The number of full characters is 200.
- The 15 premade rival characters start as active AI rivals with the AI goals in [7-starting-world.md](7-starting-world.md) 7.3.4.

## 12.3 Fair AI

AI characters and companies follow the same rules and see the same information as the player would in their seat **(A)**:
- They know only the secrets they have learned (2.22; batch 63): hidden traits, ambitions, secret holders and schemes stay hidden from them until they meet, investigate or are told.
- They pay the same prices, fees, time costs and taxes, and roll the same dice.
- They do not know the rolled crash year or boom rate; they react to published prices and data (the Pdoomberg terminal, [11-ui.md](../11-ui.md) 11.1.1), not to the news, which AI characters do not read.
- Their quality comes from their skills, traits and archetype (2.23, 1.1.2), not from difficulty.
- The **rival rotation** (7-starting-world) still aims rivals at the player when the director AI decides the story needs pressure, but those rivals play by the same rules.

## 12.4 The player's score

A running score that measures how the player character, John Techno, is doing (batch 116: it replaces the dynasty score). It never ends the game **(A)**.

| Part | Points **(T)** |
|---|---|
| Net worth | 1 point per $10M of John's personal trusts and accounts |
| Clout | John's Clout (1.1.0) |
| Control | 50 points per company controlled, ×2 for a Megacorp, ×4 for a Conglomerate (1.7.5) |
| Influence | 20 points per place where John holds the top influence tier (2.5.9) |
| Techno-Capital | 1 point per 1,000 GPU compute units owned or leased long term ([15-infrastructure.md](15-infrastructure.md)) **(T)** |
| Strata | 100 points if John is Nobles or Oligarchs (2.8.0) |

- **Milestones**: crossing set lines (first $1B, first Megacorp, becoming an Oligarch, surviving the crash, taking the CEO seat at Arrowhead Drilling) adds a permanent entry to the history log and a one-off score bonus **(T)**.
- **History log**: a dated chronicle of John's big deals, scandals, rivals' deaths and milestones, readable at any time and shown at game over.
- **Rivals' scores** are shown on a leaderboard of the top 10 characters, with the player's rank. Scores of rival characters the player has no intel on are estimates from published data.

## 12.5 Saves

- Save and load at any time; autosave every in-game month (3 rotating slots) **(T)**.
- Saves are deterministic snapshots (the simulation is seeded, [09-time-and-turns.md](../09-time-and-turns.md) 9.3), so loading a save and playing the same moves gives the same results.

## 12.6 Assumptions and open items

1. The hidden rolls and fixed values in 12.2.
2. The fair-AI rules in 12.3.
3. The player's score parts and milestones in 12.4.
4. Autosave frequency in 12.5.
