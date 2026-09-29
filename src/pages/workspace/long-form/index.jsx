import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Clapperboard } from "lucide-react";
import { fetchUserLongFormProjects } from "./project";
import { ProjectCard } from "./shared";
import { useAuth } from "../../../context/AuthContext";
import { ShowcaseRow, TutorialCard } from "../../../components/launch/LaunchUI.jsx";
import { trackLaunch } from "../../../components/launch/launch";

export default function LongForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [projects, setProjects] = useState(null); // null = loading, [] = loaded-empty

  // 2026-10-02 "Production Setup redesign" pass, Section 16 — CREATE NEW
  // VIDEO now opens the new single-column Production Setup experience
  // (ProductionSetup.jsx), never the old Idea/"Create Story Plan" page.
  // resetIdeaDraft() is no longer called here: that clears the OLD page's
  // sessionStorage draft, which ProductionSetup.jsx doesn't use at all — the
  // old page (still reachable directly at /long-form/new for whatever else
  // may link to it) manages its own draft lifecycle independently.
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
  };

  useEffect(() => {
    reloadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 lg:px-8 lg:py-10">
      <div className="mb-7">
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-white lg:text-[32px]">Long Form</h1>
        <p className="mt-1.5 text-[14px] text-white/45">Create complete AI-powered YouTube videos from one idea.</p>
      </div>

      {/* Hero / workspace card */}
      <div className="relative overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.03] p-6 lg:p-8">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-lime-300/35 to-transparent" />
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-20 blur-3xl"
          style={{ background: "#bef264" }}
        />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-300/25 bg-lime-300/[0.08] px-3 py-1 text-[11px] font-semibold text-lime-300">
              AI Long Form
            </span>

            <h2 className="mt-4 max-w-[520px] text-[20px] font-bold leading-snug text-white lg:text-[22px]">
              Turn any topic into a complete illustrated video
            </h2>

            <p className="mt-2 max-w-[560px] text-[13.5px] leading-relaxed text-white/45">
              Pick a niche, add an idea, and get a finished long-form video with script, narration and visuals.
            </p>

            <button
              onClick={startNewVideo}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-3 text-[14px] font-semibold text-[#11150D] transition hover:bg-lime-200 active:scale-[0.99]"
            >
              Create New Video
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid h-24 w-24 shrink-0 place-items-center self-center rounded-[18px] border border-white/[0.08] bg-white/[0.03] text-lime-300/70 lg:h-28 lg:w-28">
            <Clapperboard className="h-10 w-10" strokeWidth={1.5} />
          </div>
        </div>
      </div>

      {/* Made with Zyvo + the tutorial (each hidden until it has an active row) */}
      <TutorialCard className="mt-6" />
      <ShowcaseRow id="made-with-zyvo" placement="long_form" title="Made with Zyvo" subtitle="Long Form videos on YouTube — each one started from a single idea." className="mt-8" />

      {/* Your Long Form Videos — backed by long_form_projects, present from
          the moment "Create Story Plan" is clicked, regardless of how far
          the project has gotten (never gated on a finished render). */}
      <div className="mt-8">
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
