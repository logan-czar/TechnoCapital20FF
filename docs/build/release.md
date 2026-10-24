# Release builds (build-plan M10.8)

The two binaries are the desktop game (`game`, Bevy) and the headless runner (`headless`: the data check, the soak and its checker, profiling, record and replay). Both are plain Cargo release builds of this workspace; there is no installer or packaging step in the MVP.

## Build

The toolchain is pinned by `rust-toolchain.toml` (Rust 1.97 with rustfmt and clippy); rustup installs it on first use. Bevy is pinned at `=0.20.0` and `Cargo.lock` is committed, so `--locked` builds exactly the tested dependency set.

```
cargo build --release --locked -p game -p headless
```

The binaries land in `target/release/`: `game` and `headless` (`game.exe` and `headless.exe` on Windows).

Before shipping a build, run the local gate (`scripts/check.ps1` on Windows, `scripts/check.sh` elsewhere) on the same commit.

### Windows (built and run on this PC)

- Rust via rustup with the MSVC toolchain (`x86_64-pc-windows-msvc`), and the Visual Studio Build Tools (the "Desktop development with C++" workload: the Windows SDK's import libraries). The linker is rust-lld, which ships with the toolchain (`.cargo/config.toml`, D870); that setting is under `[target.x86_64-pc-windows-msvc]`, so no other target sees it.
- Nothing else: Bevy's Windows backend (DX12 or Vulkan) needs no system libraries.
- Build: `cargo build --release --locked -p game -p headless`, in PowerShell or Git Bash. The gate is `scripts/check.ps1` (or `bash scripts/check.sh`).

### Linux, x86_64 (not built here; type-checked from Windows)

- Rust via rustup (rustup installs the pinned 1.97 on first use), a C toolchain and `pkg-config`, and the Wayland client headers: the only native build dependency is `wayland-sys`, whose build script asks pkg-config for `wayland-client` (Bevy's `wayland` feature). On Debian or Ubuntu: `sudo apt install build-essential pkg-config libwayland-dev`.
- X11 and xkbcommon are opened at run time (`x11-dl`, `xkbcommon-dl`), so they need the libraries, not their headers: `libx11-6 libxcursor1 libxi6 libxrandr2 libxkbcommon0` (on any desktop install already). The game enables Bevy's `x11` and `wayland` features, so one binary runs under either.
- Rendering is Vulkan only (wgpu's `vulkan` backend; no GL backend is built), so the machine needs a Vulkan driver: `mesa-vulkan-drivers` for AMD and Intel, the proprietary driver for NVIDIA.
- Not needed: `libudev-dev` and `libasound2-dev` from Bevy's general Linux list. The game builds no gamepad or audio support, and `Cargo.lock` has neither `libudev-sys` nor `alsa-sys`.
- Build: `cargo build --release --locked -p game -p headless`, then `bash scripts/check.sh`.
- Other distributions: the same packages under their own names (Bevy's `docs/linux_dependencies.md`).

### macOS, Apple silicon and Intel (not built here; type-checked from Windows)

- Rust via rustup, and the Xcode command line tools (`xcode-select --install`): the linker, the Apple SDK with the frameworks Bevy links (Metal, AppKit, QuartzCore), and the C compiler `blake3`'s build script uses for its NEON code on Apple silicon.
- Rendering is Metal (wgpu's `metal` backend). No Homebrew packages are needed.
- Build natively on each: `cargo build --release --locked -p game -p headless` (`aarch64-apple-darwin` on Apple silicon, `x86_64-apple-darwin` on Intel), then `bash scripts/check.sh`. An Intel build from an Apple silicon Mac: `rustup target add x86_64-apple-darwin` and `cargo build --release --locked --target x86_64-apple-darwin -p game -p headless` (binaries in `target/x86_64-apple-darwin/release/`). A universal binary would need both and `lipo -create`; not set up for the MVP.
- The binary is unsigned and not in an app bundle; Gatekeeper may ask to allow it the first time (right-click, Open, or `xattr -d com.apple.quarantine` on a copied binary).

### What was checked from Windows (October 2026)

No Mac or Linux machine was available. The Rust std targets were added to the Windows toolchain (`rustup target add x86_64-unknown-linux-gnu aarch64-apple-darwin x86_64-apple-darwin`) and the workspace type-checked for each with `cargo check --workspace --all-targets --target <t> --locked` (rustc 1.97.1). A check compiles every crate and runs every build script but does not link, so it shows the code and the `cfg` paths are right for the target, not that a binary links or runs.

| Target | `sim`, `sim-data`, `headless`, `mapgen` | `game` (all targets: lib, bin, tests) |
|---|---|---|
| `x86_64-unknown-linux-gnu` | pass | stops at `wayland-sys`'s build script: pkg-config cannot probe `wayland-client` without a Linux sysroot (a Linux machine has it from `libwayland-dev`). With the `wayland` feature dropped in a scratch edit (not committed), the whole workspace, game included, checks clean |
| `x86_64-apple-darwin` | pass | pass (the whole workspace checks clean) |
| `aarch64-apple-darwin` | `sim-data` and `mapgen` pass; `sim` and `headless` stop at `blake3`'s build script, which needs a C compiler for its NEON code (`cc` not found; Xcode provides it on a Mac) | the same `blake3` stop. With `blake3`'s `no_neon` feature in a scratch edit (not committed), the whole workspace, game included, checks clean |

No code was platform-specific: the only `cfg(target_os)` is the UI config folder (`config::platform_config_dir`: `%APPDATA%`, `~/Library/Application Support`, `$XDG_CONFIG_HOME` or `~/.config`), data paths are built with `Path::join` from `CARGO_MANIFEST_DIR`, and nothing uses `std::os::windows` (D880).

Still needs a real machine, on each of Linux, macOS on Apple silicon and macOS on Intel (design fix 369): the release build and link; `headless --check-data`, `headless run --years 30 --seeds 1` (the spec 10 M10 budget is 2 minutes) and `headless soak`; `replay` of a log recorded on that machine; a game start (`game --bench-max 5`, which opens a window); and the gate (`bash scripts/check.sh`). Same-seed hashes across operating systems stay post-MVP (build-plan 4.3).

## Data

Both binaries load the starting world from `docs/design/data` in the repository they were built from: `sim_data::default_data_dir()` is fixed at compile time from the crate's location. Run them from a checkout (any working directory), or pass `--data-dir DIR` to `headless`. A self-contained release that carries its data beside the binary is post-MVP.

## Smoke test

The game has a release bench that runs the sim at max speed with the shell drawing, then exits and prints the date it reached (D14):

```
target/release/game --bench-max 5
```

It prints `BENCH sim: <ticks> ticks, <rate> game hours per second, reached <date>` after 5 seconds of measured frames (after a 120-frame warm-up). The M9 closing checks, the page timing harness (`game --bench-pages`) and the leak test, are in m9-checks.md. The headless smoke test is the data check and a short run:

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

macOS and Linux were not built or run: they were type-checked from Windows (above), and the steps above are what Bevy 0.20 and this workspace need there.
