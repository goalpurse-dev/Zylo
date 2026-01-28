import { useEffect, useMemo, useState } from "react";
import { DownloadIcon } from "lucide-react";
import { CREATION_TYPES } from "../../lib/creations";

/* =============================== CONFIG =============================== */

const STUCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const STUCK_PROGRESS_MAX = 10;
const FAILED_HIDE_DELAY = 5000; // 5 seconds
const MAX_RUNTIME_MS = 5 * 60 * 1000; // 5 minutes

/* =============================== HELPERS =============================== */

function isExpired(job) {
  if (!job?.created_at) return false;

  const age = Date.now() - new Date(job.created_at).getTime();

  if (job.status === "failed") return true;
  if (!job.result_url && job.progress >= 95 && age > MAX_RUNTIME_MS) return true;
  if (job.status === "running" && age > MAX_RUNTIME_MS) return true;
  if (job.status === "queued" && age > MAX_RUNTIME_MS) return true;

  return false;
}

function getAspectStyle(item) {
  const size =
    item?.settings?.size ||
    item?.input?.size ||
    "";

  const match = String(size).match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) return {};

  const w = Number(match[1]);
  const h = Number(match[2]);
  if (!w || !h) return {};

  return { aspectRatio: `${w} / ${h}` };
}

/* =============================== CARD =============================== */

function ResultCard({ item }) {
  const [visible, setVisible] = useState(true);

  const isDone = item.status === "succeeded" && !!item.result_url;
  const progress = Math.min(99, Number(item.progress ?? 0));

  const createdAt = item.created_at
    ? new Date(item.created_at).getTime()
    : 0;

  const isFailed =
    !isDone &&
    progress <= STUCK_PROGRESS_MAX &&
    createdAt > 0 &&
    Date.now() - createdAt > STUCK_TIMEOUT_MS;

  /* auto-hide failed card */
  useEffect(() => {
    if (!isFailed) return;
    const t = setTimeout(() => setVisible(false), FAILED_HIDE_DELAY);
    return () => clearTimeout(t);
  }, [isFailed]);

  if (!visible) return null;

  return (
    <div className="relative rounded-xl overflow-hidden bg-black group transition-opacity duration-500">
      <div className="w-full relative" style={getAspectStyle(item)}>
        {/* DONE */}
        {isDone && (
          <img
            src={item.result_url}
            alt=""
            className="w-full h-full object-cover block"
          />
        )}

        {/* FAILED */}
        {isFailed && (
          <div className="w-full min-h-[220px] flex items-center justify-center bg-black">
            <p className="text-white/70 text-sm font-medium tracking-wide">
              Failed
            </p>
          </div>
        )}

        {/* LOADING */}
        {!isDone && !isFailed && (
          <div className="w-full min-h-[220px] flex items-center justify-center bg-black">
            <svg className="w-14 h-14" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="6"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#7A3BFF"
                strokeWidth="6"
                strokeDasharray="28 260"
                strokeLinecap="round"
                className="origin-center animate-spin"
              />
            </svg>
          </div>
        )}
      </div>

      {/* HOVER PROMPT */}
      {isDone && (
        <div className="
          absolute inset-0
          bg-gradient-to-t from-black/70 via-black/20 to-transparent
          opacity-0 group-hover:opacity-100
          transition-opacity duration-300
          flex flex-col justify-end
          p-4
        ">
          <p className="text-white text-sm leading-snug line-clamp-4">
            {item.input?.subject ?? item.prompt}
          </p>

          <button
            onClick={() => window.open(item.result_url, "_blank")}
            className="mt-2 w-fit flex items-center gap-1 text-white/90 hover:text-white text-xs font-medium"
          >
            <DownloadIcon className="w-4 h-4" />
            Download
          </button>
        </div>
      )}

      {/* PROGRESS BAR */}
      {!isDone && !isFailed && (
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="text-white/70 text-xs mb-2">
            Generating… {progress}%
          </p>
          <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#7A3BFF] to-[#492399] transition-all duration-300"
              style={{ width: `${Math.max(5, progress)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* =============================== MAIN =============================== */

export default function Result({ results }) {
  if (!Array.isArray(results) || results.length === 0) return null;

  // ✅ ONLY IMAGE PHOTO CREATIONS
  const photoResults = useMemo(
    () =>
      results.filter(
        (r) =>
          r?.settings?.creation_type === CREATION_TYPES.PHOTO &&
          !isExpired(r)
      ),
    [results],
  );

  if (photoResults.length === 0) return null;

  return (
    <div className="w-full bg-[#ECE8F2] p-4">
      <h1 className="text-[#110829] font-semibold text-[20px] mb-4">
        Your Creations
      </h1>

      <div className="
        grid
        grid-cols-2
        md:grid-cols-3
        lg:grid-cols-4
        gap-4
      ">
        {photoResults.map((item) => (
          <ResultCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
