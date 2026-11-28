# Scenario fixtures

`seed/scenario-fixture-manifest.json` is the offline contract for data that
must be created by a feature scenario. It extends the shared baseline without
putting create or update results into the baseline seed.

The manifest maps each scenario to the canonical Integration case prefixes,
the baseline stable keys it needs, the entities it plans to create, the
mutations under test and the reset rule. Scenario writes use an idempotency
namespace of `scenario-<fixture_id>-*`. The baseline `baseline-*` namespace
must not be reused.

## Current fixture groups

| Feature | Fixture | Main purpose | Runtime status |
| --- | --- | --- | --- |
| FE-01 | `scn-fe01-auth-lifecycle-v1` | Account, verification and reset flows | Auth and mailbox contract required |
| FE-07 | `scn-fe07-announcement-lifecycle-v1` | Publish, correction, delivery and read state | Existing helper, runtime unverified |
| FE-09 | `scn-fe09-care-case-v1` | Health, vaccination, observation and treatment | API contract required |
| FE-10 | `scn-fe10-growth-correction-v1` | Growth record, correction and void | API contract required |
| FE-11 | `scn-fe11-reproduction-v1` | Estrus, breeding and pregnancy checks | Partial route contract, source review required |
| FE-12 | `scn-fe12-calving-v1` | Pregnancy, calving and calf registration | API contract required |
| FE-13 | `scn-fe13-exit-permission-v1` | Exit voucher and permission variants | API contract required |
| FE-14 | `scn-fe14-reminder-lifecycle-v1` | Low-stock, feeding and breeding reminders | Existing helper, runtime unverified |
| FE-15 | `scn-fe15-report-snapshot-v1` | Dated sources for dashboard and reports | Depends on source fixtures, runtime unverified |
| FE-19 | `scn-fe19-payment-lifecycle-v1` | Payments, bank transactions and permissions | API contract required |
| FE-23 | `scn-fe23-feed-lifecycle-v1` | Receipt, stock, ration and feeding flow | Existing helper, runtime unverified |

FE-02, FE-03, FE-04, FE-05, FE-06, FE-08, FE-17, FE-18, FE-20, FE-21 and
FE-22 are covered by the baseline prerequisites in `seed/baseline-manifest.json`
unless a case explicitly requires a mutation. Their scenario additions should
reuse the same feature IDs and receive a new manifest entry after the API
contract review.

## Execution rules

1. Start the disposable QA database and backend documented in `QA_FIXTURES.md`.
2. Run the baseline seed first and record its readback.
3. Run only the fixture entries needed by the selected Integration cases.
4. Confirm every POST uses the fixture's scenario idempotency prefix and a
   stable business key.
5. Read back the created records by sentinel and verify farm ownership,
   expected status and version before running the UI case.
6. Reset the isolated QA database between scenarios that mutate the same
   cattle, pen, payment or voucher state.
7. Record a blocker when a route, DTO, role or worker schedule cannot be
   verified. Do not substitute SQL or mark a fixture as ready by assumption.

## Runtime blockers

This manifest was built offline. The current workspace has no running QA
backend or PostgreSQL listener, and the required local secrets were not set in
the checking session. The existing FE-07/FE-14/FE-15/FE-23 helper can be used
after runtime setup. The FE-09/FE-10/FE-12/FE-13/FE-19 writers remain blocked
until their current API routes and request DTOs are confirmed.

The FE-09 inventory also contains unresolved `FE09-INT-16` and
`FE09-INT-17`. Do not attach either case to a fixture until the source owner
confirms the surviving D88 UC mapping.

No Google Docs tables or source workbooks are changed by this step.
