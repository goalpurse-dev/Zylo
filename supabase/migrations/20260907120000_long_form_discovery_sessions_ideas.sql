-- Part 1 of the Long Form persistence pass: a discovery session IS the one
-- canonical "Idea Discovery generation" (see PART 1 of the task) — it
-- already has the right 1:1 identity, so we extend it rather than adding a
-- parallel table. Preview images stay linked via each idea's own jobId
-- (inside the `ideas` JSONB) pointing at the existing `jobs` table — that
-- table is already the real source of truth for job status/result_url, so
-- no denormalized child asset table is needed (mirrors 30 Days' pattern of
-- a job_id FK, just without a separate join table since idea metadata is
-- naturally an array on one parent row, not independent rows needing their
-- own lifecycle).
alter table public.long_form_discovery_sessions
  add column if not exists topic text,
  add column if not exists source text not null default 'custom',
  add column if not exists idea_category text,
  add column if not exists idea_direction text,
  add column if not exists length_mode text not null default 'auto',
  add column if not exists custom_length_minutes integer,
  add column if not exists depth_mode text not null default 'auto',
  add column if not exists custom_explanation_depth text,
  add column if not exists ideas jsonb not null default '[]'::jsonb,
  add column if not exists selected_idea_id text;
