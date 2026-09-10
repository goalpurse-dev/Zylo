-- Run only after the reviewed migration. Rollback keeps jobs invisible to workers.
begin;
do $$
declare anchor_id uuid := 'a5fd4c3c-b1d7-4fea-80a6-898132bd54ae'; mid uuid; again uuid; a public.long_form_reference_assets; j public.jobs; prior_id uuid; accepted uuid;
begin
  if has_function_privilege('anon','public.enqueue_reference_profile_test(uuid,text)','execute')
  or has_function_privilege('authenticated','public.review_reference_profile_test(uuid,boolean,jsonb)','execute') then raise exception 'PUBLIC_TEST_ACCESS'; end if;
  accepted:=public.accepted_reference_identity('973ec40c-82d2-42d8-9090-c6cf469dd3f4','e_protagonist');
  if accepted is distinct from anchor_id then raise exception 'UNEXPECTED_ANCHOR'; end if;
  if public.reference_geometry_role('location_reference','profile') or not public.reference_geometry_role('character_reference','back') then raise exception 'ROLE_POLICY'; end if;
  -- Invalid source rejected before a job can be enqueued.
  begin
    perform public.enqueue_reference_profile_test('6437d0ea-9de8-4ba8-abd6-2334e1f24631',repeat('edit ',50));
    raise exception 'REJECTED_CROP_ACCEPTED';
  exception when others then
    if sqlerrm<>'ACCEPTED_IDENTITY_ANCHOR_REQUIRED' then raise; end if;
  end;
  update public.long_form_reference_assets set qa_expectations='{"reviewStatus":"pending"}' where id=anchor_id;
  if public.accepted_reference_identity('973ec40c-82d2-42d8-9090-c6cf469dd3f4','e_protagonist') is not null then raise exception 'PENDING_ANCHOR_ACCEPTED'; end if;
  update public.long_form_reference_assets set qa_expectations=null where id=anchor_id;
  mid:=public.enqueue_reference_profile_test(anchor_id,repeat('edit ',50));
  again:=public.enqueue_reference_profile_test(anchor_id,repeat('different ',30));
  if mid<>again then raise exception 'DUPLICATE_TEST'; end if;
  select * into a from public.long_form_reference_assets where id=mid;
  select * into j from public.jobs where id=mid;
  prior_id:=(a.qa_expectations->>'previousRoleAssetId')::uuid;
  if a.replaces_asset_id is not null or a.input_reference_asset_ids<>array[anchor_id]
  or j.tool_key<>'image:qwen.image-edit-plus' or j.max_attempts<>1 or j.charge_credits<>0 or (j.settings->>'credits')::integer<>0
  or j.input->'ref_images' is distinct from jsonb_build_array((select result_url from public.long_form_reference_assets where id=anchor_id)) then raise exception 'INVALID_JOB_CONTRACT'; end if;
  update public.long_form_reference_assets set status='succeeded',result_url='https://example.com/rollback-test.png' where id=mid;
  begin
    perform public.review_reference_profile_test(mid,true,'{"strictProfile":true}');
    raise exception 'PARTIAL_QA_ACCEPTED';
  exception when others then
    if sqlerrm<>'ALL_QA_SIGNALS_REQUIRED' then raise; end if;
  end;
  perform public.review_reference_profile_test(mid,true,'{"sameIdentity":true,"sameHair":true,"sameFacialHair":true,"sameOutfit":true,"strictProfile":true,"oneEye":true,"noseChinSilhouette":true,"differentComposition":true,"noGeneratedText":true,"neutralBackground":true}');
  if (select replaces_asset_id from public.long_form_reference_assets where id=mid) is distinct from prior_id
  or not exists(select 1 from public.long_form_reference_assets where id=prior_id and result_url is not null) then raise exception 'HISTORY_LOST'; end if;
end $$;
rollback;
