# Herd entry test matrix

Nguồn chuẩn, theo thứ tự ưu tiên khi có khác biệt:

1. `docs/REQUIREMENT_DECISIONS.md`.
2. `docs/BeefCare_Report3_SRS_2026-10-28.docx`: UC-FE06-01, SCR-23,
   SCR-24, popup "Voucher Cattle Line", popup "Import Cattle from Excel",
   SCR-75, GBR-90, GBR-96 và MSG-FE06-10/16/17/18/19/24.
3. `docs/superpowers/specs/BeefCare_BE_REST_API.md`, phần 3.3.
4. `docs/api/openapi.json` và contract thực tế của backend.
5. Màn Entry hiện tại/Figma để kiểm tra bố cục, nhãn và thao tác người dùng.

Quy tắc quan trọng: số giấy kiểm dịch là **tùy chọn**. Khi trống phải hiện
MSG-FE06-24 nhưng không được chặn post. File Excel là dữ liệu đầu vào để tạo
dòng bò, không phải chứng từ được lưu. Chứng từ của phiếu chỉ nhận PDF/JPEG,
tối đa 10 MiB mỗi file.

## Unit tests — React và helper

| ID | Hành vi cần bảo vệ | Mức | Test |
| --- | --- | --- | --- |
| EN-U01 | Mã phiếu chỉ đọc; loại nhập chỉ đổi khi phiếu chưa lưu | Component | `ImportNew.header.test.tsx` |
| EN-U02 | Ngày, nguồn, số kiểm dịch, biển số, người nhập và ghi chú nhập được bằng bàn phím | Component | `ImportNew.header.test.tsx` |
| EN-U03 | Số kiểm dịch tối đa 50, biển số 20, ghi chú 1.000 ký tự | Boundary | `ImportNew.header.test.tsx` |
| EN-U04 | Thiếu số kiểm dịch hiện MSG-FE06-24 nhưng vẫn gửi lệnh post | Validation | `ImportNew.header.test.tsx` |
| EN-U05 | Ngày nhập tương lai bị chặn trước khi gọi API | Validation | `ImportNew.header.test.tsx` |
| EN-U06 | File PDF/JPEG hợp lệ được chọn, chống trùng theo tên+kích thước và truyền vào save | Component | `ImportNew.files.test.tsx` |
| EN-U07 | PNG/XLSX và PDF/JPEG lớn hơn 10 MiB bị từ chối tại form | Boundary | `ImportNew.files.test.tsx` |
| EN-U08 | File mới chọn có thể xem và bỏ trước khi lưu | Component | `EntryDocuments.test.tsx` |
| EN-U09 | File Excel phải có đuôi `.xlsx` và không quá 5 MiB | Boundary | `ExcelModal.test.tsx` |
| EN-U10 | Preview hiển thị valid/warning/error; nút chỉ đếm dòng không lỗi | Component | `ExcelModal.test.tsx` |
| EN-U11 | Preview và commit dùng đúng cùng một đối tượng `File` | Component | `ExcelModal.test.tsx` |
| EN-U12 | Parser cục bộ giới hạn 200 dòng, phát hiện header/dữ liệu sai | Helper | `ExcelModal.test.tsx` |

## Integration tests — màn hình, adapter và HTTP

| ID | Hành vi cần bảo vệ | Biên tích hợp | Test |
| --- | --- | --- | --- |
| EN-I01 | Mở `?id=...` phải gọi API chi tiết, không dùng row tóm tắt để phục hồi nháp | Page → feature API | `ImportNew.files.test.tsx` |
| EN-I02 | Nháp phục hồi header, dòng bò và metadata chứng từ đã lưu | Page → feature API | `ImportNew.files.test.tsx` |
| EN-I03 | Xem chứng từ đã lưu dùng authenticated blob; xóa gọi DELETE rồi cập nhật danh sách | Page → adapter | `ImportNew.files.test.tsx`, `herdEntryBackendApi.test.ts` |
| EN-I04 | Phiếu mới được lưu DRAFT trước; Excel preview dùng mã backend vừa cấp | Page → adapter | `ImportNew.files.test.tsx` |
| EN-I05 | Save DRAFT/POST gửi đủ header, lines, version và upload file sau khi có backend id | Adapter → transport | `herdEntryBackendApi.test.ts` |
| EN-I06 | Upload chứng từ thất bại thì không được gọi post; DRAFT còn để tiếp tục | Adapter → transport | `herdEntryBackendApi.test.ts` |
| EN-I07 | Template, preview `commit=false`, commit `commit=true` dùng multipart và cùng file | Adapter → transport | `herdEntryBackendApi.test.ts` |
| EN-I08 | HTTP client giữ cookie/CSRF/idempotency, parse JSON và blob đúng contract | Adapter → HTTP client | `tests/integration/herd-entry/entryFilesHttp.test.ts` |

## Backend integration tests — nguồn sự thật nghiệp vụ

| ID | Hành vi cần bảo vệ | Test hiện có |
| --- | --- | --- |
| EN-B01 | Owner/Manager upload/list/download/remove chứng từ Entry DRAFT | `VoucherAttachmentResourceTest` |
| EN-B02 | POSTED vẫn đọc được nhưng không sửa/xóa chứng từ | `VoucherAttachmentResourceTest` |
| EN-B03 | Chặn PNG, khai báo MIME sai, file trên 10 MiB và không lộ storage key | `VoucherAttachmentResourceTest` |
| EN-B04 | Technician bị cấm và id thuộc trại khác trả 404 | `VoucherAttachmentResourceTest` |
| EN-B05 | Excel template đúng cột; dry-run không ghi; commit chỉ thêm dòng valid/warning | `HerdEntryImportServiceTest`, `HerdEntryResourceTest` |
| EN-B06 | Excel giới hạn đúng 200 dòng/5 MiB và chỉ nhận DRAFT PURCHASE | `HerdEntryImportServiceTest` |
| EN-B07 | Thiếu số giấy kiểm dịch chỉ cảnh báo và vẫn post | `HerdEntryPostingServiceTest` |

## Điều kiện hoàn thành

- Mỗi test mới phải được chạy ở RED và lỗi đúng hành vi còn thiếu trước khi sửa code.
- Targeted Entry tests, toàn bộ frontend tests, typecheck và build phải chạy lại.
- Backend tests được chạy bằng JDK được `pom.xml` cho phép; nếu môi trường không
  chạy được phải ghi rõ blocker, không được báo xanh dựa trên việc đọc source.
- Không sửa test để che lỗi production; test chỉ đổi khi tài liệu nguồn chứng minh
  kỳ vọng cũ sai, như trường hợp số giấy kiểm dịch.
