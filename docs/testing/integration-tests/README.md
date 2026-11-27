# Integration test source inventory

This directory preserves the Integration Test workbooks and the supplied local test guide exactly as received. The files are source evidence for the normalization work.

## Scope of this step

Step 1 records which source files were collected, their workbook structure, and the number of Integration cases that can be read. It does not change test steps, expected results, statuses, or evidence.

The canonical workbooks for later normalization will be created outside this `source/` directory. The source files remain unchanged for traceability.

## Inventory

See `../source-inventory.csv` for the file-level inventory, workbook sheets, case counts, status counts, and read status.

## Source files

- The newer FE-01/FE-20/FE-21/FE-22 workbook is the selected Lam source. The older 75-case revision was removed from this branch source directory and remains available only in the original Downloads location.
- The FE-08/FE-12, FE-02/FE-03/FE-17/FE-19, and FE-04/FE-05/FE-06/FE-13/FE-16/FE-18 workbooks are retained as supplied.
- `BeefCare_Report5.2_Integration_Test_Tai.xlsx` is the selected latest Tài source. The older Tài workbooks were removed from this branch source directory. `HUONG_DAN_INTEGRATION_TEST.md` is retained as supplied.

## Change control

Do not edit files in this directory. Corrections, normalized identifiers, fixture references, and review findings belong in later outputs.

## Findings recorded at collection time

- The inventory contains 5 supplied workbooks and 447 detectable case IDs before deduplication. This is a raw source count, not the canonical team total.
- The Lam and Tài sources are now pinned to the newest selected workbook. Overlap within the selected Tài workbook and duplicate FE11 rows remain review findings for Step 2.
- `BeefCare_Report5.2_Integration_Test_UI_FE04_FE05_FE06_FE13_FE16_FE18.xlsx` has detectable cases but no round-status values in the inspected status columns.
- The selected Tài workbook uses `FE07-INT-01` style IDs. Any older `INT-07-01` IDs are outside the selected source set.

