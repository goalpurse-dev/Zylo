import {  useState } from "react";
import { useRef, useEffect } from "react";
import { MODELS } from "../../lib/image-generator/modelsConfig";
import { useReferenceImages } from "../../components/reference-images/useReferenceImages";
import ReferenceImageModal from "../../components/reference-images/ReferenceImageModal";
import { generateImageFromUI } from "../../lib/image-generator";
import { supabase } from "../../lib/supabaseClient";
import { IMAGE_STYLES } from "../../lib/image-generator/styles";




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
      relative flex flex-col gap-2 rounded-xl overflow-hidden transition
      ${active
        ? "border-2 border-[#7A3BFF] shadow-[0_0_25px_rgba(122,59,255,0.45)] "
        : "border border-white/10 hover:border-purple-500/50"}
    `}
  >
    <img src={img} className="h-20 w-full object-cover" />
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
        className="border border-white/70 rounded-md"
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
      relative w-full rounded-xl transition text-left
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
        className="w-10 h-10 rounded-lg object-cover  p-1 flex-shrink-0"
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
            className="text-[11px] px-2 py-1 rounded-full bg-white/10 text-white/70"
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


    
const [settingsOpen, setSettingsOpen] = useState(false);
const [activeMenu, setActiveMenu] = useState(null); 

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


  } catch (err) {
    console.error("Generate failed:", err);
  } finally {
    setIsGenerating(false);
  }
};

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height =
      textareaRef.current.scrollHeight + "px";
  }, [prompt]);

  useEffect(() => {
  if (selectedModel.maxReferenceImages === 0) {
    setOpenReferenceModal(false);
  }
}, [selectedModelKey]);

   


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
    <section>
   
    {/* Bg image */}

    <div className="relative w-full h-[500px] md:h-[600px] ">
      {/* Bottom blend into page bg */}
<div className="
  absolute bottom-0 left-0 right-0
  h-40
  bg-[linear-gradient(to_bottom,rgba(18,20,26,0)_0%,#12141A_100%)]
  z-30
" />
    <img src={Bg} className="absolute inset-0 w-full h-full object-cover z-10 "></img> 
    <div className="absolute inset-0 bg-[#12141A]/60 z-20"></div>  
    
     {/* Content */}
     
     <div className="flex flex-col justify-center items-center h-full w-full">
      <div className="relative z-30 font-bold text-[36px] text-white">
   Bring Ideas to Life
  </div>

<div className="relative z-40 w-full flex justify-center mt-10">
  <div className="w-full max-w-[900px] mx-4 sm:mx-6 md:mx-8 py-2 bg-[#ECE8F2]/20 backdrop-blur-xl rounded-2xl shadow-lg">
    
    {/* INNER CONTENT WRAPPER */}
    <div className="h-full p-4 flex flex-col  gap-4">


      <div className="flex items-center gap-2 ">
      <div className="flex justify-center items-center">

<button
  disabled={!canAddImages}
  onClick={() => {
    if (!canAddImages) return;
    setOpenReferenceModal(true);
  }}
  className={`
    p-2 rounded-full border border-[#282C40] shadow-lg transition
    ${
      canAddImages
        ? "bg-[#1A1D2B] hover:bg-[#1A1D2B]/80 cursor-pointer"
        : "bg-[#1A1D2B]/40 opacity-40 cursor-not-allowed"
    }
  `}
>
  <ImagePlusIcon className="h-5 w-5 text-white" />
</button>

      </div>
     
 <div className="w-full rounded-2xl bg-[#1A1D2B]/40 backdrop-blur-xl border border-white/10 shadow-lg">
 <textarea
  ref={textareaRef}
  value={prompt}
  onChange={(e) => setPrompt(e.target.value)}
  placeholder="Describe the image you want to generate…"
  rows={1}
  className="

  w-full resize-none bg-transparent overflow-y-auto 
    px-4 py-3
    text-white text-[15px]
    placeholder:text-white/40
    focus:outline-none
    focus:ring-0
    rounded-2xl
   max-h-[8rem]
  "
/>
    </div>

      </div>

      {/* Images will load here */}

<div className="grid grid-cols-3 gap-4 md:max-w-[450px] sm:max-w-[300px]">
  {selected.map((img) => (
    <div
      key={img.id}
      className="relative shadow-lg bg-black rounded-lg overflow-hidden"
    >
      <img
        src={img.url}
        className="w-full h-full object-cover"
      />

      <button
        onClick={() => toggleSelect(img)}
        className="absolute top-1 right-1 bg-black/60 rounded-full p-1"
      >
        <X className="w-4 h-4 text-white" />
      </button>
    </div>
  ))}
</div>

      {/*Options*/}
      
<div className="flex items-center gap-3 w-full">
  
  {/* LEFT: Image / Video */}
  <div className="flex items-center gap-2">
    <div className="bg-gradient-to-r from-[#7A3BFF] to-[#492399] rounded-xl p-[1px]">
      <div className="bg-[#1A1D2B]  rounded-xl px-5 py-2 flex items-center gap-2">
        <Image className="h-4 w-4" />
        <p>Image</p>
      </div>
    </div>
  </div>

  {/* 🔥 SPACER */}
  <div className="flex-1"></div>

  {/* RIGHT: Settings + Generate */}
  <div className="flex items-center gap-1">
    
  <div className="relative md:hidden">
    <button
  onClick={() => setSettingsOpen(prev => !prev)}
  className="bg-[#1A1D2B] p-2 rounded-xl border border-[#282C40] shadow-lg flex md:hidden"
>
  <Settings className="w-5 h-5" />
</button>

{/* Mobile settings opened state */}

{settingsOpen && (
  <div 
    ref={panelRef}
   className="  absolute top-12 left-1/2 -translate-x-1/2 z-80 w-[300px] sm:w-[350px] max-w-[320px] rounded-xl bg-[#1A1D2B] backdrop-blur-xl border border-[#7A3BFF] shadow-[0_0_25px_rgba(122,59,255,0.25),0_0_60px_rgba(122,59,255,0.15)]">
    {activeMenu === null && (
      <div className="flex flex-col">
       <MenuItem
  label="Model"
  value={selectedModel.label}
  onClick={() => setActiveMenu("model")}
/>

<MenuItem
  label="Aspect Ratio"
  value={selectedSize}
  onClick={() => setActiveMenu("ratio")}
/>

<MenuItem
  label="Style"
  value={selectedStyle}
  onClick={() => setActiveMenu("style")}
/>

      </div>
    )}

    {/* SUB MENUS */}
{activeMenu === "model" && (
  <SubMenu title="Model" onBack={() => setActiveMenu(null)}>
    <div
      className="
        flex flex-col  gap-3 p-3
        max-h-[280px]      
        overflow-y-auto
        pr-1
        scrollbar-thin
        scrollbar-thumb-white/20
        scrollbar-track-transparent
      "
    >
      {Object.entries(MODELS).map(([key, model]) => {
        const isActive = key === selectedModelKey;

        return (
          <ModelCard
            key={key}
            img={model.img}
            label={model.label}
            description={model.description}
            credits={model.credits}
            traits={model.traits}
            active={isActive}
            compact
            onClick={() => {
              setSelectedModelKey(key);

             if (!model.supportedSizes.includes(selectedSize)) {
  setSelectedSize(model.supportedSizes[0]);
}
             

              setActiveMenu(null);
            }}
          />
        );
      })}
    </div>
  </SubMenu>
)}





{activeMenu === "ratio" && (
  <SubMenu title="Aspect Ratio" onBack={() => setActiveMenu(null)}>
    <div className="flex flex-col">
      {selectedModel.supportedSizes.map((size) => (
        <button
          key={size}
          onClick={() => {
            setSelectedSize(size);
            setActiveMenu(null);
          }}
          className={`
            px-4 py-3 text-left flex justify-between items-center
            ${size === selectedSize
              ? "bg-[#7A3BFF]/10 text-white"
              : "text-white/80 hover:bg-white/5"}
          `}
        >
          {size}
          {size === selectedSize && <span>✓</span>}
        </button>
      ))}
    </div>
  </SubMenu>
)}

{activeMenu === "style" && (
  <SubMenu title="Style" onBack={() => setActiveMenu(null)}>
    <div
      className="
        grid grid-cols-2 gap-3 p-3
        max-h-[290px]
        overflow-y-auto
        pr-1
        scrollbar-thin
        scrollbar-thumb-white/20
        scrollbar-track-transparent
      "
    >
      {Object.entries(IMAGE_STYLES).map(([key, style]) => (
        <StyleCard
          key={key}
          label={style.label}
          img={style.img}
          active={key === selectedStyle}
          onClick={() => {
            setSelectedStyle(key);
            setActiveMenu(null);
          }}
        />
      ))}
    </div>
  </SubMenu>
)}


  </div>

  
)}
</div>

  {/* Md and higher buttons */}
    <div ref={controlsRef} className="relative hidden md:flex gap-1">
 
        {/* Size */}
 <button
  onClick={() => {
    setOpenSize(prev => !prev);
    setOpenStyle(false);
    setOpenModel(false);
  }}
  className="flex items-center gap-2 bg-[#1A1D2B] px-3 py-2 rounded-xl border border-[#2A2F45] shadow-lg hover:bg-[#1A1D2B]/80"
>
  <BoxSelect className="w-5 h-5 text-white" />
  <span className="text-[#E6E8EE] text-[16px]">{selectedSize}</span>
</button>


  {openSize && (
  <div className="absolute top-full mt-2 w-40 rounded-xl bg-[#1A1D2B] border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden">
    {selectedModel.supportedSizes.map((size) => (
      <button
        key={size}
        onClick={() => {
          setSelectedSize(size);
          setOpenSize(false);
        }}
        className={`w-full px-4 py-2 text-left text-sm text-[#E6E8EE] hover:bg-white/5 flex items-center justify-between
          ${size === selectedSize ? "bg-white/5" : ""}`}
      >
        {size}
        {size === selectedSize && <span>✓</span>}
      </button>
    ))}
  </div>
)}

{/* Model */}

{openModel && (
 <div
  className="
   absolute top-full mt-2
right-1/2 translate-x-1/2
    w-[600px] max-w-[90vw]
    rounded-xl bg-[#1A1D2B]
    border border-white/10
    shadow-2xl backdrop-blur-xl
    z-50
  "
>
   <div
  className="
    grid grid-cols-2 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 
    gap-3 p-3
    max-h-[320px]
    overflow-y-auto
    pr-1
    scrollbar-thin
    scrollbar-thumb-white/20
    scrollbar-track-transparent
  "
>
      {Object.entries(MODELS).map(([key, model]) => {
        const isActive = key === selectedModelKey;

        return (
          <ModelCard
            key={key}
            img={model.img}
            label={model.label}
            description={model.description}
            credits={model.credits}
            traits={model.traits}
            active={isActive}
            compact
            onClick={() => {
              setSelectedModelKey(key);

             if (!model.supportedSizes.includes(selectedSize)) {
  setSelectedSize(model.supportedSizes[0]);
}
            

              setOpenModel(false);
            }}
          />
        );
      })}
    </div>
  </div>
)}

     {/* Style */}
<button
  onClick={() => {
    setOpenStyle(prev => !prev);
    setOpenSize(false);
    setOpenModel(false);
  }}
  className="flex items-center gap-2 bg-[#1A1D2B] p-2 rounded-xl border border-[#2A2F45] shadow-lg hover:bg-[#1A1D2B]/80"
>
  <Wand2 className="w-4 h-4 text-white" />
  <p className="text-[#E6E8EE] text-[16px]">{selectedStyle}</p>
</button>

{openStyle && (
  <div
    className="
      absolute top-full mt-2 w-[450px]
      rounded-xl bg-[#1A1D2B]
      border border-white/10
      shadow-2xl backdrop-blur-xl
      z-50
    "
  >
    <div
      className="
        grid grid-cols-3 gap-3 p-3
        max-h-[290px]
        overflow-y-auto
        pr-1
        scrollbar-thin
        scrollbar-thumb-white/20
        scrollbar-track-transparent
      "
    >
      {Object.entries(IMAGE_STYLES).map(([key, style]) => (
        <StyleCard
          key={key}
          label={style.label}
          img={style.img}
          active={key === selectedStyle}
          onClick={() => {
            setSelectedStyle(key);
            setOpenStyle(false);
          }}
        />
      ))}
    </div>
  </div>
)}


    
      {/* Model */}
 <button
  onClick={() => {
    setOpenModel(prev => !prev);
    setOpenSize(false);
    setOpenStyle(false);
  }}
  className="bg-[#1A1D2B] p-2 rounded-xl border border-[#2A2F45] shadow-lg hover:bg-[#1A1D2B]/80"
>
  <p className="text-[12px] text-white/60 ">
    Model:
    <span className="text-[16px] text-[#E6E8EE] ml-1">
      {selectedModel.label}
    </span>
  </p>
</button>
    
    </div>

   <button
   onClick={handleGenerate}
  disabled={!prompt.trim() || isGenerating}
  className={`
    ml-1 py-2 px-6 rounded-xl shadow-md border border-[#282C40]/30
    transition
    ${
      !prompt.trim() || isGenerating
        ? "bg-gray-500/40 text-white/40 cursor-not-allowed"
        : "bg-gradient-to-r from-[#7A3BFF] to-[#492399] hover:opacity-90"
    }
  `}
>
  {isGenerating ? "Generating…" : "Generate"}
</button>


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


    </section>
  );
};




