// src/pages/ads/Step5Avatar.jsx
import React, { useMemo, useRef } from "react";
import { cn } from "./ui";
import { BadgeCheck, ArrowLeft, ArrowRight, X, Info, Lock } from "lucide-react";

const BRAND = "#1677FF";

/** Map plan_code -> selectable avatar cap */
function capFromPlanCode(code) {
  if (code === "generative") return 50;
  if (code === "pro")        return 20;
  if (code === "starter")    return 5;
  return 0; // free / unknown
}

export default function Step5Avatar({
  catalog = [],
  model,                      // "veo-3.1-fast" | "sora-v5"
  selectedAvatar,
  setSelectedAvatar,
  rowRefA,
  rowRefB,
  scrollRow,
  onBack,
  onContinue,
  isSubmitting = false,
  user,                       // { plan_code?: string }
  openUpgradeModal,           // <-- fix: use this name
}) {
  /* ---------- Resolve cap from plan_code only ---------- */
  const planCode   = user?.plan_code ?? "free";
  const avatarsCap = capFromPlanCode(planCode);

  /* ---------- Normalize catalog to 50 items with placeholders ---------- */
  const normalized = useMemo(() => {
    return (catalog || []).map((a, idx) => ({
      id: a.id ?? `real-${idx}`,
      display_name: a.display_name ?? `Avatar ${idx + 1}`,
      voice_style: a.voice_style ?? "",
      _url: a._url ?? a.thumbnail_path ?? null,
      engine_variants: a.engine_variants ?? { veo: { primary_ref: true } },
      __placeholder: false,
    }));
  }, [catalog]);

  const displayItems = useMemo(() => {
    const items = [...normalized];
    for (let i = items.length; i < 50; i++) {
      items.push({
        id: `placeholder-${i}`,
        display_name: `Avatar ${i + 1}`,
        voice_style: "",
        _url: null,
        engine_variants: { veo: { primary_ref: true } },
        __placeholder: true,
      });
    }
    return items.slice(0, 50);
  }, [normalized]);

  /* ---------- Five rows of ten ---------- */
  const rows = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < 50; i += 10) chunks.push(displayItems.slice(i, i + 10));
    return chunks;
  }, [displayItems]);

  const rowTitles = [
    "Core presenters (all plans) — 1–10",
    "Pro expansion — 11–20",
    "Generative exclusives — 21–30",
    "Generative exclusives — 31–40",
    "Generative exclusives — 41–50",
  ];

  const rowRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];

  /* ---------- Locks by index only (5 / 20 / 50) ---------- */
  function requiredTierForIndex(idx) {
    if (idx < 5)  return null;                 // Starter+ can use 1..5
    if (idx < 20) return avatarsCap >= 20 ? null : "Pro";
    return avatarsCap >= 50 ? null : "Generative";
  }

  const toggleSelect = (a, idx) => {
    const required = requiredTierForIndex(idx);
    if (required) {
      openUpgradeModal
        ? openUpgradeModal(`Upgrade to ${required} to use this avatar.`)
        : alert(`Upgrade to ${required} to use this avatar.`);
      return;
    }
    if (a.__placeholder) return;
    setSelectedAvatar(selectedAvatar?.id === a.id ? null : a);
  };

  const TierChip = ({ a }) => (
    <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: BRAND }} />
      {model === "veo-3.1-fast" ? "V4" : "V5"}
      {a.engine_variants?.veo?.primary_ref && <BadgeCheck className="h-3 w-3" />}
    </div>
  );

  const Card = ({ item, idx, isSelected }) => {
    const required = requiredTierForIndex(idx);
    const locked   = !!required;

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => toggleSelect(item, idx)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? toggleSelect(item, idx) : null)}
        className={cn(
          "group relative w-48 shrink-0 rounded-2xl border p-2 text-left",
          "bg-white/[.03] hover:bg-white/[.05] border-white/12 hover:border-white/20",
          "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] transition",
          isSelected && "ring-2 ring-white/70 border-white/40",
          (locked || item.__placeholder) && "opacity-50"
        )}
      >
        <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-black/40">
          {item._url ? (
            <img
              src={item._url}
              alt={item.display_name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] text-white/60">
              Placeholder
            </div>
          )}

          <TierChip a={item} />

          {locked && (
            <div className="absolute inset-0 grid place-items-center bg-black/55 text-[11px] font-semibold text-white">
              <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                <span>Upgrade to {required}</span>
              </div>
            </div>
          )}

          {isSelected && !locked && !item.__placeholder && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear avatar"
              title="Remove selection"
              onClick={(e) => { e.stopPropagation(); setSelectedAvatar(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setSelectedAvatar(null); } }}
              className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/90 backdrop-blur hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-white/40"
            >
              <X className="h-4 w-4" />
            </span>
          )}
        </div>

        <div className="mt-2 text-sm font-extrabold text-white line-clamp-1">
          {item.display_name}
        </div>
        <div className="text-[11px] text-white/70 leading-snug line-clamp-2">
          {item.voice_style || ""}
        </div>

        {isSelected && !locked && !item.__placeholder && (
          <span className="mt-1 inline-block rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-black">
            Selected
          </span>
        )}
      </div>
    );
  };

  const Row = ({ title, items, rowIndex }) => (
    <div className="relative">
      <div className="mb-2 text-xs font-semibold text-white/80">{title}</div>
      <button
        aria-label="scroll left"
        onClick={() => scrollRow?.(rowRefs[rowIndex], -1)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 rounded-full border border-white/20 bg-black/40 p-2 backdrop-blur hover:bg-black/60"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <div ref={rowRefs[rowIndex]} className="flex gap-3 overflow-x-auto pb-2 px-10">
        {items.map((a, i) => {
          const globalIdx = rowIndex * 10 + i; // 0..49
          return (
            <Card
              key={a.id ?? `${rowIndex}-${i}`}
              item={a}
              idx={globalIdx}
              isSelected={selectedAvatar?.id === a.id}
            />
          );
        })}
      </div>
      <button
        aria-label="scroll right"
        onClick={() => scrollRow?.(rowRefs[rowIndex], 1)}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 rounded-full border border-white/20 bg-black/40 p-2 backdrop-blur hover:bg-black/60"
      >
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="text-base font-semibold">
          <span className="mr-1">5)</span> <span className="font-extrabold">Choose avatar</span>{" "}
          <span className="opacity-70">(optional, but recommended)</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-white/70">
          <Info className="h-3.5 w-3.5 text-white/60" />
          <span>
            A presenter boosts authority and trust. You can <span className="font-semibold text-white">skip</span> and add one later.
          </span>
        </div>
        <div className="mt-1 text-[11px] text-white/55">
          <span className="font-semibold">V4 (Veo)</span> uses a face reference.{" "}
          <span className="font-semibold">V5 (Sora)</span> follows text-only voice/style.
        </div>
      </div>

      {/* Rows */}
      {!displayItems.length ? (
        <div className="rounded-xl border border-white/10 bg-white/[.03] p-6 text-sm text-white/60">
          Loading avatars…
        </div>
      ) : (
        <div className="max-h-[520px] overflow-y-auto pr-1 space-y-4">
          {rows.map((items, idx) => (
            <Row key={idx} title={rowTitles[idx]} items={items} rowIndex={idx} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-white/15 bg-white/[.04] px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10 hover:border-white/25 transition"
        >
          Back
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onContinue?.(selectedAvatar || null)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              isSubmitting ? "bg-white/20 text-white/60 cursor-not-allowed" : "bg-white text-black hover:bg-white/90"
            )}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
