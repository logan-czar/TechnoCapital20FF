//! Data: creation, conversion, decay, 12-month retention and free R&D (spec 5.9; 10.0.11.4 to
//! 10.0.11.7), and the steady-state held data used at load (7.1).

use serde::{Deserialize, Serialize};

use super::stations::{Stations, decade_steps};

/// Spec 5.9 step 3: TB a month one enterprise station converts (general enterprise software at
/// quality 50: 1 GB a tick × Q 1.25 × 730 ticks).
pub const CONVERT_TB_PER_STATION: f64 = 0.9125;
/// Spec 5.8, 5.9: a 50/50 station counts half for productive compute and half for conversion.
pub const FIFTY_FIFTY_SHARE: f64 = 0.5;
/// Spec 5.9 step 5: unstructured data is kept this many months.
pub const RETENTION_MONTHS: usize = 12;
/// Spec 5.9 step 1: held TB at which free R&D starts (1%).
pub const FREE_RD_FIRST_STEP_TB: f64 = 1.0;
/// Spec 5.9: one more percent per 10× of held TB.
pub const FREE_RD_STEP_FACTOR: f64 = 10.0;
/// Spec 5.9 step 4: held TB from which the decay rate grows with log10(held).
pub const DECAY_LOG_FROM_TB: f64 = 1.0;
/// Spec 5.9: `$1M` of revenue, for the `revenue_month ($M)` term.
pub const USD_PER_MUSD: f64 = crate::world::units::USD_PER_MILLION;
/// Months in a year (7.1 one month of inflow is a twelfth of a year's).
pub const MONTHS_PER_YEAR: f64 = 12.0;
/// Percent in 1.0 (free R&D is a whole percent, 5.9).
pub const PERCENT: f64 = 100.0;

/// Free R&D percent for `held` TB (spec 5.9): `1 + floor(log10(held))` for held ≥ 1 TB, else 0.
/// Steps: under 1 TB 0%; 1 TB 1%; 10 TB 2%; 100 TB 3%; 1 PB 4%; 10 PB 5%; +1% per further 10×.
pub fn free_rd_step(held_tb: f64) -> u32 {
    decade_steps(held_tb, FREE_RD_FIRST_STEP_TB, FREE_RD_STEP_FACTOR)
}

/// Held TB at which the free R&D step after `pct` starts (spec 5.9 steps): 1 TB for 0%, else
/// 10^pct TB, so 1% (1 to 9.99 TB) steps up at 10 TB. For the Tech tab's data quests card
/// (spec 8).
pub fn next_free_rd_tb(pct: u32) -> f64 {
    if pct == 0 {
        FREE_RD_FIRST_STEP_TB
    } else {
        FREE_RD_FIRST_STEP_TB * FREE_RD_STEP_FACTOR.powi(pct as i32)
    }
}

/// The monthly decay rate at `held` TB (spec 5.9 step 4): `base × (1 + log10(held))` for
/// held ≥ 1, else base.
pub fn decay_rate(held_tb: f64, base: f64) -> f64 {
    if held_tb >= DECAY_LOG_FROM_TB {
        base * (1.0 + held_tb.log10())
    } else {
        base
    }
}

/// TB a month the stations convert (spec 5.9 step 3):
/// `(enterprise + 0.5 × 50/50 stations) × 0.9125`.
pub fn conversion_capacity(stations: &Stations) -> f64 {
    (stations.enterprise as f64 + FIFTY_FIFTY_SHARE * stations.fifty_fifty as f64)
        * CONVERT_TB_PER_STATION
}

/// Bisection steps for [`steady_state_held`].
pub const STEADY_STATE_ITERATIONS: u32 = 200;

/// Held TB where converting `c` TB a month equals decay (spec 5.9, used at load in 7.1):
/// solves `C = rate(held) × held`. `rate × held` rises with held and is continuous at 1 TB, so
/// below `base` the answer is `C ÷ base` (under 1 TB) and above it a geometric bisection from
/// 1 TB. 0 for C ≤ 0. Unlike validate.py `steady_held`, which bisects from a 1 TB floor and so
/// returns 1 TB (1% free R&D) for any C below `base`, this follows 5.9 below 1 TB too (design
/// fix 208). This is the held level after conversion and before decay; the end-of-month level
/// it settles at is that less C (D210).
pub fn steady_state_held(c_tb: f64, base: f64) -> f64 {
    if c_tb <= 0.0 || base <= 0.0 {
        return 0.0;
    }
    if c_tb <= base * DECAY_LOG_FROM_TB {
        return c_tb / base;
    }
    // rate ≥ base above 1 TB, so held ≤ C ÷ base.
    let (mut lo, mut hi) = (DECAY_LOG_FROM_TB, c_tb / base);
    for _ in 0..STEADY_STATE_ITERATIONS {
        let mid = (lo * hi).sqrt();
        if decay_rate(mid, base) * mid > c_tb {
            hi = mid;
        } else {
            lo = mid;
        }
    }
    lo
}

/// The data of one corporation in one industry (spec 3.5 `data`).
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct DataBook {
    /// Unstructured TB by month, oldest first, at most 12 after each month (10.0.11.4).
    pub unstructured: Vec<f64>,
    /// Structured held TB (10.0.11.6).
    pub held: f64,
    /// Free R&D percent in force (5.9 step 1).
    pub free_rd_pct: u32,
    /// A drop to a lower free R&D step is waiting out its 1-month grace (5.9 step 1).
    pub grace: bool,
}

/// The industry's data settings (industries.csv).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DataParams {
    /// TB of unstructured data per $1M of revenue (`data_tb_per_musd`).
    pub tb_per_musd: f64,
    /// Base monthly decay of held data (`data_decay_base`).
    pub decay_base: f64,
}

/// What one month did (spec 5.9), for screens and checks.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct DataMonth {
    /// Free R&D percent for this month (step 1).
    pub free_rd_pct: u32,
    pub created_tb: f64,
    pub converted_tb: f64,
    pub decayed_tb: f64,
    /// Unstructured TB dropped by retention (step 5).
    pub dropped_tb: f64,
}

impl DataBook {
    /// The starting data (spec 7.1): one month of unstructured data
    /// (`R($M) × data_tb_per_musd ÷ 12`) in the newest bucket, and structured held data at the
    /// steady state for converting `min(capacity, share × inflow)` a month (share 0.5, Arrowhead
    /// 0.1). Free R&D starts at the step of that held level (D210).
    pub fn at_load(revenue_usd: f64, params: DataParams, capacity_tb: f64, share: f64) -> DataBook {
        let inflow = revenue_usd / USD_PER_MUSD * params.tb_per_musd / MONTHS_PER_YEAR;
        let c = capacity_tb.min(share * inflow);
        let held = steady_state_held(c, params.decay_base);
        DataBook {
            unstructured: vec![inflow],
            held,
            free_rd_pct: free_rd_step(held),
            grace: false,
        }
    }

    /// Unstructured TB not yet converted.
    pub fn unstructured_tb(&self) -> f64 {
        self.unstructured.iter().sum()
    }

    /// TB stored, for the data compute of 3.8: held plus unstructured.
    pub fn stored_tb(&self) -> f64 {
        self.held + self.unstructured_tb()
    }

    /// Free R&D as a fraction of revenue (5.6 rd_total).
    pub fn free_rd_fraction(&self) -> f64 {
        f64::from(self.free_rd_pct) / PERCENT
    }

    /// Runs one month (spec 5.9, 4.3 step 8), in the spec's order:
    ///
    /// 1. Free R&D from held TB at the start of the month; a drop to a lower step waits one
    ///    month (the grace) and applies the month after if held is still below (D210).
    /// 2. Create: `revenue_month ($M) × data_tb_per_musd` TB into this month's bucket.
    /// 3. Convert up to `capacity_tb`, oldest buckets first; `held += converted`.
    /// 4. Decay: `held −= held × rate(held)`.
    /// 5. Retention: unstructured data older than 12 months is dropped, so the bucket made 12
    ///    months ago gets this month's conversion as its last chance (D210).
    pub fn month(
        &mut self,
        revenue_month_usd: f64,
        params: DataParams,
        capacity_tb: f64,
    ) -> DataMonth {
        // 1. Free R&D for this month.
        let step = free_rd_step(self.held);
        if step < self.free_rd_pct && !self.grace {
            // The first month below: keep the old step for the grace month.
            self.grace = true;
        } else {
            // At or above the step, or a drop whose grace month has passed.
            self.free_rd_pct = step;
            self.grace = false;
        }
        // 2. Create.
        let created = (revenue_month_usd / USD_PER_MUSD * params.tb_per_musd).max(0.0);
        self.unstructured.push(created);
        // 3. Convert, oldest first.
        let mut room = capacity_tb.max(0.0);
        let mut converted = 0.0;
        for bucket in &mut self.unstructured {
            if room <= 0.0 {
                break;
            }
            let take = bucket.min(room);
            *bucket -= take;
            room -= take;
            converted += take;
        }
        self.held += converted;
        // 4. Decay.
        let decayed = self.held * decay_rate(self.held, params.decay_base);
        self.held -= decayed;
        // 5. Retention.
        let mut dropped = 0.0;
        if self.unstructured.len() > RETENTION_MONTHS {
            let old = self.unstructured.len() - RETENTION_MONTHS;
            dropped = self.unstructured.drain(..old).sum();
        }
        DataMonth {
            free_rd_pct: self.free_rd_pct,
            created_tb: created,
            converted_tb: converted,
            decayed_tb: decayed,
            dropped_tb: dropped,
        }
    }
}
