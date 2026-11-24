# FE-03 – Mô hình hàm phía nền tảng (UC-07 → UC-09) {#fe03-platform-functions}

Phần này cho thấy cách Quản trị hệ thống (SA) xem tài khoản, tạm ngưng hoặc khôi phục tài khoản, và thay đổi quyền nền tảng.

- Đọc các mũi tên từ trên xuống. Rê chuột lên ô hoặc số nguồn để xem hàm và đoạn code tương ứng.
- Khi một thao tác làm mất quyền của một SA đang hoạt động, hệ thống kiểm tra vẫn còn SA khác.[](source:svc-status)[](source:svc-access)
- Lý do thay đổi được lưu trong lịch sử tài khoản hoặc lịch sử quyền. Nhật ký hệ thống ghi nhận thao tác và giá trị trước, sau.[](source:svc-status)[](source:svc-access)

@answer scope="Code dev 703f90e0 · UC-FE03-07 → 09"
@meta locale=en repo_url=https://github.com/he180931-del/BeefCare-.git repo_revision=703f90e0ccdaa7c995525ce7e821d59c14829821
@source fe-accounts title="useAccounts: danh sách và chi tiết tài khoản" path=frontend/src/features/platform-admin/hooks/useAccounts.ts lines=9:31
@source fe-status-dialog title="AccountStatusDialog.submit" path=frontend/src/features/platform-admin/components/AccountStatusDialog.tsx lines=26:47
@source fe-access-dialog title="AccessDialog: lịch sử, submit" path=frontend/src/features/platform-admin/components/AccessDialog.tsx lines=35:60
@source fe-admin-api title="platformAdminApi: tài khoản và quyền" path=frontend/src/features/platform-admin/api/platformAdminApi.ts lines=261:292
@source fe-staff title="useStaffAccess: lịch sử và lệnh thay đổi" path=frontend/src/features/platform-admin/hooks/useStaffAccess.ts lines=11:25
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

## UC-07 Màn tài khoản lấy danh sách, chi tiết và lịch sử ở đâu? {#uc07}

@sequence id=f3-uc07-seq title="UC-FE03-07 Xem tài khoản người dùng"
| actor page | Màn tài khoản | frontend | source:fe-accounts |
| actor feapi | Gửi từ web | frontend | source:fe-admin-api |
| actor rest | API tài khoản | backend | source:res-accounts |
| actor svc | Xử lý tài khoản | backend | source:svc-search |
| actor access | Kiểm quyền SA | security | source:platform-role |
| actor db | Cơ sở dữ liệu | database |
| phase | Xem danh sách tài khoản |
| page | feapi | Lấy danh sách theo bộ lọc |
| feapi | rest | Yêu cầu danh sách tài khoản |
| rest | svc | Tìm tài khoản theo tiêu chí |
| svc | access | Kiểm quyền Quản trị hệ thống |
| svc | db | Lọc và sắp theo tên |
| svc | feapi | Trả một trang kết quả | return |
| phase | Xem chi tiết và lịch sử |
| page | feapi | Chọn tài khoản cần xem |
| feapi | rest | Yêu cầu chi tiết theo mã |
| rest | svc | Lấy chi tiết tài khoản |
| svc | db | Đọc quyền, trại tham gia và thao tác |
| svc | feapi | Trả chi tiết tài khoản | return |
| page | feapi | Mở lịch sử tài khoản |
| feapi | rest | Yêu cầu lịch sử |
| rest | svc | Tìm các thay đổi đã lưu |
| svc | feapi | Trả tối đa 100 mục gần nhất | return |

@steps id=f3-uc07-steps
| e1-page | Màn tài khoản | `useAccounts` tải danh sách qua `listAccounts` và chi tiết qua `getAccount`. Nếu URL chưa chọn tài khoản, màn hình chọn dòng đầu. `useStaffAccess` gọi `accountHistory` khi cần xem lịch sử.[](source:fe-accounts)[](source:fe-staff) | f3-uc07-seq | page |
| e1-svc | Xử lý tài khoản | `PlatformAccountAdministrationService.search` kiểm bộ lọc, từ khóa tối đa 100 ký tự và thông tin phân trang. Nếu tham số sai, `MSG-COM-10` cho biết trường cần sửa.[](source:svc-search) | f3-uc07-seq | svc |
| e1-db | Cơ sở dữ liệu | `detail` tập hợp cách đăng nhập, các trại mà tài khoản còn tham gia và các thao tác được phép. Dữ liệu trả về cho màn này gồm quyền tài khoản và tư cách thành viên, theo các trường trong `AccountDetail`.[](source:svc-detail) | f3-uc07-seq | db |

## UC-08 Hệ thống tạm ngưng và khôi phục tài khoản thế nào? {#uc08}

@sequence id=f3-uc08-seq title="UC-FE03-08 Tạm ngưng / khôi phục tài khoản"
| actor page | Màn tài khoản | frontend | source:fe-status-dialog |
| actor feapi | Gửi từ web | frontend | source:fe-admin-api |
| actor rest | API tài khoản | backend | source:res-accounts |
| actor idem | Chống ghi trùng | security | source:idem-platform |
| actor svc | Xử lý tài khoản | backend | source:svc-status |
| actor access | Kiểm quyền SA | security | source:platform-role |
| actor db | Cơ sở dữ liệu | database |
| page | feapi | Gửi thao tác và lý do |
| feapi | rest | Yêu cầu tạm ngưng hoặc khôi phục |
| rest | idem | Kiểm quyền SA và mã lần gửi |
| idem | svc | Xử lý đổi trạng thái tài khoản |
| svc | access | Kiểm quyền Quản trị hệ thống |
| svc | db | Tạm ngưng: khóa hai tài khoản |
| svc | db | Khôi phục: khóa tài khoản đích |
| svc | db | Kiểm lý do, trạng thái và dữ liệu đã mở |
| svc | db | Lưu trạng thái và ghi nhật ký | emphasis |
| svc | db | Tạm ngưng: kết thúc phiên, trả phiếu hỗ trợ |
| svc | feapi | Trả tài khoản sau thay đổi | return |
| feapi | page | Báo kết quả và tải lại | return |

@steps id=f3-uc08-steps
| g1-page | Màn tài khoản | Hộp thoại kiểm lý do rồi yêu cầu xác nhận. `useStaffAccess` gọi `suspendAccount` hoặc `restoreAccount` với lý do, phiên bản đã xem (`version`) và mã lần gửi.[](source:fe-status-dialog)[](source:fe-staff) | f3-uc08-seq | page |
| g1-svc | Xử lý tài khoản | `changeStatus` kiểm lý do, trạng thái và phiên bản. Khi tạm ngưng, service chặn tự tạm ngưng và kiểm lại quyền người thao tác. Nếu đích là SA đang hoạt động, hệ thống yêu cầu còn SA khác.[](source:svc-status) | f3-uc08-seq | svc |
| g1-lock | Cơ sở dữ liệu | Tạm ngưng dùng `lockWithActor` để giữ cả tài khoản đích và tài khoản thao tác trong lúc lưu. Sau đó hệ thống kết thúc phiên và trả phiếu hỗ trợ về hàng đợi. Khôi phục dùng `loadForUpdate` để giữ bản ghi tài khoản đích.[](source:svc-lock)[](source:svc-status) | f3-uc08-seq | db |

## UC-09 Hệ thống cấp, đổi và thu hồi quyền nền tảng ra sao? {#uc09}

@sequence id=f3-uc09-seq title="UC-FE03-09 Quyền nhân viên nền tảng"
| actor page | Hộp đổi quyền | frontend | source:fe-access-dialog |
| actor feapi | Gửi từ web | frontend | source:fe-admin-api |
| actor rest | API tài khoản | backend | source:res-accounts |
| actor idem | Chống ghi trùng | security | source:idem-platform |
| actor svc | Xử lý quyền | backend | source:svc-access |
| actor access | Kiểm quyền SA | security | source:platform-role |
| actor db | Cơ sở dữ liệu | database |
| page | feapi | Gửi quyền và lý do |
| feapi | rest | Yêu cầu thay đổi quyền |
| rest | idem | Kiểm quyền SA và mã lần gửi |
| idem | svc | Xử lý quyền của tài khoản đích |
| svc | access | Kiểm quyền Quản trị hệ thống |
| svc | db | Khóa tài khoản và quyền đang sửa |
| svc | db | Kiểm lựa chọn, trạng thái và dữ liệu đã mở |
| svc | db | Lưu quyền, lịch sử và nhật ký | emphasis |
| svc | db | Mất quyền hỗ trợ: trả phiếu về hàng đợi |
| svc | feapi | Trả chi tiết quyền mới | return |
| feapi | page | Báo thành công và tải lại | return |

@steps id=f3-uc09-steps
| h1-page | Hộp đổi quyền | Hộp đổi quyền tải lịch sử và các thao tác được phép. Khi xác nhận, `useStaffAccess.changePlatformAccess` gửi quyền được chọn, thao tác, lý do và phiên bản đang xem.[](source:fe-access-dialog)[](source:fe-staff) | f3-uc09-seq | page |
| h1-svc | Xử lý quyền | `changePlatformAccess` kiểm quyền SA, tài khoản đích và dữ liệu gửi lên theo thứ tự trong bảng bên dưới. Đổi quyền chỉ được lưu khi qua hết các bước kiểm.[](source:svc-access) | f3-uc09-seq | svc |
| h1-db | Cơ sở dữ liệu | Hệ thống lưu quyền mới, ghi lịch sử vào `platform_access_change` và ghi nhật ký `PLATFORM_ACCESS_*` với giá trị trước và sau. Khi nhân viên mất quyền Hỗ trợ khách hàng, các phiếu chưa đóng được đưa về hàng đợi.[](source:svc-access) | f3-uc09-seq | db |

| Thứ tự kiểm | Điều kiện | Mã |
| --- | --- | --- |
| 1 | Không phải SA ACTIVE | MSG-COM-01 |
| 2 | Tài khoản không tồn tại | MSG-COM-08 |
| 3 | Thiếu hoặc sai thao tác, vai trò hay lý do | MSG-COM-06 / 10 |
| 4 | Đổi quyền của chính mình | MSG-COM-01 |
| 5 | Thao tác khác Thu hồi trên tài khoản đang tạm ngưng | MSG-FE03-22 |
| 6 | Email chưa xác minh, không phải Thu hồi | MSG-FE03-18 |
| 7 | Giá trị đã có hiệu lực / quyền đã đổi | MSG-FE03-20 / MSG-COM-05 |
| 8 | Dữ liệu đã thay đổi sau khi hộp thoại mở | MSG-COM-05 |
| 9 | SA đang thao tác không còn ACTIVE | MSG-COM-01 |
| 10 | Thu hồi hoặc đổi sang vai trò khác làm mất một SA ACTIVE và không còn SA ACTIVE khác | MSG-FE03-17 |
