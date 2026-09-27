import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Clapperboard } from "lucide-react";
import { fetchLongFormProject } from "./project";
import { fetchActiveGenerationProfile, isStickmanRecipeProfile } from "./productionProfile";
import { fetchBeatDirectorReadiness } from "./narration";
import { LongFormCreationHeader } from "./shared";

function formatDuration(seconds) {
  const total = Math.round(seconds ?? 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// 2026-10-02 "make the new flow real in the product" pass, Section 16 —
// deliberately NOT the Beat Director (explicitly out of scope this phase).
// This is the proof screen: TIME + SCRIPT + BIBLE CONTEXT for a real,
// already-generated narration timeline, with zero image/visual-concept
// content, showing that audio-to-future-visual-planning is genuinely ready.
export default function LongFormVisuals() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [profile, setProfile] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Visuals | Zyvo";
    let cancelled = false;
    (async () => {
      const [projectRow, activeProfile, readinessResult] = await Promise.all([
        fetchLongFormProject(projectId),
        fetchActiveGenerationProfile(projectId),
        fetchBeatDirectorReadiness(projectId),
      ]);
      if (cancelled) return;
      setProject(projectRow);
      setProfile(activeProfile);
      setReadiness(readinessResult);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const stickman = isStickmanRecipeProfile(profile);

  if (loading) {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-8 lg:px-8 lg:py-10">
        <LongFormCreationHeader current="visuals" project={project} stickman={stickman} />
        <p className="mt-16 text-center text-[13px] text-white/40">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 pb-16 lg:px-8 lg:py-10">
      <LongFormCreationHeader current="visuals" project={project} stickman={stickman} />

      <div className="mb-7">
        <h1 className="text-[24px] font-bold tracking-[-0.02em] text-white lg:text-[26px]">Ready for Visual Planning</h1>
        <p className="mt-1.5 text-[14px] text-white/45">Your locked narration audio, exact word timeline, and Production Bible are now available together — everything the Beat Director will need.</p>
      </div>

      {!readiness?.ready && (
        <div className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4 text-[12.5px] text-amber-200">
          Not fully ready yet: {(readiness?.missing ?? ["Unknown"]).join(", ")}.
        </div>
      )}

      {readiness?.storyContext && (
        <div className="mb-5 rounded-2xl border border-white/[0.09] bg-[#151719] p-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30">Story Context</p>
          <p className="text-[14px] font-bold text-white">{readiness.storyContext.topic}</p>
          {readiness.storyContext.viewerPromise && <p className="mt-1 text-[12.5px] text-white/50">{readiness.storyContext.viewerPromise}</p>}
          {readiness.storyContext.visualPremise && <p className="mt-3 text-[12.5px] leading-relaxed text-white/65"><span className="font-semibold text-white/40">Visual premise: </span>{readiness.storyContext.visualPremise}</p>}
          {readiness.storyContext.visualTone && <p className="mt-1 text-[12.5px] text-white/50"><span className="font-semibold text-white/40">Tone: </span>{readiness.storyContext.visualTone}</p>}
        </div>
      )}

      <div className="mb-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
        <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30">Narration Timeline × Bible Context (example)</p>
        <div className="space-y-1">
          {(readiness?.narration ?? []).slice(0, 6).map((seg) => (
            <div key={seg.segmentId} className="rounded-xl px-3.5 py-2.5">
              <p className="mb-1 text-[10.5px] font-semibold text-lime-300/70">{formatDuration(seg.startSeconds)} – {formatDuration(seg.endSeconds)}</p>
              <p className="text-[13px] leading-relaxed text-white/75">{seg.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8 flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 text-white/50">
        <Clapperboard className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-[12.5px] leading-relaxed">
          This is a proof screen, not the Beat Director. Scene-by-scene visual planning, image generation, and rendering are the next phase and are not built yet — no images or visual concepts have been generated for this video.
        </p>
      </div>

      <button type="button" onClick={() => navigate(`/long-form/project/${projectId}/narration`)} className="text-[12.5px] font-semibold text-white/40 hover:text-white/70">
        ← Back to Narration
      </button>
    </div>
  );
}
