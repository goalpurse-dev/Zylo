-- Provider balance guard: before drawing images, Long Form checks the Runware
-- balance (cached ~60 s). Below threshold_usd, drawing PAUSES — queued scenes
-- wait (never fail), users see "Drawing is paused for a moment, your video
-- continues automatically", the admin is emailed once — and it resumes on its
-- own once the balance is back above the threshold. 1 Oct: 74 V3 scenes failed
-- with "Insufficient available balance" before this existed.
create table if not exists public.provider_balance_guard (
  provider text primary key,
  threshold_usd numeric(10, 2) not null default 20,   -- config: change with one UPDATE
  balance_usd numeric(12, 4),
  checked_at timestamptz,
  paused boolean not null default false,
  paused_since timestamptz,
  alerted_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);
insert into public.provider_balance_guard (provider, threshold_usd) values ('runware', 20)
  on conflict (provider) do nothing;
alter table public.provider_balance_guard enable row level security;
revoke all on public.provider_balance_guard from public, anon, authenticated;
