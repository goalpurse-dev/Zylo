import React, { useState, useEffect } from "react";

const PromptInput = React.memo(({ prompt, setPrompt }) => {
  const [localPrompt, setLocalPrompt] = useState(prompt);

  useEffect(() => {
    const t = setTimeout(() => {
      setPrompt(localPrompt);
    }, 150);

    return () => clearTimeout(t);
  }, [localPrompt]);

  return (
    <div className="relative">
      <div
        className="
        rounded-xl
        border border-white/10
        bg-[#0F111A]
        px-4 py-4
        focus-within:border-[#7A3BFF]
      "
      >
        <textarea
          value={localPrompt}
          onChange={(e) => setLocalPrompt(e.target.value)}
          placeholder="Describe the content you want to go viral..."
          rows={4}
          style={{ fontSize: "16px" }}
          className="w-full bg-transparent outline-none text-white placeholder:text-white/40 resize-none"
        />
      </div>
    </div>
  );
});

export default PromptInput;