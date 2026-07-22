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
import { calculateVideoCredits, calculateVideoCreditsRaw } from "../../lib/video-generator/videoPricing";
import VideoTemplate from "../../components/video-templates/VideoTemplate";
import { createPortal } from "react-dom";
import { useMemo } from "react";
import UpgradeToast from "../../components/VideoGenerator/UpgradeToast";
import GuestVideoModal from "../../components/VideoGenerator/GuestVideoModal";
import GenerateButton from "../../components/ImageGenerator/GenerateButton";
VideoIcon
Folder

const SAMPLE_REFERENCE_IMAGES = [
  "/assets/showcase/image3.webp",
  "/assets/showcase/image4.webp",
  "/assets/showcase/image5.webp",
];

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
  


// Only these two models are active — everything else is disabled
const V2_KEY = "video:seedance15pro";
const V3_KEY = "video:veo31lite";

const [selectedModelKey, setSelectedModelKey] = useState(V2_KEY);
const selectedModel = MODELS[selectedModelKey] ?? MODELS[V3_KEY];

  const [selectedSize, setSelectedSize] = useState("9:16");
  const [selectedDuration, setSelectedDuration] = useState("6s");
  const [sliderDuration, setSliderDuration] = useState(8);  // for slider models
  const [selectedResolution, setSelectedResolution] = useState("720p");

  const modelHasSound   = !!selectedModel?.hasSound;
  const usesDurationSlider = !!selectedModel?.durationSlider;
  const [withSound, setWithSound] = useState(() => !!selectedModel?.soundDefaultOn);

  // Reset sound default and duration when model changes
  useEffect(() => {
    setWithSound(!!MODELS[selectedModelKey]?.soundDefaultOn);
    // Reset duration to a sensible default for each model
    if (selectedModelKey === V2_KEY) setSliderDuration(6);
    if (selectedModelKey === V3_KEY) setSelectedDuration("6s");
  }, [selectedModelKey]);

const totalCredits = useMemo(() => {
  if (usesDurationSlider) {
    return Math.ceil(calculateVideoCreditsRaw(selectedModelKey, sliderDuration, modelHasSound ? withSound : false));
  }
  return calculateVideoCredits(selectedModelKey, selectedDuration, selectedResolution, modelHasSound ? withSound : false);
}, [selectedModelKey, selectedDuration, sliderDuration, selectedResolution, withSound, modelHasSound, usesDurationSlider]);

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

const imageRequiredForModel = selectedModelKey === "video:miniMaxFast";
const missingRequiredImage  = imageRequiredForModel && !hasRefs;
const disableSizeSelector   = isKling && hasRefs;



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
      modelKey:   selectedModelKey,
      prompt:     prompt.trim(),
      size:       selectedSize,
      duration:   usesDurationSlider ? String(sliderDuration) : selectedDuration,
      resolution: selectedResolution,
      refImages:  selected.map((img) => img.url),
      withSound:  modelHasSound ? withSound : false,
    });

    watchJob(job.id, () => {});

    // unlock after short delay (long enough to prevent rapid double-submit)
    setTimeout(() => {
      setIsGenerating(false);
    }, 3500);

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
    <div className="w-full flex-1 flex flex-col gap-2.5 relative bg-[#0b0c0e] border border-white/[0.06] shadow-[0_10px_40px_rgba(0,0,0,0.4)] rounded-2xl p-4 md:p-5 pb-[80px] md:pb-5">

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

          {/* MODE SELECTOR */}
<div className="w-full">
  <div
    className="
      relative flex w-full p-1
      rounded-xl
      bg-[#151719]
      border border-white/[0.08]
      overflow-hidden
    "
  >
    <div
      className={`
        absolute top-1 bottom-1 w-1/2 rounded-lg
        transition-all duration-300
        ${
          location.pathname === "/workspace/video-generator"
            ? "left-[calc(50%-2px)]"
            : "left-1"
        }
        bg-[#2D1B50]
        border border-[#9B6DFF]/55
        overflow-hidden
      `}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.45),transparent_72%)]" />
    </div>

    {[
      {
        label: "Viral Image",
        path: "/workspace/image-generator",
        icon: "/icons/image.png",
      },
      {
        label: "Viral Video",
        path: "/workspace/video-generator",
        icon: "/icons/video.png",
      },
    ].map((item) => {
      const isActive = location.pathname === item.path;

      return (
        <button
          key={item.label}
          onClick={() => navigate(item.path)}
          className="relative flex-1 py-1 flex flex-col items-center justify-center gap-[1px] mb-1 z-10"
        >
          <img
            src={item.icon}
            alt={item.label}
            className={`
              object-contain transition-all duration-200
              ${
                isActive
                  ? "w-8 h-8 opacity-100 scale-110 drop-shadow-[0_0_14px_rgba(168,85,247,0.9)]"
                  : "w-7 h-7 opacity-50 hover:opacity-80 hover:scale-105"
              }
            `}
          />

          <span
            className={`text-xs font-medium transition-all duration-200 ${
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

      {/* MODEL — v2/v3 toggle */}
<div className="flex items-center gap-2 bg-[#0e1012] border border-white/[0.07] rounded-xl p-1">
  {[
    { key: V2_KEY, label: "V2", badge: "Fast"    },
    { key: V3_KEY, label: "V3", badge: "Premium" },
  ].map(({ key, label, badge }) => {
    const active = selectedModelKey === key;
    return (
      <button
        key={key}
        onClick={() => setSelectedModelKey(key)}
        className={`relative flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 transition-all ${
          active ? "bg-[#7A3BFF] text-white shadow-lg shadow-[#7A3BFF]/20" : "text-white/40 hover:text-white/70"
        }`}
      >
        <span className={`text-[12px] font-bold tracking-wide ${active ? "text-white" : ""}`}>{label}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
          active ? "bg-white/20 text-white" : "bg-white/[0.05] text-white/30"
        }`}>{badge}</span>
      </button>
    );
  })}
</div>

      {/* PROMPT */}
<div
  data-ftg="prompt"
  className="rounded-xl border border-white/[0.08] bg-[#0e1012] px-4 py-3 focus-within:border-[#7A3BFF]/40 transition"
>
  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/25 mb-2">Prompt</p>
  <textarea
    value={prompt}
    onChange={(e) => {
      setPrompt(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }}
    placeholder="Describe your video..."
    rows={3}
    className="w-full bg-transparent outline-none resize-none text-white/90 placeholder:text-white/20 text-[14px] leading-relaxed overflow-y-auto max-h-[200px]"
  />
</div>

      {/* REFERENCE IMAGES — compact */}
{canAddImages && (
  <button
    onClick={() => setOpenReferenceModal(true)}
    className="group flex items-center gap-3 w-full rounded-xl border border-white/[0.07] bg-[#0e1012] px-4 py-2.5 text-left hover:border-white/15 transition-all active:scale-[0.99]"
  >
    {/* Mini stacked previews */}
    <div className="flex items-center shrink-0" style={{ width: selected.length > 0 ? 40 : 28 }}>
      {selected.length > 0
        ? selected.slice(0, 2).map((img, i) => (
            <div key={img.id} className="w-7 h-7 rounded-md overflow-hidden border border-white/10" style={{ marginLeft: i > 0 ? -8 : 0, zIndex: 2 - i }}>
              <img src={img.url} className="w-full h-full object-cover" />
            </div>
          ))
        : <div className="w-7 h-7 rounded-md border border-white/[0.08] bg-white/[0.04] flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white/30" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18V6.75A2.25 2.25 0 0018.75 4.5H5.25A2.25 2.25 0 003 6.75v13.5z" /></svg>
          </div>
      }
    </div>
    <div className="flex-1 min-w-0">
      <span className="text-[13px] text-white/60 group-hover:text-white/80 transition">
        {selected.length > 0 ? `${selected.length} reference${selected.length > 1 ? "s" : ""} · click to edit` : "Add images or videos"}
      </span>
    </div>
    <span className="text-[10px] text-white/25 shrink-0">Optional</span>
  </button>
)}

{missingRequiredImage && (
  <p className="text-xs text-amber-400">
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

  
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">

 
      <div
        className="
          w-[95%] md:w-[85%]
          max-h-[88dvh]
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

      {false && (
      <>
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
  bg-[#151719]
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
      </>
      )}
      {/* SETTINGS */}
      <div ref={controlsRef} className="relative z-50 flex flex-col gap-2">
        {/* Size — full width */}
        <div className="grid grid-cols-1 gap-2">

{/* SIZE */}
<button
  disabled={disableSizeSelector}
  onClick={() => {
    if (disableSizeSelector) return;
    setOpenSize(!openSize);
    setOpenModel(false);
    setOpenDuration(false);
  }}
  className={`group flex items-center justify-between rounded-xl border bg-[#0e1012] px-3.5 py-2.5 text-left transition-all
    ${openSize ? "border-[#7A3BFF]/60" : "border-white/[0.07] hover:border-white/15"}
    ${disableSizeSelector ? "opacity-40 cursor-not-allowed" : ""}`}
>
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/25 mb-0.5">Size</p>
    <p className="text-[13px] font-semibold text-white">{selectedSize}</p>
  </div>
  <div className="flex items-center gap-2">
    <AspectPreview ratio={selectedSize} />
    <ChevronRight className={`w-3.5 h-3.5 text-white/30 transition-all ${openSize ? "rotate-90 text-[#7A3BFF]" : "group-hover:translate-x-0.5"}`} />
  </div>
</button>

        </div>{/* close size row */}

        {/* Duration — own full-width row */}
        <div>

{/* DURATION */}
{usesDurationSlider ? (
  <div className="rounded-xl border border-white/[0.07] bg-[#0e1012] px-3.5 py-3">
    <div className="flex items-center justify-between mb-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/25">Duration</p>
      <p className="text-[13px] font-bold text-white">{sliderDuration}<span className="text-white/40 font-normal text-[11px]">s</span></p>
    </div>
    <input
      type="range"
      min={selectedModel.minDuration ?? 4}
      max={selectedModel.maxDuration ?? 15}
      step={1}
      value={sliderDuration}
      onChange={(e) => setSliderDuration(Number(e.target.value))}
      className="w-full h-1 rounded-full appearance-none cursor-pointer"
      style={{ accentColor: "#7A3BFF" }}
    />
    <div className="flex justify-between mt-1.5">
      <span className="text-[10px] text-white/25">{selectedModel.minDuration ?? 4}s</span>
      <span className="text-[10px] text-white/25">{selectedModel.maxDuration ?? 15}s</span>
    </div>
  </div>
) : (
  <button
    onClick={() => { setOpenDuration(!openDuration); setOpenModel(false); setOpenSize(false); }}
    className={`w-full group flex items-center justify-between rounded-xl border bg-[#0e1012] px-3.5 py-2.5 text-left transition-all
      ${openDuration ? "border-[#7A3BFF]/60" : "border-white/[0.07] hover:border-white/15"}`}
  >
    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/25">Duration</p>
    <div className="flex items-center gap-2">
      <p className="text-[13px] font-semibold text-white">{selectedDuration}</p>
      <ChevronRight className={`w-3.5 h-3.5 text-white/30 transition-all ${openDuration ? "rotate-90 text-[#7A3BFF]" : "group-hover:translate-x-0.5"}`} />
    </div>
  </button>
)}

        </div>{/* close duration row */}

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
        bg-[#111314]
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
  .filter(([key]) =>
    key.startsWith("video:") &&
    !DISABLED_VIDEO_MODELS.includes(key)
  )
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

      {/* SOUND — compact inline row, no resolution needed (always 720p) */}
{modelHasSound && (
  <button
    type="button"
    onClick={() => setWithSound((v) => !v)}
    style={{ touchAction: "manipulation" }}
    className="flex items-center justify-between w-full rounded-xl border border-white/[0.07] bg-[#0e1012] px-3.5 py-2.5 hover:border-white/15 active:scale-[0.99]"
  >
    <div className="flex items-center gap-2">
      <span className="text-[13px]">{withSound ? "🔊" : "🔇"}</span>
      <span className="text-[13px] font-medium text-white/70">AI Sound</span>
      <span className="text-[11px] text-white/30">{withSound ? "On" : "Off"}</span>
    </div>
    <div
      className="relative shrink-0 rounded-full"
      style={{ width: 34, height: 18, background: withSound ? "#7A3BFF" : "rgba(255,255,255,0.10)", transition: "background 120ms" }}
    >
      <div
        className="absolute top-[3px] w-3 h-3 rounded-full bg-white shadow"
        style={{ left: withSound ? 17 : 3, transition: "left 120ms" }}
      />
    </div>
  </button>
)}

{/* GENERATE + RESET
     mt-auto pushes this to the bottom of the flex-col container.
     The container has pb-[80px] so this clears the mobile nav. */}
<div className="mt-auto flex items-center gap-3 pt-1">
  {/* Reset — bare text */}
  <button
    onClick={() => {
      setPrompt("");
      setSelected([]);
      setSliderDuration(8);
      setSelectedDuration("6s");
    }}
    className="shrink-0 flex items-center gap-1 text-white/30 hover:text-white/60 transition-colors active:scale-95"
  >
    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5" />
    </svg>
    <span className="text-[11px] font-medium">Reset</span>
  </button>
  {/* Generate */}
  <div className="flex-1">
    <GenerateButton
      onClick={handleGenerate}
      disabled={!prompt.trim() || isGenerating || missingRequiredImage}
      isGenerating={isGenerating}
      estimatedCredits={totalCredits}
    />
  </div>
</div>

{false && (
<>
 {/* OLD GENERATE BUTTON */}
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
</>
)}

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
        bg-[#111314]
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
