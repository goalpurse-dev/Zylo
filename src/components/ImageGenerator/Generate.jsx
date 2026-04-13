import {  useState, useMemo } from "react";
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
import PromptInput from "./PromptInput";
import GenerateButton from "./GenerateButton";
import ModelSelector from "./ModelSelector";
import StyleSelector from "./StyleSelector";
import SizeSelector from "./SizeSelector";
import OutputSelector from "./OutputSelector";


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


const glassBtn = `
  bg-white/[0.03]
  border border-white/[0.06]
  backdrop-blur-xl
  hover:bg-white/[0.06]
  hover:border-white/[0.12]
  transition-all duration-200
  rounded-xl
`;

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
     group relative rounded-2xl overflow-hidden h-[160px]
      transition-all duration-300 ease-out

      ${
        active
          ? "scale-[1.05] border-2 border-[#7A3BFF] "
          : "hover:scale-[1.03] md:hover:shadow-[0_0_25px_rgba(122,59,255,0.25)]"
      }
    `}
  >

    
    {/* 🔥 GRADIENT BORDER */}
    <div
      className={`
        absolute inset-0 rounded-2xl p-[1px]
        ${
          active
            ? " scale-[1.04] shadow-lg bg-gradient-to-r from-[#7A3BFF] via-[#9D4EDD] to-[#C77DFF]"
            : "bg-white/10 group-hover:bg-gradient-to-r group-hover:from-[#7A3BFF]/40 group-hover:to-[#9D4EDD]/40"
        }
      `}
    >
      {/* INNER CARD */}
      <div className="relative w-full h-[160px] rounded-2xl overflow-hidden bg-[#0B0E1A]">
        
        {/* IMAGE */}
        <img
          src={img}
          loading="lazy"
          decoding="async"
          className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />

        {/* DARK OVERLAY */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* LABEL */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="text-white text-sm font-medium tracking-wide">
            {label}
          </div>
        </div>

        {/* ACTIVE BADGE */}
        {active && (
         <div className="
absolute top-2 right-2 
px-2 py-1 
text-[10px] 
rounded-md 
bg-gradient-to-r from-[#7A3BFF] to-[#9D4EDD]
text-white 

">
  Selected
</div>
        )}
      </div>
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

const OutputPanel = ({
  selectedModel,
  selectedSize,
  setSelectedSize,
  selectedResolution,
  setSelectedResolution,
  close, // 🔥 ADD THIS
}) => (
  <div className="space-y-5">
    
    {/* ASPECT RATIO */}
  <div>
  <span className="text-sm text-white/70">Aspect ratio</span>

  <div className="
    mt-3
    flex items-center
    bg-white/5
    border border-white/10
    rounded-xl
    p-1
    w-full
    gap-1
  ">
    {selectedModel.supportedSizes.map((size) => {
      const s = IMAGE_SIZES[size];
      const isActive = selectedSize === size;

      return (
        <button
          key={size}
          onClick={() => {
  setSelectedSize(size)
  close?.() // 🔥 CLOSE DROPDOWN
}}
          className={`
            flex-1 flex flex-col items-center justify-center
            py-2 rounded-lg text-xs font-medium
            transition-all duration-200

            ${
              isActive
                ? "bg-white/15 text-white shadow-inner"
                : "text-white/50 hover:text-white hover:bg-white/5"
            }
          `}
        >
          {/* ICON */}
          <div
            className="border border-white/60 rounded-sm mb-1"
            style={{
              width: s.previewW,
              height: s.previewH,
              maxWidth: 22,
              maxHeight: 22,
            }}
          />

          {/* LABEL */}
          {s.label}
        </button>
      );
    })}
  </div>
</div>

    {/* RESOLUTION */}
    {selectedModel?.supportsResolutions && (
     <div>
  <span className="text-sm text-white/70">Resolution</span>

  <div className="
    mt-3
    flex items-center
    bg-white/5
    border border-white/10
    rounded-xl
    p-1
    w-full
  ">
    {selectedModel.resolutions.map((r) => {
      const isActive = selectedResolution === r.key;

      return (
        <button
          key={r.key}
          onClick={() => {
  setSelectedResolution(r.key)
  close?.()
}}
          className={`
            flex-1 py-2 rounded-lg text-sm font-medium
            transition-all duration-200

            ${
              isActive
                ? "bg-white/15 text-white shadow-inner"
                : "text-white/50 hover:text-white hover:bg-white/5"
            }
          `}
        >
          {r.label}
        </button>
      );
    })}
  </div>
</div>
    )}
  </div>
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
          ? "border-[#7A3BFF] bg-[#7A3BFF]/10 "
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






export default function Generate({ prompt, setPrompt, onJobCreated, setActiveJobId, hasResults }) {

const [freeRemaining, setFreeRemaining] = useState(null);
const [toast, setToast] = useState(null);
const [errorToast, setErrorToast] = useState(null);
const location = useLocation();
const navigate = useNavigate();
const [progressToast, setProgressToast] = useState(null);
const [settingsOpen, setSettingsOpen] = useState(false);
const [activeMenu, setActiveMenu] = useState(null); 
const [limitToastOpen, setLimitToastOpen] = useState(false);
const [resetAt, setResetAt] = useState(null);
const panelRef = useRef(null);
 const [selectedModelKey, setSelectedModelKey] = useState("image:nano.2")
const [selectedSize, setSelectedSize] = useState("1:1");
const [selectedResolution, setSelectedResolution] = useState("2k");
const modelEntries = useMemo(() => Object.entries(MODELS), []);
const [showAll, setShowAll] = useState(false);




const currentSize =
  IMAGE_SIZES[selectedSize] ?? IMAGE_SIZES["1:1"];

  const [localPrompt, setLocalPrompt] = useState(prompt)

useEffect(() => {
  const t = setTimeout(() => {
    setPrompt(localPrompt)
  }, 150)

  return () => clearTimeout(t)
}, [localPrompt])

const [openSize, setOpenSize] = useState(false);
const [openStyle, setOpenStyle] = useState(false);
const [openModel, setOpenModel] = useState(false);
const isSelectorOpen = openModel || openStyle || openSize;



const selectedModel = MODELS[selectedModelKey];
const estimatedCredits = selectedModel?.supportsResolutions
  ? selectedModel.resolutions.find(r => r.key === selectedResolution)?.credits ?? selectedModel.credits
  : selectedModel?.credits ?? 0;
  const textareaRef = useRef(null);

const isDesktop = window.innerWidth >= 768;

const controlsRef = useRef(null);
const [isGenerating, setIsGenerating] = useState(false);
const [planCode, setPlanCode] = useState(null);
const [user, setUser] = useState(null);
const [guestModalOpen, setGuestModalOpen] = useState(false);

const maxRefImages = selectedModel.maxReferenceImages;
const canAddImages = maxRefImages > 0;
const [openReferenceModal, setOpenReferenceModal] = useState(false);
const STYLE_KEYS = Object.keys(IMAGE_STYLES);

const generateRef = useRef(null);
const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

useEffect(() => {
  const handleResize = () => {
    setIsMobile(window.innerWidth < 768);
  };

  window.addEventListener("resize", handleResize);
  return () => window.removeEventListener("resize", handleResize);
}, []);

const stylesToRender =
  isMobile && !showAll
    ? Object.entries(IMAGE_STYLES).slice(0, 6)
    : Object.entries(IMAGE_STYLES);
const traitRef = useRef(0)


useEffect(() => {
  const interval = setInterval(() => {
    traitRef.current++
  }, 2000)

  return () => clearInterval(interval)
}, [])

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
    const { data: auth } = await supabase.auth.getSession();
    const uid = auth?.session?.user?.id;
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
  const { data: authData } = await supabase.auth.getSession();
  const user = authData?.session?.user;

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
  const init = async () => {
    const { data: auth } = await supabase.auth.getSession();
    const currentUser = auth?.session?.user;
    setUser(currentUser);
    if (!currentUser) return;

    // Fetch plan + eligibility in parallel — saves one full network RTT
    const [profileResult, eligResult] = await Promise.all([
      supabase.from("profiles").select("plan_code").eq("id", currentUser.id).single(),
      supabase.functions.invoke("check-image-eligibility"),
    ]);

    const code = (profileResult.data?.plan_code || "free").toLowerCase();
    setPlanCode(code);

    if (code === "free") {
      setSelectedModelKey("image:flux.base");
      if (!eligResult.error && eligResult.data) {
        setFreeRemaining(eligResult.data.remaining);
        if (eligResult.data.reset_at) setResetAt(eligResult.data.reset_at);
      }
    }
  };

  init();

  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) init();
  });

  return () => listener.subscription.unsubscribe();
}, []);

useEffect(() => {
  const handleClickOutside = (e) => {
    if (!controlsRef.current) return;

    if (e.target.closest("[data-selector-portal]")) return;
    if (controlsRef.current.contains(e.target)) return;

    setOpenSize(false);
    setOpenStyle(false);
    setOpenModel(false);
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
    document.addEventListener("click", handleClickOutside);
  }

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, [settingsOpen]);

 return (
<section className="w-full md:h-screen h-auto flex flex-col bg-[#090A0A]">

<div
  onClick={(e) => {
    // 🔥 DO NOT close if clicking inside dropdown
    if (e.target.closest("[data-selector-portal]")) return;

    setOpenModel(false)
    setOpenStyle(false)
    setOpenSize(false)
  }}
  className={`
    fixed inset-0 z-[100]
    bg-black/60
    transition-opacity duration-150
    ${
      openModel || openStyle || openSize
        ? "opacity-100"
        : "opacity-0 pointer-events-none"
    }
  `}
  style={{
    pointerEvents: openModel || openStyle || openSize  ? "auto" : "none",
  }}
/>


    {/* Background */}
<div className="relative w-full md:flex-1 flex flex-col">
    


     

      {/* CONTENT */}
<div
  className={`
   flex flex-col w-full relative md:flex-1 pt-2
    ${!hasResults ? "md:min-h-[300px]" : ""}
  `}
>



    <div className="w-full flex-1  ">
    <div
  className="
w-full h-full flex flex-col
 pb-[110px] md:pb-6
  rounded-[22px]
 bg-[#191B1C]
border border-white/5
shadow-[0_10px_40px_rgba(0,0,0,0.4)]
  p-5 md:p-6

 space-y-3 lg:space-y-2

"
>

         {/* MODE SELECTOR */}


<div className="w-full">
  <div
    className="
      relative flex w-full p-1
      rounded-xl
      bg-[#16181A]
      border border-white/5
      overflow-hidden
    "
  >
    {/* 🔥 SLIDING ACTIVE BACKGROUND */}
    <div
      className={`
        absolute top-1 bottom-1 w-1/2 rounded-lg
        transition-all duration-300
        ${
          location.pathname === "/workspace/image-generator"
            ? "left-1"
            : "left-[calc(50%-2px)]"
        }
        bg-[#16181A]
        overflow-hidden
      `}
    >
      <div className="mode-glow" />
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
        className="
  relative flex-1 py-1
  flex flex-col items-center justify-center gap-[1px] mb-1
  z-10
"
        >
          {/* ✅ IMAGE ICON (FIXED) */}
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

          {/* TEXT */}
          <span
            className={`
              text-xs font-medium
              transition-all duration-200
              ${
                isActive
                  ? "text-white"
                  : "text-white/50"
              }
            `}
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
  <span className={freeRemaining <= 1 ? "text-[#E879F9]" : freeRemaining <= 3 ? "text-[#C084FC]" : "text-white/40"}>
    {freeRemaining} / 10 free this month
  </span>
) : (
  <>
    <span className="text-[#E879F9]">
      Monthly limit reached
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
      Upgrade
    </button>
  </>
)}

</div>
)}

{/* 🔥 MODEL SELECTOR (STANDALONE ROW) */}
<div className="w-full">
  <ModelSelector
    selectedModel={selectedModel}
    openModel={openModel}
    setOpenModel={() => {
      setOpenModel(prev => !prev)
      setOpenSize(false)
      setOpenStyle(false)
    }}
  />
</div>

          {/* PROMPT */}
<PromptInput prompt={prompt} setPrompt={setPrompt} />



{/* IMPORT IMAGE */}
<button
  disabled={!canAddImages}
  onClick={() => {
    if (!canAddImages) return
    setOpenReferenceModal(true)
  }}
  className={`
    relative w-full rounded-xl overflow-hidden

    border border-white/5
    bg-[#16181A]

    py-5

    flex flex-col items-center justify-center gap-2

    transition-all duration-200

    ${
      canAddImages
        ? "hover:border-[#7A3BFF]/40 hover:bg-[#181A22]"
        : "opacity-40 cursor-not-allowed"
    }
  `}
>

  {/* 🔥 SAME STRUCTURE AS MODE SELECTOR */}
  <div
    className={`
      absolute inset-1 rounded-lg transition-all duration-300

     ${canAddImages ? "opacity-100" : "opacity-0"}
    `}
  >
    <div className="mode-glow" />
  </div>

  {/* CONTENT */}
<div className="relative z-10 flex flex-col items-center justify-center text-center ">
<img
  src="/icons/reference.png"
  alt="Reference"
  className={`
    w-12 h-12 object-contain scale-125

    transition-all duration-200

    ${
      canAddImages
        ? "opacity-95 scale-110 drop-shadow-[0_0_20px_rgba(168,85,247,0.7)]"
        : "opacity-40"
    }
  `}
/>

  <p
  className={`
    text-sm font-medium transition-all duration-200
    mt-[-2px]

    ${
      selected.length > 0
        ? "text-white"
        : "text-white/60"
    }
  `}
>
      {selected.length > 0
        ? `${selected.length} reference${selected.length > 1 ? "s" : ""} added`
        : "Add visual references"}
    </p>

  </div>
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
  className="absolute inset-0 w-full h-full object-cover
  transition-all duration-500 
md:group-hover:scale-110
md:group-hover:brightness-110

"
/>
        <button
          onClick={() => toggleSelect(img)}
          className="absolute top-2 right-2 bg-black/80 rounded-full p-1.5 border border-white/10"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>
    ))}
  </div>
)}


<div className="w-full">
  <StyleSelector
    selectedStyle={selectedStyle}
    styles={IMAGE_STYLES}
    openStyle={openStyle}
    setOpenStyle={() => {
      setOpenStyle(prev => !prev)
      setOpenModel(false)
      setOpenSize(false)
    }}
  />
</div>

            {/* SETTINGS ROW */}
                <div
       ref={controlsRef}
        className="grid grid-cols-1   gap-3 relative"
          >





  {/* STYLE */}


  {/* SIZE */}
<OutputSelector
  currentSize={currentSize}
  selectedResolution={selectedResolution}
  open={openSize}
  setOpen={setOpenSize}
  selectedModel={selectedModel}
>
 <OutputPanel
  selectedModel={selectedModel}
  selectedSize={selectedSize}
  setSelectedSize={setSelectedSize}
  selectedResolution={selectedResolution}
  setSelectedResolution={setSelectedResolution}
  close={() => setOpenSize(false)} // 🔥 ADD THIS
/>
</OutputSelector>


              {/* EXISTING DROPDOWNS BELOW (unchanged logic) */}




{openStyle && (
  <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">

    <div
      className="
        w-full max-w-[800px]
        max-h-[85vh]

        bg-[linear-gradient(180deg,rgba(22,26,38,0.95),rgba(14,17,28,0.95))]
        border border-white/10
        rounded-2xl
        shadow-[0_25px_80px_rgba(0,0,0,0.6)]

        p-5
        overflow-y-auto
        relative
      "
    >
      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex flex-col">
          <h3 className="text-white font-semibold text-lg">Select Style</h3>
          <span className="text-xs text-white/40">
            Choose how your image should look
          </span>
        </div>

        <button onClick={() => setOpenStyle(false)}>
          <X className="w-5 h-5 text-white/60 hover:text-white" />
        </button>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5 md:gap-6">
        {stylesToRender.map(([key, style]) => (
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

      {isMobile && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="
            w-full mt-4 py-2 rounded-xl
            bg-white/5 border border-white/10
            text-sm text-white/70
            hover:bg-white/10 transition
          "
        >
          Show all styles
        </button>
      )}
    </div>
  </div>
)}



{openModel && (
  <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">

    <div
      style={{
        paddingBottom: "env(safe-area-inset-bottom)"
      }}
      className="
        w-full max-w-[700px]
        max-h-[85vh]

        rounded-2xl
        border border-white/10

        bg-[linear-gradient(180deg,rgba(22,26,38,0.95),rgba(14,17,28,0.95))]
        bg-[#0f111a]/95
        shadow-[0_25px_80px_rgba(0,0,0,0.6)]

        flex flex-col
        overflow-hidden
        relative
      "
    >

      {/* 🔥 GRADIENT OVERLAY */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute inset-x-0 top-0 h-[120px] bg-gradient-to-b from-white/[0.04] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      {/* HEADER */}
      <div className="flex justify-between items-center p-4 border-b border-white/10 relative z-20">
        <h3 className="text-white font-medium">Select Model</h3>
        <button onClick={() => setOpenModel(false)}>
          <X className="w-5 h-5 text-white/60 hover:text-white" />
        </button>
      </div>

      {/* SCROLL AREA */}
      <div className="overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-white/10 relative z-20">

        <div className="flex flex-col gap-[2px] p-3">
          {modelEntries.map(([key, model]) => {
            const isActive = key === selectedModelKey
            const isLocked =
              planCode === "free" && key !== "image:flux.base"

            return (
              <button
                key={key}
                onClick={() => {
                  if (isLocked) {
                    navigate("/workspace/pricing")
                    return
                  }

                  setSelectedModelKey(key)
                  setOpenModel(false)
                }}
                className={`
                  relative w-full flex items-center justify-between
                  px-3 py-2.5 rounded-xl
                  transition-all duration-150

                  ${
                    isActive
                      ? "bg-white/10 border border-[#7A3BFF]"
                      : isLocked
                        ? "bg-white/[0.02] border border-white/[0.05]"
                        : "hover:bg-white/[0.04] border border-transparent"
                  }
                `}
              >

                {/* 🔒 LOCK OVERLAY */}
                {isLocked && (
                  <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center">
                    <div className="
                      px-4 py-1.5 rounded-md
                      text-[11px] font-semibold
                      bg-gradient-to-r from-[#7A3BFF] to-[#9D4EDD]
                      text-white
                      md:shadow-lg
                      hover:brightness-110
                      hover:scale-[1.05]
                      transition-all duration-150
                    ">
                      Upgrade to unlock
                    </div>
                  </div>
                )}

                {/* CONTENT */}
                <div className={`flex items-center justify-between w-full ${isLocked ? "opacity-40" : ""}`}>
                  
                  <div className="flex items-center gap-3 min-w-0">
                    
                    <div className="w-10 h-10 flex items-center justify-center rounded-md bg-white/[0.04] border border-white/10 flex-shrink-0">
                      <img
                        src={model.img}
                        className="w-10 h-10 object-contain opacity-90"
                      />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-medium truncate">
                          {model.label}
                        </span>

                        {key === "image:nano.2" && (
                          <span className="text-[10px] px-2 py-[2px] rounded-md bg-purple-500/20 text-purple-300">
                            Best
                          </span>
                        )}

                        {key === "image:seedream4.0" && (
                          <span className="text-[10px] px-2 py-[2px] rounded-md bg-green-500/20 text-green-300">
                            New
                          </span>
                        )}
                      </div>

                      <span className="text-xs text-white/40 truncate">
                        {model.description}
                      </span>

                      {model.traits?.length > 0 && (
                        <div className="hidden md:flex gap-1 mt-1">
                          {model.traits.slice(0, 2).map((t) => (
                            <span
                              key={t}
                              className="text-[10px] px-2 py-[2px] rounded-md bg-white/[0.06] text-white/50"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </button>
            )
          })}
        </div>

      {/* FOOTER */}
   <div className="
  mt-4
  pt-4
  pb-[calc(12px+env(safe-area-inset-bottom))]
  px-4

  border-t border-white/10

  flex items-center justify-between
  gap-3

  bg-gradient-to-t from-[#0f111a] to-transparent
">
  <span className="text-xs text-white/40">
    More models coming soon...
  </span>

  <button
    onClick={() => navigate("/workspace/pricing")}
    className="
      text-xs px-3 py-1.5 rounded-md
      bg-white/5 border border-white/10
      text-white/70

      hover:bg-white/10
      transition-all duration-200
    "
  >
    Unlock Pro Models
  </button>
</div>
 </div>
    </div>
  </div>
)}
            </div>

        



{/* GENERATE SECTION (FIXED ABOVE NAV) */}
<div
  className="fixed left-0 right-0 z-[90] md:static pointer-events-none"
  style={{
    bottom: "calc(70px + env(safe-area-inset-bottom))"
  }}
>
  <div className="pointer-events-auto">
    <div className="w-full bg-[#191B1C] border-t border-white/5 md:px-0 px-4 pt-3 pb-3 backdrop-blur-xl">
     <div className="w-full md:max-w-none md:mx-0 max-w-[900px] mx-auto">
        <GenerateButton
          onClick={handleGenerate}
          disabled={!prompt.trim()}
          isGenerating={isGenerating}
          estimatedCredits={estimatedCredits}
        />
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
    resetAt={resetAt}
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
