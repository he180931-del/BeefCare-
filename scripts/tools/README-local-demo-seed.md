# BeefCare local demo seed

## Canonical entrypoint (FE-07 / FE-14 / FE-15 / FE-23)

Use [`beefcare-local-demo-seed-v1.ps1`](beefcare-local-demo-seed-v1.ps1). It is
the versioned, farm-scoped entrypoint for the shared local demo. It discovers
the farm and IDs through the authenticated API, prompts for the local password
when `BEEFCARE_DEV_PASSWORD` is absent, is dry-run by default, and uses
deterministic sentinels plus idempotency keys for Apply.

```powershell
$env:BEEFCARE_DEV_PASSWORD = '<your local value>'
pwsh -NoProfile -File scripts/tools/beefcare-local-demo-seed-v1.ps1
pwsh -NoProfile -File scripts/tools/beefcare-local-demo-seed-v1.ps1 -Apply
```

See [`docs/local-demo-seed.md`](../../docs/local-demo-seed.md) for the concise
scenario list and prerequisites. The older scripts below are FE-23-only
investigation helpers and are not the shared seed entrypoint.

## Actual API helper

Use `beefcare-local-demo-seed-actual.ps1`. It is fixed to the routes and DTOs
in `FeedManagementResource` and `FeedManagementDtos`; the old route-config
example is not an API contract and must not be used for applying data.

Required local inputs are `BEEFCARE_LOCAL_FARM_ID`,
`BEEFCARE_LOCAL_SUPPLIER_ID`, `BEEFCARE_LOCAL_FEED_ITEM_ID`, and
`BEEFCARE_LOCAL_PEN_ID`, plus the receipt/feeding dates, purchase unit, session
time, purchase quantity, unit price, ration kg, and actual kg. No business
values are invented by the helper. It does not create a supplier, feed item, or
pen. It also requires the cookie session and CSRF header/token exported by the
existing `scripts/seed-qa-fixtures.py`; the supplied source did not include
that handoff, so the helper stops before any POST when those three session
artifacts are absent.

The helper uses these fixed routes:

- `GET/POST /api/farms/{farmId}/feed/receipts`
- `POST /api/farms/{farmId}/feed/receipts/{receiptId}/post`
- `GET /api/farms/{farmId}/feed/rations` (the helper only reads an existing
  ration; create one separately through an approved local API flow)
- `GET/POST /api/farms/{farmId}/feed/feeding-records`
- `GET /api/farms/{farmId}/feed/stock`
- `GET /api/farms/{farmId}/feed/reminders`

Receipt creation is always `postNow=false`, followed by the versioned post
command. Each POST carries a stable `Idempotency-Key`. The helper uses native
PowerShell `SupportsShouldProcess`/`ShouldProcess`; `-WhatIf` suppresses every
POST, while normal operation remains dry-run unless `-Apply` is supplied.
Before the first possible write it reads and validates the farm, active
supplier, catalogue item, active pen, stock row, and all existing replay
records. A matching replay must have the exact receipt line count and
`feedItemId`, `quantityPurchase`, `purchaseUnit`, and `unitPrice`; an existing
VOIDED record is always rejected. Ration and feeding replay/readback also check
pen/date/session/status and every line. The ration must expose a date range
covering the feeding date (`effectiveFrom <= FeedingDate <= effectiveTo`, when
`effectiveTo` is present), and its status must be a supported non-cancelled
state. This check runs before the first write and again on ration readback.

The current backend contract has an intentional date dependency: receipts must
not be future-dated, new rations require `effectiveFrom` tomorrow or later, and
feeding records reject future dates. Therefore a missing or date-incompatible
ration is a clear preflight stop; the helper does not create a receipt and then
attempt a feeding that cannot be valid for a newly-created future ration.
Pre-create a compatible ration through an approved local API/auth flow, then
rerun this helper.

Dry run (no reads or writes):

```powershell
$env:BEEFCARE_LOCAL_FARM_ID = '<local farm id>'
$env:BEEFCARE_LOCAL_SUPPLIER_ID = '<active supplier id>'
$env:BEEFCARE_LOCAL_FEED_ITEM_ID = '<catalogue feed item id>'
$env:BEEFCARE_LOCAL_PEN_ID = '<pen id>'
$env:BEEFCARE_LOCAL_SEED_RECEIPT_DATE = '<ISO receipt date>'
$env:BEEFCARE_LOCAL_SEED_FEEDING_DATE = '<ISO feeding date>'
$env:BEEFCARE_LOCAL_SEED_PURCHASE_UNIT = '<purchase unit>'
$env:BEEFCARE_LOCAL_SEED_SESSION_TIME = '<HH:mm>'
$env:BEEFCARE_LOCAL_SEED_RATION_NAME = '<reviewed ration name>'
pwsh -NoProfile -File scripts/tools/beefcare-local-demo-seed-actual.ps1
```

Pass `-QuantityPurchase`, `-UnitPrice`, `-Session1Kg`, and `-ActualKg` on the
same command (or supply the corresponding reviewed values from the coordinator
runbook); these values are intentionally required and have no defaults.

Coordinator apply command, after exporting the existing Python session cookie
and CSRF artifacts into the three environment variables named in the script:

```powershell
$env:BEEFCARE_LOCAL_COOKIE_HEADER = '<session cookie header from local helper>'
$env:BEEFCARE_LOCAL_CSRF_HEADER_NAME = '<CSRF header name from local helper>'
$env:BEEFCARE_LOCAL_CSRF_TOKEN = '<CSRF token from local helper>'
pwsh -NoProfile -File scripts/tools/beefcare-local-demo-seed-actual.ps1 -Apply
```

Add the reviewed quantity arguments to that command:
`-QuantityPurchase <q> -UnitPrice <price> -Session1Kg <kg> -ActualKg <kg>`.

The authoring agent did not execute this command or write data. `BaseUrl` is
strictly limited to an `http` loopback root (`127.0.0.1`, `localhost`, or
`[::1]`) with no path, query, fragment, or userinfo. HTTPS, remote hosts, and
URL prefixes are rejected before any request.

Offline safety checks (no network and no POST):

```powershell
pwsh -NoProfile -Command "[System.Management.Automation.Language.Parser]::ParseFile('scripts/tools/beefcare-local-demo-seed-actual.ps1',[ref]$null,[ref]$null) | Out-Null"
pwsh -NoProfile -File scripts/tools/beefcare-local-demo-seed-actual.ps1 -WhatIf
```

The second command is expected to stop on missing explicit IDs/dates before
network access. For a parameter-complete offline dry-run, use reviewed local
values and omit `-Apply`; it must print `No reads or writes performed`.

## Ghi chú tiếng Việt và trạng thái xác minh

- Route/DTO đã đối chiếu theo `FeedManagementResource` và
  `FeedManagementDtos`: receipt tạo `postNow=false`, sau đó gọi endpoint
  `/post` với `expectedVersion`; ration dùng `SaveRationRequest`; feeding dùng
  `RecordFeedingRequest`.
- Chưa có trong source được cung cấp: cách `scripts/seed-qa-fixtures.py` xuất
  cookie session và CSRF header/token; giá trị ID local thật của supplier,
  feed item và pen; endpoint health. Helper không tự suy đoán các giá trị này.
  Thiếu session/CSRF thì dừng trước POST; thiếu ID thì dừng ngay từ đầu.
- Không được hard-code `REM-10/11`. Helper chỉ đọc `/feed/reminders` và in
  các dòng reminder thực tế.
- Coordinator phải xác minh chính xác: supplier active thuộc farm; feed item
  có trong catalogue; stock tăng sau receipt POST; receipt `POSTED`; ration
  có đúng `rationCode`, trạng thái không bị huỷ, khoảng hiệu lực bao phủ ngày
  feeding, pen, session và component; feeding log có đúng status `VALID`,
  pen/date/session/feed line; reminders trả về từ API; chạy lại cùng identity
  không tạo bản ghi trùng.
- Tác vụ này không chạy Apply, không chạy Docker, không ghi dữ liệu và không
  dùng credential thật. Đã chạy parser PowerShell cùng `-WhatIf`/dry-run offline;
  chưa chạy API, Docker hoặc kiểm tra round-trip DB.

`beefcare-local-demo-seed-actual.ps1` is a local-only, idempotent helper for the
first demo slice. It is intentionally dry-run by default and has an explicit
`-Apply` write gate plus native `-WhatIf` support. It refuses non-loopback URLs,
missing IDs, missing session/auth contract, mismatched replay identities, and
response data that does not prove the requested farm. It does not create a
supplier, feed item, pen, or a missing ration.

The checked-in `beefcare-local-demo-seed.config.example.json` is a route-shaped
example, not a claim about the installed service. Before applying, the
coordinator must copy it to a local config (or set
`BEEFCARE_LOCAL_SEED_CONFIG`) and reconcile all paths and filter semantics with
the existing demo/runtime helper and the running local API. Set `verified` to
`true` only after that review. The helper will not create a verified config
automatically.

## Legacy route-config workflow (do not use)

The older `beefcare-local-demo-seed.ps1` and route-shaped config workflow are
retained only as historical context. Do not run them: they do not implement the
current DTO/date/replay/WhatIf safeguards. Use the actual helper above and stop
at its explicit preflight error when a required API/auth contract is missing.
## Coordinator verification checklist

- [ ] Sections 4 and 5 of `Ke_hoach_FE_BE_pham_vi_Tai.md` were read and the
      stock receipt -> effective ration -> feeding sequence matches them.
- [ ] Existing demo/runtime helper and installed API/service were inspected;
      config paths, field names, units, marker query, and response shape match;
      the local config is marked `verified=true`.
- [ ] The local stack/DB is isolated; base URL is loopback and the farm ID is
      explicit. No cross-farm records are possible from the chosen payload.
- [ ] First run was dry-run, then `-Apply` was used only with the explicit
      environment guard. No data write was performed by the authoring agent.
- [ ] Stored-value readback proves receipt quantity, ration quantities, feeding
      quantity, marker, and farm ID; REM-10 and REM-11 both consume the data.
- [ ] A second apply is idempotent (same IDs, no duplicate rows).
- [ ] No credential is committed; any token came from the local environment.
- [ ] Any unchecked item is reported as unverified rather than called passing.

Lệnh xác minh host-side (chạy tại repository root, sau khi coordinator đã
chuẩn bị session local) là chạy `-Apply` một lần, sau đó chạy lại đúng lệnh với
cùng các biến/đối số. Lần đầu phải thấy `POSTED` receipt, ration id, feeding id,
stock `onHandKg` tăng và số dòng reminders; lần hai phải thấy `Reusing receipt`,
`Reusing ration`, `Reusing feeding record` với cùng IDs. Nếu invoice/rationCode
hoặc tuple pen/date/session đã tồn tại nhưng payload khác, helper phải dừng và
không POST bản sao.
