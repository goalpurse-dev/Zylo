import Step1 from "../../components/creations/library.jsx";
import Faq from "../../components/creations/faq.jsx";
import Footer from "../../components/myproduct/footer.jsx";
import Cta from "../../components/creations/cta.jsx";

import { useState, useEffect } from "react";




export default function creations() {
    useEffect(() => {
  document.title = "Your Generated Product Creations";
}, []);

       const [showCta, setShowCta] = useState(true);

    return (
        <section>

            {showCta && (
             <Cta onClose={() => setShowCta(false)} />
           )}
     


        <div>
        <Step1/>    
        </div>

       <div className="mt-32">
        <Faq/>    
        </div>

        <div className="mt-16">
        <Footer/>    
        </div>

        </section>
        
    
    );
}