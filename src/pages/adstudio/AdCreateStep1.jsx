import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Sparkles,
  Clapperboard,
  Mic2,
  UserSquare2,
  Lock,
  CheckCircle2,
} from "lucide-react";
import UpgradePopup from "../../components/UpgradePopup";
import "../../styles/adstudio.css";

const BRAND = {
  primary: "#7A3BFF",
  ink: "#0B1220",
  text: "#0A0F1C",
  sub: "#5B6275",
  bg: "#FFFFFF",
};

const CARD =
  "group relative rounded-2xl border bg-white shadow-sm transition hover:shadow-md hover:-translate-y-[1px]";

const CHOICE = "zy-choice";

export default function AdCreateStep1() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // 🔒 Only V4 + cinematic allowed
  const [adType, setAdType] = useState("cinematic-product");
  const [model, setModel] = useState("standard");

  const [popupOpen, setPopupOpen] = useState(false);
  const [popupPlan, setPopupPlan] = useState("");

  const canContinue = adType && model;

  const openComingSoon = () => {
    setPopupPlan("Coming soon");
    setPopupOpen(true);
  };

  const goNext = () => {
    if (!canContinue) return;
    const q = new URLSearchParams({ adType, model });
    navigate(`/ad/create/step-2?${q}`);
  };

  return (
    <div className="min-h-screen" style={{ background: BRAND.bg }}>
      <div className="mx-auto w-full max-w-5xl px-6 pt-10 zy-container">

        {/* TITLE */}
        <h1 className="zy-h1 zy-fadeup">
          Pick your <span className="zy-gradient-text">ad type</span> and{" "}
          <span className="zy-gradient-text">model</span>
        </h1>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 mt-8">

          {/* AD TYPE LIST */}
          <div className="lg:col-span-2">
            <section className={`${CARD} border-gray-200`}>
              <header className="flex items-center justify-between border-b px-6 py-5">
                <div>
                  <h2 className="zy-section-title text-lg font-bold text-[#0A0F1C]">
                    What kind of ad?
                  </h2>
                  <p className="zy-sub mt-1 text-sm">
                    Only cinematic ads available during beta.
                  </p>
                </div>
              </header>

              <div className="grid grid-cols-1 gap-3 p-6">

                {/* ✔ CINEMATIC */}
                <button
                  onClick={() => setAdType("cinematic-product")}
                  className={`${CHOICE} ${
                    adType === "cinematic-product" ? "zy-choice--active" : ""
                  }`}
                >
                  <div className="rounded-md p-2 bg-violet-100">
                    <Clapperboard className="h-6 w-6" />
                  </div>

                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Cinematic product video</span>
                      {adType === "cinematic-product" && (
                        <CheckCircle2
                          className="h-4 w-4"
                          color={BRAND.primary}
                        />
                      )}
                    </div>
                    <p className="text-sm mt-0.5">
                      Rich motion and lighting that spotlights your product.
                    </p>
                  </div>
                </button>

                {/* 🔒 OTHER TYPES — locked */}
                {[
                  {
                    id: "spokesperson",
                    title: "Talking avatar spokesperson",
                    icon: <UserSquare2 className="h-6 w-6" />,
                  },
                  {
                    id: "ugc",
                    title: "UGC-style vertical ad",
                    icon: <Sparkles className="h-6 w-6" />,
                  },
                  {
                    id: "voiceover-text",
                    title: "Voiceover + captions",
                    icon: <Mic2 className="h-6 w-6" />,
                  },
                ].map((x) => (
                  <button
                    key={x.id}
                    onClick={openComingSoon}
                    className={`${CHOICE} opacity-50 cursor-pointer`}
                  >
                    <div className="rounded-md p-2 bg-gray-100">{x.icon}</div>

                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{x.title}</span>
                        <Lock className="h-4 w-4 text-gray-500" />
                      </div>
                      <p className="text-sm mt-0.5">Coming soon</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* MODEL PICKER */}
          <aside className={`${CARD} border-gray-200 h-fit`}>
            <div className="border-b px-6 py-5">
              <h3 className="zy-section-title text-lg font-bold text-[#0A0F1C]">
                Choose a rendering model
              </h3>
              <p className="zy-sub mt-1 text-sm">
                Only Standard (V4) is available.
              </p>
            </div>

            <div className="space-y-3 p-6">

              {/* ✔ STANDARD */}
              <button
                onClick={() => setModel("standard")}
                className={`w-full text-left ${CHOICE} ${
                  model === "standard" ? "zy-choice--active" : ""
                }`}
              >
                <div className="flex-1">
                  <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                    V4 • STANDARD
                  </span>

                  <div className="mt-2 font-medium">
                    Fast & consistent — ideal for most product shots
                  </div>

                  <ul className="mt-1 text-sm list-disc pl-5">
                    <li>Seedance Pro Fast 1080p</li>
                    <li>Smooth lighting</li>
                    <li>Stable 9:16 output</li>
                  </ul>
                </div>
              </button>

              {/* 🔒 PREMIUM V5 */}
              <button
                onClick={openComingSoon}
                className={`w-full text-left ${CHOICE} opacity-50 cursor-pointer`}
              >
                <div className="flex-1">
                  <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                    V5 • PREMIUM
                  </span>

                  <div className="flex items-center gap-2 mt-2 font-medium">
                    Cinematic realism — richer detail
                    <Lock className="h-4 w-4 text-indigo-500" />
                  </div>

                  <p className="text-sm mt-1">Coming soon</p>
                </div>
              </button>
            </div>

            <div className="border-t px-6 py-5">
              <button
                disabled={!canContinue}
                onClick={goNext}
                className="w-full rounded-xl px-5 py-3 text-white font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-95"
              >
                Continue
              </button>
            </div>
          </aside>
        </div>
      </div>

      {/* Popup */}
      <UpgradePopup
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        planRequired={popupPlan}
      />
    </div>
  );
}
