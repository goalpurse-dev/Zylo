import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { Clapperboard, Download, FileText, FolderOpen, Image as ImageIcon, Loader2, Sparkles, Wand2, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { saveMediaToDevice } from "../../lib/downloadMedia";
import { FULL_VIDEO_TOOL_KEY } from "../../lib/jobs";
import { DIRECTOR_MOCK, listDrafts } from "../../lib/director";
import { AI_STUDIO_PATH, CREATE_PATH, directorPath, styleById } from "../../data/styles";
import AuthModal from "../AuthModal";
import { Lime, PageGlow } from "../create/PageGlow";
import Reveal from "../create/Reveal";

// the shelves (chips); a row can be on more than one (All holds everything)
const SHELVES = [
  { id: "all", label: "All" },
  { id: "finished", label: "Finished videos" },
  { id: "video", label: "Clips" },
  { id: "image", label: "Images" },
  { id: "long", label: "Long Form" },
  { id: "plan", label: "Plans" },
];
const when = (iso) => {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return days < 1 ? "Today" : days < 2 ? "Yesterday" : days < 7 ? `${days} days ago` : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

async function loadAll(userId) {
  if (DIRECTOR_MOCK) {
    const drafts = await listDrafts().then((r) => r.drafts ?? []).catch(() => []);
    return [
      { id: "m1", shelf: ["image"], kind: "image", url: "/in-this-town/stories/milo.webp", title: "A tiny dragon in a teacup", at: new Date().toISOString(), state: "done" },
      { id: "m2", shelf: ["finished"], kind: "video", url: "/in-this-town/stories/plane.mp4", poster: "/in-this-town/stories/plane.webp", title: "The town inside a plane", at: new Date(Date.now() - 86400000).toISOString(), state: "done" },
      { id: "m3", shelf: ["video"], kind: "video", url: null, title: "Waves at golden hour", at: new Date().toISOString(), state: "making" },
      ...drafts.map(planRow),
    ];
  }
  const base = () => supabase.from("jobs").select("id, created_at, status, result_url, prompt, type, tool_key, input").eq("user_id", userId);
  const [videos, images, making, lf, drafts] = await Promise.all([
    base().eq("type", "video").eq("status", "succeeded").not("result_url", "is", null).order("created_at", { ascending: false }).limit(60),
    base().eq("type", "image").eq("status", "succeeded").is("settings->>long_form_internal", null).not("result_url", "is", null).order("created_at", { ascending: false }).limit(60),
    base().in("status", ["queued", "running", "processing"]).is("settings->>long_form_internal", null).gte("created_at", new Date(Date.now() - 86_400_000).toISOString()).order("created_at", { ascending: false }).limit(12),
    supabase.functions.invoke("long-form-render", { body: { action: "list_done" } }).catch(() => null),
    listDrafts().then((r) => r.drafts ?? []).catch(() => []),
  ]);
  const title = (j, fb) => String(j.input?.subject ?? j.prompt ?? fb).slice(0, 90);
  return [
    ...(making.data ?? []).map((j) => ({ id: `job:${j.id}`, shelf: [j.type === "image" ? "image" : "video"], kind: j.type, url: null, title: title(j, "Making…"), at: j.created_at, state: "making" })),
    ...(videos.data ?? []).map((j) => ({ id: `job:${j.id}`, shelf: [j.tool_key === FULL_VIDEO_TOOL_KEY ? "finished" : "video"], kind: "video", url: j.result_url, title: title(j, "Video"), at: j.created_at, state: "done" })),
    ...(images.data ?? []).map((j) => ({ id: `job:${j.id}`, shelf: ["image"], kind: "image", url: j.result_url, title: title(j, "Image"), at: j.created_at, state: "done" })),
    ...((lf?.data?.videos ?? []).map((v) => ({ id: `lf:${v.id}`, shelf: ["long", "finished"], kind: "video", url: v.videoUrl, poster: null, title: `${v.title} · ${v.resolution}`, at: v.finishedAt, state: "done" }))),
    ...drafts.map(planRow),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
function planRow(d) {
  return { id: `plan:${d.id}`, shelf: ["plan"], kind: "plan", url: null, poster: styleById(d.style_id)?.poster ?? null, title: d.title || d.idea || "Untitled plan", at: d.updated_at, state: d.status === "draft" ? "plan" : "sent", to: directorPath(d.id), sub: `${styleById(d.style_id)?.name ?? "Plan"} · ${d.scenes?.length ?? 0} scenes` };
}

function Media({ item, className, controls = false }) {
  if (item.kind === "image" && item.url) return <img src={item.url} alt="" className={className} loading="lazy" />;
  if (item.kind === "video" && item.url) return <video src={item.url} poster={item.poster ?? undefined} className={className} muted={!controls} controls={controls} autoPlay={controls} playsInline preload="metadata" />;
  if (item.poster) return <img src={item.poster} alt="" className={className} loading="lazy" />;
  const Icon = item.kind === "plan" ? FileText : item.kind === "image" ? ImageIcon : Clapperboard;
  return <span className={`${className} grid place-items-center bg-gradient-to-br from-white/[0.06] to-white/[0.02]`}><Icon className="h-6 w-6 text-white/35" /></span>;
}

/** the redesigned Creations (Library): everything you made, on shelves, with a big viewer */
export default function LibraryV2() {
  const { user, loading } = useAuth() ?? {};
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [shelf, setShelf] = useState("all");
  const [open, setOpen] = useState(null);
  const [signIn, setSignIn] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user && !DIRECTOR_MOCK) { setItems([]); return; }
    let live = true;
    loadAll(user?.id).then((r) => live && setItems(r)).catch(() => live && setItems([]));
    return () => { live = false; };
  }, [user, loading]);

  const counts = useMemo(() => Object.fromEntries(SHELVES.map((s) => [s.id, (items ?? []).filter((it) => s.id === "all" || it.shelf.includes(s.id)).length])), [items]);
  const shown = (items ?? []).filter((it) => shelf === "all" || it.shelf.includes(shelf));

  const openItem = (it) => (it.to ? navigate(it.to) : it.state === "done" ? setOpen(it) : null);

  return (
    <div className="relative isolate min-h-full overflow-x-clip">
      <PageGlow />
      <div className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-8 lg:px-8">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-lime-300">Library</p>
        <h1 className="mt-1 text-[34px] font-black uppercase leading-[1.02] tracking-[-0.03em] text-white sm:text-[54px]">Your <Lime>creations</Lime></h1>
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-lime-300/25 bg-gradient-to-r from-lime-300/[0.08] to-lime-300/[0.02] px-4 py-3 text-[14px] text-white/85">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-lime-300" />
          <p>Everything you make in every studio shows up here: <span className="font-bold text-white">plans, images, clips, finished videos and long videos</span>. Tap one to watch it or download it.</p>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Shelves">
          {SHELVES.map((s) => (
            <button key={s.id} type="button" role="tab" aria-selected={shelf === s.id} onClick={() => setShelf(s.id)}
              className={`shrink-0 rounded-xl px-4 py-2 text-[14px] font-bold transition ${shelf === s.id ? "bg-lime-300 text-[#11150D] shadow-[0_0_24px_rgba(190,242,100,.25)]" : "border border-white/10 bg-white/[0.03] text-white/85 hover:border-white/25"}`}>
              {s.label} <span className={shelf === s.id ? "text-[#11150D]/60" : "text-white/45"}>{counts[s.id] ?? 0}</span>
            </button>
          ))}
        </div>

        {items === null ? (
          <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-lime-300" aria-label="Loading" /></div>
        ) : !user && !DIRECTOR_MOCK ? (
          <div className="mt-16 flex flex-col items-center text-center">
            <FolderOpen className="h-10 w-10 text-lime-300" />
            <p className="mt-3 text-[17px] font-bold text-white">Sign in to see your creations</p>
            <button type="button" onClick={() => setSignIn(true)} className="mt-4 rounded-xl bg-lime-300 px-5 py-2.5 text-[14px] font-black text-[#11150D]">Sign in</button>
          </div>
        ) : !shown.length ? (
          <div className="mt-16 flex flex-col items-center text-center" data-testid="library-empty">
            <span className="grid h-16 w-16 place-items-center rounded-2xl border border-lime-300/30 bg-lime-300/[0.08] shadow-[0_0_40px_rgba(190,242,100,.15)]"><FolderOpen className="h-7 w-7 text-lime-300" /></span>
            <p className="mt-4 text-[18px] font-black text-white">{shelf === "all" ? "Nothing here yet" : "Nothing on this shelf yet"}</p>
            <p className="mt-1 text-[14px] text-white/70">Make your first one, it shows up here the moment it starts.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link to={CREATE_PATH} className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-2.5 text-[14px] font-black text-[#11150D]"><Sparkles className="h-4 w-4" />Make a video</Link>
              <Link to={AI_STUDIO_PATH} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-2.5 text-[14px] font-bold text-white hover:border-white/30"><Wand2 className="h-4 w-4" />Make an image</Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-testid="library-grid">
            {shown.map((it, i) => (
              <Reveal key={it.id} delay={(i % 5) * 50}>
                <button type="button" onClick={() => openItem(it)} className="group block w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] text-left transition hover:border-lime-300/40 hover:shadow-[0_0_30px_rgba(190,242,100,.10)]">
                  <div className="relative aspect-[4/5] w-full overflow-hidden bg-black">
                    <Media item={it} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                    {it.state === "making" && <span className="absolute inset-0 grid place-items-center bg-black/55"><span className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-[12px] font-bold text-amber-200"><Loader2 className="h-3.5 w-3.5 animate-spin" />Making…</span></span>}
                    <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] font-bold text-white backdrop-blur">{it.kind === "plan" ? "Plan" : it.kind === "image" ? "Image" : it.shelf.includes("long") ? "Long Form" : it.shelf.includes("finished") ? "Video" : "Clip"}</span>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="truncate text-[13.5px] font-bold text-white">{it.title}</p>
                    <p className="mt-0.5 truncate text-[12px] text-white/60">{it.sub ?? when(it.at)}</p>
                  </div>
                </button>
              </Reveal>
            ))}
          </div>
        )}
      </div>

      {open && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3" role="presentation">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={() => setOpen(null)} />
          <section role="dialog" aria-label={open.title} className="relative flex max-h-[94dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#121416]">
            <div className="flex items-center gap-2 px-4 py-3">
              <p className="min-w-0 flex-1 truncate text-[14px] font-bold text-white">{open.title}</p>
              <button type="button" onClick={() => setOpen(null)} className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-3 py-1.5 text-[12px] font-semibold text-white/80"><X className="h-3.5 w-3.5" />Close</button>
            </div>
            <div className="min-h-0 flex-1 bg-black"><Media item={open} controls className="mx-auto max-h-[70dvh] w-full object-contain" /></div>
            <div className="flex flex-wrap gap-2 p-3">
              <button type="button" onClick={() => saveMediaToDevice({ url: open.url, filename: open.kind === "image" ? "zyvo-image.png" : "zyvo-video.mp4", title: open.title }).catch(() => window.open(open.url, "_blank"))}
                className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-4 py-2.5 text-[14px] font-black text-[#11150D]"><Download className="h-4 w-4" />Download</button>
              {open.kind === "image" && (
                <button type="button" onClick={() => navigate(AI_STUDIO_PATH, { state: { mode: "video", refImage: { id: open.id, url: open.url } } })}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-[14px] font-bold text-white"><Clapperboard className="h-4 w-4" />Make a video from this</button>
              )}
            </div>
          </section>
        </div>,
        document.body,
      )}
      {signIn && <AuthModal mode="login" onClose={() => setSignIn(false)} returnTo="/workspace/creations" />}
    </div>
  );
}
