# Đối chiếu Figma Redesign với frontend và kế hoạch xây nốt — 02/11/2026

Thay thế phần "chưa có màn hình" của `FRONTEND_SCREEN_INVENTORY_2026-11-01.md`, vốn được khảo sát trước commit `3c2b917`.

**Cập nhật:** cả 256 frame đã có màn trên mock. Mục 2 và 3 mô tả lúc bắt đầu; trạng thái hiện tại, chỗ lệch với SRS và phần backend còn thiếu nằm ở mục 7 đến 11.

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

## 7. Trạng thái sau khi xây (cập nhật 02/11/2026)

Cả 15 phần đã có màn và nằm trên mock, không còn màn tạm. Chạy thử: `cd frontend && npm run dev:mock`, chọn vai trò ở trang đăng nhập.

| Phần | Frame | Trạng thái | Còn lệch |
| --- | --- | --- | --- |
| S1 Tổng quan, nhắc việc, thông báo, báo cáo | 12 | Xong | `/bao-cao` có RPT-01 đến RPT-07 theo SRS, frame vẽ 4 báo cáo |
| S2 Tăng trưởng, tiêm phòng | 13 | Xong | Ngày giờ ở màn ghi tiêm dùng ô của trình duyệt nên hiện theo ngôn ngữ máy |
| S3 Sức khỏe | 9 | Xong | Xem mục 8 về ngày hết ngưng thịt và đóng ca chết |
| S4 Danh mục | 6 | Xong | Xem mục 8 |
| S5 Gói dịch vụ | 16 | Xong | Mã QR là ảnh minh họa, có ghi rõ là demo |
| S6 Hỗ trợ, thông báo của tôi | 20 | 18 xong, 2 một phần | `2637:17815`, `2637:17930` hiển thị trên hộp thoại của TK-1031 vì TK-1042 đang "Đang xử lý" như frame danh sách |
| S7 CS, yêu cầu nội bộ | 28 | 25 xong, 3 chưa đủ | `2637:11824` nút về danh sách được giao vì PM/SA không mở được ticket CS; `2637:12135` dùng chung hộp thoại đóng; `2637:12570` gộp vào trang danh sách |
| S8 PM dịch vụ, đối soát, bảng giá | 23 | Xong | Hộp thoại cần bản ghi đã chọn sẽ lấy bản ghi đầu khi mở thẳng bằng URL |
| S9 PM biên nhận, thu chi, dòng tiền | 34 | 33 xong, 1 một phần | `2638:4239` báo cáo trên điện thoại dùng trang responsive, không có thanh riêng; xuất XLSX trên mock chỉ trả tên file |
| S10 SA | 6 | Xong | Danh sách `/nen-tang/quyen` tự thiết kế vì frame để trống |
| S11 Công khai, đăng nhập, hồ sơ, trại | 25 | 24 xong, 1 một phần | `2435:4352` theo SRS: không có số điện thoại, có xác nhận mật khẩu |
| S12 Đàn bò, chuồng | 17 | Xong phần lớn | Thiếu ô "Khai báo khi nhập", ảnh bò, ghi chú trong form cập nhật; chuồng A1 chỉ có 1 bò mẫu vì bò hiển thị phải có hồ sơ thật; chưa có "Thêm tiêu chí" ở form chuồng |
| S13 Nhập đàn, xuất đàn | 16 | 12 xong, 4 một phần | `2588:4785` thiếu ảnh bò, ngày sinh thay cho tuổi tháng; `2591:4403` thiếu quét QR và kết quả kiểm tra chỉ có sau khi lưu; `2592:4108` thiếu ô tải tệp; `2590:5356` thiếu icon bút chì |
| S14 Sinh sản | 17 | 10 xong, 6 một phần, 1 ở S12 | Dữ liệu mẫu 7 bò so với 42 của frame; huy hiệu "Đã phối – chờ khám" ở đầu hồ sơ chưa có; `2617:12067` quét QR thuộc S12 |
| S15 Thức ăn | 14 | 12 xong, 2 một phần | `2625:4117` mặc định ẩn khẩu phần đã ngừng theo SRS; `2627:4468` số liệu lấy từ dữ liệu mẫu nên khác frame |

Thay đổi dùng chung so với lúc bắt đầu:

- Đầu hồ sơ bò có icon và nút chính đổi theo tab. Nút ở tab tăng trưởng và sức khỏe mở hộp thoại, vì hai phần này không có trang ghi riêng; tab tiêm phòng mở trang ghi nhận.
- Menu trái sáng mục chăm sóc tương ứng khi đang ở tab chăm sóc của hồ sơ bò.
- `Table` với `wide` chỉ xếp thành thẻ khi khung dưới 720px (trước là 900px), nên màn 1180 vẫn là bảng.
- `Button` có sẵn khoảng cách giữa icon và chữ; `Info` nhận được React node; nút X của `Modal` không còn bị đầu hộp thoại che.
- `userFacingError` không còn coi "upload failed" là mất kết nối.

Mốc thời gian của mock khác nhau theo phần vì bám theo frame: tổng quan, sức khỏe, sinh sản là 20/10/2026; hỗ trợ, thông báo, SA là 18/10/2026; PM tài chính là 19/10/2026; nhập, xuất đàn là 22/10/2026. Thức ăn tính theo ngày thật nên ngày trên màn khác frame.

## 8. Figma khác SRS và cách đã xử lý

Theo SRS trừ khi ghi khác. Nhóm cần xác nhận các điểm này.

| Chủ đề | Figma | SRS | Đã làm |
| --- | --- | --- | --- |
| Hết ngưng thịt (`2613:4281`) | Liều đầu + 28 ngày: 17/11 | GBR-46: liều cuối + số ngày ngưng: 19/11 | SRS |
| Đóng ca chết | Bò rời đàn khi lưu | GBR-47, GBR-95: vẫn ACTIVE đến khi Chủ trại xác nhận | SRS |
| Cân xuất mục tiêu ở danh mục | Bắt buộc | Không bắt buộc | SRS |
| Ngày dự kiến ở tăng trưởng | 10/03/2027 | GBR-107: 04/03/2027 | SRS |
| Giới hạn thông báo trại | OpenAPI: tiêu đề 255, nội dung 10000 | Tiêu đề 150, nội dung 5000 | SRS |
| Thời hạn gói mặc định | Chọn sẵn 1 năm | Không có mặc định | SRS; `?term=1` ra đúng frame |
| Mã audit đổi vai trò | `MEMBERSHIP_PERMISSION_CHANGED` | `MEMBERSHIP_ROLE_CHANGED` | SRS, giữ nhãn của frame |
| Đăng ký tài khoản | Có số điện thoại, không xác nhận mật khẩu | Ngược lại | SRS |
| Xã/phường | Danh sách chọn | Ô nhập chữ | SRS |
| Bảng giá không tải được | Vẫn hiện giá tháng, % tiết kiệm | GBR-87: không được tự suy giá | SRS, ẩn cả hai |
| Chấp nhận mã gõ sai | "Chưa thể Chấp nhận" | GBR-72: được sau khi chọn đúng ứng viên duy nhất | Khóa đến khi PM chọn ứng viên |
| Trả ticket về hàng đợi | Về "Đang mở" | AF3: giữ trạng thái | SRS |
| Xuất đàn | Vẽ màn Chủ trại | GBR-07, GBR-94: chỉ Chủ trại | SRS, Quản lý chỉ xem |
| Giống bố | Luôn bắt buộc | Chỉ khi bố ngoài trại | SRS |
| Thẻ tai bê | Bắt buộc khi "Đăng ký ngay" | Không bắt buộc | **Figma** |
| Trạng thái "Sắp hết" của thức ăn | Tính cả khi đủ dưới 4 ngày | Tồn ≤ tối thiểu | **Figma** trên mock, SRS ở chế độ backend |
| Giá trị tồn kho | 38.450.000 đ | Tồn × giá bình quân: 28.247.000 đ | SRS |

## 9. Frame tự mâu thuẫn

- Mục menu tăng trưởng: tab 16, 17, 18 ghi "Cân nặng & thể trạng", một số frame tab 13 ghi "Tăng trưởng & thể vóc". Đã dùng "Cân nặng & thể trạng".
- Thứ tự tab hồ sơ của Kỹ thuật viên: tab 16 và tab 18 vẽ khác nhau. Đã theo tab 16.
- `2473:7619` không có yêu cầu đang chờ, trong khi `7788`, `7880`, `8047` cần BCF7K2Q9 đang chờ. Đã cho đang chờ. Biên nhận PM lại ghi mã này đã thanh toán.
- `2703:25000` ghi tên Ngô Minh Khang nhưng email và vai trò của Phạm Thu Hà. Đã dùng dữ liệu của Hà.
- `2637:15005` ghi loại của FR-0103, FR-0101 ngược với danh sách. Đã theo danh sách.
- `2473:8496` có 6 dòng nhưng bộ đếm 9/5/4. Đã thêm 3 thông báo cũ để số đếm đúng.
- `2705:1083` có dòng "đóng phân chuồng A2 / thẻ QR" chép từ phân hệ khác. Đã bỏ.
- TK-1025 chưa có người nhận nhưng có IR-081, trong khi SRS chỉ cho có yêu cầu nội bộ lúc ticket đang xử lý. Đã giữ như frame.

## 10. Backend còn thiếu

Mỗi phương thức API có chú thích route thật hoặc `// chưa có API`. Ở chế độ backend, các phần chưa nối sẽ báo lỗi rõ ràng và không dùng dữ liệu mock.

| Phần | Chưa có route | Thiếu trường hoặc sai mô tả |
| --- | --- | --- |
| Tổng quan, thông báo | Lựa chọn chuồng, tóm tắt trang chủ Kỹ thuật viên, lấy thông báo theo id, danh sách thành viên, xem trước công bố | `DraftRequest` chỉ có `recipientRoles`, frame cần người nhận đích danh |
| Tăng trưởng | Bộ lọc, lựa chọn form | Model `Page` và `Summary` trong OpenAPI giống của ticket hỗ trợ, cần kiểm tra lại |
| Tiêm phòng | Lựa chọn form, danh sách mũi, xem trước đối tượng và kế hoạch, ngữ cảnh ghi nhận | |
| Sức khỏe | Lựa chọn thuốc, thành viên, gợi ý chẩn đoán, phiếu chết chờ xác nhận, số đếm tab | Đóng ca chết hoặc mất phải tự tạo phiếu ở server |
| Danh mục | Lọc `q`, `status` cho vắc-xin và thuốc | `CatalogueItem` thiếu số lượng đang dùng; `ParameterVersionResult` thiếu `sourceNote`, `savedBy`, nội dung thay đổi; command thiếu `expectedVersion` |
| Gói dịch vụ | | Request cần `expectedPriceVersionId` (GBR-70); `PaymentDTO` thiếu `bankPaidAt`, `receivedAt`, `confirmedAt`; `SubscriptionOverview` thiếu tên trại, cờ và ngày tạm ngừng, các kỳ đã mua, số ngày còn lại; danh sách thanh toán thiếu lọc và sắp xếp |
| Hỗ trợ của Chủ trại | Danh sách trại cho form tạo ticket | `Message` thiếu `author`, `authorRole`, `createdAt`, `kind` |
| CS | Danh sách trại, CS, thông báo CS | `processing.action` chỉ khai báo là string, tên hành động đang là phỏng đoán |
| PM dịch vụ | `getEvidence`, bản nháp bảng giá, thu hồi bảng giá | |
| PM tài chính | Danh sách trại, danh sách và chi tiết biên nhận, báo cáo mới nhất | Tải XLSX chưa nối vì route trả về bytes |
| SA | Danh sách người thao tác audit, xuất CSV, kiểm tra lại khi mở thông báo, lọc theo vai trò nền tảng | `AccountSummary`, `AuditEntry` thiếu `emailVerified`, ngày tạo, đăng nhập gần nhất, số trại, vai trò người thao tác, nhãn đối tượng |
| Tài khoản, trại | | `POST /api/account/profile` mô tả thành `ProfileUpdate` có trường của bò, đang gửi `{ fullName, phone }` theo SCR-08; thiếu ngày tham gia, `invitedBy`, `farmId` của lời mời |
| Đàn bò | Ảnh bò | Kiểm tra chuyển chuồng không có kết quả theo từng tiêu chí |
| Nhập, xuất đàn | Ảnh, quét QR, số bê chờ xác nhận, gán bố mẹ cho bê, danh sách vắc-xin, giống, bò bố mẹ | `colourMarkings` gửi đi nhưng không đọc lại được |
| Sinh sản | Thành viên, bò đực, chuồng và giống, mục đích, ca sức khỏe, tra thẻ tai đã dùng | DTO sửa bản ghi phối thiếu bò đực, tinh, động dục liên kết. Route đã có nhưng màn chưa nối, đang báo chưa tích hợp |
| Thức ăn | Hủy phiên bản và ngừng khẩu phần, ghi trả nhà cung cấp, `GET /receipts/{id}` | Không có giờ cập nhật tồn kho. Tạo, sửa danh mục, kiểm kê, khẩu phần vẫn bị khóa ở chế độ backend |

## 11. Giới hạn của đợt kiểm tra

Chưa chạy với backend thật: mọi kiểm tra đều trên mock và test có giả lập transport.

Lần kiểm tra trên trình duyệt mở 260 khung nhìn của mọi vai trò ở 1440x900, 1180x820 và 390x844, tự phát hiện lỗi console, request hỏng, tràn ngang, màn tạm, bảng vỡ thành thẻ và mã bị xuống dòng. Lần này không so sánh hình ảnh với Figma. Việc so ảnh do từng phần tự làm trên các màn chính; một số trạng thái lỗi và hộp thoại chỉ có test. Các frame sau chỉ đối chiếu qua code: `2591:4780`, `2592:4672`, `2592:4997`, `2617:10722`, `2617:11533`, `2705:593`.

Test viết trước code không được làm đều ở mọi phần: S1, S4, S5, S8, S12, S15 viết test cùng lúc hoặc sau code. Một số test cũ được sửa cho đúng chữ và bố cục mới của Figma; không có test nào bị xóa hoặc bỏ qua.
