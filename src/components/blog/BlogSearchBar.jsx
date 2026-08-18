import { Search, X } from "lucide-react";

export default function BlogSearchBar({ value, onChange, resultCount, showCount }) {
  return (
    <div className="max-w-2xl mx-auto px-6">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" aria-hidden="true" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search Zyvo guides, ideas and tutorials..."
          aria-label="Search Zyvo blog articles"
          className="w-full rounded-full bg-white/10 border border-white/15 text-white placeholder-white/40 pl-12 pr-12 py-3.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#9B6FFF] focus:border-transparent backdrop-blur-sm transition"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      {showCount && (
        <p className="text-white/40 text-[13px] mt-3 text-center">
          {resultCount} article{resultCount === 1 ? "" : "s"} found for &quot;{value}&quot;
        </p>
      )}
    </div>
  );
}
