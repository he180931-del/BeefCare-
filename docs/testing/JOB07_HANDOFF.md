# JOB-07 handoff — in-app notification delivery slices

## API-04 D24 runtime smoke — 16/11/2026

- Ran against the isolated PostgreSQL QA clone with local Mailpit and the
  `MOCK` SePay simulator only. No real bank, SePay, SMTP provider or production
  database was used. The QA seed password was supplied through the process
  environment and was not printed or written to evidence.
- PM published price version **5401**, labeled
  `QA-TAI-FE07-D24 local MOCK Mailpit validation` (1-year price 1,000,000 VND;
  2-year 1,800,000 VND; 3-year 2,400,000 VND). Publish returned EFFECTIVE in
  **152 ms**. Owner `other-owner@beefcare.local` was scoped to Farm B (**1152**)
  and created one 1-year request against that price; it returned PENDING in
  **228 ms**, amount 1,000,000 VND, payment **5601**, reference
  `BCCDFF34C8EA46`.
- PM sent synthetic incoming transaction ID **99000001601** through
  `POST /api/dev/sepay/events`; the simulator returned HTTP 200,
  `success=true`, `duplicate=false`, evidence **5651**, in **457 ms**. Payment
  **5601** reached PAID, receipt **RC-26-005601**, and Farm B service became
  ACTIVE. The Owner read exactly one `subscription` / `SUBSCRIPTION`
  notification targeting Farm B. Local Mailpit captured exactly one receipt
  email with subject `Xác nhận thanh toán gói dịch vụ BeefCare`.
- Replayed the exact same synthetic transaction after recovering the original
  bank timestamp from the payment-detail response. The simulator returned
  `success=true`, `duplicate=true`, payment **5601**, in **38 ms**. Payment
  remained PAID with the same receipt; Owner still had exactly one matching
  in-app notice and Mailpit still had exactly one matching receipt message.
  An earlier attempt with a different timestamp correctly returned 409 and did
  not create another notice or message.
- This is a sequential localhost smoke on the PostgreSQL QA clone. It does not
  measure P05 concurrent load or performance; P05 sandbox remains unmeasured.
  Synthetic QA rows were retained; no shared/local production data was reset.

## API verification — 16/11/2026

- `NotificationResourceIT` passed 3/3 against PostgreSQL 16.15 and
  `NotificationResourceH2IT` passed 3/3. Both exercise the HTTP routes with a
  mocked notification service. The service and workflow tests below cover the
  recipient, authorization and delivery checks separately.
- The focused backend run passed 133/133, including `SupportTicketWorkflowTest`
  (16/16), `NotificationServiceTest` (11/11), `NotificationTargetAccessServiceTest`
  (8/8), and both internal request outbox handlers (13/13 together). The
  platform admin adapter run passed 24/24.

## Status

Backend implementation checkpoint for two bounded JOB-07 slices: published and
corrected FE-07 announcement versions, and named internal-support request
events. Support request notices use a dedicated outbox handler; no email is
sent by either slice. This agent did not run Maven because `backend/target` is
shared; the root integration owner owns the reserved backend verification.

## Sources and scope

- `docs/REQUIREMENT_DECISIONS.md` D12: use the approved SRS dated 28/10/2026
  and the feature specs under `docs/requirements/specs/`.
- `docs/requirements/specs/FE-14-nhac-viec-thong-bao.md` §§1–5, 7, 10:
  FE-14 notifications are subscription/payment, support and reconciliation;
  farm reminders are not email or push (Q3); every notice has one typed target
  and one recipient, and current access is checked when opened.
- `docs/requirements/SRS_2026-10-28.txt` Part III §7 FE-07 UC-FE07-02/03,
  GBR-60–64, Part III §14 notification screens, §24.7 JOB-07, §25.4 API-04,
  and NFR-S03/S13.
- `docs/testing/FE14_BE_HANDOFF.md`: existing notification and email delivery
  paths and reminder-specific outbox work. That shared handoff was read only.
- `backend/src/main/java/vn/edu/fpt/beefcare/service/FarmAnnouncementService.java`,
  announcement/version/recipient entities and repositories, notification
  service/access code, the checked-in notification OpenAPI view, and existing
  notification tests.

## Existing paths by event source

| Source | Existing behavior found | Scope decision |
| --- | --- | --- |
| Subscription and payment | `SubscriptionNoticeJob`, `SubscriptionLifecycleJob`, `SePayWebhookService`, and `EmailDeliveryJobService` already create selected in-app rows synchronously. Email jobs have their own retrying consumer. D24 specifically covers the payment JOB-07 slice and says not to activate consumers for unrelated feature events. | Left unchanged; this handler does not claim payment/subscription events and does not add email. |
| Invitation acceptance | D28 queues the Owner email in `EmailDeliveryJob` during acceptance; delivery retries independently and rechecks current Owner access. D28 explicitly excludes an in-app notice. | Left unchanged; no duplicate in-app notice or real email send was added. |
| Support | `SupportTicketCommandService` still creates selected ticket notices synchronously. Internal request create, reassign, cancel and completion now enqueue distinct JOB-07 notice event types in the same command transaction. The generic `SUPPORT_UPDATED` / `SUPPORT_REQUEUED` events remain unclaimed. | Implemented only the internal request transitions with explicit recipient or CS queue rules; other ticket transitions are unchanged. |
| Reconciliation | `ReconciliationNoticeService` creates selected PM in-app notices synchronously. Payment evidence handling has its own existing flow. | Left unchanged; this handler does not claim evidence or reconciliation events. |
| Farm announcements | FE-07 persists each immutable `AnnouncementVersion` and its `AnnouncementRecipient` rows (the resolved audience snapshot) with the publish/correction command, then writes `ANNOUNCEMENT_PUBLISHED` or `ANNOUNCEMENT_CORRECTED` with aggregate `AnnouncementVersion`, version ID and snapshot count. | Implemented an in-app JOB-07 consumer for these two event types only. |
| Farm reminders | FE-14 Q3 and the reminder contract say reminders are displayed in the farm workspace. JOB-01 reconciliation is separate. | No reminder notification or reminder email was added. |

The generic outbox dispatcher polls independently and allows one handler per
event type. Announcement, internal-request, and internal-request-completion
handlers claim distinct event types; unrelated and unhandled rows stay with
their own delivery contract. Each source event is saved in the command
transaction with its business change.

## Implementation

- Added `AnnouncementNotificationOutboxHandler`. It validates the event's
  aggregate type, farm ID, version ID, announcement ID and recipient count
  against the persisted snapshot. Missing/malformed data and repository errors
  propagate to the dispatcher so the event remains retryable.
- The handler reads only recipient rows for that exact version, orders and
  locks each current membership, then checks current membership/account status,
  current MANAGER/TECHNICIAN role, current farm service status and active
  platform access. SRS Part I says OWNER membership is immutable; GBR-60's
  valid announcement recipients are Manager/Technician for Owner authors and
  Technician for Manager authors. A revoked recipient is skipped and the event closes; a
  processing error is not treated as revocation.
- Each eligible recipient receives a `Notification` with category
  `ANNOUNCEMENT`, target type `ANNOUNCEMENT_VERSION`, and target ID equal to the
  exact version ID. Its event key is `JOB07:ANNOUNCEMENT:<outbox event ID>`;
  `NotificationService` already deduplicates on recipient plus event key and
  the database has unique constraint `uq_notification_recipient_event`.
- `NotificationTargetAccessService` resolves the exact version, requires
  current farm announcement access and current membership, rejects an active
  platform role, and requires a delivery row for that same version. It does
  not authorize access to a later version through an earlier delivery.
- `NotificationService.markRead` and `markAllAsRead` serialize an
  `INTERNAL_REQUEST` access check with reassignment/cancellation: they observe
  request IDs, lock the associated ticket rows in ascending ID order, refresh
  and lock requests by `(ticket ID, request ID)`, then recheck the current named
  recipient and active PM/SA role before setting `readTime`. They never lock a
  notification before those ticket/request locks. Read-all locks all related
  tickets before requests in a stable order, matching the support command's
  ticket → request order and avoiding cross-ticket deadlocks. Other target
  types continue through the ordinary target-access check. Inaccessible rows
  are hidden and are not counted as read.
- `InternalSupportRequestService` enqueues `JOB07_INTERNAL_REQUEST_NOTICE` for
  create, cancel and the new recipient after reassignment. Its payload snapshots
  recipient ID, action and request version. The handler sends only while the
  same user remains the assigned PM/SA, has an ACTIVE account and current
  matching platform role, the action is still current (OPEN for create / reassign,
  CANCELLED for cancel), and the persisted request version matches the event.
  Create flushes after assigning the generated request code before capturing
  that version. The handler locks ticket then request and refreshes under lock,
  matching the command lock order. Reassignment away and back cannot revive an
  old event or send the old recipient's notice.
- PM/SA notices target `INTERNAL_REQUEST`; the target check also protects the
  existing SCR-69 read route. A missing request or revoked/inactive PM/SA role
  stays hidden as COM-08 / HTTP 404. When the notification belongs to the
  current actor but the still-existing request was reassigned, the backend
  returns FE20-19 / HTTP 404; this reveals no target to a user who does not own
  the notification. The platform-admin adapter maps FE20-19 before the generic
  404 display fallback. Event ID supplies the retry key, and
  `NotificationService` deduplicates by recipient plus event key.
- Completion writes `JOB07_INTERNAL_REQUEST_COMPLETED_NOTICE`; its handler
  resolves current CS recipients using the same assigned-CS / available-queue
  rule as `SupportTicketCommandService.notifyCs`, then rechecks each recipient's
  current ticket access before creating `SUPPORT_TICKET` notices. It locks the
  ticket, refreshes the locked ticket, then locks the request in the command
  order and checks the captured request version. Refreshing the ticket before
  recipient resolution prevents a CS handover during lock wait from routing
  the notice to the former assignee. It does not include the request result text.
- The four-hour reminder remains on the one-minute `SupportMaintenanceJob`.
  It uses a stable request-plus-recipient key, so a failed scheduled attempt is
  retried on a later tick and duplicate runs do not add another row. The sweep
  now locks all candidate tickets by ascending ID, refreshes each request in
  ticket/request order, then rechecks OPEN state and current named-recipient
  role/account before creating reminders. A stale assignment loaded before the
  lock cannot receive a reminder. The sweep is not an outbox consumer and a
  failed notice can roll back that sweep transaction; no business command is
  rolled back.
- Other support-ticket notices, including new tickets, public replies and
  resolution changes, remain synchronous. They are not inferred from
  `SUPPORT_UPDATED`; that event type has no notification handler here.
- No email transport is called. No subscription, payment, support,
  reconciliation, farm reminder, or generic `FARM_COMMAND_COMMITTED` event is
  claimed. D24 payment delivery and email jobs remain unchanged.

## UI routing limit

FE-07's existing Owner/Manager and Technician announcement screens already
read announcement deliveries from `AnnouncementRecipient`; those roles still
do not have a generic announcement-version notification list. The existing
FE-07 delivery rows now link to the exact latest visible version using
`/thong-bao/{announcementId}?versionId={versionId}` or
`/kt/thong-bao/{announcementId}?versionId={versionId}`; the detail page checks
that the version is in the caller's farm-scoped visible history and renders that
version only. An inaccessible or missing version gets the not-found-safe state,
and a stale link cannot mark a newer delivery read. See the 16/11 increment in
`docs/testing/FE07_HANDOFF.md` for frontend tests.

The FE-14 SCR-45 Owner notification spec covers subscription/payment and
support, while its feature spec assigns announcement notifications to FE-07.
Therefore SCR-45 was left unchanged. A future generic notification click
adapter still needs an approved FE-07 notification-list entry point; no
notification tab or route was added without one. Support internal request
notices continue through the existing FE-14 SCR-46 support inbox for CS and
PM/SA, whose backend adapter reads `/api/notifications/mine` and filters
`SUPPORT`.

## API-04 payment synthetic validation

For a local end-to-end payment notice check, use only the MOCK simulator and
Mailpit; do not configure real bank or SMTP credentials:

1. From repository root, start the local database and Mailpit with
   `docker compose -f compose.backend.yml up -d --wait`. Confirm Mailpit is at
   `http://127.0.0.1:8025` and SMTP at `127.0.0.1:1025`.
2. Start the backend with the documented `dev,local` profiles and start the
   frontend. Keep `BEEFCARE_SEPAY_ENVIRONMENT=MOCK`, local dummy receiving-bank
   values, and Mailpit's local SMTP endpoint (`localhost:1025`, no auth/TLS).
   Use local seeded users only.
3. As PM, publish a short-lived test plan price. As Owner, create a payment
   request and copy its transfer code and exact amount. As PM, post a unique
   synthetic incoming transfer to the dev-only
   `POST /api/dev/sepay/events` simulator; its JSON is the `SePayPayload` in
   `SePayWebhookService` (`id`, `gateway`, `transactionDate`, `accountNumber`,
   `content`, `transferType: "in"`, `transferAmount`, `referenceCode`). Use the
   copied transfer code/amount, a fresh integer ID/reference, and the dummy
   account configured for that local request. The simulator checks PM access
   and `MOCK`/`TEST`; it calls the same settlement path as the verified webhook.
4. Verify the payment reaches PAID with one receipt, the Owner has one in-app
   notice keyed `PAYMENT_PAID:<paymentId>`, one durable `email_delivery_job`
   exists for that event key, and the rendered receipt appears in Mailpit. The
   mail worker can be asynchronous; refresh Mailpit after the next dispatch
   tick. Replaying the same synthetic transfer should not create a second
   payment period, notification or email intent.
5. Provider-failure/retry and concurrency should be checked with the existing
   mock-backed `SePayWebhookResourceTest` cases
   `emailProviderFailureRetriesIndependentlyOfPaidAndStopsAt24Hours`,
   `concurrentDeliveriesAndWorkersCreateOneEvidenceJobPeriodAndEmailIntent`,
   and `synchronousSimulatorStillConfirmsAndQueuesOneDurableOwnerEmail`.
   These tests do not send real email. D24 review evidence is local
   MOCK/PostgreSQL/Mailpit, not LIVE.

## FE20-19 contract resolution

FE-14 UC-FE14-03 / TC-14-24 and FE-20 TC-20-17 require FE20-19 when a
recipient-owned internal-request notification points to a reassigned request.
The HTTP status remains 404. The recipient-scoped notification lookup happens
before the locked request is inspected; only a still-active PM/SA account can
receive FE20-19. A notification not owned by the actor, a missing request, or a
revoked/inactive platform role receives COM-08 / HTTP 404. The platform-admin
adapter recognizes the business code before rendering the generic 404 fallback.

## Tests and evidence

Added tests:

- `AnnouncementNotificationOutboxHandlerTest`: exact event ownership, stable
  event-ID retry key, current-membership, owner-role and platform-access skips,
  payload vs persisted-snapshot count validation, and propagation of repository errors.
- `NotificationTargetAccessServiceTest`: exact-version delivery access and
  active-platform-role denial.
- `NotificationServiceTest`: existing recipient/event deduplication on retry,
  inaccessible target denial on mark-read, revalidation only after the internal
  assignment lock, and excluding a reassigned internal request from read-all.
- `NotificationServiceTest`: FE20-19 for a recipient-owned request reassigned
  to another PM/SA while the former recipient remains active; COM-08 for a
  revoked role or missing target; no target inspection for an unowned notice.
- `NotificationTargetAccessServiceTest` and
  `frontend/tests/unit/platform-admin/platformAdminApi.test.ts`: active PM/SA
  disclosure guard and FE20-19 UI mapping ahead of the generic 404 fallback.
- `NotificationTargetAccessServiceTest`: ticket-before-request locking for a
  single request, stable ascending ticket/request order for read-all, and
  recipient/current-role recheck against the refreshed request.
- `InternalRequestNotificationOutboxHandlerTest` and
  `InternalRequestCompletionNotificationOutboxHandlerTest`: event ownership,
  stable event-ID retry keys, stale recipient/access handling, ticket refresh
  before CS recipient resolution after handover, and retryable delivery errors.
- `SupportTicketWorkflowTest`: source-event recipient/action/version payloads,
  create-to-dispatch, retry deduplication, X→Y→X reassignment before delivery,
  cancellation target access, former-recipient read denial after reassignment,
  current-role revocation, former-CS reminder suppression after recipient
  reassignment when the request was already loaded, completion notification
  delivery, reminder dedupe, and rollback of request plus outbox event.
- `NotificationResourceH2IT`: 3/3 passed with `@ServiceIntegrationTest`,
  H2, MockMvc and a mocked `NotificationService`. It covers `/mine`, the two
  CSRF-protected read routes, and rejects generic collection/create/delete
  routes. This verifies HTTP routing and security in H2; it does not exercise
  notification persistence.

Maven was not run by this agent. The newly added internal-request unit and H2
workflow cases await the shared integration run after FE15/FE23 backend edits
are stable. The root owner owns that run. No email provider or external mail
service was used.

The root integration run connected PostgreSQL/Testcontainers on Windows Docker
29 using `DOCKER_HOST=npipe:////./pipe/dockerDesktopLinuxEngine`, API 1.44,
`Asia/Ho_Chi_Minh`, and the test profile with mocked email. At the latest
checkpoint, `NotificationResourceIT` had 2/3 passing; the generic POST route
returned 403 from the security deny-all rule instead of 404. This agent added a
valid CSRF token and changed the expected result to 403 while keeping
`verifyNoInteractions`. The root owner will rerun after the other shared backend
edits are stable. The earlier HTTP checks against the isolated PostgreSQL QA
clone below remain separate and successful.

## PostgreSQL and HTTP QA readback — 15/11/2026

- The root owner confirmed that an `ANNOUNCEMENT_PUBLISHED` event had been
  processed into one notification in the isolated QA clone
  `beefcare_tai_ration_upgrade_20261115`.
- Against the running `127.0.0.1:8080` backend, this agent imported the helper's
  `Api` class only; the helper's write-heavy `main()` was not run. After login,
  read-only `GET /api/farms` and `GET /api/notifications/mine` calls confirmed
  the recipient boundaries.
- The Technician on the shared farm saw exactly one matching notice with
  `category=ANNOUNCEMENT`, `targetType=ANNOUNCEMENT_VERSION`, and a `targetId`
  for the published announcement version.
- The Manager on that same farm had zero notices matching that version. The
  other Owner had a separate farm and zero matching notices.
- This was sequential HTTP readback. Concurrent retry/delivery races were not
  tested. No business data or files were changed by the readback; no email or
  provider was called, and no PII or secret was printed.

## Workspace and changed files

This used the existing shared checkout. No branch/worktree, commit, push,
migration, OpenAPI refresh or `backend/target` operation was made by this agent.
The QA backend was used only for authenticated reads described above. The intended
files for this slice are:

- `backend/src/main/java/vn/edu/fpt/beefcare/service/AnnouncementNotificationOutboxHandler.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/service/InternalRequestNotificationOutboxHandler.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/service/InternalRequestCompletionNotificationOutboxHandler.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/service/InternalSupportRequestService.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/service/SupportTicketCommandService.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/service/SupportTicketNotificationRecipientResolver.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/service/NotificationTargetAccessService.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/service/NotificationService.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/repository/AnnouncementRecipientRepository.java`
- `backend/src/test/java/vn/edu/fpt/beefcare/service/AnnouncementNotificationOutboxHandlerTest.java`
- `backend/src/test/java/vn/edu/fpt/beefcare/service/InternalRequestNotificationOutboxHandlerTest.java`
- `backend/src/test/java/vn/edu/fpt/beefcare/service/InternalRequestCompletionNotificationOutboxHandlerTest.java`
- `backend/src/test/java/vn/edu/fpt/beefcare/service/NotificationTargetAccessServiceTest.java`
- `backend/src/test/java/vn/edu/fpt/beefcare/service/SupportTicketWorkflowTest.java`
- `backend/src/test/java/vn/edu/fpt/beefcare/service/NotificationServiceTest.java`
- `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/NotificationResourceH2IT.java`
- `backend/src/test/java/vn/edu/fpt/beefcare/web/rest/NotificationResourceIT.java`
- `docs/testing/JOB07_HANDOFF.md`
