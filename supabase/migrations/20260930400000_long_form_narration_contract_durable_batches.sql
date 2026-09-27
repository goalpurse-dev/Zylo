-- 2026-09-20 real incident: a fresh "What if the Moon disappeared?" project's
-- narration-contract compilation (advance-long-form-visual-plan's
-- stagePlanning -> ensureNarrationContract) ran the ENTIRE multi-chapter
-- compiler as one uninterruptible call inside a single edge-function
-- invocation, with no checkpoint until the very end. Confirmed live: two
-- long_form_narration_contract_versions rows (38003bc1-..., c1453f2e-...)
-- for the SAME script version, both stuck status='compiling' with zero saved
-- claims — every retry started a brand-new contract from scratch and lost
-- all prior provider spend, because there was nowhere to persist partial
-- progress and no way to tell "already working on this" from "nothing
-- started yet".
--
-- Adds the same durable-batch-checkpoint columns advance-long-form-research
-- already uses for its own multi-batch extraction stage: `batches` holds the
-- per-chapter-batch queue and results so a worker that dies mid-compile only
-- ever loses the ONE in-flight batch; `stage_attempt`/`worker_lock_until`
-- give this row its own claim/lease so an expired lease can be safely
-- reclaimed (and a still-live one can't be double-worked) without ever
-- discarding batches already persisted.
alter table public.long_form_narration_contract_versions
  add column if not exists batches jsonb,
  add column if not exists stage_attempt integer not null default 0,
  add column if not exists worker_lock_until timestamptz;
