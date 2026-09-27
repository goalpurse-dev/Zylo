import test from "node:test";
import assert from "node:assert/strict";
import {generationState,beatBadge,beatPatch,chapterGroups,continuityLabels,editWarnings,storyboardStats} from "../src/pages/workspace/long-form/storyboardModel.js";
import {fixtureStoryboard as row,fixtureScript as script} from "./fixtures/storyboardFixture.js";
import {establishFirstSetups} from "../supabase/functions/_shared/visualPlanDeterministic.js";
test("orphan first reuse becomes a setup without changing narration or grounding",()=>{const input=structuredClone(row.visual_plan);input.visualBeats[0].shotStrategy="REUSE_WITH_DELTA";const {plan,changes}=establishFirstSetups(input);assert.equal(changes.length,1);assert.equal(plan.visualBeats[0].shotStrategy,"NEW_SETUP");assert.equal(input.visualBeats[0].shotStrategy,"REUSE_WITH_DELTA");assert.deepEqual(plan.visualBeats[0].narrationSegmentIds,input.visualBeats[0].narrationSegmentIds);assert.deepEqual(plan.visualBeats[0].factualVisualConstraints,input.visualBeats[0].factualVisualConstraints);assert.equal(plan.visualBeats[3].shotStrategy,"REUSE_WITH_DELTA");assert.equal(establishFirstSetups(plan).changes.length,0);});
test("created is distinct from started, with real timestamp authoritative",()=>{
 assert.equal(generationState(null),"creating");
 assert.equal(generationState({id:"a",status:"planning",created_at:new Date().toISOString(),stage_attempt:0}),"starting");
 assert.equal(generationState({id:"a",status:"planning",stage_started_at:new Date().toISOString()}),"directing");
 assert.equal(generationState(row),"ready");
});
test("chapter groups preserve every narration-linked beat in order",()=>{const groups=chapterGroups(row,script);assert.equal(groups.length,2);assert.deepEqual(groups.flatMap(g=>g.beats),row.visual_plan.visualBeats);assert.equal(groups[0].title,"Waking the Sol");});
test("friendly labels and continuity hide raw keys",()=>{assert.equal(beatBadge(row.visual_plan.visualBeats[3]),"Reuse scene");assert.equal(beatBadge(row.visual_plan.visualBeats[2]),"Diagram");const labels=continuityLabels(row);assert.equal(labels.get("beat-0"),"Habitat interior · Setup A");assert.equal(labels.get("beat-3"),labels.get("beat-0"));});
test("counts derive from registry and actual beats",()=>{assert.deepEqual(storyboardStats(row),{beats:8,sequences:8,chapters:2,setups:2,reuse:2,diagrams:1,maps:1,counts:{CHARACTER:1,LOCATION:2,IMPORTANT_OBJECT:1,VEHICLE_MACHINE:1,DIAGRAM_SUBJECT:1}});});
test("edit request contains only permitted visual fields, no narration or grounding override",()=>{const beat=row.visual_plan.visualBeats[0];const patch=beatPatch(beat,{...beat,informationToCommunicate:"A revised morning scene",shotSize:"CLOSE",narrationSegmentIds:[],factualVisualConstraints:[],characterIds:["person"]});assert.deepEqual(Object.keys(patch),["beatId","informationToCommunicate","shotSize","visualType","locationId","characterIds"]);assert.equal(patch.shotSize,"CLOSE");assert.deepEqual(beat.narrationSegmentIds,["segment-0"]);assert.equal(beat.factualVisualConstraints.length,1);});
test("unsupported cameras and empty descriptions rejected",()=>{const beat=row.visual_plan.visualBeats[0];assert.throws(()=>beatPatch(beat,{...beat,shotSize:"POV"}));assert.throws(()=>beatPatch(beat,{...beat,informationToCommunicate:"  "}));});
test("hard restriction matches warn and factual grounding remains visible",()=>{const beat=row.visual_plan.visualBeats[0];const warnings=editWarnings(beat,{informationToCommunicate:"An open exterior window"});assert.equal(warnings.length,2);assert.match(warnings[0],/restricted/);assert.equal(beat.forbiddenElements[0],"open exterior window");});

