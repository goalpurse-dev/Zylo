import { BadgeCheck, CheckCircle2, Clock3, Layers, Plus, Volume2, VolumeX, Wand2 } from "lucide-react";
import { quoteTopic } from "./api/cutawayApi";

function CreditIcon() {
  return <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 bg-current" style={{ WebkitMaskImage: "url('/icons/credits.png')", maskImage: "url('/icons/credits.png')", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" }} />;
}

/** One setting, shown as it was used: ghost style, nothing to change. */
function Row({ icon: Icon, label, value, d }) {
  return (
    <div style={{ "--d": `${d}ms` }} className="cw-fade-up flex items-center justify-between gap-3 rounded-xl border border-dashed border-white/[0.09] bg-white/[0.02] px-3 py-2.5">
      <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-white/35"><Icon className="h-3.5 w-3.5" />{label}</span>
      <span className="text-right text-[12px] font-semibold text-white/55">{value}</span>
    </div>
  );
}

/**
 * The Generate side while a finished video or an example is open: what it was made with, read-only, and the two
 * ways on (a new empty builder, or the builder pre-filled with these settings). Replaces the editable builder so
 * nothing looks changeable for a video that already exists.
 */
export default function CutawaySummary({ run, onNew, onMakeLike }) {
  const kind = run.example ? "Premade topic" : (run.kind ?? quoteTopic(run.topic, 30).kind) === "premade" ? "Premade topic" : "Custom topic";
  const spent = run.example ? "Example" : run.credits != null ? <span className="inline-flex items-center gap-1"><CreditIcon />{run.credits}{run.demo ? " · not charged in the demo" : ""}</span> : "—";
  return (
    <section className="relative flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-cutaway/[0.13] bg-[#0C0F0D] lg:h-full lg:min-h-0" aria-label="Generation finished">
      <div className="shrink-0 border-b border-white/[0.06] px-5 py-4 lg:py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl border border-cutaway/20 bg-cutaway/10"><Layers className="h-4 w-4 text-cutaway" /></span>
          <div>
            <h1 className="text-[18px] font-black tracking-[-0.03em] text-white">Cutaway Explainer</h1>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cutaway/65">How things work, in one shot</p>
          </div>
        </div>
      </div>

      {/* the content animates in; the bottom bar (fixed on phones) stays outside any animated parent */}
      <div key={run.id} className="cw-view min-h-0 flex-1 overflow-y-auto px-5 py-4 [scrollbar-width:thin] lg:py-3">
        <div className="flex flex-col gap-3 pb-[170px] lg:pb-0">
          <div className="cw-pop flex items-center gap-2.5 rounded-2xl border border-cutaway/25 bg-cutaway/[0.07] px-3.5 py-3">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-cutaway" />
            <div className="min-w-0">
              <p className="text-[14px] font-black text-white">Generation finished</p>
              <p className="text-[11px] font-medium text-white/45">{run.example ? "This is one of our examples. These are the settings it was made with." : "These are the settings this video was made with."}</p>
            </div>
          </div>

          <div style={{ "--d": "60ms" }} className="cw-fade-up">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/30">Topic</p>
            <div aria-readonly="true" className="min-h-[64px] rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.02] px-4 py-3 text-[14px] leading-relaxed text-white/55">{run.topic}</div>
          </div>
          <Row d={100} icon={Layers} label="Topic type" value={kind} />
          <Row d={130} icon={Clock3} label="Length" value={`${run.lengthSec} seconds`} />
          <Row d={160} icon={run.soundEffects === false ? VolumeX : Volume2} label="Sound effects" value={run.soundEffects === false ? "Off" : "On"} />
          <Row d={190} icon={BadgeCheck} label="Watermark" value={run.endCard === false ? "Off (no end card)" : "On (Zyvo end card)"} />
          <Row d={220} icon={CheckCircle2} label="Credits spent" value={spent} />
        </div>
      </div>

      <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-[90] border-t border-white/[0.07] bg-[#0C0F0D]/95 px-5 pb-2 pt-3 backdrop-blur-xl lg:static lg:shrink-0 lg:bg-[#0C0F0D] lg:pb-3 lg:pt-2.5">
        <div className="flex gap-2">
          <button type="button" onClick={onNew} className="cw-press flex flex-1 items-center justify-center gap-2 rounded-xl bg-cutaway py-3.5 text-[14px] font-black text-cutaway-ink hover:bg-cutaway-soft lg:py-2.5">
            <Plus className="h-4 w-4" strokeWidth={3} />New video
          </button>
          <button type="button" onClick={() => onMakeLike(run)} className="cw-press flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.05] py-3.5 text-[13px] font-bold text-white/85 hover:border-cutaway/30 hover:text-white lg:py-2.5">
            <Wand2 className="h-4 w-4 text-cutaway" />Make one like this
          </button>
        </div>
      </div>
    </section>
  );
}
