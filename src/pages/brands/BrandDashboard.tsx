// src/pages/brand/BrandDashboard.tsx (or .jsx)
import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { setCurrentBrand } from "../../lib/brandSession";

type BrandRow = { id: string; name: string | null };

export default function BrandDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [brand, setBrand] = useState<BrandRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    (async () => {
      if (!id) return;
      setLoading(true);
      setErr("");

      const { data, error } = await supabase
        .from("brands")
        .select("id,name")
        .eq("id", id)
        .single<BrandRow>();

      if (error || !data) {
        setErr("Brand not found.");
        setLoading(false);
        return;
      }

      setBrand(data);
      // Lock the session’s brand so all tools know which one to use.
      setCurrentBrand({ id: data.id, name: data.name ?? "" });
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12 text-white/70">
        Loading brand…
      </div>
    );
  }
  if (err || !brand) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-4 text-rose-400">{err || "Brand unavailable."}</div>
        <Link to="/brands" className="text-blue-400 underline">Back to brands</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-extrabold">{brand.name || "Untitled brand"}</h1>
        <Link to="/brands" className="text-white/70 hover:text-white">Switch brand</Link>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="Brand Workspace" onClick={() => navigate("/brand")} />
        <Card title="Avatar Studio"  onClick={() => navigate("/avatar-studio")} />
        <Card title="Recent Assets"  onClick={() => navigate("/library")} />
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        {[
          ["Generate Ad", "/ad-studio"],
          ["Product Photo", "/product-photos"],
          ["Thumbnail", "/enhancements"], // or your thumbnail page
          ["Logo Variant", "/brand-kit"],  // or brand-kit when ready
        ].map(([label, to]) => (
          <button
            key={label}
            onClick={() => navigate(to)}
            className="rounded-full border border-white/15 px-4 h-10 text-sm font-semibold text-white/90 hover:bg-white/10"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Card({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-white/10 p-6 text-left hover:bg-white/[.03] transition"
    >
      <div className="font-semibold">{title}</div>
      <div className="mt-2 text-sm text-white/60">Open</div>
    </button>
  );
}
