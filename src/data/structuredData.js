import { SITE_URL } from "./publicSeoMetadata.js";

// Plain JS (no React/JSX) so it can be imported both by the client
// (PublicContentLayout.jsx, via its useEffect-driven useSEO() injection) and
// by scripts/generateSeoHtml.js directly in plain Node at build time —
// single source of truth for JSON-LD in both places.
export function structuredDataFor(pathname, metadata, canonical) {
  if (!metadata) return null;
  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/workspace/home` },
      ...(pathname.startsWith("/blog/")
        ? [{ "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` }]
        : []),
      { "@type": "ListItem", position: pathname.startsWith("/blog/") ? 3 : 2, name: metadata.title.replace(/ \| Zyvo$/, ""), item: canonical },
    ],
  };
  const isCollectionPage = pathname === "/blog" || pathname.startsWith("/blog/category/");
  let page = isCollectionPage
    ? { "@type": pathname === "/blog" ? "Blog" : "CollectionPage", name: metadata.title.replace(/ \| Zyvo$/, ""), description: metadata.description, url: canonical }
    : pathname.startsWith("/blog/")
    ? { "@type": "BlogPosting", headline: metadata.title.replace(/ \| Zyvo$/, ""), description: metadata.description, mainEntityOfPage: canonical, publisher: { "@type": "Organization", name: "Zyvo", url: SITE_URL } }
    : { "@type": "WebPage", name: metadata.title, description: metadata.description, url: canonical };
  const graph = [page, breadcrumb];

  if (pathname === "/ai-fruit-story-maker") {
    page = {
      "@type": "SoftwareApplication",
      name: "Zyvo AI Fruit Story Generator",
      description: metadata.description,
      url: canonical,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
    };
    graph[0] = page;
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["What is an AI Fruit Story?", "An AI Fruit Story is a short-form fictional drama video created by Zyvo's fruit story AI, in which stylized 3D fruit characters act out a simple conflict, reveal, or surprise across multiple scenes."],
        ["How long does it take to make a fruit drama video?", "Generation time varies with story length, scene count, selected models, and queue conditions. Zyvo shows progress in the workspace while the story is being created."],
        ["Do I need editing or design skills?", "No timeline editing or design software is required for the core workflow. You provide the idea, choose characters and settings, then review the generated scenes and video."],
        ["Can I make 1-minute long fruit videos?", "Yes. The tool supports a 60-second option with up to 10 scenes, subject to the settings available in the workspace."],
        ["What drama styles can I create?", "You can start with cheating-reveal, baby-surprise, secret-twin, revenge, and kicked-out presets, or describe a custom fictional story."],
        ["Do the characters speak in the videos?", "Yes. Animated scenes can include AI-generated English dialogue with mouth-synced character animation."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/cartoon-drive-by-video-maker") {
    page = {
      "@type": "SoftwareApplication",
      name: "Zyvo Cartoon Drive-By Video Maker",
      description: metadata.description,
      url: canonical,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
    };
    graph[0] = page;
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["What is a cartoon drive-by video?", "It is a fictional, stylized travel shot that passes a cartoon- or game-inspired destination from inside a moving vehicle. It is an entertainment format, not a depiction of violence."],
        ["How long is the generated video?", "The current Cartoon Drive-By workflow creates a continuous 10-second video in a vertical 9:16 format."],
        ["Which vehicles can I choose?", "The current tool supports car, train, bus, and plane viewpoints, with motion and framing adjusted for the selected vehicle."],
        ["Can I create a video for TikTok or Reels?", "Yes. The tool is designed around a 9:16 vertical frame suitable for TikTok, Instagram Reels, and YouTube Shorts."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/footballer-nationality-swap-ai") {
    page = {
      "@type": "SoftwareApplication",
      name: "Zyvo Footballer Nationality Swap",
      description: metadata.description,
      url: canonical,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
    };
    graph[0] = page;
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["What is Nationality Swap?", "It's an entertainment format that reimagines a footballer as if they represented a different nation — a new jersey, a localized name card, and a short talking introduction clip in that nation's language."],
        ["Is this affiliated with real players, clubs, or federations?", "No. Nationality Swap generates original, fan-made AI content for entertainment purposes. It is not affiliated with, endorsed by, or produced in partnership with any footballer, club, or national football federation."],
        ["How long is the generated video?", "Each scene is a 6-second vertical talking clip. You can generate 3 to 5 scenes and stitch them into one continuous video."],
        ["Can I choose the video quality?", "Yes. Three tiers are available — 480p, 720p, and 1080p — all with generated audio."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/behind-the-scenes-video-maker") {
    page = {
      "@type": "SoftwareApplication",
      name: "Zyvo Behind the Scenes",
      description: metadata.description,
      url: canonical,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
    };
    graph[0] = page;
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["What is Behind the Scenes?", "It's a format that recreates the look of amateur phone footage shot on a real blockbuster movie set — a handcrafted miniature city, a full-size effects crew, and a giant practical disaster hitting the model. Every image and video is AI-generated."],
        ["Is this real footage from an actual movie set?", "No. Behind the Scenes generates original, fan-made AI content styled to look like practical-effects filmmaking. It is not real footage, not affiliated with any studio or production, and not a depiction of an actual film shoot."],
        ["How many disaster types can I choose from?", "20 — 8 elemental disasters (wave, eruption, explosion, tornado, flood, meteor, firestorm, blizzard) plus 12 extended modules covering giant creatures, aircraft chases, vehicle chases, structural collapse, and more."],
        ["What do I actually get from one generation?", "A photorealistic movie-set still image, then an 8-second animated video built from it — always with sound: crew chatter, rig and machine noise, and the disaster's impact."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/image-generator") {
    page = {
      "@type": "SoftwareApplication",
      name: "Zyvo AI Image Generator",
      description: metadata.description,
      url: canonical,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
    };
    graph[0] = page;
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["What styles can I generate?", "Cinematic, 3D, anime, realistic, and product-focused styles, all from a single text prompt."],
        ["Can I use this for product photos?", "Yes. The generator includes AI background removal and clean-background product presets built for ecommerce and Shopify listings."],
        ["Is it free to start?", "Yes, Zyvo's image generator has a free entry point, with paid tiers for higher volume and resolution."],
        ["What sizes and platforms is this built for?", "Output works for TikTok, Instagram Reels, and YouTube thumbnails and covers, as well as square and landscape formats for product listings and ads."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/blog/ai-fruit-story-pricing") {
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["Is AI Fruit Story actually free?", "Zyvo's AI Fruit Story maker has a free entry point using your account's credit balance. Longer stories with more scenes and full video animation cost more credits than a short one."],
        ["How is the cost calculated?", "Cost is credit-based: a one-time character portrait cost per character, an image cost per scene, and a video cost per scene if you animate it."],
        ["What happens if I run out of credits mid-story?", "The generator checks your credit balance before starting and lets you know if you don't have enough to complete the story you've configured, so you're never charged partway through."],
        ["Does adding more characters cost more?", "Yes — each additional character needs its own consistent portrait generated once, which adds to the total cost before scene generation starts."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/blog/what-is-micro-camera-animal") {
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["What is Micro Camera Animal?", "Micro Camera Animal is an AI video format that shows a tiny research-style camera mounted on a real animal — an ant, earthworm, beetle, termite, spider, cricket, or mole — then follows that animal's POV through its own underground world."],
        ["Is this real footage?", "No. Every image and video is AI-generated, styled to look like ultra-realistic wildlife research documentation — no real animal is filmed or fitted with any camera."],
        ["Which animals can I choose from?", "Seven animals: ant, earthworm, ground beetle, termite, spider, cricket, and mole — each with its own underground world."],
        ["What does one generation actually include?", "A researcher attaching the micro-camera to the animal, followed by a POV journey through progressively deeper parts of its underground environment."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/blog/what-is-clay-rescue") {
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["What is Clay Rescue?", "Clay Rescue is an AI video format where a giant, realistic human hand rescues tiny stop-motion-style clay people from an everyday object turned disaster, using a simple tool, never touching the clay people directly."],
        ["Is this real stop-motion animation?", "No. Every scene is AI-generated, styled to look like claymation — no physical clay figures or stop-motion filming are involved."],
        ["Why doesn't the hand ever touch the clay people?", "It's a deliberate rule — the hand solves the problem indirectly, which keeps the tone gentle and makes the rescue feel like genuine problem-solving."],
        ["What happens after the rescue?", "Only once the danger is fully gone do the clay people react — cheering, celebrating, relieved. Crisis, fix, celebration, in that order, every time."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/blog/what-is-face-asmr") {
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["What is Face ASMR?", "Face ASMR is an AI video format that transforms an uploaded face photo into a surreal, glossy texture material and turns it into a satisfying, ASMR-style short video."],
        ["Whose photo can I use?", "You upload your own photo, and Zyvo transforms it into the texture material — designed for using your own likeness."],
        ["What makes it 'ASMR'?", "The satisfying-texture visual style — glossy, gooey, smooth surfaces reacting to implied touch — is the same visual language behind traditional ASMR slime and texture content."],
        ["Do I need any editing experience?", "No — you upload a photo and Zyvo handles the texture transformation. No editing or design software is required."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/blog/what-is-zyvo") {
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["What is Zyvo?", "Zyvo is an AI content creation platform for short-form video and image generation — a single workspace covering image generation, viral video templates, scripting, and publishing."],
        ["Is Zyvo free to use?", "Zyvo has a free entry point across its tools, with paid plans and credits for higher-volume generation, longer videos, and premium templates."],
        ["Do I need any design or editing skills?", "No — every tool is built around describing what you want in plain language. No timeline editing, animation, or design software is required."],
        ["What platforms is Zyvo's content built for?", "Every tool outputs vertical, short-form-ready content built for TikTok, Instagram Reels, and YouTube Shorts."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/blog/is-zyvo-free") {
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["Is Zyvo actually free?", "Zyvo has a free entry point across its tools, using your account's credit balance. Paid plans and additional credits unlock higher volume and longer, more complex generations."],
        ["How does the credit system work?", "Every generation costs credits based on the tool, the number of scenes or images, and whether the output is animated."],
        ["What happens if I don't have enough credits?", "The generator lets you know before starting if your balance isn't enough to complete the generation — you won't be charged partway through."],
        ["Do unused credits expire?", "Check your account and plan details in Zyvo's workspace for the most current information on credit balances and plan-specific terms."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/blog/how-to-get-started-with-zyvo") {
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["Do I need any design or video editing experience?", "No. Every Zyvo tool is built around describing what you want in plain language — no timeline editing, animation, or design software is required."],
        ["Which tool should I try first?", "Start with the general AI image generator to get a feel for prompting, or pick whichever format-specific tool matches content you already enjoy watching."],
        ["Can I try Zyvo without paying?", "Yes — every tool has a free entry point using your account's credit balance."],
        ["How do I publish what I generate?", "Zyvo's workspace includes a publishing tool for scheduling and posting directly to TikTok, Instagram, and YouTube."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/blog/zyvo-vs-other-ai-tools") {
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["Is Zyvo better than a general-purpose AI generator?", "For proven, specific formats, Zyvo's format-specific tools remove the prompt-engineering work needed for consistent results. For fully custom, one-off work outside any established format, a general-purpose generator may offer more flexibility."],
        ["Does Zyvo support general image generation too?", "Yes — the AI image generator supports cinematic, 3D, anime, realistic, and product styles from a single prompt, in addition to the format-specific video tools."],
        ["Can I publish directly from Zyvo?", "Yes — Zyvo's workspace includes a publishing tool for scheduling and posting to TikTok, Instagram, and YouTube."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/blog/cartoon-drive-by-vs-2am-worlds") {
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["Can I use both formats for the same content idea?", "Yes — some destinations work well as both a moving Cartoon Drive-By video and a still 2AM Worlds image set."],
        ["Which format is faster to generate?", "Cartoon Drive-By produces one finished video per generation, while 2AM Worlds produces six images you may want to arrange into a slideshow afterward."],
        ["Do both formats work for any destination or world?", "2AM Worlds is built to interpret almost any reference. Cartoon Drive-By works best with destinations that make sense from a moving-vehicle viewpoint."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/blog/footballer-nationality-swap-time") {
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["How long does one Footballer Nationality Swap clip take?", "A single 6-second scene generates quickly. A full sequence of 3 to 5 stitched scenes takes longer since each scene generates individually before being combined."],
        ["Does a higher quality tier take longer?", "Higher resolution settings generally take somewhat longer to generate than lower ones, though the difference is usually modest."],
        ["Can I speed things up by skipping the spoken line?", "The talking, lip-synced element is core to the format, so it's included by default — but a short spoken line syncs more convincingly without adding meaningful generation time."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/blog/face-asmr-privacy") {
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["Do I have to use my own photo?", "Face ASMR is designed around uploading your own photo. Only upload a photo you have the right to use."],
        ["Is my photo shared publicly by Zyvo?", "Uploaded photos are used to generate your video; Zyvo doesn't post your content publicly on your behalf. Review Zyvo's privacy policy for specifics."],
        ["Can I delete a photo or generation after uploading it?", "Check your account settings and Zyvo's privacy policy for current options around managing and deleting your uploaded content."],
        ["Where can I read the full privacy policy?", "Zyvo's full privacy policy covers exactly how account and uploaded content data is handled."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/blog/what-is-zyvo-publish") {
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["What is Zyvo Publish?", "Zyvo Publish is a scheduling and posting tool built into the Zyvo workspace — it lets you prepare, schedule, and publish content to Instagram, TikTok, and YouTube from one dashboard."],
        ["Which platforms does Zyvo Publish support?", "Instagram, TikTok, and YouTube. You can choose one platform or send the same video to all three in a single publishing workflow."],
        ["How far in advance can I schedule posts?", "You can plan and schedule posts up to 28 days in advance."],
        ["Can I publish to multiple accounts at once?", "Yes — select your connected accounts when you create a post, and Zyvo handles the separate platform jobs in the background."],
        ["How do I track a post's status?", "Zyvo shows the status of each platform job as it moves from queued to preparing, processing, publishing, and published."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/blog/what-is-zyvo-stats") {
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["What does Zyvo Stats track?", "Zyvo Stats currently tracks connected YouTube channel data including views, watch time, subscriber growth, average view duration, daily trends, and top or recent videos."],
        ["Which date ranges are available?", "You can review performance across 7, 28, 90, or 365-day windows."],
        ["Does Zyvo Stats support Instagram and TikTok analytics?", "Full analytics in the current Stats workspace is available for YouTube. Instagram and TikTok are on the roadmap but not live features yet."],
        ["Do I need to connect a YouTube channel?", "Yes — Zyvo needs a connected YouTube channel to retrieve its analytics, managed from the Connections workspace."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/blog/what-is-zyvo-connections") {
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["What is Zyvo Connections?", "Zyvo Connections is the account-management layer behind Publish and Stats — where you connect, organize, and disconnect your Instagram, TikTok, and YouTube accounts."],
        ["Which platforms can I connect?", "Instagram, TikTok, and YouTube."],
        ["Can I connect more than one account per platform?", "Yes — you can add more than one account for a platform and select the intended destination inside your publishing workflow."],
        ["Can I disconnect an account?", "Yes, at any time. Disconnecting removes it from the accounts available to Publish and Stats."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/blog/what-is-ai-fruit-story") {
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["What is an AI Fruit Story?", "An AI Fruit Story is a short-form fictional drama video made with AI, where stylized 3D cartoon fruit characters act out a conflict, reveal, or plot twist across multiple scenes — built entirely from a text prompt."],
        ["Why is this format going viral right now?", "It combines the visual novelty of fruit characters delivering soap-opera drama with a low barrier to entry and recognizable story structures viewers already understand from short-form drama content."],
        ["How is an AI Fruit Story actually made?", "You describe a premise or pick a preset, and the generator builds characters, scenes, dialogue, and mouth-synced animation from that single input — no manual rigging, scripting, or editing timeline required."],
        ["Do the fruit characters actually talk?", "Yes. Generated scenes can include AI-written English dialogue with mouth-synced character animation."],
        ["Is AI Fruit Story free to try?", "Zyvo's AI Fruit Story maker has a free entry point with paid tiers for longer videos and more scenes."],
        ["What platforms is this content made for?", "The vertical, short-form format is built for TikTok, Instagram Reels, and YouTube Shorts."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/blog/ai-fruit-story-examples") {
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["Can I recreate these exact examples?", "Yes. Every example is a real built-in preset in Zyvo's AI Fruit Story maker — select the matching preset and generate your own version with your own characters."],
        ["Do I need to write dialogue myself?", "No. Each preset ships with its own opening exchange, which the generator expands into a full multi-scene story automatically."],
        ["Which preset should I start with?", "The cheating-reveal preset is the most widely used starting point because its stakes are understood in one line, making it the easiest to test the format with."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/blog/best-ai-video-generators-tiktok") {
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["What should I actually look for in an AI video generator?", "Whether it produces a finished, ready-to-post format or just raw material you still need to edit, whether the visual style stays consistent across generations, and whether there's a free way to test it before paying."],
        ["Is a general-purpose tool or a format-specific tool better?", "It depends on the content. A format-specific tool removes the prompt-engineering work for a proven style; a general-purpose tool offers more flexibility for fully custom, one-off ideas."],
        ["Do I need multiple tools, or can one cover everything?", "A platform built around several format-specific templates plus a general image generator can cover most short-form video needs without switching between separate tools."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/blog/best-free-ai-tools-creators") {
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["Is it realistic to build a whole content workflow on free tools?", "For getting started and testing formats, yes. Most creators eventually hit a free-tier limit on volume or resolution once a format is working, but there's no reason to pay before you know what you're making."],
        ["What should I test first with a free tier?", "Whichever part of your workflow currently takes the most manual time — generation, editing, or publishing — since that's where a free tool saves the most real effort immediately."],
        ["Do free tools produce lower-quality output than paid ones?", "Usually the underlying generation quality is the same; free tiers typically limit volume, resolution, or advanced features rather than quality itself."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/blog/how-to-make-money-ai-content") {
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["How much content do I actually need to post to make money from this?", "Most paths depend on consistent volume more than any single video going viral — a repeatable weekly posting cadence matters more than waiting for one breakout hit."],
        ["Do I need a specific niche to make money with AI content?", "No — platform creator funds and affiliate paths work across almost any consistent format. Brand deals benefit from a recognizable niche, but it's not required to start."],
        ["What's the biggest mistake creators make trying to monetize?", "Switching formats too often. Payouts and brand interest both reward a consistent, recognizable output — testing one format long enough to know if it works beats constantly restarting."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  if (pathname === "/blog/is-ai-content-worth-it") {
    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        ["Is AI-generated content actually worth the cost?", "For formats built around repeatable structure and volume — series, trends, templates — the time saved almost always outweighs the cost. For fully custom one-off work, traditional production may still make more sense."],
        ["Does AI content perform worse than traditionally made content?", "Performance depends far more on format, hook, and consistency than on how the content was produced. A well-structured AI-generated series can outperform inconsistent manual content."],
        ["What's the honest downside people don't mention?", "It's easy to over-rely on volume and skip the judgment part — picking strong premises and reading what's actually performing. AI removes production friction, not the need for a strategy."],
      ].map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}
