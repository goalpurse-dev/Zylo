-- Phase 6f — parallel render: a render is ONE parent job + up to 4 chunk jobs.
-- Each chunk renders a contiguous range of the timeline's pieces on its own
-- machine and uploads a chunk video; when the LAST chunk is done the parent
-- becomes claimable ('waiting' -> 'queued') and one machine joins the chunks,
-- mixes the audio, checks and uploads. Same total CPU work, ~N x faster.
alter table public.long_form_render_jobs drop constraint if exists long_form_render_jobs_status_check;
alter table public.long_form_render_jobs add constraint long_form_render_jobs_status_check check (status in ('queued', 'rendering', 'done', 'failed', 'waiting'));
alter table public.long_form_render_jobs add column if not exists parent_job_id uuid references public.long_form_render_jobs(id) on delete cascade;
alter table public.long_form_render_jobs add column if not exists chunk_index integer;
alter table public.long_form_render_jobs add column if not exists chunk_count integer not null default 0;
alter table public.long_form_render_jobs add column if not exists piece_from integer;
alter table public.long_form_render_jobs add column if not exists piece_to integer;
create index if not exists long_form_render_jobs_parent on public.long_form_render_jobs (parent_job_id);

-- One live RENDER per project: counts parents (and single jobs), never chunks.
drop index if exists public.long_form_render_jobs_one_live;
create unique index long_form_render_jobs_one_live on public.long_form_render_jobs (project_id)
  where parent_job_id is null and status in ('queued', 'rendering', 'waiting');

-- A chunk finished: mark it done; when every chunk of its parent is done, the
-- parent becomes claimable. Returns true to the worker that finished the last one.
create or replace function public.complete_long_form_render_chunk(p_chunk_id uuid, p_output_path text, p_seg_frames jsonb, p_compute_seconds numeric)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_parent uuid;
  v_left integer;
begin
  update public.long_form_render_jobs
     set status = 'done', output_path = p_output_path, checks = jsonb_build_object('segFrames', p_seg_frames),
         compute_seconds = coalesce(compute_seconds, 0) + p_compute_seconds, finished_at = now(), updated_at = now()
   where id = p_chunk_id and status = 'rendering'
   returning parent_job_id into v_parent;
  if v_parent is null then return false; end if;
  perform 1 from public.long_form_render_jobs where id = v_parent for update;
  select count(*) into v_left from public.long_form_render_jobs where parent_job_id = v_parent and status <> 'done';
  if v_left > 0 then return false; end if;
  update public.long_form_render_jobs set status = 'queued', stage = 'finishing', dispatched_at = now(), updated_at = now() where id = v_parent and status = 'waiting';
  return found;
end $$;
revoke all on function public.complete_long_form_render_chunk(uuid, text, jsonb, numeric) from public, anon, authenticated;
