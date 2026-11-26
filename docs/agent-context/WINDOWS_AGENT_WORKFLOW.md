# Windows agent workflow for BeefCare

## Start a session

From PowerShell 7, verify process creation inside Codex before assigning work. Use the project Node version in [Local Setup](../LOCAL_SETUP.md) for frontend builds and tests.

```powershell
codex features list | Select-String '^prefer_mxc'
codex sandbox -c 'sandbox_mode="read-only"' -- node --version
codex sandbox -c 'sandbox_mode="read-only"' -- git rev-parse --short HEAD
```

On the Windows machine where Codex returned `app runtime provisioning service is unavailable` before even starting Node, preferring the native MXC sandbox restored shell execution and file edits. The app package tools had reported `0x80073D3C` for the older runtime registration. If the CLI exposes `prefer_mxc` and device policy permits it, try `codex sandbox --enable prefer_mxc -c 'sandbox_mode="read-only"' -- node --version`. After success, run `codex features enable prefer_mxc` once for that Windows account and start new agent sessions. Keep the existing permission profile. Verify again from a real agent run, including a write and read of a disposable file.

9Router and Agent Follow are separate local services. The current setup uses loopback port `20128` for 9Router and `20129` for Agent Follow. After a Windows sign-in, check the model list and dashboard health before retrying failed turns.

```powershell
(Invoke-WebRequest http://127.0.0.1:20128/v1/models -TimeoutSec 5).StatusCode
(Invoke-WebRequest http://127.0.0.1:20129/health -TimeoutSec 5).StatusCode
```

If 9Router is down on this setup, run the installed `9router --host 127.0.0.1 --port 20128 --no-browser` in a separate terminal. Start Agent Follow with its local launcher. Use its `dispatch.ps1` to label BeefCare work. Assign implementation to `cx/gpt-6-luna` at `xhigh` and review to `cx/gpt-5.6-terra` at `high` when using this 9Router workflow. Independent read-only reviews can run alongside implementation. Follow the worktree and ownership rules in [AGENTS.md](../../AGENTS.md) for concurrent writers.

## Use the existing GitNexus index

Compare `lastCommit` in `.gitnexus/meta.json` with `git rev-parse HEAD`. In PowerShell, use `ConvertFrom-Json -AsHashtable` because the metadata can contain keys that differ only by case. With an installed GitNexus CLI, reuse the current index for `impact` and check static imports or route references when the graph returns `UNKNOWN`.

When LadybugDB fails to open an existing index under a path containing Vietnamese characters, check whether Windows already provides an ASCII short path to that same `.gitnexus` folder. From the repository root, the following updates only the current repo registration and keeps the existing database.

```powershell
$repo = (Get-Location).Path
$indexPath = Join-Path $repo '.gitnexus'
$shortIndex = (New-Object -ComObject Scripting.FileSystemObject).GetFolder($indexPath).ShortPath
if ($shortIndex -match '[^\x00-\x7f]' -or -not (Test-Path -LiteralPath (Join-Path $shortIndex 'lbug'))) {
    throw 'The existing index has no usable ASCII short path.'
}
$previousStorage = $env:GITNEXUS_STORAGE_PATH
try {
    $env:GITNEXUS_STORAGE_PATH = $shortIndex
    node .gitnexus/run.cjs index $repo
    if ($LASTEXITCODE -ne 0) { throw 'GitNexus index registration failed.' }
} finally {
    $env:GITNEXUS_STORAGE_PATH = $previousStorage
}
node .gitnexus/run.cjs impact RemindersPage --direction upstream --repo $repo
```

If the repo runner cannot see the installed CLI inside MXC, use the verified local CLI path recorded in `.gitnexus/meta.json` when it exists. MXC can redirect `LOCALAPPDATA`. The Agent Follow verifier also checks the Windows user's actual npm cache. In custom PowerShell helpers, use `git rev-parse --show-cdup` and combine it with the filesystem path to avoid decoding Git's absolute path with the Windows console code page.

## Verify frontend changes

From `frontend/`, run the focused files with the installed Vitest and TypeScript. Check each exit code.

```powershell
node node_modules/vitest/vitest.mjs run --no-file-parallelism tests/unit/feed-stock/FeedReceiptPage.test.tsx
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
```

Use `--no-file-parallelism` within focused runs while agents are working in parallel. A lazy route timed out when multiple test files ran together. The same three files passed all 31 cases when run in sequence. Record a provisioning error as a process-start failure and a Vitest assertion or timeout as a test result.
