// idea.jsx — Phase 6e. After "Generate video" the Idea step is a READ-ONLY
// summary of what was chosen (niche, topic, style, length, quality, voice).
// Back never lands on the paid Generate form again.
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchLongFormProject } from "./project";
import { fetchActiveGenerationProfile } from "./productionProfile";
import { LongFormActionFooter, LongFormCreationHeader } from "./shared";
import { findNiche } from "./niches";
import { getVisualStyle } from "./visualStyles";
import { findVoice } from "../../../lib/voiceCatalog";
import { cachedStickmanProject } from "./StickmanRouteGuard";
import { reachableStickmanSteps } from "./projectStage";

const QUALITY = { v2: "V2 Fast", v3: "V3 High Quality", v4: "V4 Ultra" };

export default function LongFormIdea() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const cached = cachedStickmanProject(projectId);
  const [project, setProject] = useState(cached?.project ?? null);
  const [profile, setProfile] = useState(cached?.profile ?? null);
  useEffect(() => {
    document.title = "Idea | Zyvo";
    fetchLongFormProject(projectId).then((p) => p && setProject((old) => ({ ...(old ?? {}), ...p })));
    if (!profile) fetchActiveGenerationProfile(projectId).then(setProfile);
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const snap = profile?.raw_setup_snapshot ?? {};
  const niche = findNiche(snap.niche);
  const style = getVisualStyle(profile?.visual_style_preset ?? snap.visualStylePreset);
  const voice = findVoice(profile?.voice_id);
  const minutes = project?.resolved_length_minutes ?? project?.custom_length_minutes ?? profile?.target_duration_minutes;
  const next = project ? reachableStickmanSteps(project).scenes : null;
  const rows = [
    ["Niche", niche?.label ?? "—"],
    ["Topic", project?.selected_title ?? project?.topic ?? "—"],
    ["Style", style?.label ?? "Stickman"],
    ["Length", minutes ? `${minutes} min` : "—"],
    ["Quality", QUALITY[String(profile?.render_tier ?? "").toLowerCase()] ?? "—"],
    ["Voice", voice ? `${voice.name} · ${voice.tags.slice(0, 2).join(", ")}` : "—"],
  ];
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 pb-32 lg:px-8 lg:py-10">
      <LongFormCreationHeader current="idea" project={project} stickman />
      <div data-testid="idea-summary" className="mx-auto max-w-[640px]">
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-white">Your idea</h1>
        <p className="mt-1.5 text-[14px] text-white/45">What this video was made from. These settings are locked once a video is generated.</p>
        <dl className="mt-6 divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#151719]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-4 px-5 py-3.5">
              <dt className="text-[13px] text-white/45">{k}</dt>
              <dd className="text-right text-[13.5px] font-medium text-white">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      {next && <LongFormActionFooter primaryLabel="Continue" onPrimary={() => navigate(`/long-form/project/${projectId}/${next}`)} maxWidthClassName="max-w-[1100px]" />}
    </div>
  );
}
