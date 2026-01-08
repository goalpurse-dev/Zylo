// src/components/NewsBar.jsx
import React, { useEffect, useState } from "react";
import { X } from "lucide-react";

export default function NewsBar({
  message = "new zylo ads with avatar 3.1 launched🎉",
  href = "/changelog",
  showAt = 120,
  sessionKey = "newsbar:dismissed:v2",
  highlight = /ads with avatar 3\.1/i, // phrase to colorize
}) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(sessionKey) === "1");
    const onScroll = () => setVisible((window.scrollY || 0) > showAt);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [sessionKey, showAt]);

  const hide = () => {
    setDismissed(true);
    sessionStorage.setItem(sessionKey, "1");
  };

  if (dismissed) return null;

  // Split message around highlight to render gradient span
  const parts = message.split(highlight);
  const hasMatch = highlight.test(message);

  const Content = () => (
    <div className="flex items-center justify-center gap-2">
      <span className="font-extrabold text-black tracking-tight text-base md:text-lg lg:text-xl">
        {parts[0]}
        {hasMatch && (
          <span
            className="bg-gradient-to-r from-[#1677FF] to-[#7A3BFF] bg-clip-text text-transparent"
            aria-label="highlight"
          >
            {message.match(highlight)?.[0] || ""}
          </span>
        )}
        {parts[1]}
      </span>
    </div>
  );

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-out ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
      role="region"
      aria-label="Zylo news"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-3 mt-3 rounded-2xl bg-white text-black shadow-lg ring-1 ring-black/10">
          <div className="relative px-6 py-3 md:px-8 md:py-4">
            {href ? (
              <a
                href={href}
                className="block focus:outline-none focus:ring-2 focus:ring-black/30 rounded"
              >
                <Content />
              </a>
            ) : (
              <Content />
            )}

            <button
              onClick={hide}
              aria-label="Dismiss announcement"
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-black/5"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
