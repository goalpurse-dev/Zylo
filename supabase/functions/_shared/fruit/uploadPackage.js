// The upload package on the final screen: a viral title, a caption, a
// pinned-comment question that sparks debate, and 5–8 hashtags. Written by
// the small-task model (gpt-5-mini, ≈ $0.001, logged), free for the user,
// made once per story and saved (fruit_stories.upload_package).
import { callLlm } from "./llm.js";
import { FRUIT_MODELS } from "./models.js";
import { hooksOf } from "./niches/index.js";

export const PACKAGE_PURPOSE = "upload_package";

export const PACKAGE_SYSTEM = `You write the text that goes with a short vertical drama video (TikTok, Reels, Shorts) starring anthropomorphic fruit characters.
- title: a NEW scroll-stopping title, 3 to 9 words, never the video title as given (write a hook: a question, a reveal, a dare), no hashtags, no emojis.
- caption: 1 or 2 short sentences that tease the drama without spoiling the twist. For a series episode, end by pointing to the next episode (use its title when given).
- pinnedComment: ONE question for the creator to pin that makes viewers pick a side (e.g. "Was Mia right to read the texts?"). No hashtags.
- hashtags: 5 to 8 hashtags, lowercase, each starting with #, no spaces: a mix of broad (#fruitdrama, #aistory) and specific to this story.
Plain words, no quotes around fields, nothing about real people or brands. Answer only with the JSON object.`;

export function packageSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "caption", "pinnedComment", "hashtags"],
    properties: { title: { type: "string" }, caption: { type: "string" }, pinnedComment: { type: "string" }, hashtags: { type: "array", items: { type: "string" } } },
  };
}

/** @param {{title, lines: {speaker, line}[], roles?: object, episode?: {number, nextNumber?, nextTitle?, seriesTitle}}} p */
export function packagePrompt(p) {
  const parts = [`VIDEO TITLE: ${p.title}`, `THE LINES, IN ORDER:\n${p.lines.map((l) => `${l.speaker}: ${l.line}`).join("\n")}`];
  if (p.roles && Object.keys(p.roles).length) parts.push(`ROLES: ${Object.entries(p.roles).map(([k, v]) => `${k} is ${v}`).join("; ")}`);
  if (p.episode) {
    parts.push(`This is episode ${p.episode.number} of the series "${p.episode.seriesTitle}".${p.episode.nextTitle ? ` The next episode is Part ${p.episode.nextNumber}: "${p.episode.nextTitle}"; the caption must point to it.` : " It is the last episode for now."}`);
  }
  return parts.join("\n\n");
}

/** Cleans the model's answer; returns {pkg, problems}. */
export function cleanPackage(data) {
  const problems = [];
  const tags = [...new Set((data?.hashtags ?? []).map((t) => `#${String(t).trim().replace(/^#+/, "").replace(/\s+/g, "").toLowerCase()}`).filter((t) => /^#[a-z0-9_]{2,40}$/.test(t)))].slice(0, 8);
  if (tags.length < 5) problems.push("hashtags: 5 to 8 needed");
  const pkg = {
    title: String(data?.title ?? "").trim(),
    caption: String(data?.caption ?? "").trim(),
    pinnedComment: String(data?.pinnedComment ?? "").trim(),
    hashtags: tags,
  };
  if (!pkg.title) problems.push("title missing");
  if (!pkg.caption) problems.push("caption missing");
  if (!pkg.pinnedComment.endsWith("?")) problems.push("pinnedComment must be a question");
  return { pkg, problems };
}

/** Writes the package; logs the call. Throws when the model can't produce a usable one. */
export async function writeUploadPackage({ admin, apiKey, input, ids, niche, fetchLlm = callLlm }) {
  // niche: the template (niches/); its own {system}, or nothing = Fruit's above.
  const system = hooksOf(niche, "upload")?.system ?? PACKAGE_SYSTEM;
  const model = FRUIT_MODELS.small;
  const t0 = Date.now();
  try {
    const r = await fetchLlm({ provider: model.provider, model: model.model, apiKey, system, user: packagePrompt(input), schema: packageSchema(), name: "upload_package", maxOutputTokens: 3000, timeoutMs: 45_000 });
    const { pkg, problems } = cleanPackage(r.data);
    await admin.from("fruit_ai_calls").insert({
      ...ids, provider: model.provider, model: model.model, purpose: PACKAGE_PURPOSE, request: r.request, response: r.response,
      http_status: r.httpStatus, ok: problems.length === 0, error: problems.join("; ") || null, cost_usd: r.costUsd,
      input_tokens: r.usage?.inputTokens ?? null, output_tokens: r.usage?.outputTokens ?? null, latency_ms: r.latencyMs ?? null, completed_at: new Date().toISOString(),
    });
    if (problems.length) throw new Error(problems.join("; "));
    return { ...pkg, costUsd: r.costUsd };
  } catch (e) {
    if (!e?.details) throw e;
    await admin.from("fruit_ai_calls").insert({ ...ids, provider: model.provider, model: model.model, purpose: PACKAGE_PURPOSE, request: e.details.request ?? {}, ok: false, error: String(e.message).slice(0, 300), cost_usd: e.details.costUsd ?? 0, latency_ms: Date.now() - t0, completed_at: new Date().toISOString() });
    throw e;
  }
}
