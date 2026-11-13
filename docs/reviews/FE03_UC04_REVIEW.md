# FE-03 / UC-FE03-04 — Chấp nhận lời mời

## Phạm vi và căn cứ

- D28, người dùng chọn cả bốn đề xuất ngày 14/11/2026: sửa tối thiểu phần đăng nhập/
  điều hướng dùng chung ở frontend; báo Owner bằng email qua JOB-07; mở lại link đã
  chấp nhận hiện membership; lệnh Chấp nhận không dùng Idempotency-Key. Kèm FE-03 Q6
  (D27 mục 4): link đã hủy/hết hạn báo trạng thái và hạn.
- Checkout `D:/Project/BeefCare-`, branch `feat/fe03-thanh-vien-quyen`, base `ae06065`
  (UC3 đã commit). Chưa commit/push; không migration, không thêm dependency, không đổi
  DB dùng chung.
- Nguồn: SRS 28/10 UC-FE03-04 (1797–1813), SCR-15 (3134–3148), UC-FE01-02 (1653–1666),
  SCR-45 (4509–4525), JOB-07 (5611–5622), JOB-08 (5624–5628), GBR-14/17/64/87,
  MSG-FE03-04/08/09/10; spec FE-03 §4/5/6/7/9/10; `backend/AGENTS.md`.
- Ngoài phạm vi: UC5/UC6 (danh sách, đổi vai trò), backend FE-01 (Google/xác minh vẫn
  chuyển về `/chon-trai` hoặc `/owner-registration`; frontend tự mở lại link).

## Ma trận hợp đồng

| Field | Kiểu / bắt buộc | Nguồn và round trip |
|---|---|---|
| A7 query.token | string, bắt buộc | Hash → `findOneByTokenHash`; không thấy → 400 FE03-08 INVALID |
| A7 status | PENDING \| ACCEPTED | PENDING còn hạn và trại ACTIVE; ACCEPTED chỉ khi caller có membership ACTIVE ở trại (AF2) |
| A7 farmId / farmName / timeZone | Long / string / IANA | Farm của lời mời → SCR-15 và nút Vào trại; giờ hiển thị theo múi giờ trại |
| A7 email / role | string / MANAGER\|TECHNICIAN | invitedEmail / proposedRole |
| A7 invitedBy | string, có thể null | Họ tên AppUser đã mời |
| A7 sentAt / expiresAt | instant | lastSentAt (lần gửi cuối) / expiresAt |
| A7 membershipId | Long, chỉ khi ACCEPTED | Membership ACTIVE của caller |
| A8 body.token | string, bắt buộc (@NotBlank) | Token là khóa ý định; không Idempotency-Key (D28) |
| A8 response | `{membershipId, farmId, farmName, role, status}` | Membership mới hoặc membership ACTIVE đã có (GBR-17) |
| Lỗi FE03-08 | `{status, expiresAt?}` | status hiệu lực tại clock của lần gọi; INVALID không có expiresAt |
| Email Owner | EmailDeliveryJob `MEMBERSHIP/MEMBER_JOINED`, event key `MEMBER_JOINED:{membershipId}` | Lưu cùng transaction; JOB-07 tìm Owner ACTIVE lúc gửi, 24 giờ |

Frontend adapter từ chối response thiếu `farmId`/`membershipId`/`sentAt`… thay vì gán 0
hoặc null âm thầm.

## Khoảng trống tìm thấy và cách sửa

| # | Khoảng trống | Sửa |
|---|---|---|
| G1 | Đăng nhập Google / xác minh email mất link lời mời | `invitationReturn.ts`: GuestAuthFlow nhớ `/invitation/accept?token=…` (localStorage, 24 giờ); AuthProvider mở lại một lần sau khi đăng nhập; chỉ nhận đường dẫn nội bộ SCR-15 |
| G2 | Tài khoản chưa đăng ký Chủ trại bị đẩy về `/owner-registration` dù đã là Manager/Technician | `needsOwnerRegistration`: chỉ khi chưa có trại và chưa có vai trò platform (RoleGate, HomeRedirect, homePathForSession) |
| G3 | Chấp nhận xong không ghi trại hiện tại, không tải lại phiên; A8 không trả farmId | A8 trả `AcceptedInvitation`; SCR-15 dùng `enterFarm` (kiểm tra của SCR-09 → ghi trại cho tab → tải lại trang chủ theo vai trò) |
| G4 | SCR-15 nuốt mọi lỗi tải → "Liên kết không hợp lệ" | Phân loại FE03-08 / FE03-09 / FE03-04 thành trạng thái màn; lỗi khác → ErrorBlock + Thử lại |
| G5 | A7 thiếu invitedBy/status/farmId; "Gửi lúc" dùng createdAt | `InvitationAcceptance` mới; sentAt = lastSentAt; timeZone |
| G6 | Link hủy/hết hạn chỉ báo INVALID (Q6) | Hủy, JOB-02 và đường hết hạn không xóa hash; JOB-08 xóa sau 7 ngày; FE03-08 kèm status + expiresAt |
| G7 | Mở lại link đã chấp nhận báo "không còn hiệu lực" | A7 trả ACCEPTED + membershipId khi membership ACTIVE; SCR-15 hiện "đã tham gia" + Vào trại |
| G8 | Email Owner tiếng Anh, gửi sau commit, không retry | `MailService.queueMemberJoined` + template `MEMBER_JOINED` trong JOB-07 |
| G9 | Spec A8 yêu cầu Idempotency-Key | Spec sửa theo code (D28) |
| G10 | Nút "Từ chối sau", liên hệ chỉ có email | "Để sau"; liên hệ dùng `CONTACT` dùng chung (email + SĐT) |

Phát hiện thêm khi chạy route smoke: SCR-14 (`InvitationsPage`, từ UC2) coi việc render
ngoài SessionProvider là "không phải Owner", trái quy ước của `useSession`/RoleGate, nên
`AppRoutes.test` `/loi-moi` đã đỏ từ commit 74f8efc. Sửa: không có session thì không áp
quyền ở FE (API vẫn kiểm Owner).

Ghi chú cho chủ FE-01 (LamKD): backend Google/xác minh email vẫn chuyển về
`/chon-trai`/`/owner-registration`; việc quay lại lời mời do frontend làm. Hằng số
`CONTACT` dùng email `beefcare@gmail.com`, khác email chính thức trong GBR-87.

## Test

| Nơi | Ca | Tầng |
|---|---|---|
| `FarmInvitationCommandResourceTest` (+ `FarmInvitationCommandPostgresIT`) | `previewShowsTheLastSendAndInviterOnlyToTheInvitedEmail` (TC-03-14, 53), `cancelledExpiredAndUnknownLinksNameTheirStatusAndExpiryButGrantNothing` (TC-03-13, 54), `anInactiveFarmCannotBeJoinedAndTheInvitationStaysPending` ×3 (TC-03-17), `acceptOpensTheFarmOnceAndReopeningTheLinkShowsTheSameMembership` (TC-03-15, 16, 55), `anOwnerOfAnotherFarmJoinsAsTechnicianWithoutGainingOwnerOrPlatformAuthority` (TC-03-18), preview ACCEPTED của membership đã ngưng trong ca UC1 có sẵn | HTTP + security chain + DB |
| `FarmInvitationTransactionTest` (+ `FarmInvitationPostgresIT`) | `acceptCommitsTheMembershipAuditAndOneVietnameseOwnerEmailTogether`, `aFailureAfterAcceptingRollsBackTheMembershipStatusAuditAndOwnerEmail`, `anOwnerWhoLostAccessBeforeDispatchGetsNoEmail` (TC-03-56); ca cạnh tranh Hủy ↔ Chấp nhận của UC3 vẫn xanh với hash được giữ | Commit thật, JDBC readback, dispatcher MOCK |
| `BrowserSessionFlowIT` | Luồng cookie/CSRF: preview đủ field, A8 mới, gọi lại cùng membership, AF2, email Owner tiếng Việt qua JOB-07 | HTTP luồng BE |
| `PlatformJobsIT` | JOB-02 giữ hash (D28); JOB-08 vẫn xóa hash quá hạn 7 ngày | Job |
| `AcceptInvitationPage.test.tsx` (mới, 9 ca) | Field + múi giờ trại, Để sau, chấp nhận → MSG-FE03-10 → `selectFarm` → ghi trại → tải `/tong-quan`, FE03-08 khi chấp nhận, lỗi lưu, FE03-09 + nhớ link trước khi đăng xuất, FE03-04, Thử lại, AF2 + trại bị khóa | Component |
| `invitationReturn.test.tsx` (mới, 3 ca) | Chỉ nhớ link SCR-15 nội bộ, trả một lần, bỏ quá 24 giờ; khách → đăng nhập ở trang khác → mở lại link (TC-03-57) | Component |
| `sessionRoles.test.tsx` | SCR-07 chỉ cho tài khoản chưa có trại; Manager/Technician/PM chưa xong hồ sơ Chủ trại vào nhà của mình (TC-03-58) | Component |
| `SetupPages`/`demoStore`/`workspaceSeed` tests | Chế độ mock theo cùng mã lỗi và hợp đồng mới | Component |

Chưa chụp RED trên code cũ trước khi sửa.

## Kết quả chạy mới — 14/11/2026

| Cổng | Kết quả |
|---|---|
| Frontend `tests/unit/farm-workspace`, `auth`, `app` | **194/194 PASS**, 22 file (`VITE_BEEFCARE_DATA_SOURCE=local`) |
| Typecheck / build | **PASS / PASS** (cảnh báo chunk > 500 kB có từ trước) |
| Surefire (H2, `clean verify`) | **77/77 PASS**: Command 34, List 22, Transaction 11, Service 5, ResourceErrors 4, OpenAPI 1 |
| Failsafe (PostgreSQL 16.15) | **91/91 PASS**: PlatformJobsIT 6, BrowserSessionFlowIT 18, FarmInvitationCommandPostgresIT 34, FarmInvitationListPostgresIT 22, FarmInvitationPostgresIT 11 |
| OpenAPI / catalog | `openapi.json` chỉ ghép thay đổi của A7/A8 và JSON bằng bản export (229 path, 283 operation, 312 schema); `generate_api_catalog.py` chạy lại |

Lệnh backend (từ `backend/`), cần `clean` vì VS Code (ECJ) có thể ghi class vào `target/`:

```powershell
mvn.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dmodernizer.skip=true' '-Dapi.version=1.44' '-Duser.timezone=Asia/Ho_Chi_Minh' '-Dlogging.level.org.hibernate.SQL=OFF' '-Dtest=FarmInvitationListResourceTest,FarmMembershipServiceTest,FarmMembershipResourceErrorsTest,FarmInvitationCommandResourceTest,FarmInvitationTransactionTest,OpenApiContractTest' '-Dit.test=FarmInvitationListPostgresIT,FarmInvitationCommandPostgresIT,FarmInvitationPostgresIT,BrowserSessionFlowIT,PlatformJobsIT' clean verify
```

Sự cố trong lúc chạy:

- Một lượt đầy đủ có 2 lỗi "relation farm_invitation/app_user does not exist" ở
  `FarmInvitationPostgresIT` (JdbcTemplate không thấy schema). Chạy riêng 11/11 pass,
  lượt đầy đủ tiếp theo 91/91 pass. Chưa xác định nguyên nhân; ghi là chập chờn môi trường.
- Hikari tắt auto-commit: `JdbcTemplate.update` ngoài transaction bị rollback khi trả
  kết nối. Test tạm ngưng Owner chạy update trong `TransactionTemplate`.
- JOB-07 tự chạy mỗi 2 giây trong test; ca "Owner mất quyền" tạm ngưng Owner trước
  khi chấp nhận để không bị poller gửi trước.

## Runtime thủ công

`.run/fe03-uc04-runtime.mjs` (playwright-core có sẵn + Chrome, demo/mock, không phải
automated E2E). Ở 1180×820, 1440×900 và 390×844: lời mời chờ hiện đủ thông tin; chấp
nhận hiện MSG-FE03-10 rồi tải `/kt` (Technician); link hết hạn hiện "Lời mời không còn
hiệu lực (Hết hạn). Hết hạn lúc 24/10/2026 08:10."; email khác hiện MSG-FE03-09 không
có tên trại. Không tràn ngang, không JS exception; console chỉ có 404 favicon có từ
trước. Ảnh ở `.run/fe03-uc04-runtime/`.

## Giới hạn và trạng thái

- **BE_REVIEWED trên nhánh, chưa READY_FOR_FE.** Chưa smoke browser → backend thật
  (Google OAuth, email xác minh thật, SMTP/Mailpit); việc mở lại link sau Google/xác
  minh chỉ được kiểm bằng component test.
- Link được nhớ trong localStorage của trình duyệt: mở email xác minh ở thiết bị/trình
  duyệt khác thì không tự quay lại; người dùng mở lại email lời mời (MSG-FE01-15 đã
  hướng dẫn).
- MSG-FE03-10 hiện khoảng 1 giây trước khi tải lại trang chủ của trại.
- Spotless/JaCoCo/Modernizer bỏ qua như quy trình local; chưa chạy toàn bộ test của
  repository.

## File thay đổi

- Backend: `MembershipDtos` (A7/A8), `FarmMembershipService` (preview/accept, AF2,
  giữ hash, email Owner), `FarmMembershipResource`, `MailService.queueMemberJoined`,
  `EmailDeliveryJobService` (MEMBER_JOINED).
- Backend test: `FarmInvitationCommandResourceTest`, `FarmInvitationTransactionTest`,
  `FarmMembershipServiceTest`, `PlatformJobsIT`, `BrowserSessionFlowIT`.
- Frontend: `AcceptInvitationPage`, `enterFarm.ts` (mới), `FarmSelectPage`
  (STORAGE_BLOCKED dùng chung), `InvitationsPage` (quy ước session), `farmWorkspaceApi`,
  `types`, demo store/seed, `authentication/invitationReturn.ts` (mới), `GuestAuthFlow`,
  `AuthContext`, `authentication/index.ts`, `authorization/sessionContext.ts`,
  `RoleGate.tsx`; test tương ứng.
- Tài liệu: D28, spec FE-03, `OPEN_QUESTIONS.md` (Q6), `FE03_UC03_EXAMPLES.md`,
  `FE03_UC04_EXAMPLES.md`, `docs/api/README.md`, `openapi.json`, `api-handoff.html`,
  file này.
