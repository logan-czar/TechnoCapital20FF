# 4. Politics: detailed design

_Status: draft v0.1 (2026-10-16). Expands [08-politics.md](../08-politics.md) and the political parts of [05-map-and-influence.md](../05-map-and-influence.md). Owner: Logan._

The player never rules a country. The dynasty **buys, earns and borrows power over those who do**. This file turns the politics overview into exact rules, formulas, numbers and content.

**How to read the numbers.** Every number marked **(T)** is a starting tuning value, expected to change in playtesting. Formulas are written so each term can be shown in a tooltip breakdown (see [11-ui.md](../11-ui.md)). Money is in US dollar equivalents at game start; each country converts to its own currency at the live exchange rate.

**Decided rule kept intact.** Influence is rooted mainly in the assets a holder owns in an area, modified by birthplace and origin, and temporarily boosted by psyops and ad campaigns (see [13-open-questions.md](../13-open-questions.md) and [05-map-and-influence.md](../05-map-and-influence.md)). Everything political in this file is fed by that influence. Money can buy political effects directly, but how far money goes depends on the government type, and money spent without influence behind it is less effective and riskier.

---

## 4.1 Core concepts, units and cadence

### 4.1.1 Key terms

| Term | Range | Scope | Meaning |
|---|---|---|---|
| **Influence share** | 0 to 100% | Per holder per place | Your share of the weighted asset value in a place (district, hub, region, country), plus origin and office modifiers and temporary boosts. Defined in 05. |
| **Political Capital (PC)** | 0 to pool cap | Per dynasty per jurisdiction | The spendable form of influence. Earned monthly from influence share. Spent on lobbying, permits, protection, appointments. |
| **Clout** | 0 to 100% (sums to 100% per jurisdiction) | Per interest group per jurisdiction | How much an interest group decides which laws pass. |
| **Support** | -100 to +100 | Per law proposal | Net weight behind a proposed law position. |
| **Stance** | -2 to +2 | Per interest group per law position | How much a group wants (+) or opposes (-) a position. |
| **Approval** | -10 to +10 | Per interest group per jurisdiction | How happy a group is with current laws and government. |
| **Exposure** | 0 to 100+ | Per holder per agency domain | How much evidence of wrongdoing exists for regulators and journalists to find. |
| **Stability** | 0 to 100 | Per country (and per hub for local unrest) | How well the political order holds. Low stability causes defaults, currency crises, coups and revolutions. |
| **Regime Strength (RS)** | 0 to 100 | Per country | How hard the current government is to remove by force. |
| **Relation** | -100 to +100 | Per country pair | Diplomatic temperature between two countries. |
| **Favor** | Whole tokens | Per patron per client politician | A specific debt a politician owes you. Spent for concrete actions. |

### 4.1.2 Political Capital

Influence share is a stock (how strong you are). Political Capital is a flow (what you can do this month).

- **Monthly PC gain** in a jurisdiction = `100 × sqrt(influence share) × Influence Effectiveness(government type) + office PC + legacy PC` **(T)**.
  - Influence share is a fraction (0.25 for 25%).
  - The square root keeps small players relevant in big countries: 1% share gives 10 PC per month, 10% gives 32, 25% gives 50, 50% gives 71.
- **Pool cap** = 6 × monthly gain, minimum 20 **(T)**. PC above the cap is lost.
- PC is held by the **dynasty** per jurisdiction. Influence of all dynasty members, the family trust and controlled companies rolls up into one dynasty share per place. Non-dynasty holders (rival dynasties, AI companies) have their own pools.
- Jurisdictions are the three government levels: each hub (local), each region (regional) and each country (national). A hub share counts for its local pool; the rolled-up regional share for the region; the rolled-up national share for the country (roll-up rules in 05).
- **Office PC**: a dynasty member holding office adds PC in that jurisdiction (see 4.7.1).
- **Legacy PC**: the "Political Machine" dynasty legacy adds +20% PC gain everywhere **(T)**.

### 4.1.3 Cadence

1 turn = 1 hour. Politics runs mostly on weekly, monthly and yearly boundaries.

| Interval | Political calculations |
|---|---|
| **Hourly** | Player actions (meetings, calls, bribes offered, speeches), hearings in session, election night counting (results arrive region by region over 6 to 12 turns), coup night resolution (6 to 24 turns) |
| **Daily** | News cycle: scandals spread, exposés published, poll noise, protest size |
| **Weekly** | Polls, campaign events, lobbying actions resolve, investigation steps, coup plot progress and leak rolls, temporary boost decay (ads and psyops), IG approval, trade war and sanctions escalation checks, seizure ladder steps |
| **Monthly** | PC income, clout recalculation, law progress rolls, exposure detection rolls, stability, relation drift, revolution pressure, coup risk, default and currency crisis risk, branch office seizure risk |
| **Quarterly** | Government contract tenders open, regulator capacity review, credit and political risk ratings |
| **Yearly** | Scheduled elections fire on their date, party plenums, budgets, agency head term reviews, government type review (drift from stability and IG pressure) |

---

## 4.2 Government types

### 4.2.1 Type table

| Type | How power changes hands | Corruption (default, range) | Money effectiveness | Influence effectiveness | Stability baseline | Foreigner influence penalty | Law enactment time | Judicial independence | Media freedom |
|---|---|---|---|---|---|---|---|---|---|
| **Liberal democracy** | Free elections on fixed schedules; coalitions; confidence votes | 20 (5 to 75) | 1.0 | 1.0 | 70 | -10% | 6 to 18 months | 0.9 | 0.9 |
| **Managed democracy** | Elections with incumbent advantage, fraud and disqualification; managed succession inside the ruling circle | 50 (10 to 80) | 1.3 | 0.9 | 60 | -30% | 2 to 6 months | 0.4 | 0.4 |
| **One-party state** | Party congress every 5 years; faction struggle; ruling family variant uses family council | 40 (20 to 80) | 0.6 | 0.6 | 65 | -50% | 1 to 4 months | 0.2 | 0.1 |
| **Corporate oligarchy** | Council of Stakeholders: seats weighted by national influence share; the largest holder chairs | 60 (40 to 85) | 2.0 | 1.5 | 55 | 0% | 1 to 2 months | 0.3 | 0.3 |
| **Military junta** | Council of generals; coups and counter-coups; occasional managed transition to elections | 65 (50 to 85) | 0.9 | 0.7 | 45 | -30% | Decree, 0 to 1 month | 0.1 | 0.2 |
| **Failed state** | No effective center; local strongmen, militias and city authorities; national government exists on paper | 85 (70 to 95) | 1.6 | 0.8 | 20 | -10% | National laws barely enforced | 0.0 | 0.5 |

All values **(T)**.

- **Money effectiveness** multiplies every money-to-politics conversion: clout from funding, lobby points bought with money, campaign spending, bribes.
- **Influence effectiveness** multiplies PC gain (4.1.2).
- **Foreigner influence penalty** applies to the influence share of holders whose dynasty and company headquarters are foreign (stacks with nationalist law positions such as Foreign Ownership: Capped or Closed, which add a further -10% each step past Screened **(T)**).
- **Judicial independence** (0 to 1): chance that a trial follows the evidence instead of the executive's wishes, and that courts strike down unlawful seizures.
- **Media freedom** (0 to 1): multiplies the chance that an exposé gets published and spreads; low freedom means scandals about the regime's friends stay buried, but scandals about its enemies are amplified.

### 4.2.2 What money and influence buy, by type

| Type | Cheap | Expensive or impossible | Typical player play |
|---|---|---|---|
| **Liberal democracy** | Legal lobbying, campaign donations, think tanks, media ownership | Bribes (low acceptance, high detection), direct control of regulators, decrees | Fund groups and campaigns, own media, run family members for office, use lawyers |
| **Managed democracy** | Access to the ruling circle, contracts, protection from investigations | Supporting the opposition (risk of targeted investigations and seizures) | Become a loyal court oligarch; pay for contracts; avoid backing the losing side |
| **One-party state** | Local permits and partnerships through party patrons | Buying national policy with money; owning media; open lobbying | Branch offices with local partners, cultivate party faction patrons, accept tech transfer |
| **Corporate oligarchy** | Almost everything: votes on the Council are weighted by influence share | Nothing is off limits, but rivals can outbid you | Accumulate assets to win Council seats; laws are a market |
| **Military junta** | Security contracts, PMC licences, mining concessions | Stable long-term rules: the next coup can void your deals | Short horizons, quick returns, cultivate the generals, keep an exit plan |
| **Failed state** | Local strongmen, ports, militia protection | National guarantees of any kind | Resource extraction under armed protection, high risk; candidate for corporate sovereignty |

### 4.2.3 Corruption

Corruption (0 to 100) is a country value with a type default. It can differ by hub (local corruption = national ± up to 20, set in hub data **(T)**).

| Effect | Formula **(T)** |
|---|---|
| Bribe acceptance base chance | `Corruption%`, then modified by the official's traits (4.10.4) |
| Bribe cost multiplier | `(110 - Corruption) / 60` (Corruption 20 → 1.5×, 50 → 1.0×, 85 → 0.42×) |
| Detection of bribery and kickbacks by regulators | multiplied by `1 - Corruption / 200` |
| Kickbacks expected on government contracts | `Corruption / 10` % of contract value (2% at 20, 8.5% at 85) for a neutral bid score; paying less loses bid score (4.9.7) |
| Enforcement of national law in hubs | `100% - max(0, Corruption - 50)%` (Failed state at 85 enforces 65%; combined with type, see 4.3.4) |

Corruption drifts monthly by ±1 toward a target set by laws (Lobbying Rules, Campaign Finance, Media Ownership), judicial independence, and the clout of the Shadow Economy group **(T)**.

### 4.2.4 Starting countries

The starting classification is a game abstraction, a snapshot at the start date, stored as editable data. It is not a judgment of any country, and in play every country can move between types. Corruption and stability values are loosely inspired by public governance indicators and are tuning values.

| Country | Type | Corruption | Stability | Structure | National election cycle (legislature / executive) | Example hubs |
|---|---|---|---|---|---|---|
| United States | Liberal democracy | 25 | 62 | Federal | 2 / 4 years | New York, Silicon Valley, Houston, Chicago |
| Canada | Liberal democracy | 15 | 75 | Federal | 4 (parliamentary) | Toronto, Vancouver, Calgary |
| United Kingdom | Liberal democracy | 20 | 66 | Unitary (devolved) | 5 (parliamentary) | London, Manchester |
| Ireland | Liberal democracy | 15 | 74 | Unitary | 5 (parliamentary) | Dublin |
| Germany | Liberal democracy | 15 | 70 | Federal | 4 (parliamentary) | Frankfurt, Munich, Hamburg |
| France | Liberal democracy | 25 | 60 | Unitary | 5 / 5 years | Paris, Lyon, Marseille |
| Netherlands | Liberal democracy | 12 | 72 | Unitary | 4 (parliamentary) | Amsterdam, Rotterdam |
| Switzerland | Liberal democracy | 10 | 85 | Federal | 4 (collegial executive) | Zurich, Geneva |
| Sweden, Norway, Denmark, Finland | Liberal democracy | 8 to 12 | 78 to 82 | Unitary | 4 (parliamentary) | Stockholm, Oslo, Copenhagen, Helsinki |
| Italy | Liberal democracy | 40 | 58 | Unitary | 5 (parliamentary) | Milan, Rome |
| Spain | Liberal democracy | 35 | 60 | Unitary (strong regions) | 4 (parliamentary) | Madrid, Barcelona |
| Poland | Liberal democracy | 35 | 64 | Unitary | 4 / 5 years | Warsaw |
| Japan | Liberal democracy | 20 | 78 | Unitary | 4 (parliamentary) | Tokyo, Osaka |
| South Korea | Liberal democracy | 30 | 64 | Unitary | 4 / 5 years | Seoul, Busan |
| Taiwan | Liberal democracy | 25 | 62 | Unitary | 4 / 4 years | Taipei, Hsinchu |
| Australia | Liberal democracy | 15 | 74 | Federal | 3 (parliamentary) | Sydney, Perth |
| Israel | Liberal democracy | 30 | 50 | Unitary | 4 (parliamentary) | Tel Aviv |
| India | Liberal democracy | 55 | 58 | Federal | 5 (parliamentary) | Mumbai, Bengaluru, Delhi |
| Indonesia | Liberal democracy | 60 | 60 | Unitary | 5 / 5 years | Jakarta |
| Philippines | Liberal democracy | 65 | 52 | Unitary | 3 / 6 years | Manila |
| Brazil | Liberal democracy | 55 | 55 | Federal | 4 / 4 years | São Paulo, Rio de Janeiro |
| Mexico | Liberal democracy | 65 | 52 | Federal | 3 / 6 years | Mexico City, Monterrey |
| Argentina | Liberal democracy | 60 | 45 | Federal | 2 / 4 years | Buenos Aires |
| Chile | Liberal democracy | 30 | 60 | Unitary | 4 / 4 years | Santiago |
| South Africa | Liberal democracy | 55 | 48 | Unitary (provinces) | 5 (parliamentary) | Johannesburg, Cape Town |
| Nigeria | Liberal democracy | 75 | 38 | Federal | 4 / 4 years | Lagos, Abuja |
| Singapore | Managed democracy | 10 | 82 | City-state | 5 (parliamentary) | Singapore |
| Turkey | Managed democracy | 55 | 50 | Unitary | 5 / 5 years | Istanbul |
| Russia | Managed democracy | 70 | 52 | Federal | 5 / 6 years | Moscow, St Petersburg |
| Kazakhstan | Managed democracy | 65 | 58 | Unitary | 5 / 7 years | Almaty |
| Egypt | Managed democracy | 65 | 48 | Unitary | 5 / 6 years | Cairo, Suez |
| Iran | Managed democracy | 70 | 42 | Unitary | 4 / 4 years | Tehran |
| Venezuela | Managed democracy | 80 | 30 | Federal | 5 / 6 years | Caracas |
| China | One-party state | 45 | 70 | Unitary | Party congress every 5 years | Shanghai, Shenzhen, Beijing |
| Vietnam | One-party state | 55 | 68 | Unitary | Party congress every 5 years | Ho Chi Minh City, Hanoi |
| Cuba | One-party state | 50 | 45 | Unitary | Party congress every 5 years | Havana |
| North Korea | One-party state (isolated) | 80 | 55 | Unitary | Closed: no foreign assets allowed at start | Pyongyang |
| Saudi Arabia | One-party state (ruling family) | 45 | 66 | Unitary | Family council | Riyadh, Jeddah |
| United Arab Emirates | One-party state (ruling family) | 30 | 76 | Federal | Family council | Dubai, Abu Dhabi |
| Qatar | One-party state (ruling family) | 35 | 78 | Unitary | Family council | Doha |
| Myanmar | Military junta | 80 | 18 | Unitary | Council of generals | Yangon |
| Mali, Burkina Faso, Niger | Military junta | 70 to 75 | 22 to 28 | Unitary | Council of generals | Bamako, Ouagadougou, Niamey |
| Somalia | Failed state | 90 | 12 | Federal (nominal) | Nominal | Mogadishu, Berbera |
| Yemen | Failed state | 90 | 8 | Unitary (nominal) | Nominal | Aden |
| Libya | Failed state | 85 | 15 | Unitary (nominal) | Nominal | Tripoli, Benghazi |
| Haiti | Failed state | 85 | 10 | Unitary | Nominal | Port-au-Prince |
| Sudan, South Sudan | Failed state | 85 to 90 | 8 to 12 | Federal (nominal) | Nominal | Khartoum, Port Sudan, Juba |

No country starts as a **corporate oligarchy**. It is something dynasties create, through capture of a weak state, a revolution's aftermath or a failed state's collapse (4.2.5). Countries not listed default to the type and values set in their data file.

### 4.2.5 Changing government type

Type changes happen only through these transitions. Each is an event chain.

| From | To | Trigger | Chain |
|---|---|---|---|
| Liberal democracy | Managed democracy | Emergency Powers at Standing Emergency for 12+ months, or an executive with Media Ownership: State-Controlled, or Stability < 35 for 6 months | *Erosion*: Postponed Election → Court Packing → Media Takeover. Each step can be resisted by IGs with clout ≥ 30% combined |
| Liberal or managed democracy | Military junta | Successful coup (4.8.4) | Coup chain |
| Managed democracy | Liberal democracy | Revolution won by Labor, Gig Workers, Professionals or Environmentalists; or a "reformer" executive plus Stability ≥ 55 for 24 months | *Opening*: Free Election → Truth Commission → Purge of the Old Guard |
| Managed democracy | One-party state | Ruling party wins 3 consecutive elections with > 70% and passes Ban on Opposition (requires State Apparatus clout ≥ 25%) | *Consolidation* |
| One-party state | Managed democracy | Party struggle won by a Reformist faction plus Stability < 45 | *Thaw* |
| Military junta | Managed democracy | 24+ months in power and Stability ≥ 40, junta leader's ambition low, or foreign pressure (3+ sanctions tiers lifted on condition) | *Transition Election* |
| Any | Failed state | Stability < 10 for 3 months, or lost major war, or revolution with no winning coalition after 3 months | *Collapse* |
| Failed state | Military junta or Managed democracy | A faction controls hubs with ≥ 60% of population | *Reunification* |
| Failed state, Military junta or Managed democracy | Corporate oligarchy | One or more dynasties (or AI megacorps) together hold ≥ 40% national influence share and the Security Establishment approval ≥ 0, and a capture chain is started by a holder with ≥ 15% national share | *Capture*: Debt-for-Equity Deal → Council of Stakeholders → Charter of Governance |
| Corporate oligarchy | Any | Revolution, coup, or foreign intervention event | Standard chains |

---

## 4.3 The three levels of government

### 4.3.1 Powers by level

| Power | National | Regional (state or province) | Local (hub) |
|---|---|---|---|
| Taxes | Income, corporate, capital gains, inheritance, tariffs; sets band for regional surcharges | Regional surcharges on income and corporate tax, sales tax | Property tax, local business levies |
| Money | Currency, central bank, capital controls, exchange regime | Regional bonds | Municipal bonds |
| Corporate | Foreign ownership, branch office rules, antitrust, governance, bankruptcy, special economic zones (enabling) | Company registration fees, regional licensing | Business licences, opening hours |
| Labor | Minimum wage floor, union rights, automation tax, gig status, immigration | Minimum wage above the floor, labor inspection | Local hiring rules on city contracts |
| Land and building | National environmental floor | Environmental rules above the floor, regional infrastructure | **Zoning**, building permits, rezoning, land use |
| Security | Military, emergency powers, PMC legality, surveillance | Regional police (federal countries) | Municipal police, policing model within national rules |
| Contracts | Defense, national infrastructure, surveillance, health | Regional roads, rail, hospitals, universities | Transit, waste, utilities, city IT, construction |
| Regulators | All seven agencies (4.9.1) | Regional attorney general and tax office (federal countries only) | Permit office, building inspectors |
| Appointments | Ministers, regulator heads, central bank governor, ambassadors | Regional cabinet | City officials, police chief |
| Diplomacy | All international relations | Trade missions only | Sister-city deals only |

### 4.3.2 Federal and unitary countries

- **Federal**: regions have full regional powers above. Regional governments are elected (in democracies) and can resist national preemption in court.
- **Unitary**: regional governments are administrative. They can only set Regional Taxes up to Low, regional infrastructure contracts and regional permits. Regional heads are appointed by the national government. Devolved regions (for example Scotland in the UK, Catalonia in Spain) are flagged in data and act as federal for regional taxes, education and health contracts.
- **City-states** (Singapore, and any Stage 3 corporate zone) merge all three levels into one.

### 4.3.3 How laws at different levels interact

Each law has a **level rule**, shown in the law tables (4.5):

| Rule | Code | How it works | Examples |
|---|---|---|---|
| **Exclusive** | N, R or L | Only that level sets the law | Tariffs (N), capital controls (N), zoning (L) |
| **Stacked** | N + R + L | Each level adds its own rate; the holder pays the sum | Income tax = national top rate + regional surcharge; corporate tax likewise; property tax is local only |
| **Floor (banded)** | N floor, R or L may be stricter | National sets the minimum; a lower level may choose a stricter position but never a looser one | Minimum wage, environmental regulation, data privacy, gig worker status |
| **Ceiling (banded)** | N ceiling, R or L may be looser | National sets the maximum; lower levels may be laxer | Policing model (a city may choose Community even if the country is Standard), surveillance in federal countries |
| **Enabling** | N enables, L applies | The national law makes an option available; a lower level must opt in | Special economic zones: the country must allow Tax Zones; the hub then votes to become one |

Rules of precedence:

1. **National beats regional beats local** where they conflict.
2. **Snap-back**: when a national change makes a lower-level law illegal (for example the floor rises), the lower law gets a 3-month grace period **(T)**, then snaps to the nearest legal position.
3. **Preemption**: a national government can pass a Preemption Act for one law category. It is enacted like any law (4.5.9) but needs Support +15 above the normal threshold **(T)**. In federal countries a region can challenge it: the court strikes it down with chance `judicial independence × 50%` **(T)**.
4. **Local experimentation**: a hub may adopt a stricter or looser position (inside the band) and the effects on business, unrest and IG approval apply only in that hub. This is how a dynasty can build a business-friendly haven in one city of a strict country.
5. **Enforcement**: national law is enforced in a hub at `Enforcement%` = type factor × corruption factor (4.2.3). Type factor: LD 100%, MD 100%, OP 100%, CO 90%, MJ 85%, FS 30% **(T)**. Below 70% enforcement, holders can ignore a national law in that hub at an exposure cost of +2 per month per law ignored **(T)**.

### 4.3.4 Lower-level governments by national type

| National type | Regional government | Local government |
|---|---|---|
| Liberal democracy | Elected legislature and governor (federal) or appointed prefect (unitary) | Elected council and mayor |
| Managed democracy | Elected but candidates vetted; governor often appointed | Elected council; mayor often appointed in strategic hubs |
| One-party state | Party secretary and governor appointed | Party secretary and mayor appointed; a local People's Congress approves |
| Corporate oligarchy | Regional board appointed by the Council of Stakeholders | Hub administration appointed by the largest local influence holder |
| Military junta | Military governor | Appointed administrator; councils suspended |
| Failed state | None in practice | Whoever controls the hub: city authority, militia commander or clan council (a "local strongman" character) |

Council sizes **(T)**: local council 7 seats (hub population < 1M), 9 (1 to 3M), 15 (3 to 8M), 25 (8M+); regional legislature 40 to 150 seats; national legislature 100 to 600 seats by country data.

### 4.3.5 Laws and decisions

Politics produces two kinds of outcome:

- **Laws**: standing positions in a law category (4.5). Passed through the support formula (4.5.10).
- **Decisions**: case-by-case rulings on one holder's request: a permit, a rezoning, a contract award, a merger review, a licence. Decisions are taken by a **named body** (a council, a minister, an agency head) and are where personal relationships, favors and bribes matter most.

Council decisions (local and regional bodies) use **member disposition**. Each member votes yes if:

`Disposition = 10 × stance of member's party on the issue + opinion of requester / 5 + 15 × favors called in on that member + bribe effect + whip (±10 from the mayor or governor's position) ≥ 0` **(T)**

National decisions are taken by the responsible minister or agency head with the same formula (no whip, but +10 if the head of government backs it).

---

## 4.4 Population segments and interest groups

### 4.4.1 Population segments

Segments come from [06-economy.md](../06-economy.md). Politically, each segment has a **wealth weight** (how much its money and connections count) and a **turnout** (how much its votes count).

| Segment | Wealth weight per person **(T)** | Base turnout **(T)** |
|---|---|---|
| Elite | 25 | 80% |
| Professionals | 5 | 72% |
| Skilled Workers | 2 | 60% |
| Unskilled Workers | 1 | 50% |
| Gig Workers | 0.8 | 42% |
| Unemployed | 0.4 | 35% |

### 4.4.2 Interest groups and support base

There are twelve interest groups (IGs). The first ten come from 08; **State Apparatus** and **Shadow Economy** are added so one-party states, juntas and failed states have their real power holders (see Assumptions).

Support base: the share of each segment's political energy that goes to each group (each row sums to 100) **(T)**. Countries can override with cultural modifiers (for example Traditionalists +10 in a religious country, taken proportionally from the others).

| Segment | Industrialists | Financiers | Tech Sector | Labor Unions | Gig Workers | Landowners | Security Est. | Traditionalists | Environmentalists | Transhumanists | State Apparatus | Shadow Economy |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Elite | 20 | 25 | 15 | 0 | 0 | 15 | 5 | 5 | 3 | 5 | 5 | 2 |
| Professionals | 5 | 10 | 20 | 5 | 0 | 5 | 5 | 10 | 15 | 10 | 15 | 0 |
| Skilled Workers | 10 | 0 | 5 | 35 | 0 | 5 | 10 | 20 | 5 | 5 | 5 | 0 |
| Unskilled Workers | 0 | 0 | 0 | 30 | 5 | 5 | 10 | 30 | 5 | 0 | 5 | 10 |
| Gig Workers | 0 | 0 | 5 | 10 | 40 | 0 | 0 | 15 | 10 | 10 | 0 | 10 |
| Unemployed | 0 | 0 | 0 | 25 | 10 | 0 | 5 | 30 | 5 | 0 | 0 | 25 |

Short descriptions:

| Group | Who they are | Core want |
|---|---|---|
| **Industrialists** | Factory owners, manufacturers, energy and mining firms | Low corporate tax, weak unions, protection from imports where it suits them, subsidies |
| **Financiers** | Banks, funds, wealthy investors | Low capital taxes, open capital, independent central bank, bailouts when they fail |
| **Tech Sector** | Platforms, chipmakers, software and AI firms | No AI or data rules, contractor status for gig labor, skilled immigration |
| **Labor Unions** | Organized workers | High minimum wage, union power, automation tax, worker board seats |
| **Gig Workers** | App drivers, couriers, freelancers | Employee status, benefits, price caps on essentials |
| **Landowners** | Real estate, agriculture, old land money | Low property and inheritance tax, no rent control, keep foreigners off the land |
| **Security Establishment** | Military, police, intelligence, defense firms | Surveillance, militarized policing, emergency powers, defense spending |
| **Religious and Traditionalists** | Faith groups, rural and older voters, nationalists | Limit cyberware and AI, control immigration, protect families and inheritance |
| **Environmentalists** | Green movement, younger professionals | Carbon pricing, strict environmental rules, restrictive zoning for industry |
| **Transhumanists** | Pro-cyberware and pro-AI movement | Legal cyberware, no AI limits, open borders for talent |
| **State Apparatus** | Civil service, party cadres, state company managers | State control: directed central bank, state champions, state media |
| **Shadow Economy** | Smugglers, black markets, cartels, data brokers | Banking secrecy, weak policing, low surveillance, shortages to exploit |

### 4.4.3 Preferred law positions

Stance values: **++** = +2, **+** = +1, **-** = -1, **--** = -2. Unlisted positions are 0 for that group. Law codes refer to 4.5. For a group, stances on neighbouring positions fall off by 1 per step from its favorite (for example a group that wants Low corporate tax at ++ is + on Haven and Moderate, 0 on High, - on Excess Profits) **(T)**.

| Group | Strong wants (++) | Wants (+) | Opposes (- or --) |
|---|---|---|---|
| **Industrialists** | E2 Low, L2 Restricted, L3 None | E5 Moderate, E6 Broad Subsidies, C3 Light, E8 Lax, L1 Low | L2 Sectoral Bargaining (--), C4 Stakeholder Boards (--), E8 Carbon Pricing (--) |
| **Financiers** | E3 Low, F1 Independent, F2 Open, F7 Too Big to Fail | E4 None, F5 Secrecy, C4 Shareholder Primacy, E5 Free Trade, F6 Opaque | F2 Hard Controls (--), F1 Monetary Financing (--), E4 Dynastic Wealth Tax (--) |
| **Tech Sector** | T3 Unregulated, L4 Contractors | T2 Notice and Consent, E2 Low, C1 Open, L5 Skilled Only, C3 Light, T1 Licensed | T2 Data Sovereignty (--), T3 Moratorium (--), L3 Heavy Automation Tax (-) |
| **Labor Unions** | L1 High, L2 Sectoral Bargaining, L3 Robot Tax, C4 Stakeholder Boards | E1 High, E2 High, E5 High, E7 Essentials Capped, L5 Managed | L2 Banned (--), L3 None (-), S1 Unrestricted (-) |
| **Gig Workers** | L4 Employee Presumption | L1 Living Wage, E7 Essentials Capped, T3 Risk-Based, L3 Robot Tax | L4 Contractors (--), T4 Social Credit (-) |
| **Landowners** | E10 Low property tax, E4 None, E7 Free Prices | E5 High, C1 Capped 49% (strategic), F6 Opaque, E11 Standard | E7 Broad Controls (--), E4 Dynastic Wealth Tax (--), E11 Developer-Led (-) |
| **Security Establishment** | T4 Mass Surveillance, S2 Militarized | S3 Emergency Decrees, S1 Licensed, C1 Screened, E6 State Champions, L5 Skilled Only | S2 Community (-), T4 Limited (--), S1 Banned (-) |
| **Traditionalists** | T1 Medical Only, L5 Closed | T3 Moratorium, T2 Strict, E7 Essentials Capped, E4 Low, G3 Plurality Rules | T1 Unrestricted (--), L5 Open (--), T4 Social Credit (-) |
| **Environmentalists** | E8 Carbon Pricing | E8 Strict, E11 Restrictive, T2 Strict, L3 Robot Tax, E6 Targeted Subsidies | E8 Lax (--), E11 Developer-Led (-), S1 Unrestricted (-) |
| **Transhumanists** | T1 Unrestricted, T3 Unregulated | L5 Open, T4 Limited, T2 Notice and Consent | T1 Banned (--), T3 Moratorium (--) |
| **State Apparatus** | E6 State Champions, G3 State-Controlled | F1 Directed, F2 Restricted, C2 State Golden Share, C5 State Administration, S3 Standing Emergency | G3 Plurality Rules (-), F1 Independent (-), C6 Sovereign Charters (--) |
| **Shadow Economy** | F5 Haven, T4 Limited | F2 Hard Controls, T1 Unrestricted, S2 Community, G2 Unregulated, E7 Broad Controls, E5 High | F5 Open Registry (--), T4 Mass Surveillance (--), S2 Militarized (-) |

### 4.4.4 Clout formula

Recalculated monthly per jurisdiction.

1. **Base support** mixes money power and vote power by the government type's **democratic weight D**:

   `Base_g = (1 - D) × W_g + D × V_g`

   - `W_g` = share of all wealth-weighted support: `Σ_s Pop_s × WealthWeight_s × Aff(s,g)`, divided by the total over all groups.
   - `V_g` = share of all vote-weighted support: `Σ_s Pop_s × Turnout_s × Aff(s,g)`, divided by the total.
   - D **(T)**: Liberal democracy 0.5, Managed democracy 0.3, One-party 0.1, Corporate oligarchy 0.05, Military junta 0.1, Failed state 0.2.

2. **Raw clout**:

   `Raw_g = Base_g × (1 + MediaBias_g) + Money_g + Office_g`

3. **Clout**: `Clout_g = Raw_g / Σ Raw` (as a percentage).

- **Marginalized**: clout < 5%. Its stances count half in law support.
- **Powerful**: clout ≥ 20%. Can block laws it opposes at -- (see 4.5.10) and its approval moves stability twice as much.

**Office term** **(T)**:

| Situation | Office_g |
|---|---|
| Group in the governing coalition (democracies) | +0.05 |
| Group leading the governing coalition | +0.08 |
| State Apparatus in a one-party state | +0.15 |
| Security Establishment in a military junta | +0.20 |
| In a corporate oligarchy: Financiers, Industrialists and Tech Sector | +0.08 each |

### 4.4.5 How money and media shift clout

**Money.**

`Money_g = MoneyEff × 0.20 × sqrt(F_g / M)`, capped at +0.30 **(T)**

- `F_g` = donations and funding to group g over the trailing 12 months. Each month the counted total decays 8% **(T)**, so money must keep flowing.
- `M` = the jurisdiction's **political market size** = 0.05% of its yearly GDP **(T)**. For a $28T economy M = $14B; for a $1T city, M = $500M; for a $50B city, M = $25M.
- Square root: the first dollars count most. Funding of M/10 gives +0.063 × MoneyEff; funding of M gives +0.20 × MoneyEff.
- Money flows into groups through the **Fund Interest Group** action (4.10.1): think tanks, foundations, unions' strike funds, church charities, veterans' associations, militias (Shadow Economy and Security in failed states).
- Under Campaign Finance: Public Funding Only, money to groups counts at half **(T)**.

**Media.**

`MediaBias_g = 0.5 × Σ_outlets (audience share × alignment(outlet, g))`, clamped to -0.3 to +0.3 **(T)**

- Each media outlet (a company or facility of sector Media) has an **audience share** in each hub and country and an **editorial line**: alignment from -1 to +1 with each group, set by its owner (the owner's controlling head picks the line; changing it takes 4 weeks and costs 5% audience **(T)**).
- Owning 20% of a country's audience and pushing a group at +1 gives that group +10% base clout. Media ownership is capped by G3 Media Ownership.
- **Ad campaigns** and **psyops** (from 05) also apply to groups: a campaign "for" a group adds `+0.02` (ads) or `+0.05` (psyops) to its MediaBias per active campaign, decaying weekly as in 4.10.1 **(T)**.

### 4.4.6 Approval and angry groups

Monthly: `Approval_g = Σ over all current laws of stance_g(current position) + 2 if in government - 2 if marginalized + event modifiers`, clamped to -10 to +10 **(T)**.

- **Angry** (≤ -5) and clout ≥ 10%: -3 stability per angry group, +5 unrest in segments supporting it, starts **political movement** events (protests, strikes, petitions). Angry Security Establishment raises coup risk (4.8.4).
- **Loyal** (≥ +5): +1 stability per loyal group with clout ≥ 10%.

### 4.4.7 Parties

- In democracies, **parties** bundle 2 to 5 interest groups. Each IG belongs to at most one party per country at a time. Country data defines starting parties (fictional names for real-world equivalents, for example a centre-right party of Industrialists, Financiers, Landowners and Traditionalists).
- A party's stance on any law is the clout-weighted average stance of its member IGs.
- Parties can split when two member IGs have stances 3+ apart on a law that is being debated **and** both have clout ≥ 10% (yearly check, 15% chance **(T)**), and merge when two parties together could win a majority and their IG stances average within 1 on the top 5 debated laws.
- Managed democracies have a **ruling party** plus licensed opposition; one-party states have one party with **factions** (4.8.2).

---

## 4.5 Laws

### 4.5.1 Categories

There are seven categories. The six from 08, plus **Governance**, which governs how money enters politics.

| Category | Laws |
|---|---|
| Economy | E1 Income Tax, E2 Corporate Tax, E3 Capital Gains Tax, E4 Inheritance and Gift Tax, E5 Tariffs, E6 Industrial Subsidies, E7 Price Controls, E8 Environmental Regulation, E9 Regional Taxes, E10 Property Tax, E11 Zoning |
| Corporate | C1 Foreign Ownership, C2 Branch Office Requirements, C3 Antitrust, C4 Corporate Governance, C5 Bankruptcy, C6 Special Economic Zones |
| Finance | F1 Central Bank Independence, F2 Capital Controls, F3 Exchange Rate Regime, F4 Securities Regulation, F5 Banking Secrecy, F6 Trusts and Foundations, F7 Bailout Policy |
| Labor | L1 Minimum Wage, L2 Union Rights, L3 Automation Tax, L4 Gig Worker Status, L5 Immigration |
| Tech and body | T1 Cyberware, T2 Data Privacy, T3 AI Regulation, T4 Surveillance |
| Security | S1 Private Military Contractors, S2 Policing Model, S3 Emergency Powers |
| Governance | G1 Campaign Finance, G2 Lobbying Rules, G3 Media Ownership |

All rates and multipliers below are **(T)**.

### 4.5.2 Economy laws

| Law | Level | Positions and effects |
|---|---|---|
| **E1 Income Tax** (top marginal rate on personal income: salaries, distributions) | N + R stacked | **Minimal** 10% · **Low** 20% · **Moderate** 32% · **High** 42% · **Punitive** 55% (and +10% emigration of Elite per year) |
| **E2 Corporate Tax** (on company profit) | N + R stacked | **Haven** 3% · **Low** 12% · **Moderate** 21% · **High** 30% · **Excess Profits** 30% plus 20% surtax on profit above 15% return on equity |
| **E3 Capital Gains Tax** (on realized gains of characters and trusts) | N | **Exempt** 0% · **Low** 10% · **Moderate** 20% · **As Income** (equal to E1 top rate) |
| **E4 Inheritance and Gift Tax** (on personal assets passing by will or gift; family trust treatment set by F6) | N | **None** 0% · **Low** 15% above $10M · **Moderate** 30% above $5M · **High** 45% above $1M · **Dynastic Wealth Tax** 45% above $1M plus 1% per year on net worth above $50M |
| **E5 Tariffs** (on imported goods) | N exclusive | **Free Trade** 0% · **Low** 5% · **Moderate** 12% · **High** 25% · **Autarky** 50% plus import quotas at 50% of last year's volume |
| **E6 Industrial Subsidies** | N, R may add | **None** · **Targeted** 10% capex grant in strategic sectors (chips, energy, defense, cyberware) · **Broad** 15% capex grant and 5% opex rebate in all manufacturing · **State Champions** 30% capex grant and state loans at policy rate -2% for named companies, chosen by the government (lobbyable) |
| **E7 Price Controls** | N floor, R may tighten | **Free Prices** · **Essentials Capped** food, energy and residential rent capped at 110% of their 12-month average · **Broad Controls** most finished goods capped at 105%, shortages likely · **Planned Prices** government sets prices monthly; black market prices at 150 to 300% |
| **E8 Environmental Regulation** | N floor, R and L may tighten | **Lax** no compliance cost · **Standard** +3% operating cost for heavy industry · **Strict** +8% and permits for new heavy facilities take 2× as long · **Carbon Pricing** +12% for energy-intensive facilities, revenue rebated to population (unrest -2) |
| **E9 Regional Taxes** | R exclusive | **None** · **Low** income +3%, corporate +3%, sales 5% · **Moderate** income +6%, corporate +6%, sales 8% · **High** income +10%, corporate +9%, sales 10% |
| **E10 Property Tax** | L exclusive | **Minimal** 0.3% of assessed value per year · **Low** 0.8% · **Moderate** 1.5% · **High** 2.5% · **Vacancy Penalty** 1.5% plus 3% on empty units |
| **E11 Zoning** | L exclusive | **Restrictive** rezoning needs council two-thirds; new building 2× permit time; real estate values +10% · **Standard** majority; normal times · **Permissive** rezoning by mayor; permit time ×0.6 · **Developer-Led** holders with Power Broker influence (25%) get automatic approval; permit time ×0.4; unrest +3 in Residential and Slums |

### 4.5.3 Corporate laws

| Law | Level | Positions and effects |
|---|---|---|
| **C1 Foreign Ownership** | N exclusive | **Open** no limits · **Screened** Foreign Investment Review for foreign stakes ≥ 25% in strategic sectors · **Capped Strategic** foreign voting stake ≤ 49% in strategic sectors, screened elsewhere · **Capped All** foreign voting stake ≤ 49% in every sector · **Closed** foreigners may only operate through a branch office with a state partner (see C2 State Golden Share) |
| **C2 Branch Office Requirements** | N exclusive | **None** · **Local Directors** at least one third of board seats held by citizens · **Local Partner 30%** a local holder must own ≥ 30% of voting stock · **Local Partner 51% and Tech Transfer** local holder ≥ 51%; each year one tech level of the parent in that sector is shared with the partner · **State Golden Share** State-Linked charter mandatory (government veto over sales, dividends abroad and executive appointments) |
| **C3 Antitrust** | N exclusive | **Laissez-faire** no review · **Light** review if the deal creates > 50% share in a sector in the country · **Standard** review above 35% share, or deal value > 0.5% of GDP · **Strict** review above 25%; authority may order breakup above 40% · **Trust-Busting** review above 20%; yearly review of every company above 30% share, breakup chance 25% per review |
| **C4 Corporate Governance** | N exclusive | **Founder-Friendly** dual-class unlimited, poison pills and staggered boards allowed · **Standard** dual-class up to 10 votes per share, pills need a shareholder vote · **Shareholder Primacy** no new dual-class listings, pills banned, one third independent directors · **Stakeholder Boards** workers elect one third of board seats in companies with > 2,000 employees in the country |
| **C5 Bankruptcy** | N exclusive | **Creditor-Friendly** liquidation in 2 months, creditors take control · **Reorganization** 6 to 12 months under protection, management stays, equity often survives at 5 to 20% · **State Administration** government administrator appointed; eligible for bailout (4.9.8); equity usually wiped |
| **C6 Special Economic Zones** | N enables, L applies | **Banned** · **Tax Zones** corporate tax -50% and tariffs waived on re-exports inside zone hubs · **Charter Zones** a zone may set its own E8, E10, E11, L1 to L5 and S2 positions, with national law as the floor for L1 · **Sovereign Charters** a zone may become a corporate sovereign territory (4.12) |

### 4.5.4 Finance laws

| Law | Level | Positions and effects |
|---|---|---|
| **F1 Central Bank Independence** | N exclusive | **Independent** bank sets rates by inflation and employment targets; lobbying has no effect · **Coordinated** government priorities weigh 25% in rate decisions; governor appointment lobbyable · **Directed** government sets the rate; rate decisions are a lobbyable decision (4.3.5) · **Monetary Financing** bank buys government debt on demand; inflation +3 to +10 points per year |
| **F2 Capital Controls** | N exclusive | **Open** · **Reporting** transfers abroad > $10M reported, 1 day delay · **Restricted** outflows > $1M need approval: 2 to 6 weeks, 15% denial chance (lobbyable decision) · **Hard Controls** outflows ≤ $50k per holder per month; branch offices may only send dividends abroad up to a yearly quota of 5% of book value |
| **F3 Exchange Rate Regime** | N exclusive | **Free Float** · **Managed Float** central bank intervenes beyond ±2% daily moves · **Peg** fixed to an anchor currency; reserves defend it · **Currency Board** peg backed 100% by reserves; no monetary policy · **Dual Rate** official rate plus market rate; black market spread 20 to 200% |
| **F4 Securities Regulation** | N exclusive | **Lax** disclosure at 10%, detection ×0.5 · **Standard** disclosure at 5%, detection ×1.0 · **Strict** disclosure at 3%, detection ×1.5, short positions reported · **Draconian** disclosure at 2%, detection ×2.0, short selling banned |
| **F5 Banking Secrecy** | N exclusive | **Open Registry** beneficial owners public: shells visible to everyone · **Standard** registry visible to authorities only · **Secrecy** shell exposure -50%, information shared only on treaty request · **Haven** shell exposure -80%, no information sharing; relations -10 with countries at Open Registry or Standard |
| **F6 Trusts and Foundations** | N exclusive | **Opaque** trusts untaxed, beneficiaries hidden · **Recognized** trust income taxed at the E3 rate, no inheritance tax on trusteeship change · **Transparent** trust registry, income taxed at the E1 rate · **Deemed Disposal** every 21 years trust assets are treated as sold and E3 is due on gains |
| **F7 Bailout Policy** | N exclusive | **No Bailouts** · **Bail-In** creditors and bondholders take a 30 to 60% haircut before any state money · **Bailout with Stakes** state money for equity and conditions (4.9.8) · **Too Big to Fail** implicit guarantee: systemically important companies borrow at -1% |

### 4.5.5 Labor laws

| Law | Level | Positions and effects |
|---|---|---|
| **L1 Minimum Wage** (as a share of the median wage) | N floor, R and L may raise | **None** · **Low** 30% · **Moderate** 45% · **High** 60% · **Living Wage** 60% and indexed to inflation monthly |
| **L2 Union Rights** | N exclusive | **Banned** unions illegal; unrest +5 in Skilled and Unskilled · **Restricted** no strikes in strategic sectors; strike vote needs 60% · **Recognized** normal strikes · **Sectoral Bargaining** wages set sector-wide (+8% wages); strikes spread across a sector |
| **L3 Automation Tax** | N exclusive | **None** · **Reporting** layoffs from automation > 100 jobs reported (unrest +1) · **Robot Tax** 10% of labor cost saved by automation production methods · **Heavy** 25% of savings plus mandated retraining (+2% labor cost) |
| **L4 Gig Worker Status** | N floor, R may tighten | **Contractors** no benefits · **Portable Benefits** +6% gig labor cost · **Employee Presumption** +18% gig labor cost; gig unrest -5 |
| **L5 Immigration** | N exclusive | **Closed** labor pools shrink 1% per year · **Skilled Only** Professionals and Skilled pools +1% per year · **Managed** all pools +1% per year · **Open** all pools +2.5% per year; Traditionalist approval -2 |

### 4.5.6 Tech and body laws

| Law | Level | Positions and effects |
|---|---|---|
| **T1 Cyberware** | N exclusive | **Banned** possession is a crime (exposure +5 per month per implanted character) · **Medical Only** · **Licensed** civilian implants with licence; military-grade banned · **Unrestricted** |
| **T2 Data Privacy** | N floor, R may tighten | **None** data goods trade freely · **Notice and Consent** data goods output -10% · **Strict** -30%; fines up to 4% of revenue (Data and Cyberware Authority) · **Data Sovereignty** data on citizens must be stored in-country; foreign data facilities cannot serve this market |
| **T3 AI Regulation** | N exclusive | **Unregulated** · **Risk-Based** high-risk AI products need certification (8 weeks) · **Licensed Models** frontier models need a licence (lobbyable decision, 3 to 6 months) · **Moratorium** frontier AI development banned; AI advisors illegal |
| **T4 Surveillance** | N ceiling (federal), N exclusive (unitary) | **Limited** warrants needed; scheme detection ×0.8 · **Expanded** detection ×1.0 · **Mass Surveillance** scheme and psyop detection ×1.5 · **Social Credit** state tracks each character's reputation; low reputation characters cannot travel or hold office |

### 4.5.7 Security laws

| Law | Level | Positions and effects |
|---|---|---|
| **S1 Private Military Contractors** | N exclusive | **Banned** PMCs only through shells (exposure +10 per unit per month) · **Domestic Guarding** unarmed and lightly armed site security · **Licensed** armed contractors and foreign operations with licence · **Unrestricted** PMCs may hold and police territory |
| **S2 Policing Model** | L within N ceiling | **Community** crime +10%, unrest -3 · **Standard** · **Militarized** crime -15%, unrest +3, protest suppression ×1.5 · **Privatized** companies with Power Broker influence may contract policing of districts they dominate |
| **S3 Emergency Powers** | N exclusive | **Constitutional Limits** · **Emergency Decrees** executive may decree laws for 90 days · **Standing Emergency** decrees without limit; elections may be postponed (stability -5 per postponement) · **Martial Law** military governs hubs; all local governments suspended |

### 4.5.8 Governance laws

| Law | Level | Positions and effects |
|---|---|---|
| **G1 Campaign Finance** | N, R may tighten | **Public Funding Only** private donations ≤ $5k per donor per campaign; group funding counts half · **Capped** donations ≤ $50k per donor per campaign; independent expenditure groups allowed, disclosed · **Unlimited Disclosed** no caps; all donors public · **Unlimited Dark Money** no caps; donors hidden behind nonprofits (exposure per $1M = 0) |
| **G2 Lobbying Rules** | N | **Banned** all lobbying counts as bribery (exposure +10 per action) · **Registered and Disclosed** lobby cap +10 support per holder per law, every action public · **Light Disclosure** cap +15 · **Unregulated** cap +25, no disclosure |
| **G3 Media Ownership** | N | **Public Broadcasting Dominant** private outlets capped at 50% of national audience combined; MediaBias cap ±0.15 · **Plurality Rules** no owner above 25% of audience in a country or 40% in a hub · **Concentration Allowed** no caps · **State-Controlled** private outlets must follow the state line; foreign media owners banned |

### 4.5.9 Enactment process

```
Proposal ──> Drafting (1 month) ──> Debate (monthly pass rolls) ──> Enacted ──> Implementation (1 to 3 months) ──> In force
                                        │
                                        └──> Stalled (Support < 0 for 3 rolls) ──> Failed (cooldown 12 months)
```

**Who can propose:**

| Proposer | How | Cost |
|---|---|---|
| Government (AI) | The governing coalition proposes the top law change its leading groups want, at most 2 national bills at a time in democracies, 3 in other types | Free |
| A dynasty member in office | Legislator: one bill per year. Minister: bills in their portfolio. Head of government: any | Hours, plus Support starts +5 for head of government sponsorship |
| Any holder through a client politician | **Commission a Bill** action (4.10.1) | 40 PC national, 20 regional, 10 local |
| Corporate oligarchy Council member | A motion by any seat holder | 10% of its seat weight in PC |

Only one bill per law can be in Drafting or Debate at a time. A proposal targets one position; it can move a law by **at most two steps** **(T)**.

**Duration by type** **(T)**: the monthly pass roll uses a time modifier. Liberal democracy: first roll at month 2 of debate. Managed democracy, one-party state and corporate oligarchy: first roll at month 1. Military junta: decree, enacted the same week as proposed unless the junta council rejects it (Support < 0). Failed state: national laws enact like a junta but only apply in hubs at the enforcement rate (4.3.3).

**Implementation delay**: 1 month for rates and taxes, 2 months for regulatory changes, 3 months for structural changes (C4, C5, C6, F1, F3) **(T)**.

### 4.5.10 Support formula and pass chance

For a bill moving law L to position P:

`Support = Σ_g (Clout_g% × Stance_g(P) / 2) + Sponsor + Lobby + Campaign + Crisis`

- The first term ranges from -100 (every group at --) to +100. Marginalized groups count half.
- **Sponsor**: +15 if the head of government's coalition proposed it; +5 if a legislator proposed it; +10 if a minister in that portfolio proposed it **(T)**.
- **Lobby**: the sum of all active lobby support for and against this bill (4.10), capped at ±40 in total.
- **Campaign**: issue ads and astroturf campaigns (4.10.1).
- **Crisis**: events, for example "Bank Failure" gives +20 to bailout and banking laws for 3 months.

**Threshold T** by type **(T)**: Liberal democracy +10. Managed democracy 0. One-party state 0 (but State Apparatus stances count double). Corporate oligarchy: no clout vote; see below. Military junta -10 (Security Establishment stances count triple).

**Monthly pass chance** = `clamp(10% + 2% × (Support - T), 0%, 75%)` **(T)**.

**Veto by powerful groups**: if a Powerful group (clout ≥ 20%) has stance -- on the position, the pass chance is halved.

**Corporate oligarchy voting**: Council seats are weighted by national influence share of each holder with at least 2% share (the rest share a "Public" seat voting with the clout-weighted IG stance). A motion passes with > 50% of weighted votes, at the next monthly Council session. Votes can be bought from other holders (they are characters with opinions, hooks and prices).

### 4.5.11 Repeal, cooldowns and decrees

- A law that was changed cannot be changed again for 12 months (6 months in non-democracies) **(T)**.
- **Decrees** (Emergency Decrees or above, or any junta or one-party executive): enact immediately, skipping Debate. Cost: stability -3, approval -2 with every group with stance - or -- on it. In a liberal democracy under Emergency Decrees the decree lapses after 90 days unless passed as a normal bill.
- **Court challenge**: any holder can challenge a new law in court for $1M × wealth index (4.10.4) **(T)**. Strike-down chance = `judicial independence × 20%`, rising to `× 60%` for decrees and preemption acts.

---

## 4.6 Elections

### 4.6.1 Schedule by level

| Level | Office | Default term **(T)** | Campaign length | Held in |
|---|---|---|---|---|
| National | Legislature | 4 or 5 years (country data; US House 2) | 16 weeks | Liberal and managed democracies |
| National | Executive (presidential systems) | 4 to 7 years | 20 weeks (plus 8-week primary if the country has primaries) | Liberal and managed democracies |
| Regional | Legislature and governor | 4 years | 10 weeks | Federal democracies; unitary democracies with devolved regions |
| Local | Council and mayor | 2 to 4 years (hub data; default 4) | 6 weeks | All democracies; managed democracies elect councils, often appoint mayors of strategic hubs |
| Any | Referendum | Called by government or by a petition with 5% of adults | 8 weeks | Democracies; corporate sovereignty (4.12) |

- Election dates are fixed by data and checked in the yearly calculation; voting day is a single day, results arrive over 6 to 12 hourly turns, region by region.
- **Snap elections** (parliamentary systems): each month a government's coalition approval average is ≤ -3 or stability < 40, there is a 10% chance the government falls and an election is held in 8 weeks **(T)**. A dynasty with a client prime minister can call one at a time of its choosing (one favor).
- Staggered local elections mean a large country holds some local election almost every month.

### 4.6.2 Electoral systems

Each legislature uses one system, from country data:

| System | Seats | Effect |
|---|---|---|
| **First past the post** | Each constituency (a hub's wards, or a region) goes to the plurality winner | Big parties overrepresented; local influence matters a lot |
| **Proportional** | Seats proportional to national vote share, 5% threshold **(T)** | Coalitions common; small IG parties survive |
| **Mixed** | Half each | |
| **Two-round** (executives) | Runoff between the top two if nobody passes 50% | |

Constituency-level results use the segments of the hubs in that constituency, so **concentrated local influence wins seats** under first past the post.

### 4.6.3 Vote share formula

For each segment s in the constituency and each party (or candidate) p, the game computes a utility, then splits the segment's votes with a softmax.

`U(s,p) = 3 × Ideology(s,p) + Incumbency(p) + Economy(p) + Campaign(p) + Media(s,p) + Ads(s,p) + Psyops(s,p) + Candidate(p) - Scandal(p)`

`Share(s,p) = exp U(s,p) / Σ_q exp U(s,q)`

`VoteShare(p) = Σ_s Pop_s × Turnout_s × Share(s,p) / Σ_s Pop_s × Turnout_s`

| Term | Formula **(T)** | Typical range |
|---|---|---|
| **Ideology** | `Σ_g Aff(s,g)/100 × Member(g,p)` where Member = 1 if group g is in party p | 0 to 1 |
| **Incumbency** | +0.3 for the incumbent party or candidate | 0 to +0.3 |
| **Economy** (incumbent only) | `-0.6 × max(0, (Unemployment - 5)/5) - 0.5 × max(0, (Inflation - 3)/5) + 0.1 × GDP growth` | -1.5 to +0.4 |
| **Campaign** | `0.8 × ln(1 + Spend_p / E)` where E = $0.50 × adults in the constituency, and Spend includes party funds, donations and independent expenditure, multiplied by Money effectiveness | 0 to about +2.0 |
| **Media** | `1.0 × (audience share of outlets endorsing p) - 0.5 × (audience share attacking p)` among segment s | -0.5 to +1.0 |
| **Ads** | Each active ad campaign for p: +0.15 (broad) or +0.3 (targeted at one segment); decays 25% per week | 0 to +0.6 |
| **Psyops** | Each active psyop: +0.3 (broad) or +0.6 (targeted); decays 35% per week; exposure (4.10.3) | 0 to +1.2 |
| **Candidate** | `0.03 × (Influence skill - 10)` + traits: Media Darling +0.3, Scandal-Ridden -0.5, Honest +0.1, Party School +0.1, local origin +0.2 in their birth hub | -0.6 to +0.9 |
| **Scandal** | Fresh scandal: minor 0.3, major 0.8, criminal 1.5; halves every 4 weeks; a debate or apology event can halve it at once | 0 to 1.5 |

Diminishing returns are built in: doubling spend from E to 2E adds only 0.32 utility; from 0 to E adds 0.55.

**Polls**: weekly, the true vote share plus noise of ±3 points (±1.5 with a paid internal poll, $0.05 per adult in the constituency **(T)**).

### 4.6.4 Turnout

`Turnout_s = BaseTurnout_s × TypeMod + GOTV_s + Polarization - Apathy`, clamped 10% to 95% **(T)**

- **BaseTurnout**: table in 4.4.1. **TypeMod**: liberal democracy 1.0, managed democracy 0.85.
- **GOTV** (get out the vote) spending targeted at a segment: +1 point per $0.25 × segment adults spent, cap +8 points per party.
- **Polarization**: +5 points if the top two are within 5 points in polls; +3 if an Angry group backs a party.
- **Apathy**: `0.2 × (60 - Stability)` when stability < 60.
- Under Social Credit, Unemployed and Gig turnout -10 (fear of registration).

### 4.6.5 Campaign event chain

A campaign is an event chain with weekly beats. Typical national chain:

1. **Declaration** (week 1): candidates and slates set. Dynasty members can declare (4.7.2).
2. **Fundraising Dinner** (weekly option): host for 4 hours; raises `$20k × Influence skill × local influence share × 10` **(T)** from local elites.
3. **Endorsements** (weeks 2 to 8): each IG with clout ≥ 10% endorses a party or stays neutral; endorsement is +0.2 utility with that IG's segments; IG endorsements can be lobbied (10 PC national, 3 PC local).
4. **Debate** (once or twice): Influence skill contest, ±0.3 utility to the winner/loser, critical failure (roll 1 in 20) is a minor scandal.
5. **October Surprise** (last 3 weeks): 20% chance per campaign that a scandal or exposé event fires on a random leading candidate **(T)**; rivals can schedule one with a Leak Scandal scheme.
6. **Election Night**: hourly results.
7. **Certification**: results contested if margin < 0.5%: court challenge chain (judicial independence decides).

### 4.6.6 Results and government formation

- Seats are assigned by the electoral system. A party or coalition with > 50% of seats forms the government. Coalition formation (proportional systems) takes 2 to 12 weeks **(T)**; the largest party invites partners whose IG stances are closest; the player can bribe or pay for a partner to join or refuse (decision of the partner's leader, 4.3.5).
- The governing coalition's IGs get the Office clout bonus (4.4.4). The new government:
  - proposes its top law changes in the first 3 months (agenda bonus +5 support during that window **(T)**),
  - replaces ministers, and may replace regulator heads whose term allows (4.9.2) and the central bank governor (if F1 is Coordinated or looser),
  - reviews **government contracts**: contracts awarded by the previous government to holders whose dynasty backed the losing side have a 10% chance each of cancellation in liberal democracies, 40% in managed democracies **(T)**.
- **Market reaction**: the country's index and currency move by `-3% × (approval change of Financiers + Industrialists)/10` over the next week **(T)**.
- A dynasty that funded the winning side gets **favors** (4.7.4); the losing side's donors get "Backed the Loser": -10 opinion of new ministers for 2 years.

### 4.6.7 Managed elections

Managed democracies run the same formula with three extra terms:

| Term | Effect **(T)** |
|---|---|
| **Administrative resource** | Incumbent +0.6 utility in every segment |
| **Fraud** | After counting, `Corruption / 5` points of vote share move from the opposition to the incumbent (50 corruption = 10 points). Visible fraud above 8 points: 15% chance of a protest wave (unrest +10, stability -5) |
| **Disqualification** | Any opposition candidate polling > 35% has a 30% chance per campaign of being disqualified, unless protected by a patron with ≥ 25% national influence |

Backing the opposition in a managed democracy is legal but costs: each $1M donated adds +2 exposure with the Tax Authority and Financial Police in that country **(T)**.

---

## 4.7 Offices, appointments and patronage

### 4.7.1 Office ladder

| Office | Level | How filled | Requirements **(T)** | Time cost per week | Powers | Influence and PC |
|---|---|---|---|---|---|---|
| **City Councilor** | Local | Elected (appointed in one-party states) | Age 21, resident of the hub | 8 h | One council vote on local decisions and laws | +2 share points in the hub; +5 PC per month |
| **Mayor** | Local | Elected or appointed | Age 25, resident | 30 h | Local agenda (propose local laws), whip ±10, appoint city officials and police chief, sign local contracts up to 2% of city budget alone | +10 points in the hub; +20 PC |
| **Regional Legislator** | Regional | Elected | Age 25 | 15 h | Regional vote, one bill per year | +1 point in region; +5 PC |
| **Governor or Premier** | Regional | Elected or appointed | Age 30 | 40 h | Regional agenda, regional contracts, pardons for regional crimes | +8 points in region; +25 PC |
| **National Legislator** | National | Elected | Age 25, citizen | 20 h | National vote, one bill per year, committee hearings (can summon executives) | +0.5 point in country; +8 PC |
| **Minister** | National | Appointed by head of government | Citizen; relevant skill ≥ 12 | 40 h | Portfolio bills, portfolio decisions (permits, licences, contracts), oversight of related agencies | +3 points; +30 PC |
| **Head of Government or State** | National | Elected, appointed by party, or seized | Age 35, citizen | 60 h | National agenda, appoint ministers and agency heads, decrees where allowed, diplomacy | +10 points; +80 PC |
| **Regulator Head** | National | Appointed (term 5 years, LD; at pleasure, others) | Relevant skill ≥ 14 (Finance for securities and banking, Intrigue for financial police) | 40 h | Opens and closes investigations (4.9) | +2 points; +20 PC |
| **Central Bank Governor** | National | Appointed (term 6 years, LD) | Finance ≥ 18 | 40 h | Policy rate, FX intervention (see [07-markets.md](../07-markets.md)) | +3 points; +30 PC |
| **Ambassador** | National | Appointed | Influence ≥ 10 | 30 h | +5 relation between home and host per year; trade mission events | +1 point in host country |
| **Party Official** | National or regional | Party appointment (one-party states) | Party membership; Party School trait helps | 20 to 40 h | Faction strength (4.8.2) | As minister at equivalent level |
| **General** | National | Military career; junta council seat | Military Contractor education or security career | 40 h | Coup participation, Security Establishment approval | Junta council member: +5 points |
| **Council of Stakeholders seat** | National | Influence share ≥ 2% (corporate oligarchy) | Any holder | 10 h | Weighted vote on motions | Built into share |

Holding office **adds influence in that place** as above (05), adds PC, and grants **Political Office** status on the character. Offices are not inherited (04), but a dynasty that held an office for 8+ years gets +0.2 utility for family members running for the same office ("Name Recognition") **(T)**.

### 4.7.2 Running dynasty members for office

- **Eligibility**: age and citizenship above; criminal conviction bars office for 10 years in liberal democracies; Social Credit bars low-reputation characters.
- **Declaring** costs 10 PC (local), 25 (regional), 60 (national) **(T)** and requires a party nomination in proportional systems: a party nominates the candidate with the highest `Influence skill + opinion of party leader / 5 + 10 × donations to the party / E` (E from 4.6.3). In first past the post systems, primaries use the same vote formula among the party's segments.
- **The candidate's time**: campaigning takes 20 h per week (local), 40 h (national). Executive roles at a company must be delegated; a CEO who campaigns gives their company -10% efficiency for the campaign.
- **Conflict of interest** once elected (4.7.5).
- **Benefits**: direct votes, agenda power, office influence, appointment power, and immunity from local investigations while in a head-of-government role (managed democracy and below: always; liberal democracy: never).

### 4.7.3 Appointments

Appointed posts (ministers, regulator heads, central bank governor, ambassadors, mayors in managed and one-party systems, party posts) are filled by an **appointer** character choosing among 3 to 5 candidates. AI generates rivals with appointment scores 20 to 40 **(T)**.

`Appointment score = relevant skill + opinion of appointer / 5 + PC spent / 5 + 15 × favors called on the appointer + 10 if an IG in government endorses + 5 × relevant traits (Law School for justice, Quant PhD for central bank, Military Contractor for defense)` **(T)**

- The player can push a **family member**, a **client** (4.7.4), or simply lobby for any non-hostile candidate.
- Appointments fire when a post is vacant: new government, death, scandal resignation, term end (yearly check).
- **Removal**: an appointee can be dismissed by the appointer at any time in non-democracies; in liberal democracies regulator heads and the governor can only be removed for cause (a scandal or conviction event).

### 4.7.4 Patronage

A dynasty member becomes the **Patron** of a politician (the **client**) by any of:

- funding ≥ 25% of their winning campaign;
- the Court Patron scheme (03) succeeding;
- getting them appointed;
- holding a hook over them.

Client politicians have **Loyalty** (0 to 100) to the patron: starts at 50, +10 per favor repaid by the patron (a donation, a job for a relative, a board seat), -10 per favor called, -20 if the patron is in a scandal, -30 if the patron backed their opponent **(T)**.

**Favors**: each client generates 1 favor every 6 months, plus 1 per major donation (≥ E/2 for their next campaign) **(T)**. Uses:

| Favor use | Effect **(T)** |
|---|---|
| Vote | Legislator: +3 support on one bill (national), +1 council vote (local) |
| Portfolio push | Minister: +8 support on a bill in their portfolio, or approve one portfolio decision |
| Slow an investigation | Minister or regulator head: one investigation step delayed 4 weeks |
| Kill an investigation | Regulator head only, and only before Charges: closes it (2 favors; exposure halved, not cleared) |
| Steer a contract | +15 bid score (4.9.7) |
| Advance notice | Learn a law, rate or contract decision 1 week early (trading on it is insider trading: +20 securities exposure) |
| Appointment | +15 appointment score for a candidate |
| Introduction | Meet any official in their network without the 5 PC cost |

Calling a favor when Loyalty < 40 has a 25% refusal chance; a refusal costs another 10 loyalty and a 10% chance the client leaks the relationship (exposure +10) **(T)**.

Clients are characters: they age, retire, lose elections, get indicted and can turn on you. A client facing prison will offer the regulator your secrets in exchange for leniency (Discovery event "The Client Flips", 4.9.4).

### 4.7.5 Conflict of interest

A dynasty member in office who, directly or through the family trust, holds assets in a sector affected by their votes or portfolio gains +3 exposure per month with the relevant agency (liberal democracy only; +1 in managed democracy) **(T)**, unless they place personal assets in a **blind trust**: the assets are managed by an appointed trustee character, cannot be traded by the official, and count only 50% toward their personal influence. Family trust assets can never be blind; this is a deliberate tension for dynasty heads seeking office.

---

## 4.8 Non-democratic power transfer

### 4.8.1 Regime strength

`RS = 0.4 × Stability + 0.3 × SecurityLoyalty + 0.3 × RulingClout` **(T)**

- **SecurityLoyalty** (0 to 100) = `50 + 5 × approval of Security Establishment`, plus 10 if the head of government is a general (junta), minus 15 if the military's budget was cut in the last 12 months.
- **RulingClout** = combined clout (%) of the IGs in the ruling coalition, capped at 100.
- Liberal democracies use RS only for coup checks during Standing Emergency or Martial Law.

### 4.8.2 Party struggles (one-party states and managed democracies)

- The ruling party has 2 to 4 **factions** (data-driven per country, fictional names). Templates: **Reformists** (aligned with Tech Sector, Financiers, Professionals), **Hardliners** (Security Establishment, State Apparatus), **Princelings** (dynastic networks inside the party; Landowners, Industrialists), **Technocrats** (State Apparatus, Tech Sector).
- **Faction strength** (monthly) = `clout of aligned IGs + 5 × officials in top posts + 0.5 × PC donated by backers + MoneyEff × 0.1 × sqrt(funds / M) × 100 + scandal effects` **(T)**.
- **Yearly Plenum**: the strongest faction gets one top post (minister or province chief). **Party Congress** every 5 years: the strongest faction names the party leader and head of government; ties are broken by the incumbent leader's choice.
- **Backing a faction** (player action): donate through a local partner or front (money), spend PC, provide jobs and board seats to faction members' relatives (patronage, +1 favor each), or run a Dig Up Dirt scheme against a rival faction leader.
- **Purges**: after a Congress, each losing faction has a 50% chance to suffer an **Anti-Corruption Campaign** **(T)**. Every holder that backed it with more than 10 PC or $1M in the past 2 years gets +30 exposure with the Financial Police there, and its branch office and local partner face a seizure ladder step (4.9.10).
- **Ruling family variant**: replace factions with **branches of the ruling family** (2 to 3 princes or princesses as characters). Succession on the ruler's death is decided by a family council: score = `Influence skill + opinion of the ruler / 5 + Security Establishment backing + foreign backing`. The player can marry into a branch (04), fund one, or hold hooks over its members.

### 4.8.3 Monthly coup risk

A coup plot can form on its own (AI generals) or be started by a holder (4.8.4).

**AI coup chance per month** **(T)**:

| Condition | Chance |
|---|---|
| RS ≥ 60 | 0% |
| RS 45 to 59 and Security Establishment approval ≤ -5 | 1% |
| RS 30 to 44 | 2%, doubled if Security Establishment is Angry |
| RS < 30 | 5%, doubled if Security Establishment is Angry |
| Military junta (counter-coup) | ×1.5 |
| Liberal democracy | Only under Standing Emergency or Martial Law, or Stability < 20; then ×0.5 |

### 4.8.4 Coups

**Coup strength (CS)** of a plot:

`CS = PlotterMilitary + PMC + Bribes + ForeignBacking + Popular` **(T)**

| Term | How it is gained **(T)** |
|---|---|
| **PlotterMilitary** | Share of armed forces commanded by plotting generals (10 to 40, from the generals recruited) |
| **PMC** | `2 × PMC units × (10 / MSI)`, cap 30. A **PMC unit** is about 200 contractors, costs $5M per month while deployed. **MSI** (military size index) is 1 (tiny state) to 100 (great power), from country data |
| **Bribes** | +1 per $10M × (MSI / 10) spent buying neutral units, cap 15 |
| **ForeignBacking** | +5 to +15 if a country with relation ≥ 50 to the plotters backs it (AI decision, lobbyable with 30 PC in the backing country) |
| **Popular** | +5 if an Angry IG with clout ≥ 15% supports the plotters; -10 if the regime's ruling IGs have combined clout ≥ 60% |

**Success chance** = `clamp(50% + 1.5% × (CS - RS), 5%, 90%)` **(T)**

**Coup chain (when a holder backs or starts a coup):**

| Step | Duration | What happens | Leak chance |
|---|---|---|---|
| 1. **Sound Out the Generals** | 2 to 4 weeks | Recruit generals one by one: success per general = `40% + 2% × (your Intrigue - 10) + general's opinion of you / 5 - 20% if the general is Loyal or Honest` **(T)** | 10% per week |
| 2. **Assemble** | 2 to 6 weeks | Deploy PMC units (needs S1 Licensed or Unrestricted, or smuggle via shells: +15 exposure per unit), spend bribes, arrange foreign backing, plan targets | 5% per week, +1% per PMC unit |
| 3. **Night of the Coup** | 6 to 24 hourly turns | Three objectives: seize the **capital hub government buildings**, the **national broadcaster**, the **airport and central bank**. Each objective rolls the success chance once; 2 of 3 wins. Player options each turn: commit reserves (+5 CS), negotiate with a wavering general, cut the internet (needs a netrunning asset) | |
| 4. **Aftermath** | 4 to 12 weeks | Recognition events, sanctions, purges, contracts | |

**Leaks**: a leak gives the regime warning: RS +10 for the coup, plotting generals arrested (lose them), and the backer gains +40 exposure with the Financial Police and the Security Establishment's hostility. A leaked plot can still proceed at reduced strength.

**Outcomes:**

| Outcome | Effects **(T)** |
|---|---|
| **Success** (2 or 3 objectives) | Government type becomes Military junta (or the plotters' chosen type if a civilian front was arranged). The backer gets: a hook on the junta leader, 2 favors with each plotting general, first refusal on state assets being privatized, +15 bid score on all contracts for 3 years, Security Establishment approval of the backer +5. Liberal democracies: relation -30 with the new regime; 60% chance each that a liberal democracy bloc imposes Tier 1 sanctions, 25% Tier 2. If the backer is exposed (exposure ≥ 50 with any agency of a liberal democracy), the backer's characters may be listed under Tier 1 sanctions there. Stability -15 |
| **Failure** (0 objectives, or 1 objective with CS < RS) | Plotting generals executed or jailed. Backer: all assets in the country frozen, seizure ladder jumps to Seizure for its branch offices, PMC units lost, its characters in the country arrested (Intrigue escape roll), exposure 100 with the regime's agencies, reputation -30 globally, "Coup Plotter" notoriety for 10 years. Regime RS +15, Stability +5 (rally effect) |
| **Stalemate** (exactly 1 of 3 objectives taken and CS ≥ RS) | Civil conflict: background war "Civil War" starts (4.11.6). Stability -30. Both sides seek backers |

### 4.8.5 Revolutions

**Revolution pressure (RP)** accumulates monthly per country **(T)**:

- If Stability < 30: `RP += (30 - Stability) / 2 + 2 × (number of Angry IGs)`.
- If Stability > 40: `RP -= 5`.
- RP never goes below 0.

| RP | Stage | Effects |
|---|---|---|
| 25 | **Unrest** | Protests in the largest hubs: facility output -5%, real estate in Financial District -3% per month |
| 50 | **Uprising** | Event chain begins: Mass Protest → General Strike (all facilities in affected hubs output -40% while it lasts, 1 to 4 weeks) → Clashes (Militarized policing: RP -10 but Stability -5; Community policing: RP +5). A revolutionary **coalition** forms from Angry IGs |
| 100 | **Revolution** | Government falls. The new type depends on the coalition's leading group (below). A "Revolutionary Council" rules for 3 to 12 months |

**New type after a revolution** **(T)**:

| Leading group | Likely new type |
|---|---|
| Labor Unions, Gig Workers | Liberal democracy (60%) or one-party state "workers' state" (40%) |
| Professionals-heavy coalition (Environmentalists, Transhumanists, Tech Sector) | Liberal democracy |
| Traditionalists | Managed democracy |
| Security Establishment | Military junta |
| Financiers, Industrialists, Tech Sector together with clout ≥ 50% | Corporate oligarchy (only if a capture chain exists, 4.2.5) |
| No group above 25% clout after 3 months | Failed state |

**Revolution consequences for business** **(T)**:

- Foreign assets: nationalization chance per foreign holder = `30% + 10% × (number of anti-business IGs in the coalition: Labor, Gig, Traditionalists, State Apparatus)`.
- Capital controls jump to Hard Controls (70% chance).
- Government default on its bonds (50% chance).
- Government contracts of the old regime voided (80%).
- Holders that funded the revolution get favors with the new leaders; those that funded the old regime's security get "Regime Collaborator": -30 opinion with the new government.

**Player levers**: fund the movement (Fund Interest Group to the Angry IGs), psyops to raise or lower RP (±5 per campaign), fund welfare or strike funds (-3 RP per $ equal to M/20), lobby for concessions (pass a law the Angry groups want: RP -15), or fund security forces and PMCs (RP -10, Stability -3, unrest +5).

### 4.8.6 Aftermath summary

| Event | Contracts | Foreign assets | Bonds | Laws | Player position |
|---|---|---|---|---|---|
| Election loss of backed party | 10 to 40% cancelled | Safe | Safe | New agenda | Lose favors, keep influence |
| Party purge | Backers' contracts reviewed | Seizure ladder +1 step | Safe | Little change | Exposure +30 |
| Successful backed coup | New contracts for backer | Backer safe, rivals at risk | Usually serviced | Decrees | Hooks and favors |
| Failed backed coup | Lost | Frozen and seized | n/a | n/a | Disaster |
| Revolution | Mostly voided | 30 to 70% nationalized | 50% default | Rewritten | Depends on who you funded |

---

## 4.9 Regulators and the state

### 4.9.1 Agencies

Each country has seven agencies. Federal countries also have a regional attorney general and regional tax office that can run the same chains at regional level with half capacity **(T)**.

| Agency | Watches | Exposure sources | Typical penalties |
|---|---|---|---|
| **Securities Regulator** | Exchanges, listed companies, traders | Insider trades, undisclosed stake crossings, market manipulation, false earnings, pump-and-dump psyops | Fines, disgorgement, trading bans, executive bans, delisting |
| **Antitrust Authority** | Mergers, market shares, cartels | Takeovers above C3 thresholds, price-fixing, commodity cornering, predatory pricing | Blocked deals, remedies (divestment), fines up to 10% of revenue, breakups |
| **Tax Authority** | Income, profit, trusts, shells | Shell routing, transfer pricing, undeclared trust income, offshore accounts | Back taxes plus 50 to 200% penalties, asset liens, criminal charges for evasion |
| **Financial Police** (anti-money laundering and financial crime) | Dirty money, bribery, sanctions violations, fronts | Bribes, kickbacks, front companies, black market income, sanctions evasion, coup financing | Asset freezes, confiscation, prison, company dissolution |
| **Foreign Investment Review** | Foreign takeovers and branch offices | Foreign stakes crossing C1 thresholds, strategic sector purchases, tech exports | Blocked deals, forced divestment, mitigation (golden share, local directors) |
| **Banking Supervisor** | Banks, insurers, captive banks, leverage | Captive bank lending to the group, excessive leverage, hidden losses | Capital orders, management removal, resolution (bail-in, nationalization) |
| **Data and Cyberware Authority** | Data trading, AI, cyberware, privacy | Data goods sold beyond T2 limits, unlicensed AI, illegal implants | Fines up to 4% of revenue, product bans, licence revocation |

### 4.9.2 Agency stats and heads

| Stat | Range | Source **(T)** |
|---|---|---|
| **Capacity** | 1 to 5 | Budget set yearly by government (lobbyable decision); default 3 in liberal democracies, 2 in managed, 3 in one-party, 1 in failed states. Detection factor: 1 → ×0.5, 2 → ×0.75, 3 → ×1.0, 4 → ×1.25, 5 → ×1.5 |
| **Zeal** | ×0.6 to ×1.4 | From the head's traits: Ambitious +0.2, Honest +0.2, Paranoid +0.1, Content -0.2, Greedy -0.1, Deceitful -0.1; plus +0.2 for 12 months after a public scandal in the agency's domain |
| **Independence** | 0 to 1 | Equals judicial independence of the government type; decides how far the executive can steer cases (protect allies, target enemies) |
| **Integrity** | 0 to 100 | Head's bribe resistance: 50 + 30 if Honest, -30 if Deceitful, -20 if Greedy, +10 if Paranoid |

The **head** is a full character (skills, traits, family, secrets) appointed by the head of government (4.7.3). The head can be lobbied (opinion), bribed (4.10.4), blackmailed (hooks), befriended, or replaced. Heads have **ambitions**: a high-profile conviction is worth +10 renown to their career; a zealous head will prefer big targets (Tycoon and Oligarch stage dynasties are targeted 1.5× more **(T)**).

### 4.9.3 Exposure

Exposure accumulates per holder (dynasty, company or character) per agency domain per country.

| Action | Exposure gained **(T)** | Agency |
|---|---|---|
| Shell company routing income | +1 per month per shell (× F5 multiplier of the shell's jurisdiction) | Tax Authority |
| Insider trade | +10 (small) to +25 (large or obvious timing) | Securities |
| Undisclosed stake crossing via shell | +15 | Securities |
| Market manipulation, pump psyop | +20 | Securities |
| Cartel or price-fixing agreement | +20, +5 per month | Antitrust |
| Commodity corner (> 30% of a market) | +15 | Antitrust and Securities |
| Bribe (accepted) | +8; +30 if refused and reported | Financial Police |
| Kickback on a contract | +4 per 1% of contract value | Financial Police |
| Psyop campaign | +5 per campaign (× surveillance multiplier) | Financial Police (election law) and Data Authority |
| Front company income | +3 per month per front | Financial Police |
| Sanctions evasion | +25 per month | Financial Police (of the sanctioning country) |
| Captive bank lending > 25% of its book to the group | +5 per month | Banking Supervisor |
| Unlicensed AI or illegal cyberware | +5 per month | Data and Cyberware Authority |
| Ignoring a weakly enforced law | +2 per month per law | Relevant agency |
| Rival's tip-off scheme success | +15 | Any |
| Whistleblower event (disloyal employee) | +20 | Any |

**Decay**: -2 per month in a domain with no new activity for 3 months **(T)**. **Protection** (4.10.1) and friendly heads slow detection but never delete exposure.

### 4.9.4 Investigation chain

**Monthly detection roll** (per holder per agency):

`P(Inquiry) = Exposure/100 × Capacity factor × Zeal × LawFactor × (1 - Protection) × (1 - Corruption/200)`, capped at 60% **(T)**

- LawFactor: F4 detection multipliers for securities; T4 surveillance multipliers for psyops and schemes; 1.0 otherwise.
- Instant inquiry (skips the roll): a published exposé, a whistleblower, a refused bribe that was reported, a failed coup, a client who flips.

**Stages:**

| Stage | Duration | Mechanics **(T)** | Player options |
|---|---|---|---|
| **1. Preliminary Inquiry** | 2 to 6 weeks | **Evidence** starts at Exposure / 4. Each week Evidence += `2 × Capacity × Zeal - GC defense` where GC defense = the higher of the General Counsel's Intrigue or Influence skill, divided by 5. Closes if Evidence < 15 at the end | Cooperate (Evidence +10 now, settlement penalty -30% later); stonewall (Evidence +0 this stage, 20% chance to jump straight to Subpoena); lobby the head; bribe; shred documents (Intrigue scheme; caught = Obstruction, a separate Serious offense) |
| **2. Subpoena** | 1 week | Public announcement: stock -3 to -10%, reputation -5. Characters named gain "Under Investigation" | Hire outside counsel (tier 1 to 3: $1M, $5M, $20M per month × wealth index (4.10.4); counsel adds +2/+4/+8 to defense each week); PR campaign (ads, reduces stock hit by half) |
| **3. Discovery** | 4 to 12 weeks | Evidence += `3 × Capacity × Zeal - GC defense - counsel` per week. Weekly **Cracks** roll: each named subordinate or client with loyalty < 50 has `5% × (1 - loyalty/100)` chance to flip: Evidence +20 | Pay off subordinates (opinion), move them abroad, arrange an "accident" (Intrigue; huge risk), call favors to slow (4 weeks per favor) |
| **4. Charges or Closure** | 1 week | Evidence ≥ 40: charges and a settlement offer. Evidence < 40: closed; exposure halved | |
| **5a. Settlement** | 2 to 6 weeks of negotiation | Penalty at 60% of the trial severity (40% if the holder cooperated), no admission of guilt for Minor and Serious; executives may still be banned | Negotiate (Influence vs head; each success -10% penalty, max 3); offer a scapegoat (a non-dynasty executive takes the fall: -50% penalty, that character's opinion -60 and family hostile) |
| **5b. Trial** | 8 to 26 weeks | Conviction chance = `clamp(Evidence - defense score + 20, 5, 95)%` where defense score = GC skill + 5 × counsel tier (tiers 1 to 3). Non-independent courts: if the executive wants the target convicted (target is a political enemy), conviction = `90% × (1 - judicial independence) + normal chance × judicial independence` | Lobby the judge (managed democracy and below: a decision, 4.3.5); public campaign (jury trial countries: psyops can sway ±10%) |
| **6. Verdict and Penalty** | Instant | Penalty table below; appeals possible once (judicial independence × 30% chance to reduce one tier) | |

### 4.9.5 Outcomes and penalties

Each offense has a **severity tier**. Severity can rise one tier for repeat offenders (another conviction in 10 years) or for Obstruction.

| Tier | Example offenses | Company penalty **(T)** | Character penalty **(T)** | Other |
|---|---|---|---|---|
| **Minor** | Late disclosure, small data breach, minor permit violation | Warning or fine 0.5 to 1% of national revenue | None | Reputation -2 |
| **Serious** | Insider trade by an executive, unreported stake via shell, price-fixing, tax avoidance through shells, unlicensed AI | Fine 2 to 5% of revenue; disgorgement of gains × 1.5; back taxes + 50% | Executive ban 2 to 5 years (cannot sit on boards in that country); "Scandal-Ridden" trait | Reputation -10; stock -5 to -15% |
| **Grave** | Market manipulation, cartel, bribery of officials, systematic tax evasion, sanctions evasion, illegal cyberware trade | Fine 5 to 10% of global revenue; forced divestment of the offending business; licence suspension 3 to 12 months; deal unwound | Executive ban 10 years; prison 2 to 8 years possible (conviction × 50%); "Under Investigation" becomes "Blacklisted" | Reputation -25; stock -15 to -40%; asset freeze during appeal; relations -5 between the holder's home country and the prosecuting country if foreign |
| **Criminal** | Coup financing, laundering for cartels, ordering violence, large fraud | Company dissolution or forced sale at 50% of value; all assets in the country frozen and confiscated (judicial independence × 50% chance to recover a part) | Prison 8 to 25 years; extradition requests to countries with relation ≥ 25 | Reputation -50; "Blacklisted"; Tier 1 sanctions listing possible (liberal democracies, 30%) |

For a trust or a character (not a company), fines are 1× (Serious), 2× (Grave) or 3× (Criminal) the gains or the evaded amount instead of a share of revenue **(T)**.

Prison removes the character from play for the sentence (they can still own assets, write wills and hold hooks; a 3-hour weekly "visiting hours" action lets family consult them). Life extension (03) can make long sentences survivable.

### 4.9.6 Merger and foreign investment review

Takeovers (01) above C3 or C1 thresholds trigger a **review chain**:

| Step | Duration **(T)** | Mechanics |
|---|---|---|
| **Filing** | 1 week | Mandatory when the threshold is crossed; skipping filing = Serious offense, deal voidable |
| **Phase 1** | 4 weeks | Cleared unless `Concern ≥ 30`, where Concern = `2 × (post-deal share - threshold) + 10 if foreign buyer in strategic sector + 15 if the buyer's home relation < 0 + head's Zeal × 10 - your PC spent / 2` |
| **Phase 2** | 12 to 20 weeks | Outcome roll: **Clear** `max(0, 60 - Concern)%`, **Clear with remedies** (divest enough to bring share to the threshold, or golden share for foreign buyers) `30%`, **Block** the remainder |
| **Appeal** | 8 to 16 weeks | Overturn chance `judicial independence × 25%` |

During review, the target's price trades at a discount to the offer reflecting the block chance.

### 4.9.7 Government contracts

| Contract type | Level | Typical size **(T)** | Duration | Restrictions |
|---|---|---|---|---|
| Defense procurement | National | 0.05 to 0.5% of GDP | 5 to 10 years | Domestic or allied bidders only; Security Establishment approval ≥ 0 |
| Surveillance systems | National or local | 0.01 to 0.1% of GDP | 3 to 5 years | Domestic or allied; T4 at Expanded or above |
| National infrastructure (rail, grid, ports) | National or regional | 0.1 to 1% of GDP | 5 to 15 years | Foreign bidders need a local partner if C1 is Capped |
| Healthcare and pharma supply | National or regional | 0.05 to 0.3% of GDP | 3 to 5 years | |
| Government IT and cloud | Any | 0.01 to 0.1% of GDP | 3 to 7 years | T2 Data Sovereignty requires in-country data centers |
| City services (transit, waste, utilities) | Local | 1 to 10% of the city budget | 5 to 20 years | |
| Reconstruction | National | Large, after wars and disasters | 2 to 10 years | Often tied to foreign aid |
| Security services (PMC) | National | Variable | 1 to 3 years | S1 Licensed or above |

**Tender chain**: Announcement (quarterly calculation) → Bidding window (4 weeks) → Evaluation (2 to 6 weeks) → Award event → optional Protest by losers (judicial independence × 20% chance to re-run the tender).

**Bid score** **(T)**:

`Bid score = 40 × (lowest price / your price) + 30 × capability + 20 × political + 10 × relation + kickback`

- **Capability** (0 to 1): fit of your facilities, tech level and track record for the contract.
- **Political** (0 to 1): `min(1, PC spent / 50 + 0.2 × favors called + 0.3 if a dynasty member is minister or mayor in charge)`.
- **Relation** (0 to 1): 1.0 for domestic holders; for foreign holders, `relation of home to host / 100`, minimum 0.
- **Kickback**: in managed democracies and below, `+3 per 1% of contract value` paid to the decision-maker (exposure +4 per 1%). In liberal democracies kickbacks are possible only through a bribed official and add +2 per 1% with exposure +8 per 1%.
- The highest score wins. Ties go to the domestic bidder.
- Failing to deliver (capacity shortfall) triggers penalties of 10 to 30% of contract value and reputation -10.

### 4.9.8 Bailouts

**Systemically important** companies **(T)**: banks or insurers with assets ≥ 2% of GDP; any company employing ≥ 0.3% of the national workforce; the sole domestic producer in a strategic sector; any company whose failure would push Stability down by ≥ 5.

**Bailout chain**: Distress (cash runway < 1 month or a bank run event) → Request (the company's head asks; a dynasty can lobby) → Government decision (weekly, up to 4 weeks) → Terms → Repayment or nationalization.

**Bailout chance per weekly decision** = `30% + 15% if systemically important + 10% under Bailout with Stakes (-20% under Bail-In) + PC spent / 2 (as percentage points) - 20% if the company's owners are foreign - 10% per Angry group opposing bailouts` **(T)**. Under F7 No Bailouts the chance is 0 unless an emergency decree passes. Under Too Big to Fail it is automatic for systemically important companies.

| Form | Terms **(T)** |
|---|---|
| **Loan** | 5-year loan at policy rate + 3%; dividend and buyback ban until repaid; executive bonuses capped |
| **Equity** | State buys new shares worth 20 to 80% of the enlarged company at a 30% discount to the last price; existing holders diluted; State-Linked charter with golden share while state holds ≥ 10% |
| **Guarantee** | State guarantees new debt; fee 1% per year; covenants |
| **Bail-in** (F7 Bail-In) | Bondholders haircut 30 to 60% before any state money; shareholders wiped below 10% of old value |

**Conditions** attached to any bailout: 50% chance the government demands the CEO's replacement (it appoints from a list it controls); 30% chance of a mandated sale of a division; political strings: no layoffs for 2 years (Labor and Gig approval +1) **(T)**.

### 4.9.9 Nationalization

A government can nationalize a company, a facility or a stake. Triggers **(T)**:

| Trigger | Chance or rule |
|---|---|
| Bailout equity > 50% | Automatic: state becomes controlling holder |
| Failure to repay a bailout loan | 50% per missed year |
| Revolution | Per 4.8.5 |
| Hostile government (relation with owner's home ≤ -50) and strategic sector | 5% per month |
| Sanctions retaliation | 10% per month per sanctions tier on foreign-owned assets of the sanctioning bloc |
| E6 State Champions with State Apparatus clout ≥ 25% | 2% per year per foreign-owned company in the sector |
| Branch office seizure ladder | 4.9.10 |
| Corporate sovereignty reclamation | 4.12.5 |

**Compensation** paid to the owner **(T)**:

| Government type | Compensation | Paid as |
|---|---|---|
| Liberal democracy | 90 to 100% of market value | Government bonds over 5 years |
| Managed democracy | 50% | Bonds over 10 years, 20% default risk |
| One-party state | 30% | Local currency, Hard Controls apply |
| Corporate oligarchy | Negotiated: the Council votes | Any |
| Military junta | 10 to 30% | Often never paid (50%) |
| Failed state | 0% | None |

**Arbitration**: if the owner's home and host have a trade agreement (FTA or better) or relation ≥ 25 at the time of seizure, the owner can start international arbitration (12 to 36 months, legal costs $5M to $50M); win chance 60% (−20% if the owner was convicted of a Grave offense there); winning recovers an extra 30% of value, paid if the host's relation with the owner's home stays ≥ 0 **(T)**.

### 4.9.10 Branch office seizure

Branch offices (01) live at the mercy of the host. Each month the host computes **Seizure risk** for each foreign branch office:

`Seizure risk (%) = TypeBase + max(0, -Relation)/50 + 2 × SanctionsTier + 1 if strategic sector + 1 if host IG approval of foreign business (State Apparatus or Security Establishment) ≤ -5 - 10 × your national influence share in the host - 0.5 if local partner loyalty ≥ 60` (minimum 0) **(T)**

TypeBase: Liberal democracy 0, Managed democracy 0.2, One-party 0.3, Corporate oligarchy 0.2, Military junta 0.5, Failed state 1.0.

A successful roll **does not seize directly**. It advances the **seizure ladder** by one step. Steps decay back by one after 12 months with no further advance.

| Step | Event | Host demand | Player options |
|---|---|---|---|
| **1. Pressure** | *Beijing Calls* style meeting | Raise local partner stake by 10 points, or a tech transfer, or a new local factory | Comply (ladder resets to 0); negotiate (Influence vs minister: success holds the ladder 6 months); refuse (ladder stays, relation of host with your company -10) |
| **2. Demands** | Formal demand with deadline (8 weeks) | Larger concessions: partner to 51%, State Golden Share, executive replacement | Comply (reset to 1); appeal through your home government (ambassador, relation trade-off); lobby with PC (cost 30 PC to hold 6 months) |
| **3. Restrictions** | Dividend freeze, exit bans on expatriate executives (they cannot leave the country), tax audit (Tax Authority inquiry opens) | Full compliance with steps 1 and 2 | Comply; smuggle cash out (Financial Police exposure +25); evacuate executives (Intrigue scheme) |
| **4. Seizure** | Administrator appointed; the state or the local partner takes control | n/a | Compensation per 4.9.9; arbitration; long game: back a faction or coup to reverse it |

**Skipping steps**: a war between home and host, sanctions Tier 3 or higher, or a failed coup backed by the owner moves the ladder straight to Step 3 or 4.

---

## 4.10 Lobbying and political spending

### 4.10.1 Actions

**Lobby Points (LP)** measure lobbying for one bill. LP are bought with PC and money:

`LP = PC spent + MoneyEff × money spent / LP price`, where `LP price = jurisdiction GDP × 0.000001` **(T)**

Examples: a $28T country: $28M per LP; a $3T country: $3M; a $200B city: $200k. Each LP adds **+0.5 support** to the lobbied position (or against it), decaying 10% per month **(T)**, subject to caps below.

| Action | Level | Cost **(T)** | Hours | Effect | Cap | Exposure |
|---|---|---|---|---|---|---|
| **Meet Official** | Any | 5 PC (free with an Introduction favor) | 2 | Opinion +10 (decays 2/month); required before Bribe or Court Patron | 1 per official per week | 0 |
| **Lobby Bill** | Any | PC and money as LP | 4 per week (or a lobbying firm: +20% money cost, 0 hours) | +0.5 support per LP | Per holder per bill: G2 cap (+10 / +15 / +25); total all lobbying ±40 | 0 if legal; disclosed under Registered and Disclosed: opposing IGs' approval of your dynasty -1 |
| **Fund Interest Group** | Any | Money | 1 | Clout per 4.4.5 | Clout from money cap +0.30 | 0; Capped G1: +1 per $ M/100 above the cap |
| **Campaign Donation** | Any | Money, within G1 cap per character (each dynasty member can donate separately) | 1 | Campaign spending for a party or candidate; the recipient's opinion of the donor +1 per 2% of E donated (cap +25, decays 1 per month) | G1 | 0 legal; +5 if routed through shells to exceed caps |
| **Independent Expenditure** (super-PAC style) | Any | Money | 2 | Campaign spending, or Ads for or against a candidate | None under Unlimited; banned under Public Funding Only | 0 disclosed; 0 under Dark Money; +5 per M/100 if done illegally |
| **Issue Campaign** (ads) | Any | $ (0.10 × adults in jurisdiction) per week | 2 | +3 support on a bill for as long as it runs, then decays 25% per week; also +0.02 MediaBias for an IG | 2 active per bill per holder | 0 |
| **Astroturf Campaign** (psyops) | Any | $ (0.04 × adults) per week | 2 | +6 support on a bill; or +0.05 MediaBias; decays 35% per week | 2 active per bill per holder | +5 per campaign start, × surveillance multiplier; exposé chance below |
| **Commission a Bill** | Any | 40 / 20 / 10 PC (national / regional / local) | 4 | Starts a bill in Drafting through a client politician | One open bill per law | 0 |
| **Request Decision** (permit, rezoning, licence, capital transfer approval) | Local / regional / national | 10 / 20 / 30 PC | 2 | Puts the request to the deciding body (4.3.5) | | 0 |
| **Request Protection** | Any | 25 PC national, 10 regional, 5 local, per agency, plus 5 PC per month upkeep | 2 | Detection × 0.7 and investigations -1 Evidence per week, for that agency | 1 active per agency | 0, but if the protecting official falls in a scandal, +10 |
| **Bribe Official** | Any | Money (4.10.4) | 2 | One decision, vote or favor without opinion or loyalty | | +8 if accepted; +30 if refused and reported |
| **Blackmail Official** | Any | Spend a hook | 2 | As a favor; client loyalty irrelevant | | +5; official's opinion -50; 20% chance they go to the police anyway if Brave |
| **Court Patron** | Any | Scheme (03) | Varies | Make the official a client (4.7.4) | | 0 |
| **Host Gala** | Local or regional | $ (0.02 × adults in hub) | 6 | +5 opinion with all officials in the hub; temporary influence boost (05) | 1 per month per hub | 0 |

### 4.10.2 Caps

- **Per holder per bill**: G2 cap as above. A dynasty counts as one holder; its companies count separately only if the dynasty does not control them.
- **All lobbying on one bill**: ±40 support total from all lobbyists combined, for and against **(T)**.
- **PC pool cap**: 6 × monthly gain (4.1.2).
- **Money cap**: none in principle; diminishing returns through square roots and the support cap make extreme spending wasteful.

### 4.10.3 Exposure risk from political spending

Political exposure feeds the same investigation system (4.9) and a separate **exposé** check run by the press.

**Monthly exposé chance** per holder per country = `Political exposure / 200 × Media freedom × (1 + 0.5 if a rival dynasty runs a Dig Up Dirt scheme on you)` **(T)**.

An exposé causes a **scandal** (minor, major or criminal, by what was found), triggers an instant inquiry, and gives the targeted politicians a scandal too, which damages their loyalty to you by 20.

### 4.10.4 Bribes

`Bribe cost = office base × wealth index × (110 - Corruption) / 60 × (1 + Integrity / 100)` **(T)**

Office bases: City Councilor $50k, Mayor $500k, Regional Legislator $200k, Governor $2M, National Legislator $1M, Minister $5M, Regulator Head $3M, Judge $1M, Central Bank Governor $10M, Head of Government $25M, General $2M.

**Wealth index** = country GDP per capita / $20,000, minimum 0.2, maximum 4 **(T)**.

**Acceptance chance** = `Corruption% + 20% if Greedy - 40% if Honest + opinion of you / 5 + 10% if you hold a hook - 15% if the official is Paranoid`, clamped 5 to 95% **(T)**.

A refused bribe is reported 50% of the time (60% if Honest) **(T)**: exposure +30 and instant inquiry by the Financial Police.

---

## 4.11 International relations

Countries are AI actors. Players do not conduct diplomacy directly; they lobby the governments that do, and live with the results.

### 4.11.1 Relation score

Relation (-100 to +100) per country pair, recalculated monthly. It drifts 1 point per month toward the pair's **base relation**.

| Component | Value **(T)** |
|---|---|
| Base relation | From data: history, culture, alignment (-60 to +60) |
| Same government type family (democracies with democracies, etc.) | +10 |
| Trade agreement | +5 (Preferential) to +20 (Single Market) |
| Alliance | +30 |
| Rivalry | -40 |
| Sanctions in force | -15 per tier (from the sanctioned side, -20 per tier) |
| Trade war | -10 per escalation level |
| At war (direct) | Set to -100 |
| Backed a coup against the other | -30 for 10 years |
| Ambassador of high skill | +5 per year (cap +15) |
| Lobbying by holders (Improve Relations action in either capital) | +1 per 20 PC spent, cap +10 per year per holder |
| Trade volume between them | +1 per 1% of GDP traded, cap +10 |

| Relation band | Name | Effects |
|---|---|---|
| ≥ 50 | **Friendly** | Foreign Investment Review treats each other's holders one step looser on C1; visa-free travel (character travel time -2 h); arbitration available |
| 0 to 49 | **Cordial** | Normal |
| -1 to -49 | **Cool** | C1 effectively one step stricter for each other's holders; trade agreements may be suspended (5% per month below -25) |
| -50 to -79 | **Hostile** | Sanctions chance 5% per month (from the stronger side); seizure risk terms apply; espionage events |
| ≤ -80 | **Enemy** | War chance 1% per month if either is a junta or one-party state, 0.3% otherwise **(T)** |

### 4.11.2 Trade agreements

| Tier | Requires relation **(T)** | Effect |
|---|---|---|
| **Preferential Trade** | ≥ 25 | Tariffs between members halved |
| **Free Trade Agreement** | ≥ 40 | Tariffs 0 on most goods; investment treaty (arbitration available) |
| **Customs Union** | ≥ 60, same exchange of tariffs | Common external tariff (average of members, weighted by GDP) |
| **Single Market** | ≥ 75 | Customs union plus free movement of capital and labor; C1 treats member holders as domestic; F2 cannot be stricter than Reporting between members |

Agreements are proposed by governments (AI, yearly), lobbyable (Industrialists and Financiers usually support, Labor and Traditionalists usually oppose), and ratified like a law in each member (Support threshold of that country).

### 4.11.3 Alliances and rivalries

- **Defense Alliance**: members enter wars on each other's side (as background participants), share sanctions, and get +20 bid score on each other's defense contracts as "allied" bidders.
- **Economic Bloc**: coordinate sanctions and trade war responses; usually built on a Single Market.
- **Rivalry**: set from data at start; can be created when relation stays ≤ -50 for 24 months. Rivals run espionage events against each other's companies (rival's state hackers target your facilities: Netrun events, 2% per month per strategic facility **(T)**), and sanction each other more readily (×2 sanction chance).

### 4.11.4 Sanctions

Sanctions are imposed by a country or bloc on a target country, sector or holder. Each tier includes the tiers below it.

| Tier | Name | What freezes | Routes and trade | Finance |
|---|---|---|---|---|
| **1** | **Targeted** | Assets of listed characters and companies inside the sanctioning countries; listed characters cannot travel there | No route closures | Listed holders cannot use the sanctioning countries' banks or currencies |
| **2** | **Sectoral** | Plus: new investment in listed sectors (energy, finance, defense, tech) of the target | Export bans on advanced components, chips, cyberware and AI to the target; import bans on the target's listed goods | Target's companies in listed sectors barred from sanctioning exchanges and bond markets |
| **3** | **Financial** | Plus: the target's central bank reserves held in sanctioning currencies; all stakes held by target-country holders in sanctioning-country companies (voting rights suspended) | Insurance and shipping finance withdrawn: target-flagged ships on routes through sanctioning chokepoints stopped | Target cut off from the international payment network: dividends, interest and transfers between the target and sanctioning countries blocked; target bonds delisted |
| **4** | **Embargo** | All assets of all target-country holders in sanctioning countries; all assets of sanctioning-country holders in the target are expected to be seized by retaliation | All trade routes (shipping, air, rail, pipeline, fiber) between sanctioning countries and the target closed; chokepoints controlled by sanctioning countries closed to target trade | Full financial cut-off |

- **Secondary sanctions** (flag on Tier 2+): third-country holders that trade with the target in sanctioned goods are listed at Tier 1 with 10% chance per month of continued trade **(T)**.
- **Imposition**: a government decision driven by relation, rivalry, war, coups, human rights events, and IG pressure (Security Establishment and Traditionalists push; Financiers and Industrialists with business in the target resist). Holders can lobby for or against (30 PC national to shift the decision chance by ±10 points **(T)**).
- **Lifting**: monthly 3% chance per tier once the triggering cause ends and relation > -40 **(T)**; lifting happens one tier at a time.
- **Retaliation**: a sanctioned target imposes counter-sanctions one tier lower on the sanctioner's holders within 4 weeks (70% **(T)**), and raises seizure risk for their branch offices (4.9.10).

**Branch offices in a sanctioned country** face a choice event (*The Wall Comes Down*):

| Option | Result **(T)** |
|---|---|
| **Comply and exit** | Sell to the local partner or a state buyer at 10 to 40% of value over 4 to 12 weeks; reputation +5 at home |
| **Ring-fence** | Keep operating isolated: no dividends or tech flow to the parent, profits trapped in local currency; the parent writes the stake down 50%; seizure ladder risk continues |
| **Evade** | Route trade and cash through a shell in a neutral haven: profits flow, but +25 exposure per month with the sanctioning country's Financial Police; Criminal tier if convicted |
| **Spin off** | Transfer the branch to a cadet house or a friendly third-country holder (requires a third-country holder willing; counts as evasion if the dynasty keeps control through hooks) |

### 4.11.5 Trade wars

Trade wars escalate in four levels. Each month a trade war is in force, escalation chance = `5% + max(0, -Relation)/10 % + 5% if Labor or Industrialists clout ≥ 25% in either country`, de-escalation chance = `5% + max(0, Relation)/10 %` **(T)**.

| Level | Measures | Typical effect |
|---|---|---|
| **1. Skirmish** | +10% tariffs on 3 to 5 targeted goods | Prices of those goods +5 to 10% in both countries |
| **2. Broad Tariffs** | +25% on most goods both ways | Trade volume between them -30%; affected exporters' stocks -5 to -15% |
| **3. Export Controls** | +50% tariffs; export bans on chips, rare earths, AI and cyberware components | Supply chain shocks (06); substitute suppliers' prices +20 to 40% |
| **4. Decoupling** | Near-embargo on strategic goods; investment screening of each other's holders at Capped All | Stocks with exposure -20 to -40%; branch office seizure risk as Hostile |

### 4.11.6 Background wars

Wars are background events. The player never commands armies, only PMCs (4.8.4).

| Intensity | Example | Hubs in the war zone | Adjacent hubs and routes | Global |
|---|---|---|---|---|
| **Border clash** | Skirmishes for weeks | Output -10%; real estate -5% | Route disruption 5% chance per week | Defense stocks +5% |
| **Regional war** | Months of fighting | Output -50%; each facility 2% per month destroyed; real estate -40%; population flight 2% per month | Output -10 to -20%; chokepoints at risk (20% closure per month) | Oil +20 to 50%; defense demand +30%; PMC demand +50% |
| **Major war** | Great powers involved | Output -80 to -100%; facility destruction 5% per month; martial law | Output -20%; insurance on routes +300% | Oil +50 to 100%; commodity spikes; global stocks -10 to -25%; sanctions waves |
| **Civil war** | After a stalemate coup or revolution | As regional war, split between two governments that each claim the country | As regional | Minor |

- **War chance**: from relation (4.11.1), rivalry, junta and one-party ambition, and disputed territory data.
- **Peace**: each month 5% + 5% per year of war, +10% if either side's stability < 25 **(T)**.
- **Reconstruction**: after peace, reconstruction contracts worth 5 to 20% of the war-zone countries' GDP are tendered over 3 to 5 years.
- **Opportunities**: defense manufacturing, PMC services, commodities, reconstruction, distressed asset purchases in affected hubs (real estate at -40% can be bought by those brave enough).

### 4.11.7 Stability formula

Recalculated monthly per country **(T)**:

```
Stability = Baseline(type)
          - 1.5 × max(0, Inflation% - 4)
          - 1.0 × max(0, Unemployment% - 6)
          - 0.3 × AverageUnrest (population-weighted, 0 to 100)
          - 3 × AngryGroups + 1 × LoyalGroups          (4.4.6)
          - GovernmentScandals (5 each, decaying 1 per month)
          + 0.5 × GDP growth% (capped ±5)
          - WarPenalty (border 5, regional 15, major 25, civil 30; +10 if fighting on home soil)
          - 3 × SanctionsTier (highest tier on this country)
          - 5 × (visible fraud event in the last 12 months)
          + Country modifier (data, ±10)
clamped to 0..100
```

Hub stability (for local unrest and protests) = country stability + local modifiers (local unemployment, local unrest, policing model), ±20 **(T)**.

| Band | Name | Effects **(T)** |
|---|---|---|
| ≥ 70 | **Stable** | Bond spreads at their base; country risk premium 0 |
| 50 to 69 | **Tense** | Risk premium on bonds +1%; FDI -10% |
| 30 to 49 | **Unstable** | Risk premium +3%; capital flight 1% of foreign holdings per month; coup and default checks active |
| 15 to 29 | **Crisis** | Risk premium +8%; revolution pressure builds; currency crisis chance ×2 |
| < 15 | **Collapse** | Failed state transition after 3 months below 10 |

### 4.11.8 Consequences: default, currency crisis, revolution

**Currency crisis** (countries with Peg, Currency Board or Managed Float) **(T)**:

`Monthly chance = 5% × max(0, 3 - reserve cover in months of imports) × (1 + max(0, 50 - Stability)/25) + 0.5 × (net speculative short positions against the currency / reserves)`

- A free-floating currency cannot have a peg break, but under Stability < 25 it has a 4% monthly chance of a **disorderly collapse** with the same effects at half size.
- **Effects**: the currency falls 30 to 60% over 1 to 4 weeks; inflation +10 to +40 points over the next 12 months; the central bank raises the policy rate by 5 to 20 points; Stability -10; capital controls move one step stricter (60% chance); holders with debt in foreign currency see it grow by the same percentage; foreign holders' local assets lose value in their home currency.
- **Who profits**: holders short the currency (players attacking a weak peg, see [07-markets.md](../07-markets.md)), exporters, foreign-currency holders in the country.

**Sovereign default** **(T)**:

`Monthly chance = max(0, Debt/GDP% - Limit) / 300 × (1 + max(0, 40 - Stability)/20) + 10% in the month of a currency crisis if ≥ 40% of debt is in foreign currency`

- Limit: 120% if less than 40% of debt is in foreign currency, else 60%.
- **Effects**: bonds haircut 30 to 70% (restructuring chain: Moratorium → Negotiation with creditors (holders with ≥ 5% of the bonds get a seat) → Haircut agreed or Holdout lawsuits); credit rating to D; domestic banks holding the bonds need recapitalization (bailout chain, 4.9.8); capital controls to Restricted or Hard (70%); Stability -15; government contracts paid late (50% delayed 6 months).
- Regional and city governments can default on their own bonds with the same formula on their own debt and revenue (Limit 30% of regional GDP **(T)**); a national bailout of a region has the chance of a bailout of a systemically important company.

**Revolution**: 4.8.5.

---

## 4.12 Corporate sovereignty (endgame)

At extreme influence, a dynasty or megacorp can turn a hub into territory its company governs. This is a Stage 5 (Oligarch) goal (see [14-game-stages.md](../14-game-stages.md)).

### 4.12.1 The three stages

| Stage | What it is | Needs national law | Powers gained |
|---|---|---|---|
| **1. Special Economic Zone** | The hub (or a district of it) is a tax zone and the company runs its services | C6 Tax Zones or higher | Corporate tax -50% in the zone; company manages zone infrastructure and collects fees; +10 PC per month in the hub |
| **2. Charter City** | The company's board becomes the city government | C6 Charter Zones or higher | The zone sets its own E8, E10, E11, L1 (above the national floor) to L5, S2 (Privatized allowed), and local taxes; local elections replaced by **Company Administration** (the controlling company's head appoints the mayor; residents get a Residents' Council with advisory votes) |
| **3. Sovereign Corporate Zone** | The hub is a separate polity governed by the company's charter | C6 Sovereign Charters, which can only be enacted in a corporate oligarchy, a failed state, or by treaty with Support ≥ +40 | All law categories except those reserved in the treaty; its own relations, its own exchange and (optionally) its own currency or scrip; its own security forces; becomes a city-state jurisdiction (4.3.2) |

### 4.12.2 Requirements **(T)**

| Requirement | Stage 1 | Stage 2 | Stage 3 |
|---|---|---|---|
| Hub influence share (dynasty or company) | ≥ 50% (Kingmaker) for 12 months | ≥ 60% for 24 months | ≥ 75% for 36 months |
| Regional influence share | ≥ 25% | ≥ 35% | ≥ 50% |
| National position | ≥ 10% national share or a client minister | ≥ 25% national share, or a client head of government, or government type Corporate oligarchy | Council of Stakeholders chair (corporate oligarchy), or controlling the Failed state's capital hub, or a ratified treaty |
| Local government | Mayor is a client or dynasty member | Same, plus council majority | n/a (replaced) |
| Reputation | ≥ 0 | ≥ 10 | Any |
| Security | n/a | PMC or private policing in the hub: 1 unit per 500k residents | 1 unit per 200k residents, plus air and cyber defense facilities |
| Money | Zone setup $500M × wealth index | $5B × wealth index | $20B × wealth index plus a treaty payment |

### 4.12.3 Process

Each stage is an event chain:

1. **Feasibility Study** (8 weeks): the game shows the expected backlash: IG reactions, unrest, international reaction.
2. **Enabling Legislation**: the C6 position must be in force nationally (pass it as a law; Sovereign Charters face State Apparatus and Traditionalists at -- and Labor at -).
3. **Charter Negotiation** (4 to 12 weeks, Influence contest with the head of government): terms are chosen from a menu:
   - Revenue share to the national government: 10 to 30% of zone tax revenue.
   - Lease length: 50 or 99 years (Stage 2), perpetual (Stage 3).
   - Reserved powers: defense, currency, citizenship (each reserved power lowers backlash by 10%).
   - Resident guarantees: keep minimum wage floor, keep elections for a Residents' Council (each lowers unrest).
4. **Referendum** (democracies only; hub residents vote; formula 4.6.3 with Yes and No as the two options; the company's media, ads and psyops apply; Labor, Traditionalists, Environmentalists and State Apparatus campaign No).
5. **Handover** (4 weeks): local government dissolves (Stage 2) or the national flag comes down (Stage 3). Local officials who are not clients may resist (event).
6. **Backlash** (ongoing): see 4.12.5.

### 4.12.4 Governing a corporate zone

- **Upkeep**: the company pays for services: $1,500 per resident per year × wealth index for Stage 2, $3,000 for Stage 3 (security, utilities, courts) **(T)**, and collects zone taxes it sets.
- **Laws**: set by board resolution: no debate phase; enacted at the next monthly board meeting. Each law change still moves IG approval and unrest among residents.
- **Residents' Council**: advisory. If resident unrest exceeds 50, it can call a **Charter Strike** (zone output -40%) or petition the national government to revoke the charter.
- **Citizenship and labor**: Stage 3 zones control immigration (L5) and can sell residency to wealthy characters (revenue, but Traditionalist backlash in the host country).
- **Courts**: private arbitration replaces courts; regulators of the host country lose jurisdiction (Stage 3) or keep only Financial Police and Securities powers (Stage 2).
- **Score**: Stage 2 gives +500 renown per decade held, Stage 3 +2,000 **(T)**, and counts toward the Corporate Sovereignty endgame objective (14).

### 4.12.5 Consequences and backlash

| Source | Effect **(T)** |
|---|---|
| Host country IGs | Approval -2 for State Apparatus, Labor, Traditionalists; host stability -3 (Stage 2) or -8 (Stage 3) |
| Residents | Unrest +10 at handover, decaying 1 per month if the zone keeps minimum wage and a Residents' Council |
| Liberal democracies | Relation -10 with the host for Stage 3; Tier 1 sanctions on the company's executives 20% (if the zone was won through a coup or capture) |
| Rival dynasties | AI rivals with ≥ 10% influence in the host country gain a "Stop the Charter" casus belli and may fund the opposition, revolutions or a hostile takeover of the company |
| **Reclamation** | Each month a hostile national government (relation to the company's head ≤ -25, or a government formed by parties that campaigned against the charter) has a 5% chance to start a **Reclamation** chain: Revocation Bill → Court Challenge (judicial independence decides if the charter's terms are respected) → Standoff (company security vs national police or military; PMC strength vs RS) → Reclaimed (nationalization with compensation per 4.9.9) or Charter Upheld |
| Stage 3 recognition | Each country decides to recognize the zone (relation with the company's home ≥ 25 and a trade deal); unrecognized zones cannot list on foreign exchanges or use the international payment network until 3 countries recognize them |

---

## 4.13 Worked examples

All numbers use the tuning values above.

### 4.13.1 Buying a city council (rezoning for a chip fab)

**Situation.** The dynasty wants to build a chip fab on a 40-acre plot zoned Residential in Phoenix (United States, liberal democracy, corruption 25, wealth index 4). The hub has 2.5M people (1.9M adults) and a 9-seat council elected by ward. E11 Zoning is Standard: rezoning needs 5 of 9 votes. The dynasty's hub influence share is 18% (Presence tier).

**PC.** `100 × sqrt(0.18) × 1.0 = 42 PC per month`, pool cap 254.

**The council before any action** (disposition = 10 × stance + opinion / 5):

| Seat | Party | Stance on rezoning | Opinion of dynasty | Disposition | Vote |
|---|---|---|---|---|---|
| 1 to 3 | Business party | +1 (jobs, investment) | 0 | +10 | Yes |
| 4 and 5 | Business party, homeowner wards | -1 (neighbours object) | 0 | -10 | No |
| 6 and 7 | Labor-green party, green wing | -1 | -10 | -12 | No |
| 8 | Labor-green party, union wing | 0 (jobs vs environment) | 0 | 0 | Yes |
| 9 | Independent | 0 | -20 | -4 | No |

Four votes. One more is needed.

**Actions.**

1. **Meet Official** with seats 4, 5, 8 and 9: 4 × 5 PC = 20 PC, 8 hours of the dynasty head's time over a week. Opinion +10 each. Seat 9 moves to -2. Seats 4 and 5 move to -8.
2. **Campaign Donation** to seat 9, who faces re-election in 5 months. The ward has 211k adults, so E = $105k. Three adult dynasty members each give $20k (under the G1 Capped limit of $50k per donor): $60k = 57% of E, opinion +25 (cap). Seat 9's opinion is now -20 + 10 + 25 = +15, disposition +3.
3. **Request Decision** (rezoning): 10 PC.

**Vote: 5 to 4. Rezoning approved.** Total cost: 30 PC, $60k, about 10 hours. Exposure: 0 (all legal and disclosed).

**Why not bribe?** A bribe to seat 9 would cost `$50k × 4 × (110 - 25)/60 × (1 + 50/100) = $425k`, with acceptance only `25% + 2% = 27%` and a 50% chance a refusal is reported (+30 exposure and an instant Financial Police inquiry). In a liberal democracy the legal route is cheaper and safer.

**Making it permanent.** At the next local election the dynasty funds challengers in wards 4 and 5: $300k each against incumbents spending $100k. Campaign utility `0.8 × ln(1 + 300/105) = 1.08` against `0.8 × ln(1 + 100/105) = 0.53`, minus the incumbent's +0.3, a net +0.25 utility for the challenger: about +6 points of vote share in an evenly matched ward. Winning both gives a 7-seat friendly majority, and if hub influence later reaches 25% (Power Broker), the dynasty can push E11 to Developer-Led and skip council votes entirely.

### 4.13.2 Lobbying a national capital gains tax cut

**Situation.** A $3T liberal democracy with 50M adults. E3 is Moderate (20%). The dynasty wants Low (10%); it realizes about $400M of gains per year, so the cut saves $40M per year. The governing coalition is labor-green, so no government sponsorship. The dynasty's national share is 2%: 14 PC per month, cap 85. G2 is Light Disclosure (lobby cap +15 per holder).

**Base support** for Low (stance / 2 × clout):

| Group | Clout | Stance on E3 Low | Contribution |
|---|---|---|---|
| Financiers | 18% | ++ | +18 |
| Industrialists | 15% | + | +7.5 |
| Tech Sector | 10% | + | +5 |
| Landowners | 8% | + | +4 |
| Labor Unions | 16% | -- | -16 |
| Gig Workers | 5% | - | -2.5 |
| Environmentalists | 7% | - | -3.5 |
| State Apparatus | 4% (marginalized, half) | - | -1 |
| Traditionalists, Security, Transhumanists, Shadow Economy | 17% | 0 | 0 |
| **Total** | | | **+11.5** |

Threshold T = +10, so the bill would pass at `10% + 2% × 1.5 = 13%` per month: too slow.

**Plan.**

1. Save PC for 3 months, then **Commission a Bill** through a client legislator: 40 PC. Sponsor +5.
2. **Lobby Bill**: 30 LP for the full +15 cap. 10 LP from PC (the rest of the pool) and 20 LP from money. LP price = `$3T × 0.000001 = $3M`, so $60M.
3. **Issue Campaign** for 4 weeks before the first roll: `$0.10 × 50M = $5M` per week, $20M total, +3 support.
4. The Labor Unions counter-lobby with 20 LP: -10.

**Support** = 11.5 + 5 + 15 + 3 - 10 = **24.5**. Pass chance = `10% + 2% × 14.5 = 39%` per month. Liberal democracy debate rolls start in month 2. If the dynasty tops up lobbying each month to offset the 10% decay (about 3 LP, $9M per month), the chance over the first three rolls is `1 - 0.61³ = 77%`.

**Cost:** about $60M + $20M + $27M maintenance = $107M, paid back in under 3 years of tax savings. **Side effects**: lobbying is disclosed, so Labor, Gig and Environmentalist approval of the dynasty drops by 1, and any dynasty member running for office in labor-leaning wards takes the hit.

### 4.13.3 Running the heir for mayor

**Situation.** The heir (Influence 16, born in Manchester) runs for Mayor of Greater Manchester (United Kingdom, 2.2M adults, so E = $1.1M) for the business party (Industrialists, Financiers, Landowners, Traditionalists) against the incumbent of the labor-green party (Labor, Gig, Environmentalists, Tech Sector, Transhumanists), Influence 12. Unemployment 7%, inflation 4%, growth 1%.

**Utility terms that are the same for every segment:**

| Term | Heir | Incumbent |
|---|---|---|
| Incumbency | 0 | +0.30 |
| Economy | 0 | `-0.6 × 0.4 - 0.5 × 0.2 + 0.1 = -0.24` |
| Campaign | Spends $2.2M: `0.8 × ln 3 = 0.88` | Spends $1.1M: `0.8 × ln 2 = 0.55` |
| Media | Dynasty-owned local paper, 15% audience, endorses: +0.15 | 0 |
| Candidate | `0.03 × 6 + 0.2 (local origin) = 0.38` | `0.03 × 2 = 0.06` |
| **Sum** | **1.41** | **0.67** |

Plus a targeted ad campaign at Professionals (+0.3 for the heir in that segment).

**By segment** (ideology × 3 from the support base table):

| Segment | Share of adults | Turnout | Heir ideology | Incumbent ideology | Heir share |
|---|---|---|---|---|---|
| Elite | 1% | 80% | 1.95 | 0.69 | 88% |
| Professionals | 25% | 72% | 0.90 | 1.50 | 61% |
| Skilled | 22% | 60% | 1.05 | 1.50 | 57% |
| Unskilled | 22% | 50% | 1.05 | 1.20 | 64% |
| Gig | 15% | 42% | 0.45 | 2.25 | 26% |
| Unemployed | 15% | 35% | 0.90 | 1.20 | 61% |

**Result: heir 57%.** A generic business party candidate with equal spending would get about 35%: the heir's skill, origin, money and the family's newspaper are worth 22 points.

**The twist.** In week 14 the incumbent's allies run a Leak Scandal scheme: the heir's party footage (a minor scandal, -0.3). Recomputed: **50.0%**, a coin flip. The heir wins the debate and apologizes, halving the scandal to -0.15: **53.5%** on election night. Once elected: +10 points of hub influence, +20 PC per month, mayor's whip and appointment of the police chief. Cost: 30 hours per week of the heir's time, and conflict-of-interest exposure (+3 per month with the relevant agencies) on the family's Manchester real estate unless the heir uses a blind trust for personal holdings.

If playtests show money and media swinging races this much, the first values to lower are the Campaign coefficient (0.8) and the Media coefficient (1.0).

### 4.13.4 Antitrust review of a takeover

**Situation.** The dynasty's chip company holds 35% of its home country's chip market and launches a tender offer for a rival with 13%. Post-deal share: 48%. C3 is Standard (threshold 35%). The Antitrust Authority's head is Ambitious (Zeal 1.2). The dynasty has 6% national share: 24 PC per month.

**Phase 1 Concern** = `2 × (48 - 35) + 0 + 0 + 1.2 × 10 - PC / 2 = 38 - PC / 2`.

| Plan | Concern | Result |
|---|---|---|
| Spend 0 PC | 38 | Phase 2: Clear 22%, Remedies 30%, Block 48% |
| Spend 20 PC | 28 | **Cleared in Phase 1** (4 weeks) |
| Spend 10 PC and pre-sell a fab (share falls to 44%) | 25 | Cleared in Phase 1 |

The dynasty spends 20 PC. If the buyer had been foreign in a strategic sector (+10) from a country with negative relations (+15), Concern would have been 53 even after 20 PC: a 7% clean clearance and a 63% block. That is why cross-border chip deals run through branch offices or joint ventures.

### 4.13.5 A sanctions shock to a branch office

**Situation.** The dynasty's home is Country A (liberal democracy). Its branch office, a battery plant in Country B (one-party state, strategic sector), has a book value of $2B and $300M of profit per year. The local partner holds 51% (loyalty 70). After a naval incident, A and B's relation falls to -55, and A imposes **Tier 2 sectoral sanctions** (batteries and advanced components). The dynasty's national influence share in B is 0.8%.

**Monthly seizure risk** = `0.3 + 55/50 + 2 × 2 + 1 (strategic) - 10 × 0.008 - 0.5 = 5.8%`.

- Month 2: the roll succeeds. Ladder step 1, *Beijing Calls*: B wants a tech transfer of the plant's next battery generation. The dynasty negotiates (Influence 15 against the minister's 14: success), holding the ladder for 6 months.
- Month 5: A escalates to **Tier 3 financial sanctions**. The ladder jumps straight to **step 3, Restrictions**: dividends frozen (they are blocked from A anyway), two expatriate executives under exit bans, a Tax Authority inquiry opens in B. Seizure risk rises to 7.8% per month, and the next advance is **Seizure** (compensation 30%, in B's currency, under Hard Controls). Target-flagged ships carrying the plant's output are stopped at A-controlled straits; output must be sold inside B or to neutral countries.

**The choice event *The Wall Comes Down*:**

| Option | Outcome |
|---|---|
| Comply and exit | Sale to the local partner at 25%: $500M, written off $1.5B. Reputation +5 at home. Clean |
| Ring-fence | Stake written down 50%. $300M a year trapped in B. 7.8% monthly chance of losing everything for $600M of trapped compensation |
| Evade through a haven shell | Profits flow, but +25 exposure per month with A's Financial Police (capacity 3, zeal 1.0, corruption 20). Inquiry chance 22.5% in month 1, 45% in month 2, 60% in month 3: only a 17% chance of staying undetected for 3 months. Sanctions evasion is Grave: fines 2× the evaded amount, executive bans, possible prison |

The dynasty sells, then quietly asks a cadet house with a personal account in a neutral country to buy a minority of the local partner (Spin off logic, with evasion risk if hooks are used to keep control).

### 4.13.6 Backing a coup with PMCs

**Situation.** The dynasty owns a lithium mine in Country C, a small coastal managed democracy (MSI 8). A new government plans to nationalize lithium. Stability 40, Security Establishment approval -3 (SecurityLoyalty 35), ruling coalition clout 40%.

**Regime strength** = `0.4 × 40 + 0.3 × 35 + 0.3 × 40 = 38.5`.

**Building the plot:**

| Term | Detail | CS |
|---|---|---|
| Plotter military | 3 generals recruited (each `40% + 2% × (18 - 10) + 20/5 = 60%` per attempt; 5 attempts over 3 weeks) commanding 22% of the forces | 22 |
| PMC | 6 units ($30M per month) via S1 Licensed: `2 × 6 × 10/8 = 15` | 15 |
| Bribes | $48M at $8M per point (`$10M × 8/10`) | 6 |
| Popular | Traditionalists are Angry with 18% clout and back the plotters | 5 |
| **Total** | | **48** |

**Success chance per objective** = `50% + 1.5% × (48 - 38.5) = 64%`.

**Leaks.** Sound Out lasts 3 weeks at 10% per week; Assemble 4 weeks at `5% + 6% = 11%` per week. Chance of no leak at all: `0.9³ × 0.89⁴ = 46%`. A leak costs generals and raises RS by 10, which would cut the per-objective chance to 49%.

**Night of the Coup (no leak):** P(2 or 3 objectives) = `3 × 0.64² × 0.36 + 0.64³ = 70%` success. P(exactly 1) = 24%: since CS ≥ RS, a **civil war** stalemate. P(0) = 5%: failure.

**Costs**: about $90M of PMC fees for 3 months plus $48M bribes. **Payoffs on success**: the nationalization is cancelled by decree, a hook on the junta leader, 2 favors per general, first refusal on privatized state mines, +15 bid score for 3 years. **Risks**: liberal democracy sanctions (60% Tier 1 on C), and if the dynasty's exposure with its home country's Financial Police reaches 50, its own characters can be listed. On failure: everything in Country C is seized, the PMC units are lost and the dynasty gets the "Coup Plotter" notoriety for 10 years.

### 4.13.7 Insider tip and a securities investigation

**Situation.** A client minister uses a favor to give the dynasty one week's notice of a surprise rate cut. The family trust buys index futures and makes $40M. Exposure +20 with the Securities Regulator (liberal democracy, F4 Standard ×1.0, capacity 4 ×1.25, head Ambitious and Honest: Zeal 1.4, corruption 20).

**Detection** per month = `0.20 × 1.25 × 1.4 × 1.0 × (1 - 20/200) = 31.5%`. Exposure only starts decaying after 3 quiet months, so the 3-month detection chance is `1 - 0.685³ = 68%`. With **Request Protection** (25 PC, ×0.7) it is 22% per month, 53% over 3 months.

**If caught** (no protection): Evidence starts at `20/4 = 5`. Preliminary Inquiry: `+2 × 4 × 1.4 - 3 (General Counsel skill 15 / 5) = +8.2` per week; after 4 weeks Evidence 38, so a Subpoena (trust's holdings and the dynasty head named, "Under Investigation"). Discovery with tier 2 counsel ($5M × 4 per month): `+3 × 4 × 1.4 - 3 - 4 = +9.8` per week. The client minister (loyalty 45) has a `5% × 0.55 = 2.75%` weekly chance to flip (+20). After 8 weeks Evidence is well above 40: **charges**.

| Path | Outcome |
|---|---|
| Settle (cooperated) | Serious tier at 40%: disgorgement `1.5 × $40M × 0.4 = $24M` plus fine `1 × $40M × 0.4 = $16M`; dynasty head banned from boards in that country for 2 to 5 years; reputation -10 |
| Scapegoat the trust's portfolio manager | Penalty halved; the manager's opinion -60 and their family hostile; a new enemy who knows things |
| Trial | With Evidence 80 at trial and defense score `15 + 5 × 2 = 25`, conviction = `80 - 25 + 20 = 75%`; on conviction the full Serious penalty plus "Scandal-Ridden" |

The lesson: favors buy information, but trading on it is the most detectable thing a dynasty can do.

### 4.13.8 A currency crisis and a bank bailout

**Situation.** The dynasty's captive bank operates in Country D, a managed democracy with a peg to the dollar. Reserves cover 2 months of imports; stability 34; debt 75% of GDP, half in foreign currency (Limit 60). The bank holds $3B of D's government bonds and its assets are 2.5% of D's GDP (systemically important). A rival dynasty holds short positions against D's currency worth 10% of reserves.

**Currency crisis chance** = `5% × (3 - 2) × (1 + (50 - 34)/25) + 0.5 × 10% = 8.2% + 5% = 13.2%` per month.

In month 3 the peg breaks: the currency falls 45% over two weeks, the central bank raises the rate 12 points, stability drops 10 to 24 (Crisis band), and capital controls move to Restricted.

**Default chance that month** = `(75 - 60)/300 × (1 + (40 - 24)/20) + 10% = 9% + 10% = 19%`. D defaults. The bond restructuring imposes a 50% haircut: the captive bank loses $1.5B and is insolvent.

**Options:**

| Option | Detail |
|---|---|
| Recapitalize privately | The family trust injects $1.5B (in a currency now worth 45% less, and under capital controls it may never come out). Full control kept |
| Request a bailout | Weekly chance = `30% + 15% (systemic) + 10% (F7 Bailout with Stakes) + 10% (20 PC spent) - 20% (foreign owner) = 45%`; over 4 weekly decisions 91%. Terms (Equity): the state buys 60% of the enlarged bank at a 30% discount; golden share; 50% chance the CEO is replaced; the dynasty keeps 40% and loses control |
| Let it fail | C5 Reorganization: equity survives at 5 to 20%; depositors' unrest +5 in D's hubs; reputation -15 |

**The rival's side**: the dynasty that shorted the peg made roughly 45% on a position worth 10% of D's reserves, and is now the most hated name in D's press. A smart player would have hedged with FX forwards (07) the moment stability fell below 40.

---

## 4.14 Sample political events

| Event | Trigger | Options (short) |
|---|---|---|
| *The Fundraiser* | Election within 12 weeks, dynasty has influence ≥ 10% | Host (4 h, money raised, opinion) · Send a cheque · Decline |
| *A Quiet Word from the Minister* | Client minister with Loyalty ≥ 60 | Accept advance notice (+20 securities exposure if traded on) · Decline politely |
| *Subpoena* | Investigation reaches stage 2 | Cooperate · Lawyer up · Leak a counter-story |
| *The Client Flips* | Discovery, client loyalty < 50 | Pay them off · Threaten (Intrigue) · Let it happen |
| *Beijing Calls* | Seizure ladder step 1 | Comply · Negotiate · Refuse |
| *General Strike* | Revolution pressure 50 | Negotiate with unions · Hire replacement workers (unrest +10) · Close the facility |
| *The Colonel's Dinner* | Coup risk active, dynasty has PMCs or influence ≥ 5% in the country | Listen · Report to the government (Security approval +2, plotters hostile) · Leave early |
| *Night of the Long Phones* | A coup is under way | Commit reserves · Negotiate with a wavering general · Evacuate executives |
| *Recount* | Margin < 0.5% | Fund the legal challenge · Concede |
| *Party Congress* | One-party state, every 5 years | Back a faction · Stay neutral (safe, no gains) |
| *The Wall Comes Down* | Sanctions Tier 2+ on a country with a branch office | 4.11.4 options |
| *Peg Under Pressure* | Currency crisis chance ≥ 10% | Short the currency · Hedge · Lobby for IMF-style support (relation) |
| *Charter Referendum* | Corporate sovereignty step 4 | Campaign hard · Sweeten terms (Residents' Council) · Delay |
| *Reclamation Bill* | Hostile government with a corporate zone | Negotiate a higher revenue share · Fight in court · Prepare a standoff |
| *Tax Haven Leak* | F5 Secrecy or Haven country, dynasty with shells there, 1% per month | Deny · Restructure shells (lose 5% of their assets in fees) · Get ahead of it with a philanthropy campaign |

---

## 4.15 Assumptions

New assumptions made in this file, to confirm with Logan:

1. **Political Capital** is a separate spendable resource derived monthly from influence share (`100 × sqrt(share)`), pooled per dynasty per jurisdiction. Influence share itself stays as defined in 05 (rooted in assets, modified by origin, boosted by ads and psyops).
2. **Two interest groups added**: State Apparatus and Shadow Economy, so non-democracies and failed states have realistic power holders.
3. **A seventh law category, Governance** (campaign finance, lobbying rules, media ownership), added because these laws decide how much money can buy.
4. **Extra laws added** beyond 08's list: environmental regulation, regional taxes, property tax, zoning, special economic zones, trusts and foundations, bailout policy, immigration.
5. **Ruling family states** (for example Gulf monarchies) are modeled as a variant of the one-party state, not a separate type.
6. **No country starts as a corporate oligarchy**; the type exists only as an outcome of play.
7. **Starting country classifications and values** are a game abstraction at the start date, editable in data, and loosely inspired by public governance indices.
8. **Two new agencies**: Banking Supervisor and Data and Cyberware Authority, in addition to the five in 08.
9. **Law changes move at most two steps per bill**, and a changed law locks for 12 months (6 in non-democracies).
10. **Decisions vs laws**: individual permits, rezonings, contracts and reviews are decisions by named bodies using a disposition formula; standing laws use the clout-weighted support formula.
11. **Seizure is a ladder**, never instant, except when war, Tier 3+ sanctions or a failed coup skip steps.
12. **Bribes of officials are possible in every government type**, but liberal democracies make them expensive, rarely accepted and often reported.
13. **Elections use a segment-level softmax** of utilities; money enters with a logarithm so doubling spending has diminishing returns.
14. **Money values** are in dollar equivalents scaled by GDP (political market size, LP price) or by a wealth index (bribes, legal fees), so the same rules work for a $50B city and a $28T country.
15. **Corporate sovereignty Stage 3** needs a corporate oligarchy, a failed state, or a treaty; liberal democracies can host Stage 2 charter cities at most without a treaty.
16. **Prison** keeps a character in play with very limited actions rather than removing them entirely.
