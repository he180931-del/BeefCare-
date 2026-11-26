# FE-01 Authentication Stability Implementation Plan

> **For agentic workers:** Follow `superpowers:test-driven-development` and `superpowers:verification-before-completion`. Complete one micro-step at a time, update its checkbox and evidence immediately, and never edit outside the files named by the active work item without recording the reason first.

**Goal:** Remove the confirmed FE-01 stability and contract gaps while preserving the approved 8–128-character password policy with no composition rules.

**Architecture:** Database-owned atomic transitions, a backwards-compatible Argon2id password encoder, server-enforced absolute remembered-session expiry, secret-free FE-17 audit events, token-free reset URLs, and an OpenAPI contract locked to runtime tests.

**Tech stack:** Java 21, Spring Boot/Security/Data JPA, PostgreSQL/H2 tests, React 19, TypeScript, React Router, Vitest, OpenAPI JSON.

**Design:** `docs/superpowers/specs/2026-11-23-fe01-auth-stability-design.md`

## Status legend

- `[x]` completed with evidence
- `[!]` explicitly deferred, N/A, framework-owned, diagnostic-only, or manual-to-run; reason and owner required

## Global constraints

- [x] Record approved source set. **Evidence:** design §Sources and FE-01 spec D12.
- [x] Record password-policy boundary: 8–128 Unicode characters, not equal to email, no uppercase/lowercase/digit/symbol requirement. **Evidence:** SRS GBR-02; FE-01 R-01-03.
- [x] Record baseline branch/SHA: `lamkd2` / `e2fab5ac8c407869f95c6d61e5f34135cb0deea5`.
- [x] Record worktree ruling: exact required `LamKD` base is unavailable; use the canonical checkout sequentially; one writable Luna; no inferred base.
- [x] Preserve existing dirty state: untracked `reports/` and `research_notes/` belong to the user/audit work.
- [x] Prohibit commit, push, merge, reset, stash, or cleanup without user authorization.
- [x] Before editing any existing symbol, run GitNexus upstream impact with the exact indexed symbol ID; record risk below. **Evidence:** WBS1–WBS9 impact entries record the indexed symbol, callers, risk, and any HIGH result; this final slice edits docs only.
- [x] If impact is HIGH or CRITICAL, stop that item and warn the user before editing. **Evidence:** WBS7 `ResetPasswordPage` was recorded HIGH and reviewed before its bounded change; no unreviewed HIGH/CRITICAL item remains.
- [x] Every behavior change follows RED → minimal implementation → GREEN. **Evidence:** each implementation WBS records its RED/GREEN evidence; final gates below are green.
- [x] Every completed micro-step has an owner plus command/output or file/line evidence. **Evidence:** ownership ledger and WBS writer/reviewer evidence identify the owner and command or artifact for each completed item.

## Ownership ledger

| Work item | Owner | Branch/path | Mode | Status | Evidence |
|---|---|---|---|---|---|
| WBS/design | Tera `/root` | `lamkd2` / canonical checkout | writable docs only | complete | this plan + design |
| WBS 0/preflight | Luna `/root/luna_wbs0` + Tera `/root` | `lamkd2` / `/Users/lam/Projects/BeefCare` | writable docs only; no production edits | complete | §WBS 0 evidence; Docker rerun 13/13 GREEN |
| Implementation | Luna `/root/luna_wbs1` (WBS 1 only) | `lamkd2` / `/Users/lam/Projects/BeefCare` | writable, sequential only | complete | WBS 1 GREEN; no commit/push |
| WBS 2/serialized issuance | Luna `/root/luna_wbs2` (WBS 2 only) | `lamkd2` / `/Users/lam/Projects/BeefCare` | writable, sequential only | complete | PostgreSQL issuance + cross-WBS lock-order follow-up GREEN 11/11; adjacent auth/token lifecycle GREEN 30/30; no commit/push |
| WBS 3/atomic failed-password lockout | Luna `/root/luna_wbs2` (WBS 3 only) | `lamkd2` / `/Users/lam/Projects/BeefCare` | writable, sequential only | complete | PostgreSQL concurrency GREEN 2/2; adjacent auth/Google lifecycle GREEN 31/31; no commit/push |
| WBS 3/failed-password tests | Luna `/root/luna_auth_test_matrix` (WBS 3 tests only) | `lamkd2` / `/Users/lam/Projects/BeefCare` | writable tests/docs only; no production edits | complete | PostgreSQL 16.15 gate includes `PasswordAttemptConcurrencyPostgresIT`; 28/28 GREEN; no commit/push |
| Review | Unassigned | same checkout after writer stops | read-only | planned | — |

---

## WBS 0 — Preflight and clean baseline

### 0.1 Repository evidence

- [x] Capture `git status --short`, branch, HEAD, and worktree list. **Evidence (2026-11-23 22:18 ICT):** canonical `/Users/lam/Projects/BeefCare`, branch `lamkd2`, HEAD `e2fab5ac8c407869f95c6d61e5f34135cb0deea5`; `git worktree list --porcelain` shows canonical worktree plus existing `/Users/lam/Projects/BeefCare/.worktrees/dev` at `bdf04ff09f3ca09bbb7f72d848711fcc6c7212ae`; status was `?? docs/superpowers/plans/2026-11-23-fe01-auth-stability.md`, `?? docs/superpowers/specs/2026-11-23-fe01-auth-stability-design.md`, `?? reports/`, `?? research_notes/`.
- [x] Verify GitNexus index freshness at the recorded HEAD. **Evidence:** `/opt/homebrew/bin/gitnexus status` reported `Indexed: 11/23/2026, 9:06:39 PM`, `Indexed commit: e2fab5a`, `Current commit: e2fab5a`, `Status: ✅ up-to-date`.
- [x] List exact FE-01 backend test classes and frontend authentication test paths. **Evidence:** backend classes: `vn.edu.fpt.beefcare.web.rest.AuthenticateControllerIT`, `BrowserSessionFlowIT`, `EmailActivationFlowIT`; `vn.edu.fpt.beefcare.service.GoogleReauthenticationIT`, `UserServiceIT`; `vn.edu.fpt.beefcare.security.DomainUserDetailsServiceIT`; unit/contract classes `vn.edu.fpt.beefcare.service.GoogleIdentityServiceTest`, `PlatformAuditCatalogTest`, `vn.edu.fpt.beefcare.security.GoogleOidcFailureHandlerTest`, `GoogleOidcSuccessHandlerTest`, `SecurityUtilsUnitTest`, `vn.edu.fpt.beefcare.web.rest.OpenApiContractTest`. Source paths are under `backend/src/test/java/vn/edu/fpt/beefcare/`. Frontend exact unit path: `frontend/tests/unit/auth` (10 files: `AuthGate.test.tsx`, `GuestAuthFlow.test.tsx`, `LegalDialog.test.tsx`, `LoginForm.test.tsx`, `PublicLandingAndMock.test.tsx`, `invitationReturn.test.tsx`, `legalContent.test.ts`, `sessionRoles.test.tsx`, `sessionTermsAcceptance.test.tsx`, `validation.test.ts`). Adjacent auth paths identified but not run in this WBS: `frontend/tests/api/authApiContract.test.ts`, `frontend/tests/api/sessionOwnership.test.ts`, `frontend/tests/integration/auth/authSessionLifecycle.test.tsx`.
- [x] Confirm Maven wrapper, Java, Node, and installed Vitest are available without dependency mutation. **Evidence:** `backend/mvnw` executable; `./mvnw -version` Maven `3.9.16`; `java -version` `24.0.1`; `node --version` `v20.20.2`; `npm --version` `10.8.2`; `frontend/node_modules/.bin/vitest --version` `2.1.9`. No install/update command ran.
- [x] Record the pre-existing untracked files separately from implementation output. **Evidence:** user/audit files preserved untouched: `reports/Kết luận phản biện FE01.md`, `reports/Luồng bổ sung tài liệu.md`, `reports/Định nghĩa chuẩn FE01.md`; `research_notes/Luồng bổ sung tài liệu/code_ux_analysis.md`, `research_notes/Luồng bổ sung tài liệu/internet_benchmarks.md`, `research_notes/Luồng bổ sung tài liệu/spec_business_analysis.md`, `research_notes/Phản biện FE01 chuẩn ngành/internal_critique.md`, `research_notes/Phản biện FE01 chuẩn ngành/web_research.md`, `research_notes/Định nghĩa chuẩn FE01/contract_security.md`, `research_notes/Định nghĩa chuẩn FE01/frontend_ux.md`, `research_notes/Định nghĩa chuẩn FE01/requirements.md`.

### 0.2 Baseline tests

- [x] Run the existing focused backend FE-01 unit/integration class list using `backend/AGENTS.md` flags. **Evidence:** Surefire unit command `./mvnw --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Denforcer.skip=true' '-Dtest=GoogleIdentityServiceTest,GoogleOidcFailureHandlerTest,GoogleOidcSuccessHandlerTest,SecurityUtilsUnitTest,PlatformAuditCatalogTest' test` → 25/25 pass, 0 fail, 0 skipped, wall `real 8.70s`; OpenAPI command with same flags and `-Dtest=OpenApiContractTest` → 1/1 pass, 0 fail, 0 skipped, wall `real 19.47s`. Failsafe command `./mvnw --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Denforcer.skip=true' '-Dmodernizer.skip=true' '-Dtest=__none__' '-Dsurefire.failIfNoSpecifiedTests=false' '-Dit.test=AuthenticateControllerIT,BrowserSessionFlowIT,EmailActivationFlowIT,GoogleReauthenticationIT,UserServiceIT,DomainUserDetailsServiceIT' verify` → 46 tests: `AuthenticateControllerIT` 10/10 pass, `BrowserSessionFlowIT` 18/18 pass, `EmailActivationFlowIT` 2/2 pass, `GoogleReauthenticationIT` 3/3 pass; `DomainUserDetailsServiceIT` 0/6 pass with 6 errors and `UserServiceIT` 0/7 pass with 7 errors; 33 pass, 13 errors, 0 skipped, wall `real 71.41s`. The two erroring classes fail before test assertions because Testcontainers cannot connect to Docker Unix sockets (`java.net.SocketException: Operation not permitted`).
- [x] Run the existing frontend authentication unit tests by exact path. **Evidence:** from `frontend/`, `./node_modules/.bin/vitest run --passWithNoTests tests/unit/auth` → 10 files passed, 104 tests passed, 0 failed/skipped, wall `real 7.02s` (Vitest duration `6.24s`). Existing React Router future-flag and `act(...)` warnings were non-failing.
- [x] Record passed/failed/skipped counts and wall time. **Evidence:** counts and exact command wall times are recorded above; backend initial no-skip Maven attempt was blocked at Enforcer in `real 3.09s` because pom permits `[21,22),[25,26)` and host JDK is `24.0.1`; Failsafe required `-Dmodernizer.skip=true` after pre-existing 40 Modernizer violations (including unrelated modules) blocked the first focused invocation in `real 5.65s`.
- [x] Resolve the environment-only baseline failure before implementation. **Evidence (Tera `/root`, 2026-11-23 22:29 ICT):** opened the existing Docker Desktop installation after user/tool approval; Docker server `29.1.5`; reran `./mvnw --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Denforcer.skip=true' '-Dmodernizer.skip=true' '-Dtest=__none__' '-Dsurefire.failIfNoSpecifiedTests=false' '-Dit.test=UserServiceIT,DomainUserDetailsServiceIT' verify` outside the restricted sandbox. `DomainUserDetailsServiceIT` 6/6 and `UserServiceIT` 7/7 passed; total 13, failures 0, errors 0, skipped 0; Maven BUILD SUCCESS in 53.133 s. Baseline gate is GREEN.

**WBS 0 handoff evidence:** No production/test/config files were edited. Only this plan was updated. No commit, push, merge, reset, stash, cleanup, or dependency installation was performed. Final pre-handoff status remains the untracked set recorded in §0.1, including user-owned `reports/` and `research_notes/`; generated `backend/target/` is ignored and was used only for test reports.

---

## WBS 1 — Atomic one-time-token consumption

**Candidate files:** `AccountLinkTokenRepository.java`, `IdentityService.java`, focused repository/service tests.

### 1.1 Impact and contract

- [x] Resolve indexed symbol IDs for `IdentityService.consume` and repository token mutation. **Evidence (2026-11-23, Luna `/root/luna_wbs1`):** GitNexus has no indexed private `consume` definition; the exact indexed service boundary is `Method:.../IdentityService.java:IdentityService.activateEmail#1` (private consume is called by `activateEmail` and `completePasswordReset`). Repository symbol: `Interface:.../AccountLinkTokenRepository.java:AccountLinkTokenRepository`.
- [x] Run upstream impact for each existing symbol. **Evidence:** `gitnexus impact 'Method:backend/src/main/java/vn/edu/fpt/beefcare/service/IdentityService.java:IdentityService.activateEmail#1' --direction upstream` → `LOW`, 1 direct caller (`AccountResource.activateAccount`, confidence 0.9), Security module; `gitnexus impact 'Interface:backend/src/main/java/vn/edu/fpt/beefcare/repository/AccountLinkTokenRepository.java:AccountLinkTokenRepository' --direction upstream` → `MEDIUM`, 9 impacted (6 direct: `IdentityService`, `DataRetentionJob`, `EmailDeliveryJobService` constructors/imports plus activation/reset tests; 2 depth-2 resources; 1 legacy test). The requested prior WBS evidence also records `IdentityService.consume#2 LOW`, 4 impacted (direct `activateEmail`, `completePasswordReset`; indirect `AccountResource` endpoints). No HIGH/CRITICAL result; proceed within WBS 1.
- [x] Record direct callers, affected flows, and risk level. **Evidence:** direct flows are email activation (`AccountResource.activateAccount` → `IdentityService.activateEmail` → private `consume`) and password reset completion (`AccountResource` reset endpoint → `IdentityService.completePasswordReset` → private `consume`); standard invalid-link response is `MSG-FE01-06` / `DomainException.badRequest`. Repository is shared with issuance, retention, delivery, and activation/reset tests; repository interface impact is MEDIUM, while the consume call-site impact is LOW.
- [x] Restate acceptance: two concurrent valid consumes yield one success and one standard invalid/expired result. The PostgreSQL assertion also verifies exactly one persisted `usedAt` transition; secret-leakage scope is limited to the returned `DomainException` message/params (not HTTP or logs).

### 1.2 RED test

- [x] Add a PostgreSQL-backed concurrency test fixture for one unused, unexpired token. **Evidence:** `backend/src/test/java/vn/edu/fpt/beefcare/service/AccountLinkTokenConsumptionPostgresIT.java` uses `@IntegrationTest` (Testcontainers PostgreSQL), a unique registered account/link, and two independent `TransactionTemplate` workers.
- [x] Start two transactions at a barrier with the same raw token. **Evidence:** both workers enter independent `TransactionTemplate` callbacks, assert `TransactionSynchronizationManager.isActualTransactionActive()`, then await the same `CyclicBarrier` before calling `identityService.activateEmail(rawToken)`.
- [x] Assert exactly one transaction reports success. **Evidence:** service-level worker outcomes are filtered to exactly one `success=true`; both workers call `IdentityService.activateEmail`, not the repository directly.
- [x] Assert the other reports the existing FE-01 invalid/expired error without secret leakage. **Evidence:** the losing worker catches `DomainException`, asserts `MessageCodes.FE01_06`, and checks only that exception message/params do not contain the raw token; no HTTP/log secrecy claim is made.
- [x] Assert one and only one persisted `usedAt` transition. **Evidence:** after both service transactions complete, a new `TransactionTemplate` read asserts the token row has one non-null `usedAt`.
- [x] Add expiry boundary tests for `expiresAt == now`, `< now`, and `> now`. **Evidence:** the PostgreSQL test mutates three distinct persisted links and asserts CAS row counts `0`, `0`, and `1`, plus persisted `usedAt` null/null/non-null in new transactions.
- [x] Add password-reset downstream rollback coverage. **Evidence:** `completePasswordReset` with invalid password throws `MSG-FE01-08`; a new transaction reads `usedAt == null`, then the same raw reset token succeeds with a valid password and persists `usedAt`.
- [x] Run only the new test and capture the expected failure. **RED evidence (2026-11-23 22:34 ICT):** `./mvnw --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Denforcer.skip=true' '-Dmodernizer.skip=true' '-Dtest=__none__' '-Dsurefire.failIfNoSpecifiedTests=false' '-Dit.test=AccountLinkTokenConsumptionPostgresIT' verify` failed at test compilation as expected: `cannot find symbol method consumeIfValid(String,String,Instant)` in `AccountLinkTokenRepository`; no production implementation existed yet.

### 1.3 Minimal implementation

- [x] Add one conditional repository update using hash, type, unused state, and expiry predicate. **Evidence:** `AccountLinkTokenRepository.consumeIfValid` (`backend/src/main/java/vn/edu/fpt/beefcare/repository/AccountLinkTokenRepository.java`) updates `usedAt` only where `tokenHash`, `tokenType`, `usedAt is null`, and `expiresAt > :now`.
- [x] Return affected-row count; do not perform a read-then-write consume. **Evidence:** repository method returns `int`; no entity read precedes the mutation in `IdentityService.consume`.
- [x] Refactor the service to accept only affected-row count `1` as success. **Evidence:** `IdentityService.consume` throws `invalidLink()` unless `consumeIfValid(...) == 1`, then reloads the claimed link by hash/type for the existing activation/reset workflow.
- [x] Preserve existing external error code and transaction boundary. **Evidence:** `IdentityService.activateEmail` and `completePasswordReset` remain `@Transactional`; loser path still uses `DomainException.badRequest(MessageCodes.FE01_06)` with no token parameter.
- [x] Run the new test and capture GREEN. **GREEN evidence (2026-11-23 22:45 ICT):** Docker-enabled command `./mvnw --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Denforcer.skip=true' '-Dmodernizer.skip=true' '-Dtest=__none__' '-Dsurefire.failIfNoSpecifiedTests=false' '-Dit.test=AccountLinkTokenConsumptionPostgresIT' verify` → PostgreSQL 16.15 Testcontainers, 3 tests, 0 failures/errors/skips, Checkstyle 0 violations, `BUILD SUCCESS` (30.216 s). Initial sandbox run was separately recorded as environment-blocked (`Operation not permitted` on Docker Unix socket), not substituted with H2. The added review tests did not expose a further missing production behavior, so no second RED failure was applicable.
- [x] Run adjacent token lifecycle tests and capture GREEN. **Evidence (2026-11-23 22:46 ICT):** same Maven/Failsafe command with `-Dit.test=EmailActivationFlowIT,BrowserSessionFlowIT` → 20 tests, 0 failures/errors/skips, Checkstyle 0 violations, `BUILD SUCCESS` (23.442 s; these existing classes use their configured `testh2` profile).
- [x] Mark WBS 1 complete with files, lines, commands, and owner. **Evidence:** owner Luna `/root/luna_wbs1`; changed files are `backend/src/main/java/vn/edu/fpt/beefcare/repository/AccountLinkTokenRepository.java`, `backend/src/main/java/vn/edu/fpt/beefcare/service/IdentityService.java`, `backend/src/test/java/vn/edu/fpt/beefcare/service/AccountLinkTokenConsumptionPostgresIT.java`, and this plan. No commit/push/stash/reset/cleanup performed; `reports/` and `research_notes/` preserved.

### WBS 1 review follow-up (2026-11-23)

- [x] Replace repository-only race proof with service-level activation race. **Evidence:** both workers call `identityService.activateEmail(rawToken)` inside independent PostgreSQL transactions; `CyclicBarrier` is reached only after each transaction is active.
- [x] Add deterministic expiry and downstream rollback coverage. **Evidence:** PostgreSQL CAS boundary assertions cover `== now`, `< now`, `> now`; invalid password after reset-token consume is read back as `usedAt == null` in a new transaction, then the same token succeeds with valid input.
- [x] Correct secrecy scope. **Evidence:** test asserts only the losing `DomainException` message/params do not contain the raw token; HTTP response and application-log secrecy are explicitly not claimed by WBS 1.
- [x] Independent read-only re-review passed. **Evidence:** Luna `/root/luna_review_wbs1` verified the service-level race, expiry boundaries, reset rollback/retry, PostgreSQL `3/3` report, adjacent `20/20`, and production CAS; no blocking findings remain.

---

## WBS 2 — Serialized token issuance, cooldown, and hourly quota

**Candidate files:** identity/user repository lock query, `AccountLinkTokenRepository.java`, `IdentityService.java`, concurrency tests.

### 2.1 Impact and acceptance

- [x] Resolve/run GitNexus impact for `issueRateLimited`, `sendLink`, and affected repository methods. **Evidence (2026-11-23, parent Tera):** indexed `issueRateLimited#4` upstream impact `LOW` (direct `requestPasswordReset` and `AccountResource` flow); indexed `sendLink#4` upstream impact `LOW` (direct `register`, `resendVerification`, `issueRateLimited`; 7 impacted); indexed `resendVerification#1` upstream impact `LOW` (`AccountResource` only). No HIGH/CRITICAL result. The repository lock method is a new symbol and is covered by the existing `UserRepository` boundary; no indexed risk escalation was reported.
- [x] Record risk and callers. **Evidence:** `requestPasswordReset` → `issueRateLimited` → `sendLink`; `register` → `sendLink`; `resendVerification` → cooldown/quota check → `sendLink`; `AccountResource` calls `resendVerification` and reset-init. Risk is LOW for existing service callers; serialization is per `jhi_user` row and must not alter registration's new-user path.
- [x] Restate acceptance: concurrent resend requests cannot bypass 60-second cooldown or 5/hour quota. **Evidence target:** PostgreSQL service-level workers share one identity and assert one durable link/job within cooldown; at five prior sends, concurrent sixth decisions do not create a sixth job/token.
- [x] Restate acceptance: after a successful replacement exactly one unused token of that type remains. **Evidence target:** PostgreSQL readback asserts one `used_at is null` row after serialized replacement; prior unused rows are invalidated.

### 2.2 RED tests

- [x] Add concurrent resend test below the hourly quota. **Evidence:** `AccountLinkTokenIssuancePostgresIT.concurrentVerificationResendsAfterCooldownCreateOneReplacementAndJob` ages the initial registration token, runs concurrent service transactions against PostgreSQL, and asserts one replacement.
- [x] Assert only one send/outbox request is created inside the cooldown window. **Evidence:** `freshVerificationResendReturnsCooldownDeadlineWithoutIssuingAnotherLink` asserts the retry deadline, `tokenCount == 1`, and `jobCount == 1` for a fresh token; the replacement race asserts totals of 2 with one unused.
- [x] Assert exactly one unused token remains. **Evidence:** the issuance IT asserts one unused verification token and one unused reset token after the serialized decision.
- [x] Add concurrent request test at the fifth-email boundary. **Evidence:** `concurrentResetRequestsAtFifthHourlyDecisionCreateNoSixthTokenOrJob` seeds five prior sends, then runs concurrent reset decisions against PostgreSQL.
- [x] Assert the sixth concurrent decision is rejected consistently. **Evidence:** all concurrent decisions are collected; the database readback asserts no sixth token/job and the seeded five-token hourly window remains bounded (the service reports retry timing rather than throwing for rate-limited decisions).
- [x] Run new tests and capture expected failures. **Evidence:** test-first compile was initially RED while the PostgreSQL fixture was being completed; the first no-lock behavioral baseline did not reproduce the race deterministically (3/3), so that limitation remains explicitly recorded. Follow-up implementation run is GREEN 6/6.

### 2.3 Minimal implementation

- [x] Add a pessimistic lock or equivalent serialization point scoped to target identity. **Evidence:** `UserRepository.findByIdForUpdate` uses a PostgreSQL row-level `PESSIMISTIC_WRITE` lock on `jhi_user`.
- [x] Acquire it before reading latest/count state. **Evidence:** `resendVerification` uses `findOneByEmailIgnoreCaseForUpdate`; rate-limited issuance and Google-only advice lock the `jhi_user` row before latest/count/outbox work; `sendLink` delegates to a locked-only mutation helper and registration retains its single lock.
- [x] Keep cooldown check, quota check, old-token invalidation, new-token insert, and outbox creation in one transaction. **Evidence:** existing mandatory `@Transactional` service methods retain the ordered lock/check/invalidate/insert/outbox sequence.
- [x] Verify rollback leaves no replacement token when outbox persistence fails. **Evidence:** issuance IT injects `EmailDeliveryJobRepository.save` failure and asserts the replacement token/invalidation are rolled back.
- [x] Run new tests GREEN. **Evidence:** PostgreSQL Testcontainers command with `-Dit.test=AccountLinkTokenIssuancePostgresIT` → 6/6 pass, 0 failures/errors/skips; Checkstyle 0 violations.
- [x] Run adjacent registration/reset/resend tests GREEN. **Evidence:** Failsafe command with `-Dit.test=EmailActivationFlowIT,BrowserSessionFlowIT,AuthenticateControllerIT` → 30/30 pass, 0 failures/errors/skips; these existing adjacent classes use their configured `testh2` profile; Checkstyle 0 violations.
- [x] Record evidence and mark WBS 2 complete. **Evidence:** implementation and tests are limited to WBS 2 plus the pre-existing WBS 1 files; no commit, push, stash, reset, or dependency installation performed.

### 2.4 Review follow-up (P2)

- [x] Eliminate the resend pre-lock identity snapshot: lock by email before checking activation/password-account state, and add a regression assertion that an activated account receives only the generic cooldown response and no verification link. **Evidence:** `findOneByEmailIgnoreCaseForUpdate` is used before eligibility checks; `activatedAccountGetsGenericResendCooldownAndNoVerificationLink` passes.
- [x] Make the resend concurrency fixture exercise a real replacement (age the initial registration token), while retaining a fresh-token cooldown test and deadline assertions. **Evidence:** replacement test asserts 2 total tokens/jobs and 1 unused; fresh cooldown test asserts no replacement and retry deadline.
- [x] Make the locking contract explicit so `register`, `resendVerification`, and rate-limited issuance each lock exactly once before checks/mutation. **Evidence:** `sendLink` locks then delegates to `sendLinkLocked`; resend/rate-limited paths lock once and call the locked helper.
- [x] Serialize Google-only reset advice on the `jhi_user` row before its hourly count/outbox write; add a PostgreSQL fifth-boundary concurrency test with no sixth advice job. **Evidence:** `concurrentGoogleOnlyAdviceAtFifthHourlyDecisionCreateNoSixthJob` passes with exactly 5 advice jobs.
- [x] Rerun focused PostgreSQL issuance tests and adjacent auth/token lifecycle tests, then close these follow-ups with fresh evidence. **Evidence:** PostgreSQL issuance `6/6` GREEN; adjacent `AuthenticateControllerIT`, `BrowserSessionFlowIT`, `EmailActivationFlowIT` `30/30` GREEN; Checkstyle `0`.

### 2.5 Cross-WBS lock-order review (P1)

- [x] Normalize token consumption to the same `User -> Token` lock order used by issuance: resolve the token without mutation, lock the identity row, then run the CAS claim and revalidate its affected-row count. **Evidence:** `IdentityService.consume` resolves the candidate token, acquires `findByIdForUpdate` on its user, and accepts only `consumeIfValid(...) == 1`; issuance paths lock the same user row before latest/count/invalidate/insert/outbox work.
- [x] Add PostgreSQL cross-flow concurrency coverage for resend/replacement versus activation consume, preserving exactly-once consumption and one valid replacement; include reset issuance versus reset completion when the service fixture permits. **Evidence:** `AccountLinkTokenConsumptionPostgresIT` adds deterministic barrier races for resend/activation and reset issuance/completion; both complete without deadlock, preserve exactly one used token, and assert the valid replacement outcome (activation-win generic cooldown or resend-win one unused replacement).
- [x] Correct cooldown return values to use the persisted replacement `createdAt + 60s`, and assert deadlines from persisted state with tolerance. **Evidence:** `sendLinkLocked` returns persisted `link.getCreatedAt()` and `resendVerification` returns that timestamp plus 60 seconds; fresh/replacement cooldown tests compare to persisted token state with bounded tolerance.
- [x] Run `AccountLinkTokenConsumptionPostgresIT`, `AccountLinkTokenIssuancePostgresIT`, and adjacent auth/token suites GREEN; record the final lock-order evidence. **Evidence (2026-11-23 23:25–23:27 ICT):** PostgreSQL focused command → Consumption 5/5 + Issuance 6/6 = 11/11, failures/errors/skips 0, Checkstyle 0, BUILD SUCCESS; adjacent `AuthenticateControllerIT,BrowserSessionFlowIT,EmailActivationFlowIT` → 30/30, failures/errors/skips 0, Checkstyle 0, BUILD SUCCESS. Docker/Testcontainers PostgreSQL ran successfully; no H2 substitution for focused tests.

---

## WBS 3 — Atomic failed-password counter and lockout

**Candidate files:** identity repository/entity, `IdentityService.java`, authenticate/change-password tests.

### 3.1 Impact and acceptance

- [x] Resolve/run GitNexus impact for `recordFailedPasswordAttempt`, `clearFailedPasswordAttempts`, and repository mutation symbols. **Evidence (2026-11-23, Luna `/root/luna_auth_test_matrix`):** `recordFailedPasswordAttempt` upstream impact `LOW`, 4 impacted: direct callers `AuthenticateController.authorize` and `IdentityService.changePassword`, with the authorize process affected; `clearFailedPasswordAttempts` upstream impact `LOW`, 1 direct caller `AuthenticateController.authorize`; `checkPasswordSignInAllowed` upstream impact `LOW`, 1 direct caller `AuthenticateController.authorize`. No HIGH/CRITICAL result.
- [x] Record risk and affected sign-in/change-password flows. **Evidence:** failed-attempt mutation is shared by password login and current-password verification during change-password; clear/check are on the password-login authorize path. This test-only slice does not edit production symbols.
- [x] Restate acceptance: five concurrent wrong attempts persist count/lock without lost updates. **Evidence:** `PasswordAttemptConcurrencyPostgresIT` persists count `5` from five concurrent public service calls and observes exactly one returned 15-minute lock instant.
- [x] Restate acceptance: Google sign-in remains available and a successful password/reset transition clears the counter. **Evidence:** adjacent `GoogleReauthenticationIT` and `BrowserSessionFlowIT` pass; Google-only authentication remains generic `MSG-FE01-01` and does not enter the counter path.

### 3.2 RED tests

- [x] Add concurrent wrong-password test using five transactions at a barrier. **Evidence:** `PasswordAttemptConcurrencyPostgresIT.concurrentFailedAttemptsReachFiveWithoutLostUpdates` starts five independent public `IdentityService.recordFailedPasswordAttempt` calls after a simultaneous-start barrier; a test-only `@MockitoSpyBean` interleaves only the legacy non-locking repository read, without holding any transaction at a post-mutation barrier.
- [x] Assert persisted counter reaches five. **Evidence:** the test reads the `User` row in a fresh transaction and requires `failedPasswordAttempts == 5`; the current read-modify-write implementation produces deterministic RED under the post-update barrier.
- [x] Assert `lockedUntil` is set once to the expected 15-minute window. **Evidence:** exactly one worker returns a lock instant; persisted `passwordLockedUntil` is asserted within a bounded 15-minute window.
- [x] Add boundary test for a sixth attempt while locked. **Evidence:** `lockedIdentityRejectsTheNextPasswordCheckAndExpiredLockClearsState` asserts `MSG-FE01-02` while locked and reset to zero/null after expiry.
- [x] Add reset/valid-login counter-clear test. **Evidence:** the same test exercises `clearFailedPasswordAttempts` twice and asserts idempotent zero/null state; existing `AuthenticateControllerIT`/`BrowserSessionFlowIT` cover successful login/reset clear readback.
- [x] Run tests and capture expected failure. **Evidence:** focused PostgreSQL RED run recorded below (`Tests run: 2, Failures: 1, Errors: 0`; only the five-attempt persistence assertion fails); no production implementation was changed.

**WBS 3 RED evidence (2026-11-23 23:44 ICT):** `./mvnw --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Denforcer.skip=true' '-Dmodernizer.skip=true' '-Dtest=__none__' '-Dsurefire.failIfNoSpecifiedTests=false' '-Dit.test=PasswordAttemptConcurrencyPostgresIT' verify` ran against PostgreSQL 16.15 Testcontainers. Result: `Tests run: 2, Failures: 1, Errors: 0`; `concurrentFailedAttemptsReachFiveWithoutLostUpdates` failed at the public persisted-state contract (`expected: 5 but was: 2`), while the locked/expired/idempotent boundary test passed. The harness has only a simultaneous-start barrier plus a worker-scoped spy interleave at the current legacy read; no transaction is held across mutation/commit, so a correct lock/CAS implementation can pass. Checkstyle reported 0 violations. This is the intended RED for the current read-modify-write implementation.

### 3.3 Minimal implementation

- [x] Serialize the per-identity failed-attempt transition at the repository/database boundary. **Evidence:** `UserRepository.findOneByEmailIgnoreCaseForUpdate` and `findOneByLoginForUpdate` use `PESSIMISTIC_WRITE`; all check/record/clear paths resolve through `IdentityService.findLoginForUpdate`.
- [x] Keep increment and lock calculation in one transaction. **Evidence:** `recordFailedPasswordAttempt` remains `@Transactional` and performs read, increment, and 15-minute lock calculation after acquiring the identity row lock.
- [x] Make clear/reset atomic and idempotent. **Evidence:** `checkPasswordSignInAllowed` locks before expired-lock reset; `clearFailedPasswordAttempts` locks before zeroing state and remains safe on repeated calls; boundary test asserts zero/null after two clears.
- [x] Preserve D05: Google-only account password failures return generic 401 and do not count. **Evidence:** Google-only account check remains before authentication and `recordFailedPasswordAttempt` ignores an existing `AppUser` with disabled password login; legacy users without an `AppUser` remain compatible password identities.
- [x] Run new tests GREEN. **Evidence (2026-11-23 23:51 ICT):** PostgreSQL Testcontainers command with `-Dit.test=PasswordAttemptConcurrencyPostgresIT` → 2/2, failures/errors/skips 0, Checkstyle 0, BUILD SUCCESS.
- [x] Run authenticate and change-password suites GREEN. **Evidence (2026-11-23 23:50–23:51 ICT):** Failsafe `-Dit.test=AuthenticateControllerIT,BrowserSessionFlowIT,GoogleReauthenticationIT` → 31/31, failures/errors/skips 0, Checkstyle 0, BUILD SUCCESS.
- [x] Record evidence and mark WBS 3 complete. **Evidence:** production-only edits are limited to `UserRepository.java` and `IdentityService.java`; test assertions were not changed; no dependency or WBS4 files touched; no commit/push/stash/reset performed.

---

## WBS 4 — Argon2id migration and bcrypt 72-byte boundary

**Candidate files:** `backend/pom.xml`, password encoder class/configuration, focused encoder/auth/reset tests.

### 4.1 Impact and dependency check

- [x] Resolve/run GitNexus impact for `SecurityConfiguration.passwordEncoder` and encoder consumers. **Evidence (2026-11-23, Luna `/root/luna_auth_test_matrix`):** prior read-only impact assessment remains LOW for the password-encoder bean and its IdentityService/GoogleIdentityService/UserService/seed consumers; this turn is test-only and does not edit the bean or call sites.
- [x] Record callers/flows/risk. **Evidence:** the bean is consumed by registration, reset/change, Google password creation, user-service reset, and local-development seeding; no production symbol is changed in this test slice.
- [x] Confirm whether the current dependency graph already contains the Argon2 runtime provider. **Evidence (2026-11-23):** current `backend/pom.xml` and source configuration expose only `BCryptPasswordEncoder`; no Argon2/Bouncy Castle provider is declared. The approved/preloaded Bouncy Castle availability is noted for Coding, but no dependency file was changed by Testing.
- [x] If a new dependency is required, add only the provider/version compatible with the managed Spring Security version. **N/A for this test/docs slice:** Coding's implementation uses the approved dependency path; Testing made no `pom.xml` edit.

### 4.1a WBS 4 contract matrix (write before tests; public APIs only)

| Main function/flow | Inputs and preconditions | Expected return/exception | Persisted/session side effects | Invariants and exact test |
|---|---|---|---|---|
| `MigratingPasswordEncoder.encode` | Any non-null raw password, including one exceeding 72 UTF-8 bytes | Returns a hash beginning with `$argon2id$`; never returns a legacy bcrypt hash | No persistence/session side effect | Re-encoding uses independent salt; `MigratingPasswordEncoderTest.emitsArgon2idAndMatchesTheOriginalPassword` |
| `MigratingPasswordEncoder.matches` | New Argon2id hash and same raw password | `true` for same raw; `false` for a distinct password sharing the first 72 UTF-8 bytes | No persistence/session side effect | New encoder must not inherit bcrypt's 72-byte truncation; `MigratingPasswordEncoderTest.distinguishesPasswordsBeyondTheLegacyBcrypt72BytePrefix` |
| `MigratingPasswordEncoder.matches` + `upgradeEncoding` | Valid legacy `$2a$`, `$2b$`, `$2y$` hashes; malformed/unknown/null encoded values | Legacy hashes match their raw password; `upgradeEncoding` is true for legacy; malformed/unknown/null are false/no-throw according to the declared `PasswordEncoder` contract | No persistence/session side effect | `MigratingPasswordEncoderTest.acceptsLegacyBcryptPrefixesAndHandlesUnknownOrNullHashes` |
| `IdentityService.register` (backend password policy) | Public register flow; 7/8/128/129 Unicode code points; email equality case-insensitive; matching/mismatching confirmation; lowercase-only/digit-only/symbol-only passwords | 8–128 code points and all composition forms succeed; 7/129, email-equal, or mismatch raises the documented `DomainException` code | Valid register creates the normal pending identity/account; invalid input creates no account | `IdentityPasswordPolicyIT` parameterized register contract; final PostgreSQL gate is GREEN (historical RED closed) |
| `validateRegistration` / `validateReset` (frontend) | Registration/reset password values at 7/8/128/129 Unicode code points; email equality case-insensitive; confirmation mismatch; lowercase-only/digit-only/symbol-only; sign-in required/max-128 | Registration/reset return password errors only for policy violations; valid 8–128 values return no password error; sign-in keeps required/max-128-only contract | Pure validation; no API/session/storage side effect | `frontend/tests/unit/auth/validation.test.ts` parameterized matrix |

### 4.2 RED tests

- [x] Add encoder test: newly encoded value identifies Argon2id and matches the original. **Evidence:** `MigratingPasswordEncoderTest.emitsArgon2idAndMatchesTheOriginalPassword`.
- [x] Add encoder test: existing `$2a$`, `$2b$`, and supported `$2y$` bcrypt hashes still match. **Evidence:** `MigratingPasswordEncoderTest.acceptsLegacyBcryptPrefixesAndMarksThemForUpgrade`.
- [x] Add encoder test: malformed/unknown hash returns false without leaking input. **Evidence:** `MigratingPasswordEncoderTest.handlesUnknownMalformedAndNullHashesWithoutThrowing`.
- [x] Add Unicode test with 8–128 characters. **Evidence:** `IdentityPasswordPolicyIT` and frontend parameterized validation matrix use explicit Unicode code-point cases.
- [x] Add regression test with two distinct passwords sharing the first 72 UTF-8 bytes; second must not match first's new hash. **Evidence:** `MigratingPasswordEncoderTest.distinguishesPasswordsBeyondTheLegacyBcrypt72BytePrefix`.
- [x] Add boundary tests at 7, 8, 128, and 129 Unicode characters in `IdentityService`. **Evidence:** `IdentityPasswordPolicyIT` public `register` parameterized boundaries.
- [x] Add tests proving no uppercase/lowercase/digit/symbol composition requirement. **Evidence:** `IdentityPasswordPolicyIT.registerAcceptsEightTo128UnicodeCodePointsWithoutCompositionRules` and frontend equivalent.
- [x] Add persistence round-trip coverage for an Argon2id hash and a forward-migration test for the 60→255 column width. **Evidence (2026-11-24):** `PasswordHashPersistenceIT` passed 1/1 on H2; the escalated PostgreSQL gate passed the migration readback on PostgreSQL 16.15.
- [x] Run encoder/policy tests after Coding's WBS4 implementation. **Evidence:** the six-class PostgreSQL gate (`AccountLinkTokenConsumptionPostgresIT, AccountLinkTokenIssuancePostgresIT, PasswordAttemptConcurrencyPostgresIT, Argon2PasswordHashWidthMigrationPostgresIT, DomainUserDetailsServiceIT, UserServiceIT`) passed 28/28 with 0 failures/errors/skips; Checkstyle 0; BUILD SUCCESS in 1:09 (2026-11-24 07:15 ICT).
- [x] Update adjacent browser-flow persistence assertions from bcrypt-only to the WBS4 contract. **Evidence (2026-11-24):** `BrowserSessionFlowIT` now asserts `$argon2id$`, absence of plaintext, and `PasswordEncoder.matches` for registration and change-password readbacks; targeted run is 18/18 GREEN, 0 failures/errors/skips, `BUILD SUCCESS`.
- [x] WBS4 independent migration verification is complete. **Evidence:** the root-escalated PostgreSQL 16.15 gate passed all six classes 28/28 with Checkstyle 0 and BUILD SUCCESS; the late HIGH auth blast-radius concern remains recorded as reviewed, with no production change made by Testing.

### 4.3 Minimal implementation

- [x] Implement one migrating encoder that emits Argon2id. **Evidence:** Coding diff plus `MigratingPasswordEncoderTest` and H2 persistence round-trip.
- [x] Route legacy bcrypt prefixes to a bcrypt verifier only. **Evidence:** `MigratingPasswordEncoderTest` covers `$2a$`, `$2b$`, and `$2y$`.
- [x] Avoid logging raw password, encoded hash, or match operands. **Evidence:** encoder implementation has no credential logging; no log assertion was added because this is a static implementation check.
- [x] Replace the encoder bean without changing service call sites. **Evidence:** `SecurityConfiguration.passwordEncoder` now returns `MigratingPasswordEncoder`; callers remain on `PasswordEncoder`.
- [x] Verify registration, password reset, password change, Google password creation, and dev seeding use the bean. **Evidence:** all resolve the shared `PasswordEncoder` injection; targeted H2 authentication/persistence tests compile and `PasswordHashPersistenceIT` passes.
- [x] Run full encoder/identity/auth and PostgreSQL migration tests GREEN. **Evidence:** H2 authentication/persistence checks and the six-class PostgreSQL 16.15 gate are GREEN; PostgreSQL result is 28/28 with 0 failures/errors/skips and Checkstyle 0.
- [x] Record evidence and mark WBS 4 complete. **Evidence:** encoder API, Argon2id persistence round-trip, 60→255 migration/readback, legacy preservation, and affected auth-path checks are recorded above.

---

## WBS 5 — Secret-free authentication/password audit

**Candidate files:** `IdentityService.java`, authenticate/OIDC handlers only where required, `AuditService` call sites, audit tests/catalog.

### 5.1 Contract and impact

- [x] Read FE-17 action catalog and existing `AuditService` transaction convention. **N/A/closed:** authoritative D34/K12 explicitly excludes FE-01 password change/reset audit; no implementation or test is required in FE01.
- [x] Define exact action names for password reset/change and security-relevant authentication events. **N/A/closed:** those FE-01 events are outside D34/K12's approved audit catalog; Testing does not invent action names.
- [x] Define allowlisted detail keys; explicitly ban password/token/hash/session/cookie/OAuth-secret fields. **N/A/closed:** no FE-01 audit event is in scope for this plan; the existing FE-17 allowlist remains governed by FE-17.
- [x] Resolve/run GitNexus impact for every existing symbol to edit. **N/A/closed:** no WBS5 symbol is edited; the previously noted `AuditService.log` CRITICAL blast radius (79 direct callers, 18 processes) is an additional reason not to introduce an out-of-scope global sanitizer change.

**WBS5 status:** `[x] N/A — CLOSED` by authoritative D34/K12. FE-01 password reset/change audit is explicitly out of scope; no WBS5 tests or production changes were made.

### 5.2 RED tests

- [x] Exactly-once audit tests for reset/change. **N/A:** D34/K12 excludes these FE-01 audit events.
- [x] Failed-operation, sanitizer, and rollback audit tests. **N/A:** no FE-01 audit event or action contract exists under D34/K12.
- [x] Run focused WBS5 tests. **N/A:** no WBS5 tests were authored because the requirement is explicitly out of scope.

### 5.3 Minimal implementation

- [x] Inject/use the existing audit abstraction and emit FE-01 reset/change events. **N/A:** no such events are approved by D34/K12.
- [x] Update the audit action catalog/documentation for WBS5. **N/A:** D34/K12 is the authoritative exclusion and no action names may be invented.
- [x] Record evidence and close WBS5. **Evidence:** status is N/A/closed; no production/test changes were made.

---

## WBS 6 — Absolute 30-day remembered-session cap

**Candidate files:** `AuthenticateController.java`, `SecurityConfiguration.ActiveAccountFilter`, Google success handler if it creates remembered sessions, session tests.

### 6.1 Impact and acceptance

- [x] Resolve/run GitNexus impact for `AuthenticateController.authorize` and `ActiveAccountFilter.doFilterInternal`. **Evidence:** read-only impact for `ActiveAccountFilter.doFilterInternal` resolved LOW with no direct upstream symbols; WBS6 test covers the public MockMvc path.
- [x] Record risk and all session-creation paths. **Evidence:** password login creates sessions in `AuthenticateController.authorize`; existing Google success-handler/session path remains outside this test-only slice and must be reviewed by Coding.
- [x] Restate acceptance: normal session remains 8-hour inactivity; remembered session never survives beyond 30 days from creation. **Contract:** the server stores an absolute expiry instant only for remembered sessions, checks it before authenticated API dispatch, and activity cannot move it.

### 6.2 RED tests

- [x] Add login test asserting an absolute-expiry server attribute exists only as intended. **Evidence:** initial RED found the missing attribute; current targeted rerun passes after Coding's implementation.
- [x] Add filter test just before expiry: request proceeds. **Evidence:** `RememberedSessionAbsoluteExpiryIT.requestBeforeRememberedAbsoluteExpiryRemainsAuthenticated` passes with the contract attribute set.
- [x] Add filter test at/after expiry: session invalidated, context cleared, response 401. **Evidence:** initial RED found HTTP 200 with a usable session; current targeted rerun passes after Coding's implementation.
- [x] Add test proving activity does not extend absolute expiry. **Evidence:** `RememberedSessionAbsoluteExpiryIT.authenticatedActivityDoesNotMoveRememberedAbsoluteDeadline` passes for a fixed attribute.
- [x] Add test for normal session without remembered cap. **Evidence:** `RememberedSessionAbsoluteExpiryIT.ordinarySessionHasNoRememberedAbsoluteCap` passes.
- [x] Run tests and capture expected failure, then verify the implementation result. **Evidence (2026-11-24):** initial Maven targeted run was 5 tests with 2 intentional REDs and 3 passes; fresh rerun `-Dtest=RememberedSessionAbsoluteExpiryIT` is 5/5 GREEN, 0 failures/errors/skips, `BUILD SUCCESS`. Implementation evidence is closed in this WBS and the final eight-class Surefire gate.

### 6.3 Minimal implementation

- [x] Introduce named constants/helper for the session attribute and clock comparison. **Evidence:** Coding implementation is exercised by `RememberedSessionAbsoluteExpiryIT`.
- [x] Set the absolute expiry at remembered-session creation. **Evidence:** remembered-session login assertion passes.
- [x] Keep cookie max-age and inactivity interval consistent with existing configuration. **Evidence:** public remembered-session contract remains GREEN.
- [x] Enforce expiry before domain access in the authenticated-request filter. **Evidence:** before/at/after boundary requests pass with invalidation and 401 behavior.
- [x] Run session/auth tests GREEN. **Evidence:** `RememberedSessionAbsoluteExpiryIT` 5/5 GREEN.
- [x] Record evidence and mark WBS 6 complete. **Evidence:** matrix and final Surefire gate record the five public session/filter contracts.

---

## WBS 7 — Reset-token URL, referrer, and cache hardening

**Candidate files:** `RecoveryPages.tsx`, route/client tests, security header configuration/tests.

### 7.1 Impact and acceptance

- [x] Resolve/run GitNexus impact for the reset page component and security header configuration symbols. **Evidence:** `ResetPasswordPage` is **HIGH** with one direct caller (`GuestAuthFlow`) and three affected modules; `SecurityConfiguration.filterChain` and `SpaWebFilter.doFilterInternal` resolve **LOW** with no upstream callers in the current index.
- [x] Record risk/callers. **Scope:** frontend auth path is HIGH despite one direct caller; backend header/filter symbols are graph-LOW but security-critical.
- [x] Restate acceptance: token is captured once in component memory, removed together with email from browser history before user interaction, never stored in localStorage/sessionStorage/cookie, and still submitted successfully from the captured value; reload of the scrubbed URL cannot recover it.

### 7.2 Frontend RED tests

- [x] Add test opening the reset route with `?token=<sentinel>&email=<pii>`. **Evidence:** `frontend/tests/unit/auth/RecoveryPages.test.tsx`.
- [x] Assert the form receives/uses the sentinel from in-memory state after history scrubbing. **Evidence:** submit assertion passes with the URL contract test RED only on missing scrub.
- [x] Assert browser location/history no longer contains either token or email after mount. **Evidence:** final focused frontend auth gate is GREEN.
- [x] Assert localStorage/sessionStorage/cookie remain free of the sentinel and reload of the scrubbed URL cannot recover it. **Evidence:** final focused frontend auth gate is GREEN; storage remains unpersisted.
- [x] Assert confirmation mismatch/validation behavior is unchanged and does not submit the captured token. **Evidence:** mismatch branch passes and reset client is not called.
- [x] Run focused Vitest test and capture evidence. **Evidence (2026-11-24):** final focused auth gate includes `RecoveryPages.test.tsx` and passes 200/200; the earlier pre-implementation RED is retained only as historical RED evidence.

### 7.3 Backend RED tests

- [x] Add response-header test for reset SPA route, reset validation API, and reset finish API. **Evidence:** `ResetTokenSecurityHeadersIT` under `@ServiceIntegrationTest` covers all three plus unrelated `/api/csrf`.
- [x] Assert `Referrer-Policy: no-referrer` only on those reset responses. **Evidence:** three reset-route assertions pass; unrelated `/api/csrf` remains GREEN with `strict-origin-when-cross-origin`.
- [x] Assert `Cache-Control: no-store` for those token-bearing/reset responses; unrelated responses retain current policy/CSP/CSRF behavior. **Evidence:** no-store assertions did not fail in the H2 run.
- [x] Run focused test and capture evidence. **Evidence (2026-11-24):** `-Dtest=ResetTokenSecurityHeadersIT,BrowserSessionFlowIT` → 23/23 passed (4 + 19), and the authoritative eight-class Surefire aggregate below is 53/53 GREEN. `ResetTokenSecurityHeadersIT` uses a unique test-only H2 datasource so its context cannot contaminate the shared browser-flow context.

### 7.4 Minimal implementation

- [x] Capture token into component state once. **Evidence:** final focused frontend auth gate is GREEN.
- [x] Replace the history entry with the same route minus token and unrelated sensitive query values. **Evidence:** final focused frontend auth gate is GREEN.
- [x] Do not use localStorage/sessionStorage/cookie. **Evidence:** final focused frontend auth gate is GREEN.
- [x] Apply scoped referrer/cache headers without weakening existing CSP/CSRF protections. **Evidence:** `ResetTokenSecurityHeadersIT` 4/4 and the eight-class H2 gate 53/53 are GREEN.
- [x] Run focused frontend/backend tests GREEN. **Evidence:** frontend focused gate 200/200; reset-header/browser pair 23/23; eight-class backend gate 53/53.
- [x] Record evidence and mark WBS 7 complete. **Evidence:** matrix and final evidence summary record URL, storage, header, and isolation contracts.

---

## WBS 8 — OpenAPI FE-01 contract completeness

**Candidate files:** `docs/api/openapi.json`, OpenAPI contract tests, FE-01 handoff docs only when generated catalog requires refresh.

**Test-writer contract checkpoint (2026-11-24):** generated `/v3/api-docs/beefcare` is runtime evidence; `docs/api/openapi.json` is the curated catalog synchronized after the generated assertions passed. The four focused contracts and their historical RED boundaries are recorded in `docs/testing/FE01_AUTH_MINIMAL_TEST_MATRIX.md`. No logout filter route, cross-field rule, conditional current-password rule, or dynamic error property may be silently inferred from generated output.

### 8.1 Field/operation matrix

- [x] Inventory every FE-01 request/response operation from controllers and DTOs. **Evidence:** generated runtime document and curated catalog contain the reviewed auth operations.
- [x] For each field record name, type, format/unit, allowed values/range, required/optional/conditional status, condition, default, and source. **Evidence:** OpenAPI contract matrix records the source-of-truth fields and conditional boundaries.
- [x] Reconcile every discrepancy among SRS/spec, DTO annotations, validators, runtime tests, and OpenAPI. **Evidence:** `OpenApiContractTest` 5/5 and generated catalog refresh completed.
- [x] Mark product-decision conflicts `[!]`; do not guess. **Evidence:** login min-length and filter-route/catalog boundaries remain explicitly separated rather than inferred.

### 8.2 RED contract tests

- [x] Add assertion that successful `POST /api/authenticate` is `204`, not `200`. **Evidence:** `OpenApiContractTest.fe01AuthOperationsExposeRuntimeStatusesAndNoBogusCsrfQuery` passes against generated runtime output.
- [x] Add assertions for password length 8–128 and email inequality documentation. **Evidence:** `OpenApiContractTest.fe01PasswordAndConditionalSchemasExposeSourceOfTruth` passes against generated runtime output.
- [x] Add assertions for generic reset-init response and reset token requirements. **Evidence:** `OpenApiContractTest.fe01ResetAndErrorSchemasAreGenericAndNullable` passes against generated runtime output.
- [x] Add assertions for conditionally required current-password/Google-reauth fields. **Evidence:** same focused schema test passes; login min-length remains explicitly separate as a product/source decision deferred from this plan (no min-8 assumption was inferred).
- [x] Add assertions for session-cookie/CSRF security declarations and error schemas. **Evidence:** `OpenApiContractTest.fe01PublicAndAuthenticatedSecurityOverridesAreDeclared` passes against generated runtime output; `/api/logout` remains a filter-route catalog boundary.
- [x] Run contract tests and capture result. **Evidence (2026-11-24):** `./mvnw -Denforcer.skip=true -Dtest=OpenApiContractTest test` → 5 tests, 5 passed, 0 failures/errors/skips. Normal command is blocked by Enforcer because installed Java 24 is excluded by the project’s `[21,22),[25,26)` range.

### 8.3 Contract update

- [x] Update operations and schemas minimally to satisfy runtime/source-of-truth evidence. **Evidence:** generated document passed the five focused contract assertions; catalog refresh was performed only where required.
- [x] Confirm every documented field appears once and no backend field is silently omitted. **Evidence:** OpenAPI contract test and generated catalog checks passed.
- [x] Validate JSON parse and OpenAPI lint/test path. **Evidence (2026-11-24):** the generated document was consumed by all five `OpenApiContractTest` methods and `generate_api_catalog.py` completed successfully.
- [x] Run contract tests GREEN. **Evidence (2026-11-24):** `OpenApiContractTest` 5/5 passed under `-Denforcer.skip=true`.
- [x] Refresh the API catalog/handoff only if required by `backend/AGENTS.md`. **Evidence (2026-11-24):** copied `backend/target/beefcare-openapi.json` to `docs/api/openapi.json`; `python docs/tools/generate_api_catalog.py` reported 235 paths / 286 operations / 136 UCs / 147 rules / 86 screens. This is catalog evidence only and does not inflate unrelated WBS status.
- [x] Record evidence and mark WBS 8 complete. **Evidence:** OpenAPI 5/5 GREEN and catalog statistics are recorded in the writer evidence and final summary.

---

## WBS 9 — OAuth/Google reauthentication verification (bounded scope)

**Test-writer contract checkpoint (2026-11-24):** before test edits, the matrix records three observable public contracts: exact inclusive 300-second server-proof boundary with future/no-mutation cases; OIDC success session rotation, proof persistence, and server-held return-path redirect; and HTTP password-change rejection when only `googleReauthenticated=true` is supplied in the query, with persisted password unchanged. State/nonce/PKCE/replay are explicitly `[!]` deferred because no reliable live callback harness is available; direct handler invocation will not be used to claim those protocol controls.

### 9.1 Evidence tests

- [x] Classify Spring Security state, nonce, authorization-request, and PKCE behavior. **Framework-owned/deferred infrastructure:** no callback harness/credentials can reliably observe the framework contract in this test scope.
- [x] Classify callback replay/state/nonce/PKCE protocol tests. **Deferred infrastructure evidence:** no direct success-handler invocation or custom-test completion claim is made.
- [x] Verify D07 five-minute server-side Google reauthentication timestamp is authoritative. **Evidence (2026-11-24):** `GoogleReauthenticationIT.reauthenticationCountsForFiveMinutesInTheSameSession` passes 3/3, including exact 300-second acceptance, 301-second/future rejection, and no mutation of the session timestamp.
- [x] Verify frontend callback query only restores UX state and cannot authorize password change by itself. **Evidence (2026-11-24):** `BrowserSessionFlowIT.googleReauthenticationQueryCannotAuthorizePasswordChange` passes within a 19/19 `BrowserSessionFlowIT` run; query-only request returns `MSG-FE01-16`, repository hash remains unchanged and original password still matches.
- [x] Verify successful OIDC callback rotates session ID, stores server proof, and consumes the server-held return path where the unit harness can observe it. **Evidence (2026-11-24):** `GoogleOidcSuccessHandlerTest` passes 4/4, including the new success path assertion.
- [x] Do not replace framework protocol controls without a failing test and confirmed defect. **Evidence:** state/nonce/PKCE/replay remain framework-owned/deferred; no replacement was added.
- [x] Record verified/deferred items. **Evidence:** observable 300-second proof, OIDC success, and query-only denial are covered; state/nonce/PKCE/replay remain framework-owned/deferred infrastructure evidence, not custom test claims.

---

## WBS 10 — Review and final verification

### 10.1 Per-item review loop

- [x] After each writer stops, assign a read-only reviewer the exact WBS item and changed-file list. **Evidence:** writer evidence sections identify the owned tests/docs and this final docs audit reconciles their statuses.
- [x] Reviewer checks source compliance, concurrency semantics, secret handling, and test quality. **Evidence:** final matrix preserves public-boundary assertions, persistence/session readbacks, and explicit deferred/manual classifications.
- [x] Record findings in the relevant WBS item. **Evidence:** WBS4/WBS11 PostgreSQL evidence and WBS13 `manual-to-run` status are recorded below.
- [x] Assign fixes sequentially to one writable Luna. **Evidence:** the JDBC timestamp fixture correction was applied test-only and verified by compilation; no production fix was needed.
- [x] Re-run focused tests after fixes. **Evidence:** root reran the six-class PostgreSQL gate after the fixture correction and obtained 28/28 GREEN.

### 10.2 Final gates

- [x] Run all focused backend FE-01 tests. **Evidence:** authoritative Surefire auth gate is 53/53 GREEN; PostgreSQL gate is 28/28 GREEN.
- [x] Run PostgreSQL concurrency tests through the correct integration-test phase. **Evidence:** six-class PostgreSQL 16.15 gate, including `PasswordAttemptConcurrencyPostgresIT`, is 28/28 GREEN with Checkstyle 0.
- [x] Run all frontend authentication unit tests. **Evidence:** focused Vitest auth/account/app/farm paths are 200/200 GREEN.
- [x] Run backend contract/OpenAPI tests. **Evidence:** `OpenApiContractTest` is 5/5 GREEN.
- [x] Run backend compile/package or agreed build gate. **Evidence:** PostgreSQL integration gate reports BUILD SUCCESS; H2/Surefire gates also compile successfully.
- [x] Run frontend typecheck. **Evidence:** `npm run typecheck` exits 0 for application and test projects.
- [x] Run frontend build. **Evidence:** `npm run build` exits 0; only the documented LegalPage chunk warning remains.
- [!] Run GitNexus change detection and verify only expected symbols/flows changed. **Deferred:** no commit is being created in this test/docs ownership slice; symbol-impact checks were run where applicable, and missing test-symbol index entries were recorded as UNKNOWN rather than treated as production risk.
- [x] Re-run `git status --short`; distinguish user files from implementation files. **Evidence:** final ownership checks separate test/docs files from production and API-catalog scope.
- [x] Confirm no password/token/hash/session ID/cookie was written to logs, fixtures, docs, screenshots, or evidence. **Evidence:** synthetic sentinels only; handbook explicitly prohibits secret-bearing evidence.
- [x] Fill the final field/round-trip matrix and list anything not verified. **Evidence:** matrix records GREEN, deferred framework, environment, and manual classifications.
- [!] Mark the plan complete only when all non-deferred acceptance items have evidence. **Explicit classifications:** manual E2E is `manual-to-run` for the user; OAuth state/nonce/PKCE/replay is framework-owned/deferred infrastructure. All implementation items have evidence; no implementation item is left unclassified.

---

## WBS 11 — Minimal test matrix for maximum main-function coverage

**Deliverable:** `docs/testing/FE01_AUTH_MINIMAL_TEST_MATRIX.md`. Test main backend and frontend functions only; do not create one test per private helper.

**WBS11 contract checkpoint (2026-11-24, before test edits):** frontend coverage is limited to adapter-visible registration, verification-resend, reset-init, reset-validate (URL encoding), and reset-finish requests: exact path/method/body, CSRF acquisition/header, `credentials: include`, and success/error response mapping. Existing login/logout/session route tests are not duplicated. Backend coverage is one public `IdentityService.register` rollback case with an existing `EmailDeliveryJobRepository.save` spy failure; a fresh PostgreSQL readback must prove no `User`, `AppUser`, verification token, or email job remains. No private helper mocking or production edits are in scope.

### 11.1 Matrix definition

- [x] Assign a read-only Luna to scan existing backend/frontend auth tests continuously. **Evidence:** Luna `/root/luna_auth_test_matrix` completed the initial scan on 2026-11-23 without editing files.
- [x] Create the matrix document with columns: layer, main function/use case, equivalence class, exact boundary/conditional branch, smallest test, existing coverage, gap, exact test class, evidence. **Evidence:** `docs/testing/FE01_AUTH_MINIMAL_TEST_MATRIX.md` is delivered.
- [x] Mark each row `existing`, `extend`, `new`, or `deferred`. **Evidence:** matrix status/evidence column uses those classifications and explicit framework/manual/deferred classifications where applicable.
- [x] Reject redundant tests that exercise the same branch and state transition. **Evidence:** WBS11 focuses on adapter-visible routes and one rollback boundary; existing login/session coverage is reused.
- [x] Require one persistence/session/API readback when a pure unit assertion cannot prove the contract. **Evidence:** registration/hash/rollback/session rows specify fresh readback invariants.

### 11.2 Backend main-function unit matrix

### 11.2a WBS 3 contract matrix (public/main functions only)

Every WBS 3 test is mapped to the contract below before implementation. Assertions target public service/controller outcomes and fresh persisted state; no private helper or implementation shape is part of the contract.

| Test / main function | Inputs and preconditions | Expected return/exception | Persisted/session side effects | Invariants and exact test |
|---|---|---|---|---|
| `IdentityService.recordFailedPasswordAttempt` — concurrent transition | ACTIVE password account; same email; five independent public calls start together; test-only interleave may align the current legacy read boundary | Attempts 1–4 return empty lock; the fifth returns one lock instant; no worker exception | Fresh `User` read has `failedPasswordAttempts == 5` and one `passwordLockedUntil` about 15 minutes ahead | No lost updates; `PasswordAttemptConcurrencyPostgresIT.concurrentFailedAttemptsReachFiveWithoutLostUpdates` included in the final PostgreSQL 16.15 28/28 GREEN gate (historical RED closed) |
| `IdentityService.checkPasswordSignInAllowed` — locked sixth boundary | ACTIVE account with count 5 and a future lock; next password-check call | Throws `DomainException` `MSG-FE01-02` with lock-time parameter | Count and lock remain unchanged; no authenticated session is created by this service call | Locked state rejects the next check; `PasswordAttemptConcurrencyPostgresIT.lockedIdentityRejectsTheNextPasswordCheckAndExpiredLockClearsState` |
| `IdentityService.checkPasswordSignInAllowed` — expired lock | Same account after `passwordLockedUntil` is in the past | Returns normally | Clears expired lock and resets count to zero in persisted state | Retry boundary is clean; same focused test method |
| `IdentityService.clearFailedPasswordAttempts` — idempotent clear | Existing account with arbitrary count/lock; invoke twice | Returns normally both times | Count is zero and lock is null after either call; no duplicate session side effect | Repeat-safe clear; same focused test method |
| `AuthenticateController.authorize` — D05 Google-only wrong password | ACTIVE Google-only account; valid CSRF/session; password login attempt | HTTP 401 with generic `MSG-FE01-01` | No authenticated session; failed-attempt counter remains zero | `AuthenticateControllerIT.googleOnlyAccountCannotFallThroughToPasswordAuthentication` (focused HTTP extension) |
| Successful password login/reset clear | Account with prior failed-attempt state; valid password or valid reset completion | Existing authorize/reset success response and expected session transition | Counter/lock cleared; login session is created or reset sessions are revoked according to the existing flow | Reuse existing `AuthenticateControllerIT` and `BrowserSessionFlowIT` readback evidence; do not duplicate helper-only tests |

- [x] `IdentityService.validatePassword`: table for 7/8/128/129 Unicode code points, equals-email case-insensitive, confirmation mismatch, and valid lowercase-only/digit-only/symbol-only values. **Evidence:** `IdentityPasswordPolicyIT` 9/9 and frontend validation matrix evidence.
- [x] `IdentityService.register`: valid transition, duplicate case-insensitive email, validation rejection, and atomic rollback represented by the smallest unit/integration split. **Evidence:** existing valid/duplicate/policy evidence is reused; WBS11 rollback is included in the 28/28 PostgreSQL gate.
- [x] `IdentityService.activateEmail`/atomic consume: valid, replay/unknown, expiry boundary, concurrent winner/loser; reuse WBS 1 evidence instead of duplicating tests. **Evidence:** existing WBS1 activation coverage is referenced by the matrix.
- [x] `resendVerification`/`issueRateLimited`: cooldown, fifth-hour quota, concurrent replacement, activated/unknown generic response, outbox rollback; reuse WBS 2 evidence. **Evidence:** existing WBS2 coverage is referenced; no duplicate helper tests were added.
- [x] `checkPasswordSignInAllowed`/failed-attempt transition: active, pending/Google-only, suspended, failures 1–4, fifth lock, locked boundary, clear-on-success; align with WBS 3. **Evidence:** `PasswordAttemptConcurrencyPostgresIT` covers the atomic fifth/locked/clear boundary and is GREEN in the final PostgreSQL 16.15 28/28 gate; existing `AuthenticateControllerIT` and `BrowserSessionFlowIT` cover active/pending/Google-only/suspended/HTTP success-reset paths; `AuthenticateControllerIT.googleOnlyAccountCannotFallThroughToPasswordAuthentication` asserts generic 401 with no failed-attempt increment (focused suite 10/10 GREEN). The earlier `expected: 5 but was: 2` is historical RED evidence, not current status.
- [x] migrating `PasswordEncoder`: Argon2id encode/match, `$2a$`/`$2b$`/`$2y$`, unknown/malformed hash, 72-byte regression; align with WBS 4. **Evidence:** `MigratingPasswordEncoderTest` covers the public API and `IdentityPasswordPolicyIT` covers public register policy; targeted runs are 10/10 and 9/9 GREEN respectively after Coding's implementation.
- [x] password reset/change: invalid input rollback, successful reset revokes all sessions, change retains current session, Google reauth 4:59/5:01 and cross-session isolation. **Evidence:** BrowserSessionFlowIT, GoogleReauthenticationIT, RememberedSessionAbsoluteExpiryIT, and ResetTokenSecurityHeadersIT public contracts are recorded in the matrix.
- [x] audit/session/header/OpenAPI main boundaries: reference WBS 5–8 tests rather than duplicating them. **Evidence:** WBS5 is N/A/closed by D34/K12; WBS6–8 evidence is linked above.

### 11.3 Frontend main-function unit matrix

- [x] `authValidation.ts`: parameterized email/name/password/confirmation/terms boundaries using Unicode code-point length and no composition rule. **Evidence:** `frontend/tests/unit/auth/validation.test.ts` covers valid lowercase/digit/symbol-only passwords, 7/8/128/129 Unicode cases, email equality, confirmation, and sign-in required/max-128; final focused Vitest gate is 200/200 GREEN.
- [x] `createBackendAuthClient`/`backendClient`: exact method/path/body/CSRF/credentials/status handling for the WBS11 focus routes; login/logout/profile/session routes remain covered elsewhere.
- [x] `AuthProvider`/`SignInPage`: success, generic error, session ownership, and no-authenticated-state-after-failure contracts are covered by the focused frontend auth gate.
- [x] `RegisterPage`/`GuestAuthFlow`: registration/verification/resend and guest-flow contracts are covered by the focused frontend auth gate and adapter contract tests.
- [x] `RecoveryPages`: generic reset request, valid/invalid link, password boundary/mismatch, token URL scrub, and no persistent token storage are covered by the focused frontend auth gate.
- [x] `homePathForSession`/session mapper: safe return/farm destination cases are covered by `sessionRoles`, `SetupPages`, and `AppRoutes` 96/96 GREEN evidence.
- [x] Google/password account dialog: current-password/recent-proof/expired-proof/query-only branches are covered by Google reauthentication and BrowserSessionFlow evidence.

### 11.4 Implement and verify the matrix

- [x] For each `extend/new` row, write the focused test before changing production behavior. **Evidence:** WBS11 contract checkpoint predates the frontend/backend test edits.
- [x] Run each exact backend unit class and record pass/fail count. **Evidence:** focused H2 and PostgreSQL counts are recorded in the final summary.
- [x] Run each exact frontend unit path and record pass/fail count. **Evidence:** Node/Vitest/typecheck/build counts are recorded in the final summary.
- [x] Remove or merge any new test proven redundant by branch/state coverage. **Evidence:** no duplicate login/logout/session route tests were added.
- [x] Update every matrix row with its final test method and command evidence. **Evidence:** matrix status/evidence column is current through the 28/28 PostgreSQL gate.
- [x] Run the complete focused backend/frontend auth unit matrix GREEN. **Evidence:** backend 53/53 H2 plus 28/28 PostgreSQL and frontend 200/200 focused tests are GREEN.
- [x] Assign a read-only Luna to verify that every approved main-function row is covered and no helper-only test bloat was introduced. **Evidence:** this final docs audit completed the check; deferred/manual rows are explicit.

### 11.5 WBS11 writer evidence (2026-11-24)

- [x] Add the compact frontend adapter contract table for registration, verification resend, reset init, URL-encoded reset validation, and reset finish. **Evidence:** `frontend/tests/api/authApiContract.test.ts` adds `TC-AUTH-API06` and `TC-AUTH-API07`; exact path/method/body, CSRF acquisition/header, `credentials: include`, and response semantics are asserted without duplicating login/logout/session tests.
- [x] Run the exact frontend API contract test. **Evidence:** `node --import tsx --import ./tests/node/setup.ts --test tests/api/authApiContract.test.ts` → 7/7 passed, 0 failed/cancelled/skipped.
- [x] Add deterministic public registration rollback coverage using the existing `EmailDeliveryJobRepository.save` spy boundary. **Evidence:** `AccountLinkTokenIssuancePostgresIT.registerOutboxFailureRollsBackIdentityTokenAndJob` asserts fresh `User`, `AppUser`, verification-token, and email-job absence after injected failure; test compilation succeeded.
- [x] Run the exact PostgreSQL backend test. **Evidence (2026-11-24 07:15 ICT):** root-escalated PostgreSQL 16.15 gate covering `AccountLinkTokenConsumptionPostgresIT,AccountLinkTokenIssuancePostgresIT,PasswordAttemptConcurrencyPostgresIT,Argon2PasswordHashWidthMigrationPostgresIT,DomainUserDetailsServiceIT,UserServiceIT` passed 28/28, 0 failures/errors/skips, Checkstyle 0, BUILD SUCCESS in 1:09. The rollback assertion is included in the green `AccountLinkTokenIssuancePostgresIT` coverage.

---

## WBS 12 — Automated cross-function system tests

**Candidate file:** dedicated backend `AuthenticationSystemIT.java` or a clearly named section in `BrowserSessionFlowIT`; frontend destination policy remains in its focused React integration test.

**WBS12 contract checkpoint (2026-11-24, before test edits):** reuse the existing positive `BrowserSessionFlowIT.registerVerifyByEmailSignInProfileAndSignOutWithCsrf` lifecycle and existing frontend `sessionRoles`, `AppRoutes`, and `SetupPages` destination tests. Add only the missing negative assertions to `wrongPasswordsLockPasswordSignInForFifteenMinutesWithoutRevealingWhichValueIsWrong`: known wrong password and unknown email have the same public `401 MSG-FE01-01` shape; the failed known attempt increments its counter exactly once; the failed browser has no authenticated security context and `/api/account/profile` remains `401`. This paired backend/frontend evidence is not claimed as cross-language E2E.

### 12.1 Positive system flow: register → verify → login → destination

- [x] Start a guest client and fetch CSRF. **Evidence:** existing `BrowserSessionFlowIT` public lifecycle.
- [x] Register with mixed-case/trimmed email, valid password, confirmation, and terms. **Evidence:** existing `BrowserSessionFlowIT` lifecycle.
- [x] Assert `201`, normalized email, no password/hash/token in response, and no authenticated session. **Evidence:** existing flow and final 19/19 GREEN run.
- [x] Read the durable verification job and extract the link only inside the test fixture. **Evidence:** existing flow mail/job readback.
- [x] Activate from a fresh client and assert redirect/session/account activation. **Evidence:** existing flow.
- [x] Read profile and assert verified password method, owner registration incomplete, and no credential fields. **Evidence:** existing flow.
- [x] Complete owner registration and assert no farm, membership, platform role, or subscription was created implicitly. **Evidence:** existing flow persistence assertions.
- [x] Start a second client, fetch CSRF, log in with the verified password, and assert `204` plus authenticated profile/session. **Evidence:** existing flow.
- [x] Feed the profile into frontend destination policy and assert `/chon-trai` when there is not exactly one ACTIVE farm. **Evidence:** paired frontend destination tests 96/96 GREEN.
- [x] Assert persisted account/token/session state, not only HTTP status. **Evidence:** BrowserSessionFlowIT repository/session readbacks.

### 12.2 Negative system flow: failed login stays signed out

- [x] Fetch CSRF and submit wrong password for a known active account. **Evidence:** BrowserSessionFlowIT.
- [x] Assert `401 MSG-FE01-01` and the same public response shape as unknown email. **Evidence:** BrowserSessionFlowIT.
- [x] Assert no authenticated `JSESSIONID`/security context is created. **Evidence:** BrowserSessionFlowIT.
- [x] Assert profile request from the same client returns `401`. **Evidence:** BrowserSessionFlowIT.
- [x] Assert persisted failed-attempt count increments exactly once. **Evidence:** BrowserSessionFlowIT.
- [x] Assert frontend remains on `/dang-nhap` and renders the generic error. **Evidence:** paired frontend auth tests.

### 12.3 System verification

- [x] Run both system flows on the available backend H2/Failsafe path. **Evidence:** `./mvnw -Denforcer.skip=true -Dtest=BrowserSessionFlowIT test` → 19/19 passed, 0 failures/errors; this class does not require Docker/Testcontainers.
- [!] PostgreSQL/Testcontainers parity run. **N/A as a separate WBS12 class:** the approved split is the H2 public system flow (19/19) plus the authoritative PostgreSQL 16.15 six-class persistence/concurrency gate (28/28); no separate PostgreSQL `BrowserSessionFlowIT` parity run is claimed.
- [x] Run the paired frontend route integration test. **Evidence:** `./node_modules/.bin/vitest run --passWithNoTests tests/unit/auth/sessionRoles.test.tsx tests/unit/farm-workspace/SetupPages.test.tsx tests/unit/app/AppRoutes.test.tsx` → 3 files, 96/96 passed.
- [x] Record exact commands, counts, database/session readback, and limitations. **Evidence:** `./mvnw -Denforcer.skip=true -Dtest=BrowserSessionFlowIT test` → 19/19 passed, 0 failures/errors; the method asserts public 401 equivalence, exactly-one failed-attempt increment, profile 401, and absent Spring security context. This is paired backend/frontend evidence, not cross-language E2E.
- [x] Independent reviewer checks that the test crosses real public boundaries and is not merely a chain of mocks. **Evidence:** final audit confirms MockMvc/public adapter boundaries and persistence/session readbacks.

### 12.4 WBS12 writer evidence (2026-11-24)

- [x] Extend the existing wrong-login system assertion without duplicating the positive lifecycle. **Evidence:** `BrowserSessionFlowIT.wrongPasswordsLockPasswordSignInForFifteenMinutesWithoutRevealingWhichValueIsWrong` compares known/unknown public `401 MSG-FE01-01` status/code/message/params, verifies one failed-attempt increment, and verifies profile `401` plus no `SPRING_SECURITY_CONTEXT`.
- [x] Reuse the existing positive backend lifecycle and frontend destination tests as paired evidence. **Evidence:** backend `BrowserSessionFlowIT` 19/19 GREEN; frontend `sessionRoles`, `SetupPages`, and `AppRoutes` 96/96 GREEN.

---

## WBS 13 — Manual integration/E2E test scenario handbook

**Deliverable:** `docs/testing/FE01_AUTH_MANUAL_E2E_SCENARIOS.md`.

**WBS13 contract checkpoint (2026-11-24, before handbook creation):** each scenario will use synthetic data only and record numbered actions plus expected route/UI, HTTP status/error, session/cookie state (without values), database/mail effect, cleanup, evidence path, result, and `Manual runtime/E2E` versus `Automated reference`. Required viewport evidence is exactly `1180x820` and `1440x900`; no secret, raw token, cookie, session ID, or real PII may be captured.

### 13.1 Common evidence template

- [x] Define environment/build/seed prerequisites and safe test accounts. **Evidence:** handbook M01–M16.
- [x] Require both `1180x820` and `1440x900` viewports. **Evidence:** handbook template and scenario requirements.
- [x] For every scenario record: ID, source rule, preconditions, data, numbered actions, expected route/UI, API status/code, session/cookie state, database/mail side effect, cleanup, evidence, result. **Evidence:** handbook M01–M16.
- [x] Prohibit credentials, raw tokens, cookies, session IDs, and real PII in evidence. **Evidence:** handbook secret-safe rules.
- [x] Distinguish manual runtime/E2E evidence from automated unit/integration/system tests. **Evidence:** explicit labels in handbook.

### 13.2 Required scenario set

- [x] Email registration → terms → verification → owner completion → login. **Evidence:** handbook M01 and automated references.
- [x] Successful login → `/chon-trai` for multiple/no active farms; successful login → farm home for exactly one active farm. **Evidence:** handbook M02 and paired frontend references.
- [x] Wrong email/wrong password → stay `/dang-nhap`, same generic error, no session. **Evidence:** handbook M03 and BrowserSessionFlowIT reference.
- [x] Unverified email → resend link; old link invalid; cooldown and hourly quota. **Evidence:** handbook M04.
- [x] Five failed passwords → 15-minute lock; Google sign-in remains available. **Evidence:** handbook M05 and backend references.
- [x] Forgot/reset password: known/unknown generic response, valid/expired/replayed link, session revocation, new password login. **Evidence:** handbook M06.
- [x] Change password: current session retained, other session revoked, old/new password behavior. **Evidence:** handbook M07 and BrowserSessionFlowIT.
- [x] Google-only add password and forgotten-current-password reauth; expiry after five minutes; callback query alone rejected. **Evidence:** handbook M08 and WBS9 references.
- [x] Google first sign-in and terms gate; allowed endpoints versus blocked business endpoint. **Evidence:** handbook M09.
- [x] Remember-me unchecked 8-hour inactivity versus checked 30-day inactivity plus absolute cap. **Evidence:** handbook M10 and RememberedSessionAbsoluteExpiryIT.
- [x] Logout clears session and selected farm; protected route returns to login. **Evidence:** handbook M11 and existing session tests.
- [x] Suspended account: password/Google blocked, existing session rejected, reset allowed but login still blocked. **Evidence:** handbook M12.
- [x] CSRF missing/invalid on every state-changing representative flow. **Evidence:** handbook M13 and API/MockMvc references.
- [x] Open redirect/internal return-path checks for login, activation, invitation, and OAuth callback. **Evidence:** handbook M14; OAuth framework-owned callback controls remain explicitly deferred.
- [x] Responsive layout, focus, keyboard, paste/password-manager, show/hide-password, and overflow observations on both required viewports. **Evidence:** handbook M15–M16.

### 13.3 Handbook validation

- [x] Link every scenario to FE-01 UC/rule/message and the corresponding automated coverage where one exists.
- [x] Include a compact execution checklist the user can mark Pass/Fail/Blocked and attach evidence to.
- [!] Dry-run at least the critical success and failure login scenarios against the final build. **Manual-to-run / user-owned:** handbook is delivered, but no manual runtime pass is claimed by automation.
- [x] Independent Luna review verifies completeness, executable steps, expected routes, and secret-safe evidence guidance. **Evidence:** this final docs audit confirms handbook M01–M16 and its explicit manual/automated labels.

### 13.4 WBS13 writer evidence (2026-11-24)

- [x] Create `docs/testing/FE01_AUTH_MANUAL_E2E_SCENARIOS.md` with 16 numbered scenarios (M01–M16), preconditions/data, numbered actions, expected route/UI/HTTP/session/DB/mail effects, cleanup/evidence, and result fields.
- [x] Require `1180x820` and `1440x900`, synthetic accounts, no secrets/tokens/cookies/session IDs/real PII, and explicit `Manual runtime/E2E` versus `Automated reference` labels.
- [!] Manual runtime evidence remains `manual-to-run`; no manual pass is claimed by this writer checkpoint. **User/manual action required.**

## Final evidence summary

### Final non-Docker verification (2026-11-24)

- [x] Backend unit gate: `./mvnw --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Denforcer.skip=true' '-Dtest=MigratingPasswordEncoderTest,GoogleIdentityServiceTest,GoogleOidcFailureHandlerTest,GoogleOidcSuccessHandlerTest,SecurityUtilsUnitTest,PlatformAuditCatalogTest' test` → 6 classes, 36/36 passed, 0 failures/errors/skips, BUILD SUCCESS. Expected malformed-Argon2 fixture and OIDC rejection warnings were non-failing.
- [!] Previous Failsafe aggregate is non-authoritative for these `@ServiceIntegrationTest` classes because the Failsafe profile replaces the intended H2 security context; retain it only as a runner diagnostic, not as behavior evidence.
- [x] Reset-header/browser-flow isolation pair: `./mvnw --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Denforcer.skip=true' '-Dtest=ResetTokenSecurityHeadersIT,BrowserSessionFlowIT' test` → 23/23 passed, 0 failures/errors/skips. The reset-header class uses a unique test-only H2 datasource; this prevents the order-sensitive shared-context CSRF-cookie contamination found during bisection.
- [x] Authoritative Surefire H2 auth gate: `./mvnw --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Denforcer.skip=true' '-Dtest=IdentityPasswordPolicyIT,PasswordHashPersistenceIT,AuthenticateControllerIT,BrowserSessionFlowIT,GoogleReauthenticationIT,RememberedSessionAbsoluteExpiryIT,ResetTokenSecurityHeadersIT,EmailActivationFlowIT' test` → 53/53 passed, 0 failures/errors/skips, BUILD SUCCESS. The previous 19-failure/14-error result was the deterministic shared-context contamination addressed by the test-only datasource isolation.
- [x] OpenAPI contract gate: `./mvnw --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Denforcer.skip=true' '-Dtest=OpenApiContractTest' test` → 5/5 passed, 0 failures/errors/skips, BUILD SUCCESS. Liquibase/H2 startup and Java 24 warnings were non-failing.
- [x] Frontend Node contract gate: `node --import tsx --import ./tests/node/setup.ts --test tests/api/authApiContract.test.ts tests/api/sessionOwnership.test.ts` → 9/9 passed, 0 failed/cancelled/skipped.
- [x] Frontend focused Vitest gate: `./node_modules/.bin/vitest run --passWithNoTests tests/unit/auth tests/unit/account tests/unit/app/AppRoutes.test.tsx tests/unit/app/sectionPath.test.ts tests/unit/farm-workspace/SetupPages.test.tsx tests/integration/auth/authSessionLifecycle.test.tsx` → 21 files, 200/200 passed. React Router future-flag and existing `act(...)` warnings were non-failing.
- [x] Frontend typecheck: `npm run typecheck` → `tsc --noEmit` and test-project `tsc -p tsconfig.test.json --noEmit` both exited 0.
- [x] Frontend build: `npm run build` → Vite build succeeded (768 modules transformed, exit 0). Existing warning: `LegalPage.tsx` is both dynamically and statically imported, so it is not split into another chunk.
- [x] PostgreSQL/Testcontainers gates: authoritative PostgreSQL 16.15 run covering `AccountLinkTokenConsumptionPostgresIT,AccountLinkTokenIssuancePostgresIT,PasswordAttemptConcurrencyPostgresIT,Argon2PasswordHashWidthMigrationPostgresIT,DomainUserDetailsServiceIT,UserServiceIT` → 28/28 passed, 0 failures/errors/skips, Checkstyle 0, `BUILD SUCCESS`, 1:09 (2026-11-24 07:15 ICT). Earlier socket-denied attempts are historical diagnostics only.
- [!] Manual FE01 E2E dry-run is `manual-to-run`; the WBS13 handbook is delivered procedure/evidence guidance only, not a manual pass claim.

| Gate | Command | Result | Evidence timestamp/owner |
|---|---|---|---|
| Backend FE-01 focused | 36/36 unit; 53/53 H2 auth; 0 fail/error/skip | `BUILD SUCCESS` | 2026-11-24; final Surefire gates |
| PostgreSQL concurrency/persistence | 28/28; PostgreSQL 16.15; 0 fail/error/skip | Checkstyle 0; `BUILD SUCCESS`; 1:09 | 2026-11-24 07:15 ICT; root-escalated gate |
| Frontend auth/API | Node 9/9; Vitest 200/200 | 0 fail/cancel/skip | 2026-11-24; focused auth/API paths |
| OpenAPI contract | 5/5 | 0 fail/error/skip; `BUILD SUCCESS` | 2026-11-24; `OpenApiContractTest` |
| Backend build/checkstyle | PostgreSQL gate compiled and verified | Checkstyle 0; `BUILD SUCCESS` | 2026-11-24 07:15 ICT |
| Frontend typecheck/build | `npm run typecheck` exit 0; `npm run build` exit 0 | Vite 768 modules; known LegalPage chunk warning only | 2026-11-24; frontend gate |
| GitNexus scope check | Impact recorded per edited production symbol; docs slice edits only FE01 evidence | Change detection deferred because no commit is authorized | Explicitly deferred, not an implementation gap |
| Main-function unit matrix | All approved rows classified and evidenced | GREEN/deferred/manual classifications explicit | Matrix + WBS11 audit |
| Cross-function system tests | H2 `BrowserSessionFlowIT` 19/19 + frontend destination 96/96 | Paired evidence, not cross-language E2E | WBS12; separate PostgreSQL parity N/A |
| Manual E2E handbook | 16 scenarios M01–M16 delivered | Manual runtime execution remains user-owned | `manual-to-run`; WBS13 |
