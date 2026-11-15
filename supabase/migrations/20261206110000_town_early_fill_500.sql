-- Owner, 2026-11-15: only 345 fit groups 1 and 2; "Fill to 500". Group 3 = active in the last 30 days and already had
-- a marketing email (with no real open or visit since 4 Nov), most recently active first. Same rules as groups 1 and 2
-- (ON, not blocked, not "unengaged", nobody emailed in the last 24 hours, nobody twice). Groups 1 and 2 stay first.

create or replace function public.town_early_candidates(p_campaign text, p_starts timestamptz, p_ends timestamptz)
returns table (profile_id uuid, email text, grp int, last_seen timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with on_people as (
    select p.id, lower(btrim(p.email)) email from profiles p
     where p.email_updates is true and p.email like '%@%'
       and lower(btrim(p.email)) !~ '(\.test|\.invalid)$'
       and lower(btrim(p.email)) not in ('upwardlift6@gmail.com', 'zzyloai@gmail.com', 'rakettileague@gmail.com')
       and not exists (select 1 from email_suppressions s where s.email = lower(btrim(p.email)))
       and not exists (select 1 from email_sends e where e.email = lower(btrim(p.email)) and e.sent_at > p_ends - interval '24 hours')
       and not exists (select 1 from email_campaign_queue q
                        where (q.email = lower(btrim(p.email)) or q.profile_id = p.id) and q.campaign like 'town_early%'
                          and q.campaign <> p_campaign and q.status in ('sent', 'sending', 'queued'))
       and not ((select count(*) from email_sends e where e.email = lower(btrim(p.email)) and e.category = 'marketing') >= 2
                and not exists (select 1 from email_events v where lower(v.email) = lower(btrim(p.email)) and v.type = 'email.opened'))
  ), delivered as (
    select resend_id, min(created_at) t, min(lower(btrim(email))) email
      from email_events where type = 'email.delivered' and created_at >= timestamptz '2026-11-04 00:00+02' group by resend_id
  ), real_open as (
    select d.email, max(o.t) t
      from delivered d
      join (select resend_id, min(created_at) t from email_events where type = 'email.opened' group by resend_id) o
        on o.resend_id = d.resend_id and o.t > d.t + interval '60 seconds'
     group by d.email
  ), sent_q as (
    select profile_id, min(sent_at) sent_at from email_campaign_queue
     where status = 'sent' and sent_at >= timestamptz '2026-11-04 00:00+02' group by profile_id
  ), came_back as (
    select s.profile_id, max(x.t) t from sent_q s
      join lateral (
        select u.last_sign_in_at t from auth.users u where u.id = s.profile_id
        union all select greatest(a.created_at, a.updated_at, a.refreshed_at) from auth.sessions a where a.user_id = s.profile_id
        union all select f.created_at from funnel_events f where f.user_id = s.profile_id
        union all select c.created_at from creations c where c.user_id = s.profile_id
        union all select l.created_at from long_form_projects l where l.user_id = s.profile_id
        union all select g.created_at from generation_credit_ledger g where g.user_id = s.profile_id
        union all select g.created_at from fruit_credit_ledger g where g.user_id = s.profile_id
        union all select g.created_at from blocky_credit_ledger g where g.user_id = s.profile_id
        union all select b.created_at from blocky_stories b where b.user_id = s.profile_id
        union all select b.created_at from blocky_ai_calls b where b.user_id = s.profile_id
      ) x on x.t > s.sent_at
     group by s.profile_id
  ), seen as (
    select user_id, max(t) t from (
      select id user_id, last_sign_in_at t from auth.users where last_sign_in_at > p_starts - interval '30 days'
      union all select user_id, greatest(created_at, updated_at, refreshed_at) from auth.sessions where greatest(created_at, updated_at, refreshed_at) > p_starts - interval '30 days'
      union all select user_id, created_at from funnel_events where created_at > p_starts - interval '30 days'
      union all select user_id, created_at from creations where created_at > p_starts - interval '30 days'
      union all select user_id, created_at from long_form_projects where created_at > p_starts - interval '30 days'
      union all select user_id, created_at from generation_credit_ledger where created_at > p_starts - interval '30 days'
      union all select user_id, created_at from fruit_credit_ledger where created_at > p_starts - interval '30 days'
      union all select user_id, created_at from blocky_credit_ledger where created_at > p_starts - interval '30 days'
    ) x where user_id is not null group by user_id
  ), g as (
    select o.id, o.email, ro.t ro_t, cb.t cb_t, s.t seen_t,
           exists (select 1 from email_sends e where e.email = o.email and e.category = 'marketing') had_marketing
      from on_people o
      left join real_open ro on ro.email = o.email
      left join came_back cb on cb.profile_id = o.id
      left join seen s on s.user_id = o.id
  )
  select id, email,
         case when ro_t is not null or cb_t is not null then 1 when not had_marketing then 2 else 3 end,
         case when ro_t is not null or cb_t is not null then greatest(ro_t, cb_t) else seen_t end
    from g
   where ro_t is not null or cb_t is not null or seen_t is not null;
$function$;
revoke all on function public.town_early_candidates(text, timestamptz, timestamptz) from public, anon, authenticated;

-- Top up to 500: groups 1 and 2 are already queued; the fill adds group 3 after them, and the whole queue is
-- re-spread over 18:00–20:45 Finnish in order (group 1, 2, 3; most recent first inside each).
select public.fill_town_early('town_early1', 500);

with o as (
  select q.id, row_number() over (order by t.grp, t.last_seen desc, q.email) rn, count(*) over () total
    from email_campaign_queue q
    left join public.town_early_candidates('town_early1', timestamptz '2026-11-15 16:00+00', timestamptz '2026-11-15 19:00+00') t on t.profile_id = q.profile_id
   where q.campaign = 'town_early1' and q.status = 'queued'
)
update email_campaign_queue q
   set send_after = timestamptz '2026-11-15 16:00+00' + interval '165 minutes' * ((o.rn - 1)::numeric / greatest(o.total, 1))
  from o where q.id = o.id;
