import React from "react";
import { Link } from "react-router-dom";
import RelatedArticles from "../../../app/blog/RelatedArticles";
import Footer from "../../../components/workspace/footer.jsx";

const related = [
  {
    title: "3D AI Images: Why They Perform Better on Social Platforms",
    description:
      "Learn why 3D AI images perform way better on social platforms.",
    date: "15.02.2026",
    slug: "/blog/why-3d-ai-images-perform-better",
  },
  {
    title: "How to Generate Aesthetic Images With AI",
    description:
      "Learn how to generate Aesthetic images using AI and use them for good",
    date: "12.03.2026",
    slug: "/blog/how-to-generate-aesthetic-images-with-ai",
  },
  {
    title: "Anime, 3D, or Realistic? Which AI Image Style Works Best",
    description:
      "Use only the best AI Image styles and learn to contorl them",
    date: "12.03.2026",
    slug: "/blog/which-ai-image-style-works-best",
  },
];

export default function VisualStylesAI() {
  return (
    <div className="w-full bg-white text-gray-800">

      {/* HERO */}

      <header className="max-w-6xl mx-auto px-6 pt-24 pb-16">

        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          Visual Styles That Get the Most Engagement (AI Edition)
        </h1>

        <p className="text-lg text-gray-600 max-w-3xl">
          Certain visual styles consistently attract more engagement
          on social media. With AI image generators creators can
          easily experiment with different styles to discover what
          resonates most with their audience.
        </p>

      </header>

      {/* STYLE 1 */}

      <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-16 items-center">

        <article>

          <h2 className="text-3xl font-semibold mb-4">
            Cinematic Visuals
          </h2>

          <p className="text-gray-600 mb-4">
            Cinematic visuals are one of the most engaging AI
            styles. Dramatic lighting, deep shadows and
            movie-like composition make images stand out
            instantly in social feeds.
          </p>

          <p className="text-gray-600">
            This style works especially well for storytelling
            content and high-impact visuals.
          </p>

        </article>

        <div className="w-full aspect-[4/3]rounded-3xl flex items-center justify-center text-gray-400 order-2 md:order-1">
        <img className="rounded-md" src="/blog/AIImageGeneratorVsTraditionalDesign/product2.png" alt="Cinematic AI-generated visual with dramatic lighting" loading="lazy" width="1200" height="900"></img>
        </div>

      </section>

      {/* STYLE 2 */}

      <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-16 items-center">

         <div className="w-full aspect-[4/3]rounded-3xl flex items-center justify-center text-gray-400 order-2 md:order-1">
        <img className="rounded-md" src="/thumbs/3dcartoon.png" alt="Playful 3D cartoon-style AI visual" loading="lazy" width="1200" height="900"></img>
        </div>

        <article className="order-1 md:order-2">

          <h2 className="text-3xl font-semibold mb-4">
            3D Cartoon Style
          </h2>

          <p className="text-gray-600 mb-4">
            3D cartoon visuals are highly engaging because they
            feel dynamic and playful. This style is often used
            for characters, avatars and viral social content.
          </p>

          <p className="text-gray-600">
            Animated-style visuals tend to perform well on
            TikTok and Instagram.
          </p>

        </article>

      </section>

      {/* STYLE 3 */}

      <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-16 items-center">

        <article>

          <h2 className="text-3xl font-semibold mb-4">
            Aesthetic Visuals
          </h2>

          <p className="text-gray-600 mb-4">
            Aesthetic visuals focus on color harmony,
            minimal composition and soft lighting.
          </p>

          <p className="text-gray-600">
            This style is extremely popular on platforms
            like Pinterest and Instagram.
          </p>

        </article>

            <div className="w-full aspect-[4/3]rounded-3xl flex items-center justify-center text-gray-400 order-2 md:order-1">
        <img className="rounded-md" src="/thumbs/3d.webp" alt="Soft aesthetic AI visual with balanced color and lighting" loading="lazy" width="1200" height="900"></img>
        </div>

      </section>

      {/* STYLE 4 */}

      <section className="max-w-6xl mx-auto px-6 py-16">

        <h2 className="text-3xl font-semibold mb-6">
          Other High-Engagement AI Styles
        </h2>

        <ul className="grid md:grid-cols-2 gap-4 text-gray-600">

          <li>• Anime character art</li>
          <li>• Dark cinematic scenes</li>
          <li>• Luxury aesthetic visuals</li>
          <li>• Minimalist design styles</li>

        </ul>

      </section>

      {/* CTA */}

      <section className="max-w-4xl mx-auto px-6 py-20 text-center">

        <h2 className="text-3xl font-semibold mb-6">
          Try Different AI Visual Styles
        </h2>

        <p className="text-gray-600 mb-6">
          Experiment with different visual styles to discover
          what generates the most engagement for your audience.
        </p>

        <Link
          to="/workspace/image-generator"
          className="inline-block px-8 py-3 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 transition"
        >
          Generate AI Images
        </Link>

      </section>

      {/* RELATED */}

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <RelatedArticles articles={related} />
      </section>

        <div className="text-white">
      <Footer />
      </div>

    </div>
  );
}
