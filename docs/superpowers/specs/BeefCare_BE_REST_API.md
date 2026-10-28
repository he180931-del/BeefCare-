# BeefCare - REST API: Chuồng trại / Nhập đàn / Xuất đàn (FE-04, FE-06, FE-13)

Backend only (JHipster, Spring Boot 3). Business spec: `BeefCare_FE_Chuong_Nhap_Xuat_Logic.md` (the SRS appendices win).
All paths are under `/api/farms/{farmId}`; authentication is the usual JWT bearer token. Ids are `Long` (not uuid).

## 1. Conventions

- JSON in/out, dates `yyyy-MM-dd` (farm time zone Asia/Ho_Chi_Minh), money = whole VND `long`, weights = decimal kg.
- Every call re-checks: account ACTIVE, current membership role in `{farmId}`, and (for writes) farm service ACTIVE.
  A farm id the caller is not a member of, or an id belonging to another farm, answers 404 `MSG-COM-08` / 403 `MSG-COM-01`.
- Optimistic lock: entities expose `version`; send it back as `expectedVersion` (or `voucherVersion`, `cattleVersions`).
  Mismatch -> 409 `MSG-COM-05`.
- Post / confirm are idempotent: current-state check; an optional `Idempotency-Key` header is accepted. A repeat returns the
  first result (post returns `alreadyPosted=true`) and creates nothing.
- Every write command is a single transaction (all or nothing) and writes `audit_log`; corrections and voids also write `record_revision` (before/after).
- Event dates are never in the future (`MSG-COM-07`).

### Error body

```json
{ "code": "MSG-FE04-05", "params": { "pen_code": "P1", "count": 5, "free": 4 },
  "message": "<text in the Accept-Language locale, vi or en>", "status": 422, "title": "...", "path": "..." }
```
Bean-validation errors: 400 with `fieldErrors` (and codes `MSG-COM-06` required / `MSG-COM-10` invalid format where raised by services).
Texts of all 60 codes: `src/main/resources/i18n/domain_messages.properties` (EN) and `domain_messages_vi.properties` (VI).

| HTTP | Meaning |
|---|---|
| 200 / 201 / 204 | success / created (+Location) / deleted |
| 400 | validation (`fieldErrors`, MSG-COM-06, MSG-COM-10) |
| 401 | not authenticated |
| 403 | role not allowed (`MSG-COM-01`) or farm service not ACTIVE (`MSG-COM-12 {farm,status}`) |
| 404 | unknown id or id of another farm (`MSG-COM-08`) |
| 409 | optimistic-lock / state conflict (`MSG-COM-05`) |
| 422 | business rule (MSG-FE04-xx, MSG-FE06-xx, MSG-FE13-xx, MSG-COM-07/13/15/17/18) |

## 2. Role matrix (spec section 1)

| Action | Owner | Manager | Technician |
|---|---|---|---|
| View pens, pen history | yes | yes | yes (read only) |
| Create/edit pen, availability, move cattle | yes | yes | no |
| View entry vouchers | yes | yes | no |
| Create/edit/post/void entry vouchers, correct/void a herd entry, pending calves | yes | yes | no |
| Pay seller (entry payments) | yes | yes | no |
| View exit vouchers | yes | yes (read only) | no |
| Create/confirm/dismiss/void exit vouchers, record collection | yes | no (403) | no |
| Sellers / suppliers | yes | yes | no |
| Buyers | yes | no | no |

## 3. Endpoints

### 3.1 Pens (FE-04)
| Method | Path | Notes |
|---|---|---|
| GET | `/pens?status=ACTIVE\|INACTIVE&q=` | `{pens[], penCount, usedPlaces, totalPlaces}`; PenDTO has `headcount, freePlaces, full, acceptsSummary, currentCriteria, version` |
| GET | `/pens/{penId}` | PenDTO + `criteriaVersions[]` + `cattle[]` (hints EXIT_PENDING / PREGNANT / PEN_MOVE_SUGGESTED) |
| POST | `/pens` | `{code[A-Za-z0-9-]{1,20}, name, capacity 1..9999, description, criteria{purposeTypes,lifeStages,sex,minAgeMonths 0..240,minWeightKg 1..1500}, initialStatus}` -> 201, MSG-FE04-01; 422 MSG-FE04-02 duplicate code |
| PUT | `/pens/{penId}` | same body + `expectedVersion`; capacity below headcount -> MSG-FE04-03; changed criteria create a new criteria version (existing assignments keep theirs) |
| POST | `/pens/{penId}/availability` | `{status, effectiveDate, reason, expectedVersion}` -> MSG-FE04-04; never moves cattle. No DELETE exists |
| POST | `/pen-moves/check` | `{cattleIds[], toPenId, moveDate?}` dry run, per-cattle criteria results and errors, writes nothing |
| POST | `/pen-moves` | `{cattleIds[], toPenId, moveDate, reason, warningReasons{cattleId:reason}, cattleVersions?, performedBy?}` -> `{moved[], skipped[], message, destination}`; MSG-FE04-05 capacity, MSG-FE04-06 criteria unmet without reason, MSG-FE04-07 already there (skipped), MSG-FE04-08 success, MSG-FE04-09 date before current from_date |
| GET | `/cattle/{cattleId}/pen-history` | `{current, history[]}` |

### 3.2 Trading partners
| Method | Path | Notes |
|---|---|---|
| GET | `/trading-partners?role=SELLER\|BUYER\|SUPPLIER&status=&q=` | |
| GET | `/trading-partners/{id}` | |
| POST | `/trading-partners` | `{name, seller, buyer, supplier, phone, area, note}`; duplicate name 422 `MSG-FE06-25` (project addition) |
| PUT | `/trading-partners/{id}` | |
| PATCH | `/trading-partners/{id}/status` | `{status}`; INACTIVE instead of delete |

### 3.3 Entry vouchers (FE-06)
| Method | Path | Notes |
|---|---|---|
| GET | `/entry-vouchers?status=&type=&from=&to=&sellerId=` | `{items, tiles, statusCounts}` |
| POST | `/entry-vouchers` | create DRAFT PURCHASE / FARM_BORN with lines (optional inline new seller); code `PN-YYYY-nnnn` |
| GET | `/entry-vouchers/{id}` | lines with current herd status/pen, payments, derived totals, history |
| PUT | `/entry-vouchers/{id}` | replace header + lines of a DRAFT (no side effects) |
| DELETE | `/entry-vouchers/{id}?expectedVersion=` | DRAFT only, 204 |
| GET | `/entry-vouchers/life-stage-proposal?ageMonths=&birthDate=&entryDate=` | |
| GET | `/entry-vouchers/import-template` | .xlsx |
| POST | `/entry-vouchers/{id}/import` | multipart `file`, `commit=false` = dry run; <=200 rows, <=5 MB; MSG-FE06-18/19 |
| GET | `/entry-vouchers/{id}/checks` | ear tags, criteria, aggregated pen occupancy, MSG-FE06-17, MSG-FE06-24, `canPost` |
| POST | `/entry-vouchers/{id}/post` | `{printQr, expectedVersion?}` + `Idempotency-Key`; creates cattle, entries, OPEN assignments, QR tags, initial payment, REM-03; MSG-FE06-01 |
| GET | `/entry-vouchers/{id}/void-check` | per-cattle events after entry |
| POST | `/entry-vouchers/{id}/void` | `{reason, expectedVersion}` -> MSG-FE06-22; blocked 422 MSG-FE06-21 `{cattle_codes}` |
| PATCH | `/herd-entries/{entryId}` | `{changes{...}, reason, expectedVersion}` correct one animal -> MSG-FE06-06 (+MSG-FE06-23 over-payment notice) |
| GET | `/herd-entries/{entryId}/void-check` | |
| POST | `/herd-entries/{entryId}/void` | `{reason, expectedVersion}` -> MSG-FE06-12; blocked MSG-FE06-07/09 |
| GET | `/pending-calves` | calves waiting for registration (FARM_BORN) |
| POST | `/pending-calves/{calfId}/died-before-registration` | `{reason}` |

### 3.4 Exit vouchers (FE-13)
| Method | Path | Notes |
|---|---|---|
| GET | `/exit-vouchers?status=&type=&from=&to=` | tiles, status counts, rows |
| GET | `/exit-vouchers/selectable-cattle?q=&penId=&herdGroup=&minWeightKg=` | |
| GET | `/exit-vouchers/{id}` | detail + history |
| POST | `/exit-vouchers` | create DRAFT (SALE / CULL / OTHER / DEATH loss), Owner only |
| PUT | `/exit-vouchers/{id}` | edit DRAFT, or complete cause/disposal of a PENDING loss voucher |
| DELETE | `/exit-vouchers/{id}?expectedVersion=` | DRAFT only |
| POST | `/exit-vouchers/{id}/lines` | add cattle by id or QR tag code (MSG-FE13-08 if on another open voucher) |
| GET | `/exit-vouchers/{id}/checks` | per-cattle warnings (withdrawal, pregnancy, ...), never blocking |
| POST | `/exit-vouchers/{id}/confirm` | `{acknowledged, expectedVersion}` + `Idempotency-Key`; cattle -> EXITED, assignment closed, future doses cancelled, cases closed CLOSED_BY_EXIT |
| POST | `/exit-vouchers/{id}/dismiss` | `{reason, expectedVersion}` PENDING only |
| GET | `/exit-vouchers/{id}/void-check` | |
| POST | `/exit-vouchers/{id}/void` | `{reason, penOverrides{cattleId:penId}, warningReasons, expectedVersion}`; cattle back to ACTIVE, nothing closed at exit is auto-restored |

### 3.5 Payments (shared popup, BR-D39)
| Method | Path | Notes |
|---|---|---|
| GET | `/vouchers/{entry\|exit}/{voucherId}/payments` | `{payments[], summary{total,paid,outstanding,overpaid,state}}` |
| POST | `/vouchers/{entry\|exit}/{voucherId}/payments` | `{paymentDate, amount>0, method CASH\|BANK_TRANSFER, reference, note, voucherVersion?}` -> 201. Entry = PAY (Owner, Manager), exit = COLLECT (Owner). Amount above outstanding -> 422 `MSG-FE06-13 {amount}`; date before voucher date `MSG-COM-15`; voucher must be POSTED/CONFIRMED (409 otherwise) |
| POST | `/payments/{paymentId}/void` | `{reason, version?}`; outstanding rises again |

## 4. Removed endpoints
Generic JHipster CRUD (read and write) for Pen, PenReceptionCriteria, PenAssignment, Cattle, CattleQrTag, HerdEntry, HerdExit,
CattleProfileChange, RecordRevision and AuditLog no longer exist, so no client can bypass the rules above. Other generic resources
(Growth, HealthCase, Reminder, Breed, ProductionPurpose, ...) are untouched.

## 5. Assumptions and deviations
- Long ids instead of uuid; composite farm FKs not created (single-column FKs); cross-farm access blocked in the services.
- jsonb columns stored as text and serialised with Jackson; pen criteria `text[]` stored comma-separated; totals / outstanding are computed getters; `amount_paid` / `amount_collected` are a cache kept equal to the sum of RECORDED payments.
- Draft ERD tables were dropped and recreated (dev rows lost).
- Postgres-only integrity layer (`20261028000003_herd_logic_postgres_constraints.xml`: partial unique indexes, EXCLUDE gist no-overlap, `fn_pen_capacity_guard`, CHECKs) exists, but the same invariants are enforced in Java.
- Idempotency is by current-state check; no key table.
- Pen edits write `audit_log` only (no `record_revision`: the form has no correction reason).
- Hook for health cases: `HerdExitVoucherService.createPendingLossVoucher(...)` / `cancelPendingLossVoucher(...)` implement scenario 14 but the generic `/api/health-cases` resource does not call them yet; the future health-case closing command must.
- Generic event resources (Growth, Treatment, ...) are not yet farm-scoped and do not call `CattleGuardService.assertWritable` (MSG-COM-13/17/18); that guard must be wired when those features are rebuilt.
- Excel import uses a JDK-only xlsx reader/writer (no Apache POI).
- Payment before voucher date uses `MSG-COM-15`; duplicate partner name uses `MSG-FE06-25`.
