// src/pages/products/ProductPhotos.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getCurrentBrand } from "../../lib/brandSession";
import {
  isStoragePath,
  signProductsUrl,
  uploadForExternalFetch,
} from "../../lib/storage";
import { Package, ChevronLeft, Upload } from "lucide-react";
import { createProductPhotoJob } from "../../lib/jobs";
import { useGenerations } from "../../components/GenerationsDock";

// STEP COMPONENTS
import ProductPhotoBackgroundStep from "../products/ProductPhotoBackgroundStep";

// 3-step explainer under the generator
import ProductPhotoSteps from "../../components/products/ProductPhotoSteps";

const zyloGrad = "bg-gradient-to-r from-blue-600 to-purple-600";
const PHOTO_CREDITS = 10;

/* ---------- Static presets (Supabase public-assets) ---------- */

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  process.env.REACT_APP_SUPABASE_URL ||
  "";

// Base for all public-assets
const PUBLIC_ASSETS_BASE = SUPABASE_URL
  ? `${SUPABASE_URL}/storage/v1/object/public/public-assets`
  : "/storage/v1/object/public/public-assets";

// Backgrounds live in public-assets/products
export const BACKGROUND_PRESETS = [
  {
    id: "green-bg",
    label: "Green background",
    src: `${PUBLIC_ASSETS_BASE}/products/greenbg.jpg`,
  },
  {
    id: "wood-light",
    label: "Light wooden desk",
    src: `${PUBLIC_ASSETS_BASE}/products/wooden.jpg`,
  },
  {
    id: "wood",
    label: "Wooden surface",
    src: `${PUBLIC_ASSETS_BASE}/products/wood.jpg`,
  },
  {
    id: "pink",
    label: "Pastel pink studio",
    src: `${PUBLIC_ASSETS_BASE}/products/pink.jpg`,
  },
  {
    id: "leaf",
    label: "Leaf corner",
    src: `${PUBLIC_ASSETS_BASE}/products/leaf.jpg`,
  },
  {
    id: "black",
    label: "Black studio",
    src: `${PUBLIC_ASSETS_BASE}/products/black.jpg`,
  },
  {
    id: "beige",
    label: "Beige background",
    src: `${PUBLIC_ASSETS_BASE}/products/beige.jpg`,
  },
];

export default function ProductPhotos() {
  const navigate = useNavigate();
  const { addJob } = useGenerations();

  // 0 = intro, 1 = product, 2 = background + create
  const [step, setStep] = useState(0);

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [selectedProduct, setSelectedProduct] = useState(null);

  const [uploadedProductFile, setUploadedProductFile] = useState(null);
  const uploadedPreview = useMemo(
    () =>
      uploadedProductFile ? URL.createObjectURL(uploadedProductFile) : null,
    [uploadedProductFile],
  );
  const [uploadedProductUrl, setUploadedProductUrl] = useState(null);

  const [selectedBg, setSelectedBg] = useState(null);
  const [bgPrompt, setBgPrompt] = useState("");

  const [creating, setCreating] = useState(false);

  /* ---------- Load brand products ---------- */

  useEffect(() => {
    (async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        const uid = user?.user?.id;
        const brandId = getCurrentBrand()?.id;

        if (!uid || !brandId) {
          setLoadingProducts(false);
          setProducts([]);
          return;
        }

        const { data, error } = await supabase
          .from("brand_products")
          .select("id,title,thumb,image_url,meta,created_at")
          .eq("user_id", uid)
          .eq("brand_id", brandId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const withUrls = await Promise.all(
          (data ?? []).map(async (p) => {
            const pathOrUrl = p.thumb || p.image_url || null;
            let url = pathOrUrl;
            if (pathOrUrl && isStoragePath(pathOrUrl)) {
              url = await signProductsUrl(pathOrUrl);
            }
            return { ...p, _url: url };
          }),
        );

        setProducts(withUrls);
      } catch (e) {
        console.error("product-photos load failed:", e);
      } finally {
        setLoadingProducts(false);
      }
    })();
  }, []);

  /* ---------- Helpers ---------- */

  function resetAll() {
    setStep(0);
    setSelectedProduct(null);
    setUploadedProductFile(null);
    setUploadedProductUrl(null);
    setSelectedBg(null);
    setBgPrompt("");
  }

  const hasProductChoice = !!selectedProduct || !!uploadedProductUrl;

  async function uploadSingleProductFile(file) {
    try {
      const brand = getCurrentBrand();
      if (!brand?.id) throw new Error("Select a brand first.");

      const { data: u } = await supabase.auth.getUser();
      if (!u?.user?.id) throw new Error("Not signed in.");

      const up = await uploadForExternalFetch(
        file,
        { projectId: brand.id, prefix: "product-uploads" },
        true,
      );
      setUploadedProductUrl(up.url);
    } catch (e) {
      console.error(e);
      alert(e?.message || "Could not upload product photo.");
      setUploadedProductFile(null);
      setUploadedProductUrl(null);
    }
  }

  async function handleCreate() {
    if (!hasProductChoice) {
      alert("Choose a product or upload a product photo first.");
      return;
    }

    try {
      setCreating(true);

      const brand = getCurrentBrand();
      const [{ data: u }] = await Promise.all([supabase.auth.getUser()]);

      if (!brand?.id || !u?.user?.id) {
        throw new Error("Missing brand or user.");
      }

      const productUrl =
        selectedProduct?._url ||
        selectedProduct?.image_url ||
        uploadedProductUrl ||
        null;

      if (!productUrl) {
        throw new Error("No usable product image URL.");
      }

      // 🔥 Be flexible about how the background is stored
      const backgroundUrl =
        (selectedBg &&
          (selectedBg.src ||
            selectedBg.url ||
            selectedBg.image_url ||
            selectedBg._url)) ||
        (typeof selectedBg === "string" ? selectedBg : null);

      if (!backgroundUrl) {
        alert("Pick a background style before creating the photo.");
        setCreating(false);
        return;
      }

      const refs = [
        { url: productUrl }, //
        { url: backgroundUrl },
      ];

      const userPrompt = bgPrompt.trim();
      const prompt =
        userPrompt ||
        "High-quality commercial product photo using the selected environment.";

      const job = await createProductPhotoJob({
        brandId: brand.id,
        userId: u.user.id,
        productId: selectedProduct?.id || null,
        kind: "catalog",
        prompt,
        negative_prompt:
          "no extra logos, no misspelled text, no watermark, no border, no distorted or duplicate products",
        width: 1024,
        height: 1024,
        productUrl,
        backgroundUrl,
        refs,
      });

      const { ok, reason } = addJob(job.id, {
        tool: "product-photos",
        kind: "product_photo",
        product_id: selectedProduct?.id || null,
      });

      if (!ok && reason !== "limit") {
        navigate(`/jobs/${job.id}`);
      }
    } catch (e) {
      console.error(e);
      alert(e?.message || "Could not create image.");
    } finally {
      setCreating(false);
    }
  }

  const stepsCount = step === 0 ? 0 : 2;

  /* ---------- Render ---------- */

  return (
    <main className="w-full bg-[#0b0f14] text-white min-h-screen py-8">
      <div className="mx-auto w-full max-w-[1100px] px-4">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-white/60">
              Photo Studio
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Product Photos
            </h1>
          </div>

          {stepsCount > 0 && (
            <div className="grid grid-cols-2 gap-1 w-32">
              {[1, 2].map((n) => (
                <div
                  key={n}
                  className={`h-1 rounded-full ${
                    n <= step ? "bg-white" : "bg-white/20"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Wizard container */}
        <div className="rounded-2xl border border-white/10 bg-[#10151d] p-5 sm:p-6">
          {/* Step 0: intro card */}
          {step === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 mt-0.5" />
                <div>
                  <div className="text-lg font-bold">Create product photo</div>
                  <div className="text-sm text-white/70">
                    Choose one of your products or upload a photo, then place it
                    into a ready-made background.
                  </div>
                </div>
              </div>
              <button
                onClick={() => setStep(1)}
                className={`mt-4 w-full h-10 rounded-xl text-sm font-semibold ${zyloGrad}`}
              >
                Start generating
              </button>
            </div>
          )}

          {/* Step 1: choose brand product or upload image */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                    Step 1
                  </div>
                  <h2 className="text-lg font-semibold">
                    Choose product or upload photo
                  </h2>
                  <p className="text-xs text-white/60">
                    Pick an existing brand product or upload a new product
                    image. Zylo will use this in every generated scene.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1.2fr)]">
                {/* Brand products */}
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
                      Your brand products
                    </div>
                    {loadingProducts && (
                      <div className="text-[10px] text-white/50">
                        Loading…
                      </div>
                    )}
                  </div>

                  {!loadingProducts && products.length === 0 && (
                    <div className="text-xs text-white/60">
                      You don&apos;t have any products yet. Upload a product
                      photo on the right.
                    </div>
                  )}

                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                    {products.map((p) => {
                      const active = selectedProduct?.id === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedProduct(p);
                            setUploadedProductFile(null);
                            setUploadedProductUrl(null);
                          }}
                          className={`group flex flex-col rounded-2xl overflow-hidden border text-left transition ${
                            active
                              ? "border-white bg.white/10"
                              : "border-white/10 bg-white/[0.03] hover:border-white/40 hover:bg-white/[0.07]"
                          }`}
                        >
                          <div className="relative w-full aspect-[4/3] bg-black/60">
                            {p._url ? (
                              <img
                                src={p._url}
                                alt={p.title}
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-[11px] text-white/40">
                                No image
                              </div>
                            )}
                          </div>
                          <div className="px-3 py-2">
                            <div className="truncate text-[12px] font-semibold">
                              {p.title || "Untitled product"}
                            </div>
                            <div className="mt-0.5 text-[10px] text-white/45">
                              {active
                                ? "Selected"
                                : "Click to use this product"}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Upload card */}
                <div className="rounded-2xl border border-dashed border-white/20 bg-black/40 p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-white/70" />
                    <div className="text-sm font-semibold">
                      Or upload a product photo
                    </div>
                  </div>
                  <p className="text-xs text-white/60">
                    Use a clear, front-facing photo of your product. Zylo will
                    keep it ready for any future scenes.
                  </p>

                  <label className="mt-1 flex h-28 cursor-pointer items-center justify-center rounded-xl border border-white/20 bg-black/60 text-xs text.white/70 hover:bg-black/80">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setSelectedProduct(null);
                        setUploadedProductFile(file);
                        await uploadSingleProductFile(file);
                      }}
                    />
                    <span>Click to upload image</span>
                  </label>

                  {(uploadedPreview || selectedProduct?._url) && (
                    <div className="mt-2">
                      <div className="text-[11px] font-semibold mb-1 text-white/70">
                        Current selection
                      </div>
                      <div className="flex items-center gap-3">
                        <img
                          src={uploadedPreview || selectedProduct?._url}
                          alt="Selected product"
                          className="h-16 w-16 rounded-xl object-cover bg-black/60"
                        />
                        <div className="text-[11px] text-white/70">
                          {uploadedPreview
                            ? "Uploaded product photo"
                            : selectedProduct?.title || "Selected product"}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex flex-col items-center gap-1">
                    <button
                      onClick={() => hasProductChoice && setStep(2)}
                      disabled={!hasProductChoice}
                      className={`h-9 rounded-xl text-xs font-semibold w-full max-w-[260px] ${
                        hasProductChoice
                          ? zyloGrad
                          : "bg-white/10 text-white/40 cursor-not-allowed"
                      }`}
                    >
                      {hasProductChoice
                        ? "Next: Choose background"
                        : "Select or upload a product first"}
                    </button>

                    <button
                      type="button"
                      onClick={resetAll}
                      className="mt-1 text-[11px] text-white/50 hover:text-white/80"
                    >
                      Cancel &amp; go back
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: background presets + create */}
          {step === 2 && (
            <ProductPhotoBackgroundStep
              selectedBg={selectedBg}
              setSelectedBg={setSelectedBg}
              bgPrompt={bgPrompt}
              setBgPrompt={setBgPrompt}
              onBack={() => setStep(1)}
              onNext={handleCreate}
              presets={BACKGROUND_PRESETS}
              creating={creating}
              credits={PHOTO_CREDITS}
            />
          )}

          {/* Global "Back to start" control */}
          {step > 0 && (
            <div className="mt-4">
              <button
                onClick={resetAll}
                className="inline-flex items-center gap-2 h-8 px-3 rounded-xl text-[10px] font-semibold border border-white/15 text-white/70 bg-black/60 hover:bg-black/80"
              >
                <ChevronLeft className="h-3 w-3" />
                Back to start
              </button>
            </div>
          )}
        </div>

        {/* 3-step explainer only on the intro screen */}
        {step === 0 && <ProductPhotoSteps />}
      </div>
    </main>
  );
}
