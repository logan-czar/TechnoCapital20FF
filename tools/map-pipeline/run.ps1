# Runs the province map pipeline (build-plan track P) end to end for one region file.
#   tools/map-pipeline/run.ps1                        # north-america, every step
#   tools/map-pipeline/run.ps1 -Region north-america -Steps crosswalk,shapes,simplify,mapgen,qa
# Needs uv and Node (npm) on PATH, and cargo for the mapgen step. See README.md.
param(
    [string]$Region = "north-america",
    [string]$Steps = ""
)
$ErrorActionPreference = "Stop"
Push-Location $PSScriptRoot
try {
    uv sync --frozen
    if ($LASTEXITCODE -ne 0) { throw "uv sync failed" }
    if (-not (Test-Path node_modules/mapshaper)) {
        npm ci
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
    }
    $runArgs = @("run", "python", "run.py", "--region", $Region)
    if ($Steps) { $runArgs += @("--steps", $Steps) }
    uv @runArgs
    if ($LASTEXITCODE -ne 0) { throw "pipeline failed" }
} finally {
    Pop-Location
}
