-- Research + Factuality Engine. A ResearchVersion is keyed to the EXACT
-- StoryPlanVersion it was built from (story_plan_version_id) — that pairing
-- is the idempotency identity: re-entering Research for the same Story Plan
-- version loads the existing row instead of researching again, and if the
-- user later regenerates the Story Plan, old research stays stored (never
-- deleted) but is no longer "current" for the new plan since its
-- story_plan_version_id no longer matches.
--
-- V1 architecture decision: normalized long_form_research_sources (sources
-- need dedup, a stable id, and will back a future citation UI) + a JSONB
-- fact_graph on the research version itself (Facts reference sources by the
-- normalized table's stable text id, but a Fact is a small structured
-- object with no query/dedup needs of its own — normalizing every Fact into
-- its own row buys nothing yet). This mirrors the long_form_story_plan_versions
-- pattern: one versioned JSONB payload per generation, plus whatever
-- sub-entity genuinely needs its own rows.
create table public.long_form_research_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.long_form_projects(id) on delete cascade,
  story_plan_version_id uuid not null references public.long_form_story_plan_versions(id) on delete cascade,
  version integer not null,

  status text not null default 'researching', -- researching | ready | needs_attention | failed

  research_plan jsonb,
  fact_graph jsonb, -- { facts: Fact[] }
  coverage jsonb, -- Pass C's coverage report (chapterCoverage, unanswered questions, disputes, overallCoverage)
  meta jsonb, -- { initialSearchCalls, gapSearchCalls, totalSources, totalFacts } — for the summary card + cost reporting, not user-facing raw

  time_sensitive boolean not null default false,

  research_model text,
  research_started_at timestamptz,
  research_completed_at timestamptz, -- also doubles as the "research_cutoff_at" reference point when time_sensitive is true

  generation_started_at timestamptz, -- optimistic-lock claim timestamp, same role as long_form_projects.generation_started_at

  created_at timestamptz not null default now(),

  unique (project_id, story_plan_version_id, version)
);

-- Enforces the idempotency/concurrency guarantee at the database level: only
-- one row can be actively "researching" for a given (project, story plan
-- version) pair at a time. A concurrent request hits this constraint (23505)
-- and is told to wait rather than racing a second full research job.
create unique index long_form_research_versions_one_active_idx
  on public.long_form_research_versions (project_id, story_plan_version_id)
  where status = 'researching';

create index long_form_research_versions_project_id_idx on public.long_form_research_versions (project_id, story_plan_version_id, version desc);

alter table public.long_form_research_versions enable row level security;

create policy "Users can view their own project's research versions"
  on public.long_form_research_versions for select
  using (exists (
    select 1 from public.long_form_projects p
    where p.id = project_id and p.user_id = auth.uid()
  ));

create table public.long_form_research_sources (
  id text primary key, -- app-generated short id (e.g. "src_ab12cd34") — this exact string is what Fact.sourceIds references, so a source's id never needs translating between the sources table and the fact_graph JSONB
  research_version_id uuid not null references public.long_form_research_versions(id) on delete cascade,

  url text not null,
  normalized_url text not null, -- lowercased host, stripped tracking params/fragment/trailing slash — the actual dedup key
  title text,
  publisher text,
  author text,
  published_at text, -- best-effort, often partial ("2021" / "2021-06") — kept as text rather than a real date
  accessed_at timestamptz not null default now(),

  source_type text, -- official_documentation | government | academic | standards_org | peer_reviewed | museum | reference_institution | professional_org | technical_documentation | journalism | specialist_publication | book_reference | community | other
  quality_tier text not null, -- A | B | C | LOWER

  relevance text,
  credibility_notes text,
  chapters_supported text[] not null default '{}',

  created_at timestamptz not null default now(),

  unique (research_version_id, normalized_url)
);

create index long_form_research_sources_version_id_idx on public.long_form_research_sources (research_version_id);

alter table public.long_form_research_sources enable row level security;

create policy "Users can view their own project's research sources"
  on public.long_form_research_sources for select
  using (exists (
    select 1 from public.long_form_research_versions v
    join public.long_form_projects p on p.id = v.project_id
    where v.id = research_version_id and p.user_id = auth.uid()
  ));

alter table public.long_form_projects
  add column current_research_version_id uuid references public.long_form_research_versions(id) on delete set null;
