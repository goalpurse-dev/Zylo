import { Link } from "react-router-dom";

export default function SeoRelatedArticles({ posts, heading = "Learn More" }) {
  if (!posts?.length) return null;
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6">
      <h2 className="text-[20px] font-black tracking-[-0.02em] text-white">{heading}</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.slug}
            to={`/blog/${post.slug}`}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 transition hover:border-lime-300/25 hover:bg-white/[0.05]"
          >
            <p className="text-[13px] font-bold text-white">{post.title}</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-white/45">{post.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
