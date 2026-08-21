import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "What Is Face ASMR? The AI Trend Turning Any Face Into a Satisfying Texture",
    description: "What Face ASMR is, how the texture transformation works, and how to make your own.",
    date: "20.08.2026",
    slug: "/blog/what-is-face-asmr",
  },
  {
    title: "6 Mistakes Killing Your Face ASMR Video Quality",
    description: "The most common reasons results come back unclear, and the source-photo fix for each.",
    date: "21.08.2026",
    slug: "/blog/face-asmr-mistakes",
  },
  {
    title: "Why Face ASMR Videos Go Viral on TikTok in 2026",
    description: "The psychology behind ASMR virality and the face recognition scroll-stop.",
    date: "24.05.2026",
    slug: "/blog/viral-face-asmr-videos",
  },
];

const FAQS = [
  {
    q: "Do I have to use my own photo?",
    a: "Face ASMR is designed around uploading your own photo. Only upload a photo you have the right to use.",
  },
  {
    q: "Is my photo shared publicly by Zyvo?",
    a: "Uploaded photos are used to generate your video; Zyvo doesn't post your content publicly on your behalf. Review Zyvo's privacy policy for the specifics of how uploaded content is handled.",
  },
  {
    q: "Can I delete a photo or generation after uploading it?",
    a: "Check your account settings and Zyvo's privacy policy for current options around managing and deleting your uploaded content.",
  },
  {
    q: "Where can I read the full privacy policy?",
    a: "Zyvo's full privacy policy covers exactly how account and uploaded content data is handled — it's the authoritative source for anything not covered here.",
  },
];

export default function FaceAsmrPrivacy() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>Is Face ASMR Safe</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Trust & Privacy
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            Is Face ASMR Safe? Photo Privacy Basics Before You Upload
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Uploading a personal photo is a reasonable thing to think twice about. Here's what to know before you try Face ASMR, and where to find the specifics.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 21, 2026 · 4 min read · Trust & Privacy</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/face-asmr-privacy-hero.png"
              alt="An abstract glowing translucent glass shield protecting a soft glowing orb behind it"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)]">
            <img
              src="/blog-assets/face-asmr-privacy-lock.png"
              alt="An abstract glowing purple padlock with soft glossy reflections"
              width={640}
              height={480}
              className="aspect-[4/3] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
        </div>

        <div className="prose-custom max-w-3xl space-y-10 text-[#374151]">

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Good instinct — always check before uploading a personal photo</h2>
            <p className="text-[17px] leading-relaxed">
              Face ASMR is built around uploading your own photo and transforming it into a texture-based video. That's a normal thing to want more information about before trying, and it's worth being deliberate about which photo you choose regardless of which tool you're using.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">A few practical habits</h2>
            <div className="space-y-3">
              {[
                { title: "Only upload your own photo, or one you have permission to use", desc: "This applies to any AI tool that transforms an uploaded image, not just Face ASMR." },
                { title: "Choose a photo you're comfortable being processed by the tool", desc: "If you're unsure, start with a lower-stakes photo before uploading anything more personal." },
                { title: "Review the privacy policy for specifics", desc: "For exact details on data handling, storage, and deletion, the privacy policy is the authoritative source — not general guidance like this article." },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[15px] font-bold text-[#110829] mb-1.5">{item.title}</p>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Read the Full Policy</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              For the complete details on how Zyvo handles account and uploaded content, see the privacy policy directly.
            </p>
            <Link
              to="/support/policies/privacy"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              View Privacy Policy →
            </Link>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-5">Frequently asked questions</h2>
            <div className="space-y-3">
              {FAQS.map((f) => (
                <div key={f.q} className="rounded-xl border border-[#E5E0F5] bg-white p-5">
                  <p className="text-[15px] font-bold text-[#110829] mb-2">{f.q}</p>
                  <p className="text-[14px] text-[#6b7280] leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </section>

        </div>

        <div className="mt-20">
          <RelatedArticles articles={related} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
