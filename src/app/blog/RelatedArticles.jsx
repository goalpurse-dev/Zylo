import { Calendar } from "lucide-react";
import { Link } from "react-router-dom";

export default function RelatedArticles({ articles = [] }) {
  if (!articles.length) return null;

  return (
    <>
      {/* Title */}
      <div className="flex justify-center mt-4 max-w-4xl mx-auto">
        <h1 className="text-[#110829] font-semibold text-[18px]">
          Related Articles
        </h1>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 px-6 mt-4 gap-4 max-w-5xl mx-auto">
        {articles.map((article) => (
          <Link
            key={article.slug}
            to={article.slug}
            className="bg-white p-4 rounded-md border border-[#110829] transition-colors hover:border-[#7A3BFF]"
          >
            <div className="gap-2 flex flex-col">
              <h2 className="text-black text-[14px] font-medium">
                {article.title}
              </h2>

              <p className="text-[#4A4A55] text-[12px]">
                {article.description}
              </p>

              <div className="flex items-center">
                <Calendar className="text-[#4A4A55] w-3 h-3 mr-1" />
                <p className="text-[#4A4A55] text-[10px]">
                  {article.date}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
