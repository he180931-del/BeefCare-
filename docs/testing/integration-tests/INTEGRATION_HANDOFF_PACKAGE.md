# Integration handoff package

This package gives each member the same source inventory, normalized workbook,
baseline seed contract and scenario fixture rules. The source workbooks remain
the evidence for the original procedures. The normalized workbook is the
working view for execution and review.

## Package contents

| Item | Location | Use |
| --- | --- | --- |
| Normalized workbook | `docs/testing/integration-tests/BeefCare_Integration_Normalized_v1.xlsx` | Filter cases by owner, feature, status, UC mapping and fixture fields |
| Canonical inventory | `docs/testing/integration-tests/integration-test-master.csv` | Trace each normalized row to its source sheet and row |
| Scope review | `docs/testing/integration-tests/scope-review.md` | Confirm source coverage and review findings |
| Baseline manifest | `seed/baseline-manifest.json` | Define reusable Farm A baseline data |
| Baseline seeder | `scripts/seed-qa-fixtures.py` | Create baseline data through the API |
| Scenario manifest | `seed/scenario-fixture-manifest.json` | Define feature-owned data and mutations |
| Scenario runbook | `docs/testing/SCENARIO_FIXTURES.md` | Apply reset and idempotency rules |
| Runtime evidence | `docs/testing/integration-tests/step-8-qa-clean-db-check.md` | Record the latest blocker and offline checks |

The report-level Integration total remains 418. The normalized technical
inventory contains 447 rows, with 445 mapped UC rows and unresolved
`FE09-INT-16` and `FE09-INT-17`. Do not replace the report total with the
technical inventory count before the revision review is complete.

## Scope assignment

| Member or scope | Features | Cases | Current status |
| --- | --- | ---: | --- |
| Lam | FE-01, FE-20, FE-21, FE-22 | 106 | Passed 92, Failed 9, N/A 5 |
| Tai | FE-07, FE-14, FE-15, FE-23 | 70 | Pending 70 |
| Team | FE-02, FE-03, FE-17, FE-19 | 86 | Pending 86 |
| Team | FE-04, FE-05, FE-06, FE-13, FE-16, FE-18 | 115 | Round 1 status unreported in inspected fields |
| Team | FE-08, FE-09, FE-10, FE-11, FE-12 | 70 detectable IDs | Test Statistics declares 72 and needs owner confirmation |

## Required setup

Use a disposable QA database named `beefcare_qa` on port `15433` and a
backend on `http://127.0.0.1:8080`. Install JDK 21, Docker Desktop with its
Linux engine and Python 3. Keep `BEEFCARE_DB_PASSWORD`,
`BEEFCARE_DEV_PASSWORD` and `BEEFCARE_LINK_SECRET` in a private PowerShell
session. Do not add them to files or commits.

From the repository root, start the isolated database:

```powershell
.\scripts\qa-fixture-db.ps1 start
$env:BEEFCARE_DB_URL='jdbc:postgresql://localhost:15433/beefcare_qa'
$env:BEEFCARE_DB_USERNAME='beefcare_qa'
```

Start the backend in a separate terminal:

```powershell
cd backend
.\mvnw.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' `
  '-Djacoco.skip=true' '-Dspring-boot.run.profiles=dev,local' spring-boot:run
```

Confirm the backend log names `beefcare_qa` and port `15433` before seeding.

## Execution order

1. Open the normalized workbook and select the member's feature rows.
2. Run the baseline seed once.
3. Read back farms, memberships, pens, cattle and vouchers through the API.
4. Run only the scenario fixture groups needed by the selected cases. The
   existing helper covers the offline design for FE-07, FE-14, FE-15 and FE-23.
5. Use the scenario prefix `scenario-<fixture_id>-*` for every scenario write.
6. Verify farm ownership, status, version and stable business key before the
   UI case starts.
7. Run the selected Integration cases and record results against the
   normalized case ID.
8. Run the same baseline command again and compare stable-key counts and IDs.

## Reset and idempotency

Stop the backend before resetting the database:

```powershell
.\scripts\qa-fixture-db.ps1 reset
```

The reset command deletes only the disposable `beefcare-qa-fixtures` Compose
volume. It must not be used while a run still needs its data. Baseline writes
use the `baseline-*` namespace. Scenario writes use their own fixture prefix.
If a matching sentinel exists with different business values, stop and review
the conflict instead of creating a second record.

## Current blocker

The latest check could not start Docker or the QA backend. Docker access to
`dockerDesktopLinuxEngine` returned permission denied, ports `15433` and `8080`
were closed and the required private variables were unset. Baseline/API
readback and the second-run idempotency comparison are therefore pending.
The package is ready for a rerun after the runtime prerequisites are restored.

No Google Docs tables or source workbooks are changed by this handoff package.
