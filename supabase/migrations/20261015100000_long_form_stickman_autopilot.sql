-- Phase 6a — the Stickman autopilot: "Generate video" runs story plan ->
-- research-lite -> script as ONE server-side chain (no user clicks between),
-- with a watchdog that re-dispatches a stalled stage from its checkpoint.
--
-- long_form_projects.autopilot (jsonb, null for legacy projects):
--   { status: running|done|failed, startedAt, resumes, dispatched{plan,research,script},
--     resumeLog[], progressMax, failedReason, doneAt, scriptVersionId, lockUntil }

alter table public.long_form_projects add column if not exists autopilot jsonb;
create index if not exists long_form_projects_autopilot_running
  on public.long_form_projects ((autopilot->>'status')) where autopilot is not null;

-- One advance at a time per project (cron sweep + stage-finished nudges can
-- overlap): claim a short lock inside the autopilot record atomically.
create or replace function public.claim_long_form_autopilot(p_project_id uuid, p_seconds integer default 60)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a jsonb;
begin
  update public.long_form_projects
     set autopilot = jsonb_set(autopilot, '{lockUntil}', to_jsonb((now() + make_interval(secs => p_seconds))::text))
   where id = p_project_id
     and autopilot is not null
     and autopilot->>'status' = 'running'
     and (autopilot->>'lockUntil' is null or (autopilot->>'lockUntil')::timestamptz < now())
  returning autopilot into a;
  return a;
end;
$$;
revoke all on function public.claim_long_form_autopilot(uuid, integer) from public, anon, authenticated;

-- The 1-minute sweep (the safety net behind the per-stage nudges), same
-- vault pattern as the research/script advance crons.
create or replace function private.trigger_long_form_autopilot_advance()
returns bigint
language plpgsql security definer set search_path = private, public, vault as $$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'long_form_autopilot_advance_url' order by created_at desc limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'long_form_autopilot_secret' order by created_at desc limit 1;
  if nullif(v_url, '') is null or nullif(v_secret, '') is null then
    raise exception 'LONG_FORM_AUTOPILOT_VAULT_SECRETS_MISSING';
  end if;
  select net.http_post(
    url => v_url,
    headers => jsonb_build_object('content-type', 'application/json', 'x-autopilot-secret', v_secret),
    body => '{}'::jsonb,
    timeout_milliseconds => 5000
  ) into v_request_id;
  return v_request_id;
end;
$$;
revoke all on function private.trigger_long_form_autopilot_advance() from public;
grant execute on function private.trigger_long_form_autopilot_advance() to service_role;

-- Deployment note: the vault secrets (long_form_autopilot_advance_url,
-- long_form_autopilot_secret) and the edge secret LONG_FORM_AUTOPILOT_SECRET
-- are set out-of-band (never committed). Then:
select cron.schedule('long-form-autopilot-advance', '*/1 * * * *', 'select private.trigger_long_form_autopilot_advance();');
