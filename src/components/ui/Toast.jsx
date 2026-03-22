import { createRoot } from "react-dom/client";

let toastContainer = null;

function createContainer() {
  if (toastContainer) return toastContainer;

  const div = document.createElement("div");
  div.className = "fixed top-5 right-5 z-[9999] flex flex-col gap-2";
  document.body.appendChild(div);

  toastContainer = div;
  return div;
}

function showToast(message, type = "default") {
  const container = createContainer();

  const toast = document.createElement("div");

  const base =
    "px-4 py-3 rounded-xl text-sm font-semibold shadow-lg transition-all duration-300";

  const styles = {
    success: "bg-green-500/10 text-green-400 border border-green-500/20",
    error: "bg-red-500/10 text-red-400 border border-red-500/20",
    default: "bg-white/10 text-white border border-white/10",
  };

  toast.className = `${base} ${styles[type] || styles.default}`;
  toast.innerText = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px)";
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

const Toast = {
  success: (msg) => showToast(msg, "success"),
  error: (msg) => showToast(msg, "error"),
  show: (msg) => showToast(msg, "default"),
};

export default Toast;