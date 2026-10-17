# 7. Starting world: detailed design

_Status: draft v0.4 (2026-10-17). Built from Logan's answers in the design Q&A. Sets the scenario, the 15 starting characters, the rival field, the opening quest and the timeline to 2030. Builds on [1-corporate-core.md](1-corporate-core.md) (characters, trusts, succession), [2-map-influence-economy.md](2-map-influence-economy.md) (hubs, influence), [5-ideology.md](5-ideology.md) and [6-technocapital.md](6-technocapital.md). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 7.10.

---

## 7.1 Decided by Logan

| Topic | Decision |
|---|---|
| Game type | A **4X game**. There are **no stages**. Play is shaped by **scenarios**. |
| Scenarios | One scenario, starting in **January 2022**. More scenarios can come later. |
| Player start | Pick one of **15 premade starting characters** in three groups (7.3). No custom character. |
| Starting characters | They vary in range and background. Some start with massive wealth but a secret or burden they will soon have to bear. Some are well connected but not very wealthy. Some are average people with really good stats. |
| Full characters | The number of full characters is set at game start, **200 by default** ([1-corporate-core.md](1-corporate-core.md) 1.1.0). |
| Rival field | 30 or more dynasties in the world, all fully original. A mix of old money, new tech money, state-linked families and criminal money. |
| Dynasty places | Each dynasty has an **Origin city** and a **Center of Power**. Members can live anywhere. |
| Center of Power | The hub where the dynasty holds the most influence, so it moves as the dynasty grows. Influence is money, power and prestige: money is the asset base, and power and prestige modify it (7.5). |
| Rise and fall | AI founders rise into new dynasties during play, and dead dynasties drop out. |
| History | Follows the real AI boom, with more and more fantastical things happening as the years pass. Real events happen on schedule by default, and players can change them. In **2030 a crisis hits and the bubble pops**; the game continues into a post-crash era with new rules. |
| Opening quest | Get the COVID vaccine or a doctor's note excusing you. It teaches the quest system and unlocks travel (7.6). |
| LLM tip | Finishing the opening quest gives a tip naming the company that will make the first LLM breakthrough. The tip is always correct, and the tipped lab is different each game. |
| Quests and events | Quests are tracked goal trees with branches and rolls. Events are single pop-ups that can start a quest. |
| Travel lock | Until the opening quest is finished, the player can go anywhere, but only by car or train. |
| Succession | On death the player picks a successor from the eligible list ([1-corporate-core.md](1-corporate-core.md) 1.11.0). |
| Game end | The game ends when no eligible successor is left, or at an optional end date. |

## 7.2 The world in January 2022

The detailed files were written with present-day starting values. At a January 2022 start, these differ:

| Item | At start (January 2022) | Arrives later through the timeline (7.7) |
|---|---|---|
| Chip export controls | Entity list bans on a few Chinese firms only; lithography system bans on EUV to China already in force | Broad US controls on advanced chips and AI server nodes (October 2022), widened yearly; Netherlands and Japan join (2023) |
| Russia | Managed Float, mild sanctions from 2014; troops massing on the Ukrainian border | Invasion of Ukraine and heavy sanctions (February 2022) |
| Compute | Generation 1 accelerators; AI is a research field, not a market | Gen 2 (2024), Gen 3 (2026), Gen 4 (2028), Gen 5 (2030) on the 24-month cycle in [6-technocapital.md](6-technocapital.md) 6.4.1 |
| Models | No commercial chat models | The tipped lab's chatbot launch (November 2022) starts the boom |
| Interest rates | Near zero; cheap capital everywhere | Rate shock (2022 to 2023) |
| Pandemic | Mostly over; vaccine mandates and travel rules for the unvaccinated still in place | Restrictions fade through 2022 |
| Ideology mix | Starting shares in [5-ideology.md](5-ideology.md) 5.4 are for 2022 | Accelerationist and Neo-Luddite shares grow with the boom |

Hub populations, GDP and facility levels in [2-map-influence-economy.md](2-map-influence-economy.md) stand as January 2022 values **(A)**.

## 7.3 Starting characters

Fifteen premade characters in three groups of five. Names marked † were filled in by Claude and are open to edit; the rest are Logan's.

**Profiles.** Each character has one of three starting profiles:
- **Rich, with a burden**: massive wealth and a secret or burden that soon comes due.
- **Connected**: strong contacts and influence, not much money.
- **Talented**: average circumstances and really good stats.

### 7.3.1 Group one: North and South America

| # | Character | Location | Profile | Premise | Signature play |
|---|---|---|---|---|---|
| 1 | **Antone Provolone** | New York | Connected | A finance bro by day and a wise guy by night. Well connected either way: he always knows a guy who knows a guy, and he has worked his way into DC | Finance, crime and politics through his contact network |
| 2 | **Ricky Feng** | San Francisco (Bay Area) | Rich, with a burden | A hacker who barely got out of a hack gone bad alive. He holds a very large, diverse crypto wallet he can no longer get into. Starts with a very large amount of compute and a large bot farm in the Philippines and Thailand | Quest: recover the key to the wallet |
| 3 | **Dot Percy** | Los Angeles | Rich, with a burden | As Dot worked up the courage to ask for a divorce, she got a call: her husband was dead. The nation mourns the premature end of Hollywood's greatest power couple, and Dot is left with five talentless children | A PR campaign: manage a large dynasty and every child's career so they do not start sabotaging each other. One random child per playthrough is actually very talented |
| 4 | **John Oligarch** | Calgary | Talented | A 21-year-old oil man with the best stats of any character in the game, bar none. A member of the PMC (professional-managerial class) close to falling into the **Permanent Underclass** | Climb from nothing on stats alone |
| 5 | **Pablo Segundo** | Medellín | Talented | Narco fascism and the rise of Pablo Segundo | Build a narco-populist movement into political power |

### 7.3.2 Group two: Europe, Africa and the Middle East

| # | Character | Location | Profile | Premise | Signature play |
|---|---|---|---|---|---|
| 6 | **Tolu Balogun** † | Lagos, Nigeria | Rich, with a burden **(A)** | Oil money and corruption in a developing country | Corruption, oil and third-world development |
| 7 | **Pieter van Aalst** † | Eindhoven, Netherlands | Rich, with a burden | The easy start. Sole heir to a lithography machine empire. The monopoly is easy to run, and he has been a boy scout his entire life. He is 24, and his father's health is starting to turn. The family trust is swelling, but he worries he may crack holding together what his father built | Run the world's lithography monopoly ([6-technocapital.md](6-technocapital.md) 6.7) |
| 8 | **Samir Haddad** † | Dubai | Talented | A former elite soldier, now in the Permanent Underclass, slaving away on another megaproject in the desert. Then a stranger recognized his implants, said he could get him better ones, and if he did the stranger a favor the first one would be free | An assassin playthrough: slowly become a cyborg |
| 9 | **Margaux Valcourt** † | Paris | Rich | A French redheaded woman who inherits a lot of money from her uncle. The Liberal, open-ended playthrough: she can become anything | Open sandbox |
| 10 | **Viktor Sokolov** † | Moscow | Connected | A Putin-style spy dynasty: an intelligence officer building a family network inside the state **(A)** | Spycraft, state capture, sanctions |

### 7.3.3 Group three: Asia and Oceania

| # | Character | Location | Profile | Premise | Signature play |
|---|---|---|---|---|---|
| 11 | **Garrett Kroll** † | Pacific Ocean, off the coast of New Zealand | Rich, with a burden | A crazy automotive billionaire trying to start his own island colony by crashing boats into the side of Antarctica | A very hard politics run to protect his sovereign rights (Sovereigntists, [5-ideology.md](5-ideology.md)) |
| 12 | **Fang Xiaoyu** † | Shenzhen | Talented **(A)** | Tech and finance | Run businesses across Hong Kong and Shenzhen |
| 13 | **Qiao Lin** † | Beijing | Connected **(A)** | Party-state family | The China political run |
| 14 | **Ananya Hegde** † | Bengaluru | Talented **(A)** | A sleeper overpowered investor | Win India good chip deals so it can build lots of data centers early and run them at lower cost: scale the whole AI supply chain as an investor |
| 15 | **Yuna Sakamoto** † | Tokyo-Yokohama, Japan | Connected | A young Japanese influencer with a massive following who now has to pivot her appeal to an incredibly politicized and extremist Japan | Choose a politics and drive Japan and Korea |

### 7.3.4 Unpicked characters

Depending on who the player picks, some of the other 14 starting characters are **active rivals** and some are **passive** (Logan). Proposed rule **(A)**: each starting character names two or three natural rivals (for example Antone Provolone and Pablo Segundo over the drug and money trade, Pieter van Aalst and Fang Xiaoyu over lithography access, Qiao Lin and Viktor Sokolov over sanctions-era deals). Natural rivals of the player's character are run as active AI rivals; the rest stay passive: they live, age and keep their holdings, but do not pursue their signature play unless something pulls them in.

**Starting position (T).** Wealth ranges widely by profile: Rich characters start with $1B to $10B in trusts and holdings (Ricky Feng's is mostly locked in the wallet), Connected characters with $1M to $50M, Talented characters with under $1M. Every character starts with a family suited to their premise, for example Dot Percy's five children and Pieter van Aalst's ailing father.

## 7.4 Rival dynasties

| Item | Rule |
|---|---|
| Total at start | 32 dynasties **(T)**: the 15 starting characters' families plus 17 run only by the AI. Depending on who the player picks, some of the other starting characters are active rivals and some are passive (7.3.4). |
| Money mix | About 30% old money, 30% new tech money, 25% state-linked, 15% criminal **(T)** |
| Placement | At least one dynasty in every hub with Size L or larger; Mega hubs get two or three **(T)** |
| Originality | Fully original families. No parodies of real families or founders. |
| New dynasties | An AI-run company founder whose company reaches Corporation rank founds a new dynasty. At most one new dynasty per hub per 5 years **(T)**. |
| Extinction | A dynasty with no living members, or with no trust and no holdings for 24 months, drops out. Its assets go to successors, creditors or the state. |

## 7.5 Origin city, Center of Power and influence

- **Origin city** is fixed. Members born there get the origin bonus in [2-map-influence-economy.md](2-map-influence-economy.md) 2.5.6.
- **Influence is money, power and prestige.** Money is the asset base (2.5.2). Power and prestige multiply it:
  - **Power** = political offices held, controlled company boards and government contracts (the political office modifier in 2.5.6 plus control of local media and utilities).
  - **Prestige** = renown and reputation ([1-corporate-core.md](1-corporate-core.md) 1.11.4 and the reputation modifier in 2.5.6).
- **Center of Power** is the hub where the dynasty's final influence share is highest. It is checked monthly and moves only when another hub leads for 3 months in a row **(T)**. The Center of Power gives +10% influence there and halves travel time for family members heading home **(T)**.

## 7.6 The opening quest: "The Shot"

The first quest of every game. It teaches the quest system: a tree of steps, each with choices and rolls, tracked in the quest log.

**Before completion:** the character can go anywhere, but only by car or train. Flights, including private jets, are locked.

**Branches:**

| Branch | Steps | Difficulty |
|---|---|---|
| **Get vaccinated** | Book an appointment and get the shot | Easy. No rolls except a small chance of a sick day. |
| **Doctor's note** | Find a doctor willing to write one: the family doctor, a friend's doctor, or a paid clinic | Varies by character and rolls. Diplomacy or Intrigue rolls; traits such as Honest or Paranoid change the odds; failure can mean a scandal or a forged note that is later discovered. |

The exact steps and rolls are to be written in the events and quests design.

**On completion:**
- Travel unlocks, including flights and private jets.
- Other parts of the game unlock (the Found Company action, wider schemes) **(A)**.
- A message arrives with the **tip**: it names the company that will make the first LLM breakthrough and explains how the AI system will work before the boom. The tip is always correct.
- **The tipped lab is different each game.** At game start one lab is drawn from a pool of five fictional AI labs (for example a Bay Area nonprofit lab, a big tech research division, a London lab, a Beijing lab and a Toronto lab) **(A)**. The drawn lab makes the November 2022 breakthrough unless players change history.

## 7.7 Timeline 2022 to 2030

Real events happen on schedule by default. Each one is an event or quest that players can change. From 2025 onward the events grow more fantastical. Company names are fictional.

| Date | Event | Game effect |
|---|---|---|
| Jan 2022 | Scenario start; chip shortage; vaccine mandates | Car and electronics output limited; the opening quest |
| Feb 2022 | Russia invades Ukraine | Sanctions on Russia; energy price shock |
| 2022 to 2023 | Rate shock | Cheap capital ends; VC funding rounds get harder |
| Oct 2022 | Broad US chip export controls | Export controls in [6-technocapital.md](6-technocapital.md) 6.9 switch on |
| Nov 2022 | The tipped lab launches its chatbot | The AI boom starts; compute demand surges |
| 2023 | The GPU gold rush | Compute spot prices spike |
| 2024 | Gen 2 accelerators; power deals for data centers; nuclear restarts | Power becomes the bottleneck |
| 2025 | A cheap Chinese open model shocks the market | Beijing and Shenzhen get a boost; a market wobble |
| 2026 to 2027 | Gen 3; gigaclusters; AI agents run whole departments | Fantastical events begin |
| 2028 to 2029 | Gen 4; humanoid robots in factories; the first mind uploads | More fantastical events; peak valuations |
| 2030 | **The crisis: the bubble pops** | A crash in AI valuations; the post-crash era begins |

## 7.8 New places

New hubs and sites for the starting characters **(A)**:

| Place | Country | Size | Pop (M) | Districts | Specialties |
|---|---|---|---|---|---|
| Medellín | Colombia | L | 4 | F1 I2 R4 S3 T1 X1 | Textiles, coffee, flowers, the informal economy, cartel money laundering, a growing tech scene |
| Calgary | Canada (Alberta) | M | 1.6 | F2 I2 R3 S1 X2 | Oil sands, oil company headquarters, pipelines, ranching |
| Sydney | Australia (New South Wales) | XL | 5.4 | F4 I2 P2 R6 S1 T2 | Banking, pension funds, property, media, mining company headquarters |
| Kroll's colony | None (claimed) | Site | 0 | P1 R1 | A claimed sea and ice site between New Zealand and Antarctica. Starts as a few beached ships; can grow into a hub if the claim survives |

Colombia moves out of the Andean minor group and becomes the 31st major country so that Medellín can be a hub **(A)**.

## 7.9 Changes to other files

- [2-map-influence-economy.md](2-map-influence-economy.md) 2.3.3: Medellín, Sydney and Calgary added; there are now 44 hubs and 31 major countries. Kroll's colony is a special site.
- [14-game-stages.md](../14-game-stages.md) and [stages/2-the-founder.md](../stages/2-the-founder.md): retired. The game has no stages; the mechanics in them stay as systems.
- [10-events.md](../10-events.md): add the quest system.
- [13-open-questions.md](../13-open-questions.md): the decided list holds these rules.

## 7.10 Assumptions and open items

2. Hub and economy values in file 2 stand as January 2022 values.
3. Medellín, Calgary and Sydney hub data in 7.8, Kroll's colony as a special site, and Colombia as a major country.
4. 32 dynasties at start, with the money mix and placement in 7.4.
5. Starting wealth ranges by profile in 7.3.
6. The Center of Power rule: 3-month lead, +10% influence.
7. Finishing "The Shot" unlocks the Found Company action and wider schemes.
8. Names marked † and profiles marked **(A)** in 7.3.
9. The natural-rivals rule for unpicked characters (7.3.4).
11. The pool of five candidate labs for the tip.
