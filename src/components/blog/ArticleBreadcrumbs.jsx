import { Link } from "react-router-dom";
import { CATEGORY_SLUGS } from "../../data/blogArticles.js";

export default function ArticleBreadcrumbs({ category, title }) {
  const categorySlug = CATEGORY_SLUGS[category];
  return (
    <nav className="mb-8 text-[13px] text-[#888]" aria-label="Breadcrumb">
      <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
      {category && categorySlug && (
        <>
          <span className="mx-2">/</span>
          <Link to={`/blog/category/${categorySlug}`} className="hover:text-[#7A3BFF]">{category}</Link>
        </>
      )}
      <span className="mx-2">/</span>
      <span className="text-[#6B7280]">{title}</span>
    </nav>
  );
}
