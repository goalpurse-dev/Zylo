-- Gateway JWT verification remains enabled. The public anon JWT gets through
-- the gateway; the separate server-only recovery secret authorizes the work.
-- Provision long_form_gateway_anon_key with this project's existing public
-- anon JWT through the administrative deployment environment, never a user JWT.
create or replace function private.trigger_long_form_visual_world_recovery()
returns void language plpgsql security definer set search_path = '' as $$
declare target record; secret text; research_url text; gateway_key text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name='long_form_research_advance_secret' limit 1;
  select decrypted_secret into research_url from vault.decrypted_secrets where name='long_form_research_advance_url' limit 1;
  select decrypted_secret into gateway_key from vault.decrypted_secrets where name='long_form_gateway_anon_key' limit 1;
  if secret is null or research_url is null or gateway_key is null then return; end if;
  for target in select id from public.long_form_visual_world_versions where status in ('planning','generating') and stage in ('generating','finalizing') and (worker_lock_until is null or worker_lock_until<now()) order by updated_at limit 3 loop
    perform net.http_post(url:=replace(research_url,'advance-long-form-research','advance-long-form-visual-world'),headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||gateway_key,'apikey',gateway_key,'x-recovery-secret',secret),body:=jsonb_build_object('visualWorldVersionId',target.id),timeout_milliseconds:=10000);
  end loop;
end $$;
revoke all on function private.trigger_long_form_visual_world_recovery() from public,anon,authenticated;
grant execute on function private.trigger_long_form_visual_world_recovery() to service_role;
