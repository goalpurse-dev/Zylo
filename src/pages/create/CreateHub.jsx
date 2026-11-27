import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, FileText, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { directorPath, styleById } from "../../data/styles";
import { deleteDraft, listDrafts } from "../../lib/director";
import { LoopVideo } from "../../components/create/StyleCard";
import PromptBar from "../../components/create/PromptBar";
import TemplatePicker from "../../components/create/TemplatePicker";
import { useVisibleStyles } from "../../components/create/useCatalog";
import StudioCards from "../../components/create/StudioCards";
import VideoWall from "../../components/create/VideoWall";
import { RecentStrip } from "../../components/create/RecentList";
import Reveal from "../../components/create/Reveal";
import { Lime, PageGlow } from "../../components/create/PageGlow";

const ago = (iso) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

/** "My drafts": the user's saved plans (the Director saves every change) */
export function MyDrafts() {
  const { user } = useAuth() ?? {};
  const [drafts, setDrafts] = useState(null);
  useEffect(() => {
    if (!user) return;
    listDrafts().then((r) => setDrafts(r.drafts ?? [])).catch(() => setDrafts([]));
  }, [user]);
  if (!user || !drafts?.length) return null;
  const remove = async (id) => { setDrafts((d) => d.filter((x) => x.id !== id)); await deleteDraft(id).catch(() => {}); };
  return (
    <section className="mt-8" aria-labelledby="my-drafts">
      <h2 id="my-drafts" className="text-[17px] font-black text-white">My drafts</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {drafts.slice(0, 8).map((d) => (
          <div key={d.id} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
            <img src={styleById(d.style_id)?.poster ?? "/favicon.ico"} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
            <Link to={directorPath(d.id)} className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-white">{d.title || d.idea || "Untitled plan"}</p>
              <p className="truncate text-[12px] text-white/45">{styleById(d.style_id)?.name ?? "Template"} · {d.scenes?.length ?? 0} scenes · {d.status === "draft" ? "draft" : d.made_where === "claude" ? "sent to Claude" : "sent to Zyvo"} · {ago(d.updated_at)}</p>
            </Link>
            <button type="button" onClick={() => remove(d.id)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] text-white/40 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" />Delete</button>
          </div>
        ))}
      </div>
    </section>
  );
}

/** /create: the Studios hub. One big card per studio, My drafts, and the prompt bar. */
export default function CreateHub() {
  const allStyles = useVisibleStyles();
  const bar = useRef(null);
  const [picker, setPicker] = useState(false);
  useEffect(() => { document.title = "Create | Zyvo"; }, []);

  return (
    <div className="relative isolate min-h-full overflow-x-clip">
      <PageGlow />
      <div className="mx-auto w-full max-w-[1100px] px-4 pt-2 lg:px-6">
        <VideoWall styles={allStyles} />
        <h1 className="-mt-4 text-center text-[28px] font-black tracking-[-0.03em] text-white sm:text-[40px]">What do you want <Lime>to make?</Lime></h1>
        <p className="mt-1 text-center text-[15px] text-white/80">Pick a studio, choose a template, then plan your video scene by scene.</p>

        <div className="mt-6"><StudioCards placement="create" /></div>

        <MyDrafts />
        <RecentStrip title="Recently made" kinds={["image", "video"]} />
        <p className="mt-8 flex items-center gap-1.5 text-[12px] text-white/60"><FileText className="h-3.5 w-3.5" />Every plan is saved, so you can come back to it later.</p>
      </div>
      <PromptBar ref={bar} studioId={null} slim onPickTemplate={() => setPicker(true)} />
      {picker && <TemplatePicker onClose={() => setPicker(false)} onPick={(s) => { setPicker(false); bar.current?.useStyle(s.id); }} />}
    </div>
  );
}
