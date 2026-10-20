# 8. Quest lines: detailed design

_Status: draft v2.6 (2026-10-20). Batch 163 (Logan): the old union's pension fund holds **7%** of Arrowhead, so the public holds 33% (8.3, Arc 6 step 2); LP consent for the fund's stake in John's startup is confirmed as a step he must win (Arc 4 step 5); Terry has no gambling habit, and one cause of his fall is **the truth of his background** coming out, its content still open (Arc 6); power deals are not a contract type: signing one gives the company a one-time free addition to its business assets from the start of the next quarter, and the 10-year power contract is gone (Arc 5); the player's score is scrapped, so the closing event has no score bonus and the CEO seat no score milestone (Arc 6, the closing event). Batch 151 (Logan): AI boom moves to 2030, bubble to 2040 on average; AI starts tiny with low growth, then unprecedented growth. The Fund runs from 2021 until the 2030 boom and is judged then; Power Play opens at the 2030 boom and runs to about 2034; the line spans 2020 to about 2034 and the closing event comes about 2034; side quests fill the pre-boom years 2022 to 2029; the export controls that touch Arcs 4 and 5 come in 2031 **(A)**; the crash (8.5) is 2040 plus a roll of -2 to +2 years (8.1, 8.3, 8.4, 8.5). The Fall of Terry keeps its 2023 to 2030 window. Batch 143 (Logan): the quarterly cycle ([21-quarterly-cycle.md](21-quarterly-cycle.md)); First Week on the Job stands in for the first board meeting chain, and the first recap opens the pre-quarter-end week with John locked out of all stock trading (8.2.3, 8.2.6). Batch 139 (Logan): six arcs; Quiet Money and Dry Hole cut. John's line is New Owners, Oil Software, The Pivot, The Fund, Power Play (Arc 5) and The Fall of Terry (Arc 6), then the closing event; generated side quests fill 2022 to 2024; the crash is a world event, not an arc, and the line can finish before the bubble pops (8.1, 8.3, 8.4, 8.5). v2.3. Batch 138 (Logan): John's line now has **8 arcs** plus a closing event (8.1, 8.3). Arc 4 is **The Fund**: John starts a VC fund, raises money from many sources with strings attached, backs the tipped lab and founds his own AI startup, which gets compute, data and talent the easy way or the hard way. Arc 5 is **Quiet Money** (2022 to 2024): grow the Pivot and build a war chest, interleaved with generated side quests. Arc 6 is **Power Play**: deals to build power plants and a Power utilities business through oil connections, not tied to the Pivot. Arc 7 is **The Fall of Terry** (replaces The Top Job and absorbs Arc 1's friend-or-foe branch): Terry's protracted fall from grace while John gathers power, ending in forcing Terry out or keeping him as a figurehead. Arc 8 is **Dry Hole**, updated for the fund and the startup. A short closing event, **The One Man You Kept**, sums up John's run before the open-ended game. v2.2 (2026-10-18). Batch 116: no successors or legacy quests (John's death ends the game); John is single with two moms; Arrowhead's unit is in Oil; dead links to 10-events fixed (A22). v2.1. Batch 92: The Pivot's cause and four choices; the AI boom starts in 2025. Batch 91: Arc 3 is The Pivot to a software company; Power Play, The Top Job and Dry Hole move to Arcs 4 to 6. Batch 90: the oil software's costs, updates and structured data. Batch 88: Arrowhead owns the oil software; the charity's 100 desktops make 100 software units a day. Batch 87: Kids Who Code (Terry's charity builds the oil software in India), the casino-money hook, licences. Batch 86: Arc 2 is now Oil Software (Q2 to Q4 2020); options vest in January 2021; the early AI move belongs to Arc 3. Batch 85: the interrogation roll and Mandy's four endings, including the Canadian Furry Cartel. Batch 84: the Mink Scare's four stages and Mandy's interrogation, CPU delegation without rolls, the quarterly recap screen. Batch 83: the six First Week events, Vril Touch, the Mink Scare; the old tutorial arcs are dropped. Batch 81: the opening sequence (start on 1 January, the first earnings day, First Week on the Job, Intro Night, The Scandal). Batch 80: John's company is Arrowhead Drilling (once People Oil Trust), worth $100M; John's options come out of Terry's shares. Batch 79: Operational Excellence also works as CEO or Chair; John starts with no ambition; his family. Batch 78: John's skills are all 24 and he has one trait, Operational Excellence; Terry's schemes stay out of the media. Batch 77: Terry Tippacanoe is the new owner, with a befriend-or-bring-down branch; options grow with the company and John's performance; the tip arrives on the desktop. Batch 76: **only the player has a quest line**: the rivals' lines are cut (rivals act on their traits), John Techno's line is rewritten for his new premise, and the opening quest is now buying a desktop computer. v0.6: Consistency pass, batch 74: quest steps use business units and assets, no cyberware, no supply chains. Batch 35: full lines for Pablo, Tolu and Qiao. Batch 36: Fang (a woman, batch 37), Pablo picks his ideology, Qiao is a woman, Lagos becomes Africa's hub. Back in work now that the economy, corporations, investing and characters are designed. Batch 33 answers applied: full lines for one character per region next, Pieter reworked for the new economy, generated quests after a line ends, and successors usually start fresh. Builds on [13-events.md](13-events.md) (events and chains), [7-starting-world.md](7-starting-world.md) (characters, alternate history), [1-corporate-core.md](1-corporate-core.md), [3-markets-and-fx.md](3-markets-and-fx.md), [6-technocapital.md](6-technocapital.md), [10-industry-economy.md](10-industry-economy.md) and [11-addiction.md](11-addiction.md). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 8.6.

---

## 8.1 Arcs and quest line rules

A quest line is made of **arcs** (Logan's word; not chapters).

| Rule | Decision (Logan) |
|---|---|
| Structure | The number of arcs, their length and their story structure vary by character. |
| Length | Set by the story, not a fixed count (batch 138; the old rule of 4 to 6 arcs is retired). **John Techno's line has 6 arcs** plus a closing event (batch 139), spanning 2020 to about 2034 (8.3; batch 151). The line can finish before the bubble pops (8.5). |
| Concurrency | Arcs can run at the same time and overlap in time; John's arcs 4 to 6 all overlap (8.3, the line at a glance). |
| Outcomes | Each arc ends in one of several outcomes. Each outcome gives a **stat buff** (skills or character resources); better outcomes give better buffs, and bad outcomes can give worse ones or penalties. Outcomes can also change traits (1.1.2). |
| Steps | Inside an arc, the player sees only the next step. Failure branches into new quests. Quest steps are event chains ([13-events.md](13-events.md) 13.6). |
| After the line | When a line ends, a short **closing event** sums up the run (batch 138), then **generated side quests** keep coming from events, the character's ambition (1.1.2) and rivals (batch 33). Side quests also run **during** the line: they fill the pre-boom years 2022 to 2029 (8.4, batches 139 and 151). |
| Death | Removed (batch 116): there are no successors. If John Techno dies, the game is over and the line ends with it. |
| The crash | The AI bubble pops in **2040 on average** (Logan, batch 151; was 2035, batch 93). The actual year varies by a few years with RNG and events (8.5). The crash is a **world event, not a quest arc** (batch 139), and John's line may end before it. If it hits while the line is still running, it can fire events inside the current arc (8.5). |

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
- **Decisions set the quarter.** The choices made through the week **set the direction for the company for the rest of the quarter**. They hold until the next quarter's review. Since batch 143 this chain stands in for the first quarterly board meeting chain ([21-quarterly-cycle.md](21-quarterly-cycle.md) 21.4), which is skipped in January 2020 **(A)**.

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

Whenever the Mink Scare resolves, **7 days before the 2 April earnings** John gets the first **quarterly recap screen** (3-markets 3.1.0): anticipated earnings, the expected market reaction, the effect on investor confidence, and the company outlook. It opens the first **pre-quarter-end week** ([21-quarterly-cycle.md](21-quarterly-cycle.md) 21.6): from then until 2 April John **cannot trade any stock**, every other Arrowhead executive is locked out of Arrowhead shares, and each board member brings him one event a day. The same week comes before every earnings day after this.

## 8.3 John Techno: "The One Man You Keep" (the player's line)

**Who he is (Logan, batch 76).** John was a **union man on the oil fields of Canada**. Recent Liberal governments forced his company into **new ownership** and the **union to break up**. The word went round: *"If there's one man you keep, it's John Techno."* His incredible stats have made him a **local legend**, and at just **22** he is the **Chief Operating Officer of the smallest oil company in the game**.

**Starting position (Logan, batch 76).** **$100,000 cash**; a salary of **$1M a year plus stock options**; a **one-year paid-off lease on executive housing in Edmonton**. The best stats of any character in the game (7-starting-world 7.3.0).

**The company: Arrowhead Drilling (Logan, batch 80).** The union-era **People Oil Trust**, renamed **Arrowhead Drilling** by its new owner. A listed oil company **worth $100M** (Company rank, 1.7.5) with one Oil business unit in Alberta; still the smallest oil company in the game. **Terry Tippacanoe** (7-starting-world 7.3.5) holds **60%**, the **old union's pension fund 7%** (Logan, batch 163) and the **public 33%**.
- **Board (batch 80):** Terry as Chair, Terry's man as CEO, John as COO, and two more of Terry's picks.
- **Starting relationships (batch 80):** John's old union brothers are Friends; Terry is Neutral.

**Stock options (Logan, batches 77 and 80).** John's options are **issued out of Terry's shares**, sized by John's performance (batch 80; this is how the answer was read). He starts with options on **2% of the company**, vesting over **4 years** with a **1-year cliff**. The package **changes as the company grows**: at each yearly review the board resizes his next grant by the **company's financial situation** and **John's performance as COO** **(T)**:
- New grant = 0.5% of the company × company factor × performance factor.
- Company factor: 0.5 if the company lost money that year, 1 if it broke even or grew slowly, 1.5 if revenue grew 20% or more.
- Performance factor: 0.5 to 1.5 from the year's productivity change in his units and the last arc outcome (Strong 1.5, Mixed 1, Poor 0.5).
- As the company climbs a rank (1.7.5) the percentage shrinks but the value grows; a CEO seat (Arc 6) brings a new package.
- A board where Terry is John's Rival can cut the grant to zero.

**Skills and trait (Logan, batch 78).** **24 in all six skills** (Finance, Operations, Persuasion, Intrigue, Tech, Hustle). He starts with **one trait**, unique to him: **Operational Excellence** (1-corporate-core 1.1.2): while he sits on a company's board as **COO, CEO or Chair** (batch 79), the buffs of **all other board members are doubled**. Events and arc outcomes can add more traits later.

**Ambition (Logan, batch 79).** **None: a blank slate.** The player decides what John wants. If a future scenario lets the player start as someone else and John is a rival, his ambition is rolled at random.

**Family (Logan, batches 79 and 116).** A **single, 22-year-old man with two moms**. His moms live in **Edmonton** and are in the **PMC stratum, both middle managers**. They are flavor characters: there are no family mechanics and no personal life arc.


**What the line teaches.** Running a company from the COO seat, the industry economy, earnings days, board politics, venture capital and training AI models, the AI boom's power demand, and taking control.

**The line at a glance (Logan, batches 138 and 139).** Six arcs and a closing event. Arcs overlap in time; the windows are defaults **(T)**. Generated side quests fill 2022 to 2029 (8.4). The crash is a world event (8.5), and the line can finish before it.

| Arc | Name | Default window | Opens when | In one line |
|---|---|---|---|---|
| 1 | New Owners | Q1 2020 on | After the opening (8.2) | Keep the COO seat; befriend Terry or work on his downfall |
| 2 | Oil Software | Q2 to Q4 2020 | 3 March 2020 | Build the oil software through Terry's charity |
| 3 | The Pivot | Q1 2021 | The oil windfall | Spend the windfall on gambling, software or oil |
| 4 | The Fund | 2021 to the boom (2030) | John's options vest and the Pivot is chosen | Start a VC fund, back the tipped lab, build John's own AI startup |
| 5 | Power Play | 2030 to about 2034 | The boom (the tipped lab's chatbot) | Use oil connections to build power plants and a Power utilities business |
| 6 | The Fall of Terry | About 2023 to 2030 | Terry's first slip | Terry declines; John gathers power, then forces Terry out or keeps him as a figurehead |
| End | The One Man You Kept | After every arc closes (about 2034) | All six arcs closed | A short closing event sums up the run; the game goes on (8.4) |

### Arc 1: New Owners

| Step | Goal | Teaches |
|---|---|---|
| 1 | Meet Terry Tippacanoe, the new owner, at his casino, and the board he installed; keep your seat | Board seats, Friend and Rival tags (1.8, 1.1.4) |
| 2 | Run the oil fields: set the unit's growth plan and R&D | Business units, productivity, growth plans (10.0) |
| 3 | Your old union brothers want their jobs back: rehire them, or not | Loyalty, costs, the Communist bloc (4.0) |
| 4 | **Friend or foe (Logan, batch 77).** Choose how to deal with Terry: **befriend him**, or **work in the shadows on his downfall** | The branch below |

**The Terry branch.** The choice opens one of two quests that run alongside the rest of the line and flow into **Arc 6, The Fall of Terry**, which sets how each path plays out (batch 138) **(A)**:
- **Befriend Terry.** Win him over (Persuasion, favors, a night at the casino). As a Friend he backs John on the board, cuts him into deals, and lends him his edge against Liberal characters in shared schemes; and he will expect favors (a hook).
- **Bring him down.** Dig into his deals and the casino's books in secret (Intrigue schemes and hacking; the media will never expose him, 7.3.5). Each secret found is a hook, or ammunition with the board and shareholders; the end goal is forcing him out of the company, and each secret found speeds up his fall in Arc 6. If Terry learns of it, he turns Nemesis.

**Outcomes.** Strong: the board trusts you and the crews follow you; +2 Operations. Mixed: +1 Operations. Poor: Terry marks you as a Rival.

### Arc 2: Oil Software (Q2 to Q4 2020, Logan, batch 86)

**The pitch.** The **oil industry is stagnant**: its demand is not growing while **renewables** are (10.3), and it is time to act. **Terry correctly spots a gap**: there is **no enterprise software specialized for the oil industry**, so every oil company uses general enterprise software to turn its **unstructured industry data into structured industry data**, inefficiently (14.2.2).

From **Q2 to Q4 2020** the arc takes John through building that software:

| Step | Goal | Teaches |
|---|---|---|
| 1 | **Kids Who Code (3 March 2020, Logan, batch 87).** Terry: *"Tough day, huh? I started this charity called Kids Who Code. It doesn't say how old the kids have to be, just that they have to code, so I used the money to hire you an offshore team in India."* This starts a **frozen business unit** (10.0.2) with **100 desktops** of Techno-Capital: no revenue, no expenses, and it can only make software | Frozen units; making software (14.8) |
| 2 | **The charity builds the oil software.** Its developers are volunteers, so labor is free; it is locked to **India**, which makes medium-low quality software (starting quality 30), and its output is gated by its 100 desktops and developer productivity (about 100 software units a day). **Arrowhead owns** the finished software (batch 88). It is **specialized enterprise software**: unstructured oil data in, structured oil data out, twice as effective as general enterprise software (14.2.3). **Version 1 costs 9,000 software units**, about 3 months for the charity (batch 90). John **sets the software's direction**, or **delegates** it and gets an event when it is done | Desktops, software units, location and quality (14.8) |
| 3 | **Update it**, version by version: each update starts at **3,000 software units × bloat**, costs more each time and gives less (14.8, batch 90) | Versions, quality and bloat (14.2.1) |
| 4 | **Make decisions along the way**: each update pushes **quality (+5), speed (+20%) or capacity (-15% compute)** (batch 90) | The trade-offs in 14.2.1; compute and cloud (15) |
| 5 | **Terry presses John** to run casino money through Arrowhead (batch 86). **Agree** and John gets a **hook on Terry**; **decline** and nothing happens (batch 87) | Hooks (1.1.8), laundering risk (4) |
| 6 | **Finished: keep it or lease it.** **Keep** the software in-house for a **competitive advantage** (Arrowhead's oil unit processes its data better than every rival), or **lease it out** to other oil companies for **quick cash**: they pay for licences by usage, locked for a year when they add capacity, and nobody can copy it (14.4) | Software contracts; strategy |
| 7 | **January 2021: the cliff.** John's first options vest (8.3); hold, sell or borrow against them (batch 86) | Personal margin and pledged shares (1.10.6) |

**Outcomes (A).** Strong: high-quality software that sets the industry standard; +2 Tech or Finance. Mixed: working but bloated software; +1 Finance. Poor: a costly flop that eats the year's budget. Arrowhead is never bought out here: AI companies do not buy other companies unless the director tells them to (10.5.4).

### Arc 3: The Pivot (Q1 2021, Logan, batches 91 and 92)

**The moment.** Once the oil software is done, in **Q1 2021**, oil is **booming in Edmonton** for Arrowhead. Two things cause it (Logan, batch 92):
- **The other large oil companies are racked by debt**, which makes business hard for them.
- **Arrowhead's CEO makes some very intelligent moves in the futures market** (a scripted event, batch 93; commodities stay a placeholder, 3.7), freeing up a **windfall of capital** to invest.

**John decides** (batch 92): as COO he makes the call himself, without a board vote. The **Kids Who Code charity stays** whatever he picks.

| Choice | What happens |
|---|---|
| **Pivot to gambling** | Take **Terry's offer** to partner on a **prediction market** or an **online casino** (the Gambling industry, [9-gambling.md](9-gambling.md)) |
| **Stick to the old system** | Use the **software business unit** to **improve the software already made** or **make new software outside gambling** (Logan, batch 93) |
| **Stick to making software the old way** | Keep building enterprise software through the charity's free desktops (14.8) |
| **Pour the windfall into oil** | Put the cash into oil production: the oil business units grow greatly |

**Where the money goes (Logan).** The windfall either **greatly increases the oil business units** or **creates a new, real software business unit in Canada** (in Edmonton, with paid developers) **(A: the gambling pivot also builds its platform in this new unit)**.

**Outcomes (A).** Strong: the chosen path takes off; +2 Tech or Operations. Mixed: +1 Tech or Operations. Poor: the new spending drains cash.

### Arc 4: The Fund (2021 to the boom, Logan, batch 138)

**The idea (Logan).** John cashes in on the LLM tip (7-starting-world 7.6) through **venture capital**: *"John starts a fund and looks to get funding from various places. His first start up is an AI start up that must acquire compute and develop models the easy way or the hard way."* The tip tells John which lab will break through in 2030 (batch 151), and nobody else knows it. Until the boom AI is really small with low growth (about a $5B market growing about 5% a year, Logan, batch 151) and AI demand for GPUs is tiny (6.7.0), so GPU parts, the cloud GPU price and AI valuations are all cheap: every dollar John puts into AI before 2030 is bought at pre-boom prices.

**When.** Opens when John's first options vest (January 2021, Arc 2 step 7) and the Pivot (Arc 3) has been chosen. It runs alongside Arc 3, Arc 6 and the generated side quests of 2022 to 2029 (8.4), and **ends when the boom starts** (the tipped lab's chatbot, 2030), when its outcome is judged. The fund and the startup carry on afterwards as ordinary companies.

**Two vehicles (A).**
- **The fund**: a company of the type Fund holding a **venture capital firm** licence ([3-markets-and-fx.md](3-markets-and-fx.md) 3.0, 3.17.1, 3.18.4). John is its lead manager, so its quarterly roll uses his Finance. It charges 2% a year of committed capital plus 20% of profit (3.18.2), and commitments are locked for 10 years.
- **The startup**: a new company in the **AI labs** industry that John founds (1-corporate-core 1.6). The player names it and picks its home province; Edmonton is the default. John is founder and Chair and stays COO of Arrowhead; Operational Excellence works on both boards (1.1.2).

**The tipped lab and the startup are different companies.** The tipped lab is drawn at game start from the pool of five candidate labs (7.6; rows in data/companies.csv). The **fund** can back it; the **startup** is John's own. How the fund gets into the tipped lab depends on which lab was drawn **(A)**:

| Tipped lab (7.6) | How the fund gets in |
|---|---|
| **Open Meridian Institute** (Bay Area nonprofit, widely held) | A nonprofit has no equity round. The fund backs the **for-profit arm** the lab spins off to raise money: a Venture-rank company that licenses the lab's models |
| **Halcyon Frontier Research** (a big tech subsidiary) | The parent will not sell the division. The fund buys the **parent's listed shares** quietly, or backs **researchers who leave** the division to found a spinout |
| **Kingsway Intelligence** (London), **Tianshu Intelligence** (Beijing), **Lakeshore Vector Labs** (Toronto) | Private and widely held: the fund joins the lab's **next funding round** as an investor (the 1.6.2 round seen from the investor's side) at a pre-boom valuation. Tianshu needs a foreign investment review (4-politics 4.9.6) and is hit by the 2031 US export controls (6.9.1; 7-starting-world 7.2) |

**Steps (A).**

| Step | Goal | Teaches |
|---|---|---|
| 1 | **Seed the fund manager.** The licence needs **$2M of minimum capital** (3.17.1). John raises it from his vested options: **sell** them, or **borrow against** them on personal margin (up to 50% of their value, 3.0, 1.10.6), plus his salary. Then apply for the **fund manager licence**: 8 to 12 weeks and a fit and proper test (3.17.2). A Mink Scare that ended badly for John (8.2.5) shows up here as exposure | Personal margin; licences |
| 2 | **Write the pitch book and meet the money** (3.18.4). Each source in the table below rolls for a commitment, and each comes with **strings attached** | Fundraising |
| 3 | **First close.** The fund closes at what was committed. A first fund raises **$50M to $500M** (3.18.4); John's target is **$150M (T)** | Fund terms |
| 4 | **Back the tipped lab** (table above). This stake is the fund's ticket to the boom: when the chatbot launches, the lab's value jumps and the fund's marks with it | Private stakes and valuation (10.5.4, 3.19.1) |
| 5 | **Found the startup** (1.6.1) on the Venture Capital path with **John's fund as lead investor**. Because John runs the fund, this is a **related deal**: every LP holding 10% or more of the commitments votes on it, and a majority must consent. Winning that consent is a step John has to take (Logan, batch 163). Without consent, or at an inflated valuation, it counts as **self-dealing** (3.18.5). The fund may put at most **25% of its commitments into one company (T)**, so later rounds need **co-investors**: another VC, the sovereign fund or a strategic investor (1.6.9) | Founding; fiduciary duty |
| 6 | **Hire the research lead.** The lead's Tech sets the run score (6.5.3). Easy way or hard way (below) | Key hires (1.6.9) |
| 7 | **Get compute.** Easy way or hard way (below) | Owned, leased, spot and compromised compute (6.3.4); data centers (15.3) |
| 8 | **Get data.** Easy way or hard way (below). The data types chosen decide which capabilities the model gets (18.3) | Stored data (15.4); data types and capabilities (18.3) |
| 9 | **The first training run**: a **Gen 1** model, **60,000 H over 3 months**, which needs **20,000 GPU units in one cluster** and **10 DU (1,000 TB)** of data (6.5.2, 15.2.1, 18.3). Hot moments as in 6.5.4: loss spikes, node failures, a rival's hackers after the training data | Training runs (6.5, 18.3) |
| 10 | **Use the model before the boom.** **License** it (18.4), **release it as open weights** for Fame and Accelerationist favor (6.2.4), or **load it into Arrowhead's oil software** as an AI feature (14.5, 18.5; a deal with Arrowhead's board). With time and money left, raise a Series A or B and start a **Gen 2** run (240,000 H over 4 months, 60,000 GPU units) | Licences, open weights, AI features |

**The easy way or the hard way (Logan).** The startup has three needs: talent, compute and data. The player picks the easy or the hard way for **each need separately**, and mixes are allowed **(A)**. The easy way costs money and dilution; the hard way costs time, risk and enemies, but leaves John owning more.

| Need | The easy way: pay up | The hard way: build, collect or take |
|---|---|---|
| **Talent** | Hire a lead and team at Glitterati pay with an option pool (1.6.9). Expensive; nobody gets angry | **Poach researchers from the tipped lab** or another lab: the 1.6.9 hire chance plus a Persuasion roll. Each poach makes the lab's head a Rival of John and has a **20% chance (T)** of a lawsuit (4-politics 4.21.2). A lead poached from the tipped lab brings its know-how: run score **+5 (T)** |
| **Compute** | **Rent GPU units from the cloud** (15.5) on spot, or **lease** them for up to 36 months at 80% of the cloud price at signing (6.3.4). Instant, but the provider sees the usage (15.6). Before 2030 the GPU cloud price is low, and **a lease signed before the boom locks that low price** for its whole term: a move only someone with the tip would make | **Build an onsite GPU data center** (15.3): buy 20,000 GPU units' parts at the chip price index (about $1,500 each at index 100, so about $30M, 6.7.0), find industrial real estate in the province, and wait in the **grid queue** (up to 9 months, 6.7.2), or skip it by running **behind the meter** on gas from Arrowhead's fields (a deal with Arrowhead's board). Upkeep is maintenance score 5 per unit (15.2). Owned compute allows secret tasks and can be leased out when idle. **Grey method: Compromised compute**, through a hack or a broker (6.9.3). It is free and invisible to export controls, but monthly detection is 5% plus 1% per 1,000 H, so a Gen 1 run (20,000 H a month) is caught about 25% of the time each month, and a run may use Compromised compute only as one whole site (6.5.2). It suits fine-tuning and small jobs; a whole run on it is a gamble |
| **Data** | **License or buy data** on the data market (15.4). Bought data trains a model just like your own (18.3) | **Collect it**: Arrowhead's structured oil data from Arc 2 (it counts as sensor feeds and documents **(A)**), a consumer app, or the charity's desktops gathering user data. Using Arrowhead's data is a related deal that Terry's board must approve. **Scrape it**: grey-market user data adds exposure (1.6.9). **Grey method: hacking** a rival's owned Techno-Capital to **steal its data** (17-hacking 17.3, 17.4). Hacking only steals data: **models cannot be stolen** (18.1) |

**Where the money comes from (Logan: "various places").** Each source rolls for a commitment as in 3.18.4. **Sizes are (T); strings are (A).**

| Source | Typical commitment | Strings attached |
|---|---|---|
| **John himself** (options sold or pledged, salary) | The $2M licence capital, plus 1% of the fund as the manager's own stake | Pledged options face a margin call (3.0) if Arrowhead's price falls |
| **Terry Tippacanoe** (friend path, or while Terry is still Neutral) | $10M to $30M, partly casino cash | Terry wants a first look at every deal and a seat on the startup's board, and holds a weak hook on John for it (1.1.4). Casino cash in the fund adds exposure +5 a year **(T)**, which Arc 6 can turn against either man. On the foe path Terry refuses, or comes in only to spy |
| **Minor holders** from data/characters.csv, for example **Spencer Ainsworth** (oil-sands tech money, Fort McMurray), **Celeste Langridge** (Saskatoon old money), **Clifford Ridley** (founded Red Mesa Neural, Winnipeg) | $5M to $25M each | Their traits set the strings. A Zealot wants "stranger ideas" backed; an Effective Altruist wants a safety clause (no Gen 3+ runs in a compute haven, 6.9.2); Ridley wants co-investment rights in the startup, and he is a Liberal, so Terry's tag toward John drops one step if Ridley comes in |
| **A rival** from data/characters.csv, for example **Cassius Whitlock** (Houston: pipes, power lines and the grid) | $10M to $50M | A rival LP sees the fund's deals as a holder (intel) and later asks a favor; the director (13.3) can use the tie. Whitlock's money sets up Arc 5, as partner or obstacle |
| **A sovereign fund**, for example through **Tariq Al-Harbi** (the Riyadh sovereign fund's man for megaprojects) | $50M to $100M | Strategic and slow (3.3.4). It wants a board seat in the startup and a promise to train an Arabic model or build compute in the Kingdom later. The tie carries into Arc 5 |
| **Personal offices** (the old family offices, 3.18.3), for example **Corinne Vale's** (Las Vegas) | $5M to $20M | Quarterly reports and a Clean conduct line (no shells). Vale commits only if Terry is kept out, and asks for anything John learns about Painted Sky Gaming: a seed for Arc 6 |
| **Pension funds and endowments** (3.18.4) | $10M to $40M | They need a track record, so the commitment chance is low for a first fund; they walk away from Fund II after a bad year |

**Outcomes (A).** Judged when the boom starts (2030):
- **Strong**: the startup has a model with at least one capability at quality **60 or more (T)** on compute it owns or leased before the boom, and the fund holds the tipped lab. +2 Tech or Finance and a Clout gain; a second fund (Fund II) raises more (3.18.4).
- **Mixed**: a model, but below quality 60 or on compute rented at boom prices. +1 Finance.
- **Poor**: no model by the boom. The startup faces a down round (1.6.2), and LPs will not commit to Fund II.

### Arc 5: Power Play (from the 2030 boom, Logan, batches 138 and 151)

**The idea (Logan).** *"Power play should be about securing deals to build utilities leveraging oil connections."* The boom makes **power** the bottleneck (6.7.2; 7.7: power deals in 2032). John uses his oil-world ties (Arrowhead's gas, pipelines, the union, oil-country politicians and ministers, Middle East oil money) to build **power plants** and a **Power utilities** business ([10-industry-economy.md](10-industry-economy.md) 10.3). It is **not tied to the Pivot** (Logan): every Arc 3 choice can play it, though the oil choice starts with more gas.

**When.** Opens at the boom (2030) and runs to about **2034 (T)**, closing when its last deal is signed or lost.

**Steps (A).**

| Step | Goal | Teaches |
|---|---|---|
| 1 | **The squeeze.** New data centers wait up to 9 months in grid queues (6.7.2); the startup (Arc 4) or a hyperscaler needs power. Pick the **vehicle**: push Arrowhead's board to add a **Power utilities** business unit (10.0.5), found a power company of John's own (1.6), or found one as a subsidiary (1.6.8) | Business units in any industry (10.0.5) |
| 2 | **Fuel from Arrowhead's gas.** Secure gas: Arrowhead's own fields, a supply deal or stake with a gas company such as **Oakhurst Gas** (Toronto), or buying gas business assets (10.5.4). A gas plant beside a data center sells **behind the meter** and skips the grid queue (6.7.2) | Deals; energy price indices (10.6) |
| 3 | **Pipes and wires.** Get gas to the plant and power to the buyer: a pipeline and grid deal with **Cassius Whitlock** (Houston; he owns the pipes, the power lines and **Gulf Coast Grid**), or a rival route. Whitlock asks for a stake or a hook | Deals with rivals; hooks (1.1.4) |
| 4 | **The union.** The old union brothers build and run the plants. If John rehired them in Arc 1, they come cheap and fast; if not, he bargains with the union federation (4-politics 4.24) or faces strikes | Unions and loyalty |
| 5 | **Oil-country politics.** Permits come only from national governments (4.3.1). Meet ministers (Meet Official, 4.10.1), **Request Decision** for each permit (10 PC), lobby, or call in favors from oil-country legislators and Terry's friend the Conservative MP (7.3.5). Canada's Liberal government, the one that broke the union, pushes back; Mandy Waltham, if she became a politician, helps or blocks (8.2.5) | Political Capital and lobbying (4.10) |
| 6 | **Win a government contract.** Bid on a **National infrastructure (grid)** or **City services (utilities)** contract (4.9.7). Bid score = price, capability, political (PC spent, favors called, a minister) and relation | Government contracts (4.9.7) |
| 7 | **The Gulf.** Turn Middle East oil ties into a gas-for-power or power-for-compute deal with **Ghawar National Oil Company** (Saudi Arabia) or **Liwa National Oil Company** (UAE), opened through **Tariq Al-Harbi** if he is an LP of the fund (Arc 4). Gulf sovereign money lends cheaper to a company with an Abu Dhabi HQ (-0.25 points, 2.3.5). From 2031 the US chip export controls (6.9.1) make GPU-heavy Gulf deals political | International relations (4.11); export controls |
| 8 | **Sign a power supply deal** with a hyperscaler, a gigacluster builder (a gigacluster needs 1 GW of dedicated power, 6.7.5) or John's own startup (a related deal). Like every power deal, it adds business assets (below) | Business assets (10.0.7) |
| 9 | **Finance the build.** A credit line, bonds once rated, or a new share issue (10.0.9); sovereign fund money; the fund (Arc 4) co-investing | Financing (10.0.9) |

**Power deals add business assets (Logan, batch 163).** A power deal is **not its own contract type**: there are no yearly payments and nothing to renew. When John's company signs a power deal, its Power utilities business unit gets a **one-time free addition to its business assets** (10.0.7), which takes effect at the **start of the next quarter**. The size depends on the deal **(T)**:

| Deal size | Free business assets |
|---|---|
| Small (about 0.1 GW) | $100M |
| Medium (about 0.3 GW) | $300M |
| Large (1 GW or more, a gigacluster) | $1B |

**Outcomes (T).** Strong: **1 GW or more** of plants built or gained through deals and a fast-growing power business; +2 Operations or Persuasion and a Clout gain. Mixed: a small unit, **under 0.3 GW**; +1 Operations. Poor: over-borrowed, with debt above **3× the unit's yearly revenue**, and at the bank's mercy.

### Arc 6: The Fall of Terry (about 2023 to 2030, Logan, batch 138)

Replaces the old arc The Top Job and absorbs Arc 1's friend-or-foe branch.

**The idea (Logan).** *"Terry will have a protracted fall from grace. During this point John will complete quests to amass power in the company. At the end if he succeeds he can either force Terry out or keep Terry on as a figurehead."*

**Why it is not a media scandal.** Terry's schemes are **never exposed in the media**: outlets cannot investigate them or run them as scandals (7.3.5, 16.5.1). So the press never brings him down, and his fall comes from everywhere else **(A)**:
- **The truth of his background (Logan, batch 163).** Terry is a financier of **questionable origins** (7.3.5). The truth about where he really comes from is a **hidden secret** that John can uncover through this arc's steps (step 4, Hooks), and when it comes out it helps bring him down. His heritage is not the secret (batch 78). **Open: what the truth is, and how it comes out, are for Logan to decide.** Terry has no gambling habit (batch 163).
- **Money trouble.** Painted Sky Gaming loses players to online gambling (John's own platform, if the Pivot went that way) and to rivals; Terry pledges Arrowhead shares for loans (1.10.6), so a fall in Arrowhead's price brings margin calls.
- **Rivals and holders.** They run Dig up dirt and other schemes on him (1.1.8). His buff works only against Liberals (7.3.5), so a non-Liberal schemer has no penalty; Corinne Vale has wanted him gone for years.
- **Regulators.** An investigation (4.9.4) is not the press. Exposure from the casino-money scheme (Arc 2 step 5) or casino cash in John's fund (Arc 4) can open one; its findings are legal facts, not stories.
- **The board.** As his money and judgment slip, directors' tags toward him fall and a faction forms (1.9.1).

**Terry's decline (A, T for the windows).** Five stages. Each fires when its trigger hits or at the end of its window, whichever comes first. John can speed a stage up (secrets found, debts bought) or slow it down (bailing Terry out).

| Stage | Default window | What happens to Terry |
|---|---|---|
| 1. The first slip | 2023 | The casino's revenue falls two quarters running |
| 2. Borrowed time | 2024 to 2025 | He pledges Arrowhead shares for loans; a margin call; he sells part of his stake |
| 3. The file | 2025 to 2026 | A regulator opens an investigation into the casino's books; Terry starts no new schemes while it runs |
| 4. The board turns | 2026 to 2028 | Directors' tags toward Terry drop; a faction reaches 10% of votes; his CEO takes the blame for a bad quarter |
| 5. The reckoning | By 2030 at the latest | Terry must sell his block, face a proxy fight or give up control. If John is not ready, his lenders sell the block to an outsider |

**John's power quests (A).** These run alongside the stages, in any order:

| Step | Goal | Teaches |
|---|---|---|
| 1 | **Seats.** Get allies onto Arrowhead's board at the yearly meeting (1.8.1): a CFO, a General Counsel, independent directors | Board seats and tasks (1.8) |
| 2 | **A bloc.** Join John's vested options, a quiet stake bought through trusts or shells under the disclosure lines (3.1.1; the fund cannot hide it, 3.18.4), friendly holders from the 40% public float and **the old union's pension fund** (it kept **7%** of Arrowhead through the sale, Logan, batch 163) into a bloc John leads (1.4) | Blocs and bloc leadership |
| 3 | **Friendly holders.** Win swing holders with meetings, favors or payments (1.9.2) | Proxy campaigns |
| 4 | **Hooks.** Dig into Terry's deals, the casino's books and the truth of his background (1.1.8.2, 17); **buy Terry's debts** from his lenders, so John becomes his creditor (a weak hook, 1.1.4); or bail him out quietly (another weak hook) | Hooks |
| 5 | **The CEO seat.** At the reckoning, take the head: win the board, a proxy fight (1.9.2), or **buy Terry's pledged block** when his lenders sell it (a block trade or a tender offer, 1.9.3) | Control on the books and for real (1.3.1) |
| 6 | **The choice (Logan).** **Force Terry out**, or **keep Terry on as a figurehead** (below) | Figureheads (1.3.1) |

**The choice.**

| | Force Terry out | Keep Terry as a figurehead |
|---|---|---|
| **On the books** | John or his bloc becomes the owner of record; Terry leaves the board | Terry stays Chair and owner of record of his shares; John is the real controller through a strong hook or bloc leadership, and that is hidden (1.3.1) |
| **Cost** | Buying Terry's stake at a premium, or winning a proxy fight | Little cash; it needs a strong hook or Terry's loyalty |
| **Gains** | Clean control, with no chain to break | Terry's anti-Liberal scheme edge and his MP friend keep working for John; rivals cannot see who runs Arrowhead; John's money stays free for Arc 5 |
| **Risks** | Terry turns Nemesis unless he was a Friend and was paid out fairly; his MP friend turns against John | The chain can break: if Terry's loyalty falls to Defiant or the hook is destroyed or exposed, he decides for himself again (1.3.1). A rival or director who finds out fires the Exposed event. Terry's money trouble keeps dragging on him |

**Arc 1's choice plays out here (A).** The friend-or-foe branch of Arc 1 is the opening of this arc, and it changes how the fall goes:

| | Friend path | Foe path |
|---|---|---|
| **During the fall** | Terry **leans on John**: he asks for loans, cover and favors. Each one John grants gives him a weak hook on Terry; refusing cools Terry to Neutral | John's digging drives the fall: each secret found moves the next stage up to **6 months earlier (T)**. If Terry learns of it he **fights back** as a Nemesis: he cuts John's option grant to zero (8.3), tries to fire him as COO at a board meeting and schemes against him |
| **At the reckoning** | Terry asks John to save him. The figurehead path is easy (Terry's loyalty starts **+20 (T)**); forcing him out is a betrayal: the Friend tag is lost and John takes **Clout -10 (T)** among those who know | Forcing him out is easy with the hooks in hand. Keeping him as a figurehead needs a strong hook (blackmail), and his loyalty starts low, so the chain is fragile |

**Outcomes.** Strong: John is President and CEO and the real controller of Arrowhead, with Terry out or a loyal figurehead; +2 Persuasion or Intrigue, a Clout gain and a new options package (8.3); the milestone for taking the CEO seat goes in the history log (12-setup-and-score 12.4). Mixed: John is CEO, but Terry or another holder keeps a blocking minority, or the figurehead is restless; +1 Persuasion. Poor: Terry falls, but an outsider buys his block and takes Arrowhead, and John is pushed out with his options and his legend.

### The closing event: "The One Man You Kept" (Logan, batch 138)

When the line ends, a **short scripted closing event** sums up John's run (Logan). The game then goes on **open-ended**, with generated quests (8.4). It is not a victory screen: endings are out of scope (batch 130).

- **When (A).** Once all six arcs have closed, by about 2034 **(T)**, which can be before the bubble pops (8.5). If the crash hits first, it fires events inside the open arcs and the closing event waits for them to close. If John dies first, the game is over and there is no closing event (8.1).
- **The screen.** The event screen (13.2.1): the left side tells John's run in a few lines of story; the right side shows his record **(A)**:
  - **What he built**: the companies he really controls, with rank and value; the fund's return multiple; the startup's best model capability; the gigawatts of power he built.
  - **Who he beat**: rivals he ruined or bought out, his Nemesis's fate, and Terry's fate (forced out, a figurehead, or the man who outlasted John).
  - **His standing**: his rich-list rank (1.10.6) and his milestones (12.4).
  - **Each arc's outcome tier.**
- **Effect.** A permanent history log entry. There is no score (Logan, batch 163). If John still has no ambition (1.1.2), the event asks the player to pick one, since ambitions feed the generated quests.
- **Then** one button, **Carry on**, and the game continues.

## 8.4 Generated quests after a line

When John's line ends, after the closing event (8.3), **generated side quests** keep coming (batch 33) **(A)**. They also **fill 2022 to 2029**, the years before the boom, while the line is still running (batches 139 and 151): the director (13.3) keeps up to **2 open side quests (T)**, dropping to 1 from the 2030 boom while Arc 5 is busy; arc steps come first, and a side quest is paused, not failed, while an arc's event chain runs. In those years themes lean toward the coming boom (the 2021 crypto and SPAC mania, 7.7; a debt-racked oil company selling assets; a cheap lot of GPU parts; a rival's scandal), and rewards are cash, hooks, Clout and data. Sources:
- **From the ambition** (1.1.2): a 2 to 4 step quest toward it, rebuilt when the ambition changes.
- **From events**: an event can open a quest (a merger offer, a scandal to bury, a friend in trouble).
- **From rivals**: a rival's scheme or a rival rotation character aimed at the player opens a defense quest.

## 8.5 The crash

The AI bubble pops in 2040 on average (Logan, batch 151; was 2035, batch 93). The year is set at game start as 2040 plus a roll of -2 to +2 years **(T)**, then moved by events: a bigger boom (high AI valuations, heavy leverage) brings it closer, and calmer markets push it later **(A)**. In this world there was never a dot-com crash or a 2008 crisis (7.2.0), so investors have never lived through a great crash, and it hits harder: market drops are ×1.2 the normal crash size **(T)**. The crash is a **world event, not a quest arc** (batch 139), and John's line may end before it. If it hits while the line is still running, it can fire events inside the current arc **(A)**: for example a down round for the startup, LPs wanting out of the fund through a discounted secondary sale (3.19.2), or power demand falling. Any quests tied to the boom resolve.

## 8.6 Assumptions and open items

1. Outcome tiers and buff sizes in 8.1.
2. The delivery time of the desktop (8.2.1), the come-clean backlash, how the interrogation roll maps to Mandy's answer, and the Furry Cartel's effects (8.2.5).
3. John Techno's skills, traits and six arcs, the option review numbers, and the Terry branch in 8.3 (now the opening of Arc 6).
4. Generated quest sources in 8.4, including side quests in 2022 to 2029 during the line (2 open, 1 from 2030, arc steps first) and their themes and rewards.
5. Crash timing and the ×1.2 crash size in 8.5; the crash as a world event, and which events it fires inside an arc still running.
6. The Fund (Arc 4, batch 138): the fund as a VC firm led by John; the $150M target and 25% single-company cap; how the fund gets into each of the five candidate labs; the money sources' sizes and strings; the easy and hard ways (poach lawsuit 20% and run score +5, pre-boom leases, Arrowhead's oil data counting as sensor feeds and documents); the quality 60 line for a Strong outcome.
7. Power Play (Arc 5): the named partners (Oakhurst Gas, Cassius Whitlock, Ghawar and Liwa national oil companies, Tariq Al-Harbi), the free business assets per power deal ($100M, $300M, $1B), and the 1 GW, 0.3 GW and 3× debt tiers.
8. The Fall of Terry (Arc 6): the five decline stages and their windows, the causes outside the media, **what the truth of Terry's background is and how it comes out (open, for Logan)**, John's quiet stake, the friend and foe effects (+20 loyalty, 6 months earlier, Clout -10), and the figurehead trade-offs.
9. The closing event: when it fires (all six arcs closed, about 2034), what it shows and the ambition prompt.
