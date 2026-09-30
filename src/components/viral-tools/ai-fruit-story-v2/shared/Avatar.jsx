import { X } from "lucide-react";
import { FOCUS, cx } from "../../../ui/zyvo";

/** Round character avatar from the library reference image. */
export function Avatar({ character, size = "h-7 w-7", ring = true, className = "" }) {
  if (!character) return <span className={cx("inline-block rounded-full bg-white/10", size, className)} aria-hidden="true" />;
  return (
    <img
      src={character.refImageUrl}
      alt=""
      className={cx("shrink-0 rounded-full bg-[#111315] object-cover object-top", ring && "ring-2 ring-[#0C0F0D]", size, className)}
      loading="lazy"
    />
  );
}

/** Overlapping faces for a cast ("Mia, Marco and Pia"). */
export function AvatarStack({ ids, byId, size = "h-7 w-7", max = 5 }) {
  const cast = ids.map(byId).filter(Boolean);
  const names = cast.map((c) => c.name.split(" ")[0]);
  const label = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0] ?? "";
  return (
    <span className="flex -space-x-2" role="img" aria-label={label}>
      {cast.slice(0, max).map((c) => <Avatar key={c.id} character={c} size={size} />)}
    </span>
  );
}

/** Cast member chip, optionally removable. */
export function CastChip({ character, onRemove, disabled = false, role = null }) {
  if (!character) return null;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] py-1 pl-1 pr-2.5 text-[11px] font-bold text-white/80">
      <Avatar character={character} size="h-6 w-6" ring={false} />
      {character.name}
      <span className="font-semibold text-white/35">{role ?? character.tag}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${character.name}`}
          className={cx("-mr-1 grid h-5 w-5 place-items-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white disabled:opacity-40", FOCUS)}
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
