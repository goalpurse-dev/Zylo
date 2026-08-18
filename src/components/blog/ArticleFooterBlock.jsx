import RelatedGuides from "./RelatedGuides.jsx";
import ToolCTA from "./ToolCTA.jsx";
import BackToBlogLink from "./BackToBlogLink.jsx";
import { getArticleBySlug } from "../../data/blogArticles.js";

// Mandatory tail for every new article going forward: Related Guides (auto
// tag/category-ranked), a Tool CTA when the registry entry defines relatedTool,
// and a Back to Zyvo Blog link. Looks up the article by its own route pathname
// so callers only need to pass the slug once.
export default function ArticleFooterBlock({ slug }) {
  const article = getArticleBySlug(slug);

  return (
    <>
      <RelatedGuides slug={slug} />
      <ToolCTA relatedTool={article?.relatedTool} />
      <BackToBlogLink />
    </>
  );
}
