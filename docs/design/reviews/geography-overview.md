# Geography in TechnoCapital20FF: how it works now

_A plain-language breakdown of the current design (2026-10-18), for review. The rules live in [detailed/2-map-and-influence.md](../detailed/2-map-and-influence.md) unless another file is named. Section 7 lists the problems found while reading._

## 1. The layers, from biggest to smallest

| Layer | How many | What it is | What lives at this level |
|---|---|---|---|
| **Country** | 31 major countries, plus about 60 smaller ones in 16 **minor groups** | A real country | Government, laws, elections, central bank and policy rate, currency, stock exchange (major countries), corporate and property tax, business cycle, sanctions, debt vassalage |
| **Region** | 2 to 8 per major country | A state or province | Regional government, regional laws and licences, regional bonds |
| **Hub** | 44 at start | A city or metro area | City council, local politics, population and strata, unrest, unions, property cycle, location perks, intel level |
| **District** | 6 to 26 per hub | A neighborhood type | Real estate pools, where business units' assets sit, local unrest |
| **Pool** | Up to 4 per district | A slice of the district's property | Shares that holders own by dollar amount |

**Minor groups** (for example Nordics, Euro periphery, West Africa) work as one combined economy each, but every member country keeps its own government, laws and currency. They have **no hubs** at start. **Havens** (Cayman, BVI, Bermuda, Jersey, Luxembourg, UAE free zones) have no hubs either; they only hold paper (shell companies).

**Chokepoints** (14: Hormuz, Malacca, Suez and so on) sit on the map with a risk level. Goods do not travel along lanes; when a chokepoint's risk rises, the industries that depend on it pay more and lose capacity.

## 2. Hubs

- **Size class** sets everything else. A hub is S, M, L, XL or Mega by metro population (under 1.5M up to over 20M). Size sets its number of districts, its **mass** ($3B up to $120B, scaled by local price levels) and its council seats.
- **Mass** is how much it takes to have power there: influence share = your weighted assets ÷ the hub's mass.
- **Hubs change over time.** Population grows or shrinks every year from jobs, wages, housing costs and unrest. A growing hub moves up a size class and gains new districts; a shrinking one can lose districts to Slums or Land. New hubs can appear when a region gets more than $5B of business assets, through special economic zones, or through charter cities in the corporate sovereignty endgame.
- **Location perks.** Only big finance and tech hubs have them, each written as "every company that does X here gets Y" (for example, HQ in New York gives +5% investor confidence; a Foundry unit in Hsinchu gives +5% productivity). Any number of companies can earn the same perk.
- **Starting businesses.** Each hub starts with AI-owned business units in its specialty industries, so the world economy runs from the first hour.

## 3. Districts and "buildings"

**There are no individual buildings or plots.** This was decided in October: property is **pooled**.

- Each district has a **type**: Financial, Tech Park, Port, Industrial, Residential, Slums or Resource Field. The type sets which industries put assets there and how much the district weighs in the hub's mass (Financial weighs the most).
- Each district has up to four **pools**: **Commercial** (offices, retail, hotels, labs), **Residential** (housing), **Industrial** (plants, fabs, warehouses, data center shells, ports, refineries) and **Land** (undeveloped).
- You **buy any dollar amount** of a pool at its current price, plus 2% fees. Selling is fast in a boom and slow in a bust (a share of the pool can sell each month; the rest queues).
- **Rent.** You choose how much of your holding to rent out. Tenants are residents (Residential) and business units (Commercial and Industrial). Rent rises with occupancy.
- **Price** moves monthly with the hub's **property cycle** (Boom, Peak, Bust, Recovery), occupancy and interest rates. A Boom that lasts over three years becomes a bubble.
- **Developing land.** A Land share can be turned into Commercial, Residential or Industrial in the same district for a build cost and 12 to 24 months.
- **Districts change.** Slums can gentrify, governments or powerful players can clear slums, and run-down Residential districts can slide into Slums.

## 4. How companies sit on the map

- A corporation has **business units**, one per industry. Each unit has a **base city** (its HQ) and an **asset spread**: its business assets (one dollar figure) can be spread across several cities.
- Where the assets sit decides **where profit is taxed**, **where the unit gains influence** and **which location perks it can meet**. The assets sit in the district that fits the industry, and the unit **rents or buys its space** from that district's Commercial or Industrial pool. If there is no space, it has to rent elsewhere, buy out owners or develop land.
- **Data centers** can be built in any city where the company holds business assets or real estate, limited by the property and power it has there ([15-infrastructure.md](../detailed/15-infrastructure.md)). Or the company rents cloud space from cloud companies.
- **Foreign companies** face a restriction label per country (Open, Screened, Guarded, Restricted, Closed), built from that country's ownership and capital laws, plus an influence penalty for being foreign.

## 5. Influence: power by place

- Influence is a **share** (0 to 100%) per holder per place: district, hub, region and country. Holders are characters, trusts, companies, dynasties and governments.
- It comes mostly from **assets in the place**: real estate (weight 1.0), business assets (1.0), **payroll** (1.5, so employers get the most power per dollar), local bonds, stakes in local companies, media outlets and audience, and money held at local banks.
- It is then changed by birthplace and history, foreignness, offices held, and **temporary boosts** from ads, psyops, sponsorships and galas.
- **Tiers**: **Presence** (10%), **Power broker** (25%) and **Kingmaker** (50%). Districts give economic perks only (early look at new construction, first refusal, vetoes). Hubs and up give political perks: free meetings with officials, rezoning, appointments, vetoing rivals' permits, protection from investigations. Influence also feeds **Political Capital** for the politics system ([4-politics.md](../detailed/4-politics.md)).
- Kingmaker in a hub for a year is the first step toward **corporate sovereignty**: running a city as your own zone.

## 6. Everything else tied to places

| System | How it uses geography |
|---|---|
| **Politics** | Countries, regions and hubs each have their own government level, laws and offices. Elections, lobbying and bribes target a level. |
| **Population** | Each hub has a labor force split into strata and segments, with needs, wages, unrest, unions and strikes. |
| **Money** | Each major country has its own currency, central bank, rate and exchange; prices convert at live exchange rates ([3-markets-and-fx.md](../detailed/3-markets-and-fx.md)). Wage and price indexes per country scale wages, property and building costs. |
| **Cycles** | A business cycle per country (with a global cycle on top), and a property cycle per hub. |
| **Taxes** | Corporate tax per country on profit earned there; property, rent and capital gains taxes per country; havens through shells. |
| **Characters** | Every character has a **current location** and a **residence** (which sets their tax home). Most meetings need both people in the same hub; remote calls work at -30%. The dynasty has a **seat** hub. |
| **Travel** | Car, helicopter, commercial flights, charters, fractional or owned private jets, superyachts, and late-game suborbital hops. Travel time blocks most other actions; flights can be tracked. |
| **Intel** | An intel level per hub and per rival company, raised by presence, market research, board analysts and espionage. It sets how accurate your estimates are. |
| **Risk** | Chokepoint risk, wars, sanctions, nationalization and disasters hit the places and industries exposed to them. |
| **Map screen** | Zoom from world to country to hub to district, with overlays for ownership, influence, property cycle, economic cycle, unrest, politics and risk. |

## 7. Problems found while reading

1. ~~Country count~~ **Fixed:** Qatar is now the 31st major country.
2. ~~Doha in a minor group~~ **Fixed:** Doha now belongs to Qatar.
3. ~~Size classes~~ **Fixed:** Edmonton is now S (6 districts), Medellín M (10), Sydney L (14).
4. ~~GDP figures~~ **Fixed:** set to the alternate January 2020 (real 2019 values; US about 10% larger, eurozone about 20% smaller in dollars, Russia about 30% smaller).
5. **Countries now central to the history have no hubs.** Ukraine (the drone war front), Greece (the default), Mali (the US debt vassal) and Iran (the holdout) all sit inside minor groups.
6. **Characters' homes aren't modeled.** John's paid executive lease in Edmonton and rivals' mansions don't sit in the Residential pools or anywhere else.
