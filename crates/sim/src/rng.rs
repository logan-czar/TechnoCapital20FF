//! Seeded RNG streams (spec 3.1 `rng_streams`, 12.3; build-plan 2.2, M1.2).
//!
//! One ChaCha8 stream per system: cycle, growth (the quarterly draws), prices, AI and gen. All five
//! share one key made from the game seed and differ by ChaCha stream number (decision D9), so a
//! new draw in one system never shifts another system's numbers. Normal and Poisson draws are
//! written here (Box-Muller, Knuth), not taken from `rand_distr`, so a dependency upgrade can never
//! change them (build-plan 2.2).
//!
//! Jobs never hold an RNG: they draw through the [`DrawSource`] in their `JobCtx` (the pure step
//! contract, `world` module docs). [`RngStreams`] is the game's source; [`NoNoise`] gives "no
//! rolls" for the spec 5.16 projections; [`ScriptedDraws`] replays recorded draws, such as the
//! validate.py fixture of the M2.10 growth check (build-plan 4.2).

use std::collections::VecDeque;
use std::f64::consts::TAU;
use std::fmt;

use rand_chacha::ChaCha8Rng;
use rand_core::{RngCore, SeedableRng};
use serde::{Deserialize, Serialize};

/// The RNG streams, one per system (spec 3.1, 12.3). The discriminant is the ChaCha stream
/// number, frozen forever (D9): renumbering would reseed every saved game.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum Stream {
    /// The global business cycle: phase lengths, g_t, zone shocks (spec 5.1).
    Cycle = 0,
    /// The quarterly industry growth draws (spec 5.1).
    Growth = 1,
    /// Hourly share price noise (spec 5.14).
    Prices = 2,
    /// Lite AI choices (spec 6; the 6.6 raise roll, D266). IPO votes are gen-stream draws
    /// (5.20.1, D276).
    Ai = 3,
    /// World generation in play: simple characters, startups, names (spec 3.7.1, 5.19).
    Gen = 4,
}

/// Number of streams.
pub const STREAM_COUNT: usize = 5;

impl Stream {
    pub const ALL: [Stream; STREAM_COUNT] = [
        Stream::Cycle,
        Stream::Growth,
        Stream::Prices,
        Stream::Ai,
        Stream::Gen,
    ];

    pub fn index(self) -> usize {
        self as usize
    }

    pub fn name(self) -> &'static str {
        ["cycle", "growth", "prices", "ai", "gen"][self.index()]
    }
}

/// Largest Poisson mean Knuth's method is used for (D9). It is O(mean) and `exp(-mean)`
/// underflows near 745; the spec's only Poisson draw has mean 2 (5.19.1).
pub const POISSON_MAX_MEAN: f64 = 30.0;

/// 2^-53: turns the top 53 bits of a u64 into a float in [0, 1).
const UNIT_SCALE: f64 = 1.0 / (1u64 << 53) as f64;

/// A float in [0, 1) from the top 53 bits of `x`.
pub fn unit_from_u64(x: u64) -> f64 {
    (x >> 11) as f64 * UNIT_SCALE
}

/// Box-Muller: two independent standard normals from `u1` in (0, 1] and `u2` in [0, 1).
pub fn box_muller(u1: f64, u2: f64) -> (f64, f64) {
    let r = (-2.0 * u1.ln()).sqrt();
    let theta = TAU * u2;
    (r * theta.cos(), r * theta.sin())
}

/// Knuth's Poisson draw with `mean` (0 to [`POISSON_MAX_MEAN`]) from a uniform [0, 1) source.
pub fn knuth_poisson(mean: f64, mut uniform: impl FnMut() -> f64) -> u32 {
    assert!(
        (0.0..=POISSON_MAX_MEAN).contains(&mean),
        "Poisson mean {mean} outside 0 to {POISSON_MAX_MEAN}"
    );
    let limit = (-mean).exp();
    let mut k = 0;
    let mut p = 1.0;
    loop {
        p *= uniform();
        if p <= limit {
            return k;
        }
        k += 1;
    }
}

/// An unbiased integer in `lo..=hi` from a u64 source (rejection of the short last block).
pub fn int_in_range(lo: i64, hi: i64, mut next: impl FnMut() -> u64) -> i64 {
    assert!(lo <= hi, "empty range {lo}..={hi}");
    let span = hi.wrapping_sub(lo) as u64 + 1;
    if span == 0 {
        return next() as i64; // the whole i64 range
    }
    // Values below `threshold` would make the low results slightly more likely.
    let threshold = span.wrapping_neg() % span;
    loop {
        let x = next();
        if x >= threshold {
            return lo.wrapping_add((x % span) as i64);
        }
    }
}

/// Where a job's random numbers come from (the pure step contract). Every draw names its stream.
pub trait DrawSource {
    /// A raw 64-bit draw.
    fn next_u64(&mut self, stream: Stream) -> u64;

    /// A float in [0, 1).
    fn uniform(&mut self, stream: Stream) -> f64 {
        unit_from_u64(self.next_u64(stream))
    }

    /// A standard normal (mean 0, sd 1).
    fn normal(&mut self, stream: Stream) -> f64;

    /// A Poisson count with `mean` (Knuth).
    fn poisson(&mut self, stream: Stream, mean: f64) -> u32 {
        knuth_poisson(mean, || self.uniform(stream))
    }

    /// A uniform integer in `lo..=hi` (spec 3.7.1 "uniform integer draws").
    fn int_inclusive(&mut self, stream: Stream, lo: i64, hi: i64) -> i64 {
        int_in_range(lo, hi, || self.next_u64(stream))
    }

    /// True with probability `p`.
    fn chance(&mut self, stream: Stream, p: f64) -> bool {
        self.uniform(stream) < p
    }
}

/// The game's five seeded streams. Saved and hashed as the seed plus each stream's word position
/// and spare normal, so a loaded game continues with exactly the draws it would have made.
#[derive(Clone, Serialize, Deserialize)]
#[serde(into = "RngSnapshot", from = "RngSnapshot")]
pub struct RngStreams {
    seed: u64,
    streams: [ChaCha8Rng; STREAM_COUNT],
    /// Box-Muller makes normals in pairs; the second waits here for the next call.
    spare: [Option<f64>; STREAM_COUNT],
}

impl RngStreams {
    /// The five streams for a game seed (D9).
    pub fn new(seed: u64) -> RngStreams {
        RngStreams {
            seed,
            streams: Stream::ALL.map(|s| stream_rng(seed, s, 0)),
            spare: [None; STREAM_COUNT],
        }
    }

    pub fn seed(&self) -> u64 {
        self.seed
    }

    /// The position of each stream, in 32-bit words drawn (for saves and the state hash).
    pub fn positions(&self) -> [u128; STREAM_COUNT] {
        self.streams.each_ref().map(ChaCha8Rng::get_word_pos)
    }
}

fn stream_rng(seed: u64, stream: Stream, word_pos: u128) -> ChaCha8Rng {
    let mut rng = ChaCha8Rng::seed_from_u64(seed);
    rng.set_stream(stream as u64);
    rng.set_word_pos(word_pos);
    rng
}

impl DrawSource for RngStreams {
    fn next_u64(&mut self, stream: Stream) -> u64 {
        self.streams[stream.index()].next_u64()
    }

    fn normal(&mut self, stream: Stream) -> f64 {
        if let Some(z) = self.spare[stream.index()].take() {
            return z;
        }
        let u1 = 1.0 - self.uniform(stream); // (0, 1], so ln is finite
        let u2 = self.uniform(stream);
        let (z0, z1) = box_muller(u1, u2);
        self.spare[stream.index()] = Some(z1);
        z0
    }
}

impl fmt::Debug for RngStreams {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("RngStreams")
            .field("seed", &self.seed)
            .field("positions", &self.positions())
            .field("spare", &self.spare)
            .finish()
    }
}

impl PartialEq for RngStreams {
    fn eq(&self, other: &Self) -> bool {
        RngSnapshot::from(self.clone()) == RngSnapshot::from(other.clone())
    }
}

/// The saved form of [`RngStreams`].
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct RngSnapshot {
    seed: u64,
    positions: [u128; STREAM_COUNT],
    spare: [Option<f64>; STREAM_COUNT],
}

impl From<RngStreams> for RngSnapshot {
    fn from(r: RngStreams) -> Self {
        RngSnapshot {
            seed: r.seed,
            positions: r.positions(),
            spare: r.spare,
        }
    }
}

impl From<RngSnapshot> for RngStreams {
    fn from(s: RngSnapshot) -> Self {
        RngStreams {
            seed: s.seed,
            streams: Stream::ALL.map(|st| stream_rng(s.seed, st, s.positions[st.index()])),
            spare: s.spare,
        }
    }
}

/// "No rolls" (spec 5.16 projections): every normal is 0, every uniform 0.5, every Poisson its
/// rounded mean, every integer the lower middle of its range.
#[derive(Debug, Clone, Copy, Default)]
pub struct NoNoise;

/// The middle of the u64 range, so `uniform` gives 0.5.
const U64_MIDDLE: u64 = 1 << 63;

impl DrawSource for NoNoise {
    fn next_u64(&mut self, _: Stream) -> u64 {
        U64_MIDDLE
    }

    fn normal(&mut self, _: Stream) -> f64 {
        0.0
    }

    fn poisson(&mut self, _: Stream, mean: f64) -> u32 {
        mean.round() as u32
    }

    fn int_inclusive(&mut self, _: Stream, lo: i64, hi: i64) -> i64 {
        lo + (hi - lo) / 2
    }
}

/// Replays recorded draws, one queue per stream (build-plan 4.2: validate.py's draws through the
/// engine). Each `normal`, `uniform`, `poisson` or `int_inclusive` call takes the next recorded
/// value of its stream as the result; running out or asking for a raw u64 panics, since either
/// means the engine and the recording disagree.
#[derive(Debug, Clone, Default)]
pub struct ScriptedDraws {
    queues: [VecDeque<f64>; STREAM_COUNT],
}

impl ScriptedDraws {
    pub fn new() -> Self {
        Self::default()
    }

    /// Adds recorded results to the end of `stream`'s queue.
    pub fn push(&mut self, stream: Stream, values: impl IntoIterator<Item = f64>) {
        self.queues[stream.index()].extend(values);
    }

    /// Recorded values not yet used.
    pub fn remaining(&self, stream: Stream) -> usize {
        self.queues[stream.index()].len()
    }

    fn take(&mut self, stream: Stream) -> f64 {
        self.queues[stream.index()]
            .pop_front()
            .unwrap_or_else(|| panic!("scripted {} draws ran out", stream.name()))
    }
}

impl DrawSource for ScriptedDraws {
    fn next_u64(&mut self, stream: Stream) -> u64 {
        panic!(
            "scripted draws hold results, not raw u64s ({})",
            stream.name()
        )
    }

    fn uniform(&mut self, stream: Stream) -> f64 {
        self.take(stream)
    }

    fn normal(&mut self, stream: Stream) -> f64 {
        self.take(stream)
    }

    fn poisson(&mut self, stream: Stream, _: f64) -> u32 {
        self.take(stream) as u32
    }

    fn int_inclusive(&mut self, stream: Stream, lo: i64, hi: i64) -> i64 {
        let v = self.take(stream) as i64;
        assert!((lo..=hi).contains(&v), "scripted {v} outside {lo}..={hi}");
        v
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Draws a mix of every kind from one stream.
    fn draws(r: &mut impl DrawSource, s: Stream, n: usize) -> Vec<u64> {
        (0..n)
            .map(|i| match i % 4 {
                0 => r.next_u64(s),
                1 => r.uniform(s).to_bits(),
                2 => r.normal(s).to_bits(),
                _ => r.int_inclusive(s, -5, 30) as u64,
            })
            .collect()
    }

    #[test]
    fn same_seed_same_first_1000_draws_per_stream() {
        let (mut a, mut b) = (RngStreams::new(42), RngStreams::new(42));
        for s in Stream::ALL {
            assert_eq!(draws(&mut a, s, 1000), draws(&mut b, s, 1000), "{s:?}");
        }
        // Interleaving streams does not change any stream's draws.
        let mut c = RngStreams::new(42);
        let mut per: Vec<Vec<u64>> = vec![Vec::new(); STREAM_COUNT];
        for _ in 0..1000 {
            for s in Stream::ALL.iter().rev() {
                per[s.index()].push(c.next_u64(*s));
            }
        }
        let mut d = RngStreams::new(42);
        for s in Stream::ALL {
            let alone: Vec<u64> = (0..1000).map(|_| d.next_u64(s)).collect();
            assert_eq!(alone, per[s.index()]);
        }
    }

    #[test]
    fn streams_and_seeds_differ() {
        let mut r = RngStreams::new(42);
        let firsts: Vec<u64> = Stream::ALL.iter().map(|s| r.next_u64(*s)).collect();
        for i in 0..STREAM_COUNT {
            for j in i + 1..STREAM_COUNT {
                assert_ne!(firsts[i], firsts[j]);
            }
        }
        assert_ne!(
            RngStreams::new(1).next_u64(Stream::Cycle),
            RngStreams::new(2).next_u64(Stream::Cycle)
        );
    }

    #[test]
    fn chacha_output_is_pinned() {
        // Guards against a rand_chacha upgrade changing the draws of saved games (build-plan 2.2).
        let mut r = RngStreams::new(42);
        let got: Vec<u64> = Stream::ALL.iter().map(|s| r.next_u64(*s)).collect();
        assert_eq!(got, PINNED_FIRST_DRAWS);
    }

    /// The first u64 of each stream for seed 42.
    const PINNED_FIRST_DRAWS: [u64; STREAM_COUNT] = [
        12_578_764_544_318_200_737,
        13_222_472_167_927_179_408,
        3_387_013_202_841_124_863,
        6_672_028_999_979_260_041,
        16_805_319_813_727_100_726,
    ];

    #[test]
    fn snapshot_resumes_mid_stream_with_spare_normal() {
        let mut a = RngStreams::new(9);
        for s in Stream::ALL {
            draws(&mut a, s, 37);
        }
        a.normal(Stream::Prices); // leaves a spare
        let mut b = RngStreams::from(RngSnapshot::from(a.clone()));
        assert_eq!(a, b);
        for s in Stream::ALL {
            assert_eq!(draws(&mut a, s, 200), draws(&mut b, s, 200));
        }
    }

    #[test]
    fn normal_and_poisson_moments() {
        let mut r = RngStreams::new(7);
        let n = 200_000;
        let zs: Vec<f64> = (0..n).map(|_| r.normal(Stream::Prices)).collect();
        let mean = zs.iter().sum::<f64>() / n as f64;
        let var = zs.iter().map(|z| (z - mean).powi(2)).sum::<f64>() / n as f64;
        assert!(mean.abs() < 0.01, "mean {mean}");
        assert!((var - 1.0).abs() < 0.01, "var {var}");
        let ks: Vec<u32> = (0..n).map(|_| r.poisson(Stream::Gen, 2.0)).collect();
        let pm = ks.iter().map(|&k| f64::from(k)).sum::<f64>() / n as f64;
        assert!((pm - 2.0).abs() < 0.02, "poisson mean {pm}");
        let zeros = ks.iter().filter(|&&k| k == 0).count() as f64 / n as f64;
        assert!((zeros - (-2.0f64).exp()).abs() < 0.005, "P(0) {zeros}");
    }

    #[test]
    fn integer_range_is_inclusive_and_covers_every_value() {
        let mut r = RngStreams::new(3);
        let mut seen = [0u32; 7];
        for _ in 0..7000 {
            let v = r.int_inclusive(Stream::Gen, 4, 10);
            seen[(v - 4) as usize] += 1;
        }
        assert!(seen.iter().all(|&c| c > 800), "{seen:?}");
        assert_eq!(r.int_inclusive(Stream::Gen, 5, 5), 5);
    }

    #[test]
    fn no_noise_and_scripted_sources() {
        let mut n = NoNoise;
        assert_eq!(n.normal(Stream::Growth), 0.0);
        assert_eq!(n.uniform(Stream::Growth), 0.5);
        assert_eq!(n.poisson(Stream::Gen, 2.0), 2);
        let mut s = ScriptedDraws::new();
        s.push(Stream::Growth, [0.25, -1.5]);
        s.push(Stream::Gen, [3.0]);
        assert_eq!(s.normal(Stream::Growth), 0.25);
        assert_eq!(s.normal(Stream::Growth), -1.5);
        assert_eq!(s.poisson(Stream::Gen, 2.0), 3);
        assert_eq!(s.remaining(Stream::Growth), 0);
    }
}
