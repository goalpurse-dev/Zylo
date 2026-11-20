// Small shared pieces of the Studio Kit pages (Connect Claude, the consent screen, Studio projects, the In This Town
// section): the TEST MODE banner of ?mock=1, a copy field, the "is it open for me" hook. In This Town's look: lime on
// near-black, Barlow Condensed headings.
import { useState } from "react";
import { Check, Copy, FlaskConical } from "lucide-react";
import { CONNECTOR_MOCK } from "../../lib/zyvoConnector";
import { FOCUS } from "./studioKitShared";

/** Local dev with ?mock=1 only: impossible to miss, so sample cards are never mistaken for real ones. */
export function MockBanner() {
  if (!CONNECTOR_MOCK) return null;
  return (
    <div role="status" className="flex w-full items-center justify-center gap-2 bg-amber-400 px-4 py-2.5 text-center text-[13px] font-black leading-snug text-[#1a1200]">
      <FlaskConical className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>TEST MODE: sample projects and connections, nothing is called or charged. Remove ?mock=1 for the real thing.</span>
    </div>
  );
}

/** A one-line value with a Copy button (the connector address, the Claude Code command). */
export function CopyField({ value, label }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { /* the text stays selectable */ }
  };
  return (
    <div className="flex min-w-0 items-stretch overflow-hidden rounded-xl border border-white/15 bg-black/40">
      <code className="min-w-0 flex-1 select-all break-all px-3 py-2.5 font-mono text-[13px] leading-relaxed text-lime-100" aria-label={label}>{value}</code>
      <button type="button" onClick={copy} className={`flex shrink-0 items-center gap-1.5 border-l border-white/15 px-3 text-[13px] font-bold text-white transition hover:bg-white/10 ${FOCUS}`}>
        {copied ? <Check className="h-4 w-4 text-lime-300" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
