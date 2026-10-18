# 13. Events, the director and event decks: detailed design

_Status: draft v0.4 (2026-10-18). Batch 117: no stress (tension reads the player character's Heat instead). Batch 116: header and links fixed (A22), option costs show ticks, not hours (A3), the family and succession deck removed, decks added for Media, Hacking, Software and AI models. v0.3, consistency pass, batch 74. v0.2 (2026-10-18). From Logan's answers in the design Q&A (batches 39 and 40). Fills in [10-events.md](../10-events.md) (engine, chains and quests). Builds on [09-time-and-turns.md](../09-time-and-turns.md) (auto-pause), [11-ui.md](../11-ui.md) 11.1.1 (news from named, biased outlets) and every detailed system file. Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 13.8.

---

## 13.1 Decided by Logan

| Topic | Decision |
|---|---|
| Frequency | **1 or 2 events a week** for the player's own character, not counting quest steps and alerts. |
| Pacing | A **director** paces events: it adds pressure when things are calm and backs off during crises, like the rival rotation. |
| AI characters | **Every full character gets events.** They are resolved off screen by the AI, and the player hears about them through news pop-ups. |
| Option display | Options show **the skill they roll against, but not the odds**. |
| Decks | **Every system feeds its own event deck**: vices, hooks, strata, ideology, industries, real estate, politics and the timeline, as well as character and company events. |

## 13.2 The event card

A data-driven card with triggers, weights, cooldowns and 2 to 4 options ([10-events.md](../10-events.md)), plus **(A)**:
- **Header**: the deck's icon and color, the scope (character, company, hub, country) and the date.
- **Portraits**: the characters involved.
- **Options**: 2 to 4. Each option shows its **skill icon** (Finance, Operations, Persuasion, Intrigue, Tech or Hustle) when it rolls, its known costs (money, Favor, a hook spent, and how many ticks it takes if it is not instant) and any trait it suits ("Ruthless"). The success chance is **never shown** (Logan), and there are no hint words either (batch 40): only the skill icon.
- **No timer** (batch 40): an event waits until the player answers it, and the game stays paused while it is open.
- **Pause**: every event pauses the game until it is answered (batch 40). AI characters' events never pause the game.

### 13.2.1 The event screen (Logan, batches 81 and 82)

**Every event type** uses a split screen (Logan, batch 82):
- **Left side (about 60%)**: the scenario text, with the **list of decisions at the bottom**.
- **Right side (about 40% of the screen)**: an **information panel** showing what might be relevant to the event. It must **use all the space it is given**, with **dense, readable information that is clearly presented** (Logan).
- What the panel shows depends on the event's scope **(A)**: a company event shows the company UI (financials, business units, board, software); a character event shows the characters involved (relationship tags, known traits, hooks, known secrets); a market event shows Pdoomberg data; a hub or country event shows its politics, ideologies and real estate; a gambling event shows the odds and stakes.
- Some company decisions **set the company's direction for the quarter**; they hold until the next quarter (8-quest-lines 8.2.3).

**Rolls.** `Success = 50% + (skill - 10) × 3% + trait and situation modifiers`, clamped 5% to 95% **(T)**. Vril can swing a roll either way (13-open-questions).

## 13.3 The director

The director decides **when** an event fires and **which deck** it comes from. It never cheats on outcomes: it only picks timing and topic **(A)**. It **can aim the rival rotation at the player** when things are calm (Logan, batch 40).

**Tension.** A score from 0 to 100, recalculated daily **(T)**:

| Adds tension | Points |
|---|---|
| The player character's Heat (how cancelled they are, 1.1.0) | +5 per 20 Heat **(T)** |
| Open investigations, scandals or proxy fights | +10 each |
| A margin call, restructuring or a company in loss | +10 each |
| A war, coup or crash touching John's assets | +20 |
| Each event or quest step in the last 3 days | +5 |

**Pacing rules (T).**
- **Calm** (tension under 30): the weekly event chance rises to 2 events a week. The director prefers **pressure decks** (rivals, politics, vices, hooks) and can aim the rival rotation at the player.
- **Normal** (30 to 60): 1 or 2 a week, from any deck by weight.
- **Crisis** (over 60): at most 1 non-crisis event a week. The director prefers **relief decks** (friends, opportunities, recovery) and holds back new threats.
- **No pile-ups**: at most one non-quest event per in-game day, and none within 6 hours of another pop-up.
- **Variety**: a deck that fired in the last 2 weeks has its weight halved.

## 13.4 Events for AI characters

- Every full character (12-setup: 200) draws events from the same decks and on the same schedule, paced by their own tension **(A)**.
- The AI picks options by its **traits** and ideology (1.1.2; Logan, batch 61: no ambitions or play styles for AI), then rolls the same dice (12.3 fair AI).
- **What the player sees.** Results come in as **news pop-ups** (11-ui 11.4) when the player has intel on the character, the event is public (a scandal, a merger, a death), or the character is a relative or friend of John, a board member or a rival. Private results stay hidden until intel reaches them.
- **News reactions (Logan, batch 68).** AI characters do not read the news. When a story comes out about an AI character or someone close to them (relatives, friends, their companies), the director **may direct that character's response**: sue, run a counter-campaign, seek revenge on the outlet's owner, or crack under the pressure ([16-media.md](16-media.md)).
- **Hooks into the player's game.** An AI event can open an event or quest for the player: a rival's scandal is a chance to buy their stake, and a friend's relapse is a chance to help or to gain a hook.
- **Performance.** Off-screen events for characters far from the player resolve in weekly batches **(A)**.

## 13.5 Event decks

Each deck has its own triggers, weights and cooldowns. Sample events per deck **(A)**:

| Deck | Fires from | Sample events |
|---|---|---|
| **Character** | Traits, ambition, health, Heat, age (1.1) | *Midlife*: buy a supercar or a yacht, or start a foundation · *The Diagnosis*: health falls 20 · *Old Rival at the Gala* |
| **Company** | The board, management score, business units, growth plans (1.7, 1.8, 10) | *The Board Revolt* · *Key Engineer Poached* · *Plant Fire* · *A Buyer Calls* |
| **Industry** | The company's industry and its price index (10) | *Price War* · *Breakthrough at a Rival* · *Regulator Eyes Your Sector* · *GPU Allocation Cut* |
| **Markets** | Holdings, margin, the market cycle (3) | *Margin Call* · *Short Report* · *Activist Builds a Stake* · *Hot IPO Allocation* |
| **Real estate** | District pools, occupancy, the property cycle (10.4.5) | *Tenant Walks* · *Rezoning Vote* · *A District Stake Comes Up Cheap* |
| **Vices** | Addiction scores and levels (11) | *The Urge* · *Withdrawal* · *A Dealer's Offer* · *Relapse at the Casino* |
| **Hooks and secrets** | Hooks held and held over the character (1.1.4) | *Blackmail Note* · *Calling in the Favor* · *Your Secret Is Out* |
| **Strata** | Moving up or down a stratum (2.8.0) | *New Money*: the Nobles snub you · *Slop Riots* in a hub where you own business assets · *Welcome to the Glitterati* |
| **Ideology** | The character's ideology, blocs, movements (5) | *Crisis of Faith* · *The Movement Wants a Donor* · *Your Friend Joins the Red Cells* |
| **Politics** | Elections, laws, regulators, influence (4) | *The Minister's Price* · *Subpoena* · *Election Night* · *Foreign Investment Review* |
| **Earnings** | The four earnings days (3-markets 3.1.0), guidance and the insider blackout | *The Leaked Report* · *Whisper Number* · *Servers Crash at Midnight* · *The Analyst Call* · *A Friend Wants a Tip* |
| **Gambling** | Bets and prediction markets (9) | *Hot Tip* · *Whale Table Invite* · *The Market Resolves* |
| **Techno-Capital** | Compute, data centers and Semiconductors supply, as dollar effects on business units (6, 15) | *Lease Expires* · *Compromised Cluster Found* · *GPU Shipment Delayed* |
| **Media** | Owned outlets, campaigns, investigations and content projects (16) | *The Exposé*: an outlet digs into your hidden control · *Kill the Story* · *Influencer Campaign Flops* |
| **Hacking** | Hacking schemes, backdoors, the black market and defense (17) | *Ransom Note* · *A Hacker for Hire* · *Your Backdoor Is Found* |
| **Software** | The software table, licences, versions, bloat and making software (14) | *The Update Breaks Everything* · *A Licence Offer* · *Bloat Crisis* |
| **AI models** | Training, renting and open-weight releases (18) | *The Lab Breakthrough* · *Training Run Fails* · *A Rival Goes Open-Weight* |
| **World and timeline** | Scripted and rolled world events (7.7, 10.7) | *Strait Closed* · *Export Controls Tighten* · *The Crash* |
| **Travel** | Trips and private jets (2.21) | *Flagged at Customs* · *Delayed in Dubai* · *A Stranger on the Jet* |

The old Family and succession deck is removed (batch 116): there are no family mechanics.

## 13.6 Chains and memory

- Every event can set **flags** on characters, companies and places that later events read: "owes a favor", "seen with the rival", "known addict" **(A)**.
- Chains ([10-events.md](../10-events.md)) keep their own variables. A chain step can wait days or months before its next event.
- Long memory: a character remembers a betrayal (a lasting push toward Rival, 1.1.4) and the director can bring it back years later.

## 13.7 Writing and tooling

- Events are JSON data cards, grouped by deck. A designer can add a deck without code.
- Each deck ships with **about 10 events** at launch (batch 40), about 190 in total, and grows later.
- Text variables cover names, pronouns, companies, places, industries and ideologies.

## 13.8 Assumptions and open items

1. The card details in 13.2.
2. The roll formula in 13.2.
3. The tension score and pacing rules in 13.3.
4. Off-screen resolution and what the player sees in 13.4.
5. The deck list and sample events in 13.5.
6. Flags and memory in 13.6.
