-- Rollback of 20261001090000_long_form_tier_prices.sql. The Long Form
-- functions then fail closed (no price row = no quote) until redeployed with
-- the old typed-in prices.
DELETE FROM public.tool_prices WHERE tool_key IN ('longform:v2', 'longform:v3', 'longform:v4');
