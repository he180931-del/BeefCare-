# FE-03 / UC-FE03-02 — Xem lời mời của trại

## Scope and authority

- D26, người dùng đồng ý sáu đề xuất ngày 12/11/2026: backend + SCR-14,
  dependency đọc đúng lời mời của UC1 và refresh sau các lệnh UC3 được dùng.
- Checkout `D:/Project/BeefCare-`, branch `dev`, base
  `4d6bccdede1f72014656e8abbb3e58c0b9a7ab7e` + dirty UC1 có sẵn.
  Một agent trực tiếp thực hiện; không tạo worktree, commit, push, merge hay
  thay đổi DB dùng chung. Bản sao trước sửa nằm ở `.run/fe03-uc02-before/`,
  có SHA256 manifest; các thay đổi trước đó được giữ nguyên.
- Nguồn: `REQUIREMENT_DECISIONS.md` D12/D25/D26; SRS 28/10 Part I
  Farm Invitation/BR-D05, Part II UC-FE03-01/03, Part III Table III-1/SCR-14,
  JOB-02, GBR-09/14/16; spec FE-03 §2/3.1/5/6/7/10; OpenAPI GET invitations;
  `backend/AGENTS.md`, `api-handoff.html`, `backend-workflow.html` BE01.
- UC5/UC7 của Q2 còn mở. Không chứng nhận toàn UC3/UC4/UC6 hay FE-03.

## Contract and field matrix (agreed before implementation)

| Field | Type / required / default | Validation, source and round trip |
|---|---|---|
| path.farmId | positive Long, required | Resource → service authorization → ACTIVE Owner membership đúng farm; mọi service status, account vẫn ACTIVE. D26/GBR-09/14 |
| query.status | optional enum; absent/blank = all | PENDING/ACCEPTED/EXPIRED/CANCELLED, trim/case-insensitive. UI mặc định PENDING. D26/SCR-14 |
| query.page | integer, default 0 | 0..21474836; zero-based API, one-based UI; invalid → COM-10. D26/Table III-1 |
| query.size | integer, default 20 | 1..100; UI luôn 20. D26/Table III-1 |
| query.sort / dir | lastSentAt / asc or desc, default desc | Stable id DESC tie-breaker; column button; đổi tab/sort về page 0. D26 |
| query.invitationId | optional positive Long | Exact lookup scoped by farm for UC1 AF1; counts vẫn toàn trại, không chỉ dò trang đầu. D26 dependency |
| items[].id | Long, required, read-only | FarmInvitation.id → InvitationView.id → adapter → row key / observed command target |
| items[].email | email string, required | invitedEmail → DTO.email → Recipient; no platform account state. SCR-14/D25 |
| items[].hasAccount | boolean, required | Current case-insensitive AppUser email existence → accountHint → Has/No account; not historical delivery or verification status. D25/D26 |
| items[].role | MANAGER/TECHNICIAN, required | proposedRole → DTO → Vietnamese role label; no Owner/platform invite. GBR-16 |
| items[].createdAt | UTC instant, required, read-only | Stored creation time, preserved in adapter; not used for last-sent sorting |
| items[].lastSentAt / expiresAt | UTC instant, required | Stored timestamps → DTO → display dd/mm/yyyy HH:mm in farm.timeZone. SCR-14/Table III-1 |
| items[].validityDays | integer 3/7/14, required | Stored duration for UC1 resend confirmation. D25/GBR-16 |
| items[].status | four-state enum, required | PENDING + expiresAt <= one asOf → effective EXPIRED; no write. Effective status used consistently for filter/count/page/actions. D26/JOB-02 |
| items[].version | integer >=0, required | Stored optimistic version retained; command uses version shown before confirmation. BR-D31/D25 |
| counts | four nonnegative integers, required | All invitations in authorized farm before status/id/page filtering; zero states explicitly present. D26 |
| total / page / size | nonnegative total, page/size metadata, required | total after status/id filtering; items from one bounded DB page. D26 |
| asOf | UTC instant, required | One server clock for query, counts and effective status; presentation read only. D26 |
| UI status / sort preferences | session state per account + farm | URL and sessionStorage preferences only; no credentials, tokens or backend data fallback |

GET does not create membership, audit, outbox, mail intent, update invitation
status or increment its version. No persistence field or migration is added.
All six SCR-14 columns occur once; ID/version/duration/createdAt remain metadata.

## Test inventory and baseline

| Where | What and why |
|---|---|
| FarmInvitationListResourceTest / FarmInvitationListPostgresIT | Secured HTTP, actual DB paging/sort/filter/counts, exact expiry and read-only storage, isolation/account hint, invalid query, inactive-service withdrawal; validate real query and permission boundaries |
| frontend/tests/unit/farm-workspace/InvitationsPage.test.tsx | Page interactions, preferences, farm timezone, loading/retry/empty, inactive-service actions and observed command version |
| frontend/tests/unit/farm-workspace/invitationListAdapter.test.ts | Query and complete response mapping; reject malformed/legacy response and backend failure without demo fallback |
| Existing UC1 suites + focused regression | Exact lookup outside first page; create/resend/readback and queued email behavior remain intact |

Baseline freshly run before production changes: frontend 67/67; backend
Surefire 28/28. Initial environment-only failures were resolved by selecting
`VITE_BEEFCARE_DATA_SOURCE=local` / `VITE_BEEFCARE_AUTH_MODE=mock` for demo
tests, and explicit existing Maven repository `C:/Users/nvkha/.m2/repository`.
Active frontend `.env` is backend mode; no env file was changed.

## Defects and regression evidence

1. **P1 / FE03-UC2-01 — PostgreSQL count query fails.** Reproduce:
   `FarmInvitationListPostgresIT#filtersEachStatusWithoutChangingOtherTabCounts`.
   Expected: 200 with effective-state counts. Actual: 500, PostgreSQL 42803,
   CASE expression parameters in SELECT/GROUP BY do not identify the same group.
   H2 passed; the existing secured PostgreSQL tests are the focused RED regression.
   Fix: conditional aggregates at one clock, without grouping a parameterized CASE.
2. **P2 / FE03-UC2-02 — loading storage failure uses a save message.** Source
   review found the UC1 command exception handler is shared by GET. Expected
   COM-03 for a list read, while writes keep COM-02/COM-05. Regression layer:
   `FarmMembershipResourceErrorsTest`, mocked storage error through MockMvc.
3. **P2 / FE03-UC2-03 — incomplete list row silently invents ID/version/hint.**
   Reproduce `invitationListAdapter.test.ts` with missing id/version/hasAccount/
   lastSentAt: four RED cases. Expected: reject the invalid contract; actual:
   coercion/default/undefined. Fix stays at the list response boundary.

## Final verification — 13/11/2026

| Gate | Fresh result | Evidence |
|---|---|---|
| Frontend feature unit | **86/86 PASS**, 13 files | `.run/fe03-uc02-green-frontend.log`; includes UC1 regression, paging/filter/sort/counts, last-page recovery, pinned confirmation version, account/farm session preferences and UTC farm-timezone case |
| Typecheck / build | **PASS / PASS** | `.run/fe03-uc02-typecheck.log`, `.run/fe03-uc02-build.log`; existing >500kB chunk warning remains |
| Surefire | **52/52 PASS** | 22 list/security/H2 HTTP cases, 15 secured UC1 command cases, 5 committed transaction cases, 5 membership service cases, 4 error-contract cases, 1 OpenAPI export |
| Failsafe | **42/42 PASS** on **PostgreSQL 16.15** | 22 inherited list cases + 15 UC1 secured commands + 5 committed transaction/email/concurrency cases; real JDBC metadata asserted, isolated schemas |
| Checkstyle | **0 violations** | `.run/fe03-uc02-verify-backend.log`; Spotless, JaCoCo and Modernizer skipped explicitly per existing local workflow |
| OpenAPI/catalog | **PASS** | Export copied only after OpenApiContractTest passed; 229 paths / 283 operations / 311 schemas; generator rerun; GET fingerprint `62daba960ea9b5f3ee24` |
| HTML handoff QA | **PASS** | Search + FE-03/status filter, GET query/output fields (expanded HTTP 200), verified tab, JSON/HTML export and JSON import; temporary browser context, no JS errors; `.run/fe03-uc02-catalog-check.log` |

Exact frontend commands, from `frontend/`:

```powershell
$env:VITE_BEEFCARE_DATA_SOURCE='local'
$env:VITE_BEEFCARE_AUTH_MODE='mock'
.\node_modules\.bin\vitest.cmd run tests/unit/farm-workspace
npm.cmd run typecheck
npm.cmd run build
```

Demo tests explicitly select local/mock; backend adapter tests explicitly
construct backend mode and reject legacy arrays, incomplete rows and read
failures. The active `.env` remains backend mode and was not edited.

Backend command, from `backend/` (existing Maven installation/cache, JDK 21):

```powershell
mvn.cmd --batch-mode -o '-Dmaven.repo.local=C:/Users/nvkha/.m2/repository' '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dmodernizer.skip=true' '-Dapi.version=1.44' '-Duser.timezone=Asia/Ho_Chi_Minh' '-Dlogging.level.org.hibernate.SQL=OFF' '-Dtest=FarmInvitationListResourceTest,FarmMembershipServiceTest,FarmMembershipResourceErrorsTest,FarmInvitationCommandResourceTest,FarmInvitationTransactionTest,OpenApiContractTest' '-Dit.test=FarmInvitationListPostgresIT,FarmInvitationCommandPostgresIT,FarmInvitationPostgresIT' verify
```

Test compilation required sandbox escalation because Java ZipFS could not
resolve JAR paths in the read-only external Maven cache; no dependency was
installed or changed. `api.version=1.44` matches the existing Docker setup.
`docs/tools/generate_api_catalog.py` was run with an existing uv-managed
Python 3.12 discovered on this machine, without installing Python/packages.

RED evidence: `.run/fe03-uc02-red-frontend.log` (missing contract/UI),
`.run/fe03-uc02-red-backend.log` (old array/query behavior),
`.run/fe03-uc02-validation-red.log` (four incomplete-row cases),
`.run/fe03-uc02-loading-red.log` (COM-03 expected, COM-02 actual).
The first PostgreSQL run exposed SQL 42803; all 42 PostgreSQL cases passed
after replacing grouped parameterized CASE with conditional aggregates.

## Runtime and manual visual evidence

- Consulted `.agents/skills/playwright-cli/SKILL.md`. The project copy has no
  referenced `references/` files and the global CLI is absent. Used existing
  playwright-core + installed Chrome headless as an explicit fallback; no
  runner, browser binary, package, E2E suite or baseline was added.
- Named in-memory sessions: `fe03-uc02-before`, `fe03-uc02-after`.
  Before served the preserved UC1 source snapshot with a read-only Vite load
  override on `http://127.0.0.1:5176`; after served current source on
  `http://127.0.0.1:5175`. Both used `mode=mock`, same historical Figma fixture,
  Owner mock login through UI, route `/loi-moi?farmId=1`, PENDING state.
- Both **1180×820** and **1440×900**: route loaded, six columns readable,
  controls fit, horizontal/vertical document overflow **false**. Manual image
  comparison preserves the existing layout and adds Refresh/sort/pagination.
- Actions checked after capture: sort ASC changes actual row order and
  aria-sort; Expired has no commands; Members → Invitations restores Expired
  and ASC; Refresh keeps the filter. Unit tests cover >20 rows, inactive
  service, cancellation, errors and version handling beyond this demo capture.
- Artifacts and exact per-file SHA256 checkpoints:
  `.run/fe03-uc02-runtime/manifest.json`,
  `before--pending--1180x820.png/.yml`, `after--pending--1180x820.png/.yml`,
  and the corresponding `1440x900` files in that directory. Each capture phase
  records its own checkpoint; no source was swapped/reset in the workspace.
- Console: the same existing `/favicon.ico` 404 before/after; **no JS
  exceptions**, no failed feature requests. These are local demo captures,
  so they do not prove browser → backend HTTP integration.
- No route interception, storage injection, real credentials, provider calls
  or persisted browser profile. Only UI login and filter preferences changed
  within temporary contexts. Contexts, Chrome and both Vite servers were closed.
- Evidence is **manual runtime + manual before/after image comparison**;
  not an automated visual-regression test or a newly approved Figma baseline.

## Change inventory, state and limits

- Backend: MembershipDtos, FarmMembershipResource, FarmMembershipService,
  FarmInvitationRepository, AppUserRepository, BackendApiDocumentationConfiguration;
  new FarmInvitationListResourceTest/FarmInvitationListPostgresIT;
  updated UC1 CommandResource/Transaction, ResourceErrors and OpenApiContract tests.
- Frontend: InvitationsPage, farmWorkspaceApi, types, demo-store list envelope,
  InviteDialog exact lookup, optional timezone formatting; new page/adapter unit
  tests and updated UC1/demo/seed fixtures/assertions for the envelope.
- Docs: D26, approved SRS GBR-14 exception, spec/Q2/TC-03-35…45, OpenAPI/catalog,
  API README, UC1/UC2 examples and this review. No migration or dependency change.
- All dirty/untracked UC1 work present at entry was preserved. No reset, stash,
  branch switch, commit, push, merge or shared DB reset. Temporary evidence and
  source backups stay under ignored `.run/`.
- **BE_REVIEWED locally on dev; not READY_FOR_FE.** No main/integration deployment
  or live browser → backend smoke was verified in this turn. UC3/UC4/UC6 and
  other FE-03 questions remain outside certification. SMTP/live delivery and
  account login/session end-to-end are not newly certified by these MockMvc
  tests. GET idempotency/version/rollback are N/A because it is read-only;
  linked command behavior is covered by the scoped UC1/withdrawal regression.

## Review lần 2 (14/11/2026)

Review UC2 trên `feat/fe03-thanh-vien-quyen` (đã push tại `401fece`), so bản sao
`.run/fe03-uc02-before/` với HEAD. Người dùng yêu cầu sửa cả ba điểm.

| # | Phát hiện | Xử lý | Regression |
|---|---|---|---|
| 1 | Đổi `GET /invitations` sang trang là breaking, nhưng `BrowserSessionFlowIT#ownerInvitesOverHttpAndTheInviteeAcceptsExactlyOnce` vẫn đọc mảng (`$.length()` mong 1, thực tế 6). Bộ test ở mục "Final verification" không gồm IT này nên không thấy; phần sau của luồng HTTP (link email, chấp nhận đúng một lần) bị dừng | Khẳng định `$.items.length()`, `$.items[0].id`, `$.total`, `$.counts.PENDING` | Chính IT đó: RED 17/18 (log `%TEMP%/claude-fe03-uc2-browserflow.log`) |
| 2 | OpenAPI xuất `page`, `size`, `invitationId` là `"type":"string"` kèm min/max, không có giá trị mặc định: `@Schema` thiếu `type` | `type="integer"`, `format`, `defaultValue` theo mẫu FE-19 (`SubscriptionPaymentResource`); `sort`/`dir` thêm default | `OpenApiContractTest`: kiểu, min/max, default số của từng tham số; `status` không có default. RED lấy từ `docs/api/openapi.json` đã commit, không chạy riêng |
| 3 | SCR-13 mở popup Mời không truyền `timeZone`, nên toast "Hết hạn lúc" theo giờ Việt Nam trong khi SCR-14 theo múi giờ trại (D26) | `MembersPage` truyền `farm.timeZone` | `InviteDialog.test.tsx`: trại UTC, cả `/loi-moi` và `/thanh-vien` hiện `03:00`; RED `/thanh-vien` |

### Kết quả kiểm lại

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| Frontend feature unit | **90/90 PASS**, 13 file | `VITE_BEEFCARE_DATA_SOURCE=local`, `vitest run tests/unit/farm-workspace` |
| Frontend typecheck + build | **PASS** | `npm run typecheck`, `npm run build` |
| Backend Surefire (H2) | **54/54 PASS** | FarmInvitationListResourceTest 22, FarmInvitationCommandResourceTest 17, FarmInvitationTransactionTest 5, FarmMembershipServiceTest 5, FarmMembershipResourceErrorsTest 4, OpenApiContractTest 1 |
| Backend Failsafe | **62/64**; 2 lỗi email flaky | PostgreSQL 16.15: FarmInvitationListPostgresIT 22, FarmInvitationCommandPostgresIT 17, FarmInvitationPostgresIT 5; H2: EmailActivationFlowIT 2, BrowserSessionFlowIT 18. Fail: `BrowserSessionFlowIT#verificationLinkCanBeResentAndOnlyTheNewestLinkWorks`, `EmailActivationFlowIT#failedMailProviderDeliveryIsRetriedFromThePersistedJob` (FE-01, xác minh email); chạy riêng **3/3 PASS** (log `%TEMP%/claude-fe03-uc2-email.log`), cùng loại lỗi flaky đã biết khi nhiều IT email chạy chung |
| Checkstyle | **0 vi phạm** | cùng lệnh `verify` (log `%TEMP%/claude-fe03-uc2-fix2.log`) |
| OpenAPI | **PASS** | Bản export khác bản commit đúng 10 điểm ở tham số `GET /invitations`; chỉ ghép khối `parameters` (export còn đảo thứ tự schema `Page`, không chép nguyên file) và khẳng định tương đương ngữ nghĩa với export |
| API catalog | **PASS** | `docs/tools/generate_api_catalog.py` (Python 3.12): 229 paths / 283 operations; signature GET đổi `62daba960ea9b5f3ee24` → `51a2a18ce7956cd7a576`, cập nhật `review-state` của GET sau khi kiểm round-trip JSON |

`BrowserSessionFlowIT` còn một chỗ đọc mảng thứ hai (`?status=ACCEPTED`, sau bước
chấp nhận); chỗ này chỉ lộ ra khi chỗ đầu đã sửa, và cũng đã đổi sang `items`/`counts`.

### Chưa kiểm chứng

- Chưa chạy browser với backend thật (bằng chứng runtime phía trên là chế độ demo).
- Không chạy lại toàn repository suite.
