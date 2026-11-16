# Cách điền Report 5.1 – Unit Test

Người giữ file: Tuấn. Mỗi chủ feature tự điền phần của mình trên [Google Sheet 5.1](https://docs.google.com/spreadsheets/d/1MD1Q-0IxKI6n9Q6gU1g3hzSiZ9Gx3NORPWWG3yOl_IU/edit); Tuấn kiểm tra đủ cột, liên kết và số liệu. Quy trình chung của Report 5 ở [`REPORT5_WORKFLOW.md`](REPORT5_WORKFLOW.md). Template gốc: [`../report-templates/Report-5.1_Unit Test.xls`](../report-templates/).

## 1. Cấu trúc workbook

| Sheet | Nội dung | Ai sửa |
|---|---|---|
| Guideline, Example | Hướng dẫn và ví dụ của template | Giữ nguyên |
| Cover | Thông tin tài liệu, lịch sử thay đổi | Tuấn |
| FunctionList | Mỗi hàng là một hàm hoặc API được test, có link sang sheet của nó | Chủ feature thêm hàng của mình |
| Test Report | Tổng hợp theo hàm: Passed, Failed, Untested, N/A/B | Tuấn thêm hàng, cập nhật công thức `Sub total` |
| `FExx-<tên hàm>` | Ma trận case của một hàm hoặc API | Chủ feature |

Tạo sheet hàm mới bằng cách nhân bản `Function1`, đổi tên theo quy ước, rồi thêm hàng ở FunctionList và Test Report. Template yêu cầu tạo sheet trước khi tạo link.

## 2. Chọn gì để test

- **Hàm:** validator, hàm tính toán, hàm chuyển đổi dữ liệu, hàm quyết định trạng thái. Ví dụ `validateMeasurement`, `statusErrors`, `withdrawalEnd`, `validateReproductionCommand`. Không đưa cả trang React hay cả service vào một sheet.
- **API:** một endpoint là một sheet, ví dụ `FE08-POST-growth`. Case lấy từ test backend tầng H và I (MockMvc, `@ServiceIntegrationTest`, `@IntegrationTest`).

## 3. Một hàng ở FunctionList

| Cột | Ghi gì | Ví dụ |
|---|---|---|
| Requirement Name | Mã UC trong spec | UC-FE08-01 |
| Class Name | File hoặc lớp chứa hàm | `growthRules.ts` |
| Function Name | Tên hàm hoặc endpoint | `validateMeasurement` |
| Function Code | `FExx-Fnn` hoặc `FExx-Ann` cho API | FE08-F01 |
| Sheet Name | Tên sheet | FE08-validateMeasurement |
| Description | Hàm làm gì, kèm độ phủ nhánh của file lúc chạy | Kiểm trường form ghi cân; nhánh 80% |
| Pre-Condition | Điều kiện chung | Ngày hiện tại của trại cố định |

## 4. Một sheet hàm

**Phần đầu sheet:**
- **Created By / Executed By:** người viết, người chạy.
- **Lines of code:** số dòng thân hàm, không tính dòng trống và chú thích.
- **Test requirement:** mã TC và quy tắc mà hàm đáp ứng, ví dụ `TC-08-01, TC-08-02, TC-08-05; R-08-01`.

Template tính "Lack of test cases" theo định mức 100 case / 1.000 dòng ở FunctionList. Nếu còn thiếu thì giải thích ngay trong Test requirement.

**Ma trận (mỗi cột là một UTCID):**

- **Condition:** Precondition và giá trị từng đầu vào. Mỗi giá trị một hàng, đánh `O` vào cột UTCID dùng giá trị đó.
- **Confirm:**
  - Return: giá trị trả về;
  - Exception: lỗi ném ra;
  - Log message: thông báo, dùng mã MSG nếu có.
- **Result:**
  - Type: `N` (bình thường), `A` (bất thường), `B` (biên);
  - Passed/Failed: `P` hoặc `F`;
  - Executed Date;
  - Defect ID.

**Loại N/A/B** lấy từ khoảng giá trị ở spec mục 6. Ví dụ cân nặng 1–1.500 kg, 1 chữ số thập phân:

| Loại | Giá trị |
|---|---|
| N | 500; 320,5 |
| B | 1; 1.500 |
| A | 0; 1.500,1; 320,55; để trống khi không có BCS |

## 5. Nối UTCID với code test

Mỗi UTCID ứng với một test, hoặc một dòng của `test.each`. Tên test chứa tên hàm, UTCID và mã TC (theo slide: tên phương thức + mã case):

```ts
describe('validateMeasurement', () => {
  it('UTCID03 TC-08-02 cân 1.500,1 kg bị chặn', () => { /* … */ })
})
```

```java
@DisplayName("validateMeasurement UTCID03 TC-08-02 cân 1.500,1 kg bị chặn")
```

Case bổ sung chưa có trong spec thì đánh tiếp số TC cuối của feature và thêm vào spec trong cùng PR.

## 6. Đo độ phủ

Lệnh ở [`COMMANDS.md`](COMMANDS.md) mục 6. Mục tiêu đề xuất: ≥ 80% nhánh cho các file `domain/*Rules.ts` và service nghiệp vụ. Ghi số đo được vào cột Description ở FunctionList, kèm commit.

Số đo nền ngày 16/11/2026 (commit nền `b93d2ed`, file domain FE-08 đến FE-12, 169 test):

| Thư mục | Câu lệnh | Nhánh |
|---|---|---|
| `growth/domain` | 100% | 84,2% |
| `health/domain` | 97,8% | 88,3% |
| `vaccination/domain` | 100% | 83,8% |
| `reproduction/domain` | 93,9% | 77,0% |
| Tổng | 97,4% | 82,5% |
