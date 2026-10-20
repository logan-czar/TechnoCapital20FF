"""Hand-authored rows for TechnoCapital20FF batch 136.

Characters: John Techno, Terry Tippacanoe, the 14 rivals of 7.3, the 30 new
rivals (batch 136), the draft North American characters who hold companies,
and a few named minor holders (crew boss, fixer, figureheads).

Skills are Finance / Operations / Persuasion / Intrigue / Tech / Hustle.
Values not set in the docs are proposals (A); numbers are tuning values (T).
"""

# key, name, tier, profile, location, origin_province, age, money_type,
# skills, traits, ideology, cash_usd, wealth_target_usd_bn (Rich rivals), hook, notes
C = []
def ch(key, name, tier, profile, location, prov, age, money, skills, traits, ideology, cash,
       wealth=None, hook='', notes=''):
    C.append(dict(key=key, name=name, tier=tier, profile=profile, location=location, origin_province=prov,
                  age=age, money_type=money, skills=skills, traits=traits, ideology=ideology, cash_usd=cash,
                  wealth=wealth, hook=hook, notes=notes))

# ---------------------------------------------------------------- player
ch('john', 'John Techno', 'player', 'Talented', 'Edmonton', 'CA-0033', 22, '', (24,)*6,
   ['Operational Excellence'], '', 100_000,
   hook='The one man you keep: a 22-year-old ex-union oil man who is COO of the smallest oil company in the game.',
   notes='7.3.0; salary $1M a year; options on 2% of Arrowhead Drilling out of Terry\'s shares (4-year vest, 1-year cliff), not a stake; ideology set by the player; Pdoomberg paid by Arrowhead (batch 134)')
# ---------------------------------------------------------------- Terry
ch('terry', 'Terry Tippacanoe', 'rival', 'Rich', 'Edmonton', 'CA-0033', 61, 'criminal', (18,8,17,19,4,16),
   ['Deceitful','Greedy','Gregarious'], 'Chuds', 90_000_000, wealth=1.0,
   hook='A Native financier of questionable origins who owns a very popular casino and, since the union broke, John\'s company.',
   notes='7.3.5; $1B net worth (batch 78); +25% success and -25% discovery on schemes against Liberals; the media never exposes his schemes; money_type criminal (A)')
# ---------------------------------------------------------------- 7.3 rivals
ch('antone', 'Antone Provolone', 'rival', 'Connected', 'New York', 'US-0086', 39, 'criminal', (16,7,18,17,3,15),
   ['Gregarious','Ruthless','Greedy'], 'Liberals', 4_000_000,
   hook='A finance bro by day and a wise guy by night who always knows a guy who knows a guy.',
   notes='7.3.1 #1; age, traits, skills from drafts/na-characters.md (A)')
ch('ricky', 'Ricky Feng', 'rival', 'Rich', 'San Francisco (Bay Area)', 'US-0018', 27, 'tech', (8,6,5,15,22,14),
   ['Paranoid','Visionary','Hedonist'], 'Accelerationists', 2_000_000, wealth=1.2,
   hook='A hacker who barely got out of a hack gone bad alive, locked out of a huge crypto wallet.',
   notes='7.3.1 #2; the locked wallet (about $4B in coins (A)) is not counted in cash or stakes; compute in Asia sits in Lotus Grid Compute')
ch('dot', 'Dot Percy', 'rival', 'Rich', 'Los Angeles', 'US-0010', 56, 'old', (10,9,19,11,3,8),
   ['Narcissist','Cautious','Compassionate'], 'Liberals', 150_000_000, wealth=2.5,
   hook='Hollywood\'s widow of the year, who was about to ask for a divorce.',
   notes='7.3.1 #3; five embarrassing adult children are flavor; her film studio and streamer stake are media outlets (16), held by Percy Legacy Holdings')
C.append(dict(key='pablo', name='Pablo Segundo', tier='rival', profile='Talented', location='Medellin', origin_province='CO-0005',
              age=34, money_type='criminal', skills=(9,12,19,16,4,18), traits=['Ambitious','Ruthless','Zealot'],
              ideology='Chuds', cash_usd=400_000, wealth=None,
              hook='Narco fascism and the rise of Pablo Segundo.',
              notes='7.3.1 #4; age, skills, traits (A); ideology Chuds is a placeholder since Pablo picks his ideology in play (batch 36)'))
ch('tolu', 'Tolu Balogun', 'rival', 'Rich', 'Lagos', 'NG-0001', 52, 'state-linked', (16,11,17,18,5,14),
   ['Greedy','Gregarious','Deceitful'], 'Landites', 300_000_000, wealth=4.0,
   hook='Oil money and corruption in a developing country; the man who could make Lagos the center of Africa.',
   notes='7.3.2 #5; age, skills, traits, ideology (A)')
ch('pieter', 'Pieter Von Floop', 'rival', 'Rich', 'Eindhoven', 'NL-0009', 24, 'old', (14,16,9,4,17,8),
   ['Honest','Diligent','Cautious'], 'Effective Altruists', 200_000_000, wealth=4.0,
   hook='A lifelong boy scout, 24, holding together the lithography monopoly his father built.',
   notes='7.3.2 #6; spelled Pieter Von Floop (not van Aalst); his ailing father is a flavor relative; skills, traits, ideology (A)')
ch('samir', 'Samir Haddad', 'rival', 'Talented', 'Dubai', 'AE-0008', 33, 'tech', (5,15,8,12,16,19),
   ['Brave','Diligent','Cynic'], 'Communists', 2_000,
   hook='A former elite drone pilot in the Permanent Underclass, offered a battered drone on credit, for a favor.',
   notes='7.3.2 #7; starts in the Permanent Underclass (2.8); his three micro ventures are financed by the fixer Yusuf Al-Nakhli; age, skills (A)')
ch('margaux', 'Margaux Valcourt', 'rival', 'Rich', 'Paris', 'FR-0001', 29, 'old', (12,8,14,9,7,10),
   ['Hedonist','Brave','Gregarious'], 'Liberals', 400_000_000, wealth=3.0,
   hook='A French redhead who inherits her uncle\'s fortune and can become anything.',
   notes='7.3.2 #8; age, skills, traits (A); the uncle\'s portfolio is her starting holdings')
C.append(dict(key='viktor', name='Viktor Sokolov', tier='rival', profile='Connected', location='Moscow', origin_province='RU-0001',
              age=49, money_type='state-linked', skills=(12,9,14,22,9,10), traits=['Paranoid','Ruthless','Cautious'],
              ideology='Sovereigntists', cash_usd=8_000_000, wealth=None,
              hook='An intelligence officer building a network of loyalists inside the state, and companies in other men\'s names.',
              notes='7.3.2 #9; controls his companies through figureheads (1.3.1); age, skills, traits, ideology (A)'))
ch('kroll', 'Garrett Kroll', 'rival', 'Rich', "Kroll's colony (Pacific, off New Zealand)", 'NZ-0001', 58, 'tech', (13,17,12,8,15,11),
   ['Visionary','Narcissist','Brave'], 'Sovereigntists', 500_000_000, wealth=6.0,
   hook='A crazy automotive billionaire founding his own island colony by crashing boats into the side of Antarctica.',
   notes='7.3.3 #10; origin province Auckland (A) because the claimed colony province is not in the province files yet; age, skills, traits (A)')
ch('fang', 'Fang Xiaoyu', 'rival', 'Talented', 'Shenzhen', 'CN-0019', 31, 'tech', (17,11,12,10,18,15),
   ['Ambitious','Diligent','Cautious'], 'Accelerationists', 600_000,
   hook='A tech and finance prodigy running small businesses on both sides of the Hong Kong border.',
   notes='7.3.3 #11; a woman (batch 37); age, skills, traits, ideology (A)')
ch('qiao', 'Qiao Lin', 'rival', 'Connected', 'Beijing', 'CN-0001', 44, 'state-linked', (13,12,18,19,6,9),
   ['Cautious','Ambitious','Deceitful'], 'Communists', 6_000_000,
   hook='A daughter of the party-state whose relatives hold the companies she runs.',
   notes='7.3.3 #12; a woman (batch 36); controls through relatives as figureheads (1.3.1); age, skills, traits (A)')
ch('ananya', 'Ananya Hegde', 'rival', 'Talented', 'Bengaluru', 'IN-0023', 26, 'tech', (21,8,10,9,19,12),
   ['Shy','Visionary','Diligent'], 'Transhumanists', 250_000,
   hook='A sleeper, overpowered investor who wants India to build data centers before anyone else.',
   notes='7.3.3 #13; profile Talented (A); age, skills, traits, ideology (A)')
ch('yuna', 'Yuna Sakamoto', 'rival', 'Connected', 'Tokyo-Yokohama', 'JP-0001', 23, 'tech', (6,7,21,10,9,16),
   ['Narcissist','Gregarious','Zealot'], 'Sovereigntists', 3_000_000,
   hook='A young influencer with a massive following who must pivot to an extremist, politicized Japan.',
   notes='7.3.3 #14; ideology is a placeholder until she picks her cause (A); age, skills, traits (A)')

# ---------------------------------------------------------------- 30 new rivals (batch 136)
# Group one: North and South America
ch('whitlock', 'Cassius Whitlock', 'rival', 'Rich', 'Houston', 'US-0122', 58, 'old', (17,15,13,14,5,9),
   ['Greedy','Conservative','Ruthless'], 'Landites', 600_000_000, wealth=7.0,
   hook='Fourth-generation Gulf Coast money who owns the pipes, the power lines and the grid board, and sells blackout insurance to the same counties.')
ch('bastos', 'Rafaela Bastos Kuroda', 'rival', 'Rich', 'Sao Paulo', 'BR-0001', 34, 'tech', (18,12,14,15,19,13),
   ['Visionary','Ambitious','Ruthless'], 'Accelerationists', 250_000_000, wealth=3.0,
   hook='Her payments app scores 80 million Brazilians for credit, loyalty and "civic risk", and sells the scores to anyone.')
ch('saldivar', 'Ernesto Saldivar Ocampo', 'rival', 'Rich', 'Mexico City', 'MX-0001', 71, 'old', (19,14,16,15,4,8),
   ['Greedy','Cautious','Gregarious'], 'Landites', 900_000_000, wealth=9.0,
   hook='Owns the towers, the corner stores and the loans that buy the phones; Mexico pays him three times a day.')
ch('arrieta', 'Valentina Arrieta', 'rival', 'Rich', 'Buenos Aires', 'AR-0001', 45, 'old', (17,13,15,12,6,11),
   ['Brave','Greedy','Paranoid'], 'Sovereigntists', 200_000_000, wealth=2.5,
   hook='An estancia heiress who turned two million hectares of soy into a grain-backed private currency Argentines trust more than the peso.')
ch('achterberg', 'Juniper Achterberg', 'rival', 'Rich', 'Seattle', 'US-0140', 43, 'tech', (13,16,12,11,21,12),
   ['Ambitious','Visionary','Paranoid'], 'Accelerationists', 400_000_000, wealth=5.0,
   hook='Sells cities a "municipal OS" that runs their traffic, water and police dispatch from her servers.')
C.append(dict(key='strickland', name='Odell Strickland', tier='rival', profile='Connected', location='Washington DC', origin_province='US-0030',
              age=63, money_type='state-linked', skills=(10,15,16,17,8,9), traits=['Ruthless','Brave','Ambitious'],
              ideology='Sovereigntists', cash_usd=4_000_000, wealth=None,
              hook='The retired general who ran the Total Bush Victory drone campaigns, then chaired the company that built the drones; he sells the Pentagon its wars on subscription.', notes=''))
ch('vandergriff', 'Hester Vandergriff', 'rival', 'Connected', 'Chicago', 'US-0044', 66, 'old', (16,14,11,13,5,7),
   ['Cautious','Greedy','Diligent'], 'Landites', 9_000_000,
   hook='Her family railroad still owns the right-of-way under every fiber line in the Midwest, and she charges by the photon.',
   notes='old money gone thin: the railroad, fiber and grain stakes sit in the Vandergriff family trust, which she runs as trustee (A)')
ch('tanaka', 'Rhys Tanaka-Holt', 'rival', 'Talented', 'Toronto', 'CA-0001', 29, 'tech', (9,11,10,15,22,13),
   ['Visionary','Shy','Deceitful'], 'Transhumanists', 300_000,
   hook='Built a face-scan door app for landlords that now opens 400,000 Canadian apartments, and keeps every face.')
ch('brandao', 'Wellington Brandao', 'rival', 'Connected', 'Rio de Janeiro', 'BR-0010', 48, 'criminal', (11,16,13,18,6,17),
   ['Ruthless','Brave','Greedy'], 'Chuds', 3_000_000,
   hook='"O Capitao": an ex-police captain whose militia sells internet, cooking gas and protection to a million favela residents.')
ch('quispe', 'Esperanza Quispe', 'rival', 'Talented', 'Lima', 'PE-0001', 39, 'criminal', (12,18,10,16,5,20),
   ['Diligent','Paranoid','Ruthless'], 'Neo-Luddites', 700_000,
   hook='"La Viuda": a former camp cook who now runs the informal gold mines of the Amazon and the river barges that carry the mercury.')
# Group two: Europe, Africa and the Middle East
ch('fenwick', 'Ambrose Fenwick-Lyle', 'rival', 'Rich', 'London', 'GB-0001', 67, 'old', (19,11,16,15,3,6),
   ['Cautious','Greedy','Gregarious'], 'Sovereigntists', 300_000_000, wealth=3.5,
   hook='Insures everything that can burn, and owns the islands where the payouts go.')
ch('habersaat', 'Leonie Habersaat', 'rival', 'Rich', 'Zurich', 'CH-0001', 44, 'old', (20,12,13,18,9,8),
   ['Ambitious','Deceitful','Diligent'], 'Effective Altruists', 250_000_000, wealth=2.5,
   hook='Her private bank keeps 40,000 numbered accounts, and she has started reading them.')
ch('ellwangen', 'Konrad von Ellwangen', 'rival', 'Rich', 'Munich', 'DE-0006', 59, 'old', (15,17,12,9,14,8),
   ['Visionary','Narcissist','Diligent'], 'Transhumanists', 500_000_000, wealth=6.0,
   hook='Heir to a car and reinsurance empire, spending both on robot factories and a Bavarian clinic that promises he will never die.')
ch('brambilla', 'Ottavia Brambilla-Ferri', 'rival', 'Connected', 'Milan', 'IT-0001', 61, 'old', (13,14,18,14,5,10),
   ['Narcissist','Ruthless','Diligent'], 'Liberals', 4_000_000,
   hook='A fashion matriarch who sells handbags with fingerprint locks and keeps the fingerprints.',
   notes='controls Casa Brambilla through Class A shares while Gulf money holds most of the equity (A)')
C.append(dict(key='aydinoglu', name='Kerem Aydinoglu', tier='rival', profile='Rich', location='Istanbul', origin_province='TR-0001',
              age=52, money_type='state-linked', skills=(14,16,17,15,5,12), traits=['Ambitious','Gregarious','Deceitful'],
              ideology='Sovereigntists', cash_usd=300_000_000, wealth=3.0,
              hook='Builds the government\'s bridges, airports and border walls on no-bid contracts, paid in tolls guaranteed for 30 years.', notes=''))
ch('alharbi', 'Tariq Al-Harbi', 'rival', 'Rich', 'Riyadh', 'SA-0001', 46, 'state-linked', (15,14,15,13,12,10),
   ['Visionary','Ambitious','Ruthless'], 'Accelerationists', 150_000_000, wealth=2.0,
   hook='The sovereign fund\'s man for megaprojects, building a mirrored desert city meant to be run by AI before anyone lives in it.')
ch('mbuyi', 'Augustin Mbuyi-Kalala', 'rival', 'Connected', 'Kolwezi-Lubumbashi', 'CD-0023', 57, 'state-linked', (11,13,12,19,4,15),
   ['Ruthless','Greedy','Paranoid'], 'Sovereigntists', 20_000_000,
   hook='A general who holds Katanga\'s cobalt concessions in his cousins\' names and sells to whoever pays in cash, guns or satellite time.',
   notes='controls through figurehead cousins (1.3.1) (A)')
ch('vermaak', 'Jaco Vermaak', 'rival', 'Connected', 'Johannesburg', 'ZA-0001', 50, 'criminal', (10,17,12,17,6,16),
   ['Ruthless','Brave','Greedy'], 'Chuds', 7_000_000,
   hook='His private security army outnumbers the Gauteng police, and he also runs the illegal miners it is paid to keep out.')
ch('benari', 'Noa Ben-Ari', 'rival', 'Talented', 'Tel Aviv', 'IL-0004', 33, 'tech', (8,10,9,21,22,11),
   ['Paranoid','Ambitious','Diligent'], 'Sovereigntists', 800_000,
   hook='An ex-signals officer whose zero-click spyware opens any phone; she sells it to governments and keeps a copy of everything it finds.')
ch('leinweber', 'Stavros Leinweber', 'rival', 'Talented', 'Berlin', 'DE-0013', 31, 'tech', (16,8,13,14,20,15),
   ['Hedonist','Visionary','Deceitful'], 'Accelerationists', 500_000,
   hook='A Greek-German crypto anarchist whose "shadow drachma" coin now runs half of Greece\'s post-default black economy.')
# Group three: Asia and Oceania
ch('baek', 'Baek Seo-yeon', 'rival', 'Rich', 'Seoul-Pyeongtaek', 'KR-0001', 36, 'old', (17,15,17,16,12,9),
   ['Ambitious','Ruthless','Narcissist'], 'Liberals', 500_000_000, wealth=8.0,
   hook='Won her chaebol\'s succession war by leaking her brothers\' group chats, and now runs memory chips and shipyards with a smile the cameras love.')
ch('batliwalla', 'Jehangir Batliwalla', 'rival', 'Rich', 'Mumbai', 'IN-0013', 74, 'old', (18,16,14,10,6,5),
   ['Cautious','Generous','Diligent'], 'Liberals', 400_000_000, wealth=5.0,
   hook='Patriarch of a 150-year-old trading house that owns ports, steel, salt and the water supply of four cities, and has never once been sued.')
ch('mcalister', 'Hamish McAlister-Groote', 'rival', 'Rich', 'Perth-Pilbara', 'AU-0035', 55, 'old', (14,17,11,10,9,14),
   ['Brave','Greedy','Visionary'], 'Sovereigntists', 500_000_000, wealth=6.0,
   hook='An iron-ore heir building a sovereign data-center belt across the outback, with a private coast guard to protect the cables.')
ch('zhou', 'Zhou Weiming', 'rival', 'Connected', 'Shanghai', 'CN-0008', 58, 'state-linked', (15,17,12,18,8,7),
   ['Diligent','Cautious','Deceitful'], 'Communists', 5_000_000,
   hook='Party secretary of a state shipyard who built a private EV and chip empire in his relatives\' names; one audit could end him.',
   notes='controls through relatives as figureheads (1.3.1) (A)')
ch('tan', 'Clarissa Tan', 'rival', 'Rich', 'Singapore', 'SG-0001', 49, 'state-linked', (21,14,13,14,10,9),
   ['Cautious','Diligent','Ambitious'], 'Effective Altruists', 200_000_000, wealth=2.0,
   hook='Left the sovereign fund with half its best people and its data-center map; the state is now her biggest partner and her minder.')
ch('wicaksono', 'Haryo Wicaksono', 'rival', 'Rich', 'Jakarta', 'ID-0001', 47, 'state-linked', (13,15,16,15,5,13),
   ['Ruthless','Greedy','Gregarious'], 'Sovereigntists', 300_000_000, wealth=4.0,
   hook='A general\'s son whose nickel smelters run on captive coal plants; every EV battery in Asia passes through his furnaces.')
ch('qureshi', 'Shahzad Qureshi', 'rival', 'Connected', 'Karachi', 'PK-0001', 61, 'state-linked', (14,16,12,15,4,8),
   ['Cautious','Ruthless','Diligent'], 'Sovereigntists', 4_000_000,
   hook='A retired brigadier who chairs the army\'s welfare foundation and its business empire of fertilizer, cement, banks and cereal.',
   notes='controls as chair of the Sipahi Welfare Foundation, which holds the stakes (A)')
ch('lam', 'Lam Ka-fai', 'rival', 'Rich', 'Hong Kong', 'HK-0001', 64, 'criminal', (17,12,15,18,5,14),
   ['Greedy','Gregarious','Deceitful'], 'Landites', 120_000_000, wealth=1.8,
   hook='"Uncle Fai" runs Macau\'s biggest VIP junket and an underground bank that moves mainland money out one baccarat chip at a time.')
ch('chen', 'Chen Yi-ting', 'rival', 'Talented', 'Hsinchu-Taipei', 'TW-0004', 38, 'tech', (11,15,9,8,23,10),
   ['Diligent','Visionary','Brave'], 'Sovereigntists', 700_000,
   hook='A chip-design prodigy who thinks the island\'s fabs are its only real deterrent and plans to make every AI chip depend on her designs.')
ch('villaraza', 'Joaquin Villaraza', 'rival', 'Talented', 'Manila', 'PH-0001', 27, 'tech', (10,12,15,14,17,20),
   ['Hedonist','Gregarious','Deceitful'], 'Accelerationists', 350_000,
   hook='Runs a 20,000-phone click farm that sells elections, reviews and followers across Asia; he and Ricky Feng share a landlord, and an enemy.')

GROUP = {}
for k in ['antone','ricky','dot','pablo','whitlock','bastos','saldivar','arrieta','achterberg','strickland',
          'vandergriff','tanaka','brandao','quispe','terry','john']:
    GROUP[k] = 1
for k in ['tolu','pieter','samir','margaux','viktor','fenwick','habersaat','ellwangen','brambilla','aydinoglu',
          'alharbi','mbuyi','vermaak','benari','leinweber']:
    GROUP[k] = 2
for k in ['kroll','fang','qiao','ananya','yuna','baek','batliwalla','mcalister','zhou','tan','wicaksono',
          'qureshi','lam','chen','villaraza']:
    GROUP[k] = 3
NEW_RIVALS = ['whitlock','bastos','saldivar','arrieta','achterberg','strickland','vandergriff','tanaka','brandao','quispe',
              'fenwick','habersaat','ellwangen','brambilla','aydinoglu','alharbi','mbuyi','vermaak','benari','leinweber',
              'baek','batliwalla','mcalister','zhou','tan','wicaksono','qureshi','lam','chen','villaraza']

# ---------------------------------------------------------------- named holders (A)
DRAFT = 'from drafts/na-characters.md (draft proposal, not yet in 7.3) (A)'
ch('beau', 'Beau Lacoste', 'holder', 'Rich', 'Houston', 'US-0122', 46, 'old', (14,15,12,7,5,13),
   ['Brave','Greedy','Hedonist'], 'Chuds', 150_000_000,
   hook='A loud Gulf Coast wildcatter with $2B of reserve-backed loans due in 2021, who wants Arrowhead Drilling.', notes=DRAFT)
ch('corinne', 'Corinne Vale', 'holder', 'Rich', 'Las Vegas', 'US-0076', 63, 'old', (17,13,15,12,4,10),
   ['Greedy','Narcissist','Cautious'], 'Landites', 300_000_000,
   hook='The grand dame of the Strip, who calls Terry\'s casino "a bingo hall with a grift attached".', notes=DRAFT)
ch('hollis', 'Hollis Brandt', 'holder', 'Connected', 'Washington DC', 'US-0030', 58, 'state-linked', (9,6,19,16,3,11),
   ['Ambitious','Deceitful','Gregarious'], 'Liberals', 15_000_000,
   hook='The K Street fixer who brokered corporate help for the hunt on the Trump crime family, and kept the files.', notes=DRAFT)
ch('ines', 'Ines Villarreal', 'holder', 'Rich', 'Monterrey', 'MX-0011', 52, 'old', (15,18,9,14,6,8),
   ['Ruthless','Diligent','Paranoid'], 'Sovereigntists', 200_000_000,
   hook='Rebuilt a steel and cement group into Mexico\'s industrial champion, and still pays a cartel.', notes=DRAFT)
ch('ty', 'Tyrell Whitaker', 'holder', 'Talented', 'Atlanta', 'US-0038', 29, 'tech', (16,7,17,6,14,18),
   ['Ambitious','Gregarious','Cynic'], 'Liberals', 150_000,
   hook='An ex-Occupy organizer building mobile payments for the unbanked.', notes=DRAFT)
ch('wesley', 'Wesley Chu', 'holder', 'Rich', 'Vancouver', 'CA-0026', 41, 'old', (18,10,11,13,6,9),
   ['Cautious','Generous','Deceitful'], 'Liberals', 100_000_000,
   hook='A polite developer whose towers are full of empty condos bought with money from China.', notes=DRAFT)
ch('silas', 'Silas Reed', 'holder', 'Connected', 'Austin', 'US-0126', 34, 'tech', (11,9,14,15,16,12),
   ['Visionary','Ruthless','Zealot'], 'Landites', 8_000_000,
   hook='A Texas fixer who brokers chip fab and data center deals, promising the same tax breaks to three rivals.', notes=DRAFT)
ch('lucia', 'Lucia Ferraro', 'holder', 'Connected', 'Miami', 'US-0031', 44, 'criminal', (19,5,16,18,4,8),
   ['Paranoid','Gregarious','Deceitful'], 'Sovereigntists', 12_000_000,
   hook='Private banker to Latin America\'s flight capital, who sells secrets one at a time.', notes=DRAFT)
ch('gennaro', 'Salvatore Gennaro', 'holder', '', 'New York', 'US-0087', 67, 'criminal', (9,12,11,16,2,14),
   ['Ruthless','Cautious','Greedy'], 'Chuds', 6_000_000,
   hook='"Sally Boots", the crew boss Antone Provolone still answers to; owns the carting front on paper.',
   notes='named for 7.3 Antone\'s premise (A)')
ch('nakhli', 'Yusuf Al-Nakhli', 'holder', '', 'Dubai', 'AE-0012', 51, 'criminal', (12,9,14,15,6,17),
   ['Deceitful','Gregarious','Greedy'], 'Landites', 3_000_000,
   hook='The fixer who gave Samir Haddad a battered drone on credit, for a favor still unnamed.',
   notes='named for 7.3 Samir\'s premise (A)')
# figureheads: holders of record for a rival who controls for real (1.3.1)
for key, name, loc, prov, age, pron, boss, who in [
        ('fh_viktor1', 'Arkady Belozersky', 'Moscow', 'RU-0002', 57, 'he', 'viktor', 'An old KGB classmate'),
        ('fh_viktor2', 'Oksana Tarkhanova', 'St Petersburg', 'RU-0015', 41, 'she', 'viktor', 'A shipping lawyer'),
        ('fh_qiao1', 'Qiao Mingde', 'Beijing', 'CN-0002', 71, 'he', 'qiao', 'Her retired uncle'),
        ('fh_qiao2', 'Xu Lihua', 'Beijing', 'CN-0003', 46, 'she', 'qiao', 'Her sister-in-law'),
        ('fh_zhou1', 'Song Jianhua', 'Shanghai', 'CN-0009', 55, 'he', 'zhou', 'His brother-in-law'),
        ('fh_zhou2', 'Zhou Meiling', 'Shanghai', 'CN-0010', 33, 'she', 'zhou', 'His niece'),
        ('fh_mbuyi1', 'Patrice Kasongo', 'Kolwezi-Lubumbashi', 'CD-0023', 44, 'he', 'mbuyi', 'His cousin'),
        ('fh_mbuyi2', 'Nadine Ilunga', 'Kolwezi-Lubumbashi', 'CD-0024', 38, 'she', 'mbuyi', 'His cousin')]:
    C.append(dict(key=key, name=name, tier='holder', profile='', location=loc, origin_province=prov, age=age,
                  money_type='state-linked', skills=(6,7,8,9,3,6), traits=['Trusting','Content','Cautious'],
                  ideology='Communists' if boss in ('qiao','zhou') else 'Sovereigntists', cash_usd=1_500_000,
                  wealth=None, hook='%s who holds stakes on the books for someone else and signs what %s is told.' % (who, pron),
                  notes='figurehead for %s (1.3.1)' % boss, boss=boss))

# ---------------------------------------------------------------- named companies
# key, name, industry, hq_province, public, revenue (fixed $M or None for auto size), hint, book override,
# controller key, stake, basis, owner_of_record key, other holders [(key, pct)], notes
CO = []
def co(key, name, industry, prov, public, rev=None, hint=None, book=None, ctrl=None, stake=None, basis=None,
       record=None, others=(), notes='', value=None):
    CO.append(dict(key=key, name=name, industry=industry, prov=prov, public=public, rev=rev, hint=hint, book=book,
                   ctrl=ctrl, stake=stake, basis=basis, record=record, others=list(others), notes=notes, value=value))

# Terry and Arrowhead (7.3.0, 7.3.5, 8-quest-lines)
co('arrowhead', 'Arrowhead Drilling', 'Oil', 'CA-0033', 'Y', rev=40, book=100, value=100, ctrl='terry', stake=60, basis='majority',
   notes='Once People Oil Trust; the smallest oil company in the game, worth $100M; Terry 60% (Chair), public 40%; John Techno is COO with options on 2% from Terry\'s shares; CEO Dale Pruitt; owns the oil software (8.3)')
co('paintedsky', 'Painted Sky Gaming', 'Gambling', 'CA-0033', 'N', rev=330, ctrl='terry', stake=100, basis='majority',
   notes='Terry\'s very popular casino, held by a private company he owns outright (7.3.5); CFO Kip Tran; its books are Terry\'s secret')
co('kidswhocode', 'Kids Who Code', 'Software', 'CA-0033', 'N', rev=0, book=1, ctrl='terry', stake=100, basis='majority',
   notes='Terry\'s charity; its team in India is a frozen unit making software with 100 desktops (8.3, 10.0.2)')
# Antone
co('mulberry', 'Mulberry Street Capital', 'Asset management', 'US-0086', 'N', rev=12, ctrl='antone', stake=70, basis='majority',
   others=[], notes='Antone\'s boutique brokerage (7.3.1)')
co('bowery', 'Bowery Bridge Lending', 'Banking', 'US-0087', 'N', rev=8, ctrl='antone', stake=60, basis='majority',
   notes='private credit to people banks will not touch; collections are handled by the crew')
co('libertyledger', 'Liberty Ledger Clearing', 'Professional services', 'US-0081', 'N', rev=9, ctrl='antone', stake=55, basis='majority',
   notes='back-office clearing for small brokers; a window into everyone\'s trades')
co('tristate', 'Tri-State Carting', 'Black market', 'US-0088', 'N', rev=30, ctrl='gennaro', stake=55, basis='majority',
   others=[('antone', 25)], notes='a waste-hauling front that washes money for the crew; Antone holds a silent 25% (7.3.1)')
# Ricky
co('ghostline', 'Ghostline Labs', 'Software', 'US-0018', 'N', rev=5, ctrl='ricky', stake=100, basis='majority',
   notes='Ricky\'s one-man security shop, mostly a cover')
co('lotusgrid', 'Lotus Grid Compute', 'Cloud', 'SG-0002', 'N', rev=420, ctrl='ricky', stake=85, basis='majority',
   notes='holds Ricky\'s very large compute in Asia (7.3.1)')
co('clicktide', 'ClickTide', 'SaaS', 'PH-0002', 'N', rev=60, ctrl='ricky', stake=90, basis='majority',
   notes='bot farm SaaS run from the Philippines and Thailand (7.3.1); shares a landlord with Joaquin Villaraza')
# Dot
co('percylegacy', 'Percy Legacy Holdings', 'Real estate', 'US-0010', 'N', rev=180, ctrl='dot', stake=100, basis='majority',
   notes='her late husband\'s estate: Bel Air and Malibu property; also holds the studio Percy Pictures and a stake in a streamer, which are media outlets (16), not rows here')
co('laurelcanyon', 'Laurel Canyon Talent', 'Professional services', 'US-0011', 'N', rev=120, ctrl='dot', stake=80, basis='majority',
   notes='a talent agency that represents half of Dot\'s rivals')
co('maisonpercy', 'Maison Percy', 'Luxury', 'US-0012', 'Y', rev=650, ctrl='dot', stake=40, basis='class_a',
   notes='fragrance and jewelry line built on the Percy name')
# Pablo
co('cafesegundo', 'Cafe Segundo Cooperativa', 'Agriculture', 'CO-0005', 'N', rev=3, ctrl='pablo', stake=51, basis='majority',
   notes='a coffee cooperative and his public face')
co('motorapido', 'Moto Rapido Paisa', 'Logistics', 'CO-0005', 'N', rev=1.5, ctrl='pablo', stake=60, basis='majority',
   notes='motorbike couriers who carry more than parcels')
co('lafrontera', 'Casa de Cambio La Frontera', 'Black market', 'CO-0005', 'N', rev=4, ctrl='pablo', stake=60, basis='majority',
   notes='a money changer for cartel cash')
# Tolu
co('balogundelta', 'Balogun Delta Petroleum', 'Oil', 'NG-0001', 'Y', rev=2500, ctrl='tolu', notes='Tolu\'s oil company (7.3.2)')
co('marinacrown', 'Marina Crown Bank', 'Banking', 'NG-0001', 'Y', rev=800, ctrl='tolu')
co('lekkihorizon', 'Lekki Horizon Developments', 'Real estate', 'NG-0001', 'N', rev=140, ctrl='tolu')
co('atlanticgate', 'Atlantic Gate Construction', 'Construction', 'NG-0002', 'N', rev=300, ctrl='tolu', notes='wins most Lagos state contracts')
co('creekside', 'Creekside Marine Services', 'Black market', 'NG-0004', 'N', rev=90, ctrl='tolu', stake=60, basis='majority',
   notes='oil bunkering: crude stolen from Delta pipelines (A)')
# Pieter
co('kempenlicht', 'Kempenlicht Systems', 'Semiconductors', 'NL-0009', 'Y', rev=12000, ctrl='pieter',
   notes='the Eindhoven company Pieter\'s father built; its unit is the world\'s only maker of lithography machines (2.3.4, 7.3.2)')
co('brabantprecision', 'Brabant Precision', 'Robotics', 'NL-0009', 'N', rev=600, ctrl='pieter', stake=70, basis='majority')
co('floopvastgoed', 'Von Floop Vastgoed', 'Real estate', 'NL-0009', 'N', rev=40, ctrl='pieter', stake=100, basis='majority',
   notes='family property company')
# Samir
co('haddadaerial', 'Haddad Aerial Services', 'Drones', 'AE-0008', 'N', rev=0.05, ctrl='samir', stake=55, basis='majority',
   others=[('nakhli', 45)], notes='one battered drone, on credit, for a favor (7.3.2)')
co('sandsparrow', 'Sand Sparrow Couriers', 'Logistics', 'AE-0010', 'N', rev=0.03, ctrl='samir', stake=60, basis='majority',
   others=[('nakhli', 40)], notes='drone deliveries across the labor camps')
co('deserteye', 'Desert Eye Survey', 'Professional services', 'AE-0008', 'N', rev=0.02, ctrl='samir', stake=100, basis='majority',
   notes='aerial survey for megaproject contractors; one client so far')
# Margaux
co('maisonvalcourt', 'Maison Valcourt', 'Luxury', 'FR-0001', 'Y', rev=1500, ctrl='margaux', notes='the uncle\'s couture house')
co('valcourtvignobles', 'Valcourt Vignobles', 'Agriculture', 'FR-0002', 'N', rev=220, ctrl='margaux', stake=100, basis='majority')
co('fonciere', 'Fonciere Valcourt', 'Real estate', 'FR-0001', 'N', rev=260, ctrl='margaux', stake=90, basis='majority')
# Viktor (figureheads)
co('balticmeridian', 'Baltic Meridian Trading', 'Oil', 'RU-0015', 'N', rev=6000, ctrl='viktor', stake=60, basis='proxy', record='fh_viktor1',
   notes='sells sanctioned crude through a grey fleet (7.2.0)')
co('vostokdata', 'Vostok Data Security', 'Software', 'RU-0002', 'N', rev=80, ctrl='viktor', stake=60, basis='proxy', record='fh_viktor1',
   notes='a front for the Moscow cybercrime underground')
co('nevatankers', 'Neva Tankers', 'Shipping', 'RU-0016', 'N', rev=700, ctrl='viktor', stake=55, basis='proxy', record='fh_viktor2',
   notes='the grey fleet itself')
co('kremnev', 'Kremnev Security Group', 'Professional services', 'RU-0001', 'N', rev=150, ctrl='viktor', stake=60, basis='proxy', record='fh_viktor2')
# Kroll
co('krollmotor', 'Kroll Motorworks', 'Autos', 'NZ-0001', 'Y', rev=15000, ctrl='kroll', notes='the automotive fortune (7.3.3)')
co('krollmarine', 'Kroll Marine', 'Shipping', 'NZ-0016', 'N', rev=350, ctrl='kroll', stake=100, basis='majority',
   notes='the boats he crashes into Antarctica')
co('southernreach', 'Southern Reach Colony Company', 'Construction', 'NZ-0016', 'N', rev=20, ctrl='kroll', stake=100, basis='majority',
   notes='builds and runs Kroll\'s colony (7.8); HQ in Southland until the claimed province exists (A)')
co('krollrobotics', 'Kroll Robotics', 'Robotics', 'NZ-0013', 'N', rev=250, ctrl='kroll', stake=90, basis='majority')
# Fang
co('qianhai', 'Qianhai Bridge Capital', 'Asset management', 'CN-0019', 'N', rev=0.4, ctrl='fang', stake=70, basis='majority')
co('harbourline', 'Harbourline Payments', 'Banking', 'HK-0001', 'N', rev=0.8, ctrl='fang', stake=60, basis='majority')
co('futianspark', 'Futian Spark Electronics', 'Consumer electronics', 'CN-0020', 'N', rev=1.2, ctrl='fang', stake=55, basis='majority')
# Qiao (figureheads)
co('jinghualand', 'Jinghua Land', 'Real estate', 'CN-0002', 'Y', rev=3000, ctrl='qiao', stake=55, basis='proxy', record='fh_qiao1')
co('huaxiapinnacle', 'Huaxia Pinnacle Asset Management', 'Asset management', 'CN-0001', 'N', rev=300, ctrl='qiao', stake=60, basis='proxy', record='fh_qiao1')
co('changcheng', 'Changcheng Grid Engineering', 'Construction', 'CN-0003', 'N', rev=1800, ctrl='qiao', stake=60, basis='proxy', record='fh_qiao2')
co('tianjie', 'Tianjie Network Services', 'Telecom', 'CN-0004', 'N', rev=900, ctrl='qiao', stake=55, basis='proxy', record='fh_qiao2')
# Ananya
co('hegdeseed', 'Hegde Seed Fund', 'Asset management', 'IN-0023', 'N', rev=0.1, ctrl='ananya', stake=100, basis='majority')
co('cauvery', 'Cauvery Compute Parks', 'Data centers', 'IN-0024', 'N', rev=0.6, ctrl='ananya', stake=51, basis='majority')
co('nandi', 'Nandi Silicon Design', 'Semiconductors', 'IN-0025', 'N', rev=0.3, ctrl='ananya', stake=60, basis='majority')
# Yuna
co('moonlit', 'Moonlit Collective', 'Social media', 'JP-0001', 'N', rev=6, ctrl='yuna', stake=80, basis='majority',
   notes='her creator network; her own channel is a media outlet (16)')
co('hoshizora', 'Hoshizora Beauty', 'Luxury', 'JP-0002', 'N', rev=10, ctrl='yuna', stake=60, basis='majority')
co('kitsune', 'Kitsune Ads', 'Ads', 'JP-0003', 'N', rev=4, ctrl='yuna', stake=70, basis='majority')

# ---- new rivals, group one
co('whitlockmid', 'Whitlock Midstream', 'Gas', 'US-0122', 'Y', rev=4000, ctrl='whitlock', notes='pipelines and LNG export')
co('gulfgrid', 'Gulf Coast Grid', 'Power utilities', 'US-0123', 'Y', rev=3000, ctrl='whitlock', notes='the grid operator in his pocket')
co('sabiapay', 'Sabia Pay', 'Banking', 'BR-0001', 'Y', rev=1200, ctrl='bastos', notes='payments app and social credit scores')
co('redaguila', 'Red Aguila', 'Telecom', 'MX-0001', 'Y', rev=4000, ctrl='saldivar', notes='towers and mobile service')
co('tiendasaguila', 'Tiendas Aguila', 'Retail', 'MX-0002', 'Y', rev=8000, ctrl='saldivar', notes='corner stores and phone credit')
co('pampasoberana', 'Pampa Soberana', 'Agriculture', 'AR-0001', 'Y', rev=2000, ctrl='arrieta', notes='soy, grain and the grain-backed token')
co('rainshadow', 'Rainshadow Cloud', 'Cloud', 'US-0140', 'Y', rev=1500, ctrl='achterberg', notes='sells the municipal OS')
co('strickkinetic', 'Strickland Kinetic', 'Defense', 'US-0030', 'Y', rev=200, ctrl='strickland', stake=12, basis='class_a',
   notes='drone strike systems on subscription')
co('potomacridge', 'Potomac Ridge Data', 'Data centers', 'US-0137', 'N', rev=8, ctrl='strickland', stake=55, basis='majority')
co('longgrayline', 'Long Gray Line Advisory', 'Professional services', 'US-0030', 'N', rev=12, ctrl='strickland', stake=100, basis='majority',
   notes='retired generals for hire')
co('greatlakeswestern', 'Great Lakes and Western Railway', 'Logistics', 'US-0044', 'Y', rev=1500, ctrl='vandergriff', stake=52, basis='trust',
   notes='held by the Vandergriff family trust; she is trustee')
co('prairielight', 'Prairie Light Fiber', 'Telecom', 'US-0045', 'N', rev=420, ctrl='vandergriff', stake=60, basis='trust',
   notes='fiber leases on railroad right-of-way')
co('vandergriffgrain', 'Vandergriff Elevators', 'Agriculture', 'US-0046', 'N', rev=650, ctrl='vandergriff', stake=70, basis='trust')
co('threshold', 'Threshold Access', 'SaaS', 'CA-0001', 'N', rev=0.9, ctrl='tanaka', stake=60, basis='majority', notes='the face-scan door app')
co('facewise', 'Facewise Labs', 'Software', 'CA-0002', 'N', rev=0.3, ctrl='tanaka', stake=70, basis='majority')
co('keyless', 'Keyless Living', 'Real estate', 'CA-0003', 'N', rev=0.5, ctrl='tanaka', stake=51, basis='majority', notes='one smart apartment block')
co('netmorro', 'Net Morro', 'Telecom', 'BR-0011', 'N', rev=8, ctrl='brandao', stake=70, basis='majority', notes='pirate internet in the favelas')
co('gaszonaoeste', 'Gas Comunitario Zona Oeste', 'Gas', 'BR-0012', 'N', rev=10, ctrl='brandao', stake=70, basis='majority', notes='cooking gas cylinders at militia prices')
co('guardiao', 'Condominio Guardiao', 'Real estate', 'BR-0012', 'N', rev=8, ctrl='brandao', stake=80, basis='majority', notes='illegal towers on the west side')
co('tropa', 'Seguranca Tropa', 'Black market', 'BR-0010', 'N', rev=12, ctrl='brandao', stake=100, basis='majority', notes='protection')
co('madrededios', 'Cooperativa Aurifera Madre de Dios', 'Mining', 'PE-0001', 'N', rev=6, ctrl='quispe', stake=55, basis='majority', notes='informal gold')
co('inambari', 'Barcazas del Inambari', 'Logistics', 'PE-0002', 'N', rev=1.2, ctrl='quispe', stake=70, basis='majority')
co('mercurioandino', 'Mercurio Andino', 'Black market', 'PE-0004', 'N', rev=3, ctrl='quispe', stake=80, basis='majority', notes='mercury smuggling')
# ---- group two
co('fenwickuw', 'Fenwick Lyle Underwriting', 'Insurance', 'GB-0001', 'Y', rev=5000, ctrl='fenwick')
co('fenwicktrust', 'Fenwick Island Trust Company', 'Asset management', 'GB-0001', 'N', rev=90, ctrl='fenwick', stake=100, basis='majority',
   notes='trust services in Jersey and the Caymans, run from London')
co('habersaat', 'Bank Habersaat and Cie', 'Banking', 'CH-0001', 'N', rev=900, ctrl='habersaat', stake=60, basis='majority', notes='40,000 numbered accounts')
co('ellwangenmw', 'Ellwangen Motorenwerke', 'Autos', 'DE-0006', 'Y', rev=12000, ctrl='ellwangen')
co('isarre', 'Isar Re', 'Insurance', 'DE-0007', 'Y', rev=6000, ctrl='ellwangen', notes='reinsurance')
co('ewigkeit', 'Klinik Ewigkeit', 'Healthcare services', 'DE-0008', 'N', rev=60, ctrl='ellwangen', stake=100, basis='majority', notes='the longevity clinic')
co('casabrambilla', 'Casa Brambilla', 'Luxury', 'IT-0001', 'Y', rev=120, ctrl='brambilla', stake=10, basis='class_a',
   others=[], notes='biometric-locked handbags; Gulf sovereign money holds a large minority (A)')
co('brambillaimm', 'Brambilla Immobiliare', 'Real estate', 'IT-0002', 'N', rev=12, ctrl='brambilla', stake=70, basis='majority')
co('viaspiga', 'Via Spiga Retail', 'Retail', 'IT-0003', 'N', rev=20, ctrl='brambilla', stake=60, basis='majority')
co('aydinogluyapi', 'Aydinoglu Yapi', 'Construction', 'TR-0001', 'Y', rev=6000, ctrl='aydinoglu', notes='bridges, airports, border walls')
co('sarab', 'Sarab City Development Company', 'Construction', 'SA-0002', 'N', rev=1500, ctrl='alharbi', stake=40, basis='class_a',
   others=[('SAU', 45)], notes='the mirrored desert city; the state fund holds 45% but Al-Harbi holds the voting shares (A)')
co('mbuyimines', 'Societe Miniere du Lualaba', 'Mining', 'CD-0023', 'N', rev=900, ctrl='mbuyi', stake=60, basis='proxy', record='fh_mbuyi1',
   notes='cobalt concessions in a cousin\'s name')
co('katangatransit', 'Katanga Transit', 'Logistics', 'CD-0024', 'N', rev=60, ctrl='mbuyi', stake=60, basis='proxy', record='fh_mbuyi2',
   notes='trucks to the Zambian border')
co('kipushi', 'Comptoir Kipushi', 'Black market', 'CD-0024', 'N', rev=40, ctrl='mbuyi', stake=70, basis='majority', notes='artisanal cobalt and arms')
co('laager', 'Laager Guard Security', 'Professional services', 'ZA-0001', 'N', rev=20, ctrl='vermaak', stake=75, basis='majority', notes='the private army')
co('witssite', 'Witwatersrand Site Services', 'Construction', 'ZA-0002', 'N', rev=15, ctrl='vermaak', stake=80, basis='majority', notes='"site protection"')
co('reefrecovery', 'Reef Recovery Syndicate', 'Black market', 'ZA-0004', 'N', rev=20, ctrl='vermaak', stake=100, basis='majority', notes='illegal gold from abandoned mines')
co('glasshouse', 'Glasshouse Intelligence', 'Software', 'IL-0004', 'N', rev=0.9, ctrl='benari', stake=65, basis='majority', notes='the zero-click spyware')
co('periscope', 'Periscope Analytics', 'SaaS', 'IL-0005', 'N', rev=0.3, ctrl='benari', stake=60, basis='majority')
co('benariconsult', 'Ben-Ari Consulting', 'Professional services', 'IL-0004', 'N', rev=0.2, ctrl='benari', stake=100, basis='majority')
co('drachmanull', 'Drachma Null', 'Banking', 'DE-0013', 'N', rev=0.6, ctrl='leinweber', stake=60, basis='majority', notes='issuer of the shadow drachma coin')
co('kreuzberg', 'Kreuzberg Node Works', 'Software', 'DE-0014', 'N', rev=0.2, ctrl='leinweber', stake=80, basis='majority')
co('piraeusdesk', 'Piraeus Exchange Desk', 'Black market', 'GR-0001', 'N', rev=0.8, ctrl='leinweber', stake=55, basis='majority', notes='cash-for-coin desk in Athens')
# ---- group three
co('sorim', 'Sorim Group', 'Semiconductors', 'KR-0002', 'Y', rev=4000, ctrl='baek', notes='memory chips and the chaebol\'s holding company')
co('sorimheavy', 'Sorim Heavy Industries', 'Shipping', 'KR-0005', 'Y', rev=5000, ctrl='baek', notes='shipyards')
co('batliwalla', 'Batliwalla and Sons', 'Metals', 'IN-0013', 'Y', rev=5000, ctrl='batliwalla', notes='steel and the trading house')
co('batliwallaports', 'Batliwalla Ports', 'Shipping', 'IN-0016', 'Y', rev=1500, ctrl='batliwalla')
co('pilbararediron', 'Pilbara Red Iron', 'Mining', 'AU-0041', 'Y', rev=4000, ctrl='mcalister')
co('outbackdc', 'Outback Sovereign Data', 'Data centers', 'AU-0035', 'N', rev=350, ctrl='mcalister', stake=90, basis='majority', notes='the data-center belt')
co('haipai', 'Haipai Motors', 'EVs', 'CN-0011', 'Y', rev=2500, ctrl='zhou', stake=55, basis='proxy', record='fh_zhou1')
co('pudongnode', 'Pudong Mature Node Semiconductor', 'Semiconductors', 'CN-0012', 'Y', rev=2000, ctrl='zhou', stake=55, basis='proxy', record='fh_zhou1')
co('huangpumarine', 'Huangpu Marine Engineering', 'Shipping', 'CN-0013', 'N', rev=1200, ctrl='zhou', stake=60, basis='proxy', record='fh_zhou2')
co('lujiazuiharbour', 'Lujiazui Harbour Properties', 'Real estate', 'CN-0008', 'N', rev=700, ctrl='zhou', stake=60, basis='proxy', record='fh_zhou2')
co('merlion', 'Merlion Straits Capital', 'Asset management', 'SG-0001', 'N', rev=500, ctrl='tan', stake=40, basis='class_a',
   others=[('SGP', 30)], notes='the state is her biggest partner (A)')
co('halmahera', 'Halmahera Nickel Industries', 'Metals', 'ID-0001', 'Y', rev=4000, ctrl='wicaksono')
co('sipahifert', 'Sipahi Fertilizer', 'Chemicals', 'PK-0001', 'Y', rev=1100, ctrl='qureshi', stake=55, basis='trust',
   notes='held by the Sipahi Welfare Foundation, which Qureshi chairs')
co('sipahicement', 'Sipahi Cement', 'Construction', 'PK-0003', 'Y', rev=700, ctrl='qureshi', stake=55, basis='trust')
co('ghazibank', 'Ghazi Commercial Bank', 'Banking', 'PK-0001', 'Y', rev=600, ctrl='qureshi', stake=51, basis='trust')
co('sipahicereal', 'Sipahi Cereals', 'Agriculture', 'PK-0009', 'N', rev=300, ctrl='qureshi', stake=100, basis='trust')
co('goldenlotus', 'Golden Lotus VIP Club', 'Gambling', 'MO-0001', 'N', rev=900, ctrl='lam', stake=60, basis='majority', notes='the Macau junket')
co('peakfortune', 'Peak Fortune Properties', 'Real estate', 'HK-0002', 'Y', rev=600, ctrl='lam', stake=15, basis='class_a')
co('kowloonremit', 'Kowloon Remittance', 'Black market', 'HK-0003', 'N', rev=120, ctrl='lam', stake=80, basis='majority', notes='the underground bank')
co('formosalattice', 'Formosa Lattice', 'Semiconductors', 'TW-0004', 'N', rev=1.5, ctrl='chen', stake=60, basis='majority')
co('latticeeda', 'Lattice EDA', 'Software', 'TW-0001', 'N', rev=0.4, ctrl='chen', stake=70, basis='majority')
co('chendesign', 'Chen Design Partners', 'Professional services', 'TW-0004', 'N', rev=0.3, ctrl='chen', stake=100, basis='majority')
co('kalaw', 'Kalaw Engagement', 'Ads', 'PH-0002', 'N', rev=1.5, ctrl='villaraza', stake=70, basis='majority', notes='the 20,000-phone click farm')
co('tambay', 'Tambay Social', 'Social media', 'PH-0001', 'N', rev=1, ctrl='villaraza', stake=60, basis='majority')
co('bayanihanbots', 'Bayanihan Bots', 'SaaS', 'PH-0003', 'N', rev=0.8, ctrl='villaraza', stake=80, basis='majority')

# ---- draft holders' companies (A)
co('lacostegulf', 'Lacoste Gulf Energy', 'Oil', 'US-0124', 'Y', rev=4000, ctrl=None, others=[('beau', 40)], notes='oil and LNG export; $2B of reserve-backed loans due 2021 (drafts) (A)')
co('valeresorts', 'Vale Resorts International', 'Gambling', 'US-0076', 'Y', rev=4200, others=[('corinne', 45)], notes='casinos, convention halls and Nevada\'s biggest sportsbook; skims its own books (drafts) (A)')
co('brandtstrat', 'Brandt Strategies', 'Professional services', 'US-0030', 'N', rev=30, ctrl='hollis', stake=60, basis='majority', notes='K Street lobbying firm (drafts) (A)')
co('cerronorte', 'Grupo Cerro Norte', 'Metals', 'MX-0011', 'Y', rev=10000, others=[('ines', 35)], notes='steel and cement riding nearshoring; its construction arm pays a cartel (drafts) (A)')
co('kinfolkpay', 'Kinfolk Pay', 'Banking', 'US-0038', 'N', rev=0.4, ctrl='ty', stake=51, basis='majority', notes='mobile payments for the unbanked (drafts) (A)')
co('chupacific', 'Chu Pacific Developments', 'Real estate', 'CA-0026', 'N', rev=2000, ctrl='wesley', stake=55, basis='majority', notes='Vancouver condo towers (drafts) (A)')
co('lonestarsilicon', 'Lone Star Silicon', 'Semiconductors', 'US-0126', 'Y', rev=150, others=[('silas', 5)], notes='Austin fab; Silas Reed brokered its tax breaks (A)')
co('hillcountrydata', 'Hill Country Data', 'Data centers', 'US-0126', 'Y', rev=40, others=[('silas', 6)])
co('ferraropw', 'Ferraro Private Wealth', 'Asset management', 'US-0031', 'N', rev=15, ctrl='lucia', stake=60, basis='majority', notes='private banking for Latin American flight capital (drafts) (A)')

# ---- the five candidate labs for the LLM tip (7.6) (A)
co('halcyon', 'Halcyon Search', 'Ads', 'US-0019', 'Y', hint='top', notes='big tech search and ads giant; parent of a tip-pool lab (A)')
co('openmeridian', 'Open Meridian Institute', 'AI labs', 'US-0018', 'N', rev=60, book=300, notes='tip-pool candidate: the Bay Area nonprofit lab (7.6) (A); funded by donors, widely held')
co('halcyonfrontier', 'Halcyon Frontier Research', 'AI labs', 'US-0019', 'N', rev=150, book=900, ctrl='@halcyon', stake=100, basis='subsidiary',
   notes='tip-pool candidate: the big tech research division (7.6) (A)')
co('kingsway', 'Kingsway Intelligence', 'AI labs', 'GB-0002', 'N', rev=40, book=200, notes='tip-pool candidate: the London lab (7.6) (A)')
co('tianshu', 'Tianshu Intelligence', 'AI labs', 'CN-0002', 'N', rev=70, book=250, notes='tip-pool candidate: the Beijing lab (7.6) (A)')
co('lakeshore', 'Lakeshore Vector Labs', 'AI labs', 'CA-0002', 'N', rev=25, book=120, notes='tip-pool candidate: the Toronto lab (7.6) (A)')

# ---- state firms (government owns; stake is the state's)
for key, name, ind, prov, hint, iso, stake, pub, note in [
    ('st_sau_oil', 'Ghawar National Oil Company', 'Oil', 'SA-0014', 'top', 'SAU', 98, 'Y', 'the largest oil company in the world'),
    ('st_rus_oil', 'Volga-Ural Neft', 'Oil', 'RU-0001', 'big', 'RUS', 55, 'Y', 'sanctioned since 2005; sells through grey fleets'),
    ('st_rus_gas', 'Sibirgaz', 'Gas', 'RU-0015', 'top', 'RUS', 51, 'Y', 'pipeline gas to Europe cut long ago (7.2.0)'),
    ('st_chn_oil', 'China Continental Petroleum', 'Oil', 'CN-0001', 'top', 'CHN', 80, 'Y', ''),
    ('st_chn_tel', 'China Unified Mobile', 'Telecom', 'CN-0001', 'top', 'CHN', 72, 'Y', ''),
    ('st_chn_bank', 'People\'s Commerce Bank of China', 'Banking', 'CN-0001', 'top', 'CHN', 70, 'Y', ''),
    ('st_chn_pow', 'China Central Grid Corporation', 'Power utilities', 'CN-0001', 'top', 'CHN', 100, 'N', ''),
    ('st_chn_con', 'China Rail and Bridge Engineering', 'Construction', 'CN-0001', 'top', 'CHN', 60, 'Y', 'Belt and Road builder'),
    ('st_chn_met', 'Huaxia Iron and Steel', 'Metals', 'CN-0063', 'top', 'CHN', 70, 'Y', ''),
    ('st_chn_swf', 'Zhonghua Reserve Investment', 'Asset management', 'CN-0001', 'top', 'CHN', 100, 'N', 'sovereign fund'),
    ('st_chn_ship', 'Huanghai Ocean Shipping', 'Shipping', 'CN-0008', 'top', 'CHN', 60, 'Y', ''),
    ('st_chn_air', 'Capital Phoenix Airlines', 'Airlines', 'CN-0002', 'big', 'CHN', 55, 'Y', ''),
    ('st_chn_def', 'Northern Ordnance Group', 'Defense', 'CN-0001', 'big', 'CHN', 100, 'N', ''),
    ('st_chn_aero', 'Shenzhou Aerospace Corporation', 'Aerospace', 'CN-0001', 'big', 'CHN', 100, 'N', ''),
    ('st_bra_oil', 'Petroleo Atlantico Brasileiro', 'Oil', 'BR-0010', 'big', 'BRA', 51, 'Y', 'offshore oil'),
    ('st_mex_oil', 'Petroleos de la Nacion Mexicana', 'Oil', 'MX-0001', 'big', 'MEX', 100, 'N', ''),
    ('st_nor_oil', 'Nordsjo Energi', 'Oil', 'NO-0001', 'big', 'NOR', 67, 'Y', ''),
    ('st_nor_swf', 'Norwegian Petroleum Reserve Fund', 'Asset management', 'NO-0001', 'big', 'NOR', 100, 'N', 'sovereign fund'),
    ('st_are_oil', 'Liwa National Oil Company', 'Oil', 'AE-0001', 'big', 'ARE', 100, 'N', ''),
    ('st_are_swf', 'Abu Dhabi Sovereign Holdings', 'Asset management', 'AE-0002', 'big', 'ARE', 100, 'N', 'sovereign fund; AI investment'),
    ('st_qat_gas', 'Ras Laffan Gas Company', 'Gas', 'QA-0008', 'top', 'QAT', 100, 'N', 'the largest LNG exporter'),
    ('st_qat_swf', 'Al Bidda Investment Authority', 'Asset management', 'QA-0001', 'mid', 'QAT', 100, 'N', 'sovereign fund'),
    ('st_sau_swf', 'Saudi Public Wealth Fund', 'Asset management', 'SA-0001', 'big', 'SAU', 100, 'N', 'sovereign fund; backs the megaprojects'),
    ('st_irn_oil', 'Persian Gulf National Oil', 'Oil', 'IR-0001', 'big', 'IRN', 100, 'N', 'Iran, the one holdout (7.2.0)'),
    ('st_irq_oil', 'Basra-Kirkuk Oil Company', 'Oil', 'IQ-0001', 'big', 'IRQ', 100, 'N', 'a stable US-aligned exporter (7.2.0)'),
    ('st_nga_oil', 'Nigerian National Hydrocarbon Corporation', 'Oil', 'NG-0001', 'mid', 'NGA', 100, 'N', ''),
    ('st_ind_oil', 'Bharat Urja Petroleum', 'Oil', 'IN-0051', 'big', 'IND', 55, 'Y', ''),
    ('st_ind_bank', 'State Bank of Bharat', 'Banking', 'IN-0013', 'big', 'IND', 57, 'Y', ''),
    ('st_fra_pow', 'Reseau Atomique de France', 'Power utilities', 'FR-0001', 'big', 'FRA', 84, 'Y', 'nuclear fleet'),
    ('st_ita_pow', 'Energia Tirrenica', 'Power utilities', 'IT-0007', 'big', 'ITA', 24, 'Y', 'golden share (State-Linked charter, 1.5)'),
    ('st_ita_gas', 'Gasdotti Italiani Nazionali', 'Gas', 'IT-0007', 'mid', 'ITA', 30, 'Y', 'golden share (State-Linked charter, 1.5)'),
    ('st_sgp_swf', 'Lion City Investment Holdings', 'Asset management', 'SG-0001', 'big', 'SGP', 100, 'N', 'sovereign fund'),
    ('st_dza_gas', 'Hassi R\'Mel Hydrocarbures', 'Gas', 'DZ-0001', 'mid', 'DZA', 100, 'N', ''),
    ('st_mys_oil', 'Semenanjung Petroleum Nasional', 'Oil', 'MY-0001', 'mid', 'MYS', 100, 'N', ''),
    ('st_idn_pow', 'Listrik Nusantara Negara', 'Power utilities', 'ID-0001', 'big', 'IDN', 100, 'N', ''),
    ('st_rus_bank', 'Narodny Savings Bank', 'Banking', 'RU-0001', 'big', 'RUS', 50, 'Y', ''),
    ('st_rus_def', 'Rossiya Defense Industries', 'Defense', 'RU-0001', 'big', 'RUS', 100, 'N', 'drone war orders'),
    ('st_usa_none', None, None, None, None, None, None, None, None)]:
    if name is None:
        continue
    co(key, name, ind, prov, pub, hint=hint, ctrl=iso, stake=stake, basis='state', notes=('state firm; ' + note).rstrip('; '))

# Rich rivals: how many companies to control in all, and where to look in the pool (T)
RICH_POOL = {
    'tolu':       (5, ['Telecom','Insurance','Retail','Power utilities','Agriculture'], ['NGA','GHA','ZAF','KEN']),
    'margaux':    (4, ['Luxury','Retail','Insurance','Aerospace','Agriculture','Real estate'], ['FRA','BEL','CHE','ITA','ESP']),
    'kroll':      (4, ['EVs','Autos','Shipping','Mining','Aerospace'], ['NZL','AUS','USA']),
    'whitlock':   (4, ['Oil','Chemicals','Shipping','Insurance','Real estate'], ['USA']),
    'bastos':     (3, ['SaaS','Ads','Insurance','E-commerce','Software'], ['BRA','ARG','COL','CHL']),
    'saldivar':   (4, ['Banking','Construction','Consumer electronics','Retail','Real estate','Fast food'], ['MEX']),
    'arrieta':    (3, ['Banking','Logistics','Mining','Agriculture'], ['ARG','URY','CHL']),
    'achterberg': (3, ['Data centers','Software','SaaS','Robotics','Drones'], ['USA','CAN']),
    'fenwick':    (4, ['Insurance','Real estate','Asset management','Professional services','Banking'], ['GBR','JEY','GGY','CYM','BMU','IRL']),
    'habersaat':  (3, ['Asset management','Insurance','Pharma','Banking'], ['CHE','LIE','LUX','AUT']),
    'ellwangen':  (4, ['Robotics','Autos','Healthcare services','Chemicals','EVs'], ['DEU','AUT']),
    'aydinoglu':  (3, ['Power utilities','Real estate','Banking','Airlines','Defense'], ['TUR','AZE']),
    'alharbi':    (3, ['Data centers','Renewables','Robotics','Construction'], ['SAU','ARE','BHR']),
    'baek':       (4, ['Consumer electronics','Insurance','Retail','EVs','Shipping'], ['KOR']),
    'batliwalla': (4, ['Power utilities','Chemicals','Metals','Construction','Logistics'], ['IND','LKA']),
    'mcalister':  (3, ['Gas','Mining','Shipping','Data centers'], ['AUS','NZL']),
    'tan':        (3, ['Data centers','Shipping','Banking','Real estate'], ['SGP','MYS','IDN','THA']),
    'wicaksono':  (3, ['Mining','Power utilities','Agriculture','Construction'], ['IDN','MYS','PHL']),
    'ricky':      (3, [], []),
    'dot':        (3, [], []),
    'pieter':     (3, [], []),
    'terry':      (3, [], []),
}

# ---------------------------------------------------------------- 50 more new rivals (coordinator update to batch 136:
# 10 new rivals per superregion, 80 in all; these 50 top up the 30 above)
NEW50 = []
def R(key, name, profile, loc, prov, age, money, skills, traits, ideology, cash, wealth, hook, flag, n_total, inds):
    NEW50.append(key)
    C.append(dict(key=key, name=name, tier='rival', profile=profile, location=loc, origin_province=prov, age=age,
                  money_type=money, skills=skills, traits=traits.split(';'), ideology=ideology, cash_usd=cash,
                  wealth=wealth, hook=hook, notes=''))
    fname, find, fprov, fpub, frev = flag
    stake, basis = (None, None) if frev is None or profile == 'Rich' else (rng_stake(key), 'majority')
    co(key + '_flag', fname, find, fprov, fpub, rev=frev, ctrl=key, stake=stake, basis=basis)
    RICH_POOL[key] = (n_total, inds, ['@' + fprov])

import zlib
def rng_stake(key):
    return 51 + zlib.crc32(key.encode()) % 40

# North America
R('crane', 'Thaddeus Crane', 'Rich', 'Boston', 'US-0064', 69, 'old', (21,10,14,13,6,5), 'Cautious;Greedy;Humble', 'Landites', 300_000_000, 4.0,
  'Runs a 200-year-old Boston trust that owns a slice of every pharma patent and votes it like a bishop.',
  ('Beacon Hill Fiduciary', 'Asset management', 'US-0064', 'N', None), 2, ['Pharma', 'Insurance'])
R('achebe', 'Desmond Achebe-Faulk', 'Connected', 'Atlanta', 'US-0038', 44, 'tech', (12,17,14,15,14,13), 'Ambitious;Paranoid;Diligent', 'Liberals', 4_000_000, 0.03,
  'Runs the freight software at the world\'s busiest airport and knows what is in every crate that lands in Atlanta.',
  ('Peachline Freight Systems', 'Logistics', 'US-0038', 'N', None), 2, ['Software', 'Logistics'])
R('okafor', 'Bernadette Okafor', 'Talented', 'Detroit', 'US-0066', 36, 'tech', (8,21,11,6,18,15), 'Diligent;Brave;Cynic', 'Accelerationists', 200_000, 0.0005,
  'A plant foreman rebuilding a dead auto plant as a lights-out robot factory that will employ nobody, starting with herself.',
  ('Eight Mile Automata', 'Robotics', 'US-0066', 'N', 1.5), 1, [])
R('barragan', 'Guadalupe Barragan', 'Connected', 'Guadalajara', 'MX-0007', 47, 'criminal', (13,18,12,17,9,18), 'Ruthless;Cautious;Greedy', 'Chuds', 6_000_000, 0.03,
  '"Lupe" runs the night shift of Guadalajara\'s electronics plants: a second assembly line for phones that officially never exist.',
  ('Ensambles Tapatios', 'Consumer electronics', 'MX-0007', 'N', None), 2, ['Black market', 'Logistics'])
# Latin America
R('montenegro', 'Aurelio Montenegro Ibanez', 'Rich', 'Santiago', 'CL-0009', 63, 'old', (19,15,13,14,5,7), 'Greedy;Conservative;Cautious', 'Landites', 350_000_000, 4.5,
  'Owns the copper mines and the pension funds that own the copper; Chile\'s retirees are his hostages.',
  ('Andes Cobre', 'Mining', 'CL-0003', 'Y', None), 2, ['Asset management', 'Mining'])
R('cienfuegos', 'Valeria Cienfuegos', 'Connected', 'Bogota', 'CO-0001', 52, 'state-linked', (10,15,13,21,8,12), 'Paranoid;Ruthless;Diligent', 'Sovereigntists', 5_000_000, 0.03,
  'A former intelligence chief who now guards every oil pipeline in Colombia, and decides which ones get bombed.',
  ('Escudo Andino', 'Professional services', 'CO-0001', 'N', None), 2, ['Defense', 'Drones'])
R('pardo', 'Ignacio Pardo', 'Connected', 'Caracas', 'VE-0001', 58, 'state-linked', (15,9,16,18,4,15), 'Deceitful;Greedy;Gregarious', 'Communists', 8_000_000, 0.04,
  'Runs the regime\'s oil-for-gold swaps and keeps the only honest books in Caracas, in his head.',
  ('Orinoco Gold Trading', 'Black market', 'VE-0001', 'N', None), 2, ['Mining', 'Shipping'])
R('ferreira', 'Luana Ferreira Tavares', 'Talented', 'Sao Paulo', 'BR-0002', 25, 'tech', (14,10,15,9,22,17), 'Visionary;Brave;Honest', 'Communists', 60_000, 0.0005,
  'A favela-born coder whose open-source bank app runs on 30 million cheap phones and answers to no central bank.',
  ('Laje Bank', 'Banking', 'BR-0002', 'N', 1.2), 1, [])
R('esquivel', 'Rodrigo Esquivel Brandt', 'Connected', 'Panama City', 'PA-0001', 61, 'old', (17,9,15,19,5,8), 'Cautious;Deceitful;Gregarious', 'Landites', 15_000_000, 0.04,
  'Registers ships, shells and secrets; half the world\'s grey fleet flies flags he sells.',
  ('Istmo Registry Services', 'Professional services', 'PA-0001', 'N', None), 2, ['Shipping', 'Banking'])
R('cordero', 'Mariela Cordero', 'Connected', 'Havana', 'CU-0001', 55, 'state-linked', (12,17,14,16,4,13), 'Diligent;Cautious;Ambitious', 'Communists', 1_000_000, 0.02,
  'Manages the army\'s hotels and cigars, and is quietly getting ready to own them the day the regime falls.',
  ('Malecon Hospitality Group', 'Real estate', 'CU-0001', 'N', None), 2, ['Agriculture', 'Airlines'])
# Europe
R('lindqvist', 'Freja Lindqvist-Aalto', 'Rich', 'Stockholm', 'SE-0001', 38, 'tech', (18,13,16,10,18,12), 'Visionary;Ambitious;Narcissist', 'Accelerationists', 250_000_000, 3.0,
  'Built Europe\'s biggest buy-now-pay-later app and now lends to half the continent\'s teenagers through a game.',
  ('Lagom Pay', 'Banking', 'SE-0001', 'Y', None), 2, ['E-commerce', 'SaaS'])
R('hrytsenko', 'Mykola Hrytsenko', 'Connected', 'Kyiv', 'UA-0001', 34, 'tech', (8,15,12,13,21,17), 'Brave;Zealot;Diligent', 'Sovereigntists', 2_000_000, 0.02,
  'Turned a Kyiv game studio into the front line\'s drone software house; every quadcopter over the Donbas runs his code.',
  ('Zhuravel Drones', 'Drones', 'UA-0001', 'N', None), 2, ['Gaming', 'Software'])
R('larranaga', 'Inigo Larranaga Ocio', 'Rich', 'Madrid', 'ES-0001', 57, 'old', (20,12,14,15,4,9), 'Greedy;Ruthless;Cautious', 'Landites', 300_000_000, 3.5,
  'Bought half of Spain\'s euro-crisis property at ten cents on the euro and rents it back to the people who lost it.',
  ('Inmobiliaria Meseta', 'Real estate', 'ES-0001', 'Y', None), 2, ['Banking', 'Construction'])
R('quinlan', 'Mairead Quinlan', 'Connected', 'Dublin', 'IE-0001', 49, 'old', (21,8,15,17,7,8), 'Diligent;Deceitful;Shy', 'Liberals', 18_000_000, 0.025,
  'The tax architect whose "Double Dublin" structures shelter a trillion dollars of tech profit; she knows where every cent sleeps.',
  ('Liffey Structures', 'Professional services', 'IE-0001', 'N', None), 2, ['Asset management', 'Insurance'])
# Russia and Central Asia
R('polyakov', 'Gennady Polyakov', 'Rich', 'Moscow', 'RU-0001', 61, 'state-linked', (18,16,13,17,5,10), 'Ruthless;Greedy;Paranoid', 'Sovereigntists', 600_000_000, 7.0,
  'Owns the nickel and palladium under the Arctic, and the frozen company town of 180,000 that digs it out.',
  ('Taimyr Metals', 'Mining', 'RU-0059', 'Y', None), 2, ['Metals', 'Mining'])
R('vorontsova', 'Alina Vorontsova', 'Talented', 'Moscow', 'RU-0003', 28, 'criminal', (11,12,8,20,22,14), 'Ambitious;Cynic;Paranoid', 'Accelerationists', 900_000, 0.0008,
  'Runs ransomware like a SaaS company, with a help desk, a refund policy and a rule never to hit Russian targets.',
  ('Kitezh Labs', 'Software', 'RU-0003', 'N', 2.0), 1, [])
R('seitkali', 'Timur Seitkali', 'Rich', 'Almaty', 'KZ-0002', 45, 'state-linked', (17,11,17,16,5,12), 'Greedy;Gregarious;Deceitful', 'Sovereigntists', 400_000_000, 4.0,
  'The president\'s son-in-law, who owns Kazakhstan\'s oil service contracts and, by marriage, its biggest bank.',
  ('Steppe Commercial Bank', 'Banking', 'KZ-0002', 'Y', None), 2, ['Gas', 'Construction'])
R('yuldashev', 'Rustam Yuldashev', 'Connected', 'Tashkent', 'UZ-0001', 53, 'state-linked', (15,14,13,16,4,13), 'Ambitious;Deceitful;Diligent', 'Sovereigntists', 7_000_000, 0.04,
  'Privatizer-in-chief of Uzbek cotton and gold, who buys factories at auction with the ministry\'s own money.',
  ('Zarafshan Gold', 'Mining', 'UZ-0001', 'N', None), 2, ['Agriculture', 'Metals'])
R('mammadova', 'Leyla Mammadova', 'Rich', 'Baku', 'AZ-0001', 42, 'state-linked', (16,12,18,17,6,9), 'Narcissist;Ambitious;Ruthless', 'Sovereigntists', 300_000_000, 3.0,
  'Heiress to a Caspian gas fortune who funds both sides of every Caucasus quarrel and the art fairs in between.',
  ('Absheron Gas', 'Gas', 'AZ-0001', 'Y', None), 2, ['Real estate', 'Shipping'])
R('beridze', 'Nikoloz Beridze', 'Talented', 'Tbilisi', 'GE-0001', 30, 'tech', (9,14,10,13,20,18), 'Hedonist;Brave;Deceitful', 'Accelerationists', 150_000, 0.0005,
  'Runs warehouses of GPUs on mountain hydropower nobody bills him for, mining coins today and renting compute tomorrow.',
  ('Kazbegi Compute', 'Data centers', 'GE-0001', 'N', 0.8), 1, [])
R('tikhonov', 'Yaroslav Tikhonov', 'Connected', 'St Petersburg', 'RU-0016', 50, 'criminal', (13,17,11,18,5,16), 'Ruthless;Cautious;Greedy', 'Chuds', 10_000_000, 0.04,
  'The Baltic port boss who decides which sanctioned crate goes where, and who gets to ask about it.',
  ('Kronstadt Stevedoring', 'Logistics', 'RU-0016', 'N', None), 2, ['Black market', 'Shipping'])
R('kirillova', 'Svetlana Kirillova', 'Rich', 'Yekaterinburg', 'RU-0046', 47, 'old', (15,18,12,13,12,9), 'Diligent;Brave;Conservative', 'Sovereigntists', 200_000_000, 2.5,
  'Inherited the Urals\' tank and railcar works from her father and is retooling every line for drones.',
  ('Iset Heavy Works', 'Defense', 'RU-0046', 'Y', None), 2, ['Drones', 'Metals'])
R('nurlanov', 'Aidar Nurlanov', 'Talented', 'Bishkek', 'KG-0001', 32, 'criminal', (19,8,13,16,12,17), 'Greedy;Gregarious;Cynic', 'Landites', 700_000, 0.0008,
  'Runs a gold-and-crypto exchange desk that turns sanctioned rubles into anything else, for a 9% fee.',
  ('Ala-Too Exchange', 'Black market', 'KG-0001', 'N', 3.0), 1, [])
R('lvov', 'Boris Lvov', 'Talented', 'Novosibirsk', 'RU-0053', 44, 'tech', (6,13,7,10,23,11), 'Visionary;Shy;Honest', 'Transhumanists', 80_000, 0.0003,
  'A Siberian physicist in a closed science town building cheap AI chips from smuggled designs and stubbornness.',
  ('Ob River Silicon', 'Semiconductors', 'RU-0053', 'N', 0.6), 1, [])
# Middle East and North Africa
R('sulaiti', 'Mariam Al-Sulaiti', 'Rich', 'Doha', 'QA-0001', 40, 'state-linked', (19,12,17,14,9,10), 'Ambitious;Gregarious;Visionary', 'Accelerationists', 400_000_000, 5.0,
  'Pours LNG money into football clubs, newspapers and every AI startup that will take the meeting.',
  ('Pearl Gate Ventures', 'Asset management', 'QA-0001', 'N', None), 2, ['AI labs', 'Data centers'])
R('farahmand', 'Kourosh Farahmand', 'Connected', 'Tehran', 'IR-0001', 56, 'state-linked', (11,18,10,19,10,14), 'Zealot;Ruthless;Paranoid', 'Sovereigntists', 3_000_000, 0.03,
  'A Revolutionary Guard engineer whose ship-to-ship transfers keep sanctioned Iranian crude moving.',
  ('Kish Island Tankers', 'Shipping', 'IR-0001', 'N', None), 2, ['Black market', 'Drones'])
R('elmasry', 'Hisham El-Masry', 'Rich', 'Cairo', 'EG-0001', 66, 'old', (17,15,15,14,4,8), 'Cautious;Gregarious;Greedy', 'Landites', 200_000_000, 2.0,
  'Old cotton money turned cement and canal-zone logistics; the family has outlasted four regimes and plans a fifth.',
  ('Nile Delta Cement', 'Construction', 'EG-0001', 'Y', None), 2, ['Logistics', 'Agriculture'])
R('benjelloun', 'Nadia Benjelloun', 'Connected', 'Casablanca', 'MA-0001', 46, 'old', (17,13,16,12,8,9), 'Diligent;Ambitious;Honest', 'Effective Altruists', 12_000_000, 0.04,
  'A phosphate heiress who wants Morocco to feed the world\'s fertilizer and power Europe\'s solar grid.',
  ('Atlas Phosphates', 'Chemicals', 'MA-0001', 'N', None), 2, ['Renewables', 'Mining'])
R('khoury', 'Rami Khoury', 'Talented', 'Beirut', 'LB-0001', 31, 'tech', (16,9,17,12,19,16), 'Gregarious;Brave;Cynic', 'Liberals', 40_000, 0.0003,
  'Lebanon\'s banks froze his family\'s savings, so he built a dollar app that the whole diaspora now trusts more than any bank.',
  ('Cedar Wallet', 'Banking', 'LB-0001', 'N', 0.9), 1, [])
R('mutawa', 'Faisal Al-Mutawa', 'Rich', 'Kuwait City', 'KW-0001', 64, 'old', (18,16,15,11,4,7), 'Generous;Cautious;Gregarious', 'Landites', 500_000_000, 3.5,
  'Merchant-family patriarch who owns the Gulf\'s malls, car dealerships and fried-chicken franchises.',
  ('Sharq Retail Group', 'Retail', 'KW-0001', 'Y', None), 2, ['Fast food', 'Autos'])
R('jubouri', 'Omar Al-Jubouri', 'Connected', 'Baghdad', 'IQ-0001', 48, 'criminal', (13,16,14,17,4,17), 'Greedy;Brave;Deceitful', 'Chuds', 9_000_000, 0.04,
  'Contractor king of rebuilt Baghdad whose cement trucks carry everything except cement.',
  ('Tigris Rebuild', 'Construction', 'IQ-0001', 'N', None), 2, ['Black market', 'Logistics'])
R('bouaziz', 'Yasmin Bouaziz', 'Talented', 'Abu Dhabi', 'AE-0002', 29, 'tech', (7,10,12,8,23,12), 'Visionary;Honest;Shy', 'Effective Altruists', 300_000, 0.0005,
  'A Tunisian-born researcher hired to build an Arabic frontier model, who has not yet decided whom it will serve.',
  ('Falak AI', 'AI labs', 'AE-0002', 'N', 2.0), 1, [])
# Sub-Saharan Africa
R('kamau', 'Wanjiru Kamau', 'Rich', 'Nairobi', 'KE-0001', 43, 'tech', (18,15,17,12,16,13), 'Ambitious;Visionary;Diligent', 'Liberals', 150_000_000, 1.8,
  'The mobile-money queen whose app moves a third of East Africa\'s money and decides who gets a loan.',
  ('Simba Pay', 'Banking', 'KE-0001', 'Y', None), 2, ['Telecom', 'Insurance'])
R('nwosu', 'Emeka Nwosu-Daniels', 'Rich', 'Lagos', 'NG-0002', 62, 'old', (18,17,15,14,4,9), 'Greedy;Cautious;Ruthless', 'Landites', 300_000_000, 4.0,
  'Cement and sugar money that sells Nigeria its houses and its sweetness at monopoly prices, and Tolu Balogun\'s oldest enemy.',
  ('Lagoon Cement', 'Construction', 'NG-0002', 'Y', None), 2, ['Agriculture', 'Chemicals'])
R('asante', 'Kwame Asante-Boateng', 'Connected', 'Accra', 'GH-0001', 57, 'old', (17,12,15,13,4,11), 'Cautious;Generous;Gregarious', 'Liberals', 20_000_000, 0.025,
  'Third-generation cocoa and gold trader who still clears half of Accra\'s deals on a handshake.',
  ('Ashanti Crown Trading', 'Agriculture', 'GH-0001', 'N', None), 2, ['Mining', 'Banking'])
R('mbala', 'Joaquim Mbala-Vunda', 'Connected', 'Luanda', 'AO-0001', 54, 'state-linked', (14,10,16,17,3,13), 'Greedy;Deceitful;Gregarious', 'Landites', 12_000_000, 0.04,
  'The ruling party\'s oil fixer, who signs offshore blocks to whoever builds him a stadium.',
  ('Kwanza Offshore Services', 'Gas', 'AO-0001', 'N', None), 2, ['Construction', 'Shipping'])
R('tesfaye', 'Abebe Tesfaye', 'Talented', 'Addis Ababa', 'ET-0001', 33, 'tech', (8,17,11,9,20,15), 'Diligent;Compassionate;Brave', 'Effective Altruists', 90_000, 0.0003,
  'Flies blood and vaccines over the highlands with homebuilt drones, and the army has started asking what else they can carry.',
  ('Abyssinia Aerial', 'Drones', 'ET-0001', 'N', 0.7), 1, [])
R('diallo', 'Aminata Diallo', 'Connected', 'Dakar', 'SN-0001', 45, 'tech', (15,16,15,13,16,10), 'Ambitious;Cautious;Diligent', 'Sovereigntists', 6_000_000, 0.03,
  'Owns West Africa\'s biggest cable landing and data center, and sells bandwidth to the French and the Chinese at the same price.',
  ('Teranga Data', 'Data centers', 'SN-0001', 'N', None), 2, ['Telecom', 'Cloud'])
R('lukusa', 'Didier Lukusa', 'Connected', 'Kinshasa', 'CD-0001', 51, 'criminal', (13,11,19,16,3,18), 'Hedonist;Gregarious;Deceitful', 'Chuds', 5_000_000, 0.03,
  '"Papa Didier", the Kinshasa nightlife king who launders Katanga cobalt cash through rumba concerts.',
  ('Matonge Nights', 'Black market', 'CD-0001', 'N', None), 2, ['Real estate', 'Gambling'])
R('moyo', 'Tendai Moyo', 'Talented', 'Harare', 'ZW-0001', 35, 'tech', (16,15,12,11,15,18), 'Ambitious;Brave;Paranoid', 'Sovereigntists', 50_000, 0.0003,
  'A geologist with a lithium claim in a country that pays in bond notes; the Chinese want to buy it and the generals want to take it.',
  ('Great Dyke Lithium', 'Mining', 'ZW-0001', 'N', 0.5), 1, [])
# South Asia
R('malhotra', 'Rohan Malhotra', 'Rich', 'Delhi NCR', 'IN-0002', 39, 'tech', (17,16,18,12,17,14), 'Ambitious;Narcissist;Ruthless', 'Accelerationists', 300_000_000, 4.0,
  'Built India\'s super-app for groceries, gold loans and train tickets, and owns the data of 400 million users.',
  ('Bazaar360', 'E-commerce', 'IN-0002', 'Y', None), 2, ['Ads', 'Banking'])
R('raghunathan', 'Kavya Raghunathan', 'Connected', 'Chennai', 'IN-0033', 41, 'tech', (14,20,13,10,15,11), 'Diligent;Ruthless;Shy', 'Effective Altruists', 9_000_000, 0.04,
  'Runs the outsourcing floors that answer America\'s customer-service calls, and is replacing her own staff with bots.',
  ('Coromandel Contact', 'Professional services', 'IN-0033', 'N', None), 2, ['SaaS', 'Software'])
R('siddiqui', 'Faraz Siddiqui', 'Connected', 'Lahore', 'PK-0009', 50, 'criminal', (16,13,15,17,5,18), 'Greedy;Gregarious;Ruthless', 'Chuds', 8_000_000, 0.04,
  'Textile baron by day and cricket-betting syndicate boss by night; he has fixed matches he never watched.',
  ('Shalimar Sports Exchange', 'Gambling', 'PK-0009', 'N', None), 2, ['Retail', 'Black market'])
R('rahman', 'Salman Rahman-Chowdhury', 'Rich', 'Dhaka', 'BD-0001', 59, 'old', (17,18,13,14,4,10), 'Greedy;Cautious;Conservative', 'Landites', 200_000_000, 2.0,
  'A garment dynasty that sews for the world\'s fashion brands, with a fire-safety record nobody audits.',
  ('Buriganga Apparel Group', 'Retail', 'BD-0001', 'Y', None), 2, ['Telecom', 'Real estate'])
R('iyer', 'Anjali Iyer-Banerjee', 'Talented', 'Kolkata', 'IN-0040', 27, 'tech', (22,7,9,14,19,13), 'Shy;Ambitious;Deceitful', 'Transhumanists', 600_000, 0.0008,
  'A quant whose pirated trading bot skims every Indian exchange, and who is wanted by two regulators.',
  ('Hooghly Quant', 'Asset management', 'IN-0040', 'N', 1.0), 1, [])
R('patil', 'Devendra Patil-Shah', 'Rich', 'Ahmedabad', 'IN-0048', 55, 'state-linked', (17,17,16,15,6,12), 'Ambitious;Gregarious;Deceitful', 'Sovereigntists', 400_000_000, 6.0,
  'Builds every solar park the state tenders, on land his cousins bought the week before.',
  ('Sabarmati Solar', 'Renewables', 'IN-0048', 'Y', None), 2, ['Power utilities', 'Shipping'])
R('perera', 'Nimal Perera-Wickrama', 'Connected', 'Colombo', 'LK-0001', 60, 'state-linked', (15,12,17,16,3,9), 'Cautious;Deceitful;Gregarious', 'Sovereigntists', 6_000_000, 0.03,
  'Port and tea mandarin who runs Sri Lanka\'s debt talks with Beijing and takes a commission both ways.',
  ('Galle Face Port Services', 'Shipping', 'LK-0001', 'N', None), 2, ['Agriculture', 'Construction'])
R('thapa', 'Prakash Thapa', 'Talented', 'Kathmandu', 'NP-0005', 37, 'criminal', (12,15,11,15,14,20), 'Brave;Greedy;Cynic', 'Landites', 400_000, 0.0005,
  'Mines bitcoin on Himalayan hydropower and moves gold over the passes on the same trucks.',
  ('Himalaya Hydro Compute', 'Data centers', 'NP-0005', 'N', 1.0), 1, [])
# East Asia and Oceania
R('tsurumi', 'Ayaka Tsurumi', 'Rich', 'Osaka-Kobe', 'JP-0037', 48, 'old', (16,18,14,10,15,8), 'Compassionate;Diligent;Visionary', 'Transhumanists', 300_000_000, 4.0,
  'Heiress of an Osaka robotics group who wants a robot caretaker in every aging Japanese home, and a camera in every robot.',
  ('Naniwa Robotics', 'Robotics', 'JP-0037', 'Y', None), 2, ['Healthcare services', 'Consumer electronics'])
R('nguyen', 'Nguyen Thanh Long', 'Connected', 'Ho Chi Minh City', 'VN-0001', 52, 'state-linked', (15,14,15,15,6,13), 'Ambitious;Cautious;Deceitful', 'Communists', 7_000_000, 0.04,
  'A party-connected developer whose industrial parks host every factory leaving China.',
  ('Saigon Gateway Industrial Parks', 'Real estate', 'VN-0001', 'N', None), 2, ['Construction', 'Logistics'])
