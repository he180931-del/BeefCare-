# FE-17 – Mô hình hàm theo use case {#fe17-functions}

FE-17 có **hai đường hàm**: đường ghi (`AuditService.log`, gọi từ mọi lệnh nguồn trong transaction của lệnh) và đường đọc UC-01 (`PlatformAuditQueryService`). `PlatformAuditCatalog` nằm giữa: nó quyết định vai trò được ghi và mã nào được đọc.

- `CorrelationIdFilter` gắn mã truy vết cho mỗi request; `AuditService` đọc lại mã đó khi ghi.[](source:corr-filter)
- `AuditService.log` bắt buộc có transaction đang mở (`Propagation.MANDATORY`).[](source:audit-log)
- Đường đọc chỉ trả mã thuộc danh mục và trường trong allowlist; mục ngoài danh mục trả MSG-COM-08.[](source:svc-detail)

@answer scope="Code nhánh dev, commit fbbe942 · UC-FE17-01 + hạ tầng ghi audit"
@meta locale=en
@source corr-filter title="CorrelationIdFilter.doFilterInternal" path=backend/src/main/java/vn/edu/fpt/beefcare/web/filter/CorrelationIdFilter.java lines=23:34
@source corr-current title="CorrelationId.current" path=backend/src/main/java/vn/edu/fpt/beefcare/service/CorrelationId.java lines=11:53
@source audit-log title="AuditService.log / logAt / logAndFlush" path=backend/src/main/java/vn/edu/fpt/beefcare/service/AuditService.java lines=49:94
@source audit-role title="AuditService.roleOf" path=backend/src/main/java/vn/edu/fpt/beefcare/service/AuditService.java lines=96:108
@source catalog title="PlatformAuditCatalog: byCode / byStored / scopeOf / select" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAuditCatalog.java lines=90:143
@source source-example title="Ví dụ lệnh nguồn: FarmMembershipService.changeMember" path=backend/src/main/java/vn/edu/fpt/beefcare/service/FarmMembershipService.java lines=341:346
@source fe-audit-list title="AuditPage: listAuditActions / listAudit" path=frontend/src/features/platform-admin/pages/AuditPage.tsx lines=137:145
@source fe-audit-detail title="AuditPage: getAuditEntry" path=frontend/src/features/platform-admin/pages/AuditPage.tsx lines=48:48
@source fe-audit-api title="platformAdminApi: listAudit / getAuditEntry / listAuditActions" path=frontend/src/features/platform-admin/api/platformAdminApi.ts lines=290:306
@source res-audit title="PlatformAuditResource" path=backend/src/main/java/vn/edu/fpt/beefcare/web/rest/PlatformAuditResource.java lines=53:82
@source platform-role title="PlatformAccessService.requireRole" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAccessService.java lines=24:32
@source svc-search title="PlatformAuditQueryService.search" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAuditQueryService.java lines=55:114
@source svc-detail title="PlatformAuditQueryService.get" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAuditQueryService.java lines=116:146
@source svc-actions title="PlatformAuditQueryService.actions" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAuditQueryService.java lines=147:150

## Một lệnh nguồn ghi audit qua những hàm nào? {#write-path}

@sequence id=f17-write-seq title="Ghi audit (hạ tầng chung, ví dụ UC-FE03-06)"
| actor filter | CorrelationIdFilter | security | source:corr-filter |
| actor cmd | Service nguồn | backend | source:source-example |
| actor writer | AuditService | backend | source:audit-log |
| actor catalog | AuditCatalog | security | source:catalog |
| actor db | Cơ sở dữ liệu | database |
| filter | cmd | X-Request-Id → MDC |
| cmd | writer | log(farm, actor, action, target, details) |
| writer | catalog | scopeOf(action) |
| catalog | writer | PLATFORM / FARM | return |
| writer | db | roleOf: staff_access / membership | security |
| writer | db | save AuditLog + correlation_id | emphasis |
| writer | cmd | AuditLog | return |

@steps id=f17-write-steps
| w1-filter | CorrelationIdFilter | Nhận `X-Request-Id` hợp lệ hoặc tạo mới, trả lại trên response, đặt vào MDC cho cả request.[](source:corr-filter) Job dùng mã riêng cho mỗi lượt chạy.[](source:corr-current) | f17-write-seq | filter |
| w1-cmd | Service nguồn | Gọi `audit.log` trong transaction của lệnh, sau khi ghi dữ liệu nghiệp vụ; lý do không đưa vào `details`.[](source:source-example) | f17-write-seq | cmd |
| w1-writer | AuditService | `write` điền `actor_role`, `logged_at`, `details` dạng JSON và `CorrelationId.current()`.[](source:audit-log) | f17-write-seq | writer |
| w1-role | Cơ sở dữ liệu | `roleOf`: hành động nền tảng lấy vai trò nền tảng trước, hành động trong trại lấy vai trò membership trước; actor rỗng là "Hệ thống".[](source:audit-role) | f17-write-seq | db |

## UC-01 SA xem audit gọi những hàm nào? {#uc01}

@sequence id=f17-read-seq title="UC-FE17-01 Xem audit"
| actor page | SCR-51 Audit | frontend | source:fe-audit-list |
| actor feapi | platformAdminApi | frontend | source:fe-audit-api |
| actor rest | Audit REST | backend | source:res-audit |
| actor svc | AuditQueryService | backend | source:svc-search |
| actor access | PlatformAccess | security | source:platform-role |
| actor catalog | AuditCatalog | security | source:catalog |
| actor db | Cơ sở dữ liệu | database |
| phase | Bộ lọc (A3) |
| page | feapi | listAuditActions() |
| feapi | rest | GET /api/platform/audit/actions |
| rest | svc | actions() |
| svc | catalog | actions() |
| svc | feapi | AuditActionOption[] | return |
| phase | Danh sách (A1) |
| page | feapi | listAudit(filters) |
| feapi | rest | GET /api/platform/audit |
| rest | svc | search(from, to, actor, ...) |
| svc | access | requireRole(SA) | security |
| svc | catalog | select(action, targetType) |
| svc | db | count + rows theo mã đã lưu |
| svc | feapi | AuditPage | return |
| phase | Chi tiết (A2) |
| page | feapi | getAuditEntry(id) |
| feapi | rest | GET /api/platform/audit/{id} |
| rest | svc | get(id) |
| svc | catalog | byStored(action), allowlist | security |
| svc | feapi | AuditDetail | return |

@steps id=f17-read-steps
| r1-page | SCR-51 Audit | Tải danh sách mã một lần; mỗi lần đổi bộ lọc gọi `listAudit`; chọn dòng gọi `getAuditEntry`.[](source:fe-audit-list) | f17-read-seq | page |
| r1-svc | AuditQueryService | `search` kiểm SA, `from` / `to` bắt buộc, `from` không sau `to` (MSG-COM-11), tối đa 12 tháng, mã thuộc danh mục; tìm theo tên / email hoặc chỉ "Hệ thống".[](source:svc-search) | f17-read-seq | svc |
| r1-catalog | AuditCatalog | Ánh xạ mã đang lưu ↔ mã công khai và loại đích; `select` cho ra tập mã cần lọc.[](source:catalog) | f17-read-seq | catalog |
| r1-detail | Cơ sở dữ liệu | `get` đọc một dòng, mã ngoài danh mục → MSG-COM-08, chỉ trả trường trong allowlist, email che.[](source:svc-detail) | f17-read-seq | db |
