import { useState } from "react";
import { Download, Lock } from "lucide-react";

import Credit from "../../../assets/toolshell/credit.png";

import { supabase } from "../../../lib/supabaseClient";
import { createProductPhotoJob } from "../../../lib/jobs";
import { useGenerations } from "../../../components/GenerationsDock";

export default function Step3({
  selectedProduct,
  selectedBackground,
  onBack,
  onChangeProduct,
  onChangeBackground,
}) {
  const { addJob } = useGenerations();
  const [creating, setCreating] = useState(false);

  // ✅ product can come from multiple shapes
  const productUrl =
    selectedProduct?.src ||
    selectedProduct?.image_url ||
    selectedProduct?._url ||
    null;

  const backgroundUrl =
    selectedBackground?.src ||
    selectedBackground?.url ||
    selectedBackground?.image_url ||
    selectedBackground?._url ||
    (typeof selectedBackground === "string" ? selectedBackground : null);

  async function resolveBrandId(userId) {
    const fromProduct = selectedProduct?.brand_id;
    if (fromProduct) return fromProduct;

    const { data, error } = await supabase
      .from("brands")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data?.id) throw new Error("No brand found for this user.");

    return data.id;
  }

  async function handleGenerate() {
    if (!productUrl || !backgroundUrl || creating) return;

    try {
      setCreating(true);

      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const userId = auth?.user?.id;
      if (!userId) throw new Error("You must be logged in.");

      const brandId = await resolveBrandId(userId);

      const refs = [{ url: productUrl }, { url: backgroundUrl }];

      const job = await createProductPhotoJob({
        brandId,
        userId,
        productId: selectedProduct?.id || null,
        kind: "catalog",
        prompt:
          "High-quality commercial product photo using the selected environment.",
        negative_prompt:
          "no extra logos, no misspelled text, no watermark, no border, no distorted or duplicate products",
        width: 1024,
        height: 1024,
        refs,
      });

      addJob(job.id, {
        tool: "product-photos",
        kind: "product_photo",
        product_id: selectedProduct?.id || null,
      });
    } catch (e) {
      console.error(e);
      alert(e?.message || "Could not create image job.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex justify-center py-6 px-4 md:px-8 xl:px-16 ">
      <div className="bg-[#12141A] mt-4 h-[750px] xl:h-[800px] 2xl:h-[850px] w-full text-[#F4F6FB] rounded-lg">
        {/* Step indicator */}
        <div className="flex justify-center py-6">
          <div className="bg-[#1A1D2B] border border-[#2A2F45] w-[240px] h-[35px] rounded-lg flex items-center gap-3 px-3">
            <StepCircle active>1</StepCircle>
            <StepLine />
            <StepLine />
            <StepCircle active>2</StepCircle>
            <StepLine />
            <StepLine />
            <StepCircle active>3</StepCircle>
          </div>
        </div>

        {/* Header */}
        <div className="flex justify-center mt-3">
          <h1 className="text-[#F4F6FB] font-semibold text-[18px] md:text-[20px] lg:text-[22px] xl:text-[24px]">
            Review
          </h1>
        </div>

        {/* Review card */}
        <div className="flex justify-center mt-6">
          <div className="bg-[#141622] border border-[#2A2F45] w-[240px] min-h-[400px] xl:min-h-[550px] md:w-[280px] lg:w-[320px] xl:w-[500px] 2xl:w-[550px] rounded-lg">
            {/* Product */}
            <div className="flex justify-between items-center gap-4 px-6 py-4">
              <h1 className="text-[#F4F6FB] font-semibold">Product:</h1>
              <button
                onClick={onChangeProduct}
                className="px-3 py-1 text-[10px] bg-[#1A1D2B] border border-[#2A2F45] rounded-sm shadow-lg"
              >
                Change
              </button>
            </div>

            <div className="flex justify-center px-6">
              <div className="bg-[#1A1D2B] w-full h-[120px] rounded-lg flex items-center justify-center overflow-hidden">
                {productUrl ? (
                  <img
                    src={productUrl}
                    alt="Selected product"
                    className="h-full object-contain"
                  />
                ) : (
                  <p className="text-[#B7BBC6] text-sm">No product selected</p>
                )}
              </div>
            </div>

            {/* Background */}
            <div className="flex justify-between gap-4 px-6 mt-10">
              <p className="text-[#F4F6FB] font-semibold">Background:</p>
              <button
                onClick={onChangeBackground}
                className="px-3 py-1 text-[10px] bg-[#1A1D2B] border border-[#2A2F45] rounded-sm shadow-lg"
              >
                Change
              </button>
            </div>

            <div className="flex justify-center px-6 py-4">
              <div className="bg-[#1A1D2B] w-full h-[200px] xl:h-[240px] 2xl:h-[280px] rounded-lg overflow-hidden">
                <div className="flex justify-center items-center h-full">
                  {backgroundUrl ? (
                    <img
                      src={backgroundUrl}
                      alt="Selected background"
                      className="w-[140px] 2xl:w-[200px] h-[200px] 2xl:h-[250px] object-cover max-h-full rounded-md shadow-lg"
                    />
                  ) : (
                    <p className="text-[#B7BBC6] text-sm">
                      No background selected
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between md:px-5 lg:px-20 py-10 mt-20 xl:mt-10">
          <button
            onClick={onBack}
            className="py-1 px-8 bg-[#1A1D2B] border-[#2A2F45] border-2 rounded-lg shadow-lg"
          >
            Back
          </button>

          <div>
            <button
              onClick={handleGenerate}
              disabled={!productUrl || !backgroundUrl || creating}
              className={`py-1 px-6  rounded-lg shadow-lg font-semibold flex items-center gap-2
                ${
                  productUrl && backgroundUrl && !creating
                    ? "bg-[#7A3BFF] text-white"
                    : "border-gray-300 text-gray-400 cursor-not-allowed"
                }`}
            >
              {productUrl && backgroundUrl && !creating ? (
                <Download className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
              )}

              {creating ? "Generating..." : "Generate"}

              <p className="text-[#F4F6FB] pl-3">12</p>
              <div className="bg-white p-1  rounded-lg">
              <img src={Credit} className="h-5 w-5" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* helpers */
function StepCircle({ children, active }) {
  return (
    <div
      className={`rounded-full h-6 w-6 flex items-center justify-center
        ${active ? "bg-purple-400" : "bg-[#B7BBC6]"}`}
    >
      <p className="text-[#110829] text-sm">{children}</p>
    </div>
  );
}

function StepLine() {
  return <div className="bg-[#B7BBC6] h-[8px] w-[20px] rounded-lg" />;
}