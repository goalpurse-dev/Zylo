import { CheckCircle2, Link2, RefreshCw, Send, ShieldCheck, Users } from "lucide-react";
import CreatorSuiteLanding from "./CreatorSuiteLanding";
import heroImage from "../../assets/blog/publish/multi-platform-distribution-wide.png";
import publishHub from "../../assets/blog/publish/publish-hub-square.png";
import uploadOnce from "../../assets/blog/publish/upload-once-square.png";
import analyticsSquare from "../../assets/blog/publish/analytics-growth-square.png";

const CONFIG = {
  slug: "connections",
  productName: "Zyvo Connections",
  seoTitle: "Connect Instagram, TikTok & YouTube to One Creator Workspace | Zyvo",
  metaDescription: "Connect Instagram, TikTok, and YouTube accounts to Zyvo, manage multiple channels, publish videos from one workspace, and disconnect whenever you choose.",
  keywords: "connect social media accounts, social media account manager, connect Instagram TikTok YouTube, multi-platform publishing accounts, social media connections dashboard, creator account management",
  canonical: "https://www.tryzyvo.com/connections",
  socialImage: "https://www.tryzyvo.com/og-image.png",
  badge: "Zyvo Connections · One creator workspace",
  title: "Connect once.",
  gradientTitle: "Create across every channel.",
  description: "Bring Instagram, TikTok, and YouTube into one creator workspace. Manage multiple connected accounts, choose exactly where every video goes, and disconnect an account whenever you need to.",
  primaryPath: "/workspace/connections",
  primaryCta: "Connect your accounts",
  shortCta: "Open Connections",
  secondaryPath: "/publish",
  secondaryCta: "Explore Zyvo Publish",
  trust: ["Instagram, TikTok, and YouTube", "Multiple accounts supported", "Disconnect anytime"],
  heroImage,
  heroAlt: "One short-form video distributed to connected Instagram, TikTok, and YouTube accounts",
  proof: [
    { value: "3", label: "Platforms" },
    { value: "1", label: "Account hub" },
    { value: "Multi", label: "Account support" },
    { value: "Anytime", label: "Disconnect" },
  ],
  featuresEyebrow: "Your social accounts, organized",
  featuresTitle: "The connection layer behind a simpler workflow.",
  featuresDescription: "Connections keeps the channels used by Publish and Stats together, so you know which accounts are ready before you prepare the next post.",
  features: [
    { icon: Link2, eyebrow: "Instagram", title: "Connect professional Instagram", description: "Connect an Instagram Creator or Business account for direct publishing through Zyvo’s supported Instagram workflow." },
    { icon: Send, eyebrow: "TikTok", title: "Prepare TikTok publishing", description: "Connect TikTok, then keep control over captions, visibility, and available posting options when you send a video." },
    { icon: CheckCircle2, eyebrow: "YouTube", title: "Publish and analyze YouTube", description: "Connect a YouTube channel for supported uploads and access to the live YouTube analytics experience in Zyvo Stats." },
    { icon: Users, eyebrow: "Scale", title: "Manage multiple accounts", description: "Add more than one account for a platform and select the intended destination inside your publishing workflow." },
    { icon: RefreshCw, eyebrow: "Maintain", title: "Reconnect when required", description: "OAuth permissions can expire or change. Zyvo surfaces reconnection states so you can restore access without rebuilding your workflow." },
    { icon: ShieldCheck, eyebrow: "Control", title: "Disconnect on your terms", description: "Remove an account from Connections whenever you choose. Publishing only starts after you explicitly prepare and submit a post." },
  ],
  visuals: [
    { src: publishHub, alt: "Central hub connecting three social media publishing channels" },
    { src: uploadOnce, alt: "One vertical video prepared for several connected accounts" },
    { src: analyticsSquare, alt: "Connected YouTube account feeding performance data into creator analytics" },
  ],
  workflowTitle: "Three steps from disconnected to ready.",
  workflowDescription: "Each platform uses its own authorization flow, but the finished connections live together in one straightforward account hub.",
  workflow: [
    { title: "Choose Instagram, TikTok, or YouTube", description: "Open Connections and select the platform you want to add. Zyvo explains any platform-specific requirement before redirecting." },
    { title: "Review and approve the platform request", description: "Complete the platform’s authorization flow and return to Zyvo. Instagram direct publishing requires a Creator or Business account." },
    { title: "Use the account in Publish or Stats", description: "Choose connected accounts when preparing a post. Connected YouTube channels can also feed the live analytics dashboard in Stats." },
  ],
  guidesTitle: "Move from connection to consistent growth.",
  guides: [
    { to: "/publish", eyebrow: "Product guide", title: "Publish to three channels from one workspace", description: "See how connected accounts become a multi-platform video publishing workflow." },
    { to: "/stats", eyebrow: "Analytics product", title: "Track connected YouTube performance", description: "Follow views, watch time, subscribers, and video performance after your channel is connected." },
    { to: "/blog/how-to-cross-post-instagram-tiktok-youtube", eyebrow: "Cross-posting guide", title: "Cross-post to Instagram, TikTok, and YouTube", description: "Build a practical workflow for preparing one video for three connected destinations." },
  ],
  faqEyebrow: "Social account connections FAQ",
  faqTitle: "What happens when you connect an account?",
  faqs: [
    { question: "Which platforms can I connect to Zyvo?", answer: "Zyvo Connections supports Instagram, TikTok, and YouTube accounts for the product’s current publishing workflows." },
    { question: "What type of Instagram account is required?", answer: "Instagram direct publishing requires an Instagram Creator or Business account. Switching to a professional account is handled in Instagram and is separate from Zyvo." },
    { question: "Can I connect more than one account?", answer: "Yes. The Connections interface supports adding another account for a platform, allowing creators or teams to maintain multiple publishing destinations." },
    { question: "What does the YouTube connection enable?", answer: "A connected YouTube channel can be used for supported video publishing. It also powers the live YouTube analytics experience in Zyvo Stats when the required analytics permission is available." },
    { question: "Can I disconnect a social account later?", answer: "Yes. Connected accounts can be removed from the Connections workspace, and they can be reconnected later if you want to use them again." },
  ],
  finalTitle: "Your creator workflow starts with the right connections.",
  finalDescription: "Connect the channels you use, keep them organized, and move into publishing or analytics without rebuilding the setup every time.",
};

export default function ConnectionsLanding() {
  return <CreatorSuiteLanding config={CONFIG} />;
}
