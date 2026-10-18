# 7. Starting world: detailed design

_Status: draft v0.9 (2026-10-18). Batch 77: Terry Tippacanoe, the new rival who owns John's company; Edmonton, the listed company and the desktop tip confirmed. Batch 76: John Techno's premise and starting position, rivals without quest lines, the desktop as the first quest, Edmonton replaces Calgary. Batch 75: the scenario starts in **January 2020** with **one starting character, John Techno**; the other 14 premade characters are rivals. v0.6, consistency pass, batch 74. v0.5 (2026-10-17): alternate history added. Built from Logan's answers in the design Q&A. Sets the scenario, the starting character, the rival field, the opening quest and the timeline to 2030. Builds on [1-corporate-core.md](1-corporate-core.md) (characters, trusts, succession), [2-map-and-influence.md](2-map-and-influence.md) (hubs, influence), [5-ideology.md](5-ideology.md) and [6-technocapital.md](6-technocapital.md). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 7.10.

---

## 7.1 Decided by Logan

| Topic | Decision |
|---|---|
| Game type | A **4X game**. There are **no stages**. Play is shaped by **scenarios**. |
| Scenarios | One scenario, in the alternate history, starting in **January 2020** (Logan, batch 75). More scenarios can come later. |
| Player start | **One starting character: John Techno** (Logan, batch 75), who replaces John Oligarch (7.3). No character pick and no custom character. |
| Rival starting characters | **All the other premade characters are rivals** (Logan, batch 75): the 14 in 7.3.1 to 7.3.3. They vary in range and background: some start with massive wealth and a burden, some are well connected but not wealthy, some are average people with really good stats. |
| Full characters | The number of full characters is set at game start, **200 by default** ([1-corporate-core.md](1-corporate-core.md) 1.1.0). |
| Rival field | 30 or more dynasties in the world, all fully original. A mix of old money, new tech money, state-linked families and criminal money. |
| Dynasty places | Each dynasty has an **Origin city** and a **Center of Power**. Members can live anywhere. |
| Center of Power | The hub where the dynasty holds the most influence, so it moves as the dynasty grows. Influence is money, power and prestige: money is the asset base, and power and prestige modify it (7.5). |
| Rise and fall | AI founders rise into new dynasties during play, and dead dynasties drop out. |
| History | Follows the real AI boom, inside the alternate history in 7.2.0, with more and more fantastical things happening as the years pass. Real events happen on schedule by default, and players can change them. In **2030 on average a crisis hits and the bubble pops** (the year varies by a few years with RNG and events; [8-quest-lines.md](8-quest-lines.md) 8.5); the game continues into a post-crash era with new rules. |
| Alternate history (Logan, 2026-10-17) | In the game world the **dot-com crash, 9/11, the 2008 financial crisis and COVID never happened**. Everything else is the same, except that the **US won its wars in the Middle East far more decisively** and is in a much better position, both financially and in the security of its resources (7.2.0). |
| Opening quest | **Buying a desktop computer** on the phone (Logan, batch 76; 7.6). It gives John his first compute. |
| LLM tip | A tip names the company that will make the first LLM breakthrough. The tip is always correct, and the tipped lab is different each game. It arrives on the new desktop (Logan, batch 77; 7.6). |
| Quests and events | Quests are tracked goal trees with branches and rolls. Events are single pop-ups that can start a quest. |
| Succession | On death the player picks a successor from the eligible list ([1-corporate-core.md](1-corporate-core.md) 1.11.0). |
| Game end | The game ends when no eligible successor is left, or at an optional end date. |

## 7.2.0 Alternate history (Logan, 2026-10-17)

Four things **never happened** in the game world: the **dot-com crash** (2000 to 2002), **9/11** (2001), the **2008 financial crisis**, and **COVID** (2020 to 2022). Everything else is the same, except that the **US won its wars in the Middle East much more decisively**, and is now in a much better economic position, both financially and with more security in its resources.

What follows from that, in January 2020 **(A)**:

| Area | Real 2020 | Game world 2020 |
|---|---|---|
| Tech | Scarred by the 2000 crash; big tech grew from the survivors | No crash ever: tech giants are older, bigger and richer, investors have never seen a tech bust, and valuations and VC funding run hotter. The 2030 AI crash is the first great tech crash, so it hits harder (8.4) |
| Banking | Bailouts, stricter rules after 2008, a decade of near-zero rates | No crisis, no bailouts and no post-crisis rules: banks are bigger and more leveraged, US regulator strictness is 1 point lower (3.10), and households carry more debt. Rates never went to zero: the US policy rate is about **3%** at start **(T)** |
| Housing | Recovered from the 2008 crash | Never crashed: a long boom, so many hubs start in the Peak phase of the property cycle (2.16.5) |
| Pandemic | COVID lockdowns begin | **No pandemic**: no vaccine mandates, no stimulus wave, no 2021 inflation spike, no remote-work shift. Offices are full (commercial pools start at 95% occupancy) |
| Supply chains | COVID chip shortage | No pandemic chip shortage; chips are tight only from normal demand |
| Security | Post-9/11 security state; long wars | No 9/11, so no post-9/11 security state at home. The Iraq war still happened: **the vice president and the CIA made up claims that Iraq had nukes** (Logan), and the US invaded anyway. It won quickly and cleanly, and Iraq became a stable US ally |
| US position | High debt; energy imports falling with shale | US federal debt about 60% of GDP instead of 120% **(T)**; a stronger dollar; Iraq is a stable US-aligned oil exporter and Gulf supply is more secure, so Hormuz risk starts at Calm and US energy security is high |
| Gulf and oil | Volatile | Oil supply is steadier and cheaper (oil price index starts at 90 **(T)**); cartel cuts ([10-industry-economy.md](10-industry-economy.md) 10.6) are weaker while US influence in the Gulf holds |

**Russia and Ukraine (Logan).** Russia invaded Ukraine much earlier, in **2005**, and the war never ended. By 2020 it is a long **drone-warfare stalemate** along a fortified front. Consequences **(A)**: Russia has been under heavy sanctions since 2005, Europe weaned itself off Russian gas long ago (pipeline gas to Europe is already cut at start), Russia sells oil at a discount through grey fleets, both sides and their backers buy drones in huge numbers (Robotics and drones and Aerospace and defense demand is higher, 10.3), and the Black Sea is at Attacks risk (2.4.2).

**Africa (Logan, batch 36).** Africa is a hell hole in this game world: weak states, coups, militias, piracy in the Gulf of Guinea and heavy capital flight **(A)**. African countries start with low stability and high risk, and most capital leaves the continent. **Lagos** is the exception that can rise: if it is developed (by the rival Tolu Balogun or by the player investing there), it becomes the clear-cut hub of Africa and draws the continent's money, talent and flight capital.

The chip export controls and the AI boom still happen on schedule (7.7).

## 7.2 The world in January 2020

The detailed files were written with present-day starting values. At a January 2020 start, these differ:

| Item | At start (January 2020) | Arrives later through the timeline (7.7) |
|---|---|---|
| Chip export controls | Entity list bans on a few Chinese firms only; lithography system bans on EUV to China already in force | Broad US controls on advanced chips and AI server nodes (October 2022), widened yearly; Netherlands and Japan join (2023) |
| Russia | At war in Ukraine since 2005, a drone stalemate; heavy sanctions since 2005 (7.2.0) | Drone escalations and ceasefire events, rolled through the timeline |
| Compute | Generation 1 accelerators; AI is a research field, not a market | Gen 2 (2024), Gen 3 (2026), Gen 4 (2028), Gen 5 (2030) on the 24-month cycle in [6-technocapital.md](6-technocapital.md) 6.4.1 |
| Models | No commercial chat models | The tipped lab's chatbot launch (November 2022) starts the boom |
| Interest rates | About 3% in the US: rates never went to zero (7.2.0) | Small moves only; no 2022 energy shock |
| Pandemic | None: COVID never happened (7.2.0) | n/a |
| Ideology mix | Starting shares in [5-ideology.md](5-ideology.md) 5.4 are for 2020 | Accelerationist and Neo-Luddite shares grow with the boom |

Hub populations and GDP in [2-map-and-influence.md](2-map-and-influence.md) stand as January 2020 values **(A)**.

## 7.3 The starting character and the rival starting characters

**The player plays John Techno** (Logan, batch 75), in Edmonton (7.3.0). The other fourteen premade characters, in three regional groups, start as **rival dynasty heads** run by the AI (7.3.4). Names marked † were filled in by Claude and are open to edit; the rest are Logan's.

**Profiles.** Each premade character has one of three starting profiles:
- **Rich, with a burden**: massive wealth and a secret or burden that soon comes due.
- **Connected**: strong contacts and influence, not much money.
- **Talented**: average circumstances and really good stats.

### 7.3.0 John Techno (the player)

| Character | Location | Profile | Premise | Signature play |
|---|---|---|---|---|
| **John Techno** | Edmonton, Alberta | Talented | A former **union man on Canada's oil fields** (Logan, batch 76). Liberal governments forced his company into new ownership and broke up the union, but the word was *"If there's one man you keep, it's John Techno."* His incredible stats, the best of any character in the game, made him a local legend. At **22** he is the **Chief Operating Officer of the smallest oil company in the game** | Rise from COO to controller; quest line "The One Man You Keep" ([8-quest-lines.md](8-quest-lines.md) 8.3) |

**Starting position (Logan, batch 76).** $100,000 cash, a salary of $1M a year plus stock options, and a one-year paid-off lease on executive housing in Edmonton. He is COO of a listed micro-cap owned by **Terry Tippacanoe** (7.3.5); his options and their yearly review are in 8.3 (batch 77). His skills and traits are in 8.3 **(A)**.

### 7.3.1 Rivals, group one: North and South America

| # | Character | Location | Profile | Premise | Signature play |
|---|---|---|---|---|---|
| 1 | **Antone Provolone** | New York | Connected | A finance bro by day and a wise guy by night. Well connected either way: he always knows a guy who knows a guy, and he has worked his way into DC | Finance, crime and politics through his contact network |
| 2 | **Ricky Feng** | San Francisco (Bay Area) | Rich, with a burden | A hacker who barely got out of a hack gone bad alive. He holds a very large, diverse crypto wallet he can no longer get into. Starts with a very large amount of compute in Asia and a large bot farm SaaS in the Philippines and Thailand | Get back into the wallet |
| 3 | **Dot Percy** | Los Angeles | Rich, with a burden | As Dot worked up the courage to ask for a divorce, she got a call: her husband was dead. The nation mourns the premature end of Hollywood's greatest power couple, and Dot is left with five talentless children | A PR campaign: manage a large dynasty and every child's career so they do not start sabotaging each other. One random child per playthrough is actually very talented |
| 5 | **Pablo Segundo** | Medellín | Talented | Narco fascism and the rise of Pablo Segundo | Build a narco-populist movement into political power |

### 7.3.2 Rivals, group two: Europe, Africa and the Middle East

| # | Character | Location | Profile | Premise | Signature play |
|---|---|---|---|---|---|
| 6 | **Tolu Balogun** | Lagos, Nigeria | Rich, with a burden | Oil money and corruption in a developing country | Corruption, oil and third-world development |
| 7 | **Pieter Von Floop** † | Eindhoven, Netherlands | Rich, with a burden | The easy start. Sole heir to a lithography machine empire. The monopoly is easy to run, and he has been a boy scout his entire life. He is 24, and his father's health is starting to turn. The family trust is swelling, but he worries he may crack holding together what his father built | Run the world's lithography monopoly ([6-technocapital.md](6-technocapital.md) 6.7) |
| 8 | **Samir Haddad** † | Dubai | Talented | A former elite soldier who flew drones in the war, now in the Permanent Underclass, slaving away on another megaproject in the desert. A fixer offers him a battered drone on credit, for a favor | A drone operations playthrough: grow from one drone to a fleet (Logan, batch 72) |
| 9 | **Margaux Valcourt** † | Paris | Rich | A French redheaded woman who inherits a lot of money from her uncle. The Liberal, open-ended playthrough: she can become anything | Open sandbox |
| 10 | **Viktor Sokolov** † | Moscow | Connected | A Putin-style spy dynasty: an intelligence officer building a family network inside the state **(A)** | Spycraft, state capture, sanctions |

### 7.3.3 Rivals, group three: Asia and Oceania

| # | Character | Location | Profile | Premise | Signature play |
|---|---|---|---|---|---|
| 11 | **Garrett Kroll** † | Pacific Ocean, off the coast of New Zealand | Rich, with a burden | A crazy automotive billionaire trying to start his own island colony by crashing boats into the side of Antarctica | A very hard politics run to protect his sovereign rights (Sovereigntists, [5-ideology.md](5-ideology.md)) |
| 12 | **Fang Xiaoyu** | Shenzhen | Talented | Tech and finance; a woman (batch 37) | Run businesses across Hong Kong and Shenzhen |
| 13 | **Qiao Lin** | Beijing | Connected | Party-state family; a woman (batch 36) | The China political run |
| 14 | **Ananya Hegde** † | Bengaluru | Talented **(A)** | A sleeper overpowered investor | Win India good chip deals so it can build lots of data centers early and run them at lower cost: scale the AI industries as an investor |
| 15 | **Yuna Sakamoto** † | Tokyo-Yokohama, Japan | Connected | A young Japanese influencer with a massive following who now has to pivot her appeal to an incredibly politicized and extremist Japan | Choose a politics and drive Japan and Korea |

### 7.3.4 The rival starting characters

**All fifteen are active rivals** (the fourteen above plus Terry Tippacanoe, 7.3.5) (Logan, batch 75) from day one (batch 76). Each heads a dynasty run by the AI and pursues the signature play in its row. They have **no quest lines** (Logan, batch 76): like every AI character, they act on their traits and premise, and the player meets them through the news, intel, deals and conflict. Natural rivalries still matter: each names two or three others it clashes with first (for example Antone Provolone and Pablo Segundo over the drug and money trade, Pieter Von Floop and Fang Xiaoyu over lithography access, Qiao Lin and Viktor Sokolov over sanctions-era deals) **(A)**.

**Rivals' starting position (T).** Wealth ranges widely by profile: Rich characters start with $1B to $10B in trusts and holdings (Ricky Feng's is mostly locked in the wallet), Connected characters with $1M to $50M, Talented characters with under $1M. Every premade character starts with a family suited to their premise, for example Dot Percy's five children and Pieter Von Floop's ailing father.

### 7.3.5 Terry Tippacanoe (Logan, batch 77)

| Character | Location | Profile | Premise | Signature play |
|---|---|---|---|---|
| **Terry Tippacanoe** | Edmonton, Alberta **(A)** | Rich **(A)** | A **Native financier of questionable origins**. He owns a **very popular casino** and, as the union broke up, bought out the smallest oil company in the game: **John Techno's**. He is the new owner and John's first rival | Grow money through the casino and deals; scheme against Liberals |

- **Anti-Liberal edge (Logan).** Terry has a **buff against all Liberal characters in his schemes**: +15% success and -25% discovery when the target's ideology is Liberals ([5-ideology.md](5-ideology.md)) **(T)**.
- **The casino** is a business unit in the Gambling industry ([10-industry-economy.md](10-industry-economy.md) 10.3), the source of his cash and his pull in Edmonton **(A)**.
- **Questionable origins.** His past is held as one or more **secrets** (1.1.8.2) that intel, hacking or a news investigation can uncover **(A)**.
- **John's choice (Logan).** John can **befriend Terry** or **work in the shadows on his downfall** ([8-quest-lines.md](8-quest-lines.md) 8.3, Arc 1).

## 7.4 Rival dynasties

| Item | Rule |
|---|---|
| Total at start | 32 dynasties **(T)**: John Techno's family, the 15 rival starting characters' families (7.3.4, 7.3.5) and 16 more run only by the AI. |
| Money mix | About 30% old money, 30% new tech money, 25% state-linked, 15% criminal **(T)** |
| Placement | At least one dynasty in every hub with Size L or larger; Mega hubs get two or three **(T)** |
| Originality | Fully original families. No parodies of real families or founders. |
| Rival rotation | A roster of characters added to every game with preset AI. They can be directed at the player or at other characters to mess with them, by the game's director AI and by characters who hire them, the player included (Logan). |
| New dynasties | An AI-run company founder whose company reaches Corporation rank founds a new dynasty. At most one new dynasty per hub per 5 years **(T)**. |
| Extinction | A dynasty with no living members, or with no trust and no holdings for 24 months, drops out. Its assets go to successors, creditors or the state. |

## 7.5 Origin city, Center of Power and influence

- **Origin city** is fixed. Members born there get the origin bonus in [2-map-and-influence.md](2-map-and-influence.md) 2.5.6.
- **Influence is money, power and prestige.** Money is the asset base (2.5.2). Power and prestige multiply it:
  - **Power** = political offices held, controlled company boards and government contracts (the political office modifier in 2.5.6 plus control of local media and utilities).
  - **Prestige** = renown and reputation ([1-corporate-core.md](1-corporate-core.md) 1.11.4 and the reputation modifier in 2.5.6).
- **Center of Power** is the hub where the dynasty's final influence share is highest. It is checked monthly and moves only when another hub leads for 3 months in a row **(T)**. The Center of Power gives +10% influence there and halves travel time for family members heading home **(T)**.

## 7.6 The opening quest: "The Desktop" (Logan, batch 76)

The first quest of the game is **buying a desktop computer**, on John's phone: he downloads the marketplace app, orders the computer, and it is delivered a few hours later. The reward is **1 base compute** and **1 data compute** (cloud data that comes free with the computer). Steps and rolls: [8-quest-lines.md](8-quest-lines.md) 8.2.1.

- There is **no travel lock**: John can fly from the start (Logan, batch 77).
- **The LLM tip** arrives on the new desktop once it is set up: it names the company that will make the first LLM breakthrough and explains how the AI system will work before the boom. The tip is always correct (Logan, batch 77).
- **The tipped lab is different each game.** At game start one lab is drawn from a pool of five fictional AI labs (for example a Bay Area nonprofit lab, a big tech research division, a London lab, a Beijing lab and a Toronto lab) **(A)**. The drawn lab makes the November 2022 breakthrough unless players change history.

## 7.7 Timeline 2020 to 2030

Real events happen on schedule by default. Each one is an event or quest that players can change. From 2025 onward the events grow more fantastical. Company names are fictional.

| Date | Event | Game effect |
|---|---|---|
| Jan 2020 | Scenario start (no pandemic, 7.2.0) | The opening quest "The Desktop" |
| 2020 to 2021 | No pandemic: offices full, rates near 3%, a long boom **(A)** | VC funding hot; property at its Peak (2.16.5) |
| Nov 2020 | US elections **(A)** | An election event ([4-politics.md](4-politics.md)) |
| 2021 | A crypto and SPAC mania **(A)** | Random boom coins in the gambling tab ([9-gambling.md](9-gambling.md)); IPO frenzy |
| 2020 onward | The Ukraine drone war grinds on (since 2005) | Drone demand; Black Sea risk; ceasefire or escalation events |
| 2022 to 2023 | Rates still steady near 3% | VC funding stays hot |
| Oct 2022 | Broad US chip export controls | Export controls in [6-technocapital.md](6-technocapital.md) 6.9 switch on |
| Nov 2022 | The tipped lab launches its chatbot | The AI boom starts; compute demand surges |
| 2023 | The GPU gold rush | Compute spot prices spike |
| 2024 | Gen 2 accelerators; power deals for data centers; nuclear restarts | Power becomes the bottleneck |
| 2025 | A cheap Chinese open model shocks the market | Beijing and Shenzhen get a boost; a market wobble |
| 2026 to 2027 | Gen 3; gigaclusters; AI agents run whole departments | Fantastical events begin |
| 2028 to 2029 | Gen 4; humanoid robots in factories | More fantastical events; peak valuations |
| 2030 | **The crisis: the bubble pops** | A crash in AI valuations; the post-crash era begins |

## 7.8 New places

New hubs and sites for the starting characters **(A)**:

| Place | Country | Size | Pop (M) | Districts | Specialties |
|---|---|---|---|---|---|
| Medellín | Colombia | L | 4 | F1 I2 R4 S3 T1 X1 | Textiles, coffee, flowers, the informal economy, cartel money laundering, a growing tech scene |
| Edmonton | Canada (Alberta) | M | 1.4 | F1 I3 R3 S1 X2 | Oil sands and oil field services, pipelines, the Alberta provincial government; John Techno's home (replaces Calgary, batches 76 and 77) |
| Sydney | Australia (New South Wales) | XL | 5.4 | F4 I2 P2 R6 S1 T2 | Banking, pension funds, property, media, mining company headquarters |
| Kroll's colony | None (claimed) | Site | 0 | P1 R1 | A claimed sea and ice site between New Zealand and Antarctica. Starts as a few beached ships; can grow into a hub if the claim survives |

Colombia moves out of the Andean minor group and becomes the 31st major country so that Medellín can be a hub **(A)**.

## 7.9 Changes to other files

- [2-map-and-influence.md](2-map-and-influence.md) 2.3.3: Medellín, Sydney and Edmonton added; there are now 44 hubs and 31 major countries. Kroll's colony is a special site.
- The game has no stages; founding and young-company rules are in [1-corporate-core.md](1-corporate-core.md) 1.6, and politics by company rank in [4-politics.md](4-politics.md) 4.28.
- [10-events.md](../10-events.md): add the quest system.
- [13-open-questions.md](../13-open-questions.md): the decided list holds these rules.

## 7.10 Assumptions and open items

2. Hub and economy values in file 2 stand as January 2020 values.
3. Medellín, Edmonton (replacing Calgary, confirmed batch 77) and Sydney hub data in 7.8, Kroll's colony as a special site, and Colombia as a major country.
4. 32 dynasties at start, with the money mix and placement in 7.4.
5. Starting wealth ranges by profile in 7.3.
6. The Center of Power rule: 3-month lead, +10% influence.
7. No travel lock, and the LLM tip arriving on the desktop (7.6).
12. The alternate-history consequences in 7.2.0, including the effects of the Ukraine war since 2005.
8. Names marked † and profiles marked **(A)** in 7.3 (Tolu Balogun, Fang Xiaoyu and Qiao Lin confirmed in batch 35).
9. The natural-rivals rule (7.3.4).
14. Terry Tippacanoe's location, profile, buff size, casino and secrets (7.3.5).
15. The 2020 to 2021 timeline rows (7.7).
11. The pool of five candidate labs for the tip.
