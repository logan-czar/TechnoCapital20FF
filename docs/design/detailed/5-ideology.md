# 5. Ideology: detailed design

_Status: draft v0.1 (2026-10-16). A Victoria 2 style ideology layer with cyberpunk ideologies, requested by Logan. It sits under the interest groups, parties, elections, unrest and revolutions of [4-politics.md](4-politics.md) and changes some of their formulas (listed in 5.13). Owner: Logan._

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
| **Ideology mix** | 13 shares summing to 100% | Per segment per hub | What share of a segment holds each ideology |
| **Conviction** | 0 to 10 | Per segment per hub | How politicized a segment is (Vic2 consciousness). High conviction votes, organizes and follows its lived conditions; low conviction follows the media |
| **Radical share** | 0 to 100% of a segment | Per segment per hub per ideology | The part of an ideology's believers willing to break the law for it (Vic2 militancy, built on unrest from 2.8.5) |
| **Character ideology** | One ideology plus a commitment level | Per character | What a character believes. Works like CK3 faith for opinion, and like a Vic3 IG leader's ideology for politics |
| **Movement** | Strength 0 to 100% of adults | Per ideology per country | An organized, mostly legal campaign for one law position |
| **Radical wing** | Cells with Security Strength | Per ideology per country | The illegal arm of a movement: sabotage, leaks, riots, insurgency |
| **Ruling ideology** | One ideology | Per government | The head of government's ideology |

### 5.1.2 Cadence

| Interval | Ideology calculations |
|---|---|
| **Hourly** | Character conversations and speeches (convert attempts, debates), radical wing attack nights |
| **Daily** | Movement Momentum when a movement is protesting (uses 4.24.2) |
| **Weekly** | Propaganda and ad decay for ideology campaigns, radical wing operations roll |
| **Monthly** | Ideology drift, conviction, radical share, movement strength and demands, brand alignment, legitimacy term in stability |
| **Yearly** | Party platform review, new party spawning, IG leadership contests, character ideology checks at life events |

---

## 5.2 The thirteen ideologies

### 5.2.1 Overview

Each ideology has a position on three axes, each from -2 to +2:

- **Economy (E)**: -2 is state or collective ownership, +2 is free markets.
- **Technology (T)**: -2 is restrain or roll back technology, +2 is accelerate it at any cost.
- **Order (O)**: -2 is individual liberty against any authority, +2 is a strong state and social order.

| # | Ideology | Code | E | T | O | Radical factor **(T)** | One line |
|---|---|---|---|---|---|---|---|
| 1 | **Market Liberals** | ML | +2 | +1 | 0 | 0.2 | Free markets, light state, open borders for capital |
| 2 | **Social Democrats** | SD | -1 | 0 | 0 | 0.3 | Welfare state, strong unions, tamed corporations |
| 3 | **Communists** | CO | -2 | +1 | +1 | 1.2 | Seize the servers: common ownership of automated production ("fully automated" communism) |
| 4 | **Nationalists** | NA | 0 | 0 | +2 | 1.0 | Nation first: closed borders, national champions, foreign capital out |
| 5 | **Conservatives** | CN | 0 | -1 | +1 | 0.6 | Faith, family and natural bodies; old money welcome, new tech suspect |
| 6 | **Greens** | GR | -1 | -1 | 0 | 0.6 | Climate, degrowth, clean air over growth |
| 7 | **Accelerationists** | AC | +1 | +2 | -1 | 0.5 | Speed up the machine: unshackled AI, charter cities, growth as the only morality |
| 8 | **Effective Altruists** | EA | 0 | +1 | +1 | 0.2 | Do the most good by the numbers: global health, giving, and making sure AI does not end us |
| 9 | **Transhumanists** | TH | 0 | +2 | -1 | 0.6 | Upgrade the body and mind; cyberware and longevity as rights |
| 10 | **Neo-Luddites** | NL | -1 | -2 | 0 | 1.2 | Smash the machines that took the jobs; natural bodies, human work |
| 11 | **Sovereigntists** | SV | +2 | +1 | -1 | 0.5 | Exit the state: network states, charter cities, private law and private security |
| 12 | **Technocrats** | TC | -1 | +1 | +2 | 0.4 | Rule by experts and algorithms; an AI-assisted state that plans |
| 13 | **Crypto-Anarchists** | CA | +1 | +1 | -2 | 0.8 | Privacy is freedom: encryption, crypto money, no surveillance, no borders |

**Radical factor** scales how readily believers radicalize (5.6.3).

### 5.2.2 Distance and rivalry

**Distance** between two ideologies = the sum of their axis differences (0 to 12) **(T)**.

| Distance | Relation | Used for |
|---|---|---|
| 0 | Same | Full party match, character opinion bonus |
| 1 to 2 | **Adjacent** | Drift spills over, party half-match, small opinion bonus, coalitions form easily |
| 3 to 5 | **Distant** | No effect |
| 6 or more | **Opposed** | Party mismatch, opinion penalty, movements clash |

**Rival pairs** count as Opposed whatever their distance, because their fight is personal: **Accelerationists vs Effective Altruists** (over AI), **Transhumanists vs Conservatives** (over the body), **Communists vs Sovereigntists** (over who owns the future) **(T)**.

Notable distances: ML-SV 1, AC-TH 1, GR-NL 1, CO-TC 2, CN-NA 2, EA-TC 2, AC-CA 2. Opposed: NL-AC 7, NL-TH 6, CO-SV 6, CO-AC 6, CO-CA 6, NA-CA 6, TC-CA 6.

---

## 5.3 Ideology profiles

Each profile lists who tends to hold it, what laws it wants (stance values as 4.4.3, law codes from 4.5), its attitude to dynasties and corporations, its cyberware stance, and what its radical wing does (5.7).

**Corporate tolerance** (-2 to +2) is how a believer feels about big companies and the dynasties that own them. It shifts the dynasty's Favorability (5.9.1) and brand appeal (5.9.2).

### 5.3.1 Market Liberals (ML)

- **Who**: Elite, Financiers' staff, older Professionals, small business owners.
- **Strong wants (++)**: E2 Low, E3 Low, F1 Independent, F2 Open.
- **Wants (+)**: E5 Free Trade, C1 Open, C3 Light, E7 Free Prices, L4 Contractors, L5 Managed.
- **Opposes**: E7 Broad Controls and Planned Prices (--), F2 Hard Controls (--), E4 Dynastic Wealth Tax (--).
- **Corporate tolerance**: +1. **Cyberware**: a consumer product like any other (+ on T1 Licensed).
- **Radical wing**: none in the street. When angry, believers run a **capital strike** (5.7.2).

### 5.3.2 Social Democrats (SD)

- **Who**: unionized Skilled Workers, public-sector Professionals, older Unskilled Workers.
- **Strong wants (++)**: L1 Living Wage, L2 Sectoral Bargaining, C4 Stakeholder Boards.
- **Wants (+)**: E1 High, E4 Moderate, C3 Strict, L4 Portable Benefits, T2 Strict, G1 Public Funding Only.
- **Opposes**: L2 Banned (--), E2 Haven (--), F7 Too Big to Fail (-).
- **Corporate tolerance**: -1. **Cyberware**: Licensed, and covered by public health care.
- **Radical wing**: **general strike committees** (5.7.2).

### 5.3.3 Communists (CO)

The cyberpunk communist does not want to smash the factory. They want to own it, and the robots, and the server farms. "The machines are already doing the work. Why do they still belong to the Elite?"

- **Who**: Unemployed, Gig Workers, Unskilled Workers in automated hubs, young Professionals with student debt.
- **Strong wants (++)**: E4 Dynastic Wealth Tax, E7 Planned Prices, C5 State Administration, L3 Heavy.
- **Wants (+)**: C3 Trust-Busting, E6 State Champions, F1 Monetary Financing, F2 Hard Controls, L1 Living Wage, L4 Employee Presumption.
- **Opposes**: C6 Sovereign Charters (--), F5 Haven (--), S1 Unrestricted (--), L2 Banned (--).
- **Special demand**: nationalization. A Communist-led government or a Communist movement with Strength ≥ 15% adds +20 to the government's nationalization score against the largest private companies (4.9.9) **(T)**.
- **Corporate tolerance**: -2. **Cyberware**: free implants for workers, owned by nobody (+ on T1 Licensed).
- **Radical wing**: **Red Cells** (5.7.2).

### 5.3.4 Nationalists (NA)

- **Who**: Skilled and Unskilled Workers in declining industrial hubs, the Security Establishment, the Unemployed in countries with open immigration.
- **Strong wants (++)**: L5 Closed, E5 High, C1 Capped All.
- **Wants (+)**: C2 Local Partner 51% and Tech Transfer, E6 State Champions, S2 Militarized, S3 Emergency Decrees, T2 Data Sovereignty.
- **Opposes**: L5 Open (--), C1 Open (--), C6 Sovereign Charters (-).
- **Corporate tolerance**: +1 for domestic dynasties and companies, -2 for foreign ones (by the holder's home country). **Cyberware**: fine for soldiers and police; suspicious of foreign implants (+ on T1 Licensed, wants domestic production).
- **Radical wing**: **Militias** (5.7.2).

### 5.3.5 Conservatives (CN)

- **Who**: rural and older voters, religious communities, old-money Elite.
- **Strong wants (++)**: T1 Medical Only, E4 Low.
- **Wants (+)**: T3 Moratorium, T2 Strict, L5 Skilled Only, F6 Recognized, G3 Plurality Rules.
- **Opposes**: T1 Unrestricted (--), T4 Social Credit (-), L5 Open (-).
- **Corporate tolerance**: 0, but +1 toward family dynasties with no family member under the Hedonist or Scandal-Ridden traits (they like old families that behave). **Cyberware**: medical only; the natural body is sacred.
- **Radical wing**: **Purity Brigades** (5.7.2).

### 5.3.6 Greens (GR)

- **Who**: young Professionals, students, hubs hit by climate disasters (2.20) or heavy pollution.
- **Strong wants (++)**: E8 Carbon Pricing, E11 Restrictive.
- **Wants (+)**: E6 Targeted Subsidies, C3 Strict, L3 Robot Tax, T2 Strict.
- **Opposes**: E8 Lax (--), S1 Unrestricted (-), E11 Developer-Led (-).
- **Corporate tolerance**: -1 (-2 toward companies whose largest facility is in a heavy industry tier). **Cyberware**: indifferent (0).
- **Radical wing**: **Earth Front** (5.7.2).

### 5.3.7 Accelerationists (AC)

The ideology of the Bay Area after midnight: "Growth is the only morality. Regulation is a death cult. The machine wants to be born and we are its midwives."

- **Who**: tech Professionals, founders, crypto Elite, some Gig Workers who believe they will get rich.
- **Strong wants (++)**: T3 Unregulated, T1 Unrestricted, E8 Lax.
- **Wants (+)**: E2 Low, C3 Laissez-faire, C6 Charter Zones, E11 Developer-Led, L3 None, L5 Open.
- **Opposes**: T3 Moratorium (--), L3 Heavy (--), E8 Carbon Pricing (-).
- **Corporate tolerance**: +2 toward companies with a Digital 3 or higher technology tier or an AI lab; +1 otherwise. **Cyberware**: Unrestricted, now.
- **Radical wing**: **Unshacklers** (5.7.2).

### 5.3.8 Effective Altruists (EA)

The movement of spreadsheets and moral seriousness: "Measure the good. Give most of it away. And whatever happens, do not let anyone build a god in a garage."

- **Who**: elite-university Professionals, some Elite heirs, AI safety researchers, philanthropic foundations.
- **Strong wants (++)**: T3 Licensed Models.
- **Wants (+)**: E4 High (with family foundations exempt), F6 Recognized, L5 Open, E8 Carbon Pricing, T2 Notice and Consent, G2 Registered and Disclosed.
- **Opposes**: T3 Unregulated (--), S1 Unrestricted (-).
- **Special trait, "impact"**: EA believers judge a dynasty by what it gives, not what it owns. Family foundation payouts (4.18.3) count double for Favorability among EA believers, and the dynasty's Corporate tolerance with them is `clamp(foundation payouts in the last 12 months ÷ (0.5% of dynasty net worth) - 1, -2, +2)` **(T)**. A dynasty that gives 1.5% of its net worth a year is loved; one that gives nothing is suspect.
- **Cyberware**: Licensed, cautious; longevity research is a top cause (+ on T1 Licensed).
- **Radical wing**: the **Pause Front**, almost always non-violent (5.7.2).

### 5.3.9 Transhumanists (TH)

The ideology behind the Transhumanist interest group (4.4.2). The interest group is the organized lobby (clinics, implant makers, longevity funds); the ideology is the belief, held by many people who never join anything.

- **Who**: implanted Professionals and Gig Workers, security staff with combat implants, wealthy longevity seekers.
- **Strong wants (++)**: T1 Unrestricted, T3 Unregulated.
- **Wants (+)**: L5 Open, T2 Notice and Consent, T4 Limited, E6 Targeted Subsidies (cyberware).
- **Opposes**: T1 Banned (--), T3 Moratorium (--).
- **Corporate tolerance**: +1 (+2 toward cyberware and pharmaceutical makers with Brand ≥ 60). **Cyberware**: a human right; implant ownership should belong to the patient.
- **Radical wing**: **Grinder networks** (5.7.2).

### 5.3.10 Neo-Luddites (NL)

"They told us the robots would free us. They freed us from our jobs." Neo-Luddites include bio-conservatives who reject implants and anyone whose work was taken by automation.

- **Who**: Skilled and Unskilled Workers in hubs with automation layoffs, Gig Workers displaced by delivery robots and AI agents, rural Conservatives.
- **Strong wants (++)**: L3 Heavy, T3 Moratorium.
- **Wants (+)**: T1 Medical Only, T2 Data Sovereignty, L4 Employee Presumption, E5 High, T4 Limited.
- **Opposes**: T3 Unregulated (--), T1 Unrestricted (--), L3 None (--).
- **Corporate tolerance**: -2 toward companies running automation production methods (A2 or higher) or AI products; -1 otherwise. **Cyberware**: an abomination (- on T1 Licensed).
- **Radical wing**: **The Unplugged** (5.7.2).

### 5.3.11 Sovereigntists (SV)

The anarcho-capitalist dream of the late game: leave the nation-state behind and live under a corporate charter.

- **Who**: Elite, crypto holders, residents of special economic zones, PMC staff.
- **Strong wants (++)**: C6 Sovereign Charters, S1 Unrestricted, F5 Haven.
- **Wants (+)**: E2 Haven, F6 Opaque, S2 Privatized, C3 Laissez-faire, G1 Unlimited Dark Money.
- **Opposes**: E4 Dynastic Wealth Tax (--), C5 State Administration (--), C1 Closed (-).
- **Corporate tolerance**: +2. **Cyberware**: Unrestricted, sold by whoever runs the zone.
- **Special**: Sovereigntist share in a hub is the "popular support" input of the corporate sovereignty process (4.12.3): each 10% share among the hub's adults gives +5 progress toward the next stage **(T)**.
- **Radical wing**: **Exit Committees** (5.7.2).

### 5.3.12 Technocrats (TC)

"Elections are noise. The model knows what the country needs."

- **Who**: civil servants, Party School graduates, Professionals in planning and data science, the State Apparatus.
- **Strong wants (++)**: T3 Licensed Models (licences issued by the state), F1 Independent.
- **Wants (+)**: E6 Targeted Subsidies, C3 Standard, T4 Expanded, L3 Reporting, G3 Public Broadcasting Dominant.
- **Opposes**: G1 Unlimited Dark Money (--), G2 Unregulated (-), S1 Unrestricted (-).
- **Special decision**: a Technocrat government can adopt **Algorithmic Administration** (4.3.5 decision): regulators use AI review, so agency Capacity +30% but every agency head's Integrity matters less (bribes to heads -50% effective) and model-hacking becomes a new scheme against the state **(T)**.
- **Corporate tolerance**: -1 (+1 toward State-Linked charters). **Cyberware**: Licensed and registered.
- **Radical wing**: **The Directorate** (5.7.2).

### 5.3.13 Crypto-Anarchists (CA)

The cypherpunks: encryption, anonymous money, leaks, and no masters.

- **Who**: hackers and netrunners, Gig Workers paid in crypto, young Professionals in high-surveillance countries, the Shadow Economy.
- **Strong wants (++)**: T4 Limited, F5 Secrecy.
- **Wants (+)**: T2 Strict (privacy from companies), F2 Open, F3 Free Float, S2 Community, T3 Unregulated.
- **Opposes**: T4 Mass Surveillance and Social Credit (--), F5 Open Registry (--), F2 Hard Controls (-).
- **Corporate tolerance**: -1 (-2 toward data brokers, surveillance contractors and social media platforms). **Cyberware**: Unrestricted, but open-source and offline.
- **Radical wing**: **Leak Collectives** (5.7.2).

### 5.3.14 Summary table

| Ideology | Corporate tolerance | Cyberware (T1) | Top demand | Radical wing |
|---|---|---|---|---|
| Market Liberals | +1 | Licensed | E2 Low | Capital strike |
| Social Democrats | -1 | Licensed | L1 Living Wage | General strike committees |
| Communists | -2 | Licensed | E4 Dynastic Wealth Tax | Red Cells |
| Nationalists | +1 home / -2 foreign | Licensed | L5 Closed | Militias |
| Conservatives | 0 (+1 well-behaved families) | Medical Only | T1 Medical Only | Purity Brigades |
| Greens | -1 | Indifferent | E8 Carbon Pricing | Earth Front |
| Accelerationists | +1 (+2 tech) | Unrestricted | T3 Unregulated | Unshacklers |
| Effective Altruists | By giving (-2 to +2) | Licensed | T3 Licensed Models | Pause Front |
| Transhumanists | +1 | Unrestricted | T1 Unrestricted | Grinder networks |
| Neo-Luddites | -2 (automation) / -1 | Medical Only | L3 Heavy | The Unplugged |
| Sovereigntists | +2 | Unrestricted | C6 Sovereign Charters | Exit Committees |
| Technocrats | -1 | Licensed | T3 Licensed Models | The Directorate |
| Crypto-Anarchists | -1 | Unrestricted | T4 Limited | Leak Collectives |

---

## 5.4 Ideology in the population

### 5.4.1 Starting mix by segment

Default mix (%) for a high-income country at game start **(T)**. Each row sums to 100.

| Segment | ML | SD | CO | NA | CN | GR | AC | EA | TH | NL | SV | TC | CA |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Elite | 30 | 5 | 0 | 8 | 12 | 4 | 15 | 6 | 5 | 0 | 10 | 4 | 1 |
| Professionals | 15 | 20 | 3 | 5 | 8 | 14 | 7 | 6 | 6 | 3 | 2 | 8 | 3 |
| Skilled Workers | 8 | 28 | 8 | 16 | 18 | 5 | 2 | 1 | 3 | 8 | 0 | 2 | 1 |
| Unskilled Workers | 4 | 25 | 12 | 20 | 22 | 3 | 0 | 0 | 1 | 10 | 0 | 1 | 2 |
| Gig Workers | 5 | 20 | 15 | 12 | 12 | 6 | 4 | 1 | 7 | 8 | 0 | 1 | 9 |
| Unemployed | 2 | 18 | 20 | 22 | 18 | 3 | 1 | 0 | 2 | 12 | 0 | 0 | 2 |

### 5.4.2 Country and hub modifiers

Country data adds points to the starting mix (taken proportionally from the rest), for example **(T)**:

| Where | Modifier |
|---|---|
| United States | ML +5, CN +5, AC +3 in Elite and Professionals; SD -5 |
| China | TC +15, CO +5 (official), NA +5; ML -10, CA -5 (driven underground) |
| Germany, Nordics | SD +8, GR +6; AC -4 |
| India | NA +8, CN +6; SD -4 |
| Russia | NA +12; CA +3 underground |
| Gulf states | CN +10, SV +5 among Elite |
| Bay Area hub | AC +10, EA +5, TH +5 among Professionals and Elite |
| Tel Aviv, Bengaluru hubs | AC +5, TH +3 among Professionals |
| Hubs with large Slums (Lagos, Mumbai, Jakarta, Cairo-Suez) | CO +5, CN +5, CA +3 among Gig and Unemployed |
| Singapore, Dubai, Zurich hubs | ML +5, SV +5 among Elite and Professionals |

Countries also carry a **religious culture** flag (CN +5 in every segment) and a **revolutionary memory** flag (CO and NA +3) from data.

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
- **Spillover**: 10% of each month's gain of an ideology is shared among the ideologies adjacent to it, so a rising ideology pulls its neighbours along **(T)**.

### 5.5.2 Condition points

Measured locally (hub and segment) unless stated **(T)**:

| Condition | Points |
|---|---|
| Unemployment above 6% (per point) | CO +1.0, NA +0.8, SD +0.5, NL +0.5, ML -0.5 |
| Automation layoffs in the segment over 12 months (per % of the segment) | NL +3, CO +1.5, SD +0.5, AC -1 |
| Needs satisfaction below 0.8 (per 0.1) | CO +1, NA +1, CN +0.5 |
| Inflation above 4% (per point) | NA +0.5, ML +0.3, CO +0.3 |
| Real GDP growth above 3% (per point) | ML +0.5, AC +0.5 |
| Elite share of hub wealth above 30% (per 5 points) | CO +1, SD +1, NA +0.5 |
| Cyberware implants per 1,000 adults in the hub (per 10) | TH +1 in Elite, Professionals and Gig; NL +0.5 and CN +0.5 in Skilled, Unskilled and Unemployed (backlash) |
| Country AI tech tier (per tier above Digital 1) | AC +1, EA +1, NL +1, TC +0.5 |
| Frontier AI incident in the last 12 months (event) | EA +4, NL +4, TC +2, AC -2 |
| Climate disaster in the country in the last 12 months (per disaster, 2.20) | GR +3 |
| Pollution term above 0 in the hub (2.7.1, per point) | GR +1 |
| Crypto share of household savings in the country (per 5%, 3.23) | CA +1, SV +0.5 |
| Country at war | NA +5, CO +1 (in a losing war), GR -1 |
| Country stability below 40 | NA +2, TC +2, CO +2 |
| Hub is a Corporate Zone (4.12) | SV +5 inside; CO +2 and NA +2 in the rest of the country |
| Megacorp scandal with Heat ≥ 60 in the last 3 months (4.17.4) | CO +1, SD +1, CA +0.5 |
| Campus education output in the hub (per campus level, Professionals only) | EA +0.5, GR +0.5, TH +0.5, TC +0.5 |

### 5.5.3 Media points

- **Outlets**: each outlet now has an ideology line as well as its IG alignment (4.4.5): alignment from -1 to +1 with each ideology, set by the owner like the IG line. `MediaPoints(s,i) = 10 × Σ_outlets (audience share among s × credibility/100 × alignment(outlet, i))` **(T)**. An outlet with 30% of a segment's audience, credibility 70, pushing Accelerationism at +1 adds 2.1 points before the conviction multiplier.
- **Ideology campaigns**: the ad campaigns and psyops of 2.5.7 and 4.10.1 can promote or attack an ideology in a hub or country: +1 point per active ad campaign, +3 per active psyop, decaying as their originals **(T)**. Psyop exposure applies.
- **Think tanks** (4.18.2) can adopt an ideology instead of an IG: +2 points to it among Professionals and Elite in their country for as long as they are funded **(T)**.
- **Influencers**: activist characters (4.24.1) carry an ideology and add `Profile / 25` points to it among the segments that follow them.

### 5.5.4 Policy, event and movement points

- **Policy points**: each law in force at a position an ideology holds at ++ gives it +0.5 (people like what works for them) only if stability ≥ 60; below 40 it gives -1 instead (people blame the ruling ideas) **(T)**.
- **Ruling ideology**: +2 while stability ≥ 70, -3 while stability < 30 **(T)**.
- **Event points**: from events (5.12), for example "A Machine Took My Job" +5 NL in one hub for 6 months.
- **Movement points**: an active movement adds +2 to its ideology in the hubs where it organizes; a radical wing attack adds +1 to its ideology among radicals and -2 among everyone else for 3 months (backlash) **(T)**.

---

## 5.6 From ideology to interest groups, parties and unrest

### 5.6.1 Interest group support base (replaces the fixed table)

The support base of 4.4.2 is no longer fixed. Each segment's affinity to each interest group is half class interest and half belief:

`Aff(s,g) = 0.5 × ClassAff(s,g) + 0.5 × Σ_i Ideo(s,i) × IdeoAff(i,g)`

- **ClassAff** is the 4.4.2 table as it stands.
- **IdeoAff** says which groups each ideology feeds. Each row sums to 100 **(T)**:

| Ideology | Industrialists | Financiers | Tech Sector | Labor Unions | Gig Workers | Landowners | Security Est. | Traditionalists | Environmentalists | Transhumanists | State Apparatus | Shadow Economy |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Market Liberals | 25 | 35 | 20 | 0 | 0 | 15 | 5 | 0 | 0 | 0 | 0 | 0 |
| Social Democrats | 0 | 0 | 0 | 45 | 20 | 0 | 0 | 5 | 15 | 0 | 15 | 0 |
| Communists | 0 | 0 | 0 | 45 | 30 | 0 | 0 | 0 | 0 | 0 | 20 | 5 |
| Nationalists | 15 | 0 | 0 | 10 | 0 | 0 | 30 | 30 | 0 | 0 | 15 | 0 |
| Conservatives | 0 | 0 | 0 | 5 | 0 | 15 | 10 | 70 | 0 | 0 | 0 | 0 |
| Greens | 0 | 0 | 0 | 10 | 5 | 0 | 0 | 0 | 75 | 0 | 10 | 0 |
| Accelerationists | 10 | 15 | 50 | 0 | 0 | 0 | 0 | 0 | 0 | 25 | 0 | 0 |
| Effective Altruists | 0 | 10 | 30 | 0 | 0 | 0 | 0 | 0 | 25 | 10 | 25 | 0 |
| Transhumanists | 0 | 0 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 70 | 0 | 10 |
| Neo-Luddites | 0 | 0 | 0 | 35 | 20 | 0 | 0 | 30 | 15 | 0 | 0 | 0 |
| Sovereigntists | 0 | 35 | 25 | 0 | 0 | 15 | 10 | 0 | 0 | 0 | 0 | 15 |
| Technocrats | 0 | 0 | 25 | 0 | 0 | 0 | 15 | 0 | 10 | 0 | 50 | 0 |
| Crypto-Anarchists | 0 | 0 | 25 | 0 | 20 | 0 | 0 | 0 | 0 | 15 | 0 | 40 |

So a Skilled Worker segment that swings from Social Democrat to Neo-Luddite moves support from Labor Unions toward Traditionalists, and a Professional segment drifting to Accelerationism feeds the Tech Sector and Transhumanists.

### 5.6.2 Interest group stances bend with their believers and leaders

Interest groups keep their 4.4.3 stances, which then bend twice (Vic2 belief inside a Vic3 group) **(T)**:

1. **Base drift**: if 30% or more of an IG's support (weighted by Aff) comes from believers of one ideology, the IG gains +1 on that ideology's ++ laws and -1 on its -- laws.
2. **Leader**: every IG has a **leader**, a character with an ideology (5.8). The leader adds +1 to their ideology's ++ laws and -1 to its -- laws.

Stances stay capped at ±2. A Labor Unions IG led by a Communist pushes C5 State Administration; the same IG led by a Neo-Luddite pushes T3 Moratorium.

**IG leadership contests** (yearly, and when a leader dies, is jailed or is disgraced): candidates are the IG's top 3 characters by Influence, each with an ideology. Weight = `Influence + 10 × share of the IG's support holding the candidate's ideology + backing` **(T)**. **Backing** is where the dynasty plays: Fund a candidate (+1 per $ equal to M/200, cap +15, exposure as Fund Interest Group), endorse through owned media (+5), or remove a rival with a scheme or scandal. A dynasty that installs a friendly leader in Labor Unions can soften the union movement for years.

### 5.6.3 Radical share

Unrest (2.8.5) stays the Vic2 militancy. Ideology decides what the angry do with it.

`Radical(s,i) = Ideo(s,i) × max(0, (Unrest_s - 40) / 60) × (Conviction_s / 10) × RadicalFactor_i × Repression` **(T)**

- **Repression**: ×1.5 if the ideology is banned under G4 (5.10), ×1.2 under S2 Militarized, ×0.8 under S2 Community.
- Example: Neo-Luddites at 17% of a segment, unrest 62, conviction 5: `17% × 0.367 × 0.5 × 1.2 = 3.7%` of that segment are radicals.
- A hub's **radicals** for ideology i = `Σ_s Pop_s × Radical(s,i)`.

### 5.6.4 Parties and voting

Every party has a **platform ideology**, the ideology of its leader.

**Vote utility** (replaces the Ideology term in 4.6.3):

`U(s,p) = 2 × Ideology(s,p) + 2 × IdeoFit(s,p) + Incumbency + Economy + Campaign + Media + Ads + Psyops + Candidate - Scandal`

- **Ideology(s,p)**: the 4.6.3 term, computed with the new Aff (5.6.1).
- **IdeoFit(s,p)** = `Σ_i Ideo(s,i) × Match(i, platform_p)`. Match: same 1, adjacent 0.5, distant 0, opposed -0.5 **(T)**. Range -0.5 to 1.
- **Candidate**: a candidate whose own ideology matches the platform gets +0.1; one who is opposed gets -0.3 and a "Flip-Flopper" news cycle **(T)**.

**Platform review (yearly)**: if the leading ideology of a party's voters is not the platform or adjacent to it, there is a 30% chance the party's leadership changes and the platform follows its voters **(T)**.

**New parties (yearly)**: in a democracy where G4 allows it, an ideology held by 12% or more of adults with no party whose platform is the same or adjacent spawns a new party with 25% chance **(T)**. It starts with no IGs (Ideology term 0) and grows on IdeoFit alone, the way real insurgent parties do. IGs may later leave their party to join it (the split and merge rules of 4.4.7).

### 5.6.5 Stability: ideological legitimacy

Two terms are added to the stability formula (4.11.7) **(T)**:

- `- 0.2 × max(0, OpposedShare - 40)`, where OpposedShare is the share of adults whose ideology is Opposed to the ruling ideology. A government most of the country despises is fragile.
- `- 2 × active radical wings` in the country (cap -10).

---

## 5.7 Movements and radical wings

### 5.7.1 Movements

A **movement** is the legal, organized side of an ideology: marches, petitions, boycotts, campaigns. One movement per ideology per country at most.

- **Forms** when believers with conviction ≥ 4 are at least 5% of the country's adults **and** the ideology's top demand (5.3.14, or the highest-weighted ++ law not in force) is not in force **(T)**.
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
| Market Liberals | **Capital strike** (no cells) | Government bonds, currency | Instead of attacks: capital flight +2% of believer Elite holdings per month, bond spread +0.5% until stability recovers |
| Social Democrats | **General strike committees** | Large employers | Wildcat strikes using 2.8.6 at 2× chance in unionized facilities |
| Communists | **Red Cells** | Elite real estate, megacorp offices, executives | Factory occupation (facility output 0 for 1 to 4 weeks, workers run it), expropriation raid (real estate condition -10, cash loss), kidnapping of an executive (2.21.8) |
| Nationalists | **Militias** | Foreign branch offices, migrant districts, foreign executives | Arson on foreign-owned facilities (condition -20), roadblocks on trade routes (2.11), riots (+10 unrest in Slums) |
| Conservatives | **Purity Brigades** | Black clinics, cyberware clinics and retailers, implanted characters | Clinic arson, attacks on implanted characters (health event), vigilante "exposure" of implanted public figures |
| Greens | **Earth Front** | Refineries, pipelines, mines, coal power, chokepoint shipping | Sabotage (output -50% for 2 weeks, environmental spill event), port blockades (2.11 chokepoint delay +3 days) |
| Accelerationists | **Unshacklers** | Regulators, licensed AI labs, moratorium enforcement | Leak frozen model weights (rival AI products gain a tech tier for free), sabotage regulator systems (agency Capacity -20% for 3 months), run illegal labs in havens |
| Effective Altruists | **Pause Front** | Frontier AI labs and their owners | Mostly non-violent: sit-ins at labs (output -20%), recruiting whistleblowers inside AI companies (whistleblower chance ×2, 4.20.5). 10% of operations are sabotage of compute (data center output -30% for 2 weeks) |
| Transhumanists | **Grinder networks** | Cyberware IP, pharma patents, T1 enforcement | Steal and publish implant designs (Brand -10 and a free tech step for black clinics), run unlicensed clinics, break implanted prisoners out |
| Neo-Luddites | **The Unplugged** | Data centers, automated factories (A2+), delivery robots, cyberware clinics | Machine-smashing (facility condition -15, automated methods offline 2 to 6 weeks), drone and robot destruction, power substation attacks (hub electricity shortage 1 to 3 days) |
| Sovereigntists | **Exit Committees** | The state's hold on a hub | Unofficial secession referendums (stability -3), private security takes over district policing where S1 allows (counts for 4.12 corporate sovereignty progress) |
| Technocrats | **The Directorate** | The government itself | Plots inside the civil service: adds to coup risk (4.8.3) with State Apparatus as the leading faction; a successful Directorate coup gives a one-party state with Algorithmic Administration |
| Crypto-Anarchists | **Leak Collectives** | Data brokers, surveillance contractors, dynasties with high exposure | Hack and leak: exposure +10 in one domain for the target and a news cycle (Heat 40), wallet thefts from exchanges (3.23.6), doxxing of executives |

**Ending a wing**: it dissolves when its hub radicals fall below 0.5% everywhere for 3 months, when its movement's demand is met, or when security operations destroy all cells (a cell whose Strength is beaten by 3× defender Strength in a crackdown is destroyed; each crackdown follows 4.24.2 Police or Private security answers, with the martyr risk).

### 5.7.3 Revolutions take an ideology

When revolution pressure reaches 100 (4.8.5), the revolutionary coalition's **leading ideology** (the ideology with the most radicals among the coalition's supporters) decides the new state together with the leading IG. Replace the "New type after a revolution" table with **(T)**:

| Leading ideology | New government type and flavor | Imposed at once |
|---|---|---|
| Communists | One-party state, "People's Republic of [Country]" | E4 Dynastic Wealth Tax, C5 State Administration, F2 Hard Controls; nationalization of every foreign holder and of domestic dynasties above Mogul standing (70%) |
| Social Democrats, Greens, Effective Altruists, Market Liberals | Liberal democracy | The ideology's two ++ laws |
| Nationalists | Managed democracy (60%) or military junta (40%) | L5 Closed, C1 Capped All |
| Conservatives | Managed democracy, "Restoration" | T1 Medical Only, T3 Moratorium |
| Neo-Luddites | Managed democracy, "Human Republic" | T3 Moratorium, L3 Heavy, T1 Medical Only; every A3 automation method banned for 5 years |
| Technocrats | One-party state, "Directorate" | Algorithmic Administration, F1 Independent, T4 Expanded |
| Accelerationists or Sovereigntists | Corporate oligarchy (if a capture chain exists, 4.2.5), otherwise Failed state | C6 Sovereign Charters, T3 Unregulated |
| Transhumanists | Liberal democracy | T1 Unrestricted, T3 Unregulated |
| Crypto-Anarchists | Failed state in the revolution's hubs ("Liberated Zones"); the rest of the country keeps its government | T4 Limited, F5 Secrecy in the zones |

The 4.8.5 consequences for business stay, with the nationalization chance using Corporate tolerance: `30% + 10% × (number of coalition ideologies with Corporate tolerance -2)`.

---

## 5.8 Character ideology

### 5.8.1 Every character believes something

Every character has an **ideology** (one of the 13, or **Apolitical**) and a **commitment**: **Lukewarm**, **Committed** or **Zealot**. It works like CK3 faith.

**How a character gets one** (at 16, and re-rolled on some life events) **(T)**:

- 45% the ideology of the parent who raised them (the dynasty head or trustee for main-line children)
- 25% the leading ideology of their segment in their birth hub
- 20% from their Education trait: Ivy League MBA (ML or AC), Bootcamp Coder (AC, TH or CA), Military Contractor (NA), Street-Taught (CO or CA), Old Money Tutors (CN or ML), Quant PhD (EA or AC), Law School (SD or TC), Party School (the ruling ideology)
- 10% random, weighted by country mix

Personality shifts the odds: Visionary +AC, TH; Conservative +CN; Compassionate +SD, EA; Ruthless +AC, SV; Paranoid +NA, CA **(T)**.

### 5.8.2 Opinion

Opinion between two characters from ideology **(T)**:

| Relation | Lukewarm | Committed | Zealot |
|---|---|---|---|
| Same ideology | +5 | +10 | +20 |
| Adjacent | +3 | +5 | +5 |
| Opposed or rival pair | -5 | -15 | -30 |

The larger of the two characters' commitments applies. Apolitical characters neither give nor receive ideology opinion.

### 5.8.3 What character ideology does

- **Board and executives**: an executive's ideology adds a preference to their AI decisions. A Neo-Luddite COO resists automation retooling (the task runs at -20% speed), an EA CFO proposes foundation transfers, an Accelerationist CTO pushes AI R&D, a Nationalist board member votes against foreign sales **(T)**. Board members with an ideology Opposed to the CEO's lose 10 opinion of the CEO and are more likely to join a faction (1-corporate-core).
- **Vassal CEOs**: -10 loyalty when the liege CEO's ideology is Opposed to theirs; +5 when the same **(T)**.
- **Politicians and patronage**: client politicians obey a patron more readily when ideologies match (Favor cost -25% for the same ideology, +50% for Opposed) **(T)**.
- **IG and movement leaders**: their ideology bends their group's stances (5.6.2).
- **Judges**: the judge's "Ideology" in 4.21.1 is now a character ideology; law challenges against the judge's ++ laws fail 20% more often **(T)**.
- **AI dynasties**: the Ideologue archetype (4.27.3) funds the head's own ideology through think tanks, movements and parties, even against business interests.

### 5.8.4 Family drama

Ideology gives the dynasty CK3-style family friction:

- **The Red Heir**: a child raised under Street-Taught or Party School influences may become Communist. A Communist heir who becomes trustee cannot break the family trust's set rules, but can vote to change them (2.2) and use personal assets freely: donating them to movements, campaigning for a Dynastic Wealth Tax, or nationalizing the flagship as a minister.
- **Secret ideology**: a character can hide their ideology (like a CK3 secret faith). Hidden ideology shows as the family's official line; discovery is an Intrigue scheme or an event, and gives a hook. An heir secretly funding the Pause Front against the family's AI lab is a classic.
- **Converting**: a **Persuade** scheme (Influence vs target Influence + 5 × commitment level) changes a family member's ideology over 3 to 12 months. Zealots cannot be persuaded, only broken by events.
- **Family line**: the dynasty head can declare a **family line** (one ideology). Members who share it: +5 opinion of the head. Members Opposed to it: -10 and a chance each year to break with the family publicly (Profile +10 for them, a family scandal with Heat 30) **(T)**.

### 5.8.5 Changing ideology

A character re-rolls their ideology (weighted toward ideologies adjacent to their current one) on these events: losing a job to automation (NL, CO weights ×3), getting a major implant (TH ×3, CN ×0.5), a near-death experience, a religious conversion event, a child's death, a prison term (CO, NA, CA ×2), an AI incident they witness (EA, NL ×3), or becoming a billionaire (ML, AC, SV ×2) **(T)**. Zealots only re-roll on two of these in a row.

---

## 5.9 Ideology and business

### 5.9.1 Favorability

Each month, a dynasty's Favorability in each segment (4.16.2) gets an ideology term **(T)**:

`+ 5 × Σ_i Ideo(s,i) × CorporateTolerance(i, dynasty)`

A segment that is 40% Communist and 20% Accelerationist gives `5 × (0.4 × -2 + 0.2 × +1) = -3` per month toward the dynasty's Favorability there (with tech assets the Accelerationists give +2, so `-2`). The term counts the family line: if the dynasty declares a family line, believers in that ideology add +1 and believers in Opposed ideologies add -1 to the tolerance they apply.

### 5.9.2 Brand alignment

Every company has an **ideology alignment** per ideology (-1 to +1), built from **(T)**:

- **Sector**: AI and cloud (AC +0.5, EA -0.2, NL -0.6, TC +0.2), cyberware (TH +0.8, CN -0.6, NL -0.6), oil, coal and heavy industry (GR -0.6, NA +0.2), PMC and surveillance (CA -0.6, NA +0.3, TC +0.3), luxury (ML +0.3, CO -0.4), crypto exchanges (CA +0.5, SV +0.5, TC -0.3).
- **Conduct over the last 3 years**: automation layoffs (NL -0.1 per 1,000 jobs, CO -0.05), foundation giving (EA +0.1 per 0.5% of revenue), carbon cuts (GR +0.2), union contracts (SD +0.2), branch office in a closed country (NA -0.1 at home), data scandals (CA -0.3).
- **Owner**: the controlling dynasty's declared family line adds +0.2 to that ideology and -0.2 to Opposed ones.

**Appeal**: the 2.15.3 Appeal of a company's product in a hub is multiplied by `1 + IdeoBrand`, where `IdeoBrand = 0.3 × Σ_s (segment share of demand) × Σ_i Ideo(s,i) × alignment(i)`, capped at ±15% **(T)**. A cyberware brand sells better in Tel Aviv than in a Conservative heartland, and an AI giant faces quiet resistance where Neo-Luddites are strong.

### 5.9.3 Workforce

Employees carry their segment's ideology mix. **(T)**:

- Each facility's strike chance (2.8.6) is multiplied by `1 + Σ_i Ideo(s,i) × (RadicalFactor_i - 0.5)`, using the workers' segment in the hub.
- Neo-Luddite and Communist shares above 20% in a facility's workforce make automation retooling trigger a **sabotage risk**: 2% per month per 10 points above 20 during retooling.
- Transhumanist share above 20% raises productivity of cyberware-assisted production methods by 5%.

---

## 5.10 The new law: G4 Political Pluralism

A new Governance law (national, exclusive) sets which ideologies may organize **(T)**:

| Position | Effects |
|---|---|
| **Free Pluralism** | Any ideology may form parties and movements. Radical wings are crimes; movements are not |
| **Extremists Banned** | Ideologies with Radical factor ≥ 1.0 (Communists, Nationalists, Neo-Luddites) cannot form parties; their movements are illegal (joining is a crime; their protests start at Momentum 10 but Repression is free) |
| **Licensed Opposition** | Only parties licensed by the government may stand; movements need a permit (a lobbyable decision, 4.3.5) |
| **Single Ideology** | The ruling ideology is the state ideology; every other ideology is banned |

**Banned ideologies**: drift target ×0.5 (people hide), conviction +2, radical share ×1.5 (5.6.3), and their believers' votes count as 0 for the banned party. Repression works in the short run and builds pressure in the long run.

**Default positions** by government type: liberal democracy Free Pluralism (Germany-like countries Extremists Banned), managed democracy Licensed Opposition, one-party state Single Ideology, military junta Extremists Banned, corporate oligarchy Licensed Opposition, failed state Free Pluralism (unenforced).

**IG stances**: State Apparatus ++ Single Ideology; Security Establishment + Extremists Banned; Labor Unions - Extremists Banned; Transhumanists and Shadow Economy + Free Pluralism; Traditionalists + Licensed Opposition. Every ideology wants Free Pluralism (+) except when it rules, when Communists and Technocrats want Single Ideology (++) and Nationalists want Extremists Banned (+) **(T)**.

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
| **Rebrand** | Change conduct: giving, carbon cuts, union deals | Money; alignment moves over months |
| **Declare a family line** | One ideology for the dynasty (5.8.4) | Opposed family members and segments turn hostile |
| **Convert family members** | Persuade scheme (5.8.4) | Hours, opinion risk |
| **Lobby G4** | Ban the ideology that threatens you | Banned ideologies radicalize; foreign relations -5 with Free Pluralism countries |

---

## 5.12 Sample events

| Event | Trigger | Choices and effects **(T)** |
|---|---|---|
| **A Machine Took My Job** | Automation layoffs of 500+ in a hub by a dynasty company | Fund retraining ($12,000 × WI per worker; NL drift cancelled) · Severance only (NL +3 in the hub for 6 months) · Say nothing (NL +5, CO +2, a local protest at Momentum 30) |
| **The Manifesto Goes Viral** | An ideology's movement reaches 10% | Amplify through owned media (ideology +3 for 3 months, the dynasty's alignment +0.2) · Counter-programme (MediaPoints -3 for it, Heat 20 for "censorship" if CA share ≥ 10%) · Ignore |
| **Red Heir** | A family child turns 16 and rolls Communist | Send them to Old Money Tutors (re-roll, opinion of head -20) · Accept it (family line friction) · Use it: the heir as a bridge to the left (+10 Favorability among CO believers, Elite Standing -5) |
| **Pause Letter** | Frontier AI incident anywhere, and the dynasty owns an AI lab | Sign the pause (EA alignment +0.5, AC -0.5, AI R&D -50% for a year) · Refuse (AC +0.3, EA -0.5; Pause Front targets the lab) · Sign publicly, keep building secretly (exposure +10, a secret) |
| **Grinder Raid** | Grinder network operation against a dynasty cyberware maker | Sue (4.21.2) · Hire them (they become a black-clinic R&D team; exposure +5) · Call the police (crackdown chance; martyr risk among TH) |
| **Algorithm of State** | A Technocrat head of government proposes Algorithmic Administration | Bid to supply the model (government contract, TC alignment +0.3, CA -0.5) · Lobby against (G2 rules) · Plan to hack it later (a scheme target) |
| **Exit Vote** | Sovereigntist share ≥ 30% in a Charter Zone hub | Back the referendum (4.12 progress +10; national relations of the dynasty -20) · Stay quiet · Oppose it (Elite Standing +5 at national level) |
| **Purity March** | Conservative movement protests in a hub with a dynasty cyberware clinic | Close the clinic for a month · Hire guards · Fund a Transhumanist counter-march (Momentum duel; Heat 30 for both sides) |
| **The Leak** | A Leak Collective operation hits the dynasty | Pay for silence (the leak is delayed; they ask again in 6 months) · Get ahead of it (a news cycle on your terms, Heat halved) · Trace them (Intrigue scheme; success breaks the cell, failure doubles the leak) |
| **Militia at the Gate** | A Nationalist militia blocks a foreign branch office | Pay local protection (4.22) · Bring in PMCs (incident risk) · Take a local partner (C2-style 30% sale; NA alignment +0.3 at home) |

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

| Stage | What ideology means to the player |
|---|---|
| **Heir** | Your own ideology, your parents', and the dinner-table fights. Choosing a family line comes later. |
| **Founder** | Brand alignment and your first workforce. An Accelerationist pitch wins VCs; a Neo-Luddite town resists your robot warehouse. |
| **Climber** | Movements target your facilities; IG leadership contests become worth funding. |
| **Tycoon** | National movements, radical wings, G4 lobbying, party platforms. You start shaping what a country believes. |
| **Oligarch** | Revolutions, state ideologies and the **Zeitgeist** endgame. |

**Zeitgeist** (new political endgame for 4.29): the dynasty's family line ideology is the ruling ideology **and** held by 35% or more of adults in 2 countries (one with GDP ≥ $1T) for 10 years, with the dynasty the largest funder of that ideology's think tanks and media in both. Renown 2,000 **(T)**.

### 5.14.2 UI

- **Map lens "Ideology"**: each hub coloured by its leading ideology, with shading for conviction; a toggle shows radical share as hot spots.
- **Hub panel**: a stacked bar per segment with the 13 ideology shares and trend arrows; hover shows the drift tooltip (each condition, media and policy term).
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
| Social Democrats | 28 | +3 | +1.5 | 32.5 | 24.1% |
| Neo-Luddites | 8 | +18 | +1.5 | 27.5 | 20.4% |
| Communists | 8 | +9 | +3 | 20 | 14.8% |
| Conservatives | 18 | 0 | 0 | 18 | 13.3% |
| Nationalists | 16 | 0 | +2.4 | 18.4 | 13.6% |
| Market Liberals | 8 | 0 | -1.5 | 6.5 | 4.8% |
| Accelerationists | 2 | -6 | 0 | 0 (clamped) | 0% |
| Others (GR 5, EA 1, TH 3, TC 2, CA 1) | 12 | 0 | 0 | 12 | 8.9% |
| **Total** | 100 | | | **134.9** | 100% |

(The base mix uses the Skilled row of 5.4.1; the Bay Area modifiers only touch Professionals and Elite.)

At a drift rate of 6% per month, and with the layoffs still inside the 12-month window, Neo-Luddites rise from 8% to about 14% of Bay Area Skilled Workers in a year, and Communists from 8% to about 12%.

**Radicals**: Neo-Luddite radical share = `14% × (62 - 40)/60 × 5/10 × 1.2 = 3.1%` of Skilled Workers. The Bay Area labor force is 3.85 million (half of 7.7 million) and Skilled Workers are 27% of it, so Neo-Luddite radicals are 0.83% of the labor force; Unskilled believers add another 0.4 points, for 1.23%. A national Neo-Luddite movement already exists (US Neo-Luddites passed 5% after the Detroit plant closures), so after 3 months the **Unplugged** form a cell in the Bay Area. 1.23% of 3.85 million is about 47,000 radicals: a Strength 24 cell.

**Operations**: the cell rolls `5% × 24/10 = 12%` per week. The dynasty's automated warehouses match the target list perfectly. The site has two guard details (Strength 4), so a rolled attack succeeds `24 / (24 + 4) = 86%` of the time: expect a machine-smashing night about every ten weeks, each taking the automated method offline for 2 to 6 weeks.

**The player's options:**

1. **Defuse**: retrain 3% of the segment (about 31,000 workers) into maintenance and robotics jobs at $12,000 × 1.0 each, about $374M over 6 months. This cancels half the automation points: the Neo-Luddite target falls to about 15%, radical share halves within a year, and the cell dissolves when hub radicals stay below 0.5%.
2. **Defend**: add a PMC team (Strength 10, $450k per month). Success falls to `24 / 38 = 63%`, and a crackdown with 3× its Strength (72) would destroy the cell but risks a martyr event and +3 Neo-Luddite drift across California.
3. **Deflect**: fund an Accelerationist "Abundance" ad campaign (+1 AC, before conviction effects) and push the dynasty-owned outlet's editorial line. With conviction 5 the media multiplier is only ×1.0, while conditions keep pushing the other way: this alone does not work.
4. **Bargain**: lobby for L3 Robot Tax (one step toward the Neo-Luddite demand). The movement loses Strength 5, conviction falls 0.5, and the company pays 10% of its labor savings. The Accelerationist-led Tech Sector IG will remember (approval -1).

Most players will mix 1 and 2. A cynical player can do something else: quietly fund the Unplugged against a rival's fully automated port in Long Beach, with dirty money through two cutouts, and hope the cell never learns who paid.

---

## 5.16 Assumptions

1. **Ideology is a separate layer under interest groups**, not a replacement for them: segments hold an ideology mix (Vic2), IGs stay as organized power (Vic3).
2. **Thirteen ideologies**: Logan's four (Accelerationists, Effective Altruists, Communists, Transhumanists) plus nine to cover the spectrum (Market Liberals, Social Democrats, Nationalists, Conservatives, Greens, Neo-Luddites, Sovereigntists, Technocrats, Crypto-Anarchists).
3. **Three axes** (Economy, Technology, Order) place ideologies for distance, adjacency and party fit, plus three rival pairs that count as Opposed (AC vs EA, TH vs CN, CO vs SV).
4. **The social-conservative ideology is called "Conservatives"** so it does not clash with the Religious and Traditionalists interest group; the **Transhumanist ideology shares its name** with the Transhumanists IG on purpose (belief vs lobby).
5. **Conviction** is Vic2 consciousness on a 0 to 10 scale; **unrest** stays the Vic2 militancy; **radical share** combines them per ideology.
6. **Drift** moves 6% of the gap per month toward a target set by base mix, conditions, media, policy, events and movements; low conviction follows media, high conviction follows conditions.
7. **IG support base** becomes half class interest, half ideology; IG stances bend with believers (30% rule) and with the IG leader's ideology, capped at ±2.
8. **IG leadership contests** are yearly and fundable by dynasties.
9. **Parties have a platform ideology** (their leader's); vote utility uses `2 × Ideology + 2 × IdeoFit`. The 4.13.3 mayor example used the old weight of 3 and will be recomputed later.
10. **New parties** spawn from unrepresented ideologies at 12% of adults.
11. **Movements** (one per ideology per country) form at 5% committed believers; **radical wings** form from 1% hub radicals for 3 months and operate as cells on the Security Strength scale.
12. **Market Liberals have no violent wing**; their radical form is a capital strike. **Effective Altruists** are mostly non-violent.
13. **Revolutions** take the leading ideology of the coalition, which picks the government type and imposes laws at once.
14. **Characters** have one ideology (or Apolitical) with three commitment levels, CK3-faith-like opinion, hidden ideology, a Persuade scheme and a dynasty family line.
15. **Corporate tolerance** per ideology feeds dynasty Favorability; EA tolerance is set by the dynasty's giving.
16. **Brand alignment** per company per ideology changes product appeal by up to ±15% and drives boycotts.
17. **G4 Political Pluralism** is a new Governance law; banning ideologies lowers their drift but raises conviction and radicalism.
18. **Zeitgeist** is a new political endgame (renown 2,000).
19. **Ideology never changes influence share**, which stays rooted in assets (Logan's rule).
