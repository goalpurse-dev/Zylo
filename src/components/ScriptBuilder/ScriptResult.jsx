import { useState, Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import ScriptFeedback from "./ScriptFeedback";
import { SCRIPT_STYLES } from "../../lib/scriptTemplates";

const HowToWriteAViralScript = lazy(() => import("../../pages/help/blog/HowToWriteAViralScript.jsx"));
const ViralScriptStyles       = lazy(() => import("../../pages/help/blog/ViralScriptStyles.jsx"));

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button
      onClick={copy}
      className={`text-[10px] px-2 py-0.5 rounded-md transition-all font-medium ${
        copied
          ? "bg-green-500/15 text-green-400 border border-green-500/20"
          : "bg-white/[0.05] text-white/30 border border-white/[0.07] hover:text-white/60 hover:bg-white/[0.08]"
      }`}
    >
      {copied ? "✓ copied" : "copy"}
    </button>
  );
}

const GUIDES = [
  { id: "how-to-write", label: "How to write a viral script", Component: HowToWriteAViralScript },
  { id: "styles",       label: "The 8 creator script styles explained", Component: ViralScriptStyles },
];

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function useCopy(text, ms = 1600) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), ms);
  };
  return [copied, copy];
}

function buildFullScriptText(script) {
  if (!script) return "";
  let out = `=== ${script.meta?.type} — ${script.meta?.platform} ===\n`;
  out += `Duration: ${script.meta?.duration} | Style: ${script.meta?.style}\n\n`;

  const sections = [script.hook, ...(script.scenes || []), script.cta].filter(Boolean);
  sections.forEach((s) => {
    out += `[${s.label}${s.title ? ` — ${s.title}` : ""} | ${s.duration}]\n`;
    out += `${s.text}\n`;
    if (s.imagePrompt) out += `\n  📸 IMAGE PROMPT:\n  ${s.imagePrompt}\n`;
    if (s.videoPrompt) out += `\n  🎬 VIDEO PROMPT:\n  ${s.videoPrompt}\n`;
    out += "\n";
  });
  return out;
}

// ─── Prompt block — copyable text in a code-like container ───────────────────
function PromptBlock({ icon, label, text, linkLabel, linkTo }) {
  const [copied, copy] = useCopy(text);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/55 font-semibold uppercase tracking-widest flex items-center gap-1.5">
          <span>{icon}</span>{label}
        </span>
        <button
          onClick={copy}
          className={`text-[10px] px-2 py-0.5 rounded-md transition-all font-medium ${
            copied
              ? "bg-green-500/15 text-green-400 border border-green-500/20"
              : "bg-white/[0.07] text-white/55 border border-white/[0.10] hover:text-white/80 hover:bg-white/[0.10]"
          }`}
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <div className="relative group bg-[#060810] border border-white/[0.07] rounded-xl px-4 py-3">
        <p className="text-white/75 text-xs leading-relaxed font-mono">{text}</p>
        {linkTo && (
          <Link to={linkTo}
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#7A3BFF] hover:text-[#A078FF] transition-colors font-medium">
            {linkLabel} →
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Single scene card ────────────────────────────────────────────────────────
function SceneCard({ section, index }) {
  const [scriptCopied, copyScript] = useCopy(section.text);
  const [open, setOpen] = useState(false);

  const isHook = section.label === "HOOK";
  const isCta  = section.label === "CALL TO ACTION";

  const accentColor = isHook ? "#7A3BFF" : isCta ? "#10B981" : "rgba(255,255,255,0.12)";
  const imgLink = section.imagePrompt
    ? `/workspace/image-generator?prompt=${encodeURIComponent(section.imagePrompt)}`
    : null;
  const vidLink = section.videoPrompt
    ? `/workspace/video-generator?prompt=${encodeURIComponent(section.videoPrompt)}`
    : null;

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor }} />
          <span className="text-[10px] font-bold tracking-[0.1em] text-white/65 uppercase">{section.label}</span>
          {section.title && (
            <span className="text-white/80 text-xs font-medium">{section.title}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {section.duration && (
            <span className="text-[10px] text-white/50 font-mono bg-white/[0.07] px-2 py-0.5 rounded-md">
              {section.duration}
            </span>
          )}
        </div>
      </div>

      {/* Script text */}
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-white/80 text-sm leading-relaxed flex-1">{section.text}</p>
          <button
            onClick={copyScript}
            className={`shrink-0 text-[10px] px-2 py-1 rounded-lg transition-all font-medium mt-0.5 ${
              scriptCopied
                ? "bg-green-500/15 text-green-400 border border-green-500/20"
                : "bg-white/[0.07] text-white/55 border border-white/[0.10] hover:text-white/80 hover:bg-white/[0.10]"
            }`}
          >
            {scriptCopied ? "✓" : "copy"}
          </button>
        </div>
      </div>

      {/* Media prompts toggle */}
      {(section.imagePrompt || section.videoPrompt) && (
        <div className="border-t border-white/[0.05] px-4 py-3">
          <button
            onClick={() => setOpen((v) => !v)}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all duration-200 ${
              open
                ? "bg-[#7A3BFF]/15 border-[#7A3BFF]/40 text-white/85"
                : "bg-white/[0.06] border-white/[0.12] text-white/65 hover:bg-[#7A3BFF]/[0.12] hover:border-[#7A3BFF]/35 hover:text-white/85"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-sm">🎨</span>
              <span className="text-xs font-semibold">
                {open ? "Hide media prompts" : "View image & video prompts"}
              </span>
              <div className="flex items-center gap-1">
                {section.imagePrompt && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300/80 font-medium">IMG</span>
                )}
                {section.videoPrompt && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300/70 font-medium">VID</span>
                )}
              </div>
            </div>
            <span className={`text-[11px] transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▾</span>
          </button>

          {open && (
            <div className="mt-3 space-y-4 animate-fadeIn">
              {section.imagePrompt && (
                <PromptBlock
                  icon="🖼"
                  label="Image Prompt"
                  text={section.imagePrompt}
                  linkLabel="Generate image"
                  linkTo={imgLink}
                />
              )}
              {section.videoPrompt && (
                <PromptBlock
                  icon="🎬"
                  label="Video Prompt"
                  text={section.videoPrompt}
                  linkLabel="Generate video"
                  linkTo={vidLink}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── History card ─────────────────────────────────────────────────────────────
function HistoryCard({ entry, onView, onDelete }) {
  const style = SCRIPT_STYLES.find((s) => s.name === entry.preset);
  return (
    <div className="group rounded-xl border border-white/[0.07] bg-white/[0.025] hover:bg-[#7A3BFF]/[0.05] hover:border-[#7A3BFF]/20 transition-all p-3 flex items-start justify-between gap-3">
      <button className="flex-1 text-left min-w-0" onClick={() => onView(entry)}>
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <div className="h-6 w-6 rounded-md flex items-center justify-center text-sm overflow-hidden shrink-0"
            style={style ? { background: `${style.accentColor}18`, border: `1px solid ${style.accentColor}30` } : { border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {entry.presetIcon?.startsWith("http")
              ? <img src={entry.presetIcon} alt={entry.preset} className="w-full h-full object-cover" />
              : style?.previewImage
                ? <img src={style.previewImage} alt={entry.preset} className="w-full h-full object-cover" />
                : <span className="text-xs">{style?.icon || entry.presetIcon}</span>}
          </div>
          <span className="text-white/80 text-xs font-medium">{entry.preset}</span>
          {entry.platform && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.08] text-white/55 border border-white/[0.10]">
              {entry.platform}
            </span>
          )}
          <span className="text-white/40 text-[10px] ml-auto shrink-0">{timeAgo(entry.createdAt)}</span>
        </div>
        <p className="text-white/55 text-xs leading-snug line-clamp-2">{entry.idea || "No description"}</p>
      </button>
      <button onClick={() => onDelete(entry.id)}
        className="text-white/10 hover:text-red-400/60 transition-colors text-xs shrink-0 opacity-0 group-hover:opacity-100 mt-0.5">
        ✕
      </button>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function ScriptResult({ script, history, onViewHistory, onDeleteHistory, onGenerateAnother, bottomPad, userId, scriptId, imageResult, onUseImageIdea, onDiscardImageResult }) {
  const [copiedAll, setCopiedAll] = useState(false);
  const [altHooksOpen, setAltHooksOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [openGuide, setOpenGuide] = useState(null); // guide id or null

  const handleCopyAll = () => {
    navigator.clipboard.writeText(buildFullScriptText(script)).catch(() => {});
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1800);
  };

  const handleDownload = () => {
    const text = buildFullScriptText(script);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `script-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!script) {
    return (
      <div className="h-full flex flex-col overflow-y-auto bg-[#111314]">

        {/* ── Image result card ── */}
        {imageResult && (
          <div className={`p-5 lg:p-6 ${bottomPad ? "pb-[90px]" : ""}`}>
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
              {/* Image */}
              {imageResult.imageUrl && (
                <div className="relative w-full bg-black" style={{ maxHeight: "200px", overflow: "hidden" }}>
                  <img src={imageResult.imageUrl} alt="Uploaded" className="w-full object-cover" style={{ maxHeight: "200px" }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>
              )}
              {/* Idea */}
              <div className="px-4 py-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#9B6DFF]">AI script idea</p>
                  <div className="flex items-center gap-2">
                    <CopyButton text={imageResult.idea} />
                    <button
                      onClick={onDiscardImageResult}
                      className="text-white/20 hover:text-white/50 text-xs transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <p className="text-white/80 text-[13px] leading-relaxed">"{imageResult.idea}"</p>
              </div>
            </div>
          </div>
        )}

        {history?.length > 0 ? (
          <div className={`p-5 lg:p-6 space-y-4 ${bottomPad ? "pb-[90px]" : ""}`}>
            <button onClick={() => setHistoryOpen((v) => !v)}
              className="flex items-center gap-2 text-white/60 text-xs font-semibold uppercase tracking-widest hover:text-white/80 transition-colors">
              Recent Scripts
              <span className="text-white/35 font-normal normal-case tracking-normal">({history.length})</span>
              <span className={`text-[10px] transition-transform duration-200 ${historyOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
            {historyOpen && (
              <div className="space-y-2">
                {history.map((e) => (
                  <HistoryCard key={e.id} entry={e} onView={onViewHistory} onDelete={onDeleteHistory} />
                ))}
              </div>
            )}
            <div className="pt-4 flex flex-col items-center gap-2 text-center">
              <div className="text-2xl opacity-50">📝</div>
              <p className="text-white/45 text-xs">New script will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 px-6">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/[0.12] flex items-center justify-center text-2xl">📝</div>
            <div className="space-y-1.5">
              <p className="text-white/70 text-sm font-medium">Your script will appear here</p>
              <p className="text-white/45 text-xs max-w-[220px] leading-relaxed">Choose a style on the left, answer a few questions, and hit generate.</p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-[260px]">
              {[["⚡", "Pick a style preset"], ["🎯", "Fill in the details"], ["✨", "Get your viral script"]].map(([icon, text], i) => (
                <div key={i} className="flex items-center gap-3 text-left px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.10]">
                  <span>{icon}</span>
                  <span className="text-white/60 text-xs">{text}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1.5 mt-2">
              {GUIDES.map((g) => (
                <button key={g.id} onClick={() => setOpenGuide(g.id)} className="text-left text-xs text-[#9B6DFF]/70 hover:text-[#9B6DFF] transition-colors">
                  {g.label} →
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Script output ────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto bg-[#111314]">
      <div className={`p-5 lg:p-6 space-y-4 ${bottomPad ? "pb-[90px]" : ""}`}>

        {/* Meta + actions */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-bold text-sm">{script.meta?.presetIcon} {script.meta?.preset}</span>
                {[script.meta?.type, script.meta?.platform, script.meta?.duration].filter(Boolean).map((tag, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.08] text-white/65 border border-white/[0.10] font-medium">{tag}</span>
                ))}
              </div>
              <div className="flex gap-3 mt-1.5 flex-wrap">
                {[script.meta?.style && `Style: ${script.meta.style}`, script.meta?.tone && `Tone: ${script.meta.tone}`, script.meta?.audience && `Audience: ${script.meta.audience}`]
                  .filter(Boolean).map((item, i) => (
                    <span key={i} className="text-[10px] text-white/45">{item}</span>
                  ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={handleCopyAll}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                  copiedAll
                    ? "bg-green-500/15 border-green-500/30 text-green-400"
                    : "bg-white/[0.06] border-white/[0.10] text-white/60 hover:text-white/85 hover:bg-white/[0.10]"
                }`}>
                {copiedAll ? "✓ copied" : "copy all"}
              </button>
              <button onClick={handleDownload}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.10] text-white/60 hover:text-white/85 hover:bg-white/[0.10] transition-all">
                ↓
              </button>
            </div>
          </div>
        </div>

        {/* Alternate hooks */}
        {script.alternateHooks?.length > 0 && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
            <button onClick={() => setAltHooksOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs text-white/65 hover:text-white/85 hover:bg-white/[0.03] transition-all">
              <span className="flex items-center gap-1.5 font-semibold">
                🔀 Alternate Hooks
                <span className="text-white/20 font-normal">({script.alternateHooks.length} variants)</span>
              </span>
              <span className={`text-[10px] transition-transform duration-200 ${altHooksOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
            {altHooksOpen && (
              <div className="px-4 pb-4 space-y-2">
                {script.alternateHooks.map((h, i) => {
                  const [copied, copy] = [false, () => navigator.clipboard.writeText(h)];
                  return (
                    <AltHookRow key={i} text={h} />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Hook */}
        {script.hook && <SceneCard section={script.hook} index={-1} />}

        {/* Scenes */}
        {script.scenes?.map((scene, i) => (
          <SceneCard key={i} section={scene} index={i} />
        ))}

        {/* CTA */}
        {script.cta && <SceneCard section={script.cta} index={-2} />}

        {/* Generate another */}
        {onGenerateAnother && (
          <button onClick={onGenerateAnother}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-[#7A3BFF]/25 bg-[#7A3BFF]/[0.06] text-[#9B6DFF] hover:bg-[#7A3BFF]/[0.12] hover:border-[#7A3BFF]/40 text-sm font-semibold transition-all hover:scale-[1.005] active:scale-[0.995]">
            ✨ Generate Another Script
          </button>
        )}

        {/* Inline guide reader */}
        {openGuide ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <button onClick={() => setOpenGuide(null)} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">
                ← Back
              </button>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Guide</span>
            </div>
            <div className="px-4 py-4 text-sm text-white/70 leading-relaxed prose-invert max-h-[480px] overflow-y-auto
              [&_h2]:text-white [&_h2]:font-bold [&_h2]:text-base [&_h2]:mt-5 [&_h2]:mb-2
              [&_h3]:text-white [&_h3]:font-semibold [&_h3]:text-sm [&_h3]:mt-4 [&_h3]:mb-1
              [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:pl-4 [&_li]:mb-1 [&_li]:list-disc [&_li]:list-outside
              [&_strong]:text-white [&_em]:text-white/60 [&_a]:text-[#9B6DFF] [&_a]:no-underline [&_a:hover]:text-[#B88FFF]">
              <Suspense fallback={<p className="text-white/30 text-xs">Loading…</p>}>
                {(() => { const g = GUIDES.find(g => g.id === openGuide); return g ? <g.Component /> : null; })()}
              </Suspense>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 flex flex-col gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Guides</p>
            {GUIDES.map((g) => (
              <button key={g.id} onClick={() => setOpenGuide(g.id)} className="text-left text-xs text-[#9B6DFF] hover:text-[#B88FFF] transition-colors">
                {g.label} →
              </button>
            ))}
          </div>
        )}

        {/* Feedback */}
        <ScriptFeedback userId={userId} scriptId={scriptId} />

        {/* History */}
        {history?.length > 1 && (
          <div className="pt-3 border-t border-white/[0.05]">
            <button onClick={() => setHistoryOpen((v) => !v)}
              className="flex items-center gap-2 text-white/20 text-xs font-semibold uppercase tracking-widest hover:text-white/45 transition-colors mb-3">
              Recent Scripts
              <span className="text-white/12 font-normal normal-case tracking-normal">({history.length})</span>
              <span className={`text-[10px] transition-transform duration-200 ${historyOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
            {historyOpen && (
              <div className="space-y-2">
                {history.map((e) => (
                  <HistoryCard key={e.id} entry={e} onView={onViewHistory} onDelete={onDeleteHistory} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Alternate hook row with its own copy state
function AltHookRow({ text }) {
  const [copied, copy] = useCopy(text);
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3 flex items-start justify-between gap-3">
      <p className="text-white/60 text-sm leading-relaxed flex-1">{text}</p>
      <button onClick={copy}
        className={`text-[10px] px-2 py-0.5 rounded-md transition-all font-medium shrink-0 mt-0.5 ${
          copied ? "bg-green-500/15 text-green-400 border border-green-500/20"
                 : "bg-white/[0.05] text-white/25 border border-white/[0.07] hover:text-white/55"
        }`}>
        {copied ? "✓" : "copy"}
      </button>
    </div>
  );
}
