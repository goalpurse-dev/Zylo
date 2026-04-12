import {
  BoxSelect,
  ChevronRight,
  Folder,
  Image,
  ImagePlus,
  VideoIcon,
  Wand2,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import Toast from "../../components/ImageGenerator/Toast";
import { VIDEO_TEMPLATES } from "../../components/video-templates/templates";
import { useState, useRef, useEffect } from "react";
import { RESOLUTIONS } from "../../lib/video-generator/resolutions";
import { MODELS } from "../../lib/video-generator/modelsConfig";
import { DURATIONS } from "../../lib/video-generator/durations";
import { useReferenceImages } from "../../components/reference-images/useReferenceImages";
import ReferenceImageModal from "../../components/reference-images/ReferenceImageModal";
import { supabase } from "../../lib/supabaseClient";
import {watchJob } from "../../lib/jobs";
import { KEY_LINKS } from "../../lib/providers";
import { generateVideoFromUI } from "../../lib/video-generator/generator";
import { calculateVideoCredits } from "../../lib/video-generator/videoPricing";
import VideoTemplate from "../../components/video-templates/VideoTemplate";
import { createPortal } from "react-dom";
import { useMemo } from "react";
import UpgradeToast from "../../components/VideoGenerator/UpgradeToast";
import GuestVideoModal from "../../components/VideoGenerator/GuestVideoModal";
VideoIcon
Folder

export default function Generate({  }) {


  const [toast, setToast] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const controlsRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);
const [showUpgrade, setShowUpgrade] = useState(false);
  const [guestModalOpen, setGuestModalOpen] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [openModel, setOpenModel] = useState(false);
  const [openSize, setOpenSize] = useState(false);
  const [openDuration, setOpenDuration] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [openTemplates, setOpenTemplates] = useState(false);

  const handleTemplateSelect = (template) => {
  setSelectedTemplateId(template.id);

  setPrompt(template.basePrompt.trim());

  if (template.defaultProvider) {
    setSelectedModelKey(template.defaultProvider);
  }

  if (template.defaultDuration) {
    setSelectedDuration(template.defaultDuration);
  }

  if (template.defaultResolution) {
    setSelectedResolution(template.defaultResolution);
  }

  if (template.defaultSize) {
    setSelectedSize(template.defaultSize);
  }
};
  


const firstVideoModelKey =
  Object.keys(MODELS).find((key) => key.startsWith("video:")) ||
  Object.keys(MODELS)[0];


const [selectedModelKey, setSelectedModelKey] = useState(firstVideoModelKey);
const selectedModel = MODELS[selectedModelKey];



  const [selectedSize, setSelectedSize] = useState("16:9");
  const [selectedDuration, setSelectedDuration] = useState("5s");
 const [selectedResolution, setSelectedResolution] = useState("720p");

const totalCredits = useMemo(() =>
  calculateVideoCredits(
    selectedModelKey,
    selectedDuration,
    selectedResolution
  ),
  [selectedModelKey, selectedDuration, selectedResolution]
);

const maxRefImages = selectedModel.maxReferenceImages;
const canAddImages = maxRefImages > 0;

const [openReferenceModal, setOpenReferenceModal] = useState(false);

const modelButtonRef = useRef(null);
const modelModalRef = useRef(null);



const {
  images,
  selected,
  addImage,
  toggleSelect,
  setSelected,
} = useReferenceImages(maxRefImages);

// Auto-populate reference image when navigated from image generator
useEffect(() => {
  const refImage = location.state?.refImage;
  if (!refImage?.url) return;

  // Switch to a model that supports reference images
  const refModel = Object.entries(MODELS).find(
    ([, m]) => m.maxReferenceImages > 0
  );
  if (refModel) setSelectedModelKey(refModel[0]);

  addImage({ id: String(refImage.id), url: refImage.url });
  setSelected([{ id: String(refImage.id), url: refImage.url }]);
}, []);
const handleUpload = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return;

    const ext = file.name.split(".").pop() || "png";
    const path = `${uid}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("reference-images")
      .upload(path, file, { upsert: false });

    if (upErr) throw upErr;

    const { data: pub } = supabase.storage
      .from("reference-images")
      .getPublicUrl(path);

    const publicUrl = pub?.publicUrl;
    if (!publicUrl) throw new Error("No public URL returned");

    const { data: row, error: dbErr } = await supabase
      .from("reference_images")
      .insert({ user_id: uid, file_url: publicUrl })
      .select("id, file_url")
      .single();

    if (dbErr) throw dbErr;

    addImage({
      id: row.id,
      url: row.file_url,
    });
  } catch (err) {
    console.error("Reference upload failed:", err);
  } finally {
    e.target.value = "";
  }
};


  const isAnyModalOpen = openModel || openSize || openDuration;
   const isKling = selectedModelKey === "video:klingaist";
const hasRefs = selected.length > 0;

const imageRequiredForModel =
  selectedModelKey === "video:miniMaxFast" ||
  selectedModelKey === "video:RunwayGen-4Turbo";

const missingRequiredImage = imageRequiredForModel && !hasRefs;


const disableSizeSelector = isKling && hasRefs;



useEffect(() => {
  if (isAnyModalOpen || openReferenceModal) {
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
  } else {
    document.body.style.overflow = "";
    document.body.style.touchAction = "";
  }

  return () => {
    document.body.style.overflow = "";
    document.body.style.touchAction = "";
  };
}, [isAnyModalOpen, openReferenceModal]);


  // Close modals on outside click
useEffect(() => {
  const handleClickOutside = (e) => {
    const target = e.target;

    if (
      controlsRef.current?.contains(target) ||
      modelButtonRef.current?.contains(target) ||
      modelModalRef.current?.contains(target)
    ) {
      return;
    }

    setOpenModel(false);
    setOpenSize(false);
    setOpenDuration(false);
  };

  if (isAnyModalOpen) {
    document.addEventListener("mousedown", handleClickOutside);
  }

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, [isAnyModalOpen]);




 async function handleGenerate() {
  if (!prompt.trim()) return;

  try {
    setIsGenerating(true);

    // 🔥 CHECK AUTH
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) {
      setIsGenerating(false);
      setGuestModalOpen(true);
      return;
    }

    // 🔥 GET PROFILE FROM SUPABASE
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("plan_code, credit_balance")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      setToast({
        message: "User data not loaded. Try refreshing.",
        type: "error",
      });
      setIsGenerating(false);
      return;
    }

    const plan = (profile?.plan_code || "free").toLowerCase();
    const balance = Number(profile?.credit_balance ?? 0);

    // 🔥 FREE PLAN BLOCK
    if (plan === "free") {
      setShowUpgrade(true);
      setIsGenerating(false);
      return;
    }

    // 🔥 CREDIT CHECK
    if (balance < totalCredits) {
      setToast({
        message: `You need ${totalCredits} credits to generate this video`,
        type: "error",
      });
      setIsGenerating(false);
      return;
    }

    // 🔥 CREATE JOB
    const job = await generateVideoFromUI({
      modelKey: selectedModelKey,
      prompt: prompt.trim(),
      size: selectedSize,
      duration: selectedDuration,
      resolution: selectedResolution,
      refImages: selected.map((img) => img.url),
    });

    watchJob(job.id, () => {});

    // unlock after short delay
    setTimeout(() => {
      setIsGenerating(false);
    }, 2000);

    setPrompt("");

  } catch (err) {
    console.error(err);
    setIsGenerating(false);

    setToast({
      message: "Failed to create video.",
      type: "error",
    });
  }
}

  return (
    <div className="w-full md:h-full flex flex-col gap-3 relative bg-[#191B1C] border border-white/5 rounded-[22px] p-5 md:overflow-hidden">

      {/* BLUR OVERLAY */}
{isAnyModalOpen &&
  createPortal(
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-lg z-[9998]"
      onClick={() => {
        setOpenModel(false)
        setOpenSize(false)
        setOpenDuration(false)
      }}
    />,
    document.body
  )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">
          Create Viral Video
        </h1>
        <p className="text-sm text-white/50">
          Turn your ideas into cinematic AI videos.
        </p>
      </div>

          {/* MODE SELECTOR */}
<div className="relative w-full flex justify-center mt-2">
  <div
    className="
      relative flex w-full p-1
      rounded-xl
      border border-white/5
      bg-[#16181A]
      overflow-hidden
    "
  >
    {[
      {
        label: "Viral Image",
        path: "/workspace/image-generator",
      },
      {
        label: "Viral Video",
        path: "/workspace/video-generator",
      },
    ].map((item) => {
      const isActive = location.pathname === item.path;

      return (
        <button
          key={item.label}
          onClick={() => navigate(item.path)}
          className="relative flex-1 py-2.5 text-sm font-medium z-10"
        >
          {isActive && (
            <div
              className="
                absolute inset-0 rounded-xl
                bg-gradient-to-r from-[#7A3BFF] via-[#9D4EDD] to-[#C77DFF]
                shadow-[0_0_25px_rgba(122,59,255,0.45)]
                transition-all duration-300
              "
            />
          )}

          <span
            className={`relative z-10 ${
              isActive ? "text-white" : "text-white/60"
            }`}
          >
            {item.label}
          </span>
        </button>
      );
    })}
  </div>
</div>

      {/* PROMPT */}
      
<div className="relative">
  <div
    className="
      rounded-xl
      border border-white/5
      bg-[#16181A]
      px-4 py-6
      transition
      focus-within:border-[#7A3BFF]/50
      focus-within:shadow-[0_0_0_1px_rgba(122,59,255,0.3)]
    "
  >
    <textarea
      value={prompt}
      onChange={(e) => setPrompt(e.target.value)}
      placeholder="Describe your video scene..."
      rows={4}
      className="
        w-full bg-transparent outline-none
        text-[15px] text-white
        placeholder:text-white/40
        resize-none
      "
    />
  </div>
</div>

      {/* IMPORT IMAGE */}
  <button
  disabled={!canAddImages}
  onClick={() => {
    if (!canAddImages) return;
    setOpenReferenceModal(true);
  }}
  className={`
    w-full rounded-xl
    border border-white/5
    bg-[#16181A]
    py-7
    flex flex-col items-center justify-center gap-2
    transition-all duration-200
    ${
      canAddImages
        ? "hover:border-[#7A3BFF]/50 hover:shadow-[0_8px_30px_rgba(122,59,255,0.15)] hover:scale-[1.01]"
        : "opacity-40 cursor-not-allowed"
    }
  `}
>
  <ImagePlus className="w-6 h-6 text-white/50" />
  <p className="text-sm text-white/60 font-medium">
    Add visual references
  </p>
</button>
{selected.length > 0 && (
  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 w-full mt-2">
    {selected.map((img) => (
      <div
        key={img.id}
        className="relative aspect-square rounded-xl overflow-hidden"
      >
        <img
          src={img.url}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <button
          onClick={() => toggleSelect(img)}
          className="absolute top-2 right-2 bg-black/60 backdrop-blur-md rounded-full p-1"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>
    ))}
  </div>
)}


{missingRequiredImage && (
  <p className="text-xs text-amber-400 mt-2">
    {selectedModel.label} requires a reference image.
  </p>
)}

{/* 

<button
  onClick={() => setOpenTemplates(true)}
  className="
    mt-4
    w-full
    bg-[#141722]
    border border-[#2A2F45]
    rounded-xl
    py-3
    text-sm font-medium text-white
    transition-all duration-300
    hover:border-[#7A3BFF]/50
    hover:shadow-[0_0_20px_rgba(122,59,255,0.2)]
  "
>
  Browse Templates
</button>



{openTemplates && (
  <>
  
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9998]"
      onClick={() => setOpenTemplates(false)}
    />

  
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">

 
      <div
        className="
          w-[95%] md:w-[85%]
          h-[85%]
          bg-[#141722]/95
          border border-[#2A2F45]
          rounded-3xl
          shadow-[0_0_60px_rgba(122,59,255,0.25)]
          p-8
          overflow-y-auto
        "
      >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-white">
          Video Templates
        </h2>
        <button onClick={() => setOpenTemplates(false)}>
          <X className="w-6 h-6 text-white/60 hover:text-white" />
        </button>
      </div>

      <VideoTemplate
        onSelect={(template) => {
          handleTemplateSelect(template);
          setOpenTemplates(false);
        }}
      />
    </div>
    </div>
  </>
)}

 */}

      {/* MODEL */}
<button
  onClick={() => {
    setOpenModel(!openModel);
    setOpenSize(false);
    setOpenDuration(false);
  }}
className={`
  md:alive-card
  group relative
  rounded-xl
  border border-white/10
  bg-[#16181A]
  px-4 py-3.5
  text-left
  transition-all duration-200
  hover:border-[#7A3BFF]/40
  hover:shadow-[0_6px_20px_rgba(122,59,255,0.15)]
  active:scale-[0.98]

  ${openModel ? "border-[#7A3BFF] shadow-[0_0_0_1px_rgba(122,59,255,0.4)] alive-active" : ""}
`}
>

    
<div className="flex items-center justify-between">

  {/* LEFT SIDE */}
  <div className="flex items-center gap-3">
    <img
      src={selectedModel.logo}
      alt={selectedModel.label}
      className="w-9 h-9 rounded-lg object-cover"
    />

    <div className="flex flex-col">
      <p className="text-xs text-white/50">Model</p>
      <p className="text-sm text-white font-medium">
        {selectedModel.label}
      </p>
    </div>
  </div>

  {/* RIGHT SIDE */}
  <ChevronRight
    className={`w-4 h-4 text-white/40 transition-all duration-200 ${
      openModel
        ? "rotate-90 text-purple-400"
        : "group-hover:translate-x-1"
    }`}
  />

</div>

</button>

      {/* SETTINGS */}
      <div ref={controlsRef} className="grid grid-cols-2 gap-2 relative z-50 mt-2">


      
{/* SIZE */}
<button
  disabled={disableSizeSelector}
  onClick={() => {
    if (disableSizeSelector) return;

    setOpenSize(!openSize);
    setOpenModel(false);
    setOpenDuration(false);
  }}
className={`
  md:alive-card
  group relative
  rounded-xl
  border border-white/10
  bg-[#16181A]
  px-4 py-3.5
  text-left
  transition-all duration-200
  hover:border-[#7A3BFF]/40
  hover:shadow-[0_6px_20px_rgba(122,59,255,0.15)]
  active:scale-[0.98]

  ${openSize ? "border-[#7A3BFF] shadow-[0_0_0_1px_rgba(122,59,255,0.4)] alive-active" : ""}
  ${disableSizeSelector ? "opacity-40 cursor-not-allowed" : ""}
`}
>
  <div className="flex flex-col gap-1">



    {/* LABEL */}
    <p className="text-xs text-white/50">Size</p>

    {/* VALUE ROW */}
    <div className="flex items-center justify-between">

      {/* LEFT SIDE — VALUE */}
      <p className="text-sm text-white font-medium">
        {selectedSize}
      </p>

      {/* RIGHT SIDE — PREVIEW + CHEVRON */}
      <div className="flex items-center gap-3">

        <AspectPreview ratio={selectedSize} />

        <ChevronRight
          className={`w-4 h-4 text-white/40 transition-all duration-200 ${
            openSize
              ? "rotate-90 text-purple-400"
              : "group-hover:translate-x-1"
          }`}
        />
      </div>
    </div>
  </div>
</button>



        {/* DURATION */}
        <button
          onClick={() => {
            setOpenDuration(!openDuration);
            setOpenModel(false);
            setOpenSize(false);
          }}
  className={`
  md:alive-card
  group relative
  rounded-xl
  border border-white/10
  bg-[#16181A]
  px-4 py-3.5
  text-left
  transition-all duration-200
  hover:border-[#7A3BFF]/40
  hover:shadow-[0_6px_20px_rgba(122,59,255,0.15)]
  active:scale-[0.98]

  ${openDuration ? "border-[#7A3BFF] shadow-[0_0_0_1px_rgba(122,59,255,0.4)] alive-active" : ""}
`}
        >
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-white/50">Duration</p>
              <p className="text-sm text-white font-medium">
                {selectedDuration}
              </p>
            </div>
            <ChevronRight
              className={`w-4 h-4 text-white/40 transition-all duration-200 ${
                openDuration ? "rotate-90 text-purple-400" : "group-hover:translate-x-1"
              }`}
            />
          </div>
        </button>

{openModel &&
  createPortal(
    <div
      ref={modelModalRef}
  onMouseDown={(e) => e.stopPropagation()}
      className="
        fixed
        z-[10000]
        left-1/2 -translate-x-1/2
        top-[18%] md:top-1/2
        md:-translate-y-1/2
        w-[92%] md:w-[800px]
        max-h-[75vh]
        bg-[#191B1C]
        border border-white/10
        rounded-xl
        shadow-2xl
        p-5
        overflow-y-auto
      "
    >
      
    {/* Header */}
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-white font-medium">Select Model</h3>
      <button
        onClick={() => setOpenModel(false)}
        className="text-white/60 hover:text-white"
      >
        <X className="w-5 h-5" />
      </button>
    </div>

    {/* Models grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Object.entries(MODELS)
  .filter(([key]) => key.startsWith("video:"))
  .map(([key, model]) => (

        <VideoModelCard
          key={key}
          logo={model.logo}
          label={model.label}
          description={model.description}
          traits={model.traits}
          active={key === selectedModelKey}
        onClick={() => {
  setSelectedModelKey(key);

  setSelectedSize(
    model.supportedSizes?.includes(selectedSize)
      ? selectedSize
      : model.supportedSizes?.[0]
  );

  setSelectedDuration(
    model.supportedDurations?.includes(selectedDuration)
      ? selectedDuration
      : model.supportedDurations?.[0]
  );

  setSelectedResolution(
    model.supportedResolutions?.includes(selectedResolution)
      ? selectedResolution
      : model.supportedResolutions?.[0]
  );

  setOpenModel(false);
}}

        />
      ))}
    </div>
    </div>,
    document.body
  )}



        {/* SIZE MODAL */}
        {openSize && (
          <Modal title="Select Size" onClose={() => setOpenSize(false)}>
   {selectedModel.supportedSizes.map((size) => (
  <SelectOption
    key={`size-${size}`}
    active={size === selectedSize}
   onClick={() => {
  if (!selectedModel.supportedSizes.includes(size)) return;

  setSelectedSize(size);
  setOpenSize(false);
}}
  >
    <div className="flex items-center gap-3">
      <AspectPreview ratio={size} />
      <span>{size}</span>
    </div>
  </SelectOption>
))}
          </Modal>
        )}

        {/* DURATION MODAL */}
        {openDuration && (
          <Modal title="Select Duration" onClose={() => setOpenDuration(false)}>
           {selectedModel.supportedDurations.map((dur) => (
 <SelectOption
  key={`dur-${dur}`}
    active={dur === selectedDuration}
   onClick={() => {
  if (!selectedModel.supportedDurations.includes(dur)) return;

  setSelectedDuration(dur);
  setOpenDuration(false);
}}
  >
    {dur}
  </SelectOption>
))}

          </Modal>
        )}
      </div>

      {/* RESOLUTION */}
<div className="flex flex-col  gap-2 mt-2 ">
  <p className="text-xs text-white/50">Resolution</p>

  <div className="flex gap-2 flex-wrap">
    {selectedModel.supportedResolutions.map((resKey) => {
      const isActive = selectedResolution === resKey;

      return (
        <button
          key={resKey}
          onClick={() => setSelectedResolution(resKey)}
          className={`
            px-4 py-2 rounded-xl text-sm font-medium
            border transition-all duration-200
            ${
             isActive
          ? "bg-[#7A3BFF] text-white border-[#7A3BFF] shadow-[0_0_16px_rgba(122,59,255,0.5)]"
          : "bg-[#1A1D2B] border-[#2A2F45] text-[#E6E8EE] hover:border-[#7A3BFF]/40 hover:shadow-[0_0_8px_rgba(122,59,255,0.2)] shadow-[0_0_3px_rgba(122,59,255,0.2)] "
            }
          `}
        >
          {RESOLUTIONS[resKey].label}
        </button>
      );
    })}
  </div>
</div>

 {/* GENERATE BUTTON */}
<button
  onClick={handleGenerate}
  
   disabled={!prompt.trim() || isGenerating || missingRequiredImage}

 className={`w-full py-3 rounded-lg font-semibold text-white mt-4 transition-all duration-300
  ${
    !prompt.trim() || isGenerating || missingRequiredImage
      ? "bg-white/5 border border-white/10 text-white/40 cursor-not-allowed"
      : `
      generate-btn generate-btn-ready
      bg-gradient-to-r from-purple-500 to-fuchsia-500/40
      backdrop-blur-md
      border border-purple-400/30
      hover:from-purple-500/60
      hover:to-fuchsia-500/50
      hover:border-purple-400/50
      hover:scale-[1.03]
      shadow-[0_0_20px_rgba(168,85,247,0.35)]
      hover:shadow-[0_0_30px_rgba(168,85,247,0.55)] 
      `
  }`}
>
 {isGenerating
  ? "Generating…"
  : missingRequiredImage
  ? "Image needed for this model"
  : "Generate Video"}
</button>

<div className="mt-1">
  <div
    className="
      w-full
      bg-[#10131A]
      border border-gray-800
      rounded-xl
      px-4 py-3
      flex items-center justify-center gap-2
      text-[15px] font-semibold
      text-green-400
      transition-all duration-300    "
  >
    <span className="text-base cursor-default">◆</span>
    <span className="cursor-default">Estimated cost: {totalCredits} credits</span>
  </div>
</div>

{/* 🔥 MOVE THIS HERE */}
{openReferenceModal && canAddImages && (
  <ReferenceImageModal
    open={openReferenceModal}
    onClose={() => setOpenReferenceModal(false)}
    images={images}
    selected={selected}
    maxSelectable={maxRefImages}
    onUpload={handleUpload}
    onToggle={toggleSelect}
  />
)}
  {toast && (
  <Toast
    message={toast.message}
    type={toast.type}
    onClose={() => setToast(null)}
  />
)}

{showUpgrade && (
  <UpgradeToast
    onClose={() => setShowUpgrade(false)}
    onUpgrade={() => navigate("/pricing")}
  />
)}

<GuestVideoModal
  open={guestModalOpen}
  onClose={() => setGuestModalOpen(false)}
  onSignup={() => navigate("/signup")}
/>

    </div>
  );
}

/* ---------------- Modal Components ---------------- */

function Modal({ title, onClose, children }) {
    return createPortal(
    <div
    onMouseDown={(e) => e.stopPropagation()}
      className="
        fixed z-[10000] left-1/2 -translate-x-1/2
        top-[18%] md:top-1/2 md:-translate-y-1/2
        w-[92%] md:w-[450px]
        max-h-[70vh]
        bg-[#191B1C]
        border border-white/10
        rounded-xl
        shadow-2xl
        p-5
        overflow-y-auto
      "
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white cursor-default font-medium">{title}</h3>
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {children}
      </div>
      </div>,
    document.body
  );

}

function VideoModelCard({
  logo,
  label,
  description,
  traits = [],
  active,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative w-full rounded-xl transition text-left
        bg-[#0B0E1A]/70 border
        ${
          active
            ? "border-[#7A3BFF] bg-[#7A3BFF]/10 shadow-[0_0_20px_rgba(122,59,255,0.35)]"
            : "border-white/10 hover:bg-white/5 hover:border-[#7A3BFF]/40"
        }
        p-4
      `}
    >
      {/* ACTIVE CHECK */}
      {active && (
        <span className="absolute top-3 right-3 text-[#7A3BFF] font-bold">
          ✓
        </span>
      )}

      {/* HEADER */}
      <div className="flex items-center gap-3">
        <img
          src={logo}
          alt={label}
          className="w-10 h-10 rounded-xl object-cover p-1"
        />
        <div className="text-white font-medium leading-tight">
          {label}
        </div>
      </div>

      {/* DESCRIPTION */}
      {description && (
        <div className="text-white/50 text-xs leading-snug mt-2">
          {description}
        </div>
      )}

      {/* TRAITS */}
      {traits.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {traits.map((t) => (
            <span
              key={t}
              className="text-[11px] px-3 py-1 rounded-md bg-white/10 text-white/70"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}


function SelectOption({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full px-4 py-3 text-left rounded-lg text-sm
        transition-all duration-200
        ${
          active
            ? "bg-[#7A3BFF]/20 border border-[#7A3BFF]"
            : "hover:bg-white/5"
        }
      `}
    >
      {children}
    </button>
  );
}
function AspectPreview({ ratio }) {
  const base = 20; // base height

  let width = base;
  let height = base;

  if (ratio === "1:1") {
    width = base;
    height = base;
  }

  if (ratio === "9:16") {
    width = base * (9 / 16);
    height = base;
  }

  if (ratio === "16:9") {
    width = base;
    height = base * (9 / 16);
  }

  if (ratio === "4:5") {
    width = base * (4 / 5);
    height = base;
  }

  return (
    <div
      className="border border-white rounded-sm opacity-70"
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
    />
  );
  
}
