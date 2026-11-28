# Step 8 QA clean database check

## Run identity

- Timestamp: 2026-11-28 22:28:10 +07:00
- Branch: `qa/integration-seed-standardization`
- Commit checked: `ac9fb8d5f681d1231575acc13eecc0408644f852`
- Intended database: disposable `beefcare_qa` PostgreSQL on `127.0.0.1:15433`
- Intended backend: `127.0.0.1:8080`

## Runtime checks

Secret values were not printed. The check reported only whether each variable
was set.

| Check | Result |
| --- | --- |
| `BEEFCARE_DB_PASSWORD` | Unset |
| `BEEFCARE_DEV_PASSWORD` | Unset |
| `BEEFCARE_LINK_SECRET` | Unset |
| `BEEFCARE_DB_URL` / `BEEFCARE_DB_USERNAME` | Unset |
| `docker info` / `docker ps` | Blocked: permission denied opening `dockerDesktopLinuxEngine` |
| Listener on `15433` | Closed |
| Listener on `8080` | Closed |
| `.\scripts\qa-fixture-db.ps1 start` | Blocked before Docker: `Set BEEFCARE_DB_PASSWORD in this terminal first.` |
| `seed-qa-fixtures.py --isolated-qa-db` | Safely stopped before HTTP: `Set BEEFCARE_DEV_PASSWORD to the same local password used by the backend.` |

The isolated database and backend did not start. No HTTP, SQL or production
write was attempted.

## Offline checks

| Check | Result |
| --- | --- |
| Baseline manifest against canonical inventory | Passed: 447 rows, 445 mapped, unresolved `FE09-INT-16` and `FE09-INT-17` match |
| Scenario manifest against canonical inventory | Passed: 11 fixture groups and every case prefix is present |
| Normalized workbook readback | Passed: six sheets, 447 case rows, 11 scenario groups, reconciliation values 418 and 447 |
| `py_compile scripts/seed-qa-fixtures.py` | Passed |
| `python -m unittest scripts/tests/test_seed_qa_fixtures.py` | Blocked: the fake-backend test could not complete its loopback request and raised `WinError 10013`; it did not reach a clean idempotency assertion |

The offline checks confirm that the baseline, scenario contract and normalized
workbook are internally aligned. They do not prove that the API can create or
read data.

## Runtime result

**Blocked.** The clean QA database, backend, baseline seed, scenario seed,
API readback and second-run idempotency comparison remain unverified. The
previous runtime blocker is still present in this session.

## Safe rerun

1. Start Docker Desktop and confirm the Linux engine is accessible.
2. In a private PowerShell session, set the local values for
   `BEEFCARE_DB_PASSWORD`, `BEEFCARE_DEV_PASSWORD` and `BEEFCARE_LINK_SECRET`.
3. Run `scripts/qa-fixture-db.ps1 start` and confirm PostgreSQL listens on
   `15433`.
4. Start the backend against database `beefcare_qa` and confirm it listens on
   `8080`.
5. Run `scripts/seed-qa-fixtures.py --isolated-qa-db`.
6. Read back farms, pens, cattle and vouchers through the API, then run the
   same seed command again and compare stable-key counts and IDs.

No Google Docs tables or source workbooks were changed by this step.
