# 1. Companies and corporate feudalism

## 1.1 Founding a company

There is no special founder charter. Instead, any character with the means can take the **Found Company** action, and **how** the company is founded decides which **event chain** the player goes through. The founding path shapes the company's starting cap table, board, debts, obligations and reputation.

Choosing to found a company sets: a name, a sector, a home hub (see [05-map-and-influence.md](05-map-and-influence.md)), a target amount of starting capital, and a founding path.

### Founding paths

| Path | Requirements | Event chain | Typical outcome |
|---|---|---|---|
| **Venture Capital** | A pitch (sector, plan), Influence or Tech skill helps | Pitch meetings with VC firms, then funding rounds: Pre-seed, Seed, Series A, B, C. Each round is a set of meetings and a term-sheet event. | Lots of capital, heavy dilution, VC partners take board seats, growth targets with penalties if missed, possible IPO pressure |
| **Ask Daddy** | A parent (or close relative) with wealth and connections | Go around asking your father's friends, old business partners and family allies for money. Each meeting is an event shaped by their opinion of you and your father. | Modest capital, investors are family allies who join your bloc, but you owe favors (hooks over you) and your father's reputation is tied to yours |
| **Bootstrap** | Personal cash | Short chain: first hires, first customer, first crisis | Full ownership and control, little capital, slow growth |
| **Bank Loan** | Collateral (personal or trust assets) or good reputation | Loan officer meetings, collateral review, covenant terms | Full ownership, a debt with monthly payments and covenants; default can lose the collateral |
| **Freestyle** | Any mix | The player combines sources: own cash, a loan, a few angel investors, crowdfunding, a partner company | Flexible cap table; each source brings its own small chain |
| **Political Connections** | Enough political influence in a jurisdiction | Leverage connections in the government: state development grants, a government contract, a state bank loan, a sovereign fund stake | Cheap capital and a guaranteed first customer, but the government becomes a stakeholder (golden share or permanent board seat) and you owe political favors |

Design notes:
- Each path is a **data-driven event chain** (see [10-events.md](10-events.md)) so new paths can be added without code.
- Outcomes are not fixed: a great pitch can land a dream VC; offending a father's friend can turn them into a rival.
- The founder starts as President and CEO under the standard charter as long as they keep majority voting control, directly or through a bloc.
- A company can also be founded **by another company** (see 1.4): the parent company is the founder and the new company starts as its vassal.

### Funding rounds (VC chain in detail)

| Round | Typical raise | Dilution | Strings |
|---|---|---|---|
| Pre-seed | Small | 5-10% | Angel or accelerator joins cap table |
| Seed | Small to medium | 10-20% | First VC board observer |
| Series A | Medium | 15-25% | VC board seat, growth milestones |
| Series B | Large | 10-20% | Second VC seat, preference shares |
| Series C+ | Very large | 10-15% | Pressure to IPO or sell; down rounds possible |

Missing a milestone triggers events: a down round, a VC-led faction to replace the founder, or a forced sale.

## 1.2 The corporate charter

Every company has a **charter**: its constitution, which decides who the head (or heads) of the company are and how they are chosen.

**Standard charter** (default, used by most companies):
- The head is the **President and CEO**.
- The head is the holder of a majority of the voting stock, or the leader of the bloc that controls a majority (see 1.4). If the controlling holder is a company or trust, its own head appoints the President and CEO.

Other charter types:

| Charter | Head(s) | Effect |
|---|---|---|
| **Standard** | President and CEO | Clean, contestable |
| **Dual Leadership** | Executive Chair plus CEO | Split authority, built-in rivalry |
| **Board-Governed** | Board elects the CEO by majority | No single owner; board politics decide everything |
| **State-Linked** | Government holds a golden share and veto | Common for Political Connections foundings and branch offices |

Dual-class shares (see 1.3) give founders lasting control without a special charter. Changing a charter needs a two-thirds shareholder vote.

## 1.3 The ownership graph

The world is a directed graph of **holders** (family trusts, personal trusts, characters, companies, funds, governments) connected by **stakes**.

- A stake is `{holder, company, shares, share_class}`.
- Share classes: **A** (10 votes per share), **B** (1 vote per share), **N** (non-voting, economic only), **P** (preferred: priority dividends and liquidation, no vote; used by VCs).
- **Control**: a holder controls a company when its votes (direct, plus votes of companies it controls, plus its bloc's votes if it leads the bloc) exceed 50%.

## 1.4 Blocs

A **bloc** is a group of holders who vote their shares together in one company.

- **Leadership:** the member holding the **most shares in the bloc** leads it. Ties go to the longest-standing member.
- The bloc votes as one under its leader. If its combined votes exceed 50%, the leader is the company's head under the standard charter.
- Holders join or leave blocs based on opinion of the leader, shared dynasty, payments and hooks. A defection can flip control overnight.
- Members can buy shares to take over leadership of their own bloc: a quiet coup.

## 1.5 Vassals

**Vassals are held by a company.** A vassal is a company that another company founded or owns a controlling stake in. The parent company is its liege; the parent's head appoints the vassal's CEO and some of its board, depending on the vassal contract.

Trusts and characters do not hold vassals directly. They hold stakes in companies; companies hold vassals. This gives the classic chain: dynasty → family trust → flagship company → vassals → their vassals.

### Vassal types

| Type | Purpose | Key mechanics | Risks |
|---|---|---|---|
| **Subsidiary** | A separate company owned by its parent; the default vassal | Own CEO and board, pays dividends (tribute) up, can own its own vassals | Disloyal CEO, factions, spin-off attempts |
| **Branch Office** | Do business in a country whose government restricts foreign companies (for example China) | Registered in the host country; host law may require a local partner stake, golden share or local directors; unlocks that country's market and hubs | Host government pressure, forced tech transfer, seizure or nationalization; local partner may become a rival bloc |
| **Shell Company** | Money laundering, extra-legal activity, tax avoidance | Hides ownership from rivals until investigated; routes income to low-tax jurisdictions; holds dirty cash from schemes | Investigations and leaks: reputation loss, fines, frozen assets |
| **Joint Venture** | Shared project with another company | Control split by contract; both parents appoint directors | Deadlock, partner betrayal |
| **Front Company** | Legitimate cover for criminal or netrunning operations | Generates clean-looking income; hosts black-market activity | Raids, exposure, criminal charges |
| **Franchise** | License the parent's brand | Pays royalties, minimal control | Brand damage from franchisee scandals |
| **Captive Bank / Insurer** | Financial vassal that lends to or insures the group | Cheap internal credit | Regulators, contagion in a crash |

### Vassal relations

- **Loyalty** (-100 to 100): from the vassal CEO's opinion of the liege's head, tribute burden, autonomy, shared dynasty.
- **Autonomy level**: *Wholly Integrated*, *Managed*, *Arm's Length*, *Independent Listing*. More autonomy, less tribute and control, more loyalty and growth.
- **Vassal contract**: tribute rate (dividends and management fees), board seats, veto rights, non-competes.

Disloyal vassals can form factions with minority holders, start proxy fights, attempt a spin-off (management buyout or IPO), or invite a rival to buy them.

### Company ranks

| CK3 analogue | Rank |
|---|---|
| Emperor | **Conglomerate** |
| King | **Megacorp** |
| Duke | **Corporation** |
| Count | **Company** |
| Baron | **Venture** |

Rank comes from company value and sets how many vassals it can manage without penalties.

## 1.6 The CEO and the board (the council)

Every company has a **CEO** and a **board**. **The board works like the CK3 council.**

- The head under the charter (normally the President and CEO) leads the board.
- Seats are filled by shareholder vote, so the controlling bloc fills most; minority blocs and VCs can hold seats.
- Each seat takes a **task**:

| Seat | Example tasks |
|---|---|
| **Chair** | Manage shareholders, prepare votes |
| **CFO** | Optimize capital, manage debt, prepare acquisitions |
| **COO** | Grow operations, integrate vassals, cut costs |
| **General Counsel** | Defend against takeovers and lawsuits, enforce contracts, fabricate claims |
| **Head of Security** | Uncover schemes, protect executives, counter-espionage |
| **Chief Strategy Officer** | Market expansion into new hubs, government relations |
| **Independent Director** | Lends reputation; can side with minority blocs |

Unhappy board members stall tasks, leak to rivals, and on a Board-Governed charter can vote the CEO out. Quarterly **board meetings** are events where agendas are voted on (see [09-time-and-turns.md](09-time-and-turns.md)).

## 1.7 Factions

Factions are blocs with a demand: **Activist** (more dividends or a breakup), **Independence** (spin the vassal out), **Claimant** (install a specific head), **Founders'** (restore a family's control), **VC** (sell or IPO now). When a faction's voting power crosses a threshold it issues an **ultimatum**; refusal triggers a **proxy fight**.

## 1.8 Casus belli and takeovers

Hostile moves need a justification, or they cost reputation and draw regulators.

| Casus belli | Gained by |
|---|---|
| **Undervaluation** | Market value below asset value |
| **Claim** | A family member or board member has a legitimate claim |
| **Breach of contract** | Target violated a deal |
| **Strategic synergy** | Same sector, supply chain or hub |
| **Fabricated scandal** | Successful scheme |
| **Defensive** | Target attacked you or your vassal |

Takeover tools:
- **Tender offer**: buy shares on the exchange and from holders. Progress toward control is the war score.
- **Bloc poaching**: persuade, pay or blackmail members of the target's controlling bloc.
- **Proxy fight**: a scheduled shareholder vote; both sides spend influence on swing holders.
- **Leveraged buyout**: borrow against the target's own assets.
- **Defenses**: poison pill, staggered board, white knight, crown-jewel sale, charter change.

Antitrust and foreign-investment review (see [08-politics.md](08-politics.md)) can block or delay takeovers.

## 1.9 Company lifecycle

Founded → private → (IPO on an exchange, see [07-markets.md](07-markets.md)) → public → possible delisting, merger, spin-off, bankruptcy (restructuring or liquidation; creditors take control), or nationalization.
