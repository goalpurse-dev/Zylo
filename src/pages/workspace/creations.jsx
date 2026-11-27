import { lazy as studioLazy, Suspense as StudioSuspense } from "react";
import { useStudioV2 } from "../../lib/studioV2.js";
import Step1 from "../../components/creations/library.jsx";
import Footer from "../../components/myproduct/footer.jsx";
import { useEffect } from "react";
function Creations() {
  useEffect(() => {
    document.title = "Your Creations | Zyvo";
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

// Studio v2, OWNER-ONLY (owner 2026-11-27): the owner's account (asked on the server, src/lib/studioV2.js) gets the
// new version; everyone else, signed out or in, gets the function above exactly as before.
const LibraryStudio = studioLazy(() => import("./creationsStudio.jsx"));
export default function CreationsSwitch(props) {
  const { on } = useStudioV2();
  if (on) return <StudioSuspense fallback={null}><LibraryStudio {...props} /></StudioSuspense>;
  return <Creations {...props} />;
}
