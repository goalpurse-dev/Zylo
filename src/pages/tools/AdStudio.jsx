// src/pages/ads/AdCreateLanding.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import QuickSteps from "../../components/QuickSteps";
import { Sparkles } from "lucide-react";


const zyGrad = "bg-gradient-to-r from-[#7B2CFF] via-[#8B5CFF] to-[#4F46E5]";

export default function AdCreateLanding() {
  const navigate = useNavigate();

  return (
    <div className="w-full min-h-screen px-6 pt-24 pb-32 bg-[#0c0f17] text-white">

      {/* Header */}
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-5xl font-bold tracking-tight">
          Create <span className="text-[#8B5CFF]">High-Converting Ads</span>
        </h1>
        <p className="opacity-70 mt-4 text-lg">
          Cinematic video ads, AI avatars, voiceovers and full editing — all in one place.
        </p>

        {/* CTA */}
        <button
          onClick={() => navigate("/ad/create/step-1")}
          className={`mt-10 px-10 py-4 rounded-xl text-lg font-semibold shadow-lg transition-transform hover:scale-[1.03] ${zyGrad}`}
        >
          Start Creating
        </button>
      </div>

      {/* Steps component */}
      <div className="mt-32">
        <QuickSteps />
      </div>
    </div>
  );
}
