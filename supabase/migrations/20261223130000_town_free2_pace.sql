-- The pace fix (2026-11-23 16:35): a 3 s gap with a 3 s tick skipped every other tick (~12 a minute, too slow for 4,000 by 21:00). A 2 s gap: town_free2 one every 3 seconds, every other campaign one every 8 seconds (as before).
CREATE OR REPLACE FUNCTION public.claim_campaign_email(p_campaign text)
 RETURNS SETOF email_campaign_queue
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform pg_advisory_xact_lock(hashtextextended('campaign:' || p_campaign, 0));
  if not exists (select 1 from email_campaigns where id = p_campaign and status in ('approved', 'sending') and starts_at <= now() and ends_at > now()) then
    return;
  end if;
  -- At most one per 8 seconds per campaign (town_free2: one per tick of 3 seconds (2 s gap), owner 2026-11-23), however often this is called.
  if exists (select 1 from email_campaign_queue where campaign = p_campaign
               and claimed_at > now() - (case when p_campaign = 'town_free2' then interval '2 seconds' else interval '8 seconds' end)) then
    return;
  end if;
  return query
    update email_campaign_queue q set status = 'sending', claimed_at = now()
     where q.id = (select id from email_campaign_queue
                    where campaign = p_campaign and status = 'queued' and send_after <= now()
                    order by send_after, id limit 1 for update skip locked)
    returning q.*;
end;
$function$;
