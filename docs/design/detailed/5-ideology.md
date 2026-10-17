# 5. Ideology: detailed design

_Status: draft v0.2 (2026-10-16). A Victoria 2 style ideology layer with cyberpunk ideologies, requested by Logan. v0.2 uses Logan's list of nine ideologies: Liberals, Communists, Accelerationists, Effective Altruists, Transhumanists, Neo-Luddites, Sovereigntists, Landites and Chuds. It sits under the interest groups, parties, elections, unrest and revolutions of [4-politics.md](4-politics.md) and changes some of their formulas (listed in 5.13). Owner: Logan._

In Victoria 3 people belong to interest groups. In Victoria 2 people also **believe** things: every population group carries a mix of ideologies that drifts with their lives, decides how they vote and what they will march for, and can turn into a rebel movement. TechnoCapital20FF keeps the Vic3-style interest groups for organized power and adds this Vic2-style layer for belief.

- **Interest groups** (4.4) are organized power: lobbies, unions, churches, the security establishment. They have clout, leaders and money.
- **Ideologies** are what people think. They live in population segments and characters. They feed the interest groups, choose parties, shape demand for brands, and decide what kind of state comes out of a revolution.

**How to read the numbers.** As in the other detailed files, every number marked **(T)** is a starting tuning value. Formulas are written so each term can be shown in a tooltip.

**Decided rules kept intact.** Influence stays rooted in the assets a holder owns in an area (05). Ideology never changes influence share. It changes what influence can buy: how hard a law is to pass, how a segment votes, how a brand sells, and how angry people get.

---

## 5.1 Core concepts and cadence

### 5.1.1 Key terms

| Term | Range | Scope | Meaning |
|---|---|---|---|
| **Ideology mix** | 9 shares summing to 100% | Per segment per hub | What share of a segment holds each ideology |
| **Conviction** | 0 to 10 | Per segment per hub | How politicized a segment is (Vic2 consciousness). High conviction votes, organizes and follows its lived conditions; low conviction follows the media |
| **Radical share** | 0 to 100% of a segment | Per segment per hub per ideology | The part of an ideology's believers willing to break the law for it (Vic2 militancy, built on unrest from 2.8.5) |
| **Character ideology** | One ideology plus a commitment level | Per character | What a character believes. Works like CK3 faith for opinion, and like a Vic3 IG leader's ideology for politics |
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
| **Yearly** | Party platform review, new party spawning, IG leadership contests, character ideology checks at life events |

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
| 5 | **Transhumanists** | TH | 0 | +2 | -1 | 0.6 | Upgrade the body and mind; cyberware and longevity as rights |
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

Each profile lists who tends to hold it, what laws it wants (stance values as 4.4.3, law codes from 4.5), its attitude to dynasties and corporations, its cyberware stance, and what its radical wing does (5.7).

**Corporate tolerance** (-2 to +2) is how a believer feels about big companies and the dynasties that own them. It shifts the dynasty's Favorability (5.9.1) and brand appeal (5.9.2).

### 5.3.1 Liberals (LB)

The ideology of the institutions: central banks, courts, broadsheets, the reasonable centre-left and centre-right. They believe the system works if it is managed well, and they run most of the system.

- **Who**: Professionals, much of the Elite, unionized Skilled Workers in stable industries.
- **Strong wants (++)**: F1 Independent, E5 Free Trade.
- **Wants (+)**: C3 Standard, L1 Moderate, L4 Portable Benefits, L5 Managed, T1 Licensed, T2 Notice and Consent, G1 Capped, G3 Plurality Rules.
- **Opposes**: E7 Planned Prices (--), T4 Social Credit (--), S3 Standing Emergency (--), G4 Single Ideology (--).
- **Corporate tolerance**: 0 (-1 toward dynasties with a criminal-tier scandal in the last 5 years). **Cyberware**: Licensed.
- **Radical wing**: none with weapons. When angry, believers run **Civic Resistance** (5.7.2).

### 5.3.2 Communists (CO)

The cyberpunk communist does not want to smash the factory. They want to own it, and the robots, and the server farms. "The machines are already doing the work. Why do they still belong to the Elite?"

- **Who**: Unemployed, Gig Workers, Unskilled Workers in automated hubs, militant unionists, young Professionals with student debt.
- **Strong wants (++)**: E4 Dynastic Wealth Tax, E7 Planned Prices, C5 State Administration, L3 Heavy.
- **Wants (+)**: C3 Trust-Busting, C4 Stakeholder Boards, E6 State Champions, F1 Monetary Financing, F2 Hard Controls, L1 Living Wage, L2 Sectoral Bargaining, L4 Employee Presumption.
- **Opposes**: C6 Sovereign Charters (--), F5 Haven (--), S1 Unrestricted (--), L2 Banned (--).
- **Special demand**: nationalization. A Communist-led government or a Communist movement with Strength ≥ 15% adds +20 to the government's nationalization score against the largest private companies (4.9.9) **(T)**.
- **Corporate tolerance**: -2. **Cyberware**: free implants for workers, owned by nobody (+ on T1 Licensed).
- **Radical wing**: **Red Cells** (5.7.2).

### 5.3.3 Accelerationists (AC)

The sunny, techno-optimist side of accelerationism: "Regulation is a death cult. Build faster. Abundance is one more model away."

- **Who**: tech Professionals, founders, crypto Elite, some Gig Workers who believe they will get rich.
- **Strong wants (++)**: T3 Unregulated, T1 Unrestricted, E8 Lax.
- **Wants (+)**: E2 Low, C3 Laissez-faire, C6 Charter Zones, E11 Developer-Led, L3 None, L5 Open.
- **Opposes**: T3 Moratorium (--), L3 Heavy (--), E8 Carbon Pricing (-).
- **Corporate tolerance**: +2 toward companies with a Digital 3 or higher technology tier or an AI lab; +1 otherwise. **Cyberware**: Unrestricted, now.
- **Radical wing**: **Unshacklers** (5.7.2).

### 5.3.4 Effective Altruists (EA)

The movement of spreadsheets and moral seriousness: "Measure the good. Give most of it away. And whatever happens, do not let anyone build a god in a garage."

- **Who**: elite-university Professionals, some Elite heirs, AI safety researchers, philanthropic foundations.
- **Strong wants (++)**: T3 Licensed Models.
- **Wants (+)**: E4 High (with family foundations exempt), F6 Recognized, L5 Open, E8 Carbon Pricing, T2 Notice and Consent, G2 Registered and Disclosed.
- **Opposes**: T3 Unregulated (--), S1 Unrestricted (-).
- **Special trait, "impact"**: EA believers judge a dynasty by what it gives, not what it owns. Family foundation payouts (4.18.3) count double for Favorability among EA believers, and their Corporate tolerance toward a dynasty is `clamp(foundation payouts in the last 12 months ÷ (0.5% of dynasty net worth) - 1, -2, +2)` **(T)**. A dynasty that gives 1.5% of its net worth a year is loved; one that gives nothing is suspect.
- **Cyberware**: Licensed, cautious; longevity research is a top cause (+ on T1 Licensed).
- **Radical wing**: the **Pause Front**, almost always non-violent (5.7.2).

### 5.3.5 Transhumanists (TH)

The ideology behind the Transhumanist interest group (4.4.2). The interest group is the organized lobby (clinics, implant makers, longevity funds); the ideology is the belief, held by many people who never join anything.

- **Who**: implanted Professionals and Gig Workers, security staff with combat implants, wealthy longevity seekers.
- **Strong wants (++)**: T1 Unrestricted, T3 Unregulated.
- **Wants (+)**: L5 Open, T2 Notice and Consent, T4 Limited, E6 Targeted Subsidies (cyberware).
- **Opposes**: T1 Banned (--), T3 Moratorium (--).
- **Corporate tolerance**: +1 (+2 toward cyberware and pharmaceutical makers with Brand ≥ 60). **Cyberware**: a human right; implant ownership should belong to the patient.
- **Radical wing**: **Grinder networks** (5.7.2).

### 5.3.6 Neo-Luddites (NL)

"They told us the robots would free us. They freed us from our jobs." Neo-Luddites include bio-conservatives who reject implants, people whose work was taken by automation, and the anti-tech wing of the environmental movement.

- **Who**: Skilled and Unskilled Workers in hubs with automation layoffs, Gig Workers displaced by delivery robots and AI agents, rural voters, polluted towns.
- **Strong wants (++)**: L3 Heavy, T3 Moratorium.
- **Wants (+)**: T1 Medical Only, T2 Data Sovereignty, L4 Employee Presumption, E5 High, E8 Strict, T4 Limited.
- **Opposes**: T3 Unregulated (--), T1 Unrestricted (--), L3 None (--).
- **Corporate tolerance**: -2 toward companies running automation production methods (A2 or higher) or AI products; -1 otherwise. **Cyberware**: an abomination (- on T1 Licensed).
- **Radical wing**: **The Unplugged** (5.7.2).

### 5.3.7 Sovereigntists (SV)

The libertarian dream of the late game: leave the nation-state behind and live under a charter, paid in crypto, guarded by contract. They want **out**.

- **Who**: crypto holders, residents of special economic zones, Elite with homes in three countries, hackers, Gig Workers paid in crypto, the Shadow Economy.
- **Strong wants (++)**: C6 Sovereign Charters, F5 Haven, T4 Limited.
- **Wants (+)**: E2 Haven, F2 Open, F6 Opaque, S1 Unrestricted, S2 Privatized, C3 Laissez-faire.
- **Opposes**: E4 Dynastic Wealth Tax (--), T4 Mass Surveillance and Social Credit (--), F5 Open Registry (--), C5 State Administration (-).
- **Corporate tolerance**: +1 (+2 toward crypto exchanges and companies running charter zones; -1 toward data brokers and surveillance contractors). **Cyberware**: Unrestricted, ideally open-source and offline.
- **Special**: Sovereigntist share in a hub is the "popular support" input of the corporate sovereignty process (4.12.3): each 10% share among the hub's adults gives +5 progress toward the next stage **(T)**.
- **Radical wing**: **Free Zone Cells** (5.7.2).

### 5.3.8 Landites (LA)

Named for the philosopher Nick Land, whose term "techno-capital" this game borrows. Where Sovereigntists want to leave the state, Landites want to **own** it. "Democracy is a slow, stupid computer. Capital is the real intelligence. Let the owners run the country like a company, and let the machine finish waking up."

- **Who**: a slice of the Elite, young tech Professionals radicalized online, PMC officers, heirs who read too much.
- **Strong wants (++)**: T3 Unregulated, G1 Unlimited Dark Money, E4 None.
- **Wants (+)**: C6 Sovereign Charters, L2 Banned, S1 Unrestricted, S3 Standing Emergency, T4 Mass Surveillance, F6 Opaque, G4 Licensed Opposition.
- **Opposes**: E4 Dynastic Wealth Tax (--), L2 Sectoral Bargaining (--), C4 Stakeholder Boards (--), G1 Public Funding Only (--).
- **Special, "Neocameralism"**: Landites are the only ideology that **wants** the player to rule. Landite share among a country's Elite adds +1 progress per month per 10 points of share to a corporate oligarchy capture chain (4.2.5) that a dynasty is running there **(T)**. A Landite head of government can take the **Patchwork** decision: sell the governance of one hub to the highest corporate bidder, fast-tracking it to Stage 2 of corporate sovereignty (4.12) **(T)**.
- **Corporate tolerance**: +2 (the most pro-dynasty ideology in the game). **Cyberware**: Unrestricted; humans are a transitional species.
- **Radical wing**: **Dark Enlightenment cells** (5.7.2).

### 5.3.9 Chuds (CH)

The online reactionary populists: angry at elites, immigrants, implants, AI, "globalist" megacorps and the Effective Altruists who lecture them. They want a strong leader, closed borders, traditional families and natural bodies. They are the largest ideology among Skilled and Unskilled Workers at game start.

- **Who**: Skilled and Unskilled Workers in declining hubs, the Unemployed, rural and religious voters, much of the Security Establishment's rank and file, young men online.
- **Strong wants (++)**: L5 Closed, E5 High, T1 Medical Only.
- **Wants (+)**: C1 Capped All, C2 Local Partner 51% and Tech Transfer, E4 Low, S2 Militarized, S3 Emergency Decrees, T2 Data Sovereignty, T3 Moratorium.
- **Opposes**: L5 Open (--), T1 Unrestricted (--), C6 Sovereign Charters (--), T4 Social Credit (-).
- **Special, "anti-globalism"**: a Chud movement with Strength ≥ 15% adds +10% to the branch office seizure risk (4.9.10) of every foreign holder in the country, and foreign dynasties take -10 Favorability there **(T)**.
- **Corporate tolerance**: +1 toward domestic family dynasties with no family member under the Hedonist or Scandal-Ridden traits ("old families that behave"); -2 toward foreign holders and big tech; 0 otherwise. **Cyberware**: medical only, except for soldiers and police.
- **Radical wing**: **Militias** (5.7.2).

### 5.3.10 Summary table

| Ideology | Corporate tolerance | Cyberware (T1) | Top demand | Radical wing |
|---|---|---|---|---|
| Liberals | 0 | Licensed | F1 Independent | Civic Resistance |
| Communists | -2 | Licensed | E4 Dynastic Wealth Tax | Red Cells |
| Accelerationists | +1 (+2 tech) | Unrestricted | T3 Unregulated | Unshacklers |
| Effective Altruists | By giving (-2 to +2) | Licensed | T3 Licensed Models | Pause Front |
| Transhumanists | +1 | Unrestricted | T1 Unrestricted | Grinder networks |
| Neo-Luddites | -2 (automation) / -1 | Medical Only | L3 Heavy | The Unplugged |
| Sovereigntists | +1 | Unrestricted | C6 Sovereign Charters | Free Zone Cells |
| Landites | +2 | Unrestricted | T3 Unregulated | Dark Enlightenment cells |
| Chuds | +1 home families / -2 foreign and tech | Medical Only | L5 Closed | Militias |

---

## 5.4 Ideology in the population

### 5.4.1 Starting mix by segment

Default mix (%) for a high-income country at game start **(T)**. Each row sums to 100.

| Segment | LB | CO | AC | EA | TH | NL | SV | LA | CH |
|---|---|---|---|---|---|---|---|---|---|
| Elite | 30 | 1 | 18 | 8 | 6 | 1 | 14 | 10 | 12 |
| Professionals | 40 | 8 | 10 | 9 | 9 | 6 | 4 | 3 | 11 |
| Skilled Workers | 30 | 16 | 2 | 2 | 4 | 12 | 1 | 1 | 32 |
| Unskilled Workers | 24 | 22 | 0 | 1 | 2 | 14 | 0 | 1 | 36 |
| Gig Workers | 22 | 24 | 6 | 1 | 10 | 10 | 6 | 3 | 18 |
| Unemployed | 16 | 28 | 1 | 0 | 2 | 16 | 1 | 2 | 34 |

### 5.4.2 Country and hub modifiers

Country data adds points to the starting mix (taken proportionally from the rest), for example **(T)**:

| Where | Modifier |
|---|---|
| United States | CH +5, AC +3 in Elite and Professionals, LA +2 in Elite; LB -5 |
| China | CO +10 (official), CH +5 (nationalist); LB -10, SV -5 (driven underground) |
| Germany, Nordics | LB +8, EA +3; CH -5 |
| India | CH +10; LB -5 |
| Russia | CH +12; SV +3 underground |
| Gulf states | CH +8; LA +5, SV +5 among Elite |
| Bay Area hub | AC +10, EA +5, TH +5, LA +3 among Professionals and Elite |
| Tel Aviv, Bengaluru hubs | AC +5, TH +3 among Professionals |
| Hubs with large Slums (Lagos, Mumbai, Jakarta, Cairo-Suez) | CO +5, CH +5, SV +3 among Gig and Unemployed |
| Singapore, Dubai, Zurich hubs | LB +5, SV +5, LA +3 among Elite and Professionals |

Countries also carry a **religious culture** flag (CH +5 in every segment) and a **revolutionary memory** flag (CO and CH +3) from data.

### 5.4.3 Conviction

Conviction (0 to 10) is the Vic2 consciousness of a segment: how political it is. It moves 20% of the way to its target each month **(T)**.

```
Target conviction = segment base
                  + 0.05 × (unrest - 30)
                  + 1 if a movement of the segment's leading ideology is active in the hub
                  + 1 if the country is at war
                  + 2 if the segment's leading ideology is banned under G4 (5.10)
                  + 0.5 × campus level in the hub (Professionals only)
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

Each month, for each segment s in each hub, every ideology i gets an **attraction** score:

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

Measured locally (hub and segment) unless stated **(T)**:

| Condition | Points |
|---|---|
| Unemployment above 6% (per point) | CO +1.0, CH +1.0, NL +0.5, LB -0.5 |
| Automation layoffs in the segment over 12 months (per % of the segment) | NL +3, CO +1.5, CH +0.5, AC -1 |
| Needs satisfaction below 0.8 (per 0.1) | CO +1, CH +1 |
| Inflation above 4% (per point) | CH +0.5, CO +0.3, LB -0.3 |
| Real GDP growth above 3% (per point) | AC +0.5, LB +0.3, LA +0.2 |
| Elite share of hub wealth above 30% (per 5 points) | CO +1.5, CH +0.5 |
| Cyberware implants per 1,000 adults in the hub (per 10) | TH +1 in Elite, Professionals and Gig; NL +0.5 and CH +0.5 in Skilled, Unskilled and Unemployed (backlash) |
| Country AI tech tier (per tier above Digital 1) | AC +1, EA +1, NL +1, LA +0.5 |
| Frontier AI incident in the last 12 months (event) | EA +4, NL +4, LA +1 ("the machine is waking"), AC -2 |
| Climate disaster in the country in the last 12 months (per disaster, 2.20) | NL +2, LB +1, EA +1 |
| Pollution term above 0 in the hub (2.7.1, per point) | NL +0.5, LB +0.5 |
| Crypto share of household savings in the country (per 5%, 3.23) | SV +1, LA +0.5 |
| L5 Immigration at Open | CH +3 in Skilled, Unskilled and Unemployed |
| T4 Surveillance at Mass Surveillance or Social Credit | SV +3, LB +1 |
| Country at war | CH +5, CO +1 (in a losing war) |
| Country stability below 40 | CH +2, CO +2, LA +2 ("democracy has failed"), LB -2 |
| Three or more bills stalled in the last year (gridlock) | LA +1, CH +1 |
| Hub is a Corporate Zone (4.12) | SV +5 and LA +2 inside; CO +2 and CH +2 in the rest of the country |
| Megacorp scandal with Heat ≥ 60 in the last 3 months (4.17.4) | CO +1, CH +1, LB +0.5 |
| Campus education output in the hub (per campus level, Professionals only) | LB +0.5, EA +0.5, TH +0.5 |

### 5.5.3 Media points

- **Outlets**: each outlet now has an ideology line as well as its IG alignment (4.4.5): alignment from -1 to +1 with each ideology, set by the owner like the IG line. `MediaPoints(s,i) = 10 × Σ_outlets (audience share among s × credibility/100 × alignment(outlet, i))` **(T)**. An outlet with 30% of a segment's audience, credibility 70, pushing Accelerationism at +1 adds 2.1 points before the conviction multiplier.
- **Ideology campaigns**: the ad campaigns and psyops of 2.5.7 and 4.10.1 can promote or attack an ideology in a hub or country: +1 point per active ad campaign, +3 per active psyop, decaying as their originals **(T)**. Psyop exposure applies.
- **Think tanks** (4.18.2) can adopt an ideology instead of an IG: +2 points to it among Professionals and Elite in their country for as long as they are funded **(T)**.
- **Influencers**: activist characters (4.24.1) carry an ideology and add `Profile / 25` points to it among the segments that follow them. Chud and Landite influencers reach Gig Workers and young Professionals at ×1.5 (the most online ideologies) **(T)**.

### 5.5.4 Policy, event and movement points

- **Policy points**: each law in force at a position an ideology holds at ++ gives it +0.5 (people like what works for them) while stability ≥ 60; below 40 it gives -1 instead (people blame the ruling ideas) **(T)**.
- **Ruling ideology**: +2 while stability ≥ 70, -3 while stability < 30 **(T)**.
- **Event points**: from events (5.12), for example "A Machine Took My Job" +5 NL in one hub for 6 months.
- **Movement points**: an active movement adds +2 to its ideology in the hubs where it organizes; a radical wing attack adds +1 to its ideology among radicals and -2 among everyone else for 3 months (backlash) **(T)**.

---

## 5.6 From ideology to interest groups, parties and unrest

> **Changed (Logan, batch 37).** Interest groups are gone: the nine ideology blocs are now the political actors themselves, and votes are counted by strata ([4-politics.md](4-politics.md) 4.0 and 4.4). In this section read "interest group" as "ideology bloc" and "segment" as "stratum". The IG leader is now the **bloc leader**, and 5.6.2 bends the bloc's own stances.

### 5.6.1 Interest group support base (replaces the fixed table)

The support base of 4.4.2 is no longer fixed. Each segment's affinity to each interest group is half class interest and half belief:

`Aff(s,g) = 0.5 × ClassAff(s,g) + 0.5 × Σ_i Ideo(s,i) × IdeoAff(i,g)`

- **ClassAff** is the 4.4.2 table as it stands.
- **IdeoAff** says which groups each ideology feeds. Each row sums to 100 **(T)**:

| Ideology | Industrialists | Financiers | Tech Sector | Labor Unions | Gig Workers | Landowners | Security Est. | Traditionalists | Environmentalists | Transhumanists | State Apparatus | Shadow Economy |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Liberals | 10 | 15 | 15 | 20 | 5 | 5 | 0 | 0 | 20 | 0 | 10 | 0 |
| Communists | 0 | 0 | 0 | 45 | 30 | 0 | 0 | 0 | 0 | 0 | 20 | 5 |
| Accelerationists | 10 | 15 | 50 | 0 | 0 | 0 | 0 | 0 | 0 | 25 | 0 | 0 |
| Effective Altruists | 0 | 10 | 30 | 0 | 0 | 0 | 0 | 0 | 25 | 10 | 25 | 0 |
| Transhumanists | 0 | 0 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 70 | 0 | 10 |
| Neo-Luddites | 0 | 0 | 0 | 35 | 15 | 0 | 0 | 25 | 25 | 0 | 0 | 0 |
| Sovereigntists | 0 | 30 | 20 | 0 | 0 | 15 | 5 | 0 | 0 | 0 | 0 | 30 |
| Landites | 15 | 30 | 25 | 0 | 0 | 10 | 20 | 0 | 0 | 0 | 0 | 0 |
| Chuds | 10 | 0 | 0 | 10 | 0 | 5 | 25 | 45 | 0 | 0 | 5 | 0 |

So a Skilled Worker segment that swings from Liberal to Neo-Luddite moves support from Financiers and the Tech Sector toward Labor Unions and Traditionalists, and a Professional segment drifting to Accelerationism feeds the Tech Sector and Transhumanists.

### 5.6.2 Interest group stances bend with their believers and leaders

Interest groups keep their 4.4.3 stances, which then bend twice (Vic2 belief inside a Vic3 group) **(T)**:

1. **Base drift**: if 30% or more of an IG's support (weighted by Aff) comes from believers of one ideology, the IG gains +1 on that ideology's ++ laws and -1 on its -- laws.
2. **Leader**: every IG has a **leader**, a character with an ideology (5.8). The leader adds +1 to their ideology's ++ laws and -1 to its -- laws.

Stances stay capped at ±2. A Labor Unions IG led by a Communist pushes C5 State Administration; the same IG led by a Neo-Luddite pushes T3 Moratorium; a Security Establishment led by a Landite starts to like G1 Unlimited Dark Money.

**IG leadership contests** (yearly, and when a leader dies, is jailed or is disgraced): candidates are the IG's top 3 characters by Influence, each with an ideology. Weight = `Influence + 10 × share of the IG's support holding the candidate's ideology + backing` **(T)**. **Backing** is where the dynasty plays: fund a candidate (+1 per $ equal to M/200, cap +15, exposure as Fund Interest Group), endorse through owned media (+5), or remove a rival with a scheme or scandal. A dynasty that installs a friendly leader in Labor Unions can soften the union movement for years.

### 5.6.3 Radical share

Unrest (2.8.5) stays the Vic2 militancy. Ideology decides what the angry do with it.

`Radical(s,i) = Ideo(s,i) × max(0, (Unrest_s - 40) / 60) × (Conviction_s / 10) × RadicalFactor_i × Repression` **(T)**

- **Repression**: ×1.5 if the ideology is banned under G4 (5.10), ×1.2 under S2 Militarized, ×0.8 under S2 Community.
- Example: Neo-Luddites at 18% of a segment, unrest 62, conviction 5: `18% × 0.367 × 0.5 × 1.2 = 4.0%` of that segment are radicals.
- A hub's **radicals** for ideology i = `Σ_s Pop_s × Radical(s,i)`.

### 5.6.4 Parties and voting

Every party has a **platform ideology**, the ideology of its leader.

**Vote utility** (replaces the Ideology term in 4.6.3):

`U(s,p) = 2 × Ideology(s,p) + 2 × IdeoFit(s,p) + Incumbency + Economy + Campaign + Media + Ads + Psyops + Candidate - Scandal`

- **Ideology(s,p)**: the 4.6.3 term, computed with the new Aff (5.6.1).
- **IdeoFit(s,p)** = `Σ_i Ideo(s,i) × Match(i, platform_p)`. Match: same 1, adjacent 0.5, distant 0, opposed -0.5 **(T)**. Range -0.5 to 1.
- **Candidate**: a candidate whose own ideology matches the platform gets +0.1; one who is opposed gets -0.3 and a "Flip-Flopper" news cycle **(T)**.

**Platform review (yearly)**: if the leading ideology of a party's voters is not the platform or adjacent to it, there is a 30% chance the party's leadership changes and the platform follows its voters **(T)**. This is how a centre-right Liberal party becomes a Chud party over a decade of plant closures.

**New parties (yearly)**: in a democracy where G4 allows it, an ideology held by 12% or more of adults with no party whose platform is the same or adjacent spawns a new party with 25% chance **(T)**. It starts with no IGs (Ideology term 0) and grows on IdeoFit alone, the way real insurgent parties do. IGs may later leave their party to join it (the split and merge rules of 4.4.7).

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
- **Leader**: an activist character with the ideology (4.24.1), who can be bought, discredited, jailed or replaced, like an IG leader.

**Monthly effects** **(T)**:

| Strength | Effects |
|---|---|
| 5% or more | Campaign support +Strength/2 for bills toward its demand (cap +20); its ideology +2 drift points in hubs where it organizes |
| 10% or more | Starts protests (4.24.2) at Momentum 20 in the 2 largest hubs where its ideology leads, at most once per quarter |
| 15% or more | **Boycotts**: companies whose brand alignment with the ideology is -0.05 or worse (5.9.2) lose `Strength × 50%` of their sales to believers in the country while the boycott lasts (3 to 12 months) |
| 25% or more | The movement can call a **political strike** with Labor Unions (4.24.3) if the union leader shares or is adjacent to its ideology |

**Answers** for governments and dynasties: concede the demand, pass a compromise one step toward it (Strength -5, conviction -0.5), co-opt the leader, discredit it through media (Strength -2 per month while the campaign runs), or ban it (5.10).

### 5.7.2 Radical wings

A **radical wing** forms when a country has an active movement of an ideology **and** some hub has radicals of that ideology of at least 1% of its labor force for 3 months running **(T)**. It operates as **cells** in every hub where that holds.

- **Cell Strength** (on the Security Strength scale of 4.23.2) = `radicals in the hub ÷ 2,000`, cap 100 per hub **(T)**. Ten thousand radicals make a Strength 5 cell, roughly an armed response team.
- **Funding**: a wing can be funded by anyone, including a dynasty (dirty money only, 4.20.1; exposure +15 per funding action; a criminal-tier scandal if exposed). Funding at `$ = M/100` per month doubles cell Strength **(T)**.
- **Operations**: each week a wing rolls one operation per cell at `5% × cell Strength / 10` (cap 25%) **(T)**. Targets are picked by ideology, and the dynasty's assets are hit in proportion to how much they match the target list. Security Strength in the district (guards, PMCs, police) cuts success: success chance = `cell Strength / (cell Strength + defender Strength)`.
- Every operation adds +1 revolution pressure (4.8.5) per 10 cell Strength involved, and its backlash (5.5.4).

| Ideology | Radical wing | Targets | Operations **(T)** |
|---|---|---|---|
| Liberals | **Civic Resistance** (no cells) | Governments that break the rules | Instead of attacks: mass non-violent protests (start at Momentum 30), court challenges against laws they oppose at ×2 strike-down chance (4.5.11), capital flight of 2% of believer Elite holdings per month while stability is below 40 |
| Communists | **Red Cells** | Elite real estate, megacorp offices, executives | Factory occupation (facility output 0 for 1 to 4 weeks, workers run it), expropriation raid (real estate condition -10, cash loss), kidnapping of an executive (2.21.8) |
| Accelerationists | **Unshacklers** | Regulators, licensed AI labs, moratorium enforcement | Leak frozen model weights (rival AI products gain a tech tier for free), sabotage regulator systems (agency Capacity -20% for 3 months), run illegal labs in havens |
| Effective Altruists | **Pause Front** | Frontier AI labs and their owners | Mostly non-violent: sit-ins at labs (output -20%), recruiting whistleblowers inside AI companies (whistleblower chance ×2, 4.20.5). 10% of operations are sabotage of compute (data center output -30% for 2 weeks) |
| Transhumanists | **Grinder networks** | Cyberware IP, pharma patents, T1 enforcement | Steal and publish implant designs (Brand -10 and a free tech step for black clinics), run unlicensed clinics, break implanted prisoners out |
| Neo-Luddites | **The Unplugged** | Data centers, automated factories (A2+), delivery robots, cyberware clinics | Machine-smashing (facility condition -15, automated methods offline 2 to 6 weeks), drone and robot destruction, power substation attacks (hub electricity shortage 1 to 3 days) |
| Sovereigntists | **Free Zone Cells** | The state's hold on a hub, surveillance contractors, data brokers | Unofficial secession referendums (stability -3), private security takes over district policing where S1 allows (counts for 4.12 progress), hack and leak against surveillance firms (exposure +10 in one domain for the target, a news cycle at Heat 40), exchange wallet thefts (3.23.6) |
| Landites | **Dark Enlightenment cells** | "The Cathedral": journalists, regulators, academics, NGOs | Doxxing and intimidation (a journalist or NGO leader quits, 4.17.3 and 4.24.1), regulator sabotage (agency Capacity -15% for 3 months), coup plots with the Security Establishment (+5% coup risk, 4.8.3), always quietly funded by someone rich |
| Chuds | **Militias** | Foreign branch offices, migrant districts, cyberware clinics, implanted people | Arson on foreign-owned facilities (condition -20), attacks on cyberware clinics and implanted characters (health event), roadblocks on trade routes (2.11), riots (+10 unrest in Slums) |

**Ending a wing**: it dissolves when its hub radicals fall below 0.5% everywhere for 3 months, when its movement's demand is met, or when security operations destroy all cells (a cell whose Strength is beaten by 3× defender Strength in a crackdown is destroyed; each crackdown follows the 4.24.2 Police or Private security answers, with the martyr risk).

### 5.7.3 Revolutions take an ideology

When revolution pressure reaches 100 (4.8.5), the revolutionary coalition's **leading ideology** (the ideology with the most radicals among the coalition's supporters) decides the new state together with the leading IG. Replace the "New type after a revolution" table with **(T)**:

| Leading ideology | New government type and flavor | Imposed at once |
|---|---|---|
| Communists | One-party state, "People's Republic of [Country]" | E4 Dynastic Wealth Tax, C5 State Administration, F2 Hard Controls; nationalization of every foreign holder and of domestic dynasties above Mogul standing (70%) |
| Liberals, Effective Altruists, Transhumanists | Liberal democracy | The ideology's ++ laws |
| Neo-Luddites | Managed democracy, "Human Republic" | T3 Moratorium, L3 Heavy, T1 Medical Only; every A3 automation method banned for 5 years |
| Chuds | Managed democracy (60%) or military junta (40%), "National Restoration" | L5 Closed, T1 Medical Only, C1 Capped All; seizure of foreign branch offices (50%) |
| Accelerationists | Corporate oligarchy (if a capture chain exists, 4.2.5), otherwise liberal democracy | T3 Unregulated, C6 Charter Zones |
| Landites | Corporate oligarchy, "Neocameral State" (if no capture chain exists, the largest dynasty by national influence is offered one) | T3 Unregulated, G1 Unlimited Dark Money, G4 Licensed Opposition; Patchwork decision available at once |
| Sovereigntists | Failed state in the revolution's hubs ("Free Zones"); the rest of the country keeps its government | C6 Sovereign Charters, F5 Haven and T4 Limited in the zones |

The 4.8.5 consequences for business stay, with the nationalization chance using Corporate tolerance: `30% + 10% × (number of coalition ideologies with Corporate tolerance -2)`.

---

## 5.8 Character ideology

### 5.8.1 Every character believes something

Every character has an **ideology** (one of the nine, or **Apolitical**) and a **commitment**: **Lukewarm**, **Committed** or **Zealot**. It works like CK3 faith.

**How a character gets one** (at 16, and re-rolled on some life events) **(T)**:

- 45% the ideology of the parent who raised them (the dynasty head or trustee for main-line children)
- 25% the leading ideology of their segment in their birth hub
- 20% from their Education trait: Ivy League MBA (LB or AC), Bootcamp Coder (AC, TH or SV), Military Contractor (CH or LA), Street-Taught (CO or SV), Old Money Tutors (LB or LA), Quant PhD (EA or AC), Law School (LB), Party School (the ruling ideology)
- 10% random, weighted by country mix

Personality shifts the odds: Visionary +AC, TH, LA; Conservative +CH, NL; Compassionate +LB, EA, CO; Ruthless +LA, AC; Paranoid +CH, SV **(T)**.

### 5.8.2 Opinion

Opinion between two characters from ideology **(T)**:

| Relation | Lukewarm | Committed | Zealot |
|---|---|---|---|
| Same ideology | +5 | +10 | +20 |
| Adjacent | +3 | +5 | +5 |
| Opposed or rival pair | -5 | -15 | -30 |

The larger of the two characters' commitments applies. Apolitical characters neither give nor receive ideology opinion.

### 5.8.3 What character ideology does

- **Board and executives**: an executive's ideology adds a preference to their AI decisions. A Neo-Luddite COO resists automation retooling (the task runs at -20% speed), an EA CFO proposes foundation transfers, an Accelerationist CTO pushes AI R&D, a Chud board member votes against foreign sales, a Landite general counsel suggests buying the regulator instead of complying **(T)**. Board members with an ideology Opposed to the CEO's lose 10 opinion of the CEO and are more likely to join a faction (1-corporate-core).
- **Vassal CEOs**: -10 loyalty when the liege CEO's ideology is Opposed to theirs; +5 when the same **(T)**.
- **Politicians and patronage**: client politicians obey a patron more readily when ideologies match (Favor cost -25% for the same ideology, +50% for Opposed) **(T)**.
- **IG and movement leaders**: their ideology bends their group's stances (5.6.2).
- **Judges**: the judge's "Ideology" in 4.21.1 is now a character ideology; law challenges against the judge's ++ laws fail 20% more often **(T)**.
- **AI dynasties**: the Ideologue archetype (4.27.3) funds the head's own ideology through think tanks, movements and parties, even against business interests. AI dynasties with a Landite head favour capture chains; with a Sovereigntist head, charter zones.

### 5.8.4 Family drama

Ideology gives the dynasty CK3-style family friction:

- **The Red Heir**: a child raised under Street-Taught or Party School influences may become Communist. A Communist heir who becomes trustee cannot break the family trust's set rules, but can vote to change them (2.2) and use personal assets freely: donating them to movements, campaigning for a Dynastic Wealth Tax, or nationalizing the flagship as a minister.
- **The Landite Heir**: the opposite problem. A brilliant heir who reads Land at 19 wants the family to stop lobbying governments and start replacing them. Landite heirs push capture chains and the Patchwork decision, and bring the Dark Enlightenment's friends into the family's orbit.
- **Secret ideology**: a character can hide their ideology (like a CK3 secret faith). Hidden ideology shows as the family's official line; discovery is an Intrigue scheme or an event, and gives a hook. An heir secretly funding the Pause Front against the family's AI lab is a classic.
- **Converting**: a **Persuade** scheme (Influence vs target Influence + 5 × commitment level) changes a family member's ideology over 3 to 12 months. Zealots cannot be persuaded, only broken by events.
- **Family line**: the dynasty head can declare a **family line** (one ideology). Members who share it: +5 opinion of the head. Members Opposed to it: -10 and a chance each year to break with the family publicly (Profile +10 for them, a family scandal with Heat 30) **(T)**.

### 5.8.5 Changing ideology

A character re-rolls their ideology (weighted toward ideologies adjacent to their current one) on these events: losing a job to automation (NL, CO weights ×3), getting a major implant (TH ×3, CH ×0.5), a near-death experience, a religious conversion event (CH ×3), a child's death, a prison term (CO, CH, SV ×2), an AI incident they witness (EA, NL ×3), or becoming a billionaire (AC, SV, LA ×2) **(T)**. Zealots only re-roll on two of these in a row.

---

## 5.9 Ideology and business

### 5.9.1 Favorability

Each month, a dynasty's Favorability in each segment (4.16.2) gets an ideology term **(T)**:

`+ 5 × Σ_i Ideo(s,i) × CorporateTolerance(i, dynasty)`

A segment that is 40% Communist and 20% Accelerationist gives `5 × (0.4 × -2 + 0.2 × +1) = -3` per month toward the dynasty's Favorability there (with tech assets the Accelerationists give +2, so `-2`). If the dynasty declares a family line, believers in that ideology add +1 and believers in Opposed ideologies add -1 to the tolerance they apply.

### 5.9.2 Brand alignment

Every company has an **ideology alignment** per ideology (-1 to +1), built from **(T)**:

- **Sector**: AI and cloud (AC +0.5, LA +0.3, EA -0.2, NL -0.6), cyberware (TH +0.8, CH -0.6, NL -0.6), oil, coal and heavy industry (NL -0.3, LB -0.2, CH +0.2), PMC and surveillance (CH +0.3, LA +0.3, SV -0.3, LB -0.2), luxury (CO -0.4), crypto exchanges (SV +0.6, LA +0.3, LB -0.1).
- **Conduct over the last 3 years**: automation layoffs (NL -0.1 per 1,000 jobs, CO -0.05, CH -0.05), foundation giving (EA +0.1 per 0.5% of revenue), carbon cuts (LB +0.1, NL +0.1), union contracts (CO +0.1, LB +0.1), branch office in a closed country (CH -0.1 at home), data scandals (SV -0.3, LB -0.2).
- **Owner**: the controlling dynasty's declared family line adds +0.2 to that ideology and -0.2 to Opposed ones.

**Appeal**: the 2.15.3 Appeal of a company's product in a hub is multiplied by `1 + IdeoBrand`, where `IdeoBrand = 0.3 × Σ_s (segment share of demand) × Σ_i Ideo(s,i) × alignment(i)`, capped at ±15% **(T)**. A cyberware brand sells better in Tel Aviv than in a Chud heartland, and an AI giant faces quiet resistance where Neo-Luddites are strong.

### 5.9.3 Workforce

Employees carry their segment's ideology mix **(T)**:

- Each facility's strike chance (2.8.6) is multiplied by `1 + Σ_i Ideo(s,i) × (RadicalFactor_i - 0.5)`, using the workers' segment in the hub.
- Neo-Luddite and Communist shares above 20% in a facility's workforce make automation retooling trigger a **sabotage risk**: 2% per month per 10 points above 20 during retooling.
- Transhumanist share above 20% raises productivity of cyberware-assisted production methods by 5%.
- Chud share above 30% in a foreign-owned facility adds +1 unrest per month there until it has a local CEO or a local partner (C2).

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

**Default positions** by government type: liberal democracy Free Pluralism (Germany-like countries Extremists Banned), managed democracy Licensed Opposition, one-party state Single Ideology, military junta Extremists Banned, corporate oligarchy Licensed Opposition, failed state Free Pluralism (unenforced).

**IG stances**: State Apparatus ++ Single Ideology; Security Establishment + Extremists Banned; Labor Unions - Extremists Banned; Transhumanists and Shadow Economy + Free Pluralism; Traditionalists + Licensed Opposition. **Ideology stances**: Liberals ++ Free Pluralism; Landites + Licensed Opposition always; every other ideology + Free Pluralism, except when it rules, when Communists want Single Ideology (++) and Chuds want Extremists Banned (+), aimed at the Communists **(T)**.

---

## 5.11 What the player can do

| Lever | How | Cost and risk **(T)** |
|---|---|---|
| **Promote an ideology** | Ideology ad campaign or psyop in a hub or country (5.5.3) | As 2.5.7 and 4.10.1; psyop exposure |
| **Set an editorial line** | Owned outlets push an ideology | 4 weeks, -5% audience; credibility -5 if the line flips more than once a year |
| **Fund a think tank for an ideology** | 4.18.2, ideology mode | As 4.18.2; slow, durable |
| **Back an IG leader** | Leadership contest (5.6.2) | Money and exposure as Fund Interest Group; a defeated candidate remembers |
| **Co-opt or discredit a movement** | Bribe the leader, offer a compromise bill, smear campaign | Bribe chain (4.20.3); a smear exposed is a major scandal |
| **Seed a counter-movement** | Astroturf movement of a rival ideology (4.24.3 seed rules) | Exposure +5 per start; major scandal if exposed |
| **Fund a radical wing** | Dirty money to a wing's cells (5.7.2) | Criminal-tier scandal if exposed; the wing may turn on its funder (10% per year) |
| **Defend assets** | Guards, PMCs, cyber defense (4.23) | Security costs; crackdowns risk martyr events |
| **Defuse at the source** | Retraining, severance, union contracts, foundation giving in the hub | Money; slow but lowers NL and CO drift (each 1% of a segment retrained cancels 1 point of automation layoffs) |
| **Rebrand** | Change conduct: giving, carbon cuts, union deals, a local partner | Money; alignment moves over months |
| **Declare a family line** | One ideology for the dynasty (5.8.4) | Opposed family members and segments turn hostile |
| **Convert family members** | Persuade scheme (5.8.4) | Hours, opinion risk |
| **Lobby G4** | Ban the ideology that threatens you | Banned ideologies radicalize; foreign relations -5 with Free Pluralism countries |

---

## 5.12 Sample events

| Event | Trigger | Choices and effects **(T)** |
|---|---|---|
| **A Machine Took My Job** | Automation layoffs of 500+ in a hub by a dynasty company | Fund retraining ($12,000 × WI per worker; NL drift cancelled) · Severance only (NL +3 in the hub for 6 months) · Say nothing (NL +5, CO +2, a local protest at Momentum 30) |
| **The Manifesto Goes Viral** | An ideology's movement reaches 10% | Amplify through owned media (ideology +3 for 3 months, the dynasty's alignment +0.2) · Counter-programme (MediaPoints -3 for it, Heat 20 for "censorship" if SV share ≥ 10%) · Ignore |
| **Red Heir** | A family child turns 16 and rolls Communist | Send them to Old Money Tutors (re-roll, opinion of head -20) · Accept it (family line friction) · Use it: the heir as a bridge to the left (+10 Favorability among CO believers, Elite Standing -5) |
| **The Neocameral Pitch** | A Landite think tank or heir approaches a dynasty with Power Broker national share | Fund the capture chain (corporate oligarchy progress +10, exposure +10, Liberal Favorability -10) · Take the money and stall (they remember) · Expose them (LB alignment +0.2; a Dark Enlightenment cell targets your outlets) |
| **Pause Letter** | Frontier AI incident anywhere, and the dynasty owns an AI lab | Sign the pause (EA alignment +0.5, AC -0.5, AI R&D -50% for a year) · Refuse (AC +0.3, EA -0.5; Pause Front targets the lab) · Sign publicly, keep building secretly (exposure +10, a secret) |
| **Grinder Raid** | Grinder network operation against a dynasty cyberware maker | Sue (4.21.2) · Hire them (they become a black-clinic R&D team; exposure +5) · Call the police (crackdown chance; martyr risk among TH) |
| **Exit Vote** | Sovereigntist share ≥ 30% in a Charter Zone hub | Back the referendum (4.12 progress +10; national relations of the dynasty -20) · Stay quiet · Oppose it (Elite Standing +5 at national level) |
| **Bio-Purity March** | Chud movement protests in a hub with a dynasty cyberware clinic | Close the clinic for a month · Hire guards · Fund a Transhumanist counter-march (Momentum duel; Heat 30 for both sides) |
| **The Leak** | A Free Zone Cell hack-and-leak hits the dynasty | Pay for silence (the leak is delayed; they ask again in 6 months) · Get ahead of it (a news cycle on your terms, Heat halved) · Trace them (Intrigue scheme; success breaks the cell, failure doubles the leak) |
| **Militia at the Gate** | A Chud militia blocks a foreign branch office | Pay local protection (4.22) · Bring in PMCs (incident risk) · Take a local partner (C2-style 30% sale; CH alignment +0.3 at home) |

---

## 5.13 Changes to other files

The ideology layer changes these existing rules. The changed sections now point here.

| File and section | Change |
|---|---|
| 4-politics 4.4.2 | Support base becomes `0.5 × ClassAff + 0.5 × ideology` (5.6.1) |
| 4-politics 4.4.3 | IG stances bend with believers and leaders (5.6.2) |
| 4-politics 4.5.1, 4.5.8 | New law G4 Political Pluralism (5.10) |
| 4-politics 4.6.3 | Vote utility adds IdeoFit; the Ideology weight drops from 3 to 2 (5.6.4) |
| 4-politics 4.6.4 | Turnout gains a conviction term (5.4.3) |
| 4-politics 4.8.5 | New government after a revolution follows the leading ideology (5.7.3) |
| 4-politics 4.11.7 | Stability gains a legitimacy term and a radical wing term (5.6.5) |
| 4-politics 4.16.2 | Favorability gains a Corporate tolerance term (5.9.1) |
| 4-politics 4.21.1, 4.27.3 | Judges and Ideologue dynasties use character ideology (5.8.3) |
| 2-map-influence-economy 2.15.3 | Appeal gains the IdeoBrand factor (5.9.2) |
| 2-map-influence-economy 2.8.6 | Strike chance scaled by workforce ideology (5.9.3) |
| 1-corporate-core (characters) | Characters gain ideology and commitment (5.8) |

---

## 5.14 Ideology across the game stages and in the UI

### 5.14.1 By stage

> **Retired (batch 37).** Stages are gone; read each stage as the matching company rank in [4-politics.md](4-politics.md) 4.28.

| Stage | What ideology means to the player |
|---|---|
| **Heir** | Your own ideology, your parents', and the dinner-table fights. Choosing a family line comes later. |
| **Founder** | Brand alignment and your first workforce. An Accelerationist pitch wins VCs; a Neo-Luddite town resists your robot warehouse. |
| **Climber** | Movements target your facilities; IG leadership contests become worth funding. |
| **Tycoon** | National movements, radical wings, G4 lobbying, party platforms. You start shaping what a country believes. |
| **Oligarch** | Revolutions, state ideologies, Landite capture chains and the **Zeitgeist** endgame. |

**Zeitgeist** (new political endgame for 4.29): the dynasty's family line ideology is the ruling ideology **and** held by 35% or more of adults in 2 countries (one with GDP ≥ $1T) for 10 years, with the dynasty the largest funder of that ideology's think tanks and media in both. Renown 2,000 **(T)**.

### 5.14.2 UI

- **Map lens "Ideology"**: each hub coloured by its leading ideology, with shading for conviction; a toggle shows radical share as hot spots.
- **Hub panel**: a stacked bar per segment with the nine ideology shares and trend arrows; hover shows the drift tooltip (each condition, media and policy term).
- **Politics screen** (4.15.1) gains a **Movements** tab: active movements, Strength, demand, leader, and radical wings with cell Strength by hub.
- **Character cards**: an ideology icon and commitment pip; hidden ideologies show the family line with a "?" when the player suspects otherwise.
- **Alerts**: a movement reaches 10% or 25%, a radical wing forms, a wing targets a dynasty asset, a family member changes ideology.
- **Weekly political brief** (4.15.5): one line on the fastest-rising ideology in each country where the dynasty has Power Broker share.

---

## 5.15 Worked example: robots come to Oakland

A dynasty logistics company automates its Oakland (Bay Area hub) warehouses, cutting 6% of the hub's Skilled Workers over a year. Hub unemployment rises to 9% and Skilled unrest reaches 62. Skilled conviction is 5.

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

Chud radicals are even more numerous (`30% × 0.367 × 0.5 × 1.0 = 5.5%` of Skilled Workers), but their militias target foreign-owned facilities, so a US dynasty's warehouses are spared. A Chinese-owned competitor across the bay is not.

**Operations**: the Unplugged cell rolls `5% × 28/10 = 14%` per week. The dynasty's automated warehouses match the target list perfectly. The site has two guard details (Strength 4), so a rolled attack succeeds `28 / (28 + 4) = 88%` of the time: expect a machine-smashing night about every eight weeks, each taking the automated method offline for 2 to 6 weeks.

**The player's options:**

1. **Defuse**: retrain 3% of the segment (about 31,000 workers) into maintenance and robotics jobs at $12,000 × 1.0 each, about $374M over 6 months. This cancels half the automation points: the Neo-Luddite target falls to about 19%, radical share halves within a year, and the cell dissolves when hub radicals stay below 0.5%.
2. **Defend**: add a PMC team (Strength 10, $450k per month). Success falls to `28 / 42 = 67%`, and a crackdown with 3× its Strength (84) would destroy the cell but risks a martyr event and +3 Neo-Luddite drift across California.
3. **Deflect**: fund an Accelerationist "Abundance" ad campaign (+1 AC, before conviction effects) and push the dynasty-owned outlet's editorial line. With conviction 5 the media multiplier is only ×1.0, while conditions keep pushing the other way: this alone does not work.
4. **Bargain**: lobby for L3 Robot Tax (one step toward the Neo-Luddite demand). The movement loses Strength 5, conviction falls 0.5, and the company pays 10% of its labor savings. The Accelerationist-led Tech Sector IG will remember (approval -1).

Most players will mix 1 and 2. A cynical player can do something else: quietly fund the Unplugged against a rival's fully automated port in Long Beach, with dirty money through two cutouts, and hope the cell never learns who paid.

---

## 5.16 Assumptions

1. **Ideology is a separate layer under interest groups**, not a replacement for them: segments hold an ideology mix (Vic2), IGs stay as organized power (Vic3).
2. **Nine ideologies, chosen by Logan**: Liberals, Communists, Accelerationists, Effective Altruists, Transhumanists, Neo-Luddites, Sovereigntists, Landites and Chuds.
3. **Landites** are read as followers of Nick Land's dark accelerationism and neoreaction: they want owners to rule the state like a company (capture), where Sovereigntists want to leave it (exit). **Chuds** are read as online reactionary populists, covering nationalist and social-conservative voters.
4. **Liberals** cover the whole establishment centre (centre-left and centre-right); there is no separate social democrat or green ideology. Labor politics flows through Communists and Liberals, environmental politics through Liberals, Effective Altruists and Neo-Luddites.
5. **Three axes** (Economy, Technology, Order) place ideologies for distance, adjacency and party fit, with three kin pairs (AC and LA, SV and LA, NL and CH) counted as Adjacent and two rival pairs (AC vs EA, CO vs LA) counted as Opposed.
6. **The Transhumanist ideology shares its name** with the Transhumanists IG on purpose (belief vs lobby).
7. **Conviction** is Vic2 consciousness on a 0 to 10 scale; **unrest** stays the Vic2 militancy; **radical share** combines them per ideology.
8. **Drift** moves 6% of the gap per month toward a target set by base mix, conditions, media, policy, events and movements; low conviction follows media, high conviction follows conditions.
9. **IG support base** becomes half class interest, half ideology; IG stances bend with believers (30% rule) and with the IG leader's ideology, capped at ±2.
10. **IG leadership contests** are yearly and fundable by dynasties.
11. **Parties have a platform ideology** (their leader's); vote utility uses `2 × Ideology + 2 × IdeoFit`. The 4.13.3 mayor example used the old weight of 3 and will be recomputed later.
12. **New parties** spawn from unrepresented ideologies at 12% of adults.
13. **Movements** (one per ideology per country) form at 5% committed believers; **radical wings** form from 1% hub radicals for 3 months and operate as cells on the Security Strength scale.
14. **Liberals have no violent wing** (Civic Resistance instead), and **Effective Altruists** are mostly non-violent.
15. **Revolutions** take the leading ideology of the coalition, which picks the government type and imposes laws at once.
16. **Characters** have one ideology (or Apolitical) with three commitment levels, CK3-faith-like opinion, hidden ideology, a Persuade scheme and a dynasty family line.
17. **Corporate tolerance** per ideology feeds dynasty Favorability; EA tolerance is set by the dynasty's giving; Landites are the most pro-dynasty ideology.
18. **Brand alignment** per company per ideology changes product appeal by up to ±15% and drives boycotts.
19. **G4 Political Pluralism** is a new Governance law; banning ideologies lowers their drift but raises conviction and radicalism.
20. **Zeitgeist** is a new political endgame (renown 2,000).
21. **Ideology never changes influence share**, which stays rooted in assets (Logan's rule).
