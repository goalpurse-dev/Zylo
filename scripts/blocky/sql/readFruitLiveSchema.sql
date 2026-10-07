-- Read-only: everything that defines AI Fruit Story's v2 backend in the live database, as one JSON value.
with t as (
  select c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'fruit\_%' and c.relname <> 'fruit_story_generations'
),
f as (
  select p.oid, p.proname, pg_get_functiondef(p.oid) as def, pg_get_function_identity_arguments(p.oid) as args, p.proacl::text as acl,
         p.prosecdef, (select rolname from pg_roles r where r.oid = p.proowner) as owner
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and (p.proname like 'fruit\_%' or p.oid in (select tg.tgfoid from pg_trigger tg join t on t.oid = tg.tgrelid where not tg.tgisinternal))
)
select json_build_object(
  'tables', (select json_agg(json_build_object('name', t.relname, 'rls', t.relrowsecurity, 'force_rls', t.relforcerowsecurity,
     'comment', obj_description(t.oid, 'pg_class'),
     'columns', (select json_agg(json_build_object('name', a.attname, 'type', format_type(a.atttypid, a.atttypmod), 'notnull', a.attnotnull,
          'default', pg_get_expr(d.adbin, d.adrelid), 'identity', a.attidentity, 'generated', a.attgenerated) order by a.attnum)
        from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
        where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped)) order by t.relname) from t),
  'constraints', (select json_agg(json_build_object('table', t.relname, 'name', c.conname, 'type', c.contype, 'def', pg_get_constraintdef(c.oid)) order by t.relname, c.contype, c.conname)
     from pg_constraint c join t on t.oid = c.conrelid),
  'indexes', (select json_agg(json_build_object('table', t.relname, 'name', i.relname, 'def', pg_get_indexdef(x.indexrelid)) order by t.relname, i.relname)
     from pg_index x join t on t.oid = x.indrelid join pg_class i on i.oid = x.indexrelid
     where not exists (select 1 from pg_constraint c where c.conindid = x.indexrelid)),
  'triggers', (select json_agg(json_build_object('table', t.relname, 'name', tg.tgname, 'def', pg_get_triggerdef(tg.oid)) order by t.relname, tg.tgname)
     from pg_trigger tg join t on t.oid = tg.tgrelid where not tg.tgisinternal),
  'functions', (select json_agg(json_build_object('name', f.proname, 'args', f.args, 'def', f.def, 'acl', f.acl, 'secdef', f.prosecdef, 'owner', f.owner) order by f.proname, f.args) from f),
  'policies', (select json_agg(json_build_object('table', p.tablename, 'name', p.policyname, 'permissive', p.permissive, 'roles', p.roles, 'cmd', p.cmd, 'qual', p.qual, 'with_check', p.with_check) order by p.tablename, p.policyname)
     from pg_policies p where p.schemaname = 'public' and p.tablename in (select relname from t)),
  'grants', (select json_agg(json_build_object('table', g.table_name, 'grantee', g.grantee, 'privilege', g.privilege_type) order by g.table_name, g.grantee, g.privilege_type)
     from information_schema.role_table_grants g where g.table_schema = 'public' and g.table_name in (select relname from t)),
  'publications', (select json_agg(json_build_object('pub', pubname, 'table', tablename) order by tablename) from pg_publication_tables where schemaname = 'public' and tablename in (select relname from t)),
  'replica_identity', (select json_agg(json_build_object('table', c.relname, 'ident', c.relreplident) order by c.relname) from pg_class c join t on t.oid = c.oid),
  'cron', (select json_agg(json_build_object('name', jobname, 'schedule', schedule, 'command', command, 'active', active)) from cron.job where jobname ilike '%fruit%'),
  'prices', (select json_agg(row_to_json(p)) from (select * from public.tool_prices where tool_key like '%blocky%' or tool_key like '%fruit-story%' order by tool_key) p),
  'flags', (select json_agg(row_to_json(g)) from (select * from public.global_feature_flags order by key) g),
  'counts', json_build_object(
     'characters', (select count(*) from public.fruit_characters), 'characters_by_niche', (select json_object_agg(niche, n) from (select niche, count(*) n from public.fruit_characters group by 1) x),
     'ideas_by_niche', (select json_object_agg(niche, n) from (select niche, count(*) n from public.fruit_ideas group by 1) x),
     'stories_by_niche', (select json_object_agg(niche, n) from (select niche, count(*) n from public.fruit_stories group by 1) x),
     'series_by_niche', (select json_object_agg(niche, n) from (select niche, count(*) n from public.fruit_series group by 1) x),
     'scenes_with_overlay', (select count(*) from public.fruit_story_scenes where overlay is not null),
     'null_age_or_gender', (select count(*) from public.fruit_characters where age is null or gender is null),
     'duplicate_first_names', (select count(*) from (select lower(split_part(name, ' ', 1)) from public.fruit_characters group by 1 having count(*) > 1) x),
     'blocky_ai_calls', (select count(*) from public.fruit_ai_calls where purpose like 'bakeoff:blocky%')
  )
) as schema;
