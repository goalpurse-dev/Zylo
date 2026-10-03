import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { fetchProjectBilling, fetchUserLongFormProjects } from "./project";
import { coverFor, fetchProjectCovers, projectTitle } from "./projectCovers";
import { deriveProjectStageInfo } from "./projectStage";
import { NeutralCover, ProjectCard } from "./shared";
import { useAuth } from "../../../context/AuthContext";
import { TutorialCard } from "../../../components/launch/LaunchUI.jsx";
import { fetchShowcase, showcaseThumb, trackLaunch } from "../../../components/launch/launch";
import { HowItWorks, LazyLoopVideo, LONG_FORM_LOOP } from "../../../components/home-v2/HomeV2Sections.jsx";

// Status pill by the project's furthest step: drawn -> Ready to edit,
// rendered -> Published; "Drawing" only while a job is actually running.
const PILL = {
  idea: { label: "Idea", cls: "border-white/15 bg-white/[0.05] text-white/65" },
  drawing: { label: "Drawing", cls: "border-lime-300/30 bg-lime-300/10 text-lime-300" },
  edit: { label: "Ready to edit", cls: "border-sky-300/30 bg-sky-300/10 text-sky-200" },
  publish: { label: "Published", cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
};
function pillFor(stage) {
  if (stage.stickmanStep === "publish") return PILL.publish;
  if (stage.route === "scenes") return PILL.edit;
  return stage.active ? PILL.drawing : PILL.idea;
}
function timeAgo(iso) {
  const s = Math.floor((Date.now() - Date.parse(iso)) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
const sentence = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : "Untitled video");
const YT_MARK = <svg viewBox="0 0 24 17" className="h-2.5 w-3.5 shrink-0" aria-hidden="true"><rect width="24" height="17" rx="4.5" fill="#FF0033" /><path d="M9.6 4.8v7.4l6.2-3.7z" fill="#fff" /></svg>;

function RecentCard({ project, onOpen }) {
  const stage = deriveProjectStageInfo(project);
  const pill = pillFor(stage);
  return (
    <button type="button" onClick={() => onOpen(`/long-form/project/${project.id}/${stage.route}`)} title={stage.statusLabel} data-testid="recent-card"
      className="group w-[240px] shrink-0 snap-start text-left sm:w-auto">
      <div className="relative aspect-video overflow-hidden rounded-[14px] border border-white/10 bg-[#0d0f10] transition group-hover:border-white/25">
        {project._thumbnailUrl
          ? <img src={project._thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
          : <NeutralCover title={projectTitle(project)} />}
      </div>
      <p className="mt-2 truncate text-[13.5px] font-semibold text-white">{sentence(project.topic)}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${pill.cls}`}>{pill.label}</span>
        <span className="text-[11.5px] text-white/35">{timeAgo(project.updated_at)}</span>
      </div>
    </button>
  );
}

function MadeWithZyvo() {
  const [rows, setRows] = useState([]);
  useEffect(() => { fetchShowcase("long_form").then(setRows); }, []);
  if (!rows.length) return null;
  return (
    <>
      <p className="mb-1 px-2 pt-1 text-[15px] font-bold text-white">Made with Zyvo</p>
      {rows.slice(0, 2).map((v) => (
        <a key={v.id} href={v.youtube_url} target="_blank" rel="noopener noreferrer" data-testid="lobby-showcase"
          onClick={() => trackLaunch("showcase_click", { placement: "long_form_lobby", target: v.youtube_url, videoId: v.id })}
          className="group flex items-center gap-3 rounded-[14px] p-2 transition hover:bg-white/[0.04]">
          <div className="aspect-video w-[132px] shrink-0 overflow-hidden rounded-[10px] border border-white/10 sm:w-[148px]">
            <img src={showcaseThumb(v)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
          </div>
          <div className="min-w-0">
            <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-white">{v.title}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-white/45 group-hover:text-white/70">{YT_MARK} Watch on YouTube</p>
          </div>
        </a>
      ))}
      <TutorialCard className="mt-2" />
      <Link to="/ai-stickman-video-generator" className="mt-3 block px-1 text-[12.5px] font-semibold text-white/50 underline-offset-4 transition hover:text-lime-300 hover:underline">About Long Form: the AI stickman video generator →</Link>
    </>
  );
}

export default function LongForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [projects, setProjects] = useState(null); // null = loading, [] = loaded-empty

  // CREATE NEW VIDEO opens the single-column Production Setup (ProductionSetup.jsx).
  const startNewVideo = () => {
    trackLaunch("create_new_video", { placement: "long_form_lobby" });
    navigate("/long-form/create");
  };

  useEffect(() => {
    document.title = "Long Form | Zyvo";
  }, []);

  // "See examples" (What's new popup) lands here: scroll to the examples once they render.
  useEffect(() => {
    if (location.hash !== "#made-with-zyvo") return undefined;
    let tries = 0;
    const t = setInterval(() => { const el = document.getElementById("made-with-zyvo"); if (el || ++tries > 20) { clearInterval(t); el?.scrollIntoView({ block: "start" }); } }, 150);
    return () => clearInterval(t);
  }, [location.hash]);

  // Covers: chosen thumbnail -> first finished scene -> niche art.
  const reloadProjects = () => {
    if (!user?.id) return;
    Promise.all([fetchUserLongFormProjects(user.id), fetchProjectCovers(), fetchProjectBilling()]).then(([list, covers, billing]) =>
      setProjects((list ?? []).map((p) => ({ ...p, _thumbnailUrl: coverFor(covers, p), _billing: billing.get(p.id) ?? null }))));
  };

  useEffect(() => {
    reloadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const hasProjects = projects?.length > 0;
  const seeAll = () => document.getElementById("all-videos")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 lg:px-8 lg:py-6">
      <div className="mb-4">
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-white lg:text-[30px]">Long Form</h1>
        <p className="mt-0.5 text-[14px] text-white/45">Create complete AI-powered YouTube videos from one idea.</p>
      </div>

      {/* First screen. Desktop: create (~60%) + Made with Zyvo (~40%), Your videos
          full width below. Mobile: create -> Your videos -> Made with Zyvo. */}
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr] lg:gap-5">
        <div className="relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-white/[0.03] lg:col-start-1 lg:row-start-1" data-testid="create-card">
          <div className="pointer-events-none absolute inset-x-8 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <div className="relative aspect-[16/8] w-full max-w-full lg:aspect-[21/9]">
            <LazyLoopVideo {...LONG_FORM_LOOP} className="absolute inset-0" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0f1112] to-transparent" />
          </div>
          <div className="relative -mt-7 px-5 pb-5 lg:px-6 lg:pb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-300/25 bg-lime-300/[0.08] px-3 py-1 text-[11px] font-semibold text-lime-300">AI Long Form</span>
            <h2 className="mt-2.5 max-w-[560px] text-balance text-[20px] font-bold leading-snug text-white lg:text-[22px]">Turn any topic into a complete illustrated video</h2>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
              <button onClick={startNewVideo} data-testid="create-new-video"
                className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-3 text-[14px] font-semibold text-[#11150D] transition hover:bg-lime-200 active:scale-[0.99]">
                Create New Video <ArrowRight className="h-4 w-4" />
              </button>
              <p className="text-[13px] text-white/45">8–15 min · script, voice, scenes and thumbnails</p>
            </div>
          </div>
        </div>

        <section className="min-w-0 lg:col-span-2 lg:row-start-2" data-testid="your-videos">
          {projects === null ? null : hasProjects ? (
            <>
              <div className="mb-3 flex items-end justify-between px-1">
                <p className="text-[17px] font-bold text-white">Your videos</p>
                <button type="button" onClick={seeAll} className="text-[13px] text-white/50 transition hover:text-white">See all →</button>
              </div>
              <div className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4 lg:gap-4 [&::-webkit-scrollbar]:hidden">
                {projects.slice(0, 4).map((p) => <RecentCard key={p.id} project={p} onOpen={navigate} />)}
              </div>
            </>
          ) : (
            <>
              <p className="mb-3 px-1 text-[17px] font-bold text-white">How it works</p>
              <HowItWorks />
            </>
          )}
        </section>

        <aside id="made-with-zyvo" className="flex min-w-0 scroll-mt-6 flex-col rounded-[22px] border border-white/[0.08] bg-white/[0.02] p-3 lg:col-start-2 lg:row-start-1 lg:p-4" data-testid="made-with-zyvo">
          <MadeWithZyvo />
        </aside>
      </div>

      {hasProjects && (
        <div className="mt-10 scroll-mt-6" id="all-videos">
          <p className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">All your Long Form videos</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} onChanged={reloadProjects} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
