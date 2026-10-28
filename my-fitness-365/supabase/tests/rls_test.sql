-- Row-level security tests (v1). Every check raises an exception on failure,
-- so psql (ON_ERROR_STOP) exits non-zero and the test run fails visibly.
\set ON_ERROR_STOP on
insert into auth.users values ('aaaaaaaa-0000-4000-8000-000000000001', 'a@example.com'), ('bbbbbbbb-0000-4000-8000-000000000002', 'b@example.com');

create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), false);
  if uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;

create or replace function pg_temp.expect_fail(sql text, label text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'PASS (denied): %', label;
    return;
  end;
  raise exception 'FAIL: % was allowed', label;
end $$;

create or replace function pg_temp.expect_count(sql text, n int, label text) returns void language plpgsql as $$
declare c int;
begin
  execute sql into c;
  if c <> n then raise exception 'FAIL: % — expected %, got %', label, n, c; end if;
  raise notice 'PASS: %', label;
end $$;

-- User A writes their own data
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
insert into public.weight_entries (id, user_id, date, weight_kg) values ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '2026-10-28', 88.0);
insert into public.progress_photos (id, user_id, date, view, storage, storage_path, width, height, mime) values ('22222222-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '2026-10-28', 'front', 'cloud', 'aaaaaaaa-0000-4000-8000-000000000001/22222222-0000-4000-8000-000000000001.jpg', 1200, 1600, 'image/jpeg');
insert into public.workout_templates (id, user_id, key, name) values ('33333333-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'workout_a', 'Workout A');
insert into public.workout_sessions (id, user_id, date, template_id, name, status, started_at) values ('44444444-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '2026-10-28', '33333333-0000-4000-8000-000000000001', 'Workout A', 'in_progress', now());
insert into storage.objects (bucket_id, name) values ('progress-photos', 'aaaaaaaa-0000-4000-8000-000000000001/22222222-0000-4000-8000-000000000001.jpg');
select pg_temp.expect_count('select count(*) from public.weight_entries', 1, 'A can read own weight');
select pg_temp.expect_count('select count(*) from storage.objects', 1, 'A can read own photo object');
-- Idempotent upsert of the same client id does not duplicate
insert into public.weight_entries (id, user_id, date, weight_kg) values ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '2026-10-28', 87.9)
  on conflict (id) do update set weight_kg = excluded.weight_kg;
select pg_temp.expect_count('select count(*) from public.weight_entries', 1, 'Upsert with same id does not duplicate');
select pg_temp.expect_fail($$insert into public.weight_entries (id, user_id, date, weight_kg) values (gen_random_uuid(), 'bbbbbbbb-0000-4000-8000-000000000002', '2026-10-28', 80)$$, 'A inserting a row owned by B');
select pg_temp.expect_fail($$update public.weight_entries set user_id = 'bbbbbbbb-0000-4000-8000-000000000002'$$, 'A handing a row to B');
select pg_temp.expect_fail($$insert into storage.objects (bucket_id, name) values ('progress-photos', 'bbbbbbbb-0000-4000-8000-000000000002/x.jpg')$$, 'A uploading into B''s photo folder');

-- User B cannot see, change or delete A's data
select pg_temp.as_user('bbbbbbbb-0000-4000-8000-000000000002');
select pg_temp.expect_count('select count(*) from public.weight_entries', 0, 'B cannot read A''s weights');
select pg_temp.expect_count('select count(*) from public.progress_photos', 0, 'B cannot read A''s photo metadata');
select pg_temp.expect_count('select count(*) from storage.objects', 0, 'B cannot read A''s photo files');
select pg_temp.expect_count($$with u as (update public.weight_entries set weight_kg = 50 returning 1) select count(*) from u$$, 0, 'B cannot update A''s weights');
select pg_temp.expect_count($$with d as (delete from public.progress_photos returning 1) select count(*) from d$$, 0, 'B cannot delete A''s photo metadata');
select pg_temp.expect_count($$with d as (delete from storage.objects returning 1) select count(*) from d$$, 0, 'B cannot delete A''s photo files');
select pg_temp.expect_count($$with u as (update public.weight_entries set user_id = 'bbbbbbbb-0000-4000-8000-000000000002' returning 1) select count(*) from u$$, 0, 'B cannot take ownership of A''s rows');
-- B cannot attach their own child rows to A's parent rows
select pg_temp.expect_fail($$insert into public.exercises (id, user_id, key, name) values ('55555555-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'x', 'X');
  insert into public.workout_sets (id, user_id, session_id, exercise_id, set_number) values (gen_random_uuid(), 'bbbbbbbb-0000-4000-8000-000000000002', '44444444-0000-4000-8000-000000000001', '55555555-0000-4000-8000-000000000002', 1)$$, 'B adding a set to A''s workout session');

-- Anonymous (signed-out) access gets nothing
select pg_temp.as_user(null);
select pg_temp.expect_fail('select count(*) from public.weight_entries', 'anon reading weights');
select pg_temp.expect_fail('select count(*) from public.progress_photos', 'anon reading photo metadata');
select pg_temp.expect_count('select count(*) from storage.objects', 0, 'anon cannot read photo files');
select pg_temp.expect_fail('select public.delete_my_account()', 'anon calling delete_my_account');

-- Server stamps updated_at (sync cursors don't trust device clocks)
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
select pg_temp.expect_count($$select count(*) from public.weight_entries where updated_at > now() - interval '1 minute'$$, 1, 'updated_at stamped by server');

-- Account deletion cascades to every row
select public.delete_my_account();
reset role;
select pg_temp.expect_count($$select count(*) from public.weight_entries where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$, 0, 'delete_my_account removes the user''s rows');
select pg_temp.expect_count($$select count(*) from public.progress_photos where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$, 0, 'delete_my_account removes photo metadata');

-- Every public table has RLS enabled and forced
select pg_temp.expect_count($$select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not (c.relrowsecurity and c.relforcerowsecurity)$$, 0, 'RLS enabled + forced on every public table');
\echo 'ALL RLS TESTS PASSED'
