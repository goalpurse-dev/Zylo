-- Long Form Style Picker (Part 9 of the milestone): a durable, project-level
-- home for the user's selected StylePreset. Not React state — must survive
-- refresh, leaving/reopening the project, Storyboard regeneration, and a
-- ScriptVersion change (style is not Script-specific, see the milestone's
-- own Part 0/PART 1 boundary: Storyboard = WHAT the viewer sees, Style =
-- HOW the world looks).
--
-- Stored as one versioned string ("bold_cartoon_documentary:v1") rather
-- than a separate id + version pair — the whole point of versioning a style
-- preset (Part 19) is that the two travel together as a single immutable
-- unit; splitting them into two columns would let one change without the
-- other, which is exactly what versioning exists to prevent.
--
-- Defaults every existing AND future project to the new default preset
-- (Classic 2D Documentary / bold_cartoon_documentary) — matches what every
-- project already implicitly had (the old single hardcoded "Zyvo
-- Illustrated Documentary" style), so this is a pure additive backfill,
-- never a behavior change for a project that hasn't touched the picker yet.
alter table public.long_form_projects
  add column visual_style_preset text not null default 'bold_cartoon_documentary:v1';

comment on column public.long_form_projects.visual_style_preset is
  'Versioned StylePreset id (e.g. "bold_cartoon_documentary:v1") selected in the Look page''s Style Picker. See src/pages/workspace/long-form/stylePresets.js and supabase/functions/_shared/visualWorldStyle.ts for the registry.';

-- Part 18/19 future-safety: when a VisualWorldVersion is eventually created
-- for a project, the style preset it was built from must be pinned
-- immutably on that version row — never re-read live from the project (a
-- later style change on the project must not silently reinterpret an
-- already-generated Visual World's references). long_form_visual_world_versions
-- already has `style_spec jsonb` (added in 20260918120000) for the full
-- resolved spec snapshot; this adds the compact versioned id alongside it
-- so a version's provenance is readable at a glance without re-parsing the
-- full spec object. Nullable/unused until Visual World generation is wired
-- to read the project's actual selection instead of the single hardcoded
-- default — that wiring is explicitly out of scope for the Style Picker UI
-- milestone itself.
alter table public.long_form_visual_world_versions
  add column style_preset_id text;

comment on column public.long_form_visual_world_versions.style_preset_id is
  'Versioned StylePreset id this Visual World version was built from (e.g. "bold_cartoon_documentary:v1") — immutable once set, pinned at creation time, never re-read from the project''s current selection.';
