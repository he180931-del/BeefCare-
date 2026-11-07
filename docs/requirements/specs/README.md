# BeefCare – Spec theo SRS (FE-01 → FE-23)

**Trạng thái: ĐÃ CHỐT 07/11/2026** (quyết định D12 trong `docs/REQUIREMENT_DECISIONS.md`).

Nguồn duy nhất: **SRS 28/10/2026** – `docs/requirements/SRS_2026-10-28.txt`. Bản `SRS_2026-11-01_SEP490_G35_Report.txt` (đánh số SCR khác, ví dụ Tồn kho thức ăn = SCR-111) **không dùng**; mọi mã SCR theo bản 28/10. Mọi trường, quy tắc, thông báo, test case lấy từ SRS; không kế thừa spec cũ.
Cột Route ở mục 7 lấy theo code hiện có, chỉ để nối API. Dữ liệu vào / ra và mã lỗi theo SRS. Route ghi "Chưa có" kèm đề xuất là chỗ code còn thiếu.

## Cấu trúc mỗi file (11 mục)

1. Phạm vi
2. Vai trò và quyền
3. Dữ liệu (thuộc tính entity theo SRS §3.2)
4. Quy tắc nghiệp vụ (R-xx-nn, có nguồn GBR / BR-D / REM)
5. Luồng xử lý (Normal / AF / E)
6. Màn hình và trường (bảng từng trường: loại, bắt buộc, ràng buộc, mặc định, lỗi)
7. Hợp đồng dữ liệu FE ↔ BE (A1…: vào, ra, lỗi, route)
8. Thông báo (MSG bản tiếng Việt đề xuất)
9. Test case (TC-xx-nn, Given / When / Then, tầng U / I / H / E)
10. Điểm SRS chưa rõ (Q1… kèm đề xuất)
11. Lịch sử

Tầng test: **U** unit · **I** integration (BE + DB) · **H** HTTP / quyền · **E** end-to-end UI.

## Danh sách

| Spec | Tên | Người phụ trách | Review BE | Review FE | Số TC |
|---|---|---|---|---|---|
| FE-01 | Xác thực và tài khoản | LamKD | DucNV | AnNT | 49 |
| FE-02 | Trang trại và dịch vụ | DucNV | TaiDX | LamKD | 32 |
| FE-03 | Thành viên và quyền | DucNV | TaiDX | LamKD | 34 |
| FE-04 | Chuồng trại | AnNT | TuanPQ | LamKD | 25 |
| FE-05 | Hồ sơ bò, QR | AnNT | TuanPQ | LamKD | 38 |
| FE-06 | Nhập đàn | AnNT | TuanPQ | LamKD | 39 |
| FE-07 | Thông báo trại | TaiDX | DucNV | LamKD | 17 |
| FE-08 | Tăng trưởng và BCS | TuanPQ | AnNT | LamKD | 21 |
| FE-09 | Tiêm phòng | TuanPQ | AnNT | LamKD | 30 |
| FE-10 | Sức khỏe và điều trị | TuanPQ | AnNT | LamKD | 26 |
| FE-11 | Động dục và phối giống | TuanPQ | AnNT | LamKD | 24 |
| FE-12 | Mang thai và đẻ | TuanPQ | AnNT | LamKD | 26 |
| FE-13 | Xuất đàn | AnNT | TuanPQ | LamKD | 24 |
| FE-14 | Nhắc việc và thông báo hệ thống | TaiDX | DucNV | LamKD | 26 |
| FE-15 | Dashboard và báo cáo | TaiDX | DucNV | LamKD | 22 |
| FE-16 | Dòng thời gian | AnNT | TuanPQ | LamKD | 15 |
| FE-17 | Audit nền tảng | DucNV | TaiDX | LamKD | 14 |
| FE-18 | Danh mục và tham số | AnNT | TuanPQ | LamKD | 29 |
| FE-19 | Gói dịch vụ và thanh toán | DucNV | TaiDX | LamKD | 31 |
| FE-20 | Hỗ trợ khách hàng | LamKD | DucNV | AnNT | 28 |
| FE-21 | Thu chi nền tảng | LamKD | DucNV | AnNT | 24 |
| FE-22 | Trang giới thiệu | LamKD | DucNV | AnNT | 11 |
| FE-23 | Quản lý thức ăn | TaiDX | DucNV | LamKD | 32 |
| | **Tổng** | | | | **617** |

Thành phần dùng chung: popup **Ghi thanh toán** mô tả ở FE-06 §6 (FE-13, FE-23 tham chiếu). Hạ tầng audit (FE-17), nhắc việc JOB-01 (FE-14), thông báo JOB-07 (FE-14) do người phụ trách FE đó làm; các FE khác gọi vào.

## File đi kèm

- `OPEN_QUESTIONS.md` – 115 câu hỏi, mỗi câu có người chốt: 105 câu từ mục 10 của các spec, 10 câu thêm ngày 07/11 từ các tài liệu đối chiếu cũ.
- `MISSING_ROUTES.md` – phần backend còn thiếu: 18 thao tác chưa có route kèm route đề xuất, chỗ lệch spec của FE-23, route và trường FE cần khi dựng màn, phần đã có code nhưng chưa kiểm chứng.

## Cách dùng

1. Người phụ trách đọc mục 3 → 6 để làm BE + FE; dùng mục 7 để nối API (chỗ "Chưa có" thì thêm route theo đề xuất).
2. Viết test theo mục 9; mã TC dùng trong tên test để truy vết.
3. Chốt câu hỏi trong `OPEN_QUESTIONS.md`. Câu nào làm đổi SRS thì sửa SRS trước, rồi sửa spec (ghi vào mục 11) và thêm một dòng vào `docs/REQUIREMENT_DECISIONS.md`.
4. Đổi spec bằng PR riêng; mỗi thay đổi ghi một dòng ở mục 11 của spec đó.
5. Tiến độ theo UC ghi trong sheet tracking (4 trạng thái: có màn và luồng mẫu · có endpoint · FE gọi đúng endpoint · đã chạy với backend + DB thật theo commit).
