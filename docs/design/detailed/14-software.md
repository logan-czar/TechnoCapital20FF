# 14. Software: the software table and AI models as products (detailed design)

_Status: draft v0.2 (2026-10-18). Batch 41: "Software System" means an **in-game system about software**. Batch 42: the game keeps a **software table**, and **hacking comes later**. Builds on [10-industry-economy.md](10-industry-economy.md) (the Software and SaaS industry), [6-technocapital.md](6-technocapital.md) (compute, AI models 6.2.4) and [../12-tech-and-roadmap.md](../12-tech-and-roadmap.md) (the Rust engine keeps the tables). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 14.6.

---

## 14.1 Decided by Logan

| Topic | Decision |
|---|---|
| Software table | The game keeps a **software table**: one row per piece of software, with the columns in 14.2 (batch 42). |
| Hacking | **Later.** Hacking, exploits and backdoors are a separate system to design after this one (batch 42). |

## 14.2 The software table

One row per product. Logan's columns are marked **L**; the rest are proposed **(A)**. Logan's list ended with "and", so at least one column is still missing.

| Column | Source | What it holds |
|---|---|---|
| **Name** | L | The product's name, for example "Sable OS" or "Tally Pro" |
| **Platforms** | L | Where it runs: desktop, phone, web, cloud, embedded (cars, drones, implants), data center |
| **Owners** | L | Who owns it, by holder (companies, trusts or characters) with % stakes, like company ownership (1.2) |
| **Creators** | L | Who made it: the company that developed it and the lead characters credited (their Tech skill sets quality) |
| **Inputs** | L | What it needs to run or be made: other software it depends on, data, licences, and staff (14.3) |
| **Outputs** | L | What it produces: revenue, services to other products, data, slop (10.3) |
| **Quality** | L | 0 to 100; drives users, price and rivals' pressure |
| **Version** | L | Major and minor version; a new major version is a release event |
| **Database requirements** | L | Storage it needs, in TB, held in its owner's data centers or rented cloud (6) |
| **Compute requirements** | L | Compute it needs to run, in H (6.1), scaling with users; AI models need much more |
| **Features** | L | Tags that unlock uses and markets (14.4) |
| Type **(A)** | | App, SaaS tool, game, AI model, platform, operating system, firmware |
| Industry **(A)** | | Which of the 36 industries its revenue counts in |
| Users **(A)** | | People or business seats using it; grows or shrinks monthly |
| Price model **(A)** | | Free with ads, subscription, licence per use, one-off sale |
| Licence **(A)** | | Closed, licensed to others, or open source |
| Released **(A)** | | Release date of the first version and of the current version |

## 14.3 Inputs and outputs (A)

Software forms a small dependency graph, like the GPU chain (6.7.0).
- **Inputs** name other rows in the table: an app needs an operating system and a cloud platform; an AI product needs an AI model; a model needs training data and compute.
- If an input is lost (its owner raises the licence price, cuts access or goes bust), every product that needs it loses quality until it switches, which takes a development project.
- **Outputs** feed back into the economy: revenue to the owning company's industry, services consumed by other products (with licence fees paid to the owner), data that improves the owner's models, and slop.

## 14.4 Features (A)

Features are tags. Each one opens a market or a use and adds to compute or database needs. Starting list:

| Feature | Opens | Extra needs **(T)** |
|---|---|---|
| Payments | Fintech revenue; crypto casino use (9) | +10% database |
| Ads | Ad revenue per user; slop ×1.5 | +10% compute |
| AI assistant | Higher price, needs an AI model as input | +50% compute |
| Social feed | Doomscrolling use (11); network growth | +30% database |
| Enterprise | Business seats; slower churn | none |
| Encryption | Higher price in privacy-minded markets; a regulator issue in surveillance states | +5% compute |
| Offline | Embedded platforms (cars, drones, implants) | none |

## 14.5 How it is made and used (A)

- **Development** is a company growth or R&D plan step (10): pick the type, platforms and features, then spend months and money. Quality at release comes from the company's management score, its Tech talent and the budget.
- **New versions** are R&D projects that raise quality and can add features.
- **AI models** are rows in this table as well as Techno-Capital (6.2.4); their compute requirement draws on the owner's leased or owned compute.
- **Buying and selling**: a product can be sold or licensed to another company, like any asset, through the deal screen.
- The Rust engine keeps the software table as one of its tables and builds a **Products view** for the company screen.

## 14.6 Assumptions and open items

1. The proposed columns in 14.2 beyond Logan's list, and the missing column after "features, and".
2. The dependency graph in 14.3.
3. The feature list in 14.4.
4. Development and versions in 14.5.
5. Hacking, exploits and backdoors: a later system.
