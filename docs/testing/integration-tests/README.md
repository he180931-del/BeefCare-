# Integration test source inventory

This directory preserves the Integration Test workbooks and the supplied local test guide exactly as received. The files are source evidence for the normalization work.

## Scope of this step

Step 1 records which source files were collected, their workbook structure, and the number of Integration cases that can be read. It does not change test steps, expected results, statuses, or evidence.

The canonical workbooks for later normalization will be created outside this `source/` directory. The source files remain unchanged for traceability.

## Inventory

See `../source-inventory.csv` for the file-level inventory, workbook sheets, case counts, status counts, and read status.

## Source files

- The two FE-01/FE-20/FE-21/FE-22 workbooks are retained because they are separate submissions from different revisions. They must be compared during Step 2 before choosing the canonical Lam scope.
- The FE-08/FE-12, FE-02/FE-03/FE-17/FE-19, and FE-04/FE-05/FE-06/FE-13/FE-16/FE-18 workbooks are retained as supplied.
- `Report5_IntegrationTest_Tai.xlsx` and `HUONG_DAN_INTEGRATION_TEST.md` are retained as supplied.

## Change control

Do not edit files in this directory. Corrections, normalized identifiers, fixture references, and review findings belong in later outputs.

## Findings recorded at collection time

- The inventory contains 8 supplied workbooks and 619 detectable case rows before deduplication. This is a raw source count, not the canonical team total.
- The Lam FE-01/FE-20/FE-21/FE-22 scope has two revisions. The Tài scope has three supplied workbooks with overlapping FE-07/FE-14/FE-15/FE-23 content. Revision and overlap decisions belong to Step 2.
- `BeefCare_Report5.2_Integration_Test_UI_FE04_FE05_FE06_FE13_FE16_FE18.xlsx` has detectable cases but no round-status values in the inspected status columns.
- `Report5_IntegrationTest_Tai.xlsx` uses a different case-ID format such as `INT-07-01`, while the newer UI workbooks use `FE07-INT-01`. Both forms are preserved in the inventory and will be mapped later.
