import Step1 from "../../components/myproduct/step1.jsx";
import Cta from "../../components/workspace/Cta.jsx";
import Tips from "../../components/myproduct/tips.jsx";
import Example from "../../components/myproduct/example.jsx";
import Proof from "./../../components/workspace/proof.jsx";
import Step2 from "../../components/myproduct/step2.jsx";
import Step3 from "../../components/myproduct/step3.jsx";
import Footer from "../../components/myproduct/footer.jsx";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { uploadForExternalFetch } from "../../lib/storage";

export default function MyProduct() {

  useEffect(() => {
  document.title = "Your Product Creation Base ";
}, []);


  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(2);
  const [showCta, setShowCta] = useState(true);
  const [editingProduct, setEditingProduct] = useState(null);
  const [toast, setToast] = useState(null);

  async function handleDeleteProduct() {
  if (!editingProduct?.id) return;

  const confirmed = window.confirm(
    "Are you sure you want to delete this product?"
  );
  if (!confirmed) return;

  try {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      setToast({ text: "You must be logged in" });
      setTimeout(() => setToast(null), 2500);
      return;
    }

    const { error } = await supabase
      .from("brand_products")
      .delete()
      .eq("id", editingProduct.id)
      .eq("user_id", user.id);

    if (error) throw error;

    setIsCreateOpen(false);
    setEditingProduct(null);
    setDraft({ title: "", description: "" });
    setFile(null);

    setToast({ text: "Product deleted" });
    setTimeout(() => setToast(null), 2500);
  } catch (err) {
    console.error(err);
    setToast({ text: "Failed to delete product" });
    setTimeout(() => setToast(null), 2500);
  }
}

  // Draft lives here so Back/Edit works
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    platform: null,
    otherPlatform: "",
  });

  // Image file (optional in edit)
  const [file, setFile] = useState(null);

  async function handleCreateOrSave(selectedFile) {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
     if (!user) {
  setToast({ text: "You must be logged in to continue" });
  setTimeout(() => setToast(null), 2500);
  return;
}

      let imageUrl = editingProduct?.image_url || null;

      // ✅ Upload ONLY if user picked a new file
      if (selectedFile || file) {
        const uploaded = await uploadForExternalFetch(
          selectedFile || file,
          { prefix: "product_images" },
          true
        );

        imageUrl = uploaded?.url;
        if (!imageUrl) throw new Error("Upload failed");
      }

      const title = (draft.title || "Untitled product").trim();
      const description = (draft.description || "").trim();

   const row = {
  title,
  description, // legacy column (keep)
  image_url: imageUrl,
  thumb: imageUrl,

  product: {
    name: title,
    description, // ✅ THIS is what edit + UI should rely on
    image_url: imageUrl,
    source: "myproduct",
  },

  meta: {
    description, // ✅ extra safety (future-proof)
  },

  platform: draft.platform || null,
};


      // ✅ EDIT = UPDATE
      if (editingProduct) {
        const { error } = await supabase
          .from("brand_products")
          .update(row)
          .eq("id", editingProduct.id)
          .eq("user_id", user.id);

        if (error) throw error;
      } 
      // ✅ CREATE = INSERT
      else {
        const { error } = await supabase
          .from("brand_products")
          .insert([
            {
              ...row,
              user_id: user.id,
              brand_id: null,
            },
          ]);

        if (error) throw error;
      }

      // ✅ RESET STATE
      setIsCreateOpen(false);
      setCreateStep(2);
      setEditingProduct(null);
      setFile(null);
      setDraft({
        title: "",
        description: "",
        platform: null,
        otherPlatform: "",
      });

     setToast({
  text: editingProduct ? "Product updated successfully" : "Product created successfully",
  
});
setTimeout(() => setToast(null), 2500);


    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to save product");
    }
  }

  return (
    <section>
      {showCta && <Cta onClose={() => setShowCta(false)} />}

      <Step1
        onCreate={() => {
          setEditingProduct(null);
          setDraft({
            title: "",
            description: "",
            platform: null,
            otherPlatform: "",
          });
          setFile(null);
          setCreateStep(2);
          setIsCreateOpen(true);
        }}
        onEdit={(product) => {
          setEditingProduct(product);
          setDraft({
            title: product.title || "",
            description: product.description || "",
            platform: product.platform || null,
            otherPlatform: "",
          });
          setFile(null);
          setCreateStep(2);
          setIsCreateOpen(true);
        }}
      />

      <Proof />
      <Tips />
      <div className="mt-10">
        <Example />
      </div>

      {isCreateOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={() => setIsCreateOpen(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-[#FAF8FF] w-full max-w-lg rounded-2xl shadow-xl p-8">
              {createStep === 2 && (
                <Step2
                  onNext={() => setCreateStep(3)}
                  onClose={() => setIsCreateOpen(false)}
                  draft={draft}
                  setDraft={setDraft}
                />
              )}

              {createStep === 3 && (
                <Step3
                  onBack={() => setCreateStep(2)}
                  onClose={() => setIsCreateOpen(false)}
                  onCreate={handleCreateOrSave}
                  onDelete={handleDeleteProduct} 
                  file={file}
                  setFile={setFile}
                  editingProduct={editingProduct}
                />
              )}
            </div>
          </div>
        </>
      )}

      {toast && (
  <div className="fixed top-6 right-6 z-[9999]">
    <div className="bg-[#110829] text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-fade-in">
      <span>🚀</span>
      <span className="text-sm font-semibold">{toast.text}</span>
    </div>
  </div>
)}

     
     <div className="mt-20">
      <Footer />
      </div>
    </section>
  );
}
