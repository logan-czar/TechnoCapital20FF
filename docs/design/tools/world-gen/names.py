"""Name parts for generated holders and companies (TechnoCapital20FF, batch 136).

All names are invented. Prefixes are place-like or evocative words with a
real-world feel; none is meant to parody a real company or person.
"""

# Country iso3 -> culture key. Anything not listed falls back by superregion.
COUNTRY_CULTURE = {
    'USA': 'anglo', 'CAN': 'anglo', 'GBR': 'anglo', 'AUS': 'anglo', 'NZL': 'anglo', 'IRL': 'anglo',
    'BMU': 'anglo', 'CYM': 'anglo', 'VGB': 'anglo', 'JEY': 'anglo', 'GGY': 'anglo', 'PRI': 'hispanic',
    'MEX': 'hispanic', 'ARG': 'hispanic', 'CHL': 'hispanic', 'COL': 'hispanic', 'PER': 'hispanic',
    'ESP': 'hispanic', 'VEN': 'hispanic', 'ECU': 'hispanic', 'URY': 'hispanic', 'PAN': 'hispanic',
    'BRA': 'lusophone', 'PRT': 'lusophone', 'AGO': 'lusophone',
    'FRA': 'french', 'BEL': 'french', 'LUX': 'french', 'MCO': 'french', 'CIV': 'french', 'SEN': 'french',
    'COD': 'congolese', 'DEU': 'german', 'AUT': 'german', 'CHE': 'german', 'LIE': 'german',
    'NLD': 'dutch', 'ITA': 'italian', 'SWE': 'nordic', 'NOR': 'nordic', 'DNK': 'nordic', 'FIN': 'nordic',
    'ISL': 'nordic', 'RUS': 'russian', 'UKR': 'russian', 'BLR': 'russian', 'KAZ': 'russian',
    'POL': 'slavic', 'CZE': 'slavic', 'SVK': 'slavic', 'HUN': 'slavic', 'ROU': 'slavic', 'BGR': 'slavic',
    'SRB': 'slavic', 'HRV': 'slavic', 'GRC': 'greek', 'CYP': 'greek', 'TUR': 'turkish', 'AZE': 'turkish',
    'SAU': 'arabic', 'ARE': 'arabic', 'QAT': 'arabic', 'KWT': 'arabic', 'BHR': 'arabic', 'OMN': 'arabic',
    'EGY': 'arabic', 'IRQ': 'arabic', 'JOR': 'arabic', 'LBN': 'arabic', 'MAR': 'arabic', 'DZA': 'arabic',
    'TUN': 'arabic', 'LBY': 'arabic', 'SYR': 'arabic', 'ISR': 'hebrew', 'IRN': 'persian',
    'NGA': 'westafrican', 'GHA': 'westafrican', 'ZAF': 'southafrican', 'KEN': 'eastafrican',
    'TZA': 'eastafrican', 'ETH': 'eastafrican', 'UGA': 'eastafrican',
    'IND': 'indian', 'PAK': 'southasian_m', 'BGD': 'southasian_m', 'LKA': 'indian', 'NPL': 'indian',
    'CHN': 'chinese', 'HKG': 'chinese', 'TWN': 'chinese', 'SGP': 'chinese', 'MAC': 'chinese',
    'JPN': 'japanese', 'KOR': 'korean', 'IDN': 'malay', 'MYS': 'malay', 'VNM': 'vietnamese',
    'THA': 'thai', 'PHL': 'filipino',
}
SUPERREGION_CULTURE = {
    'North America': 'anglo', 'Latin America': 'hispanic', 'Europe': 'slavic',
    'Russia and Central Asia': 'russian', 'Middle East and North Africa': 'arabic',
    'Sub-Saharan Africa': 'eastafrican', 'South Asia': 'indian', 'East Asia and Oceania': 'malay',
}
# Cultures that write the family name first.
FAMILY_FIRST = {'chinese', 'korean', 'vietnamese'}

# first names (male, female) and surnames per culture
PEOPLE = {
    'anglo': (
        "Bradley Graham Russell Duncan Wade Calvin Preston Barrett Lionel Norris Desmond Clifford Mitchell Dwight Gordon Spencer".split(),
        "Maxine Lorraine Bridget Colleen Harriet Joanne Delphine Wilma Rosalind Tamsin Gwendolyn Celeste Marjorie Paige Imogen Darlene".split(),
        "Ashby Hargreave Calloway Pembrook Dunmore Thackeray Whitcombe Prescott Ridley Galloway Stanhope Kincaid Merriweather Holcombe Fairbairn Langridge Burroughs Tolliver Cardwell Ainsworth Drummond Vickery Hollister Brannock".split()),
    'hispanic': (
        "Joaquin Rodrigo Ignacio Esteban Aurelio Fernando Ramiro Octavio Leandro Mateo Gerardo Benicio Emilio Rafael".split(),
        "Ximena Catalina Florencia Inmaculada Renata Paloma Graciela Lucrecia Mercedes Soledad Ainhoa Macarena Dolores".split(),
        "Echeverria Montalvo Iturbide Zubieta Cardenal Villalobos Arrizabalaga Benavides Olmedo Quiroga Santamaria Urrutia Bermejo Llorente Escobedo Ocampo Garrido Aldana Maldonado Sepulveda".split()),
    'lusophone': (
        "Joao Rodrigo Thiago Caio Heitor Otavio Leandro Rogerio Marcelo Anselmo Vinicius".split(),
        "Beatriz Leticia Glaucia Rosangela Marisa Tatiana Fernanda Iracema Luciana Helena".split(),
        "Albuquerque Figueiredo Brandao Siqueira Cavalcanti Monteiro Vasconcelos Bittencourt Guimaraes Teixeira Queiroz Magalhaes Prado Rezende".split()),
    'french': (
        "Thibault Gaspard Arnaud Lucien Benoit Clement Edouard Florian Honore Remy Sylvain".split(),
        "Apolline Capucine Solene Eloise Marguerite Oriane Sabine Clemence Ines Bérénice".split(),
        "Delacroix-Morel Fauconnier Lambertin Beaumarchais Rocheval Desjardins Montclair Vasseur Haussmann Chevrier Leclerc-Dumas Arnoux Villeneuve".split()),
    'congolese': (
        "Jean-Pierre Albert Dieudonne Patrice Olivier Fiston Christian".split(),
        "Mireille Clarisse Esperance Nadine Grace Pascaline".split(),
        "Kabongo Mwamba Ilunga Tshibanda Kasongo Lukusa Mutombo-Ngoy Kapinga Banza Nkulu".split()),
    'german': (
        "Friedrich Joachim Matthias Ulrich Wolfram Dietrich Konstantin Leopold Henning Rupert Tobias".split(),
        "Annegret Friederike Henrike Sieglinde Theresa Ottilie Mechthild Larissa Wiebke Cosima".split(),
        "Lindqvist-Bauer Hohenstein Brandauer Kesselring Achenbach Waldmann Steinhauer Ortlepp Rautenberg Falkenhayn Wurmbach Eichhorn Grauwinkel Liebermann".split()),
    'dutch': (
        "Joost Maarten Willem Sjoerd Bram Jeroen Floris Diederik".split(),
        "Femke Marijke Anneloes Sanne Wilhelmina Liesbeth Noor".split(),
        "Van Haeften Brouwershaven Ter Meulen Kuipers Van Rensselaer-Bos Hoogendijk Van der Ploeg Visscher Den Uyl-Blom Schimmelpenninck".split()),
    'italian': (
        "Lorenzo Ottavio Ludovico Tommaso Giacomo Vittorio Cosimo Ascanio Pietro Raimondo".split(),
        "Ginevra Ludovica Beatrice Serafina Costanza Benedetta Ottavia Allegra".split(),
        "Castelvecchi Brambati Ruspoli-Neri Pellegrini Trivulzi Malaspina-Conti Bonfanti Sartori Visconteo Lanzavecchia Ferrandi Moratto".split()),
    'nordic': (
        "Henrik Torsten Magnus Leif Anders Sigurd Espen Mikkel".split(),
        "Ingrid Solveig Astrid Sigrid Liv Freja Malin".split(),
        "Lindgaard Ekholm Haraldsen Bjornstad Wennerstrom Aasgaard Strandvik Lofqvist Nyborg".split()),
    'russian': (
        "Arkady Gennady Vsevolod Rostislav Timur Yaroslav Lev Boris Kirill Stanislav Ruslan".split(),
        "Yelena Svetlana Margarita Oksana Zinaida Alina Valentina Ludmila".split(),
        "Belozersky Kalashnin Voronov Zhdanko Gromyko-Vasin Tarkhanov Lebedinsky Shuvalin Kuzmenko Ostrovsky Dobrynin Polyansky".split()),
    'slavic': (
        "Tomasz Radoslaw Miroslav Zdenek Lukas Dragan Bogdan Andrzej Istvan Mihai".split(),
        "Agnieszka Katarzyna Zuzana Milena Jadwiga Ilona Dorota Irina".split(),
        "Wisniewski Kowalik Dvorak-Hruby Zielinski Novotny Jankowiak Szabolcs Radulescu Petrovic Brzezinski-Lis".split()),
    'greek': (
        "Spyros Konstantinos Aristides Panagiotis Dimitris Themis".split(),
        "Eleni Ioanna Kalliope Despina Athina".split(),
        "Vardinoyannis-Kos Lekkas Papadimas Karamanlidis Xenakis Doukas Mavrogenis".split()),
    'turkish': (
        "Selim Kerem Murat Burak Cem Orhan Levent Tarik Emre".split(),
        "Elif Zeynep Defne Nilufer Selin Gulsen Ayla".split(),
        "Karakaya Ozdemiroglu Yalcintas Sabanci-Kaya Erkmen Gokturk Demirtepe Uzunoglu Celikbas".split()),
    'arabic': (
        "Khalid Faisal Omar Hamad Nasser Yousef Saud Majid Rashid Hisham Karim Ziad".split(),
        "Noura Layla Mariam Huda Reem Dalia Salma Yasmin".split(),
        "Al-Qahtani Al-Shamsi Al-Nuaimi Al-Mansouri Haddadin Al-Sabeeh Al-Tamimi Barakat El-Sayed Al-Ghurair-Nasr Zaher Al-Otaibi Kassab".split()),
    'hebrew': (
        "Eitan Yoav Amir Nadav Gideon Ronen Avi".split(),
        "Tamar Yael Shira Michal Orly Dafna".split(),
        "Shamir-Katz Ben-Haim Rosenthal Golan Weissberg Mizrahi Avneri".split()),
    'persian': (
        "Dariush Kourosh Babak Ardeshir Farhad Kaveh".split(),
        "Shirin Roxana Parisa Laleh Mitra".split(),
        "Farahani Mostofi Kashani Rafsanjani-Tehrani Amirzadeh Ghaffari".split()),
    'westafrican': (
        "Chukwuemeka Babatunde Olumide Kwabena Adebayo Ikenna Femi Kofi Tunde".split(),
        "Ngozi Folake Adaeze Abena Yewande Chiamaka Efua".split(),
        "Adeyemi-Coker Okonjo-Bello Ekwueme Danjuma Akintola Mensah-Bonsu Oyelaran Nwachukwu Bankole Adeleke".split()),
    'southafrican': (
        "Sipho Thabo Pieter Johan Mandla Riaan Kagiso".split(),
        "Nomvula Lindiwe Annelie Zanele Marike Palesa".split(),
        "Mokoena Van Rooyen Dlamini-Steyn Oppenheim-Naidoo Botha Ndlovu Marais Khumalo".split()),
    'eastafrican': (
        "Wanjiru Kamau Otieno Abebe Juma Baraka Tesfaye".split(),
        "Wairimu Achieng Makena Aster Zawadi Nyokabi".split(),
        "Kenyatta-Ruto Odinga-Were Mwangi Gebremedhin Kimani Ochieng Njoroge Haile".split()),
    'indian': (
        "Vikram Rohan Aditya Siddharth Arvind Karan Nikhil Rajiv Harsh Devendra Anand Kunal".split(),
        "Priyanka Meera Kavya Shalini Ritu Anjali Devika Nandini Ishita".split(),
        "Mehra Singhania Bajpai Kirloskar-Rao Venkataraman Choksi Agarwal Iyengar Malhotra Sabharwal Oberoi-Nanda Khaitan Reddy Poonawal".split()),
    'southasian_m': (
        "Imran Faraz Junaid Asad Bilal Salman Kamran Tariq".split(),
        "Ayesha Mehreen Sana Nadia Rubina Farah".split(),
        "Chaudhry Hashmi Mirza Khawaja Sheikh-Rahman Rahim Siddiqui Haroon".split()),
    'chinese': (
        "Weiguo Jianhua Zhiqiang Haoran Junjie Mingyuan Zihao Guoliang Wenbo Kaixuan".split(),
        "Meiling Xiaohong Yuxin Ruoxi Jiayi Shuang Wanting Lihua".split(),
        "Wu Zheng Xu Tang Lu Shen Gao Liang Fan Cao He Song Dai Yuan Kong".split()),
    'japanese': (
        "Haruto Kenji Takeshi Daisuke Hiroshi Ryo Satoshi Kazuo Shinji".split(),
        "Ayaka Misaki Haruka Emiko Rina Sayuri Natsuki Keiko".split(),
        "Kuroda Morimoto Hayashida Takagi Ishikura Nakanishi Fujiwara-Oda Kanemura Sugiyama Hoshino Okabe".split()),
    'korean': (
        "Jae-won Min-ho Dong-hyun Sung-min Tae-yang Hyun-woo".split(),
        "Ji-yeon Soo-ah Eun-bi Hye-jin Da-eun Mi-rae".split(),
        "Shin Yoon Hwang Jeong Kang Ryu Moon Seo".split()),
    'malay': (
        "Budi Hendra Rizal Agus Farid Aziz Hakim Wahyu Iskandar".split(),
        "Siti Dewi Ratna Nurul Putri Indah Melati".split(),
        "Santoso Wirawan Halim Kusuma Tanoto-Lim Sukarno-Adi Hidayat Rahman Salim Gunawan".split()),
    'vietnamese': (
        "Minh Tuan Quang Duc Hung Thanh".split(),
        "Lan Mai Thuy Huong Ngoc Linh".split(),
        "Nguyen Tran Pham Vo Dang Bui Doan".split()),
    'thai': (
        "Somchai Anan Kittisak Prayut Chaiwat Narong".split(),
        "Siriporn Pimchanok Kanya Rattana Malee".split(),
        "Chirathivat-Na Sirivadhana Wongsakul Charoenkul Thanapong Boonyarat".split()),
    'filipino': (
        "Ramon Emilio Ferdinand Rogelio Benigno Teodoro".split(),
        "Maricel Corazon Rosario Imelda Liza Gloria".split(),
        "Lacson Dimaculangan Ongpin-Sy Tanjuatco Aboitiz-Cruz Belmonte Sison".split()),
}

# Company name prefixes per culture (place-like or evocative words).
PREFIX = {
    'anglo': ("Ironbark,Redwater,Bluestem,Kingsbridge,Copperline,Granite Peak,Harrowgate,Thornfield,Northgate,"
              "Blackfen,Saltmarsh,Highmoor,Lodestar,Bramblewood,Coldwater,Westerly,Halyard,Crossfield,Tidewater,"
              "Long Prairie,Ashgrove,Marrow Creek,Juniper Ridge,Pinecrest,Driftwood,Ironwood,Brightwater,Hawthorne,"
              "Fenmore,Silverbell,Cobalt Bay,Dunmore,Rockledge,Larkspur,Wolf River,Gallowglass,Foxhollow,"
              "Quarry Hill,Ember Point,Crowsnest,Bridgeport,Ravenwood,Sentinel Rock,Big Sky,Lone Pine,Cutbank,"
              "Graystone,Midvale,Oakhurst,Riverbend,Northwind,Sawtooth,Bluewater,Kestrel,Granite Falls,"
              "Ironhorse,Prairie Star,Cinderhill,Copperhead,Waverly,Steelhead,Eastbrook,Sandstone,Harborview,"
              "Clearwater Basin,Fairhaven,Black Spruce,Stonegate,Saltgrass,Windward,Coalbrook,Muskeg,Red Mesa,"
              "Bitterroot,Chinook,High Desert,Silver Creek,Thunder Bay,Gilded Age,Iron Range,Seven Hills,"
              "Cold Spring,Hollowell,Kittiwake,Mariner's Rest,Old Post Road,Paragon Point,Tamarack,Wildrose").split(','),
    'hispanic': ("Sierra Alta,Rio Bravo,Cerro Azul,Valle Dorado,Puerto Viejo,Altiplano,Mar del Sur,Cumbre,"
                 "Llano Grande,Monte Claro,Bahia Blanca,Tierra Firme,Estrella del Norte,Cordillera,Pampa Norte,"
                 "Sol de Mayo,Laguna Verde,Rio Hondo,Atalaya,Faro Rojo,Puente Real,Torre Sur,Campo Alegre,Cielo Abierto").split(','),
    'lusophone': ("Serra Azul,Rio Claro,Mata Atlantica,Cerrado,Vale Verde,Porto Novo,Ipe Amarelo,Tucano,Guanabara,"
                  "Paraiba,Aurora Paulista,Sertao,Boa Vista,Itaipava,Corcovado,Jacaranda,Pau-Brasil,Litoral").split(','),
    'french': ("Rive Gauche,Belle-Ile,Montrouge,Haute-Seine,Mistral,Saint-Ambroise,Chateaurouge,Valmont,Lumiere du Nord,"
               "Clairefontaine,Pont-Neuf,Grand Large,Fleur-de-Sel,Beaulieu,Marne-Vallee,Ardoise").split(','),
    'congolese': "Lualaba,Kivu Bleu,Grand Fleuve,Mont Ngaliema,Katanga Etoile,Kasai Diamant,Malebo".split(','),
    'german': ("Rheinwerk,Edelweiss,Nordwind,Schwarzwald,Isartal,Kaiserstuhl,Moselblick,Elbstern,Brandberg,"
               "Lindenhof,Alpenglut,Spreeufer,Taunus,Falkenstein,Donaugrund,Mainblick,Hohenfels,Bergkristall").split(','),
    'dutch': "Zuiderwind,Hollandse Kust,Waddenzee,Rijnmond,Kempenland,Oranjewoud,Veluwe,Ijsselmeer,Duinrand,Polderhaven".split(','),
    'italian': ("Lago Maggiore,Monte Rosa,Porta Nuova,Stella Alpina,Val d'Orcia,Ponte Vecchio,Dolomiti,Riva Blu,"
                "Castelfranco,Laguna Veneta,Montecastello,Trinacria,Valtellina").split(','),
    'nordic': "Fjordlys,Nordkapp,Isbjorn,Vinterhav,Skagerrak,Polarstjerne,Midnattsol,Lofoten,Kattegat".split(','),
    'russian': ("Sever,Uralsky Kamen,Baikal,Volga-Don,Kamchatka,Sibirsky Les,Taimyr,Polyarny,Zarya,Neva,Yenisei,"
                "Amur,Kuzbass,Belaya Rus,Tundra,Krasny Yar").split(','),
    'slavic': "Vistula,Tatra,Bialowieza,Morava,Karpaty,Danubia,Balaton,Pannonia,Bohemia Stella,Mazury".split(','),
    'greek': "Aegean Star,Olympia,Kyklades,Poseidonia,Parnassos,Ionian".split(','),
    'turkish': "Bosphorus,Anatolia,Kapadokya,Karadeniz,Ege Yildizi,Toros,Altin Hilal,Marmara,Firat".split(','),
    'arabic': ("Al Waha,Ras Al Noor,Sahara Gate,Al Nakheel,Rub Al Khali,Dhow Harbor,Al Falak,Najm,Wadi Fatima,"
               "Al Jazira,Qasr Al Bahr,Al Burj,Hormuz Gate,Sidra,Nile Delta,Atlas Sun,Al Rawda,Bayt Al Hikma").split(','),
    'hebrew': "Galil,Negev,Carmel,Yarden,Kinneret,Arava".split(','),
    'persian': "Alborz,Zagros,Persepolis,Simorgh,Caspian,Shirazi".split(','),
    'westafrican': "Niger Delta,Eko Bridge,Gold Coast,Volta,Oyo Crown,Benin Bight,Zuma Rock,Olumo,Calabar,Kano Gate".split(','),
    'southafrican': "Highveld,Karoo,Table Bay,Drakensberg,Limpopo,Witwater,Kalahari,Protea,Bushveld".split(','),
    'eastafrican': "Kilimanjaro,Rift Valley,Serengeti,Great Lakes,Simba,Zanzibar,Ngong,Turkana,Blue Nile".split(','),
    'indian': ("Ganga,Deccan,Narmada,Kaveri,Himgiri,Sahyadri,Rajhans,Konkan,Malabar,Vindhya,Brahmaputra,Aravalli,"
               "Godavari,Kailash,Sindhu,Suryodaya,Navratna,Nilgiri,Coromandel").split(','),
    'southasian_m': "Indus,Margalla,Khyber,Ravi,Sundarbans,Karakoram,Chenab,Meghna".split(','),
    'chinese': ("Changjiang,Huangshan,Jinlong,Tianfu,Kunlun,Lingnan,Taishan,Baiyun,Zhujiang,Xinghe,Hongqiao,"
                "Longmen,Qilin,Fenghuang,Jade Harbour,Lotus Bay,Victoria Crest,Tianma,Pearl Delta,Wanli,Yuntai,"
                "Huaxing,Haixia,Jinqiao,Shenzhou,Daxing,Tianyuan,Hengshan,Songshan").split(','),
    'japanese': ("Fujimi,Sakuragawa,Kaminari,Hoshizora,Asahi-Kawa,Tsubasa,Shiranami,Akatsuki,Midorigaoka,Hayabusa,"
                 "Kurogane,Yamabuki,Shinonome,Benten,Kazaguruma").split(','),
    'korean': "Hanul,Baekdu,Mugunghwa,Hallasan,Haetae,Seorak,Jindo,Namsan,Arirang".split(','),
    'malay': "Nusantara,Garuda,Merapi,Borneo Jaya,Selat,Kenanga,Rinjani,Mutiara,Cendana,Melaka Gate".split(','),
    'vietnamese': "Mekong,Ha Long,Truong Son,Song Hong,Sen Vang,Phu Quoc".split(','),
    'thai': "Chao Phraya,Siam Crest,Erawan,Andaman,Lanna,Golden Naga".split(','),
    'filipino': "Bayanihan,Mayon,Pasig,Visayas,Sampaguita,Luzon Star,Banaue".split(','),
}

# Industry suffixes.
SUFFIX = {
    'Semiconductors': ['Semiconductor', 'Silicon', 'Microdevices', 'Foundry', 'Chipworks', 'Lithics'],
    'AI labs': ['Intelligence', 'AI Lab', 'Cognition', 'Machine Minds', 'Neural'],
    'Cloud': ['Cloud', 'Compute', 'Cloudworks', 'Hosting'],
    'Data centers': ['Data Centers', 'Data Halls', 'Digital Realty', 'Server Parks', 'Colocation'],
    'Software': ['Software', 'Systems', 'Code', 'Logic'],
    'SaaS': ['Labs', 'Platforms', 'HQ', 'Stack', 'Suite'],
    'Social media': ['Social', 'Feed', 'Circle', 'Chat'],
    'Ads': ['Media Exchange', 'Adworks', 'Reach', 'Ad Network'],
    'Consumer electronics': ['Electronics', 'Devices', 'Electric', 'Digital'],
    'Telecom': ['Telecom', 'Mobile', 'Networks', 'Wireless', 'Communications'],
    'Gaming': ['Games', 'Interactive', 'Studios', 'Play'],
    'Gambling': ['Casino Resorts', 'Gaming Holdings', 'Bet', 'Lottery', 'Sportsbook'],
    'Banking': ['Bank', 'Bancorp', 'Financial', 'Savings Bank', 'Trust Bank'],
    'Insurance': ['Insurance', 'Assurance', 'Re', 'Mutual', 'Underwriters'],
    'Asset management': ['Capital', 'Asset Management', 'Investors', 'Partners', 'Fund'],
    'Oil': ['Petroleum', 'Oil', 'Drilling', 'Energy', 'Crude'],
    'Gas': ['Gas', 'LNG', 'Midstream', 'Gas Transmission'],
    'Power utilities': ['Power', 'Electric', 'Utilities', 'Energy Grid'],
    'Renewables': ['Renewables', 'Solar', 'Wind', 'Green Power'],
    'Mining': ['Mining', 'Minerals', 'Resources', 'Ore'],
    'Metals': ['Steel', 'Metals', 'Alloys', 'Smelting'],
    'Chemicals': ['Chemicals', 'Chemie', 'Polymers', 'Petrochemical'],
    'Agriculture': ['Agri', 'Farms', 'Grain', 'Agribusiness', 'Harvest'],
    'Autos': ['Motors', 'Automotive', 'Motor Works', 'Cars'],
    'EVs': ['EV', 'Electric Vehicles', 'E-Mobility', 'Volt Motors'],
    'Aerospace': ['Aerospace', 'Aviation', 'Aero', 'Airframes'],
    'Defense': ['Defense Systems', 'Arms', 'Dynamics', 'Ordnance'],
    'Robotics': ['Robotics', 'Automation', 'Robot Works', 'Mechatronics'],
    'Drones': ['Drones', 'UAV', 'Aerial', 'Skyworks'],
    'Shipping': ['Shipping', 'Maritime', 'Lines', 'Tankers', 'Shipyards'],
    'Logistics': ['Logistics', 'Freight', 'Express', 'Haulage'],
    'Airlines': ['Airways', 'Air', 'Airlines'],
    'Construction': ['Construction', 'Builders', 'Engineering', 'Infrastructure', 'Cement'],
    'Retail': ['Stores', 'Markets', 'Retail', 'Mart', 'Department Stores'],
    'E-commerce': ['Shop', 'Online', 'Marketplace', 'Direct'],
    'Fast food': ['Burgers', 'Chicken', 'Foods', 'Grill', 'Noodle House'],
    'Luxury': ['Maison', 'Atelier', 'Couture', 'Jewellers'],
    'Pharma': ['Pharma', 'Therapeutics', 'Biologics', 'Laboratories'],
    'Healthcare services': ['Health', 'Hospitals', 'Care', 'Medical Group'],
    'Real estate': ['Properties', 'Land', 'Realty', 'Developments', 'Estates'],
    'Professional services': ['Consulting', 'Advisory', 'Associates', 'Partners LLP', 'Law Group'],
    'Black market': ['Trading', 'Import-Export', 'Exchange', 'Transport', 'Recycling'],
}

# Flavor for generated holders' notes.
QUIRKS = [
    'lives on a converted cruise ship that never docks',
    'pays a team to keep a digital twin of himself or herself answering email',
    'has not been photographed since 2009',
    'collects decommissioned satellites',
    'runs a private longevity regimen of forty pills a day',
    'is suing three relatives at once',
    'keeps a bunker under a vineyard',
    'owns a stake in every racehorse that beat his or her horse',
    'speaks only through a lawyer in public',
    'funds a think tank no one has heard of',
    'bought a decommissioned missile silo as a home',
    'is said to keep the share certificates in a safe in a monastery',
    'votes every share by text message from a yacht',
    'won the stake in a card game, by the family story',
    'quietly backs whichever bloc pays the best dividend',
    'leaks board minutes to a favourite journalist',
    'has a feud with the CEO that is older than the CEO',
    'is the largest private landowner in the home region',
    'buys art only at auctions held at three in the morning',
    'once tried to buy a small island nation',
]
