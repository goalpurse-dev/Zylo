// deno-lint-ignore-file no-explicit-any
// stickman/headlines.ts — the on-screen text pass (Phase 6c-polish).
//
// Two kinds of text, decided per beat:
//   HEADLINE  — a stat, year, key word or the question, drawn by Zyvo's code
//               as an editable overlay layer on EVERY tier (Lilita One,
//               yellow + black outline, calmer band). Free to edit.
//   IN_SCENE  — words that belong inside the picture (a sign, a label, a book
//               title): V3/V4 draw it (exact string, <= 5 words, OCR-checked);
//               V2 draws the object blank.
// The Beat Director writes very few text beats (f90160bc: 2 of 148, 1.4%),
// so after it finishes this pass (one small model call) tops the plan up to
// the project's "On-screen text" density and classifies the director's own
// text beats. Everything the model returns is validated in code: <= 5 words,
// every word taken from that beat's narration (numbers and years included),
// never over the target.
// Text upgrade (after 6e): ~1 in 5 scenes by default, one call per window
// (enough candidates to reach the target), ranked by what keeps viewers
// watching (numbers > names > questions > reveals > contrasts > punch words),
// spread evenly (<= 2 text scenes in a row, ~1 per 15 s, denser in the hook)
// and drawn in four code styles: HEADLINE, BIG_STAT, QUESTION, CALLOUT.

export type TextKind = "HEADLINE" | "IN_SCENE";
export type TextStyle = "HEADLINE" | "BIG_STAT" | "QUESTION" | "CALLOUT";
export type TextCategory = "NUMBER" | "NAME" | "QUESTION" | "REVEAL" | "CONTRAST" | "PUNCH";
export const TEXT_SHARE: Record<string, number> = { minimal: 0.09, balanced: 0.2, frequent: 0.31 };
export const MAX_TEXT_WORDS = 5;
export const MAX_TEXT_RUN = 2; // never more than 2 text scenes in a row
export const TEXT_SLOT_MS = 15_000; // ideally at least one text scene per ~15 s
export const HOOK_MS = 30_000; // the hook gets text twice as often
export const CATEGORY_RANK: Record<TextCategory, number> = { NUMBER: 6, NAME: 5, QUESTION: 4, REVEAL: 3, CONTRAST: 2, PUNCH: 1 };

// Words that mark text as part of the picture itself (a sign, a label...).
const IN_SCENE_CUES = /\b(sign|signs|signpost|label|labell?ed|plaque|placard|banner|marquee|poster|book|cover|title|headline|newspaper|screen|monitor|tablet|map label|jar|bottle|box|crate|stamp|tag|note|letter|scroll|tombstone|inscription|carved)\b/i;
export function textKindOf(contract: any): TextKind {
  const k = contract?.textIntent?.kind;
  if (k === "HEADLINE" || k === "IN_SCENE") return k;
  if (contract?.textIntent?.mode === "PROGRAMMATIC") return "HEADLINE";
  return IN_SCENE_CUES.test(String(contract?.visualConcept ?? "")) ? "IN_SCENE" : "HEADLINE";
}

const norm = (s: string) => String(s ?? "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9%]+/g, " ").trim();
// Spoken numbers -> digits, so "SEVENTY THOUSAND YEARS" grounds "70,000 YEARS".
const UNITS: Record<string, number> = { ZERO: 0, ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7, EIGHT: 8, NINE: 9, TEN: 10, ELEVEN: 11, TWELVE: 12, THIRTEEN: 13, FOURTEEN: 14, FIFTEEN: 15, SIXTEEN: 16, SEVENTEEN: 17, EIGHTEEN: 18, NINETEEN: 19, TWENTY: 20, THIRTY: 30, FORTY: 40, FIFTY: 50, SIXTY: 60, SEVENTY: 70, EIGHTY: 80, NINETY: 90 };
const SCALES: Record<string, number> = { HUNDRED: 100, THOUSAND: 1000, MILLION: 1e6, BILLION: 1e9 };
export function spokenNumbersToDigits(normalized: string): string {
  const out: string[] = [];
  let total = 0, cur = 0, inNum = false;
  const flush = () => { if (inNum) out.push(String(total + cur)); total = 0; cur = 0; inNum = false; };
  for (const w of normalized.split(" ")) {
    if (w in UNITS) { cur += UNITS[w]; inNum = true; }
    else if (w in SCALES && inNum) { if (SCALES[w] === 100) cur *= 100; else { total += cur * SCALES[w]; cur = 0; } }
    else if (w === "AND" && inNum) continue;
    else { flush(); out.push(w); }
  }
  flush();
  return out.join(" ");
}
// Every word of the headline must come from the narration line (digits kept:
// "400,000" == "400000"); only the joining words of a contrast or question
// ("MYTH VS FACT", "BUT WHY?") may be added.
const FREE_WORDS = new Set(["VS", "BUT", "NOT", "OR", "AND", "SO"]);
export function groundedIn(text: string, narration: string): boolean {
  const line = ` ${spokenNumbersToDigits(norm(narration).replace(/(\d)\s+(?=\d{3}\b)/g, "$1"))} ${norm(narration).replace(/(\d)\s+(?=\d{3}\b)/g, "$1")} `;
  const words = norm(text).replace(/(\d)\s+(?=\d{3}\b)/g, "$1").split(" ").filter(Boolean);
  const inLine = (w: string) => line.includes(` ${w} `) || /^\d+%?$/.test(w) && line.includes(w);
  return words.some((w) => !FREE_WORDS.has(w) && inLine(w)) && words.every((w) => inLine(w) || FREE_WORDS.has(w));
}

export function textTarget(beatCount: number, density: string | null | undefined): number {
  return Math.round(beatCount * (TEXT_SHARE[String(density ?? "balanced")] ?? TEXT_SHARE.balanced));
}

// Spoken numbers shown as digits ("THIRTY METERS BACK" -> "30 METERS BACK",
// "SEVENTY THOUSAND YEARS" -> "70,000 YEARS"); small ones stay words ("ONE PERSON").
export function digitsForDisplay(text: string): string {
  const words = String(text ?? "").trim().split(/\s+/);
  const out: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (!run.length) return;
    const n = Number(spokenNumbersToDigits(run.join(" ")));
    out.push(Number.isFinite(n) && n >= 10 ? n.toLocaleString("en-US") : run.join(" "));
    run = [];
  };
  for (const w of words) {
    const u = w.toUpperCase();
    if (u in UNITS || (u in SCALES && run.length) || (u === "AND" && run.length && run.some((r) => r.toUpperCase() in SCALES))) run.push(w);
    else { flush(); out.push(w); }
  }
  flush();
  return out.join(" ");
}

export type HeadlinePick ={ sequence: number; text: string; category?: TextCategory | string; callout?: string | null };
const NUMBER_WORDS = /\b(hundred|thousand|million|billion|dozen|half|twice|percent)\b/i;
// The category is checked in code: a number/stat needs a number, a question a "?".
export function categoryOf(text: string, claimed?: string | null): TextCategory {
  const t = String(text ?? "").trim();
  if (/\d/.test(t) || NUMBER_WORDS.test(t)) return "NUMBER";
  if (/\?$/.test(t)) return "QUESTION";
  const c = String(claimed ?? "").toUpperCase();
  return c === "NAME" || c === "REVEAL" || c === "CONTRAST" ? c : "PUNCH";
}
// The drawing style follows from the words: a leading number with a short
// label is a BIG STAT, a question is a QUESTION, a named key object in the
// picture can be a CALLOUT (placed at render time; a HEADLINE if not found).
export function textStyleOf(text: string, callout?: string | null): TextStyle {
  const t = String(text ?? "").trim();
  if (/^[~≈]?\d[\d.,]*%?(\s|$)/.test(t) && t.split(/\s+/).length <= 3) return "BIG_STAT";
  if (/\?$/.test(t)) return "QUESTION";
  if (callout && String(callout).trim() && t.split(/\s+/).length <= 3) return "CALLOUT";
  return "HEADLINE";
}
export function headlineScore(text: string, category?: TextCategory, startMs = Infinity): number {
  const t = String(text ?? "").trim();
  const words = t.split(/\s+/).filter(Boolean).length;
  const cat = category ?? categoryOf(t);
  return CATEGORY_RANK[cat] * 10 + (words <= 2 ? 3 : words <= 3 ? 2 : 0) + (startMs < HOOK_MS ? 4 : 0) + (cat === "REVEAL" ? 2 : 0);
}

type PlanBeat = { sequence: number; narrationText: string; contract: any; startMs?: number };
const hasTextIntent = (b: any) => ["SHORT_TEXT", "PROGRAMMATIC"].includes(b.contract?.textIntent?.mode) && String(b.contract?.textIntent?.text ?? "").trim();
// Validate the model's picks against the plan (pure; tested), then choose:
// first the best candidate in every rhythm slot (one per ~15 s, half that in
// the hook) so text is spread evenly, then the best of the rest up to the
// target. Never more than 2 text scenes in a row; never on a beat whose
// picture already carries text (IN_SCENE) or that has text already.
export function acceptHeadlines(beats: PlanBeat[], picks: HeadlinePick[], density: string | null | undefined) {
  const target = textTarget(beats.length, density);
  const order = [...beats].sort((a, b) => a.sequence - b.sequence);
  const pos = new Map(order.map((b, i) => [b.sequence, i]));
  const at = (b: PlanBeat, i: number) => b.startMs ?? i * 4000;
  const taken = new Set(order.filter(hasTextIntent).map((b) => b.sequence));
  const bySeq = new Map(order.map((b) => [b.sequence, b]));
  const rejected: { sequence: number; text: string; why: string }[] = [];
  const seenText = new Set(order.filter(hasTextIntent).map((b) => norm(b.contract.textIntent.text)));
  const cands: (HeadlinePick & { category: TextCategory; score: number; ms: number })[] = [];
  for (const raw of picks) {
    const text = digitsForDisplay(String(raw.text ?? "").replace(/\s+/g, " ").replace(/\s+([?!])/g, "$1").trim().toUpperCase());
    // Re-anchor to the beat (±1) whose line actually holds the words (the model is sometimes off by one).
    const anchor = [raw.sequence, raw.sequence - 1, raw.sequence + 1].find((s) => bySeq.has(s) && groundedIn(text, bySeq.get(s)!.narrationText));
    const seq = anchor ?? raw.sequence;
    const b = bySeq.get(seq);
    const why = !b ? "no such beat" : taken.has(seq) ? "already has text"
      : !text || text.split(" ").length > MAX_TEXT_WORDS ? "over 5 words"
      // A caption, not a clause: no comma lists ("LONG LEGS, LONG TENDONS"); 4-5 words only for a question or a twist.
      : /,\s/.test(text) ? "a list or clause, not a caption"
      : text.split(" ").length > 3 && !["QUESTION", "REVEAL"].includes(categoryOf(text, raw.category)) ? "too long for this kind of caption"
      : !groundedIn(text, b.narrationText) ? "not from the narration"
      : seenText.has(norm(text)) ? "same words already on screen" : null;
    if (why) { rejected.push({ sequence: seq, text, why }); continue; }
    const category = categoryOf(text, raw.category);
    const ms = at(b!, pos.get(seq)!);
    cands.push({ sequence: seq, text, category, callout: raw.callout ?? null, score: headlineScore(text, category, ms), ms });
  }
  // One candidate per beat (the best), one beat per text.
  cands.sort((a, b) => b.score - a.score || a.sequence - b.sequence);
  const pool: typeof cands = [];
  for (const c of cands) {
    if (pool.some((p) => norm(p.text) === norm(c.text))) rejected.push({ sequence: c.sequence, text: c.text, why: "same words already on screen" });
    else if (!pool.some((p) => p.sequence === c.sequence)) pool.push(c);
  }
  const runOk = (seq: number) => {
    const i = pos.get(seq)!;
    const on = (j: number) => j >= 0 && j < order.length && taken.has(order[j].sequence);
    let left = 0, right = 0;
    while (on(i - left - 1)) left++;
    while (on(i + right + 1)) right++;
    return left + right + 1 <= MAX_TEXT_RUN;
  };
  const accepted: (HeadlinePick & { category: TextCategory; style: TextStyle })[] = [];
  const take = (c: (typeof cands)[number]) => { accepted.push({ sequence: c.sequence, text: c.text, category: c.category, callout: c.callout, style: textStyleOf(c.text, c.callout) }); taken.add(c.sequence); seenText.add(norm(c.text)); };
  // Pass 1 — rhythm: the best candidate in each empty slot. Slots are 7.5 s in
  // the hook and ~15 s after it — longer when the target can't fill 15 s
  // slots, so a low density still spreads over the WHOLE video.
  const lastMs = order.length ? at(order[order.length - 1], order.length - 1) : 0;
  const hookSlots = Math.ceil(Math.min(HOOK_MS, lastMs + 1) / (TEXT_SLOT_MS / 2));
  const bodyMs = Math.max(TEXT_SLOT_MS, (lastMs - HOOK_MS) / Math.max(1, target - hookSlots));
  const slotOf = (ms: number) => (ms < HOOK_MS ? Math.floor(ms / (TEXT_SLOT_MS / 2)) : hookSlots + Math.floor((ms - HOOK_MS) / bodyMs));
  const filled = new Set(order.filter((b) => taken.has(b.sequence)).map((b) => slotOf(at(b, pos.get(b.sequence)!))));
  for (let s = 0; s <= slotOf(lastMs) && taken.size < target; s++) {
    if (filled.has(s)) continue;
    const c = pool.find((x) => slotOf(x.ms) === s && !taken.has(x.sequence) && runOk(x.sequence));
    if (c) { take(c); filled.add(s); }
  }
  // Pass 2 — the best of the rest, up to the target.
  for (const c of pool) {
    if (taken.size >= target) break;
    if (taken.has(c.sequence) || accepted.some((a) => a.sequence === c.sequence)) continue;
    if (!runOk(c.sequence)) { rejected.push({ sequence: c.sequence, text: c.text, why: "3 text scenes in a row" }); continue; }
    take(c);
  }
  for (const c of pool) if (!taken.has(c.sequence) && !rejected.some((r) => r.sequence === c.sequence)) rejected.push({ sequence: c.sequence, text: c.text, why: "over the target" });
  accepted.sort((a, b) => a.sequence - b.sequence);
  return { target, accepted, rejected, total: taken.size };
}

// Apply: headline picks become HEADLINE text beats (with their style); the
// director's own text beats get their kind (and a style when they are headlines).
export function applyTextPass(beats: any[], accepted: HeadlinePick[]) {
  const add = new Map(accepted.map((p) => [p.sequence, p]));
  return beats.map((b) => {
    const t = b.contract?.textIntent ?? { mode: "NO_TEXT", text: null };
    const p = add.get(b.sequence);
    if (p) return { ...b, contract: { ...b.contract, textIntent: { mode: "SHORT_TEXT", text: p.text, kind: "HEADLINE", style: textStyleOf(p.text, p.callout), category: categoryOf(p.text, p.category), ...(p.callout ? { callout: p.callout } : {}) } } };
    if (["SHORT_TEXT", "PROGRAMMATIC"].includes(t.mode) && t.text) {
      const kind = textKindOf(b.contract);
      return { ...b, contract: { ...b.contract, textIntent: { ...t, kind, ...(kind === "HEADLINE" && !t.style ? { style: textStyleOf(t.text) } : {}) } } };
    }
    return b;
  });
}

const CATEGORIES: TextCategory[] = ["NUMBER", "NAME", "QUESTION", "REVEAL", "CONTRAST", "PUNCH"];
const SCHEMA = { type: "object", additionalProperties: false, required: ["picks"], properties: { picks: { type: "array", items: { type: "object", additionalProperties: false, required: ["s", "t", "k", "o"], properties: { s: { type: "integer" }, t: { type: "string" }, k: { type: "string", enum: CATEGORIES }, o: { type: "string" } } } } } };
export const HEADLINE_MODEL = "gpt-4o-mini";
export const HEADLINE_WINDOW = 40; // beats per call

export function headlinePrompt(beats: PlanBeat[], want: number) {
  const lines = beats.map((b) => {
    const t = b.contract?.textIntent;
    const mark = t?.text ? (textKindOf(b.contract) === "IN_SCENE" ? ` [PICTURE WORDS: ${t.text}]` : ` [HAS TEXT: ${t.text}]`) : "";
    const ms = b.startMs != null ? ` (${Math.round(b.startMs / 1000)}s)` : "";
    return `${b.sequence}${ms}${mark}: ${b.narrationText}  || picture: ${String(b.contract?.visualConcept ?? "").slice(0, 110)}`;
  }).join("\n");
  return [
    `You pick ON-SCREEN TEXT for a narrated stickman explainer video — the short captions YouTube explainers flash on screen to keep viewers watching. Return ${want} candidates from the beats below (beat number + text + category), spread across all of them; code keeps the best.`,
    `Best first: (1) NUMBER — numbers, stats, dates, distances ("300,000 YEARS", "27%", "2 METERS"); (2) NAME — places, people, finds ("SCHÖNINGEN"); (3) QUESTION — the core question and rhetorical questions ("BUT WHY?"); (4) REVEAL — reveals and twists ("NOT HUNTED — SCAVENGED"); (5) CONTRAST — myth vs fact, then vs now ("MYTH VS FACT"); (6) PUNCH — key punch words from the opening and the closer.`,
    `Rules: 1-3 words (4-5 ONLY for a QUESTION or a REVEAL); no commas, no clauses; copy the words EXACTLY from that beat's own line (digits and spelling as written; only VS / BUT / NOT / OR may be added); never on a [PICTURE WORDS] or [HAS TEXT] beat; never a sentence fragment or filler; the hook (first 30 s) and the big reveals deserve more text.`,
    `"o": when the text names ONE key object that the beat's picture clearly shows (e.g. "SPEAR" with a picture of a spear), give that object in 1-3 plain words so an arrow can point at it; otherwise "".`,
    `Return {"picks":[{"s":<beat>,"t":"<text>","k":"<category>","o":"<object or empty>"}]}.`,
    "",
    lines,
  ].join("\n");
}

async function askOnce(openaiKey: string, beats: PlanBeat[], want: number) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: HEADLINE_MODEL, temperature: 0.2, messages: [{ role: "user", content: headlinePrompt(beats, want) }], response_format: { type: "json_schema", json_schema: { name: "headlines", strict: true, schema: SCHEMA } } }),
  });
  const j: any = await res.json();
  if (!res.ok) throw new Error(`headlines ${res.status}`);
  const out = JSON.parse(j.choices[0].message.content);
  return { picks: (out.picks ?? []).map((p: any) => ({ sequence: Number(p.s), text: String(p.t ?? ""), category: p.k, callout: String(p.o ?? "").trim() || null })) as HeadlinePick[], inputTokens: j.usage.prompt_tokens as number, outputTokens: j.usage.completion_tokens as number };
}

// One call per window of ~40 beats (in parallel), each asked for ~2x its
// share of the target, so the candidates reach the target; one top-up round
// over the whole plan only if still well short.
export const HEADLINE_ROUNDS = 2;
export async function pickHeadlines(openaiKey: string, beats: PlanBeat[], density: string | null | undefined) {
  const target = textTarget(beats.length, density);
  const share = TEXT_SHARE[String(density ?? "balanced")] ?? TEXT_SHARE.balanced;
  const usage = { inputTokens: 0, outputTokens: 0, calls: 0 };
  const windows: PlanBeat[][] = [];
  for (let i = 0; i < beats.length; i += HEADLINE_WINDOW) windows.push(beats.slice(i, i + HEADLINE_WINDOW));
  // A short last window joins the one before it.
  if (windows.length > 1 && windows[windows.length - 1].length < HEADLINE_WINDOW / 3) windows[windows.length - 2].push(...windows.pop()!);
  const results = await Promise.all(windows.map((w) => askOnce(openaiKey, w, Math.max(4, Math.ceil(w.length * share * 2)))));
  let picks: HeadlinePick[] = [];
  for (const r of results) { usage.inputTokens += r.inputTokens; usage.outputTokens += r.outputTokens; usage.calls++; picks = [...picks, ...r.picks]; }
  const acc = acceptHeadlines(beats, picks, density);
  const short = target - acc.total;
  if (HEADLINE_ROUNDS > 1 && short > Math.max(2, Math.round(target * 0.15))) {
    const r = await askOnce(openaiKey, applyTextPass(beats, acc.accepted), Math.ceil(short * 2));
    usage.inputTokens += r.inputTokens; usage.outputTokens += r.outputTokens; usage.calls++;
    picks = [...picks, ...r.picks];
  }
  return { picks, usage, costUsd: (usage.inputTokens * 0.15 + usage.outputTokens * 0.6) / 1e6 };
}

// Where the text may go on a finished picture: one cheap low-detail look
// (~$0.0005) returns the faces to keep clear and, for a CALLOUT, the key
// object's box. Boxes are 0..1 fractions [x0, y0, x1, y1]. Never throws.
const LOOK_SCHEMA = { type: "object", additionalProperties: false, required: ["faces", "target"], properties: { faces: { type: "array", items: { type: "array", items: { type: "number" } } }, target: { type: "array", items: { type: "number" } } } };
export async function placementLook(openaiKey: string, imageUrl: string, callout?: string | null): Promise<{ faces: number[][]; target: number[] | null; costUsd: number } | null> {
  try {
    const prompt = [
      "A 16:9 cartoon frame. Give bounding boxes as fractions of the frame width/height: [x0, y0, x1, y1], 0..1, origin top-left.",
      "faces: every face/head (stick-figure circle heads, animal heads included). Be generous; [] if none.",
      callout ? `target: the box of the ${callout} — ONLY if it is clearly visible and unambiguous; otherwise [].` : "target: [].",
    ].join("\n");
    const res = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: HEADLINE_MODEL, temperature: 0, messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageUrl, detail: "low" } }] }], response_format: { type: "json_schema", json_schema: { name: "look", strict: true, schema: LOOK_SCHEMA } } }) });
    const j: any = await res.json();
    if (!res.ok) return null;
    const out = JSON.parse(j.choices[0].message.content);
    const box = (b: any) => Array.isArray(b) && b.length === 4 && b.every((v) => Number.isFinite(v) && v >= 0 && v <= 1) && b[2] > b[0] && b[3] > b[1] ? b.map(Number) : null;
    return { faces: (out.faces ?? []).map(box).filter(Boolean), target: box(out.target), costUsd: (j.usage.prompt_tokens * 0.15 + j.usage.completion_tokens * 0.6) / 1e6 };
  } catch {
    return null;
  }
}
