# Frontend Architecture Repair Design

## 1. Intent

Thiết kế này định nghĩa cách đưa frontend BeefCare về đúng kiến trúc feature-based đã chốt mà không làm thay đổi hành vi nghiệp vụ. Nó xuất phát từ [Frontend Architecture Problem Specification](../../analysis/frontend-architecture-problem-spec.md) và dùng chiến lược **boundary-first**: khóa ranh giới bằng kiểm tra kiến trúc trước, sửa ownership/dependency nền tảng, rồi refactor từng feature theo lát dọc có thể kiểm chứng độc lập.

Thiết kế không cho phép một đợt di chuyển hàng loạt không có characterization test, không đồng thời đổi cấu trúc và hành vi, và không dùng dữ liệu giả để lấp khoảng trống backend.

## 2. Goals

- `app` chỉ sở hữu bootstrap, provider composition, routes, layouts và session facts/lifecycle.
- `shared` chỉ chứa hạ tầng và UI trung lập, không biết field, status, error code hoặc model của feature.
- Mỗi feature sở hữu API contract, mapper, types, validation, domain policy, hooks, components và pages của nó khi các thành phần đó thực sự tồn tại.
- Page chỉ ghép layout/component và gọi feature hook; use-case orchestration không nằm trong page.
- Dependency giữa feature đi qua public boundary có chủ đích và không tạo cycle, kể cả type-only cycle.
- Root legacy không còn là boundary được feature production sử dụng.
- Architecture tests phân tích dependency thực, không phụ thuộc regex/spelling dễ bỏ lọt.
- Route, role, provider order, request payload, response mapping, validation, idempotency, attachment flow và UI-visible behavior được giữ nguyên trong quá trình refactor.

## 3. Non-goals

- Không thiết kế lại UI hoặc thay đổi copy ngoài trường hợp di chuyển nguyên trạng.
- Không thay đổi backend contract, database hoặc nghiệp vụ.
- Không gộp tất cả feature vào một abstraction chung chỉ để giảm số file.
- Không bắt mọi feature tạo đủ `hooks/`, `validation/`, `domain/` hoặc `types/` nếu không có logic tương ứng.
- Không xóa `dev:mock` hoặc demo door đã được quyết định giữ cho development/test.
- Không biến `shared` thành nơi đặt mọi code được dùng từ hai nơi.
- Không xử lý các route placeholder khi product decision về chúng chưa được chốt.

## 4. Constraints

- Base được người dùng chốt ngày 21/11/2026 là remote branch `origin/dev`, không phải `LamKD`, `main`, current `HEAD` hoặc dirty working tree. Khi bắt đầu triển khai phải `git fetch origin dev`, ghi cả tên ref và resolved SHA, rồi tạo worktree riêng cùng branch `refactor/frontend-architecture` từ đúng SHA đó. Đây là quyết định explicit của người dùng và thay thế base recommendation cũ cho riêng kế hoạch này.
- Không sửa trực tiếp `dev`. Chỉ merge `refactor/frontend-architecture` về `dev` sau khi toàn bộ integration evidence được báo cáo và người dùng phê duyệt merge.
- Trước khi sửa bất kỳ symbol nào phải chạy GitNexus upstream impact analysis theo `AGENTS.md`; cảnh báo High/Critical phải được báo trước khi sửa.
- Entry, Herd Entry, payment và farm-born-calf changes phải tuân thủ contract/field-completeness audit bắt buộc nếu lát refactor chạm API, persistence hoặc conditional fields.
- Không reset, stash, commit, switch, move hoặc xóa dirty state của người dùng.
- Mỗi task phải có characterization/failing architecture test trước khi đổi source, focused test sau thay đổi, và review độc lập trước khi tích hợp.
- Production không được fallback sang demo/local data khi backend lỗi.

## 5. Approaches considered

### A. Boundary-first — selected

Architecture guards được làm đáng tin cậy trước; ownership và dependency nền tảng được sửa tiếp theo; feature được refactor sau theo lát dọc. Cách này làm lỗi kiến trúc mới bị chặn ngay trong quá trình sửa và cho phép mỗi lát có bằng chứng độc lập.

Trade-off: kết quả nhìn thấy trong UI xuất hiện chậm hơn vì giai đoạn đầu chủ yếu củng cố boundary và type ownership.

### B. Feature-first

Herd Entry, Herd Exit và Feed Stock được làm trước, sau đó mới sửa shared/root/test. Cách này cho kết quả cục bộ sớm nhưng các boundary yếu vẫn cho phép regression và các feature đầu tiên vẫn phải dựa trên ownership chưa ổn định.

### C. Big-bang

Di chuyển toàn bộ frontend trong một nhánh lớn. Cách này giảm số compatibility step nhưng làm diff quá rộng, khó chứng minh không đổi hành vi, khó review và không phù hợp với dirty state/parallel ownership rules của repository.

## 6. Target dependency model

```text
main.tsx
   │
   ▼
app ───────────────► feature public route loaders / public contracts
 │                             │
 │                             ▼
 └──────────────► shared ◄── feature internals
                               │
                               ├── pages → hooks → api → shared/api
                               ├── pages → components → shared/ui
                               ├── hooks → validation/domain/api
                               └── api → feature DTO/mapper/domain types
```

Allowed directions:

- `main → app`
- `app → shared`
- `app → feature/routes` và public feature contracts cần cho composition
- `feature → shared`
- Nội bộ một feature: `page → hook/component`, `hook → api/domain/validation`, `api → shared/api + feature types/mapper`
- Cross-feature dependency chỉ qua một public contract đã chứng minh có consumer thật.

Disallowed directions:

- `shared → app/features/legacy`
- `feature → root legacy`
- `feature A → feature B internal path`
- `page/component → shared transport` khi đó là use-case/endpoint nghiệp vụ
- `app/session → authorization policy` và `authorization → app/session` theo vòng hai chiều
- Production type/API contract đặt trong demo/root data.

## 7. Repair streams and order

### Stream 0 — Baseline and architecture enforcement

Mục tiêu là biến các rule hiện tại thành dependency checks dựa trên parser/AST, bao phủ named/default/namespace/side-effect/dynamic import và cả nháy đơn/nháy kép. Cycle detection phải phân biệt value cycle và type-only cycle. Legacy allowance phải có target, consumer scope và reason có thể kiểm tra. Route-loader rule phải kiểm semantics thay vì exact line spelling.

Stream này khóa TG-01 đến TG-04 trước khi source movement bắt đầu. TG-05 được xử lý bằng evidence của production build tại integration checkpoint, không bằng suy luận source-only.

### Stream 1 — Foundational ownership and cycles

Thứ tự dependency:

1. Role/session contract để loại ownership overlap và cycle giữa `app/session` với `authorization`.
2. Cattle/Pen contracts để loại type cycle giữa hai feature mà không tạo business model trong `shared`.
3. Entry/Exit document/payment/cattle-detail ownership để loại root type cycle.
4. Platform Service/Farm Workspace status presentation để loại hai deep import được whitelist.

Kết thúc stream, graph không còn các cycle PR-08 và không còn cross-feature deep-import PR-07.

Các quyết định ownership bắt buộc cho stream này:

- `app/session/sessionTypes.ts` sở hữu các fact types `FarmRole`, `PlatformRole`, `AppRole`, `SessionUser` và `Session`. Profile-to-session normalization là session mapping; authorization import các type/fact này và chỉ sở hữu permission, route, gate và registration policy. `app/session` không import `features/authorization`.
- `features/cattle/types.ts` tự sở hữu `CattleCode` và dùng `string | null` cho pen reference của Cattle model; `features/pen-management/types.ts` tự sở hữu `PenCode` và dùng `string` cho cattle reference trong pen links. Hai feature không import type của nhau chỉ để alias primitive. Cross-feature commands vẫn đi qua public API contract có consumer thật.
- Herd Entry tự sở hữu `EntryCattleDetail`, `EntryDocument`, `EntryPayment`; Herd Exit tự sở hữu `ExitCattleDetail`, `ExitDocument`, `ExitPayment`. Không tạo business union trong `shared/types` và không tiếp tục dùng root `types.ts`.
- `shared/ui` chỉ sở hữu neutral `AttachmentItem` view-model và UI props như `name`, `extension`, `onView`, `onRemove`; mỗi feature map domain document của mình sang view-model này.
- `Dropzone` chỉ là shared khi label, MIME, size/help copy và callbacks đều là props. `PaymentTable` thuộc Herd Exit nếu inventory vẫn chứng minh chỉ Herd Exit dùng; status-to-tone mappings thuộc từng feature.
- Platform Service và Farm Workspace tự sở hữu status presentation mapping của mình. Không có cross-feature import giữa hai domain modules và không tạo một bảng business status trong `shared`.

### Stream 2 — Shared and legacy root

Phần transport/error generic tiếp tục ở `shared/api`; field labels và mappings theo `MSG-FE*` phải có feature ownership. Root `components/ui.tsx`, `types.ts` và dead compatibility files không còn là production boundary. Neutral primitives chỉ được coi là shared khi props không mang model/copy/status nghiệp vụ.

Stream này giải quyết PR-01, PR-05 và phần root ownership của PR-06. Demo door vẫn tồn tại nhưng demo types không được làm production contract.

### Stream 3 — High-risk vertical slices

Thứ tự:

1. Herd Entry
2. Herd Exit
3. Feed Receipt
4. Feed Stock Adjustment
5. Feed Ration
6. Feed Feeding/Catalogue/Report

Mỗi lát giữ một page route/use case hoàn chỉnh và được tách theo chuỗi:

```text
page → feature hook → validation/domain → API facade → DTO mapper → shared transport
```

Không tách file chỉ theo kích thước. Boundary được xác định theo use case: load/edit draft, validate, save/post/confirm, attachment, payment hoặc Excel import. Các field/payload/round-trip có persistence phải được audit theo contract trước khi sửa.

Stream này xử lý hotspot PR-02, validation placement PR-03, legacy consumers PR-05 và Feed Stock type ownership PR-11.

### Stream 4 — Remaining feature page/use-case separation

Các feature còn lại được xếp theo cụm để giảm shared-file conflict:

- Cattle + Pen Management
- Vaccination + Health + Reproduction + Growth
- Farm Workspace + Farm Overview + Farm Announcements + Notifications
- Platform Admin + Platform Service + Platform Finance + Platform Support
- Authentication + Account + Authorization + Subscription + Support + Farm Catalogue

Một page chỉ được chuyển sang hook khi hook đại diện use case/query/mutation có tên rõ; không tạo wrapper một dòng chỉ để đạt cấu trúc. Validation chỉ tách khi rule là input/field rule; eligibility/transition/calculation vẫn thuộc domain.

### Stream 5 — API module decomposition

Sau khi page/hook boundary ổn định, bốn backend adapter lớn được phân rã theo responsibility: DTO/schema type, mapper/parser nghiệp vụ, error mapping nghiệp vụ và endpoint facade. Public API hiện tại được characterization-test trước để không thay đổi behavior.

Stream này xử lý PR-04 và phần còn lại của PR-03.

### Stream 6 — Public surface and routing consistency

Public `index.ts` được kiểm theo consumer thật; demo/test-only symbols và unused exports không còn trong production public surface. Authentication page loader tuân cùng route boundary với các feature khác. Stream này xử lý PR-09 và PR-10 sau khi dependency graph đã ổn định, tránh làm thay đổi chunking nhiều lần.

### Stream 7 — Integration evidence

Integration checkpoint phải chứng minh:

- Không có source/root/deep-import/cycle violation.
- Production artifact không chứa demo modules ngoài contract được phép.
- Route-role matrix và provider order không đổi.
- Focused unit/API/contract tests, full integration tests, typecheck và build đều chạy ở đúng stage.
- Với Entry/Exit/payment/conditional fields: payload → backend DTO/validator/service → persistence → response → UI round trip có evidence theo quy định dự án.

## 8. Task boundaries

Một implementation task là đơn vị nhỏ nhất có thể review và test độc lập. Không có task chung kiểu “refactor toàn bộ feature”. Các loại task hợp lệ:

- Một architecture guard có fixtures chứng minh pass/fail.
- Một ownership contract và toàn bộ consumer trực tiếp của contract đó.
- Một page use case hoàn chỉnh chuyển qua hook nhưng không đổi behavior.
- Một validation family được chuyển nguyên semantic cùng characterization tests.
- Một backend adapter responsibility được tách với public facade giữ nguyên.
- Một public barrel được thu hẹp dựa trên consumer inventory.

Mỗi task phải liệt kê exact files, exact interfaces, test RED/GREEN, impact result, và verification command.

## 9. Verification model

Mỗi task:

1. Ghi inventory/import graph và GitNexus impact của symbols bị sửa.
2. Viết characterization hoặc architecture test thất bại đúng vấn đề.
3. Thực hiện thay đổi nhỏ nhất để test xanh.
4. Chạy focused feature/unit/API test.
5. Trong task feature chỉ chạy exact feature-local tests theo `RTK.md`; architecture/API boundary tests, cross-feature integration, full typecheck và build chỉ chạy tại checkpoint tích hợp trên branch refactor.
6. Chạy GitNexus detect changes sau mọi structural task trước khi handoff/checkpoint, không phụ thuộc việc người dùng có yêu cầu commit hay không.
7. Review độc lập source diff và affected execution flows.

Integration stage:

- `npm run test:api`
- exact feature unit folders của các feature đã đổi
- full frontend integration suite theo `docs/agent-context/VERIFICATION.md`
- `npm run typecheck`
- `npm run build`
- artifact/demo-module inspection
- runtime route/role smoke khi scope yêu cầu

## 10. Completion criteria

- PR-01 đến PR-12 không còn tái hiện trong source/import graph.
- TG-01 đến TG-04 có automated enforcement và negative fixtures.
- TG-05 có production artifact evidence mới tại integration checkpoint.
- Không còn feature production import từ root legacy.
- Không còn cross-feature internal import hoặc type/value cycle.
- Pages không trực tiếp sở hữu multi-step use-case orchestration; mọi ngoại lệ còn lại phải có lý do cụ thể và test chứng minh.
- Validation/domain/API ownership khớp semantics, không chỉ khớp tên folder.
- Public indexes chỉ export contract có consumer ngoài feature hoặc app composition thật.
- Không có route, role, payload, persistence, validation hoặc UI behavior regression được biết.
