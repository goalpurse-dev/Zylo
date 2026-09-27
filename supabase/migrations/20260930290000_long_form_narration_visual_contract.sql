-- Narration → Visual Contract (2026-09-15 semantic-grounding pass).
--
-- A durable, versioned artifact sitting BETWEEN the ready Script and the
-- deterministic shot planner (visualShotPlanning.js): the LLM's job here is
-- ONLY to understand meaning (negation, comparison, cause/effect, sequence,
-- what must/must-not visibly appear) — never to decide timing, render
-- strategy, or production rules, which stay the deterministic planner's job
-- exactly as before. Never overwritten: keyed to the exact script_version_id
-- it was compiled from, so a script edit makes the contract stale (the same
-- "compiled_from is durable, changing the upstream input never mutates a
-- past artifact" philosophy every other Long Form stage already uses).
create table public.long_form_narration_contract_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.long_form_projects(id) on delete cascade,
  script_version_id uuid not null references public.long_form_script_versions(id) on delete cascade,
  version int not null default 1,

  status text not null default 'compiling' check (status in ('compiling', 'ready', 'failed')),
  compiler_version text not null,
  model text,
  text_density text, -- the on_screen_text_density value this batch of claims was compiled under (Part 7 — presentation frequency only, never factual meaning)

  claims jsonb not null default '[]',

  -- Mirrors long_form_script_versions.meta's own shape (modelCalls,
  -- inputTokens, outputTokens, estimatedModelCostUsd) — same cost-accounting
  -- convention as every other LLM-backed Long Form stage.
  stats jsonb not null default '{}',

  last_error_code text,
  last_error_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (project_id, script_version_id, version)
);
create index idx_narration_contract_project on public.long_form_narration_contract_versions(project_id);

alter table public.long_form_narration_contract_versions enable row level security;
revoke all on public.long_form_narration_contract_versions from anon;
revoke insert, update, delete, truncate, references, trigger on public.long_form_narration_contract_versions from anon, authenticated;
create policy "Users can view their own project's narration contracts" on public.long_form_narration_contract_versions
  for select using (exists (select 1 from public.long_form_projects p where p.id = long_form_narration_contract_versions.project_id and p.user_id = auth.uid()));

-- The durable pointer to whichever contract version is CURRENT for a
-- project — mirrors current_visual_plan_version_id/current_script_version_id
-- exactly. Null until the first contract is compiled; ANALYSIS-mode runs
-- (Part 14's explicit "test mode, do not mutate Mars's active VisualPlan")
-- may compile a contract WITHOUT ever setting this pointer, so a real
-- production project is never silently switched onto a test artifact.
alter table public.long_form_projects add column if not exists current_narration_contract_version_id uuid references public.long_form_narration_contract_versions(id);

-- Part 2: "stable IDs so downstream shots can point back to the semantic
-- claim(s) they are visualizing" — persisted on the render plan (not just
-- the transient VisualBeat JSON) so a scene's actual compiled prompt can
-- always be traced back to the exact claim it was grounded in, even after
-- the beat's own in-memory VisualPlan JSON is long gone from context.
alter table public.long_form_scene_render_plans add column if not exists narration_claim_id text;
