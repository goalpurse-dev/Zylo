-- 2026-10-02 "narration-first / audio-first architecture" pass — Section A/J.
--
-- The durable snapshot answering "which exact production configuration
-- produced this artifact?" One row per project's active production
-- commitment: created once at the end of the new Setup stage, then read-only
-- for the lifetime of that generation lineage. Every downstream stage
-- (Production Bible, Beat Director, compiler, scenes) traces back to a
-- specific row here rather than reading mutable long_form_projects columns
-- (visual_style_preset, scene_generation_tier) that could otherwise drift
-- mid-generation if a user edits Setup again.
--
-- PENDING: written and reviewed, NOT yet applied to the production database.
-- Purely additive (new table, nullable FK columns on existing tables) —
-- zero behavioral change to any existing code path, since nothing reads
-- these columns yet.

create table if not exists public.long_form_generation_profiles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.long_form_projects(id) on delete cascade,
  version integer not null default 1,
  -- Exactly one ACTIVE profile per project at a time — the same partial-
  -- unique-index pattern long_form_episode_generation_charges already uses
  -- for "at most one active X per project." A user-initiated settings change
  -- after generation has begun creates a NEW row (superseding the old one),
  -- never an in-place mutation — see the header comment on why.
  status text not null default 'active' check (status in ('active', 'superseded')),

  -- Creative/production decisions, snapshotted verbatim from Setup.
  visual_recipe text not null,                    -- e.g. 'legacy_visual_world' | 'stickman_doodle_explainer'
  recipe_version text not null,                    -- e.g. 'STICKMAN_DOODLE_EXPLAINER_V1'
  visual_style_preset text,                        -- null when the recipe has no free-choice style (e.g. Stickman's style is fixed by recipe_version itself)
  render_tier text not null check (render_tier in ('v2', 'v3', 'v4')),
  renderer_policy_version text not null default 'v1',

  target_duration_minutes numeric not null check (target_duration_minutes > 0),
  research_depth text,
  explanation_depth text,

  voice_provider text,                             -- e.g. 'elevenlabs'
  voice_id text,
  voice_model text,                                -- e.g. 'eleven_flash_v2_5'
  pacing_profile text,

  generation_mode text not null default 'full_episode' check (generation_mode in ('full_episode', 'chapter_at_a_time')),

  -- Every compiler/module version that could change a downstream artifact's
  -- shape without changing this row's other fields (e.g. a prompt-compiler
  -- bugfix) — keeps "which exact configuration produced me" answerable even
  -- across code deploys, not just user-visible settings.
  compiler_versions jsonb not null default '{}'::jsonb,
  -- Free-form capture of anything collected at Setup that hasn't earned its
  -- own column yet — never the authoritative source for a field that DOES
  -- have a real column above.
  raw_setup_snapshot jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  locked_at timestamptz,
  superseded_at timestamptz,
  superseded_by_profile_id uuid references public.long_form_generation_profiles(id)
);

create unique index if not exists long_form_generation_profiles_one_active_per_project
  on public.long_form_generation_profiles(project_id) where status = 'active';
create index if not exists long_form_generation_profiles_project
  on public.long_form_generation_profiles(project_id, version desc);

alter table public.long_form_generation_profiles enable row level security;
revoke all on public.long_form_generation_profiles from public, anon, authenticated;

-- Lineage FKs — nullable and additive, so every existing row (predating this
-- migration) simply has generation_profile_id = null and every existing
-- query/RPC keeps working byte-for-byte unchanged. Populated going forward
-- by whichever stage creates each row, once Phase 0/1 wiring exists.
alter table public.long_form_script_versions add column if not exists generation_profile_id uuid references public.long_form_generation_profiles(id);
alter table public.long_form_visual_plan_versions add column if not exists generation_profile_id uuid references public.long_form_generation_profiles(id);
alter table public.long_form_visual_world_versions add column if not exists generation_profile_id uuid references public.long_form_generation_profiles(id);
alter table public.long_form_scene_render_plans add column if not exists generation_profile_id uuid references public.long_form_generation_profiles(id);

-- Server-authoritative snapshot creation. Never called from the client with
-- raw field values for anything that already has a real, validated source
-- (e.g. render_tier must be one of the checked values; the CHECK constraints
-- above are the actual enforcement, this function is just the one write
-- path). Superseding an existing active profile is explicit and auditable,
-- never a silent overwrite — mirrors charge_long_form_episode_generation's
-- own "supersede the stale row" pattern.
create or replace function public.create_long_form_generation_profile(
  p_project_id uuid, p_user_id uuid, p_settings jsonb
) returns public.long_form_generation_profiles
language plpgsql security definer set search_path = '' as $$
declare
  proj public.long_form_projects;
  existing public.long_form_generation_profiles;
  next_version integer;
  new_row public.long_form_generation_profiles;
begin
  select * into proj from public.long_form_projects where id = p_project_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if proj.user_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  if not (p_settings ? 'visualRecipe') or not (p_settings ? 'recipeVersion') or not (p_settings ? 'renderTier') or not (p_settings ? 'targetDurationMinutes') then
    raise exception 'INCOMPLETE_SETUP: visualRecipe, recipeVersion, renderTier and targetDurationMinutes are all required';
  end if;
  if (p_settings->>'renderTier') not in ('v2', 'v3', 'v4') then raise exception 'INVALID_TIER'; end if;

  select * into existing from public.long_form_generation_profiles where project_id = p_project_id and status = 'active' for update;
  next_version := coalesce(existing.version, 0) + 1;

  insert into public.long_form_generation_profiles (
    project_id, version, visual_recipe, recipe_version, visual_style_preset, render_tier, renderer_policy_version,
    target_duration_minutes, research_depth, explanation_depth, voice_provider, voice_id, voice_model,
    pacing_profile, generation_mode, compiler_versions, raw_setup_snapshot
  ) values (
    p_project_id, next_version, p_settings->>'visualRecipe', p_settings->>'recipeVersion', p_settings->>'visualStylePreset',
    p_settings->>'renderTier', coalesce(p_settings->>'rendererPolicyVersion', 'v1'),
    (p_settings->>'targetDurationMinutes')::numeric, p_settings->>'researchDepth', p_settings->>'explanationDepth',
    p_settings->>'voiceProvider', p_settings->>'voiceId', p_settings->>'voiceModel',
    p_settings->>'pacingProfile', coalesce(p_settings->>'generationMode', 'full_episode'),
    coalesce(p_settings->'compilerVersions', '{}'::jsonb), p_settings
  ) returning * into new_row;

  if existing.id is not null then
    update public.long_form_generation_profiles set status = 'superseded', superseded_at = now(), superseded_by_profile_id = new_row.id where id = existing.id;
  end if;

  return new_row;
end $$;
revoke all on function public.create_long_form_generation_profile(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_long_form_generation_profile(uuid, uuid, jsonb) to authenticated, service_role;
