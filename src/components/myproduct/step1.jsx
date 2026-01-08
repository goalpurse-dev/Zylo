import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";

function capFromPlanCode(code) {
  if (code === "generative") return 20;
  if (code === "pro") return 5;
  if (code === "starter") return 3;
  return 1;
}

export default function Step1({ onCreate, onEdit }) {
  const { user, loading } = useAuth();

  const [products, setProducts] = useState([]);
  const [productsCap, setProductsCap] = useState(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user || loading) {
      setProducts([]);
      setProductsCap(0);
      setFetching(false);
      return;
    }

    (async () => {
      try {
        // 1️⃣ Load plan & product cap
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan_code, app_plans:app_plans!inner(code, features)")
          .eq("id", user.id)
          .maybeSingle();

        const planCode =
          profile?.plan_code || profile?.app_plans?.code || "free";

        const cap =
          profile?.app_plans?.features?.products_max ??
          capFromPlanCode(planCode);

        setProductsCap(cap);

        // 2️⃣ Load products (REAL table + correct fields)
        const { data: items, error } = await supabase
          .from("brand_products")
          .select("id, title, description, image_url, platform")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        setProducts(items || []);
      } catch (e) {
        console.error("Load products failed:", e);
      } finally {
        setFetching(false);
      }
    })();
  }, [user, loading]);

  const atCap =
    productsCap != null && products.length >= productsCap;

  return (
    <section className="px-10">
      {/* Header */}
      <div className="flex justify-between items-center mt-20 max-w-6xl">
        <h1 className="text-[#110829] font-semibold">
          Your Products
        </h1>

        <div className="flex items-center">
          <p className="text-[#4A4A55] px-4 font-semibold">
            {products.length}/{productsCap ?? "—"}
          </p>

          <button
            onClick={onCreate}
            disabled={atCap}
            className={`px-6 py-1 rounded-lg border ${
              atCap
                ? "bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed"
                : "bg-white text-[#7A3BFF] border-[#7A3BFF]"
            }`}
          >
            Add Product
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="py-3">
        <div className="bg-white border border-black py-8 max-w-6xl">
          {fetching ? null : products.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center py-10">
              <h2 className="text-[#110829]">
                No products yet
              </h2>

              {!atCap && (
                <button
                  onClick={onCreate}
                  className="text-[#7A3BFF] underline mt-2"
                >
                  Add one now
                </button>
              )}
            </div>
          ) : (
            // Products grid
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4 px-4">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="group relative w-[140px] h-[180px] rounded-lg overflow-hidden border bg-white"
                >
                  {/* Image */}
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.title}
                      className="w-full h-[130px] object-cover"
                    />
                  ) : (
                    <div className="w-full h-[130px] bg-gray-200 flex items-center justify-center text-xs">
                      No image
                    </div>
                  )}

                  {/* Title */}
                  <div className="relative z-10 p-2 text-sm font-semibold text-[#110829] truncate">
                    {p.title || "Untitled"}
                  </div>

                  {/* Edit overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center z-20">
                    <button
                      onClick={() => onEdit(p)}
                      className="bg-white text-[#110829] px-4 py-1 rounded-md text-sm font-semibold"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
