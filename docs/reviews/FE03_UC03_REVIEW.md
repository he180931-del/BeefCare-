# FE-03 / UC-FE03-03 — Gửi lại / hủy lời mời đang chờ

## Phạm vi và căn cứ

- D27, người dùng chọn cả bốn đề xuất ngày 14/11/2026: Gửi lại vô hiệu link cũ;
  không giới hạn số lần Gửi lại; xác nhận Hủy là hộp thoại modal; cách SCR-15
  hiển thị link đã hủy để sang UC4 (FE-03 Q6).
- Checkout `D:/Project/BeefCare-`, branch `feat/fe03-thanh-vien-quyen`, base
  `9cc873b` (UC1 + UC2 đã commit). Thay đổi chưa commit/push; không đổi DB dùng
  chung, không migration, không thêm dependency.
- Nguồn: SRS 28/10 UC-FE03-03 (dòng 1781–1794), SCR-14 (3102–3113), SCR-15
  (3146), JOB-02 (5552), JOB-08 (5628), GBR-14/16/86/88/89, MSG-FE03-03…08
  (5970–5975); spec FE-03 §4/5/6/7/8/9/10; D25/D26; `backend/AGENTS.md`.
- Không chứng nhận UC4 (SCR-15, chấp nhận lời mời), UC6 hay toàn FE-03.

## Ma trận hợp đồng A5 / A6

| Field | Kiểu / bắt buộc | Kiểm tra, nguồn và round trip |
|---|---|---|
| path.farmId | Long, bắt buộc | ACTIVE account + ACTIVE Owner membership đúng trại, ngược lại 403 COM-01. Gửi lại cần dịch vụ ACTIVE (403 FE03-04); Hủy mọi trạng thái (GBR-14) |
| path.invitationId | Long, bắt buộc | Khóa dòng `lockByIdAndFarmId`; không thuộc trại ở URL → 404 COM-08, không lộ lời mời trại khác |
| body.expectedVersion | integer, bắt buộc | Version đã thấy khi bấm / mở hộp thoại; kiểm sau trạng thái (E2 trước E4); cũ → 409 COM-05. UI không tự lấy version mới |
| header.Idempotency-Key | string, bắt buộc | Một ý định cho mỗi lời mời + hành động + version; replay cùng body trả kết quả đầu, khác body COM-19 (GBR-88) |
| response | InvitationView | Cùng dạng item GET (D26). Gửi lại: cùng id/email/role/validityDays/createdAt, lastSentAt/expiresAt/version mới. Hủy: CANCELLED, version mới |
| state | PENDING chưa hết hạn | Trạng thái hiệu lực tại clock của lần gọi; ACCEPTED/CANCELLED/EXPIRED → 409 FE03-08 `{status}`; PENDING quá hạn báo EXPIRED nhưng không ghi |
| side effects | cùng transaction | Gửi lại: token mới (hash), bỏ mail intent cũ chưa gửi, mail intent mới, audit `INVITE_RESEND` có `before`/`after` lastSentAt/expiresAt. Hủy: CANCELLED, cancelledAt, xóa hash, bỏ mail chưa gửi, audit `INVITE_CANCEL` có statusBefore/statusAfter. Không tạo membership |

## Khoảng trống tìm thấy và cách sửa

| # | Khoảng trống | Sửa |
|---|---|---|
| G1 | Xác nhận Hủy là banner ở đầu bảng, có thể nằm ngoài màn khi bấm dòng dưới; SRS MSG-FE03-06 là "Dialog (confirm)" | Hộp thoại `Modal` với nội dung MSG-FE03-06, nút Quay lại / Hủy lời mời (D27) |
| G2 | FE báo FE03-08 bằng câu chung, không có trạng thái (E2 "with the current status") | `farmWorkspaceError` dựng "Lời mời không còn hiệu lực ({nhãn trạng thái})." từ `params.status` |
| G3 | Sau lỗi FE03-08/COM-05/404 danh sách không tải lại, dòng cũ vẫn có nút | Lỗi do dòng đã đổi (FE03-08, FE03-04, COM-05, COM-08/404): đóng hộp thoại, hiện lý do, tải lại. Lỗi khác: giữ hộp thoại và cùng key |
| G4 | Resend/cancel đọc lời mời không khóa; chạy cùng Chấp nhận có thể ra COM-05 thay vì FE03-08. `requirePending` ghi EXPIRED + audit rồi bị rollback | Khóa dòng (PESSIMISTIC_WRITE) theo id + farm; kiểm trạng thái tại lần đọc, không ghi; bỏ `ownInvitation`/`requirePending` |
| G5 | Audit thiếu giá trị trước/sau (GBR-86) | Gửi lại: `before`/`after` lastSentAt + expiresAt; Hủy: `statusBefore`/`statusAfter`. Các key nằm trong allowlist của audit SA |
| G6 | Spec A5/A6 ghi `version`; code dùng `expectedVersion`; thiếu mã lỗi | Sửa spec theo code (như D25 với `validityDays`), liệt kê đủ mã lỗi; route/DTO/OpenAPI không đổi |
| G7 | Thiếu test TC-03-07/10/11, trạng thái cuối, quá hạn trước JOB-02, tenant, replay, link cũ, cạnh tranh | Thêm TC-03-46…52 trong spec và test tương ứng bên dưới |

Ngoài ra câu MSG-FE03-04 ở FE được đổi theo spec ("Mời thành viên, đổi vai trò
và kích hoạt lại cần trại đang hoạt động (ACTIVE)."). Câu này dùng chung cho
popup Mời, đổi vai trò và màn chấp nhận lời mời (SRS dùng cùng mã cho UC4 E3).

## Test

| Nơi | Ca | Tầng |
|---|---|---|
| `FarmInvitationCommandResourceTest` (+ `FarmInvitationCommandPostgresIT`) | `resendOnDayFiveRestartsTheChosenPeriodOnTheSameInvitationAndOnlyTheNewLinkWorks` (TC-03-10, 47), `inactiveServiceBlocksResendButTheOwnerCanStillCancel` ×3 (TC-03-07, 08, 38), `aFinishedInvitationReportsItsStatusBeforeAnyVersionConflict` ×3 (TC-03-11, 48), `anOverduePendingInvitationIsReportedExpiredWithoutWritingBeforeTheExpiryJob` (TC-03-49), `onlyThisFarmsOwnerCanResendOrCancelAndAnotherFarmsInvitationIsNotFound` (TC-03-51), `cancelEndsTheLinkWithOneAuditCreatesNoMembershipAndReplaysTheFirstResult` | HTTP + security chain thật + DB (H2 và PostgreSQL) |
| `FarmInvitationTransactionTest` (+ `FarmInvitationPostgresIT`) | `resendCommitsANewPeriodAndMailsOnlyTheNewestLinkOnce`, `cancelCommitsTheStatusAndAuditAndDropsTheUnsentEmail`, `concurrentAcceptAndCancelHaveOneWinnerAndACancelledLinkNeverGrantsAccess` (TC-03-50) | Commit thật, đọc lại bằng JDBC, dispatcher email MOCK, hai transaction độc lập |
| `BrowserSessionFlowIT` (có sẵn) | Luồng cookie/CSRF: mời → gửi lại (cùng key không gửi hai email, link cũ bị từ chối, version cũ COM-05) → hủy → link không cấp gì; chấp nhận rồi hủy → FE03-08 ACCEPTED | HTTP luồng BE |
| `frontend/tests/unit/farm-workspace/InvitationsPage.test.tsx` | 6 ca mới: hộp thoại + Quay lại (TC-03-46), Gửi lại + MSG-FE03-05 + tải lại, FE03-08 kèm trạng thái + tải lại, COM-05/FE03-04 khi Gửi lại + tải lại không thử lại, lỗi lưu giữ hộp thoại và cùng key (TC-03-52); 3 ca cũ đổi sang nút "Hủy lời mời" | Component |

Ca cạnh tranh không ép thứ tự: kiểm cả hai nhánh (Hủy thắng → không membership,
Chấp nhận nhận FE03-08; Chấp nhận thắng → 2 membership, Hủy nhận FE03-08). Trên
PostgreSQL chỉ chấp nhận FE03-08 cho bên thua; trên H2 cho phép thêm COM-05.
Mỗi lần chạy chỉ đi qua một nhánh; chưa có bằng chứng cả hai nhánh trên cùng DB.

Chưa chụp RED: các test mới được viết cùng lúc với bản sửa, không chạy trên code
cũ trước khi sửa.

## Kết quả chạy mới — 14/11/2026

| Cổng | Kết quả |
|---|---|
| Frontend `tests/unit/farm-workspace` | **96/96 PASS**, 13 file (`VITE_BEEFCARE_DATA_SOURCE=local`) |
| Typecheck / build | **PASS / PASS**; cảnh báo chunk > 500 kB có từ trước |
| Surefire (H2) | **67/67 PASS**: Command 27, List 22, Transaction 8, Service 5, ResourceErrors 4, OpenAPI 1 |
| Failsafe (PostgreSQL 16.15, Testcontainers) | **81/81 PASS**: FarmInvitationCommandPostgresIT 27, FarmInvitationListPostgresIT 22, FarmInvitationPostgresIT 8, BrowserSessionFlowIT 18, PlatformJobsIT 6 |
| OpenAPI | `OpenApiContractTest` PASS, không đổi `openapi.json` (route/DTO giữ nguyên) |

Lệnh backend, từ `backend/`:

```powershell
mvn.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dmodernizer.skip=true' '-Dapi.version=1.44' '-Duser.timezone=Asia/Ho_Chi_Minh' '-Dlogging.level.org.hibernate.SQL=OFF' '-Dtest=FarmInvitationListResourceTest,FarmMembershipServiceTest,FarmMembershipResourceErrorsTest,FarmInvitationCommandResourceTest,FarmInvitationTransactionTest,OpenApiContractTest' '-Dit.test=FarmInvitationListPostgresIT,FarmInvitationCommandPostgresIT,FarmInvitationPostgresIT,BrowserSessionFlowIT,PlatformJobsIT' verify
```

Không có `-Duser.timezone`, PostgreSQL từ chối múi giờ JVM `Asia/Saigon` và các
`*PostgresIT` không khởi động được (môi trường, như UC1). Log EOFException của
scheduler sau khi container dừng ở cuối lượt là nhiễu, không phải lỗi test.

Lệnh frontend, từ `frontend/`:

```powershell
$env:VITE_BEEFCARE_DATA_SOURCE='local'
.\node_modules\.bin\vitest.cmd run tests/unit/farm-workspace
npm.cmd run typecheck
npm.cmd run build
```

## Runtime thủ công

`.run/fe03-uc03-runtime.mjs` (playwright-core có sẵn + Chrome, demo/mock, không
phải automated E2E). Ở 1180×820 và 1440×900: hộp thoại Hủy nằm trong khung nhìn
(560×180, giữa màn), không tràn ngang; Quay lại không đổi số đếm; Gửi lại hiện
MSG-FE03-05 kèm hạn; xác nhận Hủy hiện MSG-FE03-07, Đang chờ 2 → 1, Đã hủy 1 → 2.
Ảnh và aria snapshot ở `.run/fe03-uc03-runtime/`. Console chỉ có 404 favicon có
từ trước; không JS exception. Đây không phải bằng chứng browser → backend.

## Giới hạn và trạng thái

- **BE_REVIEWED trên nhánh, chưa READY_FOR_FE.** Chưa smoke browser → backend
  thật trên bản tích hợp; chưa gửi SMTP/Mailpit thật (email MOCK).
- Không giới hạn số lần Gửi lại (D27): Owner có thể gửi lặp email tới một địa
  chỉ. Rủi ro được chấp nhận vì SRS không đặt giới hạn; nếu cần, thêm quy tắc
  mới và mã thông báo riêng.
- Link sau khi Hủy hoặc hết hạn vẫn báo "Liên kết không hợp lệ" trên SCR-15 vì
  hash bị xóa ngay; hiển thị trạng thái và hạn làm ở UC4 (Q6).
- Spotless/JaCoCo/Modernizer bỏ qua như quy trình local hiện có; chưa chạy toàn
  bộ test của repository.

## File thay đổi

- Backend: `FarmInvitationRepository` (`lockByIdAndFarmId`),
  `FarmMembershipService` (resend/cancel, `lockPendingInvitation`, audit).
- Backend test: `FarmInvitationCommandResourceTest`, `FarmInvitationTransactionTest`.
- Frontend: `InvitationsPage.tsx`, `WorkspaceUi.tsx`; test
  `InvitationsPage.test.tsx`, `MemberPages.test.tsx`.
- Tài liệu: `REQUIREMENT_DECISIONS.md` (D27), spec FE-03, `OPEN_QUESTIONS.md`
  (FE-03 Q6), `docs/api/FE03_UC03_EXAMPLES.md`, `docs/api/README.md`,
  `docs/api-handoff.html` (review state resend/cancel), file này.
