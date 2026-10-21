//! CSV unit conversions (CLAUDE.md, decision D3): money is f64 USD and rates are fractions inside
//! the sim; the CSVs give $M, $bn and bps. These run only in [`super::load`], once, at load.

/// USD in one million (the CSV `_usd_m` columns).
pub const USD_PER_MILLION: f64 = 1.0e6;
/// USD in one billion (the CSV `_usd_bn` columns).
pub const USD_PER_BILLION: f64 = 1.0e9;
/// Basis points in 1.0 (the CSV `_bps` columns).
pub const BPS_PER_UNIT: f64 = 10_000.0;
/// How far a CSV share count may sit from a whole number before load rejects it.
pub const SHARE_COUNT_TOLERANCE: f64 = 1.0e-6;

/// `$M` to USD.
pub fn usd_from_millions(m: f64) -> f64 {
    m * USD_PER_MILLION
}

/// `$bn` to USD.
pub fn usd_from_billions(bn: f64) -> f64 {
    bn * USD_PER_BILLION
}

/// Basis points to a fraction (100 bps is 0.01).
pub fn fraction_from_bps(bps: f64) -> f64 {
    bps / BPS_PER_UNIT
}

/// A CSV share count (a whole, non-negative number stored as a float) to u64 (D3).
pub fn shares_from_csv(shares: f64) -> Result<u64, String> {
    let whole = shares.round();
    if !shares.is_finite() || shares < 0.0 || (shares - whole).abs() > SHARE_COUNT_TOLERANCE {
        return Err(format!("share count `{shares}` is not a whole number"));
    }
    if whole >= u64::MAX as f64 {
        return Err(format!("share count `{shares}` is too large"));
    }
    Ok(whole as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn conversions() {
        assert_eq!(usd_from_millions(40.0), 40_000_000.0);
        assert_eq!(usd_from_billions(2.5), 2_500_000_000.0);
        assert_eq!(fraction_from_bps(312.0), 0.0312);
        assert_eq!(shares_from_csv(6_666_667.0), Ok(6_666_667));
        assert!(shares_from_csv(1.5).is_err());
        assert!(shares_from_csv(-1.0).is_err());
    }
}
