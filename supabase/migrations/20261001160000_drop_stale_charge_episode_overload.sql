-- Cleanup: an ancient 3-arg overload of charge_long_form_episode_generation
-- (uuid,uuid,text) from 20260930160000 was never dropped when the function
-- grew a p_preflight param (20260930390000) and later a p_chapter_gate param
-- (20261001150000). No current caller invokes the 3-arg form (confirmed:
-- charge-long-form-episode-generation/index.ts always passes all 5 named
-- args), so this is dead, unreachable-by-design cruft — dropped so there is
-- exactly one authoritative signature for this RPC, matching the "one
-- authoritative backend readiness/billing result" requirement.
drop function if exists public.charge_long_form_episode_generation(uuid,uuid,text);
