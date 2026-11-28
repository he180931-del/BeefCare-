# System Test package

This package defines six cross-feature flows for the first System Test pass.
Each flow starts from the shared QA baseline, adds only the scenario fixtures
it needs and records readback before the next mutation. The machine-readable
source is `seed/system-test-manifest.json`.

## Source and scope

The package uses the normalized workbook and the Integration handoff package
for case selection. It uses the baseline manifest for inherited farm data and
the scenario manifest for feature-owned records. The official report total is
418 Integration cases. The technical inventory remains 447 canonical rows
with 445 mapped rows and two unresolved FE-09 cases.

## Execution order

| Order | Flow | Cross-feature path | Reset boundary |
| --- | --- | --- | --- |
| 1 | ST-01 | Account → farm → herd → dashboard | Reset after identity and farm state |
| 2 | ST-02 | Care and growth → exit → reports | Reset after cattle status and pen history change |
| 3 | ST-03 | Estrus → breeding → pregnancy → calving → reminders | Reset after date-sensitive reproduction state |
| 4 | ST-04 | Feed receipt → ration → feeding → reminders → reports | Reset after stock and feeding mutations |
| 5 | ST-05 | Role change → announcement → notification → audit/support access | Reset after membership and notification state |
| 6 | ST-06 | Payment evidence → service state → cash and management reports | Reset after payment and subscription state |

Run every flow from a clean disposable QA database when it changes shared
cattle, pen, voucher, role, payment or reminder state. Keep the backend pointed
at `beefcare_qa` on port `15433` and the API at `127.0.0.1:8080`.

## Setup and run sequence

1. Start Docker Desktop's Linux engine and set the local private values for
   `BEEFCARE_DB_PASSWORD`, `BEEFCARE_DEV_PASSWORD` and
   `BEEFCARE_LINK_SECRET`.
2. Run `scripts/qa-fixture-db.ps1 start` from the repository root.
3. Start the backend with the QA JDBC URL and `dev,local` profiles.
4. Run `scripts/seed-qa-fixtures.py --isolated-qa-db`.
5. Read back farms, memberships, pens, cattle and vouchers and record stable
   keys, IDs, status, version and farm ownership.
6. Run the selected scenario groups from the System Test manifest. Use
   `scenario-<fixture_id>-*` idempotency keys for scenario writes.
7. Capture the expected readback in the flow row before continuing.
8. Reset the disposable database between flows when the reset boundary says
   the prior state cannot be reused.

The existing helper `scripts/tools/beefcare-local-demo-seed-v1.ps1` provides the
offline design for the FE-07, FE-14, FE-15 and FE-23 portions. Its `-Apply`
mode requires the running loopback backend and private local password.

## Readback contract

Every flow records the following fields for each mutation: stable business key,
server ID, farm ID, status, version, actor role, effective date and any derived
reminder or report row. A second seed or fixture run must reuse the same IDs and
must not create a duplicate record. The UI result is linked to the normalized
case ID and source workbook row.

The source mapping is preserved through the `source_case_prefixes` and
`fixture_dependencies` fields in `seed/system-test-manifest.json`. The unresolved
FE-09 cases are excluded from a claimed pass until their UC mapping is
confirmed.

## Current blocker

The latest QA check could not start Docker or the backend. Docker access to
`dockerDesktopLinuxEngine` returned permission denied, ports `15433` and `8080`
were closed and the required private variables were unset. The package is
therefore a prepared System Test plan with runtime status blocked. No API, SQL
or production write was attempted while preparing it.

No Google Docs tables or source workbooks are changed by this package.
