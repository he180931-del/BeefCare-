# BeefCare – Đặc tả logic: Chuồng trại, Nhập đàn, Xuất đàn

> Tài liệu cho Claude Code để code nhóm tính năng **FE-04 Quản lý chuồng**, **FE-06 Nhập đàn**, **FE-13 Xuất đàn**.
> Nguồn: SRS Report 3 bản 27/10/2026 (đã bỏ mã SCR cho popup, màn đánh số SCR-01…SCR-86), ERD R01–R82, Database V1 (PostgreSQL).
> Phần 1–9 là logic đã tổng hợp để code. Phụ lục A–G trích nguyên văn SRS và DDL để tra cứu khi cần chi tiết.
> Khi phụ lục và phần tổng hợp khác nhau, **SRS (phụ lục) là chuẩn**.

---

## 0. Bối cảnh kỹ thuật

- **Ứng dụng:** web responsive, đa trại (multi-tenant). Mỗi trại là một tenant độc lập (GBR-12). **Mọi bảng nghiệp vụ có `farm_id`**, và mọi truy vấn phải lọc theo trại đang chọn.
- **Backend dự kiến:** Spring Boot 3 + Flyway + PostgreSQL 16; có file JDL cho JHipster.
  - Khóa chính là `uuid`.
  - Tiền là `bigint`, đơn vị VND chẵn.
  - Cân nặng là `numeric(7,2)` kg.
  - Bảng có thể sửa có cột `version` (optimistic lock) và `updated_at`.
- **Trạng thái** lưu dạng `text` + `CHECK`, map bằng `@Enumerated(EnumType.STRING)`.
- **Giá trị suy ra không lưu cột riêng:** chuồng hiện tại, sĩ số chuồng, trạng thái thanh toán, "chờ xuất". Đọc từ view hoặc tính trong service (GBR-24).
- **Mã nghiệp vụ** sinh từ bảng `code_sequence` theo trại và theo năm, không bao giờ dùng lại (BR-D34):

  | Đối tượng | Mẫu mã |
  |---|---|
  | Phiếu nhập | `PN-YYYY-nnnn` |
  | Phiếu xuất | `PX-YYYY-nnnn` |
  | Bò (mã hiển thị) | `BC-nnnnnn` |

---

## 1. Vai trò và quyền

| Hành động | Chủ trại (Owner) | Quản lý (Manager) | Kỹ thuật viên |
|---|---|---|---|
| Xem chuồng, sĩ số, lịch sử chuồng | ✔ | ✔ | ✔ (chỉ xem) |
| Tạo / sửa chuồng, đổi tiêu chí, ngừng / mở lại chuồng | ✔ | ✔ | ✘ |
| Chuyển chuồng (1 con hoặc nhiều con) | ✔ | ✔ | ✘ |
| Tạo / lưu nháp / ghi phiếu nhập (mua ngoài, bê sinh tại trại) | ✔ | ✔ | ✘ |
| Sửa / hủy bản ghi nhập của 1 con; hủy cả phiếu nhập | ✔ | ✔ | ✘ |
| Ghi / hủy khoản trả người bán (phiếu nhập) | ✔ | ✔ | ✘ |
| Tạo / sửa / xác nhận / hủy phiếu xuất; xác nhận hoặc bác phiếu chết / mất | ✔ | ✘ (chỉ xem) | ✘ |
| Ghi / hủy khoản thu của người mua (phiếu xuất) | ✔ | ✘ | ✘ |
| Quản lý người bán / nhà cung cấp | ✔ | ✔ | ✘ |
| Quản lý người mua | ✔ | ✘ | ✘ |

**Mọi request được bảo vệ đều kiểm tra lại** (GBR-09):
- tài khoản ACTIVE;
- membership còn hiệu lực và đúng vai trò trong trại đang chọn;
- dịch vụ trại ACTIVE.

Khi dịch vụ trại không ACTIVE thì chặn thao tác ghi và báo MSG-COM-12.

---

## 2. Mô hình dữ liệu (bảng V1)

| Thực thể SRS | Bảng | Ghi chú chính |
|---|---|---|
| Pen | `pen` | `code` duy nhất trong trại; `capacity ≥ 1`; `status` ACTIVE/INACTIVE; không xóa khi đã có lịch sử |
| Pen Reception Criteria | `pen_criteria_version` | Mỗi lần đổi tiêu chí tạo phiên bản mới; tiêu chí chỉ có tính chất **khuyến nghị** |
| Cattle | `cattle` | `internal id` (uuid) bất biến; `display_code` BC-nnnnnn; `herd_status` ACTIVE/EXITED/VOIDED |
| Pen Assignment | `pen_assignment` | Mỗi con tối đa 1 bản ghi mở (`to_date IS NULL`); các khoảng thời gian không chồng lên nhau (EXCLUDE gist); trigger chặn vượt sức chứa |
| Cattle QR Tag | `cattle_qr_tag` | Tối đa 1 thẻ ACTIVE mỗi con; ACTIVE → REPLACED / RETIRED |
| Trading Partner | `trading_partner` | Cờ `is_seller` / `is_buyer` / `is_supplier`; tên duy nhất (không phân biệt hoa thường) |
| Herd Entry Voucher | `herd_entry_voucher` | `entry_type` PURCHASE/FARM_BORN; `status` DRAFT/POSTED/VOIDED; phiếu PURCHASE bắt buộc có người bán; FARM_BORN không có tiền |
| Herd Entry (dòng phiếu nhập) | `herd_entry` | Mỗi con đúng 1 dòng VALID; `status` VALID/VOID |
| Pre-entry History Declaration | `pre_entry_history_declaration` | Khai báo lịch sử trước khi nhập theo nhóm VACCINATION/DISEASE/REPRODUCTION, trạng thái KNOWN/NONE/UNKNOWN |
| Herd Exit Voucher | `herd_exit_voucher` | `exit_type` SALE/CULL/DEATH/OTHER; `status` DRAFT/PENDING/CONFIRMED/VOIDED/DISMISSED |
| Herd Exit (dòng phiếu xuất) | `herd_exit` | Mỗi con tối đa 1 dòng mở (DRAFT/PENDING/CONFIRMED); `check_results` jsonb |
| Voucher Payment | `voucher_payment` | `direction` PAY/COLLECT; `status` RECORDED/VOIDED; tổng các khoản RECORDED ≤ tổng tiền phiếu |
| Cattle Profile Change | `cattle_profile_change` | Lịch sử thay đổi hồ sơ, chỉ thêm, không sửa |
| Record Revision | `record_revision` | Lưu giá trị trước / sau của mọi lần sửa / hủy (BR-D15), chỉ thêm, không sửa |

**View dùng sẵn:**
- `v_cattle_current_pen`: chuồng hiện tại của từng con.
- `v_herd_entry_voucher_payment`: đã trả, còn nợ, trạng thái thanh toán của phiếu nhập.

### 2.1 Chênh lệch giữa SRS 27/10 và DB V1 (cần migration V2 trước khi code)

1. **`cattle`:**
   - thêm `photo_url` (một ảnh hiện tại);
   - đổi tên `secondary_ear_tag` → `ear_tag_number` (SRS đã đổi thuật ngữ; có thể giữ tên cột và chỉ đổi nhãn hiển thị).
2. **`herd_entry`:** thêm `quarantine_until date NULL` (chỉ cho dòng EXTERNAL, không trước ngày nhập).
3. **`pre_entry_history_declaration`** (nhóm REPRODUCTION):
   - thêm `earlier_calvings smallint` (0–15);
   - thêm `pregnant_at_entry text` (YES/NO/UNKNOWN);
   - thêm `est_months_pregnant smallint` (1–9).
4. **`herd_entry_voucher.quarantine_cert_no`:** **không bắt buộc**. Thiếu thì chỉ cảnh báo MSG-FE06-24. V1 đã cho phép NULL; kiểm tra lại để không có CHECK nào bắt buộc.
5. **Phiếu nhập có khai báo "đang chửa":**
   - tạo nhắc việc REM-03 (khám thai) với hạn = ngày nhập + 7 ngày;
   - **không** mở Pregnancy Episode.

---

## 3. Máy trạng thái

### 3.1 Chuồng
```
ACTIVE ⇄ INACTIVE   (cần ngày hiệu lực ≤ hôm nay + lý do)
```
- INACTIVE: chặn **xếp mới** vào chuồng; bò đang ở trong chuồng giữ nguyên (GBR-20).
- Không xóa chuồng đã có lịch sử xếp chuồng (GBR-19).

### 3.2 Phiếu nhập và dòng nhập
```
Phiếu:  DRAFT ──post──▶ POSTED ──void──▶ VOIDED
          └──discard──▶ (xóa nháp)
Dòng:   VALID ──void 1 con / void cả phiếu──▶ VOID
```
- Phiếu DRAFT: không có hiệu lực gì. Không tạo bò, không đổi chuồng, không tạo công nợ, không tạo nhắc việc.
- Phiếu POSTED: không thêm / bớt dòng được nữa. Sửa theo **từng con** (GBR-33).

### 3.3 Phiếu xuất và dòng xuất
```
DRAFT ──confirm──▶ CONFIRMED ──void──▶ VOIDED
  └──discard
PENDING (tự sinh khi ca sức khỏe đóng với kết quả DIED/MISSING) ──confirm──▶ CONFIRMED
                                                               └──dismiss (lý do)──▶ DISMISSED
```

### 3.4 Trạng thái đàn của con bò (`herd_status`) và cờ "chờ xuất"
```
(posted entry) ─▶ ACTIVE ──confirm exit──▶ EXITED ──void exit──▶ ACTIVE
                  ACTIVE ──void herd entry──▶ VOIDED   (cuối cùng, không quay lại)
```
- **"Chờ xuất" (exit pending)** là giá trị suy ra: con bò đang nằm trên một dòng phiếu xuất PENDING.
  - Khi đó **không nhận** sự kiện chăm sóc / sinh sản mới, không chuyển chuồng, không sửa hồ sơ, không thêm vào dòng phiếu xuất khác (GBR-26, MSG-COM-17).
  - Vẫn được sửa hoặc hủy các bản ghi đã có.
- **Con EXITED hoặc VOIDED** chỉ còn xem; mọi thao tác ghi bị chặn (MSG-COM-13 cho EXITED, MSG-COM-18 cho VOIDED).

### 3.5 Xếp chuồng (Pen Assignment)
```
OPEN (to_date NULL) ──move / exit / void entry──▶ CLOSED
```
- Con ACTIVE luôn có **đúng 1** bản ghi OPEN; con EXITED hoặc VOIDED không có bản ghi OPEN nào.

### 3.6 Khoản thanh toán
```
RECORDED ──void (lý do)──▶ VOIDED      (không bao giờ sửa; ghi sai thì hủy rồi ghi lại)
```

---

## 4. Nghiệp vụ chi tiết (command → kiểm tra → tác động)

Quy ước chung cho mọi command:
- Kiểm tra quyền và trạng thái dịch vụ trại.
- Optimistic lock theo `version`; xung đột thì báo MSG-COM-05.
- Chạy trong **một transaction**.
- Ghi `audit_log_entry`.
- Sửa / hủy thì ghi `record_revision`.
- Thời điểm không được ở tương lai (MSG-COM-07). Ngày tính theo múi giờ của trại (GBR-66).

### 4.1 Chuồng (FE-04)

**CreatePen(code, name, capacity, description, criteria[], initialStatus)**
- `code`: 1–20 ký tự (chữ, số, "-"), duy nhất trong trại (MSG-FE04-02).
- `capacity`: số nguyên 1–9.999.
- `criteria`: mỗi loại tối đa 1 lần:
  - purposeTypes ⊂ {BREEDING, FATTENING, SIRE, UNDECIDED};
  - lifeStages ⊂ {UNWEANED_CALF, WEANED_CALF, YOUNG_STOCK, ADULT};
  - sex: MALE hoặc FEMALE;
  - minAgeMonths: 0–240;
  - minWeightKg: 1–1.500.
- Tác động: tạo `pen` và `pen_criteria_version` v1. Thành công báo MSG-FE04-01.

**UpdatePen**
- `capacity` ≥ sĩ số hiện tại (MSG-FE04-03).
- Đổi tiêu chí thì tạo phiên bản mới có hiệu lực từ hôm nay. Chỉ áp cho các lần xếp chuồng và gợi ý **sau đó** (GBR-21).

**ChangePenAvailability(newStatus, effectiveDate ≤ hôm nay, reason)**
- Không di chuyển bò đang ở trong chuồng. Thành công báo MSG-FE04-04.

**MovePen(cattleIds[1..n], toPenId, moveDate, reason, warningReasons{})** (UC-FE04-05)
1. Mỗi con phải ACTIVE, không ở trạng thái chờ xuất, đang có xếp chuồng mở.
2. Chuồng đích phải ACTIVE và còn đủ chỗ cho n con. Không đạt thì **chặn** (MSG-FE04-05).
3. Kiểm tra từng con với phiên bản tiêu chí hiện hành của chuồng đích. Con nào không đạt thì **cảnh báo**: muốn tiếp tục phải nhập lý do (MSG-FE04-06). Lưu `criteria version` và `warning reason` vào bản ghi xếp chuồng.
4. `moveDate` ≥ `from_date` của bản ghi đang mở và ≤ hôm nay (GBR-22).
5. Tác động: với mỗi con, đóng bản ghi cũ (`to_date = moveDate`) và mở bản ghi mới (source MOVE).
   - Khóa theo thứ tự `pen_id` để tránh 2 người cùng chuyển làm vượt sức chứa; trigger `fn_pen_capacity_guard` là lớp chặn cuối.
6. Chuyển nhầm thì sửa bằng một lần chuyển ngược với lý do "Correction".

### 4.2 Phiếu nhập – mua ngoài (FE-06, UC-FE06-01)

**SaveDraft(voucher)**
- Lưu được bất cứ lúc nào, kiểm tra ở mức tối thiểu.
- Mã phiếu cấp khi tạo nháp, hoặc khi ghi phiếu nếu nhóm muốn tránh lỗ số; vẫn tuân BR-D34.

**Header**
- `entryDate`: không ở tương lai, không trước ngày sinh của bất kỳ dòng nào (MSG-FE06-03).
- `sellerId`: bắt buộc, chọn người bán ACTIVE hoặc thêm mới ngay trên phiếu (GBR-97).
- `quarantineCertNo`: không bắt buộc. Thiếu thì cảnh báo MSG-FE06-24, không chặn ghi phiếu.
- `vehiclePlate`, `note`: không bắt buộc.
- `pricingBasis`: PER_KG (mặc định) hoặc PER_HEAD, áp chung cho mọi dòng.
- `transportFee` ≥ 0.
- `amountPaid` ≥ 0 và ≤ tổng phải trả (MSG-FE06-13).
- `paymentMethod`: bắt buộc khi `amountPaid` > 0.
- `balanceDueDate`: không bắt buộc.

**Dòng (popup "Voucher Cattle Line")**
- `earTagNumber`: duy nhất trong số bò ACTIVE của trại và các dòng khác của phiếu; để trống = gắn thẻ sau.
- `name`, `photo`, `colourMarkings`: không bắt buộc.
- `breedId`: bắt buộc, chọn giống ACTIVE.
- `sex`: bắt buộc, MALE / FEMALE.
- `birthDate` (ngày hoặc tháng-năm) **hoặc** `ageMonths` (1–240):
  - nhập tuổi thì tháng sinh = ngày nhập − tuổi, độ chính xác ESTIMATED;
  - `birthAccuracy`: EXACT / ESTIMATED / UNKNOWN.
- `lifeStage`: bắt buộc, đề xuất theo tuổi tại ngày nhập và tham số trại; sửa được.
- `productionPurposeId`: bắt buộc, chọn mục đích ACTIVE.
  - Mục đích loại SIRE chỉ cho bò đực; loại BREEDING chỉ cho bò cái (MSG-FE05-12).
- `entryWeightKg` (1–1.500) và `weightBasis` (MEASURED / ESTIMATED): bắt buộc khi tính giá theo kg. Cân ước tính hiển thị nhãn "UT".
- `receivingPenId`: bắt buộc.
  - Chuồng INACTIVE hoặc không đủ chỗ: chặn.
  - Không đạt tiêu chí: cảnh báo, cần lý do.
- `unitPrice` ≥ 0. Thành tiền dòng = đơn giá × cân (theo kg) hoặc = đơn giá (theo con).
- `quarantineUntil`: không bắt buộc, không trước ngày nhập; có nút chọn nhanh +14 / +21 ngày.
- **Lịch sử trước khi nhập** (mặc định UNKNOWN):
  - vaccination KNOWN/NONE/UNKNOWN; KNOWN thì nhập các dòng vắc-xin + ngày + nguồn thông tin;
  - diseases KNOWN/NONE/UNKNOWN; KNOWN thì nhập mô tả;
  - reproduction (chỉ bò cái) KNOWN/NONE/UNKNOWN; KNOWN thì nhập số lứa đã đẻ, đang chửa (YES/NO/UNKNOWN), số tháng chửa, mô tả.

**ImportExcel(file)** (GBR-96)
- Tối đa 200 dòng, file ≤ 5 MB.
- Mỗi dòng được kiểm tra như dòng nhập tay.
- Dòng lỗi không được thêm. Dòng chỉ có cảnh báo vẫn được thêm, kèm giá trị mặc định (ví dụ thiếu ngày sinh thì độ chính xác = UNKNOWN).
- Báo kết quả bằng MSG-FE06-18 / MSG-FE06-19.

**Post(voucherId)** – idempotent: ghi lại lần nữa trả về kết quả của lần đầu (GBR-29, GBR-90)
1. Kiểm tra lại toàn bộ header, mọi dòng và `version`. Phiếu phải có ≥ 1 dòng (MSG-FE06-16).
2. Kiểm tra sức chứa **gộp theo từng chuồng nhận** (nhiều dòng vào cùng một chuồng).
3. Trong **một transaction**, với mỗi dòng (lỗi ở bất kỳ dòng nào thì không ghi gì):
   - tạo `cattle`: id mới, `display_code` BC-nnnnnn theo sequence, `herd_status` = ACTIVE;
   - tạo `herd_entry` VALID (source EXTERNAL, ngày nhập = ngày của phiếu);
   - tạo các `pre_entry_history_declaration`;
   - vắc-xin khai báo KNOWN được lưu thành `vaccination_record` với source HISTORICAL, không tạo mũi tiêm theo lịch;
   - tạo `pen_assignment` OPEN (source HERD_ENTRY), lưu kết quả kiểm tra tiêu chí và lý do cảnh báo;
   - tạo `cattle_qr_tag` ACTIVE;
   - khai báo đang chửa thì tạo REM-03 (hạn = ngày nhập + 7 ngày);
   - số lứa đã đẻ khai báo được cộng vào số lứa (parity) của bò cái.
4. Phiếu chuyển POSTED và tính các tổng: tiền bò, tổng phải trả, đã trả, còn nợ. Khoản trả ban đầu tạo một `voucher_payment` PAY RECORDED.
5. Sau khi ghi:
   - báo MSG-FE06-01;
   - liệt kê các lịch tiêm có tiêu chí khớp với bò mới (MSG-FE06-05); **không tự thêm** bò vào lịch;
   - nếu người dùng đã chọn thì in thẻ QR.

### 4.3 Phiếu nhập – bê sinh tại trại (FARM_BORN, GBR-31, GBR-93)
- Chỉ chọn được bê sống đang ở trạng thái PENDING_CONFIRMATION (bê nháp từ sự kiện đẻ) và mẹ đang ACTIVE.
- Các trường chỉ đọc, lấy từ sự kiện đẻ: mẹ, bố, giống, giới tính, ngày sinh, cân sơ sinh.
- Người dùng chọn chuồng nhận và mục đích nuôi. Mục đích mặc định là mục ACTIVE đầu tiên thuộc loại UNDECIDED.
- Khi ghi phiếu:
  - ngày nhập = ngày sinh; giai đoạn = UNWEANED_CALF;
  - phiếu **không có tiền**, không có người bán;
  - kết quả bê chuyển REGISTERED và nối với con bò vừa tạo; REM-09 được xử lý xong.
- "Đăng ký ngay" lúc ghi sự kiện đẻ (UC-FE12-04) tự tạo và ghi luôn một phiếu FARM_BORN.
- "Bê chết trước khi đăng ký": bắt buộc nhập lý do; kết quả bê chuyển DIED_BEFORE_REGISTRATION; REM-09 được xử lý xong.

### 4.4 Sửa / hủy bản ghi nhập của 1 con (popup "Correct / Void Herd Entry", UC-FE06-03, GBR-33)
- **Sửa:**
  - Sửa được: ngày nhập (với phiếu mua ngoài thì áp cho cả phiếu), thông tin nguồn, cân nhập + cơ sở cân, đơn giá, giống, giới tính, ngày sinh + độ chính xác, khai báo lịch sử.
  - Bắt buộc nhập lý do (tối đa 500 ký tự).
  - Lưu `record_revision`; tính lại tổng tiền của phiếu (MSG-FE06-06).
  - Nếu số đã trả lớn hơn tổng mới thì báo MSG-FE06-23. Phần chênh lệch xử lý ngoài hệ thống.
- **Hủy:**
  - Chỉ hủy được khi con bò **chưa có sự kiện nào khác** ngoài việc nhập và lần xếp chuồng đầu tiên (MSG-FE06-07 / MSG-FE06-09).
  - Tác động: dòng nhập chuyển VOID; `herd_status` chuyển VOIDED; đóng xếp chuồng; thẻ QR chuyển RETIRED; dòng đó ra khỏi tổng tiền phiếu.
  - Báo xác nhận MSG-FE06-08, thành công MSG-FE06-12.

### 4.5 Hủy cả phiếu nhập (popup "Void Herd Entry Voucher", UC-FE06-05)
- Chỉ hủy được khi **mọi** con trên phiếu thỏa điều kiện hủy ở mục 4.4.
  - Có con không thỏa: báo MSG-FE06-21 kèm danh sách mã bò.
- Bắt buộc nhập lý do.
- Tác động: phiếu chuyển VOIDED; mọi dòng chuyển VOID; mọi con chuyển VOIDED (như mục 4.4).
- Các khoản đã trả vẫn giữ trong lịch sử; hoàn tiền xử lý ngoài hệ thống.
- Báo MSG-FE06-20 (xác nhận), MSG-FE06-22 (thành công).

### 4.6 Ghi trả / thu tiền (popup dùng chung "Record Voucher Payment", GBR-91, BR-D39)
- Số tiền: nguyên dương, đơn vị VND, ≤ số còn nợ / còn phải thu.
- Ngày: không trước ngày của phiếu, không ở tương lai.
- Phương thức: CASH hoặc BANK_TRANSFER.
- Không bắt buộc: tham chiếu, tệp đính kèm, ghi chú.
- Ghi sai thì **hủy** (bắt buộc lý do), không sửa.
- Quyền: phiếu nhập (PAY) do Owner hoặc Manager ghi; phiếu xuất (COLLECT) chỉ Owner ghi.
- Trạng thái thanh toán là giá trị suy ra: Chưa trả / Trả một phần / Đã trả.

### 4.7 Phiếu xuất – bán / loại thải / khác (FE-13, UC-FE13-01, GBR-34, GBR-35, GBR-94)
- **Chỉ Owner** được tạo phiếu xuất.
- Thêm bò bằng danh sách có lọc (popup "Select Cattle for Exit Voucher") hoặc quét QR.
  - Chỉ thêm được con ACTIVE, chưa nằm trên dòng phiếu xuất DRAFT / PENDING / CONFIRMED nào khác (BR-D35, MSG-FE13-08).
- **Header:**
  - `exitType`: SALE / CULL / OTHER;
  - `exitDate`: không ở tương lai, không trước ngày nhập đàn và không trước sự kiện ghi nhận gần nhất của bất kỳ con nào trên phiếu (sai thì MSG-FE13-03);
  - `buyerId` (người mua, thêm mới ngay trên phiếu được) **hoặc** nơi đến: bắt buộc (MSG-COM-06);
  - không bắt buộc: `transportCertNo`, `vehiclePlate`, `note`;
  - `pricingBasis`; `deductions` ≥ 0; `depositCollected`; `collectionDueDate`.
- **Dòng:**
  - cân xuất: mặc định = lần cân hợp lệ gần nhất, cơ sở ESTIMATED (nhãn "UT"); nhập số cân thực tế thì chuyển MEASURED;
  - đơn giá; thành tiền dòng.
  - Cân nhập và cân xuất **không** phải là bản ghi tăng trưởng (GBR-92).
- **Tổng phải thu** = tiền bò − khấu trừ; còn phải thu = tổng − các khoản thu RECORDED.
- **Kiểm tra trước khi xác nhận** (theo từng con, chỉ cảnh báo, **không chặn**). Lưu vào `herd_exit.check_results`:
  - đang trong thời gian ngưng thịt (SALE/CULL có ngày xuất trước ngày hết ngưng thì làm nổi bật, MSG-FE13-07);
  - ca sức khỏe OPEN / CHRONIC;
  - mũi tiêm và nhắc việc trong tương lai;
  - đang có thai;
  - bê nháp của con mẹ.
- Owner phải tick "Tôi đã xem các mục trên và xác nhận xuất đàn" (chưa tick thì MSG-COM-16).
- Khoản đặt cọc ≤ tổng phải thu (MSG-FE06-13).

**Confirm(voucherId)** – một transaction cho **mọi** con trên phiếu (GBR-35). Có con nào không còn ACTIVE thì không xác nhận gì:
1. `herd_status` chuyển EXITED (lưu loại xuất và ngày xuất).
2. Đóng xếp chuồng đang mở với `to_date = exitDate`.
3. Hủy các mũi tiêm theo lịch và nhắc việc có hạn sau ngày xuất.
4. Đóng ca sức khỏe OPEN / CHRONIC với kết quả CLOSED_BY_EXIT.
5. Đóng thai kỳ đang mở với lý do DAM_EXITED. Bê nháp của con mẹ **vẫn giữ trạng thái chờ**.
6. Phiếu chuyển CONFIRMED, lưu kèm khoản đặt cọc đã thu (gợi ý: lưu thành một khoản thu COLLECT RECORDED để dùng chung cách tính còn phải thu). Báo MSG-FE13-02.

### 4.8 Phiếu chết / mất (DEATH, GBR-47, GBR-95)
- **Tự sinh:** khi Manager đóng ca sức khỏe với kết quả DIED hoặc MISSING (UC-FE10-03), cùng transaction đó tạo **1** phiếu xuất PENDING (loại DEATH; mất thì loại OTHER với lý do "Missing"):
  - nối với ca sức khỏe, người báo, ngày;
  - con bò vẫn ACTIVE nhưng ở trạng thái "chờ xuất";
  - tạo REM-12 cho Owner.
- **Owner xử lý:**
  - **Xác nhận:** điền nguyên nhân và, với trường hợp chết, cách xử lý xác (tiêu hủy / chôn tại trại, giao thú y, khác) rồi xác nhận. Áp các tác động như mục 4.7.
  - **Bác:** bắt buộc nhập lý do (GBR-34). Con bò vẫn ACTIVE; ca sức khỏe giữ nguyên kết quả đã đóng.
  - REM-12 được xử lý xong trong cả hai trường hợp.
- Phiếu DEATH **không có tiền**. Owner cũng có thể tự lập phiếu DEATH trực tiếp.

### 4.9 Hủy phiếu xuất đã xác nhận (popup "Void Herd Exit Voucher", UC-FE13-03, GBR-36)
- Bắt buộc nhập lý do. Một phiếu chỉ hủy được một lần, không bao giờ xóa.
- Mỗi con trở lại ACTIVE, với một xếp chuồng mới tính từ ngày hủy, **vào chuồng cuối cùng nó đã ở**.
  - Nếu chuồng đó INACTIVE hoặc hết chỗ: Owner chọn một chuồng ACTIVE còn chỗ cho từng con bị ảnh hưởng.
- Những gì đã bị đóng / hủy lúc xuất (mũi tiêm, ca sức khỏe, thai kỳ) được **liệt kê để xem lại**, không tự khôi phục.
- Các khoản thu đã ghi vẫn giữ trong lịch sử.

---

## 5. Công thức tính và giá trị suy ra

| Giá trị | Công thức |
|---|---|
| Thành tiền dòng | PER_KG: đơn giá × cân (VND chẵn, làm tròn); PER_HEAD: đơn giá |
| Phiếu nhập: tổng phải trả | Σ thành tiền các dòng VALID + phí vận chuyển |
| Phiếu xuất: tổng phải thu | Σ thành tiền các dòng − khấu trừ |
| Còn nợ / còn phải thu | Tổng − Σ các khoản thanh toán RECORDED |
| Trạng thái thanh toán | 0 → Chưa trả; > 0 và < tổng → Trả một phần; = tổng → Đã trả |
| Sĩ số chuồng | Số bản ghi xếp chuồng OPEN của chuồng |
| Chỗ trống | Sức chứa − sĩ số |
| Chuồng hiện tại | Bản ghi xếp chuồng OPEN của con bò |
| Tuổi khi nhập | Ngày nhập − ngày sinh (hiển thị "~" khi ngày sinh là ước tính) |

---

## 6. Ràng buộc DB và đồng thời (concurrency)

- **Duy nhất:**
  - mã chuồng (`farm_id`, `code`);
  - mã phiếu PN / PX;
  - mã hiển thị bò;
  - số thẻ tai trong số bò ACTIVE (partial unique index);
  - 1 thẻ QR ACTIVE mỗi con;
  - 1 dòng nhập VALID mỗi con;
  - 1 dòng xuất mở mỗi con.
- **Không chồng lấn:** các khoảng xếp chuồng của một con (EXCLUDE gist).
- **Trigger:** `fn_pen_capacity_guard` chặn số bản ghi xếp chuồng OPEN vượt sức chứa.
- **Composite FK theo trại:** `(farm_id, x_id) → parent(farm_id, id)`, để không thể trỏ sang dữ liệu của trại khác.
- **Service khóa đúng nơi:**
  - khóa các dòng `pen` theo thứ tự id khi xếp hoặc chuyển chuồng;
  - khóa dòng `cattle` khi thêm vào phiếu xuất, khi xác nhận hoặc khi hủy;
  - so `version` khi cập nhật.
- **Idempotency:** `Post` / `Confirm` nhận `Idempotency-Key` hoặc kiểm tra trạng thái hiện tại; gửi lại thì trả kết quả cũ.

---

## 7. API REST gợi ý

```
GET    /api/farms/{farmId}/pens?status=&q=
POST   /api/farms/{farmId}/pens
PUT    /api/farms/{farmId}/pens/{penId}                (tiêu chí → phiên bản mới)
POST   /api/farms/{farmId}/pens/{penId}/availability   {status, effectiveDate, reason}
POST   /api/farms/{farmId}/pen-moves                   {cattleIds[], toPenId, moveDate, reason, warningReasons{cattleId:reason}}
GET    /api/farms/{farmId}/cattle/{id}/pen-history

GET    /api/farms/{farmId}/entry-vouchers?status=&type=&from=&to=&sellerId=
POST   /api/farms/{farmId}/entry-vouchers               (tạo nháp PURCHASE / FARM_BORN)
PUT    /api/farms/{farmId}/entry-vouchers/{id}          (sửa nháp, kèm danh sách dòng)
POST   /api/farms/{farmId}/entry-vouchers/{id}/import   (multipart .xlsx → kết quả kiểm tra từng dòng)
POST   /api/farms/{farmId}/entry-vouchers/{id}/post
DELETE /api/farms/{farmId}/entry-vouchers/{id}          (chỉ phiếu DRAFT)
POST   /api/farms/{farmId}/entry-vouchers/{id}/void     {reason}
PATCH  /api/farms/{farmId}/herd-entries/{entryId}       {changes, reason}   (sửa 1 con)
POST   /api/farms/{farmId}/herd-entries/{entryId}/void  {reason}
GET    /api/farms/{farmId}/pending-calves

GET    /api/farms/{farmId}/exit-vouchers?status=&type=
POST   /api/farms/{farmId}/exit-vouchers                (Owner)
PUT    /api/farms/{farmId}/exit-vouchers/{id}
GET    /api/farms/{farmId}/exit-vouchers/{id}/checks    (kết quả kiểm tra theo từng con)
POST   /api/farms/{farmId}/exit-vouchers/{id}/confirm   {acknowledged:true}
POST   /api/farms/{farmId}/exit-vouchers/{id}/dismiss   {reason}   (chỉ phiếu PENDING)
POST   /api/farms/{farmId}/exit-vouchers/{id}/void      {reason, penOverrides{cattleId:penId}}

POST   /api/farms/{farmId}/vouchers/{type}/{id}/payments        {date, amount, method, reference}
POST   /api/farms/{farmId}/payments/{paymentId}/void            {reason}
GET/POST /api/farms/{farmId}/trading-partners
```
Lỗi trả về theo dạng `{code: "MSG-FE04-05", params:{...}}`, để frontend lấy câu thông báo ở Phụ lục E.

---

## 8. Màn hình liên quan (SRS 27/10)

| Mã | Màn / popup | Mục SRS |
|---|---|---|
| SCR-17 | Danh sách và chi tiết chuồng (có chọn nhiều con → "Move selected") | III.4.1 |
| popup | Tạo / sửa chuồng; Ngừng / mở lại chuồng; Chuyển chuồng | III.4.2–4.4 |
| SCR-20 | Tab hồ sơ bò – Lịch sử chuồng | III.5.3 |
| SCR-23 | Danh sách phiếu nhập | III.6.1 |
| SCR-24 | Phiếu nhập mua ngoài | III.6.2 |
| SCR-25 | Phiếu nhập bê sinh tại trại | III.6.4 |
| popup | Dòng bò trong phiếu; Nhập từ Excel; Sửa / hủy bản ghi nhập; Hủy phiếu nhập; Ghi thanh toán | III.6.3, 6.5, 6.6, 6.8, 6.9 |
| SCR-75 | Chi tiết phiếu nhập | III.6.7 |
| SCR-41 | Danh sách phiếu xuất | III.13.1 |
| SCR-42 | Phiếu xuất (bán / loại thải / khác) | III.13.2 |
| SCR-43 | Phiếu xuất chết / mất | III.13.3 |
| popup | Chọn bò vào phiếu xuất; Hủy phiếu xuất | III.13.4–13.5 |
| SCR-76 | Chi tiết phiếu xuất | III.13.6 |

Figma Layout: tab 16 "Trại – Đàn bò, Nhập/Xuất & Chuồng (Redesign)".

---

## 9. Kịch bản kiểm thử nghiệm thu (tối thiểu)

1. **Ghi phiếu mua ngoài 3 con vào 2 chuồng:** tạo đủ 3 con, 3 dòng nhập, 3 bản ghi xếp chuồng OPEN và 3 thẻ QR; tổng phải trả đúng; khoản trả ban đầu được ghi.
2. **Ghi phiếu khi một chuồng chỉ còn 1 chỗ mà có 2 dòng vào chuồng đó:** chặn MSG-FE04-05; không tạo gì.
3. **Dòng không đạt tiêu chí chuồng:** không có lý do thì không ghi được; có lý do thì lưu lý do vào bản ghi xếp chuồng.
4. **Ghi phiếu 2 lần** (bấm đúp hoặc reload): chỉ có 1 bộ dữ liệu.
5. **Thiếu số giấy kiểm dịch:** vẫn ghi được, hiện cảnh báo MSG-FE06-24.
6. **Khai báo bò cái đang chửa ~4 tháng:** có REM-03 hạn = ngày nhập + 7 ngày; không có thai kỳ (Pregnancy Episode).
7. **Hủy 1 con vừa nhập chưa có sự kiện:** con đó VOIDED, thẻ QR RETIRED, tổng tiền phiếu giảm. Con đã có lần cân thì không hủy được (MSG-FE06-07).
8. **Hủy cả phiếu khi 1 con đã có sự kiện:** báo MSG-FE06-21 kèm mã bò đó.
9. **Ghi khoản trả vượt số còn nợ:** bị chặn (BR-D39). Hủy khoản trả thì số còn nợ tăng lại.
10. **Chuyển 5 con vào chuồng còn 4 chỗ:** chặn. 2 người cùng chuyển vào chỗ cuối cùng: chỉ 1 người thành công.
11. **Chuyển chuồng với ngày trước `from_date` hiện tại:** bị chặn.
12. **Xác nhận phiếu xuất SALE có 1 con đang ngưng thịt:** hiện cảnh báo nổi bật; tick xác nhận rồi thì xác nhận được. Kết quả: con EXITED, xếp chuồng đóng, mũi tiêm tương lai bị hủy, ca bệnh đóng với CLOSED_BY_EXIT.
13. **Thêm vào phiếu xuất một con đang nằm trên phiếu DRAFT khác:** bị chặn.
14. **Đóng ca sức khỏe với kết quả DIED:** có phiếu PENDING và REM-12; con bò chặn sự kiện mới. Bác phiếu thì con vẫn ACTIVE; xác nhận thì con EXITED.
15. **Hủy phiếu xuất khi chuồng cũ đã INACTIVE:** bắt Owner chọn chuồng khác; con quay lại ACTIVE; các mục đã đóng lúc xuất không tự khôi phục.
16. **Manager gọi API xác nhận phiếu xuất:** trả 403.
17. **Trại có dịch vụ EXPIRED:** mọi thao tác ghi bị chặn (MSG-COM-12).

---


## Phụ lục A – Mô tả màn hình và popup (SRS Part III, nguyên văn)

### 4. FE-04 Pen Management
#### 4.1 SCR-17 Pens
> Hình: Mockup – Figma 05 › "Chuồng trại – danh sách & chi tiết"

This screen allows farm members to view pens, occupancy, reception criteria and the cattle in each pen (UC-FE04-01). The Owner and Managers can also create and edit pens (UC-FE04-02, UC-FE04-03), stop or resume a pen (UC-FE04-04) and move selected cattle (UC-FE04-05). Technicians see the screen read-only.
**Field Description**

| Field Name | Description |
|---|---|
| Header | "n pens · used/total places in use" (sum of headcounts / sum of capacities of ACTIVE pens). |
| Create pen | Button (Owner, Manager); opens popup "Create / Edit Pen". |
| Search | Text; matches pen code or name. |
| Status | Dropdown: All, ACTIVE, INACTIVE. |
| ***Pen list*** | |
| Pen | Pen code (sortable). |
| Name | Pen name. |
| Headcount / Capacity | e.g. 58 / 64; highlighted when free places are 0. |
| Accepts | Summary of accepted purpose types and life stages, "All" when no criteria. |
| Status | ACTIVE / INACTIVE. |
| ***Pen detail*** | |
| Edit / Stop using (Resume) | Buttons (Owner, Manager); open popup "Create / Edit Pen" / popup "Stop / Resume Pen". |
| Capacity, Headcount, Free places | Read-only numbers. |
| Reception criteria | Read-only: version and effective date; one row per criterion (type, condition, value). |
| Cattle in pen | List: cattle code, short situation (for example "Pregnant 5 months", "Bred 12 days ago", "Vaccination due"), checkbox for selection. |
| Move selected | Button (Owner, Manager); opens popup "Move Pen" for the selected cattle. |
| View all n cattle | Link to SCR-18 filtered by the pen. |

#### 4.2 Popup: Create / Edit Pen
> Hình: Mockup – Figma 05 › "Tạo / sửa chuồng"

Opened from: SCR-17 Pens.
This dialog allows the Owner or a Manager to create a pen (UC-FE04-02) or edit it (UC-FE04-03). Pen code and capacity follow GBR-19 and BR-D12; a change of criteria is saved as a new version from today (GBR-21).
**Field Description**

| Field Name | Description |
|---|---|
| Pen code * | Text, 1–20 characters: letters, digits and "-"; unique in the farm (MSG-FE04-02). |
| Pen name * | Text, max 100 characters. |
| Capacity * | Whole number 1–9,999; when editing, not below the current headcount (MSG-FE04-03). |
| Description | Long text, max 500 characters. |
| ***Reception criteria (new version from today)*** | |
| Criterion type | Dropdown: Purpose type, Life stage, Sex, Minimum age (months), Minimum weight (kg). Each type at most once. |
| Condition / Value | Purpose type: multi-select of Breeding, Fattening, Sire, Undecided; Life stage: multi-select of Unweaned calf, Weaned calf, Young stock, Adult; Sex: Male, Female; Minimum age: whole number 0–240; Minimum weight: number 1–1,500. |
| + Add criterion / Remove | Buttons. No criterion means the pen accepts any cattle. |
| Initial status | Create only: ACTIVE (default) or INACTIVE. Later changes use popup "Stop / Resume Pen". |
| Cancel / Save pen | Buttons; success MSG-FE04-01. |

#### 4.3 Popup: Stop / Resume Pen
> Hình: Mockup – Figma 05 › "Ngừng / mở lại sử dụng chuồng"

Opened from: SCR-17 Pens.
This dialog allows the Owner or a Manager to stop or resume new placements in a pen (UC-FE04-04). Cattle already in the pen stay there (GBR-20).
**Field Description**

| Field Name | Description |
|---|---|
| Pen | Read-only code, name and headcount / capacity. |
| Current status | Read-only badge. |
| New status * | INACTIVE (stop) or ACTIVE (resume); the opposite of the current status. |
| Effective date * | Date, default today, not in the future. |
| Reason * | Long text, max 500 characters. |
| Cancel / Confirm | Buttons; success MSG-FE04-04. |

#### 4.4 Popup: Move Pen
> Hình: Mockup – Figma 05 › "Chuyển chuồng"

Opened from: SCR-17 Pens; SCR-20 Profile tab – Pen History; SCR-44 Farm Reminders.
This dialog allows the Owner or a Manager to move one or several cattle to another pen (UC-FE04-05).
**Field Description**

| Field Name | Description |
|---|---|
| Cattle | Read-only: one cattle (code, breed, sex, age, latest weight) or the list of selected cattle. |
| From pen | Read-only current pen code – name and headcount / capacity. |
| Destination pen * | Dropdown of ACTIVE pens with headcount / capacity; the current pen is excluded. |
| Move date * | Date, default today; not before the start of the current assignment and not in the future (MSG-FE04-09). |
| Performed by | Dropdown of ACTIVE farm members, default the user. |
| Reason * | Long text, max 500 characters. Reason "Correction" marks a reverse move. |
| ***Reception check*** | |
| Check / Result | Rows: "Destination ACTIVE and has n free places", "Purpose type matches", "Life stage matches", "Sex matches", "Minimum age / weight" – each Met, Not met or Not applicable, per cattle. INACTIVE or full: MSG-FE04-05 and Confirm is disabled. |
| Warning reason * | Shown when a criterion is not met (MSG-FE04-06); long text, max 500. |
| Cancel / Confirm move | Buttons; success MSG-FE04-08. |

#### 5.3 SCR-20 Profile tab – Pen History
> Hình: Mockup – Figma 05 › "Hồ sơ bò › Lịch sử chuồng"

This tab shows the current pen and pen history of the cattle (UC-FE04-01, UC-FE05-02) and lets the Owner or a Manager start a move (UC-FE04-05).
**Field Description**

| Field Name | Description |
|---|---|
| Current pen | Pen code – name, since date, headcount / capacity, reception criteria summary. |
| Move pen | Button (Owner, Manager); opens popup "Move Pen". |
| ***Pen history*** | |
| Pen | Pen code – name. |
| From / To | Dates; "—" for the open assignment. |
| Reason | Placement or move reason; warning reason when criteria were not met. |
| Recorded by | Member name. |

### 6. FE-06 Herd Entry Management
Every receipt of cattle is recorded as a herd entry voucher (GBR-90): a purchase voucher of one or more bought-in cattle with prices and payments, or a voucher of farm-born calves. A DRAFT voucher has no effect; posting creates the cattle. Payments to the seller are recorded with the shared dialog popup "Record Voucher Payment".
#### 6.1 SCR-23 Herd Entry Vouchers
> Hình: Mockup – Figma 05 › "Phiếu nhập – Danh sách"

This screen allows the Owner or a Manager to view herd entry vouchers (UC-FE06-02), create or continue a voucher (UC-FE06-01) and open a voucher's detail.
**Field Description**

| Field Name | Description |
|---|---|
| Pending calves (n) | Button; opens SCR-25 with the PENDING_CONFIRMATION calves. |
| Create entry voucher | Button; opens SCR-24. |
| Status tabs | All, Draft, Posted, Voided, each with its count. |
| Period | Date range of the entry date, default from the start of the previous quarter to today. |
| Entry type | All, Purchase, Farm-born calves. |
| Source | All or one trading partner. |
| ***Summary tiles*** | |
| Posted vouchers | Count in the period; number of DRAFT vouchers not yet posted. |
| Cattle entered | Count, split into purchased and farm-born. |
| Purchase amount | Total payable of POSTED purchase vouchers, including transport fees. |
| Owed to sellers | Sum of outstanding amounts and the vouchers concerned. |
| ***Voucher list*** | |
| Voucher code | PN-YYYY-nnnn (sortable); link to SCR-75 (POSTED, VOIDED) or SCR-24 / SCR-25 (DRAFT). |
| Entry date | Sortable. |
| Entry type | Purchase / Farm-born calves. |
| Source / dam | Seller name and quarantine certificate number, or the dams of the calves. |
| Cattle | Number of cattle; number with estimated weight. |
| Total weight | kg. |
| Total amount (đ) | Total payable; "—" for farm-born calves. |
| Outstanding (đ) | Amount still owed to the seller. |
| Status | DRAFT / POSTED / VOIDED (with the void reason). |
| Actions | "Continue" (DRAFT) or "View". |
| Note | Read-only: a DRAFT voucher creates no cattle and changes no pen or balance; a POSTED voucher is corrected per cattle (popup "Correct / Void Herd Entry") and voided as a whole only when no cattle has other events (GBR-33). |

#### 6.2 SCR-24 Herd Entry Voucher – Purchase
> Hình: Mockup – Figma 05 › "Phiếu nhập mới – Mua ngoài (theo phiếu)"

This screen allows the Owner or a Manager to enter a purchase voucher, save it as draft and post it (UC-FE06-01). A side panel shows the voucher summary, the pen occupancy changes and the pre-save checks.
**Field Description**

| Field Name | Description |
|---|---|
| Entry type | Tabs Purchase (this screen) / Farm-born calves (SCR-25); fixed after the first save. |
| ***1. Voucher information*** | |
| Voucher code | Read-only, next PN-YYYY-nnnn (BR-D34). |
| Entry date * | Date, not in the future, not before the birth date of any line (MSG-FE06-03). |
| Seller / previous owner * | Searchable dropdown of ACTIVE trading partners with phone; "+ Add new source" (name, phone, area) (GBR-97). |
| Quarantine certificate no. | Text, max 50, optional. When empty the checks panel shows the warning "No quarantine certificate" (MSG-FE06-24); posting is not blocked. |
| Vehicle plate | Text, max 20, optional. |
| Receiving note | Long text, max 1,000. |
| ***2. Cattle in the voucher*** | |
| Import from Excel | Button; opens popup "Import Cattle from Excel" (GBR-96). |
| + Add cattle | Button; opens popup "Voucher Cattle Line". |
| Pricing basis * | Per kg (default) / Per head, for all lines (GBR-92). |
| # / Ear tag | Line number; ear tag number or "Tag later". |
| Breed · sex | From the line. |
| Life stage · purpose | Life stage and production purpose of the line. |
| Age | Approximate age at the entry date. |
| Weight | Entry weight in kg; "UT" when the basis is Estimated. |
| Receiving pen | Dropdown of ACTIVE pens with headcount / capacity. |
| Unit price | đ/kg or đ/head depending on the pricing basis. |
| Line amount | Calculated (GBR-91). |
| ⋯ | Edit line (popup "Voucher Cattle Line") / Remove. |
| Totals row | Number of cattle, total weight, cattle amount. |
| ***3. Attachments*** | |
| Files | Drag and drop or choose files (quarantine certificate, invoice, photos); PDF or JPG, max 10 MB each; view or remove. |
| ***4. Payment*** | |
| Cattle amount | Read-only sum of line amounts. |
| Transport fee | Number ≥ 0, whole VND. |
| Total payable | Read-only: cattle amount + transport fee. |
| Amount paid | Number ≥ 0, not greater than total payable (MSG-FE06-13). |
| Outstanding | Read-only: total payable − amount paid. |
| Payment method | Cash / Bank transfer; required when an amount is paid. |
| Balance due date | Date, optional. |
| ***Summary panel*** | |
| Voucher summary | Number of cattle, total weight (estimated count), receiving pens with occupancy before → after, status DRAFT. |
| Checks before saving | Ear tags unique among the farm's cattle; pen criteria met per line; pen capacity sufficient; entry date valid. Warnings: estimated weights; a pen that will be full (MSG-FE06-17); no quarantine certificate (MSG-FE06-24). |
| Print QR tags after saving | Checkbox, default on. |
| Save & create n cattle | Button; posts the voucher (MSG-FE06-01, then MSG-FE06-05 when schedules match) and opens the voucher detail (SCR-75). |
| Save draft / Cancel | Buttons; MSG-FE06-10 / MSG-COM-14. A DRAFT can be discarded from this screen. |

#### 6.3 Popup: Correct / Void Herd Entry
> Hình: Mockup – Figma 05 › "Sửa / hủy bản ghi nhập đàn"

Opened from: SCR-23 Herd Entry Vouchers; SCR-75 Herd Entry Voucher Detail.
This dialog allows the Owner or a Manager to correct the herd entry of one cattle or void it (UC-FE06-03).
**Field Description**

| Field Name | Description |
|---|---|
| Record | Read-only: cattle, voucher code, entry date, recorder. |
| Action * | Correct record (default) / Void record. Void is offered only when the cattle has no event other than its entry and first placement; it sets herd status VOIDED and retires the QR tag (GBR-33). |
| ***Correction table*** | |
| Field / Current value / New value | Rows: Entry date (purchase voucher: applies to all its cattle), Source information, Entry weight and basis, Unit price, Breed, Sex, Birth date and accuracy, History declarations ("Edit" opens the history form of popup "Voucher Cattle Line"). Only changed rows are saved; voucher totals are recalculated. |
| Reason * | Long text, max 500. |
| Cancel / Save | Buttons; correction MSG-FE06-06; void confirmation MSG-FE06-08 and success MSG-FE06-12; not allowed MSG-FE06-07 / MSG-FE06-09; overpayment notice MSG-FE06-23. |

#### 6.4 SCR-25 Herd Entry Voucher – Farm-born Calves
> Hình: Mockup – Figma 05 › "Phiếu nhập mới – Bê sinh tại trại"

This screen allows the Owner or a Manager to register live calves from recorded calvings in one voucher (UC-FE06-01 AF1) and to see the calves still waiting for registration (UC-FE06-02).
**Field Description**

| Field Name | Description |
|---|---|
| ***1. Voucher information*** | |
| Voucher code | Read-only, next PN-YYYY-nnnn. |
| Voucher date * | Date, default today. The entry date of each calf is its birth date (GBR-93). |
| Note | Long text, max 1,000. |
| ***2. Select pending calves*** | |
| Selection | Checkbox per calf; header shows "n / m calves selected". |
| Calf · tag | Calf number and tag code entered at calving, or "Not tagged" (a code and QR are issued at posting). |
| Dam · sire | Dam code; sire code, semen code or "Unknown" (GBR-31). |
| Birth date, Sex, Birth weight | Read-only from the calving; "UT" when the weight is estimated. |
| Receiving pen * | Dropdown of ACTIVE pens; default the pen chosen at calving. |
| Production purpose * | Dropdown of ACTIVE purposes; default the first ACTIVE purpose of type Undecided; SIRE only for males and BREEDING only for females (MSG-FE05-12). |
| Mark died before registration | Row action; reason required; closes the calf outcome and resolves REM-09. |
| ***3. Attachments*** | Optional photos or birth records; PDF or JPG, max 10 MB each. |
| ***Summary panel*** | Number of calves, total birth weight, receiving pens with occupancy before → after, life stage Unweaned calf, status DRAFT; "No price or payment for farm-born calves". |
| Checks before saving | Calves still PENDING_CONFIRMATION; tags unique; pens with enough places; dams ACTIVE. |
| Print QR tags after saving | Checkbox, default on. |
| Save & create n cattle / Save draft / Cancel | Buttons; MSG-FE06-01 then the voucher detail (SCR-75); MSG-FE06-10 then the voucher list (SCR-23); already registered MSG-FE06-02. |

#### 6.5 Popup: Voucher Cattle Line
> Hình: Mockup – Figma 05 › "Thêm / sửa con trong phiếu nhập"

Opened from: SCR-24 Herd Entry Voucher – Purchase.
This dialog allows the Owner or a Manager to enter or edit one cattle line of a draft purchase voucher (UC-FE06-01). No cattle is created until the voucher is posted.
**Field Description**

| Field Name | Description |
|---|---|
| Ear tag number | Text, max 30; unique among ACTIVE cattle and other lines; empty = tag later. |
| Name | Text, max 50, optional. |
| Photo | JPG or PNG, max 5 MB, optional; becomes the cattle's photo at posting. |
| Colour and markings | Text, max 255, optional; recommended when the ear tag is left empty, so that the animal can be told apart in the lot. |
| Breed * | Dropdown of ACTIVE breeds. |
| Sex * | Male / Female. |
| Birth date or age | Enter either a day or month-year, or the estimated age at entry in months (1–240, e.g. from teeth or the seller's information). An age sets the birth month = entry date − age, with accuracy Estimated. Shows the approximate age at entry. |
| Birth date accuracy | Exact / Estimated / Unknown; set to Estimated when an age is entered. |
| Life stage * | Dropdown; proposed from the age at entry using the farm's life-stage ages (GBR-25); editable. |
| Production purpose * | Dropdown of ACTIVE purposes with purpose type; SIRE only for males and BREEDING only for females (MSG-FE05-12). |
| Entry weight (kg) * | Number 1–1,500 (required for per-kg pricing). |
| Weight basis * | Measured / Estimated. |
| Receiving pen * | Dropdown of ACTIVE pens with headcount / capacity; reception check result shown (GBR-20, GBR-21); a warning reason is required when a criterion is not met. |
| Unit price / Line amount | Number ≥ 0 / read-only calculated amount. |
| Quarantine until | Date, optional, not before the entry date; quick choices "+14 days" and "+21 days". Shown on the profile while active. |
| ***History before entry*** | |
| Vaccination * | Known / None / Unknown (default Unknown). When Known: rows of vaccine (ACTIVE vaccine or free text), date (day or month, optional) and information source; saved as HISTORICAL vaccination records without scheduled doses (GBR-30). |
| Known diseases * | Known / None / Unknown; description when Known (max 1,000). |
| Reproduction * | Females only. Known / None / Unknown. When Known: number of earlier calvings (0–15), pregnant at entry (Yes / No / Unknown), estimated months pregnant (1–9, when Yes) and description (max 1,000). A declared pregnancy creates the pregnancy-check reminder REM-03 (GBR-30). |
| Remove from voucher / Cancel / Save line | Buttons. |

#### 6.6 Popup: Import Cattle from Excel
> Hình: Mockup – Figma 05 › "Nhập danh sách bò từ Excel"

Opened from: SCR-24 Herd Entry Voucher – Purchase.
This dialog allows the Owner or a Manager to add many cattle lines to a draft purchase voucher from a file (UC-FE06-01 AF3).
**Field Description**

| Field Name | Description |
|---|---|
| Download template | Button; .xlsx with the columns Ear tag, Breed, Sex, Birth date or Age (months), Accuracy, Colour and markings, Weight, Weight basis, Pen, Purpose, Unit price, Quarantine until. |
| Select file * | .xlsx, max 200 data rows, max 5 MB; file name and number of rows; "Change file". |
| ***Check result*** | |
| Row / Ear tag / Breed · sex / Weight / Pen | Values read from each row. |
| Result | Valid / Warning (with the default applied, e.g. missing birth date saved as Unknown) / Error (with the reason, e.g. ear tag already used, pen does not accept the sex or is full). |
| Summary | "n rows: x valid (y with warnings) · z with errors" (MSG-FE06-18). Rows with errors are not added. |
| Cancel / Add n cattle to the voucher | Buttons; MSG-FE06-19. |

#### 6.7 SCR-75 Herd Entry Voucher Detail
> Hình: Mockup – Figma 05 › "Chi tiết phiếu nhập – Đã nhập"

This screen allows the Owner or a Manager to view a posted or voided entry voucher (UC-FE06-02), record a payment (UC-FE06-04), correct one cattle (UC-FE06-03) or void the voucher (UC-FE06-05).
**Field Description**

| Field Name | Description |
|---|---|
| Header | Voucher code, status badge; buttons "Print voucher" and "Void voucher" (POSTED only, popup "Void Herd Entry Voucher"). |
| ***Voucher information*** | Entry date, entry type, quarantine certificate, seller and contact, vehicle plate, created/posted by and time, note. |
| ***Cattle in the voucher*** | |
| Cattle code / Ear tag | Display code (link to SCR-19) and ear tag number. |
| Breed · sex, Entry weight, Receiving pen | From the line. |
| Current | Herd status and current pen (e.g. ACTIVE · B2, EXITED, VOIDED). |
| Line amount | đ. |
| Actions | "Correct herd entry" (popup "Correct / Void Herd Entry") for VALID entries of ACTIVE cattle. |
| Totals row | Number of cattle, total weight, cattle amount. |
| Attachments | List with "View". |
| ***Payment*** | Cattle amount, transport fee, total payable, amount paid, outstanding; payment list (date, method, amount, reference, recorded by; VOIDED payments struck through). "Record payment" opens popup "Record Voucher Payment" while outstanding > 0. |
| ***Voucher history*** | Chronological entries: created, posted (cattle codes created), QR printed, payments recorded or voided, corrections, void. |

#### 6.8 Popup: Record Voucher Payment
> Hình: Mockup – Figma 05 › "Ghi nhận thanh toán phiếu nhập", "Ghi nhận thu tiền phiếu xuất"

Opened from: SCR-75 Herd Entry Voucher Detail; SCR-76 Herd Exit Voucher Detail; SCR-78 Feed Receipts.
This shared dialog records a payment to a seller (UC-FE06-04) or feed supplier (UC-FE23-02), or a collection from a buyer (UC-FE13-04), against a voucher.
**Field Description**

| Field Name | Description |
|---|---|
| Title | "Record payment – PN-…" (pay the seller), "Record payment – PNK-…" (pay the supplier) or "Record collection – PX-…" (collect from the buyer), with the partner name. |
| Total / Paid or collected / Outstanding | Read-only amounts of the voucher. |
| Payment date * | Date, not in the future, not before the voucher date. |
| Amount (đ) * | Whole VND > 0, not greater than the outstanding amount (MSG-FE06-13). |
| Method * | Cash / Bank transfer. |
| Reference / transfer content | Text, max 100. |
| Attachment | Transfer slip or statement; PDF or JPG, max 10 MB. |
| Note | Text, max 500. |
| Information | Outstanding after saving; "A recorded payment is only voided with a reason and stays in the history. This is the farm's cash record, not a tax invoice." (GBR-91). |
| Cancel / Save | Buttons; MSG-FE06-14. In the payment list of the voucher a payment can be voided with a reason (MSG-FE06-15). |

#### 6.9 Popup: Void Herd Entry Voucher
> Hình: Mockup – Figma 05 › "Hủy phiếu nhập"

Opened from: SCR-75 Herd Entry Voucher Detail.
This dialog allows the Owner or a Manager to void a posted entry voucher (UC-FE06-05).
**Field Description**

| Field Name | Description |
|---|---|
| Voucher | Read-only: code, type, entry date, number of cattle, seller. |
| ***Checks before voiding*** | |
| Cattle / Events after entry / Result | One row per cattle: recorded events other than entry and first placement ("None" or the list) and "Can be voided" / "Blocked" (MSG-FE06-21). |
| ***On confirmation*** | Cattle get herd status VOIDED and their codes are never reused; pen assignments are closed and places released; QR tags become RETIRED; payments of n đ stay in the history (recovery handled outside BeefCare); farm-born calves return to pending. |
| Void reason * | Long text, max 500. |
| Close / Void voucher | Buttons; enabled only when every cattle can be voided; confirmation MSG-FE06-20; success MSG-FE06-22. |

### 13. FE-13 Herd Exit Recording
Every departure of cattle is recorded as a herd exit voucher created and confirmed by the Owner only (GBR-94). The cattle stay ACTIVE until the voucher is confirmed. A health case closed as Died or Missing creates a PENDING death voucher (GBR-95). Collections from the buyer are recorded with the shared dialog popup "Record Voucher Payment".
#### 13.1 SCR-41 Herd Exit Vouchers
> Hình: Mockup – Figma 05 › "Phiếu xuất – Danh sách"

This screen allows the Owner or a Manager to view herd exit vouchers (UC-FE13-02). The Owner creates and confirms vouchers (UC-FE13-01) and opens pending death vouchers.
**Field Description**

| Field Name | Description |
|---|---|
| Create exit voucher | Button (Owner); opens SCR-42. |
| Status tabs | All, Draft, Pending confirmation, Confirmed, Voided / dismissed, each with its count. |
| Period | Date range of the exit date, default from the start of the previous quarter to today. |
| Exit type | All, Sale, Cull, Death, Other. |
| ***Summary tiles*** | |
| Cattle exited | Count of cattle on CONFIRMED vouchers in the period, by type. |
| Sales revenue | Total receivable of CONFIRMED sale and cull vouchers. |
| To collect | Sum of outstanding amounts and the vouchers concerned. |
| Awaiting the Owner | Number of PENDING vouchers proposed from health cases. |
| ***Voucher list*** | |
| Voucher code | PX-YYYY-nnnn (sortable); link to SCR-76, SCR-42 (DRAFT) or SCR-43 (PENDING). |
| Exit date | Sortable. |
| Exit type | Sale / Cull / Death / Other. |
| Buyer / reason | Buyer and transport certificate, or source health case and cause; the pens concerned. |
| Cattle, Total weight | Number of cattle; kg ("~" when estimated). |
| Total amount (đ), To collect (đ) | Total receivable and outstanding; "—" for death vouchers. |
| Status | DRAFT / PENDING / CONFIRMED / VOIDED / DISMISSED (with reason). |
| Actions | Owner: "Continue" (DRAFT), "View & confirm" (PENDING), "View". Manager: "View". |
| Note | Read-only: a voucher from a health case keeps the cattle ACTIVE until the Owner confirms; voiding a confirmed voucher returns all its cattle to ACTIVE. |

#### 13.2 SCR-42 Herd Exit Voucher
> Hình: Mockup – Figma 05 › "Phiếu xuất mới – Bán"

This screen allows the Owner to enter a sale, cull or other exit voucher, review the checks and confirm it (UC-FE13-01). A side panel shows the summary, the checks and the confirmation.
**Field Description**

| Field Name | Description |
|---|---|
| Exit type | Tabs Sale (default), Cull, Death / missing (SCR-43), Other; fixed after the first save. |
| ***1. Voucher information*** | |
| Voucher code | Read-only, next PX-YYYY-nnnn (BR-D34). |
| Exit date * | Date; not in the future, not before the herd entry or the latest recorded event of any cattle on the voucher (MSG-FE13-03). |
| Buyer / trader * | Searchable dropdown of ACTIVE trading partners with phone; "+ Add buyer" (GBR-97). For type Other: destination (text, max 150). |
| Transport quarantine certificate | Text, max 50. |
| Vehicle plate | Text, max 20. |
| Note | Long text, max 1,000. |
| ***2. Cattle in the voucher*** | |
| Scan QR / + Select cattle | Buttons; scanning adds the scanned ACTIVE cattle; "Select cattle" opens popup "Select Cattle for Exit Voucher". |
| Pricing basis * | Per kg (default) / Per head (GBR-92). |
| # / Cattle code · ear tag | Line number, display code and ear tag. |
| Breed · sex | With age and herd group. |
| Pen | Current pen. |
| Exit weight | Default the latest valid weight with basis Estimated ("UT"); entering a weighed value sets the basis Measured. |
| Unit price, Line amount | Number ≥ 0; calculated (GBR-91). |
| Check | "OK" or the warning of the cattle (e.g. "Withdrawal → 25/10", open case). |
| ⋯ | Remove from voucher. |
| Totals row | Number of cattle, total weight, cattle amount. |
| Withdrawal notice | For each cattle in a meat withdrawal period after the exit date: MSG-FE13-07. |
| ***3. Attachments*** | Contract, weighing slip, certificate; PDF or JPG, max 10 MB each. |
| ***4. Payment*** | |
| Cattle amount | Read-only sum of line amounts. |
| Deductions | Number ≥ 0 (shrinkage, broker fee); not more than the cattle amount. |
| Total receivable | Read-only: cattle amount − deductions. |
| Collected (deposit) | Number ≥ 0, not greater than total receivable (MSG-FE06-13). |
| To collect | Read-only: total receivable − collected. |
| Method, Collection due date | Cash / Bank transfer; date, optional. |
| ***Summary panel*** | Number of cattle, total exit weight (estimated count), pens with headcount before → after, status. |
| Checks before confirmation | Item / Result rows: active meat withdrawal (cattle and end date), OPEN or CHRONIC health cases, future doses and reminders (count, will be cancelled), open pregnancy, draft calves of a dam (MSG-FE13-01). |
| I have reviewed the items above and confirm the exit * | Checkbox (MSG-COM-16 when not ticked). |
| Confirm exit of n cattle | Button; success MSG-FE13-02, then the voucher detail (SCR-76). Effects per cattle as GBR-35 are summarised below the button. |
| Save draft / Cancel | Buttons; MSG-FE13-06 / MSG-COM-14. A DRAFT can be discarded. |

#### 13.3 SCR-43 Death / Missing Exit Voucher
> Hình: Mockup – Figma 05 › "Phiếu xuất – Chết / mất (chờ xác nhận)"

This screen allows the Owner to complete and confirm, or dismiss, a death voucher created when a health case was closed as Died or Missing, or to record a death directly (UC-FE13-01 AF1, AF2, AF6).
**Field Description**

| Field Name | Description |
|---|---|
| ***1. Voucher information*** | |
| Voucher code, Status | Read-only; PENDING when proposed from a health case. |
| Date of death / loss * | Date; default the case closing date; same limits as the exit date. |
| Loss kind | Died / Missing (from the case outcome; editable for a direct record). |
| Proposed from | Health case code and outcome (link), or "Recorded by the Owner". |
| Reported by | Member name and time. |
| Cause / notes * | Long text, max 1,000. |
| Carcass disposal * | Destroyed or buried on the farm / Handed to the local veterinary service / Other (text). Not shown for Missing. |
| ***2. Cattle in the voucher*** | Cattle code and ear tag, breed and sex, age, pen, latest weight, health case and outcome. |
| ***3. Attachments*** | Photos, destruction record or veterinary confirmation; PDF or JPG, max 10 MB each. |
| ***Summary panel*** | Number of cattle, pen headcount before → after; "No price or payment for a death voucher". |
| Checks before confirmation | Source case (closed, outcome), other OPEN or CHRONIC cases, future doses (will be cancelled), open pregnancy, draft calves of the dam. |
| I have reviewed the items above and confirm the exit * | Checkbox. |
| Confirm exit / Dismiss proposal / Close | Buttons; MSG-FE13-02 then the voucher detail (SCR-76); dismiss requires a reason, keeps the cattle ACTIVE and the case outcome unchanged (MSG-FE13-04) and returns to SCR-41. |

#### 13.4 Popup: Void Herd Exit Voucher
> Hình: Mockup – Figma 05 › "Hủy phiếu xuất"

Opened from: SCR-76 Herd Exit Voucher Detail.
This dialog allows the Owner to void a confirmed exit voucher (UC-FE13-03).
**Field Description**

| Field Name | Description |
|---|---|
| Voucher | Read-only: code, type, exit date, number of cattle, buyer. |
| ***On confirmation*** | All cattle return to ACTIVE and their last pen is reopened (pen and occupancy before → after); the voucher stays in the history as VOIDED with the reason; doses and reminders cancelled by the exit are not restored; collections stay in the history (refunds handled outside BeefCare). |
| Pen for each cattle | Shown only when the last pen is INACTIVE or does not have enough places (MSG-FE13-09): dropdown of ACTIVE pens with free places; reception warning reason when a criterion is not met. |
| Void reason * | Long text, max 500. |
| Close / Void voucher | Buttons; success MSG-FE13-05 with the list of items closed or cancelled by the exit. |

#### 13.5 Popup: Select Cattle for Exit Voucher
> Hình: Mockup – Figma 05 › "Chọn bò vào phiếu xuất"

Opened from: SCR-42 Herd Exit Voucher.
This dialog allows the Owner to select cattle for a draft exit voucher (UC-FE13-01). Only ACTIVE cattle that are not on another DRAFT, PENDING or CONFIRMED voucher are listed (BR-D35).
**Field Description**

| Field Name | Description |
|---|---|
| Search | Text: display code or ear tag. |
| Pen, Herd group, Minimum latest weight | Filters. |
| Selection | Checkbox per cattle. |
| Cattle code · ear tag, Herd group · life stage, Pen, Age | Cattle data. |
| Latest weight | kg with date and basis. |
| Warning | Active meat withdrawal (end date), OPEN case code, or "—". Warnings do not block selection. |
| Selected | "n cattle selected · ~kg by latest weight". |
| Cancel / Add n cattle to the voucher | Buttons. |

#### 13.6 SCR-76 Herd Exit Voucher Detail
> Hình: Mockup – Figma 05 › "Chi tiết phiếu xuất – Đã xuất"

This screen allows the Owner or a Manager to view an exit voucher (UC-FE13-02); the Owner records collections (UC-FE13-04) and voids the voucher (UC-FE13-03).
**Field Description**

| Field Name | Description |
|---|---|
| Header | Voucher code, status badge; buttons "Print voucher" and "Void voucher" (Owner, CONFIRMED only, popup "Void Herd Exit Voucher"). |
| ***Voucher information*** | Exit date, exit type, transport certificate, buyer and contact (or destination, cause and disposal), vehicle plate, created and confirmed by and time, note. |
| ***Cattle in the voucher*** | Cattle code (link to SCR-19), ear tag, breed and sex, exit weight and basis, last pen, herd status, line amount; totals row. |
| Read-only notice | Exited cattle are read-only and keep their full history (GBR-26); voiding the voucher returns all its cattle to ACTIVE. |
| Attachments | List with "View". |
| ***Payment*** | Cattle amount, deductions, total receivable, collected, to collect; collection list (date, method, amount, reference, recorded by). "Record collection" (Owner) opens popup "Record Voucher Payment" while an amount is outstanding. |
| ***Voucher history*** | Created, confirmed, doses and reminders cancelled by the system, collections recorded or voided, void or dismissal with reason. |


## Phụ lục B – Use case

Danh sách use case của FE-04, FE-06, FE-13:

| ID | Tên | Nhóm | Mô tả |
|---|---|---|---|
| UC-FE04-01 | View Pens and Occupancy | FE-04 | A farm member views pens with capacity, headcount, free places, reception criteria, current cattle and status. |
| UC-FE04-02 | Create Pen | FE-04 | The Farm Owner or a Manager creates a pen with code, name, capacity and reception criteria. |
| UC-FE04-03 | Update Pen Information | FE-04 | The Farm Owner or a Manager updates pen data; changed criteria become a new version for future placements. |
| UC-FE04-04 | Change Pen Availability | FE-04 | The Farm Owner or a Manager stops or resumes new placements in a pen with effective date and reason. |
| UC-FE04-05 | Reassign Cattle to Another Pen | FE-04 | The Farm Owner or a Manager moves one or several cattle to another pen with date and reason; full or inactive pens block, unmet criteria warn. |
| UC-FE06-01 | Register Herd Entry Voucher | FE-06 | The Farm Owner or a Manager records a purchase voucher of one or more cattle (entered by hand or imported from Excel) with prices and the initial payment, or a voucher of farm-born calves, and posts it to create the cattle. |
| UC-FE06-02 | View Herd Entry Vouchers | FE-06 | The Farm Owner or a Manager views entry vouchers by status, type and source with totals and outstanding amounts, opens a voucher's detail and history, and sees the pending calves. |
| UC-FE06-03 | Correct Herd Entry Record | FE-06 | The Farm Owner or a Manager corrects the entry data or price of one cattle of a posted voucher with a reason, or voids that cattle's entry when it has no other events. |
| UC-FE06-04 | Record Herd Entry Voucher Payment | FE-06 | The Farm Owner or a Manager records a payment to the seller against a posted voucher, or voids a wrong payment with a reason. |
| UC-FE06-05 | Void Herd Entry Voucher | FE-06 | The Farm Owner or a Manager voids a posted voucher recorded by mistake when none of its cattle has other events. |
| UC-FE13-01 | Record and Confirm Herd Exit Voucher | FE-13 | The Farm Owner records a sale, cull or other exit voucher of one or more cattle with exit weights, prices and deposit, reviews the checks and confirms it, or confirms or dismisses a pending death voucher reported from a health case. |
| UC-FE13-02 | View Herd Exit Vouchers | FE-13 | The Farm Owner or a Manager views exit vouchers, including pending, voided and dismissed ones, with totals and amounts still to collect, and opens a voucher's detail and history. |
| UC-FE13-03 | Void Herd Exit Voucher | FE-13 | The Farm Owner voids a mistaken confirmed voucher with a reason; all its cattle return to ACTIVE in their last pen or a pen chosen by the Owner. |
| UC-FE13-04 | Record Herd Exit Voucher Collection | FE-13 | The Farm Owner records money collected from the buyer against a confirmed voucher, or voids a wrong collection with a reason. |

Đặc tả chi tiết (các use case có spec trong SRS):

### UC-FE04-05 Reassign Cattle to Another Pen
- **Actor:** Farm Owner, Farm Manager
- **Trigger:** The user selects "Move pen" (Chuyển chuồng) on a cattle profile (Pen History tab), on cattle selected in a pen's detail, or from a pen-move suggestion (REM-08).
- **Precondition:** PRE-1: The user is the Owner or a Manager of an ACTIVE farm.; PRE-2: The selected cattle are ACTIVE (not EXITED, not draft calves).
- **Postcondition:**
  - POST-1: For each moved cattle the current assignment is closed at the move date and a new assignment is open in the destination pen.
  - POST-2: Occupancy of both pens is updated; warning reasons are stored with the assignment.
  - POST-3: A related REM-08 suggestion is resolved.
- **Main flow:**
  - 1. System shows popup "Move Pen" with the selected cattle (code, breed, sex, age, latest weight) and the current pen with occupancy.
  - 2. User selects the destination pen (list shows only ACTIVE pens with headcount/capacity), the move date (default today) and the reason; the performer defaults to the user.
  - 3. System runs the reception check for each cattle and shows the result table: pen ACTIVE and has enough free places; purpose type, life stage, sex and minimum age/weight against the destination criteria (GBR-21).
  - 4. User selects "Confirm move".
  - 5. System rechecks pen status, free places, each cattle's state and versions.
  - 6. System closes the current assignments and opens the new ones in one transaction (GBR-22), updates occupancy and pen history and resolves REM-08.
  - 7. System shows MSG-FE04-08.
- **Alternative flows:**
  - **AF1 – Criteria not met (step 3)**: the result shows "Not met" for the failing criteria and MSG-FE04-06; the user must enter a warning reason to continue; the reason is saved with each affected assignment.
  - **AF2 – Correction of a mistaken move**: user selects the previous pen with reason "Correction"; the system records a reverse move.
  - **AF3 – Cancel**: nothing changes.
- **Exceptions:**
  - E1: Destination INACTIVE or not enough free places: MSG-FE04-05; the move is blocked.
  - E2: Move date before the start of the current assignment or in the future: MSG-FE04-09.
  - E3: Cattle already in the destination pen: MSG-FE04-07; that cattle is skipped.
  - E4: Cattle EXITED or changed meanwhile: MSG-COM-13 / MSG-COM-05.
  - E5: Save failure: MSG-COM-02; no assignment changes.
- **Rules:** GBR-20, GBR-21, GBR-22, GBR-26; BR-D09.

### UC-FE06-01 Register Herd Entry Voucher
- **Actor:** Farm Owner, Farm Manager
- **Trigger:** The user selects "Create entry voucher" (Tạo phiếu nhập) or "Continue" (Tiếp tục) on a DRAFT voucher in Herd Entry Vouchers, "Pending calves" (Bê chờ xác nhận) or reminder REM-09, or "Register now" while recording a calving (UC-FE12-04).
- **Precondition:** PRE-1: The user is the Owner or a Manager of an ACTIVE farm.; PRE-2: At least one ACTIVE breed, production purpose and pen exist.
- **Postcondition:**
  - POST-1: The voucher is POSTED with its code, lines, totals and initial payment; for each line one cattle exists with a new Internal Cattle ID and display code, its herd entry, history declarations, first pen assignment and ACTIVE QR tag.
  - POST-2: For farm-born calves, each calf outcome is REGISTERED and linked to its cattle; REM-09 is resolved.
  - POST-3: Matching vaccination schedules are listed; no dose is created automatically.
  - POST-4: Until posting, a DRAFT voucher has no effect on cattle, pens, payments or reminders.
- **Main flow:**
  - 1. System shows Herd Entry Voucher – Purchase (SCR-24) with the next voucher code, entry type Purchase and today as entry date.
  - 2. User enters the voucher header: entry date, seller (chosen from the trading partners or added inline), quarantine certificate number (optional; a warning is shown when empty, MSG-FE06-24), vehicle plate and note.
  - 3. User chooses the pricing basis (per kg or per head) and selects "+ Add cattle"; System opens popup "Voucher Cattle Line".
  - 4. User enters ear tag number (or leaves it empty to tag later), name, photo, colour and markings, breed, sex, birth date or month with accuracy (or the estimated age in months), life stage (proposed from the age at entry, GBR-25), production purpose, entry weight with basis, receiving pen, unit price and optional quarantine end date, and the pre-entry history (vaccination, disease, reproduction with earlier calvings and pregnancy at entry: KNOWN / NONE / UNKNOWN, default UNKNOWN, GBR-30); selects "Save line". Steps 3–4 repeat for each cattle.
  - 5. System shows the lines with line amounts, totals (cattle, weight, amount, estimated weights marked UT), the occupancy change of each receiving pen and the pre-save checks (ear tags unique, pen criteria and capacity, entry date not in the future and not before birth dates).
  - 6. User attaches documents (quarantine certificate, invoice, photos) and enters the transport fee, amount paid, payment method and due date of the balance; System shows total payable and outstanding (GBR-91).
  - 7. User selects "Save & create n cattle" (Lưu & tạo hồ sơ n con), optionally with "Print QR tags after saving".
  - 8. System rechecks every line, the header and the version and, in one transaction, posts the voucher, creates each cattle with its herd entry, history declarations (known vaccinations as HISTORICAL vaccination records), first pen assignment and QR tag, records the initial payment and saves the audit entry (GBR-90, GBR-32).
  - 9. System shows MSG-FE06-01, opens Herd Entry Voucher Detail (SCR-75) and, when schedules match, MSG-FE06-05 with links to add the cattle to them (UC-FE09-03).
- **Alternative flows:**
  - **AF1 – Farm-born calves (type "Farm-born calves" or trigger from pending calves / REM-09)**: System shows SCR-25 with the PENDING_CONFIRMATION calves; dam, sire, breed, sex, birth date and birth weight are read-only (GBR-31). User selects the calves, checks the tag, receiving pen and production purpose of each (default: the first ACTIVE purpose of type Undecided) and continues at step 7; the entry date of each calf is its birth date, its life stage UNWEANED_CALF and the voucher has no amounts (GBR-93).
  - **AF2 – Register now from a calving (UC-FE12-04)**: System creates and posts a FARM_BORN voucher for the calf in the calving transaction.
  - **AF3 – Import lines from Excel (step 3)**: User selects "Import from Excel" and uploads the template; System opens popup "Import Cattle from Excel" with the result of each row (valid, warning, error, GBR-96); User selects "Add n cattle to the voucher"; only valid rows are added (MSG-FE06-18, MSG-FE06-19).
  - **AF4 – Save draft (any step)**: System saves the voucher as DRAFT (MSG-FE06-10); no cattle is created; the Owner and Managers can continue it later.
  - **AF5 – Edit or remove a line (step 5)**: User opens the line in popup "Voucher Cattle Line" and saves or removes it.
  - **AF6 – Pen warnings**: a criteria warning needs a warning reason (MSG-FE04-06); a pen that becomes full is shown with MSG-FE06-17.
  - **AF7 – Mark a calf as died before registration (AF1)**: User enters the reason; the calf outcome is closed and REM-09 resolved.
  - **AF8 – Discard draft / Cancel**: User discards a DRAFT voucher or leaves without saving (MSG-COM-14).
- **Exceptions:**
  - E1: No cattle line: MSG-FE06-16.
  - E2: Entry date in the future or before a birth date: MSG-FE06-03.
  - E3: Ear tag or tag code already used: MSG-FE05-02 / MSG-FE12-08.
  - E4: Pen INACTIVE or without enough places for its lines: MSG-FE04-05.
  - E5: Calf already registered or not LIVE: MSG-FE06-02 / MSG-FE06-04.
  - E6: Amount paid greater than the total payable: MSG-FE06-13.
  - E7: Missing seller or other required field: MSG-COM-06.
  - E8: Inactive catalogue value: MSG-FE18-08.
  - E9: Save failure: MSG-COM-02; nothing is created and the voucher stays DRAFT.
- **Rules:** GBR-20, GBR-21, GBR-25, GBR-29, GBR-30, GBR-31, GBR-32, GBR-58, GBR-90, GBR-91, GBR-92, GBR-93, GBR-96, GBR-97; BR-D07, BR-D08, BR-D10, BR-D34, BR-D39.

### UC-FE06-03 Correct Herd Entry Record
- **Actor:** Farm Owner, Farm Manager
- **Trigger:** The user selects "Correct herd entry" (Sửa bản ghi nhập đàn) on the cattle profile or on a cattle line of Herd Entry Voucher Detail (SCR-75).
- **Precondition:** PRE-1: The user is the Owner or a Manager of an ACTIVE farm.; PRE-2: The cattle is ACTIVE and its herd entry is VALID on a POSTED voucher.
- **Postcondition:**
  - POST-1: Correct: the corrected values are current, voucher totals are recalculated when the weight or price changed, and a Record Revision keeps the old values, reason, actor and time; the Internal Cattle ID is unchanged.
  - POST-2: Void: the herd entry is VOIDED, the cattle gets herd status VOIDED and is removed from active lists and counts, its pen assignment is closed and its tag becomes RETIRED, its line amount is removed from the voucher total and its identifiers are never reused.
- **Main flow:**
  - 1. System shows popup "Correct / Void Herd Entry" with the entry (cattle, voucher, entry date, recorder) and the action choice "Correct record" / "Void record".
  - 2. User keeps "Correct record" and enters new values for the fields to correct: entry date (for a purchase voucher it applies to all its cattle), entry weight and basis, unit price, breed, sex, birth date and accuracy, history declarations.
  - 3. User enters the reason and selects Save.
  - 4. System validates the new values against later events (entry date not after any recorded event of the cattle concerned; sex not changed when the cattle has reproductive events; birth date not after the entry date), the voucher payments (BR-D39) and the version.
  - 5. System saves the corrected values, the recalculated voucher totals and the Record Revision in one transaction (GBR-33) and shows MSG-FE06-06.
- **Alternative flows:**
  - **AF1 – Void record (step 2)**: System checks that the cattle has no recorded event other than its herd entry and first pen placement; user enters the reason and confirms MSG-FE06-08; System voids the entry, closes the pen assignment and tag, recalculates the voucher and shows MSG-FE06-12. When it is the last VALID line, the user is directed to UC-FE06-05.
  - **AF2 – Paid amount above the new total**: the change is saved and MSG-FE06-23 is shown; the difference is settled outside BeefCare.
  - **AF3 – Cancel**: nothing changes.
- **Exceptions:**
  - E1: Correction breaks the date order or changes the sex of a cattle with reproductive events: MSG-FE06-07.
  - E2: Void not allowed because events exist: MSG-FE06-09.
  - E3: Missing reason: MSG-COM-06.
  - E4: Changed in another session: MSG-COM-05.
  - E5: Save failure: MSG-COM-02.
- **Rules:** GBR-33, GBR-91; BR-D07, BR-D15, BR-D39.

### UC-FE06-05 Void Herd Entry Voucher
- **Actor:** Farm Owner, Farm Manager
- **Trigger:** The user selects "Void voucher" (Hủy phiếu) on Herd Entry Voucher Detail (SCR-75).
- **Precondition:** PRE-1: The user is the Owner or a Manager of an ACTIVE farm.; PRE-2: The voucher is POSTED.
- **Postcondition:**
  - POST-1: The voucher is VOIDED with reason, actor and time; every VALID herd entry of the voucher is VOIDED, each cattle gets herd status VOIDED and is removed from active lists, its pen assignment is closed and its QR tag withdrawn; identifiers are never reused.
  - POST-2: Recorded payments stay in the voucher history; farm-born calves return to PENDING_CONFIRMATION and REM-09 is raised again.
- **Main flow:**
  - 1. System shows popup "Void Herd Entry Voucher" with the voucher summary and, for each cattle, the events recorded after entry and the result "Can be voided" or "Blocked".
  - 2. System lists the effects of voiding (cattle voided, pen places released, tags withdrawn, payments kept).
  - 3. User enters the void reason and selects "Void voucher".
  - 4. System rechecks that no cattle of the voucher has an event other than its herd entry and first pen placement (GBR-33), the voucher state and version.
  - 5. System voids the voucher and its entries in one transaction, saves the audit entry and shows MSG-FE06-22.
- **Alternative flows:**
  - **AF1 – Some cattle have other events**: the void button is disabled and MSG-FE06-21 names them; the user corrects or voids those entries one by one (UC-FE06-03).
  - **AF2 – Close the dialog**: nothing changes.
- **Exceptions:**
  - E1: Missing reason: MSG-COM-06.
  - E2: Voucher already VOIDED or changed: MSG-COM-05.
  - E3: Save failure: MSG-COM-02; nothing changes.
- **Rules:** GBR-33, GBR-90, GBR-91; BR-D07, BR-D15.

### UC-FE13-01 Record and Confirm Herd Exit Voucher
- **Actor:** Farm Owner
- **Trigger:** The Owner selects "Create exit voucher" (Tạo phiếu xuất) or "Continue" on a DRAFT voucher in Herd Exit Vouchers, or "View & confirm" (Xem & xác nhận) on a PENDING death voucher, the dashboard list A03 or a notification.
- **Precondition:** PRE-1: The user is the Owner of an ACTIVE farm.; PRE-2: The cattle to add are ACTIVE and on no other DRAFT, PENDING or CONFIRMED exit line, or a PENDING voucher exists.
- **Postcondition:**
  - POST-1: The voucher is CONFIRMED with its lines, totals and collected deposit; each cattle on it is EXITED and read-only.
  - POST-2: For each cattle: the open pen assignment is closed at the exit date; future doses and reminders are cancelled; OPEN and CHRONIC health cases are closed "Closed by herd exit"; an open pregnancy is closed "Dam exited" (GBR-35).
  - POST-3: Until confirmation a DRAFT or PENDING voucher has no effect; its cattle stay ACTIVE.
- **Main flow:**
  - 1. System shows Herd Exit Voucher (SCR-42) with the next voucher code, exit type Sale and today as exit date.
  - 2. Owner chooses the exit type (Sale, Cull or Other) and enters the exit date, buyer (trading partner, added inline when new) or destination, transport quarantine certificate, vehicle plate and note.
  - 3. Owner selects "+ Select cattle"; System opens popup "Select Cattle for Exit Voucher" with ACTIVE cattle not on another open voucher, filters (pen, herd group, minimum weight) and warnings per cattle; Owner selects cattle and confirms, or scans their QR tags.
  - 4. System adds one line per cattle with the latest weight as exit weight (basis ESTIMATED, marked UT) and the check result.
  - 5. Owner chooses the pricing basis, enters the unit price and, where weighed, the measured exit weight of each line; System calculates line amounts and totals (GBR-91, GBR-92).
  - 6. Owner attaches documents and enters deductions, the deposit collected, method and due date of the balance; System shows total receivable and outstanding.
  - 7. System shows the pre-confirmation checks per item and cattle: active meat withdrawal period (MSG-FE13-07), OPEN and CHRONIC health cases, future doses and reminders that will be cancelled, open pregnancy and draft calves of a dam, and the occupancy change of each pen.
  - 8. Owner ticks "I have reviewed the items above and confirm the exit" and selects "Confirm exit of n cattle" (Xác nhận xuất n con).
  - 9. System validates the date (not in the future, not before the herd entry or the latest recorded event of each cattle), the state of each cattle, the amounts and the version.
  - 10. System confirms the voucher and applies all effects to every line in one transaction (GBR-35, GBR-94); the audit entry is saved.
  - 11. System shows MSG-FE13-02 and opens Herd Exit Voucher Detail (SCR-76).
- **Alternative flows:**
  - **AF1 – Confirm a pending death voucher**: System opens Death / Missing Exit Voucher (SCR-43) with the cattle, source health case, reporter and date of death or loss; the Owner completes the cause and carcass disposal, attaches evidence, reviews the checks and continues at step 8; the voucher has no amounts (GBR-95).
  - **AF2 – Dismiss a pending voucher**: the Owner selects "Dismiss" with a reason; the voucher becomes DISMISSED, the cattle stays ACTIVE and the health case keeps its outcome (MSG-FE13-04).
  - **AF3 – Save draft (any step)**: the voucher is saved as DRAFT (MSG-FE13-06); the cattle stay ACTIVE and cannot be added to another voucher.
  - **AF4 – Remove a line**: the Owner removes a cattle from a DRAFT voucher; totals are recalculated.
  - **AF5 – Warnings present**: MSG-FE13-01 lists them per cattle; warnings never block, the Owner can still confirm after ticking the confirmation.
  - **AF6 – Death recorded directly**: the Owner chooses type "Death" for a loss not reported through a health case and continues as AF1.
  - **AF7 – Discard draft / Cancel**: the Owner discards a DRAFT voucher or leaves without saving (MSG-COM-14).
- **Exceptions:**
  - E1: Exit date invalid: MSG-FE13-03.
  - E2: Cattle already on another open voucher: MSG-FE13-08.
  - E3: No cattle line: MSG-FE06-16.
  - E4: Deposit greater than the total receivable: MSG-FE06-13.
  - E5: Missing type, date, buyer or destination, cause or required field: MSG-COM-06.
  - E6: Confirmation not ticked: MSG-COM-16.
  - E7: A cattle is no longer ACTIVE or the voucher changed: MSG-COM-05.
  - E8: Save failure: MSG-COM-02; nothing changes.
- **Rules:** GBR-07, GBR-34, GBR-35, GBR-46, GBR-91, GBR-92, GBR-94, GBR-95, GBR-97; BR-D09, BR-D11, BR-D34, BR-D35, BR-D39.

### UC-FE13-03 Void Herd Exit Voucher
- **Actor:** Farm Owner
- **Trigger:** The Owner selects "Void voucher" (Hủy phiếu) on a CONFIRMED voucher in Herd Exit Voucher Detail (SCR-76).
- **Precondition:** PRE-1: The user is the Owner of an ACTIVE farm.; PRE-2: The voucher is CONFIRMED.
- **Postcondition:**
  - POST-1: The voucher is VOIDED with reason, actor and time; every cattle on it is ACTIVE again with an open pen assignment in its last pen or in the pen chosen by the Owner.
  - POST-2: Items closed or cancelled by the exit are listed for review and are not restored automatically; recorded collections stay in the voucher history.
- **Main flow:**
  - 1. System shows popup "Void Herd Exit Voucher" with the voucher (type, date, number of cattle, buyer) and the effects: cattle back to ACTIVE, last pen and its occupancy after the void, cancelled items not restored, collections kept.
  - 2. Owner enters the void reason and selects "Void voucher".
  - 3. System checks the voucher state and version, that no cattle of the voucher is on another open exit line, and that each last pen is ACTIVE with enough free places.
  - 4. System voids the voucher, sets each cattle ACTIVE, opens its pen assignment from the void date and saves the audit entry in one transaction (GBR-36).
  - 5. System shows MSG-FE13-05 with the list of items closed or cancelled by the exit.
- **Alternative flows:**
  - **AF1 – Last pen unavailable or full (step 3)**: MSG-FE13-09; the Owner chooses an ACTIVE pen with free places for each affected cattle (reception warnings need a reason) and continues at step 4.
  - **AF2 – Close the dialog**: nothing changes.
- **Exceptions:**
  - E1: Missing reason: MSG-COM-06.
  - E2: Voucher already VOIDED or changed: MSG-COM-05.
  - E3: Save failure: MSG-COM-02; nothing changes.
- **Rules:** GBR-07, GBR-20, GBR-26, GBR-36, GBR-91; BR-D09, BR-D11, BR-D35.


## Phụ lục C – Quy tắc nghiệp vụ (nguyên văn)

### C.1 General Business Rules

| ID | Quy tắc |
|---|---|
| GBR-09 | Every protected request rechecks the account status, the user's current membership and role in the selected farm (or current platform role) and the farm service status. The selected farm in the browser, a link, a notification or a QR code is never proof of permission. |
| GBR-12 | One farm is one independent tenant with exactly one Owner. One Owner may own several farms; each farm has its own members, data, subscription and service status. Data of one farm is never shown in the context of another farm. |
| GBR-19 | Pen code is unique within a farm and capacity is a whole number of head of at least 1. A pen with placement history is never deleted; it is made INACTIVE instead. Capacity cannot be reduced below the current headcount. |
| GBR-20 | A placement or move into an INACTIVE pen, or one that would exceed the pen capacity, is blocked. Stopping new placements never moves the cattle already in the pen. |
| GBR-21 | Pen reception criteria (accepted purpose types, life stages, sex and optional minimum age or weight) are advisory. When a cattle does not meet them, the system shows a warning and the user may continue only after entering a reason, which is stored with the placement. A change of criteria creates a new version that applies to future placements and suggestions only. |
| GBR-22 | A cattle has at most one open pen assignment. A move closes the current assignment and opens the new one in one transaction. The move date is not earlier than the start of the current assignment and not later than today, so periods never overlap. A mistaken move is corrected by a reverse move with the reason "Correction". |
| GBR-23 | The Internal Cattle ID is generated once, never changes and is never reused. The display code (BC-nnnnnn) is generated once from a farm sequence. The secondary ear-tag number is editable and must be unique among ACTIVE cattle of the farm. |
| GBR-24 | Herd status (ACTIVE, EXITED, VOIDED), production purpose, life stage, current pen, health state and reproductive status are separate attributes (3.4.1). Exit pending, current pen, health state (GBR-45), meat withdrawal (GBR-46), reproductive status (GBR-54) and herd group are derived from their source records and are never edited on the profile; they are shown only for ACTIVE cattle. An ACTIVE cattle always has exactly one open pen assignment; an EXITED or VOIDED cattle has none. The herd group of an ACTIVE cattle is the first that matches, in this order: Calves (life stage UNWEANED_CALF or WEANED_CALF); Fattening (purpose type FATTENING); Breeding bulls (male, purpose type SIRE); Breeding females (female, ADULT, purpose type BREEDING); Young stock (YOUNG_STOCK); Other. Herd groups are used by the herd list, vaccination targets and herd reports. |
| GBR-25 | Production purpose is changed only by the Owner; life stage, ear tag number, name, colour/markings and notes by the Owner or a Manager. Life stage is physiological, from a fixed list: UNWEANED_CALF, WEANED_CALF, YOUNG_STOCK, ADULT. Each production purpose in the farm catalogue has one purpose type (BREEDING, FATTENING, SIRE, UNDECIDED), chosen when it is created and fixed once the purpose is referenced; rules use the type, never the purpose name. A purpose of type SIRE can be given only to a male and a purpose of type BREEDING only to a female, at herd entry, at calving registration and on profile change (MSG-FE05-12). A purpose or stage change needs an effective date and reason and is kept as history. The life stage is proposed from age at herd entry; later stage changes are suggested by REM-08 when the cattle reaches the weaning, young-stock or adult age (farm parameters) or has a first calving. Suggestions never change purpose, stage or pen by themselves. |
| GBR-26 | An EXITED or VOIDED cattle is read-only: no new event, profile change, pen move or tag change is accepted, and its full history stays visible. Voiding the exit (UC-FE13-03) returns an EXITED cattle to ACTIVE; VOIDED is final. While a cattle is on a PENDING death voucher (GBR-95) no new care or reproduction event, pen move, profile change or exit line is accepted (MSG-COM-17); corrections and voids of existing records remain possible until the Owner confirms or dismisses the voucher. |
| GBR-27 | A cattle has at most one ACTIVE QR tag. Replacing a tag needs a reason (LOST, DAMAGED, OTHER) and marks the old tag REPLACED; a replaced tag is never reactivated. Scanning a replaced tag opens the same cattle with a notice. Replacement never changes the Internal Cattle ID or history. |
| GBR-29 | Herd entry source is EXTERNAL (bought or brought in, on a PURCHASE voucher) or FARM_BORN (a live calf from a recorded calving, on a FARM_BORN voucher). Each herd entry is one line of a herd entry voucher (GBR-90). Each cattle has exactly one herd entry and each live calf outcome is registered at most once; a repeated submission returns the first result. An animal that left the herd and returns is registered on a new purchase voucher with a new Internal Cattle ID. |
| GBR-30 | Pre-entry history is declared per category (vaccination, disease, reproduction) as KNOWN, NONE or UNKNOWN; UNKNOWN is never shown as negative. Known vaccinations are saved as vaccination records with source HISTORICAL and create no scheduled dose. Past treatments are not recorded at entry. For a female the reproduction declaration may give the number of earlier calvings, which is added to her parity, and a pregnancy at entry with estimated months; a declared pregnancy is shown on the profile as "Declared pregnant ~n months (not checked)", creates REM-03 and opens no pregnancy episode until a PREGNANT check is recorded (GBR-53). |
| GBR-31 | For a farm-born calf, birth date = calving time, dam = the calving dam, sire = the sire of the breeding linked to the pregnancy (UNKNOWN when none), and the proposed pen = the pen chosen at calving. Only a LIVE outcome can be registered. |
| GBR-32 | Posting a herd entry voucher creates, for each line, the cattle, its herd entry, history declarations, first pen assignment and QR tag in one transaction; an error on any line posts nothing. After posting the system lists the vaccination schedules whose target criteria match the new cattle; a cattle joins a schedule only when a Manager adds it (UC-FE09-03). |
| GBR-33 | The herd entry of one cattle (entry date, source information, sex, breed, birth date or estimated age, entry weight, unit price, history declarations) is corrected by the Owner or a Manager with a mandatory reason; old and new values, actor and time are kept, the voucher totals are recalculated and the Internal Cattle ID never changes. A herd entry can be voided only when the cattle has no recorded event other than its entry and first pen placement; a whole voucher can be voided only when this holds for every cattle on it. A voided cattle gets herd status VOIDED (final): its pen assignment is closed, its QR tag becomes RETIRED, it disappears from active lists, counts and reports (shown only with the status filter VOIDED), its line amount leaves the voucher total and its ID and code are not reused. |
| GBR-34 | Only the Owner creates, confirms, dismisses or voids a herd exit voucher. Exit type is SALE, CULL, DEATH or OTHER; exit date and reason or buyer are mandatory; the exit date is not in the future and not earlier than the herd entry date or the latest recorded event of any cattle on the voucher. A health case closed as DIED or MISSING creates a PENDING death voucher (GBR-95); the cattle stays ACTIVE until the Owner confirms or dismisses it. |
| GBR-35 | Confirming an exit voucher, in one transaction for every cattle on it: sets herd status EXITED; closes the open pen assignment at the exit date; cancels scheduled doses and reminders dated after the exit; closes OPEN and CHRONIC health cases with outcome "Closed by herd exit"; closes an open pregnancy as "Dam exited". Before confirmation the Owner sees, per cattle, warnings for an open pregnancy, open health cases, an active withdrawal period, future doses and pending calves of the dam. Pending calves of the dam stay pending. |
| GBR-36 | Voiding a CONFIRMED exit voucher needs a mandatory reason; the voucher becomes VOIDED and is never deleted or voided twice. Every cattle on it returns to ACTIVE with a new pen assignment from the void date in its last pen; when that pen is INACTIVE or lacks places, the Owner chooses an ACTIVE pen with free places for each affected cattle. Items closed or cancelled by the exit are listed for review and are not restored automatically; recorded collections stay in the history. |
| GBR-46 | A treatment record is the treatment actually given: medicine from the farm catalogue, dose, route, time and performer. A daily course of the same medicine, dose and route may be recorded once with its number of days. The withdrawal end date = time of the last administration (first administration + course days − 1) + withdrawal days (default from the medicine, editable per treatment); an ON_FARM vaccination record likewise has withdrawal days (default from the vaccine, editable per record) and a withdrawal end date. The cattle's meat withdrawal end date is the latest end date among its VALID treatments and ON_FARM vaccination records; while it is today or later the profile and herd list show "Meat withdrawal until dd/mm/yyyy" and herd exit shows a warning. Meat withdrawal is a separate flag, not a health state. A suspected diagnosis and a contagious flag on a case are the user's own assessment. BeefCare does not diagnose or prescribe. |
| GBR-47 | Closing a case with outcome DIED or MISSING creates a PENDING death voucher for the Owner (GBR-34, GBR-95); the cattle is not exited automatically. A reaction after vaccination is recorded as a health case linked to the vaccination record. |
| GBR-58 | For each live calf the Manager chooses "Save as draft calf" or "Register now". Register now creates the cattle immediately (UC-FE06-01 logic). A draft calf stays PENDING_CONFIRMATION and creates reminder REM-09 until the Owner or a Manager confirms it in UC-FE06-01. A draft calf's ear-tag/QR code must be unique in the farm; a draft calf receives no other events until registered; a calf that dies before registration is marked DIED_BEFORE_REGISTRATION and is never changed from LIVE to STILLBORN. |
| GBR-66 | Dates and periods are evaluated in the farm time zone (default Asia/Ho_Chi_Minh). A user date range is converted to [start of first day, start of the day after the last day). Platform finance uses Asia/Ho_Chi_Minh. |
| GBR-90 | A herd entry voucher is of type PURCHASE or FARM_BORN and has one line per cattle. A DRAFT is visible to the Owner and Managers, can be edited or discarded, and creates no cattle, pen change, balance or reminder effect. Posting rechecks every line and the header and applies GBR-32; the voucher then becomes POSTED and its lines can no longer be added or removed (corrections per cattle follow GBR-33). Every cattle receives a QR tag; printing is optional. A repeated post returns the first result. |
| GBR-91 | Line amount = unit price × weight (per kg) or unit price (per head), in whole VND. Entry voucher and feed receipt: total payable = goods amount + transport fee. Exit voucher: total receivable = cattle amount − deductions. Outstanding = total − sum of RECORDED payments; payment status (Unpaid, Partly paid, Paid) is derived. A payment or collection is a positive whole-VND amount, dated not in the future and not before the voucher date, with method Cash or Bank transfer, and never exceeds the outstanding amount (BR-D39). A wrong payment is voided with a reason, never edited. Voiding a voucher keeps its payments in the history; refunds are handled outside BeefCare. The Owner and Managers record payments of entry vouchers and feed receipts; only the Owner records collections of exit vouchers. These amounts are farm bookkeeping, not invoices, tax or accounting documents, and are not part of platform finance (OR-08). |
| GBR-92 | The pricing basis (per kg or per head) applies to all lines of a voucher; per-kg pricing requires a weight on every line. Each weight has a basis MEASURED or ESTIMATED and an estimated weight is labelled "UT". The default exit weight is the latest valid weight with basis ESTIMATED; entering a weighed value makes it MEASURED. Entry and exit weights are kept on the voucher line and are not growth assessments. |
| GBR-93 | A FARM_BORN voucher contains only live calves in PENDING_CONFIRMATION whose dam is in the farm. For each calf the entry date is its birth date, the life stage is UNWEANED_CALF, parentage and birth data come from the calving (GBR-31) and the production purpose defaults to the first ACTIVE purpose of type UNDECIDED. The voucher has no amounts. "Register now" at calving (UC-FE12-04) creates and posts a FARM_BORN voucher automatically. A calf marked "died before registration" (with a reason) leaves the pending list and resolves REM-09. |
| GBR-94 | A herd exit voucher is created, edited and confirmed by the Owner only. Only ACTIVE cattle that are on no other DRAFT, PENDING or CONFIRMED exit line can be added (BR-D35), from a filtered list or by QR scan. A DRAFT keeps its cattle ACTIVE and has no effect. Before confirmation the system shows the checks of GBR-35 per cattle; a SALE or CULL voucher dated before the end of a cattle's meat withdrawal period is highlighted (GBR-46). Warnings never block; the Owner must tick the confirmation. Confirming applies GBR-35 to every line; if any cattle is no longer ACTIVE, nothing is confirmed. |
| GBR-95 | A health case closed as DIED or MISSING creates one PENDING DEATH voucher for the cattle with the case, reporter and date. The Owner completes the cause and, for a death, the carcass disposal (destroyed or buried on the farm, handed to the veterinary service, other) and confirms it, or dismisses it with a mandatory reason, in which case the cattle stays ACTIVE and the case keeps its outcome. A DEATH voucher has no amounts. The Owner may also record a DEATH voucher directly. While the voucher is PENDING the cattle shows "Chờ xác nhận chết / mất" and accepts no new event (GBR-26), and REM-12 reminds the Owner until it is confirmed or dismissed. |
| GBR-96 | Cattle lines can be imported into a DRAFT purchase voucher from the BeefCare Excel template (max 200 rows). Each row is validated like a manual line; rows with errors are not added; rows with warnings are added with the default shown (for example a missing birth date saved as UNKNOWN). Imported lines can be edited before posting. |
| GBR-97 | Trading partners (sellers, buyers, feed suppliers) belong to the farm, have a unique name and no BeefCare account. They are added inline from a voucher or in the catalogue; a partner referenced by a voucher is made inactive, never deleted. The Owner maintains buyers; the Owner and Managers maintain sellers and suppliers. |

### C.2 Data Business Rules

| ID | Tên | Quy tắc | Áp dụng khi |
|---|---|---|---|
| BR-D07 | Permanent cattle identity | Internal Cattle ID and display code are generated once, never change and are never reused, even after exit or a voided herd entry. | Herd entry, QR replacement, profile update |
| BR-D08 | Tag uniqueness | QR tag code is unique; at most one ACTIVE tag per cattle. Ear tag number is unique among ACTIVE cattle of the farm. A draft calf's tag code must not be used by any tag of the farm. | QR issue/replace, profile update, herd entry, calving |
| BR-D09 | Single current pen | At most one open pen assignment per cattle; periods of one cattle never overlap; open assignments of a pen never exceed its capacity. | Herd entry, pen move, pen update, exit, exit void |
| BR-D10 | One entry per cattle | Exactly one herd entry per cattle; a live calf outcome is linked to at most one cattle. | Herd entry, draft calf confirmation |
| BR-D11 | One active exit | At most one PENDING or CONFIRMED herd exit per cattle. | Exit voucher confirmation, pending voucher creation, exit void |
| BR-D12 | Unique codes | Pen code and catalogue codes (breed, vaccine, medicine, production purpose) are unique within the farm. | Create and update |
| BR-D15 | Corrections keep history | Corrections, exclusions and voids never overwrite the original values; a Record Revision with before/after values, reason, actor and time is saved with the change. | Correction and void UCs |
| BR-D31 | Optimistic version | Updatable records carry a version; an update with an outdated version is rejected (GBR-89). | Every update and correction |
| BR-D34 | Unique voucher codes | Herd entry voucher (PN-YYYY-nnnn), herd exit voucher (PX-YYYY-nnnn), feed receipt (PNK-YYYY-nnnn) and stock adjustment (ĐCK-YYYY-nnnn) codes are unique within the farm, generated in sequence per year and never reused. A voucher has at least one line when it is posted or confirmed. | Voucher create, post, confirm |
| BR-D35 | One open exit line per cattle | A cattle appears on at most one DRAFT, PENDING or CONFIRMED herd exit line; only an ACTIVE cattle can be added to a voucher. | Exit voucher edit, pending voucher creation, confirmation, void |
| BR-D39 | Payments within total | Payments and collections of a voucher are positive whole VND, dated not before the voucher date and not in the future, and the sum of RECORDED payments never exceeds the voucher total. | Voucher save, payment record, line correction or void |

## Phụ lục D – Thực thể và bảng chuyển trạng thái (SRS I.3)

### Pen
- Purpose: A pen or care area of the farm in which cattle are placed.
- Key business attributes: Farm, pen code, pen name, capacity, description, availability status, current headcount (derived), current criteria version.
- Business identity: Pen code is unique within the farm.
- Status / lifecycle: ACTIVE ⇄ INACTIVE (with effective date and reason). A pen with placement history is never deleted.
- Detail – Pen Reception Criteria: One version of the advisory criteria a pen uses to check placements and to suggest pen moves. Attributes: Pen, version number, accepted purpose types, accepted life stages, accepted sex, minimum age (months), minimum weight (kg), effective from, changed by. Identity: Version number is unique within the pen. Lifecycle: A new version applies to future placements and suggestions only.

### Cattle
- Purpose: One animal of the farm, followed from herd entry to herd exit. Its activity timeline is a derived view of its source records (GBR-37).
- Key business attributes: Internal Cattle ID, display code, ear tag number, name, sex, breed, birth date or estimated birth month with accuracy (EXACT / ESTIMATED / UNKNOWN), colour and markings, photo, production purpose, life stage (UNWEANED_CALF / WEANED_CALF / YOUNG_STOCK / ADULT), herd status (ACTIVE / EXITED / VOIDED), exit type and date or void reason, dam, sire (internal cattle or external sire/semen code). Derived: exit pending, current pen, herd group, health state (HEALTHY / MONITORING / UNDER_TREATMENT), meat withdrawal end date, reproductive status (AWAITING_BREEDING / IN_ESTRUS / BRED / PREGNANT / POST_CALVING, or not applicable), breeding eligibility, latest weight, ADG and projected finishing date (FATTENING), reproduction indicators (females). The status dimensions are summarised in 3.4.1.
- Business identity: Internal Cattle ID is system-generated, immutable and never reused. Display code is unique within the farm.
- Status / lifecycle: Herd status ACTIVE → EXITED (confirmed exit) → ACTIVE (voided exit); ACTIVE → VOIDED (herd entry voided; final). An EXITED or VOIDED cattle is read-only, and a cattle on a PENDING death voucher accepts no new event (GBR-26, 3.4.2).
- Detail – Cattle Profile Change: The history of one change of production purpose, life stage, ear tag number or descriptive data. Attributes: Cattle, field group, old value, new value, effective date, reason, changed by, changed time. Identity: Ordered by effective date within a cattle and field. Lifecycle: Immutable once saved.
- Detail – Pen Assignment: One period during which a cattle is placed in a pen. Attributes: Cattle, pen, from date, to date, source (HERD_ENTRY / MOVE / CORRECTION), reason, criteria version checked, reception-check result and warning reason, moved by, recorded time. Identity: At most one open assignment per cattle; periods never overlap. Lifecycle: OPEN → CLOSED (move or exit). A closed assignment is never edited.

### Cattle QR Tag
- Purpose: A printed QR tag that identifies a cattle in the field.
- Key business attributes: Cattle, tag code, status, issued by, issued time, replacement reason (LOST / DAMAGED / OTHER), note, replaced-by tag.
- Business identity: Tag code is unique; at most one ACTIVE tag per cattle.
- Status / lifecycle: ACTIVE → REPLACED (new tag issued) or RETIRED (herd entry voided); never reactivated. The tag of an EXITED cattle stays ACTIVE so that a scan by a farm member opens its read-only profile.

### Herd Entry Voucher
- Purpose: One receipt of cattle into the farm (phiếu nhập), by purchase or as farm-born calves, grouping one or more herd entries with their value and the payments to the seller.
- Key business attributes: Voucher code, entry type (PURCHASE / FARM_BORN), entry date, seller (trading partner), quarantine certificate number (PURCHASE, optional), vehicle plate, note, pricing basis (PER_KG / PER_HEAD), cattle amount, transport fee, total payable, amount paid, outstanding amount, payment due date, attachments, created by, posted by and time, void reason, voided by and time. Derived: payment status (UNPAID / PARTLY_PAID / PAID), number of cattle, total weight.
- Business identity: Code PN-YYYY-nnnn, unique within the farm and never reused (BR-D34).
- Status / lifecycle: DRAFT → POSTED → VOIDED; a DRAFT can be discarded. Only a DRAFT is edited; posting creates the cattle of all lines in one transaction (GBR-90). A FARM_BORN voucher has no amounts (GBR-93).
- Detail – Herd Entry: How and when one cattle entered the herd; one line of a herd entry voucher. Attributes: Herd entry voucher, line number, cattle, source (EXTERNAL / FARM_BORN), entry date (from the voucher; the birth date for a farm-born calf), entry weight with basis, unit price, line amount, quarantine until (EXTERNAL, optional), calf outcome (FARM_BORN), initial pen, status. Identity: Exactly one VALID herd entry per cattle; a calf outcome is registered at most once; line number unique within the voucher. Lifecycle: Created VALID when its voucher is posted. VALID → VOID for one line (UC-FE06-03) or for all lines with the voucher (UC-FE06-05), only when the cattle has no other event (GBR-33). Corrections create Record Revisions.
- Detail – Pre-entry History Declaration: Declared history of a bought-in cattle before entry, per category. Attributes: Herd entry, category (VACCINATION / DISEASE / REPRODUCTION), status (KNOWN / NONE / UNKNOWN), details (vaccine, date, disease, description; for REPRODUCTION: number of earlier calvings, pregnant at entry, estimated months pregnant), information source. Identity: One declaration per herd entry and category, with item lines for KNOWN. Lifecycle: Corrected only through UC-FE06-03.

### Herd Exit Voucher
- Purpose: One departure of cattle from the farm (phiếu xuất) – sale, cull, death or missing, or other – grouping herd exits with their value and the collections from the buyer; confirmed by the Owner.
- Key business attributes: Voucher code, exit type (SALE / CULL / DEATH / OTHER), exit date, buyer (trading partner) or destination, transport quarantine certificate, vehicle plate, reason/notes, loss kind (DIED / MISSING), cause and carcass disposal (DEATH), source health case, pricing basis, cattle amount, deductions, total receivable, amount collected, outstanding amount, collection due date, attachments, reported by, confirmed by and time, dismiss or void reason, actor and time.
- Business identity: Code PX-YYYY-nnnn, unique within the farm and never reused (BR-D34).
- Status / lifecycle: DRAFT → CONFIRMED → VOIDED (Owner); PENDING (created from a health case closed as DIED or MISSING) → CONFIRMED or DISMISSED; a DRAFT can be discarded (GBR-94 to GBR-96). A DEATH voucher has no amounts.
- Detail – Herd Exit: The end of one cattle's stay in the herd; one line of a herd exit voucher. Attributes: Herd exit voucher, line number, cattle, exit weight with basis (default the latest weight), unit price, line amount, pre-confirmation check results (withdrawal, open cases, future doses and reminders, pregnancy, draft calves), last pen, status. Identity: A cattle is on at most one DRAFT, PENDING or CONFIRMED exit line at a time (BR-D11, BR-D35). Lifecycle: Follows its voucher: DRAFT or PENDING → CONFIRMED (cattle EXITED) or removed / DISMISSED; CONFIRMED → VOIDED with the voucher (GBR-95).

### Trading Partner
- Purpose: A seller, buyer, market, slaughterhouse or feed supplier the farm deals with. Partners have no BeefCare account.
- Key business attributes: Name, partner roles (SELLER / BUYER / SUPPLIER), contact phone, area or address, note, status.
- Business identity: Name is unique within the farm (case-insensitive).
- Status / lifecycle: ACTIVE ⇄ INACTIVE; never deleted once referenced by a voucher (GBR-97).

### Voucher Payment
- Purpose: One payment made to a seller or feed supplier, or one collection received from a buyer, recorded against a voucher.
- Key business attributes: Voucher (herd entry voucher, herd exit voucher or feed receipt), direction (PAY / COLLECT), payment date, amount, method (CASH / BANK_TRANSFER), reference or transfer content, attachment, note, recorded by and time, void reason, voided by and time.
- Business identity: Ordered by payment date within the voucher; the sum of RECORDED payments never exceeds the voucher total (BR-D39).
- Status / lifecycle: RECORDED → VOIDED (with reason; a wrong payment is voided and recorded again). Farm bookkeeping only: not an invoice or tax document and not part of platform finance (GBR-91).


### 3.4.2 Herd Status
> Hình: State diagram – Herd status of a cattle (ACTIVE, Exit pending, EXITED, VOIDED)

**Table 3.4-2 Herd status transitions**

| From | Event (use case) | To | Rule or guard |
|---|---|---|---|
| — | Herd entry voucher posted, including "Register now" at calving (UC-FE06-01, UC-FE12-04) | ACTIVE | One open pen assignment and one ACTIVE QR tag are created (GBR-90, GBR-93). |
| ACTIVE | Cattle added to a DRAFT exit voucher, or a PENDING death voucher is created from a health case closed as DIED or MISSING (UC-FE13-01, UC-FE10-03) | ACTIVE with Exit pending | The cattle stays ACTIVE. With a PENDING death voucher no new care or reproduction event, pen move or profile change is accepted; corrections and voids of existing records remain possible (GBR-26, GBR-95). |
| ACTIVE with Exit pending | Line removed, draft discarded, or pending voucher dismissed with a reason (UC-FE13-01) | ACTIVE | A dismissed death voucher keeps the case outcome. |
| ACTIVE (with or without Exit pending) | Exit voucher confirmed by the Owner (UC-FE13-01) | EXITED | GBR-35: the pen assignment is closed, future doses and reminders are cancelled, open cases are closed by exit and an open pregnancy is closed as DAM_EXITED. |
| EXITED | Exit voucher voided (UC-FE13-03) | ACTIVE | A new pen assignment starts on the void date; closed or cancelled items are listed for review and not restored (GBR-36). |
| ACTIVE | Herd entry or whole entry voucher voided (UC-FE06-03, UC-FE06-05) | VOIDED | Only when the cattle has no event other than its entry and first placement. The QR tag becomes RETIRED; the cattle is excluded from lists, counts and reports and is never shared publicly (GBR-33). Final state. |


## Phụ lục E – Thông báo (MSG) dùng trong nhóm tính năng

| # | Message code | Message Type | Context | Content |
|---|---|---|---|---|
| 1 | MSG-COM-01 | Inline (page) | The user's role, membership or platform access does not allow the action or data | You do not have permission to perform this action. |
| 2 | MSG-COM-02 | Toast (error) | Saving fails for a technical reason | The data could not be saved. Please try again. |
| 3 | MSG-COM-03 | Inline (page) | Loading a list or record fails | The data could not be loaded. [Retry] |
| 4 | MSG-COM-04 | Inline (list) | No record matches the filters | No matching records found. [Clear filters] |
| 5 | MSG-COM-05 | Dialog | The record was changed by someone else, or is no longer in a state that allows the action | This record has been changed. Please reload and review it before trying again. [Reload] |
| 6 | MSG-COM-06 | Inline (under field) | A required field is empty | {field} is required. |
| 7 | MSG-COM-07 | Inline (under field) | An event time is in the future | The time cannot be in the future. |
| 8 | MSG-COM-08 | Inline (page) | The selected source record or person is no longer available | The selected item is no longer available. Please choose another one. |
| 9 | MSG-COM-09 | Toast (success) | A simple update is saved | Changes saved. |
| 10 | MSG-COM-10 | Inline (under field) | A field has an invalid format (email, phone, number) | {field} is not valid. |
| 11 | MSG-COM-11 | Inline (under field) | The start of a date range is after its end | The start date must not be after the end date. |
| 12 | MSG-COM-12 | Banner | A farm operation screen is opened while the farm service is not ACTIVE | The service of {farm} is {status}. Farm operations are unavailable; the Owner can manage the subscription and contact support. |
| 13 | MSG-COM-13 | Banner | The cattle has left the herd | {cattle_code} left the herd on {date} ({exit_type}). The record is read-only. |
| 14 | MSG-COM-14 | Dialog (confirm) | Closing a form with unsaved data | Discard the information you have entered? [Discard] [Keep editing] |
| 15 | MSG-COM-15 | Inline (under field) | An event time is earlier than the herd entry | The time cannot be earlier than the herd entry date ({date}). |
| 16 | MSG-COM-16 | Inline (form) | A required confirmation checkbox is not ticked | Please tick the confirmation to continue. |
| 17 | MSG-COM-17 | Banner | The cattle is on a PENDING death or missing voucher | {cattle_code} was reported {loss_kind} on {date} and is awaiting the Owner's confirmation. New events, pen moves and profile changes are not accepted. |
| 18 | MSG-COM-18 | Banner | The herd entry of the cattle was voided | The herd entry of {cattle_code} was voided on {date} ({reason}). The record is read-only and is not counted in the herd. |
| 64 | MSG-FE04-01 | Toast (success) | Pen created or updated | Pen {pen_code} has been saved. |
| 65 | MSG-FE04-02 | Inline (under field) | Pen code already used in the farm | Pen code {pen_code} already exists in this farm. |
| 66 | MSG-FE04-03 | Inline (under field) | Capacity invalid or below the headcount | Capacity must be a whole number of at least {min_capacity}. |
| 67 | MSG-FE04-04 | Toast (success) | Pen availability changed | Pen {pen_code} is now {status}. Cattle already in the pen stay there. |
| 68 | MSG-FE04-05 | Inline (dialog) | Destination pen INACTIVE or without enough free places | {pen_code} cannot receive {count} cattle: the pen is inactive or has only {free} free place(s). |
| 69 | MSG-FE04-06 | Inline (dialog) | A cattle does not meet the destination criteria | {cattle_code} does not meet the reception criteria of {pen_code}: {criteria}. Enter a reason to continue. |
| 70 | MSG-FE04-07 | Inline (dialog) | A selected cattle is already in the destination pen | {cattle_code} is already in {pen_code} and will be skipped. |
| 71 | MSG-FE04-08 | Toast (success) | Pen move saved | {moved} cattle moved to {pen_code}. |
| 72 | MSG-FE04-09 | Inline (under field) | Move date before the current placement or in the future | The move date must be between {start_date} and today. |
| 85 | MSG-FE06-01 | Toast (success) | Herd entry voucher posted | Voucher {voucher_code} posted: {count} cattle registered ({first_code} – {last_code}). |
| 86 | MSG-FE06-02 | Dialog | The draft calf is already registered | This calf is already registered as {cattle_code}. [Open profile] |
| 87 | MSG-FE06-03 | Inline (under field) | Entry date in the future or before a birth date | The entry date cannot be in the future or before the birth date. |
| 88 | MSG-FE06-04 | Inline (dialog) | The calving outcome is not LIVE | Only a live calf can be registered to the herd. |
| 89 | MSG-FE06-05 | Inline (after save) | Vaccination schedules match the new cattle | {count} vaccination schedule(s) match cattle of {voucher_code}. [Add to schedule] |
| 90 | MSG-FE06-06 | Toast (success) | Herd entry correction saved | The entry data of {cattle_code} has been corrected. The original values are kept in the history. |
| 91 | MSG-FE06-07 | Inline (dialog) | The correction breaks the date order or changes the sex of a cattle with reproductive events | This correction is not allowed: {reason}. |
| 92 | MSG-FE06-08 | Dialog (confirm) | The user voids the herd entry of one cattle | Void the herd entry of {cattle_code} on {voucher_code}? The cattle will be removed from active lists and its amount removed from the voucher total. |
| 93 | MSG-FE06-09 | Inline (dialog) | Void not allowed because events exist | This entry cannot be voided because {cattle_code} already has recorded events. |
| 94 | MSG-FE06-10 | Toast (success) | Herd entry voucher saved as draft | Voucher {voucher_code} saved as draft. No cattle has been created yet. |
| 95 | MSG-FE06-11 | Toast (success) | Calf registered with "Register now" at calving | Calf {cattle_code} has been registered from the calving of {dam_code} (voucher {voucher_code}). |
| 96 | MSG-FE06-12 | Toast (success) | Herd entry of one cattle voided | The herd entry of {cattle_code} has been voided. |
| 97 | MSG-FE06-13 | Inline (under field) | A paid, collected or payment amount exceeds the total or the outstanding amount | The amount cannot exceed {amount} đ. |
| 98 | MSG-FE06-14 | Toast (success) | Payment or collection recorded | {amount} đ recorded for {voucher_code}. Outstanding: {outstanding} đ. |
| 99 | MSG-FE06-15 | Dialog (confirm) | The user voids a recorded payment or collection | Void the payment of {amount} đ dated {date}? Enter the reason. It stays in the voucher history. |
| 100 | MSG-FE06-16 | Inline (form) | A voucher is saved for posting or confirmation without any line | Add at least one cattle to the voucher. |
| 101 | MSG-FE06-17 | Inline (checks) | A receiving pen will be full after posting | Pen {pen} will be full ({count}/{capacity}) after this voucher. |
| 102 | MSG-FE06-18 | Inline (import result) | Excel file checked | {total} rows: {valid} valid ({warnings} with warnings) · {errors} with errors. Rows with errors are not added – correct the file or add them by hand. |
| 103 | MSG-FE06-19 | Toast (success) | Valid rows added to the voucher | {count} cattle added to {voucher_code}. |
| 104 | MSG-FE06-20 | Dialog (confirm) | The user voids a posted entry voucher | Void voucher {voucher_code}? {count} cattle records will be voided, their pen places released and QR tags withdrawn. Payments of {paid} đ stay in the history. |
| 105 | MSG-FE06-21 | Inline (dialog) | Voucher void not allowed | Voucher {voucher_code} cannot be voided: {cattle_codes} already have other recorded events. Correct or void those entries one by one. |
| 106 | MSG-FE06-22 | Toast (success) | Entry voucher voided | Voucher {voucher_code} has been voided. |
| 107 | MSG-FE06-23 | Inline (after save) | Paid amount exceeds the new voucher total after a correction or void | The amount paid exceeds the new total by {amount} đ. Settle the difference outside BeefCare. |
| 108 | MSG-FE06-24 | Inline (checks) | A purchase voucher has no quarantine certificate number | No quarantine certificate entered. You can still post the voucher; attach or enter the certificate later if you receive one. |
| 163 | MSG-FE13-01 | Inline (checks) | Open items exist before confirming an exit voucher | {cattle_code}: {warnings}. Review them before confirming the exit. |
| 164 | MSG-FE13-02 | Toast (success) | Exit voucher confirmed | Voucher {voucher_code} confirmed: {count} cattle have left the herd. |
| 165 | MSG-FE13-03 | Inline (under field) | Exit date invalid | The exit date must be between {earliest_date} and today. |
| 166 | MSG-FE13-04 | Toast (success) | Pending death voucher dismissed | Voucher {voucher_code} dismissed. {cattle_code} stays in the herd. |
| 167 | MSG-FE13-05 | Toast (success) | Exit voucher voided | Voucher {voucher_code} has been voided. {count} cattle are back in the herd. Items cancelled by the exit are listed for review. |
| 168 | MSG-FE13-06 | Toast (success) | Exit voucher saved as draft | Voucher {voucher_code} saved as draft. The cattle stay in the herd until you confirm. |
| 169 | MSG-FE13-07 | Inline (line warning) | A cattle on a sale or cull voucher is in a meat withdrawal period after the exit date | {cattle_code} is in a meat withdrawal period until {date}. Selling for slaughter before this date breaks food safety rules – change the exit date or remove the cattle. |
| 170 | MSG-FE13-08 | Inline (dialog) | The cattle is already on another open exit voucher | {cattle_code} is already on voucher {voucher_code}. |
| 171 | MSG-FE13-09 | Inline (dialog) | The last pen cannot take the cattle back when voiding | Pen {pen} is not available or does not have enough places. Choose a pen for each cattle before voiding. |

## Phụ lục F – Nhắc việc liên quan

| ID | Tên | Điều kiện | Hạn | Kết thúc | Người nhận | Màn nguồn |
|---|---|---|---|---|---|---|
| REM-03 | Pregnancy check due | VALID breeding without a later check, or a pregnancy declared at herd entry without a later check (GBR-30). | Breeding time + 28 days; entry date + 7 days for a declared pregnancy. | Resolved by a check; superseded by a newer breeding; cancelled when the breeding is voided. | Owner, Manager, Technician | SCR-39 (record: popup "Record Pregnancy Check") |
| REM-08 | Pen move or life-stage suggestion | Pen move: ACTIVE cattle that no longer meets the effective reception criteria of its current pen (purpose type, life stage, sex, minimum age or weight). Life stage: ACTIVE cattle whose age reaches the next stage age (Unweaned calf → Weaned calf at the weaning age, 6 months; Weaned calf → Young stock at the young-stock age, 12 months; Young stock → Adult at the adult age, 24 months), or a female not yet Adult with a first VALID calving. No stage suggestion when the birth date is UNKNOWN. | Pen move: immediately. Life stage: the date the age is reached, or the calving date. | Pen move: resolved by a pen move or when the cattle meets the criteria again. Life stage: resolved by a life-stage change (UC-FE05-03). Both cancelled at exit. Suggestions never change pen or stage by themselves (GBR-25). | Owner, Manager, Technician | popup "Move Pen" or popup "Update Cattle Profile" |
| REM-09 | Draft calf awaiting confirmation | Calf outcome in PENDING_CONFIRMATION. | Immediately; highlighted after 3 days. | Resolved by registration or "died before registration"; cancelled when the calving is voided. | Owner, Manager | SCR-25 |
| REM-12 | Death or loss awaiting confirmation | PENDING DEATH herd exit voucher created when a health case was closed as DIED or MISSING (GBR-95). | Immediately; highlighted after 3 days. | Resolved when the Owner confirms or dismisses the voucher; cancelled when the voucher is voided or the case closure is corrected. | Owner, Manager | SCR-43 (Owner acts; a Manager sees the status) |

## Phụ lục G – DDL PostgreSQL V1 (các bảng liên quan)

Các trường mới 27/10 ở mục 2.1 chưa có trong DDL này.

```sql
CREATE TABLE pen (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id                uuid        NOT NULL REFERENCES farm(id),
  code                   text        NOT NULL CHECK (code ~ '^[A-Za-z0-9-]{1,20}$'),
  name                   text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  capacity               int         NOT NULL CHECK (capacity BETWEEN 1 AND 9999),
  description            text,
  status                 text        NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  status_effective_date  date,
  status_reason          text,
  created_by             uuid        NOT NULL REFERENCES user_account(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  version                int         NOT NULL DEFAULT 0,
  CONSTRAINT uq_pen_farm_id UNIQUE (farm_id, id)
);

CREATE TABLE pen_criteria_version (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id             uuid        NOT NULL,
  pen_id              uuid        NOT NULL,
  version_no          int         NOT NULL CHECK (version_no >= 1),
  purpose_types       text[]      CHECK (purpose_types <@ ARRAY['BREEDING','FATTENING','SIRE','UNDECIDED']),
  life_stages         text[]      CHECK (life_stages <@ ARRAY['UNWEANED_CALF','WEANED_CALF','YOUNG_STOCK','ADULT']),
  sex                 text        CHECK (sex IS NULL OR sex IN ('MALE','FEMALE')),
  min_age_months      int         CHECK (min_age_months IS NULL OR min_age_months BETWEEN 0 AND 240),
  min_weight_kg       numeric(7,2) CHECK (min_weight_kg IS NULL OR min_weight_kg BETWEEN 1 AND 1500),
  effective_from      date        NOT NULL,
  changed_by          uuid        NOT NULL REFERENCES user_account(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_pen_criteria_version UNIQUE (pen_id, version_no),
  CONSTRAINT uq_pen_criteria_farm_id UNIQUE (farm_id, id),
  FOREIGN KEY (farm_id, pen_id) REFERENCES pen (farm_id, id)
);

CREATE TABLE cattle (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),       -- Internal Cattle ID (BR-D07)
  farm_id               uuid        NOT NULL REFERENCES farm(id),
  display_code          text        NOT NULL CHECK (display_code ~ '^BC-[0-9]{6}$'),
  secondary_ear_tag     text,
  name                  text,
  sex                   text        NOT NULL CHECK (sex IN ('MALE','FEMALE')),
  breed_id              uuid        NOT NULL,
  birth_date            date,                                             -- for ESTIMATED: 1st day of month
  birth_date_accuracy   text        NOT NULL CHECK (birth_date_accuracy IN ('EXACT','ESTIMATED','UNKNOWN')),
  colour_markings       text,
  purpose_id            uuid        NOT NULL,
  life_stage            text        NOT NULL CHECK (life_stage IN ('UNWEANED_CALF','WEANED_CALF','YOUNG_STOCK','ADULT')),
  herd_status           text        NOT NULL DEFAULT 'ACTIVE' CHECK (herd_status IN ('ACTIVE','EXITED','VOIDED')),
  exit_type             text        CHECK (exit_type IS NULL OR exit_type IN ('SALE','CULL','DEATH','OTHER')),
  exit_date             date,
  void_reason           text,
  dam_id                uuid,
  sire_id               uuid,
  external_sire_code    text,                                             -- external sire / semen code
  created_by            uuid        NOT NULL REFERENCES user_account(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  version               int         NOT NULL DEFAULT 0,
  CONSTRAINT uq_cattle_farm_id UNIQUE (farm_id, id),
  CONSTRAINT uq_cattle_display_code UNIQUE (farm_id, display_code),       -- BR-D07
  FOREIGN KEY (farm_id, breed_id)   REFERENCES breed (farm_id, id),
  FOREIGN KEY (farm_id, purpose_id) REFERENCES production_purpose (farm_id, id),
  FOREIGN KEY (farm_id, dam_id)     REFERENCES cattle (farm_id, id),
  FOREIGN KEY (farm_id, sire_id)    REFERENCES cattle (farm_id, id),
  CONSTRAINT ck_cattle_birth  CHECK (birth_date_accuracy = 'UNKNOWN' OR birth_date IS NOT NULL),
  CONSTRAINT ck_cattle_exit   CHECK ((herd_status = 'EXITED') = (exit_type IS NOT NULL AND exit_date IS NOT NULL)),
  CONSTRAINT ck_cattle_void   CHECK (herd_status <> 'VOIDED' OR void_reason IS NOT NULL),
  CONSTRAINT ck_cattle_parent CHECK (dam_id IS DISTINCT FROM id AND sire_id IS DISTINCT FROM id),
  CONSTRAINT ck_cattle_sire   CHECK (sire_id IS NULL OR external_sire_code IS NULL)
);

CREATE TABLE cattle_qr_tag (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id             uuid        NOT NULL,
  cattle_id           uuid        NOT NULL,
  tag_code            text        NOT NULL UNIQUE,                 -- globally unique; opens the profile only for signed-in farm members (GBR-28)
  status              text        NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REPLACED','RETIRED')),
  issued_by           uuid        NOT NULL REFERENCES user_account(id),
  issued_at           timestamptz NOT NULL DEFAULT now(),
  replacement_reason  text        CHECK (replacement_reason IS NULL OR replacement_reason IN ('LOST','DAMAGED','OTHER')),
  note                text,
  replaced_by_tag_id  uuid        REFERENCES cattle_qr_tag(id),
  closed_at           timestamptz,
  version             int         NOT NULL DEFAULT 0,
  FOREIGN KEY (farm_id, cattle_id) REFERENCES cattle (farm_id, id),
  CONSTRAINT ck_tag_replaced CHECK (status <> 'REPLACED' OR (replaced_by_tag_id IS NOT NULL AND replacement_reason IS NOT NULL))
);

CREATE TABLE pen_assignment (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id              uuid        NOT NULL,
  cattle_id            uuid        NOT NULL,
  pen_id               uuid        NOT NULL,
  from_date            date        NOT NULL,
  to_date              date,                                       -- NULL = OPEN (exclusive end)
  source               text        NOT NULL CHECK (source IN ('HERD_ENTRY','MOVE','CORRECTION')),
  reason               text,
  criteria_version_id  uuid,
  reception_check      jsonb,                                      -- per-criterion Met / Not met / N/A
  warning_reason       text,
  moved_by             uuid        NOT NULL REFERENCES user_account(id),
  recorded_at          timestamptz NOT NULL DEFAULT now(),
  version              int         NOT NULL DEFAULT 0,
  FOREIGN KEY (farm_id, cattle_id) REFERENCES cattle (farm_id, id),
  FOREIGN KEY (farm_id, pen_id)    REFERENCES pen (farm_id, id),
  FOREIGN KEY (farm_id, criteria_version_id) REFERENCES pen_criteria_version (farm_id, id),
  CONSTRAINT ck_assignment_dates CHECK (to_date IS NULL OR to_date >= from_date),
  CONSTRAINT ex_assignment_no_overlap EXCLUDE USING gist
    (cattle_id WITH =, daterange(from_date, to_date, '[)') WITH &&)                    -- BR-D09
);

CREATE TABLE trading_partner (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id      uuid        NOT NULL REFERENCES farm(id),
  name         text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 150),
  is_seller    boolean     NOT NULL DEFAULT false,
  is_buyer     boolean     NOT NULL DEFAULT false,
  is_supplier  boolean     NOT NULL DEFAULT false,
  contact_phone text,
  address      text,
  note         text,
  status       text        NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_by   uuid        NOT NULL REFERENCES user_account(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  version      int         NOT NULL DEFAULT 0,
  CONSTRAINT uq_partner_farm_id UNIQUE (farm_id, id),
  CONSTRAINT ck_partner_has_role CHECK (is_seller OR is_buyer OR is_supplier)
);

CREATE TABLE herd_entry_voucher (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id             uuid        NOT NULL REFERENCES farm(id),
  code                text        NOT NULL CHECK (code ~ '^PN-[0-9]{4}-[0-9]{4,}$'),
  entry_type          text        NOT NULL CHECK (entry_type IN ('PURCHASE','FARM_BORN')),
  entry_date          date        NOT NULL,
  seller_id           uuid,
  quarantine_cert_no  text,
  vehicle_plate       text,
  note                text,
  pricing_basis       text        CHECK (pricing_basis IS NULL OR pricing_basis IN ('PER_KG','PER_HEAD')),
  cattle_amount       bigint      NOT NULL DEFAULT 0 CHECK (cattle_amount >= 0),
  transport_fee       bigint      NOT NULL DEFAULT 0 CHECK (transport_fee >= 0),
  total_payable       bigint      GENERATED ALWAYS AS (cattle_amount + transport_fee) STORED,
  amount_paid         bigint      NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  outstanding_amount  bigint      GENERATED ALWAYS AS (cattle_amount + transport_fee - amount_paid) STORED,
  payment_due_date    date,
  status              text        NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','POSTED','VOIDED')),
  created_by          uuid        NOT NULL REFERENCES user_account(id),
  posted_by           uuid        REFERENCES user_account(id),
  posted_at           timestamptz,
  void_reason         text,
  voided_by           uuid        REFERENCES user_account(id),
  voided_at           timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  version             int         NOT NULL DEFAULT 0,
  CONSTRAINT uq_entry_voucher_code UNIQUE (farm_id, code),                         -- BR-D34
  CONSTRAINT uq_entry_voucher_farm_id UNIQUE (farm_id, id),
  FOREIGN KEY (farm_id, seller_id) REFERENCES trading_partner (farm_id, id),
  CONSTRAINT ck_entry_purchase_seller CHECK (entry_type <> 'PURCHASE' OR seller_id IS NOT NULL),                                       -- Seller * (SCR-34)
  CONSTRAINT ck_entry_farm_born_no_amount CHECK (entry_type <> 'FARM_BORN' OR (cattle_amount = 0 AND transport_fee = 0 AND seller_id IS NULL)),  -- GBR-93
  CONSTRAINT ck_entry_paid_within_total CHECK (amount_paid <= cattle_amount + transport_fee),                                        -- BR-D39
  CONSTRAINT ck_entry_posted CHECK (status = 'DRAFT' OR posted_at IS NOT NULL),
  CONSTRAINT ck_entry_voided CHECK (status <> 'VOIDED' OR (void_reason IS NOT NULL AND voided_at IS NOT NULL))
);

CREATE TABLE herd_entry (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id            uuid        NOT NULL,
  voucher_id         uuid        NOT NULL,
  line_no            int         NOT NULL CHECK (line_no >= 1),
  cattle_id          uuid,                                          -- set when the voucher is posted
  draft_data         jsonb,                                         -- line data while DRAFT (code, tag, breed, sex, birth...)
  source             text        NOT NULL CHECK (source IN ('EXTERNAL','FARM_BORN')),
  entry_date         date        NOT NULL,
  entry_weight_kg    numeric(7,2) CHECK (entry_weight_kg IS NULL OR entry_weight_kg > 0),
  weight_basis       text        CHECK (weight_basis IS NULL OR weight_basis IN ('MEASURED','ESTIMATED')),
  unit_price         bigint      CHECK (unit_price IS NULL OR unit_price >= 0),
  line_amount        bigint      NOT NULL DEFAULT 0 CHECK (line_amount >= 0),
  calf_outcome_id    uuid,                                          -- FK added in E
  initial_pen_id     uuid        NOT NULL,
  status             text        NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','VALID','VOID')),
  is_corrected       boolean     NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  version            int         NOT NULL DEFAULT 0,
  CONSTRAINT uq_entry_line UNIQUE (voucher_id, line_no),
  CONSTRAINT uq_entry_farm_id UNIQUE (farm_id, id),
  FOREIGN KEY (farm_id, voucher_id)     REFERENCES herd_entry_voucher (farm_id, id),
  FOREIGN KEY (farm_id, cattle_id)      REFERENCES cattle (farm_id, id),
  FOREIGN KEY (farm_id, initial_pen_id) REFERENCES pen (farm_id, id),
  CONSTRAINT ck_entry_cattle CHECK (status = 'DRAFT' OR cattle_id IS NOT NULL),
  CONSTRAINT ck_entry_weight_basis CHECK (entry_weight_kg IS NULL OR weight_basis IS NOT NULL)
);

CREATE TABLE pre_entry_history_declaration (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id          uuid        NOT NULL,
  herd_entry_id    uuid        NOT NULL,
  category         text        NOT NULL CHECK (category IN ('VACCINATION','DISEASE','REPRODUCTION')),
  status           text        NOT NULL CHECK (status IN ('KNOWN','NONE','UNKNOWN')),
  items            jsonb,                                            -- item lines when KNOWN
  information_source text,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  version          int         NOT NULL DEFAULT 0,
  CONSTRAINT uq_declaration UNIQUE (herd_entry_id, category),
  FOREIGN KEY (farm_id, herd_entry_id) REFERENCES herd_entry (farm_id, id),
  CONSTRAINT ck_declaration_items CHECK (status <> 'KNOWN' OR items IS NOT NULL)
);

CREATE TABLE herd_exit_voucher (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id             uuid        NOT NULL REFERENCES farm(id),
  code                text        NOT NULL CHECK (code ~ '^PX-[0-9]{4}-[0-9]{4,}$'),
  exit_type           text        NOT NULL CHECK (exit_type IN ('SALE','CULL','DEATH','OTHER')),
  exit_date           date        NOT NULL,
  buyer_id            uuid,
  destination         text,
  transport_cert_no   text,
  vehicle_plate       text,
  notes               text,
  loss_kind           text        CHECK (loss_kind IS NULL OR loss_kind IN ('DIED','MISSING')),
  death_cause         text,
  carcass_disposal    text,
  source_health_case_id uuid,                                        -- FK added in D
  pricing_basis       text        CHECK (pricing_basis IS NULL OR pricing_basis IN ('PER_KG','PER_HEAD')),
  cattle_amount       bigint      NOT NULL DEFAULT 0 CHECK (cattle_amount >= 0),
  deductions          bigint      NOT NULL DEFAULT 0 CHECK (deductions >= 0),
  total_receivable    bigint      GENERATED ALWAYS AS (cattle_amount - deductions) STORED,
  amount_collected    bigint      NOT NULL DEFAULT 0 CHECK (amount_collected >= 0),
  outstanding_amount  bigint      GENERATED ALWAYS AS (cattle_amount - deductions - amount_collected) STORED,
  collection_due_date date,
  status              text        NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT','PENDING','CONFIRMED','DISMISSED','VOIDED')),
  reported_by         uuid        NOT NULL REFERENCES user_account(id),
  confirmed_by        uuid        REFERENCES user_account(id),
  confirmed_at        timestamptz,
  close_reason        text,                                           -- dismiss or void reason
  closed_by           uuid        REFERENCES user_account(id),
  closed_at           timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  version             int         NOT NULL DEFAULT 0,
  CONSTRAINT uq_exit_voucher_code UNIQUE (farm_id, code),
  CONSTRAINT uq_exit_voucher_farm_id UNIQUE (farm_id, id),
  FOREIGN KEY (farm_id, buyer_id) REFERENCES trading_partner (farm_id, id),
  CONSTRAINT ck_exit_death CHECK (exit_type <> 'DEATH' OR (loss_kind IS NOT NULL AND cattle_amount = 0 AND deductions = 0)),
  CONSTRAINT ck_exit_amounts CHECK (deductions <= cattle_amount AND amount_collected <= cattle_amount - deductions),
  CONSTRAINT ck_exit_confirmed CHECK (status NOT IN ('CONFIRMED','VOIDED') OR confirmed_at IS NOT NULL),
  CONSTRAINT ck_exit_closed CHECK (status NOT IN ('DISMISSED','VOIDED') OR close_reason IS NOT NULL)
);

CREATE TABLE herd_exit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id         uuid        NOT NULL,
  voucher_id      uuid        NOT NULL,
  line_no         int         NOT NULL CHECK (line_no >= 1),
  cattle_id       uuid        NOT NULL,
  exit_weight_kg  numeric(7,2) CHECK (exit_weight_kg IS NULL OR exit_weight_kg > 0),
  weight_basis    text        CHECK (weight_basis IS NULL OR weight_basis IN ('MEASURED','ESTIMATED','LATEST')),
  unit_price      bigint      CHECK (unit_price IS NULL OR unit_price >= 0),
  line_amount     bigint      NOT NULL DEFAULT 0 CHECK (line_amount >= 0),
  check_results   jsonb,                                              -- withdrawal, open cases, doses, pregnancy, draft calves
  last_pen_id     uuid,
  status          text        NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN ('DRAFT','PENDING','CONFIRMED','REMOVED','DISMISSED','VOIDED')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  version         int         NOT NULL DEFAULT 0,
  CONSTRAINT uq_exit_line UNIQUE (voucher_id, line_no),
  FOREIGN KEY (farm_id, voucher_id)  REFERENCES herd_exit_voucher (farm_id, id),
  FOREIGN KEY (farm_id, cattle_id)   REFERENCES cattle (farm_id, id),
  FOREIGN KEY (farm_id, last_pen_id) REFERENCES pen (farm_id, id)
);

CREATE TABLE voucher_payment (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id            uuid        NOT NULL REFERENCES farm(id),
  entry_voucher_id   uuid,
  exit_voucher_id    uuid,
  feed_receipt_id    uuid,                                            -- FK added in F
  direction          text        NOT NULL CHECK (direction IN ('PAY','COLLECT')),
  payment_date       date        NOT NULL,
  amount             bigint      NOT NULL CHECK (amount > 0),
  method             text        NOT NULL CHECK (method IN ('CASH','BANK_TRANSFER')),
  reference          text,
  note               text,
  status             text        NOT NULL DEFAULT 'RECORDED' CHECK (status IN ('RECORDED','VOIDED')),
  recorded_by        uuid        NOT NULL REFERENCES user_account(id),
  recorded_at        timestamptz NOT NULL DEFAULT now(),
  void_reason        text,
  voided_by          uuid        REFERENCES user_account(id),
  voided_at          timestamptz,
  version            int         NOT NULL DEFAULT 0,
  FOREIGN KEY (farm_id, entry_voucher_id) REFERENCES herd_entry_voucher (farm_id, id),
  FOREIGN KEY (farm_id, exit_voucher_id)  REFERENCES herd_exit_voucher (farm_id, id),
  CONSTRAINT ck_payment_one_voucher CHECK (num_nonnulls(entry_voucher_id, exit_voucher_id, feed_receipt_id) = 1),
  CONSTRAINT ck_payment_direction CHECK ((exit_voucher_id IS NOT NULL) = (direction = 'COLLECT')),
  CONSTRAINT ck_payment_void CHECK (status = 'RECORDED' OR void_reason IS NOT NULL)
);

CREATE TABLE cattle_profile_change (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  farm_id         uuid        NOT NULL,
  cattle_id       uuid        NOT NULL,
  field_group     text        NOT NULL CHECK (field_group IN ('PURPOSE','LIFE_STAGE','EAR_TAG','DESCRIPTIVE')),
  old_value       jsonb,
  new_value       jsonb       NOT NULL,
  effective_date  date        NOT NULL,
  reason          text        NOT NULL,
  changed_by      uuid        NOT NULL REFERENCES user_account(id),
  changed_at      timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (farm_id, cattle_id) REFERENCES cattle (farm_id, id)
);

CREATE TABLE code_sequence (
  scope_id     uuid        NOT NULL,             -- farm id, or the nil uuid for platform codes
  code_type    text        NOT NULL CHECK (code_type IN
                 ('CATTLE','HERD_ENTRY','HERD_EXIT','FEED_RECEIPT','STOCK_ADJUSTMENT','HEALTH_CASE',
                  'FEED_ITEM','QR_TAG','TICKET','INTERNAL_REQUEST','FINANCE_RECORD','RECEIPT','CASH_SNAPSHOT')),
  period_year  int         NOT NULL DEFAULT 0,   -- 0 = not reset yearly
  last_value   bigint      NOT NULL DEFAULT 0 CHECK (last_value >= 0),
  PRIMARY KEY (scope_id, code_type, period_year)
);

CREATE OR REPLACE FUNCTION fn_pen_capacity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cap int; cnt int;
BEGIN
  IF NEW.to_date IS NOT NULL THEN RETURN NEW; END IF;
  SELECT capacity INTO cap FROM pen WHERE id = NEW.pen_id FOR UPDATE;
  SELECT count(*) INTO cnt FROM pen_assignment WHERE pen_id = NEW.pen_id AND to_date IS NULL AND id <> NEW.id;
  IF cnt + 1 > cap THEN
    RAISE EXCEPTION 'Pen is full (% / %) (BR-D09)', cnt, cap USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_pen_capacity_guard BEFORE INSERT OR UPDATE OF pen_id, to_date ON pen_assignment
  FOR EACH ROW EXECUTE FUNCTION fn_pen_capacity_guard();

CREATE VIEW v_cattle_current_pen AS
SELECT pa.farm_id, pa.cattle_id, pa.pen_id, p.code AS pen_code, p.name AS pen_name, pa.from_date
FROM pen_assignment pa JOIN pen p ON p.id = pa.pen_id
WHERE pa.to_date IS NULL;

CREATE VIEW v_herd_entry_voucher_payment AS
SELECT id, farm_id, code, total_payable, amount_paid, outstanding_amount,
       CASE WHEN total_payable = 0 OR amount_paid >= total_payable THEN 'PAID'
            WHEN amount_paid = 0 THEN 'UNPAID' ELSE 'PARTLY_PAID' END AS payment_status
FROM herd_entry_voucher WHERE status = 'POSTED';
```
