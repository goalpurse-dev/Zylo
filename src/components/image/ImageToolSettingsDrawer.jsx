// src/components/image/ImageToolSettingsDrawer.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Paintbrush, Upload, Image as ImageIcon } from "lucide-react";

/* ------- tiny helpers ------- */
function Section({ title, children, right }) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[12px] font-semibold uppercase tracking-wide text-black/60">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-black/60">{label}</div>
      {children}
    </label>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[15px] outline-none ${props.className || ""}`}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[15px] outline-none ${props.className || ""}`}
    />
  );
}

/* ---- simple file picker (returns blob URL) ---- */
function FilePicker({ value, onPick, accept = "image/*", placeholder = "Click to upload" }) {
  const inputRef = useRef(null);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      className="rounded-lg border border-dashed border-black/20 bg-white px-3 py-3 text-sm text-black/60 hover:bg-black/[.03] cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <span>{value ? "Image selected" : placeholder}</span>
        <Upload className="h-4 w-4 text-black/50" />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const url = URL.createObjectURL(f);
          onPick?.(url, f);
        }}
      />
      {value && (
        <div className="mt-2">
          <img src={value} alt="" className="h-28 w-auto rounded-md border border-black/10 object-contain" />
        </div>
      )}
    </div>
  );
}

/* ---- lightweight draw pad → dataURL ---- */
function DrawPad({ onChange }) {
  const ref = useRef(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
  }, []);

  function pos(e) {
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - r.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - r.top;
    return { x, y };
  }

  function draw(e) {
    if (!drawing) return;
    const ctx = ref.current.getContext("2d");
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function start(e) {
    setDrawing(true);
    const ctx = ref.current.getContext("2d");
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function end() {
    if (!drawing) return;
    setDrawing(false);
    onChange?.(ref.current.toDataURL("image/png"));
  }

  return (
    <div>
      <div className="mb-2 text-[12px] text-black/60">Rough sketch (optional)</div>
      <div className="rounded-lg border border-black/10 bg-white p-2">
        <canvas
          ref={ref}
          width={560}
          height={260}
          className="w-full h-auto cursor-crosshair rounded-md"
          onMouseDown={start}
          onMouseMove={draw}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={draw}
          onTouchEnd={end}
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold"
            onClick={() => {
              const ctx = ref.current.getContext("2d");
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, ref.current.width, ref.current.height);
              onChange?.(ref.current.toDataURL("image/png"));
            }}
          >
            <Paintbrush className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== MAIN DRAWER ===================== */
export default function ImageToolSettingsDrawer({
  open,
  title = "",
  kind = "image",
  defaults = {},
  onClose,
  onProceed, // ({ tool, values })
}) {
  const [values, setValues] = useState({});

  useEffect(() => {
    // reset on open/kind change
    if (open) setValues({});
  }, [open, kind]);

  if (!open) return null;

  function submit() {
    // upscaler must have an image
    if (kind === "upscaler" && !values.refImageUrl) {
      alert("Please upload an image to upscale.");
      return;
    }
    onProceed?.({ tool: kind, values });
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/40">
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl rounded-l-2xl bg-white shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between border-b border-black/10 p-4">
          <div className="text-lg font-semibold">{title}</div>
          <button className="p-2 rounded-md hover:bg-black/[.04]" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>

        <div className="p-5">
          {kind === "thumbnail" && <ThumbnailSheet values={values} setValues={setValues} />}
          {kind === "image" && <ImageSheet values={values} setValues={setValues} />}
          {kind === "logo" && <LogoSheet values={values} setValues={setValues} />}
          {kind === "irl" && <IrlSheet values={values} setValues={setValues} />}
          {kind === "upscaler" && <UpscalerSheet values={values} setValues={setValues} />}

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold"
            >
              Back
            </button>
            <button
              type="button"
              onClick={submit}
              className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white"
            >
              <ImageIcon className="h-4 w-4" />
              Proceed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------ SHEETS ------------------ */

function ThumbnailSheet({ values, setValues }) {
  return (
    <>
      <Field label="Topic / Subject">
        <TextInput
          placeholder="e.g., New iPhone — should you buy it?"
          value={values.topic || ""}
          onChange={(e) => setValues((v) => ({ ...v, topic: e.target.value }))}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Platform">
          <Select
            value={values.platform || "YouTube"}
            onChange={(e) => setValues((v) => ({ ...v, platform: e.target.value }))}
          >
            <option>YouTube</option>
            <option>TikTok</option>
            <option>Instagram</option>
            <option>Twitter/X</option>
          </Select>
        </Field>

        <Field label="Size">
          <Select
            value={values.size || (values.platform === "TikTok" ? "1080x1920 (9:16)" : "1280x720 (16:9)")}
            onChange={(e) => setValues((v) => ({ ...v, size: e.target.value }))}
          >
            <option>1280x720 (16:9)</option>
            <option>1920x1080 (16:9)</option>
            <option>1080x1920 (9:16)</option>
          </Select>
        </Field>
      </div>

      <Field label="Headline (big text)">
        <TextInput
          placeholder='e.g., "DON’T BUY"'
          value={values.headline || ""}
          onChange={(e) => setValues((v) => ({ ...v, headline: e.target.value }))}
        />
      </Field>

      <Field label="Mood (optional)">
        <TextInput
          placeholder="e.g., dramatic, neon, gritty"
          value={values.mood || ""}
          onChange={(e) => setValues((v) => ({ ...v, mood: e.target.value }))}
        />
      </Field>

      <Section title="Import image (optional)">
        <FilePicker
          value={values.refImageUrl}
          onPick={(url) => setValues((v) => ({ ...v, refImageUrl: url }))}
        />
      </Section>

      <Section title="Draw thumbnail (optional)">
        <DrawPad onChange={(dataUrl) => setValues((v) => ({ ...v, sketchDataUrl: dataUrl }))} />
      </Section>

      <Section title="Destination tag (optional)">
        <Select
          value={values.destination || "own-use"}
          onChange={(e) => setValues((v) => ({ ...v, destination: e.target.value }))}
        >
          <option value="own-use">Own use</option>
          <option value="youtube">YouTube</option>
          <option value="tiktok">TikTok</option>
          <option value="instagram">Instagram</option>
          <option value="pinterest">Pinterest</option>
        </Select>
      </Section>
    </>
  );
}

function ImageSheet({ values, setValues }) {
  return (
    <>
      <Field label="Prompt / Subject">
        <TextInput
          placeholder="e.g., 3D cartoon cat, soft lighting, cute"
          value={values.topic || ""}
          onChange={(e) => setValues((v) => ({ ...v, topic: e.target.value }))}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Mood (optional)">
          <TextInput
            placeholder="e.g., warm, dreamy bokeh, moody shadows"
            value={values.mood || ""}
            onChange={(e) => setValues((v) => ({ ...v, mood: e.target.value }))}
          />
        </Field>

        <Field label="Size">
          <Select
            value={values.size || "1024x1024"}
            onChange={(e) => setValues((v) => ({ ...v, size: e.target.value }))}
          >
            <option>1024x1024</option>
            <option>1536x1536</option>
            <option>2048x1152 (16:9)</option>
            <option>1080x1920 (9:16)</option>
          </Select>
        </Field>
      </div>

      <Field label="Style (cartoon/visual style)">
        <Select
          value={values.style || "Cinematic"}
          onChange={(e) => setValues((v) => ({ ...v, style: e.target.value }))}
        >
          <option>Cinematic</option>
          <option>Illustration</option>
          <option>Neon/Glitch</option>
          <option>Retro</option>
          <option>Clay 3D</option>
          <option>Anime</option>
          <option>Lowpoly</option>
          <option>Noir</option>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Overlay text (optional)">
          <TextInput
            placeholder='e.g., "SALE 50%"'
            value={values.overlayText || ""}
            onChange={(e) => setValues((v) => ({ ...v, overlayText: e.target.value }))}
          />
        </Field>

        <Field label="Destination">
          <Select
            value={values.destination || "own-use"}
            onChange={(e) => setValues((v) => ({ ...v, destination: e.target.value }))}
          >
            <option value="own-use">Own use</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="pinterest">Pinterest</option>
            <option value="wallpaper">Wallpaper</option>
          </Select>
        </Field>
      </div>

      <Section title="Import image (optional)">
        <FilePicker
          value={values.refImageUrl}
          onPick={(url) => setValues((v) => ({ ...v, refImageUrl: url }))}
        />
      </Section>

      <Section title="Draw composition (optional)">
        <DrawPad onChange={(dataUrl) => setValues((v) => ({ ...v, sketchDataUrl: dataUrl }))} />
      </Section>
    </>
  );
}

function LogoSheet({ values, setValues }) {
  return (
    <>
      <Field label="Mode">
        <Select
          value={values.brandMode || "no-brand"}
          onChange={(e) => setValues((v) => ({ ...v, brandMode: e.target.value }))}
        >
          <option value="choose-brand">Choose a saved brand</option>
          <option value="no-brand">Create without brand</option>
        </Select>
      </Field>

      {values.brandMode === "choose-brand" ? (
        <Field label="Brand">
          {/* In the future, populate from user brands */}
          <TextInput
            placeholder="Type your brand name or pick saved"
            value={values.brand || ""}
            onChange={(e) => setValues((v) => ({ ...v, brand: e.target.value }))}
          />
        </Field>
      ) : (
        <Field label="Brand (just text to use in the logo)">
          <TextInput
            placeholder="Acme Labs"
            value={values.brand || ""}
            onChange={(e) => setValues((v) => ({ ...v, brand: e.target.value }))}
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Slogan (optional)">
          <TextInput
            placeholder="Build boldly."
            value={values.slogan || ""}
            onChange={(e) => setValues((v) => ({ ...v, slogan: e.target.value }))}
          />
        </Field>

        <Field label="Style">
          <Select
            value={values.style || "Minimal"}
            onChange={(e) => setValues((v) => ({ ...v, style: e.target.value }))}
          >
            <option>Minimal</option>
            <option>Bold gradient</option>
            <option>Retro</option>
            <option>3D/Clay</option>
            <option>Neon</option>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Theme (optional)">
          <TextInput
            placeholder="e.g., geometric, playful"
            value={values.theme || ""}
            onChange={(e) => setValues((v) => ({ ...v, theme: e.target.value }))}
          />
        </Field>

        <Field label="Preferred shape (optional)">
          <TextInput
            placeholder="e.g., circle, shield, hexagon"
            value={values.shape || ""}
            onChange={(e) => setValues((v) => ({ ...v, shape: e.target.value }))}
          />
        </Field>
      </div>

      <Field label="Brand colors (comma-separated HEX)">
        <TextInput
          placeholder="#7C3AED, #1677FF"
          value={values.colors || ""}
          onChange={(e) => setValues((v) => ({ ...v, colors: e.target.value }))}
        />
      </Field>
    </>
  );
}

function IrlSheet({ values, setValues }) {
  return (
    <>
      <Field label="Topic">
        <TextInput
          placeholder="portrait, half-body, full-body, fashion, etc."
          value={values.topic || ""}
          onChange={(e) => setValues((v) => ({ ...v, topic: e.target.value }))}
        />
      </Field>

      <Field label="Theme / Style">
        <Select
          value={values.theme || "Pixar-ish"}
          onChange={(e) => setValues((v) => ({ ...v, theme: e.target.value }))}
        >
          <option>Pixar-ish</option>
          <option>Anime</option>
          <option>Comic</option>
          <option>Realistic filmic</option>
          <option>Claymation</option>
          <option>Noir</option>
        </Select>
      </Field>

      <Section title="Import image (required)">
        <FilePicker
          value={values.refImageUrl}
          onPick={(url) => setValues((v) => ({ ...v, refImageUrl: url }))}
        />
        {!values.refImageUrl && (
          <div className="mt-1 text-[12px] text-red-500">Please provide a photo to stylize.</div>
        )}
      </Section>
    </>
  );
}

function UpscalerSheet({ values, setValues }) {
  return (
    <>
      <Section title="Import image (required)">
        <FilePicker
          value={values.refImageUrl}
          onPick={(url) => setValues((v) => ({ ...v, refImageUrl: url }))}
        />
        {!values.refImageUrl && (
          <div className="mt-1 text-[12px] text-red-500">An image is required to upscale.</div>
        )}
      </Section>

      <Field label="Scale">
        <Select
          value={values.scale || "2x"}
          onChange={(e) => setValues((v) => ({ ...v, scale: e.target.value }))}
        >
          <option value="2x">2× (fast)</option>
          <option value="4x">4× (sharper, +credits)</option>
        </Select>
      </Field>
    </>
  );
}
