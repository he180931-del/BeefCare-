# UC-FE19-02 — tạo / mở lại yêu cầu thanh toán

## Scope và audit trước triển khai

- Chủ feature DucNV, Codex trực tiếp (một writer). Checkout `D:/Project/BeefCare-`, nhánh `feat/fe19-uc01-xem-goi-dich-vu`, SHA gốc `9db5834e2c14602edae611199ad2700502d8516c`, ban đầu sạch. Không tạo worktree: ref `LamKD` không tồn tại, `.worktrees` chưa ignore. Không đổi Git/base/commit/push.
- Trạng thái BE_REVIEWED trong workspace, chưa READY_FOR_FE. Người dùng chốt ngày 09/11/2026: backend + SCR-58/SCR-59; bước nhận giao dịch có thể hoàn thành trước xác nhận kể cả sai số tiền; tự tải mỗi 5 giây khi PENDING, dừng khi PAID/EXPIRED/rời màn; giữ Kiểm tra lại.
- Ngoài scope: danh sách/lọc UC-03, UI PM/đối soát UC-06, công bố giá UC-07, thay kiến trúc webhook/job UC-08. Chỉ bổ sung mốc dữ liệu trong shared confirmation để SCR-59 có nguồn thật; không bật provider LIVE.
- Router → ARCHITECTURE.md, API_RULES.md, VERIFICATION.md; backend/AGENTS.md và operations FE-19 trong api-handoff.html/backend-workflow.html đã đọc.
- Nguồn: REQUIREMENT_DECISIONS D12/D14 và quyết định phiên này; SRS 28/10 Part I §3.2 H (Subscription, Payment Request/Purchased Period, Bank Transfer Evidence), BR-D23/24/25; Part II §15.1 UC-FE19-02 main/AF1..5/E1..6; Part III §19.1.2 SCR-58/§19.1.3 SCR-59; API-01; GBR-07/09/15/69..73/75/86/88. Spec FE-19 §3..8, TC-19-01..06/27/28/31.
- Trace: SubscriptionPaymentResource.Request → SubscriptionPaymentService.requestPayment/paymentDetails/toDto → Payment/Subscription/PlanVersion/BankTransferEvidence/repositories/migration; SePayWebhookService.process/confirm → frontend types/subscriptionApi → FirstSubscriptionPage/RenewPage/TransferPage/TransferParts/StateDialog.
- OpenAPI POST hiện chỉ nhận durationYears, chưa có reviewed price/key, DTO chưa có mốc tiến trình; frontend create backend đang chặn và QR demo. Đây là thiếu triển khai, sẽ bổ sung contract theo SRS.
- VIEW/MANAGE_FARM_INFORMATION giới hạn Owner nhưng vẫn cho SUSPENDED vì phục vụ FE-02: thanh toán phải chặn tạo mới riêng. Chi tiết kiểm Owner hiện tại + farm, không dùng requestedBy thay quyền sở hữu.

## Ma trận trường

Tất cả thuộc một yêu cầu thanh toán của một trại; không có dòng bò/voucher.

| Tên chính xác | Kiểu / đơn vị / giá trị | Required / điều kiện / mặc định | Nguồn và đường lưu |
|---|---|---|---|
| path.farmId | Long >0 | Required, không default | Owner hiện tại; Payment.subscription.farm |
| header.Idempotency-Key | string 1..128 | Required POST; retry cùng ý định giữ key/body | GBR-88; IdempotencyRecord cùng transaction |
| durationYears | integer 1/2/3 năm | Required, UI không chọn sẵn | SCR-58 #2; Payment.durationYears |
| reviewedPriceVersion | Long >0 | Required POST; khớp giá hiệu lực khi tạo mới | GBR-70; FE expectedPriceVersionId → payload adapter → Payment.priceVersion |
| id / quoteRef | Long / string unique | Backend cấp, luôn có; code là nội dung CK | Payment.id/quoteRef; backend route dùng id |
| amountVnd | whole VND 1.000..1.000.000.000 | Backend tính từ giá/kỳ hạn; không nhận amount FE | BR-D25; Payment.amountVnd snapshot |
| priceVersionId | Long | Luôn có, bất biến | Payment.priceVersion.id |
| bankCode/accountNumber/accountName | strings | Đủ trước tạo mới; legacy null; không default TK mẫu | UC-02 PRE-2/E4; Payment.receivingBankCode/receivingAccount/receivingAccountName |
| receivingEnvironment/receivingAccountNamespace | strings server | Required khi tạo; không cho FE sửa/không hiện UI | Snapshot Payment, so chứng từ |
| requestedAt/expiresAt | Instant | Luôn có; expiresAt=requestedAt+24h | Payment; clock backend |
| state | PENDING/PAID/EXPIRED | Luôn có; GET suy EXPIRED khi now>=expiry dù job chưa chạy | GBR-70/72; Payment.state; GET không cấp kỳ |
| qrImageUrl | URL/null | Sinh từ snapshot API-01; chỉ hiện PENDING chưa hết giờ; lỗi ảnh giữ chữ | Không persist dữ liệu trùng |
| reopened | boolean | true cho POST mở lại; false tạo mới/GET | UC-02 AF1; kết quả command, không persist |
| bankPaidAt | Instant/null | Có chứng từ; PAID dùng chứng từ đã phân bổ | BankTransferEvidence.bankPaidAt |
| receivedAt | Instant/null | Lần đầu nhận chứng từ đã xác thực, IN, đúng env/namespace/TK/mã; không buộc đúng tiền | Quyết định người dùng; BankTransferEvidence.firstReceivedAt mới; không phân bổ chỉ để hiển thị |
| confirmedAt/confirmationSource | Instant/null; SEPAY/PM/null | Chỉ PAID, giờ xác nhận thật; legacy null | Payment fields mới; shared confirm ghi transaction |
| purchasedStart/purchasedEnd/receiptCode | Instant/null / string/null | Chỉ sau xác nhận, UC2 không cấp kỳ | GBR-72/73; Payment hiện có |
| SCR-58 farmName/serviceStatus/currentPeriod | string/enum/period-null | Chỉ đọc A1 của trại; trại mới Chưa có | SCR-58 #1/4; UC-01 |
| SCR-58 terms | bốn mục readonly | Chức năng như nhau; CK một lần/trại; không tự gia hạn; 24h, mỗi mục một lần | SCR-58 #3 |
| SCR-58 estimated period/version effectiveAt | interval/Instant | Chọn kỳ mới có ước tính; version/effectiveAt từ A1 | SCR-58 #5/6; không persist/cấp kỳ từ UI |
| SCR-59 title/countdown/expiry/details/progress | derived | Đủ #1..8; countdown>=0; lỗi refresh giữ kết quả cũ | DTO → adapter → UI; phân biệt giờ NH và giờ nhận |
| SCR-59 actions | navigation | Đóng về nguồn; PAID lần đầu→SCR-48, gia hạn→SCR-57; EXPIRED→tạo mới | SCR-59 #9..11; loại mua suy từ kỳ thật, không chỉ from URL |

Giá đổi trả MSG-FE19-02 với giá/version cũ-mới, không tự tăng giá. Mở lại PENDING trước điều kiện tạo mới, giữ snapshot kể cả giá/TK hiện tại đổi hoặc trại tạm ngưng. Ngoài 90 ngày trả MSG-FE19-03 với confirmedEnd/opensAt; SUSPENDED tạo mới MSG-FE19-09; thiếu giá/TK MSG-FE19-04. Lỗi không để lại Subscription/Payment/audit/key một phần. Timestamp migration nullable, không đoán thời gian dữ liệu cũ.

## Test plan đã được đồng ý

| Kiểm gì | Ở đâu | Vì sao |
|---|---|---|
| POST/GET đủ snapshot cho 1/2/3 năm, reopen, giá đổi, boundary90ngày/24h, config, quyền/trại/CSRF, key/body | SubscriptionPaymentRequestResourceTest H2 + SubscriptionPaymentRequestPostgresIT | Contract + đọc lại DB, không chỉ HTTP200 |
| Lỗi audit rollback; hai transaction tạo đồng thời | SubscriptionPaymentRequestTransactionTest + PostgreSQL subclass | Atomicity/lock thật; không gọi tuần tự để giả concurrency |
| Đúng mã sai tiền, sai account/env/mã, giờ nhận/xác nhận persist, giao lặp/đến muộn | resource tests + SePayPaymentFlowTest hồi quy | Nhận chứng từ không đồng nghĩa PAID |
| Payload/key retry, errors, form→transport→state, route id | frontend/tests/unit/subscription/subscriptionPaymentBackend.test.tsx | Đúng giá đã xem, không demo fallback |
| Poll5s, không chồng, stop PAID/EXPIRED/unmount, bỏ response cũ khi đổi farm/id, lỗi giữ trạng thái, QR/fallback | cùng frontend file | SCR-58/59 đầy đủ và tự cập nhật |

## Bằng chứng và handoff

Finding UC02-ERROR-01 (P1 contract): injected audit failure rollback đúng nhưng fallback exception translator trả generic HTTP500, chưa có code MSG-COM-02 của UC-02 E6. Thêm assertion code vào anAuditFailureRollsBackTheSubscriptionPaymentAndCommandKey trước sửa; chỉ bọc lỗi runtime không phải DomainException ở POST UC2, giữ nguyên code nghiệp vụ/transaction rollback.

Finding UC02-CONTRACT-01 (P1 contract): Swagger 3.1 bỏ nullable=true của bốn mốc mới bankPaidAt/receivedAt/confirmedAt/confirmationSource, dù pending response trả null. Mở rộng regression OpenApiContractTest theo helper nullable hiện có; không đổi null thành thời gian giả trong DTO.

Finding UC02-UI-01 (P2): SCR-58 gia hạn thiếu trạng thái dịch vụ/kỳ hiện tại; CopyButton báo "Đã chép" dù clipboard thất bại. Expected theo SCR-58 #1/SCR-59 #6 là hiện dữ liệu thật và phản hồi sao chép đúng kết quả. Regression: showsServiceStatus/currentPeriod và clipboard reject trong subscriptionPaymentBackend.test.tsx, RED 2 ca trong fe19-uc02-fe-fields-red.log; poll request chậm/đổi route cùng lượt đã PASS. Sửa feature-local, giữ layout đang có.

Finding UC02-TIME-01 (P1): POST tạo lúc t, expiresAt=t+24h nhưng sau flush/clear H2 đọc được requestedAt lệch −7h trên host UTC+7, thành cửa sổ 31h. Nguồn: requested_at được migration 20261028000140 khai báo timestamp with time zone, trong khi testh2 ép preferred_instant_jdbc_type=TIMESTAMP cho mọi field. Regression: createsAllThreeTermsWithImmutableSnapshotsAndDatabaseReadback, RED `expected 24H / actual 31H` trong fe19-uc02-be-green.log. Cần mapping JDBC riêng cho cột có timezone, không đổi giờ/độ dài kỳ hoặc sửa assertion.

- Baseline trước sửa: frontend 51/51 subscription; backend 18/18 (overview 11 + SePay 7), ngày 09/11/2026. RED hợp lệ: 8 frontend, backend 7 failures/1 error vì các field/guard chưa có; lỗi compile helper và H2 context ban đầu đã sửa trước khi lấy RED hành vi.
- Playwright skill đọc tại `.agents/skills/playwright-cli/SKILL.md`; global CLI/references không có, có thể dùng playwright-core hiện cài để runtime smoke, không cài runner/dependency. React/TDD skill paths trong RTK không có trên máy; làm test-first và theo convention repo trực tiếp.
- Runtime sau sửa ghi actual mode/route/checkpoint, 1180x820 và 1440x900; không gọi smoke/quan sát ảnh là automated visual regression/E2E.
- Fresh PostgreSQL và upgrade full schema cũ đã được kiểm riêng; không sửa checksum hoặc DB nhóm.

## Kết quả thực tế ngày 09/11/2026

| Bộ kiểm | Kết quả / bằng chứng |
|---|---|
| H2 + HTTP thực/security chain | 29 PASS, 0 fail/error/skip: SubscriptionPaymentRequestResourceTest 7, ConfigurationTest 1, TransactionTest 2, SubscriptionOverviewResourceTest 11, SePayPaymentFlowTest 7, OpenApiContractTest 1. Lượt H2 trước verify còn chạy trên JVM UTC+7: 28/28 PASS sau sửa requestedAt mapping. |
| PostgreSQL 16.15 | 10 PASS, 0 fail/error/skip: SubscriptionPaymentRequestPostgresIT 7 (assert metadata DB), SubscriptionPaymentTransactionPostgresIT 2 (hai HTTP/transaction độc lập, rollback sau lỗi audit), SubscriptionPaymentMigrationPostgresIT 1 (full schema trước changeSet mới, có legacy payment/evidence). |
| OpenAPI 3.1 sau sửa nullable | OpenApiContractTest 1 PASS; RED tại bankPaidAt rồi GREEN khi thêm bốn field vào nullableFields. Chỉ copy target/beefcare-openapi.json sau GREEN. |
| Frontend subscription | 62/62 PASS (51 cũ + 11 mới): payload/reviewed price, key retry, reopen dùng numeric id, field-completeness, real QR/fallback, clipboard thất bại không báo thành công, poll5s/stop/error/slow request/late response after route change. |
| Frontend API/transport | 102/102 PASS. Lượt đầu phát hiện double type assertion mới trong error adapter; đã bỏ cast thừa, giữ assertion/test. Không đổi JavaScript chạy thực. |
| Typecheck / production build | PASS; TypeScript ứng dụng + test, Vite production. Build còn warning chunk >500kB; không thêm dependency hoặc sửa bundle ngoài scope. |
| Catalog | Python generator đã chạy bằng Python 3.12 có sẵn trong uv (python/py không nằm đúng PATH). 218 paths/267 operations. Browser check filter FE-19 + BE1, POST fields, JSON export/import, HTML export, verified tab 0; không page error. `target/fe19-uc02-catalog-check.json`. |

Lượt verify cuối kết thúc **09/11/2026 10:28:04 UTC (17:28:04 Việt Nam)**, BUILD SUCCESS: 29 Surefire + 10 Failsafe, gồm assertion mới HTTP500/MSG-COM-02 và không còn dữ liệu sau rollback trên cả H2/PostgreSQL. Sau lượt này chỉ refresh tài liệu/OpenAPI/catalog; browser catalog kiểm lại PASS. `git diff --check` sạch; còn cảnh báo Git đổi LF→CRLF của JSON/OPEN_QUESTIONS, không lỗi whitespace.

Log dưới backend/target (ignored): fe19-uc02-baseline.log, fe19-uc02-be-red.log, fe19-uc02-be-green.log, fe19-uc02-verify.log, fe19-uc02-final-verify.log, fe19-uc02-error-red.log, fe19-uc02-contract-red.log/green.log, fe19-uc02-fe-red.log, fe19-uc02-fe-fields-red.log, fe19-uc02-fe-final.log, fe19-uc02-api.log, fe19-uc02-typecheck.log, fe19-uc02-build.log. Reports XML: target/surefire-reports và target/failsafe-reports. Maven 3.9.16/JDK21; PostgreSQL image 16.15; testh2 giữ clock/mail/job config và thay datasource bằng container cho PG.

### Commands

Từ backend (PowerShell):

```powershell
# H2 run: host UTC+7; include real HTTP/DB and independent transaction cases.
mvn.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dtest=SubscriptionPaymentRequestResourceTest,SubscriptionPaymentRequestConfigurationTest,SubscriptionPaymentRequestTransactionTest,SubscriptionOverviewResourceTest,SePayPaymentFlowTest' '-Dlogging.level.root=WARN' '-Dlogging.level.org.springframework=WARN' '-Dlogging.level.org.hibernate.SQL=OFF' test
$env:DOCKER_HOST='npipe:////./pipe/dockerDesktopLinuxEngine'
mvn.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dmodernizer.skip=true' '-Dapi.version=1.44' '-Duser.timezone=UTC' '-Dlogging.level.root=WARN' '-Dlogging.level.org.springframework=WARN' '-Dlogging.level.org.hibernate.SQL=OFF' '-Dtest=SubscriptionPaymentRequestResourceTest,SubscriptionPaymentRequestConfigurationTest,SubscriptionPaymentRequestTransactionTest,SubscriptionOverviewResourceTest,SePayPaymentFlowTest,OpenApiContractTest' '-Dit.test=SubscriptionPaymentRequestPostgresIT,SubscriptionPaymentTransactionPostgresIT,SubscriptionPaymentMigrationPostgresIT' verify
# Final documentation-only regression and fresh export:
mvn.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dtest=OpenApiContractTest' '-Dlogging.level.root=WARN' '-Dlogging.level.org.springframework=WARN' test
```

Spotless/JaCoCo skipped per Windows workflow; Modernizer skipped for verify as documented for this repository. Tests not skipped; Checkstyle 0 violations. Sandbox prevented Maven/Docker cache/network access initially; scoped escalated test execution succeeded. No dependency versions, global settings or user .env changed.

Từ frontend: VITE_BEEFCARE_DATA_SOURCE=local cho fixture suites, `.\node_modules\.bin\vitest.cmd run tests/unit/subscription`; backend-specific tests override transport mode. Separate fresh commands `npm.cmd run test:api`, `npm.cmd run typecheck`, `npm.cmd run build`; production/runtime use backend mode from existing .env, API URL empty/relative. No new runner/scripts/dependency.

## Acceptance mapping

| Điều kiện | Test / nguồn |
|---|---|
| 1/2/3 năm, snapshot đủ, đúng 24h sau DB readback, không cấp kỳ khi tạo | createsAllThreeTermsWithImmutableSnapshotsAndDatabaseReadback; UC-02 POST-1/2, SCR-58/59, GBR-70 |
| Giá đã xem, SUSPENDED, ngoài 90 ngày | staleReviewedPriceAndSuspensionNeverCreateCommercialRows; renewalUsesPersistedCoverageAtTheExactNinetyDayBoundary; TC-19-04/05/06 |
| Reopen giữ nguyên kỳ/giá/expiry và replay/key body khác | replaysOneIntentAndReopensOriginalQuoteDespiteNewPriceTermOrSuspension; TC-19-03/27, GBR-88 |
| Expiry tại boundary, không chờ JOB-03, tạo mới sau expiry | expiryIsImmediateOnReadAndAllowsANewRequestWithoutWaitingForTheJob; TC-19-28 |
| Không thiếu snapshot tài khoản hoặc để lại subscription rỗng | missingBankConfigurationCreatesNothing; UC-02 E4 |
| Owner/current farm/key bắt buộc và replay sau mất quyền | ownershipKeyValidationAndReadAccessAreEnforcedOnEveryRequest; TC-19-01, GBR-07/09 |
| Nhận chứng từ không đồng nghĩa PAID; đúng tiền mới cấp kỳ tại giờ xác nhận | verifiedWrongAmountShowsReceivedButOnlyValidConfirmationGrantsCoverage; D15, GBR-72/73 |
| Atomicity, MSG-COM-02 khi lưu thất bại và concurrency thật | anAuditFailureRollsBackTheSubscriptionPaymentAndCommandKey; twoConcurrentHttpCommandsCommitExactlyOnePendingRequest; UC-02 E6/BR-D23/GBR-86/88 |
| Upgrade không bịa mốc cho legacy | addsUnknownProgressTimesWithoutChangingExistingPaymentOrEvidence |

## Runtime / visual evidence

- Session beefcare-fe19-uc02, Chrome headless/system binary + playwright-core đang có; actual `http://localhost:5173`, backend mode, Vite proxy → 127.0.0.1:8080. Browser dùng cookie login/CSRF thật với seed local; không saved credentials/cookies/profile.
- Backend riêng: H2 memory `uc02-runtime`, profiles dev/local/testh2, SePay MOCK, bank/account/name fixture TESTBANK/MOCK-ACCOUNT/UC02_TEST_ONLY, mail mock. Giá được tạo bằng PM API như fixture trong DB memory. Không dùng/sửa PostgreSQL hay bảng giá của người dùng. H2 runtime phải override hbm2ddl.auto=none và mail.provider=mock vì local profile mặc định validate/SMTP; không sửa file cấu hình để né lỗi. Cả fresh PG và full previous-schema upgrade được chứng minh riêng ở suite PG.
- Flow thật: SCR-58 chọn 1 năm → POST200 → route numeric id SCR-59; giả lập 1.100.000đ cho yêu cầu 1.200.000đ → receivedAt có, vẫn PENDING/confirmedAt null; giả lập đủ tiền → UI tự PAID/có kỳ và Vào trại, không click Kiểm tra lại. Mọi API browser trong flow 2xx, không page error. Một console resource404 là ảnh QR fixture TESTBANK không hợp lệ, fallback chữ giữ đủ 5 mục; không kiểm QR của tài khoản ngân hàng thật.
- Checkpoint tại capture `working-tree-2132927881cc4238`, 17 file production trong manifest; capture 09/11/2026 10:12 UTC. Sau capture đổi OpenAPI null metadata, tài liệu/test, bỏ type assertion thừa (erased JS) và chuẩn hóa lỗi POST500 thành MSG-COM-02. Nhánh lỗi mới được kiểm bằng HTTP + rollback trên H2/PostgreSQL; không đổi layout/luồng thành công đã capture.
- 8 PNG + snapshot tại `backend/target/fe19-uc02-ui/`, manifest.json: SCR-58 chưa chọn; SCR-59 pending/received-not-confirmed/paid, mỗi state ở 1180x820 và 1440x900. Không horizontal overflow; iPad có vertical page scroll bình thường, desktop không vertical overflow ở các state này.
- Đã xem trực tiếp sáu ảnh: SCR-58, received-not-confirmed và paid ở cả hai viewport. Đây là scripted runtime smoke + manual screenshot inspection; không phải automated E2E/visual regression hoặc before/after comparison; chưa có approved baseline mới.
- Browser contexts đóng, không saved auth. Backend H2 tạm đã dừng (DB memory biến mất), temporary runtime log đã sanitize. Testcontainers dùng lifecycle framework, schema upgrade chỉ trong container; Vite tạm dừng khi hoàn tất kiểm chứng.

## Handoff FE và giới hạn

- Contract thực tế: POST `/api/farms/{farmId}/subscription/payments` với `{durationYears, reviewedPriceVersion}` + `Idempotency-Key`; response PaymentDTO. `reopened=true` mời mở lại; route FE dùng numeric `id`, quoteRef chỉ hiển thị/nội dung CK.
- Login/CSRF → GET overview A1 → Owner xem giá/chọn kỳ → POST → GET `/payments/{paymentId}` mỗi 5s khi PENDING. Retry cùng ý định giữ key; server replay trả response đã commit, GET đọc trạng thái mới nhất. PAID và EXPIRED dừng poll; expiry thêm một GET, ẩn QR đúng deadline. Lỗi transient giữ trạng thái cũ; 401/403/404 không fallback demo.
- Mốc mới nullable, legacy không backfill từ bankPaidAt. Nhận giao dịch dựa chứng từ đã xác thực, đúng chiều/env/namespace/TK/mã, chưa cần đúng tiền; đúng tiền và các rule shared confirmation mới PAID. Shared confirm nay ghi giờ xác nhận thật và dùng max(giờ xác nhận, latestEnd) cho start, thay cho giờ NH.
- Catalog chỉ cập nhật review POST + detail GET thuộc lát cắt UC-02. Status `doing`/notes BE_REVIEWED, noBlockers=false vì chưa có approved integrated checkpoint; verified/READY count vẫn 0. Không tự commit/push/merge.
- Danh sách/lọc lịch sử vẫn UC-03 (backend-mode list adapter chưa nối); link lịch sử không được gọi là hoàn thiện UC-03. UC-06/07/08 chưa được review toàn bộ bởi lượt này. SePay LIVE, ngân hàng thật, mail thật và mobile viewport không được kiểm. Local .env hiện thiếu snapshot TK nhận: phải cấu hình hợp lệ trước tạo yêu cầu thực; không thêm fallback mẫu vào production.

## Files changed / ownership cuối

Một writer trong checkout gốc; không branch/worktree mới, không stash/reset/commit/merge. Thay đổi: Payment/BankTransferEvidence; hai repositories; SubscriptionPaymentService/SePayWebhookService; SubscriptionPaymentResource; OpenAPI customization + test; migration mới + master; 6 test UC2/PG/upgrade; frontend types/API/StateDialog/TransferParts/FirstSubscriptionPage/RenewPage/TransferPage, hai hook request/status và test UC2; REQUIREMENT_DECISIONS, FE-19 spec, OPEN_QUESTIONS, OpenAPI/catalog và báo cáo này. Artifact/log/UI scripts dưới target ignored. Dirty cuối là các file thuộc scope trên; không user changes ban đầu hoặc file người dùng bị di chuyển. Next: publish/kiểm approved integrated checkpoint trước READY_FOR_FE; provider LIVE là evidence riêng.

## Sửa sau review của chủ feature (09/11/2026)

DucNV review lại toàn bộ thay đổi UC-02 trước khi commit; không đổi nghiệp vụ hay contract API.

| # | Vấn đề | Sửa |
|---|---|---|
| R1 | Bỏ tài khoản giả nhưng `application.yml` để trống, `.env.example` không có biến `BEEFCARE_SEPAY_*`: mọi máy local tạo yêu cầu đều báo MSG-FE19-04; LOCAL_SETUP.md vẫn ghi dùng tài khoản giả | Giữ backend chặn đúng PRE-2/E4. Thêm 3 giá trị giả vào `.env.example`, cập nhật LOCAL_SETUP.md mục 8; người chạy local chép vào `.env` |
| R2 | Changeset `20261109000100` để `author="codex"`, khác quy ước `beefcare` | Đổi thành `author="beefcare"` trước khi chạy trên DB dùng chung |
| R3 | MSG-FE19-08 hiện trạng thái thô `PENDING` | Dùng nhãn tiếng Việt (`paymentLabel`); test cập nhật, RED rồi GREEN |
| R4 | Bố cục điện thoại mất nút rộng "Sao chép nội dung chuyển khoản" | Giữ nút rộng theo frame 2638:4108, dùng chung logic báo lỗi sao chép; test mới cho điện thoại, RED rồi GREEN |

Kiểm lại sau sửa: backend H2 29/29 (ResourceTest 7, ConfigurationTest 1, TransactionTest 2, SubscriptionOverviewResourceTest 11, SePayPaymentFlowTest 7, OpenApiContractTest 1); frontend `tests/unit/subscription` 63/63; `npm run typecheck` sạch. Chưa chạy lại PostgreSQL IT, build và runtime UI sau các sửa này.
