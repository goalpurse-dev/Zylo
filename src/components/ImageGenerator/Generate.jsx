import {  useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useRef, useEffect } from "react";
import { MODELS } from "../../lib/image-generator/modelsConfig";
import { useReferenceImages } from "../../components/reference-images/useReferenceImages";
import ReferenceImageModal from "../../components/reference-images/ReferenceImageModal";
import { generateImageFromUI } from "../../lib/image-generator";
import { supabase } from "../../lib/supabaseClient";
import { IMAGE_STYLES } from "../../lib/image-generator/styles";
import { ChevronRight, Folder, VideoIcon } from "lucide-react";
import Toast from "../../components/ImageGenerator/Toast";
import ProgressToast from "../../components/ImageGenerator/ProgressToast";
import LimitReachedToast from "../../components/ImageGenerator/LimitReachedToast";
import GuestGenerateModal from "../../components/ImageGenerator/GuestGenerateModal";
import { IMAGE_SIZES } from "../../lib/image-generator/sizes";
import CreditLogo from "../../assets/toolshell/credit.png"
import ErrorToast from "../../components/ImageGenerator/ErrorToast";
import { watchJob } from "../../lib/jobs";
import { NANO_RESOLUTIONS } from "../../lib/image-generator/nanoResolutions";

import { ArrowBigDown, ArrowBigLeft, BoxSelect, Image, ImagePlusIcon, Settings, Wand, Wand2, X } from "lucide-react";
import Bg from "../../assets/ImageGenerator/bg.png"
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/solid";
Image
ImagePlusIcon
X
Settings
ArrowBigLeft
ArrowBigDown
BoxSelect
Wand2
VideoIcon
Folder



const MenuItem = ({ label, value, onClick }) => (
    
    <button
    onClick={onClick}
    className="  flex justify-between items-center px-4 py-3 text-sm text-white/90 hover:bg-white/5 " 
  >
    <span>{label}</span>
    <span className=" text-white/50">{value} →</span>
  </button>
);

const Option = ({ label }) => (
  <button className="px-4 py-2 text-sm text-white/90 hover:bg-purple-500/20">
    {label}
  </button>
);

const PRO_TRAITS = [
  "4× faster generation",
  "Sharper image quality",
  "Better prompt accuracy",
  "Ultra-realistic renders",
  "Advanced AI model",
  "More consistent outputs",
  "Studio lighting realism",
  "Higher resolution detail",
  "Professional-grade visuals",
  "Improved subject accuracy",
  "Better composition",
  "Cleaner generations",
];

const getRandomTrait = (seed) => {
  return PRO_TRAITS[seed % PRO_TRAITS.length];
};


const SubMenu = ({ title, onBack, children }) => (
  <div className=" flex flex-col ">
    <button
      onClick={onBack}
      className=" px-4 py-3 text-sm text-white/70 hover:bg-white/5"
    >
    <ArrowBigLeft className="h-5 w-5"></ArrowBigLeft>
    </button>
    {children}
  </div>
);

const StyleCard = ({ img, label, active, onClick }) => (
  <button
    onClick={onClick}
      className={`
      relative flex flex-col gap-2 rounded-xl overflow-hidden transition
      ${active
        ? "border-2 border-[#7A3BFF] shadow-[0_0_25px_rgba(122,59,255,0.45)] "
        : "border border-white/10 hover:border-purple-500/50"}
    `}
  >
    <img src={img} className="h-32 w-full object-cover" />
    <div className="text-sm text-white px-2 pb-2 text-left">
      {label}
    </div>
  </button>
);

const AspectRatioRow = ({ label, width, height, previewW, previewH, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-4 px-4 py-3 w-full 
               hover:bg-white/5 transition text-left"
  >
    {/* FIXED PREVIEW COLUMN */}
    <div className="w-[50px] flex justify-center">
    <div
  className="border border-white/70 rounded-xl"
  style={{
  width: `${s.previewW}px`,
  height: `${s.previewH}px`,
  maxWidth: "42px",
  maxHeight: "42px",
}}
/>
    </div>

    {/* TEXT COLUMN (now perfectly aligned) */}
    <div className="flex flex-col">
      <span className="text-sm text-white">{label}</span>
      <span className="text-xs text-white/50">
        {width} × {height}
      </span>
    </div>
  </button>
);

const ModelCard = ({
  img,
  label,
  description,
  credits,
  traits = [],
  active,
  onClick,
  compact = false,
}) => (
  <button
    onClick={onClick}
 className={`relative w-full h-full rounded-xl transition text-left flex flex-col
      bg-[#0B0E1A]/70 border
      ${
        active
          ? "border-[#7A3BFF] bg-[#7A3BFF]/10 shadow-[0_0_20px_rgba(122,59,255,0.35)]"
          : "border-white/10 hover:bg-white/5 hover:border-[#7A3BFF]/40"
      }
      ${compact ? "p-3" : "p-4"}
    `}
  >
    {/* ACTIVE CHECK */}
    {active && (
      <span className="absolute top-3 right-3 text-[#7A3BFF] font-bold">
        ✓
      </span>
    )}

    {/* HEADER */}
    <div className="flex items-center gap-2  ">
      {/* LOGO */}
      <img
        src={img}
        alt={label}
        className="w-10 h-10 rounded-xl object-cover  p-1 flex-shrink-0"
      />
       <div className="text-white font-medium leading-tight">
          {label}
        </div>
        </div>

      {/*  DESCRIPTION */}
     
       

        {description && (
          <div className="text-white/50 text-xs leading-snug ">
            {description}
          </div>
        )}
    

    {/* TRAITS */}
    {traits.length > 0 && (
      <div className="flex flex-wrap gap-2 mt-2">
        {traits.map((t) => (
          <span
            key={t}
            className="text-[11px] px-3 py-1 rounded-xl bg-white/10 text-white/70"
          >
            {t}
          </span>
        ))}
      </div>
    )}

    {/* CREDITS */}
    <div className="flex items-center gap-1 mt-2 text-xs text-white/50">
      <span>≈ {credits} credits</span>
    </div>
  </button>
);






export default function Generate({ prompt, setPrompt, onJobCreated, setActiveJobId }) {

const [freeRemaining, setFreeRemaining] = useState(null);
const [toast, setToast] = useState(null);
const [errorToast, setErrorToast] = useState(null);
const location = useLocation();
const navigate = useNavigate();
const [progressToast, setProgressToast] = useState(null);
const [settingsOpen, setSettingsOpen] = useState(false);
const [activeMenu, setActiveMenu] = useState(null); 
const [limitToastOpen, setLimitToastOpen] = useState(false);
const panelRef = useRef(null);
 const [selectedModelKey, setSelectedModelKey] = useState("image:nano.2")
const [selectedSize, setSelectedSize] = useState("1:1");
const [selectedResolution, setSelectedResolution] = useState("2k");

const currentSize =
  IMAGE_SIZES[selectedSize] ?? IMAGE_SIZES["1:1"];



const selectedModel = MODELS[selectedModelKey];
const estimatedCredits = selectedModel?.supportsResolutions
  ? selectedModel.resolutions.find(r => r.key === selectedResolution)?.credits ?? selectedModel.credits
  : selectedModel?.credits ?? 0;
  const textareaRef = useRef(null);
const [openSize, setOpenSize] = useState(false);
const [openStyle, setOpenStyle] = useState(false);
const [openModel, setOpenModel] = useState(false);
const controlsRef = useRef(null);
const [isGenerating, setIsGenerating] = useState(false);
const [planCode, setPlanCode] = useState(null);
const [user, setUser] = useState(null);
const [guestModalOpen, setGuestModalOpen] = useState(false);

const maxRefImages = selectedModel.maxReferenceImages;
const canAddImages = maxRefImages > 0;
const [openReferenceModal, setOpenReferenceModal] = useState(false);
const STYLE_KEYS = Object.keys(IMAGE_STYLES);
const [traitIndex, setTraitIndex] = useState(0);
const generateRef = useRef(null);


useEffect(() => {
  const interval = setInterval(() => {
    setTraitIndex((i) => i + 1);
  }, 2000); // rotate every 2 seconds

  return () => clearInterval(interval);
}, []);

const [selectedStyle, setSelectedStyle] = useState(STYLE_KEYS[0]);

const {
  images,
  selected,
  addImage,
  toggleSelect,
} = useReferenceImages(maxRefImages);
const handleUpload = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return;

    const ext = file.name.split(".").pop() || "png";
    const path = `${uid}/${crypto.randomUUID()}.${ext}`;

    // 1) upload to storage
    const { error: upErr } = await supabase.storage
      .from("reference-images")
      .upload(path, file, { upsert: false });

    if (upErr) throw upErr;

    // 2) public url
    const { data: pub } = supabase.storage
      .from("reference-images")
      .getPublicUrl(path);

    const publicUrl = pub?.publicUrl;
    if (!publicUrl) throw new Error("No public URL returned");

    // 3) insert DB row (forever)
    const { data: row, error: dbErr } = await supabase
      .from("reference_images")
      .insert({ user_id: uid, file_url: publicUrl })
      .select("id, file_url")
      .single();

    if (dbErr) throw dbErr;

    // 4) add to UI
    addImage({
      id: row.id,
      url: row.file_url,
    });
  } catch (err) {
    console.error("Reference upload failed:", err);
  } finally {
    e.target.value = ""; // allow same file again
  }
};

const handleGenerate = async () => {
  if (!prompt.trim()) return;

  // 🔥 FREE LIMIT GUARD
// 🔥 FREE LIMIT GUARD (only for free plan)
if (planCode === "free" && freeRemaining === 0) {
  setLimitToastOpen(true);
  return;
}

  // 🔥 CHECK AUTH FIRST
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

if (!user) {
  setGuestModalOpen(true);
  return;
}


 // 🔥 CHECK CREDITS (use credit_balance)
const { data: profile, error: profErr } = await supabase
  .from("profiles")
  .select("credit_balance")
  .eq("id", user.id)
  .single();

if (profErr) {
  console.error("Failed to fetch profile credits:", profErr);
  setToast({ message: "Could not check credits. Try again.", type: "error" });
  return;
}

const requiredCredits = Number(selectedModel?.credits ?? 0);
const balance = Number(profile?.credit_balance ?? 0);

// 🔥 Skip credit check for free plan
if (planCode !== "free") {
  if (balance < requiredCredits) {
    setToast({
      message: `You need ${requiredCredits} credits to generate.`,
      type: "error",
    });
    return;
  }
}


  try {
    setIsGenerating(true);

const style = IMAGE_STYLES[selectedStyle];

// user uploaded references
let refImagesFinal = selected.map((x) => x.url);

// 🔥 auto attach hidden style reference
if (style?.defaultReference) {
  refImagesFinal.unshift(style.defaultReference);
}
const stylePrompt = IMAGE_STYLES[selectedStyle]?.promptHint ?? "";

const finalPrompt = `
${prompt.trim()}

${stylePrompt}
`;

let overrideWidth = null;
let overrideHeight = null;

// 🔥 ONLY for Nano Banana 2
if (selectedModel?.supportsResolutions) {
  const res =
    NANO_RESOLUTIONS[selectedSize]?.[selectedResolution];

  if (res) {
    overrideWidth = res.width;
    overrideHeight = res.height;
  }
}

const job = await generateImageFromUI({
  modelKey: selectedModelKey,
  prompt: finalPrompt,
  style: selectedStyle,
  size: selectedSize,
  refImages: refImagesFinal,

  // ✅ YOU ADD THESE HERE
  width: overrideWidth,
  height: overrideHeight,
  resolution: selectedResolution, // 🔥 THIS LINE
});

if (!job || job.ok === false || job.errors?.length) {
  const errMsg =
    job?.errors?.[0]?.message ||
    job?.error ||
    "This prompt was rejected by the image provider.";

  setErrorToast(errMsg);

  setIsGenerating(false);
  return;
}

    setActiveJobId?.(job.id);
    onJobCreated?.(job);
watchJob(job.id, (updatedJob) => {
  if (updatedJob.status === "failed") {
    setErrorToast(
      updatedJob.error ||
      updatedJob.errors?.[0]?.message ||
      "The AI provider rejected this prompt."
    );
  }
});
      // 🔥 decrement UI counter
 if (freeRemaining !== null && freeRemaining > 0) {
  const newRemaining = freeRemaining - 1;
  setFreeRemaining(newRemaining);

  if (newRemaining >= 0) {
    setProgressToast(newRemaining);
  }
}

  
  } catch (err) {
  console.error("Generate failed:", err);

  const msg = String(err?.message || err);

  // Provider moderation / provider failure
 if (
  msg.toLowerCase().includes("invalid content") ||
  msg.toLowerCase().includes("moderation") ||
  msg.toLowerCase().includes("provider")
) {
    setErrorToast(
      "This prompt was rejected by the image provider's safety filters. Try rewording your prompt or switching models."
    );
  } else {
    setToast({
      message: "Generation failed. Please try again.",
      type: "error",
    });
  }
} finally {
    setIsGenerating(false);
  }
};




useEffect(() => {
  const modalOpen = openModel || openStyle || openSize;

  if (modalOpen) {
    document.body.style.overflow = "hidden";
 } else {
  document.body.style.overflow = "";
}

 return () => {
  document.body.style.overflow = "";
};
}, [openModel, openStyle, openSize]);

useEffect(() => {
  const loadPlan = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const currentUser = auth?.user;

    setUser(currentUser);
    if (!currentUser) return;

    const { data } = await supabase
      .from("profiles")
      .select("plan_code")
      .eq("id", currentUser.id)
      .single();

    const code = (data?.plan_code || "free").toLowerCase();
    setPlanCode(code);

    if (code === "free") {
      setSelectedModelKey("image:flux.base");
    }
  };

  loadPlan();
}, []);



useEffect(() => {
  const loadFreeInfo = async (session) => {
    if (planCode !== "free") return;
    if (!session?.user) return;

    const { data, error } = await supabase.functions.invoke(
      "check-image-eligibility"
    );

    console.log("eligibility:", data, error);

    if (!error && data) {
      setFreeRemaining(data.remaining);
    }
  };

  // 1️⃣ check current session
  supabase.auth.getSession().then(({ data }) => {
    loadFreeInfo(data.session);
  });

  // 2️⃣ listen for auth changes
  const { data: listener } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      loadFreeInfo(session);
    }
  );

  return () => {
    listener.subscription.unsubscribe();
  };
}, [planCode]);

useEffect(() => {
  const handleClickOutside = (e) => {
    if (!controlsRef.current) return;

    if (!controlsRef.current.contains(e.target)) {
      setOpenSize(false);
      setOpenStyle(false);
      setOpenModel(false);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, []);

useEffect(() => {
  const handleClickOutside = (e) => {
    if (panelRef.current && !panelRef.current.contains(e.target)) {
      setSettingsOpen(false);
      setActiveMenu(null);
    }
  };

  if (settingsOpen) {
    document.addEventListener("mousedown", handleClickOutside);
  }

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, [settingsOpen]);

 return (
<section className="pt-[70px]">

 <div
  onClick={() => {
    setOpenModel(false)
    setOpenStyle(false)
    setOpenSize(false)
  }}
  className={`
    fixed inset-0 z-[100]
    bg-black/40
    transition-opacity duration-150
    ${
      openModel || openStyle || openSize
        ? "opacity-100 pointer-events-auto"
        : "opacity-0 pointer-events-none"
    }
  `}
/>


    {/* Background */}
    <div className="relative w-full ">
    


     

      {/* CONTENT */}
      <div className="flex flex-col items-center w-full relative  pt-2 ">



        <div className="w-full flex justify-center mt-4 px-4">
    <div
  className="
  w-full max-w-[900px]
  rounded-[22px]
  border border-white/10
  bg-[linear-gradient(180deg,rgba(18,20,31,0.98),rgba(10,12,20,0.98))]
  p-5 md:p-6
  shadow-[0_12px_40px_rgba(0,0,0,0.25)]
  space-y-6
"
>

         {/* MODE SELECTOR */}
{/* VIRAL MODE SELECTOR */}
<div className="relative w-full flex justify-center">
  <div
    className="
    relative flex w-full max-w-[420px] p-1
    rounded-2xl
    border border-white/10
    bg-[linear-gradient(180deg,rgba(18,20,31,0.95),rgba(10,12,20,0.95))]
    shadow-[0_12px_40px_rgba(0,0,0,0.35)]
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
          {/* ACTIVE BACKGROUND */}
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



{/* FREE PLAN INFO */}
{user && planCode === "free" && freeRemaining !== null && (
<div className="mt-3 flex items-center justify-center gap-3 text-sm font-medium">

{freeRemaining > 0 ? (
  <span className="text-amber-400">
    {freeRemaining} free generation{freeRemaining === 1 ? "" : "s"} left
  </span>
) : (
  <>
    <span className="text-amber-400">
      Free limit reached
    </span>

    <button
      onClick={() => navigate("/workspace/pricing")}
      className="
      px-3 py-1
      rounded-md
      text-xs
      font-semibold
      text-purple-200
      bg-purple-500/10
      border border-purple-400/20
      hover:bg-purple-500/15
      hover:border-purple-400/30
      transition-all duration-200
      "
    >
      Unlock 580 credits
    </button>
  </>
)}

</div>
)}

          {/* PROMPT */}
<div className="relative">
  <div
    className=" 
    rounded-xl
    border border-white/10
    bg-[#0F111A]
    px-4 py-4
    transition
    focus-within:border-[#7A3BFF]
    focus-within:shadow-[0_0_0_1px_rgba(122,59,255,0.4)]
  "
  >
   <textarea
  ref={textareaRef}
  value={prompt}
  onChange={(e) => setPrompt(e.target.value)}
  placeholder="Describe the content you want to go viral..."
  rows={4}
  style={{ fontSize: "16px" }} // ✅ THIS LINE
  className="
    w-full bg-transparent outline-none
    text-white
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
    if (!canAddImages) return
    setOpenReferenceModal(true)
  }}
  className={`
    w-full rounded-xl 
    border border-white/10
    bg-[linear-gradient(180deg,#141722,#0F111A)]
    py-6

    flex flex-col items-center justify-center gap-2

    transition-all duration-200

    ${
      canAddImages
        ? "hover:border-[#7A3BFF]/40 hover:shadow-[0_6px_20px_rgba(122,59,255,0.12)]"
        : "opacity-40 cursor-not-allowed"
    }
  `}
>
  <ImagePlusIcon className="w-5 h-5 text-white/40" />
  <p className="text-sm text-white/50">
    Add visual references
  </p>
</button>



            {/* REFERENCE IMAGES PREVIEW */}
           {selected.length > 0 && (
  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 w-full">
    {selected.map((img) => (
      <div
        key={img.id}
        className="relative aspect-square rounded-xl overflow-hidden border border-white/10"
      >
        <img
  src={img.url}
  loading="lazy"
  decoding="async"
  className="absolute inset-0 w-full h-full object-cover"
/>
        <button
          onClick={() => toggleSelect(img)}
          className="absolute top-2 right-2 bg-black/60 backdrop-blur-md rounded-full p-1.5 border border-white/10"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>
    ))}
  </div>
)}


            {/* SETTINGS ROW */}
                <div
       ref={controlsRef}
        className="grid grid-cols-1  md:grid-cols-3 gap-3 relative"
          >


        <button
  onClick={() => {
    setOpenModel(prev => !prev)
    setOpenSize(false)
    setOpenStyle(false)
  }}
className={`
  md:alive-card 

  group relative
  rounded-xl
  border border-white/10
  bg-[linear-gradient(180deg,#141722,#0F111A)]
  px-4 py-3.5
  text-left

  transition-all  ease-out 

  hover:border-[#7A3BFF]/40
  hover:shadow-[0_6px_20px_rgba(122,59,255,0.15)]

  active:scale-[0.98]

  ${openModel ? " duration-200 border-[#7A3BFF] shadow-[0_0_0_1px_rgba(122,59,255,0.4)] alive-active" : "duration-100"}
`}
>
 <div className="flex justify-between items-center">
  <div className="flex flex-col">
    <span className="text-[11px] text-white/40 tracking-wide uppercase">
      Model
    </span>
    <span className="text-[14px] text-white font-medium">
      {selectedModel.label}
    </span>
  </div>

  <ChevronRight
    className={`
      w-4 h-4 text-white/30
      transition-all duration-200
      ${openModel ? "rotate-90 text-[#7A3BFF]" : "group-hover:translate-x-1"}
    `}
  />
</div>
</button>


<button
  onClick={() => {
    setOpenStyle((prev) => !prev);
    setOpenSize(false);
    setOpenModel(false);
  }}
  className={`
  md:alive-card 

  group relative
  rounded-xl
  border border-white/10
  bg-[linear-gradient(180deg,#141722,#0F111A)]
  px-4 py-3.5
  text-left

  transition-all duration-150

  hover:border-[#7A3BFF]/40
  hover:shadow-[0_6px_20px_rgba(122,59,255,0.15)]

  active:scale-[0.98]

  ${openStyle ? "border-[#7A3BFF] shadow-[0_0_0_1px_rgba(122,59,255,0.4)] alive-active" : ""}
`}
>
  <div className="flex justify-between items-center">
    <div className="flex flex-col">
      <span className="text-[11px] text-white/40 tracking-wide uppercase">
        Style
      </span>
      <span className="text-[14px] text-white font-medium">
        {IMAGE_STYLES[selectedStyle]?.label || selectedStyle}
      </span>
    </div>

    <ChevronRight
      className={`
        w-4 h-4 text-white/30
        transition-all duration-200
        ${openStyle ? "rotate-90 text-[#7A3BFF]" : "group-hover:translate-x-1"}
      `}
    />
  </div>
</button>


              {/* SIZE */}
              <button
  onClick={() => {
    setOpenSize(prev => !prev)
    setOpenModel(false)
    setOpenStyle(false)
  }}
 className={`
  md:alive-card 

  group relative
  rounded-xl
  border border-white/10
  bg-[linear-gradient(180deg,#141722,#0F111A)]
  px-4 py-3.5
  text-left

  transition-all duration-150

  hover:border-[#7A3BFF]/40
  hover:shadow-[0_6px_20px_rgba(122,59,255,0.15)]

  active:scale-[0.98]

  ${openSize ? "border-[#7A3BFF] shadow-[0_0_0_1px_rgba(122,59,255,0.4)] alive-active" : ""}
`}
>
<div className="flex justify-between items-center">
  <div className="flex flex-col">
    <span className="text-[11px] text-white/40 tracking-wide uppercase">
      Size
    </span>
   <span className="text-[14px] text-white font-medium">
  {currentSize.label}
</span>
  </div>

  <ChevronRight
    className={`
      w-4 h-4 text-white/30
      transition-all duration-150
      ${openSize ? "rotate-90 text-[#7A3BFF]" : "group-hover:translate-x-1"}
    `}
  />
</div>
</button>

{selectedModel?.supportsResolutions && (
  <div className="mt-3 flex flex-col gap-2">
    
    {/* LABEL */}
    <span className="text-[11px] text-white/40 uppercase tracking-wide">
      Resolution
    </span>

    {/* OPTIONS */}
    <div className="flex gap-2">
      {selectedModel.resolutions.map((r) => {
        const isActive = selectedResolution === r.key;
        const isBest = r.key === "2k"; // 👈 mark 2K as best

        return (
          <button
            key={r.key}
            onClick={() => setSelectedResolution(r.key)}
            className={`
              relative px-4 py-2 rounded-xl text-sm font-medium
              transition-all duration-200

              ${
                isActive
                  ? "bg-gradient-to-r from-[#7A3BFF] to-[#9D4EDD] text-white shadow-[0_0_20px_rgba(122,59,255,0.45)]"
                  : "bg-white/5 text-white/70 hover:bg-white/10"
              }
            `}
          >
            {r.label}

            {/* 🔥 BEST BADGE */}
           
          </button>
        );
      })}
    </div>
  </div>
)}


              {/* EXISTING DROPDOWNS BELOW (unchanged logic) */}

{openSize && (
  <div
    className="
   fixed 

z-[100]
left-1/2 -translate-x-1/2
top-[18%] md:top-1/2
md:-translate-y-1/2
      w-[92%] md:w-[400px]
      max-h-[60vh]
      bg-[linear-gradient(180deg,rgba(20,23,34,0.98),rgba(12,15,23,0.98))]
border border-white/10
rounded-2xl
shadow-[0_18px_60px_rgba(0,0,0,0.45)]
      p-5
      overflow-y-auto
overscroll-contain
    "
  >
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-white font-medium">Select Size</h3>
      <button
        onClick={() => setOpenSize(false)}
        className="text-white/60 hover:text-white"
      >
        <X className="w-5 h-5" />
      </button>
    </div>

  {selectedModel.supportedSizes.map((size) => {
  const s = IMAGE_SIZES[size] ?? IMAGE_SIZES["1:1"];

  return (
    <button
      key={size}
      onClick={() => {
        setSelectedSize(size);
        setOpenSize(false);
      }}
      className={`w-full px-4 py-3 text-left rounded-xl text-sm flex items-center gap-4
        ${
          size === selectedSize
            ? "bg-[#7A3BFF]/20 border border-[#7A3BFF]"
            : "hover:bg-white/5"
        }
      `}
    >
      {/* Ratio preview */}
      <div className="w-[50px] flex justify-center">
        <div
          className="border border-white/70 rounded-[4px]"
          style={{
            width: `${s.previewW}px`,
            height: `${s.previewH}px`,
          }}
        />
      </div>

      {/* Size label */}
      <span>{s.label}</span>
    </button>
  );
})}
  </div>
)}



{openStyle && (
  <div
    className="
     fixed 

z-[100]
left-1/2 -translate-x-1/2
top-[18%] md:top-1/2
md:-translate-y-1/2
      w-[92%] md:w-[650px]
      max-h-[75vh]
     bg-[linear-gradient(180deg,rgba(20,23,34,0.98),rgba(12,15,23,0.98))]
border border-white/10
rounded-2xl
shadow-[0_18px_60px_rgba(0,0,0,0.45)]
      p-5
      overflow-y-auto
      overscroll-contain
    "
  >
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-white font-medium">Select Style</h3>
      <button
        onClick={() => setOpenStyle(false)}
        className="text-white/60 hover:text-white"
      >
        <X className="w-5 h-5" />
      </button>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {Object.entries(IMAGE_STYLES).map(([key, style]) => (
        <StyleCard
          key={key}
          label={style.label}
          img={style.img}
          active={key === selectedStyle}
          onClick={() => {
            setSelectedStyle(key)
            setOpenStyle(false)
          }}
        />
      ))}
    </div>
  </div>
)}



{openModel && (
  <div
    className="
    fixed 

z-[100]
left-1/2 -translate-x-1/2
top-[18%] md:top-1/2
md:-translate-y-1/2
      w-[92%] md:w-[800px]
      max-h-[75vh]
    bg-[linear-gradient(180deg,rgba(20,23,34,0.98),rgba(12,15,23,0.98))]
border border-white/10
rounded-2xl
shadow-[0_18px_60px_rgba(0,0,0,0.45)]
      p-5
      overflow-y-auto
      overscroll-contain
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
    {Object.entries(MODELS).map(([key, model]) => {
  const isLocked =
    planCode === "free" && key !== "image:flux.base";

  return (
 <div key={key} className="relative">
  {isLocked && (
    <div
      onClick={() => navigate("/workspace/pricing")}
      className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center cursor-pointer hover:bg-black/50 transition"
    >
<div className="flex flex-col items-center gap-2 text-center">

  <span className="text-[10px] uppercase tracking-wider text-purple-300 font-semibold">
    Pro Model
  </span>

  <span className="text-xs text-white/80 bg-white/10 px-3 py-1 rounded-full border border-white/20">
    Upgrade to unlock
  </span>

  <span className="text-[11px] text-purple-300 font-medium transition-all duration-500">
    ⚡ {getRandomTrait(traitIndex + key.length)}
  </span>

</div>
    </div>
  )}

      <ModelCard
        img={model.img}
        label={model.label}
        description={model.description}
        credits={model.credits}
        traits={model.traits}
        active={key === selectedModelKey}
        onClick={() => {
          if (isLocked) return; // 🔒 prevent selection

          setSelectedModelKey(key);
          if (!model.supportedSizes.includes(selectedSize)) {
            setSelectedSize(model.supportedSizes[0]);
          }
          setOpenModel(false);
        }}
      />
    </div>
  );
})}
    </div>
  </div>
)}
            </div>

        

{/* GENERATE SECTION */}
<div className="sticky bottom-0 z-[10] md:relative  backdrop-blur-md ">
  <div
    className="
      pt-3
      pb-[calc(env(safe-area-inset-bottom)+12px)]
  
      border-t border-white/10
    "
  >
    <div className="max-w-[900px] mx-auto flex flex-col gap-3">
      <button
        onClick={handleGenerate}
        disabled={!prompt.trim() || isGenerating}
        className={`
          generate-btn
          relative w-full py-4 rounded-2xl font-semibold text-[15px]
          transition-all duration-300 overflow-hidden
          ${
            !prompt.trim() || isGenerating
              ? "bg-white/5 border border-white/10 text-white/40 cursor-not-allowed"
              : `
                generate-btn-ready
                bg-gradient-to-r from-[#7A3BFF] via-[#9D4EDD] to-[#C77DFF]
                border border-purple-400/30
                hover:scale-[1.02]
                active:scale-[0.98]
                shadow-[0_10px_40px_rgba(122,59,255,0.35)]
                hover:shadow-[0_0_50px_rgba(122,59,255,0.55)]
              `
          }
        `}
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          {isGenerating ? (
            <>
              <Wand2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 opacity-80" />
              Generate
            </>
          )}
        </span>
      </button>

      <div
        className="
          w-full rounded-xl border border-white/10
          bg-[linear-gradient(180deg,#11141D,#0C0F17)]
          px-4 py-3
          flex items-center justify-between
          text-sm
        "
      >
        <span className="text-white/50">Estimated cost</span>
        <span className="text-[#36E28F] font-medium">
          {estimatedCredits} credits
        </span>
      </div>
    </div>
  </div>
</div>
          </div>
        </div>
      </div>
    </div>

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
{errorToast && (
  <ErrorToast
    message={errorToast}
    onClose={() => setErrorToast(null)}
  />
)}

{limitToastOpen && (
  <LimitReachedToast
    resetInDays={6} // later you can pass dynamic from eligibility
    onClose={() => setLimitToastOpen(false)}
  />
)}

{progressToast !== null && (
  <ProgressToast
    remaining={progressToast}
    onClose={() => setProgressToast(null)}
  />
)}


<GuestGenerateModal
  open={guestModalOpen}
  onClose={() => setGuestModalOpen(false)}
  onSignup={() => navigate("/signup")}
/>

  </section>
)

};
