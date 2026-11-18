# Review BE — D41: Owner có toàn bộ quyền của Manager và Technician trong trại

## Scope

- Chủ BE: DucNV (tự kiểm cùng Claude). FE nhận: chính DucNV; báo chủ feature FE-08 → FE-12 (TuanPQ), FE-23 (TaiDX), FE-14 / FE-16 (AnNT).
- Nhánh `feat/fe03-thanh-vien-quyen`, fast-forward lên `dev` d173ccf ngày 18/11/2026; thay đổi đang ở working tree, **chưa commit**.
- Trạng thái: **BE_REVIEWED** local trên H2; chưa READY_FOR_FE (chưa kiểm HTTP trên PostgreSQL, chưa có trên bản tích hợp).
- Gói: quyền ghi chăm sóc / sinh sản / sổ cho ăn của Owner (`MANAGE_GROWTH`, `MANAGE_HEALTH`, `MANAGE_REPRODUCTION`, `MANAGE_FEEDING`), REM-11 cho Owner (A18 FE-23 và màn nhắc việc FE-14), bảng quyền SCR-08 (`my-permissions`). Không đổi route, DTO, migration.
- Actor: Owner có membership ACTIVE, trại ACTIVE (GBR-14 giữ nguyên). Manager và Technician không đổi quyền.
- Nguồn: D41 trong `docs/REQUIREMENT_DECISIONS.md`; SRS sửa theo D41: Table III-2, chú thích ¹⁰, bảng menu, GBR-08, GBR-102, GBR-103, GBR-104, Table III-3 REM-11, SCR-44, 20 UC ghi, SCR-30 → 34, 37, 39, 40, 83; spec FE-03 §3.4, FE-08 → FE-12, FE-14, FE-16 (Q2), FE-23.

## Acceptance criteria và bằng chứng

| Case | Nguồn | Given / When / Then | Test và tầng | Kết quả |
|---|---|---|---|---|
| Ma trận | D41.1, Table III-2 | `FarmAction` cho Owner 4 quyền ghi mới; Technician vẫn không; trại không ACTIVE vẫn chặn ghi | `FarmAccessServiceTest#roleMatrixEveryRow`, `#serviceNotActive…` (H2) | PASS |
| TC-08-19 / 22 | R-08-09, D41 | Technician ghi cân bị chặn; Owner ghi cân (người đo = Owner) và loại trừ bản ghi Manager ghi | `GrowthGapResourceTest#tc08_22…` (HTTP, H2); `GrowthAssessmentServiceTest#bcsOnlyHalfSteps…` | PASS |
| TC-09-28 / 31 | R-09-16, D41 | Technician dừng lịch 403; Owner tạo lịch, ghi tiêm, dừng lịch | `VaccinationCommandResourceTest#stopWithoutAReason…`, `#tc09_31…`; `CareWorkflowIT#scheduleDoses…` | PASS |
| TC-10-24 / 29 | R-10-14, D41 | Technician mở ca / điều trị 403; Owner điều trị ca Manager mở và mở ca mới, người ghi = Owner | `HealthCaseResourceTest#tc10_24…`, `#tc10_29…`; `CareWorkflowIT#ownerRecordsCare…` | PASS |
| TC-11-20 / 25 | FE-11 §2, D41 | Technician 403; Owner ghi động dục (người quan sát mặc định = Owner), ghi phối, hủy phối | `ReproductionResourceTest#tc11_20…`, `#tc11_25…`; `ReproductionWorkflowIT#theTechnicianCannot…` | PASS |
| TC-12-26 / 27 | FE-12 §2, D41 | Technician 403; Owner khám thai trên lần phối của Manager và ghi đẻ | `ReproductionResourceTest#tc12_26…`, `#tc12_27…` | PASS |
| TC-14-27 | GBR-104, D41 | REM-11 lưu sẵn hiện cho Owner, Manager, Technician; Owner có đích FEEDING_LOG | `ReminderReconciliationIT#anUnrecordedFeedingSession…` | PASS |
| TC-23-02 / 27 | R-23-13, D41 | A18 trả REM-10 và REM-11 cho Owner | `FeedManagementServiceTest#feedRemindersGiveTheOwner…` (unit) | PASS |
| TC-16-17 | R-16-07, D41 | `canCorrect` của bản ghi cân là true cho Owner, false cho Technician | `CattleTimelineServiceTest#tc1617…`, `#tc1610…` | PASS |
| SCR-08 | Table III-2 | `my-permissions` của Owner: GROWTH_BCS, FEEDING_LOG, CATALOGUES_AND_PARAMETERS = FULL | `BrowserSessionFlowIT#profilePermissionTableUsesTheServerVerifiedFarmRole` | PASS |
| UI | D41.3 | Owner thấy nút ghi / sửa ở tab Tăng trưởng, Tiêm phòng, Sức khỏe, Sinh sản, trang Ghi đẻ, Nhật ký cho ăn, dòng thời gian, màn quản lý lịch tiêm; Technician vẫn chỉ xem | Vitest `GrowthPages`, `VaccinationPages`, `HealthPages`, `ReproductionPages`, `reproductionScreens`, `FeedFeedingPage`, `Fe16Timeline`, `sessionRoles` | PASS |
| Bảng quyền | Table III-2 | SCR-13 / popup Mời hiện ô mới; mức FULL / RESTRICTED / NO khớp backend | `workspaceSeed.test.ts`, `MembersPage.test.tsx` | PASS |

Không áp dụng: version / idempotency / rollback không đổi (chỉ đổi vai trò được phép, cùng command cũ).

## Findings và xử lý

| ID | Phân loại | Expected / actual | Xử lý | Kết quả |
|---|---|---|---|---|
| F1 | environment | `-Pdev,!webapp` làm context test lỗi "bean `taskExecutor` … overriding is disabled" ở mọi lớp `@ServiceIntegrationTest` | Chạy Surefire không kèm `-Pdev` | Context lên bình thường |
| F2 | environment | `clean test` đua với VS Code Java build: `ErrorConstants.class` mất giữa chừng | Chạy lại | PASS |
| F3 | test (có sẵn) | `LocalDevelopmentSeederTest#everyLocalIdentity…` đỏ ở dòng Technician (thiếu `VIEW_CARE_CATALOGUES`, `VIEW_FEED_STOCK`), có từ trước D41 | Đã thêm 4 quyền mới cho Owner; dòng Owner / Manager đạt | Còn đỏ như baseline `dev` |
| F4 | test (không ổn định) | `ReminderReconciliationIT#supportedReminderEventPasses…` đỏ khi chạy chung 13 lớp (outbox chạy theo lịch) | Chạy riêng lớp | 18/18 PASS |
| F6 | test theo quy tắc cũ | `GrowthAssessmentServiceTest#bcsOnlyHalfSteps…WrongRolesCannotRecord` khẳng định Owner không ghi được cân; chỉ lộ ra khi chạy toàn bộ Surefire | Đổi thành Technician bị chặn, Owner ghi được | 4/4 PASS |
| F5 | phạm vi | `PlatformSubscriptionQueryService.java` có thay đổi sắp xếp import không do D41 (IDE) | Không sửa, không đưa vào commit D41; `api-handoff.html` giữ `sources` cũ của 4 API nền tảng | Ghi để người dùng quyết định |

## Kết quả chạy thực tế (18/11/2026)

- JDK 21.0.11, Maven 3.9.16, profile test `testh2`, `-Dmodernizer.skip=true`, không `-Pdev`.
- Trước khi sửa code: test mới đỏ đúng chỗ (`CattleTimelineServiceTest#tc1617…` "Expecting value to be true but was false", `FeedManagementServiceTest#feedRemindersGiveTheOwner…`).
- Sau khi sửa: 13 lớp liên quan 183 test, 181 PASS; 2 fail là F3 (có sẵn) và F4 (PASS khi chạy riêng).
- Toàn bộ Surefire `clean test`: 1097 test, 3 skipped, 10 fail. Sau khi sửa F6 còn 9 fail, đúng 4 lớp có sẵn ở baseline `dev` 17/11 (SePayWebhookResourceTest 6, LocalDevelopmentSeederTest 1, GoogleIdentityServiceTest 1, FarmBornEntryTest 1); không hồi quy mới. Failsafe (`*PostgresIT`) chưa chạy; không IT PostgreSQL nào kiểm quyền ghi chăm sóc.
- Frontend (chế độ local): typecheck sạch; Vitest `tests/unit` 1221/1222 (1 fail có sẵn `platform-finance/recordHistoryPagination`, chỉ đỏ ở chế độ local); `test:api` 186/186; `test:integration` 1/1; `vite build` PASS.
- `docs/api-handoff.html`: chạy lại `generate_api_catalog.py`; dữ liệu đổi đúng GBR-08/102/103/104, 11 SCR, 21 UC, D41.
- Chưa kiểm: HTTP trên PostgreSQL và giao diện thật (Docker / backend / Vite chưa chạy trong phiên); kiểm tay của người dùng.

## Handoff FE

- Contract không đổi; chỉ đổi vai trò được phép: Owner nay nhận 2xx thay cho 403 COM-01 ở các lệnh ghi FE-08 → FE-12 và FE-23 (ghi / sửa / hủy bản ghi cho ăn).
- `GET /api/farms/{farmId}/my-permissions` của Owner: GROWTH_BCS, VACCINATION, HEALTH_AND_TREATMENT, REPRODUCTION, CATALOGUES_AND_PARAMETERS, FEEDING_LOG = FULL.
- REM-11 xuất hiện cho Owner ở A18 FE-23 và màn nhắc việc; đích FEEDING_LOG mở `/thuc-an/nhat-ky?date=…` (Technician thêm `readOnly=1`).
- Frontend dùng `canRecordCare` / `useCanRecordCare` (`features/authorization`) thay cho kiểm `role === 'MANAGER'`.
