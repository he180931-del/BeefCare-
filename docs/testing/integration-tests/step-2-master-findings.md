# Step 2 master inventory findings

## Selected source revisions

- Lam uses `BeefCare_Report5_2_Integration_Test_UI_FE01_FE20_FE21_FE22.xlsx`, the later 106-case revision.
- Tài uses `BeefCare_Report5.2_Integration_Test_Tai.xlsx`, the later 70-case workbook available in the workspace.
- Older Lam and Tài revisions remain available outside the selected source set and are not part of this branch inventory.

## Inventory result

The selected source set contains 5 workbooks and 447 detectable test case IDs before deduplication. The master inventory records 452 rows because some selected workbooks contain repeated IDs in supporting/design sheets. It preserves each source row so the duplicate can be resolved with evidence in the next step.

## Duplicates requiring resolution

- `FE07-INT-05`, `FE07-INT-06`, and `FE07-INT-07` occur in both the FE07 detail sheet and the Tài design sheet in the selected workbook.
- `FE11-INT-10` occurs three times in the FE-11 sheet of the selected FE08/FE12 workbook.

## Other review flags

Many rows have no explicit `UC-FE##-##` reference in their description. The test case itself is retained. The missing reference is a normalization task for the next review step, not a reason to delete the row.

## Files created in Step 2

- `integration-test-master.csv` is the row-level source inventory. It keeps the original text and source coordinates.
- `source-inventory.csv` is the file-level inventory.

No test procedure, expected result, status, or evidence was rewritten in this step.
