-- Persists the client-stitched "full video" (all scene clips combined) so
-- reopening a generation shows the already-rendered result instead of the
-- editor re-stitching it from scratch every time.
alter table footballer_nationality_swap_generations
  add column if not exists full_video_url text;
