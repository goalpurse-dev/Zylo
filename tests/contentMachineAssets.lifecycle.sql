-- Content Machine round 3: the asset library, cancel, samples, 08:00, the honest-story rule, style visuals.
-- Run after the migrations inside BEGIN/ROLLBACK. Locally: node scripts/contentMachine/sqlCheck.mjs
begin;
do $$
begin
  insert into public.cm_assets (ref, path, source_path, sha256, content_type) values ('abcd1234', 'library/abcd1234.webp', 'public/x.webp', 'abcd1234ffff', 'image/webp');
  assert (select status = 'pending' from public.cm_assets where ref = 'abcd1234'), 'new assets wait for tagging';
  begin
    update public.cm_assets set status = 'great' where ref = 'abcd1234';
    raise exception 'bad status accepted';
  exception when check_violation then null;
  end;
  insert into public.cm_runs (run_date, kind, status) values (current_date, 'samples', 'cancelled');
  assert (select run_time_local = '08:00' from public.cm_settings), '08:00';
  assert (select brand_rules like '%clearly hypothetical%' from public.cm_settings), 'the honest-story rule';
  assert (select spec ? 'hero_prompt' from public.cm_library where kind = 'style' and key = 'neon_grid'), 'styles say how their pictures look';
  assert (select spec ->> 'hero_prompt' like '%{subject}%' from public.cm_library where kind = 'style' and key = 'luxury_night'), 'a subject slot';
  assert (select relrowsecurity from pg_class where oid = 'public.cm_assets'::regclass), 'RLS on the assets';
  assert not exists (select 1 from information_schema.role_table_grants where table_name = 'cm_assets' and grantee in ('anon', 'authenticated')), 'no client grants';
end $$;
rollback;
