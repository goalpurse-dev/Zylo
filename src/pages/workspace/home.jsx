import Cta from "../../components/workspace/Cta.jsx";
import Soon from "../../components/workspace/Soon.jsx";
import Middle from "../../components/workspace/middle.jsx";
import Tools from "../../components/workspace/tools.jsx";
import Faq from "../../components/workspace/faq/faq.jsx";
import Latest from "../../components/workspace/latest.jsx";
import Proof from "../../components/workspace/proof.jsx";
import Footer from "../../components/myproduct/footer.jsx";

import { useState, useEffect } from "react";



export default function WorkspaceHome() {

  useEffect(() => {
  document.title = "Create Visuals Faster";
}, []);

   const [showCta, setShowCta] = useState(true);


  return (
    <div className="flex-1">

      

    {showCta && (
  <Cta onClose={() => setShowCta(false)} />
)}

      <Soon />

      <div className="hidden md:block">
        <Middle />
      </div>

      <Tools />

      <div className="mt-2">
        <Proof />
      </div>

      <div className="mt-10">
        <Latest />
      </div>

      <div className="mt-20 md:mt-40 xl:mt-60">
        <Faq />
      </div>

      <Footer />

    </div>
  );
}
