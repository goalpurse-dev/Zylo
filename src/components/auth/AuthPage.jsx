import { useEffect } from "react";
import { Link } from "react-router-dom";
import Logo from "../../assets/Logo.png";

/**
 * The page around the password-reset steps (/auth/forgot, /auth/confirm,
 * /auth/reset): the Zyvo logo over one card, in the look of the sign-in dialog.
 * These pages are never indexed.
 */
export default function AuthPage({ title, children }) {
  useEffect(() => {
    document.title = `${title} | Zyvo`;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [title]);

  return (
    <div className="min-h-screen bg-[#090A0A] flex flex-col items-center justify-center px-4 py-10">
      <Link to="/" className="flex items-center gap-2 mb-6" aria-label="Zyvo home">
        <img src={Logo} alt="" className="w-8 h-8 object-contain" />
        <span className="text-white font-black text-lg tracking-tight">Zyvo</span>
      </Link>
      <div className="w-full max-w-[420px] rounded-2xl bg-[#1B1D1F] p-7 shadow-[0_32px_80px_rgba(0,0,0,0.6)]">
        {children}
      </div>
      <p className="text-white/30 text-xs mt-6">
        Need help? <a href="mailto:support@tryzyvo.com" className="text-white/50 hover:text-white/80 underline">support@tryzyvo.com</a>
      </p>
    </div>
  );
}
