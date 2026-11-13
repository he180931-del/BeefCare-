# FE-03 / UC-FE03-01 — Gửi lời mời thành viên

## Scope và checkpoint

- Quyết định: D25, người dùng đồng ý bốn đề xuất ngày 11/11/2026.
- Workspace: `D:/Project/BeefCare-`, branch `dev`, checkpoint ban đầu
  `4d6bccdede1f72014656e8abbb3e58c0b9a7ab7e`; trạng thái ban đầu sạch.
- Làm trực tiếp tại workspace được người dùng cung cấp, một người ghi; không
  tạo worktree, commit, push hay chuyển nhánh.
- Backend + popup SCR-13/SCR-14, đọc lại lời mời và email; nối nhánh Gửi lại
  UC3 / Kích hoạt lại UC6. UC4 và các UC còn lại không được chứng nhận bởi gói này.

## Nguồn đã đối chiếu

- `docs/REQUIREMENT_DECISIONS.md`: D12 (SRS 28/10), D25.
- `docs/requirements/specs/FE-03-thanh-vien-quyen.md`: §2–5, popup Mời ở §6,
  A3–A6/A2 ở §7, MSG-FE03 ở §8, TC-03-01…09/34, Q1/Q4 ở §10.
- `docs/requirements/SRS_2026-10-28.txt`: entity Farm Invitation (P160),
  BR-D04/05/13, UC-FE03-01 main/AF1–4/E1–5, phần phụ thuộc UC3/UC6,
  Part III Table III-1, popup Invite Member (P841), Table III-2,
  JOB-07 (P1759), GBR-04/06/09/14/16/18/86/88/89 và MSG-COM/FE03.
- `docs/agent-context/{README,ARCHITECTURE,API_RULES,VERIFICATION}.md`,
  `backend/AGENTS.md`, `docs/backend-workflow.html` (BE1/workflow),
  `docs/api-handoff.html` (invitation operations), `docs/api/openapi.json`.
- DTO/resource → FarmMembershipService → repository/entity, audit,
  IdempotencyCommandService → MailService/EmailDeliveryJobService;
  farmWorkspaceApi → InviteDialog/MemberChangeDialog → SCR-13/SCR-14.

## Ma trận trường / contract

| Trường | Kiểu, required/default | Luật và nguồn | Đường lưu/đọc |
|---|---|---|---|
| farmId | Long, bắt buộc ở URL | Owner đúng trại; trại ACTIVE ở mỗi lệnh mời/gửi lại; GBR-09/16 | FarmInvitation.farm; DTO không cho chọn tenant bằng body |
| farmName | string, chỉ đọc | Trại hiện tại, popup Invite Member | Farm.name → getFarm → popup/email |
| email | string, bắt buộc, ≤254, mặc định trống | Email hợp lệ; trim + so sánh không phân biệt hoa thường; ACTIVE → FE03-02, INACTIVE → FE03-21, PENDING → FE03-03 | InviteRequest.email → invitedEmail → InvitationView.email |
| role | MANAGER/TECHNICIAN, bắt buộc, UI không chọn sẵn | Bộ quyền cố định Table III-2; không mời Owner/platform | proposedRole → InvitationView.role/email; chưa tạo membership |
| validityDays | integer 3/7/14; optional, default 7 | GBR-16; API hiện có dùng validityDays, không thêm field song song validDays | validityDays; lastSentAt + n×24h → expiresAt |
| Idempotency-Key | string header, bắt buộc, một khóa mỗi ý định | GBR-88; cùng key/body replay, khác body COM-19 | IdempotencyRecord; lời mời/audit/outbox/mail intent cùng commit |
| id/status/createdAt/lastSentAt/expiresAt/version | backend sinh, chỉ đọc | PENDING trước khi chấp nhận; HTTP thành công xác nhận lưu, không xác nhận phát email; D25 | invitation table → GET invitations → FE state |
| hasAccount / accountHint | boolean ở API; FE map HAS_ACCOUNT/NO_ACCOUNT, chỉ đọc | SCR-14 hiển thị hint có tài khoản; không tiết lộ SUSPENDED | kiểm account bằng email → InvitationView.hasAccount → UI accountHint |
| token | secret, không ở response/state của Owner | Hash + nonce nguồn, link dựng khi gửi; không lưu bearer thô | tokenHash/tokenNonce; job chỉ giữ tham chiếu lời mời |
| membershipId (FE03-21) | Long ở error params | D25: chỉ mở UC6; chưa thay membership | membership của email trong cùng trại |
| expectedVersion (UC3/UC6) | integer, bắt buộc khi cập nhật | GBR-89: dùng phiên bản người dùng đã xem, COM-05 nếu cũ | DTO command → VersionGuard |
| effectiveDate/reason (UC6) | date không tương lai; reason bắt buộc ≤500 | GBR-18; REACTIVATE giữ role hiện tại | FarmMembership.effectiveDate/changeReason + audit |

## Baseline / phát hiện trước sửa

- Git sạch, không còn trạng thái unmerged từ lượt phân tích trước.
- Frontend `.env` chọn backend. Lượt baseline đầu 40 pass / 15 fail vì các
  test demo page gọi backend; không sửa .env. Chạy lại với biến môi trường của
  riêng tiến trình `VITE_BEEFCARE_DATA_SOURCE=local`: 55/55 pass.
- Maven wrapper Windows lỗi `Cannot index into a null array` trước Maven;
  dùng Maven 3.9.16 đã cài, cùng version khai báo wrapper. Không sửa wrapper.
- Những vấn đề source cần regression trong scope:
  - P1, UC1 AF2: backend dùng mã chưa chốt FE03-REACTIVATE, FE không có nút
    mở UC6; mong đợi FE03-21 và popup yêu cầu ngày/lý do (D25).
  - P1, UC1 AF1: FE chỉ in lỗi trùng, thiếu đề nghị Gửi lại; mong đợi Owner
    xác nhận gửi lại đúng lời mời, giữ email/role (SRS UC1/UC3).
  - P2, UC1 AF4: UI báo đã gửi khi mới xếp hàng; mong đợi thông báo D25.
  - P1, JOB-07: lời mời dừng sau 8 lần lỗi thay vì retry tối đa 24h; mong đợi
    retry bền vững trong 24h, ngừng khi link không còn hợp lệ.
  - P1, GBR-88/89: adapter sinh key mới mỗi lần thử và lấy version mới ngay
    trước cập nhật; cần giữ key theo ý định và version của dữ liệu đã xem.
  - P1, API field contract: lỗi Bean Validation chưa có COM-06/10, thiếu key
    chưa có COM-06, lỗi persistence chưa có COM-02; giữ conflict COM-05.
    Regression: FarmInvitationCommandResourceTest + FarmMembershipResourceErrorsTest.
  - P1, hết hạn trước JOB-02: chuyển EXPIRED thiếu audit và cần flush trạng thái
    cũ trước insert để nhả unique PENDING trên PostgreSQL. Regression:
    aNewInvitationReplacesAnExpiredPendingRowBeforeTheExpiryJobRuns.
  - P2, UC6: ngày mặc định/validation dùng UTC nên ngày hôm nay Việt Nam bị coi
    là tương lai trong 00:00–06:59. Regression: validation.test.ts (clock cố định).
  - P1, OpenAPI: thiếu required email/role; schema integer lại xuất enum/default
    dạng string từ annotation. Regression OpenApiContractTest yêu cầu enum số,
    default số và null alternative trong OpenAPI 3.1; customizer chỉ sửa InviteRequest.

## Test đã thống nhất

| Vị trí | What | Why |
|---|---|---|
| frontend/tests/unit/farm-workspace/InviteDialog.test.tsx; MemberPages.test.tsx | Required/default, lưu/đọc, lỗi inline, AF1/AF2, thông báo queued, key/version và giữ form khi lỗi | Hai nhánh dùng được từ cả SCR-13/SCR-14; không tự thao tác khi chưa xác nhận |
| frontend/tests/unit/farm-workspace/backendIsolation.test.ts | Payload/key/version và response backend, không dùng demo fallback | Contract tới đúng endpoint và không che lỗi API |
| backend/.../web/rest/FarmInvitationCommandResourceTest.java | Quyền/tenant/service, field, trùng email, inactive, suspended recipient, replay và nhánh resend/reactivate | Bảo vệ truy cập và state qua security chain thực |
| backend/.../web/rest/FarmInvitationTransactionTest.java; FarmInvitationPostgresIT.java | Commit/readback ở transaction mới, rollback, gửi email, retry/deadline và cạnh tranh khi áp dụng | HTTP thành công chưa đủ chứng minh persistence, atomicity hoặc email |
| backend/.../web/rest/FarmMembershipResourceErrorsTest.java; OpenApiContractTest.java | Mã lỗi của controller và schema required/numeric/null của invitation | Client nhận đúng contract, không lộ lỗi DB; không dùng string cho duration số |

Không thêm runner E2E/visual regression. Kiểm browser nếu đủ dịch vụ/CLI là
manual runtime evidence ở 1180×820 và 1440×900, không phải automated E2E.

## Thay đổi và giới hạn phạm vi

- Giữ route/ID và schema lưu hiện có, không có migration. `validityDays` được
  giữ theo DTO đang dùng; spec A4 và ví dụ đã đồng bộ, không thêm validDays.
- HTTP 201 xác nhận transaction đã commit; email được tạo intent bền vững.
  D25 thay câu toast, không đưa trạng thái kỹ thuật/hàng đợi vào flow người dùng.
- Branch trùng và inactive tải đúng bản ghi trong cùng trại trước khi đề nghị
  thao tác, giữ snapshot version qua xác nhận. Key giữ theo ý định; đổi input
  tạo key mới. Giữ form khi lỗi, hỏi khi bỏ dữ liệu đã nhập.
- Reactivate dùng popup UC6 ở cả hai nguồn, không tự thay role. Ngày mặc định
  và validation theo Asia/Ho_Chi_Minh. Chỉ kiểm phần UC6 được UC1 gọi.
- API hasAccount chỉ phản ánh có tài khoản; không cho Owner biết accountStatus.
- Handler validation/storage ở FarmMembershipResource chỉ tác động nhóm route
  của resource này; response error metadata của members và invitation accept
  cũng thay đổi. Không chứng nhận toàn UC4/UC5 hoặc các chức năng platform.
- Bổ sung day deadline chỉ cho email INVITATION; PAYMENT_RECEIPT giữ logic cũ,
  các template khác giữ giới hạn hiện có. Không thêm consumer outbox feature khác.

## Công cụ / môi trường

- JDK 21.0.11, Maven cài sẵn 3.9.16 (wrapper cùng version nhưng script Windows
  lỗi trước khi khởi động Maven); không sửa hoặc cài wrapper/dependency mới.
- H2 cho vòng phản hồi; PostgreSQL **16.15** thật trong schema test riêng của
  hai lớp PostgreSQL. Mỗi lớp tự xác nhận product/version qua JDBC.
- Docker Engine 29.9.2: client mặc định của Testcontainers không tương thích;
  tham số riêng tiến trình `-Dapi.version=1.44` giải quyết. JDBC gửi alias
  `Asia/Saigon` bị PostgreSQL từ chối, dùng `-Duser.timezone=Asia/Ho_Chi_Minh`.
  Không sửa Docker settings, timezone OS, `.env` hay DB chung.
- `verify` lần đầu bị Modernizer chặn bởi 38 vi phạm; theo RTK chạy lại với
  `-Dmodernizer.skip=true`. Spotless và JaCoCo cũng skip theo command chuẩn.
  Checkstyle không có lỗi. Không gọi đây là đã qua toàn bộ quality gates.
- Python host không cài; dùng Python 3.10.12 có sẵn trong image local
  `mcr.microsoft.com/mssql/server:2022-latest`, `--pull=never --network none
  --entrypoint /usr/bin/python3`, chạy đúng `docs/tools/generate_api_catalog.py`.
  SQL Server không khởi động. Container `--rm`; không cài/tải runtime.
- Đã đọc `.agents/skills/playwright-cli/SKILL.md`; các reference được dẫn không
  có trên checkout. Global CLI không có, local `npx --no-install` ở offline
  trả ENOTCACHED. Không cài CLI/runner/browser và không tạo screenshot giả.
  Không có manual runtime/side-by-side hoặc automated visual evidence.
- Các skill TDD/React/Verification mà RTK dẫn tới đường dẫn macOS không tồn tại
  trên máy này; tìm trong các skill root Windows không có bản tương ứng. Dùng
  test-first, rà DTO/tenant/state và bằng chứng mới của repo; không tuyên bố đã
  chạy các skill vắng mặt.

## Kết quả

**Đã triển khai và BE_REVIEWED trong working tree; chưa READY_FOR_FE.**

| Kiểm tra cuối | Kết quả | Bằng chứng |
|---|---|---|
| Frontend feature unit | **67/67 PASS**, 11 file | InviteDialog 9, backendIsolation 7, MemberPages 8, validation 16, các regression farm-workspace còn lại; Vitest log ở TEMP/beefcare-fe03-final.log |
| Frontend typecheck + build | **PASS** | tsc cho app + test; Vite build thành công, còn cảnh báo chunk >500 kB; TEMP/beefcare-fe03-build.log |
| Backend Surefire | **29/29 PASS** | FarmMembershipServiceTest 5, FarmInvitationCommandResourceTest 15, FarmInvitationTransactionTest 5, FarmMembershipResourceErrorsTest 3, OpenApiContractTest 1 |
| Backend Failsafe | **22/22 PASS** | PostgreSQL 16.15: FarmInvitationCommandPostgresIT 15 + FarmInvitationPostgresIT 5; H2 email regression EmailActivationFlowIT 2 |
| Checkstyle | **0 issues** | backend/target/checkstyle-result.xml |
| Export/catalog | **PASS** | OpenApiContractTest → target/beefcare-openapi.json → docs/api/openapi.json; script catalog: 229 paths, 283 operations, 283 source snapshots |
| Diff hygiene | **PASS** | git diff --check |

Command frontend (PowerShell, từ frontend; chỉ đổi env của tiến trình test,
không sửa `.env` backend của người dùng):

```powershell
$env:VITE_BEEFCARE_DATA_SOURCE='local'
.\node_modules\.bin\vitest.cmd run tests/unit/farm-workspace --maxWorkers=2 --minWorkers=1
npm.cmd run typecheck
npm.cmd run build
```

Command backend cuối (từ backend), log `target/fe03-verification.log`:

```powershell
mvn.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dmodernizer.skip=true' '-Dapi.version=1.44' '-Duser.timezone=Asia/Ho_Chi_Minh' '-Dlogging.level.org.hibernate.SQL=OFF' '-Dtest=FarmMembershipServiceTest,FarmMembershipResourceErrorsTest,FarmInvitationCommandResourceTest,FarmInvitationTransactionTest,OpenApiContractTest' '-Dit.test=FarmInvitationCommandPostgresIT,FarmInvitationPostgresIT,EmailActivationFlowIT' verify
```

Các RED trước sửa được giữ trong `backend/target/fe03-{red,email-red,
boundaries-red,openapi-red}.log` và TEMP/beefcare-fe03-red.log. Lỗi import/mock
fixture ban đầu đã sửa trước khi dùng kết quả làm bằng chứng RED nghiệp vụ.
Retry RED sau khi fixture đúng: sau lần 8 job FAILED thay vì PENDING; contract
RED thiếu required; boundary RED thiếu audit/MSG-COM; frontend RED thiếu nút,
key/version, toast/inline và xác nhận bỏ input.

### Round trip được chứng minh

- Adapter FE gửi email/role/validityDays và key thật của ý định, map response
  `hasAccount`; test không trộn demo với backend, không refresh version trước ghi.
- Secured MockMvc + CSRF → DTO/validation/owner-tenant-service guard → command
  transaction → GET invitations → JSON đủ giá trị. Kiểm cả 3/7/14 và default 7,
  email không có tài khoản, recipient SUSPENDED, ACTIVE/INACTIVE, email trùng
  khác hoa thường, farm không ACTIVE và caller sai quyền/trại.
- `FarmInvitationTransactionTest` và bản PostgreSQL **không có transaction
  bao ngoài**: HTTP đã commit rồi mới JDBC đọc invitation/membership/audit,
  idempotency, outbox và mail intent. Một lời mời, một audit, một outbox, một
  mail intent; membership vẫn chỉ có Owner. Cùng key/body replay, khác body
  COM-19; hai transaction/request cạnh tranh chỉ commit một lời mời.
- Lỗi ném sau khi service đã lưu invitation/audit/mail intent rollback toàn bộ
  command; DB không còn invitation/audit/outbox/key/job và cùng key thử lại được.
  Đây là kiểm transaction thật; không giả rằng đã mô phỏng mọi lỗi vật lý DB.
- Dispatcher được gọi chủ động, không sleep: email tiếng Việt đúng role và
  giờ VN, link từ plain text khớp hash lưu DB, không có bearer trong response
  Owner. Provider failure giữ PENDING; lần 9 vẫn retry trong 24h, đến deadline
  FAILED mà invitation còn nguyên. Email sink là MOCK trong bộ nhớ.
- Resend dùng cùng ID/email/role và số ngày, cập nhật giờ/hạn và đổi hash;
  stale version bị COM-05. Tạo mới sau hạn nhưng trước JOB-02 giải phóng key
  PENDING cũ, chuyển EXPIRED và có audit. Reactivate bắt buộc ngày/lý do,
  ngày tương lai COM-07, giữ MANAGER dù form mời đã chọn TECHNICIAN.
- Frontend component tests chứng minh cả SCR-13 và SCR-14: mở hai nhánh có
  xác nhận, không ghi sớm, giữ input/key khi lỗi, reload dữ liệu sau thành công,
  inline ACTIVE error và xác nhận khi bỏ dữ liệu đã nhập.

### Handoff và phần chưa kiểm

- Quyết định D25, spec/Q1 và phần invitation của Q4 đã cập nhật. Ví dụ:
  `docs/api/FE03_UC01_EXAMPLES.md`. Catalog giữ review state FE-19 đã có;
  chỉ thêm evidence các operation UC1/phần phụ thuộc đã kiểm.
- Chưa có manual browser/runtime/side-by-side tại 1180×820 hoặc 1440×900;
  không có ảnh trước/sau và không có automated E2E/visual test. Không suy
  component test thành bằng chứng browser thực.
- Chưa gửi SMTP thật/Mailpit trong lượt này; chỉ MOCK. Chưa chạy toàn repository
  suite hoặc các UC khác. UC4, UC5, toàn UC3/UC6, và phần platform của Q4 ngoài
  gói nghiệm thu này.
- Không migration; PostgreSQL schema test riêng, không reset DB chung. Container
  Python tạm tự xóa; không mở browser/session hay tạo auth storage artifact.
- Chưa commit/push/chuyển nhánh/gộp main; HEAD vẫn
  `4d6bccdede1f72014656e8abbb3e58c0b9a7ab7e`, toàn bộ thay đổi để người dùng
  review trong working tree trên `dev`. Không chứng nhận bản main/READY_FOR_FE.

### Final source checkpoint / files changed

Production diff SHA-256: `e1fae02b7174ab414793e5b4b4e448f5a3aba74638659ffa077aa7c719e996f3`

```text
 M backend/src/main/java/vn/edu/fpt/beefcare/config/BackendApiDocumentationConfiguration.java
 M backend/src/main/java/vn/edu/fpt/beefcare/service/FarmMembershipService.java
 M backend/src/main/java/vn/edu/fpt/beefcare/service/MessageCodes.java
 M backend/src/main/java/vn/edu/fpt/beefcare/service/dto/MembershipDtos.java
 M backend/src/main/java/vn/edu/fpt/beefcare/service/email/EmailDeliveryJobService.java
 M backend/src/main/java/vn/edu/fpt/beefcare/web/rest/FarmMembershipResource.java
 M backend/src/main/resources/i18n/domain_messages.properties
 M backend/src/main/resources/i18n/domain_messages_vi.properties
 M backend/src/test/java/vn/edu/fpt/beefcare/web/rest/OpenApiContractTest.java
 M docs/REQUIREMENT_DECISIONS.md
 M docs/api-handoff.html
 M docs/api/openapi.json
 M docs/requirements/specs/FE-03-thanh-vien-quyen.md
 M docs/requirements/specs/OPEN_QUESTIONS.md
 M frontend/src/features/farm-workspace/api/farmWorkspaceApi.ts
 M frontend/src/features/farm-workspace/components/InviteDialog.tsx
 M frontend/src/features/farm-workspace/components/MemberChangeDialog.tsx
 M frontend/src/features/farm-workspace/components/WorkspaceUi.tsx
 M frontend/src/features/farm-workspace/data/farmWorkspaceDemoStore.ts
 M frontend/src/features/farm-workspace/pages/InvitationsPage.tsx
 M frontend/src/features/farm-workspace/types.ts
 M frontend/src/features/farm-workspace/validation.ts
 M frontend/tests/unit/farm-workspace/MemberPages.test.tsx
 M frontend/tests/unit/farm-workspace/backendIsolation.test.ts
 M frontend/tests/unit/farm-workspace/validation.test.ts
?? backend/src/test/java/vn/edu/fpt/beefcare/web/rest/FarmInvitationCommandPostgresIT.java
?? backend/src/test/java/vn/edu/fpt/beefcare/web/rest/FarmInvitationCommandResourceTest.java
?? backend/src/test/java/vn/edu/fpt/beefcare/web/rest/FarmInvitationPostgresIT.java
?? backend/src/test/java/vn/edu/fpt/beefcare/web/rest/FarmInvitationTransactionTest.java
?? backend/src/test/java/vn/edu/fpt/beefcare/web/rest/FarmMembershipResourceErrorsTest.java
?? docs/api/FE03_UC01_EXAMPLES.md
?? docs/reviews/FE03_UC01_REVIEW.md
?? frontend/tests/unit/farm-workspace/InviteDialog.test.tsx
```

Catalog đã được tạo bằng script Python trên đúng source/contract. Lần gọi
refresh cuối sau khi bổ sung câu MSG-FE03-05 không chạy vì Docker daemon đã
dừng; chỉ cập nhật embedded decisions + metadata Git + review-state bằng Node,
sau khi xác nhận mọi operation/schema vẫn khớp OpenAPI đã export thành công.
Không khởi động lại dịch vụ chỉ để sửa metadata tài liệu.

## Review lần 2 (12–14/11/2026)

Review lại gói UC1 trên `dev` (HEAD vẫn `4d6bccd`, chưa commit). Lúc sửa, working
tree đã có thêm gói UC-FE03-02 (D26, `docs/reviews/FE03_UC02_REVIEW.md`) do phiên
khác làm sau lần review đầu; các sửa dưới đây giữ nguyên phạm vi và hành vi UC2.
Người dùng yêu cầu sửa cả bốn điểm, kể cả điểm thuộc đường chấp nhận lời mời.

| # | Phát hiện | Xử lý | Regression |
|---|---|---|---|
| 1 | `hasAccount` tải cả AppUser cho mỗi lời mời; AppUser kéo thêm select `platform_staff_access` (inverse one-to-one) → N+1 ở danh sách | Danh sách: đã được gói UC2 sửa (trang ≤ 100 dòng, `findExistingInvitationEmails` một truy vấn). Lệnh đơn: mời dùng lại kết quả tra tài khoản sẵn có; gửi lại/hủy dùng `existsByEmailIgnoreCase`, không tải AppUser | `aSingleCommandReadsTheAccountHintWithoutLoadingTheAccount`: so số lần tải entity AppUser khi gửi lại, có tài khoản so với không có. RED trên H2 và PostgreSQL: 2 so với 1 |
| 2 | `accept()` trả `MSG-FE03-21` kèm `membershipId` cho thành viên đã bị ngưng mở lại link đã dùng; mã này chỉ dành cho popup Mời của Owner (D25) | Link đã ACCEPTED mà membership không ACTIVE → `MSG-FE03-08` với `status=ACCEPTED` (UC-FE03-04 E1), không lộ `membershipId`; trạng thái lệch khác giữ `MSG-COM-05`. Không đổi spec: E1 đã bao trường hợp link đã dùng | `aDeactivatedMemberReopeningTheAcceptedLinkGetsNoOwnerPromptOrMembershipId`: RED 409 `MSG-FE03-21` |
| 3 | Popup Mời: email trống và sai định dạng cùng một câu; nút Gửi bị khóa khi chưa chọn vai trò nên lỗi `MSG-COM-06` của vai trò không bao giờ hiện (TC-03-01/02) | Trống → "Thư điện tử người nhận là bắt buộc." / "Vai trò là bắt buộc." (COM-06); sai hoặc quá 254 ký tự → "Nhập địa chỉ email hợp lệ." (COM-10). Nút Gửi chỉ khóa khi đang gửi hoặc trại không ACTIVE | `validation.test.ts` (trống/`abc`/255 ký tự), `InviteDialog.test.tsx` (lỗi dưới từng trường, không gọi API), `MemberPages.test.tsx` |
| 4 | Đoạn cuối mục "Final source checkpoint" của file này mất dấu tiếng Việt (ký tự `?` thật trong file) | Viết lại đoạn đó | Kiểm bằng `grep "??"`: chỉ còn ký hiệu `git status` |

RED backend: điểm 2 chạy trên code cũ trước khi sửa (H2, log
`%TEMP%/claude-fe03-r2-red.log`). Điểm 1 ban đầu so tổng số câu SQL; trên
PostgreSQL chỉ số này flaky vì mọi entity dùng chung `sequenceGenerator` (pooled,
allocationSize 50), nên một câu `nextval` rơi vào lần đo nào là tùy dữ liệu các test
trước. Test được đổi sang đếm số lần tải AppUser; RED của chỉ số mới lấy bằng cách
tạm đưa `invitationView` về `findOneByEmailIgnoreCase` rồi khôi phục ngay (log
`%TEMP%/claude-fe03-r2-red2.log`). Test frontend được viết trước code nhưng không
chạy riêng để lấy RED.

Mục "Final source checkpoint" và SHA-256 ở trên là của lần review đầu; các file
production đổi trong lần này: `AppUserRepository.java`,
`FarmMembershipService.java`, `validation.ts`, `InviteDialog.tsx`.

### Kết quả kiểm lại

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| Frontend feature unit | **88/88 PASS**, 13 file (gồm test UC2) | `VITE_BEEFCARE_DATA_SOURCE=local`, `vitest run tests/unit/farm-workspace` |
| Frontend typecheck + build | **PASS** | `npm run typecheck`, `npm run build` (618 module) |
| Backend Surefire (H2) | **54/54 PASS** | FarmMembershipServiceTest 5, FarmInvitationCommandResourceTest 17, FarmInvitationListResourceTest 22, FarmInvitationTransactionTest 5, FarmMembershipResourceErrorsTest 4, OpenApiContractTest 1 |
| Backend Failsafe | **46/46 PASS** | PostgreSQL 16.15: FarmInvitationCommandPostgresIT 17, FarmInvitationListPostgresIT 22, FarmInvitationPostgresIT 5; H2: EmailActivationFlowIT 2 |
| Checkstyle | **0 vi phạm** | cùng lệnh `verify` |
| Diff hygiene | **PASS** | `git diff --check` trên các file đã sửa |

Lệnh backend (từ `backend`, log `%TEMP%/claude-fe03-r2-green2.log`): như lệnh
cuối ở trên, thêm `FarmInvitationListResourceTest` vào `-Dtest` và
`FarmInvitationListPostgresIT` vào `-Dit.test`. Không đổi DTO hay route, nên
OpenAPI và `api-handoff.html` giữ nguyên (OpenApiContractTest pass).

### Chưa kiểm chứng

- Chưa chạy browser/runtime thủ công ở 1180×820 và 1440×900; chưa gửi SMTP thật.
- Không chạy lại toàn repository suite; `BrowserSessionFlowIT` (có luồng chấp
  nhận) không nằm trong bộ chạy vì vốn flaky ở phần email.
- UC4 vẫn là gói riêng: sửa ở điểm 2 chỉ là đường lỗi được kiểm bằng test,
  không chứng nhận toàn UC4.
