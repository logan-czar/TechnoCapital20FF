# The local gate run before every PR (there is no CI; CLAUDE.md). Runs fmt, clippy, tests, the
# Python data validator and the Rust data check, and stops at the first failure.
#
#   scripts/check.ps1            full workspace (compiles Bevy for the game crate)
#   scripts/check.ps1 -SimOnly   sim, sim-data and headless only (no Bevy compile)
param([switch]$SimOnly)

# Native tools report failure through $LASTEXITCODE; 'Stop' would turn cargo's stderr progress into errors.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# [string[]] keeps a one-item list an array; a bare string would splat as single characters.
[string[]]$pkgs = if ($SimOnly) { @('-p', 'sim', '-p', 'sim-data', '-p', 'headless') } else { @('--workspace') }
# The binaries that use sim, checked without test targets: sim's tests enable its `test-hooks`
# feature (raw world access), and a workspace build with tests unifies it into every crate. Each
# is checked in its own cargo run: together, cargo would unify headless's `soak-stats` feature
# into the game's sim too (D438).
[string[]]$bins = if ($SimOnly) { @('headless') } else { @('headless', 'game') }

function Step([string]$name, [scriptblock]$cmd) {
    Write-Host "== $name"
    & $cmd
    if ($LASTEXITCODE -ne 0) {
        Write-Host "== FAILED: $name"
        exit 1
    }
}

Step 'fmt' { cargo fmt --all --check }
Step 'clippy' { cargo clippy @pkgs --all-targets -- -D warnings }
# The spec 9 boundary: the binaries must build without sim's test-only API.
Step 'boundary' {
    foreach ($bin in $bins) {
        [string[]]$one = @('-p', $bin)
        cargo check @one
        if ($LASTEXITCODE -ne 0) { return }
    }
}
Step 'test' { cargo test @pkgs }
Step 'validate.py' {
    Push-Location docs/design/tools/mvp-data
    $out = python -B validate.py (Join-Path $root 'docs/design/data')
    Pop-Location
    $out | Select-String -Pattern '^(ERROR|OK$|[0-9]+ errors)'
    if (-not ($out -contains 'OK')) { $global:LASTEXITCODE = 1 } else { $global:LASTEXITCODE = 0 }
}
Step 'check-data' { cargo run --quiet -p headless -- --check-data }
Write-Host '== all checks passed'
