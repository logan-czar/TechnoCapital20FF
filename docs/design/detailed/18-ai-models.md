# 18. AI models (detailed design)

_Status: draft v0.1 (2026-10-18). AI models were kept out of the software table (batch 43) and picked as the next system in batch 72. Logan's direction (batch 72): **models are trained on GPU compute and data, then rented out through software contracts, and they power AI features in software.** This file ties together the model rules already in [6-technocapital.md](6-technocapital.md) (6.2.4 Models, 6.5 Training runs) with [14-software.md](14-software.md) (contracts, the AI assistant feature) and [15-infrastructure.md](15-infrastructure.md) (GPU compute, stored data). Where they clash, this file wins. Owner: Logan._

**How to read the numbers.** Every number marked **(T)** is a starting tuning value. Anything marked **(A)** is an assumption that Logan has not confirmed yet; the list is in 18.6.

---

## 18.1 Decided by Logan

| Topic | Decision |
|---|---|
| Separate from software | AI models are **their own thing**, not rows in the software table (batch 43). |
| Training | Models are **trained on GPU compute and data** (batch 72). |
| Use | Models are **rented out through software contracts** (14.4) and **power AI features in software** (14.5) (batch 72). |
| AI addiction | **Scrapped** (batch 72). |

## 18.2 The model (A)

A model is a row in its own **models table** in the engine:

| Field | What it holds |
|---|---|
| **Name** and **owner** | Who trained or bought it (holders as in 1.2) |
| **Generation** | 1 to 5+, set by the training run's size (6.5.2) |
| **Quality** | 40 to 100 (6.5.3) |
| **Specialty** | General, or one sector after fine-tuning (6.5.2): finance, code, media, science, security |
| **Serving need** | GPU compute per contract per month (18.4) |
| **Open weights** | Whether it was released for free (6.2.4) |

## 18.3 Training (Logan: GPU compute and data)

- A training run uses **GPU compute** ([15-infrastructure.md](15-infrastructure.md) 15.2), where **1 GPU compute unit = 1 H a month**, so the H totals in 6.5.2 read directly as GPU compute unit-months. A Gen 1 run needs 20,000 GPU units for 3 months.
- It also needs **stored data** (15.4): the "user data DU" in 6.5.2 becomes **stored data in TB**, at **1 DU = 100 TB** (one data compute unit) **(A)**. Fresher data counts more; data older than 2 years counts half (15.4 ageing) **(T)**.
- The compute can be owned, leased, rented from the cloud (15.5) or Compromised by a hacker's backdoor (17.3).
- The research lead's Tech, the data bonus and events set Quality (6.5.3).

## 18.4 Renting models out (Logan: software contracts)

- Models are rented through the **contracts table** (14.4), exactly like software: a **market contract** offered to every company, and occasional **special contracts** (exclusive access, a discount, a custom fine-tune).
- **Price** follows 6.5.5: the frontier model earns full price, each generation behind earns 40% **(T)**.
- **Serving**: every active contract needs GPU compute to serve it, about 2,000 GPU units a month per license-month in 6.5.5 terms **(T)**. The owner pays for it in its own data centers or its cloud bill. Running short of GPU compute throttles every contract.
- **Breaking a contract** costs the same penalty as software (14.4).

## 18.5 Powering software (Logan)

- A software feature that needs AI (the **AI assistant** feature and any AI tag, 14.5) needs **a contract for a model**. The software's output with that feature scales with the model's Quality ÷ 75 **(T)**.
- **AI software needs GPU compute** (15.2), so a product with an AI feature adds GPU compute to its compute requirement.
- A company can use its **own model** with no contract.
- If the model contract ends or the model's owner cuts it off, the AI feature counts as a **missing input** and output is nerfed (14.3).
- Models still power the other in-house uses in 6.2.4 (AI-native offices, agents, advisors, synthetic media, research).

## 18.6 Assumptions and open items

1. The models table fields and specialties (18.2).
2. 1 DU = 100 TB and data ageing in training (18.3).
3. Serving compute per contract (18.4).
4. Output scaling with model Quality (18.5).
