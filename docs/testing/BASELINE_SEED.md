# QA baseline seed

`scripts/seed-qa-fixtures.py` builds the shared source data needed by the
integration-test inventory. It runs only against the isolated QA database and
uses the real HTTP API. The inventory is
[`integration-test-master.csv`](integration-tests/integration-test-master.csv)
(447 rows, 445 mapped rows and unresolved `FE09-INT-16`/`FE09-INT-17`). The
machine-readable contract is [`seed/baseline-manifest.json`](../../seed/baseline-manifest.json).

Run it after the QA backend is started as described in
[`QA_FIXTURES.md`](QA_FIXTURES.md):

```powershell
$env:BEEFCARE_DEV_PASSWORD = '<local value>'
python .\scripts\seed-qa-fixtures.py --isolated-qa-db
```

The repository check for this change runs Python syntax compilation and
manifest validation. The dedicated QA backend was not running in this
workspace, so no API writes were attempted here; use the command above for
the isolated-DB readback required before integration execution.

The baseline is deliberately wider than the former two-pen fixture. It keeps
the local profile's three farms, owner/manager/technician/support actors and
catalogue as inherited data, then adds six pens (including breeding, sire,
calf and inactive quarantine states), ten cattle across sex, purpose and life
stage, three feed items, two suppliers and one posted feed receipt with an
outstanding balance. Keys such as `QA-BL-F-BREED`, `TA-90` and `QA baseline
stock` are stable and are never production identifiers.

The script does not create records whose creation is the assertion under test.
Health cases, observations, treatments, growth corrections, exits, estrus,
breeding, pregnancy checks, calving outcomes, announcement publication and
voucher/feed payments remain scenario-owned. This prevents a shared seed from
making a create or validation test pass for the wrong reason. The script
records these intentional gaps in its sanitized output and in the manifest;
it never falls back to SQL when an API route is unavailable.

Read-back of farm memberships, notifications and feed reminders is included
to show what the current environment provides, but derived reminder and
notification rows are not assigned fixed IDs. Platform-only farm states and
the two unresolved FE-09 inventory rows remain explicit gaps until a supported
fixture layer exists.

Reset the dedicated QA database before destructive scenario cleanup. Do not
run this command against the shared local or production database, and do not
stage the two Integration workbook files in `docs/testing/`.
