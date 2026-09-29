-- Thumbnail V2: each thumbnail is one concept (archetype + headline + scene)
-- built from the video; the free code checks + the OCR verdict are kept, and a
-- thumbnail that still fails after its one re-render is flagged (the best one is kept).
alter table public.long_form_thumbnails add column if not exists version integer not null default 1;
alter table public.long_form_thumbnails add column if not exists concept jsonb;
alter table public.long_form_thumbnails add column if not exists checks jsonb;
alter table public.long_form_thumbnails add column if not exists flagged boolean not null default false;
alter table public.long_form_thumbnails add column if not exists full_url text;   -- 1920x1080 with the headline

-- One batch at a time: the Publish autopilot and a page opened mid-way can't both
-- start the included batch (the second insert fails -> "busy"), so it's never paid twice.
create unique index if not exists long_form_thumbnails_batch_slot on public.long_form_thumbnails (project_id, batch, slot);
