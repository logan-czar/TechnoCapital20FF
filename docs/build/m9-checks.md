# M9 closing checks (build-plan M9.8, M9.9)

The two checks m9-plan section 3 (Phase C) asks for before M9 closes, and how to run them.

## M9.8: the leak test

`crates/game/tests/m9_leak.rs` (D574). With Omniscient off it draws, headless, every page for every company that does not publish (the Company page with every section, then each of its seven tabs alone, its hover name card, the command bar's results for its name and Pdoomberg F3 on it), and every other page once: the World page, every list page, every industry, every zone and exchange, every startup event, recap and headline, the characters and countries the companies' pages link to, and every Pdoomberg function page. It does this on a fresh 2020 world (seed 1) and again just after the Q1 2020 recap, with every banded company on the watchlist so F2 and the recap list them.

It reads all the text of each screen: every `Text` in the pane, card, bar or terminal, every row of every table's model (not only the rows on screen) and every chart's readout at every slot. It fails if any figure on screen is a true private value: the Omniscient value of a figure the views band, written any way the UI writes a figure (money, per-share price, percent, ratio, number, the signed gains, a chart's two-decimal number and basis points). It also checks every band against its truth, figure by figure (statements by period): each truth lies strictly inside its band, never at an end, and no money band has an end that reads as its truth.

The truth comes from an Omniscient twin of the same state: the game's save loaded into a second `Sim`, Omniscient turned on, and loaded again so every view is built with it. The screens are drawn from a plain (non-Omniscient) reload of the same save, and the test asserts the shell's views equal another plain reload's: a load rebuilds every view at the current tick, while a running game keeps slower views as of their last rebuild, so live views and a reloaded twin would differ.

**Scope.** The test proves the UI is faithful to the views: no screen shows a value the views hide. Which figures the views band is decided in the sim and rests on the sim's tests (D420 to D440). Integer-typed figures and values the UI could derive from truths are not scanned.

It runs in the gate (`cargo test -p game`, debug: about 20 to 30 s). In release, Omniscient is compiled out of the sim (spec 1, debug only), so the release run builds the sim crate with debug assertions while the game crate stays a plain release build:

```
cargo test --release -p game --test m9_leak --config profile.release.package.sim.debug-assertions=true -- --nocapture
```

Without the `--config`, a release run stops with a message saying so; it never passes unchecked.

Result on Logan's PC (Windows 11, October 2026), release, after the merge of lane C1: pass in 7.1 s (about 22 s to build the sim and game test crates first, the rest of the release build warm).

```
fresh: 2302 screens, 196 subjects, 62092 true renderings, 24550 bands checked (none at or past its truth, no money end reading as it), 0 entries unpaired
after the Q1 recap: 2317 screens, 196 subjects, 93593 true renderings, 36694 bands checked (none at or past its truth, no money end reading as it), 0 entries unpaired
```

What counts as a leak (D574): a figure on a screen about a banded subject (its own pages, card, bar results and F3), or a table row whose first link or name is one, that renders like one of that subject's true values, when that rendering is not also one of the numbers the non-Omniscient views give the subject or one of the public context's (countries, zones, rates, cycle, clock). The ends of a band on screen are left to the band check: every view band holds its truth strictly inside and a band the UI derives from one keeps it inside (D430), so an end that renders like another figure's truth is a coincidence. Canaries (a true value written into the first company's open page as loose text, and as a table row linking it) prove the scan finds what is on screen.

Known limits:

- Loose text on a screen is checked only against the subject the screen is about (or, on a page about no banded subject, the subjects it links to), not against every subject it mentions, so a company's true value printed loose on another company's page would be missed; table rows are checked against the subject they link to first.
- The pane-minimum test (D571) measures the workspace model's rectangles, not the laid-out nodes on screen (dividers and padding take a few pixels), as D450 defines the minimum.

## M9.9: the timing harness

`game --bench-pages` (`crates/game/src/page_bench.rs`; D459, D573), in a release build on a fresh 2020 world:

```
cargo build --release -p game
target/release/game --bench-pages
```

It opens every page kind, every Company tab on a listed and a private company, and every Pdoomberg function page (F3 on a listed company, a private one and none) from a navigate message, and times each to the first laid-out frame, cold and warm. A fresh world has no startup event or headline, so it then runs the game at max speed until the views hold both, pauses, and times a startup event, a headline and a company born in play. It prints a table and exits 1 if any page took 100 ms or more, timed out, or a page kind, Company tab or function page was not covered. It needs a window (a display).

Result on Logan's PC (Windows 11, 24 threads, October 2026; release build after the merge of lane C1, seed 1, the window at its default size): `pages 48 opened, worst 35.93 ms: PASS (target < 100 ms)`, exit 0.

| Page | Cold ms | Frames | Warm ms | Frames |
|---|---|---|---|---|
| companies | 13.41 | 2 | 12.46 | 2 |
| company/0 | 35.93 | 2 | 33.52 | 2 |
| company/1 | 32.93 | 2 | 32.46 | 2 |
| industries | 12.51 | 2 | 11.98 | 2 |
| industry/0 | 14.91 | 2 | 14.32 | 2 |
| characters | 6.96 | 2 | 6.44 | 2 |
| character/0 | 4.05 | 1 | 4.19 | 1 |
| countries | 6.70 | 2 | 6.49 | 2 |
| country/30 | 11.37 | 2 | 11.12 | 2 |
| zones | 7.38 | 2 | 7.06 | 2 |
| zone/0 | 12.63 | 2 | 12.34 | 2 |
| exchanges | 6.95 | 2 | 6.73 | 2 |
| exchange/0 | 15.55 | 2 | 12.24 | 2 |
| events | 2.84 | 1 | 2.88 | 1 |
| recap/2020-Q1 | 2.49 | 1 | 2.76 | 1 |
| news | 3.40 | 1 | 3.12 | 1 |
| recap/2020-Q2 | 2.71 | 1 | 2.42 | 1 |
| recap/2019-Q4 | 2.21 | 1 | 2.33 | 1 |
| settings | 5.53 | 1 | 5.92 | 1 |
| company/0 tab overview | 8.66 | 1 | 8.94 | 1 |
| company/1 tab overview | 8.31 | 1 | 8.19 | 1 |
| company/0 tab chart | 5.87 | 1 | 5.56 | 1 |
| company/1 tab chart | 5.90 | 1 | 5.67 | 1 |
| company/0 tab board | 6.76 | 1 | 7.11 | 1 |
| company/1 tab board | 7.07 | 1 | 6.97 | 1 |
| company/0 tab cap_table | 11.95 | 2 | 12.28 | 2 |
| company/1 tab cap_table | 11.39 | 2 | 11.79 | 2 |
| company/0 tab units | 13.04 | 2 | 14.32 | 2 |
| company/1 tab units | 13.46 | 2 | 15.28 | 2 |
| company/0 tab financials | 16.14 | 2 | 17.09 | 2 |
| company/1 tab financials | 16.80 | 2 | 17.34 | 2 |
| company/0 tab tech | 7.78 | 1 | 7.91 | 1 |
| company/1 tab tech | 7.36 | 1 | 7.42 | 1 |
| company/0 all tabs | 30.65 | 2 | 31.05 | 2 |
| world | 9.00 | 2 | 9.37 | 2 |
| pdoomberg/F2 | 15.05 | 3 | 15.05 | 3 |
| pdoomberg/F3/company/0 | 5.04 | 2 | 4.92 | 2 |
| pdoomberg/F3/company/1 | 3.80 | 2 | 3.89 | 2 |
| pdoomberg/F3 | 2.89 | 2 | 2.82 | 2 |
| pdoomberg/F4 | 3.09 | 2 | 3.15 | 2 |
| pdoomberg/F5 | 10.48 | 3 | 10.38 | 3 |
| pdoomberg/F6 | 11.43 | 3 | 11.64 | 3 |
| pdoomberg/F7 | 10.38 | 3 | 10.53 | 3 |
| pdoomberg/F9 | 12.39 | 3 | 11.75 | 3 |
| pdoomberg/F10 | 15.90 | 3 | 15.72 | 3 |
| *later, on 09 Apr 2020: the kinds a fresh world has none of* | | | | |
| event/0 | 9.96 | 2 | 8.07 | 2 |
| headline/0 | 3.95 | 1 | 2.86 | 1 |
| company/651 | 28.05 | 2 | 28.32 | 2 |

## M8 Phase A: the checks with the map present (lane MA)

The map draws behind floating windows (D635 to D638), so both M9 checks now run with it.

- **Leak test** (`m9_leak.rs`): it also reads the Province page of every province where a banded company has its HQ or a unit, since lane MB adds unit assets there. It passes with the map plugin and the window layer in the shell (no map assets in a headless test): debug, `fresh: 2447 screens` and `after the Q1 recap: 2462 screens` (145 Province pages more than before), 196 subjects, no leak, 16.3 s.
- **Timing harness** (`--bench-pages`): it also opens a Province page (the M8 placeholder, D637), 49 pages. Release, Logan's PC, on the 8192 x 4096 synthetic map: `pages 49 opened, worst 20.45 ms: PASS`; `province/431` 2.85 ms cold, 2.42 ms warm.

### The map's frame time (`--bench-map`, D639)

```
cargo build --release -p game
target/release/game --synthetic-map DIR --synthetic-width 8192 --bench-map 20
target/release/game --map-dir assets/map --bench-map 20      # once lane P's NA map is in
```

It opens four panes in three windows (Companies and Industries side by side, a company page, the news feed), then pans the map every frame and zooms in and out through the three levels while the hover point moves, without vsync. Release, Logan's PC (Windows 11, RTX 5070 Ti, the window at its default 1280 x 720), October 2026, other builds running alongside; 8192: three runs, 4096: two, no map: one:

| Map | Frames per second | Frame ms p50 | p95 | p99 | max | Frames at World / Country / Province |
|---|---|---|---|---|---|---|
| Synthetic 8192 x 4096 (283 provinces, the contract's full size) | 272 to 414 | 2.35 to 3.70 | 2.87 to 4.53 | 3.43 to 16.73 | 5.36 to 32.12 | 3282 / 3748 / 1256 (best run) |
| Synthetic 4096 x 2048 | 277 to 349 | 2.66 to 3.75 | 4.23 to 4.83 | 4.79 to 6.11 | 9.20 to 22.47 | 3028 / 3444 / 516 |
| No map (same panes) | 256 | 3.80 | 4.96 | 5.74 | 7.47 | none |

Every run is far inside 60 fps (16.7 ms); the map's own cost is within the run-to-run noise. The single-frame maxima are rare spikes (under 1% of frames) that came and went between runs of the same map. The NA run waits for lane P's assets on main.

## M8 Phase B: the checks with the map modes, cards and Province page (lane MB)

The map now has its modes (M8.5), labels (M8.6), the province and zone hover cards and the Province page (M8.7), D700 to D708. Both M9 checks cover them (D705).

### The leak test

`m9_leak.rs` runs the shell on a synthetic world map (one island per province file, 1024 x 512, so every province has a shape, every HQ a pin and every province a hover card) and also scans, on both states:

- every map mode's map node (the mode bar, the legend, the labels and the pins as links): Political, each development track, the Industry track, every industry's assets (42), the HQ pins unfiltered, listed only, private only and by each industry (42), and the zones: 94 modes. The HQ modes are about every banded company they pin; an industry heat map's printed stops are its own scale, a function of the shown values only, so its legend is scanned as about no subject and the scale is checked raw (below);
- every HQ pin's size: the layer's size is the plain row's shown revenue TTM, never the Omniscient twin's true revenue of a banded company, and the pin's diameter follows it (552 banded pins a state);
- every heat value of a province where a banded company has a unit of the industry: never the twin's true sum, and the scale's top is the shown maximum (329 a state);
- the map hover card of every province where a banded company has its HQ or a unit (145), about those companies, with a canary (a true value written into the card is found);
- every zone's hover card, at its hub (26).

Result on Logan's PC, release (`cargo test --release -p game --test m9_leak --config profile.release.package.sim.debug-assertions=true`), October 2026, other builds running alongside: pass in 11.8 s; debug in the gate: pass in about 31 to 38 s.

```
fresh: 2712 screens, 196 subjects, 62092 true renderings, 24550 bands checked (none at or past its truth, no money end reading as it), 0 entries unpaired
after the Q1 recap: 2727 screens, 196 subjects, 93593 true renderings, 36694 bands checked (none at or past its truth, no money end reading as it), 0 entries unpaired
fresh: map: 94 modes, 552 banded HQ pins, 329 banded heat values, 145 province cards, 26 zone cards
after the Q1 recap: map: 94 modes, 552 banded HQ pins, 329 banded heat values, 145 province cards, 26 zone cards
```

(The Province pages were already read since Phase A; they now show the real page with the HQ and unit tables.) The sim's own test (`crates/sim/tests/m8_map_modes.rs`) checks the same against an Omniscient twin for every pin and every industry's heat values.

### The timing harness

`--bench-pages` opens the real Province page and times every map mode switch: each development track, the Industry track, the industry with the most units, the HQ pins (all, then listed only), the zones and back to Political, from the mode message (what a click on the mode bar sends) to the first frame whose colour table holds the new layer and whose pins are placed (D705). It fails if one takes 100 ms or more or a mode kind is not covered. Release, Logan's PC, the NA map (`assets/map`), seed 1, other builds running alongside (about half the CPU busy): `pages 59 opened, worst 25.82 ms: PASS`.

| Item | Cold ms | Frames | Warm ms | Frames |
|---|---|---|---|---|
| province/431 | 11.08 | 2 | 14.32 | 2 |
| map mode development:commerce | 1.91 | 1 | 1.35 | 1 |
| map mode development:industry | 1.56 | 1 | 1.55 | 1 |
| map mode development:population | 1.43 | 1 | 4.24 | 1 |
| map mode development:total | 1.67 | 1 | 1.67 | 1 |
| map mode industry track | 1.73 | 1 | 1.38 | 1 |
| map mode industry:28 | 6.54 | 1 | 1.55 | 1 |
| map mode hqs | 2.97 | 1 | 2.08 | 1 |
| map mode hqs listed | 2.42 | 1 | 2.36 | 1 |
| map mode zones | 2.01 | 1 | 1.68 | 1 |
| map mode political | 1.82 | 1 | 5.10 | 1 |

### The map's frame time in each mode

`--bench-map` takes `--map-mode MODE` (`political`, `development[:track]`, `industry[:N]`, `hqs`, `zones`) and `--map-metros`. Release, Logan's PC (RTX 5070 Ti, the window at its default size), the NA map, 15 s a run, other builds running alongside:

```
target/release/game --bench-map 15 --map-mode hqs
```

| Mode | Frames per second | Frame ms p50 | p95 | p99 | max | Frames at World / Country / Province |
|---|---|---|---|---|---|---|
| Political | 375 | 2.55 | 3.57 | 4.54 | 18.19 | 2254 / 2490 / 884 |
| Development (Total) | 387 | 2.49 | 3.24 | 4.22 | 7.69 | 2342 / 2567 / 903 |
| Industry (industry 28's assets) | 388 | 2.48 | 3.31 | 4.06 | 6.53 | 2358 / 2546 / 919 |
| Company HQs (651 pins) | 370 | 2.61 | 3.45 | 4.09 | 6.21 | 2209 / 2454 / 891 |
| Financial zones (26 hub pins) | 371 | 2.57 | 3.50 | 5.05 | 9.63 | 2206 / 2466 / 892 |
| Political with Metro outlines | 374 | 2.59 | 3.36 | 4.29 | 7.41 | 2261 / 2464 / 888 |

Every mode is far inside 60 fps; the labels, pins and Metro outlines cost nothing measurable against the run-to-run noise.

### The soak

The map views move nothing: `headless soak --years 10 --seeds 1..4` before (main a31b1a9) and after this lane gives byte-identical `years.csv` and `quarters.csv` (md5 121b5c7b... and cf890b48...). v_map_layers' monthly rebuild costs 0.42 ms (0.067 s over a 10-year seed, 1.9% of the run in `headless run --profile`).
