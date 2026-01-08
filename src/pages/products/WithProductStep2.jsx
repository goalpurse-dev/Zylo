import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getCurrentBrand } from "../../lib/brandSession";
import { createProductPhotoJob } from "../../lib/jobs";
import { filesToRefUrls } from "../../lib/imageRefs";

const cn = (...a) => a.filter(Boolean).join(" ");
const zyloGrad = "bg-gradient-to-r from-[#1677FF] to-[#7A3BFF]";

export default function WithProductStep2({
  product,
  onBack,
  onCreated,
  credits = 10,
}) {
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState("catalog"); // catalog | macro | lifestyle
  const [angle, setAngle] = useState("front"); // UI-only, we fold into prompt
  const [width, setW] = useState(1024);
  const [height, setH] = useState(1024);
  const [seed, setSeed] = useState("");
  const [loading, setLoading] = useState(false);
  const [refFiles, setRefFiles] = useState([]);

  const canCreate = prompt.trim().length >= 3 && !loading;

  function onPickRefs(e) {
    const files = Array.from(e.target.files || []);
    // cap at 2 extra refs
    setRefFiles((prev) => prev.concat(files).slice(0, 2));
  }

  function removeRef(i) {
    setRefFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function createPhoto() {
    try {
      setLoading(true);
      const [{ data: u }, brand] = await Promise.all([
        supabase.auth.getUser(),
        Promise.resolve(getCurrentBrand()),
      ]);
      if (!u?.user?.id || !brand?.id) throw new Error("Missing auth/brand");

      const finalPrompt = `${prompt.trim()}${
        angle ? `, angle: ${angle}` : ""
      }`;

      const extraRefs = await filesToRefUrls(refFiles, brand.id); // [{url}]
      const productRef =
        product?.image_url && /^https?:\/\//i.test(product.image_url)
          ? [{ url: product.image_url, weight: 0.25 }]
          : [];

      // product ref + up to 2 extra refs (already capped)
      const refs = productRef.concat(extraRefs);

      const job = await createProductPhotoJob({
        brandId: brand.id,
        userId: u.user.id,
        productId: product.id,
        kind,
        prompt: finalPrompt,
        negative_prompt:
          "no extra logos, no misspelled text, no hands, no people, no watermark, no border",
        seed: seed ? Number(seed) : undefined,
        width: Number(width),
        height: Number(height),
        refs,
      });

      onCreated?.(job.id);
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="text-base font-semibold">3) Describe the picture</div>

      <textarea
        rows={4}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe lighting, background, vibe, composition…"
        className="w-full rounded-xl border border-white/15 bg-white/[.04] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF]"
      />

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Kind">
          {["catalog", "macro", "lifestyle"].map((k) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
              {k}
            </Chip>
          ))}
        </Field>

        <Field label="Angle (optional)">
          {["front", "side", "top", "behind"].map((a) => (
            <Chip key={a} active={angle === a} onClick={() => setAngle(a)}>
              {a}
            </Chip>
          ))}
        </Field>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Dimensions">
          <select
            value={`${width}x${height}`}
            onChange={(e) => {
              const [w, h] = e.target.value.split("x").map(Number);
              setW(w);
              setH(h);
            }}
            className="w-full rounded-xl border border-white/15 bg-white/[.04] px-3 py-2 text-sm"
          >
            <option value="1024x1024">1024 × 1024 (1:1)</option>
            <option value="1600x1600">1600 × 1600 (1:1, catalog HD)</option>
            <option value="1536x2048">1536 × 2048 (3:4, portrait)</option>
            <option value="1920x1080">1920 × 1080 (16:9, landscape)</option>
          </select>
        </Field>

        <Field label="Seed (optional)">
          <input
            value={seed}
            onChange={(e) => setSeed(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="random"
            className="w-full rounded-xl border border-white/15 bg-white/[.04] px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Extra refs (0–2)">
          <label className="inline-flex items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/[.02] text-white/70 cursor-pointer hover:bg-white/[.04] px-3 py-2 text-sm">
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={onPickRefs}
            />
            + Add images
          </label>
        </Field>
      </div>

      {refFiles.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {refFiles.map((f, i) => (
            <div
              key={i}
              className="relative h-20 w-16 overflow-hidden rounded-lg border border-white/10 bg-black"
            >
              <img
                src={URL.createObjectURL(f)}
                alt=""
                className="h-full w-full object-cover"
              />
              <button
                onClick={() => removeRef(i)}
                className="absolute right-1 top-1 rounded bg-black/50 px-1 text-xs"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="h-10 px-4 rounded-xl text-sm font-semibold border border-white/15 text-white/90 hover:bg-white/10"
        >
          Back
        </button>

        <button
          onClick={createPhoto}
          disabled={!canCreate}
          className={cn(
            "relative h-10 px-6 pr-24 rounded-xl text-sm font-semibold flex items-center gap-2",
            canCreate
              ? zyloGrad
              : "bg-white/10 text-white/50 cursor-not-allowed"
          )}
          title={`${credits} credits`}
        >
          {loading ? "Creating…" : "Create photo"}
          <span className="absolute right-2 inline-flex items-center justify-center rounded-full bg-white/18 px-3 py-1 text-[10px] font-semibold text-white/90">
            {credits} credits
          </span>
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs text-white/60">{label}</div>
      <div className="flex gap-2 flex-wrap">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl px-3 py-1.5 text-sm font-semibold",
        active
          ? "bg-white text-black"
          : "bg-white/10 text-white/80 hover:bg-white/15"
      )}
    >
      {children}
    </button>
  );
}
