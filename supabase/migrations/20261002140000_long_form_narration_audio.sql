-- 2026-10-02 "real narration audio master timeline" pass — Section 6/7/8/10.
--
-- The durable, versioned narration-audio artifact. One row per real TTS
-- attempt, keyed by a deterministic request_hash (script content + every
-- voice setting) so an identical lineage NEVER re-calls the provider — the
-- exact idempotency property Section 14's validation test requires. Modeled
-- on the same versioned-artifact pattern as long_form_production_bibles
-- (own table, own version lineage, never mutated in place, never
-- overwritten — a failed/superseded attempt stays in history).
--
-- Durability (Section 10): a row is inserted with status='generating' and a
-- lease BEFORE the real ElevenLabs call starts; the actual call+persistence
-- runs via the edge function's own EdgeRuntime.waitUntil (survives the
-- client disconnecting, matching every other Long Form background-dispatch
-- pattern already in this codebase — e.g. charge-long-form-episode-
-- generation's own compile/dispatch loop). The client only ever POLLS this
-- row; it never has to keep re-invoking anything to make progress.
--
-- Section 10's "audio succeeds but alignment fails" case is a REAL,
-- distinct status (alignment_failed) with the audio_url and raw provider
-- alignment payload already persisted — reconciling alignment later never
-- needs a new provider call.

create table if not exists public.long_form_narration_audio_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.long_form_projects(id) on delete cascade,
  generation_profile_id uuid not null references public.long_form_generation_profiles(id),
  script_version_id uuid not null references public.long_form_script_versions(id),
  version integer not null,
  status text not null default 'generating' check (status in ('generating', 'ready', 'alignment_failed', 'failed')),

  voice_provider text not null,
  voice_id text not null,
  voice_model text not null,
  voice_settings jsonb not null default '{}'::jsonb,
  language text,

  audio_url text,
  audio_duration_seconds numeric,
  provider_metadata jsonb not null default '{}'::jsonb,
  internal_cost_usd numeric(10, 4) not null default 0,
  credits_charged integer not null default 0,

  -- The raw ElevenLabs character-alignment payload, preserved verbatim so
  -- alignment mapping can be retried without a new provider call (Section
  -- 10). `narration` is the DERIVED, per-segment mapped result
  -- (attachWordTimingsToSegments's own output) — the thing the Beat
  -- Director actually consumes.
  raw_provider_alignment jsonb,
  narration jsonb,

  -- Idempotency (Section 7/14): script_input_hash proves WHICH exact script
  -- content this row was synthesized from; request_hash additionally folds
  -- in every voice setting, so a voice change correctly produces a NEW row
  -- rather than being treated as identical.
  script_input_hash text not null,
  request_hash text not null,

  lease_until timestamptz,
  last_error_code text,
  last_error_at timestamptz,

  created_at timestamptz not null default now(),
  ready_at timestamptz
);

-- The real idempotency guarantee: within one project, the SAME request hash
-- can only ever have one row — a retried "Generate Narration" call with
-- identical lineage+voice finds it and returns it, never re-synthesizing.
create unique index if not exists long_form_narration_audio_versions_request_hash
  on public.long_form_narration_audio_versions(project_id, request_hash);
create index if not exists long_form_narration_audio_versions_project
  on public.long_form_narration_audio_versions(project_id, version desc);

alter table public.long_form_narration_audio_versions enable row level security;
revoke all on public.long_form_narration_audio_versions from public, anon;
create policy "Users can view their own project's narration audio" on public.long_form_narration_audio_versions
  for select using (exists (select 1 from public.long_form_projects p where p.id = long_form_narration_audio_versions.project_id and p.user_id = auth.uid()));

-- Section 5/6: the explicit, deliberate "Lock Story" action — distinct from
-- a script merely reaching status='ready' (the critic/revision pipeline's
-- own completion), which only means the CONTENT is finished, not that the
-- user has committed to it as the authoritative version for this
-- generation. Nullable/additive — every existing script row (and every
-- legacy project, which never calls the lock action at all) is simply
-- never locked, with zero behavior change.
alter table public.long_form_script_versions add column if not exists locked_at timestamptz;
alter table public.long_form_script_versions add column if not exists locked_generation_profile_id uuid references public.long_form_generation_profiles(id);

-- Additive: long_form_generation_profiles (from the prior "one project
-- commitment" pass) already carries voice_provider/voice_id/voice_model —
-- this adds the two fields it was missing for a real TTS call: ElevenLabs'
-- own stability/similarity/style/speed tuning, and the spoken language.
-- Null means "use the recipe's sensible defaults," never a required
-- Setup-time choice.
alter table public.long_form_generation_profiles add column if not exists voice_settings jsonb;
alter table public.long_form_generation_profiles add column if not exists language text;

-- Section 12's revision-allowance product surface — reserved metadata NOW,
-- consumed later. manual_tts_regenerations_used/included distinguish a
-- MANUAL user-triggered "Regenerate Voice" click (consumes the allowance)
-- from the automatic first generation Lock Story triggers (never counted).
-- Scene-regeneration counters are pure metadata this pass — "do not use
-- these yet because scenes do not exist" (Section 12) — reserved so the
-- future Beat Director/scene pipeline never needs a schema change to wire
-- them in.
alter table public.long_form_projects add column if not exists manual_tts_regenerations_used integer not null default 0;
alter table public.long_form_projects add column if not exists included_manual_tts_regenerations integer not null default 1;
alter table public.long_form_projects add column if not exists manual_scene_regenerations_used integer not null default 0;
alter table public.long_form_projects add column if not exists included_manual_scene_regenerations integer not null default 5;
