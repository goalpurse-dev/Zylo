-- Cutaway Explainer launch: premade topics only (the owner, 2026-10-26). Custom topics show as "Coming soon" and a
-- customer's custom start is refused before anything is spent or charged, until the owner switches them on
-- (/admin/ops, the Cutaway card). The owner can always test custom topics.
ALTER TABLE public.cutaway_settings ADD COLUMN IF NOT EXISTS custom_enabled boolean NOT NULL DEFAULT false;
