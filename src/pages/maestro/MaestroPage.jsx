import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowUp, Coins, Loader2, MessageSquare, Paperclip, Plus, Trash2, X } from "lucide-react";
import { BreakdownCard, ScanProgress } from "../../components/reference/ReferenceInputs";
import { useReferenceScan } from "../../components/reference/useReferenceScan";
import { REFERENCE_MOCK, REFERENCE_UI, uploadReferenceImage } from "../../lib/references";
import { REFERENCE as REF_LIMITS, referenceLink } from "../../../supabase/functions/_shared/reference/breakdown.js";
import { useProfileCredits } from "../../hooks/useProfileCredits";
import { clearPendingPrompt, peekPendingPrompt } from "../../lib/pendingPrompt";
import AuthModal from "../../components/AuthModal";
import { useAuth } from "../../context/AuthContext";
import { MAESTRO_AVATAR } from "../../components/maestro/avatar";
import { MAESTRO_PATH, maestroChatPath, styleById } from "../../data/styles";
import { MAESTRO_MOCK, deleteChat, getChat, listChats, maestroStatus, sendToMaestro } from "../../lib/maestro";
import { useTypewriter } from "../../components/create/motion";
import { PageGlow } from "../../components/create/PageGlow";
import { useVisibleStyles, trackCreate } from "../../components/create/useCatalog";
import Markdown from "../../components/maestro/Markdown";
import { GenerateCard, PlanCard, QuickCard } from "../../components/maestro/MaestroCards";
import { CreditsCard, PlanOfferCard } from "../../components/maestro/MaestroSellCards";
import { suggestTemplates } from "../../components/maestro/suggest";
import { refreshMaestroChats } from "../../components/maestro/useMaestroChats";

const STARTS = [
  { label: "Suggest ideas for my next viral video", text: "Suggest ideas for my next viral video" },
  { label: "Make an In This Town story", text: "Make an In This Town story", templateId: "in-this-town" },
  { label: "Explain how something works in 3D", text: "I want a video that explains how something works", templateId: "cutaway-explainer" },
  { label: "Make a quick image", text: "Make me a quick image of " },
];
// owner 2026-11-26: the line the box types out
const PROMPT_LINES = ["In this town, every time you laugh you grow in size, crazy twist at the end", "Suggest ideas for my next viral video", "Make the hook better"];
const greeting = () => { const h = new Date().getHours(); return h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

/** the template tag in blue, like a slash command */
function TemplateTag({ id, onRemove }) {
  const s = styleById(id);
  if (!s) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-sky-400/15 px-2 py-0.5 font-mono text-[13px] font-semibold text-sky-300" data-testid="template-tag">
      /{s.id}
      {onRemove && <button type="button" onClick={onRemove} aria-label={`Remove ${s.name}`} className="inline-flex items-center text-sky-300/70 hover:text-sky-200"><X className="h-3.5 w-3.5" /></button>}
    </span>
  );
}

/** one Maestro answer; the newest one appears word by word */
function Answer({ m, reveal, onAsk, onShown }) {
  const [shown, setShown] = useState(reveal ? 0 : Infinity);
  const words = useMemo(() => String(m.text ?? "").split(/(\s+)/), [m.text]);
  useEffect(() => {
    if (!reveal) return undefined;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setShown(Infinity); return undefined; }
    const t = setInterval(() => setShown((n) => { if (n >= words.length) { clearInterval(t); return n; } return n + 2; }), 18);
    return () => clearInterval(t);
  }, [reveal, words.length]);
  const done = shown >= words.length;
  // the newest answer is fully shown (its cards too): follow it down
  useEffect(() => { if (reveal && done) onShown?.(); }, [reveal, done]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex items-start gap-3" data-role="assistant">
      <img src={MAESTRO_AVATAR} alt="Maestro" width="32" height="32" className="mt-0.5 h-8 w-8 shrink-0 rounded-full border border-violet-400/40 object-cover shadow-[0_0_18px_rgba(139,92,246,.25)]" />
      <div className="min-w-0 flex-1 pt-1 text-[15.5px] leading-relaxed text-white/90">
        <Markdown text={done ? m.text : words.slice(0, shown).join("")} />
        {done && (m.cards ?? []).map((c, i) => c.type === "plan" ? <PlanCard key={i} card={c} onAsk={onAsk} />
          : c.type === "generate" ? <GenerateCard key={i} card={c} />
          : c.type === "quick" ? <QuickCard key={i} card={c} cardKey={`${m.id}-${i}`} />
          : c.type === "reference" ? <div key={i} className="mt-3"><BreakdownCard card={c.card} copy={c.copy} /></div>
          : c.type === "plan_offer" ? <PlanOfferCard key={i} card={c} />
          : c.type === "credits" ? <CreditsCard key={i} card={c} /> : null)}
      </div>
    </div>
  );
}

export default function MaestroPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth() ?? {};
  const styles = useVisibleStyles();
  const [messages, setMessages] = useState([]);
  const [chat, setChat] = useState(null);
  const [chats, setChats] = useState([]);
  const location = useLocation();
  const credits = useProfileCredits();
  // Home's prompt box sends the text here, ready to send
  const [text, setText] = useState(() => String(location.state?.text ?? peekPendingPrompt("maestro")));
  // a guest's idea from Home waits through sign-up; once signed in it is in the box, so it can go
  useEffect(() => { if (user) clearPendingPrompt("maestro"); }, [user]);
  const [tag, setTag] = useState(null);
  const [sending, setSending] = useState(null); // the message being sent (shown as yours)
  const [error, setError] = useState(null);
  const [left, setLeft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const [newest, setNewest] = useState(null);
  const created = useRef(null); // a chat this page just created: don't reload it on the address change
  const box = useRef(null);
  const end = useRef(null);
  const signedIn = Boolean(user) || MAESTRO_MOCK;

  useEffect(() => { document.title = "Maestro | Zyvo"; document.getElementById("workspace-scroll")?.scrollTo({ top: 0 }); }, []);
  useEffect(() => {
    if (!signedIn) return;
    listChats().then((r) => setChats(r.chats ?? [])).catch(() => {});
    maestroStatus().then((s) => setLeft(s.left)).catch(() => {});
  }, [signedIn, chatId]);
  // open a chat from the address (not one this page just made)
  useEffect(() => {
    if (!chatId) { setChat(null); setMessages([]); return; }
    if (created.current === chatId) return;
    if (!signedIn) return;
    setLoading(true);
    getChat(chatId).then((r) => { setChat(r.chat); setMessages(r.messages ?? []); setNewest(null); })
      .catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [chatId, signedIn]);
  useEffect(() => { const el = box.current; if (!el) return; el.style.height = "auto"; el.style.height = `${Math.max(52, Math.min(el.scrollHeight, Math.round(window.innerHeight * 0.3)))}px`; }, [text]);
  // a new message: down to it
  useEffect(() => {
    if (!messages.length && !sending) return;
    requestAnimationFrame(() => { const sc = document.getElementById("workspace-scroll"); sc?.scrollTo({ top: sc.scrollHeight, behavior: "smooth" }); });
  }, [messages.length, sending]);

  // reference video + images attached to the next message (paperclip, drag and drop, or a pasted link)
  const rs = useReferenceScan("maestro");
  const [refImages, setRefImages] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [attachError, setAttachError] = useState(null);
  const attachInput = useRef(null);
  const scanning = Boolean(rs.scan && rs.scan.status !== "done" && rs.scan.status !== "failed");
  const attach = async (files) => {
    if (!REFERENCE_UI) return;
    if (!signedIn) { setSignIn(true); return; }
    setAttachError(null);
    for (const file of [...files]) {
      if (/^video\//.test(file.type) || /\.(mp4|mov|webm)$/i.test(file.name)) { if (!rs.scan) rs.fromFile(file); }
      else if (/^image\//.test(file.type) && refImages.length < REF_LIMITS.maxImages) {
        try { const im = await uploadReferenceImage(file); setRefImages((l) => [...l, im].slice(0, REF_LIMITS.maxImages)); }
        catch (e) { setAttachError(e.message || "That image didn't upload."); }
      }
    }
  };
  // a pasted TikTok / Shorts / Instagram link starts the scan by itself
  const onPaste = (e) => {
    if (!REFERENCE_UI) return;
    const link = referenceLink(e.clipboardData?.getData("text") ?? "");
    if (link && !rs.scan) { if (!signedIn) { setSignIn(true); return; } rs.fromLink(link.url); }
  };

  const toBottom = () => requestAnimationFrame(() => { const sc = document.getElementById("workspace-scroll"); sc?.scrollTo({ top: sc.scrollHeight, behavior: "smooth" }); });
  const suggestions = useMemo(() => (tag ? [] : suggestTemplates(text, styles)), [text, styles, tag]);
  const typed = useTypewriter(PROMPT_LINES, { active: !text && !focused, fallback: "Ask Maestro anything" });

  const send = useCallback(async (raw, templateId = tag) => {
    const t = String(raw ?? "").trim();
    if (!t || sending) return;
    if (!signedIn) { setSignIn(true); return; }
    setError(null);
    setSending({ text: t, templateId });
    setText(""); setTag(null);
    try {
      const reference = rs.ready;
      const r = await sendToMaestro({
        chatId: chat?.id ?? chatId, text: t, templateId,
        ...(reference ? { reference, ...(REFERENCE_MOCK ? { referenceCard: rs.scan.card } : {}) } : {}),
        ...(refImages.length ? { referenceImages: refImages.map(({ path, role }) => ({ path, role })) } : {}),
      });
      if (reference) rs.clear();
      setRefImages([]);
      setMessages((list) => [...list, ...r.messages]);
      setNewest(r.messages[1]?.id ?? null);
      setLeft(r.left);
      if (!chat && !chatId) { created.current = r.chat.id; setChat(r.chat); navigate(maestroChatPath(r.chat.id), { replace: true }); refreshMaestroChats(); }
      trackCreate("maestro_message", { target: templateId ?? null });
    } catch (e) {
      setError(e.code === "DAILY_LIMIT" ? e.message : e.code === "SIGN_IN" ? "Sign in to chat with Maestro." : e.message || "Maestro couldn't answer. Try again.");
      setText(t); setTag(templateId);
    } finally { setSending(null); }
  }, [chat, chatId, navigate, sending, signedIn, tag, rs, refImages]);

  const pick = (s) => { setTag(s.id); setText((v) => v.replace(/^\/\S*\s*/, "")); requestAnimationFrame(() => box.current?.focus()); trackCreate("style_selected", { style: s.id, placement: "maestro" }); };
  const remove = async (id) => { setChats((l) => l.filter((c) => c.id !== id)); await deleteChat(id).catch(() => {}); refreshMaestroChats(); if (id === (chat?.id ?? chatId)) navigate(MAESTRO_PATH); };
  const empty = !chatId && !messages.length && !sending;

  const composer = (
    <div className={`${empty ? "" : "sticky bottom-[calc(78px+env(safe-area-inset-bottom))] z-40 px-3 pb-3 lg:bottom-0 lg:px-6 lg:pb-5"}`}>
      <div className="relative mx-auto w-full max-w-[760px]">
        {/* template suggestions: their row is reserved on the start screen (nothing jumps); in a chat they float above the box */}
        <div className={empty ? "mb-2 h-[64px]" : "pointer-events-none absolute inset-x-0 bottom-full mb-2"}>
          {suggestions.length > 0 && (
            <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1" data-testid="template-suggestions">
              {suggestions.map((s) => (
                <button key={s.id} type="button" onClick={() => pick(s)} className="flex h-[58px] w-[240px] shrink-0 items-center gap-2.5 rounded-2xl border border-sky-400/30 bg-[#141618] p-1.5 pr-3 text-left shadow-[0_8px_24px_rgba(0,0,0,.4)] hover:border-sky-300">
                  <img src={s.poster} alt="" className="h-full w-[38px] shrink-0 rounded-lg object-cover" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[13.5px] font-bold text-white"><span className="truncate">{s.name}</span><span className="font-mono text-[11px] text-sky-300">/{s.id}</span></span>
                    <span className="block truncate text-[11.5px] text-white/65">{String(s.direction ?? s.hook ?? "").split(/(?<=\.)\s/)[0]}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div
          className={`relative rounded-[22px] border bg-[#16181a]/95 p-3 shadow-[0_-10px_50px_rgba(0,0,0,.5)] backdrop-blur-md ${dragOver ? "border-lime-300" : "border-white/[0.12]"}`}
          onDragOver={(e) => { if (!REFERENCE_UI) return; e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { if (!REFERENCE_UI) return; e.preventDefault(); setDragOver(false); attach(e.dataTransfer?.files ?? []); }}
          data-testid="maestro-composer"
        >
          {dragOver && <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-[22px] bg-lime-300/10 text-[14px] font-bold text-lime-200">Drop a video or images</div>}
          {tag && <div className="mb-1.5"><TemplateTag id={tag} onRemove={() => setTag(null)} /></div>}
          {(rs.scan || rs.error || refImages.length > 0 || attachError) && (
            <div className="mb-2 space-y-2" data-testid="maestro-attachments">
              {scanning && <ScanProgress scan={rs.scan} />}
              {rs.scan?.status === "done" && (
                <div className="relative">
                  <BreakdownCard card={rs.scan.card} copy={rs.copy} onCopy={rs.setCopy} compact />
                  <button type="button" aria-label="Remove the video" onClick={rs.clear} className="absolute right-2 top-2 rounded-full p-1 text-white/60 hover:text-white"><X className="h-4 w-4" /></button>
                </div>
              )}
              {rs.scan?.status === "failed" && <p className="text-[12.5px] text-rose-300">{rs.scan.error} <button type="button" onClick={rs.clear} className="font-bold text-white underline">OK</button></p>}
              {(rs.error || attachError) && <p className="text-[12.5px] text-rose-300" role="alert">{rs.error || attachError}</p>}
              {refImages.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {refImages.map((im, k) => (
                    <span key={im.path} className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.07] py-1 pl-1 pr-2 text-[11.5px] text-white/85">
                      {im.url && <img src={im.url} alt="" className="h-7 w-7 rounded-lg object-cover" />}
                      <button type="button" title="Tap to change" onClick={() => setRefImages((l) => l.map((x, j) => (j === k ? { ...x, role: REF_LIMITS.imageRoles[(REF_LIMITS.imageRoles.indexOf(x.role) + 1) % REF_LIMITS.imageRoles.length] } : x)))} className="font-bold text-lime-300">{{ style: "Style", character: "Character", place: "Place", product: "Product/Logo" }[im.role]}</button>
                      <button type="button" aria-label="Remove" onClick={() => setRefImages((l) => l.filter((_, j) => j !== k))} className="text-white/55 hover:text-white"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex items-end gap-2">
            <label htmlFor="maestro-box" className="sr-only">Message Maestro</label>
            {REFERENCE_UI && <><input ref={attachInput} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,image/*" multiple className="hidden" onChange={(e) => { attach(e.target.files ?? []); e.target.value = ""; }} />
            <button type="button" onClick={() => (signedIn ? attachInput.current?.click() : setSignIn(true))} aria-label="Attach a reference video or images" title="Attach a reference video or images" className="mb-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/[0.08] hover:text-white" data-testid="maestro-attach">
              <Paperclip className="h-[18px] w-[18px]" />
            </button></>}
            <textarea id="maestro-box" ref={box} rows={2} value={text} maxLength={4000} onPaste={onPaste}
              onChange={(e) => setText(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (suggestions.length && text.startsWith("/")) pick(suggestions[0]); else send(text); }
              }}
              placeholder={focused ? "Ask Maestro anything, or type / for a template" : typed || "Ask Maestro anything"}
              className="min-h-[52px] flex-1 resize-none bg-transparent px-1 py-1 text-[16px] leading-6 text-white placeholder:text-white/45 focus:outline-none" />
            <button type="button" onClick={() => send(text)} disabled={!text.trim() || Boolean(sending) || scanning} title={scanning ? "Waiting for the video scan" : undefined} aria-label="Send" className="mb-1 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-lime-300 text-[#11150D] shadow-[0_0_20px_rgba(190,242,100,.35)] transition hover:bg-lime-200 disabled:opacity-40" data-testid="maestro-send">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-5 w-5" strokeWidth={2.6} />}
            </button>
          </div>
          <div className="mt-1 flex items-center justify-between px-1 text-[11.5px] text-white/55">
            <span>Type <span className="font-mono text-sky-300">/</span> for a template · Enter sends</span>
            <span className="flex items-center gap-3">
              {left != null && left < 3 && <span className="text-amber-200/90">{left} {left === 1 ? "message" : "messages"} left today</span>}
              {user && credits != null && <Link to="/pricing" className="inline-flex items-center gap-1 font-semibold text-white/80 hover:text-white" title="Your credits"><Coins className="h-3.5 w-3.5 text-lime-300" />{Number(credits).toLocaleString()} credits</Link>}
            </span>
          </div>
        </div>
        {error && <p className="mt-2 px-1 text-[13px] text-rose-300" role="alert">{error}{/today's/.test(error) && <> <Link to="/pricing" className="font-bold text-lime-300">Upgrade</Link></>}</p>}
      </div>
    </div>
  );

  return (
    <div className="relative isolate flex min-h-full flex-col overflow-x-clip">
      <PageGlow />
      {empty ? (
        <div className="mx-auto flex w-full max-w-[900px] flex-1 flex-col px-4 pb-10 pt-[8vh]">
          <h1 className="flex items-center justify-center gap-3 text-center text-[30px] font-black tracking-[-0.02em] text-white sm:text-[44px]">
            <img src={MAESTRO_AVATAR} alt="Maestro" width="56" height="56" className="h-11 w-11 rounded-full border border-violet-400/40 object-cover shadow-[0_0_30px_rgba(139,92,246,.35)] sm:h-14 sm:w-14" />{greeting()}{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-2 text-center text-[15.5px] text-white/80">I'm Maestro. Tell me your idea and I'll plan it, make it and change anything you want.</p>
          <div className="mt-7">{composer}</div>
          <div className="mx-auto mt-4 flex max-w-[760px] flex-wrap justify-center gap-2">
            {STARTS.map((s) => <button key={s.label} type="button" onClick={() => { if (s.text.endsWith(" ")) { setText(s.text); box.current?.focus(); } else send(s.text, s.templateId ?? null); }} className="rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-[13px] font-medium text-white/90 hover:border-lime-300/40">{s.label}</button>)}
          </div>
          {signedIn && chats.length > 0 && (
            <section className="mx-auto mt-10 w-full max-w-[760px]" aria-labelledby="recent-chats">
              <h2 id="recent-chats" className="text-[13px] font-bold uppercase tracking-[0.12em] text-lime-200/70">Recent chats</h2>
              <ul className="mt-2 divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                {chats.slice(0, 8).map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <Link to={maestroChatPath(c.id)} className="flex min-w-0 flex-1 items-center gap-2.5 px-3.5 py-2.5 hover:bg-white/[0.04]">
                      <MessageSquare className="h-4 w-4 shrink-0 text-white/50" />
                      <span className="truncate text-[14px] text-white/90">{c.title}</span>
                      {c.styleId && <span className="ml-auto hidden shrink-0 font-mono text-[11.5px] text-sky-300 sm:inline">/{c.styleId}</span>}
                    </Link>
                    <button type="button" onClick={() => remove(c.id)} className="mr-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] text-white/45 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" />Delete</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <>
          <div className="mx-auto flex w-full max-w-[760px] items-center gap-2 px-4 pt-3">
            <p className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-white/85">{chat?.title ?? "Chat"}</p>
            <Link to={MAESTRO_PATH} className="inline-flex items-center gap-1 rounded-lg border border-white/12 px-2.5 py-1 text-[12.5px] font-semibold text-white/85 hover:border-white/30"><Plus className="h-3.5 w-3.5" />New chat</Link>
          </div>
          <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-6 px-4 pb-6 pt-4" data-testid="maestro-thread">
            {loading && <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-lime-300" /></div>}
            {messages.map((m) => m.role === "user" ? (
              <div key={m.id} className="flex justify-end" data-role="user">
                <div className="max-w-[85%] rounded-[20px] rounded-br-md bg-white/[0.09] px-4 py-2.5 text-[15.5px] leading-snug text-white">
                  {m.templateId && <div className="mb-1"><TemplateTag id={m.templateId} /></div>}
                  <span className="whitespace-pre-wrap">{m.text}</span>
                </div>
              </div>
            ) : <Answer key={m.id} m={m} reveal={m.id === newest} onAsk={(t) => send(t, null)} onShown={toBottom} />)}
            {sending && (
              <>
                <div className="flex justify-end"><div className="max-w-[85%] rounded-[20px] rounded-br-md bg-white/[0.09] px-4 py-2.5 text-[15.5px] text-white">{sending.templateId && <div className="mb-1"><TemplateTag id={sending.templateId} /></div>}{sending.text}</div></div>
                <div className="flex items-center gap-3"><img src={MAESTRO_AVATAR} alt="" width="32" height="32" className="h-8 w-8 rounded-full border border-violet-400/40 object-cover" />
                  <span className="flex gap-1" aria-label="Maestro is thinking">{[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-lime-300" style={{ animationDelay: `${i * 120}ms` }} />)}</span></div>
              </>
            )}
            <div ref={end} />
          </div>
          {composer}
        </>
      )}
      {signIn && <AuthModal mode="signup" title="Chat with Maestro" subtitle="A free Zyvo account is all you need." returnTo={MAESTRO_PATH} onClose={() => setSignIn(false)} />}
    </div>
  );
}
