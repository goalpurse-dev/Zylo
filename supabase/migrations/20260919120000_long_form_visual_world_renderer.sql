-- Renderer/style abstraction (Part 1 of the "cheap test mode" pass) — the
-- Visual World version row already carries `render_tier` (v2/v3/v4) as a
-- coarse policy label; this adds the actual concrete fields the UI and
-- worker need: which exact Runware tool_key rendered this version, and
-- which style preset was locked in for it. Both are set once at creation
-- and never silently changed — regenerating with a different model/style
-- creates a NEW version (see start-long-form-visual-world), never mutates
-- an existing one, so a single VisualWorldVersion can never end up with
-- mixed-style references.
alter table public.long_form_visual_world_versions
  add column if not exists renderer_tool_key text not null default 'image:flux.base',
  add column if not exists style_key text not null default 'zyvo_illustrated_documentary';

-- Which planned views the user explicitly excluded before generation
-- (Part 10 — optional advanced overrides). Never required; an empty array
-- means "generate everything the Reference Planner + deterministic view
-- rules produced," which stays the default.
alter table public.long_form_visual_world_versions
  add column if not exists excluded_views jsonb not null default '[]'::jsonb;
