# 14. Game stages

A playthrough moves through stages, like CK3's growth from count to emperor or Victoria 3's rise from minor to great power. Each stage changes the player's **scale**, **goals**, **threats** and **unlocked tools**. Stages are tied to the dynasty's standing (see [02-trusts-and-assets.md](02-trusts-and-assets.md)), not to the calendar, so a fast player can climb quickly and a ruined dynasty can fall back down.

## 14.1 Overview

| Stage | Standing tier | Player scale | Core question |
|---|---|---|---|
| **1. The Heir** | Investor | One character, a small personal account, a share of the family trust | Can you get started? |
| **2. The Founder** | Investor to Magnate | One company you lead, a few employees and investors | Can you build something that survives? |
| **3. The Climber** | Magnate to Mogul | A company with vassals, a board, a bloc to manage | Can you hold control while you grow? |
| **4. The Tycoon** | Mogul to Tycoon | A conglomerate across several hubs and countries, public on an exchange | Can you dominate markets and outlast rivals? |
| **5. The Oligarch** | Oligarch | A dynasty that moves currencies and governments | Can you rule without ruling, and survive the backlash? |

Succession can happen in any stage. An heir inherits the dynasty's current stage, but low opinion and lost blocs can knock the dynasty down a stage.

## 14.2 Stage 1: The Heir

**Start state:** the player is a young adult (18 to 25) in a wealthy family. A parent is the dynasty head and trustee; the player has a personal account, a small trust allowance, education traits and a few relationships.

**Goals:**
- Earn standing in the family (opinion of the head, a seat at the family table).
- Build skills and contacts: school, first job, mentors.
- Gather starting capital and choose a founding path.

**Tools unlocked:** personal trading, Befriend and Mentor schemes, family events, the Found Company action (with every founding path the player qualifies for).

**Threats:** siblings competing for the head's favor, scandals, a parent who disapproves of your plans, dying young (cyberware accidents, overdoses).

**Exit:** found or take over a company, or inherit the trust early.

**Length target:** short (1 to 3 in-game years), mostly event-driven. Fast-forward heavy.

## 14.3 Stage 2: The Founder

_Full design: [stages/2-the-founder.md](stages/2-the-founder.md)._

**Start state:** the player is President and CEO of one company, freshly founded through a founding path event chain (see [01-companies.md](01-companies.md)).

**Goals:**
- Reach product-market fit and positive cash flow.
- Keep majority control through funding rounds or debt.
- Hire a board and executives you can trust.

**Tools unlocked:** board seats and tasks, funding round chains, bank loans, first facilities in the home hub, basic hub influence.

**Threats:** running out of cash, VCs forming a faction to replace you, a co-founder betrayal, covenants on a bank loan, Ask Daddy investors calling in favors, a bigger rival copying your product.

**Exit:** company reaches Company rank and either founds or buys its first vassal, or the player is ousted (back to Heir or to another role in the family).

**Length target:** medium (3 to 8 years).

## 14.4 Stage 3: The Climber

**Start state:** a Company or Corporation with one or more vassals, a real board and a bloc holding control.

**Goals:**
- Expand into new hubs and the first foreign country (branch office).
- Build vassals: subsidiaries for growth, shells for tax and secrecy.
- Prepare an IPO or stay private with patient capital.
- Arrange a strategic marriage and secure heirs.

**Tools unlocked:** vassal types and contracts, takeovers and casus belli, proxy fights, real estate across hubs, IPO chain, regional political influence, temporary influence campaigns.

**Threats:** disloyal vassal CEOs, bloc defections, first takeover attempts by larger players, regulators noticing your shells, a succession in your own family splitting the trust.

**Exit:** company reaches Megacorp rank, or the dynasty controls several large companies through the family trust.

**Length target:** long (10 to 25 years). The core of the game.

## 14.5 Stage 4: The Tycoon

**Start state:** a Megacorp or Conglomerate, public on at least one exchange, with operations in several countries.

**Goals:**
- Control key supply chains end to end (vertical integration).
- Dominate sectors and indices; set prices in some goods markets.
- Gain national-level political influence and win government contracts.
- Keep the dynasty together across at least one succession.

**Tools unlocked:** commodity cornering, FX positions and carry trades, national lobbying, running family members for office, PMCs, antitrust games, bailout negotiations.

**Threats:** antitrust breakups, activist investors, rival dynasties allying against you, currency crises in your markets, sanctions on countries where you have branch offices, heirs fighting over a fortune large enough to split into rival houses.

**Exit:** dominant influence (Kingmaker tier) over a country or several major hubs.

**Length target:** long (20 to 40 years, usually across one or two heads).

## 14.6 Stage 5: The Oligarch

**Start state:** a dynasty with Kingmaker influence in at least one country, holdings across continents, and the power to move markets.

**Goals (endgame objectives, pick one or more):**
- **Corporate sovereignty:** turn a hub into a charter city run by your company (see [08-politics.md](08-politics.md)).
- **Kingmaker:** install governments in several countries.
- **Market maker:** control a currency peg, a central bank, or a global exchange.
- **Immortal dynasty:** hold the family trust for a set number of generations, possibly with digital consciousness.
- **Score:** highest renown and trust value at the end date.

**Tools unlocked:** coups and regime change, attacks on currency pegs, founding private banks that act as central banks for your hubs, digital consciousness.

**Threats:** popular revolutions, nationalization waves, global crises, all other dynasties uniting against you, internal collapse of an overextended family.

**Exit:** game end, or a collapse back to a lower stage.

## 14.7 How stages change the UI and pacing

- **Panels unlock with stages** so a new player is not shown FX desks in their first hour. Early stages focus on the character and family screens; later stages bring the map, markets and politics forward.
- **Turn pacing:** early stages have more personal hourly decisions (meetings, pitches); later stages lean on auto-advance with alerts, since the dynasty acts through boards and delegates.
- **AI rivals scale** with the player's stage: Heirs face siblings and classmates; Tycoons face megacorps and governments.

## 14.8 Alternative starts

- **Self-made start:** no wealthy family, so no Ask Daddy path, but a "Street-Taught" trait and better fixer contacts.
- **Inherited empire start:** begin in Stage 4 as a new head right after a succession crisis.
- **Hostile scenario starts:** for example a branch office stranded by sanctions, or a founder fighting a VC coup.
