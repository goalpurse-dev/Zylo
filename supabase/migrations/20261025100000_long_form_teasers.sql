-- Long Form teasers: the free, honest preview a free (or newly signed-up) user
-- gets instead of a full video — a title, a one-line hook and 3 V2 scenes,
-- capped at $0.02 of provider cost each. One row per teaser: its inputs, its
-- result, its real cost, and the funnel timestamps
--   created_at (started) -> finished_at -> upgrade_clicked_at -> paid_at -> full_started_at.
-- Written only by the long-form-teaser edge function (service role). A user may
-- read their own rows; nobody else can read or write anything.
create table if not exists public.long_form_teasers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.long_form_projects(id) on delete set null, -- the full video, once it is started
  status text not null default 'writing' check (status in ('writing', 'drawing', 'done', 'failed')),
  niche text,
  topic text not null,
  setup jsonb not null default '{}'::jsonb,   -- the Create form as it was (length, voice, style, tier, ...)
  title text,
  hook text,
  scenes jsonb not null default '[]'::jsonb,  -- [{ n, description, status: queued|drawing|ready|failed|skipped, imageUrl }]
  cost_usd numeric(10, 6) not null default 0, -- real provider cost so far
  cap_usd numeric(10, 6) not null default 0.02,
  error text,
  ip_hash text,                               -- sha-256 of the caller's IP (rate limit only; the IP itself is never stored)
  upgrade_clicked_at timestamptz,
  paid_at timestamptz,
  full_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists long_form_teasers_user_time on public.long_form_teasers (user_id, created_at desc);
create index if not exists long_form_teasers_ip_time on public.long_form_teasers (ip_hash, created_at desc);

alter table public.long_form_teasers enable row level security;
revoke all on public.long_form_teasers from public, anon, authenticated;
grant select on public.long_form_teasers to authenticated;
drop policy if exists long_form_teasers_select_own on public.long_form_teasers;
create policy long_form_teasers_select_own on public.long_form_teasers for select to authenticated using (user_id = auth.uid());
