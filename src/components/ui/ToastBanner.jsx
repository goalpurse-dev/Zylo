import React, { useEffect } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";
import "../../styles/adstudio.css";

/**
 * Props:
 * - type: "ok" | "err"
 * - text: string
 * - onClose: () => void
 * - autoCloseMs?: number (default 2200)
 */
export default function ToastBanner({ type = "ok", text, onClose, autoCloseMs = 2200 }) {
  useEffect(() => {
    const t = setTimeout(() => onClose?.(), autoCloseMs);
    return () => clearTimeout(t);
  }, [autoCloseMs, onClose]);

  return (
    <div className={`zy-toast ${type === "ok" ? "zy-toast--ok" : "zy-toast--err"}`}>
      {type === "ok" ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
      <span>{text}</span>
      <button onClick={onClose} className="ml-1 opacity-80 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
