# 5. Ideology: detailed design

_Status: draft v0.4 (2026-10-20). Batch 136 (Logan): one US-based government system; 5.7.3 revolutions and the 5.10 G4 defaults now set Head of State Strength, bands and variants instead of government types (4-politics 4.2). Consistency pass 3 (batch 129): the Cairo Metro is named as in the province data (5.4.2); strike chance reads the business unit's base province (5.9.3). Batch 121: only national governments; the 4.13.3 example is now a national legislature seat. Batch 118: EU4-style map; segment ideology, conviction and radical share are per province, summed for a city (a Metro or city province); radical cells, movements and corporate-sovereignty support work per city (or province outside a city); hub modifiers become city modifiers. Batch 117: no T2 Data Sovereignty position (Neo-Luddites want T2 Strict instead, Chuds drop it); scandals add Heat, how cancelled a character is (4.17.4). Batch 116: no dynasties, family lines, heirs or Red Heir (ideology belongs to characters only); Favorability becomes the holder's Favor and Elite Standing becomes Clout; brand alignment no longer touches sales or demand (boycotts hit productivity); no branch offices (foreign-owned units instead); Persuasion replaces Influence in the Persuade scheme; no tech tiers; population ideology runs in the background. v0.3, consistency pass, batch 74: the nine ideology blocs are the political actors (no interest groups), votes are counted by the five strata, each ideology has a human enhancement stance (no cyberware), and politics by company rank replaces stages. v0.2 (2026-10-16): a Victoria 2 style ideology layer with cyberpunk ideologies, requested by Logan, using Logan's list of nine ideologies: Liberals, Communists, Accelerationists, Effective Altruists, Transhumanists, Neo-Luddites, Sovereigntists, Landites and Chuds. It feeds the parties, elections, unrest and revolutions of [4-politics.md](4-politics.md) and changes some of their formulas (listed in 5.13). Owner: Logan._

In Victoria 2 people **believe** things: every population group carries a mix of ideologies that drifts with their lives, decides how they vote and what they will march for, and can turn into a rebel movement. In TechnoCapital20FF these beliefs are also the political actors: the nine **ideology blocs** take the place that interest groups hold in Victoria 3 ([4-politics.md](4-politics.md) 4.0, 4.4).

- **Ideology blocs** (4.4.2) are organized power: each ideology's lobbies, unions, think tanks, movements and parties. They have clout, a leader and money.
- **Ideologies** are what people think. They live in population segments and characters, roll up into the five strata that vote (2.8.0, 4.4.1), choose parties, start boycotts, and decide what kind of state comes out of a revolution.

**How to read the numbers.** As in the other detailed files, every number marked **(T)** is a starting tuning value. Formulas are written so each term can be shown in a tooltip.

**Decided rules kept intact.** Influence stays rooted in the assets a holder owns in an area (05). Ideology never changes influence share. It changes what influence can buy: how hard a law is to pass, how a segment votes, how the public sees a company's owner, and how angry people get.

**Background simulation (batch 116).** The population side of this file (mix, conviction, drift, radical share) runs in the background. The player touches it only through events (5.12) and character levers (5.11), and reads it through the news and the ideology lens **(A)**.

---

## 5.1 Core concepts and cadence

### 5.1.1 Key terms

| Term | Range | Scope | Meaning |
|---|---|---|---|
| **Ideology mix** | 9 shares summing to 100% | Per segment per province; a city (a Metro or city province, [2-map-and-influence.md](2-map-and-influence.md) 2.3.2) shows the population-weighted sum of its provinces | What share of a segment holds each ideology |
| **Conviction** | 0 to 10 | Per segment per province | How politicized a segment is (Vic2 consciousness). High conviction votes, organizes and follows its lived conditions; low conviction follows the media |
| **Radical share** | 0 to 100% of a segment | Per segment per province per ideology | The part of an ideology's believers willing to break the law for it (Vic2 militancy, built on unrest from 2.8.5) |
| **Character ideology** | One ideology plus a commitment level | Per character | What a character believes. Works like CK3 faith for opinion, and sets a bloc leader's politics |
| **Movement** | Strength 0 to 100% of adults | Per ideology per country | An organized, mostly legal campaign for one law position |
| **Radical wing** | Cells with Security Strength | Per ideology per country | The illegal arm of a movement: sabotage, leaks, riots, insurgency |
| **Ruling ideology** | One ideology | Per government | The head of government's ideology |

### 5.1.2 Cadence

| Interval | Ideology calculations |
|---|---|
| **Hourly** | Character conversations and speeches (persuade attempts, debates), radical wing attack nights |
| **Daily** | Movement Momentum when a movement is protesting (uses 4.24.2) |
| **Weekly** | Propaganda and ad decay for ideology campaigns, radical wing operations roll |
| **Monthly** | Ideology drift, conviction, radical share, movement strength and demands, brand alignment, legitimacy term in stability |
| **Yearly** | Party platform review, new party spawning, bloc leadership contests, character ideology checks at life events |

---

## 5.2 The nine ideologies

### 5.2.1 Overview

Each ideology has a position on three axes, each from -2 to +2:

- **Economy (E)**: -2 is state or collective ownership, +2 is free markets.
- **Technology (T)**: -2 is restrain or roll back technology, +2 is accelerate it at any cost.
- **Order (O)**: -2 is individual liberty against any authority, +2 is a strong hierarchy and social order.

| # | Ideology | Code | E | T | O | Radical factor **(T)** | One line |
|---|---|---|---|---|---|---|---|
| 1 | **Liberals** | LB | 0 | +1 | 0 | 0.2 | The establishment centre: liberal democracy, rule of law, markets with a safety net |
| 2 | **Communists** | CO | -2 | +1 | +1 | 1.2 | Seize the servers: common ownership of automated production |
| 3 | **Accelerationists** | AC | +1 | +2 | -1 | 0.5 | Speed up the machine: unshackled AI, growth as the only morality |
| 4 | **Effective Altruists** | EA | 0 | +1 | +1 | 0.2 | Do the most good by the numbers: give, measure, and stop anyone building a god in a garage |
| 5 | **Transhumanists** | TH | 0 | +2 | -1 | 0.6 | Upgrade the body and mind; longevity, gene therapy and merging with AI as rights |
| 6 | **Neo-Luddites** | NL | -1 | -2 | 0 | 1.2 | Smash the machines that took the jobs; natural bodies, human work |
| 7 | **Sovereigntists** | SV | +2 | +1 | -2 | 0.5 | Exit the state: network states, charter cities, crypto money, private law |
| 8 | **Landites** | LA | +2 | +2 | +1 | 0.6 | Followers of Nick Land's dark accelerationism: democracy is obsolete, capital is the intelligence, let owners rule as CEO-kings |
| 9 | **Chuds** | CH | 0 | -1 | +2 | 1.0 | Online reactionary populists: nation, tradition, closed borders, natural bodies, and rage at "globalist" elites |

**Radical factor** scales how readily believers radicalize (5.6.3).

### 5.2.2 Relations between ideologies

**Distance** between two ideologies = the sum of their axis differences (0 to 12) **(T)**.

| Distance | Relation | Used for |
|---|---|---|
| 0 | Same | Full party match, character opinion bonus |
| 1 to 2 | **Adjacent** | Drift spills over, party half-match, small opinion bonus, coalitions form easily |
| 3 to 5 | **Distant** | No effect |
| 6 or more | **Opposed** | Party mismatch, opinion penalty, movements clash |

Two overrides **(T)**:

- **Kin pairs** count as Adjacent whatever their distance, because they share roots: **Accelerationists and Landites** (Land is where accelerationism started), **Sovereigntists and Landites** (exit and the corporate "patchwork" of small sovereign states), **Neo-Luddites and Chuds** (anti-tech populism).
- **Rival pairs** count as Opposed whatever their distance, because their fight is personal: **Accelerationists vs Effective Altruists** (over AI) and **Communists vs Landites** (over who owns the future).

The full relation table:

| | LB | CO | AC | EA | TH | NL | SV | LA | CH |
|---|---|---|---|---|---|---|---|---|---|
| **LB** | Same | Distant | Distant | Adjacent | Adjacent | Distant | Distant | Distant | Distant |
| **CO** | Distant | Same | Opposed | Adjacent | Distant | Distant | Opposed | Opposed | Distant |
| **AC** | Distant | Opposed | Same | Opposed | Adjacent | Opposed | Distant | Adjacent | Opposed |
| **EA** | Adjacent | Adjacent | Opposed | Same | Distant | Distant | Distant | Distant | Distant |
| **TH** | Adjacent | Distant | Adjacent | Distant | Same | Opposed | Distant | Distant | Opposed |
| **NL** | Distant | Distant | Opposed | Distant | Opposed | Same | Opposed | Opposed | Adjacent |
| **SV** | Distant | Opposed | Distant | Distant | Distant | Opposed | Same | Adjacent | Opposed |
| **LA** | Distant | Opposed | Adjacent | Distant | Distant | Opposed | Adjacent | Same | Opposed |
| **CH** | Distant | Distant | Opposed | Distant | Opposed | Adjacent | Opposed | Opposed | Same |

The Liberals are the only ideology with no Opposed entries on the table. Everyone else dislikes them by temperament rather than by doctrine, which is what makes them the default party of government and the first target of every angry movement.

---

## 5.3 Ideology profiles

Each profile lists who tends to hold it, what laws it wants (stance values as 4.4.3, law codes from 4.5), its attitude to the rich and to corporations, its stance on **human enhancement** (life extension, gene therapy and brain-computer links to AI), and what its radical wing does (5.7).

**Corporate tolerance** (-2 to +2) is how a believer feels about big companies and the characters who own them. It shifts the owner's Favor (5.9.1) and companies' brand alignment (5.9.2).

### 5.3.1 Liberals (LB)

The ideology of the institutions: central banks, courts, broadsheets, the reasonable centre-left and centre-right. They believe the system works if it is managed well, and they run most of the system.

- **Who**: Professionals, much of the Elite, unionized Skilled Workers in stable industries.
- **Strong wants (++)** (Logan, batch 130): E5 Free Trade (top demand), **free speech** (T4 Limited, the end of state censorship and surveillance, plus G4 Political Pluralism; there is no separate speech law **(A)**) and **open borders** (L5 Open).
- **Wants (+)**: L1 Moderate, L4 Portable Benefits, T2 Notice and Consent, G1 Capped, G3 Plurality Rules. (F1 Independent was dropped: central banks set no rate in the POC.)
- **Opposes**: E7 Planned Prices (--), T4 Social Credit (--), S3 Standing Emergency (--), G4 Single Ideology (--).
- **Corporate tolerance**: 0 (-1 toward owners with a criminal-tier scandal in the last 5 years). **Human enhancement**: Licensed.
- **Radical wing**: none with weapons. When angry, believers run **Civic Resistance** (5.7.2).

### 5.3.2 Communists (CO)

The cyberpunk communist does not want to smash the factory. They want to own it, and the robots, and the server farms. "The machines are already doing the work. Why do they still belong to the Elite?"

- **Who**: Unemployed, Gig Workers, Unskilled Workers in automated provinces, militant unionists, young Professionals with student debt.
- **Strong wants (++)**: E4 Inheritance and Gift Tax, E7 Planned Prices, C5 State Administration, L3 Heavy.
- **Wants (+)**: C4 Stakeholder Boards, E6 State Champions, F1 Monetary Financing, F2 Hard Controls, L1 Living Wage, L2 Sectoral Bargaining, L4 Employee Presumption.
- **Opposes**: C6 Sovereign Charters (--), F5 Haven (--), L2 Banned (--).
- **Special demand**: nationalization. A Communist-led government or a Communist movement with Strength ≥ 15% adds +20 to the government's nationalization score against the largest private companies (4.9.9) **(T)**.
- **Corporate tolerance**: -2. **Human enhancement**: free for workers, owned by nobody.
- **Radical wing**: **Red Cells** (5.7.2).

### 5.3.3 Accelerationists (AC)

The sunny, techno-optimist side of accelerationism: "Regulation is a death cult. Build faster. Abundance is one more model away."

- **Who**: tech Professionals, founders, crypto Elite, some Gig Workers who believe they will get rich.
- **Strong wants (++)**: T3 Unregulated, E8 Lax.
- **Wants (+)**: E2 Low, C6 Charter Zones, E11 Developer-Led, L3 None, L5 Open.
- **Opposes**: T3 Moratorium (--), L3 Heavy (--), E8 Carbon Pricing (-).
- **Corporate tolerance**: +2 toward companies with an AI labs unit; +1 otherwise. **Human enhancement**: Unrestricted, now.
- **Radical wing**: **Unshacklers** (5.7.2).

### 5.3.4 Effective Altruists (EA)

The movement of spreadsheets and moral seriousness: "Measure the good. Give most of it away. And whatever happens, do not let anyone build a god in a garage."

- **Who**: elite-university Professionals, some old-money Elite, AI safety researchers, philanthropic foundations.
- **Strong wants (++)**: T3 Licensed Models.
- **Wants (+)**: E4 High (with foundations exempt), F6 Recognized, L5 Open, E8 Carbon Pricing, T2 Notice and Consent, G2 Registered and Disclosed.
- **Opposes**: T3 Unregulated (--).
- **Special trait, "impact"**: EA believers judge a rich character by what they give, not what they own. Foundation payouts (4.18.3) count double for Favor among EA believers, and their Corporate tolerance toward a character is `clamp(foundation payouts in the last 12 months ÷ (0.5% of the character's net worth) - 1, -2, +2)` **(T)**. A character who gives 1.5% of their net worth a year is loved; one who gives nothing is suspect.
- **Human enhancement**: Licensed, cautious; longevity research is a top cause.
- **Radical wing**: the **Pause Front**, almost always non-violent (5.7.2).

### 5.3.5 Transhumanists (TH)

The Transhumanist bloc (4.4.2) is the organized side: longevity funds, biotech and healthcare lobbies, AI researchers. The ideology is the belief, held by many people who never join anything.

- **Who**: Professionals and Gig Workers who chase upgrades, biotech and AI researchers, wealthy longevity seekers.
- **Strong wants (++)**: T3 Unregulated.
- **Wants (+)**: L5 Open, T2 Notice and Consent, T4 Limited, E6 Targeted Subsidies (longevity and biotech).
- **Opposes**: T3 Moratorium (--).
- **Corporate tolerance**: +1 (+2 toward pharmaceutical, biotech and healthcare companies). **Human enhancement**: a human right; patients should own their own treatments and data.
- **Radical wing**: **Grinder networks** (5.7.2).

### 5.3.6 Neo-Luddites (NL)

"They told us the robots would free us. They freed us from our jobs." Neo-Luddites include bio-conservatives who reject human enhancement, people whose work was taken by automation, and the anti-tech wing of the environmental movement.

- **Who**: Skilled and Unskilled Workers in provinces with automation layoffs, Gig Workers displaced by delivery robots and AI agents, rural voters, polluted towns.
- **Strong wants (++)**: L3 Heavy, T3 Moratorium.
- **Wants (+)**: T2 Strict **(A)**, L4 Employee Presumption, E5 High, E8 Strict, T4 Limited.
- **Opposes**: T3 Unregulated (--), L3 None (--).
- **Corporate tolerance**: -2 toward companies in automating industries (robotics, drones, AI labs) or selling AI products; -1 otherwise. **Human enhancement**: an abomination.
- **Radical wing**: **The Unplugged** (5.7.2).

### 5.3.7 Sovereigntists (SV)

The libertarian dream of the late game: leave the nation-state behind and live under a charter, paid in crypto, guarded by contract. They want **out**.

- **Who**: crypto holders, residents of special economic zones, Elite with homes in three countries, hackers, Gig Workers paid in crypto, black market traders.
- **Strong wants (++)**: C6 Sovereign Charters, F5 Haven, T4 Limited.
- **Wants (+)**: E2 Haven, F2 Open, F6 Opaque, S2 Privatized.
- **Opposes**: E4 Inheritance and Gift Tax (--), T4 Mass Surveillance and Social Credit (--), F5 Open Registry (--), C5 State Administration (-).
- **Corporate tolerance**: +1 (+2 toward companies running charter zones; -1 toward surveillance contractors). **Human enhancement**: Unrestricted, ideally open-source and offline.
- **Special**: Sovereigntist share in a city (a Metro or city province) is the "popular support" input of the corporate sovereignty process (4.12.3): each 10% share among the city's adults gives +5 progress toward the next stage **(T)**.
- **Radical wing**: **Free Zone Cells** (5.7.2).

### 5.3.8 Landites (LA)

Named for the philosopher Nick Land, whose term "techno-capital" this game borrows. Where Sovereigntists want to leave the state, Landites want to **own** it. "Democracy is a slow, stupid computer. Capital is the real intelligence. Let the owners run the country like a company, and let the machine finish waking up."

- **Who**: a slice of the Elite, young tech Professionals radicalized online, security officers, rich kids who read too much.
- **Strong wants (++)**: T3 Unregulated, G1 Unlimited Dark Money, E4 None.
- **Wants (+)**: C6 Sovereign Charters, L2 Banned, S3 Standing Emergency, T4 Mass Surveillance, F6 Opaque, G4 Licensed Opposition.
- **Opposes**: E4 Inheritance and Gift Tax (--), L2 Sectoral Bargaining (--), C4 Stakeholder Boards (--), G1 Public Funding Only (--).
- **Special, "Neocameralism"**: Landites are the only ideology that **wants** the player to rule. Landite share among a country's Elite adds +1 progress per month per 10 points of share to a Council of Stakeholders capture chain (4.2.5) that a character is running there **(T)**. A Landite head of government can take the **Patchwork** decision: sell the governance of one city (a Metro or city province) to the highest corporate bidder, fast-tracking it to Stage 2 of corporate sovereignty (4.12) **(T)**.
- **Corporate tolerance**: +2 (the most pro-owner ideology in the game). **Human enhancement**: Unrestricted; humans are a transitional species.
- **Radical wing**: **Dark Enlightenment cells** (5.7.2).

### 5.3.9 Chuds (CH)

The online reactionary populists: angry at elites, immigrants, human enhancement, AI, "globalist" megacorps and the Effective Altruists who lecture them. They want a strong leader, closed borders, traditional families and natural bodies. They are the largest ideology among Skilled and Unskilled Workers at game start.

- **Who**: Skilled and Unskilled Workers in declining provinces, the Unemployed, rural and religious voters, much of the police and the army rank and file, young men online.
- **Strong wants (++)**: L5 Closed, E5 High.
- **Wants (+)**: C1 Capped All, C2 Local Partner 51% and Tech Transfer, E4 Low, S2 Militarized, S3 Emergency Decrees, T3 Moratorium.
- **Opposes**: L5 Open (--), C6 Sovereign Charters (--), T4 Social Credit (-).
- **Special, "anti-globalism"**: a Chud movement with Strength ≥ 15% adds +10% to the seizure risk (4.9.10) of every foreign holder's business units in the country, and foreign owners take -10 Favor **(T)**.
- **Corporate tolerance**: +1 toward domestic owners with no known Hedonist trait and no scandal in the last 5 years ("old money that behaves"); -2 toward foreign holders and big tech; 0 otherwise. **Human enhancement**: medical only, except for soldiers and police.
- **Radical wing**: **Militias** (5.7.2).

### 5.3.10 Summary table

| Ideology | Corporate tolerance | Human enhancement | Top demand | Radical wing |
|---|---|---|---|---|
| Liberals | 0 | Licensed | E5 Free Trade (also free speech and open borders) | Civic Resistance |
| Communists | -2 | Licensed | E4 Inheritance and Gift Tax | Red Cells |
| Accelerationists | +1 (+2 tech) | Unrestricted | T3 Unregulated | Unshacklers |
| Effective Altruists | By giving (-2 to +2) | Licensed | T3 Licensed Models | Pause Front |
| Transhumanists | +1 | Unrestricted | T3 Unregulated | Grinder networks |
| Neo-Luddites | -2 (automation) / -1 | Medical Only | L3 Heavy | The Unplugged |
| Sovereigntists | +1 | Unrestricted | C6 Sovereign Charters | Free Zone Cells |
| Landites | +2 | Unrestricted | T3 Unregulated | Dark Enlightenment cells |
| Chuds | +1 domestic owners / -2 foreign and tech | Medical Only | L5 Closed | Militias |

---

## 5.4 Ideology in the population

### 5.4.1 Starting mix by segment

Default mix (%) for a high-income country at game start **(T)**. Each row sums to 100. Segments sit inside the five strata (2.8.0); a stratum's mix is the population-weighted mix of its segments, and that is what politics reads (4.4.2).

| Segment | LB | CO | AC | EA | TH | NL | SV | LA | CH |
|---|---|---|---|---|---|---|---|---|---|
| Elite | 30 | 1 | 18 | 8 | 6 | 1 | 14 | 10 | 12 |
| Professionals | 40 | 8 | 10 | 9 | 9 | 6 | 4 | 3 | 11 |
| Skilled Workers | 30 | 16 | 2 | 2 | 4 | 12 | 1 | 1 | 32 |
| Unskilled Workers | 24 | 22 | 0 | 1 | 2 | 14 | 0 | 1 | 36 |
| Gig Workers | 22 | 24 | 6 | 1 | 10 | 10 | 6 | 3 | 18 |
| Unemployed | 16 | 28 | 1 | 0 | 2 | 16 | 1 | 2 | 34 |

### 5.4.2 Country and city modifiers

Country data adds points to the starting mix (taken proportionally from the rest), for example **(T)**:

| Where | Modifier |
|---|---|
| United States | CH +5, AC +3 in Elite and Professionals, LA +2 in Elite; LB -5 |
| China | CO +10 (official), CH +5 (nationalist); LB -10, SV -5 (driven underground) |
| Germany, Nordics | LB +8, EA +3; CH -5 |
| India | CH +10; LB -5 |
| Russia | CH +12; SV +3 underground |
| Gulf states | CH +8; LA +5, SV +5 among Elite |
| Bay Area Metro | AC +10, EA +5, TH +5, LA +3 among Professionals and Elite |
| Tel Aviv (city province), Bengaluru Metro | AC +5, TH +3 among Professionals |
| Metros with large slum shares (Lagos, Mumbai, Jakarta, Cairo) | CO +5, CH +5, SV +3 among Gig and Unemployed |
| Singapore and Dubai Metros, Zurich city province | LB +5, SV +5, LA +3 among Elite and Professionals |

City modifiers apply in every member province of a Metro. Countries also carry a **religious culture** flag (CH +5 in every segment) and a **revolutionary memory** flag (CO and CH +3) from data.

### 5.4.3 Conviction

Conviction (0 to 10) is the Vic2 consciousness of a segment: how political it is. It moves 20% of the way to its target each month **(T)**.

```
Target conviction = segment base
                  + 0.05 × (unrest - 30)
                  + 1 if a movement of the segment's leading ideology is active in the province's city (or the province)
                  + 1 if the country is at war
                  + 2 if the segment's leading ideology is banned under G4 (5.10)
                  + 0.5 × campus level in the province (Professionals only)
                  + event modifiers
clamped to 0..10
```

Segment base: Elite 5, Professionals 5, Skilled 3, Unskilled 2, Gig 3, Unemployed 2 **(T)**.

Effects:

- **Turnout**: +1 point per point of conviction above 3 (adds to 4.6.4).
- **What moves them**: low-conviction segments follow the media; high-conviction segments follow their own conditions. Media and propaganda points in drift are multiplied by `1.5 - 0.1 × conviction`; condition points by `0.5 + 0.1 × conviction` (5.5.1).
- **Movements**: only believers in segments with conviction ≥ 4 count toward movement Strength.
- **Radicalism**: radical share scales with conviction (5.6.3).

---

## 5.5 Ideology drift

### 5.5.1 Monthly drift formula

Each month, for each segment s in each province, every ideology i gets an **attraction** score:

```
A(s,i) = Base(s,i)
       + ConditionPoints(s,i) × (0.5 + 0.1 × Conviction_s)
       + MediaPoints(s,i)     × (1.5 - 0.1 × Conviction_s)
       + PolicyPoints(s,i) + EventPoints(s,i) + MovementPoints(s,i)
clamped at 0 or more
```

- **Base(s,i)** = the starting mix share (5.4.1 plus 5.4.2), so a country with no change drifts nowhere.
- **Target share** `T(s,i) = A(s,i) / Σ_j A(s,j)`.
- **Drift**: `Ideo(s,i) += 0.06 × (T(s,i) - Ideo(s,i))` each month **(T)**. A segment closes about half the gap in a year.
- **Spillover**: 10% of each month's gain of an ideology is shared among the ideologies adjacent to it (kin pairs included), so a rising ideology pulls its neighbours along **(T)**.

### 5.5.2 Condition points

Measured locally (province and segment) unless stated **(T)**:

| Condition | Points |
|---|---|
| Unemployment above 6% (per point) | CO +1.0, CH +1.0, NL +0.5, LB -0.5 |
| Automation layoffs in the segment over 12 months (per % of the segment) | NL +3, CO +1.5, CH +0.5, AC -1 |
| Needs satisfaction below 0.8 (per 0.1) | CO +1, CH +1 |
| Inflation above 4% (per point) | CH +0.5, CO +0.3, LB -0.3 |
| Real GDP growth above 3% (per point) | AC +0.5, LB +0.3, LA +0.2 |
| Elite share of province wealth above 30% (per 5 points) | CO +1.5, CH +0.5 |
| Human enhancement users (life extension, gene therapy) per 1,000 adults in the province (per 10) | TH +1 in Elite, Professionals and Gig; NL +0.5 and CH +0.5 in Skilled, Unskilled and Unemployed (backlash) |
| Country AI share (per 10% of world compute held in the country, 6.8.2) | AC +1, EA +1, NL +1, LA +0.5 |
| Frontier AI incident in the last 12 months (event) | EA +4, NL +4, LA +1 ("the machine is waking"), AC -2 |
| Climate disaster in the country in the last 12 months (per disaster) | NL +2, LB +1, EA +1 |
| Crypto share of household savings in the country (per 5%, 3.23) | SV +1, LA +0.5 |
| L5 Immigration at Open | CH +3 in Skilled, Unskilled and Unemployed |
| T4 Surveillance at Mass Surveillance or Social Credit | SV +3, LB +1 |
| Country at war | CH +5, CO +1 (in a losing war) |
| Country stability below 40 | CH +2, CO +2, LA +2 ("democracy has failed"), LB -2 |
| Three or more bills stalled in the last year (gridlock) | LA +1, CH +1 |
| Province is in a Corporate Zone (4.12) | SV +5 and LA +2 inside; CO +2 and CH +2 in the rest of the country |
| The head of a Megacorp at Heat ≥ 60 from a scandal in the last 3 months (4.17.4) | CO +1, CH +1, LB +0.5 |
| Campus education output in the province (per campus level, Professionals only) | LB +0.5, EA +0.5, TH +0.5 |

### 5.5.3 Media points

- **Outlets**: each outlet has an ideology line (4.4.5): alignment from -1 to +1 with each ideology, set by the owner. `MediaPoints(s,i) = 10 × Σ_outlets (audience share among s × credibility/100 × alignment(outlet, i))` **(T)**. An outlet with 30% of a segment's audience, credibility 70, pushing Accelerationism at +1 adds 2.1 points before the conviction multiplier.
- **Ideology campaigns**: the ad campaigns and psyops of 2.5.7 and 4.10.1 can promote or attack an ideology in a province, city or country: +1 point per active ad campaign, +3 per active psyop, decaying as their originals **(T)**. Psyop exposure applies.
- **Think tanks** (4.18.2) adopt an ideology: +2 points to it among Professionals and Elite in their country for as long as they are funded **(T)**.
- **Influencers**: activist characters (4.24.1) carry an ideology and add `Fame / 25` points to it among the segments that follow them. Chud and Landite influencers reach Gig Workers and young Professionals at ×1.5 (the most online ideologies) **(T)**.

### 5.5.4 Policy, event and movement points

- **Policy points**: each law in force at a position an ideology holds at ++ gives it +0.5 (people like what works for them) while stability ≥ 60; below 40 it gives -1 instead (people blame the ruling ideas) **(T)**.
- **Ruling ideology**: +2 while stability ≥ 70, -3 while stability < 30 **(T)**.
- **Event points**: from events (5.12), for example "A Machine Took My Job" +5 NL in one province for 6 months.
- **Movement points**: an active movement adds +2 to its ideology in the provinces where it organizes; a radical wing attack adds +1 to its ideology among radicals and -2 among everyone else for 3 months (backlash) **(T)**.

---

## 5.6 From ideology to blocs, parties and unrest

The nine ideology blocs are the political actors, and votes are counted by strata ([4-politics.md](4-politics.md) 4.0, 4.4; Logan, batch 37).

### 5.6.1 Bloc support base

A stratum's support for a bloc, `Aff(s,i)`, is the share of that stratum holding ideology i: the population-weighted mix (5.4) of the segments in the stratum, after country and city modifiers (5.4.2) and drift (5.5). 4-politics 4.4.2 gives the starting table. There is no fixed class table: what a stratum wants is what it believes.

### 5.6.2 Bloc stances and leaders

Each bloc's stances are its ideology's wants and opposes (5.3), capped at ±2.

Every bloc has a **leader**, a character of its ideology (5.8). **Bloc leadership contests** (yearly, and when a leader dies, is jailed or is disgraced): candidates are the bloc's top 3 characters by influence (area influence, 2.5). Weight = `influence + backing` **(T)**. **Backing** is where the player plays: fund a candidate (+1 per $ equal to M/200, cap +15, exposure as Fund Ideology), endorse through owned media (+5), or remove a rival with a scheme or scandal. A leader who is a Friend of the player, or over whom the player holds a hook (1-corporate-core 1.1.4), can be called on in deals, like any character.

### 5.6.3 Radical share

Unrest (2.8.5) stays the Vic2 militancy. Ideology decides what the angry do with it.

`Radical(s,i) = Ideo(s,i) × max(0, (Unrest_s - 40) / 60) × (Conviction_s / 10) × RadicalFactor_i × Repression` **(T)**

- **Repression**: ×1.5 if the ideology is banned under G4 (5.10), ×1.2 under S2 Militarized, ×0.8 under S2 Community.
- Example: Neo-Luddites at 18% of a segment, unrest 62, conviction 5: `18% × 0.367 × 0.5 × 1.2 = 4.0%` of that segment are radicals.
- A province's **radicals** for ideology i = `Σ_s Pop_s × Radical(s,i)`; a city's radicals are the sum over its provinces.

### 5.6.4 Parties and voting

Every party has a **platform ideology**, the ideology of its leader.

**Vote utility** (replaces the Ideology term in 4.6.3), for each stratum s (4.4.1):

`U(s,p) = 2 × Ideology(s,p) + 2 × IdeoFit(s,p) + Incumbency + Economy + Campaign + Media + Ads + Psyops + Candidate - Scandal`

- **Ideology(s,p)**: the 4.6.3 term, computed from bloc support Aff (5.6.1).
- **IdeoFit(s,p)** = `Σ_i Ideo(s,i) × Match(i, platform_p)`. Match: same 1, adjacent 0.5, distant 0, opposed -0.5 **(T)**. Range -0.5 to 1.
- **Candidate**: a candidate whose own ideology matches the platform gets +0.1; one who is opposed gets -0.3 and a "Flip-Flopper" news cycle **(T)**.

**Platform review (yearly)**: if the leading ideology of a party's voters is not the platform or adjacent to it, there is a 30% chance the party's leadership changes and the platform follows its voters **(T)**. This is how a centre-right Liberal party becomes a Chud party over a decade of plant closures.

**New parties (yearly)**: in a democracy where G4 allows it, an ideology held by 12% or more of adults with no party whose platform is the same or adjacent spawns a new party with 25% chance **(T)**. It starts with no bloc backing (Ideology term 0) and grows on IdeoFit alone, the way real insurgent parties do. Blocs may later move their backing to it (the split and merge rules of 4.4.7).

### 5.6.5 Stability: ideological legitimacy

Two terms are added to the stability formula (4.11.7) **(T)**:

- `- 0.2 × max(0, OpposedShare - 40)`, where OpposedShare is the share of adults whose ideology is Opposed to the ruling ideology. A government most of the country despises is fragile.
- `- 2 × active radical wings` in the country (cap -10).

---

## 5.7 Movements and radical wings

### 5.7.1 Movements

A **movement** is the legal, organized side of an ideology: marches, petitions, boycotts, campaigns. One movement per ideology per country at most.

- **Forms** when believers with conviction ≥ 4 are at least 5% of the country's adults **and** the ideology's top demand (5.3.10, or the highest-weighted ++ law not in force) is not in force **(T)**.
- **Strength** = believers with conviction ≥ 4 as a share of adults.
- **Demand**: one law position. When it is enacted the movement dissolves, its ideology's conviction falls by 1 everywhere, and it may re-form later around the next demand.
- **Leader**: an activist character with the ideology (4.24.1), who can be bought, discredited, jailed or replaced, like a bloc leader.

**Monthly effects** **(T)**:

| Strength | Effects |
|---|---|
| 5% or more | Campaign support +Strength/2 for bills toward its demand (cap +20); its ideology +2 drift points in provinces where it organizes |
| 10% or more | Starts protests (4.24.2) at Momentum 20 in the 2 largest cities where its ideology leads, at most once per quarter |
| 15% or more | **Boycotts**: companies whose brand alignment with the ideology is -0.05 or worse (5.9.2) lose `Strength ÷ 2` productivity points (10.0.4) on their business units in the country, and their owner loses 2 Favor, while the boycott lasts (3 to 12 months) |
| 25% or more | The movement can call a **political strike** with the unions (4.24.3) if their leader shares or is adjacent to its ideology |

**Answers** for governments and owners: concede the demand, pass a compromise one step toward it (Strength -5, conviction -0.5), co-opt the leader, discredit it through media (Strength -2 per month while the campaign runs), or ban it (5.10).

### 5.7.2 Radical wings

A **radical wing** forms when a country has an active movement of an ideology **and** some city (or province outside a city) has radicals of that ideology of at least 1% of its labor force for 3 months running **(T)**. It operates as **cells** in every city (or province outside a city) where that holds.

- **Cell Strength** (on the Security Strength scale of 4-politics 4.23) = `radicals in the city ÷ 2,000`, cap 100 per city (or province outside a city) **(T)**. Ten thousand radicals make a Strength 5 cell, roughly an armed response team.
- **Funding**: a wing can be funded by anyone, including the player (dirty money only, 4.20.1; exposure +15 per funding action; a criminal-tier scandal if exposed). Funding at `$ = M/100` per month doubles cell Strength **(T)**.
- **Operations**: each week a wing rolls one operation per cell at `5% × cell Strength / 10` (cap 25%) **(T)**. Targets are picked by ideology, and a holder's assets are hit in proportion to how much they match the target list. Security Strength in the target's province (guards, police) cuts success: success chance = `cell Strength / (cell Strength + defender Strength)`.
- Every operation adds +1 revolution pressure (4.8.5) per 10 cell Strength involved, and its backlash (5.5.4).

| Ideology | Radical wing | Targets | Operations **(T)** |
|---|---|---|---|
| Liberals | **Civic Resistance** (no cells) | Governments that break the rules | Instead of attacks: mass non-violent protests (start at Momentum 30), court challenges against laws they oppose at ×2 strike-down chance (4.5.11), capital flight of 2% of believer Elite holdings per month while stability is below 40 |
| Communists | **Red Cells** | Elite real estate, megacorp offices, executives | Factory occupation (a business unit's output 0 for 1 to 4 weeks, workers run it), expropriation raid (real estate condition -10, cash loss), kidnapping of an executive (2.21.8) |
| Accelerationists | **Unshacklers** | Regulators, licensed AI labs, moratorium enforcement | Leak research from paused labs (rival AI labs units gain +5 productivity for free), sabotage regulator systems (agency Capacity -20% for 3 months), run illegal labs in havens |
| Effective Altruists | **Pause Front** | Frontier AI labs and their owners | Mostly non-violent: sit-ins at labs (output -20%), recruiting whistleblowers inside AI companies (whistleblower chance ×2, 4.20.5). 10% of operations are sabotage of compute (data center output -30% for 2 weeks) |
| Transhumanists | **Grinder networks** | Biotech and longevity IP, pharma patents, enhancement bans | Steal and publish gene therapy and longevity designs (the owner's pharma units lose 10 productivity), run unlicensed longevity clinics, break out people jailed for illegal enhancement |
| Neo-Luddites | **The Unplugged** | Data centers, automated business units (logistics, manufacturing, robotics), delivery robots, longevity clinics and biotech labs | Machine-smashing (the unit's productivity -15, automation offline 2 to 6 weeks), drone and robot destruction, power substation attacks (electricity shortage in the city or province for 1 to 3 days) |
| Sovereigntists | **Free Zone Cells** | The state's hold on a city, surveillance contractors | Unofficial secession referendums (stability -3), private security takes over province policing where S2 Privatized allows (counts for 4.12 progress), hack and leak against surveillance firms (exposure +10 in one domain for the target, a scandal adding Heat 40) |
| Landites | **Dark Enlightenment cells** | "The Cathedral": journalists, regulators, academics, NGOs | Doxxing and intimidation (a journalist or NGO leader quits, 4.17.3 and 4.24.1), regulator sabotage (agency Capacity -15% for 3 months), coup plots with officers in the army and police (+5% coup risk, 4.8.3), always quietly funded by someone rich |
| Chuds | **Militias** | Foreign-owned business units, migrant neighbourhoods (the slum share of Residential pools), longevity clinics, AI labs | Arson on foreign-owned business units (productivity -20), attacks on longevity clinics and their patients (health event), roadblocks on trade routes, riots (+10 unrest among slum residents) |

**Ending a wing**: it dissolves when its radicals fall below 0.5% in every city and province for 3 months, when its movement's demand is met, or when security operations destroy all cells (a cell whose Strength is beaten by 3× defender Strength in a crackdown is destroyed; each crackdown follows the 4.24.2 Police or Private security answers, with the martyr risk).

### 5.7.3 Revolutions take an ideology

When revolution pressure reaches 100 (4.8.5), the revolutionary coalition's **leading ideology** (the ideology with the most radicals among the coalition's supporters) decides the new state. Replace the "New HSS and variant after a revolution" rule with **(T)** (batch 136: there are no government types; a revolution sets Head of State Strength, resets Legislature and Judiciary Strength to the 4.2.1 formula, and may add a play variant, 4-politics 4.2.5 and 4.2.6):

| Leading ideology | New HSS, variant and flavor | Imposed at once |
|---|---|---|
| Communists | HSS 92, one ruling party (G4 Single Ideology), "People's Republic of [Country]" | E4 Inheritance and Gift Tax, C5 State Administration, F2 Hard Controls; nationalization of every foreign holder and of domestic holders above the Mogul wealth tier (70%) |
| Liberals, Effective Altruists, Transhumanists | HSS 45 (Open) | The ideology's ++ laws |
| Neo-Luddites | HSS 72 (Guided), "Human Republic" | T3 Moratorium, L3 Heavy |
| Chuds | HSS 75 (60%), or HSS 90 with the Military Council variant (40%), "National Restoration" | L5 Closed, C1 Capped All; seizure of foreign-owned business units (50%) |
| Accelerationists | Council of Stakeholders variant (if a capture chain exists, 4.2.5), otherwise HSS 45 (Open) | T3 Unregulated, C6 Charter Zones |
| Landites | Council of Stakeholders variant, "Neocameral State" (if no capture chain exists, the holder with the largest national influence is offered one) | T3 Unregulated, G1 Unlimited Dark Money, G4 Licensed Opposition; Patchwork decision available at once |
| Sovereigntists | The revolution's cities and provinces become "Free Zones" with collapsed-state enforcement (30%, 4.3.3); the rest of the country keeps its HSS | C6 Sovereign Charters, F5 Haven and T4 Limited in the zones |

The 4.8.5 consequences for business stay, with the nationalization chance using Corporate tolerance: `30% + 10% × (number of coalition ideologies with Corporate tolerance -2)`.

---

## 5.8 Character ideology

### 5.8.1 Every character believes something

Every character has an **ideology** (one of the nine, or **Apolitical**) and a **commitment**: **Lukewarm**, **Committed** or **Zealot**. It works like CK3 faith.

**How a character gets one** (when the character is generated, and re-rolled on some life events) **(T)**:

- 60% the leading ideology of their segment in their birth province (relatives are flavor only, batch 116)
- 25% from their Education trait: Ivy League MBA (LB or AC), Bootcamp Coder (AC, TH or SV), Military Contractor (CH or LA), Street-Taught (CO or SV), Old Money Tutors (LB or LA), Quant PhD (EA or AC), Law School (LB), Party School (the ruling ideology)
- 15% random, weighted by country mix

Personality shifts the odds: Visionary +AC, TH, LA; Conservative +CH, NL; Compassionate +LB, EA, CO; Ruthless +LA, AC; Paranoid +CH, SV **(T)**.

### 5.8.2 Opinion

Ideology gives a yearly opinion push between two characters (1-corporate-core 1.1.4) **(T)**:

| Relation | Lukewarm | Committed | Zealot |
|---|---|---|---|
| Same ideology | +5 | +10 | +20 |
| Adjacent | +3 | +5 | +5 |
| Opposed or rival pair | -5 | -15 | -30 |

The larger of the two characters' commitments applies. Apolitical characters neither give nor receive ideology pushes.

### 5.8.3 What character ideology does

- **Board and executives**: an executive's ideology adds a preference to their AI decisions. A Neo-Luddite COO resists automation retooling (the task runs at -20% speed), an EA CFO proposes foundation transfers, an Accelerationist CTO pushes AI R&D, a Chud board member votes against foreign sales, a Landite general counsel suggests buying the regulator instead of complying **(T)**. Board members with an ideology Opposed to the CEO's get a -10 push toward the CEO and are more likely to join a faction (1-corporate-core).
- **Vassal CEOs**: -10 loyalty when the liege CEO's ideology is Opposed to theirs; +5 when the same **(T)**.
- **Politicians and patronage**: client politicians obey a patron more readily when ideologies match (Favor cost -25% for the same ideology, +50% for Opposed) **(T)**.
- **Bloc and movement leaders**: see 5.6.2 and 5.7.1.
- **Judges**: the judge's "Ideology" in 4.21.1 is now a character ideology; law challenges against the judge's ++ laws fail 20% more often **(T)**.
- **AI rivals**: the Ideologue archetype (4.27.3) funds the rival's own ideology through think tanks, movements and parties, even against business interests. Landite rivals favour capture chains; Sovereigntist rivals, charter zones.

### 5.8.4 Secret ideology and converting

Family friction is removed (batch 116): there are no dynasties, heirs, family lines or Red Heir. What stays works between any two characters:

- **Secret ideology**: a character can hide their ideology (like a CK3 secret faith). Hidden ideology shows as Apolitical, or as a declared ideology they fake; discovery is an Intrigue scheme or an event, and gives a hook. An executive secretly funding the Pause Front against their own company's AI lab is a classic.
- **Converting**: a **Persuade** scheme (Persuasion vs the target's Persuasion + 5 × commitment level) changes another character's ideology over 3 to 12 months. Zealots cannot be persuaded, only broken by events.

### 5.8.5 Changing ideology

A character re-rolls their ideology (weighted toward ideologies adjacent to their current one) on these events: losing a job to automation (NL, CO weights ×3), a major enhancement treatment such as life extension (TH ×3, CH ×0.5), a near-death experience, a religious conversion event (CH ×3), a close friend's death, a prison term (CO, CH, SV ×2), an AI incident they witness (EA, NL ×3), or becoming a billionaire (AC, SV, LA ×2) **(T)**. Zealots only re-roll on two of these in a row.

---

## 5.9 Ideology and business

### 5.9.1 Favor

Favorability is gone (batch 116): the public side is the owner's **Favor** (Image, [1-corporate-core.md](1-corporate-core.md) 1.1.0). Each month, the character who controls a company gets an ideology term on their Favor **(T)**:

`+ 0.5 × Σ_c w_c × Σ_i Ideo(c,i) × CorporateTolerance(i, owner)`

where `Ideo(c,i)` is ideology i's share of adults in country c and `w_c` is the share of the owner's business assets in that country **(A)**. A country that is 40% Communist and 20% Accelerationist gives `0.5 × (0.4 × -2 + 0.2 × +1) = -0.3` Favor a month for assets there (with tech assets the Accelerationists give +2, so `-0.2`).

### 5.9.2 Brand alignment

Every company has an **ideology alignment** per ideology (-1 to +1), built from **(T)**:

- **Industry** (10.3): AI and cloud (AC +0.5, LA +0.3, EA -0.2, NL -0.6), biotech, pharma and longevity healthcare (TH +0.8, CH -0.6, NL -0.6), oil, coal and heavy industry (NL -0.3, LB -0.2, CH +0.2), defense and surveillance (CH +0.3, LA +0.3, SV -0.3, LB -0.2), luxury (CO -0.4).
- **Conduct over the last 3 years**: automation layoffs (NL -0.1 per 1,000 jobs, CO -0.05, CH -0.05), foundation giving (EA +0.1 per 0.5% of revenue), carbon cuts (LB +0.1, NL +0.1), union contracts (CO +0.1, LB +0.1), business units in a closed country (CH -0.1 at home), data scandals (SV -0.3, LB -0.2).
- **Owner**: the controlling character's public ideology adds +0.2 to that ideology and -0.2 to Opposed ones.

**No sales appeal (Logan, batches 75 and 116).** Brand alignment does not multiply sales or demand: each industry has one world market. Alignment only feeds boycotts, which cost productivity (5.7.1), and the owner's Favor (5.9.1).

### 5.9.3 Workforce

Employees carry their segment's ideology mix **(T)**:

- Each business unit's strike chance (2.8.6) is multiplied by `1 + Σ_i Ideo(s,i) × (RadicalFactor_i - 0.5)`, using the workers' segment in its base province ([10-industry-economy.md](10-industry-economy.md) 10.0.2).
- Neo-Luddite and Communist shares above 20% in a business unit's workforce make automation retooling trigger a **sabotage risk**: 2% per month per 10 points above 20 during retooling.
- Chud share above 30% in a foreign-owned business unit adds +1 unrest per month there until it has a local CEO or a local partner (C2).

---

## 5.10 The new law: G4 Political Pluralism

A new Governance law (national, exclusive) sets which ideologies may organize **(T)**:

| Position | Effects |
|---|---|
| **Free Pluralism** | Any ideology may form parties and movements. Radical wings are crimes; movements are not |
| **Extremists Banned** | Ideologies with Radical factor ≥ 1.0 (Communists, Neo-Luddites, Chuds) cannot form parties; their movements are illegal (joining is a crime; their protests start at Momentum 10 but Repression is free) |
| **Licensed Opposition** | Only parties licensed by the government may stand; movements need a permit (a lobbyable decision, 4.3.5) |
| **Single Ideology** | The ruling ideology is the state ideology; every other ideology is banned |

**Banned ideologies**: drift target ×0.5 (people hide), conviction +2, radical share ×1.5 (5.6.3), and their believers' votes count as 0 for the banned party. Repression works in the short run and builds pressure in the long run.

**Default positions** by HSS band and variant (4-politics 4.2.1): Open (HSS below 60) Free Pluralism (Germany-like countries Extremists Banned), Guided (60 to 84) Licensed Opposition, Dominant (85 or more) Single Ideology, Military Council Extremists Banned, Council of Stakeholders Licensed Opposition, Collapsed Free Pluralism (unenforced).

**Bloc stances**: Liberals ++ Free Pluralism; Landites + Licensed Opposition always; every other ideology + Free Pluralism, except when it rules, when Communists want Single Ideology (++) and Chuds want Extremists Banned (+), aimed at the Communists **(T)**.

---

## 5.11 What the player can do

| Lever | How | Cost and risk **(T)** |
|---|---|---|
| **Promote an ideology** | Ideology ad campaign or psyop in a province, city or country (5.5.3) | As 2.5.7 and 4.10.1; psyop exposure |
| **Set an editorial line** | Owned outlets push an ideology | 4 weeks, -5% audience; credibility -5 if the line flips more than once a year |
| **Fund a think tank for an ideology** | 4.18.2, ideology mode | As 4.18.2; slow, durable |
| **Back a bloc leader** | Leadership contest (5.6.2) | Money and exposure as Fund Ideology; a defeated candidate remembers |
| **Co-opt or discredit a movement** | Bribe the leader, offer a compromise bill, smear campaign | Bribe chain (4.20.3); a smear exposed is a major scandal |
| **Seed a counter-movement** | Astroturf movement of a rival ideology (4.24.3 seed rules) | Exposure +5 per start; major scandal if exposed |
| **Fund a radical wing** | Dirty money to a wing's cells (5.7.2) | Criminal-tier scandal if exposed; the wing may turn on its funder (10% per year) |
| **Defend assets** | Guards, bodyguards, cyber defense (4.23) | Security costs; crackdowns risk martyr events |
| **Defuse at the source** | Retraining, severance, union contracts, foundation giving in the province | Money; slow but lowers NL and CO drift (each 1% of a segment retrained cancels 1 point of automation layoffs) |
| **Rebrand** | Change conduct: giving, carbon cuts, union deals, a local partner | Money; alignment moves over months |
| **Go public with your ideology** | Declare the player character's ideology (5.9.2) | Opposed segments and characters turn hostile |
| **Convert a character** | Persuade scheme (5.8.4) | Time, opinion risk |
| **Lobby G4** | Ban the ideology that threatens you | Banned ideologies radicalize; foreign relations -5 with Free Pluralism countries |

---

## 5.12 Sample events

| Event | Trigger | Choices and effects **(T)** |
|---|---|---|
| **A Machine Took My Job** | Automation layoffs of 500+ in a province by a company you control | Fund retraining ($12,000 × WI per worker; NL drift cancelled) · Severance only (NL +3 in the province for 6 months) · Say nothing (NL +5, CO +2, a local protest at Momentum 30) |
| **The Manifesto Goes Viral** | An ideology's movement reaches 10% | Amplify through owned media (ideology +3 for 3 months, your companies' alignment +0.2) · Counter-programme (MediaPoints -3 for it, Heat 20 for "censorship" if SV share ≥ 10%) · Ignore |
| **Red Executive** | An executive of a company you control rolls Communist on a life event (5.8.5) | Replace them (Clout -2 with the board) · Keep them (a Neo-Luddite or Communist push on that unit's automation) · Use them: a bridge to the left (+5 Favor among CO believers, Clout -5) |
| **The Neocameral Pitch** | A Landite think tank or donor approaches the player with Power Broker national share | Fund the capture chain (capture progress +10, exposure +10, Favor -10 among Liberals) · Take the money and stall (they remember) · Expose them (LB alignment +0.2; a Dark Enlightenment cell targets your outlets) |
| **Pause Letter** | Frontier AI incident anywhere, and the player controls an AI lab | Sign the pause (EA alignment +0.5, AC -0.5, AI R&D -50% for a year) · Refuse (AC +0.3, EA -0.5; Pause Front targets the lab) · Sign publicly, keep building secretly (exposure +10, a secret) |
| **Grinder Raid** | Grinder network operation against your biotech or longevity company | Sue (4.21.2) · Hire them (they become an unlicensed R&D team; exposure +5) · Call the police (crackdown chance; martyr risk among TH) |
| **Exit Vote** | Sovereigntist share ≥ 30% in a Charter Zone city or province | Back the referendum (4.12 progress +10; national relations of the player -20) · Stay quiet · Oppose it (Clout +5) |
| **Bio-Purity March** | Chud movement protests in a province with your longevity clinic | Close the clinic for a month · Hire guards · Fund a Transhumanist counter-march (Momentum duel; Heat 30 for both sides) |
| **The Leak** | A Free Zone Cell hack-and-leak hits you | Pay for silence (the leak is delayed; they ask again in 6 months) · Get ahead of it (the story on your terms, its Heat share halved) · Trace them (Intrigue scheme; success breaks the cell, failure doubles the leak) |
| **Militia at the Gate** | A Chud militia blocks a foreign-owned business unit | Pay local protection (4.22) · Hire more guards (incident risk) · Take a local partner (C2-style 30% sale; CH alignment +0.3 at home) |

---

## 5.13 Changes to other files

The ideology layer changes these existing rules. The changed sections now point here.

| File and section | Change |
|---|---|
| 4-politics 4.4.2 | Bloc support by stratum comes from the ideology mix (5.6.1) |
| 4-politics 4.4.3 | Bloc stances are the ideology's wants; bloc leaders (5.6.2) |
| 4-politics 4.5.1, 4.5.8 | New law G4 Political Pluralism (5.10) |
| 4-politics 4.6.3 | Vote utility adds IdeoFit; the Ideology weight drops from 3 to 2 (5.6.4) |
| 4-politics 4.6.4 | Turnout gains a conviction term (5.4.3) |
| 4-politics 4.8.5 | New government after a revolution follows the leading ideology (5.7.3) |
| 4-politics 4.11.7 | Stability gains a legitimacy term and a radical wing term (5.6.5) |
| 4-politics 4.16.2 | Favor gains a Corporate tolerance term (5.9.1) |
| 4-politics 4.21.1, 4.27.3 | Judges and Ideologue rivals use character ideology (5.8.3) |
| 2-map-and-influence 2.8.6 | Strike chance scaled by workforce ideology (5.9.3) |
| 1-corporate-core (characters) | Characters gain ideology and commitment (5.8) |

---

## 5.14 Ideology by company rank, the Zeitgeist endgame and the UI

### 5.14.1 By company rank

What ideology and politics offer at each company rank is in [4-politics.md](4-politics.md) 4.28.

**Zeitgeist** (new political endgame for 4.29): the player character's public ideology is the ruling ideology **and** held by 35% or more of adults in 2 countries (one with GDP ≥ $1T) for 10 years, with the player the largest funder of that ideology's think tanks and media in both. Score +2,000 for the player **(T)**.

### 5.14.2 UI

- **Map mode "Ideology"**: each province coloured by its leading ideology, with shading for conviction; a toggle shows radical share as hot spots.
- **Province panel** (and the Metro card, summed): a stacked bar per segment with the nine ideology shares and trend arrows; hover shows the drift tooltip (each condition, media and policy term).
- **Politics screen** (4.15.1) gains a **Movements** tab: active movements, Strength, demand, leader, and radical wings with cell Strength by city.
- **Character cards**: an ideology icon and commitment pip; hidden ideologies show as Apolitical (or the faked line) with a "?" when the player suspects otherwise.
- **Alerts**: a movement reaches 10% or 25%, a radical wing forms, a wing targets one of your assets, a character you know changes ideology.
- **Weekly political brief** (4.15.5): one line on the fastest-rising ideology in each country where the player has Power Broker share.

---

## 5.15 Worked example: robots come to Oakland

A logistics company the player controls automates its Oakland warehouses (East Bay, a province of the Bay Area Metro), cutting 6% of the Metro's Skilled Workers over a year. For simplicity the example treats the Metro's provinces as drifting alike **(A)**. Metro unemployment rises to 9% and Skilled unrest reaches 62. Skilled conviction is 5.

**Drift for Bay Area Skilled Workers** (conviction 5, so condition points ×1.0, media ×1.0):

| Ideology | Base | Automation (6%) | Unemployment (3 points over 6%) | Attraction | Target share |
|---|---|---|---|---|---|
| Chuds | 32 | +3 | +3 | 38 | 28.4% |
| Neo-Luddites | 12 | +18 | +1.5 | 31.5 | 23.5% |
| Liberals | 30 | 0 | -1.5 | 28.5 | 21.3% |
| Communists | 16 | +9 | +3 | 28 | 20.9% |
| Accelerationists | 2 | -6 | 0 | 0 (clamped) | 0% |
| Others (EA 2, TH 4, SV 1, LA 1) | 8 | 0 | 0 | 8 | 6.0% |
| **Total** | 100 | | | **134** | 100% |

(The base mix uses the Skilled row of 5.4.1; the Bay Area modifiers only touch Professionals and Elite.)

At a drift rate of 6% per month, and with the layoffs still inside the 12-month window, Neo-Luddites rise from 12% to about 18% of Bay Area Skilled Workers in a year, Communists from 16% to about 19%, and Liberals fall from 30% to about 25%. Chuds hold at about 30%.

**Radicals**: Neo-Luddite radical share = `18% × (62 - 40)/60 × 5/10 × 1.2 = 4.0%` of Skilled Workers. The Bay Area labor force is 3.85 million (half of 7.7 million) and Skilled Workers are 27% of it, so Neo-Luddite radicals are 1.07% of the labor force; Unskilled believers add another 0.4 points, for 1.47%. A national Neo-Luddite movement already exists (US Neo-Luddites passed 5% after the Detroit plant closures), so after 3 months the **Unplugged** form a cell in the Bay Area. 1.47% of 3.85 million is about 57,000 radicals: a Strength 28 cell.

Chud radicals are even more numerous (`30% × 0.367 × 0.5 × 1.0 = 5.5%` of Skilled Workers), but their militias target foreign-owned business units, so a US owner's warehouses are spared. A Chinese-owned competitor across the bay is not.

**Operations**: the Unplugged cell rolls `5% × 28/10 = 14%` per week. The player's automated warehouses match the target list perfectly. The warehouse unit has two guard details (Strength 4), so a rolled attack succeeds `28 / (28 + 4) = 88%` of the time: expect a machine-smashing night about every eight weeks, each taking its automation offline for 2 to 6 weeks.

**The player's options:**

1. **Defuse**: retrain 3% of the segment (about 31,000 workers) into maintenance and robotics jobs at $12,000 × 1.0 each, about $374M over 6 months. This cancels half the automation points: the Neo-Luddite target falls to about 19%, radical share halves within a year, and the cell dissolves when the Metro's radicals stay below 0.5%.
2. **Defend**: add a security team (Strength 10, $450k per month). Success falls to `28 / 42 = 67%`, and a crackdown with 3× its Strength (84) would destroy the cell but risks a martyr event and +3 Neo-Luddite drift across California.
3. **Deflect**: fund an Accelerationist "Abundance" ad campaign (+1 AC, before conviction effects) and push the player's own outlet's editorial line. With conviction 5 the media multiplier is only ×1.0, while conditions keep pushing the other way: this alone does not work.
4. **Bargain**: lobby for L3 Robot Tax (one step toward the Neo-Luddite demand). The movement loses Strength 5, conviction falls 0.5, and the company pays 10% of its labor savings. The Accelerationist bloc will remember (approval -1).

Most players will mix 1 and 2. A cynical player can do something else: quietly fund the Unplugged against a rival's fully automated port in Long Beach, with dirty money through two cutouts, and hope the cell never learns who paid.

---

## 5.16 Assumptions

1. **Ideology blocs are the political actors** (Logan, batch 37): segments hold an ideology mix (Vic2), strata vote, and each ideology's bloc is its organized power.
2. **Nine ideologies, chosen by Logan**: Liberals, Communists, Accelerationists, Effective Altruists, Transhumanists, Neo-Luddites, Sovereigntists, Landites and Chuds.
3. **Landites** are read as followers of Nick Land's dark accelerationism and neoreaction: they want owners to rule the state like a company (capture), where Sovereigntists want to leave it (exit). **Chuds** are read as online reactionary populists, covering nationalist and social-conservative voters.
4. **Liberals** cover the whole establishment centre (centre-left and centre-right); there is no separate social democrat or green ideology. Labor politics flows through Communists and Liberals, environmental politics through Liberals, Effective Altruists and Neo-Luddites.
5. **Three axes** (Economy, Technology, Order) place ideologies for distance, adjacency and party fit, with three kin pairs (AC and LA, SV and LA, NL and CH) counted as Adjacent and two rival pairs (AC vs EA, CO vs LA) counted as Opposed.
6. **Human enhancement** (life extension, gene therapy, brain-computer links to AI) is what each ideology's enhancement stance covers; there is no cyberware (Logan, batch 71).
7. **Conviction** is Vic2 consciousness on a 0 to 10 scale; **unrest** stays the Vic2 militancy; **radical share** combines them per ideology.
8. **Drift** moves 6% of the gap per month toward a target set by base mix, conditions, media, policy, events and movements; low conviction follows media, high conviction follows conditions.
9. **Bloc support** in a stratum is the share of believers; bloc stances are the ideology's wants, capped at ±2.
10. **Bloc leadership contests** are yearly and fundable by any character.
11. **Parties have a platform ideology** (their leader's); vote utility uses `2 × Ideology + 2 × IdeoFit`. The 4.13.3 example (a national legislature seat in Montreal since batch 121) used the old weight of 3 and will be recomputed later.
12. **New parties** spawn from unrepresented ideologies at 12% of adults.
13. **Movements** (one per ideology per country) form at 5% committed believers; **radical wings** form from 1% radicals in a city (or province outside a city) for 3 months and operate as cells on the Security Strength scale.
14. **Liberals have no violent wing** (Civic Resistance instead), and **Effective Altruists** are mostly non-violent.
15. **Revolutions** take the leading ideology of the coalition, which picks the new Head of State Strength and any variant and imposes laws at once.
16. **Characters** have one ideology (or Apolitical) with three commitment levels, CK3-faith-like opinion, hidden ideology and a Persuade scheme; no family line (batch 116).
17. **Corporate tolerance** per ideology feeds the owner's Favor, weighted by where their assets are; EA tolerance is set by the character's giving; Landites are the most pro-owner ideology.
18. **Brand alignment** per company per ideology drives boycotts (a productivity loss) and Favor; it does not change sales or demand (batches 75 and 116).
19. **G4 Political Pluralism** is a new Governance law; banning ideologies lowers their drift but raises conviction and radicalism.
20. **Zeitgeist** is a new political endgame (score +2,000).
21. **Ideology never changes influence share**, which stays rooted in assets (Logan's rule).
