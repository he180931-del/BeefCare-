# FE-19 UC-04 — PM xem gói của các trại (SCR-61)

## Scope và checkpoint

- Người dùng chốt cả sáu đề xuất ngày 09/11/2026: D17. Tái dùng SCR-61; backend + FE + phần đọc thanh toán nguồn SCR-62. Đối soát UC6 và bảng giá UC7 ngoài gói.
- Workspace: `D:/Project/BeefCare-`, branch `feat/fe19-uc03-lich-su-thanh-toan`, checkpoint đầu `3eecf88f29efe8304a0a1cbcc18ca83e1825984e`, trạng thái ban đầu clean. Một agent ghi tuần tự, không tạo worktree, không commit/push.
- Nguồn: REQUIREMENT_DECISIONS D09/D12/D17; SRS 28/10 I.3.2 quan hệ Farm/Subscription/Payment, I.4.2.19 UC-04, III Table III-1, III.19.2.1 SCR-61, GBR-09/11/13/15/66/73; FE-19 mục 2/3/4/5/6/7/10; OpenAPI A5 và GET payment detail. Router ARCHITECTURE/API_RULES/VERIFICATION; backend/AGENTS.md và workflow/handoff HTML.

## Audit trước sửa production

Luồng đọc: SCR-61 state → platformServiceApi → GET platform/subscriptions → PlatformSubscriptionResource → PlatformSubscriptionQueryService → Farm / FarmMembership.user / Subscription / PAID Payment → DTO → adapter → UI. Thanh toán nguồn: paymentId từ chính kỳ → GET platform/payments/{paymentId} → SePayWebhookService.platformPayment → Payment + farm + snapshot giá → UI chỉ đọc. Không có request body hoặc trường form cần ghi/persist trong UC4.

| Trường | Kiểu/giá trị; required/default/null | Nguồn và đường lưu/đọc |
|---|---|---|
| q | optional string trim <=100; mặc định rỗng, contains case-insensitive, ký tự %/_ là literal | D09/D17/Table III-1; Farm.name hoặc PAID Payment.quoteRef |
| coverage | ALL/CURRENT/FUTURE_ONLY/NONE; default ALL | D17, tính từ các khoảng PAID [start,end) tại một now |
| serviceStatus | optional PENDING_PAYMENT/ACTIVE/EXPIRED/SUSPENDED | GBR-13/15; Farm.serviceStatus chỉ dùng cờ SUSPENDED, còn lại suy từ kỳ PAID |
| endFrom/endTo | optional ISO date độc lập; from<=to; trọn ngày VN | D17/GBR-66; LocalDate của max(Payment.purchasedEnd) trừ 1ns |
| sort/dir | confirmedUntil; asc/desc, default desc; null cuối | SCR-61/D17; max PAID end, tie farmId tăng |
| page/size | int >=0; page<=floor(INT_MAX/size), size1..100 default20; FE20 | A5/Table III-1, filter/count/sort trước phân trang |
| farmId/farmName | Long/string, required | Farm.id/name; chỉ ID thật từ response, không mặc định 1 |
| ownerName/ownerEmail | nullable string | FarmMembership OWNER ACTIVE → AppUser.fullName/email; Owner hiện tại |
| currentStart/currentEnd | nullable Instant, đồng thời null khi không có kỳ hiện tại | Payment.purchasedStart/end, PAID, start<=now<end |
| confirmedUntil | nullable Instant, max end gồm kỳ tương lai | Payment.purchasedEnd; không tin cache Subscription.latestEnd lệch |
| paymentCodes | string[], luôn có, rỗng nếu chưa PAID | Payment.quoteRef của các kỳ đã mua |
| items/total/page/size | array/long/int/int, required | A5 page; total là số trại khớp trước paging |
| summary | SubscriptionRow required | Cùng quy tắc với danh sách, đúng farmId |
| subscriptionId | nullable Long nội bộ, không hiển thị như mã nghiệp vụ | Subscription.id, max1/farm; đọc không tạo row |
| suspended/suspendedSince | boolean required / nullable Instant | Farm.serviceStatus=SUSPENDED; audit FARM_SERVICE_SUSPEND.loggedAt nếu có; không đọc vận hành |
| renewalOpens | nullable Instant | max PAID end trừ90 ngày lịch Asia/Ho_Chi_Minh |
| latestPurchase | nullable PurchasedPeriod | PAID confirmedAt giảm, null cuối, id giảm; không chọn theo start |
| periods | PurchasedPeriod[], required, mỗi PAID đúng1lần | Payment PAID có purchasedStart/end; không đưa PENDING/EXPIRED vào |
| paymentId/paymentCode | Long/string required mỗi kỳ | Payment.id/quoteRef, source link đúng paymentId |
| receiptCode | nullable string | Payment.receiptCode, không tự sinh trong luồng đọc |
| termYears | integer1/2/3 required | Payment.durationYears snapshot |
| start/end | Instant required [start,end) | Payment.purchasedStart/end bất biến; FE giữ instant, chỉ format ngày ở UI |
| status (mỗi kỳ) | CURRENT/FUTURE/PAST required | BE tính cùng `now` với summary: end<=now → PAST, start>now → FUTURE, còn lại CURRENT (như UC-01). FE dùng giá trị này, không suy từ giờ trình duyệt; thiếu/sai giá trị → lỗi dữ liệu |
| confirmedAt | nullable Instant | Payment.confirmedAt lưu thật; thiếu thì “—”, không suy từ start/giờ NH |
| emptyMessage | nullable string | Chưa có Subscription khác đã có Subscription nhưng chưa PAID |
| source payment | id,farmId,farmName,quoteRef,termYears,amount,state,requestedAt,expiresAt,purchasedStart/end?,receiptCode?,requestedByEmail,priceVersionId | GET /platform/payments/{id}; existing PlatformPayment record → Payment snapshot; UI chỉ đọc; PM mỗi request |

Discrepancy trước sửa: FE backendPending, demo mã SUB giả; thiếu coverage/paging/sort; chọn mặc định farm1 và đọc lặp; NONE chỉ confirmedUntil=null; trạng thái stored chậm job; confirmedUntil tin cache; latestPurchase theo start và confirmation đọc audit thay field thật; thiếu suspendedSince; source link chung không chọn payment. Sửa theo D17 bằng regression trước production.

## Test dự kiến và baseline

- Backend PlatformSubscriptionResourceTest: secured HTTP + DB cho quyền/revoke, coverage/time boundaries, search, dates, pagination/sort, đủ trường/null, empty states, latest confirmation, source payment và không ghi dữ liệu. PostgreSQL kế thừa cùng contract để kiểm query/migrations thật.
- Frontend platformSubscriptionBackend.test.tsx: HTTP adapter và UI state/filters/paging/sort/selection/retry/source link/back; giữ filter trong phiên, không demo fallback, không hiển thị nhầm trại.
- Baseline FE local: 24/24 PASS (platform-service). Chạy nguyên .env backend khiến test demo cũ fail; chạy với env VITE_BEEFCARE_DATA_SOURCE=local đúng fixture thì pass. Không sửa .env.
- Maven Wrapper Windows lỗi `Cannot index into a null array` trước Maven; dùng Maven 3.9.16 cài sẵn trùng version wrapper. Sandbox không đọc đủ cache; chạy kiểm chứng bằng escalation, không đổi wrapper/settings/dependency. Baseline SePayPaymentFlowTest 7/7 PASS.
- Skill TDD/React trong RTK trỏ macOS, inventory Windows không có bản tương ứng; áp dụng test-first và component hiện có. Đọc hết `.agents/skills/playwright-cli/SKILL.md`; CLI và references không có ở máy, dùng playwright-core/Chrome đã có, không cài runner/browser/package.

## Kết quả

| Kiểm chứng | Kết quả |
|---|---|
| RED UC4 backend | 8 ca chạy: 6 FAIL theo hành vi thiếu, 2 PASS; không error/skipped. Trước đó sửa builder fixture và URL decoding MockMvc; không đổi kỳ vọng nghiệp vụ. `target/fe19-uc04-red.log`. |
| RED frontend | 8/8 FAIL trước sửa do backendPending/thiếu filters/paging/source link. `target/fe19-uc04-fe-red.log`. |
| H2/security + hồi quy | 45/45 PASS trong `fe19-uc04-verify.log`: UC4 8, history9, request7, transaction2, overview11, SePay7, OpenAPI1. Lượt này PostgreSQL còn lỗi fixture một Owner trùng, không nhận toàn lệnh verify PASS. |
| PostgreSQL 16.15 và lần verify cuối | `fe19-uc04-verify-final.log`: UC4 H2 8/8 + OpenAPI1/1; UC4 PostgreSQL8/8; BUILD SUCCESS. Fixture dùng đúng một Owner ACTIVE; guard tài khoản inactive trả403 trước MVC, không có domain JSON; role sai vẫn kiểm403/COM-01. |
| Frontend | 104/104 PASS: platform-service32 (gồm8 ca backend mới), subscription72. Env local cho test demo, các suite backend override transport. `target/fe19-uc04-frontend-final.log`. |
| Typecheck/build | PASS cho src + tests và production bundle. Cảnh báo chunk >500kB hiện hữu; không đổi cấu hình bundle. `target/fe19-uc04-typecheck.log`, `fe19-uc04-build.log`. |
| OpenAPI/catalog | OpenApiContractTest PASS rồi copy artifact sang docs/api/openapi.json, chạy generator chuẩn bằng Python3.12. 218 paths,267 operations,86 screens; ba operation UC4 sẽ được cập nhật evidence riêng. |

Lệnh kiểm cuối (backend, Maven3.9.16 cài sẵn):

```powershell
$env:DOCKER_HOST='npipe:////./pipe/dockerDesktopLinuxEngine'
mvn.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dmodernizer.skip=true' '-Dapi.version=1.44' '-Duser.timezone=UTC' '-Dtest=PlatformSubscriptionResourceTest,OpenApiContractTest' '-Dit.test=PlatformSubscriptionPostgresIT' '-Dlogging.level.org.hibernate.SQL=OFF' '-Dlogging.level.root=WARN' verify
```

Lượt hồi quy trước dùng `-Dtest=PlatformSubscriptionResourceTest,SubscriptionPaymentHistoryResourceTest,SubscriptionPaymentRequestResourceTest,SubscriptionPaymentRequestTransactionTest,SubscriptionOverviewResourceTest,SePayPaymentFlowTest,OpenApiContractTest` với cùng flags; H2 pass trước khi PostgreSQL phát hiện fixture trùng Owner. Cuối cùng chỉ cần chạy lại UC4 bị ảnh hưởng vì production backend không đổi giữa hai lượt. Spotless/JaCoCo/Modernizer skip như lệnh; test không skip, Checkstyle vẫn chạy.

Đọc lại persistence: test flush/clear trước HTTP, đối chiếu Payment.confirmedAt/start/end/quote/amount và max end từ dữ liệu PAID; kiểm cache Subscription.latestEnd cố ý lệch vẫn giữ nguyên sau GET; không phát sinh Subscription/Payment khi xem trại rỗng. Cùng contract chạy trên PostgreSQL thật. Mọi trường là đọc từ storage hoặc suy ra có nguồn nêu trên; không có form ghi nên input body/persistence write, version/idempotency/concurrency command và migration upgrade là N/A cho UC4.

## Runtime và handoff

- Session `beefcare-fe19-uc04`, route `/nen-tang/goi-dang-ky`, nguồn backend qua Vite `http://127.0.0.1:5173/api` → backend `127.0.0.1:8080`; dev/local/testh2, H2 memory riêng `uc04-runtime`, SePay MOCK, mail mock. Không dùng DB PostgreSQL/dữ liệu người dùng để dựng fixture UI. Browser đăng nhập thật bằng cookie/CSRF; không inject cookie/localStorage, không intercept API.
- Checkpoint capture `working-tree-dabf7318f9098a55`, HEAD gốc như trên; manifest hash đủ10 file production, gồm file PaymentSourcePage mới. Capture 09/11/2026 22:21 giờ Việt Nam. Source production không đổi sau capture.
- [Manifest](../../backend/target/fe19-uc04-ui/manifest.json): 8 PNG + aria snapshot, bốn state `suspended-current`, `registered-no-paid-period`, `invalid-date-range`, `source-payment`, mỗi state tại1180×820 và1440×900. Đã xem trực tiếp cả8 PNG: nội dung/nhãn/tiền/ngày đọc được, không tràn ngang document. iPad có cuộn dọc bình thường ở3 state SCR-61 (scrollHeight1072/915/1002); source không cần cuộn. Desktop không cuộn dọc ở fixture này.
- Luồng thực: PM đọc3 trại; trại SUSPENDED vẫn có CURRENT; NONE gồm trại chưa có subscription và trại đã tạo yêu cầu nhưng chưa PAID; chọn từng trại thấy thông báo riêng. Khoảng ngày đảo hiển thị inline và giữ bảng; tìm mã → đúng numeric source payment → trở lại giữ CURRENT/từ khóa/trại, GET mới; tìm rỗng → Xóa bộ lọc.16 response UC4 đều2xx, không JavaScript page error. Phân trang22 trại, FUTURE_ONLY và exact end boundary được chứng minh bằng H2/PG + FE test; không nhận là đã dựng các fixture đó trên browser.
- Có1 console resource404 không thu được URL (failed response list rỗng), không có lỗi request UC4; không nhận clean-console. Đây là scripted Playwright-core runtime smoke + manual PNG inspection, không phải automated E2E/visual regression hoặc before/after comparison; không có approved screenshot baseline mới.
- Các lần helper trước capture cuối: login204 không body cần kiểm status thay JSON parse; shared DateInput có native accessible name “Chọn ngày”, dùng thứ tự From/To theo snapshot; Card heading gồm mã + tên trại nên locator dùng heading prefix thay exact text. Chỉ sửa helper ignored, không sửa ứng dụng/test để che lỗi. Chrome/context đã đóng, Java/Vite do helper tạo đã dừng, DB memory biến mất; không saved auth/profile; log được sanitize.
- OpenAPI export và generator chuẩn hoàn tất:267 operations. Cập nhật riêng ba review record GET subscriptions/list-detail và GET payment source, `status=doing`, nội dung BE_REVIEWED local; không nâng các UC5–8 hoặc API khác. Browser mở lại HTML mới: tìm2 operations A5, xem sort/dir/suspendedSince/confirmedAt, export JSON → import → export HTML đều PASS, không page error. [Catalog evidence](../../backend/target/fe19-uc04-catalog-check.json).

**Handoff FE — BE_REVIEWED local:** tái dùng SCR-61 hiện có, route `/nen-tang/goi-dang-ky`; phần thanh toán nguồn dùng `/nen-tang/thanh-toan?paymentId=<numeric>&farmId=<numeric>`. API phụ thuộc GET `/api/platform/payments/{paymentId}` đã kiểm phần đọc; đối soát, toàn màn UC5 và bảng giá không nằm trong gói này.

- A5 list giữ `{items,total,page,size}`, thêm `sort=confirmedUntil`, `dir=asc|desc`, default size đổi25→20; BE vẫn nhận size1..100, FE dùng20. Detail thêm `suspendedSince`, giữ null keys và numeric source IDs; sửa semantics theo D17, không thêm cột DB.
- Ví dụ: `GET /api/platform/subscriptions?coverage=NONE&serviceStatus=EXPIRED&sort=confirmedUntil&dir=desc&page=0&size=20`; success `200 {"items":[],"total":0,"page":0,"size":20}`. `endFrom>endTo` →400/MSG-COM-11; coverage/sort/page/size sai →400/MSG-COM-10; wrong role →403/MSG-COM-01; farm/payment thiếu →404/MSG-COM-08; anonymous401. Inactive account guard403 có thể không có domain JSON vì chạy trước MVC.
- Query GET không cần body/Idempotency-Key/version/CSRF header; phiên cookie vẫn bắt buộc, đăng nhập dùng CSRF thật. Fixture đọc PAID tạo qua Owner request + PM MOCK SePay chỉ trong DB tạm; PM không có nút tự tạo kỳ trên SCR-61.
- Chưa READY_FOR_FE: chưa có checkpoint/URL bản tích hợp được nhóm phê duyệt hoặc xác nhận FE nhóm trên bản chung. Không nhận đã test SePay LIVE/SMTP/Google. Không commit/push/merge hoặc thay .env.

## Acceptance criteria và bằng chứng (template BE)

| Case | Nguồn / Given → When → Then | API | Test / tầng / kết quả |
|---|---|---|---|
| TC-19-50 | GBR-09/11, D17: quyền PM/tài khoản được đọc; wrong role/inactive/revoke bị chặn | A5 + source | onlyActivePmCanReadListDetailAndSourceIncludingAfterRevocation; secured HTTP H2+PG PASS |
| TC-19-51 | SCR-61, GBR-13/15: current/future/expired/never/suspended → filter → đúng coverage và service tại read clock, không ghi state | A5 | coverageIncludesExpiredFarmsAndRemainsIndependentOfSuspensionAndStaleJobState; H2+PG PASS |
| TC-19-52 | D09/D17: tên hoặc mã PAID khác case/%/_ → tìm literal; mã chưa mua không khớp | A5 list | searchMatchesOnlyFarmNameOrPaidPaymentCodesAndTreatsWildcardsLiterally; H2+PG PASS |
| TC-19-53 | GBR-66/D17: end00:00 ngày2 → lọc ngày1 vẫn có; from/to độc lập, đảo lỗi | A5 list | endFiltersUseTheDisplayedLastCoveredDayWithIndependentInclusiveBounds; H2+PG PASS; FE inline/no HTTP PASS |
| TC-19-54 | Table III-1/D17:22 trại → sort/page →20 dòng +2 dòng, null cuối; input sai bị từ chối | A5 list | listFiltersCountsSortsAndPagesBeforeReturningTwentyRowsWithNullEndsLast; rejectsInvalidFiltersPagingAndSortingInsteadOfSilentlyChangingThem; H2+PG PASS |
| TC-19-55 | SCR-61/GBR-73/D17: cache end lệch, confirmedAt khác start → detail đúng PAID fields/latest/source; cache không đổi | A5 detail/source | detailUsesPersistedConfirmationLatestPurchaseAndPaidPeriodsInsteadOfCachedEnd; HTTP/DB H2+PG PASS |
| TC-19-56 | SCR-61/D17: chưa subscription và registered/no-PAID → GET → hai thông báo, null dates/empty periods, không insert | A5 detail | emptyStatesDistinguishMissingSubscriptionAndMissingPaidPeriodWithoutAnyWrites; HTTP/DB H2+PG PASS |
| TC-19-57 | D17: chọn trại → source → back → đúng ID, giữ lọc; đổi trại không hiện detail cũ, lỗi không fallback | FE + A5/source | platformSubscriptionBackend.test.tsx8/8; runtime8 captures/16 API2xx PASS |

## Findings và xử lý

| ID | Phân loại / trước sửa | Xử lý và rerun |
|---|---|---|
| UC04-01 | Missing integration: SCR-61 có sẵn nhưng backendPending, demo mã SUB, chọn farm1, thiếu controls | Backend adapter + giữ trang/selection/session;8 regression FE và24 ca cũ PASS |
| UC04-02 | Contract/rule: NONE bỏ trại expired; status và latestEnd phụ thuộc stored cache/job; filter ngày dùng exclusive end day | DB filters/derived row theo D17; H2+PG boundaries PASS |
| UC04-03 | Missing paging/sort: default25, FE array, tải toàn bộ farms/payments rồi page | Default20, page/count/sort tại query; lấy paid/Owner theo batch của trang; paging22 trại PASS |
| UC04-04 | Field mapping: latest theo start, confirmedAt đọc audit thay field thật, thiếu suspendedSince | DTO/mapper bám Payment.confirmedAt/audit suspension; nullable/seconds và readback PASS |
| UC04-05 | Navigation: source link chung không định danh payment | Link từng kỳ tới đúng GET source + back giữ state; FE/runtime PASS |
| FIXTURE-01 | Fixture, không phải source: builder không tồn tại, MockMvc double encoding; PG phát hiện tạo Owner ACTIVE thứ hai | Dùng setter thực/param decoded/Owner đã có; giữ assertions nghiệp vụ, final verify PASS |
| ENV-01 | Wrapper/cache/CLI khác máy macOS | Maven có sẵn cùng version + escalation; playwright-core có sẵn; không thêm dependency/config global |

Writer duy nhất `/root`, mode writable tuần tự; branch/checkpoint gốc như trên, không worktree/branch/commit mới. Dirty state cuối chỉ source/test/docs UC4 và contract/catalog đã liệt kê; artifacts/log/runtime helpers ở backend/target ignored. Không có user work ban đầu bị reset/stash/di chuyển. Kiểm diff cuối và hash capture để bảo đảm source không đổi sau runtime.

## Review 10/11/2026

Review lại toàn bộ thay đổi UC4 (đối chiếu D17, spec mục 5/A5/TC-19-50→57 và code). Không có lỗi sai dữ liệu hoặc hở quyền; người dùng chốt sửa các điểm dưới đây. Code chuyển sang nhánh riêng `feat/fe19-uc04-goi-cac-trai` (tạo từ `feat/fe19-uc03-lich-su-thanh-toan`, giữ nguyên working tree), chưa commit/push.

| ID | Trước sửa | Xử lý | Test (RED → GREEN) |
|---|---|---|---|
| REV-01 | `GET /api/platform/payments/{paymentId}` không tồn tại trả 404 nhưng không có `code` (ResponseStatusException), trái spec và handoff “404/MSG-COM-08” | `DomainException.notFound(COM_08, payment_id)` trong `SePayWebhookService.platformPayment` | `rejectsInvalidFiltersPagingAndSortingInsteadOfSilentlyChangingThem`: RED “No value at JSON path $.code” → PASS |
| REV-02 | FE gán nhãn kỳ Hiện tại/Tương lai/Đã qua bằng `Date.now()` của trình duyệt, còn summary/serviceStatus theo giờ server (trái D17 “một clock”) | BE thêm `PurchasedPeriod.status` cùng `now`; adapter đọc `status`, từ chối thiếu/sai giá trị | BE `coverageIncludes…`: RED thiếu `status` → PASS (end = now → PAST, start = now → CURRENT). FE `labels each period with the server read-clock status…`: RED `[502,'PAST'],[501,'PAST']` → PASS |
| REV-03 | Trang khôi phục từ session vượt số trang (dữ liệu đổi) → “Không có trại phù hợp” và “Hiển thị 21–20 / 15” | Khi `items` rỗng, `total > 0`, `page > 0` → chuyển về trang cuối, không hiện trạng thái rỗng | FE `moves a restored page that no longer exists…`: RED → PASS (request page 3 rồi 0) |
| REV-04 | Bộ lọc `serviceStatus` viết bằng SQL CASE, lặp logic Java nhưng chỉ có test cho SUSPENDED; chưa kiểm null cuối khi tăng dần | Chỉ thêm test, không đổi production | `coverageIncludes…` kiểm cả 4 trạng thái: danh sách lọc = trạng thái trên dòng = trạng thái chi tiết (gồm trại stored EXPIRED nhưng có kỳ hiện tại → ACTIVE); `listFilters…` kiểm `dir=asc&page=1` → [kỳ xa nhất, trại không có ngày]. Pass ngay (SQL và Java đang khớp) |

| REV-05 | `fmtShort` vẫn cắt chuỗi thô trong khi `fmtDate` đã đổi sang giờ Việt Nam: với instant từ backend ra giờ UTC ghép ngày Việt Nam (`20:30 10/11` thay vì `03:30 10/11`). Chỉ màn đối soát dùng, còn demo, nên chưa lộ | `fmtShort` đổi instant có múi giờ sang giờ Việt Nam như các hàm còn lại; chuỗi demo không múi giờ giữ nguyên | `dates.test.ts` (mới, 3 ca cho fmtDate/fmtDateTime/fmtSeconds/fmtShort/fmtEndDate): RED `'20:30 10/11'` → PASS |
| REV-06 | `DateInput` dùng chung gắn cứng `aria-label="Chọn ngày"`, che `<label for>`: hai ô ngày SCR-61 cùng tên truy cập; `aria-selected` đặt trên `<tr>` của bảng thường (không có tác dụng) | Thêm prop tùy chọn `label` cho `DateInput` (mặc định vẫn “Chọn ngày”, 51 chỗ dùng khác không đổi vì nhiều chỗ có `id` nhưng không có `<label>` thật, bỏ hẳn aria-label sẽ làm mất tên); SCR-61 truyền đúng nhãn. Trại đang chọn đánh dấu bằng `aria-current` trên nút chọn trại | FE `names each date filter by its own label…`: RED (tên truy cập “Chọn ngày”) → PASS |

Còn lại ngoài UC4: các ô ngày ở màn đối soát SCR-62 và các màn khác vẫn dùng tên mặc định “Chọn ngày”; có thể truyền `label` khi làm từng màn.

| Kiểm chứng sau sửa | Kết quả |
|---|---|
| Backend H2 (Checkstyle chạy; Spotless/JaCoCo/Modernizer skip) | 45/45 PASS: UC4 8, SePay 7, overview 11, history 9, request 7, transaction 2, OpenAPI 1 |
| Backend PostgreSQL 16.15 | `PlatformSubscriptionPostgresIT` 8/8 + OpenAPI 1/1, BUILD SUCCESS |
| Frontend (`VITE_BEEFCARE_DATA_SOURCE=local`) | platform-service 38/38 PASS (UC4 11, dates 3); subscription 72/72. Toàn bộ `vitest run tests`: 851/854; 3 ca fail có sẵn ở feed-stock (`FeedMovementApi`, `FeedReceiptDetail`) và herd-entry (`purchaseDraftBackend`), fail y hệt khi đặt `ui.tsx` về HEAD và không import platform-service; 2 file `node:test` báo “No test suite found” (`userFacingError`, `entryFilesHttp`) như trước |
| Typecheck src + tests, production build | PASS (cảnh báo chunk >500 kB có sẵn) |
| OpenAPI / catalog | Export từ `OpenApiContractTest` sang `docs/api/openapi.json` (`PurchasedPeriod.status` enum CURRENT/FUTURE/PAST); chạy `generate_api_catalog.py`: 218 paths, 267 operations. Cập nhật ba bản ghi review UC4 (signature mới của detail, trạng thái vẫn `doing`) |

Chưa kiểm lại: runtime trình duyệt (8 ảnh ở mục Runtime chụp trước các sửa này), E2E thủ công. Vẫn chưa READY_FOR_FE.

