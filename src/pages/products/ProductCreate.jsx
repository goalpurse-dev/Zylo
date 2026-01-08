// src/pages/products/ProductCreate.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { uploadForExternalFetch } from "../../lib/storage";
import { getCurrentBrand } from "../../lib/brandSession";
import { Globe, Store, ShoppingBag } from "lucide-react";

// colorful platform logos (use PNG/SVG with transparency)
import etsyLogo from "../../assets/brands/etsy-color.jpg";
import shopifyLogo from "../../assets/brands/shopify-color.jpg";
import tiktokLogo from "../../assets/brands/tiktok-color.jpg";

// --- tiny helpers ---
const cn = (...a) => a.filter(Boolean).join(" ");
const zyloGrad = "bg-gradient-to-r from-[#1677FF] to-[#7A3BFF]";

function slugify(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

// --- example pictures row (1:1, bigger) ---
import EX1 from "../../assets/library/v41.png";
import EX2 from "../../assets/library/v42.png";
import EX3 from "../../assets/library/v43.png";
import EX4 from "../../assets/library/v44.png";
import EX5 from "../../assets/library/v45.png";

const EXAMPLES = [
  { src: EX1, label: "Front on, clean BG" },
  { src: EX2, label: "45° angled" },
  { src: EX3, label: "Close-up detail" },
  { src: EX4, label: "In-hand for scale" },
  { src: EX5, label: "Lifestyle / in-use" },
];

// ---- Category options (20) + "other" ----
const CATEGORY_OPTIONS = [
  "Skincare",
  "Makeup",
  "Haircare",
  "Fragrance",
  "Bath & Body",
  "Electronics",
  "Audio",
  "Computers",
  "Gaming",
  "Smartphones",
  "Home Decor",
  "Kitchen",
  "Appliances",
  "Fitness",
  "Apparel",
  "Footwear",
  "Accessories",
  "Jewelry",
  "Toys & Hobbies",
  "Pet Supplies",
];

export default function ProductCreate() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const isEdit = Boolean(productId);

  const brand = getCurrentBrand();
  const isWithoutBrand = !brand?.id;

  // steps
  const [step, setStep] = useState(1);

  // step 1: basics (mapped to product JSON)
  const [title, setTitle] = useState(""); // -> product.name
  const [oneLiner, setOneLiner] = useState(""); // -> product.description / meta.one_liner
  const [platform, setPlatform] = useState(""); // row-level platform
  const [platformOther, setPlatformOther] = useState("");

  // extras to include in product.*
  const [colorScheme, setColorScheme] = useState(""); // "white, orange" -> ["white","orange"]
  const [material, setMaterial] = useState(""); // optional -> product.material

  // NEW: product type (UI only for now)
  const [productType, setProductType] = useState("physical");

  // Category dropdown + "Other..."
  const [categoryChoice, setCategoryChoice] = useState(""); // one of CATEGORY_OPTIONS or "other"
  const [categoryOther, setCategoryOther] = useState(""); // free text when "other"

  // Ad keywords
  const [adKeywords, setAdKeywords] = useState(""); // "a, b, c" -> ["a","b","c"]

  // optional meta
  const [usps, setUsps] = useState("");
  const [notes, setNotes] = useState("");

  // step 2: single photo (main)
  const [file, setFile] = useState(null); // single File
  const preview = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );

  // Edit-mode existing media
  const [existingMainImage, setExistingMainImage] = useState("");
  const [rowBrandId, setRowBrandId] = useState(null);

  // ---------- Prefill on edit ----------
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) return;

      const { data, error } = await supabase
        .from("brand_products")
        .select("*")
        .eq("id", productId)
        .eq("user_id", uid)
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        console.error(error || "Not found");
        alert("Product not found");
        navigate("/brand");
        return;
      }

      setRowBrandId(data.brand_id || null);

      const p = data.product || {};
      const m = data.meta || {};

      setTitle(p.name || data.title || "");
      const desc = p.description || m.one_liner || data.description || "";
      setOneLiner(desc);

      // platform
      const plat = data.platform || m.platform_display || "";
      if (["etsy", "shopify", "tiktok", "other"].includes(String(plat).toLowerCase())) {
        setPlatform(String(plat).toLowerCase());
      } else if (plat) {
        setPlatform("other");
        setPlatformOther(plat);
      } else {
        setPlatform("");
      }

      // color scheme array -> comma string
      setColorScheme(Array.isArray(p.color_scheme) ? p.color_scheme.join(", ") : "");
      setMaterial(p.material || "");

      // category
      if (
        p.category &&
        CATEGORY_OPTIONS.map((c) => c.toLowerCase()).includes(
          String(p.category).toLowerCase(),
        )
      ) {
        setCategoryChoice(String(p.category).toLowerCase());
      } else if (p.category) {
        setCategoryChoice("other");
        setCategoryOther(p.category);
      } else {
        setCategoryChoice("");
      }

      // ad keywords
      setAdKeywords(Array.isArray(p.ad_keywords) ? p.ad_keywords.join(", ") : "");

      // meta extras
      setUsps(Array.isArray(m.usps) ? m.usps.join("\n") : "");
      setNotes(m.notes || "");

      // image
      const img = p.image_url || data.image_url || "";
      setExistingMainImage(img);
    })();
  }, [isEdit, productId, navigate]);

  // ---------- validation ----------
  const canNext1 =
    title.trim().length >= 2 &&
    !!platform &&
    oneLiner.trim().length >= 200; // min 200 chars description

  const canNext2 = isWithoutBrand ? true : !!file || !!existingMainImage;

  // ---------- create ----------
  async function handleCreate() {
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    const b = getCurrentBrand();
    if (!uid || !b?.id) {
      alert("Missing user or brand. Please select a brand again.");
      navigate("/brands");
      return;
    }
    await upsertProduct({ uid, brandId: b.id, mode: "create" });
  }

  // ---------- save (edit) ----------
  async function handleSave() {
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    const brandId = rowBrandId || brand?.id;
    if (!uid || !brandId) {
      alert("Missing user or brand.");
      navigate("/brands");
      return;
    }
    await upsertProduct({ uid, brandId, mode: "edit" });
  }

  // ---------- shared insert/update ----------
  async function upsertProduct({ uid, brandId, mode }) {
    // 1) main image (upload if needed)
    let finalImageRef = existingMainImage || null;

    if (!isWithoutBrand && !finalImageRef && file) {
      try {
        const uploaded = await uploadForExternalFetch(
          file,
          { projectId: brandId, prefix: "products" },
          true,
        );
        finalImageRef = uploaded.url;
      } catch (err) {
        console.error(err);
        alert("Image upload failed. Please try again.");
        return;
      }
    }

    const parsedColorScheme = colorScheme
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const parsedAdKeywords = adKeywords
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const finalCategory =
      categoryChoice === "other"
        ? categoryOther.trim() || null
        : categoryChoice || null;

    const productIdLocal = isEdit
      ? undefined
      : "product_" +
        (slugify(title) || Math.random().toString(36).slice(2, 10));

    const product = {
      ...(isEdit ? {} : { id: productIdLocal }),
      name: title.trim(),
      description: (oneLiner || "").trim(),
      image_url: finalImageRef || null,
      brand: brand?.name || "", // display only
      color_scheme: parsedColorScheme, // []
      material: material || null,
      category: finalCategory,
      ad_keywords: parsedAdKeywords, // []
      source: "zylo-product-library",
      // productType could be persisted here later if you want
    };

    const uspArray = (usps || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const meta = {
      usps: uspArray,
      notes: (notes || "").trim(),
      one_liner: (oneLiner || "").trim(),
      platform_display: platform === "other" ? platformOther.trim() : platform,
      references: [], // removed reference images section
      product_type: productType, // optional meta for later logic
    };

    try {
      const row = {
        user_id: uid,
        brand_id: brandId,

        // legacy mirrors for compatibility
        title: product.name,
        description: product.description,
        image_url: product.image_url,
        thumb: product.image_url,

        // new fields
        product,
        platform: platform === "other" ? platformOther.trim() : platform,
        meta,
      };

      if (mode === "create") {
        const { error } = await supabase.from("brand_products").insert([row]);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("brand_products")
          .update(row)
          .eq("id", productId);
        if (error) throw error;
      }

      navigate("/brand");
    } catch (e) {
      console.error(e);
      alert(
        e?.message ||
          (mode === "create"
            ? "Could not create product."
            : "Could not save product."),
      );
    }
  }

  // UI text swaps
  const headerTitle = isEdit ? "Edit product" : "Create product";
  const ctaLabel = isEdit ? "Save changes" : "Create product";
  const onFinalSubmit = isEdit ? handleSave : handleCreate;

  return (
    <main className="w-full bg-[#0b0f14] text-white min-h-screen py-8">
      <div className="mx-auto w-full max-w-[980px] px-4">
        {/* header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-extrabold tracking-tight">
            {headerTitle}
          </h1>
          <div className="grid grid-cols-3 gap-1 w-40">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={cn(
                  "h-1 rounded-full",
                  n <= step ? "bg-white" : "bg-white/20",
                )}
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#10151d] p-5 sm:p-6 space-y-5">
          {step === 1 && (
            <Step1
              title={title}
              setTitle={setTitle}
              oneLiner={oneLiner}
              setOneLiner={setOneLiner}
              platform={platform}
              setPlatform={setPlatform}
              platformOther={platformOther}
              setPlatformOther={setPlatformOther}
              colorScheme={colorScheme}
              setColorScheme={setColorScheme}
              material={material}
              setMaterial={setMaterial}
              categoryChoice={categoryChoice}
              setCategoryChoice={setCategoryChoice}
              categoryOther={categoryOther}
              setCategoryOther={setCategoryOther}
              adKeywords={adKeywords}
              setAdKeywords={setAdKeywords}
              usps={usps}
              setUsps={setUsps}
              notes={notes}
              setNotes={setNotes}
              productType={productType}
              setProductType={setProductType}
              canNext={canNext1}
              onNext={() => setStep(2)}
            />
          )}

          {step === 2 && (
            <Step2
              isWithoutBrand={isWithoutBrand}
              file={file}
              setFile={setFile}
              preview={preview || (existingMainImage ? existingMainImage : null)}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
              canNext={canNext2}
            />
          )}

          {step === 3 && (
            <Step3
              title={title}
              oneLiner={oneLiner}
              platform={platform}
              platformOther={platformOther}
              colorScheme={colorScheme}
              material={material}
              categoryChoice={categoryChoice}
              categoryOther={categoryOther}
              adKeywords={adKeywords}
              usps={usps}
              notes={notes}
              preview={preview || existingMainImage || ""}
              onBack={() => setStep(2)}
              onCreate={onFinalSubmit}
              ctaLabel={ctaLabel}
            />
          )}
        </div>
      </div>
    </main>
  );
}

/* -------------------- Steps -------------------- */

function Step1({
  title,
  setTitle,
  oneLiner,
  setOneLiner,
  platform,
  setPlatform,
  platformOther,
  setPlatformOther,
  colorScheme,
  setColorScheme,
  material,
  setMaterial,
  categoryChoice,
  setCategoryChoice,
  categoryOther,
  setCategoryOther,
  adKeywords,
  setAdKeywords,
  usps,
  setUsps,
  notes,
  setNotes,
  productType,
  setProductType,
  canNext,
  onNext,
}) {
  const chips = [
    { id: "etsy", label: "Etsy", img: etsyLogo, Icon: Store },
    { id: "shopify", label: "Shopify", img: shopifyLogo, Icon: ShoppingBag },
    { id: "tiktok", label: "TikTok Shop", img: tiktokLogo },
    { id: "other", label: "Other", Icon: Globe },
  ];

  const descLen = (oneLiner || "").trim().length;
  const descProgress = Math.min(100, (descLen / 200) * 100);

  return (
    <div className="space-y-6">
      {/* Step header / journey intro */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#7A3BFF33] bg-[#7A3BFF1a] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C4B5FD]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7A3BFF] shadow-[0_0_10px_#7A3BFF]" />
            Step 1 · Product basics
          </div>
          <p className="mt-2 text-xs text-white/65 max-w-md">
            Tell Zylo what you&apos;re selling so we can craft the right hooks,
            angles and scenes for your ads and product photos.
          </p>
        </div>
        <div className="hidden sm:flex flex-col items-end text-[11px] text-white/60">
          <span>Journey to easy ads</span>
          <span className="mt-0.5 text-white/40">1 / 3 · Product → Image → Ready</span>
        </div>
      </div>

      {/* Name + platform */}
      <div>
        <div className="mb-2 text-xs font-semibold text-white/70">
          Product & marketplace
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[11px] text-white/55">
              Product name *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="GlowBoost Vitamin C Serum"
              className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF] focus:border-transparent"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-white/55">
              Where is this listed? *
            </label>
            <div className="flex flex-wrap gap-2">
              {chips.map(({ id, label, img, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPlatform(id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold border transition",
                    platform === id
                      ? "bg-white text-black border-white"
                      : "bg-white/5 text-white/80 border-white/15 hover:bg-white/10",
                  )}
                >
                  <span>{label}</span>
                  {img ? (
                    <img
                      src={img}
                      alt=""
                      className="h-3.5 w-3.5 object-contain pointer-events-none"
                    />
                  ) : Icon ? (
                    <Icon className="h-3.5 w-3.5 opacity-80" />
                  ) : null}
                </button>
              ))}
            </div>
            {platform === "other" && (
              <input
                value={platformOther}
                onChange={(e) => setPlatformOther(e.target.value)}
                placeholder="Type your platform / marketplace"
                className="mt-2 w-full rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF] focus:border-transparent"
              />
            )}
          </div>
        </div>
      </div>

      {/* Description with progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] text-white/55">
            Short description (used later in ads) *
          </label>
          <span className="text-[10px] text-white/45">
            {descLen}/200
          </span>
        </div>
        <textarea
          rows={4}
          value={oneLiner}
          onChange={(e) => setOneLiner(e.target.value)}
          placeholder="Write 2–3 clear sentences about what the product is, who it’s for and the main benefit. Zylo uses this to write hooks and scenes."
          className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF] focus:border-transparent"
        />
        <div className="mt-1 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#7A3BFF] via-[#9B4DFF] to-[#FF57B2]"
              style={{ width: `${descProgress}%` }}
            />
          </div>
          <span
            className={
              descLen < 200 ? "text-[10px] text-amber-300" : "text-[10px] text-emerald-300"
            }
          >
            {descLen < 200
              ? `Write ${200 - descLen} more characters for best results.`
              : "Perfect – detailed copy gives you sharper ads."}
          </span>
        </div>
      </div>

      {/* Product type */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-white/55">Product type</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setProductType("physical")}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold border transition",
              productType === "physical"
                ? "bg-gradient-to-r from-[#7A3BFF] to-[#9B4DFF] text-white border-transparent shadow-[0_0_18px_rgba(122,59,255,0.45)]"
                : "bg-white/5 text-white/80 border-white/20 hover:bg-white/10",
            )}
          >
            Physical
          </button>

          <div className="relative group">
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold border border-white/15 bg-white/5 text-white/35 cursor-not-allowed"
            >
              Digital
            </button>
            <div className="pointer-events-none absolute left-1/2 top-full z-20 hidden -translate-x-1/2 rounded-md bg-black/90 px-2 py-1 text-[10px] text-white/80 shadow-lg group-hover:block mt-1">
              Coming soon
            </div>
          </div>
        </div>
      </div>

      {/* Color + material */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] text-white/55">
            Color scheme (optional, comma-separated)
          </label>
          <input
            value={colorScheme}
            onChange={(e) => setColorScheme(e.target.value)}
            placeholder="white, orange"
            className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF] focus:border-transparent"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-white/55">Material (optional)</label>
          <input
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            placeholder="glass bottle with white dropper cap"
            className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF] focus:border-transparent"
          />
        </div>
      </div>

      {/* Category */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] text-white/55">Category</label>
          <select
            value={categoryChoice}
            onChange={(e) => setCategoryChoice(e.target.value)}
            className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF] focus:border-transparent"
          >
            <option value="" disabled>
              Choose category
            </option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c.toLowerCase()}>
                {c}
              </option>
            ))}
            <option value="other">Other…</option>
          </select>
        </div>

        {categoryChoice === "other" && (
          <div className="space-y-1.5">
            <label className="text-[11px] text-white/55">Custom category</label>
            <input
              value={categoryOther}
              onChange={(e) => setCategoryOther(e.target.value)}
              placeholder="e.g., skincare"
              className="w-full rounded-xl border border-white/12 bg.white/[0.03] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF] focus:border-transparent"
            />
          </div>
        )}
      </div>

      {/* Ad keywords */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-white/55">
          Ad keywords (comma-separated)
        </label>
        <input
          value={adKeywords}
          onChange={(e) => setAdKeywords(e.target.value)}
          placeholder="skincare routine, vitamin C glow, morning ritual, smooth skin"
          className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF] focus:border-transparent"
        />
      </div>

      {/* USPs + notes */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] text-white/55">
            Key selling points (one per line)
          </label>
          <textarea
            rows={4}
            value={usps}
            onChange={(e) => setUsps(e.target.value)}
            placeholder={"Dermatologist-tested\nBrightens dull skin\nLightweight formula"}
            className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF] focus:border-transparent"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-white/55">Notes (optional)</label>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Variants, sizes, any constraints to remember later…"
            className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF] focus:border-transparent"
          />
        </div>
      </div>

      <div className="pt-2 flex justify-end">
        <button
          onClick={onNext}
          disabled={!canNext}
          className={cn(
            "inline-flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold",
            canNext
              ? "bg-gradient-to-r from-[#1677FF] via-[#7A3BFF] to-[#FF57B2] text-white shadow-[0_0_25px_rgba(122,59,255,0.55)]"
              : "bg-white/5 text-white/40 cursor-not-allowed",
          )}
        >
          Next
        </button>
      </div>
    </div>
  );
}


function Step2({
  isWithoutBrand,
  file,
  setFile,
  preview,
  onNext,
  onBack,
  canNext,
}) {
  if (!isWithoutBrand) {
    function onPickFile(e) {
      const f = (e.target.files && e.target.files[0]) || null;
      setFile(f);
    }
    return (
      <div className="space-y-5">
        <div className="text-base font-semibold">Add photo (single)</div>
        <div className="text-xs text-white/60 -mt-1">
          One clear front-facing product photo works best for ads.
        </div>

        <div className="flex items-start gap-4 flex-wrap">
          <label className="inline-flex h-40 w-40 items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/[.02] text-white/70 cursor-pointer hover:bg-white/[.04]">
            <input type="file" accept="image/*" hidden onChange={onPickFile} />
            + Add photo
          </label>

          {preview && (
            <div className="relative h-40 w-40 overflow-hidden rounded-xl border border-white/10 bg-black">
              <img src={preview} alt="" className="h-full w-full object-cover" />
              <button
                onClick={() => setFile(null)}
                className="absolute right-1 top-1 rounded bg-black/40 px-1 text-xs"
                title="Remove"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* examples (bigger, 1:1) */}
        <div className="pt-3">
          <div className="text-xs font-semibold text-white/70 mb-2">
            Good examples
          </div>
          <div className="flex gap-4 overflow-x-auto pb-1">
            {EXAMPLES.map((ex, i) => (
              <figure key={i} className="w-40">
                <div className="aspect-square overflow-hidden rounded-xl border border-white/10 bg-black">
                  <img
                    src={ex.src}
                    alt={ex.label}
                    className="h-full w-full object-cover"
                  />
                </div>
                <figcaption className="mt-1 text-[11px] text-white/60">
                  {ex.label}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold border border-white/15 text-white/90 hover:bg-white/10"
          >
            Back
          </button>
          <button
            onClick={onNext}
            disabled={!canNext}
            className={cn(
              "inline-flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold",
              canNext ? zyloGrad : "bg-white/10 text-white/50 cursor-not-allowed",
            )}
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  // WITHOUT BRAND: nothing to add here
  return (
    <div className="space-y-5">
      <div className="text-base font-semibold">Images</div>
      <div className="text-xs text-white/60 -mt-1">
        Nothing to upload in this mode.
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold border border-white/15 text-white/90 hover:bg-white/10"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className={cn(
            "inline-flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold",
            zyloGrad,
          )}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function Step3({
  title,
  oneLiner,
  platform,
  platformOther,
  colorScheme,
  material,
  categoryChoice,
  categoryOther,
  adKeywords,
  usps,
  notes,
  preview,
  onBack,
  onCreate,
  ctaLabel = "Create product",
}) {
  const displayPlatform =
    platform === "other" ? platformOther || "Other" : platform;
  const displayCategory =
    categoryChoice === "other"
      ? categoryOther || "—"
      : categoryChoice || "—";

  return (
    <div className="space-y-5">
      <div className="text-base font-semibold">
        Review & {ctaLabel.toLowerCase()}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[.02] p-3 text-sm space-y-2">
        <Row label="Name" value={title || "—"} />
        <Row label="Platform" value={displayPlatform || "—"} />
        <Row label="Description" value={oneLiner || "—"} />
        <Row label="Color scheme" value={colorScheme || "—"} />
        <Row label="Material" value={material || "—"} />
        <Row label="Category" value={displayCategory} />
        <Row label="Ad keywords" value={adKeywords || "—"} />
        <Row
          label="USPs"
          value={
            (usps || "").split("\n").filter(Boolean).length ? (
              <ul className="list-disc ml-4">
                {(usps || "")
                  .split("\n")
                  .map(
                    (s, i) =>
                      s.trim() && <li key={i}>{s}</li>,
                  )}
              </ul>
            ) : (
              "—"
            )
          }
        />
        <Row label="Notes" value={notes || "—"} />
      </div>

      <div>
        <div className="text-sm font-semibold mb-2">Preview image</div>
        {preview ? (
          <div className="relative h-48 w-48 overflow-hidden rounded-xl border border-white/10 bg-black">
            <img src={preview} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="text-xs text-amber-300">
            You’re saving without a preview image. Add one for the best ad
            accuracy.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className={cn(
            "inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold border border-white/15 text-white/90 hover:bg.white/10",
          )}
        >
          Back
        </button>
        <button
          onClick={onCreate}
          className={cn(
            "inline-flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold",
            zyloGrad,
          )}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-28 shrink-0 text-white/60">{label}</div>
      <div className="flex-1">{value}</div>
    </div>
  );
}
