-- 2026-10-03 "fixes round 3" pass, Section 1/3.
--
-- Section 1: a project must never appear in "Your Long Form Videos" until
-- the user has actually clicked Generate AND the credit charge succeeded.
-- The new Production Setup flow (ProductionSetup.jsx) already creates its
-- project row via the existing create-long-form-project (idempotent by
-- discovery_session_id) — this just adds the one thing that was missing:
-- an explicit "not real yet" status, and a soft-delete column for Section 3's
-- project-card "Delete" action. No CHECK constraint exists on `status`
-- today (confirmed live: only 'story_ready' and now 'draft' are in use),
-- so 'draft' needs no schema change to become valid — this migration only
-- adds the delete column and the one new lookup RPC.

alter table public.long_form_projects add column if not exists deleted_at timestamptz;

-- Section 3: project-card thumbnails/labels for the new Stickman flow need
-- visual_recipe/niche, which live on long_form_generation_profiles — a table
-- with NO grant to `authenticated` at all (see that table's own migration
-- comment: every read goes through a SECURITY DEFINER path). This is the
-- bulk equivalent of get-long-form-project-profile for the lobby's list
-- query, scoped to the caller's own projects by construction (same pattern
-- as the existing my_long_form_project_resume_states RPC this file sits
-- beside in project.js).
create or replace function public.my_long_form_generation_profiles()
returns table (project_id uuid, visual_recipe text, recipe_version text, render_tier text, niche text)
language sql security definer set search_path = '' as $$
  select p.project_id, p.visual_recipe, p.recipe_version, p.render_tier, p.raw_setup_snapshot->>'niche' as niche
  from public.long_form_generation_profiles p
  join public.long_form_projects lp on lp.id = p.project_id
  where lp.user_id = auth.uid() and p.status = 'active';
$$;
revoke all on function public.my_long_form_generation_profiles() from public, anon;
grant execute on function public.my_long_form_generation_profiles() to authenticated;
