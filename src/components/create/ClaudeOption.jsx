import { useEffect, useState } from "react";
import { Check, CheckCircle2, Copy, ExternalLink, Loader2 } from "lucide-react";
import { FINISH_CREDITS, voiceCredits } from "../../../supabase/functions/_shared/zyvoMcp/config.js";
import { MCP_URL } from "../../data/studioKit";
import { totalSeconds } from "../../data/styles";
import { connector } from "../../lib/zyvoConnector";
import { markSent } from "../../lib/director";
import { claudePrompt } from "../../lib/directorHandoff";
import { trackCreate } from "./useCatalog";

// Claude's "add custom connector" screen with Zyvo filled in. NOT VERIFIED (our browser tool may not open Claude's
// settings): the 3 steps below always show, so the panel works whether or not Claude reads these fields.
const CLAUDE_ADD_CONNECTOR = `https://claude.ai/customize/connectors?modal=add_custom_connector&connectorName=Zyvo&connectorUrl=${encodeURIComponent(MCP_URL)}`;
const CLAUDE_NEW_CHAT = "https://claude.ai/new";
const CONNECTED_KEY = "zyvo:claude-connected-tracked";


function useCopy() {
  const [copied, setCopied] = useState(null);
  const copy = async (key, text) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); return true; } catch { return false; }
  };
  return [copied, copy];
}

/** one-time "Connect Zyvo to Claude" (3 short steps); turns into a tick once the account has a Claude connection */
export function ConnectPanel({ onConnected }) {
  const [state, setState] = useState("loading"); // loading | connected | setup
  const [copied, copy] = useCopy();
  const check = async () => {
    setState("loading");
    try {
      const r = await connector("/account/connections");
      const on = (r.connections ?? []).length > 0;
      setState(on ? "connected" : "setup");
      if (on) {
        onConnected?.();
        try { if (!localStorage.getItem(CONNECTED_KEY)) { localStorage.setItem(CONNECTED_KEY, "1"); trackCreate("claude_connected", { placement: "make_choice" }); } } catch { /* ignore */ }
      }
    } catch { setState("setup"); }
  };
  useEffect(() => { check(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (state === "loading") return <div className="mt-3 flex items-center gap-2 text-[13px] text-white/50"><Loader2 className="h-4 w-4 animate-spin" />Checking your Claude connection…</div>;
  if (state === "connected") return <p className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-lime-200"><CheckCircle2 className="h-4 w-4" />Zyvo is connected to your Claude</p>;
  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3" data-testid="connect-panel">
      <p className="text-[14px] font-bold text-white">Connect Zyvo to Claude (one time)</p>
      <ol className="mt-2 space-y-2.5 text-[13px] text-white/75">
        <li>
          <span className="font-semibold text-white">1.</span> Copy the Zyvo link:
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-white/[0.06] px-2 py-1.5 text-[12px] text-white/85">{MCP_URL}</code>
            <button type="button" onClick={() => copy("url", MCP_URL)} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/[0.1] px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-white/[0.16]">
              {copied === "url" ? <Check className="h-3.5 w-3.5 text-lime-300" /> : <Copy className="h-3.5 w-3.5" />}{copied === "url" ? "Copied" : "Copy link"}
            </button>
          </div>
        </li>
        <li>
          <span className="font-semibold text-white">2.</span> In Claude, open Settings, then Connectors, then "Add custom connector". Name it Zyvo and paste the link.
          <a href={CLAUDE_ADD_CONNECTOR} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 rounded-lg bg-white/[0.1] px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-white/[0.16]"><ExternalLink className="h-3.5 w-3.5" />Open Claude's connector page</a>
        </li>
        <li><span className="font-semibold text-white">3.</span> Press Connect, sign in to Zyvo, and press Allow.</li>
      </ol>
      <button type="button" onClick={check} className="mt-3 text-[12px] font-semibold text-lime-200 hover:underline">I've connected it, check again</button>
    </div>
  );
}

/** "Make it with your Claude": the user's own Claude builds it; Zyvo only charges for the voice and the finish */
export default function ClaudeOption({ draft, style, plan }) {
  const [copied, copy] = useCopy();
  const seconds = totalSeconds(draft) || draft.length_sec;
  const credits = voiceCredits(seconds) + FINISH_CREDITS;
  const left = plan?.claudeVideosLeft;
  const blockedPaid = style.tier === "paid" && plan && !plan.paid;
  const blockedLimit = left === 0;
  const roblox = Boolean(style.claude?.kit);

  const copyPrompt = async () => {
    if (!(await copy("prompt", claudePrompt(draft, style)))) return;
    trackCreate("video_started", { style: style.id, where: "claude", target: "claude" });
    markSent(draft.id, "claude").catch(() => {});
  };

  return (
    <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-testid="choice-claude">
      <p className="text-[17px] font-black text-white">Make it with your Claude</p>
      <p className="mt-1 text-[14px] text-white/65">Your own Claude builds the animation. Zyvo adds the voice, captions, sound and music.</p>
      {style.claude?.honest && <p className="mt-2 rounded-lg bg-amber-300/[0.08] px-2.5 py-2 text-[13px] text-amber-100">{style.claude.honest}</p>}
      {(style.claude?.sample) && (
        <div className="mt-2 flex items-center gap-3">
          <video src={style.claude.sample} muted loop autoPlay playsInline className="h-24 w-[54px] shrink-0 rounded-lg bg-black object-cover" />
          <p className="text-[12px] text-white/50">A video made this way.</p>
        </div>
      )}
      <p className="mt-3 text-[14px] text-white/80">about <span className="font-bold text-white">{credits}</span> credits <span className="text-white/50">(voice + finishing only)</span></p>
      <p className="mt-1 text-[12px] text-white/45">
        {plan?.paid ? "Included with your plan." : left != null ? `Free plan: ${left} of ${plan.claudeFreePerMonth ?? 2} left this month.` : "Free plan: 2 a month."}
        {roblox ? " Needs Claude Code and Roblox Studio on a computer." : " Works in the Claude app or Claude Code."}
      </p>

      {blockedPaid || blockedLimit ? (
        <a href="/pricing" className="mt-4 inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 text-[15px] font-black text-black">
          {blockedPaid ? "This template needs a paid plan" : "You've used this month's 2. Upgrade for more"}
        </a>
      ) : (
        <>
          <ConnectPanel />
          {copied === "prompt" ? (
            <div className="mt-4 rounded-xl border border-lime-300/30 bg-lime-300/[0.08] p-3" data-testid="prompt-copied" aria-live="polite">
              <p className="flex items-center gap-2 text-[14px] font-bold text-lime-200"><Check className="h-4 w-4" />Prompt copied, now paste it into a new Claude chat</p>
              <p className="mt-1 break-words text-[12px] text-white/60">{claudePrompt(draft, style)}</p>
              <a href={CLAUDE_NEW_CHAT} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-lime-300 px-3 py-2 text-[13px] font-bold text-[#11150D]"><ExternalLink className="h-4 w-4" />Open a new Claude chat</a>
            </div>
          ) : (
            <button type="button" onClick={copyPrompt} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-[15px] font-black text-black hover:bg-white/90" data-testid="copy-claude-prompt">
              <Copy className="h-4 w-4" />Copy prompt for Claude
            </button>
          )}
        </>
      )}
    </div>
  );
}
