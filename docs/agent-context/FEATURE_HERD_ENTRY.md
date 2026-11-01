# Feature context: herd entry

## Routes and components

- `/herd-entry`: `frontend/src/features/herd-entry/pages/ImportList.tsx`
- `/herd-entry/new`: `frontend/src/features/herd-entry/pages/ImportNew.tsx`
- `/herd-entry/:id`: `frontend/src/features/herd-entry/pages/ImportDetail.tsx`
- Supporting UI: `frontend/src/features/herd-entry/components/RowEditModal.tsx`,
  `ExcelModal.tsx`, `PayModal.tsx`, `CancelModal.tsx`, and `parts.tsx`.
- Public boundary: `frontend/src/features/herd-entry/index.ts` and
  `frontend/src/features/herd-entry/api/index.ts`.

## API and lifecycle

The backend adapter is `frontend/src/features/herd-entry/api/herdEntryBackendApi.ts`;
the local adapter is `frontend/src/features/herd-entry/api/herdEntryLocalApi.ts`,
selected by `frontend/src/api/backendTransport.ts`. The backend
resource is `HerdEntryVoucherResource` at
`/api/farms/{farmId}/entry-vouchers`.

The documented lifecycle is `DRAFT -> POSTED -> VOIDED`; a draft has no cattle,
pen, debt, or reminder effect. The resource supports list/create/get/update,
discard, checks, post, void, Excel import, and the feature attachment/payment
boundaries. Confirm transitions in the SRS and Java services before changing
side effects.

Do not infer required fields from the form. Verify `EntryVoucherRequest`, line
DTOs, `EntryVoucherRules`, `docs/api/openapi.json`, and the SRS section for
FE-06. `receivingPenId` and line rules are contract-owned.

## Tests and read-next

- Unit: `frontend/tests/unit/herd-entry/`
- API/adapter: `frontend/tests/api/herdEntryBackendApi.test.ts`,
  `entryDraftBackendFlow.test.ts`
- Integration: `frontend/tests/integration/herd-entry/`
- Backend: `backend/src/test/java/vn/edu/fpt/beefcare/service/HerdEntry*Test.java`
  and `web/rest/HerdEntryResourceTest.java`
- Read next: `API_RULES.md`, `VERIFICATION.md`, `HerdEntryVoucherResource`,
  `EntryVoucherRequest`, and the relevant OpenAPI operation.
