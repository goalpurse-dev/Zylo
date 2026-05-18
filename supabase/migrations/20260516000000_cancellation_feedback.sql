-- Stores cancellation feedback when users cancel their subscription
create table if not exists cancellation_feedback (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        references auth.users(id) on delete set null,
  email         text,
  plan_code     text,
  reason        text        not null,
  feedback      text,
  created_at    timestamptz default now()
);

alter table cancellation_feedback enable row level security;

-- Only the user themselves and service role can read
create policy "Users can read own feedback"
  on cancellation_feedback for select
  using (auth.uid() = user_id);

create policy "Users can insert own feedback"
  on cancellation_feedback for insert
  with check (auth.uid() = user_id);

-- Index for admin queries by date
create index cancellation_feedback_created_at_idx on cancellation_feedback(created_at desc);
