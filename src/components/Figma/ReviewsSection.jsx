import React from "react";

const reviews = [
  {
    text: "Zyvo completely changed how I create content. What used to take me hours now takes minutes. The results actually perform on TikTok and Reels.",
    name: "Marcus Lee",
    role: "Content Creator • 120K Followers",
    avatar: "/avatars/4.webp",
  },
  {
    text: "I've tested dozens of AI tools, but Zyvo feels built for growth. The styles are optimized for engagement, not just aesthetics.",
    name: "Sofia Martinez",
    role: "Short-Form Video Creator",
    avatar: "/avatars/1.webp",
  },
  {
    text: "As someone running multiple theme pages, Zyvo helps me scale faster without hiring editors. It's my unfair advantage.",
    name: "Daniel Carter",
    role: "Social Media Entrepreneur",
    avatar: "/avatars/2.webp",
  },
];

function StarRow() {
  return (
    <div className="flex gap-1 mb-6">
      {[...Array(5)].map((_, i) => (
        <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.97a1 1 0 00.95.69h4.173c.969 0 1.371 1.24.588 1.81l-3.376 2.455a1 1 0 00-.364 1.118l1.287 3.97c.3.921-.755 1.688-1.54 1.118l-3.376-2.455a1 1 0 00-1.175 0l-3.376 2.455c-.784.57-1.838-.197-1.539-1.118l1.287-3.97a1 1 0 00-.364-1.118L2.026 9.397c-.783-.57-.38-1.81.588-1.81h4.173a1 1 0 00.95-.69l1.286-3.97z" />
        </svg>
      ))}
    </div>
  );
}

export default function ReviewsSection() {
  return (
    <section className="w-full bg-[#F7F5FA] py-12 md:py-18 px-6 cursor-default overflow-hidden">
      <div className="max-w-6xl mx-auto text-center">

        <h2 className="text-4xl md:text-5xl font-semibold text-gray-900 mb-10 md:mb-16">
          Loved by Growing Creators
        </h2>

        {/* Desktop: 3-column grid */}
        <div className="hidden md:grid md:grid-cols-3 gap-8">
          {reviews.map((review, index) => (
            <div key={index} className="bg-white p-8 rounded-3xl shadow-lg shadow-black/5 text-left">
              <StarRow />
              <p className="text-gray-700 leading-relaxed mb-8">"{review.text}"</p>
              <div className="flex items-center gap-4">
                <img src={review.avatar} alt={review.name} className="w-12 h-12 rounded-full object-cover" />
                <div>
                  <p className="font-semibold text-gray-900">{review.name}</p>
                  <p className="text-sm text-gray-500">{review.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: horizontal snap carousel */}
        <div className="md:hidden -mx-6 px-6">
          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {reviews.map((review, index) => (
              <div
                key={index}
                className="snap-center shrink-0 w-[80vw] bg-white p-6 rounded-3xl shadow-lg shadow-black/5 text-left"
              >
                <StarRow />
                <p className="text-gray-700 leading-relaxed mb-6 text-sm">"{review.text}"</p>
                <div className="flex items-center gap-3">
                  <img src={review.avatar} alt={review.name} className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{review.name}</p>
                    <p className="text-xs text-gray-500">{review.role}</p>
                  </div>
                </div>
              </div>
            ))}
            {/* Trailing spacer so last card doesn't sit at edge */}
            <div className="shrink-0 w-2" />
          </div>

          {/* Dot indicators */}
          <div className="flex justify-center gap-1.5 mt-4">
            {reviews.map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#7A3BFF]/30" />
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
