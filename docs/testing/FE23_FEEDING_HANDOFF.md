# FE-23 khẩu phần và nhật ký cho ăn — handoff

## Xác nhận trên PostgreSQL — 16/11/2026

- `FeedRationSuccessorRowVersionPostgresIT` đạt trên PostgreSQL 16.15. Test tạo lịch nằm giữa hai phiên bản hiện có qua API, kiểm tra ngày kết thúc và `version` sau khi transaction đã commit, rồi dùng chính `version` của phản hồi để hủy và đọc lại phiên bản đã lưu.
- `FeedManagementServiceTest` đạt 38/38, gồm các ca chèn và hủy lịch giữa hai lịch, cập nhật phiên bản successor, giữ ngày dừng thủ công và từ chối lịch cũ thiếu snapshot.
- Test dùng schema riêng do Testcontainers tạo. Các kiểm tra và dữ liệu smoke ngày 15/11 bên dưới là mốc trước đó.

## Checkpoint tích hợp mới — 15/11/2026

- Backend focused Maven: 83/83 đạt, gồm FE-23; Failsafe FE-14/15: 20/20 đạt. Frontend: 192/192 test đạt, TypeScript và build đạt.
- OpenAPI đã sinh lại sau tích hợp: 234 paths / 288 operations.
- Liquibase FE-23 ration lifecycle đã pass trên DB QA fresh `beefcare_tai_ration_fresh_20261115` và upgrade `beefcare_tai_ration_upgrade_20261115`. HTTP smoke cancel/stop trên upgrade DB được ghi chi tiết bên dưới.
- Các số test và migration ở checkpoint trên là bằng chứng trước bản sửa rewire bên dưới. Bản sửa mới có regression tests bổ sung nhưng chưa chạy Maven; Maven cần chạy lại sau khi tích hợp vào target dùng chung.
- Stop smoke dùng fixture SQL đổi `effective_from` của đúng ration QA sang hôm qua; chưa chứng minh chuyển trạng thái tự nhiên theo thời gian.

## Cập nhật vòng đời phiên bản khẩu phần — 15/11/2026

- Đã bổ sung `POST /api/farms/{farmId}/feed/rations/{rationId}/versions/{versionNo}/cancel` để hủy phiên bản `SCHEDULED`, và `POST /api/farms/{farmId}/feed/rations/{rationId}/stop` để đặt ngày kết thúc cho phiên bản `EFFECTIVE`. Cả hai yêu cầu `MANAGE_FEED`, `Idempotency-Key` và trường body `version` là optimistic row token; `versionNo` trong URL vẫn là số phiên bản nghiệp vụ. Hai command phát outbox event `FEED_RATION_VERSION_CANCELLED` và `FEED_RATION_STOPPED`, payload có `farmId` từ envelope và `rationId`/`versionNo` (thêm `endDate` với stop).
- Hủy không xóa dữ liệu: phiên bản giữ components/links, chuyển thành `CANCELLED`, kết thúc ở ngày trước `effectiveFrom`, và vẫn xuất hiện trong lịch sử. Đây là trạng thái kết thúc được thêm vì SRS yêu cầu hủy lịch nhưng không quy định tên state cuối.
- Khi tạo phiên bản mới, backend khóa pen theo ID tăng dần, sau đó khóa feed theo ID tăng dần và kiểm tra trạng thái `available` trên các row đã khóa. Backend chụp predecessor, ngày kết thúc và cờ stop thủ công trước khi sửa predecessor dùng chung cho nhiều pen. Nếu một phiên bản predecessor dùng cả pen được chọn lẫn pen không được chọn, hoặc pen có lịch kế tiếp tạo ra các ngày kết thúc toàn cục khác nhau, lệnh bị từ chối với conflict thay vì làm thay đổi lịch pen ngoài phạm vi. Khi hủy lịch kế tiếp, backend phục hồi predecessor từ snapshot; ngày stop thủ công sau khi tạo lịch được giữ nguyên kể cả khi trùng ngày tự động kết thúc, và được truyền tiếp cho successor.
- Có thể chèn lịch `SCHEDULED` giữa hai lịch đã có: service xác nhận quan hệ predecessor và snapshot ở từng pen trước khi thay đổi, rồi rewire predecessor của lịch kế tiếp sang lịch mới. Snapshot của lịch mới giữ ý định kết thúc dài hạn mà successor cũ đã lưu; stop thủ công mới hơn được ưu tiên. Nếu chuỗi thiếu snapshot, có successor mơ hồ, snapshot khác nhau giữa các pen hoặc ngày kết thúc snapshot nằm trước ngày bắt đầu lịch mới, lệnh fail-closed bằng `MSG-FE23-22` (HTTP 409). Bản ghi không bị xóa hay backfill. Lịch sau một khoảng trống do stop thủ công có predecessor rỗng; hủy successor khôi phục lịch mới về open-ended và giữ ngày stop cũ.
- Khi save/cancel thay link của successor, backend khóa các ration liên quan theo ID tăng dần sau khi khóa pen, rồi dùng `PESSIMISTIC_FORCE_INCREMENT` và flush để tăng `version` của successor trong cùng transaction. Một successor dùng nhiều pen chỉ bump một lần mỗi command; client đang giữ token cũ nhận 409 ở command tiếp theo. Test mới kiểm tra thứ tự khóa, bump một lần và stale token. Chưa chạy Maven cho các test mới.
- Link lịch sử trước migration không có đủ metadata để phân biệt predecessor bị tự rút ngắn với ngày stop thủ công. Không đoán hoặc backfill. Hủy lịch legacy chỉ tiếp tục khi pen chưa có version khẩu phần không hủy nào trước đó; nếu có lịch sử trước đó nhưng snapshot thiếu, service từ chối `MSG-FE23-22` để tránh khôi phục sai.
- Stop cho phép đổi ngày kết thúc của phiên bản đang hiệu lực, gồm phiên bản đã có ngày kết thúc do lịch scheduled kế tiếp. Ngày mới phải từ ngày mai và nằm trước mọi scheduled successor của các pen liên quan; yêu cầu stale hoặc lịch chồng bị từ chối. Stop không sửa ngày kết thúc vượt qua successor.
- Migration mới `20261115000300_fe23_ration_cancellation_snapshot.xml` thêm optimistic `row_version`, `effective_to_manually_set` cùng metadata predecessor/snapshot (bao gồm `predecessor_effective_to_manually_set`); không backfill quan hệ lịch sử không có bằng chứng. Boolean mặc định false cho row cũ; lệnh stop mới bật marker kể cả khi ngày kết thúc không đổi. Migration đã pass trên DB QA fresh `beefcare_tai_ration_fresh_20261115` và upgrade `beefcare_tai_ration_upgrade_20261115`.
- Checkpoint 83/83 trước rewire đã gồm service tests cho cancel không có predecessor, restore predecessor open-ended, lịch A(p1,p2)→B→C, stop đúng boundary, stale row token, legacy predecessor thiếu snapshot, shared predecessor, stop trước successor và khóa feed. Bản sửa hiện tại bổ sung test A→B→D rồi chèn C, hủy theo các thứ tự, chuỗi hai pen, manual stop được giữ, gap do manual stop, snapshot pen không nhất quán và legacy lineage không suy ra được. Chưa chạy các test mới; cần đưa chúng vào lần Maven focused kế tiếp.
- Frontend focused: Vitest 4 file/25 test đạt (`FeedRationApi`, `FeedRationPage`, `FeedTodayRationsPage`, `FeedConsumptionData`); test mới xác nhận backend để `rationCode` null và UI hiển thị `Tự cấp mã khi lưu` thay vì dự đoán mã. `node node_modules/typescript/bin/tsc --noEmit` đạt. Các test FE dùng demo store/transport mock, không xác nhận persistence backend.
- HTTP smoke trên backend local `127.0.0.1:8080`, database QA upgrade nói trên: tạo ration synthetic `KP-01` ID 3801 qua API cho pens 2151/2152, feed 1428, ngày 2026-11-17; GET trả `SCHEDULED`, cancel trả HTTP 200/status `CANCELLED`/row version 1, replay cùng idempotency key trả cùng kết quả HTTP 200; stale row token trả 409, cancel lại state terminal bằng token mới trả 409, farm khác trả 403. GET cuối xác nhận row vẫn có history, `effectiveTo=2026-11-16`, row version 1.
- HTTP smoke stop: tạo ration synthetic thứ hai ID 3802 (`KP-02` v1, pen 2151, row version 0) qua API ở trạng thái `SCHEDULED`. Sau khi SELECT xác nhận ID/farm/status trong `beefcare_tai_ration_upgrade_20261115`, một SQL fixture update chỉ đổi `effective_from` của đúng row đó từ 2026-11-17 sang hôm qua 2026-11-14; không sửa status hoặc row version. API GET sau đó trả `EFFECTIVE`; POST stop với endDate ngày mai 2026-11-16 trả HTTP 200, endDate đúng và row version 1; token cũ trả 409; GET readback xác nhận `EFFECTIVE`, `effectiveTo=2026-11-16`, row version 1. Đây là smoke trên fixture đã đổi ngày bằng SQL, không phải kiểm thử chuyển ngày tự nhiên.
- Python launcher `python.exe` không khả dụng trong shell hiện tại, nên HTTP smoke gọi API bằng Node fetch; `PYTHONDONTWRITEBYTECODE=1` được đặt. Các dòng dữ liệu synthetic được giữ trong DB QA để đọc lại. Chưa kiểm tra stop khi phiên bản tự nhiên chuyển từ `SCHEDULED` sang `EFFECTIVE` theo thời gian.
- Contract OpenAPI đã được tái sinh sau tích hợp; artifact hiện có 234 paths / 288 operations.

## Cập nhật kiểm thử 15/11/2026

Các mục bên dưới mô tả cả những checkpoint trước đó. Hiện code local dựa trên `dev` tại `bd7d598` và chưa commit hoặc push. Trên nền này đã chạy 40/40 test backend có chọn (bao gồm FE-07, FE-23 và OpenAPI), 16/16 test tích hợp nhắc việc, 180/180 test frontend cho FE-07/14/15/23, TypeScript và build frontend. Contract OpenAPI và catalog đã được sinh lại.

PostgreSQL 16.15 trên DB QA mới đã áp dụng hai migration FE-07 và FE-23; đã kiểm tra partial unique index cho phiên cho ăn hợp lệ. Smoke nhập kho/thanh toán trên DB QA đạt, bao gồm kiểm tra phân quyền và idempotency. Smoke nhật ký cho ăn trên bản backend trước các sửa cuối đã qua create, replay, chặn cữ trùng, correct, void và ghi lại; sau kiểm thử tồn kho trở lại 15 kg. Kiểm thử cạnh tranh đồng thời trên PostgreSQL vẫn chưa được thực hiện.

Đợt review sau checkpoint cũ bổ sung kiểm tra chuồng đang hoạt động sau khi khóa, từ chối cữ ngoài khẩu phần và yêu cầu ghi chú khi lượng bằng 0 do hết hàng; dialog frontend có cảnh báo tương ứng. Test thông báo lỗi được chuyển sang Vitest đúng runner của thư mục unit và cập nhật để phản ánh `MSG-COM-05` là thông báo chung cho nhiều nghiệp vụ; cả 9 test trong file đều đạt, bao gồm nhãn ghi chú.

Smoke cũ phát hiện version không tăng khi chỉ sửa dòng lượng cho ăn. Bản sửa đã qua 18/18 `FeedManagementServiceTest` và smoke PostgreSQL trên backend mới: tạo version 0, sửa riêng lượng nhận version 1, sửa hoặc hủy bằng version 0 bị từ chối 409 và không đổi tồn, hủy bằng version 1 thành công với version 2, trả tồn về 15 kg. Đó là kiểm tra tuần tự; chưa chứng minh hành vi hai transaction chạy đồng thời.

## Phạm vi

Đã nối end-to-end phần FE-23 khẩu phần và các luồng UC-FE23-05–09: Owner, Manager và Technician đọc khẩu phần/nhật ký; Owner và Manager quản lý phiên bản khẩu phần theo `MANAGE_FEED`, còn chỉ Manager ghi, sửa hoặc hủy bản ghi cho ăn theo `MANAGE_FEEDING`. Ghi nhanh theo khẩu phần mở lần lượt một biểu mẫu cho mỗi cữ để Manager kiểm tra và xác nhận theo Q4 của SRS.

Đây là lát cắt FE/BE cho rations và feeding records. Các thay đổi FE-23 receipt/stock adjustment trong working tree thuộc lát cắt khác. Handoff này thay thế nhận định “chưa có plan endpoint, chưa thể nối nhật ký” trong `FE23_PHASE2_HANDOFF.md`; endpoint kế hoạch được bổ sung ở dưới.

## Hợp đồng và luồng dữ liệu

- `GET /api/farms/{farmId}/feed/rations` trả danh sách phiên bản, `sessionTimes`, pen IDs và cờ `outOfStock` theo từng component. Giá vốn vẫn phụ thuộc quyền đọc theo service.
- `POST /api/farms/{farmId}/feed/rations` nhận ration code khi sửa phiên bản, `baseVersion`, ngày hiệu lực, giờ cữ, pen IDs và component amounts; FE gửi `Idempotency-Key`. FE dùng `baseVersion` hiện tại để từ chối save khi form đã cũ. Tạo mới để server cấp mã mới; sửa tạo version mới. Hủy `SCHEDULED` và stop `EFFECTIVE` dùng hai route ở phần cập nhật vòng đời phía trên.
- `GET /api/farms/{farmId}/feed/feeding-records/plan?penId={id}&date={yyyy-MM-dd}&session={1..3}` trả chuồng, ngày/cữ, giờ mặc định, ration/version nếu có, headcount, line kế hoạch và tồn/available, cùng `existingRecordId`. Endpoint được bảo vệ bằng `MANAGE_FEEDING`.
- `POST /api/farms/{farmId}/feed/feeding-records` nhận `penId`, `feedingDate`, `sessionNo`, `feedingTime`, `fedBy`, `leftoverKg`, `note` và danh sách `{feedItemId, actualKg}`. Server tự lấy khẩu phần hiệu lực, headcount và planned kg; client không gửi planned kg hoặc đơn giá làm dữ liệu có thẩm quyền. Server lưu snapshot và tạo movement theo lượng thực tế, kiểm tra tồn ngay lúc ghi. Dòng ngoài khẩu phần được ghi với kế hoạch 0. Không có khẩu phần thì version khẩu phần rỗng và vẫn cho ghi actual-only.
- `POST /api/farms/{farmId}/feed/feeding-records/{recordId}/correct` nhận `expectedVersion`, lý do, `fedBy` tùy chọn và các actual amounts mới. `POST .../{recordId}/void` nhận `expectedVersion` và lý do. Hai command nhận `Idempotency-Key`; version cũ bị từ chối. Sửa ghi revision và movement theo delta; hủy trả lượng đã ghi về kho. VOIDED giữ lịch sử nhưng không cản một VALID record mới cùng chuồng/ngày/cữ.
- `GET /api/farms/{farmId}/feed/feeding-records?from=...&to=...` trả view nhật ký với planned/actual, cost, trạng thái, người/giờ, leftover, note và lịch sử lý do sửa/hủy. UI không tự tạo hoặc sửa response khi backend lỗi.

Adapter FE ánh xạ rõ `FeedingPlanView`, `FeedingView` và `RationView`; actual lines gửi lên từ dialog. Retry cùng ý định giữ command key đến khi sửa input hoặc thành công. Local/demo store chỉ được dùng khi app ở local mode.

## Quy tắc FE-23 đã áp dụng

- Kế hoạch = kg/con trong phiên bản khẩu phần hiệu lực × số bò được phân vào chuồng tại ngày cho ăn. Lưu actual 0 vẫn giữ planned line.
- Một bản ghi `VALID` trên mỗi farm/chuồng/ngày/cữ; duplicate hiện có được báo trong form. Sau hủy, có thể lập lại bản ghi hợp lệ.
- Mỗi lượng actual không âm, tối đa một chữ số thập phân, không vượt tồn tại thời điểm ghi. “Điền theo kế hoạch” chỉ là giá trị gợi ý để Manager xác nhận.
- Feed đã ngừng nhưng còn trong khẩu phần lịch sử có thể giữ planned line với actual 0; actual dương bị chặn bằng `MSG-FE23-21`, không trừ tồn. Dòng actual 0 không sinh stock movement. Sửa tăng lượng của mặt hàng đã ngừng cũng bị chặn; sửa giảm hoặc hủy vẫn được phép để hoàn tồn.
- Sửa/hủy cần lý do từ 5 ký tự không trắng đến tối đa 500 ký tự. Client gửi version hiện tại; server kiểm tra lại version, quyền, duplicate và tồn.
- `FeedTodayRationsPage` và Technician view dùng `outOfStock` từ ration projection, không gọi stock/receipt endpoint vốn bị chặn với Technician. Technician chỉ xem nhật ký; Owner chỉ xem log; Manager ghi/sửa/hủy.

## Migration và tương thích dữ liệu

Migration mới: `backend/src/main/resources/config/liquibase/changelog/20261115000200_fe23_feeding_sessions.xml`, đã include ở cuối `master.xml` trong working tree.

Migration bổ sung cho vòng đời ration: `backend/src/main/resources/config/liquibase/changelog/20261115000300_fe23_ration_cancellation_snapshot.xml`. Migration thêm `feed_ration_version.row_version` (mặc định 0 cho row hiện có), `feed_ration_pen.predecessor_version_id`, `predecessor_effective_to` và `predecessor_snapshot_captured`. Không backfill snapshot quan hệ predecessor cho các link cũ; nếu cancel gặp link lịch sử có predecessor khả dĩ nhưng không có snapshot, service fail closed bằng conflict. Cần xác minh migration trên cả fresh schema và upgrade DB trước khi triển khai.

- Thêm cột nullable `feeding_time`, `leftover_kg`, `note`; bản ghi cũ giữ các giá trị `NULL`, không phải backfill giả.
- Hạ unique constraint `uq_feeding_session` (tên khớp với Liquibase trước đó và entity mapping cũ), sau đó PostgreSQL tạo unique partial index `uq_feeding_session_valid` cho `(farm_id, pen_id, feeding_date, session_no)` với predicate `status = 'VALID'`. Việc này giữ bảo đảm duy nhất cho record đang hiệu lực và cho phép ghi lại sau khi VOIDED.
- Constraint cũ là unique toàn cục, nên dữ liệu lịch sử hợp lệ theo schema đó vốn không thể có duplicate kể cả giữa các trạng thái. Không có dữ liệu bị xóa hoặc đổi trạng thái trong migration. Entity `FeedingRecord` đã bỏ `@Table(uniqueConstraints=...)` để Hibernate không tái tạo constraint toàn cục.
- ChangeSet partial index chỉ chạy trên PostgreSQL. H2 không tạo điều kiện partial unique tương đương; service khóa hàng pen để tuần tự hóa command, nhưng kết quả H2 không chứng minh hành vi cạnh tranh trên PostgreSQL.
- Chưa truy vấn DB PostgreSQL của môi trường để xác nhận constraint/index đang tồn tại hoặc đếm duplicate trước migration. Trước khi apply cần kiểm tra `pg_constraint` cho đúng tên `uq_feeding_session`, xác nhận không có VALID duplicate và xác nhận kết quả `pg_indexes` sau migration. Không chạy migration trên DB thật trong lượt này.

## Kiểm thử và giới hạn xác nhận

- Frontend focused: `node node_modules/vitest/vitest.mjs run tests/unit/feed-stock/FeedFeedingApi.test.ts tests/unit/feed-stock/FeedFeedingPage.test.tsx tests/unit/feed-stock/FeedRationApi.test.ts tests/unit/feed-stock/FeedRationPage.test.tsx --reporter=dot --silent` — 4 file, 26 test đạt.
- TypeScript: `node node_modules/typescript/bin/tsc --noEmit` — đạt.
- `git diff --check` — đạt.
- Đã bổ sung 5 case service test trong `FeedManagementServiceTest`: plan/field round-trip và tính plan từ server, inactive line actual 0 vs actual dương, duplicate và void/re-record, correction với version/delta stock, và Manager-only authorization action. Root đã chạy Maven sau các thay đổi này: `FeedManagementServiceTest` — 15/15 test đạt.
- Chưa chạy API/UI smoke trên backend thật, chưa kiểm tra DB round-trip PostgreSQL, partial index thực tế, phân quyền bằng session thật hoặc concurrency trên PostgreSQL. Các frontend test dùng local demo store/transport mock để kiểm tra luồng UI và hợp đồng client; chúng không chứng minh backend persistence/runtime.
- Tĩnh `docs/api/openapi.json` chưa được tái sinh theo contract FE-23 trong patch này; cần chạy quy trình `OpenApiContractTest`/generator của repo sau khi backend tests pass rồi review diff OpenAPI.

## File chính

- FE: `frontend/src/features/feed-stock/api/feedFeedingApi.ts`, `api/feedRationApi.ts`, `components/FeedSessionDialogs.tsx`, `pages/FeedFeedingPage.tsx`, `pages/FeedRationFormPage.tsx`, `pages/FeedRationPage.tsx`, `pages/FeedTodayRationsPage.tsx`, `data/feedTodayRations.ts`, `data/feedRationForm.ts`, `types/feedFeeding.ts`, `types/feedRation.ts`.
- BE: `FeedManagementResource`, `FeedManagementService`, `FeedManagementDtos`, `FeedingRecord`, `FeedingRecordRepository`, `RecordRevisionService`, `MessageCodes`, i18n bundles, plus migration ở trên.
- Tests: FE-23 API/page tests trong `frontend/tests/unit/feed-stock/`; service cases trong `backend/src/test/java/vn/edu/fpt/beefcare/service/FeedManagementServiceTest.java`.
