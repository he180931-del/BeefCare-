# SPEC FE-11 – Động dục và phối giống

| | |
|---|---|
| Feature | FE-11 Estrus and Breeding Recording |
| Use case | UC-FE11-01 → UC-FE11-04 |
| Người phụ trách | TuanPQ (BE + FE + test) · Review BE: AnNT · Review FE: LamKD |
| Nguồn duy nhất | SRS 28/10/2026: Part I §3.2 (Estrus Event, Breeding Event), §3.4.3 (Table 3.4-3), Part II §11, Part III §11 (SCR-38, SCR-39, 3 popup), MSG-FE11, GBR-08, 30, 48 → 55, 59, 106; REM-02, REM-03, REM-07 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 theo SRS 28/10 (quyết định D12); từ 28/11/2026 đối chiếu `docs/requirements/SRS_Report3_v1.2.txt` (D90) |

> Mọi dòng lấy từ SRS. Route ở mục 7 lấy theo code hiện có chỉ để nối API; dữ liệu vào / ra và mã lỗi theo SRS. Nhãn VN theo Table 3.4-1 / 3.4-3 và Figma tab 05.
> SCR-38 và SCR-39 dùng chung với FE-12 (khám thai, mang thai, đẻ). Spec này mô tả toàn bộ hai màn hình; các popup khám thai / cập nhật thai / đẻ ở spec FE-12.

### Tham chiếu chéo FE-11 ↔ FE-12 (D67)

| Muốn biết | Xem |
|---|---|
| Bảng trạng thái sinh sản, nút nào hiện ở trạng thái nào | FE-11 §3.3 |
| Điều kiện phối (tuổi, cân, sức khỏe, sau đẻ) | FE-11 §3.4 |
| Khám thai, mở / đóng thai, ngày đẻ dự kiến | FE-12 §4 (R-12-01 → R-12-05) |
| Ghi đẻ, kết quả bê, đăng ký bê | FE-12 §4, SCR-40 |
| Sửa / hủy bản ghi sinh sản (chung route `reproduction-events/{id}/correction`) | FE-11 R-11-11 và FE-12 R-12-15; thông báo MSG-FE11-07 |

---

## 1. Phạm vi

| UC | Tên | Tác nhân | Màn hình |
|---|---|---|---|
| UC-FE11-01 | Xem danh sách sinh sản, trạng thái, điều kiện phối, khung phối, dòng thời gian sinh sản | Owner, Manager, Technician | SCR-38, SCR-39 |
| UC-FE11-02 | Ghi động dục | Owner, Manager | Popup Ghi động dục |
| UC-FE11-03 | Ghi phối giống | Owner, Manager | Popup Ghi phối giống |
| UC-FE11-04 | Sửa / hủy bản ghi động dục, phối giống | Owner, Manager | Popup Sửa / Hủy động dục hoặc phối giống |

**Nguyên tắc:** mọi thao tác ghi bắt đầu từ hồ sơ bò cái (tab Sinh sản, SCR-39); SCR-38 **không** có nút ghi (GBR-48, SCR-38).

---

## 2. Vai trò và quyền

| Hành động | Owner | Manager | Technician |
|---|---|---|---|
| Xem SCR-38, SCR-39 | Có | Có | Có (điện thoại: 3 tab) |
| Ghi động dục, phối, sửa, hủy | Có (D41) | Có | — (có thể là người quan sát / thực hiện) |

---

## 3. Dữ liệu

### 3.1 Động dục (Estrus Event)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc | Nguồn |
|---|---|---|---|---|
| Bò cái | Tham chiếu | Có | ACTIVE, đã đăng ký, thuộc diện theo dõi sinh sản | UC-02 PRE-2 |
| Thời điểm quan sát | Ngày giờ | Có | Không tương lai, không trước ngày nhập đàn | Popup |
| Người quan sát | Thành viên ACTIVE (gồm Technician) | Không | Mặc định người ghi | Popup |
| Dấu hiệu | Chọn nhiều, không bắt buộc | — | `STANDING` (Đứng yên cho nhảy), `MOUNTING` (Nhảy lên con khác), `BELLOWING` (Kêu rống / bồn chồn), `MUCUS` (Chảy dịch trong), `SWOLLEN_VULVA` (Âm hộ sưng đỏ) | §3.2, Popup |
| Mô tả | Chuỗi dài | Không | ≤ 1.000 | Popup |
| Người ghi, thời điểm ghi | — | — | Lưu riêng với người quan sát và thời điểm xảy ra | GBR-49 |
| Trạng thái | Enum | — | `VALID` → `VOIDED`; sửa giữ VALID + "Đã sửa" | §3.2 |

### 3.2 Phối giống (Breeding Event)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc | Nguồn |
|---|---|---|---|---|
| Bò cái | Tham chiếu | Có | Không có thai OPEN | UC-03 PRE-2 |
| Thời điểm phối | Ngày giờ | Có | Không tương lai; không trước lần động dục liên kết | Popup |
| Nguồn dữ liệu | Enum | — | Quan sát trực tiếp (mặc định) / Sổ trại / Báo cáo bên ngoài | Popup |
| Phương pháp | Enum | Có | `NATURAL` (Phối tự nhiên) / `AI` (Thụ tinh nhân tạo) | Popup |
| Nguồn đực giống | Enum | Có | `INTERNAL` (Trong trại) / `EXTERNAL` (Bên ngoài) | Popup |
| Đực giống trong trại | Bò | Có khi INTERNAL | Bò **đực**, ACTIVE, **khác con**, cùng trại | GBR-48 |
| Giống đực / giống tinh | Chuỗi hoặc giống | Có khi EXTERNAL | — | Popup |
| Mã cọng / lô tinh | Chuỗi | Không | ≤ 50 (AI) | Popup |
| Nhà cung cấp tinh | Chuỗi | Không | ≤ 100 (AI) | Popup |
| Người thực hiện | Thành viên hoặc tên ngoài (dẫn tinh viên) | Không | Tên ngoài ≤ 100 | Popup |
| Động dục liên kết | Tham chiếu | Không | Động dục VALID của bò trong 72 giờ gần nhất | Popup, GBR-50 |
| Ngày đẻ dự kiến (tạm tính) | Suy ra | — | Thời điểm phối + thời gian mang thai (tham số, mặc định 283 ngày) | GBR-53 |
| Ghi chú | Chuỗi dài | Không | ≤ 500 | Popup |
| Trạng thái | Enum | — | `VALID` → `VOIDED`; sửa giữ VALID + "Đã sửa" | §3.2 |

### 3.3 Trạng thái sinh sản (suy ra – GBR-54, Table 3.4-3)

**Áp dụng cho:** bò cái ACTIVE ở giai đoạn YOUNG_STOCK hoặc ADULT có loại mục đích BREEDING hoặc UNDECIDED, **và** mọi bò cái có thai OPEN. Bò khác: "Không áp dụng".

| Trạng thái (nhãn VN) | Khi nào | Nút ghi được phép |
|---|---|---|
| `AWAITING_BREEDING` Chờ phối | Không có động dục hiện tại, phối, thai, giai đoạn sau sinh (kể cả sau khám KHÔNG CÓ THAI hoặc sẩy thai) | Ghi động dục, Ghi phối |
| `IN_ESTRUS` Động dục | Động dục trong 24 giờ qua, chưa phối sau đó | Ghi động dục, Ghi phối |
| `BRED` Đã phối – chờ khám thai | Có phối, chưa có động dục / khám sau đó; hoặc sau khám CHƯA RÕ | Ghi động dục, Ghi khám thai, Ghi đẻ |
| `PREGNANT` Mang thai ("Sắp đẻ" khi trong số ngày chuẩn bị đẻ, mặc định 30) | Có thai OPEN | Ghi khám thai, Ghi cập nhật thai, Ghi đẻ |
| `POST_CALVING` Sau sinh | Đẻ trong khoảng sau sinh (mặc định 45 ngày), chưa có động dục / phối sau đó | Ghi động dục, Ghi phối |

"Thao tác khác" (Manager, mọi bò cái ACTIVE YOUNG_STOCK / ADULT): Ghi khám thai; Ghi đẻ (thai không theo dõi).

| Chuyển trạng thái | Kết quả |
|---|---|
| Chờ phối / Sau sinh + ghi động dục | Động dục (tạo REM-02) |
| Động dục + 24 giờ không phối | Chờ phối |
| Chờ phối / Động dục / Sau sinh + ghi phối | Đã phối (ngày đẻ tạm tính, REM-03) |
| Đã phối + động dục mới | Động dục (hủy ngày đẻ tạm tính) |
| Đã phối + khám KHÔNG CÓ THAI | Chờ phối |
| Đã phối + khám CHƯA RÕ | Đã phối (REM-04) |
| Bất kỳ + khám CÓ THAI | Mang thai |
| Mang thai + đẻ | Sau sinh (REM-07) |
| Mang thai + sẩy thai | Chờ phối |
| Sau sinh + hết khoảng sau sinh | Chờ phối |

### 3.4 Điều kiện phối (GBR-55) – chỉ khuyến nghị

"Đạt" khi đủ: tuổi tối thiểu (tham số, mặc định 13 tháng), cân tối thiểu (tham số, mặc định 230 kg, dùng cân VALID mới nhất), không có ca sức khỏe OPEN, và – với bò đã từng đẻ – đủ số ngày sau đẻ (tham số "Sau sinh", mặc định 45 ngày; tiêu chí `POSTPARTUM_INTERVAL`, D67). Bò chỉ thiếu lần cân thì huy hiệu tổng là "Cần cân lại" (vàng). Ngược lại "Chưa đạt" kèm điều kiện chưa đạt. Hiện cho Chờ phối, Động dục, Sau sinh. **Không chặn** việc ghi phối thật.

### 3.5 Khung phối (REM-02)
Thời điểm động dục + 8 giờ → + 12 giờ (tham số trại). Thiếu tham số → MSG-FE11-08, không gợi ý. Hiển thị bằng một dòng chữ (khung giờ + "Gợi ý theo tham số trại; thời điểm chịu đực thay đổi theo từng con"), không vẽ thanh 24 giờ (D67).

### 3.6 Chỉ số sinh sản từng con (GBR-106)
Tuổi đẻ lứa đầu, khoảng cách lứa gần nhất, số ngày từ lần đẻ cuối, số ngày trống (chu kỳ hiện tại hoặc gần nhất), thành tích thụ thai (ví dụ "3 lần có thai / 5 lần phối"); huy hiệu "Quá hạn thụ thai" khi chưa có thai quá (khoảng sau sinh + 3 × chu kỳ động dục) ngày sau lần đẻ cuối (mặc định 108). Chưa áp dụng → "—". Chỉ dùng sự kiện VALID.

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-11-01 | Sự kiện sinh sản thuộc đúng một bò cái của trại; bản ghi liên kết phải cùng trại; đực giống trong trại phải là bò **đực khác** của trại → MSG-FE11-04. | GBR-48 |
| R-11-02 | Lưu riêng thời điểm xảy ra và thời điểm ghi; người ghi và người quan sát / thực hiện; giá trị không biết để trống; thời điểm không ở tương lai. Gợi ý / nhắc việc / thời gian trôi qua không bao giờ là bằng chứng sự kiện đã xảy ra. | GBR-49 |
| R-11-03 | Có động dục cùng bò trong vòng 12 giờ → hỏi MSG-FE11-03 (vẫn lưu được). | UC-02 AF1, §3.2 |
| R-11-04 | Bò đang có thai OPEN: không ghi động dục / phối → MSG-FE11-05. | UC-02 AF2, UC-03 E3 |
| R-11-05 | Liên kết phối – động dục là tùy chọn; hệ thống đề xuất động dục VALID mới nhất trong 72 giờ; không có thì để "Không có" và **không tự tạo động dục**. Thời điểm phối không trước động dục liên kết → MSG-FE11-10. | GBR-50 |
| R-11-06 | Phối giống **không** xác lập mang thai; chỉ khám CÓ THAI mới mở thai. | GBR-51 |
| R-11-07 | Sau phối: ngày đẻ tạm tính = phối + thời gian mang thai; thay ngày tạm tính cũ; tạo REM-03 (phối + 28 ngày). Thiếu tham số → lưu, không có ngày dự kiến (MSG-FE11-08). Động dục mới sau phối → hủy ngày tạm tính. | GBR-53, REM-03 |
| R-11-08 | Phối lần hai trong cùng chu kỳ động dục được phép; ngày tạm tính theo lần phối mới nhất. | UC-03 AF3 |
| R-11-09 | Điều kiện phối "Chưa đạt" → cảnh báo MSG-FE11-09, vẫn lưu được. | GBR-55 |
| R-11-09a | Cân dùng cho điều kiện phối chỉ lấy từ bản ghi cân VALID (GBR-39); cân lúc nhập đàn **không** tính. Chưa có lần cân → tiêu chí cân không đạt, hiện "Chưa có lần cân"; "Cân gần nhất" để trống; việc tiếp theo "Theo dõi cân" (chốt TuanPQ 15/11/2026). | GBR-39, GBR-55 |
| R-11-10 | Nút ghi chỉ hiện theo trạng thái (§3.3); bò không thuộc diện → panel "Không áp dụng" kèm lý do và MSG-FE11-11, dòng thời gian vẫn xem được. | GBR-54 |
| R-11-11 | Sửa / xóa (D69: hai nút riêng **Sửa** và **Xóa**; xóa = popup xác nhận, bản ghi đã xóa không hiện ở dòng thời gian): Owner hoặc Manager (D41), ghi chú **không bắt buộc** (D69, như D43 / D53), kèm version; giữ giá trị gốc (Record Revision). Không được làm mồ côi hay mâu thuẫn bản ghi sau (khám thai, thai, cập nhật thai, đẻ, bê đã đăng ký) → MSG-FE11-07 liệt kê các bản ghi đó; không bao giờ xóa dây chuyền. | GBR-59, BR-D15 |
| R-11-12 | Sau ghi / sửa / hủy: tính lại trạng thái, ngày dự kiến, nhắc việc (REM-02, REM-03, REM-07) qua JOB-01. | UC-02, 03, 04 |
| R-11-13 | Chỉ số GBR-106: chỉ dùng sự kiện VALID; n < 3 → "Chưa đủ dữ liệu" (ở báo cáo đàn). | GBR-106 |

---

## 5. Luồng xử lý

### UC-FE11-02 Ghi động dục
Popup → thời điểm, người quan sát, dấu hiệu, mô tả → **Lưu động dục** → kiểm thời gian, R-11-03 → lưu → trạng thái Động dục, REM-02 → MSG-FE11-01 kèm khung phối gợi ý.
AF2 bò đang mang thai → MSG-FE11-05 · AF3 thiếu tham số → MSG-FE11-08.
E1 thiếu thời điểm → MSG-COM-06 · E2 → MSG-COM-07 / 15 · E3 bò EXITED → MSG-COM-13.

### UC-FE11-03 Ghi phối giống
1. Popup: bò cái (tiêu đề có số lần phối trong chu kỳ), điều kiện phối, động dục liên kết đề xuất.
2. Nhập thời điểm phối, nguồn dữ liệu, phương pháp, nguồn đực giống.
3. Trong trại → chọn bò đực; Bên ngoài / AI → giống, mã cọng tinh, nhà cung cấp.
4. Người thực hiện, ghi chú; hệ thống hiện ngày đẻ tạm tính.
5. **Lưu phối giống** → kiểm R-11-01, R-11-04, R-11-05 → lưu → Đã phối, REM-03 → MSG-FE11-02.

### UC-FE11-04 Sửa / hủy
Popup → Sửa (động dục: thời điểm, mô tả, người quan sát; phối: thời điểm, nguồn dữ liệu, phương pháp, đực giống, mã tinh, người thực hiện, động dục liên kết) hoặc Hủy → lý do → **Lưu** → R-11-11 → R-11-12 → MSG-FE11-06.

### UC-FE11-01 Xem
SCR-38 → bấm dòng → SCR-39 của bò cái.

---

## 6. Màn hình và trường

### SCR-38 Danh sách sinh sản

| # | Trường | Loại | Nội dung |
|---|---|---|---|
| 1 | Ô: In estrus / Đang động dục | Số | Bò cái trạng thái Động dục |
| 2 | Ô: In breeding window / Trong khung phối | Số | Khung REM-02 bao gồm hiện tại |
| 3 | Ô: Pregnancy check due / Đến hạn khám thai | Số | Có REM-03 hoặc REM-04 đến hạn |
| 4 | Ô: Calving within 30 days / Đẻ trong 30 ngày | Số | Ngày đẻ dự kiến trong 30 ngày |
| 5 | Ô: Post-calving – can be bred / Sau sinh – có thể phối | Số | Có REM-07 đang hoạt động |
| 6 | Ô: Awaiting breeding – eligibility not met / Chờ phối – chưa đủ điều kiện | Số | Chờ phối, Động dục, Sau sinh mà điều kiện phối Chưa đạt |
| 7 | Search, Pen, Breed / Tìm, Chuồng, Giống | Lọc | — |
| 8 | Breeding eligibility / Điều kiện phối | Lọc | Tất cả (mặc định), Đạt, Chưa đạt |
| 9 | Tabs | Tab có số | Chờ phối, Động dục – cần phối, Đã phối – chờ khám, Mang thai, Sắp đẻ, Sau sinh. Technician điện thoại: Động dục, Đã phối, Mang thai |
| 10 | Cattle / Bò | Cột | Mã hiển thị · số tai |
| 11 | Breed, Pen / Giống, Chuồng | Cột | — |
| 12 | Reproductive status / Trạng thái | Cột | Trạng thái kèm thời điểm sự kiện mới nhất |
| 13 | Breeding eligibility / Điều kiện phối | Cột | Đạt / Chưa đạt + điều kiện chưa đạt (Chờ phối, Động dục, Sau sinh); "—" còn lại |
| 14 | Latest event / Sự kiện gần nhất | Cột | Ví dụ "Đẻ · 19/08/2026 · 62 ngày" |
| 15 | Next action / Việc tiếp theo | Cột | Theo quy tắc nhắc việc: "Cân nhắc phối", "Khám thai", "Chuẩn bị chuồng đẻ", "Theo dõi cân" |
| 16 | Due / window / Hạn / khung | Cột | Ngày hoặc khung giờ |
| 17 | Open / Mở | Thao tác dòng | Mở SCR-39 |

### SCR-39 Tab Sinh sản

| # | Khối / Trường | Hiện khi | Nội dung |
|---|---|---|---|
| 1 | Reproductive status / Trạng thái sinh sản | Luôn | Theo §3.3; "Không áp dụng" + lý do + MSG-FE11-11 |
| 2 | Services in current cycle, Parity, Last calving, Latest weight / Số lần phối chu kỳ này, Số lứa, Lần đẻ cuối, Cân gần nhất | Luôn | Số lứa gồm số lứa khai báo khi nhập (GBR-30) |
| 3 | Declared at entry / Khai báo khi nhập | Bò mua có khai báo mang thai, chưa khám | "Khai báo mang thai ~n tháng (chưa khám)" + nút "Ghi khám thai" (nút chính). D82: hết hiện khi có khám thai (mọi kết quả) hoặc lần đẻ VALID từ ngày nhập; bấm Ghi phối giống / Ghi động dục thì popup cảnh báo "Nên khám thai trước khi phối" với "Vẫn ghi" / "Ghi khám thai" – không chặn. SCR-38: huy hiệu cùng chữ, Việc cần làm "Khám thai", Thời hạn là hạn REM-03 |
| 4 | Reproduction indicators / Chỉ số sinh sản | Luôn | §3.6. D79: gập sẵn; dòng tóm tắt hai chỉ số đầu đã có giá trị (thường là số lứa, lần đẻ gần nhất) |
| 5 | Action buttons / Nút ghi | Owner, Manager | Theo §3.3 |
| 6 | More actions / Thao tác khác | Manager, bò cái ACTIVE YOUNG_STOCK / ADULT | Ghi khám thai; Ghi đẻ (thai không theo dõi) |
| 7 | Breeding eligibility / Điều kiện phối | Chờ phối, Động dục, Sau sinh | Kết quả chung; bảng Tiêu chí / Giá trị / Kết quả: tuổi tối thiểu, cân tối thiểu, không có ca sức khỏe OPEN |
| 8 | Breeding window / Khung phối | Động dục | Thời điểm động dục, khung gợi ý (ví dụ "18/10/2026 06:30 → 14:30–18:30"), thanh thời gian; MSG-FE11-08 khi thiếu tham số |
| 9 | Latest breeding / Lần phối gần nhất | Đã phối | Phương pháp, đực / tinh, người thực hiện, ngày đẻ tạm tính, số lần khám đã có, khám được từ ngày |
| 10 | Current pregnancy / Thai hiện tại | Mang thai | Số thai, lần phối liên kết, xác nhận ngày, ngày đẻ dự kiến (CONFIRMED / TENTATIVE / ESTIMATED) + cơ sở, số ngày mang thai |
| 11 | Reproduction timeline / Dòng thời gian sinh sản | Luôn | Lọc loại sự kiện, từ ngày, đến ngày; dòng: thời điểm, sự kiện, chi tiết, nguồn dữ liệu, người ghi; "Đã sửa"; dòng hủy mờ. D79: hiện 5 sự kiện mới nhất, "Xem thêm n sự kiện" mở hết; mở từ dòng thời gian hồ sơ thì không gập |
| 12 | Actions / Thao tác | Owner, Manager | "Sửa · Hủy" → popup tương ứng (FE-11 hoặc FE-12) |
| 13 | Calving history / Lịch sử đẻ | Luôn | Ngày đẻ, kết quả bê (ví dụ "Bê 1: Sống · Cái · 22 kg"), đăng ký (mã bò / "Nháp" / "Chết trước khi đăng ký"). D79: lứa mới nhất trước, mặc định chỉ lứa gần nhất; "Xem n lứa trước" mở phần còn lại |

### Popup Ghi động dục

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Female / Bò cái | Chỉ đọc | — | Mã, số tai, giống, chuồng | — | — |
| 2 | Observed at / Thời điểm quan sát | Ngày giờ | * | Không tương lai, không trước ngày nhập đàn | Bây giờ | MSG-COM-06, 07, 15 |
| 3 | Observer / Người quan sát | Dropdown | — | Thành viên ACTIVE (gồm Technician) | Người dùng | — |
| 4 | Signs / Dấu hiệu | Chọn nhiều | — | 5 giá trị ở §3.1 | — | — |
| 5 | Description / Mô tả | Ô chữ dài | — | ≤ 1.000 | — | MSG-COM-10 |
| 6 | Cancel / Save estrus | Nút | — | — | — | MSG-FE11-03 (xác nhận), MSG-FE11-05, MSG-COM-13, MSG-COM-02; thành công MSG-FE11-01 |

### Popup Ghi phối giống

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Female / Bò cái | Chỉ đọc | — | Tiêu đề kèm số lần phối trong chu kỳ | — | — |
| 2 | Breeding eligibility / Điều kiện phối | Chỉ đọc | — | Đạt / Chưa đạt + điều kiện | — | MSG-FE11-09 (cảnh báo) |
| 3 | Linked estrus / Động dục liên kết | Dropdown | — | Động dục VALID trong 72 giờ; "Không có" | Động dục mới nhất | — |
| 4 | Bred at / Thời điểm phối | Ngày giờ | * | Không tương lai, không trước động dục liên kết | — | MSG-COM-06, MSG-COM-07, MSG-FE11-10 |
| 5 | Data source / Nguồn dữ liệu | Radio (thu gọn) | — | Quan sát trực tiếp / Sổ trại / Báo cáo bên ngoài | Quan sát trực tiếp | — |
| 6 | Method / Phương pháp | Radio | * | Phối tự nhiên / Thụ tinh nhân tạo | — | MSG-COM-06 |
| 7 | Sire source / Nguồn đực giống | Radio | * | Trong trại / Bên ngoài | — | MSG-COM-06 |
| 8 | Farm sire / Đực giống trong trại | Dropdown | * khi Trong trại | Bò đực ACTIVE của trại | — | MSG-COM-06, MSG-FE11-04 |
| 9 | Sire breed / semen breed / Giống đực / giống tinh | Ô chữ hoặc giống | * khi Bên ngoài | — | — | MSG-COM-06 |
| 10 | Semen straw / batch code / Mã cọng / lô tinh | Ô chữ | — | ≤ 50 (AI) | — | MSG-COM-10 |
| 11 | Semen supplier / Nhà cung cấp tinh | Ô chữ | — | ≤ 100 (AI) | — | MSG-COM-10 |
| 12 | Performed by / Người thực hiện | Dropdown hoặc chữ | — | Thành viên hoặc tên ngoài ≤ 100 | — | MSG-COM-10 |
| 13 | Expected calving date (tentative) / Ngày đẻ dự kiến (tạm tính) | Chỉ đọc | — | Thời điểm phối + thời gian mang thai | — | MSG-FE11-08 khi thiếu tham số |
| 14 | Note / Ghi chú | Ô chữ dài | — | ≤ 500 | — | MSG-COM-10 |
| 15 | Cancel / Save breeding | Nút | — | — | — | MSG-FE11-05, MSG-COM-13, MSG-COM-02; thành công MSG-FE11-02 |

### Popup Sửa / Hủy động dục hoặc phối giống

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi |
|---|---|---|---|---|---|
| 1 | Record / Bản ghi | Chỉ đọc | — | Loại, bò cái, thời điểm, người ghi | — |
| 2 | Action / Hành động | Radio | * | Sửa (mặc định) / Hủy | — |
| 3 | Field / Current / New | Bảng | — | Động dục: thời điểm quan sát, mô tả, người quan sát. Phối: thời điểm, nguồn dữ liệu, phương pháp, đực giống, mã tinh, người thực hiện, động dục liên kết. Kiểm như popup ghi | Như popup ghi |
| 4 | Reason / Lý do | Ô chữ dài | * | ≤ 500 | MSG-COM-06 |
| 5 | Cancel / Save | Nút | — | — | MSG-FE11-07, MSG-COM-05, MSG-COM-02; thành công MSG-FE11-06 |

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Danh sách sinh sản | `tab, q?, penId?, breedId?, eligibility?` | `{tiles {inEstrus, inWindow, checkDue, calving30, postCalvingReady, notEligible}, counts{…}, items[{cattleId, code, earTag, breed, pen, status, statusSince, eligibility {met, failed[]}, latestEvent {type, date, daysAgo}, nextAction, due {date?, windowFrom?, windowTo?}, declaredPregnancy? {estMonths, entryDate}}]}` (D82: có khai báo mang thai chưa khám thì nextAction = PREGNANCY_CHECK, due.date = hạn REM-03) | COM-03 | `GET /api/farms/{farmId}/reproduction-worklist` |
| A2 | Tab sinh sản của bò cái | `type?, from?, to?` | `{applicable, notApplicableReason?, status, servicesInCycle, parity, lastCalving, latestWeight, declaredPregnancy? {estMonths, entryDate} (D82), indicators {ageAtFirstCalving, lastInterval, daysSinceCalving, daysOpen, conceptions, services, overdue}, allowedActions[], eligibility {met, criteria[{name, value, met}]}, window? {estrusAt, from, to, configured}, latestBreeding?, currentPregnancy?, timeline[{eventId, type, at, details, source, recordedBy, corrected, status, version}], calvings[]}` | COM-08 | `GET /api/farms/{farmId}/cattle/{cattleId}/reproduction-history` |
| A3 | Ghi động dục | `observedAt, observerId? \| observerName?, signs[], description?, confirmDuplicate?` + `Idempotency-Key` | `{eventId, status, window? {from, to}, parameterMissing?}` | FE11-03 (cần `confirmDuplicate`), FE11-05, COM-06, COM-07, COM-15, COM-13, COM-17, COM-02 | `POST /api/farms/{farmId}/cattle/{cattleId}/estrus-events` |
| A4 | Ghi phối | `bredAt, dataSource, method, sireSource, sireCattleId?, sireBreed?, semenCode?, semenSupplier?, performerId? \| performerName?, linkedEstrusId?, note?` + `Idempotency-Key` | `{eventId, status: BRED, tentativeCalvingDate?, parameterMissing?, eligibilityWarning?}` | FE11-04, FE11-05, FE11-10, COM-06, COM-07, COM-13, COM-02 | `POST /api/farms/{farmId}/cattle/{cattleId}/breeding-events` |
| A5 | Sửa | `changes{…}, reason, version` + `Idempotency-Key` | Sự kiện + trạng thái mới | FE11-07 (`{dependents[]}`), FE11-04, FE11-10, COM-06, COM-05 | `POST /api/farms/{farmId}/reproduction-events/{eventId}/correction` |
| A6 | Hủy | `reason, version` + `Idempotency-Key` | Như A5 | FE11-07, COM-06, COM-05 | `POST …/reproduction-events/{eventId}/void` |

---

## 8. Thông báo

| Mã | Kiểu | Nội dung VN (đề xuất) |
|---|---|---|
| MSG-FE11-01 | Toast thành công | Đã ghi động dục cho {cattle_code}. Khung phối gợi ý: {window}. |
| MSG-FE11-02 | Toast thành công | Đã ghi phối giống cho {cattle_code}. Ngày đẻ dự kiến (tạm tính): {date}. |
| MSG-FE11-03 | Hộp thoại xác nhận | Đã có {event_type} tương tự của {cattle_code} lúc {time}. Vẫn lưu? |
| MSG-FE11-04 | Dưới trường | Đực giống phải là một bò đực khác của trại này. |
| MSG-FE11-05 | Trong hộp thoại | {cattle_code} đang có thai đã xác nhận nên không ghi động dục / phối. Nếu bò có biểu hiện lên giống khi đang mang thai, hãy ghi ở "Diễn biến thai" (loại Theo dõi). (D67) |
| MSG-FE11-06 | Toast thành công | Bản ghi đã được {action}. Bản gốc được giữ trong lịch sử. |
| MSG-FE11-07 | Hộp thoại | Bản ghi này đang được các bản ghi sau dùng ({records}). Hãy sửa hoặc hủy các bản ghi đó trước. |
| MSG-FE11-08 | Trong panel | Chưa cấu hình tham số {parameter}, nên không có gợi ý hay ngày dự kiến. |
| MSG-FE11-09 | Trong hộp thoại | Chưa đủ điều kiện phối: {conditions}. Bạn vẫn có thể ghi lần phối đã thực sự diễn ra. |
| MSG-FE11-10 | Dưới trường | Thời điểm không được sớm hơn {event} liên kết ({time}). |
| MSG-FE11-11 | Trong panel | Con này không được theo dõi sinh sản ({reason}). Nếu thực sự đã khám thai hoặc đẻ, hãy ghi từ Thao tác khác. |

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-11-01 | Bò cái ADULT BREEDING, chưa có sự kiện | Xem | Chờ phối; nút Ghi động dục, Ghi phối | U, E | §3.3 |
| TC-11-02 | Bò cái ADULT FATTENING, không có thai | Xem | "Không áp dụng" + MSG-FE11-11; Thao tác khác vẫn có | E | R-11-10 |
| TC-11-03 | Bò đực | Gọi ghi động dục | Bị chặn | H | GBR-48 |
| TC-11-04 | Chờ phối | Ghi động dục 06:30 | Động dục; REM-02 14:30–18:30 | I | §3.5 |
| TC-11-05 | Động dục lúc 06:30 hôm qua, không phối | Sau 24 giờ | Chờ phối | U | §3.3 |
| TC-11-06 | Động dục lúc 06:00 | Ghi động dục lúc 15:00 cùng ngày | MSG-FE11-03; xác nhận thì lưu | I | R-11-03 |
| TC-11-07 | Bò đang mang thai | Gọi ghi động dục / phối | MSG-FE11-05 | I | R-11-04 |
| TC-11-08 | Động dục 06:30 | Ghi phối lúc 05:00 cùng ngày, liên kết động dục | MSG-FE11-10 | I | R-11-05 |
| TC-11-09 | Không có động dục trong 72 giờ | Ghi phối | Liên kết "Không có"; không có động dục nào được tạo | I | R-11-05 |
| TC-11-10 | Phối 01/11/2026, thai 283 ngày | Lưu | Ngày đẻ tạm tính 11/08/2027; REM-03 29/11/2026 | U, I | R-11-07 |
| TC-11-11 | Đã phối | Ghi động dục mới | Ngày đẻ tạm tính bị hủy; trạng thái Động dục | I | R-11-07 |
| TC-11-12 | Phối lần 1 08:00, lần 2 16:00 cùng chu kỳ | Lưu | Ngày tạm tính theo 16:00 | I | R-11-08 |
| TC-11-13 | Phối với đực trong trại là chính bò cái / bò cái khác / bò đực trại khác | Lưu | MSG-FE11-04 | I | R-11-01 |
| TC-11-14 | Bò cái 11 tháng tuổi (tham số 13) | Ghi phối | MSG-FE11-09; vẫn lưu được | I | R-11-09 |
| TC-11-15 | Bò có ca sức khỏe OPEN | Xem điều kiện phối | Chưa đạt "Không có ca OPEN" | U | §3.4 |
| TC-11-16 | Thiếu tham số thời gian mang thai | Ghi phối | Lưu; không có ngày dự kiến; MSG-FE11-08 | I | R-11-07 |
| TC-11-17 | Phối đã có khám CÓ THAI liên kết | Hủy phối | MSG-FE11-07 liệt kê lần khám | I | R-11-11 |
| TC-11-18 | Phối chưa có phụ thuộc | Sửa thời điểm, có lý do | Revision giữ giá trị cũ; ngày tạm tính và REM-03 tính lại | I | R-11-11, R-11-12 |
| TC-11-19 | Sửa đực giống từ A sang B | Lưu | Được (nếu không mâu thuẫn bản ghi sau) | I | UC-04 |
| TC-11-20 | Technician | Gọi ghi động dục / phối | 403 | H | §2 |
| TC-11-21 | Bò cái mua khai báo mang thai ~4 tháng | Mở SCR-39 | "Khai báo mang thai ~4 tháng (chưa khám)" + nút Ghi khám thai | E | §6 |
| TC-11-21a | Bò TC-11-21 (D82) | Bấm Ghi phối giống | Popup cảnh báo; "Vẫn ghi" mở popup ghi phối, "Ghi khám thai" mở popup khám thai | E | §6 |
| TC-11-21b | Bò TC-11-21 (D82) | Ghi khám thai (kết quả bất kỳ) | Khối khai báo biến mất ở SCR-39 và huy hiệu ở SCR-38 | I | §6 |
| TC-11-22 | 5 lần phối, 3 lần có thai | Chỉ số | "3 lần có thai / 5 lần phối" | U | GBR-106 |
| TC-11-23 | Đẻ 01/07, chưa có thai, hôm nay 20/10 (111 ngày) | Chỉ số | Huy hiệu "Quá hạn thụ thai" (> 108) | U | GBR-106 |
| TC-11-24 | SCR-38 | Bấm một dòng | Mở SCR-39; không có nút ghi trên SCR-38 | E | SCR-38 |
| TC-11-25 | Owner, trại ACTIVE, bò cái đủ điều kiện | Ghi động dục, ghi phối, sửa / hủy bản ghi | Thành công như Manager; tab Sinh sản của Owner có nút ghi | H, I, E | §2, D41 |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất | Quyết định (07/11/2026) |
|---|---|---|---|
| Q1 | UC-FE11-01 không có đặc tả Part II | Theo SCR-38, SCR-39 | Theo SCR-38, SCR-39 |
| Q2 | Kiểm trùng 12 giờ áp cho phối giống không? (MSG-FE11-03 dùng "{event_type}") | Có cho cả động dục và phối, trừ phối lần hai có chủ ý (R-11-08) – cần chốt | Có, áp cho cả động dục và phối; trừ phối lần hai có chủ ý (R-11-08) |
| Q3 | Động dục trên bò Đã phối → trạng thái Động dục; nếu sau đó khám CÓ THAI cho lần phối cũ? | Khám CÓ THAI thắng (Table 3.4-3 "Any → PREGNANT") | Theo đề xuất |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho TuanPQ duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
| 07/11/2026 | 28/10/2026 | Chốt các câu hỏi mục 10 (cột Quyết định), ghi tại `OPEN_QUESTIONS.md` | Tuấn |
| 15/11/2026 | 28/10/2026 | Việc 6a: A1–A6 đã nối đủ trường mục 7; chốt P1–P7 (D36): người quan sát / thực hiện có thể là thành viên hoặc tên ngoài, kiểm trùng 12 giờ cho cả động dục và phối (trừ cùng `linkedEstrusId`), phụ thuộc → MSG-FE11-07 `{records, dependents[]}`, thiếu tham số → `parameterMissing` (không mặc định 283 ngày) | Tuấn |
| 24/11/2026 | 28/10/2026 | D67: điều kiện phối thêm tiêu chí sau đẻ (bò đã từng đẻ), "Cần cân lại" khi chỉ thiếu lần cân; khung phối hiện bằng chữ; MSG-FE11-05 chỉ đường ghi lên giống giả ở Diễn biến thai; bảng tham chiếu chéo FE-11 ↔ FE-12 | Tuấn |
| 24/11/2026 | 28/10/2026 | D68: SCR-39 theo Bento – hàng 1: khối trạng thái (tên trạng thái, từ ngày, "việc tiếp theo" kèm thanh tiến độ khi có, nút ghi) cạnh khối ngữ cảnh (Điều kiện xét phối / Lần phối gần nhất / Thai kỳ hiện tại); hàng 2: Chỉ số sinh sản (chỉ chỉ số có giá trị) cạnh Lịch sử sinh bê; cửa sổ phối nằm trong khối trạng thái | Tuấn |
| 24/11/2026 | 28/10/2026 | D69: dòng thời gian Sinh sản có hai nút Sửa / Xóa; popup Sửa bỏ ô chọn hành động, "Lý do *" → "Ghi chú" không bắt buộc; Xóa là popup xác nhận (vẫn hỏi lại khi bản ghi đang được liên kết); bản ghi đã xóa ẩn khỏi dòng thời gian; backend lưu ghi chú trống là null | Tuấn |
| 24/11/2026 | 28/10/2026 | D70: bỏ trường "Nguồn dữ liệu" (Quan sát trực tiếp / Sổ trại / Báo cáo ngoài) khỏi các popup ghi / sửa, màn Ghi đẻ và cột của dòng thời gian; mọi bản ghi lưu Quan sát trực tiếp; API giữ `dataSource` tùy chọn | Tuấn |
| 24/11/2026 | 28/10/2026 | D71: SCR-38 theo Bento (Việc cần làm / Cần chú ý / Đang mang thai, một khối danh sách); popup Xóa báo thẳng khi có bản ghi phụ thuộc; popup ghi bỏ ô Bò cái chỉ đọc | Tuấn |
| 26/11/2026 | 28/10/2026 | D79: SCR-39 – chỉ số sinh sản và lịch sử chỉnh sửa gập sẵn; lịch sử sinh bê chỉ lứa gần nhất; dòng thời gian sinh sản 5 sự kiện mới nhất | Tuấn |
