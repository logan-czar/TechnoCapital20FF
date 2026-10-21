# Build decisions log

Choices builders made where mvp-spec.md v1.4 is silent, ambiguous or contradictory (pick, log, keep going). Logan signs them off at the milestone gates. A value chosen here is a named constant in code, with a comment pointing back to its row.

| Id | Spec | Question | Choice | Constant | PR | Signed off |
|---|---|---|---|---|---|---|
| D1 | 5.13, 5.14, 5.17 | The sector table with annual volatility, beta and typical payout ratio is in no CSV; `g_sector` is undefined | One shared default per value for all 42 industries (all industries already share defaults); `g_sector` is the industry's `lt` growth | `SECTOR_VOLATILITY`, `SECTOR_BETA`, `SECTOR_PAYOUT` (set in M5/M6) | Phase 0 | Logan, plan |
| D2 | all | Tie-break when the spec gives none | Lower id wins, so iteration order stays deterministic | (none) | Phase 0 | Logan, plan |
| D3 | 3 | Share counts as u32 overflow for large companies | Share counts are u64; money is f64 USD, with CSV $M, $bn and bps converted once at load | (none) | Phase 0 | Logan, plan |
