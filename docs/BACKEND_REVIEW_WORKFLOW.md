# Workflow review và bàn giao backend cho frontend

**Bản sử dụng hiện tại:** [workflow HTML](backend-workflow.html), [bảng API cập nhật](api-handoff.html) và [hướng dẫn agent](../backend/AGENTS.md). Chủ dự án đã chốt **tự kiểm cùng agent, không bắt buộc review chéo**. Nội dung bên dưới là bản đề xuất trước khi có điều chỉnh này; các bước yêu cầu reviewer không còn là điều kiện bàn giao.

Áp dụng cho 4 thành viên BE của BeefCare; căn cứ source tại `main` / `6ccc3a8`, ngày 29/10/2026. Đây là quy trình đề xuất, không phải kết quả chứng nhận lại code hiện tại.

## 1. Đơn vị công việc và trách nhiệm

**Feature để chia người; use case để chia việc; business rule để xác định đúng/sai; API là giao diện; test là bằng chứng.**

Mỗi thành viên giữ một scope BE theo bảng phân công. Trong scope, hoàn thiện và bàn giao từng UC hoặc cụm UC phụ thuộc nhỏ. Ví dụ nhập đàn: tạo/ghi sổ + xem lại phiếu và đàn là một lát cắt dùng được; không bàn giao một POST chưa có cách đọc kết quả. Không cần chờ cả feature hoặc cả 4 người xong.

- Người phụ trách BE: rà yêu cầu, source/DB, unit/integration/API/luồng BE, contract, dữ liệu mẫu và lỗi cần FE xử lý.
- Người review chéo: kiểm ý nghĩa assertion với SRS, ranh giới quyền/trạng thái/giao dịch, contract và bằng chứng chạy test.
- Thành viên FE: dựng màn, adapter, test component/form/UI và kiểm tích hợp trên trình duyệt theo contract đã bàn giao. BE hỗ trợ lỗi API và xác minh luồng chung, không phải viết hộ mọi test frontend.
- Một người điều phối bản tích hợp: mã nguồn trên main, môi trường BE dùng chung, migration và phiên bản contract phải khớp. Có thể luân phiên người này; tránh cả 4 người cùng sửa cấu hình chung.

Phân công review chéo: 1 ↔ 2, 3 ↔ 4. Các ca giao nhau vẫn có đúng hai chủ nghiệp vụ tham gia.

## 2. Dùng tài liệu nào, để trả lời câu hỏi gì?

| Nguồn | Câu hỏi phải trả lời |
|---|---|
| SRS phần UC: actor, tiền/hậu điều kiện, luồng chính, alternative, exception | Ai làm gì, cần gì trước khi làm, thành công/lỗi để lại kết quả gì? |
| Permission matrix, GBR/BR-D, state model, message catalogue | Được phép khi nào, chuyển trạng thái nào, rule nào cấm, mã lỗi nào? |
| SCR/field definitions | API có đủ dữ liệu để FE dựng màn? Required/null/enum/date/precision/filter/paging đúng chưa? |
| ERD và entity detail | Quan hệ, dòng chi tiết, lịch sử và nguồn dữ liệu nào cần tồn tại? |
| `REQUIREMENT_DECISIONS.md`, workstream docs | Mâu thuẫn nào đã chốt, diễn giải nào còn cần xác nhận, phần nào từng thiếu test? |
| OpenAPI, controller/DTO và code/test hiện tại | Đã triển khai thế nào và còn thiếu/sai gì so với yêu cầu? |

Swagger dùng để tra route/schema và thử request. Một endpoint có trên Swagger chưa chứng minh rule, quyền, rollback hoặc toàn UC đã đúng. Khi tài liệu và code khác nhau, ghi vấn đề cụ thể; không sửa SRS hoặc assertion cho khớp code một cách tự động. Hỏi chủ dự án chỉ khi các nguồn và quyết định hiện có không chốt được.

## 3. Trình tự mỗi thành viên lặp cho từng gói UC

| Bước | Việc làm | Đầu ra để sang bước tiếp |
|---|---|---|
| 0. Chốt phạm vi và dependency | Lấy cùng mốc main; tạo nhánh review riêng; chọn UC nhỏ và người review. Xác nhận auth/farm context/danh mục/nguồn cần có. | Tên UC, actor, API phụ thuộc và commit gốc. |
| 1. Đọc và viết điều kiện nghiệm thu | Đọc các nguồn ở mục 2; liệt kê happy path, nhánh lỗi, quyền và dữ liệu sau thao tác. Viết expected trước khi nhìn kết quả chạy. | Phiếu UC theo template; mỗi điều kiện có nguồn yêu cầu. |
| 2. Map code/API/test, chạy baseline | Map điều kiện → route/DTO/service/entity/migration/test. Đọc test sẵn có và chạy nhóm liên quan trước khi sửa. | Danh sách đã đúng, lỗi, thiếu API/test, chưa rõ tài liệu; baseline thực tế. |
| 3. Chốt contract dự thảo với FE | Đủ cả command, query/readback, quyền, state/version/idempotency, mã lỗi và ví dụ. FE có thể dựng adapter/mock đúng schema trước. | Contract DRAFT và vấn đề còn mở, chưa coi là API sẵn sàng nối thật. |
| 4. Hoàn thiện và kiểm thử | Bổ sung test còn thiếu có giá trị, sửa source cần thiết, giữ test hồi quy. Kiểm từ rule nhỏ → giao dịch/HTTP → luồng BE. | Điều kiện nghiệm thu quan trọng có test hoặc bằng chứng kiểm rõ ràng. |
| 5. Review chéo | Reviewer so expected với SRS, đọc assertions/diff, tái hiện các ca quan trọng. Kiểm ảnh hưởng feature khác và migration. | Đã xử lý lỗi chặn, ghi rõ hạn chế còn lại. |
| 6. Tích hợp và bàn giao FE | Gộp thay đổi đã review vào main theo quy tắc nhóm; chạy kiểm hồi quy liên quan và PostgreSQL/HTTP trên bản tích hợp; export contract khớp source. | Commit + môi trường chạy + test + contract + sample/seed; trạng thái READY_FOR_FE. |
| 7. FE nối và kiểm luồng chung | FE chạy UI/adapter với API thật; BE phối hợp xử lý vấn đề. Thay đổi DTO phải sửa contract và thông báo nhóm FE liên quan. | FE xác nhận luồng tích hợp; còn tách biệt với nghiệm thu sản phẩm cuối. |

Chạy test ngay khi sửa từng phần; không dồn mọi test tới trước lúc push. Tạo test cho phần thiếu và lỗi tìm được, tái sử dụng test hợp lệ hiện có; không viết lại cả bộ chỉ vì đổi người review.

## 4. Tổ chức test theo UC, đặt assertion ở đúng tầng

| Nhóm bằng chứng | Kiểm gì? | Cách áp dụng ở BeefCare |
|---|---|---|
| Unit | Rule/tính toán/chuyển trạng thái có thể cô lập: tiền, BCS, khoảng ngày, eligibility, giá bình quân… | JUnit; mock dependency khi cần. Dùng bảng biên và dữ liệu tính tay. Không lấy việc mock repository thành công làm bằng chứng DB/giao dịch đúng. |
| Integration service + DB | Repository/query, constraints, migration, commit/rollback, nhiều entity, audit/revision/outbox, retry/version và lock | Các test `@ServiceIntegrationTest` hiện chạy H2 để phản hồi nhanh. Các hành vi phụ thuộc PostgreSQL và luồng ghi quan trọng phải kiểm thêm trên PostgreSQL đúng phiên bản mục tiêu. |
| HTTP/API | Request/response thực, status, mã lỗi/field, JSON/null/enum, filter/paging, cookie/CSRF, quyền/trại, header idempotency/version, upload | MockMvc có security chain thực như `BrowserSessionFlowIT`, hoặc HTTP vào server thật. Một test MockMvc + DB thật theo context cũng là integration test; không tính là một tầng độc lập chỉ để tăng số lượng. |
| Luồng BE/acceptance | Chuỗi API của UC và cụm UC: tạo → post → đọc lại → sửa/hủy; trạng thái và dữ liệu liên quan phải nhất quán | Chạy không cần UI. Tự động hóa luồng lặp quan trọng, giữ request/assertion có thể chạy lại; smoke bản tích hợp bằng HTTP + PostgreSQL. |

**Không bắt mỗi UC phải có đủ bốn bộ test riêng.** Một API integration test có thể chứng minh nhiều điều kiện; nhiều UC có thể dùng chung test permission/idempotency. Mỗi rule quan trọng cần bằng chứng phù hợp, không cần lặp cùng mọi assertion ở mọi tầng. Unit test tập trung logic có nhánh/ranh giới, không test getter/setter hoặc CRUD ủy quyền đơn giản chỉ để đạt coverage.

### Checklist chọn ca test

- Luồng chính và các nhánh UC áp dụng; đúng tiền/hậu điều kiện.
- Role được phép, role bị từ chối có ý nghĩa, anonymous khi liên quan; ID thuộc trại khác. Các UC chỉ platform không ép thêm farm tenant không tồn tại.
- Required/null/enum, boundary, ngày nghiệp vụ/timezone; expected status/message theo từng API, không quy mọi lỗi về một status chung.
- Invalid state, bản ghi VOIDED/inactive, nguồn phụ thuộc; đọc dữ liệu hạn chế theo vai trò.
- Command có idempotency: cùng key/body không tạo tác dụng lần hai; cùng key/body khác bị từ chối; replay sau mất quyền vẫn bị kiểm quyền.
- Update có version: stale version bị từ chối; không tự lấy version mới để làm test pass.
- Với thao tác nhiều bước: lỗi giữa chừng không để lại dữ liệu nửa vời. Đọc lại bằng transaction mới sau thất bại, tránh test bao ngoài `@Transactional` che lỗi ranh giới transaction.
- Với tiền/tồn/sức chứa/unique: kiểm cạnh tranh nhiều transaction ở điểm có rủi ro; test gửi tuần tự cùng key không chứng minh race đã an toàn.
- Correction/void: nguồn cũ còn lịch sử, dữ liệu suy ra được tính lại đúng, không sửa lịch sử không liên quan.
- Job: clock cố định và gọi job chủ động; chạy lại không gửi/tạo trùng. Email/payment dùng mock/Mailpit để review chức năng; live verification là bằng chứng riêng.

Tên file `*Test` hay `*IT` không tự xác định tầng test; xem dependency, DB, transaction và cách gửi request thật trong test.

## 5. Ví dụ: gói nhập đàn dùng được cho FE

Gói đầu tiên: UC-FE06-01 Register Herd Entry Voucher + phần đọc lại UC-FE06-02. Tách correction/payment/void ra gói tiếp theo nhưng công bố rõ chưa READY nếu chưa kiểm. Scope tối thiểu gồm tạo nháp, post và GET phiếu + dữ liệu bò/chuồng cần hiển thị.

| Điều kiện nghiệm thu | Bằng chứng phù hợp |
|---|---|
| Nháp hợp lệ chưa tạo đàn; post phiếu 2 dòng tạo đúng 2 bò, QR và assignment, tổng/công nợ đúng | Service/DB integration; HTTP readback trên PostgreSQL |
| Technician bị chặn ghi; ID trại B không truy cập được từ trại A | API/security test qua filter chain |
| Một dòng gây lỗi lúc ghi sổ thì cả phiếu không tạo nửa đàn, không trừ nửa sức chứa, không ghi nửa thanh toán | Rollback integration, assert lại DB sau transaction lỗi |
| Retry post cùng key/body không tạo thêm bò hoặc thanh toán; version cũ bị từ chối | API + DB theo đường gọi thật; test riêng shared idempotency có thể tái dùng cho phần chung |
| FE có thể mở lại phiếu và bò đã tạo bằng ID/code từ server | Chuỗi HTTP command → GET phiếu → GET đàn/chuồng |

Đây là ví dụ thiết kế ca kiểm, không khẳng định tất cả các ca trên đã pass. Đọc UC/SRS đầy đủ để thêm nhánh mua ngoài/bê sinh tại trại/Excel và điều kiện tương ứng. Test tham khảo: `HerdEntryPostingServiceTest`, `HerdEntryPostRollbackTest`, `HerdEntryResourceTest`; rule tiền có test `MoneyCalculatorTest`.

## 6. Dependency và thứ tự ưu tiên của cả nhóm

1. Chốt nền dùng chung: khởi động/migration, account/session/CSRF, farm context/quyền, lỗi chung, idempotency/version. Tái kiểm phần đã có, không viết lại base.
2. Đủ query/reference và lệnh nguồn: danh mục/chuồng/đàn; các nhóm chăm sóc/kho/platform có thể review song song bằng dữ liệu seed có kiểm soát.
3. Bàn giao các lát cắt vận hành nhỏ: tạo + đọc lại, rồi correction/void và phụ thuộc. Payment/stock/exit không được bỏ guard với lý do FE đang cần nối.
4. Kiểm luồng giao nhau: đẻ → bê → nhập đàn; bệnh/ngưng thuốc → xuất đàn; đàn/chuồng → feeding/report; gia hạn/đình chỉ → quyền và thông báo.
5. Báo cáo/reminder/job kiểm bằng dữ liệu nguồn đã biết đúng, gồm sửa/hủy nguồn. Có thể code/test sớm bằng fixture; nghiệm thu số liệu sau khi source contract ổn định.

Ưu tiên theo rủi ro và thứ tự FE sắp nối. Một API đọc cần cho màn tuần này có thể bàn giao trước báo cáo tổng hợp chưa ổn định. FE không phải chờ toàn bộ backend hoặc tích hợp Google/SePay live mới bắt đầu.

## 7. Khi nào gắn READY_FOR_FE?

Gói UC chỉ READY_FOR_FE khi:

- Scope đã công bố; các nhánh nằm trong gói và rule/quyền liên quan được đối chiếu; không còn lỗi chặn về truy cập, sai tiền/tồn/trạng thái hoặc mất dữ liệu.
- Test chọn lọc và hồi quy bị ảnh hưởng pass; đã kiểm luồng HTTP quan trọng trên PostgreSQL của bản tích hợp. Ghi rõ cái gì chưa test, không lấy H2 pass thay PostgreSQL.
- Đã review chéo, code hiện diện trên bản nhóm FE được phép dùng; backend chạy được ở URL/profile/commit đã nêu.
- OpenAPI khớp DTO/route của commit đó; có ví dụ request/response/lỗi, quyền, seed/precondition, cách login và version/idempotency. Endpoint phụ thuộc đã sẵn sàng hoặc ghi rõ dependency chặn.
- Breaking changes được ghi, FE liên quan biết phần nào thay thế; hạn chế mock/live và phần ngoài gói được nêu rõ.

FE bắt đầu dựng schema/adapter khi CONTRACT_DRAFT, bắt đầu nối bản đã kiểm khi READY_FOR_FE. FE xác nhận tích hợp sau khi màn và test frontend của họ qua. Các việc nhỏ không chặn có thể tồn tại dưới issue rõ ràng; không che rule sai bằng nhãn “known issue”.

Trạng thái gợi ý: `TO_REVIEW → REVIEWING → BE_REVIEWED → READY_FOR_FE → FE_INTEGRATING → FE_VERIFIED`; dùng `BLOCKED` kèm lý do/dependency khi cần. `BE_REVIEWED` nghĩa là kiểm ở nhánh đã xong nhưng chưa xác minh bản tích hợp. `FE_VERIFIED` không tự có nghĩa production-ready.

## 8. Artifact mỗi người phải để lại

Dùng [template UC](templates/BACKEND_UC_REVIEW_TEMPLATE.md) cho mỗi gói, lưu `docs/reviews/<UC-hoặc-gói>.md`:

1. Phạm vi/nguồn, acceptance criteria → test → kết quả; code/API chính và dependency.
2. Issue có expected/actual, bước tái hiện, role/farm/state/version và bằng chứng. Phân loại lỗi source / lỗi test fixture / thiếu coverage / lệch contract / yêu cầu chưa rõ / môi trường.
3. Commit, reviewer, command chạy test, thời gian, DB/version/profile, số test thực chạy và lỗi/skipped. Không chỉ ghi “577 tests green”.
4. Handoff FE: URL/commit, contract và ví dụ, seed, lỗi cần xử lý, phạm vi READY, phần pending.

Không dùng log chứa password/token/session làm bằng chứng công khai. Request mẫu dùng dữ liệu test và secret từ biến môi trường.

## 9. Chạy kiểm tra trong codebase hiện tại

Chạy ở `backend`, JDK21, dùng Maven Wrapper của repo. Ví dụ nhóm nhập đàn:

```powershell
.\mvnw.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dtest=HerdEntryPostingServiceTest,HerdEntryPostRollbackTest,HerdEntryResourceTest' test
```

Đây là chạy **danh sách lớp chỉ định**, không phải full suite hay chứng minh PostgreSQL. Đổi danh sách cho scope và dependency của mình; không chạy bốn Maven chung một checkout/target.

Export contract sau khi source/DTO đã ổn định:

```powershell
.\mvnw.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dtest=OpenApiContractTest' test
# Chỉ copy nếu test thành công.
if ($LASTEXITCODE -ne 0) { throw 'OpenAPI export failed' }
Copy-Item target\beefcare-openapi.json ..\docs\api\openapi.json
```

Các lưu ý trực tiếp từ source repo:

- Surefire cấu hình bỏ `*IT*`/`*IntTest*` khi chạy `test` mặc định; Failsafe có chúng ở `verify`. Chạy `mvn test` không tự chứng minh đã chạy các integration workflow. Chọn tường minh các lớp liên quan như ví dụ trên và kiểm báo cáo thực chạy.
- `@ServiceIntegrationTest` + `testh2` dùng H2. `@IntegrationTest` cấu hình Testcontainers là nhóm khác, trong đó có nhiều test CRUD legacy đang khóa. Không chạy tất cả rồi coi lỗi của các route đã khóa là bug nghiệp vụ, cũng không tự bỏ cả nhóm để báo xanh. Chủ nền tảng rà suite cần duy trì và ghi rõ exclusions.
- `compose.backend.yml` dùng PostgreSQL16 nhưng `config/DatabaseTestcontainer.java` hiện khai báo `postgres:18.4`. Cần thống nhất phiên bản mục tiêu trước khi coi kết quả Testcontainers là bằng chứng trên đúng DB triển khai; chưa sửa cấu hình ở đợt viết workflow này.
- JaCoCo đang được skip cho hạn chế đường dẫn Unicode trên máy này; đó là bỏ coverage instrumentation, không bỏ test. Không dùng coverage % hoặc tổng test làm điều kiện duy nhất.
- Đọc kết quả trong `target/surefire-reports` và, khi dùng Failsafe, `target/failsafe-reports`. Ghi tên suite/profile, không dựa vào hậu tố tên lớp.
- Với migration, kiểm DB mới và đường nâng cấp từ schema bàn giao trước đó trên DB kiểm thử riêng. Smoke DB mới không chứng minh upgrade giữ dữ liệu. Không reset DB nhóm hoặc sửa changeSet đã áp dụng để làm test pass.

Quy trình này không chạy thêm test hay thay source nghiệp vụ. Các bước test/publish ở trên là hướng dẫn cho thành viên thực hiện trên gói được giao.
