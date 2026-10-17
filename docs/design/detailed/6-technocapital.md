# 6. Techno-Capital: detailed design

_Status: draft v0.1 (2026-10-16). Requested by Logan. Techno-Capital is the machine capital of the cyberpunk economy: compute, foundry capacity, lithography machines, drones, autonomous vehicles and robots. Many actions in the game have a **Techno-Capital requirement**: the right machines must be allocated to the task for it to run, or to run to completion. The AI, data center and semiconductor supply chain is the heart of the early game. Builds on [2-map-influence-economy.md](2-map-influence-economy.md) (goods 2.6, facilities 2.7, contracts 2.10, tech tree 2.12). Owner: Logan._

Money buys almost everything in TechnoCapital20FF. Techno-Capital is the exception: there is never enough of it, it is made by a handful of companies in a handful of hubs, it goes obsolete, and governments fight over who may own it. A dynasty with $10B and no compute cannot train a model, run a drone fleet or keep an uploaded ancestor alive. A dynasty that controls a lithography line can decide who gets compute at all.

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Formulas are written so each term can be shown in a tooltip.

**Decided rules kept intact.** Companies own or lease the buildings they produce in (Logan's Victoria 3 rule); Techno-Capital sits inside those buildings or in fleets, and follows the same ownership and lease rules. Vassals are held by companies, so Techno-Capital is held by companies too.

---

## 6.1 Core concepts and cadence

### 6.1.1 What counts as Techno-Capital

Techno-Capital (TC) is any productive machine stock that can be **allocated** between uses. Seven pools:

| Pool | Unit | Made from (2.6) | Lives in | Logan's list |
|---|---|---|---|---|
| **Compute** | **H** = 1,000 accelerator-hours at Generation 1 (the same unit as the cloud compute service in 2.6.6) | AI server nodes in data centers | Data center levels (2.7.8) | Yes |
| **Foundry capacity** | **Wafer starts** per month, by node (mature, memory, advanced, angstrom) | Chip fab levels | Chip fabs (2.7.5) | Yes ("foundries") |
| **Lithography tools** | Machines, by class (DUV, EUV, High-NA) | Lithography systems | Installed in fab levels, or in storage | Yes |
| **Drones** | Drones, by class (commercial, military) | Military drones; commercial drones (new good, 6.2.3) | Fleets based in a hub | Yes |
| **Autonomous vehicles** | Vehicles (robotaxis, autonomous trucks) | EVs plus autonomy kits (new good, 6.2.3) | Fleets based in a hub | Yes ("automated cars") |
| **Robots** | Industrial robots; humanoid robots late game | Industrial robots | Installed in facility levels, or in storage | Added (assumption 6.15) |
| **Models** | A trained AI model, by Generation and Quality | Training runs (6.5) | Held as an intangible by a company; runs on compute | Added (assumption 6.15) |

Models are not a machine, but they behave like one: they are scarce, they go obsolete, they can be stolen, and they need compute to run. They are the TC that turns compute into work.

### 6.1.2 Key terms

| Term | Meaning |
|---|---|
| **Pool** | All of one TC type a company controls, broken down by hub |
| **Allocation** | Assigning TC to a **task**. Allocated TC does nothing else |
| **Leased out** | The default use: TC that is not allocated is **leased, not sold**. Its use is rented to others by contract or on the spot market, and the owner keeps the machine (6.3.4). The machines themselves can also be bought and sold as assets (6.3.5) |
| **Own production** | TC installed in the company's own facility and running its production method (a fab making chips the company sells, robots in its own factory) counts as allocated to that facility |
| **Requirement** | What a task needs: pool, amount, minimum Generation or class, location, and control level (6.3) |
| **Fill** | Allocated amount ÷ required amount for a task, 0 to 100% |
| **Control level** | How the company holds the TC: **Owned** (it owns the machines), **Leased** (it agreed to pay a set amount for a set time to use them), **Spot** (expensive, on demand, no commitment) or **Compromised** (it is secretly using someone else's TC while they use it or while it sits idle, 6.9.3) |
| **Lease rate** | The market price of using one unit of TC for a period. For compute it is the cloud compute price of 2.6.6 ($2,500 per H at base), now read as a lease price, not a sale |
| **Generation** | The technology vintage of compute, models and lithography. Newer generations do more per unit (6.4) |

### 6.1.3 Cadence

| Interval | Techno-Capital calculations |
|---|---|
| **Hourly** | Allocation changes for compute and models take effect at the next turn; training runs, netruns and trading strategies progress; hot events (loss spikes, outages, cyberattacks) |
| **Daily** | Drone and vehicle fleet moves between districts; spot prices and spot availability |
| **Weekly** | Fleet operations (delivery, security, survey) resolve; robot and drone redeployments between hubs complete; foundry queue updates |
| **Monthly** | Fab yield ramps, lithography service and condition, TC depreciation, node supply allocation (6.8.3), task upkeep billing, generation value repricing |
| **Every 24 months (T)** | A new hardware generation becomes available to whoever can make it (6.4) |

---

## 6.2 The pools in detail

### 6.2.1 Compute

- **Capacity** of a data center level = `14,600 H per month × Generation multiplier of its server nodes × power fill × condition factor` (output rules of 2.7.1).
- **Leased out**: compute not allocated is leased to others, by contract or on the spot market (6.3.4). "Selling cloud compute" in 2.6.6 and 2.7.8 means leasing compute time; the owner keeps the servers.
- **Allocating** compute to a task costs nothing in cash but gives up that lease income: the **opportunity cost** shown in every task tooltip is the lease income forgone.
- Any production method that lists cloud compute as an input (AI-augmented offices, cashierless retail, social platforms and so on, 2.7.8) can take it from the company's own pool instead of the market. This is the simplest kind of allocation and happens by default when the company has spare compute in the same country.
- **Clusters**: compute in one hub held by one company (Owned, Leased, or Spot from a single provider) forms a **cluster**. Large training runs need a single cluster (6.5.2). Compute in different hubs cannot be added together for those tasks.

### 6.2.2 Foundry capacity and lithography tools

- **Foundry capacity** is a fab level's wafer starts per month (2.7.5: mature 10,000, memory 20,000, advanced 5,000). A fab owner can run its own chips through it (own production) or lease **foundry slots** to fabless chip designers, who supply the design and pay per wafer start (6.6.2). Idle foundry capacity goes on the slot lease market.
- **Lithography tools** are the lithography systems installed in fab levels (2.7.2: memory 4, advanced 10). They are the rarest TC in the game: one supplier in Eindhoven at start, $200M each for EUV and $380M for High-NA (6.7.0), made at about 4 per month worldwide **(T)**.

| Class | Needed for | Starting makers | Tech |
|---|---|---|---|
| **DUV** | Mature and memory nodes (4 per memory level; mature levels use older DUV tools bundled into their robots and build cost) | Eindhoven, Tokyo-Yokohama | Semiconductors 2 |
| **EUV** | Advanced node (10 per level) | Eindhoven only | Semiconductors 4 (proprietary) |
| **High-NA EUV** | Angstrom node (12 per level, output ×1.4) | Eindhoven only, from the first generation step (6.4) | Semiconductors 4 plus a Generation 2 research project |

- **Service**: each tool needs a **service contract** with its maker: 4% of its price per year **(T)**. Without service, tool condition falls 5 per month instead of 1, and the fab level's yield falls with it (6.6.3). The maker can stop servicing a country under export controls (6.9.1). This is the strongest single lever in the game's economy.
- **Moving tools** between fabs takes 8 weeks and an export licence if it crosses a border **(T)**.

### 6.2.3 Drones, autonomous vehicles and robots

Two new goods support these pools **(T)**:

| Good | Unit | Base price | Main inputs | Made by | Tech |
|---|---|---|---|---|---|
| **Commercial drones** | unit | $4,000 | Mature chips 3, sensors 2, electric motors 0.05, battery cells 1 kWh, plastics 0.005 t | Machinery plant (drone line) | Logistics 2 or Security 2 |
| **Autonomy kits** | kit for 1 vehicle | $6,000 | Advanced chips 4, sensors 12, telecom equipment 0.005, mature chips 10 | Component plant | Mobility 3 |

| Pool | Unit | Upkeep per month **(T)** | Life | Notes |
|---|---|---|---|---|
| **Commercial drones** | drone | 3% of price; 5 H per 1,000 drones (fleet control) | 3 years | Delivery, survey, inspection, filming, crowd surveillance |
| **Military drones** | drone | 3% of price; 20 H per 1,000 drones | 4 years | Security, PMC, defense contracts; need S1 Licensed for armed use |
| **Robotaxis** | vehicle (EV + autonomy kit) | 2% of price; 50 H per 1,000 vehicles | 6 years | Ride-hailing service (6.6.5) |
| **Autonomous trucks** | vehicle (EV + autonomy kit, freight body) | 2% of price; 50 H per 1,000 vehicles | 6 years | Replace trucking legs and depot fuel (2.7.8 Autonomous fleet method) |
| **Industrial robots** | robot | robot wear as in 2.7.8 | 8 years | Installed in facility levels; spare robots are stored and can be redeployed |
| **Humanoid robots** | robot | 3% of price; 10 H per 100 robots | 5 years | Late game (Materials 4 and Digital 4): fill Unskilled jobs at 1.2 productivity in any method; banned under L3 Heavy in some countries **(T)** |

- Fleets are **based in a hub** and work there; moving a fleet to another hub takes 1 week by road or air freight (air for drones), plus permits under T3 Risk-Based or stricter.
- Fleets need **fleet control compute** (the H column). If the compute is missing, the fleet works at the compute fill. A robotaxi fleet whose compute goes offline stops.

### 6.2.4 Models

A model has a **Generation** (1 to 5+) and a **Quality** (40 to 100) set by its training run (6.5.3). A company can hold several models. Models do nothing on their own; they are **deployed** onto compute:

- **Licensed** to customers as the AI models good (2.6.7).
- **Served** inside the company: AI-native offices, autonomous corporate agents, AI advisors, synthetic media, AI-assisted research (6.6).
- **Open-weighted**: released for free. Everyone gets a copy at Quality -10; the owner gains brand and Accelerationist alignment (5-ideology 5.9.2) but loses license revenue on it.

---

## 6.3 Requirements and allocation

### 6.3.1 Requirement types

Every task that needs TC lists its requirement as one of three types **(T)**:

| Type | Rule | Example |
|---|---|---|
| **Gate** | The task cannot start without 100% fill, and pauses whenever fill drops below 100% | A fab level needs its 10 EUV tools; a frontier training run needs its full cluster |
| **Rate** | The task progresses at `fill × base speed`. Fill above 100% speeds it up with diminishing returns: speed = `fill ^ 0.5` above 1.0, capped at 1.5× | Research projects, drone surveys, chip tape-outs |
| **Upkeep** | The task keeps working only while it is fed every hour or month; output scales with fill | Robotaxi service, an AI advisor, a running psyop, an uploaded mind |

A requirement also names:

- **Minimum Generation or class**: older TC may not count, or counts at its Generation multiplier (6.4).
- **Location**: *Same hub* (fleets, colocated trading), *Same country* (data sovereignty, government contracts), *Any* (most compute tasks), or *Single cluster* (training runs).
- **Control level**: which control levels the task accepts. Most tasks accept Owned, Leased or Spot. Secret tasks (netruns, illegal surveillance, training under a Moratorium) need Owned or Compromised, because leased and spot use is on the provider's books. Training runs accept Compromised only if the whole cluster is one compromised site.

### 6.3.2 Paused and interrupted tasks

- A **Gate** task that loses fill pauses. Training runs paused for more than 72 hours lose 5% of their progress per further day (the cluster must restart from a checkpoint) **(T)**.
- A **Rate** task keeps its progress and simply slows.
- An **Upkeep** task loses its effect at once; an uploaded mind with no compute is **suspended** (6.7.4).
- **Spot availability**: spot draws only on capacity that owners have put on the spot market and nobody is using. Once a spot allocation starts it is not taken back, but its price is reset daily; if the hub's spot capacity is used up, new spot requests wait in a queue.
- **Compromised access lost**: when a compromise is detected (6.9.3) every task using it loses that fill at once.

### 6.3.3 The allocation screen and priorities

- The **Techno-Capital screen** shows each pool by hub: total, **allocated** (by task, including own production), **leased out** (contract), **on spot** (offered, and how much is in use), **idle**, **broken or offline**, and **suspected compromised** (unexplained use, 6.9.3).
- The player sets **priorities 1 to 5** on tasks. When a pool shrinks (outage, sabotage, sanctions, a vassal turning Defiant), the lowest priorities lose fill first.
- **Auto-allocation**: the COO (or the CTO board seat, 6.10.1) fills new tasks from TC on the spot market by default, cheapest lease income forgone first (contract leases are never broken automatically), so the player is not asked every hour.
- Changes take effect at the next hourly turn for compute and models, next day for fleets in the same hub, next week across hubs, and 8 weeks for lithography tools.

### 6.3.4 Owning, leasing, spot and compromised

Techno-Capital is **leased, not sold**. Owners keep the machines and rent out their use. A company gets the use of TC in four ways **(T)**:

| Control | How | Price | Terms |
|---|---|---|---|
| **Owned** | Buy the machines (new from makers, 6.7.3; used, 6.4.1) or build the facility | The asset price, then upkeep | Full control. Secret tasks allowed. Idle capacity can be leased out |
| **Leased** | A lease contract: an agreed amount of TC for an agreed time (1 to 36 months) | Lease rate × term discount (1 to 5 months ×1.0, 6 to 11 ×0.95, 12 to 23 ×0.9, 24 to 36 ×0.85), paid monthly, one month's payment as a deposit | Guaranteed for the whole term: the lessor cannot take it back. Top allocation priority in a shortage (as capacity reservations in 2.10.3). Breaking early costs 50% of the remaining payments. The lessee may sublease. Leases transfer with the asset if the owner sells it |
| **Spot** | Take spare capacity by the hour from the spot market | `Lease rate × (1.6 + 2 × max(0, R - 1))`, where R is the hub's tightness (2.9.2) | On demand, no commitment, stop any hour. Expensive. Only available while owners have idle capacity on offer in the hub (compute: anywhere in the country) |
| **Compromised** | Secretly use TC that someone else owns or leases, while they use it or while it sits idle (6.9.3) | No lease paid; the cost is getting access (a netrun, a bribed insider, or a broker's fee of 30% to 60% of the spot price) | Secret, and outside export controls and T3. Can be detected and lost at any time |

Fleets and robots use the same rules: the lease rate for drones, vehicles and robots is 2% of the unit price per month, and spot day rates are 0.1% per day before the tightness markup **(T)**.

**For the owner**, unallocated TC can be put on a **lease contract** (steady income at the term-discounted rate), offered on the **spot market** (higher price, but income only for the share actually taken, which depends on hub demand), or held **idle**. The default is the spot market. Leasing compute to a rival's training run is legal, profitable, and sometimes the worst decision a dynasty makes.

### 6.3.5 Buying and selling Techno-Capital

The machines themselves are assets and trade like any other:

- **New** AI server nodes, lithography tools, drones, autonomy kits and robots come from makers by supply contract or market purchase (2.10), allocated by Allocation Score when short (6.7.3).
- **Used** TC sells at the used price (6.4.1 for nodes; book value for other pools) to the grey market, crypto miners and sanctioned buyers.
- **Whole facilities** (a data center, a fab with its tools) sell under the facility rules of 2.7.2 and 2.16.
- Selling TC that is leased out sells it **with its leases**: the buyer collects the lease payments until they end.

---

## 6.4 Generations and obsolescence

### 6.4.1 Hardware generations

The game starts at **Generation 1** for accelerators. Every 24 months **(T)** the next generation can be designed by any company holding Semiconductors 3 and Digital 3 that runs the **next-generation design** project (6.6.2). Making it needs an advanced or angstrom fab.

| Generation | Compute per AI server node (multiplier) | Node price at launch **(T)** | Fab node needed | Lithography |
|---|---|---|---|---|
| Gen 1 (start) | ×1 | $40,000 | Advanced | EUV |
| Gen 2 | ×2.2 | $52,000 | Advanced | EUV |
| Gen 3 | ×4.8 | $68,000 | Angstrom | High-NA EUV |
| Gen 4 | ×10 | $88,000 | Angstrom | High-NA EUV, plus photonic chips (Semiconductors 4) |
| Gen 5+ | ×2.1 per generation | ×1.3 per generation | Angstrom | Late game research |

- A data center's compute = level capacity × the multiplier of its node mix. Replacement at 2% per month (2.7.8) can buy the newest generation, so data centers modernize slowly unless the owner pays for a **refresh** (replacing all nodes at once: 20,000 nodes × the new price; level offline for 4 weeks).
- **Used node price** = launch price × `0.55 ^ (generations behind the frontier)` **(T)**. Old nodes sell to the grey market, crypto miners and sanctioned countries.

### 6.4.2 Model generations

A model's Generation is set by how much compute its training run used (6.5.2). Each new model generation needs 4× the compute of the last, but hardware improves too, so the same cluster can reach a higher generation after a refresh.

### 6.4.3 Efficiency from research

The Digital tech tier cuts every compute requirement in this file **(T)**: Digital 1 ×1.3, Digital 2 ×1.15, Digital 3 ×1.0, Digital 4 ×0.75. Algorithmic progress is as valuable as hardware.

---

## 6.5 Training runs: the flagship task

### 6.5.1 Why it matters

Training runs are the early game's big bet. A Founder-stage AI lab lives or dies on getting its first frontier model out before the money runs out, and the whole chip supply chain (lithography → fabs → packaging → server nodes → data centers → power) sits behind each run.

### 6.5.2 Requirement

| Model Generation | Total compute **(T)** | Minimum length | Requirement | Other inputs |
|---|---|---|---|---|
| Gen 1 | 60,000 H | 3 months | Gate, single cluster (Owned, Leased or Spot; Compromised only as one whole site) | User data 10 DU, research lead |
| Gen 2 | 240,000 H | 4 months | Gate, single cluster | User data 30 DU |
| Gen 3 | 960,000 H | 6 months | Gate, single cluster; T3 Licensed Models needs a licence | User data 80 DU, Digital 3 |
| Gen 4 | 3,840,000 H | 6 months | Gate, single cluster ("gigacluster", 6.7.5) | User data 200 DU, Digital 3 |
| Gen 5 | 15,360,000 H | 9 months | Gate, single cluster | User data 500 DU, Digital 4 |

- The cluster must deliver at least `total ÷ minimum length` per month. Gen 1 needs 20,000 H per month: about 1.4 data center levels of Generation 1 nodes. Gen 3 needs 160,000 H per month: 11 levels of Gen 1 nodes, or 2.3 levels of Gen 3 nodes. Hardware generations are what make the next model generation affordable.
- All totals are multiplied by the Digital efficiency of 6.4.3.
- **Fine-tuning** (a specialist model one Generation below the base model it starts from, at the base model's Quality +5 in one sector): 5% of the base model's training compute, Rate type, any location **(T)**.

### 6.5.3 Quality

`Quality = 50 + 2 × (research lead Tech - 10) + 5 × (Digital tier - 2) + data bonus + events`, clamped 40 to 100 **(T)**

- **Data bonus**: +1 per 10% of user data above the requirement (cap +10). Data under T2 Strict counts at half (privacy rules shrink usable data).
- **Events** during the run: Loss Spike (-5 unless the lead handles it, 6.13), Data Contamination (-10, found by an Intrigue check), Breakthrough (+8).

### 6.5.4 Hourly play

A Gen 3 run lasts about 4,400 hourly turns. The run is a progress bar on the Techno-Capital screen with **hot moments**: loss spikes, node failures (1 per 10,000 H per day, auto-handled unless above 5% of the cluster), a regulator's inspection under T3 Licensed Models, a Pause Front sit-in at the data center (5-ideology 5.7.2), or a rival's netrunners trying to steal the checkpoint.

### 6.5.5 What the model is worth

- **License price** per license-month = $10M × `2.5 ^ (Gen - frontier Gen)` × Quality / 75 **(T)**, where the frontier Gen is the best model held by anyone. The frontier model sells at full price; one generation behind sells at 40%.
- **Serving cost**: every license-month sold needs 2,000 H of inference compute (Upkeep, any location unless the buyer's country is under T2 Data Sovereignty) **(T)**.
- **Theft**: model weights can be stolen (6.9.4). A stolen model is a copy at the same Generation and Quality.

---

## 6.6 Tasks that need Techno-Capital

The full requirement list. **Opp. cost** is the market value of the TC at base prices, shown to make allocation choices clear.

### 6.6.1 Corporate and economic tasks

| Task | Requirement **(T)** | Type | Effect |
|---|---|---|---|
| **Frontier training run** | 6.5.2 | Gate | A new model |
| **Fine-tune** | 5% of the base model's training compute | Rate | A specialist model |
| **Serve a model** (license sales) | 2,000 H per license-month sold | Upkeep | License revenue |
| **AI-native office level** (2.7.8) | Its cloud compute input (900 H per level) from own pool or market; a model of Gen ≥ 2 | Upkeep | Office output ×1.1 with 85% fewer staff |
| **Autonomous corporate agent** (Digital 4) | 2,000 H per month and a model of Gen ≥ 3 | Upkeep | Runs one board task without a character, at the skill of `8 + 3 × model Gen` (cap 25) |
| **AI advisor** for a character (3.7) | 50 H per month and a model of Gen ≥ 2 | Upkeep | +1 skill per model Gen above 1 in one skill (cap +4); hackable (6.9.4) |
| **AI-assisted research** (2.7.8) | Its cloud compute input | Upkeep | 70 RP per level instead of 40 |
| **Tier 3 research** in Digital, Semiconductors, Biotech, Cyberware or Security | 2,000 H per month while researching | Gate | Research proceeds |
| **Tier 4 research** in those groups | 10,000 H per month while researching | Gate | Research proceeds |
| **Drug discovery sprint** | 20,000 H, a model of Gen ≥ 2 | Rate | A patented molecule (APIs at ×4 price) in 6 months instead of research |
| **Autonomous logistics** (2.7.8 Autonomous fleet method) | 30 autonomous trucks per depot level, plus their fleet control compute | Upkeep | Truck legs from the depot -30% |
| **Drone delivery** (Logistics 3) | 200 commercial drones per hub served | Upkeep | Last-mile cost -40% for the company's retail and e-commerce sales in that hub |
| **Resource survey** | 20 commercial drones for 2 months in a Resource Field district | Rate | Reveals a deposit's grade and size before buying the plot |
| **Infrastructure inspection** | 10 drones per infrastructure asset (2.19) | Upkeep | Condition falls 0.5 per month instead of 1 |
| **Lights-out factory** | All A3 robot requirements of a facility filled from own stock | Gate | The A3 method runs (2.7.1) |

### 6.6.2 Semiconductor tasks

| Task | Requirement **(T)** | Type | Effect |
|---|---|---|---|
| **Run a fab level** | Its lithography tools (memory 4 DUV, advanced 10 EUV, angstrom 12 High-NA) | Gate | Wafer starts |
| **Yield ramp** | 5,000 H per month during a new fab level's first year | Rate | Yield rises 20 points per month instead of 10 (6.6.3) |
| **Chip tape-out** (a custom chip design) | 20,000 H for EDA and simulation, plus 500 test wafer starts at the target node | Rate (compute) and Gate (wafers) | A proprietary chip design, 6 months |
| **Custom accelerator** | A tape-out at advanced node or better, then foundry slots for production | As tape-out | The company's own AI server nodes cost -20% or give ×1.15 compute (designer's choice) |
| **Next-generation design** | 50,000 H, Semiconductors 3, Digital 3, and a tape-out at the required node | Rate, 12 months | The company can make the next hardware generation (6.4.1); it may license the design |
| **Lithography R&D** (break the Eindhoven monopoly) | 30,000 H per month for 5 years, Semiconductors 4 research, precision optics supply | Rate | A second EUV maker; national champion status (E6) |

### 6.6.3 Fab yield

`Yield = min(95%, 40% + ramp points) × tool condition factor` **(T)**

- A new fab level starts at 40% yield and gains 10 points per month (20 with a yield ramp task).
- Tool condition factor = average lithography tool condition ÷ 100. Unserviced tools lose 5 condition per month, so a fab cut off from service loses about 5% of its output a month until it shuts down.
- Output of a fab level = method output × yield ÷ 0.9 (the 2.7.5 method outputs assume 90% yield).

### 6.6.4 Finance tasks (links to [3-markets-and-fx.md](3-markets-and-fx.md))

| Task | Requirement **(T)** | Type | Effect |
|---|---|---|---|
| **Quant strategy** | 500 H per month per strategy, Same hub as the exchange (colocation) | Upkeep | +1% yearly return edge on the strategy's capital, cap $2B per strategy; halved under F4 Strict, banned short side under Draconian |
| **Market-making desk** | 1,000 H per month, Same hub | Upkeep | Earns the bid-ask spread on one stock or currency pair; spreads narrow 30% for that asset |
| **Crypto mining** | Any compute | Upkeep | Mints crypto at `H × $1,800` per month at base, moving with the crypto price (3.23); old Generation nodes are worth the most here |
| **Due diligence AI** | 2,000 H per deal, a model of Gen ≥ 2 | Rate | Reveals hidden liabilities and shells in M&A targets (+30% discovery) |

### 6.6.5 Fleet services

| Task | Requirement **(T)** | Type | Effect |
|---|---|---|---|
| **Robotaxi service** | At least 500 robotaxis in a hub; T3 certification (8 weeks under Risk-Based); Mobility 4 | Upkeep | Revenue per robotaxi `$4,500 × PF` per month; displaces Gig drivers (Gig jobs -5% in the hub per 5,000 robotaxis), feeding Neo-Luddite drift (5-ideology 5.5.2) |
| **Executive transport** | 2 robotaxis per protected character, armored | Upkeep | Kidnap risk on the road ÷2 (2.21.8) |
| **Delivery network** | As drone delivery | Upkeep | As above |

### 6.6.6 Political and intrigue tasks (links to [4-politics.md](4-politics.md))

| Task | Requirement **(T)** | Type | Effect |
|---|---|---|---|
| **Micro-targeted campaign** | 1 H per 10,000 adults in the constituency per month, a model of Gen ≥ 2 | Upkeep | Ads term +0.15 on top of normal ads (4.6.3); exposure +2 under T2 Strict |
| **Synthetic psyop** | 1,000 H per month, a model of Gen ≥ 2 | Upkeep | Psyop cost -40% and discovery -20% (stacks with the synthetic media method) |
| **Netrun scheme** | 500 H, Owned or Compromised | Rate | +10% netrun success per 500 H above the first, cap +30% |
| **Cyber defense** | 1,000 H per month per company | Upkeep | Cyberattack and netrun success against the company -30% (stacks with a cyber defense team, 4.23.2) |
| **Surveillance coverage** | 10 drones and 100 H per month per district | Upkeep | Surveillance feeds 1 per district; scheme detection ×1.2 in that district; needs T4 Expanded or above for public spaces |
| **Drone wing** (4.23.2) | 5 military drones per month replaced, plus fleet control | Upkeep | Security Strength 20 |
| **Sovereign AI contract** (government contract, 4.9.7) | 50,000 H per month in the client country, a model of Gen ≥ 3 | Upkeep | Contract revenue; +10 government attitude; the dynasty sees the government's data (an intelligence hook, 4.26) |

### 6.6.7 Late-game tasks

| Task | Requirement **(T)** | Type | Effect |
|---|---|---|---|
| **Digital consciousness upload** (3.7) | 1,000,000 H, a model of Gen ≥ 4, Cyberware 4 | Rate | A dead head continues as an advisor (6.7.4) |
| **Run an uploaded mind** | 20,000 H per month | Upkeep | The upload advises and acts; suspended without compute |
| **Gigacluster** | 6.7.5 | Gate | Gen 4+ training |
| **Humanoid workforce** | Humanoid robots plus 10 H per 100 per month | Upkeep | Fills Unskilled jobs at 1.2 productivity |

---

## 6.7 Building Techno-Capital

### 6.7.0 The GPU chain: simplified, 4 layers (Logan, 2026-10-17)

At the start **only energy and GPUs are modeled** as real goods (Logan). Everything else in the economy is abstracted (2-map 2.6.0). The GPU supply chain is the largest supply chain in the game, and at launch it is simulated as **four layers**. The eight-layer Stack (6.7.1) stays as the reference for later.

**Decided (Logan).**
- A GPU is a **component**: it goes into PCs for consumers and into AI server nodes for data centers.
- **Fabless designers** own GPU designs and pay fabs and packagers to make them.
- Each designer has a **developer ecosystem** score that makes buyers prefer its GPUs.
- **Consumers and AI compete for the same cards.** At the start AI demand, and GPU demand overall, is very low compared with what it becomes. Consumer demand grows at a steady rate; AI demand grows at a really high rate.

#### The four layers

The chain is deliberately simple so the game never models a whole chip (Logan). Four layers, and **the last layer is the GPU itself**. Everything a layer needs besides the layer above it is an abstracted cost plus electricity.

| Layer | What it makes | Inputs | Capacity gate | Starting holders (2.3.3) |
|---|---|---|---|---|
| **1. Lithography machines** | EUV lithography machines, the most expensive machine in the game | Abstracted parts ($60M per machine **(T)**), electricity | The Eindhoven line makes about 4 a month worldwide **(T)** | Eindhoven (sole maker) |
| **2. Wafers** | GPU dies, made on wafers at fabs | Abstracted wafers and chemicals ($400 per die **(T)**), electricity 1.5 MWh per die **(T)** | Installed lithography machines: 1 EUV machine makes 25,000 dies a month **(T)** | Hsinchu-Taipei 60%, Seoul-Pyeongtaek 25%, Phoenix 15% |
| **3. Chips** | Packaged chips: a die joined to its memory | 1 die, abstracted memory and substrate ($250 **(T)**), electricity 0.2 MWh | Packaging lines: 1 line makes 100,000 chips a month **(T)**. The tightest layer at the start | Hsinchu-Taipei, Penang |
| **4. GPU** | **GPUs**, the finished good | 1 chip, abstracted board parts ($150 **(T)**), electricity 0.05 MWh | Board lines: 1 line makes 200,000 GPUs a month **(T)**; cheap and quick to add, rarely the bottleneck | Shenzhen, Hsinchu-Taipei, Penang |

**The lithography machine is extremely expensive (Logan).**
- Price: **$200M per EUV machine** and **$380M per High-NA machine** (from Generation 3, 6.4) **(T)**, plus service at 4% of the price a year (6.2). This replaces the earlier $150M.
- An advanced fab level needs 10 machines (2.7.2), so a single level is **$2B in machines alone**, before the building.
- Only the Eindhoven maker can build them at the start; anyone else must win a Lithography R&D project (6.6), which costs billions and years.
- Machines are Techno-Capital: they are installed in fabs, leased, serviced, seized and export-controlled (6.2.2, 6.9). Deliveries take 8 weeks to install.
- Each machine supports about 25,000 GPUs a month, so the world's ~180 installed EUV machines cap output at about 4.5M dies a month, of which GPU dies get a share **(T)**.

**Deployment is demand, not a layer.** A finished GPU is bought by consumers (into PCs) or by AI buyers (into server nodes in data centers, 6.7.2). Data center power and grid connections limit how fast AI buyers can plug GPUs in.

- **Designers** sit above the chain. A designer holds a GPU design (its Generation, 6.4.1) and books wafer, chip and board capacity by contract (2.10). A designer can own its own fab, but most don't.
- An **AI server node** is 8 GPUs plus a host. It is still counted per GPU slot, so one GPU is one slot of compute (6.2).
- **Energy** is the only other modeled sector: **electricity, crude oil and natural gas** (Logan). Oil and gas are produced, shipped and priced as goods; power plants burn them (or run on nuclear, hydro, solar and wind) to make electricity, priced per hub (2.6.8, 6.7.2).

#### Demand

One world GPU market with one price, **P**. Base price $1,500 per GPU **(T)**.

| Buyer | Demand per year | Price sensitivity | Growth **(T)** |
|---|---|---|---|
| **Consumers** (gamers, PCs, creators) | 40M GPUs at the start **(T)** | High: demand × (P ÷ $1,500)^-1.2 | +5% a year, steady |
| **AI** (data centers, labs, clouds) | 0.5M GPUs at the start **(T)** | Low: demand × (P ÷ $1,500)^-0.3 | +3% a month before the **boom trigger**; after it, a boom rate rolled for each save (below) until the crash; -40% at the crash, then +2% a month |

- **Boom speed varies by save** (Logan). The boom starts with a **triggering event**: by default the tipped lab's breakthrough (November 2022, [7-starting-world.md](7-starting-world.md) 7.7), which can come earlier or later if players change history. At game start the boom rate is rolled between +3% and +10% a month **(T)** (about ×1.4 to ×3.1 a year); the default reference case below uses +6%.
- **Clearing.** Each month P moves toward the price where total demand equals the GPUs packaged **(T)**. Because AI buyers barely care about price and consumers care a lot, a shortage pushes P up and **pushes gamers out first**: the AI boom starves consumers.
- In the reference case (+6% a month), at a steady price, these numbers put AI demand at about 1.5M GPUs in January 2024, 6M (12% of the market) in January 2026 and 50M in January 2029, when it overtakes consumer demand (about 56M) **(T)**. Supply grows only as fast as lithography machines, fabs and packaging lines are built, so P climbs through the boom.
- **Server node price** = P + $4,000 for the host **(T)**, so the launch prices in 6.4.1 are a starting guide and node prices float with the GPU market.

#### Developer ecosystem

- Each designer has a **developer ecosystem** score from 0 to 100 **(T)**.
- **AI buyers** split their orders by `ecosystem² × availability`. **Consumers** split by `ecosystem × availability`, so they care less **(T)**.
- Ecosystem grows by +1 a month per 10% share of GPUs installed worldwide, and by spending on developer programs ($50M a month for +1, **T**). It falls 1 a month when a designer has no current-Generation GPU.
- **Starting designers**: four or more (Logan). Proposed four **(A)**: a dominant Bay Area designer (ecosystem 80); a second US designer (40); a Korean memory giant's GPU arm in Seoul (20); a Chinese designer in Shenzhen or Beijing (15), cut off from Hsinchu by the October 2022 export controls (6.9.1). The world's big clouds can start in-house chip programs later.

#### Founding a GPU designer

The player can found a GPU designer, but it is **prohibitively expensive in most market conditions** (Logan). Requirements **(T)**:
- A design team: at least 10 characters with Tech 15 or more, poached or hired at Glitterati pay.
- A **tape-out** of $1B per design at Generation 1, ×2 per Generation after.
- **Capacity**: fab and packaging slots are booked by contract. In a shortage (market price P above base) slots are auctioned, and a newcomer must prepay 12 months of output at P. So the only cheap windows are before the boom trigger and after the crash.
- A new designer starts with ecosystem 0, so AI buyers barely order from it until it wins share or spends on developer programs.

#### Slop

GPUs are a consumer good, so their recipe makes slop: 1.5 slop per GPU **(T)** (2-map 2.8.0).

### 6.7.1 The Stack

The AI supply chain is a stack of chokepoints. Each layer has a bottleneck a player can own, and each one can break.

| Layer | Bottleneck | Starting holders (2.3.3) | What breaks it |
|---|---|---|---|
| 1. Materials | Specialty gases, photoresists, ultra-pure quartz, rare earths | Tokyo-Yokohama, Frankfurt, Baotou | Export controls on rare earths, chemical plant accidents |
| 2. Lithography | EUV tools: one maker | Eindhoven | Export controls, service cut-offs, the maker being bought |
| 3. Fabs | Advanced logic | Hsinchu-Taipei 60%, Seoul-Pyeongtaek, Phoenix | Taiwan Strait closure (2.14.4), earthquakes, water stress |
| 4. Memory | High-bandwidth memory | Seoul-Pyeongtaek | Memory fab outages, Korea Strait |
| 5. Packaging | Advanced packaging | Hsinchu-Taipei, Penang | Packaging capacity is the tightest layer at start (R = 1.25) **(T)** |
| 6. Server nodes | Assembly and export licences | Shenzhen-Dongguan (with controls), Hsinchu-Taipei, Mexico City | Export controls on nodes to restricted countries |
| 7. Data centers | Power and grid connections | Bay Area, Phoenix, Singapore, Beijing, Dubai | Grid queues (6.7.2), heatwaves, water, cable cuts |
| 8. Models | Talent, data and frontier compute | AI dynasties in the Bay Area, Beijing, London, Tel Aviv | Regulation (T3), theft, the Pause Front |

### 6.7.2 Power: the hidden gate

- A data center level draws 17 to 21 MW (2.7.8). New levels need a **grid connection**: `queue time = 12 weeks × (1 + 2 × max(0, 0.15 - reserve margin) / 0.15)` **(T)**, so a tight grid can delay a data center by up to 9 months.
- **Behind-the-meter power**: a company that owns a power plant or SMR in the same hub skips the queue for that plant's capacity and pays its own marginal cost (2.9.7).
- A grid shortfall cuts power fill, and compute falls with it. Data centers sit at rationing step 4 (2.9.7) unless they hold a contracted industrial supply.

### 6.7.3 Getting server nodes: allocation by relationship

When AI server nodes are scarce (R > 1.05), makers do not just sell to the highest bidder. After the 2.10.3 priority order, **buyers without contracts are served by Allocation Score** **(T)**:

`Allocation Score = bid premium % + opinion of the maker's CEO toward the buyer's CEO / 5 + 10 if the buyer has bought for 3+ years + 15 if the buyer is a "strategic partner" (a 5% stake or a joint venture) - 20 if the buyer's country is under export controls`

GPU allocation becomes a CK3 relationship game: dinners with the maker's CEO, a seat on their board, a marriage between families.

### 6.7.4 Uploaded minds

An uploaded head keeps their skills (−2 to each, rising back over 5 years), counts as a character with no body, can sit on boards and advise, but cannot hold office or be trustee unless the family trust's rules say so. If its compute lapses for more than 30 days it is **suspended**: the family must choose whether to pay to restore it (a whole family event chain). Uploads can be stolen like model weights.

### 6.7.5 Gigaclusters (megaproject)

A **gigacluster** is a campus of 40 or more data center levels in one hub, connected as one cluster **(T)**:

- Needs a merged site of at least 8 plots (2.16.1), 1 GW of dedicated power (owned plants or a 10-year power contract), and Digital 3.
- Counts as **Critical infrastructure**: +2 influence weight (2.5.2) in the hub, a target for state intelligence (4.26), and a high-Stakes asset in local politics.
- Build time 2 to 3 years; cost about $60B with Gen 2 nodes.

---

## 6.8 Techno-Capital in the world

### 6.8.1 Starting world

| Pool | World total at start **(T)** | Largest holders |
|---|---|---|
| Compute | About 400 data center levels, 5.8M H per month (Gen 1) | Bay Area and Phoenix AI dynasties 40%, Beijing state-linked companies 20%, Singapore and Dubai 10% |
| Advanced foundry | 6M advanced chips per month | Hsinchu-Taipei 60% (2.14.4) |
| EUV tools | About 180 installed | Hsinchu-Taipei 110, Seoul-Pyeongtaek 40, Phoenix 20, others 10 |
| Military drones | About 400,000 | National militaries; Shenzhen-Dongguan makers |
| Robotaxis | About 20,000 | Bay Area, Phoenix, Beijing, Shenzhen-Dongguan |
| Industrial robots | About 4M installed | China 50%, Japan, Korea, Germany, US |
| Frontier models | Two Gen 1 models | Two AI dynasties (one in the Bay Area, one in Beijing) |

### 6.8.2 Techno-Capital share and influence

- A dynasty's **compute share** = its Owned and Leased compute ÷ world compute. It appears on the Techno-Capital screen beside its world rank.
- Data centers, fabs and lithography tools already give influence through their facility weight (2.5.2). A fab level with EUV tools counts ×1.5 and a gigacluster ×2 **(T)**: governments care about who holds the machines.

### 6.8.3 Monthly node and tool supply

New AI server nodes and lithography tools come from producers each month and are delivered through contracts (2.10). When demand outruns supply the price follows 2.9.2 (ε 1.5 for nodes, 2.5 for tools) and 6.7.3 decides who gets them.

---

## 6.9 Controls, theft and crime

### 6.9.1 Export controls

Countries can control TC exports through trade war level 3 and 4 (4.11.5) and sanctions (4.11.4). Controls apply to **six items** **(T)**: lithography tools, lithography service, advanced chips, AI server nodes of Gen 2 or newer, model weights of Gen 3 or newer, and autonomy kits.

- **Service cut-off**: the maker's government can order service stopped to a country. Tools there lose condition 5 per month (6.2.2).
- **Remote compute loophole**: renting compute in a third country (Singapore, Dubai, Penang) is legal until the controlling country adds **cloud controls** (a decision under trade war level 4), which make the rental illegal: exposure +5 per month per 1,000 H, as sanctions evasion (4.11.4).
- **Smuggling** nodes through shells (1.7.4) and Dubai or Hong Kong trading houses is sanctions evasion: exposure +10 per 1,000 nodes **(T)**.

### 6.9.2 AI regulation (T3) applied to TC

| T3 position | Effect on TC tasks **(T)** |
|---|---|
| Unregulated | None |
| Risk-Based | Robotaxi service, AI advisors sold to others and Sovereign AI need certification (8 weeks) |
| Licensed Models | Training runs of Gen 3+ in the country need a licence (lobbyable decision, 3 to 6 months); deploying an unlicensed Gen 3+ model is an exposure +5 per month offense |
| Moratorium | No training runs of Gen 3+; no autonomous corporate agents; existing Gen 3+ models may only be served abroad |

A **compute haven** is a country with T3 Unregulated and F2 Open. Training runs move there, and so do the Unshacklers (5-ideology 5.7.2).

### 6.9.3 Compromised Techno-Capital

**Compromised** TC is TC the company is secretly using while its owner (or lessee) uses it or while it sits idle. It is the cyberpunk control level: cryptojacked data centers, a bribed night-shift engineer running jobs on a university cluster, a hijacked drone fleet that still flies its owner's routes by day.

**Getting access** **(T)**:

| Way | Cost | Notes |
|---|---|---|
| **Intrusion** | A netrun scheme (500 H) against the target's site | Success as 6.9.4 |
| **Insider** | Bribe an employee or executive of the owner (bribe chain, 4.20.3) | +20% success; the insider is a knower who can flip (4.20.5) |
| **Broker** | Buy access from a black-market broker (Shadow Economy, OCGs) | 30% to 60% of the spot price; the broker knows who bought it |

**How much can be used**: all of the target site's idle capacity, plus up to 10% of its capacity in use. Taking in-use capacity slows the owner's own tasks by the same share, which makes detection more likely.

**Detection** (monthly per compromised site) = `5% + 1% per 1,000 H (or per 100 drones or vehicles) used per month + 10% if in-use capacity is taken + 15% if the owner runs a cyber defense task (6.6.6) + 2% per CTO Tech point above 10` **(T)**.

On detection: access ends at once; the owner learns who did it unless the user wins an Intrigue check (+10 per cutout, 4.20.4); the user gains exposure +10 with the Data and Cyberware Authority and the owner gains a casus belli and a lawsuit (4.21.2); a public owner may make it a scandal (Heat 40).

**Why use it**: compromised TC is free, invisible to export controls, T3 licensing and Moratoriums, and leaves no lease on anyone's books. It is the only way to run secret tasks without owning the machines.

### 6.9.4 Stealing TC

| Target | Scheme | Success **(T)** | Result |
|---|---|---|---|
| **Model weights** | Corporate espionage (Intrigue) with a netrun of 2,000 H, or an insider | `30% + 3 × (attacker Intrigue - defender security) + 10% with an insider`, -30% with cyber defense | A copy of the model; the victim loses nothing but its lead |
| **Chip design** | Corporate espionage | As above | The tape-out result |
| **An uploaded mind** | Netrun of 10,000 H | As above at -20% | A stolen ancestor: hooks, secrets, and a hostage |
| **Drone fleet hijack** | Netrun of 500 H | As above | The fleet is lost for 1 to 7 days, or crashed |
| **Lithography tools** | Physical theft is impossible; a state can seize a fab (4.9.10) | n/a | The tools change owner with the fab |

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

A liege with many vassal data centers can assemble a training run without building anything, at the price of their loyalty. A Defiant vassal can refuse a call-up (2.10.3).

### 6.10.3 Balance sheet and valuation

TC sits on the balance sheet as equipment (2.13.3) and depreciates by its life in 6.2.3, or by generation for compute (6.4.1). Analysts (3-markets) value AI and chip companies on **compute share** and **model Generation** as well as earnings: a company holding the frontier model trades at a P/E premium of +50% **(T)**.

---

## 6.11 Ideology links ([5-ideology.md](5-ideology.md))

| Ideology | Attitude to Techno-Capital |
|---|---|
| Accelerationists | Want every gate open: +0.1 brand alignment per Gen of the frontier model a company holds |
| Landites | Capital is the intelligence: Landite drift +0.5 per 10% of world compute held by the top 3 dynasties |
| Effective Altruists | Want Gen 3+ runs licensed; Pause Front targets training runs |
| Transhumanists | Want uploads and cyberware research funded |
| Neo-Luddites | The Unplugged target data centers, robot factories, robotaxi depots; drift +1 per 5,000 robotaxis in a hub |
| Communists | Want compute nationalized ("seize the servers"): C5 State Administration applied to data centers first |
| Sovereigntists | Love compute havens and compromised compute |
| Chuds | Hate foreign-owned data centers and implants; like domestic chip champions |
| Liberals | Want export controls and standard licensing, and want them to work |

---

## 6.12 Techno-Capital across the game stages

| Stage | Techno-Capital play |
|---|---|
| **Heir** | A rig of old nodes for crypto mining, a drone filming startup, an AI advisor bought with the trust allowance. First taste of allocation |
| **Founder** | The AI startup path: pay Spot prices, fight for a lease, raise a round to buy the first Gen 1 training run, sell licenses before the money runs out. A fabless chip startup path: tape out a custom accelerator. **The early game is here** |
| **Climber** | Own data centers, chase power and grid queues, win GPU allocation by relationships, field a robotaxi fleet, call up vassal levies |
| **Tycoon** | Fabs and lithography, export control fights, next-generation design, gigaclusters, Sovereign AI contracts |
| **Oligarch** | Compute share as power, uploaded ancestors, lithography R&D to break the monopoly, and the **Machine Sovereign** endgame |

**Machine Sovereign** (new endgame for 4.29): hold 25% or more of world compute and the frontier model for 5 consecutive years, while owning at least one advanced fab with its EUV tools. Renown 2,500 **(T)**.

---

## 6.13 Sample events

| Event | Trigger | Choices and effects **(T)** |
|---|---|---|
| **Loss Spike** | 1% per week during a training run | Roll back to checkpoint (-3% progress) · Push through (Tech check by the lead: success no loss, failure Quality -5) |
| **Allocation Cut** | Node shortage and Allocation Score in the bottom third | Fly to meet the maker's CEO (8 hours, Persuasion check: restore allocation) · Pay +20% · Buy used Gen 1 nodes from the grey market |
| **Service Suspended** | Export controls hit a fab's country | Lobby the maker's government (4.10) · Run the fab into the ground (yield falls 5% per month) · Smuggle parts (exposure +15; condition loss halved) |
| **Grid Says No** | A data center's connection queue passes 6 months | Build behind-the-meter gas or SMR power · Move the build to another hub · Bribe the utility (exposure +5, queue halved) |
| **Weights on a Forum** | A model is stolen and leaked | Sue (4.21.2) · Open-weight it officially and claim the credit (brand +5, license revenue on it ends) · Hunt the leaker (Intrigue scheme) |
| **Robotaxi Kills a Pedestrian** | 0.2% per month per 1,000 robotaxis | Settle and pause (fleet offline 2 weeks) · Blame the victim (scandal Heat 50) · Lobby for a liability cap (T3 Risk-Based) |
| **The Unplugged Come at Night** | Neo-Luddite cell operation against a data center | As 5-ideology 5.7.2; condition -15 and 20% of nodes destroyed |
| **Heatwave** | Summer in Phoenix or Dubai, 10% per year | Cut compute 20% for 3 weeks · Pay triple for water and power · Risk it (25% chance of a 1-week outage) |
| **A Mind in the Machine** | The uploaded head's compute lapses | Pay to restore · Let them go (a funeral, again) · Sell the upload to a lab (cash, family opinion -40) |
| **The Second Maker** | A rival finishes lithography R&D | Buy into them · Lobby for their national champion status · Steal their design |

---

## 6.14 Worked examples

### 6.14.1 A Founder trains the first model

**Setup.** A Bay Area AI startup (Founder stage) closed a $250M Series B through the VC founding path. Digital 2, CTO with Tech 16, user data 12 DU licensed from a social platform.

**Requirement.** Gen 1 model: 60,000 H × Digital 2 efficiency 1.15 = 69,000 H over at least 3 months, so 23,000 H per month from one cluster.

**Options.**

| Option | Cost | Risk |
|---|---|---|
| Spot in the Bay Area (tightness R = 1.05) | 69,000 × $2,500 × 1.7 = $293M | Over budget, and the run stalls if spot capacity runs out mid-run |
| Lease in Phoenix (23,000 H per month, 12 months) | 23,000 × $2,500 × 0.9 = $51.75M per month, plus one month's deposit | 9 more months of lease after the run, unless the startup subleases the capacity or uses it to serve the model |
| Compromise an idle university cluster in Toronto through a bribed sysadmin | About $2M in bribes | Detection `5% + 23 × 1%` = 28% per month (the insider helps get in, not hide); the chance of finishing 3 months unseen is `0.72³` = about 37%, and being caught means a lawsuit, exposure and a lost run |

The founder takes the Phoenix lease. By the end of the run it has spent $207M of the $250M round (the $51.75M deposit plus 3 months of payments), and the model has to pay the remaining 9 months of the lease.

**The run.** 2,200 hourly turns. In week 6 a Loss Spike fires; the CTO's Tech check (16 vs 15) succeeds. Quality = 50 + 2 × 6 + 5 × 0 + data bonus 2 (12 DU against 10) = **64**.

**Revenue.** The frontier model is Gen 1 (two other Gen 1 models exist), so the license price = $10M × 1 × 64/75 = $8.5M per license-month. Serving each license-month takes 2,000 H; the leased capacity (23,000 H per month) serves 11 license-months per month, about $94M a month in revenue against $51.75M a month of lease payments. The startup is alive, and every AI dynasty in the Bay Area now wants to buy it.

### 6.14.2 Service suspended in Shanghai

A dynasty's Shanghai branch office runs one advanced-node fab level with 10 EUV tools. A trade war reaches Export Controls (level 3) and the Netherlands orders service suspended.

- Tool condition falls 5 per month: yield `= 95% × condition factor` falls from 95% to about 76% after 4 months and 57% after 8.
- Output (method output × yield ÷ 0.9) falls from about 315,000 advanced chips per month to about 255,000 after 4 months. At the spiked advanced chip price ($520 under controls, 2.14.4 style) the fab still earns more than before for a year.
- Options: lobby the Dutch government through the dynasty's Rotterdam holdings (4.10); smuggle parts through Hong Kong (exposure +15 per month, condition loss halved); or sell the fab to a Chinese state champion at 70% of book value before the yield collapses, and take the influence gain with Beijing (+10 government attitude, 4.27.2).

---

## 6.15 Assumptions

1. **Techno-Capital is seven pools**: Logan's compute, foundries, lithography machines, drones and automated cars, plus **robots** and **AI models**, added because they behave the same way (scarce, allocatable, obsolete). Either can be dropped without breaking the rest.
2. **Compute is measured in H** (1,000 Generation 1 accelerator-hours), the existing cloud compute unit, to avoid a clash with construction units (CU).
3. **Techno-Capital is leased, not sold** (Logan's rule): unallocated TC is leased out by default, so allocation has an opportunity cost (lease income forgone), not a cash cost. The machines themselves can still be bought and sold.
4. **Three requirement types** (Gate, Rate, Upkeep) and **four control levels**, as defined by Logan: Owned (you own it), Leased (you pay an agreed amount for an agreed time), Spot (expensive, on demand) and Compromised (secretly using someone else's TC while they use it or it is idle).
5. **Training runs replace the "Frontier training" production method** of 2.7.8: models now come from runs (6.5), and the method row should be read as a dedicated training lease.
6. **Hardware generations every 24 months**, model generations at 4× compute each, Digital tier as algorithmic efficiency.
7. **Lithography service** by the maker is a controllable lever; unserviced tools lose 5 condition per month.
8. **GPU allocation by relationship** (Allocation Score) in shortages.
9. **Two new goods**: commercial drones and autonomy kits.
10. **New board seat**: Chief Technology Officer.
11. **New vassal contract term**: Techno-Capital levy (CK3 levy style).
12. **Power grid connection queues** gate new data centers.
13. **Gigaclusters** are a megaproject and critical infrastructure.
14. **Uploaded minds** need ongoing compute and can be suspended or stolen.
15. **Machine Sovereign** is a new endgame (renown 2,500).
16. **Starting world**: about 5.8M H per month of compute, about 180 EUV tools, two Gen 1 frontier models.
