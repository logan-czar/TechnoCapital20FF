# 15. Infrastructure: compute, servers, databases and the cloud (detailed design)

_Status: draft v0.1 (2026-10-18). Logan picked "compute, servers, databases, and the cloud" as the next system (batch 44). It is what software runs on: every software instance ([14-software.md](14-software.md) 14.2.2) needs compute and database space, and companies pay for it on their own servers or in a cloud bill. This first draft is Claude's proposal, marked **(A)**, for Logan to confirm in batch 45. Builds on [6-technocapital.md](6-technocapital.md) (compute in H, leasing, data centers, the GPU chain) and [10-industry-economy.md](10-industry-economy.md) (the Cloud and data centers industry, sites, real estate pools). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption; the list is in 15.8.

---

## 15.1 The four parts (A)

| Part | What it is | Unit |
|---|---|---|
| **Compute** | Processing power that software instances and AI models use | **C** (general compute, CPU) and **H** (AI compute, GPU, 6.1) |
| **Servers** | The physical machines a company owns that provide compute and storage | Racks |
| **Databases** | Storage space for data (14.2.2) | TB |
| **Cloud** | Compute and storage rented from a cloud provider instead of owned | A monthly cloud bill |

## 15.2 Compute (A)

- **Two kinds.** General compute (**C**) runs ordinary software: SaaS, apps, banking systems. AI compute (**H**, 6.1) runs AI models, training runs and software with AI features (14.5). AI compute can do general work at a poor exchange rate (1 H does 50 C of work **(T)**); general compute cannot do AI work.
- Each software instance needs its compute requirement ÷ quality factor (14.2.1), every tick it runs.
- **Short of compute**, instances slow down: speed falls in proportion, and input data piles up in storage or is discarded (14.2.2).

## 15.3 Servers (A)

- A **server rack** is owned hardware: a set amount of C or H, plus storage in TB. Racks are bought new from hardware makers (GPU racks go through the GPU chain, 6.7.0) or used.
- Racks sit **at a site** (10): a small server room in an office site, or a **data center** site on industrial real estate (10.4.5) for large fleets.
- Costs: the rack price up front, then **power** (from the energy price index, 2.6.0), cooling and staff each month. Racks age: old racks give less compute per dollar of power, and break down more often **(T)**.
- Idle capacity on owned racks can be leased out on the cloud market (15.5), as 6.3.4 already allows for compute.

| Rack type **(T)** | Compute | Storage | Price | Power |
|---|---|---|---|---|
| General rack | 1,000 C | 200 TB | $300,000 | 15 kW |
| Storage rack | 100 C | 2,000 TB | $250,000 | 8 kW |
| AI rack | 2 H (≈ 2,000 accelerator-hours a month) | 50 TB | $3M | 120 kW |

## 15.4 Databases (A)

- **Storage** is measured in TB on owned racks or rented in the cloud.
- **Stored data** is kept by type (transactions, user activity, sensor feeds and so on, 14.2.2) and by owner.
- Data has a **value** that can be sold under contract to other companies, fed into other software, or used to train AI models. Most data loses value with age (−5% a month **(T)**); some types (medical, financial history) keep it.
- A company's **database requirement** is the sum of its instances' needs (14.2) plus whatever stored data it keeps. Over capacity, new input data is discarded until space is added.
- Privacy laws (T2, [4-politics.md](4-politics.md)) cap what data can be stored or sold in each country, and where it must be kept (data residency).

## 15.5 The cloud (A)

- **Cloud providers** are companies in the Cloud and data centers industry (10) that own large data centers and sell compute and storage.
- They sell through the **contracts system** (14.4): a **market contract** with a price per C, H and TB per month that any company can sign, and **special contracts** for big customers (reserved capacity, discounts, exclusive GPU allocations).
- The **cloud bill** is the monthly sum of everything a company uses under its cloud contracts. It rises and falls as the company scales its instances (14.2.2).
- **Spot** capacity is cheaper but can be taken back; **reserved** capacity costs more but is guaranteed for the term (6.3.4).
- Cloud contracts are tied to a **region**: data stays where the provider's data center is, which matters for privacy laws, export controls (6.9.1) and chokepoint outages.
- Starting providers: three US hyperscalers, one Chinese, and one European, with a few regional players **(A)**.

## 15.6 Own servers or cloud? (A)

| | Own servers | Cloud |
|---|---|---|
| Up front | Rack prices | None |
| Monthly | Power, cooling, staff | The bill: about 2× the running cost of owned racks at the same use **(T)** |
| Scaling | Slow: buying and installing racks takes weeks | Instant |
| Control | Full; secret tasks allowed (6.3.4) | The provider can see usage and cut you off; governments can subpoena it |
| Risk | Breakdowns, power cuts at your site | Provider outages, price rises, sanctions on the provider |

## 15.7 How it connects

| System | Link |
|---|---|
| Software (14) | Instances need compute and database space; scaling raises the server load or the cloud bill |
| Techno-Capital (6) | H is the same AI compute as Techno-Capital; GPU racks come from the GPU chain |
| Economy (10) | Data centers are sites on industrial real estate; power comes from the energy index; cloud revenue counts in the Cloud and data centers industry |
| Politics (4) | Privacy laws and data residency; export controls on AI racks and cloud access |
| Events (13) | An Infrastructure deck: *Outage*, *Power Cut*, *Cloud Price Hike*, *Rack Fire*, *Data Breach* (once hacking exists) |

## 15.8 Assumptions and open items

1. Two kinds of compute (C and H) and the exchange rate in 15.2.
2. Rack types, prices and power in 15.3.
3. Data value and decay in 15.4.
4. Cloud through the contracts system, regions and starting providers in 15.5.
5. The own versus cloud comparison in 15.6.
