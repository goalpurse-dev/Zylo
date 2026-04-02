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

useEffect(() => {
  const isOpen = openModel || openStyle || openSize;

  if (isOpen) {
    const scrollY = window.scrollY;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  } else {
    const scrollY = document.body.style.top;

    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";

    if (scrollY) {
      window.scrollTo(0, parseInt(scrollY || "0") * -1);
    }
  }
}, [openModel, openStyle, openSize]);

const selectedModel = MODELS[selectedModelKey];
const estimatedCredits = selectedModel?.supportsResolutions
  ? selectedModel.resolutions.find(r => r.key === selectedResolution)?.credits ?? selectedModel.credits
  : selectedModel?.credits ?? 0;
  const textareaRef = useRef(null);



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
<section className="">

 <div
  onClick={() => {
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
  md:shadow-[0_12px_40px_rgba(0,0,0,0.25)]
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
    md:shadow-[0_12px_40px_rgba(0,0,0,0.35)]
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
              md:shadow-[0_0_25px_rgba(122,59,255,0.45)]
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
<PromptInput prompt={prompt} setPrompt={setPrompt} />



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


            {/* SETTINGS ROW */}
                <div
       ref={controlsRef}
        className="grid grid-cols-1  md:grid-cols-3 gap-3 relative"
          >




  {/* MODEL */}
<ModelSelector
  selectedModel={selectedModel}
  openModel={openModel}
  setOpenModel={() => {
    setOpenModel(prev => !prev)
    setOpenSize(false)
    setOpenStyle(false)
  }}
/>

  {/* STYLE */}
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

  {/* SIZE */}
  <SizeSelector
  currentSize={currentSize}
  openSize={openSize}
  setOpenSize={() => {
    setOpenSize(prev => !prev)
    setOpenModel(false)
    setOpenStyle(false)
  }}
/>



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
  style={{
  paddingBottom: "env(safe-area-inset-bottom)"
}}
    className={`
fixed z-[100]
left-1/2 -translate-x-1/2
top-[18%] md:top-1/2
md:-translate-y-1/2

w-[92%] md:w-[420px]
max-h-[calc(100dvh-180px-env(safe-area-inset-bottom))]
pb-[env(safe-area-inset-bottom)]


bg-[linear-gradient(180deg,rgba(22,26,38,0.85),rgba(14,17,28,0.85))]
bg-[#0f111a]/95
border border-white/10
rounded-2xl
shadow-[0_25px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)]

p-5
overflow-y-auto overscroll-contain  touch-none
 scrollbar-thin scrollbar-thumb-white/10

transition-all duration-300 ease-out

${openSize 
  ? "opacity-100 scale-100 translate-y-0" 
  : "opacity-0 scale-95 translate-y-4 pointer-events-none"}
`}
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
  style={{
  paddingBottom: "env(safe-area-inset-bottom)"
}}
className={`
fixed z-[100]
left-1/2 -translate-x-1/2
top-[18%] md:top-1/2
md:-translate-y-1/2

w-[92%] md:w-[800px]
max-h-[calc(100dvh-180px-env(safe-area-inset-bottom))]
pb-[env(safe-area-inset-bottom)]

bg-[linear-gradient(180deg,rgba(22,26,38,0.85),rgba(14,17,28,0.85))]
bg-[#0f111a]/95
border border-white/10
rounded-2xl
md:shadow-[0_25px_80px_rgba(0,0,0,0.6)]

p-5
overflow-y-auto overscroll-contain touch-none scrollbar-thin scrollbar-thumb-white/10

transition-all duration-300 ease-out

${openStyle 
  ? "opacity-100 scale-100 translate-y-0" 
  : "opacity-0 scale-95 translate-y-4 pointer-events-none"}
`}
  >
    <div className="flex justify-between items-center mb-4">
     <div className="flex flex-col">
  <h3 className="text-white font-semibold text-lg tracking-tight">
    Select Style
  </h3>
  <span className="text-xs text-white/40">
    Choose how your image should look
  </span>
</div>
      <button
        onClick={() => setOpenStyle(false)}
        className="text-white/60 hover:text-white"
      >
        <X className="w-5 h-5" />
      </button>
    </div>

    <div className="pointer-events-none absolute inset-0 rounded-2xl">
  <div className="absolute inset-x-0 top-0 h-[120px] bg-gradient-to-b from-white/[0.04] to-transparent" />
  <div className="absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-t from-black/30 to-transparent" />
</div>

    <div className="grid grid-cols-2 md:grid-cols-3 gap-5 md:gap-6"
  >
      
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
w-full mt-4 py-2 
rounded-xl
bg-white/5 border border-white/10
text-sm text-white/70
hover:bg-white/10
transition
"
  >
    Show all styles
  </button>
)}
  </div>
)}



{openModel && (
  <div
  style={{
  paddingBottom: "env(safe-area-inset-bottom)"
}}
    className="
      fixed z-[100]
      left-1/2 -translate-x-1/2
      top-[18%] md:top-1/2
      md:-translate-y-1/2

      w-[92%] md:w-[700px]
     max-h-[calc(100dvh-180px-env(safe-area-inset-bottom))]
pb-[env(safe-area-inset-bottom)]

      rounded-2xl
      border border-white/10

      bg-[linear-gradient(180deg,rgba(22,26,38,0.85),rgba(14,17,28,0.85))]
bg-[#0f111a]/95
    md:shadow-lg

 

      flex flex-col
      overflow-hidden
    "
  >

    {/* 🔥 FIXED GRADIENT OVERLAY (NOW WORKS PERFECTLY) */}
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute inset-x-0 top-0 h-[120px] bg-gradient-to-b from-white/[0.04] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-t from-black/20 to-transparent" />
    </div>

    {/* HEADER (STATIC) */}
    <div className="flex justify-between items-center p-4 border-b border-white/10 relative z-20">
      <h3 className="text-white font-medium">Select Model</h3>
      <button onClick={() => setOpenModel(false)}>
        <X className="w-5 h-5 text-white/60 hover:text-white" />
      </button>
    </div>

    {/* 🔥 SCROLL AREA ONLY */}
   <div className="overflow-y-auto overscroll-contain touch-none px-3 py-3 relative z-20 scrollbar-thin scrollbar-thumb-white/10">

      <div className="flex flex-col gap-[2px]">
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
        ? "bg-white/10 border border-[#7A3BFF] "
        : isLocked
          ? "bg-white/[0.02] border border-white/[0.05]"
          : "hover:bg-white/[0.04] border border-transparent"
    } 
  `}
>
  {/* 🔒 LOCK OVERLAY */}
{isLocked && (
  <div className="absolute inset-0 rounded-xl bg-black/40  flex items-center justify-center">
    
   <div
  className="
    px-4 py-1.5 rounded-md
    text-[11px] font-semibold

    bg-gradient-to-r from-[#7A3BFF] to-[#9D4EDD]
    text-white
    md:shadow-lg
    hover:brightness-110
    hover:scale-[1.05]

    transition-all duration-150
  "
>
  Upgrade to unlock
</div>

  </div>
)}

  {/* CONTENT (DIMMED WHEN LOCKED) */}
  <div className={`flex items-center justify-between w-full ${isLocked ? "opacity-40" : ""}`}>
    
    {/* LEFT SIDE */}
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
      <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
        <span className="text-xs text-white/40">
          More models coming soon...
        </span>

        <button
          onClick={() => navigate("/workspace/pricing")}
          className="text-xs px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition"
        >
          Unlock Pro Models
        </button>
      </div>

    </div>
  </div>
)}
            </div>

        


{/* GENERATE SECTION (FIXED ABOVE NAV) */}
<div
  className="fixed left-0 right-0 z-[90] md:static"
  style={{
    bottom: "calc(68px + env(safe-area-inset-bottom))"
  }}
>
  {/* FULL WIDTH BACKGROUND */}
  <div className="w-full bg-[#191B1C] border-t border-white/5 px-4 pt-3 pb-3 backdrop-blur-xl">
    
    {/* CENTERED BUTTON */}
    <div className="max-w-[900px] mx-auto">
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
