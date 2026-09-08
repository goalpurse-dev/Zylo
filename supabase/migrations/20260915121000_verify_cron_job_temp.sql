-- Temporary read-only helper to confirm the cron job registered correctly
-- right after enabling it — dropped in the very next migration.
create or replace function public.debug_list_long_form_cron_jobs()
returns table (jobname text, schedule text, active boolean)
language sql
security definer
set search_path = ''
as $$
  select jobname, schedule, active from cron.job where jobname = 'long-form-research-advance';
$$;

revoke all on function public.debug_list_long_form_cron_jobs() from public;
grant execute on function public.debug_list_long_form_cron_jobs() to service_role;
