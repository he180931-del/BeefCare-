# FE-23 / SCR-77 implementation handoff — Feed Stock

## Assignment

Implement only SCR-77, “Thức ăn – Tồn kho”, using the current FE-23 Redesign frame as the visual source. The user has specified that Figma pages without the Redesign label are old and must not guide the design.

- **Figma reference:** [Redesign page 21 — Thức ăn – Tồn kho](https://www.figma.com/design/BmFA2ndWI434UHS38zRr3A/BEEFCARE-1--Copy-?node-id=2621-4113), frame `2621:4113`, 1440 × 1024. Luna Figma reports seven tabs: Tồn kho, Phiếu nhập, Kiểm kê, Khẩu phần, Nhật ký, Danh mục, Báo cáo; four summary cards; stock table; filters; create-receipt and stock-count actions. This handoff records that inspection evidence; it does not claim pixel-level or runtime verification.
- **SRS:** `docs/requirements/SRS_2026-10-28.txt`, SCR-77 at lines 5246–5273, UC-FE23-01 at line 1302, GBR-103 at line 5910, GBR-104 at line 5911, GBR-105 at line 5912, and GBR-14 at line 5785.
- **Decision:** `docs/REQUIREMENT_DECISIONS.md`, D04. Lots support expiry warnings only. Do not add FEFO or lot allocation logic.
- **API contract:** `docs/api/openapi.json`, GET `/api/farms/{farmId}/feed/stock`, operation `stock`, returning `StockView[]`; also GET `/feed/catalogue` and GET `/feed/stock/{feedId}/movements` if the page needs the separately defined catalogue or movement data.
- **Backend evidence:** `FeedManagementResource.stock`, `FeedManagementService.stock` and `stockProjection`, `FeedManagementService.averageDailyUse`, `FeedManagementDtos.StockView`, `FeedManagementDtos.FeedItemView`, `FeedManagementDtos.MovementView`, `FarmAction`, and `FarmAccessService.require`.
- **Existing frontend boundary:** `frontend/src/features/feed-stock/{index.ts,types.ts,api/feedStockApi.ts,data/feedStock.ts,data/feedStockMock.ts}`. It currently provides a read adapter, local fixture and filters. There is no page, route, or UI for SCR-77.

## Required screen content

Match the Redesign frame’s overall page structure and visible hierarchy. Include the seven FE-23 navigation labels and show Stock as the active tab. Show four summary cards, the search/group/status filters, the stock table, the explanatory note, and the stock-count and feed-receipt actions. The table columns identified in the supplied frame evidence are code, name, group, current stock, minimum stock, average use per day, days of cover, lot near expiry, status, and actions.

Keep SCR-77 limited to reading/displaying the stock projection and local demo fixture. The other six tabs and the SCR-79/SCR-80 destinations are separate screens. Verify their exact Figma prototype destinations with Luna Figma before claiming those navigation flows work. Do not create fake stock movements or imply a receipt/count was saved. The row’s “Receive” action belongs to SCR-79; “View” belongs to stock movements. The API for movements exists, but the frontend currently has no movement adapter or view.

## Field and metric mapping

`StockView` has these 13 fields: `feedItemId` (integer), `code`, `name`, `group` (strings), `onHandKg`, `minimumStockKg`, `averageDailyUseKg`, `daysOfCover`, `stockValue` (numbers), `status` (string), `version` (integer), `nearestLotNumber` (string), and `nearestLotExpiryDate` (date string). Nullable values may be absent/null: minimum stock, days of cover, lot number and lot expiry. Treat `daysOfCover = null` as “—” when average daily use is zero; do not divide by zero. The backend sets status to `OUT_OF_STOCK` at zero, `LOW` above zero and at/below the minimum, and otherwise `SUFFICIENT`.

| Redesign/SRS display | Data available now | Implementation guidance / gap |
| --- | --- | --- |
| Feed code, name, group | `StockView.code`, `.name`, `.group` | Render the values from the response. `group` is an OpenAPI string; SRS Table III-6 defines six group codes. Preserve an unknown code safely instead of crashing or silently changing the response. |
| Stock in kg | `onHandKg` | Available directly. |
| Equivalent purchase units | Not in `StockView` | `FeedItemView` from GET `/feed/catalogue` includes `purchaseUnit` and `kgPerPurchaseUnit`; it can be joined by feed item ID if the UI needs the SRS example. The current stock adapter/mock does not fetch or supply this information. Never assume a bag size. |
| Minimum stock | `minimumStockKg`, nullable | Available directly; display the empty case without converting it to zero. |
| Average use per day, per feed | `averageDailyUseKg` | Available directly. Backend averages VALID feeding lines from today and the previous six farm-local dates, divided by seven. |
| Days of cover | `daysOfCover`, nullable | Available directly from backend. The backend rounds to one decimal; do not recompute differently. |
| Lot near expiry | `nearestLotNumber`, `nearestLotExpiryDate`, nullable | Available directly: closest expiry among POSTED receipt lines expiring today through the next 30 days. This is an expiry warning only per D04. |
| Stock status | `status` | Available directly. Localize `SUFFICIENT`, `LOW`, `OUT_OF_STOCK` for presentation while retaining the original code in data. |
| Feeds in use, grouped | No active flag in `StockView` | SRS requires ACTIVE feed items by group. GET `/feed/catalogue` includes `available`, so a verified join can count active feeds. The stock list service returns farm feed items without filtering availability. Do not infer ACTIVE from stock or minimum level. |
| Low / out-of-stock card and names | Per-row status is available; active flag is not | Derive counts/names from the stock projection only after joining catalogue availability and confirming the card scope. The SRS REM-10 count applies only to ACTIVE feeds with a minimum level. |
| Total stock value | `stockValue` on each `StockView` row | The backend computes each row from stock × weighted-average cost. Summing returned values is the SRS aggregate if the card covers the same set of rows; state the scope and do not invent unit prices. |
| Average use, kg/day, for all feeds | `averageDailyUseKg` per row | Sum only when the UI label means the returned farm-wide set. The current endpoint has no separate aggregate object. |
| Average use, kg/head/day | No headcount denominator in `StockView` | Not safely derivable from this response. GBR-105 defines average head as mean daily headcount from pen assignments. Use a contract-approved herd/pen data source or leave this value unavailable; never divide by today’s headcount and present it as the seven-day metric. |
| “Updated at” | No timestamp in `StockView` | Not available from the stock response. MovementView has `occurredAt` per feed via a separate endpoint, but calling it once per row would add N+1 requests and the endpoint has no paging parameters. Do not show a fabricated update time; request an appropriate aggregate contract if this remains required. |

There is a role discrepancy to resolve before claiming authorization parity: SRS SCR-77 and GBR-103 give stock access to Owner and Manager; Technicians are limited to rations and feeding log. The current `FarmAction.VIEW_FEED` includes Technician, and `FeedManagementService.stock()` uses that action. `AuthGate` only checks authentication and the current frontend has no farm-role gate. A frontend role check alone does not restrict the backend endpoint. Record this as an API/backend authorization issue for the responsible owner; do not claim SCR-77 access is secure or change backend scope under this FE-only assignment.

`FarmAccessService.require` also enforces an ACTIVE farm service for operational feed access, consistent with UC preconditions and GBR-14. Preserve 401/403/404 and API errors; backend mode must never silently switch to local data.

## States and interactions

- **Loading:** show a visible loading state while `listFeedStock()` resolves; avoid a blank page.
- **Loaded rows:** display the available fields and summary items only when their values have a sound data source. Make missing metrics explicit (“—”/unavailable) rather than substituting guessed values.
- **Empty:** a successful empty `StockView[]` should show an empty message and a useful next action only if its target exists.
- **Error:** show the relevant user-facing API error and retry. Do not show the local fixture after a backend request fails.
- **Filters:** connect query, group and status controls to the feature-local filter; filters should combine and an unmatched result should have a clear empty-filter state. Map six known group codes to localized labels; keep the API code as the filter value.
- **Other FE-23 tabs:** render the seven labels with Stock selected. Until the destination routes are implemented and verified, do not present the other tabs as completed screens.
- **Receipt/count CTA and row actions:** wire only to approved/implemented destinations. The Redesign intends create receipt → SCR-79, stock count → SCR-80, Receive → SCR-79 with the selected feed, and View → that feed’s movement history. SCR-79/80 and a movement view are outside this first screen slice; do not make these actions appear to persist anything.

## Focused tests to add

| What | Where | Why |
| --- | --- | --- |
| Render SCR-77 with deterministic fixture rows and assert its header, active tab, four summary areas, filters, table columns and row actions. | New `frontend/tests/unit/feed-stock/FeedStockPage.test.tsx` | Confirms the implemented screen structure and available values without treating the fixture as live farm data. |
| Loading, successful empty response, filter-no-results, retryable request error, and proof that backend error does not select the local fixture. | Same page test; extend `frontend/tests/unit/feed-stock/feedStock.test.ts` only for pure filter/read-model behavior | Covers the major UI/API states and guards against a mock fallback that hides integration failures. |
| Search by code/name and combined group/status filters; null days-of-cover; unknown group display fallback. | `frontend/tests/unit/feed-stock/feedStock.test.ts` and page test for controls | Validates mapping and filtering against the `StockView` fields rather than derived guesses. |
| Correct GET path, Owner/Manager authorization, Technician denial, and inactive-farm denial for stock access. | API adapter test; backend `FeedManagementServiceTest`/resource authorization test (owned by the backend/API owner) | Ensures contract access and service-state rules match SCR-77/GBR-103/GBR-14. The current Technician permission discrepancy means this requirement is not green until backend ownership resolves it. |
| Movement endpoint path/data only if row “View” is included in this slice. | New feature-local movement API test plus test for the movement drawer | Protects the per-feed movement flow; do not add it to SCR-77 if the slice remains screen-only. |

Project commands are listed in `docs/agent-context/VERIFICATION.md`. At handoff, `frontend/node_modules` was absent and Vitest could not run. Do not claim the Vitest suite, typecheck, build, visual comparison or runtime checks passed until they actually run.

## File ownership and implementation order

Assign one Luna Coding as the sole writer for this feature slice. The frontend feature boundary is:

- Existing: `frontend/src/features/feed-stock/types.ts`, `api/feedStockApi.ts`, `data/feedStock.ts`, `data/feedStockMock.ts`, `index.ts`.
- Add page and page-specific components under `frontend/src/features/feed-stock/pages/` and `frontend/src/features/feed-stock/components/`.
- Add/extend unit tests under `frontend/tests/unit/feed-stock/`.
- Route integration is a shared-file task in `frontend/src/App.tsx`. Assign it to the same Luna Coding owner in this slice or to one explicitly named route owner sequentially; never have concurrent agents edit `App.tsx`. The existing `Layout.tsx` already has the `/thuc-an` “Thức ăn” menu link, but that menu path currently resolves to `Placeholder`.
- No changes to backend code, Figma, `.env`, API schema or other feature internals in this screen-only assignment. The role discrepancy must be handed to the backend/API owner, not hidden by frontend-only checks.

Suggested sequence: resolve and document the role/API boundary; write the focused tests first and record that the current frontend test baseline cannot run because dependencies are absent; then give one Luna Coding sole sequential ownership of the implementation, test file, feature files, and `App.tsx` route wiring in the existing Windows checkout. The RTK requires an isolated worktree for parallel writable work; keep this slice sequential and do not create another branch or worktree in this environment. After dependencies become available, run the feature unit suite, typecheck and build; then request separate read-only UI Control for the route at project viewports `1440×900` and `1180×820`, recording manual comparison against Figma frame `2621:4113` at native size `1440×1024` as visual-reference evidence. A screenshot or unit test alone is not visual sign-off.

At handoff, `frontend/node_modules` is absent and project dependency installation is still awaiting the user's approval required by `RTK.md`; no Vitest, typecheck, build or UI runtime result is available yet.
