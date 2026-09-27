-- Run only after 20260914030000_reconcile_visual_world_completion_status.sql.
-- Uses the real Mars world (973ec40c-...), which was ITSELF found stuck at
-- 'needs_attention' during the 2026-09-14 audit purely because of 8
-- retired-taxonomy rows (old three_quarter_neutral/profile/face_closeup,
-- old identity_outfit_sheet/face_sheet/profile_silhouette_sheet) that no
-- longer appear anywhere in its current reference_plan.requiredViews.
-- Rollback restores whatever status this transaction found at the start —
-- if the real fix was already applied (status already 'ready'), this test
-- leaves it exactly as it found it either way.
begin;
do $$
declare
  world_id uuid := '973ec40c-82d2-42d8-9090-c6cf469dd3f4';
  original_status text; result text;
begin
  select status into original_status from public.long_form_visual_world_versions where id = world_id;

  -- Simulate the historical bug's exact symptom: force the world back to
  -- 'needs_attention' as if the old unscoped stageFinalizing had just run
  -- (this is exactly what WAS persisted live before the fix).
  update public.long_form_visual_world_versions set status = 'needs_attention' where id = world_id;

  -- The 8 historical/retired rows are still sitting in the table (real
  -- data, untouched by this test) — confirm the reconciliation function
  -- correctly ignores them and restores 'ready' anyway.
  result := public.reconcile_visual_world_completion_status(world_id);
  if result <> 'ready' then
    raise exception 'HISTORICAL_ROWS_STILL_BLOCKING — got %, expected ready. Historical/retired-taxonomy rows must never affect current-required readiness.', result;
  end if;
  if (select status from public.long_form_reference_assets where visual_world_version_id = world_id and angle_or_view = 'three_quarter_neutral' and status = 'succeeded' and qa_status = 'rejected' limit 1) is null then
    raise exception 'FIXTURE_ASSUMPTION_WRONG — expected at least one historical three_quarter_neutral row with qa_status=rejected to still exist as a real regression guard';
  end if;
  if (select status from public.long_form_visual_world_versions where id = world_id) <> 'ready' then
    raise exception 'STATUS_NOT_PERSISTED';
  end if;

  -- Idempotency: calling it again with nothing changed must be a safe no-op
  -- returning the same result.
  if public.reconcile_visual_world_completion_status(world_id) <> 'ready' then
    raise exception 'NOT_IDEMPOTENT';
  end if;

  -- Guard: must never touch a world still in the planning stage (no
  -- reference_plan committed yet would otherwise compute required_count=0
  -- -> 'ready' with nothing actually planned).
  if public.reconcile_visual_world_completion_status(gen_random_uuid()) is not null then
    raise exception 'UNKNOWN_WORLD_SHOULD_RETURN_NULL';
  end if;
end $$;
rollback;
