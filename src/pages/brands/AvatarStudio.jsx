// src/pages/avatars/AvatarStudio.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentBrand } from "../../lib/brandSession";
import { Camera, ChevronRight, Sparkles, Search, ArrowLeft } from "lucide-react";

/* --- tiny helpers (local) --- */
const cn = (...a) => a.filter(Boolean).join(" ");
const zyloGrad = "bg-gradient-to-r from-[#1677FF] to-[#7A3BFF]";

/* --- demo categories (swap to your DB later) --- */
function makeRow(names, img) {
  return names.map((n, i) => ({
    id: `${n.toLowerCase()}-${i}`,
    name: n,
    role: i % 2 ? "Influencer" : "Content Creator",
    scope: i % 3 === 0 ? "Full body" : "Face",
    imageUrl: img ? `${img}&sig=${i}` : null,
  }));
}

const CATEGORIES = [
  {
    key: "gamers",
    title: "Gamers",
    items: makeRow(
      ["Neo", "Pixel", "Rogue", "Glitch", "Kairo", "Astra"],
      "https://images.unsplash.com/photo-1530863138121-62c17f2d3d89?q=80&w=800"
    ),
  },
  {
    key: "young",
    title: "Young",
    items: makeRow(
      ["Lumi", "Mika", "Iris", "Eden", "Rio", "Kira"],
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=800"
    ),
  },
  {
    key: "creators",
    title: "UGC & Creators",
    items: makeRow(
      ["Aino", "Rhea", "Milo", "Zee", "Yara", "Indie"],
      "https://images.unsplash.com/photo-1520975922284-92aee6b371f2?q=80&w=800"
    ),
  },
  {
    key: "corporate",
    title: "Corporate",
    items: makeRow(
      ["Elina", "Tomi", "Vera", "Marko", "Johann", "Anya"],
      "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?q=80&w=800"
    ),
  },
  {
    key: "fitness",
    title: "Fitness & Sports",
    items: makeRow(
      ["Atlas", "Nova", "Sora", "Blaze", "Kade", "Valkyrie"],
      "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?q=80&w=800"
    ),
  },
  {
    key: "fantasy",
    title: "Stylized & Fantasy",
    items: makeRow(
      ["Aria", "Kael", "Nyx", "Rune", "Lyra", "Draco"],
      "https://images.unsplash.com/photo-1544551763-7ef4200d2f87?q=80&w=800"
    ),
  },
];

export default function AvatarStudio() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("home"); // "home" | "browse"
  const [brand, setBrand] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const b = await getCurrentBrand();
        const mapped = b
          ? {
              id: b.id,
              name: b.name || "Your Brand",
              avatar: {
                imageUrl:
                  b.avatar?.imageUrl ||
                  "https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=900",
                name: b.avatar?.name || "Brand Avatar",
                scope: b.avatar?.scope || "Face",
                role: b.avatar?.role || "Influencer",
              },
            }
          : null;
        setBrand(mapped);
      } catch (e) {
        console.warn("getCurrentBrand failed, using demo", e);
        setBrand({
          id: "demo",
          name: "Demo Brand",
          avatar: {
            imageUrl:
              "https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=900",
            name: "Aava",
            scope: "Face",
            role: "Influencer",
          },
        });
      }
    })();
  }, []);

  return (
    <main className="w-full bg-[#0b0f14] text-white min-h-screen py-8">
      <div className="mx-auto w-full max-w-[1100px] px-4">
        {/* header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-white/60">
              Avatar Studio
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {brand?.name || "Brand"}
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-1 w-[170px]">
            {["home", "browse"].map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "h-8 rounded-full text-sm font-semibold",
                  tab === key ? "bg-white text-black" : "bg-white/10 text-white/70"
                )}
              >
                {key === "home" ? "Home" : "Browse"}
              </button>
            ))}
          </div>
        </div>

        {/* content */}
        <div className="rounded-2xl border border-white/10 bg-[#10151d] p-5 sm:p-6">
          {tab === "home" ? (
            <HomePane brand={brand} onChange={() => setTab("browse")} />
          ) : (
            <BrowsePane onBack={() => setTab("home")} />
          )}
        </div>
      </div>
    </main>
  );
}

/* -------------------- Home Pane -------------------- */
function HomePane({ brand, onChange }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* left: brand avatar card */}
      <div className="lg:col-span-2">
        <div className="rounded-2xl border border-white/10 bg-white/[.02] overflow-hidden">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 opacity-80" />
              <div className="font-semibold">Brand avatar</div>
            </div>
            <button
              onClick={onChange}
              className={cn(
                "inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold",
                zyloGrad
              )}
            >
              Change <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* 9:16 preview */}
          <div className="px-4 pb-4">
            <div className="relative w-full max-w-sm aspect-[9/16] overflow-hidden rounded-xl border border-white/10 bg-black mx-auto">
              <img
                src={brand?.avatar?.imageUrl}
                alt={brand?.avatar?.name || "Brand avatar"}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
            </div>

            {/* small details */}
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <Info label="Name" value={brand?.avatar?.name || "—"} />
              <Info label="Scope" value={brand?.avatar?.scope || "Face"} />
              <Info label="Role" value={brand?.avatar?.role || "Influencer"} />
            </div>
          </div>
        </div>
      </div>

      {/* right: actions */}
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 mt-0.5 opacity-90" />
            <div>
              <div className="text-lg font-bold">Browse Zylo’s avatars</div>
              <div className="text-sm text-white/70">
                Pick from curated categories to start faster.
              </div>
            </div>
          </div>
          <button
            onClick={onChange}
            className="mt-4 w-full h-10 rounded-xl bg-white text-black font-semibold hover:opacity-90"
          >
            Open browser
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[.02] p-5">
          <div className="text-lg font-bold">Create your own avatar</div>
          <div className="text-sm text-white/70 mt-1">
            Coming to Zylo soon. Train a custom face/full-body avatar for ads & UGC.
          </div>
          <button
            disabled
            className="mt-4 w-full h-10 rounded-xl bg-white/10 text-white/50 font-semibold cursor-not-allowed"
          >
            Coming soon
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[.02] p-3">
      <div className="text-[10px] uppercase tracking-widest text-white/60">{label}</div>
      <div className="mt-0.5 font-semibold">{value}</div>
    </div>
  );
}

/* -------------------- Browse Pane -------------------- */
function BrowsePane({ onBack }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query) return CATEGORIES;
    const q = query.toLowerCase();
    return CATEGORIES.map((c) => ({
      ...c,
      items: c.items.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          it.role.toLowerCase().includes(q) ||
          it.scope.toLowerCase().includes(q)
      ),
    })).filter((c) => c.items.length > 0);
  }, [query]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-xl text-sm font-semibold border border-white/15 text-white/90 hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="flex-1 max-w-lg ml-auto flex items-center gap-2 rounded-xl border border-white/15 px-3 h-10 bg-white/[.02]">
          <Search className="h-4 w-4 opacity-70" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search avatars by name, role, or scope"
            className="w-full bg-transparent outline-none text-sm"
          />
        </div>
      </div>

      {filtered.map((cat) => (
        <CategoryRow key={cat.key} title={cat.title} items={cat.items} />
      ))}
    </div>
  );
}

function CategoryRow({ title, items }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">{title}</h3>
        <button className="text-sm text-white/70 hover:text-white inline-flex items-center gap-1">
          View all <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div
        className="flex gap-4 overflow-x-auto pb-2
        [mask-image:linear-gradient(to_right,transparent,black_2rem,black_calc(100%-2rem),transparent)]
        [-webkit-mask-image:linear-gradient(to_right,transparent,black_2rem,black_calc(100%-2rem),transparent)]"
      >
        {items.map((av) => (
          <AvatarCard key={av.id} avatar={av} />
        ))}
      </div>
    </section>
  );
}

function AvatarCard({ avatar }) {
  return (
    <div className="min-w-[180px] max-w-[180px]">
      <div className="relative aspect-[9/16] rounded-xl overflow-hidden border border-white/10 bg-black">
        {avatar.imageUrl ? (
          <img
            src={avatar.imageUrl}
            alt={avatar.name}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-3xl font-extrabold">
            {avatar.name.slice(0, 1)}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 p-2 backdrop-blur bg-black/35">
          <div className="text-sm font-semibold leading-tight truncate">
            {avatar.name}
          </div>
          <div className="text-[11px] opacity-90 leading-tight truncate">
            {avatar.role} • {avatar.scope}
          </div>
        </div>
      </div>

      <button
        className={cn(
          "mt-2 w-full h-9 rounded-xl text-sm font-semibold hover:opacity-90",
          zyloGrad
        )}
        onClick={() => {
          // TODO: wire to Supabase -> set as brand avatar, then navigate back.
          alert(`Use avatar: ${avatar.name} (wire this to update brand)`);
        }}
      >
        Use avatar
      </button>
    </div>
  );
}
