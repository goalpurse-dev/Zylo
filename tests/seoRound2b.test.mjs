// SEO round 2b (2026-10-11): the free-plan mark on saved images, and the cut of
// the product-photo (e-commerce) content.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";

import { blogArticles, CATEGORIES, CATEGORY_SLUGS } from "../src/data/blogArticles.js";
import { getPublicSeoMetadata } from "../src/data/publicSeoMetadata.js";
import { IMAGE_FAQ, IMAGE_GALLERY, IMAGE_PROMPTS, IMAGE_STEPS, IMAGE_USE_CASES, IMAGE_GENERATOR_SEO } from "../src/data/imageGeneratorLanding.js";

const read = (pathname) => readFileSync(new URL(`../${pathname}`, import.meta.url), "utf8");
const has = (pathname) => existsSync(new URL(`../${pathname}`, import.meta.url));
const KEPT = ["/blog/ai-product-photo-generator", "/blog/zyvo-vs-midjourney-product-photos", "/blog/ai-tools-every-shopify-store-owner-should-know"];

test("free plan: a saved image carries a small \"Made with Zyvo AI\" mark; paid plans save without it", () => {
  const mark = read("src/lib/freeWatermark.js");
  assert.ok(mark.includes('export const FREE_MARK_TEXT = "Made with Zyvo AI";'));
  // The plan comes from profiles.plan_code (what the server gates read), and a failed lookup never marks a paying account.
  assert.ok(mark.includes('.from("profiles").select("plan_code")'));
  assert.ok(mark.includes('=== "free"'));
  assert.ok(mark.includes("never mark a paying account because a lookup failed"));
  assert.ok(mark.includes("if (!userId) return false;"), "a signed-out visitor is not marked");
  // Bottom-right corner, sized from the image.
  assert.ok(mark.includes("const x = canvas.width - margin - boxWidth;"));
  assert.ok(mark.includes("const y = canvas.height - margin - boxHeight;"));
  assert.ok(mark.includes("width * 0.016"));
  // Every save and share of an image goes through the one helper, which applies it.
  const save = read("src/lib/downloadMedia.ts");
  assert.ok(save.includes('const { markForFreePlan } = await import("./freeWatermark.js");'));
  assert.ok(save.includes("blob = await markForFreePlan(typed);"));
  assert.ok(save.includes("return saveMediaToDevice({ ...options, preferShare: true });"), "sharing uses the same path");
  // Creations saves an image through that helper too (it used to link to the raw file).
  const library = read("src/components/creations/library.jsx");
  assert.ok(library.includes('saveMediaToDevice({ url: activeItem.result_url, filename: "zyvo-image.png"'));
  // The image tool shows the mark and says so before saving.
  const result = read("src/components/ImageGenerator/Result.jsx");
  assert.ok(result.includes("{freeMark && <FreeMarkPreview />}"));
  assert.ok(result.includes("{freeMark && <FreeMarkNote />}"));
  // Pricing: watermark-free belongs to the paid plans.
  const pricing = read("src/components/pricing/PricingExtras.jsx");
  assert.ok(pricing.includes(">Every paid plan includes</h2>"));
  assert.ok(!pricing.includes(">Every plan includes<"));
  assert.ok(read("src/components/pricing/OutputTables.jsx").includes('{ label: "Watermark-free exports", cell: paid }'));
  assert.match(IMAGE_FAQ[0].a, /free plan carry a small "Made with Zyvo AI" mark; paid plans save without it/);
});

test("product-photo content: three posts stay and link to /image-generator, the rest 301 without chains", () => {
  const app = read("src/App.jsx");
  const redirects = JSON.parse(read("vercel.json")).redirects;
  const sources = new Map(redirects.map((r) => [r.source, r]));
  const sitemap = read("public/sitemap.xml");
  for (const slug of KEPT) {
    assert.ok(app.includes(`path="${slug}"`), `${slug} keeps its route`);
    assert.ok(sitemap.includes(`<loc>https://www.tryzyvo.com${slug}</loc>`), `${slug} is in the sitemap`);
    assert.equal(sources.has(slug), false);
    assert.equal(blogArticles.find((article) => article.slug === slug)?.category, "AI Images");
  }
  for (const file of ["AIProductPhotoGenerator.jsx", "ZyvoVsMidjourneyProductPhotos.jsx", "Ai-Tools-Every-Shopify-Store-Owner-Know.jsx"]) {
    assert.ok(read(`src/app/blog/productphotos/${file}`).includes('"/image-generator"'), `${file} links to /image-generator`);
  }
  assert.deepEqual(readdirSync(new URL("../src/app/blog/productphotos/", import.meta.url)).sort(), ["AIProductPhotoGenerator.jsx", "Ai-Tools-Every-Shopify-Store-Owner-Know.jsx", "ZyvoVsMidjourneyProductPhotos.jsx"]);
  // The posts that went: a 301 to one of the three or to /image-generator, no route, no sitemap entry, no registry entry.
  const gone = [
    "/blog/product-photos-with-ai-for-shopify", "/blog/product-photos-for-shopify-store", "/blog/AI-product-photos-increase-conversion-rates", "/blog/best-ai-tools-for-ecommerce",
    "/blog/shopify-product-photo-best-practices", "/blog/ai-vs-traditional-product-photography", "/blog/why-product-photos-matter-for-ecommerce-success", "/blog/how-to-improve-ecommerce-visual-trust",
    "/blog/product-photography-mistakes-ecommerce-brands-make", "/blog/how-visual-branding-impacts-online-sales", "/blog/ai-background-removal-for-product-photos", "/blog/how-to-scale-ecommerce-content-creation-with-ai",
    "/blog/converting-product-images-for-shopify-stores", "/blog/ai-product-photography-for-small-businesses", "/blog/how-better-images-reduce-bounce-rate", "/blog/ecommerce-visual-consistency-explained",
    "/blog/ai-productphotos-for-dropshipping", "/blog/product-images-that-convert-full-guide", "/blog/studio-quality-product-photos", "/blog/why-clean-product-photos-build-trust",
    "/blog/visual-optimization-for-mobile-ecommerce", "/blog/how-ai-helps-ecommerce-brands-scale-faster", "/blog/product-photography-trends-for-ecommerce", "/blog/ai-product-photos-for-fashion-stores",
    "/blog/ai-product-photos-for-beaty-and-skincare", "/blog/how-visual-branding-separates-winners-from-losers", "/blog/ai-product-photography-high-end", "/blog/best-ai-product-backgrounds-to-use",
    "/blog/how-visual-quality-impacts-seo", "/blog/how-to-launch-products-faster-with-ai",
  ];
  const targets = new Set([...KEPT, "/image-generator"]);
  for (const slug of gone) {
    const rule = sources.get(slug);
    assert.ok(rule && rule.statusCode === 301 && targets.has(rule.destination), `${slug} 301s to a kept page (${rule?.destination})`);
    assert.equal(app.includes(`path="${slug}"`), false, `${slug} has no route`);
    assert.equal(sitemap.includes(`${slug}<`), false, `${slug} is out of the sitemap`);
    assert.equal(blogArticles.some((article) => article.slug === slug), false, `${slug} is out of the blog index`);
    assert.equal(getPublicSeoMetadata(slug), null);
  }
  // No redirect leads to another redirect.
  for (const rule of redirects) assert.equal(sources.has(rule.destination), false, `${rule.source} -> ${rule.destination} is a chain`);
  // The category is gone from the blog's navigation and 301s to the blog.
  assert.equal(CATEGORIES.includes("Product Photos"), false);
  assert.equal("Product Photos" in CATEGORY_SLUGS, false);
  assert.equal(blogArticles.some((article) => article.category === "Product Photos"), false);
  assert.deepEqual(sources.get("/blog/category/product-photos"), { source: "/blog/category/product-photos", destination: "/blog", statusCode: 301 });
  assert.equal(app.includes('path="/blog/category/product-photos"'), false);
  assert.equal(read("scripts/generateSitemap.js").includes("/blog/category/product-photos"), false);
  // The old product tools, which have no page any more, 301 to the image generator's page.
  for (const tool of ["/workspace/myproduct", "/workspace/productphoto", "/workspace/productphotos"]) {
    assert.deepEqual(sources.get(tool), { source: tool, destination: "/image-generator", statusCode: 301 });
    assert.equal(app.includes(`path="${tool}"`), false);
  }
});

test("/image-generator says nothing about e-commerce", () => {
  const words = JSON.stringify([IMAGE_GENERATOR_SEO, IMAGE_GALLERY, IMAGE_PROMPTS, IMAGE_FAQ, IMAGE_STEPS, IMAGE_USE_CASES]) + read("src/pages/landing/ImageGeneratorLanding.jsx");
  assert.doesNotMatch(words, /e-?commerce|shopify|online store/i);
  assert.ok(has("public/lp/image-generator/product-headphones.w960.webp"));
});

test("the plan is read from profiles.plan_code everywhere: nothing queries a \"subscriptions\" table", () => {
  // The Stripe webhook writes the plan there; the image tool used to ask a table that does not exist.
  assert.ok(read("supabase/functions/stripe-webhook/index.ts").includes("patch.plan_code"));
  const tool = read("src/pages/viral/Image.jsx");
  assert.ok(tool.includes("const { plan: userPlan } = usePlanCode();"));
  assert.ok(!tool.includes('.from("subscriptions")'));
  assert.ok(read("src/hooks/usePlanCode.js").includes('from("profiles").select("plan_code'));
  assert.ok(read("src/lib/freeWatermark.js").includes('.from("profiles").select("plan_code")'));
  const walk = (dir) => readdirSync(new URL(dir, import.meta.url), { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(`${dir}${entry.name}/`) : /\.(jsx?|tsx?)$/.test(entry.name) ? [`${dir}${entry.name}`] : []));
  for (const file of walk("../src/")) assert.ok(!readFileSync(new URL(file, import.meta.url), "utf8").includes('from("subscriptions")'), `${file} reads the missing table`);
});
