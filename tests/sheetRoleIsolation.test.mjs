import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSheetAnchor, assertReferenceCompletion, compileIsolatedSheetEdit } from '../supabase/functions/_shared/characterSheetContract.js';
import { referenceJobPayload } from '../supabase/functions/_shared/visualWorldJobs.ts';
import { currentReferenceAssets, resolveDisplayStatus } from '../src/pages/workspace/long-form/visualWorldPlanning.js';
const base={visual_world_version_id:'w',entity_id:'hero',reference_type:'character_reference',generation_type:'provider'};
const anchor={...base,id:'identity',angle_or_view:'identity_outfit_sheet',status:'succeeded',qa_status:'approved',result_url:'https://example.com/identity.png'};
for(const role of ['face_sheet','profile_silhouette_sheet']) {
 test(`${role}: isolated compiler, one accepted anchor, landscape, fresh IDs`,()=>{
  const a={...base,id:role,job_id:role,angle_or_view:role,input_reference_asset_ids:['identity']};
  assertSheetAnchor(a,anchor);
  for(const bad of [{...anchor,angle_or_view:'three_quarter_neutral'},{...anchor,qa_status:'rejected'},{...anchor,entity_id:'other'},{...anchor,stale:true}]) assert.throws(()=>assertSheetAnchor(a,bad));
  const prompt=compileIsolatedSheetEdit(role);assert.match(prompt,new RegExp(`ROLE CONTRACT: ${role}`));assert.ok(prompt.length<1900);
  if(role==='face_sheet') assert.doesNotMatch(prompt,/standing figures|identical shoes|head to shoes/);
  const j=referenceJobPayload(a,{}, {user_id:'u'},prompt,'free',anchor.result_url);
  assert.deepEqual(j.input.ref_images,[anchor.result_url]);assert.equal(j.input.width,1536);assert.equal(j.max_attempts,1);
  assert.throws(()=>referenceJobPayload(a,{}, {},prompt,'free',[anchor.result_url,'https://example.com/face.png']));
  const other=referenceJobPayload({...a,id:'replacement'}, {}, {user_id:'u'},prompt,'free',anchor.result_url);assert.notEqual(j.id,other.id);assert.equal(other.result_url,undefined);assert.equal(other.settings.provider_job_id,undefined);
 });
 test(`${role}: reconciliation rejects other role, asset, prompt and provider task`,()=>{
  const a={...base,id:role,job_id:role,angle_or_view:role,input_reference_asset_ids:['identity'],prompt_snapshot:'prompt'};
  const j={id:role,status:'succeeded',prompt:'prompt',settings:{long_form_reference_asset_id:role,long_form_reference_role:role,provider_job_id:role},input:{ref_images:[anchor.result_url]},output:{data:[{taskUUID:role}]}};
  assertReferenceCompletion(a,j);
  assert.throws(()=>assertReferenceCompletion(a,{...j,id:'other'}));
  assert.throws(()=>assertReferenceCompletion(a,{...j,settings:{...j.settings,long_form_reference_role:role==='face_sheet'?'profile_silhouette_sheet':'face_sheet'}}));
  assert.throws(()=>assertReferenceCompletion(a,{...j,prompt:'other'}));
  assert.throws(()=>assertReferenceCompletion(a,{...j,output:{data:[{taskUUID:'other'}]}}));
 });
}
test('tile selection stays within exact role when another completes; stale rows never win',()=>{
 const face={...base,id:'face',angle_or_view:'face_sheet',status:'running',created_at:'2026-09-11'};
 const profile={...base,id:'profile',angle_or_view:'profile_silhouette_sheet',status:'running',created_at:'2026-09-11'};
 const legacy={...anchor,id:'legacy',angle_or_view:'profile'};
 const before=currentReferenceAssets([face,profile,anchor,legacy]);
 const after=currentReferenceAssets([face,{...profile,status:'succeeded',qa_status:'approved'},anchor,legacy]);
 assert.equal(before.find(a=>a.angle_or_view==='face_sheet').id,after.find(a=>a.angle_or_view==='face_sheet').id);
 assert.equal(after.find(a=>a.angle_or_view==='identity_outfit_sheet').id,'identity');
 assert.equal(currentReferenceAssets([face,{...face,id:'older',created_at:'2026-09-10'}]).length,1);
});
test('all lifecycle states remain truthful, including QA delayed for hours',()=>{
 const a={...base,angle_or_view:'face_sheet'};
 // 2026-09-19 broken-preview fix: a genuinely succeeded row always has a
 // result_url in production (QA/display can't happen without an image) —
 // these fixtures now reflect that so they exercise state-transition logic,
 // not the separate no-result_url "broken" case (covered elsewhere).
 const withUrl={result_url:'https://example.com/x.png'};
 const cases=[ [{status:'pending'},'queued'],[{status:'running'},'starting'],[{status:'running',job_id:'j',provider_status:'processing'},'generating'],[{status:'running',job_id:'j',provider_status:'queued'},'queued'],[{status:'running',job_id:'j',provider_status:'succeeded'},'checking'],[{status:'succeeded',qa_status:null,updated_at:'2020-01-01',...withUrl},'checking'],[{status:'succeeded',qa_status:'approved',...withUrl},'ready'],[{status:'succeeded',qa_status:'rejected',...withUrl},'needs_review'] ];
 for(const [fields,key] of cases) assert.equal(resolveDisplayStatus({...a,...fields},[anchor]).key,key);
});
test('a succeeded row with no result_url at all is truthfully "broken", never silently Ready or Checking',()=>{
 const a={...base,angle_or_view:'face_sheet'};
 assert.equal(resolveDisplayStatus({...a,status:'succeeded',qa_status:'approved'},[anchor]).key,'broken');
 assert.equal(resolveDisplayStatus({...a,status:'succeeded',qa_status:null},[anchor]).key,'broken');
});
