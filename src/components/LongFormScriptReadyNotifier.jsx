// Phase 6c-polish — in-app notifications for Stickman projects this browser
// started ("You can leave — we'll notify you"). Each notification is ONE
// event (voiceover ready, scenes ready, a step needing a retry), keyed by
// project + event + the server's own timestamp, shown once and remembered as
// seen. Never shown for a step the user is already on or has moved past.
// (Replaces the 6a version, which re-announced "Your script is ready" every
// time the watch list was touched — 3+ stacked toasts on the Scenes page.)
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "../lib/supabaseClient";
import { unwatchProject, watchedProjects } from "../pages/workspace/long-form/autopilot";
import { autopilotEvent, alreadyThere } from "../pages/workspace/long-form/notifyEvents";

const SEEN_KEY = "zyvo_lf_seen_events";
const seen = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]")); } catch { return new Set(); } };
const markSeen = (key) => { try { const s = seen(); s.add(key); localStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-200))); } catch { /* storage unavailable */ } };

export default function LongFormScriptReadyNotifier() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const ids = watchedProjects();
      if (!ids.length) return;
      const { data } = await supabase.from("long_form_projects").select("id, autopilot, selected_title").in("id", ids);
      if (!alive) return;
      for (const p of data ?? []) {
        const ev = autopilotEvent(p.autopilot);
        if (!ev) continue;
        const key = `${p.id}:${ev.id}:${ev.at ?? ""}`;
        if (seen().has(key)) continue;
        markSeen(key);
        if (ev.final) unwatchProject(p.id);
        if (alreadyThere(window.location.pathname, p.id, ev.step)) continue; // they're looking at it already
        const open = { label: "Open", onClick: () => navigate(`/long-form/project/${p.id}/${ev.page}`) };
        (ev.kind === "error" ? toast.error : toast.success)(ev.title, { id: key, description: p.selected_title ?? undefined, action: open, duration: 15000 });
      }
    };
    check();
    const t = setInterval(check, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [navigate, location.pathname]);
  return null;
}
