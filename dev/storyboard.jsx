import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import StoryboardWorkspace from "../src/pages/workspace/long-form/StoryboardWorkspace";
import { VisualPlanProgress } from "../src/pages/workspace/long-form/look";
import { LongFormCreationHeader } from "../src/pages/workspace/long-form/shared";
import mars from "../artifacts/storyboard/mars-result.json";
import { refineVisualSequences } from "../supabase/functions/_shared/visualShotPlanning";
const fixtureStoryboard = { ...mars.row, visual_plan: refineVisualSequences(mars.row.visual_plan, mars.script) };
const fixtureScript = mars.script;
import "../src/index.css";
export default function Review() {
  const [state,setState] = useState("Ready");
  const [row,setRow] = useState(() => JSON.parse(localStorage.getItem("look-review-shot-draft") || "null") ?? fixtureStoryboard);
  const active = state === "Creating" ? null : { id:"fixture",status:"planning",stage:"planning",...(state === "Directing" ? {workflow_started_at:new Date(Date.now()-65000).toISOString(),stage_started_at:new Date(Date.now()-65000).toISOString()} : {}) };
  return <div className="flex flex-col" style={{height:"100dvh"}}><div className="flex shrink-0 flex-wrap gap-2 border-b border-white/10 p-2 text-xs text-white/60"><span className="p-2">Mars shot preview · no provider calls</span>{["Ready","Creating","Starting","Directing"].map(name => <button key={name} className="rounded bg-white/10 px-3 py-2" onClick={() => setState(name)}>{name}</button>)}</div><div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 lg:overflow-hidden"><LongFormCreationHeader current="look" />{state === "Ready" ? <StoryboardWorkspace row={row} script={fixtureScript} onRegenerate={() => setState("Starting")} onBuildWorld={() => {}} onSave={async patches => { const next = {...row,version:row.version+1,parent_visual_plan_version_id:row.id,visual_plan:{...row.visual_plan,visualBeats:row.visual_plan.visualBeats.map(b => ({...b,...patches.find(p=>p.beatId===b.id)}))}}; localStorage.setItem("look-review-shot-draft",JSON.stringify(next)); setRow(next); }} /> : <div className="flex flex-1 items-center justify-center"><VisualPlanProgress row={active} /></div>}</div><div className="fixed inset-x-0 bottom-0 z-50 h-[78px] border-t border-white/10 bg-[#101414] p-6 text-center text-xs text-white/40 lg:hidden">Mobile navigation clearance</div></div>;
}
const root = import.meta.hot?.data.root ?? createRoot(document.getElementById("root"));
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(<React.StrictMode><MemoryRouter><Review /></MemoryRouter></React.StrictMode>);


