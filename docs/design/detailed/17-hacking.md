# 17. Hacking (detailed design)

_Status: draft v0.2 (2026-10-18). Batch 70: ransomware, hirable hacker characters, no insider bonus, no cyber insurance. Hacking was deferred from software (batch 42) and picked as the next system in batch 68. Logan set its core in batch 69: **hacking schemes run by characters that require Techno-Capital**; a hack either **steals data** or plants a **backdoor**; targets are **governments, companies and people, but only through Techno-Capital they own**; stolen data is **cashed in on the black market**; anonymous by default; a crime; hackers can **go into hiding**. Builds on [1-corporate-core.md](1-corporate-core.md) 1.1.8 (schemes and intel), [6-technocapital.md](6-technocapital.md) (Techno-Capital and the Compromised control level), [14-software.md](14-software.md) (software security), [15-infrastructure.md](15-infrastructure.md) (compute and stored data) and [4-politics.md](4-politics.md) (investigations and havens). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 17.9.

---

## 17.1 Decided by Logan

| Topic | Decision |
|---|---|
| Who hacks | **Characters run hacking schemes that require Techno-Capital** (compute and the like). Companies and characters can also **hire hacker crews** from the Black market. |
| Two outcomes | A hack either **steals data** or **creates a backdoor**. Stealing **returns more up front**; a backdoor **makes future hacks easier** and gives **passive data** as a reward. |
| Targets | **Governments, companies or people**, but **only through Techno-Capital they own**: a server, a personal server, a **drone**, any kind of TC from drones to company servers. **You cannot hack a person themselves.** |
| Cashing in | **Different types of data can be cashed in on the black market** for personal gain. |
| Defense | Each breach rolls the attacker's **Tech** against the target's **defense**: software quality, cyber security spending and the Spymaster, who **administers security for each institution**; controlling more institutions gives more bonuses (batch 75, 17.5). |
| Attribution | Breaches are **anonymous at first**; the victim learns who did it only through **intel or an investigation**. **State-backed hackers** exist. |
| Ransomware | **Yes** (batch 70): a hack can lock a target's systems until they pay (17.3.1). |
| Hacker characters | **Tech-heavy characters can be hired**, like executives, into a company's security or offense team (batch 70; 17.2). |
| Insiders | **No insider bonus** (batch 70). |
| Cyber insurance | **None** (batch 70). |
| Legal | **Hacking is a crime.** A traced hack opens an investigation; havens and sanctioned states can shelter hackers. A hacker can **go into hiding** to lower the odds of being found. |

## 17.2 The hacking scheme

A hack is a scheme (1.1.8) rolled on **Tech** that **requires Techno-Capital** to run.

| Step | What happens **(A)** |
|---|---|
| 1. Pick a target | One piece of Techno-Capital someone owns: a company's servers or data center, a government system, a person's personal server, phone cloud or home system, a drone, a robot, a car. The character must know it exists (a known asset, or one found by intel) |
| 2. Pick the outcome | **Steal data** or **plant a backdoor** (17.3) |
| 3. Commit Techno-Capital | The scheme **requires compute** (and other TC for some targets, such as a drone controller) allocated to it for its run **(T: about 10 base compute units for a person's server, 100 for a company, 500 GPU-grade for a government)**. Compute can be owned, leased, rented from the cloud (15.5) or Compromised (6.3.4) |
| 4. Run | Like any scheme, it runs for weeks (1 to 8 by target) and rolls discovery weekly (1.1.8.1) |
| 5. Breach roll | Success = 50% + (attacker's Tech - target's defense) × 3%, clamped 5% to 95%, +15% if a backdoor is already in place (17.3) **(T)** |

- **Crews.** A character or company can **hire a hacker crew** from the Black market (10.3) instead of running it themselves: the crew's Tech rolls, the buyer pays the fee and supplies or rents the compute **(A)**. A crew can be traced back to its buyer.
- **Hacker characters (Logan, batch 70).** Characters with high Tech can be **hired like executives** into a company's **security team** (adds to defense, 17.5) or **offense team** (runs the company's hacks with their Tech). They are named characters with traits and loyalty, so they can be poached, turned or caught **(A)**.
- **State-backed hackers.** Governments run their own hacker units against companies, dissidents and other states, and some will work for a dynasty in return for favors (4) **(A)**.

## 17.3 Steal data or plant a backdoor (Logan)

| Outcome | Reward | Trade-off |
|---|---|---|
| **Steal data** | **More up front**: a one-time haul of the target's stored data (15.4), by type and amount | The victim is more likely to notice (discovery ×1.5) and patch the hole **(T)** |
| **Backdoor** | **Future hacks on that target are easier** (+15% breach, half the run time), and it gives **passive data**: a small trickle of the target's new data every month **(T)** | Less up front; the backdoor can be found by the target's security checks (5% a month, more with a strong Spymaster) **(T)** |

- **Backdoors on compute** let the hacker **use it secretly**: this is the **Compromised** control level of Techno-Capital (6.3.4).
- **Backdoors on drones and robots** let the hacker **take control** for a mission or sabotage (crash, misroute, spy) **(A)**.

### 17.3.1 Ransomware (Logan, batch 70)

A third outcome: **lock the target's systems until they pay**.
- While locked, the hit business unit (or the government system, or the person's devices) **loses output**: a locked company unit runs at 20% productivity, locked compute does nothing **(T)**.
- The ransom is set by the hacker, usually 1% to 10% of the target's yearly revenue for a company **(T)**. The victim can **pay** (systems back in a day, and no guarantee the hacker leaves), **restore** (2 to 6 weeks of lost output, faster with high software quality) or **hunt the hacker** (an investigation, 17.6).
- Payment comes through crypto in the gambling system or the black market, which is traceable at 5% per payment **(T)**.
- A paid ransom marks the victim as a payer: future ransom hacks against them are more likely **(A)**.

## 17.4 What data is worth (Logan: black market)

Stolen data comes in **types** (14.2.2, 15.4). Each type can be **cashed in on the black market** or used directly **(A)**:

| Data type | Black market value **(T)** | Direct use |
|---|---|---|
| **Personal and financial records** | $5 to $50 per thousand records | Fraud, identity theft (personal gain) |
| **Corporate secrets** (plans, R&D, deals) | 1% to 5% of the target unit's yearly R&D | A tech or deal stolen (like Corporate espionage); insider trading (a crime) |
| **Compromising material** | Varies; often worth more as a hook | A **secret** (1.1.8.2) and a **hook** on the person whose server it was |
| **Government files** | High, but only state buyers | Political leverage; dangerous to hold |
| **Training data** | By size and age (15.4) | Train AI models (6.5) |
| **Enterprise data** (Logan, batch 91) | **Unstructured: worthless.** **Structured: a price per TB set by its industry** **(T: from about $50 a TB for low-value industries up to about $2,000 a TB for finance, health and defense)** | The thief's own structured data buffs (14.2.3) |
| **Credentials** | Fixed per account | The next hack on a linked target is easier (+10%) |

- Data ages and loses value (15.4), so stolen data is worth most when fresh.
- Selling on the black market is itself risky: each sale has a small chance to be traced (2% a sale) **(T)**.

## 17.5 Defense (Logan)

Target defense = **software quality** of the target's systems (14.2.1: base security × Q) + **cyber security spending** + the **Spymaster's** Intrigue and the security team's Tech **(A)**:

`Defense = 5 + software quality ÷ 10 + cyber spend tier (0 to 10) + Spymaster bonus (0 to 5)` **(T)**

- **The Spymaster administers it (Logan, batch 75).** Each institution's cyber defense is run by its Spymaster (Head of Security seat, or the household's fixer). Controlling **more institutions** adds the **network bonus** in [4-politics.md](4-politics.md) 4.23.1: +1 defense per extra controlled institution with its own Spymaster, up to +5 **(T)**, and a breach detected at one warns the others.

- **Cyber spend tiers (A):** a company sets cyber security spending as a share of revenue (0% to 3%); a character sets it in their personal budget (1.10.6). Higher tiers also raise the chance to detect a hack in progress.
- **Air-gapped** software (14.6 tag) **cannot be hacked** at all. There is no insider route (Logan, batch 70: no insider bonus); agents (1.1.8.1) add normal scheme progress but no special breach bonus.
- Defense also patches: after a detected breach, the target's defense against the same attacker type rises by +3 for 6 months **(T)**.

## 17.6 Attribution (Logan)

- **Anonymous at first.** A detected breach tells the victim what was hit, not who did it.
- **Finding out:** an investigation (a scheme by the Spymaster, 1.1.8.2), an informant, a black market sale traced back, or a news outlet's investigation (16.5.1) reveals the hacker as a **secret**.
- **False flags (A):** a skilled hacker (Tech 20+) can leave a trail pointing at someone else, which an investigation may fall for.
- Once known, the victim treats it as a discovered scheme (1.1.8): Rival or Nemesis, a hook, and possibly a scandal.

## 17.7 Crime, havens and hiding (Logan)

- **Hacking is a crime.** A traced hack opens a police or regulator investigation in the victim's country ([4-politics.md](4-politics.md)), and a government victim opens a national security case.
- **Havens and sanctioned states** can shelter hackers: a hacker based in one is hard to extradite **(A)**.
- **Going into hiding (Logan).** A hacker can **go into hiding** to **reduce the odds of being found**: while hidden they cannot travel or attend in-person actions, their investigation odds fall by half, and their companies and family feel the absence **(T)**. Hiding in a haven or sanctioned state stacks with its shelter.

## 17.8 How it connects

| System | Link |
|---|---|
| Schemes and intel (1.1.8) | Hacking schemes run like other schemes; stolen compromising data becomes secrets and hooks |
| Techno-Capital (6) | Hacks require TC; backdoors on compute are the Compromised control level; drones and robots can be taken over |
| Software and infrastructure (14, 15) | Software quality is defense; stolen data is stored data, which ages |
| Economy (10) | The Black market industry sells crews and buys data |
| Media (16) | Outlets expose hacks; leaks from stolen data run as scandals |
| Politics (4) | Investigations, havens, state-backed hackers |
| Events (13) | A **Hacking** deck: *Breach Detected*, *Ransom Note* (17.3.1), *Systems Locked*, *The Backdoor Is Found*, *A Crew Gets Greedy*, *Extradition Request* |

## 17.9 Assumptions and open items

1. Compute needed per target, run times and the breach formula (17.2).
2. Hacker crews and state-backed hackers (17.2).
3. Data haul, discovery and backdoor numbers (17.3).
4. Data types and black market values (17.4).
5. The defense formula and cyber spend tiers (17.5).
6. False flags (17.6).
7. Havens and the effects of hiding (17.7).
8. Ransom amounts, locked output and payment tracing (17.3.1).
9. Hacker characters on security and offense teams (17.2).
