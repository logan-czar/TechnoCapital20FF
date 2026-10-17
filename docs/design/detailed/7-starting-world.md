# 7. Starting world: detailed design

_Status: draft v0.2 (2026-10-16). Built from Logan's answers in the design Q&A. Sets the start date, the playable dynasties, the rival field, the opening quest and the 2021 to 2030 timeline. Builds on [1-corporate-core.md](1-corporate-core.md) (dynasties, trusts), [2-map-influence-economy.md](2-map-influence-economy.md) (hubs, influence), [5-ideology.md](5-ideology.md) and [6-technocapital.md](6-technocapital.md). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 7.10.

---

## 7.1 Decided by Logan

| Topic | Decision |
|---|---|
| Start date | **January 2021**. The pandemic is mostly over. |
| Player start | Pick one of the **premade** dynasties. No custom dynasty. Every game starts at Stage 1, The Heir. |
| Playable dynasties | **11**: New York, Los Angeles, San Francisco, Medellín, Lagos, Sydney, Beijing, Shenzhen, Bengaluru, Paris, Moscow (7.3). |
| Rival field | 30 or more dynasties in the world, all fully original. A mix of old money, new tech money, state-linked families and criminal money. |
| Dynasty places | Each dynasty has an **Origin city** and a **Center of Power**. Members can live anywhere. |
| Center of Power | The hub where the dynasty holds the most influence, so it moves as the dynasty grows. Influence is money, power and prestige: money is the asset base, and power and prestige modify it (7.5). |
| Rise and fall | AI founders rise into new dynasties during play, and dead dynasties drop out. |
| History | Follows the real AI boom, with more and more fantastical things happening as the years pass. Real events happen on schedule by default, and players can change them. In **2030 a crisis hits and the bubble pops**; the game continues into a post-crash era with new rules. |
| Opening quest | Get the COVID vaccine or a doctor's note excusing you. It teaches the quest system and unlocks travel (7.6). |
| LLM tip | Finishing the opening quest gives a tip naming the company that will make the first LLM breakthrough. The tip is always correct. |
| Quests and events | Quests are tracked goal trees with branches and rolls. Events are single pop-ups that can start a quest. |
| Travel lock | Until the opening quest is finished, the player can go anywhere, but only by car or train. |

## 7.2 The world in January 2021

The detailed files were written with present-day starting values. At a January 2021 start, these differ:

| Item | At start (January 2021) | Arrives later through the timeline (7.7) |
|---|---|---|
| Chip export controls | Entity list bans on a few Chinese firms only; lithography system bans on EUV to China already in force | Broad US controls on advanced chips and AI server nodes (October 2022), widened yearly; Netherlands and Japan join (2023) |
| Russia | Managed Float, mild sanctions from 2014 | Invasion of Ukraine and heavy sanctions (February 2022); the Moscow dynasty's big test |
| Compute | Generation 1 accelerators; AI is a research field, not a market | Gen 2 (2023), Gen 3 (2025), Gen 4 (2027), Gen 5 (2029) on the 24-month cycle in [6-technocapital.md](6-technocapital.md) 6.4.1 |
| Models | No commercial chat models | The tipped lab's chatbot launch (November 2022) starts the boom |
| Interest rates | Near zero; cheap capital everywhere | Rate shock (2022 to 2023) |
| Pandemic | Mostly over; vaccine rollout under way; air travel restricted for the unvaccinated | Restrictions fade through 2021 and 2022 |
| Ideology mix | Starting shares in [5-ideology.md](5-ideology.md) 5.4 are for 2021 | Accelerationist and Neo-Luddite shares grow with the boom |

Hub populations, GDP and facility levels in [2-map-influence-economy.md](2-map-influence-economy.md) stand as January 2021 values **(A)**; the differences from 2021 are small at game scale.

## 7.3 Playable dynasties

Eleven premade dynasties. Names are proposals for Logan to edit (7.3.1).

| # | Origin city | Region | Money type | Identity | Starting Center of Power |
|---|---|---|---|---|---|
| 1 | New York | North America | Old money | Finance and DC insiders: banking, lobbying, political donors | New York |
| 2 | Los Angeles | North America | Old money (culture) | Arts and entertainment family of nepo babies: studios, music, celebrity | Los Angeles-Long Beach |
| 3 | San Francisco (Bay Area) | North America | New tech money | Pure tech, caught in the ideological battle over AI (Accelerationists against Effective Altruists) | Bay Area |
| 4 | Medellín | South America | Criminal money | Narco fascism and the rise of Pablo Segundo | Medellín |
| 5 | Lagos | Africa | Criminal and state money | Oil and corruption | Lagos |
| 6 | Sydney | Oceania | Old money | Mining and property: iron ore royalties, city towers, land banks | Sydney |
| 7 | Beijing | Asia (China) | State-linked | Party-state family with state company and regulator ties | Beijing |
| 8 | Shenzhen | Asia (China) | New tech money | Electronics, drones and EV hardware | Shenzhen-Dongguan |
| 9 | Bengaluru | Asia (India) | New tech money | IT services and software money | Bengaluru |
| 10 | Paris | Europe | Old money | Luxury goods: fashion houses, champagne, jewelry, art | Paris |
| 11 | Moscow | Europe | Criminal money | Cybercrime: ransomware crews, carding markets, crypto laundering, protection from the security services | Moscow |

### 7.3.1 Names and heirs (proposed)

Each dynasty has one **fixed heir** the player plays (Logan). Names are original proposals, open to edit.

| # | Dynasty | Head (player's parent) | Player heir | Heir hook |
|---|---|---|---|---|
| 1 | House Ashcombe (New York) | Charles Ashcombe, 61, bank chairman and party donor | Eleanor Ashcombe, 23, just out of law school | Knows everyone in DC; the family bank sits on bad commercial property |
| 2 | The Marlowes (Los Angeles) | Vivian Marlowe, 58, studio owner and former star | Jesse Marlowe, 21, an actor nobody takes seriously | Fame without respect; the studio is losing to streaming |
| 3 | The Halvorsens (San Francisco) | Erik Halvorsen, 54, serial founder and early cloud investor | Freya Halvorsen, 22, a dropout AI researcher | Torn between Accelerationist and Effective Altruist camps |
| 4 | The Echeverris (Medellín) | Ramiro Echeverri, 57, "legitimate" businessman with a laundering empire | Mateo Echeverri, 24, educated abroad | Must back or fight Pablo Segundo (7.3.2) |
| 5 | The Baloguns (Lagos) | Chief Adebayo Balogun, 66, oil licence holder | Tolu Balogun, 25, a fintech hopeful | Oil money built on contracts the next government may cancel |
| 6 | The Hargraves (Sydney) | Margaret Hargrave, 63, mining royalty heir and developer | Liam Hargrave, 20, a surfer who failed out of business school | Royalties fund everything; China demand decides everything |
| 7 | The Qiaos (Beijing) | Qiao Jianguo, 60, retired official and state company board member | Qiao Lin, 24, back from a US university | Princeling ties; loyalty is tested when the crackdowns come |
| 8 | The Fangs (Shenzhen) | Fang Wei, 52, drone and battery founder | Fang Xiaoyu, 21, an engineer | Hardware empire squeezed by export controls |
| 9 | The Hegdes (Bengaluru) | Prakash Hegde, 59, IT services founder | Ananya Hegde, 23, a software engineer | Outsourcing is threatened by the very AI the boom creates |
| 10 | Maison de Valcourt (Paris) | Hélène de Valcourt, 64, luxury group chair | Louis de Valcourt, 22, an art school graduate | A 200-year-old house with a sibling feud over control |
| 11 | The Sokolovs (Moscow) | Dmitri Sokolov, 49, ransomware boss with a security services roof | Katya Sokolova, 19, a gifted hacker | Sanctions and protection politics after 2022 |

### 7.3.2 Pablo Segundo

Pablo Segundo is a **rising outsider** in Medellín, not a family member. He starts as a charismatic narco-populist with a growing movement (narco fascism). The Echeverri family, and any other dynasty with assets in Medellín, must decide to back him (money, protection, a share of his rise) or fight him (rival cartels, the state, foreign agencies). His rise is a quest chain that runs whether or not the Medellín dynasty is played.

**Starting position (T).** Each playable dynasty starts with a family trust, one or two family companies at Company rank, a living head (the player's parent) and two to four heirs. The player is a young heir aged 18 to 25 (Stage 1, [14-game-stages.md](../14-game-stages.md) 14.2). Trust size ranges from $500M (Medellín, Lagos, Bengaluru) to $5B (New York, Beijing), so the starts differ in difficulty.

## 7.4 Rival dynasties

| Item | Rule |
|---|---|
| Total at start | 32 dynasties **(T)**: the 11 playable ones plus 21 run only by the AI. Unpicked playable dynasties are run by the AI. |
| Money mix | About 30% old money, 30% new tech money, 25% state-linked, 15% criminal **(T)** |
| Placement | At least one dynasty in every hub with Size L or larger; Mega hubs get two or three **(T)** |
| Originality | Fully original families. No parodies of real families or founders. |
| New dynasties | An AI-run company founder whose company reaches Corporation rank founds a new dynasty. At most one new dynasty per hub per 5 years **(T)**. |
| Extinction | A dynasty with no living members, or with no trust and no holdings for 24 months, drops out. Its assets go to heirs by law, creditors or the state. |

## 7.5 Origin city, Center of Power and influence

- **Origin city** is fixed. Members born there get the origin bonus in [2-map-influence-economy.md](2-map-influence-economy.md) 2.5.6.
- **Influence is money, power and prestige.** Money is the asset base (2.5.2). Power and prestige multiply it:
  - **Power** = political offices held, controlled company boards and government contracts (the political office modifier in 2.5.6 plus control of local media and utilities).
  - **Prestige** = renown and reputation ([1-corporate-core.md](1-corporate-core.md) 1.11.4 and the reputation modifier in 2.5.6).
- **Center of Power** is the hub where the dynasty's final influence share is highest. It is checked monthly and moves only when another hub leads for 3 months in a row **(T)**. The Center of Power gives +10% influence there and halves travel time for family members heading home **(T)**.

## 7.6 The opening quest: "The Shot"

The first quest of every game. It teaches the quest system: a tree of steps, each with choices and rolls, tracked in the quest log.

**Before completion:** the heir can go anywhere, but only by car or train. Flights, including the family jet, are locked.

**Branches:**

| Branch | Steps | Difficulty |
|---|---|---|
| **Get vaccinated** | Book an appointment, take two doses three weeks apart | Easy. No rolls except a small chance of a sick day. |
| **Doctor's note** | Find a doctor willing to write one: the family doctor, a friend's doctor, or a paid clinic | Varies by character and rolls. Diplomacy or Intrigue rolls; traits such as Honest or Paranoid change the odds; failure can mean a scandal or a forged note that is later discovered. |

The exact steps and rolls are to be written in the events and quests design.

**On completion:**
- Travel unlocks, including flights and the family jet.
- Other parts of the game unlock (the Found Company action, wider schemes) **(A)**.
- A message arrives with the **tip**: it names the company that will make the first LLM breakthrough and explains how the AI system will work before the boom. The tip is always correct.
- **The tipped lab is different each game** (Logan). At game start one lab is drawn from a pool of five fictional AI labs (for example a Bay Area nonprofit lab, a big tech research division, a London lab, a Beijing lab and a Toronto lab) **(A)**. The drawn lab makes the November 2022 breakthrough unless players change history.

## 7.7 Timeline 2021 to 2030

Real events happen on schedule by default. Each one is an event or quest that players can change. From 2025 onward the events grow more fantastical. Company names are fictional.

| Date | Event | Game effect |
|---|---|---|
| 2021 | Chip shortage; vaccine rollout | Car and electronics output limited; the opening quest |
| Feb 2022 | Russia invades Ukraine | Sanctions on Russia; energy price shock; the Moscow dynasty's test |
| 2022 to 2023 | Rate shock | Cheap capital ends; VC funding rounds get harder |
| Oct 2022 | Broad US chip export controls | Export controls in [6-technocapital.md](6-technocapital.md) 6.9 switch on |
| Nov 2022 | The tipped lab launches its chatbot | The AI boom starts; compute demand surges |
| 2023 | Gen 2 accelerators; the GPU gold rush | Compute spot prices spike |
| 2024 | Power deals for data centers; nuclear restarts | Power becomes the bottleneck |
| 2025 | Gen 3; a cheap Chinese open model shocks the market | Beijing and Shenzhen get a boost; a market wobble |
| 2026 to 2027 | Gigaclusters; AI agents run whole departments; Gen 4 | Fantastical events begin |
| 2028 to 2029 | Humanoid robots in factories; the first mind uploads; Gen 5 | More fantastical events; peak valuations |
| 2030 | **The crisis: the bubble pops** | A crash in AI valuations; the post-crash era begins |

## 7.8 New hubs

Two new hubs join the map for the playable dynasties **(A)**:

| Hub | Country | Size | Pop (M) | Districts | Specialties |
|---|---|---|---|---|---|
| Medellín | Colombia | L | 4 | F1 I2 R4 S3 T1 X1 | Textiles, coffee, flowers, the informal economy, cartel money laundering, a growing tech scene |
| Sydney | Australia (New South Wales) | XL | 5.4 | F4 I2 P2 R6 S1 T2 | Banking, pension funds, property, media, mining company headquarters |

Colombia moves out of the Andean minor group and becomes the 31st major country so that Medellín can be a hub **(A)**.

## 7.9 Changes to other files

- [2-map-influence-economy.md](2-map-influence-economy.md) 2.3.3: add Medellín and Sydney; there are now 43 hubs and 31 major countries.
- [14-game-stages.md](../14-game-stages.md) 14.2: the Heir stage begins with "The Shot".
- [10-events.md](../10-events.md): add the quest system (7.1).
- [13-open-questions.md](../13-open-questions.md): the decided list holds these rules.

## 7.10 Assumptions and open items

1. Hub and economy values in file 2 stand as January 2021 values.
2. Medellín and Sydney hub data in 7.8, and Colombia as a major country.
3. 32 dynasties at start, with the money mix and placement in 7.4.
4. Trust sizes from $500M to $5B.
5. The Center of Power rule: 3-month lead, +10% influence.
6. Finishing "The Shot" unlocks the Found Company action and wider schemes.
7. Dynasty and character names in 7.3.1 are proposals.
8. The pool of five candidate labs for the tip.
