# FE-19 – Mô hình hàm phía PM (UC-04 → UC-07) {#fe19-pm-functions}

Phía PM của FE-19 chia thành **hai service đọc** (`PlatformSubscriptionQueryService`, `PlatformPaymentQueryService`) và **hai service ghi** (`SePayWebhookService` cho đối soát, `PlanPriceService` cho bảng giá). Mọi hàm bắt đầu bằng `requireRole(PM)`.

- PM chấp nhận chứng từ đi vào cùng hàm `confirm` với webhook SePay, nên PAID, kỳ, biên lai và audit giống hệt nhau.[](source:hook-review)
- Tra cứu SePay theo mã giao dịch không dùng `Idempotency-Key`: mã giao dịch là khóa yêu cầu.[](source:hook-lookup)
- Ở chế độ backend, màn đối soát dùng `PaymentReadPage` với `platformPaymentReadApi` và `platformReconciliationApi`; `platformServiceApi` chỉ phục vụ bản demo cho phần này.[](source:fe-read-page)

@answer scope="Code nhánh dev, commit fbbe942 · UC-FE19-04 → 07"
@meta locale=en
@source fe-sub-routes title="PlatformSubscriptionRoutes: getSubscription / listSubscriptions" path=frontend/src/features/platform-service/pages/PlatformSubscriptionRoutes.tsx lines=36:100
@source fe-platform-api title="platformServiceApi: listSubscriptions / getSubscription / getPayment" path=frontend/src/features/platform-service/api/platformServiceApi.ts lines=148:190
@source res-sub-pm title="PlatformSubscriptionResource" path=backend/src/main/java/vn/edu/fpt/beefcare/web/rest/PlatformSubscriptionResource.java lines=29:48
@source svc-sub-query title="PlatformSubscriptionQueryService.subscriptions / subscription" path=backend/src/main/java/vn/edu/fpt/beefcare/service/payment/PlatformSubscriptionQueryService.java lines=60:172
@source fe-read-page title="PaymentReadPage: chứng từ, yêu cầu, chi tiết" path=frontend/src/features/platform-service/pages/PaymentReadPage.tsx lines=50:160
@source fe-read-api title="platformPaymentReadApi" path=frontend/src/features/platform-service/api/platformPaymentReadApi.ts lines=152:191
@source res-pay title="PlatformPaymentResource" path=backend/src/main/java/vn/edu/fpt/beefcare/web/rest/PlatformPaymentResource.java lines=35:104
@source svc-pay-query title="PlatformPaymentQueryService: tiles / evidence / candidates / payments" path=backend/src/main/java/vn/edu/fpt/beefcare/service/payment/PlatformPaymentQueryService.java lines=66:210
@source fe-evidence-actions title="EvidenceActions: review / lock / record / unlock" path=frontend/src/features/platform-service/components/EvidenceActions.tsx lines=90:126
@source fe-lookup title="SePayLookup: lookupById / lookupPeriod" path=frontend/src/features/platform-service/components/SePayLookup.tsx lines=20:55
@source fe-reconcile-api title="platformReconciliationApi" path=frontend/src/features/platform-service/api/platformReconciliationApi.ts lines=92:117
@source idem-platform title="IdempotencyCommandService.executePlatform" path=backend/src/main/java/vn/edu/fpt/beefcare/service/IdempotencyCommandService.java lines=109:121
@source platform-role title="PlatformAccessService.requireRole" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAccessService.java lines=24:32
@source hook-lookup title="SePayWebhookService.lookupAndImport / lookupPeriod" path=backend/src/main/java/vn/edu/fpt/beefcare/service/payment/SePayWebhookService.java lines=206:230
@source hook-review title="SePayWebhookService.review" path=backend/src/main/java/vn/edu/fpt/beefcare/service/payment/SePayWebhookService.java lines=237:287
@source hook-return title="SePayWebhookService.lockForReturn / recordReturn / unlockReturn" path=backend/src/main/java/vn/edu/fpt/beefcare/service/payment/SePayWebhookService.java lines=288:342
@source hook-confirm title="SePayWebhookService.confirm" path=backend/src/main/java/vn/edu/fpt/beefcare/service/payment/SePayWebhookService.java lines=631:699
@source fe-price-page title="PlanPriceRoutes: list / publish / withdraw" path=frontend/src/features/platform-service/pages/PlanPriceRoutes.tsx lines=40:135
@source fe-price-api title="planPriceApi" path=frontend/src/features/platform-service/api/planPriceApi.ts lines=46:53
@source res-price title="PlatformPlanPriceResource" path=backend/src/main/java/vn/edu/fpt/beefcare/web/rest/PlatformPlanPriceResource.java lines=17:29
@source svc-price title="PlanPriceService.history / publish / withdraw" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlanPriceService.java lines=39:100

## UC-04 Gói của các trại gọi những hàm nào? {#uc04}

@sequence id=f19-uc04-seq title="UC-FE19-04 Gói của các trại"
| actor page | SCR-61 Gói các trại | frontend | source:fe-sub-routes |
| actor feapi | platformApi | frontend | source:fe-platform-api |
| actor rest | PlatformSub REST | backend | source:res-sub-pm |
| actor svc | SubQueryService | backend | source:svc-sub-query |
| actor access | PlatformAccess | security | source:platform-role |
| actor db | Cơ sở dữ liệu | database |
| page | feapi | listSubscriptions(filters) |
| feapi | rest | GET /api/platform/subscriptions |
| rest | svc | subscriptions(q, coverage, ...) |
| svc | access | requireRole(PM) | security |
| svc | db | trại, Chủ trại, kỳ đã xác nhận |
| svc | feapi | Page of SubscriptionRow | return |
| page | feapi | getSubscription(farmId) |
| feapi | rest | GET …/subscriptions/{farmId} |
| rest | svc | subscription(farmId) |
| svc | feapi | SubscriptionDetail + kỳ | return |

@steps id=f19-uc04-steps
| q4-svc | SubQueryService | `subscriptions` lọc theo bao phủ, trạng thái dịch vụ, khoảng ngày kết thúc, sắp theo ngày xác nhận; `subscription` trả các kỳ CURRENT / FUTURE / PAST cùng một đồng hồ.[](source:svc-sub-query) | f19-uc04-seq | svc |
| q4-page | SCR-61 Gói các trại | Danh sách gọi `listSubscriptions`; chọn trại gọi `getSubscription`.[](source:fe-sub-routes) | f19-uc04-seq | page |

## UC-05 Xem yêu cầu và chứng từ gọi những hàm nào? {#uc05}

@sequence id=f19-uc05-seq title="UC-FE19-05 Xem yêu cầu thanh toán và chứng từ"
| actor page | SCR-62 Đối soát | frontend | source:fe-read-page |
| actor feapi | paymentReadApi | frontend | source:fe-read-api |
| actor rest | PlatformPay REST | backend | source:res-pay |
| actor svc | PaymentQuerySvc | backend | source:svc-pay-query |
| actor access | PlatformAccess | security | source:platform-role |
| actor db | Cơ sở dữ liệu | database |
| page | feapi | tiles() · evidence(filters) |
| feapi | rest | GET …/summary · …/evidence |
| rest | svc | tiles() · evidence(status, from, to) |
| svc | access | requireRole(PM) | security |
| svc | db | đếm toàn hệ thống, trang chứng từ |
| svc | feapi | ReadTiles, EvidenceRow[] | return |
| page | feapi | evidenceDetail(id) + candidates(id) |
| feapi | rest | GET …/evidence/{id} · /candidates |
| rest | svc | evidence(id) · candidates(id) |
| svc | feapi | EvidenceDetail, Candidate[] | return |
| page | feapi | payments(filters) · payment(id) |
| feapi | rest | GET /api/platform/payments |
| rest | svc | payments(...) · payment(id) |
| svc | feapi | PaymentView | return |

@steps id=f19-uc05-steps
| q5-svc | PaymentQuerySvc | Chỉ trả mã giao dịch đã che trong danh sách; chi tiết có lịch sử REVIEW / EVENT và yêu cầu liên quan của từng quyết định.[](source:svc-pay-query) | f19-uc05-seq | svc |
| q5-page | SCR-62 Đối soát | Chi tiết chứng từ tải song song với ứng viên; mã chính xác của một yêu cầu chỉ cho ứng viên cùng trại (D22).[](source:fe-read-page) | f19-uc05-seq | page |

## UC-06 Đối soát gọi những hàm nào? {#uc06}

@sequence id=f19-uc06-seq title="UC-FE19-06 Đối soát chứng từ"
| actor page | SCR-62 Đối soát | frontend | source:fe-evidence-actions |
| actor feapi | reconcileApi | frontend | source:fe-reconcile-api |
| actor rest | PlatformPay REST | backend | source:res-pay |
| actor idem | Idempotency | security | source:idem-platform |
| actor svc | SePayWebhookSvc | backend | source:hook-review |
| actor access | PlatformAccess | security | source:platform-role |
| actor db | Cơ sở dữ liệu | database |
| phase | Quyết định ACCEPT / HOLD / REJECT |
| page | feapi | review(id, decision, key) |
| feapi | rest | POST …/evidence/{id}/review |
| rest | idem | executePlatform(PM) |
| idem | svc | review(evidenceId, command) |
| svc | access | requireRole(PM) | security |
| svc | db | lockedEvidence(version) | security |
| svc | db | ACCEPT: lock farm → sub → payment, confirm | emphasis |
| svc | db | saveReview + audit EVIDENCE_REVIEW |
| svc | feapi | EvidenceDTO | return |
| phase | Khóa / ghi / mở hoàn trả |
| page | feapi | lock · recordReturn · unlock |
| feapi | rest | POST …/lock-return · … |
| rest | idem | executePlatform(PM) |
| idem | svc | lockForReturn · recordReturn · unlockReturn |
| svc | db | review_status + evidence_review |
| phase | Tra cứu SePay |
| page | feapi | lookupById(txn) |
| feapi | rest | POST …/lookup/{transactionId} |
| rest | svc | lookupAndImport(txn) |
| svc | db | lưu chứng từ một lần, tự PAID nếu khớp |

@steps id=f19-uc06-steps
| r6-page | SCR-62 Đối soát | `EvidenceActions` gửi lệnh với khóa và `version` đã xem.[](source:fe-evidence-actions) `SePayLookup` tra theo mã hoặc khoảng ngày tối đa 31 ngày.[](source:fe-lookup) | f19-uc06-seq | page |
| r6-svc | SePayWebhookSvc | `review`: đã phân bổ → `EVIDENCE_ALLOCATED`; đang khóa → `LOCKED_FOR_RETURN`; chiều ra → `OUTGOING`; không có ứng viên → `NO_CANDIDATE`; khác trại → `OTHER_FARM`; tất cả là MSG-FE19-11.[](source:hook-review) | f19-uc06-seq | svc |
| r6-db | Cơ sở dữ liệu | ACCEPT gọi `confirm` như webhook.[](source:hook-confirm) Khóa / ghi / mở hoàn trả chỉ cho chứng từ chiều vào chưa phân bổ; ghi hoàn trả một lần.[](source:hook-return) | f19-uc06-seq | db |
| r6-lookup | PlatformPay REST | `lookupAndImport` dùng mã giao dịch SePay làm khóa; `lookupPeriod` chỉ đọc.[](source:hook-lookup) | f19-uc06-seq | rest |

## UC-07 Công bố bảng giá gọi những hàm nào? {#uc07}

@sequence id=f19-uc07-seq title="UC-FE19-07 Công bố / rút bảng giá"
| actor page | SCR-63 Bảng giá | frontend | source:fe-price-page |
| actor feapi | planPriceApi | frontend | source:fe-price-api |
| actor rest | PlanPrice REST | backend | source:res-price |
| actor idem | Idempotency | security | source:idem-platform |
| actor svc | PlanPriceService | backend | source:svc-price |
| actor access | PlatformAccess | security | source:platform-role |
| actor db | Cơ sở dữ liệu | database |
| phase | Lịch sử |
| page | feapi | list(page) |
| feapi | rest | GET /api/platform/plan-prices |
| rest | svc | history(page, size) |
| svc | access | requireRole(PM) | security |
| svc | feapi | PricePage (current, next) | return |
| phase | Công bố / Rút |
| page | feapi | publish(body, key) · withdraw |
| feapi | rest | POST …/plan-prices · /{v}/withdraw |
| rest | idem | executePlatform(PM) |
| idem | svc | publish · withdraw |
| svc | db | lockPublications() | security |
| svc | db | kiểm giá, thời điểm, trùng lịch |
| svc | db | lưu phiên bản + audit | emphasis |
| svc | feapi | PublishedPrice | return |

@steps id=f19-uc07-steps
| p7-page | SCR-63 Bảng giá | Giữ nội dung khi lỗi; khóa yêu cầu theo dữ liệu; tải lại khi tới mốc hiệu lực.[](source:fe-price-page) | f19-uc07-seq | page |
| p7-svc | PlanPriceService | `publish`: thời điểm quá khứ → MSG-FE19-14; trùng lịch → MSG-FE19-15; giá sai → MSG-FE19-13. `withdraw`: lý do 5–1.000 ký tự, chỉ phiên bản SCHEDULED, đúng `expectedVersion`.[](source:svc-price) | f19-uc07-seq | svc |
| p7-db | Cơ sở dữ liệu | `lockPublications` tuần tự hóa mọi lần công bố / rút, nên hai PM không tạo lịch trùng nhau.[](source:svc-price) | f19-uc07-seq | db |
