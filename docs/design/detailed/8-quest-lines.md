# 8. Quest lines: detailed design

_Status: draft v0.9 (2026-10-18). Batch 78: John's skills are all 24 and he has one trait, Operational Excellence; Terry's schemes stay out of the media. Batch 77: Terry Tippacanoe is the new owner, with a befriend-or-bring-down branch; options grow with the company and John's performance; the tip arrives on the desktop. Batch 76: **only the player has a quest line**: the rivals' lines are cut (rivals act on their traits), John Techno's line is rewritten for his new premise, and the opening quest is now buying a desktop computer. v0.6: Consistency pass, batch 74: quest steps use business units and assets, no cyberware, no supply chains. Batch 35: full lines for Pablo, Tolu and Qiao. Batch 36: Fang (a woman, batch 37), Pablo picks his ideology, Qiao is a woman, Lagos becomes Africa's hub. Back in work now that the economy, corporations, investing and characters are designed. Batch 33 answers applied: full lines for one character per region next, Pieter reworked for the new economy, generated quests after a line ends, and successors usually start fresh. Builds on [10-events.md](../10-events.md) 10.4 (quest rules), [7-starting-world.md](7-starting-world.md) (characters, alternate history), [1-corporate-core.md](1-corporate-core.md), [3-markets-and-fx.md](3-markets-and-fx.md), [6-technocapital.md](6-technocapital.md), [10-industry-economy.md](10-industry-economy.md) and [11-addiction.md](11-addiction.md). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 8.6.

---

## 8.1 Arcs and quest line rules

A quest line is made of **arcs** (Logan's word; not chapters).

| Rule | Decision (Logan) |
|---|---|
| Structure | The number of arcs, their length and their story structure vary by character. |
| Length | A full line has **4 to 6 arcs**, spanning 2020 to the crash and after (batch 33; start year moved to 2020 in batch 75). |
| Concurrency | Arcs can run at the same time. |
| Outcomes | Each arc ends in one of several outcomes. Each outcome gives a **stat buff** (skills or character resources); better outcomes give better buffs, and bad outcomes can give worse ones or penalties. Outcomes can also change traits (1.1.2). |
| Steps | Inside an arc, the player sees only the next step ([10-events.md](../10-events.md) 10.4). Failure branches into new quests. |
| After the line | When a line ends, **generated side quests** keep coming from events, the character's ambition (1.1.2) and rivals (batch 33). |
| Successors | A successor **usually does not** inherit the quest line (batch 33): they start with their own ambition and generated quests, plus a few legacy quests from the old line. **Sometimes** (25% per unfinished arc **(T)**, higher for children and protégés trained in it) the successor picks up an unfinished arc. |
| The crash | The AI bubble pops in **2030 on average**. The actual year varies by a few years with RNG and events (8.5). Every full line has a crash arc that opens whenever it hits. |

**Outcome tiers (A).** Most arcs use three tiers: **Strong**, **Mixed** and **Poor**. As a guide, Strong gives +2 to one skill and a clout gain, Mixed gives +1 to one skill, Poor gives a lasting penalty or a negative trait **(T)**.

**Who has a quest line (Logan, batch 76).** Only the player's character has one: **John Techno**, whose line is 8.3. The rival starting characters (7-starting-world 7.3.4) have **no quest lines**; they act on their traits and premises like every other AI character. The lines once written for Pieter, Antone, Samir, Yuna, Viktor, Garrett, Pablo, Tolu, Qiao and Fang are cut.

## 8.2 Opening arcs (tutorial)

John plays these first, back to back, in the first weeks of January 2020 **(T)**; his own line (8.3) opens alongside them.

### 8.2.1 The Desktop (the first quest, Logan, batch 76)

The first quest of the game is **buying a desktop computer**, done entirely on John's **phone**. It teaches the quest system (a tree of steps tracked in the quest log), ticking actions and Techno-Capital.

| Step | What happens | Teaches |
|---|---|---|
| 1 | **Download the marketplace app** on the phone | The phone tab |
| 2 | **Order the computer** from the marketplace | Buying; spending from the personal account |
| 3 | **Wait for delivery**: it arrives **a few hours later** (about 3 to 6 ticks **(T)**) | Ticking actions; time and speed controls |
| 4 | Set it up | The Techno-Capital and compute screens |

**Reward (Logan).** John gets **1 base compute** (the desktop) and **1 data compute** (cloud data that comes with the computer, free of charge) ([15-infrastructure.md](15-infrastructure.md) 15.2). These are his first owned Techno-Capital.

**Also on completion (Logan, batch 77).** The **LLM tip** arrives on the new desktop: it names the lab that will make the first LLM breakthrough (7-starting-world 7.6). There is no travel lock.

### 8.2.2 The other opening arcs

| Arc | Teaches | Steps |
|---|---|---|
| **Take Stock** | Character screen, resources, strata | Open your Portfolio; check your stratum and what the next one needs; read the Pdoomberg terminal for your company |
| **First Moves** | Actions, money | Make one trade or buy into a real estate pool; hold one meeting; set a monthly budget for your personal account |
| **Your People** | Relationships, successors | Make a friend (1.1.4); name a successor in your will (1.11.0) |

## 8.3 John Techno: "The One Man You Keep" (the player's line)

**Who he is (Logan, batch 76).** John was a **union man on the oil fields of Canada**. Recent Liberal governments forced his company into **new ownership** and the **union to break up**. The word went round: *"If there's one man you keep, it's John Techno."* His incredible stats have made him a **local legend**, and at just **22** he is the **Chief Operating Officer of the smallest oil company in the game**.

**Starting position (Logan, batch 76).** **$100,000 cash**; a salary of **$1M a year plus stock options**; a **one-year paid-off lease on executive housing in Edmonton**. The best stats of any character in the game (7-starting-world 7.3.0).

**The company (Logan, batch 77).** A **listed micro-cap** with one Oil and gas business unit in Alberta. Its new owner is **Terry Tippacanoe** (7-starting-world 7.3.5), who bought it out as the union broke up.

**Stock options (Logan, batch 77).** John starts with options on **2% of the company**, vesting over **4 years** with a **1-year cliff**. The package **changes as the company grows**: at each yearly review the board resizes his next grant by the **company's financial situation** and **John's performance as COO** **(T)**:
- New grant = 0.5% of the company × company factor × performance factor.
- Company factor: 0.5 if the company lost money that year, 1 if it broke even or grew slowly, 1.5 if revenue grew 20% or more.
- Performance factor: 0.5 to 1.5 from the year's productivity change in his units and the last arc outcome (Strong 1.5, Mixed 1, Poor 0.5).
- As the company climbs a rank (1.7.5) the percentage shrinks but the value grows; a CEO seat (Arc 4) brings a new package.
- A board where Terry is John's Rival can cut the grant to zero.

**Skills and trait (Logan, batch 78).** **24 in all six skills** (Finance, Operations, Persuasion, Intrigue, Tech, Hustle). He starts with **one trait**, unique to him: **Operational Excellence** (1-corporate-core 1.1.2): while he sits on a company's board as **COO**, the buffs of **all other board members are doubled**. Events and arc outcomes can add more traits later.

**Assumed details (A).** His old union brothers start as Friends; Terry starts Neutral. Ambition: Get rich.

**What the line teaches.** Running a company from the COO seat, the industry economy, earnings days, board politics, the AI boom's power demand, and taking control.

### Arc 1: New Owners

| Step | Goal | Teaches |
|---|---|---|
| 1 | Meet Terry Tippacanoe, the new owner, at his casino, and the board he installed; keep your seat | Board seats, Friend and Rival tags (1.8, 1.1.4) |
| 2 | Run the oil fields: set the unit's growth plan and R&D | Business units, productivity, growth plans (10.0) |
| 3 | Your old union brothers want their jobs back: rehire them, or not | Loyalty, costs, the Communist bloc (4.0) |
| 4 | **Friend or foe (Logan, batch 77).** Choose how to deal with Terry: **befriend him**, or **work in the shadows on his downfall** | The branch below |

**The Terry branch.** The choice opens one of two quests that run alongside the rest of the line **(A)**:
- **Befriend Terry.** Win him over (Persuasion, favors, a night at the casino). As a Friend he backs John on the board, cuts him into deals, and lends him his edge against Liberal characters in shared schemes; and he will expect favors (a hook).
- **Bring him down.** Dig into his deals and the casino's books in secret (Intrigue schemes and hacking; the media will never expose him, 7.3.5). Each secret found is a hook, or ammunition with the board and shareholders; the end goal is forcing him out of the company, which opens Arc 4 early. If Terry learns of it, he turns Nemesis.

**Outcomes.** Strong: the board trusts you and the crews follow you; +2 Operations. Mixed: +1 Operations. Poor: Terry marks you as a Rival.

### Arc 2: The Smallest Oil Company

| Step | Goal | Teaches |
|---|---|---|
| 1 | Cheap Gulf oil squeezes the margins (7.2.0): cut costs or find a buyer for your oil | The oil price index (10.6), industry cycles |
| 2 | Survive the first earnings day at 00:00 on 2 April 2020 | Earnings days, guidance rolls (3.1.0) |
| 3 | Your options vest: hold, sell or borrow against them | Personal margin and pledged shares (1.10.6) |

**Outcomes.** Strong: the stock rises and the company is no longer the smallest; +2 Finance. Mixed: +1 Finance. Poor: a bad quarter and a takeover bid from a bigger oil company.

### Arc 3: Power Play

Opens once the AI boom starts.

| Step | Goal | Teaches |
|---|---|---|
| 1 | Data centers need power: push the board to add a business unit in Power utilities | Business units in any industry (10.0.5) |
| 2 | Sign a power deal with a hyperscaler | The AI boom and power demand (6.7.0) |
| 3 | Raise money: a credit line, bonds once rated, or a new share issue | Financing (10.0.9) |

**Outcomes.** Strong: a fast-growing power business; clout gain. Mixed: a small unit. Poor: over-borrowed and at the bank's mercy.

### Arc 4: The Top Job

| Step | Goal | Teaches |
|---|---|---|
| 1 | Build a bloc: your options, friendly holders and the old union pension | Blocs and the charter (1.3, 1.5) |
| 2 | Take the CEO seat: win the board, a proxy fight or a buyout | Takeovers and control (1.3.1) |
| 3 | The Liberal government that broke the union comes for your industry: lobby, back a rival bloc or run for office | Politics (4), ideologies (5) |

**Outcomes.** Strong: John is President and CEO and the real controller. Mixed: CEO in name, with Terry still pulling strings. Poor: pushed out, with his options and his legend.

### Arc 5: Dry Hole (the crash)

| Step | Goal | Teaches |
|---|---|---|
| 1 | Data centers stop paying; power demand collapses | Industry cycles, operating leverage |
| 2 | Restructure the debt or let creditors take the company | Restructuring (10.5.4) |
| 3 | Start again or hold on | Ambition and legacy |

**Outcomes.** Strong: John buys his rivals at the bottom. Mixed: he survives smaller. Poor: he loses the company but keeps his stats, and the climb starts again.

## 8.4 Generated quests after a line

When a character's line ends, or for a successor who does not inherit it, **generated side quests** keep coming (batch 33) **(A)**:
- **From the ambition** (1.1.2): a 2 to 4 step quest toward it, rebuilt when the ambition changes.
- **From events**: an event can open a quest (a merger offer, a scandal to bury, an illness in the family).
- **From rivals**: a rival's scheme or a rival rotation character aimed at the player opens a defense quest.
- **Legacy quests**: a successor gets one or two quests from the old line (finish what your father started) unless they inherit an arc outright (8.1).

## 8.5 The crash

The AI bubble pops in 2030 on average (Logan). The year is set at game start as 2030 plus a roll of -2 to +2 years **(T)**, then moved by events: a bigger boom (high AI valuations, heavy leverage) brings it closer, and calmer markets push it later **(A)**. In this world there was never a dot-com crash or a 2008 crisis (7.2.0), so investors have never lived through a great crash, and it hits harder: market drops are ×1.2 the normal crash size **(T)**. When it hits, John Techno's crash arc (8.3) opens, and any generated quests tied to the boom resolve.

## 8.6 Assumptions and open items

1. Outcome tiers and buff sizes in 8.1; the 25% chance a successor picks up an unfinished arc.
2. The opening arcs in 8.2 and the delivery time of the desktop (8.2.1).
3. John Techno's skills, traits and arcs, the option review numbers, and the Terry branch in 8.3.
4. Generated quest sources in 8.4.
5. Crash timing and the ×1.2 crash size in 8.5.
