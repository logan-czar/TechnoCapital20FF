# The 1995 generator's source rows

These are the tables of the hand-built 2020 world, which used to live in `docs/design/data/` and were
played with `--world 2020` and `?world=2020` until that world was removed (D1053, D1055). Nothing plays
them now: `tools/world-1995/gen.py` and `validate.py` read them as input and cut, scale and replace them
into `assets/worlds/1995/`. Change a row here only to change the 1995 world, then rerun `gen.py` and
`validate.py`.

`company_start.py` and `engine_model.py`, beside `gen.py`, are the parts of the old
`docs/design/tools/mvp-data/gen.py` and `validate.py` the generator calls, moved unchanged.

The 2020 world's tables as the sim last loaded them are frozen in
`packages/sim/test/fixtures/world-mini/`, which the tests and the research tools load.
