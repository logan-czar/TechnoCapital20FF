# 5. Map and influence

## 5.1 The world map

The game uses a **2D map of the modern world**, rendered in Phaser, with three zoom levels:

| Zoom | Shows | Used for |
|---|---|---|
| **World** | Countries, currency zones, trade routes, chokepoints (straits, canals) | Global supply chains, FX, diplomacy |
| **Country** | States or provinces, major hubs, national politics | Branch offices, elections, regulation |
| **Hub** | A city or economic cluster split into districts | Real estate, facilities, local influence and politics |

Geography is the real modern world (real countries and cities), with fictional companies, people and brands (see [13-open-questions.md](13-open-questions.md)).

## 5.2 Places

- **Country**: a national government, currency, central bank, laws and stock exchange (see [08-politics.md](08-politics.md)).
- **Region** (state or province): its own government, taxes and some laws.
- **Economic hub**: a city or cluster with districts, population, labor pools, industries and a local government. Examples: a financial center, a chip fab cluster, a port and logistics hub, a resource town, a tech campus city.
- **District**: part of a hub with land plots for real estate and facilities (Financial District, Industrial Zone, Port, Residential, Slums, Tech Park).
- **Trade routes**: shipping lanes, rail, pipelines, fiber and air routes connecting hubs, with **chokepoints** that can be disrupted.

## 5.3 Influence

**Influence is rooted mainly in the amount of assets you own in an area.** It is tracked per holder (character, trust, company, dynasty) per place (district, hub, region, country).

### Base influence

Base influence in a place = your share of the total asset value in that place, weighted by type:

| Asset | Weight |
|---|---|
| Real estate and land | High |
| Facilities and the jobs they provide | High |
| Local government bonds | Medium |
| Stakes in companies headquartered there | Medium |
| Media outlets based there | Medium |
| Financial holdings booked there | Low |

Influence rolls up: district → hub → region → country, so a dominant position in one hub gives some influence in its region and country.

### Modifiers

- **Born and raised there**: a lasting bonus for characters with that origin, also counting toward their dynasty.
- **Dynasty history**: generations of presence in a place give a slow-growing bonus.
- **Reputation**: scandals reduce influence everywhere; local philanthropy raises it locally.
- **Political office**: holding office in a place adds influence there.
- **Foreignness**: a foreign holder has reduced influence, larger in countries with nationalist governments.

### Temporary boosts

To get a foothold fast, the player can buy temporary influence:

- **Ad campaigns**: legal, cost money, moderate boost that fades over weeks.
- **Psyops**: covert disinformation and bot campaigns; cheaper per point, bigger boost, but risk exposure and a reputation hit.
- **Sponsorships and charity**: slower, smaller, but builds lasting reputation.
- **Events and galas**: hosting raises influence among the local elite.

Temporary boosts decay weekly unless backed by real assets.

### What influence unlocks

Thresholds (assumed 10%, 25%, 50% share) unlock perks per place:

| Tier | Economic perks | Political perks |
|---|---|---|
| **Presence** (10%) | Local hiring and supplier discounts | Meetings with local officials |
| **Power broker** (25%) | First refusal on new plots and ventures, zoning approvals | Lobbying effectiveness, permit approvals, tax breaks |
| **Kingmaker** (50%) | Set local prices for some goods, block rivals' expansion | Influence local elections, appoint local officials, protection from local investigations |

Influence also powers the **Political Connections** founding path and feeds proxy fights for companies headquartered in the place.
