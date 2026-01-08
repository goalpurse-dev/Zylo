import React from "react";
import { Link } from "react-router-dom";
import { LifeBuoy, CreditCard, User, Shield, FileText, Video, Image as ImageIcon, MessageSquare } from "lucide-react";

const ring = "ring-1 ring-white/10";
const card = `rounded-2xl bg-[#111] ${ring}`;
const pill = "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border border-white/10 bg-white/10 hover:bg-white/15";

const CATS = [
  { icon: LifeBuoy,  title: "Getting started",   to: "/support/article/getting-started", blurb: "First steps, FAQs, onboarding" },
  { icon: Video,     title: "Video tools",       to: "/support/article/video-overview", blurb: "AI video, avatars, shorts" },
  { icon: ImageIcon, title: "Image tools",       to: "/support/article/image-overview", blurb: "Enhance, generate, fix" },
  { icon: CreditCard,title: "Billing & plans",   to: "/support/article/billing", blurb: "Plans, invoices, refunds" },
  { icon: User,      title: "Account",           to: "/support/article/account", blurb: "Profile, login, workspaces" },
  { icon: Shield,    title: "Troubleshooting",   to: "/support/article/troubleshooting", blurb: "Common fixes" },
  { icon: FileText,  title: "Policies & Legal",  to: "/support/policies", blurb: "Terms, privacy, cookies" },
  { icon: MessageSquare, title: "Contact support", to: "/support/contact", blurb: "We’re here to help" },
];

export default function SupportHome() {
  return (
    <>
      {/* Hero */}
      <section className={card + " p-6"}>
        <h1 className="text-2xl font-extrabold mb-2">How can we help?</h1>
        <p className="text-sm text-white/70 mb-4">Browse popular topics or open a ticket.</p>

        <div className="flex flex-wrap gap-2">
          <Link to="/support/article/getting-started" className={pill}>Quick start</Link>
          <Link to="/support/article/billing" className={pill}>Billing</Link>
          <Link to="/support/policies" className={pill}>Policies</Link>
          <a href="/status" className={pill}>System status</a>
        </div>
      </section>

      {/* Categories */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CATS.map(({ icon: Icon, title, blurb, to }) => (
          <Link key={title} to={to} className={card + " p-5 hover:bg-[#121212]"}>
            <div className="mb-2 flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <div className="font-semibold">{title}</div>
            </div>
            <div className="text-sm text-white/70">{blurb}</div>
          </Link>
        ))}
      </section>

      {/* Social & Community */}
      <section className={card + " p-5"}>
        <div className="text-sm font-semibold mb-2">Community & socials</div>
        <div className="flex flex-wrap gap-2">
          <a className={pill} href="https://discord.gg/yourInvite" target="_blank" rel="noreferrer">Discord</a>
          <a className={pill} href="https://twitter.com/yourHandle" target="_blank" rel="noreferrer">Twitter/X</a>
          <a className={pill} href="https://youtube.com/@yourChannel" target="_blank" rel="noreferrer">YouTube</a>
          <a className={pill} href="mailto:support@yourdomain.com">Email support</a>
        </div>
      </section>
    </>
  );
}
