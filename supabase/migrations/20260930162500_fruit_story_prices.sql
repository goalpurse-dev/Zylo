-- AI Fruit Story v2: final prices after the stage 3e measurements
-- (docs/fruit-v2-phase3-results.md). Only the four Fruit v2 rows change;
-- durations, sizes and plans stay as they are.
--   picture / edit / regenerate  3 → 4 credits   (Nano Banana 2 Lite, $0.035)
--   V2 clip                      5 → 5 cr/s      (Wan2.6 Flash, $0.050/s)
--   V3 clip                      8 → 9 cr/s      (Seedance 2.0 Mini, $0.082/s)
--   V4 clip                     10 → 16 cr/s     (Veo 3.1 Fast, $0.15/s)

UPDATE public.tool_prices SET flat_credits = 4,
  notes = 'AI Fruit Story v2 scene picture / edit / regenerate: Nano Banana 2 Lite ($0.035 each)'
WHERE tool_key = 'image:fruit-story';

UPDATE public.tool_prices SET credits_per_second = 5,
  notes = 'AI Fruit Story v2 V2 clip: Wan2.6 Flash 720p, i2v, audio ($0.050/s); falls back once to Seedance 2.0 Mini'
WHERE tool_key = 'video:fruit-story-v2';

UPDATE public.tool_prices SET credits_per_second = 9,
  notes = 'AI Fruit Story v2 V3 clip: Seedance 2.0 Mini 720p, i2v, audio ($0.082/s)'
WHERE tool_key = 'video:fruit-story-v3';

UPDATE public.tool_prices SET credits_per_second = 16,
  notes = 'AI Fruit Story v2 V4 clip: Veo 3.1 Fast 720p, i2v, audio ($0.15/s)'
WHERE tool_key = 'video:fruit-story-v4';
