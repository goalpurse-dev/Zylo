import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, Search } from "lucide-react";
import { CATEGORIES, CREATE_PATH, isWide, studioById } from "../../data/styles";
import StyleCard from "../../components/create/StyleCard";
import StudioTutorials from "../../components/create/StudioTutorials";
import { LongFormSection } from "../../components/home-v2/HomeV2Sections.jsx";
import Reveal from "../../components/create/Reveal";
import { Lime, PageGlow } from "../../components/create/PageGlow";
import StylePreviewModal from "../../components/create/StylePreviewModal";
import PromptBar from "../../components/create/PromptBar";
import TemplatePicker from "../../components/create/TemplatePicker";
import { trackCreate, useVisibleStyles } from "../../components/create/useCatalog";

/** /create/:studioId: one studio's templates (chips with counts, search, grid) + the shared prompt bar */
export default function StudioPage() {
  const { studioId } = useParams();
  const studio = studioById(studioId);
  const styles = useVisibleStyles(studio?.id ?? "none");
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState(null);
  const [picker, setPicker] = useState(false);
  const bar = useRef(null);
  // ?template=<id> opens that template's popup (Home's "Make one like this")
  const [params] = useSearchParams();
  const wanted = params.get("template");
  useEffect(() => { const s = styles.find((x) => x.id === wanted); if (s) setPreview(s); }, [wanted, styles]);
  useEffect(() => { if (studio) document.title = `${studio.name} | Zyvo`; }, [studio]);

  const chips = useMemo(() => [{ id: "all", label: "All", count: styles.length }, ...CATEGORIES.map((c) => ({ ...c, count: styles.filter((s) => s.category === c.id).length })).filter((c) => c.count > 0)], [styles]);
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase();
    return styles.filter((s) => (cat === "all" || s.category === cat) && (!words || `${s.name} ${s.direction} ${s.hook} ${s.ideas.join(" ")}`.toLowerCase().includes(words)));
  }, [styles, cat, q]);

  if (!studio) return <Navigate replace to={CREATE_PATH} />;

  const open = (s) => { setPreview(s); trackCreate("style_previewed", { style: s.id, studio: studio.id }); };
  const use = (s, variantId = null) => { setPreview(null); bar.current?.useStyle(s.id, variantId); };

  return (
    <div className="relative isolate min-h-full overflow-x-clip">
      <PageGlow />
      <div className="mx-auto w-full max-w-[1100px] px-4 pt-5 lg:px-6">
        <Link to={CREATE_PATH} className="inline-flex items-center gap-1 text-[13px] font-semibold text-white/50 hover:text-white"><ChevronLeft className="h-4 w-4" />All studios</Link>
        <h1 className="mt-2 text-[26px] font-black tracking-[-0.03em] text-white sm:text-[34px]">{studio.name.replace(/ Studio$/, "")} <Lime>Studio</Lime></h1>
        <p className="mt-1 text-[15px] text-white/80">{studio.line} Tap a template to see examples.</p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter templates">
            {chips.map((c) => (
              <button key={c.id} type="button" role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${cat === c.id ? "bg-white text-black" : "bg-white/[0.06] text-white/70 hover:bg-white/[0.12]"}`}>
                {c.label} <span className={cat === c.id ? "text-black/50" : "text-white/35"}>{c.count}</span>
              </button>
            ))}
          </div>
          <label className="relative sm:ml-auto sm:w-[240px]">
            <span className="sr-only">Search templates</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates" className="w-full rounded-full border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-[14px] text-white placeholder:text-white/35 focus:border-lime-300/40 focus:outline-none" />
          </label>
        </div>

        {shown.length ? (
          <div className={`mt-4 grid gap-3 ${studio.format === "16:9" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`} data-testid="style-grid">
            {shown.map((s, i) => <Reveal key={s.id} delay={(i % 4) * 70} className={studio.format !== "16:9" && isWide(s) ? "col-span-2" : ""}><StyleCard style={s} onOpen={open} /></Reveal>)}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-white/10 p-8 text-center text-[14px] text-white/50">
            {styles.length ? "No template matches that search." : "Templates for this studio are coming soon."}
          </div>
        )}
        {studio.id === "long-form" && <LongFormSection />}
        <StudioTutorials studioId={studio.id} />
      </div>
      <PromptBar key={studio.id} ref={bar} studioId={studio.id} onPickTemplate={() => setPicker(true)} />
      {preview && <StylePreviewModal style={preview} onClose={() => setPreview(null)} onUse={use} />}
      {picker && <TemplatePicker studioId={studio.id} onClose={() => setPicker(false)} onPick={(s) => { setPicker(false); bar.current?.useStyle(s.id); }} />}
    </div>
  );
}
