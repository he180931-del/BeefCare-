# FE-19 – Mô hình hàm phía Chủ trại và SePay (UC-01, 02, 03, 08) {#fe19-owner-functions}

Chủ trại chọn gói, nhận mã thanh toán rồi chuyển khoản. Khi đối chiếu được tiền về, hệ thống ghi nhận kỳ dịch vụ và kiểm tra xem Chủ trại đã vào được trại chưa.

- Đọc các mũi tên từ trên xuống. Rê chuột lên ô hoặc số nguồn để xem hàm và đoạn code tương ứng.
- SePay báo ngân hàng đã nhận tiền. Tác vụ JOB-06 chạy sau để so giao dịch với yêu cầu trước khi xác nhận thanh toán.[](source:hook-receive)[](source:hook-job)
- Khi tạo, hủy hoặc xác nhận thanh toán, hệ thống khóa bản ghi theo thứ tự để hai thao tác diễn ra tuần tự.[](source:svc-request)[](source:svc-cancel)[](source:hook-confirm)

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

## UC-01 Màn gói dịch vụ lấy trạng thái và giá ở đâu? {#uc01}

@sequence id=f19-uc01-seq title="UC-FE19-01 Xem gói và trạng thái dịch vụ"
| actor page | Màn gói dịch vụ | frontend | source:fe-overview |
| actor feapi | Gửi từ web | frontend | source:fe-sub-api |
| actor rest | API gói | backend | source:res-sub |
| actor svc | Xử lý gói | backend | source:svc-overview |
| actor access | Kiểm quyền | security | source:access-require |
| actor db | Cơ sở dữ liệu | database |
| page | feapi | Tải gói của trại |
| feapi | rest | Yêu cầu tổng quan gói |
| rest | svc | Lấy thông tin gói theo trại |
| svc | access | Kiểm quyền Chủ trại |
| svc | db | Đọc kỳ đã mua, yêu cầu chờ và giá |
| svc | feapi | Trả trạng thái và thông tin gói | return |
| feapi | page | Hiện thông tin gói trên màn hình | return |

@steps id=f19-uc01-steps
| o1-svc | Xử lý gói | `SubscriptionPaymentService.overview` cho biết kỳ hiện tại hoặc tương lai, số ngày còn lại (làm tròn xuống), ngày mở gia hạn và giá hiện hành. Hàm cũng trả yêu cầu đang chờ nếu còn hạn.[](source:svc-overview) | f19-uc01-seq | svc |
| o1-access | Kiểm quyền | Chủ trại xem gói được ở mọi trạng thái dịch vụ. `FarmAccessService.require` kiểm quyền `MANAGE_FARM_INFORMATION` và trả `MSG-COM-01` nếu tài khoản thiếu quyền.[](source:access-require) | f19-uc01-seq | access |

## UC-02 Tạo, theo dõi và hủy yêu cầu thanh toán ra sao? {#uc02}

@sequence id=f19-uc02-seq title="UC-FE19-02 Tạo / chờ / hủy yêu cầu thanh toán"
| actor page | Màn thanh toán | frontend | source:fe-request |
| actor feapi | Gửi từ web | frontend | source:fe-sub-api |
| actor rest | API thanh toán | backend | source:res-sub |
| actor idem | Chống ghi trùng | security | source:idem-execute |
| actor svc | Xử lý thanh toán | backend | source:svc-request |
| actor access | Kiểm quyền | security | source:access-require |
| actor db | Cơ sở dữ liệu | database |
| actor farmapi | API trang trại | backend | source:res-context |
| phase | Tạo yêu cầu |
| page | feapi | Gửi kỳ hạn và giá đã xem |
| feapi | rest | Yêu cầu tạo mã thanh toán |
| rest | idem | Kiểm tra mã lần gửi |
| idem | svc | Chạy lệnh tạo yêu cầu |
| svc | access | Kiểm quyền Chủ trại |
| svc | db | Kiểm yêu cầu đang chờ còn hạn |
| svc | db | Kiểm hạn gia hạn, giá và tài khoản nhận |
| svc | db | Lưu yêu cầu đang chờ | emphasis |
| svc | feapi | Trả mã thanh toán và mã QR | return |
| phase | Chờ tiền về |
| page | feapi | Kiểm tra tiến độ mỗi 5 giây |
| feapi | rest | Hỏi trạng thái yêu cầu |
| rest | svc | Lấy chi tiết yêu cầu |
| svc | feapi | Trả trạng thái và thời điểm nhận | return |
| phase | Đã thanh toán |
| page | farmapi | Kiểm quyền vào trại đã thanh toán |
| farmapi | page | Trả thông tin trại hoặc lỗi quyền | return |
| phase | Hủy yêu cầu |
| page | feapi | Gửi lý do hủy và mã lần gửi |
| feapi | rest | Yêu cầu hủy thanh toán |
| rest | idem | Kiểm tra mã lần gửi |
| idem | svc | Chạy lệnh hủy |
| svc | db | Kiểm đã nhận giao dịch chưa |
| svc | db | Lưu trạng thái đã hủy và ghi nhật ký |
| svc | feapi | Trả yêu cầu sau khi hủy | return |

@steps id=f19-uc02-steps
| p2-page | Màn thanh toán | `usePaymentRequest` gửi kỳ hạn và phiên bản giá lúc mở màn. `usePaymentStatus` kiểm tra mỗi 5 giây khi yêu cầu đang chờ (`PENDING`) và dừng khi đã thanh toán, hết hạn hoặc rời màn. Hộp hủy giữ mã lần gửi theo lý do.[](source:fe-request)[](source:fe-status)[](source:fe-cancel) | f19-uc02-seq | page |
| p2-paid | Màn thanh toán | Khi nhận trạng thái đã thanh toán (`PAID`), `PaidTransfer` gọi API ngữ cảnh trại của FE-02 để kiểm quyền. Nếu vào được, hệ thống mở Tổng quan và `PaymentSuccessOnArrival` hiện biên nhận một lần. Nếu chưa vào được, màn thanh toán hiện lý do và nút thử lại.[](source:res-context)[](source:fe-paid)[](source:fe-receipt) | f19-uc02-seq | page |
| p2-svc | Xử lý thanh toán | `requestPayment` mở lại yêu cầu đang chờ còn hạn. Nếu cần tạo mới, hàm kiểm trại tạm ngưng, thời gian gia hạn, cấu hình tài khoản nhận và giá đã xem. Các mã lần lượt là `MSG-FE19-09`, `MSG-FE19-03`, `MSG-FE19-04` và `MSG-FE19-02`.[](source:svc-request) | f19-uc02-seq | svc |
| p2-db | Cơ sở dữ liệu | Hệ thống tạo gói nếu trại chưa có, lưu tài khoản nhận và mã thanh toán (`quoteRef`) bắt đầu bằng BC, theo sau là 12 ký tự. Yêu cầu có hạn 24 giờ. JOB-03 đánh dấu đã hết hạn mỗi 5 phút.[](source:svc-request)[](source:job-expire) | f19-uc02-seq | db |
| p2-cancel | Xử lý thanh toán | `cancelPayment` cho hủy yêu cầu còn chờ, còn hạn và chưa nhận giao dịch. Dữ liệu đã đổi báo `MSG-COM-05`, đã nhận giao dịch báo `MSG-FE19-19`, còn lý do dài quá 1.000 ký tự báo `MSG-COM-10`.[](source:svc-cancel) | f19-uc02-seq | svc |

## UC-03 Lịch sử và chi tiết thanh toán được tải thế nào? {#uc03}

@sequence id=f19-uc03-seq title="UC-FE19-03 Lịch sử và chi tiết thanh toán"
| actor page | Màn lịch sử | frontend | source:fe-history |
| actor feapi | Gửi từ web | frontend | source:fe-sub-api |
| actor rest | API thanh toán | backend | source:res-sub |
| actor svc | Tra thanh toán | backend | source:svc-history |
| actor access | Kiểm quyền | security | source:access-require |
| actor db | Cơ sở dữ liệu | database |
| page | feapi | Lấy lịch sử theo bộ lọc |
| feapi | rest | Yêu cầu danh sách thanh toán |
| rest | svc | Tra thanh toán theo trại |
| svc | access | Kiểm quyền Chủ trại |
| svc | db | Lấy 20 dòng, mới nhất trước |
| svc | feapi | Trả một trang lịch sử | return |
| page | feapi | Chọn yêu cầu cần xem |
| feapi | rest | Yêu cầu chi tiết thanh toán |
| rest | svc | Tìm đúng yêu cầu của trại |
| svc | feapi | Trả chi tiết yêu cầu | return |

@steps id=f19-uc03-steps
| h3-svc | Tra thanh toán | `history` lọc lịch sử theo trạng thái, ngày và số trang. Khoảng ngày sai trả `MSG-COM-11`. `paymentDetails` chỉ trả yêu cầu của đúng trại, không tìm thấy thì báo `MSG-COM-08`.[](source:svc-history) | f19-uc03-seq | svc |
| h3-page | Màn lịch sử | `useSubscriptionUseCase` gọi `listPayments` và `getPayment`. Danh sách và chi tiết dùng cùng kiểu dữ liệu `PaymentDTO`. Yêu cầu đang chờ có thể mở lại màn chuyển khoản SCR-59.[](source:fe-history) | f19-uc03-seq | page |

## UC-08 Khi SePay báo tiền về, lúc nào hệ thống xác nhận? {#uc08}

@sequence id=f19-uc08-seq title="UC-FE19-08 Xác nhận từ SePay (API-02 + JOB-06)"
| actor sepay | SePay | external |
| actor rest | API nhận tin | backend | source:res-hook |
| actor svc | Đối chiếu tiền | backend | source:hook-receive |
| actor job | Tác vụ JOB-06 | messagebus | source:hook-job |
| actor db | Cơ sở dữ liệu | database |
| phase | Nhận thông báo của SePay |
| sepay | rest | Báo giao dịch ngân hàng |
| rest | svc | Gửi chữ ký và dữ liệu giao dịch |
| svc | db | Kiểm chữ ký, lưu chứng từ và xếp việc |
| svc | rest | Trả kết quả nhận thông báo | return |
| rest | sepay | Báo đã nhận giao dịch | return |
| phase | Đối chiếu và xác nhận |
| job | svc | Xử lý chứng từ đang chờ |
| svc | db | So chiều tiền, mã, số tiền và thời hạn |
| svc | db | Giữ trại, gói và yêu cầu trong lúc ghi |
| svc | db | Xác nhận thanh toán, lưu kỳ và biên lai | emphasis |
| svc | db | Ghi thông báo và xếp email biên lai |

@steps id=f19-uc08-steps
| s8-rest | API nhận tin | SePay gọi `POST /api/webhooks/sepay`. API chuyển phần dữ liệu gốc và chữ ký cho `receive`, rồi trả `200` sau khi lưu chứng từ và việc cần xử lý.[](source:res-hook) | f19-uc08-seq | rest |
| s8-svc | Đối chiếu tiền | `receive` kiểm chữ ký HMAC và định dạng dữ liệu. Sai chữ ký trả `401`, sai dữ liệu trả `400`. `processWithReplayProtection` nhận biết giao dịch đã gửi, còn `store` ghi chứng từ chờ xử lý (`RECEIVED`).[](source:hook-receive)[](source:hook-store) | f19-uc08-seq | svc |
| s8-job | Tác vụ JOB-06 | `runLeasedJob` cho thử lại sau 1, 5 và 15 phút, sau đó mỗi giờ. Nếu sau 24 giờ vẫn lỗi, `exhaust` chuyển chứng từ sang Cần kiểm tra (`NEEDS_REVIEW`).[](source:hook-job) | f19-uc08-seq | job |
| s8-db | Cơ sở dữ liệu | `processStored` lưu chứng từ chưa khớp (`UNMATCHED`). Khi khớp, `confirm` tính kỳ mới từ hạn gần nhất, lưu biên lai, nhật ký và thông báo. Trại đã tạm ngưng vẫn nhận kỳ mua và giữ trạng thái tạm ngưng.[](source:hook-process)[](source:hook-confirm) | f19-uc08-seq | db |
