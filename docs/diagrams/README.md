# Sơ đồ feature (DucNV)

Sơ đồ mô hình hóa các feature do DucNV phụ trách: FE-02, FE-03, FE-17, FE-19.
Mỗi feature có một trang tổng quan HTML (mở thẳng bằng trình duyệt, không cần
server). Feature có nhiều bảng thì có thêm một file ERD đủ cột.

| Feature | Trang tổng quan | ERD đủ cột | Nội dung |
|---|---|---|---|
| FE-02 Trang trại và dịch vụ | [fe-02-trang-trai-dich-vu.html](fe-02-trang-trai-dich-vu/fe-02-trang-trai-dich-vu.html) | [fe-02-erd.html](fe-02-trang-trai-dich-vu/fe-02-erd.html) | UC, vòng đời trạng thái dịch vụ, nơi ghi `farm.service_status`, luồng đăng ký trại, nút trên thẻ SCR-09, tạm ngưng / khôi phục |
| FE-03 Thành viên, vai trò và quyền | [fe-03-thanh-vien-quyen.html](fe-03-thanh-vien-quyen/fe-03-thanh-vien-quyen.html) | [fe-03-erd.html](fe-03-thanh-vien-quyen/fe-03-erd.html) | UC, vòng đời lời mời, luồng chấp nhận lời mời, trạng thái thành viên / tài khoản / quyền nền tảng, thứ tự kiểm lệnh ghi |
| FE-17 Audit nền tảng | [fe-17-audit-nen-tang.html](fe-17-audit-nen-tang/fe-17-audit-nen-tang.html) | (trong trang) | Đường ghi / đọc audit, danh mục trung tâm, quy tắc lọc SCR-51, bảng `audit_log` |
| FE-19 Gói dịch vụ và thanh toán | [fe-19-goi-thanh-toan.html](fe-19-goi-thanh-toan/fe-19-goi-thanh-toan.html) | [fe-19-erd.html](fe-19-goi-thanh-toan/fe-19-erd.html) | UC, vòng đời yêu cầu thanh toán, luồng SePay, cách tính kỳ đã mua, trạng thái chứng từ và đối soát, bảng giá |

## Mô hình hàm theo use case

Mỗi UC là một sequence đi theo hàm thật: trang / component → hàm API frontend →
REST resource → `IdempotencyCommandService` (lệnh ghi) → service → kiểm quyền → DB.
Bên dưới mỗi sơ đồ có các bước ghi tên hàm, điều kiện kiểm và mã lỗi; rê chuột
lên số nguồn để xem đoạn code của hàm đó.

| Feature | Trang | UC |
|---|---|---|
| FE-02 | [fe-02-mo-hinh-ham.html](fe-02-trang-trai-dich-vu/fe-02-mo-hinh-ham.html) | UC-01 Đăng ký trại · UC-02 Chọn trại · UC-03 Cập nhật thông tin trại · UC-04 + 05 Tổng quan, tạm ngưng / khôi phục (PM) |
| FE-03 | [fe-03-mo-hinh-ham-trai.html](fe-03-thanh-vien-quyen/fe-03-mo-hinh-ham-trai.html) | UC-01 Gửi lời mời · UC-02 + 03 Xem, gửi lại, hủy lời mời · UC-04 Chấp nhận lời mời · UC-05 + 06 Xem, đổi thành viên |
| FE-03 | [fe-03-mo-hinh-ham-nen-tang.html](fe-03-thanh-vien-quyen/fe-03-mo-hinh-ham-nen-tang.html) | UC-07 Xem tài khoản · UC-08 Tạm ngưng / khôi phục tài khoản · UC-09 Quyền nền tảng |
| FE-17 | [fe-17-mo-hinh-ham.html](fe-17-audit-nen-tang/fe-17-mo-hinh-ham.html) | Đường ghi audit (hạ tầng chung) · UC-01 Xem audit |
| FE-19 | [fe-19-mo-hinh-ham-chu-trai.html](fe-19-goi-thanh-toan/fe-19-mo-hinh-ham-chu-trai.html) | UC-01 Xem gói · UC-02 Tạo / chờ / hủy yêu cầu · UC-03 Lịch sử · UC-08 SePay + JOB-06 |
| FE-19 | [fe-19-mo-hinh-ham-pm.html](fe-19-goi-thanh-toan/fe-19-mo-hinh-ham-pm.html) | UC-04 Gói các trại · UC-05 Xem yêu cầu và chứng từ · UC-06 Đối soát · UC-07 Bảng giá |

Một trang chứa tối đa 4 sơ đồ, nên các UC cùng màn hình được gộp vào một sơ đồ
(ví dụ FE-02 UC-04 + 05) và FE-03, FE-19 tách làm hai trang.

## Cách đọc

- Mỗi trang mở đầu bằng kết luận, sau đó là các panel. Bấm **Open interactive
  view** để mở sơ đồ toàn màn hình; **Step through** đi qua từng bước và tô sáng
  phần tương ứng trên sơ đồ.
- Số mũ nhỏ sau câu là nguồn: đoạn spec trong `docs/requirements/specs/` hoặc
  file code. Nguồn được ghim theo commit `fbbe942` (nhánh `dev`, 18/11/2026).
- ERD trong trang tổng quan chỉ giữ khóa và cột trạng thái; file `*-erd.html`
  có đủ cột theo entity JPA và migration Liquibase.
- Giao diện viewer (nút, menu) là tiếng Anh vì Archify chưa có bản tiếng Việt;
  nội dung sơ đồ là tiếng Việt.

## Điểm lệch spec ↔ code ghi nhận khi vẽ

| Feature | Spec nói | Code hiện tại |
|---|---|---|
| FE-02 | Cờ tạm ngưng riêng, trạng thái dịch vụ là giá trị suy ra; trại có "Thời điểm tạo" | Lưu thẳng trong cột `farm.service_status` (`SUSPENDED` là một giá trị); bảng `farm` chưa có cột thời điểm tạo, chỉ có audit `FARM_REGISTER` |
| FE-03 | Lời mời ACCEPTED tham chiếu membership đã tạo; membership có "lời mời nguồn" | Chưa có cột nối `farm_invitation` ↔ `farm_membership`; code tìm theo trại + người đăng nhập |
| FE-19 | Trạng thái chứng từ `MATCHED`, `HELD` | Code ghi `ACCEPTED`, `HOLD`; khi đọc đổi `MATCHED` → `ACCEPTED`, `HELD` → `HOLD` |

## Cập nhật sơ đồ

Nguồn của mỗi trang nằm cùng thư mục:

- `*.archify.md`: bản nháp trang tổng quan;
- `*.lifecycle.json`: sơ đồ vòng đời;
- `*.erd.json` (đủ cột) và `*.erd-compact.json` (cột chính).

Sửa nguồn rồi dựng lại bằng skill Archify (cài theo
<https://github.com/tt-a1i/archify>), chạy từ thư mục gốc repo:

```bash
ARCHIFY="$HOME/.claude/skills/archify/bin/archify.mjs"
D=docs/diagrams/fe-03-thanh-vien-quyen

# Trang tổng quan (kiểm tra nguồn trích dẫn theo commit hiện tại)
node "$ARCHIFY" finalize explainer $D/fe-03.archify.md $D/fe-03-thanh-vien-quyen.html --repo-root . --json

# Trang mô hình hàm: cùng lệnh, đổi file nháp và file HTML
node "$ARCHIFY" finalize explainer $D/fe-03-mo-hinh-ham-trai.archify.md $D/fe-03-mo-hinh-ham-trai.html --repo-root . --json

# ERD đủ cột
node "$ARCHIFY" finalize erd $D/fe03.erd.json $D/fe-03-erd.html --quality standard --json

# (Tùy chọn) Kiểm tra cỡ chữ trên trình duyệt, ghi ảnh chụp ra ngoài repo
node "$ARCHIFY" visual-check $D/fe-03-thanh-vien-quyen.html --summary --out-dir /tmp/archify-check
```

`finalize` sinh thêm các file biên nhận `*.finalize.json`, `*.delivery.json`,
`*.browser-check.json` có đường dẫn máy cục bộ; xóa chúng trước khi commit.
