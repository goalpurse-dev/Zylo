-- Long Form billing: charge for work done.
--
-- PROGRESSIVE holds (every reservation made from now on):
--   * as paid work finishes, part of the hold is committed:
--       committed = min(quote, 2 x real cost so far from the cost ledger)
--     (the cost of user-paid add-ons — scene redraws, extra thumbnails, the
--     1440p render — is left out: those are charged on their own);
--   * video finished -> the full quote is settled (settle_long_form_reservation_full, unchanged);
--   * deleted / idle 7 days -> only the uncommitted part comes back;
--   * failed because of us (a failed stage, autopilot, or render) -> EVERYTHING
--     comes back, committed credits included ("Fully refunded if the video can't be made").
-- FIXED holds (every reservation that already exists): unchanged — nothing is
-- committed before the video is finished, so a delete/idle/failure refunds it all.
--
-- 2 x real cost is turned into credits at the cheapest credit we sell
-- (Starter yearly: $16 / 750 credits = $0.02133 per credit), the same basis
-- as the Long Form price (docs/phase7/pricing-proposal.md).

alter table public.long_form_project_reservations
  add column if not exists billing_mode text not null default 'fixed'
    check (billing_mode in ('fixed', 'progressive'));
-- Existing rows got 'fixed' above; every new reservation is progressive.
alter table public.long_form_project_reservations alter column billing_mode set default 'progressive';
alter table public.long_form_project_reservations add column if not exists close_reason text;

-- 2 x the real cost of this project's included work so far, in credits (uncapped).
create or replace function public.long_form_work_credits(p_project_id uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce(ceil(2 * sum(l.usd) / 0.02133), 0)::integer
  from public.long_form_cost_ledger l
  where l.project_id = p_project_id
    and not (l.source_table = 'long_form_scene_images' and l.source_id in (
      select s.id from public.long_form_scene_images s where s.project_id = p_project_id and coalesce(s.addon_credits, 0) > 0))
    and not (l.source_table = 'long_form_thumbnails' and l.source_id in (
      select t.id from public.long_form_thumbnails t where t.project_id = p_project_id and coalesce(t.credits_charged, 0) > 0))
    and not (l.source_table = 'long_form_render_jobs' and l.source_id in (
      select r.id from public.long_form_render_jobs r where r.project_id = p_project_id and coalesce(r.addon_credits, 0) > 0))
$$;

-- The video can't be made because of us: a failed stage/autopilot, or the last
-- render failed and there is no finished video.
create or replace function public.long_form_failed_by_us(p_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select p.status like '%failed%'
        or coalesce(p.autopilot ->> 'status', '') = 'failed'
        or (p.final_video_path is null and (
              select r.status from public.long_form_render_jobs r where r.project_id = p.id order by r.created_at desc limit 1) = 'failed')
    from public.long_form_projects p where p.id = p_project_id), false)
$$;

-- What an ACTIVE hold looks like right now (pure read): how much covers work
-- already done (kept), and what a delete would give back.
create or replace function public.long_form_reservation_view(p_project_id uuid)
returns table (reservation_id uuid, billing_mode text, reserved integer, committed integer, kept integer, refund_if_deleted integer, failed_by_us boolean)
language plpgsql stable security definer set search_path = '' as $$
declare res public.long_form_project_reservations; k integer; f boolean;
begin
  select * into res from public.long_form_project_reservations where project_id = p_project_id and status = 'reserved';
  if not found then return; end if;
  f := public.long_form_failed_by_us(p_project_id);
  if f then k := 0;
  elsif res.billing_mode = 'progressive' then k := least(res.reserved_credits, greatest(res.committed_credits, public.long_form_work_credits(p_project_id)));
  else k := res.committed_credits;
  end if;
  return query select res.id, res.billing_mode, res.reserved_credits, res.committed_credits, k, res.reserved_credits - k, f;
end $$;

-- Commit the work done so far against a progressive hold (never above the quote,
-- never down). Returns the committed total, or null when there's nothing to do.
create or replace function public.commit_long_form_work_done(p_project_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare res public.long_form_project_reservations; target integer;
begin
  select * into res from public.long_form_project_reservations where project_id = p_project_id and status = 'reserved' for update;
  if not found or res.billing_mode <> 'progressive' then return null; end if;
  target := least(res.reserved_credits, greatest(res.committed_credits, public.long_form_work_credits(p_project_id)));
  if target > res.committed_credits then
    update public.long_form_project_reservations set committed_credits = target where id = res.id;
  end if;
  return target;
end $$;

-- Close an active hold without a finished video.
--   p_reason 'deleted' | 'idle'  -> keep the work done (progressive), refund the rest —
--                                   unless the project failed because of us (then all of it);
--   p_reason 'failed_by_us'      -> refund everything, committed credits included.
-- Idempotent: no active hold -> null.
create or replace function public.close_long_form_reservation(p_project_id uuid, p_reason text)
returns public.long_form_project_reservations
language plpgsql security definer set search_path = '' as $$
declare res public.long_form_project_reservations; keep integer; refund integer; full_refund boolean;
begin
  if p_reason not in ('deleted', 'idle', 'failed_by_us') then raise exception 'INVALID_CLOSE_REASON'; end if;
  select * into res from public.long_form_project_reservations where project_id = p_project_id and status = 'reserved' for update;
  if not found then return null; end if;
  full_refund := p_reason = 'failed_by_us' or public.long_form_failed_by_us(p_project_id);
  if full_refund then keep := 0;
  elsif res.billing_mode = 'progressive' then keep := least(res.reserved_credits, greatest(res.committed_credits, public.long_form_work_credits(p_project_id)));
  else keep := res.committed_credits; -- fixed holds: as before
  end if;
  refund := res.reserved_credits - keep;
  if refund > 0 then
    update public.profiles set credit_balance = credit_balance + refund, credits_spent_today = greatest(0, coalesce(credits_spent_today, 0) - refund) where id = res.user_id;
  end if;
  update public.long_form_project_reservations
     set committed_credits = keep, released_credits = refund, settled_at = now(),
         status = case when keep > 0 then 'settled' else 'released' end,
         close_reason = case when full_refund then 'failed_by_us' else p_reason end
   where id = res.id
  returning * into res;
  return res;
end $$;

-- For the signed-in user's own projects with an active hold: "Used so far: kept of reserved".
create or replace function public.long_form_project_billing()
returns table (project_id uuid, billing_mode text, reserved integer, kept integer, refund_if_deleted integer, failed_by_us boolean)
language sql stable security definer set search_path = '' as $$
  select r.project_id, v.billing_mode, v.reserved, v.kept, v.refund_if_deleted, v.failed_by_us
  from public.long_form_project_reservations r
  join public.long_form_projects p on p.id = r.project_id
  cross join lateral public.long_form_reservation_view(r.project_id) v
  where r.status = 'reserved' and p.user_id = auth.uid() and p.deleted_at is null
$$;

revoke all on function public.long_form_work_credits(uuid) from public, anon, authenticated;
revoke all on function public.long_form_failed_by_us(uuid) from public, anon, authenticated;
revoke all on function public.long_form_reservation_view(uuid) from public, anon, authenticated;
revoke all on function public.commit_long_form_work_done(uuid) from public, anon, authenticated;
revoke all on function public.close_long_form_reservation(uuid, text) from public, anon, authenticated;
grant execute on function public.long_form_work_credits(uuid) to service_role;
grant execute on function public.long_form_failed_by_us(uuid) to service_role;
grant execute on function public.long_form_reservation_view(uuid) to service_role;
grant execute on function public.commit_long_form_work_done(uuid) to service_role;
grant execute on function public.close_long_form_reservation(uuid, text) to service_role;
revoke all on function public.long_form_project_billing() from public, anon;
grant execute on function public.long_form_project_billing() to authenticated;

-- Hold RPCs are server-only: a signed-in user could release (refund) their own
-- hold mid-generation and still get the video. Nothing in the app calls them
-- with a user token (create-long-form-production-setup uses the service role).
revoke execute on function public.reserve_long_form_project_credits(uuid, uuid, uuid, integer, jsonb) from authenticated;
revoke execute on function public.settle_long_form_reservation(uuid, uuid) from authenticated;
revoke execute on function public.release_long_form_reservation(uuid, uuid) from authenticated;
