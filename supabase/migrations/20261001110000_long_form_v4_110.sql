-- Long Form V4: 90 → 110 credits per minute (margin: V4 fell under 35% once
-- VAT applies, see the pricing ship-check). The quote, the reservation, the
-- Setup tier cards and the pricing page all read this row.
-- Rollback: UPDATE public.tool_prices SET flat_credits = 90, updated_at = now() WHERE tool_key = 'longform:v4';
BEGIN;
SET LOCAL lock_timeout = '10s';
UPDATE public.tool_prices
   SET flat_credits = 110,
       notes = 'Long Form V4 — credits PER MINUTE of video (Nano Banana 2 Lite, best-of-2 + strict QA)',
       updated_at = now()
 WHERE tool_key = 'longform:v4';
COMMIT;
