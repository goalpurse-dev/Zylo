import ArticleCard from "./ArticleCard.jsx";

export default function PopularRightNow({ articles }) {
  if (!articles.length) return null;
  return (
    <section className="max-w-6xl mx-auto px-6 py-10">
      <h2 className="text-[#110829] font-bold text-[22px] mb-5">Popular Right Now</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {articles.map((a) => (
          <ArticleCard key={a.slug} article={a} />
        ))}
      </div>
    </section>
  );
}
