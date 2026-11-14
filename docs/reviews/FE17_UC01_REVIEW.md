# FE-17 / UC-FE17-01 — Lịch sử audit nền tảng (SA)

## Phạm vi và căn cứ

- D34, người dùng đồng ý toàn bộ đề xuất K1–K12 ngày 15/11/2026 ("theo đề xuất"): danh mục audit trung tâm
  (SCR-51 chỉ hiện 6 nhóm GBR-86, audit dữ liệu trại không hiện); giữ mã đã lưu, ánh xạ sang mã công khai;
  thêm vai trò người thực hiện và correlation ID; một chỗ ghi `AuditService`; tách mã ticket theo thao tác;
  trước / sau theo allowlist từng mã, không lý do; bộ lọc và mã lỗi theo SRS; A3; bỏ xuất CSV.
- Checkout `D:/Project/BeefCare-`, branch `feat/fe17-audit-nen-tang` tạo từ `396fab0` (FE-03 UC9 đã push).
  Migration mới `20261114000600_audit_log_actor_role_correlation`; không đổi DB dùng chung (runtime trên DB riêng
  `beefcare_fe17`), không thêm dependency.
- Nguồn: SRS 28/10 §3.2 J Audit Log Entry (870–876), SCR-51 (4647–4667), GBR-86 (5885), GBR-88 (5887), NFR-S11 /
  NFR-R01 (5748, 5755), MSG-COM (5925–5935), các UC có ghi audit (1715, 1953, 1989, 2373, 2391, 2465, 2483, 2720,
  5574); spec FE-17 §1–10; `backend/AGENTS.md`.
- Ngoài phạm vi: thông báo của SA vẫn chạy dữ liệu mô phỏng ở chế độ backend; ghi audit cho đổi / đặt lại mật
  khẩu (FE-01) và job trả ticket về hàng đợi (FE-20) ghi ở `MISSING_ROUTES.md`.

## Ma trận hợp đồng A1 / A2 / A3 (+ A4)

| Field | Kiểu / bắt buộc | Nguồn và round trip |
|---|---|---|
| `from`, `to` | `yyyy-MM-dd`, bắt buộc | thiếu → COM-06 `field=from|to`; sai kiểu → COM-10; `from > to` → COM-11; `to > from.plusMonths(12)` → COM-10 `dateRange`; lọc `logged_at ∈ [from 00:00, to+1 00:00)` giờ Asia/Ho_Chi_Minh |
| `actor` | string ≤ 254, tùy chọn | `lower(full_name) like` hoặc `lower(email) like` (escape `%`, `_`, `\`); FE gửi "Hệ thống" / "System" thành `system=true` |
| `system` | boolean, mặc định false | `actor_id is null`; dùng cùng `actor` → COM-10 `field=actor` |
| `action` | mã công khai (A3), tùy chọn | lạ (kể cả mã lưu như `PEN_MOVE`) → COM-10 |
| `targetType` | 8 giá trị SCR-51, tùy chọn | lạ → COM-10; với `action` không cùng loại → trang rỗng |
| `dir` | desc \| asc | sắp `logged_at`, rồi `id` cùng chiều |
| `page`, `size` | page từ 0; size 20, kẹp 1–100 | sai kiểu → COM-10 |
| → `audit_log` (đọc) | chỉ mã thuộc danh mục | `action IN (…) OR action LIKE '%\_PAYMENT\_PAID'`; tên người thực hiện / đích đọc bằng cột (tuple), không nạp `AppUser` |
| A1 item | `{id, time, actor{id, name, initials, role}\|null, action, targetType, targetLabel}` | `actor_role` lưu sẵn; `targetLabel` theo loại đích lưu (tên / "tên · trại" / mã), email che khi không có tên |
| A2 | `{…, farm{id, name}\|null, targetId, before{}, after{}, correlationId}` | trường theo allowlist của mã; ngoài danh mục / không có → 404 COM-08 |
| A3 | `[{code, targetType}]` | `PlatformAuditCatalog.actions()` |
| A4 `AuditService` | MANDATORY transaction | điền `actor_role` (FarmContext → vai trò đã kiểm; còn lại nền tảng / trại theo phạm vi của mã) và `correlation_id` (MDC, hoặc UUID mới) |
| `X-Request-Id` | header mọi response | `CorrelationIdFilter`: giữ giá trị 8–64 `[A-Za-z0-9._-]` của client, còn lại UUID; MDC `correlationId`; job: UUID mỗi lượt |

## Khoảng trống tìm thấy và cách sửa

| # | Khoảng trống | Sửa |
|---|---|---|
| G1 | SA xem được audit dữ liệu bò / lâm sàng (HEALTH_*, VACCINATION_*, CALVING_*…) qua A1 / A2, trái GBR-86 | Danh mục trung tâm; A1 chỉ đọc mã trong danh mục, A2 ngoài danh mục → 404 COM-08 |
| G2 | Chi tiết `PLATFORM_ACCESS_*` rỗng (khóa `fromRole/toRole…` không nằm trong allowlist chung) | Allowlist theo mã, đọc mọi dạng nguồn (`xBefore/xAfter`, `fromX/toX`, `before{}`/`after{}`, một giá trị) |
| G3 | `Map.copyOf(details)` ném NPE khi JSON có giá trị null → 500 | Đọc giá trị đơn, bỏ null / rỗng / "NONE" |
| G4 | Allowlist chung có `reason`, `amount`, `paymentCode`… → lý do lệnh hiện ở audit trung tâm | Không hiện lý do (như D30 / D32 / D33); chỉ trường của từng mã |
| G5 | Không lưu vai trò người thực hiện, không có correlation ID | Cột `actor_role`, `correlation_id` + filter + decorator scheduler + pattern log |
| G6 | 6 service nền tảng / job tự `new AuditLog()` | Gọi `AuditService.log / logAt / logAndFlush`; details giữ nguyên |
| G7 | Ticket: CLAIM / HANDOVER / RELEASE / CLASSIFY / ASK_CUSTOMER chung mã `SUPPORT_PROCESS`, details chỉ `status`; yêu cầu nội bộ ghi đích là ticket | `SUPPORT_<action>`, details `statusBefore`, `status`, `assignee`; yêu cầu nội bộ đích `InternalRequest` với trạng thái và người nhận |
| G8 | A1: khoảng ngày không bắt buộc, không giới hạn 12 tháng, `Instant` và `from < to` chặt, chỉ lọc `actorId`, không đảo chiều, 25 / trang | Theo D34 (bảng trên) |
| G9 | FE: chế độ backend báo "chưa tích hợp"; mã hành động / loại đích tự đặt khác backend; nút Xuất CSV và dropdown người thực hiện không có trong SRS; mặc định 8 ngày; giờ theo máy | Nối A1 / A2 / A3 với kiểm từng trường; ô tìm, 20 / trang, đảo chiều, MSG-COM-03 / 04 / 06 / 10 / 11, gợi ý "Tối đa 12 tháng", giờ Asia/Ho_Chi_Minh, chi tiết đọc A2 (mở trực tiếp được mục ngoài khoảng), sao chép mã truy vết; bỏ CSV |
| G10 | Spec ghi sai mã MSG (COM-03 cho không có quyền, COM-02 cho tải lỗi) | Sửa spec theo bảng MSG-COM của SRS |

## Test

| Nơi | Ca | Tầng |
|---|---|---|
| `PlatformAuditCatalogTest` (mới, 7) | Mã công khai / mã lưu duy nhất; ánh xạ; dữ liệu trại, lời mời, giá gói, trả lời ticket, `SUPPORT_PROCESS` cũ không thuộc danh mục; đọc các dạng trước / sau; TC-17-05 / 06 / 07 allowlist bỏ lý do, mật khẩu, token, khóa, webhook secret, chứng từ, nội dung ticket; phạm vi vai trò; chọn theo bộ lọc | Unit |
| `CorrelationIdTest` (mới, 3) | Giữ / thay `X-Request-Id`; MDC; mỗi lượt job một ID và trả lại giá trị cũ | Unit |
| `PlatformAuditResourceTest` (mới, 13) | TC-17-01 (PM, CS, Owner, SA bị thu hồi → COM-01; không phiên 401); A3; TC-17-02 khóa tài khoản qua HTTP: 1 mục, vai trò SA, `correlationId` = `X-Request-Id`, không lý do; header trả về; TC-17-15 / R-17-05 / 06 ngày giờ VN cả hai đầu, mới nhất trước, đảo chiều, cùng thời điểm theo id, mục dữ liệu trại không hiện và A2 → 404; TC-17-13 / 14 lọc mã, loại đích, người thực hiện (tên / email, hoa thường, ký tự `%_`), "System"; TC-17-10 lỗi; phân trang; TC-17-12 405; nhãn đích / email che; số câu lệnh cố định (không N+1); TC-17-08 JOB-04 → "System", có correlation ID; TC-17-07 luồng ticket + yêu cầu nội bộ: mã từng thao tác, vai trò OWNER / CS / PM, trước / sau, người phụ trách, không nội dung | HTTP + security chain + DB (H2) |
| `PlatformAuditTransactionTest` (mới, 2) + `PlatformAuditTransactionPostgresIT` | TC-17-04 cùng key 3 lần → A1 có 1 mục; TC-17-03 lỗi sau khi flush → A1 không có mục | Không có transaction ngoài; H2 + PostgreSQL 16.15 |
| `PlatformAuditPostgresIT` (mới) | 13 ca của `PlatformAuditResourceTest` trên PostgreSQL (migration mới, biên ngày, LIKE escape, tuple) | PostgreSQL 16.15 |
| `PlatformReconciliationResourceTest` (+1) | TC-17-05 PM chấp nhận thanh toán thật → PAYMENT_CONFIRMED + EVIDENCE_REVIEWED vai trò PM, có số tiền / quyết định, không lý do, mã giao dịch, nội dung chuyển khoản, tài khoản nhận; mục chứng từ không hiện | HTTP + DB |
| `ReportsAndAuditIT` (sửa) | Đọc audit ở tầng service theo API mới; lý do / mật khẩu / token không hiện (trước đây khẳng định lý do hiện, trái D34) | Service (Failsafe) |
| `PlatformAccountAdministrationServiceTest` (sửa) | Lệnh quyền nền tảng gọi `AuditService` với trước / sau, không lý do | Service |
| `platformRules.test.ts`, `platformAdminApi.test.ts` | Khoảng ngày (COM-06 / 11 / 10, 29/02), 7 ngày gồm hôm nay, ô "Hệ thống", allowlist, nhãn; store mô phỏng lọc / đảo chiều / chi tiết; query A1; đọc A1 / A2 / A3 ở chế độ backend, không đụng mock, thiếu / sai trường bị từ chối | Adapter / store |
| `PlatformAdminPages.test.tsx` | SCR-51: không còn CSV, gợi ý 12 tháng, trước / sau có "—", đổi dòng, đảo chiều, lọc hành động; ô người thực hiện + MSG-COM-04 + Xóa bộ lọc; mở trực tiếp mục ngoài khoảng không lộ nội dung ticket, không có nút sao chép khi thiếu mã; MSG-COM-03 | Component |

## Kết quả chạy mới — 15/11/2026

| Cổng | Kết quả |
|---|---|
| Surefire nhóm FE-17 (`clean test`) | **47/47**: Catalog 7, CorrelationId 3, AuditResource 13, AuditTransaction 2, AccountAdministrationService 3, Reconciliation 19 |
| Surefire toàn bộ (H2, `test`) | 862 ca (UC9: 836; +26 ca FE-17): 15 fail + 11 error **có từ trước**. Đối chứng: xuất mã `396fab0` bằng `git archive` ra thư mục riêng, chạy 9 lớp lỗi → đúng 26 lỗi giống hệt (FarmBornEntry, HerdEntryCorrection, HerdEntryPosting, HerdEntryImport, HerdEntryResource `earTagNumber`; FarmAccessService / LocalDevelopmentSeeder ma trận quyền; GoogleIdentityService; SePayWebhookResource 6 ca lệch ngày / múi giờ) |
| Failsafe (PostgreSQL 16.15, `-Duser.timezone=Asia/Ho_Chi_Minh`) | **48/48**: ReportsAndAuditIT 3, BrowserSessionFlowIT 18, PlatformAccessChangeMigrationPostgresIT 1, PlanPriceTransactionPostgresIT 5, PlatformAccountStatusPostgresIT 6, PlatformAuditPostgresIT 13, PlatformAuditTransactionPostgresIT 2 |
| Frontend `tests/unit` toàn bộ (`VITE_BEEFCARE_DATA_SOURCE=local`) | 1062/1065 ca, 132/136 file. Lỗi: `api/userFacingError.test.ts` (`node:test`, có từ trước), `pens/PenManagement.test.tsx` TC-04-06 (có từ trước, ghi ở UC9), `cattle/UpdateModal.backend.test.tsx` (ngày hiện tại), `platform-service/PlatformServicePages.test.tsx` SCR-61 (khoảng ngày của thanh toán mẫu 10/11/2025). Hai file sau không import gì của `platform-admin`; chưa chạy được đối chứng trên `396fab0` (vitest nạp hai bản module khi dùng chung `node_modules` qua junction) |
| Frontend `platform-admin` + `platform-support` (sau đổi nhãn menu) | 83/83 |
| Typecheck / build | **PASS / PASS** (cảnh báo chunk > 500 kB có từ trước) |
| OpenAPI / catalog | Thêm `GET /api/platform/audit/actions`; đổi 2 operation audit; thêm `AuditPage`, `AuditRow`, `AuditActor`, `AuditDetail`, `AuditFarm`, `AuditActionOption`, bỏ `AuditEntry`, `PageAuditEntry`; 230 path, 284 operation, 319 schema. Chỉ ghép phần audit vào file cũ (export đảo thứ tự khóa Page / Sort / CSRF), kết quả bằng JSON của export; `generate_api_catalog.py` chạy lại |

## Runtime

- **HTTP trên backend thật** (`.run/fe17-runtime.mjs`, PASS): `spring-boot:run` profile `dev,local`, DB riêng
  `beefcare_fe17` (Liquibase áp từ đầu gồm `20261114000600`), seed `LocalDevelopmentSeeder`. SA tạm ngưng / khôi
  phục `technician-2` với `X-Request-Id` riêng → header trả đúng giá trị; A1 có ACCOUNT_SUSPENDED vai trò SA, đích
  "Local Technician 2"; A2 trước / sau trạng thái, `correlationId` = giá trị đã gửi, không có lý do; A3 30 mã; mọi
  dòng A1 thuộc danh mục; PM và Owner 403 COM-01; quá 12 tháng COM-10 `dateRange`; `from > to` COM-11; DELETE 405.
  Log backend có `[correlationId]` cho request và từng lượt job. Mẫu response ở `docs/api/FE17_UC01_EXAMPLES.md`
  (`.run/fe17-examples.mjs`).
- **UI chế độ backend** (PASS): 1440×900, 1180×820, 390×844, không tràn ngang. Ở 1440: lọc ACCOUNT_SUSPENDED → mọi
  dòng đúng mã, chi tiết ACTIVE → SUSPENDED và mã truy vết; ô "Hệ thống" gửi `system=true`; tìm không thấy →
  "Không có bản ghi phù hợp." + Xóa bộ lọc; bấm cột Thời gian gửi `dir=asc`. Console: 401 dò phiên trước đăng nhập,
  404 `favicon.ico` (có từ trước). Lần chạy đầu: một kiểm tra của script dùng regex sai (`SUSPENDED` chứa "PEN") và
  ảnh chụp trước khi danh sách lọc xong; đã sửa script (chờ đúng response), chạy lại PASS. Ảnh ở `.run/fe17-runtime/`.
  Bản ghi runtime không chứa mật khẩu (đã quét).

## Giới hạn và trạng thái

- **BE_REVIEWED trên nhánh, chưa READY_FOR_FE.** Migration mới chưa chạy trên DB dùng chung.
- Mục ghi trước D34: không có vai trò và correlation ID ("—"); mục `SUPPORT_PROCESS` cũ không hiện (không phân biệt
  được thao tác); mục yêu cầu nội bộ cũ có đích là ticket (nhãn là mã ticket, trạng thái là của ticket).
- Chưa ghi audit: đổi / đặt lại mật khẩu (FE-01, LamKD), job trả ticket về hàng đợi (FE-20); TC-17-06 kiểm bằng
  allowlist. Ticket phạm vi tài khoản (không có trại) do Owner tạo không có vai trò (Owner chỉ có vai trò trong trại).
- Ghi audit không có `FarmContext` thêm tối đa 2 câu đọc vai trò. Correlation ID của job dựa vào scheduler tự cấu hình
  của Spring Boot; job gọi trực tiếp (test) có UUID mới mỗi mục. Frontend không gửi `X-Request-Id`, backend tự tạo.
- Chưa đo với khối dữ liệu lớn trên bản tích hợp (đã có index và phân trang ≤ 100).
- Đụng code FE-20 / FE-21 (LamKD): mã audit ticket, đích yêu cầu nội bộ, writer của thu chi; details giữ nguyên.
  Cần báo LamKD khi tích hợp.
- Spotless / JaCoCo / Modernizer / Checkstyle bỏ qua như quy trình local.

## File thay đổi

- Backend: `PlatformAuditCatalog`, `CorrelationId`, `web/filter/CorrelationIdFilter` (mới); `AuditService` (vai trò,
  correlation ID, `logAt`, `logAndFlush`); `AuditLog` (2 cột); Liquibase
  `20261114000600_audit_log_actor_role_correlation.xml` + `master.xml`; `AsyncConfiguration` (decorator scheduler);
  `logback-spring.xml` (`[%X{correlationId}]`); `PlatformAuditQueryService`, `PlatformAuditResource` (A1–A3); dùng
  `AuditService` ở `PlatformAccountAdministrationService`, `PlatformFarmService`, `PlatformFinanceService`,
  `SubscriptionPaymentService`, `PlanPriceService`, `payment/SePayWebhookService`, `payment/SubscriptionLifecycleJob`;
  `SupportTicketCommandService`, `InternalSupportRequestService` (mã ticket, trước / sau, đích yêu cầu nội bộ).
- Test backend: `PlatformAuditCatalogTest`, `CorrelationIdTest`, `PlatformAuditResourceTest`,
  `PlatformAuditTransactionTest`, `PlatformAuditPostgresIT`, `PlatformAuditTransactionPostgresIT` (mới);
  `PlatformReconciliationResourceTest`, `ReportsAndAuditIT`, `PlatformAccountAdministrationServiceTest`.
- Frontend: `features/platform-admin` `types`, `api/platformAdminApi`, `domain/platformRules`,
  `data/platformAdminDemoStore`, `data/platformAdminMock`, `pages/AuditPage`, `components/common` (bỏ
  `downloadTextFile`); `components/Layout` (nhãn "Lịch sử audit"); test `tests/unit/platform-admin/*`.
- Tài liệu: `docs/api/openapi.json`, `docs/api-handoff.html` (catalog), `docs/api/README.md`,
  `docs/api/FE17_UC01_EXAMPLES.md`, spec FE-17, `OPEN_QUESTIONS.md` (Q1–Q5), `MISSING_ROUTES.md`, D34 trong
  `REQUIREMENT_DECISIONS.md`, phiếu này.
