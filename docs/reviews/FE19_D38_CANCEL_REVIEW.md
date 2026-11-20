# Review BE — D38: Owner hủy yêu cầu thanh toán (UC-FE19-02 AF6)

## Scope

- Chủ BE: DucNV (tự kiểm cùng Claude). FE nhận: chính DucNV (SCR-59 / SCR-60), SCR-62 của PM.
- Nhánh `feat/fe19-goi-thanh-toan`, fast-forward lên `dev` 6d10b73 ngày 16/11/2026; thay đổi đang ở working tree, **chưa commit**.
- Trạng thái: **BE_REVIEWED** local; chưa READY_FOR_FE (chưa có trên `main` / bản tích hợp).
- Gói: A18 `POST /api/farms/{farmId}/subscription/payments/{paymentId}/cancel`; cửa sổ nhận tiền `[tạo, lúc hủy)` ở webhook, simulator, tra cứu và PM ACCEPT; trạng thái `CANCELLED` ở A2/A3/A12, ứng viên A8, kết quả khớp `REQUEST_CANCELLED`. Ngoài gói: thông báo / email khi hủy (D38 không có).
- Actor: Owner hiện tại của trại (`MANAGE_FARM_INFORMATION`), mọi trạng thái dịch vụ. Dữ liệu: yêu cầu `PENDING` chưa hết hạn, chưa nhận giao dịch.
- Nguồn: D38 trong `docs/REQUIREMENT_DECISIONS.md`; SRS sửa theo D38: định nghĩa Payment request, thực thể Payment Request, GBR-70, GBR-72, UC-FE19-02 (POST-3, AF3, AF6, E7, E8), SCR-59, SCR-60, ma trận quyền, MSG-FE19-17 → 19; spec FE-19 §3.3, R-19-03/06/14/15, §5, §6, §7 A18, §8, §9 TC-19-97 → 109.

## Ma trận trường

| Trường | Kiểu | Bắt buộc | Kích hoạt | Validation | API | DB |
|---|---|---|---|---|---|---|
| `reason` | chữ | Không | Khi hủy | trim, ≤ 1.000; rỗng → null; dài hơn → 400 MSG-COM-10 `{field: reason}` | A18 body | `payment.cancel_reason` varchar(1000) |
| `cancelledAt` | instant | Tự động | Hủy thành công | giờ server; cũng là mốc đóng cửa sổ nhận tiền | `PaymentDTO`, `PlatformPaymentRead` | `payment.cancelled_at` |
| người hủy | user | Tự động | Hủy thành công | Owner hiện tại | không trả; audit `PAYMENT_REQUEST_CANCELLED` | `payment.cancelled_by_id` FK `app_user` |
| `state=CANCELLED` | enum | — | Hủy thành công | chỉ từ PENDING `now < expiresAt`, chưa nhận giao dịch | `PaymentDTO.state`, lọc A3 `status` / A12 `state` | `payment.state` |
| `Idempotency-Key` | header | Có | Mỗi lệnh | thiếu → 400 MSG-COM-19; cùng key khác body → 409 MSG-COM-19 | A18 | bảng idempotency có sẵn |

Không có `expectedVersion`: điều kiện duy nhất có thể đổi là trạng thái, được kiểm sau khi khóa dòng trại (cùng thứ tự với xác nhận thanh toán và JOB-03).

## Acceptance criteria và bằng chứng

| Case | Nguồn | Given / When / Then | Test và tầng | Kết quả |
|---|---|---|---|---|
| TC-19-97 | D38.1, UC-02 AF6 | Owner hủy có / không lý do → 200 CANCELLED, lý do trim, giờ hủy, người hủy, audit cùng giờ, không chứa lý do; trại không đổi trạng thái | `PaymentRequestCancelResourceTest#tc97…` ×2 (H2 + PostgreSQL) | PASS |
| TC-19-98 | D38.1 | Manager 403 COM-01; Owner trại khác 403; `paymentId` trại khác 404 COM-08; không ghi gì | `#tc98…` | PASS |
| TC-19-99 | D38.2, E8 | PAID / đã CANCELLED / `expiresAt == now` → 409 COM-05, không đổi giờ hủy, không audit | `#tc99…` | PASS |
| TC-19-100 | D38.2, E7 | Đã nhận giao dịch đúng mã, sai số tiền → 409 FE19-19 `{code, receivedAt}` khớp A3; vẫn PENDING | `#tc100…`; store demo | PASS |
| TC-19-101 | D38.1 | 1.001 ký tự sau trim → 400 COM-10; thiếu key → 400 COM-19; đúng 1.000 → 200 | `#tc101…` | PASS |
| TC-19-102 | A18 | Cùng key + cùng body → trả nguyên kết quả cũ, một audit; cùng key khác lý do → 409 COM-19 | `#tc102…` | PASS |
| TC-19-103 | D38.4 | Sau khi hủy, A2 tạo yêu cầu mới (`reopened=false`) | `#tc103…` | PASS |
| TC-19-104 | D38.3, GBR-72 | Đã hủy; giao dịch có giờ NH trước lúc hủy → PAID, cấp kỳ, giữ `cancelledAt`, trại ACTIVE | `#tc104…`; store demo | PASS |
| TC-19-105 | D38.3 | Giờ NH đúng lúc hủy → không PAID; chứng từ TO_REVIEW, `matchResult=REQUEST_CANCELLED`, không có ứng viên; PM ACCEPT → 409 FE19-11 `OUTSIDE_WINDOW` | `#tc105…` | PASS |
| TC-19-106 | D38, khóa trại | Hủy chờ khóa trại trong lúc xác nhận commit PAID → 409 COM-05, không ghi | `SubscriptionConfirmationConcurrencyTest#cancellationWaitingForTheFarm…` (H2 + PostgreSQL) | PASS |
| TC-19-107 | SCR-59 #12/#13 | Quay lại không gửi; xác nhận gửi một lần (nút khóa), cùng key; MSG-FE19-18; ẩn QR, sao chép, nút hủy; bước ngân hàng "Chưa" | `subscriptionPaymentBackend.test.tsx` ×2 | PASS |
| TC-19-108 | SCR-59 #12 | Đã nhận giao dịch → không có nút; FE19-19 → hộp thoại "Không hủy được yêu cầu" và tải lại; COM-05 → ghi chú và tải lại | `subscriptionPaymentBackend.test.tsx` ×2 | PASS |
| TC-19-109 | SCR-60, SCR-62 | Lọc CANCELLED, huy hiệu "Đã hủy", chi tiết giờ + lý do, không "Mở lại"; SCR-62 đọc CANCELLED, `REQUEST_CANCELLED`, bộ lọc | `subscriptionHistoryBackend.test.tsx`, `platformPaymentReadBackend.test.tsx` | PASS |

## Findings và xử lý

| ID | Phân loại | Expected / actual | Xử lý | Kết quả |
|---|---|---|---|---|
| F1 | contract | Thiếu `Idempotency-Key` trả 400 chung của Spring, không có MSG-COM-19 | Header `required=false` ở Spring, để command service trả COM-19 (như lệnh PM); OpenAPI vẫn ghi bắt buộc | PASS TC-19-101 |
| F2 | contract | Method mới tên `cancel` làm operationId hủy lời mời FE-03 đổi thành `cancel_1` | Đổi tên method `cancelPayment`, schema `PaymentCancelRequest` | OpenAPI chỉ thêm, không đổi operationId cũ |
| F3 | UI (runtime) | Yêu cầu đã hủy vẫn hiện bước ngân hàng "Đang chờ"; điện thoại vẫn hiện "Đóng màn này không hủy yêu cầu" | Bước ngân hàng "Chưa" khi CANCELLED; ẩn ghi chú | Assert trong TC-19-107; chụp lại runtime |
| F4 | contract | SCR-62 (PM) chỉ chấp nhận 3 trạng thái nên sẽ báo "dữ liệu không hợp lệ" khi gặp CANCELLED | Validator, nhãn, bộ lọc nhận CANCELLED; nhãn `REQUEST_CANCELLED` | TC-19-109 |

## Kết quả chạy thực tế (16/11/2026)

- JDK 21, Maven 3.9.16, `-Pdev,!webapp`, `-Dapi.version=1.44 -Duser.timezone=Asia/Ho_Chi_Minh`, `clean verify`.
- Surefire (H2): PaymentRequestCancelResourceTest 10, SubscriptionConfirmationConcurrencyTest 4, OwnerTransferSimulatorResourceTest 4, PlatformPaymentReadResourceTest 13, PlatformReconciliationResourceTest 19, SubscriptionPaymentHistoryResourceTest 9, SubscriptionPaymentRequestResourceTest 7 + Transaction 2 + Configuration 1, SePayPaymentFlowTest 10, PlatformPlanPriceResourceTest 9, OpenApiContractTest 1: **tất cả PASS**. SePayWebhookResourceTest 24/30: 6 ca fail **giống hệt** trên `bd7d598` (có sẵn, ngày / múi giờ).
- Failsafe (PostgreSQL 16.15, Testcontainers): PaymentRequestCancelPostgresIT 10/10, SubscriptionConfirmationConcurrencyPostgresIT 4/4, SubscriptionPaymentRequestPostgresIT 7/7, PlatformPaymentReadPostgresIT 13/13, SubscriptionPaymentHistoryPostgresIT 10/10. SePayWebhookPostgresIT 24/30: 6 ca fail giống hệt khi chạy trên `6d10b73` chưa sửa.
- Frontend: typecheck sạch; `vite build` PASS (hộp thoại hủy có trong bản production, ô giả lập dev vẫn không); Vitest `tests/unit/subscription` + `platform-service` 169/170 (1 ca SCR-61 phụ thuộc ngày, có sẵn); toàn bộ `tests/unit` trước bước sửa F3: 1101/1103, 2 ca + 1 file lỗi đều có sẵn (`userFacingError` dùng `node:test`, `UpdateModal.backend`, SCR-61).
- HTTP thật: backend `dev,local` :8080, PostgreSQL 16.15 local `beefcare`, qua proxy Vite :5173, `owner-2@beefcare.local` trại C: tạo 6951 → Manager 403 COM-01, 1.001 ký tự 400 COM-10, thiếu key 400 COM-19, hủy 200 (lý do trim), lặp cùng key trả đúng body, hủy lần hai 409 COM-05, đọc lại, `status=CANCELLED`, tạo yêu cầu mới 6952 `reopened=false`. DB: `cancelled_by` = owner-2, audit `PAYMENT_REQUEST_CANCELLED` vai trò OWNER, chi tiết không chứa lý do.
- UI thật (Chromium headless): SCR-59 yêu cầu 6952 → hộp thoại MSG-FE19-17 → POST 200 có `Idempotency-Key` → MSG-FE19-18, không QR / sao chép / nút hủy, không tràn ngang ở 1366 và 390 px.
- Migration `20261116000100`: áp trên DB local đang có dữ liệu (nâng cấp) và trên schema mới của Testcontainers; 3 cột nullable + FK, dữ liệu cũ để null.
- Chưa kiểm: bản tích hợp / `main`, SePay LIVE, kiểm tay của người dùng trên giao diện.

## Handoff FE

- Contract: A18 trong `docs/api/openapi.json` (operationId `cancelPayment`, schema `PaymentCancelRequest`); `PaymentDTO` / `PlatformPaymentRead` thêm `cancelledAt`, `cancelReason` (nullable); `state` / bộ lọc thêm `CANCELLED`; `matchResult` thêm `REQUEST_CANCELLED`. Chỉ thêm, không bỏ trường.
- Luồng: login / CSRF → A3 chi tiết (`receivedAt` null và PENDING chưa hết hạn mới hiện nút) → A18 với key giữ nguyên khi thử lại → đọc lại A3.
- Lỗi: 403 COM-01, 404 COM-08, 400 COM-10 / COM-19, 409 COM-05 (tải lại), 409 FE19-19 `{code, receivedAt}` (hộp thoại "Không hủy được yêu cầu").
- Không có thông báo / email khi hủy. Trạng thái READY_FOR_FE chờ gộp vào `main` và kiểm trên bản tích hợp.
