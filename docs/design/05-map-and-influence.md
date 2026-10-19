# 5. Map and influence

_Summary (consistency pass, batch 74; Batch 118: EU4-style map; Batch 121: only national governments). Full rules: [detailed/2-map-and-influence.md](detailed/2-map-and-influence.md)._

- **Map.** A 2D map of the real modern world in Godot, tiled EU4 style into about 3,200 land provinces, with world, country and province zoom levels and province map modes (political, Commerce, Industry, Population, development, influence, property cycle, resource, terrain, unrest, ideology, chokepoint risk, Metro outlines). Fictional companies, people and brands.
- **Places.** Superregion > Country > Region > Area > Province. About 195 real countries (the 33 major ones with full economy tables). Each province has three development tracks (Commerce, Industry, Population), one resource tag and one terrain. Megacities are **Metros** of 2 to 8 provinces sharing one property cycle (and post-POC metro systems). A **city** is a Metro or a single province ranked City or Metropolis; it holds the city influence perks and the location perks of the 80 former hubs. Only countries have a government: regions, areas, cities and Metros are map groupings with no council, mayor or governor (batch 121).
- **Influence.** Not a skill: the amount a character has in a province, city, area, region or country, mainly from assets owned there, modified by birthplace and boosted by psyops or ads.
- **Strata.** Population is counted by strata, and votes are counted by strata.
- **Real estate** is pooled per province (commercial, residential, industrial, land).
- **Travel.** Location matters; private jets and travel stay.
