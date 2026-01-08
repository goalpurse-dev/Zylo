import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import CreateBrandWizard from "./CreateBrandWizard";

type BrandRow = {
  id: string;
  name: string;
  description: string | null;
  palette_json: any | null;
};

type ProfileRow = {
  id: string;
  plan_code: string | null;
};

/* ---------------- helpers ---------------- */
function localDayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function persistCurrentBrand(id: string, name = "") {
  const rec = { id, name, dayKey: localDayKey(), selectedAt: Date.now() };
  localStorage.setItem("curBrand", JSON.stringify(rec));
  localStorage.setItem("activeBrandId", id);
  try {
    sessionStorage.setItem("curBrand", JSON.stringify({ id, name, selectedAt: Date.now() }));
    window.dispatchEvent(new StorageEvent("storage", { key: "curBrand", newValue: JSON.stringify(rec) }));
  } catch {}
}

function limitForPlan(planCode?: string | null): number {
  const p = String(planCode || "").toLowerCase();
  if (p === "pro") return 5;
  if (p === "generative" || p === "business") return 10;
  return 2;
}

function initialFrom(name?: string | null) {
  const n = (name || "").trim();
  return n ? n[0]!.toUpperCase() : "•";
}

/* ---------------- component ---------------- */
export default function BrandPicker() {
  const nav = useNavigate();
  const [brands, setBrands] = useState<BrandRow[] | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) {
          setBrands([]);
          setProfile(null);
          return;
        }

        const [{ data: prof }, { data: list }] = await Promise.all([
          supabase.from("profiles").select("id, plan_code").eq("id", uid).single(),
          supabase
            .from("brands")
            .select("id,name,description,palette_json")
            .eq("user_id", uid)
            .order("created_at", { ascending: false }),
        ]);

        setProfile(prof ?? null);
        setBrands(list ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const maxBrands = useMemo(() => limitForPlan(profile?.plan_code), [profile?.plan_code]);
  const count = brands?.length ?? 0;
  const atLimit = count >= maxBrands;

  function goToBrandHome(id: string) {
    nav(`/brand/${encodeURIComponent(id)}`, { replace: true });
  }

  function onPick(b: BrandRow) {
    persistCurrentBrand(b.id, b.name);

    const pending = localStorage.getItem("pendingBrandRoute");
    if (pending) {
      localStorage.removeItem("pendingBrandRoute");
      nav(pending, { replace: true });
      return;
    }
    goToBrandHome(b.id);
  }

  function tryOpenCreate() {
    if (atLimit) {
      nav("/pricing");
      return;
    }
    setOpen(true);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold">Your Brands</h1>
          {!loading && (
            <span className="text-xs sm:text-sm text-white/70">
              <strong>{count}</strong> / <strong>{maxBrands}</strong> brands (plan:{" "}
              {String(profile?.plan_code || "starter")})
            </span>
          )}
        </div>

        <button
          onClick={tryOpenCreate}
          disabled={atLimit}
          className={
            "rounded-full h-11 px-6 font-semibold text-white " +
            (atLimit ? "bg-white/10 cursor-not-allowed" : "bg-gradient-to-r from-[#1677FF] to-[#7A3BFF]")
          }
        >
          {atLimit ? "Limit reached" : "Create Brand"}
        </button>
      </div>

      {atLimit && (
        <div className="mb-6 rounded-2xl border border-white/15 bg-[#10151d] p-4 text-sm text-white/80">
          You’ve reached your brand limit.{" "}
          <button onClick={() => nav("/pricing")} className="underline underline-offset-2 decoration-2 text-white">
            Upgrade here →
          </button>
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-white/10 p-10 text-center text-white/70">Loading…</div>
      )}

      {!loading && !brands?.length && (
        <div className="rounded-2xl border border-white/10 p-10 text-center bg-white/[.02]">
          <p className="text-lg text-white/80">You don’t have a brand yet. Let’s make one in 60 seconds.</p>
          <button
            onClick={tryOpenCreate}
            disabled={atLimit}
            className={
              "mt-6 rounded-full h-11 px-6 font-semibold text-white " +
              (atLimit ? "bg-white/10 cursor-not-allowed" : "bg-gradient-to-r from-[#1677FF] to-[#7A3BFF]")
            }
          >
            {atLimit ? "Limit reached" : "Create Brand"}
          </button>
        </div>
      )}

      {!!brands?.length && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {brands.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl border border-white/10 bg-white/[.02] p-5 hover:bg-white/[.05] transition"
            >
              <div className="flex items-center gap-3">
                {/* Neutral, no-gradient avatar with initial */}
                <div
                  className="h-11 w-11 rounded-xl bg-white/[.06] ring-1 ring-white/10 grid place-items-center"
                  aria-hidden="true"
                >
                  <span className="text-sm font-bold text-white/80 leading-none select-none">
                    {initialFrom(b.name)}
                  </span>
                </div>

                <div>
                  <div className="font-semibold">{b.name}</div>
                  <div className="text-xs text-white/60 line-clamp-1">{b.description || "—"}</div>
                </div>
              </div>

              <div className="mt-4 flex justify-between">
                <button onClick={() => onPick(b)} className="text-[#7A3BFF] font-medium">
                  Use this brand →
                </button>
                <button onClick={() => goToBrandHome(b.id)} className="text-white/60">
                  Open
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateBrandWizard
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(id: string) => {
          setOpen(false);
          persistCurrentBrand(id, "");
          const pending = localStorage.getItem("pendingBrandRoute");
          if (pending) {
            localStorage.removeItem("pendingBrandRoute");
            nav(pending, { replace: true });
          } else {
            goToBrandHome(id);
          }
        }}
      />
    </div>
  );
}
