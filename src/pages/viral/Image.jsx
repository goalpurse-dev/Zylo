// src/pages/home/home.jsx

import React from "react";
import { useEffect } from "react";

import Generate from "../../components/ImageGenerator/Generate.jsx"
import Inspiration from "../../components/ImageGenerator/Inspiration.jsx"







export default function Home() {
  useEffect(() => {
  document.title = "Create unique images with AI";
}, []);
  return (

     
   <div className="w-full min-h-screen bg-[#F7F5FA]">
     
    <Generate/>


    <div className="mt-10">
    <Inspiration/>
    </div>

    

    </div>
  );
}
