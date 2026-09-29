-- Phase 5b — server render of the final long-form MP4.
--
-- A render job is one EDL -> MP4 run, executed by the render worker (a Docker
-- container with Node + FFmpeg on a container host — never an edge function).
-- queued -> rendering -> done | failed. Idempotent and resumable: the worker
-- claims with SKIP LOCKED, heartbeats while rendering, and a job whose
-- heartbeat went stale (a crashed/evicted machine) is claimed again and
-- resumes from its finished segments (they're keyed by job id + clip index).
--
-- Project statuses gain: images_ready -> rendering -> complete | failed
-- (status_reason = the user-facing reason; a failed render is resumable).

create table if not exists public.long_form_render_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.long_form_projects(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'rendering', 'done', 'failed')),
  edl jsonb not null,
  edl_sha256 text not null,
  inputs_prefix text not null,              -- storage prefix of the job's inputs (images, overlay PNGs, narration)
  attempt integer not null default 0,
  max_attempts integer not null default 3,
  worker_id text,
  heartbeat_at timestamptz,
  segments_total integer,
  segments_done integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  output_path text,
  proxy_path text,
  output_url text,
  proxy_url text,
  duration_ms integer,
  size_bytes bigint,
  proxy_size_bytes bigint,
  checks jsonb,
  compute_seconds numeric,
  compute_usd numeric,
  error_code text,
  user_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one live job per project (a second "Render" click is a no-op, not a second paid render).
create unique index if not exists long_form_render_jobs_one_live
  on public.long_form_render_jobs (project_id) where status in ('queued', 'rendering');
create index if not exists long_form_render_jobs_queue on public.long_form_render_jobs (status, created_at);

alter table public.long_form_render_jobs enable row level security;
-- No policies: service role only (the worker and edge functions).
revoke all on public.long_form_render_jobs from anon, authenticated;

alter table public.long_form_projects add column if not exists status_reason text;
alter table public.long_form_projects add column if not exists final_video_path text;
alter table public.long_form_projects add column if not exists final_video_proxy_path text;
alter table public.long_form_projects add column if not exists final_thumbnail_url text;
alter table public.long_form_projects add column if not exists final_duration_ms integer;
alter table public.long_form_projects add column if not exists current_render_job_id uuid;

-- Claim the next job: the oldest queued one, or a 'rendering' one whose
-- heartbeat is older than p_stale_seconds (its machine died) — resumed, not
-- restarted. Attempts are capped; a job over the cap is failed, never looped.
create or replace function public.claim_long_form_render_job(p_worker_id text, p_stale_seconds integer default 300)
returns public.long_form_render_jobs
language plpgsql security definer set search_path = '' as $$
declare
  j public.long_form_render_jobs;
begin
  update public.long_form_render_jobs
     set status = 'failed', error_code = 'ATTEMPTS_EXHAUSTED', user_reason = 'The video could not be rendered after several tries. Please try again.', finished_at = now(), updated_at = now()
   where status = 'rendering' and heartbeat_at < now() - make_interval(secs => p_stale_seconds) and attempt >= max_attempts;

  select * into j from public.long_form_render_jobs
   where status = 'queued'
      or (status = 'rendering' and heartbeat_at < now() - make_interval(secs => p_stale_seconds) and attempt < max_attempts)
   order by created_at
   limit 1
   for update skip locked;
  if not found then return null; end if;

  update public.long_form_render_jobs
     set status = 'rendering', attempt = attempt + 1, worker_id = p_worker_id, heartbeat_at = now(),
         started_at = coalesce(started_at, now()), updated_at = now()
   where id = j.id
  returning * into j;
  update public.long_form_projects set status = 'rendering', status_reason = null where id = j.project_id;
  return j;
end;
$$;
revoke all on function public.claim_long_form_render_job(text, integer) from public, anon, authenticated;

-- The renders bucket: private; final MP4s run 70-90 MB (above the old 50 MB
-- default), so the bucket allows up to 1 GB (the project-wide storage limit
-- must also allow it).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('long-form-renders', 'long-form-renders', false, 1073741824, array['video/mp4', 'image/jpeg', 'image/png', 'audio/mpeg', 'application/json'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = false;
