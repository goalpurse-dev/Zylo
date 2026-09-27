-- Run after the migration inside BEGIN/ROLLBACK; no jobs become visible.
do $$
declare first_id uuid; second_id uuid; n integer;
begin
  first_id:=public.enqueue_character_turnaround('a5fd4c3c-b1d7-4fea-80a6-898132bd54ae',repeat('test ',100),'Observed character appearance for rolled-back test',false);
  second_id:=public.enqueue_character_turnaround('a5fd4c3c-b1d7-4fea-80a6-898132bd54ae',repeat('changed ',100),'Different input must not create a second paid request',false);
  assert first_id=second_id,'duplicate start created another master';
  select count(*) into n from public.jobs where id=first_id and max_attempts=1 and charge_credits=0 and input->>'width'='1536' and input->>'height'='1024' and not input ? 'ref_images';
  assert n=1,'provider dimensions/reference/cost cap mismatch';
  assert not has_function_privilege('authenticated','public.enqueue_character_turnaround(uuid,text,text,boolean)','execute'),'public paid trigger exposed';
  assert not has_function_privilege('anon','public.review_character_turnaround(uuid,boolean,jsonb)','execute'),'public promotion exposed';
  begin
    perform public.review_character_turnaround(first_id,true,'{}');
    raise exception 'should reject unready master';
  exception when others then
    if sqlerrm <> 'READY_MASTER_REQUIRED' then raise; end if;
  end;
end $$;
