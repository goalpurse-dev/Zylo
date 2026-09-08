-- Long Form Project + Story Plan versioning. The commitment boundary: no
-- row here exists until the user clicks "Create Story Plan" — before that,
-- everything lives in long_form_discovery_sessions (browsing ideas is free
-- and disposable). FORMAT/SERIES/PROJECT stay distinct concepts: this table
-- is the PROJECT; series_id is reserved (nullable, no FK) for when Series
-- actually exists.
--
-- Idempotency: discovery_session_id is NOT NULL + UNIQUE. A discovery
-- session already exists for every /long-form/new visit regardless of mode
-- (Discover Ideas or Start with a Topic both create one on mount), so it
-- doubles as the stable identity that makes "Create Story Plan" safe to
-- double-click or retry after a refresh — one project per session, always.
create table public.long_form_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  discovery_session_id uuid not null unique references public.long_form_discovery_sessions(id) on delete restrict,

  format text not null default '2d_explainer',
  status text not null default 'draft', -- draft | planning | story_ready | planning_failed
  source text not null default 'custom', -- 'custom' | 'discovery'

  topic text not null,
  selected_idea_id text,
  selected_idea_title text,
  selected_idea_angle text,
  narrative_archetype_hint text, -- the discovered idea's own narrativeArchetype guess, if any — a hint, not a command (Topic Understanding may refine/override it)

  -- User intent (Auto vs Custom) — see long_form_discovery_sessions for the
  -- identical shape; copied onto the project at creation time since a
  -- session's settings may keep changing after the project already exists.
  length_mode text not null default 'auto',
  custom_length_minutes integer,
  depth_mode text not null default 'auto',
  custom_explanation_depth text,

  -- Resolved by Topic Understanding (custom always overrides these — see
  -- resolve step in generate-long-form-story-plan).
  resolved_length_minutes integer,
  resolved_explanation_depth text,
  target_words integer,

  -- Internal production intelligence — never sent to the client wholesale;
  -- persisted so Research/Script/Visual Director can reuse it later instead
  -- of re-deriving it.
  topic_model jsonb,
  narrative_strategy jsonb,

  current_story_plan_version_id uuid,
  selected_title text, -- user's title choice, layered on top of the versioned plan's recommendedTitle/alternativeTitles rather than mutating them

  -- Optimistic lock for generate-long-form-story-plan: claimed by setting
  -- this to now() from a null (or stale >90s) value before running the two
  -- AI passes, cleared on success/failure. Prevents a double-click or a
  -- remount racing a second full generation for the same project — plain
  -- status can't do this alone since "planning" doesn't change value across
  -- a claim.
  generation_started_at timestamptz,

  series_id uuid, -- reserved, no FK yet — Series doesn't exist

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index long_form_projects_user_id_idx on public.long_form_projects (user_id, created_at desc);

alter table public.long_form_projects enable row level security;

create policy "Users can view their own Long Form projects"
  on public.long_form_projects for select
  using (auth.uid() = user_id);

-- No insert/update/delete policy — every write goes through a service-role
-- edge function (create-long-form-project, generate-long-form-story-plan,
-- update-long-form-project), which independently verifies ownership.

create table public.long_form_story_plan_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.long_form_projects(id) on delete cascade,
  version integer not null,
  story_plan jsonb not null,
  generation_model text not null,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

create index long_form_story_plan_versions_project_id_idx on public.long_form_story_plan_versions (project_id, version desc);

alter table public.long_form_story_plan_versions enable row level security;

create policy "Users can view their own project's story plan versions"
  on public.long_form_story_plan_versions for select
  using (exists (
    select 1 from public.long_form_projects p
    where p.id = project_id and p.user_id = auth.uid()
  ));

alter table public.long_form_projects
  add constraint long_form_projects_current_story_plan_version_id_fkey
  foreign key (current_story_plan_version_id) references public.long_form_story_plan_versions(id) on delete set null;
