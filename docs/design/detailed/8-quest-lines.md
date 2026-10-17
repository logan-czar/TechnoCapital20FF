# 8. Quest lines: detailed design

_Status: draft v0.1 (2026-10-17), **on hold**: Logan wants the economy, corporations, investing, and character stats and personalities fleshed out before scenarios and quest lines, which come last. Built from Logan's answers in the design Q&A. Sets the arc rules, the default starting quest line every character gets for now, and the first full quest line: Pieter Von Floop. Builds on [10-events.md](../10-events.md) 10.4 (quest rules), [7-starting-world.md](7-starting-world.md) (characters), [1-corporate-core.md](1-corporate-core.md), [3-markets-and-fx.md](3-markets-and-fx.md) and [6-technocapital.md](6-technocapital.md). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 8.5.

---

## 8.1 Arcs

A quest line is made of **arcs** (Logan's word; not chapters).

| Rule | Decision (Logan) |
|---|---|
| Structure | The number of arcs, their length and their story structure vary by character. |
| Concurrency | Arcs can run at the same time. |
| Outcomes | Each arc ends in one of several outcomes. Each outcome gives a **stat buff** (skills or character resources); better outcomes give better buffs, and bad outcomes can give worse ones or penalties. |
| Steps | Inside an arc, the player sees only the next step ([10-events.md](../10-events.md) 10.4). Failure branches into new quests. |
| The crash | The AI bubble pops in **2030 on average**. The actual year varies by a few years with RNG and the outcome of some events in the game (8.4). Quest lines are built so a crash arc can open whenever it hits. |

**Outcome tiers (A).** Most arcs use three tiers: **Strong**, **Mixed** and **Poor**. As a guide, Strong gives +2 to one skill and a clout gain, Mixed gives +1 to one skill, Poor gives a lasting penalty or a negative trait **(T)**.

## 8.2 Default starting quest line (all characters, placeholder)

Until each character has their own quest line, every starting character gets this default line (Logan): a tutorial-like opening, then **milestones** the character must hit to progress. Ricky Feng uses it too, but still starts with his compute in Asia and his bot farm SaaS (7.3.1).

### 8.2.1 Opening arcs (tutorial)

| Arc | Teaches | Steps |
|---|---|---|
| **The Shot** | Quests, rolls, travel | Get the vaccine or a doctor's note ([7-starting-world.md](7-starting-world.md) 7.6). Unlocks travel and gives the LLM tip. |
| **Take Stock** | Character screen, resources, strata | Open your holdings; check your stratum and what the next one needs; meet one contact. |
| **First Moves** | Hours, actions, money | Make one trade or investment; hold one meeting; set a monthly budget for your personal account. |
| **Your People** | Opinion, relationships, successors | Befriend one character; name a successor in your will (1.11.0). |

The opening arcs run back to back and take the first few months of 2022 **(T)**.

### 8.2.2 Milestones

After the opening arcs, progress comes from milestones. Each milestone hit unlocks the next one and gives a small outcome buff **(A)**.

| # | Milestone | Example ways to hit it |
|---|---|---|
| 1 | **Own something that earns** | Found or buy into a company; buy a rental property; take a board seat |
| 2 | **Climb a stratum** | Meet the bar for the next stratum (2.8.0) |
| 3 | **Be known** | Reach a Fame threshold in one hub |
| 4 | **Hold power** | Control a company, win an office, or lead a bloc |
| 5 | **Ride the boom** | Hold a stake or Techno-Capital in the AI supply chain when the tipped lab's breakthrough lands |
| 6 | **Survive the crash** | Come out of the crash (8.4) in the same stratum or higher |

## 8.3 Pieter Von Floop: "Holding It Together"

**Who he is.** 24, sole heir to the family's lithography machine empire in Eindhoven, the only maker of EUV tools in the world ([6-technocapital.md](6-technocapital.md) 6.2). The monopoly is easy to run and he has been a boy scout his whole life. His father's health is starting to turn. The family trust is swelling, but Pieter worries he will crack holding together what his father built.

**What the line teaches.** The ins and outs of running a massive publicly traded company and managing your wealth (Logan): the board, earnings and investors, operating a monopoly, the family trust and succession, defending control, and surviving the crash.

**Starting position (A).**
- **The company**: Von Floop Lithography, a Megacorp listed in Amsterdam. The family controls it through a bloc: the family trust holds 22%, a family foundation 8%, and a friendly pension fund 6% **(T)**.
- **Pieter** is Chief Strategy Officer and a board member; his father, Willem Von Floop, is President and CEO and leads the bloc.
- **Traits**: Honest, Diligent, Anxious. Stress builds when he acts against Honest **(A)**.
- **Wealth**: a personal account of $40M and a beneficiary share of a family trust worth about $9B **(T)**.

**How the arcs run.** Arc 1 opens at the start. Arcs 2 and 3 open after Arc 1's second step and run together. Arc 4 runs in the background from the start and moves as Willem's health declines. Arc 5 opens on a trigger. Arc 6 opens when the crash hits.

### Arc 1: The Keys (company administration basics)

| Step | Goal | Teaches |
|---|---|---|
| 1 | Sit in on the quarterly board meeting and vote on its agenda | Board meetings and votes (1.8.4) |
| 2 | Willem asks Pieter to fill the open CTO seat: interview candidates and nominate one | Board seats and seat tasks (1.8.1, 1.8.2; the CTO seat in [6-technocapital.md](6-technocapital.md) 6.10) |
| 3 | Set every seat holder's task for the quarter | Seat tasks and their effects |
| 4 | Win the yearly shareholder meeting: re-elect the board slate | Blocs and elections (1.4, 1.8.1) |

**Outcomes.** Strong: slate elected with board opinion of Pieter at +20 or higher; +2 Operations. Mixed: slate elected; +1 Operations. Poor: an outsider wins a seat; the board starts at -10 opinion of Pieter.

### Arc 2: The Quarter (running a public company)

| Step | Goal | Teaches |
|---|---|---|
| 1 | Report the first quarter's earnings and set guidance | Fundamental value and news shocks ([3-markets-and-fx.md](3-markets-and-fx.md) 3.3.1, 3.3.6) |
| 2 | Set the dividend policy for the year | Dividends (3.4.6) and how AI holders react (3.4.9) |
| 3 | Decide on a buyback with the cash pile | Buybacks (3.4.4) |
| 4 | Answer a short seller's report that calls the monopoly fragile | Short reports and squeezes (3.5.2, 3.5.3) |
| 5 | A friend offers a tip about a customer's order; refuse it or trade on it | Insider trading rules (3.10). Trading on it goes against Honest |

**Outcomes.** Strong: the share price beats the sector over the arc and nobody is investigated; +2 Finance. Mixed: +1 Finance. Poor: the short report sticks or an insider investigation opens; -10 Favor.

### Arc 3: The Order Book (operating the monopoly)

| Step | Goal | Teaches |
|---|---|---|
| 1 | Allocate the year's EUV output (about 4 tools a month) among fab builders | Lithography tools and the Allocation Score ([6-technocapital.md](6-technocapital.md) 6.2, 6.7.3) |
| 2 | Renew service contracts across the installed base | Lithography service (6.2) |
| 3 | October 2022: the export controls land. Decide how to handle Chinese customers' service | Export controls and the service cut-off (6.9.1) |
| 4 | Secure precision optics supply from the German supplier | The supply Stack (6.7.1) |
| 5 | Fund the High-NA program | Generations and research (6.4) |

**Outcomes.** Strong: High-NA ships on schedule and no customer is lost to a rival effort; +2 Tech and a large clout gain. Mixed: +1 Tech. Poor: a Lithography R&D project to break the monopoly gets funded somewhere (6.6), with Pieter's company blamed.

### Arc 4: Father's Estate (managing wealth)

Runs in the background. Each step opens when Willem's health drops a level **(A)**.

| Step | Goal | Teaches |
|---|---|---|
| 1 | Willem asks Pieter to review the family trust's rules with the family's lawyers | Family trust rules (1.10.1) |
| 2 | Set up Pieter's own personal trust and investment accounts | Accounts and yields (1.10.2) |
| 3 | Decide whether to use havens and shells, as the family's advisers suggest | Shell companies (1.7.4). Using them goes against Honest |
| 4 | Willem names his successor as CEO; Pieter must win the board's backing | Charters and heads (1.5) |
| 5 | Willem dies (the timing varies). Handle the will, the trust and the succession shock | Succession (1.11) |

**Outcomes.** Strong: Pieter becomes President and CEO with the bloc intact; a large clout gain. Mixed: CEO, but the bloc loses a member. Poor: the board appoints an outsider CEO and Pieter stays as a director.

### Arc 5: Hold the Line (defending control)

Opens when someone builds a stake past a disclosure line, or when a rival from the rival rotation is aimed at Pieter **(A)**.

| Step | Goal | Teaches |
|---|---|---|
| 1 | Find out who is buying | Disclosure thresholds (3.4.8) |
| 2 | Shore up the bloc: persuade holders or buy shares | Blocs (1.4) |
| 3 | Fight the activist's proxy campaign or tender offer | Proxy fights and tender offers (1.9.2, 1.9.3) |
| 4 | Choose defenses | Takeover defenses (1.9.4) |

**Outcomes.** Strong: the raider is beaten and sells at a loss; +2 Influence. Mixed: Pieter keeps control but gives up a board seat. Poor: Pieter loses control of the company.

### Arc 6: The Crack (the crash)

Opens when the crash hits (8.4). Demand for new fabs collapses and the order book empties.

| Step | Goal | Teaches |
|---|---|---|
| 1 | Cut costs without breaking the company | COO tasks, layoffs and strikes ([2-map-influence-economy.md](2-map-influence-economy.md) 2.8.6) |
| 2 | Refinance before the bonds come due | Ratings and default ([3-markets-and-fx.md](3-markets-and-fx.md) 3.6) |
| 3 | Keep stress under control | Stress (1.1.5) |
| 4 | Decide whether to buy distressed rivals and customers at the bottom | Acquisitions and vassals (1.7) |

**Outcomes.** Strong: the company survives intact and grows at the bottom; +2 to the skill used most in the arc and a large clout gain. Mixed: survives smaller. Poor: Pieter cracks: a stress breakdown event and a negative trait.

## 8.4 The crash

The AI bubble pops in 2030 on average (Logan). The year is set at game start as 2030 plus a roll of -2 to +2 years **(T)**, then moved by events: a bigger boom (high AI valuations, heavy leverage) brings it closer, and calmer markets push it later **(A)**. When it hits, every quest line with a crash arc opens it.

## 8.5 Assumptions and open items

1. Outcome tiers and buff sizes in 8.1.
2. The default line's opening arcs and milestones in 8.2.
3. Pieter's starting position: company name, stakes, traits and wealth.
4. Arc 4 steps open on Willem's health levels.
5. Arc 5's trigger.
6. Crash timing: 2030 plus a roll of -2 to +2 years, moved by events.
