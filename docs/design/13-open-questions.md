# 13. Open questions and assumptions

## Decided by Logan (2026-10-16)

- Lightweight 2D UI with Phaser.
- First build focus: company ownership, corporate feudalism, RPG and CK3-style systems.
- Charters decide company heads; default head is President and CEO with majority voting control or leading the majority bloc.
- Bloc leader is the member with the most shares in the bloc.
- Vassals are held by companies. Types include subsidiary, branch office, shell company, with more to come.
- The board works like the CK3 council.
- The family trust replaces gold and carries the dynasty with set rules across the playthrough; characters can also hold assets in personal trusts and accounts with no restrictions.
- Characters are landless; assets are titles.
- No founder charter: Found Company with founding paths (VC, Ask Daddy, own cash, loan, freestyle, political connections), each with its own event chain.
- Influence is rooted mainly in assets owned in an area, modified by origin and temporarily boosted by psyops or ad campaigns.
- Turn-based, one turn per hour, with some calculations on weekly and monthly intervals.
- The full game includes the map, economy, markets and politics.
- Tone: grounded corporate drama with cyberpunk accents.
- Economy works like Victoria 3, except companies own or lease the buildings they produce in.
- Real estate: buy a plot or a series of plots, then develop it, rent it out, keep it, or use it for a company.
- The game has a private jet and travel system.
- Disclosure lines at 10%, 25% and 50% are the same everywhere; securities law only sets the first filing line (2% to 10%).
- Politics has a Victoria 2 style ideology system with nine cyberpunk ideologies: Liberals, Communists, Accelerationists, Effective Altruists, Transhumanists, Neo-Luddites, Sovereigntists, Landites and Chuds ([detailed/5-ideology.md](detailed/5-ideology.md)).
- Techno-Capital (compute, foundries, lithography machines, drones, automated cars and similar) must be allocated to tasks with Techno-Capital requirements for them to run or finish. The AI, data center and semiconductor supply chain is key, especially in the early game ([detailed/6-technocapital.md](detailed/6-technocapital.md)).
- Techno-Capital is leased, not sold (the machines themselves can be bought and sold). Control levels: Owned (you own it), Leased (pay an agreed amount for an agreed time), Spot (expensive, on demand), Compromised (secretly using someone else's TC while they use it or it is idle).
- Starting world (Logan, 2026-10-16): the game starts in **January 2021**. The player picks from premade dynasties only (no custom dynasty), with **eleven playable dynasties**: New York (finance and DC insiders), Los Angeles (culture, a nepo-baby family in the arts), San Francisco (pure tech and the ideological battle over AI), Medellín (narco fascism and the rise of Pablo Segundo), Lagos (oil and corruption), Sydney (mining and property), Beijing (state-linked), Shenzhen (electronics and tech), Bengaluru (IT money), Paris (luxury goods old money) and Moscow (cybercrime money). Each dynasty has one fixed starting character the player plays. Pablo Segundo is a rising outsider the Medellín family must back or fight. The world holds 30 or more rival dynasties, all fully original archetypes rather than parodies of real families, mixing old money, new tech money, state-linked families and criminal money. Each dynasty has an **Origin city** and a **Center of Power**; members can live anywhere. New dynasties rise from AI founders during play and dead ones drop out. A dynasty's **Center of Power** is the hub where it holds the most influence, so it moves as the dynasty grows; influence here means money, power and prestige: assets are the base, and power and prestige modify it. Every game starts at Stage 1, The Heir. Full design: [detailed/7-starting-world.md](detailed/7-starting-world.md).
- Opening quest (Logan, 2026-10-16): the first quest is getting the COVID vaccine or a doctor's note excusing you. It introduces the **quest system**. Getting the vaccine is easy; avoiding it is harder, by an amount that depends on the character and on rolls through the quest tree. Finishing the quest unlocks travel and other parts of the game, and delivers a tip naming which company will make the first LLM breakthrough and explaining how the AI system will work before the AI boom.
- Timeline 2021 to 2030 (Logan, 2026-10-16): the pandemic is mostly over in January 2021. History follows the real AI boom, with more and more fantastical things happening as the years pass. In 2030 a crisis hits and the AI bubble pops; the game continues into a post-crash era with new rules. Real events happen on schedule by default and players can change them.
- The LLM tip from the opening quest is always correct, and the tipped lab is different each game.
- Quests are tracked goal trees with branches and rolls; events are single pop-ups that can start a quest.
- Until the opening quest is finished the player can go anywhere, but only by car or train (no flights).
- Succession (Logan, 2026-10-17): no CK3-style heirs. The player plays one character. The family trust and personal trusts can be left to other characters, and changed during life within each trust's rules (details later). On death an eligible successor takes over: children, spouse, business partners, mentees, or people the player owes a large favor or money. The player continues as that character with their share of the trusts and Techno-Capital.
- Values written "at start" in the detailed files were set for a present-day start. They are rebased to January 2021 in detailed/7-starting-world.md; later states (for example chip export controls and sanctions on Russia) arrive through the 2021 to 2030 timeline instead.

## Assumptions to confirm

1. **Geography**: the real modern world (real countries and cities) with fictional companies, characters and brands.
2. **Charter types**: Standard, Dual Leadership, Board-Governed and State-Linked are enough for now.
3. **Influence thresholds**: 10%, 25% and 50% share of a place's weighted assets.
4. **Player scope**: the player directly controls the dynasty head's actions, personal accounts and the family trust; other family members act on their own.
5. **Starting scenario**: decided (see above): every game starts as the Heir.
6. **Wars**: countries go to war as background events; players never command armies, only PMCs on a small scale.

## Open questions

- How many countries and hubs ship in the first playable map?
- Should multiplayer (rival dynasties played by people) ever be a goal?
- How much of the black market (front companies, data trading) is in scope for the first full release?
