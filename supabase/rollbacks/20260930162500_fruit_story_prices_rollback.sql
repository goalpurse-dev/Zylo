-- Rollback of 20260930162500_fruit_story_prices: back to the 3b placeholders.
UPDATE public.tool_prices SET flat_credits = 3, notes = 'AI Fruit Story v2 scene picture / edit / regenerate: Nano Banana 2 Lite' WHERE tool_key = 'image:fruit-story';
UPDATE public.tool_prices SET credits_per_second = 5, notes = 'AI Fruit Story v2 V2 clip: Seedance 2.0 Mini, i2v, audio. PLACEHOLDER price, set before rollout' WHERE tool_key = 'video:fruit-story-v2';
UPDATE public.tool_prices SET credits_per_second = 8, notes = 'AI Fruit Story v2 V3 clip: Seedance 2.0 Fast, i2v, audio. PLACEHOLDER price, set before rollout' WHERE tool_key = 'video:fruit-story-v3';
UPDATE public.tool_prices SET credits_per_second = 10, notes = 'AI Fruit Story v2 V4 clip: Veo 3.1 Fast, i2v, audio. PLACEHOLDER price, set before rollout' WHERE tool_key = 'video:fruit-story-v4';
