-- Real incident found LIVE on the Mars project during the 2026-09-13
-- Generate/Edit routing-contract fix's own verification test: flipping the
-- Mars visual world back to 'generating' (via a single Regenerate call)
-- caused the self-heal "insert a pending row for any required view with no
-- asset row yet" logic in advance-long-form-visual-world's stageGenerating
-- to run concurrently across more than one invocation of the world (the
-- standing per-minute recovery cron, this function's own self-chained
-- dispatch, and the orphan-recovery branch can all legitimately fire close
-- together once a world is active) — each invocation independently SELECTed
-- the current asset rows, computed "character_reference_sheet is missing
-- for e_protagonist", and INSERTed its own pending row, all before any of
-- the others' INSERT was visible to it (classic check-then-insert race,
-- since the old code was two separate round trips: admin.from(...).select()
-- then admin.from(...).insert() with no lock in between). Confirmed live: 4
-- separate character_reference_sheet rows were created for the SAME
-- entity+role at the exact same microsecond, each independently dispatched
-- through the SAME renderer (image:flux.base — Klein 4B, correctly NOT
-- Qwen, which is itself further live confirmation the Part 1/3 routing fix
-- works end-to-end) and each incurring its own real Runware cost
-- ($0.0006 x 4 = $0.0024) — small in absolute terms, but a real duplication
-- bug regardless of how cheap this particular role happens to be, and the
-- exact class of bug Part 5's "provider success must be eventually
-- consistent, idempotently" was written to prevent.
--
-- Fix: move the missing-row insert into ONE atomic RPC that takes a row
-- lock on the world (`for update`) before re-checking and inserting each
-- candidate — this serializes any concurrent self-heal attempt for the SAME
-- world (a second concurrent call simply blocks on the row lock until the
-- first commits, then re-checks and finds the row already exists, inserting
-- nothing) without needing a schema-level uniqueness constraint, which is
-- awkward to express correctly here since "is this row currently active"
-- means "no OTHER row's replaces_asset_id points at me" — not "my own
-- replaces_asset_id is null" — a naive partial unique index on that column
-- would incorrectly reject legitimate historical rows.
create or replace function public.ensure_missing_reference_asset_rows(p_visual_world_version_id uuid, p_candidates jsonb)
returns setof public.long_form_reference_assets
language plpgsql security definer set search_path = '' as $$
declare v public.long_form_visual_world_versions; c jsonb;
begin
  select * into v from public.long_form_visual_world_versions where id = p_visual_world_version_id for update;
  if not found then return; end if;
  for c in select * from jsonb_array_elements(p_candidates) loop
    if not exists (
      select 1 from public.long_form_reference_assets a
      where a.visual_world_version_id = p_visual_world_version_id
        and a.entity_id = c->>'entity_id' and a.angle_or_view = c->>'angle_or_view'
        and not exists (select 1 from public.long_form_reference_assets newer where newer.replaces_asset_id = a.id)
    ) then
      return query
        insert into public.long_form_reference_assets (visual_world_version_id, entity_id, reference_type, angle_or_view, status, qa_expectations)
        values (p_visual_world_version_id, c->>'entity_id', c->>'reference_type', c->>'angle_or_view', 'pending', c->'qa_expectations')
        returning *;
    end if;
  end loop;
end $$;
