import React from "react";
import { Film, MessageSquare, Wand2 } from "lucide-react";
import Example from "../assets/example1.mp4";

const StepCard = ({ step, title, desc, icon: Icon }) => {
  return (
    <div className="
      backdrop-blur-2xl bg-white/10 border border-white/20
      rounded-2xl p-6 w-full max-w-sm shadow-2xl
      hover:bg-white/20 hover:border-white/30 hover:scale-[1.03]
      transition-all duration-300
    ">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[#8B5CFF] font-semibold">STEP {step}</span>
        <Icon className="text-[#8B5CFF]" size={22} />
      </div>

      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="opacity-80 text-sm mt-2">{desc}</p>
    </div>
  );
};

export default function QuickStepsVideoSection() {
  return (
    <div className="relative w-full h-[650px] overflow-hidden mt-32 rounded-3xl">

      {/* Background video - slightly scaled to remove borders */}
      <video
        className="
          absolute inset-0 w-full h-full 
          object-contain 
          opacity-50 
          scale-[1.15]        /* 👈 Removes black borders */
        "
        autoPlay
        muted
        loop
        playsInline
        src={Example}
      />

      {/* Cinematic overlay */}
      <div className="
        absolute inset-0 
        bg-gradient-to-b from-black/50 via-black/20 to-black/70
        mix-blend-multiply
      " />

      {/* Soft vignette to hide edges even more */}
      <div className="absolute inset-0 pointer-events-none bg-black/40" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-white px-6">

        <h2 className="text-4xl font-bold mb-14 drop-shadow-lg">
          Create ads in <span className="text-[#8B5CFF]">3 simple steps</span>
        </h2>

        <div className="flex flex-wrap gap-10 justify-center">
          <StepCard
            step="1"
            title="Choose ad style"
            desc="Pick cinematic, avatar, UGC & more"
            icon={Film}
          />
          <StepCard
            step="2"
            title="Write or auto-generate script"
            desc="Zylo AI creates your perfect marketing script"
            icon={MessageSquare}
          />
          <StepCard
            step="3"
            title="Generate final ad"
            desc="Voiceover, editing & HD renders automatically"
            icon={Wand2}
          />
        </div>

      </div>
    </div>
  );
}
