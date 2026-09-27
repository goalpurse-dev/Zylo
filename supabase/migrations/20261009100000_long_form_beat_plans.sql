-- Phase 2a — Beat Director storage (Stickman). Versioned beat plans built
-- from one script version + one frozen Production Bible, plus their beats.
-- Service-role only (like long_form_production_bibles); no UI yet.

create table if not exists public.long_form_beat_plan_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.long_form_projects(id) on delete cascade,
  script_version_id uuid not null references public.long_form_script_versions(id),
  production_bible_id uuid not null references public.long_form_production_bibles(id),
  narration_audio_version_id uuid references public.long_form_narration_audio_versions(id),
  version integer not null,
  status text not null default 'building' check (status in ('building', 'ready', 'failed', 'superseded')),
  timing_source text check (timing_source in ('real', 'synthetic')),
  director_model text,
  stats jsonb not null default '{}'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  error_code text,
  error_detail jsonb,
  estimated_model_cost_usd numeric(10, 4) not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (project_id, version)
);

create index if not exists long_form_beat_plan_versions_project
  on public.long_form_beat_plan_versions(project_id, version desc);

create table if not exists public.long_form_beats (
  id uuid primary key default gen_random_uuid(),
  beat_plan_version_id uuid not null references public.long_form_beat_plan_versions(id) on delete cascade,
  sequence integer not null,
  start_word integer not null,
  end_word integer not null,
  narration_text text not null,
  start_ms integer not null,
  end_ms integer not null,
  -- visualConcept, userSummary, treatment, subjects, settingId/variant,
  -- propIds, composition, textIntent, motif, motionIntent, flags
  contract jsonb not null,
  created_at timestamptz not null default now(),
  unique (beat_plan_version_id, sequence),
  check (end_word >= start_word),
  check (end_ms > start_ms)
);

alter table public.long_form_beat_plan_versions enable row level security;
alter table public.long_form_beats enable row level security;
revoke all on public.long_form_beat_plan_versions from public, anon, authenticated;
revoke all on public.long_form_beats from public, anon, authenticated;
