# SPEC FE-17 – Lịch sử audit nền tảng

| | |
|---|---|
| Feature | FE-17 Platform Audit History |
| Use case | UC-FE17-01 |
| Người phụ trách | DucNV (BE + FE + test) · Review BE: TaiDX · Review FE: LamKD |
| Nguồn duy nhất | SRS 28/10/2026: Part I §3.2 J (Audit Log Entry), Part III §17 (SCR-51), GBR-86, GBR-88, NFR-S11; Business flow bước 12 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 – theo `docs/requirements/SRS_2026-10-28.txt` (quyết định D12) |

> Mọi dòng lấy từ SRS. Route ở mục 7 lấy theo code hiện có chỉ để nối API; dữ liệu vào / ra và mã lỗi theo SRS.
> FE-17 **không có đặc tả Part II và không có MSG riêng** (Q1).

---

## 1. Phạm vi

| UC | Tên | Tác nhân | Màn hình |
|---|---|---|---|
| UC-FE17-01 | Tìm, lọc và mở bản ghi audit trong danh sách cho phép | System Admin | SCR-51 |

**Ghi audit** là trách nhiệm của mọi UC thay đổi dữ liệu quan trọng (GBR-86); FE-17 chịu trách nhiệm hạ tầng ghi chung + màn hình xem. Mỗi FE nguồn gọi hạ tầng này trong cùng transaction.

---

## 2. Vai trò và quyền

| Hành động | SA | Khác (Owner, Manager, Technician, CS, PM) |
|---|---|---|
| Xem SCR-51, chi tiết audit | Có | **Không** (403) |
| Sửa / xóa audit | Không ai | Không ai |

---

## 3. Dữ liệu

### 3.1 Audit Log Entry

| Thuộc tính | Kiểu | Ràng buộc | Nguồn |
|---|---|---|---|
| ID | Hệ thống | Một bản ghi / thay đổi đã commit | §3.2 J |
| Thời điểm | Datetime | — | §3.2 J |
| Tài khoản thực hiện + vai trò | Tham chiếu | Rỗng khi hệ thống thực hiện ("System") | §3.2 J |
| Trại | Tham chiếu | Khi áp dụng | §3.2 J |
| Mã hành động | Enum | Ví dụ ACCOUNT_SUSPENDED, PLATFORM_ACCESS_GRANTED, MEMBERSHIP_ROLE_CHANGED, FARM_SERVICE_RESTORED, PAYMENT_CONFIRMED, FINANCE_RECORD_POSTED, TICKET_CLOSED | SCR-51 |
| Loại đích + ID | Enum + ID | Account, Platform access, Membership, Farm, Payment, Finance record, Ticket, Internal request | SCR-51 |
| Trước / sau | JSON | **Chỉ trường trong allowlist** | GBR-86 |
| Correlation ID | Chuỗi | Nối với request / log | §3.2 J |
| Vòng đời | — | Không trạng thái; ghi cùng transaction; không sửa, không xóa | §3.2 J, NFR-S11 |

### 3.2 Thay đổi bắt buộc ghi audit (GBR-86)

| Nhóm | Ví dụ mã hành động (đề xuất bổ sung – Q2) | FE nguồn |
|---|---|---|
| Tài khoản và quyền truy cập | ACCOUNT_SUSPENDED, ACCOUNT_RESTORED, PLATFORM_ACCESS_GRANTED, PLATFORM_ACCESS_REVOKED | FE-01, FE-03 |
| Thành viên trại | MEMBERSHIP_ROLE_CHANGED, MEMBERSHIP_REMOVED, OWNERSHIP_TRANSFERRED | FE-03 |
| Dịch vụ trại | FARM_SERVICE_SUSPENDED, FARM_SERVICE_RESTORED | FE-02 |
| Chấp nhận thanh toán | PAYMENT_CONFIRMED, EVIDENCE_REVIEWED | FE-19 |
| Ghi / hủy thu chi | FINANCE_RECORD_POSTED, FINANCE_RECORD_VOIDED | FE-21 |
| Phân công, trạng thái ticket | TICKET_ASSIGNED, TICKET_HANDED_OVER, TICKET_CLOSED, TICKET_REOPENED | FE-20 |

### 3.3 Không bao giờ hiện (GBR-86)
Dữ liệu bò, chăm sóc, lâm sàng; nội dung ticket; chứng từ ngân hàng; giá trị bí mật (mật khẩu, token, khóa API, webhook secret).

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-17-01 | Thay đổi quan trọng (§3.2) ghi audit **trong cùng transaction**; rollback nghiệp vụ → không có audit, và ngược lại. | GBR-86, GBR-88 |
| R-17-02 | Audit chỉ thêm; không API sửa / xóa. | NFR-S11 |
| R-17-03 | Chỉ SA xem audit trung tâm. | GBR-86 |
| R-17-04 | Chỉ lưu và hiện trường trong allowlist; §3.3 không bao giờ hiện. Định danh nhạy cảm hiện dạng che (masked). | GBR-86, SCR-51 |
| R-17-05 | Khoảng thời gian bắt buộc, mặc định 7 ngày gần nhất, tối đa 12 tháng; from ≤ to. | SCR-51 |
| R-17-06 | Danh sách mới nhất trước, sắp được theo thời gian. | SCR-51 |
| R-17-07 | Hành động hệ thống (JOB, webhook) có người thực hiện = "System". | §3.2 J |
| R-17-08 | Lặp request cùng Idempotency-Key → chỉ 1 audit. | GBR-88 |

---

## 5. Luồng xử lý

### UC-FE17-01 Xem audit
1. SA mở SCR-51; mặc định 7 ngày gần nhất.
2. Nhập người thực hiện (tên / email hoặc "System"), hành động, loại đích → lọc.
3. Danh sách: thời gian, người thực hiện, hành động, đích.
4. Chọn dòng → chi tiết: hành động, vai trò, ID đích, trước / sau (allowlist), correlation ID.

E1 khoảng sai / > 12 tháng → MSG-COM-11 / MSG-COM-10 · E2 không phải SA → MSG-COM-03 · E3 không có kết quả → trạng thái rỗng · E4 lỗi → MSG-COM-02.

---

## 6. Màn hình và trường

### SCR-51 Lịch sử audit nền tảng

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Time range / Khoảng thời gian | Khoảng ngày | * | ≤ 12 tháng; from ≤ to | 7 ngày gần nhất | MSG-COM-11, MSG-COM-10 |
| 2 | Actor / Người thực hiện | Ô tìm | — | Tên hoặc email, hoặc "System" | — | — |
| 3 | Action / Hành động | Dropdown | — | Mã hành động | Tất cả | — |
| 4 | Target type / Loại đích | Dropdown | — | Tài khoản, Quyền nền tảng, Thành viên, Trại, Thanh toán, Bản ghi thu chi, Ticket, Yêu cầu nội bộ | Tất cả | — |
| **Danh sách** | | | | | | |
| 5 | Time / Thời gian | Cột | — | dd/mm/yyyy HH:mm; sắp được; mới nhất trước | — | — |
| 6 | Actor / Người thực hiện | Cột | — | Viết tắt, tên, vai trò; hoặc "System" | — | — |
| 7 | Action / Hành động | Cột | — | Mã hành động | — | — |
| 8 | Target / Đích | Cột | — | Loại đích + tên hiển thị hoặc định danh che | — | — |
| 9 | Pagination / Phân trang | — | — | — | 20 / trang (Q3) | — |
| **Chi tiết** | | | | | | |
| 10 | Action, Actor role, Target ID | Chỉ đọc | — | — | — | — |
| 11 | Before / After – Trước / Sau | Chỉ đọc | — | Chỉ allowlist, ví dụ "vai trò: — → CS · ACTIVE" | — | — |
| 12 | Correlation ID | Chỉ đọc | — | Sao chép được | — | — |

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route (code hiện có) |
|---|---|---|---|---|---|
| A1 | Danh sách audit | `from*, to*, actorId? \| actorQuery? \| system?, action?, targetType?, page, size, sort` | `PageAuditEntry {items[{id, time, actor{initials, name, role} \| "SYSTEM", action, target{type, displayName \| masked}}], total}` | COM-11, COM-10, COM-03 | `GET /api/platform/audit` |
| A2 | Chi tiết | — | `AuditEntry {id, time, actor, actorRole, farm?, action, targetType, targetId, before{}, after{}, correlationId}` | COM-03, COM-08 | `GET /api/platform/audit/{id}` |
| A3 | Danh sách mã hành động | — | `[actionCode]` | — | Chưa có – đề xuất `GET /api/platform/audit/actions` (hoặc enum cố định ở FE) |
| A4 | Ghi audit (nội bộ BE) | `{actor, role, farm?, action, targetType, targetId, before, after, correlationId}` qua service dùng chung, cùng transaction | — | — | Không có route HTTP (service nội bộ) |

---

## 8. Thông báo

FE-17 không có MSG riêng. Dùng: MSG-COM-03 (không có quyền), MSG-COM-10 (vượt 12 tháng – nội dung đề xuất "Khoảng thời gian tối đa 12 tháng."), MSG-COM-11 (từ ngày sau đến ngày), MSG-COM-02 (lỗi hệ thống).

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-17-01 | PM / CS / Owner | Gọi A1, A2 | 403 | H | R-17-03 |
| TC-17-02 | SA khóa tài khoản X | Lưu | 1 audit ACCOUNT_SUSPENDED: actor, role, time, target, before / after allowlist, correlation ID | I | R-17-01 |
| TC-17-03 | Khóa tài khoản lỗi giữa chừng (rollback) | — | Không có audit | I | R-17-01 |
| TC-17-04 | Gửi lại cùng Idempotency-Key | — | Chỉ 1 audit | I | R-17-08 |
| TC-17-05 | PM xác nhận thanh toán | Xem chi tiết audit | Không có nội dung chứng từ ngân hàng | I | R-17-04 |
| TC-17-06 | Đổi mật khẩu / tạo token | Xem audit | Không có giá trị bí mật | I | R-17-04 |
| TC-17-07 | Đóng ticket | Xem audit TICKET_CLOSED | Không có nội dung ticket | I | R-17-04 |
| TC-17-08 | JOB-04 tạm ngưng trại hết hạn | Xem | Người thực hiện "System" | I | R-17-07 |
| TC-17-09 | Không chọn khoảng | Mở | Mặc định 7 ngày gần nhất | E | R-17-05 |
| TC-17-10 | Khoảng 13 tháng / from > to | Lọc | Lỗi COM-10 / COM-11 | U, H | R-17-05 |
| TC-17-11 | Danh sách | Xem | Mới nhất trước; đảo chiều được | E | R-17-06 |
| TC-17-12 | Gọi PUT / DELETE audit | — | 404 / 405 (không tồn tại API) | H | R-17-02 |
| TC-17-13 | Lọc action = PAYMENT_CONFIRMED, target = Payment | Lọc | Chỉ đúng loại | I | SCR-51 |
| TC-17-14 | Lọc người thực hiện = "System" | Lọc | Chỉ hành động hệ thống | I | SCR-51 |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Không có đặc tả Part II, không có MSG riêng | Dùng MSG-COM |
| Q2 | Danh sách đầy đủ mã hành động + allowlist trường trước / sau cho từng mã | Lập bảng ở §3.2 thành phụ lục; mỗi FE nguồn khai báo khi ghi |
| Q3 | Kích thước trang | 20 |
| Q4 | Thời gian lưu giữ audit | Không xóa (append-only) |
| Q5 | Audit trong trại (thay đổi dữ liệu bò) | Không thuộc audit trung tâm; dùng Record Revision (FE-16) |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho DucNV duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
