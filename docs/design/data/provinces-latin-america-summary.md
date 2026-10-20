# Latin America province slice: summary (2026-10-19)

Batch 125 card (Logan): former hubs list scrapped; key cities hold perks and starting businesses; Metros only from the 5M+ rule. The `former_hub` column is gone from the CSV; each key city's province ids are in [2-map-and-influence.md](../detailed/2-map-and-influence.md) 2.3.3, and the "Old mix" column below is a historical check only (the old district mix no longer seeds anything).

_Generated from [provinces-latin-america.csv](provinces-latin-america.csv) (batch 123). Same columns and rules as the North America and Europe slices, including `contested` and `linked_cities` (batch 122). Population follows the spec formula from rough 2019-2020 population estimates (A); Commerce and Industry are hand-set (T). Names are ASCII (accents dropped) (A)._

**Total:** 391 provinces in 35 countries and territories (plan 388). Metros: 7. World plan in countries.csv: 3221; with this slice's actual counts it would be 3224.

## Provinces per country

| Country | Name | Provinces | Plan | Regions | Areas | Total development |
|---|---|---|---|---|---|---|
| BRA | Brazil | 67 | 67 | 27 | 29 | 2223 |
| ARG | Argentina | 35 | 35 | 24 | 25 | 902 |
| COL | Colombia | 29 | 28 | 25 | 25 | 776 |
| PER | Peru | 27 | 25 | 25 | 25 | 641 |
| CHL | Chile | 22 | 22 | 16 | 16 | 535 |
| VEN | Venezuela | 22 | 22 | 20 | 20 | 575 |
| BOL | Bolivia | 17 | 17 | 9 | 9 | 335 |
| ECU | Ecuador | 15 | 15 | 15 | 15 | 339 |
| CUB | Cuba | 13 | 13 | 13 | 13 | 265 |
| GTM | Guatemala | 13 | 13 | 13 | 13 | 295 |
| PRY | Paraguay | 12 | 12 | 12 | 12 | 197 |
| DOM | Dominican Republic | 11 | 11 | 10 | 10 | 239 |
| HND | Honduras | 10 | 10 | 10 | 10 | 199 |
| PAN | Panama | 10 | 10 | 10 | 10 | 160 |
| URY | Uruguay | 10 | 10 | 10 | 10 | 147 |
| CRI | Costa Rica | 9 | 9 | 7 | 7 | 192 |
| PRI | Puerto Rico | 9 | 9 | 1 | 2 | 180 |
| NIC | Nicaragua | 8 | 8 | 8 | 8 | 149 |
| HTI | Haiti | 7 | 7 | 7 | 7 | 137 |
| SLV | El Salvador | 7 | 7 | 7 | 7 | 153 |
| GUY | Guyana | 6 | 6 | 6 | 6 | 62 |
| SUR | Suriname | 6 | 6 | 6 | 6 | 60 |
| JAM | Jamaica | 5 | 5 | 5 | 5 | 103 |
| TTO | Trinidad and Tobago | 5 | 5 | 5 | 5 | 102 |
| BHS | Bahamas | 4 | 4 | 4 | 4 | 48 |
| BLZ | Belize | 3 | 3 | 3 | 3 | 32 |
| ATG | Antigua and Barbuda | 1 | 1 | 1 | 1 | 11 |
| BRB | Barbados | 1 | 1 | 1 | 1 | 20 |
| CYM | Cayman Islands | 1 | 1 | 1 | 1 | 19 |
| DMA | Dominica | 1 | 1 | 1 | 1 | 6 |
| GRD | Grenada | 1 | 1 | 1 | 1 | 8 |
| KNA | Saint Kitts and Nevis | 1 | 1 | 1 | 1 | 8 |
| LCA | Saint Lucia | 1 | 1 | 1 | 1 | 12 |
| VCT | Saint Vincent and the Grenadines | 1 | 1 | 1 | 1 | 7 |
| VGB | British Virgin Islands | 1 | 1 | 1 | 1 | 14 |
| **All** | | **391** | 388 | 307 | 311 | 9151 |

Counts that differ from the plan (all within +/-10%): COL 29 (plan 28), PER 27 (plan 25).

## Regions

Regions are the real first-level divisions (Brazilian states and the Federal District, Argentine provinces and Buenos Aires city, Chilean regions, Colombian departments and Bogota, Peruvian regions and Callao, Venezuelan states, Panamanian and Costa Rican provinces, Cuban provinces, and so on). Where a country has fewer provinces than divisions, neighbouring divisions are grouped into one region whose name joins theirs, for example Caldas-Risaralda-Quindio or Amazonas-Guainia-Guaviare-Vaupes-Vichada (A). The Dominican Republic uses its 10 official development regions (Ozama, Cibao Norte, ...) because its 32 provinces are far more than its 11 planned map provinces (A). Puerto Rico has no level between the island and its 78 municipalities, so it is one region with two areas (A). Panama's indigenous comarcas are counted in the neighbouring province (A). A default area that shares its name with a region elsewhere gets the country name in brackets.

- **BRA:** Sao Paulo 9, Rio de Janeiro 6, Minas Gerais 7, Espirito Santo 2, Parana 3, Santa Catarina 3, Rio Grande do Sul 4, Bahia 5, Pernambuco 2, Ceara 2, Para 3, Amazonas 2, Maranhao 2, Goias 2, Distrito Federal 1, Mato Grosso 3, Mato Grosso do Sul 1, Paraiba 1, Rio Grande do Norte 1, Alagoas 1, Sergipe 1, Piaui 1, Tocantins 1, Rondonia 1, Acre 1, Amapa 1, Roraima 1
- **ARG:** Ciudad de Buenos Aires 1, Buenos Aires 8, Cordoba 2, Santa Fe 3, Mendoza 2, Tucuman 1, Salta 1, Jujuy 1, Catamarca 1, Neuquen 1, Rio Negro 1, Chubut 1, Santa Cruz 1, Tierra del Fuego 1, San Juan 1, La Rioja 1, San Luis 1, Santiago del Estero 1, Chaco 1, Formosa 1, Corrientes 1, Misiones 1, Entre Rios 1, La Pampa 1
- **COL:** Bogota 2, Cundinamarca 2, Antioquia 2, Valle del Cauca 2, Atlantico 1, Bolivar 1, Santander 1, Norte de Santander 1, Cordoba 1, Sucre 1, Magdalena 1, La Guajira 1, Cesar 1, Boyaca 1, Tolima 1, Huila 1, Caldas-Risaralda-Quindio 1, Narino 1, Cauca 1, Meta 1, Arauca-Casanare 1, Choco 1, Caqueta-Putumayo 1, Amazonas-Guainia-Guaviare-Vaupes-Vichada 1, San Andres y Providencia 1
- **PER:** Lima 3, Callao 1, Arequipa 1, La Libertad 1, Piura 1, Lambayeque 1, Cajamarca 1, Ancash 1, Junin 1, Cusco 1, Apurimac 1, Puno 1, Moquegua 1, Tacna 1, Ica 1, Ayacucho 1, Huancavelica 1, Huanuco 1, Pasco 1, San Martin 1, Loreto 1, Ucayali 1, Madre de Dios 1, Amazonas 1, Tumbes 1
- **CHL:** Arica y Parinacota 1, Tarapaca 1, Antofagasta 2, Atacama 1, Coquimbo 1, Valparaiso 2, Santiago Metropolitan 3, O'Higgins 1, Maule 1, Nuble 1, Biobio 2, Araucania 1, Los Rios 1, Los Lagos 2, Aysen 1, Magallanes 1
- **VEN:** Distrito Capital 1, Miranda 1, La Guaira 1, Zulia 2, Carabobo 1, Aragua 1, Lara-Yaracuy 1, Anzoategui 1, Monagas-Delta Amacuro 1, Bolivar 2, Falcon 1, Tachira 1, Merida-Trujillo 1, Barinas 1, Portuguesa-Cojedes 1, Guarico 1, Sucre 1, Nueva Esparta 1, Apure 1, Amazonas 1
- **BOL:** La Paz 3, Santa Cruz 3, Cochabamba 2, Potosi 2, Oruro 1, Chuquisaca 2, Tarija 2, Beni 1, Pando 1
- **ECU:** Pichincha 1, Guayas 1, Santa Elena 1, Manabi 1, El Oro 1, Los Rios 1, Esmeraldas 1, Santo Domingo de los Tsachilas 1, Azuay-Canar 1, Loja-Zamora Chinchipe 1, Tungurahua-Cotopaxi-Chimborazo-Bolivar 1, Imbabura-Carchi 1, Sucumbios-Orellana 1, Napo-Pastaza-Morona Santiago 1, Galapagos 1
- **CUB:** La Habana 1, Artemisa-Mayabeque 1, Pinar del Rio 1, Matanzas 1, Villa Clara-Cienfuegos 1, Sancti Spiritus-Ciego de Avila 1, Camaguey 1, Las Tunas 1, Holguin 1, Granma 1, Santiago de Cuba 1, Guantanamo 1, Isla de la Juventud 1
- **GTM:** Guatemala 1, Sacatepequez-Chimaltenango 1, Escuintla 1, Quetzaltenango-Totonicapan 1, San Marcos 1, Retalhuleu-Suchitepequez 1, Solola-Quiche 1, Huehuetenango 1, Alta Verapaz-Baja Verapaz 1, Peten 1, Izabal 1, Zacapa-Chiquimula-El Progreso 1, Jutiapa-Jalapa-Santa Rosa 1
- **PRY:** Asuncion 1, Central 1, Alto Parana 1, Itapua 1, Cordillera-Paraguari 1, Caaguazu 1, Canindeyu-Amambay 1, San Pedro-Concepcion 1, Guaira-Caazapa 1, Misiones-Neembucu 1, Presidente Hayes 1, Boqueron-Alto Paraguay 1
- **DOM:** Ozama 1, Cibao Norte 1, Cibao Sur 1, Cibao Nordeste 1, Cibao Noroeste 1, Valdesia 1, Enriquillo 1, El Valle 1, Higuamo 1, Yuma 2
- **HND:** Francisco Morazan 1, Cortes 1, Atlantida-Islas de la Bahia 1, Colon-Gracias a Dios 1, Yoro 1, Olancho-El Paraiso 1, Comayagua-La Paz-Intibuca 1, Copan-Ocotepeque 1, Santa Barbara-Lempira 1, Choluteca-Valle 1
- **PAN:** Panama 1, Panama Oeste 1, Colon 1, Chiriqui 1, Bocas del Toro 1, Cocle 1, Veraguas 1, Herrera 1, Los Santos 1, Darien 1
- **URY:** Montevideo 1, Canelones 1, Maldonado-Rocha 1, Colonia-San Jose 1, Soriano-Rio Negro 1, Paysandu-Salto 1, Artigas-Rivera 1, Tacuarembo-Durazno 1, Cerro Largo-Treinta y Tres-Lavalleja 1, Florida-Flores 1
- **CRI:** San Jose 2, Alajuela 2, Heredia 1, Cartago 1, Guanacaste 1, Puntarenas 1, Limon 1
- **PRI:** Puerto Rico 9
- **NIC:** Managua 1, Masaya-Granada-Carazo 1, Leon-Chinandega 1, Rivas 1, Matagalpa-Jinotega 1, Esteli-Madriz-Nueva Segovia 1, Chontales-Boaco-Rio San Juan 1, North and South Caribbean Coast 1
- **HTI:** Ouest 1, Artibonite 1, Nord and Nord-Est 1, Nord-Ouest 1, Centre 1, Sud, Nippes and Grand'Anse 1, Sud-Est 1
- **SLV:** San Salvador 1, La Libertad 1, Santa Ana-Ahuachapan 1, Sonsonate 1, Chalatenango-Cuscatlan-Cabanas 1, La Paz-San Vicente-Usulutan 1, San Miguel-Morazan-La Union 1
- **GUY:** Demerara-Mahaica 1, Pomeroon-Supenaam and Essequibo Islands-West Demerara 1, Barima-Waini 1, Cuyuni-Mazaruni and Potaro-Siparuni 1, Upper Takutu-Upper Essequibo 1, Berbice and Upper Demerara 1
- **SUR:** Paramaribo 1, Wanica-Para 1, Commewijne-Marowijne 1, Nickerie-Coronie-Saramacca 1, Brokopondo 1, Sipaliwini 1
- **JAM:** Kingston and St Andrew 1, St Catherine 1, Clarendon-Manchester-St Elizabeth 1, St James-Hanover-Westmoreland-Trelawny 1, St Ann-St Mary-Portland-St Thomas 1
- **TTO:** Port of Spain-Diego Martin-San Juan-Laventille 1, Tunapuna-Piarco-Arima-Chaguanas-Sangre Grande 1, Couva-Tabaquite-Talparo 1, Southern Trinidad 1, Tobago 1
- **BHS:** New Providence 1, Grand Bahama 1, Northern Family Islands 1, Southern Family Islands 1
- **BLZ:** Belize-Orange Walk-Corozal 1, Cayo 1, Stann Creek-Toledo 1

## Metros (7)

Commerce/Industry/Population shares of the Metro's total, against the old district mix for key cities (Financial + Tech / Industrial + Port + Resource / Residential + Slums).

| Metro | Size | Pop (M) | Provinces (region, total) | Total dev | C/I/P | Old mix C/I/P |
|---|---|---|---|---|---|---|
| Sao Paulo | Mega | 22 | Sao Paulo Centro-Faria Lima (Sao Paulo, 52), Sao Paulo Zona Leste-Guarulhos (Sao Paulo, 43), ABC Paulista-Zona Sul (Sao Paulo, 46), Santos-Baixada Santista (Sao Paulo, 39) | 180 | 25%/33%/42% | 17%/33%/50% |
| Buenos Aires | XL | 15 | Buenos Aires Centro-Puerto Madero (Ciudad de Buenos Aires, 44), Zona Norte-Tigre (Buenos Aires, 40), Zona Oeste-La Matanza (Buenos Aires, 35), Zona Sur-Avellaneda (Buenos Aires, 39) | 158 | 26%/29%/45% | 17%/33%/50% |
| Rio de Janeiro | XL | 13 | Rio Centro-Zona Sul (Rio de Janeiro, 45), Barra-Zona Oeste (Rio de Janeiro, 36), Baixada Fluminense (Rio de Janeiro, 36), Niteroi-Sao Goncalo (Rio de Janeiro, 35) | 152 | 28%/28%/45% | 11%/33%/56% |
| Bogota | XL | 10.9 | Bogota Chapinero-Norte (Bogota, 43), Bogota Sur-Occidente (Bogota, 36), Sabana-Soacha (Cundinamarca, 32) | 111 | 27%/27%/46% | not a key city |
| Lima | XL | 10.7 | Lima Centro-San Isidro (Lima, 44), Lima Norte-Este (Lima, 37), Callao (Callao, 35) | 116 | 27%/31%/42% | not a key city |
| Santiago | L | 6.8 | Santiago Oriente-Sanhattan (Santiago Metropolitan, 43), Santiago Poniente-Sur (Santiago Metropolitan, 38) | 81 | 35%/22%/43% | 29%/21%/50% |
| Belo Horizonte | L | 6.0 | Belo Horizonte Centro-Pampulha (Minas Gerais, 39), Contagem-Betim (Minas Gerais, 41) | 80 | 26%/32%/41% | not a key city |

Key cities Sao Paulo (Mega, 4 provinces with the port of Santos), Rio de Janeiro (XL, 4), Buenos Aires (XL, 4; the core is Buenos Aires city, the rest are in Buenos Aires province) and Santiago (L, 2) are Metros by the 5M+ rule, with the shapes first planned in the old hub list. Three cities that are not key cities pass 5M and become Metros by the batch 119 rule: Lima (10.7M, XL, 3 provinces with Callao), Bogota (10.9M, XL, 3 with the Sabana and Soacha in Cundinamarca) and Belo Horizonte (6.0M, L, 2). No other Latin American city reaches 5M: Brasilia (4.7M with its ring), Guayaquil (about 4.4M as a province, 3M as a city), Porto Alegre (4.3M), Recife and Fortaleza (4.1M), Medellin (4.0M), Salvador (3.9M), Curitiba (3.8M), Santo Domingo (3.6M), Campinas (3.3M) and Guatemala City (3.1M) are single Metropolis or City provinces (A).

Single provinces for key cities under 5M: Antofagasta (City, total 37), Medellin (Metropolis, total 42). No Central American or Caribbean city is a key city.

## Contested provinces (batch 123)

| Province | Owner | Contested | Dispute |
|---|---|---|---|
| Essequibo Coast-West Demerara (GY-0002) | GUY | VEN claims | Venezuela claims the Essequibo, all of Guyana west of the Essequibo river (and the sea off it, including the Stabroek oil block) |
| Barima-Waini (GY-0003) | GUY | VEN claims | Venezuela claims the Essequibo, all of Guyana west of the Essequibo river (and the sea off it, including the Stabroek oil block) |
| Cuyuni-Mazaruni-Potaro (GY-0004) | GUY | VEN claims | Venezuela claims the Essequibo, all of Guyana west of the Essequibo river (and the sea off it, including the Stabroek oil block) |
| Rupununi (GY-0005) | GUY | VEN claims | Venezuela claims the Essequibo, all of Guyana west of the Essequibo river (and the sea off it, including the Stabroek oil block) |
| Berbice-Linden (GY-0006) | GUY | SUR claims | Suriname claims the New River Triangle (Tigri area) in the south of East Berbice-Corentyne |
| Belmopan-Cayo (BZ-0002) | BLZ | GTM claims | Guatemala claims Belize south of the Sibun river; case at the ICJ since 2019 |
| Stann Creek-Toledo (BZ-0003) | BLZ | GTM claims | Guatemala claims Belize south of the Sibun river; case at the ICJ since 2019 |

Not flagged, notes only (A): the Falklands (no FLK row in countries.csv, so not in this slice; Argentina's claim is noted on Tierra del Fuego), Guantanamo Bay (US base on a lease Cuba rejects), San Andres (Colombian islands; Nicaragua disputes only the waters after the 2012 ICJ ruling), Bolivia's sea claim (ICJ ruled against it in 2018), the 3.7 ha Chile-Peru land triangle and the unmarked Southern Patagonian Ice Field, and Venezuela's rival presidency (Guaido), which is not territorial.

## Linked cities

None. No Latin American cluster is a set of separate cities with no core: each large urban area has one dominant city and is a Metro or a single province (A).

## Top 15 provinces by total development

| Rank | Province | Country | Metro | C | I | P | Total |
|---|---|---|---|---|---|---|---|
| 1 | Sao Paulo Centro-Faria Lima | BRA | Sao Paulo | 24 | 8 | 20 | 52 |
| 2 | ABC Paulista-Zona Sul | BRA | Sao Paulo | 7 | 20 | 19 | 46 |
| 3 | Rio Centro-Zona Sul | BRA | Rio de Janeiro | 22 | 6 | 17 | 45 |
| 4 | Curitiba-Paranagua | BRA | - | 13 | 14 | 18 | 45 |
| 5 | Porto Alegre | BRA | - | 14 | 13 | 18 | 45 |
| 6 | Buenos Aires Centro-Puerto Madero | ARG | Buenos Aires | 22 | 5 | 17 | 44 |
| 7 | Lima Centro-San Isidro | PER | Lima | 20 | 6 | 18 | 44 |
| 8 | Sao Paulo Zona Leste-Guarulhos | BRA | Sao Paulo | 8 | 14 | 21 | 43 |
| 9 | Campinas | BRA | - | 12 | 14 | 17 | 43 |
| 10 | Campos-Macae | BRA | - | 7 | 22 | 14 | 43 |
| 11 | Santiago Oriente-Sanhattan | CHL | Santiago | 22 | 4 | 17 | 43 |
| 12 | Bogota Chapinero-Norte | COL | Bogota | 20 | 5 | 18 | 43 |
| 13 | Medellin | COL | - | 13 | 11 | 18 | 42 |
| 14 | Guatemala City | GTM | - | 15 | 10 | 17 | 42 |
| 15 | Santo Domingo | DOM | - | 14 | 10 | 18 | 42 |

## Resource tags

| Tag | Count | Provinces |
|---|---|---|
| Farmland | 131 | |
| None | 116 | |
| Oil | 27 | Niteroi-Sao Goncalo (BRA), Campos-Macae (BRA), North Espirito Santo (BRA), Camacari-Reconcavo (BRA), Rio Grande do Norte (BRA), Sergipe (BRA), South Mendoza (ARG), Neuquen-Vaca Muerta (ARG), Chubut (ARG), Bucaramanga-Barrancabermeja (COL), Meta-Llanos (COL), Arauca-Casanare (COL), Caqueta-Putumayo (COL), Piura (PER), Iquitos-Loreto (PER), Santa Elena (ECU), Sucumbios-Orellana (ECU), Costa Oriental del Lago (VEN), Anzoategui-Orinoco Belt (VEN), Maturin-Monagas (VEN), Falcon-Paraguana (VEN), Barinas (VEN), Essequibo Coast-West Demerara (GUY), Nickerie-Saramacca (SUR), Belmopan-Cayo (BLZ), Matanzas-Varadero (CUB), San Fernando-Point Fortin (TTO) |
| Gold | 23 | Amapa (BRA), Roraima (BRA), Santa Cruz (ARG), San Juan-Veladero (ARG), Uraba-Rural Antioquia (COL), Cartagena-Bolivar (COL), Cauca (COL), Choco (COL), Trujillo-La Libertad (PER), Cajamarca (PER), Puno (PER), Madre de Dios (PER), Cuenca-Azuay (ECU), Yungas-North La Paz (BOL), Arco Minero (VEN), Venezuelan Amazonas (VEN), Cuyuni-Mazaruni-Potaro (GUY), Commewijne-Marowijne (SUR), Brokopondo (SUR), San Marcos (GTM), Chontales-Rio San Juan (NIC), Caribbean Coast (NIC), La Vega-Pueblo Viejo (DOM) |
| Fishing | 21 | Florianopolis-Itajai (BRA), Mar del Plata-Atlantic Coast (ARG), Puerto Montt-Llanquihue (CHL), Chiloe-Palena (CHL), Aysen (CHL), San Andres (COL), Lima Provinces-Huacho (PER), Tumbes (PER), Manabi (ECU), Galapagos (ECU), Cumana-Sucre (VEN), Puntarenas (CRI), Choluteca-Gulf of Fonseca (HND), San Miguel-La Union (SLV), Belize City-North (BLZ), Isla de la Juventud (CUB), Port-de-Paix-Northwest (HTI), Jacmel-Southeast (HTI), Tobago (TTO), Abaco-Eleuthera (BHS), Andros-Exumas (BHS) |
| Timber | 17 | Sorocaba-Southwest Sao Paulo (BRA), Vale do Aco-East Minas (BRA), Acre (BRA), Misiones (ARG), Los Angeles-Biobio Forests (CHL), Araucania (CHL), Los Rios (CHL), Colombian Amazon and Vichada (COL), Ucayali (PER), Pando (BOL), Fray Bentos-Mercedes (URY), Tacuarembo-Durazno (URY), Barima-Waini (GUY), Sipaliwini (SUR), Darien (PAN), Peten (GTM), Olancho-El Paraiso (HND) |
| Hydropower | 15 | West Parana-Foz do Iguacu (BRA), Bahia Sertao-Feira de Santana (BRA), West Para-Santarem (BRA), Rondonia (BRA), Corrientes (ARG), Huila (COL), Huancavelica (PER), Napo-Pastaza-Morona (ECU), Salto-Paysandu (URY), Ciudad del Este (PRY), Chiriqui (PAN), Coban-Verapaz (GTM), North El Salvador (SLV), Hinche-Centre (HTI), Dominica (DMA) |
| Copper | 13 | Iquique-Tarapaca (CHL), Antofagasta (CHL), Coquimbo-La Serena (CHL), San Antonio-Aconcagua (CHL), Rancagua-El Teniente (CHL), Arequipa (PER), Ancash (PER), Junin (PER), Apurimac (PER), Moquegua (PER), Tacna (PER), Loja-Zamora (ECU), Colon (PAN) |
| Gas | 8 | Interior Amazonas (BRA), Salta (ARG), Tierra del Fuego (ARG), Magallanes (CHL), Cusco (PER), Chuquisaca Chaco (BOL), Tarija Chaco (BOL), Point Lisas (TTO) |
| Iron ore | 7 | Iron Quadrangle (BRA), Vitoria-Tubarao (BRA), Carajas-Southeast Para (BRA), Atacama (CHL), Ica (PER), Chiquitania-Mutun (BOL), Ciudad Guayana (VEN) |
| Lithium | 5 | North Minas-Jequitinhonha (BRA), Jujuy (ARG), Catamarca (ARG), Calama-Salar de Atacama (CHL), Uyuni-Southwest Potosi (BOL) |
| Coal | 5 | Rural Cundinamarca (COL), Cucuta (COL), La Guajira (COL), Cesar (COL), Boyaca (COL) |
| Nickel | 3 | Monteria-Cerro Matoso (COL), Izabal (GTM), Holguin-Moa (CUB) |

Bauxite and alumina (Jamaica, Guyana, Suriname, Para), silver, zinc and tin (Bolivia, Peru) and niobium (Minas Gerais) have no tag and sit under None with a note (A).

## Other counts

- City rank: Town 198, City 121, none 39, Metropolis 33
- Terrain: Temperate 149, Mountain 78, Tropical 77, Urban 37, Desert 36, Wetland 12, Arctic 2
- Coastal: 201 (includes Amazon, Parana and Rio de la Plata river ports that take ocean ships (A))
- Chokepoint exposure: Panama Canal 41, Florida Strait 7, Strait of Magellan 2, Drake Passage 2. Panama Canal: Panama's canal provinces and Pacific or Caribbean ports whose main lanes use the canal; Florida Strait: Cuba's north coast and the Bahamas; Strait of Magellan and Drake Passage: Magallanes and Tierra del Fuego. The last two are not in the 2.4.2 chokepoint table yet (A).

## Scale deviations (T)

Provinces outside their rank's development band, listed for tuning:

- none
