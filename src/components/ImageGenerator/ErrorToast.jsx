import { useEffect, useState } from "react";
import { X } from "lucide-react";

export default function ErrorToast({ message, type = "error", duration = 4000, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);

    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      onClose?.();
    }, 300);
  };

  const colors = {
    error: "bg-red-500/90 border-red-400",
    success: "bg-green-500/90 border-green-400",
    info: "bg-blue-500/90 border-blue-400"
  };

  return (
    <div
      className={`
        fixed top-6 right-6 z-[9999]
        transform transition-all duration-300
        ${visible ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0"}
      `}
    >
      <div
        className={`
          min-w-[280px] max-w-[360px]
          text-white
          border
          shadow-xl
          rounded-xl
          backdrop-blur-lg
          px-4 py-3
          flex items-start gap-3
          ${colors[type]}
        `}
      >
        <div className="flex-1 text-sm font-medium leading-relaxed">
          {message}
        </div>

        <button
          onClick={handleClose}
          className="opacity-80 hover:opacity-100 transition"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}