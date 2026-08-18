import { Link } from "react-router-dom";
import { CATEGORY_SLUGS } from "../../data/blogArticles.js";

const TOPIC_ICONS = {
  "AI Video": "🎬",
  "AI Images": "🖼️",
  "Viral Ideas": "🚀",
  "2AM Worlds": "🌙",
  "Fruit Stories": "🍓",
  "Product Photos": "📦",
  Tutorials: "📘",
  "Growth & Analytics": "📈",
};

export default function ExploreByTopic({ counts }) {
  const topics = Object.keys(CATEGORY_SLUGS);
  return (
    <section className="max-w-6xl mx-auto px-6 py-10">
      <h2 className="text-[#110829] font-bold text-[22px] mb-5">Explore by Topic</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {topics.map((topic) => (
          <Link
            key={topic}
            to={`/blog/category/${CATEGORY_SLUGS[topic]}`}
            className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-4 shadow-sm hover:shadow-md hover:border-[#7A3BFF]/30 transition-all"
          >
            <span className="text-[22px]" aria-hidden="true">{TOPIC_ICONS[topic]}</span>
            <div className="min-w-0">
              <p className="text-[#110829] font-semibold text-[13px] group-hover:text-[#7A3BFF] transition-colors truncate">{topic}</p>
              <p className="text-[#9CA3AF] text-[11px]">{counts[topic] ?? 0} articles</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
