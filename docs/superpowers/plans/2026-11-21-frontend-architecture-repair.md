# Frontend Architecture Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor frontend BeefCare từ `origin/dev` sang kiến trúc feature-based đã chốt, loại bỏ ownership/dependency sai mà không thay đổi route, quyền, contract, persistence, validation hoặc hành vi người dùng.

**Architecture:** Thực hiện boundary-first trên một worktree riêng và một branch duy nhất `refactor/frontend-architecture`. Architecture guards được nâng cấp trước; foundational ownership và cycles được sửa tiếp theo; Herd Entry, Herd Exit và Feed Stock được refactor theo vertical slice; các feature còn lại được xử lý tuần tự; cuối cùng mới thu hẹp public surface và chạy integration evidence trước khi đề nghị merge về `dev`.

**Tech Stack:** React 18, TypeScript 5.9, Vite 5, Vitest 2, Node test runner, TypeScript Compiler API, GitNexus, Spring Boot backend contract/OpenAPI.

**Spec:** `docs/superpowers/specs/2026-11-21-frontend-architecture-repair-design.md`

**Problem evidence:** `docs/analysis/frontend-architecture-problem-spec.md`

## Global Constraints

- Base duy nhất là SHA mới fetch từ `origin/dev`; không dùng `LamKD`, `main`, current `HEAD` hoặc dirty tree.
- Tạo worktree riêng và branch `refactor/frontend-architecture`; không sửa trực tiếp `dev`.
- Không reset, stash, commit, switch, move hoặc xóa dirty state hiện tại.
- Chỉ một writable agent sở hữu worktree/branch tại một thời điểm; reviewer dùng checkpoint/read-only state riêng.
- Mỗi Checkpoint A–H là stop gate: một reviewer độc lập phải đọc exact checkpoint SHA/read-only worktree, đối chiếu acceptance của checkpoint và xác nhận không còn High/Medium finding trước khi sang WBS kế tiếp.
- Trước khi sửa function/class/method: chạy `gitnexus_impact(..., direction: upstream)`; High/Critical phải báo người dùng trước.
- Sau mọi structural task: chạy `gitnexus_detect_changes()` trước handoff/checkpoint.
- Không đổi route, role, provider order, request/response contract, validation semantics, idempotency hoặc UI copy trong cùng task với việc di chuyển code.
- Không đưa model nghiệp vụ vào `shared`; không tạo folder rỗng; không tạo wrapper hook một dòng chỉ để đạt hình thức.
- Production không fallback sang demo/local data khi backend lỗi; demo door cho dev/test được giữ nguyên.
- Entry, Herd Entry, payment và farm-born calf phải có contract/field matrix và persistence round-trip evidence khi task chạm contract/persistence/conditional field.
- WBS 4–7 feature/page tasks chỉ chạy exact feature-local unit tests. WBS 1–3 và WBS 8–9 là architecture/adapter/public-surface checkpoints nên được chạy exact API/boundary characterization ghi trong task; cross-feature integration, full typecheck và build chỉ chạy tại Checkpoint A–H/final WBS 9 gate/WBS 10 trên branch refactor.
- Commit/checkpoint chỉ thực hiện khi người dùng cho phép trong lượt triển khai; plan ghi ranh giới commit nhưng không tự cấp quyền commit.

## Review Focus

- Tài khoản có nhiều farm/platform roles phải giữ nguyên role selection, route redirect và farm scoping.
- Entry/Exit attachments, payment, conditional cattle fields và farm-born parentage không được mất dữ liệu qua round trip.
- Demo/local adapter phải tiếp tục hoạt động trong `dev:mock` nhưng không lọt production artifact.
- Type-only dependency phải không tái tạo cycle sau khi public barrels được thu hẹp.
- Page-to-hook extraction phải giữ loading/error/retry/navigation/idempotency và stale-request behavior.

## WBS 4–10 control plane (điều kiện vào/ra và thứ tự bắt buộc)

Phần này là hợp đồng điều phối chung cho WBS 4–10. Một WBS chỉ được bắt đầu khi
đủ điều kiện vào và checkpoint trước đó đã được reviewer độc lập xác nhận; không
được dùng kết quả của WBS sau để hợp thức hóa một gate trước đó bị thiếu.

| WBS | Điều kiện vào bắt buộc | Đầu ra phải bàn giao | Gate/test tối thiểu | Không được chuyển tiếp khi |
| --- | --- | --- | --- | --- |
| 4 Entry | Checkpoint C pass; contract/field matrix Entry và ownership ledger đã chốt | hook contracts, validation/domain split, persistence evidence plan | Herd Entry unit; impact trước symbol; `detect_changes` trước D | còn discrepancy về conditional field, mapper, idempotency hoặc persistence |
| 5 Exit | Checkpoint D pass; Entry không còn lỗi boundary ảnh hưởng payment/attachment; Exit/payment matrix chốt | Exit hooks, workflow sequence, payment/document rules | Herd Exit unit; payment/document characterization; readback tại E/10.3 | workflow save→check→confirm chưa được mô tả hoặc thiếu version/idempotency |
| 6 Feed Stock | Checkpoint E pass; payment/attachment contract audit hoàn tất; demo/production edge được phân loại | production command ownership, feed hooks, readback evidence | feed-stock unit; exact backend-flow tests tại F/10.3 | production còn phụ thuộc demo types/store hoặc payment field chưa có readback |
| 7 Remaining features | Checkpoint F pass; AST inventory/ledger 7.0 được reviewer duyệt | page/use-case ledger hoàn chỉnh, hooks/validation cho từng package, reviewed exceptions | exact unit folder per package; ledger diff; Checkpoint G | page chưa có classification/test link hoặc scope thay đổi làm ledger stale |
| 8 API decomposition | Checkpoint G pass; public consumers inventory không có unresolved deep import; contract audits còn hiệu lực | DTO/mapper/error ownership, facade compatibility, adapter boundaries | API characterization + affected unit after every slice; Checkpoint H | facade signature, cache invalidation, error semantics hoặc conditional mapping chưa được chứng minh |
| 9 Public surface | Checkpoint H pass; 4 facades và reviewer đã pass | export inventory, narrowed barrels, route-loader boundary | layer-boundary test sau từng barrel; final typecheck/build/API gate | export removal chưa có consumer inventory hoặc route loading chưa có test |
| 10 Integration/readiness | WBS 9 final gate pass; exact checkpoint SHA recorded | complete evidence bundle, artifact/module report, runtime smoke, merge proposal | architecture + all unit/API/integration + typecheck/build + manual smoke | có High/Medium finding, missing readback/artifact evidence, dirty/unrelated file |

### Dependency graph and handoff rules

```text
C (boundary + shared ownership)
  -> D (Entry contract + hooks + round trip)
  -> E (Exit/payment/document workflow + round trip)
  -> F (Feed Stock production/demo boundary + round trip)
  -> G (all remaining page/use-case ledger + hooks)
  -> H (frontend API adapter DTO/mapper/error decomposition)
  -> 9 (public exports + route loaders)
  -> 10.1/10.2 (architecture + unit)
  -> 10.3 (API/contract/readback)
  -> 10.4 (typecheck/build/artifact)
  -> 10.5 (runtime smoke)
  -> 10.6/10.7 (diff audit and merge proposal)
```

- D/E/F là tuần tự vì Exit và Feed Stock dùng các boundary/payment/attachment
  assumptions được củng cố ở bước trước; chỉ có các test đọc độc lập mới được
  chạy song song.
- G phải bắt đầu từ ledger 7.0 sau F, nhưng các package trong 7.1–7.18 chỉ được
  song song nếu khác feature folder, khác file ownership và không dùng chung
  route/public barrel. 7.19 luôn chạy sau package cuối cùng.
- H không được chạy song song với 9: WBS 9 cần public-consumer inventory trên
  facade sau decomposition; nếu H đổi export thì phải regenerate inventory.
- 10.1–10.2 có thể chạy song song trên cùng một checkpoint; 10.3 phụ thuộc cả
  hai. 10.4 phụ thuộc kết quả source graph của 10.1 và source state đã qua 9.
  10.5 chỉ chạy trên đúng SHA đã pass 10.3/10.4; 10.6/10.7 là hậu kiểm.

### Common stop conditions and risk register

| Mã | Rủi ro sai luồng | Dấu hiệu | Biện pháp chặn / owner |
| --- | --- | --- | --- |
| FLOW-01 | Chạy WBS 7 khi ledger/AST đã stale | page mới hoặc direct API page không có row | 7.0 regenerate + reviewer approval; dừng G |
| FLOW-02 | Adapter decomposition làm đổi contract ngầm | mapper/error snapshot hoặc facade test đổi | characterization trước mỗi slice 8.x; giữ facade signatures |
| FLOW-03 | Barrel cleanup trước khi biết consumer | import compile fail hoặc route lazy bị eager | 9.1 inventory trước; boundary test sau từng edit |
| FLOW-04 | Unit xanh nhưng persistence/conditional field mất | HTTP 2xx nhưng readback thiếu field | 4.1/5.1/6.0/7.9 matrix + 10.3 repository/service/API readback |
| FLOW-05 | Dùng artifact/route smoke từ SHA khác | evidence không cùng checkpoint | ghi SHA cho mọi artifact; 10.5 chỉ dùng SHA đã pass 10.4 |
| FLOW-06 | Reviewer tự review dirty/unrelated state | changed files ngoài WBS hoặc finding không tái hiện | checkpoint/read-only state, `git status`, `detect_changes`, diff audit 10.6 |
| FLOW-07 | Reviewer chỉ xác nhận test pass, bỏ qua dependency | gate có PASS nhưng thiếu input/output evidence | handoff template bắt buộc dependency, gate, risk, unresolved findings |

### Audit addendum — findings that block WBS 4–10

Hai review độc lập WBS 4–7 và WBS 8–10 xác nhận các điểm dưới đây là blocker
thực tế, không chỉ là thiếu mô tả:

- **BASE-01 — High:** base/đích tích hợp đang không nhất quán giữa plan
  (`origin/dev`/merge `dev`), RTK (`origin/main` hoặc `integration`) và yêu cầu
  branch `LamKD`. Phải chốt một base ref, SHA và merge target bằng user decision
  trước khi tạo implementation worktree; không suy diễn từ `HEAD`.
- **PAGE-01 — High:** `TechnicianAnnouncementRoutes.tsx`,
  `CashReportRoutes.tsx`, `ReceiptRoutes.tsx`, `FarmServiceRoutes.tsx`,
  `PaymentReconciliationRoutes.tsx`, `PlanPriceRoutes.tsx` và
  `PlatformSubscriptionRoutes.tsx` hiện có query/mutation/API orchestration.
  Không được ghi chúng là route-shell trong ledger nếu chưa tách hook hoặc có
  exception được reviewer phê duyệt.
- **EXIT-01 — High:** `herd-exit/components/DeathView.tsx` đang sở hữu query,
  mutation, check, attachment và confirm/dismiss. WBS 5.4–5.8 phải bao phủ file
  này trong workflow hook và acceptance Checkpoint E.
- **FEED-01 — High:** Feed Receipt production hiện vẫn import demo-facing types
  (`FeedReceiptDemoStore`, `FeedReceiptDemoRecord`, `FeedReceiptVoidCheckRow`).
  Chuyển hai command types là chưa đủ; phải tách toàn bộ production-facing
  contracts hoặc local/demo adapter, rồi chứng minh production→demo edge bằng 0.
- **API-01 — Medium:** trước WBS 8 phải lập consumer inventory cho mọi symbol sẽ
  di chuyển. Đặc biệt Reproduction có consumer ngoài backend/API như
  `RecordDialogs.tsx`, profile/technician tabs và test imports; `reproductionError.ts`
  và `healthValidation.ts` đã tồn tại nên phải cập nhật inventory, không coi là
  file mới. Farm Overview cần một API characterization gate tương đương các
  adapter còn lại.
- **CONTRACT-01 — High:** farm-born/conditional fields chưa được coi là chốt
  nếu FE-06/FE-11/FE-12, OpenAPI, DTO/validator/service/entity/repository và
  frontend tests chưa khớp; riêng `tagCode: null` cho đăng ký bê không thẻ phải
  được đối chiếu với FE-12/Q5 trước WBS 8. WBS 10 không phải nơi sửa thiếu sót
  contract của WBS 4–7.
- **EVIDENCE-01 — Medium:** trạng thái branch dirty, GitNexus stale, thiếu
  `frontend-page-refactor-ledger.md`, execution log, artifact manifest và
  READY_FOR_FE/API catalog evidence đều là `HOLD`, không phải cảnh báo thông tin.

Các finding này phải được gắn vào ledger/checkpoint tương ứng và đóng bằng
evidence trước khi chuyển tiếp; không đánh dấu WBS 8–10 là `READY` chỉ vì unit
tests hiện tại pass.

### Handoff evidence required at every checkpoint

Mỗi checkpoint D–H và final gate phải ghi: checkpoint SHA; branch/worktree owner;
changed/untracked files; input gate đã pass; output artifacts/ledger paths;
commands và kết quả; contract/readback evidence nếu có; GitNexus impact và
`detect_changes`; reviewer độc lập, findings theo severity; và quyết định
`GO`/`HOLD`. Thiếu một trường là `HOLD`, không phải `GO` có điều kiện.

---

## WBS 0 — Repository isolation and reproducible baseline

### Task 0.1 — Record current workspace without mutation

**Files:** None.

**Produces:** Một preflight record gồm current branch, dirty files, worktree inventory và `.worktrees` ignore status.

- [ ] Chạy `git status --short`, `git branch --show-current`, `git rev-parse HEAD` tại canonical repo.
- [ ] Chạy `git worktree list --porcelain` và ghi tất cả branch/path owners.
- [ ] Chạy `git rev-parse --git-dir`, `git rev-parse --git-common-dir`, `git rev-parse --show-superproject-working-tree`.
- [ ] Chạy `git check-ignore -v .worktrees`.
- [ ] So sánh kết quả với dirty state đã biết; dừng nếu có file người dùng mới xuất hiện chồng lên plan/docs.
- [ ] Không chạy stash/reset/restore/clean.

### Task 0.2 — Fetch and pin the exact `origin/dev` base

**Files:** None.

**Produces:** `BASE_REF=origin/dev` và một SHA đầy đủ được ghi vào execution log.

- [ ] Chạy `git fetch origin dev`.
- [ ] Chạy `git rev-parse origin/dev` và ghi SHA đầy đủ.
- [ ] Chạy `git log -1 --oneline origin/dev` và ghi timestamp/subject.
- [ ] So sánh `origin/dev` mới với audit SHA `96ef8455...`; nếu khác, chạy lại architecture inventory trước Task 0.4.
- [ ] Trước khi tạo worktree, ghi explicit user decision xác nhận base ref và merge target; nếu RTK/AGENTS chỉ định ref khác hoặc `LamKD` không tồn tại, dừng và trình bày conflict thay vì tự chọn `origin/dev`.
- [ ] Không tiếp tục nếu `origin/dev` không tồn tại hoặc fetch thất bại.

### Task 0.2A — Preserve the approved planning artifacts without importing dirty state

**External read-only evidence (canonical checkout):**
- `/Users/lam/Projects/BeefCare/docs/analysis/frontend-architecture-problem-spec.md`
- `/Users/lam/Projects/BeefCare/docs/superpowers/specs/2026-11-21-frontend-architecture-repair-design.md`
- `/Users/lam/Projects/BeefCare/docs/superpowers/plans/2026-11-21-frontend-architecture-repair.md`

- [ ] Ghi SHA-256 và `git status --short -- <three-paths>` cho đúng ba artifact; không gom bất kỳ dirty file nào khác.
- [ ] Ghi rõ ba absolute path là external read-only evidence cho worktree sắp tạo; không giả định chúng có trong `origin/dev`.
- [ ] Chỉ sau khi người dùng phê duyệt bắt đầu implementation, tạo branch-local copies cùng ba relative paths bằng `apply_patch`, rồi so sánh SHA-256/nội dung 1:1 với external evidence.
- [ ] Không dùng `cp`, stash, commit hoặc merge từ canonical dirty checkout.

### Task 0.3 — Create the isolated refactor worktree

**Files:** Worktree metadata only.

**Produces:** `.worktrees/frontend-architecture` trên branch `refactor/frontend-architecture` từ exact base SHA.

- [ ] Xác nhận branch `refactor/frontend-architecture` và path `.worktrees/frontend-architecture` chưa được dùng.
- [ ] Nếu `.worktrees` chưa được ignore, dừng và báo blocker; không tự sửa `.gitignore` ngoài scope.
- [ ] Tạo branch/worktree bằng exact SHA đã ghi, không dùng implicit `HEAD`.
- [ ] Trong worktree mới, chạy `git status --short` và xác nhận clean.
- [ ] Chạy `git merge-base --is-ancestor <base-sha> HEAD` và `git rev-parse HEAD`; cả hai phải xác nhận đúng base.
- [ ] Ghi ownership registry: branch, path, base ref/SHA, writable owner, status active.

### Task 0.4 — Refresh architecture evidence on the fetched base

**Files:** None unless GitNexus updates its own ignored index.

- [ ] Đọc lại `AGENTS.md`, `RTK.md` trong worktree và ba artifact đã checksum từ branch-local copies/external read-only paths.
- [ ] Kiểm GitNexus context freshness; nếu stale, chạy `npx gitnexus analyze` tại worktree.
- [ ] Dựng inventory số feature, pages, hooks, root legacy files, import edges và cycles.
- [ ] Đối chiếu PR-01…PR-12/TG-01…TG-05 với base mới.
- [ ] Nếu thay đổi chỉ là path/line drift không đổi scope, cập nhật evidence references và cho independent reviewer xác nhận.
- [ ] Nếu finding biến mất, owner/dependency hướng thay đổi hoặc acceptance scope thay đổi materially: DỪNG; lập plan revision, independent re-review và xin người dùng phê duyệt lại trước khi code.
- [ ] Chạy baseline `npm run test:api` tại `frontend/`.
- [ ] Chạy full unit/integration commands đúng `docs/agent-context/VERIFICATION.md`.
- [ ] Chạy `npm run typecheck` và `npm run build`.
- [ ] Ghi pass/fail từng command; dừng nếu baseline red chưa được giải thích.

---

## WBS 1 — Architecture enforcement before source movement

### Task 1.1 — Build an AST import parser

**Files:**
- Create: `frontend/tests/api/support/importGraph.ts`
- Create: `frontend/tests/api/importGraph.test.ts`
- Modify later: `frontend/tests/api/layerBoundary.test.ts`

**Interfaces:**
- Produces `ImportEdge { source, target, specifier, kind: 'value' | 'type' | 'dynamic' | 'side-effect' }`.
- Produces `parseImportEdges(file, sourceText): ImportEdge[]`.

- [ ] Write tests for single-quoted named import.
- [ ] Write tests for double-quoted import.
- [ ] Write tests for namespace import, side-effect import, type-only import, re-export and dynamic import.
- [ ] Run only `importGraph.test.ts`; confirm RED because parser does not exist.
- [ ] Implement parser with TypeScript Compiler API; do not use regex for import discovery.
- [ ] Resolve relative specifiers under `src`; retain unresolved/external specifiers as explicit metadata.
- [ ] Run test again; confirm all parser cases GREEN.
- [ ] Run `gitnexus_detect_changes()` and record only test-support symbols affected.

### Task 1.2 — Build dependency graph and SCC detection

**Files:**
- Modify: `frontend/tests/api/support/importGraph.ts`
- Modify: `frontend/tests/api/importGraph.test.ts`

**Interfaces:**
- Produces `buildSourceGraph(srcDir): SourceGraph`.
- Produces `findStronglyConnectedComponents(graph, { includeTypeEdges }): string[][]`.

- [ ] Add fixture graph with no cycle.
- [ ] Add value-cycle fixture A→B→A.
- [ ] Add type-only cycle fixture and assert it appears only when `includeTypeEdges=true`.
- [ ] Add self-import/unresolved/external edge cases.
- [ ] Run tests and confirm new cases RED.
- [ ] Implement deterministic SCC output sorted by normalized source path.
- [ ] Run tests and confirm GREEN.
- [ ] Run graph against current `frontend/src`; snapshot the three known type-only cycles and zero value cycles.

### Task 1.3 — Replace regex boundary scanning with graph semantics

**Files:**
- Modify: `frontend/tests/api/layerBoundary.test.ts:16-180`
- Test: `frontend/tests/api/importGraph.test.ts`

- [ ] Write a regression case proving a double-quoted forbidden shared→feature import is detected.
- [ ] Write regression cases for namespace and dynamic demo imports.
- [ ] Run architecture tests; confirm RED against current regex helper.
- [ ] Replace `importTargets` and `valueImports` consumers with AST graph queries.
- [ ] Preserve all existing boundary assertions and existing allowed paths.
- [ ] Run `node --import tsx --import ./tests/node/setup.ts --test tests/api/importGraph.test.ts tests/api/layerBoundary.test.ts`.
- [ ] Confirm current source still reports only documented exceptions.

### Task 1.4 — Add explicit cycle guards

**Files:**
- Modify: `frontend/tests/api/layerBoundary.test.ts`

- [ ] Add value-cycle assertion with an empty allowlist.
- [ ] Add type-cycle assertion listing only the three current cycles with exact paths and expiry reason.
- [ ] Run test and confirm it reports the current type cycles.
- [ ] Make output show the complete cycle path, not only SCC members.
- [ ] Do not mark current cycles permanently acceptable; label them migration exceptions tied to PR-08 tasks.
- [ ] Run architecture tests GREEN with temporary exact exceptions.

### Task 1.5 — Make legacy allowance consumer-aware

**Files:**
- Modify: `frontend/tests/api/layerBoundary.test.ts:104-126`

**Interfaces:**
- Replace string reason with `{ owner, allowedConsumers, runtime, reason, removalTask }`.

- [ ] Add failing assertion for Feed Stock consuming `components/ui.tsx` when allowance says Entry/Exit only.
- [ ] Add failing assertion for a legacy file with no inbound consumers and no explicit `dead-until-removal` state.
- [ ] Add failing assertion for feature production type imports from root `data/`.
- [ ] Run test and capture expected failures for PR-05/PR-06.
- [ ] Encode exact current exceptions temporarily with removal task IDs; do not broaden to arbitrary feature globs.
- [ ] Run tests GREEN and record all remaining legacy edges.

### Task 1.6 — Make route-loader checks semantic

**Files:**
- Modify: `frontend/tests/api/layerBoundary.test.ts:42-50`
- Test: `frontend/tests/api/importGraph.test.ts`

- [ ] Add fixture with formatted/multiline valid lazy loader.
- [ ] Add invalid static page import fixture.
- [ ] Add invalid loader re-exported through feature index fixture.
- [ ] Add invalid dynamic import targeting component/API instead of `pages/`.
- [ ] Confirm old exact-line matcher fails the valid multiline fixture.
- [ ] Implement AST rule: `routes.ts` exports only zero-arg loaders returning `import('./pages/...')`.
- [ ] Implement AppRoutes rule: feature screens enter only through feature `routes.ts` loaders.
- [ ] Run parser + layer boundary tests GREEN.

**Checkpoint A (stop gate):** Architecture guards are semantic, current exceptions are explicit, no production source has moved, and an independent reviewer reports no High/Medium finding.

---

## WBS 2 — Foundational ownership and dependency direction

### Task 2.1 — Characterize session-role mapping

**Files:**
- Test: `frontend/tests/unit/auth/sessionRoles.test.tsx`
- Test: `frontend/tests/integration/auth/authSessionLifecycle.test.tsx`
- Read: `frontend/src/app/session/SessionProvider.tsx:12-49`
- Read: `frontend/src/features/authorization/roles.ts`

- [ ] Run GitNexus context/impact for `sessionFromProfile`, `SessionUser`, `homePathForSession`, `roleInFarm`.
- [ ] Add/confirm cases: platform role priority, selected farm role, no selected farm, multi-farm priority, invited manager/technician, new owner without farm, stale farm selection.
- [ ] Run exact auth/session tests; confirm characterization GREEN before moving types.

### Task 2.2 — Establish one-way session fact types

**Files:**
- Create: `frontend/src/app/session/sessionTypes.ts`
- Modify: `frontend/src/app/session/sessionContext.ts`
- Modify: `frontend/src/app/session/SessionProvider.tsx`
- Modify: `frontend/src/features/authorization/roles.ts`
- Modify: `frontend/src/features/authorization/index.ts`

**Interfaces:**
- `FarmRole`, `PlatformRole`, `AppRole`, `SessionUser`, `Session` exported by `app/session/sessionTypes.ts`.
- Authorization consumes these types; app/session imports no authorization module.

- [ ] Run impact analysis for every exported role/session symbol.
- [ ] Move only type/fact declarations first; keep runtime policy unchanged.
- [ ] Update `sessionContext.ts` to import local session types.
- [ ] Update authorization to import session types from app/session public module.
- [ ] Remove `SessionProvider` import from `features/authorization`.
- [ ] Run auth/session unit tests.
- [ ] Run cycle guard; confirm session↔authorization type cycle disappears.
- [ ] Run GitNexus detect changes and record affected auth/session flows.

### Task 2.3 — Separate session normalization from authorization policy

**Files:**
- Create: `frontend/src/app/session/sessionProfile.ts`
- Modify: `frontend/src/app/session/SessionProvider.tsx`
- Modify: `frontend/src/features/authorization/roles.ts`
- Test: `frontend/tests/unit/auth/sessionRoles.test.tsx`

**Interfaces:**
- `sessionFromProfile(value, selectedFarmId): SessionUser` performs DTO normalization only.
- Authorization retains `canRecordCare`, `needsOwnerRegistration`, `homePathFor`, `homePathForSession`.

- [ ] Extract profile parsing without changing priority/fallback behavior.
- [ ] Remove duplicate role-array declarations where fact type guards can be imported one-way.
- [ ] Keep navigation/permission decisions in authorization.
- [ ] Run exact auth/session tests.
- [ ] Confirm `app/session` has no import from `features/authorization`.

### Task 2.4 — Characterize Cattle/Pen type contracts

**Files:**
- Test: `frontend/tests/api/cattleApi.test.ts`
- Test: `frontend/tests/api/penApi.test.ts`
- Test: `frontend/tests/integration/pens/penCattleMoveIntegration.test.tsx`
- Read: `frontend/src/features/cattle/types.ts`
- Read: `frontend/src/features/pen-management/types.ts`

- [ ] Impact-analyze `CattleCode`, `PenCode`, `PenCowLink`, `Cattle` and `Pen`.
- [ ] Assert cattle pen values and pen cattle-link values remain plain serialized strings.
- [ ] Assert move commands still accept the same codes and payloads.
- [ ] Run cattle/pens focused tests GREEN.

### Task 2.5 — Remove the Cattle/Pen type cycle

**Files:**
- Modify: `frontend/src/features/cattle/types.ts:1`
- Modify: `frontend/src/features/pen-management/types.ts:1-7`
- Modify import sites reported by TypeScript.

- [ ] Replace cross-feature alias imports with feature-local aliases/primitives as specified by design.
- [ ] Do not change runtime values or JSON shape.
- [ ] Run exact cattle and pens unit folders.
- [ ] Run architecture cycle guard; confirm cycle removed.
- [ ] Run detect-changes and inspect move/list/profile execution flows.

### Task 2.5A — Move the production Cattle model out of legacy demo data

**Files:**
- Modify: `frontend/src/features/cattle/types.ts`
- Modify: `frontend/src/data/cowsData.ts`
- Modify: `frontend/src/features/cattle/api/cattleApi.ts`
- Modify: `frontend/src/features/cattle/api/cattleBackendApi.ts`
- Modify: `frontend/src/features/cattle/api/cattleMapper.ts`
- Modify: `frontend/src/features/cattle/api/scanApi.ts`
- Modify: `frontend/src/features/cattle/data/cattleLocalStore.ts`
- Modify exact consumers: `BarnsTab.tsx`, `CowHeader.tsx`, `MoveModal.tsx`, `OverviewTab.tsx`, `QrReissueModal.tsx`, `QrTab.tsx`, `RecordEditModal.tsx`, `TechnicianHerd.tsx`, `TechnicianProfile.tsx`, `TimelineTab.tsx`, `UpdateModal.tsx`, `pages/CowList.tsx`
- Tests: `frontend/tests/api/cattleApi.test.ts`, `frontend/tests/api/cattleApiContract.test.ts`, `frontend/tests/unit/cattle/**`

**Interfaces:** `CattleViewModel` (hoặc tên domain hiện hành được inventory xác nhận) sở hữu production fields hiện nằm trong `CowSeed`; `cowsData.ts` chỉ còn seeded records/demo constants và import model từ Cattle, không export production contract.

- [ ] Impact-analyze `CowSeed`, `mapCattle`, Cattle API return signatures và 17 inbound consumers.
- [ ] Thêm compile-time/mapper characterization cho toàn bộ property, optionality và backend mapping hiện tại; chạy `npx vitest run tests/unit/cattle/CattleBackendRound2.test.ts tests/unit/cattle/CowList.backend-purpose.test.tsx` GREEN.
- [ ] Tạo production-owned model trong `features/cattle/types.ts` với structural parity; không đổi JSON/UI semantics.
- [ ] Đổi mapper/API/local-store và exact 12 UI/page consumers sang production model.
- [ ] Đổi demo records trong `data/cowsData.ts` sang import model; không để production module nào import `data/cowsData.ts`.
- [ ] Chạy `npx vitest run tests/unit/cattle` và ghi kết quả; API contract suite được defer tới Checkpoint B theo global test staging.
- [ ] Chạy AST guard: production→`data/cowsData.ts` = 0; nếu demo records không còn consumer, chỉ xóa trong một task cleanup riêng.
- [ ] Chạy `gitnexus_detect_changes()` và đối chiếu Cattle list/profile/scan processes.

### Task 2.6 — Define feature-local Entry contracts

**Files:**
- Modify: `frontend/src/features/herd-entry/types.ts`
- Modify: `frontend/src/features/herd-entry/api/herdEntryMapper.ts`
- Modify: `frontend/src/features/herd-entry/api/herdEntryBackendApi.ts`
- Modify: `frontend/src/features/herd-entry/api/herdEntryLocalApi.ts`
- Modify consumers under `frontend/src/features/herd-entry/**`
- Test: `frontend/tests/api/herdEntryBackendApi.test.ts`
- Test: `frontend/tests/unit/herd-entry/**`

**Interfaces:**
- Add `EntryCattleDetail`, `EntryDocument`, `EntryPayment` in feature types.
- Preserve exact existing property names and optionality until contract audit says otherwise.

- [ ] Complete Entry field matrix for cattle lines, documents and payments from SRS/OpenAPI/backend DTO/entity.
- [ ] Impact-analyze root `CattleDetail`, `DocumentRow`, `Payment` and Entry mapper symbols.
- [ ] Add type/mapper characterization tests for all existing fields.
- [ ] Introduce feature-local types with structural parity.
- [ ] Update Entry-only imports; do not touch Exit in this task.
- [ ] Run exact Herd Entry unit tests; defer backend/API suites to Checkpoint B and WBS 10.3.
- [ ] Confirm no Herd Entry production file imports root `types.ts`.

### Task 2.7 — Define feature-local Exit contracts

**Files:** Same pattern under `frontend/src/features/herd-exit/**`.

**Interfaces:** `ExitCattleDetail`, `ExitDocument`, `ExitPayment`.

- [ ] Complete Exit/payment/document field matrix and round-trip source list.
- [ ] Impact-analyze Exit mapper/API/type symbols.
- [ ] Add structural characterization tests.
- [ ] Introduce feature-local types without changing payload/response shape.
- [ ] Update Exit-only imports.
- [ ] Run exact Herd Exit unit tests; defer backend/API suites to Checkpoint B and WBS 10.3.
- [ ] Confirm no Herd Exit production file imports root `types.ts`.

### Task 2.8 — Decouple Platform Service status presentation

**Files:**
- Create: `frontend/src/features/platform-service/domain/statusViews.ts`
- Modify: `frontend/src/features/platform-service/domain/reconciliation.ts`
- Modify: `frontend/src/features/platform-service/domain/servicePeriods.ts`
- Test: `frontend/tests/unit/platform-service/platformServiceApi.test.ts`
- Test: `frontend/tests/unit/farm-workspace/statusViews.test.tsx`

- [ ] Characterize labels/tones for every imported payment/service state.
- [ ] Copy only Platform Service-owned presentation mapping to its domain.
- [ ] Remove both deep imports into Farm Workspace internals.
- [ ] Run exact Platform Service and Farm Workspace tests.
- [ ] Remove the two deep-import exceptions from architecture test.
- [ ] Confirm cross-feature deep-import list is empty.

**Checkpoint B (stop gate):** All three type cycles are removed, deep-import allowlist is empty, session-role behavior is unchanged, deferred API/boundary checks pass, and an independent reviewer reports no High/Medium finding.

---

## WBS 3 — Shared API errors and legacy root UI/types

### Task 3.1 — Freeze generic error behavior

**Files:**
- Test: `frontend/tests/unit/api/userFacingError.test.ts`
- Read: `frontend/src/shared/api/userFacingError.ts`

- [ ] Add cases for 401/403, 404, timeout, 5xx, network, unknown and generic validation errors.
- [ ] Separate tests for every current `MSG-FE*` mapping and field label.
- [ ] Run tests GREEN before extraction.

### Task 3.2 — Create feature error adapters

**Files:**
- Create: `features/pen-management/api/penError.ts`
- Create: `features/cattle/api/cattleError.ts`
- Create: `features/herd-entry/api/herdEntryError.ts`
- Create: `features/reproduction/api/reproductionError.ts`
- Create/extend: `features/farm-catalogue/api/catalogueError.ts`
- Create/extend: `features/platform-finance/api/financeError.ts`
- Tests in each feature unit folder.

**Interfaces:** Each adapter exposes `<feature>Error(error, fallback): string` and delegates only transport-generic cases to shared.

- [ ] Map each `MSG-FE04`, `05`, `06`, `12`, `18`, `21` code to exactly one feature owner.
- [ ] Move feature field labels with their code mappings.
- [ ] Add exact message tests before changing consumers.
- [ ] Run each focused feature test folder.

### Task 3.3 — Migrate business-error consumers

**Files:** Consumer inventory from `rg userFacingError` in the six owning features.

- [ ] Update Pen consumers and run pens tests.
- [ ] Update Cattle consumers and run cattle tests.
- [ ] Update Herd Entry consumers and run herd-entry tests.
- [ ] Update Reproduction consumers and run reproduction tests.
- [ ] Update Catalogue consumers and run farm-catalogue tests.
- [ ] Update Platform Finance consumers and run platform-finance tests.
- [ ] Keep other features on generic `userFacingError` only if they consume no feature code/field mapping.

### Task 3.4 — Reduce shared error module to transport-generic behavior

**Files:**
- Modify: `frontend/src/shared/api/userFacingError.ts`
- Modify: `frontend/tests/unit/api/userFacingError.test.ts`

- [ ] Remove all business field labels and `MSG-FE*` branches.
- [ ] Retain transport status/network/unknown formatting only.
- [ ] Run shared error tests.
- [ ] Add architecture assertion that shared source contains no `MSG-FE` token.

### Task 3.5 — Introduce neutral attachment UI

**Files:**
- Create: `frontend/src/shared/ui/AttachmentList/AttachmentList.tsx`
- Create: `frontend/src/shared/ui/FileDropzone/FileDropzone.tsx`
- Modify: `frontend/src/shared/ui/index.ts`
- Test: `frontend/tests/unit/shared/AttachmentList.test.tsx`
- Test: `frontend/tests/unit/shared/FileDropzone.test.tsx`

**Interfaces:**
- `AttachmentItem { key: string; name: string; extension?: string }`.
- `AttachmentList({ items, onView?, onRemove? })`.
- `FileDropzone({ label, hint?, accept, multiple, onFiles })`.

- [ ] Characterize keyboard, click, drag/drop, view and remove behavior from root UI.
- [ ] Write RED tests for neutral props and accessible names.
- [ ] Implement without importing any feature/root type.
- [ ] Run shared UI tests.

### Task 3.6 — Migrate Entry/Exit/Feed Stock attachment consumers

**Files:** All current importers of `components/ui.tsx` listed in PR-05.

- [ ] Add feature-local document→`AttachmentItem` mapping in Entry.
- [ ] Update Entry pages and run Entry document tests.
- [ ] Add feature-local mapping in Exit.
- [ ] Update Exit pages/components and run Exit document tests.
- [ ] Add Feed Stock mapping for receipt/payment/adjustment attachments.
- [ ] Update three Feed Stock consumers and run attachment/form tests.
- [ ] Confirm no consumer imports root `components/ui.tsx` for Docs/Dropzone.

### Task 3.7 — Move remaining root business UI to its owner

**Files:**
- Create/move: `frontend/src/features/herd-exit/components/PaymentTable.tsx`
- Modify: `frontend/src/features/herd-exit/pages/ExportDetail.tsx`
- Remove unused root `StatusBadge` after consumer scan.
- Modify feature-local status mappings only if currently importing root mapping.

- [ ] Confirm PaymentTable consumer inventory is still Herd Exit-only.
- [ ] Characterize amount/date/method rendering.
- [ ] Move with no visual/copy change.
- [ ] Confirm root StatusBadge has zero consumers; remove only then.
- [ ] Run Herd Exit focused tests.

### Task 3.8 — Remove resolved root compatibility files

**Files:**
- Remove when zero consumers: `frontend/src/components/ui.tsx`, `frontend/src/types.ts`, `frontend/src/data/penData.ts`
- Modify: `frontend/tests/api/layerBoundary.test.ts`

- [ ] Run inbound-import inventory for each target.
- [ ] Remove compatibility re-exports only after source and tests have zero consumers.
- [ ] Remove corresponding allowlist entries.
- [ ] Run architecture tests and cycle guard.
- [ ] Run TypeScript compile at architecture checkpoint.

**Checkpoint C (stop gate):** Shared is business-neutral and root UI/types compatibility boundaries are gone. Any remaining root business/legacy edge blocks WBS 4 until an explicit remediation task is approved. Independent reviewer must report no High/Medium finding.

---

## WBS 4 — Herd Entry vertical slices

### Task 4.1 — Complete mandatory Herd Entry contract audit

**Files:** Documentation/evidence only.

- [ ] Read D12, FE-06 spec, relevant SRS sections, OpenAPI operations and backend DTO/entity/validator/service/resource.
- [ ] Build field matrix for voucher fields, purchase cattle lines, farm-born calves, payments and documents.
- [ ] Tách riêng pre-entry history, trading partner, farm-born parentage read-only, pending calf và death-before-registration; không gom tất cả vào một hàng “voucher fields”.
- [ ] Record required/optional/conditional rules, types, ranges, defaults and source of truth.
- [ ] Trace payload→DTO→validator→service→entity→response→frontend mapping.
- [ ] Record persistence readback evidence requirements for each persisted field.
- [ ] Stop if any source discrepancy needs product decision.

### Task 4.2 — Extract Entry list query hook

**Files:**
- Create: `features/herd-entry/hooks/useEntryList.ts`
- Modify: `features/herd-entry/pages/ImportList.tsx`
- Test: existing/new `tests/unit/herd-entry/ImportList.test.tsx`

**Produces:** `useEntryList(filters)` returning `{ rows, loading, error, refetch, summary }`.

- [ ] Characterize initial null data, filter counts, loading/error/retry.
- [ ] Write hook test RED.
- [ ] Move query/filter orchestration only.
- [ ] Keep rendering in page.
- [ ] Run exact Herd Entry unit folder.

### Task 4.3 — Extract Entry detail query/actions hook

**Files:**
- Create: `features/herd-entry/hooks/useEntryDetail.ts`
- Modify: `features/herd-entry/pages/ImportDetail.tsx`
- Test: Entry detail/document/payment tests.

- [ ] Characterize ID lookup, refresh, void/cancel availability and document view.
- [ ] Move API/query/mutation orchestration to hook.
- [ ] Keep page composition and modal visibility in page unless shared across actions.
- [ ] Run focused tests.

### Task 4.4 — Extract Entry editor state model

**Files:**
- Create: `features/herd-entry/hooks/useEntryEditor.ts`
- Create: `features/herd-entry/domain/entryTotals.ts`
- Modify: `features/herd-entry/pages/ImportNew.tsx:91-218`
- Test: `HerdEntryBusinessRules`, farm-born and required-field tests.

**Produces:** editor state/actions plus pure totals/capacity selectors.

- [ ] Characterize defaults, selected type, pricing, cattle/calves, totals and pen capacity warnings.
- [ ] Move pure calculations first with tests.
- [ ] Move state transitions without API calls second.
- [ ] Keep JSX unchanged.
- [ ] Run focused tests.

### Task 4.5 — Extract Entry validation orchestration

**Files:**
- Modify: `features/herd-entry/validation/entryValidation.ts`
- Create: `features/herd-entry/validation/entryFormValidation.ts`
- Modify: `features/herd-entry/pages/ImportNew.tsx:264-349`
- Test: `entryValidation.test.ts`, RowEdit required/weight tests.

- [ ] Map every page inline check to field matrix row.
- [ ] Move only required/range/date/file/inter-field rules.
- [ ] Keep eligibility/state policy in domain.
- [ ] Preserve error keys and Vietnamese messages exactly.
- [ ] Run focused validation tests.

### Task 4.6 — Extract Entry draft/post workflow hook

**Files:**
- Create: `features/herd-entry/hooks/useEntryDraftWorkflow.ts`
- Modify: `features/herd-entry/pages/ImportNew.tsx:298-369`
- Test: Entry backend flow and lifecycle integration tests at later checkpoint.

**Produces:** `saveDraft`, `postEntry`, `saving`, `error`, `result` with stable idempotency semantics.

- [ ] Characterize save/post order and navigation.
- [ ] Characterize backend error-to-field mapping.
- [ ] Move payload assembly to existing API mapper, not hook.
- [ ] Move mutation orchestration to hook.
- [ ] Run exact Herd Entry unit tests.

### Task 4.7 — Extract Entry attachment workflow

**Files:**
- Create: `features/herd-entry/hooks/useEntryAttachments.ts`
- Modify: `features/herd-entry/pages/ImportNew.tsx`
- Test: `EntryDocuments.test.tsx`, `ImportNew.files.test.tsx`.

- [ ] Characterize local selection, persisted list, upload retry, view, remove and file limits.
- [ ] Move attachment state/mutations to hook.
- [ ] Preserve shared UI neutral props.
- [ ] Run focused tests.

### Task 4.8 — Extract Excel import workflow

**Files:**
- Create: `features/herd-entry/hooks/useEntryExcelImport.ts`
- Modify: `features/herd-entry/components/ExcelModal.tsx`
- Modify: `features/herd-entry/pages/ImportNew.tsx`
- Test: `ExcelModal.test.tsx` and parser/domain tests.

- [ ] Characterize template parse, row errors, merge/replace behavior and modal state.
- [ ] Keep pure Excel parsing in `domain/entryExcel.ts`.
- [ ] Move orchestration to hook.
- [ ] Run focused tests.

### Task 4.9 — Make `ImportNew` a composition page

**Files:**
- Modify: `features/herd-entry/pages/ImportNew.tsx`
- Optionally create focused feature components only when a JSX section has a stable prop contract.

- [ ] Verify page no longer imports feature API directly.
- [ ] Verify page calls editor/workflow/attachment/Excel hooks.
- [ ] Verify no inline field validation or payload mapping remains.
- [ ] Run all Herd Entry unit tests.
- [ ] At integration checkpoint run Entry API/integration/contract round trip.

**Checkpoint D (stop gate):** Herd Entry route behavior and full persisted field matrix remain unchanged, page is composition-only, and an independent reviewer reports no High/Medium finding.

---

## WBS 5 — Herd Exit vertical slices

### Task 5.1 — Complete mandatory Herd Exit/payment contract audit

- [ ] Read FE-13/SRS/OpenAPI/backend DTO/entity/validator/service/resource.
- [ ] Build matrices for sale, death/missing, cull/other, cattle lines, checks, payment and documents.
- [ ] Record conditional fields and state transitions.
- [ ] Ghi rõ PENDING → CONFIRMED/DISMISSED, owner-only actions và death/missing voucher không có tiền; map từng điều kiện vào UI/API/backend test.
- [ ] Trace confirm/void/dismiss/collection persistence round trip.
- [ ] Stop on discrepancies.

### Task 5.2 — Create Exit validation layer

**Files:**
- Create: `features/herd-exit/validation/exitValidation.ts`
- Create: `features/herd-exit/validation/exitFileValidation.ts`
- Modify: `features/herd-exit/pages/ExportNew.tsx:112-145,220-253`
- Tests: existing required-field/document tests plus new pure validation tests.

- [ ] Characterize every inline check and message.
- [ ] Separate field/file/inter-field validation from checks/eligibility policy.
- [ ] Move rules with identical error keys/messages.
- [ ] Run focused tests.

### Task 5.3 — Extract Exit list hook

**Files:** Create `hooks/useExitList.ts`; modify `pages/ExportList.tsx`.

- [ ] Characterize tabs, counts, totals, pending confirmations and retry.
- [ ] Move query/filter/summary orchestration.
- [ ] Run Herd Exit focused tests.

### Task 5.4 — Extract Exit detail hook

**Files:** Create `hooks/useExitDetail.ts`; modify `pages/ExportDetail.tsx`, `components/DeathView.tsx` and any exact dialog/component named by the ledger.

- [ ] Characterize detail loading, cancellation eligibility, payment table and documents.
- [ ] Move data/actions from both `ExportDetail` and `DeathView` to hooks; `DeathView` is not a route-shell-only consumer because it currently owns checks, attachments and confirm/dismiss mutations.
- [ ] Run detail/cancel tests.

### Task 5.5 — Extract Exit picker/editor state

**Files:**
- Create: `hooks/useExitEditor.ts`
- Modify: `pages/ExportNew.tsx:71-218`
- Keep: `domain/exitDraft.ts`, `domain/occupancy.ts` for pure rules.

- [ ] Characterize QR/manual pick, deduplication, pricing, estimated weights, barn delta and totals.
- [ ] Move state/calculations without API behavior changes.
- [ ] Run picker/pricing/pen-shift tests.

### Task 5.6 — Extract Exit save/check/confirm workflow

**Files:** Create `hooks/useExitWorkflow.ts`; modify `pages/ExportNew.tsx:201-291`.

- [ ] Characterize save→upload→checks→confirm sequence.
- [ ] Characterize warning acknowledgement, partial upload retry and response-loss reconciliation.
- [ ] Preserve idempotency keys and expected version.
- [ ] Run exact Exit unit tests; integration flow at checkpoint.

### Task 5.7 — Extract Exit documents and collection workflow

**Files:** Create `hooks/useExitAttachments.ts`, `hooks/useExitCollection.ts`; modify page/modal consumers.

- [ ] Characterize document add/view/remove/retry.
- [ ] Characterize collection amount/method/date/version validation.
- [ ] Move mutation orchestration to hooks.
- [ ] Run document/collection tests.

### Task 5.8 — Make `ExportNew` a composition page

- [ ] Remove direct API imports from page.
- [ ] Remove inline validation/payload/orchestration.
- [ ] Preserve JSX/copy/layout.
- [ ] Run all Herd Exit unit tests.
- [ ] At integration checkpoint run all four Herd Exit integration flows and persistence checks.
- [ ] Include the Death/Missing flow rendered by `DeathView` in the Checkpoint E acceptance matrix: pending→confirmed/dismissed, owner-only actions, no-money death voucher, checks, attachments and expected-version/idempotency behavior.

**Checkpoint E (stop gate):** Herd Exit/payment/document behavior is unchanged, page is composition-only, and an independent reviewer reports no High/Medium finding.

---

## WBS 6 — Feed Stock vertical slices

### Task 6.0 — Audit Feed Receipt payment and attachment contracts before editing

**Files/evidence:** `api/feedReceiptApi.ts`, `api/feedReceiptPayload.ts`, `types/feedReceipt.ts`, `types/feedReceiptDemo.ts`, `domain/feedReceiptForm.ts`, `validation/feedReceiptValidation.ts`, OpenAPI receipt/payment/attachment operations, backend DTO/validator/service/entity/repository paths found by contract trace.

- [ ] Build a field matrix for draft lines, totals, initial/subsequent payments, due date, method, receipt attachments and payment attachments.
- [ ] Đối chiếu FE-23/D12, supplier quick-create, lot/expiry, stock side effects và role matrix D41 (Owner/Manager) trong field/permission matrix.
- [ ] Trace form → payload → HTTP → backend DTO/validator/service → persistence → response → frontend state; record id/version/idempotency fields.
- [ ] Add readback requirements for every persisted payment/attachment field; HTTP success alone is insufficient.
- [ ] Stop for a product decision if OpenAPI, backend validation, persistence and UI disagree.

### Task 6.1 — Give Feed Receipt production commands a production owner

**Files:** Create `types/feedReceiptCommand.ts`; modify `types/feedReceiptDemo.ts`, `api/feedReceiptPayload.ts`, `api/feedReceiptApi.ts`, `data/feedReceiptDemoStore.ts`, `pages/FeedReceiptFormPage.tsx`.

**Interfaces:** Move `FeedReceiptDraftInput` and `FeedReceiptDraftLineInput` unchanged to `types/feedReceiptCommand.ts`; keep `FeedReceiptDemoRecord`, `FeedReceiptDemoStore` and demo-stock contracts in `feedReceiptDemo.ts`.

- [ ] Characterize command shape with `FeedReceiptApi.test.ts`, `FeedReceiptData.test.ts`, `FeedReceiptForm.test.tsx`, `FeedReceiptDetail.test.tsx`.
- [ ] Move only the two production command types; update payload/API/page imports without changing field shape.
- [ ] Ensure production files have zero import from `feedReceiptDemo.ts` and zero demo-facing type edges, including `FeedReceiptDemoStore`, `FeedReceiptDemoRecord` and `FeedReceiptVoidCheckRow`; move production-facing response/command contracts to a neutral feature-owned module and keep the demo adapter one-way.
- [ ] Run `npx vitest run tests/unit/feed-stock/FeedReceiptApi.test.ts tests/unit/feed-stock/FeedReceiptData.test.ts tests/unit/feed-stock/FeedReceiptForm.test.tsx tests/unit/feed-stock/FeedReceiptDetail.test.tsx`.

### Task 6.2 — Extract Feed Catalogue queries and commands

**Files:** Create `hooks/useFeedCatalogue.ts`; modify `pages/FeedCataloguePage.tsx`; consume `api/feedCatalogueApi.ts`, `api/feedStockApi.ts`.

- [ ] Add hook tests for items/suppliers/stock query and refetch/error state.
- [ ] Extract separately: save item, availability, save supplier, supplier-active commands.
- [ ] Run `npx vitest run tests/unit/feed-stock/FeedCatalogueApi.test.ts tests/unit/feed-stock/FeedCataloguePage.test.tsx` after each command slice.

### Task 6.3 — Extract Feed Consumption report

**Files:** Create `hooks/useFeedConsumptionReport.ts`, `validation/feedConsumptionValidation.ts`; modify `pages/FeedConsumptionReportPage.tsx`; retain pure calculation in `domain/feedConsumptionReport.ts`.

- [ ] Extract period field validation without changing messages.
- [ ] Extract `{from,to}`-keyed query plus retry/refetch.
- [ ] Run `npx vitest run tests/unit/feed-stock/FeedConsumptionApi.test.ts tests/unit/feed-stock/FeedConsumptionData.test.ts`.

### Task 6.4 — Extract Feed Session use cases

**Files:** Create `hooks/useFeedFeeding.ts`; modify `pages/FeedFeedingPage.tsx`, `components/FeedSessionDialogs.tsx`; consume `api/feedFeedingApi.ts`, `feedRationApi.ts`, `feedReceiptApi.ts`.

- [ ] Extract aggregate records/rations/pens/feeds/receipts query.
- [ ] Extract record, correct and void mutations as three separate RED→GREEN slices.
- [ ] Preserve role/write gating and refresh-after-command behavior.
- [ ] Run `npx vitest run tests/unit/feed-stock/FeedFeedingApi.test.ts tests/unit/feed-stock/FeedFeedingPage.test.tsx tests/unit/feed-stock/FeedTodayRationsPage.test.tsx`.

### Task 6.5 — Extract Feed Ration form

**Files:** Create `hooks/useFeedRationForm.ts`; modify `pages/FeedRationFormPage.tsx`; use `api/feedRationApi.ts`, `api/feedRationPayload.ts`, `validation/feedRationValidation.ts`, `domain/feedRationForm.ts`.

- [ ] Extract rows/pens/feeds query, version/replacement initialization and validation in separate tests.
- [ ] Extract save-version mutation with the same command key and retry behavior.
- [ ] Run `npx vitest run tests/unit/feed-stock/FeedRationApi.test.ts tests/unit/feed-stock/FeedRationPage.test.tsx`.

### Task 6.6 — Extract Feed Ration list/dialog state

**Files:** Create `hooks/useFeedRations.ts`; modify `pages/FeedRationPage.tsx`, `components/FeedRationDialogs.tsx`; consume `api/feedRationApi.ts`.

- [ ] Extract list query and modal selected-record state separately.
- [ ] Route command completion/refetch through the hook.
- [ ] Run the exact ration tests from Task 6.5.

### Task 6.7 — Extract Feed Receipt form and workflow

**Files:** Create `hooks/useFeedReceiptForm.ts`, `hooks/useFeedReceiptAttachments.ts`; modify `pages/FeedReceiptFormPage.tsx`, `components/FeedReceiptDialogs.tsx`; consume receipt API/payload/validation/domain modules.

- [ ] Extract stock/suppliers/receipt/list/attachments loading, then form initialization, then validation/payload mapping as separate slices.
- [ ] Extract save-draft, create-and-post and retry-pending-post commands separately; preserve idempotency keys.
- [ ] Extract queued upload and receipt attachment list/download/remove.
- [ ] Extract payment attachment download and payment/void completion; validate every field against Task 6.0 matrix.
- [ ] Extract supplier quick-create refresh last.
- [ ] Run `npx vitest run tests/unit/feed-stock/FeedReceiptForm.test.tsx tests/unit/feed-stock/FeedReceiptDetail.test.tsx tests/unit/feed-stock/FeedReceiptPaymentAttachmentDialog.test.tsx tests/unit/feed-stock/FeedReceiptAudit.test.tsx tests/unit/feed-stock/FeedReceiptApi.test.ts`.
- [ ] Defer `feedReceiptBackendFlow.test.ts` and persistence readback to Checkpoint F/WBS 10.3.

### Task 6.8 — Extract Feed Receipt list

**Files:** Create `hooks/useFeedReceipts.ts`; modify `pages/FeedReceiptPage.tsx`; consume `api/feedReceiptApi.ts`, `feedCatalogueApi.ts`, `domain/feedReceiptList.ts`.

- [ ] Extract receipt query, supplier-options query and filter/period summary as separate slices.
- [ ] Run `npx vitest run tests/unit/feed-stock/FeedReceiptPage.test.tsx tests/unit/feed-stock/FeedReceiptData.test.ts`.

### Task 6.9 — Extract Stock Adjustment form/workflow

**Files:** Create `hooks/useFeedStockAdjustmentForm.ts`; modify `pages/FeedStockAdjustmentFormPage.tsx`; consume adjustment API/payload/validation/domain modules.

- [ ] Extract stock/record/list/attachments load, initialization and validation separately.
- [ ] Extract stable save, attachment upload/download/remove, post-saved-draft and retry reconciliation separately.
- [ ] Run `npx vitest run tests/unit/feed-stock/FeedStockAdjustment.test.tsx tests/unit/feed-stock/FeedStockAdjustmentApi.test.ts tests/unit/feed-stock/FeedStockAdjustmentBackend.test.tsx`.
- [ ] Defer `feedStockAdjustmentBackendFlow.test.ts` to Checkpoint F/WBS 10.3.

### Task 6.10 — Extract Stock Adjustment list

**Files:** Create `hooks/useFeedStockAdjustments.ts`; modify `pages/FeedStockAdjustmentPage.tsx`; consume `api/feedStockAdjustmentApi.ts`.

- [ ] Extract list query and retry/refetch.
- [ ] Run the exact adjustment unit tests from Task 6.9.

### Task 6.11 — Extract Feed Stock and movement queries

**Files:** Create `hooks/useFeedStock.ts`; modify `pages/FeedStockPage.tsx`, `components/FeedMovementsDialog.tsx`; consume stock/ration/feeding/movement APIs.

- [ ] Extract stock/updated-at query, daily pens/rations/records query and selected movement query as separate slices.
- [ ] Run `npx vitest run tests/unit/feed-stock/FeedStockApi.test.ts tests/unit/feed-stock/FeedStockPage.test.tsx tests/unit/feed-stock/FeedStockRoute.test.tsx tests/unit/feed-stock/FeedMovementApi.test.ts tests/unit/feed-stock/feedStock.test.ts`.

### Task 6.12 — Extract Today Rations query

**Files:** Create `hooks/useFeedTodayRations.ts`; modify `pages/FeedTodayRationsPage.tsx`; consume ration/feeding APIs and `domain/feedTodayRations.ts`.

- [ ] Extract date-keyed rations/pens/records query; retain pure presentation derivation in domain.
- [ ] Run `npx vitest run tests/unit/feed-stock/FeedTodayRationsPage.test.tsx`.

### Task 6.13 — Verify all Feed Stock pages and public boundary

- [ ] Run AST inventory over all 11 pages; direct API/useQuery/useMutation workflow ownership must be zero or a reviewed route-shell exception.
- [ ] Run `npx vitest run tests/unit/feed-stock`.
- [ ] At Checkpoint F run exact API flows: `node --import tsx --import ./tests/node/setup.ts --test tests/api/feedReceiptBackendFlow.test.ts tests/api/feedStockAdjustmentBackendFlow.test.ts`.
- [ ] Verify Task 6.0 persistence/readback evidence and production→`feedReceiptDemo.ts` edges = 0.

**Checkpoint F (stop gate):** Feed Stock production types have clear owners, all 11 pages delegate use cases to hooks, contract/readback evidence passes, and an independent reviewer reports no High/Medium finding.

---

## WBS 7 — Remaining feature page/use-case separation

Each task below follows the same micro-cycle: impact analysis → characterize page behavior → write hook test RED → extract one query/mutation use case → page consumes hook → run exact feature tests → detect changes.

**WBS 7 entry contract:** Checkpoint F, the current architecture-test result,
and the refreshed page inventory must be attached to the handoff. The ledger is
the source of scope for 7.1–7.18; a package may not infer its file list from a
stale plan. **WBS 7 exit contract:** every page has one classification and one
test/evidence link, every reviewed exception is recorded, and the final AST
inventory is equal to the approved ledger. Any missing row or unexplained direct
API edge is a HOLD for Checkpoint G.

Task numbers 7.1–7.19 are feature work packages, not single writable commits. Each query bullet, each mutation/command bullet and the final page-rewire bullet is a separate executable ledger row/checkpoint. Paths written as `hooks/...`, `pages/...`, `validation/...` are relative to `frontend/src/features/<feature>/`; tests are exact `frontend/tests/unit/<feature>/` folders named below. Do not begin a feature package until Task 7.0 records its exact page/component files and hook contract.

**Exact focused commands by package:** Cattle `npx vitest run tests/unit/cattle`; Pens `npx vitest run tests/unit/pens`; Farm Announcements `npx vitest run tests/unit/farm-announcements`; Farm Overview `npx vitest run tests/unit/farm-overview`; Farm Workspace `npx vitest run tests/unit/farm-workspace`; Growth `npx vitest run tests/unit/growth`; Health `npx vitest run tests/unit/health`; Vaccination `npx vitest run tests/unit/vaccination`; Reproduction `npx vitest run tests/unit/reproduction`; Notifications `npx vitest run tests/unit/notifications`; Platform Admin/Finance/Service/Support use their same-named folders; Account/Auth/Subscription/Support use `tests/unit/account`, `tests/unit/auth`, `tests/unit/subscription`, `tests/unit/support`; Farm Catalogue uses `tests/unit/farm-catalogue`. API/integration tests remain deferred to Checkpoint G/WBS 10.3.

### Task 7.0 — Freeze the page-to-use-case execution ledger before editing

**Files:** Create `docs/analysis/frontend-page-refactor-ledger.md` on the refactor branch; read every `frontend/src/features/*/pages/*.tsx`, related component with direct API calls, current API/hooks/validation/domain files and exact feature tests.

- [ ] Use the AST import graph from WBS 1 to enumerate every page and classify it `composition`, `route-shell`, `query owner`, `command owner`, or `multi-step workflow owner`.
- [ ] For every non-compliant page record exact source path, direct API/query/mutation symbols, target hook path and exported hook contract, exact RED test path, focused command and intended page classification.
- [ ] Split every ledger row so one row owns one query, one mutation family, or one page-rewire; không dùng mô tả file/phạm vi mơ hồ.
- [ ] Link the 76 audited direct-API pages to concrete WBS 4–7 task/ledger row and link route-shell/compliant pages to a reviewed no-change row.
- [ ] Independent reviewer must approve the ledger before Task 7.1; any refreshed-base scope change materially affecting hooks pauses for plan revision/user approval.
- [ ] The ledger must explicitly audit `TechnicianAnnouncementRoutes.tsx`, `CashReportRoutes.tsx`, `ReceiptRoutes.tsx`, `FarmServiceRoutes.tsx`, `PaymentReconciliationRoutes.tsx`, `PlanPriceRoutes.tsx` and `PlatformSubscriptionRoutes.tsx`; each must be a hook-extraction row or a reviewer-approved exception, never an unverified route-shell label.
- [ ] Record the exact installed-binary command for every package using `./node_modules/.bin/vitest run --passWithNoTests ...`; do not use bare `npx vitest` in the ledger.

### Task 7.1 — Cattle hooks

**Files:** Create `hooks/useCattleList.ts`, `hooks/useCattleProfile.ts`, `hooks/useCattleScan.ts`, `hooks/useTechnicianCattle.ts`; modify `pages/CowList.tsx`, `pages/CowProfile.tsx`, `pages/ScanQrPage.tsx`, `pages/TechnicianCattleRoutes.tsx`, `components/TechnicianHerd.tsx`, `components/TechnicianProfile.tsx` and only command modals named by Task 7.0 ledger.

- [ ] Extract list/filter/paging.
- [ ] Extract profile/timeline loading.
- [ ] Extract QR scan orchestration.
- [ ] Extract technician herd/profile queries.
- [ ] Run all cattle unit tests.

### Task 7.2 — Pen Management hooks

**Files:** Create `hooks/usePens.ts`, `hooks/usePenCommands.ts`; modify `pages/BarnList.tsx` and exact command dialogs named by Task 7.0 ledger.

- [ ] Extract list/detail query.
- [ ] Extract create/edit/disable/move commands.
- [ ] Run pens tests.

### Task 7.3 — Farm Announcements hooks and validation placement

**Files:** Create `hooks/useAnnouncements.ts`, `hooks/useAnnouncementEditor.ts`, `hooks/useAnnouncementCorrection.ts`, `validation/announcementValidation.ts`; modify `pages/AnnouncementListPage.tsx`, `AnnouncementEditorPage.tsx`, `AnnouncementCorrectionPage.tsx`; verify `AnnouncementRoutes.tsx` and `TechnicianAnnouncementRoutes.tsx` remain route shells; modify `domain/announcementRules.ts` only to remove input-field rules.

- [ ] Move input validation out of domain with identical errors.
- [ ] Keep audience/status policy in domain.
- [ ] Extract list/editor/correction queries and commands.
- [ ] Include `TechnicianAnnouncementRoutes.tsx` in the extraction ledger because it currently owns list/detail queries and mark-read mutation; it may remain a route composer only after those use cases move to hooks.
- [ ] Run announcement tests.

### Task 7.4 — Farm Overview hooks

**Files:** Create `hooks/useFarmDashboard.ts`, `hooks/useFarmReminders.ts`, `hooks/useManagementReport.ts`, `hooks/useTechnicianHome.ts`; modify `pages/FarmDashboardPage.tsx`, `ManagementReportPage.tsx`, `RemindersPage.tsx`, `TechnicianHomePage.tsx`, `TechnicianRemindersPage.tsx`.

- [ ] Extract each query separately.
- [ ] Keep report/dashboard calculations in domain.
- [ ] Run overview tests.

### Task 7.5 — Farm Workspace hooks

**Files:** Create/extend `hooks/useFarmSelection.ts`, `hooks/useFarmRegistration.ts`, `hooks/useFarmInformation.ts`, `hooks/useMembers.ts`, `hooks/useInvitations.ts`; modify `pages/AcceptInvitationPage.tsx`, `FarmInformationPage.tsx`, `FarmRegistrationPage.tsx`, `FarmSelectPage.tsx`, `InvitationsPage.tsx`, `MembersPage.tsx`, `OwnerRegistrationPage.tsx`.

- [ ] Preserve `activeFarmId` and returnTo semantics.
- [ ] Extract queries and commands one page at a time.
- [ ] Run workspace tests after each use case.

### Task 7.6 — Growth hooks

**Files:** Create `hooks/useGrowthHerd.ts`, `hooks/useGrowthProfile.ts`, `hooks/useGrowthCommands.ts`; modify `pages/GrowthHerdPage.tsx`; verify `pages/GrowthRoutes.tsx` remains a route shell; modify profile/technician components and command dialogs only when listed in Task 7.0.

- [ ] Extract herd/profile queries.
- [ ] Extract record/correction commands.
- [ ] Run growth tests.

### Task 7.7 — Health hooks

**Files:** Create `hooks/useHealthCases.ts`, `hooks/useHealthProfile.ts`, `hooks/useHealthCaseCommands.ts`; modify `pages/HealthCaseList.tsx`; verify `pages/HealthRoutes.tsx` remains a route shell; modify health profile/technician tabs and command dialogs named by Task 7.0.

- [ ] Extract list/profile queries.
- [ ] Extract open/follow-up/treatment/status/correction/death commands separately.
- [ ] Run health tests.

### Task 7.8 — Vaccination hooks

**Files:** Create `hooks/useVaccinationSchedules.ts`, `hooks/useVaccinationScheduleForm.ts`, `hooks/useVaccinationHistory.ts`, `hooks/useVaccinationRecord.ts`; modify `pages/SchedulePage.tsx`, `ManageSchedulePage.tsx`, `HistoryPage.tsx`, `RecordPage.tsx`; verify `VaccinationRoutes.tsx` remains a route shell; modify profile/technician components only when listed in Task 7.0.

- [ ] Extract schedule/history/profile queries.
- [ ] Extract manage/record/defer/correct commands.
- [ ] Run vaccination tests.

### Task 7.9 — Reproduction validation and hooks

**Files:** Create `validation/reproductionValidation.ts`, `validation/calvingValidation.ts`, `hooks/useReproductionWorklist.ts`, `hooks/useReproductionProfile.ts`, `hooks/useCalving.ts`, `hooks/useTechnicianReproduction.ts`; modify `pages/CalvingPage.tsx`, `ReproductionWorklistPage.tsx`, `TechnicianReproductionPage.tsx`, related command dialogs and `domain/reproductionRules.ts`.

- [ ] Before editing, audit `FE-06-nhap-dan`, `FE-11-dong-duc-phoi-giong`, `FE-12-mang-thai-de`, requirement decisions, OpenAPI calving/pending-calf/parentage/died-before-registration operations, frontend reproduction/herd-entry adapters and backend calf/entry DTO-validator-service-entity-repository paths.
- [ ] Field matrix must cover calf outcome/sex/weight+basis/tag/pen/breed/registration choice/purpose, dam/sire/source, pregnancy/calving ids+versions, pending/died/registered state, draft-voucher linkage and persistence readback.
- [ ] Stop on any unresolved source discrepancy; do not infer requiredness from current UI.
- [ ] Move input validation only; retain eligibility/state rules in domain.
- [ ] Extract worklist, profile/options and technician queries as separate ledger rows.
- [ ] Extract event record, correction, void, calving record, calf correction and calving void workflows separately.
- [ ] Run `npx vitest run tests/unit/reproduction tests/unit/herd-entry/ImportNew.farm-born.test.tsx`; defer `tests/integration/herd-entry/farmBornDraftBackend.test.tsx`, API/backend and persistence suites to Checkpoint G/WBS 10.3.

### Task 7.10 — Notifications hook

**Files:** Create `hooks/useNotifications.ts`; modify `pages/MyNotificationsPage.tsx`.

- [ ] Extract list/read mutation and retry.
- [ ] Preserve target routing behavior.
- [ ] Run notifications tests.

### Task 7.11 — Platform Admin hooks and validation placement

**Files:** Create/extend `hooks/useAccounts.ts`, `hooks/useStaffAccess.ts`, `hooks/useAudit.ts`, `hooks/useAdminNotices.ts`, `validation/accountStatusValidation.ts`; modify `pages/AccountsPage.tsx`, `AdminNoticePage.tsx`, `AuditPage.tsx`; verify `AuditRoutes.tsx`, `StaffAccessRoutes.tsx`, `UserAccountRoutes.tsx` route-shell classifications.

- [ ] Extract each page query.
- [ ] Extract each command family.
- [ ] Run platform-admin tests.

### Task 7.12 — Platform Finance hooks

**Files:** Create `hooks/useFinanceRecords.ts`, `hooks/useReceipts.ts`, `hooks/useCashReport.ts`, `hooks/useFinanceNotices.ts`; modify `pages/RecordFormPage.tsx`, `RecordListPage.tsx`, `PmSupportNoticePage.tsx`, `ReconciliationNoticePage.tsx`; verify `CashReportRoutes.tsx`, `ManualFinanceRoutes.tsx`, `ReceiptRoutes.tsx` route-shell classifications.

- [ ] Extract queries/mutations per screen.
- [ ] Keep business calculations in domain.
- [ ] Include `CashReportRoutes.tsx` and `ReceiptRoutes.tsx` in the hook extraction scope; their direct API/query orchestration is not a reviewed route-shell exception.
- [ ] Run finance tests.

### Task 7.13 — Platform Service hooks

**Files:** Create `hooks/useFarmServices.ts`, `hooks/usePlatformSubscriptions.ts`, `hooks/usePaymentRead.ts`, `hooks/usePaymentReconciliation.ts`, `hooks/usePaymentSource.ts`, `hooks/usePlanPrices.ts`; modify `pages/PaymentReadPage.tsx`, `PaymentSourcePage.tsx`; verify `FarmServiceRoutes.tsx`, `PlatformSubscriptionRoutes.tsx`, `PaymentReconciliationRoutes.tsx`, `PlanPriceRoutes.tsx` route-shell classifications.

- [ ] Extract one API family per hook/test cycle.
- [ ] Preserve backendPending behavior where endpoint integration is still intentionally incomplete.
- [ ] Include `FarmServiceRoutes.tsx`, `PaymentReconciliationRoutes.tsx`, `PlanPriceRoutes.tsx` and `PlatformSubscriptionRoutes.tsx` in the hook extraction scope; verify each route file is composition-only after rewiring.
- [ ] Run platform-service tests.

### Task 7.14 — Platform Support hooks and validation placement

**Files:** Create `hooks/useSupportQueue.ts`, `hooks/useSupportTicket.ts`, `hooks/useInternalRequests.ts`, `hooks/useSupportNotifications.ts`, `validation/platformSupportValidation.ts`; modify `pages/QueuePage.tsx`, `TicketPage.tsx`, `InternalRequestsPage.tsx`, `NotificationsPage.tsx`; verify `InternalRequestRoutes.tsx`, `SupportDeskRoutes.tsx` route-shell classifications.

- [ ] Extract queue/ticket/internal request queries.
- [ ] Extract assignment/reply/resolve/escalate command families.
- [ ] Run platform-support tests.

### Task 7.15 — Account hooks

**Files:** Extend `hooks/useAccountProfile.ts` (or current exact account-profile hook identified by Task 7.0); create `hooks/useAccountProfileCommands.ts`, `hooks/useChangePassword.ts`; modify `pages/ProfilePage.tsx`, `PlatformProfilePage.tsx`, `TechnicianAccountPage.tsx`.

- [ ] Extract profile query/update.
- [ ] Extract change-password mutation.
- [ ] Run account tests.

### Task 7.16 — Subscription validation/hooks

**Files:** Create `validation/subscriptionValidation.ts`; extend existing hooks for history/renew/home/transfer; modify `pages/FirstSubscriptionPage.tsx`, `HistoryPage.tsx`, `RenewPage.tsx`, `SubscriptionHomePage.tsx`, `TransferPage.tsx`; verify `SubscriptionRoutes.tsx` remains a route shell.

- [ ] Move date/ID/reason input validation out of API with identical messages.
- [ ] Extract remaining page queries/mutations.
- [ ] Preserve dev simulator gate exactly.
- [ ] Run subscription tests.

### Task 7.17 — Support hooks completion

**Files:** Extend `hooks/useTicketActions.ts`; create `hooks/useTicketList.ts`, `hooks/useTicketDetail.ts`; modify `pages/NewTicketPage.tsx`, `TicketDetailPage.tsx`, `TicketListPage.tsx`; verify `SupportRoutes.tsx` remains a route shell.

- [ ] Extract list/detail query ownership.
- [ ] Route all ticket commands through feature hooks.
- [ ] Run support tests.

### Task 7.18 — Farm Catalogue hooks completion

**Files:** Create/extend `hooks/useCatalogueList.ts`, `hooks/useParameters.ts`; modify `pages/BreedsPage.tsx`, `MedicinesPage.tsx`, `ParametersPage.tsx`, `PurposesPage.tsx`, `VaccinesPage.tsx`; verify `CatalogueRoutes.tsx` remains a route shell.

- [ ] Inventory pages already compliant.
- [ ] Extract only missing use cases.
- [ ] Run catalogue tests.

### Task 7.19 — Verify compliant route-only/page-shell files

- [ ] Re-run the Task 7.0 ledger generator and diff classifications against the approved ledger.
- [ ] Inspect exact `*Routes.tsx` pages that only compose nested routes/components.
- [ ] Do not create hooks for files with no query/mutation/use-case logic.
- [ ] Record justified page exceptions in architecture test data and ledger, not comments alone.

**Checkpoint G (stop gate):** Every page has an explicit classification and exact task/test link: composition-only, route-shell, or reviewed exception; no page owns multi-step API workflow; independent reviewer reports no High/Medium finding.

---

## WBS 8 — Frontend API adapter module decomposition

This WBS changes only TypeScript modules under `frontend/src/features/*/api`.
The Spring Boot backend, Java DTOs, entities, services, repositories and
database schema are read-only sources of contract evidence; they are not files
to modify in this plan. Each frontend adapter is handled independently and its
public facade signatures stay stable until all frontend consumers/tests pass.

**WBS 8 entry contract:** Checkpoint G must be green, including the page ledger,
and all four target adapters must have a consumer inventory plus characterization
tests. Work is ordered DTOs → mappers → errors/validation, one slice at a time;
no public barrel cleanup is allowed in this WBS. **WBS 8 exit contract:** each
facade owns transport/cache/endpoint orchestration only, all moved symbols have
one owner, and facade signatures, cache invalidation, error mapping and
conditional-field mapping are proven unchanged. A failing characterization test
or unresolved contract discrepancy blocks H and invalidates downstream 9.

### Task 8.1 — Vaccination frontend API adapter decomposition

**Files:** Frontend only: create `api/vaccination.dto.ts`, `vaccinationMapper.ts`, `vaccinationError.ts`; modify `vaccinationBackend.ts`, `vaccinationApi.ts`; retain `types.ts`, `domain/vaccinationRules.ts`, `validation/vaccinationValidation.ts` as their current owners.

**Frontend DTO owner:** response DTOs `BackendVaccineDto`, `BackendCattleDto`, `BackendPenDto`, `BackendMemberDto`, `BackendScheduledDoseDto`, `BackendScheduleTargetDto`, `BackendScheduleDto`, `BackendVaccinationRevisionDto`, `BackendVaccinationRecordDto`, `BackendSkippedVaccinationDto`, `BackendVaccinationBatchResultDto`; request DTOs for create/update/stop schedule, record/defer/correct/void. These describe the server contract but live in frontend TypeScript.

**Mapper owner:** move `toFarmTime`, `toInstant`, `toRoute`, `mapVaccine`, `mapCattle`, `mapSchedule`, `mapRevision`, `mapRecord`, `mapSkipped` and primitive helpers; name request mappers `toScheduleTargetRequest`, `toCreateScheduleRequest`, `toUpdateScheduleRequest`, `toRecordVaccinationsRequest`, `toCorrectVaccinationRequest`.

**Error owner:** move `mapVaccinationError`, `FIELD_ALIASES`, `FIELD_MESSAGES`; preserve `VaccinationValidationError` and `CONFLICT_MESSAGE` behavior.

- [ ] Characterize `createVaccinationApi`/`vaccinationApi` signatures and every mapper/error output.
- [ ] Inventory direct test and production consumers of `mapVaccine`, `toFarmTime`, `mapCattle`, `mapSchedule`, `mapRevision`, `mapRecord`, `mapSkipped`, `FIELD_ALIASES` and `FIELD_MESSAGES`; update imports through the new owner modules before deleting backend exports.
- [ ] Move DTOs → run `node --import tsx --import ./tests/node/setup.ts --test tests/api/vaccinationBackendApi.test.ts`.
- [ ] Move response/request mappers → run `npx vitest run tests/unit/vaccination`.
- [ ] Move error translation → rerun both exact suites.
- [ ] Keep `DOSE_PAGE_SIZE`, cache/query/path construction, `run` and endpoint methods in `vaccinationBackend.ts`; expose `VaccinationBackend` matching the returned facade.
- [ ] Run detect-changes; full API/typecheck/build defer to Checkpoint H.

### Task 8.2 — Reproduction frontend API adapter decomposition

**Files:** Frontend only: create/adjust `api/reproduction.dto.ts`, `reproductionMapper.ts`, `reproductionError.ts`; modify `reproductionBackend.ts`, `reproductionApi.ts`.

**DTO owner:** backend eligibility/worklist/history/timeline/pregnancy/calving/calf/member/sire/breed/pen/purpose/health-option DTOs and estrus/breeding/pregnancy/calving/correction/void command DTOs.

**Mapper owner:** move `resolveReproductionSource`, `SIGN_CODE`, `NEXT_ACTION_TEXT`, `mapEligibility`, `mapCalf`, `mapCalving`, `mapTimelineRow`, `mapProfile`, `mapWorklistItem`, `uid`, `backendId`; add named request mappers `toEstrusRequest`, `toBreedingRequest`, `toPregnancyCheckRequest`, `toPregnancyUpdateRequest`, `toCalvingRequest`, `toReproductionCorrectionRequest`, `toCalvingCorrectionRequest`.

**Error owner:** move `ReproductionDuplicateError`, `mapReproductionError`, `FIELD`, `LABEL`.

- [ ] Refresh the file inventory before editing: `reproductionError.ts` already exists, and `RecordDialogs.tsx`, `ReproductionTechnicianTab.tsx`, `ReproductionProfileTab.tsx`, `reproductionEligibility.test.tsx` and `reproductionBackendApi.test.ts` consume symbols that must be assigned an owner and compatibility path.
- [ ] Re-run the mandatory farm-born field matrix from Task 7.9 before editing; stop on any unresolved conditional-field/persistence discrepancy.
- [ ] Explicitly resolve the source-of-truth for `tagCode: null` on untagged immediate registration against FE-12/Q5 before freezing the mapper contract.
- [ ] Characterize cache invalidation, backend id/version and conditional calf/pregnancy mapping in `tests/api/reproductionBackendApi.test.ts` plus `tests/unit/reproduction`.
- [ ] Move DTOs, then mappers, then errors as three independent RED→GREEN slices; run `node --import tsx --import ./tests/node/setup.ts --test tests/api/reproductionBackendApi.test.ts` and `npx vitest run tests/unit/reproduction` after each.
- [ ] Keep cache/catalogue/endpoint orchestration and current facade signatures in the frontend API adapter; `resetReproductionDemo` cleanup belongs to WBS 9.

### Task 8.3 — Health frontend API adapter decomposition

**Files:** Frontend only: create/adjust `api/health.dto.ts`, `healthMapper.ts`, `healthError.ts`, `validation/healthValidation.ts`; modify `healthBackend.ts`, `healthApi.ts`.

**DTO owner:** health cattle/medicine/case/list/timeline/member/pen/pending-exit DTOs and open/follow-up/treatment/status/correction/void request DTOs.

**Mapper owner:** move time/route helpers, `mapCattle`, `mapMedicine`, `mapTimelineRow`, `ageText`, `describe`; add named case/card/profile/result/request mappers.

**Error/validation owners:** move `mapHealthError`, `FIELD_ALIASES`, `FIELD_LABELS` to error module; move `textFieldErrors` and `correctionTreatmentErrors` from adapter tail to validation without message/semantics change.

- [ ] Treat existing `validation/healthValidation.ts` as an inventory/ownership update, not a new-file assumption; preserve direct characterization imports from `healthBackend.ts` through an explicit compatibility decision.
- [ ] Characterize list/profile/timeline/pending-exit and validation outputs.
- [ ] Move validation first, then DTOs, mappers and errors as four independent slices.
- [ ] After each slice run `node --import tsx --import ./tests/node/setup.ts --test tests/api/healthBackendApi.test.ts` and `npx vitest run tests/unit/health`.
- [ ] Keep cache/lookups and eight endpoint methods in the frontend adapter; preserve `HealthApi`, `createHealthApi`, `healthApi` signatures.

### Task 8.4 — Farm Overview frontend API adapter decomposition

**Files:** Frontend only: create `api/farmOverview.dto.ts`, `farmOverviewMapper.ts`, `farmOverviewError.ts`; modify `farmOverviewBackend.ts`, `farmOverviewApi.ts`.

**DTO owner:** farm context, pen/breed option, dashboard/summary/attention/getting-started, reminder/target, report/section/chart and `RunFarmReportRequestDto`.

**Mapper owner:** dashboard (`toBackendGroup`, `fromBackendGroup`, `mapDashboard`, `mapAttention`), report (`mapReport`, `mapReportSection`, `mapMetricChart`), reminder (`mapReminder`, `mapReminderTarget`, `reminderSourceAction`, `profileRoute`), onboarding (`mapGettingStarted`, `backendStep`, `frontendStep`), context/options/request mappers.

**Error owner:** `FarmOverviewShapeError`, `failShape`, required/optional DTO reader helpers.

- [ ] Characterize dashboard/report/reminder/onboarding/context mapping and viewer-specific route derivation.
- [ ] Add or explicitly name the API characterization gate for Farm Overview; `tests/unit/farm-overview/farmOverviewApi.test.ts` must be shown to cover the backend-mode mapping, or a dedicated `tests/api/farmOverviewBackendApi.test.ts` must be added before H.
- [ ] Move DTOs, mapper families and shape errors as independent slices; run `npx vitest run tests/unit/farm-overview` after each.
- [ ] Keep context/pens/breeds promise caches, transport/path/query and endpoint orchestration in the frontend adapter; preserve `Viewer`, `createFarmOverviewApi`, `farmOverviewApi` signatures.

**Checkpoint H (stop gate):** Four adapter facades contain endpoint orchestration only, DTO/mapping/error ownership is explicit, mandatory contract audits pass, and an independent reviewer reports no High/Medium finding.

---

## WBS 9 — Public surface cleanup

**WBS 9 entry contract:** Checkpoint H and the four-adapter consumer inventory
must be frozen at one SHA. Every export removal requires an inbound-consumer
decision and a focused test before the next barrel edit. **WBS 9 exit contract:**
all route loaders remain dynamic and all retained exports have a documented
consumer; the final API, integration, typecheck and build gates pass on the same
SHA that is handed to WBS 10. A route-loader, deep-import or public-surface
regression is a HOLD even when unit tests are green.

### Task 9.0 — Normalize Authentication route loading after API decomposition

**Files:** Create `frontend/src/features/authentication/routes.ts`; modify `pages/LegalPage.tsx`, `frontend/src/app/routes/AppRoutes.tsx`, `features/authentication/index.ts`, `frontend/tests/unit/app/AppRoutes.test.tsx`, `frontend/tests/api/layerBoundary.test.ts`.

**Interface:** `loadLegalPage = () => import('./pages/LegalPage')`; `/terms` and `/data-policy` retain the same props and behavior.

- [ ] Characterize both legal routes in `AppRoutes.test.tsx`.
- [ ] Add default component export required by `React.lazy` without changing `kind: 'terms' | 'data'`.
- [ ] Import `loadLegalPage` from `authentication/routes`, construct `lazy(loadLegalPage)`, then remove `LegalPage` from public index.
- [ ] Extend the semantic route-loader guard to Authentication.
- [ ] Run `npx vitest run tests/unit/app tests/unit/auth` and `node --import tsx --import ./tests/node/setup.ts --test tests/api/layerBoundary.test.ts`; defer auth integration to final WBS 9/WBS 10 gate.

### Task 9.1 — Generate public export consumer inventory

**Files:** Architecture test/support only.

- [ ] For every `features/*/index.ts`, enumerate exported symbol and inbound consumers outside owner feature.
- [ ] Mark app composition, cross-feature production, tests-only and unused separately.
- [ ] Fail on wildcard export unless explicitly justified.
- [ ] Treat `routes.ts` separately; route loaders must never be exported from feature `index.ts`.
- [ ] Record an exact keep/remove decision for every current symbol before changing a barrel.

### Task 9.2 — Narrow Feed Stock public index

- [ ] Current inventory shows zero external production consumers for all 37 symbols; target `features/feed-stock/index.ts` is `export {}` unless refreshed-base inventory proves a new consumer.
- [ ] Run feed-stock and architecture tests.

### Task 9.3 — Narrow Reproduction public index

- [ ] Keep only `ReproductionProfileTab` and `ReproductionTechnicianTab`, consumed by Cattle profile/technician composition.
- [ ] Remove `reproductionApi`, `resetReproductionDemo` and wildcard type export; refreshed inventory must show no external production consumer.
- [ ] Run reproduction and architecture tests.

### Task 9.4 — Narrow Farm Workspace public index

- [ ] Keep `SetupLayout`, `InactiveFarmBanner`, `Stepper`, `farmWorkspaceError`, `openedInactiveFromFarmSelect`, `STORAGE_BLOCKED`, `enterFarm`, `SERVICE_STATUS_VIEW`, `paymentView`, `serviceView`, `permissionRowsFor`.
- [ ] Remove API factories/types, demo-store types, five validators and `PAYMENT_STATE_VIEW` after refreshed inventory confirms no external production consumer.
- [ ] Run workspace and architecture tests.

### Task 9.5 — Clean exact remaining feature indexes one at a time

- [ ] `account/index.ts`: remove API exports; target empty after account unit tests.
- [ ] `authentication/index.ts`: keep `AuthProvider`, `useAuth`, OAuth URL, `CONTACT`, invitation constants/helpers; remove tests-only `AuthClient`, unused guest-flow exports and (after 9.0) `LegalPage`.
- [ ] `authorization/index.ts`: keep current externally consumed symbols; remove unconsumed `FarmRole` export.
- [ ] `cattle/index.ts`: keep `Cattle`, `CattleCode`, `CattleInput`, `moveBarn`, `scanCode`.
- [ ] `farm-announcements/index.ts` and `farm-catalogue/index.ts`: keep their externally consumed API facade; `farm-overview/index.ts` stays empty.
- [ ] `growth/index.ts`, `health/index.ts`, `vaccination/index.ts`: keep both profile/technician tab components; run Cattle tests after each.
- [ ] `herd-entry/index.ts` and `herd-exit/index.ts`: remove unconsumed API/draft/command exports; target empty.
- [ ] `notifications`, `platform-admin`, `platform-finance`, `platform-service`, `platform-support`, `subscription`, `support`: retain already-empty barrels.
- [ ] `pen-management/index.ts`: keep externally consumed `Pen`, `PenCode`.
- [ ] After `account`: run `npx vitest run tests/unit/account`; after `authentication`/`authorization`: run `npx vitest run tests/unit/auth tests/unit/app`; after cattle/pen: run `npx vitest run tests/unit/cattle tests/unit/pens`; after announcement/catalogue/workspace: run their exact same-named unit folder.
- [ ] After growth/health/reproduction/vaccination: run the changed feature folder plus `tests/unit/cattle`; after Entry/Exit run `tests/unit/herd-entry` or `tests/unit/herd-exit`. Run `node --import tsx --import ./tests/node/setup.ts --test tests/api/layerBoundary.test.ts` after every single barrel edit; never batch barrel edits before verification.
- [ ] Final WBS 9 gate: run `npm run test:api`, exact affected unit/integration folders, `npm run typecheck`, `npm run build`, then independent review.

---

## WBS 10 — Integration, artifact and merge readiness

**WBS 10 entry contract:** the exact WBS 9 checkpoint SHA, reviewer approval,
complete changed-file list and no unresolved High/Medium finding are required.
Tasks 10.1–10.4 produce machine-verifiable evidence; 10.5 produces manual
runtime evidence and must not be described as automated E2E. **WBS 10 exit
contract:** all required suites and artifact checks pass, persisted fields have
readback proof, runtime smoke uses the same approved SHA, and 10.6/10.7 have
recorded a merge recommendation without mutating the dirty canonical checkout.

### Task 10.1 — Run architecture acceptance suite

- [ ] Run import parser tests.
- [ ] Run layer boundary tests.
- [ ] Confirm zero shared→business edges.
- [ ] Confirm zero feature→legacy edges.
- [ ] Confirm zero cross-feature deep imports.
- [ ] Confirm zero value and type cycles.
- [ ] Confirm zero unexplained legacy allowances.
- [ ] Define the allowed exception for dev/demo-gated modules: zero production feature→legacy edges is required, while any retained dev/test edge must name its gate, tree-shaking proof and owner in the allowlist.
- [ ] Confirm every routed feature page is loaded through `routes.ts`.

### Task 10.2 — Run feature-local suites in deterministic batches

- [ ] Run `npx vitest run tests/unit/account tests/unit/auth tests/unit/app`.
- [ ] Run `npx vitest run tests/unit/cattle tests/unit/pens`.
- [ ] Run `npx vitest run tests/unit/herd-entry`.
- [ ] Run `npx vitest run tests/unit/herd-exit`.
- [ ] Run `npx vitest run tests/unit/feed-stock`.
- [ ] Run `npx vitest run tests/unit/growth tests/unit/health tests/unit/vaccination tests/unit/reproduction`.
- [ ] Run `npx vitest run tests/unit/farm-workspace tests/unit/farm-overview tests/unit/farm-announcements tests/unit/farm-catalogue tests/unit/notifications`.
- [ ] Run `npx vitest run tests/unit/platform-admin tests/unit/platform-service tests/unit/platform-finance tests/unit/platform-support`.
- [ ] Run `npx vitest run tests/unit/subscription tests/unit/support`.
- [ ] Record command, duration, pass/fail and failing test names.

### Task 10.3 — Run API and contract suites

- [ ] Run `npm run test:api`.
- [ ] Run full frontend integration command from `VERIFICATION.md`, not the entry-only convenience script alone.
- [ ] Run Entry/Exit/payment/farm-born contract matrices against focused backend tests.
- [ ] For persisted fields, collect repository/service/API readback evidence; HTTP 2xx alone is insufficient.

### Task 10.4 — Run static/build verification

- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Create a SHA-named temporary artifact directory with `mktemp -d /tmp/beefcare-frontend-artifact-<short-sha>-XXXXXX`; never reuse or clear project `dist` for inspection.
- [ ] Run project-local Vite with source maps into that exact temp path: `./node_modules/.bin/vite build --sourcemap --outDir <temp-path> --emptyOutDir`.
- [ ] Parse every `<temp-path>/assets/*.js.map` JSON `sources` entry and emitted chunk/import graph with a read-only Node command; write the sorted module-ID/chunk report into execution evidence, not source.
- [ ] Confirm no demo/root-local module in production artifact except explicitly allowed dev-gated code proven tree-shaken.
- [ ] Confirm entry chunk does not statically contain feature screens.
- [ ] Record temp artifact path and exact commands; cleanup requires separate explicit approval or normal OS temp cleanup.

### Task 10.5 — Runtime route/role smoke

- [ ] Use exact approved checkpoint.
- [ ] Verify provider order and login/session lifecycle.
- [ ] Verify OWNER, MANAGER, TECHNICIAN, CS, PM, SA landing routes.
- [ ] Verify select-farm/no-farm/stale-farm behavior.
- [ ] Verify representative Entry, Exit, Feed Stock, Cattle/Pen and platform routes.
- [ ] Record viewport, route, state, commit/checkpoint, console/network result and overflow status.
- [ ] Label evidence manual runtime, not automated E2E.

### Task 10.6 — Final dependency and diff audit

- [ ] Run `gitnexus_detect_changes()` over complete branch.
- [ ] Compare affected processes with PR-01…PR-12 traceability matrix.
- [ ] Run `git diff --check`.
- [ ] Inspect `git status --short`; identify every changed/untracked file.
- [ ] Confirm no unrelated current-workspace files entered refactor branch.
- [ ] Independent reviewer verifies problem-to-change-to-test mapping.

### Task 10.7 — Prepare merge proposal to `dev`

- [ ] Fetch `origin/dev` again.
- [ ] Report whether `dev` advanced from pinned base.
- [ ] If advanced, stop and present merge-vs-rebase options plus conflict/risk report; choose a strategy only after explicit user approval, then rerun architecture, full unit/integration/API, typecheck, build and runtime smoke on the resulting SHA.
- [ ] Present branch SHA, base SHA, commits/checkpoints, changed files and all verification evidence.
- [ ] Request explicit user approval before merge.
- [ ] Never switch or merge inside the dirty canonical checkout. After approval, merge through a new clean `dev` integration worktree pinned to the approved `origin/dev` SHA, or through an approved remote PR; record its path/branch/SHA before mutation.
- [ ] Verify the post-merge/PR SHA and rerun the agreed final checks there. Do not delete branch/worktree until preservation is verified and cleanup is separately approved.

---

## Traceability Summary

| Finding | Primary WBS |
| --- | --- |
| PR-01 shared business errors | 3.1–3.4 |
| PR-02 page controllers | 4–7 plus exact page/use-case ledger 7.0/7.19 |
| PR-03 validation/domain/API mix | 4.5, 5.2, 7.3, 7.9, 7.11, 7.14, 7.17, 8.3 |
| PR-04 mega adapters | 8.1–8.4 |
| PR-05 legacy root ownership | 2.6–2.7, 3.5–3.8 |
| PR-06 Cattle CowSeed ownership | 2.5A; 7.1 handles page/use-case hooks only |
| PR-07 deep imports | 2.8 |
| PR-08 type cycles | 2.1–2.7 |
| PR-09 broad indexes | 9.1–9.5 |
| PR-10 Authentication routes | 9.0 |
| PR-11 Feed Stock demo-named contract | 6.1 |
| PR-12 session/auth ownership | 2.1–2.3 |
| TG-01 import parser gaps | 1.1–1.3 |
| TG-02 no cycle guard | 1.2, 1.4 |
| TG-03 weak legacy allowlist | 1.5 |
| TG-04 route exact-pattern guard | 1.6 |
| TG-05 artifact evidence | 10.4 |

## Definition of Done

- [ ] All traceability rows have completed task/test/evidence links.
- [ ] PR-01…PR-12 no longer reproduce on final source graph.
- [ ] TG-01…TG-04 have negative fixtures and automated enforcement.
- [ ] TG-05 has fresh production artifact evidence.
- [ ] Entry/Exit/payment/farm-born field matrices and round-trip evidence are complete.
- [ ] All required focused, API, integration, typecheck and build commands pass at final checkpoint.
- [ ] Independent review has no unresolved High/Medium finding.
- [ ] User has explicitly approved merge into `dev`.
