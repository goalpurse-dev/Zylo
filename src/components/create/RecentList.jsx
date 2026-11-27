import { Link } from "react-router-dom";
import { Clapperboard, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { useRecent } from "./useRecent";

const LABEL = { done: "Ready", making: "Making…", failed: "Didn't work", plan: "Plan", sent: "Sent to make", claude: "With Claude" };
const TONE = { done: "text-lime-300", making: "text-amber-200", failed: "text-rose-300", plan: "text-white/50", sent: "text-white/50", claude: "text-white/50" };

function Thumb({ item, className }) {
  if (item.thumb) return <img src={item.thumb} alt="" className={`${className} object-cover`} loading="lazy" />;
  if (item.video) return <video src={item.video} muted playsInline preload="metadata" className={`${className} object-cover`} />;
  const Icon = item.kind === "plan" ? FileText : item.kind === "video" ? Clapperboard : ImageIcon;
  return <span className={`${className} grid place-items-center bg-white/[0.06]`}><Icon className="h-4 w-4 text-white/40" /></span>;
}

function Status({ item }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] ${TONE[item.status]}`}>
      {item.status === "making" && <Loader2 className="h-3 w-3 animate-spin" />}{LABEL[item.status]}
    </span>
  );
}

/** "Recent" in the side menu: small rows */
export function RecentRows({ limit = 4, onGo }) {
  const items = useRecent(limit);
  if (!items.length) return <p className="px-2 py-2 text-[11.5px] leading-relaxed text-white/55">Your plans and videos show up here.</p>;
  return (
    <div className="flex flex-col gap-0.5" data-testid="recent-rows">
      {items.map((it) => (
        <Link key={it.id} to={it.to} onClick={onGo} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-white/[0.05]">
          <Thumb item={it} className="h-8 w-8 shrink-0 rounded-lg" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-medium text-white/85">{it.title}</span>
            <Status item={it} />
          </span>
        </Link>
      ))}
    </div>
  );
}

/** "Recent" on a page: a sideways strip of cards */
export function RecentStrip({ title = "Recent", limit = 8, kinds = null }) {
  const items = useRecent(limit * 2).filter((it) => !kinds || kinds.includes(it.kind)).slice(0, limit);
  if (!items.length) return null;
  return (
    <section className="mt-8" aria-labelledby="recent-strip">
      <div className="flex items-center justify-between">
        <h2 id="recent-strip" className="text-[17px] font-black text-white">{title}</h2>
        <Link to="/workspace/creations" className="text-[13px] font-semibold text-white/50 hover:text-white">See all</Link>
      </div>
      <div className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2" data-testid="recent-strip">
        {items.map((it) => (
          <Link key={it.id} to={it.to} className="w-[150px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] transition hover:border-lime-300/40">
            <Thumb item={it} className="aspect-[4/5] w-full" />
            <span className="block px-2.5 py-2">
              <span className="block truncate text-[12.5px] font-semibold text-white">{it.title}</span>
              <Status item={it} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
