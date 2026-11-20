import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Download, Loader2, Monitor, Plug, Sparkles } from "lucide-react";
import AuthModal from "../AuthModal";
import { useAuth } from "../../context/AuthContext";
import { CONNECTOR_MOCK, connector } from "../../lib/zyvoConnector";
import { trackSeoEvent } from "../../lib/seoAnalytics.js";
import { CLAUDE_CODE_COMMAND, CONNECT_CLAUDE_PATH, FREE_VS_FINISH, MCP_URL, REQUIREMENTS, STUDIO_KIT_FAQ } from "../../data/studioKit";
import { IN_THIS_TOWN_TOOL_PATH } from "../../data/inThisTownLanding.js";
import { CopyField } from "./StudioKitUI";
import { DISPLAY, FOCUS, PRIMARY, useStudioOpen } from "./studioKitShared";

const WRAP = "mx-auto w-full max-w-[1200px] px-4 sm:px-6";
const BOX = "rounded-2xl border-2 border-white/10 bg-white/[0.03]";
const RETURN = "/in-this-town-story-video-maker#studio";

/**
 * "Make it in Roblox Studio (free)" on the In This Town page (docs/zyvo-studio-kit-plan.md C): the free kit (sign-in,
 * each download counted), the connector, the requirements, "No Studio? Make it in Zyvo" and a short FAQ. Until
 * STUDIO_KIT_PUBLIC (data/studioKit.js) it renders only for accounts the server says are open, and never in the
 * prerendered HTML.
 */
export default function StudioKitSection({ slug }) {
  const open = useStudioOpen();
  const { user } = useAuth() ?? {};
  const [signUp, setSignUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  if (open !== "open") return null;

  const download = async () => {
    trackSeoEvent("seo_cta_clicked", { slug, placement: "studio_kit" });
    if (!CONNECTOR_MOCK && !user) { setSignUp(true); return; }
    setBusy(true); setNotice(null);
    try {
      const r = await connector("/account/kit", { method: "POST" });
      if (CONNECTOR_MOCK) setNotice(`Test mode: the real button downloads ${r.fileName} (version ${r.version}).`);
      else window.location.assign(r.url);
    } catch (e) { setNotice(e.message); }
    finally { setBusy(false); }
  };

  return (
    <section id="studio" className={`${WRAP} scroll-mt-6 py-12 sm:py-16`} aria-labelledby="itt-studio">
      <div className="rounded-[28px] border-2 border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-5 sm:p-10">
        <div className="max-w-[780px]">
          <p className="mb-2 text-[13px] font-black uppercase tracking-[0.16em] text-lime-300">Free · for Roblox Studio</p>
          <h2 id="itt-studio" style={DISPLAY} className="text-balance text-[36px] font-extrabold uppercase leading-[0.95] text-white sm:text-[50px]">Make it in Roblox Studio (free)</h2>
          <p className="mt-3 text-[16px] leading-7 text-white/70">Our free Studio kit is a Claude skill: it writes the story with you, builds the town in your own Roblox Studio, films it in Play while you record, and gives you a captioned video to post. Zyvo is there if you want the voice, sound and music done for you.</p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className={`${BOX} flex flex-col p-5`}>
            <p className="flex items-center gap-2 text-[17px] font-black text-white"><Download className="h-5 w-5 text-lime-300" aria-hidden="true" />1. Get the kit</p>
            <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-white/65">A zip with the skill and a one-page quick start. Unzip it into Claude's skills folder (the quick start shows where). A free Zyvo account is enough.</p>
            <button type="button" onClick={download} disabled={busy} className={`${PRIMARY} mt-4 self-start`}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}Download the free kit
            </button>
            {notice && <p className="mt-2 text-[13px] text-amber-200" role="status">{notice}</p>}
          </div>

          <div className={`${BOX} flex flex-col p-5`}>
            <p className="flex items-center gap-2 text-[17px] font-black text-white"><Plug className="h-5 w-5 text-lime-300" aria-hidden="true" />2. Add the Zyvo connector (optional)</p>
            <p className="mt-2 text-[14.5px] leading-relaxed text-white/65">For story ideas and the paid extras. In Claude: Settings, Connectors, Add custom connector, then paste:</p>
            <div className="mt-3"><CopyField value={MCP_URL} label="Zyvo connector address" /></div>
            <p className="mt-3 text-[14px] text-white/65">In Claude Code:</p>
            <div className="mt-2"><CopyField value={CLAUDE_CODE_COMMAND} label="Claude Code command" /></div>
            <Link to={CONNECT_CLAUDE_PATH} className={`mt-3 inline-flex items-center gap-1 self-start text-[14px] font-bold text-lime-200 underline underline-offset-4 ${FOCUS}`}>Step by step<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>

          <div className={`${BOX} p-5`}>
            <p className="flex items-center gap-2 text-[17px] font-black text-white"><Monitor className="h-5 w-5 text-lime-300" aria-hidden="true" />3. What you need</p>
            <ul className="mt-3 space-y-2 text-[14.5px] leading-relaxed text-white/70">
              {REQUIREMENTS.map((r) => <li key={r} className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-lime-300" aria-hidden="true" />{r}</li>)}
            </ul>
            <p className="mt-3 text-[13.5px] text-white/50">The kit checks all of this first and tells you plainly if your computer can't record Studio smoothly.</p>
          </div>

          <div className="flex flex-col rounded-2xl border-2 border-lime-300/30 bg-gradient-to-br from-[#16200c] to-[#0B0D0F] p-5">
            <p className="flex items-center gap-2 text-[17px] font-black text-white"><Sparkles className="h-5 w-5 text-lime-300" aria-hidden="true" />No Studio? Make it in Zyvo</p>
            <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-white/70">No Roblox Studio, no time, or a slow computer: type one sentence and we write, build, film and render the whole video for you.</p>
            <Link to={IN_THIS_TOWN_TOOL_PATH} onClick={() => trackSeoEvent("seo_cta_clicked", { slug, placement: "studio_kit_zyvo" })} className={`${PRIMARY} mt-4 self-start`}>Make it in Zyvo<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className={`${BOX} p-5`}>
            <p className="text-[12px] font-black uppercase tracking-[0.14em] text-white/50">The free kit gives you</p>
            <ul className="mt-3 space-y-2 text-[14.5px] text-white/75">
              {FREE_VS_FINISH.free.map((x) => <li key={x} className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-white/60" aria-hidden="true" />{x}</li>)}
            </ul>
          </div>
          <div className={`${BOX} p-5`}>
            <p className="text-[12px] font-black uppercase tracking-[0.14em] text-lime-300">Finish in Zyvo adds</p>
            <ul className="mt-3 space-y-2 text-[14.5px] text-white/75">
              {FREE_VS_FINISH.finish.map((x) => <li key={x} className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-lime-300" aria-hidden="true" />{x}</li>)}
            </ul>
          </div>
        </div>

        <div className="mt-8 grid gap-3 lg:grid-cols-2">
          {STUDIO_KIT_FAQ.map(({ q, a }) => (
            <details key={q} className="group rounded-2xl border-2 border-white/10 bg-white/[0.03] px-5 py-4 open:border-lime-300/40">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[16px] font-black text-white">
                {q}<span className="text-[22px] text-lime-300 transition group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="pt-3 text-[15px] leading-7 text-white/70">{a}</p>
            </details>
          ))}
        </div>
      </div>
      {signUp && <AuthModal mode="signup" title="Get the free Studio kit" subtitle="A free Zyvo account is all you need." returnTo={RETURN} onClose={() => setSignUp(false)} />}
    </section>
  );
}
