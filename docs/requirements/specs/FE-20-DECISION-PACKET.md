# FE-20 — Phiếu chốt quyết định Product/Security

> **Trạng thái: PRODUCT DECISIONS RECORDED — SECURITY/OPERATIONAL GAPS OPEN.**
> Các quyết định Product ngày 24/11/2026 đã được sao vào
> `docs/REQUIREMENT_DECISIONS.md`. Chưa được triển khai cho đến khi Security
> chốt các thông số file và deadline còn thiếu, rồi đồng bộ SRS, field matrix
> và OpenAPI theo WBS `docs/superpowers/plans/2026-11-24-fe20-decision-gate-wbs.md`.

## Cách phê duyệt

Với mỗi D-FE20, ghi `Approve recommended`, hoặc thay phần **Quyết định cần
chốt** bằng giá trị cụ thể. Một quyết định chưa có owner/date hoặc nói
“để implementation tự quyết” vẫn được xem là chưa chốt.

## D-FE20-01 — Priority trên form Owner

**Quyết định cần chốt:** Owner có thấy Priority khi tạo ticket không?

**Quyết định Product 24/11/2026:** Hệ thống tự xác định và sắp xếp priority ban
đầu; Owner sau đó được sửa priority cho ticket của mình. Field phải hiện đúng
giá trị server trả, và server vẫn là nguồn sắp xếp queue.

**Còn cần contract:** thời điểm cuối Owner được sửa (ví dụ sau khi CS nhận hay
khi ticket CLOSED), optimistic version và audit/history của lần đổi priority.

## D-FE20-02 — Chính sách evidence attachment

**Quyết định cần chốt:** Loại file, kích thước, số lượng, retention và hành vi
scan của supplement.

**Quyết định Product 24/11/2026:** Chỉ nhận PDF/JPEG/PNG.

**Security/operational gaps phải chốt:** số file, dung lượng/file, quarantine,
signature/MIME validation, malware scan, trạng thái file lỗi, quyền preview/
download, retention/xóa/legal hold và audit. Không được lấy mặc định 5 file,
10 MiB hay 90 ngày làm quyết định đã duyệt.

## D-FE20-03 — CS không phụ trách xem evidence

**Quyết định cần chốt:** CS khác có được xem metadata/nội dung/tải file không?

**Quyết định Product 24/11/2026:** Có. CS khác vẫn được xem metadata/nội dung
và tải evidence bình thường, không cần claim/handover trước.

**Security contract còn thiếu:** phạm vi CS role nào, audit download, revocation
khi role bị mất và giới hạn đối với file đang scan/bị reject.

## D-FE20-04 — PM/SA nhận customer attachment

**Quyết định cần chốt:** PM/SA có thể nhận evidence từ Owner qua FE-20 không?

**Quyết định Product 24/11/2026:** Có, nhưng chỉ khi CS chủ động đính kèm file
vào yêu cầu gửi PM/SA; không tự chia sẻ toàn bộ evidence của ticket.

**Security contract còn thiếu:** attachment reference/selection bất biến theo
từng IR revision, chỉ named recipient được đọc, expiry/revoke khi IR đổi người
nhận hoặc bị hủy, audit download và cấm public URL/storage key.

## D-FE20-05 — Matrix role cho SYSTEM_USAGE và OTHER

**Quyết định cần chốt:** Category nào được tạo IR cho PM/SA.

**Quyết định Product 24/11/2026:** Với `SYSTEM_USAGE` và `OTHER`, CS chọn gửi
IR cho PM hoặc SA tùy tình huống. Server cho phép cả hai role nhưng phải kiểm
CS đang phụ trách và named recipient đang khả dụng; không suy ra role từ UI.

**Matrix sau quyết định:**

| Category | Role IR cho MVP |
|---|---|
| `ACCOUNT_ACCESS` | SA |
| `PAYMENT`, `FARM_SERVICE` | PM |
| `SYSTEM_USAGE`, `OTHER` | PM hoặc SA, do CS phụ trách chọn theo tình huống |

UI chỉ hiển thị PM/SA còn khả dụng; server reject recipient/role không hợp lệ.

## D-FE20-06 — Deadline, reminder, expiry

**Quyết định cần chốt:** Có deadline/reminder/EXPIRED cho supplement không?

**Quyết định Product 24/11/2026:** Có deadline, reminder và trạng thái hết
hạn cho supplement. Không timeout nào được tự close ticket.

**Operational gaps phải chốt:** deadline có bắt buộc không, timezone, thời
điểm/kênh nhắc, transition chính xác sang `EXPIRED`, blocker behavior, Owner/
CS action sau hết hạn, waive/cancel actor, retention file nháp/upload và audit.

## Approval record

| ID | Product approval (name/date) | Security approval (name/date) | Chốt cuối cùng / ngoại lệ |
|---|---|---|---|
| D-FE20-01 | User / 24-11-2026 | N/A | Approved; Owner may edit system-initial priority; timing/audit contract open. |
| D-FE20-02 | User / 24-11-2026 | Pending | PDF/JPEG/PNG approved; all file-security/retention limits open. |
| D-FE20-03 | User / 24-11-2026 | Pending | Any CS can view/download evidence; authorization/audit detail open. |
| D-FE20-04 | User / 24-11-2026 | Pending | CS may selectively attach evidence to named PM/SA IR; delegation contract open. |
| D-FE20-05 | User / 24-11-2026 | Review pending | SYSTEM_USAGE/OTHER may target PM or SA at assigned CS discretion. |
| D-FE20-06 | User / 24-11-2026 | Pending | Deadline/reminder/expiry required; timings/transitions/audit open. |

## Gate sau phê duyệt

Chỉ sau khi các gap Security/operational trên được chốt và các quyết định được
reconcile vào decision register, mới bổ sung supplement API contract hoàn chỉnh
và mở implementation slice tương ứng. Test code
ưu tiên unit backend/frontend; integration/system vẫn là các kịch bản manual
trong `docs/testing/FE20_TARGET_TEST_DESIGN.md` trừ khi có scope automation
riêng.
