import { useState } from "react";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { Car, Check, ChevronDown, Compass, ImageOff, MapPin, RotateCw, Sparkles, X } from "lucide-react";
import LongFormSelect from "./LongFormSelect";
import { LongFormCreationHeader } from "./shared";
import { currentReferenceAssets, referenceProgress, viewLabel, VISUAL_WORLD_MODELS, VISUAL_WORLD_STYLES } from "./visualWorldPlanning";

const CATEGORIES = ["CHARACTER", "LOCATION", "IMPORTANT_OBJECT", "VEHICLE_MACHINE"];
const LABELS = { CHARACTER: "Characters", LOCATION: "Locations", IMPORTANT_OBJECT: "Important Objects", VEHICLE_MACHINE: "Vehicles / Machines" };
const ROLES = { CHARACTER: "Hero Character", LOCATION: "Recurring Location", IMPORTANT_OBJECT: "Important Object", VEHICLE_MACHINE: "Vehicle" };
const entityRole = (entity) => entity.entityCategory === "CHARACTER" && entity.importance !== "HERO" ? "Recurring Character" : ROLES[entity.entityCategory];
const ICONS = { CHARACTER: Sparkles, LOCATION: Compass, IMPORTANT_OBJECT: MapPin, VEHICLE_MACHINE: Car };
const STATUS = { planned: "Planned", pending: "Queued", running: "Generating…", succeeded: "Ready", failed: "Failed" };
const modelLabel = (asset) => ["image:flux.base", "runware:400@4"].includes(asset?.render_model) ? "FLUX Base" : "Saved model";

function ReferenceTile({ asset, name, light = false, onOpen, onRetry, busy }) {
  const ready = asset.status === "succeeded" && asset.result_url;
  const failed = asset.status === "failed";
  const active = ["pending", "running"].includes(asset.status);
  return <div className="min-w-0">
    <button type="button" disabled={!ready} onClick={() => onOpen(asset.id)} aria-label={`Preview ${name}, ${viewLabel(asset.angle_or_view)}`} className={`group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border ${light ? "border-black/10 bg-[#e8e5dd]" : "border-white/[0.08] bg-white/[0.025]"} ${ready ? "cursor-zoom-in" : "cursor-default"}`}>
      {ready ? <img src={asset.result_url} alt={`${name}, ${viewLabel(asset.angle_or_view)}`} loading="lazy" className="h-full w-full object-contain transition duration-200 group-hover:scale-[1.02]" /> : <div className={`flex flex-col items-center gap-3 ${light ? "text-black/35" : "text-white/25"}`}>
        {failed ? <ImageOff className="h-7 w-7 text-amber-600" /> : <Sparkles className={`h-7 w-7 ${active ? "motion-safe:animate-pulse" : ""}`} strokeWidth={1.2} />}
        <span className="text-xs">{STATUS[asset.status] ?? "Planned"}</span>
      </div>}
    </button>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
      <p className={`text-xs font-semibold ${light ? "text-[#34362f]" : "text-white/75"}`}>{viewLabel(asset.angle_or_view)}</p>
      {ready && <span className={`flex items-center gap-1 text-[10px] ${light ? "text-[#5b7042]" : "text-lime-300/70"}`}><Check className="h-3 w-3" />Ready</span>}
      {failed && <button disabled={busy} onClick={() => onRetry(asset.id)} className="rounded px-2 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-300/10 disabled:opacity-40">Retry</button>}
    </div>
  </div>;
}

function EntityControl({ entity, excluded, onToggle, locked }) {
  const [expanded, setExpanded] = useState(false);
  const selected = entity.requiredViews.filter((v) => !excluded.has(`${entity.entityId}:${v.angle}`)).length;
  return <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025]">
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-2.5 px-3 py-3 text-left">
      <Check className={`h-3.5 w-3.5 ${selected ? "text-lime-300" : "text-white/20"}`} />
      <span className="min-w-0 flex-1 text-[13px] font-semibold text-white/85">{entity.entityName}</span>
      <span className="text-[11px] text-white/40">{selected} reference{selected === 1 ? "" : "s"}</span>
      <ChevronDown className={`h-3.5 w-3.5 text-white/35 ${expanded ? "rotate-180" : ""}`} />
    </button>
    {expanded && <div className="space-y-2 border-t border-white/[0.06] px-3 py-3">{entity.requiredViews.map((view) => {
      const key = `${entity.entityId}:${view.angle}`;
      return <label key={key} className="flex items-center gap-2 text-xs text-white/60"><input type="checkbox" disabled={locked} checked={!excluded.has(key)} onChange={() => onToggle(key)} className="accent-lime-300" />{viewLabel(view.angle)}</label>;
    })}</div>}
  </div>;
}

export default function VisualWorldWorkspace({ entities = [], assets = [], visualWorld, excludedViews = new Set(), onToggleView, modelKey = "fast", onModelChange, onBuild, onRetry, busy = false, error, loading = false, readOnly = false }) {
  const [mobileControls, setMobileControls] = useState(true);
  const [openId, setOpenId] = useState(null);
  const current = currentReferenceAssets(assets);
  const progress = referenceProgress(assets);
  const started = Boolean(visualWorld);
  const active = busy || ["planning", "generating"].includes(visualWorld?.status) || progress.active > 0;
  const selected = entities.reduce((n, entity) => n + entity.requiredViews.filter((view) => !excludedViews.has(`${entity.entityId}:${view.angle}`)).length, 0);
  const complete = started && !active && !progress.failed && progress.ready === progress.total;
  // Before a Visual World exists yet, the model is a live user choice
  // (modelKey/onModelChange); once one exists, the row becomes a locked,
  // read-only echo of whatever renderer that version actually used — never
  // silently mixed mid-version (Part 20/21 of the renderer A/B milestone).
  const model = started
    ? Object.values(VISUAL_WORLD_MODELS).find((m) => m.toolKey === visualWorld?.renderer_tool_key) ?? VISUAL_WORLD_MODELS.fast
    : VISUAL_WORLD_MODELS[modelKey] ?? VISUAL_WORLD_MODELS.fast;
  const style = VISUAL_WORLD_STYLES[visualWorld?.style_key] ?? VISUAL_WORLD_STYLES.zyvo_illustrated_documentary;
  const openAsset = assets.find((asset) => asset.id === openId);
  const openEntity = entities.find((entity) => entity.entityId === openAsset?.entity_id);
  const history = assets.filter((asset) => asset.entity_id === openAsset?.entity_id && asset.angle_or_view === openAsset?.angle_or_view && asset.status === "succeeded" && asset.result_url);
  const cta = active ? "Creating References…" : complete ? "Continue →" : progress.failed ? "Generate Remaining →" : "Build Visual World →";
  const disabled = loading || active || complete || readOnly || selected === 0 || (started && progress.total === 0);
  const runAction = () => { setMobileControls(false); if (progress.failed) onRetry(current.filter((a) => a.status === "failed").map((a) => a.id)); else onBuild(); };
  const slots = (entity) => entity.requiredViews.filter((view) => !excludedViews.has(`${entity.entityId}:${view.angle}`)).map((view) => current.find((asset) => asset.entity_id === entity.entityId && asset.angle_or_view === view.angle) ?? { id: `${entity.entityId}:${view.angle}`, entity_id: entity.entityId, angle_or_view: view.angle, status: "planned" });
  const actionButton = <><button type="button" onClick={runAction} disabled={disabled} className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 py-3.5 text-[13px] font-bold text-[#11150D] transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50">{active && <RotateCw className="h-4 w-4 motion-safe:animate-spin" />}{cta}</button>{complete && <p className="mt-2 text-center text-[11px] text-white/40">References ready. Scene creation is coming next.</p>}</>;

  return <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#090A0A]">
    <div className="shrink-0 px-4 lg:px-6"><LongFormCreationHeader current="look" /></div>
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-[180px] lg:flex-row lg:overflow-hidden lg:pb-0">
      <aside className="shrink-0 border-b border-white/[0.07] bg-[#0C0F0D] lg:flex lg:w-[350px] lg:flex-col lg:border-b-0 lg:border-r">
        <button type="button" onClick={() => setMobileControls(!mobileControls)} aria-expanded={mobileControls} className="flex w-full items-center justify-between px-5 py-4 text-sm font-semibold text-white lg:hidden">Visual World controls<ChevronDown className={`h-4 w-4 ${mobileControls ? "rotate-180" : ""}`} /></button>
        <div className={`${mobileControls ? "block" : "hidden"} min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 lg:block`}>
          <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-lime-300">Visual World</p><p className="mt-2 text-[13px] leading-relaxed text-white/45">Create consistent references for the people, places and objects in your video.</p></div>
          <div className="space-y-3">
            <LongFormSelect label="Style" value={style.key} options={[{ value: style.key, label: style.label }]} onChange={() => {}} />
            <LongFormSelect
              label="Model"
              value={model.key}
              options={started ? [{ value: model.key, label: model.label, description: model.helper }] : Object.values(VISUAL_WORLD_MODELS).map((m) => ({ value: m.key, label: m.label, description: m.helper }))}
              onChange={started ? () => {} : onModelChange}
            />
            <p className="px-1 text-[11px] text-white/35">{model.helper}</p>
          </div>
          <div><p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">References to Create <span className="float-right normal-case tracking-normal">{selected} selected</span></p>
            {CATEGORIES.filter((cat) => entities.some((e) => e.entityCategory === cat)).map((cat) => <div key={cat} className="mb-4"><p className="mb-2 text-[11px] font-medium text-white/40">{LABELS[cat]}</p><div className="space-y-2">{entities.filter((e) => e.entityCategory === cat).map((entity) => <EntityControl key={entity.entityId} entity={entity} excluded={excludedViews} onToggle={onToggleView} locked={started || busy || readOnly} />)}</div></div>)}
          </div>
        </div>
        <footer className="hidden shrink-0 border-t border-white/[0.07] p-5 lg:block">{actionButton}</footer>
      </aside>
      <main className="min-w-0 shrink-0 px-5 py-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-8">
        <div className="mx-auto max-w-[1100px]">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-[25px] font-bold tracking-[-0.03em] text-white">Your Visual World</h1><p className="mt-1.5 text-[13px] text-white/45">Reusable references keep every scene visually consistent.</p></div>{started && <p role="status" className="rounded-full border border-white/[0.08] px-3 py-2 text-xs text-white/65">{progress.ready} of {progress.total || selected} references ready</p>}</div>
          {error && <p role="alert" className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-200">{error}</p>}
          {active && <p className="mt-4 text-xs text-white/40">You can leave this page. Your references will keep generating in the background.</p>}
          {progress.failed > 0 && <p className="mt-4 text-xs text-amber-200">{progress.failed} reference{progress.failed === 1 ? " needs" : "s need"} another try. Your ready references are still available.</p>}
          {loading && <p role="status" className="mt-8 text-sm text-white/40">Loading your references…</p>}
          {!loading && !started && <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{entities.map((entity) => {
            const Icon = ICONS[entity.entityCategory] ?? Sparkles;
            return <div key={entity.entityId} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]"><div className="relative flex aspect-[4/3] items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(190,242,100,0.07),transparent_70%)]"><div className="absolute inset-5 rounded-xl border border-dashed border-white/[0.07]" /><Icon className="h-12 w-12 text-white/20" strokeWidth={1} /></div><div className="border-t border-white/[0.06] px-4 py-3"><p className="text-sm font-semibold text-white">{entity.entityName}</p><p className="mt-1 text-xs text-white/40">{entityRole(entity)}</p><p className="mt-2 text-[11px] text-lime-300/60">{slots(entity).length} references planned</p></div></div>;
          })}</div>}
          {started && <>
            <div className="mt-7 rounded-2xl bg-[#f3f0e7] p-5 shadow-[0_12px_50px_rgba(0,0,0,0.15)] sm:p-7">
              <div className="mb-6 flex items-center justify-between border-b border-[#34362f]/20 pb-4"><h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#34362f]">Reference Board</h2><span className="text-[10px] text-[#34362f]/50">{style.label}</span></div>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">{entities.filter((entity) => slots(entity).length).map((entity) => <section key={entity.entityId} className={entity.entityCategory === "CHARACTER" ? "xl:col-span-2" : ""}>
                <div className="mb-3 flex items-center justify-between border-b border-black/15 pb-2"><h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#34362f]">{entity.entityName}</h3><span className="text-[10px] text-black/40">{entityRole(entity)}</span></div>
                <div className={`grid gap-3 ${slots(entity).length > 2 ? "grid-cols-2 sm:grid-cols-3" : slots(entity).length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>{slots(entity).map((asset) => <ReferenceTile key={asset.id} asset={asset} name={entity.entityName} light onOpen={setOpenId} onRetry={onRetry} busy={busy || readOnly} />)}</div>
              </section>)}</div>
            </div>
            <h2 className="mb-4 mt-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">All References</h2>
            {CATEGORIES.map((category) => {
              const group = current.filter((asset) => entities.some((e) => e.entityId === asset.entity_id && e.entityCategory === category));
              if (!group.length) return null;
              return <section key={category} className="mb-6"><h3 className="mb-3 text-xs text-white/50">{LABELS[category]}</h3><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">{group.map((asset) => {
                const entity = entities.find((e) => e.entityId === asset.entity_id);
                return <div key={asset.id}><ReferenceTile asset={asset} name={entity.entityName} onOpen={setOpenId} onRetry={onRetry} busy={busy || readOnly} /><p className="mt-2 text-xs font-medium text-white/60">{entity.entityName}</p><p className="mt-1 text-[10px] text-white/30">{modelLabel(asset)} · {STATUS[asset.status]}</p></div>;
              })}</div></section>;
            })}
          </>}
        </div>
      </main>
    </div>
    <footer className="fixed inset-x-0 bottom-[calc(78px+env(safe-area-inset-bottom))] z-40 border-t border-white/[0.08] bg-[#0C0F0D]/95 px-5 py-3 backdrop-blur-xl lg:hidden">{actionButton}</footer>
    <Dialog open={Boolean(openAsset)} onClose={() => setOpenId(null)} className="relative z-[100]">
      <DialogBackdrop className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-4"><DialogPanel className="max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-[#101213] p-5">
        <div className="mb-4 flex items-center justify-between"><DialogTitle className="text-lg font-semibold text-white">{openEntity?.entityName ?? "Reference"}</DialogTitle><button onClick={() => setOpenId(null)} aria-label="Close preview" className="rounded-lg p-2 text-white/60 hover:bg-white/5"><X className="h-5 w-5" /></button></div>
        {openAsset && <><img src={openAsset.result_url} alt={`${openEntity?.entityName ?? "Reference"}, ${viewLabel(openAsset.angle_or_view)}`} className="max-h-[65dvh] w-full rounded-xl bg-white/[0.03] object-contain" /><div className="mt-4 flex flex-wrap items-center justify-between gap-4"><div className="text-sm text-white/60"><p>{viewLabel(openAsset.angle_or_view)}</p><p className="mt-1 text-xs text-white/35">{style.label} · {modelLabel(openAsset)}</p></div><button disabled={busy || readOnly} onClick={() => onRetry(openAsset.id).then((ok) => { if (ok !== false) setOpenId(null); })} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40">Regenerate</button></div><p className="mt-3 text-[11px] text-white/30">Regenerates this view only. The previous reference stays in its history.</p></>}
        {history.length > 1 && <div className="mt-5 border-t border-white/10 pt-4"><p className="mb-3 text-xs text-white/40">Reference history</p><div className="flex flex-wrap gap-3">{history.map((asset, index) => <button key={asset.id} onClick={() => setOpenId(asset.id)} aria-label={`View saved reference ${index + 1}`} className={`w-20 overflow-hidden rounded-lg border ${asset.id === openId ? "border-lime-300" : "border-white/10"}`}><img src={asset.result_url} alt={`Saved reference ${index + 1}`} className="aspect-square object-contain" /></button>)}</div></div>}
      </DialogPanel></div>
    </Dialog>
  </div>;
}
