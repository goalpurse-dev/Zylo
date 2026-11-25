-- Rollback of 20261217120000_affiliate_handles.sql. Deploy the matching affiliate-api first (it calls the 7-argument join).
drop function if exists public.affiliate_free_code(text[]);
drop function if exists public.affiliate_join(uuid, text[], text, numeric, numeric, text, jsonb);
alter table public.affiliates drop column if exists handles;
-- then re-run the affiliate_join part of 20261217100000_affiliate_program.sql
notify pgrst, 'reload schema';
