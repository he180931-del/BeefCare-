# Review FE-19 / UC-FE19-03

## Scope và nguồn

- Người dùng chốt cả bốn đề xuất trong phiên 09/11/2026: backend + SCR-60; tìm một phần mã không phân biệt hoa/thường, mới nhất trước; khoảng ngày tạo gồm trọn hai ngày và cho nhập một đầu; làm mới theo thao tác và khi quay lại từ SCR-59. D16.
- Một writer tại `D:/Project/BeefCare-`, branch `feat/fe19-uc02-tao-yeu-cau-thanh-toan`, base checkout `0627b8045b9bbbda2eb33de549537afb0e711d25`, sạch lúc bắt đầu. Không tạo worktree/branch hoặc di chuyển công việc UC2. Không commit/push/merge.
- Nguồn: REQUIREMENT_DECISIONS D12/D15/D16; spec FE-19 §2–4, SCR-59/60, A3, Q3; SRS 28/10 I.4.2.19, III Table III-1, III.19.1.3–4, GBR-07/09/12/14/70/72/73. Không dùng bản SRS 01/11.
- Trace: SubscriptionPaymentResource → SubscriptionPaymentService.history/paymentDetails/toDto → PaymentRepository → Payment/Subscription/PlanVersion/BankTransferEvidence; frontend types → subscriptionApi → HistoryPage → SCR-59/TransferPage. Chỉ đọc, không có command/payload ghi hoặc thay đổi schema.
- Trạng thái: BE_REVIEWED tại checkout hiện tại; chưa phải READY_FOR_FE của bản tích hợp chung.

## Ma trận trường

Các trường thuộc một yêu cầu thanh toán; không có dòng bò hay giá trị tổng nhiều yêu cầu. Không có trường UI tự nhận là đã lưu.

| Trường | Kiểu / điều kiện / mặc định | Source of truth và round trip |
|---|---|---|
| farmId | Long dương, path bắt buộc; Owner hiện tại, mọi trạng thái dịch vụ | GBR-07/09/12/14; FarmAccessService → subscription.farm; mọi query và detail kiểm tenant |
| q | Text tùy chọn ≤100, trim, contains không phân biệt hoa/thường; mặc định rỗng, ký tự wildcard là chữ thường | D16, Table III-1; form → query → Payment.quoteRef |
| status | Tùy chọn PENDING/PAID/EXPIRED; mặc định tất cả | SCR-60; state hiệu lực tại clock đọc, gồm PENDING đã tới expiresAt thành EXPIRED |
| from / to | LocalDate ISO tùy chọn độc lập; from ≤ to; mặc định không giới hạn | D16; requestedAt trong [đầu ngày from, đầu ngày sau to), Asia/Ho_Chi_Minh; sai khoảng MSG-COM-11 |
| sort / dir / page | requestedAt hoặc expiresAt; asc/desc; page bắt đầu 0; mặc định requestedAt/desc/0 | D16/Table III-1; tie-break id cùng chiều; 20 dòng/trang; thay bộ lọc/sort về trang đầu |
| content / number / size / totalElements / totalPages | PaymentDTO[] / số nguyên; size=20; empty content=[] | BE query đã lọc rồi count/sort/page → API → FE Pagination; không cắt trang trước lọc |
| id / quoteRef | Long / string bắt buộc; id để gọi API, mã để hiển thị/tìm | Payment.id/quoteRef → PaymentDTO → Payment → list/action; snapshot bất biến |
| durationYears / amountVnd / priceVersionId | 1/2/3 năm; VND nguyên; Long bắt buộc | Payment → PlanVersion snapshot; không tính lại theo giá mới |
| requestedAt / expiresAt | Instant bắt buộc; list đến phút theo giờ Việt Nam | Payment timestamp persisted → JSON ISO → fmtDateTime |
| state | PENDING/PAID/EXPIRED bắt buộc; hết hạn ngay tại expiresAt | Payment + clock; GET không ghi lại trạng thái; PAID đến muộn vẫn đọc từ shared confirmation |
| farmName trong chi tiết | String chỉ đọc | A1 SubscriptionOverview của cùng farmId; có loading/error/retry, không thay bằng tên trại demo |
| bankPaidAt / receivedAt / confirmedAt | Instant nullable, hiển thị đến giây; null → “—” | D15; chứng từ được phân bổ / chứng từ hợp lệ nhận đầu / Payment.confirmedAt; không suy mốc này từ mốc khác |
| purchasedStart / purchasedEnd | Nullable; PAID có kỳ đã xác nhận, nửa mở [start,end) | Payment persisted → DTO → chi tiết; PENDING/EXPIRED không tự dựng kỳ đã mua |
| bankCode / accountNumber / accountName / qrImageUrl / receiptCode / confirmationSource / reopened | Giữ nguyên hợp đồng UC2 và null legacy | A2/A3, D15; readPayment giữ snapshot/progress; SCR-59 dùng lại khi Mở lại, SCR-60 không tạo bản ghi mới |

## Findings trước sửa và test dự kiến

| ID | Expected / actual | Test / nơi / mục đích |
|---|---|---|
| UC03-API-01 | API lịch sử chưa có filter/page/sort; còn lọc requestedBy thay vì lịch sử trại của Owner hiện tại | SubscriptionPaymentHistoryResourceTest + PostgreSQL IT: quyền, tenant, đủ lịch sử, bộ lọc, biên ngày/expiry, 20 dòng và DB readback |
| UC03-FE-01 | listPayments backend bị chặn; URL lịch sử dùng quoteRef nhưng detail nhận numeric id | subscriptionHistoryBackend.test.tsx: adapter query/page, giữ dữ liệu thật, numeric-id actions và refresh từ SCR-59 |
| UC03-FE-02 | EXPIRED mở cảnh báo hết hạn, PAID mở modal; SRS yêu cầu panel chi tiết cho cả hai | Cùng test FE + cập nhật assertion demo theo SRS: đủ trường, mốc giây/null, chỉ đọc, lỗi/thử lại |
| UC03-FE-03 | Chưa có phân trang/giữ bộ lọc trong phiên/làm mới | Test FE: 20 dòng, chuyển trang, đổi sort/filter về trang đầu, giữ bộ lọc theo trại khi quay lại, không polling SCR-60 |

Test bổ sung trước production; chạy regression UC1/UC2/SePay vì dùng chung DTO/detail; OpenApiContractTest rồi export/catalog; frontend typecheck/build. PostgreSQL test dùng DB riêng; không sửa DB người dùng. Concurrency/rollback command N/A: UC3 chỉ GET, các command đã có suite hồi quy UC2.

## Baseline / bằng chứng

- Frontend baseline: 63/63 PASS với `VITE_BEEFCARE_DATA_SOURCE=local` cho suite demo; hai suite backend tự mock mode backend. Lần đầu thừa hưởng frontend/.env backend làm 18 demo assertions fail; chỉ override môi trường process để khớp fixture, không sửa .env/assertion cho qua.
- Maven Wrapper Windows lỗi trước Maven; Maven 3.9.16 có sẵn trùng version wrapper được dùng thay. Sandbox không đọc đủ cache; chạy test qua escalation như workflow UC2. Không đổi global settings/dependency hoặc .env.
- Các skill TDD/React ghi trong RTK theo đường dẫn macOS không có bản tương ứng trong inventory Windows đã tìm; áp dụng test-first và component React hiện có. Đã đọc skill playwright-cli tại `.agents/skills/playwright-cli/SKILL.md`; CLI/references không có ở máy, dùng playwright-core đã cài để lấy runtime evidence, không cài runner/browser/package.

## Kết quả thực tế 09/11/2026

| Kiểm chứng | Kết quả |
|---|---|
| RED backend | 8 ca chạy, 7 FAIL vì array cũ/thiếu filter/page/validation, 1 PASS quyền; không error/skipped. Log fe19-uc03-be-red.log. Trước đó sửa lỗi builder fixture và double-encoding URI trong MockMvc; không đổi assertion nghiệp vụ. |
| RED frontend | 6/6 ca đầu FAIL do backendPending, thiếu page/inline detail/numeric route. Log fe19-uc03-fe-red.log. Bổ sung thêm ca idle/no-poll/date validation sau đó; không nhận là RED cho ca đã PASS. |
| H2/security/contract | 36/36 PASS: HistoryResource 8, RequestResource 7, RequestTransaction 2, OverviewResource 11, SePayPaymentFlow 7, OpenApiContract 1. |
| PostgreSQL 16.15 | 17/17 PASS: HistoryPostgresIT 8, RequestPostgresIT 7, PaymentTransactionPostgresIT 2. DB/container riêng, cùng schema thật; không failure/error/skipped. |
| Frontend feature suite | 70/70 PASS: API/demo 16, pages 19, overview backend 16, payment backend 12, history backend 7. Các assertion demo được cập nhật từ array sang content và modal sang inline panel đúng thay đổi contract/SRS; vẫn kiểm cùng dữ liệu/kết quả. |
| Typecheck / production build | PASS; build có cảnh báo bundle >500 kB hiện hữu. Không thay bundle config hoặc thêm dependency. |
| OpenAPI/catalog | OpenApiContractTest PASS rồi copy `target/beefcare-openapi.json` sang docs/api/openapi.json; chạy chính `docs/tools/generate_api_catalog.py` bằng Python 3.12 có sẵn trong uv cache. 218 paths, 267 operations, 86 screens. Không tự đánh dấu API khác đã bàn giao. |

Lệnh backend (tại backend; executable Maven 3.9.16 có sẵn):

```powershell
$env:DOCKER_HOST='npipe:////./pipe/dockerDesktopLinuxEngine'
mvn.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dmodernizer.skip=true' '-Dapi.version=1.44' '-Duser.timezone=UTC' '-Dtest=SubscriptionPaymentHistoryResourceTest,SubscriptionPaymentRequestResourceTest,SubscriptionPaymentRequestTransactionTest,SubscriptionOverviewResourceTest,SePayPaymentFlowTest,OpenApiContractTest' '-Dit.test=SubscriptionPaymentHistoryPostgresIT,SubscriptionPaymentRequestPostgresIT,SubscriptionPaymentTransactionPostgresIT' '-Dlogging.level.root=WARN' '-Dlogging.level.org.hibernate.SQL=OFF' verify
```

Log `backend/target/fe19-uc03-verify.log`: BUILD SUCCESS, 11:23 UTC; Checkstyle 0 violations. Spotless/JaCoCo/Modernizer được skip như lệnh, test không skip. Đây là kiểm bản local, không phải xác nhận main/integration đã triển khai.

Lệnh FE tại frontend: process env `VITE_BEEFCARE_DATA_SOURCE=local` cho fixture demo; `node node_modules/vitest/vitest.mjs run tests/unit/subscription`, `npm.cmd run typecheck`, `npm.cmd run build`. Logs tương ứng: `fe19-uc03-fe-final.log`, `fe19-uc03-typecheck.log`, `fe19-uc03-build.log` trong backend/target. Typecheck cả src và test.

Đọc lại persistence: fixture được flush/clear trước HTTP; list và detail so khớp trường snapshot/giây/null với Payment/PlanVersion thật. Kiểm requester khác Owner, farm SUSPENDED, state PENDING tại expiry không bị ghi thành EXPIRED, trại chưa có Subscription không phát sinh Subscription. Cả 8 ca chạy trên PostgreSQL thật. Không có schema/migration mới: upgrade test N/A; command concurrency/rollback hồi quy bởi 2 ca PostgreSQL UC2, không coi GET là concurrency test.

## Handoff FE

- GET `/api/farms/{farmId}/subscription/payments`: `q?, status?, from?, to?, sort=requestedAt, dir=desc, page=0`; 20 dòng cố định. Response **đổi từ array sang** `{content,number,size,totalElements,totalPages}`. Adapter và SCR-60 đổi cùng lượt; mọi caller listPayments hiện có đã được typecheck/test theo page.content.
- GET `…/payments/{paymentId}` giữ PaymentDTO của UC2; numeric id ở URL/backend, quoteRef hiển thị/tìm/nội dung CK. Owner hiện tại theo farm path; account/membership/role kiểm lại mỗi request. Manager/Technician/ngoài trại/đã mất quyền bị từ chối.
- Đầu vào ghi, Idempotency-Key, version: N/A cho UC3 GET. Mở lại chỉ đọc request cũ; tạo mới vẫn qua UC2. Enum/null/progress giữ D15, snapshot/amount không tính lại theo giá hiện tại.
- Phiên giữ UI filter/sort/page trong sessionStorage theo mode/tài khoản/trại; không lưu DTO/payment hoặc token/session cookie. Khi chuyển trại component được tạo lại theo scope; response chi tiết cũ không xuất hiện dưới id mới.
- Hợp đồng DRAFT/BE_REVIEWED local; chưa có approved integrated checkpoint/URL chung để gắn READY_FOR_FE. Không test SePay LIVE, SMTP thật hoặc Google OIDC. API catalogue refresh không tự xác nhận các UC4–8.
- Ví dụ GET trại rỗng: `200 {"content":[],"number":0,"size":20,"totalElements":0,"totalPages":0}`. Ví dụ query: `?q=BC&status=PAID&from=2026-11-08&to=2026-11-09&sort=expiresAt&dir=asc&page=0`. Sai khoảng: HTTP400 có `code=MSG-COM-11`, `params.field=from`; sai Owner: HTTP403 `MSG-COM-01`; detail không thuộc trại: HTTP404 `MSG-COM-08`. GET không cần Idempotency-Key/CSRF header, phiên đăng nhập cookie vẫn bắt buộc.
- Catalog được mở lại bằng Chrome context mới: 267 operations; tìm path payments ra 3 operations; chi tiết có trường query và PaymentHistoryPage; tab đã kiểm chứng vẫn 0, không nâng nhầm READY. Export JSON, import JSON và export HTML đều PASS, không page error. Artifact `backend/target/fe19-uc03-catalog-check.json`; context đã đóng. Chỉ hai record GET history/detail được cập nhật review theo bằng chứng UC3, detail giữ mapping UC2 + UC3.

## Runtime và giới hạn

- Session `beefcare-fe19-uc03`, `http://127.0.0.1:5173`, frontend mode backend, backend profiles dev/local/testh2, DB H2 memory riêng `uc03-runtime`, SePay MOCK. Cookie/CSRF login bằng HTTP API thật trong browser context; không inject cookie/localStorage hay intercept request. Fixture giá/yêu cầu/giao dịch được tạo qua PM/Owner API chỉ trong DB tạm.
- SHA gốc `0627b8045b9bbbda2eb33de549537afb0e711d25`, checkpoint `working-tree-57e04db738257eed` (hash 6 file production trong manifest), capture 09/11/2026 11:33–11:34 UTC. Source production không đổi sau capture.
- [Manifest](../../backend/target/fe19-uc03-ui/manifest.json) chứa route chính xác, viewport, hash/checkpoint, dữ liệu fixture, expected/observed, snapshot, ảnh và cleanup. Sáu capture: `pending`, `paid-detail`, `filtered-empty`, mỗi trạng thái ở 1180×820 và 1440×900. Đã xem trực tiếp cả sáu PNG; không tràn ngang/dọc ở fixture một dòng này. Phân trang 23 dòng được chứng minh bằng H2/PostgreSQL + FE test, không nhận là đã chụp fixture 23 dòng trên browser.
- Luồng thực: GET lịch sử → tìm mã → Mở lại numeric id trên SCR-59 → Đóng hướng dẫn giữ filter và GET mới → PM giả lập chứng từ IN đúng snapshot → bấm Làm mới → PAID → panel đủ ba mốc/kỳ → lọc rỗng → Xóa bộ lọc. 31 response API gói đều 2xx, không page error. Có một console resource404 (fixture dùng ngân hàng TESTBANK trên SCR-59); chưa thu riêng URL response404 nên không nhận clean-console. SCR-60 và mọi API gói đều hoạt động.
- Đây là scripted Playwright-core runtime smoke + manual image inspection; không phải automated E2E/visual regression. Không có approved screenshot baseline, không nhận before/after comparison. EXPIRED panel, null legacy, date error và no-poll được kiểm bằng FE test; EXPIRED/late confirmation/range/tenant được kiểm qua HTTP + DB.
- Khởi động packaged dev JAR trên Windows gặp lỗi WebConfigurer với đường dẫn `nested:target/classes/static/` sẵn có. Runtime dùng classes đã build + chính thư viện trong JAR + H2 2.3.232 cache; không sửa WebConfigurer, .env hay cấu hình repo. Helper fixture ban đầu dùng sai content-type/thiếu effectiveAt và chạy login trước seeder commit; đã sửa helper theo DTO và đợi ApplicationRunner hoàn tất. UI sign-in riêng không được nhận là kiểm thành công: lần thử không phát POST và timeout; runtime UC3 dùng đăng nhập HTTP cookie/CSRF như mô tả.
- Browser/context đã đóng; cả Java và Vite tạm đã dừng, DB memory biến mất; không saved auth/profile. Script/log/ảnh chỉ ở target ignored, password sinh trong memory và log được sanitize. PostgreSQL test dùng Testcontainers lifecycle riêng, không reset DB người dùng.

## Ownership và cuối phiên

Writer duy nhất, cùng branch/base ghi trên, không worktree mới. Thay đổi giới hạn: 6 file production (PaymentRepository, SubscriptionPaymentService, SubscriptionPaymentResource; subscriptionApi, types, HistoryPage), 6 file test mới/cập nhật, spec/decision/open questions/OpenAPI/catalog và review này. Artifact/scripts/log dưới backend/target ignored. Không reset/stash/commit/push/merge; không thay config .env hay dữ liệu DB của người dùng.

## Review độc lập và sửa ngày 09/11/2026

Review lại phần UC3 chưa commit, đối chiếu SRS 28/10 (SCR-60, Table III-1, MSG-COM-11 "Inline (under field)") và các điểm hoãn từ review UC1. Người dùng đồng ý sửa cả năm điểm, gồm migration chỉ thêm index. Công việc chuyển sang nhánh riêng `feat/fe19-uc03-lich-su-thanh-toan` (tạo từ HEAD `0627b80`, mang theo thay đổi chưa commit; nhánh UC2 giữ nguyên).

| ID | Mức | Phát hiện | Sửa | Bằng chứng |
|---|---|---|---|---|
| UC03-RV-01 | Trung bình | Panel chi tiết render sau Foot, không cuộn/focus; ở trang 20 dòng panel nằm ngoài màn hình nên "Xem" trông như không phản hồi | Panel nằm ngay dưới danh sách/phân trang; mở panel thì `scrollIntoView({block:'nearest'})` và focus tiêu đề | FE: scrolls the detail panel into view and focuses it |
| UC03-RV-02 | Trung bình | Điểm hoãn từ UC1: `toDto` chạy 2 query chứng từ mỗi dòng; `findAllByQuoteRefIgnoreCase` sinh `upper(quote_ref)` nên PostgreSQL không dùng `ix_evidence_quote_ref` | Đọc chứng từ theo lô (payment id IN, `upper(quote_ref)` IN) cho cả trang; changeset `20261109000200` thêm `ix_evidence_quote_ref_upper` (chỉ PostgreSQL, không cột/dữ liệu) | RED code cũ: 3 dòng 19 câu SQL, 20 dòng 54 câu. GREEN: chênh lệch ≤ 2. PostgreSQL: index tồn tại và xuất hiện trong plan |
| UC03-RV-03 | Thấp | from > to hiện như lỗi tải danh sách (ErrorBlock + Thử lại vô tác dụng, lộ "(MSG-COM-11)", bảng biến mất) | Kiểm trong trang; thông báo dưới ô "Tạo đến", không gọi API, giữ kết quả hợp lệ gần nhất; adapter vẫn chặn và bỏ mã khỏi chữ hiển thị | FE: validates dates below the filters |
| UC03-RV-04 | Thấp | Mỗi phím gõ một GET và LoadingBlock thay cả bảng/phân trang | Debounce 300 ms; giữ bảng cũ với `aria-busy` khi tải lại; tóm tắt phân trang theo `number` của response | FE: searches once after typing pauses and keeps the table while reloading |
| UC03-RV-05 | Thấp | `page` ≥ 107374183 làm offset vượt int, Spring Data ném `InvalidDataAccessApiUsageException`, HTTP 500 | Chặn page > `Integer.MAX_VALUE / 20` bằng 400 MSG-COM-10; OpenAPI ghi `minimum 0`, `maximum 107374182`, kiểu integer | RED code cũ: 500. GREEN: 400 MSG-COM-10 `field=page`; trang biên hợp lệ trả rỗng. OpenApiContractTest bắt được lỗi springdoc đổi kiểu thành string khi chỉ khai báo min/max |

Dọn kèm: bỏ 2 query repository theo `requestedBy` và biến `context` không dùng. Không sửa: `NotificationTargetAccessService` vẫn yêu cầu `requestedBy == actor` cho thông báo PAYMENT (lệch với D16 nhưng ngoài phạm vi UC3); `versionLabel` hiện DB id dạng "v1651" (có từ UC1/UC2).

Kết quả chạy lại:

| Kiểm chứng | Kết quả |
|---|---|
| H2 (cùng lệnh Maven ở trên) | 37/37 PASS: History 9, Request 7, Transaction 2, Overview 11, SePay 7, OpenAPI 1 |
| PostgreSQL 16.15 | 19/19 PASS: History 10, Request 7, Transaction 2 |
| Frontend `tests/unit/subscription` | 72/72 PASS (history backend 9) |
| Typecheck / production build | PASS; cảnh báo bundle > 500 kB có từ trước |
| OpenAPI / catalog | Export chép theo `docs/api/README.md`; so theo nội dung chỉ đổi mô tả, `minimum`, `maximum` của `page`. Catalog sinh lại; chữ ký `GET …/payments` đổi nên bản ghi review của nó được cập nhật theo bằng chứng mới, 3 bản ghi khác giữ nguyên |

Giới hạn: chưa chụp lại runtime sau khi sửa; sáu ảnh ở trên là trước sửa. Cuộn/focus của panel mới được kiểm bằng jsdom (gọi `scrollIntoView`, focus), cần kiểm tay trên trình duyệt với trang ≥ 20 dòng. RED cho phần frontend không chạy riêng vì bản trước sửa không còn được lưu; các assertion mới mâu thuẫn trực tiếp với hành vi cũ đã mô tả ở bảng.
