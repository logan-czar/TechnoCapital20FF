# 15. Infrastructure: compute, data centers, databases and the cloud (detailed design)

_Status: draft v0.4 (2026-10-18), consistency pass, batch 74: data centers belong to business units or corporations, not sites; GPU parts come from the GPUs industry. v0.3 (2026-10-18). Batch 46: maintenance feeds the energy system, GPU compute = H, parts from industries, 100 TB per data unit. Logan picked "compute, servers, databases, and the cloud" as the next system (batch 44) and set its core in batch 45: **three compute types** built from parts, each with a maintenance score; **onsite or leased data centers**; **one world cloud price to start**; data has value; **no data residency rules**. It is what software runs on: every software instance ([14-software.md](14-software.md) 14.2.2) needs compute, and companies pay for it in their own data centers or in a cloud bill. Builds on [6-technocapital.md](6-technocapital.md) (compute, GPUs and the AI boom) and [10-industry-economy.md](10-industry-economy.md) (business units, real estate, the Cloud and Data centers industries). Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 15.8.

---

## 15.1 Decided by Logan

| Topic | Decision |
|---|---|
| Compute types | **Three**: base compute, data compute and GPU compute (15.2). Each is built from parts and has a maintenance score. |
| Where compute lives | **Onsite data centers in any city where a company holds business assets or real estate**, or space in **data centers owned by cloud companies and leased** to them (15.3). |
| The cloud | **One world price to start**, like spot compute (15.5). Provider contracts can come later. |
| Data | **Stored data has value**: it can be sold, fed into other software or used to train AI, and most of it loses value as it ages (15.4). |
| Residency | **No residency rules**: data can sit anywhere (15.4). |

## 15.2 The three compute types (Logan)

| Type | What it is | Runs | Parts per unit | Maintenance score |
|---|---|---|---|---|
| **Base compute** | Classical computing. A desktop is 1 unit; a database server is 10 | Enterprise and desktop software | **1 base computer part** | **1** |
| **Data compute** | Database- and storage-optimized compute, like data warehousing | Storage and processing of data for software | **0.5 base computer part** | **0.2** |
| **GPU compute** | Accelerated compute for AI | **AI software requires it**; AI models and training runs (6) | **1 GPU part + 0.1 base computer part** | **5** |

- **Ratios vary by software (Logan).** A basic enterprise program needs data compute and base compute at about **1 to 1**, but every app is different. Each software row's compute requirement (14.2) lists how many units of each type it needs per instance **(A)**.
- **Demand over time (Logan).** GPU compute starts with **low demand** in 2020 and then **skyrockets** with the AI boom (6.7.0). Base and data compute demand grows steadily with the economy **(A)**.
- **Parts.** Base computer parts come from the Consumer electronics and Semiconductors industries, bought at their price index (Logan, batch 46); GPU parts are bought from the GPUs industry at the GPU price index (6.7.0, 10.6). A unit of compute is built by buying its parts and installing them in a data center.
- **Maintenance score (Logan, batch 46).** Monthly upkeep per unit = maintenance score × the **maintenance price** (about $50 at start, moved by the energy price index and local wages) **(T)**. The maintenance score **also factors into the energy system**: a data center's power demand on the grid scales with the total maintenance score of the compute it holds, so GPU-heavy data centers pull the most power (10.6, 6.7.2) **(A)**. So a GPU unit costs 25 times as much to keep running as a data compute unit. Skipping maintenance lowers the units' output and raises breakdown events.
- **Mapping to Techno-Capital (Logan, batch 46).** GPU compute is the AI compute of [6-technocapital.md](6-technocapital.md) (H): 1 unit of GPU compute delivers 1 H a month.

## 15.3 Data centers (Logan)

- **Onsite data centers.** A company can put a data center in **any city where it holds business assets or real estate** (10.0.2, 10.4.5). Its size is limited by the real estate it holds or rents there and by power.
- **Leased space in cloud data centers.** Cloud companies own large data centers and **lease space to other companies**, who install their own compute units there. The lease is paid monthly per unit of space **(A)**.
- **Cloud companies** are companies with business units in the Cloud or Data centers industries (10). Their data centers are the business assets of those units (10.0.7), on industrial real estate (10.4.5), with power from the electricity price index (10.6).
- A data center has **capacity** (how many units of compute it can hold) and a **power draw**: about 1 kW per base compute unit, 0.3 kW per data compute unit and 5 kW per GPU compute unit **(T)**.
- Idle compute a company owns can be sold to the cloud market at the world price (15.5).

## 15.4 Databases and stored data

- **Data compute is where data lives.** Stored input and output data (14.2.2) takes data compute capacity: 1 unit of data compute stores **100 TB** (Logan, batch 46) and processes it for software.
- **Stored data has value (Logan).** It can be **sold**, **fed into other software**, or **used to train AI models** (6.5). Value depends on its type (transactions, user activity, sensor feeds and so on) and on how many companies want it **(A)**.
- **Data ages (Logan).** Most data loses value as it gets older, about 5% a month **(T)**; some types, such as medical and financial history, keep their value **(A)**.
- **No residency rules (Logan).** Data can be stored and processed in any country. Privacy laws (T2, [4-politics.md](4-politics.md)) can still limit what may be collected or sold, but not where it sits **(A)**.

## 15.5 The cloud (Logan)

- **One world price to start.** Any company can rent base, data or GPU compute from the cloud by the hour at a **world cloud price** per unit, with no contract, like spot compute (6.3.4).
- The price moves with **demand against supply**: supply is all the idle compute that cloud companies (and anyone else) offer; demand is everything companies rent. When GPU demand skyrockets, the GPU cloud price follows **(A)**.
- **Cloud revenue** goes to the owners of the compute being rented, in proportion to what they offer **(A)**.
- The **cloud bill** is what a company pays each month for the compute it rents. It rises and falls as the company scales its software instances (14.2.2).
- **Later**: cloud provider contracts (reserved capacity, discounts, exclusive GPU allocations) through the contracts system (14.4).

## 15.6 Own or rent? (A)

| | Own compute (onsite or leased space) | Rent from the cloud |
|---|---|---|
| Up front | Parts and installation | None |
| Monthly | Maintenance (score × maintenance price), plus the space lease if in a cloud data center | The world cloud price × units × hours |
| Scaling | Slow: buying parts and installing them takes weeks | Instant |
| Control | Full; secret tasks allowed (6.3.4) | None; the provider sees the usage |
| Risk | Breakdowns and power cuts at the data center | Price spikes when demand rises, above all for GPUs |

## 15.7 How it connects

| System | Link |
|---|---|
| Software (14) | Instances need base, data or GPU compute; scaling changes the owned load or the cloud bill |
| Techno-Capital (6) | GPU compute is the H of Techno-Capital; GPU parts come from the GPUs industry |
| Economy (10) | Data centers are business assets of Data centers units; parts come from the electronics and semiconductor industries; cloud revenue counts in the Cloud and data centers industry |
| Events (13) | An Infrastructure deck: *Outage*, *Power Cut*, *GPU Price Spike*, *Rack Fire* |

## 15.8 Assumptions and open items

1. The maintenance price and how maintenance turns into grid power demand in 15.2.
2. Data center capacity, space leases and power draw in 15.3.
3. Data value and ageing in 15.4.
4. How the world cloud price moves and who earns from it in 15.5.
5. The own versus rent comparison in 15.6.
