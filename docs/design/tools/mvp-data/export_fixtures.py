#!/usr/bin/env python3
"""Export validate.py's growth and boom runs as golden fixtures for the Rust engine (build-plan 4.2, M2.10).

    python3 export_fixtures.py [design/data dir] [output dir]

Python's `random` and the engine's ChaCha streams give different numbers for the same seed, so this script
records every draw validate.py's seed-150 growth run makes (the phase g and length draws of the global cycle and
each industry's growth shock z) together with validate.py's own results (the phase path and each industry's
compound average yearly growth), and the engine replays the draws through `ScriptedDraws` and must match to 1e-9.
It also writes validate.py's noise-free boom run (mvp-spec 5.1.1) year by year for every industry.

Nothing in validate.py changes: the draws are recorded by swapping `random.Random` for a subclass that logs what
`uniform`, `randint` and `gauss` return while validate.growth_run runs (uniform is re-implemented with CPython's own
formula `a + (b - a) * random()`, so the logged value is the raw uniform the engine scales the same way).

Files written (default output dir: crates/sim/tests/fixtures):
  validate-growth-seed150.csv  rows `z_avg,Z`; `cycle,q,u,length` (a phase draw made in quarter q, q 0 = load);
                               `z,q,industry_id,z` (raw gauss, before the +-3 clamp); `path,q,phase,g`;
                               `avg,industry_id,compound average yearly growth over the 40 quarters`.
                               Draws cover 41 quarters (the engine's 1 January 2030 job closes December 2029 and
                               draws one more quarter); path and avg are validate.py's 40-quarter results.
  validate-boom-calm.csv       rows `demand,industry_id,year,lt,year-end demand in $bn` from boom_run(noise=False).
"""
import os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import validate  # noqa: E402

SEED, QUARTERS = 150, 40
HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUT = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', 'crates', 'sim', 'tests', 'fixtures'))


class Recorder(random.Random):
    """A Random that logs the values the growth model's draws return, in order."""
    log = None

    def uniform(self, a, b):
        u = self.random()
        self.log.append(('u', u))
        return a + (b - a) * u

    def randint(self, a, b):
        v = super().randint(a, b)
        self.log.append(('i', v))
        return v

    def gauss(self, mu=0.0, sigma=1.0):
        v = super().gauss(mu, sigma)
        self.log.append(('n', v))
        return v


def recorded_growth_run(inds, z_avg, quarters):
    """validate.growth_run with every draw logged; returns (avg, path, log)."""
    log = []
    Recorder.log = log
    plain = random.Random
    random.Random = Recorder
    try:
        avg, path = validate.growth_run(inds, z_avg, seed=SEED, quarters=quarters)
    finally:
        random.Random = plain
    return avg, path, log


def split_quarters(log, n_inds):
    """Splits the draw log into quarters: each is (cycle draw (u, length) or None, [z per industry])."""
    out, i, q = [], 0, 0
    while i < len(log):
        cyc = None
        if log[i][0] == 'u':
            assert log[i + 1][0] == 'i', 'a g draw is always followed by a length draw'
            cyc = (log[i][1], log[i + 1][1])
            i += 2
        zs = [v for k, v in log[i:i + n_inds]]
        assert all(k == 'n' for k, _ in log[i:i + n_inds]) and len(zs) == n_inds, f'quarter {q}: bad draw order'
        i += n_inds
        out.append((cyc, zs))
        q += 1
    return out


def main():
    data = sys.argv[1] if len(sys.argv) > 1 else os.path.normpath(os.path.join(HERE, '..', '..', 'data'))
    out_dir = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUT
    inds = validate.load(os.path.join(data, 'industries.csv'))
    ce = validate.load(os.path.join(data, 'country-economy.csv'))
    zones = validate.load(os.path.join(data, 'financial-zones.csv'))
    # Z exactly as validate.run computes it
    gdp = {r['iso3']: float(r['gdp_usd_bn']) for r in validate.load(os.path.join(data, 'countries.csv'))}
    inten = {z['zone_id']: float(z['intensity']) for z in zones}
    z_avg = sum(gdp[r['iso3']] * inten[r['financial_zone']] for r in ce) / sum(gdp[r['iso3']] for r in ce)

    avg_plain, path_plain = validate.growth_run(inds, z_avg, seed=SEED)
    avg, path, log40 = recorded_growth_run(inds, z_avg, QUARTERS)
    assert avg == avg_plain and path == path_plain, 'recording changed the run'
    _, _, log41 = recorded_growth_run(inds, z_avg, QUARTERS + 1)
    assert log41[:len(log40)] == log40, 'the 41-quarter run must start with the 40-quarter draws'
    quarters = split_quarters(log41, len(inds))
    assert len(quarters) == QUARTERS + 1

    os.makedirs(out_dir, exist_ok=True)
    lines = ['# validate.py growth_run, seed 150 (mvp-spec 5.1; build-plan 4.2, M2.10). Written by '
             'docs/design/tools/mvp-data/export_fixtures.py; do not edit by hand.',
             f'z_avg,{z_avg!r}']
    for q, (cyc, zs) in enumerate(quarters):
        if cyc is not None:
            lines.append(f'cycle,{q},{cyc[0]!r},{cyc[1]}')
        for r, z in zip(inds, zs):
            lines.append(f'z,{q},{r["id"]},{z!r}')
    for q, (phase, g) in enumerate(path):
        lines.append(f'path,{q},{phase},{g!r}')
    for r in inds:
        lines.append(f'avg,{r["id"]},{avg[r["name"]]!r}')
    with open(os.path.join(out_dir, 'validate-growth-seed150.csv'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines) + '\n')

    sched = validate.load(os.path.join(data, 'ai-boom.csv'))
    calm = validate.boom_run(inds, sched, z_avg, seed=151, noise=False)
    lines = ['# validate.py boom_run(noise=False): pop 1 Jan 2040 (mvp-spec 5.1.1; build-plan M2.4). Written by '
             'docs/design/tools/mvp-data/export_fixtures.py; do not edit by hand.']
    for r in inds:
        for year, lt, dem in calm[r['name']]:
            lines.append(f'demand,{r["id"]},{year},{lt!r},{dem!r}')
    with open(os.path.join(out_dir, 'validate-boom-calm.csv'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines) + '\n')
    print(f'wrote {out_dir}: {len(quarters)} quarters of draws, {sum(1 for c, _ in quarters if c)} phase draws')
    return 0


if __name__ == '__main__':
    sys.exit(main())
