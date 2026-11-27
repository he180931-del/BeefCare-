# Step 4 UC mapping and data classification

## Method

The canonical inventory keeps original_test_case_id, procedure, and expected_results unchanged. Mapping evidence was read from retained source workbook sheet/group headings, the Tài workbook Test Cases group list and ordered detailed-sheet ranges, and docs/requirements/UC_ID_MAPPING.md (D88) for legacy-ID conversion. Existing explicit description references were retained and converted through the same table. No UC was inferred from a feature name alone.

The uc_mapping column is the D88 UC used for reporting. mapping_status is mapped only when a source heading/group or explicit description reference supports it. mapping_note records evidence or review limitation.

## Results

- Canonical rows: 447; unique test-case IDs: 447.
- Mapped: 445 rows; unresolved: 2 rows.
- Unresolved group: FE09-INT-16 and FE09-INT-17. Their retained FE09 source heading uses a legacy identifier that conflicts with the D46 removal of UC-FE09-06; the detailed text indicates vaccination-record correction/void behavior, but no surviving source UC ID is explicit. They remain unresolved for owner review.

## Data classification

precondition_data copies supplied precondition text without rewriting it. data_created_during_test is conservative (explicit_in_procedure only when the procedure states a create/register/record/save/add/post/publish/update action; otherwise not_explicit). dependency records explicit prior test-case IDs named in precondition, or none_stated. fixture_status distinguishes rows with a supplied precondition (precondition_present_review) from rows without one.

These columns classify fixtures for later seed work; this step does not create or modify seed scripts or source workbooks.

## Limitations

The Tài detailed-sheet ranges follow its retained Test Cases group order; if the source owner changes group boundaries, those rows need a new review. Unresolved FE09 rows are intentionally not assigned a guessed UC.
