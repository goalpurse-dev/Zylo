import { useEffect } from "react";
import { X } from "lucide-react";

export default function Toast({
  message,
  type = "error", // error | success | info
  onClose,
  duration = 5000,
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const colorStyles = {
    error:
      "bg-red-500/10 border-red-500/30 text-red-400",
    success:
      "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    info:
      "bg-purple-500/10 border-purple-500/30 text-purple-400",
  };

  return (
    <div
      className={`
        fixed top-6 right-6 z-[100]
        px-5 py-4 rounded-xl
        border backdrop-blur-md
        shadow-xl
        animate-[toastIn_0.35s_ease-out]
        ${colorStyles[type]}
      `}
    >
      <div className="flex items-start gap-4">
        <p className="text-sm font-medium">
          {message}
        </p>

        <button
          onClick={onClose}
          className="opacity-60 hover:opacity-100 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
