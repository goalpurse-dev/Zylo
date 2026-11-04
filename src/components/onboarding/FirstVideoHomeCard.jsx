// Home, for accounts in the new flow: "Your video is waiting" with its frozen frame, a finish in progress, or the free
// preview they haven't made yet. Everyone else never sees it, and never makes the call.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Gift, Lock, Play, RotateCcw } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSignupBonus } from "../../lib/useSignupBonus";
import { FIRST_VIDEO_PATH, adminPreviewMode, fetchOnboardingStatus } from "../../lib/onboarding";
import { DEMO_POSTER, demoStateFor } from "../../lib/onboardingDemo";
import { cutawayServer } from "../viral-tools/cutaway-explainer/api/cutawayApi";
import { PREVIEW } from "../../../supabase/functions/_shared/cutaway/freePreview.js";

const VIDEO_SEC = 30;
const DONE_PCT = Math.round((PREVIEW.seconds / VIDEO_SEC) * 100);

export default function FirstVideoHomeCard() {
  const { user, loading } = useAuth();
  const [state, setState] = useState(null);
  const bonus = useSignupBonus();
  useEffect(() => {
    if (loading || !user?.id) return undefined;
    let live = true;
    const adminMode = adminPreviewMode();
    if (adminMode === "demo") { setState({ ...demoStateFor(), preview: { step: "done", poster: DEMO_POSTER } }); return undefined; }
    fetchOnboardingStatus(user.id).then((status) => {
      if (!status.enrolled && adminMode !== "real") return null;
      return cutawayServer.freePreviewState({ force: adminMode === "real" }).then((s) => { if (live) setState(s); });
    }).catch(() => {});
    return () => { live = false; };
  }, [loading, user?.id]);
  if (!state) return null;

  const { preview, finish } = state;
  const done = preview?.step === "done";
  let card = null;
  if (finish && finish.step !== "done") card = { title: "Your video is being finished", line: "It's a gift from us. It lands here when it's ready.", cta: "Watch it", to: `${FIRST_VIDEO_PATH}?paid=1` };
  else if (finish) card = null;
  // made again after a failure and not watched yet: watch it first (the lock comes at its end, as on the first try)
  else if (done && state.plan === "free" && state.unseen) card = { title: "Your free preview is ready 🎉", line: "Your 10-second video is made. Watch it now.", cta: "Watch it", to: FIRST_VIDEO_PATH, poster: preview.poster, testid: "ready" };
  else if (done && state.plan === "free") card = { title: "Your video is waiting", line: `${DONE_PCT}% done. The other ${VIDEO_SEC - PREVIEW.seconds} seconds are free when you start a plan.`, cta: "Finish my video", to: `${FIRST_VIDEO_PATH}?unlock=1`, poster: preview.poster, waiting: true };
  else if (preview && !done && preview.step !== "failed") card = { title: "Your first video is being made", line: "Your free 10-second preview will be ready in a moment.", cta: "Watch it", to: FIRST_VIDEO_PATH };
  // their preview failed (it's theirs again): say so, and the page starts the same video again
  else if (state.lastFailed && state.on && state.topics?.length) card = { title: "Your preview didn't go through", line: "That's on us, and it's still free. Try again: it takes about 2 minutes.", cta: "Try again", to: `${FIRST_VIDEO_PATH}?retry=1`, testid: "failed" };
  else if (state.on && state.topics?.length) card = { title: "Make your first video free", line: "Pick an idea and get a free 10-second preview.", cta: "Start", to: FIRST_VIDEO_PATH };
  if (!card) return null;

  return (
    <div className="mx-auto mt-4 w-full max-w-[1100px] px-4 md:px-[50px]" data-testid="first-video-home-card" data-card={card.testid ?? "default"}>
      <Link to={card.to} className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-lime-300/40 bg-lime-300/[0.07] p-3 transition hover:bg-lime-300/[0.12] sm:flex-nowrap">
        <span className="relative grid h-[88px] w-[62px] shrink-0 place-items-center overflow-hidden rounded-xl bg-black/60">
          {card.poster && <img src={card.poster} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-[3px] brightness-50" />}
          {card.testid === "failed" ? <RotateCcw className="relative h-5 w-5 text-lime-300" /> : card.testid === "ready" ? <Play className="relative h-5 w-5 fill-lime-300 text-lime-300" /> : <Lock className="relative h-5 w-5 text-lime-300" />}
        </span>
        <span className="min-w-0 flex-1 basis-[55%]">
          <span className="block text-[17px] font-black text-white">{card.title}</span>
          <span className="block text-[13px] text-white/65">{card.line}</span>
          {card.waiting && <span className="mt-2 block h-[7px] max-w-[320px] overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-lime-300" style={{ width: `${DONE_PCT}%` }} /></span>}
          {card.waiting && bonus.line && <span className="mt-2 flex items-center gap-1.5 text-[12.5px] font-black text-lime-200" data-testid="home-card-bonus"><Gift className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> <span>{bonus.head}<span className="whitespace-nowrap">{bonus.tail}</span></span></span>}
        </span>
        <span className="flex min-h-[46px] w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-lime-300 px-4 py-2.5 text-[15px] font-black text-[#11150D] sm:w-auto">{card.cta} <ArrowRight className="h-4 w-4" /></span>
      </Link>
    </div>
  );
}
