# 12. Game setup, AI fairness, dynasty score and saves: detailed design

_Status: draft v0.2 (2026-10-18), consistency pass, batch 74. v0.1 (2026-10-17). From Logan's answers in the design Q&A (batch 30). Builds on [7-starting-world.md](7-starting-world.md) (starting characters), [09-time-and-turns.md](../09-time-and-turns.md) (endless sandbox) and [1-corporate-core.md](1-corporate-core.md). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 12.6.

---

## 12.1 Decided by Logan

| Topic | Decision |
|---|---|
| Difficulty | **One fixed difficulty.** No presets. |
| AI | **Fair**: AI characters see what a character in their position would see. No hidden bonuses, no cheating. |
| Score | A **dynasty score** with milestones and a history log; there are no victory conditions (endless sandbox). |
| Setup | The player **picks a character** at the start. Difficulty is fixed, so that is the only setup choice. |
| Saves | **Free saving**: save and load at any time. No ironman mode. |

## 12.2 Setup

1. **Pick a character** from the 15 starting characters in 3 regional groups (7-starting-world). The screen shows each character's portrait, stratum, skills, known traits, wealth, starting companies and a one-line pitch.
2. Start in January 2022, paused.

Everything else is fixed or rolled out of sight for each save **(A)**:
- The crash year (2030 ± 2, 8-quest-lines 8.15) and the AI boom rate (3% to 10% a month, 6-technocapital 6.7.0) are rolled at game start and never shown.
- The tipped lab is rolled (7-starting-world).
- The number of full characters is 200.
- Unpicked starting characters become active rivals or passive characters as set in 7-starting-world.

## 12.3 Fair AI

AI characters and companies follow the same rules and see the same information as the player would in their seat **(A)**:
- They see only what their intel level allows (2.22): hidden traits, ambitions, secret holders and schemes stay hidden from them until they meet, investigate or are told.
- They pay the same prices, fees, time costs and taxes, and roll the same dice.
- They do not know the rolled crash year or boom rate; they react to the same signals the player sees (prices, news, Buzz).
- Their quality comes from their skills, traits and archetype (2.23, 1.1.2), not from difficulty.
- The **rival rotation** (7-starting-world) still aims rivals at the player when the director AI decides the story needs pressure, but those rivals play by the same rules.

## 12.4 Dynasty score

A running score that measures how the dynasty is doing. It never ends the game **(A)**.

| Part | Points **(T)** |
|---|---|
| Net worth | 1 point per $10M of family trust plus personal accounts of living members |
| Clout | The sum of living members' clout (1.1.0) |
| Control | 50 points per company controlled, ×2 for a Megacorp, ×4 for a Conglomerate (1.7.5) |
| Influence | 20 points per place where the dynasty holds the top influence tier (2.5.9) |
| Techno-Capital | 1 point per 10,000 H of compute owned or leased long term, 25 per advanced fab (6) |
| Strata | 100 points per living member who is Nobles or Oligarchs (2.8.0) |

- **Milestones**: crossing set lines (first $1B, first Megacorp, first Oligarch, surviving the crash, three generations) adds a permanent entry to the history log and a one-off score bonus **(T)**.
- **History log**: a dated chronicle of the dynasty's heads, big deals, scandals, marriages, deaths and milestones, readable at any time and shown when a head dies.
- **Rivals' scores** are shown on a leaderboard of the top 10 dynasties, with the player's rank. Scores of dynasties the player has no intel on are estimates.

## 12.5 Saves

- Save and load at any time; autosave every in-game month (3 rotating slots) **(T)**.
- Saves are deterministic snapshots (the simulation is seeded, [09-time-and-turns.md](../09-time-and-turns.md) 9.3), so loading a save and playing the same moves gives the same results.

## 12.6 Assumptions and open items

1. The hidden rolls and fixed values in 12.2.
2. The fair-AI rules in 12.3.
3. The dynasty score parts and milestones in 12.4.
4. Autosave frequency in 12.5.
