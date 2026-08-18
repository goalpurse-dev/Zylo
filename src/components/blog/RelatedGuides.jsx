import ArticleCard from "./ArticleCard.jsx";
import { getRelatedArticles } from "../../data/blogArticles.js";

export default function RelatedGuides({ slug, count = 4 }) {
  const articles = getRelatedArticles(slug, count);
  if (!articles.length) return null;

  return (
    <section className="mt-16">
      <h2 className="text-[#110829] font-bold text-[22px] mb-5 text-center">Related Guides</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {articles.map((a) => (
          <ArticleCard key={a.slug} article={a} />
        ))}
      </div>
    </section>
  );
}
