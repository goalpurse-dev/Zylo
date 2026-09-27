import test from 'node:test';
import assert from 'node:assert/strict';
import { TURNAROUND, turnaroundCells, cropRgba, compileTurnaroundMaster, turnaroundQA, characterReferenceStrategy } from '../supabase/functions/_shared/characterTurnaround.js';
import { currentReferenceAssets } from '../src/pages/workspace/long-form/visualWorldPlanning.js';

test('hero rollout requires explicit approval; recurring and incidental remain inexpensive', () => {
  assert.equal(characterReferenceStrategy({importance:'HERO'},TURNAROUND.toolKey), 'REFERENCE_CONDITIONED');
  assert.equal(characterReferenceStrategy({importance:'HERO'},TURNAROUND.toolKey,{multiviewApproved:true}), 'MULTIVIEW_MASTER');
  assert.equal(characterReferenceStrategy({importance:'RECURRING'},TURNAROUND.toolKey,{multiviewApproved:true}), 'REFERENCE_CONDITIONED');
  assert.equal(characterReferenceStrategy({importance:'INCIDENTAL'},TURNAROUND.toolKey), null);
  assert.throws(()=>characterReferenceStrategy({importance:'HERO'},TURNAROUND.toolKey,{strategy:'MULTIVIEW_MASTER'}));
});
test('five default cells and optional sixth pose use exact non-overlapping 512 squares', () => {
  assert.equal(turnaroundCells().length,5); assert.equal(turnaroundCells(true).length,6);
  assert.deepEqual(turnaroundCells()[1], {key:'profile',rect:{x:512,y:0,width:512,height:512}});
  assert.deepEqual(turnaroundCells()[4].rect, {x:512,y:512,width:512,height:512});
  assert.equal(TURNAROUND.width%16,0); assert.equal(TURNAROUND.height%16,0);
});
test('crop copies pixels exactly and rejects wrong dimensions or bounds', () => {
  const source={width:1536,height:1024,data:new Uint8Array(1536*1024*4)};
  source.data.set([15,25,35,255],(512*1536+512)*4);
  const crop=cropRgba(source,turnaroundCells()[4].rect);
  assert.deepEqual([...crop.data.slice(0,4)],[15,25,35,255]);
  assert.equal(crop.data.length,512*512*4);
  assert.throws(()=>cropRgba({...source,width:1024},turnaroundCells()[0].rect));
  assert.throws(()=>cropRgba(source,{x:1500,y:0,width:512,height:512}));
});
test('dedicated master prompt contains different views and strict no-text/no-environment contract', () => {
  const p=compileTurnaroundMaster({styleSpec:{summary:'Classic 2D',linework:'bold',shading:'flat',palette:'muted'},canonicalSpec:'crew coveralls',appearanceLock:'Brown swept-back hair, short beard, olive jacket'});
  for(const s of ['90-DEGREE SIDE PROFILE','BACK VIEW','HEAD AND SHOULDERS','OUTFIT / EQUIPMENT','leave completely empty','NO MARS HABITAT','NO readable OR fake text']) assert.ok(p.includes(s));
  assert.equal(turnaroundQA('profile').profileExpected,true);
  assert.equal(turnaroundQA('back').rearExpected,true);
  assert.equal(turnaroundQA('face_closeup').faceCropExpected,true);
  assert.equal(turnaroundQA('profile').automatedVisionPerformed,false);
});
test('unreviewed/rejected crops and master cannot replace current role assets', () => {
  const old={id:'old',angle_or_view:'profile'};
  const master={id:'m',generation_type:'turnaround_master'};
  const crop={id:'c',generation_type:'deterministic_crop',replaces_asset_id:'old',qa_expectations:{reviewStatus:'pending'}};
  assert.deepEqual(currentReferenceAssets([old,master,crop]),[old]);
  assert.deepEqual(currentReferenceAssets([old,master,{...crop,qa_expectations:{reviewStatus:'rejected'}}]),[old]);
  const approved={...crop,qa_expectations:{reviewStatus:'approved'}};
  assert.deepEqual(currentReferenceAssets([old,master,approved]),[approved]);
});
