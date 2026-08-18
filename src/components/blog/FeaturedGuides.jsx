import ArticleCard from "./ArticleCard.jsx";

export default function FeaturedGuides({ articles }) {
  if (!articles.length) return null;
  const [main, ...rest] = articles;
  const small = rest.slice(0, 4);

  return (
    <section className="max-w-6xl mx-auto px-6 py-10">
      <h2 className="text-[#110829] font-bold text-[22px] mb-5">Featured Guides</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ArticleCard article={main} size="large" priority />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {small.map((a) => (
            <ArticleCard key={a.slug} article={a} />
          ))}
        </div>
      </div>
    </section>
  );
}
