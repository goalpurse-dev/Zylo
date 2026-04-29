import React from "react";
import { useParams, Link } from "react-router-dom";

const ring = "ring-1 ring-white/10";
const card = `rounded-2xl bg-[#111] ${ring}`;

const POLICIES = {

  tos: {
    title: "Terms of Service",
    updated: "2026-03-14",
    body: [
      "By using Zyvo, you agree to these Terms of Service.",
      "Zyvo provides AI-powered tools for generating images, videos, and other creative content.",
      "You are responsible for how you use generated content.",
      "We may update the service, pricing, or policies at any time.",
      "Abuse of the platform, including automated scraping or misuse of credits, may result in account suspension."
    ]
  },

  privacy: {
    title: "Privacy Policy",
    updated: "2026-03-14",
    body: [
      "We respect your privacy and only collect the data necessary to operate the service.",
      "Information collected may include account email, usage data, and payment details processed via Stripe.",
      "We do not sell personal data to third parties.",
      "Analytics may be used to improve Zyvo's features and performance.",
      "Users can request deletion of their account data by contacting support."
    ]
  },

  cookies: {
    title: "Cookie Policy",
    updated: "2026-03-14",
    body: [
      "Zyvo uses cookies to improve the user experience.",
      "Cookies may store login sessions, preferences, and analytics data.",
      "You can disable cookies through your browser settings, though some features may stop working."
    ]
  },

  aup: {
    title: "Acceptable Use Policy",
    updated: "2026-03-14",
    body: [
      "Users must not generate illegal, harmful, or abusive content.",
      "The platform cannot be used for harassment, impersonation, or fraud.",
      "Attempting to bypass system limits, abuse credits, or exploit vulnerabilities may result in immediate account termination."
    ]
  },

  refunds: {
    title: "Refund & Cancellation Policy",
    updated: "2026-04-29",
    body: [
      "Refunds are only available if purchased credits have not been used.",
      "Once credits are consumed, refunds cannot be issued because AI generation incurs real infrastructure costs.",
      "Subscription plans may be cancelled at any time before the next billing cycle.",
      "Renewal refunds: If your subscription renews automatically, you may request a refund within 48–72 hours of the renewal charge, provided that none of the credits added by that renewal have been used. If any renewal credits have been spent, the renewal charge is no longer eligible for a refund.",
      "To request a renewal refund, contact support at support@tryzyvo.com with your account email and the date of the renewal charge. We will verify your credit usage and process eligible refunds within 3–5 business days.",
      "If you believe a billing error occurred outside of these cases, please contact support."
    ]
  },

  dmca: {
    title: "Copyright / DMCA Policy",
    updated: "2026-03-14",
    body: [
      "Zyvo respects intellectual property rights.",
      "If you believe content generated or hosted on the platform violates copyright, you may submit a DMCA request.",
      "Requests should include proof of ownership and details of the alleged infringement."
    ]
  },

  dpa: {
    title: "Data Processing Addendum (DPA)",
    updated: "2026-03-14",
    body: [
      "This Data Processing Addendum governs how Zyvo processes user data.",
      "Zyvo acts as a data processor for user-generated content and related data.",
      "We implement security practices designed to protect personal data from unauthorized access.",
      "Users remain responsible for ensuring they have the rights to any data uploaded or generated through the platform."
    ]
  }

};

export default function SupportPolicyArticle() {
  const { slug } = useParams();
  const policy = POLICIES[slug];

  if (!policy) {
    return (
      <div className={card + " p-5"}>
        <div className="text-lg font-extrabold mb-2">Policy not found</div>
        <Link className="underline text-white/80" to="/support/policies">
          Back to Policies
        </Link>
      </div>
    );
  }

  return (
    <article className="grid gap-4">
      <div className={card + " p-5"}>
        <h1 className="text-xl font-extrabold mb-1">{policy.title}</h1>
        <div className="text-xs text-white/50 mb-4">
          Last updated {policy.updated}
        </div>

        <div className="space-y-3 text-white/80">
          {policy.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </article>
  );
}