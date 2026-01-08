import React from "react";
import LogoImg from "../assets/YourNewLogo.png"; // <- your logo file

/**
 * GlowingLogo
 * - Fixed on the left, slightly above middle of the screen
 * - Soft blended glow, no hard outline
 * - Works even if the logo PNG has a square background (feather mask)
 */
export default function GlowingLogo({
  size = 168,       // overall logo size (px)
  left = "3rem",    // distance from left
  top = "34%",      // distance from top
}) {
  const mint = "rgba(62,254,207,1)";

  return (
    <div
      className="pointer-events-none select-none fixed z-[4]"
      style={{ left, top }}
      aria-hidden
    >
      <div className="relative" style={{ width: size, height: size }}>
        {/* Soft aura behind the logo */}
        <div
          className="absolute -inset-8 blur-2xl opacity-70"
          style={{
            background: `radial-gradient(60% 60% at 50% 55%,
              rgba(62,254,207,0.14) 0%,
              rgba(62,254,207,0.06) 35%,
              rgba(62,254,207,0.0) 80%)`,
          }}
        />

        {/* The logo itself – feathered edges + gentle glow, no harsh outline */}
        <img
          src={LogoImg}
          alt="Zylo logo"
          draggable="false"
          className="w-full h-full object-contain"
          style={{
            // Feather the square edges (works in all modern browsers)
            WebkitMaskImage:
              "radial-gradient(circle at 50% 50%, rgba(255,255,255,1) 65%, rgba(255,255,255,0) 95%)",
            maskImage:
              "radial-gradient(circle at 50% 50%, rgba(255,255,255,1) 65%, rgba(255,255,255,0) 95%)",

            // Subtle breathing glow (very light)
            filter:
              "drop-shadow(0 0 6px rgba(62,254,207,0.18)) drop-shadow(0 0 14px rgba(62,254,207,0.10))",
            opacity: 0.96,
            // Optional: makes the mint glow blend more naturally with dark bg
            mixBlendMode: "screen",
            animation: "zyloPulse 6s ease-in-out infinite",
          }}
        />
      </div>

      {/* Keyframes for a super-soft breathing glow */}
      <style>{`
        @keyframes zyloPulse {
          0%, 100% { transform: scale(1); opacity: 0.96; }
          50%      { transform: scale(1.02); opacity: 0.92; }
        }
      `}</style>
    </div>
  );
}
