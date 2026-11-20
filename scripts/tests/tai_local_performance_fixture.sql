-- Synthetic P04/P06 dataset. Run with psql -v ON_ERROR_STOP=1 inside the
-- disposable PostgreSQL QA container. Farm C is reserved for this workload.
BEGIN;

DO $$
BEGIN
    IF current_database() <> 'beefcare_tai_final_20261116'
       OR NOT EXISTS (SELECT 1 FROM farm WHERE id = 1153 AND name = 'BeefCare Local Farm C')
       OR NOT EXISTS (SELECT 1 FROM app_user WHERE id = 1052 AND email = 'owner-2@beefcare.local')
       OR NOT EXISTS (SELECT 1 FROM jhi_user WHERE login = 'owner-2@beefcare.local' AND activated)
       OR NOT EXISTS (SELECT 1 FROM breed WHERE id = 1270 AND farm_id = 1153)
       OR NOT EXISTS (SELECT 1 FROM production_purpose WHERE id = 1310 AND farm_id = 1153 AND purpose_type = 'FATTENING') THEN
        RAISE EXCEPTION 'Expected the named isolated QA database and seed Farm C';
    END IF;
    IF EXISTS (SELECT 1 FROM cattle WHERE farm_id = 1153)
       OR EXISTS (SELECT 1 FROM app_user WHERE email LIKE 'qa-tai-load-%@beefcare.local') THEN
        RAISE EXCEPTION 'Performance fixture already present or Farm C is in use';
    END IF;
END $$;

INSERT INTO pen (id, farm_id, code, name, capacity, status, status_effective_date, created_by_id, created_at, updated_at)
SELECT 8710000 + pen_no, 1153, 'LOAD-' || pen_no, 'QA load pen ' || pen_no, 50, 'ACTIVE',
       (current_date - interval '2 years')::date, 1052, now(), now()
FROM generate_series(1, 6) AS pen_no;

INSERT INTO herd_entry_voucher (id, farm_id, code, entry_type, entry_date, status,
                                created_by_id, posted_by_id, posted_at, created_at, updated_at)
VALUES (8720001, 1153, 'QA-PERF-ENTRY', 'FARM_BORN', (current_date - interval '2 years')::date,
        'POSTED', 1052, 1052, now(), now(), now());

INSERT INTO cattle (id, farm_id, display_code, breed_id, purpose_id, sex, life_stage,
                    herd_status, birth_date, birth_date_accuracy)
SELECT 8730000 + item, 1153, 'BC-' || lpad(item::text, 6, '0'), 1270, 1310,
       CASE WHEN item % 2 = 0 THEN 'FEMALE' ELSE 'MALE' END, 'ADULT', 'ACTIVE',
       (current_date - interval '2 years')::date, 'EXACT'
FROM generate_series(1, 300) AS item;

INSERT INTO herd_entry (id, farm_id, voucher_id, line_no, cattle_id, source, entry_date,
                       initial_pen_id, status, created_at, updated_at)
SELECT 8740000 + item, 1153, 8720001, item, 8730000 + item, 'FARM_BORN',
       (current_date - interval '2 years')::date, 8710001 + (item - 1) / 50,
       'VALID', now(), now()
FROM generate_series(1, 300) AS item;

INSERT INTO pen_assignment (id, farm_id, cattle_id, pen_id, from_date, source, moved_by_id, recorded_at)
SELECT 8750000 + item, 1153, 8730000 + item, 8710001 + (item - 1) / 50,
       (current_date - interval '2 years')::date, 'HERD_ENTRY', 1052, now()
FROM generate_series(1, 300) AS item;

INSERT INTO growth (id, cattle_id, check_date, entry_time, observed_at, measured_by_id, weight_kg, weight_type, method, status)
SELECT 8760000 + item * 100 + month_no, 8730000 + item, sample_date, sample_date, sample_date,
       1052, 80 + item % 25 + 14 * month_no, 'MEASURED', 'SCALE', 'VALID'
FROM generate_series(1, 300) AS item
CROSS JOIN generate_series(0, 24) AS month_no
CROSS JOIN LATERAL (SELECT (current_date - interval '2 years' + month_no * interval '1 month')::date AS sample_date) AS sample;

INSERT INTO app_user (id, email, full_name, account_status, owner_registration_completed,
                      owner_registration_completed_at, password_login_enabled, password_method_status,
                      password_linked_at, terms_accepted, terms_accepted_at, created_at)
SELECT 8810000 + item, 'qa-tai-load-' || lpad(item::text, 3, '0') || '@beefcare.local',
       'QA load manager ' || item, 'ACTIVE', true, now(), true, 'ACTIVE', now(), true, now(), now()
FROM generate_series(1, 100) AS item;

INSERT INTO jhi_user (id, login, email, first_name, password_hash, activated, lang_key, created_by, created_date)
SELECT app.id, app.email, app.email, app.full_name, seed.password_hash, true, 'vi', 'qa-fixture', now()
FROM app_user AS app
CROSS JOIN jhi_user AS seed
WHERE app.id BETWEEN 8810001 AND 8810100 AND seed.login = 'owner-2@beefcare.local';

INSERT INTO jhi_user_authority (user_id, authority_name)
SELECT id, 'ROLE_USER' FROM jhi_user WHERE id BETWEEN 8810001 AND 8810100;

INSERT INTO farm_membership (id, farm_id, user_id, role, status, effective_date, joined_at)
SELECT 8820000 + item, 1153, 8810000 + item, 'MANAGER', 'ACTIVE', current_date, now()
FROM generate_series(1, 100) AS item;

COMMIT;
