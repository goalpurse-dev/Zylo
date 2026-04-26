import React, { useState, useEffect } from "react";

const PromptInput = React.memo(({ prompt, setPrompt }) => {
  const [localPrompt, setLocalPrompt] = useState(prompt);

  useEffect(() => {
    const t = setTimeout(() => {
      setPrompt(localPrompt);
    }, 120);
    return () => clearTimeout(t);
  }, [localPrompt]);

  // Sync when parent changes prompt externally (e.g. FTG prefill)
  useEffect(() => {
    setLocalPrompt(prompt);
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
    setLocalPrompt(e.target.value)

    const el = e.target
    el.style.height = "auto"

    const maxHeight = 220 // 👈 adjust if needed
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px"
  }}
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
