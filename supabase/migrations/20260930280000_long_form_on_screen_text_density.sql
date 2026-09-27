-- On-Screen Text / Explainer Density (Part 2/3/4 of the 2026-09-15 content-
-- grounding + UX pass). A REAL planning input, not a cosmetic frontend
-- toggle: it is read by refineVisualSequences (visualShotPlanning.js) at
-- Storyboard/Visual-Plan compile time (advance-long-form-visual-plan's
-- stageFinalizing) to bias how eagerly narration inside an already
-- explainer-scoped macro (DIAGRAM/MAP/COMPARISON/PROGRAMMATIC_GRAPHIC/
-- TIMELINE — see visualFocus's own macroIsExplainer gate, which this never
-- widens) becomes a graphic sub-shot versus an illustrated one. Because that
-- pass runs once, during Storyboard compilation, this column is only
-- load-bearing BEFORE a project's storyboard exists — changing it on an
-- already-storyboarded project (e.g. Mars) has no retroactive effect,
-- exactly like scene_generation_tier's own "locked once compiled" behavior,
-- just locked one stage earlier.
alter table public.long_form_projects
  add column if not exists on_screen_text_density text not null default 'balanced'
  check (on_screen_text_density in ('minimal', 'balanced', 'frequent'));

comment on column public.long_form_projects.on_screen_text_density is
  'How eagerly the Storyboard leans on graphic/explainer sub-shots (big word/number cards, comparisons, timelines, maps) versus pure illustration, WITHIN macros the Visual Director already scoped as an explainer. Consumed once, at Storyboard compile time (refineVisualSequences) — changing it after a storyboard already exists has no effect on that storyboard. Existing projects default to balanced (current, unchanged behavior).';
