// src/pages/home/home.jsx

import React from "react";
import { useEffect } from "react";

import Navbar from "../../components/Figma/navbar/navbar.jsx";
import TopSign from "../../components/Figma/TopSign.jsx";
import Hero from "../../components/Figma/hero.jsx";
import Video from "../../components/Figma/Video.jsx"
import ProductPhoto from "../../components/Figma/ProductPhoto.jsx";
import Gallery from "../../components/Figma/Gallery.jsx";
import Proof from "../../components/Figma/proof.jsx"
import Faq from "../../components/Figma/FAQ.jsx"
import Footer from "../../components/Figma/Footer.jsx"
import Testimonial from "../../components/Figma/testimonial.jsx"
import Final from "../../components/Figma/Final.jsx"
import Mid from "../../components/Figma/mid.jsx"
import Steps from "../../components/Figma/3step.jsx"
import Pricing from "../../components/Figma/Pricing.jsx"






export default function Home() {
  useEffect(() => {
  document.title = "Create product visuals that sell";
}, []);
  return (

     
    <div className="w-full min-h-screen h-full bg-[#F7F5FA]">
      {/* Navbar */}
       
       <div className=""> 
        <TopSign />
        </div>
      
      <div className="mt-6 md:mt-8">
      <Navbar />
</div>

<div className="mt-24 md:mt-2 lg:mt-20 xl:mt-24 2xl:mt-28">
<Hero />
</div>


<div className="mt-10 lg:mt-20 2xl:mt-32">
  <Proof/>
</div>

<div className="mt-10 ">
 <Video/> 
</div>


<div className="mt-10">
  <Steps/>
</div>


<div className="mt-24">
<Gallery />
</div>

<div className="mt-12 md:mt-20 ">
  <ProductPhoto />
</div>

<div className="mt-20 md:mt-28 lg:mt-32 xl:mt-56">
 <Faq/> 
</div>

<div className="mt-10 xl:mt-32">
<Testimonial/>  
</div>

<div>
<Final/>  
</div>

<div className="">
<Mid/>  
</div>

<div>
  <Pricing/>
</div>



<div >
 <Footer/> 
</div>






    

    </div>
  );
}
