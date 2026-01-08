import React, { useEffect, useMemo } from "react";
import { cn } from "./ui";

export default function Step4Ad({
  sceneCount,
  scriptTone, setScriptTone,
  music, setMusic,
  language, setLanguage,
  shot, setShot,
  visuals, setVisuals,
  onText, setOnText,
  camera, setCamera,
  lighting, setLighting,
  sfx, setSfx,
  notes, setNotes,
  cameraOpts, lightingOpts, sfxOpts,
  cameraOther, setCameraOther,
  lightingOther, setLightingOther,
  sfxOther, setSfxOther,
}) {
  // ---- SAFE option arrays (prevents .map on undefined) ----
  const camOpts = Array.isArray(cameraOpts) && cameraOpts.length
    ? cameraOpts
    : ["macro, slow dolly-in", "handheld, eye-level", "locked-off", "gimbal pan, slow", "Other…"];
  const lightOpts = Array.isArray(lightingOpts) && lightingOpts.length
    ? lightingOpts
    : ["soft daylight", "window light + soft fill", "even studio", "soft, warm", "Other…"];
  const sfxAll = Array.isArray(sfxOpts) && sfxOpts.length
    ? sfxOpts
    : ["None", "soft whoosh", "button tap", "subtle shimmer", "Other…"];

  // ---- Suggested placeholders ----
  const SUGGEST = {
    tone: "friendly, trustworthy, concise",
    music: "uplifting acoustic pop",
    visuals: "Natural daylight, soft bokeh; gentle dolly-in.",
    onText: "Instant glow",
  };
  const showPlaceholder = (val, suggestion) =>
    (val == null || String(val).trim() === "" || String(val) === suggestion) ? "" : val;

  // English only
  const LANGS = useMemo(() => [{ v: "en", label: "English" }], []);
  useEffect(() => {
    if (language !== "en") setLanguage("en");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const RequiredMark = ({ show }) =>
    show ? (
      <span className="ml-1 inline-flex items-center rounded px-1.5 py-[1px] text-[10px] font-semibold bg-amber-400/20 text-amber-300 border border-amber-300/40">
        !
      </span>
    ) : null;

  const toneMissing = !String(scriptTone || "").trim() || scriptTone === SUGGEST.tone;

  return (
    <div className="space-y-5">
      <div className="text-base font-semibold">
        <span className="mr-1">4)</span>{" "}
        <span className="font-extrabold">Creative details</span>
      </div>

      {/* Top row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <div className="mb-1 text-xs text-white/70 font-semibold">
            Script tone <RequiredMark show={toneMissing} />
          </div>
          <input
            value={showPlaceholder(scriptTone, SUGGEST.tone)}
            onChange={(e) => setScriptTone(e.target.value)}
            placeholder={SUGGEST.tone}
            className={cn(
              "w-full rounded-xl border bg-white/[.06] px-3 py-2 text-sm outline-none placeholder-white/40 focus:ring-2 focus:ring-[#7A3BFF]",
              toneMissing ? "border-amber-300/40" : "border-white/15"
            )}
          />
        </div>

        <div>
          <div className="mb-1 text-xs text-white/70 font-semibold">Music (optional)</div>
          <input
            value={showPlaceholder(music, SUGGEST.music)}
            onChange={(e) => setMusic(e.target.value)}
            placeholder={SUGGEST.music}
            className="w-full rounded-xl border border-white/15 bg-white/[.06] px-3 py-2 text-sm outline-none placeholder-white/40 focus:ring-2 focus:ring-[#7A3BFF]"
          />
        </div>

        <div>
          <div className="mb-1 text-xs text-white/70 font-semibold">Language</div>
          <select
            value="en"
            onChange={() => setLanguage("en")}
            className="w-full rounded-xl border border-white/15 bg-white/[.06] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF]"
          >
            {LANGS.map((l) => (
              <option key={l.v} value={l.v}>{l.label}</option>
            ))}
          </select>
          <div className="mt-1 text-[11px] text-white/60">Only English is available for now.</div>
        </div>
      </div>

      {/* Per-scene boxes */}
      <div className="rounded-2xl border border-white/12 bg-white/[.035] p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold">Per-scene boxes</div>
          <div className="text-xs text-white/60">
            Scenes: <span className="font-semibold text-white">{sceneCount}</span>
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto pr-1 max-h-[56vh] sm:max-h-[52vh] md:max-h-[50vh]">
          {Array.from({ length: sceneCount }).map((_, i) => {
            const camIsOther = (camera?.[i] ?? camOpts[0]) === "Other…";
            const lightIsOther = (lighting?.[i] ?? lightOpts[0]) === "Other…";
            const sfxIsOther = (sfx?.[i] ?? sfxAll[0]) === "Other…";
            const visualsMissing =
              !String(visuals?.[i] || "").trim() || visuals?.[i] === SUGGEST.visuals;

            return (
              <div key={i} className="rounded-2xl border border-white/12 bg-white/[.03] p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-wide text-white/60 font-semibold">
                    Scene {i + 1} <RequiredMark show={visualsMissing} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Shot */}
                  <div>
                    <div className="mb-1 text-xs text-white/60">Shot</div>
                    <input
                      value={showPlaceholder(shot?.[i], "")}
                      onChange={(e) => {
                        const next = Array.isArray(shot) ? [...shot] : [];
                        next[i] = e.target.value;
                        setShot(next);
                      }}
                      placeholder="Macro close-up hero shot"
                      className="w-full rounded-xl border border-white/15 bg-white/[.06] px-3 py-2 text-sm outline-none placeholder-white/40 focus:ring-2 focus:ring-[#7A3BFF]"
                    />
                  </div>

                  {/* On-screen text */}
                  <div>
                    <div className="mb-1 text-xs text-white/60">On-screen text (optional)</div>
                    <input
                      value={showPlaceholder(onText?.[i], SUGGEST.onText)}
                      onChange={(e) => {
                        const next = Array.isArray(onText) ? [...onText] : [];
                        next[i] = e.target.value;
                        setOnText(next);
                      }}
                      placeholder={SUGGEST.onText}
                      className="w-full rounded-xl border border-white/15 bg-white/[.06] px-3 py-2 text-sm outline-none placeholder-white/40 focus:ring-2 focus:ring-[#7A3BFF]"
                    />
                  </div>

                  {/* Visuals / action (required) */}
                  <div className="sm:col-span-2">
                    <div className="mb-1 text-xs text-white/60">
                      Visuals / action <RequiredMark show={visualsMissing} />
                    </div>
                    <textarea
                      rows={2}
                      value={showPlaceholder(visuals?.[i], SUGGEST.visuals)}
                      onChange={(e) => {
                        const next = Array.isArray(visuals) ? [...visuals] : [];
                        next[i] = e.target.value;
                        setVisuals(next);
                      }}
                      placeholder={SUGGEST.visuals}
                      className={cn(
                        "w-full rounded-xl border bg-white/[.06] p-2.5 text-sm outline-none placeholder-white/40 focus:ring-2 focus:ring-[#7A3BFF]",
                        visualsMissing ? "border-amber-300/40" : "border-white/15"
                      )}
                    />
                  </div>

                  {/* Camera */}
                  <div>
                    <div className="text-xs text-white/60 mb-1">Camera</div>
                    <select
                      value={camera?.[i] ?? camOpts[0]}
                      onChange={(e) => {
                        const next = Array.isArray(camera) ? [...camera] : [];
                        next[i] = e.target.value;
                        setCamera(next);
                      }}
                      className="w-full rounded-xl border border-white/15 bg-white/[.06] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF]"
                    >
                      {camOpts.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    {camIsOther && (
                      <input
                        value={cameraOther?.[i] || ""}
                        onChange={(e) => {
                          const next = Array.isArray(cameraOther) ? [...cameraOther] : [];
                          next[i] = e.target.value;
                          setCameraOther(next);
                        }}
                        className="mt-2 w-full rounded-xl border border-white/12 bg-white/5 p-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF]"
                        placeholder="Describe camera movement…"
                      />
                    )}
                  </div>

                  {/* Lighting */}
                  <div>
                    <div className="text-xs text-white/60 mb-1">Lighting</div>
                    <select
                      value={lighting?.[i] ?? lightOpts[0]}
                      onChange={(e) => {
                        const next = Array.isArray(lighting) ? [...lighting] : [];
                        next[i] = e.target.value;
                        setLighting(next);
                      }}
                      className="w-full rounded-xl border border-white/15 bg-white/[.06] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF]"
                    >
                      {lightOpts.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    {lightIsOther && (
                      <input
                        value={lightingOther?.[i] || ""}
                        onChange={(e) => {
                          const next = Array.isArray(lightingOther) ? [...lightingOther] : [];
                          next[i] = e.target.value;
                          setLightingOther(next);
                        }}
                        className="mt-2 w-full rounded-xl border border-white/12 bg-white/5 p-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF]"
                        placeholder="Describe lighting…"
                      />
                    )}
                  </div>

                  {/* SFX */}
                  <div>
                    <div className="text-xs text-white/60 mb-1">SFX (optional)</div>
                    <select
                      value={sfx?.[i] ?? sfxAll[0]}
                      onChange={(e) => {
                        const next = Array.isArray(sfx) ? [...sfx] : [];
                        next[i] = e.target.value;
                        setSfx(next);
                      }}
                      className="w-full rounded-xl border border-white/15 bg-white/[.06] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF]"
                    >
                      {sfxAll.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    {sfxIsOther && (
                      <input
                        value={sfxOther?.[i] || ""}
                        onChange={(e) => {
                          const next = Array.isArray(sfxOther) ? [...sfxOther] : [];
                          next[i] = e.target.value;
                          setSfxOther(next);
                        }}
                        className="mt-2 w-full rounded-xl border border-white/12 bg-white/5 p-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF]"
                        placeholder="Describe the SFX…"
                      />
                    )}
                  </div>

                  {/* Notes */}
                  <div className="sm:col-span-2">
                    <div className="mb-1 text-xs text-white/60">Notes (optional)</div>
                    <input
                      value={showPlaceholder(notes?.[i], "")}
                      onChange={(e) => {
                        const next = Array.isArray(notes) ? [...notes] : [];
                        next[i] = e.target.value;
                        setNotes(next);
                      }}
                      placeholder="Keep label clear and centered"
                      className="w-full rounded-xl border border-white/15 bg-white/[.06] px-3 py-2 text-sm outline-none placeholder-white/40 focus:ring-2 focus:ring-[#7A3BFF]"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
