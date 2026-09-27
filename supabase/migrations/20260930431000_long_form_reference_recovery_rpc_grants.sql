-- Recovery/lease mutation is worker infrastructure. Browser roles observe
-- job state through RLS but must never claim, requeue, adopt, or settle a
-- provider job directly.
revoke all on function public.claim_generation_job(text,uuid,integer) from public,anon,authenticated;
revoke all on function public.adopt_expired_generation_job(uuid,text,integer) from public,anon,authenticated;
revoke all on function public.requeue_expired_unsubmitted_job(uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.fail_and_refund_generation_job(uuid,text,text,text) from public,anon,authenticated;

grant execute on function public.claim_generation_job(text,uuid,integer) to service_role;
grant execute on function public.adopt_expired_generation_job(uuid,text,integer) to service_role;
grant execute on function public.requeue_expired_unsubmitted_job(uuid,timestamptz) to service_role;
grant execute on function public.fail_and_refund_generation_job(uuid,text,text,text) to service_role;
