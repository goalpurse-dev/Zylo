// src/components/landing/Sections/BigVisual.jsx
import React from "react";
import Hero from "../../../../assets/landing/herotext.png"; // ✅ imported here

export default function BigVisual() {
  return (
    <section className="py-6">
      <div className="max-w-5xl mx-auto px-6">
        <div className="rounded-2xl overflow-hidden shadow-md bg-[#F6F7F9]">
          <div className="w-full" style={{ aspectRatio: "16 / 9" }}>
            <img
              src={Hero}
              alt="Hero visual"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
