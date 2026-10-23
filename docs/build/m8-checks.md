# M8 closing checks (m8-plan section 3 Phase C, section 6)

The checks m8-plan asks for before M8 closes, on the committed world map (`assets/map`, all 3,255 provinces), and how to run them. The M9 checks' earlier M8 results (Phase A and B, on the synthetic and North American maps) stay in [m9-checks.md](m9-checks.md).

## P8: the map QA reports

The QA step on the committed assets, alone (it reads the pipeline's intermediates in the geodata cache, `D:\Data\tc20ff-geodata\work\`, from the run that built the assets):

```
cd tools/map-pipeline
uv sync --frozen
uv run python run.py --region all --steps qa
```

Result on Logan's PC, October 2026, main 5074f00 (a fresh venv in this slot): every region passes in 29 s, and the reports, previews and CREDITS.md it rewrites are byte-identical to the committed ones (no diff in `assets/map`).

| Region | Flagged (confidence < 0.6) | Hinted | Tiny | Coastal differences | Nesting problems | Result |
|---|---|---|---|---|---|---|
| north-america | 4 | 40 | 18 | 30 | 0 | pass |
| east-asia-oceania | 0 | 96 | 89 | 61 | 0 | pass |
| europe | 0 | 100 | 64 | 35 | 0 | pass |
| latin-america | 0 | 19 | 43 | 25 | 0 | pass |
| mena | 0 | 80 | 72 | 32 | 0 | pass |
| russia-central-asia | 0 | 27 | 12 | 3 | 0 | pass |
| south-asia | 0 | 43 | 21 | 10 | 0 | pass |
| sub-saharan-africa | 0 | 27 | 53 | 22 | 0 | pass |
| **world** | **4** | **432** | **372** | **218** | **0** | **pass** |

QA fails on anything that is an error (a province without pixels, a licence problem, a city probe mismatch, an unchecked Natural Earth label row, a hint seed outside its region, an unexplained exclave, a `sea_only` pair with a land row), so a pass leaves only the items each report lists for review: the low-confidence and hinted crosswalk rows, the builder-drawn and approximate lines (D676, D681), Known for review, the watched small provinces, the coastal differences, and the refused attribution-only licences (swisstopo for CHE, "Other - Direct Permission" for OMN; D685). **Logan reviewed those items at the Phase B gate (the flagged crosswalk rows of every region) and passed it, so every report's remaining items are signed off.** No report changed since: the committed reports are the ones this run rewrote.
