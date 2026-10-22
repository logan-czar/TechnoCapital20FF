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

Results: below.
