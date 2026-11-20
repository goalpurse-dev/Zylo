import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, Copy, Download, Loader2, Plug, Sparkles, Video } from "lucide-react";
import AuthModal from "../AuthModal";
import { useAuth } from "../../context/AuthContext";
import { CONNECTOR_MOCK, connector } from "../../lib/zyvoConnector";
import { trackSeoEvent } from "../../lib/seoAnalytics.js";
import { CONNECT_CLAUDE_PATH, FREE_VS_FINISH, MCP_URL, REQUIREMENTS, STUDIO_KIT_FAQ } from "../../data/studioKit";
import { IN_THIS_TOWN_TOOL_PATH } from "../../data/inThisTownLanding.js";
import { DISPLAY, FOCUS, PRIMARY, SECONDARY, useStudioOpen } from "./studioKitShared";
import BeforeAfter from "./BeforeAfter";
import FlowLoop from "./FlowLoop";
import "./studioKit.css";

const WRAP = "mx-auto w-full max-w-[1200px] px-4 sm:px-6";
const RETURN = "/in-this-town-story-video-maker#studio";

/**
 * "Make it in Roblox Studio (free)" on the In This Town page (docs/zyvo-studio-kit-plan.md C): the flow as a loop,
 * three compact steps (the kit, the connector, record + post), the free-vs-Zyvo slider on our real Bedtime Story,
 * "No Studio? Make it in Zyvo", the FAQ. Until STUDIO_KIT_PUBLIC (data/studioKit.js) only for accounts the server
 * says are open, and never in the prerendered HTML.
 */
export default function StudioKitSection({ slug }) {
  const open = useStudioOpen();
  const { user } = useAuth() ?? {};
  const [signUp, setSignUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [copied, setCopied] = useState(0);
  if (open !== "open") return null;

  const download = async () => {
    trackSeoEvent("seo_cta_clicked", { slug, placement: "studio_kit" });
    if (!CONNECTOR_MOCK && !user) { setSignUp(true); return; }
    setBusy(true); setNotice(null);
    try {
      const r = await connector("/account/kit", { method: "POST" });
      if (CONNECTOR_MOCK) setNotice(`Test mode: the real button downloads ${r.fileName}.`);
      else window.location.assign(r.url);
    } catch (e) { setNotice(e.message); }
    finally { setBusy(false); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(MCP_URL); } catch { /* shown anyway */ } setCopied((n) => n + 1); window.setTimeout(() => setCopied(0), 1800); };

  return (
    <section id="studio" className={`${WRAP} scroll-mt-6 py-12 sm:py-16`} aria-labelledby="itt-studio">
      <div className="rounded-[28px] border-2 border-lime-300/20 bg-gradient-to-b from-[#121a0d] to-[#0B0D0F] p-5 sm:p-10">
        <div className="mx-auto max-w-[760px] text-center">
          <p className="mb-2 text-[13px] font-black uppercase tracking-[0.16em] text-lime-300">Free · for Roblox Studio</p>
          <h2 id="itt-studio" style={DISPLAY} className="text-balance text-[38px] font-extrabold uppercase leading-[0.95] text-white sm:text-[56px]">Make it in Roblox Studio (free)</h2>
          <p className="mt-3 text-[16px] leading-7 text-white/70">Claude writes it, your own Studio builds it, you get a video to post.</p>
        </div>

        <div className="mt-8"><FlowLoop /></div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="order-2 space-y-3 lg:order-1">
            <Step n={1} icon={Download} title="Get the free kit" text="A Claude skill. Unzip it into Claude's skills folder.">
              <button type="button" onClick={download} disabled={busy} className={PRIMARY}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}Download the free kit
              </button>
              {notice && <p className="mt-2 text-[13px] text-amber-200" role="status">{notice}</p>}
            </Step>
            <Step n={2} icon={Plug} title="Connect Claude to Zyvo" tag="optional" text="For story ideas and the paid extras.">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={copy} key={copied} className={`${SECONDARY} ${copied ? "sk-copied border-lime-300 text-lime-100" : ""}`}>
                  {copied ? <Check className="h-4 w-4 text-lime-300" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}{copied ? "Copied!" : "Copy the connector link"}
                </button>
                <Link to={CONNECT_CLAUDE_PATH} className={`inline-flex min-h-11 items-center gap-1 px-2 text-[14px] font-bold text-lime-200 underline underline-offset-4 ${FOCUS}`}>How<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              </div>
            </Step>
            <Step n={3} icon={Video} title="Record and post" text="Press record, Claude plays the shots, the kit adds the voice and white captions.">
              <details className="group">
                <summary className={`inline-flex cursor-pointer list-none items-center gap-1 text-[13.5px] font-bold text-white/70 hover:text-white ${FOCUS}`}>What your computer needs<ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" /></summary>
                <ul className="mt-2 space-y-1.5 text-[13.5px] leading-relaxed text-white/65">
                  {REQUIREMENTS.map((r) => <li key={r} className="flex gap-2"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-lime-300" aria-hidden="true" />{r}</li>)}
                </ul>
              </details>
            </Step>
            <Link to={IN_THIS_TOWN_TOOL_PATH} onClick={() => trackSeoEvent("seo_cta_clicked", { slug, placement: "studio_kit_zyvo" })}
              className={`group flex items-center justify-between gap-4 rounded-2xl border-2 border-dashed border-white/15 px-5 py-4 transition hover:border-lime-300/50 ${FOCUS}`}>
              <span className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 shrink-0 text-lime-300" aria-hidden="true" />
                <span><span className="block text-[15.5px] font-black text-white">No Studio? Make it in Zyvo</span><span className="text-[13.5px] text-white/55">One sentence in, the whole video out.</span></span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-lime-300 transition group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border-2 border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11.5px] font-black uppercase tracking-[0.14em] text-white/50">Free kit</p>
                <ul className="mt-2 space-y-1.5 text-[13.5px] text-white/70">{FREE_VS_FINISH.free.map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-white/50" aria-hidden="true" />{x}</li>)}</ul>
              </div>
              <div className="rounded-2xl border-2 border-lime-300/30 bg-lime-300/[0.05] p-4">
                <p className="text-[11.5px] font-black uppercase tracking-[0.14em] text-lime-300">Finish in Zyvo adds</p>
                <ul className="mt-2 space-y-1.5 text-[13.5px] text-lime-50/85">{FREE_VS_FINISH.finish.map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-lime-300" aria-hidden="true" />{x}</li>)}</ul>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2"><BeforeAfter /></div>
        </div>

        <div className="mt-10 grid gap-3 lg:grid-cols-2">
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

function Step({ n, icon, title, tag, text, children }) {
  const Icon = icon;
  return (
    <div className="flex gap-4 rounded-2xl border-2 border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-lime-300 text-[#11150D]">
        <Icon className="h-6 w-6" aria-hidden="true" />
        <span className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-[#0F1311] bg-white text-[12px] font-black text-[#11150D]">{n}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[16.5px] font-black text-white">{title}{tag && <span className="ml-2 rounded-md bg-white/10 px-1.5 py-0.5 align-middle text-[10.5px] font-black uppercase tracking-wide text-white/60">{tag}</span>}</p>
        <p className="mb-3 mt-0.5 text-[14px] leading-relaxed text-white/60">{text}</p>
        {children}
      </div>
    </div>
  );
}
