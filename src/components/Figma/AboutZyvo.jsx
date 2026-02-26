import React from "react";

export default function AboutZyvo() {
  return (
    <section className="relative w-full py-32 px-6 bg-gradient-to-b from-[#F7F5FA] to-white overflow-hidden">

      {/* Soft radial background accent */}
      <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 bg-purple-100/40 blur-3xl rounded-full -z-10" />

      <div className="max-w-4xl mx-auto text-center">

        {/* Title */}
        <h2 className="text-4xl md:text-5xl font-semibold text-gray-900 mb-12">
          About Zyvo
        </h2>

        {/* Main Statement */}
        <p className="text-2xl md:text-3xl font-medium text-gray-900 leading-relaxed mb-10">
          Zyvo was built to help more people go viral.
        </p>

        {/* Story */}
        <p className="text-lg text-gray-600 leading-relaxed mb-8">
          The founder of Zyvo faced the same frustration most creators experience —
          posting consistently, improving quality, yet never truly breaking through.
        </p>

        <p className="text-lg text-gray-600 leading-relaxed mb-12">
          Instead of guessing what works, he built the tools he wished existed —
          tools designed specifically to unlock growth, speed, and visibility.
        </p>

        {/* Signature Line */}
        <div className="inline-block px-6 py-3 rounded-full bg-purple-50 border border-purple-100 text-[#7A3BFF] font-medium">
          Built by creators, for creators.
        </div>

      </div>
    </section>
  );
}