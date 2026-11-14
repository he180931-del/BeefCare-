# FE-03 / UC-FE03-07 — Xem tài khoản người dùng (SA)

## Phạm vi và căn cứ

- D31, người dùng đồng ý cả tám đề xuất ngày 14/11/2026: phạm vi A9 + A10 + SCR-16; hiện cả
  tài khoản chưa xác minh; tìm tên/email giữ dấu; lọc vai trò platform ACTIVE ("Không có" gồm
  đã thu hồi); tên tiếng Việt, 20 dòng/trang, giữ bộ lọc trong phiên; trại tham gia =
  membership ACTIVE; thêm `created_at`, bỏ SĐT; giờ Asia/Ho_Chi_Minh.
- Checkout `D:/Project/BeefCare-`, branch `feat/fe03-thanh-vien-quyen`, base `b45519d` (UC6 đã
  commit). Chưa commit/push. Có migration mới `20261114000300_app_user_created_at`; không đổi
  DB dùng chung (runtime chạy trên DB riêng `beefcare_uc7`), không thêm dependency.
- Nguồn: SRS 28/10 UC list (1114), SCR-16 (3150–3177), Permission Matrix (1375), User Account
  (461–468), UC-FE03-09 PRE-2 (1858), GBR-09/10/11, Table III-1 (2789–2794), MSG-COM-03/04/08/10;
  spec FE-03 §3.5/5/6/7/9/10; `backend/AGENTS.md`.
- Ngoài phạm vi: lệnh UC8 (tạm ngưng / khôi phục) và UC9 (quyền platform, lịch sử A11) chỉ đổi
  dạng phản hồi sang `AccountDetail` và nhãn, không chứng nhận; ở chế độ backend frontend vẫn
  báo "chưa tích hợp" cho chúng và cho trang "Quyền nhân sự" (FE-03 Q5). FE-03 Q4 vẫn mở.

## Ma trận hợp đồng A9 / A10

| Field | Kiểu / bắt buộc | Nguồn và round trip |
|---|---|---|
| query `q` | string ≤ 100, tùy chọn | `lower(email)` hoặc `lower(full_name)` LIKE `%q%` (escape `\`, `%`, `_`); không tìm `phone` |
| query `status` | ACTIVE \| SUSPENDED | `upper(account_status)`; sai → COM-10 `field=status` |
| query `platformRole` | NONE \| CS \| PM \| SA | Subquery `platform_staff_access` ACTIVE (NONE = not exists ACTIVE) |
| query `page` / `size` / `sort` / `dir` | 0… / 1–100 (20) / `name` / asc\|desc | `ORDER BY vi_sort(coalesce(nullif(trim(full_name),''), email)), lower(email), id`; PostgreSQL `collate "vi-x-icu"`, H2 `lower()` |
| items[].id / email / fullName | Long > 0 / string / string (có thể trống) | `app_user` |
| items[].accountStatus | ACTIVE \| SUSPENDED | `app_user.account_status` |
| items[].platformRole / platformAccessStatus | CS\|PM\|SA / ACTIVE\|REVOKED, null | `platform_staff_access` qua fetch join (quyền đang lưu; REVOKED vẫn trả) |
| items[].emailVerified | boolean | `google_subject` có giá trị hoặc `jhi_user.activated` cùng email (1 câu cho cả trang) |
| items[].farmCount / farmRoles | int64 / OWNER, MANAGER, TECHNICIAN | `farm_membership` ACTIVE, group by user + role (1 câu cho cả trang) |
| total / page / size | int64 / int / int | `Page` sau lọc |
| A10 signInMethods | PASSWORD / GOOGLE | `password_login_enabled`, `google_subject` |
| A10 createdAt | instant, bắt buộc | `app_user.created_at` (mới, NOT NULL, `@PrePersist` + default DB) |
| A10 lastSignInAt | instant, null | max(`password_last_used_at`, `google_last_used_at`) |
| A10 ownerRegistrationCompleted / At | boolean / instant, null | `app_user` |
| A10 ownedFarms | string[] | Tên trại của membership OWNER, Collator tiếng Việt |
| A10 platformAccessVersion / version | Long null / Long | Dùng cho UC9 / UC8 |
| (bỏ) phone | — | Không còn trong A9, A10, phản hồi suspend / restore / platform-access |

## Khoảng trống tìm thấy và cách sửa

| # | Khoảng trống | Sửa |
|---|---|---|
| G1 | SCR-16 chỉ chạy mock; backend mode báo "chưa tích hợp" | Adapter `accountPage` / `accountDetail` kiểm từng trường, báo lỗi khi thiếu thay vì gán mặc định |
| G2 | Không có lọc vai trò platform ở BE, FE lọc phía client trên một trang | Tham số `platformRole` theo vai trò ACTIVE |
| G3 | BE xếp theo email, size mặc định 25; FE 50 dòng | Tên tiếng Việt, `dir`, 20 dòng; FE cột Người dùng có nút đảo, `aria-sort` |
| G4 | Tham số sai bị nuốt (trang âm thành 0, trạng thái lạ ra danh sách rỗng) | 400 COM-10 `params.field` (cả sai kiểu qua handler riêng) |
| G5 | Tìm theo SĐT; DTO trả `phone` | Bỏ |
| G6 | Thiếu số trại, xác minh, tạo lúc, đăng nhập cuối, trại sở hữu | `farmCount/farmRoles`, `emailVerified`, `signInMethods`, `created_at` mới, `lastSignInAt`, `ownedFarms` |
| G7 | Chi tiết lấy trong trang đang xem; link sâu tới tài khoản ở trang khác hiện nhầm dòng đầu | Đọc A10 theo id trên URL; chỉ hiện khi id của dữ liệu khớp id đang chọn |
| G8 | Mỗi dòng 1 câu SQL đọc `platform_staff_access` (N+1) | Fetch join; đếm membership và xác minh theo cả trang |
| G9 | Không giữ bộ lọc, không có Xóa bộ lọc / Làm mới | sessionStorage theo email SA; MSG-COM-04 + Xóa bộ lọc; Làm mới đọc lại A9 + A10 |
| G10 | Giờ theo múi giờ máy; nhãn "Tạm khóa / Mở khóa", câu "chỉ đăng nhập Google" | Giờ Asia/Ho_Chi_Minh; "Tạm ngưng / Khôi phục"; mô tả cả email + mật khẩu |
| G11 | Lỗi DB khi GET là lỗi chung | Handler của resource: GET → 500 MSG-COM-03; lệnh → COM-02 / COM-05 |

## Test

| Nơi | Ca | Tầng |
|---|---|---|
| `PlatformAccountListResourceTest` (+ `PlatformAccountListPostgresIT`) | Thứ tự, vai trò lưu / ACTIVE, xác minh, trại tham gia, không SĐT (TC-03-74); lọc status / CS / PM / SA / NONE, tên, email, không SĐT, `%` `_` (TC-03-75); phân trang, trùng tên, desc (TC-03-76); 11 tham số sai + `q` 101 ký tự (TC-03-77); CS / PM / SA thu hồi / Owner / SA bị tạm ngưng / ẩn danh cho A9 và A10 (TC-03-78); A10 đủ trường, chưa xác minh, 404, id sai kiểu (TC-03-79); phản hồi suspend là `AccountDetail`; số câu SQL 2 = 12 tài khoản (TC-03-80); thứ tự tiếng Việt `an, Ánh, ăn, Ân, Bình, dương, Đỗ, Zoe` (chỉ PostgreSQL) | HTTP + security chain + DB |
| `AppUserCreatedAtMigrationPostgresIT` (mới) | Nâng cấp từ schema UC6: `jhi_user.created_date` (email khác hoa thường), liên kết sớm nhất, điều khoản, lúc nâng cấp; NOT NULL + default; cột khác giữ nguyên (TC-03-81) | Migration PostgreSQL |
| `PlatformAccountAdministrationServiceTest` | Constructor mới; cấp quyền / SA cuối vẫn đúng | Service |
| `platformAdminApi.test.ts` | Tìm giữ dấu, không SĐT; lọc ACTIVE / NONE; thứ tự, desc, 20 dòng, chỉ cột danh sách; backend mode: query, phong bì, chi tiết giữ null, 8 dạng dữ liệu sai bị từ chối, STAFF và UC8 chưa nối | Adapter / store |
| `PlatformAdminPages.test.tsx` | Thứ tự + đảo + "Không có / CS đã thu hồi" + "3 (Chủ trại)"; 20 dòng, giữ bộ lọc/chiều trong phiên, Xóa bộ lọc; link sâu ngoài trang lọc, giờ Asia/Ho_Chi_Minh; chưa xác minh, chưa đăng nhập, không SĐT, id không còn (TC-03-82); nhãn Tạm ngưng / Khôi phục | Component |
| `platformRules.test.ts` | Vai trò ACTIVE, ghi chú thu hồi, trại tham gia, xác minh, Collator, giờ +7 | Unit |

Chưa chụp RED trên code cũ trước khi sửa.

## Kết quả chạy mới — 14/11/2026

| Cổng | Kết quả |
|---|---|
| Surefire chọn lọc (H2, `clean verify`) | **31/31** (1 skipped có chủ đích: thứ tự tiếng Việt chỉ chạy trên PostgreSQL): PlatformAccountList 20, PlatformAccountAdministrationService 2, FarmMemberList 8, OpenApiContract 1 |
| Failsafe (PostgreSQL 16.15) | **48/48 PASS**: PlatformAccountListPostgresIT 20, AppUserCreatedAtMigrationPostgresIT 1, MembershipJoinedAtMigrationPostgresIT 1, FarmMemberListPostgresIT 8, BrowserSessionFlowIT 18 |
| Surefire toàn bộ (H2, `clean test`, `-Duser.timezone=Asia/Ho_Chi_Minh`) | 819 ca: 15 fail + 11 error, **đều có từ trước**: cùng 9 lớp cho đúng 15 + 11 khi chạy trên bản `git archive` của HEAD `b45519d` (chưa có UC7) với cùng cờ — FarmAccessService / LocalDevelopmentSeeder (ma trận quyền FE-18/FE-23), FarmBornEntry / HerdEntryCorrection / HerdEntryImport / HerdEntryPosting / HerdEntryResource (MSG-COM-06 `earTagNumber`), GoogleIdentityService (mock lockout), SePayWebhookResource (lệch giờ khi JVM chạy Asia/Ho_Chi_Minh) |
| Frontend `tests/unit/platform-admin` | **40/40 PASS** (`VITE_BEEFCARE_DATA_SOURCE=local`) |
| Frontend `tests/unit` toàn bộ | 1049/1050 ca, 132/134 file: `api/userFacingError.test.ts` (dùng `node:test`, có từ trước) và `pens/PenManagement.test.tsx` TC-04-06 (đỏ cả khi chạy riêng; diff UC7 không đụng `pens` hay component dùng chung) |
| Typecheck / build | **PASS / PASS** (cảnh báo chunk > 500 kB có từ trước) |
| OpenAPI / catalog | Chỉ 6 operation `/api/platform/accounts` và schema đổi: thêm `AccountPage`, `AccountListItem`, `AccountDetail`, bỏ `AccountSummary`, `PageAccountSummary`; 229 path, 283 operation, 315 schema; export không lệch thứ tự `PageableObject`; `generate_api_catalog.py` chạy lại |

Lệnh backend (từ `backend/`):

```powershell
mvn.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dmodernizer.skip=true' '-Dcheckstyle.skip=true' '-Dapi.version=1.44' '-Duser.timezone=Asia/Ho_Chi_Minh' '-Dlogging.level.org.hibernate.SQL=OFF' '-Dmaven.test.failure.ignore=true' '-Dtest=PlatformAccountListResourceTest,PlatformAccountAdministrationServiceTest,FarmMemberListResourceTest,OpenApiContractTest' '-Dit.test=PlatformAccountListPostgresIT,AppUserCreatedAtMigrationPostgresIT,MembershipJoinedAtMigrationPostgresIT,FarmMemberListPostgresIT,BrowserSessionFlowIT' clean verify
```

## Runtime

- **HTTP trên backend thật:** `mvn spring-boot:run` profile `dev,local`, PostgreSQL 16.15 của
  compose, DB riêng `beefcare_uc7` (Liquibase áp từ đầu gồm `20261114000300`), seed của
  `LocalDevelopmentSeeder`, đăng nhập session + CSRF bằng `sa@beefcare.local`. A9 trả 10 tài
  khoản theo thứ tự tiếng Việt ("Local …", "Nhân viên hỗ trợ", "Other Farm Owner"); lọc CS /
  NONE / SUSPENDED, `q=OWNER`, SĐT không khớp; 5 tham số sai → 400 COM-10 đúng `field`; A10
  owner có `createdAt`, `lastSignInAt` cập nhật sau khi owner đăng nhập, `ownedFarms`; id lạ →
  404 COM-08; CS / PM / Owner → 403 COM-01; ẩn danh → 401; không có `phone`. Response mẫu ở
  `docs/api/FE03_UC07_EXAMPLES.md`.
- **UI chế độ backend:** `.run/fe03-uc07-runtime.mjs` (playwright-core + Chrome, Vite proxy
  `/api` → backend trên, không phải automated E2E). 1440×900, 1180×820, 390×844: 10 dòng đúng
  thứ tự A9, dòng đầu được chọn, chi tiết từ A10; không tràn ngang. Ở 1440: đảo sắp xếp, lọc
  CS, rỗng + Xóa bộ lọc, giữ bộ lọc trạng thái sau tải lại, link `/nen-tang/tai-khoan/{owner}?q=pm@beefcare`
  hiện chi tiết owner trong khi danh sách chỉ có PM, id lạ báo lỗi trong khung chi tiết. Console
  chỉ có 401 của lần dò phiên trước đăng nhập và 404 của ca id lạ (cố ý). Ảnh ở
  `.run/fe03-uc07-runtime/`.

## Giới hạn và trạng thái

- **BE_REVIEWED trên nhánh, chưa READY_FOR_FE.** Migration mới chưa chạy trên DB dùng chung.
- Thứ tự tiếng Việt cần collation ICU `vi-x-icu` (có trong postgres:16.15 của compose và
  Testcontainers). DB khác không có ICU sẽ lỗi khi đọc A9; H2 (test nhanh) dùng `lower()` nên
  chỉ đúng thứ tự ASCII.
- Tìm không phân biệt hoa thường dựa vào `lower()` của PostgreSQL: chữ hoa có dấu (Đ, Ư…) chỉ
  được hạ đúng khi DB dùng ctype UTF-8 (mặc định của image `postgres`).
- `google_last_used_at` của tài khoản Google cũ được migration `20261108000100` đặt bằng lúc
  nâng cấp, nên "Đăng nhập cuối" của họ có thể là thời điểm đó tới khi họ đăng nhập lại.
- Tài khoản seed đều `owner_registration_completed=true` (kể cả Manager/Technician), nên
  runtime hiện "Có" cho mọi seed; test HTTP kiểm cả Có và Không.
- Trên điện thoại, khung chi tiết nằm dưới danh sách; nhãn cột dạng thẻ là "Người dùng ↑/↓"
  (giống SCR-13).
- `@Schema(nullable = true)` không xuất ra OpenAPI (springdoc 3.0); các trường null được ghi ở
  mô tả và trong ví dụ.
- Spotless / JaCoCo / Modernizer / Checkstyle bỏ qua như quy trình local.

## File thay đổi

- Backend: `AppUser` (`createdAt`, `@PrePersist`), `VietnameseSortFunctionContributor` +
  `META-INF/services/org.hibernate.boot.model.FunctionContributor`, `FarmMembershipRepository`
  (đếm vai trò ACTIVE theo trang, tên trại sở hữu), `UserRepository` (email đã kích hoạt theo
  trang), `PlatformAccountAdministrationService` (A9/A10, `AccountListItem`, `AccountPage`,
  `AccountDetail`), `PlatformAccountAdministrationResource` (tham số, handler COM-10/COM-03),
  Liquibase `20261114000300_app_user_created_at.xml` + `master.xml`.
- Test backend: `PlatformAccountListResourceTest`, `PlatformAccountListPostgresIT`,
  `AppUserCreatedAtMigrationPostgresIT` (mới), `PlatformAccountAdministrationServiceTest`.
- Frontend `features/platform-admin`: `types`, `api/platformAdminApi`, `domain/platformRules`,
  `data/platformAdminMock`, `data/platformAdminDemoStore`, `pages/AccountsPage`,
  `components/AccountDetailPanel`, `AccountStatusDialog`, `AccessDialog`, `common`,
  `pages/StaffPage`; test `tests/unit/platform-admin/*`.
- Tài liệu: `docs/api/openapi.json`, `docs/api-handoff.html` (catalog), `docs/api/README.md`,
  `docs/api/FE03_UC07_EXAMPLES.md`, spec FE-03, `OPEN_QUESTIONS.md` (Q2), D31 trong
  `REQUIREMENT_DECISIONS.md`, phiếu này.
