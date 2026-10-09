-- LAUNCH: Blocky Stories is switched on for everyone (owner's go, 2026-10-09: "Turn the global blocky_v1
-- flag ON, so Blocky is available to all users ... according to their plan"). One row in the platform's
-- switch table; nothing else changes. Visitors get the signed-out view, the free plan the upgrade view,
-- paid plans their tiers (the server checks each). Series stays off: there is no blocky_series_v1 row.
-- To switch Blocky off again for everyone but accounts with their own switch: the rollback file.
INSERT INTO public.global_feature_flags (key, enabled, note)
VALUES ('blocky_v1', true, 'Blocky Stories: on for everyone since 2026-10-09 (launch)')
ON CONFLICT (key) DO UPDATE SET enabled = true, note = EXCLUDED.note, updated_at = now();
