// src/pages/help/HelpCenter.tsx
import React, { Suspense, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Mail, MessageCircleQuestion, BookOpenText, Home as HomeIcon, Send, ArrowLeft } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { POSTS, getPostBySlug } from "./blog/posts";

/** Programmatic jump to Contact tab */
export function navigateToContact(navigate: ReturnType<typeof useNavigate>) {
  navigate("/help?tab=contact", { replace: false });
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <div className="mt-4 text-gray-700">{children}</div>
    </div>
  );
}

/* ---------------------------------- FAQ --------------------------------- */
function Faq() {
  const items = [
    {
      q: "What is Zylo?",
      a: "Zylo is a brand-centric creative suite for logos, brand kits, product shots, and ad/video generation powered by credits.",
    },
    {
      q: "How do credits work?",
      a: "Your plan includes monthly credits; you can top up anytime. Credits are deducted when you render images or videos.",
    },
    {
      q: "Where can I manage my plan?",
      a: "Go to Settings → Billing to open the Stripe portal for upgrades, downgrades, or cancellations.",
    },
  ];
  return (
    <SectionCard title="Frequently asked questions">
      <ul className="divide-y divide-gray-200">
        {items.map((it, i) => (
          <li key={i} className="py-4">
            <details className="group">
              <summary className="cursor-pointer list-none text-base font-medium text-gray-900 flex items-center gap-2">
                <MessageCircleQuestion className="h-5 w-5" />
                {it.q}
                <span className="ml-auto text-gray-400 group-open:rotate-180 transition-transform">⌄</span>
              </summary>
              <p className="mt-2 text-gray-700">{it.a}</p>
            </details>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

/* --------------------------------- Blog --------------------------------- */
function BlogList({ onOpen, search }: { onOpen: (slug: string) => void; search: string }) {
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return POSTS;
    return POSTS.filter((p) => (p.title + " " + p.summary + " " + (p.searchText || "")).toLowerCase().includes(q));
  }, [search]);

  return (
    <SectionCard title="Blog, guides & release notes">
      <div className="grid gap-4 sm:grid-cols-2">
        {list.map((p) => (
          <article key={p.slug} className="rounded-xl border border-black/5 bg-white p-4 hover:shadow-md transition">
            <h3 className="text-lg font-semibold text-gray-900">{p.title}</h3>
            <p className="mt-2 text-sm text-gray-600">{p.summary}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">{new Date(p.date).toLocaleDateString()}</span>
              <button onClick={() => onOpen(p.slug)} className="rounded-lg border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50">
                Read
              </button>
            </div>
          </article>
        ))}
        {list.length === 0 && <p className="text-sm text-gray-600">No results. Try another term.</p>}
      </div>
    </SectionCard>
  );
}

function BlogPost({ slug, onBack }: { slug: string; onBack: () => void }) {
  const meta = getPostBySlug(slug);
  const Component = meta?.Component;
  if (!meta || !Component) return <SectionCard title="Not found">That post does not exist.</SectionCard>;
  return (
    <SectionCard title={meta.title}>
      <p className="text-sm text-gray-500">{new Date(meta.date).toLocaleString()}</p>
      <div className="prose prose-gray mt-4 max-w-none">
        <Suspense fallback={<p>Loading…</p>}>
          <Component />
        </Suspense>
      </div>
      <button onClick={onBack} className="mt-6 inline-flex items-center gap-1 rounded-lg border border-gray-200 px-4 py-2 hover:bg-gray-50">
        <ArrowLeft className="h-4 w-4" /> Back to all posts
      </button>
    </SectionCard>
  );
}

function Contact() {
  const [sent, setSent] = useState<null | "ok" | "err">(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form).entries());
    setLoading(true);
    try {
      const { error } = await supabase.from("contact_messages").insert({
        name: data.name,
        email: data.email,
        company: data.company || null,
        subject: data.subject || null,
        message: data.message,
        source: "help-center",
      });
      if (error) throw error;

      const { error: fnError } = await supabase.functions.invoke("contact-email", {
        method: "POST",
        body: { ...data },
      });
      if (fnError) console.warn("contact-email error:", fnError);

      setSent("ok");
      form.reset();
    } catch (err) {
      console.error(err);
      setSent("err");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard title="Contact us">
      <p className="text-gray-700">
        Questions about billing, credits or anything else? Drop us a line. Or email{" "}
        <a className="underline" href="mailto:support@zylo.ai">support@zylo.ai</a>.
      </p>

      <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <input name="name" className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 sm:col-span-1" placeholder="Your name" required />
        <input name="email" className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 sm:col-span-1" type="email" placeholder="Email" required />
        <input name="company" className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 sm:col-span-1" placeholder="Company (optional)" />
        <input name="subject" className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 sm:col-span-1" placeholder="Subject" />
        <textarea name="message" className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 sm:col-span-2" rows={6} placeholder="How can we help?" required />

        <button
          disabled={loading}
          type="submit"
          className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-white hover:opacity-90 disabled:opacity-50 sm:col-span-2"
        >
          <Send className="h-4 w-4" /> {loading ? "Sending…" : "Send message"}
        </button>

        {sent === "ok" && <p className="sm:col-span-2 text-sm text-emerald-600">Thanks! We received your message.</p>}
        {sent === "err" && <p className="sm:col-span-2 text-sm text-rose-600">Sorry, something went wrong. Try again.</p>}
      </form>

      <div className="mt-6">
        <a href="mailto:support@zylo.ai" className="rounded-xl border border-gray-200 bg-gray-50 p-4 inline-flex items-center gap-2">
          <Mail className="h-5 w-5" /> support@zylo.ai
        </a>
      </div>
    </SectionCard>
  );
}

/* --------------------------------- Page --------------------------------- */
export default function HelpCenter() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") || "home") as "home" | "faq" | "blog" | "contact";
  const post = params.get("post");
  const [search, setSearch] = useState<string>(params.get("q") || "");

  function goto(nextTab: typeof tab, extra?: Record<string, string | null>) {
    const entries = new URLSearchParams(params);
    entries.set("tab", nextTab);
    if (extra) for (const [k, v] of Object.entries(extra)) v ? entries.set(k, v) : entries.delete(k);
    setParams(entries, { replace: true });
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Header with always-visible ← Home */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => (window.location.href = "/")}  // ← send to your main site; replace "/" with "https://zylo.ai" if hosted separately
            className="inline-flex items-center gap-2 rounded-xl bg-black px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
            aria-label="Go to Zylo home"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </button>

          <div className="h-10 w-10 rounded-2xl bg-black" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Zylo Help Center</h1>
            <p className="text-gray-600">FAQs, guides, and ways to reach us.</p>
          </div>
        </div>

        {/* Layout */}
        <div className="grid gap-6 md:grid-cols-[260px,1fr]">
          {/* Sidebar */}
          <nav className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
            <SidebarLink active={tab === "home"} icon={<HomeIcon className="h-4 w-4" />} label="Overview" onClick={() => goto("home")} />
            <SidebarLink active={tab === "faq"} icon={<MessageCircleQuestion className="h-4 w-4" />} label="FAQ" onClick={() => goto("faq")} />
            <SidebarLink active={tab === "blog"} icon={<BookOpenText className="h-4 w-4" />} label="Blog" onClick={() => goto("blog", { post: null })} />
            <SidebarLink active={tab === "contact"} icon={<Mail className="h-4 w-4" />} label="Contact us" onClick={() => goto("contact")} />
            <div className="mt-4">
              {tab === "blog" && (
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    const qp = new URLSearchParams(params);
                    e.target.value ? qp.set("q", e.target.value) : qp.delete("q");
                    setParams(qp, { replace: true });
                  }}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900"
                  placeholder="Search posts…"
                />
              )}
            </div>
          </nav>

          {/* Content */}
          <div className="grid gap-6">
            {tab === "home" && (
              <>
                <SectionCard title="Start here">
                  <p>
                    Welcome! Use the left menu to browse FAQs, read guides and release notes, or contact support.
                    We’ll expand this hub over time (changelogs, search, categories, etc.).
                  </p>
                </SectionCard>
                <Faq />
              </>
            )}

            {tab === "faq" && <Faq />}

            {tab === "blog" &&
              (post ? (
                <BlogPost slug={post} onBack={() => goto("blog", { post: null })} />
              ) : (
                <BlogList onOpen={(slug) => goto("blog", { post: slug })} search={search} />
              ))}

            {tab === "contact" && <Contact />}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarLink({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm",
        active ? "bg-black text-white" : "text-gray-800 hover:bg-gray-50",
      ].join(" ")}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
