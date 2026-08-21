export const SITE_URL = "https://www.tryzyvo.com";

const blog = (title, description) => ({ title: `${title} | Zyvo`, description, type: "article" });

// Explicit metadata for the URLs called out in the August 2026 indexing audit.
// Keeping this list route-based prevents legacy page effects from carrying
// metadata across React Router navigations.
export const PUBLIC_SEO_METADATA = {
  "/image-generator": {
    title: "AI Image Generator – Cinematic, 3D, Anime & Product Images | Zyvo",
    description: "Generate cinematic, 3D, anime, realistic, and product-ready images from a single prompt with Zyvo's AI image generator — free to start.",
    type: "website",
  },
  "/blog": {
    title: "Zyvo Blog – AI Creation Ideas, Tutorials & Viral Strategies",
    description: "Explore Zyvo guides, AI content ideas, viral strategies, tutorials and creator growth resources.",
    type: "website",
  },
  "/blog/category/ai-video": {
    title: "AI Video Guides & Tutorials | Zyvo Blog",
    description: "Guides on Zyvo's AI video tools — Behind the Scenes, Clay Rescue, Face ASMR, Cartoon Drive-By, Footballer Nationality Swap, and more.",
    type: "website",
  },
  "/blog/category/ai-images": {
    title: "AI Image Generation Guides | Zyvo Blog",
    description: "Prompt techniques, style breakdowns, and trend guides for AI image generation with Zyvo.",
    type: "website",
  },
  "/blog/category/viral-ideas": {
    title: "Viral Content Ideas & Strategy | Zyvo Blog",
    description: "Strategy, trend-spotting, and growth guides for going viral with AI content on TikTok, Reels, and Shorts.",
    type: "website",
  },
  "/blog/category/2am-worlds": {
    title: "2AM Worlds Guides & Prompts | Zyvo Blog",
    description: "Everything on the 2AM Worlds AI trend — prompt formulas, world ideas, and platform-specific creator guides.",
    type: "website",
  },
  "/blog/category/fruit-stories": {
    title: "AI Fruit Story Guides & Ideas | Zyvo Blog",
    description: "Prompt formulas, character ideas, plot twists, and entertaining guides for Zyvo's AI Fruit Story maker.",
    type: "website",
  },
  "/blog/category/product-photos": {
    title: "AI Product Photography Guides | Zyvo Blog",
    description: "Guides on creating AI product photos for ecommerce, Shopify, dropshipping, and social media.",
    type: "website",
  },
  "/blog/category/tutorials": {
    title: "Zyvo Tutorials & How-To Guides | Zyvo Blog",
    description: "Step-by-step tutorials for creating, generating, and publishing AI content with Zyvo.",
    type: "website",
  },
  "/blog/category/growth-analytics": {
    title: "Creator Growth & Analytics Guides | Zyvo Blog",
    description: "Publishing, scheduling, and analytics guides to help creators grow consistently with Zyvo.",
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
  "/blog/why-product-photos-matter-for-ecommerce-success": blog(
    "Why Product Photos Matter for Ecommerce Success",
    "Your product image is your ad's landing page. See why product photo quality drives buyer trust and conversion more than the ad that got the click.",
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
  "/blog/best-ai-fruit-story-ideas": {
    ...blog(
      "50 AI Fruit Story Prompts and Viral Drama Ideas",
      "50 fruit story AI prompts across reveal, family, friendship, comeback, workplace, and wedding-drama plots — copy and paste straight into the generator.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-ideas-hero.png`,
  },
  "/blog/how-to-go-viral-tiktok-fruit-drama": {
    ...blog(
      "How to Improve AI Fruit Drama Videos for TikTok",
      "Use clearer opening hooks, testable story structures, sustainable publishing cadence, and audience feedback to improve AI fruit drama videos.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-tiktok-strategy-hero.png`,
  },
  "/blog/ai-fruit-story-character-ideas": {
    ...blog(
      "AI Fruit Story Character Ideas and Storylines",
      "Explore eight AI fruit character pairings with adaptable workplace, relationship, family, comeback, and romance story hooks.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-characters-hero.png`,
  },
  "/blog/ai-fruit-story-talking-dialogue-tips": {
    ...blog(
      "How to Write Talking Dialogue for AI Fruit Story Videos",
      "Learn how Zyvo's mouth-synced talking characters work and five dialogue-writing techniques that make AI fruit drama videos hit harder.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-dialogue-hero.png`,
  },
  "/blog/ai-fruit-story-vs-traditional-animation": {
    ...blog(
      "AI Fruit Story vs Traditional Animation",
      "Compare AI Fruit Story against traditional animation across speed, cost, skill, and character consistency for viral TikTok drama videos.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-vs-animation-hero.png`,
  },
  "/blog/ai-fruit-story-prompt-formula": {
    ...blog(
      "How to Write the Perfect AI Fruit Story Prompt",
      "A repeatable 6-part prompt formula for AI Fruit Story, with weak-vs-strong examples and a formula variant for each drama type.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-prompt-formula-thumb.png`,
  },
  "/blog/ai-fruit-story-instagram-youtube-shorts": {
    ...blog(
      "How to Post AI Fruit Story Videos on Instagram and YouTube Shorts",
      "Platform-by-platform differences and a repeatable cross-posting workflow for AI Fruit Story videos on TikTok, Reels, and Shorts.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-shorts-reels-thumb.png`,
  },
  "/blog/ai-fruit-story-plot-twists": {
    ...blog(
      "The Wildest AI Fruit Story Plot Twists (And How to Write Your Own)",
      "Five twist structures that outperform a straightforward reveal, with real examples and a repeatable method for building your own shocking twist.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-plot-twist-hero.png`,
  },
  "/blog/ai-fruit-story-couples": {
    ...blog(
      "The Most Iconic AI Fruit Story Couples (And How to Ship Your Own)",
      "Four pairing dynamics worth building a series around, and a practical method for designing your own AI Fruit Story pairing.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-couples-hero.png`,
  },
  "/blog/ai-fruit-story-duets-stitches": {
    ...blog(
      "How to Use TikTok Duets and Stitches to Make Your AI Fruit Story Go Viral",
      "How to structure an AI Fruit Story video so it's built to get duetted and stitched, plus what makes a clip reaction-friendly.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-duets-hero.png`,
  },
  "/blog/ai-fruit-story-series-universe": {
    ...blog(
      "How to Build an AI Fruit Story Series (Turn One Video Into a Cinematic Universe)",
      "Four pillars of a fruit story universe — recurring cast, consistent world, cross-video threads — and a simple way to start your first series.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-universe-hero.png`,
  },
  "/blog/ai-fruit-story-mistakes": {
    ...blog(
      "10 Mistakes Killing Your AI Fruit Story Views (And How to Fix Each One)",
      "The ten most common structural mistakes in AI Fruit Story videos, with a specific fix for each one.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-mistakes-hero.png`,
  },
  "/blog/ai-fruit-story-unhinged-plots": {
    ...blog(
      "The Most Unhinged AI Fruit Story Plots We've Ever Generated",
      "Ten genuinely deranged AI fruit-drama premises, ranked by chaos level, that you're fully welcome to steal word for word.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-unhinged-plots-hero.png`,
  },
  "/blog/ai-fruit-story-quiz": {
    ...blog(
      "Which AI Fruit Story Character Are You? Take the Quiz",
      "A five-question quiz matching you to one of five recurring AI Fruit Story characters, with story ideas for your result.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-quiz-hero.png`,
  },
  "/blog/ai-fruit-story-drama-tier-list": {
    ...blog(
      "Every AI Fruit Story Drama Type, Ranked From Petty to Unhinged",
      "A tier-list ranking of every AI fruit-drama plot type, from reliable comfort-food conflict to full meltdown.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-tier-list-hero.png`,
  },
  "/blog/ai-fruit-story-craziest-generation": {
    ...blog(
      "We Generated the Most Unhinged AI Fruit Story Possible — Here's What Happened",
      "A scene-by-scene breakdown of one deliberately chaotic AI Fruit Story prompt, and why it still landed cleanly.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-craziest-generation-hero.png`,
  },
  "/blog/ai-fruit-story-fan-theories": {
    ...blog(
      "8 AI Fruit Story Fan Theories That Are Probably True",
      "Playful lore theories connecting the recurring AI Fruit Story cast into one shared cinematic universe.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-fan-theories-hero.png`,
  },
  "/blog/ai-fruit-story-best-lines": {
    ...blog(
      "The Most Iconic AI Fruit Story Lines Ever Written (Ranked)",
      "Eight of the format's most quotable lines, who said them, and the structural reason each one works.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-best-lines-hero.png`,
  },
  "/blog/ai-fruit-story-group-chat": {
    ...blog(
      "If AI Fruit Story Characters Had a Group Chat",
      "A comedic look at what the cast's messages would look like between episodes, plus why the bit works as a bonus content format.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-group-chat-hero.png`,
  },
  "/blog/what-is-ai-fruit-story": {
    ...blog(
      "What Is AI Fruit Story? The Complete Guide to TikTok's Viral Cartoon Drama Trend",
      "What AI Fruit Story is, how the generator actually builds a story from one prompt, why the format is going viral, and how to make your own — with a full FAQ.",
    ),
    image: `${SITE_URL}/blog-assets/what-is-ai-fruit-story-hero.png`,
  },
  "/blog/ai-fruit-story-examples": {
    ...blog(
      "6 Real AI Fruit Story Examples You Can Recreate in Minutes",
      "Real preset screenshots from Zyvo's AI Fruit Story generator, with the exact opening dialogue used in each and what makes every preset work.",
    ),
    image: `${SITE_URL}/viral-builder/ai-fruit/presets/cheating.webp`,
  },
  "/blog/ai-image-generator-prompt-formula": {
    ...blog(
      "How to Write the Perfect AI Image Generator Prompt (Formula + Examples)",
      "A repeatable 6-part prompt formula for AI image generation, with weak-vs-strong examples for cinematic, product, and anime styles.",
    ),
    image: `${SITE_URL}/blog-assets/ai-image-generator-prompt-formula-hero.png`,
  },
  "/blog/ai-image-generator-examples": {
    ...blog(
      "AI Image Generator Examples: 8 Real Styles You Can Create Right Now",
      "Real output across Zyvo's cinematic, 3D, and realistic AI image styles, and what each one is actually good at.",
    ),
    image: `${SITE_URL}/legacy-blog-assets/astronaut.jpg`,
  },
  "/blog/ai-fruit-story-pricing": {
    ...blog(
      "Is AI Fruit Story Free? Pricing, Credits, and What You Actually Get",
      "AI Fruit Story runs on credits, not a flat per-video price — character portraits, scene images, and scene video, explained.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-pricing-hero.png`,
  },
  "/blog/ai-fruit-story-time": {
    ...blog(
      "How Long Does It Take to Make an AI Fruit Story Video?",
      "The honest breakdown of what actually takes time in AI Fruit Story — writing the premise, character generation, scenes, and animated dialogue.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-time-hero.png`,
  },
  "/blog/ai-fruit-story-cliffhangers": {
    ...blog(
      "AI Fruit Story Cliffhanger Endings: How to Make Viewers Come Back for Part 2",
      "Four cliffhanger structures that consistently drive part-2 demand, and the one rule that decides whether a cliffhanger feels earned or cheap.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-cliffhanger-hero.png`,
  },
  "/blog/ai-image-generator-mistakes": {
    ...blog(
      "10 AI Image Generator Mistakes to Avoid (And How to Fix Each One)",
      "The most common reasons AI-generated images come back looking generic, and the specific prompt change that fixes each one.",
    ),
    image: `${SITE_URL}/blog-assets/ai-image-generator-mistakes-hero.png`,
  },
  "/blog/what-is-micro-camera-animal": {
    ...blog(
      "What Is Micro Camera Animal? The Viral Insect's-Eye-View AI Trend",
      "What Micro Camera Animal is, how it's made, and how to generate your own — a full guide to the AI wildlife-POV trend.",
    ),
    image: `${SITE_URL}/blog-assets/what-is-micro-camera-animal-hero.png`,
  },
  "/blog/micro-camera-animal-video-ideas": {
    ...blog(
      "15 Micro Camera Animal Video Ideas You Can Generate Right Now",
      "Seven real animals, each with its own underground world, with real video ideas for every one.",
    ),
    image: `${SITE_URL}/blog-assets/micro-camera-animal-ideas-hero.png`,
  },
  "/blog/what-is-clay-rescue": {
    ...blog(
      "What Is Clay Rescue? The Viral Giant-Hand Rescue AI Trend Explained",
      "How a giant hand rescues tiny clay people from everyday disasters without ever touching them — the full format explained.",
    ),
    image: `${SITE_URL}/blog-assets/what-is-clay-rescue-hero.png`,
  },
  "/blog/what-is-face-asmr": {
    ...blog(
      "What Is Face ASMR? The AI Trend Turning Any Face Into a Satisfying Texture",
      "What Face ASMR is, how the texture transformation works, and how to make your own satisfying AI video.",
    ),
    image: `${SITE_URL}/blog-assets/what-is-face-asmr-hero.png`,
  },
  "/blog/what-is-zyvo": {
    ...blog(
      "What Is Zyvo? The AI Content Creation Platform Explained",
      "Every Zyvo tool in one place — image generation, viral video templates, scripting, and publishing — and how they fit together.",
    ),
    image: `${SITE_URL}/blog-assets/what-is-zyvo-hero.png`,
  },
  "/blog/is-zyvo-free": {
    ...blog(
      "Is Zyvo Free? Pricing, Plans, and Credits Explained",
      "How Zyvo's credit system works across every tool, what determines generation cost, and how to get the most from a free account.",
    ),
    image: `${SITE_URL}/blog-assets/is-zyvo-free-hero.png`,
  },
  "/blog/how-to-get-started-with-zyvo": {
    ...blog(
      "How to Get Started with Zyvo: A Complete Beginner's Guide",
      "From account creation to your first finished video in five steps — no editing software or design experience required.",
    ),
    image: `${SITE_URL}/blog-assets/how-to-get-started-zyvo-hero.png`,
  },
  "/blog/zyvo-vs-other-ai-tools": {
    ...blog(
      "Zyvo vs Other AI Content Tools: What Makes It Different",
      "The real structural difference between Zyvo's format-specific tools and a generic AI prompt box, and when each approach makes sense.",
    ),
    image: `${SITE_URL}/blog-assets/zyvo-vs-other-tools-hero.png`,
  },
  "/blog/clay-rescue-video-ideas": {
    ...blog(
      "20 Clay Rescue Video Ideas You Can Generate Right Now",
      "Twenty real crisis-and-fix pairs for Clay Rescue videos, ready to generate today.",
    ),
    image: `${SITE_URL}/blog-assets/clay-rescue-ideas-honey.png`,
  },
  "/blog/clay-rescue-mistakes": {
    ...blog(
      "10 Mistakes Killing Your Clay Rescue Video Views",
      "The ten most common structural mistakes in Clay Rescue videos, with a specific fix for each one.",
    ),
    image: `${SITE_URL}/blog-assets/clay-rescue-mistakes-hero.png`,
  },
  "/blog/micro-camera-animal-mistakes": {
    ...blog(
      "8 Mistakes Killing Your Micro Camera Animal Video Views",
      "The most common structural mistakes in Micro Camera Animal videos, with a specific fix for each one.",
    ),
    image: `${SITE_URL}/blog-assets/micro-camera-animal-mistakes-hero.png`,
  },
  "/blog/face-asmr-mistakes": {
    ...blog(
      "6 Mistakes Killing Your Face ASMR Video Quality",
      "The most common reasons Face ASMR generations come back unclear, and the source-photo fix for each one.",
    ),
    image: `${SITE_URL}/blog-assets/face-asmr-mistakes-hero.png`,
  },
  "/blog/cartoon-drive-by-mistakes": {
    ...blog(
      "6 Mistakes Killing Your Cartoon Drive-By Video Views",
      "The most common reasons Cartoon Drive-By videos come back generic, and the specific fix for each one.",
    ),
    image: `${SITE_URL}/blog-assets/cartoon-drive-by-mistakes-hero.png`,
  },
  "/blog/footballer-nationality-swap-ideas": {
    ...blog(
      "15 Footballer Nationality Swap Video Ideas You Can Try",
      "Fifteen structural concepts for Footballer Nationality Swap videos, from rival-nation swaps to full world-tour sequences.",
    ),
    image: `${SITE_URL}/blog-assets/footballer-swap-ideas-hero.png`,
  },
  "/blog/which-zyvo-template": {
    ...blog(
      "Which Zyvo Template Should You Start With? A Quick Decision Guide",
      "Match what you want to make to the right Zyvo tool in under two minutes.",
    ),
    image: `${SITE_URL}/blog-assets/which-zyvo-template-hero.png`,
  },
  "/blog/clay-rescue-series": {
    ...blog(
      "How to Turn One Clay Rescue Video Into a Series",
      "Four pillars of a Clay Rescue series — a recurring village, a rotating cast, varied crises — and a simple way to start your first season.",
    ),
    image: `${SITE_URL}/blog-assets/clay-rescue-series-hero.png`,
  },
  "/blog/micro-camera-animal-series": {
    ...blog(
      "How to Turn One Micro Camera Animal Video Into a Series",
      "Four pillars of a Micro Camera Animal season, and a simple way to structure a progressive-depth story arc.",
    ),
    image: `${SITE_URL}/blog-assets/micro-camera-animal-series-hero.png`,
  },
  "/blog/cartoon-drive-by-vs-2am-worlds": {
    ...blog(
      "Cartoon Drive-By vs 2AM Worlds: Which Atmospheric AI Format Should You Try?",
      "Motion versus stillness — how Cartoon Drive-By and 2AM Worlds each reframe a fictional world, and how to decide which fits your idea.",
    ),
    image: `${SITE_URL}/blog-assets/cartoon-vs-2am-worlds-hero.png`,
  },
  "/blog/footballer-nationality-swap-time": {
    ...blog(
      "How Long Does a Footballer Nationality Swap Video Take to Make?",
      "From naming a player to a finished, stitched sequence — what actually takes time, step by step.",
    ),
    image: `${SITE_URL}/blog-assets/footballer-swap-time-hero.png`,
  },
  "/blog/face-asmr-privacy": {
    ...blog(
      "Is Face ASMR Safe? Photo Privacy Basics Before You Upload",
      "What to know about uploading a personal photo to Face ASMR, and where to find the full privacy specifics.",
    ),
    image: `${SITE_URL}/blog-assets/face-asmr-privacy-hero.png`,
  },
  "/blog/what-is-zyvo-publish": {
    ...blog(
      "What Is Zyvo Publish? Scheduling and Posting Explained",
      "One dashboard for Instagram, TikTok, and YouTube — plan up to 28 days ahead and publish without switching apps.",
    ),
    image: `${SITE_URL}/blog-assets/what-is-zyvo-publish-hero.png`,
  },
  "/blog/what-is-zyvo-stats": {
    ...blog(
      "What Is Zyvo Stats? Understanding Your YouTube Analytics",
      "A focused analytics dashboard tracking views, watch time, subscriber growth, and video performance.",
    ),
    image: `${SITE_URL}/blog-assets/what-is-zyvo-stats-hero.png`,
  },
  "/blog/what-is-zyvo-connections": {
    ...blog(
      "What Is Zyvo Connections? Managing Your Social Accounts",
      "The connection layer behind Publish and Stats — bring Instagram, TikTok, and YouTube into one workspace.",
    ),
    image: `${SITE_URL}/blog-assets/what-is-zyvo-connections-hero.png`,
  },
  "/blog/zyvo-content-workflow": {
    ...blog(
      "The Complete Zyvo Content Workflow: From Idea to Published Post",
      "Generate, connect, publish, measure — how every Zyvo tool fits into one repeatable content loop.",
    ),
    image: `${SITE_URL}/blog-assets/zyvo-content-workflow-hero.png`,
  },
  "/blog/zyvo-template-comparison": {
    ...blog(
      "The Ultimate Zyvo Template Comparison: All 9 Tools Side by Side",
      "Every Zyvo tool, its real output format, and what it's actually best for, in one reference table.",
    ),
    image: `${SITE_URL}/blog-assets/zyvo-template-comparison-hero.png`,
  },
  "/blog/best-time-to-post-ai-content": {
    ...blog(
      "Best Time to Post AI Content to Go Viral in 2026",
      "Platform-by-platform posting windows for TikTok, Reels, and Shorts, why early engagement matters more than the clock, and how AI content removes the scheduling bottleneck.",
    ),
    image: `${SITE_URL}/blog-assets/best-time-to-post-ai-content-hero.png`,
  },
  "/blog/ai-content-hooks-captions-that-go-viral": {
    ...blog(
      "How to Write Hooks and Captions for AI Content That Goes Viral",
      "Five hook formulas, a caption structure that keeps viewers watching, and a hashtag strategy for AI-generated images and videos.",
    ),
    image: `${SITE_URL}/blog-assets/ai-content-hooks-captions-hero.png`,
  },
  "/blog/cartoon-drive-by-explained": {
    ...blog(
      "What Is a Cartoon Drive-By Video? (And How to Make One)",
      "Why the cartoon drive-by format works, what makes the parallax motion feel real, and how to generate one with Zyvo.",
    ),
    image: `${SITE_URL}/blog-assets/cartoon-drive-by-explained-hero.png`,
  },
  "/blog/cartoon-drive-by-video-ideas": {
    ...blog(
      "15 Cartoon Drive-By Video Ideas (With Prompts You Can Copy)",
      "Fifteen fictional destinations across car, train, bus, and plane viewpoints, each with a ready-to-use prompt.",
    ),
    image: `${SITE_URL}/blog-assets/cartoon-drive-by-video-ideas-hero.png`,
  },
  "/blog/footballer-nationality-swap-explained": {
    ...blog(
      "What Is Footballer Nationality Swap? (And How It Works)",
      "Why the format works, what actually gets generated, and how to create a Nationality Swap clip in Zyvo.",
    ),
    image: `${SITE_URL}/blog-assets/footballer-nationality-swap-explained-hero.png`,
  },
  "/blog/footballer-nationality-swap-tips": {
    ...blog(
      "5 Tips for the Most Believable Footballer Nationality Swap Video",
      "Jersey contrast, expression, background style, spoken-line length, and sequencing — five choices that make the clip land.",
    ),
    image: `${SITE_URL}/blog-assets/footballer-nationality-swap-tips-hero.png`,
  },
  "/blog/viral-ai-fruit-drama-videos": {
    ...blog(
      "How to Create Viral AI Fruit Drama Videos",
      "Learn how AI fruit drama videos combine recognizable characters, conflict, scene progression, and vertical short-form presentation.",
    ),
    image: `${SITE_URL}/blog-assets/ai-fruit-story-drama-hero.png`,
  },
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
  "/footballer-nationality-swap-ai": {
    title: "Footballer Nationality Swap AI – Create Viral Media-Day Videos | Zyvo",
    description: "Picture any footballer representing a different nation. Generate a photorealistic jersey swap and a talking media-day introduction clip with Zyvo.",
    type: "website",
    image: `${SITE_URL}/template/nationality-swap/preview.png`,
  },
  "/behind-the-scenes-video-maker": {
    title: "Behind the Scenes AI Video Maker – Miniature Disaster Movie Set Videos | Zyvo",
    description: "Generate AI movie-set footage of a giant practical disaster hitting a handcrafted miniature city, with a full-size effects crew for scale. Image plus 8-second video with sound.",
    type: "website",
    image: `${SITE_URL}/behind-the-scenes/poster.webp`,
  },
  "/blog/behind-the-scenes-trend-explained": {
    ...blog(
      "What Is the \"Behind the Scenes\" AI Video Trend?",
      "Why the miniature movie-set disaster format works, what you actually get from one generation, and how to make your first episode.",
    ),
    image: `${SITE_URL}/blog-assets/behind-the-scenes-trend-explained-hero.png`,
  },
  "/blog/behind-the-scenes-how-its-made": {
    ...blog(
      "Why AI \"Movie Set\" Miniature Disaster Videos Look So Real",
      "The five locked ingredients — materials, blue wall, crew scale, visible rigging, amateur framing — that sell the illusion every time.",
    ),
    image: `${SITE_URL}/blog-assets/behind-the-scenes-how-its-made-hero.png`,
  },
  "/blog/behind-the-scenes-video-ideas": {
    ...blog(
      "18 Behind the Scenes AI Video Ideas You Can Generate Right Now",
      "18 curated place-and-disaster combos across every module, ready to copy into the generator.",
    ),
    image: `${SITE_URL}/blog-assets/behind-the-scenes-video-ideas-hero.png`,
  },
  "/blog/behind-the-scenes-camera-vantage": {
    ...blog(
      "Tank Edge, Gantry, or Crane Follow? Choosing the Right Camera Angle",
      "What each of the three camera vantages does to a Behind the Scenes shot, and when to use each one.",
    ),
    image: `${SITE_URL}/blog-assets/behind-the-scenes-camera-vantage-hero.png`,
  },
  "/blog/behind-the-scenes-series": {
    ...blog(
      "How to Turn One Behind the Scenes Video Into a Series",
      "Four pillars of a consistent season, and a simple way to start your first one.",
    ),
    image: `${SITE_URL}/blog-assets/behind-the-scenes-series-hero.png`,
  },
  "/blog/whats-hot-right-now-ai-trends": {
    ...blog(
      "What's Hot Right Now: 8 AI Video Trends Creators Are Riding in 2026",
      "What each current AI video format is, why it's working, and where to generate your first one.",
    ),
    image: `${SITE_URL}/blog-assets/whats-hot-right-now-ai-trends-hero.png`,
  },
  "/blog/how-to-spot-viral-ai-trend": {
    ...blog(
      "How to Spot the Next Viral AI Trend Before It Blows Up",
      "Five signals that show up before a format explodes, and what to do once you've spotted one.",
    ),
    image: `${SITE_URL}/blog-assets/how-to-spot-viral-ai-trend-hero.png`,
  },
  "/blog/imperfect-ai-videos-winning": {
    ...blog(
      "Why \"Imperfect\" AI Videos Are Beating Polished Content Right Now",
      "The authenticity trick behind the biggest AI video formats of 2026, and how to apply it to your own content.",
    ),
    image: `${SITE_URL}/blog-assets/imperfect-ai-videos-winning-hero.png`,
  },
  "/blog/behind-the-scenes-disaster-types": {
    ...blog(
      "8 Behind the Scenes Disaster Types Explained",
      "What each of the eight original disaster modules feels like, and which places suit each one best.",
    ),
    image: `${SITE_URL}/blog-assets/behind-the-scenes-disaster-types-hero.png`,
  },
  "/blog/behind-the-scenes-mistakes": {
    ...blog(
      "10 Mistakes Killing Your Behind the Scenes Video Views",
      "The ten most common structural mistakes in Behind the Scenes episodes, with a specific fix for each one.",
    ),
    image: `${SITE_URL}/blog-assets/behind-the-scenes-mistakes-hero.png`,
  },
  "/blog/behind-the-scenes-extended-modules": {
    ...blog(
      "12 Extended Behind the Scenes Modules: Kaiju, Robots, and Full Movie-Shoot Chaos",
      "Beyond the 8 elemental disasters — giant creatures, aircraft chases, giant robots, and more, explained.",
    ),
    image: `${SITE_URL}/blog-assets/behind-the-scenes-extended-modules-hero.png`,
  },
  "/blog/behind-the-scenes-vs-clay-rescue": {
    ...blog(
      "Behind the Scenes vs Clay Rescue: Which Miniature AI Video Format Should You Try?",
      "Same scale-contrast trick, opposite emotional arc — how to decide which format fits your niche.",
    ),
    image: `${SITE_URL}/blog-assets/behind-the-scenes-vs-clay-rescue-hero.png`,
  },
  "/blog/behind-the-scenes-vs-micro-camera-animal": {
    ...blog(
      "Behind the Scenes vs Micro Camera Animal: Documentary-Style AI Video Compared",
      "Both formats build a video around scale and perspective, but the feeling they create is nothing alike.",
    ),
    image: `${SITE_URL}/blog-assets/bts-vs-micro-camera-hero.png`,
  },
  "/blog/ai-fruit-story-halloween": {
    ...blog(
      "AI Fruit Story Halloween Special: 10 Spooky Drama Ideas",
      "Ten Halloween-themed premises that layer costumes, candy, and haunted-house tension onto proven fruit-drama structure.",
    ),
    image: `${SITE_URL}/blog-assets/fruit-story-halloween-hero.png`,
  },
  "/blog/ai-fruit-story-finale-ideas": {
    ...blog(
      "AI Fruit Story Series Finale Ideas: How to End a Storyline",
      "Five ending structures that give a series a satisfying close instead of just stopping.",
    ),
    image: `${SITE_URL}/blog-assets/fruit-story-finale-hero.png`,
  },
  "/blog/ai-fruit-story-vs-2am-worlds": {
    ...blog(
      "AI Fruit Story vs 2AM Worlds: Which Format Should You Start With?",
      "Two of Zyvo's most different formats compared — character drama versus atmosphere.",
    ),
    image: `${SITE_URL}/blog-assets/fruit-story-vs-2am-worlds-hero.png`,
  },
  "/blog/ai-fruit-story-character-names": {
    ...blog(
      "40 AI Fruit Story Character Names, Grouped by Fruit",
      "A naming shortcut for your next fruit-drama cast — four names for each of ten fruit types.",
    ),
    image: `${SITE_URL}/blog-assets/fruit-story-names-hero.png`,
  },
  "/blog/best-ai-video-generators-tiktok": {
    ...blog(
      "Best AI Video Generators for TikTok in 2026",
      "What actually separates a good AI video generator from a disappointing one, and how to evaluate any tool.",
    ),
    image: `${SITE_URL}/blog-assets/best-ai-video-generators-hero.png`,
  },
  "/blog/best-free-ai-tools-creators": {
    ...blog(
      "Best Free AI Tools for Content Creators in 2026",
      "What to look for in a free tier before committing time to it, across the four categories every creator needs.",
    ),
    image: `${SITE_URL}/blog-assets/best-free-ai-tools-hero.png`,
  },
  "/blog/how-to-make-money-ai-content": {
    ...blog(
      "How to Make Money With AI-Generated Content in 2026",
      "Four real monetization paths for AI-generated short-form content, and why consistent volume matters most.",
    ),
    image: `${SITE_URL}/blog-assets/ai-content-money-hero.png`,
  },
  "/blog/is-ai-content-worth-it": {
    ...blog(
      "Is AI Content Creation Worth It in 2026? An Honest Breakdown",
      "Where AI generation clearly wins, where it clearly doesn't, and the real trade-off underneath the hype.",
    ),
    image: `${SITE_URL}/blog-assets/is-ai-content-worth-it-hero.png`,
  },
  "/blog/vertical-video-formats-guide": {
    ...blog(
      "The Complete Guide to Vertical Video Formats for TikTok, Reels & Shorts",
      "The exact aspect ratios, resolutions, and safe zones each platform expects, plus pacing rules that hold attention.",
    ),
    image: `${SITE_URL}/blog-assets/vertical-video-formats-hero.png`,
  },
  "/blog/footballer-nationality-swap-mistakes": {
    ...blog(
      "10 Mistakes Killing Your Footballer Nationality Swap Video Views",
      "The structural choices that quietly hold results back, with a specific fix for each one.",
    ),
    image: `${SITE_URL}/blog-assets/footballer-swap-time-stadium.png`,
  },
  "/blog/footballer-nationality-swap-series": {
    ...blog(
      "How to Turn One Footballer Nationality Swap Video Into a Series",
      "A simple structure for turning single clips into an ongoing world-tour format.",
    ),
    image: `${SITE_URL}/blog-assets/footballer-swap-ideas-jerseys.png`,
  },
  "/blog/cartoon-drive-by-series": {
    ...blog(
      "How to Turn One Cartoon Drive-By Video Into a Series",
      "A themed destination lineup turns one drive-by into a series people follow for the next stop.",
    ),
    image: `${SITE_URL}/blog-assets/cartoon-drive-by-explained-hero.png`,
  },
  "/blog/tiktok-algorithm-explained": {
    ...blog(
      "TikTok Algorithm Explained: What Actually Gets Your Videos Seen in 2026",
      "What consistently correlates with reach on TikTok, and three common myths worth retiring.",
    ),
    image: `${SITE_URL}/blog-assets/what-is-zyvo-stats-growth.png`,
  },
  "/blog/instagram-reels-algorithm-explained": {
    ...blog(
      "Instagram Reels Algorithm Explained: How Reach Actually Works in 2026",
      "Four real differences between Reels and TikTok distribution, and how to plan for each.",
    ),
    image: `${SITE_URL}/blog-assets/what-is-zyvo-connections-hero.png`,
  },
  "/blog/content-slump-recovery": {
    ...blog(
      "How to Recover From a Content Slump (Without Losing Your Audience)",
      "What actually gets posting moving again after a gap — it isn't motivation.",
    ),
    image: `${SITE_URL}/blog-assets/ai-content-money-growth.png`,
  },
  "/blog/how-often-should-you-post": {
    ...blog(
      "How Often Should You Post? A Realistic Answer for 2026",
      "The right posting frequency depends on where your account actually is right now.",
    ),
    image: `${SITE_URL}/blog-assets/what-is-zyvo-publish-schedule.png`,
  },
  "/blog/repurpose-one-video-ten-pieces": {
    ...blog(
      "How to Repurpose One AI Video Into 10 Pieces of Content",
      "Four ways to split one multi-scene generation into a full week of posts.",
    ),
    image: `${SITE_URL}/blog-assets/zyvo-content-workflow-hero.png`,
  },
  "/blog/faceless-youtube-channel-ideas": {
    ...blog(
      "Faceless YouTube Channel Ideas Using AI in 2026",
      "Six AI-generated formats that never require appearing on camera.",
    ),
    image: `${SITE_URL}/blog-assets/best-ai-video-generators-hero.png`,
  },
  "/blog/how-to-pick-your-first-2am-world": {
    ...blog(
      "How to Pick Your First 2AM World: A Beginner's Decision Guide",
      "A simple decision guide to picking your first 2AM World based on what you already enjoy.",
    ),
    image: `${SITE_URL}/blog-assets/ai-world-generator-guide-2026.webp`,
  },
  "/blog/behind-the-scenes-time": {
    ...blog(
      "How Long Does a Behind the Scenes Video Take to Make?",
      "From picking a disaster module to a finished 8-second clip with sound — what actually takes time.",
    ),
    image: `${SITE_URL}/blog-assets/behind-the-scenes-time-hero.png`,
  },
  "/blog/behind-the-scenes-tier-list": {
    ...blog(
      "Behind the Scenes Disaster Tier List: All 20 Modules Ranked",
      "All 8 elemental disasters and 12 extended modules, ranked by how reliably they hook a viewer.",
    ),
    image: `${SITE_URL}/blog-assets/behind-the-scenes-tier-list-hero.png`,
  },
  "/blog/behind-the-scenes-halloween": {
    ...blog(
      "Behind the Scenes Halloween Special: 10 Horror Movie-Set Disaster Ideas",
      "Fog, jack-o'-lanterns, and a fog-shrouded monster silhouette push the format into horror-movie-set territory.",
    ),
    image: `${SITE_URL}/blog-assets/behind-the-scenes-halloween-hero.png`,
  },
  "/blog/behind-the-scenes-is-it-real": {
    ...blog(
      "Is Behind the Scenes Real? How AI Movie-Set Videos Fool Millions of Viewers",
      "None of it is real footage. Here's exactly why it convinces so many people anyway.",
    ),
    image: `${SITE_URL}/blog-assets/behind-the-scenes-is-it-real-hero.png`,
  },
  "/blog/behind-the-scenes-beginners-guide": {
    ...blog(
      "How to Pick Your First Behind the Scenes Disaster Type: A Beginner's Guide",
      "20 disaster modules is a lot of choice for a first try — here's a simple way to pick.",
    ),
    image: `${SITE_URL}/blog-assets/behind-the-scenes-beginners-guide-hero.png`,
  },
  "/blog/every-zyvo-video-format-compared": {
    ...blog(
      "Every Zyvo AI Video Format Compared: Which One Should You Try Next?",
      "Six format-specific AI video tools, side by side — what each one actually outputs.",
    ),
    image: `${SITE_URL}/blog-assets/every-format-compared-hero.png`,
  },
  "/blog/clay-rescue-vs-micro-camera-animal": {
    ...blog(
      "Clay Rescue vs Micro Camera Animal: Wholesome Rescue or Quiet Documentary?",
      "Both formats work in miniature, but one has a hero and the other has none at all.",
    ),
    image: `${SITE_URL}/blog-assets/clay-rescue-vs-micro-camera-hero.png`,
  },
  "/blog/fruit-story-vs-footballer-nationality-swap": {
    ...blog(
      "AI Fruit Story vs Footballer Nationality Swap: Scripted Drama or One-Line Cameo?",
      "Both formats build content around a talking character, at opposite paces.",
    ),
    image: `${SITE_URL}/blog-assets/fruit-story-vs-footballer-hero.png`,
  },
  "/blog/multi-format-weekly-calendar": {
    ...blog(
      "Building a Multi-Format Weekly Content Calendar With Zyvo",
      "A sample week that spreads several Zyvo formats across different moods.",
    ),
    image: `${SITE_URL}/blog-assets/multi-format-calendar-hero.png`,
  },
  "/blog/cross-promote-zyvo-formats": {
    ...blog(
      "How to Cross-Promote Between Zyvo Formats: Turn One Audience Into Many",
      "How a fan of one format becomes a viewer of another, without any new content.",
    ),
    image: `${SITE_URL}/blog-assets/cross-promote-formats-hero.png`,
  },
};

export function getPublicSeoMetadata(pathname) {
  return PUBLIC_SEO_METADATA[pathname] || null;
}
