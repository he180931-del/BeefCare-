# FE-03 / UC-FE03-09 — Quyền nhân viên nền tảng (SA)

## Phạm vi và căn cứ

- D33, người dùng đồng ý cả sáu đề xuất ngày 14/11/2026 ("thực hiện theo đề xuất"): quyền nền tảng là
  popup trên SCR-16, bỏ trang "Quyền nhân sự nền tảng" (FE-03 Q5); lịch sử ở bảng `platform_access_change`,
  chép audit cũ khi nâng cấp; tài khoản bị tạm ngưng chỉ còn Thu hồi với mã mới MSG-FE03-22 (FE-03 Q4); SA
  không đổi quyền của chính mình; giá trị đã có → FE03-20, quyền đã đổi → COM-05; A10 trả `accessActions[]`.
- Checkout `D:/Project/BeefCare-`, branch `feat/fe03-thanh-vien-quyen`, base `cfcdf79` (UC8 đã push).
  Migration mới `20261114000500_platform_access_change`; không đổi DB dùng chung (runtime trên DB riêng
  `beefcare_uc9`), không thêm dependency.
- Nguồn: SRS 28/10 UC-FE03-09 (1852–1869), popup (3179–3190), CS / PM / SA (497–517), GBR-10 (5777), GBR-11
  (5778), BR-D06 (934), Permission Matrix (1377, chú thích 1440), SCR-16 (1514), MSG-FE03-17 → 20
  (5984–5987); spec FE-03 §3.3, 4, 5, 6, 7, 8, 9, 10; `backend/AGENTS.md`.
- Ngoài phạm vi: màn audit nền tảng (FE-17) và thông báo của SA vẫn chạy dữ liệu mô phỏng ở chế độ backend.

## Ma trận hợp đồng A13 / A11 (+ A10)

| Field | Kiểu / bắt buộc | Nguồn và round trip |
|---|---|---|
| header `Idempotency-Key` | string ≤ 128, bắt buộc | `executePlatform(SA, PLATFORM_ACCESS)`; hash gồm id tài khoản + body; thiếu → 400 COM-06 |
| `operation` | GRANT \| CHANGE \| REVOKE \| RESTORE, bắt buộc | `@NotBlank` (COM-06); giá trị khác → COM-10 `field=operation` (sau COM-08) |
| `role` | CS \| PM \| SA; bắt buộc khi GRANT / CHANGE | thiếu → COM-06 `field=role`; khác → COM-10; bỏ qua với REVOKE / RESTORE (FE không gửi) |
| `reason` | string, bắt buộc | HTTP `@NotBlank @Size(500)`; service bỏ khoảng trắng đầu cuối, 5–500, ≥ 5 không phải khoảng trắng → `platform_access_change.reason`; không vào audit |
| `version` | int64, null khi chưa có quyền | so với `platform_staff_access.version` (null / 0 khi chưa có dòng); sai → COM-05 (sau kiểm trạng thái) |
| → `platform_staff_access` | role, status ACTIVE ⇄ REVOKED | tạo dòng khi GRANT lần đầu; version tăng |
| → `platform_access_change` | dòng mới | action, role / status trước (null lần đầu) / sau, reason, changed_by_id, changed_at |
| → `audit_log` | dòng mới | `PLATFORM_ACCESS_<op>` `{fromRole, fromStatus, toRole, toStatus}` (NONE khi chưa có) |
| → `support_ticket.assigned_cs_id` | null cho phiếu chưa CLOSED | khi CS mất quyền CS (thu hồi / đổi sang PM, SA); lịch sử `AUTO_REQUEUE` cause `CS_ACCESS_REMOVED` |
| A10 `accessActions` | GRANT / CHANGE / REVOKE / RESTORE | tính theo quyền đang lưu, trạng thái tài khoản, xác minh email, SA đang gọi |
| A11 | `AccessHistoryItem[]` | projection (không nạp entity người làm → không N+1), mới nhất trước, tối đa 100 |

## Khoảng trống tìm thấy và cách sửa

| # | Khoảng trống | Sửa |
|---|---|---|
| G1 | Không có Idempotency-Key | `executePlatform` + handler COM-06 cho header thiếu |
| G2 | A11 đọc audit, trả JSON thô, không có người làm, lẫn mục tạm ngưng | Bảng `platform_access_change` + projection; chép audit cũ khi nâng cấp (PostgreSQL) |
| G3 | Lý do ≤ 500, nằm trong audit | 5–500; audit chỉ trước / sau |
| G4 | Tài khoản bị tạm ngưng: mọi thao tác báo COM-01 | Chỉ còn Thu hồi; còn lại MSG-FE03-22 (mã mới) |
| G5 | SA tự đổi / thu hồi quyền của chính mình được nếu còn SA khác | COM-01; `accessActions` rỗng |
| G6 | Cấp vai trò khác khi đang có quyền báo FE03-20 | FE03-20 chỉ khi giá trị đã có hiệu lực; còn lại COM-05 |
| G7 | Race: hai SA thu hồi quyền SA của nhau cùng lúc thì cả hai qua (đã ghi ở UC8) | Khóa thêm dòng của SA đang gọi theo thứ tự id (dùng chung với UC8), đọc lại từ DB SA đang gọi còn ACTIVE |
| G8 | CS mất quyền: phiếu chỉ về hàng đợi khi job 60 giây chạy | `requeueTicketsOf` trong cùng transaction (thêm `cause`) |
| G9 | Email chưa xác minh: FE hiện câu tự đặt, backend FE03-18 | Thống nhất MSG-FE03-18 (spec); thu hồi vẫn được |
| G10 | FE: trang "Quyền nhân sự" theo Figma, lệnh UC9 / lịch sử báo "chưa tích hợp", tiêu đề "Cấp quyền nền tảng", lý do 1 dòng, lịch sử JSON thô | Bỏ trang + mục sidebar, popup trên SCR-16, link cũ chuyển hướng; nối A11 / A13; tiêu đề "Quyền nhân viên nền tảng", ô chữ dài, lịch sử theo cột SRS, MSG-COM-14 khi hủy, lỗi nghiệp vụ đóng popup và tải lại, cùng key khi thử lại |

## Test

| Nơi | Ca | Tầng |
|---|---|---|
| `PlatformAccessResourceTest` (mới, 4) | TC-03-91 vòng đời Cấp → Đổi → Thu hồi → Khôi phục, `accessActions`, A11, audit không lý do, request kế tiếp theo quyền mới; TC-03-92 thứ tự kiểm + không ghi gì; TC-03-93 tạm ngưng / chưa xác minh; TC-03-94 phiếu của CS mất quyền về hàng đợi, yêu cầu nội bộ của PM bị thu hồi cần giao lại | HTTP + security chain + DB (H2) |
| `PlatformAccountStatusTransactionTest` (+3) + `PlatformAccountStatusPostgresIT` | TC-03-95 commit cùng nhau, phát lại key, COM-19, rollback; TC-03-96 hai SA cuối thu hồi quyền của nhau (chỉ PostgreSQL) | Không có transaction ngoài; H2 + PostgreSQL 16.15 |
| `PlatformAccessChangeMigrationPostgresIT` (mới) | TC-03-97 chép audit cũ (NONE → null, thiếu lý do, không người làm), bỏ qua audit tạm ngưng / details hỏng, audit giữ nguyên | Migration PostgreSQL |
| `PlatformAccountAdministrationServiceTest` | Cấp: lịch sử có lý do, audit không lý do, `accessActions`; thu hồi SA cuối: khóa theo thứ tự id, không ghi gì | Service |
| `platformAdminApi.test.ts`, `platformRules.test.ts` | Quy tắc mô phỏng theo thứ tự backend; A13 body (role chỉ khi Cấp / Đổi, version, key); A11 đọc chặt, giữ null; `accessActions`, A10 thiếu / sai bị từ chối | Adapter / store |
| `AccessDialog.test.tsx` (mới, 4), `AccountStatusDialog.test.tsx` | Hành động theo `accessActions`, lịch sử (đổi cũ → mới, "Hệ thống", giờ +7), cùng key khi thử lại, MSG-FE03-19, `onRefused`; phân loại FE03-18 / 20 / 22, COM-06 `role` | Component |
| `PlatformAdminPages.test.tsx` | Nút Quyền nền tảng mở popup trên SCR-16, lý do 5–500, MSG-FE03-19; link cũ `/nen-tang/quyen/2`; tài khoản chưa xác minh / của chính mình; MSG-COM-14 | Component |

RED đã chụp: bỏ khóa dòng SA đang gọi trong `changePlatformAccess` → TC-03-96 đỏ ("the second command
waits"); khôi phục ngay sau đó.

## Kết quả chạy mới — 14/11/2026

| Cổng | Kết quả |
|---|---|
| Surefire toàn bộ (H2, `clean test`, `-Duser.timezone=Asia/Ho_Chi_Minh`) | 836 ca (UC8: 829; +7): 15 fail + 11 error **có từ trước**, đúng 9 lớp như mốc UC7 / UC8; không lớp FE-03 / FE-20 nào đỏ |
| Failsafe (PostgreSQL 16.15) | **57/57**: PlatformAccountStatusPostgresIT 6, PlatformAccessChangeMigrationPostgresIT 1, PlatformAccountListPostgresIT 20, AppUserCreatedAtMigrationPostgresIT 1, BrowserSessionFlowIT 18, FarmMemberChangePostgresIT 3, FarmMemberListPostgresIT 8 |
| Frontend `tests/unit` toàn bộ (`VITE_BEEFCARE_DATA_SOURCE=local`) | 1060/1061 ca, 134/136 file: `api/userFacingError.test.ts` (`node:test`) và `pens/PenManagement.test.tsx` TC-04-06, có từ trước |
| Frontend `platform-admin` + `platform-support` (sau dọn hàm thừa) | 79/79 |
| Typecheck / build | **PASS / PASS** (cảnh báo chunk > 500 kB có từ trước) |
| OpenAPI / catalog | Đổi 2 operation (`platform-access`: header Idempotency-Key; `history`: `AccessHistoryItem`), thêm `AccessHistoryItem`, bỏ `AuditItem`, `AccountDetail.accessActions`, mô tả `PlatformAccessRequest`; vẫn 229 path, 283 operation, 315 schema; file bằng JSON của export; `generate_api_catalog.py` chạy lại |

## Runtime

- **HTTP trên backend thật** (`.run/fe03-uc09-http.mjs`, PASS): `spring-boot:run` profile `dev,local`, DB
  riêng `beefcare_uc9` (Liquibase áp từ đầu gồm `20261114000500`), seed `LocalDevelopmentSeeder`. 7 ca từ
  chối đúng mã; cấp CS → `manager-2` vào được màn CS ngay request kế tiếp; phát lại cùng key; COM-19; cấp
  lại cùng vai trò FE03-20; vai trò thứ hai COM-05; đổi sang PM (CS 403, PM 200); thu hồi (PM 403, lặp lại
  FE03-20); khôi phục; A11 RESTORE / REVOKE / CHANGE / GRANT có lý do và SA; tài khoản bị tạm ngưng chỉ còn
  REVOKE (đổi → FE03-22, thu hồi 200); `owner-2` bị tạm ngưng cấp → FE03-22; thu hồi PM → `needsReassignment`
  true, khôi phục → false; thu hồi CS → phiếu về hàng đợi. DB: 11 dòng `platform_access_change` có lý do;
  audit chỉ trước / sau; `AUTO_REQUEUE` cause `CS_ACCESS_REMOVED`. Response mẫu ở
  `docs/api/FE03_UC09_EXAMPLES.md`.
- Lần chạy đầu của script có lỗi riêng của script (tham số `key` bỏ trống dùng giá trị mặc định nên ca
  "thiếu key" thực ra có key) nên `manager@beefcare.local` được cấp CS thật trong DB runtime; backend xử lý
  đúng. Script đã sửa (truyền `null`) và chuyển vòng đời sang `manager-2`. Bản ghi không chứa mật khẩu (đã
  quét).
- **UI chế độ backend** (`.run/fe03-uc09-runtime.mjs`, PASS): 1440×900, 1180×820, 390×844: không còn mục
  sidebar "Quyền nhân sự nền tảng"; nút Quyền nền tảng mở popup trên SCR-16; lý do "abc" bị chặn; Cấp / Thu
  hồi / Khôi phục → MSG-FE03-19; tài khoản của chính SA chỉ có ghi chú. Ở 1440: lịch sử có lý do và SA; SA
  khác đổi quyền trong lúc popup mở → MSG-FE03-20 trên khung chi tiết, popup đóng, tải lại;
  `/nen-tang/quyen/{id}` → `/nen-tang/tai-khoan/{id}?m=access`. Không tràn ngang. Console: 401 dò phiên trước
  đăng nhập, 404 `favicon.ico`, 409 cố ý. Ảnh ở `.run/fe03-uc09-runtime/`.

## Giới hạn và trạng thái

- **BE_REVIEWED trên nhánh, chưa READY_FOR_FE.** Migration mới chưa chạy trên DB dùng chung; bước chép audit
  chỉ chạy trên PostgreSQL (H2 test không có dữ liệu cũ).
- Lịch sử tạm ngưng / khôi phục tài khoản (`app_user_status_change`, D32) chưa có API đọc; SCR-16 không có
  trường cho nó. A11 chỉ là lịch sử vai trò.
- `accessActions` không loại trường hợp "SA cuối cùng" (SA đang gọi luôn là một SA ACTIVE khác); quy tắc vẫn
  được kiểm khi lưu (race đã khóa).
- Ghi chú SA cuối cùng trong popup là văn bản cố định theo SRS, không tính theo số SA hiện có.
- Seed local đều đã xác minh email nên ca FE03-18 chỉ có ở test HTTP / component.
- Spotless / JaCoCo / Modernizer / Checkstyle bỏ qua như quy trình local.

## File thay đổi

- Backend: `PlatformAccessChange` + `PlatformAccessChangeRepository` (mới), Liquibase
  `20261114000500_platform_access_change.xml` + `master.xml`, `PlatformAccountAdministrationService` (A13,
  A11, `accessActions`), `PlatformAccountAdministrationResource` (key, A11), `SupportTicketCommandService`
  (`requeueTicketsOf` có `cause`), `MessageCodes` + `domain_messages*.properties` (MSG-FE03-22).
- Test backend: `PlatformAccessResourceTest`, `PlatformAccessChangeMigrationPostgresIT` (mới),
  `PlatformAccountStatusTransactionTest`, `PlatformAccountAdministrationServiceTest`.
- Frontend `features/platform-admin`: `types`, `api/platformAdminApi`, `domain/platformRules`,
  `data/platformAdminDemoStore`, `data/platformAdminMock`, `components/AccessDialog`, `AccountDetailPanel`,
  `AccountStatusDialog`, `commandOutcome` (mới), `common`, `hooks/useCommandKey` (mới),
  `pages/StaffAccessRoutes` (chuyển hướng); xóa `pages/StaffPage`, `components/PickAccountDialog`;
  `components/Layout` (bỏ mục sidebar); test `tests/unit/platform-admin/*` (mới `AccessDialog.test.tsx`).
- Tài liệu: `docs/api/openapi.json`, `docs/api-handoff.html` (catalog), `docs/api/README.md`,
  `docs/api/FE03_UC09_EXAMPLES.md`, spec FE-03, `OPEN_QUESTIONS.md` (Q4, Q5), D33 trong
  `REQUIREMENT_DECISIONS.md`, phiếu này.
