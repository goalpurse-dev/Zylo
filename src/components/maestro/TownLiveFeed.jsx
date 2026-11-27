// In This Town, live in the chat (owner 2026-11-27; docs/in-this-town-live-feed.md): the current step, the grid that
// fills in one still at a time ("17 of 38 shots"), a repaired shot replacing its old still. The finished video is
// shown by the card itself (MaestroCards GenerateCard). Without a feed (not the owner's Three.js run) only the step
// line and the bar show.
import { Loader2 } from "lucide-react";

const KEY_STEPS = [
  { id: "directing", label: "Plan" },
  { id: "previews", label: "Test shots" },
  { id: "fixing", label: "Fixes" },
  { id: "rendering", label: "Final video" },
];
const ORDER = ["voice", "directing", "previews", "checking", "fixing", "rendering", "finishing", "done"];
const reached = (stage, id) => ORDER.indexOf(stage) >= ORDER.indexOf(id);

function Tile({ s, now }) {
  const flash = s.replacedAt && now - s.replacedAt < 9000;
  const ring = s.state === "fail" ? "ring-2 ring-rose-400/80" : s.state === "repaired" || s.state === "safe" ? "ring-2 ring-lime-300/80" : "ring-1 ring-white/10";
  const title = `Shot ${s.n}${s.text ? `: ${s.text}` : ""}${s.state === "fail" && s.why ? ` (needs a fix: ${s.why})` : ""}${s.state === "repaired" ? " (fixed)" : s.state === "safe" ? " (a simpler shot)" : ""}`;
  return (
    <div title={title} className={`relative aspect-[9/16] overflow-hidden rounded-lg bg-white/[0.05] ${ring} ${flash ? "animate-pulse" : ""}`} data-testid="town-shot" data-state={s.state} data-v={s.v}>
      {s.thumbUrl
        ? <img key={`${s.n}-${s.v}`} src={s.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover opacity-0 transition-opacity duration-500" onLoad={(e) => { e.currentTarget.style.opacity = "1"; }} />
        : <span className="absolute inset-0 grid place-items-center text-[10.5px] font-bold text-white/35">{s.n}</span>}
      {(s.state === "repaired" || s.state === "safe") && <span className="absolute inset-x-0 bottom-0 bg-lime-300/90 py-px text-center text-[9px] font-black uppercase text-[#11150D]">{s.state === "safe" ? "Simpler" : "Fixed"}</span>}
      {s.state === "fail" && <span className="absolute right-0.5 top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-rose-400 text-[9px] font-black text-white">!</span>}
    </div>
  );
}

export default function TownLiveFeed({ feed, line, pct, now = Date.now() }) {
  return (
    <div className="mt-3" data-testid="town-live">
      <div className="flex items-center gap-2 text-[13.5px]">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-200" />
        <span className="min-w-0 flex-1 truncate font-semibold text-amber-100" data-testid="town-step">{line.words}</span>
        {line.detail && <span className="shrink-0 font-bold text-white" data-testid="town-count">{line.detail}</span>}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-lime-300 transition-all" style={{ width: `${Math.max(4, pct ?? 0)}%` }} /></div>
      {feed && (
        <>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {KEY_STEPS.map((k) => (
              <span key={k.id} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${feed.stage === k.id || (k.id === "previews" && feed.stage === "checking") ? "bg-lime-300 text-[#11150D]" : reached(feed.stage, k.id) ? "bg-lime-300/15 text-lime-200" : "bg-white/[0.05] text-white/45"}`}>{k.label}</span>
            ))}
          </div>
          {feed.shots.length > 0 && (
            <div className="mt-2.5 grid grid-cols-6 gap-1.5 sm:grid-cols-8" data-testid="town-grid">
              {feed.shots.map((s) => <Tile key={s.n} s={s} now={now} />)}
            </div>
          )}
        </>
      )}
      <p className="mt-2 text-[11.5px] text-white/55">You can leave this page. The video keeps going and shows up in your Library.</p>
    </div>
  );
}
