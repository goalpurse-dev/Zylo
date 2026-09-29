import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import TopPromoBanner from "../workspace/TopPromoBanner.jsx";
import { trackLaunch } from "./launch";

// One slim bar at a time: the highest-priority announcement not yet dismissed.
// Dismissals are stored per id on the profile (profiles.seen_announcements,
// key "bar:<id>"), so once the Long Form bar is closed the Free Credits bar
// comes back. Signed-out visitors keep the dismissal for the session only.
function LongFormLaunchBar({ onDismiss }) {
  const navigate = useNavigate();
  return (
    <div className="relative w-full overflow-hidden border-b border-lime-300/[0.10] bg-[#090A0A]" data-testid="launch-bar">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_48%_140%_at_50%_50%,rgba(190,242,100,0.16),transparent_70%)]" />
      <div className="relative mx-auto flex min-h-9 items-center justify-center gap-2.5 px-3 py-1.5 pr-10 sm:gap-3 sm:pr-12">
        <p className="min-w-0 truncate text-[12px] text-white/85 sm:text-[13px]">
          <span className="font-black tracking-wide text-lime-300">NEW</span>
          <span className="text-white/35"> — </span>
          <span className="hidden sm:inline">Long Form is here: turn one idea into a full YouTube video.</span>
          <span className="sm:hidden">Long Form: one idea, a full YouTube video.</span>
        </p>
        <button
          type="button"
          onClick={() => { trackLaunch("try_long_form", { placement: "launch_bar" }); navigate("/long-form"); }}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-lime-300 px-3 py-1 text-[11px] font-bold text-[#11150D] shadow-[0_0_18px_rgba(190,242,100,.25)] transition hover:bg-lime-200 sm:text-xs"
        >
          Try Long Form <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss announcement"
        className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-sm text-white/45 transition hover:bg-white/5 hover:text-white sm:right-3"
      >
        ✕
      </button>
    </div>
  );
}

export const ANNOUNCEMENTS = [
  { id: "long_form_launch", priority: 20, Bar: LongFormLaunchBar },
  { id: "free_credits", priority: 10, Bar: TopPromoBanner },
];

const sessionKey = (id) => `zyvo:bar-dismissed:${id}`;

export default function AnnouncementBar() {
  const { user } = useAuth();
  const [seen, setSeen] = useState(null); // null = loading
  useEffect(() => {
    let live = true;
    const local = ANNOUNCEMENTS.filter((a) => { try { return sessionStorage.getItem(sessionKey(a.id)); } catch { return false; } }).map((a) => `bar:${a.id}`);
    if (!user?.id) { setSeen(local); return undefined; }
    supabase.from("profiles").select("seen_announcements").eq("id", user.id).maybeSingle()
      .then(({ data }) => live && setSeen([...local, ...(data?.seen_announcements ?? [])]), () => live && setSeen(local));
    return () => { live = false; };
  }, [user?.id]);

  if (!seen) return null;
  const active = [...ANNOUNCEMENTS].sort((a, b) => b.priority - a.priority).find((a) => !seen.includes(`bar:${a.id}`));
  if (!active) return null;
  const dismiss = () => {
    trackLaunch("bar_dismiss", { placement: "launch_bar", target: active.id });
    try { sessionStorage.setItem(sessionKey(active.id), "1"); } catch { /* per-session fallback only */ }
    if (user?.id) supabase.rpc("mark_announcement_seen", { p_key: `bar:${active.id}` }).then(() => {}, () => {});
    setSeen((s) => [...s, `bar:${active.id}`]);
  };
  const { Bar } = active;
  return <Bar key={active.id} onDismiss={dismiss} />;
}
