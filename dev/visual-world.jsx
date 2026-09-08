import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import VisualWorldWorkspace from "../src/pages/workspace/long-form/VisualWorldWorkspace";
import { referenceEntities } from "../src/pages/workspace/long-form/visualWorldPlanning";
import { fixturePlan, fixtureWorld, smokeSlots } from "../tests/fixtures/visualWorldFixture";
import results from "../artifacts/visual-world/smoke-results.json";
import "../src/index.css";

export default function Review() {
  const [state, setState] = useState("Planned");
  const [retryIds, setRetryIds] = useState([]);
  const [excluded, setExcluded] = useState(new Set());
  const assets = results.map((job, index) => ({ id: `fixture-asset-${index}`, job_id: job.id, entity_id: smokeSlots[index].split(":")[0], angle_or_view: smokeSlots[index].split(":")[1], status: state === "Retrying" && retryIds.includes(`fixture-asset-${index}`) ? "running" : state === "Generating" && index > 0 ? (index === 1 ? "running" : "pending") : state === "Partial failure" && index === 1 ? "failed" : "succeeded", result_url: job.result_url, render_model: "runware:400@4", prompt_snapshot: job.prompt, cost_usd: job.output.data[0].cost }));
  const world = state === "Planned" ? null : { ...fixtureWorld, status: ["Generating", "Retrying"].includes(state) ? "generating" : state === "Partial failure" ? "needs_attention" : "ready" };
  return <div className="flex flex-col" style={{ height: "100dvh" }}><div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 p-2 text-xs text-white/60"><span>Isolated fixture · no generation calls</span>{["Planned", "Generating", "Partial failure", "Ready"].map((value) => <button key={value} onClick={() => setState(value)} className={`rounded px-3 py-2 ${state === value ? "bg-lime-300 text-black" : "bg-white/5"}`}>{value}</button>)}</div><div className="min-h-0 flex-1"><VisualWorldWorkspace entities={referenceEntities(fixturePlan, world)} assets={world ? assets : []} visualWorld={world} excludedViews={world ? new Set() : excluded} onToggleView={(key) => setExcluded((old) => { const next = new Set(old); next.has(key) ? next.delete(key) : next.add(key); return next; })} onBuild={() => setState("Generating")} onRetry={async (ids) => { setRetryIds(Array.isArray(ids) ? ids : [ids]); setState("Retrying"); return true; }} /></div><div className="fixed inset-x-0 bottom-0 z-50 h-[78px] border-t border-white/10 bg-[#101213] p-6 text-center text-xs text-white/40 lg:hidden">Mobile navigation clearance</div></div>;
}
const root = import.meta.hot?.data.root ?? createRoot(document.getElementById("root"));
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(<React.StrictMode><MemoryRouter><Review /></MemoryRouter></React.StrictMode>);
