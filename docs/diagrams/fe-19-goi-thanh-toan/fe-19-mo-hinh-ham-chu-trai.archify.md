# FE-19 – Mô hình hàm phía Chủ trại và SePay (UC-01, 02, 03, 08) {#fe19-owner-functions}

Phía Chủ trại dồn vào `SubscriptionPaymentService`; tiền về đi qua `SePayWebhookService`. Hai bên gặp nhau ở **bước xác nhận dùng chung `confirm`**, chạy sau khi khóa trại → gói → yêu cầu theo đúng thứ tự.

- Frontend gọi qua `subscriptionApi`; tạo và hủy yêu cầu gửi `Idempotency-Key`.[](source:fe-sub-api)
- Webhook trả 200 ngay sau khi lưu chứng từ và job; JOB-06 mới là bước đối chiếu và xác nhận.[](source:hook-receive)
- `requestPayment` và `cancelPayment` đều khóa dòng trại trước, cùng thứ tự với `confirm`, nên hủy và xác nhận không chạy chồng nhau.[](source:svc-cancel)

@answer scope="Code dev 703f90e0 · UC-FE19-01, 02, 03, 08 · D54"
@meta locale=en repo_url=https://github.com/he180931-del/BeefCare-.git repo_revision=703f90e0ccdaa7c995525ce7e821d59c14829821
@source fe-overview title="useOverview" path=frontend/src/features/subscription/hooks/useOverview.ts lines=7:19
@source fe-request title="usePaymentRequest" path=frontend/src/features/subscription/hooks/usePaymentRequest.ts lines=7:23
@source fe-status title="usePaymentStatus: tải lại mỗi 5 giây" path=frontend/src/features/subscription/hooks/usePaymentStatus.ts lines=21:56
@source fe-cancel title="CancelRequestDialog: hủy yêu cầu" path=frontend/src/features/subscription/components/CancelRequestDialog.tsx lines=27:47
@source fe-history title="useSubscriptionUseCase: listPayments / getPayment" path=frontend/src/features/subscription/hooks/useSubscriptionUseCase.ts lines=27:41
@source fe-paid title="PaidTransfer: kiểm tra trại và điều hướng" path=frontend/src/features/subscription/components/PaidTransfer.tsx lines=33:67
@source res-context title="FarmWorkspaceResource.context (FE-02)" path=backend/src/main/java/vn/edu/fpt/beefcare/web/rest/FarmWorkspaceResource.java lines=24:30
@source fe-receipt title="PaymentSuccessOnArrival: đọc xác nhận theo tab" path=frontend/src/features/subscription/components/PaymentSuccessDialog.tsx lines=95:126
@source fe-sub-api title="subscriptionApi: đọc, tạo và hủy yêu cầu" path=frontend/src/features/subscription/api/subscriptionApi.ts lines=58:149
@source res-sub title="SubscriptionPaymentResource" path=backend/src/main/java/vn/edu/fpt/beefcare/web/rest/SubscriptionPaymentResource.java lines=34:90
@source idem-execute title="IdempotencyCommandService.execute" path=backend/src/main/java/vn/edu/fpt/beefcare/service/IdempotencyCommandService.java lines=101:107
@source access-require title="FarmAccessService.require" path=backend/src/main/java/vn/edu/fpt/beefcare/service/FarmAccessService.java lines=45:71
@source svc-overview title="SubscriptionPaymentService.overview" path=backend/src/main/java/vn/edu/fpt/beefcare/service/SubscriptionPaymentService.java lines=97:131
@source svc-history title="SubscriptionPaymentService.history / paymentDetails" path=backend/src/main/java/vn/edu/fpt/beefcare/service/SubscriptionPaymentService.java lines=132:170
@source svc-request title="SubscriptionPaymentService.requestPayment" path=backend/src/main/java/vn/edu/fpt/beefcare/service/SubscriptionPaymentService.java lines=172:237
@source svc-cancel title="SubscriptionPaymentService.cancelPayment" path=backend/src/main/java/vn/edu/fpt/beefcare/service/SubscriptionPaymentService.java lines=239:274
@source job-expire title="JOB-03 expireUnpaidRequests" path=backend/src/main/java/vn/edu/fpt/beefcare/service/payment/SubscriptionLifecycleJob.java lines=58:84
@source res-hook title="SePayWebhookResource.receive" path=backend/src/main/java/vn/edu/fpt/beefcare/web/rest/SePayWebhookResource.java lines=34:41
@source hook-receive title="SePayWebhookService.receive" path=backend/src/main/java/vn/edu/fpt/beefcare/service/payment/SePayWebhookService.java lines=148:180
@source hook-store title="processWithReplayProtection / store" path=backend/src/main/java/vn/edu/fpt/beefcare/service/payment/SePayWebhookService.java lines=434:503
@source hook-job title="JOB-06 processDueEvidence / runLeasedJob / exhaust" path=backend/src/main/java/vn/edu/fpt/beefcare/service/payment/SePayWebhookService.java lines=504:566
@source hook-process title="SePayWebhookService.processStored" path=backend/src/main/java/vn/edu/fpt/beefcare/service/payment/SePayWebhookService.java lines=567:630
@source hook-confirm title="SePayWebhookService.confirm" path=backend/src/main/java/vn/edu/fpt/beefcare/service/payment/SePayWebhookService.java lines=631:699

## UC-01 Xem gói gọi những hàm nào? {#uc01}

@sequence id=f19-uc01-seq title="UC-FE19-01 Xem gói và trạng thái dịch vụ"
| actor page | SCR-57 Gói | frontend | source:fe-overview |
| actor feapi | subscriptionApi | frontend | source:fe-sub-api |
| actor rest | Subscription REST | backend | source:res-sub |
| actor svc | SubPaymentService | backend | source:svc-overview |
| actor access | FarmAccessService | security | source:access-require |
| actor db | Cơ sở dữ liệu | database |
| page | feapi | useOverview → getOverview(farmId) |
| feapi | rest | GET …/subscription |
| rest | svc | overview(farmId) |
| svc | access | require(MANAGE_FARM_INFORMATION) | security |
| svc | db | kỳ PAID, PENDING còn hạn, giá hiệu lực |
| svc | feapi | SubscriptionOverview | return |
| feapi | page | 14 mục SCR-57 | return |

@steps id=f19-uc01-steps
| o1-svc | SubPaymentService | `overview` tính kỳ hiện tại / tương lai, ngày còn lại (làm tròn xuống), ngày mở gia hạn, yêu cầu PENDING còn hạn và `eligibility`; chỉ đọc, không tạo gói.[](source:svc-overview) | f19-uc01-seq | svc |
| o1-access | FarmAccessService | Chỉ Chủ trại; xem được ở mọi trạng thái dịch vụ; vai trò khác → MSG-COM-01.[](source:access-require) | f19-uc01-seq | access |

## UC-02 Tạo, chờ và hủy yêu cầu thanh toán gọi những hàm nào? {#uc02}

@sequence id=f19-uc02-seq title="UC-FE19-02 Tạo / chờ / hủy yêu cầu thanh toán"
| actor page | SCR-58 / SCR-59 | frontend | source:fe-request |
| actor feapi | API gói (FE) | frontend | source:fe-sub-api |
| actor rest | Payment REST | backend | source:res-sub |
| actor idem | Idempotency | security | source:idem-execute |
| actor svc | Payment Svc | backend | source:svc-request |
| actor access | Quyền trại | security | source:access-require |
| actor db | Cơ sở dữ liệu | database |
| actor farmapi | API trại | backend | source:res-context |
| phase | Tạo yêu cầu |
| page | feapi | usePaymentRequest → createPayment |
| feapi | rest | POST …/subscription/payments |
| rest | idem | execute(PAYMENT_REQUEST) |
| idem | svc | requestPayment(farmId, request) |
| svc | access | require(MANAGE_FARM_INFORMATION) | security |
| svc | db | lockById(farm), PENDING còn hạn? |
| svc | db | cửa sổ gia hạn, giá, TK nhận |
| svc | db | Subscription + Payment PENDING | emphasis |
| svc | feapi | PaymentDTO (quoteRef, QR) | return |
| phase | Chờ (SCR-59) |
| page | feapi | usePaymentStatus → refreshPayment |
| feapi | rest | GET …/payments/{id} |
| rest | svc | paymentDetails(farmId, id) |
| svc | feapi | state, receivedAt | return |
| phase | Đã thanh toán (D54) |
| page | farmapi | PaidTransfer → enterFarm → GET …/context |
| farmapi | page | Ngữ cảnh trại hoặc lỗi truy cập | return |
| phase | Hủy (D38) |
| page | feapi | cancelPayment + khóa yêu cầu |
| feapi | rest | POST …/{id}/cancel |
| rest | idem | execute(PAYMENT_CANCEL) |
| idem | svc | cancelPayment(...) |
| svc | db | lockById(farm), chưa nhận giao dịch? | security |
| svc | db | CANCELLED + audit |
| svc | feapi | PaymentDTO | return |

@steps id=f19-uc02-steps
| p2-page | SCR-58 / SCR-59 | `usePaymentRequest` gửi kỳ hạn và phiên bản giá đã xem.[](source:fe-request) `usePaymentStatus` tải lại mỗi 5 giây khi PENDING, dừng khi PAID / EXPIRED / rời màn.[](source:fe-status) Hộp thoại hủy giữ khóa theo lý do.[](source:fe-cancel) | f19-uc02-seq | page |
| p2-paid | SCR-58 / SCR-59 | `PaidTransfer` gọi bước vào trại khi nhận PAID. API ngữ cảnh thuộc `FarmWorkspaceResource` của FE-02.[](source:res-context) Khi vào được, frontend lưu xác nhận theo tab và thay trang bằng Tổng quan. Nếu chưa vào được, biên nhận kèm lý do và nút thử lại ở SCR-59.[](source:fe-paid) `PaymentSuccessOnArrival` đọc và xóa bản xác nhận ở Tổng quan của đúng trại.[](source:fe-receipt) | f19-uc02-seq | page |
| p2-svc | Payment Svc | `requestPayment`: đã có PENDING còn hạn thì trả lại (`reopened`); SUSPENDED → MSG-FE19-09; ngoài cửa sổ → MSG-FE19-03; thiếu giá / TK → MSG-FE19-04; giá đổi → MSG-FE19-02.[](source:svc-request) | f19-uc02-seq | svc |
| p2-db | Cơ sở dữ liệu | Tạo Subscription nếu chưa có; `quoteRef` = "BC" + 12 ký tự; hết hạn sau 24 giờ; chốt TK nhận; audit `PAYMENT_REQUEST`. JOB-03 chuyển PENDING quá hạn sang EXPIRED mỗi 5 phút.[](source:job-expire) | f19-uc02-seq | db |
| p2-cancel | Payment Svc | `cancelPayment`: không còn PENDING còn hạn → MSG-COM-05; đã nhận giao dịch → MSG-FE19-19; lý do quá 1.000 ký tự → MSG-COM-10.[](source:svc-cancel) | f19-uc02-seq | svc |

## UC-03 Xem lịch sử thanh toán gọi những hàm nào? {#uc03}

@sequence id=f19-uc03-seq title="UC-FE19-03 Lịch sử và chi tiết thanh toán"
| actor page | SCR-60 Lịch sử | frontend | source:fe-history |
| actor feapi | subscriptionApi | frontend | source:fe-sub-api |
| actor rest | Subscription REST | backend | source:res-sub |
| actor svc | SubPaymentService | backend | source:svc-history |
| actor access | FarmAccessService | security | source:access-require |
| actor db | Cơ sở dữ liệu | database |
| page | feapi | useSubscriptionUseCase → listPayments |
| feapi | rest | GET …/subscription/payments |
| rest | svc | history(farmId, q, status, ...) |
| svc | access | require(MANAGE_FARM_INFORMATION) | security |
| svc | db | trang 20 dòng, mới nhất trước |
| svc | feapi | PaymentHistoryPage | return |
| page | feapi | getPayment(farmId, id) |
| feapi | rest | GET …/payments/{id} |
| rest | svc | paymentDetails(farmId, id) |
| svc | feapi | PaymentDTO | return |

@steps id=f19-uc03-steps
| h3-svc | SubPaymentService | `history` kiểm khoảng ngày (MSG-COM-11), bộ lọc, trang; `paymentDetails` trả một yêu cầu của đúng trại, không có → MSG-COM-08.[](source:svc-history) | f19-uc03-seq | svc |
| h3-page | SCR-60 Lịch sử | Danh sách và chi tiết dùng chung `PaymentDTO`; SCR-59 mở lại từ dòng PENDING.[](source:fe-history) | f19-uc03-seq | page |

## UC-08 Tiền về qua SePay gọi những hàm nào? {#uc08}

@sequence id=f19-uc08-seq title="UC-FE19-08 Xác nhận từ SePay (API-02 + JOB-06)"
| actor sepay | SePay | external |
| actor rest | Webhook REST | backend | source:res-hook |
| actor svc | SePayWebhookSvc | backend | source:hook-receive |
| actor job | JOB-06 | messagebus | source:hook-job |
| actor db | Cơ sở dữ liệu | database |
| phase | Nhận webhook |
| sepay | rest | POST /api/webhooks/sepay |
| rest | svc | receive(timestamp, signature, body) |
| svc | db | kiểm HMAC, lưu chứng từ RECEIVED + job | security |
| svc | rest | WebhookResult | return |
| rest | sepay | 200 success | return |
| phase | Xử lý (JOB-06) |
| job | svc | processDueEvidence → runLeasedJob |
| svc | db | processStored: chiều, mã, số tiền, cửa sổ |
| svc | db | lock farm → subscription → payment | security |
| svc | db | confirm: PAID, kỳ, biên lai, audit | emphasis |
| svc | db | thông báo + queuePaymentReceipt |

@steps id=f19-uc08-steps
| s8-rest | Webhook REST | Đọc raw body, gọi `receive`, trả `{success: true}` sau khi chứng từ và job đã commit.[](source:res-hook) | f19-uc08-seq | rest |
| s8-svc | SePayWebhookSvc | `receive`: chữ ký sai → 401 và chỉ lưu metadata; sai kiểu trường → 400; `processWithReplayProtection` khử trùng theo bộ 4.[](source:hook-receive) `store` tạo chứng từ RECEIVED.[](source:hook-store) | f19-uc08-seq | svc |
| s8-job | JOB-06 | `runLeasedJob` thử lại sau 1 / 5 / 15 phút rồi mỗi giờ; quá 24 giờ thì `exhaust` đặt NEEDS_REVIEW.[](source:hook-job) | f19-uc08-seq | job |
| s8-db | Cơ sở dữ liệu | `processStored` không khớp thì `saveEvidence` (UNMATCHED).[](source:hook-process) `confirm` tính kỳ từ `latestEnd`, đặt `ACTIVE` nếu trại chưa SUSPENDED, ghi audit, thông báo và email biên lai.[](source:hook-confirm) | f19-uc08-seq | db |
