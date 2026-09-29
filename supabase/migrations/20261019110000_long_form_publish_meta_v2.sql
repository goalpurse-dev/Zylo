-- YouTube Description V2: the intro (hook paragraph, "We look at…" paragraph,
-- thesis line) stays in `hook`; plus a niche-aware disclaimer and 3-5 hashtags
-- (placed at the very end of the description and also added to the tags).
alter table public.long_form_publish_meta add column if not exists disclaimer text;
alter table public.long_form_publish_meta add column if not exists hashtags jsonb not null default '[]'::jsonb;
