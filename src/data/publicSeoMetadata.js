export const SITE_URL = "https://www.tryzyvo.com";

const blog = (title, description) => ({ title: `${title} | Zyvo`, description, type: "article" });

// Explicit metadata for the URLs called out in the August 2026 indexing audit.
// Keeping this list route-based prevents legacy page effects from carrying
// metadata across React Router navigations.
export const PUBLIC_SEO_METADATA = {
  "/blog": {
    title: "Zyvo Blog – AI Content Creation Guides",
    description: "Practical guides for creating AI images, product photos, short-form videos, and social content with Zyvo.",
    type: "website",
  },
  "/blog/ai-image-generator-for-content-creators": blog(
    "AI Image Generator for Content Creators",
    "Learn how content creators use AI image generators to produce original social visuals faster and build a consistent publishing workflow.",
  ),
  "/blog/ai-image-generator-vs-traditional-design": blog(
    "AI Image Generators vs Traditional Design",
    "Compare AI image generation with traditional design workflows, including speed, control, cost, and the best use cases for each approach.",
  ),
  "/blog/ai-product-photography-high-end": blog(
    "How to Create High-End AI Product Photography",
    "Create polished product photography with AI using better prompts, lighting direction, composition, and brand-consistent visual choices.",
  ),
  "/blog/ai-script-generator-viral-videos": blog(
    "AI Script Generator for Viral Videos",
    "Use an AI script generator to develop stronger hooks, tighter short-form pacing, and clearer calls to action for social videos.",
  ),
  "/blog/ai-video-generator-tiktok-reels": blog(
    "AI Video Generator for TikTok and Reels",
    "Learn how to plan and create vertical AI videos for TikTok and Instagram Reels with a repeatable short-form workflow.",
  ),
  "/blog/ai-visual-styles-most-engagement": blog(
    "Visual Styles That Get the Most Engagement (AI Edition)",
    "Discover AI visual styles that can help social posts stand out, including cinematic, 3D cartoon, aesthetic, anime, and minimalist approaches.",
  ),
  "/blog/ai-vs-traditional-product-photography": blog(
    "AI vs Traditional Product Photography",
    "Compare AI and traditional product photography across quality, speed, cost, consistency, and ecommerce production needs.",
  ),
  "/blog/best-ai-tools-faceless-tiktok-videos": blog(
    "Best AI Tools for Faceless TikTok Videos",
    "Explore the AI tools and workflow components used to plan, create, edit, and publish faceless TikTok videos.",
  ),
  "/blog/best-face-asmr-video-ideas-2026": blog(
    "Best Face ASMR Video Ideas for 2026",
    "Explore Face ASMR video concepts, hooks, and visual variations for creating distinctive short-form content in 2026.",
  ),
  "/blog/clay-rescue-ai-video-maker": blog(
    "Clay Rescue AI Video Maker Guide",
    "Learn how to create stylized clay rescue videos with AI, from the initial scenario and visual setup to a vertical social-ready result.",
  ),
  "/blog/free-ai-image-generator": blog(
    "Free AI Image Generator Guide",
    "Learn what to look for in a free AI image generator and how to get more useful results from prompts, styles, and aspect ratios.",
  ),
  "/blog/free-viral-ai-tool": blog(
    "Free Viral AI Tool Guide",
    "Explore how AI creation tools can support a repeatable short-form content workflow, from ideation through visual production.",
  ),
  "/blog/how-to-create-movie-style-visuals": blog(
    "How to Create Movie-Style Visuals With AI",
    "Create cinematic AI visuals by controlling composition, lighting, lens language, atmosphere, and color in your prompts.",
  ),
  "/blog/how-to-create-viral-ai-videos": blog(
    "How to Create Viral AI Videos",
    "Build stronger AI videos with a clear hook, recognizable concept, concise story structure, and platform-ready vertical presentation.",
  ),
  "/blog/how-to-make-viral-ai-tiktok-videos": blog(
    "How to Make Viral AI TikTok Videos",
    "Plan and create AI TikTok videos with better hooks, visual consistency, pacing, and repeatable content formats.",
  ),
  "/blog/how-visual-branding-separates-winners-from-losers": blog(
    "How Visual Branding Separates Winners From Losers",
    "Learn how visual consistency, product presentation, hierarchy, and brand recognition shape trust and ecommerce conversions.",
  ),
  "/blog/one-click-publishing-playbook": blog(
    "The One-Click Publishing Playbook",
    "Use a practical cross-platform publishing workflow to prepare, schedule, and distribute short-form content more consistently.",
  ),
  "/blog/product-images-that-convert-full-guide": blog(
    "Product Images That Convert: A Complete Guide",
    "Learn which product image types reduce uncertainty, build visual trust, and help ecommerce shoppers make purchase decisions.",
  ),
  "/blog/product-photos-with-ai-for-shopify": blog(
    "Product Photos With AI for Shopify",
    "Learn how Shopify stores can create consistent AI product photos for product pages, launches, ads, and social content.",
  ),
  "/blog/schedule-auto-publish-ai-videos": blog(
    "How to Schedule and Auto-Publish AI Videos",
    "Build a reliable workflow for scheduling and publishing AI videos across short-form social channels without losing quality control.",
  ),
  "/blog/short-form-video-metrics-that-matter": blog(
    "Short-Form Video Metrics That Matter",
    "Understand the retention, watch-time, completion, replay, and engagement metrics that help creators evaluate short-form videos.",
  ),
  "/blog/studio-quality-product-photos": blog(
    "How to Create Studio-Quality Product Photos",
    "Create cleaner, more consistent product photos by controlling lighting, backgrounds, framing, shadows, and brand presentation.",
  ),
  "/blog/top-ai-image-generator-features-that-matter": blog(
    "Top AI Image Generator Features That Matter",
    "Compare the AI image generator features that affect real creative workflows, including control, quality, consistency, and export options.",
  ),
  "/blog/best-ai-fruit-story-ideas": blog(
    "AI Fruit Story Ideas and Prompt Examples",
    "Explore adaptable AI fruit story ideas and prompts for reveal, family, friendship, comeback, and mystery plots.",
  ),
  "/blog/how-to-go-viral-tiktok-fruit-drama": blog(
    "How to Improve AI Fruit Drama Videos for TikTok",
    "Use clearer opening hooks, testable story structures, sustainable publishing cadence, and audience feedback to improve AI fruit drama videos.",
  ),
  "/blog/ai-fruit-story-character-ideas": blog(
    "AI Fruit Story Character Ideas and Storylines",
    "Explore eight AI fruit character pairings with adaptable workplace, relationship, family, comeback, and romance story hooks.",
  ),  "/blog/ai-fruit-story-talking-dialogue-tips": blog(
    "How to Write Talking Dialogue for AI Fruit Story Videos",
    "Learn how Zyvo's mouth-synced talking characters work and five dialogue-writing techniques that make AI fruit drama videos hit harder.",
  ),
  "/blog/ai-fruit-story-vs-traditional-animation": blog(
    "AI Fruit Story vs Traditional Animation",
    "Compare AI Fruit Story against traditional animation across speed, cost, skill, and character consistency for viral TikTok drama videos.",
  ),
  "/blog/viral-ai-fruit-drama-videos": blog(
    "How to Create Viral AI Fruit Drama Videos",
    "Learn how AI fruit drama videos combine recognizable characters, conflict, scene progression, and vertical short-form presentation.",
  ),
  "/blog/viral-animal-bodycam-videos": blog(
    "How to Create Viral Animal Bodycam Videos",
    "Learn how to structure fictional animal bodycam concepts with a clear premise, immersive point of view, and short-form pacing.",
  ),
  "/blog/viral-face-asmr-videos": blog(
    "How to Create Viral Face ASMR Videos",
    "Learn how Face ASMR videos use close-up visual detail, transformation, sound-led pacing, and repeatable concepts for short-form content.",
  ),
  "/blog/why-giant-hand-rescue-videos-go-viral": blog(
    "Why Giant Hand Rescue Videos Go Viral",
    "Explore the visual storytelling, scale contrast, emotional clarity, and satisfying progression behind stylized rescue-video concepts.",
  ),
  "/blog/why-your-posts-dont-go-viral": blog(
    "Why Your Posts Don’t Go Viral",
    "Diagnose common short-form content problems involving weak hooks, unclear concepts, inconsistent packaging, and poor retention.",
  ),
  "/ai-fruit-story-maker": {
    title: "AI Fruit Story Generator – Create Fruit Drama Videos | Zyvo",
    description: "Create a multi-scene AI fruit story from one idea. Build consistent characters, generate scenes, and animate a vertical fruit drama video with Zyvo.",
    type: "website",
    image: `${SITE_URL}/og-image.png`,
  },
  "/cartoon-drive-by-video-maker": {
    title: "Cartoon Drive-By Video Maker – Create Nostalgic AI Videos | Zyvo",
    description: "Turn a cartoon or game-inspired destination into a fictional 10-second vertical drive-by video with realistic motion, atmosphere, and parallax.",
    type: "website",
    image: `${SITE_URL}/og-image.png`,
  },
};

export function getPublicSeoMetadata(pathname) {
  return PUBLIC_SEO_METADATA[pathname] || null;
}
