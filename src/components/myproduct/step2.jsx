import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

import Etsy from "../../assets/logos/etsy.png";
import Shopify from "../../assets/logos/shopify.png";
import QuestionMark from "../../assets/logos/questionmark.png";
import Tiktok from "../../assets/logos/tiktok.png";

export default function Step2({
  onNext,
  onClose,
  draft,
  setDraft,
}) {
  const title = draft.title || "";
  const description = draft.description || "";

  const [platform, setPlatform] = useState(null);
  const [otherPlatform, setOtherPlatform] = useState("");
  const [userChecked, setUserChecked] = useState(false);

  // ✅ SYNC LOCAL STATE WHEN EDITING / DRAFT CHANGES
  useEffect(() => {
    setPlatform(draft.platform || null);
    setOtherPlatform(draft.otherPlatform || "");
  }, [draft.platform, draft.otherPlatform]);

  const MIN_CHARS = 100;
  const charCount = description.length;
  const isOther = platform === "Other";

  const canProceed =
    title.trim().length > 0 &&
    charCount >= MIN_CHARS &&
    platform &&
    (!isOther || otherPlatform.trim().length > 0);

  // 🔐 Auth check
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) {
        alert("You must be logged in to create a product.");
        onClose?.();
      } else {
        setUserChecked(true);
      }
    });
  }, [onClose]);

  if (!userChecked) return null;

  const selectPlatform = (name) => {
    setPlatform(name);
    setDraft((d) => ({
      ...d,
      platform: name,
      otherPlatform: name === "Other" ? d.otherPlatform : "",
    }));

    if (name !== "Other") setOtherPlatform("");
  };

  const platformBtn = (name, img) => (
    <button
      type="button"
      onClick={() => selectPlatform(name)}
      className={`bg-white h-[30px] w-[140px] rounded-md border transition
        ${
          platform === name
            ? "border-[#7A3BFF] border-[2px]"
            : "border-[#110829]"
        }`}
    >
      <div className="flex justify-between h-full items-center px-3">
        <p className="text-[#110829]">{name}</p>
        <img src={img} className="h-5 w-5 object-contain" />
      </div>
    </button>
  );

  return (
    <section>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-[#110829] font-semibold text-[16px]">Step 1</h2>

        <div className="bg-[#ECE8F2] w-[200px] h-[40px] rounded-lg">
          <div className="flex justify-center items-center gap-2 h-full">
            <div className="bg-[#7A3BFF] rounded-full px-3 py-1">
              <p className="text-white text-[14px]">1</p>
            </div>
            <div className="bg-[#7A3BFF] h-[10px] w-[30px] rounded-lg"></div>
            <div className="bg-white h-[10px] w-[30px] rounded-lg"></div>
            <div className="bg-white rounded-full px-3 py-1">
              <p className="text-[#110829] text-[14px]">2</p>
            </div>
          </div>
        </div>

        <X
          className="h-5 w-5 text-[#4A4A55] cursor-pointer hover:text-[#110829]"
          onClick={onClose}
        />
      </div>

      {/* TITLE */}
      <div className="mt-5">
        <h3 className="text-[#110829]">Name of your product</h3>
        <div className="bg-white w-full h-[50px] border-[#110829] border rounded-lg p-1 flex items-center">
          <input
            value={title}
            onChange={(e) =>
              setDraft((d) => ({ ...d, title: e.target.value }))
            }
            className="mx-2 text-[12px] w-full outline-none caret-[#110829] text-[#4A4A55]"
            placeholder="e.g. GlowBoost Vitamin C Serum"
          />
        </div>
      </div>

      {/* DESCRIPTION */}
      <div className="mt-10">
        <p className="text-[#110829] text-[16px]">Describe Your Product</p>
        <p className="text-[#4A4A55] text-[12px]">
          Write at least {MIN_CHARS} characters
        </p>
      </div>

      <div className="py-2">
        <div className="bg-white w-full h-[100px] border-[#110829] border rounded-lg p-2">
          <textarea
            value={description}
            onChange={(e) =>
              setDraft((d) => ({ ...d, description: e.target.value }))
            }
            className="mx-2 text-[12px] w-full h-full resize-none outline-none caret-[#110829] text-[#4A4A55]"
            placeholder="Write at least 100 characters..."
          />
        </div>

        {charCount < MIN_CHARS && (
          <p className="text-red-500 text-[11px] mt-1">
            {MIN_CHARS - charCount} more characters required
          </p>
        )}
      </div>

      {/* PLATFORMS */}
      <div className="mt-10">
        <h2 className="text-[#110829] text-[16px]">
          Where do you post your product pictures?
        </h2>
      </div>

      <div className="grid grid-cols-2 py-3 gap-3 max-w-[300px]">
        {platformBtn("Shopify", Shopify)}
        {platformBtn("Tiktok", Tiktok)}
        {platformBtn("Etsy", Etsy)}
        {platformBtn("Other", QuestionMark)}
      </div>

      {isOther && (
        <input
          value={otherPlatform}
          onChange={(e) => {
            setOtherPlatform(e.target.value);
            setDraft((d) => ({ ...d, otherPlatform: e.target.value }));
          }}
          placeholder="Tell us where you post"
          className="bg-white w-full p-2 border-[#4A4A55] border rounded-md text-[12px]"
        />
      )}

      <div className="bg-[#ECE8F2] h-[2px] mt-10"></div>

      {/* NEXT */}
      <div className="flex justify-end mt-10">
        <button
          disabled={!canProceed}
          onClick={onNext}
          className={`py-1 px-10 rounded-md border
            ${
              canProceed
                ? "border-[#7A3BFF] text-[#110829]"
                : "border-gray-300 text-gray-400 cursor-not-allowed"
            }`}
        >
          Next
        </button>
      </div>
    </section>
  );
}
