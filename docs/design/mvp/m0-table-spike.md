# M0.8 table spike: go or no-go note

_Status: 2026-10-21, build-plan M0.8 (risk R1). Code: `crates/game/examples/table_spike.rs` on branch build/m0-workspace._

**Verdict: provisional go** for an in-house `bevy_ui` table widget (M7.7), pending the real-machine checks below.

## What the spike does

- A table of all 3,255 provinces (id, name, country, commerce, industry, population), read from the real CSVs through `sim-data`.
- **Virtualized:** only the visible rows exist. A fixed pool of 26 row nodes (6 text cells each, 156 text entities in all) is spawned once; scrolling or sorting rewrites their text, so the entity count does not grow with the data.
- **Scroll:** mouse wheel, arrow keys, PageUp, PageDown, Home and End move the first visible row.
- **Sort:** clicking a column header sorts by it (stable sort of an index list); clicking it again reverses. Clicks use `bevy_picking` observers (`On<PointerClick>`); Bevy 0.20 has no `Interaction` component in `bevy_ui`.
- A status line shows the visible range, the sort column and order, the last sort time and the frame time.

Run it with `cargo run -p game --example table_spike --release`.

## What was tested here (cloud container, no GPU)

Bevy 0.20.0 with only the window, UI and text features. Run under Xvfb on llvmpipe (Mesa software Vulkan), debug build with dependencies at opt-level 2, driven with xdotool and checked by screenshot:

- The table renders: header, 26 rows with alternating backgrounds, the default font, text clipped to its column.
- A header click sorts (Commerce ascending, then descending, then ascending again: one toggle per click). Sorting 3,255 rows took 0.8 to 1.6 ms.
- The mouse wheel scrolls (one notch moved 6 rows, see below).
- Frame time about 22 to 29 ms on software rendering, debug build. This says nothing about a real GPU.

## Still to test on a real machine (Windows, macOS, Linux with a GPU)

1. **Frame time** in a release build while scrolling fast and re-sorting: target well under 16 ms, with the text rewrite of 156 cells per frame. If text layout is the cost, cache per-cell strings or only rewrite cells whose row changed.
2. **Wheel step:** under Xvfb one wheel notch arrived as two line events (6 rows). Check the step on each OS, on a trackpad (pixel deltas) and with high-resolution wheels; tune the rows per line.
3. **Click accuracy and hover:** header clicks on HiDPI screens and with window scaling; add a hover highlight and a sort arrow.
4. **Resize:** the pool is fixed at 26 rows; the real widget should size the pool to the viewport height.
5. **Fonts:** only the default font was used; check a monospace font for number columns and right alignment.
6. **Scale:** a 10,000-row run (future companies plus characters) to confirm the sort and the rewrite stay flat.

If (1) fails badly on a mid-range machine, fall back to rendering each row as one text entity with spans instead of 6 entities, before considering any other UI crate (UI is `bevy_ui` only, CLAUDE.md).
