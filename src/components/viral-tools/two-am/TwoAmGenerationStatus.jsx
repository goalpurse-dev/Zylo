const PLANNER_STAGES = ["Understanding your world...", "Researching details...", "Planning the night..."];

export default function TwoAmGenerationStatus({ phase, plannerStage, scenes }) {
  const completed = scenes.filter((scene) => scene.status === "completed").length;
  const failed = scenes.filter((scene) => scene.status === "failed").length;
  const sceneProgress = scenes.length
    ? scenes.reduce(
      (total, scene) => total + Number(
        scene.progress ?? (scene.status === "completed" || scene.status === "failed" ? 100 : 0),
      ),
      0,
    ) / scenes.length
    : 0;
  const progress = phase === "planning"
    ? [0, 6, 12][plannerStage] ?? 12
    : Math.min(100, Math.round(15 + sceneProgress * 0.85));
  const label = phase === "planning"
    ? PLANNER_STAGES[plannerStage] || PLANNER_STAGES[2]
    : completed + failed >= 6
    ? "Finalizing slideshow..."
    : `${completed}/6 scenes ready`;

  return (
    <div className="rounded-2xl border border-lime-300/20 bg-lime-300/[0.055] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(190,242,100,.04)]">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-white">Creating your 2AM world...</p>
              <p className="mt-0.5 truncate text-[11px] text-lime-200/55">{label}</p>
            </div>
            <span className="shrink-0 text-xl font-black tabular-nums text-lime-300">{progress}%</span>
          </div>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/35"
            role="progressbar"
            aria-label="Overall slideshow progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-lime-300 to-lime-500 shadow-[0_0_12px_rgba(190,242,100,.45)] transition-[width] duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
