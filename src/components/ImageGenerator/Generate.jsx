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


import CreditLogo from "../../assets/toolshell/credit.png"

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
      relative flex flex-col gap-2 rounded-sm overflow-hidden transition
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

const AspectRatioRow = ({ label, width, height, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-4 px-4 py-3 w-full 
               hover:bg-white/5 transition text-left"
  >
    {/* FIXED PREVIEW COLUMN */}
    <div className="w-[50px] flex justify-center">
      <div
        className="border border-white/70 rounded-sm"
        style={{ width, height }}
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
    className={`
      relative w-full rounded-sm transition text-left
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
        className="w-10 h-10 rounded-sm object-cover  p-1 flex-shrink-0"
      />
       <div className="text-white font-medium leading-tight">
          {label}
        </div>
        </div>

      {/*  DESCRIPTION */}
     
       

        {description && (
          <div className="text-white/50 text-xs leading-snug mt-0.5">
            {description}
          </div>
        )}
    

    {/* TRAITS */}
    {traits.length > 0 && (
      <div className="flex flex-wrap gap-2 mt-2">
        {traits.map((t) => (
          <span
            key={t}
            className="text-[11px] px-3 py-1 rounded-sm bg-white/10 text-white/70"
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
const location = useLocation();
const navigate = useNavigate();
const [progressToast, setProgressToast] = useState(null);
const [settingsOpen, setSettingsOpen] = useState(false);
const [activeMenu, setActiveMenu] = useState(null); 
const [limitToastOpen, setLimitToastOpen] = useState(false);
const panelRef = useRef(null);
 const [selectedModelKey, setSelectedModelKey] = useState("image:nano");
const [selectedSize, setSelectedSize] = useState("1:1");

const selectedModel = MODELS[selectedModelKey];
  const textareaRef = useRef(null);
const [openSize, setOpenSize] = useState(false);
const [openStyle, setOpenStyle] = useState(false);
const [openModel, setOpenModel] = useState(false);
const controlsRef = useRef(null);
const [isGenerating, setIsGenerating] = useState(false);
const [planCode, setPlanCode] = useState(null);
const [user, setUser] = useState(null);


const maxRefImages = selectedModel.maxReferenceImages;
const canAddImages = maxRefImages > 0;
const [openReferenceModal, setOpenReferenceModal] = useState(false);
const STYLE_KEYS = Object.keys(IMAGE_STYLES);


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
  setToast({
    message: "Create an account to generate images.",
    type: "info",
  });

  setTimeout(() => {
    navigate("/signup");
  }, 1200);

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

    const job = await generateImageFromUI({
      modelKey: selectedModelKey,
      prompt: prompt.trim(),
      style: selectedStyle,
      size: selectedSize,
      refImages: selected.map((x) => x.url),
    });

    setActiveJobId?.(job.id);
    onJobCreated?.(job);

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
  } finally {
    setIsGenerating(false);
  }
};

useEffect(() => {
  const modalOpen = openModel || openStyle || openSize;

  if (modalOpen) {
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none"; // important for iOS
  } else {
    document.body.style.overflow = "";
    document.body.style.touchAction = "";
  }

  return () => {
    document.body.style.overflow = "";
    document.body.style.touchAction = "";
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
  <section className="pb-[env(safe-area-inset-bottom)]">

    {(openModel || openStyle || openSize) && (
  <div
    onClick={() => {
      setOpenModel(false)
      setOpenStyle(false)
      setOpenSize(false)
    }}
    className="fixed inset-0 bg-black/0 backdrop-blur-sm z-40"
  />
)}


    {/* Background */}
    <div className="relative w-full ">


     

      {/* CONTENT */}
      <div className="flex flex-col items-center w-full relative  pt-2 ">



        <div className="w-full flex justify-center mt-4 px-4">
          <div className="w-full max-w-[900px] bg-[#151822] border border-[#1F2230] rounded-sm p-6 shadow-2xl space-y-6">

         {/* MODE SELECTOR */}
<div className="grid grid-cols-3 gap-1">
  {[
    {
 
      icon: Image,
      base: "from-purple-500/10 via-purple-500/10",
      active: "from-purple-500/40 via-purple-500/20",
      path: "/workspace/image-generator",
    },
    {
 
      icon: VideoIcon,
      base: "from-indigo-500/10 via-indigo-500/10",
      active: "from-indigo-500/40 via-indigo-500/10",
      path: "/workspace/video-generator",
    },
    {
     
      icon: Folder,
      base: "from-emerald-500/10 via-emerald-500/10",
      active: "from-emerald-500/40 via-emerald-500/10",
      path: "/workspace/creations",
    },
  ].map((item) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;

    return (
      <button
        key={item.label}
        onClick={() => navigate(item.path)}
        className={`
          relative overflow-hidden flex flex-col items-center justify-center
          rounded-sm py-1 border transition-all duration-300
          ${
            isActive
              ? "border-[#7A3BFF] shadow-[0_0_14px_rgba(122,59,255,0.35)]"
              : "border-[#232635] hover:border-white/20"
          }
          bg-[#141722]
        `}
      >
        {/* Gradient Overlay */}
        <div
          className={`
            absolute inset-0 bg-gradient-to-t 
            ${isActive ? item.active : item.base}
            to-transparent
            transition-all duration-300
          `}
        />

        <Icon className="w-4 h-4 mb-1 text-white relative z-10" />
        <p className="text-sm text-white relative z-10">
          {item.label}
        </p>
      </button>
    );
  })}
</div>



{/* FREE PLAN INFO */}
{user && planCode === "free" && freeRemaining !== null && (
  <div className="mt-3 text-center text-sm font-medium text-yellow-400">
    {freeRemaining > 0
      ? `You have ${freeRemaining} free image generation${
          freeRemaining === 1 ? "" : "s"
        } left this week`
      : "Free limit reached. Upgrade or wait for reset."}
  </div>
)}

          {/* PROMPT */}
<div
  className="relative rounded-sm p-[1px]
             bg-gradient-to-br from-purple-500/20 to-transparent
             hover:from-purple-500/30 transition-all duration-300"
>
  <div
    className="bg-[#1A1E2A] border border-gray-800
               rounded-sm p-5 transition-all duration-300
               hover:border-purple-500/40
               focus-within:border-purple-500/60
               focus-within:shadow-lg
               focus-within:shadow-purple-500/20"
  >
    <textarea
      ref={textareaRef}
      value={prompt}
      onChange={(e) => setPrompt(e.target.value)}
      placeholder="Describe what you want to create..."
      rows={4}   // 🔥 taller
      className="w-full min-h-[120px]   // 🔥 force visual height
                 bg-transparent outline-none
                 text-sm text-white
                 placeholder-[#6B7280]
                 resize-none"
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
    w-full rounded-sm border-2 border-dashed
    border-[#2A2E3C]
    bg-[#141722]
    py-6
    flex flex-col items-center justify-center
    transition-all duration-300
    ${
      canAddImages
        ? "hover:border-purple-500/40 hover:bg-[#171A24] cursor-pointer"
        : "opacity-40 cursor-not-allowed"
    }
  `}
>
  <ImagePlusIcon className="w-6 h-6 text-[#9CA3AF] mb-2" />
  <p className="text-sm text-[#9CA3AF]">
    Add visual references
  </p>
</button>



            {/* REFERENCE IMAGES PREVIEW */}
           {selected.length > 0 && (
  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 w-full">
    {selected.map((img) => (
      <div
        key={img.id}
        className="relative aspect-square rounded-sm overflow-hidden"
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
    group
    relative
    bg-[#1A1E2A]
    border border-[#232635]
    rounded-sm
    px-4 py-3
    text-left
    transition-all duration-200
    hover:border-purple-500/40
    hover:shadow-md hover:shadow-purple-500/10
    active:scale-[0.98]
    ${openModel ? "border-purple-500 shadow-md shadow-purple-500/20" : ""}
  `}
>
  <div className="flex justify-between items-center">
    <div>
      <p className="text-xs text-white/50">Model</p>
      <p className="text-sm text-white font-medium">
        {selectedModel.label}
      </p>
    </div>

    <ChevronRight
      className={`
        w-4 h-4 text-white/40
        transition-transform duration-200
        ${openModel ? "rotate-90 text-purple-400" : "group-hover:translate-x-1"}
      `}
    />
  </div>
</button>


              {/* STYLE */}
             <button
  onClick={() => {
    setOpenStyle(prev => !prev)
    setOpenSize(false)
    setOpenModel(false)
  }}
  className={`
    group
    relative
    bg-[#1A1E2A]
    border border-[#232635]
    rounded-sm
    px-4 py-3
    text-left
    transition-all duration-200
    hover:border-purple-500/40
    hover:shadow-md hover:shadow-purple-500/10
    active:scale-[0.98]
    ${openStyle ? "border-purple-500 shadow-md shadow-purple-500/20" : ""}
  `}
>
  <div className="flex justify-between items-center">
    <div>
      <p className="text-xs text-white/50">Style</p>
      <p className="text-sm text-white font-medium">
        {selectedStyle}
      </p>
    </div>

    <ChevronRight
      className={`
        w-4 h-4 text-white/40
        transition-all duration-200
        ${openStyle ? "rotate-90 text-purple-400" : "group-hover:translate-x-1"}
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
    group
    relative
    bg-[#1A1E2A]
    border border-[#232635]
    rounded-sm
    px-4 py-3
    text-left
    transition-all duration-200
    hover:border-purple-500/40
    hover:shadow-md hover:shadow-purple-500/10
    active:scale-[0.98]
    ${openSize ? "border-purple-500 shadow-md shadow-purple-500/20" : ""}
  `}
>
  <div className="flex justify-between items-center">
    <div>
      <p className="text-xs text-white/50">Size</p>
      <p className="text-sm text-white font-medium">
        {selectedSize}
      </p>
    </div>

    <ChevronRight
      className={`
        w-4 h-4 text-white/40
        transition-all duration-200
        ${openSize ? "rotate-90 text-purple-400" : "group-hover:translate-x-1"}
      `}
    />
  </div>
</button>


              {/* EXISTING DROPDOWNS BELOW (unchanged logic) */}

{openSize && (
  <div
    className="
   fixed
z-50
left-1/2 -translate-x-1/2
top-[18%] md:top-1/2
md:-translate-y-1/2
      w-[92%] md:w-[400px]
      max-h-[60vh]
      bg-[#1A1D2B]
      border border-white/10
      rounded-sm
      shadow-2xl
      p-5
      overflow-y-auto
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

    {selectedModel.supportedSizes.map((size) => (
      <button
        key={size}
        onClick={() => {
          setSelectedSize(size)
          setOpenSize(false)
        }}
        className={`w-full px-4 py-3 text-left rounded-sm text-sm
          ${
            size === selectedSize
              ? "bg-[#7A3BFF]/20 border border-[#7A3BFF]"
              : "hover:bg-white/5"
          }
        `}
      >
        {size}
      </button>
    ))}
  </div>
)}



{openStyle && (
  <div
    className="
     fixed
z-50
left-1/2 -translate-x-1/2
top-[18%] md:top-1/2
md:-translate-y-1/2
      w-[92%] md:w-[650px]
      max-h-[75vh]
      bg-[#1A1D2B]
      border border-white/10
      rounded-sm
      shadow-2xl
      p-5
      overflow-y-auto
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
z-50
left-1/2 -translate-x-1/2
top-[18%] md:top-1/2
md:-translate-y-1/2
      w-[92%] md:w-[800px]
      max-h-[75vh]
      bg-[#1A1D2B]
      border border-white/10
      rounded-sm
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
    {Object.entries(MODELS).map(([key, model]) => {
  const isLocked =
    planCode === "free" && key !== "image:flux.base";

  return (
    <div key={key} className="relative">
      {isLocked && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm rounded-sm z-10 flex items-center justify-center">
          <span className="text-xs text-white/70 bg-white/10 px-3 py-1 rounded-full">
            Upgrade to unlock
          </span>
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

            {/* GENERATE BUTTON */}
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
              className={`w-full py-3 rounded-sm font-medium text-white transition ${
                !prompt.trim() || isGenerating
                  ? "bg-gray-500/40 text-white/40 cursor-not-allowed"
                  : "bg-gradient-to-r from-[#7A3BFF] to-[#6F3AE6] hover:scale-[1.02] shadow-lg shadow-purple-600/30"
              }`}
            >
              {isGenerating ? "Generating…" : "Generate"}
            </button>

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




  </section>
)

};
