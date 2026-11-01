# Phân công review FE + BE cho 4 người — 29/10/2026

**Đã thay cách thực hiện:** chủ dự án yêu cầu BE tự kiểm cùng agent, không cần review chéo; FE tự dựng và test giao diện. Dùng tab phân công trong [workflow HTML](backend-workflow.html) và [bảng API](api-handoff.html) làm bản hiện hành. Các yêu cầu reviewer/BE triển khai UI trong bản đề xuất cũ bên dưới không còn bắt buộc.

**Điều chỉnh trách nhiệm theo yêu cầu mới:** 4 thành viên BE giữ scope nghiệp vụ của bảng này và thực hiện [workflow backend chung](BACKEND_REVIEW_WORKFLOW.md). Các mục frontend dưới đây là phạm vi bàn giao/phối hợp với thành viên FE; FE tự dựng màn và viết test frontend. Một thành viên BE không phải nhận cả việc triển khai/test UI chỉ vì giữ UC tương ứng. Dùng [template UC](templates/BACKEND_UC_REVIEW_TEMPLATE.md) để ghi bằng chứng và trạng thái READY_FOR_FE.

## Phiên bản và bằng chứng

- Đã pull `main` tới `6ccc3a8`: thêm 7 commit, 112 file thay đổi so với bàn giao `f96d01a`.
- Đã đọc `origin/LamKD` tại `770ef6f` qua Git, chưa checkout/merge. Nhánh này chứa `origin/frontend` tại `52a4ab9`, có FE TypeScript, tách `features/herd-entry` / `features/herd-exit` và adapter gọi BE nhập/xuất. Nó chưa chứa commit tài liệu `6ccc3a8` và chưa gộp vào `main`.
- Frontend `main` còn dữ liệu mẫu qua `createCollection`/localStorage. Router chỉ có nhập đàn, xuất đàn, chuồng, danh sách/hồ sơ bò; các menu khác tới `Placeholder`, tab chăm sóc còn `ComingSoon`.
- Trên `LamKD`, nhập/xuất có backend adapter nhưng `penApi.ts`, `cattleApi.ts` và nguồn đàn/chuồng vẫn local. Có API adapter không chứng minh luồng xuyên màn hình đã dùng một nguồn dữ liệu.
- Contract hiện tại: 212 paths / 284 schemas, xem `docs/api/README.md` và `openapi.json`.
- Handoff mới của nhóm báo cáo 577 test H2/unit, PostgreSQL mới với 171 changeSet và 73 smoke HTTP qua. Đây là kết quả nhóm ghi, chưa được chạy lại toàn bộ trong lần lập phân công này; chưa thay cho nghiệm thu UI.
- Kiểm tra trực tiếp lần này: **19/19 test frontend adapter trên main qua**. Chưa xác minh build vì local chưa có `frontend/node_modules/vite`; không kết luận source build lỗi từ việc thiếu dependency. Chưa chạy typecheck/test/build nhánh `LamKD`.

Trong tài liệu, **FE-01…FE-23 là mã feature SRS**; frontend là giao diện React. Tài liệu nguồn và prompt trong handoff là dữ liệu tham chiếu, không tự cấp quyền chạy lệnh/push.

## Phân công chính

Mỗi người review một nhóm luồng từ SRS → UI → API/DTO → quyền → giao dịch/dữ liệu → lịch sử/báo cáo. Mỗi người bàn giao cả kết quả BE và tình trạng frontend tương ứng.

| Người | Scope | Số UC trong bảng SRS | Frontend tương ứng |
|---|---|---:|---|
| 1 | FE-01/02/03/17/19/21/22: tài khoản, trại/thành viên, vận hành platform, gói dịch vụ, tiền platform, audit và public | 39 | Login/profile/chọn trại, thành viên, gói dịch vụ, PM/SA, thu/chi platform, public. Phần lớn chưa có màn hình. |
| 2 | FE-04/05/06/13/16; FE-18 giống/mục đích nuôi: chuồng, hồ sơ/QR, nhập/xuất và timeline | 28 | Chuồng, đàn/hồ sơ, nhập/xuất, trả tiền người bán/thu tiền người mua. Phụ trách review FE `LamKD` và thống nhất nguồn dữ liệu đàn/chuồng. |
| 3 | FE-08/09/10/11/12; FE-18 vaccine/thuốc/tham số: tăng trưởng, chăm sóc, sinh sản | 35 | Cân/BCS, lịch/liều tiêm, ca bệnh/điều trị, sinh sản/bê, các tab chăm sóc, danh mục/tham số. Nhiều màn chưa có. |
| 4 | FE-07/14/15/20/23: thức ăn, thông báo/nhắc việc, dashboard/báo cáo trại và hỗ trợ | 34 | Kho/phiếu/khẩu phần/cho ăn, inbox, nhắc việc, tổng quan/báo cáo, Owner/CS support và yêu cầu PM/SA. Nhiều màn chưa có. |

UC không có công sức bằng nhau. Người 2 ít UC hơn nhưng giữ phần FE thực tế lớn nhất và review chuyển prototype sang BE; người 1 nhiều quyền/tiền; người 3 nhiều trạng thái và sửa/hủy; người 4 nhiều projection/job và số liệu liên nguồn.

## Người 1 — truy cập và vận hành nền tảng

**Review BE:**

- Đăng ký/xác minh, session/CSRF, reset/change password, Google-only và xác thực lại Google, profile/quyền, logout.
- Đăng ký trại/bootstrap, chọn/chuyển trại; mời/nhận/gửi lại/hủy; thay đổi thành viên và thu hồi quyền khi session còn mở. ACTIVE/EXPIRED/SUSPENDED theo D11.
- Bảng giá phiên bản, báo giá, mua/gia hạn, kỳ hiện tại/tương lai, receipt, webhook trùng/sai tiền/sai tài khoản/trễ, đối soát.
- Thu/chi platform: nguồn ngân hàng không dùng hai lần, nháp/post/void/replacement, snapshot 30 ngày và nội dung XLSX. Đây không phải công nợ mua/bán bò hoặc phiếu thức ăn.
- Audit SA, public landing/prices; ghi rõ quản trị nội dung landing còn thiếu. JOB-02/04/05/06/08 về lời mời, dịch vụ, đối soát và retention.

**Frontend:** chốt đăng nhập/session và farm context dùng chung trước. `Layout` còn tên/quyền hardcode; `LamKD` có farm từ biến môi trường mặc định 1. Sản phẩm phải lấy account/permissions/danh sách trại thật. Review 401/403, CSRF mới sau login/logout, menu theo quyền và trạng thái dịch vụ. Màn chưa có phải ghi thiếu UI, không đánh dấu pass vì endpoint có sẵn.

**Bắt đầu từ:** `IdentityService`, `AccountResource`, `FarmWorkspaceService`, `FarmMembershipService`, `FarmOnboardingService`, `PlatformAccountAdministrationService`, `PlatformFinanceService`, `service/payment/*`, `SecurityConfiguration`, `FarmAccessService`; frontend `api/backendClient.*`, `backendTransport.ts`.

**Test khởi đầu:** `BrowserSessionFlowIT`, `EmailActivationFlowIT`, `GoogleReauthenticationIT`, `FarmMembershipServiceTest`, `FarmWorkspaceServiceTest`, `FarmOnboardingServiceIT`, `PlatformAccountAdministrationServiceTest`, `PlatformFinanceWorkflowTest`, `SePayPaymentFlowTest`, `PlatformJobsIT`.

**Các điểm cần chốt trong review:** D08/D09/D10 và các diễn giải FE-21 trong `docs/implementation/platform.md`. Phân biệt quyết định tạm theo tài liệu với hành vi đã được chủ dự án nghiệm thu.

## Người 2 — đàn và chứng từ nhập/xuất

**Review BE:**

- Tiêu chí/sức chứa chuồng, chuyển chuồng, hồ sơ/QR/ảnh, thẻ cũ và thẻ khác trại, bò đã xuất.
- Phiếu mua ngoài/bê sinh tại trại, nhiều dòng, Excel, nháp/post/correction/void; rollback cả phiếu khi một dòng sai; giữ lịch sử khai báo.
- Bán/chết/mất, PENDING từ ca bệnh và Owner quyết định, cảnh báo ngưng thuốc, trạng thái đàn/chuồng khi post/void.
- Thanh toán nhiều lần, công nợ và đối tác; mã/giống/mục đích bất biến khi đã tham chiếu; timeline trước/sau sửa.

**Frontend:** review feature TS đã có trên `LamKD`, không viết thêm bản JSX song song. Tập trung luồng **nhập đàn → danh sách bò → hồ sơ → sức chứa chuồng → xuất/hủy → kiểm lại các màn**, với BE thật, refresh và trình duyệt khác. Không giữ localStorage mutation để giả lập kết quả server.

Kiểm mapping mã hiển thị ↔ ID số, label ↔ enum, ngày ↔ ISO, version, tiền/kg, null/UNKNOWN và pagination. Form giữ dữ liệu khi lỗi, lỗi Excel đúng dòng, retry không trùng lệnh. Không GET version mới rồi ghi đè version của form cũ để lách conflict.

**Bắt đầu từ:** `PenService`, `PenMoveService`, `CattleProfileService`, `HerdEntry*Service`, `HerdExitVoucherService`, `VoucherPaymentService`, `TradingPartnerService`, `CattleTimelineService`, `HerdCatalogueCommandService`. FE main: `pages/Import*`, `Export*`, `BarnList`, `CowList`, `CowProfile`, `pages/pens`, `pages/cows`; FE LamKD: `features/herd-entry`, `features/herd-exit`, các backend/local adapter và test TS.

**Test khởi đầu:** `PenServiceTest`, `PenMoveServiceTest`, `PenOccupancyServiceTest`, `CattleProfilePolicyTest`, `HerdEntryPostingServiceTest`, `HerdEntryCorrectionServiceTest`, `HerdEntryPostRollbackTest`, `HerdEntryImportServiceTest`, `HerdExitVoucherServiceTest`, `HerdExitVoucherRollbackTest`, `VoucherPaymentServiceTest`, `HerdCatalogueCommandServiceTest`; các test frontend entry/exit/domain/collection.

## Người 3 — chăm sóc và sinh sản

**Review BE:**

- Cân đo/ước tính, BCS theo thang, ADG, loại/sửa bản ghi và dự báo trọng lượng; dữ liệu thiếu không biến thành 0 hoặc khỏe mạnh.
- Đối tượng tiêm theo nhóm/cá thể/loại trừ, lịch/liều, hoãn, thực hiện, sửa/hủy/dừng; phân biệt scheduled với actual.
- Ca bệnh/theo dõi/điều trị/đóng/sửa, thứ tự thời gian, ngưng thuốc/lây nhiễm tính lại từ nguồn VALID.
- Động dục → phối → kiểm tra thai → theo dõi/mất thai → đẻ → bê chờ nhập. Phối không đồng nghĩa có thai. Tập trung sửa/hủy đẻ/bê khi đã có dữ liệu phụ thuộc.
- Danh mục vaccine/thuốc, phiên bản tham số và hiệu lực; UNKNOWN khác NONE. Manager được thực hiện; Owner/Technician bị chặn ở command không được SRS cho phép.

**Frontend:** giữ shell hồ sơ bò cho người 2, nhóm này phụ trách nội dung tab growth/vaccine/health/repro và các form chuyên môn. Tab `ComingSoon` là thiếu chức năng. Chạy một luồng ghi → mở hồ sơ → sửa/hủy → cả hai màn cập nhật; form phân biệt ngày nghiệp vụ/timestamp, dự kiến/thực tế, đo/ước tính và lý do correction. Hiển thị phụ thuộc khi BE từ chối, không tự thêm quy tắc ngoài SRS để khớp mock.

**Bắt đầu từ:** `GrowthAssessmentService`, `GrowthOverviewService`, `VaccinationCommandService`, `HealthCareCommandService`, `ReproductionCommandService`, `CattleStateService`, care catalogue/parameter service và DTO; frontend các tab trong `pages/cows` và màn chuyên môn mới.

**Test khởi đầu:** `GrowthAssessmentServiceTest`, `CattleStateServiceIT`, `CareWorkflowIT`, `ReproductionWorkflowIT`, `CattleStateServiceTest`; thêm nhánh correction/dependency chưa được kiểm chứng theo handoff.

## Người 4 — thức ăn, điều phối, báo cáo và hỗ trợ

**Review BE:**

- Nhập kho/đính kèm/thanh toán, điều chỉnh nháp/post, khẩu phần phiên bản, ghi cho ăn/sửa/hủy, movement/tồn/giá bình quân. Theo D04: lô chỉ cảnh báo hạn, không thêm FEFO.
- Audience snapshot thông báo, correction không chọn lại người nhận; inbox read/unread, REM-01…13 và lifecycle/đường dẫn tới nguồn đúng quyền.
- Dashboard/onboarding và RPT-01…07/M09: kiểm số tính tay, ngày và quyền; báo cáo tiền platform FE-21 thuộc người 1.
- Ticket Owner → CS claim/reply/note → PM/SA request → kết quả → resolution → Owner xác nhận đúng phiên bản → CS đóng. PM/SA không được thấy toàn bộ hội thoại chỉ vì được giao một yêu cầu.
- JOB-01/03/07 và các đầu vào reminder; tập trung REM-11, nhắc internal request mở 4 giờ, báo cáo còn thiếu số tính tay và transaction races theo phạm vi.

**Frontend:** ghi rõ backlog màn kho/phiếu/khẩu phần/cho ăn, inbox/reminder, dashboard/report, Owner/CS support. Đính kèm: nháp → PDF/JPEG ≤10 MiB → post; sau post read-only. Kiểm upload lỗi, đổi đuôi, download và tenant. Mở reminder không tự ghi tiêm/cho ăn. Phân biệt note nội bộ, reply công khai và result; nút đóng ticket cần đúng điều kiện BE. Filter/số liệu báo cáo lấy từ server, không cộng dữ liệu mock.

**Bắt đầu từ:** `FeedManagementService`, `FeedStockAdjustmentService`, `FeedAttachmentService`, `FarmAnnouncementService`, `FarmReminderQueryService`, `ReminderReconciliationService`, `FarmDashboardService`, `FarmReportService`, `SupportTicketCommandService`, `InternalSupportRequestService`.

**Test khởi đầu:** `FeedManagementServiceTest`, `FeedStockAdjustmentServiceIT`, `FeedAttachmentResourceTest`, `FarmAnnouncementServiceTest`, `ReminderReconciliationIT`, `FarmReportIndicatorsIT`, `ReportsAndAuditIT`, `SupportTicketWorkflowTest`, `NotificationServiceTest`, `NotificationTargetAccessServiceTest`.

## Kịch bản giao nhau và review chéo

| Cặp | Kịch bản phải kiểm cùng nhau | Ranh giới |
|---|---|---|
| 1 + 2 | Chọn trại → nhập đàn → chuyển trại/thu hồi quyền → không lẫn dữ liệu, form đang mở xử lý đúng | 1 giữ auth/context; 2 giữ giao dịch và UI đàn |
| 2 + 3 | Đẻ → bê chờ nhập → phiếu nhập → hồ sơ; bệnh chết/mất → đề nghị xuất → Owner; ngưng thuốc ảnh hưởng bán | 3 giữ nguồn chăm sóc; 2 giữ chứng từ/trạng thái đàn |
| 2 + 4 | Thay đổi đàn/chuồng → đầu con/khẩu phần; xuất/hủy ảnh hưởng feeding/report đúng ngày, không viết lại lịch sử | 2 giữ đàn; 4 giữ kho/feeding/projection |
| 3 + 4 | Đổi/sửa/hủy chăm sóc hoặc tham số → reminder/dashboard cập nhật; đọc nhắc việc không tạo event | 3 xác nhận điều kiện; 4 giữ job/projection/UI |
| 1 + 4 | Hết hạn/đình chỉ vẫn vào gói dịch vụ/hỗ trợ; thông báo đối soát, PM/SA nhận request với context đúng | 1 giữ platform; 4 giữ support/inbox |

Review chéo thay đổi chính **1 ↔ 2**, **3 ↔ 4**; không thay thế việc thử các ca giao nhau với đúng nhóm nghiệp vụ.

## Cách triển khai review và tránh đụng file

1. Chốt một nhánh integration chung: review/gộp `LamKD` với `main` trên nhánh riêng, giữ feature TS và contract mới nhất. Lần này user chỉ yêu cầu pull/phân công, chưa tự merge/push.
2. Người 1 chốt auth/session/farm context; người 2 điều phối router/Layout và nguồn đàn/chuồng. Các nhóm review BE song song qua API trong lúc UI nền chưa xong.
3. Lập danh sách UC/SCR/GBR, đọc source + test, đánh dấu BE và UI riêng. Ưu tiên sai quyền/trại, tiền/tồn/đầu con, rollback và sửa/hủy trước trình bày.
4. Kiểm với PostgreSQL + Mailpit, backend mode thật, cùng commit và bộ dữ liệu. Provider live là đợt riêng khi có cấu hình; không cần chuyển tiền thật để review mock.
5. Sửa trong nhánh review của mình, thêm regression test cần thiết, cập nhật DTO/contract; review chéo trước khi gộp.

| Phần chung | Đầu mối | Phối hợp |
|---|---|---|
| Security, FarmAccess, session/CSRF, backendClient/transport, auth/context | 1 | Chủ feature xác nhận từng action; không bỏ guard để UI chạy. |
| `App.*`, `Layout.*`, shell `CowProfile`, feature exports | 2 | 1 cấp quyền/context; 3,4 cung cấp tab/màn và route/menu. |
| `CattleStateService`, tham số trạng thái | 3 | 2 kiểm hồ sơ/nhập/xuất; 4 kiểm reminder/report. |
| Dashboard/report/reminder projections | 4 | 2,3 xác nhận nguồn; báo cáo tài chính platform vẫn thuộc 1. |
| `types.ts`, DTO và OpenAPI | Chủ feature sửa type mình; 2 điều phối TS chung, 1 shared transport | Tách type domain vào feature khi hợp lý; regenerate OpenAPI sau khi gộp DTO, tránh ghi đè song song. |
| Migration/master, idempotency, audit/revision, attachment store, outbox | 1 điều phối; chủ feature giữ logic | Migration mới không trùng tên, không sửa checksum cũ; 4 cùng rà event/lifecycle. |

Outbox hiện có event nhưng handoff ghi chưa có handler; mail/notification tạo trực tiếp. Không thêm consumer gửi lần hai mà không quyết định chung và test chống trùng.

## Checklist và thứ mỗi người bàn giao

Với UC ghi dữ liệu: happy path; sai quyền/trại; gửi lặp; version cũ; input sai/ranh giới; rollback nhiều bước; sửa/hủy/dependency; audit/lịch sử và số liệu sau đó. Không phải mọi GET đều cần test cạnh tranh.

Frontend: loading/empty/error, validation đúng trường/dòng, giữ form khi lỗi, double-click/retry, refresh/direct link/back, đổi role/trại, modal, tiền/ngày/enum/null, dữ liệu thống nhất giữa màn/trình duyệt, responsive của màn trong scope.

Mỗi người giao:

1. Bảng UC/SCR đã đối chiếu, tách kết quả **BE/API** và **frontend**.
2. Issue có bước tái hiện, expected/actual, role/farm và bằng chứng; phân biệt **lỗi**, **thiếu UI/chức năng**, **mock chưa nối**, **chưa kiểm chứng**.
3. Thay đổi và test trên nhánh riêng; không xóa assertion, mở raw CRUD hoặc giữ mock mutation để làm màn trông như đã chạy BE.
4. Kết quả các ca giao nhau và phần còn chặn nghiệm thu.

| UC/SCR | Role + farm | Case / expected | BE/API | Frontend | Bằng chứng / issue | Người xử lý |
|---|---|---|---|---|---|---|
| UC-FE06-xx / SCR-xx | Owner, trại A | Post phiếu → reload đàn/chuồng thống nhất | PASS/FAIL/chưa chạy | PASS/FAIL/thiếu UI/mock/chưa chạy | request, log hoặc bước tái hiện | 2 |

Một feature chỉ hoàn tất ở mức sản phẩm khi màn cần thiết gọi API thật, rule/quyền/trạng thái đúng SRS và ca liên nhóm được kiểm. Có endpoint, test unit xanh hoặc màn mock chạy là các bằng chứng riêng, không thay thế nhau.
