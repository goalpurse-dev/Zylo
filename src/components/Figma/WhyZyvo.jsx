import React from "react";
import { Target, Rocket, Zap } from "lucide-react";

export default function WhyZyvo() {
  return (
    <section className="w-full bg-[#F7F5FA] py-28 px-6">
      <div className="max-w-6xl mx-auto text-center">

        {/* Title */}
        <h2 className="text-4xl md:text-5xl font-semibold text-gray-900 mb-6 cursor-default">
          Why Zyvo Is Different
        </h2>

        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-20 cursor-default">
          Built for creators who care about growth — not just generating content.
        </p>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-8">

          {/* Card 1 */}
          <div className="group relative bg-white p-10 rounded-3xl border border-purple-100 hover:border-purple-300 transition-all duration-300 hover:-translate-y-2 shadow-sm hover:shadow-xl">
            
            {/* Icon */}
            <div className="mb-8 inline-flex p-4 rounded-2xl bg-purple-50 group-hover:bg-purple-100 transition">
              <Target className="w-8 h-8 text-[#7A3BFF]" />
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-4 cursor-default">
              Built for Growth
            </h3>

            <p className="text-gray-600 leading-relaxed cursor-default">
              Every tool inside Zyvo is designed to maximize attention,
              engagement, and viral potential — not just aesthetics.
            </p>
          </div>

          {/* Card 2 */}
          <div className="group relative bg-white p-10 rounded-3xl border border-purple-100 hover:border-purple-300 transition-all duration-300 hover:-translate-y-2 shadow-sm hover:shadow-xl">
            
            <div className="mb-8 inline-flex p-4 rounded-2xl bg-purple-50 group-hover:bg-purple-100 transition">
              <Rocket className="w-8 h-8 text-[#7A3BFF]" />
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-4 cursor-default">
              Viral Engine
            </h3>

            <p className="text-gray-600 leading-relaxed cursor-default">
              Advanced AI models trained to generate scroll-stopping visuals
              that perform on modern social platforms.
            </p>
          </div>

          {/* Card 3 */}
          <div className="group relative bg-white p-10 rounded-3xl border border-purple-100 hover:border-purple-300 transition-all duration-300 hover:-translate-y-2 shadow-sm hover:shadow-xl">
            
            <div className="mb-8 inline-flex p-4 rounded-2xl bg-purple-50 group-hover:bg-purple-100 transition">
              <Zap className="w-8 h-8 text-[#7A3BFF]" />
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-4 cursor-default">
              Fast Content Factory
            </h3>

            <p className="text-gray-600 leading-relaxed cursor-default">
              Go from idea → finished post in under 60 seconds.
              No complex editing. No wasted time.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
}