// Phase 6a — Script review: the end of the Stickman "Script" step.
// Title (+ alternatives), the full script in readable sections (no internal
// section roles), word count + estimated duration at the default voice pace
// (section times are m:ss and add up exactly to the total shown), a
// fact-check summary with sources, and two actions: Regenerate script /
// Continue to Voice. Never shows planner/internal text.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, BadgeCheck, ChevronDown, CircleAlert, ExternalLink, RotateCw } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { fetchLongFormProject, selectStoryTitle } from "./project";
import { LongFormCreationHeader } from "./shared";
import { lockStory } from "./narration";
import { formatClock, regenerateScript } from "./autopilot";
import { cleanText, cleanUserText } from "./textClean";
import { wordsPerMinuteFor } from "../../../lib/voicePace";
import { readableSections, sectionSeconds } from "./scriptReviewModel";

const words = (t) => cleanText(t).trim().split(/\s+/).filter(Boolean).length;

export default function LongFormScriptReviewPage() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [script, setScript] = useState(null);
  const [plan, setPlan] = useState(null);
  const [sources, setSources] = useState([]);
  const [showAlts, setShowAlts] = useState(false);
  const [showFacts, setShowFacts] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const p = await fetchLongFormProject(projectId);
      setProject(p);
      const scriptId = p?.autopilot?.scriptVersionId ?? p?.current_script_version_id;
      if (!scriptId) return;
      const { data: s } = await supabase.from("long_form_script_versions").select("id, status, script_document, research_version_id, story_plan_version_id").eq("id", scriptId).maybeSingle();
      setScript(s);
      if (s?.story_plan_version_id) {
        const { data: v } = await supabase.from("long_form_story_plan_versions").select("story_plan").eq("id", s.story_plan_version_id).maybeSingle();
        setPlan(v?.story_plan ?? null);
      }
      if (s?.research_version_id) {
        const { data: src } = await supabase.from("long_form_research_sources").select("id, title, url").eq("research_version_id", s.research_version_id).limit(40);
        setSources(src ?? []);
      }
    })();
  }, [projectId]);

  const doc = script?.script_document ?? null;
  const wpm = wordsPerMinuteFor(null).wordsPerMinute;
  const sections = useMemo(() => {
    if (!doc) return [];
    const segs = new Map((doc.narrationSegments ?? []).map((s) => [s.id, s]));
    const chapters = doc.chapters?.length ? doc.chapters : [{ title: doc.title, segmentIds: (doc.narrationSegments ?? []).map((s) => s.id) }];
    const list = readableSections(chapters, plan?.chapters ?? []).map((c) => ({ title: c.title, text: c.segmentIds.map((id) => cleanText(segs.get(id)?.text ?? "")).filter(Boolean) }));
    const { parts } = sectionSeconds(list.map((s) => words(s.text.join(" "))), wpm);
    return list.map((s, i) => ({ ...s, seconds: parts[i] }));
  }, [doc, wpm, plan]);
  const totalWords = sections.reduce((n, s) => n + words(s.text.join(" ")), 0);
  const totalSeconds = sections.reduce((n, s) => n + s.seconds, 0);
  const targetMinutes = project?.resolved_length_minutes ?? project?.custom_length_minutes ?? null;

  const claims = doc?.claims ?? [];
  const verdicts = new Map((doc?.claimVerification ?? []).map((v) => [v.claimId, v.verdict]));
  const verified = claims.filter((c) => /support/i.test(String(verdicts.get(c.id) ?? ""))).length;

  const title = cleanUserText(project?.selected_title || doc?.title || plan?.recommendedTitle || "");
  const alternatives = [plan?.recommendedTitle, ...(plan?.alternativeTitles ?? []), doc?.title].map(cleanUserText).filter((t, i, a) => t && t !== title && a.indexOf(t) === i);

  const chooseTitle = async (t) => {
    setBusy("title");
    if (await selectStoryTitle(projectId, t)) setProject((p) => ({ ...p, selected_title: t }));
    setBusy(null);
    setShowAlts(false);
  };
  const onRegenerate = async () => {
    setBusy("regen");
    const r = await regenerateScript(projectId);
    setBusy(null);
    if (!r.ok) return setError(r.message);
    navigate(`/long-form/project/${projectId}/writing`);
  };
  const onContinue = async () => {
    setBusy("voice");
    const r = await lockStory(projectId);
    setBusy(null);
    if (!r.ok) return setError(r.message ?? "Couldn't continue. Try again.");
    navigate(`/long-form/project/${projectId}/narration`);
  };

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8 pb-32 lg:px-8 lg:py-10">
      <LongFormCreationHeader current="script-review" project={project} stickman />
      {!doc ? (
        <p className="py-20 text-center text-[13.5px] text-white/45">Loading your script…</p>
      ) : (
        <>
          <header className="mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">Your script</p>
            <h1 className="mt-1 text-[28px] font-bold leading-tight text-white">{title}</h1>
            {alternatives.length > 0 && (
              <div className="mt-2">
                <button type="button" onClick={() => setShowAlts((s) => !s)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-lime-300">
                  See alternatives <ChevronDown className={`h-3.5 w-3.5 transition ${showAlts ? "rotate-180" : ""}`} />
                </button>
                {showAlts && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {alternatives.map((t) => (
                      <button key={t} type="button" disabled={busy === "title"} onClick={() => chooseTitle(t)} className="rounded-lg border border-white/10 px-3 py-1.5 text-[12.5px] text-white/75 hover:border-lime-300/40">{t}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <p className="mt-3 text-[13px] text-white/50">
              {totalWords.toLocaleString("en-US")} words · about <span className="tabular-nums">{formatClock(totalSeconds)}</span> at the default voice pace
              {targetMinutes ? <> · you chose <span className="tabular-nums">{formatClock(targetMinutes * 60)}</span></> : null}
            </p>
          </header>

          {/* Fact-check summary */}
          {claims.length > 0 && (
            <section className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              <button type="button" onClick={() => setShowFacts((s) => !s)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                <span className="inline-flex items-center gap-2 text-[13.5px] font-bold text-white"><BadgeCheck className="h-4 w-4 text-lime-300" />{verified} of {claims.length} facts verified{sources.length ? ` · ${sources.length} sources` : ""}</span>
                <ChevronDown className={`h-4 w-4 text-white/40 transition ${showFacts ? "rotate-180" : ""}`} />
              </button>
              {showFacts && (
                <div className="space-y-4 px-4 pb-4">
                  <ul className="space-y-1.5">
                    {claims.map((c) => (
                      <li key={c.id} className="flex gap-2 text-[12.5px] text-white/70">
                        {/support/i.test(String(verdicts.get(c.id) ?? "")) ? <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-300" /> : <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />}
                        {cleanUserText(c.claim)}
                      </li>
                    ))}
                  </ul>
                  {sources.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">Sources</p>
                      <ul className="space-y-1">
                        {sources.map((s) => (
                          <li key={s.id} className="text-[12.5px]">
                            <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-white/65 hover:text-lime-300">
                              {cleanUserText(s.title) || new URL(s.url).hostname}<ExternalLink className="h-3 w-3" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* The script, in readable sections */}
          <article className="space-y-7">
            {sections.map((s, i) => (
              <section key={i}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h2 className="text-[16px] font-bold text-white">{s.title}</h2>
                  <span className="shrink-0 text-[12px] tabular-nums text-white/35">{formatClock(s.seconds)}</span>
                </div>
                {s.text.map((p, k) => <p key={k} className="mb-3 text-[15px] leading-relaxed text-white/80">{p}</p>)}
              </section>
            ))}
          </article>

          {error && <p className="mt-6 text-[13px] text-amber-300">{error}</p>}
          {/* Phase 6e: the Script panel of the Editor — read-only (editing + re-voice come later). */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.06] bg-[#090A0A]/95 px-4 py-3 backdrop-blur-md">
            <div className="mx-auto flex max-w-[820px] items-center justify-end gap-3">
              <button type="button" onClick={() => navigate(`/long-form/project/${projectId}/edit`)} className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-2.5 text-[14px] font-bold text-black">
                Back to Edit <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
