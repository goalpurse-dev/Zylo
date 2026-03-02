import React from "react";
import { Link } from "react-router-dom";
import RelatedArticles from "../../../app/blog/RelatedArticles";
import Footer from "../../../components/workspace/footer.jsx";

const related = [
  {
    title: "Create Professional Images with AI",
    description:
      "Learn everything you need to know about creating professional images with AI in 2026",
    date: "15.02.2026",
    slug: "/blog/create-professional-images-with-ai",
  },
  {
    title: "AI Image Generator: Complete Beginner’s Guide (2026)",
    description:
      "Learn everything you need to know about AI image generators in 2026",
    date: "08.01.2026",
    slug: "/blog/ai-image-generator-beginners-guide-2026",
  },
  {
    title: "How to Generate High-Quality Images With AI in Seconds",
    description:
      "Learn how to generate high-quality images with AI in seconds",
    date: "02.01.2026",
    slug: "/blog/how-to-generate-high-quality-images-with-ai",
  },
];

export default function HowAIImageGeneratorsWork() {
  return (
    <div className="w-full bg-white text-gray-800">

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-16">
        <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
          How AI Image Generators Work (Explained Simply)
        </h1>
        <p className="text-lg text-gray-600 max-w-3xl">
          AI image generators might look like magic — but they’re actually powered
          by advanced machine learning models trained on millions of images.
          In this guide, we’ll explain exactly how AI creates images from text
          in a simple and easy-to-understand way.
        </p>
      </section>

      {/* SECTION 1 */}
      <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-16 items-center">
        <div>
          <h2 className="text-3xl font-semibold mb-4">
            1. It Starts With Training on Millions of Images
          </h2>
          <p className="text-gray-600 mb-4">
            AI image generators are trained on massive datasets containing
            millions (sometimes billions) of images and text descriptions.
            During training, the AI learns patterns — like what “a red car”
            looks like, or how “sunset lighting” changes colors.
          </p>
          <p className="text-gray-600">
            Over time, the model understands relationships between words and
            visual elements. This is why when you type a prompt into an{" "}
            <Link to="/workspace/image-generator" className="text-purple-600 underline">
              AI image generator
            </Link>, it can produce something surprisingly accurate.
          </p>
        </div>

        {/* IMAGE PLACEHOLDER */}
        <div className="w-full h-80  rounded-3xl flex items-center justify-center text-gray-400">
         <img src="/assets/previews/fenix.webp" className="rounded-lg"></img>
        </div>
      </section>

      {/* SECTION 2 */}
      <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-16 items-center">
        {/* IMAGE PLACEHOLDER */}
          <div className="w-full h-80  rounded-3xl flex items-center justify-center text-gray-400">
         <img src="/assets/showcase/image1.webp" className="rounded-lg"></img>
        </div>
        <div className="order-1 md:order-2">
          <h2 className="text-3xl font-semibold mb-4">
            2. Turning Noise Into an Image
          </h2>
          <p className="text-gray-600 mb-4">
            Most modern AI generators use something called a “diffusion model.”
            Instead of drawing from scratch, the AI starts with random noise
            (basically visual static).
          </p>
          <p className="text-gray-600 mb-4">
            Then, step by step, it removes the noise while following your text
            prompt instructions. After dozens of refinement steps, the random
            noise transforms into a detailed image.
          </p>
          <p className="text-gray-600">
            That’s how platforms like{" "}
            <Link to="/home" className="text-purple-600 underline">
              modern AI art tools
            </Link>{" "}
            create images in seconds.
          </p>
        </div>
      </section>

      {/* SECTION 3 */}
      <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-16 items-center">
        <div>
          <h2 className="text-3xl font-semibold mb-4">
            3. Understanding Prompts and Style
          </h2>
          <p className="text-gray-600 mb-4">
            The words you type are called a “prompt.” The AI breaks your prompt
            into mathematical representations (vectors) and compares them to
            what it learned during training.
          </p>
          <p className="text-gray-600 mb-4">
            That’s why specific prompts like:
          </p>
          <ul className="list-disc ml-6 text-gray-600 mb-4">
            <li>“Cinematic lighting”</li>
            <li>“Ultra-realistic 8K”</li>
            <li>“Anime style character”</li>
          </ul>
          <p className="text-gray-600">
            produce very different results. If you want better outputs, learning
            prompt structure is key — and tools like{" "}
            <Link to="/workspace/image-generator" className="text-purple-600 underline">
              AI prompt builders
            </Link>{" "}
            can help refine them.
          </p>
        </div>

        {/* IMAGE PLACEHOLDER */}
           <div className="w-full h-80 rounded-3xl flex items-center justify-center text-gray-400">
         <img src="/assets/showcase/image.webp" className="rounded-lg aspect-[1/1]"></img>
        </div>
      </section>

      {/* FINAL SECTION */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-semibold mb-6">
          So… Is It Really “Creative”?
        </h2>
        <p className="text-gray-600 mb-6">
          AI doesn’t “imagine” like humans do — it predicts what pixels should
          appear next based on patterns it learned. But when combined with human
          creativity and smart prompting, the results can feel almost magical.
        </p>
        <p className="text-gray-600">
          If you want to try it yourself, explore our{" "}
          <Link to="/workspace/image-generator" className="text-purple-600 underline">
            AI image tools
          </Link>{" "}
          and start creating instantly.
        </p>
      </section>

      {/* RELATED ARTICLES */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <RelatedArticles articles={related} />
      </section>

      {/* FOOTER */}
      <div className="text-white">
      <Footer />
      </div>

    </div>
  );
}