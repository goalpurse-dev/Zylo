// Content Machine: the style samples (owner, 2026-10-18, step 7): one slideshow per visual style with REAL
// generated pictures, so the owner judges the actual look before the first real run. The words are fixed
// here (no writing call: under $0.20 for all five, pictures and render time only). image_prompt is the
// SUBJECT only (the style's hero_prompt adds the look); asset_pick takes a real Zyvo output from the asset
// library (by tool), falling back to the image_prompt when the library has none.

const S = (kind, headline, extra = {}) => ({ kind, headline, body: null, label: null, items: [], tool: null, image_prompt: null, asset_id: null, is_zyvo: false, ...extra });
const T = (name, url, what) => ({ name, url, what_it_does: what });

export const STYLE_SAMPLES = [
  {
    style: "luxury_night", format: "numbered_steps", title: "How I'd start YT automation from scratch",
    slides: [
      S("cover", "How I'd start YT automation *from scratch*", { label: "Save this", image_prompt: "a laptop glowing on a marble desk in a penthouse, city skyline at night through tall windows" }),
      S("step", "Pick one niche you could make 30 videos about", { label: "01", image_prompt: "an open leather notebook and a fountain pen beside a rain-streaked window, city lights" }),
      S("step", "Write 10 hooks before you make anything", { label: "02", body: "The first 2 seconds decide who stays.", image_prompt: "a vintage studio microphone on a velvet armchair, warm lamp light, city bokeh" }),
      S("step", "Make the video part *fast*", { label: "03", body: "I built Zyvo for this step: one idea in, a finished video out.", is_zyvo: true, image_prompt: "a large cinema screen glowing in a dark luxury living room" }),
      S("step", "Post on a schedule you can keep for 90 days", { label: "04", image_prompt: "a minimalist desk calendar and an espresso cup on a dark wood table at night" }),
      S("cta", "Tool's in my bio", { body: "Comment ZYVO and I'll send the link", is_zyvo: true }),
    ],
  },
  {
    style: "neon_grid", format: "tool_listicle", title: "AI tools that replace a video editor",
    slides: [
      S("cover", "4 AI tools that replace a *video editor*", { label: "Faceless creators", image_prompt: "a film clapperboard" }),
      S("item", "Edit video by editing the text", { label: "1", tool: T("Descript", "https://www.descript.com", "Edit audio and video by editing the transcript, like a document."), image_prompt: "a sound waveform turning into lines of text" }),
      S("item", "Turn one idea into a full video", { label: "2", tool: T("Zyvo", "https://www.tryzyvo.com", "Turns one idea into an illustrated YouTube video, or a 9:16 Short from a template."), is_zyvo: true, image_prompt: "a rocket shaped like a play button" }),
      S("item", "Voiceovers without a microphone", { label: "3", tool: T("ElevenLabs", "https://elevenlabs.io", "Realistic AI voices for narration in many languages."), image_prompt: "a studio microphone with sound rings" }),
      S("item", "Captions and quick cuts on your phone", { label: "4", tool: T("CapCut", "https://www.capcut.com", "Free editor with auto captions, templates and effects."), image_prompt: "a smartphone with a film strip and scissors" }),
      S("cta", "Which one would you *try first*?", { body: "Tell me in the comments" }),
    ],
  },
  {
    style: "minimal_clean", format: "myth_fact", title: "3 myths about AI video",
    slides: [
      S("cover", "3 myths about *AI video* that aren't true", { label: "Myth vs fact", image_prompt: "a small camera and a friendly toy robot side by side" }),
      S("versus", "Do you need a camera to grow?", { label: "Myth vs Fact", items: ["You need to show your face to grow a channel", "Faceless channels grow on story, hooks and consistency"], image_prompt: "a camera on a tripod next to an empty chair" }),
      S("versus", "Does AI content all look the same?", { label: "Myth vs Fact", items: ["Every AI video looks identical", "It looks the same when everyone uses the same prompt"], image_prompt: "a row of identical white cubes with one colourful sphere" }),
      S("versus", "Is it only for tech people?", { label: "Myth vs Fact", items: ["You need to code to make AI videos", "Tools like Zyvo start from one sentence in the browser"], is_zyvo: true, image_prompt: "a simple laptop showing a big play button" }),
      S("cta", "Which myth did you believe?", { image_prompt: "a question mark made of soft clay" }),
    ],
  },
  {
    style: "screenshot_collage", format: "zyvo_showcase", title: "Would you watch this? (made with Zyvo)",
    slides: [
      S("cover", "Would you *watch this*?", { label: "Made with Zyvo", asset_pick: { tool: "long_form" }, image_prompt: "a stack of illustrated video thumbnails" }),
      S("zyvo", "One idea in, a full video out", { body: "An 8–15 minute illustrated YouTube video from a niche and an idea.", is_zyvo: true }),
      S("text", "Talking-fruit dramas", { body: "AI Fruit Story: series of up to 10 episodes with the same cast.", asset_pick: { tool: "ai_fruit_story" }, image_prompt: "cartoon fruit characters on a kitchen counter stage" }),
      S("text", "Blocky stories that speak their lines", { body: "Blocky Stories: lip sync and captions included.", asset_pick: { tool: "blocky_stories" }, image_prompt: "blocky toy characters in a tiny town" }),
      S("cta", "Rate it 1–10", { body: "Honest answers only", is_zyvo: true }),
    ],
  },
  {
    style: "meme_style", format: "meme", title: "Creator life",
    slides: [
      S("meme", "Me after editing one 60-second video for 6 hours", { image_prompt: "an exhausted cartoon video editor slumped over a desk surrounded by empty coffee cups at night" }),
      S("meme", "Waiting for the views to come in", { image_prompt: "a cartoon creator staring hopefully at a phone while a tumbleweed rolls past" }),
      S("meme", "When the script, voice and scenes are done before lunch", { image_prompt: "a cartoon creator dancing happily in an office chair" }),
      S("cta", "Tag a creator who needs this", { body: "made with Zyvo · tryzyvo.com", is_zyvo: true }),
    ],
  },
];

/** Resolves asset_pick to a real library asset (by tool), else keeps the image_prompt. */
export function resolveSample(sample, assets) {
  const used = new Set();
  const slides = sample.slides.map(({ asset_pick, ...slide }) => {
    if (!asset_pick) return slide;
    const hit = assets.find((a) => a.tool === asset_pick.tool && !used.has(a.ref) && a.kind !== "ui");
    if (!hit) return slide;
    used.add(hit.ref);
    return { ...slide, asset_id: hit.ref, image_prompt: null };
  });
  return {
    title: sample.title, topic: sample.title, hook: slides[0].headline.replace(/\*/g, ""), hypothesis: `style sample: ${sample.style}`,
    slides, tools_checked: [], ai_label_required: sample.style === "luxury_night", why_it_could_go_viral: "style sample", virality_score: 5,
  };
}
