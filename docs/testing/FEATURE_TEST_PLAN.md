# Feature test plan

## 1. Mục tiêu và phạm vi

Tài liệu này là kế hoạch kiểm thử tối giản cho ba nhóm chức năng lõi:

- **Herd Entry (FE-06):** phiếu nhập mua ngoài và bê sinh tại trại, nháp, dòng bò, chứng từ, Excel, post, sửa/hủy và thanh toán.
- **Herd Exit (FE-13):** phiếu bán/loại thải/chết-mất/khác, nháp, cảnh báo trước xác nhận, confirm/dismiss/void và thu tiền.
- **Cattle/Herd + Cattle Detail (FE-05, liên kết FE-04):** danh sách đàn, lọc/tìm kiếm, hồ sơ bò, QR, hồ sơ thay đổi, trạng thái suy ra, chuồng hiện tại/lịch sử và timeline.

Phạm vi ưu tiên là luồng dữ liệu từ màn hình → API → nghiệp vụ backend → trạng thái bò/chuồng/phiếu. Các tab chăm sóc, sinh sản, tăng trưởng chỉ được kiểm tra khi chúng là dữ liệu/ảnh hưởng trực tiếp đến hồ sơ bò hoặc điều kiện Entry/Exit.

### Ngoài phạm vi

- Pixel-perfect/regression hình ảnh toàn bộ Figma, responsive trên mọi thiết bị, hiệu năng tải hàng nghìn con.
- Chi tiết nghiệp vụ chăm sóc, vaccine, điều trị, sinh sản, cho ăn độc lập với ba feature trên.
- FEFO/lô thức ăn; quyết định D04 xác nhận không phân bổ xuất kho theo lô.
- Thanh toán nền tảng, hoàn tiền thực tế, in/scan phần cứng và gửi email.
- Public traceability: SRS đã loại bỏ public cattle page; QR chỉ mở hồ sơ cho thành viên farm đã đăng nhập.

## 2. Thứ tự nguồn sự thật

Khi có khác nhau, dùng theo thứ tự sau:

1. `docs/REQUIREMENT_DECISIONS.md`.
2. `docs/BeefCare_Report3_SRS_2026-10-28.docx` và `docs/requirements/SRS_2026-10-28.txt` (UC/GBR/SCR/MSG).
3. Các đặc tả đã duyệt: `docs/superpowers/specs/BeefCare_FE_Chuong_Nhap_Xuat_Logic.md`, `docs/superpowers/specs/BeefCare_BE_REST_API.md`, `docs/superpowers/specs/2026-10-27-herd-data-integration-design.md`.
4. `docs/api/openapi.json`, backend source và test hiện có.
5. Frontend source/test hiện có.
6. Figma page 16, các nhóm **① Đàn bò & hồ sơ cá thể**, **② Nhập đàn theo phiếu nhập**, **④ Xuất đàn theo phiếu xuất** và **⑤ Kỹ thuật viên**, chỉ để chốt bố cục, nhãn và tương tác khi các nguồn trên chưa quy định. SRS hiện ghi một số hình là placeholder; không dùng ảnh không được tài liệu tham chiếu làm yêu cầu.

Các quyết định cần giữ trong test: giấy kiểm dịch Entry có thể bỏ trống nhưng phải cảnh báo `MSG-FE06-24`; nháp không tạo bò/chuồng/công nợ; post/confirm là transaction và idempotent; mã bò/phiếu không tái sử dụng; `EXITED`/`VOIDED` là read-only; cattle trên pending death voucher bị chặn sự kiện mới.

## 3. Test pyramid tối thiểu

| Tầng | Mục tiêu | Tỷ trọng gợi ý | Ví dụ |
|---|---|---:|---|
| Unit/helper | Parser Excel, mapping DTO, tính tiền/tổng, validation form và trạng thái cục bộ | Nhiều nhất | `ExcelModal.test.tsx`, `RowEditModal.weight.test.tsx`, API adapter tests |
| Integration/domain | Adapter ↔ HTTP; transaction và side effects cattle/pen/voucher | Vừa | `entryFilesHttp.test.ts`, `HerdEntryPostingServiceTest`, `HerdExitVoucherServiceTest` |
| REST/E2E mỏng | Role, tenant, status code, idempotency và một happy path từ endpoint | Ít nhất nhưng bắt buộc | `HerdEntryResourceTest`, `HerdExitVoucherResourceTest`, attachment/pen REST tests |

Không thêm test cho implementation detail không bảo vệ một yêu cầu hoặc invariant dữ liệu. Mọi test mutation quan trọng phải chứng minh cả trạng thái thành công và không có side effect khi bị chặn.

## 4. Bảng test đề xuất và tình trạng hiện tại

**Trạng thái:** “Đã có” chỉ dùng khi các tầng được nêu trong cột “Mức test” đều có test hiện tại bao phủ hành vi; “Một phần” = mới có một tầng/nhánh; “Chưa có” = chưa tìm thấy test đáng tin cậy. “Vị trí file dự kiến” phân biệt test đang có với nơi cần bổ sung bằng các cụm “nên thêm”/“Nên thêm”.

### 4.1 Herd Entry

| ID | Mức test | Hành vi test | Kết quả kỳ vọng | Vị trí file dự kiến | Lý do / nguồn yêu cầu | Trạng thái |
|---|---|---|---|---|---|---|
| EN-01 | Unit + integration | Tạo DRAFT, lưu đủ header/dòng/chứng từ, mở lại giữ nguyên; DRAFT không tạo cattle, pen, payment/reminder | Dữ liệu nháp khôi phục nguyên vẹn; các bảng nghiệp vụ chưa có side effect | `frontend/tests/unit/herd-entry/ImportNew.header.test.tsx`, `ImportNew.files.test.tsx`; `frontend/tests/integration/herd-entry/purchaseDraftBackend.test.tsx`; `backend/src/test/.../HerdEntryPostingServiceTest.java` | Bảo vệ khả năng khôi phục; UC-FE06-01, GBR-90 | Đã có (frontend backend-mode + adapter, backend service) |
| EN-02 | Backend integration | Post nhiều dòng vào nhiều chuồng: tạo identity, entry VALID, assignment OPEN, QR ACTIVE, tổng tiền và payment; post lại không nhân đôi | Voucher POSTED; đủ cattle/pen/QR/payment; lần hai trả kết quả cũ và không tăng số bản ghi | `backend/src/test/.../HerdEntryPostingServiceTest.java`, `HerdEntryPostRollbackTest.java`; `frontend/tests/api/featureLifecycle.test.ts` | Invariant Entry; GBR-29/90/91/92; BE REST §3.3 | Đã có |
| EN-03 | Unit + backend | Chặn thiếu trường, ngày tương lai/trước ngày sinh, tag trùng, mục đích sai sex, weight/pen/seller/payment method sai; không mutate khi lỗi | Lỗi đúng MSG/status; cattle, pen và voucher vẫn như trước | `frontend/tests/api/featureLifecycle.test.ts`; `backend/src/test/.../HerdEntryPostingServiceTest.java` | Ngăn dữ liệu không hợp lệ/partial write; MSG-FE06-03/13/16, GBR-20/21 | Đã có |
| EN-04 | Backend integration + REST | Sức chứa cộng dồn theo chuồng, tiêu chí không đạt cần lý do, rollback toàn bộ khi dòng sau lỗi, optimistic lock/role/service farm | Chặn đúng capacity/criteria/quyền/version; lỗi dòng sau rollback mọi dòng trước | `HerdEntryPostingServiceTest.java`, `HerdEntryPostRollbackTest.java`, `HerdEntryResourceTest.java` | Transaction, concurrency, authorization; MSG-FE04-05/06, MSG-COM-01/05/12 | Đã có |
| EN-05 | Unit + REST | Upload/xem/xóa PDF/JPEG hợp lệ; loại sai/MIME giả/file >10 MiB bị từ chối; upload lỗi giữ DRAFT và không post | File hợp lệ xem/xóa được; file lỗi trả 4xx; post không được gọi sau upload lỗi | `frontend/tests/unit/herd-entry/EntryDocuments.test.tsx`; `frontend/tests/api/herdEntryBackendApi.test.ts`; `backend/src/test/.../VoucherAttachmentResourceTest.java` | Chứng từ và recovery; SCR-24/75, attachment contract | Đã có |
| EN-06 | Unit + backend integration | Excel template/preview/commit: tối đa 200 dòng, 5 MiB; valid + warning được thêm, error không thêm; dry-run không ghi và preview/commit dùng cùng file | Preview phân loại đúng; commit chỉ thêm valid/warning; dry-run giữ nguyên voucher | `frontend/tests/unit/herd-entry/ExcelModal.test.tsx`; `frontend/tests/api/herdEntryBackendApi.test.ts`; `backend/src/test/.../HerdEntryImportServiceTest.java` | Ngăn import sai hàng loạt; GBR-96, MSG-FE06-18/19 | Đã có |
| EN-07 | Backend integration | Sửa một dòng có revision/tính lại tổng; void một dòng hoặc cả phiếu chỉ khi không có event khác; VOIDED đóng pen và retire QR, payment vẫn ở history | Revision có old/new; void hợp lệ đổi trạng thái/occupancy/QR; event khác bị block; payment không mất | `backend/src/test/.../HerdEntryCorrectionServiceTest.java`; `frontend/tests/api/featureLifecycle.test.ts` | Lịch sử bất biến/identity không tái sử dụng; UC-FE06-03/05, GBR-33 | Đã có |
| EN-08 | Backend integration + REST + page-in-backend-mode | FARM_BORN chỉ nhận calf pending + dam ACTIVE, không có seller/payment; register/died-before-registration và void trả calf về pending | Calf REGISTERED hoặc DIED_BEFORE_REGISTRATION đúng nhánh; không phát sinh tiền; void phục hồi pending | `frontend/tests/unit/herd-entry/ImportNew.farm-born.test.tsx`, `frontend/tests/integration/herd-entry/farmBornDraftBackend.test.tsx`; `backend/src/test/.../FarmBornEntryTest.java`, `HerdEntryResourceTest.java` | Nhánh trạng thái/transaction riêng; UC-FE06-01/02, GBR-31/93 | Đã có (frontend backend-mode + backend service/REST) |

### 4.2 Herd Exit

| ID | Mức test | Hành vi test | Kết quả kỳ vọng | Vị trí file dự kiến | Lý do / nguồn yêu cầu | Trạng thái |
|---|---|---|---|---|---|---|
| EX-01 | Unit + adapter integration + page-in-backend-mode | Tạo/lưu/mở lại DRAFT giữ type/header/dòng; chứng từ được upload sau khi có backend id; lỗi upload không confirm; type khóa sau save đầu | DRAFT mở lại đúng; upload đi trước confirm; lỗi giữ DRAFT và không confirm | `frontend/tests/unit/herd-exit/ExportDraftDocuments.test.tsx`, `LocalExitDocuments.test.tsx`; `frontend/tests/api/herdExitBackendApi.test.ts`; `frontend/tests/integration/herd-exit/draftUploadFailureBackend.test.tsx`, `successfulFlowBackend.test.tsx` | Draft recovery/thứ tự command; UC-FE13-01, SCR-42 | Đã có (frontend backend-mode + adapter) |
| EX-02 | Backend integration + REST | Select/QR chỉ thêm cattle ACTIVE chưa có DRAFT/PENDING/CONFIRMED exit; lọc theo pen/group/weight; thêm lặp là idempotent | Chỉ cattle đủ điều kiện xuất hiện/thêm được; trùng hoặc khác farm bị chặn | `backend/src/test/.../HerdExitVoucherServiceTest.java`, `HerdExitVoucherResourceTest.java`; adapter test | Tránh một con trên hai phiếu; GBR-26/35, BR-D35 | Đã có |
| EX-03 | Backend integration | Confirm sale/cull/other sau acknowledgement: mọi con EXITED, assignment đóng tại exitDate, dose/reminder hủy, case đóng, pregnancy đóng; một lỗi rollback toàn bộ | Voucher CONFIRMED và toàn bộ cattle EXITED; lỗi bất kỳ không để partial confirm | `backend/src/test/.../HerdExitVoucherServiceTest.java`, `HerdExitVoucherRollbackTest.java` | Transaction/state transition; GBR-34/35/94, MSG-FE13-02 | Đã có |
| EX-04 | Unit + REST | Chặn ngày tương lai/trước event, thiếu buyer/destination, pricing/weight/deduction/deposit sai; cảnh báo withdrawal không chặn; confirm lần hai không nhân đôi | Lỗi đúng code/status; warning hiển thị nhưng confirm được; lần hai không tạo side effect | `HerdExitVoucherServiceTest.java`, `HerdExitVoucherResourceTest.java`; `frontend/tests/api/featureLifecycle.test.ts` | Tính tiền/xác nhận an toàn; MSG-FE13-03/07, MSG-COM-16, GBR-91/92 | Đã có |
| EX-05 | Backend integration + pending-death UI | Health case DIED/MISSING tạo PENDING death/other; Owner confirm cần cause/disposal; dismiss cần lý do và cattle vẫn ACTIVE, không nhận event mới khi pending | PENDING nối đúng health case; confirm EXITED hoặc dismiss DISMISSED; pending guard hoạt động | `frontend/tests/unit/herd-exit/DeathView.checks.test.tsx`; `backend/src/test/.../HerdExitVoucherServiceTest.java`; `CattleGuardServiceTest.java`; `CareWorkflowIT.java` | Nhánh health → exit và care state; GBR-26/47/95, MSG-FE13-04 | Đã có |
| EX-06 | Backend integration + domain | Void CONFIRMED cần lý do: cattle ACTIVE, mở pen cuối nếu còn chỗ hoặc bắt chọn pen khác; item đã hủy không tự restore; collections giữ history; không void hai lần | Voucher VOIDED; cattle/pen phục hồi một lần; item bị hủy vẫn không tự restore; payment giữ history | `HerdExitVoucherServiceTest.java`, `HerdExitVoucherRollbackTest.java`; `frontend/tests/api/herdDomainApi.test.ts` | Rollback nghiệp vụ/occupancy; UC-FE13-03, GBR-36, MSG-FE13-05/09 | Đã có |
| EX-07 | Unit + REST | Collection đúng quyền (Owner only), positive whole VND, date range, không vượt outstanding, void cần reason và giữ history | Chỉ Owner ghi/void; amount/date hợp lệ; outstanding không âm; void có lý do | `backend/src/test/.../VoucherPaymentServiceTest.java`, `HerdExitVoucherResourceTest.java`; `frontend/tests/api/herdExitBackendApi.test.ts` | Sổ tiền/quyền; UC-FE13-04, GBR-91, BR-D39 | Đã có |
| EX-08 | REST + attachment integration | Manager/Technician chỉ đọc hoặc bị cấm đúng contract; tenant khác không lộ dữ liệu; attachment DRAFT sửa được, CONFIRMED chỉ đọc; version conflict trả MSG-COM-05 | Status/role/tenant/version đúng contract; attachment terminal chỉ GET được | `HerdExitVoucherResourceTest.java`, `VoucherAttachmentResourceTest.java` | Authorization/tenant/optimistic lock; role matrix BE REST §2, MSG-COM-01/05/08 | Đã có |

### 4.3 Cattle/Herd và Cattle Detail

| ID | Mức test | Hành vi test | Kết quả kỳ vọng | Vị trí file dự kiến | Lý do / nguồn yêu cầu | Trạng thái |
|---|---|---|---|---|---|---|
| CT-01 | UI/component + backend-mode integration (REST resource còn thiếu) | **SCR-18**: tìm display code/ear tag/name; dropdown **Purpose**, **Life stage**, **Health**, **Herd status**; dropdown breed/sex/pen; tabs **Herd group**; count/pagination đúng. Phải chạy với cattle backend adapter, không chỉ seed local | Đúng rows/count/filter/status/tab/page từ backend; không lẫn status không chọn; không dùng số trang/export giả | `frontend/tests/unit/cattle/CattleScr18.test.ts`, `CattleBackendRound2.test.ts`, `CattleBackendMode.test.tsx`, `CowList.backend-purpose.test.tsx`; backend service/policy tests hiện có, chưa có `CattleProfileResourceTest.java` | Cửa vào “Đàn bò”; SRS SCR-18/19, `GET /cattle`. Frontend đã có backend adapter và page-mode assertions; REST cattle resource contract vẫn là gap riêng | Đã có frontend backend-mode + adapter; REST resource còn thiếu |
| CT-02 | Domain + backend-mode page integration (REST resource còn thiếu) | GET profile trả identity, status, pen hiện tại, entry/quarantine, care/reproduction summary và quyền thao tác; EXITED/VOIDED vẫn đọc được nhưng read-only; page phải nạp qua backend adapter | DTO đủ trường; terminal profile đọc được và mọi command ghi bị ẩn/chặn trong page backend mode | `frontend/tests/unit/cattle/CowProfile.backend-exited.test.tsx`; `CattleBackendMode.test.tsx`; `backend/src/test/.../CattleProfilePolicyTest.java`, `CattleStateServiceTest.java`, `CareWorkflowIT.java`; chưa có `CattleProfileResourceTest.java` | Hồ sơ backend là nguồn duy nhất trong backend mode; SCR-19, GBR-24/26/37, `GET /cattle/{id}` | Đã có frontend backend-mode + domain; REST resource còn thiếu |
| CT-03 | Unit + backend adapter (REST resource còn thiếu) | Update profile ghi revision old/new, date không future/trước entry, tag unique, catalogue/sex-purpose hợp lệ; Manager không đổi purpose, Owner được đổi; stale version bị chặn | Update hợp lệ trả profile/version/history; lỗi đúng code và không đổi dữ liệu | `frontend/tests/unit/cattle/CattleProfileCommands.test.ts`, `CattleScr18.test.ts`; `frontend/tests/api/cattleApi.test.ts`; `backend/src/test/.../CattleProfilePolicyTest.java` | Identity/audit; UC-FE05-03, GBR-25, MSG-FE05-02/03/11/12, `PUT /profile` | Đã có frontend backend adapter + policy; REST resource còn thiếu |
| CT-04 | Unit + backend adapter/UI (REST resource và QR scan còn thiếu) | Issue/replace/resolve QR: một tag ACTIVE, tag cũ REPLACED vẫn resolve về cùng cattle, EXITED không được cấp tag; foreign farm không lộ cattle và yêu cầu switch đúng | Tag lifecycle và resolve đúng cattle/farm/status; không lộ foreign profile | `frontend/tests/unit/cattle/CattleScr18.test.ts`, `CattleBackendQrModal.test.tsx`, `QrReissueModal.test.tsx`; `frontend/tests/api/cattleApi.test.ts`; `backend/src/test/.../CattleProfilePolicyTest.java` | QR issue/resolve/tenant boundary; UC-FE05-04, GBR-28, QR tags/resolve API | Đã có issue/resolve adapter + UI; REST resource và QR scan còn thiếu |
| CT-05 | Backend integration + backend-mode UI | Pen History hiển thị current + history; move đóng assignment cũ/mở mới, giữ capacity và reason; không move EXITED/pending; toàn bộ dữ liệu dùng chung với Entry/Exit | Current/history đúng; occupancy chỉ đổi một lần; move bị chặn đúng state | `frontend/tests/unit/cattle/CattleBackendMove.test.ts`, `CattleBackendMoveModal.test.tsx`, `CowProfile.backend-exited.test.tsx`; `backend/src/test/.../PenMoveServiceTest.java`, `PenResourceTest.java`; `frontend/tests/api/herdDomainApi.test.ts` | Cattle/pen source dùng chung; SRS §10, SCR-20, GBR-20/21, pen-history/move API | Đã có backend-mode UI + adapter + backend service/resource |
| CT-06 | Backend unit/integration + UI | Timeline chỉ là projection từ source records; corrections hiện khi bật; không mất lịch sử khi correction/void; profile summary suy ra health/repro/withdrawal đúng | Timeline không mất/sửa nguồn, correction có thể xem; indicators khớp records hợp lệ | `backend/src/test/.../CattleStateServiceTest.java`, `CattleStateServiceIT.java`, `GrowthAssessmentServiceTest.java`; nên thêm `TimelineTab.test.tsx` | Tránh lưu trùng trạng thái; SCR-19/SCR-50, GBR-37/45/46/54/55 | Một phần |
| CT-07 | Integration (P2, non-release) | Shared **local prototype** collection/domain giữ cùng cattle và pen sau register → exit → void/restore; idempotent occupancy; malformed storage | Chỉ dùng làm regression cho local prototype; không thay thế backend migration/adapter và không chặn release | `frontend/tests/api/herdDomainApi.test.ts`, `client.test.ts`, `featureLifecycle.test.ts` | `2026-10-27-herd-data-integration-design.md`; sau backend migration đây là P2/non-release | P2 / không release gate |
| CT-08 | REST + file integration | Photo cattle upload/view/remove: auth/tenant, content type/size, optimistic version, EXITED/VOIDED không ghi; profile trả URL/metadata đúng. Photo cattle tối đa **5 MiB**, khác voucher attachment **10 MiB** | File hợp lệ lưu/xem/xóa; file/role/state/version lỗi bị chặn; URL không lộ storage key | **Một phần hiện có:** `backend/src/test/.../AttachmentServiceTest.java`, `LocalAttachmentStorageTest.java`; **nên thêm** `AttachmentResourceTest.java` cho REST cattle photo và frontend adapter/page test | SCR-19, SRS FE-05; cattle photo API; kiểm tra riêng giới hạn 5 MiB và voucher 10 MiB | Một phần |

## 5. Mapping màn hình, API và backend

| Nhóm | Màn hình/frontend hiện có | API contract chính | Backend owner / test hiện có |
|---|---|---|---|
| Entry | `frontend/src/features/herd-entry/pages/ImportList.tsx`, `ImportNew.tsx`, `ImportDetail.tsx`; `ExcelModal`, `RowEditModal`, documents | `GET/POST/PUT/DELETE /entry-vouchers`, `/checks`, `/post`, `/void`, `/import`, `/herd-entries/{id}`, `/payments`, voucher attachments | `HerdEntryVoucherResource`, `HerdEntryResource`, `VoucherPaymentResource`, `VoucherAttachmentResource`; `HerdEntryPostingService`, `HerdEntryImportService`, `HerdEntryCorrectionService` |
| Exit | `frontend/src/features/herd-exit/pages/ExportList.tsx`, `ExportNew.tsx`, `ExportDetail.tsx`; `PickModal`, `CollectModal`, `CancelModal`, `DeathView` | `GET/POST/PUT/DELETE /exit-vouchers`, `/selectable-cattle`, `/lines`, `/checks`, `/confirm`, `/dismiss`, `/void`, `/payments`, voucher attachments | `HerdExitVoucherResource`, `VoucherPaymentResource`, `VoucherAttachmentResource`; `HerdExitVoucherService`, `CattleGuardService` |
| Cattle/Herd | `frontend/src/features/cattle/pages/CowList.tsx`, `frontend/src/features/cattle/pages/CowProfile.tsx`; `OverviewTab`, `TimelineTab`, `BarnsTab`, `QrTab`, `UpdateModal`, `MoveModal`, `RecordEditModal` | `GET /cattle`, `/cattle/{id}`, `/timeline`, `/pen-history`, `/resolve`; `PUT /profile`; QR tags; photo; pen move; growth/care/reproduction reads | Backend: `CattleProfileResource`, `PenMoveResource`, `PenResource`, `AttachmentResource`; `CattleProfileService`, `CattleStateService`, `CattleTimelineService`, `PenAssignmentService`. Frontend `frontend/src/api/cattleApi.ts` now selects `frontend/src/api/cattleBackendApi.ts` when `VITE_BEEFCARE_DATA_SOURCE=backend`; local `createCollection('cattle', initialCows)` remains only the explicit local-prototype fallback. Backend-mode evidence is in `frontend/tests/unit/cattle/*Backend*.test.*` and `CowList.backend-purpose.test.tsx`; cattle REST resource/photo coverage remains a gap. |

### 5.1 Figma page 16 inventory có thể audit

Nguồn tham chiếu: [BEEFCARE-1--Copy-?node-id=2566-6698](https://www.figma.com/design/BmFA2ndWI434UHS38zRr3A/BEEFCARE-1--Copy-?node-id=2566-6698&p=f&t=5cq7fbaZsjBzlOcm-0). Chỉ frame `2584-4399` (Cattle overview) được biết từ handoff; các frame ID còn lại **chưa được capture/verify cục bộ**, không dùng ID phỏng đoán làm test locator.

| Nhóm page 16 | Tên screen/popup cần kiểm tra | Mapping SRS/SCR | Frame ID / trạng thái audit |
|---|---|---|---|
| ① Đàn bò & hồ sơ cá thể | Đàn bò – Danh sách; Hồ sơ bò › Tổng quan; Cập nhật hồ sơ bò; Cấp lại thẻ QR; Hồ sơ bò › Dòng thời gian; Hồ sơ bò › Lịch sử chuồng; Chuyển chuồng; Hồ sơ bò › Thẻ QR | SCR-18; SCR-19; SCR-20; SCR-50; SCR-21 | `2584-4399` = Cattle overview; các frame khác chưa verify |
| ② Nhập đàn theo phiếu nhập | Phiếu nhập – Danh sách; Phiếu nhập mới – Mua ngoài; Phiếu nhập mới – Bê sinh tại trại; Thêm/sửa con trong phiếu nhập; Nhập danh sách bò từ Excel; Chi tiết phiếu nhập; Sửa/hủy bản ghi nhập; Hủy phiếu nhập; Ghi thanh toán | SCR-23; SCR-24; SCR-25; SCR-75 và popup liên quan | Chưa verify frame ID; dùng tên trong SRS/FE spec |
| ④ Xuất đàn theo phiếu xuất | Phiếu xuất – Danh sách; Phiếu xuất mới – Bán/Loại thải/Khác; Phiếu xuất – Chết/mất (chờ xác nhận); Chọn bò vào phiếu xuất; Chi tiết phiếu xuất; Hủy phiếu xuất; Ghi thu tiền | SCR-41; SCR-42; SCR-43; SCR-76 và popup liên quan | Chưa verify frame ID; dùng tên trong SRS/FE spec |
| ⑤ Kỹ thuật viên | Các biến thể read-only của Đàn bò và Hồ sơ bò | SCR-18; SCR-19; SCR-20; SCR-21 | Chưa verify frame ID; kiểm tra action visibility/read-only, không snapshot pixel |

## 6. Dữ liệu test tối thiểu

Tạo một farm `ACTIVE`, timezone `Asia/Ho_Chi_Minh`, có Owner, Manager, Technician và một user ở farm khác. Seed:

- Pens: `A1` ACTIVE capacity 3, `B1` ACTIVE capacity 1, `E1` INACTIVE; có occupancy 0 và một case đủ để test full/criteria warning.
- Catalogues: một breed ACTIVE (Zebu đỏ), một purpose FATTENING, một BREEDING, purpose inactive và seller/buyer ACTIVE.
- Cattle: `BC-000101` ACTIVE trong A1, `BC-000102` ACTIVE với withdrawal warning, `BC-000103` EXITED, `BC-000104` VOIDED, một female có pregnancy/open case, một cattle trên PENDING death voucher.
- Voucher: Entry DRAFT 1 dòng và POSTED 2 dòng; Exit DRAFT, PENDING DEATH và CONFIRMED SALE; mỗi voucher có version để test stale update/idempotency.
- Files: cattle photo JPEG/PNG hợp lệ, MIME mismatch và boundary 5 MiB; voucher PDF/JPEG hợp lệ, MIME mismatch và >10 MiB; Excel template có 1 valid, 1 warning (thiếu birth date/tag), 1 error và file 200/201 dòng.
- Dùng ngày cố định gần `2026-10-29`; mọi test ngày nên dùng `FarmClock`, không phụ thuộc đồng hồ máy.

## 7. Tiêu chí pass và exit

### Pass cho từng test

- Kết quả và error body đúng code/status/params theo SRS/API.
- Khi command thất bại, không có cattle/pen/payment/reminder/attachment/revision mới ngoài dữ liệu được phép.
- Khi thành công, status transition, totals, audit/history, version và occupancy đúng; gọi lại idempotent không nhân đôi.
- Role và tenant isolation đúng: Owner/Manager/Technician theo matrix, farm khác không lộ dữ liệu.

### Definition of done tối giản

- **Entry:** page/facade → backend phải save/reopen DRAFT thật; attachment failure recovery; post rollback/idempotency; Excel preview/commit; farm-born. `EN-01` và `EN-08` là exit criteria bắt buộc, không chấp nhận chỉ backend-only.
- **Exit:** page/facade → backend phải đi qua draft/upload/confirm; pending health confirm/dismiss; rollback/idempotency; void/restore. `EX-01` là exit criterion bắt buộc, không chấp nhận chỉ adapter/document test.
- **Cattle:** backend adapter thật và backend-mode tests cho list/filter/pagination (`CT-01`), detail/read-only (`CT-02`), profile commands (`CT-03`), QR issue/resolve (`CT-04`) và pen history/move (`CT-05`). Cattle REST resource contract, photo REST và QR scan vẫn là phần bổ sung; không dùng local prototype làm bằng chứng backend.

Các flow trên phải xanh ở test phù hợp, không có partial state/data loss; frontend `typecheck`/build và backend targeted tests phải chạy được trong môi trường hỗ trợ DB/Testcontainers. `CT-07` local prototype không thuộc release gate.

## 8. Lệnh chạy

```bash
# Frontend feature-unit (feature worktree; chạy từ frontend/)
cd frontend
./node_modules/.bin/vitest run --passWithNoTests tests/unit/herd-entry
./node_modules/.bin/vitest run --passWithNoTests tests/unit/herd-exit
./node_modules/.bin/vitest run --passWithNoTests tests/unit/cattle
./node_modules/.bin/vitest run --passWithNoTests tests/unit/pens
./node_modules/.bin/vitest run --passWithNoTests tests/unit/auth

# Frontend post-merge integration gate (từ frontend/)
npm run test:api
./node_modules/.bin/vitest run --passWithNoTests tests/integration
npm run typecheck
npm run build

# Backend targeted unit (từ thư mục backend; không đưa *IT vào test)
cd ../backend
./mvnw -ntp -Dskip.installnodenpm -Dskip.npm \
  -Dtest='HerdEntryPostingServiceTest,HerdEntryPostRollbackTest,HerdEntryImportServiceTest,HerdEntryCorrectionServiceTest,FarmBornEntryTest,HerdExitVoucherServiceTest,HerdExitVoucherRollbackTest,VoucherPaymentServiceTest,HerdEntryResourceTest,HerdExitVoucherResourceTest,VoucherAttachmentResourceTest,PenResourceTest,PenMoveServiceTest,CattleProfilePolicyTest,CattleGuardServiceTest,CattleStateServiceTest,GrowthAssessmentServiceTest,AttachmentServiceTest,LocalAttachmentStorageTest,OpenApiContractTest' test

# Backend targeted integration (Failsafe; chạy sau unit ở integration stage)
./mvnw -ntp -Dskip.installnodenpm -Dskip.npm \
  -Dit.test='CattleStateServiceIT,CareWorkflowIT' verify

# Backend full verification
./mvnw -ntp -Dskip.installnodenpm -Dskip.npm verify
```

`frontend/package.json` hiện có `npm run test:integration` nhưng script đó chỉ
match `tests/integration/herd-entry/*.test.ts`; không dùng nó thay cho lệnh
Vitest integration ở trên. Tương tự, `backend:unit:test` hiện gọi Maven
`verify`, nên không dùng tên script đó để tuyên bố unit-only. Các lệnh
post-merge chỉ chạy sau khi user duyệt kết hợp feature trên `integration` theo
quy trình worktree.

## 9. Khoảng trống ưu tiên

1. **P0 đã xử lý trong phạm vi hiện tại:** Entry EN-01/EN-08, Exit EX-01 và pending-death checks, cùng cattle CT-01..05 đã có frontend backend-mode/adapter evidence. Không còn claim rằng cattle flow chỉ chạy trên local seed.
2. **P1 – Cattle REST/photo:** bổ sung `CattleProfileResourceTest`/REST contract và `AttachmentResourceTest` cho cattle photo; giữ giới hạn 5 MiB cho cattle photo, 10 MiB cho voucher attachment.
3. **P1 – QR scan:** chưa thấy flow scan QR hoàn chỉnh ở frontend/backend test; QR issue/replace/resolve đã có adapter/UI coverage, nhưng scan locator/permission/foreign-farm path vẫn thiếu.
4. **P1 – Contract drift:** `OpenApiContractTest` hiện chỉ smoke-check path presence (ví dụ có/không có path), chưa so sánh normalized OpenAPI đã commit; bổ sung normalized diff với `docs/api/openapi.json`.
5. **P2/non-release – Local prototype:** giữ CT-07 làm regression cho local mock sau migration, không dùng làm bằng chứng backend/release.
6. **P2 – Visual:** dùng Figma page 16 inventory ở §5.1 để thêm smoke assertions cho label, action visibility và read-only state; chưa cần snapshot pixel toàn trang.

## 10. Bằng chứng test hiện có đã rà soát

- Frontend inventory checked on **2026-11-01**: 55 test files under
  `frontend/tests` — 15 API, 30 unit, and 10 integration. Unit breakdown is
  Entry 8, Exit 5, Cattle 14, Pens 1, Auth 2; integration breakdown is Entry 4,
  Exit 4, Pens 1, Auth 1. This is an informational inventory, not a release
  gate; rerun the file count after test additions or removals. Cattle
  backend-mode evidence specifically lives in `CattleScr18.test.ts`,
  `CattleBackendRound2.test.ts`, `CattleBackendMode.test.tsx`,
  `CowList.backend-purpose.test.tsx`, `CowProfile.backend-exited.test.tsx`,
  `CattleProfileCommands.test.ts`, `CattleBackendQrModal.test.tsx`,
  `CattleBackendMove.test.ts`, and `CattleBackendMoveModal.test.tsx`.
- Backend: 22 reviewed targeted files: `HerdEntryPostingServiceTest`, `HerdEntryPostRollbackTest`, `HerdEntryImportServiceTest`, `HerdEntryCorrectionServiceTest`, `FarmBornEntryTest`, `HerdExitVoucherServiceTest`, `HerdExitVoucherRollbackTest`, `VoucherPaymentServiceTest`, `HerdEntryResourceTest`, `HerdExitVoucherResourceTest`, `VoucherAttachmentResourceTest`, `PenResourceTest`, `PenMoveServiceTest`, `CattleProfilePolicyTest`, `CattleGuardServiceTest`, `CattleStateServiceTest/IT`, `GrowthAssessmentServiceTest`, `AttachmentServiceTest`, `LocalAttachmentStorageTest`, `CareWorkflowIT`, `OpenApiContractTest`. Chưa có `CattleProfileResourceTest` và cattle-photo `AttachmentResourceTest`.
- `CareWorkflowIT` là bằng chứng bổ sung cho profile/timeline/care state được Exit đọc và đóng; `OpenApiContractTest` hiện chỉ là smoke, không phải normalized contract diff.
- Các test hiện có được dùng làm căn cứ trạng thái trong bảng; không đánh dấu “Đã có” cho Cattle list/profile REST/UI chỉ vì service policy đã được test.
