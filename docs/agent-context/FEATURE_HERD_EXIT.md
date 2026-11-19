# Feature context: herd exit

## Routes and components

- `/herd-exit`: `frontend/src/features/herd-exit/pages/ExportList.tsx`
- `/herd-exit/new`: `frontend/src/features/herd-exit/pages/ExportNew.tsx`
- `/herd-exit/:id`: `frontend/src/features/herd-exit/pages/ExportDetail.tsx`
- Supporting UI: `frontend/src/features/herd-exit/components/PickModal.tsx`,
  `CollectModal.tsx`, `DeathView.tsx`, `CancelModal.tsx`, `RejectModal.tsx`,
  and `parts.tsx`.
- Public boundary: `frontend/src/features/herd-exit/index.ts` and
  `frontend/src/features/herd-exit/api/index.ts`.

## API and lifecycle

The backend adapter is `frontend/src/features/herd-exit/api/herdExitBackendApi.ts`;
the local adapter is `frontend/src/features/herd-exit/api/herdExitLocalApi.ts`.
The backend resource is `HerdExitVoucherResource` at
`/api/farms/{farmId}/exit-vouchers`. Selectable cattle, checks, payments,
attachments, and pen/cattle side effects are separate contract boundaries.

The documented lifecycle is `DRAFT -> CONFIRMED -> VOIDED`. A health-generated
`PENDING` voucher can be confirmed or dismissed with a reason. Confirm/void
must leave cattle status and open pen assignment consistent; verify the service
implementation rather than reproducing transitions in React.

Do not infer required fields or type-specific rules from the screen. Verify
`ExitVoucherRequests`, `HerdExitVoucherService`, the SRS, and the OpenAPI
operation before changing validation or payload mapping.

## Tests and read-next

- Unit: `frontend/tests/unit/herd-exit/`
- API/adapter: `frontend/tests/api/herdExitBackendApi.test.ts`
- Integration: `frontend/tests/integration/herd-exit/`
- Backend: `backend/src/test/java/vn/edu/fpt/beefcare/service/HerdExitVoucher*Test.java`
  and `web/rest/HerdExitVoucherResourceTest.java`
- Read next: `API_RULES.md`, `VERIFICATION.md`, and the exact DTO/resource
  operation for the requested transition.
