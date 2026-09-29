-- Phase 5c — the 1440p "YouTube master" render output (2560x1440, CRF 18),
-- stored next to the 1080p final and the 640x360 proxy.
alter table public.long_form_render_jobs add column if not exists master_path text;
alter table public.long_form_render_jobs add column if not exists master_size_bytes bigint;
alter table public.long_form_projects add column if not exists final_video_master_path text;
