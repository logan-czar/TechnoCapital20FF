# 8. Quest lines: detailed design

_Status: draft v0.4 (2026-10-17). Batch 35: full lines for Pablo, Tolu and Qiao. Back in work now that the economy, corporations, investing and characters are designed. Batch 33 answers applied: full lines for one character per region next, Pieter reworked for the new economy, generated quests after a line ends, and successors usually start fresh. Builds on [10-events.md](../10-events.md) 10.4 (quest rules), [7-starting-world.md](7-starting-world.md) (characters, alternate history), [1-corporate-core.md](1-corporate-core.md), [3-markets-and-fx.md](3-markets-and-fx.md), [6-technocapital.md](6-technocapital.md), [10-industry-economy.md](10-industry-economy.md) and [11-addiction.md](11-addiction.md). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 8.15.

---

## 8.1 Arcs and quest line rules

A quest line is made of **arcs** (Logan's word; not chapters).

| Rule | Decision (Logan) |
|---|---|
| Structure | The number of arcs, their length and their story structure vary by character. |
| Length | A full line has **4 to 6 arcs**, spanning 2022 to the crash and after (batch 33). |
| Concurrency | Arcs can run at the same time. |
| Outcomes | Each arc ends in one of several outcomes. Each outcome gives a **stat buff** (skills or character resources); better outcomes give better buffs, and bad outcomes can give worse ones or penalties. Outcomes can also change traits (1.1.2). |
| Steps | Inside an arc, the player sees only the next step ([10-events.md](../10-events.md) 10.4). Failure branches into new quests. |
| After the line | When a line ends, **generated side quests** keep coming from events, the character's ambition (1.1.2) and rivals (batch 33). |
| Successors | A successor **usually does not** inherit the quest line (batch 33): they start with their own ambition and generated quests, plus a few legacy quests from the old line. **Sometimes** (25% per unfinished arc **(T)**, higher for children and protégés trained in it) the successor picks up an unfinished arc. |
| The crash | The AI bubble pops in **2030 on average**. The actual year varies by a few years with RNG and events (8.14). Every full line has a crash arc that opens whenever it hits. |

**Outcome tiers (A).** Most arcs use three tiers: **Strong**, **Mixed** and **Poor**. As a guide, Strong gives +2 to one skill and a clout gain, Mixed gives +1 to one skill, Poor gives a lasting penalty or a negative trait **(T)**.

**Full lines written (Logan, batches 33 and 34).** Pieter Von Floop (8.3), Antone Provolone (8.4), Samir Haddad (8.5), Yuna Sakamoto (8.6), John Oligarch (8.7), Viktor Sokolov (8.8), Garrett Kroll (8.9), and from batch 35 Pablo Segundo (8.10), Tolu Balogun (8.11) and Qiao Lin (8.12). Ricky Feng stays on the default line (batch 35). The other characters keep the default line (8.2) until theirs are written.

## 8.2 Default starting quest line (placeholder)

Every starting character without a full line gets this default line: a tutorial-like opening, then **milestones**. Ricky Feng uses it too, but still starts with his compute in Asia and his bot farm SaaS (7.3.1).

### 8.2.1 Opening arcs (tutorial)

| Arc | Teaches | Steps |
|---|---|---|
| **Papers** | Quests, rolls, travel | Clear the flag on your travel profile, properly or through a fixer ([7-starting-world.md](7-starting-world.md) 7.6). Unlocks flights and gives the LLM tip. |
| **Take Stock** | Character screen, resources, strata | Open your Portfolio; check your stratum and what the next one needs; meet one contact. |
| **First Moves** | Hours, actions, money | Make one trade or buy into a real estate pool; hold one meeting; set a monthly budget for your personal account. |
| **Your People** | Opinion, relationships, successors | Make a friend (1.1.4); name a successor in your will (1.11.0). |

The opening arcs run back to back and take the first few months of 2022 **(T)**.

### 8.2.2 Milestones

| # | Milestone | Example ways to hit it |
|---|---|---|
| 1 | **Own something that earns** | Found or buy into a company; rent out a share of a real estate pool; take a board seat |
| 2 | **Climb a stratum** | Meet the bar for the next stratum (2.8.0) |
| 3 | **Be known** | Reach a Fame threshold in one hub |
| 4 | **Hold power** | Control a company, win an office, or lead a bloc |
| 5 | **Ride the boom** | Hold a stake or Techno-Capital in the AI supply chain when the tipped lab's breakthrough lands |
| 6 | **Survive the crash** | Come out of the crash (8.14) in the same stratum or higher |

## 8.3 Pieter Von Floop: "Holding It Together" (reworked for the new economy)

**Who he is.** 24, sole heir to the family's lithography machine empire in Eindhoven, the only maker of EUV machines in the world ([6-technocapital.md](6-technocapital.md) 6.7.0). The monopoly is easy to run and he has been a boy scout his whole life. His father's health is starting to turn. The family trust is swelling, but Pieter worries he will crack holding together what his father built.

**What the line teaches.** Running a massive public company and managing wealth (Logan), now through the new systems: the board and its **management score** (10.5), **sites and growth plans** (10.4), **location perks** (10.4.4), **real estate pools** (10.4.5), earnings and investors, defending control, and surviving the crash.

**Starting position (A).**
- **The company**: Von Floop Lithography, a Megacorp listed in Amsterdam, in the Lithography machines industry, with its main site in Eindhoven and a service branch in Hsinchu-Taipei. The family controls it through a bloc: the family trust holds 22%, a family foundation 8%, and a friendly pension fund 6% **(T)**.
- **Pieter** is Chief Strategy Officer and a board member; his father, Willem Von Floop, is President and CEO and leads the bloc. The board's management score starts at 58 with the CTO seat empty **(T)**.
- **Traits**: Honest, Diligent, Cautious. Stress builds when he acts against Honest.
- **Wealth**: a personal account of $40M and a beneficiary share of a family trust worth about $9B **(T)**.

**How the arcs run.** Arc 1 opens at the start. Arcs 2 and 3 open after Arc 1's second step and run together. Arc 4 runs in the background and moves as Willem's health falls (1.1.9). Arc 5 opens on a trigger. Arc 6 opens when the crash hits.

### Arc 1: The Keys (the board)

| Step | Goal | Teaches |
|---|---|---|
| 1 | Sit in on the quarterly board meeting and vote on the CFO's dividend proposal | Board votes and dividends (1.8.4, 10.5.5) |
| 2 | Fill the empty CTO seat: interview candidates and nominate one. A strong pick lifts the management score | Management score (10.5.1); hidden traits revealed in meetings (1.1.2) |
| 3 | A board member sits on two other boards and is spread thin; persuade them to step down or accept the lower score | Multi-board limits (10.5.1); Persuasion |
| 4 | Win the yearly shareholder meeting: re-elect the board slate | Blocs and elections (1.4, 1.8.1) |

**Outcomes.** Strong: slate elected and management score 65 or higher; +2 Operations. Mixed: slate elected; +1 Operations. Poor: an outsider wins a seat; the board starts at -10 opinion of Pieter.

### Arc 2: The Quarter (running a public company)

| Step | Goal | Teaches |
|---|---|---|
| 1 | Report the first quarter's earnings and set guidance | Fundamental value and news shocks ([3-markets-and-fx.md](3-markets-and-fx.md) 3.3.1, 3.3.6) |
| 2 | Investor day: the CEO's and Chair's Image moves confidence; prepare Willem or stand in for him | Investor confidence and Image (10.5.2) |
| 3 | Decide on a buyback with the cash pile | Buybacks (3.4.4) |
| 4 | Answer a short seller's report that calls the monopoly fragile | Short reports and squeezes (3.5.2, 3.5.3) |
| 5 | A friend offers a tip about a customer's order; refuse it or trade on it | Insider trading (3.10). Trading on it goes against Honest |

**Outcomes.** Strong: the share price beats the sector over the arc and nobody is investigated; +2 Finance. Mixed: +1 Finance. Poor: the short report sticks or an insider investigation opens; -10 Favor.

### Arc 3: The Growth Plan (operating the monopoly)

| Step | Goal | Teaches |
|---|---|---|
| 1 | The boom is coming: write the growth plan. Expand the Eindhoven site, or open a new site in another district | Growth plans and sites (10.4.2) |
| 2 | Eindhoven's industrial pool is nearly full and rents are rising: rent, buy out owners, or develop land | Real estate pools (10.4.5) |
| 3 | Decide which fab customers get the year's machines when orders outrun output | Lithography machines as Techno-Capital (6.7.0, 6.7.3) |
| 4 | October 2022: the export controls land. Decide how to handle Chinese customers' service | Export controls (6.9.1) |
| 5 | Set the R&D plan to fund High-NA | R&D plan (10.5.3), generations (6.4) |

**Outcomes.** Strong: capacity grows ahead of demand and High-NA ships on schedule; +2 Tech and a large clout gain. Mixed: +1 Tech. Poor: a rival lithography project gets funded somewhere (6.6), with Pieter's company blamed.

### Arc 4: Father's Estate (managing wealth)

Runs in the background. Each step opens as Willem's health falls (1.1.9).

| Step | Goal | Teaches |
|---|---|---|
| 1 | Willem asks Pieter to review the family trust's rules with the family's lawyers | Family trust rules (1.10.1) |
| 2 | Set up Pieter's own investments: buy into real estate pools in Eindhoven and Amsterdam and choose how much to rent out | Portfolio, pools and rent (10.4.5) |
| 3 | Decide whether to use havens and shells, as the family's advisers suggest | Shell companies and tax (1.7.4, 10.5.5). Using them goes against Honest |
| 4 | Willem names his successor as CEO; Pieter must win the board's backing | Charters and heads (1.5) |
| 5 | Willem's health reaches 0. Handle the will, the trust and the succession shock | Health and succession (1.1.9, 1.11) |

**Outcomes.** Strong: Pieter becomes President and CEO with the bloc intact; a large clout gain. Mixed: CEO, but the bloc loses a member. Poor: the board appoints an outsider CEO and Pieter stays as a director.

### Arc 5: Hold the Line (defending control)

Opens when someone builds a stake past a disclosure line, or when a rival from the rival rotation is aimed at Pieter.

| Step | Goal | Teaches |
|---|---|---|
| 1 | Find out who is buying | Disclosure thresholds (3.4.8) |
| 2 | The raider poaches the CFO to drop the management score and the share price; replace them | Management score as a target (10.5.2) |
| 3 | Shore up the bloc: persuade holders, call in hooks, or buy shares | Blocs and hooks (1.4, 1.1.4) |
| 4 | Fight the proxy campaign or tender offer, and choose defenses | Proxy fights, tender offers and defenses (1.9) |

**Outcomes.** Strong: the raider is beaten and sells at a loss; +2 Persuasion. Mixed: Pieter keeps control but gives up a board seat. Poor: Pieter loses control of the company.

### Arc 6: The Crack (the crash)

Opens when the crash hits (8.14). Fab customers stop ordering and the order book empties.

| Step | Goal | Teaches |
|---|---|---|
| 1 | Half the capacity sits idle and fixed costs eat the margin: shrink a site or end leases | Operating leverage and shrinking (10.4.1, 10.4.2) |
| 2 | Refinance before the bonds come due | Ratings and default ([3-markets-and-fx.md](3-markets-and-fx.md) 3.6) |
| 3 | Keep stress under control without turning to downers | Stress and addiction (1.1.5, [11-addiction.md](11-addiction.md)) |
| 4 | Buy distressed rivals' sites at the bottom | Buying sites (10.5.4) |

**Outcomes.** Strong: the company survives intact and grows at the bottom; +2 to the skill used most and a large clout gain. Mixed: survives smaller. Poor: Pieter cracks: a breakdown event and a negative trait.

## 8.4 Antone Provolone: "Know a Guy"

**Who he is.** New York. A finance bro by day and a wise guy by night (7.3.1). Connected, not rich: he always knows a guy who knows a guy, and he has worked his way into DC. In this world there was never a 2008 crash, so Wall Street has never been tamed and the banks are bigger than ever (7.2.0).

**What the line teaches.** Contacts as capital: relationships, hooks, favors, the negotiation table, trading, and politics, with a crime side that can make or ruin him.

**Starting position (A).** A trader at a big New York bank, $3M in a personal account, a family on Staten Island with ties to an old crime family, friends in a Senate office. Traits: Gregarious, Greedy, Brave. Ambition: Get rich.

### Arc 1: The Desk

| Step | Goal | Teaches |
|---|---|---|
| 1 | Hit your trading target for the quarter | Trading and order types (3.3.7) |
| 2 | A client wants an introduction to a senator's chief of staff; make it | Relationships and weak hooks (1.1.4) |
| 3 | Your boss offers you a seat on the desk's spin-off fund; negotiate your cut | Funds (3.17) and negotiation |

**Outcomes.** Strong: partner in the fund, +2 Finance. Mixed: +1 Finance. Poor: fired, and the bank spreads the word (-10 Favor in New York).

### Arc 2: The Family Business

| Step | Goal | Teaches |
|---|---|---|
| 1 | Your uncle needs money cleaned through something legitimate; say yes or no | Front companies (1.7.4) |
| 2 | If yes: set up a restaurant group as a front and route the money | Fronts, exposure and shells |
| 3 | A rival crew moves in; settle it with a deal, a hook or muscle | Schemes (1.1.8) |

**Outcomes.** Strong: the front earns clean profit and nobody looks, +2 Intrigue. Mixed: +1 Intrigue. Poor: an investigation opens and the uncle's crew blames Antone.

### Arc 3: Washington

Opens after Arc 1's second step; runs alongside Arc 2.

| Step | Goal | Teaches |
|---|---|---|
| 1 | Host a fundraiser and bundle donations for the senator | Politics and campaign donations ([4-politics.md](4-politics.md)) |
| 2 | Trade a favor for early word on the October 2022 chip export rules | Weak hooks; insider risk (3.10) |
| 3 | Lobby for a bill that helps your fund or your clients | Lobbying |

**Outcomes.** Strong: a strong hook on the senator and +2 Persuasion. Mixed: +1 Persuasion. Poor: the bundling becomes a scandal; -15 Favor.

### Arc 4: The Big Score

| Step | Goal | Teaches |
|---|---|---|
| 1 | Spot the AI boom early (the LLM tip) and build a position in the tipped lab's suppliers | The tip, the GPU chain (6.7.0) |
| 2 | Raise outside money for your own fund | Funds with outside money (3.17) |
| 3 | Bring a hedge fund manager's gambling habit to the table to win a block of shares | Vices at the negotiation table (11.6) |

**Outcomes.** Strong: Antone reaches Glitterati and his fund is a name; +2 Finance and a large clout gain. Mixed: rich but small. Poor: the fund underperforms and investors pull out.

### Arc 5: Collapse (the crash)

| Step | Goal | Teaches |
|---|---|---|
| 1 | Margin calls hit the fund; sell, hedge or double down | Margin and forced selling (3.5) |
| 2 | Old friends and the family come asking for help; choose who you save | Relationships and hooks under pressure |
| 3 | A prosecutor offers a deal if you give up the senator or your uncle | Hooks, loyalty, and trait change (1.1.2) |

**Outcomes.** Strong: Antone walks away richer and owed by everyone. Mixed: poorer but free. Poor: prison, or worse, and a nemesis for life.

## 8.5 Samir Haddad: "Chrome"

**Who he is.** Dubai. A former elite soldier, now in the Permanent Underclass, slaving on a desert megaproject (7.3.2). A stranger recognized his implants and offered better ones, the first free, for a favor. The assassin playthrough: slowly become a cyborg.

**What the line teaches.** Cyberware, humanity and AI psychosis, schemes, hooks, the rival rotation from the inside, and climbing out of the Underclass.

**Starting position (A).** Under $10,000, old military implants (reflex boosters, worn), humanity 85, health 80. Traits: Brave, Paranoid, Ascetic. Ambition: Get rich. The stranger is a fixer for a rival rotation roster.

### Arc 1: The Free One

| Step | Goal | Teaches |
|---|---|---|
| 1 | Accept the first implant (lie-reader optics) and do the stranger's favor: watch a meeting and report | Cyberware (1.1.10); abilities |
| 2 | The favor was to spot a target. Decide whether to go further | Hooks: the fixer now holds a weak hook on Samir |
| 3 | First real job: a one-roll scheme against a mid-level executive | Schemes (1.1.8) |

**Outcomes.** Strong: paid well, the fixer trusts him; +2 Intrigue. Mixed: +1 Intrigue. Poor: discovered; police attention in Dubai.

### Arc 2: Upgrades

| Step | Goal | Teaches |
|---|---|---|
| 1 | Save for a neural implant or take it on credit from the fixer | Money, debt hooks |
| 2 | Humanity falls below 40: the voices start | AI psychosis (1.1.10) |
| 3 | Choose therapy, removal or more chrome | Humanity recovery; cyberware addiction (11.4) |

**Outcomes.** Strong: Samir finds a balance (humanity 50+ with three implants). Mixed: stable but scarred. Poor: cyberpsychosis episode; the AI takes him for a week.

### Arc 3: Out of the Sand

Runs alongside Arc 2.

| Step | Goal | Teaches |
|---|---|---|
| 1 | Get out of the labor camp: rent a flat in Sharjah's residential pool and move | Strata and real estate (2.8.0, 10.4.5) |
| 2 | Start a security company as cover | Founding a company (1.6); Security and PMCs industry |
| 3 | Win a contract guarding a Gulf data center | Contracts and sites |

**Outcomes.** Strong: Samir reaches the PMC stratum with a real company. Mixed: a shell of a company. Poor: back to the camp.

### Arc 4: The Rotation

| Step | Goal | Teaches |
|---|---|---|
| 1 | The fixer aims Samir at a dynasty head; learn their hidden traits and ambition | Hidden traits and investigation (1.1.2) |
| 2 | Turn the job into leverage instead of a kill: dig up dirt and take a strong hook | Strong hooks |
| 3 | Decide: serve the fixer, or break free and become a free agent others hire | The rival rotation (7.4) |

**Outcomes.** Strong: Samir becomes a free agent with his own list of hooks; +2 Intrigue and clout. Mixed: still the fixer's man, but richer. Poor: the fixer becomes his nemesis.

### Arc 5: Blackout (the crash)

| Step | Goal | Teaches |
|---|---|---|
| 1 | The crash cuts every client's budget; the jobs dry up | Industry cycles (10.3) |
| 2 | A desperate dynasty offers everything for one last job | Ambitions and trait change |
| 3 | Take it, or walk away and rebuild | Health, humanity and legacy |

**Outcomes.** Strong: Samir ends as a legend with a dynasty of his own. Mixed: alive and free. Poor: dead or lost to the machine.

## 8.6 Yuna Sakamoto: "Signal"

**Who she is.** Tokyo-Yokohama. A young influencer with a massive following who must pivot her appeal to an incredibly politicized and extremist Japan (7.3.3). Choose a politics and drive Japan and Korea.

**What the line teaches.** Image (Fame and Favor), ideology, media businesses, doomscrolling and the attention economy, elections, and turning fame into power.

**Starting position (A).** $2M personal account, Fame 80, Favor 55, a talent agency contract, a Tokyo apartment. Traits: Gregarious, Narcissist, Ambitious. Ambition: Be famous (already close), which turns into Win office after Arc 2.

### Arc 1: The Pivot

| Step | Goal | Teaches |
|---|---|---|
| 1 | A viral clip drags her into politics; choose an ideology to lean into or stay neutral | Ideology ([5-ideology.md](5-ideology.md)) |
| 2 | Lose part of her audience and win a new one | Fame and Favor by ideology |
| 3 | Break or renegotiate the agency contract | Negotiation; hooks |

**Outcomes.** Strong: Favor 65+ with her new base; +2 Persuasion. Mixed: +1 Persuasion. Poor: a backlash wave; -20 Favor.

### Arc 2: Own the Feed

| Step | Goal | Teaches |
|---|---|---|
| 1 | Found her own media company | Founding (1.6); Media and Social media industries (10.3) |
| 2 | Open a site in Los Angeles or Seoul and grow the audience abroad | Sites and growth plans (10.4) |
| 3 | Her own doomscrolling habit is wrecking her sleep; deal with it | Addiction (11.4) |

**Outcomes.** Strong: a profitable company and a healthy creator; +2 Operations. Mixed: +1 Operations. Poor: Dependent on doomscrolling and the company bleeds cash.

### Arc 3: The Movement

| Step | Goal | Teaches |
|---|---|---|
| 1 | Build a movement around her ideology in Japan | Movements and conviction (5-ideology) |
| 2 | A Korean party courts her; build a cross-border alliance | Influence in other countries |
| 3 | A rival influencer runs a bot campaign against her; answer it or out-scheme it | Psyops and schemes |

**Outcomes.** Strong: her movement wins seats; clout gain. Mixed: a loud minority. Poor: the movement splits and her rival leads half of it.

### Arc 4: Office

| Step | Goal | Teaches |
|---|---|---|
| 1 | Run for the Diet or back a candidate | Elections ([4-politics.md](4-politics.md)) |
| 2 | Fund the campaign: sell part of the media company or take a backer with a hook | Financing and hooks |
| 3 | Win, and choose one law to push | Laws and lobbying |

**Outcomes.** Strong: she holds office and her law passes; +2 Persuasion and a large clout gain. Mixed: elected but powerless. Poor: loses, and her company's value drops.

### Arc 5: Static (the crash)

| Step | Goal | Teaches |
|---|---|---|
| 1 | Ad budgets collapse in the crash; her company shrinks | Industry cycles; shrinking sites |
| 2 | Extremists on all sides blame the crash on someone; choose whether to ride it or calm it | Ideology radicalization |
| 3 | Decide what Japan should do with its stranded data centers | Politics after the crash |

**Outcomes.** Strong: she becomes the voice of the post-crash era. Mixed: she survives in office. Poor: her movement turns on her.

## 8.7 John Oligarch: "Bootstraps"

**Who he is.** Calgary. A 21-year-old oil man with the best stats of any character in the game, bar none (7.3.1). He is in the PMC, one bad month from falling into the Permanent Underclass. Gulf oil is steadier and cheaper in this world (7.2.0), so Alberta's oil sands are squeezed.

**What the line teaches.** Climbing from nothing on stats alone: strata, debt, the industry economy, founding and growing a company, and the oil and energy price indices.

**Starting position (A).** $40,000 in savings and $60,000 of student debt; a rig job; a rented room in Calgary's residential pool. Skills around 18 in Operations and Finance, 15 in Persuasion. Traits: Ambitious, Diligent, Brave. Ambition: Get rich.

### Arc 1: Laid Off

| Step | Goal | Teaches |
|---|---|---|
| 1 | Cheap Gulf oil closes your rig; pay rent before you slip a stratum | Strata (2.8.0); the oil price index (10.6) |
| 2 | Take a loan or sell something to stay afloat | Personal debt and leverage (1.10.3) |
| 3 | A foreman offers a small share in a failing service company | Buying into a company |

**Outcomes.** Strong: John keeps his stratum and owns a stake; +2 Operations. Mixed: +1 Operations. Poor: he falls into the Permanent Underclass and must climb back.

### Arc 2: The Little Company

| Step | Goal | Teaches |
|---|---|---|
| 1 | Become CEO of the service company and fill its board | Board and management score (10.5) |
| 2 | Win a contract from a big oil sands producer | Industries and market share (10.4.1) |
| 3 | Expand the site with leased industrial space | Growth plans and pools (10.4.2, 10.4.5) |

**Outcomes.** Strong: the company turns a profit; +2 Finance. Mixed: +1 Finance. Poor: the producer cancels and the company teeters.

### Arc 3: Power Play

Opens once the AI boom starts.

| Step | Goal | Teaches |
|---|---|---|
| 1 | Data centers need power: open a direct branch in power utilities | Direct branches (10.4.6) |
| 2 | Sign a power deal with a hyperscaler | The GPU chain and power demand (6.7.0) |
| 3 | Raise money: a bank loan priced by your credit rating, or a VC round | Borrowing and founding paths (10.5.5, 1.6) |

**Outcomes.** Strong: a fast-growing power business; clout gain. Mixed: a small branch. Poor: over-borrowed and at the bank's mercy.

### Arc 4: The Climb

| Step | Goal | Teaches |
|---|---|---|
| 1 | Reach the Glitterati: Fame, Image and a seat on another board | Strata, Image, multiple boards |
| 2 | An oil dynasty offers to buy you out or marry into your family | Deals, marriage (1.11.5) |
| 3 | List the company | IPO (3.4) |

**Outcomes.** Strong: John is a Glitterati founder of a listed company. Mixed: rich but sold out. Poor: the IPO flops.

### Arc 5: Dry Hole (the crash)

| Step | Goal | Teaches |
|---|---|---|
| 1 | Data centers stop paying; power demand collapses | Industry cycles, operating leverage |
| 2 | Restructure the debt or let creditors take the company | Restructuring (10.5.4) |
| 3 | Start again or hold on | Ambition and legacy |

**Outcomes.** Strong: John buys his rivals at the bottom. Mixed: he survives smaller. Poor: he loses the company but keeps his stats, and the climb starts again.

## 8.8 Viktor Sokolov: "Long War"

**Who he is.** Moscow. An intelligence officer building a family network inside the state (7.3.2). In this world Russia has been at war in Ukraine since 2005, a drone stalemate under heavy sanctions (7.2.0).

**What the line teaches.** Spycraft, hooks, state capture, sanctions evasion, shells and havens, and the drone war economy.

**Starting position (A).** A colonel's salary, $5M hidden abroad through shells, a wife and two children, a network of officers. Traits: Paranoid, Ruthless, Cautious. Ambition: Protect the family.

### Arc 1: The Network

| Step | Goal | Teaches |
|---|---|---|
| 1 | Recruit an asset in a Western bank | Relationships and hooks (1.1.4) |
| 2 | Dig up dirt on a rival officer | Schemes (1.1.8) |
| 3 | Protect your own secrets from an internal investigation | Hidden traits and defense |

**Outcomes.** Strong: a web of strong hooks; +2 Intrigue. Mixed: +1 Intrigue. Poor: a rival holds a hook on Viktor.

### Arc 2: Drones

| Step | Goal | Teaches |
|---|---|---|
| 1 | The front needs drones: steer a state contract to a company your family controls | Government contracts; Robotics and drones (10.3) |
| 2 | Source chips around the sanctions through a shell in Dubai or Hong Kong | Shells, havens, export controls (1.7.4, 6.9) |
| 3 | Keep the drone company's board loyal | Management score and opinion |

**Outcomes.** Strong: the family drone company is a state champion; clout gain. Mixed: profitable but exposed. Poor: the shell is discovered and Western sanctions name Viktor.

### Arc 3: Money Out

| Step | Goal | Teaches |
|---|---|---|
| 1 | Move family wealth out through shells | Exposure (1.7.4) |
| 2 | Buy into real estate pools in Dubai and London through fronts | Pools and sanctions risk (10.4.5) |
| 3 | Set up the family trust's rules so the children are protected | Trusts and succession (1.10.1, 1.11) |

**Outcomes.** Strong: the money is safe and hidden. Mixed: part of it frozen. Poor: an asset freeze takes most of it.

### Arc 4: Ceasefire or Escalation

| Step | Goal | Teaches |
|---|---|---|
| 1 | A ceasefire is on the table: push for it or sabotage it | Politics and events |
| 2 | Call in hooks to place your people in the ministry | State capture |
| 3 | Decide whether to defect, stay loyal, or take power | Ambition and trait change |

**Outcomes.** Strong: Viktor controls a ministry. Mixed: he keeps his rank. Poor: purged.

### Arc 5: The Reckoning (the crash)

| Step | Goal | Teaches |
|---|---|---|
| 1 | The crash cuts oil and drone budgets | Industry cycles |
| 2 | Allies turn on each other; choose who to sacrifice | Hooks and loyalty |
| 3 | Get the family out, or stay and win | Succession and legacy |

**Outcomes.** Strong: the family rises with Viktor in the state. Mixed: the family is safe abroad. Poor: Viktor falls and the family is scattered.

## 8.9 Garrett Kroll: "Sovereign"

**Who he is.** A crazy automotive billionaire trying to start his own island colony by crashing boats into the side of Antarctica, off the coast of New Zealand (7.3.3). A very hard politics run to protect his sovereign rights (Sovereigntists, [5-ideology.md](5-ideology.md)).

**What the line teaches.** Running a billionaire's empire while chasing a vanity project: an EV company, the cost of a colony, sovereignty and politics, Image, and managing a board that thinks you are mad.

**Starting position (A).** Controlling stake in an EV company listed in the US (Autos and EVs), $6B net worth mostly in its shares, a fleet of three ships at Kroll's colony (7.8). Traits: Visionary, Narcissist, Brave. Ambition: Build a legacy.

### Arc 1: Landfall

| Step | Goal | Teaches |
|---|---|---|
| 1 | Keep the colony fed and powered through the first winter | Spending and logistics |
| 2 | Fund it by pledging EV shares for a margin loan | Margin and leverage (3.5) |
| 3 | The EV board worries about your focus; hold their confidence | Management score, Image and investor confidence |

**Outcomes.** Strong: the colony survives and the board stays calm; +2 Operations. Mixed: +1 Operations. Poor: the share price falls and the margin loan wobbles.

### Arc 2: Recognition

| Step | Goal | Teaches |
|---|---|---|
| 1 | New Zealand and Australia object; lobby them or ignore them | Politics and influence |
| 2 | Find one country to recognize the colony | Diplomacy and hooks |
| 3 | Write the colony's laws | Laws ([4-politics.md](4-politics.md)) |

**Outcomes.** Strong: recognized by one country; Sovereigntists rally to Garrett. Mixed: tolerated. Poor: a naval blockade.

### Arc 3: The Car Company

Runs alongside Arc 2.

| Step | Goal | Teaches |
|---|---|---|
| 1 | Chips are tight in the boom; secure supply for the car plants | The GPU chain and other chips (6.7.0, 10.3) |
| 2 | Open a site in Shenzhen for the location perk | Location perks (10.4.4) |
| 3 | An activist shareholder wants you out as CEO | Proxy fights (1.9) |

**Outcomes.** Strong: Garrett keeps control and sales grow. Mixed: he gives up a board seat. Poor: he is removed as CEO.

### Arc 4: Settlers

| Step | Goal | Teaches |
|---|---|---|
| 1 | Attract settlers: tax-free status, crypto, cyberware clinics | Havens and vice businesses (11.7) |
| 2 | Grow the colony's real estate pools and sell shares in them | Pools (10.4.5) |
| 3 | The colony becomes a hub, or stays a camp | Hub growth (2.17) |

**Outcomes.** Strong: the colony becomes a small hub. Mixed: a few hundred settlers. Poor: settlers leave and the ships rust.

### Arc 5: Iceberg (the crash)

| Step | Goal | Teaches |
|---|---|---|
| 1 | EV shares crash and the margin loan is called | Forced selling (3.5) |
| 2 | Save the car company or the colony | Priorities and legacy |
| 3 | Win sovereignty for good, or hand it over | Sovereigntist endgame |

**Outcomes.** Strong: a sovereign colony and a living company. Mixed: one survives. Poor: both are lost and Garrett becomes a punchline.

## 8.10 Pablo Segundo: "Plata o Plomo"

**Who he is.** A talented kid from the hills of Medellín who learns money on the street (7.3.1). Narco fascism and the rise of Pablo Segundo: he builds a narco-populist movement into national power in Colombia (batch 35).

**What the line teaches.** Front companies and laundering, cash-heavy businesses, buying loyalty with favors and hooks, building a movement from the street up, and using an ideology to win office.

**Starting position (A).** $400,000 in cash, half of it unexplained; a small motorbike courier and money-changing shop in Medellín (Logistics); hooks on two local police officers; Underclass stratum. Traits: Ambitious, Charming, Ruthless. Ambition: Rule the country.

### Arc 1: The Corner

| Step | Goal | Teaches |
|---|---|---|
| 1 | Turn the courier shop into a front that moves a local crew's cash | Front companies (1.7.4) and laundering |
| 2 | A rival crew squeezes your routes; pay them off, outmaneuver them or call a hook on the police | Hooks (1.1.4) and one-roll schemes (1.1.8) |
| 3 | Clean $2M through the shop and a currency exchange without a raid | Laundering risk and the informal economy |

**Outcomes.** Strong: a clean front and a loyal crew; +2 Intrigue. Mixed: +1 Intrigue. Poor: a raid; the shop is seized and a police hook is burned.

### Arc 2: The Patrón

| Step | Goal | Teaches |
|---|---|---|
| 1 | Buy residential real estate in the comunas and rent it cheap | Real estate pools (10.4.5) and influence from assets |
| 2 | Fund clinics, football pitches and a radio show | Image, Favor and buying influence in a place |
| 3 | Hold the top influence tier in Medellín | Influence tiers (2.5.9) |

**Outcomes.** Strong: Medellín's top influence tier and a public following; +2 Persuasion. Mixed: a strong neighborhood base. Poor: the press calls him a narco, and Favor falls with Professionals.

### Arc 3: Legit Money

Runs alongside Arc 2.

| Step | Goal | Teaches |
|---|---|---|
| 1 | Found a real company in a cash-heavy industry (construction, security or nightlife) | Founding paths (1.6) and the industry model (10) |
| 2 | Win a city contract against an honest bidder | Politics and corruption |
| 3 | A US prosecutor opens a file; bury it, flip it or run | Intel, scandals and extradition risk |

**Outcomes.** Strong: a legal company worth $50M and the file closed. Mixed: the company survives but the file stays open. Poor: assets frozen abroad and a secret exposed.

### Arc 4: The Movement

| Step | Goal | Teaches |
|---|---|---|
| 1 | Found a party on order, pride and handouts; pick its ideology (Sovereigntists or Chuds suit it) | Ideology ([5-ideology.md](5-ideology.md)) |
| 2 | Win the Antioquia governorship | Elections ([4-politics.md](4-politics.md)) |
| 3 | Run for president of Colombia: money, influence in every hub and a few buried bodies | National politics, hooks on rivals |

**Outcomes.** Strong: President of Colombia; +2 Persuasion and a large clout gain. Mixed: governor and kingmaker. Poor: banned from running, and the party splits.

### Arc 5: Narco State (the crash)

| Step | Goal | Teaches |
|---|---|---|
| 1 | The crash cuts foreign money; the peso falls and US pressure rises | FX shocks (3) and sanctions |
| 2 | Keep the street loyal: handouts or a crackdown | Favor, stability and unrest |
| 3 | Make Colombia a haven for flight capital, or clean it up for US favor | Havens, laws and the post-crash order |

**Outcomes.** Strong: Pablo holds power and Colombia becomes a regional haven. Mixed: he keeps power but is sanctioned. Poor: a coup or extradition.

## 8.11 Tolu Balogun: "Black Gold"

**Who he is.** The heir to a Lagos oil-trading fortune built on government licenses and favors (7.3.2). Oil money and corruption in a developing country: corruption, oil and third-world development.

**What the line teaches.** Commodity trading and energy price indices, operating where corruption is the cost of business, FX controls and capital flight, and the choice between extracting and developing.

**Starting position (A).** $1.2B family trust, mostly a private oil trading and offshore-block company in Lagos (Oil and gas); a crude-for-fuel swap license from the state oil company; hooks on a minister who is also owed favors by the family; debts to a Swiss bank. Traits: Charming, Greedy, Anxious. Ambition: Build a legacy.

### Arc 1: The License

| Step | Goal | Teaches |
|---|---|---|
| 1 | A new minister wants the swap license renegotiated; pay, trade favors or find leverage | Hooks, favors and corruption |
| 2 | Pirates in the Gulf of Guinea hit a cargo; insure, escort or reroute | Chokepoints and shocks (2.6.0) |
| 3 | Pay down the Swiss loan before the naira slips | FX risk (3) and debt |

**Outcomes.** Strong: the license is secured for 5 years; +2 Persuasion. Mixed: +1 Persuasion and a higher cut to the minister. Poor: the license is lost to a rival family.

### Arc 2: Money Out

| Step | Goal | Teaches |
|---|---|---|
| 1 | Move money out under capital controls through a London or Dubai trust | Personal trusts, havens and tax |
| 2 | Buy London residential real estate for the family | Real estate abroad |
| 3 | A journalist is digging into the offshore accounts | Scandals, intel and Image |

**Outcomes.** Strong: the money is safe and the story dies. Mixed: the money is out but Favor falls at home. Poor: accounts frozen and a corruption probe opens.

### Arc 3: The Refinery

Runs alongside Arc 2.

| Step | Goal | Teaches |
|---|---|---|
| 1 | Nigeria imports its fuel; found a refinery company with state backing | Founding with government connections (1.6) |
| 2 | Raise the money: a Gulf partner, a loan or a Lagos IPO | Raising capital and IPOs (3) |
| 3 | Bring the refinery online despite theft from the pipelines | Operations and site risk |

**Outcomes.** Strong: a working refinery and national praise; +2 Operations. Mixed: it runs at half capacity. Poor: a white elephant and a pile of debt.

### Arc 4: Develop or Extract

| Step | Goal | Teaches |
|---|---|---|
| 1 | Build data centers and grid power in Lagos for the AI boom, or keep selling crude | Techno-Capital (6) and the energy index |
| 2 | Back a candidate for president, or run for governor of Lagos | Elections and influence |
| 3 | Pick a side: Effective Altruist development money or Accelerationist compute money | Ideology and foreign capital |

**Outcomes.** Strong: Lagos becomes a compute and fintech hub with Tolu at its center. Mixed: a rich family in a poor country. Poor: unrest at home and Tolu is blamed.

### Arc 5: Oil Shock (the crash)

| Step | Goal | Teaches |
|---|---|---|
| 1 | The crash cuts oil demand and the naira falls | Commodity and FX crashes |
| 2 | The state wants its cut back; the minister's hook turns on you | Hooks both ways |
| 3 | Save the family business at home or flee with the trust | Legacy and exile |

**Outcomes.** Strong: Tolu buys distressed assets cheap and comes out richer. Mixed: the business shrinks but survives. Poor: exile in London with half the trust.

## 8.12 Qiao Lin: "The Red Line"

**Who she is.** A daughter of a party-state family in Beijing, with a grandfather from the revolution and parents in state companies (7.3.3). The China political run.

**What the line teaches.** State-owned enterprises, the party ladder, factions and purges, capital controls, chip sanctions, and the line between serving the state and getting rich from it.

**Starting position (A).** A deputy director post at a state AI and surveillance company in Beijing; a family trust of $300M held through relatives; hooks on two provincial officials; Nobles stratum. Traits: Patient, Cunning, Loyal. Ambition: Rise to the top of the party.

### Arc 1: The Princeling

| Step | Goal | Teaches |
|---|---|---|
| 1 | Deliver the company's five-year target on surveillance contracts | Running a state company and the management score |
| 2 | A faction rival offers a deal; join, refuse or report | Factions, opinion and hooks |
| 3 | Hide the family's Hong Kong holdings from the inspectors | Trusts held through relatives and secrets |

**Outcomes.** Strong: promoted to director; +2 Intrigue. Mixed: +1 Intrigue. Poor: a warning from discipline inspectors.

### Arc 2: Chips

| Step | Goal | Teaches |
|---|---|---|
| 1 | US controls block advanced chips; find GPUs through Singapore shells or smuggling | Sanctions, shell companies and the GPU chain (6.7.0) |
| 2 | Back a domestic chip push and win lithography know-how by any means | Lithography access, tech transfer and rivalry with Pieter (8.3) |
| 3 | Answer the cheap Chinese open model moment (2025) | Scripted world events (7) |

**Outcomes.** Strong: a working domestic compute supply; +2 Tech. Mixed: enough chips, at high cost. Poor: a shell company is exposed and a US sanction names her.

### Arc 3: The Provinces

Runs alongside Arc 2.

| Step | Goal | Teaches |
|---|---|---|
| 1 | Take a posting as party secretary of a province | Politics and influence away from the capital |
| 2 | Hit growth targets with a real estate push, or clean up the province's debts | Real estate pools and local government debt |
| 3 | A protest over a failed developer; suppress, pay or blame | Unrest, surveillance and Favor |

**Outcomes.** Strong: a model province and a return to Beijing. Mixed: targets met with hidden debt. Poor: a scandal and a demotion.

### Arc 4: The Standing Committee

| Step | Goal | Teaches |
|---|---|---|
| 1 | Build a faction: officials who owe you favors | Hooks and named relationships |
| 2 | A purge campaign: lead it, survive it or become its target | Schemes and intel |
| 3 | Win a seat on the Politburo, and aim for the Standing Committee | National politics |

**Outcomes.** Strong: a Standing Committee seat and a large clout gain. Mixed: Politburo only. Poor: purged; the family trust is investigated.

### Arc 5: Hard Landing (the crash)

| Step | Goal | Teaches |
|---|---|---|
| 1 | The crash hits exports and the property market at once | Real estate cycles and trade |
| 2 | Tighten capital controls or let money out to keep foreign friends | FX policy and capital flight |
| 3 | Use the crisis to take control of the party, or protect the family and step back | Power and legacy |

**Outcomes.** Strong: Qiao leads China out of the crash. Mixed: she keeps her seat and her family keeps its wealth. Poor: a scapegoat, and the family flees to Vancouver.

## 8.13 Generated quests after a line

When a character's line ends, or for characters without a full line after the milestones, **generated side quests** keep coming (batch 33) **(A)**:
- **From the ambition** (1.1.2): a 2 to 4 step quest toward it, rebuilt when the ambition changes.
- **From events**: an event can open a quest (a merger offer, a scandal to bury, an illness in the family).
- **From rivals**: a rival's scheme or a rival rotation character aimed at the player opens a defense quest.
- **Legacy quests**: a successor gets one or two quests from the old line (finish what your father started) unless they inherit an arc outright (8.1).

## 8.14 The crash

The AI bubble pops in 2030 on average (Logan). The year is set at game start as 2030 plus a roll of -2 to +2 years **(T)**, then moved by events: a bigger boom (high AI valuations, heavy leverage) brings it closer, and calmer markets push it later **(A)**. In this world there was never a dot-com crash or a 2008 crisis (7.2.0), so investors have never lived through a great crash, and it hits harder: market drops are ×1.2 the normal crash size **(T)**. When it hits, every quest line with a crash arc opens it.

## 8.15 Assumptions and open items

1. Outcome tiers and buff sizes in 8.1; the 25% chance a successor picks up an unfinished arc.
2. The default line's opening arcs and milestones in 8.2, with "Papers" replacing "The Shot".
3. Pieter's reworked starting position and arcs in 8.3.
4. Starting positions, traits and arcs for Antone, Samir, Yuna, John, Viktor and Garrett in 8.4 to 8.9.
5. Generated quest sources in 8.13.
6. Crash timing and the ×1.2 crash size in 8.14.
7. Starting positions, traits and arcs for Pablo, Tolu and Qiao in 8.10 to 8.12.
