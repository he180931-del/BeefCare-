# FE-17 – Mô hình hàm theo use case {#fe17-functions}

Khi một thao tác thay đổi dữ liệu, hệ thống ghi lại ai đã làm gì và lúc nào. Quản trị hệ thống (SA) xem những bản ghi được phép trên màn Nhật ký.

- Đọc các mũi tên từ trên xuống. Rê chuột lên ô hoặc số nguồn để xem hàm và đoạn code tương ứng.
- Mã truy vết nối yêu cầu với dòng nhật ký, giúp tìm lại cùng một lần xử lý khi cần kiểm tra.[](source:corr-filter)[](source:audit-log)

@answer scope="Code dev 703f90e0 · UC-FE17-01 và hạ tầng ghi audit"
@meta locale=en repo_url=https://github.com/he180931-del/BeefCare-.git repo_revision=703f90e0ccdaa7c995525ce7e821d59c14829821
@source corr-filter title="CorrelationIdFilter.doFilterInternal" path=backend/src/main/java/vn/edu/fpt/beefcare/web/filter/CorrelationIdFilter.java lines=23:34
@source corr-current title="CorrelationId.current" path=backend/src/main/java/vn/edu/fpt/beefcare/service/CorrelationId.java lines=11:53
@source audit-log title="AuditService.log / logAt / logAndFlush" path=backend/src/main/java/vn/edu/fpt/beefcare/service/AuditService.java lines=49:94
@source audit-role title="AuditService.roleOf" path=backend/src/main/java/vn/edu/fpt/beefcare/service/AuditService.java lines=96:108
@source catalog title="PlatformAuditCatalog: byCode / byStored / scopeOf / select" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAuditCatalog.java lines=90:143
@source source-example title="Ví dụ lệnh nguồn: FarmMembershipService.changeMember" path=backend/src/main/java/vn/edu/fpt/beefcare/service/FarmMembershipService.java lines=341:346
@source fe-audit-list title="useAudit: listAuditActions / listAudit" path=frontend/src/features/platform-admin/hooks/useAudit.ts lines=18:30
@source fe-audit-detail title="useAuditDetail: getAuditEntry" path=frontend/src/features/platform-admin/hooks/useAudit.ts lines=40:42
@source fe-audit-api title="platformAdminApi: listAudit / getAuditEntry / listAuditActions" path=frontend/src/features/platform-admin/api/platformAdminApi.ts lines=293:309
@source res-audit title="PlatformAuditResource" path=backend/src/main/java/vn/edu/fpt/beefcare/web/rest/PlatformAuditResource.java lines=53:82
@source platform-role title="PlatformAccessService.requireRole" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAccessService.java lines=24:32
@source svc-search title="PlatformAuditQueryService.search" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAuditQueryService.java lines=55:114
@source svc-detail title="PlatformAuditQueryService.get" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAuditQueryService.java lines=116:146
@source svc-actions title="PlatformAuditQueryService.actions" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAuditQueryService.java lines=147:150

## Khi có thay đổi dữ liệu, hệ thống ghi nhật ký thế nào? {#write-path}

@sequence id=f17-write-seq title="Ghi audit (hạ tầng chung, ví dụ UC-FE03-06)"
| actor filter | Mã truy vết | security | source:corr-filter |
| actor cmd | Xử lý thao tác | backend | source:source-example |
| actor writer | Ghi nhật ký | backend | source:audit-log |
| actor db | Cơ sở dữ liệu | database |
| filter | cmd | Gắn mã truy vết cho yêu cầu |
| cmd | writer | Gửi ai đã làm gì và với đối tượng nào |
| writer | db | Lưu vai trò, thời gian và mã truy vết | emphasis |
| writer | cmd | Trả bản ghi nhật ký | return |

@steps id=f17-write-steps
| w1-filter | Mã truy vết | `CorrelationIdFilter` nhận hoặc tạo mã `X-Request-Id` cho lần gửi này, rồi đặt vào nơi dùng chung trong lúc xử lý (`MDC`). Job định kỳ có mã riêng cho từng lượt chạy.[](source:corr-filter)[](source:corr-current) | f17-write-seq | filter |
| w1-cmd | Xử lý thao tác | Sau khi thay đổi dữ liệu, hàm nghiệp vụ gọi `audit.log` trong cùng giao dịch. Nếu thao tác bị hủy khi lưu, dòng nhật ký đi cùng cũng bị hủy.[](source:source-example)[](source:audit-log) | f17-write-seq | cmd |
| w1-writer | Ghi nhật ký | `AuditService.write` lưu giờ thao tác (`logged_at`), vai trò (`actor_role`), chi tiết thay đổi (`details`) và mã truy vết.[](source:audit-log) | f17-write-seq | writer |
| w1-role | Ghi nhật ký | Nếu hàm nhận thông tin trại kèm vai trò đã kiểm tra (`FarmContext`), nhật ký dùng vai trò đó. Các đường gọi khác dùng `roleOf` để tìm vai trò theo phạm vi. Bản ghi do hệ thống tự chạy hiện là Hệ thống.[](source:audit-log)[](source:audit-role) | f17-write-seq | writer |

## UC-01 Quản trị hệ thống xem nhật ký như thế nào? {#uc01}

@sequence id=f17-read-seq title="UC-FE17-01 Xem audit"
| actor page | Màn nhật ký | frontend | source:fe-audit-list |
| actor hooks | Tải dữ liệu | frontend | source:fe-audit-detail |
| actor feapi | Gửi từ web | frontend | source:fe-audit-api |
| actor rest | API nhật ký | backend | source:res-audit |
| actor svc | Xử lý nhật ký | backend | source:svc-search |
| actor access | Kiểm quyền SA | security | source:platform-role |
| actor catalog | Danh mục mã | security | source:catalog |
| actor db | Cơ sở dữ liệu | database |
| phase | Nạp lựa chọn cho bộ lọc |
| page | hooks | Mở màn Nhật ký |
| hooks | feapi | Lấy loại thao tác được phép |
| feapi | rest | Yêu cầu danh mục bộ lọc |
| rest | svc | Đọc loại thao tác |
| svc | access | Kiểm quyền Quản trị hệ thống |
| svc | catalog | Lấy danh mục dùng trên màn hình |
| svc | feapi | Trả lựa chọn lọc | return |
| phase | Xem danh sách nhật ký |
| page | hooks | Áp dụng bộ lọc |
| hooks | feapi | Gửi tiêu chí tìm kiếm |
| feapi | rest | Yêu cầu danh sách nhật ký |
| rest | svc | Tìm theo ngày và người thực hiện |
| svc | access | Kiểm quyền Quản trị hệ thống |
| svc | catalog | Đổi lựa chọn thành mã lưu trữ |
| svc | db | Đếm và lấy các dòng khớp |
| svc | feapi | Trả một trang nhật ký | return |
| phase | Xem chi tiết một mục |
| page | hooks | Chọn một dòng |
| hooks | feapi | Gửi mã bản ghi |
| feapi | rest | Yêu cầu chi tiết nhật ký |
| rest | svc | Lấy bản ghi theo mã |
| svc | access | Kiểm quyền Quản trị hệ thống |
| svc | catalog | Chọn các trường được xem |
| svc | feapi | Trả chi tiết nhật ký | return |

@steps id=f17-read-steps
| r1-page | Màn nhật ký | `useAudit` lấy lựa chọn lọc bằng `listAuditActions` và tải danh sách bằng `listAudit`. Khi mở chi tiết, `useAuditDetail` gọi `getAuditEntry`.[](source:fe-audit-list)[](source:fe-audit-detail) | f17-read-seq | page |
| r1-svc | Xử lý nhật ký | `search` kiểm quyền SA và khoảng ngày bắt đầu đến kết thúc, tối đa 12 tháng. Nếu ngày bắt đầu sau ngày kết thúc thì báo `MSG-COM-11`. Người xem có thể tìm theo tên, email hoặc các thao tác do hệ thống thực hiện.[](source:svc-search) | f17-read-seq | svc |
| r1-catalog | Danh mục mã | `PlatformAuditCatalog` nối tên thao tác trên màn hình với mã đã lưu. Hàm `select` lấy các mã phù hợp với hành động và loại đối tượng đang lọc.[](source:catalog) | f17-read-seq | catalog |
| r1-detail | Cơ sở dữ liệu | `get` đọc một dòng nhật ký và chỉ trả các trường được phép xem. Email được che. Bản ghi có mã ngoài danh mục trả `MSG-COM-08`.[](source:svc-detail) | f17-read-seq | db |
