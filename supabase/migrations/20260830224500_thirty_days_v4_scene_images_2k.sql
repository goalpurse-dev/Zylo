-- V4 keeps its premium Seedance 2.0 animation tier, but scene stills use the
-- same 2K Nano Banana 2 output as V3. The 4K stills were materially more
-- expensive without improving the final vertical video enough to justify it.
UPDATE public.thirty_days_quality_tiers
SET image_tool_key = 'image:thirtydays2k',
    image_width = 1536,
    image_height = 2752,
    image_cost_credits = 7
WHERE quality_tier = 'thirtydays-v4';
