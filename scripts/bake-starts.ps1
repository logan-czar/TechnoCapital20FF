# Bakes the pre-simulated 2020 starts that ship with the game (pivot 3.5; D1035) into
# assets/starts/: one save per seed and index.json. The saves are tens of MB each and git-ignored;
# only this script and index.template.json are checked in. Re-run it after any change that moves
# the state hash or SAVE_VERSION (pivot 16.2 "re-baked starts").
#
#   scripts/bake-starts.ps1 [-Out assets/starts] [-Seeds 1,2,3]
#
# One seed at a time: each bake takes about a minute and 1.5 to 2 GB.
param(
    [string]$Out = '',
    [int[]]$Seeds = @(1, 2, 3)
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $Out) { $Out = Join-Path $root 'assets/starts' }
$Out = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Out)
New-Item -ItemType Directory -Force $Out | Out-Null
$index = Join-Path $Out 'index.json'
if (-not (Test-Path $index)) { Copy-Item (Join-Path $root 'assets/starts/index.template.json') $index }
Push-Location (Join-Path $root 'apps/headless')
try {
    foreach ($s in $Seeds) {
        corepack pnpm@10.20.0 exec tsx src/main.ts bake --seed $s --out $Out
        if ($LASTEXITCODE -ne 0) { Write-Host "bake-starts: seed $s failed"; exit 1 }
    }
} finally {
    Pop-Location
}
