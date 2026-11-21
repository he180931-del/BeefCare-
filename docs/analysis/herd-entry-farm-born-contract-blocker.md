# Herd Entry FARM_BORN contract audit — decision blocker

Date: 2026-11-21  
Scope: WBS 4 Herd Entry refactor (farm-born parentage and pending-calf commands)

## Evidence reviewed

- `docs/REQUIREMENT_DECISIONS.md` (D12 source-of-truth order)
- `docs/requirements/SRS_2026-10-28.txt`: GBR-31, GBR-93, UC-FE06-01 AF1/AF7
- `docs/requirements/specs/FE-06-nhap-dan.md`: R-06-18, TC-06-22
- `backend/src/main/java/vn/edu/fpt/beefcare/web/rest/HerdEntryResource.java`
- `backend/src/main/java/vn/edu/fpt/beefcare/service/PendingCalfService.java`
- `frontend/src/features/herd-entry/pages/ImportNew.tsx`
- `frontend/src/features/herd-entry/api/herdEntryBackendApi.ts`

## Discrepancy

The approved SRS says that a FARM_BORN voucher takes dam, sire, breed, sex,
birth date and birth weight from the calving event and displays them read-only
(GBR-31; FE-06 R-06-18; TC-06-22). The current backend exposes
`POST /pending-calves/{calfId}/parentage`, and `PendingCalfService` accepts a
parentage correction (`damId`, optional `sireId`, and sire source). The current
frontend renders editable dam/sire controls for a pending calf and invokes that
endpoint before voucher posting.

This is not a safe frontend-only refactor decision: removing the controls would
change an existing supported backend command, while retaining them contradicts
the approved SRS read-only requirement. No behavior is changed by this audit.

## Explicit blocker / escalation

Product and backend owners must decide one of the following before the next
farm-born implementation slice:

1. **SRS wins:** remove/retire the parentage correction endpoint and make the
   pending-calf parentage UI read-only, with persistence proven from calving.
2. **Backend command is intentional:** amend D12/SRS/FE-06 to define when
   parentage correction is allowed, its validation, audit trail, and whether it
   may occur before or after draft creation; then add contract and round-trip
   tests.

Until that decision is recorded, farm-born parentage behavior is an explicit
blocker. The WBS4 refactor preserves the current command and does not claim
SRS compliance for this discrepancy.
