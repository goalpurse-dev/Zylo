// deno-lint-ignore-file no-explicit-any
// long-form-youtube-text/index.ts — the YouTube title, description and tags for
// a Stickman video (Description V2).
//   get      — the saved text (+ the description composed by code).
//   generate — ONE Sonnet call: a title + 4 alternatives (<= 60 chars, viral
//              style), the description intro (a hook paragraph, a "We look at…"
//              paragraph naming the specific evidence, a thesis line), chapter
//              hooks, a niche-aware disclaimer, 3-5 hashtags and search tags.
//              It sees ONLY the fact-checked (supported) claims, so no invented
//              names or numbers. Chapter TIMES come from the rendered edit
//              version (or the newest edit), sources from the fact-check (real
//              URLs only). Everything stays editable.
//   save     — the user's edits (free).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { segmentForWord } from "../_shared/stickman/scenes.ts";
import { recordCost } from "../_shared/costLedger.ts";
import { claimSourceList } from "../_shared/stickman/claimSources.ts";
import { buildChapters, cleanTitle, limitTags, realSources, composeDescription, chapterHook, cleanHashtags, disclaimerFor, LECTURE_TITLE, LAME_HOOK } from "../../../src/lib/publishText.js";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
// Sonnet writes the description (it names the evidence far better than gpt-5-mini did). $2 / $10 per 1M tokens.
const MODEL = "claude-sonnet-5";
const IN_PER_M = 2.0, OUT_PER_M = 10.0;
const GENERATING_MS = 120_000;
const SECRET = Deno.env.get("LONG_FORM_AUTOPILOT_SECRET") ?? "";

const view = (m: any) => {
  const meta = { hook: m.hook, chapters: m.chapters ?? [], sources: m.sources ?? [], includeCredit: m.include_credit, disclaimer: m.disclaimer, hashtags: m.hashtags ?? [] };
  return { title: m.title, alternatives: m.title_alternatives ?? [], hook: m.hook, chapters: m.chapters ?? [], sources: realSources(m.sources ?? []), includeCredit: m.include_credit, disclaimer: m.disclaimer ?? "", hashtags: cleanHashtags(m.hashtags ?? []), tags: m.tags ?? [], editVersion: m.edit_version, description: composeDescription(meta), updatedAt: m.updated_at };
};

// Numbers in the intro that appear nowhere in the facts or the script: logged (never silently published as fact).
const numbersIn = (s: string) => [...String(s).matchAll(/\b\d[\d,.]*\b/g)].map((m) => m[0].replace(/[,.]$/, "").replace(/,/g, ""));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  const action = String(body?.action ?? "");
  // Internal (server-side, the autopilot secret): generate/get for a project as its owner — never a user login.
  const internal = !!SECRET && req.headers.get("x-autopilot-secret") === SECRET && ["get", "generate"].includes(action);
  const { user, authError } = internal ? { user: null, authError: null } : await requireUser(req);
  if (!internal && !user) return err(req, authError || "Unauthorized", 401);
  if (!projectId || !["get", "generate", "save"].includes(action)) return err(req, "Bad request", 400);
  const { data: project } = await admin.from("long_form_projects").select("id, user_id, topic, selected_title, current_script_version_id, current_story_plan_version_id, autopilot").eq("id", projectId).maybeSingle();
  if (!project || (!internal && project.user_id !== user!.id)) return err(req, "Project not found", 404);
  const { data: saved } = await admin.from("long_form_publish_meta").select("*").eq("project_id", projectId).maybeSingle();

  // A row without a title is a placeholder: a generate is running (the Publish
  // autopilot's, server-side). Younger than 2 min = still going, older = it failed.
  const generating = !!saved && !saved.title && Date.now() - Date.parse(saved.updated_at) < GENERATING_MS;
  if (action === "get") return ok(req, { ok: true, text: saved?.title ? view(saved) : null, generating });

  if (action === "save") {
    if (!saved?.title) return err(req, "Generate the text first.", 409);
    const patch: any = { updated_at: new Date().toISOString() };
    if (typeof body.title === "string") patch.title = cleanTitle(body.title);
    if (typeof body.hook === "string") patch.hook = String(body.hook).slice(0, 3000);
    if (typeof body.disclaimer === "string") patch.disclaimer = String(body.disclaimer).slice(0, 500);
    if (Array.isArray(body.hashtags)) patch.hashtags = cleanHashtags(body.hashtags);
    if (Array.isArray(body.tags)) patch.tags = limitTags(body.tags);
    if (typeof body.includeCredit === "boolean") patch.include_credit = body.includeCredit;
    if (Array.isArray(body.chapters)) patch.chapters = body.chapters.map((c: any) => ({ ms: Number(c.ms) || 0, title: String(c.title ?? "").slice(0, 80) }));
    const { data: next } = await admin.from("long_form_publish_meta").update(patch).eq("project_id", projectId).select("*").single();
    return ok(req, { ok: true, text: view(next) });
  }

  // ---------------- generate ----------------
  // The autopilot (and a page opened mid-way) never writes it twice.
  if (generating) return ok(req, { ok: true, text: null, generating: true });
  if (body?.ifMissing === true && saved?.title) return ok(req, { ok: true, text: view(saved), exists: true });
  if (!saved) await admin.from("long_form_publish_meta").upsert({ project_id: projectId, title: null, updated_at: new Date().toISOString() });
  else if (!saved.title) await admin.from("long_form_publish_meta").update({ updated_at: new Date().toISOString() }).eq("project_id", projectId);
  const { data: script } = await admin.from("long_form_script_versions").select("script_document, research_version_id").eq("id", project.current_script_version_id).maybeSingle();
  const sd = script?.script_document ?? {};
  const { data: plan } = project.current_story_plan_version_id ? await admin.from("long_form_story_plan_versions").select("story_plan").eq("id", project.current_story_plan_version_id).maybeSingle() : { data: null };
  const sp = plan?.story_plan ?? {};
  // The edit the video was rendered from (the newest done render), else the newest edit.
  const { data: job } = await admin.from("long_form_render_jobs").select("edit_version").eq("project_id", projectId).is("parent_job_id", null).eq("status", "done").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const q = admin.from("long_form_edits").select("version, doc").eq("project_id", projectId);
  const { data: edit } = job?.edit_version ? await q.eq("version", job.edit_version).maybeSingle() : await q.order("version", { ascending: false }).limit(1).maybeSingle();
  if (!edit) return err(req, "Open the editor once first.", 409);
  const planId = project.autopilot?.scenes?.planId ?? null;
  const { data: beats } = planId ? await admin.from("long_form_beats").select("sequence, start_word").eq("beat_plan_version_id", planId) : { data: [] };
  const chapterOfSeg = new Map<string, string>();
  const titleOf: Record<string, string> = {};
  for (const ch of sd.chapters ?? []) { const id = ch.chapterId ?? ch.id ?? ch.title; titleOf[id] = ch.title; for (const s of ch.segmentIds ?? []) chapterOfSeg.set(s, id); }
  const sectionOf: Record<number, string> = {};
  for (const b of beats ?? []) { const seg: any = segmentForWord(sd.narrationSegments ?? [], b.start_word ?? 0); sectionOf[b.sequence] = (seg && (chapterOfSeg.get(seg.id) ?? seg.chapterId)) ?? "main"; }
  const chapters = buildChapters(edit.doc.clips, sectionOf, titleOf, edit.doc.audio.durationMs);
  // Sources: the fact-checked claims' own URLs (never invented).
  const { data: research } = script?.research_version_id ? await admin.from("long_form_research_versions").select("*").eq("id", script.research_version_id).maybeSingle() : { data: null };
  const sources = realSources(claimSourceList(sd, research, 8));
  // The ONLY facts the description may use: the claims the fact-check supported.
  const verdictOf = new Map((sd.claimVerification ?? []).map((v: any) => [v.claimId, v]));
  const facts = (sd.claims ?? []).filter((c: any) => (verdictOf.get(c.id) as any)?.verdict === "supported").map((c: any) => String(c.claim ?? c.sentence ?? "").trim()).filter(Boolean);
  const titleBase = project.selected_title ?? sp.recommendedTitle ?? sd.title ?? project.topic ?? "";
  const scriptText = (sd.narrationSegments ?? []).map((s: any) => s.text).join(" ");
  const nicheText = `${titleBase} ${project.topic ?? ""} ${sp.viewerPromise ?? ""}`;
  const prompt = [
    `Write the YouTube metadata for a narrated stickman explainer video. Be accurate: never promise what the video doesn't deliver.`,
    `Working title: ${titleBase}`,
    `Viewer promise: ${sp.viewerPromise ?? ""}`,
    `Sections, in order: ${chapters.length ? chapters.map((c: any) => c.title).join(" | ") : (sd.chapters ?? []).map((c: any) => c.title).join(" | ")}`,
    `VERIFIED FACTS (the fact-check supported these; use ONLY these for any claim, name, place, date or number — never invent or embellish one):\n${facts.map((f: string, i: number) => `${i + 1}. ${f}`).join("\n") || "(none — keep the description to what the script says)"}`,
    `Source names you may mention (real, from the fact-check): ${sources.map((s: any) => s.title).filter(Boolean).join("; ") || "(none)"}`,
    `The script's opening: ${scriptText.slice(0, 900)}`,
    `The script's ending: ${scriptText.slice(-600)}`,
    `Return:`,
    `"title": ONE title (never two joined with | or a colon), <= 60 characters, a curious question or a bold claim plus the clear topic, the way viral YouTube explainers are titled (style examples from OTHER topics — never copy them: "Octopuses Have Three Hearts. Here's Why", "The Map That Started a War").`,
    `"alternatives": exactly 4 other titles in that same viral style, <= 60 characters, different angles; never lecture words (Explained, Overview, Introduction to, lists like "Myth, Evidence, Caveat").`,
    `"hookParagraph": 2-3 sentences: the surprising core fact and what the video reveals. Concrete. Never "In this video", "Find out", "Learn", "Discover".`,
    `"evidenceParagraph": 3-4 sentences starting "We look at": name the SPECIFIC evidence from the verified facts (sites, finds, studies, experiments, sources by name), ending with one twist or teaser that makes people watch.`,
    `"thesis": 1-2 sentences, the line that lands the idea.`,
    `"chapterTitles": one 2-5 word hook per section, same order (style from other topics: "The Missing Clue", "Why It Backfired"); never Intro, Conclusion, Final image: ${chapters.length || (sd.chapters ?? []).length} of them.`,
    `"disclaimer": 1-2 sentences fitting the niche — history/science: it summarizes published research for general educational purposes, some details rely on inference and remain debated; health: not medical advice; money: not financial advice.`,
    `"hashtags": 3-5 hashtags, most specific first (#CamelCase, no spaces). "tags": 12-20 search tags, most specific first, no '#'.`,
  ].join("\n");
  const schema = { type: "object", additionalProperties: false, required: ["title", "alternatives", "hookParagraph", "evidenceParagraph", "thesis", "chapterTitles", "disclaimer", "hashtags", "tags"], properties: {
    title: { type: "string" }, alternatives: { type: "array", items: { type: "string" } }, hookParagraph: { type: "string" }, evidenceParagraph: { type: "string" }, thesis: { type: "string" },
    chapterTitles: { type: "array", items: { type: "string" } }, disclaimer: { type: "string" }, hashtags: { type: "array", items: { type: "string" } }, tags: { type: "array", items: { type: "string" } } } };
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 2500, tools: [{ name: "youtube_text", description: "The YouTube title, description parts and tags.", input_schema: schema }], tool_choice: { type: "tool", name: "youtube_text" }, messages: [{ role: "user", content: prompt }] }) });
  const j: any = await r.json().catch(() => null);
  if (!r.ok) return err(req, "Couldn't write the YouTube text right now. Try again.", 502);
  const usage = { calls: 1, inputTokens: j.usage?.input_tokens ?? 0, outputTokens: j.usage?.output_tokens ?? 0 };
  const usd = (usage.inputTokens * IN_PER_M + usage.outputTokens * OUT_PER_M) / 1_000_000;
  await recordCost(admin, { projectId, stage: "other", provider: "anthropic", model: MODEL, units: { ...usage, purpose: "youtube text" } as any, usd, estimated: false, sourceTable: "long_form_publish_meta", sourceId: null });
  const out: any = (j.content ?? []).find((c: any) => c.type === "tool_use")?.input;
  if (!out) return err(req, "Couldn't write the YouTube text right now. Try again.", 502);
  const chapterTitles: string[] = out.chapterTitles ?? [];
  const finalChapters = chapters.map((c: any, i: number) => ({ ms: c.ms, title: chapterHook(String(chapterTitles[i] ?? "").slice(0, 40), c.title) }));
  // Code holds the model to the rules: no lame opener, lecture-style alternatives dropped.
  const hookP = String(out.hookParagraph ?? "").trim().replace(/^(in this video,?\s*)/i, "");
  const intro = [LAME_HOOK.test(hookP) ? "" : hookP, String(out.evidenceParagraph ?? "").trim(), String(out.thesis ?? "").trim()].filter(Boolean).join("\n\n");
  const known = new Set(numbersIn(`${facts.join(" ")} ${scriptText}`));
  const unverified = numbersIn(intro).filter((n) => !known.has(n));
  if (unverified.length) console.warn(`youtube text ${projectId}: numbers not in the facts: ${unverified.join(", ")}`);
  const hashtags = cleanHashtags(out.hashtags ?? []);
  const row = {
    project_id: projectId, title: cleanTitle(out.title || titleBase), title_alternatives: (out.alternatives ?? []).map(cleanTitle).filter((t: string) => t && !LECTURE_TITLE.test(t)).slice(0, 4), hook: intro,
    chapters: finalChapters, sources, include_credit: saved?.include_credit ?? true,
    disclaimer: String(out.disclaimer ?? "").trim() || disclaimerFor(nicheText),
    hashtags,
    tags: limitTags([...(out.tags ?? []), ...hashtags.map((h) => h.slice(1))]), edit_version: edit.version, cost_usd: usd, updated_at: new Date().toISOString(),
  };
  const { data: next, error } = await admin.from("long_form_publish_meta").upsert(row).select("*").single();
  if (error) return err(req, "Couldn't save the YouTube text.", 500);
  return ok(req, { ok: true, text: view(next), costUsd: Number(usd.toFixed(5)), unverifiedNumbers: unverified });
});
