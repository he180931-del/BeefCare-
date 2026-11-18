# FE-03 – Mô hình hàm phía nền tảng (UC-07 → UC-09) {#fe03-platform-functions}

Phía nền tảng của FE-03 dồn vào `PlatformAccountAdministrationService`. Mọi hàm bắt đầu bằng `requireRole(SA)`; lệnh ghi **khóa cả dòng đích và dòng của SA đang thao tác theo thứ tự id** để hai SA không chặn nhau.

- Frontend gọi qua `platformAdminApi`; lệnh ghi gửi `version` và `Idempotency-Key`.[](source:fe-admin-api)
- Tạm ngưng và đổi quyền đều kiểm lại "còn SA ACTIVE khác" ngay trước khi ghi.[](source:svc-sa-left)
- Lý do chỉ lưu ở bảng lịch sử (`app_user_status_change`, `platform_access_change`), không vào audit.[](source:svc-status)

@answer scope="Code nhánh dev, commit fbbe942 · UC-FE03-07 → 09"
@meta locale=en
@source fe-accounts title="AccountsPage: listAccounts / getAccount" path=frontend/src/features/platform-admin/pages/AccountsPage.tsx lines=57:68
@source fe-status-dialog title="AccountStatusDialog.submit" path=frontend/src/features/platform-admin/components/AccountStatusDialog.tsx lines=29:52
@source fe-access-dialog title="AccessDialog: lịch sử, submit" path=frontend/src/features/platform-admin/components/AccessDialog.tsx lines=39:70
@source fe-admin-api title="platformAdminApi: tài khoản và quyền" path=frontend/src/features/platform-admin/api/platformAdminApi.ts lines=258:290
@source res-accounts title="PlatformAccountAdministrationResource" path=backend/src/main/java/vn/edu/fpt/beefcare/web/rest/PlatformAccountAdministrationResource.java lines=81:146
@source idem-platform title="IdempotencyCommandService.executePlatform" path=backend/src/main/java/vn/edu/fpt/beefcare/service/IdempotencyCommandService.java lines=109:121
@source platform-role title="PlatformAccessService.requireRole" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAccessService.java lines=24:32
@source svc-search title="PlatformAccountAdministrationService.search" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAccountAdministrationService.java lines=98:169
@source svc-get title="PlatformAccountAdministrationService.get" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAccountAdministrationService.java lines=171:175
@source svc-status title="PlatformAccountAdministrationService.changeStatus" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAccountAdministrationService.java lines=189:228
@source svc-lock title="PlatformAccountAdministrationService.lockWithActor" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAccountAdministrationService.java lines=230:243
@source svc-reason title="PlatformAccountAdministrationService.validReason" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAccountAdministrationService.java lines=245:252
@source svc-access title="PlatformAccountAdministrationService.changePlatformAccess" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAccountAdministrationService.java lines=254:343
@source svc-history title="PlatformAccountAdministrationService.history" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAccountAdministrationService.java lines=349:358
@source svc-detail title="PlatformAccountAdministrationService.detail" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAccountAdministrationService.java lines=372:457
@source svc-sa-left title="requireAnotherActiveSa / expireSessions" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAccountAdministrationService.java lines=466:479

## UC-07 Xem tài khoản gọi những hàm nào? {#uc07}

@sequence id=f3-uc07-seq title="UC-FE03-07 Xem tài khoản người dùng"
| actor page | SCR-16 Tài khoản | frontend | source:fe-accounts |
| actor feapi | platformAdminApi | frontend | source:fe-admin-api |
| actor rest | Account REST | backend | source:res-accounts |
| actor svc | AccountAdminSvc | backend | source:svc-search |
| actor access | PlatformAccess | security | source:platform-role |
| actor db | Cơ sở dữ liệu | database |
| phase | Danh sách (A9) |
| page | feapi | listAccounts(filters) |
| feapi | rest | GET /api/platform/accounts |
| rest | svc | search(q, status, role, ...) |
| svc | access | requireRole(SA) | security |
| svc | db | lọc, sắp theo tên tiếng Việt |
| svc | feapi | AccountPage | return |
| phase | Chi tiết (A10) và lịch sử (A11) |
| page | feapi | getAccount(id) |
| feapi | rest | GET …/accounts/{id} |
| rest | svc | get(id) → detail() |
| svc | db | quyền, trại tham gia, actions |
| svc | feapi | AccountDetail | return |
| page | feapi | accountHistory(id) |
| feapi | rest | GET …/{id}/history |
| rest | svc | history(id) |
| svc | feapi | tối đa 100 dòng, mới nhất trước | return |

@steps id=f3-uc07-steps
| e1-page | SCR-16 Tài khoản | Không có id trên URL thì chọn dòng đầu; chi tiết chỉ hiện khi khớp id đang chọn.[](source:fe-accounts) | f3-uc07-seq | page |
| e1-svc | AccountAdminSvc | `search` kiểm `q` tối đa 100 ký tự, `status`, `platformRole`, `page`, `size`, `sort=name`, `dir`; sai → MSG-COM-10 kèm tên tham số.[](source:svc-search) | f3-uc07-seq | svc |
| e1-db | Cơ sở dữ liệu | `detail` tính cách đăng nhập, trại tham gia (membership ACTIVE), `actions` và `accessActions`; không trả SĐT.[](source:svc-detail) | f3-uc07-seq | db |

## UC-08 Tạm ngưng / khôi phục tài khoản gọi những hàm nào? {#uc08}

@sequence id=f3-uc08-seq title="UC-FE03-08 Tạm ngưng / khôi phục tài khoản"
| actor page | SCR-16 Tài khoản | frontend | source:fe-status-dialog |
| actor feapi | platformAdminApi | frontend | source:fe-admin-api |
| actor rest | Account REST | backend | source:res-accounts |
| actor idem | Idempotency | security | source:idem-platform |
| actor svc | AccountAdminSvc | backend | source:svc-status |
| actor access | PlatformAccess | security | source:platform-role |
| actor db | Cơ sở dữ liệu | database |
| page | feapi | suspendAccount / restoreAccount |
| feapi | rest | POST …/{id}/suspend · /restore |
| rest | idem | executePlatform(SA) |
| idem | svc | suspend / restore → changeStatus |
| svc | access | requireRole(SA) | security |
| svc | db | lockWithActor (theo thứ tự id) | security |
| svc | db | lý do, chính mình, trạng thái, version |
| svc | db | account_status + status_change + audit | emphasis |
| svc | db | hết hạn phiên, trả phiếu về hàng đợi |
| svc | feapi | AccountDetail | return |
| feapi | page | MSG-FE03-16, tải lại A9 + A10 | return |

@steps id=f3-uc08-steps
| g1-page | SCR-16 Tài khoản | Hộp thoại kiểm lý do, xác nhận MSG-FE03-14 / 15, gửi `{reason, version}` kèm khóa.[](source:fe-status-dialog) | f3-uc08-seq | page |
| g1-svc | AccountAdminSvc | `changeStatus` kiểm theo thứ tự: lý do 5–500 ký tự → tự ngưng mình (MSG-FE03-17) → đã ở trạng thái (MSG-FE03-20) → version (MSG-COM-05) → SA đang thao tác còn ACTIVE → còn SA khác (MSG-FE03-17).[](source:svc-status) | f3-uc08-seq | svc |
| g1-lock | Cơ sở dữ liệu | `lockWithActor` khóa dòng id nhỏ trước, nên hai SA tạm ngưng nhau chạy lần lượt.[](source:svc-lock) Tạm ngưng gọi `expireSessions` và `requeueTicketsOf`.[](source:svc-sa-left) | f3-uc08-seq | db |

## UC-09 Đổi quyền nền tảng gọi những hàm nào? {#uc09}

@sequence id=f3-uc09-seq title="UC-FE03-09 Quyền nhân viên nền tảng"
| actor page | Popup Quyền | frontend | source:fe-access-dialog |
| actor feapi | platformAdminApi | frontend | source:fe-admin-api |
| actor rest | Account REST | backend | source:res-accounts |
| actor idem | Idempotency | security | source:idem-platform |
| actor svc | AccountAdminSvc | backend | source:svc-access |
| actor access | PlatformAccess | security | source:platform-role |
| actor db | Cơ sở dữ liệu | database |
| page | feapi | changePlatformAccess(id, cmd, key) |
| feapi | rest | POST …/{id}/platform-access |
| rest | idem | executePlatform(SA) |
| idem | svc | changePlatformAccess(...) |
| svc | access | requireRole(SA) | security |
| svc | db | lockWithActor, findOneByUserIdForUpdate | security |
| svc | db | kiểm thao tác, trạng thái, version |
| svc | db | staff_access + access_change + audit | emphasis |
| svc | db | CS mất quyền → requeueTicketsOf |
| svc | feapi | AccountDetail | return |
| feapi | page | MSG-FE03-19, tải lại | return |

@steps id=f3-uc09-steps
| h1-page | Popup Quyền | Mở popup tải lịch sử A11; `submit` gửi `{operation, role, reason, version}` theo `accessActions`.[](source:fe-access-dialog) | f3-uc09-seq | page |
| h1-svc | AccountAdminSvc | `changePlatformAccess` kiểm theo thứ tự trong bảng dưới; lệnh bị từ chối không ghi gì.[](source:svc-access) | f3-uc09-seq | svc |
| h1-db | Cơ sở dữ liệu | Lưu quyền, một dòng `platform_access_change`, audit `PLATFORM_ACCESS_*` trước / sau. CS mất quyền CS thì phiếu chưa đóng về hàng đợi.[](source:svc-access) | f3-uc09-seq | db |

| Thứ tự kiểm | Điều kiện | Mã |
| --- | --- | --- |
| 1 | Không phải SA ACTIVE | MSG-COM-01 |
| 2 | Tài khoản không tồn tại | MSG-COM-08 |
| 3 | Thiếu / sai `operation`, `role`, lý do | MSG-COM-06 / 10 |
| 4 | Đổi quyền của chính mình | MSG-COM-01 |
| 5 | Tài khoản SUSPENDED, không phải Thu hồi | MSG-FE03-22 |
| 6 | Email chưa xác minh, không phải Thu hồi | MSG-FE03-18 |
| 7 | Giá trị đã có hiệu lực / quyền đã đổi | MSG-FE03-20 / MSG-COM-05 |
| 8 | Version cũ | MSG-COM-05 |
| 9 | SA đang thao tác không còn ACTIVE | MSG-COM-01 |
| 10 | SA mất quyền mà không còn SA ACTIVE khác | MSG-FE03-17 |
