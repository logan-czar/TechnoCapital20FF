# 12. Game setup, AI fairness, milestones and saves: detailed design

_Status: draft v0.5 (2026-10-20). Batch 163 (Logan): the player's score is scrapped ("final score not needed anymore"); milestones and the history log stay, without points, and the leaderboard is replaced by the rich list (12.1, 12.4). Batch 151 (Logan): AI boom moves to 2030, bubble to 2040 on average; AI starts tiny with low growth, then unprecedented growth. The rolled crash year is 2040 ± 2 (12.2). Batch 117: the optional end date is removed; the game is an endless sandbox. Batch 116: no character pick (John Techno is the only playable character; the rivals have AI goals); the dynasty score becomes the player's score; intel is secrets learned, not a level (A2); no fab points (A11). v0.2, consistency pass, batch 74. v0.1 (2026-10-17). From Logan's answers in the design Q&A (batch 30). Builds on [7-starting-world.md](7-starting-world.md) (starting characters), [09-time-and-turns.md](../09-time-and-turns.md) (endless sandbox) and [1-corporate-core.md](1-corporate-core.md). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 12.6.

---

## 12.1 Decided by Logan

| Topic | Decision |
|---|---|
| Difficulty | **One fixed difficulty.** No presets. |
| AI | **Fair**: AI characters see what a character in their position would see. No hidden bonuses, no cheating. |
| Score | **No score** (Logan, batch 163: scrapped). John's run is recorded in **milestones** and a **history log**; there are no victory conditions (endless sandbox). |
| Setup | **No setup choices** (Logan, batches 75 and 116): one scenario, January 2020, and **John Techno is the only playable character**. Difficulty is fixed. |
| Saves | **Free saving**: save and load at any time. No ironman mode. |
| Game over | When John Techno dies (health 0), the game is over (batch 116). There is no successor. |

## 12.2 Setup

1. **New game** starts at 00:00 on 1 January 2020, paused, as John Techno ([7-starting-world.md](7-starting-world.md) 7.3.0). There is no character pick (A20).
2. There is no end date (Logan, batch 117): the game is an endless sandbox that ends only when John Techno dies.

Everything else is fixed or rolled out of sight for each save **(A)**:
- The crash year (2040 ± 2, batch 151, [8-quest-lines.md](8-quest-lines.md) 8.5) and the AI boom rate (3% to 10% a month, [6-technocapital.md](6-technocapital.md) 6.7.0) are rolled at game start and never shown.
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

## 12.4 Milestones and the history log

There is **no player's score** (Logan, batch 163: "final score not needed anymore scrap it"). It had replaced the dynasty score in batch 116.

- **Milestones**: crossing set lines (first $1B, first Megacorp, becoming an Oligarch, surviving the crash, taking the CEO seat at Arrowhead Drilling) adds a permanent entry to the history log **(T)**.
- **History log**: a dated chronicle of John's big deals, scandals, rivals' deaths and milestones, readable at any time and shown at game over.
- **How John compares** with his rivals is shown by the public rich list (1-corporate-core 1.10.6), not by a leaderboard.

## 12.5 Saves

- Save and load at any time; autosave every in-game month (3 rotating slots) **(T)**.
- Saves are deterministic snapshots (the simulation is seeded, [09-time-and-turns.md](../09-time-and-turns.md) 9.3), so loading a save and playing the same moves gives the same results.

## 12.6 Assumptions and open items

1. The hidden rolls and fixed values in 12.2.
2. The fair-AI rules in 12.3.
3. The milestones in 12.4.
4. Autosave frequency in 12.5.
