-- Two synthetic females for the RPT-05 screen in the disposable QA Farm A.
-- Run with psql -v ON_ERROR_STOP=1. This fixture is not a production migration.
BEGIN;

DO $$
BEGIN
    IF current_database() <> 'beefcare_tai_final_20261116'
       OR NOT EXISTS (SELECT 1 FROM farm WHERE id = 1151 AND name = 'BeefCare Local Farm A')
       OR NOT EXISTS (SELECT 1 FROM app_user WHERE id = 1051 AND email = 'owner@beefcare.local')
       OR NOT EXISTS (SELECT 1 FROM production_purpose WHERE id = 1301 AND farm_id = 1151 AND purpose_type = 'BREEDING')
       OR EXISTS (SELECT 1 FROM cattle WHERE farm_id = 1151 AND display_code IN ('BC-009901','BC-009902')) THEN
        RAISE EXCEPTION 'Expected the named disposable QA database with unused RPT-05 fixture codes';
    END IF;
END $$;

INSERT INTO herd_entry_voucher (id, farm_id, code, entry_type, entry_date, status,
                                created_by_id, posted_by_id, posted_at, created_at, updated_at)
VALUES (8850001, 1151, 'QA-RPT05-ENTRY', 'FARM_BORN', (current_date - interval '3 years')::date,
        'POSTED', 1051, 1051, now(), now(), now());

INSERT INTO cattle (id, farm_id, display_code, breed_id, purpose_id, sex, life_stage,
                    herd_status, birth_date, birth_date_accuracy)
VALUES (8850011, 1151, 'BC-009901', 1252, 1301, 'FEMALE', 'ADULT', 'ACTIVE', (current_date - interval '3 years')::date, 'EXACT'),
       (8850012, 1151, 'BC-009902', 1252, 1301, 'FEMALE', 'ADULT', 'ACTIVE', (current_date - interval '3 years')::date, 'EXACT');

INSERT INTO herd_entry (id, farm_id, voucher_id, line_no, cattle_id, source, entry_date,
                        initial_pen_id, status, created_at, updated_at)
VALUES (8850021, 1151, 8850001, 1, 8850011, 'FARM_BORN', (current_date - interval '3 years')::date, 2151, 'VALID', now(), now()),
       (8850022, 1151, 8850001, 2, 8850012, 'FARM_BORN', (current_date - interval '3 years')::date, 2152, 'VALID', now(), now());

INSERT INTO pen_assignment (id, farm_id, cattle_id, pen_id, from_date, source, moved_by_id, recorded_at)
VALUES (8850031, 1151, 8850011, 2151, (current_date - interval '3 years')::date, 'HERD_ENTRY', 1051, now()),
       (8850032, 1151, 8850012, 2152, (current_date - interval '3 years')::date, 'HERD_ENTRY', 1051, now());

INSERT INTO reproduction_event (id, cattle_id, type, result, event_time, status)
VALUES (8850041, 8850012, 'ESTRUS', 'OBSERVED', now() - interval '1 hour', 'VALID');

COMMIT;
