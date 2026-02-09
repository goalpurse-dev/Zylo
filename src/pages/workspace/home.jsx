
import Glow from "../../components/workspace/Glow.jsx";
import New1 from "../../components/workspace/New1.jsx";


import { useState, useEffect } from "react";



export default function WorkspaceHome() {

  useEffect(() => {
  document.title = "Create Visuals Faster";
}, []);

   const [showCta, setShowCta] = useState(true);


  return (
    <div className="flex-1">

      <div className="mt-4">
      <Glow />
      </div>

         <div className="mt-4">
      <New1 />
      </div>



      

    </div>
  );
}
