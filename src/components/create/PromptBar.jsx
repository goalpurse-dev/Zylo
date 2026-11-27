import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ImagePlus, Loader2, SlidersHorizontal, Sparkles, X } from "lucide-react";
import AuthModal from "../AuthModal";
import { useAuth } from "../../context/AuthContext";
import { clearPendingPrompt, peekPendingPrompt } from "../../lib/pendingPrompt";
import { creditsFor, directorPath, snapLength, styleById, studioById, variantOf, DIRECTOR_LIMITS } from "../../data/styles";
import { FINISH_CREDITS, voiceCredits } from "../../../supabase/functions/_shared/zyvoMcp/config.js";
import { DIRECTOR_MOCK, planVideo } from "../../lib/director";
import { trackCreate, useVisibleStyles } from "./useCatalog";
import { ReferenceImages, ReferenceVideoPanel } from "../reference/ReferenceInputs";
import { useReferenceScan } from "../reference/useReferenceScan";
import { REFERENCE_UI } from "../../lib/references";

const NO_IDEAS = [];
// with no template picked: general ideas (owner 2026-11-26), not one template's
const GENERAL_IDEAS = ["A kid who grows taller every time he laughs", "How a submarine dives and comes back up", "Why the Roman Empire fell, in one minute"];
const FORMAT_LABEL = { "9:16": "Tall 9:16", "16:9": "Wide 16:9" };
const lengthLabel = (s) => (s < 60 ? `${s}s` : `${s / 60} min`);
const stateKey = (studioId) => `zyvo:create-bar:${studioId ?? "hub"}`;

function readSaved(studioId) {
  try { return JSON.parse(sessionStorage.getItem(stateKey(studioId)) ?? "null"); } catch { return null; }
}

/**
 * THE PROMPT BAR (one for every studio): the picked template as a chip, a text box that grows, 3 example ideas, length +
 * format as small visible pickers, add-chips for a reference image / a script to copy the style of / things to avoid,
 * the live credit estimate and "Plan my video". Pinned to the bottom (above the mobile bottom nav).
 * The parent can call ref.useStyle(id) ("Use this template" in the preview popup): chip set, placeholder = its hook,
 * the text box focused.
 */
const PromptBar = forwardRef(function PromptBar({ studioId, onPickTemplate, slim = false }, ref) {
  const studio = studioById(studioId) ?? studioById("short-form");
  const navigate = useNavigate();
  const { user } = useAuth() ?? {};
  const visible = useVisibleStyles();
  const saved = useMemo(() => readSaved(studioId), [studioId]);
  const [styleId, setStyleId] = useState(saved?.styleId ?? null);
  const location = useLocation();
  // Home hands over its text in the navigation state (the hero's Create tab)
  const [idea, setIdea] = useState(location.state?.idea ?? (peekPendingPrompt("create") || saved?.idea) ?? "");
  useEffect(() => { if (user) clearPendingPrompt("create"); }, [user]);
  const [lengthSec, setLengthSec] = useState(saved?.lengthSec ?? studio.defaultLength);
  const [format, setFormat] = useState(saved?.format ?? studio.format);
  const [copyScript, setCopyScript] = useState(saved?.copyScript ?? "");
  const [avoid, setAvoid] = useState(saved?.avoid ?? "");
  // reference images (up to 6, each with a role) and one reference video, scanned like a director (owner 2026-11-26)
  const [refImages, setRefImages] = useState(saved?.refImages ?? (saved?.refImage ? [{ ...saved.refImage, role: "style" }] : []));
  const rs = useReferenceScan("create");
  const [open, setOpen] = useState({ copy: Boolean(saved?.copyScript), avoid: Boolean(saved?.avoid), video: false, images: Boolean(saved?.refImages?.length) });
  const [busy, setBusy] = useState(null); // null | "plan" | "upload"
  const [error, setError] = useState(null);
  const [signIn, setSignIn] = useState(false);
  const [more, setMore] = useState(false); // phones: length, format and the add-chips fold away until asked for
  const [variantId, setVariantId] = useState(saved?.variantId ?? null);
  const [where, setWhere] = useState(saved?.where === "claude" ? "claude" : "zyvo"); // where it gets made
  const box = useRef(null);

  const style = styleId ? styleById(styleId) : null;
  const variant = variantOf(style, variantId);
  const canClaude = Boolean(style?.worksInClaude);
  const inClaude = where === "claude" && (canClaude || !style);
  const ideas = variant?.ideas ?? style?.ideas ?? NO_IDEAS;
  const styleVisible = style && visible.some((s) => s.id === style.id);
  const lengthChoices = useMemo(() => {
    const ls = style ? studio.lengths.filter((l) => style.lengths.includes(l)) : studio.lengths;
    return ls.length ? ls : style?.lengths ?? studio.lengths;
  }, [style, studio]);
  const formats = useMemo(() => (style ? style.formats : [studio.format]), [style, studio]);
  // the estimate follows the switch: on Zyvo the whole video, with your Claude only the voice + finishing
  const credits = !style ? null : inClaude ? voiceCredits(lengthSec) + FINISH_CREDITS : creditsFor(style, lengthSec);

  // keep length + format valid for the picked template
  useEffect(() => { if (style && !lengthChoices.includes(lengthSec)) setLengthSec(snapLength({ lengths: lengthChoices }, lengthSec)); }, [style, lengthChoices, lengthSec]);
  useEffect(() => { if (style && !formats.includes(format)) setFormat(formats.includes(studio.format) ? studio.format : formats[0]); }, [style, formats, format, studio.format]);
  // the bar survives a sign-in (and a reload) in this tab
  useEffect(() => {
    try { sessionStorage.setItem(stateKey(studioId), JSON.stringify({ styleId, variantId, where, idea, lengthSec, format, copyScript, avoid, refImages: refImages.map((x) => ({ path: x.path, name: x.name, role: x.role })) })); } catch { /* private mode */ }
  }, [studioId, styleId, variantId, where, idea, lengthSec, format, copyScript, avoid, refImages]);
  // the text box grows with the text (never cut off; it scrolls only past 40% of the screen)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    // never below its min height (2 lines, or 1 in the slim bar): an empty box must always be visible
    el.style.height = `${Math.max(el.rows > 1 ? 52 : 44, Math.min(el.scrollHeight, Math.round(window.innerHeight * 0.4)))}px`;
  }, [idea]);

  useImperativeHandle(ref, () => ({
    useStyle(id, vId = null) {
      setStyleId(id);
      setVariantId(vId);
      setError(null);
      trackCreate("style_selected", { style: id, studio: studioId, placement: "preview_popup", variant: vId });
      requestAnimationFrame(() => box.current?.focus());
    },
  }), [studioId]);

  const pickIdea = (text) => { setIdea(text); requestAnimationFrame(() => box.current?.focus()); };

  // the reference inputs need an account (the files are the user's own)
  const openRef = (which) => { if (!user && !DIRECTOR_MOCK) { setSignIn(true); return; } setOpen((o) => ({ ...o, [which]: true })); };

  const plan = async () => {
    setError(null);
    if (!style) { setError("Pick a template first."); onPickTemplate?.(); return; }
    if (idea.trim().length < 3) { setError("Write your idea in a few words."); box.current?.focus(); return; }
    if (!user && !DIRECTOR_MOCK) { setSignIn(true); return; }
    setBusy("plan");
    try {
      // the first Style image is also the plan's one look image (as before); every image goes with its role
      const lookImage = refImages.find((x) => x.role === "style") ?? null;
      const extras = {
        where: inClaude ? "claude" : "zyvo",
        ...(lookImage ? { reference_image: lookImage.path } : {}),
        ...(refImages.length ? { reference_images: refImages.map(({ path, role }) => ({ path, role })) } : {}),
        ...(rs.ready ? { reference: rs.ready } : {}),
        ...(copyScript.trim() ? { copy_script: copyScript.trim() } : {}), ...(avoid.trim() ? { avoid: avoid.trim() } : {}),
      };
      const r = await planVideo({ styleId: style.id, variantId: variant?.id ?? null, studioId, idea: idea.trim(), lengthSec, format, extras });
      trackCreate("plan_created", { style: style.id, studio: studioId, length: lengthSec, format, where: extras.where, variant: variant?.id ?? null });
      try { sessionStorage.removeItem(stateKey(studioId)); } catch { /* ignore */ }
      navigate(directorPath(r.draft.id));
    } catch (e) {
      setError(e.code === "DAILY_LIMIT" ? e.message : e.code === "SIGN_IN" ? "Sign in to plan a video." : e.message || "Planning didn't work. Try again.");
    } finally { setBusy(null); }
  };

  // the placeholder (owner 2026-11-26): no template = "Describe your video idea" + general examples; a template = its hook
  const placeholder = style ? style.hook : "Describe your video idea";
  const examples = style && styleVisible ? ideas : GENERAL_IDEAS;
  // the slim bar (the Create hub): just the text box + the button, until a template is picked or the box is used
  const [opened, setOpened] = useState(false);
  const compact = slim && !style && !opened && !idea;
  const planButton = (
    <button type="button" onClick={plan} disabled={busy === "plan"} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-lime-300 px-4 py-2.5 text-[14px] font-bold text-[#11150D] shadow-[0_0_24px_rgba(190,242,100,.25)] transition hover:bg-lime-200 active:scale-[.98] disabled:opacity-70" data-testid="plan-my-video">
      {busy === "plan" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {busy === "plan" ? "Planning…" : "Plan my video"}
    </button>
  );

  return (
    <div className="sticky bottom-[calc(78px+env(safe-area-inset-bottom))] z-40 mt-6 px-3 pb-3 lg:bottom-0 lg:px-6 lg:pb-5" data-testid="prompt-bar">
      <div className={`mx-auto w-full max-w-[860px] rounded-[22px] border border-white/[0.1] bg-[#141618]/95 shadow-[0_-12px_50px_rgba(0,0,0,.55)] backdrop-blur-md ${compact ? "p-2" : "p-3"}`}>
        {!compact && (
          <>
            {/* the template chip, and where it gets made (picked first, so the price below is the real one) */}
            <div className="flex flex-wrap items-center gap-2">
              {style && styleVisible ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-lime-300/35 bg-lime-300/[0.08] py-1 pl-1 pr-2 text-[13px] font-semibold text-lime-200" data-testid="style-chip">
                  <img src={variant?.poster ?? style.poster} alt="" className="h-6 w-6 rounded-full object-cover" />
                  {style.name}{variant ? <span className="text-lime-200/60">· {variant.name}</span> : null}
                  <button type="button" onClick={() => { setStyleId(null); setVariantId(null); }} className="ml-0.5 inline-flex items-center gap-1 rounded-full px-1 text-white/60 hover:text-white" aria-label={`Remove ${style.name}`}>
                    <X className="h-3.5 w-3.5" /><span className="sr-only">Remove</span>
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => onPickTemplate?.()} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-white/25 px-3 py-1 text-[13px] font-semibold text-white/80 hover:border-lime-300/50 hover:text-lime-200">
                  <Sparkles className="h-3.5 w-3.5" /> Pick a template
                </button>
              )}
              <div className="ml-auto flex items-center gap-0.5 rounded-full bg-white/[0.05] p-0.5" role="radiogroup" aria-label="Where should we make it?" data-testid="where-switch">
                <button type="button" role="radio" aria-checked={!inClaude} onClick={() => setWhere("zyvo")}
                  className={`rounded-full px-2.5 py-1 text-[12px] font-bold transition ${!inClaude ? "bg-white text-black" : "text-white/70 hover:text-white"}`}>
                  On Zyvo
                </button>
                <button type="button" role="radio" aria-checked={inClaude} disabled={Boolean(style) && !canClaude} onClick={() => setWhere("claude")}
                  title={style && !canClaude ? `${style.name} is made on Zyvo only` : "Your own Claude builds it; you only pay for the voice and finishing"}
                  className={`rounded-full px-2.5 py-1 text-[12px] font-bold transition disabled:cursor-not-allowed disabled:opacity-35 ${inClaude ? "bg-[#D97757] text-white" : "text-white/70 hover:text-white"}`}>
                  With your Claude
                </button>
              </div>
            </div>
            {/* example ideas: the template's, or general ones; one row that scrolls sideways */}
            <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
              {examples.map((t) => (
                <button key={t} type="button" onClick={() => pickIdea(t)} className="shrink-0 rounded-full bg-white/[0.06] px-3 py-1 text-[12px] text-white/80 hover:bg-white/[0.12] hover:text-white" title={t}>
                  {t}
                </button>
              ))}
            </div>
          </>
        )}

        {/* the text box (always the same element, so it keeps focus when the bar opens) */}
        <div className={`flex items-end gap-2 ${compact ? "" : "mt-2"}`}>
          <label className="sr-only" htmlFor="create-idea">Your video idea</label>
          <textarea
            id="create-idea" ref={box} rows={compact ? 1 : 2} value={idea} maxLength={DIRECTOR_LIMITS.ideaMax}
            onChange={(e) => setIdea(e.target.value)}
            onFocus={() => setOpened(true)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) plan(); }}
            placeholder={placeholder}
            className={`w-full flex-1 resize-none overflow-y-auto bg-transparent px-2 text-[16px] leading-6 text-white placeholder:text-white/45 focus:outline-none ${compact ? "min-h-[44px] py-2.5" : "min-h-[52px] py-0.5"}`}
          />
          {compact && planButton}
        </div>

        {!compact && (
          <>
            {/* the extras live behind Options on every screen */}
            {more && (
              <div className="mt-2 flex flex-wrap gap-2">
                {REFERENCE_UI && !open.video && <button type="button" onClick={() => openRef("video")} className="rounded-full border border-lime-300/30 px-3 py-1 text-[12px] font-semibold text-lime-200 hover:border-lime-300/60" data-testid="add-reference-video">+ Reference video</button>}
                {REFERENCE_UI && !open.images && <button type="button" onClick={() => openRef("images")} className="rounded-full border border-white/15 px-3 py-1 text-[12px] font-medium text-white/80 hover:border-white/30 hover:text-white">+ Reference images</button>}
                {!open.copy && <button type="button" onClick={() => setOpen((o) => ({ ...o, copy: true }))} className="rounded-full border border-white/15 px-3 py-1 text-[12px] font-medium text-white/80 hover:border-white/30 hover:text-white">+ Script to copy the style of</button>}
                {!open.avoid && <button type="button" onClick={() => setOpen((o) => ({ ...o, avoid: true }))} className="rounded-full border border-white/15 px-3 py-1 text-[12px] font-medium text-white/80 hover:border-white/30 hover:text-white">+ Things to avoid</button>}
              </div>
            )}
            {open.video && <ReferenceVideoPanel rs={rs} onClose={() => setOpen((o) => ({ ...o, video: false }))} />}
            {open.images && <ReferenceImages images={refImages} onChange={(next) => { setRefImages(next); if (!next.length) setOpen((o) => ({ ...o, images: false })); }} />}
            {open.copy && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-[12px] text-white/65"><span>Paste a script. We copy its style, not its words.</span><button type="button" onClick={() => { setCopyScript(""); setOpen((o) => ({ ...o, copy: false })); }} className="text-white/60 hover:text-white">Remove</button></div>
                <textarea autoFocus rows={3} value={copyScript} maxLength={DIRECTOR_LIMITS.copyScriptMax} onChange={(e) => setCopyScript(e.target.value)} className="mt-1 min-h-[72px] w-full rounded-xl border border-white/10 bg-black/30 p-2 text-[14px] text-white focus:border-lime-300/40 focus:outline-none" />
              </div>
            )}
            {open.avoid && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-[12px] text-white/65"><span>Things to avoid</span><button type="button" onClick={() => { setAvoid(""); setOpen((o) => ({ ...o, avoid: false })); }} className="text-white/60 hover:text-white">Remove</button></div>
                <input autoFocus value={avoid} maxLength={DIRECTOR_LIMITS.avoidMax} onChange={(e) => setAvoid(e.target.value)} placeholder="e.g. no spiders, no sad ending" className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 p-2 text-[14px] text-white placeholder:text-white/40 focus:border-lime-300/40 focus:outline-none" />
              </div>
            )}

            {/* Options (length, format, the extras), the price, the button */}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.07] px-2.5 py-1.5 text-[12px] font-semibold text-white/85 hover:bg-white/[0.12]" data-testid="bar-options">
                <SlidersHorizontal className="h-3.5 w-3.5" />{more ? "Hide options" : "Options"}<span className="text-white/55">· {lengthLabel(lengthSec)} · {FORMAT_LABEL[format]}</span>
              </button>
              {more && (
                <>
                  <div className="flex items-center gap-1" role="group" aria-label="Length">
                    <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-white/55">Length</span>
                    {lengthChoices.length > 1 ? lengthChoices.map((l) => (
                      <button key={l} type="button" onClick={() => setLengthSec(l)} aria-pressed={l === lengthSec} className={`rounded-lg px-2 py-1 text-[12px] font-semibold ${l === lengthSec ? "bg-white text-black" : "bg-white/[0.06] text-white/80 hover:bg-white/[0.12]"}`}>{lengthLabel(l)}</button>
                    )) : <span className="rounded-lg bg-white/[0.06] px-2 py-1 text-[12px] font-semibold text-white/85">{lengthLabel(lengthChoices[0])}</span>}
                  </div>
                  <div className="flex items-center gap-1" role="group" aria-label="Format">
                    <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-white/55">Format</span>
                    {formats.length > 1 ? formats.map((fm) => (
                      <button key={fm} type="button" onClick={() => setFormat(fm)} aria-pressed={fm === format} className={`rounded-lg px-2 py-1 text-[12px] font-semibold ${fm === format ? "bg-white text-black" : "bg-white/[0.06] text-white/80 hover:bg-white/[0.12]"}`}>{FORMAT_LABEL[fm]}</button>
                    )) : <span className="rounded-lg bg-white/[0.06] px-2 py-1 text-[12px] font-semibold text-white/85">{FORMAT_LABEL[formats[0]]}</span>}
                  </div>
                </>
              )}
              <div className="ml-auto flex items-center gap-3">
                {credits != null && <span className="text-[13px] text-white/75" data-testid="credit-estimate">about {credits} credits{inClaude ? <span className="hidden sm:inline"> (voice + finishing)</span> : null}</span>}
                {planButton}
              </div>
            </div>
          </>
        )}
        {error && <p className="mt-2 px-1 text-[13px] text-rose-300" role="alert">{error}</p>}
      </div>
      {signIn && <AuthModal mode="signup" title="Plan your video" subtitle="A free Zyvo account is all you need to plan." returnTo={typeof window !== "undefined" ? window.location.pathname : "/create"} onClose={() => setSignIn(false)} />}
    </div>
  );
});

export default PromptBar;
