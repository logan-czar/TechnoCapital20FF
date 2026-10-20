# 21. The quarterly cycle: detailed design

_Status: draft v0.1 (2026-10-20). Batch 143 (Logan): the quarterly cycle._

Logan (batch 143): "How Quarters will work." Every company runs the same loop four times a year: earnings come out, the market reacts, the board meets and locks a plan, the quarter plays out under that plan, and a final week of board events sets up the next report. "This cycle repeats over and over as companies compete with each other" (Logan).

This file pulls together and replaces the quarterly pieces that were spread over [3-markets-and-fx.md](3-markets-and-fx.md) 3.1.0 (earnings day, recap screen, insider blackout), [1-corporate-core.md](1-corporate-core.md) 1.8.4 (board meetings), [10-industry-economy.md](10-industry-economy.md) 10.0 (growth and R&D plans) and [../09-time-and-turns.md](../09-time-and-turns.md) 9.2. Those files now point here.

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 21.9.

---

## 21.1 The cycle at a glance

Logan treats the earnings release as the **start** of a quarter and the next release as its **end**, so the "week before the end of a quarter" is the 7 days before the next release **(A)**. Release dates stay 2 January, 2 April, 2 July and 2 October at 00:00 UTC (3.1.0).

| # | Phase | When (Q2 example) | Trading | What happens |
|---|---|---|---|---|
| 1 | **Earnings release** | 2 Apr 00:00, one tick | Open, prices frozen | Every company's statements and guidance come out; the game pauses; the player reads and places trades before the market moves (21.2) |
| 2 | **Reaction week** | 2 Apr 01:00 to 9 Apr 00:00 | Open | The market reacts and overreacts; result plot lines fire events; trades against your own company displease its board (21.3) |
| 3 | **Board meeting event chain** | 9 Apr 00:00 **(A)** | Open (game paused while the chain runs) | Grading, performance scores, firing votes, seat suggestions, edits by grade, plan lock (21.4) |
| 4 | **Locked quarter** | 9 Apr to 25 Jun | Open | The plan runs; projections shown as ranges; scheme events (21.5) |
| 5 | **Pre-quarter-end week** | 25 Jun 00:00 to 2 Jul 00:00 | **Locked for the player** | Auto-pause, recap screen, one event per board member per day (21.6) |
| 6 | **Back to earnings** | 2 Jul 00:00 | Unlocks | Phase 1 again |

The pre-quarter-end week starts on 26 March, 25 June, 25 September and 26 December. The 1 January holiday falls inside the Q4 week; markets are closed that day anyway (3.1.0).

```
 2nd 00:00        2nd 01:00            9th 00:00                              7 days before next 2nd   next 2nd 00:00
    |                 |                    |                                            |                    |
    | 1. RELEASE      | 2. REACTION WEEK   | 3. BOARD MEETING CHAIN                     |                    |
    | (1 tick, trade  | market overreacts, | grade -> performance score -> firing vote  |                    |
    |  before the     | result plot lines, | -> suggestions -> edits by grade -> lock   |                    |
    |  market moves)  | board displeasure  |                                            |                    |
    |-----------------|--------------------|---- 4. LOCKED QUARTER --------------------|-- 5. PRE-QUARTER --|
    |                 |                    | plan fixed; projections as ranges;         | END WEEK           |
    |                 |                    | scheme events (some last quarters)         | auto-pause, no     |
    |                 |                    |                                            | trading; 7 days x  |
    |                 |                    |                                            | 1 event per member |
    +---------------------------------------------------------------------------------------------- 6. --> 1.
```

## 21.2 Earnings release and the one-tick window

Logan: "00:00 Quarterly earnings are released. Stock trading unlocked, player can go over Quarterly Earnings of different companies and put in trades before the market reacts."

- **00:00 on the 2nd.** Every company's quarterly statements (10.0.8) and guidance (3.1.0) are published at once. The pre-quarter-end trading lockout (21.6) ends on the same tick.
- **Prices do not move on the 00:00 tick.** The earnings surprise (3.3.6) and guidance jumps are applied on the **01:00 tick**, not at 00:00. The 00:00 tick is a **one-tick window**: orders placed in it fill at the last pre-release price.
- **Auto-pause.** The Earnings day alert (20-ui 20.4.1) pauses the game at 00:00 so the player can read reports in Pdoomberg (3.13.1) at leisure. Time spent paused does not shorten the window.
- **Window limits (T).** To keep the window an edge rather than a free lunch, fills in it use normal slippage (3.3.7), and each holder group may fill at most **5% of a stock's ADV** in the window **(T)**. The rest of an order queues for 01:00.
- **Who else trades in it (A).** Fair AI (12-setup): named AI holders get the same window and act on their traits; most of them only decide weekly (3.1.2), so in practice only traders, funds and rivals flagged as active move in it. AI investor archetype flow (3.3.4) does not run on the 00:00 tick.
- **1 January orders.** Orders queued on the 1 January holiday fill in the 2 January window at the 31 December close; the reopening jump of 3.3.9 (1 January news plus the annual surprise) lands at 01:00 **(A)**.
- **No insider trading.** The window is not inside information: every report is public at 00:00 (batch 130).

**Reconciled with 3.1.0.** The earnings-day frenzy now starts at **01:00**: volume ×4 for the 24 hours from 01:00, the Global Risk Gauge +5 shock at 01:00, and circuit breakers checked from 01:00 **(T)**. The 00:00 auto-pause alert stays.

## 21.3 Reaction week

Logan: "Market Reacts to quarterly earnings. Can be volatile and over react to the past quarters results. Plot lines develop and fire events at different companies based on different kinds of results."

### 21.3.1 Overreaction (T)

- The 01:00 jump is the 3.3.6 surprise jump times an **overreaction factor** of 1.5 **(T)**.
- Over the rest of the week, prices mean-revert: each day 20% of the gap between P and the post-earnings fair value V closes, on top of normal order flow **(T)**. Some stocks overshoot further on momentum (Buzz above 50 adds a 30% chance of a second-day move in the same direction, half the size) **(T)**.
- Volatility in the week is ×2 for the stock's hourly noise (3.3.3), falling back to ×1 by day 7 **(T)**.
- This is where a reader of the reports earns money: buy the overreaction, short the hype.

### 21.3.2 Result plot lines

Each company's report is tagged with one or more **result types**. Each type starts a **plot line**: a short event chain from the Earnings deck (13.5) that plays out over the week, and sometimes past it **(A for the list)**.

| Result type | Trigger **(T)** | Sample plot line |
|---|---|---|
| **Beat** | Surprise s over +5% | *Victory Lap*: the CEO wants a bonus; analysts upgrade; a rival starts asking questions |
| **Big beat** | s over +20% | *Too Good to Be True*: a short seller digs in (3.5.2); a buyer calls |
| **Miss** | s under -5% | *Who Is to Blame*: the board looks for a scapegoat (performance scores, 21.4.2) |
| **Big miss** | s under -20% | *Blood in the Water*: an activist builds a stake (3.4.9); the credit line is reviewed (10.0.9) |
| **Guidance raise** | Guidance up | *Promises, Promises*: next quarter's guidance roll is harder |
| **Guidance cut** | Guidance down | *Cut to the Bone*: layoff rumors, staff trouble events (10.0.11.3) |
| **Loss** | Net income under 0 | *Going Concern*: rating watch (3.6.4), lenders call |
| **Record quarter** | Best revenue in the company's history | *Hubris*: an expansion pitch from the Chief Strategy Officer |
| **Industry-wide** | Most of an industry beats or misses together | One *Industry* deck event for every company in it (10.0.6) |

### 21.3.3 Detail by proximity (A)

Logan: "Companies these events will play out in varying detail based on their proximity to the player."

| Proximity | Detail |
|---|---|
| Companies where the player holds a seat, controls, or is the real controller | **Full chains**: every step is an event card with choices (13.2) |
| Holdings and watchlist companies | **Short events**: one card or a toast with the outcome, no choices unless the player is a 5%+ holder |
| Everyone else | **Headline only**: one story in the News feed (13.4, 20-ui 20.5.1) |

The engine resolves every chain at every company the same way (fair AI); proximity sets only what the player sees.

### 21.3.4 Board displeasure (T rules)

Logan: "The player can trade stocks however they like however certain stock trades will displease the board and may cause you to lose your seat."

Every board seat holder has a **board displeasure** score at that company, 0 to 100, starting at 0 **(A)**. Trades by the character or by any holder group they control (3.1.1) move it:

| Trade **(T)** | Displeasure |
|---|---|
| Selling the company's shares in reaction week | +2 per 1% of the character's stake sold, +5 more if sold into a falling price |
| Shorting the company or borrowing its shares (3.5.1) | +25 at once, +5 a week while open |
| Building a stake in a direct rival (same main industry) above 5% | +10 |
| Joining a raider's tender or bloc against the company (1.9.3) | +30 |
| Buying the company's shares in reaction week | -2 per 1% of stake added, to a floor of 0 |

- Displeasure is felt by the other board members; it is public to them, and the player sees his own score on the company's Board tab.
- **Effects (T).** At the next board meeting, the member loses **displeasure ÷ 2** performance points (21.4.2). At 50+ a *Board Revolt* event fires (13.5). At 80+ the member faces a firing vote at once, whatever their performance score.
- **Decay (T).** Displeasure halves after each board meeting.
- Trades before the meeting count most because the board meets right after reaction week; the same rules apply in the locked quarter.

## 21.4 The board meeting event chain

At the end of reaction week the player is sent to a **board meeting event chain** at every company where he holds a seat. It uses the company event screen (13.2.1) and runs while the game is paused. This replaces the old agenda meeting of 1.8.4; the dividend vote (10.5.5) is now one item of the CFO's suggestion (21.4.4).

The chain, in order:
1. **Grades** for every member (21.4.1).
2. **Performance scores** updated (21.4.2).
3. **Firing votes** for anyone below the threshold, then replacements (21.4.3).
4. **Suggestions**, one per seat (21.4.4).
5. **Edits** by grade (21.4.5).
6. **Lock** by the plan runner, then the CEO's final pass (21.4.6).

### 21.4.1 Grading

Logan: "Each board member is graded based on how they rolled over the course of the previous quarter."

Each member's grade comes from **every roll they made for the company** in the quarter just ended: event options (13.2.1), guidance rolls (3.1.0), scheme success rolls they led (1.1.8), and their pre-quarter-end week events (21.6). Seat tasks are not rolled (1.8.2), so they count only through the seat result below **(A)**.

- **Roll score (T).** A critical success (rolled 15+ points under the needed chance) counts +2, a success +1, a failure -1, a critical failure (15+ points over) -2.
- **Seat result (A, T).** Up to ±10 for how their area did: CFO by earnings against guidance, CMO by revenue against the growth plan, CTO by productivity change, CIO by schemes finished and not discovered, others by the company's surprise s.
- **Grade** = `50 + 25 × average roll score + seat result`, clamped 0 to 100 **(T)**. A member with no rolls gets 50 plus their seat result.

| Letter | Grade **(T)** |
|---|---|
| A | 85 to 100 |
| B | 70 to 84 |
| C | 50 to 69 |
| D | 35 to 49 |
| F | under 35 |

The player is graded the same way. Grades show as letters; the number is in the tooltip.

### 21.4.2 Performance score

Logan: "This will reduce their performance score." Each member has a **performance score**, 0 to 100, kept per seat. A new member starts at **70** **(T)**. Each meeting the grade moves it:

| Grade | Change **(T)** |
|---|---|
| A | +3 (good grades restore it slowly, **A**) |
| B | 0 |
| C | -4 |
| D | -8 |
| F | -15 |

Board displeasure (21.3.4) then takes off its half. The score is shown on each seat card (20-ui 20.7.2).

### 21.4.3 Firing votes and replacements

- **Threshold (T).** A member whose performance score is under **40** is **up for a vote to fire** (Logan). So is anyone at 80+ displeasure (21.3.4).
- **The vote** is a shareholder vote, not a board vote (Logan: "shareholders will vote if they keep their job"). It uses the existing rules: each bloc votes as its leader (1.4), and swing holders vote by lean as in a proxy fight (1.9.2), with the member's tags toward each holder plus `(performance score - 40) ÷ 2` added to their lean toward keeping **(T)**. The member may spend one Persuasion check to plead their case (+10 lean on success) **(T)**. A simple majority of votes cast fires them.
- **Hidden control.** The real controller's bloc votes as the controller wishes, through figureheads (1.3.1).
- **Replacement.** Logan: "After you can select a replacement if they are fired." Batch 142 says the controller seats board members (1.8.1, 10.0.11.3). Reconciled **(A)**: the **plan runner** (21.4.6; the player when he is COO) **nominates** the replacement from the company's executives, the player's contacts or a hiring pool; the **real controller approves or seats their own pick** instead. If the player is the controller, his pick stands. The new member starts at performance 70 and joins this meeting at grade C.
- **The player can be fired.** If John's own seat is voted out he leaves the board and the chain continues without him; he keeps his shares and any other seats **(A)**.

### 21.4.4 Suggestions by seat

Each seat makes one suggestion for the quarter's plan. The **plan** has five items **(A)**:

| Plan item | Suggested by | What it sets |
|---|---|---|
| **Schemes** | **CIO** (Head of Security, **A**) | Up to 2 company schemes for the quarter, with targets and labor assigned (1.1.8, 10.0.11.3) **(T)** |
| **Techno-Capital and software** | **CTO** | Compute to buy, lease or drop; software upgrades and licences; station mix and research labor (6, 14, 15, 10.0.11) |
| **Growth rate** | **CMO** (new seat, **A**) | Each unit's growth plan (10.0.2), from the industry's projected demand (10.0.3) |
| **R&D %** | **Chief Strategy Officer**, else the COO **(A)** | Each unit's R&D plan as a % of revenue (10.0.4) |
| **Financing** | **CFO** (**A**: Logan wrote "the CTO" here a second time) | Bonds, credit line draws and repayments, investing idle cash in holdings or bonds (10.0.9, 3.6); the dividend proposal (10.5.5) |

- **Seat names (A).** The board has no CIO or CMO seat today (1.8.2, 10.5.1). The proposal: **CIO** is the **Chief Intelligence Officer**, a new name for the Head of Security (the company's Spymaster, 1.1.8.2); it is not the personal office's Chief Investment Officer (3.18.3). **CMO** (Chief Marketing Officer, Persuasion) is a new seat that absorbs the "Head of IR or PR" of the guidance rolls (3.1.0).
- **Logan's words.** "The CIO will suggest schemes for you to run. The CTO can tell you things you could do with your technocapital and software. The CMO will suggest a growth rate based on the industry projected growth in demand. Other board members will suggest things to you like the R&D growth percentage."
- **Small boards (A).** Batch 142 caps the board at the CEO plus 4 seats, so most companies lack some of these seats. An item whose seat is empty is suggested by the **CEO**, or set by the CPU with no roll (as in 8.2.3) if the CEO delegates.
- **Other seats.** Chair, General Counsel and Independent Directors add an **advisory note** (a takeover defense, a legal risk, a holder's mood) but own no item **(A)**.
- **How a suggestion is made.** AI members suggest by skill and traits (10.5.3): a Greedy CFO hoards cash, an Ambitious CMO overshoots demand, a Cautious CTO leases. A skill roll sets how close the suggestion is to the engine's best plan **(A)**; that roll counts toward next quarter's grade.

### 21.4.5 Edit rights by grade

Logan: "You can only make a change if the grade that you got was higher than the grade the other character got."

- The player may change a plan item only if **his grade is strictly higher** than the grade of the member who suggested it (ties do not allow edits, **A**).
- Comparison is by the number, not the letter **(A)**.
- An item suggested by the CEO (because its seat was empty) can be edited only if the player beats the CEO's grade.
- Items the player cannot edit he can still argue: a Persuasion check against the member asks them to change it themselves (one try per item, **A**).

### 21.4.6 Lock order

Logan: "Then you lock in your plan. This is assuming you are the COO. Then the CEO can change whatever they want, unless they are just a figurehead and then they have to change it to whatever the real head wants."

1. **The plan runner locks.** The **COO** runs the meeting and locks the plan (Logan). With no COO, the CEO runs it **(A)**.
2. **The CEO's pass.** The CEO may change **any item** with no grade check.
3. **Figurehead CEO.** If the CEO is a figurehead (1.3.1), the changes are the **real controller's** wishes: the AI controller's preferences by traits, or the player's choices if the player is the real controller. The board sees only the CEO's name on the changes; the true author is a secret (1.1.8.2).
4. **Parent override.** For a subsidiary, the parent may then override the locked plan with a directive (10.0.8), at its loyalty cost.

**When the player holds another seat (A).**

| Player is | What he does |
|---|---|
| COO | Edits by grade, locks the plan (Logan's case) |
| Another seat | Makes his own seat's suggestion and edits others by grade; an AI COO locks |
| CEO | Makes the CEO's pass with no grade check (and the empty-seat suggestions) |
| Real controller behind a figurehead CEO | Makes the CEO's pass through the figurehead, even with no seat |
| Controller on the books only, or a holder | Sees the locked plan afterward (if he has intel or a seat), and can force votes through 1.9 |
| Parent company's head | Can override by directive (10.0.8) |

**AI companies run the same chain silently** (21.7).

## 21.5 The locked quarter

Logan: "Once the plan is locked in this will be what the company does for the remainder of the quarter."

- **Fixed (A).** Growth and R&D plans, the station mix, scheduled financing and the quarter's schemes run as locked until the next meeting. The player cannot change them by hand. Only events can (a crisis event may offer a forced change), and a parent can override a subsidiary at its loyalty cost.
- **Old plan until the lock (A).** From the 2nd to the lock, the previous quarter's plan keeps running.
- **Growth plan.** 10.0.2 calls it a yearly target; it is now set each quarter as an **annual rate** applied for that quarter **(A)**.

### 21.5.1 Projections in ranges

Logan: "Since we already know the plan we can already get the results, but they should be shown to the player in wide ranges of certainty."

- The engine projects the quarter from the locked plan, demand and costs, and shows **revenue, net income and EPS** as a range around that projection.
- **Width (T)**: `±30% × (1 - 0.6 × share of the quarter elapsed) × (1 - viewer's Finance ÷ 50) × 0.7 if the viewer has Pdoomberg × 0.8 with an informant on the board`, never under ±3%.
- **Others' companies.** Their plans are secret: without intel on the plan (1.1.8.2) the range uses analysts' consensus and is twice as wide **(A)**.
- **Events** that land in the quarter shift the projection; the range does not narrow for them.

### 21.5.2 Scheme events

Logan: "Based on schemes picked, various events will befall the company, some can be ongoing through many quarters." Each scheme in the plan runs by 1.1.8 and draws its events from the matching decks (Company, Hooks, Hacking, Media) **(A)**. A scheme that is still running at the next meeting carries over and keeps its labor unless the new plan drops it. Discovery during the quarter feeds the CIO's grade.

### 21.5.3 Past results and the projections screen

The company's **Financials** tab (20-ui 20.7.2) gains a **Quarter** view with two columns: **last quarter's reported results** and **this quarter's projection** as ranges, with the locked plan listed beside them and the days to the next pre-quarter-end week.

## 21.6 Pre-quarter-end week

Logan: "At one week before the end of a quarter the game is paused and then the pre quarter end event start and the player is locked out of trading stocks."

### 21.6.1 Pause and lockout

- **Auto-pause** at 00:00, 7 days before the next release (21.1). The Quarterly recap alert is locked on Pause **(A)**.
- **The player cannot trade any stock** until 00:00 on the 2nd (Logan: "locked out of trading stocks"; **A**: read as every stock, not just his companies). Open orders are suspended. Forced sales from margin calls (3.5.4) still execute.
- **Named AI characters (A).** Every executive, board member and 10%+ holder of a company is locked out of that company's shares, as the old blackout did (3.1.0). Fairness with the player's wider lock is an open question (21.9).
- **Companies** cannot run buybacks or offerings in the week **(A)**.
- **Prices keep moving.** Archetype order flow (3.3.4) and news run as normal, so hype and softening work through the market while insiders sit still.
- This **replaces the old 7-day insider blackout** of 3.1.0; it starts on the same day.

### 21.6.2 The recap opens the week

The old **quarterly recap screen** (3.1.0, 20-ui 20.7.9) is the **opener** of the week: anticipated earnings (as a range, 21.5.1), the expected market reaction, the effect on investor confidence, the company outlook, and the guidance choice. Then the daily events begin.

### 21.6.3 One event per member per day

Logan: "Each board member has one of these events for each day of the 7 days this week."

- Each day at 00:00 every board member offers **one event** for each company where the player sits. They come as one **board day** card per company: one row per member, each with 2 to 3 options and its skill icon, plus "Pass" **(A)**, so the week does not become 35 separate pop-ups. The director's no-pile-up rule (13.3) does not apply.
- The player answers his own row; AI members' rows resolve by their traits, but the player can **ask** a member to pick another option (Persuasion check) or veto it if he is the CEO or controller **(A)**.
- Every roll counts toward next meeting's grade (21.4.1).
- The four kinds of event (Logan): **hype**, **soften the blow**, **gather support to raise money**, and **pass events for temporary boosts for the next X quarters**.

**How they work (T).**
- **Hype** raises the price over the week (a drift of the stated %) and raises consensus by **half** that amount, so a hyped stock needs a bigger beat. If the result misses anyway, the miss jump is ×1.5.
- **Soften the blow** cuts the size of a negative surprise jump on the 2nd by the stated % (stacking to at most 60%), and fails noisily on a bad roll (Buzz -10).
- **Support to raise money** gives the next quarter's financing a bonus: a lower bond spread, a bigger credit line, or a smaller discount on an offering (3.4.3).
- **Boosts** last a set number of quarters and are shown as timers on the company screen.

### 21.6.4 Example events per seat (T effects)

| Seat | Kind | Event | Effect on success **(T)** | On failure **(T)** |
|---|---|---|---|---|
| CEO | Hype | *Fireside Chat* (Persuasion) | Price drift +3% over the week | Buzz -5 |
| CEO | Soften | *Letter to Shareholders* (Persuasion) | Negative jump -20% | Investor confidence -2 next quarter |
| COO | Boost | *Operations Push* (Operations) | Productivity +2 for 2 quarters | Productivity -1 for 1 quarter |
| COO | Hype | *Plant Tour for Analysts* (Operations) | Consensus +2%, price drift +2% | Disaster rumor: price -2% |
| CFO | Soften | *Whisper Number* (Finance) | Consensus -3% before release | Consensus unchanged, Buzz -10 |
| CFO | Money | *Line Up the Banks* (Finance) | Credit line +10% and bond spread -0.25% next quarter | Rating watch |
| CMO | Hype | *Product Teaser* (Persuasion) | Buzz +15, price drift +2% | Buzz -10 |
| CMO | Boost | *Influencer Blitz* (Persuasion, costs cash, 16) | Investor confidence +1 for 2 quarters | The campaign flops (16 event) |
| CTO | Hype | *Demo Day* (Tech) | Price drift +4% in Tech industries, +1% elsewhere | Servers crash: Buzz -15 |
| CTO | Boost | *Roadmap Reveal* (Tech) | R&D effect ×1.05 for 3 quarters | None |
| CIO | Soften | *Plant a Story* (Intrigue, needs an outlet, 16) | Negative jump -25% | Discovered: Heat +10 |
| CIO | Hype | *Leak a Rival's Weak Numbers* (Intrigue) | Rival's price -3% and yours +1% | A discovered scheme (1.1.8) |
| Chair | Money | *Call the Big Holders* (Persuasion) | Offering discount halved next quarter; bloc loyalty +5 | A holder joins a faction (1.9.1) |
| General Counsel | Soften | *Lawyer the Disclosure* (Finance or Intrigue) | One bad item ignored by the market | Regulator suspicion +10 |
| Chief Strategy Officer | Hype | *Tease a Deal* (Persuasion) | Price drift +3%; must announce a deal within 2 quarters or lose confidence -3 | Buzz -10 |
| Independent Director | Boost | *Lend the Name* (Persuasion) | Management score +2 for 1 quarter | None |

Because the player cannot trade in this week, hype helps what he already holds; he cannot buy into his own hype (21.6.1).

## 21.7 How AI companies run the cycle

- **Every company runs the same cycle** on the same dates (fair AI, 12-setup). Only proximity (21.3.3) changes what the player sees.
- **Reaction week.** AI holders trade on their weekly cadence; result plot lines resolve by traits and rolls.
- **Board meeting.** Grades, performance scores and firing votes run in full. Suggestions come from members' skills and traits; the COO (or CEO) locks and the CEO or real controller makes the final pass, by traits. No cards are shown.
- **Pre-quarter-end week.** Each AI member picks one event a day by traits (a Greedy CEO hypes, a Cautious CFO softens) and rolls it.
- **Performance (A).** Off-screen companies resolve the chain in one batch at 00:00 on the 9th, and their pre-quarter-end events in one daily batch, like off-screen events in 13.4.
- **What the player learns.** Firings are public (a story in the News feed); plans and grades are secret, learned by intel or an informant on the board.

## 21.8 UI touchpoints

| Where | What | Link |
|---|---|---|
| Alert row | **Earnings day** at 00:00 (Pause); **Board meeting** at the end of reaction week, one per company where John sits (Pause, locked, **A**); **Quarterly recap** opens the pre-quarter-end week (Pause, locked, **A**); **Board displeasure** at 50+ (Notify, **A**) | 20-ui 20.4.1 |
| Top bar | A **quarter clock**: the phase name and days to the next phase; a lock icon on trading during the pre-quarter-end week **(A)** | 20-ui 20.2.1 |
| Company screen, Board tab | Seat cards show grade letter, performance score and the player's displeasure; next meeting date | 20-ui 20.7.2 |
| Company screen, Financials tab | The Quarter view: past results and projections as ranges, with the locked plan | 20-ui 20.7.2, 21.5.3 |
| Event modal | The board meeting chain and the board day cards use the split screen; the right panel shows the plan, grades and projections | 20-ui 20.4.3 |
| Quarterly recap | Opens the pre-quarter-end week | 20-ui 20.7.9 |
| Pdoomberg | Earnings for every company at 00:00; order ticket shows "Fills at pre-release price" during the window, and "Locked until 2 Apr 00:00" in the pre-quarter-end week | 3.13.1, 20-ui 20.5.2 |

## 21.9 Assumptions

1. Quarter start is the release and quarter end is the next release; the pre-quarter-end week is the 7 days before the 2nd (21.1).
2. The board meeting chain fires at 00:00 on the 9th; the old plan runs until the lock (21.1, 21.5).
3. Window limits: pre-release fills, 5% of ADV, AI holders get the window too; 1 January orders fill in the window (21.2).
4. Overreaction factor, reversion and volatility (21.3.1); the result types and plot lines (21.3.2); the proximity tiers (21.3.3).
5. Board displeasure: the trades, values, thresholds and decay (21.3.4).
6. Grading formula, criticals, seat results and letter bands (21.4.1).
7. Performance score start, changes by grade, A grades restoring slowly (21.4.2).
8. Firing threshold 40, the vote's lean bonus and plea; the plan runner nominates and the controller approves (21.4.3).
9. The five plan items; CIO = Chief Intelligence Officer (the renamed Head of Security); CMO a new seat absorbing Head of IR or PR; Logan's second "CTO" read as the CFO; R&D from the Chief Strategy Officer, else the COO; empty seats fall to the CEO (21.4.4).
10. Edits need a strictly higher grade, compared by number; one Persuasion appeal per item (21.4.5).
11. The plan runner is the COO, else the CEO; how the chain works when the player holds other roles (21.4.6).
12. Growth plan set per quarter as an annual rate (21.5).
13. Projection range formula (21.5.1).
14. The player's lockout covers every stock; named AI insiders are locked only from their own companies; no buybacks or offerings in the week (21.6.1).
15. Board day cards with one row per member; event effects (21.6.3, 21.6.4).
16. AI batching and the new alerts and quarter clock (21.7, 21.8).
