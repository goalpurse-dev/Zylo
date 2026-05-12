import React, { useState, useEffect, useRef, useCallback } from "react";

const PromptInput = React.memo(({ prompt, setPrompt }) => {
  const [localPrompt, setLocalPrompt] = useState(prompt || "");

  // Tracks whether this component itself triggered the last parent update.
  // Prevents the sync-back loop:
  //   user types → debounce → setPrompt(value) → parent re-renders →
  //   new `prompt` prop → useEffect([prompt]) → setLocalPrompt(same value) → re-render
  const selfUpdating = useRef(false);

  // Stable commit callback so the debounce effect dep array stays stable
  const commit = useCallback(
    (value) => {
      selfUpdating.current = true;
      setPrompt(value);
    },
    [setPrompt],
  );

  // Debounce: local → parent (120 ms)
  useEffect(() => {
    const t = setTimeout(() => commit(localPrompt), 120);
    return () => clearTimeout(t);
  }, [localPrompt, commit]);

  // External sync: parent → local (e.g. FTG prefill or reset)
  // Skipped when this component itself triggered the parent update.
  useEffect(() => {
    if (selfUpdating.current) {
      selfUpdating.current = false;
      return;
    }
    setLocalPrompt(prompt || "");
  }, [prompt]);

  return (
    <div className="w-full">

      {/* OUTER CONTAINER */}
      <div
        data-ftg="prompt"
        className="
          rounded-2xl
          bg-[#151719]
          border border-white/[0.09]
          px-4 py-4
        "
      >

        {/* LABEL */}
        <span className="text-[13px] font-semibold text-white block mb-3">
          Describe your image
        </span>

        {/* INPUT */}
        <div
          className="
            rounded-xl
            bg-[#101213]
            border border-white/[0.08]
            px-4 py-3
            transition
            focus-within:border-[#7A3BFF]/50
            focus-within:bg-[#111317]
          "
        >
          <textarea
            value={localPrompt}
            onChange={(e) => {
              setLocalPrompt(e.target.value);

              // Auto-resize
              const el = e.target;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 220) + "px";
            }}
            onBlur={() => commit(localPrompt)}
            rows={4}
            className="
              w-full
              bg-transparent
              outline-none
              resize-none
              text-white
              placeholder:text-white/35
              text-[16px]
              overflow-y-auto
              max-h-[220px]
            "
            placeholder="Describe your viral image..."
          />
        </div>

      </div>
    </div>
  );
});

export default PromptInput;
