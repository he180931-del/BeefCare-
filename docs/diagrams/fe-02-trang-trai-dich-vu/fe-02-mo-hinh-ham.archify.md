# FE-02 – Mô hình hàm theo use case {#fe02-functions}

Các sơ đồ chỉ đường từ thao tác trên màn hình đến kết quả lưu trong hệ thống. Bạn có thể xem cách đăng ký, vào trại, sửa thông tin hoặc đổi trạng thái dịch vụ.

- Đọc các mũi tên từ trên xuống. Rê chuột lên ô hoặc số nguồn để xem hàm và đoạn code tương ứng.
- Ô Chống ghi trùng kiểm tra mã lần gửi. Gửi lại cùng mã và dữ liệu sẽ nhận kết quả đã lưu nếu lần trước đã thành công.[](source:idem-execute)

@answer scope="Code dev 703f90e0 · UC-FE02-01 → 05 · D54, D56"
@meta locale=en repo_url=https://github.com/he180931-del/BeefCare-.git repo_revision=703f90e0ccdaa7c995525ce7e821d59c14829821
@source fe-reg-page title="useFarmRegistration.submit" path=frontend/src/features/farm-workspace/hooks/useFarmRegistration.ts lines=11:20
@source fe-select-page title="useFarmSelect.open" path=frontend/src/features/farm-workspace/hooks/useFarmSelect.ts lines=12:16
@source fe-enter title="enterFarm" path=frontend/src/features/farm-workspace/components/enterFarm.ts lines=14:28
@source fe-info-page title="useFarmInformationForm.submit" path=frontend/src/features/farm-workspace/hooks/useFarmInformationForm.ts lines=23:40
@source fe-return title="RequireFarm: lưu mục cần quay lại" path=frontend/src/app/routes/RequireFarm.tsx lines=12:22
@source fe-switch title="FarmPlatformLayout.switchFarm" path=frontend/src/app/layouts/FarmPlatformLayout.tsx lines=109:121
@source fe-ws-api-list title="farmWorkspaceApi.listFarms / selectFarm" path=frontend/src/features/farm-workspace/api/farmWorkspaceApi.ts lines=181:187
@source fe-ws-api-farm title="farmWorkspaceApi.getFarm" path=frontend/src/features/farm-workspace/api/farmWorkspaceApi.ts lines=188:192
@source fe-ws-api-register title="farmWorkspaceApi.registerFarm" path=frontend/src/features/farm-workspace/api/farmWorkspaceApi.ts lines=193:199
@source fe-ws-api-update title="farmWorkspaceApi.updateFarm" path=frontend/src/features/farm-workspace/api/farmWorkspaceApi.ts lines=200:213
@source fe-pm-routes title="FarmServiceRoutes: lọc và phân trang" path=frontend/src/features/platform-service/pages/FarmServiceRoutes.tsx lines=29:47
@source fe-pm-dialog title="ServiceChangeDialog.submit" path=frontend/src/features/platform-service/components/ServiceChangeDialog.tsx lines=35:66
@source fe-pm-api title="platformServiceApi: listFarms / getFarmService / suspendFarm / restoreFarm" path=frontend/src/features/platform-service/api/platformServiceApi.ts lines=126:161
@source fe-pm-hooks title="useFarmList / useFarmServicePreview" path=frontend/src/features/platform-service/hooks/usePlatformServiceUseCase.ts lines=10:16
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

## UC-01 Khi bấm Tạo trại, hệ thống làm gì? {#uc01}

@sequence id=uc01-seq title="UC-FE02-01 Đăng ký trại"
| actor page | Màn đăng ký | frontend | source:fe-reg-page |
| actor feapi | Gửi từ web | frontend | source:fe-ws-api-register |
| actor rest | API trang trại | backend | source:res-ws |
| actor idem | Chống ghi trùng | security | source:idem-execute |
| actor svc | Xử lý đăng ký | backend | source:svc-register |
| actor access | Kiểm tài khoản | security | source:access-current |
| actor db | Cơ sở dữ liệu | database |
| page | feapi | Gửi thông tin trại và mã lần gửi |
| feapi | rest | Gửi yêu cầu tạo trại |
| rest | idem | Kiểm tra yêu cầu có bị gửi lại |
| idem | svc | Chạy lệnh tạo trại mới |
| svc | access | Lấy tài khoản đang đăng nhập |
| access | svc | Trả tài khoản đang hoạt động | return |
| svc | db | Lưu trại và gán Chủ trại | emphasis |
| svc | db | Tạo dữ liệu mặc định, ghi nhật ký và sự kiện |
| svc | idem | Trả thông tin trại vừa tạo | return |
| idem | rest | Chuyển kết quả tạo trại | return |
| rest | feapi | Báo tạo trại thành công | return |
| feapi | page | Nhận thông tin trại để chọn gói | return |

@steps id=uc01-steps
| u1-page | Màn đăng ký | Khi bấm Tạo trang trại, màn hình kiểm tra biểu mẫu. `useFarmRegistration.submit` gọi `registerFarm` với thông tin trại và mã lần gửi.[](source:fe-reg-page) | uc01-seq | page |
| u1-api | Gửi từ web | Frontend chuẩn hóa số điện thoại rồi gửi yêu cầu. Hàm `farmWorkspaceApi.registerFarm` gọi `POST /api/farms` với `Idempotency-Key`.[](source:fe-ws-api-register) | uc01-seq | feapi |
| u1-rest | API trang trại | Backend tiếp nhận dữ liệu và chuyển lệnh tạo trại qua bước chống ghi trùng. Hàm `FarmWorkspaceResource.register` gọi `commands.execute` với lệnh `FARM_REGISTER`.[](source:res-ws) | uc01-seq | rest |
| u1-idem | Chống ghi trùng | Nếu mã và nội dung trùng với lần đã xử lý, hệ thống trả thông tin trại đã lưu. Dùng lại mã với nội dung khác sẽ báo lỗi. Chỗ kiểm là `IdempotencyCommandService.execute`.[](source:idem-execute) | uc01-seq | idem |
| u1-access | Kiểm tài khoản | Lấy tài khoản đã đăng nhập và còn hoạt động. Hàm `FarmAccessService.currentActiveUser()` trả về đối tượng tài khoản `AppUser`.[](source:access-current) | uc01-seq | access |
| u1-svc | Xử lý đăng ký | Sau khi kiểm hồ sơ Chủ trại và tỉnh, hàm `FarmWorkspaceService.register` tạo trại chờ thanh toán (`PENDING_PAYMENT`). Hàm cũng gắn tài khoản vừa đăng ký với vai trò Chủ trại (`OWNER`) của trại mới.[](source:svc-register) | uc01-seq | svc |
| u1-db | Cơ sở dữ liệu | Hệ thống tạo danh mục và tham số ban đầu (`StarterCatalogueService.create`), ghi nhật ký đăng ký (`FARM_REGISTER`) và lưu sự kiện `FARM_REGISTERED` để xử lý sau. Các bước lưu cùng một giao dịch.[](source:starter-create)[](source:svc-register) | uc01-seq | db |
| u1-done | Màn đăng ký | Backend trả `201 Created` cùng thông tin trại (`Details`). Màn hình dùng mã trại vừa nhận để mở SCR-58 Chọn gói dịch vụ.[](source:res-ws)[](source:fe-reg-page) | uc01-seq | page |

| Khi nào báo lỗi | Chỗ kiểm trong code | Mã lỗi |
| --- | --- | --- |
| Tài khoản chưa hoàn tất đăng ký Owner | `FarmWorkspaceService.register` | MSG-FE02-02 |
| Tài khoản bị tạm ngưng | `FarmAccessService.currentActiveUser` | MSG-FE01-03 |
| Tỉnh ngoài danh sách 34 tỉnh | `VietnamProvinces.require` | MSG-COM-10 |
| Cùng khóa, khác dữ liệu | `IdempotencyCommandService` | MSG-COM-19 |

## UC-02 Khi mở danh sách và chọn trại, hệ thống kiểm gì? {#uc02}

@sequence id=uc02-seq title="UC-FE02-02 Xem và chọn trại"
| actor page | Màn chọn trại | frontend | source:fe-select-page |
| actor feapi | Gửi từ web | frontend | source:fe-ws-api-list |
| actor rest | API trang trại | backend | source:res-ws |
| actor svc | Xử lý chọn trại | backend | source:svc-list |
| actor access | Kiểm quyền | security | source:access-require |
| actor db | Cơ sở dữ liệu | database |
| phase | Tải danh sách trại |
| page | feapi | Lấy danh sách trại |
| feapi | rest | Yêu cầu danh sách từ backend |
| rest | svc | Xử lý danh sách trại |
| svc | access | Lấy tài khoản đang đăng nhập |
| svc | db | Đọc trại đang tham gia, số bò và hạn gói |
| svc | feapi | Trả danh sách trại | return |
| feapi | page | Hiện danh sách trại | return |
| phase | Kiểm tra trước khi vào trại |
| page | feapi | Gửi mã trại được chọn |
| feapi | rest | Yêu cầu trạng thái và quyền tại trại |
| rest | svc | Xử lý yêu cầu vào trại |
| svc | access | Kiểm quyền vào trại |
| access | svc | Trả trại và vai trò của tài khoản | return |
| svc | feapi | Trả thông tin trại đã kiểm | return |
| feapi | page | Nhận thông tin để vào đúng màn hình | return |

@steps id=uc02-steps
| u2-page | Màn chọn trại | Khi chọn trại, `useFarmSelect.open` lấy trạng thái dịch vụ và vai trò để biết sẽ mở màn nào. Với trại đang hoạt động, hệ thống ghi nhớ lựa chọn cho tab hiện tại và tải trang đích. Tự mở bằng `replace` sẽ thay màn Chọn trại trong lịch sử tab.[](source:fe-select-page)[](source:fe-return) | uc02-seq | page |
| u2-svc | Xử lý chọn trại | `FarmWorkspaceService.list` liệt kê trại mà tài khoản còn là thành viên, kể cả trại có dịch vụ chưa hoạt động. `context` kiểm tra lại quyền trước khi frontend chọn trại hiện tại.[](source:svc-list) | uc02-seq | svc |
| u2-access | Kiểm quyền | `require(SELECT_FARM)` kiểm quyền vào trại. Ai chưa có tư cách thành viên đang hoạt động nhận `MSG-COM-01`. Quản lý hoặc Kỹ thuật viên chọn trại chưa hoạt động nhận `MSG-FE02-04`.[](source:access-require) | uc02-seq | access |

Menu chuyển trại nhanh nằm ở thanh trên của khu vực làm việc. Menu lưu trại `ACTIVE` theo tab và mở trang chủ theo vai trò. Menu dẫn về SCR-09 khi chọn trại chưa `ACTIVE`, khi trình duyệt chặn lưu trại theo tab hoặc khi chọn **Quản lý trang trại**.[](source:fe-switch)

Hàm `enterFarm` được dùng sau khi chấp nhận lời mời và sau thanh toán.[](source:fe-enter)

## UC-03 Khi sửa thông tin trại, hệ thống lưu gì? {#uc03}

@sequence id=uc03-seq title="UC-FE02-03 Cập nhật thông tin trại"
| actor page | Màn thông tin | frontend | source:fe-info-page |
| actor feapi | Gửi từ web | frontend | source:fe-ws-api-update |
| actor rest | API trang trại | backend | source:res-ws |
| actor idem | Chống ghi trùng | security | source:idem-execute |
| actor svc | Xử lý thông tin | backend | source:svc-update |
| actor access | Kiểm quyền | security | source:access-require |
| actor db | Cơ sở dữ liệu | database |
| phase | Nạp thông tin vào biểu mẫu |
| page | feapi | Lấy dữ liệu để sửa |
| feapi | rest | Yêu cầu chi tiết và quyền tại trại |
| rest | svc | Lấy thông tin trại theo mã |
| svc | access | Kiểm quyền xem thông tin |
| svc | feapi | Trả thông tin hiện tại | return |
| phase | Lưu thông tin đã sửa |
| page | feapi | Gửi thông tin mới và mã lần gửi |
| feapi | rest | Gửi yêu cầu cập nhật |
| rest | idem | Kiểm tra yêu cầu có bị gửi lại |
| idem | svc | Chạy lệnh cập nhật |
| svc | access | Kiểm quyền sửa thông tin |
| svc | db | Kiểm dữ liệu còn mới và lưu | emphasis |
| svc | db | Ghi nhật ký và lưu sự kiện |
| svc | feapi | Trả thông tin đã cập nhật | return |
| feapi | page | Báo đã lưu và tải lại | return |

@steps id=uc03-steps
| u3-page | Màn thông tin | Khi bấm Lưu, `submit` kiểm nội dung và gửi phiên bản mà người dùng đã mở (`expectedVersion`) cùng mã lần gửi.[](source:fe-info-page) | uc03-seq | page |
| u3-api | Gửi từ web | `getFarm` lấy cả thông tin trại và quyền tại trại. `updateFarm` gửi những trường chỉnh sửa được trên màn này qua `PUT /api/farms/{id}`. Giống chính không nằm trong yêu cầu cập nhật.[](source:fe-ws-api-farm)[](source:fe-ws-api-update) | uc03-seq | feapi |
| u3-svc | Xử lý thông tin | `FarmWorkspaceService.update` khóa bản ghi trong lúc lưu. `VersionGuard.requireExpected` kiểm xem có ai đã sửa trước đó, rồi service kiểm tỉnh và múi giờ UTC+7, lưu dữ liệu và ghi nhật ký `FARM_UPDATE`.[](source:svc-update) | uc03-seq | svc |
| u3-access | Kiểm quyền | Chủ trại xem và sửa được thông tin ở mọi trạng thái dịch vụ. `FarmAccessService.require` trả `MSG-COM-01` nếu tài khoản không có quyền.[](source:access-require) | uc03-seq | access |

| Khi nào báo lỗi | Chỗ kiểm trong code | Mã lỗi |
| --- | --- | --- |
| Không phải Chủ trại | `FarmAccessService.require` | MSG-COM-01 |
| Dữ liệu đã thay đổi sau khi màn hình mở | `VersionGuard.requireExpected` | MSG-COM-05 |
| Tỉnh / múi giờ sai | `VietnamProvinces.require`, `FarmTimeZones.require` | MSG-COM-10 |

## UC-04, UC-05 PM xem và đổi trạng thái dịch vụ ra sao? {#uc04-05}

@sequence id=uc0405-seq title="UC-FE02-04 Tổng quan + UC-FE02-05 Tạm ngưng / khôi phục"
| actor page | Màn dịch vụ | frontend | source:fe-pm-dialog |
| actor feapi | Gửi từ web | frontend | source:fe-pm-api |
| actor rest | API dịch vụ | backend | source:res-pm |
| actor idem | Chống ghi trùng | security | source:idem-execute |
| actor svc | Xử lý dịch vụ | backend | source:pm-change |
| actor access | Kiểm quyền | security | source:platform-role |
| actor db | Cơ sở dữ liệu | database |
| phase | Xem danh sách trại |
| page | feapi | Lấy danh sách theo bộ lọc |
| feapi | rest | Yêu cầu tổng quan dịch vụ |
| rest | svc | Tra danh sách trại theo bộ lọc |
| svc | access | Kiểm quyền quản lý nền tảng |
| svc | db | Lấy danh sách và số liệu tổng |
| svc | feapi | Trả danh sách và các ô thống kê | return |
| phase | Xem trước tác động |
| page | feapi | Mở chi tiết của trại |
| feapi | rest | Yêu cầu xem trước |
| rest | svc | Tính trạng thái sau thay đổi |
| svc | feapi | Trả thông tin xem trước | return |
| phase | Xác nhận đổi trạng thái |
| page | feapi | Xác nhận tạm ngưng hoặc khôi phục |
| feapi | rest | Gửi lệnh đổi trạng thái |
| rest | idem | Kiểm quyền PM và mã lần gửi |
| idem | svc | Chạy lệnh tạm ngưng hoặc khôi phục |
| svc | db | Kiểm dữ liệu còn mới và lưu trạng thái | emphasis |
| svc | db | Ghi nhật ký và xếp thông báo |
| svc | feapi | Trả trạng thái sau thay đổi | return |
| feapi | page | Báo thay đổi thành công | return |

@steps id=uc0405-steps
| u4-page | Màn dịch vụ | Màn dịch vụ tải 20 trại mỗi trang qua `useFarmList`. Khi chọn đổi trạng thái, hộp thoại cho xem trước kết quả rồi mới gửi `suspendFarm` hoặc `restoreFarm`.[](source:fe-pm-routes)[](source:fe-pm-hooks)[](source:fe-pm-dialog) | uc0405-seq | page |
| u4-overview | Xử lý dịch vụ | `PlatformFarmService.overview` lọc tên trại hoặc email Chủ trại và tính các ô thống kê. `preview` cho biết kỳ đã mua, lần tạm ngưng gần nhất và trạng thái sẽ có nếu khôi phục.[](source:pm-overview)[](source:pm-preview) | uc0405-seq | svc |
| u4-access | Kiểm quyền | `requireRole(PM)` kiểm người thao tác là Quản lý nền tảng đang hoạt động. Tài khoản thiếu quyền nhận `MSG-COM-01`.[](source:platform-role) | uc0405-seq | access |
| u5-change | Cơ sở dữ liệu | `suspend` và `restore` khóa bản ghi khi kiểm trạng thái và phiên bản. Khôi phục tính trạng thái từ hạn gói (`latestEnd`). `recordAndNotify` ghi nhật ký và xếp thông báo cho Chủ trại.[](source:pm-change)[](source:pm-notify) | uc0405-seq | db |

| Khi nào báo lỗi | Chỗ kiểm trong code | Mã lỗi |
| --- | --- | --- |
| Không phải PM ACTIVE | `PlatformAccessService.requireRole` | MSG-COM-01 |
| Lý do trống / quá 500 ký tự | `PlatformFarmService.validate` | MSG-COM-06 / 10 |
| Đã ở trạng thái yêu cầu | `PlatformFarmService.alreadyIn` | MSG-FE02-09 |
| Dữ liệu đã thay đổi sau khi màn hình mở | `VersionGuard.requireExpected` | MSG-COM-05 |
