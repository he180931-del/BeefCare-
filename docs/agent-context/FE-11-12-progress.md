# FE-11 + FE-12 (Sinh sản) – tiến độ

Nhánh `feature/FE-11-12-sinh-san` tách từ `dev` 94aa6af (15/11/2026). Spec: `docs/requirements/specs/FE-11-dong-duc-phoi-giong.md`, `FE-12-mang-thai-de.md`. Người làm: TuanPQ. Phiên sau chỉ đọc file này.

## Tóm tắt (cập nhật cuối: 15/11/2026 – xong 6a, còn 6b, 6c)

- **6a xong (backend):** `ReproductionReadService` mới (A1 tiles/counts/tab/lọc; A2 status, statusSince, servicesInCycle, parity, chỉ số GBR-106, allowedActions/otherActions, criteria, window, latestBreeding, currentPregnancy, timeline chi tiết, calvings); `ReproductionCommandService` viết lại theo P1–P7; DTO theo tên trường spec (`ReproductionDtos`); changeset `20261115000100_reproduction_people.xml`; mã FE11_03..11, FE12_02/06/07/08/11/12 + câu VN/EN; BR-D14 → COM-15; OpenAPI + catalog; D36, Q5 ghi `OPEN_QUESTIONS.md`.
- Test: `ReproductionResourceTest` 40 (TC-11-01..20 trừ 21/24, TC-12-01..26 trừ 07/16/18), `ReproductionWorkflowIT`, `CattleStateServiceIT` qua.
- **Còn lại:** 6b frontend (`reproductionBackend.ts`, Q5 ở rules/CalvingPage/demo store, test `reproductionBackendApi.test.ts`), 6c chạy thật DB QA.
- Gap đã biết (chưa làm, cần chủ khác): `declaredPregnancyMonths` luôn null — phiếu nhập (FE-05, An) chưa lưu khai báo mang thai (TC-11-21). REM-02 / REM-08 do JOB-01 (`ReminderReconciliationService`) tạo, không tạo trong lệnh. TC-12-07 (đồng thời) dựa khóa dòng bò, chưa có test đa luồng; TC-12-16 (chuồng đầy) do FE-06 kiểm khi ghi sổ.
- Định nghĩa đã chọn: "chu kỳ" cho `servicesInCycle` = sau lần đẻ / sẩy thai / khám KHÔNG CÓ THAI gần nhất; `nextAction` trả mã (CONSIDER_BREEDING, PREGNANCY_CHECK, PREPARE_CALVING_PEN, MONITOR_WEIGHT) để FE dịch; tiêu chí điều kiện phối tên `MINIMUM_AGE`, `MINIMUM_WEIGHT`, `OPEN_HEALTH_CASE` (met=true nghĩa là đạt).
- Hành vi mới đáng chú ý: lỗi trường của từng bê có `params.field = calves[i].xxx` và `params.calf = i`; FE11-03 trả `params.at` (ISO) và `eventId`; sửa khám thai làm mất CÓ THAI → thai VOIDED; hủy bê cuối cùng → FE12-06 (hủy lần đẻ thay thế).

## Kế hoạch ngắn

1. **6a backend** (ReproductionCommandService, ReproductionDtos, ReproductionCommandResource, CattleStateService, mới: `ReproductionReadService`):
   - Tách phần đọc A1/A2 ra `ReproductionReadService` (tiles, counts, tab, lọc, chỉ số GBR-106, khung phối, allowedActions, timeline chi tiết, calvings). DTO mới `ReproductionDtos.Worklist*`, `ReproductionProfile*`.
   - Ghi: kiểm trùng 12 giờ + `confirmDuplicate` (động dục và phối; bỏ qua nếu phối liên kết cùng động dục với lần phối trước – R-11-08), MSG-FE11-05, FE11-04, FE11-10, FE11-09 cảnh báo, FE11-08 `parameterMissing`, BR-D14 → COM-15, observerId/performerId/examinerId/attendantId, A4 đẻ: `noTrackedPregnancy`, `registration`, bỏ bắt buộc tagCode, 1–4 bê, FE12-06/07/08, trả `calves[]`, `damStatus`.
   - Sửa/hủy: `CorrectEvent` nhận đủ trường spec (đực giống, dấu hiệu, tinh, nguồn, động dục liên kết…); phụ thuộc → FE11-07 `{dependents[]}` (thay COM-05 / FE12-02 / FE12-12 đang dùng sai chỗ).
   - Changeset mới `20261115..._reproduction_people.xml`: `reproduction_event.observer_id/performer_id/examiner_id`, `calving_event.attendant_id` (FK app_user). Không sửa changeset cũ.
   - Mã lỗi: thêm `MessageCodes.FE11_03..11`, `FE12_02/06/07/11/12`, câu tiếng Việt theo spec mục 8 vào `domain_messages_vi.properties` (+ EN).
   - Test `ReproductionResourceTest` theo TC-11-xx / TC-12-xx; sửa `ReproductionWorkflowIT` theo DTO mới; xuất OpenAPI + catalog.
2. **6b frontend** `features/reproduction/api/reproductionBackend.ts` theo mẫu `healthBackend.ts` (resolve bò, /members, /pens, /breeds, /purposes, /health-cases cho biến chứng); `reproductionApi.ts` chế độ backend trả adapter; Q5 ở `reproductionRules.ts`, `CalvingPage.tsx`, `reproductionDemoStore.ts`; test `tests/api/reproductionBackendApi.test.ts`.
3. **6c** chạy adapter với backend thật trên DB QA (`compose.qa-fixtures.yml`, cổng 15433), 9 luồng theo yêu cầu; lỗi → test hồi quy.

## Đã chốt (TuanPQ, 15/11/2026)

- P1 Có: changeset mới thêm `observer_id`, `performer_id`, `examiner_id` (reproduction_event), `attendant_id` (calving_event), nullable FK `app_user`; giữ cột chữ cho tên ngoài; observer mặc định = người ghi.
- P2 Không hỏi trùng 12 giờ khi phối cùng `linkedEstrusId` với lần phối VALID trước, hoặc `confirmDuplicate=true`.
- P3 Phụ thuộc → MSG-FE11-07 `{records, dependents[]}`; FE12-02 chỉ mâu thuẫn khám/thai; FE12-12 thai đã đóng và đẻ trùng 30 ngày.
- P4 Đẻ lần hai trong 30 ngày → chặn 409 MSG-FE12-12.
- P5 Liên kết sai bò/loại/đã hủy giữ COM-05; chỉ sớm hơn sự kiện liên kết → MSG-FE11-10.
- P6 1–4 bê.
- P7 Khám CÓ THAI không phối, không số tháng → thai OPEN không ngày, `notice: MSG-FE12-11`.
- Thêm: bỏ mặc định 283 ngày (thiếu tham số → không tính ngày, `parameterMissing`, MSG-FE11-08); khám CÓ THAI khi đã có thai OPEN → xác nhận thai đó (AF2); diễn biến thai: chi tiết bắt buộc ≤ 1.000.

## Điểm cần duyệt (đã chốt ở trên)

| # | Câu hỏi | Đề xuất |
|---|---|---|
| P1 | Người quan sát / thực hiện / khám / đỡ đẻ: thêm cột `*_id` (FK app_user) bằng changeset mới, giữ cột chữ cho tên ngoài? | Có; API nhận `xxxId \| xxxName`, trả cả hai. |
| P2 | Kiểm trùng 12 giờ cho phối: "phối lần hai có chủ ý" nhận biết thế nào? | Phối trong 12 giờ **cùng `linkedEstrusId`** với lần phối VALID trước, hoặc client gửi `confirmDuplicate=true`, thì không hỏi. |
| P3 | Lỗi phụ thuộc hiện trả MSG-FE12-02 / FE12-12 ở nhiều chỗ (hủy phối có khám liên kết, hủy khám, sửa đẻ có bê đã đăng ký…) | Đổi hết sang MSG-FE11-07 `{records, dependents[]}` theo spec; giữ FE12-02 cho mâu thuẫn khám/thai (TC-12-06/07), FE12-12 cho thai đã đóng / đẻ trùng 30 ngày (TC-12-10/19). |
| P4 | Đẻ trong 30 ngày sau lần đẻ trước: spec §3.4 "bị gắn cờ (MSG-FE12-12)", TC-12-19 "MSG-FE12-12" | Chặn 409 FE12-12 (không chỉ cảnh báo như code hiện có `warnings`). |
| P5 | Liên kết sự kiện sai (khác bò / sai loại / VOIDED) đang COM-05 `invalid_linked_event` | Giữ COM-05, chỉ đổi trường hợp thời điểm sớm hơn → FE11-10. |
| P6 | Tối đa 10 bê trong code, spec 1–4 | Theo spec: 1–4, lỗi `invalid("calves")`. |
| P7 | `estimatedMonths` không có khi Có thai và không có phối → thai OPEN không ngày + FE12-11 thông tin (TC-12-03) | Trả `episode.expectedDate=null, basis=null, notice=MSG-FE12-11`. |

## Bảng lệch spec ↔ code

Ký hiệu: RCS = `backend/.../service/ReproductionCommandService.java`, DTO = `service/dto/ReproductionDtos.java`, RES = `web/rest/ReproductionCommandResource.java`, CSS = `service/CattleStateService.java`, RRS = `service/ReproductionReminderService.java`.

### FE-11

| Mục spec | Hiện trạng code | Cần sửa | File |
|---|---|---|---|
| A1 worklist: `tab, q, penId, breedId, eligibility` → `tiles, counts, items[...]` | `GET /reproduction-worklist` trả `List<ReproductionAnimal>{cattleId, cattleCode, status, expectedCalvingDate, expectedBasis, breedingEligible, failed[]}`; không lọc, không tiles | Service đọc mới: tính 6 ô (IN_ESTRUS; trong khung REM-02; REM-03/04 đến hạn; đẻ ≤30 ngày; REM-07 ACTIVE; chờ phối chưa đạt), counts theo 6 tab (Sắp đẻ = PREGNANT có ngày ≤ CALVING_LEAD_DAYS), lọc q (mã/số tai), penId, breedId, eligibility; dòng thêm earTag, breed, pen, statusSince, latestEvent{type,date,daysAgo}, nextAction, due{date|windowFrom|windowTo} | mới `ReproductionReadService`, DTO, RES |
| A2 tab sinh sản: applicable, status, servicesInCycle, parity, lastCalving, latestWeight, declaredPregnancy, indicators, allowedActions, eligibility.criteria[], window, latestBreeding, currentPregnancy, timeline chi tiết, calvings | `history()` trả events (id, type, time, result, method, observer, performedBy, examiner), pregnancies, calvings thô; không có trạng thái, chỉ số, điều kiện, khung | Dựng đủ theo A2; timeline mỗi dòng có details (dấu hiệu, mô tả, đực/tinh, nguồn, người ghi, liên kết, estimatedMonths, kết quả), status/corrected/version; `calvings[{calvingId, at, attendant, course, damCondition, retainedPlacenta, calves[{calfId, calfNo, outcome, sex, weight, basis, tagCode, registration, cattleCode?}]}]`; indicators GBR-106 (chỉ VALID; quá hạn = POST_CALVING_DAYS + 3×ESTRUS_CYCLE_DAYS, mặc định 108) | `ReproductionReadService`, DTO, CSS (tái dùng `state()`) |
| §3.3 trạng thái: Động dục = 24 giờ chưa phối; Đã phối sau khám CHƯA RÕ; Sau sinh theo POST_CALVING_DAYS | CSS đã có 5 trạng thái, NOT_APPLICABLE, điều kiện phối (MIN_BREEDING_AGE/WEIGHT, ca OPEN) | Giữ; bổ sung `statusSince` và `criteria[{name, value, met}]` (tuổi thực, cân thực, ca OPEN) khi đọc | CSS |
| §3.5 khung phối REM-02 (+8h → +12h theo BREEDING_WINDOW_START/END_HOURS); thiếu tham số → FE11-08 | A3 không trả `window`; tham số đã có trong `FarmParameterCommandService.RANGES` | A3 trả `window{from,to}` hoặc `parameterMissing="BREEDING_WINDOW_HOURS"`; A2 trả `window{estrusAt, from, to, configured}` khi IN_ESTRUS | RCS, DTO |
| A3 động dục: `observedAt, observerId?, signs[], description?, confirmDuplicate?` | `EventCommand` dùng chung (occurredAt, observer chữ ≤100…); không kiểm trùng; không chặn thai OPEN (chỉ `assertFemaleApplicable`) | Thêm `observerId` (thành viên ACTIVE) + `confirmDuplicate`; trùng 12 giờ cùng bò → 409 `MSG-FE11-03 {event_type, cattle_code, time}`; thai OPEN → 422 `MSG-FE11-05`; description ≤1.000 (code 500) | RCS, DTO, changeset `observer_id` |
| A3/A4 BR-D14 | So với `cattle.createdAt` → COM-05 `event_before_herd_entry` | So với `HerdEntry.entryDate` (EntryLineStatus.VALID) → 422 `MSG-COM-15 {date}` như `HealthCareCommandService.assertAfterHerdEntry` | RCS (ba chỗ: recordEvent, recordCalving, correctCalving) |
| A4 phối: `bredAt, dataSource, method, sireSource, sireCattleId?, sireBreed?, semenCode?, semenSupplier?, performerId?\|performerName?, linkedEstrusId?, note?` → `{eventId, status, tentativeCalvingDate?, parameterMissing?, eligibilityWarning?}` | Tên trường `sireId, externalSireName, sireBreedId, semenBatch, supplier, performedBy, linkedEventId, description`; `setSireFields` chấp nhận `UNKNOWN`; đực sai → COM-05 `sire_must_be_active_male`; không kiểm đực = chính bò cái; linked sớm hơn → COM-05; `gestationDays` mặc định 283 khi thiếu tham số (không báo) | Nhận tên trường theo spec (giữ alias cũ nếu cần cho IT); đực phải MALE, ACTIVE, cùng trại, khác `cattleId` → 422 `MSG-FE11-04`; thời điểm trước động dục liên kết → 422 `MSG-FE11-10 {event, time}`; `performerId\|performerName`; trả `eligibilityWarning{conditions[]}` (MSG-FE11-09) khi CSS báo chưa đạt; thiếu `gestationLengthDays` → lưu, `tentativeCalvingDate=null`, `parameterMissing="GESTATION_LENGTH_DAYS"`; kiểm trùng 12 giờ (P2) | RCS, DTO, changeset `performer_id` |
| R-11-07 thiếu tham số thai → không có ngày | `gestationDays()` `orElse(283)` | Trả null khi không có FarmParameterVersion; dùng ở phối, khám, sửa | RCS |
| A5 sửa: `changes{…}` gồm đực giống, dấu hiệu, tinh, nguồn, động dục liên kết; phụ thuộc → FE11-07 `{dependents[]}` | `CorrectEvent(occurredAt, method, result, description, performedBy, examiner, observer)`; phụ thuộc → FE12-02 | Mở rộng `CorrectEvent` (source, signs, sireSource, sireCattleId, sireBreed, semenCode, semenSupplier, performerId/Name, observerId, examinerId/Name, linkedEventId, estimatedMonths); kiểm như ghi mới; đổi loại/giờ khi có bản ghi sau → 409 `MSG-FE11-07 {records, dependents[{type,id,at}]}` | RCS, DTO |
| A6 hủy: FE11-07 liệt kê phụ thuộc | `hasBlockingReproductionDependents` → FE12-02 | → `MSG-FE11-07` kèm danh sách (khám, thai, diễn biến, đẻ, bê đã đăng ký) | RCS |
| §2 quyền: chỉ Manager ghi; Owner/Technician 403 | `FarmAction.MANAGE_REPRODUCTION` đã có | Giữ; thêm test TC-11-20 | test |
| Mục 8 thông báo FE11-01…11 | `domain_messages_vi.properties` không có MSG-FE11-xx; `MessageCodes` không có FE11_* | Thêm hằng số + câu VN/EN cho FE11-03/04/05/07/08/09/10/11 (01/02/06 là toast FE) | MessageCodes, 2 file properties |

### FE-12

| Mục spec | Hiện trạng code | Cần sửa | File |
|---|---|---|---|
| A2 khám thai: `linkedBreedingId?, checkedAt, dataSource, result, method?, estimatedMonths?, examinerId?\|examinerName?, note?` → `{checkId, result, episode?{episodeId, expectedDate, basis}, reproStatus}` | `EventCommand` chung; trả `EventResult{id, type, status, version, tentativeDate, pregnancyEpisodeId, cattleVersion}`; không trả reproStatus / basis | DTO riêng hoặc alias; trả `episode{episodeId, expectedDate, basis, notice: MSG-FE12-11?}`, `reproStatus` (CSS); KHÔNG CÓ THAI → AWAITING_BREEDING (Q1 – CSS đã đúng); `examinerId\|examinerName`; thời điểm trước phối liên kết → FE11-10 | RCS, DTO, changeset `examiner_id` |
| R-12-04 xung đột → FE12-02 | Đã có cho "khám CÓ THAI mà có sự kiện VALID sau đó" và "đã có thai OPEN" (code ném sau khi `openPregnancy != null` thay vì xác nhận thai đó – AF2 nói "xác nhận thai đó") | Khám CÓ THAI khi đã có thai OPEN → gắn lần khám vào thai đó (confirm), không ném; FE12-02 chỉ khi bằng chứng cũ hơn thai hiện có (TC-12-06/07) | RCS |
| A3 diễn biến thai → `{updateId, episodeStatus, reproStatus}`; details bắt buộc ≤1.000; biến chứng chỉ ca cùng bò | Trả không có reproStatus; details ≤2.000, chỉ bắt buộc khi COMPLICATION không có ca; `occurredAt` trước khám xác nhận → COM-05 | details bắt buộc ≤1.000; thời điểm sớm → FE11-10 {event: "khám xác nhận"}; trả `reproStatus` | RCS, DTO |
| A4 đẻ: `damId, episodeId?\|noTrackedPregnancy, birthAt, dataSource, attendantId?\|attendantName?, course?, damCondition?, retainedPlacenta, calves[{outcome, sex?, birthWeightKg?, weightBasis?, tagCode?, penId?, breedId?, registration, purposeId?}]` → `{calvingId, calves[{calfNo, outcome, registration, cattleId?, cattleCode?, voucherCode?}], damStatus}` | `CalvingCommand(cattleId, birthTime, attendant chữ, course/damCondition **bắt buộc**, calves[{registerNow bool, weightUnit…}])`; `episodeId=null` → tự lấy thai OPEN; ≤10 bê; trả ids; `warnings` đẻ 30 ngày | `noTrackedPregnancy=true` → không gắn thai dù đang OPEN (R-12-11); course/damCondition tùy chọn; `registration: DRAFT\|REGISTER_NOW`; 1–4 bê → FE12-06 khi 0; cân 1–80 + cơ sở → FE12-07; thẻ trùng → FE12-08 (code dùng FE06_02); chuồng ACTIVE bắt buộc cho bê sống; mục đích theo giới tính → FE05-12; trả `calves[]` đủ, `damStatus`; đẻ thứ hai trong 30 ngày → 409 FE12-12 (P4); `attendantId\|attendantName` | RCS, DTO, changeset `attendant_id` |
| Q3/Q5 bê Đăng ký ngay không thẻ → cấp mã khi ghi sổ FARM_BORN | `makeCalf` không bắt buộc tag; `HerdEntryPostingService.issueQrTag` đã cấp `codes.nextQrTagCode` khi null (FE-06, không sửa) | Backend giữ; thêm test TC-12-15 biến thể không thẻ; FE bỏ bắt buộc (rules, CalvingPage, demo store) | test, FE |
| R-12-12 bố = đực của phối liên kết thai; REM-08 khi mẹ YOUNG_STOCK | `pendingCalves.registerCalfNow` → FE-06 xử lý; `CalfOutcome.assignedSire*` có cột | Kiểm trong test TC-12-15/18 (không sửa FE-06); nếu thiếu `assigned_sire` khi ghi đẻ thì set ở RCS `makeCalf` | RCS (chỉ set assigned*), test |
| A5 sửa/hủy khám thai: đổi sang KHÔNG CÓ THAI khi thai có bản ghi sau → FE11-07; hủy khám duy nhất chưa bản ghi sau → thai VOIDED (TC-12-21) | Có VOIDED thai khi hủy; phụ thuộc → FE12-02 | Đổi mã lỗi → FE11-07; cho đổi kết quả PREGNANT→NOT_PREGNANT khi thai chưa có bản ghi sau (thai VOIDED, R-12-16) | RCS |
| A6 sửa/hủy diễn biến thai: hủy SẨY THAI chỉ mở lại thai khi không có thai mới hơn (TC-12-25) | `assertNoLaterPregnancyEvidence` → FE12-12; `voidPregnancyUpdate` mở lại? (kiểm khi code) | Hủy LOSS: mở lại OPEN nếu không có thai OPEN/CALVED mới hơn, ngược lại giữ LOST; lỗi phụ thuộc → FE11-07 | RCS |
| A7 sửa/hủy lần đẻ: FE11-07 khi có bê đã đăng ký; hủy khi mọi bê là nháp → hủy bê nháp + REM-09 (TC-12-23) | Bê đăng ký → FE12-12 `registered_calf_*`; thay đổi giờ khi có bê đăng ký → FE12-12 | → FE11-07 `{dependents: bê đã đăng ký}`; kiểm hủy bê nháp + REM-09 đã có (`calvingVoided`) | RCS |
| A8 sửa/hủy kết quả bê: FE12-08; chặn với bê đã đăng ký; không đổi LIVE→STILLBORN khi đã đăng ký | FE12-12 `registered_calf_*`; tag trùng → FE06_02 | → FE11-07 / FE12-08 | RCS |
| Mục 8 FE12-02/06/07/11/12 (PRE-04: thiếu FE11-11, FE12-02, FE12-12) | Chỉ có MSG-FE12-08 trong properties; code ném chuỗi `"MSG-FE12-02"`, `"MSG-FE12-12"`, `"MSG-FE11-11"` không có câu VN | Thêm `MessageCodes.FE12_02/06/07/11/12`, `FE11_11` và câu VN/EN | MessageCodes, properties |
| Test | `ReproductionWorkflowIT` 3 test, `*ResourceIT` CRUD JHipster | Thêm `ReproductionResourceTest` theo TC-11-01…24 (tầng I/H/U), TC-12-01…26; sửa IT theo DTO | test |
| OpenAPI/catalog | Chưa có route/DTO mới | `OpenApiContractTest` → `docs/api/openapi.json`, `python -I docs/tools/generate_api_catalog.py` | docs |

### Frontend

| Mục spec | Hiện trạng code | Cần sửa | File |
|---|---|---|---|
| Chế độ backend | `reproductionApi.ts` ném "Chưa tích hợp dữ liệu sinh sản với backend." | `reproductionBackend.ts` nối A1–A8 (worklist, profile, estrus/breeding/check/update, calving, correction/void 4 loại); map `ReproductionFemale`, `ReproductionEvent`, `CalvingRecord` từ A2; lỗi → ô theo field (`mapReproductionError`), MSG-FE11-03 → hộp xác nhận rồi gửi lại `confirmDuplicate` | `features/reproduction/api/` |
| Q5 thẻ tai Đăng ký ngay | `reproductionRules.ts:180` bắt buộc; `CalvingPage.tsx:197` không có dấu * nhưng placeholder chỉ cho DRAFT; demo store giữ `earTag=null` | Bỏ lỗi bắt buộc, giữ ≤50 + trùng; gợi ý "Để trống thì hệ thống cấp mã khi ghi sổ phiếu nhập bê"; demo store cấp mã `BC-xxxxxx` khi REGISTER_NOW không thẻ | rules, CalvingPage, demoStore, test |
| Người quan sát / thực hiện / khám | Popup gửi tên (chữ) | Adapter tra `/members` → `xxxId` khi khớp thành viên, ngược lại `xxxName` | adapter |
| Test | 62 unit test local | `tests/api/reproductionBackendApi.test.ts` theo TC-11/TC-12; cập nhật `reproductionRules.test.ts`, `calvingRules.test.ts` cho Q5 | tests |
