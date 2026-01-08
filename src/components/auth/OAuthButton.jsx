import React from "react";

const icons = {
  google: (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.5 29.4 36 24 36c-6.6 0-12-5.4-12-12S17.4 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34.6 6.3 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-9 20-20 0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16.3 18.9 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34.6 6.3 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.6-5.3l-6.3-5.3C29.4 36 26.9 37 24 37c-5.3 0-9.8-3.4-11.4-8.1l-6.5 5.1C8.4 39.7 15.6 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.5 5.4-6.7 6.4l6.3 5.3C37.1 36.8 40 31 40 24c0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  ),
  apple: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.41 2.08-1.22 2.85-.98.95-2.14 1.1-2.63 1.1-.08-1.1.39-2.2 1.17-3C14.65 1.36 15.59 1 16.37 1c0 .14-.01.28-.01.43zM20.62 17.36c-.41.95-.9 1.83-1.47 2.64-.78 1.12-1.59 2.24-2.86 2.26-1.28.02-1.69-.73-3.15-.73s-1.9.71-3.1.75c-1.24.04-2.19-1.22-2.98-2.34-1.62-2.3-2.87-6.5-1.2-9.34.84-1.46 2.35-2.38 3.99-2.4 1.24-.03 2.41.84 3.15.84.73 0 2.19-1.04 3.69-.89.63.03 2.4.25 3.53 1.92-3.09 1.62-2.59 6.05.4 7.29z"/>
    </svg>
  ),
  github: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .5A12 12 0 0 0 0 12.6c0 5.3 3.4 9.8 8.2 11.4.6.1.8-.2.8-.6v-2c-3.3.8-4-1.5-4-1.5-.5-1.2-1.3-1.5-1.3-1.5-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.8 2.8 1.3 3.5 1 .1-.7.4-1.3.7-1.6-2.7-.3-5.6-1.4-5.6-6.2 0-1.4.5-2.6 1.2-3.5-.1-.3-.5-1.7.1-3.4 0 0 1-.3 3.5 1.3 1-.3 2-.4 3-.4s2 .1 3 .4c2.4-1.6 3.5-1.3 3.5-1.3.7 1.7.3 3.1.2 3.4.8 1 1.2 2.1 1.2 3.5 0 4.8-2.9 5.9-5.6 6.2.4.3.8 1 .8 2.1v3.1c0 .4.2.7.8.6 4.8-1.6 8.2-6.1 8.2-11.4A12 12 0 0 0 12 .5z"/>
    </svg>
  ),
};

export default function OAuthButton({ provider = "google", onClick, children }) {
  const dark = provider === "github";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl border ${
        dark
          ? "bg-black text-white border-black"
          : "bg-white text-black border-gray-300 hover:bg-gray-50"
      }`}
    >
      <span className={dark ? "text-white" : ""}>{icons[provider]}</span>
      <span className="text-sm font-semibold">{children}</span>
    </button>
  );
}
