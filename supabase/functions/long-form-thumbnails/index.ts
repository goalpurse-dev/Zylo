// deno-lint-ignore-file no-explicit-any
// long-form-thumbnails/index.ts — YouTube thumbnails for a Stickman video (Thumbnail V2).
//   list      (user) — the newest batch of 3 (+ what a regenerate costs).
//   start     (user) — the FIRST batch is included (the Publish autopilot makes
//                      it); regenerate: true makes 3 more for 3 credits per
//                      image (every tier), refunded per image that fails.
//   headline  (user) — edit the words (free): re-drawn by code.
//   select    (user) — the one to download / use.
//   draw   (internal) — one image (see stickman/thumbnailV2.ts):
//     concept (made at start: ONE Sonnet call over the title, script, story
//     plan and Production Bible -> 3 concepts, each a different archetype)
//     -> Nano Banana 2 Lite (every tier) -> 2x upscale -> 1920x1080
//     -> free checks (top third clear, face >= 8%, contrast >= 0.35, no grey room)
//        + one look (no words, no extras or blank heads, the hook object visible)
//     -> ONE re-render if a check fails (its own invocation), the best kept (flagged if it still fails)
//     -> the headline drawn by code (Lilita One, top third) -> 1920x1080 + 1280x720 (<= 2 MB).
//   A draw whose worker was killed (no error ever reaches its catch) is caught by
//   the watchdog in list/start: re-dispatched once, then failed -> "Try again (free)".
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { drawLayer } from "../_shared/stickman/textOverlay.ts";
import { canonicalSetFromBible, castBlock } from "../_shared/stickman/promptCompiler.ts";
import { tierOf } from "../_shared/stickman/scenes.ts";
import { IP_MARKS } from "../_shared/stickman/beatDirector.ts";
import { NOT_ENOUGH_CREDITS } from "../_shared/stickman/addons.ts";
import { ARCHETYPES, ARCHETYPE_DEFINITIONS, BACKGROUND_STYLE, clearTopThird, packFewShot, THUMB_MODEL, THUMB_GEN, THUMB_OUT, THUMB_MAX_BYTES, checkThumb, headlineLayerV2, normalizeConcepts, thumbnailPromptV2, titleWords, type ThumbConcept, type ThumbLook } from "../_shared/stickman/thumbnailV2.ts";
import { recordCost } from "../_shared/costLedger.ts";
import { logEvent } from "../_shared/systemLog.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("LONG_FORM_AUTOPILOT_SECRET") ?? "";
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const FONT_URL = `${SUPABASE_URL}/storage/v1/object/public/generated/assets/fonts/LilitaOne-Regular.ttf`;
// 3 credits per regenerated image on every tier (one model for all: Nano Banana 2 Lite).
// Phase 7: ~$0.064 real cost per regenerated image -> 6 credits (~50% margin at the cheapest $/credit).
export const THUMB_CREDITS: Record<string, number> = { V2: 6, V3: 6, V4: 6 };
// The concept call: Sonnet 5 (gpt-5-mini concepts were generic). $2 / $10 per 1M tokens.
const CONCEPT_MODEL = "claude-sonnet-5";
const SONNET_IN_PER_M = 2.0, SONNET_OUT_PER_M = 10.0;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
let fontBytes: Uint8Array | null = null;
const fetchBytes = async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error(`fetch ${r.status}`); return new Uint8Array(await r.arrayBuffer()); };
const runware = async (task: any) => {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/runware-bakeoff-proxy`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ task }) });
  const j: any = await r.json().catch(() => null);
  if (!j?.ok) throw new Error(`runware ${task.taskType} ${r.status}`);
  return { url: j.result.imageURL as string, cost: Number(j.result.cost ?? 0) };
};
const headlineOf = (s: string) => String(s ?? "").replace(/\s+/g, " ").trim().toUpperCase().split(" ").slice(0, 4).join(" ");

/* ---------------- concepts: ONE cheap LLM call over this video ---------------- */

export async function makeConcepts(project: any, projectId: string) {
  const { data: script } = await admin.from("long_form_script_versions").select("script_document").eq("id", project.current_script_version_id).maybeSingle();
  const sd = script?.script_document ?? {};
  const { data: plan } = project.current_story_plan_version_id ? await admin.from("long_form_story_plan_versions").select("story_plan").eq("id", project.current_story_plan_version_id).maybeSingle() : { data: null };
  const sp = plan?.story_plan ?? {};
  const { data: meta } = await admin.from("long_form_publish_meta").select("title").eq("project_id", projectId).maybeSingle();
  const { data: bibleRow } = await admin.from("long_form_production_bibles").select("bible").eq("project_id", projectId).eq("script_version_id", project.current_script_version_id).eq("status", "frozen").maybeSingle();
  const set = canonicalSetFromBible(bibleRow?.bible ?? {});
  const castIds = Object.keys(set.cast);
  const title = meta?.title ?? project.selected_title ?? sp.recommendedTitle ?? sd.title ?? project.topic ?? "";
  // The video's MAIN QUESTION: the idea the viewer chose (else the title). Every thumbnail is about this.
  const mainQuestion = String(project.selected_idea_title ?? project.selected_title ?? title ?? "").trim();
  const segs = sd.narrationSegments ?? [];
  const chapters = (sd.chapters ?? []).map((c: any) => c.title).filter(Boolean);
  const lastCh = (sd.chapters ?? []).at(-1);
  const reveal = lastCh ? segs.filter((s: any) => (lastCh.segmentIds ?? []).includes(s.id)).map((s: any) => s.text).join(" ") : segs.slice(-2).map((s: any) => s.text).join(" ");
  // Few-shot: 4 pack examples from the video's niche (the pack is the source of truth).
  const fewShot = packFewShot(`${title} ${project.topic ?? ""} ${sp.viewerPromise ?? ""} ${chapters.join(" ")}`, 4);
  const examples = fewShot.map((e) => `- ${e.archetype} · headline "${e.headline}" · BACKGROUND: ${e.background} SUBJECT: ${e.subject}`).join("\n");
  const prompt = [
    `Design 3 YouTube thumbnail concepts for THIS video (a narrated stickman explainer). Each must make a viewer NEED to click, built from the video's own story, characters and places.`,
    `THE VIDEO'S MAIN QUESTION (what the viewer chose to watch — every thumbnail is about THIS): ${mainQuestion}`,
    `Topic: ${String(project.topic ?? "").slice(0, 300)}`,
    `The job of a thumbnail: stop the scroll in under one second and create a question the viewer needs answered. It's judged at 120 px wide on a phone. One idea, instantly readable; at most 2 main characters.`,
    `Title: ${title}`,
    `Viewer promise: ${sp.viewerPromise ?? ""}`,
    `Hook: ${typeof sp.hookConcept === "string" ? sp.hookConcept : JSON.stringify(sp.hookConcept ?? "").slice(0, 400)}`,
    `Thumbnail idea from the plan: ${JSON.stringify(sp.thumbnailConcept ?? "").slice(0, 300)}`,
    `Chapters: ${chapters.join(" | ")}`,
    `Script opening: ${segs.slice(0, 2).map((s: any) => s.text).join(" ").slice(0, 700)}`,
    `The reveal / ending: ${String(reveal).slice(0, 500)}`,
    `Cast (the video's own characters — use ONLY these ids, at most 2 per thumbnail): ${castIds.map((id) => `${id} = ${set.cast[id].displayName}`).join("; ")}`,
    `Places in the video (suggest one only as a simple flat shape band in the background): ${Object.values(set.settings).map((s: any) => s.name).join("; ")}`,
    `THE HOOK IS THE MAIN QUESTION, not a detail from the middle of the script. A stranger who only knows the title must understand the topic from the thumbnail alone (for "What did prehistoric humans do when it rained?": visible heavy rain + early humans + a survival struggle — not a lump, a tool or a smear they'd have to watch the video to recognise).`,
    `"hookObject": the ONE visual that shows the MAIN QUESTION at a glance, named plainly (for a rain video: "heavy rain pouring down on early humans"; other topics: "a wooden pillory", "a giant red alarm clock"). "hookHeld": true if it is an object worn on a head or held in hands, false if it is weather, a place or a situation. EVERY concept shows it large and clear (a held object: worn or held in hands, never floating).`,
    `At least 1 of the 3 concepts directly visualizes the title question itself ("answersTitle": true).`,
    `Exactly 3 concepts, each a DIFFERENT archetype: ${ARCHETYPES.map((a) => `${a} — ${ARCHETYPE_DEFINITIONS[a]}`).join(" ")}`,
    `"headline": 1-3 words (max 4 for a question), ALL CAPS, usually a question, never giving the answer, complementing the title (${title}) instead of repeating it. It speaks to the MAIN QUESTION — never an obscure object or a detail only the video explains (for the rain video, good: "SOAKED FOR DAYS?", "NO ROOF?", "HOW DID THEY STAY DRY?"; bad: "WHY SAVE THIS LUMP?"). About THIS video — never generic lines that fit any video ("THINK AGAIN", "THE TRUTH", "NO WAY"). Never copy an example's headline.`,
    `"scene": 1-2 sentences in the pack's SUBJECT style: what is visible, the hook object big and attached properly, one focal point, an extreme readable emotion, the main character LARGE and CENTERED in the bottom two-thirds, nothing reaching into the top third. Name objects plainly ("a plain round iron helmet" — never "dome", "object", "item"). Only the chosen cast appear; no extras. NO text, signs, labels, symbols, arrows or question marks in the picture.`,
    `"cast": 1-2 cast ids; "mainCharacter": the one drawn LARGEST; "expression": that face in 2-4 words (e.g. "jaw-dropping shock"). "background": the pack's BACKGROUND style — ${BACKGROUND_STYLE} Write it like the examples ("flat deep maroon red with a flat dark-grey medieval town square band at the bottom"); a place only as a flat band, never a white or grey room.`,
    ...(examples ? [`Examples from the Zyvo thumbnail pack (same niche — style only, never copy):\n${examples}`] : []),
    `SELF-CHECK before answering, for each concept: "Does this thumbnail make sense to someone who only knows the title?" If not, reject it and rewrite it until it does. Then fill "strangerReads" (what that stranger understands from it, one short sentence), "makesSenseFromTitleOnly" (true only if it does) and "answersTitle".`,
  ].join("\n");
  const schema = { type: "object", additionalProperties: false, required: ["hookObject", "hookHeld", "concepts"], properties: {
    hookObject: { type: "string" }, hookHeld: { type: "boolean" },
    concepts: { type: "array", items: { type: "object", additionalProperties: false, required: ["archetype", "headline", "scene", "cast", "mainCharacter", "expression", "background", "answersTitle", "strangerReads", "makesSenseFromTitleOnly"], properties: {
      archetype: { type: "string", enum: [...ARCHETYPES] }, headline: { type: "string" }, scene: { type: "string" }, cast: { type: "array", items: { type: "string" } },
      mainCharacter: { type: "string" }, expression: { type: "string" }, background: { type: "string" },
      answersTitle: { type: "boolean" }, strangerReads: { type: "string" }, makesSenseFromTitleOnly: { type: "boolean" } } } } } };
  let usd = 0;
  const ask = async (content: string) => {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: CONCEPT_MODEL, max_tokens: 2400, tools: [{ name: "thumbnail_concepts", description: "The 3 thumbnail concepts.", input_schema: schema }], tool_choice: { type: "tool", name: "thumbnail_concepts" }, messages: [{ role: "user", content }] }) });
    const j: any = await r.json().catch(() => null);
    if (!r.ok) throw new Error(`concepts ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
    const callUsd = ((j.usage?.input_tokens ?? 0) * SONNET_IN_PER_M + (j.usage?.output_tokens ?? 0) * SONNET_OUT_PER_M) / 1e6;
    usd += callUsd;
    await recordCost(admin, { projectId, stage: "other", provider: "anthropic", model: CONCEPT_MODEL, units: { calls: 1, inputTokens: j.usage?.input_tokens ?? 0, outputTokens: j.usage?.output_tokens ?? 0, purpose: "thumbnail concepts" } as any, usd: callUsd, estimated: false, sourceTable: "long_form_thumbnails", sourceId: null });
    return (j.content ?? []).find((c: any) => c.type === "tool_use")?.input ?? {};
  };
  let out = await ask(prompt);
  // The self-check, enforced: a concept that only makes sense after watching, or no concept
  // that shows the title question itself -> ONE rewrite with the reasons.
  const selfCheckFails = (o: any) => {
    const cs: any[] = Array.isArray(o?.concepts) ? o.concepts : [];
    const why = cs.flatMap((c: any, i: number) => (c?.makesSenseFromTitleOnly === false ? [`#${i + 1} ("${c?.headline}") doesn't make sense from the title alone: ${c?.strangerReads ?? ""}`] : []));
    if (cs.length && !cs.some((c: any) => c?.answersTitle === true)) why.push("none of the 3 directly visualizes the title question");
    return why;
  };
  const fails = selfCheckFails(out);
  if (fails.length) {
    await logEvent("long-form-thumbnails", "info", "thumbnail_concepts_rewrite", { projectId, reasons: fails });
    out = await ask(`${prompt}\n\nYOUR LAST ANSWER FAILED THE SELF-CHECK — rewrite all 3 so each makes sense to someone who only knows the title ("${mainQuestion}"):\n- ${fails.join("\n- ")}`);
  }
  const hookObject = String(out.hookObject ?? "").trim();
  const hookHeld = out.hookHeld !== false;
  // Sonnet sometimes returns the nested array as a JSON STRING (f90160bc, twice), or wrapped / with a
  // trailing comma: every form becomes the array; a reply that still yields < 3 concepts is logged as it came.
  const asArray = (v: any): any[] => {
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") return Array.isArray(v.concepts) ? v.concepts : Object.values(v).every((x) => x && typeof x === "object") ? Object.values(v) : [];
    if (typeof v !== "string") return [];
    const s = v.trim();
    for (const cand of [s, s.slice(s.indexOf("["), s.lastIndexOf("]") + 1), s.replace(/,\s*([\]}])/g, "$1")]) {
      try { const p = JSON.parse(cand); if (Array.isArray(p)) return p; if (Array.isArray(p?.concepts)) return p.concepts; } catch { /* next form */ }
    }
    return [];
  };
  const raw = asArray(out.concepts ?? out);
  if (raw.length < 3) await logEvent("long-form-thumbnails", "warn", "thumbnail_concepts_shape", { projectId, message: `${raw.length} concepts parsed`, type: typeof out.concepts, sample: JSON.stringify(out).slice(0, 1500) });
  const castNames = castIds.map((id) => set.cast[id].displayName);
  const { concepts, problems } = normalizeConcepts(raw, title, castIds, hookObject, castNames, { trusted: raw.map((x: any) => x?.makesSenseFromTitleOnly === true), hookHeld: out.hookHeld !== false });
  // Each concept's own cast blocks from the Bible (verbatim, never re-authored).
  const items = concepts.map((c: ThumbConcept, i: number) => {
    const cast = c.cast.map((id) => ({ id, name: set.cast[id].displayName, block: castBlock(set.cast[id], "full") }));
    const check = raw[i] ?? {}; // normalizeConcepts keeps the order (it may change an archetype)
    return { concept: { ...c, hookObject, hookHeld, answersTitle: check.answersTitle === true, strangerReads: String(check.strangerReads ?? "").slice(0, 200) }, prompt: thumbnailPromptV2(c, hookObject, cast, hookHeld) };
  });
  return { title, mainQuestion, hookObject, items, problems, usd, raw };
}

/* ---------------- one thumbnail ---------------- */

// One cheap look (gpt-4o-mini): stray words, who is in the picture, and the hook object. ~$0.002.
async function lookAt(url: string, hookObject: string, projectId: string, id: string): Promise<Partial<ThumbLook>> {
  if (!OPENAI_KEY) return {};
  const schema = { type: "object", additionalProperties: false, required: ["text", "people", "blankHeads", "hookVisible", "hookAttached"], properties: { text: { type: "string" }, people: { type: "integer" }, blankHeads: { type: "integer" }, hookVisible: { type: "boolean" }, hookAttached: { type: "boolean" } } };
  const ask = `Look at this cartoon image. "text": transcribe ALL readable letters and words exactly ('' if none; ignore a lone ? or !). "people": how many HUMAN stick figures are visible (not animals, creatures or objects with faces). "blankHeads": how many visible heads have NO face (no eyes). "hookVisible": is ${hookObject || "the main object"} clearly visible and large? "hookAttached": is it worn on a head or held in hands with every part attached where it belongs (true), or is it or a part of it floating loose (false)? (true when there is no person to hold it)`;
  const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0, messages: [{ role: "user", content: [{ type: "text", text: ask }, { type: "image_url", image_url: { url, detail: "high" } }] }], response_format: { type: "json_schema", json_schema: { name: "look", strict: true, schema } } }) }).catch(() => null);
  if (!r?.ok) return {};
  const j: any = await r.json();
  await recordCost(admin, { projectId, stage: "qa", provider: "openai", model: "gpt-4o-mini", units: { calls: 1, purpose: "thumbnail look" } as any, usd: (j.usage.prompt_tokens * 0.15 + j.usage.completion_tokens * 0.6) / 1e6, estimated: false, sourceTable: "long_form_thumbnails", sourceId: id });
  return JSON.parse(j.choices[0].message.content);
}

// Generate -> upscale -> exact 1920x1080 -> checks.
async function shoot(row: any) {
  const gen = await runware({ taskType: "imageInference", model: THUMB_MODEL, width: THUMB_GEN.width, height: THUMB_GEN.height, numberResults: 1, outputType: "URL", outputFormat: "JPG", outputQuality: 95, deliveryMethod: "sync", includeCost: true, positivePrompt: row.prompt });
  await recordCost(admin, { projectId: row.project_id, stage: "images", provider: "runware", model: THUMB_MODEL, units: { calls: 1, images: 1, purpose: "thumbnail" } as any, usd: gen.cost, estimated: false, sourceTable: "long_form_thumbnails", sourceId: row.id });
  const up = await runware({ taskType: "upscale", model: "runware:504@1", upscaleFactor: 2, inputs: { image: gen.url }, outputType: "URL", outputFormat: "JPG", outputQuality: 95, includeCost: true });
  await recordCost(admin, { projectId: row.project_id, stage: "images", provider: "runware", model: "runware:504@1", units: { calls: 1, purpose: "thumbnail upscale" } as any, usd: up.cost, estimated: false, sourceTable: "long_form_thumbnails", sourceId: row.id });
  const img = await Image.decode(await fetchBytes(up.url)) as Image;
  const { width: W, height: H } = THUMB_OUT.full;
  const k = Math.max(W / img.width, H / img.height);
  img.resize(Math.round(img.width * k), Math.round(img.height * k));
  img.crop(Math.floor((img.width - W) / 2), Math.floor((img.height - H) / 2), W, H);
  const look = await lookAt(gen.url, row.concept?.hookObject ?? "", row.project_id, row.id);
  // Pack prompts (the proof set): their main object is often a creature or a star, not something worn or held.
  if (row.concept?.pack || row.concept?.hookHeld === false) delete look.hookAttached;
  // The hard top-third stop, by code first ($0): content in the top third is moved down.
  const fixed = row.version === 2 ? clearTopThird(img) : { img, shiftPx: 0, scale: 1 };
  const final = fixed?.img ?? img;
  const checks = checkThumb(final, look, row.concept?.cast?.length ?? 0, row.concept?.archetype);
  return { img: final, genUrl: gen.url, cost: gen.cost + up.cost, checks: { ...checks, topFix: fixed ? { shiftPx: fixed.shiftPx, scale: fixed.scale } : "not fixable" } };
}

// The headline drawn on the 1920x1080 picture; the 1280x720 copy for YouTube (<= 2 MB).
async function compose(base: Image, headline: string) {
  fontBytes ??= await fetchBytes(FONT_URL);
  const full = base.clone();
  const layer = headline ? headlineLayerV2(full, headline, fontBytes) : null;
  if (layer) drawLayer(full, layer, fontBytes);
  const fullJpg = await full.encodeJPEG(92);
  const yt = full.clone().resize(THUMB_OUT.youtube.width, THUMB_OUT.youtube.height);
  let bytes = await yt.encode(3), type = "image/png";
  if (bytes.length > THUMB_MAX_BYTES) bytes = await yt.encode(9);
  if (bytes.length > THUMB_MAX_BYTES) { bytes = await yt.encodeJPEG(92); type = "image/jpeg"; }
  return { fullJpg, yt: bytes, type, layer };
}
async function store(row: any, base: Image | null, c: Awaited<ReturnType<typeof compose>>, tag: string) {
  const dir = `long-form/thumbnails/${row.project_id}/${row.id}`;
  const pub = (p: string) => admin.storage.from("generated").getPublicUrl(p).data.publicUrl;
  const out: any = {};
  if (base) { await admin.storage.from("generated").upload(`${dir}-base.jpg`, await base.encodeJPEG(92), { contentType: "image/jpeg", upsert: true }); out.image_url = pub(`${dir}-base.jpg`); }
  const ytPath = `${dir}-${tag}.${c.type === "image/png" ? "png" : "jpg"}`;
  await admin.storage.from("generated").upload(ytPath, c.yt, { contentType: c.type, upsert: true });
  await admin.storage.from("generated").upload(`${dir}-${tag}-1080.jpg`, c.fullJpg, { contentType: "image/jpeg", upsert: true });
  return { ...out, png_url: pub(ytPath), full_url: pub(`${dir}-${tag}-1080.jpg`), layer: c.layer };
}

async function draw(row: any) {
  await admin.from("long_form_thumbnails").update({ status: "rendering", draw_started_at: new Date().toISOString() }).eq("id", row.id);
  // The re-render runs in its OWN invocation: two 4K decodes in one worker got it
  // killed mid-draw (3f65a0c7 #3 stuck on "Drawing…"). The first try is kept in the row.
  const retake = row.checks?.retake === true && !!row.image_url;
  const shot = await shoot(row);
  let best: { img: Image; checks: any } = shot;
  const cost = (retake ? Number(row.cost_usd ?? 0) : 0) + shot.cost;
  const tries = retake ? [row.checks.first, shot.checks] : [shot.checks];
  if (!retake && !shot.checks.pass) {
    const dir = `long-form/thumbnails/${row.project_id}/${row.id}`;
    await admin.storage.from("generated").upload(`${dir}-try1.jpg`, await shot.img.encodeJPEG(92), { contentType: "image/jpeg", upsert: true });
    const firstUrl = admin.storage.from("generated").getPublicUrl(`${dir}-try1.jpg`).data.publicUrl;
    await admin.from("long_form_thumbnails").update({ status: "queued", image_url: firstUrl, checks: { retake: true, first: shot.checks }, cost_usd: cost, draw_started_at: new Date().toISOString() }).eq("id", row.id);
    dispatchDraw(row.id);
    return;
  }
  // The better of the two is kept.
  if (retake && !(shot.checks.score > (row.checks.first?.score ?? -1))) best = { img: await Image.decode(await fetchBytes(row.image_url)) as Image, checks: row.checks.first };
  const c = await compose(best.img, row.headline);
  const saved = await store(row, best.img, c, "v1");
  await admin.from("long_form_thumbnails").update({ status: "ready", ...saved, checks: { ...best.checks, tries: tries.length, all: tries }, flagged: !best.checks.pass, cost_usd: cost, ready_at: new Date().toISOString(), error: null }).eq("id", row.id);
}

// Fire-and-forget: one image draw (its own invocation, so each gets the full function time).
const dispatchDraw = (id: string) => { fetch(`${SUPABASE_URL}/functions/v1/long-form-thumbnails`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, "x-autopilot-secret": SECRET }, body: JSON.stringify({ action: "draw", id }) }).then((x) => x.body?.cancel()).catch(() => {}); };
// A draw whose worker died leaves its row queued/rendering forever (no error reaches the catch).
// Past STUCK_MS: one automatic re-dispatch, then "failed" (the page offers Try again · free).
const STUCK_MS = 180_000;
async function sweepStuck(rows: any[], ownerId: string): Promise<boolean> {
  const now = Date.now();
  let changed = false;
  for (const r of rows) {
    if (!(r.status === "queued" || r.status === "rendering") || !r.prompt) continue;
    if (now - Date.parse(r.draw_started_at ?? r.created_at) < STUCK_MS) continue;
    changed = true;
    if ((r.attempts ?? 0) < 1) {
      await admin.from("long_form_thumbnails").update({ status: "queued", attempts: (r.attempts ?? 0) + 1, draw_started_at: new Date().toISOString(), error: "retrying: stuck" }).eq("id", r.id);
      await logEvent("long-form-thumbnails", "warn", "thumbnail_stuck_retry", { projectId: r.project_id, id: r.id });
      dispatchDraw(r.id);
    } else {
      await admin.from("long_form_thumbnails").update({ status: "failed", error: "timed out" }).eq("id", r.id);
      if (r.credits_charged > 0) { await admin.rpc("deduct_credits", { uid: ownerId, amount: -r.credits_charged }); await admin.from("long_form_thumbnails").update({ credits_charged: 0 }).eq("id", r.id); }
      await logEvent("long-form-thumbnails", "error", "thumbnail_stuck_failed", { projectId: r.project_id, id: r.id });
    }
  }
  return changed;
}
const view = (r: any) => ({ id: r.id, batch: r.batch, slot: r.slot, status: r.status, headline: r.headline, imageUrl: r.image_url, pngUrl: r.png_url, fullUrl: r.full_url, selected: r.selected, creditsCharged: r.credits_charged, archetype: r.concept?.archetype ?? null, flagged: r.flagged });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  if (action === "draw") {
    if (!SECRET || req.headers.get("x-autopilot-secret") !== SECRET) return err(req, "Unauthorized", 401);
    const { data: row } = await admin.from("long_form_thumbnails").select("*").eq("id", String(body?.id ?? "")).maybeSingle();
    if (!row || row.status === "ready") return ok(req, { ok: true, skipped: true });
    try { await draw(row); return ok(req, { ok: true }); }
    catch (e) {
      // One automatic free retry before a failure is ever shown.
      if ((row.attempts ?? 0) < 1) {
        await admin.from("long_form_thumbnails").update({ status: "queued", attempts: (row.attempts ?? 0) + 1, draw_started_at: new Date().toISOString(), error: `retrying: ${String((e as any)?.message ?? e).slice(0, 160)}` }).eq("id", row.id);
        await logEvent("long-form-thumbnails", "warn", "thumbnail_auto_retry", { projectId: row.project_id, id: row.id, message: String((e as any)?.message ?? e).slice(0, 200) });
        dispatchDraw(row.id);
        return ok(req, { ok: false, retrying: true });
      }
      await admin.from("long_form_thumbnails").update({ status: "failed", error: String((e as any)?.message ?? e).slice(0, 200) }).eq("id", row.id);
      // A paid image that failed is refunded.
      if (row.credits_charged > 0) { const { data: p } = await admin.from("long_form_projects").select("user_id").eq("id", row.project_id).single(); await admin.rpc("deduct_credits", { uid: p.user_id, amount: -row.credits_charged }); await admin.from("long_form_thumbnails").update({ credits_charged: 0 }).eq("id", row.id); }
      await logEvent("long-form-thumbnails", "error", "thumbnail_failed", { projectId: row.project_id, id: row.id, message: String((e as any)?.message ?? e).slice(0, 200) });
      return ok(req, { ok: false });
    }
  }

  // 2026-10-07, internal: the watchdog for EVERY project (generation-sweeper calls it each minute).
  // It used to run only when the user opened the page again: a paid draw that never finished kept
  // its credits until then. Also: a failed image that still holds its charge is refunded.
  if (action === "sweep_all") {
    if (!SECRET || req.headers.get("x-autopilot-secret") !== SECRET) return err(req, "Unauthorized", 401);
    // Only work made after the sweeper's cutoff (older rows are never touched without the owner's say).
    const createdAfter = Number.isFinite(Date.parse(String(body?.createdAfter ?? ""))) ? new Date(String(body.createdAfter)).toISOString() : new Date(Date.now() - 86400_000).toISOString();
    const { data: stuck } = await admin.from("long_form_thumbnails").select("*").in("status", ["queued", "rendering"]).not("prompt", "is", null).gte("created_at", createdAfter).lt("created_at", new Date(Date.now() - STUCK_MS).toISOString()).limit(60);
    const { data: unpaid } = await admin.from("long_form_thumbnails").select("id, project_id, credits_charged").eq("status", "failed").gt("credits_charged", 0).gte("created_at", createdAfter).limit(60);
    const projectIds = [...new Set([...(stuck ?? []), ...(unpaid ?? [])].map((r: any) => r.project_id))];
    const { data: owners } = projectIds.length ? await admin.from("long_form_projects").select("id, user_id").in("id", projectIds) : { data: [] };
    const ownerOf = new Map((owners ?? []).map((p: any) => [p.id, p.user_id]));
    let swept = 0, refunded = 0;
    for (const pid of projectIds) {
      const owner = ownerOf.get(pid);
      if (!owner) continue;
      const rows = (stuck ?? []).filter((r: any) => r.project_id === pid);
      if (rows.length && await sweepStuck(rows, owner)) swept += rows.length;
      for (const r of (unpaid ?? []).filter((x: any) => x.project_id === pid)) {
        // Claim the refund first (only one caller wins), then pay it back.
        const { data: claimed } = await admin.from("long_form_thumbnails").update({ credits_charged: 0 }).eq("id", r.id).eq("credits_charged", r.credits_charged).select("id");
        if (!claimed?.length) continue;
        await admin.rpc("deduct_credits", { uid: owner, amount: -r.credits_charged });
        await logEvent("long-form-thumbnails", "warn", "thumbnail_failed_refunded", { projectId: pid, id: r.id, credits: r.credits_charged });
        refunded++;
      }
    }
    return ok(req, { ok: true, swept, refunded });
  }

  // Internal (the autopilot secret or the service role): the FREE retry, or a FREE re-made batch
  // (start + regenerate) for a project — never a user login, never a charge.
  const trusted = (!!SECRET && req.headers.get("x-autopilot-secret") === SECRET) || req.headers.get("authorization") === `Bearer ${SERVICE_KEY}`;
  const internal = trusted && (action === "retry" || action === "start" || action === "headline");
  const { user, authError } = internal ? { user: null as any, authError: null } : await requireUser(req);
  if (!internal && !user) return err(req, authError || "Unauthorized", 401);
  const projectId = String(body?.projectId ?? "").trim();
  if (!projectId || !["list", "start", "headline", "select", "retry"].includes(action)) return err(req, "Bad request", 400);
  const { data: project } = await admin.from("long_form_projects").select("id, user_id, topic, selected_title, selected_idea_title, current_script_version_id, current_story_plan_version_id").eq("id", projectId).maybeSingle();
  if (!project || (!internal && project.user_id !== user.id)) return err(req, "Project not found", 404);
  const { data: profile } = await admin.from("long_form_generation_profiles").select("render_tier").eq("project_id", projectId).eq("status", "active").maybeSingle();
  const tier = tierOf(profile?.render_tier);
  const perImage = THUMB_CREDITS[tier] ?? 6;
  let { data: rows } = await admin.from("long_form_thumbnails").select("*").eq("project_id", projectId).order("batch", { ascending: false }).order("slot");
  const lastBatch = rows?.[0]?.batch ?? 0;
  // Watchdog: a draw that never finished (worker killed) is re-dispatched once, then failed.
  if (await sweepStuck((rows ?? []).filter((r: any) => r.batch === lastBatch), project.user_id)) {
    rows = (await admin.from("long_form_thumbnails").select("*").eq("project_id", projectId).order("batch", { ascending: false }).order("slot")).data;
  }
  const latest = (rows ?? []).filter((r: any) => r.batch === lastBatch);
  const selected = (rows ?? []).find((r: any) => r.selected) ?? null;

  if (action === "list") return ok(req, { ok: true, tier, regenerateCredits: perImage * 3, perImage, thumbnails: latest.map(view), selected: selected ? view(selected) : null });

  if (action === "start") {
    const regenerate = body?.regenerate === true;
    // The included batch exists (a batch whose every image failed doesn't count: it's re-made free).
    const allFailed = latest.length > 0 && latest.every((r: any) => r.status === "failed");
    if (!regenerate && lastBatch > 0 && !allFailed) return ok(req, { ok: true, thumbnails: latest.map(view) });
    if (latest.some((r: any) => r.status === "queued" || r.status === "rendering")) return ok(req, { ok: true, busy: true, thumbnails: latest.map(view) });
    const charge = regenerate && !internal ? perImage : 0;
    if (charge) {
      const { error: chargeError } = await admin.rpc("deduct_credits", { uid: user.id, amount: charge * 3 });
      if (chargeError) return err(req, /INSUFFICIENT/i.test(chargeError.message) ? NOT_ENOUGH_CREDITS : "Couldn't charge the credits. Try again.", /INSUFFICIENT/i.test(chargeError.message) ? 402 : 500);
    }
    const batch = lastBatch + 1;
    // The 3 rows first (queued, no prompt yet): a second start at the same time
    // (the autopilot + a page opened mid-way) hits the unique (batch, slot) index -> busy.
    const { data: slots, error: slotErr } = await admin.from("long_form_thumbnails").insert([0, 1, 2].map((slot) => ({ project_id: projectId, batch, slot, status: "queued", version: 2, credits_charged: charge }))).select("*");
    if (slotErr || !slots?.length) {
      if (charge) await admin.rpc("deduct_credits", { uid: user.id, amount: -charge * 3 });
      const { data: now } = await admin.from("long_form_thumbnails").select("*").eq("project_id", projectId).eq("batch", batch).order("slot");
      return ok(req, { ok: true, busy: true, thumbnails: (now ?? []).map(view) });
    }
    let made: any[] = [];
    try {
      // One automatic retry of the concept step (Sonnet hiccups) before the batch fails.
      const c = await makeConcepts(project, projectId).catch(async (e1) => { await logEvent("long-form-thumbnails", "warn", "thumbnail_concepts_retry", { projectId, message: String(e1?.message ?? e1).slice(0, 200) }); return makeConcepts(project, projectId); });
      for (const [slot, it] of c.items.entries()) {
        const row = slots.find((s: any) => s.slot === slot);
        const { data } = await admin.from("long_form_thumbnails").update({ prompt: it.prompt, headline: headlineOf(it.concept.headline), concept: { ...it.concept, problems: c.problems } }).eq("id", row.id).select("*").single();
        made.push(data);
      }
      if (made.length < 3) throw new Error(`${made.length} concepts`);
    } catch (e) {
      await admin.from("long_form_thumbnails").update({ status: "failed", error: "concepts", credits_charged: 0 }).eq("project_id", projectId).eq("batch", batch).is("prompt", null);
      if (charge) await admin.rpc("deduct_credits", { uid: user.id, amount: -charge * (3 - made.length) });
      await logEvent("long-form-thumbnails", "error", "thumbnail_concepts_failed", { projectId, message: String((e as any)?.message ?? e).slice(0, 200) });
      if (!made.length) return err(req, "Couldn't start the thumbnails.", 500);
    }
    for (const r of made) dispatchDraw(r.id);
    await logEvent("long-form-thumbnails", "info", regenerate ? "thumbnails_regenerate" : "thumbnails_first_batch", { projectId, batch, credits: charge * 3, tier, archetypes: made.map((r: any) => r.concept?.archetype) });
    return ok(req, { ok: true, credits: charge * 3, thumbnails: made.map(view) });
  }

  // retry (free): one failed thumbnail (id) or every failed one in the newest batch.
  // Rows that never got a concept (the concept step failed) get new concepts first.
  if (action === "retry") {
    const failed = latest.filter((r: any) => r.status === "failed" && (!body?.id || r.id === String(body.id)));
    if (!failed.length) return ok(req, { ok: true, thumbnails: latest.map(view) });
    const needConcepts = failed.filter((r: any) => !r.prompt);
    if (needConcepts.length) {
      try {
        const c = await makeConcepts(project, projectId).catch(() => makeConcepts(project, projectId));
        for (const [i, r] of needConcepts.entries()) {
          const it: any = c.items[r.slot] ?? c.items[i];
          if (it) await admin.from("long_form_thumbnails").update({ prompt: it.prompt, headline: headlineOf(it.concept.headline), concept: { ...it.concept, problems: c.problems }, version: 2 }).eq("id", r.id);
        }
      } catch (e) {
        await logEvent("long-form-thumbnails", "error", "thumbnail_retry_concepts_failed", { projectId, message: String((e as any)?.message ?? e).slice(0, 200) });
        return err(req, "Couldn't start the thumbnails. Try again in a moment.", 502);
      }
    }
    const ids = failed.map((r: any) => r.id);
    await admin.from("long_form_thumbnails").update({ status: "queued", attempts: 0, error: null }).in("id", ids).not("prompt", "is", null);
    const { data: again } = await admin.from("long_form_thumbnails").select("*").in("id", ids);
    for (const r of again ?? []) if (r.status === "queued") dispatchDraw(r.id);
    await logEvent("long-form-thumbnails", "info", "thumbnails_retry", { projectId, count: (again ?? []).filter((r: any) => r.status === "queued").length });
    const { data: now } = await admin.from("long_form_thumbnails").select("*").eq("project_id", projectId).eq("batch", lastBatch).order("slot");
    return ok(req, { ok: true, thumbnails: (now ?? []).map(view) });
  }

  const row = (rows ?? []).find((r: any) => r.id === String(body?.id ?? ""));
  if (!row) return err(req, "Thumbnail not found", 404);
  if (action === "select") {
    await admin.from("long_form_thumbnails").update({ selected: false }).eq("project_id", projectId);
    await admin.from("long_form_thumbnails").update({ selected: true }).eq("id", row.id);
    return ok(req, { ok: true });
  }
  // headline: free, re-drawn by code on the same picture (1-3 words; 4 for a question).
  const raw = String(body?.headline ?? "").trim();
  if (raw.split(/\s+/).filter(Boolean).length > (/\?$/.test(raw) ? 4 : 3)) return err(req, "Keep the headline to 3 words (4 for a question).", 422);
  const text = headlineOf(raw);
  if (IP_MARKS.test(text)) return err(req, "Please leave brand or team names out of the headline.", 422);
  if (row.status !== "ready" || !row.image_url) return err(req, "This thumbnail isn't ready yet.", 409);
  const base = await Image.decode(await fetchBytes(row.image_url)) as Image;
  if (base.width !== THUMB_OUT.full.width) { // a V1 picture (1280x720): cover-fit to 1920x1080
    const k = Math.max(THUMB_OUT.full.width / base.width, THUMB_OUT.full.height / base.height);
    base.resize(Math.round(base.width * k), Math.round(base.height * k));
    base.crop(Math.floor((base.width - THUMB_OUT.full.width) / 2), Math.floor((base.height - THUMB_OUT.full.height) / 2), THUMB_OUT.full.width, THUMB_OUT.full.height);
  }
  const c = await compose(base, text);
  const saved = await store(row, null, c, Date.now().toString(36));
  await admin.from("long_form_thumbnails").update({ headline: text, ...saved }).eq("id", row.id);
  return ok(req, { ok: true, headline: text, pngUrl: saved.png_url, fullUrl: saved.full_url });
});
