-- The +50 bonus offer (owner, 2026-10-26). The Stripe webhook decides whether a paid invoice
-- earns it (a plan bought or upgraded, paid inside the offer window: _shared/offer.js); this
-- makes sure each account gets it ONCE, whatever arrives twice or in what order.
--   offer_redemptions  one row per account and offer; the user can read their own (the success page)
--   grant_offer_bonus  claims the row and adds the credits through grant_credits_once (reason
--                      'offer_bonus'), in one transaction
create table if not exists public.offer_redemptions (
  user_id    uuid not null references auth.users(id) on delete cascade,
  offer_id   text not null,
  invoice_id text not null,
  credits    integer not null check (credits > 0),
  paid_at    timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, offer_id)
);
alter table public.offer_redemptions enable row level security;
drop policy if exists "offer_redemptions: read own" on public.offer_redemptions;
create policy "offer_redemptions: read own" on public.offer_redemptions for select to authenticated using (auth.uid() = user_id);

create or replace function public.grant_offer_bonus(p_user_id uuid, p_offer_id text, p_credits integer, p_invoice_id text, p_paid_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_claimed int;
begin
  if p_credits is null or p_credits <= 0 or coalesce(p_offer_id, '') = '' or coalesce(p_invoice_id, '') = '' then
    raise exception 'grant_offer_bonus: bad arguments';
  end if;
  insert into offer_redemptions (user_id, offer_id, invoice_id, credits, paid_at)
  values (p_user_id, p_offer_id, p_invoice_id, p_credits, p_paid_at)
  on conflict (user_id, offer_id) do nothing;
  get diagnostics v_claimed = row_count;
  if v_claimed = 0 then
    return false;   -- this account already has this offer's bonus
  end if;
  return grant_credits_once(p_user_id, p_credits, 'offer_bonus', p_offer_id || ':' || p_user_id::text);
end;
$$;
revoke all on function public.grant_offer_bonus(uuid, text, integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.grant_offer_bonus(uuid, text, integer, text, timestamptz) to service_role;

notify pgrst, 'reload schema';
