// src/components/image/ImageToolSettingsModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/* --- destination icons (safe optional requires) --- */
import igIcon   from "../../assets/icons/instagram.png";
import ttIcon   from "../../assets/icons/tiktok.png";
import pinIcon  from "../../assets/icons/pinterest.png";
import ownIcon  from "../../assets/icons/ownpicture.png";
import wallIcon from "../../assets/icons/wallpaper.png";
let ytIcon, webIcon, shopifyIcon;
try { ytIcon      = require("../../assets/icons/youtube.png"); } catch {}
try { webIcon     = require("../../assets/icons/website.png"); } catch {}
try { shopifyIcon = require("../../assets/icons/shopify.png"); } catch {}

/* =======================================================================
   Mini tokens
======================================================================= */
const field     = "w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-[15px] text-black outline-none placeholder-black/40";
const label     = "mb-1 block text-xs font-semibold text-black/60";
const row2      = "grid grid-cols-1 md:grid-cols-2 gap-4";
const row3      = "grid grid-cols-1 md:grid-cols-3 gap-4";
const softBtn   = "inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-semibold text-black hover:bg-black/[0.04]";
const primaryBtn= "rounded-full bg-black px-5 py-2 text-sm font-semibold text-white hover:opacity-90";

/* =======================================================================
   Sheen style pills
======================================================================= */
const STYLE_COLORS = {
  "Cinematic":        ["#000000","#d1d5db"],
  "Pixar-ish":        ["#9ec5ff","#3b82f6"],
  "Anime":            ["#86efac","#10b981"],
  "Comic":            ["#fde68a","#f59e0b"],
  "Claymation":       ["#e5e7eb","#6b7280"],
  "Low-poly":         ["#bfdbfe","#60a5fa"],
  "Neon/Glitch":      ["#d8b4fe","#8b5cf6"],
  "Noir":             ["#ffffff","#111827"],
  "Realistic filmic": ["#f59e0b","#92400e"],
};
const ALL_STYLES = Object.keys(STYLE_COLORS);

const sheenCSS = `
@keyframes zyloSheen{0%{background-position:0% 50%}100%{background-position:200% 50%}}
.z-sheen{background-size:200% 100%;animation:zyloSheen 6s linear infinite}
`;

/* =======================================================================
   Destination options
======================================================================= */
const DESTS_BASE = [
  { id: "own-use",        label: "Own use",           icon: ownIcon },
  { id: "instagram",      label: "Instagram post",    icon: igIcon  },
  { id: "youtube-thumb",  label: "YouTube thumbnail", icon: ytIcon  },
  { id: "tiktok",         label: "TikTok",            icon: ttIcon  },
  { id: "pinterest",      label: "Pinterest",         icon: pinIcon },
  { id: "website-banner", label: "Website banner",    icon: webIcon },
  { id: "wallpaper",      label: "Wallpaper",         icon: wallIcon},
];
const DESTS_LOGO_EXTRA = [
  { id: "shopify",        label: "Shopify",           icon: shopifyIcon },
];

/* =======================================================================
   Component
======================================================================= */
export default function ImageToolSettingsModal({
  open,
  kind = "image",               // "image" | "thumbnail" | "logo" | "irl" | "upscaler"
  defaults = {},
  onClose,
  onProceed,
}) {
  const [values, setValues] = useState(makeDefaults(kind));

  // dropdown toggles & file refs
  const sizeOpen      = useToggle(false);
  const styleOpen     = useToggle(false);
  const destOpen      = useToggle(false);
  const overlayAdv    = useToggle(false);
  const imgInputRef   = useRef(null);
  const bgInputRef    = useRef(null);
  const overInputRef  = useRef(null);

  // always call hooks – don’t early return before this
  useEffect(() => {
    setValues({ ...makeDefaults(kind), ...defaults });
  }, [kind, defaults, open]);

  // build destinations (Shopify only for logo)
  const destinations = useMemo(() => {
    return kind === "logo" ? [...DESTS_BASE, ...DESTS_LOGO_EXTRA] : DESTS_BASE;
  }, [kind]);

  const needsImage = kind === "irl" || kind === "upscaler";
  const disabledProceed = needsImage && !values.refImageUrl;

  const upscalerMuted = kind === "upscaler" ? "opacity-50 pointer-events-none" : "";

  function submit() {
    if (disabledProceed) return;
    onProceed?.({ tool: kind, values });
  }

  return (
    <>
      <style>{sheenCSS}</style>
      {!open ? null : (
        <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-[1px]">
          <div className="mx-auto mt-8 w-[min(980px,95vw)] rounded-2xl bg-white text-black shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/10">
              <div className="text-sm text-black/60">{titleFor(kind)}</div>
              <button
                onClick={onClose}
                className="h-8 w-8 grid place-items-center rounded-full border border-black/10 bg-white text-black hover:bg-black/[0.04]"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Base settings */}
              <section className="space-y-4">
                <h3 className="text-[13px] font-bold text-black/70 tracking-wide uppercase">Base settings</h3>

                <div className={row2}>
                  {/* Prompt / Mood */}
                  <div className={upscalerMuted}>
                    <label className={label}>Prompt / Subject</label>
                    <input
                      className={field}
                      placeholder='e.g., 3D cartoon cat, soft lighting, cute'
                      value={values.topic}
                      onChange={(e) => setValues((v) => ({ ...v, topic: e.target.value }))}
                    />
                  </div>

                  <div className={upscalerMuted}>
                    <label className={label}>Mood (optional)</label>
                    <input
                      className={field}
                      placeholder="e.g., dreamy, dark, vibrant"
                      value={values.mood}
                      onChange={(e) => setValues((v) => ({ ...v, mood: e.target.value }))}
                    />
                  </div>

                  {/* Style / Size */}
                  <div className={upscalerMuted}>
                    <label className={label}>Style</label>
                    <StyleDropdown
                      open={styleOpen.value}
                      setOpen={styleOpen.set}
                      value={values.style}
                      onPick={(s) => setValues((v) => ({ ...v, style: s }))}
                      styles={ALL_STYLES}
                    />
                  </div>

                  <div>
                    <label className={label}>Size</label>
                    <SizeDropdown
                      open={sizeOpen.value}
                      setOpen={sizeOpen.set}
                      value={values.size}
                      onPick={(s) => setValues((v) => ({ ...v, size: s }))}
                      onCustom={(w, h) => setValues((v) => ({ ...v, size: `${w}x${h} (custom)` }))}
                    />
                  </div>

                  {/* Destination / Overlay */}
                  <div className={upscalerMuted}>
                    <label className={label}>Destination / Platform</label>
                    <DestinationDropdown
                      open={destOpen.value}
                      setOpen={destOpen.set}
                      value={values.destination}
                      onPick={(id) => setValues((v) => ({ ...v, destination: id }))}
                      options={destinations}
                    />
                  </div>

                  <div className={upscalerMuted}>
                    <label className={label}>Overlay Text (optional)</label>
                    <input
                      className={field}
                      placeholder='e.g., "SALE 50%"'
                      value={values.overlayText}
                      onChange={(e) => setValues((v) => ({ ...v, overlayText: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={overlayAdv.toggle}
                      className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                    >
                      {overlayAdv.value ? "Hide" : "Show"} overlay text options
                    </button>
                    {overlayAdv.value && (
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <div className={label}>Font</div>
                          <select
                            className={field}
                            value={values.overlayFont}
                            onChange={(e) => setValues((v) => ({ ...v, overlayFont: e.target.value }))}
                          >
                            {["Inter", "Poppins", "Montserrat", "Roboto", "DM Sans", "Oswald"].map((f) => (
                              <option key={f}>{f}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div className={label}>Size</div>
                          <input
                            type="number"
                            className={field}
                            min={10}
                            max={200}
                            value={values.overlaySize}
                            onChange={(e) =>
                              setValues((v) => ({ ...v, overlaySize: Number(e.target.value || 0) }))
                            }
                          />
                        </div>
                        <div>
                          <div className={label}>Color</div>
                          <input
                            type="color"
                            className="h-10 w-full rounded-lg border border-black/10"
                            value={values.overlayColor}
                            onChange={(e) => setValues((v) => ({ ...v, overlayColor: e.target.value }))}
                          />
                        </div>
                        <div>
                          <div className={label}>Position</div>
                          <select
                            className={field}
                            value={values.overlayPos}
                            onChange={(e) => setValues((v) => ({ ...v, overlayPos: e.target.value }))}
                          >
                            {[
                              "top-left",
                              "top-center",
                              "top-right",
                              "center",
                              "bottom-left",
                              "bottom-center",
                              "bottom-right",
                            ].map((p) => (
                              <option key={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Import Image */}
                  <div className="md:col-span-2">
                    <label className={label}>
                      {needsImage ? "Import image (required)" : "Import image (optional)"}
                    </label>
                    <UploadBox
                      fileInputRef={imgInputRef}
                      url={values.refImageUrl}
                      onPick={(url) => setValues((v) => ({ ...v, refImageUrl: url }))}
                      dashed={needsImage}
                      required={needsImage}
                    />
                  </div>
                </div>
              </section>

              {/* Tool-specific sections */}
              {kind === "image" && (
                <section className="space-y-4">
                  <h3 className="text-[13px] font-bold text-black/70 tracking-wide uppercase">Advanced controls</h3>
                  <div className={row3}>
                    <SelectLabeled
                      labelText="Detail level"
                      value={values.detailLevel}
                      setValue={(x) => setValues((v) => ({ ...v, detailLevel: x }))}
                      options={["Low", "Medium", "High"]}
                    />
                    <SelectLabeled
                      labelText="Lighting"
                      value={values.lighting}
                      setValue={(x) => setValues((v) => ({ ...v, lighting: x }))}
                      options={["auto", "natural", "studio", "neon", "dramatic"]}
                    />
                    <SelectLabeled
                      labelText="Background"
                      value={values.bgMode}
                      setValue={(x) => setValues((v) => ({ ...v, bgMode: x }))}
                      options={["auto", "remove", "custom color", "upload"]}
                    />
                  </div>

                  {values.bgMode === "custom color" && (
                    <div className="w-44">
                      <label className={label}>Background color</label>
                      <input
                        type="color"
                        className="h-10 w-full rounded-lg border border-black/10"
                        value={values.bgColor}
                        onChange={(e) => setValues((v) => ({ ...v, bgColor: e.target.value }))}
                      />
                    </div>
                  )}

                  {values.bgMode === "upload" && (
                    <div className="w-full md:w-1/2">
                      <label className={label}>Background image</label>
                      <UploadBox
                        fileInputRef={bgInputRef}
                        url={values.bgImageUrl}
                        onPick={(url) => setValues((v) => ({ ...v, bgImageUrl: url }))}
                      />
                    </div>
                  )}
                </section>
              )}

              {kind === "thumbnail" && (
                <section className="space-y-4">
                  <h3 className="text-[13px] font-bold text-black/70 tracking-wide uppercase">Thumbnail layout</h3>

                  <div className={row3}>
                    <SelectLabeled
                      labelText="Platform"
                      value={values.platform}
                      setValue={(x) => setValues((v) => ({ ...v, platform: x }))}
                      options={["YouTube", "TikTok", "Instagram"]}
                    />
                    <InputLabeled
                      labelText="Headline text"
                      value={values.headline}
                      setValue={(x) => setValues((v) => ({ ...v, headline: x }))}
                      placeholder='e.g., "10 Tips To Grow"'
                    />
                    <SelectLabeled
                      labelText="Position method"
                      value={values.thumbPosition}
                      setValue={(x) => setValues((v) => ({ ...v, thumbPosition: x }))}
                      options={["grid", "drag-and-drop"]}
                    />
                  </div>

                  <div className={row3}>
                    <ToggleLabeled
                      labelText="Show safe zone overlay (YouTube)"
                      checked={values.safeZone}
                      setChecked={(b) => setValues((v) => ({ ...v, safeZone: b }))}
                    />
                    <div className="md:col-span-2">
                      <label className={label}>Import overlay/logo</label>
                      <UploadBox
                        fileInputRef={overInputRef}
                        url={values.overlayLogoUrl}
                        onPick={(url) => setValues((v) => ({ ...v, overlayLogoUrl: url }))}
                        dashed
                      />
                    </div>
                  </div>
                </section>
              )}

              {kind === "logo" && (
                <section className="space-y-5">
                  <h3 className="text-[13px] font-bold text-black/70 tracking-wide uppercase">Brand & drawing</h3>

                  <div className={row3}>
                    <SelectLabeled
                      labelText="Brand mode"
                      value={values.brandMode}
                      setValue={(x) => setValues((v) => ({ ...v, brandMode: x }))}
                      options={["no-brand", "choose-brand", "create-brand"]}
                    />
                    {values.brandMode !== "no-brand" && (
                      <InputLabeled
                        labelText={values.brandMode === "choose-brand" ? "Select brand" : "New brand name"}
                        value={values.brand}
                        setValue={(x) => setValues((v) => ({ ...v, brand: x }))}
                        placeholder="e.g., Zylo Snacks"
                      />
                    )}
                    <InputLabeled
                      labelText="Slogan (optional)"
                      value={values.slogan}
                      setValue={(x) => setValues((v) => ({ ...v, slogan: x }))}
                      placeholder='e.g., "Fresh. Fast. Fun."'
                    />
                  </div>

                  <div className={row3}>
                    <RangeLabeled
                      labelText="Brush thickness"
                      min={1}
                      max={20}
                      value={values.brush}
                      setValue={(n) => setValues((v) => ({ ...v, brush: n }))}
                    />
                    <div>
                      <label className={label}>Brush color</label>
                      <input
                        type="color"
                        className="h-10 w-full rounded-lg border border-black/10"
                        value={values.brushColor}
                        onChange={(e) => setValues((v) => ({ ...v, brushColor: e.target.value }))}
                      />
                    </div>
                    <SelectLabeled
                      labelText="Shape preset"
                      value={values.shape}
                      setValue={(x) => setValues((v) => ({ ...v, shape: x }))}
                      options={["none", "circle", "square", "shield", "abstract"]}
                    />
                  </div>

                  <div className={row3}>
                    <InputLabeled
                      labelText="Text for logo"
                      value={values.logoText}
                      setValue={(x) => setValues((v) => ({ ...v, logoText: x }))}
                      placeholder="Brand or monogram"
                    />
                    <SelectLabeled
                      labelText="Font"
                      value={values.logoFont}
                      setValue={(x) => setValues((v) => ({ ...v, logoFont: x }))}
                      options={["Inter", "Poppins", "Montserrat", "Oswald", "Bebas Neue"]}
                    />
                    <ToggleLabeled
                      labelText="Bold / heavy"
                      checked={values.logoBold}
                      setChecked={(b) => setValues((v) => ({ ...v, logoBold: b }))}
                    />
                  </div>

                  <div className={row3}>
                    <div>
                      <label className={label}>Gradient start</label>
                      <input
                        type="color"
                        className="h-10 w-full rounded-lg border border-black/10"
                        value={values.gradA}
                        onChange={(e) => setValues((v) => ({ ...v, gradA: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className={label}>Gradient end</label>
                      <input
                        type="color"
                        className="h-10 w-full rounded-lg border border-black/10"
                        value={values.gradB}
                        onChange={(e) => setValues((v) => ({ ...v, gradB: e.target.value }))}
                      />
                    </div>
                    <InputLabeled
                      labelText="Palette (comma colors)"
                      value={values.colors}
                      setValue={(x) => setValues((v) => ({ ...v, colors: x }))}
                      placeholder="#111827,#1677FF"
                    />
                  </div>
                </section>
              )}

              {kind === "irl" && (
                <section className="space-y-4">
                  <h3 className="text-[13px] font-bold text-black/70 tracking-wide uppercase">IRL photo requirements</h3>
                  <p className="text-sm text-black/70">
                    Upload a clear photo (face visible). We’ll keep identity and stylize it.
                  </p>
                  <div className={row3}>
                    <SelectLabeled
                      labelText="Theme"
                      value={values.theme}
                      setValue={(x) => setValues((v) => ({ ...v, theme: x }))}
                      options={["Pixar-ish", "Anime", "Comic", "Realistic filmic", "Claymation", "Noir"]}
                    />
                    <SelectLabeled
                      labelText="Subject"
                      value={values.subjectKind}
                      setValue={(x) => setValues((v) => ({ ...v, subjectKind: x }))}
                      options={["portrait", "half-body", "full-body", "fashion"]}
                    />
                    <ToggleLabeled
                      labelText="Subtle stylization (keep more details)"
                      checked={values.subtle}
                      setChecked={(b) => setValues((v) => ({ ...v, subtle: b }))}
                    />
                  </div>
                  <div className="w-full md:w-1/2">
                    <label className={label}>Import photo (required)</label>
                    <UploadBox
                      required
                      dashed
                      fileInputRef={imgInputRef}
                      url={values.refImageUrl}
                      onPick={(url) => setValues((v) => ({ ...v, refImageUrl: url }))}
                    />
                  </div>
                </section>
              )}

              {kind === "upscaler" && (
                <section className="space-y-4">
                  <h3 className="text-[13px] font-bold text-black/70 tracking-wide uppercase">Upscaling controls</h3>
                  <div className={row3}>
                    <SelectLabeled
                      labelText="Scale"
                      value={values.scale}
                      setValue={(x) => setValues((v) => ({ ...v, scale: x }))}
                      options={["2x", "4x", "8x"]}
                    />
                    <ToggleLabeled
                      labelText="Face enhance"
                      checked={values.face}
                      setChecked={(b) => setValues((v) => ({ ...v, face: b }))}
                    />
                    <ToggleLabeled
                      labelText="Reduce noise"
                      checked={values.denoise}
                      setChecked={(b) => setValues((v) => ({ ...v, denoise: b }))}
                    />
                  </div>
                  <div className="w-full md:w-1/2">
                    <label className={label}>Pick an image (required)</label>
                    <UploadBox
                      required
                      dashed
                      fileInputRef={imgInputRef}
                      url={values.refImageUrl}
                      onPick={(url) => setValues((v) => ({ ...v, refImageUrl: url }))}
                    />
                  </div>
                </section>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-black/10 px-6 py-4">
              <button className={softBtn} onClick={onClose}>Back</button>
              <button className={primaryBtn} disabled={disabledProceed} onClick={submit}>
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* =======================================================================
   Sub-components
======================================================================= */
function useToggle(init = false) {
  const [value, set] = useState(init);
  return { value, set: (v) => set(typeof v === "function" ? v(value) : v), toggle: () => set((v) => !v) };
}

function DestinationDropdown({ open, setOpen, value, onPick, options = DESTS_BASE }) {
  const sel = options.find((d) => d.id === value)?.label || "Own use";
  return (
    <div className="relative">
      <button
        type="button"
        className="w-full h-10 inline-flex items-center justify-between rounded-lg border border-black/10 bg-white px-3 text-[15px] text-black hover:bg-black/[0.03]"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="truncate">{sel}</span><span>▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-black/10 bg-white p-2 shadow-xl">
          {options.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => { onPick(d.id); setOpen(false); }}
              className="w-full flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-black/[0.04]"
            >
              {d.icon ? <img src={d.icon} className="h-5 w-5 rounded" alt="" /> : <div className="h-5 w-5 rounded bg-black/10" />}
              <span className="text-[14px]">{d.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SizeDropdown({ open, setOpen, value, onPick, onCustom }) {
  const base = ["512x512", "1024x1024", "1280x720 (16:9)", "1920x1080 (16:9)"];
  const isCustom = /custom\)$/.test(value || "");
  const [w, setW] = useState(1024);
  const [h, setH] = useState(1024);

  useEffect(() => {
    if (isCustom) {
      const m = value.match(/(\d+)x(\d+)/);
      if (m) { setW(+m[1]); setH(+m[2]); }
    }
  }, [value, isCustom]);

  return (
    <div className="relative">
      <button
        type="button"
        className="w-full h-10 inline-flex items-center justify-between rounded-lg border border-black/10 bg-white px-3 text-[15px] text-black hover:bg-black/[0.03]"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="truncate">{value}</span><span>▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-black/10 bg-white p-2 shadow-xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {base.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { onPick(s); setOpen(false); }}
                className="flex flex-col items-center gap-1 rounded-lg border p-2 text-sm shadow-sm hover:bg-black/[0.03]"
              >
                <BoxPreview label={s} />
              </button>
            ))}
          </div>

          <div className="mt-3 border-t pt-3">
            <div className="text-xs font-semibold text-black/60 mb-2">Custom</div>
            <div className="flex items-center gap-2">
              <input type="number" min={64} className={field} value={w} onChange={(e) => setW(+e.target.value)} />
              <span className="text-black/60">×</span>
              <input type="number" min={64} className={field} value={h} onChange={(e) => setH(+e.target.value)} />
              <button className={softBtn} onClick={() => { onCustom(w, h); setOpen(false); }}>Set</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BoxPreview({ label }) {
  const [W, H] = label.split(" ")[0].split("x").map(Number);
  const isSquare = W === H;
  const isLand = W > H;
  const size  = isSquare ? 48 : (isLand ? 64 : 36);
  const sizeH = isSquare ? 48 : (isLand ? 36 : 64);
  return (
    <>
      <div className="rounded-md bg-gradient-to-br from-neutral-100 to-white shadow-inner" style={{ width: size, height: sizeH }} />
      <div className="text-[12px] font-medium">{label}</div>
    </>
  );
}

function StyleDropdown({ open, setOpen, value, onPick, styles }) {
  return (
    <div className="relative">
      <button
        type="button"
        className="w-full h-10 inline-flex items-center justify-between rounded-lg border border-black/10 bg-white px-3 text-[15px] text-black hover:bg-black/[0.03]"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="truncate">{value}</span><span>▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-black/10 bg-white p-2 shadow-xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {styles.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { onPick(s); setOpen(false); }}
                className={[
                  "w-full rounded-lg px-3 py-2 text-[14px] font-semibold border",
                  value === s ? "border-blue-500 ring-2 ring-blue-200" : "border-black/10",
                ].join(" ")}
                style={{
                  backgroundImage: `linear-gradient(90deg, ${STYLE_COLORS[s]?.[0] || "#e5e7eb"}, ${STYLE_COLORS[s]?.[1] || "#fff"})`,
                }}
              >
                <span className="z-sheen inline-block w-full text-center">{s}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UploadBox({ fileInputRef, url, onPick, dashed = false, required = false }) {
  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const blob = URL.createObjectURL(f); // preview URL; swap for real uploader if needed
    onPick?.(blob);
  }
  return (
    <div
      className={[
        "cursor-pointer rounded-lg border px-4 py-6 text-sm",
        dashed ? "border-dashed border-black/20" : "border-black/10",
        required && !url ? "ring-2 ring-red-200" : "",
      ].join(" ")}
      onClick={() => fileInputRef.current?.click()}
    >
      {url ? (
        <div className="flex items-center gap-3">
          <img src={url} alt="" className="h-14 w-14 rounded object-cover" />
          <div>Image selected — click to replace</div>
        </div>
      ) : (
        "Click to upload"
      )}
      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onFile} />
    </div>
  );
}

function InputLabeled({ labelText, value, setValue, placeholder }) {
  return (
    <div>
      <label className={label}>{labelText}</label>
      <input className={field} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
function SelectLabeled({ labelText, value, setValue, options }) {
  return (
    <div>
      <label className={label}>{labelText}</label>
      <select className={field} value={value} onChange={(e) => setValue(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
function ToggleLabeled({ labelText, checked, setChecked }) {
  const id = `tg-${labelText.replace(/\W+/g, "")}`;
  return (
    <div className="flex items-center gap-2">
      <input id={id} type="checkbox" className="h-4 w-4" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
      <label htmlFor={id} className="text-[14px] text-black/80">{labelText}</label>
    </div>
  );
}
function RangeLabeled({ labelText, value, setValue, min = 0, max = 100 }) {
  return (
    <div>
      <label className={label}>{labelText}</label>
      <input type="range" className="w-full" min={min} max={max} value={value} onChange={(e) => setValue(+e.target.value)} />
      <div className="text-xs text-black/60 mt-1">{value}</div>
    </div>
  );
}

/* =======================================================================
   Defaults & titles
======================================================================= */
function makeDefaults(kind) {
  const base = {
    topic: "",
    mood: "",
    style: "Cinematic",
    size: "1024x1024",
    destination: "own-use",
    overlayText: "",
    overlayFont: "Inter",
    overlaySize: 52,
    overlayColor: "#111111",
    overlayPos: "bottom-center",
    refImageUrl: "",
  };
  switch (kind) {
    case "image":
      return {
        ...base,
        detailLevel: "Medium",
        lighting: "auto",
        bgMode: "auto",
        bgColor: "#ffffff",
        bgImageUrl: "",
      };
    case "thumbnail":
      return {
        ...base,
        platform: "YouTube",
        headline: "",
        thumbPosition: "grid",
        safeZone: true,
        overlayLogoUrl: "",
      };
    case "logo":
      return {
        ...base,
        brandMode: "no-brand",
        brand: "",
        slogan: "",
        colors: "#111827,#1677FF",
        brush: 6,
        brushColor: "#111111",
        shape: "none",
        logoText: "",
        logoFont: "Inter",
        logoBold: true,
        gradA: "#111827",
        gradB: "#1677FF",
      };
    case "irl":
      return {
        ...base,
        theme: "Pixar-ish",
        subjectKind: "portrait",
        subtle: false,
      };
    case "upscaler":
      return {
        ...base,
        // base fields kept to avoid code divergence (most inputs muted)
        topic: "",
        mood: "",
        style: "Cinematic",
        scale: "2x",
        face: true,
        denoise: true,
        refImageUrl: "",
      };
    default:
      return base;
  }
}

function titleFor(kind) {
  switch (kind) {
    case "thumbnail": return "Thumbnail Creator — platform & layout";
    case "logo":      return "Logo Creator — brand & drawing";
    case "irl":       return "IRL → AI Photo — theme & photo";
    case "upscaler":  return "Upscaler (HD) — scale & enhance";
    default:          return "Image Creator — describe & fine-tune";
  }
}
