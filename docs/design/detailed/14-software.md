# 14. Software: the software table and software contracts (detailed design)

_Status: draft v0.4 (2026-10-18). Batch 41: "Software System" means an **in-game system about software**. Batch 42: the game keeps a **software table**; hacking comes later. Batch 43: the last four columns (speed, bloat, quality, tags), **software contracts** for use and pricing, nerfed output, and AI models kept separate. Batch 44: software is a **data pipeline** (speed is data processed per tick), bloat comes from features, companies **scale instances**, and a broken contract costs a penalty. Builds on [10-industry-economy.md](10-industry-economy.md) (the Software and SaaS industry), [6-technocapital.md](6-technocapital.md) (compute) and [../12-tech-and-roadmap.md](../12-tech-and-roadmap.md) (the Rust engine keeps the tables). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 14.7.

---

## 14.1 Decided by Logan

| Topic | Decision |
|---|---|
| Software table | One row per piece of software, with the columns in 14.2 (batches 42 and 43). |
| Contracts | Who uses software and at what price is handled by its owner through **software contracts** (14.4), not table columns (batch 43). |
| Missing inputs | A product's **output amount is nerfed** based on its quality and software type (batch 43). |
| AI models | **Their own separate thing**, not rows in the software table (batch 43). See [18-ai-models.md](18-ai-models.md): rented through software contracts and powering AI features (batch 72). |
| Hacking | A separate system: [17-hacking.md](17-hacking.md) (batch 69). |

## 14.2 The software table

Every column is Logan's (batches 42 and 43).

| Column | What it holds |
|---|---|
| **Name** | The product's name, for example "Sable OS" or "Tally Pro" |
| **Platforms** | Where it runs: desktop, phone, web, cloud, embedded (cars, drones, implants), data center |
| **Owners** | Who owns it, by holder (companies, trusts or characters) with % stakes, like company ownership (1.2) |
| **Creators** | Who made it: the company that developed it and the lead characters credited |
| **Inputs** | What it needs to run: the **types of input data** it processes, plus other software it depends on (14.3) |
| **Outputs** | The **types of output data** it produces from its input data; the value of that data to the companies using it is what they pay for (14.3) |
| **Version** | Major and minor version; a new major version is a release event |
| **Database requirements** | Data compute it needs to store and process its data, per instance ([15-infrastructure.md](15-infrastructure.md) 15.4) |
| **Compute requirements** | Units of base compute, and GPU compute for AI software, per instance (15.2) |
| **Features** | What it can do. A feature typically **adds a new type of output data**, and can also require new inputs or more or different types of compute (Logan, batch 44; 14.5) |
| **Speed** | **The amount of input data processed (translated into output data) per game tick** (Logan, batch 44), per instance (14.2.2) |
| **Bloat** | **A modifier that extends the time it takes to maintain, update and add features to the software** (Logan). It **rises with each feature added** (batch 44) |
| **Quality** | **The overall score of the software** (Logan). It is improved by updates and acts as a **global modifier**: it affects speed, security, compute, database and everything else about the product |
| **Tags** | **Weird cases where the software strays from how the game usually treats software** (Logan). Each tag is a named exception rule (14.6) |

### 14.2.1 How quality, bloat and speed work together (A)

- **Quality** runs from 0 to 100. Effective values are scaled by a quality factor `Q = 0.5 + quality / 100`, so a 50-quality product works at ×1.0 and a 100-quality one at ×1.5 **(T)**:
  - effective speed = base speed × Q
  - effective compute and database needs = base needs ÷ Q (better software is leaner)
  - security, once hacking exists, = base security × Q
- **Bloat** starts at 1.0 and rises +0.1 per feature added (Logan: it rises with each feature) **(T)**. The time to finish any maintenance, update or new feature is multiplied by bloat. Whether anything can lower bloat (a refactor project) is open **(A)**.
- **Speed** is measured in GB of input data per hourly tick, per instance (14.2.2) **(T)**.

### 14.2.2 Data and instances (Logan, batch 44)

- **Data is what software works on.** Each product takes in input data of certain types and translates it into output data of other types. Data types are named, for example *transactions*, *user activity*, *sensor feeds*, *documents*, *market ticks*, *ad impressions* **(A)**.
- **Input data can be stored or discarded** (Logan). Stored data fills database space (15) and can be processed later, sold under a contract, or fed to other software and AI models. Discarded data is gone.
- **Instances.** A company using a piece of software runs one or more **instances** of it. Each instance processes up to the software's effective speed per tick and needs the software's compute and database requirements.
- **Scaling (Logan).** When a company has more input data than its instances can process, it **scales up**: it runs more instances and pays for the extra in its own **data centers** or in its **cloud bill** (15). Scaling down cuts the bill. Unprocessed data waits in storage or is discarded.
- By default the company's operations staff scale instances automatically to keep up; the player can cap the bill **(A)**.

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
- **Outputs** feed the economy: output data raises the productivity of the companies that use it (a company's processed data is part of its management and operations output), it can be stored and sold, and its owner earns contract revenue. Slop comes from consumer software (10.3).

## 14.4 Software contracts (Logan, batch 43)

The owner of a piece of software decides who may use it and on what terms. A company that wants to use software **signs a software contract**.

| Contract | Who it is offered to | How it works |
|---|---|---|
| **Market contract** | **Every company** in the game | The owner sets one standard offer for the product: price, term and any limits. Any company can sign it at any time. |
| **Special contract** | One company | Negotiated between two companies, occasionally: exclusive use, a discount, a custom build, source access, or a bundle. Made at the negotiation table like any deal. |

Contract terms **(A)**:
- **Price**: per seat, per unit processed, or a flat fee a month.
- **Term**: monthly rolling, or 1 to 5 years.
- **Instances**: how many instances the buyer may run; the buyer scales within that limit (14.2.2).
- **Exclusivity**: a special contract can bar the owner from offering the product to a named rival.
- **Breaking a contract** (Logan, batch 44): either side can break a signed contract, but pays a **penalty**: by default the fees left on the term × 50% **(T)**, plus an opinion hit between the companies' heads. The owner can also stop offering a market contract to new buyers at any time.
- **Users** come from contracts: a product's users are the companies (and their staff) under contract, so there is no separate users column.
- Contracts live in their own **contracts table** in the engine, with a Contracts view on the company screen.

## 14.5 Features (A)

| Feature | New output data | New inputs or compute **(T)** |
|---|---|---|
| Payments | Transactions | Needs bank data input; +10% database |
| Ads | Ad impressions; slop ×1.5 | Needs user activity input; +10% compute |
| AI assistant | Generated text and actions | Needs a contract for an AI model (6.2.4); +50% compute, AI-grade compute |
| Social feed | User activity (sold to advertisers); doomscrolling use (11) | +30% database |
| Analytics | Reports and forecasts | Needs stored data; +20% compute |
| Encryption | Secured records | +5% compute; a regulator issue in surveillance states |
| Offline | Device logs | Runs on embedded platforms (cars, drones, implants) |

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

1. The quality factor and bloat growth in 14.2.1; whether anything lowers bloat.
2. Data types, GB as the speed unit, and auto-scaling in 14.2.2.
3. The nerfed output formula and type sensitivities in 14.3.
4. Contract terms in 14.4.
5. The feature and tag lists in 14.5 and 14.6.
6. Hacking: a later system.
