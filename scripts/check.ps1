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
