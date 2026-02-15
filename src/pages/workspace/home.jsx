import Glow from "../../components/workspace/Glow.jsx";
import New1 from "../../components/workspace/New1.jsx";
import Inspiration from "../../components/ImageGenerator/Inspiration.jsx";
import Generate from "../../components/ImageGenerator/Generate.jsx";

import { useState, useEffect, useRef } from "react";

export default function WorkspaceHome() {
  useEffect(() => {
    document.title = "Create Visuals Faster";
  }, []);

  const [prompt, setPrompt] = useState("");
  const inspirationRef = useRef(null);

  const sendPromptToGenerator = (p) => {
    setPrompt(p);
    inspirationRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  return (
    <div className="flex-1">

      <div className="mt-4">
        <Glow />
      </div>

      <div className="mt-4">
        <New1 />
      </div>


      {/* INSPIRATION */}
      <div className="mt-10" ref={inspirationRef}>
        <Inspiration
          prompt={prompt}
          setPrompt={setPrompt}
          onSelectPrompt={sendPromptToGenerator}
        />
      </div>

    </div>
  );
}
