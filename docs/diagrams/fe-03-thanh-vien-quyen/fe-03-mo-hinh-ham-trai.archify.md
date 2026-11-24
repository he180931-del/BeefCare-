# FE-03 – Mô hình hàm phía trại (UC-01 → UC-06) {#fe03-farm-functions}

Phần này cho thấy lời mời được gửi và chấp nhận ra sao, cùng cách Chủ trại quản lý thành viên sau khi họ vào trại.

- Đọc các mũi tên từ trên xuống. Rê chuột lên ô hoặc số nguồn để xem hàm và đoạn code tương ứng.
- Mỗi lời mời có một mã trong liên kết. Khi người được mời mở link, hệ thống đối chiếu mã với email đã đăng nhập.[](source:svc-find-token)

@answer scope="Code dev 703f90e0 · UC-FE03-01 → 06"
@meta locale=en repo_url=https://github.com/he180931-del/BeefCare-.git repo_revision=703f90e0ccdaa7c995525ce7e821d59c14829821
@source fe-invite title="useInviteDialog" path=frontend/src/features/farm-workspace/hooks/useInviteDialog.ts lines=6:12
@source fe-invitations title="useInvitationsPage: danh sách, gửi lại, hủy" path=frontend/src/features/farm-workspace/hooks/useInvitationsPage.ts lines=11:17
@source fe-accept title="AcceptInvitationPage: preview, accept, open" path=frontend/src/features/farm-workspace/pages/AcceptInvitationPage.tsx lines=53:86
@source fe-members title="useMembersPage: danh sách thành viên" path=frontend/src/features/farm-workspace/hooks/useMembersPage.ts lines=13:18
@source fe-member-change title="MemberChangeDialog.save" path=frontend/src/features/farm-workspace/components/MemberChangeDialog.tsx lines=55:75
@source fe-api-members title="farmWorkspaceApi: listMembers / changeMember" path=frontend/src/features/farm-workspace/api/farmWorkspaceApi.ts lines=215:222
@source fe-api-invites title="farmWorkspaceApi: listInvitations / inviteMember / resend / cancel" path=frontend/src/features/farm-workspace/api/farmWorkspaceApi.ts lines=223:244
@source fe-api-accept title="farmWorkspaceApi: previewInvitation / acceptInvitation" path=frontend/src/features/farm-workspace/api/farmWorkspaceApi.ts lines=245:265
@source fe-enter title="enterFarm" path=frontend/src/features/farm-workspace/components/enterFarm.ts lines=14:28
@source fe-workspace title="useFarmWorkspaceUseCase" path=frontend/src/features/farm-workspace/hooks/useFarmWorkspaceUseCase.ts lines=91:115
@source svc-replay title="FarmMembershipService.activeMembershipOfCaller" path=backend/src/main/java/vn/edu/fpt/beefcare/service/FarmMembershipService.java lines=272:277
@source res-members title="FarmMembershipResource" path=backend/src/main/java/vn/edu/fpt/beefcare/web/rest/FarmMembershipResource.java lines=84:147
@source idem-execute title="IdempotencyCommandService.execute" path=backend/src/main/java/vn/edu/fpt/beefcare/service/IdempotencyCommandService.java lines=101:107
@source svc-list-members title="FarmMembershipService.listMembers" path=backend/src/main/java/vn/edu/fpt/beefcare/service/FarmMembershipService.java lines=75:94
@source svc-list-invites title="FarmMembershipService.listInvitations" path=backend/src/main/java/vn/edu/fpt/beefcare/service/FarmMembershipService.java lines=108:132
@source svc-invite title="FarmMembershipService.invite" path=backend/src/main/java/vn/edu/fpt/beefcare/service/FarmMembershipService.java lines=134:185
@source svc-resend-cancel title="FarmMembershipService.resend / cancel" path=backend/src/main/java/vn/edu/fpt/beefcare/service/FarmMembershipService.java lines=187:221
@source svc-preview title="FarmMembershipService.preview" path=backend/src/main/java/vn/edu/fpt/beefcare/service/FarmMembershipService.java lines=223:236
@source svc-accept title="FarmMembershipService.accept" path=backend/src/main/java/vn/edu/fpt/beefcare/service/FarmMembershipService.java lines=238:270
@source svc-change title="FarmMembershipService.changeMember" path=backend/src/main/java/vn/edu/fpt/beefcare/service/FarmMembershipService.java lines=299:348
@source svc-require-owner title="FarmMembershipService.requireOwner" path=backend/src/main/java/vn/edu/fpt/beefcare/service/FarmMembershipService.java lines=352:358
@source svc-lock-pending title="FarmMembershipService.lockPendingInvitation" path=backend/src/main/java/vn/edu/fpt/beefcare/service/FarmMembershipService.java lines=360:371
@source svc-expire-job title="JOB-02 expirePendingInvitations" path=backend/src/main/java/vn/edu/fpt/beefcare/service/FarmMembershipService.java lines=387:398
@source svc-find-token title="FarmMembershipService.findInviteForCaller" path=backend/src/main/java/vn/edu/fpt/beefcare/service/FarmMembershipService.java lines=399:409
@source access-require title="FarmAccessService.require" path=backend/src/main/java/vn/edu/fpt/beefcare/service/FarmAccessService.java lines=45:71
@source mail-queue title="MailService.queueActionLink / queueMemberJoined / cancelActionLink" path=backend/src/main/java/vn/edu/fpt/beefcare/service/MailService.java lines=60:120

## UC-01 Hệ thống gửi lời mời vào trại ra sao? {#uc01}

@sequence id=f3-uc01-seq title="UC-FE03-01 Gửi lời mời"
| actor page | Hộp mời | frontend | source:fe-invite |
| actor feapi | Gửi từ web | frontend | source:fe-api-invites |
| actor rest | API thành viên | backend | source:res-members |
| actor idem | Chống ghi trùng | security | source:idem-execute |
| actor svc | Xử lý lời mời | backend | source:svc-invite |
| actor access | Kiểm quyền | security | source:access-require |
| actor db | Cơ sở dữ liệu | database |
| page | feapi | Gửi email, vai trò và hạn mời |
| feapi | rest | Gửi yêu cầu tạo lời mời |
| rest | idem | Kiểm tra mã lần gửi |
| idem | svc | Chạy lệnh tạo lời mời |
| svc | access | Kiểm quyền Chủ trại |
| svc | db | Kiểm trại đang hoạt động |
| svc | db | Kiểm email đã tham gia hay đã được mời |
| svc | db | Lưu lời mời để kiểm link khi mở | emphasis |
| svc | db | Ghi nhật ký và xếp email |
| svc | feapi | Trả thông tin lời mời | return |
| feapi | page | Báo thành công và tải lại danh sách | return |

@steps id=f3-uc01-steps
| a1-page | Hộp mời | `useInviteDialog` gửi email, vai trò và hạn mời qua `inviteMember`. Khi đã có lời mời đang chờ (`MSG-FE03-03`), hộp thoại tải lời mời đó để Chủ trại chọn gửi lại.[](source:fe-invite) | f3-uc01-seq | page |
| a1-svc | Xử lý lời mời | `FarmMembershipService.invite` kiểm người gửi là Chủ trại, dịch vụ đang hoạt động và email có thể được mời. Bạn có thể chọn hạn 3, 7 hoặc 14 ngày và vai trò Quản lý hoặc Kỹ thuật viên.[](source:svc-invite) | f3-uc01-seq | svc |
| a1-db | Cơ sở dữ liệu | `linkSigner.bearer` tạo mã để đưa vào link. Hệ thống lưu bản băm của mã (`hash`) để đối chiếu khi mở link. `mail.queueActionLink` lên lịch gửi email cùng lần lưu lời mời.[](source:svc-invite)[](source:mail-queue) | f3-uc01-seq | db |

| Khi nào báo lỗi | Chỗ kiểm trong code | Mã lỗi |
| --- | --- | --- |
| Không phải Chủ trại | `FarmAccessService.require` | MSG-COM-01 |
| Trại chưa hoạt động | `requireOwner` / `invite` | MSG-FE03-04 |
| Email đã là thành viên đang hoạt động | `invite` | MSG-FE03-02 |
| Email là thành viên đã ngưng | `invite` | MSG-FE03-21 (kèm `membershipId`) |
| Email đã có lời mời đang chờ | `invite` | MSG-FE03-03 (kèm `invitationId`) |
| Số ngày / vai trò sai | `invite` | MSG-COM-10 |

## UC-02, UC-03 Xem, gửi lại và hủy lời mời thế nào? {#uc02-03}

@sequence id=f3-uc0203-seq title="UC-FE03-02 Xem + UC-FE03-03 Gửi lại / hủy lời mời"
| actor page | Màn lời mời | frontend | source:fe-invitations |
| actor feapi | Gửi từ web | frontend | source:fe-api-invites |
| actor rest | API thành viên | backend | source:res-members |
| actor idem | Chống ghi trùng | security | source:idem-execute |
| actor svc | Xử lý lời mời | backend | source:svc-resend-cancel |
| actor access | Kiểm quyền | security | source:access-require |
| actor db | Cơ sở dữ liệu | database |
| phase | Xem danh sách lời mời |
| page | feapi | Lấy danh sách theo bộ lọc |
| feapi | rest | Yêu cầu danh sách lời mời |
| rest | svc | Tra lời mời theo tiêu chí |
| svc | access | Kiểm quyền xem thông tin trại |
| svc | db | Lấy 20 dòng và số lượng theo trạng thái |
| svc | feapi | Trả danh sách lời mời | return |
| phase | Gửi lại hoặc hủy lời mời |
| page | feapi | Gửi lựa chọn gửi lại hoặc hủy |
| feapi | rest | Gửi lệnh đã chọn |
| rest | idem | Kiểm tra mã lần gửi |
| idem | svc | Chạy lệnh gửi lại hoặc hủy |
| svc | access | Kiểm quyền Chủ trại |
| svc | db | Khóa lời mời và kiểm còn chờ | emphasis |
| svc | db | Lưu link mới hoặc trạng thái đã hủy |
| svc | feapi | Trả lời mời sau thay đổi | return |
| feapi | page | Báo kết quả và tải lại | return |

@steps id=f3-uc0203-steps
| b1-page | Màn lời mời | Màn lời mời tải chi tiết trại và danh sách cùng lúc. Khi gửi lại hoặc hủy, `useInvitationsPage` gửi phiên bản lời mời đã xem (`expectedVersion`) để phát hiện thay đổi của người khác.[](source:fe-invitations) | f3-uc0203-seq | page |
| b1-svc | Xử lý lời mời | `listInvitations` hiển thị lời mời quá hạn là Đã hết hạn. `resend` tạo link mới và làm link cũ mất hiệu lực. `cancel` đánh dấu Đã hủy và giữ mã băm của link đến khi JOB-08 dọn dữ liệu.[](source:svc-list-invites)[](source:svc-resend-cancel) | f3-uc0203-seq | svc |
| b1-db | Cơ sở dữ liệu | `lockPendingInvitation` giữ bản ghi trong lúc kiểm. Hệ thống kiểm lời mời còn chờ trước, rồi mới so phiên bản. Lời mời đã đổi trạng thái báo `MSG-FE03-08`, còn dữ liệu cũ báo `MSG-COM-05`. JOB-02 đánh dấu lời mời hết hạn mỗi 15 phút.[](source:svc-lock-pending)[](source:svc-expire-job) | f3-uc0203-seq | db |

## UC-04 Khi mở link và chấp nhận lời mời, hệ thống kiểm gì? {#uc04}

@sequence id=f3-uc04-seq title="UC-FE03-04 Chấp nhận lời mời"
| actor page | Màn nhận lời | frontend | source:fe-accept |
| actor feapi | Gửi từ web | frontend | source:fe-api-accept |
| actor rest | API thành viên | backend | source:res-members |
| actor svc | Xử lý lời mời | backend | source:svc-accept |
| actor access | Kiểm tài khoản | security | source:access-require |
| actor db | Cơ sở dữ liệu | database |
| phase | Mở link để xem lời mời |
| page | feapi | Gửi mã trong link lời mời |
| feapi | rest | Yêu cầu xem lời mời |
| rest | svc | Kiểm thông tin lời mời |
| svc | db | Tìm lời mời theo mã link |
| svc | access | Lấy tài khoản và so email |
| svc | db | Đã nhận: kiểm tư cách. Đang chờ: kiểm hạn và trại |
| svc | feapi | Trả thông tin và trạng thái lời mời | return |
| phase | Bấm chấp nhận |
| page | feapi | Gửi xác nhận tham gia |
| feapi | rest | Gửi yêu cầu chấp nhận |
| rest | svc | Xử lý chấp nhận lời mời |
| svc | db | Khóa lời mời và trại |
| svc | feapi | Đã nhận: trả thông tin thành viên hiện có | return |
| svc | db | Đang chờ: kiểm điều kiện và lưu thành viên | emphasis |
| svc | db | Lần đầu nhận: ghi nhật ký và xếp email |
| svc | feapi | Trả kết quả tham gia | return |
| feapi | page | Nhận kết quả để mở trại | return |

@steps id=f3-uc04-steps
| c1-page | Màn nhận lời | `useFarmWorkspaceUseCase` xem lời mời qua `GET /api/invitations/accept` và gửi chấp nhận qua `POST /api/invitations/accept`. Khi đã tham gia, `enterFarm` kiểm lại quyền vào trại rồi mở trang chủ theo vai trò.[](source:fe-workspace)[](source:fe-accept)[](source:fe-enter) | f3-uc04-seq | page |
| c1-find | Xử lý lời mời | `findInviteForCaller` kiểm mã trong link và email. Mã sai báo `MSG-FE03-08`, còn đăng nhập bằng email khác báo `MSG-FE03-09`. Lời mời đang chờ phải còn hạn.[](source:svc-find-token) | f3-uc04-seq | svc |
| c1-db | Cơ sở dữ liệu | Mở lại lời mời đã chấp nhận chỉ trả thành viên cũ nếu tư cách còn hoạt động. Nếu đã ngưng thì báo `MSG-FE03-08`. Lần chấp nhận mới cần trại hoạt động và chưa có bản ghi thành viên cho người này.[](source:svc-replay)[](source:svc-accept) | f3-uc04-seq | db |

## UC-05, UC-06 Xem và thay đổi thành viên trong trại ra sao? {#uc05-06}

@sequence id=f3-uc0506-seq title="UC-FE03-05 Xem + UC-FE03-06 Đổi vai trò / ngưng / kích hoạt lại"
| actor page | Màn thành viên | frontend | source:fe-member-change |
| actor feapi | Gửi từ web | frontend | source:fe-api-members |
| actor rest | API thành viên | backend | source:res-members |
| actor idem | Chống ghi trùng | security | source:idem-execute |
| actor svc | Xử lý thành viên | backend | source:svc-change |
| actor access | Kiểm quyền | security | source:access-require |
| actor db | Cơ sở dữ liệu | database |
| phase | Tải danh sách thành viên |
| page | feapi | Lấy thành viên của trại |
| feapi | rest | Yêu cầu danh sách thành viên |
| rest | svc | Tra danh sách theo mã trại |
| svc | access | Kiểm quyền xem thành viên |
| svc | db | Lấy thành viên và sắp theo tên |
| svc | feapi | Trả danh sách và thao tác được phép | return |
| phase | Đổi vai trò hoặc trạng thái |
| page | feapi | Gửi lựa chọn và lý do |
| feapi | rest | Gửi yêu cầu đổi thành viên |
| rest | idem | Kiểm tra mã lần gửi |
| idem | svc | Chạy lệnh đổi thành viên |
| svc | access | Kiểm quyền Chủ trại |
| svc | db | Kiểm điều kiện và lưu thay đổi | emphasis |
| svc | db | Ghi lịch sử thành viên và nhật ký |
| svc | feapi | Trả thành viên đã sửa | return |
| feapi | page | Báo kết quả và tải lại | return |

@steps id=f3-uc0506-steps
| d1-page | Màn thành viên | `useMembersPage` tải danh sách với `listMembers`. Hộp chỉnh sửa gửi thao tác, vai trò, ngày hiệu lực, lý do và phiên bản đã mở (`expectedVersion`).[](source:fe-members)[](source:fe-member-change) | f3-uc0506-seq | page |
| d1-list | Xử lý thành viên | `listMembers` sắp theo tên tiếng Việt, rồi email và mã. Nếu người xem là Quản lý, kết quả chỉ có thành viên đang hoạt động.[](source:svc-list-members) | f3-uc0506-seq | svc |
| d1-db | Cơ sở dữ liệu | `changeMember` kiểm quyền, ngày hiệu lực, lý do và trạng thái trại. Thành viên có vai trò Chủ trại được bảo vệ. Với trại chưa hoạt động, Chủ trại vẫn có thể ngưng thành viên. Cuối cùng service so phiên bản trước khi lưu.[](source:svc-change) | f3-uc0506-seq | db |
