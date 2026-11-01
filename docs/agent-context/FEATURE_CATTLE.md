# Feature context: cattle

## Routes and components

- `/cattle`: `features/cattle/pages/CowList.tsx`
- `/cattle/:code`: `features/cattle/pages/CowProfile.tsx`
- Profile components: `CowHeader`, `OverviewTab`, `BarnsTab`, `TimelineTab`,
  `QrTab`, `MoveModal`, `UpdateModal`, `RecordEditModal`, `QrReissueModal`.
- Public page boundary: `features/cattle/index.ts`.

## API and data flow

The feature facade is `features/cattle/api/cattleApi.ts`; backend mapping is in
`frontend/src/api/cattleBackendApi.ts`. Backend endpoints are owned by
`CattleProfileResource`: list/detail/profile update/QR/timeline/resolve. Pen
moves use `PenMoveResource`; the cattle API performs the check then move
command and sends idempotency/version data.

The backend list is paged (`page`, `size`, and documented filters). Keep
pagination and numeric IDs at the API boundary; display cattle codes are not
database IDs. Profile update is a full snapshot command, so load the current
profile before sending a partial-tab edit.

Do not infer profile requiredness or editable status from labels. Verify
`CattleDtos`, `CattleProfileService`, the SRS, and the OpenAPI operation.

## Tests and read-next

- Unit: `frontend/tests/unit/cattle/`
- API/adapter: `frontend/tests/api/cattleApi.test.ts`,
  `cattleApiContract.test.ts`
- Integration: `frontend/tests/integration/pens/penCattleMoveIntegration.test.tsx`
- Backend: `backend/src/test/java/vn/edu/fpt/beefcare/service/Cattle*Test.java`
- Read next: `API_RULES.md`, `VERIFICATION.md`, and `CattleProfileResource`.
