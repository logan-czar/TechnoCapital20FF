# 14. Software: apps, AI models as products, and hacking (detailed design)

_Status: draft v0.1 (2026-10-18). Logan picked "Software System" as the next topic and, in batch 41, said it means an **in-game system about software**: apps, hacking and AI models as products. This first draft is mostly Claude's proposal, marked **(A)**, for Logan to confirm or change in batch 42. Builds on [10-industry-economy.md](10-industry-economy.md) (the Software and SaaS industry), [6-technocapital.md](6-technocapital.md) 6.2.4 (AI models), [4-politics.md](4-politics.md) 4.22 and 4.23 (netrunner crews, cyber defense), [1-corporate-core.md](1-corporate-core.md) 1.1.8 (schemes) and 1.1.10 (cyberware hacking). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption; the list is in 14.7.

---

## 14.1 What the system adds

The economy measures industries in dollars (10). Software sits on top of that as **named products** a company owns, so the player can launch an app, watch its users grow, sell AI models, and break into other people's software **(A)**.

| Part | What it is |
|---|---|
| **Products** | Named apps, SaaS tools, games and AI models owned by a company |
| **Users and revenue** | Each product has users and revenue per user; product revenue feeds its company's revenue in its industry |
| **Quality and security** | Each product has a quality score and a security score, set by the company's Tech talent and compute |
| **Hacking** | Schemes against products and companies: data theft, ransomware, backdoors, sabotage |
| **Exploits** | Zero-day exploits as items that can be found, bought, sold or stockpiled |

## 14.2 Products (A)

| Type | Industry | Revenue model | Notes |
|---|---|---|---|
| **App** | Social media and ads; Gaming and gambling | Ads and in-app purchases per user | High slop (10.3); shows up in the phone tab (9) |
| **SaaS tool** | Software and SaaS | Subscription per business seat | Sticky: customers churn slowly |
| **Game** | Media and entertainment | Sales plus in-game purchases | Hits and flops by roll |
| **AI model** | AI labs | Licensed per use (6.2.4) | Needs compute to serve; generation and quality from 6.4 |
| **Platform** | Software and SaaS; Social media | Takes a cut of other products on it | Rare; app stores and operating systems; owned by a few megacorps at start |

Each product has:
- **Users** that grow or shrink monthly with quality, marketing spend, Buzz and rivals' products **(T)**.
- **Quality** (0 to 100): set by the developing company's management score (the Tech skills on its board) and its R&D plan.
- **Security** (0 to 100): set by security spend and a cyber defense team (4.23). Low security is an open door for hackers.
- **Data**: a product with many users collects data, which is worth intel on its users (2.22) and can be sold, at a scandal risk.

**Launching a product** is a growth plan step for a company in a software industry: pick the type, spend months and money on development, then launch. The launch rolls against the company's management score for a hit, a normal start or a flop.

## 14.3 AI models as products (A)

AI models are already Techno-Capital (6.2.4). As products they also:
- Have **users** (businesses and people paying per use) and need compute to serve them; short of compute, users leave.
- Can be **open-sourced**: no license revenue, but Buzz, talent and a hit to rivals' prices.
- Can be **stolen** by hacking (14.4) or by poaching the team, which copies the model to the thief at a lower quality.

## 14.4 Hacking (A)

Hacking runs as **schemes** (1.1.8), rolled once against Tech (or Intrigue for social engineering). The player hires a **netrunner crew** (4.22) or uses a character's own Tech skill.

| Scheme | Target | Success | Discovery risk |
|---|---|---|---|
| **Data theft** | A product or company | Intel on the company and its users; secrets that can become hooks (1.1.4) | Medium |
| **Ransomware** | A company | The target pays or loses operations for weeks; stock -5% to -15% | High; regulators and police |
| **Backdoor** | A product or a compute cluster | Lasting hidden access; on a cluster it gives **Compromised** control (6.3.5) | Low per month, grows over time |
| **Sabotage** | A product | Quality and users fall; an outage event for the owner | Medium |
| **Hack a person** | A character's phone or implants (1.1.10) | Secrets, messages, or implant control | Medium |

`Success = 40% + (attacker Tech - 10) × 3% + exploit bonus - target security ÷ 2 %`, clamped 5% to 90% **(T)**.

## 14.5 Exploits (A)

- **Zero-days** are items tied to one product or platform. A zero-day adds +30% to hacking schemes against that target until it is patched **(T)**.
- They are found by a netrunner crew or a security team (a monthly roll by Tech), or bought on a black market in hubs with low surveillance.
- Each use has a chance to burn the exploit (the target patches it). Owners of the target product can buy bug bounties to find exploits first.
- Selling zero-days to states or brokers is a business with high scandal risk.

## 14.6 How it connects

| System | Link |
|---|---|
| Economy (10) | Product revenue is part of its company's industry revenue; a hit raises the company's growth |
| Techno-Capital (6) | AI models need compute; backdoors give Compromised control of clusters |
| Vices (11) | Doomscrolling and gambling apps are products; owning one shows which users are hooked |
| Politics (4) | Data privacy law (T2) and AI law (T3) limit products; regulators investigate breaches |
| Events (13) | A Software deck: *Viral Launch*, *Outage*, *Breach Disclosed*, *Zero-day for Sale* |
| UI (11) | A Products tab on the company screen; hacking from the schemes menu |

## 14.7 Assumptions and open items

1. Named products on top of industry dollars (14.1, 14.2).
2. Product types and stats in 14.2.
3. AI model product rules in 14.3.
4. Hacking schemes and the formula in 14.4.
5. Zero-day exploits in 14.5.
