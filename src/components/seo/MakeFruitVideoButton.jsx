import { useNavigate } from "react-router-dom";
import { FRUIT_TOOL_PATH } from "../../data/fruitStoryPages.js";
import { stashFruitStory } from "../../lib/promptHandoff.js";
import { trackSeoEvent } from "../../lib/seoAnalytics.js";

/**
 * "Make this video": opens AI Fruit Story on "Describe it" with the prompt and
 * its characters filled in. The prompt travels in sessionStorage, never in the
 * URL (see lib/promptHandoff.js).
 */
export default function MakeFruitVideoButton({ prompt, castIds, slug, className, children = "Make this video" }) {
  const navigate = useNavigate();
  const open = () => {
    stashFruitStory({ prompt, castIds });
    trackSeoEvent("seo_cta_clicked", { slug, placement: "make_this_video" });
    navigate(FRUIT_TOOL_PATH);
  };
  return <button type="button" onClick={open} className={className}>{children}</button>;
}
