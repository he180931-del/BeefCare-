# FE-17 – Mô hình hàm theo use case {#fe17-functions}

FE-17 có **hai đường hàm**: đường ghi (`AuditService.log`, gọi từ mọi lệnh nguồn trong transaction của lệnh) và đường đọc UC-01 (`PlatformAuditQueryService`). `PlatformAuditCatalog` nằm giữa: nó quyết định vai trò được ghi và mã nào được đọc.

- `CorrelationIdFilter` gắn mã truy vết cho mỗi request; `AuditService` đọc lại mã đó khi ghi.[](source:corr-filter)
- `AuditService.log` bắt buộc có transaction đang mở (`Propagation.MANDATORY`).[](source:audit-log)
- Đường đọc chỉ trả mã thuộc danh mục và trường trong allowlist; mục ngoài danh mục trả MSG-COM-08.[](source:svc-detail)

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

## Một lệnh nguồn ghi audit qua những hàm nào? {#write-path}

@sequence id=f17-write-seq title="Ghi audit (hạ tầng chung, ví dụ UC-FE03-06)"
| actor filter | CorrelationIdFilter | security | source:corr-filter |
| actor cmd | Service nguồn | backend | source:source-example |
| actor writer | AuditService | backend | source:audit-log |
| actor db | Cơ sở dữ liệu | database |
| filter | cmd | X-Request-Id → MDC |
| cmd | writer | log(FarmContext, action, target, details) |
| writer | db | Lưu audit với vai trò từ context và correlation_id | emphasis |
| writer | cmd | AuditLog | return |

@steps id=f17-write-steps
| w1-filter | CorrelationIdFilter | Nhận `X-Request-Id` hợp lệ hoặc tạo mới, trả lại trên response, đặt vào MDC cho cả request.[](source:corr-filter) Job dùng mã riêng cho mỗi lượt chạy.[](source:corr-current) | f17-write-seq | filter |
| w1-cmd | Service nguồn | Gọi `audit.log` trong transaction của lệnh, sau khi ghi dữ liệu nghiệp vụ; lý do không đưa vào `details`.[](source:source-example) | f17-write-seq | cmd |
| w1-writer | AuditService | `write` điền `actor_role`, `logged_at`, `details` dạng JSON và `CorrelationId.current()`.[](source:audit-log) | f17-write-seq | writer |
| w1-role | AuditService | Với `FarmContext`, audit dùng vai trò đã kiểm tra trong context. Các overload không có vai trò truyền sẵn dùng `roleOf` theo phạm vi hành động. Actor rỗng là Hệ thống.[](source:audit-log)[](source:audit-role) | f17-write-seq | writer |

## UC-01 SA xem audit gọi những hàm nào? {#uc01}

@sequence id=f17-read-seq title="UC-FE17-01 Xem audit"
| actor page | SCR-51 Audit | frontend | source:fe-audit-list |
| actor hooks | Hook audit | frontend | source:fe-audit-detail |
| actor feapi | Admin API | frontend | source:fe-audit-api |
| actor rest | Audit REST | backend | source:res-audit |
| actor svc | Audit Query | backend | source:svc-search |
| actor access | PlatformAccess | security | source:platform-role |
| actor catalog | AuditCatalog | security | source:catalog |
| actor db | Cơ sở dữ liệu | database |
| phase | Bộ lọc (A3) |
| page | hooks | useAudit tải mã hành động |
| hooks | feapi | listAuditActions() |
| feapi | rest | GET /api/platform/audit/actions |
| rest | svc | actions() |
| svc | access | requireRole(SA) | security |
| svc | catalog | actions() |
| svc | feapi | AuditActionOption[] | return |
| phase | Danh sách (A1) |
| page | hooks | useAudit với bộ lọc hiện tại |
| hooks | feapi | listAudit(filters) |
| feapi | rest | GET /api/platform/audit |
| rest | svc | search(from, to, actor, ...) |
| svc | access | requireRole(SA) | security |
| svc | catalog | select(action, targetType) |
| svc | db | count + rows theo mã đã lưu |
| svc | feapi | AuditPage | return |
| phase | Chi tiết (A2) |
| page | hooks | useAuditDetail(id) |
| hooks | feapi | getAuditEntry(id) |
| feapi | rest | GET /api/platform/audit/{id} |
| rest | svc | get(id) |
| svc | access | requireRole(SA) | security |
| svc | catalog | byStored(action), allowlist | security |
| svc | feapi | AuditDetail | return |

@steps id=f17-read-steps
| r1-page | SCR-51 Audit | `useAudit` tải mã hành động và danh sách theo bộ lọc. Khi mở chi tiết một dòng, `useAuditDetail` gọi `getAuditEntry`.[](source:fe-audit-list)[](source:fe-audit-detail) | f17-read-seq | page |
| r1-svc | Audit Query | `AuditQueryService.search` kiểm SA, `from` / `to` bắt buộc, `from` không sau `to` (MSG-COM-11), tối đa 12 tháng, mã thuộc danh mục và lọc được theo tên, email hoặc Hệ thống.[](source:svc-search) | f17-read-seq | svc |
| r1-catalog | AuditCatalog | Ánh xạ mã đang lưu ↔ mã công khai và loại đích; `select` cho ra tập mã cần lọc.[](source:catalog) | f17-read-seq | catalog |
| r1-detail | Cơ sở dữ liệu | `get` đọc một dòng, mã ngoài danh mục → MSG-COM-08, chỉ trả trường trong allowlist, email che.[](source:svc-detail) | f17-read-seq | db |
