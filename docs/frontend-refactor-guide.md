# Hướng dẫn tổ chức và refactor Frontend BeefCare

Trạng thái: tài liệu thiết kế triển khai, chưa phải mô tả rằng source đã được refactor xong.  
Phạm vi: `frontend/src`, dựa trên source hiện tại ngày 19/11/2026.  
Nguyên tắc bắt buộc: production chỉ dùng dữ liệu thật từ backend; không dùng mock, demo, seed hoặc localStorage làm nguồn dữ liệu nghiệp vụ thay thế backend.

## 1. Mục tiêu

| Cụm thư mục | Trách nhiệm và ranh giới |
| :---- | :---- |
| `app` | Lắp ráp ứng dụng như route, provider, layout và session. |
| `shared` | Hạ tầng kỹ thuật và UI thật sự dùng chung, không biết nghiệp vụ. |
| `features` | Mỗi nghiệp vụ tự sở hữu API, kiểu dữ liệu, luật, validation, hook, component và page của nó. |

Kết quả hướng đến là source dễ tìm, ít import chéo, có thể sửa một feature mà không làm lan logic sang feature khác. Việc di chuyển file không được làm đổi route, quyền, payload, validation, trạng thái hoặc hành vi người dùng.

## 2. Nguyên tắc kiến trúc

| STT | Nguyên tắc | Nội dung chi tiết |
| :---- | :---- | :---- |
| 1 | Owner theo nghiệp vụ | File phục vụ cattle thì thuộc `features/cattle`, không đặt ở root chỉ vì nhiều component cattle đang dùng. |
| 2 | Shared phải trung lập | `shared` không import từ `features` và không chứa tên model như `Payment`, `Entry`, `Pen`. |
| 3 | App chỉ điều phối | `app` cấu hình route/provider/layout/session, không chứa công thức hay validation nghiệp vụ. |
| 4 | Page mỏng | Page ghép component và gọi hook; không tự gọi HTTP, map DTO hay chứa luật nghiệp vụ dài. |
| 5 | API theo feature | DTO, mapper và endpoint nghiệp vụ nằm trong feature; `shared/api` chỉ chứa HTTP client, parser và lỗi kỹ thuật chung. |
| 6 | Validation khác domain | Validation trả lỗi đầu vào; domain quyết định hành động có được phép và tính toán nghiệp vụ. |
| 7 | Một public boundary | Feature khác chỉ import từ `features/<feature>/index.ts`, không deep-import file nội bộ. |
| 8 | Không tạo thư mục rỗng | Chỉ tạo `hooks`, `validation`, `domain`... khi feature thật sự có file tương ứng. |
| 9 | Không dữ liệu giả | Xóa đường chạy production đến mock/demo/local sau khi endpoint, mapper và contract test của backend đã sẵn sàng. Lỗi backend phải hiện thành lỗi, không âm thầm rơi về dữ liệu giả. |

## 3. Cấu trúc thư mục hướng đến

```text
frontend/src/
├── main.tsx                       # entry rất mỏng
├── app/
│   ├── bootstrap.tsx
│   ├── routes/
│   │   ├── AppRoutes.tsx
│   │   └── routeConfig.ts
│   ├── providers/
│   │   └── AppProviders.tsx
│   ├── layouts/
│   │   ├── FarmPlatformLayout.tsx
│   │   └── TechnicianLayout.tsx
│   ├── session/
│   │   ├── SessionProvider.tsx
│   │   ├── sessionContext.ts
│   │   ├── currentFarm.ts
│   │   └── sessionLifecycle.ts
│   └── styles/
│       └── index.css
├── shared/
│   ├── api/
│   │   ├── backendClient.ts
│   │   ├── backendTransport.ts
│   │   ├── backendPending.ts
│   │   ├── parse.ts
│   │   └── userFacingError.ts
│   ├── config/
│   │   └── runtime.ts
│   ├── ui/
│   │   ├── Button/
│   │   ├── Table/
│   │   ├── Modal/
│   │   ├── Form/
│   │   ├── Feedback/
│   │   ├── Icon/
│   │   └── QrScanner/
│   ├── hooks/
│   │   ├── useAsyncQuery.ts
│   │   ├── useMutation.ts
│   │   └── useModalParam.ts
│   ├── lib/
│   │   ├── date/
│   │   └── format.ts
│   ├── types/                     # chỉ type kỹ thuật/presentation chung
│   └── assets/
\|
\|
\|
```

└── features/  
    └── \<feature\>/  
        ├── api/  
        │   ├── \<feature\>Api.ts  
        │   ├── \<feature\>.dto.ts  
        │   └── \<feature\>Mapper.ts  
        ├── components/  
        ├── pages/  
        ├── hooks/  
        ├── validation/  
        ├── domain/  
        ├── types/  
        ├── constants/             \# chỉ hằng số thật do sản phẩm sở hữu  
        └── index.ts

Đây là cấu trúc logic, không phải yêu cầu mọi feature phải có đủ mọi thư mục. Ví dụ feature chỉ có một page và một API thì không cần tạo `domain/` rỗng.

## 4. Ý nghĩa từng thư mục

| Thư mục | Chứa gì  | Không chứa gì |
| :---- | :---- | :---- |
| app/routes | route path, lazy page, redirect và gắn role gate | API call, validation form, công thức nghiệp vụ |
| app/providers | thứ tự lắp Router, Auth, Session và provider toàn app | provider chỉ dùng trong một feature |
| app/layouts | shell, menu, top bar, bottom navigation theo vai trò | button/input nguyên tử dùng chung |
| app/session | user/session hiện tại, active farm và vòng đời đăng nhập | policy nghiệp vụ của cattle, payment,... |
| shared/api | HTTP client, CSRF, credentials, lỗi mạng, parser primitive  | endpoint cattle/pen/entry, DTO hoặc mapper nghiệp vụ |
| shared/ui | Button, Modal, Table primitive, Field, loading/empty/error |  `PaymentTable`, `EntryForm`, `CattleCard` biết model nghiệp vụ |
| shared/hooks | hook kỹ thuật có contract chung và ít nhất hai consumer thật  | `useSubmitEntry`, `useCancelVoucher`, hook chứa quyền/luật feature |
| shared/lib\` | hàm thuần format, date/time, chuỗi, số  | truy cập API hoặc React state nghiệp vụ |
| shared/config | runtime config đã validate | catalogue/option phải lấy từ backend |
| shared/types | type presentation hoặc hạ tầng thật sự chung | “kho chứa” toàn bộ type domain  |
| \`features/\*/api | endpoint, request/response DTO, mapper DTO ↔ domain | component và form validation |
| features/\*/components | UI chỉ thuộc feature  | route orchestration toàn app |
| features/\*/pages | ghép hook và component thành màn hình | HTTP client chi tiết, mapper DTO |
| features/\*/hooks | query/mutation và use-case hook theo nghiệp vụ | UI primitive chung |
| features/\*/validation | required, range, format, date, file và lỗi theo field | quyền thực hiện lệnh hoặc state transition |
| features/\*/domain | policy, eligibility, state transition, calculation | React component và HTTP implementation  |
| features/\*/types | model và type nội bộ feature | type của feature khác  |
| eatures/\*/constants | hằng số thật, ổn định, do sản phẩm sở hữu | bản ghi giả, ID giả, ngày “hôm nay” cố định, catalogue backend |
| features/\*/index.ts | public API tối thiểu của feature  | export mọi file nội bộ cho tiện |

## 6. Kiểm kê source hiện tại và hướng di chuyển

### 6.1 App, session và layout

| Hiện tại  | Hướng đến | Cách làm an toàn |
| :---- | :---- | :---- |
| `main.tsx` đang lắp toàn bộ provider | `main.tsx` gọi `app/bootstrap.tsx`; provider nằm trong `app/providers`  | giữ nguyên thứ tự `Router → Auth → AuthGate → Session → Routes` |
| `App.tsx` chứa lazy import, role và route |  `app/routes/AppRoutes.tsx` |  chụp route-role matrix trước/sau; không đổi path hoặc guard |
| `components/Layout.tsx` |  `app/layouts/FarmPlatformLayout.tsx` | giữ shell/nav/search/logout; bỏ tên người/trại fallback giả, lấy session thật  |
| `components/TechnicianLayout.tsx` | `app/layouts/TechnicianLayout.tsx`  | giữ `/kt/*`, back và bottom bar  |
| `authorization/SessionProvider.tsx`, `sessionContext.ts` | `app/session/*`  | session là orchestration toàn app; policy quyền vẫn ở authorization |
| `api/currentFarm.ts` và `farm-workspace/selectedFarm.ts`  | một nguồn `app/session/currentFarm.ts` | giữ contract active farm theo tab bằng `sessionStorage` như UC-FE02-02; xóa legacy `selectedFarm.ts` sau khi hết consumer; logout/session-expired phải clear current farm  |
| `api/sessionLifecycle.ts` | `app/session/sessionLifecycle.ts`  | giữ cleanup listener và redirect |
| `pages/Placeholder.tsx`, `ScreenStub.tsx` | `app/routes/NotFoundPage.tsx` hoặc xóa  | không để placeholder che route hoặc contract bị thiếu  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |

### 6.2 Shared: chuyển cụ thể cái gì

| Nhóm | File hiện tại | Target/ghi chú |
| :---- | :---- | :---- |
| HTTP | `api/backendClient.ts` | `shared/api/backendClient.ts`; giữ CSRF, credentials, idempotency và lỗi HTTP |
| Transport | `api/backendTransport.ts` | tách singleton transport, `shared/config/runtime.ts`, `shared/api/parse.ts`; active farm không nằm trong transport. `parse.ts` chỉ giữ `asRecord`, `asRows`, `textValue`, `numberValue`, `nullableNumber`; `enumPaymentMethod` và `unwrapVoucher` phải về mapper feature |
| Pending/error | `api/backendPending.ts`, `api/userFacingError.ts` | giữ lỗi kỹ thuật chung; mã lỗi nghiệp vụ đưa về feature owner. `backendPending` chỉ là cơ chế chuyển tiếp và phải biến mất khỏi feature sau khi endpoint thật hoàn tất |
| Date/format | `api/farmTimeZone.ts`, `data/format.ts` | `shared/lib/date/farmTime.ts`, `shared/lib/format.ts`; giữ UTC+7 semantics và test biên ngày |
| UI primitives | phần trung lập trong `components/ui.tsx` | tách dần Button, Badge, Card, Table, Field, input, Loading/Empty/Error; dùng re-export tạm thời |
| Icon | `components/Icon.tsx` | `shared/ui/Icon`; sửa asset glob tương ứng |
| Modal | `components/Modal.tsx` | `shared/ui/Modal`; tháo phụ thuộc `useTopbarTitle` của layout bằng prop/context phù hợp |
| QR | `components/QrCamera.tsx` | `shared/ui/QrScanner`; giữ cleanup camera/timer và lỗi permission |
| Table row | `components/interactiveTableRow.ts` | `shared/ui/Table/interactiveRow.ts`; giữ keyboard và nested-control behavior |
| Hooks kỹ thuật | `hooks/useApi.ts` | tách `shared/hooks/useAsyncQuery.ts`, `useMutation.ts`; giữ stale-request guard |
| Assets/CSS | `assets/*`, `index.css` | `shared/assets/*`, `app/styles/index.css` |

| Đối tượng / File | Ngoại lệ & Hướng xử lý |
| :---- | :---- |
| `Docs` trong `components/ui.tsx` | Đang biết `DocumentRow`: đổi thành `AttachmentList` dùng props trung lập hoặc giữ trong Entry/Exit. |
| `PaymentTable` | Đang biết `Payment`: phải thuộc feature payment/Entry/Exit, không được gọi là shared UI. |
| `StatusBadge` | Đang hardcode trạng thái Entry/Exit: tách mapping trạng thái về feature, shared chỉ nhận `label/tone`. |
| `Dropzone` | Chỉ thành shared khi copy, MIME và giới hạn file đều được truyền bằng props; không hardcode “chứng từ”. |
| `Layout` và `TechnicianLayout` | Không phải shared component vì chúng biết route, role và session. |
| `useDemoState.ts` | Không chuyển vào shared; loại khỏi production. |
| `useRequestKey` & `platform-admin/useCommandKey` | Chỉ được gộp thành `useIdempotencyKey` sau khi thống nhất semantics retry/reload. |

### 6.3 Root API, data và types phải trả về feature owner

| Source cũ | Owner mới |
| :---- | :---- |
| `api/cattleApi.ts`, `cattleBackendApi.ts`, `cattleTimeline.ts` | `features/cattle/api` hoặc `features/cattle/domain` theo trách nhiệm |
| `api/herdDomainApi.ts` | đây là aggregate local/demo nối Cattle–Pen–Entry–Exit; không chuyển nguyên khối vào một feature. Sau khi backend-only được chứng minh thì xóa khỏi production; characterization test cần mô phỏng thì đặt bản tối thiểu ở `tests/support` |
| `api/penApi.ts` | `features/pen-management/api` |
| `types.ts` phần cattle/profile/timeline | `features/cattle/types` |
| `types.ts` phần pen | `features/pen-management/types` |
| `types.ts` phần Entry riêng | `features/herd-entry/types` |
| `types.ts` phần Exit riêng | `features/herd-exit/types` |
| `types.ts` — `Payment`, `DocumentRow` đang được cả Entry và Exit dùng | chưa di chuyển cho đến khi chốt owner; có thể tách type theo từng feature hoặc tạo business module riêng, nhưng không đặt nguyên model nghiệp vụ vào `shared/types` |
| `data/cattleData.ts`, `cowsData.ts`, `pensData.ts`, `penData.ts` | xóa khỏi production; test fixture chỉ nằm trong `tests/fixtures` nếu test thật sự cần |
| `api/client.ts`, `collectionSchemas.ts`, `storageMigrations.ts`, `testUtils.ts` | xóa hoặc chuyển hạ tầng local test vào `tests/support`; không import từ production |
| `api/demoCattlePhotos.ts` | xóa; test fixture riêng nếu cần |

## 7. Mẫu chuẩn cho một feature

Ví dụ `authentication` sau khi refactor:

```text
features/authentication/
├── api/
│   ├── authApi.ts
│   ├── auth.dto.ts
│   └── authMapper.ts
├── components/
│   ├── LoginForm.tsx
│   └── ForgotPasswordForm.tsx
├── pages/
│   ├── LoginPage.tsx
│   └── LegalPage.tsx
├── hooks/
│   ├── useLogin.ts
│   └── useForgotPassword.ts
├── validation/
│   ├── loginValidation.ts
│   └── passwordValidation.ts
├── domain/
│   └── authError.ts
├── types/
│   └── auth.types.ts
└── index.ts
```

Quy tắc triển khai trong feature:

| STT | Tầng / Thành phần | Quy tắc triển khai |
| :---- | :---- | :---- |
| 1 | Page | Page gọi hook và render component. |
| 2 | Component | Quản lý hiển thị/form state cục bộ, gọi `validation` để hiện lỗi theo field. |
| 3 | Hook | Điều phối use case, gọi API và cập nhật trạng thái query/mutation. |
| 4 | API | Tạo request DTO, gọi `shared/api`, map response DTO sang model. |
| 5 | Domain | Chứa policy/tính toán không phụ thuộc React hay HTTP. |
| 6 | Index boundary (`index.ts`) | Chỉ export page hoặc contract cần cho route/feature khác. |

## 8. Kế hoạch refactor từng feature hiện có

| Feature | Giữ và tổ chức lại | Phần phải tách/chuyển/xóa |
| :---- | :---- | :---- |
| `account` | profile, password page/component/hook | validator từ `domain/profileRules` → `validation`; policy ở `domain`; tách DTO/mapper; xóa `accountDemoStore`, mock UI/data |
| `authentication` | login/logout/forgot-password, auth provider logic | client → `api/authApi`; validator → `validation`; session composition → `app`; export LegalPage qua index; xóa `authMock`, `demoUsers`, mock client/sessionStorage data |
| `authorization` | `AuthGate`, `RoleGate`, permission policy | session/current user orchestration → `app/session`; không deep-import authentication internals; xóa mock-user branch |
| `cattle` | cattle list/detail/profile/timeline và command hook | đưa root cattle API/types về feature; field validation → `validation`; eligibility/tag rule → `domain`; xóa root cattle/cows/local/photo demo |
| `farm-announcements` | page/form/query/mutation | tách form validation; permission/status → `domain`; API DTO/mapper; xóa demo store/mock |
| `farm-catalogue` | catalogue page/component/hook | validation → `validation`; availability/effective rule → `domain`; hook đang trong component/API → `hooks`; xóa demo |
| `farm-overview` | dashboard/summary UI và query | request/filter validation; aggregate/viewer/reminder → `domain`; xóa demo |
| `farm-workspace` | chọn/đi vào workspace và feature UI | `useFarmId`, selected farm dùng toàn app → `app/session`; giữ province constants chỉ khi product-owned; breed/catalogue lấy backend; xóa seed/demo |
| `feed-stock` | receipt, adjustment, ration, feeding, catalogue, report | tách validator đang trong `data`; mapper/API/domain/form-state; xóa toàn bộ `*Mock`, `*DemoStore`, demo dates/suppliers/pens/rations; refactor lần lượt theo vertical slice |
| `growth` | growth form/chart/query | field validation → `validation`; summary/calculation → `domain`; xóa demo |
| `health` | health record/form/query | input validation → `validation`; eligibility/status rule → `domain`; xóa demo |
| `herd-entry` | list, detail, draft, check/post, payment, attachment, Excel import thật | tạo `types/validation/domain`; chỉ backend API; xóa `herdEntryLocalApi`, `entryData`, local/in-memory; giữ parser Excel thật; contract audit đầy đủ |
| `herd-exit` | list, draft, candidate/check, confirm/void, pending dismissal, payment/attachment | tạo `types/validation/domain`; chỉ backend API; xóa local API/data fixture; contract audit đầy đủ |
| `notifications` | notification page/query/mutation | policy → `domain`; date formatter chung → `shared/lib`; backend-only; xóa demo |
| `pen-management` | pen list/detail/form/move cattle | root pen types/API → feature; split `penApi`, mapper, DTO, move API; validation/domain riêng; xóa local schema/data/client |
| `platform-admin` | admin pages/commands | validation riêng; access/status policy → `domain`; idempotency hook chỉ share sau khi contract thống nhất; xóa demo |
| `platform-finance` | finance page/form/query | validation dùng business date/catalogue backend; calculation → `domain`; xóa demo dates/categories |
| `platform-service` | service plans/order/payment flow; giữ `SePayLookup` và `platformReconciliationApi` vì đây là luồng backend thật | validation và pricing/domain riêng; xóa `platformServiceDemoStore` và `platformServiceMock`; không xóa SePay thật |
| `platform-support` | support administration/workflow | form validation → `validation`; workflow transition → `domain`; đặt lại tên API rõ use case; xóa demo |
| `reproduction` | reproduction record/form/query | field validation → `validation`; rule → `domain`; option lấy backend; xóa demo clock/static records; thu hẹp index |
| `subscription` | plan/subscription/payment UI | hook trong page → `hooks`; DTO/mapper trong API; farm scope → `app/session`; xóa `DevTransferSimulator`, `devTransferApi`, demo, QR placeholder và query demo flags |
| `support` | ticket page/form/action | `ticketValidation`; lifecycle/access → `domain`; `useTicketActions` → `hooks`; xóa demo/query flags |
| `vaccination` | vaccination form/list/query | form validation riêng; dose/withdrawal rule → `domain`; option từ endpoint thật; xóa demo/static backend-owned options |

Với feature lớn như `feed-stock`, `herd-entry`, `herd-exit`, không chuyển toàn bộ cùng lúc. Refactor theo một lát dọc hoàn chỉnh: page → hook → API → mapper → backend → response → UI, sau đó mới sang use case tiếp theo.

### 8.1 Các import chéo phải tháo cụ thể

| Import hiện tại | Hướng xử lý |
| :---- | :---- |
| `authorization/AuthGate.tsx` → nội bộ `authentication/AuthContext` | authentication export contract công khai; app/provider lắp hai feature, authorization không deep-import |
| `account/types.ts` → `authorization` | role type được authorization export công khai hoặc app/session cung cấp session contract |
| `authentication/AuthContext.tsx` → `farm-workspace/selectedFarm` | logout/session cleanup gọi `app/session`; bỏ dependency trực tiếp giữa hai feature |
| `platform-service/domain/reconciliation.ts`, `servicePeriods.ts`, `components/common.tsx` → `farm-workspace/domain/statusViews` | platform-service tự sở hữu label/status của nó hoặc dùng presentation mapper trung lập, không import nội bộ farm-workspace |
| `platform-service/ServiceChangeDialog.tsx` → `farm-workspace/domain/discardPrompt` | nếu prompt thật sự generic thì chuyển hàm thuần sang `shared/lib`; nếu chứa nghiệp vụ thì platform-service tự sở hữu |

### 8.2 Mapping chi tiết cho các nhóm rủi ro cao

| Nhóm source hiện tại | Target |
| :---- | :---- |
| `feed-stock/data/feedReceiptForm.ts`, `feedRationForm.ts`, `feedStockAdjustmentForm.ts` | tách form types/defaults gần feature form, validator vào `validation`, payload mapper vào `api`; không giữ file “data” trộn ba trách nhiệm |
| `feed-stock/data/*Mock.ts`, `*DemoStore.ts`, `*Seed.ts`, demo dates/suppliers/pens | xóa khỏi production sau khi các receipt/ration/feeding/adjustment/catalogue endpoints và test đã đạt |
| `health/domain/healthRules.ts` | field checks → `health/validation`; eligibility/state rule → `health/domain` |
| `health/data/healthMock.ts`, `healthDemoStore.ts` | xóa khỏi production sau backend contract checks |
| `platform-service/data/platformServiceMock.ts`, `platformServiceDemoStore.ts` | xóa; giữ API backend và `SePayLookup` thật |
| `herd-entry/api/herdEntryBackendApi.ts` | tách DTO/mapper/facade trong `herd-entry/api`; giữ payload và response contract |
| `herd-entry/api/herdEntryLocalApi.ts`, `data/importsData.ts`, phần fixture của `entryData.ts` | xóa khỏi production; parser Excel thật giữ trong feature, test fixture vào `tests/fixtures` |
| `herd-exit/api/herdExitBackendApi.ts` | tách DTO/mapper/facade trong `herd-exit/api` |
| `herd-exit/api/herdExitLocalApi.ts`, `data/exportsData.ts`, fixture trong `exitData.ts` | xóa khỏi production sau backend contract checks; pure occupancy calculation về `domain` nếu còn dùng |

## 9. Validation, domain, API và state đặt ở đâu

### 9.1 Validation

Hiện tại validation đang phân tán: có file đúng hướng như `authentication/validation.ts`, `farm-workspace/validation.ts`, `herd-entry/entryValidation.ts`; nhiều luật field lại nằm trong `*/domain/*Rules.ts`, trong các file form thuộc `feed-stock/data/*Form.ts`, và một phần nằm trực tiếp ở component/page/API. Khi refactor phải phân loại từng rule theo ý nghĩa, không chuyển cả file chỉ dựa vào tên thư mục.

| Loại quy tắc Validation | Mô tả & Ví dụ cụ thể |
| :---- | :---- |
| Bắt buộc / Tùy chọn | Required / optional / conditionally required. |
| Giới hạn định dạng & giá trị | Min / max, số dương, độ dài, regex. |
| Tệp tin & Thời gian | Date range, file type / size. |
| Quan hệ inter-field | Quan hệ giữa các field trong cùng một form. |
| Chuẩn hóa lỗi UI | Hàm chuyển lỗi thành `fieldErrors` cho UI. |

Ví dụ: “weight phải \> 0” là validation. “Cattle ở trạng thái SOLD không được chuyển pen” là domain policy. Backend vẫn là nơi xác nhận cuối cùng; frontend validation chỉ giúp UX và phải đồng bộ contract.

Không đặt validation trong `data`, page, component lớn hoặc API mapper. Schema dùng lại cho nhiều form của **cùng feature** vẫn ở feature đó; chỉ share primitive như parser number/date nếu hoàn toàn không có nghiệp vụ.

### 9.2 Domain

| Thành phần Domain | Mô tả chức năng |
| :---- | :---- |
| Eligibility & Rights | Eligibility và quyền theo trạng thái. |
| State Transition | Chuyển đổi trạng thái nghiệp vụ. |
| Calculation & Policy | Các công thức tính toán và chính sách nghiệp vụ. |
| Command Precondition | Điều kiện tiên quyết trước khi thực thi lệnh. |
| Domain Model Mappers | Các hàm thuần biến đổi model domain. |

Domain không import React, router hoặc HTTP client. Authorization kỹ thuật của route nằm ở gate; quyền nghiệp vụ cụ thể vẫn do domain/backend xác nhận.

### 9.3 API

| Phân loại API | Trách nhiệm & Quy tắc |
| :---- | :---- |
| `shared/api` | Gửi request, CSRF, credential, timeout, parse primitive, normalize lỗi HTTP. |
| `feature/api` | URL endpoint, request/response DTO, enum backend, mapper và facade API. |
| Quy tắc phụ thuộc | Không để API import component/page. API có thể import types/domain của chính feature và `shared/api`. |
| Quy tắc lưu trữ | Không dùng localStorage/IndexedDB làm fallback nghiệp vụ khi backend lỗi. |

### 9.4 State

| Loại State | Vị trí quản lý |
| :---- | :---- |
| Form state & Modal state | Giữ gần component/page. |
| Query / Mutation state | Feature hook. |
| Session / User / Active farm | `app/session`. |
| State nội bộ feature | Provider/store trong feature. |
| Global store | Chỉ tạo global store khi nhiều feature thật sự cần đồng bộ và không thể suy ra từ server/session. |

## 10. Trình tự triển khai refactor an toàn

### Giai đoạn 0 — Chốt baseline

| STT | Bước thực hiện | Chi tiết |
| :---- | :---- | :---- |
| 1 | Ghi lại baseline | Ghi lại route-role matrix, provider order và các luồng đăng nhập/chọn farm. |
| 2 | Chạy script kiểm tra | Chạy baseline `npm run typecheck`, `npm run test:api`, `npm run test:unit:run`, `npm run test:integration`, `npm run test:integration:ui`, `npm run build` trong `frontend` (lưu ý `test:integration` hiện chỉ bao phủ Herd Entry). |
| 3 | Lập matrix hợp đồng | Với Entry, Exit, payment và farm-born calf: lập field/contract matrix theo SRS, OpenAPI, DTO, validator và persistence trước khi sửa. |

### Giai đoạn 1 — Tạo ranh giới nhưng chưa đổi hành vi

| STT | Bước thực hiện | Chi tiết |
| :---- | :---- | :---- |
| 1 | Tạo khung thư mục | Tạo `app`, `shared` và public index. |
| 2 | Di chuyển file an toàn | Di chuyển file theo lát nhỏ và để compatibility re-export tại path cũ. |
| 3 | Tách cấu hình app | Tách routes/providers/layouts nhưng giữ nguyên JSX, path, guard và provider order. |
| 4 | Chuyển tài nguyên dùng chung | Chuyển asset, Icon, format/date và table-row helper trước. |
| 5 | Tách UI primitives | Tách `components/ui.tsx` từng component; không rewrite UI đồng thời. |

### Giai đoạn 2 — Trả ownership về feature

| STT | Nhiệm vụ | Chi tiết triển khai |
| :---- | :---- | :---- |
| 1 | Phân rã `types.ts` | Tách `types.ts` theo cattle, pen, entry và exit. |
| 2 | Chuyển API về feature | Chuyển root cattle/pen API về feature; tách DTO/mapper nhưng giữ facade contract hiện tại. |
| 3 | Tách validation/domain | Tách validation/domain bằng characterization unit test trước khi đổi import. |
| 4 | Cập nhật component/page | Cập nhật page/component/hook qua public boundary. |
| 5 | Thu hẹp `index.ts` | Thu hẹp `index.ts` sau khi import graph đã sạch. |

### Giai đoạn 3 — Backend-only, không dữ liệu giả

| STT | Nhiệm vụ | Chi tiết thực hiện |
| :---- | :---- | :---- |
| 1 | Xác nhận backend endpoint | Xác nhận endpoint, DTO, mapper và error state thật tồn tại cho từng use case. |
| 2 | Đổi adapter production | Đổi facade production sang backend adapter. |
| 3 | Xác minh xử lý lỗi | Chứng minh success, validation error, authorization error, network/server error đều được xử lý. |
| 4 | Rà soát code base | Dùng `rg` xác nhận production không còn import `Mock`, `Demo`, `Seed`, local API, `useDemoState` hoặc `?demo=`. |
| 5 | Dọn dẹp code giả | Sau đó mới xóa mock/demo/local files; fixture cần cho test chuyển vào `tests/fixtures` và không được production import. |

### Giai đoạn 4 — Hợp nhất session và dependency

| STT | Hạng mục hợp nhất | Yêu cầu kỹ thuật |
| :---- | :---- | :---- |
| 1 | Quản lý active farm | Giữ contract active farm theo tab bằng `sessionStorage`; xóa fallback farm ID cứng `VITE_BEEFCARE_FARM_ID \|\| '1'`. Request farm-scoped chỉ chạy khi có farm hợp lệ, nếu thiếu phải redirect/chặn rõ ràng. |
| 2 | Gỡ bỏ coupling | Bỏ coupling authentication ↔ farm-workspace ↔ authorization bằng `app/session` và public interfaces. |
| 3 | Chặn deep import | Bỏ mọi deep import qua feature khác. |
| 4 | Kiểm tra chu kỳ phụ thuộc | Kiểm tra cycle và quy tắc `shared` không import `features/app`. |

## 11. Kiểm thử và tiêu chí hoàn thành

Sau mỗi lát refactor:

```bash
cd frontend
npm run typecheck
npm run test:api
npm run test:unit:run
npm run test:integration
npm run test:integration:ui
npm run build
```

Trong feature worktree, chạy focused unit test của lát đang sửa. Các suite rộng ở trên chạy tại integration checkpoint theo RTK; không mô tả `test:integration` như kiểm thử toàn frontend vì hiện nó chỉ chạy Herd Entry.

| Kịch bản kiểm tra thủ công | Yêu cầu xác minh |
| :---- | :---- |
| Điều hướng & Phân quyền | Mở đúng route với từng role và kiểm tra redirect/guard. |
| Phiên làm việc & Farm | Login, logout, refresh, hết session và đổi active farm. |
| Xử lý Biểu mẫu (Form) | Submit form hợp lệ/không hợp lệ và kiểm tra lỗi theo field. |
| Trạng thái hệ thống & HTTP error | Loading, empty, 401/403, 404, 409/422 và 5xx. |
| Lưu trữ dữ liệu (Entry/Exit/Payment) | Chứng minh request → DTO/service → persistence → response → UI; HTTP 2xx chưa đủ để kết luận dữ liệu đã lưu. |
| Thiết bị phần cứng (Camera/QR) | Permission, stop track và unmount. |
| Chống lọt dữ liệu giả | Không có dữ liệu giả xuất hiện khi backend tắt hoặc request thất bại. |

| STT | Tiêu chí nghiệm thu | Mô tả cụ thể |
| :---- | :---- | :---- |
| 1 | Backend-only | Production path chỉ gọi backend thật. |
| 2 | Sở hữu mã nguồn rõ ràng | Type/DTO/mapper/validation/domain có owner rõ. |
| 3 | Không vi phạm ranh giới | Không import path nội bộ của feature khác. |
| 4 | Tách biệt trách nhiệm | Không còn logic nghiệp vụ trong page hoặc shared. |
| 5 | Pass kiểm thử tự động | Test liên quan, typecheck và build qua. |
| 6 | Smoke test thành công | Route/session/UI quan trọng đã smoke test. |
| 7 | Bằng chứng lưu trữ | Với dữ liệu cần lưu, có bằng chứng readback/persistence phù hợp. |

## 12. Ba vòng review bắt buộc

| Tiêu chí Review Vòng 1 | Nội dung chi tiết |
| :---- | :---- |
| Độ phủ feature & root | Đối chiếu toàn bộ 23 feature và toàn bộ root `api/components/hooks/data/types`. |
| Chỉ định Owner | Mỗi file phải có owner: app, shared, một feature, test support hoặc xóa. |
| Kiểm soát Shared | Không tạo shared vì “có thể sau này dùng”; cần consumer thật và contract trung lập. |

| Tiêu chí Review Vòng 2 | Nội dung chi tiết |
| :---- | :---- |
| Kiểm tra phụ thuộc | Kiểm tra hướng import, cycle, deep import và public index. |
| So sánh cấu hình | So sánh route-role matrix, provider order, validation và API payload trước/sau. |
| Audit luồng quan trọng | Audit riêng Entry/Exit/payment/calf; kiểm tra active-farm persistence và timezone. |
| Kiểm soát dữ liệu | Xác nhận không có fallback demo/local che lỗi backend. |

### Vòng 3 — Review độc lập và xác minh

| Tiêu chí Review Vòng 3 | Nội dung chi tiết |
| :---- | :---- |
| Đánh giá độc lập | Reviewer không tham gia soạn đối chiếu tài liệu với source thực tế. |
| Khắc phục sai lệch | Sửa mọi sai lệch path, owner, tên feature và rủi ro còn thiếu. |
| Chạy kiểm tra thực tế | Chạy lại inventory bằng `rg`, test/typecheck/build theo phạm vi triển khai. |
| Minh bạch trạng thái | Ghi rõ mục nào đã tự động kiểm tra, mục nào chỉ manual và mục nào còn chờ backend/product decision. |

## 13. Các quyết định cần chốt trước khi code

| STT | Chủ đề cần chốt | Nội dung câu hỏi / Quyết định |
| :---- | :---- | :---- |
| 1 | Backend Endpoints & Catalogue | Các endpoint/catalogue backend còn thiếu cho feed-stock, vaccination, reproduction và các feature đang dùng demo. |
| 2 | Ownership của Payment & Document | Ownership chính thức của payment/document dùng chung giữa Herd Entry và Herd Exit: type riêng cho từng feature hay contract trung lập có tên rõ. |
| 3 | Vòng đời Idempotency Key | Idempotency key phải sống qua reload hay chỉ trong một lần mount trước khi gộp hai hook hiện tại. |
| 4 | Xử lý Placeholder Routes | Những placeholder nào là route thật chưa triển khai và route nào phải trả Not Found. |

Không quyết định thay bằng dữ liệu giả. Nếu backend hoặc requirement chưa sẵn sàng, giữ feature ở trạng thái bị chặn có thông báo rõ thay vì tạo fallback production.
