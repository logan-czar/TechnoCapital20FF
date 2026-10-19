# Detailed design 1: Corporate core (companies, characters, trusts)

_Status: v1.1 (2026-10-19). Batch 124 card (Logan): whole world dollarized at start, so money is in US dollars and the policy rate is the Federal Monetary Board's world base rate (1.10.2, 1.13). Batch 121: only national governments; the Political Connections path (1.6.7) needs a city or region tier but meets a national minister (no mayors or governors). Consistency pass, batch 74: no daily hours budget, opinion as tags and pushes, no cyberware, founding and young-company rules folded in from the retired stage files. Batch 118: EU4-style map; home hub becomes home province (its city, a Metro or city province, where it has one), origin and healthcare checks use cities and countries. Batch 116: no family, dynasty or succession (death of the player character ends the game), Clout and Fame/Favor replace prestige and reputation, no branch offices, startup dashboard folded into business units, mechanical fixes A1, A3, A4, A10, A15, A22, A23. Batch 117: no Cooperative or Captive Bank vassals, no Ask Daddy founding path, no stress for now (1.1.5), Heat redefined as how cancelled a character is (1.1.0), no optional end date. Batch 120: Political Connections needs Power broker at the level's threshold (25% in a city, 15% in a region)._

This file is the source of truth for companies, characters and trusts; it replaces the old overview stubs 01 to 04 in the design folder. All numbers are **tuning values**: starting points to balance, not final.

Money is in US dollars, written as $. At start every country uses the dollar (Logan, batch 124); once a country launches its own currency, amounts there convert at the live exchange rate ([3-markets-and-fx.md](3-markets-and-fx.md) 3.8.1). "Month" means the monthly calculation (hourly ticks roll up into weekly and monthly calculations, see [4-politics.md](4-politics.md) 4.1.3).

## 1.1 Characters

### 1.1.0 Named characters (Logan, 2026-10-17)

The game has **named characters** of two kinds:

| Kind | What they are |
|---|---|
| **Table characters** | Fill out rosters: board seats, executives, staff. They exist in the simulation to do something in a company. |
| **Full characters** | Live in and interact with the game world. They can run a company, work a regular job, help out operations, run for political office, and so on. |

- **Number of full characters** is set at game start, **200 by default**.
- Full characters are spread across backgrounds, strata and locations. They include the 14 rival starting characters (7-starting-world 7.3.4), some of the rivals created in the **rival rotation**, and extra characters generated at random from templates with high variance.
- **Character resources**: assets, income, Clout and vril. Together with Image (Fame and Favor) they shape the character's **stratum** ([2-map-and-influence.md](2-map-and-influence.md) 2.8.0).

| Resource | What it is (Logan) |
|---|---|
| **Assets** | What the character owns: stakes, real estate, cash, Techno-Capital |
| **Income** | What the character earns |
| **Clout** | **Reputation among the elite** (Logan, batch 116): how board members, executives, politicians, financiers and other Clout holders rate the character. It only matters to other elites. It grows mainly from achievements (the old achievement ticker) and absorbs the old Prestige, Renown and Elite Standing, so elite-facing scandals and failures can lower it **(A)** |
| **Vril** | **A mystical luck stat that can swing rolls; rare and hard to raise** (Logan, batch 60). An esoteric X factor that works like luck. It does not follow the regular game rules: it sometimes punishes the player and other times helps them. Characters gain it by doing vril-worthy acts or through events, but the game never says clearly how; you just get it sometimes. Its value is hidden, unless the character has the perk trait **Vril Touch**, which shows it next to their resources (John Techno gets it in the opening, batch 83). It runs up to **99**, the highest bonus possible (Logan, batch 81; 9-gambling) |
| **Image** | The character's PR, made of two factors: **Fame** (how many people know you) and **Favor** (how much people like you). Logan's word was influence; it is called Image here because **influence** keeps its map meaning, power in a place from assets held there (2.5) (Logan). The existing reputation score becomes Favor **(A)**. **Fame and Favor are how the public sees you; Clout is how the elite sees you.** These are the only two prestige-like measures (Logan, batch 116): there is no separate Prestige, Renown, Elite Standing, Profile, Favorability or generic reputation. **Heat** is a separate measure of how cancelled a character is (below) |

- **Table characters can become full characters** (Logan), for example by promotion, winning office or becoming famous. Details later.
- **Rival rotation** (Logan): a roster of characters added to every game with preset AI. They can be directed at the player or at other characters to mess with them, both by the game's director AI and by characters who hire or point them, the player included ([detailed/7-starting-world.md](7-starting-world.md) 7.4).

**Heat (Logan, batch 117).** Heat (0 to 100) is how **cancelled** a character is. Every scandal about the character adds Heat, and each scandal's share wears off over time at the rate set by its **scandal type**: a gaffe fades in weeks, while fraud or a crime lingers for years (types, amounts and decay rates in [4-politics.md](4-politics.md) 4.17.4) **(T)**. A company that is itself the subject of a scandal carries its own Heat by the same rules **(A)**. High Heat hurts the character's **Favor**, makes elites wary in **Clout** dealings, costs **board votes**, closes doors in **politics** and draws hostile **media coverage** (effects in 4.17.4). Heat is not legal or police attention; that is **exposure** (4-politics 4.9.3).

### 1.1.1 Skills

**Six skills** (Logan, batch 60 added **Hustle**), each 0 to 30 (confirmed by Logan, 2026-10-17): **Finance, Operations, Persuasion, Intrigue, Tech and Hustle**. A typical adult averages 6 to 8; 15+ is excellent; 25+ is legendary.

| Skill | What it covers |
|---|---|
| Finance | Money, markets, deals on paper, guidance, fund management |
| Operations | Running business units, productivity, logistics, crises |
| Persuasion | Talking people round: meetings, pitches, campaigns, investor confidence |
| Intrigue | Secrets, hooks, schemes, shells and counter-intelligence |
| Tech | Software, compute, R&D and Techno-Capital |
| **Hustle** | **Drive and grind** (Logan named it; the scope here is an assumption **(A)**): getting things done fast and on little, side deals, street sales and the grey and black market |

**What Hustle does (A).**
- **Speed**: every action and project the character runs (founding, growth plan purchases, software features, schemes) takes `1 - (Hustle - 10) × 1%` of its normal time, from ×1.10 at 0 to ×0.80 at 30 **(T)**.
- **Long hours**: ticking actions (1.1.6) take 10% less time at Hustle 15+ and 20% less at 25+ **(T)**.
- **Founding**: Hustle is the roll for the Bootstrap and Freestyle founding paths (1.6.4, 1.6.6) and for early sales at a new company.
- **Side deals and the street**: it rolls for Black market deals (10.3), gambling hustles (9) and quick flips of assets and real estate.
- Trait links: Diligent +2 Hustle, Lazy -2, Ambitious +1 (already +1 to all) **(T)**. Education traits (1.1.3): Street-Taught and Bootcamp Coder give +1 Hustle per level.

**Skill sources** (Logan, batch 60): base (rolled 0 to 8 when the character is generated) + **education trait** (+2 to +8 in a focus skill, 1.1.3) + traits + **experience from the jobs held** (+1 per 5 years in a matching role, max +6: a CFO gains Finance, a COO Operations) + **events** + **age**.

**Age curve (Logan, batch 60).** Skills **peak around 45 to 55 and then fade slowly** **(T for the numbers)**: from 56 every skill loses 1 point every 5 years, Tech and Hustle every 3 years; Persuasion and Intrigue fade at half speed. Life extension (1.1.9) slows the fade.

### 1.1.2 Personality traits

Every adult has 3 (confirmed by Logan, 2026-10-17) from **12 pairs**, CK3 style (batch 60). Events can add more, so a character has **3 to 5** in all (Logan, batch 60). Traits drive AI choices (Logan, 2026-10-17: grown from 7 with cyberpunk flavor). Each modifies skills and opinion pushes (1.1.4); the "Goes against it" column says what counts as acting against the trait for drift (below).

| Trait | Opposite | Skill effect | Goes against it | Opinion push |
|---|---|---|---|---|
| Ambitious | Content | +1 all skills | Passed over, kept in a junior role | -10 to their liege |
| Greedy | Generous | +2 Finance | Giving money away | +10 from Greedy |
| Paranoid | Trusting | +3 Intrigue (defense) | Trusting others with power | -5 to everyone |
| Ruthless | Compassionate | +2 Intrigue | (Compassionate) firing staff, layoffs | -5 from Compassionate |
| Visionary | Conservative | +2 Tech | (Conservative) risky ventures | +10 from Visionary |
| Honest | Deceitful | -2 Intrigue, +10 Favor | Lying, shells, bribery | +10 from Honest |
| Brave | Cautious | +1 Persuasion | (Cautious) leverage, hostile takeovers | none |
| Diligent | Lazy | +1 Operations, +2 management score skill (10.5.1) | (Lazy) long hours, crises | +5 from Diligent |
| Hedonist | Ascetic | -1 Operations, +1 Persuasion; addiction gain ×1.5 ([11-addiction.md](11-addiction.md)) | (Ascetic) parties, luxury spending | +10 from Hedonist at galas |
| Zealot | Cynic | +2 Persuasion with characters of the same ideology ([5-ideology.md](5-ideology.md)) | Acting against their ideology | -10 from other ideologies |
| Narcissist | Humble | +2 Persuasion in public, -2 in private; Fame gain ×1.5 | Being upstaged, losing Image | -5 from everyone; +10 from flatterers |
| Gregarious | Shy | +2 Persuasion; meetings take half the ticks | (Shy) public events, galas, campaigns | +5 from Gregarious |

Same trait between two characters: a +10 push each way. Opposite trait: a -10 push.

#### Unique traits and perks (Logan, batches 78 and 84)

A few traits sit outside the 12 pairs. They have no opposite, count toward the 3 to 5, and can sit alone: John Techno starts with only one.
- **Unique traits** belong to one character from the start.
- **Perks** are traits that **unlock an ability**, earned through events and quest arcs (Logan, batch 84: perks are traits, not a separate system).

| Trait | Kind | Holder | Effect |
|---|---|---|---|
| **Operational Excellence** | Unique | John Techno ([8-quest-lines.md](8-quest-lines.md) 8.3) | While he sits on a company's board as **COO, CEO or Chair** (Logan, batch 79), the **buffs of all other board members are doubled**: their seat task effects (1.8.2) and their trait and skill bonuses to that company (batch 79) |
| **Vril Touch** | Perk | John Techno, from the opening (8.2.4) | The character **can see their vril value**, shown next to their resources (1.1) |

#### Trait change (Logan, 2026-10-17)

Traits can change over a life, slowly **(T)**:
- **Events**: some event options give or remove a trait (a betrayal can make a Trusting character Paranoid).
- **Trauma**: each health event costing 30 or more (1.1.9) has a 25% chance to flip one trait to its opposite.
- **Arc outcomes**: quest arc outcomes can grant or swap traits ([8-quest-lines.md](8-quest-lines.md) 8.1).
- **Drift**: a character who acts against a trait 5 times in a year gets an event offering to drop it.
- At most one natural trait change per year, so personalities stay recognizable.

#### Hidden traits (Logan, 2026-10-17)

Another character's traits are **hidden** until the player learns them:
- Meeting in person reveals one trait per meeting **(T)**.
- Investigating (a Spymaster task, 1.1.8.2, or a hired PI) reveals all traits, and for the player's character the ambition.
- Famous characters (Fame 60+) have their public trait known to everyone; Narcissists' trait is always visible.
Unknown traits show as "?" on the character screen; opinion pushes from them still apply.

#### Traits drive AI characters (Logan, 2026-10-17)

Traits **strongly** steer AI characters. Each trait adds weights to what an AI character wants and which options it picks **(T)**:

| Trait | Leans toward |
|---|---|
| Ambitious | Taking control of companies, seeking higher seats and strata |
| Greedy | High pay, low dividends from companies it runs, asset stripping |
| Paranoid | Counter-intelligence, poison pills, keeping cash |
| Ruthless | Hostile takeovers, layoffs, blackmail |
| Visionary | Tech industries, AI bets, high R&D plans |
| Honest | Refusing schemes, shells and insider trades |
| Brave | Leverage, big bets, proxy fights |
| Diligent | Taking seat tasks, staying on boards |
| Hedonist | Spending, gambling (9), parties |
| Zealot | Funding its ideology's movement, lobbying |
| Narcissist | Media, buying fame, vanity projects |
| Gregarious | Alliances, galas |

**Traits alone drive AI characters** (Logan, batch 61): there is no separate play style or character archetype on top of traits. The AI company archetypes (2.23.1) and political archetypes (4-politics 4.27.3) are only **labels worked out from the controlling character's traits**, not extra settings.

#### Ambitions (Logan, 2026-10-17)

> **Player only (Logan, batch 61).** Only the player's character has an ambition. AI characters have none; they act from their traits (above), ideology and situation. The table below is the player's list.

The player's character has **one ambition** at a time, picked by the player from this list or suggested from their traits, stratum and situation **(A)**:

| Ambition | Goal | Typical holder |
|---|---|---|
| Get rich | Reach the next stratum (2.8.0) | Ambitious, Greedy |
| Take a company | Become head of a named company | Ambitious, Ruthless |
| Win office | Win a seat in government ([4-politics.md](4-politics.md)) | Zealot, Narcissist |
| Revenge | Ruin a named character who wronged them | Ruthless, Paranoid; after betrayal |
| Build a legacy | Found a company or fund a cause | Visionary, Content |
| Be famous | Reach Fame 75 | Narcissist, Gregarious |
| Transcend | Reach Transhumanist goals: life extension and other human enhancement (1.1.9) | Visionary, Hedonist; Transhumanists |

- Achieving it gives Clout, and a new ambition is picked.
- Meeting it also gives vril (1.1.0).

### 1.1.3 Education traits

Education traits are **background traits set when a character is generated** (level 1 to 4, by a roll). There is no childhood, focus or school choice (batch 116: no children or education mechanics) **(A)**.

| Education | Focus skill | Bonus per level | Unlock |
|---|---|---|---|
| Ivy League MBA | Finance | +2 | Better VC pitch odds |
| Quant PhD | Finance | +2, +1 Tech | Trading bonuses |
| Bootcamp Coder | Tech | +2 | Tech-industry founding bonus |
| Law School | Intrigue | +1, +1 Persuasion | General Counsel task bonus |
| Old Money Tutors | Persuasion | +2 | +10 push from old-money characters |
| Military Contractor | Operations | +2 | Defense industry contacts |
| Party School | Persuasion | +2 | Political appointments |
| Street-Taught | Intrigue | +2 | Fixer contacts |

### 1.1.4 Opinion

**Opinion is a tag, not a number** (Logan, batch 62). Each character holds one of three attitudes toward each other character: **Friend**, **Neutral** or **Rival**. Special bonds (Nemesis, Lover, Mentor and Protégé) sit on top of the attitude (below).

- **Changing the tag (A).** Events and actions give **pushes**. A push of 30 or more (positive or negative) moves the tag one step at once (Rival → Neutral → Friend, or back); smaller pushes of the same direction add up over a year and move it when they reach 30, then reset **(T)**. Relatives (flavor characters, such as John Techno's two moms) start the tag at Friend **(A)**; Nemesis always means Rival.
- **Formulas that use opinion** (bloc acceptance 1.4, loyalty 1.7.3, tender thresholds 1.9.3, votes in politics and the rest) read the tag as a number: **Friend +50, Neutral 0, Rival -50, Nemesis -100** **(T)**. Any rule written as "opinion above X" means the tag that clears it.
- The UI shows the tag and the bond, never a number.

Standard pushes **(T)**:

| Source | Push |
|---|---|
| Relative (flavor only) | Starts at Friend |
| Same origin city (Metro or province) | +5 |
| Shared trait | +10 each |
| Opposite trait | -10 each |
| Lover | +30 |
| Gift | +1 per 1% of their yearly income, max +20 |
| Fired / demoted | -30 |
| Promoted / board seat | +20 |
| Scheme discovered against them | -50 |

#### Relationships (Logan, 2026-10-17; batch 62)

**Special bonds** (Logan, batch 62) unlock their own actions: a mentor teaches a skill, a nemesis plots against you, a lover opens affair events. Friend and Rival are the attitude tags above, so a character can hold any number of each. Each relationship sets or pushes the tag, unlocks its own events, and changes what the two can ask of each other **(A)**:

| Relationship | How it forms **(T)** | Tag | Events and effects |
|---|---|---|---|
| **Friend** | Pushes that reach Friend, or a Befriend scheme | Friend | Favors at a discount; warns you of schemes they hear about; grief event on death |
| **Rival** | Competing for the same seat, deal or ambition; pushes that reach Rival | Rival | Rivalry events (public spats, poaching); +2 to skills used against them |
| **Nemesis** | A rival who ruins you, or a discovered scheme that cost 30+ health or a company | Rival (reads -100) | Revenge ambition (1.1.2); they will scheme against you until one of you falls |
| **Lover** | Seduce scheme, or Friends who are attracted to each other | +30 push | Affair events; a secret affair is a strong hook (below) |
| **Mentor** / **Protégé** | A character 15+ years older with a skill of 15+ takes on a younger one | +20 push each | Protégé gains +1 a year in the mentor's best skill (max +5) |

A character can hold only 1 nemesis at once **(T)**.

#### Hooks (Logan, 2026-10-17)

A **hook** is leverage over a character, as in Crusader Kings. **Both kinds stay** (Logan, batch 62).

| Hook | Source **(T)** | Use | Lasts |
|---|---|---|---|
| **Weak** | A favor done for them, a debt they owe you (money lent, a bailout), a campaign donation | Called in once: they vote your way, accept a deal, give a board seat or skip a scheme against you. Used up after one call | Until used, or 5 years |
| **Strong** | A secret (affair, crime, shell, insider trade, hidden addiction) or blackmail material | Called in once a year without being used up; they cannot refuse unless they accept the secret coming out | Until the secret is exposed or destroyed |

Hooks come from Dig up dirt and Blackmail schemes (1.1.8), favors, loans and events. A character with a strong hook on them may try to destroy the evidence (a scheme against the holder).

### 1.1.5 Stress

Removed (Logan, batch 117): no stress for now.

### 1.1.6 Time and actions

There is **no daily hours budget** (Logan, batch 64). **Most actions take no time** and resolve at once (a phone call, a trade, a board decision, starting a scheme). **Only certain actions burn ticks** (hours): while one runs, the character is **busy** and cannot start another ticking action, but instant actions still work **(A for which actions tick)**.

| Ticking action **(A)** | Ticks |
|---|---|
| Meeting in person (one character) | 2 |
| Pitch meeting | 3 |
| Board meeting | 4 |
| Gala / networking event | 5 |
| Domestic travel | 4 (halved by a private jet) |
| International travel | 12 (halved by a private jet) |
| Vacation (restores 3 health **(T)**, 1.1.9) | 72 |
| Opening a scheme (1.1.8.1) | 4 or 8 |

- **Location matters** (Logan, batch 64): some actions need the character in the city (meeting a minister, a gala, an in-person pitch), so travel is the main thing that burns time.
- **Delegation** (Logan, batch 64): any action can be handed to a board member, executive or fixer. **The AI then takes it over and rolls for it as if that person did it**, with their skills, traits and location, and their time if it ticks. The player sees the result.
- Tick costs written elsewhere in this file (for example "Prepare deck (8 ticks)") follow this table.

### 1.1.7 Life cycle

- **No childhood or births** (batch 116). Named characters are generated as adults; relatives exist only as flavor characters.
- **No death rolls** (Logan, 2026-10-17). Characters have a **health** stat, and health only goes down through events. A character dies when health reaches 0 (1.1.9). The player character's death ends the game (1.11).
- Life extension: see 1.1.9.

### 1.1.8 Schemes

Schemes are CK3 style, with Intrigue rolls over weeks (Logan, batch 63).

#### 1.1.8.1 How a scheme runs (Logan, batch 63)

- The schemer starts a scheme against a target and pays its cost and its opening ticks (4 for social schemes, 8 for Intrigue ones) **(T)**.
- The scheme then **runs for weeks**: 2 to 12 weeks by type **(T)**. Each week it gains progress from the schemer's skill (Intrigue for most, Persuasion for social ones), and rolls **discovery** once a week at a tenth of the old discovery chance.
- **Agents (A).** The schemer can bring in agents: friends, people they hold hooks over, or the target's own staff bought off. Each agent adds progress, and an agent close to the target (a board member, a lover, a bodyguard) adds the most. Each agent is also a new way to be discovered.
- When progress is full, the **success roll** resolves as below. A failed roll can be retried by starting over.
- Only one scheme per schemer against the same target at a time.

The two rolls **(T)**:

- **Success** = 50% + (schemer's skill - target's defense) × 3%, clamped 5% to 95%. Defense is the target's own skill, or their Head of Security's Intrigue if higher.
- **Discovery** = 10% + target's defense × 1% - schemer's Intrigue × 1%, clamped 2% to 60%, rolled whether the scheme succeeds or fails. A discovered scheme can make a nemesis, and serious ones (blackmail, accidents) open a police or regulator investigation.
- **Getting caught (Logan, batch 63).** A discovered scheme makes the target a **Rival** (1.1.4), or a **Nemesis** if the scheme was serious (blackmail, an "accident", a scheme that cost them a company or 30+ health). The target gets a **hook** on the schemer (the scheme itself is the secret), and it **can become a scandal**: a public leak (Image and Favor hit, 1.1.0) if the target or the press chooses to run it.
- Opening ticks: 4 for social schemes, 8 for Intrigue and Tech schemes **(T)**.

| Scheme | Skill | Cost | Effect on success |
|---|---|---|---|
| Befriend | Persuasion | none | Friend relationship |
| Seduce | Persuasion | none | Lover; hook if a secret affair |
| Recruit to bloc | Persuasion | optional payment | Target joins your bloc |
| Dig up dirt | Intrigue | $50k | Hook on target (if a secret exists) |
| Investigate | Intrigue | $100k | Learn one secret about the target (1.1.8.2): a hidden trait, a hidden owner, a real controller (1.3.1) **(T)** |
| Destroy evidence | Intrigue | $100k | Destroys a strong hook another character holds over you (1.1.4) **(T)** |
| Leak scandal | Intrigue | $100k | Target loses 20 Favor and gains Heat by scandal type (1.1.0), stock drops 3 to 8% |
| Corporate espionage | Intrigue | $500k | Steal data, a deal or plans (no tech levels) |
| Poach executive | Persuasion | signing bonus | Executive joins your company |
| Investigate shell | Intrigue | $200k | Reveal hidden owners |
| Blackmail | Intrigue | needs hook | Force an action (vote, sale, resignation) |
| Arrange "accident" | Intrigue | $2M | Target loses 30 to 100 health (1.1.9; death only at 0); huge penalty if discovered |

Hacking is its own system, not a scheme: [17-hacking.md](17-hacking.md).

#### 1.1.8.2 Intel and the Spymaster (Logan, batch 63)

**Intel is per secret** (Logan): a character **either knows a secret or does not**. There are no intel levels.
- **Secrets** are discrete facts kept in the engine: a hidden trait (1.1.2), an affair, a crime, an addiction, a hidden owner behind a shell, a figurehead and the **real controller** behind them (1.3.1), a planned takeover, insider trades.
- A secret is learned through a **Dig up dirt** or **Investigate** scheme, an informant (an agent placed near the target), an event, or being told by someone who knows it. Each success reveals **one secret** **(A)**.
- A known secret stays known. It can be **traded, leaked or turned into a hook**; if it is exposed, everyone knows it.
- Schemes and the Spymaster give human intel; hacking ([17-hacking.md](17-hacking.md)) is the other source.

**The Spymaster (Logan).** A character's intel and defense against schemes are run by a **Spymaster**: the **Head of Security** board seat for a company (1.8.2), or a **personal fixer** the character hires for themselves **(A)**.
- The Spymaster's **Intrigue** is the defense against schemes on everyone they protect (1.1.8), and adds weekly progress to the employer's own Dig up dirt and Investigate schemes.
- Each week the Spymaster has a 1 in 10 chance to **uncover a scheme** running against the people they protect, rising to 1 in 4 with Intrigue 20+ **(T)**.
- A disloyal Spymaster is the worst leak: they can sell secrets to rivals (a Rival or a hook over them makes this likely).

### 1.1.9 Health (Logan, 2026-10-17)

Every character has **health** from 0 to 100. There are no yearly death rolls: health falls only through **health events**, and a character dies when it reaches 0.

**Starting health (T).** 90 at 18, minus 1 per year over 40, plus or minus health traits (Athletic +10, Chronic Illness -20, Frail -15) **(A)**.

**Health events.** Each event costs health; the event card says how much and why.

| Source | When it fires **(T)** | Health cost **(T)** |
|---|---|---|
| **Aging** | Yearly check from 50: chance 10% at 50, 30% at 65, 60% at 75, 90% at 85 | 5 to 20 |
| **Illness** | 3% a year, ×2 in a pandemic or in a country with poor healthcare | 5 to 40; serious illness opens a treatment chain |
| **Addiction** | Monthly while addicted ([11-addiction.md](11-addiction.md)), by substance or habit | 1 to 5 |
| **Violence** | Assassination attempts, accidents, travel risk (2.21.8) | 10 to 100 |

**Effects of low health (T).**

| Health | Effect |
|---|---|
| 75 to 100 | None |
| 50 to 74 | -1 to all skills |
| 25 to 49 | -3 to all skills; ticking actions take 25% longer (1.1.6) |
| 1 to 24 | Bedridden: -6 to all skills, ticking actions take twice as long, can only act through delegates; rivals start positioning |
| 0 | Death. For the player character, game over; for an AI character, a silent hand-over to a game-made heir (1.11) |

**Recovery and life extension (T).**
- Rest and normal care restore 1 health a month while no health event fired that month, up to the age cap (100 minus 1 per year over 40).
- **Private medicine** ($200,000 a year) doubles recovery and halves illness costs.
- **Life extension** ($5M a year) raises the age cap by 15, halves aging chances, and grows with tech (cloned organs, gene therapy). It is a status symbol: Glitterati and above gain Clout from it.

## 1.2 Holders and stakes

A **holder** is any of: character (personal account), personal trust, company, fund, government.

A **stake**: holder, company, share class, number of shares, acquisition date (for bloc tie-breaks).

Share classes:

| Class | Votes per share | Dividend | Notes |
|---|---|---|---|
| A | 10 | normal | Usually founders; converts to B when sold to an outsider unless the charter says otherwise |
| B | 1 | normal | Standard common stock |
| N | 0 | normal | Non-voting economic shares |
| P | 0 | paid first, 6% to 8% fixed | VC preferred; converts to B on IPO or sale |

## 1.3 Control

**Voting power** of a holder in a company = votes from its own stakes + votes from stakes held by companies it controls (its vassals' stakes count for it).

**Control rule** (standard charter):
1. Group holders into blocs (holders not in a bloc are a bloc of one).
2. Each bloc's votes = sum of its members' voting power.
3. If one bloc has more than 50% of all votes, its leader controls the company and is (or appoints) the President and CEO.
4. If no bloc has more than 50%, the company is **contested**: the board elects the CEO by majority. Contested companies suffer -10% productivity and are open to proxy fights.

Control is recalculated whenever a stake changes or a bloc changes (immediately), and checked weekly.

### 1.3.1 Two layers of control: on the books and for real (Logan, batch 56)

> Control works on **two layers**. The shares work like Wall Street Raider; **who actually calls the shots** comes from the corporate feudalism system.

| Layer | Who it is | How it is decided | Who can see it |
|---|---|---|---|
| **On the books** (owner of record) | The holder that controls the company **by its shares**: the largest voting stake or the majority bloc (1.3) | Wall Street Raider style: buying shares on the market, block trades, tender offers (1.9.3), buybacks and dilution | Everyone: filings (3.4.8), the stock screen and the press |
| **Real controller** | The **character who actually calls the shots** | Corporate feudalism: the vassal chain (1.7), bloc leadership (1.4), the charter (1.5), the board (1.8), hooks, favors and loyalty (1.1.4) | Only people with intel on the company or the people behind it |

**How they come apart (A).** The real controller follows the chain of control upward from the owner of record:
1. **Through companies, trusts and shells.** If the owner of record is a company, the real controller is the head of whatever sits at the top of its vassal chain. If it is a trust, it is the trustee. If it is a shell (1.7.4), it is whoever controls the shell, and outsiders see only "Undisclosed holder".
2. **Through people.** If the owner of record is a character who is under a **strong hook** (1.1.4), or who is a loyal member of someone else's bloc, that other character is the real controller. The owner of record is then a **figurehead**: they vote and sign as told.
3. **Breaking the chain.** A figurehead follows orders while their loyalty or the hook holds. When loyalty falls to Defiant (1.7.3), or the hook is destroyed or exposed, they start to decide for themselves, and the real controller has to win them back or retake control on the books.

**Takeovers on two layers.**
- Winning a tender offer or buying a majority gives **control on the books** at once: the new owner of record can call a vote, replace directors and appoint the head under the charter.
- **No contested period** (Logan, batch 57): the takeover carries no productivity penalty. Directors and executives loyal to the old real controller keep their seats until they are replaced (a staggered board can make that take 2 years), and until then they can still leak, scheme or start a proxy fight, by their loyalty **(A)**.
- The reverse also works: a character can **gain real control without the shares** by holding hooks over the owner of record, or leading the bloc, and no filing shows it.

**Figureheads (Logan, batch 57).** A player or AI can **deliberately put a figurehead on the books** to hide who is in charge: a relative, a loyal executive, a friendly holder or someone they hold a hook over. The stake is held in the figurehead's name (or their trust or company), and the real controller gives the orders. **AI rivals do this too**, as well as using shells, so the player has to investigate rivals to see who is behind them.

**Seeing real control (Logan, batch 57).**
- **The owner of record is always visible** to everyone.
- **The real controller needs intel.** Usually it is easy to tell: when the chain runs only through public links (companies, trusts, open blocs), the real controller is shown at once **(A)**.
- **Sometimes a shadowy figure lurks.** When the chain passes through a shell, a hook or a figurehead, the company screen shows "Real controller: unknown" until the player's intel reaches it, through an Investigate action (1.1.8, like Investigate Shell), an informant on the board, or an event.

**Exposure (Logan, batch 57).** A hidden controller is **legal**. **Governments and regulators never get involved**, and it is not a disclosure breach. But if **the press or certain people** (a rival, a director, a disgruntled figurehead) find out, the real controller **can lose control of the board** **(A for the numbers)**:
- An **Exposed** event fires for the company. Every director gets a -20 push toward the real controller, or -40 if the director was in the dark **(T)**.
- Each director then rolls to defect: the chance is 50% minus their loyalty, or their tag toward the real controller read as a number (1.1.4), ÷ 2 **(T)**. Defectors vote with the owner of record or with a rival bloc from then on.
- The figurehead may **flip**: it gets a free check to break the chain (step 3 above), at +20% if the exposure embarrassed them **(T)**.
- If the defectors and the figurehead together give someone else a board majority, the real controller loses control of the board. They can try to win it back through favors, hooks or a proxy fight (1.9.2).
- Whoever learns the secret first holds it as a **hook** (1.1.4) and can trade it, use it or leak it to the press.

## 1.4 Blocs

- Any holder can **propose a bloc** to another holder of the same company. Acceptance chance = 30%, +25% if the target is a Friend of the proposer, -25% if a Rival (a Nemesis always refuses), + payment bonus **(T)**.
- **Leader** = member with the most shares (counting all classes) in the bloc. Tie: earliest acquisition date.
- Members follow the leader's vote unless they are at Rival toward the leader; then each vote they have a 50% chance to vote independently.
- Members check weekly: a member at Rival (or Nemesis) toward the leader has a 25% chance to leave.
- A bloc dissolves if only one member remains.

## 1.5 Charters

| Charter | Head rule | Board size | Change threshold |
|---|---|---|---|
| Standard | Majority bloc leader is or appoints President and CEO | 5 to 9 | 2/3 votes |
| Dual Leadership | Majority bloc leader appoints Executive Chair; board elects CEO | 7 to 11 | 2/3 votes |
| Board-Governed | Board elects CEO by majority | 7 to 13 | 3/4 votes |
| State-Linked | As Standard, but the government's golden share can veto CEO choice, sales of control, and charter changes | 7 to 11 | 2/3 votes plus government consent |

Charter clauses (optional add-ons, set at founding or by charter change):
- **Staggered board**: only 1/3 of seats elected per year.
- **Poison pill**: if any outsider crosses 20%, all other holders may buy shares at 50% discount.
- **Class A conversion lock**: A shares stay A when sold.
- **Right of first refusal**: existing holders may match any sale.

## 1.6 Founding a company


### 1.6.1 Found Company action

Inputs: name, industry (one of 42, [10-industry-economy.md](10-industry-economy.md) 10.3), home province (the HQ, [2-map-and-influence.md](2-map-and-influence.md) 2.3.1), target capital, founding path. Starting the action is instant; the path's meetings tick (1.1.6). The company is created only when the chain completes successfully.

**A new company is an ordinary corporation** ([10-industry-economy.md](10-industry-economy.md) 10.0) holding **one small business unit** in the chosen industry (Logan, batch 116). The unit's business assets equal the capital raised less founding costs, and its expenses are set so it runs at a small loss for 6 to 18 months **(T)**. Company value comes from the normal fair value rule (10.0.8).

### 1.6.2 Path: Venture Capital

Chain per round:
1. **Prepare deck** (8 ticks). Deck quality = (Persuasion + Tech + Finance) / 3 + education bonus + random 0 to 10.
2. **Pitch meetings**: the player picks up to 5 VC firms from a list (each a fund with a partner character, an industry preference and a risk appetite). Each pitch is a 3-tick pitch meeting. Interest chance = 20% + deck quality x 2% + industry match 15%, +25% if the partner is a Friend, -25% if a Rival **(T)**.
3. **Term sheet** event from each interested firm: amount, valuation, board seat, preference multiple (1x to 2x), and a **milestone** (revenue target by a date).
4. **Negotiate** (optional, instant): a Persuasion roll can raise valuation 10% to 30%, or anger the partner (a -20 push, may withdraw).
5. **Close**: shares issued as class P; VC partner joins the board if the term sheet says so.

| Round | Raise | Dilution | Board | Milestone window |
|---|---|---|---|---|
| Pre-seed | $250k to $1M | 5 to 10% | none | 12 months |
| Seed | $1M to $5M | 10 to 20% | observer | 18 months |
| Series A | $5M to $20M | 15 to 25% | 1 seat | 18 months |
| Series B | $20M to $80M | 10 to 20% | +1 seat | 24 months |
| Series C+ | $80M+ | 10 to 15% | +1 seat | 24 months, IPO pressure |

Missed milestone: choose between a **down round** (raise at a lower valuation, -20 founder Clout), **bridge loan** from the VC (debt plus more board seats), or the VCs form a **faction** to replace the CEO.

### 1.6.3 Path: Ask Daddy

Removed (Logan, batch 117). The founding paths are Venture Capital, Bootstrap (own cash), Bank Loan, Freestyle and Political Connections.

### 1.6.4 Path: Bootstrap

Uses your personal cash, minimum $50k. Chain: **First hire** (choose between a cheap generalist or an expensive specialist), **First customer** (Persuasion roll), **First crisis** (cash crunch, choose: cut your salary, sell personal assets, or take a small loan). You keep 100% class A shares.

### 1.6.5 Path: Bank Loan

1. **Application** (instant): loan size up to 70% of collateral value, or up to 3x your yearly income without collateral if Clout is 50 or more **(T)**.
2. **Collateral review**: pledged assets are locked.
3. **Covenants**: the bank sets 1 or 2 rules (minimum cash, maximum debt, no dividends for 2 years). Breaking one makes the loan due in 30 days.
4. **Approval** chance = 40% + Finance x 2% + Clout / 2.

Interest = policy rate + 3% to 8% (by risk). Monthly payments over 5 to 10 years. Default: bank seizes the collateral.

### 1.6.6 Path: Freestyle

The player assembles a funding plan from sources, each with its own short chain: own cash, a bank loan, angels (1 meeting each, $25k to $500k, small B stakes), crowdfunding (30-day campaign, rolled on Persuasion plus Fame, many tiny holders who never form blocs), a partner company (that company takes a stake and may become a liege if over 50%).

### 1.6.7 Path: Political Connections

Requires influence at **Power broker** tier in the home province's city (25%; a Metro or a city province) if it has one, otherwise its region (15%) ([2-map-and-influence.md](2-map-and-influence.md) 2.5.9) **(T)**. Cities and regions have no government of their own (batch 121): the tier is what wins a hearing from the national ministry.

1. **Meeting the Minister** (a 2-tick meeting with the national minister whose portfolio covers the business).
2. **Grant application**: grant of $1M to $50M, or a state bank loan at the policy rate, or a sovereign fund stake.
3. **Public scrutiny**: an opposition or journalist event; Intrigue or Persuasion roll to keep it quiet, or take a Favor hit.
4. **Contract award**: a 3 to 5 year government contract as first customer.

Effects: charter becomes State-Linked or the government takes 1 board seat; you owe 2 political favors (the official holds hooks).

### 1.6.8 Founded by a company

A company can found a vassal directly (Found Subsidiary action, CEO's time). It pays the capital from its own cash and holds 100% A shares. The parent's head appoints the new CEO.

### 1.6.9 Running a young company

**No startup dashboard** (Logan, batch 116). There are no product points, Hype, churn or customer counts. A young company is an ordinary corporation with one small business unit (1.6.1), read through the normal company screen and financials: cash, monthly loss, the unit's business assets, growth and productivity (10.0). **The startup phase plays out as event chains** (1.12) whose outcomes are dollar effects on the unit (business assets, growth plan, productivity, expenses) or on investor confidence, plus Clout and Fame for the founder **(A)**. All numbers here are **(T)**.

**Other ways in.** Besides founding (1.6.1 to 1.6.8), a character can buy a small loss-making Venture or Company (taking on its team, debts and standing), or found again after an earlier company was sold or failed, keeping Clout and contacts.

**The startup chain (A).** Founding opens a chain that runs for 6 to 18 months: Demo Day, First Big Customer, The Clone, Payroll Friday, Viral Moment, Regulator Letter and, at the end, Product-Market Fit (1.12). Phase names vary by industry (a mine's demo is a survey, its first customer an offtake deal). The chain ends in **fit** when the unit's revenue has grown three quarters running, giving a growth boost and investor confidence, or in **failure** (below). A **pivot** event moves the unit to another industry, keeping 50% of its business assets, at a -10 investor push.

**Team.** Generic staff are part of the unit's expenses; key hires (CTO, Head of Sales, COO, first board members) are characters who can be poached, scheme and sit on the board. Hire chance = 30% + 1% per 1% of salary above market + equity offered, +15% if the hire is a Friend of the founder. A funding round may require an option pool (5% to 15%) that dilutes the founders first; key hires ask 0.5% to 5%, vesting over 4 years with a 1-year cliff, and leavers keep vested shares as small holders. Crunch, layoffs and missed payroll fire staff events that can lower the unit's productivity and make key hires start looking.

**Co-founders.** The equity split is set at founding; an equal split keeps both happy but gives neither a majority alone. Co-founder tension rises with disagreements their traits care about and falls with success and shared credit. At high tension a breakup chain offers a buyout, a board vote to push them out, or splitting the company.

**More money.** Bridge note (converts at a 20% discount at the next round); revenue-based financing (over $50k monthly revenue, repaying 5% to 10% of revenue until 1.5x); strategic investor (once the unit has revenue, 10% to 30% for a board seat and right of first refusal on a sale); government grant (influence in the home jurisdiction; scrutiny, golden share); personal loan or mortgage. Valuation in a round follows fair value (10.0.8), moved by investor confidence.

**Protecting control.** Keep class A shares (1.2; VC interest -15%), bring friendly holders into the bloc (1.4), negotiate protective provisions out of term sheets (Persuasion), prefer founder-friendly VC partners (a firm attribute; they rarely join factions) and buy back shares from leaving staff and angels. The company screen shows how far each faction is from 50%.

**Rivals.** AI rival companies in the same industry and city (or region, outside cities) compete for staff and VC money. Once the unit's revenue passes a threshold, an incumbent picks a response: ignore, copy (the unit's growth halves for 6 months), acquire (an offer, only on the director's order, 13.3) or crush (lawsuits, a price war, lobbying).

**Grey-market growth.** Bought user data (+30% unit growth for a year), bot armies (investor confidence up, lost and more if revealed) and gig-worker labor (unit expenses -30%, unrest and union events) each add **exposure**, which uses the shell investigation rule (1.7.4). Attacking a rival's systems goes through hacking ([17-hacking.md](17-hacking.md)).

**Exits and failure.** Once the unit has revenue an acquirer can make an offer: the founder takes the cash or stays on as a vassal CEO under the buyer. Failure: **bankruptcy** (payroll missed twice or a debt default: liquidation, personal guarantees called, Clout -30), **acquihire** (cash for under 3 months and an offer: the team joins the buyer, investors get little), **ousted** (a faction wins a proxy fight: the founder keeps their shares, Clout -10) or **fire sale** (low price, Clout -10, no bankruptcy record). Failure is not game over: the character and their personal accounts and trusts carry on.

## 1.7 Vassals

### 1.7.1 Vassal contract

| Term | Range | Effect |
|---|---|---|
| Tribute (dividend payout) | 0% to 90% of profit | Higher: more cash up, -1 loyalty per 5% above 30% |
| Management fee | 0% to 5% of revenue | Cash up regardless of profit, -2 loyalty per 1% |
| Parent board seats | 0 to majority | More control, -5 loyalty per seat above 2 |
| Veto rights | yes / no | Parent can block vassal acquisitions and debt; -10 loyalty |
| Non-compete | yes / no | Vassal cannot enter parent's industries; -5 loyalty |

Changing the contract: costs the parent head 2 ticks, and the vassal CEO gets a push of the loyalty delta x 2.

### 1.7.2 Autonomy levels

| Level | Tribute cap | Growth | Loyalty | Parent control |
|---|---|---|---|---|
| Wholly Integrated | none | -10% | -20 | Full: parent sets budget |
| Managed | 70% | 0% | -10 | Parent approves big decisions |
| Arm's Length | 50% | +5% | 0 | Parent votes as holder only |
| Independent Listing | 30% | +10% | +10 | Public company, parent is majority holder |

### 1.7.3 Loyalty formula (weekly)

Loyalty target = vassal CEO's tag toward the parent head read as a number (1.1.4) / 2 + autonomy modifier + contract modifiers + vassal performance (+10 if growing, -10 if shrinking).
Current loyalty moves 5 points per week toward the target.

| Loyalty | Behavior |
|---|---|
| 50+ | Loyal: follows parent, +5% productivity |
| 0 to 49 | Neutral |
| -1 to -49 | Restless: may join factions, leaks |
| -50 or less | Defiant: actively seeks independence, spin-off or a rival buyer |

### 1.7.4 Vassal type rules

**No branch offices** (Logan, batch 116). Business units spread across cities freely; where a country restricts foreign companies, its foreign ownership law (C1, [4-politics.md](4-politics.md) 4.5) sets the limit instead.

| Type | Special rules |
|---|---|
| Subsidiary | Default. Can hold its own vassals (max depth 4). **Logan, batch 53:** a separate corporation that **must follow its parent's directives**. It keeps **separate books**, its own business units and its own board, which makes its own decisions but **can be overridden by the parent**. On the parent's balance sheet it counts as **an asset** (its stake), not as consolidated units ([10-industry-economy.md](10-industry-economy.md) 10.0.8). |
| Shell Company | **Logan, batch 53:** basically an empty company for moving money around. **No business units**, but it can hold **software, compute and stored data** ([14-software.md](14-software.md), [15-infrastructure.md](15-infrastructure.md)), as well as stakes and cash. Registered in a haven jurisdiction. Holds stakes and cash anonymously; rivals see "Undisclosed holder" unless they run Investigate Shell. Income routed through it taxed at the haven rate (0% to 5%). Builds **exposure** +1 per month per shell plus +1 per $1M routed per month (both × the haven's F5 multiplier, [4-politics.md](4-politics.md) 4.9.3); investigation chance per month = exposure / 10 %. |
| Joint Venture | Two parents, control by contract (for example 50/50 or 60/40). Deadlock event if the parents' heads are Rivals. |
| Front Company | Legit income plus a hidden illegal operation (smuggling, black market deals). Hidden income x2, raid chance 1% per month plus investigations. |
| Franchise | Pays 4% to 8% royalties; parent has no board seats; brand scandal spreads both ways. |
| Holding Company | Exists only to own stakes in other companies; no facilities. Consolidates the group's holdings under one board, so one bloc controls everything below it. Dividends from below pass up untaxed inside the same country **(T)**. Added 2026-10-17 (Logan). |

### 1.7.5 Company ranks

| Rank | Value threshold | Direct vassal limit | Over-limit penalty |
|---|---|---|---|
| Venture | < $10M | 1 | -10 loyalty in all vassals per extra |
| Company | $10M to $250M | 3 | as above |
| Corporation | $250M to $5B | 6 | as above |
| Megacorp | $5B to $100B | 10 | as above |
| Conglomerate | > $100B | 15 | as above |

## 1.8 The board (council)

**Management score (Logan, 2026-10-17).** The characters in a company's board positions set its **management score** (0 to 100), which drives its productivity and investor confidence. Positions include a **CTO** (Tech). Full rules: [10-industry-economy.md](10-industry-economy.md) 10.5.

### 1.8.1 Seats and elections

- Board size per charter (see 1.5). Seats elected at the yearly shareholder meeting (or 1/3 per year with a staggered board).
- Election: each bloc nominates candidates; seats go by votes (cumulative voting off by default). The majority bloc normally wins all seats it contests; minority blocs need 1 / (board size + 1) of votes per seat to guarantee one.
- VC term sheets and State-Linked charters reserve seats outside elections.

### 1.8.2 Seat tasks

Each seat holder picks one task. Effect scales with the relevant skill.

| Seat | Task | Effect (per skill point) |
|---|---|---|
| Chair | Manage shareholders | +0.5 push per month toward the head among holders |
| Chair | Prepare for vote | +1% votes in the next proxy fight |
| CFO | Optimize capital | +0.3% company profit |
| CFO | Restructure debt | -0.05% interest rate |
| CFO | Prepare acquisition | Reveals targets; -0.5% takeover cost |
| COO | Grow operations | +0.2% monthly growth |
| COO | Integrate vassal | +1 loyalty per month in a chosen vassal |
| COO | Cut costs | +0.5% profit; counts as acting against the trait for Compassionate COOs (drift, 1.1.2) |
| General Counsel | Takeover defense | +2% to defense rolls |
| General Counsel | Fabricate claim | Progress toward a casus belli |
| Head of Security | Counter-intelligence | +1% discovery chance on schemes against the company |
| Head of Security | Protect executives | -2% success of hostile schemes on executives |
| Chief Strategy Officer | Expand | Progress toward a new business unit or a unit's spread into a new city |
| Chief Strategy Officer | Government relations | +0.2 political influence per month in the home jurisdiction |
| Independent Director | Lend Clout | +0.2 management score (investor confidence, [10-industry-economy.md](10-industry-economy.md) 10.5) |

### 1.8.3 Board opinion

Each member's tag toward the head affects work: a **Rival** halves their task effect and may leak (10% a month) or join a faction; a **Nemesis** does the same and leaks at 30% a month **(T)**.

### 1.8.4 Board meetings (quarterly)

A board meeting is an event with an agenda of 1 to 4 items (dividend, budget, acquisition, CEO pay, member complaints). Each item is a majority vote of seats. The head can make Persuasion checks to swing members.

## 1.9 Factions, proxy fights and takeovers

### 1.9.1 Factions

A faction forms in a company when holders with a shared demand reach 10% of votes. Strength = faction votes / votes of the controlling bloc.

| Strength | Effect |
|---|---|
| < 50% | Grumbling: events only |
| 50% to 99% | Can issue an ultimatum |
| 100%+ | Ultimatum is automatic |

Ultimatum: accept the demand, or a proxy fight is scheduled in 30 days.

### 1.9.2 Proxy fights

1. Scheduled vote date (14 to 30 days).
2. Swing holders: every holder not in either side's bloc. Each has a lean from -100 (side A) to +100 (side B), starting from the difference between their tags toward the two leaders (read as numbers, 1.1.4).
3. Each day, both sides can spend **campaign actions**: a meeting with a holder (2 ticks, shifts lean by Persuasion x 2), a public letter (shifts all leans by 5), a payment (shifts lean by 1 per 0.1% of holder's position value), or a scheme.
4. On vote day, holders with lean below 0 vote A, above 0 vote B. Winner fills the contested seats and, under a standard charter, the head.

### 1.9.3 Tender offers

- The bidder announces a price, usually market price + 20% to 50% premium, for a target percentage.
- Each holder accepts if: offer premium > their loyalty threshold. Threshold = 10% + their tag toward the current head read as a number (1.1.4) / 4 + bloc membership 15%.
- Lasts 20 days. The target can respond with defenses.
- A foreign investment review (4-politics C1) can be triggered.
- **Control on the books, not real control** (1.3.1): a winning tender gives book control at once; real control comes later, through the feudal layer.
- **When the target ends up fully owned** (Logan, batch 56), the player (or the AI bidder, which bids only on the director's order, 13.3) **chooses each time**: **merge it in** (its units join the buyer's, its debt becomes the buyer's and its board is dissolved), or **keep it as a subsidiary** (1.7) with its own books and board.

### 1.9.4 Defenses

**Each defense is a board vote** (Logan, batch 56) at the target, unless the charter already holds it. A board the raider already controls will not vote for one.

| Defense | Cost | Effect |
|---|---|---|
| Poison pill (if in charter) | none | Bidder's stake diluted by 30% to 50% if they cross 20% |
| White knight | Find a friendly buyer | Friendly bid competes |
| Crown jewel sale | Sell the most valuable vassal | Company less attractive |
| Staggered board | Charter clause | Bidder needs 2 years to take the board |
| Buyback | Cash | Raises price, shrinks float |
| Litigation | $1M+ | Delays offer by 10 to 30 days |
| Golden parachute (Logan, batch 56) | Board vote; payouts of 1 to 3 years of pay **(T)** | If control changes, the head and executives are paid out, making the takeover cost more and the executives harder to win over |

### 1.9.5 Casus belli effects

Hostile action without a casus belli: -30 Clout and an investigation chance of 20%. With one: -5 Clout.

## 1.10 Trusts and accounts

### 1.10.1 Personal trusts

**No family trust** (Logan, batch 116). A character's money sits in their **own personal accounts and personal trusts**. Each personal trust is a holder (1.2) set up and changed freely by its owner **(A)**:

| Rule | Options **(A)** |
|---|---|
| Trustee | The owner, or a hired trustee character (who becomes the real controller's figurehead, 1.3.1) |
| Jurisdiction | Any country; income kept inside is taxed at its rate (1.10.6) |
| Protected assets | Up to 3 named assets the trustee cannot sell without the owner's say |
| Spending limit | Max % of trust value a hired trustee can move per year without the owner (default 25%) |

### 1.10.2 Accounts and yields

| Account | Yield (yearly) | Liquidity | Risk |
|---|---|---|---|
| Cash | 0% | Instant | None |
| Savings / money market | Policy rate - 0.5% | 1 day | None |
| Government bonds | Policy rate + 0.5% to 4% by rating | 1 day to sell | Default by rating |
| Corporate bonds | Policy rate + 1.5% to 6% by rating | 1 day | Default by rating |
| High-yield / private credit | Policy rate + 6% to 12% | 30 days | 3% to 10% yearly loss chance |
| Real estate | 3% to 7% rent + 0% to 5% appreciation | 30 to 90 days | Market cycles, local events |
| Speculative | -50% to +200% | 1 day | High volatility |

The policy rate is the Federal Monetary Board's world base rate (1.75% at start **(T)**), since every country uses the dollar at start (batch 124). A loan in a re-currencied country's currency uses that country's central bank rate ([3-markets-and-fx.md](3-markets-and-fx.md) 3.9).

### 1.10.3 Leverage

- **Margin loan**: borrow against a portfolio. Interest = policy rate + 2%. Margin levels by asset, and the margin call deadline (the next daily settlement), are set in [3-markets-and-fx.md](3-markets-and-fx.md) 3.5.4: if equity falls below maintenance, add cash or the broker sells stakes (largest liquid first).
- **Mortgage**: borrow up to 70% of a property's value; interest = policy rate + 1.5%.
- **Personal guarantee**: back a company loan; if the company defaults, the guarantor pays.

### 1.10.4 Monthly cash flow (personal account or trust)

Income: dividends + rent + interest + salaries.
Expenses: lifestyle (by trait: Ascetic 0.5x, Hedonist 2x; base $20k a month), staff, loan interest, taxes, scheme costs.

### 1.10.5 Personal wealth tiers (standing)

| Tier | Total controlled value (personal accounts and trusts) |
|---|---|
| Investor | < $10M |
| Magnate | $10M to $500M |
| Mogul | $500M to $10B |
| Tycoon | $10B to $100B |
| Oligarch | > $100B |

### 1.10.6 Personal money (Logan, batch 59)

| Topic | Decision |
|---|---|
| Spending | **Monthly personal spending can raise some resources** (Clout, Fame and vril from 1.1, plus health). Spending is a monthly budget, not a list of bought objects. |
| Income | **Salary and bonus** from board and executive seats, **dividends**, **payouts from their own trusts** and **gambling** winnings (9). |
| Tax | **Income and capital gains tax by home country**, lowered by trusts and havens. |
| Debt | **Personal loans and pledging shares** (3.5.5). A default costs Clout and can force sales. |
| Rich list | **A public world rich list** that drives Clout, Fame and rival attention. **Hidden wealth is not counted.** |

**Spending budgets (A).** Each character sets a monthly amount for each line. A line raises its resource with diminishing returns: the gain is `points at the reference spend × (spend ÷ reference)^0.5`, capped at twice the reference gain **(T)**. The reference spend scales with the wealth index of the home country.

| Line | Examples | Raises | Reference spend and gain **(T)** |
|---|---|---|---|
| **Status** | Homes, yachts, jets, art, parties | **Fame** (the public sees it) | $200k a month for +2 Fame a month |
| **Social** | Clubs, galas, gifts, hosting | **Clout**, and pushes toward the people invited | $100k a month for +2 Clout a month |
| **Wellness** | Doctors, retreats, life extension (1.1.9) | **Health** | $50k a month for +1 health a month |
| **Vices** | Gambling, drugs and the rest (11) | Each vice's benefit, plus addiction risk | As in 11 |
| **Spiritual and esoteric** | Gurus, rituals, retreats | **Vril** | $50k a month for +1 vril a month |

- Traits still scale the bill: Ascetic ×0.5 and Hedonist ×2 (1.10.4). An Ascetic gets the wellness gain at half price but only half the status gain.
- **Upkeep**: anything owned for status (a jet, a yacht, an estate) is part of the status line, and it **keeps some resale value** (about 50% of what was spent on the physical object) if the budget is cut and the object is sold **(T)**. Private jets also unlock travel (2.21).
- Cutting a line lets its resource drift back: Fame from the status line fades 1 point a month after 3 months without it **(T)**.

**Income (A).** Salary: CEO $1M to $20M a year by company rank (1.7.5), other executives and board members 10% to 50% of that. Bonus: 0 to 200% of salary, voted by the board on results. Trust payouts are whatever the owner takes out of their own trusts (1.10.1).

**Personal tax (A).** Income tax 20% to 50% and capital gains tax 0% to 30% by home country (4-politics E2) **(T)**. Income kept inside a trust is taxed at the trust's jurisdiction rate. Moving money to a haven through a shell (1.7.4) lowers tax but builds exposure.

**Personal debt (A).** A personal loan is up to 2 years of income at the base rate plus 4%. A share pledge loan is up to 40% of the shares' value (3.5.5). A missed payment fires a default event: Clout -15, and the lender can force the sale of pledged shares, which can change control (1.3).

**The rich list (A).** Updated every quarter after earnings day (3.1.0). It ranks every character by **visible wealth**: holdings on the books in their own name or their own trusts, and what the public can see. Wealth held through figureheads, shells or hidden control (1.3.1) is not counted, so a shadowy figure can be far richer than their rank. Each rank tier gives Clout and Fame (top 10 +10 each, top 100 +5 each) **(T)**. A big rise on the list draws rival attention: the director (13.3) can aim the rival rotation at the riser.

## 1.11 Death and game over

Removed (batch 116): no dynasty, houses, succession, heirs, wills, guardians, marriage, prenups, children or legacies, and no renown. Relatives exist only as flavor characters.

- **Player death is game over** (Logan, batch 116). When the player character's health reaches 0 (1.1.9) the game ends; the score is the player's score, based on the player character ([12-setup-and-score.md](12-setup-and-score.md)). The game is otherwise an endless sandbox with no end date (Logan, batch 117: the optional end date is removed).
- **AI characters still die** at health 0. Their stakes, trusts, accounts and Techno-Capital pass **silently** to a game-generated heir character, with no succession UI **(A)**. Board seats the dead character held go to the next election or appointment under the charter (1.5, 1.8.1).
- **Rival dynasties are rival characters**: each rival is one person, perhaps with relatives as flavor.

## 1.12 Events for this layer (starting set)

| Event | Trigger | Options |
|---|---|---|
| In the Tabloids | Character with Hedonist or Narcissist, random | Pay off ($500k), let it ride (-10 Favor), lean in (+Fame, -Favor) |
| The Quiet Meeting | Bloc member turns Rival toward you | Confront (Persuasion), ignore, counter-offer |
| Missed Milestone | VC milestone date passed | Down round, bridge loan, fight the faction |
| Covenant Breach | Bank covenant broken | Repay, renegotiate (Finance), default |
| The Board Revolt | 3+ board members at Rival toward the head | Fire them, concede, call shareholder vote |
| Shell Exposed | Shell investigation succeeds | Settle, fight in court, sacrifice an executive |
| Demo Day | Startup chain, early (1.6.9) | Pitch big (Persuasion; investor confidence and Fame up or down), pitch safe, skip |
| The Clone | An incumbent chooses copy | Outbuild them, sue, seek a buyer |
| Payroll Friday | Cash covers under 1 month of losses | Personal loan, skip your salary, lay off 20% (unit expenses down, productivity down), ask your backer |
| The Poacher | A rival offers your CTO double | Match, counter with equity, let them go |
| Co-Founder Fight | Co-founder tension high | Talk it out, buy them out, board vote |
| First Big Customer | Startup chain (1.6.9) | Discount to close (unit business assets up, margin down), hold price, custom work (unit growth slows) |
| Viral Moment | Startup chain, random | Ride it (marketing spend: Fame and unit growth up), stay calm |
| The Leak | Grey-market growth exposure | Deny, apologize, blame a contractor |
| Acquisition Offer | An incumbent chooses acquire | Accept, negotiate (Finance), refuse |
| Regulator Letter | Regulated industry, unit revenue over a threshold | Comply (cost), lobby, ignore |
| Product-Market Fit | Unit revenue grew three quarters running (1.6.9) | Raise now, grow on revenue, reward the team |
| Office Romance | Two key hires become lovers | Allow, separate teams, fire one |

## 1.13 Assumptions

- Company values come from fair value ([10-industry-economy.md](10-industry-economy.md) 10.0.8) and the markets layer.
- Interest rates follow the Federal Monetary Board's world base rate at start (every country uses the dollar, batch 124), or a re-currencied country's central bank rate for loans in its currency ([3-markets-and-fx.md](3-markets-and-fx.md) 3.9).
- Companies work in the 42 industries of [10-industry-economy.md](10-industry-economy.md) 10.3.
