// src/pages/Library.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  CREATION_TYPES,
  listCreationsByType,
  subscribeCreations,
  deleteCreation,
} from "../lib/creations";
import { Download, X, ChevronLeft, ChevronRight } from "lucide-react";

/* ---------- Rows config ---------- */
const creationRows = [
  { key: CREATION_TYPES.PHOTO,         label: "Photos",         alwaysShow: true },
  { key: CREATION_TYPES.VIDEO,         label: "Videos",         alwaysShow: true },
  { key: CREATION_TYPES.PRODUCT_AD,    label: "Product Ads",    alwaysShow: true },
  { key: CREATION_TYPES.PRODUCT_PHOTO, label: "Product Photos", alwaysShow: true },
];

export default function Library() {
  const { user, loading } = useAuth();

  const [items, setItems] = useState({
    [CREATION_TYPES.PHOTO]: [],
    [CREATION_TYPES.VIDEO]: [],
    [CREATION_TYPES.PRODUCT_AD]: [],
    [CREATION_TYPES.PRODUCT_PHOTO]: [],
  });
  const [showPrompts, setShowPrompts] = useState(false);
  const unsubRef = useRef(null);

  /* ---------- Fetch creations + subscribe (deduped) ---------- */
  useEffect(() => {
    if (loading || !user) return;

    // initial lists
    Promise.all(creationRows.map((r) => listCreationsByType(user.id, r.key)))
      .then((listArr) => {
        const next = {};
        creationRows.forEach((r, i) => (next[r.key] = listArr[i] || []));
        setItems(next);
      })
      .catch(console.error);

    // clear any previous listener, then subscribe once
    if (unsubRef.current) {
      try { unsubRef.current(); } catch {}
      unsubRef.current = null;
    }

    unsubRef.current = subscribeCreations(user.id, (row) => {
      setItems((prev) => {
        const list = prev[row.type] || [];
        if (list.some((x) => x.id === row.id)) return prev; // de-dupe
        return { ...prev, [row.type]: [row, ...list] };
      });
    });

    return () => {
      try { unsubRef.current?.(); } catch {}
      unsubRef.current = null;
    };
  }, [user?.id, loading, user]);

  if (loading) return null;

  const isAllEmpty = creationRows.every((r) => (items[r.key] || []).length === 0);

  return (
    <div className="py-6">
      {/* centered container so it never runs under the sidebar */}
      <div className="mx-auto w-full max-w-[1180px] px-4 lg:px-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Your Library</h1>
            <p className="text-sm text-white/60">
              All your generated assets in one place.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-white/80 select-none">
            <input
              type="checkbox"
              className="accent-[#7A3BFF] w-4 h-4"
              checked={showPrompts}
              onChange={(e) => setShowPrompts(e.target.checked)}
            />
            Show prompts
          </label>
        </div>

        {/* Empty state */}
        {isAllEmpty ? (
          <div className="mt-12 rounded-xl border border-white/10 p-10 text-center">
            <p className="text-white/80">
              Nothing here yet. Generate an image or video — new results will appear automatically.
            </p>
          </div>
        ) : null}

        {/* One horizontal row per type */}
        {creationRows.map((row) => (
          <HScrollRow
            key={row.key}
            typeKey={row.key}
            label={row.label}
            data={items[row.key] || []}
            showPrompts={showPrompts}
            alwaysShow={row.alwaysShow}
            onDelete={async (it) => {
              const yes = window.confirm("Delete this item? This cannot be undone.");
              if (!yes) return;
              try {
                await deleteCreation(it);
                setItems((prev) => ({
                  ...prev,
                  [row.key]: prev[row.key].filter((x) => x.id !== it.id),
                }));
              } catch (e) {
                alert(e.message || "Failed to delete.");
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------- Horizontal scroll row -------------------- */
function HScrollRow({ typeKey, label, data, showPrompts, onDelete, alwaysShow = false }) {
  const rowRef = useRef(null);
  const filtered = (data || []).filter((d) => d?.type === typeKey);
  const has = filtered.length > 0;

  if (!has && !alwaysShow) return null;

  const nudge = (dir = 1) => {
    if (!rowRef.current) return;
    rowRef.current.scrollBy({ left: dir * 720, behavior: "smooth" });
  };

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium text-white">{label}</h2>
        {!has ? null : (
          <div className="flex gap-2 md:hidden">
            <button
              aria-label="Scroll left"
              onClick={() => nudge(-1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/40 backdrop-blur hover:bg-black/60"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              aria-label="Scroll right"
              onClick={() => nudge(1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/40 backdrop-blur hover:bg-black/60"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {!has ? (
        <div className="rounded-xl border border-white/10 p-6 text-sm text-white/70">
          {`No ${label.toLowerCase()} have been generated yet.`}
        </div>
      ) : (
        <div className="relative">
          {/* edge fades */}
          <div className="pointer-events-none absolute left-0 top-0 h-full w-8 bg-gradient-to-r from-[#0B1117] to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-[#0B1117] to-transparent" />

          {/* arrows on md+ */}
          <button
            aria-label="Scroll left"
            onClick={() => nudge(-1)}
            className="hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 backdrop-blur hover:bg-black/60"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            aria-label="Scroll right"
            onClick={() => nudge(1)}
            className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 backdrop-blur hover:bg-black/60"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* scroll container */}
          <div
            ref={rowRef}
            className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
          >
            {filtered.map((it) => (
              <div key={it.id} className="snap-start">
                <Card
                  item={it}
                  showPrompt={showPrompts}
                  onDelete={() => onDelete(it)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* -------------------- Viewer modal -------------------- */
function ViewerModal({ open, onClose, item }) {
  if (!open || !item) return null;
  const isVideo = item.type === CREATION_TYPES.VIDEO;

  const download = () => {
    const a = document.createElement("a");
    a.href = item.file_url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white"
          title="Close"
        >
          <X size={18} />
        </button>

        <div className="rounded-2xl overflow-hidden border border-white/15 bg-[#0b0f14]">
          <div className="bg-black/30 flex items-center justify-center max-h-[70vh]">
            {isVideo ? (
              <video
                src={item.file_url}
                className="w-full h-full object-contain"
                controls
                playsInline
              />
            ) : (
              <img
                src={item.file_url}
                alt=""
                className="w-full h-full object-contain"
              />
            )}
          </div>

          <div className="p-3 flex items-center justify-between gap-3">
            <p className="text-xs text-white/70 line-clamp-2">
              {item.prompt || "—"}
            </p>
            <button
              onClick={download}
              className="shrink-0 inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/5"
            >
              <Download size={14} />
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Creation Card (fixed width for rows) -------------------- */
function Card({ item, showPrompt, onDelete }) {
  const isVideo = item.type === CREATION_TYPES.VIDEO;
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="group relative w-[260px] sm:w-[300px] rounded-xl border border-white/10 overflow-hidden bg-[#0f1115]">
        {/* Delete X */}
        <button
          onClick={onDelete}
          className="absolute right-2 top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/60 hover:bg-black/80 text-white/80 hover:text-white"
          title="Delete"
        >
          <X size={14} />
        </button>

        {/* Media (open modal) */}
        <button
          onClick={() => setOpen(true)}
          className="block w-full text-left"
          title="Open"
        >
          <div className={`${isVideo ? "aspect-video" : "aspect-[4/3]"} bg-black/30 flex items-center justify-center`}>
            {isVideo ? (
              <video
                src={item.file_url}
                className="h-full w-full object-cover"
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              <img
                src={item.file_url}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            )}
          </div>
        </button>

        {/* Footer */}
        <div className="p-2.5 flex items-start justify-between gap-3">
          {showPrompt ? (
            <p className="text-[11px] text-white/70 line-clamp-2">
              {item.prompt || "—"}
            </p>
          ) : (
            <div />
          )}

          <a
            href={item.file_url}
            download
            className="shrink-0 inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/5"
          >
            <Download size={14} />
            Download
          </a>
        </div>
      </div>

      <ViewerModal open={open} onClose={() => setOpen(false)} item={item} />
    </>
  );
}
