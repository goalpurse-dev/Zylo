import Step1 from "../../components/creations/library.jsx";
import Faq from "../../components/creations/faq.jsx";
import Footer from "../../components/myproduct/footer.jsx";


import { useState, useEffect } from "react";




export default function Creations() {
  useEffect(() => {
    document.title = "Your Generated Product Creations";
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      
      {/* CONTENT */}
      <div className="flex-grow">
        <Step1 />
      </div>

      {/* FOOTER */}
      <Footer />

    </div>
  );
}