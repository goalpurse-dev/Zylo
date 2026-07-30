import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function SeoRelatedTools({ pages, heading = "Explore More AI Worlds" }) {
  if (!pages?.length) return null;
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6">
      <h2 className="text-[20px] font-black tracking-[-0.02em] text-white">{heading}</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((page) => (
          <Link
            key={page.slug}
            to={`/${page.slug}`}
            className="group flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 transition hover:border-lime-300/25 hover:bg-white/[0.05]"
          >
            <div className="min-w-0">
              <p className="truncate text-[14px] font-bold text-white">{page.hero?.heading || page.seo.title}</p>
              <p className="mt-1 truncate text-[12px] text-white/40">{page.seo.description}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-lime-300" />
          </Link>
        ))}
      </div>
    </section>
  );
}
