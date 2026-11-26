# FE-01 Authentication Stability Design

**Date:** 2026-11-23

**Status:** Approved implementation scope derived from the completed FE-01 audit
**Sources:** `docs/REQUIREMENT_DECISIONS.md` (D05–D07, D12, D34/K12, D49, D56–D57), `docs/requirements/SRS_2026-10-28.txt` (NFR-S04–S06, GBR-01–03), `docs/requirements/specs/FE-01-xac-thuc-tai-khoan.md`, `docs/api/openapi.json`, current backend/frontend implementation and tests.

## 1. Goal

Stabilize FE-01 at the concurrency, password-storage, session, reset-link, and API-contract boundaries without changing the approved user-facing business rules. FE-01 audit events remain explicitly out of scope under D34/K12.

## 2. Password policy decision

The approved rule remains exactly:

- 8–128 Unicode characters;
- password must not equal the account email, case-insensitively;
- no mandatory lowercase, uppercase, digit, or special-character composition rule;
- password and token values are never logged, returned, or stored in plaintext.

Composition rules are deliberately not added. They are not present in GBR-02 and would be an unauthorized product-policy change. The technical defect to fix is bcrypt's 72-byte input boundary: two different long Unicode passwords must never silently authenticate as the same password. New hashes therefore use Argon2id while legacy bcrypt hashes remain verifiable during migration.

## 3. Chosen approach

Use targeted stabilization rather than a full identity-system rewrite:

1. Make one-time-token consumption and security counters atomic at the database boundary.
2. Serialize link issuance for one address/type so cooldown, hourly quota, invalidation, and insertion form one consistent decision.
3. Introduce a migrating password encoder: encode new passwords with Argon2id; match existing bcrypt hashes; never silently truncate a new password.
4. Respect D34/K12: do not introduce FE-01 password reset/change or authentication audit events; FE-17's approved catalog remains the audit authority.
5. Keep the existing inactivity timeouts and add an absolute 30-day cap for remembered sessions.
6. Remove reset tokens from the browser address immediately after capture and apply stricter reset-page referrer/cache protections.
7. Align the OpenAPI operation status codes, schemas, constraints, conditional rules, and security declarations with runtime behavior.

## 4. Alternatives rejected

- **Require uppercase/lowercase/digit/symbol:** rejected because it contradicts the approved FE-01 rule.
- **Reject all passwords above 72 UTF-8 bytes:** rejected because valid 8–128-character Unicode passwords would become unusable.
- **Replace all legacy hashes immediately:** rejected because plaintext passwords are unavailable and forced resets are not required by the SRS.
- **Full MFA/passkey/session-management feature:** deferred; these are product-roadmap decisions, not FE-01 stabilization defects.
- **Shared distributed session store:** topology-dependent and not required until BeefCare runs multiple application nodes.

## 5. Component design

### 5.1 Atomic token state

The persistence layer owns the compare-and-set operation. Consuming a token succeeds only when its hash/type matches, `usedAt` is null, and `expiresAt` is in the future. Exactly one concurrent request may change `usedAt`; all others receive the existing invalid/expired response.

Link issuance obtains a database lock scoped to the target identity before reading cooldown/hourly counts, invalidating the prior token, and inserting the replacement. The transaction either publishes one valid replacement or rolls back entirely.

### 5.2 Atomic failed-attempt state

Failed-attempt transitions are serialized per identity. Increment, fifth-failure lock creation, and reset occur atomically. Concurrent failures cannot lose increments or create inconsistent `lockedUntil` values.

### 5.3 Password hash migration

A single `PasswordEncoder` bean emits self-identifying Argon2id hashes. `matches` accepts current Argon2id hashes and legacy raw bcrypt prefixes (`$2a$`, `$2b$`, `$2y$`). Registration, reset, change, Google-linked password creation, and development seeding all use the same encoder. Tests cover ASCII, multibyte Unicode, legacy bcrypt, invalid hashes, and two values with an identical first 72 UTF-8 bytes.

### 5.4 Audit scope override

D34/K12 explicitly excludes FE-01 password reset/change from the FE-17 audit catalog. No new audit action names, event writes, before/after payloads, sanitizer, or audit tests are introduced by this design. Existing FE-17 behavior remains authoritative for the audit scope that it does cover.

### 5.5 Session lifetime

Normal sessions retain an 8-hour inactivity timeout. Remembered sessions retain a 30-day inactivity timeout and additionally store a server-controlled absolute expiry instant. The authenticated-request filter invalidates a session after that instant regardless of recent activity. Cookie expiry is not treated as the enforcement boundary.

### 5.6 Reset-link browser handling

The frontend reads the reset token once, keeps it in component memory only, and replaces the current history entry with a token-free URL before rendering the form. Reset pages receive `Referrer-Policy: no-referrer` and `Cache-Control: no-store`; tokens never enter analytics, logs, local/session storage, or later navigation URLs.

### 5.7 API contract

OpenAPI mirrors actual status codes (including `204` for successful authentication), request constraints, conditional requirements, generic reset responses, error envelopes, CSRF/session security, and nullable/optional semantics. Contract tests prevent another drift.

## 6. Explicit non-goals

- Changing the 8–128-character rule or adding composition rules.
- Adding a breached-password blocklist without a separate product/privacy decision.
- MFA, passkeys, terms versioning, active-session UI, or a distributed session registry.
- Genericizing SRS-mandated suspended/locked responses.
- Replacing Spring Security's built-in OAuth state/nonce/PKCE mechanisms without evidence of a defect.

## 7. Execution topology

The repository has no local `LamKD` ref, so the recommended isolated worktree cannot be created from the required explicit base. No substitute base is inferred. Work proceeds sequentially in the current canonical checkout on `lamkd2` at baseline `e2fab5ac8c407869f95c6d61e5f34135cb0deea5`, with one writable Luna at a time, no commit/push/merge, and all pre-existing dirty files preserved. Review agents are read-only.
