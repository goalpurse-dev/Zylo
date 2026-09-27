-- Real gap found during audit (2026-09-13): the standing recovery cron only
-- scans worlds where status in ('planning','generating') — a world that has
-- already moved to 'needs_attention'/'ready' (e.g. because it reached
-- MAX_STAGE_ATTEMPTS, or a human already reviewed the rest) is NEVER
-- rescanned again, even if it still has a reference asset whose job_id
-- points at a job that later succeeds (or fails) after the world stopped
-- being scanned. In the current code this narrow race is unlikely (stage
-- only becomes 'finalizing' once every current asset is already
-- succeeded/failed — see stageGenerating's allTerminal check) but it is not
-- IMPOSSIBLE (a crash between a provider callback and the DB write, a
-- missed poll, a worker restart), and Part 5/6 of this fix explicitly
-- requires "a provider-successful job must NEVER be lost" as a durability
-- guarantee, not a probabilistic one. Extending the cron's own WHERE clause
-- to ALSO pick up ANY world (regardless of its own status) that still has a
-- non-terminal reference asset with a real job_id — reusing the EXISTING
-- advance-long-form-visual-world reconciliation loop (Part 5's own
-- "reconcile_reference_jobs" requirement is already implemented as that
-- loop; this migration is what makes sure it actually gets invoked for
-- every world that needs it, not just ones still formally 'generating').
create or replace function private.trigger_long_form_visual_world_recovery()
returns void language plpgsql security definer set search_path = '' as $$
declare target record; secret text; research_url text; gateway_key text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name='long_form_research_advance_secret' limit 1;
  select decrypted_secret into research_url from vault.decrypted_secrets where name='long_form_research_advance_url' limit 1;
  select decrypted_secret into gateway_key from vault.decrypted_secrets where name='long_form_gateway_anon_key' limit 1;
  if secret is null or research_url is null or gateway_key is null then return; end if;
  for target in
    select v.id from public.long_form_visual_world_versions v
    where (v.worker_lock_until is null or v.worker_lock_until<now())
      and (
        (v.status in ('planning','generating') and v.stage in ('generating','finalizing'))
        or exists (
          select 1 from public.long_form_reference_assets a
          where a.visual_world_version_id = v.id
            and a.job_id is not null
            and a.status in ('pending','running')
            and not exists (select 1 from public.long_form_reference_assets newer where newer.replaces_asset_id = a.id)
        )
      )
    order by v.updated_at limit 3
  loop
    perform net.http_post(url:=replace(research_url,'advance-long-form-research','advance-long-form-visual-world'),headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||gateway_key,'apikey',gateway_key,'x-recovery-secret',secret),body:=jsonb_build_object('visualWorldVersionId',target.id),timeout_milliseconds:=10000);
  end loop;
end $$;
