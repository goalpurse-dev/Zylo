import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import TopPromoBanner from "../workspace/TopPromoBanner.jsx";
import { trackLaunch } from "./launch";
import { BLOCKY_WORLDS_NAME, BLOCKY_WORLDS_PATH, showBlockyWorlds } from "../../data/blockyWorlds";
import useBlockyWorldsAccess from "../viral-tools/blocky-worlds/api/blockyWorldsAccess";

// One slim bar at a time: the highest-priority announcement not yet dismissed.
// Dismissals are stored per id on the profile (profiles.seen_announcements,
// key "bar:<id>"), so once the launch bar is closed the Free Credits bar
// comes back. Signed-out visitors keep the dismissal for the session only.
function InThisTownLaunchBar({ onDismiss }) {
  return (
    <div className="relative w-full overflow-hidden border-b border-white/[0.08] bg-[#090A0A]" data-testid="launch-bar">
      <div className="relative mx-auto flex min-h-9 items-center justify-center gap-2.5 px-3 py-1.5 pr-10 sm:gap-3 sm:pr-12">
        <p className="min-w-0 truncate text-[12px] text-white/85 sm:text-[13px]">
          <span className="font-black tracking-wide text-[#ffcf89]">NEW</span>
          <span className="text-white/35"> — </span>
          <span>{BLOCKY_WORLDS_NAME}</span>
          <span className="hidden sm:inline"> is here. Turn one strange rule into a blocky story video.</span>
        </p>
        <Link
          to={BLOCKY_WORLDS_PATH}
          onClick={() => trackLaunch("try_in_this_town", { placement: "launch_bar" })}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#ffcf89] px-3 py-1 text-[11px] font-bold text-[#241821] transition hover:bg-[#ffdfa9] sm:text-xs"
        >
          Make a video <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
        </Link>
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
  { id: "in_this_town_launch", priority: 20, Bar: InThisTownLaunchBar },
  { id: "free_credits", priority: 10, Bar: TopPromoBanner },
];

const sessionKey = (id) => `zyvo:bar-dismissed:${id}`;

export default function AnnouncementBar() {
  const { user } = useAuth();
  const townAccess = useBlockyWorldsAccess();
  const [seen, setSeen] = useState(null); // null = loading
  useEffect(() => {
    let live = true;
    const local = ANNOUNCEMENTS.filter((a) => { try { return sessionStorage.getItem(sessionKey(a.id)); } catch { return false; } }).map((a) => `bar:${a.id}`);
    if (!user?.id) { setSeen(local); return undefined; }
    supabase.from("profiles").select("seen_announcements").eq("id", user.id).maybeSingle()
      .then(({ data }) => live && setSeen([...local, ...(data?.seen_announcements ?? [])]), () => live && setSeen(local));
    return () => { live = false; };
  }, [user?.id]);

  if (!seen || townAccess === "loading") return null;
  const active = [...ANNOUNCEMENTS].sort((a, b) => b.priority - a.priority)
    .find((a) => !seen.includes(`bar:${a.id}`) && (a.id !== "in_this_town_launch" || showBlockyWorlds(townAccess)));
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
