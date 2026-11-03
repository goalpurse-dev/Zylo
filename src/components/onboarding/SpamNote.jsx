// "📩 We just sent you an email": only for an account the welcome email was really sent to (onboarding_status.welcomeSent),
// until it taps "I found it ✓" (dismiss_spam_note, for good). On "Your video is coming to life" and as a banner on Home.
// The owner's walk-through shows it with their own address and saves nothing.
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { adminPreviewMode, fetchOnboardingStatus, trackFunnel } from "../../lib/onboarding";

export const SPAM_NOTE_TEXT = "If it landed in spam, tap 'Not spam' so you don't miss your video updates.";

export default function SpamNote({ where = "home" }) {
  const { user, loading } = useAuth();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (loading || !user?.id) return undefined;
    if (adminPreviewMode()) { setShow(true); return undefined; }
    let live = true, t;
    // the email goes when "Building your plan" ends: a second look shortly after, in case it was still on its way
    const look = (again) => fetchOnboardingStatus(user.id, { fresh: true }).then((s) => {
      if (!live) return;
      if (s?.welcomeSent && !s.spamNoteDismissed) { setShow(true); trackFunnel("spam_note_shown", { where }); }
      else if (again && s?.enrolled && !s.welcomeSent) t = setTimeout(() => look(false), 8000);
    });
    look(true);
    return () => { live = false; clearTimeout(t); };
  }, [loading, user?.id, where]);
  if (!show) return null;

  const found = () => {
    setShow(false);
    if (adminPreviewMode()) return;
    trackFunnel("spam_note_found", { where });
    supabase.rpc("dismiss_spam_note").then(() => {}, () => {});
  };
  const banner = where === "home";
  return (
    <div className={banner ? "mx-auto mt-4 w-full max-w-[1100px] px-4 md:px-[50px]" : "mt-4"} data-testid={`spam-note-${where}`}>
      <div role="status" className={`relative flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-white/15 bg-[#151715]/95 px-4 py-3 text-left ${banner ? "pr-11" : ""}`}>
        <p className="min-w-0 flex-1 basis-[60%] text-[13.5px] leading-snug text-white/80">
          <span aria-hidden="true">📩 </span>We just sent you an email at <span className="break-words font-bold text-white">{user?.email}</span>. {SPAM_NOTE_TEXT}
        </p>
        <button type="button" onClick={found} data-testid="spam-note-found" className="min-h-[40px] shrink-0 rounded-xl border border-lime-300/50 px-3.5 text-[13.5px] font-bold text-lime-200 transition hover:bg-lime-300/10">I found it ✓</button>
        {banner && <button type="button" onClick={() => setShow(false)} aria-label="Hide for now" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white/80"><X className="h-4 w-4" /></button>}
      </div>
    </div>
  );
}
