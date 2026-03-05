// src/pages/home/home.jsx

import React from "react";
import { useEffect } from "react";

import Navbar from "../../components/Figma/navbar/navbar.jsx";
import Hero from "../../components/Figma/hero.jsx";
import Proof from "../../components/Figma/proof.jsx"
import Faq from "../../components/Figma/FAQ.jsx"
import Footer from "../../components/Figma/Footer.jsx"
import ZyvoShowcase from "../../components/Figma/ZyvoShowcase.jsx"
import ReviewSection from "../../components/Figma/ReviewsSection.jsx"
import WhyZyvo from "../../components/Figma/WhyZyvo.jsx"
import ViralImageGenerator from "../../components/Figma/ViralImageGenerator.jsx"
import ZyvoStats from "../../components/Figma/ZyvoStats.jsx"
import ViralVideoGenerator from "../../components/Figma/ViralVideoGenerator.jsx"
import AboutZyvo from "../../components/Figma/AboutZyvo.jsx"





export default function Home() {
  useEffect(() => {
  document.title = "Create product visuals that sell";
}, []);
  return (

     
   <div className="w-full min-h-screen bg-[#F7F5FA]">
      {/* Navbar */}
       
      
      
 
      <Navbar />


<div className="">
<Hero />
</div>


<div className="">
  <Proof/>
</div>


<div className="">
  <ZyvoShowcase/>
</div>

<div className="">
  <ReviewSection/>
</div>

<div className="">
  <ViralImageGenerator/>
</div>

<div className="">
  <WhyZyvo/>
</div>

<div className="">
  <ViralVideoGenerator/>
</div>

<div className="">
  <ZyvoStats/>
</div>



<div className=" mt-40">
 <Faq/> 
</div>

<div className="">
  <AboutZyvo/>
</div>


<div >
 <Footer/> 
</div>



    </div>
  );
}
