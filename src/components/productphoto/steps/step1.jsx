import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function Step1({ onNext }) {
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;

        if (!user) {
          setError("You must be logged in to continue.");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("brand_products")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        setProducts(data || []);
      } catch (e) {
        setError(e.message || "Failed to load products.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const canContinue = !!selected;

  return (
    <section className="px-10 w-full">
      <div className="bg-white mt-4 w-full min-h-[420px] text-black rounded-lg flex flex-col">

        {/* TOP */}
        <div className="flex-1 py-6">

          {/* Step indicator */}
          <div className="flex justify-center">
            <div className="bg-[#ECE8F2] w-[240px] h-[35px] rounded-lg flex items-center gap-3 px-3">
              <StepCircle active>1</StepCircle>
              <StepLine />
              <StepLine />
              <StepCircle>2</StepCircle>
              <StepLine />
              <StepLine />
              <StepCircle>3</StepCircle>
            </div>
          </div>

          {/* Title */}
          <div className="flex justify-center mt-10">
            <h1 className="text-[#110829] font-semibold text-[18px]">
              Select Your Product
            </h1>
          </div>

          {/* Products */}
          <div className="flex justify-center mt-10">
            {loading ? (
              <p className="text-[#4A4A55]">Loading products…</p>
            ) : products.length === 0 ? (
              <p className="text-[#4A4A55]">
                No product created yet.
              </p>
            ) : (
              <div className="flex gap-4 flex-wrap justify-center">
              {products.map((p) => (
  <button
    key={p.id}
    onClick={() =>
      setSelected({
        id: p.id,
        title: p.title,
        src: p.image_url,
      })
    }
    className={`group w-[160px] rounded-lg shadow-lg overflow-hidden border-2 transition bg-white
      ${
        selected?.id === p.id
          ? "border-[#7A3BFF]"
          : "border-transparent"
      }`}
  >
    {p.image_url ? (
      <img
        src={p.image_url}
        alt={p.title || "Product"}
        className="w-full h-[180px] object-cover"
      />
    ) : (
      <div className="w-full h-[130px] bg-gray-200 flex items-center justify-center text-xs">
        No image
      </div>
    )}

    <div className="p-2 text-sm font-semibold text-[#110829] truncate">
      {p.title || "Untitled product"}
    </div>
  </button>
))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-red-500 text-center mt-6 text-sm">
              {error}
            </p>
          )}
        </div>

        {/* FOOTER */}
        <div className="mt-6 flex justify-end px-4 md:px-10 py-4">
          <button
            disabled={!canContinue}
            onClick={() => onNext(selected)}
            className={`py-1 px-8 border-2 rounded-tr-lg rounded-br-lg shadow-lg transition
              ${
                canContinue
                  ? "bg-white border-[#7A3BFF] "
                  : "bg-[#ECE8F2] border-[#ECE8F2] text-[#4A4A55] cursor-not-allowed"
              }`}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

/* ---------- UI helpers ---------- */

function StepCircle({ children, active }) {
  return (
    <div
      className={`rounded-full h-6 w-6 flex items-center justify-center
        ${active ? "bg-purple-300" : "bg-white"}`}
    >
      <p className="text-[#110829] text-sm">{children}</p>
    </div>
  );
}

function StepLine() {
  return <div className="bg-white h-[8px] w-[20px] rounded-lg" />;
}
