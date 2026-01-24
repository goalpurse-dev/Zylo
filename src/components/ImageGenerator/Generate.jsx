import { useState } from "react";
import { useRef, useEffect } from "react";

import CreditLogo from "../../assets/toolshell/credit.png"

import { ArrowBigLeft, Image, ImagePlusIcon, Settings, X } from "lucide-react";
import Bg from "../../assets/ImageGenerator/bg.png"
Image
ImagePlusIcon
X
Settings
ArrowBigLeft

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

const StyleCard = ({ img, label, onClick }) => (
  <button
    onClick={onClick}
    className="flex flex-col gap-2 rounded-xl overflow-hidden border border-white/10 hover:border-purple-500/50 transition"
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


const ModelCard = ({ img, label, credits, onClick }) => (
  <button
    onClick={onClick}
    className="flex flex-col gap-2 rounded-xl overflow-hidden border border-white/10 
               hover:border-purple-500/50 transition bg-[#0B0E1A]/60"
  >
    {/* Image preview */}
    <img
      src={img}
      className="h-20 w-full object-cover"
      alt={label}
    />

    {/* Info */}
    <div className="px-3 pb-3 flex flex-col gap-1 text-left">
      <div className="text-sm text-white font-medium">
        {label}
      </div>

      {/* Credits row */}
      <div className="flex items-center gap-1 text-xs text-white/60">
        <div className="bg-gray-200/80 p-[2px] rounded-lg ">
        <img src={CreditLogo} className="w-4 h-4" />
        </div>
        <span>{credits} credits</span>
      </div>
    </div>
  </button>
);



export const ViralImageGenerator = () => {
    
const [settingsOpen, setSettingsOpen] = useState(false);
const [activeMenu, setActiveMenu] = useState(null); 

const panelRef = useRef(null);

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

    <div className="relative w-full h-[500px] ">
    <img src={Bg} className="absolute inset-0 w-full h-full object-cover z-10 "></img> 
    <div className="absolute inset-0 bg-black/40 z-20"></div>  
    
     {/* Content */}
     
     <div className="flex flex-col justify-center items-center h-full w-full">
      <div className="relative z-30 font-bold text-[36px] text-white">
   Bring Ideas to Life
  </div>

<div className="relative z-40 w-full flex justify-center mt-10">
  <div className="w-full max-w-[900px] mx-4 sm:mx-6 md:mx-8 py-2 bg-[#ECE8F2]/30 backdrop-blur-xl rounded-2xl shadow-lg">
    
    {/* INNER CONTENT WRAPPER */}
    <div className="h-full p-4 flex flex-col  gap-4">


      <div className="flex items-center gap-2 ">
      <div className="flex justify-center items-center">
        <div className="bg-[#110829]/80 p-2 rounded-full border-[#282C40] border-[1px] shadow-lg">
      <ImagePlusIcon className="h-5 w-5"></ImagePlusIcon> 
      </div>
      </div>
      <div className="text-[14px]">Type Your Prompt</div>  

      </div>

      {/* Images will load here */}

      <div className="grid grid-cols-3 gap-4 md:max-w-[450px] sm:max-w-[300px]">
      <div className="shadow-lg bg-black h-[100px] lg:h-[150px] md:h-[130px] w-[90px] lg:w-[140px] md:w-[120px] rounded-lg">  
        <div className="flex justify-end p-1"><X className="text-gray-50 w-4 h-4"></X></div>
        </div> 
             <div className="shadow-lg bg-black h-[100px] lg:h-[150px] md:h-[130px] w-[90px]  lg:w-[140px] md:w-[120px] rounded-lg">  
        <div className="flex justify-end p-1"><X className="text-gray-50 w-4 h-4"></X></div>
        </div> 
      <div className="shadow-lg bg-black h-[100px] lg:h-[150px] md:h-[130px] w-[90px]  lg:w-[140px] md:w-[120px] rounded-lg">  
        <div className="flex justify-end p-1"><X className="text-gray-50 w-4 h-4"></X></div>
        </div> 
     
      </div>

      {/*Options*/}
      
<div className="flex items-center gap-3 w-full">
  
  {/* LEFT: Image / Video */}
  <div className="flex items-center gap-2">
    <div className="bg-gradient-to-r from-[#7A3BFF] to-[#492399] rounded-xl p-[1px]">
      <div className="bg-[#110829]/90 border border-[#282C40] rounded-xl px-5 py-2 flex items-center gap-2">
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
  className="bg-[#110829] p-2 rounded-xl border border-[#282C40] shadow-lg flex md:hidden"
>
  <Settings className="w-5 h-5" />
</button>

{/* Mobile settings opened state */}

{settingsOpen && (
  <div 
    ref={panelRef}
   className="  absolute top-12 left-1/2 -translate-x-1/2 z-80 w-[250px] sm:w-[300px] max-w-[320px] rounded-xl bg-[#0B0E1A]/95 backdrop-blur-xl border border-[#7A3BFF] shadow-[0_0_25px_rgba(122,59,255,0.25),0_0_60px_rgba(122,59,255,0.15)]">
    {activeMenu === null && (
      <div className="flex flex-col">
        <MenuItem label="Model" value="Auto" onClick={() => setActiveMenu("model")} />
        <MenuItem label="Aspect Ratio" value="1:1" onClick={() => setActiveMenu("ratio")} />
        <MenuItem label="Style" value="Dynamic" onClick={() => setActiveMenu("style")} />

      </div>
    )}

    {/* SUB MENUS */}
    {activeMenu === "model" && (
  <SubMenu title="Model" onBack={() => setActiveMenu(null)}>
    
    <div className="grid grid-cols-2 gap-3 p-3">
      
      <ModelCard
        label="Auto"
        img="/models/auto.jpg"
        credits={1}
        onClick={() => console.log("Auto")}
      />

      <ModelCard
        label="Zylo Spark"
        img="/models/spark.jpg"
        credits={2}
        onClick={() => console.log("Spark")}
      />

      <ModelCard
        label="Zylo Prime"
        img="/models/prime.jpg"
        credits={4}
        onClick={() => console.log("Prime")}
      />

    </div>

  </SubMenu>
)}

{activeMenu === "ratio" && (
  <SubMenu title="Aspect Ratio" onBack={() => setActiveMenu(null)}>
    
    <AspectRatioRow
      label="1:1 (Square)"
      width={40}
      height={40}
      onClick={() => console.log("1:1")} />
    <AspectRatioRow
      label="16:9 (Landscape)"
      width={40}
      height={20}
      onClick={() => console.log("16:9")} />
    <AspectRatioRow
      label="9:16 (Portrait)"
      width={20}
      height={40}
      onClick={() => console.log("9:16")} />
  </SubMenu>
)}
    {activeMenu === "style" && (
  <SubMenu title="Style" onBack={() => setActiveMenu(null)}>
    
    <div className="grid grid-cols-2 gap-3 p-3">
      
      <StyleCard
        label="Dynamic"
        img="/styles/dynamic.jpg"
        onClick={() => console.log("Dynamic")}
      />

      <StyleCard
        label="Cinematic"
        img="/styles/cinematic.jpg"
        onClick={() => console.log("Cinematic")}
      />

      <StyleCard
        label="Minimal"
        img="/styles/minimal.jpg"
        onClick={() => console.log("Minimal")}
      />

    </div>

  </SubMenu>
)}


  </div>

  
)}
</div>

    <button className="py-2 px-6 bg-gradient-to-r from-[#7A3BFF] to-[#492399] rounded-xl shadow-md border-[#282C40]/30 border-[1px]">
      Generate
    </button>

  </div>
</div>


    </div>

  </div>
</div>


  </div>
     
    </div>

    </section>
  );
};

export default ViralImageGenerator;
