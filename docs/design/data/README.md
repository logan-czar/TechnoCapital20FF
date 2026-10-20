# Map data files

Data tables for the EU4-style map (batch 118). Rules live in [../detailed/2-map-and-influence.md](../detailed/2-map-and-influence.md); the approved plan is [../reviews/map-rework-eu4-plan.md](../reviews/map-rework-eu4-plan.md). Values marked (A) are assumptions and (T) are tuning values.

## countries.csv

One row per country or dependent territory: 197 sovereign states (the 193 UN members plus Taiwan, Kosovo, Palestine and Vatican City) and 9 territories (Cayman Islands, British Virgin Islands, Bermuda, Jersey, Guernsey, Hong Kong, Greenland, Puerto Rico, Saint Pierre and Miquelon). 206 rows.

| Column | Meaning |
|---|---|
| iso3 | ISO 3166 alpha-3 code (Kosovo uses the user code XKX) |
| name | Country name |
| superregion | One of the 8 superregions: North America, Latin America, Europe, Russia and Central Asia, Middle East and North Africa, Sub-Saharan Africa, South Asia, East Asia and Oceania |
| currency | The country's real currency, as flavor only (names, news, history). Every simulated value is in USD; there is no FX in the POC (batch 125) |
| gdp_usd_bn | GDP in $ billions at the alternate January 2020 start. The 33 majors copy 2.2.3 exactly. Others: real 2019 values, eurozone and other euro users -20%, Greece a further -25% for its default, Puerto Rico +10% with the US; a few history cases set by hand (Syria, Libya, Venezuela, Afghanistan, Iran) and noted in the row (A) |
| population_m | Population in millions, real 2019 |
| wealth_index | WI (2.2.3 calls it the wage index). The 33 majors copy 2.2.3. Others use a fit over the majors: WI = 1.065 × (GDP per head / US GDP per head)^0.707, clamped 0.02 to 1.20 (T) |
| major | Y for the 33 former major countries |
| government_type | Copied from 4-politics 4.2.4 where the country is listed; otherwise assumed from the 19.22 start world and marked (A) in notes |
| restriction_label | Open, Screened, Guarded, Restricted or Closed. Majors copy 2.2.4; others take the typical restriction of their old minor group (2.2.5), with overrides marked (A) in notes |
| subject_of | Debt vassalage overlord (4.11.8): Mali to USA; Pakistan and Sri Lanka to CHN |
| provinces_planned | Planned land provinces (T). Formula 0.45 × sqrt(land area, thousand km²) + 2 × sqrt(population M) + sqrt(GDP $bn), scaled so the world sums to 3,200, capped at one province per 300 km², minimum 1; microstates and small islands are 1; a few set by hand (Greenland 3, Iceland 3, Singapore 3, Hong Kong 3, Luxembourg 1, Malta 1) |
| notes | Old minor group (with (A) when the country was not named in that group), sovereign of a territory, resources, and which fields are assumed |

Hong Kong is a separate row (SAR) because the docs give it its own currency and laws (2.3.3); China's major-country GDP and population still include it, so do not sum the two.

## provinces-north-america.csv

Being built by another worker: the North America test slice of the province list (United States, Canada, Mexico, Greenland, Bermuda, Saint Pierre and Miquelon). Columns, from the batch 118 spec:

id, name, country, region, area, metro, city_rank, commerce, industry, population, resource, terrain, coastal, chokepoint_exposure, former_hub, notes

- region: a real first-level division (state, province, territory). area: 3 to 6 neighbouring provinces inside one region. metro: blank if none.
- city_rank: Metropolis, City, Town or none. commerce, industry, population: development tracks, integers 1 to 30.
- resource: Oil, Gas, Coal, Copper, Lithium, Cobalt, Nickel, Rare earths, Iron ore, Gold, Uranium, Timber, Farmland, Fishing, Hydropower or None.
- terrain: Urban, Temperate, Desert, Arctic, Tropical, Mountain or Wetland. coastal: Y or N. former_hub: the 2.3.3 hub it came from, if any.

The exact column spelling is set by that worker's file; check its header.

## provinces-europe.csv

The Europe slice (batch 121 follow-up, 2026-10-19): 679 provinces in 51 countries, same columns and rules as provinces-north-america.csv. Ids use ISO alpha-2 prefixes. Russian-held Crimea and Donbas rows have country RUS, keep UA ids and count in Ukraine's budget. 13 Metros (London, Paris, Rhine-Ruhr, Madrid, Barcelona, Milan, Berlin, Hamburg, Munich, Frankfurt, Stuttgart, Istanbul, Ankara). Summary: provinces-europe-summary.md. Gibraltar (GIB), the Isle of Man (IMN) and the Faroes (FRO) have their own country rows (batch 122); France's overseas regions stay inside France (A). Batch 122 added two columns to both province files: `contested` (blank, or who disputes the province, e.g. "UKR claims") and `linked_cities` (a group of separate cities that work as one economy without being a Metro; only Randstad so far).

## provinces-latin-america.csv

The Latin America slice (batch 123, 2026-10-19): 391 provinces in 35 countries and territories, same columns and rules as the Europe file. 7 Metros: São Paulo (4), Rio de Janeiro (4), Buenos Aires (4), Lima (3), Bogotá (3), Santiago (2), Belo Horizonte (2). Contested: the Essequibo (VEN claims), Berbice-Linden (SUR claims) and southern Belize (GTM claims). Where a country has fewer provinces than first-level divisions, neighbouring divisions share one region (A). Papa's Port (PP-0001, country PAP, batch 124) is the Falklands micronation under Argentina, added after the build, so the slice now has 392 rows. Papa's Port's flavor currency is USD. Summary: provinces-latin-america-summary.md.

## provinces-east-asia-oceania.csv

The East Asia and Oceania slice (batch 124, 2026-10-19): 606 provinces in 32 countries and territories, same columns and rules. 34 Metros covering 114 provinces (17 former hubs, 17 other 5M+ cities, mostly Chinese). Contested: every Taiwan province (CHN claims) and Sabah (PHL claims). Macau is a region inside China (no country row) (A). Chinese provinces are much larger than their cities, so city rank used a city population table in the generator, not province population. Summary: provinces-east-asia-oceania-summary.md.
