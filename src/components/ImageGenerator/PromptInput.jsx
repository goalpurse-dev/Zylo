import React, { useState, useEffect } from "react";

const PromptInput = React.memo(({ prompt, setPrompt }) => {
  const [localPrompt, setLocalPrompt] = useState(prompt);

  useEffect(() => {
    const t = setTimeout(() => {
      setPrompt(localPrompt);
    }, 120);
    return () => clearTimeout(t);
  }, [localPrompt]);

  return (
    <div className="w-full">

      {/* OUTER CONTAINER */}
      <div
        className="
          rounded-2xl
          bg-[#16181A]
          border border-white/5

          px-4 py-4
        "
      >

        {/* LABEL */}
        <span className="text-[12px] text-white/40 block mb-3">
          Describe image
        </span>

        {/* INPUT */}
        <div
          className="
            rounded-xl
            bg-[#101112]
            border border-white/5

            px-4 py-3

            transition
            focus-within:border-white/10
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
    placeholder:text-white/30
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