# QA runtime seed check

## Run identity

- Timestamp: 2026-11-28 21:02:40 +07:00
- Branch: `qa/integration-seed-standardization`
- Commit checked: `a106eb13b6981a20a03d2f814e548fad7f267e6a`
- Intended database: disposable `beefcare_qa` PostgreSQL on `127.0.0.1:15433`
- Intended backend: `127.0.0.1:8080`

## Commands and results

The repository guidance was read from `docs/testing/QA_FIXTURES.md` and
`docs/testing/BASELINE_SEED.md`. The working tree contained the two existing
untracked Tài workbooks; they were not staged or deleted.

| Check | Result |
| --- | --- |
| `java -version` | Passed: Microsoft OpenJDK 21.0.12.1 |
| `backend\\mvnw.cmd --batch-mode -version` | Passed: Maven 3.9.16 |
| `docker info` / `docker version --format ...` | Blocked: Docker client could not connect to `//./pipe/dockerDesktopLinuxEngine`; the daemon is not running. |
| `.\scripts\qa-fixture-db.ps1 start` | Blocked before Docker: `Set BEEFCARE_DB_PASSWORD in this terminal first.` |
| Listener check for ports 15433 and 8080 | No listeners found. |
| `C:\Users\PC ASUS\AppData\Local\Python\bin\python.exe -m py_compile scripts/seed-qa-fixtures.py` | Passed: exit code 0. |
| `...python.exe scripts/seed-qa-fixtures.py --isolated-qa-db` | Safely stopped before HTTP: `Set BEEFCARE_DEV_PASSWORD to the same local password used by the backend.` |
| Manifest validation (`ConvertFrom-Json`) | Passed: `qa-baseline-v2`, 447 source cases, 11 entities. |
| `git diff --check` | Passed: exit code 0. |

The documented backend command was also attempted without inventing
credentials:

```powershell
cd backend
.\mvnw.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' `
  '-Djacoco.skip=true' '-Dspring-boot.run.profiles=dev,local' spring-boot:run
```

Maven compiled the main and test sources, then failed after about two minutes
with:

```text
Error: Could not find or load main class vn.edu.fpt.beefcare.BeefcareApp
Caused by: java.lang.ClassNotFoundException: vn.edu.fpt.beefcare.BeefcareApp
BUILD FAILURE
```

This is the known `spring-boot:run` main-class/path failure for this checkout's
Vietnamese path. It is not evidence that the backend reached PostgreSQL.

## Runtime result

**Blocked.** The isolated QA database and backend could not be started, so the
seeder was not allowed to make API requests. No SQL writes, production writes,
or API fixture writes were performed in this check.

Because the backend never became healthy, the required readback of farms,
pens, cattle, and vouchers was not run. The second seed run and idempotency
comparison were also not run; their status is **not assessed**, rather than
passing by assumption.

## Remediation and rerun

1. Start Docker Desktop and wait for the Linux engine to become available.
2. In a private PowerShell session, set the team's local values for
   `BEEFCARE_DB_PASSWORD`, `BEEFCARE_DEV_PASSWORD` (at least 12 characters),
   and `BEEFCARE_LINK_SECRET` (at least 32 characters). Do not put values in
   this document or Git.
3. From the repository root, start only the disposable QA database:

   ```powershell
   .\scripts\qa-fixture-db.ps1 start
   $env:BEEFCARE_DB_URL='jdbc:postgresql://localhost:15433/beefcare_qa'
   $env:BEEFCARE_DB_USERNAME='beefcare_qa'
   ```

4. If `spring-boot:run` repeats the path failure, follow the repository's
   documented workaround: build/run the jar from a path without Vietnamese
   characters, while passing the QA JDBC URL and the same local secrets as
   environment variables. Confirm the log names database `beefcare_qa` before
   continuing.
5. In a second PowerShell session, use the direct Python 3.14 binary (or fix
   the Windows Python launcher) and run:

   ```powershell
   $env:BEEFCARE_DEV_PASSWORD='<local value>'
   & 'C:\Users\PC ASUS\AppData\Local\Python\bin\python.exe' `
     .\scripts\seed-qa-fixtures.py --isolated-qa-db
   ```

6. Read back farms, pens, cattle, and vouchers through the API/FE, then rerun
   the same seeder and compare stable-key counts. Record both runs and the
   actual readback counts in a follow-up evidence revision.
