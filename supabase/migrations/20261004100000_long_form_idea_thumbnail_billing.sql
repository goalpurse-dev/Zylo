-- Final-polish round 4, Section 4 — billing/caching state for the new
-- "idea thumbnails" feature on ProductionSetup.jsx (/long-form/create).
--
-- Replaces generate-long-form-ideas' old session-wide "2 free batches then a
-- 3h cooldown" gate (still present in idea_batches_generated/
-- next_generation_allowed_at, which stay as-is for observability) with a
-- per-draft model: the FIRST ideas+thumbnails generation is free, every one
-- after that costs real credits (2) via deduct_credits — a strictly
-- stronger abuse control than a time-based cooldown, and the one the
-- product spec calls for. The old cooldown fields are left untouched/still
-- written for telemetry, but no longer used to BLOCK a request — see
-- generate-long-form-ideas/index.ts.
--
-- None of these four columns are added to update-long-form-discovery-
-- session's ALLOWED_FIELDS — they are billing-relevant and must only ever
-- be set by the edge functions themselves (service-role), never by the
-- generic client-facing patch endpoint.
alter table public.long_form_discovery_sessions
  add column if not exists free_idea_batch_used boolean not null default false,
  add column if not exists last_idea_batch_id uuid null,
  add column if not exists last_idea_batch_style_id text null,
  add column if not exists last_idea_batch_thumbnails_claimed boolean not null default false;

comment on column public.long_form_discovery_sessions.free_idea_batch_used is
  'Whether this draft has already used its one free ideas+thumbnails generation. Set server-side only (generate-long-form-ideas).';
comment on column public.long_form_discovery_sessions.last_idea_batch_id is
  'id of the most recently generated idea batch (matches an ideaBatches[].batchId entry) — lets generate-long-form-idea-thumbnails verify a thumbnail request is piggybacking on a real, just-charged/free ideas batch rather than a spoofed client id.';
comment on column public.long_form_discovery_sessions.last_idea_batch_style_id is
  'Visual style id the most recent idea batch''s thumbnails were generated against — drives the "style changed, refresh thumbnails" notice.';
comment on column public.long_form_discovery_sessions.last_idea_batch_thumbnails_claimed is
  'Whether last_idea_batch_id''s free thumbnail credit has already been consumed, so the same batch id cannot be replayed for a second free thumbnail run.';
