import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {refineVisualSequences,semanticRanges,visualDensity} from "../supabase/functions/_shared/visualShotPlanning.js";
import {WORDS_PER_MINUTE} from "../src/lib/longFormPipelineConstants.ts";
const snapshot=JSON.parse(fs.readFileSync(new URL("../artifacts/storyboard/mars-result.json",import.meta.url)));
const source=snapshot.row.visual_plan,script=snapshot.script;
const plan=refineVisualSequences(source,script);
// Phase 0, Section C.1 — narrationSeconds must be derived from the SAME
// shared WORDS_PER_MINUTE the real refineVisualSequences uses (145, not the
// old locally-hardcoded 150), or this test's own expectation drifts from
// the code under test the next time the shared rate changes.
test("coarse 14-item plan fails density; semantic shot layer follows the narration clock without quota",()=>{const narrationSeconds=Math.round(script.narrationSegments.reduce((sum,segment)=>sum+(segment.text.match(/\S+/g)?.length??0),0)/WORDS_PER_MINUTE*60*1000)/1000;assert.equal(visualDensity(source).passed,false);assert.equal(plan.visualSequences.length,14);assert.equal(plan.densityDiagnostics.passed,true);assert.ok(plan.visualBeats.length>90);assert.equal(plan.densityDiagnostics.totalDurationSeconds,narrationSeconds);assert.ok(plan.densityDiagnostics.maxBeatDuration<=15);});
test("macro sequence purposes, narration and factual reasoning are retained while timing follows child narration",()=>{assert.equal(source.visualBeats.length,14);for(const sequence of plan.visualSequences){const macro=source.visualBeats.find(b=>b.id===sequence.sourceMacroBeatId);const children=plan.visualBeats.filter(b=>b.sequenceId===sequence.id);assert.equal(sequence.purpose,macro.informationToCommunicate);assert.deepEqual(sequence.factualVisualConstraints,macro.factualVisualConstraints);assert.deepEqual(sequence.narrationSegmentIds,macro.narrationSegmentIds);assert.equal(sequence.estimatedStartSeconds,Math.min(...children.map(b=>b.estimatedStartSeconds)));assert.equal(sequence.estimatedEndSeconds,Math.max(...children.map(b=>b.estimatedEndSeconds)));}});
test("every shot has exact original text ranges, original grounding, and contiguous estimated timing",()=>{for(let i=0;i<plan.visualBeats.length;i++){const b=plan.visualBeats[i],macro=source.visualBeats.find(m=>m.id===b.sourceMacroBeatId);assert.deepEqual(b.factualVisualConstraints,macro.factualVisualConstraints);assert.deepEqual(b.forbiddenElements,macro.forbiddenElements);assert.deepEqual(b.revealConstraints,macro.revealConstraints);for(const r of b.narrationRanges){const s=script.narrationSegments.find(s=>s.id===r.segmentId);assert.ok(s);assert.ok(r.startChar>=0&&r.endChar<=s.text.length&&r.endChar>r.startChar);assert.ok(b.informationToCommunicate.includes(s.text.slice(r.startChar,r.endChar).replace(/[;—–]\s*$/,".")));}if(i)assert.ok(Math.abs(b.estimatedStartSeconds-plan.visualBeats[i-1].estimatedEndSeconds)<.01);assert.equal(b.requiresAudioReconciliation,true);}});
test("semantic boundaries react to location, object and explanation changes",()=>{const ranges=semanticRanges(script.narrationSegments[0]);assert.ok(ranges.some(r=>r.text.startsWith("Outside")));assert.ok(ranges.some(r=>r.text.startsWith("On the bedside")));assert.ok(ranges.some(r=>r.text.includes("24 hours")));assert.ok(new Set(plan.visualBeats.map(b=>Math.round((b.estimatedEndSeconds-b.estimatedStartSeconds)*10))).size>20);});
// The `productionAssets.length < beats.length/3` bound this test used to
// assert was measuring the OLD "cheap reuse" density this exact task fixed
// (only ~1 GENERATE per macro, everything else defaulted to REUSE/CROP) —
// the v3 freshness engine deliberately makes GENERATE (and therefore
// productionAssets, one entry per unique established base) a much larger
// share (composition/camera changes now correctly become new setups, not
// silent reuse). What must still hold: GENERATE never becomes the near-
// totality of the plan (CROP/GRAPHIC/REUSE still exist for the cases that
// genuinely call for them) and — unchanged — every derived shot's
// baseSetupKey was established by a real GENERATE before it's ever reused.
test("render reuse is distinct from shot count, with an established base before dependent shots",()=>{const established=new Set();for(const beat of plan.visualBeats){if(beat.renderMethod==="GENERATE")established.add(beat.baseSetupKey);else if(beat.baseSetupKey)assert.ok(established.has(beat.baseSetupKey));}assert.ok(plan.productionAssets.length<plan.visualBeats.length*0.75,"GENERATE must not become nearly the whole plan — CROP/GRAPHIC/REUSE still have real, non-trivial roles");assert.ok(plan.visualBeats.some(b=>b.renderMethod==="PROGRAMMATIC_GRAPHIC"));});
test("stable setup sketches retain environment across camera crops",()=>{const firstBySetup=new Map();for(const b of plan.visualBeats){const key=b.sketchContext.key;if(!firstBySetup.has(key))firstBySetup.set(key,b.sketchContext.environment);assert.equal(b.sketchContext.environment,firstBySetup.get(key));}});
test("expansion is deterministic and idempotent",()=>{assert.deepEqual(refineVisualSequences(source,script),plan);assert.deepEqual(refineVisualSequences(plan,script),plan);});
test("all original narration characters are covered by some shot range, excluding whitespace only",()=>{for(const segment of script.narrationSegments){const spans=plan.visualBeats.flatMap(b=>b.narrationRanges).filter(r=>r.segmentId===segment.id);for(let i=0;i<segment.text.length;i++)if(!/\s/.test(segment.text[i]))assert.ok(spans.some(r=>r.startChar<=i&&r.endChar>i),`${segment.id}:${i}`);}});
test("density distinguishes static hold from progressive diagram and rejects timing gaps",()=>{const make=(motion,type="DIAGRAM")=>({visualBeats:[{id:"a",visualType:type,shotSize:"WIDE",narrationSegmentIds:["s"],estimatedStartSeconds:0,estimatedEndSeconds:12,motionSuggestion:motion}]});assert.equal(visualDensity(make("reveal nodes in order")).passed,true);assert.equal(visualDensity(make(null)).passed,false);assert.equal(visualDensity({...make("motion"),visualBeats:[...make("motion").visualBeats,{...make("motion").visualBeats[0],id:"b",estimatedStartSeconds:14,estimatedEndSeconds:20}]}).passed,false);});

// 2026-09-21 real Atlantis incident: a macro beat sharing a long segment
// with a sibling macro can be assigned only a short trailing fragment of
// text (a handful of words) while distributeAcrossSegments still hands it
// real seconds proportional to the WHOLE segment's word count — splitDuration
// then asked for more shots than the fragment has words, and
// splitRangeForShots collapsed one shot's start/end word index to the same
// position: a genuine zero-width narrationRange and a zero-duration shot,
// which failed visualDensity's hard shot_duration floor and blocked
// finalization for the entire episode. Never Atlantis-specific — any short
// trailing fragment on a long, wordy segment can trigger this.
test("a macro beat assigned only a short trailing fragment of a long segment never produces a zero-width range or zero-duration shot",()=>{
  const longSentence=Array.from({length:14},(_,i)=>`word${i}`).join(" ")+".";
  const text=`${longSentence} The end.`;
  const script={narrationSegments:[{id:"seg1",chapterId:"ch1",text}]};
  const macroBase={sequenceIndex:1,chapterId:"ch1",narrationSegmentIds:["seg1"],estimatedStartSeconds:0,estimatedEndSeconds:30,informationToCommunicate:"Wrap up the point.",narrativeFunction:"",revealConstraints:[],visualType:"STORY_ILLUSTRATION",shotStrategy:"NEW_SETUP",renderMethod:"GENERATE",shotSize:"MEDIUM",continuityGroupId:null,primaryEntityIds:[],supportingEntityIds:[],locationId:null,baseSetupKey:"base",deltaInstruction:null,factualVisualConstraints:[],forbiddenElements:[]};
  const source={visualBeats:[{...macroBase,id:"mFront"},{...macroBase,id:"mTail",sequenceIndex:2,estimatedStartSeconds:30,estimatedEndSeconds:31,informationToCommunicate:"Deliver the final beat."}]};
  const plan=refineVisualSequences(source,script);
  const tailShots=plan.visualBeats.filter(b=>b.sourceMacroBeatId==="mTail");
  assert.ok(tailShots.length>0,"the trailing fragment must still produce at least one shot");
  for(const b of tailShots){
    assert.ok(b.estimatedEndSeconds>b.estimatedStartSeconds,`shot ${b.id} has zero/negative duration`);
    for(const r of b.narrationRanges)assert.ok(r.endChar>r.startChar,`shot ${b.id} has a zero-width narration range`);
  }
  assert.equal(visualDensity(plan).errors.filter(e=>e.code==="shot_duration").length,0);
});
