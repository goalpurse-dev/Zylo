import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar } from "lucide-react";
import Footer from "../../components/workspace/footer.jsx";
import CreditIcon from "../../components/ui/zyvo/CreditIcon.jsx";
import { trackSeoEvent } from "../../lib/seoAnalytics.js";
import MarkdownArticle from "./MarkdownArticle.jsx";
import { extractFaqs, extractRelatedLinks } from "./markdownBlogUtils.js";
import { getTownGuide } from "../../data/inThisTownBlog.js";
import { IN_THIS_TOWN_PATH, IN_THIS_TOWN_PRICE, TOWN_NOTICE } from "../../data/inThisTownLanding.js";

// The four In This Town guides. Content: src/data/inThisTownBlog.js. Title, description, canonical, OG and JSON-LD
// (BlogPosting + breadcrumb + FAQPage) come from PublicContentLayout (publicSeoMetadata.js + structuredData.js), the
// same on the server HTML and in the browser; this component only renders the article.
export default function InThisTownBlogGuide({ slug }) {
  const guide = getTownGuide(slug);
  const faqs = useMemo(() => (guide ? extractFaqs(guide.markdown) : []), [guide]);
  const links = useMemo(() => (guide ? extractRelatedLinks(guide.markdown) : []), [guide]);
  if (!guide) return null;

  return (
    <div className="min-h-screen bg-[#0B0D0F] text-white">
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
        <nav className="mb-6 text-[13px] text-white/55" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-lime-300">Home</Link><span className="mx-2">/</span>
          <Link to="/blog" className="hover:text-lime-300">Blog</Link><span className="mx-2">/</span>
          <Link to={IN_THIS_TOWN_PATH} className="hover:text-lime-300">In This Town</Link>
        </nav>

        <header>
          <span className="inline-flex rounded-full bg-lime-300/[0.12] px-3 py-1 text-[12px] font-bold uppercase tracking-[0.14em] text-lime-300">In This Town guide</span>
          <h1 className="mt-5 text-balance text-[32px] font-black leading-[1.08] tracking-[-0.03em] sm:text-[44px]">{guide.title}</h1>
          <p className="mt-5 text-[17px] leading-8 text-white/70">{guide.description}</p>
          <div className="mt-4 flex items-center gap-1.5 text-[13px] text-white/50">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />{guide.date} · {guide.readTime} · {guide.author}
          </div>
        </header>

        <figure className="mt-8 overflow-hidden rounded-[24px] border border-white/10 bg-black">
          <img src={guide.hero} alt={guide.heroAlt} width={guide.heroWidth} height={guide.heroHeight} className="aspect-[16/9] w-full object-cover" loading="eager" fetchPriority="high" />
        </figure>

        <article className="mt-10">
          <MarkdownArticle markdown={guide.markdown} slug={slug} ctaHref={IN_THIS_TOWN_PATH} />
        </article>

        <section className="mt-14" aria-labelledby="town-faq">
          <h2 id="town-faq" className="text-[24px] font-black tracking-[-0.02em] text-white">Frequently asked questions</h2>
          <div className="mt-5 space-y-3">
            {faqs.map(([q, a]) => (
              <details key={q} className="rounded-2xl border border-white/[0.09] bg-white/[0.03] px-5 py-4">
                <summary className="cursor-pointer list-none text-[15px] font-bold text-white">{q}</summary>
                <p className="pt-3 text-[14.5px] leading-7 text-white/70">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-[28px] border-2 border-lime-300/30 bg-gradient-to-br from-[#16200c] to-[#0b0d0f] p-7 text-center sm:p-10">
          <h2 className="text-[26px] font-black text-white">Turn one sentence into an &ldquo;In this town&rdquo; video</h2>
          <p className="mx-auto mt-3 max-w-[520px] text-[15.5px] leading-7 text-white/70">Type a rule, read the script, get a narrated 3D story with captions. Try the free rule preview first.</p>
          <Link to={IN_THIS_TOWN_PATH} onClick={() => trackSeoEvent("seo_cta_click", { slug: `blog:${slug}`, destination: IN_THIS_TOWN_PATH })}
            className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-lime-300 px-6 text-[16px] font-black text-[#11150D] transition hover:bg-lime-200">
            Make my video <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[14px] text-white/60"><CreditIcon className="h-4 w-4 text-lime-300" />{IN_THIS_TOWN_PRICE.credits} credits per video · refund if it fails</p>
        </section>

        <nav className="mt-12 grid gap-3 sm:grid-cols-2" aria-label="More guides">
          {links.map(([to, title]) => (
            <Link key={to} to={to} className="group rounded-2xl border border-white/[0.09] bg-white/[0.03] p-4 transition hover:border-lime-300/30">
              <p className="text-[14.5px] font-bold text-white group-hover:text-lime-300">{title}</p>
            </Link>
          ))}
        </nav>
        {TOWN_NOTICE && <p className="mt-10 text-center text-[13px] text-white/45">{TOWN_NOTICE}</p>}
      </main>
      <Footer />
    </div>
  );
}
