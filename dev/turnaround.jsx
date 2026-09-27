import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import VisualWorldWorkspace from '../src/pages/workspace/long-form/VisualWorldWorkspace';
import snapshot from '../artifacts/turnaround/after.json';
import '../src/index.css';
const root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root'));
if(import.meta.hot) import.meta.hot.data.root=root;
root.render(<MemoryRouter><div className="flex h-dvh flex-col"><p className="shrink-0 bg-black p-2 text-xs text-white/60">Saved Mars reference board · rejected test excluded · no generation calls</p><div className="min-h-0 flex-1"><VisualWorldWorkspace project={{visual_style_preset:'classic-2d-documentary'}} entities={snapshot.world.reference_plan.entities.filter(e=>e.requiredViews.length).map(e=>({...e,importance:e.entityId==='e_protagonist'?'HERO':e.importance}))} assets={snapshot.assets} visualWorld={snapshot.world} onRetry={async()=>false} onEdit={async()=>false} onBuild={()=>{}} /></div></div></MemoryRouter>);
