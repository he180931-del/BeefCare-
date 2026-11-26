# Local demo seed v1

Run this after the normal `dev,local` backend is ready. It uses the supported
HTTP APIs and session authentication; it never writes PostgreSQL directly.

## Prerequisites

- PostgreSQL/Mailpit are up and the backend is running at `http://127.0.0.1:8080`.
- The local seeded owner account exists (`owner@beefcare.local`) and the
  password is the value of `BEEFCARE_DEV_PASSWORD` from the teammate's local
  `.env` (the password is not stored in this repository).
- PowerShell 5.1+ (or `pwsh`) and the repository root as the working directory.

## Run

The default is a read-only preflight/dry run. It discovers the owner farm by
name and never assumes a numeric farm ID:

```powershell
$env:BEEFCARE_DEV_PASSWORD = '<your local value>'
pwsh -NoProfile -File scripts/tools/beefcare-local-demo-seed-v1.ps1
```

To write the fixtures, review the dry-run output first and then run:

```powershell
pwsh -NoProfile -File scripts/tools/beefcare-local-demo-seed-v1.ps1 -Apply
```

`-BaseUrl http://localhost:8080`, `-FarmName 'BeefCare Local Farm A'`, or
`-FarmId <id>` may be supplied. `-FarmId` is checked against the authenticated
account and is not required. If the environment variable is omitted, the
script asks for the password with a hidden prompt.

## Seeded/read-back scenarios

- **FE-07:** one deterministic draft, publication, correction/history version,
  active technician recipient delivery, and one read acknowledgement.
- **FE-14:** a breeding-window source from a deterministic estrus event when a
  suitable female exists, plus a separate REM-10 low-stock source from an
  out-of-stock feed item.
- **FE-15:** the farm dashboard and an `RPT-01` management report are read back
  from the real source tables; the script reports returned rows and
  `unavailableData` without inventing totals.
- **FE-23:** deterministic supplier and feed items, one posted receipt that
  increases stock, a zero-stock contrast item, and a future-effective ration.
  The ration uses the stable future date `2030-01-01`; no future feeding record
  is created.

Every write carries a deterministic `Idempotency-Key`; existing rows are found
by the sentinel name/code/invoice and checked before reuse. A collision or an
unsupported route is reported with the exact route and HTTP status, and that
scenario is left absent.
