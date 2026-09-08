-- Lightweight internal "how much did this video cost Zyvo" helper — no new
-- billing system, no new per-call cost table. Every generation stage that
-- already tracks cost does so identically: meta.estimatedTotalCostUsd on
-- its own version row (see mergeMeta in each advance-long-form-* function).
-- This just sums what already exists. Stages with no telemetry yet (idea/
-- preview generation, Story Plan generation, and everything past Visual
-- Plan — reference assets, scenes, audio, rendering) report 0, honestly,
-- rather than a fabricated estimate.
--
-- INTERNAL ONLY — never call this from a user-facing surface or expose the
-- dollar figures in any UI; it's for our own cost visibility.
create or replace function public.long_form_project_cost_summary(p_project_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ideaUsd', 0::numeric,   -- generate-long-form-ideas / -preview have no cost telemetry yet
    'storyUsd', 0::numeric,  -- generate-long-form-story-plan has no cost telemetry yet
    'researchUsd', coalesce((
      select sum((meta->>'estimatedTotalCostUsd')::numeric)
      from public.long_form_research_versions
      where project_id = p_project_id and parent_research_version_id is null
    ), 0),
    'researchRepairUsd', coalesce((
      select sum((meta->>'estimatedTotalCostUsd')::numeric)
      from public.long_form_research_versions
      where project_id = p_project_id and parent_research_version_id is not null
    ), 0),
    'scriptUsd', coalesce((
      select sum((meta->>'estimatedTotalCostUsd')::numeric)
      from public.long_form_script_versions
      where project_id = p_project_id
    ), 0),
    'visualPlanningUsd', coalesce((
      select sum((meta->>'estimatedTotalCostUsd')::numeric)
      from public.long_form_visual_plan_versions
      where project_id = p_project_id
    ), 0),
    'referenceUsd', 0::numeric, -- Visual World / reference assets not built yet
    'sceneUsd', 0::numeric,     -- scene generation not built yet
    'audioUsd', 0::numeric,     -- TTS not built yet
    'renderUsd', 0::numeric,    -- rendering not built yet
    'totalUsd', coalesce((
      select sum((meta->>'estimatedTotalCostUsd')::numeric)
      from public.long_form_research_versions
      where project_id = p_project_id
    ), 0) + coalesce((
      select sum((meta->>'estimatedTotalCostUsd')::numeric)
      from public.long_form_script_versions
      where project_id = p_project_id
    ), 0) + coalesce((
      select sum((meta->>'estimatedTotalCostUsd')::numeric)
      from public.long_form_visual_plan_versions
      where project_id = p_project_id
    ), 0)
  );
$$;

revoke all on function public.long_form_project_cost_summary(uuid) from public;
grant execute on function public.long_form_project_cost_summary(uuid) to service_role;
