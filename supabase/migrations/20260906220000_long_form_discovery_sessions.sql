-- Long Form "Discover Ideas" per-creation safeguard: one row per discovery
-- session tracks free-generation batch count and the 3h cooldown gate.
-- Deliberately NOT a Video Project table yet — this is the smallest durable
-- state needed for the abuse safeguard (see generate-long-form-ideas and
-- generate-long-form-preview edge functions).

create table if not exists public.long_form_discovery_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  idea_batches_generated integer not null default 0,
  preview_images_generated integer not null default 0,
  last_batch_at timestamptz,
  next_generation_allowed_at timestamptz,
  selected_idea_id text
);

create index if not exists long_form_discovery_sessions_user_created_idx
  on public.long_form_discovery_sessions (user_id, created_at desc);

alter table public.long_form_discovery_sessions enable row level security;

-- Read-only for the owning user (lets the frontend hydrate session state
-- directly if ever useful). All writes go exclusively through service-role
-- edge functions (create-long-form-discovery-session, generate-long-form-ideas,
-- generate-long-form-preview), which independently verify ownership before
-- writing — no insert/update/delete policy is granted here on purpose, so
-- the quota/cooldown fields stay authoritative server-side.
create policy "Users can view their own discovery sessions"
  on public.long_form_discovery_sessions for select
  using (auth.uid() = user_id);
