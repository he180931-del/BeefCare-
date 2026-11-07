# Figma Redesign và giao diện frontend

Gộp ngày 07/11/2026 từ hai tài liệu cũ: kiểm kê frame Figma Redesign (01/11) và đối chiếu Figma với frontend (02/11). Phần backend còn thiếu đã chuyển sang `docs/requirements/specs/MISSING_ROUTES.md`; các chỗ FE theo Figma thay vì SRS đã thành câu hỏi trong `docs/requirements/specs/OPEN_QUESTIONS.md`. Nguồn nghiệp vụ vẫn là SRS 28/10 và bộ spec (D12); Figma chỉ quyết định bố cục và tương tác.

## 1. Nguồn Figma

- **File đúng:** [BEEFCARE-1](https://www.figma.com/design/9hM1MaI4UmWZP9CDJauxLJ/BEEFCARE-1). Bản sao `BmFA2ndWI434UHS38zRr3A` là bản cũ mà các tài liệu trước đây trỏ tới.
- **Chỉ dùng 9 tab Redesign:** 12, 13, 15, 16, 17, 18, 19, 21, 22, tổng 256 frame. File không có tab 14 và 20. Tab 01–11 là màn cũ hoặc lưu trữ, không dùng làm căn cứ thiết kế.
- **Icon:** tab 00, section `Icons · Tabler (BeefCare)` (77 icon) và `zebu/silhouette`, cộng `icon/home` cho thanh dưới điện thoại vì bộ Tabler không có. Các frame Redesign không dùng component nào khác của bộ icon cũ.
- **Logo:** giữ như layout (`assets/logo.png`), không lấy từ tab 00.
- **Màu:** bảng màu xanh trong `frontend/src/index.css` khớp frame Redesign. Biến Figma "BeefCare Zebu" (tông đỏ) là bản cũ, không dùng.

"Đã có code" chỉ nghĩa là tìm thấy route, trang hoặc hộp thoại tương ứng, chưa chứng minh khớp từng điểm ảnh hay đủ nghiệp vụ.

## 2. Tab Redesign

| Tab | Page id | Nhóm frame |
|---|---|---|
| 12 Guest – Công khai & Đăng nhập | `2435:4108` | Trang công khai (FE-22); đăng nhập, đăng ký, khôi phục mật khẩu (FE-01) |
| 13 Chủ trại – Trại & Thành viên | `2473:6720` | Hồ sơ, đăng ký trại, chọn trại (FE-01, FE-02, FE-19); thành viên, lời mời, hồ sơ cá nhân (FE-03, FE-01); gói dịch vụ và trạng thái thanh toán (FE-19); phiếu hỗ trợ và thông báo (FE-20) |
| 15 Trại – Tổng quan & Nhắc việc | `2455:4108` | Tổng quan, nhắc việc (FE-15, FE-14); thông báo trại (FE-07); báo cáo quản lý (FE-15); Technician: trang chủ, thông báo, nhắc việc |
| 16 Trại – Đàn bò, Nhập/Xuất & Chuồng | `2566:6698` | Đàn bò và hồ sơ cá thể (FE-05, FE-16, FE-04); nhập đàn (FE-06); chuồng (FE-04); xuất đàn (FE-13); Technician: đàn bò, hồ sơ bò |
| 17 Trại – Tăng trưởng, Tiêm phòng & Sức khỏe | `2608:4108` | Tăng trưởng & BCS (FE-08); tiêm phòng (FE-09); sức khỏe & điều trị (FE-10); Technician: các tab chăm sóc trong hồ sơ bò |
| 18 Trại – Sinh sản | `2616:4108` | Danh sách theo dõi; động dục, phối giống (FE-11); khám thai, mang thai, đẻ và kết quả bê (FE-12); Technician: chỉ xem, quét QR |
| 19 Trại – Danh mục & Tham số | `2619:4322` | Giống, vắc-xin, thuốc, mục đích nuôi; tham số trạng thái và nhắc việc (FE-18) |
| 21 Trại – Quản lý thức ăn | `2621:4108` | Tồn kho, phiếu nhập, kiểm kê; khẩu phần; nhật ký cho ăn; danh mục và báo cáo (FE-23); Technician: khẩu phần hôm nay |
| 22 Nền tảng – CS, PM, SA | `2628:4108` | CS; PM dịch vụ, gói, đối soát, bảng giá; PM yêu cầu nội bộ, biên nhận, thu chi; SA tài khoản, quyền, audit; các hộp thoại; màn điện thoại của Chủ trại; trang công khai khi bảng giá chưa khả dụng |

## 3. Phần màn hình, thư mục feature và frame

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

### S13 — Nhập đàn và xuất đàn (`herd-entry`, `herd-exit`)

FE-06, FE-13 · SCR-23–25, 41–43, 75, 76 · OpenAPI: `herd-entry-voucher-resource`, `herd-entry-resource`, `herd-exit-voucher-resource`, `voucher-payment-resource`, `trading-partner-resource`.
Route: `/herd-entry*`, `/herd-exit*`.
Tab 16: `2588:4108`, `2588:4435`, `2588:4785`, `2588:5295`, `2590:4108`, `2590:4374`, `2590:4667`, `2590:5022`, `2590:5356`, `2591:4108`, `2591:4403`, `2591:4780`, `2592:4108`, `2592:4374`, `2592:4672`, `2592:4997`.

### S14 — Sinh sản (`reproduction`)

FE-11, FE-12 · SCR-38–40 · OpenAPI: `reproduction-command-resource`.
Route: `/sinh-san`, `/cattle/:code/sinh-san/de`, `/kt/sinh-san`; `ReproductionProfileTab`, `ReproductionTechnicianTab`.
Tab 18: `2616:4109`, `2616:4352`, `2616:4658`, `2617:4108`, `2617:4335`, `2617:9912`, `2617:10201`, `2617:10399`, `2617:10722`, `2617:10907`, `2617:11217`, `2617:11533`, `2617:11767`, `2617:11996`, `2617:12067`, `2617:12112`, `2617:12205`.

### S15 — Thức ăn (`feed-stock`)

FE-23 · SCR-77–86 · OpenAPI: `feed-management-resource`, `feed-attachment-resource`.
Route: `/thuc-an*`, `/kt/thuc-an`.
Tab 21: `2621:4113`, `2621:4459`, `2623:4108`, `2623:4482`, `2705:593`, `2705:1083`, `2625:4117`, `2625:4400`, `2626:4112`, `2626:4493`, `2626:4719`, `2627:4110`, `2627:4468`, `2627:4756`.

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

### Test cho màn mới

| Kiểm tra gì | Ở đâu | Vì sao |
| --- | --- | --- |
| Quy tắc nghiệp vụ, kiểm tra dữ liệu, chuyển trạng thái của store | `tests/unit/<feature>/<feature>Api.test.ts` | Mock phải đúng nghiệp vụ SRS để sau này thay bằng API mà màn hình không đổi hành vi |
| Backend mode không chạm vào mock | cùng file | Quy định không fallback âm thầm trong `RTK.md` |
| Luồng chính của màn hình, hộp thoại, phân quyền theo vai trò, trạng thái lỗi/rỗng | `tests/unit/<feature>/<Feature>Pages.test.tsx` | Bảo vệ hành vi người dùng thấy |
| Mọi route đều tải được, không còn màn chờ | `tests/unit/app/AppRoutes.test.tsx` | Chống bỏ sót khi gộp |

Viết test quy tắc trước, thấy nó đỏ đúng lý do rồi mới code. Không test chi tiết hiển thị vụn vặt.

## 5. Trạng thái màn hình (cập nhật 02/11/2026)

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

Mốc thời gian của mock khác nhau theo phần vì bám theo frame: tổng quan, sức khỏe, sinh sản là 20/10/2026; hỗ trợ, thông báo, SA là 18/10/2026; PM tài chính là 19/10/2026; nhập, xuất đàn là 22/10/2026. Thức ăn tính theo ngày thật nên ngày trên màn khác frame.

## 6. Figma khác SRS và cách đã xử lý

Theo SRS trừ khi ghi khác. Các dòng FE đang theo Figma chờ chốt trong `OPEN_QUESTIONS.md`.

| Chủ đề | Figma | SRS | Đã làm |
| --- | --- | --- | --- |
| Thanh dưới Kỹ thuật viên | Trang chủ, Đàn bò, Quét QR, Sinh sản, Thức ăn, Tài khoản | Có "Announcements", không có "Tài khoản" (bảng 5.1-1) | Theo Figma; thông báo mở từ trang chủ (chờ chốt: `OPEN_QUESTIONS.md` FE-14 Q6) |
| Icon thanh dưới điện thoại | Ký tự tạm (B, R, A...) | Không quy định | Dùng icon tab 00 đúng nhãn |
| Nút thông báo trên topbar | Ký tự "•" | Không quy định | Dùng icon `bell` |
| Sidebar SA | Có "Quyền nhân sự nền tảng" | SCR-16 coi đây là popup của Tài khoản người dùng | Theo Figma, có mục riêng (chờ chốt: `OPEN_QUESTIONS.md` FE-03 Q5) |
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
| Thẻ tai bê | Bắt buộc khi "Đăng ký ngay" | Không bắt buộc | **Figma** (chờ chốt: `OPEN_QUESTIONS.md` FE-12 Q5) |
| Trạng thái "Sắp hết" của thức ăn | Tính cả khi đủ dưới 4 ngày | Tồn ≤ tối thiểu | **Figma** trên mock, SRS ở chế độ backend (chờ chốt: `OPEN_QUESTIONS.md` FE-23 Q12) |
| Giá trị tồn kho | 38.450.000 đ | Tồn × giá bình quân: 28.247.000 đ | SRS |

## 7. Frame tự mâu thuẫn

- Mục menu tăng trưởng: tab 16, 17, 18 ghi "Cân nặng & thể trạng", một số frame tab 13 ghi "Tăng trưởng & thể vóc". Đã dùng "Cân nặng & thể trạng".
- Thứ tự tab hồ sơ của Kỹ thuật viên: tab 16 và tab 18 vẽ khác nhau. Đã theo tab 16.
- `2473:7619` không có yêu cầu đang chờ, trong khi `7788`, `7880`, `8047` cần BCF7K2Q9 đang chờ. Đã cho đang chờ. Biên nhận PM lại ghi mã này đã thanh toán.
- `2703:25000` ghi tên Ngô Minh Khang nhưng email và vai trò của Phạm Thu Hà. Đã dùng dữ liệu của Hà.
- `2637:15005` ghi loại của FR-0103, FR-0101 ngược với danh sách. Đã theo danh sách.
- `2473:8496` có 6 dòng nhưng bộ đếm 9/5/4. Đã thêm 3 thông báo cũ để số đếm đúng.
- `2705:1083` có dòng "đóng phân chuồng A2 / thẻ QR" chép từ phân hệ khác. Đã bỏ.
- TK-1025 chưa có người nhận nhưng có IR-081, trong khi SRS chỉ cho có yêu cầu nội bộ lúc ticket đang xử lý. Đã giữ như frame.

## 8. Giới hạn của đợt kiểm tra

Chưa chạy với backend thật: mọi kiểm tra đều trên mock và test có giả lập transport.

Lần kiểm tra trên trình duyệt mở 260 khung nhìn của mọi vai trò ở 1440x900, 1180x820 và 390x844, tự phát hiện lỗi console, request hỏng, tràn ngang, màn tạm, bảng vỡ thành thẻ và mã bị xuống dòng. Lần này không so sánh hình ảnh với Figma. Việc so ảnh do từng phần tự làm trên các màn chính; một số trạng thái lỗi và hộp thoại chỉ có test. Các frame sau chỉ đối chiếu qua code: `2591:4780`, `2592:4672`, `2592:4997`, `2617:10722`, `2617:11533`, `2705:593`.

Test viết trước code không được làm đều ở mọi phần: S1, S4, S5, S8, S12, S15 viết test cùng lúc hoặc sau code. Một số test cũ được sửa cho đúng chữ và bố cục mới của Figma; không có test nào bị xóa hoặc bỏ qua.

Kiểm kê frame ngày 01/11 chỉ đọc tên layer; ngoài ba frame FE-23 (tồn kho `2621:4113`, tạo phiếu nhập `2623:4108`, kiểm kê `2623:4482`), các frame chưa được xem kỹ từng màn ở bước kiểm kê đó.
