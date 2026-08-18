import { Link } from "react-router-dom";
import Footer from "../../components/workspace/footer.jsx";
import ArticleCard from "../../components/blog/ArticleCard.jsx";
import { getArticlesByCategory } from "../../data/blogArticles.js";

// Takes an explicit `category` prop (one literal <Route> per category in
// App.jsx) rather than reading a URL param, matching this codebase's existing
// convention for multi-instance pages (e.g. SeoLandingPage) — this also keeps
// every category URL a real static route, which generateSitemap.js requires.
export default function BlogCategoryPage({ category }) {
  const articles = category ? getArticlesByCategory(category) : [];

  if (!category) {
    return (
      <section className="bg-[#F7F5FA] min-h-screen">
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <h1 className="text-[#110829] font-bold text-[28px] mb-4">Category not found</h1>
          <Link to="/blog" className="text-[#7A3BFF] font-semibold hover:underline">← Back to Zyvo Blog</Link>
        </div>
        <Footer />
      </section>
    );
  }

  return (
    <section className="bg-[#F7F5FA] min-h-screen">
      <div className="bg-gradient-to-br from-[#0E0C15] via-[#150d2e] to-[#0E0C15] px-6 py-16 md:py-20">
        <div className="max-w-4xl mx-auto text-center">
          <nav className="mb-5 text-[13px] text-white/40">
            <Link to="/blog" className="hover:text-white/70">Blog</Link>
            <span className="mx-2">/</span>
            <span className="text-white/60">{category}</span>
          </nav>
          <h1 className="text-white font-extrabold text-[28px] md:text-[38px] leading-tight">{category}</h1>
          <p className="text-white/50 mt-3 text-[14px] md:text-[15px] max-w-xl mx-auto leading-relaxed">
            {articles.length} article{articles.length === 1 ? "" : "s"} on {category.toLowerCase()}.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {articles.length === 0 ? (
          <p className="text-[#6B7280] text-[15px] text-center py-16">No articles in this category yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {articles.map((article, i) => (
              <ArticleCard key={article.slug} article={article} priority={i < 3} />
            ))}
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-14 text-center">
        <Link to="/blog" className="inline-block text-[14px] font-semibold text-[#7A3BFF] hover:underline">
          ← Back to Zyvo Blog
        </Link>
      </div>

      <Footer />
    </section>
  );
}
