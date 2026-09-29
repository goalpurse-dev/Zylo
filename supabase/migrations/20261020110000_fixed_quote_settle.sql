-- Phase 7 (a): the video is a FIXED quote. Generate reserves it; nothing is
-- committed per scene on the first pass; at render completion the whole
-- reservation is committed (the user pays exactly the quote, never more,
-- never less). A failed / cancelled / deleted project before completion is
-- released in full (release_long_form_reservation: nothing was committed).
create or replace function public.settle_long_form_reservation_full(p_reservation_id uuid, p_user_id uuid)
returns public.long_form_project_reservations
language plpgsql security definer set search_path = '' as $$
declare res public.long_form_project_reservations;
begin
  select * into res from public.long_form_project_reservations where id = p_reservation_id for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if res.user_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  if res.status <> 'reserved' then return res; end if; -- idempotent: settling twice never charges twice
  update public.long_form_project_reservations
     set committed_credits = reserved_credits, status = 'settled', released_credits = 0, settled_at = now()
   where id = p_reservation_id
  returning * into res;
  return res;
end $$;
revoke all on function public.settle_long_form_reservation_full(uuid, uuid) from public, anon, authenticated;
grant execute on function public.settle_long_form_reservation_full(uuid, uuid) to service_role;

-- Paid add-ons on a scene (regenerate / split) are charged at click time from the
-- balance; the row carries what was charged so the scene worker never touches the
-- video's reservation, and a failed add-on can be refunded exactly.
alter table public.long_form_scene_images add column if not exists addon_credits integer not null default 0;
