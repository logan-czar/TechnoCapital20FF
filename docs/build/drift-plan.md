# Long-run drift plan: fixes for the economy past 2050

_Draft for Logan, 2026-10-24. Built from the 100-year report (the "Economy Left Alone" dashboard; soak data in `.claude/scratch/w3`), mvp-spec v1.4 sections 5 and 6, and Logan's answers. Nothing here is built yet. These are spec changes: they move mvp-spec past v1.4 to v1.5._

## 1. What the 100-year run showed

The economy is healthy through 2040, then drifts:

- EVs take 95% of world demand, because long-term growth rates never fade (spec 5.1). World demand ends 85,000 times its 2020 level.
- The top 10 companies take 97% of named revenue. Free R&D grows with the log of held data without a limit (5.9), and leaders hit the productivity cap of 200.
- Nothing exits after about 2045. Losers sell assets at 15% a year and live on interest, so bankruptcy never triggers. Named companies reach 1,610 and characters about 1,990, both past the spec limits.

## 2. What Logan decided

| Topic | Decision |
|---|---|
| Growth | **Fade each industry's long-term rate to a mature rate.** Fast industries fade over decades. |
| Global growth | **Nerf world demand growth overall.** From 2050, run **a very long period of low economic growth**, to see how companies respond. |
| Volatility | **Run the long tests at several levels of market volatility**, not just today's setting. |
| Exits | **Asset floor plus losing streak.** A company leaves when its assets fall below a floor, or after N years of negative operating profit. Its business returns to the fringe, as bankruptcy does today. |
| Exited staff | **Freed to work elsewhere.** Its full characters stay in the world without a seat. |
| Winners | **Both caps and a size cost.** Cap free R&D, taper productivity gains near the top, and add a cost that grows with company size. |
| Startups | **Startups are more efficient than big companies.** Big companies pay a size cost (above), and young companies get a productivity bonus that fades over about 10 years. The startup birth rate stays as it is. |
| Success bar | **Report only.** Make the changes and show the new 100-year reports; Logan judges by eye. |
| Spec | **A new spec version.** Each rule is logged as a decision with a design fix, and mvp-spec moves to v1.5 in one step. |

### Decided by the coordinator (logged, flagged for sign-off)

- **Fade shape.** The long-term rate decays exponentially toward the mature rate: `lt(t) = mature + (lt0 − mature) × 0.5^(years since 2020 / half_life)`. This uses two new industries.csv columns, `mature_rate` (about 3 to 4%) and `fade_half_life_years`. Fast industries get about 15 to 25 years. Slow industries start near their mature rate, so they barely change. The AI boom (5.1.1) and the first 30 years should stay close to today.
- **Global nerf.** A world growth scale multiplies every industry's long-term rate. It sits in a new data table, so it can be tuned without code.
- **The 2050 slowdown** is a scenario setting, not a permanent part of the world. The headless runner can switch it on, with a start year, length and depth. The game starts with the baseline unless asked otherwise. Default for the test: 2050 to 2080, at a third of normal growth.
- **Volatility levels** are scenario settings too: the cycle's amplitude, industries' own shock size, and price noise, scaled together at low, normal and high. The baseline game keeps today's values.
- **Exit thresholds.** An asset floor of $2M, or 5 straight years of negative EBIT. A company that exits pays any debt from its cash first. Its share price goes to its liquidation value, and holders are paid out. Its units go back to the fringe, as spec 5.12 step 3 does for bankruptcy.
- **Caps.**
  - Free R&D is capped at 2 times the industry's R&D norm.
  - Productivity gains shrink linearly from 100% at productivity 120 to 25% at 200.
  - The size cost is a fixed-cost rate that grows with the log of a company's revenue above $10B. It is calibrated so the median company in 2020 pays nothing.
  - The young-company bonus is +15% to productivity growth in a company's first year, fading linearly to 0 by year 10.

## 3. Lanes and phases

Up to 4 worktrees, all on D:. Each lane owns separate sim folders, so they can run in parallel.

### Phase A (in parallel)

| Lane | Owns | Work |
|---|---|---|
| **G: growth** (slot-a) | `economy/growth.rs`, `economy/demand.rs`, `economy/cycle.rs`, industries.csv columns, a new world-growth table, `sim::scenario` | Fade to mature rates; the global nerf; a `Scenario` struct (slowdown window, volatility scale) the sim reads, set from headless. Default is the baseline. |
| **X: exits** (slot-b) | `finance/distress.rs`, `ai/raise.rs` (sell-down), `births` (freed characters' reuse), `views` that list exits | The exit rule, its notices and headlines; freed characters available to boards and startups; save version bump |
| **W: winners and startups** (slot-c) | `ops/productivity.rs`, `ops/data.rs`, `ai/rd.rs`, `economy/revenue.rs` (expenses) | The free R&D cap, the productivity taper, the size cost and the young-company bonus |

Every lane keeps the 30-year soak's spec 10 targets visible and reports any target that moves, but doesn't gate on them (Logan chose report only).

### Phase B (one lane, after A merges)

| Lane | Work |
|---|---|
| **S: scenarios and reports** (slot-d) | A headless scenario matrix: volatility (low, normal, high) × slowdown (off, 2050 to 2080), 100 years each on 20 seeds. Write one report per scenario with the same measures as the current dashboard, and update the "Economy Left Alone" dashboard to compare scenarios (a scenario picker), including the before-the-fixes baseline. |

Each PR gets an independent reviewer before merge. Lanes G, X and W each run the 100-year soak on their own change, so the report can show what each fix does alone.

## 4. Spec changes to log for Logan (v1.5)

- 5.1: long-term rates fade to mature rates; a world growth scale.
- 5.1 and 5.4: scenario settings (slowdown, volatility). They are off in the baseline.
- 5.12 and 6.2: the exit rule; exited companies' characters are freed (3.7.2).
- 5.6 to 5.9: the free R&D cap, the productivity taper, the size cost and the young-company bonus.
- 10: new long-run measures reported (not gated): demand concentration, top-10 share, exits per decade, company and character counts.

## 5. Risks

| Risk | Mitigation |
|---|---|
| The fixes shift the 30-year balance that took M10 to tune | Each lane reports the spec 10 targets before and after; the half-lives and caps start mild |
| Three lanes touch the economy at once | Folder ownership as above; a shared `Scenario` type defined first by lane G and frozen |
| Exits empty small industries | The exit rule never removes an industry's last named company |
| Determinism | No new randomness except through existing seeded streams; the soak's monthly hash test and save/load replay keep running |

## 6. Done when

- Phase A and B are merged and the gate passes.
- The dashboard shows each scenario at 2030, 2040, 2050, 2080 and 2120, against the before-the-fixes baseline.
- Logan reviews the reports.
