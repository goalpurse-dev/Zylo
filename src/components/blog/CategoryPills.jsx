export default function CategoryPills({ categories, counts, active, onSelect }) {
  return (
    <div className="max-w-6xl mx-auto px-6 flex gap-1 py-3 overflow-x-auto">
      {categories.map((cat) => {
        const isActive = active === cat;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onSelect(cat)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all duration-150 shrink-0 ${
              isActive
                ? "bg-[#110829] text-white shadow-sm"
                : "text-[#6B7280] hover:bg-gray-200 hover:text-[#110829]"
            }`}
          >
            {cat}
            <span
              className={`text-[11px] px-1.5 py-0.5 rounded-full font-normal ${
                isActive ? "bg-white/20 text-white" : "bg-gray-200 text-gray-500"
              }`}
            >
              {counts[cat] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
