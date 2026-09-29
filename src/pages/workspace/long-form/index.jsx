import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Clapperboard } from "lucide-react";
import { fetchUserLongFormProjects } from "./project";
import { deriveProjectStageInfo } from "./projectStage";
import { ProjectCard } from "./shared";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../lib/supabaseClient";
import { ShowcaseRow, TutorialCard } from "../../../components/launch/LaunchUI.jsx";
import { fetchShowcase, showcaseThumb, trackLaunch } from "../../../components/launch/launch";
import { HUNT_CLIP, LazyLoopVideo } from "../../../components/home-v2/HomeV2Sections.jsx";

// Status pill by the project's furthest step.
const STEP_PILL = {
  idea: { label: "Idea", cls: "border-white/15 bg-white/[0.05] text-white/65" },
  scenes: { label: "Drawing", cls: "border-lime-300/30 bg-lime-300/10 text-lime-300" },
  edit: { label: "Ready to edit", cls: "border-sky-300/30 bg-sky-300/10 text-sky-200" },
  publish: { label: "Published", cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
};
function timeAgo(iso) {
  const s = Math.floor((Date.now() - Date.parse(iso)) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
const sentence = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : "Untitled video");

function RecentRow({ project, cover, onOpen }) {
  const stage = deriveProjectStageInfo(project);
  // Drawn -> Ready to edit; rendered -> Published; only a running job is "Drawing".
  const key = stage.stickmanStep === "publish" ? "publish" : stage.route === "scenes" ? "edit" : stage.active ? "scenes" : "idea";
  const pill = STEP_PILL[key];
  const image = cover ?? project._thumbnailUrl ?? null;
  return (
    <button type="button" onClick={() => onOpen(`/long-form/project/${project.id}/${stage.route}`)} data-testid="recent-row"
      title={stage.statusLabel} className="group flex w-full items-center gap-3 rounded-[14px] p-2 text-left transition hover:bg-white/[0.04]">
      <div className="aspect-video w-[112px] shrink-0 overflow-hidden rounded-[10px] border border-white/10 bg-[#0d0f10] sm:w-[128px]">
        {image
          ? <img src={image} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
          : <div className="grid h-full place-items-center text-lime-300/50"><Clapperboard className="h-6 w-6" strokeWidth={1.5} /></div>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-white">{sentence(project.topic)}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${pill.cls}`}>{pill.label}</span>
          <span className="text-[11.5px] text-white/35">{timeAgo(project.updated_at)}</span>
        </div>
      </div>
    </button>
  );
}

// New users: examples instead of an empty list.
function ExampleRows() {
  const [rows, setRows] = useState([]);
  useEffect(() => { fetchShowcase("long_form").then(setRows); }, []);
  return (
    <>
      <TutorialCard className="mb-3" />
      {rows.slice(0, 3).map((v) => (
        <a key={v.id} href={v.youtube_url} target="_blank" rel="noopener noreferrer" onClick={() => trackLaunch("showcase_click", { placement: "long_form_lobby_side", target: v.youtube_url, videoId: v.id })}
          className="group flex items-center gap-3 rounded-[14px] p-2 transition hover:bg-white/[0.04]">
          <div className="aspect-video w-[128px] shrink-0 overflow-hidden rounded-[10px] border border-white/10"><img src={showcaseThumb(v)} alt="" loading="lazy" className="h-full w-full object-cover" /></div>
          <div className="min-w-0">
            <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-white">{v.title}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-white/45">
              <svg viewBox="0 0 24 17" className="h-2.5 w-3.5" aria-hidden="true"><rect width="24" height="17" rx="4.5" fill="#FF0033" /><path d="M9.6 4.8v7.4l6.2-3.7z" fill="#fff" /></svg> Watch on YouTube
            </p>
          </div>
        </a>
      ))}
    </>
  );
}

export default function LongForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [projects, setProjects] = useState(null); // null = loading, [] = loaded-empty
  const [covers, setCovers] = useState(new Map());

  // CREATE NEW VIDEO opens the single-column Production Setup (ProductionSetup.jsx).
  const startNewVideo = () => {
    trackLaunch("create_new_video", { placement: "long_form_lobby" });
    navigate("/long-form/create");
  };

  useEffect(() => {
    document.title = "Long Form | Zyvo";
  }, []);

  // "See examples" (What's new popup) lands here: scroll to the showcase once it renders.
  useEffect(() => {
    if (location.hash !== "#made-with-zyvo") return undefined;
    let tries = 0;
    const t = setInterval(() => { const el = document.getElementById("made-with-zyvo"); if (el || ++tries > 20) { clearInterval(t); el?.scrollIntoView({ block: "start" }); } }, 150);
    return () => clearInterval(t);
  }, [location.hash]);

  const reloadProjects = () => {
    if (!user?.id) return;
    fetchUserLongFormProjects(user.id).then(setProjects);
    supabase.rpc("long_form_project_covers").then(({ data }) => setCovers(new Map((data ?? []).map((c) => [c.project_id, c.url]))), () => {});
  };

  useEffect(() => {
    reloadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const recent = (projects ?? []).slice(0, 4);
  const seeAll = () => document.getElementById("all-videos")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 lg:px-8 lg:py-8">
      <div className="mb-5">
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-white lg:text-[32px]">Long Form</h1>
        <p className="mt-1 text-[14px] text-white/45">Create complete AI-powered YouTube videos from one idea.</p>
      </div>

      {/* First screen: create (left ~60%) + your videos (right ~40%) */}
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr] lg:gap-5">
        <div className="relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-white/[0.03]" data-testid="create-card">
          <div className="pointer-events-none absolute inset-x-8 top-0 z-10 h-px bg-gradient-to-r from-transparent via-lime-300/40 to-transparent" />
          <div className="relative aspect-[16/8] w-full max-w-full">
            <LazyLoopVideo src={HUNT_CLIP.src} poster={HUNT_CLIP.poster} className="absolute inset-0" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0f1112] to-transparent" />
          </div>
          <div className="relative -mt-8 p-5 pt-0 lg:p-7 lg:pt-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-300/25 bg-lime-300/[0.08] px-3 py-1 text-[11px] font-semibold text-lime-300">AI Long Form</span>
            <h2 className="mt-3 max-w-[560px] text-balance text-[21px] font-bold leading-snug text-white lg:text-[24px]">Turn any topic into a complete illustrated video</h2>
            <p className="mt-1.5 max-w-[560px] text-[13.5px] leading-relaxed text-white/45">Pick a niche, add an idea, and get a finished 8–15 minute video with script, narration, scenes and thumbnails.</p>
            <button onClick={startNewVideo} data-testid="create-new-video"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-3 text-[14px] font-semibold text-[#11150D] transition hover:bg-lime-200 active:scale-[0.99]">
              Create New Video <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <aside className="flex min-w-0 flex-col rounded-[22px] border border-white/[0.08] bg-white/[0.02] p-3 lg:p-4" data-testid="your-videos">
          <div className="mb-1 flex items-center justify-between px-2 pt-1">
            <p className="text-[15px] font-bold text-white">{recent.length ? "Your videos" : "Made with Zyvo"}</p>
            {projects?.length > 0 && <button type="button" onClick={seeAll} className="text-[12.5px] text-white/50 transition hover:text-white">See all →</button>}
          </div>
          {projects === null ? null : recent.length
            ? <div className="flex flex-col">{recent.map((p) => <RecentRow key={p.id} project={p} cover={covers.get(p.id)} onOpen={navigate} />)}</div>
            : <ExampleRows />}
        </aside>
      </div>

      {/* Below the fold: examples, then every project */}
      <ShowcaseRow id="made-with-zyvo" placement="long_form" title="Made with Zyvo" subtitle="Long Form videos on YouTube, each one started from a single idea." className="mt-10" />

      <div className="mt-10 scroll-mt-6" id="all-videos">
        <p className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">Your Long Form Videos</p>
        {projects === null ? null : projects.length === 0 ? (
          <div className="rounded-[15px] border border-dashed border-white/[0.09] px-6 py-10 text-center">
            <p className="text-[13.5px] font-medium text-white/50">No long-form videos yet.</p>
            <p className="mt-1 text-[12.5px] text-white/30">Create your first video to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} onChanged={reloadProjects} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
