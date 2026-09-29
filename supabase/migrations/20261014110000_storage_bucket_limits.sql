-- Phase 5b finish — per-bucket upload limits.
--
-- The project-wide upload limit was raised to 500 MB for the final long-form
-- renders (~75 MB). A bucket with no file_size_limit inherits the global one,
-- so every other bucket gets its own explicit limit here and only
-- long-form-renders benefits from the raise.
--
-- Limits are set from real usage (max object size per bucket, 2026-09-27):
-- image-only buckets get a small limit far above their largest file; buckets
-- that hold video or mixed media keep exactly the old 50 MB global limit, so
-- nothing that works today can start failing.
update storage.buckets set file_size_limit = case id
  -- public, image-only
  when 'avatars'          then  5 * 1024 * 1024  -- largest today 0.16 MB
  when 'public-images'    then 10 * 1024 * 1024  -- largest today 3.0 MB
  when 'public-reference' then 10 * 1024 * 1024  -- largest today 0.04 MB
  -- public, video or mixed media: unchanged from the old global 50 MB
  when 'generated'        then 50 * 1024 * 1024  -- largest today 30.9 MB (video)
  when 'public-assets'    then 50 * 1024 * 1024  -- largest today 26.9 MB (video)
  when 'reference-images' then 50 * 1024 * 1024  -- largest today 48.8 MB (video)
  when 'video-refs'       then 50 * 1024 * 1024  -- reference videos
  when 'lipsync-outputs'  then 50 * 1024 * 1024  -- lipsync videos
  -- private: pinned so they don't inherit 500 MB either
  when 'user-assets'        then 50 * 1024 * 1024  -- largest today 26.9 MB
  when 'lipsync-inputs'     then 50 * 1024 * 1024
  when 'viral-score-videos' then 50 * 1024 * 1024  -- largest today 43.4 MB
  when 'script-cassettes'   then 50 * 1024 * 1024  -- internal test recordings
  when 'products'           then 10 * 1024 * 1024  -- images, largest today 0.13 MB
  -- the one bucket the raise is for
  when 'long-form-renders'  then 500 * 1024 * 1024
  else file_size_limit end
where id in ('avatars', 'public-images', 'public-reference', 'generated', 'public-assets', 'reference-images', 'video-refs', 'lipsync-outputs',
             'user-assets', 'lipsync-inputs', 'viral-score-videos', 'script-cassettes', 'products', 'long-form-renders');
