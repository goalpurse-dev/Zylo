// Home, for accounts in the new flow: "Your video is waiting" with an Upgrade button, a finish in progress, or the free
// preview they haven't made yet. Everyone else never sees it, and never makes the call.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Lock } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { DEMO_POSTER, DEMO_STATE, FIRST_VIDEO_PATH, adminPreviewMode, fetchOnboardingStatus } from "../../lib/onboarding";
import { cutawayServer } from "../viral-tools/cutaway-explainer/api/cutawayApi";

export default function FirstVideoHomeCard() {
  const { user, loading } = useAuth();
  const [state, setState] = useState(null);
  useEffect(() => {
    if (loading || !user?.id) return undefined;
    let live = true;
    const adminMode = adminPreviewMode();
    if (adminMode === "demo") { setState({ ...DEMO_STATE, preview: { step: "done", poster: DEMO_POSTER } }); return undefined; }
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
  else if (done && state.plan === "free") card = { title: "Your video is waiting", line: "Upgrade to finish the rest of your video. It's on us: no credits.", cta: "Upgrade", to: FIRST_VIDEO_PATH, poster: preview.poster };
  else if (preview && !done && preview.step !== "failed") card = { title: "Your first video is being made", line: "Your free 10-second preview will be ready in a moment.", cta: "Watch it", to: FIRST_VIDEO_PATH };
  else if (state.on && state.topics?.length) card = { title: "Make your first video free", line: "Pick an idea and get a free 10-second preview.", cta: "Start", to: FIRST_VIDEO_PATH };
  if (!card) return null;

  return (
    <div className="mx-auto mt-4 w-full max-w-[1100px] px-4 md:px-[50px]" data-testid="first-video-home-card">
      <Link to={card.to} className="flex items-center gap-4 rounded-2xl border border-lime-300/40 bg-lime-300/[0.07] p-3 transition hover:bg-lime-300/[0.12]">
        <span className="relative grid h-16 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-black/60">
          {card.poster && <img src={card.poster} alt="" className="absolute inset-0 h-full w-full object-cover blur-[2px] brightness-50" />}
          <Lock className="relative h-5 w-5 text-lime-300" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-black text-white">{card.title}</span>
          <span className="block text-[13px] text-white/65">{card.line}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 rounded-xl bg-lime-300 px-4 py-2.5 text-[14px] font-black text-[#11150D]">{card.cta} <ArrowRight className="h-4 w-4" /></span>
      </Link>
    </div>
  );
}
