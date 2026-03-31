import Glow from "../../components/workspace/Glow.jsx";
import New1 from "../../components/workspace/New1.jsx";
import PublicGallery from "../../components/public-gallery/gallery.jsx";
import Generate from "../../components/ImageGenerator/Generate.jsx";
import ViralTemplatesSection from "../../components/workspace/ViralTemplatesSection.jsx";
import Features from "../../components/workspace/features.jsx";
import PopularStyles from "../../components/workspace/popularstyles.jsx";
import ViralShowcase from "../../components/workspace/ViralShowcase.jsx";
import LatestModels from "../../components/workspace/LatestModels.jsx";



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
    <div className="flex-1 ">

   

      <div className="mt-4">
        <Glow />
      </div>

        <div className="">
        <Features />
      </div>

       <div className="">
        <ViralShowcase />
      </div>

 <div className="">
        <PopularStyles />
      </div>

       <div className="">
        <LatestModels />
      </div>
    


      {/* INSPIRATION */}
      <div className="mt-10">
  <PublicGallery />
</div>

    </div>
  );
}
