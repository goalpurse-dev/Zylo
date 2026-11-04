-- Cutaway Explainer, phase 0 of the any-topic plan (the owner's go of 2026-11-04): topic categories.
-- Each kind of custom topic (home appliances, cars, machines, planes/boats/trains, electronics, the body, animals, space,
-- ideas: _shared/cutaway/topics.js CATEGORIES) stays refused up front until it passes its proof, then the owner's switch
-- here opens it: {"appliances": "open"}. Anything else, a missing key or an unreadable row, is refused (fails closed).
-- cutaway-watchdog closes an open category again when over 30% of its last 10 finished custom videos fail.
ALTER TABLE public.cutaway_settings ADD COLUMN IF NOT EXISTS categories jsonb NOT NULL DEFAULT '{}'::jsonb;
