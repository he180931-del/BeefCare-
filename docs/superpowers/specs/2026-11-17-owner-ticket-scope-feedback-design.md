# Owner ticket category, scope, and validation feedback

## Source of truth

- `docs/requirements/specs/FE-20-ho-tro-khach-hang.md`: R-20-01, UC-FE20-01, SCR-65.
- `docs/REQUIREMENT_DECISIONS.md`: D40, which resolves the category/scope ambiguity in FE-20.
- `SupportTicketCommandService#create`: an account-scoped ticket must have `farmId = null`; a farm-scoped ticket must reference a farm owned by the requester.

## Intended behavior

- `ACCOUNT_ACCESS` forces `ACCOUNT`: the farm selector is disabled and `farmId` is cleared to `null`.
- `PAYMENT` and `FARM_SERVICE` force `FARM`: account scope is disabled, the farm selector is enabled and required, and the form explains `Danh mục này bắt buộc gắn với trang trại.`
- `SYSTEM_USAGE` and `OTHER` allow either scope. Choosing `ACCOUNT` clears `farmId`; choosing `FARM` requires an owned farm.
- The backend enforces the same matrix so a caller cannot bypass the form. Invalid category/scope combinations are validation errors on `scope`.
- A backend validation response without field-level errors is shown in the form-level error note so the submit action never appears to fail silently.

## Verification

- Unit-test the category/scope transitions, disabled choices, validation messages, and submitted payload.
- Unit-test fieldless backend validation mapping.
- Integration-test the category/scope matrix in `SupportTicketCommandService`.
- Run the support feature unit suite, typecheck, and build.
- Manually verify the Owner route `/ho-tro/moi` against the running backend.
