# FE-19 – Mô hình hàm phía PM (UC-04 → UC-07) {#fe19-pm-functions}

Quản lý nền tảng (PM) xem gói của các trại, kiểm các khoản chuyển và quản lý bảng giá. Đối soát là so giao dịch ngân hàng với yêu cầu thanh toán tương ứng.

- Đọc các mũi tên từ trên xuống. Rê chuột lên ô hoặc số nguồn để xem hàm và đoạn code tương ứng.
- Khi PM chấp nhận một chứng từ phù hợp, hệ thống dùng cùng hàm `confirm` để xác nhận thanh toán như khi SePay tự đối chiếu được.[](source:hook-review)[](source:hook-confirm)

@answer scope="Code dev 703f90e0 · UC-FE19-04 → 07"
@meta locale=en repo_url=https://github.com/he180931-del/BeefCare-.git repo_revision=703f90e0ccdaa7c995525ce7e821d59c14829821
@source fe-sub-routes title="useSubscriptionList / useSubscriptionDetail" path=frontend/src/features/platform-service/hooks/usePlatformServiceUseCase.ts lines=18:24
@source fe-platform-api title="platformServiceApi: listSubscriptions / getSubscription / getPayment" path=frontend/src/features/platform-service/api/platformServiceApi.ts lines=162:204
@source res-sub-pm title="PlatformSubscriptionResource" path=backend/src/main/java/vn/edu/fpt/beefcare/web/rest/PlatformSubscriptionResource.java lines=29:48
@source svc-sub-query title="PlatformSubscriptionQueryService.subscriptions / subscription" path=backend/src/main/java/vn/edu/fpt/beefcare/service/payment/PlatformSubscriptionQueryService.java lines=60:172
@source fe-read-page title="Hook đọc chứng từ, yêu cầu và chi tiết" path=frontend/src/features/platform-service/hooks/usePlatformServiceUseCase.ts lines=44:65
@source fe-read-api title="platformPaymentReadApi" path=frontend/src/features/platform-service/api/platformPaymentReadApi.ts lines=153:192
@source res-pay title="PlatformPaymentResource" path=backend/src/main/java/vn/edu/fpt/beefcare/web/rest/PlatformPaymentResource.java lines=35:104
@source svc-pay-query title="PlatformPaymentQueryService: tiles / evidence / candidates / payments" path=backend/src/main/java/vn/edu/fpt/beefcare/service/payment/PlatformPaymentQueryService.java lines=66:210
@source fe-evidence-actions title="EvidenceActions: review / lock / record / unlock" path=frontend/src/features/platform-service/components/EvidenceActions.tsx lines=90:126
@source fe-lookup title="SePayLookup: lookupById / lookupPeriod" path=frontend/src/features/platform-service/components/SePayLookup.tsx lines=20:55
@source fe-reconcile-api title="platformReconciliationApi" path=frontend/src/features/platform-service/api/platformReconciliationApi.ts lines=93:118
@source idem-platform title="IdempotencyCommandService.executePlatform" path=backend/src/main/java/vn/edu/fpt/beefcare/service/IdempotencyCommandService.java lines=109:121
@source platform-role title="PlatformAccessService.requireRole" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAccessService.java lines=24:32
@source hook-lookup title="SePayWebhookService.lookupAndImport / lookupPeriod" path=backend/src/main/java/vn/edu/fpt/beefcare/service/payment/SePayWebhookService.java lines=206:230
@source hook-review title="SePayWebhookService.review" path=backend/src/main/java/vn/edu/fpt/beefcare/service/payment/SePayWebhookService.java lines=237:287
@source hook-return title="SePayWebhookService.lockForReturn / recordReturn / unlockReturn" path=backend/src/main/java/vn/edu/fpt/beefcare/service/payment/SePayWebhookService.java lines=288:342
@source hook-confirm title="SePayWebhookService.confirm" path=backend/src/main/java/vn/edu/fpt/beefcare/service/payment/SePayWebhookService.java lines=631:699
@source fe-price-page title="usePlanPriceList / usePlanPriceCommands" path=frontend/src/features/platform-service/hooks/usePlatformServiceUseCase.ts lines=67:85
@source fe-price-api title="planPriceApi" path=frontend/src/features/platform-service/api/planPriceApi.ts lines=48:55
@source res-price title="PlatformPlanPriceResource" path=backend/src/main/java/vn/edu/fpt/beefcare/web/rest/PlatformPlanPriceResource.java lines=17:29
@source svc-price title="PlanPriceService.history / publish / withdraw" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlanPriceService.java lines=39:100

## UC-04 PM xem gói dịch vụ của các trại như thế nào? {#uc04}

@sequence id=f19-uc04-seq title="UC-FE19-04 Gói của các trại"
| actor page | Màn gói các trại | frontend | source:fe-sub-routes |
| actor feapi | Gửi từ web | frontend | source:fe-platform-api |
| actor rest | API gói | backend | source:res-sub-pm |
| actor svc | Tra gói dịch vụ | backend | source:svc-sub-query |
| actor access | Kiểm quyền PM | security | source:platform-role |
| actor db | Cơ sở dữ liệu | database |
| page | feapi | Lấy danh sách theo bộ lọc |
| feapi | rest | Yêu cầu danh sách gói |
| rest | svc | Tra theo tên trại và trạng thái |
| svc | access | Kiểm quyền Quản lý nền tảng |
| svc | db | Đọc trại, Chủ trại và kỳ đã mua |
| svc | feapi | Trả một trang gói dịch vụ | return |
| page | feapi | Chọn trại cần xem |
| feapi | rest | Yêu cầu chi tiết gói của trại |
| rest | svc | Tra chi tiết theo mã trại |
| svc | feapi | Trả các kỳ dịch vụ và trạng thái | return |

@steps id=f19-uc04-steps
| q4-svc | Tra gói dịch vụ | `subscriptions` lọc theo kỳ dịch vụ, trạng thái trại và ngày hết hạn. `subscription` cho thấy kỳ đang dùng, kỳ sắp tới và kỳ đã qua theo cùng một thời điểm tính.[](source:svc-sub-query) | f19-uc04-seq | svc |
| q4-page | Màn gói các trại | `useSubscriptionList` gọi `listSubscriptions` để tải danh sách. Khi PM chọn một trại, `useSubscriptionDetail` gọi `getSubscription` để lấy chi tiết các kỳ.[](source:fe-sub-routes) | f19-uc04-seq | page |

## UC-05 Màn đối soát lấy yêu cầu và chứng từ ở đâu? {#uc05}

@sequence id=f19-uc05-seq title="UC-FE19-05 Xem yêu cầu thanh toán và chứng từ"
| actor page | Màn đối soát | frontend | source:fe-read-page |
| actor feapi | Gửi từ web | frontend | source:fe-read-api |
| actor rest | API thanh toán | backend | source:res-pay |
| actor svc | Tra thanh toán | backend | source:svc-pay-query |
| actor access | Kiểm quyền PM | security | source:platform-role |
| actor db | Cơ sở dữ liệu | database |
| page | feapi | Tải thống kê và chứng từ |
| feapi | rest | Yêu cầu số liệu và danh sách |
| rest | svc | Lấy dữ liệu theo bộ lọc |
| svc | access | Kiểm quyền Quản lý nền tảng |
| svc | db | Đếm và lấy một trang chứng từ |
| svc | feapi | Trả thống kê và danh sách | return |
| page | feapi | Chọn chứng từ cần xem |
| feapi | rest | Yêu cầu chi tiết và yêu cầu có thể khớp |
| rest | svc | Tra chứng từ và các yêu cầu liên quan |
| svc | feapi | Trả chi tiết chứng từ và gợi ý | return |
| page | feapi | Mở danh sách hoặc chọn yêu cầu |
| feapi | rest | Yêu cầu thông tin thanh toán |
| rest | svc | Tra danh sách hoặc chi tiết yêu cầu |
| svc | feapi | Trả thông tin thanh toán | return |

@steps id=f19-uc05-steps
| q5-svc | Tra thanh toán | Trong danh sách, `PlatformPaymentQueryService` che một phần mã giao dịch. Chi tiết cho phép xem lịch sử quyết định và sự kiện, kèm yêu cầu thanh toán liên quan đến quyết định đó.[](source:svc-pay-query) | f19-uc05-seq | svc |
| q5-page | Màn đối soát | Các hook gọi `paymentReadApi` để tải số liệu, chứng từ và yêu cầu. Khi mở một chứng từ, `usePaymentReadEvidence` lấy chi tiết và các yêu cầu có thể khớp cùng lúc. Khi mã khớp chính xác, các gợi ý được giới hạn theo trại.[](source:fe-read-page)[](source:svc-pay-query) | f19-uc05-seq | page |

## UC-06 PM xác nhận chứng từ và xử lý hoàn trả ra sao? {#uc06}

@sequence id=f19-uc06-seq title="UC-FE19-06 Đối soát chứng từ"
| actor page | Màn đối soát | frontend | source:fe-evidence-actions |
| actor feapi | Gửi từ web | frontend | source:fe-reconcile-api |
| actor rest | API thanh toán | backend | source:res-pay |
| actor idem | Chống ghi trùng | security | source:idem-platform |
| actor svc | Xử lý chứng từ | backend | source:hook-review |
| actor access | Kiểm quyền PM | security | source:platform-role |
| actor db | Cơ sở dữ liệu | database |
| phase | Chấp nhận, giữ hoặc từ chối |
| page | feapi | Gửi quyết định và lý do |
| feapi | rest | Yêu cầu đối soát chứng từ |
| rest | idem | Kiểm quyền PM và mã lần gửi |
| idem | svc | Xử lý quyết định của PM |
| svc | access | Kiểm quyền Quản lý nền tảng |
| svc | db | Khóa chứng từ và so phiên bản |
| svc | db | Nếu chấp nhận: khóa và xác nhận thanh toán | emphasis |
| svc | db | Lưu quyết định và ghi nhật ký |
| svc | feapi | Trả chứng từ đã cập nhật | return |
| phase | Khóa, ghi kết quả hoặc mở khóa hoàn trả |
| page | feapi | Chọn thao tác hoàn trả |
| feapi | rest | Yêu cầu xử lý hoàn trả |
| rest | idem | Kiểm quyền PM và mã lần gửi |
| idem | svc | Chạy thao tác hoàn trả đã chọn |
| svc | db | Lưu trạng thái và lịch sử chứng từ |
| phase | Tra cứu giao dịch SePay |
| page | feapi | Gửi mã giao dịch cần tìm |
| feapi | rest | Yêu cầu tra cứu giao dịch |
| rest | svc | Tra SePay và nhập chứng từ |
| svc | db | Lưu một lần, tự xác nhận nếu khớp |

@steps id=f19-uc06-steps
| r6-page | Màn đối soát | `EvidenceActions` gửi lựa chọn chấp nhận, giữ hoặc từ chối cùng mã lần gửi và phiên bản chứng từ (`version`). `SePayLookup` cho tìm theo mã giao dịch hoặc khoảng ngày tối đa 31 ngày.[](source:fe-evidence-actions)[](source:fe-lookup) | f19-uc06-seq | page |
| r6-svc | Xử lý chứng từ | `review` kiểm điều kiện trước khi ghi quyết định. Khi chấp nhận gặp chứng từ đã phân bổ (`EVIDENCE_ALLOCATED`), đang khóa (`LOCKED_FOR_RETURN`), tiền chuyển ra (`OUTGOING`), thiếu yêu cầu khớp (`NO_CANDIDATE`) hoặc sai trại (`OTHER_FARM`), hệ thống trả `MSG-FE19-11`.[](source:hook-review) | f19-uc06-seq | svc |
| r6-db | Cơ sở dữ liệu | Khi chấp nhận thành công, `confirm` ghi thanh toán đã hoàn tất. Hoàn trả chỉ áp dụng cho khoản tiền vào chưa được phân bổ. `recordReturn` ghi kết quả một lần, còn `unlockReturn` dùng khi chưa ghi kết quả.[](source:hook-confirm)[](source:hook-return) | f19-uc06-seq | db |
| r6-lookup | API thanh toán | `lookupAndImport` dùng mã giao dịch SePay để nhận biết lần tra cứu đã xử lý. Nếu chứng từ khớp, hệ thống có thể xác nhận ngay. `lookupPeriod` trả danh sách theo khoảng ngày để PM xem.[](source:hook-lookup) | f19-uc06-seq | rest |

## UC-07 PM công bố hoặc rút phiên bản bảng giá thế nào? {#uc07}

@sequence id=f19-uc07-seq title="UC-FE19-07 Công bố / rút bảng giá"
| actor page | Màn bảng giá | frontend | source:fe-price-page |
| actor feapi | Gửi từ web | frontend | source:fe-price-api |
| actor rest | API bảng giá | backend | source:res-price |
| actor idem | Chống ghi trùng | security | source:idem-platform |
| actor svc | Xử lý bảng giá | backend | source:svc-price |
| actor access | Kiểm quyền PM | security | source:platform-role |
| actor db | Cơ sở dữ liệu | database |
| phase | Xem lịch sử bảng giá |
| page | feapi | Tải lịch sử bảng giá |
| feapi | rest | Yêu cầu các phiên bản giá |
| rest | svc | Tra lịch sử theo trang |
| svc | access | Kiểm quyền Quản lý nền tảng |
| svc | feapi | Trả giá hiện hành và giá sắp tới | return |
| phase | Công bố hoặc rút phiên bản |
| page | feapi | Gửi giá mới hoặc yêu cầu rút |
| feapi | rest | Yêu cầu công bố hoặc rút giá |
| rest | idem | Kiểm quyền PM và mã lần gửi |
| idem | svc | Chạy lệnh đổi bảng giá |
| svc | db | Khóa thao tác công bố trong lúc lưu |
| svc | db | Kiểm giá, thời điểm và trùng lịch |
| svc | db | Lưu phiên bản và ghi nhật ký | emphasis |
| svc | feapi | Trả bảng giá sau thay đổi | return |

@steps id=f19-uc07-steps
| p7-page | Màn bảng giá | `usePlanPriceList` tải lịch sử bảng giá. Khi PM xác nhận công bố hoặc rút phiên bản, `usePlanPriceCommands` gửi `publish` hoặc `withdraw` qua `planPriceApi`.[](source:fe-price-page)[](source:fe-price-api) | f19-uc07-seq | page |
| p7-svc | Xử lý bảng giá | `publish` kiểm giá, mốc hiệu lực và lịch đã có. Mốc trong quá khứ báo `MSG-FE19-14`, trùng lịch báo `MSG-FE19-15`, giá sai báo `MSG-FE19-13`. `withdraw` chỉ áp dụng với phiên bản đã lên lịch, cần đúng phiên bản đã xem và lý do dài 5–1.000 ký tự.[](source:svc-price) | f19-uc07-seq | svc |
| p7-db | Cơ sở dữ liệu | `lockPublications` xử lý từng lệnh công bố hoặc rút theo thứ tự, để hai PM thao tác cùng lúc cũng tránh tạo lịch trùng.[](source:svc-price) | f19-uc07-seq | db |
