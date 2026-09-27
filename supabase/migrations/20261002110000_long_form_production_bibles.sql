-- 2026-10-02 "Production Bible" pass — the ONE new per-project versioned
-- artifact this pass needs (Section 7). Modeled directly on the existing
-- long_form_visual_world_versions / long_form_narration_contract_versions
-- versioned-artifact pattern: one immutable row per frozen version, never
-- mutated in place, superseded (never overwritten) when the user changes a
-- locked setting that invalidates it.
--
-- Deliberately NOT embedded inside long_form_visual_plan_versions.visual_plan
-- — a Bible freeze happens on a different cadence than a Visual Plan replan
-- (Section 7: "if the user changes a locked setting that invalidates the
-- Bible, create a new lineage/version... never mutate historical Bible data
-- in place"), so it needs its own independent version lineage.

create table if not exists public.long_form_production_bibles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.long_form_projects(id) on delete cascade,
  generation_profile_id uuid not null references public.long_form_generation_profiles(id),
  script_version_id uuid not null references public.long_form_script_versions(id),
  recipe_id text not null,
  recipe_version text not null,
  bible_version integer not null,
  status text not null default 'draft' check (status in ('draft', 'frozen', 'superseded')),
  bible jsonb not null,
  -- Real, auditable authoring cost/provenance — never guessed after the
  -- fact. Mirrors the same fields long_form_narration_contract_versions'
  -- own compile stats already carry.
  llm_calls integer not null default 0,
  repair_calls integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_model_cost_usd numeric(10, 4) not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  frozen_at timestamptz,
  superseded_at timestamptz,
  superseded_by_bible_id uuid references public.long_form_production_bibles(id)
);

-- At most one FROZEN bible active per project at a time — a new version
-- always supersedes the prior frozen one explicitly (see the application
-- code's own create-then-supersede pattern), never edits it in place.
create unique index if not exists long_form_production_bibles_one_frozen_per_project
  on public.long_form_production_bibles(project_id) where status = 'frozen';
create index if not exists long_form_production_bibles_project
  on public.long_form_production_bibles(project_id, bible_version desc);

alter table public.long_form_production_bibles enable row level security;
revoke all on public.long_form_production_bibles from public, anon, authenticated;

-- Lineage traceability (Section 7: "downstream BeatContracts and prompts
-- must record which Bible version produced them") — additive, nullable, so
-- every existing row (predating this migration) is simply untouched.
alter table public.long_form_visual_plan_versions add column if not exists production_bible_id uuid references public.long_form_production_bibles(id);
alter table public.long_form_scene_render_plans add column if not exists production_bible_id uuid references public.long_form_production_bibles(id);

-- Server-authoritative freeze: writes the row and immediately marks it
-- frozen (a Bible is validated fully, in application code, BEFORE this is
-- ever called — see compileStickmanProductionBible's ok:true branch), then
-- supersedes whichever bible was previously frozen for this project. Never
-- called with an already-invalid bible payload; this function trusts the
-- caller's validation exactly the way charge_long_form_episode_generation
-- trusts its own caller's preflight, since re-validating a large jsonb blob
-- in PL/pgSQL would just duplicate the real (already-tested) TypeScript
-- validation logic.
create or replace function public.freeze_long_form_production_bible(
  p_project_id uuid, p_user_id uuid, p_generation_profile_id uuid, p_script_version_id uuid,
  p_recipe_id text, p_recipe_version text, p_bible jsonb,
  p_llm_calls integer, p_repair_calls integer, p_input_tokens integer, p_output_tokens integer,
  p_estimated_model_cost_usd numeric, p_warnings jsonb
) returns public.long_form_production_bibles
language plpgsql security definer set search_path = '' as $$
declare
  proj public.long_form_projects;
  existing public.long_form_production_bibles;
  next_version integer;
  new_row public.long_form_production_bibles;
begin
  select * into proj from public.long_form_projects where id = p_project_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if proj.user_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;

  select * into existing from public.long_form_production_bibles where project_id = p_project_id and status = 'frozen' for update;
  next_version := coalesce(existing.bible_version, 0) + 1;

  insert into public.long_form_production_bibles (
    project_id, generation_profile_id, script_version_id, recipe_id, recipe_version, bible_version, status, bible,
    llm_calls, repair_calls, input_tokens, output_tokens, estimated_model_cost_usd, warnings, frozen_at
  ) values (
    p_project_id, p_generation_profile_id, p_script_version_id, p_recipe_id, p_recipe_version, next_version, 'frozen', p_bible,
    p_llm_calls, p_repair_calls, p_input_tokens, p_output_tokens, p_estimated_model_cost_usd, coalesce(p_warnings, '[]'::jsonb), now()
  ) returning * into new_row;

  if existing.id is not null then
    update public.long_form_production_bibles set status = 'superseded', superseded_at = now(), superseded_by_bible_id = new_row.id where id = existing.id;
  end if;

  return new_row;
end $$;
revoke all on function public.freeze_long_form_production_bible(uuid, uuid, uuid, uuid, text, text, jsonb, integer, integer, integer, integer, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.freeze_long_form_production_bible(uuid, uuid, uuid, uuid, text, text, jsonb, integer, integer, integer, integer, numeric, jsonb) to authenticated, service_role;
