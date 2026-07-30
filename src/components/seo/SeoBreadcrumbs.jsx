import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export default function SeoBreadcrumbs({ items }) {
  if (!items?.length) return null;
  return (
    <nav aria-label="Breadcrumb" className="mx-auto max-w-[1200px] px-4 pt-5 sm:px-6">
      <ol className="flex flex-wrap items-center gap-1.5 text-[12px] text-white/40">
        {items.map((item, index) => (
          <li key={item.to} className="flex items-center gap-1.5">
            {index > 0 && <ChevronRight className="h-3 w-3 text-white/20" />}
            {index === items.length - 1 ? (
              <span className="font-semibold text-white/70">{item.label}</span>
            ) : (
              <Link to={item.to} className="transition hover:text-white/70">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
