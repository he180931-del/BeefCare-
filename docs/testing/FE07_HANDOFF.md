# FE-07 handoff

## Notification navigation increment — 16/11/2026

- Owner/Manager received delivery rows now open the existing detail screen at
  `/thong-bao/{announcementId}?versionId={versionId}`. The Technician list uses
  `/kt/thong-bao/{announcementId}?versionId={versionId}`. `versionId` is the
  immutable `AnnouncementVersion.id` used by JOB-07's
  `ANNOUNCEMENT_VERSION.targetId`; `AnnouncementSummary.latestVersionId` comes
  from the newest version visible to that caller.
- The Owner/Manager nested router now accepts `/thong-bao/:id`. Detail renders
  the requested visible version's title, body and timestamp. An absent or
  inaccessible version stays hidden behind the existing not-found-safe error;
  it does not fall back to newer content. Opening a stale version does not
  mark the newer delivery as read. The current newest visible unread version
  retains the existing read behavior.
- This uses the FE-07 delivery list as its valid screen entry. No announcement
  tab was added to FE-14 SCR-45: the checked-in FE-14 spec places farm
  announcements in FE-07. A generic Owner/Manager notification-feed click
  adapter is still not present in the UI.
- Focused frontend verification on Node 22.22.2: `vitest run
  tests/unit/farm-announcements` passed **31/31** (16 API, 15 page tests),
  including path/query routing, exact version rendering, hidden inaccessible
  version, and not marking a newer correction read from an old link. Both
  TypeScript checks in `npm run typecheck` passed. Only React Router v7
  future-flag notices appeared.

### Runtime smoke — QA PostgreSQL clone, 16/11/2026

- The workspace owner manually verified the FE-07 notification navigation in
  the browser for the same synthetic announcement and versions recorded below.
  Owner/Manager delivery rows navigate to the authorized recipient; the
  Technician detail shows the exact requested immutable version. This was a
  browser smoke, not a screenshot comparison.
- Authenticated HTTP smoke used Farm A (`BeefCare Local Farm A`, farm 1151),
  Manager `manager@beefcare.local` and active Technician
  `technician@beefcare.local`. The Manager created a draft with the eligible
  Technician selected by FarmMembership ID, previewed it, published v1, then
  corrected it to v2. The recipient's farm-scoped list returned both visible
  versions and the corrected title/body as current.
- Synthetic record: announcement **5051**, version IDs **5151 (v1)** and
  **5152 (v2)**; titles and bodies carried the `QA-TAI-FE07` prefix. The outbox
  produced exactly one `ANNOUNCEMENT_VERSION` notification for each version.
  The recipient marked the latest delivery and its target notification read.
  No cleanup/reset was done.
- This was a sequential smoke, not the P05 concurrent-load/performance
  measurement. P05 sandbox remains unmeasured.

15/11/2026, PostgreSQL 16.15, DB QA riêng, bản `dev bd7d598` với thay đổi local: kiểm thử hai transaction thực sự cho trường hợp membership được chọn bị chuyển INACTIVE trong lúc publish. Publish chờ khóa membership; sau khi thay đổi trạng thái commit, publish từ chối người nhận không còn hợp lệ. Sau test membership mẫu được trả về ACTIVE. Kiểm thử này chỉ bao phủ thứ tự thay đổi trạng thái trước publish; chưa kiểm tra phantom member hoặc thay đổi PlatformStaffAccess đồng thời.

## Latest-worktree checkpoint — 15/11/2026

The current local base is `dev` at `bd7d598`. Focused Maven verification passed
**40/40**, including FE-07, FE-23 and `OpenApiContractTest`; OpenAPI and the API
catalog were regenerated with **232 paths and 286 operations**. On this base, a
separate PostgreSQL QA database smoke passed: Owner created a draft naming one
Technician, previewed and published it, then replayed the publish command; the
version advanced **0→1**. That Technician could read it, a Manager in the same
farm could not see it, and an Owner from another farm received **403**. This
smoke was sequential, with no concurrency test. The earlier PostgreSQL smoke
below used `de11943` and predates named recipients.

The latest FE-07 code excludes ACTIVE platform staff from recipient options,
named selectors, role resolution and corrections. Publish/correction now lock
candidate memberships in ID order and refresh/recheck them; they are covered by
the focused run above. There is still no PostgreSQL concurrency test for these
locks. The lock does not serialize a newly accepted membership (phantom) or
concurrent changes to `PlatformStaffAccess` in its separate table. Preview
remains advisory; publish resolves the audience again inside its command
transaction.

15/11/2026: smoke API trực tiếp trên PostgreSQL 16.15 với DB QA mới, nền `de11943` cùng thay đổi chưa commit: Owner tạo nháp, xem trước, đăng; Technician đăng nhập và đọc được danh sách có thông báo. Chưa kiểm đính chính, cách ly trại, gửi JOB-07 hay UI trên trình duyệt trong lượt PostgreSQL này. Smoke này có trước phần chọn người nhận riêng bên dưới.

## Incremental update 15/11/2026 — named recipients

- `DraftRequest.recipientMemberIds` is additive and contains **FarmMembership IDs**, not `AppUser` IDs. A missing value from an older draft-edit client preserves existing named selectors; an explicit empty list clears them. Existing role-only drafts remain intact.
- An audience-only draft edit must still advance the announcement's optimistic version. `draft_audience_revision` is incremented when roles or named selectors change, giving JPA a dirty scalar to version even when title and body stay the same.
- Draft named selectors are stored in `announcement_member_selector` and resolved again against the same active farm at preview and publish. Role and named selections are unioned by membership ID, so overlapping choices create one delivery. Corrections still use the original version's delivery snapshot.
- New migration: `backend/src/main/resources/config/liquibase/changelog/20261115000100_fe07_announcement_member_selector.xml`. It adds `draft_audience_revision` with default 0 and the selector table. The workspace owner included it in shared `master.xml` for the focused integration run; existing drafts keep their data and start with no named selectors.
- New `GET /api/farms/{farmId}/announcements/recipients` returns only active eligible recipients as `{id, name, role, active}`; `id` is a FarmMembership ID. It is protected by `MANAGE_ANNOUNCEMENTS`, which enforces active membership, role and active farm. It does not depend on FE-03's `/members` response shape.
- At the time this incremental section was first drafted, the OpenAPI export was still pending. It was refreshed later as recorded under “Scope and sources”; the current rerun status is noted at the top of this file.

### Field and command contract audit

| Field / command | Contract and source of truth | Validation, permission and persistence |
|---|---|---|
| `title` | Required string, 1–150 characters (SCR-27/SCR-28) | Nonblank validation; saved as `draft_title`, copied into immutable `announcement_version.title` on publish/correction. |
| `body` | Required string, 1–5,000 characters; rich text supported by FE adapter (SCR-27/SCR-28) | Nonblank validation; saved as `draft_body`, copied into immutable `announcement_version.body`. |
| `recipientRoles` | Array of role selectors (GBR-60); owner permits Manager/Technician, Manager permits Technician | Duplicates normalized. May be empty only when `recipientMemberIds` contains an eligible member. Stored as `farm_announcement.recipient_roles`; output is always an array. |
| `recipientMemberIds` | Optional array of **FarmMembership IDs**, not account/user IDs; no SRS maximum defined (GBR-60/SCR-27) | Every ID must resolve to an ACTIVE membership in the path farm, with an allowed role, excluding the author. Duplicates are removed. Stored one row per membership in the new selector table. An omitted field on an older update client preserves saved IDs; `[]` clears them. |
| `expectedVersion` | Integer optimistic version; no version on create; required by `VersionGuard` for draft update, publish and correction | Stale or absent update value maps to `MSG-COM-05`; response version is the announcement JPA version. When roles/member IDs alone change, `draft_audience_revision` makes the JPA entity dirty so the version advances. |
| `Idempotency-Key` | Required on every mutating resource command | Command service scopes the key to farm/action and hashes the request, including selected member IDs and version. |
| `GET /announcements/recipients` | Returns `{id, name, role, active}` for the signed-in author | Only farm-scoped ACTIVE eligible memberships; no email, platform identity or inactive roster is returned. |
| Publish / correction | Publish stores immutable version, recipient delivery snapshot and `PUBLISHED` state in the service transaction. Correction uses the original version's recipient snapshot, filtered to memberships still ACTIVE in the same farm (GBR-62). | Group plus named selections resolve to unique membership IDs; each recipient gets at most one delivery per version. Later joiners are not added. |

The parent service checks `MANAGE_ANNOUNCEMENTS` on every operation and resolves the author by active membership in the farm path. Announcement loads use `(id, farmId)`; named membership resolution also includes the farm ID, so neither request can cross tenants. `GET /announcements/recipients` is one path segment and does not collide with `GET /{id}/preview` (two path segments after the base).

## Scope and sources

- Branch: `dev`, base worktree HEAD `de11943`; no commit or push was made.
- Sources reviewed: `AGENTS.md`, `RTK.md`, `backend/AGENTS.md`, `docs/agent-context/README.md`, `API_RULES.md`, `VERIFICATION.md`, `docs/REQUIREMENT_DECISIONS.md` (D12), `docs/requirements/SRS_2026-10-28.txt` (§7, GBR-60–62 and UC-FE07-02/03), `docs/requirements/specs/FE-07-thong-bao-trai.md`, the current Java entities/repositories and the exported `docs/api/openapi.json`.
- OpenAPI export was run by the workspace owner after the FE-07 Maven run. The resulting contract contains `GET /api/farms/{farmId}/announcements/{id}/preview` and the expanded `AnnouncementView` / `PublishPreview` schemas.

## Implemented

- The farm-scoped service only loads announcements by `(id, farmId)`, rechecks the caller's current farm permission and active membership, restricts drafts and mutations to the author, and applies expected-version checks to draft edits, publish and correction.
- Recipients only receive the newest version with a delivery row for their membership. The regression test gives a member version 1 while version 2 exists and verifies the member sees only version 1's title, body, timestamp, number and history.
- Corrections use the membership snapshot from version 1 and include only memberships that are still ACTIVE in the same farm. The tests cover an active/inactive/cross-farm mix and a later correction using the original snapshot. A correction is still saved if no original recipients remain ACTIVE; UC-FE07-02 does not define this as a publish error.
- Publish still requires at least one eligible recipient and leaves the draft unchanged when none remain. Unknown or role-ineligible selectors return `MSG-FE07-02` rather than being silently discarded; blank values are rejected by request validation.
- Mutating REST commands pass the farm, permission, action, idempotency key and version-bearing payload through `IdempotencyCommandService`. The resource test checks all five command routes; the existing idempotency service tests cover replay, changed payload, and revoked access.
- The frontend backend adapter uses the FE-07 recipient-options route, preview endpoint, expected versions and idempotency keys. It does not fall back to demo data. Named selections are sent as membership IDs, restored from draft responses, shown by name and can be removed individually. Missing/inactive saved selections remain visible with a remove action so a draft can be repaired.

## Verification

Backend focused tests ran on 2026-11-15 with JDK 21, profile `dev,!webapp`, `forkCount=0` (the sandbox's default temporary path caused Logback failure and Mockito's self-attach stalled; an ASCII temp directory and startup Byte Buddy agent allowed the tests to run):

```powershell
$tempRoot='C:\Users\PCASUS~1\.codex\visualizations\2026\11\01\01a19778-b21c-7b11-8bf9-740fd2980399\fe07-maven-tmp'
$env:TEMP=$tempRoot
$env:TMP=$tempRoot
$env:MAVEN_OPTS='-javaagent:C:\Users\PCASUS~1\.m2\repository\net\bytebuddy\byte-buddy-agent\1.17.6\byte-buddy-agent-1.17.6.jar -Djava.io.tmpdir=C:\Users\PCASUS~1\.codex\visualizations\2026\11\01\01a19778-b21c-7b11-8bf9-740fd2980399\fe07-maven-tmp -Djdk.attach.allowAttachSelf=true'
.\mvnw.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-DforkCount=0' '-Dtest=FarmAnnouncementServiceTest,FarmAnnouncementsResourceTest,IdempotencyCommandServiceTest' test
```

Result at the prior role-only checkpoint: **22 tests passed, 0 failures/errors/skips** (`FarmAnnouncementServiceTest` 12, `FarmAnnouncementsResourceTest` 1, `IdempotencyCommandServiceTest` 9). Maven recompiled 492 main and 301 test source files before execution. These results do not cover the incremental named-recipient code below.

Focused frontend verification used Node 22.22.2:

```powershell
$nodeDir='C:\Users\PC ASUS\.codex\visualizations\2026\11\01\01a19778-b21c-7b11-8bf9-740fd2980399\node-v22.22.2-win-x64'
& "$nodeDir\node.exe" .\node_modules\vitest\vitest.mjs run --passWithNoTests tests/unit/farm-announcements
& "$nodeDir\node.exe" .\node_modules\typescript\bin\tsc --noEmit
& "$nodeDir\node.exe" .\node_modules\typescript\bin\tsc -p tsconfig.test.json --noEmit
```

Result at the prior role-only checkpoint: **26 frontend tests passed** across the two FE-07 unit files; both TypeScript checks passed. The workspace owner subsequently reported **174/174 frontend tests**, typecheck and build passing on the combined dirty worktree. The focused UI test emitted only React Router v7 future-flag notices. `git diff --check` passed for the owned files.

Incremental frontend verification on 15/11/2026, Node 22.22.2: focused FE-07 Vitest run passed **27 tests** across both FE-07 unit files; `tsc --noEmit` and `tsc -p tsconfig.test.json --noEmit` both passed. Only React Router v7 future-flag notices were emitted. No browser runtime or visual comparison was performed.

Incremental backend verification on 15/11/2026, JDK 21, `dev,!webapp`, ASCII temp directory and Byte Buddy agent (to avoid the sandbox Logback/Mockito temp issues above):

```powershell
.\mvnw.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-DforkCount=0' '-Dtest=FarmAnnouncementServiceTest,FarmAnnouncementsResourceTest,FarmAnnouncementAudiencePersistenceTest,IdempotencyCommandServiceTest' test
```

Result: **30 tests passed, 0 failures/errors/skips**: `FarmAnnouncementServiceTest` 18, `FarmAnnouncementsResourceTest` 2, `FarmAnnouncementAudiencePersistenceTest` 1, `IdempotencyCommandServiceTest` 9. The persistence test ran on H2 with the new migration included; it read the selector back from the database, verified audience-only edits advance the version, and checked publish and correction delivery snapshots.

## Remaining gaps and limits

- H2 migration and service readback passed. Migration upgrade over an existing database with draft rows and a full authenticated HTTP mapping for the new route were not tested. The PostgreSQL smoke evidence above predates the named-recipient change; this current change has not been exercised on PostgreSQL.
- OpenAPI export/catalog refresh remains pending. `docs/api/openapi.json` is stale for the additive request/response fields and new recipient-options route until `OpenApiContractTest` passes and the exported contract is copied/refreshed.
- The SRS data contract calls for a distinct announcement detail GET. The current adapter gets detail from the farm-scoped announcement list; no `GET /api/farms/{farmId}/announcements/{id}` route was added in this slice.
- Publish and correction enqueue `ANNOUNCEMENT_PUBLISHED` / `ANNOUNCEMENT_CORRECTED` outbox events. The JOB-07 consumer and its QA readback are now recorded in `docs/testing/JOB07_HANDOFF.md`; the Owner/Manager and Technician routes for visible announcement versions are covered by the 16/11 UI increment above.
- PostgreSQL transaction/rollback behavior, a full MockMvc authenticated flow, live session permissions and JOB-07 remain unverified for the current named-recipient change. The H2 persistence test does not prove PostgreSQL behavior. UI behavior is covered by component tests; no manual browser runtime or visual comparison was performed.
- UI behavior was covered by component tests; no manual browser runtime or visual comparison was performed.
