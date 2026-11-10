# Report 4 — I.3 Database Design: bản nháp khởi đầu

Nguồn đối chiếu: entity backend và migration trên commit `5acd384`. Đây là phần khởi đầu cho An/nhóm rà soát, **chưa phải thiết kế toàn bộ DB và chưa được kiểm chứng bằng PostgreSQL đang chạy**. Cần xuất ERD từ schema sau migration, kiểm khóa/ràng buộc thực tế và mô tả mọi bảng theo mẫu Report 4 trước khi nộp.

PostgreSQL 16.15 là phiên bản compose local ghim. Liquibase quản lý migration. Dữ liệu nghiệp vụ theo trại được phân vùng logic bằng quan hệ tới `farm`; kiểm soát quyền vẫn do backend thực hiện.

| Bảng | Mục đích | Quan hệ/cột chính cần kiểm chứng migration |
|---|---|---|
| `app_user` | Hồ sơ người dùng nghiệp vụ | `id`, `email`, trạng thái, `version`; thông tin đăng nhập còn liên quan user JHipster. |
| `farm` | Hồ sơ trang trại và trạng thái dịch vụ | `id`, tên, địa chỉ, múi giờ, trạng thái, `version`. |
| `farm_membership` | Thành viên, vai trò và trạng thái theo trại | Tham chiếu trại và người dùng; rà soát khóa duy nhất theo migration. |
| `pen` | Chuồng và sức chứa | `farm_id`, mã, tên, sức chứa, trạng thái, `version`. |
| `cattle` | Hồ sơ từng con bò | `farm_id`, `breed_id`, `purpose_id`, mã hiển thị/thẻ tai, giới tính, ngày sinh, trạng thái, `version`. |
| `pen_assignment` | Lịch sử bố trí bò vào chuồng | `farm_id`, `cattle_id`, `pen_id`, ngày bắt đầu/kết thúc; không suy luận chuồng hiện tại chỉ từ lịch sử cũ. |
| `herd_entry_voucher` | Phiếu nhập đàn, trạng thái và tài chính | `farm_id`, mã phiếu, loại/ngày, nguồn bán, trạng thái, số tiền, `version`. |
| `herd_entry` | Dòng nhập đàn và liên hệ bò/phiếu | Kiểm tên các khóa và ràng buộc trực tiếp trong entity và migration trước khi điền bảng chi tiết. |

Trong bản chính thức cần có sơ đồ quan hệ, mô tả từng bảng/cột, kiểu dữ liệu, PK/FK, nullable, unique/index, quan hệ và quy tắc nghiệp vụ; sau đó đối chiếu ERD/SRS và DB sau migration. Các bảng khác về chăm sóc, sinh sản, thức ăn, thanh toán, audit/outbox và danh mục chưa được trình bày tại đây.
