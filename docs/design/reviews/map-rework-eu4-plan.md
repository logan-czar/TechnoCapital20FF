# Map rework: an EU4-style map (plan, 2026-10-19)

_Status: plan for Logan's review. Nothing in [2-map-and-influence.md](../detailed/2-map-and-influence.md) has changed yet. Proposals are (A) and numbers are (T). The questions at the end are batch 118._

## 1. How EU4 does it (the model we copy)

- **Province** is the smallest map unit. The whole world is tiled into provinces (about 3,000 land provinces in EU4). Each province:
  - is owned by exactly one country;
  - has **development** in three tracks (tax, production, manpower);
  - has one **trade good**, a terrain type and a culture and religion.
- **Area** groups about 3 to 6 neighbouring provinces. An area is what becomes a **state**, where a country spends effort to govern well.
- **Region** groups several areas (for example Scandinavia or the Great Lakes).
- **Superregion** groups regions (for example Europe or North America).
- **Map modes** colour the same provinces by owner, development, trade goods, terrain, religion and so on.
- **Countries** own provinces. Subjects (vassals, tributaries) are separate countries tied to an overlord.

What we take from it: a fully tiled world, provinces as the one place every system points at, development as the measure of a place's weight, groupings that roll up, and map modes. What we do not take: armies, wars over provinces and trade nodes. We have one world market per industry, so there are no trade nodes.

## 2. Today versus the plan

| Today | Plan |
|---|---|
| 33 major countries plus 16 aggregated minor groups | **Every country is a real country** on the map with its own provinces (about 195) |
| Regions (2 to 8 per major country; "rest of country" elsewhere) | **Regions** = real states and provinces (Texas, Alberta, Bavaria), the level where regional government sits |
| 80 hubs with size classes and districts | **Provinces**. A city is a province (or several provinces for a megacity) with high development. There is no separate "hub" object |
| 6 to 26 districts per hub, each with up to 4 real estate pools | **Districts are dropped.** Each province holds the four real estate pools |
| Hub mass from size class | **Province weight from development** |
| Influence per district, hub, region and country | Influence per **province**, rolled up to **area, region and country** |

## 3. The new layers

| Layer | What it is | Count (T) | What lives here |
|---|---|---|---|
| **Superregion** | Continent-sized group | 8 (North America, Latin America, Europe, Russia and Central Asia, Middle East, Africa, South Asia, East Asia and Oceania) | Map mode labels and the global news "beats". No rules |
| **Country** | A sovereign state | About 195 | Government, laws, elections, central bank, currency, exchange (if any), tax, business cycle, sanctions and debt vassalage. Owns provinces |
| **Region** | A real first-level division (state, province, oblast) | About 400; small countries have one | Regional government, regional laws and licences, regional bonds |
| **Area** | 3 to 6 neighbouring provinces, like an EU4 state | About 300 | The middle step for influence tiers, and for city councils in metro areas |
| **Province** | One map tile: a city, part of a megacity, or a rural county-sized area | About 1,200 | Development, real estate pools, population and strata, unrest, resource, terrain, port, business asset spread and influence |

**Megacities** span several provinces (for example New York becomes Manhattan, Brooklyn-Queens, North Jersey and Long Island), and they share one city council through their area. Small cities are a single province. Rural land is split into larger provinces with low development.

## 4. The province

| Field | Meaning |
|---|---|
| Owner | The country that holds it (changes only through secession, annexation or a charter city) |
| Region and area | Where it rolls up |
| **Development** | Three tracks, as in EU4 (T):<br>• **Commerce** (finance, services, offices)<br>• **Industry** (plants, ports, fields)<br>• **Population** (people and labor)<br>Total development replaces the hub size class and sets the province's **weight** for influence |
| Real estate pools | Commercial, Residential, Industrial and Land, priced per province. The pool sizes come from the development tracks |
| City | A name and a rank shown on the map (Metropolis, City, Town, none). This is flavour plus a few rules (airport class, council seats) |
| **Resource** | One tag like an EU4 trade good: Oil, Gas, Copper, Lithium, Cobalt, Rare earths, Iron ore, Farmland, Timber, Fishing, or none. Matching business units with assets here get a small productivity bonus (T) |
| Terrain and climate | Flavour plus disaster and power-cost modifiers (desert, arctic, tropical, temperate, mountain, coast) |
| Port and chokepoint links | Whether it is coastal and which chokepoints it sits behind (risk exposure) |
| Population and strata | The current hub population model moves here. It keeps running in the background (batch 116) |
| Unrest | Per province |
| Perks | The current location perks (2.3.5) move from hubs to their city provinces |

**Development changes over time.** Business assets, payroll and real estate building raise the matching track. Unrest, disasters and decline lower it. Players can't buy development directly, only through what they build and employ there (T). This replaces hub growth, new districts and new hubs: any province can grow into a city.

## 5. How other systems change

| System | Change |
|---|---|
| **Business units** | The asset spread is per province. Assets sit in a province and rent or buy space from its pools. The districts' industry fit is replaced by: Commerce-heavy industries need Commerce development, Industry-heavy industries need Industry development, and extraction needs the resource tag |
| **Influence** | Weight = development × price level. The tiers (10/25/50) apply per province and per area, region and country. District perks become province perks; hub perks become area perks |
| **Politics** | City councils sit at the area (metro) level, regional governments at the region, national governments at the country. Minor countries get real governments on the map (they already have them in 4.2.4) |
| **Real estate** | The four pools per province replace district pools. Gentrification and slum clearance become development swaps inside a province |
| **Travel** | Characters are in a province. Travel time comes from distance between provinces; airports exist by city rank |
| **Map screen** | Map modes: political, development (each track), influence (yours or a rival's), real estate cycle, resource, terrain, unrest, ideology, Heat of local news, and chokepoint risk |
| **Starting world** | The 80 hubs become about 120 city provinces (megacities split). The 33 major countries keep their full economy tables. The former minor-group countries get simple ones (T) |

## 6. Work to do once approved

1. Write the province, area and region rules into 2-map (replacing 2.2, 2.3, 2.16 and 2.17).
2. Build the province list. This is big: about 1,200 rows. I'd generate it country by country, starting with North America as a test slice.
3. Rewrite influence (2.5) for provinces.
4. Update 4-politics (government levels), 7-starting-world (hubs to provinces), 10-industry (asset spread) and 11-ui (map modes).
5. Update the geography overview.
