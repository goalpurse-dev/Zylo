-- Phase 7: a 1440p render is a paid add-on (V2/V3: 2 credits/min, min 10; free on V4),
-- charged when it starts; the job carries what was charged so a failed render is
-- refunded exactly once.
alter table public.long_form_render_jobs add column if not exists addon_credits integer not null default 0;
