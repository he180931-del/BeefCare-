# SPEC FE-17 – Lịch sử audit nền tảng

| | |
|---|---|
| Feature | FE-17 Platform Audit History |
| Use case | UC-FE17-01 |
| Người phụ trách | DucNV (BE + FE + test) · Review BE: TaiDX · Review FE: LamKD |
| Nguồn duy nhất | SRS 28/10/2026: Part I §3.2 J (Audit Log Entry), Part III §17 (SCR-51), GBR-86, GBR-88, NFR-S11; Business flow bước 12 |
| Trạng thái | ĐÃ CHỐT 07/11/2026 – theo `docs/requirements/SRS_2026-10-28.txt` (quyết định D12); chi tiết triển khai chốt 15/11/2026 (D34) |

> Mọi dòng lấy từ SRS. Route ở mục 7 là route đã làm theo D34; dữ liệu vào / ra và mã lỗi theo SRS.
> FE-17 **không có đặc tả Part II và không có MSG riêng** (Q1, D34: dùng MSG-COM).

---

## 1. Phạm vi

| UC | Tên | Tác nhân | Màn hình |
|---|---|---|---|
| UC-FE17-01 | Tìm, lọc và mở bản ghi audit trong danh sách cho phép | System Admin | SCR-51 |

**Ghi audit** là trách nhiệm của mọi UC thay đổi dữ liệu quan trọng (GBR-86); FE-17 chịu trách nhiệm hạ tầng ghi chung (`AuditService`, D34) + màn hình xem. Mỗi FE nguồn gọi hạ tầng này trong cùng transaction.

Bảng `audit_log` còn giữ audit của các thao tác trong trại (nhập / xuất đàn, chăm sóc, thức ăn, danh mục…) để phục vụ lịch sử trong trại; các mục đó **không** thuộc audit trung tâm và không bao giờ hiện trên SCR-51 (D34, Q5).

---

## 2. Vai trò và quyền

| Hành động | SA | Khác (Owner, Manager, Technician, CS, PM) |
|---|---|---|
| Xem SCR-51, chi tiết audit | Có | **Không** (403 MSG-COM-01) |
| Sửa / xóa audit | Không ai (không có route, 405) | Không ai |

---

## 3. Dữ liệu

### 3.1 Audit Log Entry

| Thuộc tính | Kiểu | Ràng buộc | Nguồn | Cột (D34) |
|---|---|---|---|---|
| ID | Hệ thống | Một bản ghi / thay đổi đã commit | §3.2 J | `id` |
| Thời điểm | Datetime | — | §3.2 J | `logged_at` |
| Tài khoản thực hiện + vai trò | Tham chiếu | Rỗng khi hệ thống thực hiện ("System"); vai trò lúc thực hiện | §3.2 J | `actor_id`, `actor_role` (mới) |
| Trại | Tham chiếu | Khi áp dụng | §3.2 J | `farm_id` |
| Mã hành động | Enum | Mã công khai của danh mục §3.2 (mã lưu giữ nguyên, ánh xạ khi đọc) | SCR-51 | `action` |
| Loại đích + ID | Enum + ID | Account, Platform access, Membership, Farm, Payment, Finance record, Ticket, Internal request | SCR-51 | `target_type`, `target_id` |
| Trước / sau | JSON | **Chỉ trường trong allowlist** của từng mã | GBR-86 | `details` |
| Correlation ID | Chuỗi ≤ 64 | Nối với request / log (`X-Request-Id`) | §3.2 J | `correlation_id` (mới) |
| Vòng đời | — | Không trạng thái; ghi cùng transaction; không sửa, không xóa | §3.2 J, NFR-S11 | — |

Mục ghi trước D34 không có vai trò và correlation ID (hiện "—").

### 3.2 Danh mục audit trung tâm (GBR-86, D34)

| Nhóm (loại đích) | Mã công khai | Mã đang lưu | Trường trước / sau | FE nguồn |
|---|---|---|---|---|
| Tài khoản (ACCOUNT) | ACCOUNT_SUSPENDED, ACCOUNT_RESTORED | ACCOUNT_SUSPEND / RESTORE | status | FE-03 |
| Quyền nền tảng (PLATFORM_ACCESS) | PLATFORM_ACCESS_GRANTED / CHANGED / REVOKED / RESTORED | PLATFORM_ACCESS_GRANT / CHANGE / REVOKE / RESTORE | role, status | FE-03 |
| Thành viên (MEMBERSHIP) | MEMBERSHIP_JOINED, MEMBERSHIP_ROLE_CHANGED, MEMBERSHIP_DEACTIVATED, MEMBERSHIP_REACTIVATED | MEMBER_ACCEPT / CHANGE_ROLE / DEACTIVATE / REACTIVATE | role, status | FE-03 |
| Trại (FARM) | FARM_REGISTERED, FARM_SERVICE_SUSPENDED, FARM_SERVICE_RESTORED, FARM_SERVICE_STATUS_CHANGED | FARM_REGISTER, FARM_SERVICE_SUSPEND / RESTORE, SERVICE_STATUS_JOB (JOB-04, "System") | name; status | FE-02, JOB-04 |
| Thanh toán (PAYMENT) | PAYMENT_CONFIRMED, EVIDENCE_REVIEWED | `<kênh>_PAYMENT_PAID`, EVIDENCE_REVIEW | amountVnd, termYears, periodStart, periodEnd, receiptCode; decision | FE-19 |
| Bản ghi thu chi (FINANCE_RECORD) | FINANCE_RECORD_POSTED, FINANCE_RECORD_VOIDED | FINANCE_RECORD_POST / VOID | status | FE-21 |
| Ticket (TICKET) | TICKET_CREATED, TICKET_ASSIGNED, TICKET_HANDED_OVER, TICKET_RELEASED, TICKET_WAITING_CUSTOMER, TICKET_RESOLVED, TICKET_ACKNOWLEDGED, TICKET_CLOSED, TICKET_REOPENED | SUPPORT_CREATE / CLAIM / HANDOVER / RELEASE / ASK_CUSTOMER / RESOLVE / ACKNOWLEDGE / CLOSE / REOPEN | status, assignee | FE-20 |
| Yêu cầu nội bộ (INTERNAL_REQUEST) | INTERNAL_REQUEST_CREATED / UPDATED / COMPLETED | SUPPORT_INTERNAL_CREATE / MANAGE / DONE | status, assignee | FE-20 |

Không thuộc danh mục (vẫn ghi, không hiện): lời mời, yêu cầu / hết hạn thanh toán, lưu và hoàn trả chứng từ, công bố / rút giá gói (`PlanVersion` không thuộc 8 loại đích), nháp và báo cáo thu chi, trả lời / ghi chú / phân loại ticket, sửa hồ sơ trại, mọi thao tác dữ liệu trong trại.

### 3.3 Không bao giờ hiện (GBR-86)
Dữ liệu bò, chăm sóc, lâm sàng; nội dung ticket; chứng từ ngân hàng; giá trị bí mật (mật khẩu, token, khóa API, webhook secret); lý do nhập ở lệnh nguồn (D34).

---

## 4. Quy tắc nghiệp vụ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-17-01 | Thay đổi quan trọng (§3.2) ghi audit **trong cùng transaction** qua `AuditService`; rollback nghiệp vụ → không có audit, và ngược lại. | GBR-86, GBR-88 |
| R-17-02 | Audit chỉ thêm; không API sửa / xóa (405). | NFR-S11 |
| R-17-03 | Chỉ SA (quyền nền tảng ACTIVE) xem audit trung tâm. | GBR-86 |
| R-17-04 | Chỉ hiện trường trong allowlist của từng mã; §3.3 không bao giờ hiện. Định danh nhạy cảm hiện dạng che (email `ng***@domain`). | GBR-86, SCR-51 |
| R-17-05 | Khoảng thời gian bắt buộc (ngày theo Asia/Ho_Chi_Minh, tính cả hai đầu), mặc định 7 ngày gồm hôm nay, tối đa 12 tháng (`to` ≤ `from` + 12 tháng); from ≤ to. | SCR-51, D34 |
| R-17-06 | Danh sách mới nhất trước, đảo chiều được theo thời gian. | SCR-51 |
| R-17-07 | Hành động hệ thống (JOB, webhook) có người thực hiện = "System"; mỗi lượt job có correlation ID riêng. | §3.2 J, D34 |
| R-17-08 | Lặp request cùng Idempotency-Key → chỉ 1 audit. | GBR-88 |
| R-17-09 | Vai trò người thực hiện là vai trò lúc thực hiện (nền tảng cho hành động nền tảng, trong trại cho hành động trong trại). | §3.2 J, D34 |

---

## 5. Luồng xử lý

### UC-FE17-01 Xem audit
1. SA mở SCR-51; mặc định 7 ngày gần nhất (hôm nay − 6 → hôm nay).
2. Nhập người thực hiện (một phần tên / email, hoặc "Hệ thống" / "System"), hành động, loại đích → lọc.
3. Danh sách: thời gian, người thực hiện (chữ viết tắt, tên, vai trò hoặc "Hệ thống"), hành động, đích.
4. Chọn dòng → chi tiết: hành động, vai trò, ID đích, trước / sau (allowlist), correlation ID (sao chép được).

E1 from > to → MSG-COM-11; thiếu ngày → MSG-COM-06; > 12 tháng → MSG-COM-10 (`field=dateRange`) · E2 không phải SA → MSG-COM-01 · E3 không có kết quả → MSG-COM-04 [Xóa bộ lọc] · E4 tải lỗi → MSG-COM-03 [Thử lại] · E5 mở mục không tồn tại / ngoài danh mục → MSG-COM-08.

---

## 6. Màn hình và trường

### SCR-51 Lịch sử audit nền tảng

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi |
|---|---|---|---|---|---|---|
| 1 | Time range / Khoảng thời gian | Khoảng ngày | * | ≤ 12 tháng; from ≤ to; gợi ý cố định "Tối đa 12 tháng" | 7 ngày gần nhất | MSG-COM-06, MSG-COM-11, MSG-COM-10 |
| 2 | Actor / Người thực hiện | Ô tìm | — | Một phần tên hoặc email, hoặc "Hệ thống" / "System" | — | — |
| 3 | Action / Hành động | Dropdown | — | Mã hành động (A3) | Tất cả | — |
| 4 | Target type / Loại đích | Dropdown | — | Tài khoản, Quyền nền tảng, Thành viên, Trại, Thanh toán, Bản ghi thu chi, Ticket, Yêu cầu nội bộ | Tất cả | — |
| **Danh sách** | | | | | | |
| 5 | Time / Thời gian | Cột | — | dd/mm/yyyy HH:mm (Asia/Ho_Chi_Minh); sắp được; mới nhất trước | — | — |
| 6 | Actor / Người thực hiện | Cột | — | Viết tắt, tên, vai trò; hoặc "Hệ thống" | — | — |
| 7 | Action / Hành động | Cột | — | Nhãn + mã hành động | — | — |
| 8 | Target / Đích | Cột | — | Loại đích + tên hiển thị hoặc định danh che | — | — |
| 9 | Pagination / Phân trang | — | — | Tối đa 100 / trang | 20 / trang (Q3) | — |
| **Chi tiết** | | | | | | |
| 10 | Action, Actor role, Target ID | Chỉ đọc | — | Kèm thời điểm, người thực hiện, đích, trại (nếu có) | — | — |
| 11 | Before / After – Trước / Sau | Chỉ đọc | — | Chỉ allowlist, một dòng mỗi trường; bên thiếu hiện "—" (ví dụ "Vai trò: — → CS · Trạng thái: — → ACTIVE") | — | — |
| 12 | Correlation ID | Chỉ đọc | — | Sao chép được; "—" với mục ghi trước D34 | — | — |

Không có xuất CSV (SRS không có, D34).

---

## 7. Hợp đồng dữ liệu FE ↔ BE

| # | Thao tác | Vào | Ra | Lỗi | Route |
|---|---|---|---|---|---|
| A1 | Danh sách audit | `from*, to*` (yyyy-MM-dd), `actor?` \| `system?=true`, `action?`, `targetType?`, `dir?=desc\|asc`, `page?=0`, `size?=20` (≤ 100) | `AuditPage {items[AuditRow {id, time, actor{id, name, initials, role}\|null, action, targetType, targetLabel}], total, page, size}` | COM-01, COM-06, COM-11, COM-10 (`dateRange`, `action`, `targetType`, `dir`, `actor`, tham số sai kiểu) | `GET /api/platform/audit` |
| A2 | Chi tiết | — | `AuditDetail {id, time, actor, farm{id, name}\|null, action, targetType, targetId, targetLabel, before{}, after{}, correlationId}` | COM-01, COM-08 | `GET /api/platform/audit/{id}` |
| A3 | Danh sách mã hành động | — | `[AuditActionOption {code, targetType}]` | COM-01 | `GET /api/platform/audit/actions` |
| A4 | Ghi audit (nội bộ BE) | `AuditService.log / logAt / logAndFlush (farm?, actor?, action, targetType, targetId, details)`; vai trò và correlation ID tự điền; cùng transaction (MANDATORY) | — | — | Không có route HTTP |

Mọi response có header `X-Request-Id` (correlation ID của request).

---

## 8. Thông báo

FE-17 không có MSG riêng. Dùng: MSG-COM-01 (không có quyền), MSG-COM-03 (tải lỗi), MSG-COM-04 (không có bản ghi phù hợp), MSG-COM-06 (thiếu khoảng thời gian), MSG-COM-08 (mục không còn), MSG-COM-10 (khoảng thời gian không hợp lệ – vượt 12 tháng; kèm gợi ý cố định "Tối đa 12 tháng"), MSG-COM-11 (từ ngày sau đến ngày).

---

## 9. Test case

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-17-01 | PM / CS / Owner / SA bị thu hồi | Gọi A1, A2, A3 | 403 MSG-COM-01 | H | R-17-03 |
| TC-17-02 | SA khóa tài khoản X | Lưu | 1 audit ACCOUNT_SUSPENDED: actor, role SA, time, target, before / after allowlist, correlation ID = `X-Request-Id`, không lý do | H | R-17-01, R-17-09 |
| TC-17-03 | Khóa tài khoản lỗi giữa chừng (rollback) | — | Không có audit (đọc lại bằng A1) | I | R-17-01 |
| TC-17-04 | Gửi lại cùng Idempotency-Key | — | Chỉ 1 audit (đọc lại bằng A1) | I | R-17-08 |
| TC-17-05 | PM xác nhận thanh toán | Xem chi tiết audit | PAYMENT_CONFIRMED / EVIDENCE_REVIEWED, vai trò PM, không có nội dung chứng từ ngân hàng, không lý do | H | R-17-04 |
| TC-17-06 | Details có mật khẩu / token / khóa / webhook secret | Xem audit | Không có giá trị bí mật | U | R-17-04 |
| TC-17-07 | Luồng ticket đến khi đóng | Xem audit TICKET_* | Mỗi thao tác một mã, vai trò từng người, trạng thái trước / sau, người phụ trách; không có nội dung ticket | H | R-17-04 |
| TC-17-08 | JOB-04 tạm ngưng / hết hạn dịch vụ trại | Xem | Người thực hiện "System", không vai trò, có correlation ID | H | R-17-07 |
| TC-17-09 | Không chọn khoảng | Mở | Mặc định 7 ngày gồm hôm nay | U, E | R-17-05 |
| TC-17-10 | Khoảng 13 tháng / from > to / thiếu ngày | Lọc | MSG-COM-10 / MSG-COM-11 / MSG-COM-06 | U, H | R-17-05 |
| TC-17-11 | Danh sách | Xem | Mới nhất trước; đảo chiều được; cùng thời điểm theo id | H, E | R-17-06 |
| TC-17-12 | Gọi PUT / PATCH / DELETE / POST audit | — | 405 (không tồn tại API) | H | R-17-02 |
| TC-17-13 | Lọc action = PAYMENT_CONFIRMED, target = PAYMENT | Lọc | Chỉ đúng loại | H | SCR-51 |
| TC-17-14 | Lọc người thực hiện = "System" | Lọc | Chỉ hành động hệ thống | H, E | SCR-51 |
| TC-17-15 | Audit dữ liệu trại (HEALTH_*, VACCINATION_*, lời mời, giá gói…) | A1 / A2 | Không có trong A1; A2 → 404 MSG-COM-08 | H | GBR-86, D34 |

---

## 10. Điểm SRS chưa rõ

| # | Câu hỏi | Đề xuất | Chốt (D34, 15/11/2026) |
|---|---|---|---|
| Q1 | Không có đặc tả Part II, không có MSG riêng | Dùng MSG-COM | Theo đề xuất; sửa mã: COM-01 (quyền), COM-03 (tải lỗi), COM-04 (rỗng), COM-06 / 11 / 10 (khoảng ngày) |
| Q2 | Danh sách đầy đủ mã hành động + allowlist trường trước / sau cho từng mã | Lập bảng ở §3.2 thành phụ lục; mỗi FE nguồn khai báo khi ghi | Danh mục trung tâm ở backend (§3.2); FE nguồn giữ cách ghi, backend chọn trường khi đọc |
| Q3 | Kích thước trang | 20 | 20, tối đa 100 |
| Q4 | Thời gian lưu giữ audit | Không xóa (append-only) | Theo đề xuất; không có job dọn |
| Q5 | Audit trong trại (thay đổi dữ liệu bò) | Không thuộc audit trung tâm; dùng Record Revision (FE-16) | Theo đề xuất; vẫn ghi vào `audit_log` nhưng ngoài danh mục, SCR-51 không hiện |

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại từ SRS; Route theo code hiện có | Claude (cho DucNV duyệt) |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
| 15/11/2026 | 28/10/2026 | D34: danh mục audit trung tâm (§3.2), vai trò và correlation ID (§3.1), sửa mã MSG theo SRS (§5, §8), hợp đồng A1–A4 (§7), bỏ xuất CSV, thêm TC-17-15; chốt Q1–Q5 | DucNV (Claude soạn) |
