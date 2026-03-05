import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = getCookie("zyvo_cookie_consent");
    if (!consent) setVisible(true);
  }, []);

  const acceptCookies = () => {
    document.cookie =
      "zyvo_cookie_consent=accepted; path=/; max-age=31536000; SameSite=Lax";
    setVisible(false);
  };

  const declineCookies = () => {
    document.cookie =
      "zyvo_cookie_consent=declined; path=/; max-age=31536000; SameSite=Lax";
    setVisible(false);
  };

  if (!visible) return null;

  return createPortal(
    <>
      {/* subtle backdrop */}
      <div className="fixed inset-0 backdrop-blur-[2px] z-[9998]" />

      {/* cookie card */}
      <div
        className="
        fixed
        bottom-6
        right-6
        z-[9999]
        w-[92%]
        sm:w-[420px]
        bg-[#141722]
        border border-white/10
        rounded-xl
        shadow-[0_10px_40px_rgba(0,0,0,0.5)]
        p-6
        text-white
      "
      >
        {/* Title */}
        <h3 className="text-sm font-semibold mb-2">
          Zyvo uses cookies
        </h3>

        {/* Text */}
        <p className="text-sm text-white/70 leading-relaxed mb-5">
          We use cookies to improve performance, analyze traffic, and
          enhance your experience on Zyvo.
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={declineCookies}
            className="
            flex-1
            py-2.5
            rounded-lg
            text-sm
            font-medium
            bg-white/5
            hover:bg-white/10
            transition
            "
          >
            Decline
          </button>

          <button
            onClick={acceptCookies}
            className="
            flex-1
            py-2.5
            rounded-lg
            text-sm
            font-semibold
            bg-gradient-to-r
            from-[#7A3BFF]
            to-[#6F3AE6]
            shadow-lg shadow-purple-600/30
            hover:scale-[1.02]
            transition
            "
          >
            Accept cookies
          </button>
        </div>

        {/* small privacy link */}
        <p className="text-xs text-white/40 mt-4">
          Learn more in our{" "}
          <a href="/privacy" className="underline hover:text-white/70">
            privacy policy
          </a>
          .
        </p>
      </div>
    </>,
    document.body
  );
}