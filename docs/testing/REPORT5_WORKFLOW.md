# Quy trình làm Report 5 – Test

Người giữ: Tuấn. Áp dụng từ 16/11/2026.

Nguồn: slide "Capstone Project – Test Guidelines", template Report 5 mới (16/11/2026, lưu ở [`../report-templates/`](../report-templates/)) và Report 5.0 của dự án. Mã test case lấy từ mục 9 trong bộ spec [`../requirements/specs/`](../requirements/specs/) (D12).

## 1. Chỗ làm và chỗ lưu

| Nội dung | Nơi làm việc hằng ngày | Lưu trong repo |
|---|---|---|
| Report 5.1 Unit Test | [Google Sheet 5.1](https://docs.google.com/spreadsheets/d/1MD1Q-0IxKI6n9Q6gU1g3hzSiZ9Gx3NORPWWG3yOl_IU/edit) | Bản xuất `.xlsx` sau mỗi vòng |
| Report 5.2 Integration Test | [Google Sheet 5.2](https://docs.google.com/spreadsheets/d/1C7iB_o9k07vOipmB94l75n9-jzxczD7gGopeR44WTow/edit) | Bản xuất `.xlsx` sau mỗi vòng |
| Report 5.3 System Test | [Google Sheet 5.3](https://docs.google.com/spreadsheets/d/12mNT8unj_6RNrjsvStsZl0pXwjliO6p6ZGwuC-354zQ/edit) | Bản xuất `.xlsx` sau mỗi vòng |
| Lỗi phát hiện khi test | Tab Defects của Sheet Code Tracking | — |
| Report 5.0 (kế hoạch, tổng hợp) | — | [`Report-5.0_Test_Documentation_BeefCare.docx`](Report-5.0_Test_Documentation_BeefCare.docx) |
| Code test, quy ước, lệnh chạy | — | `frontend/tests`, `backend/src/test`, file trong thư mục này |

Ba Google Sheet nằm trong thư mục Drive **BeefCare Report 5 – Test**.

Quy tắc:

- Mỗi người chỉ sửa tab của feature mình. Tên tab có tiền tố feature, ví dụ `FE08-validateMeasurement`, `FE08-GhiCan`.
- Không sửa trực tiếp file `.xlsx` trong repo, vì Git không gộp được file Excel.
- Sau mỗi vòng test, người giữ xuất `.xlsx` vào `docs/testing/report5/` và ghi rõ commit đã chạy.

## 2. Cấp test và report tương ứng

| Cấp (slide) | Tầng trong spec | Report | Đơn vị một sheet | Cách chạy |
|---|---|---|---|---|
| Unit (white-box: câu lệnh, nhánh) | U | 5.1 | Một hàm | Tự động, có đo độ phủ |
| Test API (slide: dùng template unit) | H và I tự động ở backend | 5.1 | Một endpoint | Tự động (JUnit, MockMvc) |
| Integration (black-box: EP, BVA, chuyển trạng thái) | I, E chạy trên màn hình | 5.2 | Một feature, mỗi màn/popup là một nhóm | Chạy tay trên backend thật |
| System (theo quy trình nghiệp vụ) | Luồng BF-01 → BF-08 | 5.3 | Một luồng BF | Chạy tay trên một bản build chung |
| Phi chức năng | NFR | 5.4 | Theo [`NFR_TEST_PLAN.md`](NFR_TEST_PLAN.md) | Theo từng NFR |
| Nghiệm thu | Kịch bản nghiệp vụ | 5.5 | Một kịch bản | Người không phải tác giả chạy |

Giao diện (bố cục, chữ, tràn khung, cỡ màn 1280/768/360 px) kiểm bằng checklist, ghi ở cột Note của case 5.2 tương ứng.

## 3. Thứ tự làm

```text
Đầu vào (spec mục 6, 9 · template · quy ước)
  → 5.1 Unit (hàm + API, tự động)
  → 5.2 Integration (màn hình, chạy tay)
  → 5.3 System (luồng BF, chạy tay)
  → Kết quả từng vòng: Pass/Fail, ngày, người chạy; lỗi ghi vào tab Defects
  → Report 5.0 §II.3 (tổng hợp UT · IT · ST và lỗi)
  ↻ sửa lỗi, chạy lại Round 2
```

### 5.1 Unit

Chi tiết cách điền ở [`UNIT_TEST_REPORT_TEMPLATE.md`](UNIT_TEST_REPORT_TEMPLATE.md).

1. Chọn hàm hoặc endpoint, ghi số dòng code.
2. Đọc code, liệt kê các nhánh (if/else, kiểm tra, ngoại lệ). Mỗi nhánh có ít nhất một case.
3. Điền ma trận UTCID: điều kiện vào, kết quả mong đợi, loại N/A/B. Giá trị biên lấy từ spec mục 6.
4. Viết hoặc đổi tên test theo quy ước ở [`COMMANDS.md`](COMMANDS.md) mục 6.
5. Chạy kèm đo độ phủ; bổ sung case cho nhánh chưa chạy tới.
6. Điền P/F, ngày chạy, người chạy; lỗi ghi Defect ID.

### 5.2 Integration

1. Lấy ràng buộc trường của màn hình từ spec mục 6.
2. Sheet `ConditionAnalysis-<màn>`: chia vùng hợp lệ/không hợp lệ và biên, gắn nhãn VP, IP, VB, IB.
3. Sheet `TestDesign-<màn>`: mỗi case ghi các nhãn nó phủ, đến khi phủ hết nhãn.
4. Viết case vào sheet feature gồm dữ liệu, các bước thao tác, kết quả mong đợi, mã TC. Thông báo dùng mã MSG trong sheet `MessageList`.
5. Người khác tác giả chạy trên backend thật (Round 1), ghi lỗi, chạy lại (Round 2).

### 5.3 System

1. Chọn luồng BF, liệt kê chức năng và vai trò tham gia.
2. Viết case đi trọn luồng. Mỗi bước ghi mã case 5.2 tương ứng.
3. Chạy chung trên một commit cố định, dữ liệu QA reset trước vòng ([`QA_FIXTURES.md`](QA_FIXTURES.md)).

## 4. Chia việc

| Phần | Ai soạn | Ai chạy | Ai kiểm và tổng hợp |
|---|---|---|---|
| 5.1 | Chủ feature | Chủ feature | Tuấn |
| 5.2 | Chủ feature | Thành viên khác (chạy chéo) | Tuấn |
| 5.3 | Tuấn cùng chủ các feature trong luồng | Cả nhóm, một buổi chung | Tuấn |
| Lỗi | Người phát hiện ghi | Chủ feature sửa và chạy lại | Tuấn |
| Report 5.0 §II.3 | Tuấn | — | — |

FE-08 được làm mẫu trước cho cả ba report. Các feature khác làm theo mẫu đó.

## 5. Lịch đề xuất

| Mốc | Việc |
|---|---|
| 17/11 | Mẫu FE-08 trên cả 5.1, 5.2, 5.3 |
| 22/11 | Mỗi người xong 5.1 phần mình |
| 25/11 | Xong phần soạn 5.2 |
| 26–27/11 | Chạy chéo 5.2 (Round 1), ghi lỗi |
| 29/11 | Chạy chung 5.3 trên build chốt |
| 01/12 | Sửa lỗi, Round 2, xuất `.xlsx`, điền Report 5.0 §II.3 |

## 6. Ghi kết quả

- Kết quả trong sheet: `Passed`, `Failed`, `Pending` (chưa chạy) hoặc `N/A` kèm lý do. Case chưa có bằng chứng giữ `Pending`.
- Mỗi vòng ghi: commit, môi trường, chế độ dữ liệu (mock, H2, PostgreSQL), người chạy, ngày. Cách ghi theo [`COMMANDS.md`](COMMANDS.md) mục 5.
- Lỗi có sẵn từ trước (không do thay đổi đang test) ghi riêng, không tính là lỗi của vòng đó.
