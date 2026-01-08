// src/pages/brands/BrandWorkspace.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pencil, Wand2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { getCurrentBrand } from "../../lib/brandSession";

const cn = (...a) => a.filter(Boolean).join(" ");
const wrap = "mx-auto w-full max-w-[1180px] px-4 lg:px-2";

// clear brand selection from both storages (your app used both at points)
function clearBrandSelection() {
  try {
    localStorage.removeItem("curBrand");
    localStorage.removeItem("activeBrandId");
    sessionStorage.removeItem("curBrand");
  } catch {}
}

/* ---------- signed URL helpers (for private 'products' bucket) ---------- */
const isStoragePath = (s) => !!s && !/^https?:\/\//i.test(s); // not a URL => it's a storage path
async function signProductsUrl(path) {
  const { data, error } = await supabase.storage
    .from("products")
    .createSignedUrl(path, 60 * 60); // 1 hour
  if (error) {
    console.warn("sign url failed:", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/* ---------- fallback caps if features aren't hydrated ---------- */
function capFromPlanCode(code) {
  // Adjust if you prefer different numbers; these are sensible defaults.
  if (code === "generative") return 20;
  if (code === "pro") return 5;
  if (code === "starter") return 2;
  return 1; // free/unknown
}

export default function BrandWorkspace() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState(null);

  const [nameEdit, setNameEdit] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState("");

  const [products, setProducts] = useState([]);
  const [pLoading, setPLoading] = useState(true);

  // plan / features -> product cap
  const [planCode, setPlanCode] = useState("free");
  const [productsCap, setProductsCap] = useState(null); // number | null while loading

  // --------- load selected brand for this session ----------
  useEffect(() => {
    (async () => {
      try {
        const sel = getCurrentBrand();
        const selectedId = sel?.id;
        if (!selectedId) {
          navigate("/brands", { replace: true });
          return;
        }

        const { data: row, error } = await supabase
          .from("brands")
          .select("id,name,created_at")
          .eq("id", selectedId)
          .single();

        if (error) throw error;

        setBrand(row);
        setNameInput(row?.name || "");
      } catch (e) {
        console.error("load brand failed", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  // --------- load plan (plan_code + features.products_max if available) ----------
  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) {
          setPlanCode("free");
          setProductsCap(capFromPlanCode("free"));
          return;
        }

        // Try fetch features via profiles -> app_plans join
        const { data: row } = await supabase
          .from("profiles")
          .select("plan_code, app_plans:app_plans!inner(code, features)")
          .eq("id", uid)
          .maybeSingle();

        const pCode = row?.plan_code || row?.app_plans?.code || "free";
        setPlanCode(pCode);

        let cap = row?.app_plans?.features?.products_max;
        if (typeof cap !== "number") {
          // Fallback: direct lookup by plan_code
          const { data: planRow } = await supabase
            .from("app_plans")
            .select("features")
            .eq("code", pCode)
            .maybeSingle();
          cap = planRow?.features?.products_max;
        }
        setProductsCap(typeof cap === "number" ? cap : capFromPlanCode(pCode));
      } catch (e) {
        console.warn("load plan failed:", e?.message || e);
        setPlanCode("free");
        setProductsCap(capFromPlanCode("free"));
      }
    })();
  }, []);

  // --------- products for this user (filtered to current brand) ----------
  useEffect(() => {
    (async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        const uid = user?.user?.id;
        const cur = getCurrentBrand();
        const brandId = cur?.id;
        if (!uid || !brandId) { setPLoading(false); return; }

        const { data, error } = await supabase
          .from("brand_products")
          .select("id, title, thumb, image_url, created_at, product, platform, brand_id")
          .eq("user_id", uid)
          .eq("brand_id", brandId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Normalize fields to prefer product.*
        const withUrls = await Promise.all(
          (data ?? []).map(async (p) => {
            const prod = p.product || {};
            const displayName = prod.name || p.title || "Untitled product";

            // prefer product.image_url, fallback to legacy
            const pathOrUrl = prod.image_url || p.thumb || p.image_url || null;

            let url = pathOrUrl;
            if (pathOrUrl && isStoragePath(pathOrUrl)) {
              url = await signProductsUrl(pathOrUrl);
            }

            return {
              ...p,
              _displayName: displayName,
              _url: url, // render-ready
            };
          })
        );

        setProducts(withUrls);
      } catch (e) {
        console.error("load products failed", e);
      } finally {
        setPLoading(false);
      }
    })();
  }, []);

  // --------- save name (never update with NULL) ----------
  async function saveName() {
    if (!brand?.id) return;
    const value = (nameInput ?? "").trim();
    setNameError("");

    try {
      const { error } = await supabase
        .from("brands")
        .update({ name: value })
        .eq("id", brand.id);
      if (error) throw error;

      setBrand((b) => ({ ...b, name: value }));
      setNameEdit(false);
    } catch (e) {
      console.error(e);
      setNameError(e?.message || "Failed to save name");
    }
  }

  const atCap = productsCap != null && products.length >= productsCap;

  return (
    <main className="w-full bg-[#0b0f14] text-white py-8 min-h-screen">
      <div className={wrap}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight">Brand Workspace</h1>

          {/* Switch brand – remembers to come back to /brand */}
          <button
            onClick={() => {
              localStorage.setItem("pendingBrandRoute", "/brand");
              clearBrandSelection();
              navigate("/brands");
            }}
            className="text-sm text-white/70 hover:text-white hover:underline"
          >
            Switch brand
          </button>
        </div>

        {/* Brand name card */}
        <section className="rounded-2xl border border-white/10 bg-[#10151d] p-5 shadow-sm mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-white/60">Brand name</div>

              {!loading && !nameEdit && (
                <div className="mt-1 flex items-center gap-3">
                  <div
                    className={cn(
                      "text-xl font-semibold",
                      brand?.name ? "text-white/90" : "text-white/40 italic"
                    )}
                  >
                    {brand?.name || "Add a name"}
                  </div>
                  <button
                    onClick={() => setNameEdit(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-2.5 py-1 text-xs font-semibold text-white/80 hover:bg-white/10"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Change name
                  </button>
                </div>
              )}

              {nameEdit && (
                <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Your brand name"
                    className="w-full sm:w-80 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF]"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveName}
                      className="rounded-lg bg-white text-black px-3 py-2 text-sm font-semibold hover:opacity-90"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setNameInput(brand?.name || "");
                        setNameEdit(false);
                        setNameError("");
                      }}
                      className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
                    >
                      Cancel
                    </button>
                  </div>
                  {nameError && <div className="text-xs text-rose-400">{nameError}</div>}
                </div>
              )}
            </div>

            <button
              onClick={() => navigate("/brand/name-assistant")}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[.04] px-3 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
              title="Let AI suggest names"
            >
              <Wand2 className="h-4 w-4" />
              Let AI help you generate a name
            </button>
          </div>
        </section>

        {/* Products */}
        <section className="rounded-2xl border border-white/10 bg-[#10151d] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold text-white/85">Products</h2>

            {/* Right-side actions */}
            <div className="flex items-center gap-3">
              {/* Progress text */}
              <div className="text-xs text-white/60">
                {productsCap == null ? (
                  "Loading limit…"
                ) : (
                  <span>
                    <span className="font-semibold text-white/85">{products.length}</span>
                    {" / "}
                    <span className="font-semibold text-white/85">{productsCap}</span>{" "}
                    products created for this brand
                    {planCode ? <span className="opacity-60"> (plan: {planCode})</span> : null}
                  </span>
                )}
              </div>

              {/* Create button (gated) */}
              {atCap ? (
                <button
                  onClick={() => navigate("/pricing")}
                  className="rounded-xl bg-white/10 text-white/70 px-3 py-2 text-sm font-semibold hover:bg-white/15 border border-white/15"
                  title="You've reached your product limit for this plan. Upgrade to add more."
                >
                  Upgrade to add more
                </button>
              ) : (
                <Link
                  to="/products/new"
                  className="rounded-xl bg-white text-black px-3 py-2 text-sm font-semibold hover:opacity-90"
                >
                  Create product
                </Link>
              )}
            </div>
          </div>

          <div className="mb-3 text-[11px] text-white/50">
            {productsCap != null && atCap
              ? "You’ve reached the limit of products for this brand on your current plan."
              : "Choose a product to edit its details, images and ad options."}
          </div>

          {pLoading ? (
            <div className="text-white/60 text-sm">Loading…</div>
          ) : products.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((p) => (
                <article
                  key={p.id}
                  onClick={() => navigate(`/products/${p.id}/edit`)}
                  className="overflow-hidden rounded-xl border border-white/10 bg-white/[.03] cursor-pointer hover:bg-white/[.06] transition"
                >
                  {/* 9:16 frame + use signed url */}
                  <div className="aspect-[9/16] bg-black">
                    {p._url ? (
                      <img
                        src={p._url}
                        alt={p._displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/40 text-xs">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-semibold line-clamp-1">
                      {p._displayName}
                    </div>
                    {/* Optional: show platform or category preview */}
                    {p.product?.category && (
                      <div className="mt-1 text-[11px] text-white/55">
                        {p.product.category}
                      </div>
                    )}
                    <div className="mt-2">
                      <Link
                        to={`/products/${p.id}`}
                        className="text-xs text-white/70 underline underline-offset-2 hover:text-white"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View details
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-white/10 bg:white/[.03] p-6 h-36 flex flex-col items-center justify-center text-center bg-white/[.03]">
                <div className="text-sm font-semibold text-white/85">No products yet</div>
                {!atCap ? (
                  <Link
                    to="/products/new"
                    className="mt-3 text-xs font-semibold text-white/90 hover:text-white hover:underline underline-offset-2 decoration-2"
                  >
                    Create one now →
                  </Link>
                ) : (
                  <button
                    onClick={() => navigate("/pricing")}
                    className="mt-3 text-xs font-semibold text-white/90 hover:underline underline-offset-2"
                  >
                    Upgrade to add more →
                  </button>
                )}
              </div>

              <div className="mt-3 text-xs text-white/60">
                <div className="font-semibold text-white/80 mb-1">
                  Tips for a great ad-ready product:
                </div>
                <ul className="list-disc ml-5 space-y-1">
                  <li>One clear front-facing product photo (clean/solid backdrop is ideal).</li>
                  <li>Short title + 1–2 line description (materials, key features).</li>
                  <li>1–3 extra reference photos from different angles (optional).</li>
                  <li>Keep naming consistent—this is the label we’ll use inside ads.</li>
                </ul>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
