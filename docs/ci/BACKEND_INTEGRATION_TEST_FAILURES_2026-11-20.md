# Backend integration test failure inventory

Date: 2026-11-20

Source branch: `dev` at `96ef845`

Analysis branch: `codex/cicd-production-refresh`

Runtime: JDK 25, Maven Failsafe, Spring Boot 3.5.3

## Executive summary

The interrupted full backend integration run executed 874 tests before it was stopped after the JVM exhausted its 1 GiB heap. Failsafe reported:

- 403 assertion failures;
- 86 test errors;
- 489 total failed/error test cases.

These are backend integration-test failures. The frontend typecheck, test suite, and production build passed separately. The failures do not by themselves prove 489 production defects: most occur in generated or legacy test setup before current business behavior is exercised.

## Exact failure categories

| Category | Count | Meaning |
| --- | ---: | --- |
| HTTP 403 security mismatch | 393 failures | Legacy tests use generic `@WithMockUser`, omit a real domain account, or omit CSRF on commands. |
| Stale entity fixture/validation | 72 errors | Test factories do not populate fields or relationships that are now mandatory. |
| Spring context cascade | 10 errors | Contexts fail after the test JVM becomes resource constrained. |
| Legacy mail expectation | 7 failures | Tests still verify `JavaMailSender.send`, while test profiles use the in-memory `MockEmailDelivery` path. |
| JVM heap exhaustion | 2 errors | The full suite exhausts `-Xmx1G` after loading many Spring contexts. |
| Other HTTP status mismatch | 3 failures | Two SPA tests expect 403 instead of 404; one farm test expects 200 instead of 404. |
| Other setup errors | 2 errors | One missing Vietnamese mail message and one null farm ID in a legacy fixture. |
| **Total** | **489** | **403 failures + 86 errors** |

## Scope by feature

| Feature area | Count | Affected test classes | Primary cause |
| --- | ---: | --- | --- |
| Accounts and platform access | 77 | `AppUserResourceIT`, `AuthorityResourceIT`, `PublicUserResourceIT`, `PlatformStaffAccessResourceIT`, `InternalRequestResourceIT`, `ManagerPermissionResourceIT` | Security setup is behind the current account and authorization model. |
| Plans and subscription payments | 28 | `PlanVersionResourceIT`, `SubscriptionPaymentRequestPostgresIT`, `SubscriptionPaymentTransactionPostgresIT` | 19 security mismatches plus 9 context/heap errors. |
| Notifications | 3 | `NotificationResourceH2IT` | Context failures after resource exhaustion. |
| Farm setup and master data | 55 | `FarmResourceIT`, `BreedResourceIT`, `ProductionPurposeResourceIT` | 52 security mismatches, one stale fixture, one null ID, and one 404 mismatch. |
| Herd growth | 21 | `GrowthResourceIT` | Legacy security setup returns 403 before report behavior is reached. |
| Health, medicine, and schedules | 73 | `HealthCaseResourceIT`, `HealthObservationResourceIT`, `MedicineResourceIT`, `ScheduledDoseResourceIT` | 69 security mismatches and four stale fixtures. |
| Reproduction and calving | 87 | `CalfOutcomeResourceIT`, `CalvingEventResourceIT`, `PregnancyEpisodeResourceIT`, `PregnancyUpdateResourceIT`, `ReproductionEventResourceIT` | 61 security mismatches and 26 stale fixtures. |
| Finance and payments | 94 | `BankTransferEvidenceResourceIT`, `CashReportSnapshotResourceIT`, `EvidenceReviewResourceIT`, `ManualFinanceRecordResourceIT`, `PaymentResourceIT` | 53 security mismatches and 41 stale fixtures. |
| Announcements and reminders | 41 | `AnnouncementRecipientResourceIT`, `AnnouncementVersionResourceIT`, `FarmAnnouncementResourceIT`, `ReminderResourceIT`, `ReminderParameterResourceIT` | Legacy security setup. |
| Email | 8 | `MailServiceIT` | Seven direct SMTP mock expectations and one missing `vi` message. |
| SPA routing | 2 | `SpaWebFilterIT` | Expected status is 403, current behavior is 404. |

## Root-cause evidence

### Security and CSRF

Current security uses a cookie CSRF repository and applies CSRF protection to commands except the explicit SePay webhook exclusions. Modern integration tests create a persisted domain user and attach both that user and a CSRF token. Many generated resource tests instead use class-level `@WithMockUser` and submit POST, PUT, PATCH, or DELETE requests without CSRF. GET tests can also be rejected when the generic security principal has no matching active BeefCare account.

This group is test-harness debt first. After the shared security setup is corrected, the tests must be rerun before deciding whether any endpoint has a production authorization defect.

### Entity fixtures

The affected factories create entities according to an older persistence model. Hibernate validation now rejects them for missing required fields or relationships before the controller assertion runs. The highest-volume classes are:

- `EvidenceReviewResourceIT`: 17 errors;
- `PregnancyUpdateResourceIT`: 17 errors;
- `PregnancyEpisodeResourceIT`: 6 errors;
- `BankTransferEvidenceResourceIT`: 6 errors;
- `ManualFinanceRecordResourceIT`: 6 errors;
- `PaymentResourceIT`: 6 errors;
- `CashReportSnapshotResourceIT`: 6 errors.

These fixtures should be reconciled with current entity validation and API ownership rules. Do not simply make production fields nullable to satisfy old tests.

### Email refactor

`MailServiceIT` still mocks and verifies `JavaMailSender`. Current test profiles route delivery through `MockEmailDelivery` and the durable email-job flow. The old tests should be replaced with assertions against the current delivery abstraction and persisted job behavior. One additional error comes from the missing `email.test.title` message for locale `vi`.

### Test process memory

The full Failsafe run loads many distinct Spring contexts and Testcontainers schemas into a single JVM capped at 1 GiB. It eventually throws `OutOfMemoryError: Java heap space`, after which later context failures are not reliable feature evidence. Once functional test debt is repaired, split the suite by feature or fork the JVM; increase heap only as a supporting measure.

## Current required CI gate

The CI workflow does not hide failures with `continue-on-error`. It currently runs:

- all 1,104 backend unit tests;
- 22 selected integration smoke tests;
- the complete frontend API/unit/integration test commands;
- frontend typecheck and production build;
- backend Docker image build.

The 22 backend integration smoke tests are:

| Class | Tests | Database/coverage |
| --- | ---: | --- |
| `ReportsAndAuditIT` | 3 | Spring persistence, reports, permissions, audit |
| `HibernateTimeZoneIT` | 7 | Spring persistence and date/time mapping |
| `FarmInvitationPostgresIT` | 11 | PostgreSQL 16 Testcontainers, Liquibase, invitation transactions |
| `AppUserCreatedAtMigrationPostgresIT` | 1 | PostgreSQL 16 Testcontainers and Liquibase upgrade/readback |

A green required CI check therefore proves the configured build and smoke gate, not that the full legacy Failsafe suite is green.

## Recommended repair order

1. Introduce or reuse one current integration-test principal helper that creates an active domain user and adds CSRF to command requests.
2. Migrate generated resource tests feature by feature to the helper; keep explicit negative authorization tests separate.
3. Update fixture factories for current required fields and relationships, starting with finance and reproduction.
4. Replace obsolete direct-SMTP assertions with email-job and `MockEmailDelivery` assertions.
5. Reconcile the three deliberate 403/404/200 status expectations with the current API contract.
6. Split or fork the full integration suite and rerun it with clean Failsafe reports.
7. Only delete a test when its endpoint or behavior has been intentionally removed and equivalent current coverage exists.

## Reproduction commands

Required backend gate:

```bash
./mvnw --batch-mode '-Pdev,!webapp' \
  -Dspotless.skip=true \
  -Dmodernizer.skip=true \
  test

./mvnw --batch-mode '-Pdev,!webapp' \
  -Dspotless.skip=true \
  -Dmodernizer.skip=true \
  -Dit.test=HibernateTimeZoneIT,ReportsAndAuditIT,FarmInvitationPostgresIT,AppUserCreatedAtMigrationPostgresIT \
  failsafe:integration-test failsafe:verify
```

Full legacy suite audit:

```bash
./mvnw --batch-mode '-Pdev,!webapp' \
  -Dspotless.skip=true \
  -Dmodernizer.skip=true \
  verify
```

Run the full audit from a clean `target` directory when producing a new inventory so stale XML reports cannot be mixed with the current run.
