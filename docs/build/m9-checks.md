# M9 closing checks (build-plan M9.8, M9.9)

The two checks m9-plan section 3 (Phase C) asks for before M9 closes, and how to run them.

## M9.8: the leak test

`crates/game/tests/m9_leak.rs` (D574). With Omniscient off it draws, headless, every page for every company that does not publish (the Company page with every section, then each of its seven tabs alone, its hover name card, the command bar's results for its name and Pdoomberg F3 on it), and every other page once: the World page, every list page, every industry, every zone and exchange, every startup event, recap and headline, the characters and countries the companies' pages link to, and every Pdoomberg function page. It does this on a fresh 2020 world (seed 1) and again just after the Q1 2020 recap, with every banded company on the watchlist so F2 and the recap list them.

It reads all the text of each screen: every `Text` in the pane, card, bar or terminal, every row of every table's model (not only the rows on screen) and every chart's readout at every slot. It fails if any figure on screen is a true private value: the Omniscient value of a figure the views band, written any way the UI writes a figure (money, per-share price, percent, ratio, number, and the signed gains). It also checks every band against its truth, figure by figure (statements by period): each truth lies strictly inside its band, never at an end, and no money band has an end that reads as its truth.

The truth comes from an Omniscient twin of the same state: the game's save loaded into a second `Sim`, Omniscient turned on, and loaded again so every view is built with it.

It runs in the gate (`cargo test -p game`, debug: about 20 to 30 s). In release, Omniscient is compiled out of the sim (spec 1, debug only), so the release run builds the sim crate with debug assertions while the game crate stays a plain release build:

```
cargo test --release -p game --test m9_leak --config profile.release.package.sim.debug-assertions=true -- --nocapture
```

Without the `--config`, a release run stops with a message saying so; it never passes unchecked.

Result on Logan's PC (Windows 11, October 2026), release: pass in 5.7 s (about 22 s to build the sim and game test crates first, the rest of the release build warm).

```
fresh: 2302 screens, 196 subjects, 54669 true renderings, 24550 bands checked (none at or past its truth, no money end reading as it), 0 entries unpaired
after the Q1 recap: 2317 screens, 196 subjects, 81802 true renderings, 36694 bands checked (none at or past its truth, no money end reading as it), 0 entries unpaired
```

What counts as a leak (D574): a figure on a screen about a banded subject (its own pages, card, bar results and F3), or a table row whose first link or name is one, that renders like one of that subject's true values, when that rendering is not also one of the numbers the non-Omniscient views give the subject or one of the public context's (countries, zones, rates, cycle, clock). The ends of a band on screen are left to the band check: every view band holds its truth strictly inside and a band the UI derives from one keeps it inside (D430), so an end that renders like another figure's truth is a coincidence. A canary (a true value written into the first company's open page) proves the scan finds what is on screen.

## M9.9: the timing harness

`game --bench-pages` (`crates/game/src/page_bench.rs`; D459, D573), in a release build on a fresh 2020 world:

```
cargo build --release -p game
target/release/game --bench-pages
```

It opens every page kind, every Company tab on a listed and a private company, and every Pdoomberg function page (F3 on a listed company, a private one and none) from a navigate message, and times each to the first laid-out frame, cold and warm. A fresh world has no startup event or headline, so it then runs the game at max speed until the views hold both, pauses, and times a startup event, a headline and a company born in play. It prints a table and exits 1 if any page took 100 ms or more, timed out, or a page kind, Company tab or function page was not covered. It needs a window (a display).

Result on Logan's PC (Windows 11, 24 threads, October 2026; release build, seed 1, the window at its default size): `pages 48 opened, worst 37.30 ms: PASS (target < 100 ms)`, exit 0.

| Page | Cold ms | Frames | Warm ms | Frames |
|---|---|---|---|---|
| companies | 12.55 | 2 | 14.05 | 2 |
| company/0 | 37.30 | 2 | 33.12 | 2 |
| company/1 | 32.64 | 2 | 32.44 | 2 |
| industries | 12.17 | 2 | 12.15 | 2 |
| industry/0 | 15.21 | 2 | 14.52 | 2 |
| characters | 6.81 | 2 | 6.65 | 2 |
| character/0 | 3.91 | 1 | 4.01 | 1 |
| countries | 6.69 | 2 | 6.53 | 2 |
| country/30 | 11.27 | 2 | 10.84 | 2 |
| zones | 7.37 | 2 | 7.09 | 2 |
| zone/0 | 12.97 | 2 | 12.29 | 2 |
| exchanges | 7.08 | 2 | 6.52 | 2 |
| exchange/0 | 12.88 | 2 | 11.99 | 2 |
| events | 2.92 | 1 | 2.76 | 1 |
| recap/2020-Q1 | 2.35 | 1 | 2.31 | 1 |
| news | 3.45 | 1 | 2.86 | 1 |
| recap/2020-Q2 | 2.87 | 1 | 2.57 | 1 |
| recap/2019-Q4 | 2.25 | 1 | 2.46 | 1 |
| settings | 5.57 | 1 | 5.35 | 1 |
| company/0 tab overview | 8.62 | 1 | 8.73 | 1 |
| company/1 tab overview | 8.08 | 1 | 8.03 | 1 |
| company/0 tab chart | 5.90 | 1 | 5.79 | 1 |
| company/1 tab chart | 5.75 | 1 | 5.86 | 1 |
| company/0 tab board | 7.16 | 1 | 6.80 | 1 |
| company/1 tab board | 7.09 | 1 | 7.31 | 1 |
| company/0 tab cap_table | 11.57 | 2 | 13.02 | 2 |
| company/1 tab cap_table | 11.41 | 2 | 11.88 | 2 |
| company/0 tab units | 13.26 | 2 | 12.83 | 2 |
| company/1 tab units | 13.46 | 2 | 13.55 | 2 |
| company/0 tab financials | 16.92 | 2 | 16.24 | 2 |
| company/1 tab financials | 17.08 | 2 | 17.30 | 2 |
| company/0 tab tech | 7.61 | 1 | 7.88 | 1 |
| company/1 tab tech | 7.22 | 1 | 7.34 | 1 |
| company/0 all tabs | 30.43 | 2 | 30.73 | 2 |
| world | 9.44 | 2 | 9.17 | 2 |
| pdoomberg/F2 | 13.44 | 2 | 13.00 | 2 |
| pdoomberg/F3/company/0 | 3.65 | 1 | 4.30 | 1 |
| pdoomberg/F3/company/1 | 2.26 | 1 | 1.84 | 1 |
| pdoomberg/F3 | 1.57 | 1 | 2.05 | 1 |
| pdoomberg/F4 | 2.20 | 1 | 1.85 | 1 |
| pdoomberg/F5 | 11.95 | 2 | 9.86 | 2 |
| pdoomberg/F6 | 11.24 | 2 | 8.97 | 2 |
| pdoomberg/F7 | 8.87 | 2 | 10.19 | 2 |
| pdoomberg/F9 | 10.57 | 2 | 11.78 | 2 |
| pdoomberg/F10 | 14.65 | 2 | 13.93 | 2 |
| *later, on 01 May 2020: the kinds a fresh world has none of* | | | | |
| event/0 | 9.85 | 2 | 8.67 | 2 |
| headline/2020-01-09/0 | 4.09 | 1 | 2.74 | 1 |
| company/651 | 29.02 | 2 | 28.70 | 2 |
