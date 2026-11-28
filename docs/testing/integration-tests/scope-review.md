# Integration scope review

This file records the remaining scope review for the selected Integration Test
sources. It does not edit the supplied workbooks or the existing Report 5
tables.

## Source coverage

The canonical inventory contains 447 retained rows from five selected
workbooks. The review groups those rows by source owner and feature family.

| Owner or scope | Source coverage | Cases | Feature distribution | Observed status |
| --- | --- | ---: | --- | --- |
| Lam | FE-01, FE-20, FE-21, FE-22 workbook | 106 | FE-01 32, FE-20 39, FE-21 26, FE-22 9 | Passed 92, Failed 9, N/A 5 |
| Tai | FE-07, FE-14, FE-15, FE-23 workbook | 70 | FE-07 10, FE-14 7, FE-15 15, FE-23 38 | Pending 70 |
| Team | FE-02, FE-03, FE-17, FE-19 workbook | 86 | FE-02 25, FE-03 31, FE-17 6, FE-19 24 | Pending 86 |
| Team | FE-04, FE-05, FE-06, FE-13, FE-16, FE-18 workbook | 115 | FE-04 22, FE-05 22, FE-06 26, FE-13 19, FE-16 10, FE-18 16 | Status column has no explicit value for 115 rows |
| Team | FE-08, FE-09, FE-10, FE-11, FE-12 workbook | 70 | FE-08 12, FE-09 17, FE-10 17, FE-11 10, FE-12 14 | Pending 70 |

The three Team workbooks account for 271 canonical rows. The overall total is
106 + 70 + 271 = 447.

## Scope decisions

- The selected Lam workbook remains the 106-case revision.
- The selected Tai workbook remains the 70-case revision with the two design
  sheets. The older 68-case and 29-case files remain revision evidence.
- The Team workbooks stay separate by their supplied feature coverage. Their
  rows are combined only in the canonical inventory.
- The existing technical mapping remains 445 mapped rows and two unresolved
  rows, `FE09-INT-16` and `FE09-INT-17`. No UC was guessed for either row.
- The report-level Integration total of 418 is not changed by this technical
  scope review. The 447-row inventory remains a source-normalization count
  until the revision reconciliation is completed.

## Review findings requiring source-owner confirmation

1. The FE-08 to FE-12 workbook's `Test Statistics` declares 72 cases,
   distributed as FE-08 12, FE-09 17, FE-10 17, FE-11 12 and FE-12 14.
   The selected detail sheets contain 70 detectable IDs, with FE-11 showing
   10 IDs. Two FE-11 cases are therefore declared by the statistics sheet but
   have no detectable case ID in the selected detail inventory. Their IDs and
   procedures must be confirmed from the source owner before normalization.
2. The FE-04, FE-05, FE-06, FE-13, FE-16 and FE-18 workbook has 115 readable
   cases but no explicit Round 1 status values in the inspected status fields.
   Those rows remain in scope and their status is recorded as unreported.
3. `FE09-INT-16` and `FE09-INT-17` remain unresolved in D88 UC mapping because
   the retained source uses a legacy identifier that conflicts with the current
   mapping table. They remain in the inventory for owner review.

## Fixture implication

All 447 rows currently have `precondition_present_review` as their fixture
status. This review does not assign fixture IDs or create scenario data. The
next fixture step can use the owner and feature grouping above to define
scenario fixtures while preserving the supplied test procedures.

## Verification

- Read `docs/testing/integration-tests/integration-test-master.csv` with the
  direct Python 3.14 interpreter and grouped rows by `scope` and feature ID.
- Confirmed 447 canonical rows, 106 Lam rows, 70 Tai rows and 271 Team rows.
- Confirmed 445 mapped rows and unresolved `FE09-INT-16`/`FE09-INT-17`.
- Ran `git diff --check` after writing this evidence file.

