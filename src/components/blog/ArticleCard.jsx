import { Link } from "react-router-dom";
import { Calendar } from "lucide-react";

const CAT_PILL = {
  "AI Video": "bg-blue-100 text-blue-700",
  "AI Images": "bg-cyan-100 text-cyan-700",
  "Viral Ideas": "bg-purple-100 text-purple-700",
  "2AM Worlds": "bg-lime-100 text-lime-700",
  "Fruit Stories": "bg-fuchsia-100 text-fuchsia-700",
  "Product Photos": "bg-emerald-100 text-emerald-700",
  Tutorials: "bg-amber-100 text-amber-700",
  "Growth & Analytics": "bg-violet-100 text-violet-700",
};

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

export default function ArticleCard({ article, size = "default", priority = false }) {
  const isLarge = size === "large";
  return (
    <Link
      to={article.slug}
      className={`group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg border border-gray-100 transition-all duration-200 hover:-translate-y-0.5 flex flex-col ${
        isLarge ? "md:flex-row" : ""
      }`}
    >
      <div className={`relative overflow-hidden bg-gray-100 ${isLarge ? "h-56 md:h-auto md:w-1/2 shrink-0" : "h-44"}`}>
        <img
          src={article.image}
          alt={article.title}
          width={isLarge ? 640 : 400}
          height={isLarge ? 400 : 240}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          {...(priority ? { fetchPriority: "high" } : {})}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <span
          className={`absolute top-3 left-3 text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm ${
            CAT_PILL[article.category] || "bg-gray-100 text-gray-700"
          }`}
        >
          {article.category}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1 justify-center">
        <h2
          className={`text-[#110829] font-semibold leading-snug line-clamp-2 group-hover:text-[#7A3BFF] transition-colors duration-150 ${
            isLarge ? "text-[20px] md:text-[24px]" : "text-[14px]"
          }`}
        >
          {article.title}
        </h2>
        <p className={`text-[#6B7280] leading-relaxed line-clamp-2 flex-1 ${isLarge ? "text-[14px] md:text-[15px]" : "text-[12px]"}`}>
          {article.description}
        </p>
        <div className="flex items-center gap-1.5 pt-2 mt-auto">
          <Calendar className="w-3 h-3 text-[#9CA3AF]" />
          <span className="text-[#9CA3AF] text-[11px]">{formatDate(article.publishedAt)}</span>
        </div>
      </div>
    </Link>
  );
}
