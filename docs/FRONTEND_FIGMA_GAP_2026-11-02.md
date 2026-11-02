# Đối chiếu Figma Redesign với frontend và kế hoạch xây nốt — 02/11/2026

Thay thế phần "chưa có màn hình" của `FRONTEND_SCREEN_INVENTORY_2026-11-01.md`, vốn được khảo sát trước commit `3c2b917`.

## 1. Nguồn đã đối chiếu

- **Figma:** [BEEFCARE-1](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ/BEEFCARE-1), đọc trực tiếp bằng script chỉ đọc. Lưu ý các tài liệu cũ trỏ tới bản sao `BmFA2ndWI434UHS38zRr3A`.
- **Layout:** chỉ tab 12, 13, 15, 16, 17, 18, 19, 21, 22 (Redesign). File không có tab 14 và 20.
- **Icon:** tab 00, section `Icons · Tabler (BeefCare)` (77 icon) và `zebu/silhouette`, cộng `icon/home` cho thanh dưới điện thoại vì bộ Tabler không có. Các frame Redesign không dùng component nào khác của bộ icon cũ.
- **Logo:** giữ nguyên như layout (`assets/logo.png`), không lấy từ tab 00.
- **Màu:** bảng màu xanh đã có trong `index.css` khớp với frame Redesign. Biến Figma "BeefCare Zebu" (tông đỏ) là bản cũ, không dùng.
- **Code:** nhánh `fe/fe23-feed-stock`, commit `3c2b917`.
- **Nghiệp vụ:** `docs/requirements/SRS_2026-10-28.txt` (bảng 5.1-1, 5.1-2), `docs/REQUIREMENT_DECISIONS.md`, `docs/api/openapi.json`.

"Đã có code" chỉ nghĩa là tìm thấy route, trang hoặc hộp thoại tương ứng, chưa chứng minh khớp từng điểm ảnh hay đủ nghiệp vụ.

## 2. Kết quả so sánh

Tổng 256 frame trên 9 tab Redesign.

| Tab | Frame | Hiện trạng trước đợt này | Còn phải làm |
| --- | --- | --- | --- |
| 12 Guest | 11 | Có trang công khai và 9 màn xác thực trong `GuestAuthFlow` | Đối chiếu lại; trang công khai trên điện thoại |
| 13 Chủ trại | 38 | Có chọn/đăng ký trại, thông tin trại, thành viên, lời mời (11 frame) | Thiếu hồ sơ & đổi mật khẩu, toàn bộ gói dịch vụ (14) và hỗ trợ (12) |
| 15 Tổng quan | 12 | Chưa có | Làm mới toàn bộ |
| 16 Đàn bò | 33 | Có đàn bò, hồ sơ, nhập, xuất, chuồng | Đối chiếu lại; thiếu quét QR và 4 màn Kỹ thuật viên |
| 17 Chăm sóc | 22 | Chưa có (tab hồ sơ bò là chỗ chờ) | Làm mới toàn bộ |
| 18 Sinh sản | 17 | Có danh sách, tab hồ sơ, hộp thoại, ghi đẻ | Đối chiếu lại; thiếu lỗi trùng thẻ tai và 4 màn Kỹ thuật viên |
| 19 Danh mục | 6 | Chưa có | Làm mới toàn bộ |
| 21 Thức ăn | 14 | Có gần đủ | Đối chiếu lại; thiếu hủy phiếu nhập kho, kiểm tra chi tiết đã ghi |
| 22 Nền tảng | 103 | Chưa có | Làm mới toàn bộ (`⑧` thuộc gói dịch vụ và hỗ trợ, `⑨` thuộc trang công khai) |

Phát hiện khác trong code:

- `herd-entry/api/herdEntryApi.ts` đặt cứng `usingBackend = true`, nên `herdEntryLocalApi.ts` không được dùng và màn Nhập đàn vẫn gọi backend khi chạy mock.
- `data/store.tsx` gọi API phiếu nhập ngay khi mở app, kể cả với khách; không còn màn nào dùng nên đã gỡ.
- `Layout` trước đây dùng ô vuông giữ chỗ cho icon, đặt cứng tên người dùng và chỉ có menu Chủ trại/Quản lý.

### Lỗi test có từ trước

Đo trên `3c2b917`, chưa sửa gì: Vitest 37/271 lỗi, `test:api` 15/100 lỗi; typecheck và build đạt. Lỗi tập trung ở `tests/unit/cattle`, `tests/unit/herd-entry`, `tests/unit/herd-exit`, `tests/integration/herd-*`, `tests/integration/auth`, và các test API còn giả định phiếu nhập chạy cục bộ.

## 3. Điểm lệch cần nhóm xác nhận

| Điểm | Figma | SRS | Xử lý tạm |
| --- | --- | --- | --- |
| Thanh dưới Kỹ thuật viên | Trang chủ, Đàn bò, Quét QR, Sinh sản, Thức ăn, Tài khoản | Có "Announcements", không có "Tài khoản" (bảng 5.1-1) | Theo Figma; thông báo mở từ trang chủ |
| Icon thanh dưới điện thoại | Ký tự tạm (B, R, A...) | Không quy định | Dùng icon tab 00 đúng nhãn |
| Nút thông báo trên topbar | Ký tự "•" | Không quy định | Dùng icon `bell` |
| Sidebar SA | Có "Quyền nhân sự nền tảng" | SCR-16 coi đây là popup của Tài khoản người dùng | Theo Figma, có mục riêng |

## 4. Quy ước xây màn hình

**Cấu trúc feature** (giống `reproduction`, `farm-workspace`):

```text
frontend/src/features/<feature>/
  index.ts                   lazy loader và export công khai (đã có sẵn, giữ tên cũ)
  types.ts                   kiểu dữ liệu, đặt tên trường theo DTO trong OpenAPI khi có
  api/<feature>Api.ts        interface + create<Feature>Api({ mode, farmId, transport, store })
  data/<feature>Mock.ts      dữ liệu mẫu, lấy từ nội dung frame Figma
  data/<feature>DemoStore.ts store trong bộ nhớ, có reset(), áp đúng quy tắc nghiệp vụ
  domain/ hoặc validation.ts quy tắc thuần, dễ test
  components/, pages/
frontend/tests/unit/<feature>/
```

**Để nối API sau này:**

- Mọi màn hình chỉ gọi qua `api/<feature>Api.ts`, không import thẳng store hay mock.
- Mỗi method có một dòng chú thích route backend sẽ gọi, ví dụ `// GET /api/farms/{farmId}/reminders`. Route phải có thật trong OpenAPI; nếu chưa có thì ghi `// chưa có API` và liệt kê trong báo cáo.
- Khi `mode === 'backend'`: ném `backendPending('<tên>')` từ `api/backendPending.ts`, tuyệt đối không rơi về mock. Nối API sau chỉ cần thay nhánh này.
- Lệnh ghi giữ `expectedVersion` trong kiểu dữ liệu theo DTO; `Idempotency-Key` do transport xử lý khi nối thật.
- Không ghi mock vào `localStorage`. Mã, ID, tổng tiền, tồn kho chỉ nằm trong mock/store, không nằm trong page.

**Giao diện:**

- Dùng `components/Layout`, `TechnicianLayout`, `Modal`, `ui.tsx`, `Icon`. Không tự vẽ lại shell.
- Dịch frame sang layout linh hoạt (flex/grid), không dùng tọa độ tuyệt đối; không tràn ngang ở `1440x900` và `1180x820`; frame điện thoại kiểm tra ở `390x844`.
- Ký tự giữ chỗ như `▾ ⌕ ⇪ •` đổi sang icon trong `components/Icon.tsx`.
- Hộp thoại mở bằng `useModalParam()` (`?m=<tên>`) để xem trực tiếp được.
- Frame trạng thái (rỗng, lỗi, đã hết hạn...) phải xem được trong mock: tạo bằng dữ liệu mẫu thật nếu được, không thì qua `useDemoState()` (`?demo=<tên>`).
- Dòng ghi chú màu xám cuối frame ("Screen purpose") giữ lại bằng `Foot` như các trang đã có.
- Mỗi màn có đủ trạng thái đang tải, rỗng, lỗi (`LoadingBlock`, `EmptyBlock`, `ErrorBlock`) và tắt nút khi không đủ quyền.
- Vai trò lấy bằng `useSession()`. Trả về `null` khi render ngoài phiên (test), nên phải có giá trị mặc định.

**Chạy thử:** `npm run dev:mock`, đăng nhập bằng nút vai trò trên màn đăng nhập.

## 5. Test

| Kiểm tra gì | Ở đâu | Vì sao |
| --- | --- | --- |
| Quy tắc nghiệp vụ, kiểm tra dữ liệu, chuyển trạng thái của store | `tests/unit/<feature>/<feature>Api.test.ts` | Mock phải đúng nghiệp vụ SRS để sau này thay bằng API mà màn hình không đổi hành vi |
| Backend mode không chạm vào mock | cùng file | Quy định không fallback âm thầm trong `RTK.md` |
| Luồng chính của màn hình, hộp thoại, phân quyền theo vai trò, trạng thái lỗi/rỗng | `tests/unit/<feature>/<Feature>Pages.test.tsx` | Bảo vệ hành vi người dùng thấy |
| Mọi route đều tải được, không còn màn chờ | `tests/unit/app/AppRoutes.test.tsx` | Chống bỏ sót khi gộp |

Viết test quy tắc trước, thấy nó đỏ đúng lý do rồi mới code. Không test chi tiết hiển thị vụn vặt.

## 6. Phân việc

Mỗi phần có một Sonnet, một worktree và một nhánh riêng, chỉ sửa trong thư mục feature của mình và `tests/unit/<feature>`. `App.tsx`, `Layout`, `TechnicianLayout`, `Modal`, `ui.tsx`, `Icon` và `index.css` do người điều phối giữ.

Page id: 12 `2435:4108`, 13 `2473:6720`, 15 `2455:4108`, 16 `2566:6698`, 17 `2608:4108`, 18 `2616:4108`, 19 `2619:4322`, 21 `2621:4108`, 22 `2628:4108`.

### S1 — Tổng quan, nhắc việc, thông báo trại, báo cáo (`farm-overview`, `farm-announcements`)

FE-07, FE-14, FE-15 · SCR-26–28, 44, 48, 49, 74 · OpenAPI: `farm-dashboard-resource`, `farm-reminder-resource`, `farm-announcements-resource`.
Route: `/tong-quan`, `/nhac-viec`, `/bao-cao`, `/thong-bao/*`, `/kt`, `/kt/nhac-viec`, `/kt/thong-bao/*`.
Tab 15: `2455:4110` Tổng quan, `2696:296` Tổng quan trại mới, `2455:4111` Nhắc việc, `2594:4108` Thông báo danh sách & chi tiết, `2594:4289` Soạn, `2594:4455` Xem lại trước khi đăng, `2594:4654` Đính chính, `2595:4108` Báo cáo quản lý, `2595:4365` KTV trang chủ, `2595:4450` KTV thông báo, `2595:4502` KTV chi tiết thông báo, `2595:4538` KTV nhắc việc.

### S2 — Tăng trưởng và tiêm phòng (`growth`, `vaccination`)

FE-08, FE-09 · SCR-29–35 · OpenAPI: `growth-overview-resource`, `growth-assessment-resource`, `vaccination-command-resource`, `vaccination-record-command-resource`.
Route: `/can-nang/*`, `/tiem-phong/*`; tab hồ sơ bò `GrowthProfileTab`, `VaccinationProfileTab`, `GrowthTechnicianTab`, `VaccinationTechnicianTab`.
Tab 17: `2608:4109`, `2608:4413`, `2608:4734`, `2608:4941`, `2609:4108`, `2609:4387`, `2609:4640`, `2611:4108`, `2611:4368`, `2611:4528`, `2611:4773`, `2615:4108`, `2615:4192`.

### S3 — Sức khỏe và điều trị (`health`)

FE-10 · SCR-36, 37 · OpenAPI: `health-care-command-resource`, `health-record-command-resource`.
Route: `/suc-khoe/*`; `HealthProfileTab`, `HealthTechnicianTab`.
Tab 17: `2612:4108`, `2612:4396`, `2612:4637`, `2613:4108`, `2613:4281`, `2613:4468`, `2613:4648`, `2706:292` (nằm trong nhóm tiêm phòng nhưng là bản ghi điều trị), `2615:4273`.

### S4 — Danh mục và tham số (`farm-catalogue`)

FE-18 · SCR-52–56 · OpenAPI: `herd-catalogue-resource`, `care-catalogue-command-resource`, `farm-parameter-command-resource`.
Route: `/danh-muc/*`.
Tab 19: `2619:4353`, `2619:4588`, `2620:4118`, `2620:4370`, `2620:9976`, `2620:10256`.

### S5 — Gói dịch vụ của trại (`subscription`)

FE-19 · SCR-57–60 · OpenAPI: `subscription-payment-resource`, `public-landing-resource` (giá).
Route: `/goi-dich-vu/*`, `/dang-ky-goi`.
Tab 13: `2473:6931`, `2473:7619`, `2473:7709`, `2473:7788`, `2473:7880`, `2473:7955`, `2473:8012`, `2473:8047`, `2473:8079`, `2473:8104`, `2473:8132`, `2473:8159`, `2473:8179`, `2473:8207`. Tab 22: `2637:18409`, `2638:4108`.

### S6 — Hỗ trợ của chủ trại và thông báo của tôi (`support`, `notifications`)

FE-20, FE-14 · SCR-45, 64–66 · OpenAPI: `owner-support-resource`, `notification-resource`.
Route: `/ho-tro/*`, `/thong-bao-cua-toi`.
Tab 13: `2473:8231`, `2473:8313`, `2473:8381`, `2473:8472`, `2473:8496`, `2473:8556`, `2473:8590`, `2473:8661`, `2473:8696`, `2473:8730`, `2473:8749`, `2473:8793`. Tab 22: `2637:17815`, `2637:17930`, `2637:18045`, `2637:18158`, `2637:18271`, `2637:18319`, `2637:18365`, `2638:4175`.

### S7 — CS và yêu cầu nội bộ (`platform-support`)

FE-20 · SCR-46, 67–69 · OpenAPI: `cs-support-resource`, `assigned-internal-support-resource`.
Route: `/nen-tang/ho-tro` (hàng đợi), `/nen-tang/ho-tro/duoc-giao`, `/nen-tang/ho-tro/thong-bao`, `/nen-tang/ho-tro/:id`, `/nen-tang/yeu-cau/*` (PM và SA).
Tab 22: `2628:4109`, `2629:4112`, `2629:4354`, `2629:4510`, `2632:4108`, `2636:4109`, `2637:10049`, `2637:10191`, `2637:10333`, `2637:10471`, `2637:10610`, `2637:10750`, `2637:10903`, `2637:11054`, `2637:11196`, `2637:11334`, `2637:11500`, `2637:11662`, `2637:11824`, `2637:11993`, `2637:12135`, `2637:12289`, `2637:12434`, `2637:12570`, `2637:12722`, `2637:12871`, `2637:13019`, `2637:13171`.

### S8 — PM: dịch vụ, gói đăng ký, đối soát, bảng giá (`platform-service`)

FE-02, FE-19 · SCR-12, 61–63 · OpenAPI: `platform-farm-resource`, `platform-subscription-resource`, `platform-payment-resource`, `platform-plan-price-resource`.
Route: `/nen-tang/dich-vu/*`, `/nen-tang/goi-dang-ky/*`, `/nen-tang/thanh-toan/*`, `/nen-tang/bang-gia/*`.
Tab 22: `2630:4110`, `2630:4398`, `2630:4580`, `2631:4108`, `2631:4451`, `2637:4108`, `2637:4288`, `2637:4462`, `2637:4628`, `2637:4805`, `2637:4967`, `2637:8037`, `2637:8201`, `2637:8380`, `2637:8551`, `2637:8717`, `2637:8886`, `2637:9052`, `2637:9226`, `2637:9392`, `2637:9558`, `2637:9721`, `2637:9885`.

### S9 — PM: biên nhận, thu chi, báo cáo dòng tiền, thông báo (`platform-finance`)

FE-21, FE-14 · SCR-46, 47, 70–73 · OpenAPI: `platform-finance-resource`, `notification-resource`.
Route: `/nen-tang/bien-nhan/*`, `/nen-tang/thu-chi/*`, `/nen-tang/bao-cao-dong-tien/*`, `/nen-tang/thong-bao-doi-soat`, `/nen-tang/thong-bao-ho-tro`.
Tab 22: `2632:4322`, `2632:4605`, `2632:4907`, `2633:4110`, `2633:4431`, `2633:4623`, `2637:13316`, `2637:13486`, `2637:13648`, `2637:13813`, `2637:13967`, `2637:14138`, `2637:14313`, `2637:14475`, `2637:14649`, `2637:14826`, `2637:15005`, `2637:15183`, `2637:15359`, `2637:15526`, `2637:15680`, `2637:15848`, `2637:16000`, `2637:16154`, `2637:16306`, `2637:16458`, `2637:16633`, `2637:16807`, `2637:16969`, `2637:17143`, `2637:17312`, `2637:17481`, `2637:17649`, `2638:4239`.

### S10 — SA: tài khoản, quyền nhân sự, audit, thông báo (`platform-admin`)

FE-03, FE-14, FE-17 · SCR-16, 46, 51 · OpenAPI: `platform-account-administration-resource`, `platform-audit-resource`, `notification-resource`.
Route: `/nen-tang/tai-khoan/*`, `/nen-tang/quyen/*`, `/nen-tang/audit/*`, `/nen-tang/thong-bao`.
Tab 22: `2635:4108`, `2703:24734`, `2635:4397`, `2703:25000`, `2635:4564`, `2636:4309`.

### S11 — Công khai, xác thực, hồ sơ, trại & thành viên (`authentication`, `account`, `farm-workspace`)

FE-01, FE-02, FE-03, FE-22 · SCR-01–11, 13–15 · OpenAPI: `public-landing-resource`, `account-resource`, `authenticate-controller`, `farm-workspace-resource`, `farm-membership-resource`.
Route: các route của `GuestAuthFlow`, `/ho-so`, `/kt/tai-khoan`, `/nen-tang/ho-so`, `/owner-registration`, `/chon-trai`, `/dang-ky-trai`, `/thong-tin-trai`, `/thanh-vien`, `/loi-moi`, `/chap-nhan-loi-moi`.
Tab 12: `2435:4110`, `2435:4267`, `2435:4317`, `2435:4352`, `2435:4393`, `2435:4409`, `2435:4426`, `2435:4441`, `2435:4465`, `2435:4479`, `2435:4515`. Tab 22: `2638:4310`, `2638:4453`. Tab 13: `2473:6722`, `2473:6823`, `2473:6863`, `2473:7002`, `2473:7106`, `2473:7245`, `2473:7293`, `2473:7337`, `2473:7384`, `2473:7443`, `2473:7479`, `2473:7576`.

### S12 — Đàn bò và chuồng (`cattle`, `pen-management`)

FE-04, FE-05, FE-16 · SCR-17–22, 50 · OpenAPI: `cattle-profile-resource`, `pen-resource`, `pen-move-resource`.
Route: `/cattle`, `/cattle/:code`, `/pens`, `/quet-qr`, `/kt/quet-qr`, `/kt/dan-bo/*`. Ô tìm trên topbar đưa tới `/cattle?q=`.
Tab 16: `2584:4108`, `2584:4399`, `2586:4108`, `2586:4275`, `2586:4435`, `2586:4630`, `2586:4842`, `2586:5038`, `2705:1606`, `2705:2089`, `2587:4108`, `2587:4420`, `2587:4806`, `2587:5163`, `2587:5253`, `2587:5300`, `2587:5402`.
Sửa cả lỗi test có từ trước trong `tests/unit/cattle` và `tests/unit/pens`.

### S13 — Nhập đàn và xuất đàn (`herd-entry`, `herd-exit`)

FE-06, FE-13 · SCR-23–25, 41–43, 75, 76 · OpenAPI: `herd-entry-voucher-resource`, `herd-entry-resource`, `herd-exit-voucher-resource`, `voucher-payment-resource`, `trading-partner-resource`.
Route: `/herd-entry*`, `/herd-exit*`.
Tab 16: `2588:4108`, `2588:4435`, `2588:4785`, `2588:5295`, `2590:4108`, `2590:4374`, `2590:4667`, `2590:5022`, `2590:5356`, `2591:4108`, `2591:4403`, `2591:4780`, `2592:4108`, `2592:4374`, `2592:4672`, `2592:4997`.
Thêm chế độ mock tường minh cho Nhập đàn. Sửa lỗi test có từ trước trong `tests/unit/herd-entry`, `tests/unit/herd-exit`, `tests/integration/herd-*`, và các test API liên quan.

### S14 — Sinh sản (`reproduction`)

FE-11, FE-12 · SCR-38–40 · OpenAPI: `reproduction-command-resource`.
Route: `/sinh-san`, `/cattle/:code/sinh-san/de`, `/kt/sinh-san`; `ReproductionProfileTab`, `ReproductionTechnicianTab`.
Tab 18: `2616:4109`, `2616:4352`, `2616:4658`, `2617:4108`, `2617:4335`, `2617:9912`, `2617:10201`, `2617:10399`, `2617:10722`, `2617:10907`, `2617:11217`, `2617:11533`, `2617:11767`, `2617:11996`, `2617:12067`, `2617:12112`, `2617:12205`.

### S15 — Thức ăn (`feed-stock`)

FE-23 · SCR-77–86 · OpenAPI: `feed-management-resource`, `feed-attachment-resource`.
Route: `/thuc-an*`, `/kt/thuc-an`.
Tab 21: `2621:4113`, `2621:4459`, `2623:4108`, `2623:4482`, `2705:593`, `2705:1083`, `2625:4117`, `2625:4400`, `2626:4112`, `2626:4493`, `2626:4719`, `2627:4110`, `2627:4468`, `2627:4756`.
