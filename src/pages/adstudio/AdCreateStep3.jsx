import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Volume2 } from "lucide-react";
import "../../styles/adstudio.css";
import { supabase } from "../../lib/supabaseClient";
import UpgradePopup from "../../components/UpgradePopup";

/* -------------------------------------------------------
   CONSTANTS
------------------------------------------------------- */
const AVATAR_KEY = "ad.create.avatar";
const ROW_SIZE = 10;
const MAX_AVATARS = 50;

// Correct base path using catalog folder
const PUBLIC_BASE = `${supabase.storageUrl}/object/public/avatars/catalog`;

/* -------------------------------------------------------
   PLAN → LIMITS
------------------------------------------------------- */
function capFromPlanCode(code) {
  const c = (code || "").toLowerCase();
  if (c === "generative") return 50;
  if (c === "pro" || c === "business") return 20;
  if (c === "starter") return 5;
  return 5;
}

function requiredTierForIndex(idx, cap) {
  if (idx < 10) return null;
  if (idx < 20) return cap >= 20 ? null : "Pro";
  return cap >= 50 ? null : "Generative";
}

/* -------------------------------------------------------
   COMPONENT
------------------------------------------------------- */
export default function AdCreateStep3() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const adType = params.get("adType") || "";
  const model = params.get("model") || "";
  const mode = params.get("mode") || "";
  const productId = params.get("product_id") || "";

  /* PLAN STATE */
  const [planCode, setPlanCode] = useState("starter");
  const [avatarCap, setAvatarCap] = useState(5);

  /* AVATAR STATE */
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [visibleRows, setVisibleRows] = useState(2);

  /* AUDIO */
  const audioRef = useRef(null);
  const [playingId, setPlayingId] = useState(null);
  const [progress, setProgress] = useState(0);

  /* POPUP */
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupPlan, setPopupPlan] = useState("");

  /* -------------------------------------------------------
     LOAD PLAN
  ------------------------------------------------------- */
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return;

      const { data: row } = await supabase
        .from("profiles")
        .select("plan_code, app_plans:app_plans!inner(code, features)")
        .eq("id", uid)
        .maybeSingle();

      const pCode = row?.plan_code || row?.app_plans?.code || "starter";
      setPlanCode(pCode);

      const cap =
        row?.app_plans?.features?.avatars_max ?? capFromPlanCode(pCode);
      setAvatarCap(cap);
    })();
  }, []);

  /* -------------------------------------------------------
     RESTORE SELECTION
  ------------------------------------------------------- */
  useEffect(() => {
    const cached = sessionStorage.getItem(AVATAR_KEY);
    if (cached) try {
      setSelected(JSON.parse(cached));
    } catch {}
  }, []);

  /* -------------------------------------------------------
     LOAD STATIC PUBLIC AVATARS — FIXED PATHS
  ------------------------------------------------------- */
useEffect(() => {
  setLoading(true);

  // BASE URL for avatars
  const PUBLIC_BASE = "https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/avatars/catalog";

  // Avatar catalog (you can add more here)
  const names = [
    { display: "Amelia", file: "amelia.jpg", voice: "amelia.mp3" },
    { display: "Emma", file: "emma.jpg", voice: "emma.mp3" },
    { display: "Jack", file: "jack.jpg", voice: "jack.mp3" },
    { display: "Liam", file: "liam.jpg", voice: "liam.mp3" },
    { display: "Noah", file: "noah.jpg", voice: "noah.mp3" },
    { display: "Olivia", file: "olivia.jpg", voice: "olivia.mp3" },
    { display: "Theodore", file: "theodore.jpg", voice: "theodore.mp3" },
    { display: "Tyron", file: "tyron.jpg", voice: "tyron.mp3" },
    { display: "Yuki", file: "yuki.jpg", voice: "yuki.mp3" },
  ];

  const avatars = names.map((a, i) => ({
    id: i + 1,
    display_name: a.display,
    voice_style: "Professional presenter",

    // Correct Supabase path
    _thumb: `${PUBLIC_BASE}/thumbs/${a.file}`,

    // Correct voice demo path
    voice_demo_url: `${PUBLIC_BASE}/voices/${a.voice}`,

    voice_id: "TODO_" + a.display,
    __placeholder: false,
  }));

  // FILL remaining placeholders
  const black =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='540' height='960'>
        <rect width='540' height='960' fill='black'/>
      </svg>`
    );

  for (let i = avatars.length; i < MAX_AVATARS; i++) {
    avatars.push({
      id: `ph-${i}`,
      display_name: `Avatar ${i + 1}`,
      voice_style: "",
      _thumb: black,
      voice_demo_url: null,
      __placeholder: true,
    });
  }

  setCatalog(avatars);
  setLoading(false);
}, []);


  /* -------------------------------------------------------
     AUDIO HANDLERS
  ------------------------------------------------------- */
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const update = () => {
      if (!el.duration) return setProgress(0);
      setProgress(el.currentTime / el.duration);
    };

    const ended = () => {
      setPlayingId(null);
      setProgress(0);
    };

    el.addEventListener("timeupdate", update);
    el.addEventListener("ended", ended);

    return () => {
      el.removeEventListener("timeupdate", update);
      el.removeEventListener("ended", ended);
    };
  }, []);

  const togglePreview = (avatar) => {
    const el = audioRef.current;
    if (!avatar.voice_demo_url) return;

    if (playingId === avatar.id) {
      el.pause();
      setPlayingId(null);
      return;
    }

    el.src = avatar.voice_demo_url;
    el.currentTime = 0;
    el.play();
    setPlayingId(avatar.id);
  };

  /* -------------------------------------------------------
     SELECT AVATAR
  ------------------------------------------------------- */
  const trySelect = (avatar, idx) => {
    const req = requiredTierForIndex(idx, avatarCap);
    if (req) {
      setPopupPlan(req);
      setPopupOpen(true);
      return;
    }
    if (avatar.__placeholder) return;

    setSelected(selected?.id === avatar.id ? null : avatar);
  };

  /* -------------------------------------------------------
     NAVIGATION
  ------------------------------------------------------- */
  const goBack = () => {
    const q = new URLSearchParams({ adType, model, mode, product_id: productId });
    navigate(`/ad/create/step-2?${q}`);
  };

  const goNext = () => {
    if (selected)
      sessionStorage.setItem(AVATAR_KEY, JSON.stringify(selected));
    else
      sessionStorage.removeItem(AVATAR_KEY);

    const q = new URLSearchParams({
      adType,
      model,
      mode,
      product_id: productId,
      avatar_id: selected?.id || "",
    });

    navigate(`/ad/create/step-4?${q}`);
  };

  /* -------------------------------------------------------
     GRID ROWS
  ------------------------------------------------------- */
  const rows = useMemo(() => {
    const r = [];
    for (let i = 0; i < MAX_AVATARS; i += ROW_SIZE) {
      r.push(catalog.slice(i, i + ROW_SIZE));
    }
    return r;
  }, [catalog]);

  const rowTitles = [
    "Core presenters — 1–10",
    "Pro expansion — 11–20",
    "Generative exclusives — 21–30",
    "Generative exclusives — 31–40",
    "Generative exclusives — 41–50",
  ];

  /* -------------------------------------------------------
     UI
  ------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-white">
      <audio ref={audioRef} />

      <div className="mx-auto w-full max-w-6xl px-6 pt-10">
        <h1 className="zy-h1 mt-6">
          Pick your <span className="zy-gradient-text">avatar presenter</span>
        </h1>
        <p className="mt-2 zy-sub">
          Step 3 of 4 — Choose a voice & look for your spokesperson.
        </p>

        <div className="mt-10 space-y-8">
          {loading ? (
            <div className="zy-card p-6 text-gray-600">Loading avatars…</div>
          ) : (
            rows.slice(0, visibleRows).map((items, rowIdx) => (
              <div key={`row-${rowIdx}`} className="relative">
                <div className="mb-3 text-lg font-bold text-[#0A0F1C]">
                  {rowTitles[rowIdx]}
                </div>

                <div className="flex gap-4 overflow-x-auto pb-4 px-2">
                  {items.map((a, i) => {
                    const globalIdx = rowIdx * ROW_SIZE + i;
                    const locked = !!requiredTierForIndex(globalIdx, avatarCap);
                    const isSelected = selected?.id === a.id;
                    const isPlaying = playingId === a.id;

                    return (
                      <div
                        key={a.id}
                        className={`w-[210px] rounded-2xl border p-3 bg-white shadow-sm hover:shadow-md transition cursor-pointer relative ${
                          isSelected ? "ring-2 ring-violet-500" : "border-gray-200"
                        }`}
                        onClick={() => trySelect(a, globalIdx)}
                      >
                        {/* THUMB */}
                        <div className="aspect-[3/4] w-full overflow-hidden rounded-xl bg-gray-100">
                          <img
                            src={a._thumb}
                            alt={a.display_name}
                            className="h-full w-full object-cover"
                          />
                        </div>

                        {/* NAME */}
                        <div className="mt-2 text-sm font-semibold text-[#0A0F1C]">
                          {a.display_name}
                        </div>

                        {/* PREVIEW BUTTON */}
                        {!a.__placeholder && !locked && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePreview(a);
                            }}
                            className="mt-2 flex items-center gap-2 rounded-lg border px-2 py-1 text-sm text-[#0A0F1C]"
                          >
                            <Volume2 className="h-4 w-4" />
                            {isPlaying ? "Stop" : "Preview"}
                          </button>
                        )}

                        {/* PROGRESS BAR */}
                        {isPlaying && (
                          <div className="mt-1 h-1 w-full bg-gray-200 rounded">
                            <div
                              className="h-1 bg-violet-600 rounded"
                              style={{ width: `${progress * 100}%` }}
                            ></div>
                          </div>
                        )}

                        {/* LOCK OVERLAY */}
                        {locked && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              trySelect(a, globalIdx);
                            }}
                            className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-2xl cursor-pointer"
                          >
                            <Lock className="h-6 w-6 text-gray-600" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {visibleRows < rows.length && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => setVisibleRows((n) => Math.min(n + 2, rows.length))}
              className="rounded-full border px-4 py-2 text-sm font-semibold text-[#0A0F1C] hover:bg-gray-50"
            >
              Show more
            </button>
          </div>
        )}

        <div className="mt-10 flex items-center gap-3">
          <button onClick={goBack} className="zy-btn-soft">
            Back
          </button>

          <button
            onClick={goNext}
            className="w-full rounded-xl px-5 py-3 text-white font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-95"
          >
            Continue
          </button>
        </div>
      </div>

      <UpgradePopup
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        planRequired={popupPlan}
      />
    </div>
  );
}
