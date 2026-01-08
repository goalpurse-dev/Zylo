// src/pages/tools/ProductPhotoAvatarStep.jsx
import React, { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const cn = (...a) => a.filter(Boolean).join(" ");
const zyloGrad = "bg-gradient-to-r from-blue-600 to-purple-600";

export default function ProductPhotoAvatarStep({
  selectedAvatar,
  setSelectedAvatar,
  avatarPrompt,
  setAvatarPrompt,
  // ✅ default to [] so .map never crashes
  presets = [],
  onBack,
  onCreate,
  creating = false,
  credits = 0,
}) {
  const stripRef = useRef(null);
  const hasAvatar = selectedAvatar && selectedAvatar.id !== "none";

  function scrollStrip(dir) {
    const el = stripRef.current;
    if (!el) return;
    const amount = 260;
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  }

  return (
    <div className="space-y-5">
      {/* top bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-xl text-sm font-semibold border border-white/15 bg-black/70 text-white/90 hover:bg-black"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <div className="text-sm text-white/70">Step 3 of 3</div>
      </div>

      {/* title */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="text-base font-semibold">
            3) Choose avatar (optional)
          </div>
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[#7A3BFF]/18 text-[#b99bff] uppercase tracking-[0.16em]">
            Optional
          </span>
        </div>
        <div className="text-xs text-white/60">
          Add a lifestyle model or hand model to interact with your product.
        </div>
      </div>

      {/* avatars strip */}
      <div className="relative mt-2">
        {/* left arrow */}
        <button
          type="button"
          onClick={() => scrollStrip(-1)}
          className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 items-center justify-center rounded-full bg-black/80 border border-white/25 hover:bg-black"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* scroll strip */}
        <div
          ref={stripRef}
          className="flex gap-4 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-white/10"
        >
          {presets.length === 0 && (
            <div className="text-xs text-white/50 pl-1 py-6">
              No avatars configured yet.
            </div>
          )}

          {presets.map((av) => {
            const active = selectedAvatar?.id === av.id;
            return (
              <button
                key={av.id}
                onClick={() => setSelectedAvatar(av)}
                className="flex-shrink-0 w-[220px] sm:w-[260px]"
              >
                <div
                  className={cn(
                    "h-[260px] w-full rounded-3xl overflow-hidden border bg-white/[.02] flex items-center justify-center",
                    active
                      ? "border-[#7A3BFF] ring-2 ring-[#7A3BFF]/40"
                      : "border-white/15 hover:border-white/30"
                  )}
                >
                  {av.src ? (
                    <img
                      src={av.src}
                      alt={av.label}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-[12px] text-white/65 px-4 text-center">
                      No avatar
                    </span>
                  )}
                </div>
                <div
                  className={cn(
                    "mt-2 text-[11px] font-medium text-center",
                    active ? "text-[#c4a8ff]" : "text-white/75"
                  )}
                >
                  {av.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* right arrow */}
        <button
          type="button"
          onClick={() => scrollStrip(1)}
          className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 items-center justify-center rounded-full bg-black/80 border border-white/25 hover:bg-black"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* avatar prompt (optional) */}
      <div className="space-y-2 mt-1">
        <div className="flex flex-col gap-0.5">
          <div className="text-[9px] font-semibold tracking-[0.18em] text-[#7A3BFF] uppercase">
            Prompt
          </div>
          <div className="text-sm font-semibold text-white">
            What do you want the avatar to do?{" "}
            <span className="text-white/40 font-normal">
              (optional, only used if an avatar is selected)
            </span>
          </div>
        </div>
        <textarea
          rows={3}
          value={avatarPrompt}
          onChange={(e) => setAvatarPrompt(e.target.value)}
          placeholder={
            hasAvatar
              ? "E.g. Model gently holding the can, smiling at the camera, standing behind the marble table."
              : "Pick an avatar above, then describe their pose / action. Leave empty for simple posing."
          }
          className="w-full rounded-xl border border-white/15 bg-white/[.04] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF]"
        />
      </div>

      {/* create button */}
      <div className="flex items-center justify-end pt-4">
        <button
          onClick={onCreate}
          disabled={creating}
          className={cn(
            "h-10 px-6 rounded-xl text-sm font-semibold flex items-center gap-3",
            zyloGrad,
            creating && "opacity-80 cursor-wait"
          )}
        >
          {creating ? "Creating…" : "Create image"}
          {!creating && (
            <span className="inline-flex items-center justify-center rounded-full bg.white/18 px-3 py-0.5 text-[10px] font-semibold text-white/90">
              {credits} credits
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
