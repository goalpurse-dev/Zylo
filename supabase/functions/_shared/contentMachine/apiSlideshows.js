// Content Machine: the admin API's slideshow actions (Today, Ideas and Library tabs). Behind the same
// admin check as everything else in api.js; every change is written to the audit log.
import { ApiError } from "./errors.js";
import { coverage } from "./planner.js";
import { localDay } from "./spendSummary.js";
import { ZYVO_SHOT_PATH } from "./pipeline.js";

const KINDS = ["format", "style", "hook"];
const LIB_STATUS = ["active", "proposed", "retired"];
const HEX = /^#[0-9a-f]{6}$/i;
const PLATFORM_FIELDS = { caption: 2200, title: 100 };

function cleanTopic(t) {
  const s = String(t ?? "").replace(/\s+/g, " ").trim();
  if (s.length > 200) throw new ApiError("VALIDATION", "The topic can be at most 200 characters.");
  return s || null;
}

export function cleanLibraryRow(body) {
  const kind = String(body?.kind ?? "");
  if (!KINDS.includes(kind)) throw new ApiError("VALIDATION", "Kind: format, style or hook.");
  const key = String(body?.key ?? "").trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{1,40}$/.test(key)) throw new ApiError("VALIDATION", "Key: lowercase letters, digits and _ (2–41 characters).");
  const name = String(body?.name ?? "").trim();
  if (name.length < 2 || name.length > 80) throw new ApiError("VALIDATION", "Name: 2 to 80 characters.");
  const description = String(body?.description ?? "").trim().slice(0, 600);
  const status = String(body?.status ?? "active");
  if (!LIB_STATUS.includes(status)) throw new ApiError("VALIDATION", "Status: active, proposed or retired.");
  const spec = body?.spec && typeof body.spec === "object" && !Array.isArray(body.spec) ? body.spec : {};
  if (JSON.stringify(spec).length > 4000) throw new ApiError("VALIDATION", "The spec is too long.");
  if (kind === "style") {
    for (const k of ["bg", "fg", "accent", "highlight"]) if (!HEX.test(String(spec[k] ?? ""))) throw new ApiError("VALIDATION", `Style ${k}: a colour like #a855f7.`);
    if (!["anton", "inter"].includes(spec.font)) throw new ApiError("VALIDATION", "Style font: anton or inter.");
    if (!String(spec.bg_prompt ?? "").trim()) throw new ApiError("VALIDATION", "A style needs a background prompt (bg_prompt).");
  }
  if (kind === "format" && spec.slides && !(Array.isArray(spec.slides) && spec.slides.length === 2 && spec.slides.every((n) => Number.isInteger(n) && n >= 3 && n <= 10))) {
    throw new ApiError("VALIDATION", "Format slides: [min, max] between 3 and 10.");
  }
  return { kind, key, name, description, spec, status };
}

/** What the page needs to show one idea: slides, recipe, packages, file links (15 minutes), cost. */
export function ideaView(idea, costs, urls) {
  const gen = (idea.cm_generations ?? []).find((g) => g.kind === "slideshow") ?? null;
  const f = gen?.files ?? {};
  const url = (p) => (p ? urls[p] ?? null : null);
  return {
    id: idea.id, run_id: idea.run_id, status: idea.status, created_at: idea.created_at, dry_run: idea.dry_run,
    title: idea.title, hook: idea.hook, topic: idea.topic, hypothesis: idea.hypothesis, recipe: idea.recipe,
    virality_score: idea.virality_score, compliance: idea.compliance, error: idea.error, source: idea.source,
    slides: idea.script?.slides ?? [], tools_checked: idea.script?.tools_checked ?? [], ai_label_required: Boolean(idea.script?.ai_label_required),
    cost: costs[idea.id] ?? { usd: 0, wouldUsd: 0, byProvider: {}, calls: 0 },
    generation: gen && {
      id: gen.id, status: gen.status, error: gen.error, duration_s: gen.duration_s, dryRun: Boolean(f.dryRun),
      images: { background: gen.source_assets?.background ?? null, illustrations: gen.source_assets?.illustrations ?? {} },
      pngs: (f.pngs ?? []).map(url), zip: url(f.zip), mp4: url(f.mp4),
    },
    packages: (gen?.cm_packages ?? []).sort((a, b) => ["tiktok", "instagram", "youtube"].indexOf(a.platform) - ["tiktok", "instagram", "youtube"].indexOf(b.platform)),
  };
}

export function slideshowActions({ cm, files, kick, store, guard, now }) {
  async function startRun(user, { topic, count, kind }) {
    const s = await store.readSettings();
    if (s.kill_switch) throw new ApiError("KILL_SWITCH", "The kill switch is on. Turn it off first.", 409);
    const n = count == null ? s.slideshows_per_day : Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 10) throw new ApiError("VALIDATION", "Make 1 to 10 slideshows at a time.");
    const dry = guard.envDryRun || Boolean(s.dry_run);
    const run = await cm.createRun({ run_date: localDay(now(), s.timezone), kind, status: "pending", dry_run: dry, input: { topic, count: n }, started_at: now().toISOString() });
    await cm.enqueue([{ run_id: run.id, stage: "plan" }]);
    await store.audit(user.email, "slideshows.make", { runId: run.id, topic, count: n, dryRun: dry });
    await kick().catch(() => {});
    return { runId: run.id, count: n, dryRun: dry };
  }

  return {
    makeSlideshows: async ({ user, body }) => startRun(user, { topic: cleanTopic(body?.topic), count: body?.count ?? null, kind: "slideshows" }),

    runs: async () => ({ runs: await cm.listRuns(20) }),

    ideas: async ({ body }) => {
      const filters = {};
      if (body?.runId) filters.runId = String(body.runId);
      for (const k of ["format", "style", "status"]) if (body?.[k]) filters[k] = String(body[k]);
      if (body?.from) filters.from = `${String(body.from).slice(0, 10)}T00:00:00Z`;
      if (body?.to) filters.to = `${String(body.to).slice(0, 10)}T23:59:59Z`;
      filters.limit = Math.min(100, Math.max(1, Number(body?.limit) || 40));
      const rows = await cm.listIdeas(filters);
      const costs = await cm.ideaCosts(rows.map((r) => r.id));
      const paths = rows.flatMap((r) => (r.cm_generations ?? []).flatMap((g) => [...(g.files?.pngs ?? []), g.files?.zip, g.files?.mp4].filter(Boolean)));
      const urls = await files.signedUrls(paths, 900);
      const library = await cm.libraryAll();
      return {
        ideas: rows.map((r) => ideaView(r, costs, urls)),
        styles: Object.fromEntries(library.filter((l) => l.kind === "style").map((l) => [l.key, l.spec])),
        zyvoShot: await files.signedUrl(ZYVO_SHOT_PATH, 900),
      };
    },

    library: async () => {
      const rows = await cm.libraryAll();
      const active = (k) => rows.filter((r) => r.kind === k && r.status === "active");
      return { rows, coverage: coverage({ formats: active("format"), styles: active("style") }, await cm.recentRecipes(365)) };
    },

    saveLibrary: async ({ user, body }) => {
      const row = cleanLibraryRow(body);
      const saved = await cm.saveLibrary({ ...row, source: body?.source === "agent" ? "agent" : "owner" });
      await store.audit(user.email, "library.save", { kind: row.kind, key: row.key, status: row.status });
      return { row: saved };
    },

    savePackage: async ({ user, body }) => {
      const pkg = await cm.getPackage(String(body?.id ?? ""));
      const patch = {};
      for (const [k, max] of Object.entries(PLATFORM_FIELDS)) {
        if (body?.[k] == null) continue;
        const v = String(body[k]).trim();
        if (v.length > max) throw new ApiError("VALIDATION", `${k} is too long (max ${max}).`);
        patch[k] = v;
      }
      if (body?.hashtags != null) {
        const tags = (Array.isArray(body.hashtags) ? body.hashtags : String(body.hashtags).split(/[\s,]+/)).map((t) => String(t).trim()).filter(Boolean).map((t) => (t.startsWith("#") ? t : `#${t}`));
        if (tags.length > 15 || !tags.every((t) => /^#[^\s#]{1,60}$/.test(t))) throw new ApiError("VALIDATION", "Hashtags: up to 15, each like #aitools.");
        patch.hashtags = tags;
      }
      if (pkg.platform === "tiktok" && (patch.caption ?? pkg.caption ?? "").length > 150) throw new ApiError("VALIDATION", "A TikTok caption is at most 150 characters.");
      if (pkg.platform === "youtube" && (patch.title ?? pkg.title ?? "").length > 60) throw new ApiError("VALIDATION", "A YouTube title is at most 60 characters.");
      const saved = await cm.updatePackage(pkg.id, patch);
      await store.audit(user.email, "package.edit", { id: pkg.id, platform: pkg.platform, fields: Object.keys(patch) });
      return { package: saved };
    },

    setIdeaStatus: async ({ user, body }) => {
      const status = String(body?.status ?? "");
      if (!["approved", "rejected", "done"].includes(status)) throw new ApiError("VALIDATION", "Status: approved, rejected or done.");
      const idea = await cm.getIdea(String(body?.id ?? ""));
      await cm.updateIdea(idea.id, { status });
      await store.audit(user.email, `idea.${status}`, { id: idea.id, title: idea.title });
      return { id: idea.id, status };
    },

    // The same recipe written again (a new idea, a new cost): for a slideshow that came out badly.
    remakeIdea: async ({ user, body }) => {
      const s = await store.readSettings();
      if (s.kill_switch) throw new ApiError("KILL_SWITCH", "The kill switch is on. Turn it off first.", 409);
      const idea = await cm.getIdea(String(body?.id ?? ""));
      if (!idea.recipe?.format) throw new ApiError("VALIDATION", "This idea has no recipe to remake.");
      const dry = guard.envDryRun || Boolean(s.dry_run);
      const run = await cm.createRun({ run_date: localDay(now(), s.timezone), kind: "manual", status: "ideating", dry_run: dry, input: { remakeOf: idea.id, count: 1 }, started_at: now().toISOString() });
      const [copy] = await cm.createIdeas([{ run_id: run.id, status: "producing", source: "owner", format: idea.format, title: "(being written)", recipe: idea.recipe, topic: idea.topic, dry_run: dry, target_platforms: idea.target_platforms }]);
      await cm.enqueue([{ run_id: run.id, idea_id: copy.id, stage: "write", payload: { problems: [`a remake of "${idea.title}": keep the recipe, write it differently`] } }]);
      await store.audit(user.email, "idea.remake", { id: idea.id, newId: copy.id });
      await kick().catch(() => {});
      return { runId: run.id, ideaId: copy.id };
    },
  };
}
