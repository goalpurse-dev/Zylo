-- Phase 6d-1 follow-up: scene image rows made by the Edit step's split
-- ("split": a split half's own picture, never current) and promoted proof
-- renders ("proof": a reviewed re-render made current by an admin script).
alter table public.long_form_scene_images drop constraint if exists long_form_scene_images_source_check;
alter table public.long_form_scene_images add constraint long_form_scene_images_source_check
  check (source in ('autopilot', 'regenerate', 'edit_description', 'seeded', 'split', 'proof'));
