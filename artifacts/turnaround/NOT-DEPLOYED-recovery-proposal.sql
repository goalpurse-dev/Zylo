-- Reconcile only existing master jobs; never create another provider job.
create or replace function private.trigger_character_turnaround_recovery()
returns void language plpgsql security definer set search_path='' as $$
declare target record; gateway text; secret text; base_url text;
begin
  select decrypted_secret into gateway from vault.decrypted_secrets where name='long_form_gateway_anon_key';
  select decrypted_secret into secret from vault.decrypted_secrets where name='long_form_research_advance_secret';
  select decrypted_secret into base_url from vault.decrypted_secrets where name='long_form_research_advance_url';
  if gateway is null or secret is null or base_url is null then return; end if;
  for target in select a.id from public.long_form_reference_assets a
    where a.generation_type='turnaround_master' and a.qa_expectations->>'reviewStatus'='pending'
    and (a.status='running' or (a.status='succeeded' and
      (select count(*) from public.long_form_reference_assets c where c.source_master_asset_id=a.id) < case when (a.qa_expectations->>'includePose')::boolean then 6 else 5 end))
    order by a.created_at limit 3
  loop
    perform net.http_post(url:=replace(base_url,'advance-long-form-research','character-turnaround'),
      headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||gateway,'apikey',gateway,'x-recovery-secret',secret),
      body:=jsonb_build_object('action','reconcile','masterAssetId',target.id),timeout_milliseconds:=30000);
  end loop;
end $$;
revoke all on function private.trigger_character_turnaround_recovery() from public,anon,authenticated;
grant execute on function private.trigger_character_turnaround_recovery() to service_role;
select cron.schedule('character-turnaround-recovery','* * * * *','select private.trigger_character_turnaround_recovery();');
