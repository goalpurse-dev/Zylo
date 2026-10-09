// The upload package on the final screen: a viral title, a caption, a
// pinned-comment question that sparks debate, and 5–8 hashtags. Written by
// the small-task model (gpt-5-mini, ≈ $0.001, logged), free for the user,
// made once per story and saved (blocky_stories.upload_package).
import { callLlm } from "./llm.js";
import { BLOCKY_MODELS } from "./models.js";
import { UPLOAD_SYSTEM, cleanUpload, uploadSchema } from "./rules.js";

export const PACKAGE_PURPOSE = "upload_package";

/** The rules, the answer shape and the cleaning (every cap enforced in code) are in rules.js. */
export const PACKAGE_SYSTEM = UPLOAD_SYSTEM;
export const packageSchema = uploadSchema;
export const cleanPackage = cleanUpload;

/** @param {{title, lines: {speaker, line}[], roles?: object, twist?: string, episode?: {number, nextNumber?, nextTitle?, seriesTitle}}} p */
export function packagePrompt(p) {
  const parts = [`VIDEO TITLE: ${p.title}`, `THE LINES, IN ORDER:\n${p.lines.map((l) => `${l.speaker}: ${l.line}`).join("\n")}`];
  if (p.roles && Object.keys(p.roles).length) parts.push(`ROLES: ${Object.entries(p.roles).map(([k, v]) => `${k} is ${v}`).join("; ")}`);
  if (p.twist) parts.push(`THE TWIST (keep it secret: the title, the description and the caption tease it and never give it away): ${p.twist}`);
  if (p.episode) {
    parts.push(`This is episode ${p.episode.number} of the series "${p.episode.seriesTitle}".${p.episode.nextTitle ? ` The next episode is Part ${p.episode.nextNumber}: "${p.episode.nextTitle}"; the caption must point to it.` : " It is the last episode for now."}`);
  }
  return parts.join("\n\n");
}

/** Writes the package; logs the call. Throws when the model can't produce a usable one. */
export async function writeUploadPackage({ admin, apiKey, input, ids, fetchLlm = callLlm }) {
  const model = BLOCKY_MODELS.small;
  const t0 = Date.now();
  try {
    const ask = (user) => fetchLlm({ provider: model.provider, model: model.model, apiKey, system: PACKAGE_SYSTEM, user, schema: packageSchema(), name: "upload_package", maxOutputTokens: 3000, timeoutMs: 45_000 });
    const log = (r, problems) => admin.from("blocky_ai_calls").insert({
      ...ids, provider: model.provider, model: model.model, purpose: PACKAGE_PURPOSE, request: r.request, response: r.response,
      http_status: r.httpStatus, ok: problems.length === 0, error: problems.join("; ") || null, cost_usd: r.costUsd,
      input_tokens: r.usage?.inputTokens ?? null, output_tokens: r.usage?.outputTokens ?? null, latency_ms: r.latencyMs ?? null, completed_at: new Date().toISOString(),
    });
    const first = await ask(packagePrompt(input));
    let { pkg, problems } = cleanPackage(first.data);
    await log(first, problems);
    let costUsd = Number(first.costUsd) || 0;
    if (problems.length) {
      // One more try, told exactly what was wrong (keywords after a dash in the title, a cap passed...).
      const second = await ask(`${packagePrompt(input)}\n\nYOUR PREVIOUS ANSWER:\n${JSON.stringify(first.data)}\n\nIT BREAKS THESE RULES. Fix every one and answer again in full:\n- ${problems.join("\n- ")}`);
      ({ pkg, problems } = cleanPackage(second.data));
      await log(second, problems);
      costUsd += Number(second.costUsd) || 0;
    }
    if (problems.length) throw new Error(problems.join("; "));
    return { ...pkg, costUsd };
  } catch (e) {
    if (!e?.details) throw e;
    await admin.from("blocky_ai_calls").insert({ ...ids, provider: model.provider, model: model.model, purpose: PACKAGE_PURPOSE, request: e.details.request ?? {}, ok: false, error: String(e.message).slice(0, 300), cost_usd: e.details.costUsd ?? 0, latency_ms: Date.now() - t0, completed_at: new Date().toISOString() });
    throw e;
  }
}
