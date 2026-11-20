# The local gate for TypeScript PRs (CLAUDE.md; there is no CI): typecheck, Biome, the sim
# boundary scan, Vitest, then the data checks. Uses pnpm via corepack.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

function Step($name, [scriptblock]$body) {
    Write-Host "`n== $name"
    & $body
    if ($LASTEXITCODE -ne 0) { Write-Host "check-ts: $name failed"; exit 1 }
}

Step 'install'   { corepack pnpm@10.20.0 install --frozen-lockfile --silent }
Step 'typecheck' { corepack pnpm@10.20.0 exec tsc -b }
Step 'biome'     { corepack pnpm@10.20.0 exec biome check . }
Step 'boundary'  { node scripts/ts/boundary.ts }
Step 'test'      { corepack pnpm@10.20.0 exec vitest run }
# The frozen test world loads and passes the load-time checks (D1055).
Step 'check-data-mini' {
    $mini = (Resolve-Path packages/sim/test/fixtures/world-mini).Path
    corepack pnpm@10.20.0 --filter @tc20ff/headless start --check-data --data-dir $mini
}
Step 'validate-1995' {
    $out = python -B tools/world-1995/validate.py
    $out | Select-String -Pattern '^(ERROR|OK$|[0-9]+ errors)' | ForEach-Object { $_.Line }
    if (-not ($out -contains 'OK')) { $global:LASTEXITCODE = 1 } else { $global:LASTEXITCODE = 0 }
}
Step 'check-data-1995' { corepack pnpm@10.20.0 --filter @tc20ff/headless start --check-data --world 1995 }
Write-Host "`ncheck-ts: all steps passed"
