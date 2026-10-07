import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Dialog, ErrorBanner, FOCUS, PrimaryButton, cx } from "../../../ui/zyvo";

/**
 * Pick characters from the library (1–3 for a video, 2–5 for a series).
 * pickOne mode ("Who is 'Vex'?"): choosing a character calls onPick(id) and
 * the caller closes the dialog.
 */
export default function CharacterLibraryDialog({ open, onClose, characters, selectedIds, max, onToggle, pickOne = false, onPick, title, description }) {
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return characters.characters.filter((c) => !q || `${c.name} ${c.tag} ${c.role} ${c.look ?? ""}`.toLowerCase().includes(q));
  }, [characters.characters, query]);

  const toggle = (id) => {
    if (pickOne) { onPick(id); return; }
    const on = selectedIds.includes(id);
    if (!on && selectedIds.length >= max) {
      setNotice(`You can pick up to ${max}. Remove one first.`);
      return;
    }
    setNotice("");
    onToggle(id);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={title ?? "Character library"}
      description={description ?? `Choose up to ${max}. Each one looks the same in every scene.`}
      footer={pickOne ? (
        <PrimaryButton variant="secondary" onClick={onClose} fullWidth={false} className="ml-auto px-6">Cancel</PrimaryButton>
      ) : (
        <>
          <p className="mr-auto self-center text-[11px] font-semibold text-white/40" aria-live="polite">{selectedIds.length} of {max} chosen</p>
          <PrimaryButton onClick={onClose} fullWidth={false} className="px-6">Done</PrimaryButton>
        </>
      )}
    >
      <label className="relative mb-3 block">
        <span className="sr-only">Search characters</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or role"
          className="w-full rounded-xl border border-white/[0.08] bg-[#111315] py-2.5 pl-9 pr-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-lime-300/35 focus:ring-1 focus:ring-lime-300/30"
        />
      </label>
      {notice && <p role="status" className="mb-2 text-[11px] font-semibold text-orange-300/80">{notice}</p>}

      {characters.status === "error" ? (
        <ErrorBanner action="Try again" onAction={characters.retry}>We couldn&apos;t load the character library.</ErrorBanner>
      ) : characters.status === "loading" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Loading characters">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-[150px] animate-pulse rounded-xl bg-white/[0.04] motion-reduce:animate-none" />)}
        </div>
      ) : list.length === 0 ? (
        <p className="py-8 text-center text-[12px] text-white/40">No characters match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {list.map((c) => {
            const on = selectedIds.includes(c.id);
            const full = !pickOne && !on && selectedIds.length >= max;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                aria-disabled={full || undefined}
                onClick={() => toggle(c.id)}
                className={cx(
                  "relative flex flex-col gap-1.5 rounded-xl border p-2 text-left transition",
                  FOCUS,
                  on ? "border-lime-300/50 bg-lime-300/[0.09]" : "border-white/[0.07] bg-white/[0.035] hover:border-lime-300/25",
                  full && "opacity-40",
                )}
              >
                <img src={c.refImageUrl} alt="" className="aspect-[4/3] w-full rounded-lg bg-[#0D0F11] object-cover object-top" loading="lazy" />
                {on && (
                  <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-lime-300 text-[#11150D]" aria-hidden="true">
                    <Check className="h-3 w-3" />
                  </span>
                )}
                <span className="text-[12px] font-black text-white">{c.name}</span>
                <span className="text-[10px] font-semibold leading-snug text-white/40">{c.tag}. {c.role}</span>
              </button>
            );
          })}
        </div>
      )}
    </Dialog>
  );
}
