# 4. Politics: detailed design

_Status: draft v0.5 (2026-10-19). Batch 121 (Logan, 2026-10-19): only national governments in the POC. There are no state, regional or city governments, councils, mayors, governors, regional laws, licences or bonds, and no regional or local elections; regions, areas, cities and Metros stay as map groupings. Rezonings, permits and policing contracts are decisions of national ministers (4.3); PC is earned per country, plus a little local standing PC from tiers (4.1.2); City Councilor, Mayor, Regional Legislator and Governor are gone; 4.13.1 is now a ministry rezoning and 4.13.3 a national legislature seat. Batch 119: Phoenix became a Metro (any city of 5M or more is one), so the 4.13.1 council example moves to Austin. Batch 118: EU4-style map. The local level of government sits on the **city** (a Metro or a single province ranked City or Metropolis); towns and rural provinces are governed locally by their region. District-level rules (OCG Control, security, policing contracts, rezoning) become province-level; crime, protests and local stability are per province; council sizes follow city rank; the 4.2.4 column lists former hubs and every other country is a real country in [countries.csv](../data/countries.csv). Batch 117: Heat is how cancelled a character is, with decay by scandal type (4.17.4); the T2 Data Sovereignty position and captive banks are removed. Batch 116: no dynasties, family, heirs, cadet houses, marriage, legacies or renown (the player acts through their own character, companies, trusts and clients; Partition and family trusts gone); Clout (elite) and Fame and Favor (public) replace reputation, Favorability, Elite Standing and Profile (4.16); Persuasion replaces the Influence skill; intel learns secrets; branch offices dropped (seizure ladder works on a foreign holder's operations, C2 is Local partner and directors); Semiconductors replaces the four chip industries; Colombia and DR Congo added to 4.2.4, start-world facts matched to 19.22 and example hubs to the 80 hubs; tech levels, plots, brand appeal, crypto mixing, the AI aggression setting, AI ambitions and merger clearance removed; opinion formulas written as tag reads; nonexistent traits replaced. v0.4: consistency pass, batch 74: interest groups, stages, cyberware, PMCs, antitrust, netruns, goods, facilities and supply chains removed, opinion effects written as pushes, and hour costs written as instant actions or ticks (no daily hours budget), so the file matches the current rules. v0.3 (batch 37): the nine ideologies as political actors, votes by strata, tariffs on industry indices, politics by company rank (4.0, 4.4, 4.28). Earlier: v0.2 (2026-10-16). v0.2 adds the political experience and screens, public standing (favorability, elite standing, profile), media and scandals as news cycles, the dynasty as a political actor (careers, think tanks, foundations, parties), lobbyists and fixers, corruption end to end (dirty money, laundering, deniability, whistleblowers), courts and litigation, police and organized crime, private security, civil society and protests, international organizations, espionage, AI governments and AI dynasties, politics by company rank, political endgames, new events and worked examples (4.15 to 4.31); Assumptions move to 4.32. Replaces the retired politics overview (08); the influence rules it reads are in [2-map-and-influence.md](2-map-and-influence.md) 2.5. Owner: Logan. Batch 120: influence tier thresholds drop by level (country Kingmaker at 20%), so the Oligarch weight example is updated._

The player never rules a country. The player **buys, earns and borrows power over those who do**, through their own character, the companies they control, their personal trusts and their clients. This file turns the politics overview into exact rules, formulas, numbers and content.

**How to read the numbers.** Every number marked **(T)** is a starting tuning value, expected to change in playtesting. Formulas are written so each term can be shown in a tooltip breakdown (see [11-ui.md](../11-ui.md)). Money is in US dollar equivalents at game start; each country converts to its own currency at the live exchange rate.

**Decided rule kept intact.** Influence is rooted mainly in the assets a holder owns in an area, modified by birthplace and origin, and temporarily boosted by psyops and ad campaigns (see [2-map-and-influence.md](2-map-and-influence.md) 2.5). Everything political in this file is fed by that influence. Money can buy political effects directly, but how far money goes depends on the government type, and money spent without influence behind it is less effective and riskier.

---

## 4.0 Political actors and the economy

Politics reads the Wall Street Raider style economy ([10-industry-economy.md](10-industry-economy.md)) and the strata (2.8.0):

| Topic | Rule |
|---|---|
| Political actors | The **nine ideology blocs** ([5-ideology.md](5-ideology.md)) are the groups that hold clout, take stances on laws, join parties, get funded and get angry. Each bloc has a **bloc leader** (5.6.2) and a **bloc approval** (4.4.6). |
| Votes | **Votes are counted by strata** (2.8.0). |
| Tariffs and sanctions | They hit an **industry's price index** in the country (10-industry-economy). |
| Company rank | What politics offers grows with the **rank of the player's largest company** (1.7.5, 4.28). |

Money given to a bloc goes through the **Fund Ideology** action (4.10.1): think tanks, movements, media and parties of one ideology.

**Industries and lobbying.** Unions, chambers of commerce and trade lobbies exist as **organizations** that a company can fund, but their money is counted for the ideology they serve. Each industry has a default lean that its trade lobby funds unless the company head picks another (Logan, batch 38):

| Industries | Default lean |
|---|---|
| AI labs, Cloud, Data centers, Semiconductors, Software, SaaS | Accelerationists |
| Pharma, Healthcare services (longevity) | Transhumanists |
| Banking, Asset management, Insurance | Liberals |
| Oil, Gas, Mining, Metals, Chemicals, Power utilities, Autos, EVs, Construction, Real estate, Agriculture | Landites |
| Defense, Aerospace, Drones, Robotics | Chuds |
| Retail, E-commerce, Fast food, Luxury, Consumer electronics, Telecom, Shipping, Logistics, Airlines, Professional services | Liberals |
| Gaming, Gambling, Social media, Ads, Black market | Sovereigntists |
| Healthcare services, Renewables | Effective Altruists |

**Tariffs on industries.** A tariff of rate t on an industry raises that industry's price index in the importing country by `t × import share` **(T)**, where import share is the part of the country's use of that industry supplied from abroad. Domestic companies in that industry gain margin, and foreign ones lose sales there. Sanctions tiers (4.11) list **industries**: Tier 2 Sectoral bans trade in the listed industries (for example Semiconductors), which raises their index in the target country and cuts exporters' revenue there.

---

## 4.1 Core concepts, units and cadence

### 4.1.1 Key terms

| Term | Range | Scope | Meaning |
|---|---|---|---|
| **Influence share** | 0 to 100% | Per holder per place | Your share of the weighted asset value in a place (province, city, area, region, country), plus origin and office modifiers and temporary boosts. Defined in [2-map-and-influence.md](2-map-and-influence.md) 2.5. |
| **Political Capital (PC)** | 0 to pool cap | Per holder per country (the player character, rolled up with what they control) | The spendable form of influence. Earned monthly from influence share. Spent on lobbying, permits, protection, appointments. |
| **Bloc clout** | 0 to 100% (sums to 100% per jurisdiction) | Per ideology bloc per jurisdiction | How much a bloc decides which laws pass. Not the character stat **Clout** (elite reputation, 4.16): this file writes the bloc measure as "clout" or "bloc clout" and the character stat as Clout **(A)**. |
| **Support** | -100 to +100 | Per law proposal | Net weight behind a proposed law position. |
| **Stance** | -2 to +2 | Per ideology bloc per law position | How much a bloc wants (+) or opposes (-) a position. |
| **Approval** | -10 to +10 | Per ideology bloc per jurisdiction | How happy a bloc is with current laws and government. |
| **Exposure** | 0 to 100+ | Per holder per agency domain | How much evidence of wrongdoing exists for regulators and journalists to find. |
| **Stability** | 0 to 100 | Per country (and per province for local unrest) | How well the political order holds. Low stability causes defaults, currency crises, coups and revolutions. |
| **Regime Strength (RS)** | 0 to 100 | Per country | How hard the current government is to remove by force. |
| **Relation** | -100 to +100 | Per country pair | Diplomatic temperature between two countries. |
| **favors** | Whole tokens | Per patron per client politician | A specific debt a politician owes you. Spent for concrete actions. Not the Image score **Favor** (4.16), which this file always writes with a capital. |

### 4.1.2 Political Capital

Influence share is a stock (how strong you are). Political Capital is a flow (what you can do this month).

- **Monthly PC gain** in a country = `100 × sqrt(national influence share) × Influence Effectiveness(government type) + local standing PC + office PC` **(T)**.
  - Influence share is a fraction (0.25 for 25%).
  - The square root keeps small players relevant in big countries: 1% share gives 10 PC per month, 10% gives 32, 25% gives 50, 50% gives 71.
- **Pool cap** = 6 × monthly gain, minimum 20 **(T)**. PC above the cap is lost.
- PC is held by the **player character** per jurisdiction. Influence of the character, their personal trusts and the companies they really control (1.3.1) rolls up into one share per place. Other holders (AI rivals, AI companies) have their own pools.
- The only jurisdiction is the **country** (Logan, batch 121): there are no state, regional or city governments in the POC (4.3), so PC is earned and held per country. The national share is the rolled-up share of [2-map-and-influence.md](2-map-and-influence.md) 2.5.5.
- **Local standing PC** **(A)**: influence tiers still exist in every province, city, area and region (2.5.9), but those places have no PC pool. Instead each place in the country where the holder holds a tier adds to the country pool: Presence +2, Power broker +4, Kingmaker +8 PC per month **(T)**. A single-province city counts once. This keeps a holder who is strong in one city but small nationally able to request decisions about that city.
- **Office PC**: a character holding office adds PC in that jurisdiction (see 4.7.1). There is no legacy PC (batch 116: no dynasty legacies).

### 4.1.3 Cadence

1 turn = 1 tick (one hour). There is no daily hours budget: most political actions are instant, and only in-person meetings, events, hearings and travel burn ticks (1-corporate-core 1.1.6). Politics runs mostly on weekly, monthly and yearly boundaries.

| Interval | Political calculations |
|---|---|
| **Hourly** | Player actions (meetings, calls, bribes offered, speeches), hearings in session, election night counting (results arrive region by region over 6 to 12 turns), coup night resolution (6 to 24 turns) |
| **Daily** | News cycle: scandals spread and Heat shares fade (4.17.4), exposés published, poll noise, protest size |
| **Weekly** | Polls, campaign events, lobbying actions resolve, investigation steps, coup plot progress and leak rolls, temporary boost decay (ads and psyops), bloc approval, trade war and sanctions escalation checks, seizure ladder steps |
| **Monthly** | PC income, clout recalculation, law progress rolls, exposure detection rolls, stability, relation drift, revolution pressure, coup risk, default and currency crisis risk, foreign asset seizure risk (4.9.10) |
| **Quarterly** | Government contract tenders open, regulator capacity review, credit and political risk ratings |
| **Yearly** | Scheduled elections fire on their date, party plenums, budgets, agency head term reviews, government type review (drift from stability and bloc pressure) |

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
| **Failed state** | No effective center; local strongmen and militias (characters and OCGs, not governments, 4.3.4) hold provinces; national government exists on paper | 85 (70 to 95) | 1.6 | 0.8 | 20 | -10% | National laws barely enforced | 0.0 | 0.5 |

All values **(T)**.

- **Money effectiveness** multiplies every money-to-politics conversion: clout from funding, lobby points bought with money, campaign spending, bribes.
- **Influence effectiveness** multiplies PC gain (4.1.2).
- **Foreigner influence penalty** applies to the influence share of holders whose character (by citizenship) and company headquarters are foreign (stacks with nationalist law positions such as Foreign Ownership: Capped or Closed, which add a further -10% each step past Screened **(T)**).
- **Judicial independence** (0 to 1): chance that a trial follows the evidence instead of the executive's wishes, and that courts strike down unlawful seizures.
- **Media freedom** (0 to 1): multiplies the chance that an exposé gets published and spreads; low freedom means scandals about the regime's friends stay buried, but scandals about its enemies are amplified.

### 4.2.2 What money and influence buy, by type

| Type | Cheap | Expensive or impossible | Typical player play |
|---|---|---|---|
| **Liberal democracy** | Legal lobbying, campaign donations, think tanks, media ownership | Bribes (low acceptance, high detection), direct control of regulators, decrees | Fund groups and campaigns, own media, run for office or back candidates, use lawyers |
| **Managed democracy** | Access to the ruling circle, contracts, protection from investigations | Supporting the opposition (risk of targeted investigations and seizures) | Become a loyal court oligarch; pay for contracts; avoid backing the losing side |
| **One-party state** | Permits and partnerships through party patrons in the ministries | Buying national policy with money; owning media; open lobbying | Local subsidiaries with local partners, cultivate party faction patrons, accept transfers of plans and data |
| **Corporate oligarchy** | Almost everything: votes on the Council are weighted by influence share | Nothing is off limits, but rivals can outbid you | Accumulate assets to win Council seats; laws are a market |
| **Military junta** | Security contracts, mining concessions | Stable long-term rules: the next coup can void your deals | Short horizons, quick returns, cultivate the generals, keep an exit plan |
| **Failed state** | Local strongmen, ports, militia protection | National guarantees of any kind | Resource extraction under armed protection, high risk; candidate for corporate sovereignty |

### 4.2.3 Corruption

Corruption (0 to 100) is a country value with a type default. It can differ by region and city as map data (local corruption = national ± up to 20 **(T)**); regions and cities have no government of their own (batch 121).

| Effect | Formula **(T)** |
|---|---|
| Bribe acceptance base chance | `Corruption%`, then modified by the official's traits (4.10.4) |
| Bribe cost multiplier | `(110 - Corruption) / 60` (Corruption 20 → 1.5×, 50 → 1.0×, 85 → 0.42×) |
| Detection of bribery and kickbacks by regulators | multiplied by `1 - Corruption / 200` |
| Kickbacks expected on government contracts | `Corruption / 10` % of contract value (2% at 20, 8.5% at 85) for a neutral bid score; paying less loses bid score (4.9.7) |
| Enforcement of national law in a province | `100% - max(0, Local corruption - 50)%` (Failed state at 85 enforces 65%; combined with type, see 4.3.3) |

Corruption drifts monthly by ±1 toward a target set by laws (Lobbying Rules, Campaign Finance, Media Ownership), judicial independence, and the clout of the Sovereigntists **(T)**.

### 4.2.4 Starting countries

The starting classification is a game abstraction, a snapshot at the start date (1 January 2020, matched to the alternate history in [19-history.md](19-history.md) 19.22), stored as editable data. It is not a judgment of any country, and in play every country can move between types. Corruption and stability values are loosely inspired by public governance indicators and are tuning values.

| Country | Type | Corruption | Stability | Structure | National election cycle (legislature / executive) | Former hubs (starting cities) |
|---|---|---|---|---|---|---|
| United States | Liberal democracy | 25 | 62 | Federal | 2 / 4 years | New York, Bay Area, Washington DC, Houston, Chicago and 10 more |
| Canada | Liberal democracy | 15 | 75 | Federal | 4 (parliamentary) | Toronto, Montreal, Vancouver, Ottawa, Edmonton |
| Mexico | Liberal democracy | 65 | 52 | Federal | 3 / 6 years | Mexico City, Monterrey, Guadalajara |
| United Kingdom | Liberal democracy | 20 | 62 | Unitary (devolved) | 5 (parliamentary) | London |
| Ireland | Liberal democracy | 15 | 74 | Unitary | 5 (parliamentary) | None |
| Germany | Liberal democracy | 15 | 66 | Federal | 4 (parliamentary) | Frankfurt, Munich, Berlin |
| France | Liberal democracy | 25 | 56 | Unitary | 5 / 5 years | Paris |
| Netherlands | Liberal democracy | 12 | 70 | Unitary | 4 (parliamentary) | Amsterdam, Rotterdam, Eindhoven |
| Switzerland | Liberal democracy | 10 | 85 | Federal | 4 (collegial executive) | Zurich |
| Sweden, Norway, Denmark, Finland | Liberal democracy | 8 to 12 | 76 to 82 | Unitary | 4 (parliamentary) | None |
| Italy | Liberal democracy | 40 | 52 | Unitary | 5 (parliamentary) | Milan, Rome |
| Spain | Liberal democracy | 35 | 54 | Unitary (strong regions) | 4 (parliamentary) | None |
| Greece | Liberal democracy | 45 | 35 | Unitary | 4 (parliamentary) | None (defaulted at start, 19.22) |
| Poland | Liberal democracy | 35 | 64 | Unitary | 4 / 5 years | None |
| Ukraine | Liberal democracy (at war) | 60 | 35 | Unitary | 5 / 5 years | None (drone war under Zelensky, 19.22) |
| Japan | Liberal democracy | 20 | 78 | Unitary | 4 (parliamentary) | Tokyo-Yokohama, Osaka-Kobe |
| South Korea | Liberal democracy | 30 | 64 | Unitary | 4 / 5 years | Seoul-Pyeongtaek |
| Taiwan | Liberal democracy | 25 | 62 | Unitary | 4 / 4 years | Hsinchu-Taipei, Kaohsiung |
| Australia | Liberal democracy | 15 | 74 | Federal | 3 (parliamentary) | Sydney, Melbourne, Perth-Pilbara |
| Israel | Liberal democracy | 30 | 50 | Unitary | 4 (parliamentary) | Tel Aviv |
| India | Liberal democracy | 55 | 58 | Federal | 5 (parliamentary) | Mumbai, Delhi NCR, Bengaluru, Hyderabad, Chennai |
| Indonesia | Liberal democracy | 60 | 60 | Unitary | 5 / 5 years | Jakarta |
| Malaysia | Liberal democracy | 45 | 60 | Federal | 5 (parliamentary) | Kuala Lumpur, Penang |
| Philippines | Liberal democracy | 65 | 52 | Unitary | 3 / 6 years | None |
| Brazil | Liberal democracy | 55 | 55 | Federal | 4 / 4 years | São Paulo, Rio de Janeiro |
| Argentina | Liberal democracy | 60 | 45 | Federal | 2 / 4 years | Buenos Aires |
| Chile | Liberal democracy | 30 | 55 | Unitary | 4 / 4 years | Santiago, Antofagasta |
| Colombia | Liberal democracy | 60 | 52 | Unitary | 4 / 4 years | Medellín **(A)** |
| South Africa | Liberal democracy | 55 | 48 | Unitary (provinces) | 5 (parliamentary) | Johannesburg, Cape Town |
| Nigeria | Liberal democracy | 75 | 38 | Federal | 4 / 4 years | Lagos |
| Singapore | Managed democracy | 10 | 82 | City-state | 5 (parliamentary) | Singapore |
| Turkey | Managed democracy | 55 | 50 | Unitary | 5 / 5 years | Istanbul |
| Russia | Managed democracy | 70 | 52 | Federal | 5 / 6 years | Moscow, St Petersburg |
| Kazakhstan | Managed democracy | 65 | 58 | Unitary | 5 / 7 years | None |
| Egypt | Managed democracy (US friend) | 65 | 52 | Unitary | 5 / 6 years | Cairo-Suez |
| Iraq | Managed democracy (US ally) | 60 | 55 | Federal | 4 (parliamentary) | None |
| Yemen | Managed democracy (US-backed) | 80 | 35 | Unitary | 7 / 7 years | None **(A)** |
| Iran | Managed democracy (the region's holdout) | 70 | 40 | Unitary | 4 / 4 years | None |
| Thailand | Managed democracy (army-led) | 55 | 50 | Unitary | 4 (parliamentary) | None |
| Myanmar | Managed democracy (army-guided) | 75 | 35 | Unitary | 5 (parliamentary) | None |
| Venezuela | Managed democracy | 80 | 30 | Federal | 5 / 6 years | None |
| DR Congo | Managed democracy | 80 | 25 | Unitary (provinces) | 5 / 5 years | Kolwezi-Lubumbashi (Katanga) **(A)** |
| Mali | Managed democracy (US debt vassal, 4.11.8) | 70 | 35 | Unitary | 5 / 5 years | None |
| Burkina Faso, Niger | Managed democracy | 70 to 75 | 30 to 35 | Unitary | 5 / 5 years | None |
| Sudan | Managed democracy (US-friendly transition after Bashir) | 80 | 30 | Federal | Transition council, elections due | None |
| China | One-party state | 45 | 70 | Unitary | Party congress every 5 years | Shanghai, Shenzhen-Dongguan, Beijing, Hong Kong, Chengdu, Wuhan, Baotou |
| Vietnam | One-party state | 55 | 68 | Unitary | Party congress every 5 years | Ho Chi Minh City, Hanoi |
| Cuba | One-party state | 50 | 45 | Unitary | Party congress every 5 years | None |
| North Korea | One-party state (isolated) | 80 | 55 | Unitary | Closed: no foreign assets allowed at start | None |
| Saudi Arabia | One-party state (ruling family) | 45 | 66 | Unitary | Family council | Riyadh, Dhahran-Dammam |
| United Arab Emirates | One-party state (ruling family) | 30 | 76 | Federal | Family council | Dubai, Abu Dhabi |
| Qatar | One-party state (ruling family) | 35 | 78 | Unitary | Family council | Doha |
| Libya | One-party state (US friend) | 70 | 55 | Unitary | Leader's congress | None **(A)** |
| Somalia | Failed state | 90 | 12 | Federal (nominal) | Nominal | None |
| South Sudan | Failed state | 90 | 8 | Federal (nominal) | Nominal | None |
| Haiti | Failed state | 85 | 10 | Unitary | Nominal | None |

Start-world notes (batch 116): there was no Arab Spring, so every Middle East and North Africa government is a US puppet or friend except Iran; there were no 2021 to 2023 coups, so Myanmar, Burkina Faso and Niger are not juntas; Mali is a US debt vassal; Sudan is in a US-friendly transition after Bashir. European stability values are lowered for the euro crisis, and Greece's for its default **(T)**. The last column lists only the 80 former hubs of [2-map-and-influence.md](2-map-and-influence.md) 2.3.3 (now Metros or city provinces); "None" means none of them, but every country has its own cities in the province list. All 33 major countries are listed; minor groups are gone (batch 118), and every other country is a real country whose government type, corruption and stability come from its row in [countries.csv](../data/countries.csv) (government type copied from here or assumed from the 19.22 start world) **(A)**.

The **Structure** column (federal, unitary, devolved) is flavour and post-POC data only: in the POC every country has one national government and no regional or city governments (Logan, batch 121) **(A)**.

No country starts as a **corporate oligarchy**. It is something powerful characters create, through capture of a weak state, a revolution's aftermath or a failed state's collapse (4.2.5).

### 4.2.5 Changing government type

Type changes happen only through these transitions. Each is an event chain.

| From | To | Trigger | Chain |
|---|---|---|---|
| Liberal democracy | Managed democracy | Emergency Powers at Standing Emergency for 12+ months, or an executive with Media Ownership: State-Controlled, or Stability < 35 for 6 months | *Erosion*: Postponed Election → Court Packing → Media Takeover. Each step can be resisted by blocs with clout ≥ 30% combined |
| Liberal or managed democracy | Military junta | Successful coup (4.8.4) | Coup chain |
| Managed democracy | Liberal democracy | Revolution led by Liberals, Communists, Effective Altruists or Neo-Luddites; or a "reformer" executive plus Stability ≥ 55 for 24 months | *Opening*: Free Election → Truth Commission → Purge of the Old Guard |
| Managed democracy | One-party state | Ruling party wins 3 consecutive elections with > 70% and passes Ban on Opposition (requires the party's core ideology at clout ≥ 25%) | *Consolidation* |
| One-party state | Managed democracy | Party struggle won by a Reformist faction plus Stability < 45 | *Thaw* |
| Military junta | Managed democracy | 24+ months in power and Stability ≥ 40, junta leader Content (AI characters have no ambitions, only traits), or foreign pressure (3+ sanctions tiers lifted on condition) | *Transition Election* |
| Any | Failed state | Stability < 10 for 3 months, or lost major war, or revolution with no winning coalition after 3 months | *Collapse* |
| Failed state | Military junta or Managed democracy | A faction controls provinces with ≥ 60% of population | *Reunification* |
| Failed state, Military junta or Managed democracy | Corporate oligarchy | One or more characters (or AI megacorps) together hold ≥ 40% national influence share and Chuds approval ≥ 0, and a capture chain is started by a holder with ≥ 15% national share | *Capture*: Debt-for-Equity Deal → Council of Stakeholders → Charter of Governance |
| Corporate oligarchy | Any | Revolution, coup, or foreign intervention event | Standard chains |

---

## 4.3 One level of government: national

### 4.3.1 Only national governments (Logan, batch 121)

Only national governments exist in the POC. A country's national government sets the laws for the whole country. There are **no state, regional or city governments**: no regional legislatures or governors, no city councils or mayors, no regional or local laws, licences or bonds, and no regional or city elections. Regions, areas, cities and Metros stay as **map groupings** for influence, real estate, development, business asset spread and the property cycle ([2-map-and-influence.md](2-map-and-influence.md)); they just have no government of their own. Sub-national governments may come back after the POC **(A)**.

What the old lower levels did now sits with the national government, or is gone:

| Power | National government (the only level) |
|---|---|
| Taxes | Income, corporate, capital gains, inheritance, tariffs and property tax (E10). Regional surcharges (old E9) are removed |
| Money | Currency, central bank, capital controls, exchange regime, national bonds. Regional and city bonds are removed |
| Corporate | Foreign ownership, local partner and director rules (C2), governance, bankruptcy, special economic zones; business licences |
| Labor | Minimum wage, union rights, automation tax, gig status, immigration: one national position each |
| Land and building | Environmental rules and zoning (E11) are national laws. Rezoning a province's Land pool share (2.16) and building permits are decisions of the **Minister of Land and Housing** |
| Security | Military, emergency powers, surveillance, and one **national police** force (4.22.1). A private policing contract for a province (S2 Privatized) and a crackdown request are decisions of the **Interior Minister** |
| Contracts | All government contracts, including services in a named city (4.9.7) |
| Regulators | The six national agencies (4.9.1) |
| Appointments | Ministers, regulator heads, the central bank governor, ambassadors, the national police chief |
| Diplomacy | All international relations |

The Minister of Land and Housing and the Interior Minister are ordinary ministers (4.7.1) in every country's cabinet data **(A)**. This is the simplest choice: each old city power goes to one existing kind of national office instead of a new office. Other old local powers (opening hours, local hiring rules on city contracts, sister-city deals) are removed.

### 4.3.2 Federal and unitary countries

The federal, unitary and devolved flags in 4.2.4 have no rules in the POC: every country is governed as one unit **(A)**. **City-states** (Singapore, and any Stage 3 corporate zone) are simply countries made of one city.

### 4.3.3 Laws are national

Every law in 4.5 is a national law with one position for the whole country. The old level rules (stacked rates, floors, ceilings, enabling laws, preemption and local experimentation) are removed. The one exception is a special economic zone (C6): the national government designates the zone's provinces (a Decision), and a Charter Zone may set its own positions on the laws C6 lists (4.12).

1. **Grace period**: when a national change makes a zone position illegal (for example the L1 floor rises above a Charter Zone's wage), the zone gets a 3-month grace period **(T)**, then snaps to the nearest legal position.
2. **Enforcement**: national law is enforced in a province at `Enforcement%` = type factor × corruption factor (4.2.3), using that province's local corruption. Type factor: LD 100%, MD 100%, OP 100%, CO 90%, MJ 85%, FS 30% **(T)**. Below 70% enforcement, holders can ignore a national law there at an exposure cost of +2 per month per law ignored **(T)**.

### 4.3.4 Failed states, juntas and local strongmen

There is no lower-level government under any type. In a **failed state**, local strongmen, militias and clan leaders hold provinces as characters and OCGs (4.22.2), not as governments: their power is OCG Control and Strength, and national law reaches their provinces only at the failed-state enforcement rate (4.3.3). Under a **military junta** or **Martial Law** (S3), the national military runs every province directly.

### 4.3.5 Laws and decisions

Politics produces two kinds of outcome:

- **Laws**: standing national positions in a law category (4.5). Passed through the support formula (4.5.10).
- **Decisions**: case-by-case rulings on one holder's request: a permit, a rezoning, a policing contract, a crackdown, a contract award, a foreign investment review, a licence. Decisions are taken by a **named national official** (the responsible minister or agency head, 4.7.1) and are where personal relationships, favors and bribes matter most. In a corporate oligarchy the Council of Stakeholders may take any decision to a weighted vote (4.5.10).

The deciding official says yes if:

`Disposition = 10 × stance of the official's party on the issue + Tie + 15 × favors called in on that official + bribe effect + 10 if the head of government backs it ≥ 0` **(T)**

**Tie** is a read of the opinion tag (1.1.4), not a number the official stores: +10 if the official is the requester's Friend, 0 if Neutral, -10 if Rival, -20 if Nemesis **(T)**. Every "tie" term in this file uses these values. City influence tiers can add to disposition on decisions about that city (2.5.10).

---

## 4.4 Strata and ideology blocs

### 4.4.1 Strata as voters

Votes and political money are counted by **stratum** (2.8.0). Each stratum has a **wealth weight** (how much its money and connections count) and a **turnout** (how much its votes count) **(T)**.

| Stratum | Wealth weight per person **(T)** | Base turnout **(T)** |
|---|---|---|
| Permanent Underclass | 0.6 | 40% (60% when slop runs short) |
| PMC | 3 | 65% |
| Glitterati | 30 | 70% |
| Nobles | 60 | 85% |
| Oligarchs | Named characters only: each Oligarch's weight grows with their **influence** in the jurisdiction (Logan, batch 38): wealth weight = 50 × their influence share (%) there, so a holder at 50% counts 2,500 and a national Kingmaker at the country threshold of 20% counts 1,000 **(T)** ([2-map-and-influence.md](2-map-and-influence.md) 2.5) | 100% (one vote each) |

Population segments (2.8.1) are the economy's make-up of each stratum; politics reads only the stratum.

### 4.4.2 Ideology blocs and support base

The nine ideology blocs (5.2) are the political actors. A stratum's support for a bloc, `Aff(s,i)`, is the share of that stratum that believes in ideology i (5.4), adjusted by country and city modifiers (5.4.2) and drift (5.5). Starting mix for a high-income country **(T)**, derived from the segment mixes in 5.4.1:

| Stratum | LB | CO | AC | EA | TH | NL | SV | LA | CH |
|---|---|---|---|---|---|---|---|---|---|
| Permanent Underclass | 21 | 25 | 2 | 1 | 5 | 13 | 2 | 2 | 29 |
| PMC | 35 | 12 | 6 | 6 | 6 | 9 | 3 | 2 | 21 |
| Glitterati | 32 | 3 | 18 | 8 | 12 | 1 | 8 | 5 | 13 |
| Nobles | 28 | 1 | 10 | 6 | 3 | 2 | 12 | 16 | 22 |
| Oligarchs | Each Oligarch's own ideology (5.8) | | | | | | | | |

There is no fixed class table any more: what a stratum wants is what it believes.

### 4.4.3 Preferred law positions

Stance values: **++** = +2, **+** = +1, **-** = -1, **--** = -2. Unlisted positions are 0 for that bloc. For a bloc, stances on neighbouring positions fall off by 1 per step from its favorite.

Each bloc's stances are its ideology's wants and opposes in 5.3 (5.3.1 to 5.3.9), capped at ±2 (5.6.2). The bloc leader does not change them; a leader who is the player's Friend or is hooked can be called on in deals (5.6.2).

### 4.4.4 Bloc clout formula

Recalculated monthly per jurisdiction.

1. **Base support** (s is a stratum and g an ideology bloc) mixes money power and vote power by the government type's **democratic weight D**:

   `Base_g = (1 - D) × W_g + D × V_g`

   - `W_g` = share of all wealth-weighted support: `Σ_s Pop_s × WealthWeight_s × Aff(s,g)`, divided by the total over all groups.
   - `V_g` = share of all vote-weighted support: `Σ_s Pop_s × Turnout_s × Aff(s,g)`, divided by the total.
   - D **(T)**: Liberal democracy 0.5, Managed democracy 0.3, One-party 0.1, Corporate oligarchy 0.05, Military junta 0.1, Failed state 0.2.

2. **Raw clout**:

   `Raw_g = Base_g × (1 + MediaBias_g) + Money_g + Office_g`

3. **Bloc clout**: `Clout_g = Raw_g / Σ Raw` (as a percentage).

- **Marginalized**: clout < 5%. Its stances count half in law support.
- **Powerful**: clout ≥ 20%. Can block laws it opposes at -- (see 4.5.10) and its approval moves stability twice as much.

**Office term** **(T)**:

| Situation | Office_g |
|---|---|
| Bloc in the governing coalition (democracies) | +0.05 |
| Bloc leading the governing coalition | +0.08 |
| The ruling ideology in a one-party state | +0.15 |
| Chuds in a military junta (or the junta leader's ideology) | +0.20 |
| In a corporate oligarchy: Landites, Accelerationists and Liberals | +0.08 each |

### 4.4.5 How money and media shift clout

**Money.**

`Money_g = MoneyEff × 0.20 × sqrt(F_g / M)`, capped at +0.30 **(T)**

- `F_g` = donations and funding to group g over the trailing 12 months. Each month the counted total decays 8% **(T)**, so money must keep flowing.
- `M` = the jurisdiction's **political market size** = 0.05% of its yearly GDP **(T)**. For a $28T economy M = $14B; for a $1T economy, M = $500M; for a $50B economy, M = $25M.
- Square root: the first dollars count most. Funding of M/10 gives +0.063 × MoneyEff; funding of M gives +0.20 × MoneyEff.
- Money flows into blocs through the **Fund Ideology** action (4.10.1): think tanks, foundations, unions' strike funds, church charities, veterans' associations, militias (Sovereigntists and Chuds in failed states).
- Under Campaign Finance: Public Funding Only, money to groups counts at half **(T)**.

**Media.**

`MediaBias_g = 0.5 × Σ_outlets (audience share × alignment(outlet, g))`, clamped to -0.3 to +0.3 **(T)**

- Each media outlet ([16-media.md](16-media.md)) has an **audience share** in each province and country and an **editorial line**: alignment from -1 to +1 with each bloc, set by its owner (the owner's controlling head picks the line; changing it takes 4 weeks and costs 5% audience **(T)**).
- Owning 20% of a country's audience and pushing a bloc at +1 gives that bloc +10% base clout. Media ownership is capped by G3 Media Ownership.
- **Ad campaigns** and **psyops** (from 05) also apply to blocs: a campaign "for" a bloc adds `+0.02` (ads) or `+0.05` (psyops) to its MediaBias per active campaign, decaying weekly as in 4.10.1 **(T)**.

### 4.4.6 Approval and angry groups

Monthly: `Approval_g = Σ over all current laws of stance_g(current position) + 2 if in government - 2 if marginalized + event modifiers`, clamped to -10 to +10 **(T)**.

- **Angry** (≤ -5) and clout ≥ 10%: -3 stability per angry bloc, +5 unrest in the strata supporting it, starts **political movement** events (protests, strikes, petitions). Angry Chuds raise coup risk (4.8.3).
- **Loyal** (≥ +5): +1 stability per loyal bloc with clout ≥ 10%.

### 4.4.7 Parties

- In democracies, **parties** bundle 1 to 3 ideology blocs; a party's core ideology is the one with the most of its voters. Each bloc belongs to at most one party per country at a time. Country data defines starting parties (fictional names for real-world equivalents, for example a centre-right party of Landites, Accelerationists and Chuds).
- A party's stance on any law is the clout-weighted average stance of its member blocs.
- Parties can split when two member blocs have stances 3+ apart on a law that is being debated **and** both have clout ≥ 10% (yearly check, 15% chance **(T)**), and merge when two parties together could win a majority and their bloc stances average within 1 on the top 5 debated laws.
- Managed democracies have a **ruling party** plus licensed opposition; one-party states have one party with **factions** (4.8.2).

---

## 4.5 Laws

### 4.5.1 Categories

There are seven categories. The six from the retired politics overview, plus **Governance**, which governs how money enters politics.

| Category | Laws |
|---|---|
| Economy | E1 Income Tax, E2 Corporate Tax, E3 Capital Gains Tax, E4 Inheritance and Gift Tax, E5 Tariffs, E6 Industrial Subsidies, E7 Price Controls, E8 Environmental Regulation, E10 Property Tax, E11 Zoning |
| Corporate | C1 Foreign Ownership, C2 Local partner and directors, C4 Corporate Governance, C5 Bankruptcy, C6 Special Economic Zones |
| Finance | F1 Central Bank Independence, F2 Capital Controls, F3 Exchange Rate Regime, F4 Securities Regulation, F5 Banking Secrecy, F6 Trusts and Foundations, F7 Bailout Policy |
| Labor | L1 Minimum Wage, L2 Union Rights, L3 Automation Tax, L4 Gig Worker Status, L5 Immigration |
| Tech | T2 Data Privacy, T3 AI Regulation, T4 Surveillance |
| Security | S2 Policing Model, S3 Emergency Powers |
| Governance | G1 Campaign Finance, G2 Lobbying Rules, G3 Media Ownership, G4 Political Pluralism ([5-ideology.md](5-ideology.md) 5.10) |

Law codes are kept stable, so some numbers are unused (C3, E9, T1, S1; E9 Regional Taxes was removed in batch 121). Every law is national (4.3.3), so the Level column below reads N for every law. All rates and multipliers below are **(T)**.

### 4.5.2 Economy laws

| Law | Level | Positions and effects |
|---|---|---|
| **E1 Income Tax** (top marginal rate on personal income: salaries, distributions) | N | **Minimal** 10% · **Low** 20% · **Moderate** 32% · **High** 42% · **Punitive** 55% (and +10% emigration of Elite per year) |
| **E2 Corporate Tax** (on company profit) | N | **Haven** 3% · **Low** 12% · **Moderate** 21% · **High** 30% · **Excess Profits** 30% plus 20% surtax on profit above 15% return on equity |
| **E3 Capital Gains Tax** (on realized gains of characters and trusts) | N | **Exempt** 0% · **Low** 10% · **Moderate** 20% · **As Income** (equal to E1 top rate) |
| **E4 Inheritance and Gift Tax** (on gifts, and on a dead AI rival's assets as they pass to their game-made heir; trust treatment set by F6) | N | **None** 0% · **Low** 15% above $10M · **Moderate** 30% above $5M · **High** 45% above $1M · **Great Wealth Tax** 45% above $1M plus 1% per year on net worth above $50M |
| **E5 Tariffs** (on imported industry output; raises the industry's price index, 4.0) | N | **Free Trade** 0% · **Low** 5% · **Moderate** 12% · **High** 25% · **Autarky** 50% plus import quotas at 50% of last year's volume |
| **E6 Industrial Subsidies** | N | **None** · **Targeted** 10% capex grant in strategic industries (Semiconductors, energy, defense) · **Broad** 15% capex grant and 5% opex rebate in all Industry-sector industries · **State Champions** 30% capex grant and state loans at policy rate -2% for named companies, chosen by the government (lobbyable) |
| **E7 Price Controls** | N | **Free Prices** · **Essentials Capped** energy (Oil, Gas, Power utilities) and residential rent price indices capped at 110% of their 12-month average · **Broad Controls** most industry price indices capped at 105%, shortages likely · **Planned Prices** government sets industry prices monthly; Black market prices at 150 to 300% |
| **E8 Environmental Regulation** | N | **Lax** no compliance cost · **Standard** +3% operating cost for heavy industries · **Strict** +8% and permits for new capacity in heavy industries take 2× as long · **Carbon Pricing** +12% for energy-intensive industries, revenue rebated to population (unrest -2) |
| **E10 Property Tax** | N | **Minimal** 0.3% of assessed value per year · **Low** 0.8% · **Moderate** 1.5% · **High** 2.5% · **Vacancy Penalty** 1.5% plus 3% on empty units |
| **E11 Zoning** | N | **Restrictive** a rezoning needs Disposition +10 or more with the Minister of Land and Housing (4.3.5); new building 2× permit time; real estate values +10% · **Standard** Disposition 0 or more; normal times · **Permissive** Disposition -10 or more; permit time ×0.6 · **Developer-Led** holders with Power Broker influence in the province or its city get automatic approval; permit time ×0.4; unrest +3 among Residential and slum residents |

### 4.5.3 Corporate laws

| Law | Level | Positions and effects |
|---|---|---|
| **C1 Foreign Ownership** | N | **Open** no limits · **Screened** Foreign Investment Review for foreign stakes ≥ 25% in strategic sectors · **Capped Strategic** foreign voting stake ≤ 49% in strategic sectors, screened elsewhere · **Capped All** foreign voting stake ≤ 49% in every sector · **Closed** foreign holders may only operate through a local subsidiary with a state partner (see C2 State Golden Share); restriction label Closed (2.2.4) |
| **C2 Local partner and directors** (for foreign-controlled companies operating in the country; branch offices are gone, batch 116) | N | **None** · **Local Directors** at least one third of board seats held by citizens · **Local Partner 30%** a local holder must own ≥ 30% of voting stock · **Local Partner 51% and Tech Transfer** local holder ≥ 51%; each year the parent hands the partner its plans and data in that industry (the partner's business unit there gains +5 productivity **(T)**) · **State Golden Share** State-Linked charter mandatory (government veto over sales, dividends abroad and executive appointments) |
| **C4 Corporate Governance** | N | **Founder-Friendly** dual-class unlimited, poison pills and staggered boards allowed · **Standard** dual-class up to 10 votes per share, pills need a shareholder vote · **Shareholder Primacy** no new dual-class listings, pills banned, one third independent directors · **Stakeholder Boards** workers elect one third of board seats in companies with > 2,000 employees in the country |
| **C5 Bankruptcy** | N | **Creditor-Friendly** liquidation in 2 months, creditors take control · **Reorganization** 6 to 12 months under protection, management stays, equity often survives at 5 to 20% · **State Administration** government administrator appointed; eligible for bailout (4.9.8); equity usually wiped |
| **C6 Special Economic Zones** | N | **Banned** · **Tax Zones** corporate tax -50% and tariffs waived on re-exports inside zone provinces, which the national government designates (a Decision, 4.3.5) · **Charter Zones** a zone may set its own E8, E10, E11, L1 to L5 and S2 positions, with national law as the floor for L1 · **Sovereign Charters** a zone may become a corporate sovereign territory (4.12) |

### 4.5.4 Finance laws

| Law | Level | Positions and effects |
|---|---|---|
| **F1 Central Bank Independence** | N | **Independent** bank sets rates by inflation and employment targets; lobbying has no effect · **Coordinated** government priorities weigh 25% in rate decisions; governor appointment lobbyable · **Directed** government sets the rate; rate decisions are a lobbyable decision (4.3.5) · **Monetary Financing** bank buys government debt on demand; inflation +3 to +10 points per year |
| **F2 Capital Controls** | N | **Open** · **Reporting** transfers abroad > $10M reported, 1 day delay · **Restricted** outflows > $1M need approval: 2 to 6 weeks, 15% denial chance (lobbyable decision) · **Hard Controls** outflows ≤ $50k per holder per month; foreign-controlled companies may only send dividends abroad up to a yearly quota of 5% of book value |
| **F3 Exchange Rate Regime** | N | **Free Float** · **Managed Float** central bank intervenes beyond ±2% daily moves · **Peg** fixed to an anchor currency; reserves defend it · **Currency Board** peg backed 100% by reserves; no monetary policy · **Dual Rate** official rate plus market rate; black market spread 20 to 200% |
| **F4 Securities Regulation** | N | Sets only the **first public filing line**; the 10%, 25% and 50% disclosure lines and their effects are the same everywhere ([3-markets-and-fx.md](3-markets-and-fx.md)). **Lax** first filing at 10% (no 5% line), detection ×0.5 · **Standard** first filing at 5%, detection ×1.0 · **Strict** first filing at 3%, detection ×1.5, short positions reported · **Draconian** first filing at 2%, detection ×2.0, short selling banned |
| **F5 Banking Secrecy** | N | **Open Registry** beneficial owners public: shells visible to everyone · **Standard** registry visible to authorities only · **Secrecy** shell exposure -50%, information shared only on treaty request · **Haven** shell exposure -80%, no information sharing; relations -10 with countries at Open Registry or Standard |
| **F6 Trusts and Foundations** | N | **Opaque** trusts untaxed, beneficiaries hidden · **Recognized** trust income taxed at the E3 rate, no inheritance tax on trusteeship change · **Transparent** trust registry, income taxed at the E1 rate · **Deemed Disposal** every 21 years trust assets are treated as sold and E3 is due on gains |
| **F7 Bailout Policy** | N | **No Bailouts** · **Bail-In** creditors and bondholders take a 30 to 60% haircut before any state money · **Bailout with Stakes** state money for equity and conditions (4.9.8) · **Too Big to Fail** implicit guarantee: systemically important companies borrow at -1% |

### 4.5.5 Labor laws

| Law | Level | Positions and effects |
|---|---|---|
| **L1 Minimum Wage** (as a share of the median wage) | N | **None** · **Low** 30% · **Moderate** 45% · **High** 60% · **Living Wage** 60% and indexed to inflation monthly |
| **L2 Union Rights** | N | **Banned** unions illegal; unrest +5 in Skilled and Unskilled · **Restricted** no strikes in strategic sectors; strike vote needs 60% · **Recognized** normal strikes · **Sectoral Bargaining** wages set sector-wide (+8% wages); strikes spread across a sector |
| **L3 Automation Tax** | N | **None** · **Reporting** layoffs from automation > 100 jobs reported (unrest +1) · **Robot Tax** 10% of labor cost saved by automation · **Heavy** 25% of savings plus mandated retraining (+2% labor cost) |
| **L4 Gig Worker Status** | N | **Contractors** no benefits · **Portable Benefits** +6% gig labor cost · **Employee Presumption** +18% gig labor cost; gig unrest -5 |
| **L5 Immigration** | N | **Closed** labor pools shrink 1% per year · **Skilled Only** Professionals and Skilled pools +1% per year · **Managed** all pools +1% per year · **Open** all pools +2.5% per year; Chuds approval -2 |

### 4.5.6 Tech laws

| Law | Level | Positions and effects |
|---|---|---|
| **T2 Data Privacy** | N | **None** personal data is used freely · **Notice and Consent** revenue of data-heavy industries (Ads, Social media, SaaS, Cloud) in the country -10% · **Strict** -30%; fines up to 4% of revenue (Data Authority) |
| **T3 AI Regulation** | N | **Unregulated** · **Risk-Based** high-risk AI products need certification (8 weeks) · **Licensed Models** frontier models need a licence (lobbyable decision, 3 to 6 months) · **Moratorium** frontier AI development banned; AI advisors illegal |
| **T4 Surveillance** | N | **Limited** warrants needed; scheme detection ×0.8 · **Expanded** detection ×1.0 · **Mass Surveillance** scheme and psyop detection ×1.5 · **Social Credit** state tracks each character's Favor (4.16); characters with Favor below -20 **(T)** cannot travel or hold office |

### 4.5.7 Security laws

| Law | Level | Positions and effects |
|---|---|---|
| **S2 Policing Model** | N | **Community** crime +10%, unrest -3 · **Standard** · **Militarized** crime -15%, unrest +3, protest suppression ×1.5 · **Privatized** companies with Power Broker influence may contract policing of provinces they dominate (a Decision of the Interior Minister, 4.3.5) |
| **S3 Emergency Powers** | N | **Constitutional Limits** · **Emergency Decrees** executive may decree laws for 90 days · **Standing Emergency** decrees without limit; elections may be postponed (stability -5 per postponement) · **Martial Law** the military governs every province directly; civilian ministries answer to it |

### 4.5.8 Governance laws

| Law | Level | Positions and effects |
|---|---|---|
| **G1 Campaign Finance** | N | **Public Funding Only** private donations ≤ $5k per donor per campaign; group funding counts half · **Capped** donations ≤ $50k per donor per campaign; independent expenditure groups allowed, disclosed · **Unlimited Disclosed** no caps; all donors public · **Unlimited Dark Money** no caps; donors hidden behind nonprofits (exposure per $1M = 0) |
| **G2 Lobbying Rules** | N | **Banned** all lobbying counts as bribery (exposure +10 per action) · **Registered and Disclosed** lobby cap +10 support per holder per law, every action public · **Light Disclosure** cap +15 · **Unregulated** cap +25, no disclosure |
| **G3 Media Ownership** | N | **Public Broadcasting Dominant** private outlets capped at 50% of national audience combined; MediaBias cap ±0.15 · **Plurality Rules** no owner above 25% of audience in a country or 40% in a city · **Concentration Allowed** no caps · **State-Controlled** private outlets must follow the state line; foreign media owners banned |

### 4.5.9 Enactment process

```
Proposal ──> Drafting (1 month) ──> Debate (monthly pass rolls) ──> Enacted ──> Implementation (1 to 3 months) ──> In force
                                        │
                                        └──> Stalled (Support < 0 for 3 rolls) ──> Failed (cooldown 12 months)
```

**Who can propose:**

| Proposer | How | Cost |
|---|---|---|
| Government (AI) | The governing coalition proposes the top law change its leading blocs want, at most 2 national bills at a time in democracies, 3 in other types | Free |
| The player character in office | Legislator: one bill per year. Minister: bills in their portfolio. Head of government: any | Instant, plus Support starts +5 for head of government sponsorship |
| Any holder through a client politician | **Commission a Bill** action (4.10.1) | 40 PC |
| Corporate oligarchy Council member | A motion by any seat holder | 10% of its seat weight in PC |

Only one bill per law can be in Drafting or Debate at a time. A proposal targets one position; it can move a law by **at most two steps** **(T)**.

**Duration by type** **(T)**: the monthly pass roll uses a time modifier. Liberal democracy: first roll at month 2 of debate. Managed democracy, one-party state and corporate oligarchy: first roll at month 1. Military junta: decree, enacted the same week as proposed unless the junta council rejects it (Support < 0). Failed state: national laws enact like a junta but only apply in provinces at the enforcement rate (4.3.3).

**Implementation delay**: 1 month for rates and taxes, 2 months for regulatory changes, 3 months for structural changes (C4, C5, C6, F1, F3) **(T)**.

### 4.5.10 Support formula and pass chance

For a bill moving law L to position P:

`Support = Σ_g (Clout_g% × Stance_g(P) / 2) + Sponsor + Lobby + Campaign + Crisis`

- The first term ranges from -100 (every bloc at --) to +100. Marginalized blocs count half.
- **Sponsor**: +15 if the head of government's coalition proposed it; +5 if a legislator proposed it; +10 if a minister in that portfolio proposed it **(T)**.
- **Lobby**: the sum of all active lobby support for and against this bill (4.10), capped at ±40 in total.
- **Campaign**: issue ads and astroturf campaigns (4.10.1).
- **Crisis**: events, for example "Bank Failure" gives +20 to bailout and banking laws for 3 months.

**Threshold T** by type **(T)**: Liberal democracy +10. Managed democracy 0. One-party state 0 (but the ruling ideology's stances count double). Corporate oligarchy: no clout vote; see below. Military junta -10 (Chuds stances count triple).

**Monthly pass chance** = `clamp(10% + 2% × (Support - T), 0%, 75%)` **(T)**.

**Veto by powerful blocs**: if a Powerful bloc (clout ≥ 20%) has stance -- on the position, the pass chance is halved.

**Corporate oligarchy voting**: Council seats are weighted by national influence share of each holder with at least 2% share (the rest share a "Public" seat voting with the clout-weighted bloc stance). A motion passes with > 50% of weighted votes, at the next monthly Council session. Votes can be bought from other holders (they are characters with opinion tags, hooks and prices).

### 4.5.11 Repeal, cooldowns and decrees

- A law that was changed cannot be changed again for 12 months (6 months in non-democracies) **(T)**.
- **Decrees** (Emergency Decrees or above, or any junta or one-party executive): enact immediately, skipping Debate. Cost: stability -3, approval -2 with every bloc with stance - or -- on it. In a liberal democracy under Emergency Decrees the decree lapses after 90 days unless passed as a normal bill.
- **Court challenge**: any holder can challenge a new law in court for $1M × wealth index (4.10.4) **(T)**. Strike-down chance = `judicial independence × 20%`, rising to `× 60%` for decrees and preemption acts.

---

## 4.6 Elections

### 4.6.1 Schedule

| Level | Office | Default term **(T)** | Campaign length | Held in |
|---|---|---|---|---|
| National | Legislature | 4 or 5 years (country data; US House 2) | 16 weeks | Liberal and managed democracies |
| National | Executive (presidential systems) | 4 to 7 years | 20 weeks (plus 8-week primary if the country has primaries) | Liberal and managed democracies |
| Any | Referendum | Called by government or by a petition with 5% of adults | 8 weeks | Democracies; corporate sovereignty (4.12) |

- Election dates are fixed by data and checked in the yearly calculation; voting day is a single day, results arrive over 6 to 12 hourly turns, region by region.
- **Snap elections** (parliamentary systems): each month a government's coalition approval average is ≤ -3 or stability < 40, there is a 10% chance the government falls and an election is held in 8 weeks **(T)**. A player with a client prime minister can call one at a time of their choosing (one favor).
- There are no regional or city elections (batch 121): only national elections and referendums.

### 4.6.2 Electoral systems

Each legislature uses one system, from country data:

| System | Seats | Effect |
|---|---|---|
| **First past the post** | Each national constituency (part of a city province, a province, or a group of provinces; drawn in country data) goes to the plurality winner | Big parties overrepresented; local influence matters a lot |
| **Proportional** | Seats proportional to national vote share, 5% threshold **(T)** | Coalitions common; small parties survive |
| **Mixed** | Half each | |
| **Two-round** (executives) | Runoff between the top two if nobody passes 50% | |

Constituency-level results use the strata of the provinces in that constituency, so **concentrated local influence wins seats** under first past the post.

### 4.6.3 Vote share formula

For each stratum s in the constituency and each party (or candidate) p, the game computes a utility, then splits the stratum's votes with a softmax.

`U(s,p) = 3 × Ideology(s,p) + Incumbency(p) + Economy(p) + Campaign(p) + Media(s,p) + Ads(s,p) + Psyops(s,p) + Candidate(p) - Scandal(p)`

`Share(s,p) = exp U(s,p) / Σ_q exp U(s,q)`

`VoteShare(p) = Σ_s Pop_s × Turnout_s × Share(s,p) / Σ_s Pop_s × Turnout_s`

| Term | Formula **(T)** | Typical range |
|---|---|---|
| **Ideology** | `Σ_g Aff(s,g)/100 × Member(g,p)` where Member = 1 if bloc g is in party p | 0 to 1 |
| **Incumbency** | +0.3 for the incumbent party or candidate | 0 to +0.3 |
| **Economy** (incumbent only) | `-0.6 × max(0, (Unemployment - 5)/5) - 0.5 × max(0, (Inflation - 3)/5) + 0.1 × GDP growth` | -1.5 to +0.4 |
| **Campaign** | `0.8 × ln(1 + Spend_p / E)` where E = $0.50 × adults in the constituency, and Spend includes party funds, donations and independent expenditure, multiplied by Money effectiveness | 0 to about +2.0 |
| **Media** | `1.0 × (audience share of outlets endorsing p) - 0.5 × (audience share attacking p)` among stratum s | -0.5 to +1.0 |
| **Ads** | Each active ad campaign for p: +0.15 (broad) or +0.3 (targeted at one stratum); decays 25% per week | 0 to +0.6 |
| **Psyops** | Each active psyop: +0.3 (broad) or +0.6 (targeted); decays 35% per week; exposure (4.10.3) | 0 to +1.2 |
| **Candidate** | `0.03 × (Persuasion skill - 10)` + Fame 60 or more +0.3, Favor -40 or below -0.5 (these replace the old Media Darling and Scandal-Ridden traits, which do not exist), Honest +0.1, Party School +0.1, local origin +0.2 in a constituency that includes their birth province | -0.6 to +0.9 |
| **Scandal** | Fresh scandal: minor 0.3, major 0.8, criminal 1.5; halves every 4 weeks; a debate or apology event can halve it at once | 0 to 1.5 |

Diminishing returns are built in: doubling spend from E to 2E adds only 0.32 utility; from 0 to E adds 0.55.

_Ideology update: the Ideology weight drops from 3 to 2 and a party-platform term `2 × IdeoFit` is added; see [5-ideology.md](5-ideology.md) 5.6.4._

**Polls**: weekly, the true vote share plus noise of ±3 points (±1.5 with a paid internal poll, $0.05 per adult in the constituency **(T)**).

### 4.6.4 Turnout

`Turnout_s = BaseTurnout_s × TypeMod + GOTV_s + Polarization - Apathy`, clamped 10% to 95% **(T)**

- **BaseTurnout**: table in 4.4.1. **TypeMod**: liberal democracy 1.0, managed democracy 0.85.
- **GOTV** (get out the vote) spending targeted at a stratum: +1 point per $0.25 × stratum adults spent, cap +8 points per party.
- **Polarization**: +5 points if the top two are within 5 points in polls; +3 if an Angry bloc backs a party.
- **Apathy**: `0.2 × (60 - Stability)` when stability < 60.
- Under Social Credit, Permanent Underclass turnout -10 (fear of registration).

### 4.6.5 Campaign event chain

A campaign is an event chain with weekly beats. Typical national chain:

1. **Declaration** (week 1): candidates and slates set. The player character can declare (4.7.2).
2. **Fundraising Dinner** (weekly option): host one; raises `$20k × Persuasion skill × local influence share × 10` **(T)** from local elites.
3. **Endorsements** (weeks 2 to 8): each bloc with clout ≥ 10% endorses a party or stays neutral; endorsement is `+0.2 × Aff(s,g)/100` utility in each stratum s, so it counts where the bloc's believers are; bloc endorsements can be lobbied (10 PC).
4. **Debate** (once or twice): Persuasion skill contest, ±0.3 utility to the winner/loser, critical failure (roll 1 in 20) is a minor scandal.
5. **October Surprise** (last 3 weeks): 20% chance per campaign that a scandal or exposé event fires on a random leading candidate **(T)**; rivals can schedule one with a Leak Scandal scheme.
6. **Election Night**: hourly results.
7. **Certification**: results contested if margin < 0.5%: court challenge chain (judicial independence decides).

### 4.6.6 Results and government formation

- Seats are assigned by the electoral system. A party or coalition with > 50% of seats forms the government. Coalition formation (proportional systems) takes 2 to 12 weeks **(T)**; the largest party invites partners whose bloc stances are closest; the player can bribe or pay for a partner to join or refuse (decision of the partner's leader, 4.3.5).
- The governing coalition's blocs get the Office clout bonus (4.4.4). The new government:
  - proposes its top law changes in the first 3 months (agenda bonus +5 support during that window **(T)**),
  - replaces ministers, and may replace regulator heads whose term allows (4.9.2) and the central bank governor (if F1 is Coordinated or looser),
  - reviews **government contracts**: contracts awarded by the previous government to holders who backed the losing side have a 10% chance each of cancellation in liberal democracies, 40% in managed democracies **(T)**.
- **Market reaction**: the country's index and currency move by `-3% × (average approval change of Liberals, Landites and Accelerationists)/5` over the next week **(T)**.
- A player who funded the winning side gets **favors** (4.7.4); the losing side's donors get "Backed the Loser": a -10 opinion push from each new minister, and the label lasts 2 years.

### 4.6.7 Managed elections

Managed democracies run the same formula with three extra terms:

| Term | Effect **(T)** |
|---|---|
| **Administrative resource** | Incumbent +0.6 utility in every stratum |
| **Fraud** | After counting, `Corruption / 5` points of vote share move from the opposition to the incumbent (50 corruption = 10 points). Visible fraud above 8 points: 15% chance of a protest wave (unrest +10, stability -5) |
| **Disqualification** | Any opposition candidate polling > 35% has a 30% chance per campaign of being disqualified, unless protected by a patron with ≥ 25% national influence |

Backing the opposition in a managed democracy is legal but costs: each $1M donated adds +2 exposure with the Tax Authority and Financial Police in that country **(T)**.

---

## 4.7 Offices, appointments and patronage

### 4.7.1 Office ladder

| Office | Level | How filled | Requirements **(T)** | Time | Powers | Influence and PC |
|---|---|---|---|---|---|---|
| **National Legislator** | National | Elected | Age 25, citizen | Instant votes; hearings tick | National vote, one bill per year, committee hearings (can summon executives) | +0.5 point in country; +8 PC |
| **Minister** | National | Appointed by head of government | Citizen; relevant skill ≥ 12 | Instant decisions; in-person meetings tick | Portfolio bills, portfolio decisions (permits, licences, contracts; rezonings for Land and Housing; policing contracts, crackdowns and the police chief for Interior), oversight of related agencies | +3 points; +30 PC |
| **Head of Government or State** | National | Elected, appointed by party, or seized | Age 35, citizen | Instant decisions; in-person meetings and travel tick | National agenda, appoint ministers and agency heads, decrees where allowed, diplomacy | +10 points; +80 PC |
| **Regulator Head** | National | Appointed (term 5 years, LD; at pleasure, others) | Relevant skill ≥ 14 (Finance for securities and banking, Intrigue for financial police) | Instant decisions | Opens and closes investigations (4.9) | +2 points; +20 PC |
| **Central Bank Governor** | National | Appointed (term 6 years, LD) | Finance ≥ 18 | Instant decisions | Policy rate, FX intervention (see [3-markets-and-fx.md](3-markets-and-fx.md)) | +3 points; +30 PC |
| **Ambassador** | National | Appointed | Persuasion ≥ 10 | Based in the host country (travel ticks) | +5 relation between home and host per year; trade mission events | +1 point in host country |
| **Party Official** | National | Party appointment (one-party states) | Party membership; Party School trait helps | Instant; party sessions tick | Faction strength (4.8.2) | As a minister |
| **General** | National | Military career; junta council seat | Military education or security career | Instant; coup nights tick | Coup participation, Chuds approval | Junta council member: +5 points |
| **Council of Stakeholders seat** | National | Influence share ≥ 2% (corporate oligarchy) | Any holder | Instant votes | Weighted vote on motions | Built into share |

There are no city, regional or state offices (batch 121): City Councilor, Mayor, Regional Legislator and Governor are removed. Office has no weekly time cost: votes and decisions are instant, and in-person meetings, hearings and travel burn ticks. Holding office **adds influence in that place** as above (2.5), adds PC, and grants **Political Office** status on the character. Offices are never inherited. A character who held an office for 8+ years gets +0.2 utility when running for it again ("Name Recognition") **(T)**.

### 4.7.2 Running for office

Batch 116: there are no family members to run. The player character can run, and the player can back any other candidate (a Friend, a protégé, an executive), who becomes a client if elected with the player's money (4.7.4).

- **Eligibility**: age and citizenship above; criminal conviction bars office for 10 years in liberal democracies; Social Credit bars low-Favor characters.
- **Declaring** costs 60 PC **(T)** and requires a party nomination in proportional systems: a party nominates the candidate with the highest `Persuasion skill + tie with the party leader (4.3.5) + 10 × donations to the party / E` (E from 4.6.3). In first past the post systems, primaries use the same vote formula among the party's strata.
- **The candidate's time**: campaign events (rallies, debates, fundraisers) burn ticks and keep the candidate busy for most of each campaign day **(T)**. Executive roles at a company must be delegated; a CEO who campaigns gives their company -10 productivity for the campaign.
- **Conflict of interest** once elected (4.7.5).
- **Benefits**: direct votes, agenda power, office influence, appointment power, and immunity from investigations in their own country while in a head-of-government role (managed democracy and below: always; liberal democracy: never).

### 4.7.3 Appointments

Appointed posts (ministers, regulator heads, central bank governor, ambassadors, the national police chief, party posts) are filled by an **appointer** character choosing among 3 to 5 candidates. AI generates rivals with appointment scores 20 to 40 **(T)**.

`Appointment score = relevant skill + tie with the appointer (4.3.5) + PC spent / 5 + 15 × favors called on the appointer + 10 if a bloc in government endorses + 5 × relevant traits (Law School for justice, Quant PhD for central bank, a military background for defense)` **(T)**

- The player can push their own character, an executive or Friend, a **client** (4.7.4), or simply lobby for any non-hostile candidate.
- Appointments fire when a post is vacant: new government, death, scandal resignation, term end (yearly check).
- **Removal**: an appointee can be dismissed by the appointer at any time in non-democracies; in liberal democracies regulator heads and the central bank governor can only be removed for cause (a scandal or conviction event).

### 4.7.4 Patronage

A character becomes the **Patron** of a politician (the **client**) by any of:

- funding ≥ 25% of their winning campaign;
- the Court Patron scheme (1-corporate-core 1.1.8) succeeding;
- getting them appointed;
- holding a hook over them.

Client politicians have **Loyalty** (0 to 100) to the patron: starts at 50, +10 per favor repaid by the patron (a donation, a job for a relative, a board seat), -10 per favor called, -20 if the patron is in a scandal, -30 if the patron backed their opponent **(T)**.

**Favors**: each client generates 1 favor every 6 months, plus 1 per major donation (≥ E/2 for their next campaign) **(T)**. Uses:

| Favor use | Effect **(T)** |
|---|---|
| Vote | Legislator: +3 support on one bill |
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

A character in office who, directly or through their personal trusts or companies, holds assets in a sector affected by their votes or portfolio gains +3 exposure per month with the relevant agency (liberal democracy only; +1 in managed democracy) **(T)**, unless they place those assets in a **blind trust**: the assets are managed by an appointed trustee character, cannot be traded by the official, and count only 50% toward their personal influence. Company stakes the official really controls can be blinded only by moving the stakes themselves into the blind trust, which gives up control while in office: a deliberate tension for a player who runs for office **(A)**.

---

## 4.8 Non-democratic power transfer

### 4.8.1 Regime strength

`RS = 0.4 × Stability + 0.3 × SecurityLoyalty + 0.3 × RulingClout` **(T)**

- **SecurityLoyalty** (0 to 100) = `50 + 5 × approval of the Chuds` (the bloc the officer corps leans to), plus 10 if the head of government is a general (junta), minus 15 if the military's budget was cut in the last 12 months.
- **RulingClout** = combined clout (%) of the blocs in the ruling coalition, capped at 100.
- Liberal democracies use RS only for coup checks during Standing Emergency or Martial Law.

### 4.8.2 Party struggles (one-party states and managed democracies)

- The ruling party has 2 to 4 **factions** (data-driven per country, fictional names). Templates: **Reformists** (aligned with Accelerationists and Liberals), **Hardliners** (Chuds and the ruling ideology), **Princelings** (family networks of party elders; Landites), **Technocrats** (the ruling ideology and Accelerationists).
- **Faction strength** (monthly) = `clout of aligned blocs + 5 × officials in top posts + 0.5 × PC donated by backers + MoneyEff × 0.1 × sqrt(funds / M) × 100 + scandal effects` **(T)**.
- **Yearly Plenum**: the strongest faction gets one top post (minister or province chief). **Party Congress** every 5 years: the strongest faction names the party leader and head of government; ties are broken by the incumbent leader's choice.
- **Backing a faction** (player action): donate through a local partner or front (money), spend PC, provide jobs and board seats to faction members' relatives (patronage, +1 favor each), or run a Dig Up Dirt scheme against a rival faction leader.
- **Purges**: after a Congress, each losing faction has a 50% chance to suffer an **Anti-Corruption Campaign** **(T)**. Every holder that backed it with more than 10 PC or $1M in the past 2 years gets +30 exposure with the Financial Police there, and its operations and local partner in that country face a seizure ladder step (4.9.10).
- **Ruling family variant**: replace factions with **branches of the ruling family** (2 to 3 princes or princesses as characters). Succession to the throne on the ruler's death is decided by a family council (the country's politics, not a player mechanic): score = `Persuasion skill + tie with the ruler (4.3.5) + Chuds backing + foreign backing`. The player can fund a branch or hold hooks over its members.

### 4.8.3 Monthly coup risk

A coup plot can form on its own (AI generals) or be started by a holder (4.8.4).

**AI coup chance per month** **(T)**:

| Condition | Chance |
|---|---|
| RS ≥ 60 | 0% |
| RS 45 to 59 and Chuds approval ≤ -5 | 1% |
| RS 30 to 44 | 2%, doubled if the Chuds are Angry |
| RS < 30 | 5%, doubled if the Chuds are Angry |
| Military junta (counter-coup) | ×1.5 |
| Liberal democracy | Only under Standing Emergency or Martial Law, or Stability < 20; then ×0.5 |

### 4.8.4 Coups

**Coup strength (CS)** of a plot:

`CS = PlotterMilitary + Bribes + ForeignBacking + Popular` **(T)**

| Term | How it is gained **(T)** |
|---|---|
| **PlotterMilitary** | Share of armed forces commanded by plotting generals (10 to 40, from the generals recruited) |
| **Bribes** | +1 per $10M × (MSI / 10) spent buying neutral units, cap 15. **MSI** (military size index) is 1 (tiny state) to 100 (great power), from country data |
| **ForeignBacking** | +5 to +15 if a country with relation ≥ 50 to the plotters backs it (AI decision, lobbyable with 30 PC in the backing country) |
| **Popular** | +5 if an Angry bloc with clout ≥ 15% supports the plotters; -10 if the regime's ruling blocs have combined clout ≥ 60% |

**Success chance** = `clamp(50% + 1.5% × (CS - RS), 5%, 90%)` **(T)**

**Coup chain (when a holder backs or starts a coup):**

| Step | Duration | What happens | Leak chance |
|---|---|---|---|
| 1. **Sound Out the Generals** | 2 to 4 weeks | Recruit generals one by one: success per general = `40% + 2% × (your Intrigue - 10) + tie (4.3.5, in percentage points) - 20% if the general is Content or Honest` **(T)** | 10% per week |
| 2. **Assemble** | 2 to 6 weeks | Spend bribes, arrange foreign backing, plan targets | 5% per week |
| 3. **Night of the Coup** | 6 to 24 hourly turns | Three objectives: seize the **government buildings in the capital city**, the **national broadcaster**, the **airport and central bank**. Each objective rolls the success chance once; 2 of 3 wins. Player options each turn: commit reserves (+5 CS), negotiate with a wavering general, cut the internet (needs a backdoor in the country's telecom systems, [17-hacking.md](17-hacking.md)) | |
| 4. **Aftermath** | 4 to 12 weeks | Recognition events, sanctions, purges, contracts | |

**Leaks**: a leak gives the regime warning: RS +10 for the coup, plotting generals arrested (lose them), and the backer gains +40 exposure with the Financial Police and the Chuds' hostility. A leaked plot can still proceed at reduced strength.

**Outcomes:**

| Outcome | Effects **(T)** |
|---|---|
| **Success** (2 or 3 objectives) | Government type becomes Military junta (or the plotters' chosen type if a civilian front was arranged). The backer gets: a hook on the junta leader, 2 favors with each plotting general, first refusal on state assets being privatized, +15 bid score on all contracts for 3 years, Chuds approval of the backer +5. Liberal democracies: relation -30 with the new regime; 60% chance each that a liberal democracy bloc imposes Tier 1 sanctions, 25% Tier 2. If the backer is exposed (exposure ≥ 50 with any agency of a liberal democracy), the backer's characters may be listed under Tier 1 sanctions there. Stability -15 |
| **Failure** (0 objectives, or 1 objective with CS < RS) | Plotting generals executed or jailed. Backer: all assets in the country frozen, seizure ladder jumps to Seizure for its operations there, its characters in the country arrested (Intrigue escape roll), exposure 100 with the regime's agencies, Clout -30 and Favor -30, "Coup Plotter" notoriety for 10 years. Regime RS +15, Stability +5 (rally effect) |
| **Stalemate** (exactly 1 of 3 objectives taken and CS ≥ RS) | Civil conflict: background war "Civil War" starts (4.11.6). Stability -30. Both sides seek backers |

### 4.8.5 Revolutions

**Revolution pressure (RP)** accumulates monthly per country **(T)**:

- If Stability < 30: `RP += (30 - Stability) / 2 + 2 × (number of Angry blocs)`.
- If Stability > 40: `RP -= 5`.
- RP never goes below 0.

| RP | Stage | Effects |
|---|---|---|
| 25 | **Unrest** | Protests in the largest cities: business unit output in their provinces -5%, Commercial pools in their core provinces -3% per month |
| 50 | **Uprising** | Event chain begins: Mass Protest → General Strike (all business units in affected provinces output -40% while it lasts, 1 to 4 weeks) → Clashes (Militarized policing: RP -10 but Stability -5; Community policing: RP +5). A revolutionary **coalition** forms from Angry blocs |
| 100 | **Revolution** | Government falls. The new type depends on the coalition's leading ideology (5.7.3). A "Revolutionary Council" rules for 3 to 12 months |

**New type after a revolution**: set by the coalition's leading ideology, as in [5-ideology.md](5-ideology.md) 5.7.3. If no bloc is above 25% clout after 3 months, the country becomes a Failed state.

**Revolution consequences for business** **(T)**:

- Foreign assets: nationalization chance per foreign holder = `30% + 10% × (number of anti-business blocs in the coalition: Communists, Neo-Luddites, Chuds)`.
- Capital controls jump to Hard Controls (70% chance).
- Government default on its bonds (50% chance).
- Government contracts of the old regime voided (80%).
- Holders that funded the revolution get favors with the new leaders; those that funded the old regime's security get "Regime Collaborator": a -30 opinion push from each of the new government's leaders.

**Player levers**: fund the movement (Fund Ideology to the Angry blocs), psyops to raise or lower RP (±5 per campaign), fund welfare or strike funds (-3 RP per $ equal to M/20), lobby for concessions (pass a law the Angry blocs want: RP -15), or fund security forces (RP -10, Stability -3, unrest +5).

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

Each country has six agencies. There are no regional attorneys general or tax offices (batch 121).

| Agency | Watches | Exposure sources | Typical penalties |
|---|---|---|---|
| **Securities Regulator** | Exchanges, listed companies, traders | Insider trades, undisclosed stake crossings, market manipulation, commodity cornering, false earnings, pump-and-dump psyops | Fines, disgorgement, trading bans, executive bans, delisting |
| **Tax Authority** | Income, profit, trusts, shells | Shell routing, transfer pricing, undeclared trust income, offshore accounts | Back taxes plus 50 to 200% penalties, asset liens, criminal charges for evasion |
| **Financial Police** (anti-money laundering and financial crime) | Dirty money, bribery, sanctions violations, fronts | Bribes, kickbacks, front companies, black market income, sanctions evasion, coup financing | Asset freezes, confiscation, prison, company dissolution |
| **Foreign Investment Review** | Foreign takeovers and foreign-controlled operations | Foreign stakes crossing C1 thresholds, strategic sector purchases, tech exports | Blocked deals, forced divestment, mitigation (golden share, local directors) |
| **Banking Supervisor** | Banks, insurers, leverage | Excessive leverage, hidden losses | Capital orders, management removal, resolution (bail-in, nationalization) |
| **Data Authority** | Personal data, AI, privacy | Data use beyond T2 limits, unlicensed AI | Fines up to 4% of revenue, product bans, licence revocation |

### 4.9.2 Agency stats and heads

| Stat | Range | Source **(T)** |
|---|---|---|
| **Capacity** | 1 to 5 | Budget set yearly by government (lobbyable decision); default 3 in liberal democracies, 2 in managed, 3 in one-party, 1 in failed states. Detection factor: 1 → ×0.5, 2 → ×0.75, 3 → ×1.0, 4 → ×1.25, 5 → ×1.5 |
| **Zeal** | ×0.6 to ×1.4 | From the head's traits: Ambitious +0.2, Honest +0.2, Paranoid +0.1, Content -0.2, Greedy -0.1, Deceitful -0.1; plus +0.2 for 12 months after a public scandal in the agency's domain |
| **Independence** | 0 to 1 | Equals judicial independence of the government type; decides how far the executive can steer cases (protect allies, target enemies) |
| **Integrity** | 0 to 100 | Head's bribe resistance: 50 + 30 if Honest, -30 if Deceitful, -20 if Greedy, +10 if Paranoid |

The **head** is a full character (skills, traits, relatives as flavor, secrets) appointed by the head of government (4.7.3). The head can be lobbied (opinion pushes), bribed (4.10.4), blackmailed (hooks), befriended, or replaced. Heads act from their traits, not ambitions (AI characters have none): an Ambitious head wants a high-profile conviction (Clout +10 for the head) and prefers big targets (characters whose largest company is Megacorp or Conglomerate rank, 1.7.5, are targeted 1.5× more **(T)**).

### 4.9.3 Exposure

Exposure accumulates per holder (character, trust or company) per agency domain per country.

| Action | Exposure gained **(T)** | Agency |
|---|---|---|
| Shell company routing income | +1 per month per shell, plus +1 per $1M routed per month (× F5 multiplier of the shell's jurisdiction; same rule as [1-corporate-core.md](1-corporate-core.md) 1.7.4) | Tax Authority |
| Insider trade | +10 (small) to +25 (large or obvious timing) | Securities |
| Undisclosed stake crossing via shell | +15 | Securities |
| Market manipulation, pump psyop | +20 | Securities |
| Commodity corner (> 30% of a market) | +15 | Securities |
| Bribe (accepted) | +8; +30 if refused and reported | Financial Police |
| Kickback on a contract | +4 per 1% of contract value | Financial Police |
| Psyop campaign | +5 per campaign (× surveillance multiplier) | Financial Police (election law) and Data Authority |
| Front company income | +3 per month per front | Financial Police |
| Sanctions evasion | +25 per month | Financial Police (of the sanctioning country) |
| Unlicensed AI | +5 per month | Data Authority |
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
| **1. Preliminary Inquiry** | 2 to 6 weeks | **Evidence** starts at Exposure / 4. Each week Evidence += `2 × Capacity × Zeal - GC defense` where GC defense = the higher of the General Counsel's Intrigue or Persuasion skill, divided by 5. Closes if Evidence < 15 at the end | Cooperate (Evidence +10 now, settlement penalty -30% later); stonewall (Evidence +0 this stage, 20% chance to jump straight to Subpoena); lobby the head; bribe; shred documents (Intrigue scheme; caught = Obstruction, a separate Serious offense) |
| **2. Subpoena** | 1 week | Public announcement: stock -3 to -10%, Favor -5 for the characters named, who gain "Under Investigation" | Hire outside counsel (tier 1 to 3: $1M, $5M, $20M per month × wealth index (4.10.4); counsel adds +2/+4/+8 to defense each week); PR campaign (ads, reduces stock hit by half) |
| **3. Discovery** | 4 to 12 weeks | Evidence += `3 × Capacity × Zeal - GC defense - counsel` per week. Weekly **Cracks** roll: each named subordinate or client with loyalty < 50 has `5% × (1 - loyalty/100)` chance to flip: Evidence +20 | Pay off subordinates (opinion pushes), move them abroad, arrange an "accident" (Intrigue; huge risk), call favors to slow (4 weeks per favor) |
| **4. Charges or Closure** | 1 week | Evidence ≥ 40: charges and a settlement offer. Evidence < 40: closed; exposure halved | |
| **5a. Settlement** | 2 to 6 weeks of negotiation | Penalty at 60% of the trial severity (40% if the holder cooperated), no admission of guilt for Minor and Serious; executives may still be banned | Negotiate (Persuasion vs head; each success -10% penalty, max 3); offer a scapegoat (another executive takes the fall: -50% penalty; that character turns Rival, and so do any relatives who are characters) |
| **5b. Trial** | 8 to 26 weeks | Conviction chance = `clamp(Evidence - defense score + 20, 5, 95)%` where defense score = GC skill + 5 × counsel tier (tiers 1 to 3). Non-independent courts: if the executive wants the target convicted (target is a political enemy), conviction = `90% × (1 - judicial independence) + normal chance × judicial independence` | Lobby the judge (managed democracy and below: a decision, 4.3.5); public campaign (jury trial countries: psyops can sway ±10%) |
| **6. Verdict and Penalty** | Instant | Penalty table below; appeals possible once (judicial independence × 30% chance to reduce one tier) | |

### 4.9.5 Outcomes and penalties

Each offense has a **severity tier**. Severity can rise one tier for repeat offenders (another conviction in 10 years) or for Obstruction.

| Tier | Example offenses | Company penalty **(T)** | Character penalty **(T)** | Other **(T)** |
|---|---|---|---|---|
| **Minor** | Late disclosure, small data breach, minor permit violation | Warning or fine 0.5 to 1% of national revenue | None | Favor -2 |
| **Serious** | Insider trade by an executive, unreported stake via shell, tax avoidance through shells, unlicensed AI | Fine 2 to 5% of revenue; disgorgement of gains × 1.5; back taxes + 50% | Executive ban 2 to 5 years (cannot sit on boards in that country) | Favor -10, Clout -5; stock -5 to -15% |
| **Grave** | Market manipulation, bribery of officials, systematic tax evasion, sanctions evasion | Fine 5 to 10% of global revenue; forced divestment of the offending business; licence suspension 3 to 12 months; deal unwound | Executive ban 10 years; prison 2 to 8 years possible (conviction × 50%); "Under Investigation" becomes "Blacklisted" | Favor -25, Clout -15; stock -15 to -40%; asset freeze during appeal; relations -5 between the holder's home country and the prosecuting country if foreign |
| **Criminal** | Coup financing, laundering for cartels, ordering violence, large fraud | Company dissolution or forced sale at 50% of value; all assets in the country frozen and confiscated (judicial independence × 50% chance to recover a part) | Prison 8 to 25 years; extradition requests to countries with relation ≥ 25 | Favor -50, Clout -30; "Blacklisted"; Tier 1 sanctions listing possible (liberal democracies, 30%) |

For a trust or a character (not a company), fines are 1× (Serious), 2× (Grave) or 3× (Criminal) the gains or the evaded amount instead of a share of revenue **(T)**.

Prison keeps the character in play with very limited actions for the sentence: they still own assets and hold hooks, and act through delegates (1.1.6); a weekly prison visit (3 ticks) lets a delegate consult them. A jailed player character is not game over; only death is. Health care and longevity treatments (1-corporate-core 1.1.9) can make long sentences survivable.

### 4.9.6 Foreign investment review

Foreign takeovers and stake purchases ([1-corporate-core.md](1-corporate-core.md)) above C1 thresholds trigger a **review chain** by the Foreign Investment Review:

| Step | Duration **(T)** | Mechanics |
|---|---|---|
| **Filing** | 1 week | Mandatory when the threshold is crossed; skipping filing = Serious offense, deal voidable |
| **Phase 1** | 4 weeks | Cleared unless `Concern ≥ 30`, where Concern = `2 × (post-deal foreign stake % - C1 threshold %) + 10 if a strategic sector + 15 if the buyer's home relation < 0 + head's Zeal × 10 - your PC spent / 2` |
| **Phase 2** | 12 to 20 weeks | Outcome roll: **Clear** `max(0, 60 - Concern)%`, **Clear with remedies** (cut the stake to the threshold, or accept a golden share or local directors) `30%`, **Block** the remainder |
| **Appeal** | 8 to 16 weeks | Overturn chance `judicial independence × 25%` |

During review, the target's price trades at a discount to the offer reflecting the block chance.

### 4.9.7 Government contracts

| Contract type | Level | Typical size **(T)** | Duration | Restrictions |
|---|---|---|---|---|
| Defense procurement | National | 0.05 to 0.5% of GDP | 5 to 10 years | Domestic or allied bidders only; Chuds approval ≥ 0 |
| Surveillance systems | National | 0.01 to 0.1% of GDP | 3 to 5 years | Domestic or allied; T4 at Expanded or above |
| National infrastructure (rail, grid, ports) | National | 0.1 to 1% of GDP | 5 to 15 years | Foreign bidders need a local partner if C1 is Capped |
| Healthcare and pharma supply | National | 0.05 to 0.3% of GDP | 3 to 5 years | |
| Government IT and cloud | National | 0.01 to 0.1% of GDP | 3 to 7 years | None (no data residency rules, [15-infrastructure.md](15-infrastructure.md) 15.4) |
| City services (transit, waste, utilities) in a named city | National | 0.01 to 0.1% of GDP **(T)** | 5 to 20 years | |
| Reconstruction | National | Large, after wars and disasters | 2 to 10 years | Often tied to foreign aid |

Every contract is let by the national government (batch 121). **Tender chain**: Announcement (quarterly calculation) → Bidding window (4 weeks) → Evaluation (2 to 6 weeks) → Award event → optional Protest by losers (judicial independence × 20% chance to re-run the tender).

**Bid score** **(T)**:

`Bid score = 40 × (lowest price / your price) + 30 × capability + 20 × political + 10 × relation + kickback`

- **Capability** (0 to 1): fit of your business units in the contract's industry, their productivity and your track record for the contract.
- **Political** (0 to 1): `min(1, PC spent / 50 + 0.2 × favors called + 0.3 if the bidder's controlling character is the minister in charge)`.
- **Relation** (0 to 1): 1.0 for domestic holders; for foreign holders, `relation of home to host / 100`, minimum 0.
- **Kickback**: in managed democracies and below, `+3 per 1% of contract value` paid to the decision-maker (exposure +4 per 1%). In liberal democracies kickbacks are possible only through a bribed official and add +2 per 1% with exposure +8 per 1%.
- The highest score wins. Ties go to the domestic bidder.
- Failing to deliver (capacity shortfall) triggers penalties of 10 to 30% of contract value and Clout -10 for the bidder's controlling character.

### 4.9.8 Bailouts

**Systemically important** companies **(T)**: banks or insurers with assets ≥ 2% of GDP; any company employing ≥ 0.3% of the national workforce; the sole domestic producer in a strategic sector; any company whose failure would push Stability down by ≥ 5.

**Bailout chain**: Distress (cash runway < 1 month or a bank run event) → Request (the company's head asks; any holder can lobby) → Government decision (weekly, up to 4 weeks) → Terms → Repayment or nationalization.

**Bailout chance per weekly decision** = `30% + 15% if systemically important + 10% under Bailout with Stakes (-20% under Bail-In) + PC spent / 2 (as percentage points) - 20% if the company's owners are foreign - 10% per Angry bloc opposing bailouts` **(T)**. Under F7 No Bailouts the chance is 0 unless an emergency decree passes. Under Too Big to Fail it is automatic for systemically important companies.

| Form | Terms **(T)** |
|---|---|
| **Loan** | 5-year loan at policy rate + 3%; dividend and buyback ban until repaid; executive bonuses capped |
| **Equity** | State buys new shares worth 20 to 80% of the enlarged company at a 30% discount to the last price; existing holders diluted; State-Linked charter with golden share while state holds ≥ 10% |
| **Guarantee** | State guarantees new debt; fee 1% per year; covenants |
| **Bail-in** (F7 Bail-In) | Bondholders haircut 30 to 60% before any state money; shareholders wiped below 10% of old value |

**Conditions** attached to any bailout: 50% chance the government demands the CEO's replacement (it appoints from a list it controls); 30% chance of a mandated sale of a division; political strings: no layoffs for 2 years (Communists and Neo-Luddites approval +1) **(T)**.

### 4.9.9 Nationalization

A government can nationalize a company, a business unit or a stake. Triggers **(T)**:

| Trigger | Chance or rule |
|---|---|
| Bailout equity > 50% | Automatic: state becomes controlling holder |
| Failure to repay a bailout loan | 50% per missed year |
| Revolution | Per 4.8.5 |
| Hostile government (relation with owner's home ≤ -50) and strategic sector | 5% per month |
| Sanctions retaliation | 10% per month per sanctions tier on foreign-owned assets of the sanctioning bloc |
| E6 State Champions with the ruling ideology's clout ≥ 25% | 2% per year per foreign-owned company in the sector |
| Foreign asset seizure ladder | 4.9.10 |
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

### 4.9.10 Foreign asset seizure

Branch offices are gone (batch 116). The ladder works on a **foreign holder's operations** in a host country: its business units' assets there, its local subsidiaries and its stakes in local companies. How restricted a country is for foreigners is its **restriction label** (Open, Screened, Guarded, Closed; [2-map-and-influence.md](2-map-and-influence.md) 2.2.4), which follows its C1 and C2 laws. Each month the host computes **Seizure risk** for each foreign holder with operations there:

`Seizure risk (%) = TypeBase + max(0, -Relation)/50 + 2 × SanctionsTier + 1 if strategic sector + 1 if host bloc approval of foreign business (the ruling ideology or the Chuds) ≤ -5 - 10 × your national influence share in the host - 0.5 if local partner loyalty ≥ 60` (minimum 0) **(T)**

TypeBase: Liberal democracy 0, Managed democracy 0.2, One-party 0.3, Corporate oligarchy 0.2, Military junta 0.5, Failed state 1.0.

A successful roll **does not seize directly**. It advances the **seizure ladder** by one step. Steps decay back by one after 12 months with no further advance.

| Step | Event | Host demand | Player options |
|---|---|---|---|
| **1. Pressure** | *Beijing Calls* style meeting | Raise local partner stake by 10 points, or hand over plans and data (a tech transfer), or new local investment | Comply (ladder resets to 0); negotiate (Persuasion vs minister: success holds the ladder 6 months); refuse (ladder stays, relation of host with your company -10) |
| **2. Demands** | Formal demand with deadline (8 weeks) | Larger concessions: partner to 51%, State Golden Share, executive replacement | Comply (reset to 1); appeal through your home government (ambassador, relation trade-off); lobby with PC (cost 30 PC to hold 6 months) |
| **3. Restrictions** | Dividend freeze, exit bans on expatriate executives (they cannot leave the country), tax audit (Tax Authority inquiry opens) | Full compliance with steps 1 and 2 | Comply; smuggle cash out (Financial Police exposure +25); evacuate executives (Intrigue scheme) |
| **4. Seizure** | Administrator appointed; the state or the local partner takes control | n/a | Compensation per 4.9.9; arbitration; long game: back a faction or coup to reverse it |

**Skipping steps**: a war between home and host, sanctions Tier 3 or higher, or a failed coup backed by the owner moves the ladder straight to Step 3 or 4.

---

## 4.10 Lobbying and political spending

### 4.10.1 Actions

**Lobby Points (LP)** measure lobbying for one bill. LP are bought with PC and money:

`LP = PC spent + MoneyEff × money spent / LP price`, where `LP price = jurisdiction GDP × 0.000001` **(T)**

Examples: a $28T country: $28M per LP; a $3T country: $3M; a $200B country: $200k. Each LP adds **+0.5 support** to the lobbied position (or against it), decaying 10% per month **(T)**, subject to caps below.

| Action | Level | Cost **(T)** | Time | Effect | Cap | Exposure |
|---|---|---|---|---|---|---|
| **Meet Official** | Any | 5 PC (free with an Introduction favor) | 2 ticks, in person in the city | A +10 opinion push; required before Bribe or Court Patron | 1 per official per week | 0 |
| **Lobby Bill** | Any | PC and money as LP | Instant (or a lobbying firm: +20% money cost) | +0.5 support per LP | Per holder per bill: G2 cap (+10 / +15 / +25); total all lobbying ±40 | 0 if legal; disclosed under Registered and Disclosed: opposing blocs' approval of you -1 |
| **Fund Ideology** | Any | Money | Instant | Clout per 4.4.5 | Clout from money cap +0.30 | 0; Capped G1: +1 per $ M/100 above the cap |
| **Campaign Donation** | Any | Money, within the G1 cap per donor (the character, and each company they control where G1 lets companies give) | Instant | Campaign spending for a party or candidate; an opinion push from the recipient toward the donor of +1 per 2% of E donated (cap +25 per campaign) | G1 | 0 legal; +5 if routed through shells to exceed caps |
| **Independent Expenditure** (super-PAC style) | Any | Money | Instant | Campaign spending, or Ads for or against a candidate | None under Unlimited; banned under Public Funding Only | 0 disclosed; 0 under Dark Money; +5 per M/100 if done illegally |
| **Issue Campaign** (ads) | Any | $ (0.10 × adults in jurisdiction) per week | Instant | +3 support on a bill for as long as it runs, then decays 25% per week; also +0.02 MediaBias for a bloc | 2 active per bill per holder | 0 |
| **Astroturf Campaign** (psyops) | Any | $ (0.04 × adults) per week | Instant | +6 support on a bill; or +0.05 MediaBias; decays 35% per week | 2 active per bill per holder | +5 per campaign start, × surveillance multiplier; exposé chance below |
| **Commission a Bill** | National | 40 PC | Instant | Starts a bill in Drafting through a client politician | One open bill per law | 0 |
| **Request Decision** (permit, rezoning, policing contract, crackdown, licence, capital transfer approval) | National | 10 PC for a decision about one province or city (permit, rezoning, policing contract, crackdown); 30 PC for a country-wide one (licence, capital transfer, foreign investment review) | Instant | Puts the request to the deciding body (4.3.5) | | 0 |
| **Request Protection** | National | 25 PC per agency, plus 5 PC per month upkeep | Instant | Detection × 0.7 and investigations -1 Evidence per week, for that agency | 1 active per agency | 0, but if the protecting official falls in a scandal, +10 |
| **Bribe Official** | Any | Money (4.10.4) | The bribe chain (4.20.3) | One decision, vote or favor without opinion or loyalty | | +8 if accepted; +30 if refused and reported |
| **Blackmail Official** | Any | Spend a hook | Instant | As a favor; client loyalty irrelevant | | +5; a -50 push on the official's opinion (they turn Rival); 20% chance they go to the police anyway if Brave |
| **Court Patron** | Any | Scheme (1.1.8) | Scheme, weeks (1.1.8) | Make the official a client (4.7.4) | | 0 |
| **Host Gala** | Any (held in a city) | $ (0.02 × adults in the host city, a Metro or the province) | 6 ticks, in the city | A +5 opinion push with the national legislators elected in the city's provinces and one minister of the host's choice who attends; temporary influence boost (2.5) | 1 per month per city | 0 |

### 4.10.2 Caps

- **Per holder per bill**: G2 cap as above. A character and the companies they really control count as one holder; companies they do not control count separately.
- **All lobbying on one bill**: ±40 support total from all lobbyists combined, for and against **(T)**.
- **PC pool cap**: 6 × monthly gain (4.1.2).
- **Money cap**: none in principle; diminishing returns through square roots and the support cap make extreme spending wasteful.

### 4.10.3 Exposure risk from political spending

Political exposure feeds the same investigation system (4.9) and a separate **exposé** check run by the press.

**Monthly exposé chance** per holder per country = `Political exposure / 200 × Media freedom × (1 + 0.5 if a rival runs a Dig Up Dirt scheme on you)` **(T)**.

An exposé causes a **scandal** (minor, major or criminal, by what was found), triggers an instant inquiry, and gives the targeted politicians a scandal too, which damages their loyalty to you by 20.

### 4.10.4 Bribes

`Bribe cost = office base × wealth index × (110 - Corruption) / 60 × (1 + Integrity / 100)` **(T)**

Office bases: National Legislator $1M, Police Chief $1M, Minister $5M, Regulator Head $3M, Judge $1M, Central Bank Governor $10M, Head of Government $25M, General $2M.

**Wealth index** = country GDP per capita / $20,000, minimum 0.2, maximum 4 **(T)**.

**Acceptance chance** = `Corruption% + 20% if Greedy - 40% if Honest + tie (4.3.5, in percentage points) + 10% if you hold a hook - 15% if the official is Paranoid`, clamped 5 to 95% **(T)**.

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
| ≥ 50 | **Friendly** | Foreign Investment Review treats each other's holders one step looser on C1; visa-free travel (character travel time -2 ticks); arbitration available |
| 0 to 49 | **Cordial** | Normal |
| -1 to -49 | **Cool** | C1 effectively one step stricter for each other's holders; trade agreements may be suspended (5% per month below -25) |
| -50 to -79 | **Hostile** | Sanctions chance 5% per month (from the stronger side); seizure risk terms apply; espionage events |
| ≤ -80 | **Enemy** | War chance 1% per month if either is a junta or one-party state, 0.3% otherwise **(T)** |

### 4.11.2 Trade agreements

| Tier | Requires relation **(T)** | Effect |
|---|---|---|
| **Preferential Trade** | ≥ 25 | Tariffs between members halved |
| **Free Trade Agreement** | ≥ 40 | Tariffs 0 on most industries; investment treaty (arbitration available) |
| **Customs Union** | ≥ 60, same exchange of tariffs | Common external tariff (average of members, weighted by GDP) |
| **Single Market** | ≥ 75 | Customs union plus free movement of capital and labor; C1 treats member holders as domestic; F2 cannot be stricter than Reporting between members |

Agreements are proposed by governments (AI, yearly), lobbyable (Liberals, Landites and Accelerationists usually support, Communists, Neo-Luddites and Chuds usually oppose), and ratified like a law in each member (Support threshold of that country).

### 4.11.3 Alliances and rivalries

- **Defense Alliance**: members enter wars on each other's side (as background participants), share sanctions, and get +20 bid score on each other's defense contracts as "allied" bidders.
- **Economic Bloc**: coordinate sanctions and trade war responses; usually built on a Single Market.
- **Rivalry**: set from data at start; can be created when relation stays ≤ -50 for 24 months. Rivals run espionage events against each other's companies (state-backed hackers target your Techno-Capital with hacking schemes, [17-hacking.md](17-hacking.md), 2% per month per strategic business unit **(T)**), and sanction each other more readily (×2 sanction chance).

### 4.11.4 Sanctions

Sanctions are imposed by a country or bloc on a target country, sector or holder. Each tier includes the tiers below it.

| Tier | Name | What freezes | Routes and trade | Finance |
|---|---|---|---|---|
| **1** | **Targeted** | Assets of listed characters and companies inside the sanctioning countries; listed characters cannot travel there | No route closures | Listed holders cannot use the sanctioning countries' banks or currencies |
| **2** | **Sectoral** | Plus: new investment in listed sectors (energy, finance, defense, tech) of the target | Export bans on Semiconductors and AI to the target; import bans on the target's listed industries | Target's companies in listed sectors barred from sanctioning exchanges and bond markets |
| **3** | **Financial** | Plus: the target's central bank reserves held in sanctioning currencies; all stakes held by target-country holders in sanctioning-country companies (voting rights suspended) | Insurance and shipping finance withdrawn: target-flagged ships on routes through sanctioning chokepoints stopped | Target cut off from the international payment network: dividends, interest and transfers between the target and sanctioning countries blocked; target bonds delisted |
| **4** | **Embargo** | All assets of all target-country holders in sanctioning countries; all assets of sanctioning-country holders in the target are expected to be seized by retaliation | All trade routes (shipping, air, rail, pipeline, fiber) between sanctioning countries and the target closed; chokepoints controlled by sanctioning countries closed to target trade | Full financial cut-off |

- **Secondary sanctions** (flag on Tier 2+): third-country holders that trade with the target in sanctioned industries are listed at Tier 1 with 10% chance per month of continued trade **(T)**.
- **Imposition**: a government decision driven by relation, rivalry, war, coups, human rights events, and bloc pressure (Chuds push; Liberals, Landites and Accelerationists with business in the target resist). Holders can lobby for or against (30 PC national to shift the decision chance by ±10 points **(T)**).
- **Lifting**: monthly 3% chance per tier once the triggering cause ends and relation > -40 **(T)**; lifting happens one tier at a time.
- **Retaliation**: a sanctioned target imposes counter-sanctions one tier lower on the sanctioner's holders within 4 weeks (70% **(T)**), and raises seizure risk for their operations in the target (4.9.10).

**A holder's operations in a sanctioned country** (business units and subsidiaries there) face a choice event (*The Wall Comes Down*):

| Option | Result **(T)** |
|---|---|
| **Comply and exit** | Sell to the local partner or a state buyer at 10 to 40% of value over 4 to 12 weeks; Favor +5 at home |
| **Ring-fence** | Keep operating isolated: no dividends or tech flow to the parent, profits trapped in local currency; the parent writes the stake down 50%; seizure ladder risk continues |
| **Evade** | Route trade and cash through a shell in a neutral haven: profits flow, but +25 exposure per month with the sanctioning country's Financial Police; Criminal tier if convicted |
| **Spin off** | Transfer the operation to a friendly third-country holder (requires a third-country holder willing; counts as evasion if the player keeps control through hooks) |

### 4.11.5 Trade wars

Trade wars escalate in four levels. Each month a trade war is in force, escalation chance = `5% + max(0, -Relation)/10 % + 5% if Communists or Landites clout ≥ 25% in either country`, de-escalation chance = `5% + max(0, Relation)/10 %` **(T)**.

| Level | Measures | Typical effect |
|---|---|---|
| **1. Skirmish** | +10% tariffs on 3 to 5 targeted industries | Those industries' price indices +5 to 10% in both countries |
| **2. Broad Tariffs** | +25% on most industries both ways | Trade volume between them -30%; affected exporters' stocks -5 to -15% |
| **3. Export Controls** | +50% tariffs; export bans on Semiconductors, rare earths and AI | The banned industries' price indices +20 to 40% in the target |
| **4. Decoupling** | Near-embargo on strategic industries; investment screening of each other's holders at Capped All | Stocks with exposure -20 to -40%; seizure risk on each other's operations as Hostile |

### 4.11.6 Background wars

Wars are background events. The player never commands armies.

| Intensity | Example | Provinces in the war zone | Adjacent provinces and routes | Global |
|---|---|---|---|---|
| **Border clash** | Skirmishes for weeks | Output -10%; real estate -5% | Route disruption 5% chance per week | Defense stocks +5% |
| **Regional war** | Months of fighting | Output -50%; business units there lose 2% of their capacity per month; real estate -40%; population flight 2% per month | Output -10 to -20%; chokepoints at risk (20% closure per month) | Oil +20 to 50%; defense demand +30% |
| **Major war** | Great powers involved | Output -80 to -100%; capacity destruction 5% per month; martial law | Output -20%; insurance on routes +300% | Oil +50 to 100%; commodity spikes; global stocks -10 to -25%; sanctions waves |
| **Civil war** | After a stalemate coup or revolution | As regional war, split between two governments that each claim the country | As regional | Minor |

- **War chance**: from relation (4.11.1), rivalry, junta and one-party expansionism (country data), and disputed territory data.
- **Peace**: each month 5% + 5% per year of war, +10% if either side's stability < 25 **(T)**.
- **Reconstruction**: after peace, reconstruction contracts worth 5 to 20% of the war-zone countries' GDP are tendered over 3 to 5 years.
- **Opportunities**: defense manufacturing, commodities, reconstruction, distressed asset purchases in affected provinces (real estate at -40% can be bought by those brave enough).

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

_Ideology adds two terms: ideological legitimacy and active radical wings ([5-ideology.md](5-ideology.md) 5.6.5)._

Local stability (per province, for local unrest and protests) = country stability + local modifiers (local unemployment, local unrest, policing model), ±20 **(T)**.

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
- **Who profits**: holders short the currency (players attacking a weak peg, see [3-markets-and-fx.md](3-markets-and-fx.md)), exporters, foreign-currency holders in the country.

**Sovereign default** **(T)**:

`Monthly chance = max(0, Debt/GDP% - Limit) / 300 × (1 + max(0, 40 - Stability)/20) + 10% in the month of a currency crisis if ≥ 40% of debt is in foreign currency`

- Limit: 120% if less than 40% of debt is in foreign currency, else 60%.
- **Effects**: bonds haircut 30 to 70% (restructuring chain: Moratorium → Negotiation with creditors (holders with ≥ 5% of the bonds get a seat) → Haircut agreed or Holdout lawsuits); credit rating to D; domestic banks holding the bonds need recapitalization (bailout chain, 4.9.8); capital controls to Restricted or Hard (70%); Stability -15; government contracts paid late (50% delayed 6 months).

**Debt vassalage** (Logan, batch 107). A country whose debt to **one other country** is so large it can never repay it can become that country's **debt vassal**: instead of servicing the debt, it pays the creditor a **set fee** every year, and the creditor gains **vassalage** over it. Mali has been a US debt vassal since its 2012 collapse ([19-history.md](19-history.md) 19.14). **China** makes its own debt vassals through **Belt and Road** from 2013, a rival bloc to America's (Logan, batch 108). Details **(A)**:

| Item | Rule |
|---|---|
| **How it starts** | A country in default or a currency crisis is bailed out by a single country instead of the ISF (4.25). If the bailout debt is above **50% of the debtor's GDP (T)** and the debtor misses a year of payments, the creditor can offer debt vassalage. The debtor's AI accepts if its Stability is under 40 **(T)**; otherwise it accepts or refuses by the usual AI weights. |
| **The fee** | The debtor pays **2% of its GDP a year (T)** to the creditor's treasury, forever or until it buys its way out. The debt stops growing. |
| **What the overlord gains** | The debtor follows the overlord in alliances, sanctions and international organization votes; relations are locked at +60 **(T)** or higher; the overlord's companies get **+25% influence (T)** and first right on state contracts and privatizations there; the overlord may base troops there. |
| **How it ends** | The debtor repays the full debt in one sum, or a revolution or a nationalist government (Sovereigntists, 5-ideology) repudiates it, which sets relations with the overlord to -80 **(T)** and may trigger sanctions. |

**Revolution**: 4.8.5.

---

## 4.12 Corporate sovereignty (endgame)

At extreme influence, a character or megacorp can turn a city (a Metro or city province) into territory its company governs. A city has no government of its own (4.3.1), so each stage is a charter granted by the national government. It is a Megacorp-rank goal (4.28).

### 4.12.1 The three stages

| Stage | What it is | Needs national law | Powers gained |
|---|---|---|---|
| **1. Special Economic Zone** | The city (or one of its provinces) is a tax zone and the company runs its services | C6 Tax Zones or higher | Corporate tax -50% in the zone; company manages zone infrastructure and collects fees; +10 PC per month in the country |
| **2. Charter City** | The company's board administers the city under a national charter | C6 Charter Zones or higher | The zone sets its own E8, E10, E11, L1 (above the national floor) to L5, S2 (Privatized allowed), and zone taxes; **Company Administration**: the controlling company's head appoints a zone administrator, and residents get a Residents' Council with advisory votes |
| **3. Sovereign Corporate Zone** | The city (all its provinces) is a separate polity governed by the company's charter | C6 Sovereign Charters, which can only be enacted in a corporate oligarchy, a failed state, or by treaty with Support ≥ +40 | All law categories except those reserved in the treaty; its own relations, its own exchange and (optionally) its own currency or scrip; its own security forces; becomes a city-state, a country of its own (4.3.2) |

### 4.12.2 Requirements **(T)**

| Requirement | Stage 1 | Stage 2 | Stage 3 |
|---|---|---|---|
| City influence share (character or company; [2-map-and-influence.md](2-map-and-influence.md) 2.5.10) | ≥ 50% (Kingmaker) for 12 months | ≥ 60% for 24 months | ≥ 75% for 36 months |
| Regional influence share | ≥ 25% | ≥ 35% | ≥ 50% |
| National position | ≥ 10% national share or a client minister | ≥ 25% national share, or a client head of government, or government type Corporate oligarchy | Council of Stakeholders chair (corporate oligarchy), or controlling the Failed state's capital city, or a ratified treaty |
| Favor (Image, 4.16) | ≥ 0 | ≥ 10 | Any |
| Security | n/a | Private security in the zone (4.23): Security Strength 30 per 100k residents | Security Strength 80 per 100k residents, plus a cyber defense team |
| Money | Zone setup $500M × wealth index | $5B × wealth index | $20B × wealth index plus a treaty payment |

### 4.12.3 Process

Each stage is an event chain:

1. **Feasibility Study** (8 weeks): the game shows the expected backlash: bloc reactions, unrest, international reaction.
2. **Enabling Legislation**: the C6 position must be in force nationally (pass it as a law; Sovereign Charters face the blocs that oppose them in 5.3, such as the Communists at --).
3. **Charter Negotiation** (4 to 12 weeks, Persuasion contest with the head of government): terms are chosen from a menu:
   - Revenue share to the national government: 10 to 30% of zone tax revenue.
   - Lease length: 50 or 99 years (Stage 2), perpetual (Stage 3).
   - Reserved powers: defense, currency, citizenship (each reserved power lowers backlash by 10%).
   - Resident guarantees: keep minimum wage floor, keep elections for a Residents' Council (each lowers unrest).
4. **Referendum** (democracies only; residents of the city's provinces vote; formula 4.6.3 with Yes and No as the two options; the company's media, ads and psyops apply; the blocs that oppose the charter campaign No).
5. **Handover** (4 weeks): the national ministries hand the city's administration to the company (Stage 2) or the national flag comes down (Stage 3). National officials who are not clients may resist (event).
6. **Backlash** (ongoing): see 4.12.5.

### 4.12.4 Governing a corporate zone

- **Upkeep**: the company pays for services: $1,500 per resident per year × wealth index for Stage 2, $3,000 for Stage 3 (security, utilities, courts) **(T)**, and collects zone taxes it sets.
- **Laws**: set by board resolution: no debate phase; enacted at the next monthly board meeting. Each law change still moves bloc approval and unrest among residents.
- **Residents' Council**: advisory. If resident unrest exceeds 50, it can call a **Charter Strike** (zone output -40%) or petition the national government to revoke the charter.
- **Citizenship and labor**: Stage 3 zones control immigration (L5) and can sell residency to wealthy characters (revenue, but Chuds backlash in the host country).
- **Courts**: private arbitration replaces courts; regulators of the host country lose jurisdiction (Stage 3) or keep only Financial Police and Securities powers (Stage 2).
- **Score**: Stage 2 adds +500 to the player's score per decade held, Stage 3 +2,000 **(T)**, and counts toward the Corporate Sovereignty endgame (4.29).

### 4.12.5 Consequences and backlash

| Source | Effect **(T)** |
|---|---|
| Host country blocs | Approval -2 for every bloc that opposes Sovereign Charters (5.3); host stability -3 (Stage 2) or -8 (Stage 3) |
| Residents | Unrest +10 at handover, decaying 1 per month if the zone keeps minimum wage and a Residents' Council |
| Liberal democracies | Relation -10 with the host for Stage 3; Tier 1 sanctions on the company's executives 20% (if the zone was won through a coup or capture) |
| Rival characters | AI rivals with ≥ 10% influence in the host country gain a "Stop the Charter" casus belli and may fund the opposition or revolutions; a hostile takeover of the company happens only on the game director's order (AI companies buy only when the director says so, 2.23) |
| **Reclamation** | Each month a hostile national government (relation to the company's head ≤ -25, or a government formed by parties that campaigned against the charter) has a 5% chance to start a **Reclamation** chain: Revocation Bill → Court Challenge (judicial independence decides if the charter's terms are respected) → Standoff (the company's Security Strength vs national police or military, 4.23.2) → Reclaimed (nationalization with compensation per 4.9.9) or Charter Upheld |
| Stage 3 recognition | Each country decides to recognize the zone (relation with the company's home ≥ 25 and a trade deal); unrecognized zones cannot list on foreign exchanges or use the international payment network until 3 countries recognize them |

---

## 4.13 Worked examples

All numbers use the tuning values above.

### 4.13.1 A rezoning from the national ministry (new chip capacity)

**Situation.** The player's Semiconductors business unit needs more Industrial space in Austin (United States, liberal democracy, corruption 25, wealth index 4), whose Industrial pools are full. Austin is a single city province (2.3.3). The player holds a $40M share of its Land pool (2.16) and wants that land rezoned, so it can be developed into Industrial space (2.16.2). There is no city council (batch 121): the rezoning is a Decision of the US **Minister of Land and Housing** (4.3.1, 4.3.5). E11 Zoning is Standard: the minister approves at Disposition 0 or more. The player's US national share is 0.25% (no tier) and their Austin city share is 18% (Presence); no area or region tier.

**PC.** `100 × sqrt(0.0025) × 1.0 = 5`, plus 2 local standing PC for Presence in Austin (4.1.2): **7 PC per month**, pool cap 42.

**The minister before any action** (4.3.5): the governing party is split on industrial rezoning next to homes, stance -1 (-10); the minister is Neutral to the player (0). Disposition -10: the request would be refused.

**Actions.**

1. **Meet Official** with the minister three weeks running: 3 × 5 PC and 6 ticks in Washington, three +10 opinion pushes. They add up to 30 within the year, so the minister moves from Neutral to Friend: tie +10 (1.1.4).
2. **Request Decision** (rezoning of one province's Land pool share): 10 PC.

**Decision: Disposition -10 + 10 = 0. Rezoning approved.** Total cost: 25 PC (about 3.5 months of income) and 6 ticks. Exposure: 0 (all legal and disclosed).

**Why not bribe?** A bribe to the minister would cost `$5M × 4 × (110 - 25)/60 × (1 + 50/100) = $42.5M`, with acceptance only 25% and a 50% chance a refusal is reported (+30 exposure and an instant Financial Police inquiry). In a liberal democracy the legal route is cheaper and safer.

**Making it easier next time.** If the player's Austin share reaches 25% (Power broker), one rezoning Request Decision per quarter costs 0 PC (2.5.10). Pushing E11 to Developer-Led is now a national bill (4.5.2): far dearer to pass, but it would make rezonings automatic for Power broker holders in every province of the country.

### 4.13.2 Lobbying a national capital gains tax cut

**Situation.** A $3T liberal democracy with 50M adults. E3 is Moderate (20%). The player wants Low (10%); their personal trusts and companies realize about $400M of gains per year, so the cut saves $40M per year. The governing coalition is labor-green, so no government sponsorship. The player's national share is 2%: 14 PC per month, cap 85. G2 is Light Disclosure (lobby cap +15 per holder).

**Base support** for Low (stance / 2 × clout):

| Bloc | Bloc clout | Stance on E3 Low | Contribution |
|---|---|---|---|
| Landites | 15% | ++ | +15 |
| Liberals | 20% | + | +10 |
| Accelerationists | 12% | + | +6 |
| Sovereigntists | 6% | + | +3 |
| Communists | 16% | -- | -16 |
| Neo-Luddites | 6% | - | -3 |
| Effective Altruists | 7% | - | -3.5 |
| Chuds, Transhumanists | 18% | 0 | 0 |
| **Total** | | | **+11.5** |

Threshold T = +10, so the bill would pass at `10% + 2% × 1.5 = 13%` per month: too slow.

**Plan.**

1. Save PC for 3 months, then **Commission a Bill** through a client legislator: 40 PC. Sponsor +5.
2. **Lobby Bill**: 30 LP for the full +15 cap. 10 LP from PC (the rest of the pool) and 20 LP from money. LP price = `$3T × 0.000001 = $3M`, so $60M.
3. **Issue Campaign** for 4 weeks before the first roll: `$0.10 × 50M = $5M` per week, $20M total, +3 support.
4. Communist-aligned unions counter-lobby with 20 LP: -10.

**Support** = 11.5 + 5 + 15 + 3 - 10 = **24.5**. Pass chance = `10% + 2% × 14.5 = 39%` per month. Liberal democracy debate rolls start in month 2. If the player tops up lobbying each month to offset the 10% decay (about 3 LP, $9M per month), the chance over the first three rolls is `1 - 0.61³ = 77%`.

**Cost:** about $60M + $20M + $27M maintenance = $107M, paid back in under 3 years of tax savings. **Side effects**: lobbying is disclosed, so Communist, Neo-Luddite and Effective Altruist approval of the player drops by 1, and the player character takes the hit if they ever run for office in labor-leaning wards.

### 4.13.3 Backing a protégé for the national legislature

**Situation.** The player backs a protégé, a Friend and former executive of one of the player's companies (Persuasion 16, born in Montreal), who runs for a Montreal seat in Canada's House of Commons (a riding of about 110k adults, so E = $55k; there is no mayor or city council, batch 121) for the business party (Landites, Accelerationists, Chuds) against the sitting member from the centre-left party (Liberals, Communists, Effective Altruists), Persuasion 12. The riding's strata are assumed to match Montreal's mix **(A)**. Unemployment 7%, inflation 4%, growth 1%.

**Utility terms that are the same for every stratum** (this example uses the Ideology weight of 3 and leaves out the platform term of 5.6.4):

| Term | Protégé | Incumbent |
|---|---|---|
| Incumbency | 0 | +0.30 |
| Economy | 0 | `-0.6 × 0.4 - 0.5 × 0.2 + 0.1 = -0.24` |
| Campaign | Spends $110k: `0.8 × ln 3 = 0.88` | Spends $55k: `0.8 × ln 2 = 0.55` |
| Media | Player-owned local paper, 15% audience, endorses: +0.15 | 0 |
| Candidate | `0.03 × 6 + 0.2 (local origin) = 0.38` | `0.03 × 2 = 0.06` |
| **Sum** | **1.41** | **0.67** |

Plus a targeted ad campaign at the PMC stratum (+0.3 for the protégé there).

**By stratum** (ideology × 3 from the starting mix in 4.4.2):

| Stratum | Share of adults | Turnout | Protégé ideology | Incumbent ideology | Protégé share |
|---|---|---|---|---|---|
| Permanent Underclass | 52% | 40% | 0.99 | 1.41 | 58% |
| PMC | 47% | 65% | 0.87 | 1.59 | 58% (with the targeted ads) |
| Glitterati | 1% | 70% | 1.08 | 1.29 | 63% |

Nobles and Oligarchs are named characters only and add a handful of votes.

**Result: protégé 58%.** A generic business party candidate with equal spending would get about 33%: the protégé's skill, origin, the player's money and the player's newspaper are worth 25 points.

**The twist.** In week 14 the incumbent's allies run a Leak Scandal scheme: the protégé's party footage (a minor scandal, -0.3). Recomputed: **50.6%**, a coin flip. The protégé wins the debate and apologizes, halving the scandal to -0.15: **54.3%** on election night. Once elected, the protégé is the player's client (4.7.4: the player funded over 25% of the campaign), with Loyalty 60 **(T)**: the office's +0.5 points of national influence and +8 PC per month are the member's, and the player gets favors (each a +3 support vote on one national bill, 4.7.4) and a friendly voice in the governing caucus if the business party wins nationally. Cost: the money, and the risk that a client with their own office and Clout one day turns on the player (Loyalty falls with every favor called).

If playtests show money and media swinging races this much, the first values to lower are the Campaign coefficient (0.8) and the Media coefficient (1.0).

### 4.13.4 A sanctions shock to a foreign operation

**Situation.** The player's home is Country A (liberal democracy). The player controls an EV maker in Country B (one-party state, strategic sector, restriction label Guarded) with a 49% stake; C2 forces a local partner to hold 51% (loyalty 70). It has a book value of $2B and $300M of profit per year. After a naval incident, A and B's relation falls to -55, and A imposes **Tier 2 sectoral sanctions** (EVs and Semiconductors). The player's national influence share in B is 0.8%.

**Monthly seizure risk** = `0.3 + 55/50 + 2 × 2 + 1 (strategic) - 10 × 0.008 - 0.5 = 5.8%`.

- Month 2: the roll succeeds. Ladder step 1, *Beijing Calls*: B wants a tech transfer: the company's EV plans and data. The player negotiates (Persuasion 15 against the minister's 14: success), holding the ladder for 6 months.
- Month 5: A escalates to **Tier 3 financial sanctions**. The ladder jumps straight to **step 3, Restrictions**: dividends frozen (they are blocked from A anyway), two expatriate executives under exit bans, a Tax Authority inquiry opens in B. Seizure risk rises to 7.8% per month, and the next advance is **Seizure** (compensation 30%, in B's currency, under Hard Controls). Target-flagged ships carrying the company's output are stopped at A-controlled straits; output must be sold inside B or to neutral countries.

**The choice event *The Wall Comes Down*:**

| Option | Outcome |
|---|---|
| Comply and exit | Sale to the local partner at 25%: $500M, written off $1.5B. Favor +5 at home. Clean |
| Ring-fence | Stake written down 50%. $300M a year trapped in B. 7.8% monthly chance of losing everything for $600M of trapped compensation |
| Evade through a haven shell | Profits flow, but +25 exposure per month with A's Financial Police (capacity 3, zeal 1.0, corruption 20). Inquiry chance 22.5% in month 1, 45% in month 2, 60% in month 3: only a 17% chance of staying undetected for 3 months. Sanctions evasion is Grave: fines 2× the evaded amount, executive bans, possible prison |

The player sells, then quietly asks a Friend with a shell company in a neutral country to buy a minority of the local partner (Spin off logic, with evasion risk if hooks are used to keep control).

### 4.13.5 Insider tip and a securities investigation

**Situation.** A client minister uses a favor to give the player one week's notice of a surprise rate cut. The player's personal trust buys index futures and makes $40M. Exposure +20 with the Securities Regulator (liberal democracy, F4 Standard ×1.0, capacity 4 ×1.25, head Ambitious and Honest: Zeal 1.4, corruption 20).

**Detection** per month = `0.20 × 1.25 × 1.4 × 1.0 × (1 - 20/200) = 31.5%`. Exposure only starts decaying after 3 quiet months, so the 3-month detection chance is `1 - 0.685³ = 68%`. With **Request Protection** (25 PC, ×0.7) it is 22% per month, 53% over 3 months.

**If caught** (no protection): Evidence starts at `20/4 = 5`. Preliminary Inquiry: `+2 × 4 × 1.4 - 3 (General Counsel skill 15 / 5) = +8.2` per week; after 4 weeks Evidence 38, so a Subpoena (the trust's holdings and the player character named, "Under Investigation"). Discovery with tier 2 counsel ($5M × 4 per month): `+3 × 4 × 1.4 - 3 - 4 = +9.8` per week. The client minister (loyalty 45) has a `5% × 0.55 = 2.75%` weekly chance to flip (+20). After 8 weeks Evidence is well above 40: **charges**.

| Path | Outcome |
|---|---|
| Settle (cooperated) | Serious tier at 40%: disgorgement `1.5 × $40M × 0.4 = $24M` plus fine `1 × $40M × 0.4 = $16M`; the player character banned from boards in that country for 2 to 5 years; Favor -10, Clout -5 |
| Scapegoat the trust's portfolio manager | Penalty halved; the manager turns Rival; a new enemy who knows things |
| Trial | With Evidence 80 at trial and defense score `15 + 5 × 2 = 25`, conviction = `80 - 25 + 20 = 75%`; on conviction the full Serious penalty (Favor -10, Clout -5) |

The lesson: favors buy information, but trading on it is the most detectable thing a player can do.

### 4.13.6 A currency crisis and a bank bailout

**Situation.** The player's bank (a Subsidiary in the Banking industry) operates in Country D, a managed democracy with a peg to the dollar. Reserves cover 2 months of imports; stability 34; debt 75% of GDP, half in foreign currency (Limit 60). The bank holds $3B of D's government bonds and its assets are 2.5% of D's GDP (systemically important). A rival holds short positions against D's currency worth 10% of reserves.

**Currency crisis chance** = `5% × (3 - 2) × (1 + (50 - 34)/25) + 0.5 × 10% = 8.2% + 5% = 13.2%` per month.

In month 3 the peg breaks: the currency falls 45% over two weeks, the central bank raises the rate 12 points, stability drops 10 to 24 (Crisis band), and capital controls move to Restricted.

**Default chance that month** = `(75 - 60)/300 × (1 + (40 - 24)/20) + 10% = 9% + 10% = 19%`. D defaults. The bond restructuring imposes a 50% haircut: the bank loses $1.5B and is insolvent.

**Options:**

| Option | Detail |
|---|---|
| Recapitalize privately | The player's personal trust injects $1.5B (in a currency now worth 45% less, and under capital controls it may never come out). Full control kept |
| Request a bailout | Weekly chance = `30% + 15% (systemic) + 10% (F7 Bailout with Stakes) + 10% (20 PC spent) - 20% (foreign owner) = 45%`; over 4 weekly decisions 91%. Terms (Equity): the state buys 60% of the enlarged bank at a 30% discount; golden share; 50% chance the CEO is replaced; the player keeps 40% and loses control |
| Let it fail | C5 Reorganization: equity survives at 5 to 20%; depositors' unrest +5 in the provinces where D has branches; Favor -15 |

**The rival's side**: the rival who shorted the peg made roughly 45% on a position worth 10% of D's reserves, and is now the most hated name in D's press. A smart player would have hedged with FX forwards ([3-markets-and-fx.md](3-markets-and-fx.md)) the moment stability fell below 40.

---

## 4.14 Sample political events

| Event | Trigger | Options (short) |
|---|---|---|
| *The Fundraiser* | Election within 12 weeks, the player has influence ≥ 10% | Host (4 ticks, money raised, opinion push) · Send a cheque · Decline |
| *A Quiet Word from the Minister* | Client minister with Loyalty ≥ 60 | Accept advance notice (+20 securities exposure if traded on) · Decline politely |
| *Subpoena* | Investigation reaches stage 2 | Cooperate · Lawyer up · Leak a counter-story |
| *The Client Flips* | Discovery, client loyalty < 50 | Pay them off · Threaten (Intrigue) · Let it happen |
| *Beijing Calls* | Seizure ladder step 1 | Comply · Negotiate · Refuse |
| *General Strike* | Revolution pressure 50 | Negotiate with unions · Hire replacement workers (unrest +10) · Shut the affected business unit |
| *The Colonel's Dinner* | Coup risk active, the player has influence ≥ 5% in the country | Listen · Report to the government (Chuds approval +2, plotters hostile) · Leave early |
| *Night of the Long Phones* | A coup is under way | Commit reserves · Negotiate with a wavering general · Evacuate executives |
| *Recount* | Margin < 0.5% | Fund the legal challenge · Concede |
| *Party Congress* | One-party state, every 5 years | Back a faction · Stay neutral (safe, no gains) |
| *The Wall Comes Down* | Sanctions Tier 2+ on a country where the player has operations | 4.11.4 options |
| *Peg Under Pressure* | Currency crisis chance ≥ 10% | Short the currency · Hedge · Lobby for IMF-style support (relation) |
| *Charter Referendum* | Corporate sovereignty step 4 | Campaign hard · Sweeten terms (Residents' Council) · Delay |
| *Reclamation Bill* | Hostile government with a corporate zone | Negotiate a higher revenue share · Fight in court · Prepare a standoff |
| *Tax Haven Leak* | F5 Secrecy or Haven country, the player has shells there, 1% per month | Deny · Restructure shells (lose 5% of their assets in fees) · Get ahead of it with a philanthropy campaign |

---

## 4.15 The political experience

Politics must feel like CK3 intrigue and Victoria 3 lawmaking without asking an hourly-turn player to click through every bill in forty countries. The rule of thumb: **the player sets goals and budgets, a Political Director runs the routine, and the game stops only for decisions that matter.** Hourly play is kept for "hot moments" (hearings, election nights, coup nights, negotiations).

### 4.15.1 The Politics screen

The Politics screen ([11-ui.md](../11-ui.md)) has seven tabs. Each tab opens on the jurisdictions where the player holds assets or Presence, sorted by how much money is at stake.

| Tab | What the player sees | What the player clicks |
|---|---|---|
| **Desk** (home tab) | Per jurisdiction: PC pool and monthly gain, influence tier, government type and ruling coalition, Government attitude (4.27.2), next election, open investigations, seizure ladder step, and a **Stakes** column: the yearly money impact on the player of every bill in Drafting or Debate (estimated from the assets of the player character, their trusts and their companies, and the law's effects) | Open a jurisdiction; set Political Objectives (4.15.2); approve the Director's budget |
| **Laws** | The law grid by category (4.5.1) for the chosen jurisdiction: current position, bills in progress with a support bar, pass chance and the tooltip breakdown (4.5.10), the player's Stakes per position | Lobby Bill, Commission a Bill, Issue or Astroturf Campaign, fund a think tank paper (4.18.2) |
| **People** (the Rolodex) | Officials, clients, judges, journalists, regulator heads, party leaders, union and NGO leaders, crime bosses known to the player: opinion tag, loyalty, favors owed, hooks, Integrity band if known | Meet, call in a favor, bribe, blackmail, Court Patron, hire (for lobbyists and fixers) |
| **Elections** | Calendar of every election where the player has Presence; polls with noise bands; candidates; the player's backed candidates; campaign planner showing utility terms by stratum (4.6.3) | Donate, independent expenditure, ads, run for office, back a protégé, endorse |
| **Heat** | Exposure meters per agency per country (4.9.3), open investigations and their stage, the character's Heat and each scandal's share (4.17.4), whistleblower risk per operation (4.20.5), dirty money balance (4.20.1) | Request Protection, respond to a scandal, hush money, restructure shells, launder |
| **Public** | Fame, Favor (with its local read by country and stratum) and Clout (4.16), media audience and tone, active protests and boycotts (4.24) | Set editorial lines, run media campaigns, fund foundations and NGOs |
| **World** | Relations, blocs, sanctions, trade wars, wars, international organizations (4.25), espionage requests (4.26) | Improve Relations, lobby international bodies, answer The Request |

Every number has the usual tooltip breakdown. The **Stakes** column is the anti-tedium tool: a bill with a Stakes value below the player's chosen alert threshold (default 0.5% of the player's yearly income **(T)**) is shown greyed out and never stops auto-advance.

### 4.15.2 Political Objectives and the Political Director

**Political Objectives** are standing goals the player sets per jurisdiction, chosen from a menu. Up to 3 per jurisdiction and 12 in total **(T)**.

| Objective | Example | What the Director does each week |
|---|---|---|
| **Hold a law** | Keep E2 Corporate Tax at Low or lower | Lobbies against any bill moving it the wrong way, up to the budget; buys Issue Campaigns once Support is within 10 of the threshold |
| **Move a law** | Push E11 Zoning to Permissive in the United States | Saves PC, Commissions the bill when the pass chance would be ≥ 25%, keeps lobbying topped up against decay |
| **Win a decision** | Rezoning of a province Land pool share (2.16); a foreign investment review; a licence | Meets the deciding minister, spends PC and favors until the disposition (4.3.5) is 0 or more, then files the Request Decision |
| **Protect** | Keep Financial Police in the United Kingdom off the player | Keeps Request Protection active, meets the agency head monthly, alerts when Exposure passes 40 |
| **Keep a friend in office** | Re-elect the client legislator | Donates within G1 caps, buys ads in the last 6 weeks, funds GOTV in the client's best stratum |
| **Weaken an enemy** | Unseat a hostile legislator | Funds the challenger, runs ads; never runs illegal actions unless the Conduct line allows |
| **Win a contract** | The Lagos port tender | Spends PC on the Political term of the bid score (4.9.7), calls favors, pays kickbacks only if the Conduct line allows |

The **Political Director** is a character the player appoints: an executive, a Friend, or a hired lobbyist or political consultant (4.19). The Director spends from a **budget** (money per month and a PC share per jurisdiction) set by the player.

- **Conduct line**, as for delegated money management (3.18.3): **Clean** (legal actions only), **Grey** (dark money, shells for donations, revolving-door hires, legal threats), **Dark** (bribes, kickbacks, blackmail, psyops). Grey and Dark actions build exposure as usual.
- **Effectiveness**: LP bought by the Director are ×`(0.85 + Persuasion / 100)`; Dark actions use the Director's Intrigue for discovery rolls.
- **Misstep chance**: each month `max(1%, (20 - Director's Persuasion) × 1%)` **(T)** that the Director makes an unforced error: a gaffe (minor scandal), an over-spend (10% of the monthly budget wasted), or a wrong-side donation ("Backed the Loser" with one official).
- **Loyalty**: a Director who is the player's Rival has a 3% chance per month **(T)** of leaking the player's objectives to a rival (the rival learns one secret: the player's political objectives in that country).
- A Director can cover at most 3 countries **(T)**. A player active in more countries hires more Directors, one per group of countries.
- The Chief Strategy Officer task "Government relations" (1.8.2) still applies on top, for the company's home jurisdiction.

### 4.15.3 Alerts and auto-advance

Each alert type has a level: **Stop** (auto-advance halts and an event or panel opens), **Notify** (top bar badge), **Log** (event log only). Defaults **(T)**:

| Alert | Default |
|---|---|
| Bill with Stakes ≥ threshold enters Debate or reaches a pass roll | Stop |
| Investigation opens, moves to Subpoena, or reaches Charges | Stop |
| A scandal takes the Heat of the player character, one of their executives or a client to 40 or more | Stop |
| Seizure ladder step, sanctions tier change, coup or revolution stage in a country with the player's assets | Stop |
| Election night with the player character or a backed candidate on the ballot | Stop |
| Client indicted, flipped or defeated; favor refused | Notify |
| Whistleblower risk on an operation ≥ 5% per month | Notify |
| Political Director misstep | Notify |
| Poll moves of more than 3 points | Log |
| Protest or boycott targeting the player | Stop if Momentum ≥ 60, otherwise Notify |

### 4.15.4 Hot moments (hourly play)

Most politics resolves on the weekly and monthly calculations (4.1.3). These moments are played hour by hour, with auto-advance paused:

| Hot moment | Length | What the player does each hour |
|---|---|---|
| **Election night** (4.6.1) | 6 to 12 turns | Watch results by region; concede, claim victory, or fund a legal challenge if the margin is under 0.5% |
| **Coup night** (4.8.4) | 6 to 24 turns | Commit reserves, negotiate with generals, cut the internet |
| **Hearing** (below) | 4 to 6 turns | Choose an answer stance each round |
| **Crisis meeting** (bailout, seizure step 2 or 3, ISF conditions) | 2 to 4 turns | Negotiation rounds: offer, concede, threaten, walk out |
| **Council session** (corporate oligarchy, 4.5.10) and key junta council votes | 1 to 3 turns | Last-minute vote buying with PC, favors or money |
| **Protest standoff** (4.24.2) | 2 to 8 turns | Negotiate, wait, call police, call private security |

**Hearings.** A legislature committee summons the player character or one of their executives when: they are at Heat ≥ 50 with a major or criminal scandal about them in a liberal or managed democracy; an investigation of their company reaches Subpoena; or a hostile legislator spends 10 PC **(T)**. Refusing costs Favor -10 and Heat +15. A hearing has 4 to 6 rounds (one per hour). Each round the player picks a stance:

| Stance | Roll | Success | Failure |
|---|---|---|---|
| **Deflect** | Intrigue vs chair's Intrigue | Heat -5 | Heat +5; "evasive" headline |
| **Concede** (admit a small point) | Automatic | Heat -8; local Favor +2 with the PMC stratum | Investigation Evidence +3 |
| **Attack** (the chair, the press, a rival) | Persuasion vs chair's Persuasion | Heat -10; Clout -2 | Heat +15; a minor scandal |
| **Charm** | Persuasion vs chair's Persuasion | local Favor +3 in all strata; Heat -3 | Nothing |

Success chance per round = `clamp(50% + 3% × (skill difference), 10%, 90%)` **(T)**. A witness with Fame 60 or more and Favor 20 or more gets +10% on Charm; one with Favor -40 or below gets -10% on everything (these replace the nonexistent Media Darling and Scandal-Ridden traits). A critical failure (5% each round) is a viral clip: Heat +25 and Fame +10.

### 4.15.5 The weekly political brief

Every Monday at 07:00 local time of the player character's residence province, a one-page brief (like the morning brief, 3.13.6) lists: the five bills with the highest Stakes and their pass chance, investigations and exposure changes, scandals and Heat, elections in the next 8 weeks, client loyalty changes, and the Director's spend and results. It takes no character time to read. Clicking any line opens the relevant tab.

### 4.15.6 Pacing targets

| Largest company's rank (1.7.5) | Share of play time on politics **(T)** | Typical political actions per in-game month |
|---|---|---|
| No company yet | Under 5% | 0 to 2 (a donation, a campaign volunteer stint) |
| Venture | 5 to 10% | 1 to 4 (permits, a grant chain, Meet Official) |
| Company | 10 to 20% | 4 to 10, most run by the Director |
| Corporation | 15 to 25% | 10 to 40, nearly all run by Directors; the player handles alerts and hot moments |
| Megacorp and Conglomerate | 20 to 30% | Many; the player plays the big chains (coups, charters, Council sessions, international votes) |

---

## 4.16 Public standing: Fame, Favor and Clout

Batch 116 (Logan): every prestige-like measure merges into two. The old reputation score, Favorability, Elite Standing and Profile are gone as separate stats. Politics reads the two standing measures every character has ([1-corporate-core.md](1-corporate-core.md) 1.1):

- **Fame and Favor** (the Image pair): how the public sees you. **Fame** is how many people know you; **Favor** (-100 to +100) is how much they like you. Every public-facing effect in this file uses one of them.
- **Clout**: your reputation among the elite. It matters only to other elites: board members, executives, politicians, financiers and other Clout holders. Every elite-facing effect uses it.

**Favor** the Image score is not the same thing as **favors**, the tokens a client politician owes (4.7.4). Influence share is untouched by all of them: it stays rooted in assets (decided rule). They change political effects only. **Heat** (4.17.4) is a separate standing measure: how cancelled the character is, built from scandals that fade at different rates by type (Logan, batch 117).

### 4.16.1 How politics reads them

| Measure | Range | Read by politics | Meaning in politics |
|---|---|---|---|
| **Fame** | 0 to 100 | The character's own value | How well known you are. Scales how much Favor matters |
| **Favor** | -100 to +100 | The character's own value, plus a **local read** per country and stratum (4.16.2) | Whether ordinary people like you |
| **Clout** | 0 to 100 **(A)** | The character's own value | Whether the political and business class treats you as one of its own |

**Effective Favor** = `local Favor × Fame / 100`. An unknown character is neither loved nor hated, which is a strategy: the **grey eminence** keeps Fame low and works through clients.

### 4.16.2 Local Favor (weekly)

Local Favor is a read of the character's Favor in one country and stratum, not a separate stat: the character's Favor plus what that public sees locally **(A)**.

`Target local Favor(s) = 0.5 × Favor + 30 × MediaTone(s) + Employer(s) + Lobbying(s) + Philanthropy + Home - 0.5 × Heat` **(T)**, clamped to -100 to +100. The local read moves 10% of the way toward the target each week.

| Term | Value **(T)** |
|---|---|
| **MediaTone(s)** | `Σ outlets (audience share among stratum s × credibility / 100 × tone toward the character)`; tone is -1 to +1 (4.17.1) |
| **Employer(s)** | +5 if the character's companies employ ≥ 1% of the stratum's workers in the country, +10 at ≥ 5%; -10 for 12 months after layoffs of ≥ 1,000 people or ≥ 10% of the character's workforce in the country |
| **Lobbying(s)** | For each disclosed political action in the last 12 months (Lobby Bill under G2 Registered or Light Disclosure, Issue Campaign, disclosed donation over E/2): -2 if the stratum's largest bloc has stance - or -- on the lobbied position, +1 if + or ++. Capped at ±10 |
| **Philanthropy** | +1 per $1M × wealth index granted in the country in the last 12 months, capped at +15 (counts for all strata) |
| **Home** | +10 in the character's home country (2.5.6) |
| **Heat** | The character's Heat (4.17.4), capped at 60 |
| **Price anger** | -10 among all strata while the character is publicly linked to a commodity corner (3.7.6) or to price hikes in an essential industry (energy, housing) |

**Effects of Favor** (effective Favor, so Fame matters):

| Use | Effect **(T)** |
|---|---|
| The character as candidate | `Candidate += 0.01 × effective Favor(s)` in each stratum (so +0.3 at local Favor 50 and Fame 60) |
| Endorsement by the character | The endorsed candidate gets `+0.005 × effective Favor(s)`; a negative value is a "kiss of death" |
| Bills publicly linked to the character (they sponsored them, or their lobbying was disclosed) | Support `+0.1 × population-weighted effective Favor`, capped at ±5 |
| Boycotts | At local Favor ≤ -40 and Fame ≥ 50 in a stratum, the character's consumer-facing business units lose 2 productivity per boycotting stratum in the country while it lasts (brand appeal is gone, batch 75) |
| Protests | Local Favor ≤ -60 in a stratum with union Organization ≥ 40 (2.8.6): a protest targeting the character can start (4.24.2) |
| Populist targeting | 4.27.2 |

### 4.16.3 Clout from politics (monthly)

Politics moves the character's Clout (1.1). Gains and losses **(T)**:

| Source | Clout |
|---|---|
| National office won (the character's own) | +5 |
| Each client politician (4.7.4) | +1 a year, up to +20 in all |
| Galas and elite philanthropy | Up to +10 a year |
| International post (4.25) | +10 |
| "Backed the Loser" (4.6.6) | -15 while active, given back when it ends |
| Coup Plotter, Blacklisted or Currency Raider | -20 |
| Convictions | As 4.9.5 |

| Clout band **(A)** | Effects **(T)** |
|---|---|
| 0 to 24: **Pariah** | A -20 opinion push from each official on entering the band; cannot host galas; appointment score -10 |
| 25 to 49: **Outsider** | Appointment score -5 |
| 50 to 74: **Accepted** | None |
| 75 to 100: **Establishment** | Appointment score +5; Meet Official costs 0 PC once per week with any national official; AI rivals less likely to join coalitions against the character (4.27.4) |

The tension is deliberate: lobbying for tax cuts, buying politicians and hosting galas raise Clout and lower local Favor among the Permanent Underclass and PMC strata. A player who wants to run for office must balance both.

### 4.16.4 Fame from politics (weekly)

| Change | Value **(T)** |
|---|---|
| Floor by personal wealth tier (1.10.5) | Investor 0, Magnate 10, Mogul 20, Tycoon 35, Oligarch 50 |
| Controls a consumer-facing company among the 3 largest in its industry | Floor +10 |
| Scandal coverage | +Heat / 10 per week |
| Election campaign by the character | +10 |
| National office won | +10 |
| Gala, hearing appearance, interview | +2 each |
| Owned media running the character's face | +1 per week per 10% audience |
| Decay | -2 per month toward the floor |
| **Keep a Low Profile** (standing order) | Fame decay doubles; Philanthropy and media gains to local Favor halved; galas not allowed |

---

## 4.17 Media, narratives and scandals

4.4.5 sets how owned media shifts bloc clout, and 3.14.4 sets source reliability for market news. This section makes media a full political weapon: outlets with credibility, journalists as characters, and scandals that build Heat and can be fought.

### 4.17.1 Outlets

Every outlet of the media system ([16-media.md](16-media.md)): broadcast and publishing, social platforms and synthetic media, has, for politics:

| Stat | Range | Source **(T)** |
|---|---|---|
| **Audience share** | 0 to 100% per province and country, split by stratum | Reach ([16-media.md](16-media.md)); tabloids skew Permanent Underclass, major papers skew Glitterati and PMC, social platforms skew Permanent Underclass and young PMC |
| **Credibility** | 0 to 100 | Starts at the source tier of 3.14.4 (Wire 95, Major paper 85, Trade 70, Tabloid and TV 50, Social 30). -10 each time a planted or spiked story is exposed; -5 per editor resignation; +1 per month back toward its tier |
| **Editorial line** | Alignment -1 to +1 with each bloc | Set by the owner (4.4.5) |
| **Tone** | -1 to +1 toward each named character and company | Owned outlets: set by the owner. Other outlets: start at 0; -0.1 per week while covering a scandal of that character; +0.05 per month of access (interviews, exclusives); +0.02 per $1M × wealth index of yearly advertising placed with it by the character's companies (cap +0.3, "advertiser leverage"); drifts 10% per month toward 0 |
| **Editor** | Character | Integrity (as for agency heads, 4.9.2) decides whether they follow orders to spike or plant |

**Effect weight** of an outlet in any formula = audience share × credibility / 100. A tabloid with a huge audience but low credibility moves less than its audience suggests; a captured paper that is caught lying loses its power.

### 4.17.2 Editorial actions (owners)

| Action | Cost and time **(T)** | Effect | Risk |
|---|---|---|---|
| **Set line** | 4 weeks; audience -5% (4.4.5) | Bloc alignment changes | Editor with Integrity ≥ 70 resigns if the change is ≥ 1.0 on any bloc: credibility -5 |
| **Set tone** toward a holder | 2 weeks | Tone -1 to +1 | A tone of ±0.8 or more for 6 months: credibility -1 per month ("house organ") |
| **Endorse** a party or candidate | Instant | Media term (4.6.3) | Audience among opposing strata -2% |
| **Hit campaign** against a person or company | $ (0.02 × adults reached) per week | Target's MediaTone among the audience -0.3 per week of campaign (to -1) | 10% chance per week of a defamation suit if claims are false (4.21.2) |
| **Spike a story** | Instant | The outlet does not run a story (3.14.4: early, late or never) | Leak chance 10% per spiked story (+5% per Integrity point of the editor above 50 / 10): scandal "Spiked" (minor) and credibility -10 |
| **Plant a story** | Editor must comply (Integrity < 50) or the outlet must be friendly via a hook | Runs a story the player wrote | False story: 15% exposure chance per month; exposure is a scandal for the player and -10 credibility |
| **Hire a star journalist** | Salary $1M to $5M × wealth index per year | +3% audience; credibility +5 | They may refuse orders like an Honest editor |
| **Feed weighting** (social platforms only) | Free, hidden | Works like an ad campaign (+0.02 MediaBias, +0.15 Ads utility) without disclosure | Counts as a psyop for exposure (+5 with the Data Authority per month) and is a major scandal if found (daily psyop discovery roll, 2.5.7) |

**Buying a critic.** Buying an outlet that is hostile to you is legal, but on the change of control its star journalists and Integrity ≥ 70 editors leave (credibility -15, audience -10%) and they found or join a rival outlet that takes half the lost audience **(T)**.

**State media.** Under G3 State-Controlled, every outlet follows the government's line and tone; owners keep the revenue and audience influence (2.5.2) but not editorial control. Under low media freedom (4.2.1), exposés about the regime's friends are buried and exposés about its enemies are amplified; the Government attitude (4.27.2) decides which one the player is.

### 4.17.3 Journalists

Investigative journalists are characters (Intrigue, Persuasion, Honest or not, an outlet). Each country has 2 to 8 notable ones **(T)**, more in liberal democracies.

- Each month a journalist picks a **target**: the holder with the highest political or financial exposure in the country, weighted ×1.5 for characters whose largest company is Megacorp or Conglomerate rank and ×2 if a whistleblower contacted them (4.20.5).
- A journalist on the player's case multiplies the monthly exposé chance (4.10.3) by `1 + journalist's Intrigue / 20` **(T)** and raises revelation chances (4.17.4).
- **Options against a journalist**: grant access (tone +0.1, but the journalist learns one secret 20% of the time); hire them away (salary ×2, they refuse if Honest); sue for defamation (4.21.2); smear (Leak Scandal scheme on them); buy their outlet (above); surveil them or hack Techno-Capital they own (a hacking scheme, [17-hacking.md](17-hacking.md); a Grave offense if found); arrange an "accident" (Criminal; Heat +60 on the player if suspected, media freedom ×1.5 against it for 5 years).

### 4.17.4 Scandals and Heat

**Heat (Logan, batch 117)** is how **cancelled** a character is, 0 to 100 ([1-corporate-core.md](1-corporate-core.md) 1.1.0). It is a standing measure of the character, not one story's news cycle. Every scandal about the character adds to it, and each scandal's share wears off at the rate of its **type**. A company that is itself the subject of a scandal (a brand or product scandal, 4.10.3) carries its own Heat by the same rules, and half of that share also lands on its head **(A)**.

A **scandal** (minor, major or criminal, as in 4.6.3 and 4.10.3) has four parts:

- **Type**: what it is about, which sets how fast its Heat fades (table below).
- **Heat share**: what it adds to the target's Heat. A character's Heat is the sum of the shares of their scandals, capped at 100.
- **Memory**: the Scandal term in 4.6.3 (0.3, 0.8 or 1.5 utility, halving every 4 weeks). It halves as before, **except that it does not decay in any week that ends while an outlet still covers the story** **(T)**.
- **Truth**: true, partly true or false, hidden from the public.

**Scandal types (Logan, batch 117; values T)**:

| Type | Examples | Usual severity | Heat share halves every **(T)** |
|---|---|---|---|
| **Gaffe** | A bad quote, a rude post, a viral clip, a hearing slip | Minor | 2 weeks |
| **Personal** | An affair, a vice or addiction, lavish spending, a public outburst | Minor or major | 3 months |
| **Misconduct** | Layoffs handled cruelly, labor abuse, safety failures, price gouging, astroturf | Major | 6 months |
| **Corruption** | Bribes, kickbacks, hidden lobbying, buying officials | Major | 1 year |
| **Fraud** | Accounting fraud, insider trading, market manipulation, hidden owners | Major or criminal | 2 years |
| **Crime** | Violence, an "accident", organized crime ties, trafficking | Criminal | 3 years |

**Heat share, daily** **(T)**:

`Share(next day) = Share × 0.5^(1 / half-life in days) + Σ covering outlets (3 × audience share × credibility / 100) + 10 per new revelation`

- Starting share: minor 20, major 50, criminal 80.
- An outlet covers a scandal while its tone toward the target is ≤ 0, for 7 days, extended by 7 days per new revelation. Friendly and owned outlets do not cover unless told to.
- **Revelations**: true or partly true scandals get a revelation with 20% chance per week, 35% if a journalist is on the case or a whistleblower is involved **(T)**. False scandals get none; instead each week 15% chance the story is debunked (the share ×0.3 and the outlet's credibility -10).
- A share below 1 is dropped; the memory carries on.
- **Flat Heat changes** written elsewhere (a hearing round, "Heat +15", "Heat 30 if exposed") add to or take from the share of the scandal they concern; one with no scandal attached opens a new scandal of the fitting type, a gaffe by default **(A)**.

**Responses** (one per scandal per week; multipliers act on that scandal's share) **(T)**:

| Response | Effect | Risk |
|---|---|---|
| **Ride it out** | None | None |
| **Deny** | Share ×0.8 | If the story is true, each later revelation adds +20 instead of +10 and costs Favor -5 ("caught lying") |
| **Apologize** | Share ×0.5; each covering outlet's remaining days halved; revelation chance halved | Favor -5; Evidence +5 in any open investigation on the matter |
| **Counter-story** | Share ×0.7 | Needs an owned outlet or a psyop; 25% chance the plant is exposed: a new minor scandal and -10 credibility for the outlet |
| **Scapegoat** | Share ×0.6 | As 4.9.4: the executive turns Rival |
| **Legal threat** | Each covering outlet whose editor has Integrity < 50 stops with 40% chance | 15% chance of a backlash story: Heat +20 |
| **Sue for defamation** | 4.21.2 | Heat +10 at filing; civil discovery risk |
| **Philanthropy pivot** | Share ×0.8; Favor +3 | If Favor < -20: "washing" story, Heat +10 |

**Effects of Heat** (the character's total) **(T)**:

| Area | Effect |
|---|---|
| **Favor** | The local Favor term in 4.16.2 (-0.5 × Heat); Favor gains of any kind are halved while Heat ≥ 40 |
| **Clout dealings** | Elite characters' acceptance of deals, favors, invitations and bloc offers -1% per 2 Heat; Clout gains are halved while Heat ≥ 40; Clout -1 a month while Heat ≥ 60 (elites keep their distance) |
| **Board votes** | Votes for the character's nominees, proposals and own seat in board elections and proxy fights -1% per 5 Heat; at Heat ≥ 60 a board with a Rival majority may call a vote to remove the character as head (1.8) |
| **Politics** | Fame gain (4.16.4); hearings (4.15.4) at Heat ≥ 50; in liberal and managed democracies, politicians refuse public meetings, endorsements and disclosed donations from a character at Heat ≥ 50 unless a hook forces them; a client's Loyalty -1 a month while their patron is at Heat ≥ 60 |
| **Media coverage** | Every outlet's tone toward the character -0.1 per 25 Heat; outlets cover new scandals about the character 3 extra days while Heat ≥ 40 |
| **Markets** | A price drift for the character's listed companies of `-(Heat / 100)` % per trading day while an outlet covers one of their scandals and Heat ≥ 40 (on top of the one-time hit of 4.10.3) |

### 4.17.5 Narrative fights

When two holders push opposing stories about the same bill, election or person, the game runs a **narrative contest** weekly: each side's weight is `Σ outlets (audience × credibility / 100) × |tone|` plus ads and psyops in the Media term. The side with the higher weight gets the Media term in 4.6.3 and the MediaBias in 4.4.5 for its side; the loser's are halved for that week **(T)**. This is how a small but credible paper can beat a large tabloid, and why owning one trusted outlet matters more than owning several weak ones.

---

## 4.18 The player as a political actor

Batch 116: there are no dynasties, houses or family members. The player acts in politics through their own character, the companies and personal trusts they control, and the clients they back. Characters may have relatives as flavor, but relatives have no political role or mechanics.

### 4.18.1 Political careers

The player character can hold office (4.7.1) and run for it (4.7.2). Other characters, AI or not, rise through their own careers, driven by their traits (AI characters have no ambitions): Ambitious, Party School and Persuasion ≥ 12 make a career likely. The player backs them as **protégés**: funding, Party Standing and introductions, so that once elected with the player's money they become clients (4.7.4).

**Typical ladder** (liberal democracy) **(T)**:

| Step | Age | Time on step | What it gives |
|---|---|---|---|
| **Volunteer or student politics** | 16 to 22 | 2 to 4 years | Party Standing +10; one Befriend roll per year with a party official |
| **Staffer** (to a legislator or minister) | 21 to 28 | 2 to 4 years | Party Standing +15; +1 Persuasion per 2 years; the staffer learns the boss's bills 1 week early (no favor needed; trading on it is insider trading) |
| **National Legislator** | 30+ | 2+ terms | Office benefits (4.7.1); there are no city or regional offices to climb first (batch 121) |
| **Minister, Head of Government** | 40+ | Party and coalition decide | As 4.7.1 |

**Party Standing** (0 to 100, per character per party): +5 per year of membership, +10 per election won for the party, +1 per $ E/10 the character (personally or through companies they control) donated to the party in the last 4 years (cap +20), -20 if they voted against the party on a whipped bill, -30 on a scandal of major tier or worse. It adds `+ Party Standing / 10` to the nomination score of 4.7.2 **(T)** (this is a new term added to that formula).

**Protégés in office.** A protégé who wins office is a client (4.7.4) with starting Loyalty 60 **(T)**. A client with their own office, Fame and Clout can become a rival power base: favors called lower Loyalty as usual, and a client facing prison can flip (4.9.4). Offices the player character or their clients hold raise the player's Clout (4.16.3); there is no political house, renown or legacy.

### 4.18.2 Think tanks

A **think tank** is a non-profit company. Owned by a company it is a subsidiary; owned by a foundation (4.18.3) or a personal trust it is a plain holding.

- **Setup**: $5M × wealth index, 12 weeks. **Budget** B per year, set by the owner.
- **Credibility** (0 to 100, as for outlets and NGOs; the old think tank "Prestige" is renamed, batch 116): target = `15 × ln(B / ($1M × wealth index)) + 3 per fellow with Persuasion ≥ 15`, capped at 100; moves 2 points per month toward the target **(T)**. Examples: $10M × wealth index → 35; $30M → 51; $100M → 69. Credibility is ×0.8 while more than 50% of its funding is publicly known to come from one holder ("industry-funded").
- One **program** per country at a time:

| Program | Time **(T)** | Effect **(T)** |
|---|---|---|
| **Policy paper** on one law position | 6 months | Bills moving that law toward the position get `+Credibility / 10` support (cap +8) in the Campaign term for 24 months |
| **Model legislation** | 3 months | The next Commission a Bill on that law costs half PC |
| **Shift the debate** | 24 months; needs Credibility ≥ 50 and B ≥ M / 50 per year in that jurisdiction | Success chance = `Credibility × 0.6 %`, reduced by the Credibility of any opposing think tank running the same program. On success one chosen bloc's stance on one law position moves one step toward the think tank's view in that country for 10 years. At most one shift per bloc per law per decade |
| **Fellowships** | Ongoing | Place a client or a former official as a fellow ($300k × wealth index per year): counts as a favor repaid (+10 loyalty) and keeps their network active for Introductions |

Shift the debate is the slowest and strongest lever in the game: it changes what an ideology bloc wants, not just how loud it is.

### 4.18.3 Foundations and philanthropy

A **foundation** is a holder type (like a personal trust), founded by a character or a company. Assets given to it are irrevocable.

- **Foundation deed**: set at founding like trust rules: purpose (a cause or a place: a city, region or country), who appoints the board (default: the founder appoints a majority), and payout. Changing the deed needs two thirds of the board and costs the founder Clout -5 **(T)**.
- **Tax**: gifts to it reduce the E4 inheritance and gift tax base under F6 Opaque or Recognized; under Recognized and Transparent the foundation must grant 5% of assets per year **(T)**, or the shortfall is taxed at the E3 rate.
- **Control stakes**: a foundation can hold voting stakes in the founder's companies. Its votes follow the board. It counts in the founder's holder group for disclosure (as funds do, 3.18.4).
- **Grants** (the foundation's monthly spending):

| Program | Cost **(T)** | Effect **(T)** |
|---|---|---|
| **City philanthropy** | As sponsorship and charity (2.5.7) | Goodwill as 2.5.7, with 35% (not 25%) becoming permanent |
| **Named institution** (hospital, university wing, museum) | $50M to $500M × wealth index, one-off | Permanent Goodwill of +1 pp (small) to +3 pp (large) in the city (Metro or city province) that never decays; Clout +5; Fame +5 |
| **Scholarships** | $1M × wealth index per year per 10 scholars | Each year one scholar becomes a named character who starts as the founder's Friend, recruitable as an executive, staffer or candidate |
| **NGO grants** | Any | The NGO's tone toward the founder +0.1 per $1M × wealth index (cap +0.5); if the NGO is a watchdog, a co-option story has 10% chance per year (Heat 20) |
| **Disaster relief** | Any, after a disaster event | Local Favor +5 in the affected country per $10M × wealth index (cap +15) |

- **Risks**: grants that benefit the founder, their companies or their relatives are self-dealing: Tax Authority exposure +5 per $10M **(T)**. Philanthropy while Favor < -20 risks the "washing" scandal (2.5.7).

### 4.18.4 Party donorship and owning a party

**Donor share** in a party = the character's donations to the party (personally, through companies they control and all other channels) over the last 4 years / the party's total funding in that time.

| Donor share **(T)** | Status | Powers |
|---|---|---|
| ≥ 10% | **Major Donor** | A seat at the platform committee: once per year, set the party's platform stance on one law one step away from its bloc average (4.4.7) for 2 years. The party's member blocs whose stance differs lose 1 approval of the party |
| ≥ 25% | **Party Patron** | Nomination score +20 for up to 3 chosen candidates per election; in a leadership contest, the backed candidate gets +15 |
| ≥ 50%, and the character or a client leads the party | **Owned Party** | The party's platform follows the character on up to 3 laws; the party's legislators count as clients with Loyalty 50 (no favors needed for votes on those laws) |

**Costs and risks.** A donor share above 25% becomes public under G1 Capped or Unlimited Disclosed (always under an exposé): Fame +10, and the party's opponents get +0.2 utility in strata where the character's effective Favor is below 0 ("the party of [name]"). Under G1 Public Funding Only, donor share above 10% is impossible legally; doing it through shells is a Serious offense.

**Founding a party.** A character can found a party (8 weeks, $ M / 20 to launch, $ M / 10 per year to be competitive **(T)**) when either:

- a bloc with clout ≥ 5% has no party, or its party's stance is 2 or more steps away from one of its ++ wants: the bloc joins with chance 20% per quarter, more with Fund Ideology; or
- the character has Fame ≥ 60 and effective Favor ≥ 20 in at least one stratum: a **personal party**. It has no blocs, so its Ideology term is 0, but its Candidate term counts ×2 and the character's local Favor counts directly. Personal parties rise fast and fall with their leader's scandals. Founding one costs Clout -10 ("traitor to their class") if its platform attacks the Glitterati and Oligarchs.

In managed democracies, owning a licensed opposition party is allowed only with Government attitude Tolerated or better (4.27.2); otherwise the party is disqualified (4.6.7). In one-party states, the equivalent is backing a faction (4.8.2).

---

## 4.19 Lobbyists, fixers and political consultants

### 4.19.1 Political professionals as characters

| Role | Key skill | Hired as | Effect **(T)** |
|---|---|---|---|
| **Lobbyist** | Persuasion | Staff ($300k to $3M × wealth index per year) or through a firm | Can be the Political Director; LP from money ×`(1 + 1% per Persuasion point above 10)`, max +20%; runs Lobby Bill and Meet Official with their own time |
| **Campaign manager** | Persuasion | Per campaign ($100k to $2M × wealth index) | The Campaign term coefficient (0.8 in 4.6.3) becomes `0.8 × (0.85 + Persuasion / 100)` for that candidate |
| **Pollster** | Finance or Persuasion | Per poll | Internal poll noise ±1.5 (4.6.3), or ±1 with a pollster of skill ≥ 15 |
| **Spin doctor** (PR) | Persuasion | Staff | Scandal responses: Deny, Apologize and Counter-story multipliers improve by 0.1 (for example Apologize ×0.4) |
| **Fixer** | Intrigue | Staff, off the books | Runs deniable operations (4.20.4); holds **contacts** |
| **Former official** ("revolving door") | Persuasion | Staff or board seat | Keeps their network: a +20 opinion push with former colleagues; Introduction favors at no cost |

**Fixer contacts.** A fixer has a contact level (0 to 3) in each of: Police, Officials, Media, Crime, Hackers, Security **(T)**. Operations need a level: bribing a judge needs Officials 2; buying a cartel's smuggling route needs Crime 2; hiring a hacker crew ([17-hacking.md](17-hacking.md)) needs Hackers 1. Contacts rise 1 level per 2 years of work in a country, or at once when the fixer is recruited from that world (Street-Taught, former police, former intelligence). Fixers can be arrested: they roll Cracks (4.9.4) like subordinates, and a fixer who flips is worth +30 Evidence.

**Revolving door rules** by G2 **(T)**: Banned: hiring an official within 2 years of leaving office is treated as a bribe (exposure +10). Registered and Disclosed: 2-year cooling-off period, disclosed (Lobbying term of local Favor, 4.16.2). Light Disclosure: 1 year. Unregulated: none.

### 4.19.2 Lobbying, PR and consulting firms as businesses

Political services are part of the Professional services industry ([10-industry-economy.md](10-industry-economy.md)): a business unit there can sell **public affairs** (lobbying and PR) and **political consulting** (campaigns and polling).

- **Revenue**: retainers from AI clients, $0.5M to $10M × wealth index per client per year, by firm tier **(T)**.
- **Access**: the sum of the firm's staff networks. Firm tier by Access: **Boutique**, **Established**, **Top-tier**. Clients of the firm (including its owner) pay 10% / 20% / 30% less PC for Meet Official, Request Decision and Commission a Bill in the firm's home country **(T)**.
- **Intel**: the firm's owner learns each client's political objectives (one secret per client, 2.22.2).
- **Conflicts**: if the owner lobbies against a client's objective, the client leaves after the bill resolves and the owner's Clout -5; repeated conflicts (3 in a year) turn into a scandal (minor).
- **Hiring a firm** (rather than owning one): the existing option in 4.10.1 (Lobby Bill at +20% money cost) uses an Established firm; Top-tier firms charge +35% but their LP count ×1.1 **(T)**.

---

## 4.20 Corruption end to end

4.2.3 sets corruption levels, 4.9.7 kickbacks and 4.10.4 bribes. This section follows the money from where it is earned to where it is spent, and who can tell.

### 4.20.1 Clean and dirty money

Every holder's cash is split into **clean** and **dirty** money. Dirty money comes from:

| Source | Becomes dirty |
|---|---|
| Hidden income of Front Companies (1.7.4) | All of it |
| Black market business units ([10-industry-economy.md](10-industry-economy.md)), Freeport trades (3.2.5) | All proceeds |
| Bribes and kickbacks received (characters who are officials) | All |
| Sanctions evasion profits | All |
| Payments from organized crime (4.22) | All |

**Spending dirty money**:

- On cash-friendly uses (bribes, payments to organized crime, fixers, Freeport, smuggling, hush money, cash payments to guards): no extra exposure. Bribes paid with dirty money leave no money trail: if the bribe is later investigated, Evidence from the payment is halved **(T)**.
- On visible assets (stakes, real estate, jets, company capital, donations): **unexplained wealth**: +1 Financial Police exposure per $1M with the country where the asset is booked, and with the holder's home country under F5 Open Registry or Standard **(T)**.

**Paying bribes with clean money** needs a cover: a consulting contract, an invoice through a shell, a job for a relative. Without a cover, exposure from the bribe is ×1.5 **(T)**.

### 4.20.2 Laundering

Laundering turns dirty money into clean money at a fee. Each method has a capacity and leaves a **trace** **(T)**.

| Method | Needs | Fee | Speed | Capacity | Trace left |
|---|---|---|---|---|---|
| **Cash business** | A Front Company running a cash-heavy business unit (Retail, Fast food, Gambling) | 10% | Monthly | Up to 30% of that unit's legit revenue per month | 50% |
| **Real estate** | Buy and resell province pool shares (2.16); under F5 Open Registry the owner is visible | 5% plus normal transaction costs | 4 to 12 weeks per deal | Deal size | 40% (60% under Open Registry) |
| **Trade misinvoicing** | A trading or logistics company with cross-border trade | 3% | Monthly | Up to 10% of the company's cross-border trade value | 40%; also +1 Tax Authority exposure per $3M |
| **Shell layering** | Shell Companies in F5 Secrecy or Haven jurisdictions | 4% per layer | 2 weeks per layer | Unlimited | 50% per layer (1 layer 50%, 2 layers 25%, 3 layers 12.5%) |
| **Art and collectibles** | A freeport warehouse account | 15% | 2 to 6 months | Lumpy (one artwork at a time) | 30% |

Crypto mixing is gone: crypto lives only in the phone tab ([9-gambling.md](9-gambling.md)) and is no laundering route (batch 116). The own-bank route is cut too (Logan, batch 117). Methods stack: a shell layer after a real estate deal multiplies the traces (40% × 50% = 20%). The shells and companies used keep their own exposure per their existing rules (1.7.4, 4.9.3).

**Trace and Evidence.** When an investigation touching the dirty source reaches Discovery, every laundered sum adds Evidence `5 per $10M × trace` **(T)**. Unlaundered money spent on visible assets counts with trace 100%. Laundering for others (for a cartel or another character) earns 10% to 20% fees and is a Criminal-tier offense (4.9.5).

### 4.20.3 The bribe chain

| Step | Time | Mechanics **(T)** |
|---|---|---|
| **1. Approach** | Meet Official (4.10.1) | Required. A +10 opinion push |
| **2. Sound out** | 2 ticks in person, Intrigue roll vs the official's Intrigue | Success reveals the official's Integrity band (low, medium, high) and Greedy or Honest traits. Failure: the official is wary; acceptance -10% for 6 months |
| **3. Offer** | Instant | Acceptance chance as 4.10.4. The payment route below modifies it |
| **4. Payment** | Route below | |
| **5. Delivery** | The vote, decision or favor | An official who accepted is **bought**: the briber gains a weak hook (usable once for Blackmail), and the official gains one over the briber. If either is investigated later, the other is a Cracks candidate |

| Payment route | Acceptance modifier | Exposure of the bribe |
|---|---|---|
| Cash (dirty money) | +10% | ×1.0, Evidence from payment halved |
| Consulting contract through a shell | 0% | ×0.8 |
| Job, board seat or contract for a relative | -5% (Honest -15%) | ×0.7; counts as "patronage" in the press |
| Gift (art, use of the jet or yacht, holiday) | -10% | ×0.6; a minor scandal if exposed |
| Campaign donation above the G1 cap through straw donors | 0% | ×0.8, plus Campaign Finance offense |
| Offshore account in a haven | +5% | ×0.5 under F5 Haven, ×1.0 otherwise |

**Kickbacks** on contracts (4.9.7) follow the same routes: paid as a subcontract to a company linked to the official, exposure ×0.75; as cash, ×1.0; as a direct transfer, ×1.5 **(T)**.

### 4.20.4 Plausible deniability

Every illegal operation has a **principal** (the character who ordered it) and a chain of **cutouts** between the principal and the act: a fixer, a lawyer, a nominee shell director, a personal aide.

- **Attachment**: when charges are brought for the operation, the chance that the principal is also charged personally = `0.6 ^ cutouts` **(T)**: 0 cutouts 100%, 1 cutout 60%, 2 cutouts 36%, 3 cutouts 22%. Companies used are charged regardless.
- **Cost of a cutout**: each one is a character who knows (a whistleblower candidate, 4.20.5) and a Cracks candidate (4.9.4). A fixer who flips cancels all cutouts above them.
- **"Make it go away"** (a vague order, CK3's "Will no one rid me"): adds one cutout of deniability for free, but the executor chooses the method. 20% chance they escalate one step further than the player would (a threat becomes violence, a leak becomes a hack) **(T)**, and the player learns what happened only afterwards.
- The principal can never be fully clean: a principal with 0 cutouts who is also the payer of a bribe adds the full Evidence to their own name.

### 4.20.5 Whistleblowers

Every illegal operation (front company, laundering chain, bribe ring, sanctions evasion, self-dealing, illegal surveillance) has **knowers**: the cutouts, plus 1 knower per $10M of yearly flow through the operation, minimum 2 **(T)** (accountants, drivers, junior staff; generated as characters when needed).

**Monthly whistle chance per knower** = `1% × opinion factor × trait factor × (0.5 + media freedom) × bounty factor` **(T)**

- Trait factor: Honest ×3, Compassionate ×1.5 if the operation harms people, Greedy ×0.5 while being paid hush money, Deceitful ×0.5.
- Bounty factor: ×1.5 for securities and tax offenses under F4 Strict or Draconian (whistleblower rewards).
- Opinion factor is a read of the knower's tag toward the operation's principal (1.1.4): Friend ×0.5, Neutral ×1, Rival ×1.5, Nemesis ×2. Anonymous staff who never met the principal read as Neutral, as Friend if the principal's Favor is 50 or more, and as Rival if it is -50 or less **(A)**.

**Responses**:

| Response | Effect **(T)** |
|---|---|
| **Hush money** (an NDA bonus of 1 to 3 years' salary) | Chance ×0.5 for 2 years |
| **Promote or transfer** | A +20 opinion push; transfer moves them away from the evidence (the knower count stays) |
| **Fire** | They stop being a knower after 3 months, but their chance ×3 during those months, and 30% go straight to a journalist |
| **Discredit** (Leak Scandal on them) | If they blow, the exposure gain is halved |
| **Sue under the NDA** | A civil suit (4.21.2); it works in courts with judicial independence < 0.5; elsewhere Heat +10 |
| **Arrange an "accident"** | Criminal. If discovered, Heat +60 and an instant inquiry |

**When a whistle blows**: the existing effects apply (exposure +20 and an instant inquiry, 4.9.3), plus a major scandal (Heat 50) if they went to the press, and the inquiry starts with Evidence +10 for every document they took (1 to 3) **(T)**.

### 4.20.6 Anti-corruption drives

A government launches an **Anti-Corruption Drive** when: a new government is formed by parties that campaigned on corruption; an ISF program demands it (4.25); a corruption scandal takes a character's Heat to 80; or a Reformist faction wins a party congress (4.8.2). For 24 months **(T)**: Financial Police capacity +1 and Zeal +0.2; the country's corruption target falls by 10; officials who were bought (4.20.3) have a 10% chance each per quarter of being arrested and becoming Cracks candidates against whoever bought them. A drive in a managed democracy or one-party state is selective: it targets holders with Government attitude Watched or Targeted (4.27.2) at ×2 and Favored holders at ×0.25.

---

## 4.21 Courts and litigation

4.9.4 covers criminal trials brought by agencies. This section adds the court system itself, judges as characters, and civil lawsuits between holders.

### 4.21.1 Court structure

| Level | Where | Judges | Hears |
|---|---|---|---|
| **Trial court** | Each country, with benches sitting in its larger cities (national courts; cities have no government) | 1 judge drawn at random from the court's pool of 3 to 12 **(T)** | Civil suits, criminal trials, injunctions |
| **Appeals court** | Each country | Panel of 3 | Appeals from trial courts |
| **Supreme or constitutional court** | Country | 5 to 15 | Final appeals; challenges to laws (4.5.11) |
| **International arbitration** | Outside any country (4.25) | Panel of 3 chosen by the parties | Investment disputes (4.9.9), contract disputes with arbitration clauses |
| **Zone arbitration** | Corporate zones (4.12.4) | Appointed by the zone | Everything inside the zone |

**Judges** are characters with: **Integrity** (as agency heads, 4.9.2), **Leaning** (Business, Neutral, State or Labor; a bias of ±10% in cases between those sides), **Ideology** (an aligned bloc, used for law challenges), and their traits (an Ambitious judge wants high-profile rulings and promotion). Judges are appointed by the head of government (and confirmed by the legislature in liberal democracies, a support vote with threshold 0 **(T)**); some countries elect trial judges (data flag). Appointments use 4.7.3, so a player can push their candidates.

**Court congestion** (country data, ×0.5 to ×3) multiplies all durations below.

### 4.21.2 Civil lawsuits

| Suit type | Typical trigger | Filing cost **(T)** | Duration **(T)** | Remedy if won |
|---|---|---|---|---|
| **Breach of contract** | A breached commercial contract | $250k × wealth index | 6 to 18 months | Damages: the claimed loss × 0.5 to 1.0; or specific performance |
| **Intellectual property and trade secrets** | Corporate espionage discovered (1.1.8), a copied product | $1M × wealth index | 12 to 36 months | Damages up to 2 years of the infringing product's profit; injunction stopping its sale |
| **Defamation** | A hit campaign or exposé | $250k × wealth index | 6 to 24 months | Damages $1M to $50M × wealth index; retraction (the story's Heat ×0.3 and the outlet's credibility -10) |
| **Shareholder suit** (derivative or class action) | Self-dealing, a fund loss (3.18.5), a takeover defense, a failed IPO | $1M × wealth index (paid by plaintiff firms on contingency) | 12 to 36 months | Damages paid by the company or its directors; board members' Clout -5 |
| **Injunction** | To stop a takeover, a construction, a sale, a strike | $500k × wealth index plus a bond of 5% of the claimed harm | Hearing in 1 to 4 weeks | A temporary block until trial |
| **Holdout and asset seizure** | A defaulted government (3.6.7) | $5M | 2 to 6 years | Seizure of the government's assets abroad |

**Win chance** **(T)**:

`P(plaintiff wins) = clamp(50% + 4% × Merit + 2% × (plaintiff counsel score - defendant counsel score) + Leaning + Political, 5%, 95%)`

- **Merit** (-10 to +10) comes from the facts in the event state: a proven breach +6, a true story in a defamation case -8, a discovered espionage scheme +8.
- **Counsel score** = General Counsel skill (the higher of Intrigue and Persuasion) + 5 × outside counsel tier (1 to 3, costs as 4.9.4).
- **Leaning**: ±10% if the judge's Leaning favors one side (Business favors companies over the state and over labor plaintiffs).
- **Political** = `(1 - judicial independence) × 30%` toward the side the executive favors, if it cares (a party with Government attitude Favored or Targeted, 4.27.2).

**Appeals**: either side can appeal once to each higher level. Reversal chance per level = `20% + 2% × counsel score difference + 30% × judicial independence if the lower ruling followed Political rather than Merit` **(T)**. Each level takes 6 to 18 months.

**Settlement**: offered by either side at any time. AI parties accept when the offer beats their expected value (win chance × remedy - remaining legal costs) by 10% **(T)**.

**Civil discovery**: during a trial each side sees the other's documents. Each month of trial, 10% chance **(T)** that discovery turns up evidence of an unrelated offense: the other side's exposure +10 with the relevant agency, and you learn one secret about them (2.22.2). Suing someone with secrets is dangerous; so is being sued.

### 4.21.3 Litigation as a weapon

| Tactic | How **(T)** | Counter |
|---|---|---|
| **Injunction blitz** | File injunctions against a rival's takeover, plant or permit; a granted injunction (chance = `30% + 3% × Merit + Leaning`) freezes it until trial | Post a counter-bond, appeal (4 weeks), settle |
| **Forum shopping** | File in the court most friendly to you, among the trial benches of the countries where the defendant has assets: the player picks the court and sees its judges' Leanings | Move to dismiss for forum (50% in liberal democracies) |
| **War of attrition** | Sue a smaller defendant: each month the defendant pays counsel; if their cash is below 10 × monthly legal cost, they settle with 40% chance per month | Anti-SLAPP laws (country flag): suits against journalists and activists with Merit ≤ 0 are dismissed in 8 weeks, and the plaintiff pays costs and suffers Heat +15 |
| **Discovery fishing** | Sue to get civil discovery on a rival | Exposes your documents too |
| **Patent thicket** | Owning many patents in an industry adds +2 Merit per 10 points of productivity lead over the defendant's unit in that industry in IP suits **(T)** | Cross-licensing settlement |
| **Countersuit** | Answer any suit with your own | Doubles both legal bills |

Frivolous suits (Merit ≤ -5) cost the plaintiff Clout -5 when lost.

---

## 4.22 Law enforcement and organized crime

### 4.22.1 Police and crime

Each country has one **national police** force led by a national police chief, appointed by the Interior Minister (4.7.3) **(A)**. There is no city or regional police (batch 121); the force's strength and integrity are read per province.

| Stat | Range | Source **(T)** |
|---|---|---|
| **Police strength** | 0 to 100 | Province data (default 50); S2 Militarized +15, Community -10; -0.5 per point of local corruption above 50; S2 Privatized replaces it in contracted provinces with the contractor's Security Strength (4.23.2) |
| **Police integrity** | 0 to 100 | `100 - local corruption`, ±10 from the chief's traits (Honest +10, Greedy -10) |
| **Crime** | 0 to 100 per province | Monthly, below |

`Crime = 10 + 0.4 × average unrest + 2 × max(0, unemployment% - 5) + 0.3 × Σ OCG strength × OCG Control in the province / 100 - 0.2 × police strength`, then ×1.10 under S2 Community and ×0.85 under Militarized (4.5.7) **(T)**.

| Crime effect | Value **(T)** |
|---|---|
| Theft and losses | `Crime / 20` % of the output value of business units operating in the province (0 to 5%), cut by 75% for units whose owner's Security Strength in the province (4.23.2) is at least the strongest OCG's local strength |
| Flight of the well-off | PMC and Glitterati migration out of the province +0.1% per year per 10 points of Crime above 40 (2.17.1) |
| Residential land value | -0.3% per year per point of Crime above 40 |
| Kidnap risk on arrival | ×2 in provinces with Crime ≥ 60 (2.21.8) |

### 4.22.2 Organized crime groups

**Organized crime groups (OCGs)** are AI actors, like companies and rival characters. Each has a **leader** (a character, usually high Intrigue, often Ruthless), **Strength** (0 to 100, nationally), **Control** (0 to 100) per province where it operates, a war chest, ties (hooks and bribes on police, officials and judges), and business lines. They are holders: they own front companies and real estate, which count toward influence like anyone's assets but show as "Undisclosed holder" unless the viewer has learned that secret through the intel screen (2.22.2). Their money is the main funder of the Sovereigntists (counted in `Money_g`, 4.4.5).

**Local strength** of an OCG in a province = `Strength × Control / 100`.

| Type | Typical cities at start | Business lines | Violence | Political style |
|---|---|---|---|---|
| **Cartel** | Mexico City, Medellín, São Paulo, Caribbean routes | Drugs, smuggling, fuel theft, extortion, people smuggling | High | Buys police and officials; kills candidates and journalists in high-corruption countries |
| **Syndicate** (triad style) | Hong Kong, Ho Chi Minh City, Jakarta, diaspora neighbourhoods of major Metros | Laundering, gambling, counterfeits, real estate, data | Medium | Long relationships, fronts, quiet partnerships with business |
| **Mafia** | Italy (Milan, Rome), New York, Moscow, Istanbul | Construction, waste, ports, unions, public contracts | Medium | Infiltrates contracts and unions; delivers votes in constituencies |
| **Street gang** | Any province with a large slum share | Drugs, theft, protection in slums and Residential pools | Medium to high, local | Intimidation and turnout in constituencies |
| **Hacker crew** | Online; based in Commerce-heavy cities with tech business units and low surveillance | Ransomware, data theft, black-market data, hacking for hire ([17-hacking.md](17-hacking.md)) | Low physical | Leaks and doxxing; works for anyone who pays |
| **Militia** | Weak and failed states (Lagos edges, Kolwezi-Lubumbashi; rural provinces such as the Sahel and Somalia) | Checkpoints, resource smuggling, protection | Very high | Is the de facto power in failed-state provinces (an OCG, not a government, 4.3.4) |

OCGs fight each other over provinces (**gang wars**: Crime +20 in the province, business unit output there -5%, 1% chance per month per business unit of collateral damage) and grow when they win. Their monthly AI: expand into the weakest-policed adjacent province, launder through fronts, buy officials when corruption ≥ 40, retaliate when hit.

### 4.22.3 How OCGs meet companies

| Interaction | Trigger | Rules **(T)** |
|---|---|---|
| **Protection demand** | A business unit with assets in a province with OCG Control ≥ 30 | Event *Insurance Salesmen*: pay 0.5% to 2% of the unit's revenue per year. Refusing: monthly **incident** chance = `Control / 5` % (theft, arson, a beaten manager: one week of output lost, unrest +2 among its workers), ×0.25 if the owner's Security Strength in the province is at least the OCG's local strength, ×0.1 at twice. Paying is not a crime in most countries, but paying with clean money booked as "consulting" adds Financial Police exposure +1 per month (Italy and Mexico style laws: +3) |
| **Infiltration** | Construction, waste, port or trucking contracts in a city where a Mafia or Cartel has Control ≥ 40 | OCG-linked subcontractors offer 10% lower costs; accepting adds Financial Police exposure +2 per month and makes the OCG a knower (4.20.5) of the project |
| **A favor for the plaza** | After 6 months of paying protection, 10% per month | The OCG asks to move goods through the owner's trucks, warehouses or ships. Accept: the owner earns dirty money (0.5% to 3% of the unit's revenue per month), exposure +3 per month, and the OCG holds a hook. Refuse: the protection price doubles or an incident fires |
| **Hire services** | Fixer with Crime 2 (4.19.1) | Smuggling (bypass tariffs, quotas or sanctions; fee 15% to 30% of cargo value; seizure risk 5% per shipment); laundering (fee 15%; trace 30%); muscle (+20% success on intimidation and Blackmail; Criminal tier if traced); hacking (+15% hacking scheme success, [17-hacking.md](17-hacking.md); $250k to $2M) |
| **Silent partnership** | Fixer with Crime 3 | Invest dirty money in an OCG venture: 20% to 40% yearly return in dirty money; the OCG holds a hook; Criminal tier if exposed |
| **Inform** | Any | Tip the police: the OCG's Strength -5 and a cooperation credit with the police (one investigation step on the informer delayed 4 weeks); the OCG learns who talked with chance `1 - police integrity / 100`, then retaliates (50%) |
| **Request a crackdown** | Request Decision to the Interior Minister (10 PC, 4.10.1) | Success chance = `40% + 0.5% × (police strength - OCG Strength)`; success: OCG Control -15 in the target provinces and Strength -10. Leak and retaliation as Inform |

The player can never become an OCG. It can run front companies (1.7.4), partner with OCGs, and hire them: the grounded version of a cyberpunk underworld.

### 4.22.4 OCGs and the state

- **Bought police**: an OCG with ties to the police in a province (or to the police chief, for the whole country) cuts Request a Crackdown success by 20 points there and learns of every crackdown request.
- **Captured state**: when OCGs' combined national Strength is 60 or more and corruption is 70 or more, the country is flagged Captured: the Sovereigntists gain Office clout +0.08 (4.4.4); candidates who campaign against crime have a 10% chance per campaign of an attack event; national crackdowns have half the success chance **(T)**.
- **War on crime**: a government decision when Crime ≥ 50 in the core province of the largest city and the Chuds have clout ≥ 15%: OCG Strength -5 per month for 12 months, unrest +3 among slum residents, stability -1, and relation -5 with liberal democracies if S2 is Militarized and T4 is Mass Surveillance or Social Credit (human rights pressure). OCGs answer with violence: Crime +10 for the first 6 months.
- **Elections**: OCGs fund candidates who leave them alone (Money in the Campaign term), and in Captured countries they can deliver or suppress turnout in constituencies they control (±5 points).

---

## 4.23 Private security

Companies and characters pay for their own security: guards, bodyguards, drones and cyber defense. Security is a monthly cost paid by whoever deploys it, in the province where it is placed or with the character it protects. No private force may hold territory or fight wars.

### 4.23.1 Security spending

Security is bought as staff and services, not as a business: there is no security industry ([10-industry-economy.md](10-industry-economy.md)).

**The Spymaster runs it (Logan, batch 75).** Security is administered by the **Spymaster of each institution you control** (1.1.8.2): the Head of Security seat of a company, or the personal fixer for the character's household. The Spymaster's Intrigue scales the Strength of every unit they run (+2% per point above 10) and the cyber defense they run (17.5) **(T)**.

**More institutions, more bonuses (Logan).** An institution here is anything the player really controls (1.3.1): a company, a subsidiary or shell, a party or think tank (4.18), or an office held. Each extra controlled institution with its own Spymaster adds a **network bonus** to all of them **(T)**:
- +5% Security Strength per extra institution, up to +25%;
- +1 cyber defense (17.5) per extra institution, up to +5;
- shared intel: a threat or hack one Spymaster detects warns the others.

The bonus only counts institutions whose Spymaster is not the player's Rival; a hooked or Friend Spymaster counts in full **(A)**.

### 4.23.2 Units and Security Strength

**Security Strength** is a single scale used against OCGs (4.22), rioters and protesters (4.24), standoffs with national forces (4.12.5), and kidnap or attack risks (2.21.8). A holder's Security Strength in a province is the sum of its units there.

| Unit | Built from | Cost per month **(T)** | Strength **(T)** | Needs |
|---|---|---|---|---|
| **Guard detail** (20 guards) | 20 guard-months | `20 × $6,500 × wage index` | 2 | None |
| **Armed response team** (12 armed guards, vehicles) | 40 guard-months | `40 × $6,500 × wage index` | 5 | None |
| **Drone wing** | 5 military drones per month plus operators | $1M | 20 | Military drones ([6-technocapital.md](6-technocapital.md)) |
| **Cyber defense team** | Security or IT staff | $300k × wage index | 0; hacking success against the holder -30% ([17-hacking.md](17-hacking.md), 4.26) | None |

National forces are measured on the same scale for standoffs: `Police strength × 2` for the police in a province, `RS × MSI / 2` for the national military (4.8.1) **(T)**.

### 4.23.3 Uses

| Use | Who | Units **(T)** | Notes |
|---|---|---|---|
| Business security | Companies in high-crime or failed-state provinces | Guard details and response teams | Cuts theft and protection incidents (4.22) |
| Executive protection | Characters | 1 to 3 armed response teams | Kidnap risk ÷4 (2.21.8) |

### 4.23.4 Rules of engagement and incidents

The owner sets each deployment's **rules of engagement**: **Restrained** (Strength ×0.75), **Standard** (×1.0), **Aggressive** (×1.5) **(T)**.

Monthly **incident** chance per deployment in a province with unrest ≥ 40, a war, or active OCG conflict = `1% × units deployed × ROE factor (0.5, 1, 2)` **(T)**. An incident is civilian harm: a major scandal (criminal if Aggressive), local Favor -10 in the host country, an investigation in the owner's home country (20% in liberal democracies) and relation -5 between home and host. An Aggressive massacre can bring an International Criminal Tribunal referral (4.25).

---

## 4.24 Civil society: NGOs, activists, unions and protests

### 4.24.1 Actors

| Actor | What it is | Stats | What it does to a player |
|---|---|---|---|
| **NGO** | Watchdog, environmental, labor rights, digital rights, human rights, or charity | Credibility (0 to 100), budget, reach per country, a leader character, aligned bloc | Below |
| **Activist** | A character with high Persuasion, often Honest or Compassionate, sometimes young and online | Fame, followers (audience share of their channels) | Starts protests, joins hearings, sues |
| **Union federation** | National body of the unions of 2.8.6 | Leader character; Organization average | Endorses parties, calls political strikes, funds the Communists |
| **Professional and business associations** | Chambers of commerce, bar associations, industry lobbies | Membership dues | AI lobbying on behalf of a sector; a character can lead one (Clout +5) |
| **Religious organizations** | Churches, mosques, temples, faith charities | Reach | Mobilize the Chuds; moral campaigns against human enhancement, AI, casinos |
| **Online movements** | Spontaneous swarms from the Permanent Underclass and young PMC | Momentum only | Fast protests and boycotts that fade fast |

**NGO effects** **(T)**:

| NGO type | Effect |
|---|---|
| **Watchdog** (anti-corruption, transparency) | Exposé chance ×1.2 on characters with any exposure ≥ 30 in the country; a complaint opens an inquiry with 10% chance per quarter when exposure ≥ 50 |
| **Environmental** | Disposition -5 (4.3.5) on decisions for polluting businesses in provinces where it is active; files injunctions (4.21.3) against new heavy-industry capacity |
| **Labor rights** | Union Organization +1 per month in the targeted company's business units |
| **Digital rights** | Data Authority complaints (exposure +5); lobbies T2 and T3 toward strict positions |
| **Human rights** | +5 points to sanctions imposition chances (4.11.4) after abuses; drives investigations of security incidents (4.23.4) |
| **Charity and service** | Partner for philanthropy: Goodwill ×1.1 when a character's grants go through it |

**Dealing with NGOs**: **Fund** (tone toward the funder +0.1 per $1M × wealth index, cap +0.5; a watchdog that takes money loses 20 credibility if the funding becomes public); **Engage** (sign a pledge: compliance cost 0.5% to 2% of revenue in the sector, local Favor +5 among the PMC stratum and the NGO's strata); **Fight** (sue, Leak Scandal on the leader, a counter-NGO funded by the player, which is astroturf: Heat 30 if exposed). Managed democracies and one-party states can label foreign-funded NGOs "foreign agents" (a government decision): the NGO closes and its funders' exposure +10 with the Financial Police there.

### 4.24.2 Protests

A **protest** has a cause (a law, a company, a scandal, election fraud, prices), a target (a government, a company or a character), organizers, and **Momentum** (0 to 100). It starts at Momentum 20 from: an Angry bloc (4.4.6), unrest ≥ 40 (2.8.5), visible fraud (4.6.7), a character (a government's leader included) at Heat ≥ 60, local Favor ≤ -60 (4.16.2), or a funded organizer.

**Daily Momentum change** **(T)**:

`ΔM = (local unrest - 40) / 20 + Organizers + 5 × Coverage - 2 - Concessions - Repression`

- **Organizers**: union federation +2 (if Organization ≥ 40), NGO +1, Angry bloc +2, activist with Fame ≥ 50 +1, online movement +1 (for its first 7 days only).
- **Coverage**: the share of the local audience (weighted by credibility) whose outlets cover the protest sympathetically.
- **Size** = Momentum × 0.1% of the local adults (at 100, one adult in ten is in the street).

| Momentum | Effects **(T)** |
|---|---|
| 40 to 59 | Commercial pool retail in the core province closed on protest days; local output -3%; meetings there take +1 tick |
| 60 to 79 | Local output -8%; Request Decisions about the province stall; Fame +2 per week for the target |
| 80+ for 7 days | **Breakthrough**: a government target must answer (a bill toward the protesters' demand gets Crisis +20 support for 3 months, or a resignation event for a minister); a company or character target faces a boycott (its consumer-facing business units lose 5 productivity for 3 to 12 months **(T)**; brand appeal is gone, batch 75) and local Favor -10 |

**Answers**: **Concede** (meet the demand: Concessions = Momentum, the protest ends); **Negotiate** (Persuasion vs the lead organizer: success gives Concessions 5 per day for a week); **Wait** (fatigue does the work, slowly); **Police** (Repression = 20 × protest suppression, which is ×1.5 under Militarized; 30% chance of a **martyr** event: Momentum +30 and new protests at Momentum 30 in the country's 2 largest cities); **Private security** (Repression = 10 per 20 Security Strength deployed, plus all the effects of a security crackdown in 2.8.6: Favor -15, unrest +10, investigation 20% in liberal democracies). A protest ends below Momentum 10.

Protests feed unrest (+0.1 per Momentum point above 40 in the place per week) and therefore revolution pressure (4.8.5).

### 4.24.3 Political strikes and astroturf

- **Political strikes**: a union federation can call a strike against a law or a government (not an employer). It uses the strike rules of 2.8.6 across every unionized business unit in the country that joins (chance = Organization / 100 per unit). A general strike is the Uprising step of 4.8.5.
- **Seed a movement**: the player can fund a protest of their own (against a rival's plant, for a law), costing `$0.01 × local adults` per week for an organizer that adds +2 Momentum per day. It is an astroturf campaign: exposure as 4.10.1 (+5 per start), and if exposed a major scandal for the player and the end of the protest.

---

## 4.25 International organizations

Fictional names, real functions. Players never join them; they lobby the governments that sit in them, and the player character can be appointed to their posts.

| Organization | Stand-in for | Members and votes | Powers **(T)** | How a player engages |
|---|---|---|---|---|
| **Assembly of Nations (AN)** with its **Security Council** | UN | Every country; Security Council of 5 permanent members with a veto and 10 rotating | Council resolutions: global sanctions (each member applies them with 90% chance, or takes relation -10 with the sponsors); peacekeeping missions (a war's intensity drops one step after 3 months; mission logistics and security contracts); recognition of new polities | Lobby Council members' governments (Improve Relations-style action: 20 PC in a member capital shifts its vote chance by 10 points) |
| **International Stabilization Fund (ISF)** | IMF | Votes weighted by GDP quota | Emergency loans to governments in currency crises and defaults (3.6.7, 3.8.7), with conditions (below) | Lobby the large-quota governments; holders of a country's bonds gain when a program is approved |
| **World Trade Council (WTC)** | WTO | Most countries | Rules on trade disputes: a complaint against a tariff or subsidy takes 12 to 36 months; a ruling authorizes retaliation tariffs of the same size | A holder hurt by a foreign tariff can ask its home government to file (30 PC national) |
| **Global Development Bank (GDB)** | World Bank and regional development banks | Votes weighted by GDP quota | Infrastructure loans to developing countries, tendered openly as contracts (4.9.7) with the capability weight raised to 40 and the political weight cut to 10 | Bidders convicted of a Grave bribery offense are debarred for 5 years |
| **Financial Crimes Taskforce (FCT)** | FATF plus international financial police cooperation | 40 major economies | Yearly review of countries: a **grey list** (shells registered there exposure ×1.5; transfers from there delayed as under F2 Reporting) and a **black list** (that country's banks cut from the international payment network, like Tier 3 sanctions for banks only); runs the Freeport raids (3.2.5) | A haven government lobbied by the player can stay off the lists only by tightening F5 one step |
| **International Court of Arbitration (ICA)** | Investment arbitration centres | Countries with investment treaties | Investment arbitration (4.9.9) | As 4.9.9 and 4.21.1 |
| **International Criminal Tribunal (ICT)** | International criminal court | Countries that joined (most liberal democracies) | Indicts characters for war crimes, coup violence and massacres by private security: an indicted character is detained on arrival in any member country (2.21.8) | Fund a defense; lobby non-member hosts; never travel |

**ISF conditions.** A program comes with 2 to 4 conditions drawn from: E1 or E2 one step up; E7 Free Prices; E6 None; F1 Independent; F2 one step toward Open (or toward Restricted in a capital flight crisis); an Anti-Corruption Drive (4.20.6). Each condition is a bill with Crisis +30 support for 6 months. A government that misses conditions loses the next tranche (reserves) and its rating falls one notch **(T)**.

**Blocs as a fourth level.** In a **Single Market** (4.11.2) the bloc has a commission (appointed by member governments) that acts as a level above national for two laws: the T2 Data Privacy floor and the common external tariff (E5). Bloc laws change by unanimity for tariffs and by a qualified majority (55% of members holding 65% of the bloc's population) for the rest **(T)**. Lobbying the bloc: LP price uses bloc GDP; PC spent from any member country's pool counts at 50%.

**International posts.** The ISF managing director, the AN envoy for a region, a bloc commissioner and the GDB president are appointed (4.7.3) from candidates nominated by member governments. A character in such a post gains Clout +10 and a +10 opinion push from the heads of government who backed them **(T)**.

---

## 4.26 Espionage between states and companies

### 4.26.1 State intelligence services

Each country has an intelligence service with a **head** (a character), **Capability** (1 to 5, from MSI and country data: MSI ≥ 60 gives 5, 30 to 59 gives 4, 15 to 29 gives 3, 5 to 14 gives 2, below 5 gives 1 **(T)**) and **Aggression** (one-party states and juntas ×1.5, rivals ×2, allies ×0.5).

### 4.26.2 State operations against companies

Rival states already hack strategic business units through state-backed hackers (4.11.3, [17-hacking.md](17-hacking.md)). States also run:

| Operation | Target | Effect on success **(T)** |
|---|---|---|
| **Recruit an insider** | An executive who is a Rival of the company's head | The foreign state learns the company's plans and data; passes one set of plans or data per year to its champions (their business unit in that industry +5 productivity **(T)**); the insider is a whistleblower candidate with a foreign handler |
| **Honey trap** | A Hedonist executive, or one with the sex vice ([11-addiction.md](11-addiction.md)) | The foreign state gains a hook on them |
| **Hardware implant** | A strategic sector product (chips, telecom, AI) | The product is later "found" compromised: banned in the implanting state's rivals for 1 to 3 years |
| **Detention** | An executive visiting the country (2.21.8) | A hostage for diplomatic or commercial leverage (seizure ladder demands, 4.9.10) |
| **Pressure** | A foreign holder's operations in the country | Seizure ladder step 1 demand for data access |

**Success chance** = `clamp(30% + 10% × Capability - 2% × target company's Head of Security Intrigue - 10% per cyber defense team, 5%, 90%)` **(T)**. Each operation is rolled monthly with chance `0.5% × Capability × Aggression` per strategic business unit of a foreign holder **(T)**.

### 4.26.3 The Request

From Corporation rank on, a character with strategic assets in a country (including their home) may be approached by that country's service: 1% chance per month per country **(T)**. The service asks them to carry a package, share customer data, give cover jobs to officers, install a backdoor, or report on a rival or a foreign official.

| Answer | Effect **(T)** |
|---|---|
| **Accept** | +1 favor with the service head (usable as Protection: one investigation by a national agency in that country is slowed 8 weeks); a +10 opinion push from the head of government; Chuds approval of the character +2. Risk: each operation has a 5% chance per year of being discovered by a third country: the characters involved are charged with espionage there (Criminal), the character's operations there jump one seizure ladder step, Tier 1 sanctions listing 20% |
| **Refuse** | Chuds approval of the character -2; in managed democracies and one-party states, seizure risk +0.5 points for 2 years (home) or Government attitude one step worse (host) |
| **Double game** (accept and tell the other side) | Needs Intrigue ≥ 15; both services owe a favor; if found out (10% per year), both become hostile |

When both the home and a host country ask in the same year, the **Two Masters** event fires: whichever is refused treats the player as the other's asset.

### 4.26.4 The player's own intelligence

- **Agent in place**: recruit an official, journalist or rival executive as a standing source (Intrigue scheme, 1.1.8 rules). Each month: learn one secret about their organization (2.22.2) and get early notice of one decision; discovery 3% per month; a discovered agent is a Grave offense (Criminal if the source is an official).
- **Counter-intelligence**: the Head of Security task of 1.8.2 applies against state operations too.
- **Selling secrets**: the player can sell stolen data, deals, plans or another country's secrets on the Freeport (3.2.5) or to a foreign service. Selling the home country's secrets is treason: Criminal tier with no settlement, prison of 15 years or more, and permanent Blacklisted.

---

## 4.27 AI governments and AI rivals

### 4.27.1 How AI governments decide

Each government is run by its head of government (a character) and the leading blocs of its coalition.

- **Agenda**: at formation, the government picks 3 to 5 law changes, ranked by `clout of the blocs that want them × stance strength`, plus one pick from the head's traits (Greedy heads favor contracts and low enforcement; Honest heads an Anti-Corruption Drive; Ambitious heads anything popular before the next election). It proposes them over its term (4.5.9).
- **Priorities** (weights 0 to 1 from type and traits): Growth, Stability, Revenue, Security, Re-election, Self-enrichment. Self-enrichment ≥ 0.5 means kickbacks are expected (4.9.7) and bribes are accepted 10% more often.
- **Crisis responses** (monthly) **(T)**:

| Condition | Typical response |
|---|---|
| Unemployment > 10% | Subsidies (E6 up), infrastructure contracts, tariff hikes if Landites or Communists lead |
| Inflation > 8% | Rate rises if F1 allows; otherwise Essentials Capped price controls |
| Stability < 40 | Democracies: concessions to Angry blocs; others: repression (Militarized policing, Emergency Decrees) |
| Currency crisis or default | ISF request, capital controls, or (populist heads) blame and seize foreign assets |
| A minister or the head of government at Heat ≥ 80 | Scapegoat a minister; in non-democracies, a purge or an Anti-Corruption Drive against a convenient target |

### 4.27.2 Government attitude toward a character

Each government holds an **attitude** toward each character with assets or Fame in the country, recalculated monthly:

`Attitude score = 5 × tie of the head of government with the character (4.3.5), so Friend +50, Neutral 0, Rival -50, Nemesis -100, + 20 if the character backed the ruling parties at the last election (-20 if they backed the opposition) + 2 × net Stakes alignment (bills the character lobbied for minus against, on the government's agenda, last 2 years) - 10 if foreign - Exposure / 5 (highest agency) + 0.2 × effective Favor (democracies only)` **(T)**

| Score | Attitude | Effects **(T)** |
|---|---|---|
| ≥ 40 | **Favored** | Bid score +10 on contracts; Request Protection cost halved; agencies' Zeal ×0.8 toward the character (by `1 - independence`) |
| 0 to 39 | **Tolerated** | None |
| -1 to -39 | **Watched** | Agencies' Zeal ×1.2 (by `1 - independence`); permits take 25% longer |
| ≤ -40 | **Targeted** | Agencies' Zeal ×1.5 (by `1 - independence`); contract bid score -10; foreign holders' seizure risk +0.5 points; in managed democracies and below, the state media runs a hit campaign |

"By `1 - independence`" means the multiplier is scaled: an agency with independence 0.9 feels only 10% of it.

**Populist targeting**: in democracies, if a character has Fame ≥ 60 and population-weighted effective Favor ≤ -10, populist parties put them in their campaigns ("[name] the oligarch"): +0.2 utility for them in strata where local Favor is negative. If they win, the new government starts at Targeted and proposes E4 Inheritance and Gift Tax with priority **(T)**.

### 4.27.3 AI rival political archetypes

AI rivals use the archetypes of 2.23.1 for business. For politics each also has one of these, from the head's traits:

| Archetype | Traits that lead to it | Political behavior |
|---|---|---|
| **Courtier** | Content, Cautious, Trusting | Backs whoever governs; buys protection; never funds the opposition |
| **Kingmaker** | Ambitious, Brave | Funds both sides 70/30 toward the favorite; collects clients; runs protégés for office |
| **Ideologue** | Visionary, Honest | Funds ideologies, think tanks and parties by conviction, even against its own business interest |
| **Shadow Broker** | Deceitful, Ruthless | Bribes, fixers, OCG ties, blackmail; low Fame |
| **Patriot** | Paranoid, Conservative, State-Linked charters | Works with the ruling ideology and the Chuds; accepts The Request; state champion |
| **Populist** | Ambitious, Narcissist | Builds a personal party around itself; attacks other characters publicly |
| **Absentee** | Content, Greedy | Ignores politics until a bill threatens > 2% of its profit |

### 4.27.4 AI rival decisions and coalitions

Monthly, in order **(T)**:

1. **Defend**: lobby against any bill whose Stakes exceed 1% of the rival's yearly profit.
2. **Protect**: Request Protection with any agency where its exposure is ≥ 40.
3. **Contracts**: bid on tenders in its sectors; spend PC on the Political term if the contract is worth more than 10 × its monthly PC value.
4. **Elections**: donate by archetype.
5. **Rivalry**: run schemes (Dig Up Dirt, Leak Scandal, tip-offs) against characters who are its Rivals or against whom it has a casus belli.
6. **Coalitions**: AI rivals form a **coalition against a dominant character** (the player or an AI rival) when that character reaches Power Broker in the country, or their largest company reaches Conglomerate rank. Each AI rival with national share ≥ 5% who is the target's Rival joins with 20% chance per quarter (×0.5 if the target's Clout band is Establishment). A coalition pools PC against the target's bills and clients, funds the target's opponents, lobbies against its foreign deals (+10 Concern in foreign investment reviews, 4.9.6), and coordinates short attacks in markets (3.25.2). Takeover bids by AI companies still need the game director's order (2.23). It dissolves when the target falls below Presence or after 5 years.

There is no AI aggression setting: the game has one difficulty with a fair AI (decided), so these values hold in every game.

---

## 4.28 Politics by company rank

What politics offers grows with the rank of the player's largest company (1.7.5) **(A)**. Nothing is locked: these are the tools and threats that usually matter at each size.

| Rank | Role of politics | Tools that usually matter | Typical threats |
|---|---|---|---|
| **Venture** (< $10M) | Permits and licences: politics as a gate | Request Decision, the Political Connections founding path (1.6.7), a boutique lobbyist, local donations | Permit denial, a rival's client minister, an NGO injunction |
| **Company** ($10M to $250M) | Power over places: rezonings, permits and policing contracts from national ministers, city influence tiers | Political Director (4.15.2), Request Protection, local media, a foundation (trust over $100M **(T)**), a think tank, civil suits | First investigations, unions and protests, protection demands, journalists |
| **Corporation** ($250M to $5B) | National lawmaking and the state as a customer | National lobbying, Major Donor and Party Patron, media empires, private security, courts as a weapon, The Request (4.26) | Foreign investment reviews, populist targeting, rival coalitions, whistleblowers, sanctions, hearings |
| **Megacorp and Conglomerate** (> $5B) | Regime-level power | Owned parties, coups, Council of Stakeholders, international organizations, corporate sovereignty (4.12), endgames (4.29) | Revolutions, tribunals, Anti-Corruption Drives, every coalition at once |

---

## 4.29 Political endgames

Political endgames are long-term goals for a powerful player, usually within reach from Megacorp rank (4.28). They are milestones, not victory conditions: the game is an endless sandbox that ends only when the player character dies, and each one achieved adds points and a milestone to the player's score, which is based on the player character ([12-setup-and-score.md](12-setup-and-score.md) 12.4), while play continues. Corporate sovereignty (4.12) is one; the others let the player be remembered as a power broker, a political machine, or even a respected benefactor **(T)**.

| Endgame | Condition **(T)** | Score |
|---|---|---|
| **Corporate Sovereignty** | Hold a Stage 3 Sovereign Corporate Zone for 10 years (4.12) | 3,000 |
| **Kingmaker** | In 3 countries at once (at least one with GDP ≥ $1T), the head of government is the player character or a client with Loyalty ≥ 60, held for 4 consecutive years | 2,500 |
| **Power Behind the Throne** | Chair the Council of Stakeholders of a corporate oligarchy with GDP ≥ $500B for 10 years | 2,500 |
| **Political Machine** (replaces Political Dynasty, batch 116) | The player character holds head of government in any countries for a combined 8 years, or 3 clients hold national office (minister or higher) in one country at the same time | 2,000 |
| **Market Maker** | Control a central bank (a client governor under F1 Directed or Monetary Financing), a currency board, or a global exchange (3.17.5) for 10 years | 2,000 |
| **Bloc Architect** | A Single Market of 4 or more countries is ratified while the player has Power Broker national share in each member and was the largest lobbyist for it in each | 2,000 |
| **Media Hegemon** | ≥ 40% of the national audience in 3 countries (one with GDP ≥ $1T) for 10 years, with outlet credibility above 60 | 1,500 |
| **Benefactor** | In the home country: effective Favor ≥ +40 in every stratum, Favor ≥ 60, Clout ≥ 75, no conviction of the player character for 30 years, a foundation with ≥ $10B in assets, and stability ≥ 70 for 10 years | 2,500 |

**Falls.** The political layer can also wreck the player's position without ending the game (only the player character's death ends it): **Exile** (all assets in the home country seized after a revolution or a Targeted government's nationalization; the player continues from abroad with their foreign assets, Clout -30 **(T)**), **Disgrace** (the player character is convicted of a Criminal-tier offense: they play on from prison or exile, Clout falls to 0 and Favor to -50; nothing passes to anyone) and **Capture** (a hostile coalition or government forces the sale of the flagship). Each is an event chain with a way back (a restoration coup, an appeal, a pardon from a later government).

---

## 4.30 Sample events for the new sections

| Event | Trigger | Options (short) |
|---|---|---|
| *The Committee Will Come to Order* | Hearing summons (4.15.4) | Attend (play the hearing) · Send the General Counsel (half effects) · Refuse (Favor -10, Heat +15) |
| *Front Page* | A scandal takes the character's Heat to 40 or more | Ride it out · Deny · Apologize · Counter-story · Legal threat |
| *The Editor Resigns* | Owner orders a line change against an Integrity ≥ 70 editor | Accept the resignation (credibility -5) · Back down · Buy their silence |
| *A Seat at the Table* | Donor share reaches 25% in a party | Accept Party Patron status publicly · Stay in the shadows (keep powers, no Fame gain, exposé risk) |
| *The Protégé Wants to Run* | A Friend or protégé with Ambitious and Persuasion ≥ 12 | Back the career (fund, Party Standing; a client if elected) · Discourage (a -20 opinion push) · Steer them to a safer seat |
| *Insurance Salesmen* | OCG protection demand (4.22.3) | Pay · Refuse and harden security · Request a crackdown · Inform |
| *A Favor for the Plaza* | 6+ months of paying protection | Let the trucks roll (dirty money, hook) · Refuse (price doubles or incident) · Sell the business unit |
| *The Accountant* | Whistleblower risk ≥ 5% per month on an operation | Hush money · Promote · Fire · Discredit · "Make it go away" |
| *Unexplained Wealth* | Visible purchase with dirty money ≥ $10M | Proceed · Launder first (choose a method) · Cancel |
| *Injunction Granted* | A rival's injunction freezes a deal or a build | Post a counter-bond · Appeal · Settle |
| *Gentlemen, Please* | Discovery in a civil suit turns up an unrelated secret | Settle fast · Fight on (exposure +10 risk) · Countersuit |
| *Martyr* | Police repression of a protest triggers a death | Call for calm (Favor +3) · Blame agitators (Clout +3, Favor -5) · Fund the funeral (Heat -10) |
| *The Request* | State intelligence approach (4.26.3) | Accept · Refuse · Double game |
| *Two Masters* | Home and host services both ask in one year | Choose home · Choose host · Refuse both |
| *Grey List* | FCT lists a country where the player has shells | Move the shells (5% fees) · Lobby for delisting · Ignore (exposure ×1.5) |
| *The Oligarchs' Party* | Populist targeting starts (4.27.2) | Charm offensive (philanthropy, Favor) · Fund the populists' rivals · Go quiet (Keep a Low Profile) |
| *The Coalition* | AI rivals form a coalition against the player | Split it (buy one member) · Outspend it · Befriend its leader (a Befriend scheme, 1.1.8) |

---

## 4.31 Worked examples for the new sections

All numbers use the tuning values above.

### 4.31.1 The Harbourside Files: a scandal, a narrative fight and a defamation suit

**Situation.** London (United Kingdom, liberal democracy, media freedom 0.9, wealth index 2.4). The Atlantic Ledger (major paper, 18% national audience, credibility 85, editor Integrity 70) runs "The Harbourside Files": the player's transit subsidiary paid a 2% kickback through a consultant to win a London transit contract. The story is **true**; it is a **major** scandal: Heat 50. On day 2 a tabloid TV channel (25% audience, credibility 50, editor Integrity 35) joins. The player owns The Courier (12% audience, credibility 70). The player character is running for a London seat in 10 weeks.

It is a **Corruption** scandal, so its share halves every year (4.17.4); the player character starts at Heat 0.

**Coverage per day**: Ledger `3 × 0.18 × 0.85 = 0.46`; tabloid `3 × 0.25 × 0.5 = 0.375`. Each covers for 7 days.

| Response on day 1 | Heat on day 7 | Peak | Day Heat falls below 40 | Weeks the memory is frozen | Stock drift | Other costs |
|---|---|---|---|---|---|---|
| **Ride it out** (no revelation) | 54 | 55 | Day 173 | 1 | -4.2% | None |
| Ride it out, one revelation on day 8 (35% chance per week with a journalist on the case) | 54 | 70 | Day 311 | 2 | -9.1% | None |
| **Apologize** | 28 | 28 | Never above 40 | 0 | 0% | Favor -5; Evidence +5 in the Financial Police inquiry |
| **Legal threat** (the tabloid drops out, 40% chance) | 52 | 52 | Day 147 | 1 | -3.6% | 15% chance of a backlash story (Heat +20) |
| **Counter-story** in The Courier | 40 | 40 | Never above 40 | 1 | 0% | 25% chance the plant is exposed: a new minor scandal, Courier credibility -10 |

**Local Favor among the PMC stratum** (target before the story): `0.5 × 20 (Favor) + 30 × (0.15 × 0.70 × 0.6) (Courier tone) + 5 (employer) + 6 (philanthropy: $14.4M at $2.4M per point) + 10 (home) = 32.9`; actual 30. Riding it out, Heat sits around 52 for the 10 weeks to the election: target ≈ `32.9 - 26 - 0.6 (Ledger tone -0.1) = 6.3`, so local Favor sinks week by week to about 14.6 on election day. With Fame 60 that cuts the player's Candidate term in the PMC stratum from `0.01 × 30 × 0.6 = 0.18` to about 0.09. After an apology Heat sits around 26, local Favor ends near 23 and the term near 0.14. The **memory** adds to it: the Scandal term of 0.8 is frozen in every week that ends while an outlet still covers the story. On election day it is 0.14 after an apology (never frozen), 0.17 after riding it out cleanly (frozen 1 week), and 0.20 if a revelation lands (frozen 2 weeks), with twice the stock damage. Because Heat now lingers (Logan, batch 117), the cancelled player also faces halved Favor and Clout gains and wary politicians for months after the story is gone.

**Suing the Ledger for defamation.** The story is true: Merit -8. The player's counsel score: General Counsel 15 + 5 × tier 3 = 30. Ledger: in-house counsel 12 + 5 × tier 2 = 22. UK judge Neutral; the government does not care. `P(win) = 50% - 32% + 16% = 34%`. Filing costs $600k (`$250k × 2.4`) and Heat +10 at once; the UK has no anti-SLAPP flag, so the suit runs 6 to 24 months. Civil discovery is the trap: each month of trial there is a 10% chance the Ledger's lawyers find the consultant's invoices, adding +10 Financial Police exposure, and the Ledger's journalist gets the documents. Over a 12-month trial that is a `1 - 0.9^12 = 72%` chance. **Verdict**: for a true story, apologize on day 1 (it costs 5 Favor and 5 Evidence, but it kills the revelations, the stock drift and the hearing risk), scapegoat the subsidiary's CEO if the inquiry reaches Subpoena, and never sue over a true story. For a false story the answer flips: deny and sue, since debunking (15% per week) and a Merit of +8 work for the player.

### 4.31.2 The clinic in Lagos: dirty money, laundering, deniability and a whistleblower

**Situation.** The player's Front Company in Lagos (Nigeria, liberal democracy, corruption 75, media freedom 0.9) runs a black clinic (a Black market business unit) selling unapproved longevity treatments behind a legitimate private hospital. It earns $2.5M of **dirty** money per month ($30M a year). The player wants to put $60M of accumulated dirty money into a share of the Commercial pool of the Dubai Metro's core province (2.16; UAE, one-party state, corruption 30, Financial Police capacity 3).

**Option 1: buy the pool share with dirty money.** Unexplained wealth: +60 exposure with the UAE Financial Police. Monthly inquiry chance = `0.60 × 1.0 × 1.0 × 1.0 × (1 - 30/200) = 51%`. If the inquiry reaches Discovery, the $60M counts with trace 100%: Evidence `5 × 6 × 1.0 = 30`. Almost certain trouble.

**Option 2: three shell layers first.** Shells in Haven jurisdictions at 4% per layer: fees `1 - 0.96³ = 11.5%`, about $6.9M, taking 6 weeks. $53.1M of clean money buys a smaller share. The shells' own routing exposure is ×0.2 under F5 Haven, so it is negligible. Trace `0.5³ = 12.5%`: if Lagos's front is ever investigated to Discovery, the Dubai money adds only `5 × 6 × 0.125 = 3.75` Evidence.

**Deniability.** The clinic is run by a fixer (cutout 1), and the front's registered director is a nominee (cutout 2). If charges come, the chance the player character is personally charged is `0.6² = 36%`. The front company is charged regardless (black market medicine: Grave).

**The knowers.** Flow $30M a year gives 3 staff knowers plus the 2 cutouts. Monthly whistle chances (`1% × opinion factor × traits × (0.5 + 0.9)`, with the opinion factor of 4.20.5: Friend ×0.5, Neutral ×1, Rival ×1.5):

| Knower | Opinion of the player | Traits | Monthly chance |
|---|---|---|---|
| Fixer (cutout) | Friend | Deceitful ×0.5 | 0.35% |
| Nominee director (cutout) | Neutral | None | 1.40% |
| Clinic accountant | Rival | Honest ×3 | 6.30% |
| Two nurses (anonymous staff, the player's Favor 0) | Neutral | None | 1.40% each |

Chance that nobody talks in a month: 89.5%. **Over a year: 74% that someone blows the whistle.** The *Accountant* event fires (6.3% ≥ 5%):

| Response | Result |
|---|---|
| Hush money (2 years' salary, about $90k) | Accountant 3.15%; yearly risk falls to **61%** |
| Promote (a +20 push; with a +10 push from a raise earlier in the year the accountant moves from Rival to Neutral) | Accountant 4.2%; yearly risk about 66% |
| Fire | 30% chance they go to a journalist at once, then 19% per month for 3 months: about **63%** that the firing itself causes the leak |
| Shrink the operation to $15M a year | Only 2 staff knowers (the accountant and one nurse): with hush money, yearly risk about 53% |

The lesson: a profitable dirty operation is a growing pool of people who know. The safest version is small, staffed by loyal people, run through two cutouts, and laundered before it touches anything visible.

### 4.31.3 Insurance Salesmen in Mexico City: protection, security or a crackdown

**Situation.** The player's Autos business unit, with its assets in an Industry-heavy province of the Mexico City Metro (Mexico, liberal democracy, corruption 65, wage index 0.22), has revenue of $200M a year. A Cartel with Strength 60 holds Control 45 in the province: local strength `60 × 0.45 = 27`. Police strength 45, police integrity 35. The cartel asks 1% of revenue: **$2M a year**.

| Option | Cost per year | Monthly incident chance | Expected incidents per year | Other effects |
|---|---|---|---|---|
| **Pay** | $2M (plus Financial Police exposure +3 per month if paid as "consulting" in Mexico) | 0% | 0 | After 6 months, 10% per month of *A Favor for the Plaza* |
| **Refuse, no security** | $0 | `45 / 5 = 9%` | 1.1 (68% chance of at least one) | Each incident: about $3.8M of lost output (one week), Unskilled unrest +2 |
| **Refuse and harden**: 6 armed response teams (Strength 30 ≥ 27) | `6 × 40 × $6,500 × 0.22 × 12 = $4.1M` | `9% × 0.25 = 2.25%` | 0.27 (24% chance of at least one) | Theft losses (Crime / 20 %) cut by 75% |
| **Request a crackdown** (Interior Minister, 10 PC) | PC | Success chance `40% + 0.5% × (45 - 60) = 32.5%` | | Success: Control 30 and Strength 50, local strength 15. The cartel learns who asked with chance `1 - 0.35 = 65%`, then retaliates 50%: a **33%** chance of a targeted attack on the unit's manager or premises |

**Reading it.** Paying is the cheapest option today and the most dangerous later: it makes the player a customer, and the *A Favor for the Plaza* event turns a customer into a partner with a hook on it. Hardening costs twice the protection fee but keeps the player clean. A crackdown is a political play: it costs PC and has a one-in-three chance of making the cartel an enemy. A Corporation-rank player would pay while lobbying the national government for S2 Militarized (police strength 60, crackdown success 40%) and funding a national candidate who campaigns on crime, then refuse once the odds improve.

---

## 4.32 Assumptions

New assumptions made in this file, to confirm with Logan:

1. **Political Capital** is a separate spendable resource derived monthly from influence share (`100 × sqrt(share)`), pooled per holder (the player character, rolled up with what they control) per country, plus local standing PC from tiers in its places (batch 121). Influence share itself stays as defined in 2.5 (rooted in assets, modified by origin, boosted by ads and psyops).
2. **The nine ideology blocs are the political actors** ([5-ideology.md](5-ideology.md)), and votes are counted by strata (4.0, 4.4).
3. **A seventh law category, Governance** (campaign finance, lobbying rules, media ownership), added because these laws decide how much money can buy.
4. **Extra laws added** beyond the retired overview's list: environmental regulation, property tax, zoning (regional taxes were removed in batch 121), special economic zones, trusts and foundations, bailout policy, immigration.
5. **Ruling family states** (for example Gulf monarchies) are modeled as a variant of the one-party state, not a separate type.
6. **No country starts as a corporate oligarchy**; the type exists only as an outcome of play.
7. **Starting country classifications and values** are a game abstraction at the start date, editable in data, and loosely inspired by public governance indices.
8. **Six agencies**: the Banking Supervisor and the Data Authority are added to the retired overview's list, and there is no antitrust authority.
9. **Law changes move at most two steps per bill**, and a changed law locks for 12 months (6 in non-democracies).
10. **Decisions vs laws**: individual permits, rezonings, contracts and reviews are decisions by named national officials using a disposition formula; standing laws use the clout-weighted support formula.
11. **Seizure is a ladder**, never instant, except when war, Tier 3+ sanctions or a failed coup skip steps.
12. **Bribes of officials are possible in every government type**, but liberal democracies make them expensive, rarely accepted and often reported.
13. **Elections use a stratum-level softmax** of utilities; money enters with a logarithm so doubling spending has diminishing returns.
14. **Money values** are in dollar equivalents scaled by GDP (political market size, LP price) or by a wealth index (bribes, legal fees), so the same rules work for a $50B country and a $28T one.
15. **Corporate sovereignty Stage 3** needs a corporate oligarchy, a failed state, or a treaty; liberal democracies can host Stage 2 charter cities at most without a treaty.
16. **Prison** keeps a character in play with very limited actions rather than removing them entirely.
17. **Political Director and Objectives**: routine politics is delegated to a Political Director character working from player-set objectives, a budget and a Conduct line (Clean, Grey, Dark), so hourly play is kept for hot moments (election and coup nights, hearings, crisis meetings, Council sessions, protest standoffs).
18. **Hearings** are a short hourly mini-mode with four answer stances.
19. **Public standing uses only Clout and the Image pair** (batch 116, ruling 10): Clout for the elite, Fame and Favor for the public, with a weekly local read of Favor per country and stratum. Favorability, Elite Standing, Profile and the separate reputation score are gone. None of them changes influence share, which stays rooted in assets. Clout is read on a 0 to 100 scale for its bands **(A)**.
20. **Heat is how cancelled a character is** (Logan, batch 117): the sum of their scandals' shares, each fading at its type's rate (a gaffe in weeks, fraud or a crime over years). It is separate from the election Scandal term, which keeps halving every 4 weeks except in weeks that end while an outlet still covers the story.
21. **Outlets have credibility and tone**, editors and journalists are characters, and media effects are weighted by audience × credibility.
22. **Think tanks** have Credibility (not Prestige) and **can shift an ideology bloc's stance** by one step on one law for 10 years (at most once per bloc per law per decade): the slowest and strongest political lever.
23. **Foundations** are a holder type with a deed, irrevocable assets, a payout rule under F6, and control stakes that follow the board.
24. **Party donorship tiers** (Major Donor 10%, Party Patron 25%, Owned Party 50% plus leadership) and **personal parties** built around a high-Fame character.
25. **Party Standing** is a new per-character value, and it adds a `Party Standing / 10` term to the nomination score of 4.7.2.
26. **Clean and dirty money** are tracked separately in every holder's cash. Laundering methods have fees, capacities and traces that become Evidence.
27. **Deniability**: the chance a principal is personally charged is `0.6 ^ cutouts`; every cutout is also a knower who can flip or blow the whistle.
28. **Whistleblowers** are generated from each illegal operation's knowers (cutouts plus 1 per $10M of yearly flow, minimum 2).
29. **Civil litigation** is a full system with judges as characters (Integrity, Leaning, Ideology), appeals, settlement, civil discovery and anti-SLAPP flags.
30. **Organized crime groups** are AI actors and holders with Strength and province Control. The player can pay, fight, hire, partner with or inform on them, but can never become one.
31. **Security Strength** is one scale for private security, police, militaries and OCGs.
32. **International organizations** use fictional names (Assembly of Nations, ISF, World Trade Council, Global Development Bank, Financial Crimes Taskforce, International Court of Arbitration, International Criminal Tribunal). A Single Market bloc sets a floor above national law for T2 and E5.
33. **State intelligence services** run operations against companies and make **The Request** to characters from Corporation rank on.
34. **AI governments** hold an attitude (Favored, Tolerated, Watched, Targeted) toward each character, scaled by agency independence; **AI rivals** have one of seven political archetypes (labels from their traits) and form coalitions against dominant characters.
35. **Political endgames** add Kingmaker, Power Behind the Throne, Political Machine, Market Maker, Bloc Architect, Media Hegemon and Benefactor (with exact conditions) beside Corporate Sovereignty, as score milestones rather than victory conditions, plus non-final falls (Exile, Disgrace, Capture).
36. **Only national governments in the POC** (Logan, batch 121): no state, regional or city governments, councils, mayors, governors, regional laws, licences, bonds or local elections. Old city powers go to the Minister of Land and Housing (rezonings, permits) and the Interior Minister (policing contracts, crackdowns, the national police chief). PC is per country, plus local standing PC from tiers. Sub-national governments may come back after the POC.
