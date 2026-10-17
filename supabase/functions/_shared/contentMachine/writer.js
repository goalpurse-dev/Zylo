// Content Machine: what Claude is asked to write, and how the answer is checked.
//   writeRequest   CM_MODEL_MAIN + web search: one slideshow for one recipe (real tools, checked)
//   packageRequest CM_MODEL_FAST: captions per platform + the compliance check against the brand rules
//   rewriteRequest CM_MODEL_MAIN, no search: one rewrite of a slideshow that failed the compliance check
// The system prompts are stable (cached, cache_control on the last system block); everything that
// changes per slideshow is in the user message, so the cache is shared across the day's slideshows.
import { WEB_SEARCH_TOOL } from "./providers/anthropic.js";

export const ZYVO_FACTS = `Zyvo (tryzyvo.com) is a web app that turns one idea into finished videos and images:
- Long Form: 8–15 minute illustrated (stickman-style) YouTube videos from a niche and an idea: researched script, voiceover, about 150 drawn scenes, three thumbnails, title and description; every scene can be edited before download.
- Short-form 9:16 templates for TikTok, Reels and Shorts, each making one kind of video from a short prompt: AI Fruit Story (talking-fruit dramas, series of up to 10 episodes with the same cast), Blocky Stories (blocky characters speaking with lip sync and captions), Cartoon Drive-By, Behind the Scenes, 2AM Worlds, 30 Days, Micro Camera Animal, Clay Rescue, Face ASMR, Kit Swap.
- An AI image generator (cinematic, 3D, anime, realistic, product styles).
- New accounts get 5 free image generations; video tools need a paid plan (Starter, Pro, Generative). Paid exports have no watermark.
Say nothing else about Zyvo: no user counts, no speeds ("in 30 seconds"), no earnings, no reviews.`;

export const SLIDE_KINDS = ["cover", "item", "step", "text", "versus", "tier", "quiz_question", "quiz_answer", "checklist", "meme", "zyvo", "cta"];

const nullable = (t) => ({ type: [t, "null"] });
export const SLIDESHOW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "topic", "hook", "hypothesis", "slides", "tools_checked", "ai_label_required", "why_it_could_go_viral", "virality_score"],
  properties: {
    title: { type: "string" },
    topic: { type: "string" },
    hook: { type: "string" },
    hypothesis: { type: "string" },
    slides: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "headline", "body", "label", "items", "tool", "image_prompt", "asset_id", "is_zyvo"],
        properties: {
          kind: { type: "string", enum: SLIDE_KINDS },
          headline: { type: "string" },
          body: nullable("string"),
          label: nullable("string"),
          items: { type: "array", items: { type: "string" } },
          tool: {
            type: ["object", "null"],
            additionalProperties: false,
            required: ["name", "url", "what_it_does"],
            properties: { name: { type: "string" }, url: { type: "string" }, what_it_does: { type: "string" } },
          },
          image_prompt: nullable("string"),
          asset_id: nullable("string"),
          is_zyvo: { type: "boolean" },
        },
      },
    },
    tools_checked: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["name", "url", "source_url"], properties: { name: { type: "string" }, url: { type: "string" }, source_url: { type: "string" } } },
    },
    ai_label_required: { type: "boolean" },
    why_it_could_go_viral: { type: "string" },
    virality_score: { type: "integer" },
  },
};

export const PACKAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tiktok", "instagram", "youtube", "sound_suggestion", "compliance"],
  properties: {
    tiktok: { type: "object", additionalProperties: false, required: ["caption", "hashtags", "on_screen_text"], properties: { caption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } }, on_screen_text: { type: "array", items: { type: "string" } } } },
    instagram: { type: "object", additionalProperties: false, required: ["caption", "hashtags"], properties: { caption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } } } },
    youtube: { type: "object", additionalProperties: false, required: ["title", "description", "hashtags"], properties: { title: { type: "string" }, description: { type: "string" }, hashtags: { type: "array", items: { type: "string" } } } },
    sound_suggestion: { type: "string" },
    compliance: { type: "object", additionalProperties: false, required: ["ok", "problems"], properties: { ok: { type: "boolean" }, problems: { type: "array", items: { type: "string" } } } },
  },
};

const libraryText = (library) => [
  "FORMATS:", ...library.formats.map((f) => `- ${f.key}: ${f.name}. ${f.description} (slides ${JSON.stringify(f.spec?.slides ?? [5, 7])}; Zyvo: ${f.spec?.zyvo ?? "one honest mention"})`),
  "VISUAL STYLES (the renderer draws the words; you choose each slide's picture):", ...library.styles.map((s) => `- ${s.key}: ${s.name}. ${s.description}${s.spec?.visual ? ` Pictures: ${s.spec.visual}.` : ""}`),
  "HOOK TYPES:", ...library.hooks.map((h) => `- ${h.key}: ${h.name}. ${h.description} e.g. "${h.spec?.example ?? ""}"`),
].join("\n");

/** The asset library as the writer sees it: one line per usable asset (ref, tool, subject, tags). */
export function assetsText(assets = []) {
  if (!assets.length) return "ASSET LIBRARY: empty for now (use image_prompt).";
  return ["ASSET LIBRARY (real Zyvo outputs and UI; use one by putting its ref in asset_id):",
    ...assets.slice(0, 300).map((a) => `- ${a.ref}: ${a.kind}${a.tool ? ` · ${a.tool}` : ""}${a.style ? ` · ${a.style}` : ""} · ${a.subject ?? ""}${a.tags?.length ? ` [${a.tags.slice(0, 6).join(", ")}]` : ""}`)].join("\n");
}

export function writeSystem({ brandRules, library, assets = [] }) {
  return `You write short-form SLIDESHOW posts (TikTok/Instagram photo carousels, also cut into a Shorts/Reels video) for Zyvo's own accounts. Each post is a labelled experiment: you are given a recipe (format, hook type, style, where Zyvo appears, CTA type, platform, text density, slide count) and you follow it exactly.

ABOUT ZYVO (the only facts you may state about it):
${ZYVO_FACTS}

BRAND RULES (follow strictly):
${brandRules}

THE LIBRARY:
${libraryText(library)}

${assetsText(assets)}

HOW TO WRITE IT:
- The cover (slide 1) carries the hook: it must stop the scroll in under 2 seconds. Short, concrete, no clickbait lies.
- Each post must be entertaining or useful on its own. Zyvo is snuck in at the recipe's position, never the hook.
- zyvo_position: early = slide 2–3, middle = the middle slide, late = the slide before the last, cta_only = Zyvo only in the last (cta) slide. Mark Zyvo's slide is_zyvo = true; use kind "zyvo" for a slide about Zyvo itself, or kind "item" with tool {name: "Zyvo", url: "tryzyvo.com", ...} in a listicle.
- Real tools only. Use web search to check that every tool you name exists, what it does, and its official address; list each in tools_checked with the page you checked. Never invent features, prices or numbers. If you can't verify a tool, leave it out.
- Don't describe or ask for logos: the renderer shows the tool's official logo (only if the owner approved it) or an icon tile with its initials, small, next to its name.
- Text density: low = headline only (≤ 8 words) on most slides; medium = headline + one short line; high = headline + 2–3 lines or a short list.
- headline ≤ 60 characters. body ≤ 160 characters. items ≤ 5 per slide, ≤ 40 characters each. Wrap ONE key phrase of a headline in *asterisks* to get the yellow highlight bar.
- EVERY slide gets a strong visual (posts that are walls of text don't stop the scroll). For each slide give EITHER image_prompt OR asset_id:
  - image_prompt: the ONE concrete subject of that slide's picture, matching the slide's point and the style's picture language (e.g. "a glowing film clapperboard with a play button", "a microphone on a velvet desk at night"). Just the subject: the style's look is added for you. Never text, letters, logos or brands, and NEVER a real person, a celebrity, a public figure or anyone who looks like one; prefer objects and scenes; a character must be an invented cartoon character.
  - asset_id: a ref from the ASSET LIBRARY, for "made with Zyvo" proof, output showcases and the screenshot_collage style (which uses real Zyvo UI and outputs first). Only refs that are listed.
  - Only a cta slide (or a quiz answer) may have neither; it then sits on the slideshow's background picture.
- Never imply that Zyvo is partnered with, endorsed by or affiliated with any tool you list.
- The last slide is kind "cta" and matches the recipe's cta_type: link_in_bio ("tool's in my bio"), comment_keyword ("comment ZYVO and I'll send the link"), soft_mention ("made with Zyvo"), question (a question that invites comments).
- First person only when true: "I built Zyvo" is true; invented experiences ("I've used X for 6 months", "this made me $5k") are not allowed.
- Stories are clearly hypothetical ("Imagine…", "POV: you…") or about "you", the viewer. Never a made-up real person ("She edited for 6 hours… 212 views" reads like a real testimonial: not allowed).
- hypothesis: one line saying what this post tests, e.g. "a question hook beats a statement hook for tool listicles".
- ai_label_required: true if any slide uses realistic AI imagery.
- virality_score: your honest 1–10 estimate.
Return only the JSON object.`;
}

export function writeUser({ recipe, today, avoidTitles = [] }) {
  return `TODAY: ${today}
RECIPE: ${JSON.stringify(recipe)}
TOPIC: ${recipe.topic ? recipe.topic : "Pick a topic yourself that suits the format and is useful to people starting faceless channels or AI video, or curious about AI tools."}
SLIDES: exactly ${recipe.slide_count}.
DON'T REPEAT these recent posts (titles):
${avoidTitles.length ? avoidTitles.slice(0, 60).map((t) => `- ${t}`).join("\n") : "- none yet"}`;
}

export function writeRequest({ model, brandRules, library, recipe, today, avoidTitles, maxSearches = 4, assets = [] }) {
  return {
    model,
    max_tokens: 16000,
    system: [{ type: "text", text: writeSystem({ brandRules, library, assets }), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: writeUser({ recipe, today, avoidTitles }) }],
    tools: [{ type: WEB_SEARCH_TOOL, name: "web_search", max_uses: maxSearches }],
    output_config: { effort: "medium", format: { type: "json_schema", schema: SLIDESHOW_SCHEMA } },
  };
}

export function rewriteRequest({ model, brandRules, library, recipe, today, slideshow, problems, assets = [] }) {
  return {
    model,
    max_tokens: 16000,
    system: [{ type: "text", text: writeSystem({ brandRules, library, assets }), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `${writeUser({ recipe, today })}

A compliance check found these problems in the post below. Rewrite it so every problem is gone; keep what works. Don't add tools you haven't checked before (you have no web search now): drop any you can't vouch for.
PROBLEMS:
${problems.map((p) => `- ${p}`).join("\n")}
THE POST:
${JSON.stringify(slideshow)}` }],
    output_config: { effort: "medium", format: { type: "json_schema", schema: SLIDESHOW_SCHEMA } },
  };
}

export function packageSystem({ brandRules }) {
  return `You package finished slideshow posts for TikTok, Instagram and YouTube Shorts, and you check them against the brand rules.

ABOUT ZYVO (the only facts that may be stated about it):
${ZYVO_FACTS}

BRAND RULES:
${brandRules}

PACKAGING:
- tiktok.caption: at most 150 characters: a curiosity hook plus a question that invites comments. 3–5 hashtags (one broad, the rest niche). on_screen_text: 1–3 short text suggestions for the first frame.
- instagram.caption: a hook line, 1–2 lines of value, then the CTA line given to you. 5–8 hashtags.
- youtube.title: at most 60 characters, hooky and searchable. youtube.description: 1–2 sentences plus the link given to you. Exactly 3 hashtags including #shorts.
- Posts whose recipe cta_type is comment_keyword or link_in_bio may use a stronger CTA; soft_mention and question stay soft.
- sound_suggestion: a description of the kind of sound that fits (mood, tempo, "a trending lo-fi sound"); the owner picks the actual sound in the app. Never name copyrighted songs as if they were included.
- Hashtags start with # and have no spaces.

COMPLIANCE: check the slides AND your captions against every brand rule. Invented personal claims, income or lifestyle claims, fake testimonials or stats, inaccurate tool descriptions, logos, real people, copyrighted characters, misleading news, medical or financial advice: each is a problem. So is any image_prompt that describes a real person, a celebrity, a public figure or a lookalike of one, any wording that implies Zyvo is partnered with, endorsed by or affiliated with another tool, and any story about a specific made-up person told as if real (stories must be hypothetical, "Imagine…" / "POV: you…", or about "you"). compliance.ok is true only if there are none; otherwise list each problem in one line saying which slide and what to change.
Return only the JSON object.`;
}

export function packageRequest({ model, brandRules, recipe, slideshow, links }) {
  return {
    model,
    max_tokens: 4000,
    system: [{ type: "text", text: packageSystem({ brandRules }), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `RECIPE: ${JSON.stringify(recipe)}
LINKS (use exactly): instagram CTA line: "Link in bio → tryzyvo.com"; youtube link: ${links.youtube}
THE POST: ${JSON.stringify(slideshow)}` }],
    output_config: { effort: "low", format: { type: "json_schema", schema: PACKAGE_SCHEMA } },
  };
}

/* ─── checks on what came back ───────────────────────────────────────── */

/** Problems a program can see (empty = fine). The model's own compliance check is separate. */
export function slideshowProblems(s, recipe, opts = {}) {
  const p = [];
  if (!s || !Array.isArray(s.slides)) return ["no slides"];
  const n = s.slides.length;
  if (n < 3 || n > 10) p.push(`${n} slides (3–10 allowed)`);
  if (recipe?.slide_count && Math.abs(n - recipe.slide_count) > 1) p.push(`${n} slides, the recipe asked for ${recipe.slide_count}`);
  if (s.slides[0]?.kind !== "cover") p.push("slide 1 is not the cover");
  if (s.slides[n - 1]?.kind !== "cta") p.push("the last slide is not the cta");
  if (!s.slides.some((x) => x.is_zyvo)) p.push("Zyvo appears nowhere");
  s.slides.forEach((x, i) => {
    if (!SLIDE_KINDS.includes(x.kind)) p.push(`slide ${i + 1}: unknown kind ${x.kind}`);
    if (!String(x.headline ?? "").trim()) p.push(`slide ${i + 1}: no headline`);
    if (String(x.headline ?? "").replace(/\*/g, "").length > 70) p.push(`slide ${i + 1}: headline too long`);
    if (String(x.body ?? "").length > 200) p.push(`slide ${i + 1}: text too long`);
    if ((x.items ?? []).length > 6) p.push(`slide ${i + 1}: too many items`);
  });
  // Visual richness: every slide but a cta / quiz answer has a picture (a prompt or a library asset).
  s.slides.forEach((x, i) => {
    const hasVisual = String(x.image_prompt ?? "").trim() || String(x.asset_id ?? "").trim();
    if (!hasVisual && !["cta", "quiz_answer"].includes(x.kind)) p.push(`slide ${i + 1}: no visual (give an image_prompt or an asset_id)`);
    if (x.asset_id && opts.assetRefs && !opts.assetRefs.has(String(x.asset_id))) p.push(`slide ${i + 1}: asset_id ${x.asset_id} is not in the library`);
  });
  s.slides.forEach((x, i) => { if (x.kind === "meme" && !String(x.image_prompt ?? "").trim()) p.push(`slide ${i + 1}: a meme slide needs an image_prompt (its picture)`); });
  // A program backstop for the obvious cases; the model's compliance check covers the rest.
  const people = /\b(celebrit\w*|famous people|lookalike|look-alike|resembl\w*|elon musk|mrbeast|taylor swift|ronaldo|messi|kardashian\w*|real person)\b/i;
  s.slides.forEach((x, i) => { if (people.test(String(x.image_prompt ?? ""))) p.push(`slide ${i + 1}: the image prompt points at a real person or a lookalike`); });
  const named = s.slides.map((x) => x.tool?.name).filter((t) => t && !/^zyvo$/i.test(t));
  const checked = new Set((s.tools_checked ?? []).map((t) => String(t.name).toLowerCase()));
  for (const t of named) if (!checked.has(t.toLowerCase())) p.push(`${t} is named but not in tools_checked`);
  if (!Number.isInteger(s.virality_score) || s.virality_score < 1 || s.virality_score > 10) p.push("virality_score out of 1–10");
  return p;
}

export function packageProblems(pkg) {
  const p = [];
  if (!pkg) return ["no package"];
  if ((pkg.tiktok?.caption ?? "").length > 150) p.push("TikTok caption over 150 characters");
  if ((pkg.youtube?.title ?? "").length > 60) p.push("YouTube title over 60 characters");
  const tags = (list) => (list ?? []).every((h) => /^#[^\s#]+$/.test(h));
  if (!tags(pkg.tiktok?.hashtags) || !tags(pkg.instagram?.hashtags) || !tags(pkg.youtube?.hashtags)) p.push("a hashtag is malformed");
  if (!(pkg.youtube?.hashtags ?? []).some((h) => h.toLowerCase() === "#shorts")) p.push("YouTube hashtags lack #shorts");
  return p;
}

/** UTM links per platform so signups can be attributed to the post. */
export function utmLinks(ideaId) {
  const c = `cm_${String(ideaId).replace(/-/g, "").slice(0, 12)}`;
  const link = (src) => `https://www.tryzyvo.com/?utm_source=${src}&utm_medium=social&utm_campaign=${c}`;
  return { tiktok: link("tiktok"), instagram: link("instagram"), youtube: link("youtube"), campaign: c };
}

/* ─── near-duplicates ────────────────────────────────────────────────── */

const words = (s) => new Set(String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2));
export function similarity(a, b) {
  const x = words(a), y = words(b);
  if (!x.size || !y.size) return 0;
  let both = 0;
  for (const w of x) if (y.has(w)) both += 1;
  return both / (x.size + y.size - both);
}
/** The recent title most like this one, if it is too close (title + hook against title + hook). */
export function nearDuplicate(s, recent, threshold = 0.6) {
  const me = `${s.title} ${s.hook}`;
  let best = null;
  for (const r of recent) {
    const score = similarity(me, `${r.title} ${r.hook ?? ""}`);
    if (score >= threshold && (!best || score > best.score)) best = { title: r.title, score };
  }
  return best;
}

/* ─── dry runs: what a mocked call returns ───────────────────────────── */

export function mockSlideshow(recipe) {
  const n = Math.max(3, recipe.slide_count ?? 6);
  const zyvoAt = { early: 1, middle: Math.floor(n / 2), late: n - 2, cta_only: n - 1 }[recipe.zyvo_position] ?? n - 2;
  const slides = Array.from({ length: n }, (_, i) => {
    const kind = i === 0 ? "cover" : i === n - 1 ? "cta" : i === zyvoAt ? "zyvo" : "item";
    return {
      kind,
      headline: i === 0 ? `DRY RUN: a *${recipe.format.replace(/_/g, " ")}* post` : kind === "cta" ? "Tool's in my bio" : kind === "zyvo" ? "Zyvo makes the *video* part" : `Example point ${i}`,
      body: kind === "item" ? "Mocked text: no model was called, nothing was spent." : null,
      label: kind === "item" ? String(i) : null,
      items: [],
      tool: kind === "item" ? { name: `Example tool ${i}`, url: "example.com", what_it_does: "A placeholder for a real, checked tool." } : null,
      image_prompt: kind === "cta" ? null : "a placeholder subject",
      asset_id: null,
      is_zyvo: kind === "zyvo" || (recipe.zyvo_position === "cta_only" && kind === "cta"),
    };
  });
  return {
    title: `DRY RUN · ${recipe.format} × ${recipe.style}`,
    topic: recipe.topic ?? "dry run topic",
    hook: `DRY RUN hook (${recipe.hook_type})`,
    hypothesis: `dry run: ${recipe.hook_type} hook with ${recipe.style}`,
    slides,
    tools_checked: slides.filter((s) => s.tool).map((s) => ({ name: s.tool.name, url: s.tool.url, source_url: "https://example.com" })),
    ai_label_required: false,
    why_it_could_go_viral: "dry run",
    virality_score: 5,
  };
}

export function mockPackage() {
  return {
    tiktok: { caption: "DRY RUN caption: which one would you try first?", hashtags: ["#aitools", "#dryrun", "#faceless"], on_screen_text: ["DRY RUN"] },
    instagram: { caption: "DRY RUN caption.\nMocked: nothing was spent.\nLink in bio → tryzyvo.com", hashtags: ["#aitools", "#dryrun", "#faceless", "#aivideo", "#contentcreator"] },
    youtube: { title: "DRY RUN title", description: "Mocked package. https://www.tryzyvo.com/", hashtags: ["#shorts", "#aitools", "#dryrun"] },
    sound_suggestion: "DRY RUN: a calm lo-fi trending sound",
    compliance: { ok: true, problems: [] },
  };
}
