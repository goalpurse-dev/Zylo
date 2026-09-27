-- Phase 4a — image bake-off and upscale stages in the cost ledger.
alter table public.long_form_cost_ledger drop constraint if exists long_form_cost_ledger_stage_check;
alter table public.long_form_cost_ledger add constraint long_form_cost_ledger_stage_check
  check (stage in ('story_plan', 'research', 'script', 'bible', 'beats', 'narration', 'images', 'image_bakeoff', 'image_upscale', 'qa', 'render', 'other'));
