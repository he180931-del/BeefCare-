# Frontend Architecture Problem Specification

## 1. Trạng thái tài liệu

- Loại tài liệu: đặc tả vấn đề kiến trúc, chỉ phục vụ review.
- Phạm vi: tổ chức mã nguồn `frontend/src` và các kiểm tra boundary liên quan.
- Ngoài phạm vi: giải pháp, kế hoạch refactor, thứ tự triển khai, ước lượng và thay đổi mã nguồn.
- Checkpoint được đọc: `e77519800651acb80da61975013a7bc3a5a1903c` trên nhánh `codex/cicd-production-refresh`.
- Đối chiếu nhánh `dev`: `frontend/src` không có khác biệt so với `dev` tại `96ef8455aad0c020108116e2ce4c8fb2634f5df3`; vì vậy các finding về tổ chức source áp dụng cho cả hai checkpoint.
- Chuẩn đối chiếu: `RTK.md`, `docs/agent-context/ARCHITECTURE.md`, `docs/agent-context/VERIFICATION.md` và `docs/frontend-refactor-guide.md`.

## 2. Phương pháp và giới hạn

Bốn lượt review chỉ đọc đã được thực hiện: `app/shared/legacy`, toàn bộ feature, dependency/enforcement và review chéo độc lập. Inventory bao phủ 23 feature, 606 module TypeScript/TSX và 2.814 dependency edge tương đối. Dependency graph theo value import không phát hiện runtime cycle; graph bao gồm type import có các cycle được ghi ở PR-08.

`npm run test:api` đạt 199/199 tại checkpoint audit, bao gồm toàn bộ boundary test hiện có. Kết quả xanh chỉ chứng minh các quy tắc đang được test hóa; nó không phủ định các ngoại lệ được allowlist hoặc các khoảng trống của chính bộ kiểm tra.

GitNexus MCP không khả dụng trong phiên audit. Dependency graph được dựng bằng phân tích TypeScript AST và đối chiếu source. Không chạy production build, browser hoặc backend runtime; mọi kết luận cần artifact/runtime được đánh dấu `Needs-evidence`.

## 3. Quy ước mức độ

| Mức độ | Ý nghĩa trong tài liệu này |
| --- | --- |
| High | Sai lệch lan rộng hoặc làm mờ một boundary cốt lõi của kiến trúc đã chốt. |
| Medium | Sai lệch có phạm vi rõ, làm ownership hoặc dependency không nhất quán. |
| Low | Public surface, compatibility hoặc cấu trúc thừa có phạm vi hẹp. |
| Needs-evidence | Có đường dẫn tĩnh đáng chú ý nhưng chưa đủ bằng chứng artifact/runtime để khẳng định. |

## 4. Các vấn đề source và cấu trúc

### PR-01 — High — `shared/api` chứa xử lý lỗi nghiệp vụ của nhiều feature

`userFacingError` không còn là hạ tầng lỗi kỹ thuật trung lập. Module này biết tên field và mã lỗi của Pen, Cattle, Herd Entry, Reproduction, Farm Catalogue và Platform Finance.

- Bằng chứng: `frontend/src/shared/api/userFacingError.ts:22-36`, `frontend/src/shared/api/userFacingError.ts:43-76`.
- Quy tắc bị lệch: `shared` không biết nghiệp vụ; `shared/api` chỉ quản lý HTTP, parser và lỗi kỹ thuật.
- Phạm vi quan sát: sáu miền nghiệp vụ cùng phụ thuộc một registry lỗi đặt trong `shared`.
- Confidence: Verified.

### PR-02 — High — Page layer đang đóng vai trò controller/use-case

Trong 22 feature có page, 76 page import trực tiếp feature API và 69 page gọi trực tiếp generic `useQuery` hoặc `useMutation`. Page đang sở hữu tải dữ liệu, mutation, retry, chuyển trạng thái và một phần validation thay vì chỉ ghép component và gọi feature hook.

- Bằng chứng đại diện: `frontend/src/features/cattle/pages/CowList.tsx:6-8`, `frontend/src/features/feed-stock/pages/FeedReceiptFormPage.tsx:8-13`, `frontend/src/features/herd-entry/pages/ImportNew.tsx:10-29`, `frontend/src/features/herd-exit/pages/ExportNew.tsx:10-12`, `frontend/src/features/platform-service/pages/PaymentReadPage.tsx:7-10`.
- Hotspot Herd Entry: `frontend/src/features/herd-entry/pages/ImportNew.tsx:55-218`, `frontend/src/features/herd-entry/pages/ImportNew.tsx:264-389`; file có 783 dòng và đồng thời quản lý state, validation, tính tiền/sức chứa/parentage, payload, lưu/ghi phiếu, attachment và Excel.
- Hotspot Herd Exit: `frontend/src/features/herd-exit/pages/ExportNew.tsx:45-145`, `frontend/src/features/herd-exit/pages/ExportNew.tsx:201-291`; file có 488 dòng và feature không có `validation/`.
- Hotspot Feed Stock: `frontend/src/features/feed-stock/pages/FeedReceiptFormPage.tsx:64-190`, `frontend/src/features/feed-stock/pages/FeedReceiptFormPage.tsx:301-363`; file có 697 dòng và đồng thời quản lý calculation, validation summary, file transport, idempotency, draft/post workflow và navigation.
- Quy tắc bị lệch: page mỏng; hook feature sở hữu use case/query/mutation; validation, domain và API mapping có owner riêng.
- Phạm vi quan sát: toàn bộ 22 feature có page; nặng nhất ở Herd Entry, Herd Exit và Feed Stock.
- Confidence: Verified.

### PR-03 — Medium — Boundary validation/domain/API chưa nhất quán

Validation required/range/length và field error vẫn nằm trong `domain/` hoặc `api/`; một số module trộn input validation với eligibility hoặc state policy.

- Bằng chứng: `frontend/src/features/farm-announcements/domain/announcementRules.ts:55-73`, `frontend/src/features/platform-support/domain/supportRules.ts:66-70`, `frontend/src/features/platform-admin/domain/platformRules.ts:53-59`, `frontend/src/features/platform-admin/domain/platformRules.ts:135-137`, `frontend/src/features/reproduction/domain/reproductionRules.ts:69-127`, `frontend/src/features/reproduction/domain/reproductionRules.ts:150-197`, `frontend/src/features/subscription/api/subscriptionApi.ts:84-85`, `frontend/src/features/subscription/api/subscriptionApi.ts:111-115`, `frontend/src/features/subscription/api/subscriptionApi.ts:138-141`.
- Dấu hiệu cấu trúc: Herd Exit và Subscription không có thư mục `validation/` dù source chứa input validation.
- Quy tắc bị lệch: `validation/` quản lý lỗi input/field; `domain/` quản lý policy/calculation; `api/` quản lý endpoint và DTO mapping.
- Phạm vi quan sát: Farm Announcements, Platform Support, Platform Admin, Reproduction, Subscription và Herd Exit.
- Confidence: Verified.

### PR-04 — Medium — Bốn backend adapter là mega-module nhiều trách nhiệm

Bốn file backend adapter gộp endpoint facade, DTO coercion, mapper, error translation và presentation/policy mapping trong cùng module.

- Bằng chứng: `frontend/src/features/vaccination/api/vaccinationBackend.ts:27-274` (688 dòng toàn file), `frontend/src/features/reproduction/api/reproductionBackend.ts:21-324` (585 dòng), `frontend/src/features/health/api/healthBackend.ts:23-469` (474 dòng), `frontend/src/features/farm-overview/api/farmOverviewBackend.ts:19-488` (587 dòng).
- Quy tắc bị lệch: feature API có boundary DTO, mapper và endpoint rõ ràng.
- Phạm vi quan sát: Vaccination, Reproduction, Health và Farm Overview; tổng cộng 2.334 dòng trong bốn adapter.
- Confidence: Verified.

### PR-05 — Medium — Legacy root còn ownership mơ hồ và allowlist không khớp consumer

`components/ui.tsx` chứa UI biết `DocumentRow`, `Payment` và trạng thái Entry/Exit. Lý do allowlist chỉ nêu Entry/Exit nhưng Feed Stock cũng phụ thuộc file này. `types.ts` vừa giữ contract chưa có owner vừa re-export type đã thuộc bốn feature. `data/penData.ts` vẫn được allowlist dù không có consumer source/test ngoài chính allowlist.

- Bằng chứng module: `frontend/src/components/ui.tsx:3-11`, `frontend/src/components/ui.tsx:30-79`, `frontend/src/types.ts:3-36`, `frontend/src/data/penData.ts:1-8`.
- Consumer Entry/Exit: `frontend/src/features/herd-entry/pages/ImportNew.tsx:5`, `frontend/src/features/herd-entry/pages/ImportDetail.tsx:6`, `frontend/src/features/herd-exit/pages/ExportNew.tsx:5`, `frontend/src/features/herd-exit/pages/ExportDetail.tsx:5`, `frontend/src/features/herd-exit/components/DeathView.tsx:6`.
- Consumer Feed Stock: `frontend/src/features/feed-stock/pages/FeedReceiptFormPage.tsx:7`, `frontend/src/features/feed-stock/pages/FeedStockAdjustmentFormPage.tsx:5`, `frontend/src/features/feed-stock/components/FeedReceiptDialogs.tsx:4`.
- Allowlist: `frontend/tests/api/layerBoundary.test.ts:104-119`.
- Quy tắc bị lệch: mọi file có owner app/shared/feature/test rõ ràng; root legacy chỉ chứa ngoại lệ hữu hạn với lý do còn chính xác.
- Phạm vi quan sát: Herd Entry, Herd Exit, Feed Stock, các compatibility type Cattle/Pen và một root data module không có consumer.
- Confidence: Verified.

### PR-06 — Medium — Cattle production contract mang ownership của demo root data

`CowSeed` được định nghĩa trong `src/data/cowsData.ts` bên cạnh constants và records mẫu nhưng lại được dùng làm return/props type của backend mapper, API, scan flow và 16 module Cattle.

- Bằng chứng: `frontend/src/data/cowsData.ts:4-20`, `frontend/src/data/cowsData.ts:42-139`, `frontend/src/features/cattle/api/cattleApi.ts:1`, `frontend/src/features/cattle/api/cattleBackendApi.ts:2`, `frontend/src/features/cattle/api/cattleMapper.ts:2`, `frontend/src/features/cattle/api/cattleMapper.ts:97`, `frontend/src/features/cattle/pages/CowList.tsx:12`, `frontend/src/features/cattle/components/TechnicianProfile.tsx:12`.
- Quy tắc bị lệch: model/type của Cattle thuộc feature Cattle; root `data/` là legacy demo boundary.
- Phạm vi quan sát: backend adapter, mapper, scan flow, list/profile và technician UI của Cattle.
- Confidence: Verified đối với type/ownership coupling; finding này không khẳng định demo record lọt production runtime.

### PR-07 — Medium — Hai deep import xuyên feature vẫn được whitelist

Platform Service domain import thẳng internal domain của Farm Workspace thay vì đi qua public boundary.

- Bằng chứng: `frontend/src/features/platform-service/domain/reconciliation.ts:3`, `frontend/src/features/platform-service/domain/servicePeriods.ts:2`, exception tại `frontend/tests/api/layerBoundary.test.ts:52-69`.
- Dependency path: `platform-service/domain -> farm-workspace/domain/statusViews`.
- Quy tắc bị lệch: feature khác chỉ truy cập `features/<feature>/index.ts`, không deep-import nội bộ.
- Confidence: Verified.

### PR-08 — Medium — Dependency graph có ba type-only cycle qua boundary

Value import graph không có runtime SCC, nhưng type ownership vẫn tạo các vòng hai chiều.

- Session/Authorization: `frontend/src/app/session/sessionContext.ts:2` → `features/authorization/index.ts`; `frontend/src/features/authorization/roles.ts:1` → `app/session/sessionContext.ts`.
- Cattle/Pen: `frontend/src/features/cattle/types.ts:1` → `pen-management/index.ts`; `frontend/src/features/pen-management/types.ts:1` → `cattle/index.ts`.
- Root/Entry/Exit: `frontend/src/types.ts:35-36` → feature types; `frontend/src/features/herd-entry/types.ts:1` và `frontend/src/features/herd-exit/types.ts:1` → root types.
- Quy tắc bị lệch: hướng dependency một chiều và type ownership rõ ràng.
- Confidence: Verified đối với type-only cycles; không có claim runtime cycle.

### PR-09 — Low — Một số public `index.ts` rộng hơn nhu cầu consumer

Feed Stock export gần toàn bộ API/domain dù không có production consumer cross-feature; Reproduction export wildcard type và một lệnh demo; Farm Workspace export DemoStore qua public boundary.

- Bằng chứng: `frontend/src/features/feed-stock/index.ts:1-10`, `frontend/src/features/reproduction/index.ts:1-4`, `frontend/src/features/farm-workspace/index.ts:1-10`.
- Quy tắc bị lệch: `index.ts` là public API tối thiểu, chỉ chứa contract consumer ngoài feature thực sự dùng.
- Phạm vi quan sát: Feed Stock, Reproduction và Farm Workspace.
- Confidence: Verified.

### PR-10 — Medium — Authentication không tuân route-loader boundary chung

Authentication có tám page nhưng không có `routes.ts`. `LegalPage` được static export qua feature index và static import vào app route table.

- Bằng chứng: `frontend/src/features/authentication/index.ts:2-3`, `frontend/src/app/routes/AppRoutes.tsx:26`, `frontend/src/app/routes/AppRoutes.tsx:113-114`.
- Quy tắc bị lệch: mỗi feature expose lazy page loader qua `routes.ts`; route table không kéo screen qua `index.ts`.
- Phạm vi quan sát: `/terms`, `/data-policy`, authentication public boundary và entry chunk convention.
- Confidence: Verified.

### PR-11 — Medium — Feed Stock có hai hệ type và production API phụ thuộc contract mang tên demo

`FeedReceiptDraftInput` và line input nằm trong `types/feedReceiptDemo.ts` cùng các demo-store contract nhưng được production payload mapper và API sử dụng. Feature đồng thời có `types.ts` và thư mục `types/` với ownership không đồng nhất.

- Bằng chứng: `frontend/src/features/feed-stock/types/feedReceiptDemo.ts:8-65`, `frontend/src/features/feed-stock/api/feedReceiptPayload.ts:1-7`, `frontend/src/features/feed-stock/api/feedReceiptApi.ts:5-7`, `frontend/src/features/feed-stock/api/feedReceiptApi.ts:288-315`, `frontend/src/features/feed-stock/pages/FeedReceiptFormPage.tsx:20`, `frontend/src/features/feed-stock/pages/FeedReceiptFormPage.tsx:138-140`.
- Quy tắc bị lệch: production DTO/input model có owner và tên rõ; demo contract không trở thành production feature model.
- Confidence: Verified đối với naming/ownership; không có claim demo data lọt production.

### PR-12 — Medium — Session parsing và Authorization có hai nguồn role semantics

`SessionProvider` tự định nghĩa platform/farm role sets, thứ tự ưu tiên và fallback `OWNER`, trong khi Authorization cũng định nghĩa role union, farm-role set và policy điều hướng/đăng ký.

- Bằng chứng: `frontend/src/app/session/SessionProvider.tsx:12-28`, `frontend/src/app/session/SessionProvider.tsx:37-42`, `frontend/src/features/authorization/roles.ts:3-5`, `frontend/src/features/authorization/roles.ts:19-44`, `frontend/src/app/session/sessionContext.ts:2`.
- Quy tắc bị lệch: `app/session` giữ session facts và lifecycle; role/policy thuộc Authorization; app chỉ orchestration.
- Phạm vi quan sát: profile-to-session mapping, initial routing và farm/platform roles.
- Confidence: Verified đối với ownership overlap; finding này không khẳng định kết quả role hiện tại sai.

## 5. Khoảng trống của kiểm tra kiến trúc

### TG-01 — High — Import-boundary guards chỉ parse một phần cú pháp import

`importTargets` chỉ nhận relative specifier dùng nháy đơn. `valueImports` chỉ nhận một số default/named import/export dùng nháy đơn, bỏ qua nháy kép, namespace import, side-effect import và một số dynamic import hợp lệ.

- Bằng chứng: `frontend/tests/api/layerBoundary.test.ts:16-20`, `frontend/tests/api/layerBoundary.test.ts:139-147`.
- Rule phụ thuộc helper: `frontend/tests/api/layerBoundary.test.ts:25-37`, `frontend/tests/api/layerBoundary.test.ts:59-92`, `frontend/tests/api/layerBoundary.test.ts:149-180`.
- Phạm vi quan sát: shared/app/feature boundary và demo-door enforcement.
- Confidence: Verified coverage gap; source hiện tại chủ yếu dùng nháy đơn nên chưa có bằng chứng một hidden violation đang khai thác loophole.

### TG-02 — Medium — Không có automated dependency-cycle check

Boundary tests kiểm edge allow/deny nhưng không dựng graph/SCC. Các type-only cycle tại PR-08 không bị phát hiện và future value cycle không có dedicated guard.

- Bằng chứng: `frontend/tests/api/layerBoundary.test.ts:25-180`; không có cycle/circular/SCC test trong `frontend/tests` hoặc package scripts.
- Phạm vi quan sát: toàn bộ dependency graph của `frontend/src`.
- Confidence: Verified.

### TG-03 — Medium — Legacy allowlist chỉ kiểm filename

Allowlist không xác nhận consumer, reachability hoặc lý do ownership còn đúng. Vì vậy test vẫn xanh khi `components/ui.tsx` có Feed Stock consumer ngoài lý do Entry/Exit, `data/penData.ts` không có consumer và root type coupling không được đánh giá semantic.

- Bằng chứng: `frontend/tests/api/layerBoundary.test.ts:104-126`, `frontend/tests/api/layerBoundary.test.ts:172-180`.
- Phạm vi quan sát: các ngoại lệ root `api/components/data/types`.
- Confidence: Verified.

### TG-04 — Medium — Route-loader test phụ thuộc exact text pattern

Rule cho `routes.ts` và `AppRoutes` kiểm một spelling cụ thể thay vì dependency semantics. Alias, default, namespace, double-quote hoặc reformatted import không được mô hình hóa đầy đủ.

- Bằng chứng: `frontend/tests/api/layerBoundary.test.ts:42-50`.
- Phạm vi quan sát: 21 feature route module và `AppRoutes`.
- Confidence: Verified coverage gap.

### TG-05 — Needs-evidence — Claim production artifact không chứa demo chưa được tái chứng minh tại checkpoint audit

Source test đạt nhưng audit chỉ đọc không tạo lại production artifact. Vì vậy trạng thái bundle của checkpoint chỉ dựa trên evidence lịch sử trong guide, không có artifact mới từ lượt kiểm toán này.

- Bằng chứng tĩnh liên quan: `frontend/src/features/subscription/pages/TransferPage.tsx:13`, `frontend/src/features/subscription/pages/TransferPage.tsx:158`, `frontend/src/features/subscription/components/DevTransferSimulator.tsx:4`, `frontend/tests/api/layerBoundary.test.ts:157-165`.
- Phạm vi quan sát: claim loại trừ demo khỏi production bundle; không phải claim rằng demo đã lọt bundle.
- Confidence: Needs-evidence.

## 6. Phạm vi feature đã kiểm

| Feature | Kết quả phạm vi |
| --- | --- |
| account | Đã kiểm API, components, pages, hooks, validation, domain, data và boundaries. |
| authentication | Đã kiểm components, pages, hooks, validation, domain, data và route/public boundary. |
| authorization | Đã kiểm gates, role policy, session dependency và public boundary. |
| cattle | Đã kiểm API, mapper, components, pages, validation, domain, data/type ownership và boundaries. |
| farm-announcements | Đã kiểm API, components, pages, domain/validation placement, data và boundaries. |
| farm-catalogue | Đã kiểm API, components, pages, hooks, validation, domain, data và boundaries. |
| farm-overview | Đã kiểm API adapter, components, pages, validation, domain, data và boundaries. |
| farm-workspace | Đã kiểm API, components, pages, hooks, validation, domain, data và public boundary. |
| feed-stock | Đã kiểm API, components, 11 pages, validation, domain, types, data và public boundary. |
| growth | Đã kiểm API, components, pages, validation, domain, data và boundaries. |
| health | Đã kiểm API adapter, components, pages, validation, domain, data và boundaries. |
| herd-entry | Đã kiểm API, components, pages, validation, domain, data, root dependencies và boundaries. |
| herd-exit | Đã kiểm API, components, pages, domain, data, root dependencies và boundaries. |
| notifications | Đã kiểm API, components, pages, domain, data và boundaries. |
| pen-management | Đã kiểm API, components, pages, validation, domain, data, type dependencies và boundaries. |
| platform-admin | Đã kiểm API, components, pages, hooks, validation/domain placement, data và boundaries. |
| platform-finance | Đã kiểm API, components, pages, validation, domain, data và boundaries. |
| platform-service | Đã kiểm API, components, pages, validation, domain, data và cross-feature imports. |
| platform-support | Đã kiểm API, components, pages, validation/domain placement, data và boundaries. |
| reproduction | Đã kiểm API adapter, components, pages, validation/domain placement, data và public boundary. |
| subscription | Đã kiểm API, components, pages, hooks, validation placement, data và boundaries. |
| support | Đã kiểm API, components, pages, hooks, validation, domain, data và boundaries. |
| vaccination | Đã kiểm API adapter, components, pages, validation, domain, data và boundaries. |

Không phát hiện thư mục rỗng trong `frontend/src/features/**`.

## 7. Các claim bị loại khỏi problem set

Các claim sau không được xem là vấn đề đã chứng minh trong spec này:

- Wildcard Placeholder: tài liệu kiến trúc hiện ghi nhận đây là route fallback và quyết định cuối về placeholder vẫn chưa chốt.
- Việc tồn tại `demoModules` và demo store: kiến trúc hiện cho phép demo door cho dev/test; audit không có bằng chứng demo data lọt production artifact.
- Workflow trong demo store: đường dev/mock được quyết định giữ; việc chứa logic chưa tự động chứng minh production boundary sai.
- Parser Cattle khác parser shared: coercion semantics khác nhau chưa đủ bằng chứng để kết luận duplication là sai.
