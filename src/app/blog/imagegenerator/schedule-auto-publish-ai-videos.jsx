import { Link } from "react-router-dom";
import { useEffect } from "react";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";
import publishCalendarVisual from "../../../assets/blog/publish/publish-landing-hero-wide.png";
import publishAnalyticsVisual from "../../../assets/blog/publish/analytics-landing-hero-wide.png";
import connectVisual from "../../../assets/blog/publish/one-video-three-platforms-vertical.png";
import queueVisual from "../../../assets/blog/publish/automated-posting-queue-vertical.png";
import successVisual from "../../../assets/blog/publish/publish-success-vertical.png";
import scheduleVisual from "../../../assets/blog/publish/schedule-28-days-vertical.png";
import captionVisual from "../../../assets/blog/publish/ai-caption-generator-vertical.png";

const related = [
  {
    title: "Social Media Scheduler for Creators: The Complete 2026 Guide",
    description: "Choose a scheduling workflow designed around short-form video and consistent multi-platform publishing.",
    date: "20.07.2026",
    slug: "/blog/social-media-scheduler-for-creators",
  },
  {
    title: "How to Cross-Post to Instagram, TikTok, and YouTube",
    description: "Prepare one clean video for three connected destinations without repeating the full upload process.",
    date: "20.07.2026",
    slug: "/blog/how-to-cross-post-instagram-tiktok-youtube",
  },
  {
    title: "How to Build a 28-Day Social Media Content Calendar",
    description: "Plan a sustainable month of TikTok, Reels, and Shorts content around your real production capacity.",
    date: "20.07.2026",
    slug: "/blog/28-day-social-media-content-calendar",
  },
];

export default function ScheduleAutoPublishAIVideos() {
  useEffect(() => {
    document.title = "How to Schedule & Auto-Publish AI Videos in 2026 (One-Click Guide) | Zyvo";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "Step-by-step guide to scheduling AI videos up to 28 days ahead and publishing to Instagram, TikTok, and YouTube with Zyvo Publish."
      );
    }
  }, []);

  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-6 sm:pt-10">

        <nav className="mb-6 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <Link to="/blog" className="hover:text-[#7A3BFF]">Go Viral</Link>
          <span className="mx-2">/</span>
          <span>Schedule & Auto-Publish AI Videos</span>
        </nav>

        <header className="mb-10 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Go Viral
          </span>
          <h1 className="mb-6 text-[36px] font-bold leading-tight text-[#110829] sm:text-[44px]">
            How to Schedule & Auto-Publish AI Videos in 2026 (One-Click Guide)
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Generating a great AI video is only half the job. The accounts that actually grow are the ones that post on a schedule, every day, without someone sitting at a laptop at 9pm hitting upload. Here's exactly how to set up a posting queue in Zyvo and let it publish for you.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Jul 2, 2026 · 8 min read · Publishing & Scheduling</p>
        </header>

        <div className="mb-20 overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img
            src={publishCalendarVisual}
            alt="Zyvo Publish calendar for scheduling videos to Instagram, TikTok, and YouTube"
            className="aspect-[1376/768] w-full rounded-[22px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </div>

        <section className="mb-20 max-w-3xl">
          <p className="text-[17px] text-[#4A4A55] mb-5 leading-relaxed">
            Most creators stall out at the same step: they finish a batch of videos and then manually download, re-upload, and caption each one on every platform. It's tedious enough that posting becomes irregular — and irregular posting is the single biggest killer of algorithmic reach.
          </p>
          <p className="text-[17px] text-[#4A4A55] leading-relaxed">
            Zyvo's <Link to="/workspace/publish" className="text-[#7A3BFF] font-semibold hover:underline">Publish workspace</Link> removes that friction. Connect your accounts once, queue up your videos, and Zyvo posts them automatically at the times you choose — even while you're asleep.
          </p>
        </section>

        <section className="mb-24 grid gap-10 md:grid-cols-[.72fr_1.28fr] md:items-center">
          <img src={connectVisual} alt="One video connected to Instagram, TikTok, and YouTube publishing channels" className="mx-auto aspect-[9/16] w-full max-w-[300px] rounded-3xl object-cover shadow-xl" loading="lazy" />
          <div>
            <span className="text-[#7A3BFF] text-[13px] font-bold uppercase tracking-widest mb-4 block">Step 1</span>
            <h2 className="text-[32px] font-semibold text-[#110829] mb-6 leading-tight">
              Connect your accounts
            </h2>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-5">
              Open Publish and click <strong>Connect Social Accounts</strong>. Zyvo supports Instagram, TikTok, and YouTube, so your short-form channels stay together in one publishing workspace.
            </p>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-5">
              Instagram requires your account to be set to Creator or Business — a free switch that takes about 30 seconds in the Instagram app. YouTube uses a standard Google connection, while TikTok lets you review the available privacy and posting options for your account.
            </p>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed">
              Zyvo only ever requests publish permission — it never reads DMs or follower lists, and you can disconnect any account at any time.
            </p>
          </div>
        </section>

        <section className="mb-28">
          <h2 className="text-[34px] font-semibold text-[#110829] mb-8 max-w-3xl leading-tight">
            Step 2: Build your posting queue
          </h2>
          <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-10 max-w-3xl">
            A queue slot is just a posting time — for example, every weekday at 9:00am. Slots don't post anything on their own; they're empty placeholders until you assign a video to them. Click <strong>Edit Queue</strong> on any day to add, remove, or retime slots.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
            {[
              { title: "Pick your days", desc: "Choose exactly which days of the week each time slot fires — Monday and Thursday at 9am, daily at noon, whatever matches your niche.", tag: "Flexible" },
              { title: "Set the time", desc: "Plan supported posts up to 28 days ahead, so you can see nearly a month of content and spot empty days before they become missed posts.", tag: "Full control" },
              { title: "Fill slots later", desc: "You don't need finished videos to set up your queue. Build the schedule first, then drop videos into slots as you finish generating them.", tag: "Plan ahead" },
            ].map((m) => (
              <div key={m.title} className="bg-white rounded-2xl border border-[#ECE8F2] p-6">
                <span className="inline-block text-[11px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md mb-3">{m.tag}</span>
                <h3 className="text-[17px] font-bold text-[#110829] mb-2">{m.title}</h3>
                <p className="text-[13px] text-[#4A4A55] leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>

          <div className="mx-auto grid max-w-[700px] gap-4 sm:grid-cols-2">
            <img src={queueVisual} alt="Automated social media posting queue for short-form videos" className="aspect-[9/16] w-full rounded-3xl object-cover shadow-xl" loading="lazy" />
            <img src={scheduleVisual} alt="Twenty-eight day social media video scheduling calendar" className="aspect-[9/16] w-full rounded-3xl object-cover shadow-xl" loading="lazy" />
          </div>

        </section>

        <section className="mb-24 grid gap-10 md:grid-cols-[1.25fr_.75fr] md:items-center">
          <div>
            <span className="text-[#7A3BFF] text-[13px] font-bold uppercase tracking-widest mb-4 block">Step 3</span>
            <h2 className="text-[32px] font-semibold text-[#110829] mb-6 leading-tight">
              Publish with one click
            </h2>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-5">
              Click <strong>Publish New Content</strong>, pick a finished video from your library, write your caption, and choose which connected platforms it goes to. Hit publish now, or drop it straight into an open queue slot to schedule it for later.
            </p>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-5">
              One video, multiple platforms, one click. No re-exporting, no separate uploads, no switching tabs between apps.
            </p>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed">
              Behind the scenes, Zyvo prepares the video for each platform's requirements — container creation, processing, and publishing — so you don't have to think about format differences.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <img src={captionVisual} alt="AI caption assistant preparing copy for a scheduled video" className="aspect-[9/16] w-full rounded-3xl object-cover shadow-xl" loading="lazy" />
            <img src={successVisual} alt="Successful multi-platform video publication confirmation" className="aspect-[9/16] w-full rounded-3xl object-cover shadow-xl" loading="lazy" />
          </div>
        </section>

        <section className="mb-32 max-w-3xl">
          <h2 className="text-[34px] font-semibold text-[#110829] mb-8 leading-tight">
            Step 4: Watch status and track what happens after
          </h2>
          <div className="space-y-7">
            {[
              { n: "01", title: "Live status on every post", body: "Each scheduled post moves through clear stages — Queued, Preparing, Processing, Publishing, Published — so you always know exactly where a video is, right up until it goes live." },
              { n: "02", title: "Past Publications history", body: "Every post you've ever published lives in one feed with its caption, thumbnail, publish date, and a direct link to view it live on the platform." },
              { n: "03", title: "Zyvo AI reads the results", body: "Once a post is live, Zyvo tracks its views, likes, and engagement and surfaces what's actually working — so your next post is informed by real data, not a guess." },
              { n: "04", title: "Nothing posts by accident", body: "Queue slots stay empty until you deliberately assign a video to them. You're always the one deciding what goes out — the automation only handles the timing." },
            ].map(({ n, title, body }) => (
              <div key={n} className="flex gap-8 items-start">
                <span className="text-[42px] font-bold text-[#ECE8F2] leading-none shrink-0">{n}</span>
                <div>
                  <h3 className="text-[20px] font-semibold text-[#110829] mb-3">{title}</h3>
                  <p className="text-[#4A4A55] text-[16px] leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-32 bg-[#110829] rounded-3xl p-12 text-center">
          <h2 className="text-[32px] font-bold text-white mb-4">Stop uploading videos by hand</h2>
          <p className="text-[17px] text-white/60 mb-8 max-w-xl mx-auto">
            Connect your accounts, build your queue, and let Zyvo post while you focus on making the next video.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/workspace/publish" className="inline-block bg-[#7A3BFF] text-white font-semibold text-[16px] px-8 py-4 rounded-xl hover:bg-[#6930e8] transition">
              Open Publish →
            </Link>
            <Link to="/workspace/video-generator" className="inline-block bg-white/10 text-white font-semibold text-[16px] px-8 py-4 rounded-xl hover:bg-white/20 transition">
              Generate a Video First
            </Link>
          </div>
        </section>

        <div className="mb-24 overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.14)] sm:p-2">
          <img
            src={publishAnalyticsVisual}
            alt="Zyvo analytics dashboard tracking views and audience growth after publishing"
            className="aspect-[1376/768] w-full rounded-[22px] object-cover"
            loading="lazy"
          />
        </div>

        <RelatedArticles articles={related} />
      </div>
      <Footer />
    </div>
  );
}
