# 7. Starting world: detailed design

_Status: draft v1.6 (2026-10-20). Batch 134 (Logan): John starts with a Pdoomberg subscription paid by Arrowhead Drilling (7.3.0). Consistency pass 3 (batch 129): the starting rate is the world base rate of about 1.75% (7.2.0, 7.2), 7.8 points to the province data instead of old size and district codes, and the header no longer cites hubs. Batch 125 card (Logan): former hubs list scrapped; key cities hold perks and starting businesses; Metros only from the 5M+ rule. Batch 125 (Logan): every value is in USD in the simulation; local currencies are flavor only; FX is post-POC; one world base rate from the Federal Monetary Board. The 7.2.0 Currency row says so; the euro crisis is a euro crisis in news and history and runs as a debt crisis in the simulation. Batch 121: only national governments; Edmonton loses its provincial government flavor (Terry's friend Gilles Thibodeau stays a federal MP). Batch 118: EU4-style map; rivals are placed in cities (every city of rank Metropolis), Center of Power is a city or province, the starting places in 7.8 are city provinces, Kroll's colony is a claimed province; minor groups are gone. Batch 117: no optional end date. Batch 116: no dynasties or succession (rivals are characters, John's death ends the game, dead AI rivals pass holdings to a silent heir); John is single with two moms; rivals' signature plays become AI goals; Colombia (#32) and DR Congo (#33) are major countries, Medellín M and Sydney L; Semiconductors; Clout replaces prestige; no chip-generation simulation; fixes A5, A20, A22, A23. v1.5. Batch 93: the crash averages 2035; US chip export controls move to 2026. Batch 92: the AI boom starts in 2025. Batch 81: start at 00:00 on 1 January 2020, the opening sequence, a Liberal majority in Canada, Terry's friend is a Conservative MP. Batch 80: Arrowhead Drilling, its owners and board; Terry's politician friend in Montreal. Batch 79: John has no starting ambition; his parents are PMC middle managers in Edmonton (two moms, batch 116). Batch 78: Terry's buff, net worth and heritage; John's skills and his one trait. Batch 77: Terry Tippacanoe, the new rival who owns John's company; Edmonton, the listed company and the desktop tip confirmed. Batch 76: John Techno's premise and starting position, rivals without quest lines, the desktop as the first quest, Edmonton replaces Calgary. Batch 75: the scenario starts in **January 2020** with **one starting character, John Techno**; the other 14 premade characters are rivals. v0.6, consistency pass, batch 74. v0.5 (2026-10-17): alternate history added. Built from Logan's answers in the design Q&A. Sets the scenario, the starting character, the rival field, the opening quest and the timeline to 2035. Builds on [1-corporate-core.md](1-corporate-core.md) (characters, trusts), [2-map-and-influence.md](2-map-and-influence.md) (map, influence), [5-ideology.md](5-ideology.md) and [6-technocapital.md](6-technocapital.md). Owner: Logan._

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
| Rival field | 30 or more rival characters in the world, all fully original. A mix of old money, new tech money, state-linked and criminal money. Each is one person; relatives are flavor only (batch 116). |
| Character places | Each rival character has an **Origin city** and a **Center of Power**, and can live anywhere. |
| Center of Power | The city (a Metro or city province) or other province where the character holds the most influence, so it moves as the character grows. Influence is money, power and Clout: money is the asset base, and power and Clout modify it (7.5). |
| Rise and fall | AI founders rise into new rival characters during play. When an AI rival dies, a game-generated heir character takes over their holdings silently, with no succession screen (batch 116) **(A)**. |
| History | Follows the real AI boom, inside the alternate history in 7.2.0, with more and more fantastical things happening as the years pass. Real events happen on schedule by default, and players can change them. In **2035 on average** (Logan, batch 93) a crisis hits and the bubble pops** (the year varies by a few years with RNG and events; [8-quest-lines.md](8-quest-lines.md) 8.5); the game continues into a post-crash era with new rules. |
| Alternate history (Logan, 2026-10-17) | In the game world **9/11, the 2008 financial crisis and COVID never happened**, and the dot-com boom ran cooler and ended in only a **slight downturn** (Logan, batch 94). Everything else is the same, except that the **US won its wars in the Middle East far more decisively** and is in a much better position, both financially and in the security of its resources (7.2.0). |
| Opening quest | **Buying a desktop computer** on the phone (Logan, batch 76; 7.6). It gives John his first compute. |
| LLM tip | A tip names the company that will make the first LLM breakthrough. The tip is always correct, and the tipped lab is different each game. It arrives on the new desktop (Logan, batch 77; 7.6). |
| Quests and events | Quests are tracked goal trees with branches and rolls. Events are single pop-ups that can start a quest. |
| Death of the player | **Game over** (Logan, batch 116). There is no succession and no successor. |
| Game end | The game ends only when John Techno dies (health 0). There is no end date (Logan, batch 117): it is an endless sandbox. |

## 7.2.0 Alternate history (Logan, 2026-10-17)

Three things **never happened** in the game world: **9/11** (2001), the **2008 financial crisis**, and **COVID** (2020 to 2022). The **dot-com boom** was less exuberant and ended in a **slight downturn** in 2000 to 2001, not a crash (Logan, batch 94). **9/11** was stopped because the US crushed al-Qaeda early after the **USS Cole** bombing in October 2000 (Logan, batch 94; [19-history.md](19-history.md) 19.2.1). Everything else is the same, except that the **US won its wars in the Middle East much more decisively**, and is now in a much better economic position, both financially and with more security in its resources.

What follows from that, in January 2020 **(A)**:

| Area | Real 2020 | Game world 2020 |
|---|---|---|
| Tech | Scarred by the 2000 crash; big tech grew from the survivors | No real crash, only a slight downturn in 2000 to 2001 after a cooler boom: tech giants are older, bigger and richer, investors have never seen a true tech bust, and valuations and VC funding run hotter. The 2035 AI crash is the first great tech crash, so it hits harder (8.4) |
| Banking | Bailouts, stricter rules after 2008, a decade of near-zero rates | No crisis, no bailouts and no post-crisis rules: banks are bigger and more leveraged and US regulator strictness is 1 point lower (3.10). But **tighter mortgage rules passed in 2003** (Logan, batch 101), so households carry less mortgage debt than in real life. Rates never went to zero: the world base rate, set by the Federal Monetary Board from US data, is about **1.75%** at start **(T)** ([3-markets-and-fx.md](3-markets-and-fx.md) 3.8.1) |
| Housing | Recovered from the 2008 crash | **Never bubbled, never crashed** (Logan, batch 101): the 2003 mortgage rules kept growth tempered, so prices rose steadily instead. Most Metros and city provinces start in a mild Boom or Recovery phase of the property cycle (2.16.5), and none starts in a bubble **(A)** |
| Pandemic | COVID lockdowns begin | **No pandemic**: no vaccine mandates, no stimulus wave, no 2021 inflation spike, no remote-work shift. Offices are full (commercial pools start at 95% occupancy) |
| Supply chains | COVID chip shortage | No pandemic chip shortage; chips are tight only from normal demand |
| Security | Post-9/11 security state; long wars | No 9/11, so no post-9/11 security state at home. After the USS Cole bombing (2000) the US broke al-Qaeda early with a covert and proxy campaign in Afghanistan (19.2.1). The Iraq war still happened: **the vice president and the CIA made up claims that Iraq had nukes** (Logan), and the US invaded anyway. It won quickly and cleanly, and Iraq became a stable US ally |
| US presidents | Bush, Obama, Trump (R), Biden elected 2020 | **George W. Bush** (2001 to 2009), widely seen as the greatest president ever. **Jeb Bush** (2009 to early 2012 **(A)**): toothless, never says no to defense contractors or big business, so corporations go completely unchecked; **assassinated** three years in. **Dick Cheney** (his VP again) finishes the term and does not run. **Donald Trump, as a Democrat** (2013 to 2017). **No impeachment**: the Democrats drop him in **2016**, he runs **third party**, and an older **Barack Obama** wins as the Democrat. **Obama is president at game start** and runs for re-election in November 2020 (Logan, batches 102 to 105) |
| Europe | Euro crisis 2010 to 2012, then slow recovery | **No euro crisis until 2019**: Greece hid and grew its debt for ten years, the EU was stunted and fell behind financially, and when the debt was **exposed in spring 2019** it set off a **severe euro crisis**. At game start Greece has defaulted, European bond spreads have blown out, the euro is down hard and Europe is in recession, while the US is barely touched (the euro's fall is news flavor: the simulation runs the crisis as a debt crisis, batch 125). Britain voted to **leave the EU in October 2019** and left on 31 December 2019, so it is outside the EU at start (Logan, batches 103, 111 to 114, 122) |
| Currency | Many national currencies and the euro | Same in the story: every country keeps its real currency in names, news, history and UI text. **The simulation values everything in US dollars** (Logan, batch 125): no exchange rates or FX market in the POC, starting FX rates are flavor only, and the Federal Monetary Board sets one world base rate ([3-markets-and-fx.md](3-markets-and-fx.md) 3.8.1) |
| Middle East | Arab Spring 2010 to 2012, wars in Syria, Libya, Yemen | **Operation Total Bush Victory** (Logan, batch 104): the US has puppet governments or good relations with every player across the Middle East except **Iran, the one holdout** (Logan, batch 105), and the **Arab Spring never happens** |
| US position | High debt; energy imports falling with shale | US federal debt about 24% of GDP, a fifth of the real 120%, since the US never had to borrow as much (Logan, batch 130) **(T)**; a stronger dollar; Iraq is a stable US-aligned oil exporter and Gulf supply is more secure, so Hormuz risk starts at Calm and US energy security is high |
| Gulf and oil | Volatile | Oil supply is steadier and cheaper (oil price index starts at 90 **(T)**); cartel cuts ([10-industry-economy.md](10-industry-economy.md) 10.6) are weaker while US influence in the Gulf holds |

**Russia and Ukraine (Logan).** Russia invaded Ukraine much earlier, in **2005**. It took Crimea and the Donbas, its push on Kyiv failed, and **NATO troops defended western Ukraine** without fighting Russia directly (Logan, batch 99). After the pro-Russian **Yanukovych** won the 2010 election, the war **ended in 2011 in a stalemate on Russia's terms**: Ukraine dropped its NATO and EU bids, **NATO's troops went home** (Logan, batch 106), and the line sat **armed but at rest** for five years. Fighting **started again in 2016** (Logan, batch 105), and by 2020 it is a long **drone-warfare stalemate** along a fortified front ([19-history.md](19-history.md) 19.13). Consequences **(A)**: Russia has been under heavy sanctions since 2005, Europe weaned itself off Russian gas long ago (pipeline gas to Europe is already cut at start), Russia sells oil at a discount through grey fleets, both sides and their backers buy drones in huge numbers (Drones, Robotics, Aerospace and Defense demand is higher, 10.3), and the Black Sea is at Attacks risk (2.4.2).

**Africa (Logan, batch 36).** Africa is a hell hole in this game world: weak states, coups, militias, piracy in the Gulf of Guinea and heavy capital flight **(A)**. African countries start with low stability and high risk, and most capital leaves the continent. **Lagos** is the exception that can rise: if it is developed (by the rival Tolu Balogun or by the player investing there), its Metro becomes the clear-cut center of Africa and draws the continent's money, talent and flight capital.

The chip export controls and the AI boom still happen on schedule (7.7).

## 7.2 The world in January 2020

The detailed files were written with present-day starting values. At a January 2020 start, these differ:

| Item | At start (January 2020) | Arrives later through the timeline (7.7) |
|---|---|---|
| Chip export controls | Entity list bans on a few Chinese firms only; bans on selling the most advanced Semiconductors equipment (EUV lithography machines) to China already in force | Broad US controls on advanced chips and AI server nodes (**2026**, after the boom, batch 93), widened yearly; Netherlands and Japan join the next year |
| Russia | At war in Ukraine since 2005, a drone stalemate; heavy sanctions since 2005 (7.2.0) | Drone escalations and ceasefire events, rolled through the timeline |
| Compute | AI is a research field, not a market | New GPU generations arrive as timeline events with dollar effects on Semiconductors and compute business units; there is no chip-generation simulation (batch 116) |
| Models | No commercial chat models | The tipped lab's chatbot launch in **2025** starts the boom (Logan, batch 92) |
| Interest rates | The world base rate is about 3% (3-markets 3.8.1; Logan, batch 130): rates never went to zero (7.2.0) | Small moves only; no 2022 energy shock |
| Pandemic | None: COVID never happened (7.2.0) | n/a |
| Ideology mix | Starting shares in [5-ideology.md](5-ideology.md) 5.4 are for 2020 | Accelerationist and Neo-Luddite shares grow with the boom |

Province populations and development and country GDP in [2-map-and-influence.md](2-map-and-influence.md) and the province data stand as January 2020 values **(A)**.

## 7.3 The starting character and the rival starting characters

**The player plays John Techno** (Logan, batch 75), in Edmonton (7.3.0). The other fourteen premade characters, in three regional groups, start as **AI rival characters** (7.3.4). Names marked † were filled in by Claude and are open to edit; the rest are Logan's.

**Profiles.** Each premade character has one of three starting profiles:
- **Rich, with a burden**: massive wealth and a secret or burden that soon comes due.
- **Connected**: strong contacts and influence, not much money.
- **Talented**: average circumstances and really good stats.

### 7.3.0 John Techno (the player)

| Character | Location | Profile | Premise | Signature play |
|---|---|---|---|---|
| **John Techno** | Edmonton, Alberta | Talented | A former **union man on Canada's oil fields** (Logan, batch 76). Liberal governments forced his company into new ownership and broke up the union, but the word was *"If there's one man you keep, it's John Techno."* His incredible stats, the best of any character in the game, made him a local legend. At **22** he is the **Chief Operating Officer of the smallest oil company in the game** | Rise from COO to controller; quest line "The One Man You Keep" ([8-quest-lines.md](8-quest-lines.md) 8.3) |

**Starting position (Logan, batch 76).** $100,000 cash, a salary of $1M a year plus stock options, and a one-year paid-off lease on executive housing in Edmonton. He also starts with a **Pdoomberg subscription paid by Arrowhead Drilling** (Logan, batch 134; [20-ui.md](20-ui.md) 20.5.2). He is COO of **Arrowhead Drilling** (once People Oil Trust), a listed oil company worth $100M: Terry Tippacanoe (7.3.5) holds 60% and the public 40% (batch 80); his options and their yearly review are in 8.3 (batch 77). His skills (24 in all six), his one trait (Operational Excellence), his blank-slate ambition and his family are in 8.3. John is a **single, 22-year-old man with two moms**, both PMC middle managers in Edmonton (Logan, batch 116); they are flavor characters, with no family mechanics and no personal life arc.

### 7.3.1 Rivals, group one: North and South America

| # | Character | Location | Profile | Premise | AI goal |
|---|---|---|---|---|---|
| 1 | **Antone Provolone** | New York | Connected | A finance bro by day and a wise guy by night. Well connected either way: he always knows a guy who knows a guy, and he has worked his way into DC | Grow finance, crime and political pull through his contact network |
| 2 | **Ricky Feng** | San Francisco (Bay Area) | Rich, with a burden | A hacker who barely got out of a hack gone bad alive. He holds a very large, diverse crypto wallet he can no longer get into. Starts with a very large amount of compute in Asia and a large bot farm SaaS in the Philippines and Thailand | Get back into the wallet |
| 3 | **Dot Percy** | Los Angeles | Rich, with a burden | As Dot worked up the courage to ask for a divorce, she got a call: her husband was dead. The nation mourns the premature end of Hollywood's greatest power couple, and Dot is left with the estate and five talentless adult children who keep embarrassing her in the press (flavor relatives) | Rebuild the Percy name in Hollywood through PR campaigns and media holdings ([16-media.md](16-media.md)) |
| 4 | **Pablo Segundo** | Medellín | Talented | Narco fascism and the rise of Pablo Segundo | Build a narco-populist movement into political power |

### 7.3.2 Rivals, group two: Europe, Africa and the Middle East

| # | Character | Location | Profile | Premise | AI goal |
|---|---|---|---|---|---|
| 5 | **Tolu Balogun** | Lagos, Nigeria | Rich, with a burden | Oil money and corruption in a developing country | Corruption, oil and third-world development |
| 6 | **Pieter Von Floop** † | Eindhoven, Netherlands | Rich, with a burden | Runs the Semiconductors company his father built, whose Eindhoven unit holds the world's lithography monopoly. The monopoly is easy to run, and he has been a boy scout his entire life. He is 24 and took the reins as his father's health turned (his father is a flavor relative); his trusts are swelling, but he worries he may crack holding together what his father built | Keep the Semiconductors monopoly unit dominant ([10-industry-economy.md](10-industry-economy.md) 10.3) |
| 7 | **Samir Haddad** † | Dubai | Talented | A former elite soldier who flew drones in the war, now in the Permanent Underclass, slaving away on another megaproject in the desert. A fixer offers him a battered drone on credit, for a favor | Grow from one drone to a fleet in the Drones industry (Logan, batch 72) |
| 8 | **Margaux Valcourt** † | Paris | Rich | A French redheaded woman who inherits a lot of money from her uncle. A Liberal with no fixed plan: she can become anything | Open-ended: follows whatever her traits favor **(A)** |
| 9 | **Viktor Sokolov** † | Moscow | Connected | A Putin-style spy: an intelligence officer building a network of loyalists inside the state **(A)** | Spycraft, state capture, sanctions |

### 7.3.3 Rivals, group three: Asia and Oceania

| # | Character | Location | Profile | Premise | AI goal |
|---|---|---|---|---|---|
| 10 | **Garrett Kroll** † | Pacific Ocean, off the coast of New Zealand | Rich, with a burden | A crazy automotive billionaire trying to start his own island colony by crashing boats into the side of Antarctica | Win recognition of his colony's sovereign rights (Sovereigntists, [5-ideology.md](5-ideology.md)) |
| 11 | **Fang Xiaoyu** | Shenzhen | Talented | Tech and finance; a woman (batch 37) | Run businesses across Hong Kong and Shenzhen |
| 12 | **Qiao Lin** | Beijing | Connected | From a party-state family; a woman (batch 36) | Rise in Chinese politics through the party-state network |
| 13 | **Ananya Hegde** † | Bengaluru | Talented **(A)** | A sleeper overpowered investor | Win India good chip deals so it can build lots of data centers early and run them at lower cost: scale the AI industries as an investor |
| 14 | **Yuna Sakamoto** † | Tokyo-Yokohama, Japan | Connected | A young Japanese influencer with a massive following who now has to pivot her appeal to an incredibly politicized and extremist Japan | Pick a political cause and drive Japan and Korea toward it |

### 7.3.4 The rival starting characters

**All fifteen are active rivals** (the fourteen above plus Terry Tippacanoe, 7.3.5) (Logan, batch 75) from day one (batch 76). Each is an AI character who pursues the **AI goal** in its row (A20: no rival is playable). They have **no quest lines** (Logan, batch 76): like every AI character, they act on their traits and premise, and the player meets them through the news, intel, deals and conflict. Natural rivalries still matter: each names two or three others it clashes with first (for example Antone Provolone and Pablo Segundo over the drug and money trade, Pieter Von Floop and Fang Xiaoyu over Semiconductors access, Qiao Lin and Viktor Sokolov over sanctions-era deals) **(A)**.

**Rivals' starting position (T).** Wealth ranges widely by profile: Rich characters start with $1B to $10B in trusts and holdings (Ricky Feng's is mostly locked in the wallet), Connected characters with $1M to $50M, Talented characters with under $1M. Some premade characters have relatives as flavor, for example Dot Percy's five children and Pieter Von Floop's ailing father; there are no family mechanics (batch 116).

### 7.3.5 Terry Tippacanoe (Logan, batch 77)

| Character | Location | Profile | Premise | AI goal |
|---|---|---|---|---|
| **Terry Tippacanoe** | Edmonton, Alberta | Rich: **$1B net worth** (Logan, batch 78) | A **Native financier of questionable origins**: he is ethnically Black and **1/8th Native American**, and plays up the Native part as **part of his grift** (Logan, batch 78). His nationality is listed as **First Nations and Black**. He owns a **very popular casino** and, as the union broke up, bought out the smallest oil company in the game: **John Techno's**. He is the new owner and John's first rival | Grow money through the casino and deals; scheme against Liberals |

- **Anti-Liberal edge (Logan).** Terry has a **buff against all Liberal characters in his schemes**: **+25% success and -25% discovery** when the target's ideology is Liberals ([5-ideology.md](5-ideology.md)) (Logan, batch 78). **His schemes are never exposed in the media**: outlets cannot investigate or run them as scandals (16.5.1); they can only be found through intel or hacking.
- **The casino** is a very popular casino in the Gambling industry ([10-industry-economy.md](10-industry-economy.md) 10.3), held by a **private company he owns outright** (Logan, batch 78). It is the source of his cash and his pull in Edmonton.
- **Questionable origins, not a secret (Logan, batch 78).** His heritage is flavor for his grift, not a secret to uncover. What can be dug up is ordinary scheme material: his deals and the casino's books (1.1.8.2) **(A)**.
- **Friends (Logan, batch 80).** Terry starts with **a politician friend in Montreal**: a full character, Terry's Friend, who gives him pull in federal politics. He is a **Conservative MP** for a Montreal seat (Logan, batch 81).
- **John's choice (Logan).** John can **befriend Terry** or **work in the shadows on his downfall** ([8-quest-lines.md](8-quest-lines.md) 8.3, Arc 1).

## 7.4 Rival characters

| Item | Rule |
|---|---|
| Total at start | 32 major characters **(T)**: John Techno, the 15 rival starting characters (7.3.4, 7.3.5) and 16 more AI rival characters. |
| Money mix | About 30% old money, 30% new tech money, 25% state-linked, 15% criminal **(T)** |
| Placement | Rivals are placed in cities, biggest first: Metros of 4 or more provinces get two or three, then one rival per remaining Metro until the roster runs out; smaller cities get rivals only through the rotation and new-rival rules **(T)** (batch 118) |
| Originality | Fully original characters. No parodies of real people, families or founders. |
| Rival rotation | A roster of characters added to every game with preset AI. They can be directed at the player or at other characters to mess with them, by the game's director AI and by characters who hire them, the player included (Logan). |
| New rivals | An AI-run company founder whose company reaches Corporation rank becomes a new rival character. At most one per city (Metro or city province) per 5 years **(T)**. |
| Death and dropping out | When an AI rival dies (health 0), a game-generated heir character silently takes over their holdings, with no succession screen (batch 116) **(A)**. A rival with no trusts and no holdings for 24 months drops off the rival list. |

## 7.5 Origin city, Center of Power and influence

- **Origin city** is fixed: a province, and through it its city (Metro or city province) if it has one. Characters born there get the origin bonus in [2-map-and-influence.md](2-map-and-influence.md) 2.5.6.
- **Influence is money, power and Clout.** Money is the asset base (2.5.2). Power and Clout multiply it:
  - **Power** = political offices held, controlled company boards and government contracts (the political office modifier in 2.5.6 plus control of local media and utilities).
  - **Clout** = standing among the elite ([1-corporate-core.md](1-corporate-core.md) 1.1.0), with the public Image (Fame and Favor) modifier in 2.5.6 (batch 116: replaces prestige, renown and reputation).
- **Center of Power** is the city (a Metro or city province), or else the province, where the character's final influence share is highest. It is checked monthly and moves only when another place leads for 3 months in a row **(T)**. The Center of Power gives +10% influence there and halves the character's travel time heading home **(T)**.

## 7.6 The opening quest: "The Desktop" (Logan, batch 76)

The first quest of the game is **buying a desktop computer**, on John's phone: he downloads the marketplace app, orders the computer, and it is delivered a few hours later. The reward is **1 base compute** and **1 data compute** (cloud data that comes free with the computer). Steps and rolls: [8-quest-lines.md](8-quest-lines.md) 8.2.1.

- There is **no travel lock**: John can fly from the start (Logan, batch 77).
- **The LLM tip** arrives on the new desktop once it is set up: it names the company that will make the first LLM breakthrough and explains how the AI system will work before the boom. The tip is always correct (Logan, batch 77).
- **The tipped lab is different each game.** At game start one lab is drawn from a pool of five fictional AI labs (for example a Bay Area nonprofit lab, a big tech research division, a London lab, a Beijing lab and a Toronto lab) **(A)**. The drawn lab makes the **2025** breakthrough (batch 92) unless players change history.

## 7.7 Timeline 2020 to 2035

Real events happen on schedule by default. Each one is an event or quest that players can change. From 2025 onward the events grow more fantastical. Company names are fictional.

| Date | Event | Game effect |
|---|---|---|
| 1 Jan 2020, 00:00 | Scenario start (no pandemic, 7.2.0); markets closed | The opening quest "The Desktop" |
| 2 Jan 2020, 00:00 | The first earnings day | Arrowhead Drilling reports a small profit and John's board seat (8-quest-lines 8.2.2) |
| 7 Jan 2020 | First Week on the Job | Then Intro Night (8.2.3, 8.2.4) |
| Feb 2020 onward | **The Mink Scare** breaks at Arrowhead Drilling | A drug ring and a furry panic (8-quest-lines 8.2.5) |
| 2020 | Canada has a **Liberal majority government** (Logan, batch 81) | The government that broke John's union |
| Early 2020 | **The transformer paper** is published: a scripted world event soon after John's desktop arrives; the LLM tip names the lab that will scale it first (Logan, batch 114; 7.6) | The start of the AI story |
| 2020 | **Euro crisis**: Greece has defaulted, European bond spreads have blown out, the euro is down hard and Europe is in recession (news flavor; the simulation runs it as a debt crisis, batch 125); **Brexit** done: the UK left the EU on 31 December 2019 after the October Leave vote (Logan, batches 111 to 114, 122) | Europe weak, US barely touched; EU assets cheap |
| November 2020 | **US election**: President Obama runs for re-election (Logan, batch 105) | A scheduled election event ([4-politics.md](4-politics.md)) |
| 2020 to 2021 | No pandemic: offices full, the world base rate near 3% (batch 130), steady growth **(A)** | VC funding hot; property in a mild Boom or Recovery (2.16.5; batch 101) |
| 2021 | A crypto and SPAC mania **(A)** | Random boom coins in the gambling tab ([9-gambling.md](9-gambling.md)); IPO frenzy |
| 2020 onward | The Ukraine drone war grinds on (since 2005) | Drone demand; Black Sea risk; ceasefire or escalation events |
| 2022 to 2023 | The world base rate still steady near 3% | VC funding stays hot |
| 2024 | New GPUs, bought for research and gaming | No AI market yet |
| **2025** | **The tipped lab launches its chatbot** (Logan, batch 92) | **The AI boom starts**; compute demand surges |
| 2026 | The GPU gold rush; **broad US chip export controls** on advanced chips and AI server nodes (Logan, batch 93) | Compute spot prices spike; export controls in [6-technocapital.md](6-technocapital.md) 6.9 switch on |
| 2027 | Power deals for data centers; nuclear restarts; a cheap Chinese open model shocks the market | Power becomes the bottleneck; Beijing and Shenzhen get a boost; a market wobble |
| 2028 to 2029 | Gigaclusters; AI agents run whole departments | Fantastical events begin |
| 2030 to 2034 | Humanoid robots in factories | More fantastical events; peak valuations **(A)** |
| 2035 | **The crisis: the bubble pops** (on average, batch 93) | A crash in AI valuations; the post-crash era begins |

## 7.8 New places

New places for the starting characters **(A)**. Since batch 118 Medellín and Edmonton are single city provinces and Sydney a Metro; their starting development, city rank and slum share are set directly in the province data ([2-map-and-influence.md](2-map-and-influence.md) 2.3.2), and the 2.3.3 key cities table gives their province ids. The old size column is kept for reference:

| Place | Country | Old size | Pop (M) | At start | Specialties |
|---|---|---|---|---|---|
| Medellín | Colombia (Antioquia) | M | 4 | City province | Textiles, coffee, flowers, the informal economy, cartel money laundering, a growing tech scene |
| Edmonton | Canada (Alberta) | S | 1.4 | City province | Oil sands and oil field services, pipelines; John Techno's home (replaces Calgary, batches 76 and 77) |
| Sydney | Australia (New South Wales) | L | 5.4 | Metro (2 provinces) | Banking, pension funds, property, media, mining company headquarters |
| Kroll's colony | None (claimed) | Site | 0 | One claimed province, no city rank | A claimed sea and ice province between New Zealand and Antarctica, outside any country **(A)**. Starts as a few beached ships; can grow into a Town and then a City if the claim survives (2.17.3) |

**Colombia and DR Congo are major countries** (Logan, batch 116): there are **33 major countries** (Qatar is #31, Colombia #32, DR Congo #33). Since batch 118 every other country is a real country too (minor groups are dissolved). Medellín is a city province in Colombia (Antioquia) and **Kolwezi-Lubumbashi** a city province in DR Congo (Katanga), with the Zambian Copperbelt abstracted into it. There are still 80 key cities ([2-map-and-influence.md](2-map-and-influence.md) 2.3.3).

## 7.9 Changes to other files

- [2-map-and-influence.md](2-map-and-influence.md) 2.3.3: Medellín, Sydney and Edmonton added; there are now 80 key cities (called former hubs until the batch 125 card) and 33 major countries (batch 116). Kroll's colony is a special claimed province.
- The game has no stages; founding and young-company rules are in [1-corporate-core.md](1-corporate-core.md) 1.6, and politics by company rank in [4-politics.md](4-politics.md) 4.28.
- The quest system is in [8-quest-lines.md](8-quest-lines.md) 8.1 and events in [13-events.md](13-events.md).
- [13-open-questions.md](../13-open-questions.md): the decided list holds these rules.

## 7.10 Assumptions and open items

1. Province, city and economy values in file 2 and the province data stand as January 2020 values.
2. Medellín, Edmonton (replacing Calgary, confirmed batch 77) and Sydney city data in 7.8, and Kroll's colony as a claimed province outside any country. (Colombia and DR Congo as major countries are confirmed, batch 116.)
3. 32 major characters at start, with the money mix and placement in 7.4.
4. Starting wealth ranges by profile in 7.3.
5. The Center of Power rule: 3-month lead, +10% influence.
6. No travel lock, and the LLM tip arriving on the desktop (7.6).
7. Names marked † and profiles marked **(A)** in 7.3 (Tolu Balogun, Fang Xiaoyu and Qiao Lin confirmed in batch 35), and the AI goals in 7.3.1 to 7.3.3.
8. The natural-rivals rule (7.3.4).
9. The pool of five candidate labs for the tip.
10. The alternate-history consequences in 7.2.0, including the effects of the Ukraine war since 2005.
11. What can be dug up on Terry: his deals and the casino's books (7.3.5).
12. The 2020 to 2021 timeline rows (7.7).
13. A dead AI rival's holdings passing silently to a game-generated heir character (7.1, 7.4).
