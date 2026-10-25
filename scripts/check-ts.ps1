# The local gate for TypeScript PRs (CLAUDE.md; there is no CI): typecheck, Biome, the sim
# boundary scan, Vitest, then the design data checks. Uses pnpm via corepack.
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
Step 'validate'  {
    $data = (Resolve-Path docs/design/data).Path
    Push-Location docs/design/tools/mvp-data
    try { $out = python -B validate.py $data } finally { Pop-Location }
    $out | Select-String -Pattern '^(ERROR|OK$|[0-9]+ errors)' | ForEach-Object { $_.Line }
    if (-not ($out -contains 'OK')) { $global:LASTEXITCODE = 1 } else { $global:LASTEXITCODE = 0 }
}
Step 'check-data' { corepack pnpm@10.20.0 --filter @tc20ff/headless start --check-data }
Write-Host "`ncheck-ts: all steps passed"
