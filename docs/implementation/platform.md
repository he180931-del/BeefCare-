# Platform and identity implementation traceability

Source of truth: `docs/requirements/SRS_2026-10-28.txt` and its companion ERD/database delta. This page records the backend behavior implemented in this workstream. “Partial” means at least one required flow or an acceptance condition is still missing; it is not a release approval.

## FE-01 — Authentication and account access

| SRS use case | Backend implementation | Verification | Status |
|---|---|---|---|
| UC-FE01-01 registration and Owner profile | `IdentityService.register`, `GoogleIdentityService.provisionOrLink`, `AccountResource.registerAccount`, `AccountResource.completeOwnerRegistration`; token hash in `AccountLinkToken`; 24-hour single-use email link; activation creates the session and redirects to the configured front end; terms acceptance; Owner profile completion remains separate from farm registration | `GoogleIdentityServiceTest` added; owner-profile/activation-flow tests added but not run | Partial: Google login requires environment credentials and tests are pending |
| UC-FE01-02 password sign-in | `/api/csrf`, `/api/authenticate`, cookie session, active-account recheck, remember-me session duration; lockout state on `User`; suspended/password-disabled account prechecks | `AuthenticateControllerIT.loginRequiresCsrfAndCreatesReusableHttpSession`, session revocation cases; lockout test added but not run | Partial until Google OIDC and boundary tests pass |
| UC-FE01-03 sign-out | CSRF-protected `/api/logout`; invalidate session and clear cookies | `AuthenticateControllerIT.logoutInvalidatesTheServerSessionAndClearsItsCookie`; pending focused integration run | Implemented for password session |
| UC-FE01-04 profile | `/api/account/profile` read/update of safe name and phone fields, password/Google method indicators; email changes rejected until a verified change-email workflow exists | Source review; integration test pending | Partial: role/permission summary not yet attached to profile response |
| UC-FE01-05 forgotten password | 30-minute single-use SHA-256 token, generic request response, rate limit of five link emails per hour, password confirmation/policy and session revocation; `/api/account/reset-password/validate` | Source review; focused integration tests pending | Partial: resend/reset-link lifecycle lacks end-to-end test |
| UC-FE01-06 password change | current-password check, password policy/confirmation and other-session expiry | `IdentityService.changePassword`; focused integration test pending | Partial |

Identity schema changes are in `20261028000100_identity_security.xml` and `20261028000008_password_login_method.xml`; the latter keeps existing password identities enabled by default. Link signing/dispatch uses `ActionLinkSigner`, `EmailDeliveryJobService`, and `20261028000120_durable_mail_dispatch.xml`; `MailService.queueSupportTicketUpdate(ticketId)` is the FE-20 notification hook. Google OIDC can be enabled with `BEEFCARE_GOOGLE_ENABLED=true` and server-side Spring OAuth client properties; it is off by default. Session cookies use HttpOnly, SameSite=Lax, CSRF tokens, an eight-hour idle session and a 30-day remembered session. Application routes outside the implemented allowlist are denied.

## FE-03 — Membership and platform roles

| SRS use case | Backend implementation | Verification | Status |
|---|---|---|---|
| UC-FE03-01 send member invitation | `FarmMembershipService.invite`; Owner-only; ACTIVE service; fixed Manager/Technician roles; 3/7/14-day expiration; hashed token; token-bearing Vietnamese mail is a durable job | `FarmMembershipServiceTest` planned; Maven pending | Partial: delivery retry/source mismatch tests are not run |
| UC-FE03-02 view invitations | Owner-scoped `/api/farms/{farmId}/invitations`; optional status filter | Test planned | Partial |
| UC-FE03-03 resend/cancel | same invitation row; resend rotates the token and restarts expiry; cancel allowed when farm is inactive; expected-version check | Test planned | Partial |
| UC-FE03-04 accept invitation | verified active account must match invited email; ACTIVE farm; one membership row; accepted-token replay returns existing membership | Test planned | Partial: UI handoff and notification retry remain |
| UC-FE03-06 change role/deactivate/reactivate | owner-only fixed roles; reasons, effective dates, optimistic version; deactivation allowed when inactive; other changes require ACTIVE service; Owner row immutable | `FarmMembershipServiceTest` planned | Partial |
| UC-FE03-07 account list/detail; UC-FE03-08 suspend/restore; UC-FE03-09 platform staff role access | `PlatformAccountAdministrationService` exposes active-account search/detail/history, reasoned suspend/restore, and versioned platform access grant/change/revoke/restore; verified-email and last-active-SA guard | `PlatformAccountAdministrationServiceTest` added; pending run | Partial: workflow/API integration coverage and user reassignment remain |

Endpoints: `GET /api/farms/{farmId}/members`; `GET/POST /api/farms/{farmId}/invitations`; `POST /api/farms/{farmId}/invitations/{invitationId}/resend|cancel`; `PUT /api/farms/{farmId}/members/{membershipId}`; authenticated `GET/POST /api/invitations/accept`.

`20261028000110_membership_lifecycle.xml` adds invitation token metadata and member effective-date/reason/version fields. `20261028000120_durable_mail_dispatch.xml` adds link nonces and the retryable email job table. Invitation/account tokens are never returned in API DTOs or persisted in raw form. Platform access is storage-backed and rechecked on every protected command; `IdempotencyCommandService.executePlatform(...)` requires a named role before both replay lookup and execution.

## FE-02, FE-17, FE-19, FE-21 and FE-22

| Area | Current backend support in this workstream | Status |
|---|---|---|
| FE-02 service transition support | `FarmAccessService` enforces ACTIVE operational access with owner information exceptions; PM farm search/status commands support reasoned suspend/restore with audit; `SubscriptionLifecycleJob` recalculates coverage every 15 minutes and preserves SUSPENDED | Focused integration pending | Partial: coverage-boundary and transition tests/history views remain |
| FE-17 platform audit history | `AuditService` plus SA-only search/detail APIs; bounded allowlisted details and date/action/actor/target filters | Focused query tests pending | Partial: broader export and large-result behavior remain |
| FE-19 subscription and payments | versioned plan prices, immutable quote/account/environment snapshots, payment request/history/receipt views, authenticated SePay HMAC intake, local same-pipeline simulator, exact-match reconciliation, duplicate/replay protection, PM manual evidence review/return workflow, SePay transaction lookup; JOB-03 expires quotes and JOB-04 evaluates coverage | `SePayPaymentFlowTest` covers duplicate/conflict, late in-window settlement, and expiry boundary; signature tests cover exact raw bytes and ±300-second window; pending H2/PG run | Partial: renewal notice JOB-05, full endpoint coverage and operational reporting remain |
| FE-21 platform finance and reports | Added PM-only draft/edit/discard/post/void/replacement workflows for manual finance, immutable history and bank-transaction claims, report snapshots with seven-day expiry and Summary/Details XLSX export from the stored snapshot. Migration `20261028000150_platform_finance_workflows.xml` is wired in master. Subscription receipt amounts and accepted bank-paid dates feed reports. SePay acceptance rejects a transaction already posted as manual income. | No finance tests have run; PostgreSQL application of 00150 and workbook opening/round-trip validation are pending | Partial: compile/runtime validation, history and workflow tests, category configuration review, report scope/API tests, snapshot purge job, and bank-source concurrency tests remain |
| FE-22 public landing and current prices | Public landing summary and current published plan prices are served by unauthenticated read-only APIs | Focused API tests pending | Partial: editable landing content administration, field completeness/content review, and API tests remain |

External payment/email/OIDC configuration must use environment-backed placeholders. SePay live intake is implemented but remains disabled unless live webhook/account settings are supplied; local events use a MOCK namespace and local PM-only simulator. No production credential is committed.

## Handoff validation status

The latest main-source compile reported by the root task passed before the last payment lifecycle and finance changes. The last known PostgreSQL startup had applied the earlier 164 changesets and was applying migration 00150; finance entity/service/resource code added after that checkpoint still needs a compile and PostgreSQL startup. Do not treat FE-21 or FE-19 as complete based on source presence alone. FE-01 end-to-end activation/reset/password-lockout/session tests and profile role-summary fields are also outstanding. No feature tests for platform accounts, audit queries, plan publishing, public landing, manual finance, report snapshots/XLSX, payment lifecycle jobs, or SePay settlement have been confirmed passing in the current handoff.

Known operational setup still required before production: trusted frontend/backend base URLs, random email link-signing secret, SMTP credentials and authorized sender, Google OIDC client credentials/callback registration if enabled, and SePay LIVE environment, receiving-account namespace/account details, webhook HMAC secret and API token. Local Mailpit and MOCK SePay remain the development adapters.
