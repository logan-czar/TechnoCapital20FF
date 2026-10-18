# 8. Quest lines: detailed design

_Status: draft v1.8 (2026-10-18). Batch 88: Arrowhead owns the oil software; the charity's 100 desktops make 100 software units a day. Batch 87: Kids Who Code (Terry's charity builds the oil software in India), the casino-money hook, licences. Batch 86: Arc 2 is now Oil Software (Q2 to Q4 2020); options vest in January 2021; the early AI move belongs to Arc 3. Batch 85: the interrogation roll and Mandy's four endings, including the Canadian Furry Cartel. Batch 84: the Mink Scare's four stages and Mandy's interrogation, CPU delegation without rolls, the quarterly recap screen. Batch 83: the six First Week events, Vril Touch, the Mink Scare; the old tutorial arcs are dropped. Batch 81: the opening sequence (start on 1 January, the first earnings day, First Week on the Job, Intro Night, The Scandal). Batch 80: John's company is Arrowhead Drilling (once People Oil Trust), worth $100M; John's options come out of Terry's shares. Batch 79: Operational Excellence also works as CEO or Chair; John starts with no ambition; his family. Batch 78: John's skills are all 24 and he has one trait, Operational Excellence; Terry's schemes stay out of the media. Batch 77: Terry Tippacanoe is the new owner, with a befriend-or-bring-down branch; options grow with the company and John's performance; the tip arrives on the desktop. Batch 76: **only the player has a quest line**: the rivals' lines are cut (rivals act on their traits), John Techno's line is rewritten for his new premise, and the opening quest is now buying a desktop computer. v0.6: Consistency pass, batch 74: quest steps use business units and assets, no cyberware, no supply chains. Batch 35: full lines for Pablo, Tolu and Qiao. Batch 36: Fang (a woman, batch 37), Pablo picks his ideology, Qiao is a woman, Lagos becomes Africa's hub. Back in work now that the economy, corporations, investing and characters are designed. Batch 33 answers applied: full lines for one character per region next, Pieter reworked for the new economy, generated quests after a line ends, and successors usually start fresh. Builds on [10-events.md](../10-events.md) 10.4 (quest rules), [7-starting-world.md](7-starting-world.md) (characters, alternate history), [1-corporate-core.md](1-corporate-core.md), [3-markets-and-fx.md](3-markets-and-fx.md), [6-technocapital.md](6-technocapital.md), [10-industry-economy.md](10-industry-economy.md) and [11-addiction.md](11-addiction.md). Owner: Logan._

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

John plays these first, in order, through January 2020; his own line (8.3) opens alongside them.

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

### 8.2.2 The first earnings day (2 January 2020, Logan, batch 81)

The game starts at **00:00 on 1 January 2020**, the one day the markets are closed, so John has a day to set up before the first earnings day at **00:00 on 2 January** (3.1.0). **Arrowhead Drilling reports a small profit** and announces **John's appointment to the board** as COO. Its stock moves on the news like every other report that night.

### 8.2.3 First Week on the Job (from 7 January, Logan)

An event chain that starts on **7 January 2020**. It introduces the **software system** (14), the company's business unit, finances and board, and the corporate system as a whole.

- **The event screen (Logan).** Each event in the chain uses the **company event screen** (13-events 13.2.1): the **left side** tells the scenario, the **right side** shows the company UI with the relevant information, and a **list of decisions** sits at the **bottom of the left side**.
- **Decisions set the quarter.** The choices made through the week **set the direction for the company for the rest of the quarter**. They hold until the next quarter's review.

**The events, in order (Logan, batch 83):**

| # | Event | What John does | Teaches |
|---|---|---|---|
| 1 | **The growth plan** | Set the business unit's growth plan spending, or **delegate it to the CPU**: the AI sets it with **no roll**, adjusting to the market and the company's financials (Logan, batch 84) | Growth plans (10.0.4), delegation (1.1.6) |
| 2 | **R&D** | Set the R&D plan, or delegate it to the CPU (no roll; adjusts to the market and financials) | R&D and productivity (10.0.4) |
| 3 | **Cloud and Techno-Capital** | An introduction to the company's compute, cloud bill and Techno-Capital | Infrastructure and the cloud (15), Techno-Capital (6) |
| 4 | **Software** | An introduction to the software the company runs | The software table (14) |
| 5 | **Upgrade the software** | John is told to upgrade: **pay to upgrade** to a more efficient version, then **pay for more cloud space** so the new version can process **structured data** | Versions and efficiency (14.2), data compute and the cloud (15.4, 15.5) |
| 6 | **Use the data** | **Consume the structured data** for a bonus: either **more business assets** or a **one-time $1M revenue boost this quarter** | Data as a resource (15.4); business assets (10.0.7) |

### 8.2.4 Intro Night (after the first week, Logan)

After the first week, an **intro night** where John **meets the rest of the board**. The night turns into a **gambling minigame** (9) that **introduces vril** (1.1).
- For the **next 100 gambling events**, John has **99 vril**: the highest bonus to the odds possible in the game, so he has an **edge on all gambling** (9.5).
- After the 100th gambling event his vril **drops to 20** and he gains the perk trait **Vril Touch**: he can **see his vril value**, shown next to his resources (Logan, batch 83; 1-corporate-core 1.1).

### 8.2.5 The Mink Scare (the last opening event, Logan, batch 83)

**What happened.** A **salacious furry drug trafficking ring** inside Arrowhead Drilling. Warehouse workers and middle managers who were **secretly furries** have been using the company's **warehouse space and pipelines to traffic drugs across borders**. The ringleader is a middle manager, **Mandy Waltham**, whose fursona is **"Minky Mandy"**.

**The saga.** Details **begin to emerge at the start of February 2020**. The **media circus makes it look far more serious than it is**, and it spawns a wider scandal, **"The Mink Scare"**: rumors spread across the company about who is and who isn't a furry, souring morale and loyalty. It unfolds in **four stages** (Logan, batch 84):

| Stage | What comes out |
|---|---|
| 1 | The ring is found |
| 2 | **Minky Mandy** is named |
| 3 | The pipeline smuggling is exposed |
| 4 | The furry panic: the Mink Scare proper |

Depending on what John does, the scandal **resolves anywhere between 9 February and 28 March 2020** (Logan).

**The interrogation (Logan, batch 84).** John interrogates Mandy Waltham, rolling **Intrigue**, or **Persuasion** for a softer approach (batch 85). Her answer has two parts, and any mix of them can happen:
- **Her statement**: a **sworn statement that absolves John** of wrongdoing; **no statement**; or **lies about John**.
- **The police**: she **cooperates with the cops**; **refuses to cooperate**; or **works with the cops against John**.
- **Succeeding** the event gets the best of both: a sworn statement clearing John, and cooperation with the police. Worse results move her toward silence or toward turning on him **(A for how the roll maps to the mix)**.

**Mandy afterward (Logan).** After the interrogation she **becomes a full character** (1.1.0) and **never drops back** to a table character. Where she ends up depends on how the saga branches (Logan, batch 85):

| Branch | Mandy's fate |
|---|---|
| She **works with the police and with John**, and he gets the good ending | John **frames her as a victim of the Cartel** and sets her up for a political career under his wing: she becomes a **Liberal politician John controls** (a strong hook, 1.1.8) |
| She **lies about John and works with the police against him** | She becomes a **Liberal politician who is strongly against John** (his Nemesis) |
| She **goes to jail** | She comes out the other end as an **influencer** in the Glitterati (16.7) |
| She **neither goes to jail nor goes to the police** | She goes back to crime and founds the **Canadian Furry Cartel**, an organized crime group (4-politics 4.22). The **USA is bombarded with drugs from both borders**: its southern border crackdown pushes the trade north **(A for the game effects: a US drug crisis event chain and pressure on Canada-US relations)** |

**John's choice** (Logan, batch 81), open at each stage:
- **Cover it up**: work out a scheme (1.1.8) to bury the ring and the rumors. Success keeps it quiet; discovery makes it a bigger scandal, with John attached.
- **Come clean**: go public, hand the ring to the police, and **deal with the media backlash** (16): a hit to investor confidence and John's Image that fades over the following weeks **(T)**.

**Characters (A).** The ring's other members are table characters. Terry and the board react by their traits.

### 8.2.6 The first quarterly recap (late March 2020)

Whenever the Mink Scare resolves, **7 days before the 2 April earnings** John gets the first **quarterly recap screen** (3-markets 3.1.0): anticipated earnings, the expected market reaction, the effect on investor confidence, and the company outlook. From then until 2 April he and every other executive **cannot trade** Arrowhead shares. The same screen comes before every earnings day after this.

## 8.3 John Techno: "The One Man You Keep" (the player's line)

**Who he is (Logan, batch 76).** John was a **union man on the oil fields of Canada**. Recent Liberal governments forced his company into **new ownership** and the **union to break up**. The word went round: *"If there's one man you keep, it's John Techno."* His incredible stats have made him a **local legend**, and at just **22** he is the **Chief Operating Officer of the smallest oil company in the game**.

**Starting position (Logan, batch 76).** **$100,000 cash**; a salary of **$1M a year plus stock options**; a **one-year paid-off lease on executive housing in Edmonton**. The best stats of any character in the game (7-starting-world 7.3.0).

**The company: Arrowhead Drilling (Logan, batch 80).** The union-era **People Oil Trust**, renamed **Arrowhead Drilling** by its new owner. A listed oil company **worth $100M** (Company rank, 1.7.5) with one Oil and gas business unit in Alberta; still the smallest oil company in the game. **Terry Tippacanoe** (7-starting-world 7.3.5) holds **60%** and the **public 40%**.
- **Board (batch 80):** Terry as Chair, Terry's man as CEO, John as COO, and two more of Terry's picks.
- **Starting relationships (batch 80):** John's old union brothers are Friends; Terry is Neutral.

**Stock options (Logan, batches 77 and 80).** John's options are **issued out of Terry's shares**, sized by John's performance (batch 80; this is how the answer was read). He starts with options on **2% of the company**, vesting over **4 years** with a **1-year cliff**. The package **changes as the company grows**: at each yearly review the board resizes his next grant by the **company's financial situation** and **John's performance as COO** **(T)**:
- New grant = 0.5% of the company × company factor × performance factor.
- Company factor: 0.5 if the company lost money that year, 1 if it broke even or grew slowly, 1.5 if revenue grew 20% or more.
- Performance factor: 0.5 to 1.5 from the year's productivity change in his units and the last arc outcome (Strong 1.5, Mixed 1, Poor 0.5).
- As the company climbs a rank (1.7.5) the percentage shrinks but the value grows; a CEO seat (Arc 4) brings a new package.
- A board where Terry is John's Rival can cut the grant to zero.

**Skills and trait (Logan, batch 78).** **24 in all six skills** (Finance, Operations, Persuasion, Intrigue, Tech, Hustle). He starts with **one trait**, unique to him: **Operational Excellence** (1-corporate-core 1.1.2): while he sits on a company's board as **COO, CEO or Chair** (batch 79), the buffs of **all other board members are doubled**. Events and arc outcomes can add more traits later.

**Ambition (Logan, batch 79).** **None: a blank slate.** The player decides what John wants. If a future scenario lets the player start as someone else and John is a rival, his ambition is rolled at random.

**Family (Logan, batch 79).** Single, no children. His **parents live in Edmonton** and are in the **PMC stratum, both middle managers**.


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

### Arc 2: Oil Software (Q2 to Q4 2020, Logan, batch 86)

**The pitch.** The **oil industry is stagnant**: its demand is not growing while **renewables** are (10.3), and it is time to act. **Terry correctly spots a gap**: there is **no enterprise software specialized for the oil industry**, so every oil company uses general enterprise software to turn its **unstructured industry data into structured industry data**, inefficiently (14.2.2).

From **Q2 to Q4 2020** the arc takes John through building that software:

| Step | Goal | Teaches |
|---|---|---|
| 1 | **Kids Who Code (3 March 2020, Logan, batch 87).** Terry: *"Tough day, huh? I started this charity called Kids Who Code. It doesn't say how old the kids have to be, just that they have to code, so I used the money to hire you an offshore team in India."* This starts a **frozen business unit** (10.0.2) with **100 desktops** of Techno-Capital: no revenue, no expenses, and it can only make software | Frozen units; making software (14.8) |
| 2 | **The charity builds the oil software.** Its developers are volunteers, so labor is free; it is locked to **India**, which makes medium-low quality software (starting quality 30), and its output is gated by its 100 desktops and developer productivity (about 100 software units a day). **Arrowhead owns** the finished software (batch 88). John **sets the software's direction**, or **delegates** it and gets an event when it is done | Desktops, software units, location and quality (14.8) |
| 3 | **Update it to improve quality**, version by version | Versions, quality and bloat (14.2.1) |
| 4 | **Make decisions along the way** that push **quality, speed or capacity** | The trade-offs in 14.2.1; compute and cloud (15) |
| 5 | **Terry presses John** to run casino money through Arrowhead (batch 86). **Agree** and John gets a **hook on Terry**; **decline** and nothing happens (batch 87) | Hooks (1.1.8), laundering risk (4) |
| 6 | **Finished: keep it or lease it.** **Keep** the software in-house for a **competitive advantage** (Arrowhead's oil unit processes its data better than every rival), or **lease it out** to other oil companies for **quick cash**: they pay for licences by usage, locked for a year when they add capacity, and nobody can copy it (14.4) | Software contracts; strategy |
| 7 | **January 2021: the cliff.** John's first options vest (8.3); hold, sell or borrow against them (batch 86) | Personal margin and pledged shares (1.10.6) |

**Outcomes (A).** Strong: high-quality software that sets the industry standard; +2 Tech or Finance. Mixed: working but bloated software; +1 Finance. Poor: a costly flop that eats the year's budget. Arrowhead is never bought out here: AI companies do not buy other companies unless the director tells them to (10.5.4).

### Arc 3: Power Play

Opens once the AI boom starts. It also holds John's **early AI move** before the boom, such as a stake in the tipped lab (Logan, batch 86; to be designed).

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
2. The delivery time of the desktop (8.2.1), the come-clean backlash, how the interrogation roll maps to Mandy's answer, and the Furry Cartel's effects (8.2.5).
3. John Techno's skills, traits and arcs, the option review numbers, and the Terry branch in 8.3.
4. Generated quest sources in 8.4.
5. Crash timing and the ×1.2 crash size in 8.5.
