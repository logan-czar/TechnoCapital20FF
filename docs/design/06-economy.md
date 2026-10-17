# 6. Economy and supply chains

> **Changed (Logan, 2026-10-17):** the Victoria 3 goods model below is scrapped. The economy is now Wall Street Raider style: countries have **industries** with a size, trend, cycle and margin, and companies earn money through **business units** (one industry in one country) that win market share up to their capacity. Energy and GPUs are still counted in units. Full design: [detailed/10-industry-economy.md](detailed/10-industry-economy.md). Sections 6.1 to 6.5 below are kept for history only.

## 6.1 Goods

Goods are grouped in tiers:

| Tier | Examples |
|---|---|
| **Raw** | Crude oil, natural gas, iron ore, copper, lithium, rare earths, grain, timber, water |
| **Intermediate** | Steel, plastics, refined fuel, silicon wafers, batteries, chemicals, textiles |
| **Advanced components** | Chips, displays, sensors, engines, cyberware components |
| **Finished goods** | Consumer electronics, vehicles, cyberware, pharmaceuticals, food, clothing, weapons |
| **Services** | Finance, logistics, cloud compute, security, media, healthcare, construction |
| **Data** (cyberpunk) | User data, AI models, surveillance feeds; traded legally and on black markets |
| **Energy** | Electricity, priced per hub grid |

## 6.2 Facilities

Companies own **facilities** on land plots in hub districts: mines, wells, farms, plants, fabs, warehouses, data centers, offices, stores, ports.

- Each facility has a **production method** (Vic3 style) that converts inputs and labor into outputs. Better methods need tech and capital.
- Facilities have **capacity**, **efficiency** (from the managing COO or CEO's Operations skill and workforce quality), **condition**, and **workforce**.
- Building a facility takes construction time and money; buying one transfers it with its workforce.
- Facilities create **jobs**, **taxes** and **influence** for the owner in that place.
- Like Victoria 3, but a company either **owns or leases** the buildings it produces in. Land owner, building owner and operator can be three different holders (see [detailed/2-map-influence-economy.md](detailed/2-map-influence-economy.md) 2.16).

## 6.3 Supply chains

- Facilities buy inputs from **local markets** in their hub, or import them along **trade routes**.
- Each route has cost, capacity and travel time; ocean shipping is cheap and slow, air is fast and expensive.
- **Chokepoints** (straits, canals, key ports) can be disrupted by events: blockades, storms, strikes, cyberattacks, sanctions.
- Companies can sign **supply contracts** (fixed price and volume) or buy on the **spot market**.
- **Vertical integration**: owning your suppliers as vassals secures inputs but concentrates risk.
- A disruption propagates: chip shortage → device prices rise → device makers' earnings fall → their stocks fall → trusts holding them lose value.

## 6.4 Labor and population

Population is modeled in **segments** per hub (Vic3 pops, simplified): Elite, Professionals, Skilled Workers, Unskilled Workers, Gig Workers, Unemployed.

- Segments have size, wages, needs (goods they buy), political leanings and **unrest**.
- Facilities hire from segments; skilled jobs need education or training.
- **Automation** production methods cut labor costs but raise unemployment and unrest, which feeds politics.
- **Unions** form when unrest and organization are high; strikes halt facilities.

## 6.5 Demand and prices

- Demand comes from population segments (consumer goods), facilities (inputs), and governments (contracts: defense, infrastructure, healthcare).
- Each hub has a local price per good set by supply and demand; prices converge along trade routes, net of transport cost and tariffs.
- Goods with global markets (oil, metals, grain, chips) are also traded on commodity exchanges (see [07-markets.md](07-markets.md)).

## 6.6 Company financials

Company income comes from the economy:

- **Revenue**: sales of outputs and services, government contracts.
- **Costs**: inputs, wages, energy, logistics, maintenance, interest, taxes.
- **Profit** feeds dividends (tribute up the vassal chain), reinvestment and valuation.
- Quarterly **earnings reports** (see [09-time-and-turns.md](09-time-and-turns.md)) move stock prices.

## 6.7 Technology

A light tech system per company: R&D spending unlocks better production methods and new products (for example next-gen chips, advanced cyberware, autonomous logistics). Tech can be stolen by espionage or forced out through branch office rules.

## 6.8 Phase 1 abstraction

Until Phase 2, each company has an abstract revenue and cost per month tuned by sector and size, so the corporate and dynasty systems can be tested.

## Techno-Capital

Compute, foundry capacity, lithography tools, drones, autonomous vehicles, robots and AI models form **Techno-Capital**: scarce machine capital that must be allocated to tasks (training runs, research, fleets, netruns, uploads) for them to run or finish. Techno-Capital is **leased, not sold**: idle machines are rented out, and a company holds the use of TC as Owned, Leased, Spot or Compromised. The AI, data center and semiconductor supply chain is the core of the early game. Full design: [detailed/6-technocapital.md](detailed/6-technocapital.md).
