# FE-03 / UC-FE03-06 — Đổi vai trò / ngưng / kích hoạt lại thành viên

## Phạm vi và căn cứ

- D30, người dùng đồng ý cả sáu đề xuất ngày 14/11/2026: phạm vi popup + A2 + tải lại
  SCR-13 (gồm lối từ MSG-FE03-21); lịch sử ở bảng `farm_membership_change`; ngày hiệu lực
  chỉ để ghi lịch sử (chốt FE-03 Q3); lý do 5–500 ký tự; xác nhận cả khi kích hoạt lại;
  thứ tự kiểm FE03-20 trước COM-05.
- Checkout `D:/Project/BeefCare-`, branch `feat/fe03-thanh-vien-quyen`, base `7af0020`
  (UC5 đã commit). Chưa commit/push. Migration mới `20261114000200_membership_change_history`
  (bảng mới, không sửa dữ liệu cũ); không thêm dependency, không đổi DB dùng chung.
- Nguồn: SRS 28/10 UC-FE03-06 (1817–1830), popup (3115–3130), MSG-FE03-11/12/13/20
  (5978–5980), MSG-COM-14 (5938), Table III-1 (2789, 2795), GBR-09/18/86/88/89, BR-D29/31;
  spec FE-03 §3.2/4/5/6/7/8/9/10.

## Ma trận hợp đồng A2

| Field | Kiểu / bắt buộc | Kiểm và lưu |
|---|---|---|
| action | CHANGE_ROLE \| DEACTIVATE \| REACTIVATE, bắt buộc | Bean (COM-06/COM-10); CHANGE_ROLE với INACTIVE → COM-10 `field=action` |
| role | MANAGER \| TECHNICIAN, bắt buộc khi CHANGE_ROLE | Thiếu → COM-06 `field=role`; giống vai trò hiện tại → FE03-20 |
| effectiveDate | date, bắt buộc | Không sau "hôm nay" theo múi giờ trại (COM-07); chỉ lưu lịch sử, `farm_membership.effective_date` |
| reason | string, bắt buộc | Trim; ≥ 5 ký tự không phải khoảng trắng và ≤ 500 (COM-10); trống → COM-06; lưu `farm_membership.change_reason` + `farm_membership_change.reason` |
| expectedVersion | int, bắt buộc | Kiểm sau FE03-20 (COM-05) |
| Idempotency-Key | header, bắt buộc | Cùng key + body trả kết quả đầu; khác body → COM-19 |
| Response | dòng A1 (`id, userId, fullName, email, role, status, joinedAt, version, actions`) | `actions` tính lại theo trạng thái mới và trạng thái dịch vụ |
| Lịch sử | `farm_membership_change` | action, role/status trước-sau, effective_date, reason, changed_by, changed_at; cùng transaction |
| Audit | `MEMBER_{action}` | roleBefore/After, statusBefore/After, effectiveDate; không có lý do, email |

## Khoảng trống tìm thấy và cách sửa

| # | Khoảng trống | Sửa |
|---|---|---|
| G1 | Backend cho đổi vai trò người INACTIVE | COM-10 `field=action` |
| G2 | Không có lịch sử; audit chỉ có giá trị sau | Bảng + entity `FarmMembershipChange`; audit trước/sau |
| G3 | Câu xác nhận / thành công tự viết | MSG-FE03-11/12/13 và câu kích hoạt lại theo D30 |
| G4 | Hủy khi đã nhập đóng ngay | MSG-COM-14 [Tiếp tục nhập] [Bỏ thông tin] |
| G5 | Lỗi dòng đã đổi giữ popup, không tải lại | `onStale`: SCR-13 hiện lý do, đóng popup, đọc lại A1; popup Mời quay về form với lý do |
| G6 | Ngày trống báo "không được ở tương lai" | "Ngày hiệu lực là bắt buộc." (COM-06) |
| G7 | Nhãn "Ngừng hoạt động" | "Ngưng" / "Đổi vai trò / ngưng thành viên" |
| G8 | Lý do không kiểm tối thiểu 5 ký tự | Backend + frontend cùng quy tắc |
| G9 | Version kiểm trước FE03-20, không khóa dòng | Khóa `PESSIMISTIC_WRITE`; FE03-20 trước COM-05 |
| G10 | "Hôm nay" theo múi giờ nền tảng | Múi giờ của trại (backend `Farm.timeZone`, frontend `farmToday(timeZone)`) |
| G11 | Lỗi trường từ server hiện câu chung "Email hoặc số điện thoại không hợp lệ" | Popup map COM-06/07/10 theo `params.field` xuống đúng trường |

## Test

| Nơi | Ca | Tầng |
|---|---|---|
| `FarmMemberChangeResourceTest` (mới, 9 ca) | Lịch sử + audit trước/sau không lý do (TC-03-66); thứ tự COM-01 → COM-08 → COM-01 trước lỗi dữ liệu (TC-03-69); lý do 4/5/501/trống, ngày trống/tương lai, thiếu role (TC-03-70); "hôm nay" theo múi giờ trại; đổi vai trò INACTIVE; trại EXPIRED chỉ còn ngưng (TC-03-23); FE03-20 trước COM-05, lệnh bị từ chối không ghi gì (TC-03-71); request kế tiếp theo vai trò mới / bị ngưng (TC-03-20); AF2 nháp riêng tư và không sửa được, bản ghi giữ tác giả (TC-03-72, 24) | HTTP + security chain + DB |
| `FarmMemberChangeTransactionTest` (+ `FarmMemberChangePostgresIT`, mới, 3 ca) | Commit membership + lịch sử + audit, replay cùng key, COM-19; lỗi sau khi ghi rollback tất cả (TC-03-67); hai lệnh ngưng đồng thời → một thắng, một FE03-20 trên PostgreSQL, 1 dòng lịch sử (TC-03-68) | Commit thật, JDBC readback |
| `FarmMembershipServiceTest` | Lý do / ngày lưu ở membership; phản hồi có actions | Service |
| `BrowserSessionFlowIT` | Luồng cookie/CSRF: cùng key replay; key mới cùng vai trò → FE03-20 (D30, trước là COM-05); thay đổi thật với version cũ → COM-05 | HTTP luồng BE |
| `MemberChangeDialog.test.tsx` (mới, 13 ca) | MSG-FE03-11/12/kích hoạt lại; gửi version đã thấy; MSG-FE03-13; FE03-20/04, COM-05/08 → onStale, không thử lại; lỗi mạng giữ popup và cùng key; lỗi trường từ server; MSG-COM-14; trại không ACTIVE; quy tắc lý do/ngày; "hôm nay" theo múi giờ (TC-03-73) | Component / unit |
| `MembersPage.test.tsx` | SCR-13 nhận onStale: hiện lý do, đóng popup, đọc lại A1 | Component |
| `MemberPages`, `InviteDialog` | Luồng mô phỏng và lối Kích hoạt lại từ popup Mời theo câu mới | Component |

Chưa chụp RED trên code cũ trước khi sửa.

## Kết quả chạy mới — 14/11/2026

| Cổng | Kết quả |
|---|---|
| Frontend `tests/unit/farm-workspace`, `account`, `app` | **21/21 file, 159/159 test PASS** (`VITE_BEEFCARE_DATA_SOURCE=local`) |
| Typecheck / build | **PASS / PASS** (cảnh báo chunk > 500 kB có từ trước) |
| Surefire (H2, `clean verify`) | FarmMemberChange 9 + Transaction 3, FarmMemberList 8, Command 34, List 22, Registration 9, WorkspaceService 9, Service 5, Announcement 3, ResourceErrors 4, OpenAPI 1: PASS. FarmInvitationTransactionTest 11/11 khi chạy lại (lượt đầy đủ có 1 ca email chập chờn). FarmAccessServiceTest 10/11, LocalDevelopmentSeederTest 1/2: lỗi có từ trước (FE-18/FE-23, xem review UC5) |
| Failsafe (PostgreSQL 16.15) | FarmMemberChangePostgresIT 3, FarmMemberListPostgresIT 8, MembershipJoinedAtMigrationPostgresIT 1, FarmInvitationCommandPostgresIT 34, FarmInvitationListPostgresIT 22, FarmInvitationPostgresIT 11, PlatformJobsIT 6: PASS. BrowserSessionFlowIT **18/18** ở lượt `clean verify` riêng sau khi sửa kỳ vọng D30 |
| OpenAPI / catalog | Chỉ mô tả `role`, `reason` của `MemberChange` đổi; JSON bằng bản export (229 path, 283 operation, 314 schema); `generate_api_catalog.py` chạy lại |

Sự cố trong lúc chạy:

- Lượt đầy đủ đầu tiên: 5 ca BrowserSessionFlowIT và 1 ca FarmInvitationTransactionTest
  hỏng ở bước chờ email ("No mail with …", đếm email thiếu) dưới tải; chạy riêng thì
  qua. Đây là dạng chập chờn email đã ghi từ trước, không liên quan UC6. Lỗi thật duy nhất
  là kỳ vọng COM-05 cũ trong BrowserSessionFlowIT, đã đổi theo D30.
- Một lượt `verify` không `clean` báo `NoClassDefFoundError: EmailDeliveryJobService`
  (class do VS Code biên dịch trong `target/`); `clean verify` thì qua.

Lệnh backend (từ `backend/`):

```powershell
mvn.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dmodernizer.skip=true' '-Dapi.version=1.44' '-Duser.timezone=Asia/Ho_Chi_Minh' '-Dlogging.level.org.hibernate.SQL=OFF' '-Dmaven.test.failure.ignore=true' '-Dtest=FarmMemberChangeResourceTest,FarmMemberChangeTransactionTest,FarmMemberListResourceTest,FarmAccessServiceTest,LocalDevelopmentSeederTest,FarmMembershipServiceTest,FarmInvitationCommandResourceTest,FarmInvitationListResourceTest,FarmInvitationTransactionTest,FarmMembershipResourceErrorsTest,FarmRegistrationResourceTest,FarmWorkspaceServiceTest,FarmAnnouncementServiceTest,OpenApiContractTest' '-Dit.test=FarmMemberChangePostgresIT,FarmMemberListPostgresIT,MembershipJoinedAtMigrationPostgresIT,BrowserSessionFlowIT,FarmInvitationCommandPostgresIT,FarmInvitationListPostgresIT,FarmInvitationPostgresIT,PlatformJobsIT' clean verify
```

## Runtime thủ công

`.run/fe03-uc06-runtime.mjs` (playwright-core có sẵn + Chrome, demo/mock, không phải
automated E2E). Ở 1180×820, 1440×900 và 390×844: Ngưng hỏi đúng MSG-FE03-11, lưu, hiện
MSG-FE03-13, tab Đã ngưng tăng lên 2; lý do "a b" bị chặn trong form; Hủy khi đã nhập hỏi
MSG-COM-14; Kích hoạt lại hỏi câu riêng có vai trò và lưu. Không tràn ngang, không JS
exception; console chỉ có 404 favicon có từ trước. Ảnh ở `.run/fe03-uc06-runtime/`.

## Giới hạn và trạng thái

- **BE_REVIEWED trên nhánh, chưa READY_FOR_FE.** Chưa smoke browser → backend thật;
  migration mới chưa chạy trên DB dùng chung.
- Lịch sử chưa hiển thị ở màn nào (SRS không có trường này); dữ liệu trước D30 không có
  dòng lịch sử.
- Thành viên vừa bị ngưng mà đang mở trang nhận MSG-COM-01 ở thao tác kế tiếp, chưa tự
  chuyển về SCR-09 (SRS không quy định).
- Trường thiếu hoặc sai dạng (thiếu `action`, lý do > 500…) bị chặn ở tầng HTTP trước
  bước kiểm Owner; thứ tự D30 áp dụng cho request đúng dạng.
- Spotless/JaCoCo/Modernizer bỏ qua như quy trình local; chưa chạy toàn bộ test của repository.

## File thay đổi

- Backend: `FarmMembershipService.changeMember` (khóa dòng, thứ tự kiểm, lịch sử, audit,
  "hôm nay" của trại), `FarmMembershipChange` + `FarmMembershipChangeRepository` (mới),
  `FarmMembershipRepository.lockByIdAndFarmId`, `MembershipDtos.MemberChange` (mô tả),
  Liquibase `20261114000200_membership_change_history.xml` + `master.xml`.
- Backend test: `FarmMemberChangeResourceTest`, `FarmMemberChangeTransactionTest`,
  `FarmMemberChangePostgresIT` (mới); `BrowserSessionFlowIT`.
- Frontend: `MemberChangeDialog`, `validation` (`farmToday(timeZone)`, quy tắc lý do),
  `MembersPage` (onStale), `InviteDialog` (lối kích hoạt lại), demo store; test tương ứng,
  `MemberChangeDialog.test.tsx` (mới).
- Tài liệu: D30, spec FE-03, `OPEN_QUESTIONS.md` (Q3), `docs/api/README.md`,
  `FE03_UC06_EXAMPLES.md`, `openapi.json`, `api-handoff.html`, file này.
