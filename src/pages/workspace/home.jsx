import Glow from "../../components/workspace/Glow.jsx";
import Features from "../../components/workspace/features.jsx";
import ViralShowcase from "../../components/workspace/ViralShowcase.jsx";
import JumpBackIn from "../../components/workspace/JumpBackIn.jsx";
import WhatsHot from "../../components/workspace/WhatsHot.jsx";
import LatestModels from "../../components/workspace/LatestModels.jsx";
import PopularStyles from "../../components/workspace/popularstyles.jsx";
import ZyvoSuiteCarousel from "../../components/workspace/ZyvoSuiteCarousel.jsx";
import PublicGallery from "../../components/public-gallery/gallery.jsx";
import PublishPromo from "../../components/workspace/PublishPromo.jsx";
import { useEffect } from "react";

export default function WorkspaceHome() {
  useEffect(() => {
    document.title = "Create Visuals Faster";
  }, []);

  return (
    <div className="flex-1 pb-24 lg:pb-12">

      {/* 1 — HERO */}
      <Glow />

      {/* 2 — CATEGORY TABS */}
      <Features />

      {/* 3 — ZYVO SUITE */}
      <ZyvoSuiteCarousel />

      {/* 4 — SHOWCASE CARDS */}
      <ViralShowcase />

      {/* 5 — PUBLISH PROMO */}
      <PublishPromo />

      {/* 6 — JUMP BACK IN */}
      <JumpBackIn />

     

      {/* 7 — LATEST AI MODELS */}
      <LatestModels />

      {/* 8 — POPULAR STYLES */}
      <PopularStyles />

      {/* 9 — WHAT'S HOT */}
      <WhatsHot />

      {/* 10 — INSPIRATION GALLERY */}
      <div className="mt-8">
        <PublicGallery />
      </div>

    </div>
  );
}
