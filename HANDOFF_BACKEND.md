# BeefCare backend handoff 28 October 2026

## Trạng thái và yêu cầu chủ dự án

Đây là bản bàn giao đang làm, chưa phải backend hoàn chỉnh. Chủ dự án yêu cầu chốt phần đang thực hiện, dừng vì sắp hết quota, push trực tiếp lên `main`, và để thành viên khác dùng agent tiếp tục. `production` dành cho sản phẩm cuối, không thay đổi nhánh đó. Ước lượng gần nhất là khoảng 60% cho mốc review lần đầu; đó không phải tỷ lệ UC đã nghiệm thu.

Nhánh làm việc bắt đầu từ `dev` tại `ef3ba97f2a91797f6b67f1f6432c73dcee020275`. `main` cũ là tổ tiên của nhánh này. Giữ phần FE04/06/13 do nhóm đã viết, chuyển framework và bổ sung các nhóm chức năng còn lại. Đừng reset hoặc viết lại toàn bộ vì thấy nhiều file generated.

## Đọc trước khi tiếp tục

1. `docs/requirements/SRS_2026-10-28.txt`: trích đầy đủ Word, gồm UC, trường màn hình, ma trận quyền, trạng thái, GBR và mã thông báo.
2. `docs/requirements/BeefCare_Conceptual_ERD.drawio`: 10 trang, tổng quan và 9 nhóm nghiệp vụ. ERD là mức khái niệm; bảng dòng chi tiết, lịch sử và phiên bản nằm trong mô tả entity của SRS.
3. `docs/requirements/DB_V2_Delta_2026-10-28.md`: hướng dẫn thay đổi DB, không chạy nguyên SQL/JDL lên schema hiện tại.
4. `docs/REQUIREMENT_DECISIONS.md`, `docs/implementation/*.md`: quyết định và các phần chưa hoàn thiện theo nhóm.
5. `docs/api/README.md`, `docs/api/openapi.json`: cách FE đăng nhập/gọi lệnh và schema API. Regenerate sau khi thay DTO/route.
6. `docs/TEAM_REVIEW.md`: đề xuất chia review/test cho 4 người.

File Word được cung cấp còn “[Figure to be inserted]” tại các vị trí sơ đồ BeefCare. Các ảnh TalentHub lưu sót trong gói Word không phải yêu cầu BeefCare. Đã đọc bảng mô tả BF01–09, chuyển trạng thái, UC và đối chiếu ERD riêng. Nếu nhóm có bản Word chứa hình đã chèn, đối chiếu bản đó thêm.

## Các quyết định cần giữ

- Java21, Spring Boot3.5.3, JHipster8.11, PostgreSQL16, Liquibase. Boot4 cũ đã được chuyển; chưa làm đợt cập nhật bản vá thư viện riêng.
- ID `Long/bigint` theo codebase; không đổi sang UUID của bộ DB V1 khác.
- SRS TableIII6 có 9 thức ăn TA01–09, còn Delta ghi 6. Bootstrap theo SRS: 9 thức ăn, mã tiếp theo TA10; tồn ban đầu bằng 0.
- Session cookie HttpOnly + CSRF cho trình duyệt. Không dùng JWT bearer/localStorage cho đăng nhập. `/api/csrf` trước login/lệnh, `/api/authenticate` trả204; logout POST.
- Một tài khoản toàn cục, một vai trò trong mỗi trại, tối đa một vai trò nhân viên nền tảng. Kiểm tra lại account/membership/service mỗi request và quyền khi replay lệnh.
- Owner không ghi sự kiện chăm sóc, sinh sản hay cho ăn; Manager thực hiện. Technician đọc theo phạm vi SRS. Chỉ Owner quyết định xuất đàn; chết/mất từ ca bệnh tạo đề nghị PENDING.
- Chuẩn chung cho lệnh là idempotency key, observed version khi cập nhật, giao dịch, audit/revision/outbox. Các command finance FE-21 đã nối idempotency (phiên 28/10 tối). Không để raw entity CRUD thay thế luồng nghiệp vụ.
- Các lịch sử sửa/hủy được giữ, trạng thái suy ra từ nguồn VALID. Xem một nhắc việc không tự hoàn tất nhắc việc hoặc thực hiện chăm sóc.
- Provider email/SePay chạy mock/local trước; bí mật nằm ngoài Git. Có tài khoản thật vẫn cần kiểm thử tích hợp thực tế; chưa xác nhận live.
- JVM nội bộ dùng UTC, ngày nghiệp vụ dùng múi giờ trại (mặc định Asia/Ho_Chi_Minh). PostgreSQL local không nhận alias Asia/Saigon từ Windows, nên main đặt UTC trước khởi tạo Spring.

## Những phần đã có source

| Nhóm | Phạm vi hiện tại | Lưu ý |
|---|---|---|
| Nền tảng | Boot3/session/CSRF, quyền trại và platform, durable idempotency, version, audit/revision/outbox, lưu ảnh | Các controller generated chưa hoàn thiện bị chặn; còn cần rà các route mới và các replay sau thu hồi quyền. |
| FE01–03 | Đăng ký/xác minh/reset/change password, Google OIDC tùy cấu hình, Owner profile, đăng ký trại/danh mục mặc định, lời mời/thành viên, SA quản trị tài khoản/platform access, PM đình chỉ/khôi phục trại | Nhiều nhánh auth/account/invitation chưa được chạy đầy đủ; profile permission summary còn thiếu. |
| FE04–06/08/13/16 | Chuồng, phiếu nhập/xuất/thanh toán đối tác từ dev; hồ sơ/QR/ảnh, tăng trưởng/BCS, timeline và sửa/hủy | Test cũ của dev không chứng minh các tích hợp mới đúng. Cần chạy lại các luồng nhiều dòng/rollback/concurrent và DTO mới. |
| FE09–12/18 care | Tiêm theo lịch/batch/hoãn/sửa/hủy; ca bệnh/điều trị/correction; động dục/phối/check/thai/đẻ/bê; worklist/history; tham số và vaccine/medicine catalogue | Xem care-reproduction.md cho các nhánh còn thiếu. Đã sửa các khoảng SCR56 và một số trạng thái sai; chưa nghiệm thu toàn bộ phụ thuộc sửa/hủy. |
| FE07/14/15/23 | Thông báo theo người nhận; inbox; nguồn nhắc REM01–13 và job; dashboard/RPT01–07; nhập kho/giá bình quân/điều chỉnh/khẩu phần/cho ăn/sửa/hủy | Độ đúng các báo cáo/job còn cần kiểm thử sâu. Không làm FEFO theo SRS (quyết định D04); phiếu điều chỉnh kho ĐCK đã có chứng từ DRAFT→POSTED; tệp đính kèm phiếu thức ăn chưa có. |
| FE17/19/21/22 | Audit platform; bảng giá phiên bản, payment quote/snapshot, SePay HMAC và simulator, evidence/đối soát/lookup, expiry jobs, finance source/snapshot/XLSX, public landing/prices | Finance là source mới, còn thiếu kiểm thử và một số điều kiện/command idempotency; nội dung public hiện static. Không coi là chức năng đã nghiệm thu. |
| FE20 | Owner ticket, CS queue/claim/handover/release/reply/note, resolution version/ack/reopen/close, internal PM/SA request/context/result và requeue | Có 7 ca test tích hợp luồng. Cần thêm kiểm thử REST/CSRF/replay, tiêu chí domain-result và các biên trạng thái. |

## Mốc xác minh

Bộ kiểm tra chốt: **79/79 test backend chọn lọc qua**, không failure/error/skipped; bộ gọi API frontend **4/4 qua**. OpenAPI mới có **196 paths / 270 schemas**. Bao gồm H2 integration, permission, idempotency, support, care state, kho, payment và export contract; chưa phải full-suite hoặc end-to-end toàn bộ backend. Lệnh tái hiện và giới hạn nằm cuối file.

PostgreSQL local đã áp dụng164 changeSet trước khi thêm00150 finance,00800 FEFO scaffold và00900 mở rộng audit action. Lỗi Boot4 naming strategy, cấu hình local-seed và timezone đã sửa. Các trường String `@Lob` trông đợi OID trong khi DB là TEXT đã đổi sang JDBC LONGVARCHAR; `Reminder.parameterSnapshot` cũng dùng TEXT. Lần chốt Docker Desktop lại không khởi động vì socket Inference manager, vì vậy **chưa xác nhận khởi động PostgreSQL cuối cùng**. Không xóa volume hoặc clear checksum để bỏ qua lỗi.

Tất cả changeSet đã áp dụng phải giữ nguyên nội dung. Khi cần chỉnh schema, tạo changeSet mới; không clear checksum/drop DB để che lỗi. Guard trước migration legacy00002 chủ động HALT nếu các bảng cũ chưa migrate có dữ liệu, tránh mất dữ liệu nhóm.

## Chạy local

Chạy từ thư mục gốc repo:

```powershell
Copy-Item .env.example .env
# Thay password và link secret bằng giá trị local, không commit .env.
docker compose -f compose.backend.yml up -d --wait
cd backend
mvn --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dspring-boot.run.profiles=dev,local' spring-boot:run
```

DB: localhost:15432, database/user beefcare. Backend: localhost:8080. Mailpit UI: localhost:8025; SMTP: localhost:1025. Frontend cho phép localhost:5173/3000 qua cấu hình CORS. Dùng cùng hostname khi kiểm tra cookie.

Local seed có owner@beefcare.local, manager@beefcare.local, technician@beefcare.local, other-owner@beefcare.local, cs@beefcare.local, pm@beefcare.local, sa@beefcare.local. Mật khẩu lấy từ BEEFCARE_DEV_PASSWORD trong `.env`, không ghi vào tài liệu. Seed chỉ profile local, không tạo tài khoản thật trên production. Trại A/B cố tình khác Owner để thử cách ly tenant.

SePay local simulator chỉ dev/local/test và PM, dùng tài khoản giả MOCK-ACCOUNT khi chưa cấu hình tài khoản nhận; không chuyển tiền thật. Xem `docs/INTEGRATIONS.md` cho biến môi trường, URL tài liệu chính thức và giới hạn hiện tại. Google đăng nhập tắt mặc định và cần client credentials server-side.

Không chạy nhiều Maven cùng một `target` khi dùng nhiều agent. Trên đường dẫn Windows có Unicode, JaCoCo từng làm JVM fork crash; `-Djacoco.skip=true` tắt coverage, **không bỏ chạy test**. `-Pdev,!webapp` tránh Maven kéo và build JHipster webapp cũ. Nếu chạy Java trực tiếp tại đây, dùng classpath tương đối `target/classes`, tránh lỗi mã hóa đường dẫn có dấu.

## Thứ tự agent tiếp theo nên làm

1. Đọc kết quả chốt dưới đây và chạy lại build/test trên đúng commit đã pull. Phân biệt test lỗi do nghiệp vụ, fixture lỗi và generated CRUD tests đã lỗi thời. Không tắt/bỏ assertion chỉ để xanh.
2. Rà traceability UC → command → quyền → trạng thái → migration → mã thông báo → test, tập trung các phần được đánh dấu partial/unverified trong ba file workstream. Các endpoint/report scaffold không tự được tính hoàn thành.
3. ~~FEFO~~: **bỏ theo SRS** (D04 trong docs/REQUIREMENT_DECISIONS.md, chủ dự án xác nhận 28/10). Lô chỉ để cảnh báo hạn dùng; bảng 00800 giữ nguyên, không dùng. Còn lại cho FE-23: tệp đính kèm phiếu nhập/điều chỉnh, test tích hợp nhập/hủy/cho ăn/sửa trên H2.
4. Test thực tế REM01–13: tham số có hiệu lực, sửa/hủy nguồn, mất quyền, Owner/Manager/Technician, reminder không có cattle, job gửi lặp và chuyển RESOLVED/SUPERSEDED/CANCELLED. Rà chỉ số M09/RPT05/07 bằng bộ dữ liệu tính tay.
5. Finance: **đã xong** command idempotency và 12 test luồng (PlatformFinanceWorkflowTest). Còn: nguồn evidence đã claim/đã dùng cho payment, sửa/post/void/replacement, snapshot nhất quán/as-of/filter, expiry/cleanup, nội dung XLSX. Thêm test cạnh tranh duplicate webhook/manual lookup/reconciliation và đổi cấu hình môi trường.
6. Hoàn thiện các trường/nhánh đọc và correction/dependency care/reproduction, kèm test cấm Owner/Technician ghi và lỗi khác trại. Rà historical unknown, calf pending/registered và exit-pending.
7. Chạy auth/session/email/invitation cả REST và Mailpit; Google/SMTP/SePay live chỉ khi có cấu hình thật. FE prototype vẫn dùng phần lớn mock localStorage: nối từng màn hình qua adapter đúng DTO, không thực hiện giao dịch nghiệp vụ phía client.
8. Regenerate `docs/api/openapi.json` qua OpenApiContractTest, cập nhật tài liệu chạy/giới hạn, rồi review chéo với nhóm theo TEAM_REVIEW.md. Chỉ khi đủ điều kiện mới tính là sản phẩm cuối.

## Kết quả chốt bản bàn giao

Các chỉnh sửa cuối chỉ xử lý lỗi chặn kiểm tra: SePay lookup tạo đúng HTTP transport đã cấu hình, snapshot người nhận lọc ACTIVE, fixture kho phản ánh dòng vừa lưu, và audit action hỗ trợ tên lệnh sinh sản dài bằng migration00900 mới. Không thay nội dung migration đã áp dụng. Đã dừng mở rộng feature theo yêu cầu chủ dự án.

Lệnh kiểm tra backend (chạy tại `backend`, không yêu cầu Docker):

```powershell
mvn --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dtest=SupportTicketWorkflowTest,FarmWorkspaceServiceTest,FarmAccessServiceTest,IdempotencyCommandServiceTest,LiquibaseDropSafetyGuardTest,NotificationTargetAccessServiceTest,HerdCatalogueCommandServiceTest,GrowthAssessmentServiceTest,CattleProfilePolicyTest,OpenApiContractTest,SePayPaymentFlowTest,SePaySignatureVerifierTest,CattleStateServiceIT,FarmAnnouncementServiceTest,FarmMembershipServiceTest,FeedManagementServiceTest,FarmReportServiceTest,PlatformAccountAdministrationServiceTest,GoogleIdentityServiceTest,ActionLinkSignerTest,MockEmailDeliveryTest' test
```

Frontend adapter: chạy `node --test src/api/backendClient.test.js` tại `frontend`: **4/4 qua**. Kết quả backend cuối và số API được ghi ngay dưới đây. Không suy ra full backend hoàn thành từ một bản build hoặc một nhóm test xanh.

Không commit `.env`, secret local, output build hay log runtime. Chỉ bàn giao source, tài liệu, schema contract và test. Cấu hình thật của Google/SMTP/SePay và kiểm thử nhà cung cấp live vẫn chưa có.

## Prompt cho agent tiếp theo

Đọc toàn bộ HANDOFF_BACKEND.md, docs/REQUIREMENT_DECISIONS.md, các file docs/implementation và nguồn SRS/ERD trong docs/requirements trước khi sửa. Đây là bản backend đang làm, chưa hoàn tất. Chạy lại bộ kiểm tra ghi trong handoff; xác minh PostgreSQL migration và khởi động sau khi Docker hoạt động. Ưu tiên hoàn thiện các giới hạn đã liệt kê, đối chiếu từng UC và quyền với tài liệu, giữ lịch sử và dữ liệu. Không đổi ID sang UUID, không reset DB, không sửa changeSet đã áp dụng, không dùng entity CRUD thay command. Khi đổi API phải cập nhật DTO/test và regenerate docs/api/openapi.json. Frontend còn dùng mock, xem adapter trước khi nối màn hình. Báo cáo rõ đã kiểm chứng và chưa kiểm chứng. Chỉ push khi thành viên phụ trách yêu cầu; không thay đổi production.

Kết quả cuối ngày 28/10/2026 lúc 20:27 (Asia/Ho_Chi_Minh): **79/79 test backend chọn lọc qua, 0 failure, 0 error, 0 skipped; BUILD SUCCESS**. H2 ở chế độ PostgreSQL, không phải kiểm thử PostgreSQL thật. OpenAPI regenerate từ cùng source: **196 paths / 270 schemas**, lưu docs/api/openapi.json. Frontend adapter **4/4 qua**. Chưa chạy full-suite generated, chưa kiểm thử end-to-end toàn bộ, chưa xác minh PostgreSQL cuối vì Docker socket, chưa kiểm thử provider live.

## Phiên tiếp nối 28/10/2026 tối (Opus 5.5 + Sonnet 5.5)

Chạy lại bộ test gốc trên máy Windows khác: 79/79 qua. Máy này chỉ có JDK 17, nên đã dùng Temurin 21 portable (`C:\Users\tkc25\.jdks\jdk-21.0.12.1+1`, đặt `JAVA_HOME` trong từng lệnh) và chạy `.\mvnw.cmd` thay cho `mvn`. Lưu ý: extension Java của VS Code cũng biên dịch vào `backend/target`; nếu Maven báo "Unresolved compilation problems" thì đó là lỗi biên dịch thật trong source, không phải lỗi Maven.

Thay đổi:

- **Lỗi `save()` với entity `@Version Integer version=0`.** Spring Data coi entity mới là đã tồn tại, nên `save` gọi `merge` và trả về bản sao. Code dùng tiếp object gốc (lúc này id null, vẫn transient). Đã sửa bằng cách gán lại kết quả `save` tại: tạo phiếu nhập thức ăn (trước đây lỗi trên DB thật), ghi cho ăn, nháp thông báo, gửi lời mời thành viên (trước đây ký token với id null và lưu thêm bản ghi thứ hai), chấp nhận lời mời. Test mới `FarmMembershipServiceTest.invitedPersonAccepts...` fail khi bỏ phần sửa và pass khi có. **Khi tạo entity mới có `version=0`, luôn dùng giá trị trả về của `save`.**
- FE-23:
  - Phiếu điều chỉnh kho theo SRS: entity, migration `20261029001000`, `FeedStockAdjustmentService`, API `/feed/adjustments` (list/get/create/draft/post). Route POST cũ ghi movement trực tiếp đã được thay.
  - Mã phiếu PNK/ĐCK theo sequence năm (BR-D34).
  - Mã lỗi MSG-FE23-03/05/08 và MSG-COM-08 theo SRS.
  - Test cho "Lot near expiry".
- FE-21 (Sonnet 5.5): idempotency cho create/update/discard/post/void/replacement/report; MSG-FE21-09/10; snapshot 30 ngày; kiểm tra nguồn ngân hàng trước khi lưu. Các điểm SRS còn mơ hồ ghi trong docs/implementation/platform.md: chiều liên kết replacement, sao chép nguồn ngân hàng khi tạo replacement, nhiều replacement cho một bản ghi, kỳ báo cáo trong tương lai, vai trò trong audit, trạng thái DISCARDED.

Kết quả: **104/104 test qua** (bộ 21 lớp ở trên, cộng `PlatformFinanceWorkflowTest` và `FeedStockAdjustmentServiceIT`), BUILD SUCCESS, chỉ H2. Adapter frontend 4/4 qua. OpenAPI: **199 paths / 272 schemas** (copy từ `backend/target/beefcare-openapi.json`). Chưa xác minh trên PostgreSQL, gồm migration 00150 và 20261029001000. Các race giữa nhiều transaction chưa test.

Lệnh test hiện tại: thêm `,PlatformFinanceWorkflowTest,FeedStockAdjustmentServiceIT` vào `-Dtest=` ở trên.


## Phiên 29/10/2026 (Opus 5.5, nhánh `backend-completion`)

Làm trên nhánh `backend-completion` tách từ `main` tại `2623696`; chưa commit/push, chờ thành viên phụ trách review.

### Kết quả kiểm chứng

- **577/577 test H2/unit qua** (108 lớp: mọi lớp `*Test`/`*IT` không mang `@IntegrationTest`), BUILD SUCCESS. 46 lớp `@IntegrationTest` do JHipster sinh (Testcontainers, CRUD đã khóa `denyAll`) không chạy, như trước.
- **PostgreSQL 16 thật (Docker, DB mới):** áp dụng đủ **171 changeSet**, 85 bảng, khởi động thành công. Smoke HTTP **73/73** qua: đăng nhập 7 vai trò seed, chuồng, phiếu nhập nháp → ghi sổ, bò/timeline/QR, Manager cân (Owner bị chặn), Technician chỉ đọc, Owner trại khác bị chặn, dashboard/báo cáo, ticket, màn PM/SA, các route mới, logout. JOB-02 và JOB-08 chạy trên PostgreSQL với dữ liệu thật (lời mời quá hạn → EXPIRED + audit; link hết hạn 8 ngày bị xóa); JOB-05 và nhắc yêu cầu nội bộ chạy không lỗi.
- Frontend adapter 4/4 qua; **chưa màn hình nào import adapter** (FE vẫn mock).
- OpenAPI regenerate: **212 paths / 284 schemas** (thêm 9 path, không bỏ path nào).

### Đã sửa

- 120 test đỏ của FE04/05/06/13 (chuồng, phiếu nhập/xuất, thanh toán phiếu, đối tác) và `NotificationServiceTest`. Không có lỗi nghiệp vụ: test cũ không gửi version (BR-D31), kỳ vọng trại EXPIRED vẫn đọc được (sai GBR-14, xem D11), JSON sai, ép kiểu sai, assertion sai. `HerdEntryPostRollbackTest` trước đây "qua" mà không thử rollback (lệnh bị chặn vì thiếu version); nay thử đúng. Helper `versionOf(...)` trong `DomainTestSupport`.
- Seeder local không bật `passwordLoginEnabled` → mọi tài khoản demo không đăng nhập được trên DB thật (H2 không bắt được vì không chạy seeder).
- D05: tài khoản chỉ dùng Google đăng nhập bằng mật khẩu trả 401 như sai mật khẩu. D06: email khuyên đăng nhập Google cho UC-FE01-05 AF1.
- `MSG-FE21-12` cho snapshot báo cáo hết hạn (trước là 410 không mã).
- Cron gửi mail trong test (`application-testh2.yml`) đặt rất dài: tác vụ theo lịch từng tranh job với test (`EmailActivationFlowIT` chập chờn).

### Đã bổ sung

| Hạng mục | Mã nguồn | Test |
|---|---|---|
| JOB-02 mỗi 15 phút, từng lời mời + audit `INVITE_EXPIRED` | `FarmMembershipService.expirePendingInvitations` | `PlatformJobsIT` |
| JOB-05 thông báo gia hạn (trong app + email) | `payment/SubscriptionNoticeJob`, template `SUBSCRIPTION_NOTICE` | `PlatformJobsIT` |
| JOB-06 bước 4 / UC-FE14-04 thông báo đối soát cho PM | `payment/ReconciliationNoticeService` | `SePayPaymentFlowTest` |
| JOB-07 bước 4 nhắc yêu cầu nội bộ mở 4 giờ | `InternalSupportRequestService.remindLongOpenRequests`, `SupportMaintenanceJob` | chưa có test riêng |
| JOB-08 dọn token/link/snapshot theo lô 5.000 | `DataRetentionJob` | `PlatformJobsIT` |
| UC-FE19-04 SCR-61, UC-FE19-05 bộ lọc + tiles, UC-FE21-01 SCR-70 | `payment/PlatformSubscriptionQueryService`, `PlatformSubscriptionResource`, `PlatformPaymentResource` | `SePayPaymentFlowTest` |
| UC-FE01-04 bảng quyền theo vai trò trong profile | `AccountResource.permissionsOf` | smoke PostgreSQL |
| UC-FE01-06 AF1/AF2 xác thực lại Google 5 phút | `security/GoogleReauthentication`, `GoogleOidcSuccessHandler`, `IdentityService.changePassword` | `GoogleReauthenticationIT` |
| SCR-48 "Getting started" | `FarmOnboardingService`, `FarmDashboardResource` | `FarmOnboardingServiceIT` |
| Kiểm thử FE-09/10/18 (ca bệnh, điều trị, rút ngưng thịt, đọc ca bệnh, tiêm/hoãn/hủy/dừng lịch, xóa vaccine chưa dùng) | — | `CareWorkflowIT` |
| Kiểm thử FE-11/12 (phối ≠ mang thai, MSG-FE12-02, đẻ → bê nháp, vai trò) | — | `ReproductionWorkflowIT` |
| Kiểm thử RPT-01 (số tính tay), RPT-02/03/04/06, giới hạn 24 tháng; FE-17 audit SA + allowlist | — | `ReportsAndAuditIT` |
| Kiểm thử REM-08 (tuổi chuyển giai đoạn, không gợi ý khi ngày sinh UNKNOWN), REM-12 | — | `ReminderReconciliationIT` |

### Còn lại (chưa làm hoặc chưa kiểm chứng)

1. **Frontend chưa nối backend**: đây là việc lớn nhất còn lại để có sản phẩm chạy được.
2. Kiểm thử chưa có: REM-11 (cho ăn chưa ghi), JOB-07 bước 4, RPT-03/04/06 bằng số tính tay (hiện chỉ chạy được và đúng quyền), nội dung XLSX, race nhiều transaction (webhook trùng, cùng idempotency key), các nhánh sửa/hủy phụ thuộc của sinh sản (sửa/hủy đẻ, bê), FE22 quản trị nội dung landing (nội dung vẫn tĩnh).
3. Outbox: sự kiện được ghi nhưng **chưa có handler nào**; thông báo trong app và email hiện tạo trực tiếp trong giao dịch. Cần quyết định có giữ outbox (thêm handler) hay bỏ ghi sự kiện không dùng.
4. Provider thật (Google OIDC, SMTP, SePay LIVE) chưa cấu hình/kiểm thử. Mailpit/MOCK vẫn là adapter local.
5. Các mục mơ hồ cần chủ dự án xác nhận: D08, D09, D10 trong `docs/REQUIREMENT_DECISIONS.md` và các điểm FE-21 ghi trong `docs/implementation/platform.md`.

### Chạy lại

- Test: tạo danh sách lớp không mang `@IntegrationTest` rồi chạy `mvn --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dcheckstyle.skip=true' '-Dsurefire.failIfNoSpecifiedTests=false' -Dtest=<danh sách> test` tại `backend`.
- PostgreSQL: như phần "Chạy local". Trên máy có tiến trình khác giữ cổng 8080, thêm `'-Dspring-boot.run.arguments=--server.port=8090'` và đặt `BEEFCARE_BACKEND_URL`. Biểu thức cron có dấu cách phải truyền qua biến môi trường (ví dụ `BEEFCARE_JOBS_RETENTION_CRON`), không qua `spring-boot.run.arguments`. `-Dliquibase.analytics.enabled=false` tắt gửi analytics của Liquibase.
