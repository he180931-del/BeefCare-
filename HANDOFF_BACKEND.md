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
- Chuẩn chung cho lệnh là idempotency key, observed version khi cập nhật, giao dịch, audit/revision/outbox. Một số command finance mới chưa nối idempotency; phải hoàn thiện trước khi FE tự retry. Không để raw entity CRUD thay thế luồng nghiệp vụ.
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
| FE07/14/15/23 | Thông báo theo người nhận; inbox; nguồn nhắc REM01–13 và job; dashboard/RPT01–07; nhập kho/giá bình quân/điều chỉnh/khẩu phần/cho ăn/sửa/hủy | Độ đúng các báo cáo/job còn cần kiểm thử sâu. FEFO chỉ có schema/entity, **chưa nối vào lệnh kho**; tệp đính kèm phiếu thức ăn chưa có. |
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
3. Hoàn thiện FEFO thật: backfill tồn hiện có theo nguồn, receipt/adjustment/feeding/correction/void cập nhật lot và allocation nhất quán; xử lý hạn dùng, rollback và chống âm kho. Bảng00800 hiện không phải nguồn tính tồn.
4. Test thực tế REM01–13: tham số có hiệu lực, sửa/hủy nguồn, mất quyền, Owner/Manager/Technician, reminder không có cattle, job gửi lặp và chuyển RESOLVED/SUPERSEDED/CANCELLED. Rà chỉ số M09/RPT05/07 bằng bộ dữ liệu tính tay.
5. Hoàn thiện và test finance: command idempotency, nguồn evidence đã claim/đã dùng cho payment, sửa/post/void/replacement, snapshot nhất quán/as-of/filter, expiry/cleanup, nội dung XLSX. Thêm test cạnh tranh duplicate webhook/manual lookup/reconciliation và đổi cấu hình môi trường.
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

