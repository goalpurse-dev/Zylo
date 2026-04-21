// src/pages/home/home.jsx

import React from "react";
import { useEffect } from "react";

import Navbar from "../../components/Figma/navbar/navbar.jsx";
import Hero from "../../components/Figma/hero.jsx";
import Proof from "../../components/Figma/proof.jsx"
import Faq from "../../components/Figma/FAQ.jsx"
import Footer from "../../components/myproduct/footer.jsx"
import ZyvoShowcase from "../../components/Figma/ZyvoShowcase.jsx"
import ReviewSection from "../../components/Figma/ReviewsSection.jsx"
import WhyZyvo from "../../components/Figma/WhyZyvo.jsx"
import ViralImageGenerator from "../../components/Figma/ViralImageGenerator.jsx"
import ZyvoStats from "../../components/Figma/ZyvoStats.jsx"
import ViralVideoGenerator from "../../components/Figma/ViralVideoGenerator.jsx"
import AboutZyvo from "../../components/Figma/AboutZyvo.jsx"
import ViralNumbers from "../../components/Figma/ViralNumbers.jsx"
import TrendingModels from "../../components/Figma/TrendingModels.jsx"
import ScriptBuilderPromo from "../../components/workspace/ScriptBuilderPromo.jsx"





export default function Home() {
  useEffect(() => {
  document.title = "Create product visuals that sell";
}, []);
  return (

     
   <div className="w-full min-h-screen bg-[#F7F5FA]">
      <Navbar />
      <Hero />
      <Proof />
      <ZyvoShowcase />
      <ViralNumbers />
      <TrendingModels />
      <ReviewSection />
      <ScriptBuilderPromo />
      <ViralImageGenerator />
      <WhyZyvo />
      <ViralVideoGenerator />
      <ZyvoStats />
      <div className="mt-16 md:mt-24">
        <Faq />
      </div>
      <Footer />



    </div>
  );
}
