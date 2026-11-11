# Runs a command while holding the machine-wide lock for heavy work (a whole Vitest project, a sim
# run of more than a few seconds, anything that launches the real sim), so only one such job runs
# at a time however many agents and worktrees there are.
#
#   scripts/heavy.ps1 <command> [args...]
#   scripts/heavy.ps1 corepack pnpm@10.20.0 e2e
#
# The lock is a directory, made with cmd's mkdir (which either makes it or fails, never both for
# two callers): .claude/scratch/heavy.lock under the MAIN repository's root, whichever worktree
# this is run from. Its `owner` file says who holds it. While it is held this waits and says so. It
# is removed when the command ends, however it ends (failure, Ctrl+C). A lock nobody has touched
# for two hours is taken to be left over from a crash and is removed with a warning; this script
# touches its own lock every minute, so a long job is not mistaken for one.
#
#   $env:HEAVY_LOCK_DIR             the lock directory (default: as above)
#   $env:HEAVY_LOCK_STALE_SECONDS   age at which a lock is stale (default 7200)
#   $env:HEAVY_LOCK_POLL_SECONDS    how often a waiter looks again (default 15)
#   $env:HEAVY_LOCK_TIMEOUT_SECONDS give up waiting after this long, exit 75 (default 0: never)
#   $env:HEAVY_LOCK_HELD = '1'      set for the command; under it a nested heavy.ps1 just runs its command
#
# The exit code is the command's. scripts/heavy.sh is the same thing for bash.
#
# When this script's output is redirected (`*>`, `2>&1`), Windows PowerShell 5.1 writes each line
# the command sent to stderr as a NativeCommandError record. Those are the command's own lines, not
# failures of this script; the exit code says how the command ended.
$ErrorActionPreference = 'Stop'

if ($args.Count -eq 0) {
    [Console]::Error.WriteLine('usage: scripts/heavy.ps1 <command> [args...]')
    exit 2
}
$command = $args[0]
$rest = @($args | Select-Object -Skip 1)

# Runs the command with its output going where this script's goes, and leaves its exit code in $code.
$run = {
    # A native command's stderr must not become a terminating error here.
    $ErrorActionPreference = 'Continue'
    $global:LASTEXITCODE = $null
    & $command @rest
    $ok = $?
    if ($null -ne $LASTEXITCODE) { $script:code = $LASTEXITCODE } elseif ($ok) { $script:code = 0 } else { $script:code = 1 }
}
$code = 1

# Already inside a heavy run (this script's own child): the lock is ours, do not wait for ourselves.
if ($env:HEAVY_LOCK_HELD -eq '1') { . $run; exit $code }

function Note($text) { [Console]::Error.WriteLine("heavy: $text") }
function Setting($name, $default) {
    $v = [Environment]::GetEnvironmentVariable($name)
    if ($v -match '^\d+$') { return [int]$v } else { return $default }
}

$lock = $env:HEAVY_LOCK_DIR
if (-not $lock) {
    # The main repository's .git, even from a worktree; its parent is the main root.
    $ErrorActionPreference = 'Continue'
    $common = git -C $PSScriptRoot rev-parse --path-format=absolute --git-common-dir 2>$null
    $ErrorActionPreference = 'Stop'
    if (-not $common) { Note 'not in a git repository; set HEAVY_LOCK_DIR'; exit 2 }
    $lock = Join-Path (Split-Path -Parent $common) '.claude/scratch/heavy.lock'
}
$lock = [System.IO.Path]::GetFullPath($lock)
$stale = Setting 'HEAVY_LOCK_STALE_SECONDS' 7200
$poll = Setting 'HEAVY_LOCK_POLL_SECONDS' 15
$limit = Setting 'HEAVY_LOCK_TIMEOUT_SECONDS' 0
$token = "$PID-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())-$(Get-Random)"
$owner = Join-Path $lock 'owner'

[void][System.IO.Directory]::CreateDirectory((Split-Path -Parent $lock))

# cmd's mkdir is the Win32 CreateDirectory: it fails when the directory is there. (New-Item and
# .NET's CreateDirectory look first and then make it, which two callers can both get through.)
function Take-Lock {
    cmd /c "mkdir `"$lock`" 2>nul"
    return $LASTEXITCODE -eq 0
}
function Owner-Lines {
    try { return @(Get-Content -LiteralPath $owner -ErrorAction Stop) } catch { return @() }
}
function Lock-Age {
    try { return [int]((Get-Date) - (Get-Item -LiteralPath $lock -ErrorAction Stop).LastWriteTime).TotalSeconds }
    catch { return 0 }
}

$held = $false
$beat = $null
try {
    $waited = 0
    $said = $false
    while (-not (Take-Lock)) {
        $age = Lock-Age
        if ($age -ge $stale) {
            $was = (Owner-Lines) -join ' '
            if (-not $was) { $was = 'no owner file' }
            Note "WARNING: the lock $lock is $age s old (stale after $stale s); removing it. It held: $was"
            # Renamed away first, so of two waiters that both see it stale only one removes it.
            $gone = "$lock.stale.$token"
            try {
                [System.IO.Directory]::Move($lock, $gone)
                Remove-Item -LiteralPath $gone -Recurse -Force
            } catch { }
            continue
        }
        if ($limit -gt 0 -and $waited -ge $limit) {
            Note "gave up after $waited s waiting for $lock"
            exit 75
        }
        # Said when the wait starts and then once a minute.
        if (-not $said -or [math]::Floor($waited / 60) -gt [math]::Floor(($waited - $poll) / 60)) {
            $who = (Owner-Lines | Select-Object -Skip 1 -First 3) -join ' '
            Note "waiting for the machine lock $lock (held $age s by: $who; waited $waited s)"
            $said = $true
        }
        Start-Sleep -Seconds $poll
        $waited += $poll
    }
    $held = $true
    $since = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Set-Content -LiteralPath $owner -Encoding ascii -Value @(
        $token, "pid $PID on $env:COMPUTERNAME", "since $since", "$command $($rest -join ' ')")
    if ($said) { Note "got the lock after $waited s" }

    # Keeps the lock fresh while the command runs; stops by itself if this script is killed outright.
    $beat = Start-Job -ArgumentList $lock, $owner, $token, $PID -ScriptBlock {
        param($lock, $owner, $token, $parent)
        while ($true) {
            Start-Sleep -Seconds 60
            if (-not (Get-Process -Id $parent -ErrorAction SilentlyContinue)) { return }
            $first = Get-Content -LiteralPath $owner -TotalCount 1 -ErrorAction SilentlyContinue
            if ($first -ne $token) { return }
            try { (Get-Item -LiteralPath $lock).LastWriteTime = Get-Date } catch { }
        }
    }

    $env:HEAVY_LOCK_HELD = '1'
    . $run
} finally {
    Remove-Item Env:HEAVY_LOCK_HELD -ErrorAction SilentlyContinue
    if ($beat) { Stop-Job $beat -ErrorAction SilentlyContinue; Remove-Job $beat -Force -ErrorAction SilentlyContinue }
    # Only our own lock: if it was taken from us as stale, the directory there now is someone else's.
    if ($held -and (Owner-Lines | Select-Object -First 1) -eq $token) {
        Remove-Item -LiteralPath $lock -Recurse -Force -ErrorAction SilentlyContinue
    }
}
exit $code
