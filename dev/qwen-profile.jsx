import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import VisualWorldWorkspace from '../src/pages/workspace/long-form/VisualWorldWorkspace';
import snapshot from '../artifacts/qwen-profile/before.json';
import '../src/index.css';
const root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root'));
if(import.meta.hot) import.meta.hot.data.root=root;
function Harness(){const [calls,setCalls]=useState(0); const [version,setVersion]=useState(0); const count=()=>{setCalls(n=>n+1);return Promise.resolve(false)}; return (<MemoryRouter><div className="fixed bottom-0 left-0 z-[9999] bg-black p-2 text-white"><span data-testid="provider-calls">Provider callbacks: {calls}</span><button className="ml-3" onClick={()=>setVersion(n=>n+1)}>Remount board</button></div><div className="flex h-dvh flex-col"><p className="shrink-0 bg-black p-2 text-xs text-white/60">Saved Mars reference board · local policy verification · no provider connected</p><div className="min-h-0 flex-1"><VisualWorldWorkspace key={version} project={{visual_style_preset:'classic-2d-documentary'}} entities={snapshot.world.reference_plan.entities.filter(e=>e.requiredViews.length).map(e=>({...e,importance:e.entityId==='e_protagonist'?'HERO':e.importance}))} assets={snapshot.assets} visualWorld={snapshot.world} onRetry={count} onEdit={count} onBuild={count} /></div></div></MemoryRouter>);}
root.render(<Harness/>);
