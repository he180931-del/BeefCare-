# Step 3 deduplication findings

## Canonical inventory

The raw Step 2 inventory is preserved as `integration-test-master-raw.csv`. The canonical `integration-test-master.csv` now contains one row per selected test-case ID.

- Raw rows before deduplication: 452
- Canonical rows after deduplication: 447
- Removed duplicate rows: 5

## Resolution rules

- For `FE07-INT-05`, `FE07-INT-06`, and `FE07-INT-07`, the detailed rows in `FE07_Announcements` were retained. The repeated rows in `TestDesign-Publish` were removed from the canonical inventory because they repeat the same test intent without the complete detailed test layout.
- For `FE11-INT-10`, the first identical detailed row was retained. The other two identical rows were removed and recorded in the canonical row's deduplication note.

## What remains for the next step

- Map every case to the D88 UC. Rows without an explicit UC reference remain flagged.
- Separate test preconditions from data created by the test itself.
- Assign stable Fixture IDs and reset requirements.
- Resolve any cases whose repeated text is similar but not identical after the source owner reviews the canonical selection.

The test procedure and expected results of retained rows were not rewritten.
