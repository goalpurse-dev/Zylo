-- Publish UX: the description is ONE field — built from its parts with toggles
-- (chapters / sources / Zyvo line), or the user's own edited text (kept until
-- "Reset to generated"). Thumbnails count their automatic free retry.
alter table public.long_form_publish_meta add column if not exists include_chapters boolean not null default true;
alter table public.long_form_publish_meta add column if not exists include_sources boolean not null default true;
alter table public.long_form_publish_meta add column if not exists description_override text;
alter table public.long_form_thumbnails add column if not exists attempts integer not null default 0;
