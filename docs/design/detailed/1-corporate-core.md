# Detailed design 1: Corporate core (companies, characters, dynasty, trusts)

This expands [01-companies.md](../01-companies.md), [02-trusts-and-assets.md](../02-trusts-and-assets.md), [03-characters.md](../03-characters.md) and [04-dynasty-and-succession.md](../04-dynasty-and-succession.md) into exact rules and numbers. All numbers are **tuning values**: starting points to balance, not final.

Money is shown in the dynasty's home currency, written as $. "Month" means the monthly calculation (see [09-time-and-turns.md](../09-time-and-turns.md)).

## 1.1 Characters

### 1.1.1 Skills

Five skills, each 0 to 30. A typical adult averages 6 to 8; 15+ is excellent; 25+ is legendary.

Skill sources: base (genetics, rolled 0 to 8 at birth, inherited partly from parents) + education (+2 to +8 in a focus skill) + traits + cyberware + experience (+1 per 5 years in a matching role, max +6).

### 1.1.2 Personality traits

Every adult has 3. Each modifies skills, opinion and stress.

| Trait | Opposite | Skill effect | Stress when | Opinion |
|---|---|---|---|---|
| Ambitious | Content | +1 all skills | Passed over, kept in a junior role | -10 to their liege |
| Greedy | Generous | +2 Finance | Giving money away | +10 from Greedy |
| Paranoid | Trusting | +3 Intrigue (defense) | Trusting others with power | -5 to everyone |
| Ruthless | Compassionate | +2 Intrigue | (Compassionate) firing staff, layoffs | -5 from Compassionate |
| Visionary | Conservative | +2 Tech | (Conservative) risky ventures | +10 from Visionary |
| Honest | Deceitful | -2 Intrigue, +10 reputation | Lying, shells, bribery | +10 from Honest |
| Brave | Cautious | +1 Influence | (Cautious) leverage, hostile takeovers | none |

Same trait between two characters: +10 opinion each. Opposite trait: -10.

### 1.1.3 Education traits

Gained at 18 to 22, level 1 to 4 (level from childhood focus and a roll).

| Education | Focus skill | Bonus per level | Unlock |
|---|---|---|---|
| Ivy League MBA | Finance | +2 | Better VC pitch odds |
| Quant PhD | Finance | +2, +1 Tech | Trading bonuses |
| Bootcamp Coder | Tech | +2 | Tech-sector founding bonus |
| Law School | Intrigue | +1, +1 Influence | General Counsel task bonus |
| Old Money Tutors | Influence | +2 | +10 opinion from old-money families |
| Military Contractor | Operations | +2 | PMC contacts |
| Party School | Influence | +2 | Political appointments |
| Street-Taught | Intrigue | +2 | Fixer contacts, no Ask Daddy path |

### 1.1.4 Opinion

Opinion = sum of active modifiers, clamped to -100 to 100. Most modifiers decay toward 0 by 1 point per week unless marked permanent.

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

### 1.1.5 Stress

Stress 0 to 300. Levels at 100, 200, 300. Each new level triggers a breakdown event (burnout, addiction, public outburst, quitting). At 300 the character may die of a heart attack (5% chance per month).

- Acting against a trait: +10 to +40 stress depending on severity.
- Lifestyle coping: -10 to -20 per month (Hedonist parties, Ascetic retreats).
- Vacation action: 72 hours unavailable, -30 stress.

### 1.1.6 Time and actions

Each character has **16 usable hours per day**; the rest is sleep and private life. Workaholic: 18. Most actions cost hours:

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
- Death chance per year: 0.1% under 40, rising to 2% at 60, 6% at 75, 15% at 85. Modified by health traits and life extension.
- Life extension: $5M per year, halves death chance, max +15 years of life.

### 1.1.8 Schemes

Each scheme has an owner, target, agents (helpers), and progress. Each day, progress rises by (owner skill + agent bonus) / 10 points. At 100 progress it resolves.

Success chance = 50% + (owner skill - target defense) x 3%, clamped 5% to 95%.
Discovery chance per week = 2% + target's Head of Security Intrigue x 0.5% - owner Intrigue x 0.3%.

| Scheme | Skill | Cost | Effect on success |
|---|---|---|---|
| Befriend | Influence | none | Friend relationship |
| Seduce | Influence | none | Lover; hook if a secret affair |
| Recruit to bloc | Influence | optional payment | Target joins your bloc |
| Dig up dirt | Intrigue | $50k | Hook on target (if a secret exists) |
| Leak scandal | Intrigue | $100k | Target loses 20 reputation, stock drops 3 to 8% |
| Corporate espionage | Intrigue | $500k | Steal a tech or a deal |
| Netrun | Tech | $250k | Steal data, crash systems (company loses 1 week of output) |
| Poach executive | Influence | signing bonus | Executive joins your company |
| Investigate shell | Intrigue | $200k | Reveal hidden owners |
| Blackmail | Intrigue | needs hook | Force an action (vote, sale, resignation) |
| Arrange "accident" | Intrigue | $2M | Target dies or is injured; huge penalty if discovered |

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
1. **Prepare deck** (8 hours). Deck quality = (Influence + Tech + Finance) / 3 + education bonus + random 0 to 10.
2. **Pitch meetings**: the player picks up to 5 VC firms from a list (each a fund with a partner character, a sector preference and a risk appetite). Each pitch is 3 hours. Interest chance = 20% + deck quality x 2% + sector match 15% + partner opinion / 2.
3. **Term sheet** event from each interested firm: amount, valuation, board seat, preference multiple (1x to 2x), and a **milestone** (revenue target by a date).
4. **Negotiate** (optional, 2 hours): an Influence roll can raise valuation 10% to 30%, or anger the partner (-20 opinion, may withdraw).
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

Uses your personal cash, minimum $50k. Chain: **First hire** (choose between a cheap generalist or an expensive specialist), **First customer** (Influence roll), **First crisis** (cash crunch, choose: cut your salary, sell personal assets, or take a small loan). You keep 100% class A shares.

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
3. **Public scrutiny**: an opposition or journalist event; Intrigue or Influence roll to keep it quiet, or take a reputation hit.
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
| Subsidiary | Default. Can hold its own vassals (max depth 4). |
| Branch Office | Must be registered in the host country. Host law sets: minimum local partner stake (0% to 51%), golden share (yes/no), local directors (0 to 50%). Unlocks host market and hubs. Host government relation below -50 risks seizure (see politics design). |
| Shell Company | Registered in a haven jurisdiction. Holds stakes and cash anonymously; rivals see "Undisclosed holder" unless they run Investigate Shell. Income routed through it taxed at the haven rate (0% to 5%). Builds **exposure** +1 per month per shell plus +1 per $1M routed per month (both × the haven's F5 multiplier, [4-politics.md](4-politics.md) 4.9.3); investigation chance per month = exposure / 10 %. |
| Joint Venture | Two parents, control by contract (for example 50/50 or 60/40). Deadlock event if parents' heads have opinion below 0 of each other. |
| Front Company | Legit income plus a hidden illegal operation (smuggling, data brokering). Hidden income x2, raid chance 1% per month plus investigations. |
| Franchise | Pays 4% to 8% royalties; parent has no board seats; brand scandal spreads both ways. |
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

A board meeting is an event with an agenda of 1 to 4 items (dividend, budget, acquisition, CEO pay, member complaints). Each item is a majority vote of seats. The head can spend Influence (hours of persuasion) to swing members.

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
- Antitrust or foreign investment review can be triggered if the combined company is large in a market (politics design).

### 1.9.4 Defenses

| Defense | Cost | Effect |
|---|---|---|
| Poison pill (if in charter) | none | Bidder's stake diluted by 30% to 50% if they cross 20% |
| White knight | Find a friendly buyer | Friendly bid competes |
| Crown jewel sale | Sell the most valuable vassal | Company less attractive |
| Staggered board | Charter clause | Bidder needs 2 years to take the board |
| Buyback | Cash | Raises price, shrinks float |
| Litigation | $1M+ | Delays offer by 10 to 30 days |

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
- **Game over** comes when no eligible successor is alive, or at an optional end date set at game start (Logan).

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

- Proposal acceptance = 20% + opinion + wealth tier difference x 10% + alliance value.
- **Share dowry**: a stake transferred with the marriage.
- **Prenup**: decides whether children are of your dynasty or theirs, and whether shares transfer on divorce.
- Divorce: 4 hours plus a legal chain; without a prenup, 50% of the personal assets acquired during marriage split.

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
