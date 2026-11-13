# FE-03 / UC-FE03-05 — Xem thành viên trại

## Phạm vi và căn cứ

- D29, người dùng đồng ý cả sáu đề xuất ngày 14/11/2026: phạm vi A1 + SCR-13; Owner xem
  ở mọi trạng thái dịch vụ (GBR-14 sửa theo); nghĩa của tab; cột `joined_at`; A1 trả cả
  danh sách kèm số đếm/thao tác, bỏ lý do lần đổi; bảng quyền đủ Table III-2.
- Checkout `D:/Project/BeefCare-`, branch `feat/fe03-thanh-vien-quyen`, base `caa66b8`
  (UC4 đã commit). Chưa commit/push. Có migration mới `20261114000100_membership_joined_at`;
  không đổi DB dùng chung, không thêm dependency.
- Nguồn: SRS 28/10 UC-FE03-05 (1112), SCR-13 (3043–3059), Table III-2 (3061–3080),
  Table III-1 (2785–2801), Part I §3.2 Farm Membership (525), GBR-06/09/14/18; spec FE-03
  §2/3.2/5/6/7/9/10; `backend/AGENTS.md`.
- Ngoài phạm vi: popup và lệnh UC6 (đổi vai trò / ngưng / kích hoạt lại) chỉ được nối nút,
  không chứng nhận; SCR-08 ở chế độ backend (FE-01).

## Ma trận hợp đồng A1

| Field | Kiểu / bắt buộc | Nguồn và round trip |
|---|---|---|
| farmName / timeZone / serviceStatus | string, bắt buộc | `Farm` của context quyền; SCR-13 không còn gọi API chi tiết trại chỉ dành cho Owner |
| counts.all | int64 | Số dòng trả về (Owner: gồm Owner và INACTIVE; Manager: chỉ ACTIVE) |
| counts.managers / technicians | int64 | Membership ACTIVE của vai trò |
| counts.inactive | int64, chỉ Owner (`@JsonInclude NON_NULL`) | Membership INACTIVE |
| items[].id / userId | Long > 0 | `farm_membership.id` / `app_user.id`; FE-08 dùng `userId` |
| items[].fullName / email | string | `app_user`; chưa có tên → FE hiện "Chưa có tên", xếp theo email |
| items[].role / status | OWNER\|MANAGER\|TECHNICIAN / ACTIVE\|INACTIVE | `farm_membership` |
| items[].joinedAt | instant, bắt buộc | `farm_membership.joined_at` (NOT NULL): đăng ký trại / chấp nhận lời mời; `updatable=false` |
| items[].version | int | `@Version`, gửi lại ở UC6 |
| items[].actions | mảng CHANGE_ROLE/DEACTIVATE/REACTIVATE | Owner: ACTIVE → [CHANGE_ROLE, DEACTIVATE] khi trại ACTIVE, [DEACTIVATE] khi không; INACTIVE → [REACTIVATE] khi trại ACTIVE; dòng Owner và Manager → [] |
| (bỏ) effectiveDate / reason | — | Vẫn lưu ở membership và audit; không trả cho SCR-13 |

Thứ tự server và FE giống nhau: `Collator` tiếng Việt (SECONDARY) / `Intl.Collator('vi',
{sensitivity:'accent'})` theo tên (trống → email), rồi email, rồi id.

## Khoảng trống tìm thấy và cách sửa

| # | Khoảng trống | Sửa |
|---|---|---|
| G1 | Technician gọi được A1 (service kiểm `VIEW_CATALOGUES`) | `FarmAction.VIEW_MEMBERS` (Owner, Manager); Owner được miễn ACTIVE trong `FarmAccessService` (GBR-14, D29) |
| G2 | Manager mở SCR-13 bị lỗi vì trang gọi `GET /api/farms/{id}` (Owner-only) | A1 trả tên trại, múi giờ, trạng thái; trang chỉ gọi A1 |
| G3 | Cột Tham gia luôn "—" | Cột `joined_at` + backfill; FE hiện mm/yyyy theo múi giờ trại |
| G4 | A1 trả lý do / ngày hiệu lực lần đổi cho cả Manager | Bỏ khỏi `MemberView` |
| G5 | Sắp theo id, không phân trang, không Xóa bộ lọc, không nhớ tab | Theo tên, 20 dòng/trang, Xóa bộ lọc, Thử lại, Làm mới, nhớ tab/chiều theo tài khoản + trại |
| G6 | A1 là mảng, FE tự đếm và tự quyết nút | `MemberList` có `counts` và `actions` |
| G7 | Nhãn "Ngừng hoạt động" / "Ngừng" | "Đã ngưng" / "Ngưng" trên SCR-13 (popup UC6 giữ nguyên) |
| G8 | Bảng quyền 14 dòng theo Figma, lệch Table III-2 | 17 nhóm × 3 vai trò, chữ của SRS; mức FULL/RESTRICTED/NO khớp `AccountResource` (SCR-08) |
| G9 | `listMembers` tải user từng dòng (N+1, kể cả `platformStaffAccess`) | `@EntityGraph(user, user.platformStaffAccess)`; test số câu SQL 2 vs 12 thành viên bằng nhau |

Ghi chú cho chủ FE-01 (LamKD): dữ liệu mô phỏng SCR-08 (`permissionRowsFor`) nay có 17
nhóm như backend; nhãn giữ như `ProfileParts`. Ghi chú cho FE-08: người cân chưa có họ
tên hiện chuỗi rỗng (`growthBackend.formOptions` dùng `textValue(fullName, email)`), có từ
trước, không sửa trong UC5.

## Test

| Nơi | Ca | Tầng |
|---|---|---|
| `FarmMemberListResourceTest` (+ `FarmMemberListPostgresIT`) | Owner: thứ tự tiếng Việt (hoa/thường, Đ sau D, không tên), counts, joinedAt, actions, không lý do (TC-03-59); Manager chỉ ACTIVE, không actions/inactive; Technician / Owner trại khác / INACTIVE / SUSPENDED / anonymous (TC-03-26, 61); Owner trại PENDING_PAYMENT/EXPIRED/SUSPENDED chỉ còn DEACTIVATE, Manager COM-12 (TC-03-60); đăng ký trại → joinedAt, đổi vai trò/ngưng/kích hoạt lại không đổi (TC-03-62); N+1 (TC-03-64) | HTTP + security chain + DB |
| `MembershipJoinedAtMigrationPostgresIT` (mới) | Nâng cấp từ schema UC4: audit MEMBER_ACCEPT, FARM_REGISTER sớm nhất, lời mời ACCEPTED khác hoa/thường, effective_date; NOT NULL; dữ liệu khác giữ nguyên (TC-03-63) | Migration PostgreSQL |
| `FarmAccessServiceTest` | `onlyTheOwnerReadsTheMembersOfAFarmThatIsNotActive`; ma trận và vòng trại không ACTIVE thêm VIEW_MEMBERS | Service |
| `FarmInvitationCommandResourceTest` | Chấp nhận lời mời → `joinedAt` = thời điểm chấp nhận | HTTP |
| `FarmMembershipServiceTest` | Lý do / ngày hiệu lực vẫn lưu ở membership; phản hồi có actions | Service |
| `BrowserSessionFlowIT` | A1 mới với cookie/CSRF: Owner counts/actions, Manager không `inactive`, không thao tác | HTTP luồng BE |
| `MembersPage.test.tsx` (mới, 8 ca) | Thứ tự, tab, mm/yyyy theo múi giờ trại, trại không ACTIVE, Manager, 20 dòng/trang, Xóa bộ lọc, Thử lại, nhớ tab theo trại, Table III-2 | Component |
| `memberListAdapter.test.ts` (mới, 3 ca) | Map đủ field, bỏ lý do, Manager không `inactive`, từ chối mảng cũ / thiếu joinedAt, actions, id | Adapter |
| `MemberPages`, `InviteDialog`, `backendIsolation`, `demoStore`, `workspaceSeed` | Chế độ mô phỏng và mock theo hợp đồng mới; bảng quyền khớp backend SCR-08 | Component / unit |
| `tests/api/growthBackendApi.test.ts` | FE-08 đọc A1 dạng `{items}` | Adapter (node:test) |

Chưa chụp RED trên code cũ trước khi sửa.

## Kết quả chạy mới — 14/11/2026

| Cổng | Kết quả |
|---|---|
| Frontend `tests/unit/farm-workspace`, `account`, `app` | **20/20 file PASS** (`VITE_BEEFCARE_DATA_SOURCE=local`) |
| `tests/api/growthBackendApi.test.ts` | **12/12 PASS** |
| Typecheck / build | **PASS / PASS** (cảnh báo chunk > 500 kB có từ trước) |
| Surefire (H2, `clean verify`) | **114/116**: FarmMemberList 8, Command 34, List 22, Transaction 11, Registration 9, WorkspaceService 9, Service 5, ResourceErrors 4, OpenAPI 1, FarmAccessService 10/11, LocalDevelopmentSeeder 1/2 |
| Failsafe (PostgreSQL 16.15) | **100/100 PASS**: FarmMemberListPostgresIT 8, MembershipJoinedAtMigrationPostgresIT 1, BrowserSessionFlowIT 18, FarmInvitationCommandPostgresIT 34, FarmInvitationListPostgresIT 22, FarmInvitationPostgresIT 11, PlatformJobsIT 6 |
| OpenAPI / catalog | Chỉ A1 và hai schema mới đổi; `openapi.json` JSON bằng bản export (giữ thứ tự `PageableObject` cũ): 229 path, 283 operation, 314 schema; `generate_api_catalog.py` chạy lại |

Hai lỗi Surefire có từ trước (baseline trước khi sửa cũng đỏ), không do UC5:
`FarmAccessServiceTest.roleMatrixEveryRow` và
`LocalDevelopmentSeederTest.everyLocalIdentityUsesTheExpectedFarmActionMatrix` kỳ vọng cũ
cho `VIEW_CARE_CATALOGUES` (FE-18 Q1 chưa chốt trong OPEN_QUESTIONS) và thiếu
`VIEW_FEED_STOCK` (FE-23). `VIEW_MEMBERS` khớp cho Owner/Manager trong cả hai test; quy
tắc Owner-only khi trại không ACTIVE có test riêng xanh.

Lệnh backend (từ `backend/`):

```powershell
mvn.cmd --batch-mode '-Pdev,!webapp' '-Dspotless.skip=true' '-Djacoco.skip=true' '-Dmodernizer.skip=true' '-Dapi.version=1.44' '-Duser.timezone=Asia/Ho_Chi_Minh' '-Dlogging.level.org.hibernate.SQL=OFF' '-Dmaven.test.failure.ignore=true' '-Dtest=FarmMemberListResourceTest,FarmAccessServiceTest,LocalDevelopmentSeederTest,FarmMembershipServiceTest,FarmInvitationCommandResourceTest,FarmInvitationListResourceTest,FarmInvitationTransactionTest,FarmMembershipResourceErrorsTest,FarmRegistrationResourceTest,FarmWorkspaceServiceTest,OpenApiContractTest' '-Dit.test=FarmMemberListPostgresIT,MembershipJoinedAtMigrationPostgresIT,BrowserSessionFlowIT,FarmInvitationCommandPostgresIT,FarmInvitationListPostgresIT,FarmInvitationPostgresIT,PlatformJobsIT' clean verify
```

## Runtime thủ công

`.run/fe03-uc05-runtime.mjs` (playwright-core có sẵn + Chrome, demo/mock, không phải
automated E2E). Ở 1180×820, 1440×900 và 390×844: Owner thấy 7 dòng theo tên, tab 7/2/3/1,
tab Đã ngưng có Kích hoạt lại, bảng quyền 17 dòng; Manager thấy 6 dòng ACTIVE, chỉ đọc,
không tab Đã ngưng / Mời / thao tác. Không tràn ngang, không JS exception; console chỉ có
404 favicon có từ trước. Ảnh ở `.run/fe03-uc05-runtime/`.

## Giới hạn và trạng thái

- **BE_REVIEWED trên nhánh, chưa READY_FOR_FE.** Chưa smoke browser → backend thật;
  migration mới chưa chạy trên DB dùng chung (chỉ trên schema Testcontainers và H2).
- Backfill dùng `effective_date` khi không có audit/lời mời: với membership đã đổi vai trò
  trước D29, tháng tham gia có thể là tháng của lần đổi cuối.
- Trên điện thoại, nhãn cột dạng thẻ là "Thành viên ↑/↓" (lấy từ tiêu đề có mũi tên sắp xếp).
- Popup UC6 vẫn dùng chữ "Ngừng hoạt động"; sửa cùng UC6.
- Spotless/JaCoCo/Modernizer bỏ qua như quy trình local; chưa chạy toàn bộ test của repository.

## File thay đổi

- Backend: `FarmAction` (VIEW_MEMBERS), `FarmAccessService`, `FarmMembership` (`joinedAt`),
  `FarmMembershipRepository` (entity graph), `FarmMembershipService` (A1, actions, joinedAt
  khi chấp nhận), `FarmWorkspaceService` (joinedAt Owner), `MembershipDtos`
  (`MemberView`, `MemberCounts`, `MemberList`), `FarmMembershipResource`, Liquibase
  `20261114000100_membership_joined_at.xml` + `master.xml`.
- Backend test: `FarmMemberListResourceTest`, `FarmMemberListPostgresIT`,
  `MembershipJoinedAtMigrationPostgresIT` (mới); `FarmAccessServiceTest`,
  `LocalDevelopmentSeederTest`, `FarmMembershipServiceTest`,
  `FarmInvitationCommandResourceTest`, `BrowserSessionFlowIT`.
- Frontend: `MembersPage`, `MemberTable`, `PermissionChecklist` (`PermissionTable`),
  `domain/rolePermissions`, `domain/members` (mới), `WorkspaceUi.formatMonth`,
  `InviteDialog`, `farmWorkspaceApi`, `types`, demo store/seed; test tương ứng.
- Tài liệu: D29, GBR-14 trong SRS 28/10, spec FE-03, `OPEN_QUESTIONS.md` (Q2),
  `docs/api/README.md`, `FE03_UC05_EXAMPLES.md`, `openapi.json`, `api-handoff.html`,
  file này.
