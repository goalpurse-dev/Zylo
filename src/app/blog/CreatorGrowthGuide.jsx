import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar, CheckCircle2, Clock3 } from "lucide-react";
import Footer from "../../components/workspace/footer.jsx";
import publishHero from "../../assets/blog/publish/publish-landing-hero-wide.png";
import analyticsHero from "../../assets/blog/publish/analytics-landing-hero-wide.png";
import distributionHero from "../../assets/blog/publish/multi-platform-distribution-wide.png";
import pipelineHero from "../../assets/blog/publish/content-pipeline-wide.png";
import comparisonHero from "../../assets/blog/publish/manual-vs-automated-wide.png";
import calendarPhoneVertical from "../../assets/blog/publish/publish-calendar-phone-vertical.png";
import crossPostVertical from "../../assets/blog/publish/one-video-three-platforms-vertical.png";
import sleepVertical from "../../assets/blog/publish/publish-while-sleeping-vertical.png";
import growthVertical from "../../assets/blog/publish/content-growth-loop-vertical.png";
import commandVertical from "../../assets/blog/publish/creator-command-center-vertical.png";
import batchVertical from "../../assets/blog/publish/batch-content-workflow-vertical.png";

const SITE_URL = "https://www.tryzyvo.com";

const GUIDES = {
  "social-media-scheduler-for-creators": {
    title: "Social Media Scheduler for Creators: The Complete 2026 Guide",
    seoTitle: "Social Media Scheduler for Creators: Complete 2026 Guide | Zyvo",
    description: "Learn how creators use a social media scheduler to plan short-form videos, maintain consistency, and publish to Instagram, TikTok, and YouTube.",
    keywords: "social media scheduler for creators, creator scheduling tool, schedule social media posts, short form video scheduler, content scheduling workflow",
    category: "Social Media Publishing",
    date: "July 20, 2026",
    readTime: "10 min read",
    hero: pipelineHero,
    heroAlt: "Creator workflow from video idea through scheduling, publishing, and analytics",
    secondary: batchVertical,
    secondaryAlt: "Batch content workflow moving from ideas to scheduled posts",
    intro: [
      "A social media scheduler is no longer just a calendar for marketing teams. For video creators, it is the operating system between a finished clip and a consistent presence across every channel.",
      "The best scheduling workflow removes repetitive uploads without removing creative control. You still choose the video, caption, accounts, and time. The scheduler handles the predictable work that happens after those decisions are made.",
    ],
    sections: [
      {
        title: "What a creator-focused social media scheduler should do",
        paragraphs: [
          "A creator scheduler should make vertical video easy to prepare, not force a short-form workflow into a tool designed around corporate link posts. Look for direct video selection, platform-specific fields, clear account choices, status tracking, and a calendar that reveals empty posting days.",
          "Zyvo Publish is built around that workflow: choose a finished video, select Instagram, TikTok, YouTube, or all three, then publish immediately or plan supported posts up to 28 days ahead.",
        ],
        bullets: ["One video selection instead of repeated uploads", "A visible queue for upcoming posts", "Platform-specific captions, titles, and controls", "Status history after publishing begins"],
      },
      {
        title: "Why scheduling improves consistency",
        paragraphs: [
          "Consistency usually breaks because publishing competes with creation. A creator finishes a batch, plans to upload later, and then loses the time or energy required to repeat the process across several apps.",
          "Scheduling separates creative time from distribution time. You can prepare several finished videos in one focused session and let the queue preserve the cadence during the rest of the week.",
        ],
      },
      {
        title: "Build a weekly workflow before planning 28 days",
        paragraphs: [
          "Start with one realistic week. Choose the number of videos you can actually finish, assign each to a day, and keep at least one open slot for reactive content. Once that rhythm works, extend it into a 28-day content calendar.",
          "A longer calendar is useful because gaps become visible early. It should not become a promise to publish low-quality content. Treat the schedule as a capacity plan, not a quota.",
        ],
        bullets: ["Batch videos before opening the scheduler", "Mix proven formats with experiments", "Leave room for timely ideas", "Review results before filling the next cycle"],
      },
      {
        title: "Connect scheduling to performance",
        paragraphs: [
          "A publishing calendar becomes more valuable when it responds to analytics. Compare views with watch time, average view duration, and subscriber movement, then use those patterns when selecting the next batch.",
          "This creates a useful loop: create, schedule, publish, measure, and repeat. The scheduler protects consistency while analytics improves what consistency is delivering.",
        ],
      },
    ],
    faqs: [
      ["How far ahead can I schedule with Zyvo?", "Zyvo supports planning eligible posts up to 28 days ahead."],
      ["Can I schedule the same video for several platforms?", "You can prepare one video for Instagram, TikTok, and YouTube from the same publishing workflow."],
      ["Should every creator use a daily posting schedule?", "No. The best schedule is the one you can sustain without lowering content quality."],
    ],
    links: [
      ["/publish", "Explore Zyvo Publish", "See the complete multi-platform scheduling workflow."],
      ["/blog/28-day-social-media-content-calendar", "Build a 28-day content calendar", "Turn a realistic weekly cadence into a full monthly plan."],
      ["/stats", "Use analytics to plan the next batch", "Track YouTube views, watch time, subscribers, and top videos."],
    ],
    cta: "Start scheduling your videos",
  },
  "how-to-cross-post-instagram-tiktok-youtube": {
    title: "How to Cross-Post to Instagram, TikTok, and YouTube in 2026",
    seoTitle: "How to Cross-Post Instagram, TikTok & YouTube Videos | Zyvo",
    description: "A practical guide to cross-posting short-form video to Instagram Reels, TikTok, and YouTube Shorts without repeating the entire upload workflow.",
    keywords: "how to cross post Instagram TikTok YouTube, post to multiple social media platforms, cross post video, Instagram Reels TikTok YouTube Shorts",
    category: "Cross-Posting",
    date: "July 20, 2026",
    readTime: "9 min read",
    hero: distributionHero,
    heroAlt: "One vertical video distributed to Instagram, TikTok, and YouTube",
    secondary: crossPostVertical,
    secondaryAlt: "One short-form video connected to three social media feeds",
    intro: [
      "Cross-posting means distributing one core piece of content to more than one social platform. For short-form creators, the usual destinations are Instagram Reels, TikTok, and YouTube Shorts.",
      "The goal is not to make every post identical. It is to avoid repeating the mechanical upload work while keeping enough platform-level control to prepare each destination properly.",
    ],
    sections: [
      {
        title: "Prepare one clean master video",
        paragraphs: [
          "Start with a high-quality vertical master file that does not contain another platform’s watermark or interface. Keep essential action and captions away from the extreme edges, where platform controls can cover them.",
          "A clean source gives you one reliable asset for every destination and makes future edits easier. Store the finished master in your creations library before preparing the posts.",
        ],
      },
      {
        title: "Connect the right destination accounts",
        paragraphs: [
          "Use Zyvo Connections to add Instagram, TikTok, and YouTube. Instagram direct publishing requires a Creator or Business account. YouTube and TikTok use their own authorization flows and available account controls.",
          "After connecting, confirm the intended account before every publication—especially if you manage several brands or channels.",
        ],
        bullets: ["Check the Instagram account type", "Confirm the selected YouTube channel", "Review TikTok visibility options", "Disconnect unused accounts to keep the workspace clear"],
      },
      {
        title: "Adapt the packaging, not the core idea",
        paragraphs: [
          "The hook and video can remain consistent while the surrounding metadata changes. YouTube needs a clear title, while captions and hashtags may be handled differently across Instagram and TikTok.",
          "Zyvo keeps those platform details in one composer so you can review them together rather than opening three separate upload flows.",
        ],
      },
      {
        title: "Publish together or schedule deliberately",
        paragraphs: [
          "If the campaign depends on a shared launch moment, select all three channels and publish from one workflow. If your audience behavior differs by platform, prepare the same asset for different supported schedule slots.",
          "After publishing, use status history and live links to confirm what happened. Cross-posting should reduce admin work, not reduce visibility into the result.",
        ],
      },
    ],
    faqs: [
      ["Can I post to Instagram, TikTok, and YouTube at the same time?", "Yes. Zyvo Publish lets you select all three connected platforms in one publishing workflow."],
      ["Should I use the exact same caption everywhere?", "Not always. Keep the core message consistent, but adapt titles, descriptions, hashtags, and controls to each platform."],
      ["Does cross-posting hurt reach?", "Cross-posting itself is a distribution method. Content quality, packaging, audience fit, and platform requirements still determine performance."],
    ],
    links: [
      ["/connections", "Connect all three platforms", "Prepare Instagram, TikTok, and YouTube as publishing destinations."],
      ["/publish", "Open the multi-platform publisher", "Choose one video and prepare every destination together."],
      ["/blog/social-media-automation-for-creators", "Automate the repeatable work", "Build a controlled publishing system without losing oversight."],
    ],
    cta: "Cross-post your next video",
  },
  "28-day-social-media-content-calendar": {
    title: "How to Build a 28-Day Social Media Content Calendar",
    seoTitle: "28-Day Social Media Content Calendar for Video Creators | Zyvo",
    description: "Build a realistic 28-day social media content calendar for TikTok, Instagram Reels, and YouTube Shorts using repeatable formats and scheduled posts.",
    keywords: "28 day social media content calendar, monthly content calendar, social media posting calendar, video content planner, TikTok Reels Shorts calendar",
    category: "Content Planning",
    date: "July 20, 2026",
    readTime: "11 min read",
    hero: publishHero,
    heroAlt: "Smartphone displaying a 28-day short-form video content calendar",
    secondary: calendarPhoneVertical,
    secondaryAlt: "Smartphone showing a creator-focused social media content calendar",
    intro: [
      "A 28-day social media content calendar gives creators enough distance to batch work and spot gaps without pretending the next month will be perfectly predictable.",
      "The strongest calendar is built from repeatable content pillars, a realistic production capacity, and deliberate room for experiments. It should reduce daily decisions—not create 28 new obligations.",
    ],
    sections: [
      {
        title: "Choose three to five repeatable content pillars",
        paragraphs: [
          "Content pillars are recurring categories your audience can recognize. A creator might combine tutorials, reactions, behind-the-scenes clips, experiments, and proof or results.",
          "Each pillar should support several distinct ideas. If a category only produces one video, it is an idea—not a pillar.",
        ],
        bullets: ["One proven educational format", "One entertaining or curiosity-driven format", "One audience or community format", "One controlled experiment"],
      },
      {
        title: "Set a sustainable publishing cadence",
        paragraphs: [
          "Work backward from your actual production speed. If you can finish four strong videos each week, build a 16-post calendar instead of forcing 28 weak uploads.",
          "Use the remaining days as production buffers, analytics checkpoints, or openings for reactive content. Consistency includes protecting quality.",
        ],
      },
      {
        title: "Batch by task, not only by posting day",
        paragraphs: [
          "Write several hooks together, record or generate several videos together, then schedule them in another focused session. Task batching reduces the context switching that makes content production feel heavier than it is.",
          "Inside Zyvo Publish, place finished videos into the next available dates and keep future idea slots separate from confirmed posts.",
        ],
      },
      {
        title: "Review the calendar every seven days",
        paragraphs: [
          "A monthly calendar should change when the evidence changes. Review top videos, watch time, audience growth, and the formats that underperformed before filling the next week.",
          "Keep successful structures, replace weak topics, and avoid changing every variable at once. A useful calendar is a living experiment with a reliable publishing backbone.",
        ],
      },
    ],
    faqs: [
      ["Do I need 28 videos for a 28-day calendar?", "No. A 28-day planning window can include posting days, production days, review points, and open slots."],
      ["How often should I update the calendar?", "Review it weekly and make small changes based on production capacity and performance data."],
      ["Can Zyvo schedule a full month?", "Zyvo supports planning eligible posts up to 28 days ahead."],
    ],
    links: [
      ["/publish", "Open the 28-day publishing calendar", "Place finished videos into a clear multi-platform queue."],
      ["/blog/social-media-scheduler-for-creators", "Choose a creator scheduler", "Learn which scheduling features matter for short-form video."],
      ["/blog/short-form-video-metrics-that-matter", "Review the right metrics", "Use performance signals to improve the next seven days."],
    ],
    cta: "Build your 28-day calendar",
  },
  "social-media-automation-for-creators": {
    title: "Social Media Automation for Creators Without Losing Control",
    seoTitle: "Social Media Automation for Creators: Practical 2026 Guide | Zyvo",
    description: "Learn what creators should automate, what should remain manual, and how scheduling and multi-platform publishing can save time without risking quality.",
    keywords: "social media automation for creators, automate social media posting, creator automation workflow, automatic video posting, social media publishing automation",
    category: "Creator Automation",
    date: "July 20, 2026",
    readTime: "9 min read",
    hero: comparisonHero,
    heroAlt: "Manual social media posting compared with an automated publishing queue",
    secondary: sleepVertical,
    secondaryAlt: "Scheduled videos publishing automatically from a nighttime creator workspace",
    intro: [
      "Useful social media automation removes repeated administration. Bad automation removes judgment. Creators need the first kind: a system that handles timing, status, and repeated distribution after the creative decisions are complete.",
      "You should still control the idea, final video, destination accounts, caption, platform settings, and schedule. Automation begins after those choices—not before them.",
    ],
    sections: [
      {
        title: "Automate repetition, not taste",
        paragraphs: [
          "Uploading the same finished file three times is repetitive. Choosing whether the video fits a channel is judgment. Copying metadata between tabs is repetitive. Writing the hook is judgment.",
          "This boundary keeps automation safe and useful. It shortens the path to publication without turning the account into an unattended content machine.",
        ],
        bullets: ["Automate timing and queue execution", "Automate repeated file distribution", "Keep final review and platform selection manual", "Keep creative direction and audience judgment manual"],
      },
      {
        title: "Create a visible approval point",
        paragraphs: [
          "Every automated workflow should have one clear moment where the post is reviewed before it enters the queue. Confirm the video, caption, selected accounts, privacy settings, and intended date.",
          "Zyvo keeps empty schedule slots empty until you deliberately assign content. That prevents a calendar template from becoming an accidental publication.",
        ],
      },
      {
        title: "Use status tracking as part of automation",
        paragraphs: [
          "Automation is incomplete when it only starts a job. Creators also need to see whether the post is queued, preparing, processing, publishing, or published.",
          "A publication history with dates and live links makes the workflow auditable. If a connection needs attention, you can respond without searching every social app.",
        ],
      },
      {
        title: "Measure the time automation gives back",
        paragraphs: [
          "The main return is not a dramatic one-click moment. It is the removal of dozens of small interruptions across a month. Use that recovered time for stronger hooks, better edits, audience replies, and performance review.",
          "When the system is working, publishing becomes predictable while the creative work remains flexible.",
        ],
      },
    ],
    faqs: [
      ["What should creators automate first?", "Start with scheduling, repeated uploads, publication status, and routine distribution across connected accounts."],
      ["Can automation publish something by accident?", "A well-designed workflow requires explicit content selection and review. In Zyvo, empty queue slots do not publish on their own."],
      ["Is social media automation only for teams?", "No. Solo creators often gain the most because every repeated upload competes directly with their creation time."],
    ],
    links: [
      ["/publish", "Use controlled publishing automation", "Review each post, then publish now or plan it ahead."],
      ["/connections", "Manage destination accounts", "Keep Instagram, TikTok, and YouTube connections organized."],
      ["/blog/one-click-publishing-playbook", "Read the consistency playbook", "See why a repeatable system matters more than one lucky spike."],
    ],
    cta: "Automate your publishing workflow",
  },
  "youtube-analytics-for-creators": {
    title: "YouTube Analytics for Creators: A Practical 2026 Guide",
    seoTitle: "YouTube Analytics for Creators: Metrics & Workflow Guide | Zyvo",
    description: "Understand YouTube views, watch time, average view duration, subscribers, daily trends, and top videos—and use them to choose what to create next.",
    keywords: "YouTube analytics for creators, understand YouTube analytics, YouTube views watch time subscribers, YouTube analytics dashboard, video performance metrics",
    category: "Creator Analytics",
    date: "July 20, 2026",
    readTime: "12 min read",
    hero: analyticsHero,
    heroAlt: "YouTube creator analytics dashboard with views and audience growth",
    secondary: growthVertical,
    secondaryAlt: "Short-form video performance feeding a creator growth loop",
    intro: [
      "YouTube analytics is most useful when it changes a creative decision. A dashboard full of numbers does not improve a channel unless it helps you choose a stronger topic, hook, structure, or publishing plan.",
      "Start with four connected questions: did people find the video, did they keep watching, did it create meaningful watch time, and did it move viewers toward becoming subscribers?",
    ],
    sections: [
      {
        title: "Views show reach, not complete success",
        paragraphs: [
          "Views tell you how often a video was watched according to YouTube’s reporting, but they do not explain the quality of that attention. Compare views across similar time windows and content formats.",
          "A spike deserves investigation, not immediate imitation. Open the video-level metrics and look for the retention or watch-time behavior behind the reach.",
        ],
      },
      {
        title: "Watch time and average view duration reveal attention",
        paragraphs: [
          "Watch time represents the total amount of audience attention accumulated by the content. Average view duration helps explain how much of that attention the typical view contributed.",
          "Use both. A high-reach video with weak duration may have a strong package and weak delivery. A smaller video with strong duration may contain a format worth repackaging.",
        ],
        bullets: ["Compare similar video lengths", "Look for repeated drop-off patterns", "Study the first seconds separately", "Do not judge retention from views alone"],
      },
      {
        title: "Subscriber growth measures audience conversion",
        paragraphs: [
          "Subscriber movement helps reveal whether a video attracted people who want more from the channel. Compare net subscriber growth with the videos published during the same period.",
          "The strongest subscriber-driving video is not always the most-viewed video. It may communicate the channel promise more clearly or reach a better-matched audience.",
        ],
      },
      {
        title: "Use date ranges to separate spikes from trends",
        paragraphs: [
          "A 7-day view helps with immediate movement. Twenty-eight days provides a useful monthly operating window. Ninety and 365-day ranges reveal whether a format is building durable channel value.",
          "Zyvo Stats brings these ranges into one creator-focused dashboard, alongside daily trends, top videos, recent uploads, and individual video details.",
        ],
      },
    ],
    faqs: [
      ["Which YouTube metric should I check first?", "Start with the question you are trying to answer. Use views for reach, watch time and duration for attention, and subscribers for audience conversion."],
      ["What date range is best for YouTube analytics?", "Twenty-eight days is a useful starting point, but compare 7, 90, and 365-day ranges when you need short-term or long-term context."],
      ["Does Zyvo Stats track YouTube analytics?", "Yes. Connected YouTube channels can show views, watch time, subscriber growth, average view duration, trends, and video-level performance."],
    ],
    links: [
      ["/stats", "Open Zyvo Stats", "Review connected YouTube performance in one focused dashboard."],
      ["/connections", "Connect your YouTube channel", "Authorize the channel used by publishing and analytics."],
      ["/blog/short-form-video-metrics-that-matter", "Learn which metrics matter", "Turn raw numbers into a repeatable review framework."],
    ],
    cta: "Review your YouTube analytics",
  },
  "short-form-video-metrics-that-matter": {
    title: "Short-Form Video Metrics That Actually Matter in 2026",
    seoTitle: "Short-Form Video Metrics That Matter for Creator Growth | Zyvo",
    description: "Learn how to evaluate short-form videos using views, watch time, average view duration, retention, engagement, and subscriber growth.",
    keywords: "short form video metrics, video metrics that matter, views watch time retention, creator analytics metrics, YouTube Shorts analytics",
    category: "Video Performance",
    date: "July 20, 2026",
    readTime: "10 min read",
    hero: analyticsHero,
    heroAlt: "Short-form video analytics dashboard with a rising performance graph",
    secondary: commandVertical,
    secondaryAlt: "Creator command center for reviewing short-form video performance",
    intro: [
      "Short-form video produces fast feedback, but fast feedback is easy to misread. Views are visible and emotionally powerful, so creators often treat them as the complete verdict.",
      "A useful review combines reach, attention, engagement, and audience conversion. No single metric explains the entire performance story.",
    ],
    sections: [
      {
        title: "Reach metrics: did the platform distribute it?",
        paragraphs: [
          "Views and impressions describe distribution. They help identify packaging that earned an initial opportunity, but they cannot tell you whether viewers stayed or cared.",
          "Compare reach between videos with similar topics, lengths, and publishing conditions. Avoid treating one unusually large spike as a new baseline.",
        ],
      },
      {
        title: "Attention metrics: did viewers stay?",
        paragraphs: [
          "Watch time, average view duration, and retention-related signals show whether the video delivered after the opening frame. These metrics are especially useful when comparing different hooks or pacing choices.",
          "Study the relationship between video length and average duration. Longer raw watch time is not automatically stronger if the video is also much longer.",
        ],
        bullets: ["Review the opening seconds", "Compare like with like", "Look for repeatable pacing patterns", "Use retention to diagnose—not merely grade"],
      },
      {
        title: "Engagement metrics: did the video create a response?",
        paragraphs: [
          "Likes, comments, and shares represent different audience behaviors. Comments may reveal confusion or strong interest. Shares can indicate usefulness, identity, emotion, or surprise.",
          "Read the context instead of adding every interaction into one vague score. A tutorial and an entertainment clip may succeed through different engagement patterns.",
        ],
      },
      {
        title: "Conversion metrics: did viewers want more?",
        paragraphs: [
          "Subscriber or follower growth is a strong signal that the video communicated a reason to return. Compare audience growth with the content published in the same period.",
          "Use the complete picture to plan the next test. Keep the elements supported by several signals, change one weak element, and publish enough iterations to learn something reliable.",
        ],
      },
    ],
    faqs: [
      ["Are views a vanity metric?", "Views are useful for measuring reach, but they become misleading when evaluated without attention, engagement, and conversion metrics."],
      ["Is watch time more important than likes?", "They answer different questions. Watch time measures attention, while likes measure one form of audience response."],
      ["How often should creators review analytics?", "A weekly review is frequent enough to guide the next content batch without reacting emotionally to every early fluctuation."],
    ],
    links: [
      ["/stats", "Track YouTube creator metrics", "See views, watch time, subscribers, duration, trends, and video details."],
      ["/blog/youtube-analytics-for-creators", "Read the YouTube analytics guide", "Understand how the core channel metrics work together."],
      ["/blog/28-day-social-media-content-calendar", "Apply insights to the next 28 days", "Turn performance patterns into a practical content calendar."],
    ],
    cta: "Turn metrics into your next idea",
  },
};

function upsertMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

export default function CreatorGrowthGuide({ slug }) {
  const guide = GUIDES[slug];

  useEffect(() => {
    if (!guide) return undefined;
    const previousTitle = document.title;
    const canonicalUrl = `${SITE_URL}/blog/${slug}`;
    document.title = guide.seoTitle;
    upsertMeta("name", "description", guide.description);
    upsertMeta("name", "keywords", guide.keywords);
    upsertMeta("name", "robots", "index, follow, max-image-preview:large");
    upsertMeta("property", "og:title", guide.seoTitle);
    upsertMeta("property", "og:description", guide.description);
    upsertMeta("property", "og:type", "article");
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("name", "twitter:card", "summary_large_image");

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    const schema = document.createElement("script");
    schema.id = `${slug}-article-schema`;
    schema.type = "application/ld+json";
    schema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Article",
          headline: guide.title,
          description: guide.description,
          datePublished: "2026-07-20",
          dateModified: "2026-07-20",
          mainEntityOfPage: canonicalUrl,
          author: { "@type": "Organization", name: "Zyvo" },
          publisher: { "@type": "Organization", name: "Zyvo", url: SITE_URL },
        },
        {
          "@type": "FAQPage",
          mainEntity: guide.faqs.map(([question, answer]) => ({
            "@type": "Question",
            name: question,
            acceptedAnswer: { "@type": "Answer", text: answer },
          })),
        },
      ],
    });
    document.head.appendChild(schema);

    return () => {
      document.title = previousTitle;
      schema.remove();
    };
  }, [guide, slug]);

  if (!guide) return null;
  const primaryToolPath = slug === "youtube-analytics-for-creators" || slug === "short-form-video-metrics-that-matter"
    ? "/workspace/stats"
    : "/workspace/publish";

  return (
    <div className="min-h-screen bg-[#F7F5FA] text-[#110829]">
      <main className="mx-auto max-w-6xl px-5 pb-24 pt-6 sm:px-6 sm:pt-10">
        <nav className="mb-6 text-[13px] text-[#777]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <span>{guide.category}</span>
        </nav>

        <header className="max-w-4xl">
          <span className="inline-flex rounded-full bg-purple-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-purple-700">{guide.category}</span>
          <h1 className="mt-5 text-[36px] font-black leading-[1.06] tracking-[-0.035em] sm:text-[48px]">{guide.title}</h1>
          <p className="mt-6 max-w-3xl text-[18px] leading-8 text-[#4A4A55]">{guide.description}</p>
          <div className="mt-5 flex flex-wrap items-center gap-4 text-[12px] text-[#8b8792]">
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{guide.date}</span>
            <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{guide.readTime}</span>
          </div>
        </header>

        <figure className="mt-10 overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img src={guide.hero} alt={guide.heroAlt} className="aspect-[16/9] w-full rounded-[22px] object-cover" loading="eager" fetchPriority="high" />
        </figure>

        <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,1fr)_280px]">
          <article>
            <div className="space-y-5 text-[17px] leading-8 text-[#4A4A55]">
              {guide.intro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>

            {guide.sections.map((section, index) => (
              <section key={section.title} className="mt-14">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7A3BFF]">Part {index + 1}</p>
                <h2 className="mt-3 text-[29px] font-black leading-tight tracking-[-0.025em] text-[#110829]">{section.title}</h2>
                <div className="mt-5 space-y-5 text-[16px] leading-8 text-[#4A4A55]">
                  {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
                {section.bullets && (
                  <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2.5 rounded-xl border border-[#E7E1F0] bg-white p-4 text-[14px] leading-6 text-[#3f3948]">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#7A3BFF]" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
                {index === 1 && (
                  <figure className="my-10 overflow-hidden rounded-3xl bg-[#090a0d] p-1.5">
                    <img src={guide.secondary} alt={guide.secondaryAlt} className="mx-auto aspect-[9/16] w-full max-w-[370px] rounded-[19px] object-cover" loading="lazy" />
                  </figure>
                )}
              </section>
            ))}

            <section className="mt-16">
              <h2 className="text-[29px] font-black tracking-[-0.025em]">Frequently asked questions</h2>
              <div className="mt-6 space-y-3">
                {guide.faqs.map(([question, answer]) => (
                  <details key={question} className="rounded-2xl border border-[#E5E0F5] bg-white px-5 py-4">
                    <summary className="cursor-pointer list-none text-[15px] font-bold">{question}</summary>
                    <p className="pt-3 text-[14px] leading-6 text-[#5c5664]">{answer}</p>
                  </details>
                ))}
              </div>
            </section>
          </article>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-[#E5E0F5] bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7A3BFF]">Continue the workflow</p>
              <div className="mt-4 space-y-4">
                {guide.links.map(([to, title, description]) => (
                  <Link key={to} to={to} className="group block border-b border-[#EEEAF3] pb-4 last:border-0 last:pb-0">
                    <p className="text-[14px] font-bold group-hover:text-[#7A3BFF]">{title}</p>
                    <p className="mt-1 text-[12px] leading-5 text-[#77717e]">{description}</p>
                  </Link>
                ))}
              </div>
            </div>
            <Link to={primaryToolPath} className="group block rounded-2xl bg-[#110829] p-5 text-white shadow-[0_18px_50px_rgba(17,8,41,.18)]">
              <p className="text-[16px] font-bold">{guide.cta}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-violet-300">Open Zyvo <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span>
            </Link>
          </aside>
        </div>

        <section className="mt-20 rounded-[28px] bg-[#110829] px-6 py-12 text-center text-white sm:px-10">
          <h2 className="text-[30px] font-black">Create, publish, measure, repeat.</h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-7 text-white/55">Move from the next idea to a scheduled post, then bring real performance signals back into the next creative decision.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/workspace/publish" className="rounded-xl bg-[#7A3BFF] px-6 py-3 text-[14px] font-bold">Open Publish</Link>
            <Link to="/workspace/stats" className="rounded-xl border border-white/10 bg-white/[0.06] px-6 py-3 text-[14px] font-bold">Open Stats</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
