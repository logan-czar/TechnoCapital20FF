# 14. Software: the software table and software contracts (detailed design)

_Status: draft v0.3 (2026-10-18). Batch 41: "Software System" means an **in-game system about software**. Batch 42: the game keeps a **software table**; hacking comes later. Batch 43: the last four columns (speed, bloat, quality, tags), **software contracts** for use and pricing, nerfed output, and AI models kept separate. Builds on [10-industry-economy.md](10-industry-economy.md) (the Software and SaaS industry), [6-technocapital.md](6-technocapital.md) (compute) and [../12-tech-and-roadmap.md](../12-tech-and-roadmap.md) (the Rust engine keeps the tables). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 14.7.

---

## 14.1 Decided by Logan

| Topic | Decision |
|---|---|
| Software table | One row per piece of software, with the columns in 14.2 (batches 42 and 43). |
| Contracts | Who uses software and at what price is handled by its owner through **software contracts** (14.4), not table columns (batch 43). |
| Missing inputs | A product's **output amount is nerfed** based on its quality and software type (batch 43). |
| AI models | **Their own separate thing**, not rows in the software table (batch 43). They stay in Techno-Capital ([6-technocapital.md](6-technocapital.md) 6.2.4). |
| Hacking | **Later**: a separate system to design after this one (batch 42). |

## 14.2 The software table

Every column is Logan's (batches 42 and 43).

| Column | What it holds |
|---|---|
| **Name** | The product's name, for example "Sable OS" or "Tally Pro" |
| **Platforms** | Where it runs: desktop, phone, web, cloud, embedded (cars, drones, implants), data center |
| **Owners** | Who owns it, by holder (companies, trusts or characters) with % stakes, like company ownership (1.2) |
| **Creators** | Who made it: the company that developed it and the lead characters credited |
| **Inputs** | What it needs to run: other software it depends on, data, and staff (14.3) |
| **Outputs** | What it produces: services to the companies using it, data, revenue to its owner through contracts, slop (10.3) |
| **Version** | Major and minor version; a new major version is a release event |
| **Database requirements** | Storage it needs, in TB, held in data centers or rented cloud (6) |
| **Compute requirements** | Compute it needs to run, in H (6.1) |
| **Features** | What it can do; each feature opens uses and adds to compute and database needs (14.5) |
| **Speed** | **How many units per tick it can process** (Logan). A unit is one task of whatever the software does: a transaction, a request, a record **(A)** |
| **Bloat** | **A modifier that extends the time it takes to maintain, update and add features to the software** (Logan). Grows with every feature and version **(A)** |
| **Quality** | **The overall score of the software** (Logan). It is improved by updates and acts as a **global modifier**: it affects speed, security, compute, database and everything else about the product |
| **Tags** | **Weird cases where the software strays from how the game usually treats software** (Logan). Each tag is a named exception rule (14.6) |

### 14.2.1 How quality, bloat and speed work together (A)

- **Quality** runs from 0 to 100. Effective values are scaled by a quality factor `Q = 0.5 + quality / 100`, so a 50-quality product works at ×1.0 and a 100-quality one at ×1.5 **(T)**:
  - effective speed = base speed × Q
  - effective compute and database needs = base needs ÷ Q (better software is leaner)
  - security, once hacking exists, = base security × Q
- **Bloat** starts at 1.0 and rises +0.1 per feature added and +0.05 per minor version **(T)**. The time to finish any maintenance, update or new feature is multiplied by bloat. A **refactor** project lowers bloat by 0.3 but adds no features and takes time **(T)**.
- **Speed** sets how many units the software handles per hourly tick across all its users. If demand from its contracts is higher than effective speed, the extra units wait and the users see slower service; if it stays over capacity for a week, some contracts can be cancelled.

## 14.3 Inputs, outputs and nerfed output

Software forms a small dependency graph, like the GPU chain (6.7.0) **(A)**.
- **Inputs** name other rows in the table (an app needs an operating system and a cloud platform), and each input is used through a **software contract** (14.4).
- **Nerfed output (Logan).** When an input is missing or short, the product keeps running but its **output amount is cut**. How much it is cut depends on its quality and its software type **(A)**:

  `Output = base output × (1 - missing share × type sensitivity × (1.5 - quality / 100))`, clamped to 0 or above **(T)**

  | Software type | Sensitivity **(T)** |
  |---|---|
  | Operating system, firmware | 0.4 (self-contained) |
  | Desktop or phone app | 0.7 |
  | Cloud service or SaaS | 1.0 (lives on its inputs) |

  For example, a 50-quality SaaS tool that loses half its inputs works at 50% output; at 90 quality it keeps 70%.
- **Outputs** feed the economy: services that raise the productivity of the companies that use the software, licence revenue to the owner, data, and slop.

## 14.4 Software contracts (Logan, batch 43)

The owner of a piece of software decides who may use it and on what terms. A company that wants to use software **signs a software contract**.

| Contract | Who it is offered to | How it works |
|---|---|---|
| **Market contract** | **Every company** in the game | The owner sets one standard offer for the product: price, term and any limits. Any company can sign it at any time. |
| **Special contract** | One company | Negotiated between two companies, occasionally: exclusive use, a discount, a custom build, source access, or a bundle. Made at the negotiation table like any deal. |

Contract terms **(A)**:
- **Price**: per seat, per unit processed, or a flat fee a month.
- **Term**: monthly rolling, or 1 to 5 years.
- **Units**: how many units per tick the buyer may use; the sum over all contracts is checked against the product's speed.
- **Exclusivity**: a special contract can bar the owner from offering the product to a named rival.
- **Cancellation**: the owner can stop offering a market contract, but signed contracts run to the end of their term; breaking one is a lawsuit (4.21).
- **Users** come from contracts: a product's users are the companies (and their staff) under contract, so there is no separate users column.
- Contracts live in their own **contracts table** in the engine, with a Contracts view on the company screen.

## 14.5 Features (A)

| Feature | Opens | Extra needs **(T)** |
|---|---|---|
| Payments | Fintech use; crypto casino use (9) | +10% database |
| Ads | Ad revenue; slop ×1.5 | +10% compute |
| AI assistant | A higher price; needs a contract for an AI model (6.2.4) | +50% compute |
| Social feed | Doomscrolling use (11) | +30% database |
| Enterprise | Business seats; longer contract terms | none |
| Encryption | Privacy-minded markets; a regulator issue in surveillance states | +5% compute |
| Offline | Embedded platforms (cars, drones, implants) | none |

## 14.6 Tags (A)

Tags are exceptions to the normal rules. Starting examples:

| Tag | Exception |
|---|---|
| **Legacy** | Bloat cannot be lowered by a refactor; companies that depend on it rarely leave (contracts renew automatically) |
| **Open source** | No licence price; anyone can use it without a contract, and anyone can fork it into a new row |
| **State mandated** | Every company in one country must sign its contract (for example a tax or surveillance system) |
| **Air-gapped** | Needs no inputs; cannot run in the cloud |
| **Viral** | New market contracts sign themselves for a few months after a hit release |
| **Abandonware** | No owner: no updates, quality decays over time, and the contracts are free |

## 14.7 Assumptions and open items

1. The quality factor, bloat growth and refactor rule in 14.2.1.
2. What a "unit" is for each kind of software (14.2).
3. The nerfed output formula and type sensitivities in 14.3.
4. Contract terms in 14.4.
5. The feature and tag lists in 14.5 and 14.6.
6. Hacking: a later system.
