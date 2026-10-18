# Detailed design 1: Corporate core (companies, characters, dynasty, trusts)

This expands [01-companies.md](../01-companies.md), [02-trusts-and-assets.md](../02-trusts-and-assets.md), [03-characters.md](../03-characters.md) and [04-dynasty-and-succession.md](../04-dynasty-and-succession.md) into exact rules and numbers. All numbers are **tuning values**: starting points to balance, not final.

Money is shown in the dynasty's home currency, written as $. "Month" means the monthly calculation (see [09-time-and-turns.md](../09-time-and-turns.md)).

## 1.1 Characters

### 1.1.0 Named characters (Logan, 2026-10-17)

The game has **named characters** of two kinds:

| Kind | What they are |
|---|---|
| **Table characters** | Fill out rosters: board seats, executives, staff. They exist in the simulation to do something in a company. |
| **Full characters** | Live in and interact with the game world. They can run a company, work a regular job, help out operations, run for political office, and so on. |

- **Number of full characters** is set at game start, **200 by default**.
- Full characters are spread across backgrounds, strata and locations. They include the starting characters the player did not pick, some of the rivals created in the **rival rotation**, and extra characters generated at random from templates with high variance.
- **Character resources**: assets, clout, income, prestige and vril. Together with Image they shape the character's **stratum** ([2-map-influence-economy.md](2-map-influence-economy.md) 2.8.0).

| Resource | What it is (Logan) |
|---|---|
| **Assets** | What the character owns: stakes, real estate, cash, Techno-Capital |
| **Income** | What the character earns |
| **Prestige** | Standing and renown |
| **Clout** | A ticker of the character's achievements: a permanent buff for how much they have done in their life. It only goes up |
| **Vril** | **A mystical luck stat that can swing rolls; rare and hard to raise** (Logan, batch 60). An esoteric X factor that works like luck. It does not follow the regular game rules: it sometimes punishes the player and other times helps them. Characters gain it by doing vril-worthy acts or through events, but the game never says clearly how; you just get it sometimes. Its value is hidden **(A)** |
| **Image** | The character's PR, made of two factors: **Fame** (how many people know you) and **Favor** (how much people like you). Logan's word was influence; it is called Image here because **influence** keeps its map meaning, power in a place from assets held there (2.5) (Logan). The existing reputation score becomes Favor **(A)** |

- **Table characters can become full characters** (Logan), for example by promotion, winning office or becoming famous. Details later.
- **Rival rotation** (Logan): a roster of characters added to every game with preset AI. They can be directed at the player or at other characters to mess with them, both by the game's director AI and by characters who hire or point them, the player included ([detailed/7-starting-world.md](7-starting-world.md) 7.4).

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
- **Long hours**: ~~extra usable hours a day~~ (no daily budget since batch 64). Instead, ticking actions (1.1.6) take 10% less time at Hustle 15+ and 20% less at 25+ **(T)**.
- **Founding**: Hustle is the roll for the Bootstrap and Freestyle founding paths (1.6.4, 1.6.6) and for early sales at a new company.
- **Side deals and the street**: it rolls for Black market deals (10.3), gambling hustles (9) and quick flips of assets and real estate.
- **Stress**: long hours and crunch cost a character with Hustle 15+ half the stress (1.1.5).
- Trait links: Diligent +2 Hustle, Lazy -2, Ambitious +1 (already +1 to all) **(T)**. Education: Street-Taught and Bootcamp Coder give +1 Hustle per level.

**Skill sources** (Logan, batch 60): base (genetics, rolled 0 to 8 at birth, inherited partly from parents) + **education** (+2 to +8 in a focus skill) + traits + cyberware + **experience from the jobs held** (+1 per 5 years in a matching role, max +6: a CFO gains Finance, a COO Operations) + **events** + **age**.

**Age curve (Logan, batch 60).** Skills **peak around 45 to 55 and then fade slowly** **(T for the numbers)**: from 56 every skill loses 1 point every 5 years, Tech and Hustle every 3 years; Persuasion and Intrigue fade at half speed. Life extension (1.1.9) and cyberware slow the fade.

### 1.1.2 Personality traits

Every adult has 3 (confirmed by Logan, 2026-10-17) from **12 pairs**, CK3 style (batch 60). Cyberware and events can add more, so a character has **3 to 5** in all (Logan, batch 60). Traits drive AI choices and stress (Logan, 2026-10-17: grown from 7 with cyberpunk flavor). Each modifies skills, opinion and stress. Cyberware can add extra personality traits beyond the 3 (1.1.10).

| Trait | Opposite | Skill effect | Stress when | Opinion |
|---|---|---|---|---|
| Ambitious | Content | +1 all skills | Passed over, kept in a junior role | -10 to their liege |
| Greedy | Generous | +2 Finance | Giving money away | +10 from Greedy |
| Paranoid | Trusting | +3 Intrigue (defense) | Trusting others with power | -5 to everyone |
| Ruthless | Compassionate | +2 Intrigue | (Compassionate) firing staff, layoffs | -5 from Compassionate |
| Visionary | Conservative | +2 Tech | (Conservative) risky ventures | +10 from Visionary |
| Honest | Deceitful | -2 Intrigue, +10 reputation | Lying, shells, bribery | +10 from Honest |
| Brave | Cautious | +1 Persuasion | (Cautious) leverage, hostile takeovers | none |
| Diligent | Lazy | +1 Operations, +2 management score skill (10.5.1) | (Lazy) long hours, crises | +5 from Diligent |
| Hedonist | Ascetic | -1 Operations, +1 Persuasion; addiction gain ×1.5 ([11-addiction.md](11-addiction.md)) | (Ascetic) parties, luxury spending | +10 from Hedonist at galas |
| Zealot | Cynic | +2 Persuasion with characters of the same ideology ([5-ideology.md](5-ideology.md)) | Acting against their ideology | -10 from other ideologies |
| Narcissist | Humble | +2 Persuasion in public, -2 in private; Fame gain ×1.5 | Being upstaged, losing Image | -5 from everyone; +10 from flatterers |
| Gregarious | Shy | +2 Persuasion; meetings take half the hours | (Shy) public events, galas, campaigns | +5 from Gregarious |

Same trait between two characters: +10 opinion each. Opposite trait: -10.

#### Trait change (Logan, 2026-10-17)

Traits can change over a life, slowly **(T)**:
- **Events**: some event options give or remove a trait (a betrayal can make a Trusting character Paranoid).
- **Trauma**: each stress breakdown (1.1.5) and each health event costing 30 or more (1.1.9) has a 25% chance to flip one trait to its opposite or add a stress trait.
- **Arc outcomes**: quest arc outcomes can grant or swap traits ([8-quest-lines.md](8-quest-lines.md) 8.1).
- **Drift**: a character who acts against a trait 5 times in a year (each one causing stress) gets an event offering to drop it.
- At most one natural trait change per year, so personalities stay recognizable. Cyberware traits (1.1.10) come and go with the implant.

#### Hidden traits (Logan, 2026-10-17)

Another character's traits are **hidden** until the player learns them:
- Meeting in person reveals one trait per meeting **(T)**.
- Investigating (a Spymaster task, 1.1.8.2, or a hired PI) reveals all traits, and for the player's character the ambition.
- Famous characters (Fame 60+) have their public trait known to everyone; Narcissists' trait is always visible.
- Lie-reader optics (1.1.10) reveal Deceitful at once.
Unknown traits show as "?" on the character screen; opinion modifiers from them still apply.

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
| Gregarious | Alliances, marriages, galas |

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
| Build a legacy | Found a company, fund a cause, or get a dynasty heir established | Visionary, Content |
| Be famous | Reach Fame 75 | Narcissist, Gregarious |
| Protect the family | Keep the family trust intact; marry children well | Cautious, Compassionate |
| Transcend | Fit 4 implants or reach Transhumanist goals | Visionary, Hedonist; Transhumanists |

- Progress toward the ambition gives -5 stress a month; achieving it gives clout and +20 stress relief, and a new ambition is picked.
- Meeting it also gives vril (1.1.0).

### 1.1.3 Education traits

Gained at 18 to 22, level 1 to 4 (level from childhood focus and a roll).

**Choices (Logan, batch 62).** The parent (or guardian) picks a child's **focus at ages 6 and 12** (one of the six skills), and **picks the school at 18** from the list below. Schools **cost money** **(T)**: Ivy League MBA $400k, Quant PhD $250k, Law School $300k, Old Money Tutors $100k a year from age 6, Bootcamp Coder $20k, Party School $150k, Military $0 (it pays), Street-Taught free. A focus matching the school adds +1 level, up to 4 **(A)**.

| Education | Focus skill | Bonus per level | Unlock |
|---|---|---|---|
| Ivy League MBA | Finance | +2 | Better VC pitch odds |
| Quant PhD | Finance | +2, +1 Tech | Trading bonuses |
| Bootcamp Coder | Tech | +2 | Tech-sector founding bonus |
| Law School | Intrigue | +1, +1 Persuasion | General Counsel task bonus |
| Old Money Tutors | Persuasion | +2 | +10 opinion from old-money families |
| Military Contractor | Operations | +2 | PMC contacts |
| Party School | Persuasion | +2 | Political appointments |
| Street-Taught | Intrigue | +2 | Fixer contacts, no Ask Daddy path |

### 1.1.4 Opinion

> **Simplified (Logan, batch 62): opinion is a tag, not a number.** Each character holds one of three attitudes toward each other character: **Friend**, **Neutral** or **Rival**. Special bonds (Nemesis, Lover, Mentor and Protégé, Partner) sit on top of the attitude (below).
>
> - **Changing the tag (A).** The modifiers in the table below are no longer added up. Each one is now a **push**: a push of 30 or more (positive or negative) moves the tag one step at once (Rival → Neutral → Friend, or back); smaller pushes of the same direction add up over a year and move it when they reach 30, then reset **(T)**. Family ties, same dynasty and Partner start the tag at Friend; Nemesis always means Rival.
> - **Formulas that use opinion** (bloc acceptance 1.4, loyalty 1.7.3, tender thresholds 1.9.3, votes in politics and the rest) read the tag as a number: **Friend +50, Neutral 0, Rival -50, Nemesis -100** **(T)**. Any rule written as "opinion above X" means the tag that clears it.
> - The UI shows the tag and the bond, never a number.

The table below is kept as the list of pushes. (Old text: Opinion = sum of active modifiers, clamped to -100 to 100. Most modifiers decay toward 0 by 1 point per week unless marked permanent.

| Modifier | Value |
|---|---|
| Parent / child | +30 permanent |
| Sibling | +10 permanent |
| Spouse | +20 permanent |
| Same dynasty | +10 permanent |
| Same origin hub | +5 permanent |
| Shared trait | +10 each |
| Opposite trait | -10 each |
| Friend / Rival / Nemesis | +40 / -40 / -80 |
| Lover | +30 |
| Monthly trust distribution, fair share | +10 |
| Distribution below fair share | -5 per 10% short (max -30) |
| Passed over for succession | -40 |
| Gift | +1 per 1% of their yearly income, max +20 |
| Fired / demoted | -30 |
| Promoted / board seat | +20 |
| Scheme discovered against them | -50 |

#### Relationships (Logan, 2026-10-17; batch 62)

**Special bonds stay** (Logan, batch 62) and unlock their own actions: a mentor teaches a skill, a nemesis plots against you, a lover opens affair events. Friend and Rival are now the attitude tags above, so a character can hold any number of each; the limit of 3 friends and 3 rivals below is dropped. (Old text: characters have **both** an opinion number and **named relationships** (Logan).) A named relationship adds its opinion modifier above, unlocks its own events, and changes what the two can ask of each other **(A)**:

| Relationship | How it forms **(T)** | Opinion | Events and effects |
|---|---|---|---|
| **Friend** | Opinion 60+ for 6 months, or a Befriend scheme | +40 | Favors at a discount; warns you of schemes they hear about; grief event on death |
| **Rival** | Competing for the same seat, deal or ambition; opinion -40 or lower | -40 | Rivalry events (public spats, poaching); +2 to skills used against them |
| **Nemesis** | A rival who ruins you, or a discovered scheme that cost 30+ health or a company | -80 | Revenge ambition (1.1.2); they will scheme against you until one of you falls |
| **Lover** | Seduce scheme, or opinion 60+ between attracted characters | +30 | Affair events; a secret affair is a strong hook (below) |
| **Mentor** / **Protégé** | A character 15+ years older with a skill of 15+ takes on a younger one | +20 each | Protégé gains +1 a year in the mentor's best skill (max +5); protégés are eligible successors (1.11.0) |
| **Partner** | Spouses and openly polyamorous partners (1.11.5) | +20 | Heirs; shared household events |

A character can hold any number of relationships, but only 3 friends, 3 rivals and 1 nemesis at once **(T)**.

#### Hooks (Logan, 2026-10-17)

A **hook** is leverage over a character, as in Crusader Kings. **Both kinds stay** (Logan, batch 62).

| Hook | Source **(T)** | Use | Lasts |
|---|---|---|---|
| **Weak** | A favor done for them, a debt they owe you (money lent, a bailout), a campaign donation | Called in once: they vote your way, accept a deal, give a board seat or skip a scheme against you. Used up after one call | Until used, or 5 years |
| **Strong** | A secret (affair, crime, shell, insider trade, hidden addiction) or blackmail material | Called in once a year without being used up; they cannot refuse unless they accept the secret coming out | Until the secret is exposed or destroyed |

Hooks come from Dig up dirt and Blackmail schemes (1.1.8), favors, loans and events. A character with a strong hook on them gets stress whenever it is called and may try to destroy the evidence (a scheme against the holder).

### 1.1.5 Stress

Stress 0 to 300. Levels at 100, 200, 300. Each new level triggers a breakdown event (burnout, addiction, public outburst, quitting). At 300 a heart attack event fires (5% chance per month) that costs 30 to 60 health (1.1.9).

- Acting against a trait: +10 to +40 stress depending on severity.
- Lifestyle coping: -10 to -20 per month (Hedonist parties, Ascetic retreats).
- Vacation action: 72 hours unavailable, -30 stress.
- Overwork: every day spent more than 14 ticks busy (1.1.6) adds +2 stress **(T)** (Hustle 15+ halves it, 1.1.1).

**Stress for AI characters (Logan, batch 61): a simpler simulation managed by the director** (13.3) **(A)**:
- AI characters do not track stress points hour by hour. Each has a **stress level** of 0 to 3 that the director updates **weekly** from what happened to them: acting against a trait, losing a fight, a scandal, overwork or a loss raise it; vacations, wins and lifestyle spending lower it.
- When an AI character's level rises, the director rolls a **breakdown** from the same list (burnout, a vice, a public outburst, quitting, a new bad trait) and resolves it off screen, shown to the player as a news pop-up if they would see it (13.4).
- The director can use stress to pace the story: it can push a rival under pressure toward a breakdown when things are calm, and hold it back during a crisis.
- When an AI character moves into the player's circle (full simulation tier, 12-tech 12.3), its level converts to points (level × 100) and then runs like the player's.

### 1.1.6 Time and actions

> **Changed (Logan, batch 64): no daily hours budget.** **Most actions take no time** and resolve at once (a phone call, a trade, a board decision, starting a scheme). **Only certain actions burn ticks** (hours): while one runs, the character is **busy** and cannot start another ticking action, but instant actions still work **(A for which actions tick)**. The table below now lists only actions that tick; the 16-hour day is gone.
>
> - **Ticking actions (A):** travel (domestic 4, international 12, halved by a private jet), in-person meetings (2), pitch meetings (3), board meetings (4), galas (5), vacations (72), and the opening of a scheme (1.1.8.1).
> - **Location matters** (Logan, batch 64): some actions need the character in the city (meeting a minister, a gala, an in-person pitch), so travel is the main thing that burns time.
> - **Delegation** (Logan, batch 64): any action can be handed to a board member, family member or fixer. **The AI then takes it over and rolls for it as if that person did it**, with their skills, traits and location, and their time if it ticks. The player sees the result.
>
> (Old text follows.)

Each character has **16 usable hours per day** (kept, Logan 2026-10-17: hourly turns with a daily budget of hours spent on meetings, travel and schemes); the rest is sleep and private life. Workaholic: 18. Most actions cost hours:

| Action | Hours |
|---|---|
| Phone call | 1 |
| Meeting (one character) | 2 |
| Pitch meeting | 3 |
| Board meeting | 4 |
| Gala / networking event | 5 |
| Domestic flight | 4 |
| International flight | 12 |

Delegating an action to a board member or family member uses their hours instead, with their skills.

### 1.1.7 Life cycle

- Childhood 0 to 17 (education focus chosen at 6 and 12). Adult at 18.
- Fertility: couples have a 15% chance per year of a child until age 45 (female partner); IVF and surrogacy with money.
- **No death rolls** (Logan, 2026-10-17). Characters have a **health** stat, and health only goes down through events. A character dies when health reaches 0 (1.1.9).
- Life extension: see 1.1.9.

### 1.1.8 Schemes

> **Changed (Logan, batch 63): schemes are CK3 style, with Intrigue rolls over weeks.** This replaces the one-roll rule of 2026-10-17. The success and discovery formulas below still apply, but are rolled over the scheme's run (1.1.8.1).

#### 1.1.8.1 How a scheme runs (Logan, batch 63)

- The schemer starts a scheme against a target and pays its cost and its opening hours (4 for social schemes, 8 for Intrigue ones) **(T)**.
- The scheme then **runs for weeks**: 2 to 12 weeks by type **(T)**. Each week it gains progress from the schemer's skill (Intrigue for most, Persuasion for social ones), and rolls **discovery** once a week at a tenth of the old discovery chance.
- **Agents (A).** The schemer can bring in agents: friends, people they hold hooks over, or the target's own staff bought off. Each agent adds progress, and an agent close to the target (a board member, a spouse, a bodyguard) adds the most. Each agent is also a new way to be discovered.
- When progress is full, the **success roll** resolves as below. A failed roll can be retried by starting over.
- Only one scheme per schemer against the same target at a time.
- The rest of this section's old text is kept for the formulas. (Old text: schemes are **simple one-roll actions** (Logan, 2026-10-17): no agents and no progress bars. The schemer pays the cost and the hours (1.1.6), and the scheme resolves at once with two rolls **(T)**:)

- **Success** = 50% + (schemer's skill - target's defense) × 3%, clamped 5% to 95%. Defense is the target's own skill, or their Head of Security's Intrigue if higher.
- **Discovery** = 10% + target's defense × 1% - schemer's Intrigue × 1%, clamped 2% to 60%, rolled whether the scheme succeeds or fails. A discovered scheme gives -50 opinion (1.1.4), can make a nemesis, and serious ones (blackmail, accidents) open a police or regulator investigation.
- **Getting caught (Logan, batch 63).** A discovered scheme makes the target a **Rival** (1.1.4), or a **Nemesis** if the scheme was serious (blackmail, an "accident", a scheme that cost them a company or 30+ health). The target gets a **hook** on the schemer (the scheme itself is the secret), and it **can become a scandal**: a public leak (Image and Favor hit, 1.1.0) if the target or the press chooses to run it.
- Hours: 4 for social schemes, 8 for Intrigue and Tech schemes **(T)**. A character can run one scheme against the same target per month.

| Scheme | Skill | Cost | Effect on success |
|---|---|---|---|
| Befriend | Persuasion | none | Friend relationship |
| Seduce | Persuasion | none | Lover; hook if a secret affair |
| Recruit to bloc | Persuasion | optional payment | Target joins your bloc |
| Dig up dirt | Intrigue | $50k | Hook on target (if a secret exists) |
| Leak scandal | Intrigue | $100k | Target loses 20 reputation, stock drops 3 to 8% |
| Corporate espionage | Intrigue | $500k | Steal a tech or a deal |
| ~~Netrun~~ | Tech | $250k | **Moved to the hacking system**, [17-hacking.md](17-hacking.md) (Logan, batches 63 and 69) |
| Poach executive | Persuasion | signing bonus | Executive joins your company |
| Investigate shell | Intrigue | $200k | Reveal hidden owners |
| Blackmail | Intrigue | needs hook | Force an action (vote, sale, resignation) |
| Arrange "accident" | Intrigue | $2M | Target dies or is injured; huge penalty if discovered |

#### 1.1.8.2 Intel and the Spymaster (Logan, batch 63)

**Intel is per secret** (Logan): a character **either knows a secret or does not**. There are no intel levels.
- **Secrets** are discrete facts kept in the engine: a hidden trait (1.1.2), an affair, a crime, an addiction, a hidden owner behind a shell, a figurehead and the **real controller** behind them (1.3.1), a planned takeover, insider trades.
- A secret is learned through a **Dig up dirt** or **Investigate** scheme, an informant (an agent placed near the target), an event, or being told by someone who knows it. Each success reveals **one secret** **(A)**.
- A known secret stays known. It can be **traded, leaked or turned into a hook**; if it is exposed, everyone knows it.
- **Human intel only for now** (Logan): no hacking until the later hacking system.

**The Spymaster (Logan).** A character's intel and defense against schemes are run by a **Spymaster**: the **Head of Security** board seat for a company (1.8.2), or a **personal fixer** the character hires for themselves and the family **(A)**.
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
| **Illness** | 3% a year, ×2 in a pandemic or a hub with poor healthcare | 5 to 40; serious illness opens a treatment chain |
| **Stress** | Heart attack at stress 300 (1.1.5); burnout breakdowns | 30 to 60; 10 |
| **Addiction** | Monthly while addicted ([11-addiction.md](11-addiction.md)), by substance or habit | 1 to 5 |
| **Violence** | Assassination attempts, accidents, travel risk (2.21.8) | 10 to 100 |
| **Cyberware** | Rejection and surgery events (1.1.10) | 5 to 25 |

**Effects of low health (T).**

| Health | Effect |
|---|---|
| 75 to 100 | None |
| 50 to 74 | -1 to all skills |
| 25 to 49 | -3 to all skills; 25% fewer hours a day (1.1.6) |
| 1 to 24 | Bedridden: -6 to all skills, half hours, can only act through delegates; heirs and rivals start positioning |
| 0 | Death; succession (1.11) |

**Recovery and life extension (T).**
- Rest and normal care restore 1 health a month while no health event fired that month, up to the age cap (100 minus 1 per year over 40).
- **Private medicine** ($200,000 a year) doubles recovery and halves illness costs.
- **Life extension** ($5M a year) raises the age cap by 15, halves aging chances, and grows with tech (cloned organs, gene therapy). It is a status symbol: Glitterati and above gain prestige from it, and heirs waiting on an inheritance lose opinion of the character.

### 1.1.10 Cyberware (Logan, 2026-10-17)

> Cyberware will become **its own system**, designed later (Logan, batch 51); it is no longer an industry. The character rules below stay.

Cyberware **raises stats**, can grant **special abilities**, and can add **extra personality traits**, at the risk of **addiction** ([11-addiction.md](11-addiction.md)) and **AI psychosis** (humanity, below).

**Slots.** Neural (2), Ocular (1), Voice and face (1), Limbs (2), Torso (1) **(A)**. Fitted at a cyberware clinic (an industry, 10.3); legality varies by country (4.x).

**Humanity.** Each character has humanity from 0 to 100, starting at 100. Each implant costs humanity. Below 40, **AI psychosis** events start (paranoid episodes, intrusive voices, -opinion with everyone); below 15, **cyberpsychosis**: the director AI takes control of the character for 1 to 4 weeks. Tech above 15 halves humanity loss; therapy and removing implants restore it slowly **(T)**.

**Addiction.** Every implant adds to a cyberware addiction score (upgrades feel good); a high score fires urges to buy more implants, part of the addiction system ([11-addiction.md](11-addiction.md)).

**Starting implants (A); values (T).**

| Implant | Slot | Cost | Humanity | Gives |
|---|---|---|---|---|
| Neural co-processor | Neural | $2M | -10 | +3 Finance |
| Social-engineering suite | Voice and face | $1.5M | -8 | +3 Persuasion |
| Lie-reader optics | Ocular | $3M | -10 | +2 Intrigue; **ability: Read Lies**, see whether a character in a meeting is Deceitful or bluffing |
| Market daemon | Neural | $5M | -12 | **Ability: Night Trader**, runs the character's trading orders around the clock without using their hours |
| Sleep killer | Torso | $4M | -15 | **Ability: No Sleep**, +4 hours a day (1.1.6); +5 stress a month |
| Total recall | Neural | $2.5M | -8 | **Ability: Perfect Memory**, never forgets a secret or hook; +1 Intrigue |
| Pheromone glands | Torso | $1M | -6 | +5 opinion from everyone met in person |
| Reflex boosters | Limbs | $3M | -12 | **Ability: Hard Target**, assassination and violence events against them cost half health |
| Ghost partition | Neural | $8M | -20 | **Extra personality**: an AI personality shard adds a 4th trait, rolled from Ruthless, Visionary, Paranoid or Ambitious. If it is the opposite of an existing trait, +10 stress a month |
| Corporate daemon | Neural | $12M | -25 | **Extra personality**: a company-trained persona adds the trait Loyal to the company that installed it, +2 Operations; that company's board gains +20 opinion of the character, and the character cannot act against it without a Persuasion check |

Implants can fail (Implant Rejection, 1.12), be hacked by netrunners (a scheme that reads the implant's data or triggers a psychosis event), or be removed (surgery, health -10, humanity restored by half the implant's cost).

## 1.2 Holders and stakes

A **holder** is any of: character (personal account), personal trust, family trust, company, fund, government.

A **stake**: holder, company, share class, number of shares, acquisition date (for bloc tie-breaks).

Share classes:

| Class | Votes per share | Dividend | Notes |
|---|---|---|---|
| A | 10 | normal | Usually founders and family; converts to B when sold to an outsider unless the charter says otherwise |
| B | 1 | normal | Standard common stock |
| N | 0 | normal | Non-voting economic shares |
| P | 0 | paid first, 6% to 8% fixed | VC preferred; converts to B on IPO or sale |

## 1.3 Control

**Voting power** of a holder in a company = votes from its own stakes + votes from stakes held by companies it controls (its vassals' stakes count for it).

**Control rule** (standard charter):
1. Group holders into blocs (holders not in a bloc are a bloc of one).
2. Each bloc's votes = sum of its members' voting power.
3. If one bloc has more than 50% of all votes, its leader controls the company and is (or appoints) the President and CEO.
4. If no bloc has more than 50%, the company is **contested**: the board elects the CEO by majority. Contested companies suffer -10% efficiency and are open to proxy fights.

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
- **No contested period** (Logan, batch 57): the takeover carries no efficiency penalty. Directors and executives loyal to the old real controller keep their seats until they are replaced (a staggered board can make that take 2 years), and until then they can still leak, scheme or start a proxy fight, by their loyalty **(A)**.
- The reverse also works: a dynasty can **gain real control without the shares** by holding hooks over the owner of record, or leading the bloc, and no filing shows it.

**Figureheads (Logan, batch 57).** A player or AI can **deliberately put a figurehead on the books** to hide who is in charge: a relative, a loyal executive, a friendly holder or someone they hold a hook over. The stake is held in the figurehead's name (or their trust or company), and the real controller gives the orders. **AI dynasties do this too**, as well as using shells, so the player has to investigate rivals to see who is behind them.

**Seeing real control (Logan, batch 57).**
- **The owner of record is always visible** to everyone.
- **The real controller needs intel.** Usually it is easy to tell: when the chain runs only through public links (companies, family trusts, open blocs), the real controller is shown at once **(A)**.
- **Sometimes a shadowy figure lurks.** When the chain passes through a shell, a hook or a figurehead, the company screen shows "Real controller: unknown" until the player's intel reaches it, through an Investigate action (1.1.8, like Investigate Shell), an informant on the board, or an event.

**Exposure (Logan, batch 57).** A hidden controller is **legal**. **Governments and regulators never get involved**, and it is not a disclosure breach. But if **the press or certain people** (a rival, a director, a disgruntled figurehead) find out, the real controller **can lose control of the board** **(A for the numbers)**:
- An **Exposed** event fires for the company. Every director's opinion of the real controller drops by 20, or 40 if the director was in the dark **(T)**.
- Each director then rolls to defect: the chance is 50% minus their loyalty or opinion of the real controller ÷ 2 **(T)**. Defectors vote with the owner of record or with a rival bloc from then on.
- The figurehead may **flip**: it gets a free check to break the chain (step 3 above), at +20% if the exposure embarrassed them **(T)**.
- If the defectors and the figurehead together give someone else a board majority, the real controller loses control of the board. They can try to win it back through favors, hooks or a proxy fight (1.9.2).
- Whoever learns the secret first holds it as a **hook** (1.1.4) and can trade it, use it or leak it to the press.

## 1.4 Blocs

- Any holder can **propose a bloc** to another holder of the same company. Acceptance chance = 30% + opinion / 2 + shared dynasty 20% + payment bonus.
- **Leader** = member with the most shares (counting all classes) in the bloc. Tie: earliest acquisition date.
- Members follow the leader's vote unless their opinion of the leader is below -20; then each vote they have a 50% chance to vote independently.
- Members check weekly: if opinion of leader < -40, 25% chance to leave.
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

Inputs: name, sector (one of ~20), home hub, target capital, founding path. Cost: 8 hours of the founder's time to start. The company is created only when the chain completes successfully.

Starting company value = capital raised. Starting monthly revenue = capital x sector yield (0.5% to 3% per month), with costs set so a new company runs at a small loss for 6 to 18 months.

### 1.6.2 Path: Venture Capital

Chain per round:
1. **Prepare deck** (8 hours). Deck quality = (Persuasion + Tech + Finance) / 3 + education bonus + random 0 to 10.
2. **Pitch meetings**: the player picks up to 5 VC firms from a list (each a fund with a partner character, a sector preference and a risk appetite). Each pitch is 3 hours. Interest chance = 20% + deck quality x 2% + sector match 15% + partner opinion / 2.
3. **Term sheet** event from each interested firm: amount, valuation, board seat, preference multiple (1x to 2x), and a **milestone** (revenue target by a date).
4. **Negotiate** (optional, 2 hours): an Persuasion roll can raise valuation 10% to 30%, or anger the partner (-20 opinion, may withdraw).
5. **Close**: shares issued as class P; VC partner joins the board if the term sheet says so.

| Round | Raise | Dilution | Board | Milestone window |
|---|---|---|---|---|
| Pre-seed | $250k to $1M | 5 to 10% | none | 12 months |
| Seed | $1M to $5M | 10 to 20% | observer | 18 months |
| Series A | $5M to $20M | 15 to 25% | 1 seat | 18 months |
| Series B | $20M to $80M | 10 to 20% | +1 seat | 24 months |
| Series C+ | $80M+ | 10 to 15% | +1 seat | 24 months, IPO pressure |

Missed milestone: choose between a **down round** (raise at a lower valuation, -20 founder reputation), **bridge loan** from the VC (debt plus more board seats), or the VCs form a **faction** to replace the CEO.

### 1.6.3 Path: Ask Daddy

Requires a living parent (or grandparent, uncle, aunt) with personal wealth above $10M.

1. **Dinner with Dad** (4 hours). Dad's support = opinion of you / 2 + 30 if you are his favored heir. Below 20: he refuses and the chain ends (you can try again in 6 months).
2. Dad **names 3 to 6 friends** (wealthy characters he likes). The player picks who to visit.
3. Each **meeting** (golf, gala, office: 3 to 5 hours) is an event. Commitment = friend's opinion of your father / 2 + your Influence x 2 + random. Results:
   - **Yes**: invests $100k to $5M for B shares; joins your bloc.
   - **Yes, but**: invests more, and you owe a **favor** (they hold a hook on you, redeemable once for a vote, a hire, or a deal).
   - **No**: a polite refusal; small chance they tell others you are not ready (-5 opinion with Dad's circle).
4. Dad may top up from his personal account (not the family trust) if total raised is under target and his support is above 50.

Effects: your reputation is tied to your father's for 5 years (his scandals hit you at half strength and yours hit him). If the company fails, Dad's opinion -30 and every investor -20.

### 1.6.4 Path: Bootstrap

Uses your personal cash, minimum $50k. Chain: **First hire** (choose between a cheap generalist or an expensive specialist), **First customer** (Persuasion roll), **First crisis** (cash crunch, choose: cut your salary, sell personal assets, or take a small loan). You keep 100% class A shares.

### 1.6.5 Path: Bank Loan

1. **Application** (2 hours): loan size up to 70% of collateral value, or up to 3x your yearly income without collateral if reputation > 50.
2. **Collateral review**: pledged assets are locked.
3. **Covenants**: the bank sets 1 or 2 rules (minimum cash, maximum debt, no dividends for 2 years). Breaking one makes the loan due in 30 days.
4. **Approval** chance = 40% + Finance x 2% + reputation / 2.

Interest = policy rate + 3% to 8% (by risk). Monthly payments over 5 to 10 years. Default: bank seizes the collateral.

### 1.6.6 Path: Freestyle

The player assembles a funding plan from sources, each with its own short chain: own cash, a bank loan, angels (1 meeting each, $25k to $500k, small B stakes), crowdfunding (30-day campaign, Influence-based, many tiny holders who never form blocs), a partner company (that company takes a stake and may become a liege if over 50%).

### 1.6.7 Path: Political Connections

Requires political influence at **Power broker** tier (25%) in the home hub's jurisdiction.

1. **Meeting the Minister** (or mayor, or governor) (3 hours).
2. **Grant application**: grant of $1M to $50M, or a state bank loan at the policy rate, or a sovereign fund stake.
3. **Public scrutiny**: an opposition or journalist event; Intrigue or Persuasion roll to keep it quiet, or take a reputation hit.
4. **Contract award**: a 3 to 5 year government contract as first customer.

Effects: charter becomes State-Linked or the government takes 1 board seat; you owe 2 political favors (the official holds hooks).

### 1.6.8 Founded by a company

A company can found a vassal directly (Found Subsidiary action, CEO's time). It pays the capital from its own cash and holds 100% A shares. The parent's head appoints the new CEO.

## 1.7 Vassals

### 1.7.1 Vassal contract

| Term | Range | Effect |
|---|---|---|
| Tribute (dividend payout) | 0% to 90% of profit | Higher: more cash up, -1 loyalty per 5% above 30% |
| Management fee | 0% to 5% of revenue | Cash up regardless of profit, -2 loyalty per 1% |
| Parent board seats | 0 to majority | More control, -5 loyalty per seat above 2 |
| Veto rights | yes / no | Parent can block vassal acquisitions and debt; -10 loyalty |
| Non-compete | yes / no | Vassal cannot enter parent's sectors; -5 loyalty |

Changing the contract: costs the parent head 2 hours, and the vassal CEO's opinion changes by the loyalty delta x 2.

### 1.7.2 Autonomy levels

| Level | Tribute cap | Growth | Loyalty | Parent control |
|---|---|---|---|---|
| Wholly Integrated | none | -10% | -20 | Full: parent sets budget |
| Managed | 70% | 0% | -10 | Parent approves big decisions |
| Arm's Length | 50% | +5% | 0 | Parent votes as holder only |
| Independent Listing | 30% | +10% | +10 | Public company, parent is majority holder |

### 1.7.3 Loyalty formula (weekly)

Loyalty target = vassal CEO opinion of parent head / 2 + autonomy modifier + contract modifiers + same dynasty 20 + vassal performance (+10 if growing, -10 if shrinking).
Current loyalty moves 5 points per week toward the target.

| Loyalty | Behavior |
|---|---|
| 50+ | Loyal: follows parent, +5% efficiency |
| 0 to 49 | Neutral |
| -1 to -49 | Restless: may join factions, leaks |
| -50 or less | Defiant: actively seeks independence, spin-off or a rival buyer |

### 1.7.4 Vassal type rules

| Type | Special rules |
|---|---|
| Subsidiary | Default. Can hold its own vassals (max depth 4). **Logan, batch 53:** a separate corporation that **must follow its parent's directives**. It keeps **separate books**, its own business units and its own board, which makes its own decisions but **can be overridden by the parent**. On the parent's balance sheet it counts as **an asset** (its stake), not as consolidated units ([10-industry-economy.md](10-industry-economy.md) 10.0.8). |
| Branch Office | Must be registered in the host country. Host law sets: minimum local partner stake (0% to 51%), golden share (yes/no), local directors (0 to 50%). Unlocks host market and hubs. Host government relation below -50 risks seizure (see politics design). |
| Shell Company | **Logan, batch 53:** basically an empty company for moving money around. **No business units**, but it can hold **software, compute and stored data** ([14-software.md](14-software.md), [15-infrastructure.md](15-infrastructure.md)), as well as stakes and cash. Registered in a haven jurisdiction. Holds stakes and cash anonymously; rivals see "Undisclosed holder" unless they run Investigate Shell. Income routed through it taxed at the haven rate (0% to 5%). Builds **exposure** +1 per month per shell plus +1 per $1M routed per month (both × the haven's F5 multiplier, [4-politics.md](4-politics.md) 4.9.3); investigation chance per month = exposure / 10 %. |
| Joint Venture | Two parents, control by contract (for example 50/50 or 60/40). Deadlock event if parents' heads have opinion below 0 of each other. |
| Front Company | Legit income plus a hidden illegal operation (smuggling, data brokering). Hidden income x2, raid chance 1% per month plus investigations. |
| Franchise | Pays 4% to 8% royalties; parent has no board seats; brand scandal spreads both ways. |
| ~~Direct Branch~~ | **Retired (batch 48).** A corporation now holds business units in any industry instead ([10-industry-economy.md](10-industry-economy.md) 10.0). |
| Holding Company | Exists only to own stakes in other companies; no facilities. Consolidates the group's holdings under one board, so one bloc controls everything below it. Dividends from below pass up untaxed inside the same country **(T)**. Added 2026-10-17 (Logan). |
| Cooperative | Owned by its workers or members, one vote each; the parent holds a minority stake and a supply or service contract, not control. Unions do not strike it; profits are paid out to members. Added 2026-10-17 (Logan). |
| Captive Bank / Insurer | Lends to group companies at policy rate + 1%. Regulated: capital ratio must stay above 10% or regulators intervene. |

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
| Chair | Manage shareholders | +0.5 opinion of head among holders per month |
| Chair | Prepare for vote | +1% votes in the next proxy fight |
| CFO | Optimize capital | +0.3% company profit |
| CFO | Restructure debt | -0.05% interest rate |
| CFO | Prepare acquisition | Reveals targets; -0.5% takeover cost |
| COO | Grow operations | +0.2% monthly growth |
| COO | Integrate vassal | +1 loyalty per month in a chosen vassal |
| COO | Cut costs | +0.5% profit, stress for Compassionate COOs |
| General Counsel | Takeover defense | +2% to defense rolls |
| General Counsel | Fabricate claim | Progress toward a casus belli |
| Head of Security | Counter-intelligence | +1% discovery chance on schemes against the company |
| Head of Security | Protect executives | -2% success of hostile schemes on executives |
| Chief Strategy Officer | Expand | Progress toward a new hub or branch office |
| Chief Strategy Officer | Government relations | +0.2 political influence per month in the home jurisdiction |
| Independent Director | Lend reputation | +0.5 company reputation |

### 1.8.3 Board opinion

Each member's opinion of the head affects work: below 0, task effect halves; below -40, they may leak (1% per month per point below -40) or join a faction.

### 1.8.4 Board meetings (quarterly)

A board meeting is an event with an agenda of 1 to 4 items (dividend, budget, acquisition, CEO pay, member complaints). Each item is a majority vote of seats. The head can spend hours of persuasion (the Persuasion skill) to swing members.

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
2. Swing holders: every holder not in either side's bloc. Each has a lean from -100 (side A) to +100 (side B), starting from opinion difference between the two leaders.
3. Each day, both sides can spend **campaign actions**: a meeting with a holder (2 hours, shifts lean by Influence x 2), a public letter (shifts all leans by 5), a payment (shifts lean by 1 per 0.1% of holder's position value), or a scheme.
4. On vote day, holders with lean below 0 vote A, above 0 vote B. Winner fills the contested seats and, under a standard charter, the head.

### 1.9.3 Tender offers

- The bidder announces a price, usually market price + 20% to 50% premium, for a target percentage.
- Each holder accepts if: offer premium > their loyalty threshold. Threshold = 10% + opinion of current head / 4 + bloc membership 15%.
- Lasts 20 days. The target can respond with defenses.
- ~~Antitrust review~~: **no antitrust in the game** (Logan, batch 56). Foreign investment review (4-politics C1) can still be triggered.
- **Control on the books, not real control** (1.3.1): a winning tender gives book control at once; real control comes later, through the feudal layer.
- **When the target ends up fully owned** (Logan, batch 56), the player (or the AI bidder) **chooses each time**: **merge it in** (its units join the buyer's, its debt becomes the buyer's and its board is dissolved), or **keep it as a subsidiary** (1.7) with its own books and board.

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

Hostile action without a casus belli: -30 reputation and an investigation chance of 20%. With one: -5 reputation.

## 1.10 Trusts and accounts

### 1.10.1 Family trust rules

Set at game start, changeable by a **family vote** (each adult dynasty member votes; 2/3 needed; costs -10 opinion from those who voted no).

| Rule | Options |
|---|---|
| Succession law | Primogeniture, Partition, Trustee Appointment, Meritocratic, Designated Heir |
| Eligibility | Blood only, blood and spouses, blood and adopted |
| Distribution policy | Fixed (x% of income), Needs-based, Merit-based, None |
| Protected assets | Up to 3 named assets that cannot be sold without a family vote |
| Spending limit | Max % of trust value the trustee can move per year without a family vote (default 25%) |

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

Default policy rate: 4% (central banks change it once markets exist).

### 1.10.3 Leverage

- **Margin loan**: borrow against a portfolio. Interest = policy rate + 2%. Margin levels by asset, and the margin call deadline (the next daily settlement), are set in [3-markets-and-fx.md](3-markets-and-fx.md) 3.5.4: if equity falls below maintenance, add cash or the broker sells stakes (largest liquid first).
- **Mortgage**: borrow up to 70% of a property's value; interest = policy rate + 1.5%.
- **Personal guarantee**: back a company loan; if the company defaults, the guarantor pays.

### 1.10.4 Monthly cash flow (trust or personal account)

Income: dividends + rent + interest + salaries.
Expenses: lifestyle (by trait: Ascetic 0.5x, Hedonist 2x; base $20k per adult dynasty member per month for the trust), distributions, staff, loan interest, taxes, scheme costs.

### 1.10.5 Personal wealth tiers (standing)

| Tier | Total controlled value (trust share + personal) |
|---|---|
| Investor | < $10M |
| Magnate | $10M to $500M |
| Mogul | $500M to $10B |
| Tycoon | $10B to $100B |
| Oligarch | > $100B |

### 1.10.6 Personal money (Logan, batch 59)

| Topic | Decision |
|---|---|
| Spending | **Monthly personal spending can raise some resources** (the character resources in 1.1: clout, prestige and vril, plus stress and health). Spending is a monthly budget, not a list of bought objects. |
| Income | **Salary and bonus** from board and executive seats, **dividends**, **trust payouts** and **gambling** winnings (9). |
| Tax | **Income and capital gains tax by home country**, lowered by trusts and havens. |
| Debt | **Personal loans and pledging shares** (3.5.5). A default hurts reputation and can force sales. |
| Rich list | **A public world rich list** that drives prestige and rival attention. **Hidden wealth is not counted.** |

**Spending budgets (A).** Each character sets a monthly amount for each line. A line raises its resource with diminishing returns: the gain is `points at the reference spend × (spend ÷ reference)^0.5`, capped at twice the reference gain **(T)**. The reference spend scales with the wealth index of the home hub.

| Line | Examples | Raises | Reference spend and gain **(T)** |
|---|---|---|---|
| **Status** | Homes, yachts, jets, art, parties | **Prestige** | $200k a month for +2 prestige a month |
| **Social** | Clubs, galas, gifts, hosting | **Clout** in the home hub, and opinion of the people invited | $100k a month for +2 clout a month |
| **Wellness** | Doctors, retreats, life extension (1.1.9) | **Health**, and lowers **stress** | $50k a month for -10 stress and +1 health a month |
| **Vices** | Gambling, drugs and the rest (11) | Each vice's benefit, plus addiction risk | As in 11 |
| **Spiritual and esoteric** | Gurus, rituals, retreats | **Vril** | $50k a month for +1 vril a month |

- Traits still scale the bill: Ascetic ×0.5 and Hedonist ×2 (1.10.4). An Ascetic gets the wellness gain at half price but only half the status gain.
- **Upkeep**: anything owned for status (a jet, a yacht, an estate) is part of the status line, and it **keeps some resale value** (about 50% of what was spent on the physical object) if the budget is cut and the object is sold **(T)**. Private jets also unlock travel (2.21).
- Cutting a line lets its resource drift back: prestige from spending fades 1 point a month after 3 months without it **(T)**.

**Income (A).** Salary: CEO $1M to $20M a year by company rank (1.7.5), other executives and board members 10% to 50% of that. Bonus: 0 to 200% of salary, voted by the board on results. Trust payouts follow the trust's rules (1.10.1).

**Personal tax (A).** Income tax 20% to 50% and capital gains tax 0% to 30% by home country (4-politics E2) **(T)**. Income kept inside a trust is taxed at the trust's jurisdiction rate. Moving money to a haven through a shell (1.7.4) lowers tax but builds exposure.

**Personal debt (A).** A personal loan is up to 2 years of income at the base rate plus 4%. A share pledge loan is up to 40% of the shares' value (3.5.5). A missed payment fires a default event: reputation -15, and the lender can force the sale of pledged shares, which can change control (1.3).

**The rich list (A).** Updated every quarter after earnings day (3.1.0). It ranks every character by **visible wealth**: holdings on the books in their own name, their share of family trusts, and what the public can see. Wealth held through figureheads, shells or hidden control (1.3.1) is not counted, so a shadowy figure can be far richer than their rank. Each rank tier gives prestige (top 10 +10, top 100 +5) **(T)**. A big rise on the list draws rival attention: the director (13.3) can aim the rival rotation at the riser.

## 1.11 Dynasty and succession

### 1.11.0 Player succession (Logan, 2026-10-17)

Heirs do not work the way they do in CK3. The player plays **one character**, and "heir" means **the player character's successor**:

- **Trusts are left to other characters.** The family trust and the player's personal trusts can be left to other characters when the player dies. While alive, the player can change these trusts, within each trust's rules about what may be changed (rules to be set later).
- **Eligible successors.** When the player dies, certain characters are eligible to become the successor:

| Category | Who qualifies **(T)** |
|---|---|
| Children | Any child of the player, including adopted children |
| Spouse | The current spouse |
| Business partners | Co-founders, and members of the player's bloc in a company the player controls |
| Mentees | Characters the player mentored (a completed Mentor scheme) |
| Creditors and favor holders | Characters the player owes a large favor (a strong hook) or a large debt: $10M or 10% of the player's personal net worth, whichever is lower |

- **Taking over.** The player then plays as the chosen successor and receives **that character's share** of the former player's trusts and Techno-Capital: what the will, the trust rules and any debts give them. Other characters receive their own shares and stay AI-run.
- **Choosing.** The player picks the successor from the eligible list at the moment of death; the character named in the will is shown first (Logan).
- **Outside the family.** If the successor is not family (a partner, mentee or creditor), the player chooses each time whether to carry on as the successor's own family, keeping what was inherited, or to bring the successor into the old dynasty (Logan).
- **Minors.** A child under 18 can be the successor. A guardian runs their affairs until they turn 18 (Logan).
- **Game over** comes when no eligible successor is alive, or at an optional end date set at game start (Logan). The game is otherwise an endless sandbox, and the end date is off by default (Logan, 2026-10-17).

The trustee rules below (1.11.1) predate this and will be reworked when the trust rules are designed.

### 1.11.1 Succession resolution

When the trustee dies or is removed (family vote with 3/4 needed to remove a living trustee):

| Law | Resolution |
|---|---|
| Primogeniture | Eldest eligible child, then their line, then siblings |
| Partition | Trust splits into one trust per eligible child, equal shares; eldest keeps the dynasty name trust |
| Trustee Appointment | 3 trustee characters vote; each votes for the eligible heir they like most (bribes and hooks apply) |
| Meritocratic | Highest sum of skills among eligible adults |
| Designated Heir | The named heir; if any other eligible heir has 2x the heir's family support, a **succession dispute** event chain starts |

### 1.11.2 Succession shock

On succession, for 12 months:
- All bloc members, board members and vassal CEOs gain "New head" opinion: -20, decaying 2 per month.
- Each bloc in a dynasty-controlled company checks immediately: members with opinion of the new head below 0 have a 30% chance to leave.
- Siblings passed over gain -40 "Passed over".
- Personal assets of the dead head pass by will (default: equal split among children).

### 1.11.3 Wills

The head (and every character with personal assets) has a will. Changing it costs 4 hours. Heirs learn their share; disinherited heirs gain -50 opinion. Wills can be contested in court (event chain, Intrigue and money) or forged (scheme).

### 1.11.4 Renown and legacies

Renown is earned monthly: +1 per $1B of trust value, +5 per company controlled at Megacorp or higher, + events.

| Legacy track | Level 1 (500 renown) | Level 2 (2,000) | Level 3 (5,000) |
|---|---|---|---|
| Old Money | +10 reputation | +10 opinion from old-money families | Protected assets need 1/2 vote instead of 2/3 |
| Quant Bloodline | Children +1 Finance | +5% trust returns | Children +2 Finance |
| Founders | +10% VC interest | Founding chains shortened | Founded companies +5% growth |
| Political Machine | +5% political influence | Appointments easier | Family members +20% vote share |
| Shadow Network | +2 Intrigue for family | Shells exposure -25% | Schemes -20% discovery |

### 1.11.5 Marriage

> **Changed (Logan, batch 62): marriages are alliances between dynasties, with a prenup.** This replaces "light" marriage.

- **Alliance.** A marriage between two dynasties is an **alliance**: the two heads move to Friend, their dynasties count as allies in blocs (1.4: +20% acceptance) and in proxy fights, and they can call on each other in events **(A)**.
- **Prenup.** Every marriage has a prenup set at the wedding, negotiated like a deal: what share of the family trust and personal assets the spouse can claim (0% to 50%), whether the spouse becomes a trust beneficiary, and what happens to children's shares **(A)**. No prenup means the home country's default (50/50 of what was gained during the marriage).
- **Divorce splits by the prenup**, ends the alliance and turns the two heads Rival unless both agree it was amicable.
- (Old text: Marriage is **light**, flavor, relationships and heirs, with no dowries, merged trusts or prenup mechanics.)

- Proposal acceptance = 20% + opinion (as a number, 1.1.4) + wealth tier difference × 10%, + the value of the alliance and prenup terms offered **(T)**.
- A spouse is a Partner relationship (1.1.4): +20 opinion, shared household events, and children who are eligible successors (1.11.0).
- **Polygamy** (Logan): a character can have more than one spouse where the country's law allows it **(A)**: allowed in some countries (for example the UAE, Nigeria in some states, Saudi Arabia), elsewhere only through private ceremonies with no legal standing.
- **Polyamory** (Logan): characters can have more than one open partner at once. Open partners are Partner relationships, not secret affairs, so they are not hooks. Characters with the Zealot trait and a conservative ideology lose opinion of polyamorous characters; Hedonist and Gregarious characters gain it **(A)**.
- Children of any spouse or partner are eligible successors.
- Divorce or a break-up: 4 hours and an event; spouses split assets **by the prenup** (Logan, batch 62), or 50/50 of what was gained during the marriage without one **(T)**.

## 1.12 Events for this layer (starting set)

| Event | Trigger | Options |
|---|---|---|
| Heir in the Tabloids | Heir with Hedonist or Socialite, random | Pay off ($500k), let it ride (-10 reputation), disinherit |
| The Quiet Meeting | Bloc member opinion < 0 of you | Confront (Influence), ignore, counter-offer |
| Dad's Old Friend | Favor owed from Ask Daddy | Grant the favor, refuse (-30 opinion), negotiate |
| Missed Milestone | VC milestone date passed | Down round, bridge loan, fight the faction |
| The Founder's Will | Head over 70 | Revise will, keep it, leak it to test heirs |
| Covenant Breach | Bank covenant broken | Repay, renegotiate (Finance), default |
| The Board Revolt | 3+ board members below -40 opinion | Fire them, concede, call shareholder vote |
| Shell Exposed | Shell investigation succeeds | Settle, fight in court, sacrifice an executive |
| Implant Rejection | Character with cyberware, random | Surgery ($1M, 1 week), keep working (+stress), remove |
| Sibling Rivalry | Two heirs with Rival relationship | Mediate, pick a side, let them compete |

## 1.13 Assumptions

- Company values in this layer are abstract until the economy layer exists; markets layer replaces the monthly price update.
- Default policy rate is 4% until central banks exist.
- 20 sectors at launch (finance, real estate, chips, consumer electronics, cyberware, energy, logistics, media, security, pharma, software, AI, telecoms, automotive, mining, agriculture, retail, construction, defense, entertainment).
