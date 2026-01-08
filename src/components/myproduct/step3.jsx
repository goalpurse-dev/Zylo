import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";

export default function Step3({
  onBack,
  onClose,
  onCreate,
  file,
  setFile,
  editingProduct, // null when creating
  onDelete
}) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);

  // ✅ SAFE preview logic (no hook warnings, edit supported)
  useEffect(() => {
    let url;

    if (file) {
      url = URL.createObjectURL(file);
      setPreview(url);
    } else if (editingProduct?.image_url) {
      setPreview(editingProduct.image_url);
    } else {
      setPreview(null);
    }

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, editingProduct?.image_url]);

  function onPickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;

    setFile(f);        // max 1 image
    e.target.value = ""; // allow re-pick same file
  }

  const canSubmit = !!file || !!editingProduct?.image_url;
  const isEdit = !!editingProduct;

  return (
    <section>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-[#110829] font-semibold text-[16px]">
          Step 2
        </h2>

        <X
          className="h-5 w-5 text-[#4A4A55] cursor-pointer hover:text-[#110829]"
          onClick={onClose}
        />
      </div>

      {/* Title */}
      <h1 className="text-[#110829] text-[16px] mt-10">
        Upload picture of the front of your product
      </h1>

      {/* Upload box */}
      <div className="mt-4">
        <div
          onClick={() => inputRef.current?.click()}
          className="bg-[#F7F5FA] h-[180px] border-2 border-dashed border-[#ECE8F2]
                     rounded-lg flex items-center justify-center cursor-pointer
                     overflow-hidden"
        >
          {preview ? (
            <img
              src={preview}
              alt="Preview"
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="bg-white border border-dashed border-[#7A3BFF]/50 px-6 py-2 rounded-md">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-[#4A4A55]" />
                <p className="text-[#110829] text-sm">Upload</p>
              </div>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={onPickFile}
        />
      </div>

      {/* Tips */}
<div className="hidden sm:block">
  <h3 className="text-[#110829] text-[16px] mt-10">
    Tips for good picture
  </h3>

  <div className="mt-6 grid grid-cols-2 gap-3">
    {[
      "Use a clean product image",
      "Avoid cluttered backgrounds",
      "Center the product",
      "Keep shadows subtle",
    ].map((text, i) => (
      <div
        key={i}
        className="border border-[#110829] rounded-lg py-2 w-[200px]"
      >
        <p className="text-[#110829] text-center text-[14px]">
          {text}
        </p>
      </div>
    ))}
  </div>
</div>


      {/* Divider */}
      <div className="bg-[#ECE8F2] h-[2px] mt-10" />

      {/* Footer */}
      <div className="flex justify-between mt-10">
   {editingProduct ? (
    <button
      onClick={onDelete}
      className="py-1 px-10 border-[1px] border-red-500 text-red-500  rounded-l-md"
    >
      Delete
    </button>
  ) : (
    <button
      onClick={onBack}
      className="py-1 px-10 border border-[#4A4A55]/30 text-[#4A4A55] rounded-l-md"
    >
      Back
    </button>
  )}

        <button
          onClick={() => onCreate(file)}
          disabled={!canSubmit}
          className={`py-1 px-8 rounded-r-md border ${
            canSubmit
              ? "border-[#7A3BFF] text-[#110829]"
              : "border-gray-300 text-gray-400 cursor-not-allowed"
          }`}
        >
          {isEdit ? "Save" : "Add Product"}
        </button>
      </div>
    </section>
  );
}
