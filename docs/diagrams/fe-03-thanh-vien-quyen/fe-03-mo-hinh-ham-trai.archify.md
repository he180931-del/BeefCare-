# FE-03 – Mô hình hàm phía trại (UC-01 → UC-06) {#fe03-farm-functions}

Phía trại của FE-03 dồn vào **một service**: `FarmMembershipService`. Mọi lệnh của Chủ trại đi qua `IdempotencyCommandService`, rồi `requireOwner` kiểm quyền trước khi khóa dòng.

- Frontend gọi qua `farmWorkspaceApi`; lệnh ghi gửi `expectedVersion` và `Idempotency-Key`.[](source:fe-api-members)
- Lệnh trên lời mời khóa dòng qua `lockPendingInvitation`: kiểm trạng thái trước, version sau.[](source:svc-lock-pending)
- Chấp nhận lời mời không dùng `Idempotency-Key`; token là khóa ý định.[](source:svc-accept)
- Email không gửi ngay: `MailService` lưu ý định gửi trong cùng transaction, JOB-07 gửi sau.[](source:mail-queue)

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

## UC-01 Gửi lời mời gọi những hàm nào? {#uc01}

@sequence id=f3-uc01-seq title="UC-FE03-01 Gửi lời mời"
| actor page | Popup Mời | frontend | source:fe-invite |
| actor feapi | farmWorkspaceApi | frontend | source:fe-api-invites |
| actor rest | Membership REST | backend | source:res-members |
| actor idem | Idempotency | security | source:idem-execute |
| actor svc | MembershipService | backend | source:svc-invite |
| actor access | FarmAccessService | security | source:access-require |
| actor db | Cơ sở dữ liệu | database |
| page | feapi | useInviteDialog → inviteMember(farmId, input, key) |
| feapi | rest | POST …/invitations |
| rest | idem | execute(INVITE_SEND) |
| idem | svc | invite(farmId, request) |
| svc | access | requireOwner → require() | security |
| svc | db | lockById(farm), kiểm ACTIVE |
| svc | db | email đã là thành viên? lời mời PENDING? |
| svc | db | saveAndFlush lời mời, token hash | emphasis |
| svc | db | audit MEMBER_INVITE, queueActionLink |
| svc | feapi | InvitationView | return |
| feapi | page | MSG-FE03-01, tải lại SCR-14 | return |

@steps id=f3-uc01-steps
| a1-page | Popup Mời | `submit`: nếu MSG-FE03-03 thì gọi `resendInvitation` cho lời mời đang chờ; nếu không thì `inviteMember` với khóa theo dữ liệu.[](source:fe-invite) | f3-uc01-seq | page |
| a1-svc | MembershipService | `invite`: `requireOwner(farmId, true)`, khóa trại, chuẩn hóa email, kiểm số ngày 3 / 7 / 14 và vai trò MANAGER / TECHNICIAN.[](source:svc-invite) | f3-uc01-seq | svc |
| a1-db | Cơ sở dữ liệu | Token link = `linkSigner.bearer(...)`, chỉ lưu hash. `mail.queueActionLink` lưu ý định gửi email trong cùng transaction.[](source:mail-queue) | f3-uc01-seq | db |

| Lỗi | Hàm ném | Mã |
| --- | --- | --- |
| Không phải Chủ trại | `FarmAccessService.require` | MSG-COM-01 |
| Trại không ACTIVE | `requireOwner` / `invite` | MSG-FE03-04 |
| Email là thành viên ACTIVE | `invite` | MSG-FE03-02 |
| Email là thành viên đã ngưng | `invite` | MSG-FE03-21 (kèm `membershipId`) |
| Đã có lời mời PENDING | `invite` | MSG-FE03-03 (kèm `invitationId`) |
| Số ngày / vai trò sai | `invite` | MSG-COM-10 |

## UC-02, UC-03 Xem, gửi lại, hủy lời mời gọi những hàm nào? {#uc02-03}

@sequence id=f3-uc0203-seq title="UC-FE03-02 Xem + UC-FE03-03 Gửi lại / hủy lời mời"
| actor page | SCR-14 Lời mời | frontend | source:fe-invitations |
| actor feapi | farmWorkspaceApi | frontend | source:fe-api-invites |
| actor rest | Membership REST | backend | source:res-members |
| actor idem | Idempotency | security | source:idem-execute |
| actor svc | MembershipService | backend | source:svc-resend-cancel |
| actor access | FarmAccessService | security | source:access-require |
| actor db | Cơ sở dữ liệu | database |
| phase | UC-02 Danh sách |
| page | feapi | useInvitationsPage → listInvitations |
| feapi | rest | GET …/invitations |
| rest | svc | listInvitations(...) |
| svc | access | require(VIEW_FARM_INFORMATION) | security |
| svc | db | trang 20 dòng + đếm 4 trạng thái |
| svc | feapi | InvitationPage | return |
| phase | UC-03 Gửi lại / Hủy |
| page | feapi | useInvitationsPage → gửi lại / hủy |
| feapi | rest | POST …/{id}/resend · /cancel |
| rest | idem | execute(INVITE_RESEND / CANCEL) |
| idem | svc | resend / cancel |
| svc | access | requireOwner | security |
| svc | db | lockPendingInvitation | emphasis |
| svc | db | token mới / CANCELLED, audit, mail |
| svc | feapi | InvitationView | return |
| feapi | page | MSG-FE03-05 / 07, tải lại | return |

@steps id=f3-uc0203-steps
| b1-page | SCR-14 Lời mời | Tải chi tiết trại và danh sách song song; `run` gọi gửi lại hoặc hủy với `expectedVersion`.[](source:fe-invitations) | f3-uc0203-seq | page |
| b1-svc | MembershipService | `listInvitations` kiểm tham số; lời mời PENDING quá hạn được tính EXPIRED lúc đọc, không ghi.[](source:svc-list-invites) `resend` đổi nonce và hash, link cũ hết tác dụng; `cancel` đặt CANCELLED, giữ hash tới JOB-08.[](source:svc-resend-cancel) | f3-uc0203-seq | svc |
| b1-db | Cơ sở dữ liệu | `lockPendingInvitation`: không còn PENDING → MSG-FE03-08 kèm trạng thái, rồi mới kiểm version → MSG-COM-05.[](source:svc-lock-pending) JOB-02 chuyển PENDING quá hạn sang EXPIRED mỗi 15 phút.[](source:svc-expire-job) | f3-uc0203-seq | db |

## UC-04 Chấp nhận lời mời gọi những hàm nào? {#uc04}

@sequence id=f3-uc04-seq title="UC-FE03-04 Chấp nhận lời mời"
| actor page | SCR-15 Chấp nhận | frontend | source:fe-accept |
| actor feapi | farmWorkspaceApi | frontend | source:fe-api-accept |
| actor rest | Membership REST | backend | source:res-members |
| actor svc | MembershipService | backend | source:svc-accept |
| actor access | FarmAccessService | security | source:access-require |
| actor db | Cơ sở dữ liệu | database |
| phase | Xem lời mời (A7) |
| page | feapi | useFarmWorkspaceUseCase → previewInvitation(token) |
| feapi | rest | GET /api/invitations/accept |
| rest | svc | preview(token) |
| svc | db | findInviteForCaller: hash token |
| svc | access | currentActiveUser(), so email | security |
| svc | db | ACCEPTED: membership ACTIVE. PENDING: hạn và trại ACTIVE |
| svc | feapi | InvitationAcceptance | return |
| phase | Chấp nhận (A8) |
| page | feapi | useFarmWorkspaceUseCase → acceptInvitation(token) |
| feapi | rest | POST /api/invitations/accept |
| rest | svc | accept(token) |
| svc | db | lockByTokenHash, lockById(farm) | security |
| svc | feapi | Nếu đã ACCEPTED: trả membership ACTIVE đã có | return |
| svc | db | Nếu PENDING: kiểm hạn, trại ACTIVE và tạo membership | emphasis |
| svc | db | Với lần chấp nhận mới: audit, queueMemberJoined |
| svc | feapi | AcceptedInvitation | return |
| feapi | page | enterFarm(farmId) | return |

@steps id=f3-uc04-steps
| c1-page | SCR-15 Chấp nhận | `useFarmWorkspaceUseCase` đọc và gửi xác nhận lời mời.[](source:fe-workspace) `accept` hiện MSG-FE03-10, rồi `open` gọi `enterFarm` để mở trang chủ theo vai trò mới.[](source:fe-accept) `enterFarm` dùng chung với SCR-09.[](source:fe-enter) | f3-uc04-seq | page |
| c1-find | MembershipService | Token trống hoặc sai → MSG-FE03-08 `INVALID`. Email khác → MSG-FE03-09. Ngoài nhánh mở lại ACCEPTED, lời mời phải PENDING và còn hạn.[](source:svc-find-token) | f3-uc04-seq | svc |
| c1-db | Cơ sở dữ liệu | Mở lại ACCEPTED với đúng email và membership ACTIVE thì trả membership đã có. Nếu membership đã ngưng, trả MSG-FE03-08 (ACCEPTED).[](source:svc-replay) Với lời mời PENDING, trại phải ACTIVE và người được mời chưa có membership.[](source:svc-accept) | f3-uc04-seq | db |

## UC-05, UC-06 Xem và đổi thành viên gọi những hàm nào? {#uc05-06}

@sequence id=f3-uc0506-seq title="UC-FE03-05 Xem + UC-FE03-06 Đổi vai trò / ngưng / kích hoạt lại"
| actor page | SCR-13 Thành viên | frontend | source:fe-member-change |
| actor feapi | farmWorkspaceApi | frontend | source:fe-api-members |
| actor rest | Membership REST | backend | source:res-members |
| actor idem | Idempotency | security | source:idem-execute |
| actor svc | MembershipService | backend | source:svc-change |
| actor access | FarmAccessService | security | source:access-require |
| actor db | Cơ sở dữ liệu | database |
| phase | UC-05 Danh sách |
| page | feapi | useMembersPage → listMembers(farmId) |
| feapi | rest | GET …/members |
| rest | svc | listMembers(farmId) |
| svc | access | require(VIEW_MEMBERS) | security |
| svc | db | findWithUserByFarmId, sắp theo tên |
| svc | feapi | MemberList + actions | return |
| phase | UC-06 Đổi |
| page | feapi | changeMember(id, payload) |
| feapi | rest | PUT …/members/{id} |
| rest | idem | execute(MEMBER_CHANGE) |
| idem | svc | changeMember(...) |
| svc | access | requireOwner | security |
| svc | db | lockByIdAndFarmId, kiểm theo thứ tự | emphasis |
| svc | db | membership_change + audit |
| svc | feapi | MemberView | return |
| feapi | page | MSG-FE03-13, tải lại | return |

@steps id=f3-uc0506-steps
| d1-page | SCR-13 Thành viên | `MembersPage` gọi `listMembers`.[](source:fe-members) Popup `save` gửi hành động, vai trò, ngày hiệu lực, lý do kèm `expectedVersion`.[](source:fe-member-change) | f3-uc0506-seq | page |
| d1-list | MembershipService | `listMembers`: Quản lý chỉ nhận dòng ACTIVE, không có số Đã ngưng; sắp theo tên tiếng Việt rồi email, id.[](source:svc-list-members) | f3-uc0506-seq | svc |
| d1-db | Cơ sở dữ liệu | `changeMember` kiểm: membership OWNER → MSG-COM-01; ngày tương lai → MSG-COM-07; lý do dưới 5 ký tự → MSG-COM-10; trại không ACTIVE (trừ Ngưng) → MSG-FE03-04; đã đúng → MSG-FE03-20; version → MSG-COM-05.[](source:svc-change) | f3-uc0506-seq | db |
