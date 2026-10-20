# 6. Techno-Capital: detailed design

_Status: draft v0.4 (2026-10-20). Batch 158 (Logan): robotaxi revenue is flat (no PF). Batch 151 (Logan): AI boom moves to 2030, bubble to 2040 on average; AI starts tiny with low growth, then unprecedented growth. In 6.7.0 AI GPU demand grows +5% a year before the boom trigger (was +3% a month), the default trigger is the tipped lab's 2030 chatbot, and the reference case is recomputed; the Chinese GPU maker is cut off by the 2031 export controls **(A)**. Consistency pass 3 (batch 129): the gigacluster's influence bonus in 6.7.5 now matches 6.8.2 (×2, not "+2 influence weight"). Batch 125 (Logan): every value is in USD in the simulation; local currencies are flavor only; FX is post-POC; one world base rate from the Federal Monetary Board. The market-making desk's currency pairs are post-POC (6.6.4). Batch 121: only national governments, so a data center is a stake in national politics. Batch 118: EU4-style map; Techno-Capital pools, clusters and fleets sit in a **location** (a Metro, or a single province outside any Metro) instead of a hub; district-level tasks become province-level. Batch 116: the fab, yield, wafer, lithography tool, fab level and chip generation simulation is cut; chips are the Semiconductors industry and act through dollar effects on business units; compute is measured only by the glossary in [15-infrastructure.md](15-infrastructure.md) 15.2.1; models have a quality per capability, not one Quality; no insider route, no crypto mining, no tech tiers (R&D and productivity instead); no dynasties. v0.2, consistency pass, batch 74: no GPU supply chain, model prices follow capability quality, no model theft or mind uploads, hacking replaces netruns. v0.1 (2026-10-16), requested by Logan. Techno-Capital is the machine capital of the cyberpunk economy: compute, drones, autonomous vehicles, robots and AI models. Many actions in the game have a **Techno-Capital requirement**: the right machines must be allocated to the task for it to run, or to run to completion. AI, data centers and chips are the heart of the early game. Compute and stored data are held and measured as in [15-infrastructure.md](15-infrastructure.md) (the compute glossary is 15.2.1), models as in [18-ai-models.md](18-ai-models.md), and the Semiconductors and AI labs industries are in [10-industry-economy.md](10-industry-economy.md) 10.3. Chips themselves are not Techno-Capital: Semiconductors units earn dollars like any other business unit. Owner: Logan._

Money buys almost everything in TechnoCapital20FF. Techno-Capital is the exception: there is never enough of it, its parts come from a handful of companies in a handful of cities, and governments fight over who may own it. A character with $10B and no compute cannot train a model, run a drone fleet or serve a model to customers. A company that holds a big share of the world's GPU compute can decide who trains at all.

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Formulas are written so each term can be shown in a tooltip.

**Decided rules kept intact.** Techno-Capital is held by corporations, not by their business units, and is not a business asset ([10-industry-economy.md](10-industry-economy.md) 10.0.7). Vassals are held by companies, so Techno-Capital is held by companies too.

---

## 6.1 Core concepts and cadence

### 6.1.1 What counts as Techno-Capital

Techno-Capital (TC) is any productive machine stock that can be **allocated** between uses. Five pools:

| Pool | Unit | Comes from | Lives in | Logan's list |
|---|---|---|---|---|
| **Compute** | Base, data and GPU units, with **H** = one GPU unit running for a month (glossary, [15-infrastructure.md](15-infrastructure.md) 15.2.1) | Parts bought from the Semiconductors industry (15.2) | Data centers (15.3) | Yes |
| **Drones** | Drones, by class (commercial, military) | The Drones industry (6.2.3) | Fleets based in a location | Yes |
| **Autonomous vehicles** | Vehicles (robotaxis, autonomous trucks) | EVs plus autonomy kits (6.2.3) | Fleets based in a location | Yes ("automated cars") |
| **Robots** | Industrial robots; humanoid robots late game | The Robotics industry | Working for the company's business units, or in storage | Added (assumption 6.15) |
| **Models** | A trained AI model, with a quality per capability ([18-ai-models.md](18-ai-models.md) 18.2) | Training runs (6.5) | Held as an intangible by a company; runs on compute | Added (assumption 6.15) |

- **Removed (batch 116):** foundry capacity and lithography tools are no longer Techno-Capital. Foundries and lithography machines are part of the business assets of Semiconductors units (one dollar figure, 10.0.7), so there are no wafer, fab level, tool or yield counts.

Models are not a machine, but they behave like one: they are scarce, they go obsolete, and they need compute to run. They cannot be stolen (Logan, batch 73). They are the TC that turns compute into work.

### 6.1.2 Key terms

| Term | Meaning |
|---|---|
| **Pool** | All of one TC type a company controls, broken down by **location**: a Metro, or a single province outside any Metro ([2-map-and-influence.md](2-map-and-influence.md) 2.3.2) **(A)** |
| **Allocation** | Assigning TC to a **task**. Allocated TC does nothing else |
| **Leased out** | The default use: TC that is not allocated is **leased, not sold**. Its use is rented to others by contract or on the spot market, and the owner keeps the machine (6.3.4). The machines themselves can also be bought and sold as assets (6.3.5) |
| **Own production** | TC used in the company's own business (robots in its own units, compute running its own software) counts as allocated to it |
| **Requirement** | What a task needs: pool, amount, minimum class or model capability, location, and control level (6.3) |
| **Fill** | Allocated amount ÷ required amount for a task, 0 to 100% |
| **Control level** | How the company holds the TC: **Owned** (it owns the machines), **Leased** (it agreed to pay a set amount for a set time to use them), **Spot** (expensive, on demand, no commitment) or **Compromised** (it is secretly using TC someone else owns, while they use it or while it sits idle, 6.9.3) |
| **Lease rate** | The market price of using one unit of TC for a period. For compute it comes from the world cloud price (15.5, 15.2.1) |
| **Generation** | Only a label for the size of a model's training run (6.4.2). Compute has no hardware generations (batch 116) |

### 6.1.3 Cadence

| Interval | Techno-Capital calculations |
|---|---|
| **Hourly** | Allocation changes for compute and models take effect at the next turn; training runs, hacks (17-hacking) and trading strategies progress; hot events (loss spikes, outages, cyberattacks) |
| **Daily** | Drone and vehicle fleet moves between provinces of one Metro; spot availability |
| **Weekly** | Fleet operations (delivery, security, survey) resolve; robot and drone redeployments between locations complete |
| **Monthly** | TC depreciation, task upkeep billing |

---

## 6.2 The pools in detail

### 6.2.1 Compute

- **Capacity**: a company's compute is its GPU compute units (15.2): each gives 1 H a month (15.2.1), scaled by power and maintenance (15.2).
- **Leased out**: compute not allocated is leased to others or offered on the cloud (6.3.4, 15.5); the owner keeps the servers.
- **Allocating** compute to a task costs nothing in cash but gives up that lease income: the **opportunity cost** shown in every task tooltip is the lease income forgone.
- Software that needs GPU compute ([14-software.md](14-software.md)) takes it from the company's own pool before the cloud. This is the simplest kind of allocation and happens by default.
- **Clusters**: compute in one location held by one company (Owned, Leased, or Spot from a single provider) forms a **cluster**. Large training runs need a single cluster (6.5.2). Compute in different locations cannot be added together for those tasks.

### 6.2.2 Foundry capacity and lithography tools

Removed (batch 116): there is no foundry, wafer, fab level, lithography tool, service or yield simulation. Chipmaking is the Semiconductors industry (10.3), whose units earn dollars like any other; export controls and Eindhoven's lead act on those units as dollar effects (6.9.1).

### 6.2.3 Drones, autonomous vehicles and robots

Drones are bought from the Drones industry, autonomy kits from the EVs and Autos industries, and robots from the Robotics industry (10.3), at their price indexes. Base prices **(T)**: a commercial drone about $4,000, an autonomy kit about $6,000.

| Pool | Unit | Upkeep per month **(T)** | Life | Notes |
|---|---|---|---|---|
| **Commercial drones** | drone | 3% of price; 5 H per 1,000 drones (fleet control) | 3 years | Delivery, survey, inspection, filming, crowd surveillance |
| **Military drones** | drone | 3% of price; 20 H per 1,000 drones | 4 years | Corporate security and defense contracts |
| **Robotaxis** | vehicle (EV + autonomy kit) | 2% of price; 50 H per 1,000 vehicles | 6 years | Ride-hailing service (6.6.5) |
| **Autonomous trucks** | vehicle (EV + autonomy kit, freight body) | 2% of price; 50 H per 1,000 vehicles | 6 years | Autonomous freight for Logistics and Shipping units |
| **Industrial robots** | robot | 2% of price | 8 years | Work in the company's business units; spare robots are stored and can be redeployed |
| **Humanoid robots** | robot | 3% of price; 10 H per 100 robots | 5 years | Late game (a Robotics unit at productivity 130, 6.4.3): fill Unskilled jobs at 1.2 productivity; banned under L3 Heavy in some countries **(T)** |

- Fleets are **based in a location** and work there; moving a fleet to another location takes 1 week by road or air freight (air for drones), plus permits under T3 Risk-Based or stricter.
- Fleets need **fleet control compute** (the H column). If the compute is missing, the fleet works at the compute fill. A robotaxi fleet whose compute goes offline stops.

### 6.2.4 Models

A model has a **quality for each capability** it has ([18-ai-models.md](18-ai-models.md) 18.2), set by its training run and data (6.5.3, 18.3), plus a **Generation** label for the run's size. There is no single model quality (batch 116). A company can hold several models. Models do nothing on their own; they are **deployed** onto compute:

- **Rented** to customers through contracts ([18-ai-models.md](18-ai-models.md) 18.4).
- **Served** inside the company: AI-native offices, autonomous corporate agents, AI advisors, synthetic media, AI-assisted research (6.6).
- **Open-weighted**: released for free. Everyone gets a copy at -10 quality in each capability; the owner gains Fame and Accelerationist alignment (5-ideology 5.9.2) but loses license revenue on it.

---

## 6.3 Requirements and allocation

### 6.3.1 Requirement types

Every task that needs TC lists its requirement as one of three types **(T)**:

| Type | Rule | Example |
|---|---|---|
| **Gate** | The task cannot start without 100% fill, and pauses whenever fill drops below 100% | A frontier training run needs its full cluster |
| **Rate** | The task progresses at `fill × base speed`. Fill above 100% speeds it up with diminishing returns: speed = `fill ^ 0.5` above 1.0, capped at 1.5× | R&D compute, drone surveys, fine-tuning |
| **Upkeep** | The task keeps working only while it is fed every hour or month; output scales with fill | Robotaxi service, an AI advisor, a running psyop |

A requirement also names:

- **Minimum class or capability**: a fleet class (6.2.3), or a model with a given capability and quality (18.2).
- **Location**: *Same location* (fleets, colocated trading), *Same country* (government contracts; there are no data residency rules, 15.4), *Any* (most compute tasks), or *Single cluster* (training runs).
- **Control level**: which control levels the task accepts. Most tasks accept Owned, Leased or Spot. Secret tasks (hacks, illegal surveillance, training under a Moratorium) need Owned or Compromised, because leased and spot use is on the provider's books. Training runs accept Compromised only if the whole cluster is one compromised site.

### 6.3.2 Paused and interrupted tasks

- A **Gate** task that loses fill pauses. Training runs paused for more than 72 hours lose 5% of their progress per further day (the cluster must restart from a checkpoint) **(T)**.
- A **Rate** task keeps its progress and simply slows.
- An **Upkeep** task loses its effect at once.
- **Spot availability**: spot is the cloud (15.5). It draws only on capacity that owners have put on the cloud and nobody is using, at the world cloud price. Once a spot allocation starts it is not taken back, but it pays the cloud price as it moves; if the cloud's capacity of that type is used up, new spot requests wait in a queue.
- **Compromised access lost**: when a compromise is detected (6.9.3) every task using it loses that fill at once.

### 6.3.3 The allocation screen and priorities

- The **Techno-Capital screen** shows each pool by location: total, **allocated** (by task, including own production), **leased out** (contract), **on spot** (offered, and how much is in use), **idle**, **broken or offline**, and **suspected compromised** (unexplained use, 6.9.3).
- The player sets **priorities 1 to 5** on tasks. When a pool shrinks (outage, sabotage, sanctions, a vassal turning Defiant), the lowest priorities lose fill first.
- **Auto-allocation**: the COO (or the CTO board seat, 6.10.1) fills new tasks from TC on the spot market by default, cheapest lease income forgone first (contract leases are never broken automatically), so the player is not asked every hour.
- Changes take effect at the next hourly turn for compute and models, next day for fleets in the same location, and next week across locations.

### 6.3.4 Owning, leasing, spot and compromised

Techno-Capital is **leased, not sold**. Owners keep the machines and rent out their use. A company gets the use of TC in four ways **(T)**:

| Control | How | Price | Terms |
|---|---|---|---|
| **Owned** | Buy the parts or machines (compute parts from the Semiconductors industry, 15.2, and 6.7.3 when short; fleets and robots, 6.2.3; used, 6.3.5) or build the data center | The asset price, then upkeep | Full control. Secret tasks allowed. Idle capacity can be leased out |
| **Leased** | A lease contract: an agreed amount of TC for an agreed time (1 to 36 months) | The world cloud price at signing × 0.8, fixed for the term, paid monthly, one month's payment as a deposit **(T)**. One standard rate for every term | Guaranteed for the whole term: the lessor cannot take it back. Top allocation priority in a shortage. Breaking early costs 50% of the remaining payments. The lessee may sublease. Leases transfer with the asset if the owner sells it |
| **Spot** | Take spare capacity by the hour from the spot market | The world cloud price (15.5) as it moves, hour by hour | On demand, no commitment, stop any hour. Dearer than a lease and exposed to price spikes. Only available while owners have idle capacity on offer (compute: on the cloud, anywhere; fleets: in the location) |
| **Compromised** | Secretly use TC that someone else owns, while they use it or while it sits idle (6.9.3) | No lease paid; the cost is getting access (a hack, 17-hacking, or a broker's fee of 30% to 60% of the spot price) | Secret, and outside export controls and T3. Can be detected and lost at any time |

Fleets and robots use the same rules: the lease rate for drones, vehicles and robots is 2% of the unit price per month, and spot day rates are 0.1% per day **(T)**.

**For the owner**, unallocated TC can be put on a **lease contract** (steady income at the term-discounted rate), offered on the **spot market** (the cloud for compute: higher price, but income only for the share actually taken, which depends on cloud demand), or held **idle**. The default is the spot market. Leasing compute to a rival's training run is legal, profitable, and sometimes the worst decision a company makes.

### 6.3.5 Buying and selling Techno-Capital

The machines themselves are assets and trade like any other:

- **New** compute parts, drones, autonomy kits and robots come from their industries at their price index (10.3, 10.6), allocated by Allocation Score when GPU parts are short (6.7.3).
- **Used** TC sells at book value to the grey market and sanctioned buyers.
- **Whole business units** (a Data centers unit with its compute) sell under the unit deal rules ([10-industry-economy.md](10-industry-economy.md) 10.5.4); data centers as in 15.3.
- Selling TC that is leased out sells it **with its leases**: the buyer collects the lease payments until they end.

---

## 6.4 Generations, research and efficiency

### 6.4.1 Hardware generations

Removed (batch 116): there are no hardware or chip generations, node prices or used-node curves. A GPU unit is a GPU unit (15.2.1); Semiconductors units get better through R&D and productivity like any other unit (10.0.4).

### 6.4.2 Model generations

A model's Generation is only a label for how much compute its training run used (6.5.2). Each Generation needs 4× the compute of the last.

### 6.4.3 R&D and productivity instead of tech tiers (batch 116)

There are no tech tiers or research projects. Where a task here once needed a tier, it now needs a **business unit in the matching industry at a productivity threshold**: the old tier 2 is productivity 100, tier 3 is 115 and tier 4 is 130 **(T)**. A company gets there through its R&D plan (10.0.4).

| Old tier group | Unit that counts |
|---|---|
| Digital | AI labs |
| Semiconductors | Semiconductors |
| Mobility | EVs or Autos |
| Logistics | Logistics |
| Materials | Robotics |
| Biotech | Pharma |

**Efficiency.** Every compute requirement in this file is multiplied by `100 ÷ productivity of the company's best AI labs unit`, clamped ×0.75 to ×1.3; with no AI labs unit it is ×1.3 **(T)**. Algorithmic progress is as valuable as hardware.

---

## 6.5 Training runs: the flagship task

### 6.5.1 Why it matters

Training runs are the early game's big bet. A Venture-rank AI lab (1-corporate-core 1.7.5) lives or dies on getting its first model out before the money runs out, and chips, data centers and power all sit behind each run.

### 6.5.2 Requirement

| Model Generation | Total compute **(T)** | Minimum length | Requirement | Other inputs |
|---|---|---|---|---|
| Gen 1 | 60,000 H | 3 months | Gate, single cluster (Owned, Leased or Spot; Compromised only as one whole site) | User data 10 DU, research lead |
| Gen 2 | 240,000 H | 4 months | Gate, single cluster | User data 30 DU |
| Gen 3 | 960,000 H | 6 months | Gate, single cluster; T3 Licensed Models needs a licence | User data 80 DU, an AI labs unit at productivity 115 (6.4.3) |
| Gen 4 | 3,840,000 H | 6 months | Gate, single cluster ("gigacluster", 6.7.5) | User data 200 DU, AI labs at 115 |
| Gen 5 | 15,360,000 H | 9 months | Gate, single cluster | User data 500 DU, AI labs at 130 |

- The cluster must deliver at least `total ÷ minimum length` per month. Gen 1 needs 20,000 H per month: 20,000 GPU units in one cluster (15.2.1). Gen 3 needs 160,000 GPU units. Data and DU are read as stored TB in [18-ai-models.md](18-ai-models.md) 18.3.
- All totals are multiplied by the efficiency of 6.4.3.
- **Fine-tuning** (+5 to +10 quality in one capability, 18.2): 5% of the base model's training compute, Rate type, any location **(T)**.

### 6.5.3 Run score and capability quality

`Run score = 50 + 2 × (research lead Tech - 10) + (best AI labs productivity - 100) ÷ 3 + data bonus + events`, clamped 40 to 100 **(T)**

- Each capability's quality is the run score scaled by how much matching data went in ([18-ai-models.md](18-ai-models.md) 18.3). There is no single model quality (batch 116).
- **Data bonus**: +1 per 10% of user data above the requirement (cap +10). Data under T2 Strict counts at half (privacy rules shrink usable data).
- **Events** during the run: Loss Spike (-5 unless the lead handles it, 6.13), Data Contamination (-10, found by an Intrigue check), Breakthrough (+8).

### 6.5.4 Hourly play

A Gen 3 run lasts about 4,400 hourly turns. The run is a progress bar on the Techno-Capital screen with **hot moments**: loss spikes, node failures (1 per 10,000 H per day, auto-handled unless above 5% of the cluster), a regulator's inspection under T3 Licensed Models, a Pause Front sit-in at the data center (5-ideology 5.7.2), or a rival's hackers going after the training data (17-hacking 17.4).

### 6.5.5 What the model is worth

- **Licences** (batch 116): a model is sold on the one standard licence offer, priced by usage (14.4, 18.4). The owner sets the price, guided by the pricing screen (14.4.1) and the quality of the capabilities licensees use. There is no frontier pricing (Logan, batch 74) and no special terms.
- **Serving cost**: the owner runs copies of the model to handle its licensees' jobs, each copy needing the model's size in GPU units (18.2.1) (Upkeep, any location) **(T)**.
- **Models cannot be stolen** (Logan, batch 73). Hackers can still steal the training data (17.4).

---

## 6.6 Tasks that need Techno-Capital

The full requirement list. **Opp. cost** is the market value of the TC at base prices, shown to make allocation choices clear.

### 6.6.1 Corporate and economic tasks

| Task | Requirement **(T)** | Type | Effect |
|---|---|---|---|
| **Frontier training run** | 6.5.2 | Gate | A new model |
| **Fine-tune** | 5% of the base model's training compute | Rate | +5 to +10 quality in one capability |
| **Serve a model** (licences) | Copies by the model's size and speed (18.2.1) | Upkeep | Licence revenue |
| **Autonomous corporate agent** | 2,000 H per month and a model with Reasoning 70+; an AI labs unit at 130 (6.4.3) | Upkeep | Runs one board task without a character, at the skill of `Reasoning quality ÷ 4` (cap 25) |
| **AI advisor** for a character (3.7) | 50 H per month and a model with Reasoning 50+ | Upkeep | +1 skill per 15 points of Reasoning above 50 in one skill (cap +3); hackable (17-hacking) |
| **R&D compute** (batch 116, replaces tier 3 and 4 research) | 1,000 H per month per $100M a year of R&D spend in an AI labs, Semiconductors, Pharma or Defense unit | Rate | Without it that unit's R&D moves productivity at half effect (10.0.4) |
| **Drug discovery sprint** | 20,000 H, a model with Reasoning 60+ | Rate | A Pharma unit's productivity +5 over 6 months |
| **Drone delivery** | 200 commercial drones per location served; a Logistics unit at 115 | Upkeep | Last-mile cost -40% for the company's retail and e-commerce units in that location |
| **Resource survey** | 20 commercial drones for 2 months in a province with a mineral resource tag | Rate | A Mining unit's productivity +3 for a year on its assets in that province |
| **Infrastructure inspection** | 10 drones per infrastructure asset | Upkeep | Condition falls 0.5 per month instead of 1 |

### 6.6.2 Semiconductor tasks

Removed (batch 116): no fab, yield ramp, tape-out, custom accelerator, next-generation design or lithography R&D tasks. Chip work is the R&D of Semiconductors units (10.0.4), helped by R&D compute (6.6.1).

### 6.6.3 Fab yield

Removed (batch 116): there is no yield.

### 6.6.4 Finance tasks (links to [3-markets-and-fx.md](3-markets-and-fx.md))

| Task | Requirement **(T)** | Type | Effect |
|---|---|---|---|
| **Quant strategy** | 500 H per month per strategy, Same location as the exchange (colocation) | Upkeep | +1% yearly return edge on the strategy's capital, cap $2B per strategy; halved under F4 Strict, banned short side under Draconian |
| **Market-making desk** | 1,000 H per month, Same location | Upkeep | Earns the bid-ask spread on one stock or currency pair (currency pairs are post-POC: not simulated, batch 125); spreads narrow 30% for that asset |
| **Due diligence AI** | 2,000 H per deal, a model with Reasoning 50+ | Rate | Reveals hidden liabilities and shells in M&A targets (+30% discovery) |

Crypto mining is removed (batch 116): crypto lives only in the phone tab ([9-gambling.md](9-gambling.md)).

### 6.6.5 Fleet services

| Task | Requirement **(T)** | Type | Effect |
|---|---|---|---|
| **Robotaxi service** | At least 500 robotaxis in a location; T3 certification (8 weeks under Risk-Based); an EVs or Autos unit at 130 (6.4.3) | Upkeep | Revenue per robotaxi $4,500 per month (flat since batch 158); displaces Gig drivers (Gig jobs -5% in the location per 5,000 robotaxis), feeding Neo-Luddite drift (5-ideology 5.5.2) |
| **Executive transport** | 2 robotaxis per protected character, armored | Upkeep | Kidnap risk on the road ÷2 (2.21.8) |
| **Delivery network** | As drone delivery | Upkeep | As above |

### 6.6.6 Political and intrigue tasks (links to [4-politics.md](4-politics.md))

| Task | Requirement **(T)** | Type | Effect |
|---|---|---|---|
| **Micro-targeted campaign** | 1 H per 10,000 adults in the constituency per month, a model with Language 50+ | Upkeep | Ads term +0.15 on top of normal ads (4.6.3); exposure +2 under T2 Strict |
| **Synthetic psyop** | 1,000 H per month, a model with the Generation (media) capability at 50+ | Upkeep | Psyop cost -40% and discovery -20% (stacks with the synthetic media method) |
| **Cyber defense** | 1,000 H per month per company | Upkeep | Hack success against the company -30% ([17-hacking.md](17-hacking.md); stacks with a cyber defense team, 4.23) |
| **Surveillance coverage** | 10 drones and 100 H per month per province | Upkeep | Surveillance feeds 1 per province; scheme detection ×1.2 in that province; needs T4 Expanded or above for public spaces |
| **Drone wing** (4.23) | 5 military drones per month replaced, plus fleet control | Upkeep | Security Strength 20 |
| **Sovereign AI contract** (government contract, 4.9.7) | 50,000 H per month in the client country, a model with Reasoning 70+ | Upkeep | Contract revenue; +10 government attitude; the owner sees the government's data (an intelligence hook, 4.26) |

### 6.6.7 Late-game tasks

| Task | Requirement **(T)** | Type | Effect |
|---|---|---|---|
| **Gigacluster** | 6.7.5 | Gate | Gen 4+ training |
| **Humanoid workforce** | Humanoid robots plus 10 H per 100 per month | Upkeep | Fills Unskilled jobs at 1.2 productivity |

---

## 6.7 Building Techno-Capital

### 6.7.0 GPUs and the AI boom

There are **no supply chains** (Logan, batch 50): **Semiconductors** is one industry covering lithography, foundries, GPUs and CPUs (batch 116; [10-industry-economy.md](10-industry-economy.md) 10.3, 10.6). GPU parts and base parts for compute ([15-infrastructure.md](15-infrastructure.md) 15.2) are bought from it at the **chip price index** (10.6). Lithography machines and fabs are part of its units' business assets; Eindhoven's lead in lithography is a large Semiconductors unit there with a location perk, not a separate machine count **(A)**.

**Decided (Logan).** **Consumers and AI compete for the same GPUs.** At the start AI demand, and GPU demand overall, is very low compared with what it becomes. Consumer demand grows at a steady rate; AI demand grows at a really high rate.

#### Demand

GPU demand is part of the Semiconductors industry's market demand (10.0.3), and it moves the chip price index. Reference sizes in dollars **(T)**:

| Buyer | GPU demand per year | Price sensitivity | Growth **(T)** |
|---|---|---|---|
| **Consumers** (gamers, PCs, creators) | $60B at the start **(T)** | High: demand × (index ÷ 100)^-1.2 | +5% a year, steady |
| **AI** (data centers, labs, clouds) | $0.75B at the start **(T)** | Low: demand × (index ÷ 100)^-0.3 | +5% a year before the **boom trigger**: really small AI with low growth (Logan, batch 151; was +3% a month); after it, a boom rate rolled for each save (below) until the crash; -40% at the crash, then +2% a month |

- **Boom speed varies by save** (Logan). The boom starts with a **triggering event**: by default the tipped lab's breakthrough (**2030**, Logan batch 151, was 2025 in batch 92; [7-starting-world.md](7-starting-world.md) 7.7), which can come earlier or later if players change history. At game start the boom rate is rolled between +3% and +10% a month **(T)** (about ×1.4 to ×3.1 a year); the default reference case below uses +6%.
- **Who gets squeezed.** AI buyers barely care about price and consumers care a lot, so a shortage pushes the index up and **pushes gamers out first**: the AI boom starves consumers.
- In the reference case (+6% a month), at a steady price, AI GPU demand is about $1.2B a year at the 2030 trigger, reaches about $2.8B about 14 months after it, $10B after about 3 years, and overtakes consumer demand (both about $136B) after about 6 years and 9 months, in late 2036 **(T)**. Supply grows only as fast as Semiconductors units grow their assets (10.0.4), so the index climbs through the boom.
- **GPU unit price**: a GPU unit's parts cost about $1,500 × chip index ÷ 100, plus its 0.1 base part **(T)**.

#### Developer ecosystem

- Each GPU maker (a corporation with a Semiconductors unit that makes GPUs) has a **developer ecosystem** score from 0 to 100 **(T)**.
- **AI buyers** split their orders by `ecosystem² × availability`. **Consumers** split by `ecosystem × availability`, so they care less **(T)**.
- Ecosystem grows by +1 a month per 10% share of GPUs installed worldwide, and by spending on developer programs ($50M a month for +1, **T**). It falls 1 a month while the maker's Semiconductors unit is below productivity 100.
- **Starting makers**: four or more (Logan). Proposed four **(A)**: a dominant Bay Area designer (ecosystem 80); a second US designer (40); a Korean memory giant's GPU arm in Seoul (20); a Chinese designer in Shenzhen or Beijing (15), cut off from advanced chips by the 2031 US export controls (6.9.1; 7-starting-world 7.2). The world's big clouds can start in-house chip programs later.
- **Founding a GPU maker** is possible but **prohibitively expensive in most market conditions** (Logan): a design team of at least 10 characters with Tech 15 or more at Glitterati pay, and about $1B of R&D spend before its first GPU sells **(T)**. A new maker starts with ecosystem 0, so AI buyers barely order from it until it wins share or spends on developer programs.

### 6.7.2 Power: the hidden gate

- A data center's power draw follows its compute (15.3). New data centers need a **grid connection**: `queue time = 12 weeks × (1 + 2 × max(0, 0.15 - reserve margin) / 0.15)` **(T)**, so a tight grid can delay a data center by up to 9 months.
- **Behind-the-meter power**: a company that owns a power plant or SMR in the same location skips the queue for that plant's capacity and pays its own marginal cost.
- A grid shortfall cuts power fill, and compute falls with it. Data centers are cut early in rationing unless they hold a contracted industrial supply.

### 6.7.3 Getting GPU parts: allocation by relationship

When GPU parts are scarce (chip index above 120), makers do not just sell to the highest bidder. After their regular buyers, **buyers are served by Allocation Score** **(T)**:

`Allocation Score = bid premium % + 10 if the maker's CEO holds the buyer's CEO as Friend (-10 as Rival) + 10 if the buyer has bought for 3+ years + 15 if the buyer is a "strategic partner" (a 5% stake or a joint venture) - 20 if the buyer's country is under export controls`

GPU allocation becomes a CK3 relationship game: dinners with the maker's CEO, a seat on their board, a favor owed.

### 6.7.5 Gigaclusters (megaproject)

A **gigacluster** is a campus of 400,000 or more GPU units in one province, connected as one cluster **(T)**:

- Needs industrial real estate in the province's Industrial pool (2-map-and-influence 2.16), 1 GW of dedicated power (owned plants or a 10-year power contract), and an AI labs unit at 115 (6.4.3).
- Counts as **Critical infrastructure**: its assets count ×2 toward influence in the province (6.8.2), a target for state intelligence (4.26), and a high-Stakes asset in national politics (there is no local government, batch 121).
- Build time 2 to 3 years; cost about $60B **(T)**.

---

## 6.8 Techno-Capital in the world

### 6.8.1 Starting world

| Pool | World total at start **(T)** | Largest holders |
|---|---|---|
| Compute | About 5.8M GPU units (5.8M H a month) | Bay Area and Phoenix AI companies 40%, Beijing state-linked companies 20%, Singapore and Dubai 10% |
| Military drones | About 400,000 | National militaries; Shenzhen-Dongguan makers |
| Robotaxis | About 20,000 | Bay Area, Phoenix, Beijing, Shenzhen-Dongguan |
| Industrial robots | About 4M installed | China 50%, Japan, Korea, Germany, US |
| Frontier models | Two Gen 1 models | Two AI companies (one in the Bay Area, one in Beijing) |

Chipmaking is not TC: the Semiconductors industry's starting units (Hsinchu-Taipei, Seoul-Pyeongtaek, Eindhoven, Phoenix and others) are in [7-starting-world.md](7-starting-world.md) and sized in dollars (10.3).

### 6.8.2 Techno-Capital share and influence

- A company's **compute share** = its Owned and Leased compute ÷ world compute. It appears on the Techno-Capital screen beside its world rank.
- Data centers and Semiconductors units already give influence as assets in their provinces (2.5). A gigacluster counts ×2 **(T)**: governments care about who holds the machines.

### 6.8.3 Monthly node and tool supply

Removed (batch 116): compute parts are bought from the Semiconductors industry at the chip index (10.6); 6.7.3 decides who gets GPU parts when they are short.

---

## 6.9 Controls, theft and crime

### 6.9.1 Export controls

Countries can control TC exports through trade war level 3 and 4 (4.11.5) and sanctions (4.11.4). Controls apply to **four items** **(T)**: Semiconductors exports (chips and lithography machines), GPU parts, the weights of Large and Frontier models (18.2.1), and autonomy kits.

- **Dollar effects** (batch 116): a Semiconductors unit with assets in a controlled country loses 2 productivity a month (cap -30) while controls last, and the chip index there rises 20%; units in the controlling country lose the controlled country's share of their sales (A). There is no tool condition or service count.
- **Remote compute loophole**: renting compute in a third country (Singapore, Dubai, Penang) is legal until the controlling country adds **cloud controls** (a decision under trade war level 4), which make the rental illegal: exposure +5 per month per 1,000 H, as sanctions evasion (4.11.4).
- **Smuggling** GPU parts through shells (1.7.4) and Dubai or Hong Kong trading houses is sanctions evasion: exposure +10 per 1,000 GPU units **(T)**.

### 6.9.2 AI regulation (T3) applied to TC

| T3 position | Effect on TC tasks **(T)** |
|---|---|
| Unregulated | None |
| Risk-Based | Robotaxi service, AI advisors sold to others and Sovereign AI need certification (8 weeks) |
| Licensed Models | Training runs of Gen 3+ in the country need a licence (lobbyable decision, 3 to 6 months); deploying an unlicensed Gen 3+ model is an exposure +5 per month offense |
| Moratorium | No training runs of Gen 3+; no autonomous corporate agents; existing Gen 3+ models may only be served abroad |

A **compute haven** is a country with T3 Unregulated and F2 Open. Training runs move there, and so do the Unshacklers (5-ideology 5.7.2).

### 6.9.3 Compromised Techno-Capital

**Compromised** TC is TC the company is secretly using while its owner uses it or while it sits idle. Only owned TC can be compromised, and only through a hack on it (Logan, batch 69). It is the cyberpunk control level: backdoored data centers, a university cluster running someone else's jobs at night, a hijacked drone fleet that still flies its owner's routes by day.

**Getting access** **(T)**:

| Way | Cost | Notes |
|---|---|---|
| **Intrusion** | A hack against the target ([17-hacking.md](17-hacking.md) 17.3) | Success as in 17 |
| **Broker** | Buy a backdoor a broker's hackers planted (Black market, 17.2) | 30% to 60% of the spot price; the broker knows who bought it |

There is no insider route (batch 70).

**How much can be used**: all of the target site's idle capacity, plus up to 10% of its capacity in use. Taking in-use capacity slows the owner's own tasks by the same share, which makes detection more likely.

**Detection** (monthly per compromised site) = `5% + 1% per 1,000 H (or per 100 drones or vehicles) used per month + 10% if in-use capacity is taken + 15% if the owner runs a cyber defense task (6.6.6) + 2% per CTO Tech point above 10` **(T)**.

On detection: access ends at once; the owner learns who did it unless the user wins an Intrigue check (+10 per cutout, 4.20.4); the user gains exposure +10 with the Data Authority (4.9.1) and the owner gains a casus belli and a lawsuit (4.21.2); a public owner may make it a scandal (Heat 40).

**Why use it**: compromised TC is free, invisible to export controls, T3 licensing and Moratoriums, and leaves no lease on anyone's books. It is the only way to run secret tasks without owning the machines.

### 6.9.4 Stealing TC

Models cannot be stolen (Logan, batch 73); their training data can be (17.4). Hacks against TC run through [17-hacking.md](17-hacking.md).

| Target | Way | Success **(T)** | Result |
|---|---|---|---|
| **Chip plans** | A hack on the owner's TC (17) | As in 17 | Stolen R&D data or plans (17.4); no tech levels to steal |
| **Drone fleet hijack** | A hack (17) | As in 17 | The fleet is lost for 1 to 7 days, or crashed |
| **Semiconductors unit** | Physical theft is impossible; a state can seize the unit's assets in its country (4.9.10) | n/a | The assets change owner |

---

## 6.10 Techno-Capital and the corporate core

### 6.10.1 The CTO board seat

A new board seat (1-corporate-core board, CK3 council style): **Chief Technology Officer** **(T)**.

| Task | Effect |
|---|---|
| **Optimize allocation** | Opportunity cost of allocated TC -1% per Tech point above 10 (cap -15%): better scheduling squeezes more from the same machines |
| **Secure the stack** | Cyber defense effect +20%; theft against the company -10% |
| **Chase allocation** | +1 Allocation Score (6.7.3) per 2 Tech points above 10 |
| **Lead a training run** | The CTO is the research lead (6.5.3) |

### 6.10.2 Vassals and the Techno-Capital levy

The vassal contract (1.7.1) gains a term like a CK3 levy **(T)**:

| Term | Range | Effect |
|---|---|---|
| **Techno-Capital levy** | 0%, 10%, 25%, 50% (100% under Wholly Integrated) | The liege may allocate that share of the vassal's TC to its own tasks at no cost; the vassal loses the sales. -2 loyalty per 10% above 10%; a levy actually called up in a month costs another -3 loyalty that month |

A liege with many vassal data centers can assemble a training run without building anything, at the price of their loyalty. A Defiant vassal can refuse a call-up (1.7.3).

### 6.10.3 Balance sheet and valuation

TC sits on the balance sheet beside compute and software (10.0.8), not as business assets, and depreciates by its life in 6.2.3, or over 5 years for compute **(T)**. Analysts (3-markets) value AI and chip companies on **compute share** and **model quality** as well as earnings: a company holding the highest-quality model in a capability trades at a P/E premium of +50% **(T)**.

---

## 6.11 Ideology links ([5-ideology.md](5-ideology.md))

| Ideology | Attitude to Techno-Capital |
|---|---|
| Accelerationists | Want every gate open: +0.1 alignment (5.9.2) per Gen of the newest model a company holds |
| Landites | Capital is the intelligence: Landite drift +0.5 per 10% of world compute held by the top 3 holders |
| Effective Altruists | Want Gen 3+ runs licensed; Pause Front targets training runs |
| Transhumanists | Want longevity and brain-computer research funded |
| Neo-Luddites | The Unplugged target data centers, robot factories, robotaxi depots; drift +1 per 5,000 robotaxis in a location |
| Communists | Want compute nationalized ("seize the servers"): C5 State Administration applied to data centers first |
| Sovereigntists | Love compute havens and compromised compute |
| Chuds | Hate foreign-owned data centers and human enhancement; like domestic chip champions |
| Liberals | Want export controls and standard licensing, and want them to work |

---

## 6.12 The Machine Sovereign endgame

What politics and Techno-Capital usually mean at each company rank is in [4-politics.md](4-politics.md) 4.28.

**Machine Sovereign** (new endgame for 4.29): hold 25% or more of world compute and the highest-quality model in at least one capability for 5 consecutive years, while owning a Semiconductors unit at productivity 130. Score +2,500 for the player **(T)**.

---

## 6.13 Sample events

| Event | Trigger | Choices and effects **(T)** |
|---|---|---|
| **Loss Spike** | 1% per week during a training run | Roll back to checkpoint (-3% progress) · Push through (Tech check by the lead: success no loss, failure run score -5) |
| **Allocation Cut** | GPU part shortage and Allocation Score in the bottom third | Fly to meet the maker's CEO (a trip, Persuasion check: restore allocation) · Pay +20% · Buy used GPU units from the grey market |
| **Controls Bite** | Export controls hit a Semiconductors unit's country | Lobby the controlling government (4.10) · Ride it out (productivity -2 a month) · Smuggle parts (exposure +15; the loss halved) |
| **Grid Says No** | A data center's connection queue passes 6 months | Build behind-the-meter gas or SMR power · Move the build to another location · Bribe the utility (exposure +5, queue halved) |
| **Robotaxi Kills a Pedestrian** | 0.2% per month per 1,000 robotaxis | Settle and pause (fleet offline 2 weeks) · Blame the victim (scandal Heat 50) · Lobby for a liability cap (T3 Risk-Based) |
| **The Unplugged Come at Night** | Neo-Luddite cell operation against a data center | As 5-ideology 5.7.2; 20% of its GPU compute destroyed |
| **Heatwave** | Summer in Phoenix or Dubai, 10% per year | Cut compute 20% for 3 weeks · Pay triple for water and power · Risk it (25% chance of a 1-week outage) |
| **The Second Maker** | A rival's Semiconductors unit reaches productivity 130 | Buy into them · Lobby for their national champion status · Hack their plans (17) |

---

## 6.14 Worked examples

### 6.14.1 A Founder trains the first model

**Setup.** A Bay Area AI startup (Venture rank) closed a $250M Series B through the VC founding path. Its AI labs unit runs at productivity 100, its CTO has Tech 16, and it licenses 12 DU of user data from a social platform. The GPU cloud price is $2,500 per GPU unit-month at the time; it moves with demand (15.5) **(T)**.

**Requirement.** Gen 1 model: 60,000 H × efficiency 1.0 (6.4.3) = 60,000 H over at least 3 months, so 20,000 GPU units from one cluster.

**Options.**

| Option | Cost | Risk |
|---|---|---|
| Spot on the cloud | 60,000 × $2,500 = $150M, if the price holds | The price rises as the boom builds, and the run stalls if the cloud runs out of GPU capacity mid-run |
| Lease in Phoenix (20,000 GPU units, 12 months) | 20,000 × $2,500 × 0.8 = $40M per month, plus one month's deposit | 9 more months of lease after the run, unless the startup subleases the capacity or uses it to serve the model |
| Buy a broker's backdoor into an idle university cluster in Toronto | About 40% of the spot price, $60M | Detection `5% + 20 × 1%` = 25% per month; the chance of finishing 3 months unseen is `0.75³` = about 42%, and being caught means a lawsuit, exposure and a lost run |

The founder takes the Phoenix lease. By the end of the run it has spent $160M of the $250M round (the $40M deposit plus 3 months of payments), and the model has to pay for the remaining 9 months of the lease.

**The run.** 2,200 hourly turns. In week 6 a Loss Spike fires; the CTO's Tech check (16 vs 15) succeeds. Run score = 50 + 2 × 6 + 0 + data bonus 2 (12 DU against 10) = **64**. Its user activity and text data give it Language 64 and Reasoning about 50 (18.3).

**Revenue.** The startup sells licences on the standard offer (14.4, 18.4) and uses the 9 leased months left to run the model's copies instead of training. The startup is alive, and every AI company in the Bay Area now wants to buy it.

### 6.14.2 Export controls hit Shanghai

A rival's Semiconductors unit based in Shanghai holds $8B of business assets. A trade war reaches Export Controls (level 3).

- The unit loses 2 productivity a month (cap -30): from 105 to 97 after 4 months and 89 after 8, while the chip index in China rises 20%, so revenue holds up for most of a year before the productivity loss wins.
- Options: lobby the controlling government through its holdings there (4.10); smuggle parts through Hong Kong (exposure +15 per month, the loss halved); or sell the unit to a Chinese state champion at the cycle's sale price (10.0.7) before productivity collapses, and take the influence gain with Beijing (+10 government attitude, 4.27.2).

---

## 6.15 Assumptions

1. **Techno-Capital is five pools**: Logan's compute, drones and automated cars, plus **robots** and **AI models**, added because they behave the same way (scarce, allocatable). Foundries and lithography machines left the list in batch 116: they are Semiconductors business assets.
2. **Compute is measured only by the glossary** in [15-infrastructure.md](15-infrastructure.md) 15.2.1 (H = one GPU unit running for a month).
3. **Techno-Capital is leased, not sold** (Logan's rule): unallocated TC is leased out by default, so allocation has an opportunity cost (lease income forgone), not a cash cost. The machines themselves can still be bought and sold.
4. **Three requirement types** (Gate, Rate, Upkeep) and **four control levels**, as defined by Logan: Owned (you own it), Leased (you pay an agreed amount for an agreed time; one standard rate, 80% of the cloud price), Spot (the cloud price, on demand) and Compromised (secretly using TC someone else owns while they use it or it is idle, only through a hack).
5. **Model prices follow capability quality** through the standard licence (14.4, 18.4; Logan, batches 74 and 87): no frontier pricing and no special terms.
6. **No hardware generations or tech tiers** (batch 116); model Generations need 4× compute each; R&D efficiency and task gates come from unit productivity (6.4.3).
7. **Export controls** act as dollar effects on Semiconductors units (6.9.1).
8. **GPU allocation by relationship** (Allocation Score) in shortages.
9. **Drones, autonomy kits and robots** come from their industries (10.3); there are no supply chains.
10. **New board seat**: Chief Technology Officer.
11. **New vassal contract term**: Techno-Capital levy (CK3 levy style).
12. **Power grid connection queues** gate new data centers.
13. **Gigaclusters** are a megaproject and critical infrastructure.
14. **Models cannot be stolen** (batch 73), and there are no mind uploads.
15. **Machine Sovereign** is a new endgame (score +2,500).
16. **Starting world**: about 5.8M GPU units of compute and two Gen 1 frontier models.
17. **GPU demand in dollars** (6.7.0) and Eindhoven's lithography lead as a Semiconductors unit with a location perk.
