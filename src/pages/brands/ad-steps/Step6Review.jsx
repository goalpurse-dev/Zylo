import React from "react";

function Row({ label, value }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-28 shrink-0 text-white/60">{label}</div>
      <div className="flex-1">{value}</div>
    </div>
  );
}

function Kvp({ title, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
      <div className="text-xs text-white/60 mb-1">{title}</div>
      <div className="text-sm">{(value ?? "") !== "" ? value : "-"}</div>
    </div>
  );
}

export default function Step6Review(props) {
  const {
    model,
    // prompt, // you said you removed prompt; leaving it unused is fine
    segments = [],
    totalDurationSec,
    product,
    avatar,
    scriptTone,
    music,
    language,
    shot = [],
    visuals = [],
    onText = [],
    camera = [],
    lighting = [],
    sfx = [],
    notes = [],
    cameraOther = [],
    lightingOther = [],
    sfxOther = [],
  } = props;

  // Labels
  const modelLabel =
    model === "veo-3.1-fast" ? "V4 • Veo 3.1 fast" : "V5 • Sora";

  // Durations: be defensive
  const safeTotal = Number.isFinite(totalDurationSec)
    ? totalDurationSec
    : (segments[segments.length - 1]?.end ?? 8);

  // Helper to safely pull array value by index
  const at = (arr, i) => (Array.isArray(arr) ? arr[i] : undefined);

  return (
    <div className="space-y-4">
      <div className="text-base font-semibold">6) Review</div>

      <div className="rounded-xl border border-white/10 bg-white/[.03] p-3 text-sm space-y-2">
        <Row label="Model" value={modelLabel} />
        <Row
          label="Duration"
          value={`${safeTotal.toFixed(2)}s (0 → ${safeTotal.toFixed(2)}s)`}
        />
        <Row
          label="Product"
          value={
            product ? (
              <div className="flex items-center gap-2">
                {product._url ? (
                  <img
                    src={product._url}
                    alt=""
                    className="h-6 w-6 rounded object-cover"
                  />
                ) : null}
                <span className="font-medium">
                  {product.title || "Selected product"}
                </span>
              </div>
            ) : (
              "None"
            )
          }
        />
        <Row
          label="Avatar"
          value={avatar?.display_name || "Not selected"}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kvp title="Script tone" value={scriptTone} />
        <Kvp title="Music" value={music} />
        <Kvp title="Language" value={language} />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
        <div className="text-sm font-semibold mb-2">Scenes</div>
        <div className="space-y-2 text-sm">
          {(Array.isArray(segments) ? segments : []).map((seg, i) => {
            const camRaw = at(camera, i);
            const camOther = at(cameraOther, i);
            const cam = camRaw === "Other…" ? (camOther || "") : (camRaw || "");

            const lightRaw = at(lighting, i);
            const lightOther = at(lightingOther, i);
            const light =
              lightRaw === "Other…" ? (lightOther || "") : (lightRaw || "");

            const fxRaw = at(sfx, i);
            const fxOtherVal = at(sfxOther, i);
            const fx =
              fxRaw === "Other…" ? (fxOtherVal || "") : (fxRaw || "");

            const shotVal = at(shot, i) || "-";
            const visualsVal = at(visuals, i) || "-";
            const onTextVal = at(onText, i) || "-";
            const notesVal = at(notes, i) || "-";

            const start = Number.isFinite(seg?.start) ? seg.start : i * 2;
            const end = Number.isFinite(seg?.end) ? seg.end : start + 2;

            return (
              <div key={i} className="rounded-lg border border-white/10 p-2">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <div className="font-semibold text-white">Scene {i + 1}</div>
                  <div>
                    {start.toFixed(2)}s → {end.toFixed(2)}s
                  </div>
                </div>
                <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[13px]">
                  <div>
                    <span className="text-white/60">Shot:</span> {shotVal}
                  </div>
                  <div>
                    <span className="text-white/60">On-text:</span>{" "}
                    {onTextVal}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-white/60">Visuals:</span>{" "}
                    {visualsVal}
                  </div>
                  <div>
                    <span className="text-white/60">Camera:</span> {cam || "-"}
                  </div>
                  <div>
                    <span className="text-white/60">Lighting:</span>{" "}
                    {light || "-"}
                  </div>
                  <div>
                    <span className="text-white/60">SFX:</span>{" "}
                    {fx === "None" || fx === "" ? "-" : fx}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-white/60">Notes:</span> {notesVal}
                  </div>
                </div>
              </div>
            );
          })}
          {(!segments || segments.length === 0) && (
            <div className="text-white/60 text-sm">
              No scenes configured.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
