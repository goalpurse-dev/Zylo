import { BarChart3, Clock3, Eye, History, Play, Users } from "lucide-react";
import CreatorSuiteLanding from "./CreatorSuiteLanding";
import heroImage from "../../assets/blog/publish/analytics-landing-hero-wide.png";
import analyticsSquare from "../../assets/blog/publish/analytics-growth-square.png";
import calendarSquare from "../../assets/blog/publish/calendar-28-days-square.png";
import smartSquare from "../../assets/blog/publish/smart-captioning-square.png";

const CONFIG = {
  slug: "stats",
  productName: "Zyvo Stats",
  seoTitle: "YouTube Analytics for Creators: Views, Watch Time & Growth | Zyvo Stats",
  metaDescription: "Track YouTube views, watch time, subscriber growth, average view duration, realtime activity, and top videos from one creator analytics dashboard.",
  keywords: "YouTube analytics for creators, YouTube analytics dashboard, track YouTube views, YouTube watch time analytics, subscriber growth tracker, video performance analytics, creator analytics tool",
  canonical: "https://www.tryzyvo.com/stats",
  socialImage: "https://www.tryzyvo.com/og-image.png",
  badge: "Zyvo Stats · Creator analytics",
  title: "Know what worked.",
  gradientTitle: "Create what works next.",
  description: "A focused YouTube analytics dashboard for creators. Track views, watch time, subscriber growth, average view duration, realtime activity, and individual video performance without losing the creative thread.",
  primaryPath: "/workspace/stats",
  primaryCta: "Open Zyvo Stats",
  shortCta: "Open Stats",
  secondaryPath: "/blog/youtube-analytics-for-creators",
  secondaryCta: "Read the analytics guide",
  trust: ["Free to start", "Connect through YouTube", "Refresh from one dashboard"],
  heroImage,
  heroAlt: "Zyvo Stats YouTube analytics dashboard with a rising views graph and video performance cards",
  proof: [
    { value: "7–365d", label: "Date ranges" },
    { value: "4", label: "Core metrics" },
    { value: "48h", label: "Realtime view" },
    { value: "1", label: "Creator dashboard" },
  ],
  featuresEyebrow: "YouTube performance, clearly explained",
  featuresTitle: "The numbers you need before you make the next video.",
  featuresDescription: "Zyvo Stats turns channel-level and video-level YouTube analytics into a readable workflow built around creative decisions.",
  features: [
    { icon: Eye, eyebrow: "Reach", title: "Views and daily trends", description: "See total views for your selected period and follow the daily trend to understand when momentum starts, slows, or returns." },
    { icon: Clock3, eyebrow: "Attention", title: "Watch time and duration", description: "Track watch time and average view duration so high view counts do not hide weak audience retention." },
    { icon: Users, eyebrow: "Audience", title: "Subscriber growth", description: "Measure net subscriber movement alongside views to identify the videos that attract returning viewers—not only clicks." },
    { icon: Play, eyebrow: "Content", title: "Top and recent videos", description: "Compare top-performing uploads with your most recent videos, then open individual video details for a closer look." },
    { icon: BarChart3, eyebrow: "Context", title: "Flexible date ranges", description: "Switch between 7, 28, 90, and 365-day windows to separate short spikes from durable channel growth." },
    { icon: History, eyebrow: "Fresh data", title: "Refresh when you need it", description: "Sync the dashboard from your connected YouTube channel and keep the latest successful data available while you work." },
  ],
  visuals: [
    { src: analyticsSquare, alt: "Creator analytics growth chart with a short-form video preview" },
    { src: calendarSquare, alt: "Content planning calendar used alongside performance analytics" },
    { src: smartSquare, alt: "AI-assisted creative decision panel informed by content performance" },
  ],
  workflowTitle: "From channel connection to a better next upload.",
  workflowDescription: "Use analytics as a feedback loop instead of a report you check after the creative work is already done.",
  workflow: [
    { title: "Connect your YouTube channel", description: "Open Connections, choose YouTube, review the requested permissions, and select the channel you want to analyze." },
    { title: "Choose a meaningful time range", description: "Start with 28 days for a balanced view, then compare shorter or longer windows when a trend needs more context." },
    { title: "Study the videos behind the totals", description: "Move from channel views and watch time into top, recent, and individual video performance before planning the next idea." },
  ],
  guidesTitle: "Build a smarter creator analytics habit.",
  guides: [
    { to: "/blog/youtube-analytics-for-creators", eyebrow: "Complete guide", title: "YouTube analytics for creators", description: "Learn which channel metrics matter and how to turn them into practical content decisions." },
    { to: "/blog/short-form-video-metrics-that-matter", eyebrow: "Metrics guide", title: "Short-form video metrics that matter", description: "Separate useful signals such as watch time and subscriber growth from distracting vanity metrics." },
    { to: "/blog/schedule-auto-publish-ai-videos", eyebrow: "Publishing workflow", title: "Schedule and auto-publish AI videos", description: "Turn what you learn from analytics into a reliable 28-day publishing queue." },
  ],
  faqEyebrow: "YouTube analytics FAQ",
  faqTitle: "Questions before you open Stats?",
  faqs: [
    { question: "What does Zyvo Stats track?", answer: "Zyvo Stats currently tracks connected YouTube channel data including views, watch time, subscriber growth, average view duration, daily trends, realtime activity estimates, and top or recent videos." },
    { question: "Which date ranges are available?", answer: "You can review YouTube performance across 7, 28, 90, or 365-day windows. Comparing ranges helps separate a short-lived spike from a trend that is still compounding." },
    { question: "Does Zyvo Stats support Instagram and TikTok analytics?", answer: "Full analytics in the current Stats workspace is available for YouTube. Instagram and TikTok appear in the product roadmap, but their analytics dashboards are not presented as live features yet." },
    { question: "Do I need to connect a YouTube channel?", answer: "Yes. Zyvo needs a connected YouTube channel to retrieve the analytics associated with that channel. You can manage or disconnect the account from the Connections workspace." },
    { question: "Can I inspect individual video performance?", answer: "Yes. The dashboard includes top and recent video lists, and individual video detail views can show metrics such as views, likes, watch time, and retention-related information when available." },
  ],
  finalTitle: "Your next idea should start with evidence.",
  finalDescription: "Connect YouTube, read the patterns behind your strongest videos, and bring those lessons back into your next script and publishing plan.",
};

export default function StatsLanding() {
  return <CreatorSuiteLanding config={CONFIG} />;
}
