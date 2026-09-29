-- Phase 6f — Publish: renders locked to an edit version, thumbnails, YouTube text.

-- A render renders ONE saved edit version at a chosen resolution; the stage
-- is what the worker is doing now (server-driven progress on the page).
alter table public.long_form_render_jobs add column if not exists edit_version integer;
alter table public.long_form_render_jobs add column if not exists resolution text not null default '1080p';
alter table public.long_form_render_jobs add column if not exists stage text;
alter table public.long_form_render_jobs add column if not exists machine_id text;
alter table public.long_form_render_jobs add column if not exists dispatched_at timestamptz;

-- Thumbnails: 3 per batch, the model's picture (no text) + the headline drawn
-- by code as an editable layer; one is picked.
create table if not exists public.long_form_thumbnails (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.long_form_projects(id) on delete cascade,
  batch integer not null default 1,
  slot integer not null,
  status text not null default 'queued' check (status in ('queued', 'rendering', 'ready', 'failed')),
  prompt text,
  image_url text,           -- the model's 1280x720 picture (no text)
  headline text,
  layer jsonb,              -- the headline as an editable layer (1280x720 space)
  png_url text,             -- the composited PNG (<= 2 MB)
  selected boolean not null default false,
  credits_charged integer not null default 0,
  cost_usd numeric not null default 0,
  error text,
  created_at timestamptz not null default now(),
  ready_at timestamptz
);
create index if not exists long_form_thumbnails_project on public.long_form_thumbnails (project_id, batch desc, slot);
alter table public.long_form_thumbnails enable row level security;
revoke all on public.long_form_thumbnails from anon, authenticated;

-- YouTube text: title (+4 alternatives), description parts, tags.
create table if not exists public.long_form_publish_meta (
  project_id uuid primary key references public.long_form_projects(id) on delete cascade,
  title text,
  title_alternatives jsonb not null default '[]'::jsonb,
  hook text,
  chapters jsonb not null default '[]'::jsonb,   -- [{ "ms": 0, "title": "..." }]
  sources jsonb not null default '[]'::jsonb,    -- [{ "title": "...", "url": "https://..." }]
  include_credit boolean not null default true,
  tags jsonb not null default '[]'::jsonb,
  edit_version integer,
  cost_usd numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.long_form_publish_meta enable row level security;
revoke all on public.long_form_publish_meta from anon, authenticated;

-- Watchdog: every 2 minutes, a render job that is queued with no machine, or
-- rendering with a stale heartbeat, gets a machine again (the claim RPC
-- resumes it; attempts are capped there). Same vault pattern as the autopilot.
create or replace function private.trigger_long_form_render_watchdog()
returns bigint
language plpgsql security definer set search_path = private, public, vault as $$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'long_form_render_watchdog_url' order by created_at desc limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'long_form_autopilot_secret' order by created_at desc limit 1;
  if nullif(v_url, '') is null or nullif(v_secret, '') is null then return null; end if;
  if not exists (select 1 from public.long_form_render_jobs where status in ('queued', 'rendering')) then return null; end if;
  select net.http_post(
    url => v_url,
    headers => jsonb_build_object('content-type', 'application/json', 'x-autopilot-secret', v_secret),
    body => '{"action":"watchdog"}'::jsonb,
    timeout_milliseconds => 5000
  ) into v_request_id;
  return v_request_id;
end;
$$;
revoke all on function private.trigger_long_form_render_watchdog() from public;
grant execute on function private.trigger_long_form_render_watchdog() to service_role;
select cron.schedule('long-form-render-watchdog', '*/2 * * * *', 'select private.trigger_long_form_render_watchdog();');
