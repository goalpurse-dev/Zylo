import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { supabase } from "../../lib/supabaseClient";
import { createProductPhotoJob } from "../../lib/jobs";
import { useGenerations } from "../../components/GenerationsDock";

import Big from "../../components/productphoto/Big.jsx";
import Creations from "../../components/productphoto/Creations.jsx";
import Faq from "../../components/productphoto/faq.jsx";
import Bg from "../../components/productphoto/Bg.jsx";
import Footer from "../../components/myproduct/footer.jsx";

import Step1 from "../../components/productphoto/steps/step1.jsx";
import Step2 from "../../components/productphoto/steps/step2.jsx";
import Step3 from "../../components/productphoto/steps/step3.jsx";

export default function ProductPhoto() {

  useEffect(() => {
  document.title = "AI Product Photos Studio";
}, []);

  const [openStep, setOpenStep] = useState(null); // 2 | 3 | null
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedBackground, setSelectedBackground] = useState(null);
  const [creating, setCreating] = useState(false);

  const { addJob } = useGenerations();

  /* lock scroll when overlay open */
  useEffect(() => {
    document.body.style.overflow = openStep ? "hidden" : "auto";
    return () => (document.body.style.overflow = "auto");
  }, [openStep]);

  // 🔥 GENERATE BACKEND (minimal, clean)
  async function handleGenerate() {
    if (!selectedProduct || !selectedBackground) return;

    try {
      setCreating(true);

      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) throw new Error("Not authenticated");

      const productUrl =
        selectedProduct.image_url ||
        selectedProduct.src ||
        selectedProduct._url;

      const backgroundUrl =
        selectedBackground.src ||
        selectedBackground.url ||
        selectedBackground.image_url;

      if (!productUrl || !backgroundUrl) {
        throw new Error("Missing product or background");
      }

      const job = await createProductPhotoJob({
        userId: user.id,
        productId: selectedProduct.id,
        kind: "product_photo",
        prompt:
          "High-quality commercial product photo using the selected environment.",
        negative_prompt:
          "no watermark, no text, no logo, no distortion, no blur",
        width: 1024,
        height: 1024,
        productUrl,
        backgroundUrl,
        refs: [
          { url: productUrl },
          { url: backgroundUrl },
        ],
      });

      addJob(job.id, {
        tool: "product-photos",
        kind: "product_photo",
        product_id: selectedProduct.id,
      });

    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to generate");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="w-full relative">
      {/* MAIN PAGE (Step 1 is ALWAYS visible) */}
      <div className={`${openStep ? "blur-sm pointer-events-none" : ""}`}>
        <div className="py-4 mt-10 w-full">
          <Big />
        </div>

        {/* STEP 1 */}
        <div className="mt-10 w-full">
          <Step1
            onNext={(product) => {
              setSelectedProduct(product);
              setOpenStep(2);
            }}
          />
        </div>

        <div className="mt-20 w-full">
          <Creations />
        </div>

        <div className="mt-20 w-full">
          <Faq />
        </div>

        <div className="mt-2 w-full">
          <Bg />
        </div>

        <div className="mt-2 w-full">
          <Footer />
        </div>
      </div>

      {/* OVERLAY FOR STEP 2 & 3 */}
      {openStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="relative w-full max-w-[900px] bg-white rounded-xl p-6">

            {/* Close */}
            <button
              onClick={() => setOpenStep(null)}
              className="absolute right-4 top-4 text-[#4A4A55] hover:opacity-70"
            >
              <X size={18} />
            </button>

            {/* Steps */}
            {openStep === 2 && (
              <Step2
                onNext={(bg) => {
                  setSelectedBackground(bg);
                  setOpenStep(3);
                }}
                onBack={() => setOpenStep(null)}
              />
            )}

            {openStep === 3 && (
              <Step3
                selectedProduct={selectedProduct}
                selectedBackground={selectedBackground}
                onBack={() => setOpenStep(2)}
                onChangeProduct={() => setOpenStep(null)}
                onChangeBackground={() => setOpenStep(2)}
                onGenerate={handleGenerate}
                creating={creating}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
