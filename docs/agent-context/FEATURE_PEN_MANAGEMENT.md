# Feature context: pen management

## Routes and components

- `/pens`: `features/pen-management/pages/BarnList.tsx`
- Components: `BarnPanel`, `BarnTable`, `EditModal`, `DisableModal`, and
  `parts.tsx`.
- Public page boundary: `features/pen-management/index.ts`.

## API and lifecycle

The backend contract is `PenResource` at `/api/farms/{farmId}/pens` for list,
detail, create, update, and availability. Pens are not deleted. `PenMoveResource`
at `/api/farms/{farmId}/pen-moves` handles move checks, moves, and cattle pen
history. The local adapter remains in
`features/pen-management/api/penApi.ts` for local mode only.

The documented availability state is `ACTIVE <-> INACTIVE`; inactive pens block
new assignments but do not automatically move cattle already inside. Capacity,
criteria, effective dates, and warning reasons are backend rules. Do not
reimplement occupancy or move transactions in a page component.

## Tests and read-next

- Unit: `frontend/tests/unit/pens/PenManagement.test.tsx`
- API/adapter: `frontend/tests/api/penApi.test.ts`, `penApiContract.test.ts`
- Integration: `frontend/tests/integration/pens/`
- Backend: `backend/src/test/java/vn/edu/fpt/beefcare/service/Pen*Test.java`,
  `PenResourceTest.java`
- Read next: `API_RULES.md`, `VERIFICATION.md`, `PenResource`, `PenMoveResource`,
  and the current pen DTO/request classes.
