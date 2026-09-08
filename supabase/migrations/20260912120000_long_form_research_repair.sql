-- Targeted Research Repair. A repair ResearchVersion is a normal
-- long_form_research_versions row (same table, same claim/lease machinery,
-- same status/stage split) distinguished only by parent_research_version_id
-- being set — it is NOT a full re-research, it's a small, narrow follow-up
-- derived from an existing version, triggered automatically when the
-- Script Engine's Critic determines specific chapters lack the evidence
-- needed to write them honestly (see advance-long-form-script's
-- stageFinalizing).
--
-- repair_round tracks how many targeted repairs have been chained onto this
-- lineage: 0 = an original (or fully independent) research version, 1 = one
-- targeted repair has already been applied. V1 caps automatic repair at one
-- round (see MAX repair guidance in advance-long-form-script) — a Script
-- built from a repair_round >= 1 version that still can't be written
-- honestly stops at status:needs_attention instead of chaining another
-- repair, so this never becomes an unbounded research<->script loop.
alter table public.long_form_research_versions
  add column if not exists parent_research_version_id uuid references public.long_form_research_versions(id) on delete set null,
  add column if not exists repair_round integer not null default 0,
  -- What the Script Engine determined is missing, scoped to just the
  -- chapters that need it: [{ chapterId, title, purpose, keyQuestions,
  -- missingEvidenceDescription }]. Read only by the repair_planning stage —
  -- never touched for a normal (non-repair) research version.
  add column if not exists repair_context jsonb;

create index if not exists long_form_research_versions_parent_idx
  on public.long_form_research_versions (parent_research_version_id)
  where parent_research_version_id is not null;
