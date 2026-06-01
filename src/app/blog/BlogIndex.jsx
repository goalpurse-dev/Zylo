import { Link } from "react-router-dom";
import Footer from "../../components/workspace/footer.jsx";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Calendar } from "lucide-react";

// ── Product Photos images ──────────────────────────────────────────────────
import PP1  from "../../assets/blog/productphoto/example1.png";
import PP2  from "../../assets/grid/product/serum.png";
import PP3  from "../../assets/blog/productphoto/beforeafter.png";
import PP4  from "../../assets/proof/skincare.png";
import PP5  from "../../assets/grid/product/sneaker.jpg";
import PP6  from "../../assets/blog/productphoto/best.png";
import PP7  from "../../assets/proof/fashion.png";
import PP8  from "../../assets/blog/productphoto/bgexample.png";
import PP9  from "../../assets/blog/productphoto/good.png";
import PP10 from "../../assets/blog/productphoto/example2.png";
import PP11 from "../../assets/proof/jewelry.png";
import PP12 from "../../assets/blog/productphoto/before1.png";
import PP13 from "../../assets/grid/product/candle.jpg";
import PP14 from "../../assets/grid/product/headphone.jpg";
import PP15 from "../../assets/blog/productphoto/realcase.png";
import PP16 from "../../assets/blog/productphoto/beforeafter2.png";
import PP17 from "../../assets/blog/productphoto/library.png";
import PP18 from "../../assets/proof/dropshipping.png";
import PP19 from "../../assets/blog/productphoto/example3.png";
import PP20 from "../../assets/blog/productphoto/example4.png";
import PP21 from "../../assets/grid/product/laptop.jpg";
import PP22 from "../../assets/blog/productphoto/beforeafter3.png";
import PP23 from "../../assets/grid/product/sunglass.jpg";
import PP24 from "../../assets/blog/productphoto/same.png";
import PP25 from "../../assets/blog/productphoto/example5.png";
import PP26 from "../../assets/proof/fitness.png";
import PP27 from "../../assets/proof/food.png";
import PP28 from "../../assets/blog/productphoto/before2.png";
import PP29 from "../../assets/blog/productphoto/UseCase.png";
import PP30 from "../../assets/proof/socialmedia.png";

// ── Go Viral images ────────────────────────────────────────────────────────
import GV1  from "../../assets/inspiration/1.png";
import GV2  from "../../assets/inspiration/2.png";
import GV3  from "../../assets/blog/image-generator/human1.png";
import GV4  from "../../assets/inspiration/5.png";
import GV5  from "../../assets/blog/image-generator/human3.png";
import GV6  from "../../assets/inspiration/8.png";
import GV7  from "../../assets/home/media3.jpg";
import GV8  from "../../assets/inspiration/11.png";
import GV9  from "../../assets/blog/image-generator/dubai.png";
import GV10 from "../../assets/inspiration/14.png";
import GV11 from "../../assets/inspiration/4.png";
import GV12 from "../../assets/inspiration/7.png";

// ── AI Image Generator images ──────────────────────────────────────────────
import IG1  from "../../assets/grid/image/astronaut.jpg";
import IG2  from "../../assets/blog/image-generator/greek.png";
import IG3  from "../../assets/inspiration/3.png";
import IG4  from "../../assets/grid/image/samurai.jpg";
import IG5  from "../../assets/blog/image-generator/human2.png";
import IG6  from "../../assets/inspiration/6.png";
import IG7  from "../../assets/grid/image/wolf.jpg";
import IG8  from "../../assets/blog/image-generator/nyc.png";
import IG9  from "../../assets/inspiration/9.png";
import IG10 from "../../assets/grid/image/horse.jpg";
import IG11 from "../../assets/blog/image-generator/beach.png";
import IG12 from "../../assets/inspiration/12.png";
import IG13 from "../../assets/grid/image/dragob.jpg";
import IG14 from "../../assets/blog/image-generator/human4.png";
import IG15 from "../../assets/inspiration/15.png";
import IG16 from "../../assets/blog/image-generator/village.png";
import IG17 from "../../assets/inspiration/18.png";
import IG18 from "../../assets/blog/image-generator/walking.png";
import IG19 from "../../assets/inspiration/21.png";
import IG20 from "../../assets/blog/image-generator/abdi.png";

// ──────────────────────────────────────────────────────────────────────────

const CAT_PILL = {
  "Product Photos":     "bg-emerald-100 text-emerald-700",
  "AI Image Generator": "bg-blue-100 text-blue-700",
  "Go Viral":           "bg-purple-100 text-purple-700",
  "Viral Script":       "bg-violet-100 text-violet-700",
};

const ALL_BLOGS = [
  // ═══════════════ Product Photos ═══════════════
  { to: "/blog/product-photos-with-ai-for-shopify",               title: "Product Photos with AI for Shopify",                      desc: "Learn how product photos with AI work for Shopify.",                                              date: "Jan 9, 2026",  category: "Product Photos",     img: PP1  },
  { to: "/blog/product-photos-for-shopify-store",                  title: "Product Photos with AI for Shopify Stores",               desc: "Create clean, professional Shopify product photos instantly using AI.",                          date: "Jan 10, 2026", category: "Product Photos",     img: PP2  },
  { to: "/blog/AI-product-photos-increase-conversion-rates",       title: "How AI Product Photos Increase Conversion Rates",         desc: "See how better visuals boost clicks, trust, and sales.",                                          date: "Jan 10, 2026", category: "Product Photos",     img: PP3  },
  { to: "/blog/best-ai-tools-for-ecommerce",                       title: "Best AI Tools for Ecommerce Product Photography",         desc: "Top AI tools to create high-quality ecommerce product images fast.",                              date: "Jan 10, 2026", category: "Product Photos",     img: PP4  },
  { to: "/blog/shopify-product-photo-best-practices",              title: "Shopify Product Photo Best Practices",                    desc: "Proven product image guidelines for higher Shopify conversions.",                                 date: "Jan 10, 2026", category: "Product Photos",     img: PP5  },
  { to: "/blog/ai-vs-traditional-product-photography",             title: "AI vs Traditional Product Photography",                   desc: "Compare AI and traditional photoshoots for ecommerce brands.",                                   date: "Jan 15, 2026", category: "Product Photos",     img: PP6  },
  { to: "/blog/why-product-photos-matter-for-ecommerce-success",   title: "Why Product Images Matter More Than Ads",                 desc: "How strong visuals influence buying decisions more than ads.",                                    date: "Jan 16, 2026", category: "Product Photos",     img: PP7  },
  { to: "/blog/best-ai-product-backgrounds-to-use",                title: "Best AI Product Backgrounds to Use",                     desc: "High-converting background styles for modern product photos.",                                   date: "Jan 16, 2026", category: "Product Photos",     img: PP8  },
  { to: "/blog/how-to-improve-ecommerce-visual-trust",             title: "How to Improve Ecommerce Visual Trust",                   desc: "Build trust and credibility with better product imagery.",                                       date: "Jan 17, 2026", category: "Product Photos",     img: PP9  },
  { to: "/blog/product-photography-mistakes-ecommerce-brands-make",title: "Product Photography Mistakes Ecommerce Brands Make",     desc: "Common product photo mistakes that hurt sales and engagement.",                                  date: "Jan 18, 2026", category: "Product Photos",     img: PP10 },
  { to: "/blog/how-visual-branding-impacts-online-sales",          title: "How Visual Branding Impacts Online Sales",                desc: "Why consistent visuals increase brand recognition and sales.",                                   date: "Jan 18, 2026", category: "Product Photos",     img: PP11 },
  { to: "/blog/ai-background-removal-for-product-photos",          title: "AI Background Removal for Product Photos",               desc: "Remove backgrounds instantly for clean, professional product images.",                            date: "Jan 18, 2026", category: "Product Photos",     img: PP12 },
  { to: "/blog/how-to-scale-ecommerce-content-creation-with-ai",   title: "How to Scale Ecommerce Content Without Photoshoots",     desc: "Create and scale product visuals without costly photoshoots.",                                   date: "Jan 19, 2026", category: "Product Photos",     img: PP13 },
  { to: "/blog/converting-product-images-for-shopify-stores",      title: "High-Converting Product Images for Shopify",             desc: "Product image strategies that increase Shopify conversions.",                                   date: "Jan 20, 2026", category: "Product Photos",     img: PP14 },
  { to: "/blog/ai-product-photography-for-small-businesses",       title: "AI Product Photography for Small Businesses",            desc: "Affordable AI product photos for growing small brands.",                                         date: "Jan 20, 2026", category: "Product Photos",     img: PP15 },
  { to: "/blog/how-better-images-reduce-bounce-rate",              title: "How Better Images Reduce Bounce Rate",                   desc: "Use better visuals to keep visitors engaged longer.",                                            date: "Jan 20, 2026", category: "Product Photos",     img: PP16 },
  { to: "/blog/ecommerce-visual-consistency-explained",            title: "Ecommerce Visual Consistency Explained",                 desc: "How to stay consistent with visuals across your store.",                                         date: "Jan 22, 2026", category: "Product Photos",     img: PP17 },
  { to: "/blog/ai-productphotos-for-dropshipping",                 title: "AI Product Photos for Dropshipping Stores",              desc: "How product photos help dropshipping stores sell more.",                                         date: "Jan 23, 2026", category: "Product Photos",     img: PP18 },
  { to: "/blog/how-visual-quality-impacts-seo",                    title: "How Visual Quality Impacts SEO",                         desc: "Learn how important visual quality is for search rankings.",                                     date: "Jan 23, 2026", category: "Product Photos",     img: PP19 },
  { to: "/blog/product-images-that-conver-full-guide",             title: "Product Images That Convert: A Complete Guide",          desc: "Full guide on what kind of product images convert best.",                                        date: "Jan 24, 2026", category: "Product Photos",     img: PP20 },
  { to: "/blog/ai-tools-every-shopify-store-owner-should-know",    title: "AI Tools Every Shopify Store Owner Should Know",         desc: "Every Shopify store owner must know these AI tools.",                                            date: "Jan 24, 2026", category: "Product Photos",     img: PP21 },
  { to: "/blog/how-to-launch-products-faster-with-ai",             title: "How to Launch Products Faster with AI",                  desc: "Complete guide on how to launch products faster with AI.",                                       date: "Jan 24, 2026", category: "Product Photos",     img: PP22 },
  { to: "/blog/studio-quality-product-photos",                     title: "Studio-Quality Product Photos Without a Studio",         desc: "How to create studio-quality photos without a studio.",                                          date: "Jan 25, 2026", category: "Product Photos",     img: PP23 },
  { to: "/blog/why-clean-product-photos-build-trust",              title: "Why Clean Product Photos Build Trust",                   desc: "Learn how clean product photos build trust and increase conversions.",                            date: "Jan 25, 2026", category: "Product Photos",     img: PP24 },
  { to: "/blog/visual-optimization-for-mobile-ecommerce",          title: "Visual Optimization for Mobile Ecommerce",               desc: "How to optimize visuals specifically for mobile shoppers.",                                      date: "Jan 26, 2026", category: "Product Photos",     img: PP25 },
  { to: "/blog/how-ai-helps-ecommerce-brands-scale-faster",        title: "How AI Helps Ecommerce Brands Scale Faster",             desc: "Learn how AI helps ecommerce brands to scale faster.",                                          date: "Jan 26, 2026", category: "Product Photos",     img: PP26 },
  { to: "/blog/product-photography-trends-for-ecommerce",          title: "Product Photography Trends for Ecommerce",               desc: "Learn what kind of trends help ecommerce brands grow.",                                          date: "Jan 28, 2026", category: "Product Photos",     img: PP27 },
  { to: "/blog/ai-product-photos-for-fashion-stores",              title: "AI Product Photos for Fashion Stores",                   desc: "Learn how AI product photos help fashion stores grow faster.",                                   date: "Jan 28, 2026", category: "Product Photos",     img: PP28 },
  { to: "/blog/ai-product-photos-for-beaty-and-skincare",          title: "AI Product Photos for Beauty & Skincare Brands",         desc: "Learn how AI product photos work for beauty & skincare brands.",                                 date: "Jan 29, 2026", category: "Product Photos",     img: PP29 },
  { to: "/blog/how-visual-branding-seperates-winners-from-losers", title: "How Visual Branding Separates Winners from Losers",      desc: "Learn how visuals separate winning brands from the rest.",                                       date: "Jan 29, 2026", category: "Product Photos",     img: PP30 },

  { to: "/blog/ai-product-photo-generator",           title: "Best AI Product Photo Generator in 2026 (Free + Ecommerce Guide)",    desc: "Generate studio-quality product photos, remove backgrounds, and create social media content — free to start.",     date: "Apr 18, 2026", category: "Product Photos",     img: PP6  },
  { to: "/blog/zyvo-vs-midjourney-product-photos",    title: "Zyvo vs Midjourney for Product Photos: Which AI Tool Wins in 2026?",  desc: "An honest comparison covering quality, background removal, pricing, and ecommerce suitability.",                   date: "Apr 18, 2026", category: "Product Photos",     img: PP3  },
  { to: "/blog/free-ai-image-generator",             title: "Free AI Image Generator: Create Stunning Images Instantly (2026)",     desc: "Use Zyvo's free AI image generator to create stunning, scroll-stopping visuals in seconds. No design skills needed.", date: "Apr 19, 2026", category: "AI Image Generator", img: IG3  },
  { to: "/blog/free-viral-ai-tool",                  title: "The Best Free Viral AI Tool in 2026 (Used by Creators Getting Millions of Views)", desc: "How creators are hitting millions of views on TikTok and Instagram using a free viral AI tool — and how to copy their system.", date: "Apr 19, 2026", category: "Go Viral",           img: GV1  },
  { to: "/blog/how-to-write-a-viral-script",         title: "How to Write a Viral Script in 2026: The AI Framework That Gets Millions of Views", desc: "The exact anatomy of a viral script — hook types, scene structure, platform-specific CTAs, and how AI generates it in 60 seconds.", date: "Apr 21, 2026", category: "Viral Script",        img: GV2  },
  { to: "/blog/ai-script-generator-viral-videos",    title: "AI Script Generator: Write Viral TikTok & YouTube Scripts in 60 Seconds (2026)",  desc: "How AI script generators work, what separates good ones from bad, and how to generate a complete script with image and video prompts.", date: "Apr 21, 2026", category: "Viral Script",        img: GV3  },
  { to: "/blog/ai-video-generator-tiktok-reels",           title: "AI Video Generator for TikTok & Reels: The Complete 2026 Guide",                    desc: "Which AI video models produce the best short-form content, how to write cinematic prompts, and the fastest workflow from idea to viral video.", date: "Apr 24, 2026", category: "Go Viral",           img: GV4  },
  { to: "/blog/how-to-create-viral-ai-videos",             title: "How to Create Viral AI Videos in 2026: From Prompt to Millions of Views",            desc: "The complete creator workflow — script first, model selection, prompt engineering, reference images, and why most AI videos get low views.", date: "Apr 24, 2026", category: "Go Viral",           img: GV5  },
  { to: "/blog/how-to-make-viral-ai-tiktok-videos",        title: "How to Make Viral AI TikTok Videos in 2026 (Step-by-Step)",                         desc: "Script, generate, post. The complete step-by-step workflow for making viral AI TikTok videos — from hook writing to posting strategy.", date: "Apr 26, 2026", category: "Go Viral",           img: GV6  },
  { to: "/blog/best-ai-tools-faceless-tiktok-videos",      title: "Best AI Tools for Faceless TikTok Videos in 2026",                                  desc: "The exact AI stack behind the fastest-growing faceless TikTok channels — video generation, scripting, images, and the full workflow.", date: "Apr 26, 2026", category: "Go Viral",           img: GV7  },
  { to: "/blog/ai-content-creation-tools-instagram-viral", title: "AI Content Creation Tools for Instagram: Which One Actually Goes Viral? (2026)",   desc: "We tested every major AI tool for Instagram. See which ones actually drive saves, shares, and reach — and why social media managers are switching to Zyvo.", date: "Apr 27, 2026", category: "Go Viral",           img: GV8  },
  { to: "/blog/best-ai-image-generators-social-media-2026",title: "Best AI Image Generators for Social Media in 2026: Ranked & Compared",             desc: "Full breakdown of Zyvo, Midjourney, Adobe Firefly, DALL-E 3, Stable Diffusion, and Canva AI — quality, pricing, and social media performance ranked.",    date: "Apr 27, 2026", category: "AI Image Generator", img: IG3  },
  { to: "/blog/face-asmr-maker",                         title: "Face ASMR Maker: Create Viral Face ASMR Videos with AI in 2026",                     desc: "How the Face ASMR maker works and why creators are hitting millions of views by placing any face into satisfying ASMR texture scenes.", date: "May 24, 2026", category: "Go Viral",           img: GV9  },
  { to: "/blog/viral-face-asmr-videos",                  title: "Why Face ASMR Videos Go Viral on TikTok in 2026",                                    desc: "The psychology behind ASMR virality, the face recognition scroll-stop, and the exact strategy creators use to build audiences fast.",   date: "May 24, 2026", category: "Go Viral",           img: GV10 },
  { to: "/blog/asmr-video-ideas-tiktok-2026",            title: "Best ASMR Video Ideas for TikTok in 2026 (That Actually Go Viral)",                  desc: "The 10 ASMR video concepts generating the most views in 2026 — face combos, texture strategies, and execution tips for each.",         date: "May 25, 2026", category: "Go Viral",           img: GV11 },
  { to: "/blog/how-to-start-asmr-channel-with-ai",       title: "How to Start an ASMR Channel with AI in 2026 (No Camera or Mic Needed)",             desc: "The complete playbook to launch an ASMR TikTok channel using AI — no equipment, no editing, daily posting from a single photo upload.", date: "May 25, 2026", category: "Go Viral",           img: GV12 },
  { to: "/blog/clay-rescue-ai-video-maker",              title: "Clay Rescue AI Video Maker: Create Viral Giant Hand Rescue Videos",                  desc: "How to create tiny clay rescue videos with clear disasters, visible giant hand fixes, and emotional clay people reactions.",            date: "Jun 1, 2026",  category: "Go Viral",           img: "/clayrescue/smallpreview.webp" },
  { to: "/blog/why-giant-hand-rescue-videos-go-viral",   title: "Why Giant Hand Rescue Videos Go Viral on TikTok in 2026",                            desc: "The retention psychology behind miniature disasters, simple visible fixes, and celebration payoffs in Clay Rescue videos.",             date: "Jun 1, 2026",  category: "Go Viral",           img: "/clayrescue/landing1.png" },

  // ═══════════════ Go Viral ═══════════════
  { to: "/blog/how-to-go-viral-with-ai",                           title: "How to Go Viral With AI in 2026: The Complete Strategy",  desc: "The exact playbook creators are using to dominate TikTok, Instagram, and YouTube with AI content.", date: "Apr 16, 2026", category: "Go Viral",           img: GV1  },
  { to: "/blog/ai-video-new-viral-currency",                       title: "AI Video Is the New Viral Currency — Here's How to Use It", desc: "How creators are hitting millions of views with AI-generated short-form video.",                date: "Apr 16, 2026", category: "Go Viral",           img: GV2  },
  { to: "/blog/viral-ai-images-tiktok",                            title: "These AI Images Are Going Viral on TikTok",               desc: "Learn how to go viral on TikTok with AI images.",                                                date: "Feb 1, 2026",  category: "Go Viral",           img: GV3  },
  { to: "/blog/creators-blowingup-with-ai",                        title: "How Creators Are Blowing Up Using AI Image Generators",   desc: "Learn to make images that current creators are using to blow up.",                                date: "Feb 1, 2026",  category: "Go Viral",           img: GV4  },
  { to: "/blog/i-test-viral-prompts",                              title: "I Tested 10 Viral AI Image Prompts — Here Are the Results", desc: "Here are the results of 10 viral AI image prompts tested.",                                    date: "Feb 2, 2026",  category: "Go Viral",           img: GV5  },
  { to: "/blog/all-image-styles-everyone-obsessed-with",           title: "The AI Image Styles Everyone Is Obsessed With Right Now", desc: "Learn what kind of images are trending right now.",                                               date: "Feb 2, 2026",  category: "Go Viral",           img: GV6  },
  { to: "/blog/scroll-stopping-images-no-design-skills",           title: "How to Create Scroll-Stopping Images With AI (No Design Skills)", desc: "Create scroll-stopping images with AI — zero design skills needed.",                   date: "Feb 4, 2026",  category: "Go Viral",           img: GV7  },
  { to: "/blog/why-ai-images-outperform-real-photos",              title: "Why AI Images Outperform Real Photos",                    desc: "Why AI images beat real photos in quality, consistency, and creative control.",                    date: "Feb 4, 2026",  category: "Go Viral",           img: GV8  },
  { to: "/blog/the-secret-prompts-behind-viral-ai-images",         title: "The Secret Prompts Behind Viral AI Images",               desc: "Learn the secret prompts that make AI images go viral.",                                         date: "Feb 5, 2026",  category: "Go Viral",           img: GV9  },
  { to: "/blog/how-to-turn-any-idea-into-a-viral-image-using-ai",  title: "How to Turn Any Idea Into a Viral Image Using AI",        desc: "Turn any idea into a viral image using AI — step by step.",                                      date: "Feb 5, 2026",  category: "Go Viral",           img: GV10 },
  { to: "/blog/all-ai-image-trends-you-need-to-jump-on",           title: "All AI Image Trends You Need to Jump On",                 desc: "All the AI image trends you need to jump on in 2026.",                                           date: "Feb 10, 2026", category: "Go Viral",           img: GV11 },
  { to: "/blog/why-your-posts-dont-go-viral",                      title: "Why Your Posts Don't Go Viral",                          desc: "Learn why your posts don't go viral and exactly how to fix it.",                                  date: "Feb 10, 2026", category: "Go Viral",           img: GV12 },

  // ═══════════════ AI Image Generator ═══════════════
  { to: "/blog/best-ai-image-generator-for-social-media",          title: "Best AI Image Generator for Social Media Content",        desc: "How to choose the best AI image generator for social media in 2026.",                            date: "Feb 11, 2026", category: "AI Image Generator", img: IG1  },
  { to: "/blog/how-to-generate-high-quality-images-with-ai",       title: "How to Generate High-Quality Images With AI in Seconds",  desc: "Learn how to generate high-quality images with AI in seconds.",                                  date: "Feb 11, 2026", category: "AI Image Generator", img: IG2  },
  { to: "/blog/ai-image-generator-beginners-guide-2026",           title: "AI Image Generator: Complete Beginner's Guide (2026)",    desc: "Everything you need to know about AI image generators in 2026.",                                 date: "Feb 12, 2026", category: "AI Image Generator", img: IG3  },
  { to: "/blog/create-professional-images-with-ai",                title: "Create Professional Images with AI",                     desc: "Everything you need to know about creating professional images with AI.",                         date: "Feb 12, 2026", category: "AI Image Generator", img: IG4  },
  { to: "/blog/ai-image-generator-vs-traditional-design",          title: "AI Image Generator vs Traditional Design: What Works Better?", desc: "How AI image generators compare to traditional design in 2026.",                          date: "Feb 15, 2026", category: "AI Image Generator", img: IG5  },
  { to: "/blog/top-ai-image-generator-features-that-matter",       title: "Top AI Image Generator Features That Actually Matter",    desc: "The most important features of AI image generators in 2026.",                                   date: "Feb 15, 2026", category: "AI Image Generator", img: IG6  },
  { to: "/blog/generate-images-for-ads-using-ai",                  title: "How to Generate Images for Ads Using AI",                 desc: "Create high-quality ad creatives with the help of AI images.",                                   date: "Feb 16, 2026", category: "AI Image Generator", img: IG7  },
  { to: "/blog/ai-image-generator-for-content-creators",           title: "AI Image Generator for Content Creators",                desc: "Which AI image generators are best for content creators and how to use them.",                    date: "Feb 16, 2026", category: "AI Image Generator", img: IG8  },
  { to: "/blog/how-ai-image-generators-work",                      title: "How AI Image Generators Work (Explained Simply)",         desc: "Learn how AI image generators work and take advantage of them.",                                  date: "Mar 2, 2026",  category: "AI Image Generator", img: IG9  },
  { to: "/blog/is-ai-image-generation-worth-it-for-creators",      title: "Is AI Image Generation Worth It for Creators?",           desc: "How worthwhile AI image generation really is and the real benefits.",                             date: "Mar 2, 2026",  category: "AI Image Generator", img: IG10 },
  { to: "/blog/top-ai-image-styles-that-go-viral-on-social-media", title: "Top AI Image Styles That Go Viral on Social Media",       desc: "The best styles that go viral on social media and how to use them.",                              date: "Mar 5, 2026",  category: "AI Image Generator", img: IG11 },
  { to: "/blog/how-to-create-minimalist-images-using-ai",          title: "How to Create Minimalist Images Using AI",                desc: "Create the best minimalist images using AI and benefit from them.",                               date: "Mar 5, 2026",  category: "AI Image Generator", img: IG12 },
  { to: "/blog/how-to-create-movie-style-visuals",                 title: "Cinematic AI Images: How to Create Movie-Style Visuals",  desc: "How to create the best movie-style images using AI.",                                            date: "Mar 11, 2026", category: "AI Image Generator", img: IG13 },
  { to: "/blog/why-3d-ai-images-perform-better",                   title: "3D AI Images: Why They Perform Better on Social Platforms", desc: "Why 3D AI images perform way better on social platforms.",                                    date: "Mar 11, 2026", category: "AI Image Generator", img: IG14 },
  { to: "/blog/how-to-generate-aesthetic-images-with-ai",          title: "How to Generate Aesthetic Images With AI",                desc: "Generate aesthetic images using AI and use them effectively.",                                   date: "Mar 12, 2026", category: "AI Image Generator", img: IG15 },
  { to: "/blog/which-ai-image-style-works-best",                   title: "Anime, 3D, or Realistic? Which AI Image Style Works Best", desc: "Use only the best AI image styles and learn to control them.",                                  date: "Mar 12, 2026", category: "AI Image Generator", img: IG16 },
  { to: "/blog/how-to-create-luxury-ai-images",                    title: "How to Create Luxury-Looking Images With AI",             desc: "Create luxury-looking images with the help of Zyvo's AI generation.",                            date: "Mar 14, 2026", category: "AI Image Generator", img: IG17 },
  { to: "/blog/ai-image-generator-for-dark-visuals",               title: "AI Image Generator for Dark, Moody & Cinematic Visuals",  desc: "Discover dark, moody & cinematic visual styles and how to use them.",                            date: "Mar 14, 2026", category: "AI Image Generator", img: IG18 },
  { to: "/blog/ai-product-photography-high-end",                   title: "How to Create High-End Product Images Using AI",          desc: "Create high-end product images using Zyvo AI.",                                                  date: "Mar 15, 2026", category: "AI Image Generator", img: IG19 },
  { to: "/blog/ai-visual-styles-most-engagement",                  title: "Visual Styles That Get the Most Engagement (AI Edition)", desc: "Which visual styles get the most engagement — revealed.",                                        date: "Mar 15, 2026", category: "AI Image Generator", img: IG20 },
];

const CATEGORIES = ["All", "Viral Script", "Go Viral", "AI Image Generator", "Product Photos"];

export default function BlogIndex() {
  useEffect(() => {
    document.title = "Zyvo Blog — AI Insights for Creators & Brands";
  }, []);

  const [activeCategory, setActiveCategory] = useState("All");
  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading] = useState(false);

  const filtered =
    activeCategory === "All"
      ? ALL_BLOGS
      : ALL_BLOGS.filter((b) => b.category === activeCategory);

  const categoryCounts = {
    All:                  ALL_BLOGS.length,
    "Viral Script":       ALL_BLOGS.filter((b) => b.category === "Viral Script").length,
    "Go Viral":           ALL_BLOGS.filter((b) => b.category === "Go Viral").length,
    "AI Image Generator": ALL_BLOGS.filter((b) => b.category === "AI Image Generator").length,
    "Product Photos":     ALL_BLOGS.filter((b) => b.category === "Product Photos").length,
  };

  return (
    <section className="bg-[#F7F5FA] min-h-screen">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0E0C15] via-[#150d2e] to-[#0E0C15] px-6 py-16 md:py-20">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block bg-white/10 text-white/60 text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-widest mb-5">
            Insights & Guides
          </span>
          <h1 className="text-white font-extrabold text-[32px] md:text-[44px] leading-tight">
            Zyvo{" "}
            <span className="bg-gradient-to-r from-[#9B6FFF] to-[#C084FC] bg-clip-text text-transparent">
              Blog
            </span>
          </h1>
          <p className="text-white/50 mt-3 text-[14px] md:text-[15px] max-w-xl mx-auto leading-relaxed">
            Strategies, guides, and insights on AI image generation, product photos, and going viral.
          </p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="sticky top-0 z-10 bg-[#F7F5FA] border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 flex gap-1 py-3 overflow-x-auto">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? "bg-[#110829] text-white shadow-sm"
                    : "text-[#6B7280] hover:bg-gray-200 hover:text-[#110829]"
                }`}
              >
                {cat}
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded-full font-normal ${
                    isActive ? "bg-white/20 text-white" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {categoryCounts[cat]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Blog Grid */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((blog) => (
            <Link
              key={blog.to}
              to={blog.to}
              className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg border border-gray-100 transition-all duration-200 hover:-translate-y-0.5 flex flex-col"
            >
              {/* Thumbnail */}
              <div className="relative h-44 overflow-hidden bg-gray-100">
                <img
                  src={blog.img}
                  alt={blog.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                <span
                  className={`absolute top-3 left-3 text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm ${
                    CAT_PILL[blog.category]
                  }`}
                >
                  {blog.category}
                </span>
              </div>

              {/* Content */}
              <div className="p-4 flex flex-col gap-2 flex-1">
                <h2 className="text-[#110829] font-semibold text-[14px] leading-snug line-clamp-2 group-hover:text-[#7A3BFF] transition-colors duration-150">
                  {blog.title}
                </h2>
                <p className="text-[#6B7280] text-[12px] leading-relaxed line-clamp-2 flex-1">
                  {blog.desc}
                </p>
                <div className="flex items-center gap-1.5 pt-2 mt-auto">
                  <Calendar className="w-3 h-3 text-[#9CA3AF]" />
                  <span className="text-[#9CA3AF] text-[11px]">{blog.date}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Suggestion Box */}
      <div className="mt-4 mb-10">
        <div className="flex items-center flex-col max-w-2xl mx-auto px-6">
          <h2 className="text-[#110829] font-semibold text-[18px]">
            Do you have improvement suggestions for Zyvo?
          </h2>
          <div className="bg-white border border-gray-200 p-4 w-full mt-4 rounded-xl shadow-sm">
            <textarea
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              className="mt-2 w-full h-24 p-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-[#7A3BFF] text-[#110829]"
              placeholder="Your suggestions..."
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={async () => {
                  if (!suggestion.trim()) return;
                  setLoading(true);
                  const { error } = await supabase
                    .from("suggestions")
                    .insert([{ message: suggestion }]);
                  if (!error) setSuggestion("");
                  setLoading(false);
                }}
                disabled={loading}
                className="bg-[#7A3BFF] text-white px-6 py-2 rounded-md shadow-md hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Sending..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-col">
        <Footer />
      </div>
    </section>
  );
}
