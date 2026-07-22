import Step1 from "../../components/creations/library.jsx";
import Footer from "../../components/myproduct/footer.jsx";
import { useEffect } from "react";
export default function Creations() {
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
