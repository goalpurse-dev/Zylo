-- Keep the rendered Clay Rescue MP4 on its generation so reopening or
-- refreshing can reuse it instead of stitching the scene clips again.
alter table clay_rescue_generations
  add column if not exists final_video_url text;
