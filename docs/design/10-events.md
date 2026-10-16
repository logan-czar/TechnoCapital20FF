# 10. Events and event chains

## 10.1 Event engine

Events are data-driven (JSON) cards:

- **Trigger**: conditions on world state (character traits, company state, market moves, dates).
- **Weight** and **cooldown**.
- **Description** with text variables (names, companies, places).
- **2 to 4 options**, each with conditions, effects, and optionally the next event in a chain.
- **Scope**: character, company, trust, hub, country.

Events fire from the calculation schedule (see [09-time-and-turns.md](09-time-and-turns.md)) or directly from actions.

## 10.2 Event chains

A chain is a graph of events with shared state (variables like "investor interest" or "suspicion"). Chains drive:

- **Founding paths** (see [01-companies.md](01-companies.md)):
  - *VC*: Accelerator Demo Day → Pitch to Partners (several firms) → Term Sheet → Due Diligence → Close Round; repeated per funding round with milestones between rounds.
  - *Ask Daddy*: Dinner with Dad → list of Dad's friends → one meeting per friend (golf, gala, office) → each says yes, no, or "yes, but…" (a favor owed).
  - *Bank Loan*: Application → Collateral Review → Covenants → Approval or rejection.
  - *Political Connections*: Meeting the Minister → Grant Application → Public Scrutiny → Contract Award.
  - *Freestyle*: small chains per source (angels, crowdfunding, partner company).
- **IPO**: Hire Banks → Roadshow → Pricing Night → First Day of Trading.
- **Investigations**: Subpoena → Discovery → Settlement or Trial.
- **Succession crises**, **proxy fights**, **elections**, **currency crises**, **strikes**.

## 10.3 Sample events

- *Heir in the Tabloids*: your heir's party footage leaks.
- *The Quiet Meeting*: a bloc member was seen with a rival's chairman.
- *Margin Call*: the market dipped and the bank wants collateral.
- *Shell Exposed*: a journalist is following the money to one of your shells.
- *Beijing Calls*: the host government wants a bigger local partner stake in your branch office.
- *Strait Closed*: a chokepoint is blockaded; your chip supply is stuck at sea.
- *Implant Rejection*: your neural co-processor is failing during a board meeting.
- *Dad's Old Friend*: an investor from your Ask Daddy round wants his favor repaid.
