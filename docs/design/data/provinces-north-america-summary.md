# North America provinces: summary

Generated from `provinces-north-america.csv` (batch 118 test slice). Built by a python script with hand-authored rows; Population follows the spec guide (2 + 3 x log2(pop in millions x 10)) from rough 2020 population estimates (A). Commerce and Industry are hand-set (T). Names are ASCII (accents dropped) (A). Coastal Y includes Great Lakes shores (A).

## Totals

| Country | Provinces | Target | Regions | Areas | Total development |
|---|---|---|---|---|---|
| USA | 146 | about 140 | 51 | 59 | 4686 |
| CAN | 59 | about 59 | 13 | 19 | 1084 |
| MEX | 49 | about 46 | 32 | 32 | 1536 |
| **All** | **254** | about 245 | 96 | 110 | 7306 |

## Provinces per region

- **USA:** Alabama 2, Alaska 2, Arizona 2, Arkansas 2, California 14, Colorado 3, Connecticut 2, Delaware 1, District of Columbia 1, Florida 7, Georgia 4, Hawaii 1, Idaho 1, Illinois 5, Indiana 3, Iowa 2, Kansas 2, Kentucky 2, Louisiana 3, Maine 1, Maryland 2, Massachusetts 2, Michigan 3, Minnesota 2, Mississippi 1, Missouri 2, Montana 2, Nebraska 1, Nevada 3, New Hampshire 1, New Jersey 3, New Mexico 2, New York 7, North Carolina 3, North Dakota 2, Ohio 4, Oklahoma 2, Oregon 2, Pennsylvania 5, Rhode Island 1, South Carolina 2, South Dakota 1, Tennessee 3, Texas 16, Utah 2, Vermont 1, Virginia 3, Washington 3, West Virginia 1, Wisconsin 2, Wyoming 2
- **CAN:** Ontario 14, Quebec 11, British Columbia 7, Alberta 7, Saskatchewan 4, Manitoba 3, Nova Scotia 3, New Brunswick 2, Newfoundland and Labrador 3, Prince Edward Island 1, Yukon 1, Northwest Territories 1, Nunavut 2
- **MEX:** Ciudad de Mexico 3, Estado de Mexico 3, Jalisco 4, Nuevo Leon 4, Veracruz 2, Puebla 1, Guanajuato 2, Queretaro 1, Chihuahua 2, Sonora 2, Baja California 2, Baja California Sur 1, Coahuila 2, Tamaulipas 2, Michoacan 1, Oaxaca 1, Chiapas 1, Guerrero 1, Sinaloa 1, Durango 1, Yucatan 1, Quintana Roo 1, San Luis Potosi 1, Hidalgo 1, Zacatecas 1, Tabasco 1, Campeche 1, Morelos 1, Aguascalientes 1, Nayarit 1, Colima 1, Tlaxcala 1

## Metros

Commerce/Industry/Population shares of the Metro's total, against the old district mix (Financial + Tech / Industrial + Port + Resource / Residential + Slums).

| Metro | Size | Provinces | Total dev | C/I/P now | Old mix C/I/P |
|---|---|---|---|---|---|
| New York | Mega | Fairfield County (Connecticut, 30), North Jersey-Newark (New Jersey, 37), Jersey City-Hudson Waterfront (New Jersey, 31), Manhattan (New York, 52), Brooklyn-Queens (New York, 35), Bronx-Westchester (New York, 31), Long Island (New York, 30) | 246 | 39%/18%/43% | 33%/17%/50% |
| Los Angeles-Long Beach | XL | Downtown Los Angeles (California, 42), Westside-Hollywood (California, 34), Long Beach-Harbor (California, 42), San Fernando Valley (California, 33), Orange County (California, 41) | 192 | 27%/33%/40% | 17%/39%/44% |
| Chicago | L | Chicago Loop (Illinois, 49), South Side-Calumet (Illinois, 41), DuPage-Northwest Suburbs (Illinois, 38) | 128 | 35%/27%/38% | 29%/36%/36% |
| Houston | L | Houston Central (Texas, 42), Ship Channel-Baytown (Texas, 47), Woodlands-Katy (Texas, 34) | 123 | 20%/44%/37% | 7%/57%/36% |
| Bay Area | L | San Francisco (California, 42), Silicon Valley (California, 49), East Bay (California, 39) | 130 | 48%/20%/32% | 43%/14%/43% |
| Toronto | L | Downtown Toronto (Ontario, 45), Peel-Mississauga (Ontario, 37), York-Markham (Ontario, 30) | 112 | 37%/25%/38% | 29%/29%/43% |
| Washington DC | L | Washington DC (District of Columbia, 32), Suburban Maryland (Maryland, 33), Northern Virginia (Virginia, 42) | 107 | 47%/15%/38% | 36%/7%/57% |
| Dallas-Fort Worth | L | Dallas (Texas, 44), Fort Worth-Arlington (Texas, 39), Plano-Frisco (Texas, 34) | 117 | 37%/24%/39% | 36%/21%/43% |
| Atlanta | L | Downtown Atlanta-Midtown (Georgia, 34), Hartsfield-South Metro (Georgia, 37), North Fulton-Cobb (Georgia, 34) | 105 | 32%/26%/42% | 21%/29%/50% |
| Miami | L | Miami-Dade (Florida, 41), Fort Lauderdale-Broward (Florida, 33), Palm Beach (Florida, 32) | 106 | 40%/18%/42% | 29%/14%/57% |
| Mexico City | Mega | Cuauhtemoc-Centro (Ciudad de Mexico, 37), Polanco-Santa Fe (Ciudad de Mexico, 34), Iztapalapa-Coyoacan (Ciudad de Mexico, 37), Ecatepec-Nezahualcoyotl (Estado de Mexico, 36), Naucalpan-Tlalnepantla (Estado de Mexico, 41) | 185 | 23%/32%/45% | 12%/33%/54% |
| Monterrey | L | Monterrey Centro-San Pedro (Nuevo Leon, 39), Apodaca-Escobedo (Nuevo Leon, 41), Guadalupe-Santa Catarina (Nuevo Leon, 33) | 113 | 19%/42%/39% | 14%/43%/43% |
| Guadalajara | L | Guadalajara Centro (Jalisco, 33), Zapopan (Jalisco, 34), Tlaquepaque-El Salto (Jalisco, 32) | 99 | 22%/34%/43% | 14%/29%/57% |

Single city provinces for former hubs under 5M: Phoenix (45), Edmonton (32), Boston (48), Seattle (46), Austin (38), Detroit (49), Las Vegas (33), Vancouver (39), Montreal (44), Ottawa (27).

## Top 15 provinces by total development

| Rank | Province | Region | Metro | C | I | P | Total |
|---|---|---|---|---|---|---|---|
| 1 | Manhattan | New York | New York | 30 | 4 | 18 | 52 |
| 2 | Silicon Valley | California | Bay Area | 24 | 10 | 15 | 49 |
| 3 | Chicago Loop | Illinois | Chicago | 28 | 5 | 16 | 49 |
| 4 | Detroit | Michigan | - | 12 | 18 | 19 | 49 |
| 5 | Boston | Massachusetts | - | 22 | 7 | 19 | 48 |
| 6 | Ship Channel-Baytown | Texas | Houston | 5 | 28 | 14 | 47 |
| 7 | Seattle | Washington | - | 19 | 10 | 17 | 46 |
| 8 | Phoenix | Arizona | - | 14 | 12 | 19 | 45 |
| 9 | Minneapolis-Saint Paul | Minnesota | - | 16 | 11 | 18 | 45 |
| 10 | Downtown Toronto | Ontario | Toronto | 25 | 4 | 16 | 45 |
| 11 | Denver-Front Range | Colorado | - | 16 | 10 | 18 | 44 |
| 12 | Dallas | Texas | Dallas-Fort Worth | 20 | 8 | 16 | 44 |
| 13 | Montreal | Quebec | - | 15 | 11 | 18 | 44 |
| 14 | Philadelphia | Pennsylvania | - | 14 | 11 | 18 | 43 |
| 15 | Puebla | Puebla | - | 8 | 15 | 20 | 43 |

## Resource tags

| Tag | Count | Provinces |
|---|---|---|
| None | 108 | |
| Farmland | 46 | Mobile-South Alabama, Little Rock-Arkansas Delta, Central Coast, Tampa Bay, Savannah-South Georgia, Idaho, Central Illinois, Indianapolis, Des Moines-Western Iowa, Eastern Iowa, Wichita-Western Kansas, Louisville-Bluegrass, West Michigan, Minneapolis-Saint Paul, Mississippi, Kansas City-Western Missouri, Nebraska, Central New York, Eastern North Carolina, Fargo-Eastern North Dakota, Toledo-Northwest Ohio, Lancaster-Harrisburg, South Dakota, Memphis-West Tennessee, Rio Grande Valley, Panhandle-South Plains, Vermont, Northern and Western Wisconsin, London-Southwestern Ontario, Monteregie-South Shore, Eastern Townships, Surrey-Fraser Valley, Lethbridge-Medicine Hat, Saskatoon, Regina, Southern Manitoba, Prince Edward Island, Toluca-Rural Mexico State, Rural Jalisco, Bajio Industrial Corridor, Hermosillo-Sonora Coast, Mexicali, Michoacan, Sinaloa, San Luis Potosi, Nayarit |
| Oil | 28 | Fairbanks-North Slope, San Joaquin Valley, Eastern Plains-Weld, Baton Rouge-Acadiana, Permian New Mexico, Bakken-Williston, Tulsa-Cushing, East and Central Texas, Houston Central, Ship Channel-Baytown, Woodlands-Katy, Beaumont-Port Arthur, Corpus Christi, Laredo-Eagle Ford, Permian Basin, Rural Utah, Edmonton, Industrial Heartland, Fort McMurray-Cold Lake, Calgary, Red Deer-Central Alberta, Southeast Saskatchewan, St. John's-Avalon, Veracruz-Northern Veracruz, Coatzacoalcos-Southern Veracruz, Tampico-Altamira, Tabasco, Campeche |
| Gas | 12 | Western Slope-Rockies, Western and North Louisiana, Albuquerque-Northern New Mexico, Columbus-Appalachian Ohio, Oklahoma City-Western Oklahoma, Northern Pennsylvania, Pittsburgh, Green River-Western Wyoming, Northeast BC, Grande Prairie-Peace, Rural Nuevo Leon, Reynosa-Nuevo Laredo |
| Coal | 10 | Birmingham-North Alabama, Southern Illinois, Southern Indiana, Eastern Kentucky Coalfields, Eastern Montana, Richmond-Central Virginia, West Virginia, Powder River-Eastern Wyoming, Okanagan-Kootenays, Monclova-Northern Coahuila |
| Timber | 10 | Northwest Arkansas-Ozarks, Sacramento-Northern California, Maine, New Hampshire, Willamette and Eastern Oregon, Tacoma-Olympic, Vancouver Island, Cariboo-Prince George, Saint John-Fredericton, Durango |
| Fishing | 9 | Anchorage-Southcentral, Southwest Florida-Keys, Gaspesie-Bas-Saint-Laurent, North Coast BC, Cape Breton, Annapolis Valley-South Shore, Moncton-Miramichi, Western Newfoundland, Baja California Sur |
| Gold | 9 | Elko-Gold Belt, Timmins-Northeastern Ontario, Northwestern Ontario, Outaouais-Abitibi, Yukon, Kivalliq-Kitikmeot, Chihuahua-Sierra, Guerrero, Zacatecas |
| Hydropower | 8 | Hudson Valley-Capital Region, Western New York, Eastern Washington, Hamilton-Niagara, Mauricie, Nord-du-Quebec, Saguenay-Lac-Saint-Jean, Chiapas |
| Iron ore | 5 | Northern Michigan-Upper Peninsula, Northern Minnesota-Iron Range, Cote-Nord, Labrador, Baffin-Iqaluit |
| Copper | 4 | Tucson-Southern Arizona, Western Montana, Wasatch Front, Cananea-Nogales |
| Lithium | 2 | Imperial-Coachella Valley, Reno-Northern Nevada |
| Nickel | 2 | Sudbury, Northern Manitoba |
| Uranium | 1 | Northern Saskatchewan |

## Other counts

- City rank: City 120, Town 63, Metropolis 57, none 14
- Terrain: Temperate 125, Urban 43, Desert 26, Mountain 25, Tropical 16, Arctic 12, Wetland 7
- Coastal: 106
- Chokepoint exposure: Mobile-South Alabama (Panama Canal); Miami-Dade (Panama Canal; Florida Strait); Fort Lauderdale-Broward (Florida Strait); Palm Beach (Florida Strait); Southwest Florida-Keys (Florida Strait); Tampa Bay (Panama Canal); Savannah-South Georgia (Panama Canal); New Orleans (Panama Canal); Western and North Louisiana (Panama Canal); Mississippi (Panama Canal); North Jersey-Newark (Panama Canal); Charleston-Lowcountry (Panama Canal); Ship Channel-Baytown (Panama Canal; Florida Strait); Beaumont-Port Arthur (Panama Canal); Corpus Christi (Panama Canal); Hampton Roads (Panama Canal); Veracruz-Northern Veracruz (Florida Strait); Coatzacoalcos-Southern Veracruz (Florida Strait); Tampico-Altamira (Florida Strait); Tabasco (Florida Strait); Campeche (Florida Strait)

## Scale deviations (T)

Merged county-cluster provinces carry a whole state's population, so some sit above their rank's development band. Listed for tuning:

- US-0001 Birmingham-North Alabama (City) total 37, scale 15-30
- US-0003 Anchorage-Southcentral (Town) total 18, scale 8-15
- US-0004 Fairbanks-North Slope (Town) total 21, scale 8-15
- US-0006 Tucson-Southern Arizona (City) total 31, scale 15-30
- US-0014 Inland Empire (City) total 42, scale 15-30
- US-0016 Imperial-Coachella Valley (Town) total 21, scale 8-15
- US-0021 San Joaquin Valley (City) total 42, scale 15-30
- US-0022 Sacramento-Northern California (City) total 37, scale 15-30
- US-0024 Eastern Plains-Weld (Town) total 21, scale 8-15
- US-0025 Western Slope-Rockies (Town) total 20, scale 8-15
- US-0027 Central Connecticut (City) total 36, scale 15-30
- US-0034 Orlando-Space Coast (City) total 38, scale 15-30
- US-0035 Tampa Bay (City) total 41, scale 15-30
- US-0036 Jacksonville-North Florida (City) total 35, scale 15-30
- US-0040 Savannah-South Georgia (City) total 32, scale 15-30
- US-0046 Central Illinois (City) total 32, scale 15-30
- US-0047 Southern Illinois (Town) total 20, scale 8-15
- US-0048 Indianapolis (City) total 35, scale 15-30
- US-0049 Northern Indiana (City) total 34, scale 15-30
- US-0050 Southern Indiana (Town) total 22, scale 8-15
- US-0055 Louisville-Bluegrass (City) total 38, scale 15-30
- US-0056 Eastern Kentucky Coalfields (none) total 15, scale 3-8
- US-0057 New Orleans (City) total 31, scale 15-30
- US-0058 Baton Rouge-Acadiana (City) total 34, scale 15-30
- US-0059 Western and North Louisiana (Town) total 28, scale 8-15
- US-0060 Maine (Town) total 22, scale 8-15
- US-0062 Baltimore-Central Maryland (City) total 40, scale 15-30
- US-0066 West Michigan (City) total 33, scale 15-30
- US-0067 Northern Michigan-Upper Peninsula (none) total 19, scale 3-8
- US-0069 Northern Minnesota-Iron Range (Town) total 24, scale 8-15
- US-0070 Mississippi (City) total 31, scale 15-30
- US-0071 St. Louis-Eastern Missouri (City) total 39, scale 15-30
- US-0072 Kansas City-Western Missouri (City) total 34, scale 15-30
- US-0073 Western Montana (Town) total 21, scale 8-15
- US-0074 Eastern Montana (Town) total 22, scale 8-15
- US-0075 Nebraska (City) total 31, scale 15-30
- US-0076 Las Vegas (City) total 33, scale 15-30
- US-0078 Elko-Gold Belt (none) total 13, scale 3-8
- US-0082 Central and South Jersey (City) total 40, scale 15-30
- US-0084 Permian New Mexico (Town) total 24, scale 8-15
- US-0089 Hudson Valley-Capital Region (City) total 32, scale 15-30
- US-0091 Western New York (City) total 35, scale 15-30
- US-0092 Charlotte-Western Carolina (City) total 40, scale 15-30
- US-0093 Triangle-Triad (City) total 41, scale 15-30
- US-0094 Eastern North Carolina (Town) total 25, scale 8-15
- US-0095 Fargo-Eastern North Dakota (Town) total 18, scale 8-15
- US-0096 Bakken-Williston (Town) total 24, scale 8-15
- US-0097 Cleveland-Akron (City) total 42, scale 15-30
- US-0099 Columbus-Appalachian Ohio (City) total 34, scale 15-30
- US-0100 Cincinnati-Dayton (City) total 39, scale 15-30
- US-0101 Oklahoma City-Western Oklahoma (City) total 34, scale 15-30
- US-0102 Tulsa-Cushing (City) total 31, scale 15-30
- US-0103 Portland Oregon (City) total 36, scale 15-30
- US-0108 Northern Pennsylvania (Town) total 24, scale 8-15
- US-0109 Pittsburgh (City) total 38, scale 15-30
- US-0112 Upstate-Midlands (City) total 37, scale 15-30
- US-0113 South Dakota (Town) total 21, scale 8-15
- US-0114 Memphis-West Tennessee (City) total 32, scale 15-30
- US-0115 Nashville (City) total 33, scale 15-30
- US-0116 East Tennessee (City) total 32, scale 15-30
- US-0124 Beaumont-Port Arthur (Town) total 26, scale 8-15
- US-0125 Austin (City) total 38, scale 15-30
- US-0126 San Antonio (City) total 32, scale 15-30
- US-0129 Laredo-Eagle Ford (Town) total 26, scale 8-15
- US-0130 Permian Basin (Town) total 40, scale 8-15
- US-0132 Panhandle-South Plains (Town) total 24, scale 8-15
- US-0133 Wasatch Front (City) total 39, scale 15-30
- US-0134 Rural Utah (Town) total 19, scale 8-15
- US-0135 Vermont (Town) total 17, scale 8-15
- US-0137 Richmond-Central Virginia (City) total 33, scale 15-30
- US-0138 Hampton Roads (City) total 33, scale 15-30
- US-0142 West Virginia (Town) total 27, scale 8-15
- US-0143 Milwaukee-Madison (City) total 38, scale 15-30
- US-0145 Powder River-Eastern Wyoming (Town) total 25, scale 8-15
- US-0146 Green River-Western Wyoming (Town) total 18, scale 8-15
- CA-0005 Central Ontario (Town) total 19, scale 8-15
- CA-0009 Windsor-Essex (Town) total 20, scale 8-15
- CA-0012 Sudbury (Town) total 16, scale 8-15
- CA-0017 Eastern Townships (Town) total 16, scale 8-15
- CA-0020 Outaouais-Abitibi (Town) total 19, scale 8-15
- CA-0021 Nord-du-Quebec (none) total 13, scale 3-8
- CA-0023 Saguenay-Lac-Saint-Jean (Town) total 17, scale 8-15
- CA-0024 Gaspesie-Bas-Saint-Laurent (none) total 10, scale 3-8
- CA-0025 Cote-Nord (none) total 11, scale 3-8
- CA-0026 Vancouver (City) total 39, scale 15-30
- CA-0030 Okanagan-Kootenays (Town) total 21, scale 8-15
- CA-0033 Edmonton (City) total 32, scale 15-30
- CA-0034 Industrial Heartland (Town) total 16, scale 8-15
- CA-0035 Fort McMurray-Cold Lake (Town) total 30, scale 8-15
- CA-0037 Calgary (City) total 35, scale 15-30
- CA-0038 Red Deer-Central Alberta (Town) total 19, scale 8-15
- CA-0043 Northern Saskatchewan (none) total 12, scale 3-8
- CA-0046 Northern Manitoba (none) total 10, scale 3-8
- CA-0050 Saint John-Fredericton (Town) total 20, scale 8-15
- CA-0052 St. John's-Avalon (Town) total 17, scale 8-15
- CA-0054 Labrador (none) total 11, scale 3-8
- MX-0006 Toluca-Rural Mexico State (City) total 37, scale 15-30
- MX-0010 Rural Jalisco (Town) total 28, scale 8-15
- MX-0014 Rural Nuevo Leon (none) total 14, scale 3-8
- MX-0015 Veracruz-Northern Veracruz (City) total 38, scale 15-30
- MX-0016 Coatzacoalcos-Southern Veracruz (City) total 35, scale 15-30
- MX-0018 Leon-Guanajuato (City) total 33, scale 15-30
- MX-0019 Bajio Industrial Corridor (City) total 39, scale 15-30
- MX-0020 Queretaro (City) total 37, scale 15-30
- MX-0021 Ciudad Juarez (City) total 33, scale 15-30
- MX-0022 Chihuahua-Sierra (City) total 31, scale 15-30
- MX-0024 Cananea-Nogales (Town) total 24, scale 8-15
- MX-0025 Tijuana-Ensenada (City) total 36, scale 15-30
- MX-0027 Baja California Sur (Town) total 20, scale 8-15
- MX-0028 Saltillo-La Laguna (City) total 35, scale 15-30
- MX-0029 Monclova-Northern Coahuila (Town) total 25, scale 8-15
- MX-0030 Reynosa-Nuevo Laredo (City) total 31, scale 15-30
- MX-0031 Tampico-Altamira (City) total 32, scale 15-30
- MX-0032 Michoacan (City) total 35, scale 15-30
- MX-0036 Sinaloa (City) total 31, scale 15-30
- MX-0040 San Luis Potosi (City) total 33, scale 15-30
- MX-0041 Hidalgo (City) total 32, scale 15-30
- MX-0043 Tabasco (City) total 34, scale 15-30
- MX-0044 Campeche (Town) total 28, scale 8-15
- MX-0046 Aguascalientes (City) total 31, scale 15-30
- MX-0047 Nayarit (Town) total 20, scale 8-15
- MX-0048 Colima-Manzanillo (Town) total 24, scale 8-15
- MX-0049 Tlaxcala (Town) total 21, scale 8-15
