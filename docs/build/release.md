# Release builds (build-plan M10.8)

The two binaries are the desktop game (`game`, Bevy) and the headless runner (`headless`: the data check, the soak and its checker, profiling, record and replay). Both are plain Cargo release builds of this workspace; there is no installer or packaging step in the MVP.

## Build

The toolchain is pinned by `rust-toolchain.toml` (Rust 1.97 with rustfmt and clippy); rustup installs it on first use. Bevy is pinned at `=0.20.0` and `Cargo.lock` is committed, so `--locked` builds exactly the tested dependency set.

```
cargo build --release --locked -p game -p headless
```

The binaries land in `target/release/`: `game` and `headless` (`game.exe` and `headless.exe` on Windows).

Before shipping a build, run the local gate (`scripts/check.ps1` on Windows, `scripts/check.sh` elsewhere) on the same commit.

### Windows (tested on this PC)

- Rust via rustup with the MSVC toolchain (`x86_64-pc-windows-msvc`), and the Visual Studio Build Tools (the "Desktop development with C++" workload: the MSVC linker and the Windows SDK).
- Nothing else: Bevy's Windows backend needs no system libraries.

### macOS (not tested here)

- Rust via rustup, and the Xcode command line tools (`xcode-select --install`) for the linker and the system frameworks Bevy links (Metal, AppKit).
- Apple silicon and Intel build natively (`aarch64-apple-darwin`, `x86_64-apple-darwin`). A universal binary would need both targets and `lipo`; not set up for the MVP.

### Linux (not tested here)

- Rust via rustup, a C toolchain and `pkg-config`, plus the libraries Bevy's window, input and Wayland/X11 backends link. On Debian or Ubuntu: `sudo apt install build-essential pkg-config libudev-dev libasound2-dev libwayland-dev libxkbcommon-dev libx11-dev libxcursor-dev libxi-dev libxrandr-dev`. The game enables Bevy's `x11` and `wayland` features, so one binary runs under either. (`libasound2-dev` is listed in Bevy's Linux setup; the game turns audio off, so it may not be needed.)
- Other distributions: the same libraries under their own names (Bevy's `docs/linux_dependencies.md`).

## Data

Both binaries load the starting world from `docs/design/data` in the repository they were built from: `sim_data::default_data_dir()` is fixed at compile time from the crate's location. Run them from a checkout (any working directory), or pass `--data-dir DIR` to `headless`. A self-contained release that carries its data beside the binary is post-MVP.

## Smoke test

The game has a release bench that runs the sim at max speed with the shell drawing, then exits and prints the date it reached (D14):

```
target/release/game --bench-max 5
```

It prints `BENCH sim: <ticks> ticks, <rate> game hours per second, reached <date>` after 5 seconds of measured frames (after a 120-frame warm-up). The headless smoke test is the data check and a short run:

```
target/release/headless --check-data
target/release/headless run --years 1 --seeds 1
```

## Results on Logan's PC (Windows 11, 24 threads)

Built with rustc 1.97.1 on Windows 11 (MSVC), October 2026:

| Check | Result |
|---|---|
| `cargo build --release --locked -p game -p headless` (Bevy and the game from scratch, the sim crates already built) | 1 min 55 s; `game.exe` 66 MB, `headless.exe` 2.4 MB |
| `game.exe --bench-max 5` | Window opened, ran 5 s at max speed and exited 0: 297 fps (frame p50 1.2 ms, p95 11.9 ms), the sim at about 27,800 game hours a second, reaching 25 August 2037 from the 2020 start |
| `headless.exe --check-data` | OK |
| `headless.exe run --years 1 --seeds 1` | 152 ms |
| `headless.exe run --years 30 --seeds 1` | 5.5 to 7 s (the spec 10 M10 budget is 2 minutes); see soak.md, Profiling |

macOS and Linux were not built or run for this milestone: the steps above are what Bevy 0.20 and this workspace need there, untested.
