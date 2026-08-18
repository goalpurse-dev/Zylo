import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  CATEGORIES,
  getPublishedArticles,
  getCategoryCounts,
  getFeatured,
  getLatest,
  getPopular,
  searchArticles,
} from "../../data/blogArticles.js";
import Footer from "../../components/workspace/footer.jsx";
import ArticleCard from "../../components/blog/ArticleCard.jsx";
import BlogSearchBar from "../../components/blog/BlogSearchBar.jsx";
import CategoryPills from "../../components/blog/CategoryPills.jsx";
import FeaturedGuides from "../../components/blog/FeaturedGuides.jsx";
import LatestFromZyvo from "../../components/blog/LatestFromZyvo.jsx";
import PopularRightNow from "../../components/blog/PopularRightNow.jsx";
import ExploreByTopic from "../../components/blog/ExploreByTopic.jsx";

const INITIAL_VISIBLE = 15;

export default function BlogIndex() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading] = useState(false);

  const allArticles = getPublishedArticles();
  const counts = getCategoryCounts();
  const featured = getFeatured();
  const latest = getLatest(6);
  const popular = getPopular();

  const filtered = useMemo(() => {
    const base = query ? searchArticles(query) : allArticles;
    return activeCategory === "All" ? base : base.filter((a) => a.category === activeCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeCategory]);

  const visible = expanded || query ? filtered : filtered.slice(0, INITIAL_VISIBLE);
  const hasMore = !query && !expanded && filtered.length > INITIAL_VISIBLE;

  return (
    <section className="bg-[#F7F5FA] min-h-screen">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0E0C15] via-[#150d2e] to-[#0E0C15] px-6 py-16 md:py-20">
        <div className="max-w-4xl mx-auto text-center mb-10">
          <span className="inline-block bg-white/10 text-white/60 text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-widest mb-5">
            Insights & Guides
          </span>
          <h1 className="text-white font-extrabold text-[32px] md:text-[44px] leading-tight">
            Zyvo{" "}
            <span className="bg-gradient-to-r from-[#9B6FFF] to-[#C084FC] bg-clip-text text-transparent">
              Blog
            </span>
          </h1>
          <p className="text-white/50 mt-3 text-[14px] md:text-[15px] max-w-xl mx-auto leading-relaxed">
            AI creation ideas, viral strategies, tutorials and growth guides for creators.
          </p>
        </div>
        <BlogSearchBar value={query} onChange={setQuery} resultCount={filtered.length} showCount={!!query} />
      </div>

      {/* Category Tabs */}
      <div className="sticky top-0 z-10 bg-[#F7F5FA] border-b border-gray-200 shadow-sm">
        <CategoryPills categories={CATEGORIES} counts={counts} active={activeCategory} onSelect={setActiveCategory} />
      </div>

      {!query && activeCategory === "All" && (
        <>
          <FeaturedGuides articles={featured} />
          <LatestFromZyvo articles={latest} />
          <PopularRightNow articles={popular} />
          <ExploreByTopic counts={counts} />
        </>
      )}

      {/* Main grid */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h2 className="text-[#110829] font-bold text-[22px] mb-5">
          {query ? `Search Results` : activeCategory === "All" ? "All Articles" : activeCategory}
        </h2>
        {visible.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[#6B7280] text-[15px]">No articles found. Try a different search or category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((article, i) => (
              <div key={article.slug} className={i < INITIAL_VISIBLE || expanded || query ? "" : "hidden"}>
                <ArticleCard article={article} />
              </div>
            ))}
          </div>
        )}
        {hasMore && (
          <div className="flex justify-center mt-8">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="px-8 py-3 rounded-full bg-white border border-gray-200 text-[#110829] font-semibold text-[14px] shadow-sm hover:shadow-md hover:border-[#7A3BFF]/40 transition"
            >
              Load more articles
            </button>
          </div>
        )}
      </div>

      {/* Ready to Create CTA */}
      <div className="max-w-4xl mx-auto px-6 py-14 text-center">
        <h2 className="text-[#110829] font-bold text-[26px] mb-3">Ready to Create?</h2>
        <p className="text-[#6B7280] text-[15px] mb-6">Turn these ideas into videos and images with Zyvo.</p>
        <Link
          to="/signup"
          className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
        >
          Start Creating
        </Link>
      </div>

      {/* Suggestion Box */}
      <div className="mt-4 mb-10">
        <div className="flex items-center flex-col max-w-2xl mx-auto px-6">
          <h2 className="text-[#110829] font-semibold text-[18px]">
            Do you have improvement suggestions for Zyvo?
          </h2>
          <div className="bg-white border border-gray-200 p-4 w-full mt-4 rounded-xl shadow-sm">
            <textarea
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              className="mt-2 w-full h-24 p-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-[#7A3BFF] text-[#110829]"
              placeholder="Your suggestions..."
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={async () => {
                  if (!suggestion.trim()) return;
                  setLoading(true);
                  const { error } = await supabase
                    .from("suggestions")
                    .insert([{ message: suggestion }]);
                  if (!error) setSuggestion("");
                  setLoading(false);
                }}
                disabled={loading}
                className="bg-[#7A3BFF] text-white px-6 py-2 rounded-md shadow-md hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Sending..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-col">
        <Footer />
      </div>
    </section>
  );
}
