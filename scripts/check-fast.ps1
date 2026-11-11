# The fast per-change check: what a build agent runs after each change. It is NOT the gate; run
# scripts/check-ts.ps1 before a PR. It looks at what changed since the merge-base with main
# (committed, uncommitted and untracked) and runs only: install (if a lockfile or package.json
# changed), incremental tsc -b, Biome on the changed files, the sim boundary scan, Vitest for the
# projects the change can reach (without the *.slow.test.* files), and the data checks of a world
# whose data or generator changed. With no arguments it also runs the desktop app's end-to-end smoke
# suite (`pnpm e2e:smoke`: mock sim, under a minute) when apps/desktop or apps/web/src/os changed.
#
#   scripts/check-fast.ps1                     detect from git
#   scripts/check-fast.ps1 sim web             these Vitest projects (sim-data sim sim-host headless web desktop mapgen)
#   scripts/check-fast.ps1 packages/sim/test/rng.test.ts    these test files (slow ones included)
#   scripts/check-fast.ps1 all                 every project
#   scripts/check-fast.ps1 none                no tests
#   $env:CHECK_FAST_BASE = '<commit>'          compare with this commit instead of the merge-base
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$start = Get-Date

function Step($name, [scriptblock]$body) {
    Write-Host "`n== $name"
    & $body
    if ($LASTEXITCODE -ne 0) { Write-Host "check-fast: $name failed"; exit 1 }
}
function Skip($name, $why) { Write-Host "`n== $name (skipped: $why)" }

$AllProjects = @('sim-data', 'sim', 'sim-host', 'headless', 'web', 'desktop', 'mapgen')
$MaxBiomeFiles = 200 # past this the command line gets long; check the whole tree instead

# git writes "not a valid object name" to stderr when main is missing; that is not an error here.
$ErrorActionPreference = 'Continue'
$base = $env:CHECK_FAST_BASE
if (-not $base) { $base = git merge-base HEAD main 2>$null }
if (-not $base) { $base = git merge-base HEAD origin/main 2>$null }
$ErrorActionPreference = 'Stop'
if ($base) {
    $changed = @(@(git diff --name-only $base) + @(git ls-files --others --exclude-standard) |
        Where-Object { $_ } | Sort-Object -Unique)
} else {
    Write-Host 'check-fast: no merge-base with main; treating everything as changed'
    $changed = @('package.json')
}
function Has($pattern) { return [bool]($changed | Where-Object { $_ -match $pattern }) }

# Which Vitest projects a path can reach: a package and everything that depends on it
# (sim-data <- sim <- sim-host <- web, desktop; sim <- headless; mapgen stands alone). World data, map data and the soak
# fixtures are read by tests in every project; the root configs steer them all.
$projects = New-Object System.Collections.Generic.List[string]
function Add($names) { foreach ($p in $names) { if (-not $projects.Contains($p)) { $projects.Add($p) } } }
if (Has '^packages/sim-data/') { Add @('sim-data', 'sim', 'sim-host', 'headless', 'web', 'desktop') }
if (Has '^packages/sim/') { Add @('sim', 'sim-host', 'headless', 'web') }
if (Has '^packages/sim-host/') { Add @('sim-host', 'web', 'desktop') }
if (Has '^apps/headless/') { Add @('headless') }
if (Has '^apps/web/') { Add @('web') }
if (Has '^apps/desktop/') { Add @('desktop') }
if (Has '^apps/mapgen/') { Add @('mapgen') }
if (Has '^(assets/|docs/design/data/|test/fixtures/)') { Add $AllProjects }
if (Has '^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|vitest\.config\.ts|tsconfig[^/]*\.json)$') {
    Add $AllProjects
}

# Arguments override the detection: project names, test paths, `all` or `none`.
$paths = @()
if ($args.Count -gt 0) {
    $projects.Clear()
    foreach ($a in $args) {
        if ($a -eq 'all') { Add $AllProjects }
        elseif ($a -eq 'none') { }
        elseif ($AllProjects -contains $a) { Add @($a) }
        else { $paths += ($a -replace '\\', '/') }
    }
}
$projectArgs = @($projects | ForEach-Object { '--project'; $_ })

if (-not (Test-Path node_modules) -or (Has '(^|/)package\.json$|^pnpm-lock\.yaml$|^pnpm-workspace\.yaml$')) {
    Step 'install' { corepack pnpm@10.20.0 install --frozen-lockfile --silent }
} else {
    Skip 'install' 'no lockfile or package.json change'
}

Step 'typecheck' { corepack pnpm@10.20.0 exec tsc -b }

$biomeFiles = @($changed | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf })
if ((Has '^biome\.json$') -or $biomeFiles.Count -gt $MaxBiomeFiles) {
    Step 'biome' { corepack pnpm@10.20.0 exec biome check . }
} elseif ($biomeFiles.Count -gt 0) {
    Step "biome ($($biomeFiles.Count) changed files)" {
        corepack pnpm@10.20.0 exec biome check --no-errors-on-unmatched @biomeFiles
    }
} else {
    Skip 'biome' 'no changed files'
}

Step 'boundary' { node scripts/ts/boundary.ts }

if ($paths.Count -gt 0) {
    # Named test files run as given, slow or not.
    Step "test ($($paths -join ' '))" { corepack pnpm@10.20.0 exec vitest run @projectArgs @paths }
} elseif ($projects.Count -gt 0) {
    Step "test ($($projects -join ' '), no slow files)" {
        # Each project's vitest.config.ts reads this (a --exclude flag loses to a project's own exclude).
        $env:CHECK_FAST_SKIP_SLOW = '1'
        try { corepack pnpm@10.20.0 exec vitest run @projectArgs } finally { Remove-Item Env:CHECK_FAST_SKIP_SLOW }
    }
} else {
    Skip 'test' 'no project touched'
}

if ($args.Count -eq 0 -and (Has '^(apps/desktop/|apps/web/src/os/)')) {
    Step 'e2e smoke' { corepack pnpm@10.20.0 e2e:smoke }
} else {
    Skip 'e2e smoke' 'arguments given, or apps/desktop and apps/web/src/os unchanged'
}

if (Has '^docs/design/(data|tools/mvp-data)/') {
    Step 'validate' {
        $data = (Resolve-Path docs/design/data).Path
        Push-Location docs/design/tools/mvp-data
        try { $out = python -B validate.py $data } finally { Pop-Location }
        $out | Select-String -Pattern '^(ERROR|OK$|[0-9]+ errors)' | ForEach-Object { $_.Line }
        if (-not ($out -contains 'OK')) { $global:LASTEXITCODE = 1 } else { $global:LASTEXITCODE = 0 }
    }
    Step 'check-data' { corepack pnpm@10.20.0 --filter @tc20ff/headless start --check-data --world 2020 }
} else {
    Skip 'validate' '2020 world data unchanged'
}
if (Has '^(assets/worlds/|tools/world-1995/)') {
    Step 'validate-1995' {
        $out = python -B tools/world-1995/validate.py
        $out | Select-String -Pattern '^(ERROR|OK$|[0-9]+ errors)' | ForEach-Object { $_.Line }
        if (-not ($out -contains 'OK')) { $global:LASTEXITCODE = 1 } else { $global:LASTEXITCODE = 0 }
    }
    Step 'check-data-1995' { corepack pnpm@10.20.0 --filter @tc20ff/headless start --check-data --world 1995 }
} else {
    Skip 'validate-1995' 'assets/worlds and tools/world-1995 unchanged'
}

$secs = [int]((Get-Date) - $start).TotalSeconds
Write-Host "`ncheck-fast: all steps passed in $secs s (not the gate: run scripts/check-ts.ps1 before a PR)"
