# 18. AI models (detailed design)

_Status: draft v0.3 (2026-10-18). Logan: **types of training data raise different capabilities**; models have a **size** (the server or device needed to run them) and a **speed** (jobs per tick). v0.2: Logan: models have **capabilities**, each with its own quality; AI software loads one or more models to fill its capabilities, and **the model's quality caps the software's quality** (18.2, 18.5). AI models were kept out of the software table (batch 43) and picked as the next system in batch 72. Logan's direction (batch 72): **models are trained on GPU compute and data, then rented out through software contracts, and they power AI features in software.** This file ties together the model rules already in [6-technocapital.md](6-technocapital.md) (6.2.4 Models, 6.5 Training runs) with [14-software.md](14-software.md) (contracts, the AI assistant feature) and [15-infrastructure.md](15-infrastructure.md) (GPU compute, stored data). Where they clash, this file wins. Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 18.6.

---

## 18.1 Decided by Logan

| Topic | Decision |
|---|---|
| Separate from software | AI models are **their own thing**, not rows in the software table (batch 43). |
| Training | Models are **trained on GPU compute and data** (batch 72). |
| Use | Models are **rented out through software contracts** (14.4) and **power AI features in software** (14.5) (batch 72). |
| AI addiction | **Scrapped** (batch 72). |
| Capabilities | **Models have varying capabilities, and each capability has a quality** (Logan). |
| Software needs models | **An AI software requires a model, or several models, to fulfil its capabilities** (Logan). |
| Training data | **Models take in varying types of data to train a capability; different types of data raise the quality of different capabilities** (Logan; 18.3). |
| Size | **How big a server or device is required to run the model** (Logan; 18.2.1). |
| Speed | **Jobs per tick** (Logan; 18.2.1). |
| Quality cap | **When a model is loaded for a capability, the model's quality in that capability caps the software's quality** (Logan). |

## 18.2 The model (A)

A model is a row in its own **models table** in the engine:

| Field | What it holds |
|---|---|
| **Name** and **owner** | Who trained or bought it (holders as in 1.2) |
| **Generation** | 1 to 5+, set by the training run's size (6.5.2) |
| **Capabilities** | **A list of capabilities, each with its own quality** (Logan), 0 to 100. A model can be strong at some and weak or missing at others |
| **Size** | **How big a server or device is needed to run it** (Logan), in GPU compute units per running copy (18.2.1) |
| **Speed** | **Jobs per tick** (Logan) per running copy (18.2.1) |
| **Open weights** | Whether it was released for free (6.2.4) |

**Capabilities (A for the list).** Starting set:

| Capability | Used by software for |
|---|---|
| **Language** | Chat, writing, summaries, assistants |
| **Reasoning** | Analysis, planning, research, advisors |
| **Code** | Writing and maintaining software (lowers bloat growth, 14.2.1) |
| **Vision** | Reading images and video: surveillance, inspection, medical scans |
| **Voice** | Speech in and out: call centers, companions, dubbing |
| **Generation** | Images, video and music: synthetic media (16) |
| **Trading** | Market signals and execution (3) |
| **Control** | Steering drones, robots and vehicles (6.2.3) |

- **Data sets the capabilities** (Logan): see 18.3. A capability only gains quality from the data types that train it.
- **Fine-tuning** (6.5.2) raises one capability by +5 to +10 at 5% of the base run's compute **(T)**.
- The **Generation** still sets the price tier (18.4) and the frontier race; Quality now lives per capability.

### 18.2.1 Size and speed (Logan)

- **Size** is **how big a server or device is required to run the model**. It is measured in GPU compute units per running copy **(A)**, and sets where the model can run **(T)**:

  | Size class | GPU units per copy | Runs on |
  |---|---|---|
  | Tiny | under 0.1 | A phone, a drone or a car (embedded, 14.2 platforms) |
  | Small | 0.1 to 1 | A desktop or a single server |
  | Medium | 1 to 10 | A server rack |
  | Large | 10 to 100 | A data center hall |
  | Frontier | 100+ | A large data center only |

- **Speed** is **jobs per tick**: how many requests one running copy handles each hour. A job is one unit of work for the software using it (a trade signal, a reply, a frame of drone video) **(A)**.
- **Scaling** works like software instances (14.2.2): to handle more jobs, run more copies, each needing its size in GPU compute.
- **Trade-off (A):** bigger models reach higher quality but are slower and need bigger hardware; a small, fast model can run on a drone. **Distillation** makes a smaller, faster copy of a model at -10 quality in each capability **(T)**.

## 18.3 Training (Logan: GPU compute and data)

- A training run uses **GPU compute** ([15-infrastructure.md](15-infrastructure.md) 15.2), where **1 GPU compute unit = 1 H a month**, so the H totals in 6.5.2 read directly as GPU compute unit-months. A Gen 1 run needs 20,000 GPU units for 3 months.
- It also needs **stored data** (15.4): the "user data DU" in 6.5.2 becomes **stored data in TB**, at **1 DU = 100 TB** (one data compute unit) **(A)**. Fresher data counts more; data older than 2 years counts half (15.4 ageing) **(T)**.
- **Data types train capabilities** (Logan). Each type of data raises the quality of certain capabilities **(A for the map)**:

  | Data type | Trains |
  |---|---|
  | Documents and text | Language, Reasoning |
  | Code repositories | Code, Reasoning |
  | User activity | Language, Generation (and ad targeting) |
  | Images and video | Vision, Generation |
  | Audio and calls | Voice |
  | Market ticks and transactions | Trading |
  | Sensor feeds and drone telemetry | Control, Vision |

- A capability's quality from a run = the run's base Quality (6.5.3) scaled by how much of the matching data went in: full Quality at or above the requirement, falling to 0 with none **(T)**. Stolen data (17.4) and bought data count the same as your own.
- The compute can be owned, leased, rented from the cloud (15.5) or Compromised by a hacker's backdoor (17.3).
- The research lead's Tech, the data bonus and events set Quality (6.5.3).

## 18.4 Renting models out (Logan: software contracts)

- Models are rented through the **contracts table** (14.4), exactly like software: a **market contract** offered to every company, and occasional **special contracts** (exclusive access, a discount, a custom fine-tune).
- **Price** follows 6.5.5: the frontier model earns full price, each generation behind earns 40% **(T)**.
- **Serving**: the owner (or the renter, if the contract lets them run it themselves) runs enough copies to handle the jobs, each copy needing the model's **size** in GPU compute (18.2.1). Running short of GPU compute throttles every contract.
- **Breaking a contract** costs the same penalty as software (14.4).

## 18.5 Powering software (Logan)

- **AI software declares the capabilities it needs** (Logan): for example, a trading bot needs Trading and Reasoning; a dubbing service needs Voice and Language; a drone fleet controller needs Control and Vision.
- **It loads one or more models to fill them** (Logan): one model can fill several capabilities, or the software can load a different model for each. Each loaded model needs a contract (18.4) unless the company owns it.
- **The quality cap** (Logan): for each capability, the loaded model's quality in that capability **caps the software's quality** (14.2.1). With several capabilities, the software's quality is capped by the **lowest** of its loaded capabilities **(A)**. Example: a 90-quality trading app running a model with Trading 70 works as quality 70.
- A capability with **no model loaded** counts as a **missing input** (14.3), and output is nerfed.
- **AI software needs GPU compute** (15.2), so a product with an AI feature adds GPU compute to its compute requirement.
- A company can use its **own model** with no contract.
- If the model contract ends or the model's owner cuts it off, the AI feature counts as a **missing input** and output is nerfed (14.3).
- Models still power the other in-house uses in 6.2.4 (AI-native offices, agents, advisors, synthetic media, research).

## 18.6 Assumptions and open items

1. The models table fields and specialties (18.2).
2. 1 DU = 100 TB and data ageing in training (18.3).
3. Serving compute per contract (18.4).
4. The capability list, training focus and fine-tuning (18.2).
6. Size classes, jobs per tick and distillation (18.2.1).
7. The data type to capability map (18.3).
5. Using the lowest loaded capability as the cap when software needs several (18.5).
