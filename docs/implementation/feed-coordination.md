# Feed, announcements, reminders and management reporting traceability

This implementation map follows `docs/requirements/SRS_2026-10-28.txt`. A use case remains partial until its permissions, tenant boundaries, state/data rules and meaningful tests are accepted. The parent has compiled the shared snapshot and passed H2 context, farm bootstrap and idempotency checks; the new dashboard/report/query changes below have not yet been exercised by Maven.

## FE-23 Feed Management

| Use case | Backend mapping | Status and remaining acceptance work |
|---|---|---|
| UC-FE23-01 View stock and movements | `GET /api/farms/{farmId}/feed/stock`, `GET .../stock/{feedId}/movements`; `FeedItem`, `FeedStockMovement` | Partial. Stock, average cost, minimum stock, days cover/use and movement history exist. Per decision D04 the SRS has no FEFO: lots are for expiry warnings only, so "Lot near expiry" is the nearest POSTED receipt lot expiring within 30 days (unit-tested). `FeedInventoryLot`/`FeedLotAllocation` (migration 00800) stay unused and are not a stock source. |
| UC-FE23-02 Receive feed and record supplier payments | `POST .../feed/receipts`, `PUT .../receipts/{id}/draft`, `/receipts/{id}/post`, `/receipts/{id}/payments`; `FeedReceipt`, lines and `VoucherPayment` | Partial. Receipt code is now PNK-YYYY-nnnn from the yearly sequence (BR-D34); `createReceipt` previously failed on a real database (see HANDOFF "save() of versioned entities") and is now covered by an H2 test. Expiry, inactive feed/supplier and void-coverage errors use MSG-FE23-03, MSG-COM-08 and MSG-FE23-05. Draft create/edit/post, expected-version checks, unit conversion, weighted average and finance reuse exist. Invoice/delivery attachment upload/view is **not implemented**. Draft editing and payment/void tests need shared verification. |
| UC-FE23-03 Void receipt | `POST .../feed/receipts/{id}/void` | Partial. Version/reason and stock locks/reversal logic exist; lot-level reversal and verified tests remain. |
| UC-FE23-04 Adjust stock | `GET/POST .../feed/adjustments`, `GET .../adjustments/{id}`, `PUT .../adjustments/{id}/draft`, `POST .../adjustments/{id}/post`; `FeedStockAdjustment` + lines (migration `20261029001000`) | Implemented per SRS entity and SCR-80: code ĐCK-YYYY-nnnn from the yearly sequence, type PERIODIC_COUNT/LOSS/SPOILAGE/OTHER, DRAFT has no stock effect, posting recomputes system stock at the count date (farm time zone), requires a reason per difference (MSG-FE23-08), rejects negative stock (BR-D36), writes one ADJUSTMENT movement per difference at the weighted average cost and is immutable afterwards (GBR-100). `FeedStockAdjustmentServiceIT` (8 H2 tests) covers draft/post, immutability, reason, as-of stock, negative stock, validation, Technician/other-farm denial. Attachments (count record/photos) are not implemented. |
| UC-FE23-05/06 View and version rations | `GET/POST .../feed/rations`; `FeedRationVersion`, pen/component snapshots | Partial. Effective-date versioning and pen linking exist; cancellation/history tests and contract coverage remain. |
| UC-FE23-07/08 Feeding log and record feeding | `GET/POST .../feed/feeding-records`; feeding record and line tables | Partial. Manager-only recording, as-of headcount, stock locking/deduction and snapshots exist; full concurrency and role tests remain. |
| UC-FE23-09 Correct/void feeding | `POST .../feeding-records/{id}/correct|void` | Partial. Mandatory version/reason, revisions and stock adjustments exist; conflict/rollback tests remain. |
| UC-FE23-10 Catalogue and suppliers | `GET/POST .../feed/catalogue`, `PUT .../catalogue/{id}` and partner APIs | Partial. Feed code and reference protections, unit conversion and minimum level exist; acceptance tests remain. |
| UC-FE23-11 Consumption/cost report | `POST .../feed/reports/consumption` | Partial. Actual/planned quantity, variance and negative adjustments are separated. GBR-107 fattening allocation is implemented in the management-report projection but remains unverified and needs denominator checks. |

Feed schema is additive in `20261028000300_feed_coordination.xml`, included by the project master changelog. `FeedItem` retains the foundation model; `feed_stock_movement` is append-only and the item's stock/cost are summaries. Feed payments reuse `VoucherPayment`; they are bookkeeping entries and do not transfer money.

## FE-07 Farm Announcements

| Use case | Backend mapping | Status and remaining acceptance work |
|---|---|---|
| UC-FE07-01 Create/edit draft | `FarmAnnouncementService`; `/announcements/drafts` | Implemented in service/resource with author scoping and Owner/Manager audience validation; tests exist, not rerun after latest snapshot. |
| UC-FE07-02 Publish/correct | `/announcements/{id}/publish|corrections`; immutable `AnnouncementVersion` | Implemented with version snapshots, correction reason and outbox event; latest tests remain unverified. |
| UC-FE07-03 Resolve audience | `AnnouncementRecipient` | Active membership snapshot at publication; Owner may choose Manager/Technician, Manager only Technician. |
| UC-FE07-04 Read delivery/history | `/announcements`, `/recipients/{id}/read` | Author and recipient scoped. Generic generated CRUD controllers are disabled by default. Integration authorization tests remain. |

## FE-14 Reminders and notifications

| Use case | Backend mapping | Status and remaining acceptance work |
|---|---|---|
| UC-FE14-01 Farm reminders | scoped `FarmReminderQueryService`, `ReminderReconciliationService` JOB-01, source mutation services | Reconciliation implemented for REM-01 to REM-13 with source-derived due dates, effective parameter snapshots, stable source keys, and stale-active cancellation. Scheduler and transition behavior still require H2 integration tests. REM-10/11 support farm/pen reminders without a cattle foreign key. |
| UC-FE14-02..04 Notifications | `NotificationService.notify(...)`, `/api/notifications/mine`, `/{id}/read`, `/read-all` | Recipient-only inbox, event-key dedup and live target authorization exist. Producers are incomplete. Support tickets allow requester or active CS; internal requests require current named recipient and target role. |

Reminder screen access is tenant scoped and reading does not mutate lifecycle. REM-09/12/13 are restricted to Owner/Manager, REM-10 to Owner/Manager, REM-11 to Manager/Technician. The scheduled reconciler writes reminders only; it never registers cattle or performs care actions. Notification display summaries must stay bounded and omit ticket bodies, evidence contents and credentials.

## FE-15 Dashboard and reports

| Requirement | Backend mapping | Status and remaining acceptance work |
|---|---|---|
| UC-FE15-01 dashboard | `GET /api/farms/{farmId}/dashboard` | Partial M01–M08 and M09/A01–A04 read projections exist for Owner/Manager, with period/group/stage/pen filters. Getting-started checklist, all exact attention-state variants, historical/as-of correctness and focused tests remain. |
| UC-FE15-02 reports | `POST /api/farms/{farmId}/dashboard/reports` | RPT-01–07 calculations are implemented but not yet verified. RPT-05 now derives calving interval, days open, services/conception, first-service and overall conception, pregnancy loss, age at first calving and overdue females from linked valid records; verify linkage and all numerators/denominators with focused integration tests. RPT-07 includes average start/end weights, average daily head and projected days; its feed attribution still depends on current pen assignment data and is unverified. |

Report inputs validate ordered dates and a maximum 24-month period. Missing denominators are represented as null/unavailable rather than zero. RPT-07 weight interpolation follows the within-60-day/otherwise-within-7-day source rule; daily feed attribution follows pen assignment counts. All these calculations still require focused test coverage and integrated verification.

## Shared command infrastructure

Durable idempotency records are scoped by verified actor, farm/account scope, action and client key. Requests are hashed; bounded JSON response DTOs are stored with command writes and outbox rows in the same transaction. A replay rechecks current farm/platform permissions. `executePlatformAuthorized(...)` also rechecks mutable named assignments during replay and concurrent-key recovery. The outbox retries unhandled events rather than falsely acknowledging them; external provider handlers remain extension points.

