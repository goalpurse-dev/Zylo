// Blocky Worlds shot review: the AI judge. A batch of narration lines, each with its stills (labelled by shot) and
// what it must show (from the story, lib/vision/requirements.js), goes to Claude in ONE request; the reply
// (structured outputs, json_schema) is a strict per-line verdict: what the frames really show, each check, the miss
// types, which shots are wrong and a concrete fix. The call shape, prices and cost logging are the builder's
// (lib/builder/design.js callClaude / costOf / PRICE): one place for both.
//   anthropicJudge({ apiKey, model, effort }) -> { name, model, judge(batch) -> { data: { lines: [verdict] }, costUsd, ms, usage }, worstCase(batch) }
//   normalizeVerdict(raw, item) -> verdict (never throws; the verdict follows from the checks)
//   batchesOf(items, { size, maxImages }) -> [[item]]
// item = { line, text, prevText, who, people, nouns, place, time, emotion, action, moving, stills: [{ key, shot, jpeg, w, h }] }
import { callClaude, PRICE } from "../builder/design.js";

export const REVIEW_MODELS = Object.freeze({ default: "claude-haiku-5-5", strict: "claude-sonnet-5-5" });
export const MISS_TYPES = Object.freeze(["wrong_character", "missing_object", "missing_crowd", "wrong_action", "static_pose", "wrong_place", "wrong_time", "wrong_emotion", "picture_card", "subject_hidden", "other"]);
export const VERDICTS = Object.freeze(["match", "partial", "miss"]);

/** image tokens Claude bills for a still (width x height / 750; a 432 x 768 still = 443) */
export const imageTokens = (w, h) => Math.ceil((w * h) / 750);
/** text tokens, roughly (4 characters a token) */
export const textTokens = (s) => Math.ceil(String(s ?? "").length / 4);

export const JUDGE_SYSTEM = `You are the strict frame reviewer for "Blocky Worlds", 9:16 story videos made of blocky toy-like 3D people and
places, narrated line by line. Each narration line is shown by one or more shots; you see the frames of those shots
(labelled with their shot ids) and say, line by line, whether a viewer who hears the line SEES it on screen.

How to judge (be strict: a viewer gets under 2 seconds per line):
- First describe what the frames really show (who, how many, what they do, the things, the place, day or night),
  without trusting the line or the labels. Then compare.
- WHO: the line is about someone or something (the "who" given, else read it from the line; "I / me / my" is the
  narrator; resolve "he / she / they / his" from the line before). That subject must be clearly visible and the focus
  of at least one frame, matching the hint (a kid vs an adult, a woman vs a man, an old person, a crowd, an animal).
  A different person in focus, the wrong age or gender, or the subject a tiny speck = not ok. A name that is really a
  pronoun or a word ("Grandpa His") is not a person: judge against what the line means.
- THINGS: every key noun of the line (the listed ones AND the important nouns in the line text) must be visible as
  that thing at phone size. A random similar object, a tiny speck, or only a word on a card/sign counts as missing
  (list it in missing). A picture card (an icon + a word on a board) is at best partial (type picture_card).
- ACTION: the line's main verb must be performed by the right one (carried off = being carried by someone; march =
  marching; listen = listening pose). Standing still with a neutral face for an action line = static_pose. With two
  frames of one shot (a / b), static means nothing moved between them.
- PLACE: the frames must be in the story's place (the "place" given; "inside a giant turtle" = under/inside the shell,
  not an ordinary street, school or bedroom), unless the line itself names another place.
- TIME: day vs night must fit ("time" given, or the line's words: night, dark, torch, dawn).
- EMOTION: when the line states a feeling, the faces should show it (a neutral face for "scared" = wrong_emotion).
Verdict: match = everything the line needs is on screen and clear; partial = the subject and place are right but
something the line names is missing or wrong; miss = the wrong subject, the wrong place, or most of what the line says
is not shown. List every miss type that applies. bad_shots = the shot ids that are wrong (empty for a match).
fix = one or two concrete changes in plain words (who to show, which thing to add / hold, which pose, which place / time).`;

const str = { type: "string" };
export function judgeSchema() {
  const line = {
    type: "object", additionalProperties: false,
    required: ["line", "shows", "who_ok", "missing", "action_ok", "static", "place_ok", "time_ok", "emotion_ok", "card", "verdict", "types", "bad_shots", "fix"],
    properties: {
      line: { type: "integer" }, shows: str,
      who_ok: { type: "boolean" }, missing: { type: "array", items: str },
      action_ok: { type: "boolean" }, static: { type: "boolean" }, place_ok: { type: "boolean" }, time_ok: { type: "boolean" }, emotion_ok: { type: "boolean" },
      card: { type: "boolean" }, verdict: { type: "string", enum: [...VERDICTS] },
      types: { type: "array", items: { type: "string", enum: [...MISS_TYPES] } }, bad_shots: { type: "array", items: str }, fix: str,
    },
  };
  return { type: "object", additionalProperties: false, required: ["lines"], properties: { lines: { type: "array", items: line } } };
}

/** the text block of one line (what it must show) */
export function itemText(it) {
  const req = [
    it.who ? `who: ${it.who.name}${it.who.hint ? ` (${it.who.hint})` : ""}` : "who: read it from the line",
    it.people?.length ? `also people: ${it.people.join("; ")}` : "",
    it.nouns?.length ? `things: ${it.nouns.join(", ")} (and any key noun in the line)` : "things: the key nouns in the line",
    it.action ? `action: ${it.action}${it.moving ? " (movement)" : ""}` : "",
    it.place ? `place: ${it.place}` : "", it.time ? `time: ${it.time}` : "", it.emotion ? `feeling: ${it.emotion}` : "",
  ].filter(Boolean).join(" | ");
  return [`LINE ${it.line}: "${it.text}"`, it.prevText ? `(line before: "${it.prevText}")` : "", `Must show -> ${req}`, `Frames: ${it.stills.map((s) => s.key).join(", ")}`].filter(Boolean).join("\n");
}

/** the content blocks of a batch: per line, its text, then each frame as "frame <key>" + the image */
export function batchContent(batch, { premise = null } = {}) {
  const content = [];
  content.push({ type: "text", text: [premise ? `The story's premise: ${premise}` : "", `${batch.length} lines follow. Answer every line, in order, with its line number.`].filter(Boolean).join("\n") });
  for (const it of batch) {
    content.push({ type: "text", text: itemText(it) });
    for (const s of it.stills) {
      content.push({ type: "text", text: `frame ${s.key} (shot ${s.shot})` });
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: Buffer.from(s.jpeg).toString("base64") } });
    }
  }
  return content;
}

/** batches of lines: at most `size` lines and `maxImages` frames a request (a line's frames stay together) */
export function batchesOf(items, { size = 8, maxImages = 14 } = {}) {
  const out = [];
  let cur = [], imgs = 0;
  for (const it of items) {
    const n = it.stills.length;
    if (cur.length && (cur.length >= size || imgs + n > maxImages)) { out.push(cur); cur = []; imgs = 0; }
    cur.push(it); imgs += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** output ceiling of one request (thinking included at effort low): bounds the worst case */
export const maxTokensFor = (batch) => Math.min(12000, 2000 + 450 * batch.length);
/** input tokens of a request (system + texts + images), estimated before it is sent */
export function inputTokens(batch, { premise = null } = {}) {
  let t = textTokens(JUDGE_SYSTEM) + 120 + textTokens(premise);
  for (const it of batch) { t += textTokens(itemText(it)); for (const s of it.stills) t += imageTokens(s.w ?? 432, s.h ?? 768) + 12; }
  return t;
}
/** the most a request can cost: every input token written to the cache (the dearest input rate) + every output token */
export function worstCaseUsd(model, batch, opts = {}) {
  const p = PRICE[model] ?? PRICE["claude-sonnet-5-5"];
  return Number(((inputTokens(batch, opts) * Math.max(p.input, p.cacheWrite) + maxTokensFor(batch) * p.output) / 1e6).toFixed(5));
}

const bool = (v, d = true) => (typeof v === "boolean" ? v : d);
/**
 * A verdict that follows from its checks (never throws): a model's "match" with a failed check is partial; a "miss" or
 * "partial" with every check ok and nothing missing is a match; the types always include each failed check.
 */
export function normalizeVerdict(raw, item) {
  const r = raw && typeof raw === "object" ? raw : {};
  const keys = new Set((item?.stills ?? []).map((s) => s.key));
  const shotOfKey = new Map((item?.stills ?? []).map((s) => [s.key, s.shot]));
  const v = {
    line: item?.line ?? (Number.isInteger(r.line) ? r.line : -1),
    shows: String(r.shows ?? "").slice(0, 400),
    who_ok: bool(r.who_ok), missing: (Array.isArray(r.missing) ? r.missing : []).map((x) => String(x).slice(0, 60)).filter(Boolean).slice(0, 8),
    action_ok: bool(r.action_ok), static: bool(r.static, false), place_ok: bool(r.place_ok), time_ok: bool(r.time_ok), emotion_ok: bool(r.emotion_ok), card: bool(r.card, false),
    verdict: VERDICTS.includes(r.verdict) ? r.verdict : "miss",
    types: [...new Set((Array.isArray(r.types) ? r.types : []).filter((t) => MISS_TYPES.includes(t)))],
    fix: String(r.fix ?? "").slice(0, 400),
  };
  // the shots named wrong: a frame key ("L3-s7a") or a shot id ("s7", "7") -> shot index; only this line's shots
  const own = new Set((item?.stills ?? []).map((s) => s.shot));
  v.bad_shots = [...new Set((Array.isArray(r.bad_shots) ? r.bad_shots : []).map((k) => { const s = String(k); if (keys.has(s)) return shotOfKey.get(s); const m = s.match(/s?(\d+)[ab]?$/); return m ? Number(m[1]) : null; }).filter((x) => x != null && own.has(x)))];
  const failed = [];
  if (!v.who_ok) failed.push("wrong_character");
  if (v.missing.length) failed.push(v.types.includes("missing_crowd") && !v.types.includes("missing_object") ? "missing_crowd" : "missing_object");
  if (!v.action_ok) failed.push(v.static ? "static_pose" : "wrong_action");
  else if (v.static && item?.moving) failed.push("static_pose");
  if (!v.place_ok) failed.push("wrong_place");
  if (!v.time_ok) failed.push("wrong_time");
  if (!v.emotion_ok) failed.push("wrong_emotion");
  if (v.card) failed.push("picture_card");
  for (const t of failed) if (!v.types.includes(t)) v.types.push(t);
  const anyFail = failed.length > 0 || v.types.some((t) => t !== "other");
  if (!anyFail) { v.verdict = "match"; v.types = []; }
  else if (v.verdict === "match") v.verdict = "partial";
  if (!v.who_ok && !v.place_ok) v.verdict = "miss";
  if (v.verdict !== "match" && !v.bad_shots.length) v.bad_shots = [...own];
  if (v.verdict === "match") v.bad_shots = [];
  return v;
}

/** the reply's lines matched to the batch's items by line number (a missing line: an "unjudged" verdict) */
export function verdictsOf(data, batch) {
  const got = new Map((Array.isArray(data?.lines) ? data.lines : []).map((x) => [x?.line, x]));
  return batch.map((it) => (got.has(it.line) ? normalizeVerdict(got.get(it.line), it) : { line: it.line, verdict: "unjudged", types: [], bad_shots: [], missing: [], fix: "", shows: "", reason: "the judge did not answer this line" }));
}

/** the paid judge (Claude, structured outputs, low effort). Haiku 5.5 by default; Sonnet 5.5 for the strict option */
export function anthropicJudge({ apiKey, model = REVIEW_MODELS.default, effort = "low", premise = null, fetchFn = fetch, timeoutMs = 90000 } = {}) {
  return {
    name: "anthropic", model,
    async judge(batch) {
      const r = await callClaude({ apiKey, model, system: JUDGE_SYSTEM, content: batchContent(batch, { premise }), schema: judgeSchema(), effort, maxTokens: maxTokensFor(batch), timeoutMs, fetchFn });
      return { ...r, lines: verdictsOf(r.data, batch) };
    },
    worstCase: (batch) => worstCaseUsd(model, batch, { premise }),
  };
}
