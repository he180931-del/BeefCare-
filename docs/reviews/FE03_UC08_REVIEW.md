# FE-03 / UC-FE03-08 — Tạm ngưng / khôi phục tài khoản (SA)

## Phạm vi và căn cứ

- D32, người dùng đồng ý cả bảy đề xuất ngày 14/11/2026 ("theo đề xuất"): tạm ngưng chỉ chặn đăng
  nhập (không thu hồi vai trò / membership); lịch sử ở bảng `app_user_status_change`, audit không
  ghi lý do; lý do 5–500 ký tự; khôi phục được cả tài khoản chưa xác minh; phiếu của CS về hàng đợi
  ngay trong lệnh; `InternalView.needsReassignment` tính lúc đọc; A10 trả `actions[]`.
- Checkout `D:/Project/BeefCare-`, branch `feat/fe03-thanh-vien-quyen`, base `5476455` (UC7 đã
  commit). Có migration mới `20261114000400_app_user_status_change`; không đổi DB dùng chung
  (runtime chạy trên DB riêng `beefcare_uc8`), không thêm dependency.
- Nguồn: SRS 28/10 UC-FE03-08 (1833–1850), SCR-16 (3154–3174), Permission Matrix (1376, chú thích
  1440), User Account (461–468), Table III-1 (2789, 2794, 2795), GBR-04 (5771), GBR-10 (5777), GBR-77
  (5872), BR-D06 (934), MSG-FE03-14 → 20 (5981–5987), SCR-67 Needs attention (5061); spec FE-03 §3.5,
  4, 5, 6, 7, 8, 9; spec FE-20 R-20-05, A16; `backend/AGENTS.md`.
- Ngoài phạm vi: UC9 (popup quyền platform, lịch sử A11, FE-03 Q4, Q5). Ở chế độ backend, lệnh UC9
  và trang "Quyền nhân sự" vẫn báo "chưa tích hợp".

## Ma trận hợp đồng A12 (+ A10, InternalView)

| Field | Kiểu / bắt buộc | Nguồn và round trip |
|---|---|---|
| header `Idempotency-Key` | string ≤ 128, bắt buộc | `IdempotencyCommandService.executePlatform(SA, ACCOUNT_SUSPEND / ACCOUNT_RESTORE)`; hash gồm id tài khoản + body; thiếu → 400 COM-06 `field=Idempotency-Key` |
| body `reason` | string, bắt buộc | `@NotBlank @Size(max=500)` ở HTTP (COM-06 / COM-10); service bỏ khoảng trắng đầu cuối, 5–500, ≥ 5 ký tự không phải khoảng trắng (COM-10 `field=reason`) → `app_user_status_change.reason` (varchar 500); không vào audit |
| body `version` | int64, bắt buộc | `@NotNull` (COM-06 `field=version`); so với `app_user.version` sau khóa dòng, sau FE03-20 (COM-05) |
| path `id` | int64 | `findByIdForUpdate` (404 COM-08); sai kiểu → COM-10 `field=id` |
| → `app_user.account_status` | ACTIVE ⇄ SUSPENDED | Cập nhật trong transaction; version tăng |
| → `app_user_status_change` | dòng mới | action SUSPEND / RESTORE, status_before / after, reason, changed_by_id (SA), changed_at |
| → `audit_log` | dòng mới | `ACCOUNT_SUSPEND` / `ACCOUNT_RESTORE`, target AppUser, details `{statusBefore, statusAfter}` |
| → `support_ticket.assigned_cs_id` | null cho phiếu chưa CLOSED của tài khoản bị tạm ngưng | `SupportTicketCommandService.requeueTicketsOf` (khóa phiếu, lịch sử `AUTO_REQUEUE` `{cause: ACCOUNT_SUSPENDED}`, outbox, thông báo CS khả dụng) |
| response | `AccountDetail` (A10) | thêm `actions[]`: SUSPEND (ACTIVE, không phải SA đang gọi) / RESTORE (SUSPENDED) / rỗng |
| `InternalView.needsReassignment` | boolean | OPEN và người nhận không khả dụng (`available`: tài khoản ACTIVE + vai trò đúng ACTIVE + identity không chờ kích hoạt); A16 của người nhận luôn false |

## Khoảng trống tìm thấy và cách sửa

| # | Khoảng trống | Sửa |
|---|---|---|
| G1 | Không có Idempotency-Key | `executePlatform` như các lệnh platform khác; handler COM-06 cho header thiếu |
| G2 | Lý do chỉ kiểm ≤ 500; lý do nằm trong audit | 5–500, ≥ 5 không phải khoảng trắng; bảng lịch sử riêng, audit chỉ trước / sau |
| G3 | Kiểm version trước trạng thái (version cũ + đã tạm ngưng ra COM-05) | Thứ tự D32: … FE03-17 → FE03-20 → COM-05 → SA cuối |
| G4 | Khôi phục tài khoản chưa xác minh báo FE03-18 (thông báo UC9) | Bỏ kiểm này (D32 Q4) |
| G5 | Phiếu của CS bị tạm ngưng chỉ về hàng đợi khi job 60 giây chạy | `requeueTicketsOf` trong cùng transaction; job giữ làm lưới an toàn |
| G6 | Không có "đánh dấu cần giao lại" yêu cầu nội bộ | `needsReassignment` tính lúc đọc; SCR-68 hiện ghi chú (xuống dòng được trên điện thoại) |
| G7 | Race: hai SA cuối cùng tạm ngưng nhau cùng lúc thì cả hai qua (chỉ khóa dòng đích, đếm SA từ entity đã nạp) | Khóa thêm dòng của SA đang gọi theo thứ tự id (native `select … for update`, không nạp entity để tránh lỗi optimistic khi version đổi); đọc lại từ DB SA đang gọi còn ACTIVE (COM-01) và số SA ACTIVE khác (FE03-17). Đếm SA bằng truy vấn DB cũng dùng cho thu hồi quyền UC9 (khóa dòng SA đang gọi của UC9 làm khi làm UC9) |
| G8 | Nút Tạm ngưng hiện cả trên tài khoản của chính SA | A10 `actions[]`; FE ẩn ô lý do và nút, hiện ghi chú |
| G9 | Hết hạn phiên dùng `Set.of(login, email)`: tài khoản có login trùng email (mọi tài khoản thật) làm lệnh tạm ngưng 500 "duplicate element" (có từ trước UC8; chỉ runtime bắt được vì fixture test dùng login khác email) | `LinkedHashSet`; test hồi quy với login = email và một phiên đã đăng ký (RED 500 trên code cũ, GREEN sau sửa) |
| G10 | FE: lệnh UC8 ở chế độ backend báo "chưa tích hợp"; câu MSG-FE03-16 / 17 lệch spec; lỗi nghiệp vụ hiện trong hộp thoại kèm nút "Tải lại" | Adapter A12 (kiểm `actions`, gửi `version` + key); câu theo spec; lỗi FE03-17 / FE03-20 / COM-05 / COM-08 đóng hộp thoại, hiện trên khung chi tiết, tải lại A9 + A10, giữ lý do; lỗi lưu / mạng giữ hộp thoại và cùng key |
| G11 | `FE03-17` VN "tự đình chỉ" | Câu theo spec mục 8 |

## Test

| Nơi | Ca | Tầng |
|---|---|---|
| `PlatformAccountStatusResourceTest` (mới, 6) | TC-03-83 lịch sử + audit không có lý do, vai trò / membership giữ nguyên, request kế tiếp FE01-03; login = email + phiên đã đăng ký bị hết hạn (hồi quy G9); TC-03-84 khôi phục tài khoản chưa xác minh, quyền REVOKED / membership INACTIVE giữ nguyên; TC-03-85 thứ tự COM-01 → COM-08 → lý do → FE03-17 → FE03-20 (version cũ) → COM-05, 401, thiếu version / key, không ghi gì, A10 của chính mình `actions=[]`; TC-03-88 phiếu chưa CLOSED về hàng đợi, CLOSED / CS khác giữ nguyên; TC-03-89 `needsReassignment` false → true → false, DONE luôn false | HTTP + security chain + DB (H2) |
| `PlatformAccountStatusTransactionTest` (mới, 3) + `PlatformAccountStatusPostgresIT` | TC-03-86 tài khoản / lịch sử / audit / phiếu commit cùng nhau, phát lại cùng key, COM-19; lỗi sau khi ghi → rollback tất cả; TC-03-87 hai SA cuối tạm ngưng nhau: lệnh sau chờ khóa rồi 403 COM-01, đúng 1 SA ACTIVE (chỉ PostgreSQL) | Không có transaction ngoài; H2 + PostgreSQL 16.15 |
| `PlatformAccountAdministrationServiceTest` | Thứ tự khóa theo id trước khi kiểm SA cuối; không ghi khi từ chối; đếm SA bằng truy vấn DB | Service |
| `PlatformAccountListResourceTest` | Ca phản hồi suspend của UC7 gửi thêm Idempotency-Key | HTTP |
| `platformAdminApi.test.ts` | Lý do 5–500, thứ tự NO_CHANGE trước STALE, `actions`; A12 backend: path, body `{reason, version}`, key, `actions` thiếu / sai bị từ chối; UC9 vẫn chưa nối | Adapter / store |
| `AccountStatusDialog.test.tsx` (mới, 4) | Phân loại lỗi backend; lỗi lưu giữ hộp thoại và cùng key; lỗi nghiệp vụ gọi `onRefused`, lần sau khóa mới; MSG-FE03-14 / 15 / 16; lý do ngắn không gửi | Component |
| `PlatformAdminPages.test.tsx` | MSG-FE03-16; tài khoản của chính mình không có ô lý do / nút; lý do 5 ký tự; lỗi nghiệp vụ đóng hộp thoại, hiện lý do, tải lại, giữ lý do | Component |
| `supportApi.test.ts` | Giữ `needsReassignment` từ API | Adapter |

RED đã chụp: (1) bỏ khóa dòng SA đang gọi → TC-03-87 đỏ (lệnh thứ hai không chờ); (2) khôi phục
`Set.of` → ca login = email trả 500. Cả hai được khôi phục ngay sau khi chụp.

## Kết quả chạy mới — 14/11/2026

| Cổng | Kết quả |
|---|---|
| Surefire chọn lọc sau bản sửa G9 (`clean verify`) | PlatformAccountStatusResource 6/6, PlatformAccountStatusTransaction 3/3 (1 skip có chủ đích: race chỉ PostgreSQL), PlatformAccountList 20/20 (1 skip có chủ đích), PlatformAccountAdministrationService 3/3, OpenApiContract 1/1 |
| Failsafe (PostgreSQL 16.15) | PlatformAccountStatusPostgresIT **3/3** (sau bản sửa G9), PlatformAccountListPostgresIT 20/20, AppUserCreatedAtMigrationPostgresIT 1/1, BrowserSessionFlowIT 18/18, FarmMemberChangePostgresIT 3/3, FarmMemberListPostgresIT 8/8. `InternalRequestResourceIT` (CRUD do JHipster sinh) 17 error **có từ trước**: context không nạp được vì thiếu `beefcare.email.frontend-base-url`; bản `git archive` của HEAD `5476455` lỗi y hệt 17/17 cùng nguyên nhân |
| Surefire toàn bộ (H2, `clean test`, `-Duser.timezone=Asia/Ho_Chi_Minh`), chạy lại sau bản sửa G9 | 829 ca (UC7: 819; +10 ca UC8): 15 fail + 11 error, **đều có từ trước**: đúng 9 lớp và đúng số lượng như mốc UC7 (FarmAccessService / LocalDevelopmentSeeder, FarmBornEntry / HerdEntryCorrection / HerdEntryImport / HerdEntryPosting / HerdEntryResource, GoogleIdentityService, SePayWebhookResource); không lớp FE-03 / FE-20 nào đỏ |
| Frontend `tests/unit` toàn bộ (`VITE_BEEFCARE_DATA_SOURCE=local`) | 1056/1057 ca, 133/135 file: `api/userFacingError.test.ts` (dùng `node:test`) và `pens/PenManagement.test.tsx` TC-04-06, cả hai có từ trước (ghi ở review UC7) |
| Frontend `platform-admin` + `platform-support` sau khi sửa SCR-68 | 75/75 |
| Typecheck / build | **PASS / PASS** (cảnh báo chunk > 500 kB có từ trước) |
| OpenAPI / catalog | Chỉ 2 operation (`suspend`, `restore`: header Idempotency-Key) và 3 schema (`AccountChange`, `AccountDetail.actions`, `InternalView.needsReassignment`) đổi; 229 path, 283 operation, 315 schema; file trong repo bằng JSON của export; `generate_api_catalog.py` chạy lại |

Lệnh backend (từ `backend/`):

```powershell
mvn.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dmodernizer.skip=true' '-Dcheckstyle.skip=true' '-Dapi.version=1.44' '-Duser.timezone=Asia/Ho_Chi_Minh' '-Dlogging.level.org.hibernate.SQL=OFF' '-Dmaven.test.failure.ignore=true' '-Dtest=PlatformAccountStatusResourceTest,PlatformAccountStatusTransactionTest,PlatformAccountListResourceTest,PlatformAccountAdministrationServiceTest,OpenApiContractTest' '-Dit.test=PlatformAccountStatusPostgresIT,PlatformAccountListPostgresIT,AppUserCreatedAtMigrationPostgresIT,BrowserSessionFlowIT,FarmMemberChangePostgresIT,FarmMemberListPostgresIT' clean verify
```

## Runtime

- **HTTP trên backend thật** (`.run/fe03-uc08-http.mjs`, PASS): `spring-boot:run` profile `dev,local`,
  PostgreSQL 16.15 của compose, DB riêng `beefcare_uc8` (Liquibase áp từ đầu gồm `20261114000400`),
  seed `LocalDevelopmentSeeder`, session + CSRF. A10: tài khoản khác `actions=[SUSPEND]`, chính mình
  `[]`. 7 ca từ chối đúng mã (PM 403 COM-01, id lạ 404 COM-08, lý do 400 COM-10, thiếu key 400
  COM-06, chính mình 409 FE03-17, khôi phục tài khoản ACTIVE với version cũ 409 FE03-20, version cũ
  409 COM-05). Tạm ngưng CS 200, vai trò CS vẫn ACTIVE; phát lại cùng key trả cùng body; cùng key
  khác lý do 409 COM-19; phiên đang mở của CS → 401, đăng nhập lại → 403 MSG-FE01-03; phiếu CS đang
  giữ về hàng đợi (IN_PROGRESS giữ nguyên); tạm ngưng PM → `IR-2552.needsReassignment=true`, khôi phục
  → false; khôi phục CS → đăng nhập lại được. DB: 6 dòng `app_user_status_change` có lý do, 6 audit
  chỉ `{statusBefore, statusAfter}`, `AUTO_REQUEUE` `{cause: ACCOUNT_SUSPENDED}`. Response mẫu ở
  `docs/api/FE03_UC08_EXAMPLES.md`.
- **UI chế độ backend** (`.run/fe03-uc08-runtime.mjs`, playwright-core + Chrome, Vite proxy `/api`,
  không phải automated E2E), PASS: 1440×900, 1180×820, 390×844: lý do "a b c" bị chặn trước hộp
  thoại; MSG-FE03-14 → MSG-FE03-16 "Tạm ngưng", nút Khôi phục; MSG-FE03-15 → "Đang hoạt động"; tài
  khoản của chính SA chỉ có ghi chú. Ở 1440: SA khác tạm ngưng trong lúc hộp thoại mở → hộp thoại
  đóng, "Không có thay đổi: cs@beefcare.local đã ở trạng thái này." trên khung chi tiết, nút Khôi
  phục, lý do giữ nguyên. SCR-68 (CS) 1440 và 390: "Người nhận không còn khả dụng – cần đổi người
  nhận". Không tràn ngang (lần chạy đầu bắt được tràn ở 390 do badge không xuống dòng → đổi thành
  dòng ghi chú). Console: 401 của lần dò phiên trước đăng nhập, 409 cố ý (FE03-20), 404
  `favicon.ico` của Vite. Ảnh ở `.run/fe03-uc08-runtime/`.
- Bản ghi HTTP lần đầu có lưu mật khẩu seed trong body đăng nhập (thư mục `.run/` bị gitignore, không
  commit); đã xóa khỏi file và script giờ luôn che `password`.

## Giới hạn và trạng thái

- **BE_REVIEWED trên nhánh, chưa READY_FOR_FE.** Migration mới chưa chạy trên DB dùng chung.
- Version của tài khoản tăng mỗi lần người đó đăng nhập thành công: nếu họ đăng nhập đúng lúc SA mở
  hộp thoại, SA nhận MSG-COM-05, màn tải lại và SA xác nhận lại (SRS bước 4 yêu cầu kiểm version).
- Phiên không có trong `SessionRegistry` (ví dụ sau khi máy chủ khởi động lại) vẫn bị filter từ chối
  bằng 403 MSG-FE01-03 ở request kế tiếp; phiên đã đăng ký thì nhận 401 rồi MSG-FE01-03 khi đăng nhập.
- `needsReassignment` gọi `available` 2 câu SQL cho mỗi yêu cầu OPEN trong màn của CS (tối đa 1 OPEN
  mỗi vai trò mỗi phiếu); màn của người nhận không gọi.
- A11 (`/history`) vẫn đọc audit: sau D32, mục `ACCOUNT_*` không còn lý do; lịch sử có lý do nằm ở
  `app_user_status_change`, chưa có API đọc (SCR-16 không có trường lịch sử) — để UC9 chốt cùng lịch
  sử vai trò. Lệnh quyền platform (UC9) vẫn ghi lý do vào audit và chưa khóa dòng SA đang gọi.
- Spotless / JaCoCo / Modernizer / Checkstyle bỏ qua như quy trình local.

## File thay đổi

- Backend: `AppUserStatusChange` + `AppUserStatusChangeRepository` (mới), Liquibase
  `20261114000400_app_user_status_change.xml` + `master.xml`, `AppUserRepository.lockRow`,
  `PlatformStaffAccessRepository` (đếm SA từ DB), `PlatformAccountAdministrationService` (lệnh A12,
  `actions`, khóa theo thứ tự id, hết hạn phiên), `PlatformAccountAdministrationResource` (key, handler
  COM-06 / COM-10), `SupportTicketCommandService` (`requeueTicketsOf`, `needsReassignment`),
  `InternalSupportRequestService` (màn người nhận), `SupportDtos.InternalView`,
  `domain_messages_vi.properties` (MSG-FE03-17).
- Test backend: `PlatformAccountStatusResourceTest`, `PlatformAccountStatusTransactionTest`,
  `PlatformAccountStatusPostgresIT` (mới), `PlatformAccountAdministrationServiceTest`,
  `PlatformAccountListResourceTest`.
- Frontend: `features/platform-admin` (`types`, `api/platformAdminApi`, `domain/platformRules`,
  `data/platformAdminDemoStore`, `data/platformAdminMock`, `components/AccountDetailPanel`,
  `components/AccountStatusDialog`), `features/platform-support` (`types`, `api/supportApi`,
  `pages/TicketPage`); test `tests/unit/platform-admin/*` (mới `AccountStatusDialog.test.tsx`),
  `tests/unit/platform-support/supportApi.test.ts`.
- Tài liệu: `docs/api/openapi.json`, `docs/api-handoff.html` (catalog), `docs/api/README.md`,
  `docs/api/FE03_UC08_EXAMPLES.md`, spec FE-03, spec FE-20, D32 trong `REQUIREMENT_DECISIONS.md`,
  phiếu này.
