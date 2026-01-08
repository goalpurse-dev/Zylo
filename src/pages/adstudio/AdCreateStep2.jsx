import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Image as ImageIcon, ChevronRight, Info, X } from "lucide-react";
import "../../styles/adstudio.css";

import { supabase } from "../../lib/supabaseClient";
import { getCurrentBrand } from "../../lib/brandSession";
import { isStoragePath, signProductsUrl } from "../../lib/storage";
import ToastBanner from "../../components/ui/ToastBanner";

const LABEL = "zy-sub font-semibold uppercase tracking-wide text-[11px]";
const BTN_PRIMARY =
  "w-full rounded-xl px-5 py-3 text-white font-semibold transition bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-95";
const BTN_SOFT = "zy-btn-soft";

const MIN_DESC = 150;
const IMAGES_KEY = "ad.create.step2.images";
const PRODUCT_KEY = "ad.create.step2.product";


export default function AdCreateStep2() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const adType = params.get("adType") || "";
  const model = params.get("model") || "";

  const [mode, setMode] = useState("have-product");

  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customDesc, setCustomDesc] = useState("");

  // single image state
  const [image, setImage] = useState(null); // {dataUrl, name, size}
  const [autoMatch, setAutoMatch] = useState(true);
  const [useAISuggest, setUseAISuggest] = useState(true);

  // toast
  const [toast, setToast] = useState(null); // {type:'ok'|'err', text:string}

  /* fetch user's products (brand + uid) */
  useEffect(() => {
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u?.user?.id;
        const brandId = getCurrentBrand()?.id;
        if (!uid || !brandId) return;

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
            return {
              id: p.id,
              name: p.title || "Untitled product",
              desc:
                typeof p.meta === "object" && p.meta?.description
                  ? p.meta.description
                  : "",
              _url: url,
              raw: p,
            };
          })
        );

        setProducts(withUrls);
      } catch (e) {
        console.error("[AdCreateStep2] fetch products error:", e);
      }
    })();
  }, []);

  // restore cached selection
  useEffect(() => {
    const cachedProduct = sessionStorage.getItem(PRODUCT_KEY);
    if (cachedProduct) {
      try {
        setSelectedProduct(JSON.parse(cachedProduct));
        setMode("have-product");
      } catch {}
    }
    const cachedImgs = sessionStorage.getItem(IMAGES_KEY);
    if (cachedImgs) {
      try {
        const arr = JSON.parse(cachedImgs);
        if (Array.isArray(arr) && arr[0]) {
          setImage(arr[0]); // keep just first
        }
      } catch {}
    }
  }, []);

  const onPickImage = async (e) => {
    const file = (e.target.files || [])[0];
    if (!file) return;
    try {
      const toDataUrl = (f) =>
        new Promise((res) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.readAsDataURL(f);
        });
      const dataUrl = await toDataUrl(file);
      const obj = { dataUrl, name: file.name, size: file.size };
      setImage(obj);
      sessionStorage.setItem(IMAGES_KEY, JSON.stringify([obj]));
      setToast({ type: "ok", text: "Image uploaded successfully!" });
    } catch (err) {
      console.error(err);
      setToast({ type: "err", text: "Image upload failed." });
    } finally {
      e.target.value = "";
    }
  };

  const removeImage = () => {
    setImage(null);
    sessionStorage.removeItem(IMAGES_KEY);
  };

  const canContinue =
    mode === "have-product"
      ? !!selectedProduct
      : customDesc.trim().length >= MIN_DESC && !!image;

  const goBack = () => {
    const q = new URLSearchParams({ adType, model });
    navigate(`/ad/create/step-1?${q.toString()}`);
  };

  const goNext = () => {
    if (!canContinue) return;

    if (selectedProduct) {
      sessionStorage.setItem(
        PRODUCT_KEY,
        JSON.stringify({
          id: selectedProduct.id,
          name: selectedProduct.name,
          desc: selectedProduct.desc,
          _url: selectedProduct._url,
          raw: selectedProduct.raw,
        })
      );
    }
    if (image) sessionStorage.setItem(IMAGES_KEY, JSON.stringify([image]));

    const payload = {
      adType,
      model,
      mode,
      product_id: selectedProduct?.id || "",
      autoMatch: autoMatch ? "1" : "0",
      suggest: useAISuggest ? "1" : "0",
      desc: mode === "describe" ? customDesc.trim() : "",
    };
    const isCinematic = (adType || "").toLowerCase().includes("cinema");
    const q = new URLSearchParams(payload);
    navigate(isCinematic ? `/ad/create/step-4?${q}` : `/ad/create/step-3?${q}`);
  };

  const strength =
    mode === "describe"
      ? Math.min(100, Math.round((customDesc.trim().length / MIN_DESC) * 100))
      : 100;

  const previewSrc =
    mode === "have-product" ? selectedProduct?._url : image?.dataUrl || "";

  const formatKB = (bytes) => `${Math.round(bytes / 1024)}KB`;

  return (
    <div className="min-h-screen bg-white">
      {/* toast */}
      {toast && (
        <ToastBanner
          type={toast.type}
          text={toast.text}
          onClose={() => setToast(null)}
          autoCloseMs={2200}
        />
      )}

      <div className="mx-auto w-full max-w-5xl px-6 pt-10">
        {/* stepper */}
        <div className="zy-stepper zy-fadeup">
          <div className="zy-step"><div className="zy-step__dot">1</div><span>Setup</span></div>
          <div className="zy-step__bar zy-step__bar--filled" />
          <div className="zy-step zy-step--active"><div className="zy-step__dot">2</div><span>Customize</span></div>
          <div className="zy-step__bar" />
          <div className="zy-step"><div className="zy-step__dot">3</div><span>Advanced</span></div>
          <div className="zy-step__bar" />
          <div className="zy-step"><div className="zy-step__dot">4</div><span>Generate</span></div>
        </div>

        <h1 className="zy-h1 zy-fadeup">
          Use your <span className="zy-gradient-text">product</span> for this ad
        </h1>
        <p className="mt-2 zy-sub zy-fadeup">
          Step 2 of 4 — Link an existing product or describe a new one. We’ll preview it live.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* left */}
          <div className="lg:col-span-2 space-y-6">
            <div className="zy-card p-6">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode("have-product")}
                  className={`zy-choice ${mode === "have-product" ? "zy-choice--active" : ""}`}
                >
                  <div className="font-semibold">I have a product</div>
                </button>
                <button
                  onClick={() => setMode("describe")}
                  className={`zy-choice ${mode === "describe" ? "zy-choice--active" : ""}`}
                >
                  <div className="font-semibold">I don't have product added</div>
                </button>
              </div>

              {mode === "have-product" && (
                <div className="mt-6">
                  <div className="mb-2 zy-sub">Select one of your products</div>
                  {products.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                      No products found for this brand.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {products.map((p) => {
                        const active = selectedProduct?.id === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => setSelectedProduct(p)}
                            className={`zy-prod ${active ? "zy-prod--active" : ""}`}
                          >
                            <img src={p._url} alt={p.name} className="zy-prod__img" />
                            <div className="zy-prod__footer">
                              <div className="text-[13px] font-semibold leading-tight">{p.name}</div>
                              {p.desc && (
                                <div className="mt-0.5 line-clamp-1 text-[12px] text-gray-300">
                                  {p.desc}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {mode === "describe" && (
                <div className="mt-6">
                  <div className={LABEL}>PRODUCT DESCRIPTION (MIN {MIN_DESC} CHARS)</div>
                  <textarea
                    className="zy-textarea mt-2 h-40"
                    placeholder="Describe your product to help us create the best Ad for you!"
                    value={customDesc}
                    onChange={(e) => setCustomDesc(e.target.value)}
                  />
                  <div className="mt-1 text-xs text-gray-500">
                    {customDesc.trim().length} characters (minimum {MIN_DESC})
                  </div>

                  <div className="mt-5">
                    <div className={LABEL}>
                      PRODUCT IMAGES <span className="text-red-500 normal-case">(required)</span>
                    </div>

                    {/* uploader or chip */}
                    {!image ? (
                      <label className="zy-btn-soft mt-2 inline-flex items-center gap-2 cursor-pointer">
                        <ImageIcon className="h-4 w-4" />
                        <span>Add product image</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={onPickImage}
                        />
                      </label>
                    ) : (
                      <div className="mt-2 zy-filechip">
                        <img src={image.dataUrl} alt="" className="zy-filechip__thumb" />
                        <div className="min-w-0">
                          <div className="zy-filechip__name truncate">{image.name}</div>
                          <div className="zy-filechip__meta">{formatKB(image.size)}</div>
                        </div>
                        <button
                          onClick={removeImage}
                          className="ml-auto text-red-500 hover:text-red-600"
                          title="Remove"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    )}

                    {/* helpers */}
                    <div className="mt-6">
                      <div className="zy-sub mb-2">Include these details for better results</div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <HelperCard
                          title="Target Audience"
                          subtitle="Who is your product for?"
                          onUse={() =>
                            setCustomDesc((p) =>
                              (p ? p + " " : "") +
                              "Target audience: active young adults (18–29) who want a clean energy boost."
                            )
                          }
                        />
                        <HelperCard
                          title="Key Features"
                          subtitle="What makes it special?"
                          onUse={() =>
                            setCustomDesc((p) =>
                              (p ? p + " " : "") +
                              "Key features: zero sugar, natural caffeine, B-vitamins, recyclable can."
                            )
                          }
                        />
                        <HelperCard
                          title="Benefits"
                          subtitle="How does it help?"
                          onUse={() =>
                            setCustomDesc((p) =>
                              (p ? p + " " : "") +
                              "Benefits: smooth focus with no crash, great taste, on-the-go convenience."
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* toggles */}
            <div className="zy-card p-6">
              <RowToggle
                title="Auto-match scenes to product colors"
                sub="We’ll pull your primary/secondary palette and apply it to scenes & captions."
                checked={autoMatch}
                onChange={setAutoMatch}
              />
              <div className="h-4" />
              <RowToggle
                title="Use AI to suggest ad theme & script"
                sub="Generates a mood + storyboard draft you can edit on the next step."
                checked={useAISuggest}
                onChange={setUseAISuggest}
              />
            </div>

            {/* actions */}
            <div className="flex items-center gap-3">
              <button onClick={goBack} className={`${BTN_SOFT}`}>
                Back
              </button>
              <button
                onClick={goNext}
                disabled={!canContinue}
                className={`${BTN_PRIMARY} ${!canContinue ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                Continue <ChevronRight className="ml-1 inline h-4 w-4" />
              </button>
            </div>

            {mode === "describe" && (
              <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
                <span className="inline-flex items-center gap-2">
                  <Info className="h-4 w-4" /> Describe your product to help us create the best ad!
                </span>
                <div className="mt-2 h-2 w-full rounded-full bg-violet-200">
                  <div
                    className="h-2 rounded-full bg-violet-600 transition-all"
                    style={{ width: `${strength}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* right — live preview */}
          <aside className="zy-card h-fit overflow-hidden">
            <div className="border-b px-6 py-5">
              <div className="zy-section-title text-lg">Live product preview</div>
              <p className="zy-sub mt-1">This helps you visualize your ad before generation.</p>
            </div>

            <div className="p-6">
              <div className="relative mx-auto aspect-[9/16] w-full max-w-[320px] overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                {previewSrc ? (
                  <img src={previewSrc} alt="preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-400">
                    <div className="text-center">
                      <ImageIcon className="mx-auto mb-2 h-8 w-8" />
                      <div className="text-sm">Add/select a product to preview</div>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 text-xs text-gray-500">
                Preview uses your first image or product thumbnail. Final output adapts to your
                style choices next step.
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* small components */
function HelperCard({ title, subtitle, onUse }) {
  return (
    <div className="zy-choice">
      <div className="flex-1">
        <div className="font-semibold">{title}</div>
        <div className="zy-sub">{subtitle}</div>
      </div>
      <button onClick={onUse} className="text-sm font-semibold text-violet-700 hover:underline">
        Use
      </button>
    </div>
  );
}

function RowToggle({ title, sub, checked, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="font-semibold text-[#0A0F1C]">{title}</div>
        <div className="zy-sub">{sub}</div>
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}

function Switch({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        checked ? "bg-violet-600" : "bg-gray-300"
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
