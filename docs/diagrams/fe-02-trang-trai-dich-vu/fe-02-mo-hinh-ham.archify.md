# FE-02 – Mô hình hàm theo use case {#fe02-functions}

Mỗi UC của FE-02 đi theo một chuỗi hàm cố định: **trang → hàm API frontend → REST resource → service → kiểm quyền → DB**. Lệnh ghi còn đi qua `IdempotencyCommandService` trước khi vào service.

- Frontend gọi qua `farmWorkspaceApi` (Chủ trại) hoặc `platformServiceApi` (PM); trang giữ `Idempotency-Key` để thử lại không tạo bản ghi thứ hai.[](source:fe-ws-api-register)
- Kiểm quyền trong trại nằm ở `FarmAccessService.require`; kiểm vai trò PM nằm ở `PlatformAccessService.requireRole`.[](source:access-require)
- Cùng khóa, cùng dữ liệu trả lại kết quả cũ; cùng khóa, khác dữ liệu trả MSG-COM-19.[](source:idem-execute)

@answer scope="Code nhánh dev, commit fbbe942 · UC-FE02-01 → 05"
@meta locale=en
@source fe-reg-page title="FarmRegistrationPage.submit" path=frontend/src/features/farm-workspace/pages/FarmRegistrationPage.tsx lines=43:60
@source fe-select-page title="FarmSelectPage.open" path=frontend/src/features/farm-workspace/pages/FarmSelectPage.tsx lines=48:66
@source fe-enter title="enterFarm" path=frontend/src/features/farm-workspace/components/enterFarm.ts lines=13:22
@source fe-info-page title="FarmInformationPage.submit" path=frontend/src/features/farm-workspace/pages/FarmInformationPage.tsx lines=59:76
@source fe-ws-api-list title="farmWorkspaceApi.listFarms / selectFarm" path=frontend/src/features/farm-workspace/api/farmWorkspaceApi.ts lines=176:182
@source fe-ws-api-farm title="farmWorkspaceApi.getFarm" path=frontend/src/features/farm-workspace/api/farmWorkspaceApi.ts lines=183:187
@source fe-ws-api-register title="farmWorkspaceApi.registerFarm" path=frontend/src/features/farm-workspace/api/farmWorkspaceApi.ts lines=188:194
@source fe-ws-api-update title="farmWorkspaceApi.updateFarm" path=frontend/src/features/farm-workspace/api/farmWorkspaceApi.ts lines=195:208
@source fe-pm-routes title="FarmServiceRoutes: listFarms" path=frontend/src/features/platform-service/pages/FarmServiceRoutes.tsx lines=42:42
@source fe-pm-dialog title="ServiceChangeDialog.submit" path=frontend/src/features/platform-service/components/ServiceChangeDialog.tsx lines=38:64
@source fe-pm-api title="platformServiceApi: listFarms / getFarmService / suspendFarm / restoreFarm" path=frontend/src/features/platform-service/api/platformServiceApi.ts lines=121:147
@source res-ws title="FarmWorkspaceResource" path=backend/src/main/java/vn/edu/fpt/beefcare/web/rest/FarmWorkspaceResource.java lines=19:28
@source res-pm title="PlatformFarmResource" path=backend/src/main/java/vn/edu/fpt/beefcare/web/rest/PlatformFarmResource.java lines=27:56
@source idem-execute title="IdempotencyCommandService.execute / executePlatform" path=backend/src/main/java/vn/edu/fpt/beefcare/service/IdempotencyCommandService.java lines=101:121
@source svc-list title="FarmWorkspaceService.list" path=backend/src/main/java/vn/edu/fpt/beefcare/service/FarmWorkspaceService.java lines=31:45
@source svc-register title="FarmWorkspaceService.register" path=backend/src/main/java/vn/edu/fpt/beefcare/service/FarmWorkspaceService.java lines=50:66
@source svc-get-context title="FarmWorkspaceService.get / context" path=backend/src/main/java/vn/edu/fpt/beefcare/service/FarmWorkspaceService.java lines=67:75
@source svc-update title="FarmWorkspaceService.update" path=backend/src/main/java/vn/edu/fpt/beefcare/service/FarmWorkspaceService.java lines=76:103
@source starter-create title="StarterCatalogueService.create" path=backend/src/main/java/vn/edu/fpt/beefcare/service/StarterCatalogueService.java lines=37:76
@source outbox-enqueue title="OutboxService.enqueue" path=backend/src/main/java/vn/edu/fpt/beefcare/service/OutboxService.java lines=43:65
@source access-require title="FarmAccessService.require" path=backend/src/main/java/vn/edu/fpt/beefcare/service/FarmAccessService.java lines=45:71
@source access-current title="FarmAccessService.currentActiveUser" path=backend/src/main/java/vn/edu/fpt/beefcare/service/FarmAccessService.java lines=73:86
@source platform-role title="PlatformAccessService.requireRole" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformAccessService.java lines=24:32
@source pm-overview title="PlatformFarmService.overview" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformFarmService.java lines=61:92
@source pm-preview title="PlatformFarmService.preview" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformFarmService.java lines=94:120
@source pm-change title="PlatformFarmService.suspend / restore" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformFarmService.java lines=121:150
@source pm-notify title="PlatformFarmService.recordAndNotify" path=backend/src/main/java/vn/edu/fpt/beefcare/service/PlatformFarmService.java lines=223:238

## UC-01 Đăng ký trại gọi những hàm nào? {#uc01}

@sequence id=uc01-seq title="UC-FE02-01 Đăng ký trại"
| actor page | SCR-10 Đăng ký | frontend | source:fe-reg-page |
| actor feapi | farmWorkspaceApi | frontend | source:fe-ws-api-register |
| actor rest | Workspace REST | backend | source:res-ws |
| actor idem | Idempotency | security | source:idem-execute |
| actor svc | WorkspaceService | backend | source:svc-register |
| actor access | FarmAccessService | security | source:access-current |
| actor db | Cơ sở dữ liệu | database |
| page | feapi | registerFarm(form, key) |
| feapi | rest | POST /api/farms |
| rest | idem | execute(FARM_REGISTER) |
| idem | svc | register(request) |
| svc | access | currentActiveUser() | security |
| access | svc | AppUser | return |
| svc | db | persist farm + membership OWNER | emphasis |
| svc | db | starters, audit, outbox |
| svc | idem | Details | return |
| idem | rest | Details | return |
| rest | feapi | 201 Created | return |
| feapi | page | FarmDetails | return |

@steps id=uc01-steps
| u1-page | SCR-10 Đăng ký | `submit` kiểm form, giữ `requestKey.keyFor(form)`; thành công thì mở SCR-58 chọn gói.[](source:fe-reg-page) | uc01-seq | page |
| u1-api | farmWorkspaceApi | `registerFarm` chuẩn hóa SĐT, gửi header `Idempotency-Key`.[](source:fe-ws-api-register) | uc01-seq | feapi |
| u1-rest | Workspace REST | `register` bọc lệnh trong `commands.execute`, trả 201 kèm `Location`.[](source:res-ws) | uc01-seq | rest |
| u1-idem | Idempotency | `execute` băm request; cùng khóa trả lại kết quả cũ.[](source:idem-execute) | uc01-seq | idem |
| u1-svc | WorkspaceService | `register`: kiểm đã đăng ký Owner, tỉnh hợp lệ; tạo farm `PENDING_PAYMENT`, membership OWNER.[](source:svc-register) | uc01-seq | svc |
| u1-db | Cơ sở dữ liệu | `StarterCatalogueService.create` tạo tham số và danh mục; `audit.log(FARM_REGISTER)`; `outbox.enqueue(FARM_REGISTERED)`.[](source:starter-create) | uc01-seq | db |

| Lỗi | Hàm ném | Mã |
| --- | --- | --- |
| Tài khoản chưa hoàn tất đăng ký Owner | `FarmWorkspaceService.register` | MSG-FE02-02 |
| Tài khoản bị tạm ngưng | `FarmAccessService.currentActiveUser` | MSG-FE01-03 |
| Tỉnh ngoài danh sách 34 tỉnh | `VietnamProvinces.require` | MSG-COM-10 |
| Cùng khóa, khác dữ liệu | `IdempotencyCommandService` | MSG-COM-19 |

## UC-02 Xem và chọn trại gọi những hàm nào? {#uc02}

@sequence id=uc02-seq title="UC-FE02-02 Xem và chọn trại"
| actor page | SCR-09 Chọn trại | frontend | source:fe-select-page |
| actor feapi | farmWorkspaceApi | frontend | source:fe-ws-api-list |
| actor rest | Workspace REST | backend | source:res-ws |
| actor svc | WorkspaceService | backend | source:svc-list |
| actor access | FarmAccessService | security | source:access-require |
| actor db | Cơ sở dữ liệu | database |
| phase | Danh sách trại |
| page | feapi | listFarms() |
| feapi | rest | GET /api/farms |
| rest | svc | list() |
| svc | access | currentActiveUser() | security |
| svc | db | membership ACTIVE, số bò, latestEnd |
| svc | feapi | List of Summary | return |
| feapi | page | FarmSummary[] | return |
| phase | Vào trại |
| page | feapi | selectFarm(id) |
| feapi | rest | GET /api/farms/{id}/context |
| rest | svc | context(farmId) |
| svc | access | require(SELECT_FARM) | security |
| access | svc | FarmContext | return |
| svc | feapi | Summary | return |
| feapi | page | writeCurrentFarmId, mở trang chủ | return |

@steps id=uc02-steps
| u2-page | SCR-09 Chọn trại | `open` gọi `selectFarm`, rồi `farmAction` chọn đích: SCR-48 / SCR-74, SCR-58 hoặc SCR-65.[](source:fe-select-page) Hàm `enterFarm` dùng lại luồng này sau khi chấp nhận lời mời.[](source:fe-enter) | uc02-seq | page |
| u2-svc | WorkspaceService | `list` lấy membership ACTIVE ở mọi trạng thái dịch vụ; `context` kiểm lại trước khi đặt trại hiện tại.[](source:svc-list) | uc02-seq | svc |
| u2-access | FarmAccessService | `require(SELECT_FARM)`: không có membership ACTIVE → MSG-COM-01; Quản lý / Kỹ thuật viên ở trại không ACTIVE → MSG-FE02-04.[](source:access-require) | uc02-seq | access |

## UC-03 Cập nhật thông tin trại gọi những hàm nào? {#uc03}

@sequence id=uc03-seq title="UC-FE02-03 Cập nhật thông tin trại"
| actor page | SCR-11 Thông tin | frontend | source:fe-info-page |
| actor feapi | farmWorkspaceApi | frontend | source:fe-ws-api-update |
| actor rest | Workspace REST | backend | source:res-ws |
| actor idem | Idempotency | security | source:idem-execute |
| actor svc | WorkspaceService | backend | source:svc-update |
| actor access | FarmAccessService | security | source:access-require |
| actor db | Cơ sở dữ liệu | database |
| phase | Tải form |
| page | feapi | getFarm(id) |
| feapi | rest | GET /{id} + /{id}/context |
| rest | svc | get(farmId) |
| svc | access | require(VIEW_FARM_INFORMATION) | security |
| svc | feapi | Details | return |
| phase | Lưu thay đổi |
| page | feapi | updateFarm(id, form, key) |
| feapi | rest | PUT /api/farms/{id} |
| rest | idem | execute(FARM_UPDATE) |
| idem | svc | update(farmId, request) |
| svc | access | require(MANAGE_FARM_INFORMATION) | security |
| svc | db | lockById, kiểm version, ghi trường | emphasis |
| svc | db | audit FARM_UPDATE, outbox |
| svc | feapi | Details | return |
| feapi | page | tải lại, MSG-FE02-05 | return |

@steps id=uc03-steps
| u3-page | SCR-11 Thông tin | `submit` kiểm form, gửi `expectedVersion` và giữ khóa yêu cầu.[](source:fe-info-page) | uc03-seq | page |
| u3-api | farmWorkspaceApi | `getFarm` gọi song song chi tiết và context; `updateFarm` không gửi giống chính.[](source:fe-ws-api-farm) | uc03-seq | feapi |
| u3-svc | WorkspaceService | `update`: khóa dòng trại, `VersionGuard.requireExpected`, kiểm tỉnh và múi giờ UTC+7, ghi audit `FARM_UPDATE`.[](source:svc-update) | uc03-seq | svc |
| u3-access | FarmAccessService | Chủ trại xem / sửa được ở mọi trạng thái dịch vụ; vai trò khác → MSG-COM-01.[](source:access-require) | uc03-seq | access |

| Lỗi | Hàm ném | Mã |
| --- | --- | --- |
| Không phải Chủ trại | `FarmAccessService.require` | MSG-COM-01 |
| Version cũ | `VersionGuard.requireExpected` | MSG-COM-05 |
| Tỉnh / múi giờ sai | `VietnamProvinces.require`, `FarmTimeZones.require` | MSG-COM-10 |

## UC-04, UC-05 màn PM gọi những hàm nào? {#uc04-05}

@sequence id=uc0405-seq title="UC-FE02-04 Tổng quan + UC-FE02-05 Tạm ngưng / khôi phục"
| actor page | SCR-12 (PM) | frontend | source:fe-pm-dialog |
| actor feapi | platformApi | frontend | source:fe-pm-api |
| actor rest | PlatformFarm REST | backend | source:res-pm |
| actor idem | Idempotency | security | source:idem-execute |
| actor svc | PlatformFarmSvc | backend | source:pm-change |
| actor access | PlatformAccess | security | source:platform-role |
| actor db | Cơ sở dữ liệu | database |
| phase | UC-04 Tổng quan |
| page | feapi | listFarms(filters) |
| feapi | rest | GET /api/platform/farms |
| rest | svc | overview(q, status, sort) |
| svc | access | requireRole(PM) | security |
| svc | db | findAll(filter), tiles() |
| svc | feapi | FarmServicePage | return |
| phase | UC-05 Popup |
| page | feapi | getFarmService(id) |
| feapi | rest | GET /api/platform/farms/{id} |
| rest | svc | preview(farmId) |
| svc | feapi | FarmServicePreview | return |
| phase | UC-05 Xác nhận |
| page | feapi | suspendFarm / restoreFarm |
| feapi | rest | POST …/suspend · …/restore |
| rest | idem | executePlatform(PM) |
| idem | svc | suspend / restore |
| svc | db | lockById, version, service_status | emphasis |
| svc | db | recordAndNotify: audit + thông báo |
| svc | feapi | FarmOverview | return |
| feapi | page | MSG-FE02-08 | return |

@steps id=uc0405-steps
| u4-page | SCR-12 (PM) | `FarmServiceRoutes` gọi `listFarms` (tối đa 100 dòng).[](source:fe-pm-routes) Popup `ServiceChangeDialog.submit` tạo khóa theo dữ liệu, gọi `suspendFarm` hoặc `restoreFarm`.[](source:fe-pm-dialog) | uc0405-seq | page |
| u4-overview | PlatformFarmSvc | `overview` lọc theo tên trại / email Chủ trại, sắp xếp, tính ô đếm trên mọi trại.[](source:pm-overview) `preview` trả kỳ đã mua, lần tạm ngưng cuối, trạng thái sau khôi phục.[](source:pm-preview) | uc0405-seq | svc |
| u4-access | PlatformAccess | `requireRole(PM)`: chỉ PM có quyền nền tảng ACTIVE; CS / SA → MSG-COM-01.[](source:platform-role) | uc0405-seq | access |
| u5-change | Cơ sở dữ liệu | `suspend` / `restore`: khóa dòng, đã ở trạng thái yêu cầu → MSG-FE02-09, kiểm version; khôi phục tính lại từ `latestEnd`.[](source:pm-change) `recordAndNotify` ghi audit và thông báo Chủ trại.[](source:pm-notify) | uc0405-seq | db |

| Lỗi | Hàm ném | Mã |
| --- | --- | --- |
| Không phải PM ACTIVE | `PlatformAccessService.requireRole` | MSG-COM-01 |
| Lý do trống / quá 500 ký tự | `PlatformFarmService.validate` | MSG-COM-06 / 10 |
| Đã ở trạng thái yêu cầu | `PlatformFarmService.alreadyIn` | MSG-FE02-09 |
| Version cũ | `VersionGuard.requireExpected` | MSG-COM-05 |
