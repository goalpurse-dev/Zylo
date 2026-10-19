// Content Machine: the admin API's slideshow actions (Today, Ideas and Library tabs). Behind the same
// admin check as everything else in api.js; every change is written to the audit log.
import { ApiError } from "./errors.js";
import { coverage } from "./planner.js";
import { localDay } from "./spendSummary.js";
import { localToUtc } from "./localTime.js";
import { batchCheck } from "./batchBudget.js";
import { summarize, monthStart } from "./spendSummary.js";
import { ACCOUNTS } from "./planner.js";
import { LAYOUT_VERSION } from "./slides/templates.js";
import { ZYVO_SHOT_PATH, heroUrls, logosFor } from "./pipeline.js";
import { runProgress } from "./progress.js";
import { STYLE_SAMPLES, resolveSample } from "./styleSamples.js";

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
    id: idea.id, run_id: idea.run_id, status: idea.status, account: idea.account ?? idea.recipe?.account ?? "creator",
    // Rendered with older slide templates than today's (zones, sizes): shown as "Outdated" in the Queue.
    outdated: Boolean(f.pngs?.length) && (gen?.layout_version ?? 0) < LAYOUT_VERSION, created_at: idea.created_at, dry_run: idea.dry_run,
    title: idea.title, hook: idea.hook, topic: idea.topic, hypothesis: idea.hypothesis, recipe: idea.recipe,
    virality_score: idea.virality_score, compliance: idea.compliance, error: idea.error, source: idea.source,
    slides: idea.script?.slides ?? [], tools_checked: idea.script?.tools_checked ?? [], ai_label_required: Boolean(idea.script?.ai_label_required),
    cost: costs[idea.id] ?? { usd: 0, wouldUsd: 0, byProvider: {}, calls: 0 },
    generation: gen && {
      id: gen.id, status: gen.status, error: gen.error, duration_s: gen.duration_s, dryRun: Boolean(f.dryRun),
      images: {
        background: gen.source_assets?.background ?? null,
        heroes: Object.fromEntries(Object.entries(gen.source_assets?.heroes ?? {}).map(([i, h]) => [i, h?.url ?? (h?.asset ? urls[h.asset] ?? null : null)])),
        collages: Object.fromEntries(Object.entries(gen.source_assets?.collages ?? {}).map(([i, list]) => [i, (list ?? []).map((h) => (h?.asset ? urls[h.asset] ?? null : null)).filter(Boolean)])),
        galleries: Object.fromEntries(Object.entries(gen.source_assets?.galleries ?? {}).map(([i, list]) => [i, (list ?? []).map((g) => ({ url: g?.asset ? urls[g.asset] ?? null : null, label: g?.label ?? null })).filter((g) => g.url)])),
      },
      pngs: (f.pngs ?? []).map(url), zip: url(f.zip), mp4: url(f.mp4),
    },
    packages: (gen?.cm_packages ?? []).sort((a, b) => ["tiktok", "instagram", "youtube"].indexOf(a.platform) - ["tiktok", "instagram", "youtube"].indexOf(b.platform)),
  };
}

/* ─── the logo library: official files only, approved by the owner before use ─── */

const LOGO_TYPES = { "image/png": "png", "image/svg+xml": "svg", "image/webp": "webp", "image/jpeg": "jpg" };
export const LOGO_MAX_BYTES = 500_000;

function decodeBase64(b64) {
  const bin = atob(String(b64 ?? "").replace(/^data:[^,]*,/, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The file is what it says it is, small, and (for SVG) carries no script, event handler or outside link. */
export function checkLogoFile(bytes, contentType) {
  if (!LOGO_TYPES[contentType]) throw new ApiError("VALIDATION", "A logo is a PNG, SVG, WebP or JPEG file.");
  if (!bytes.length || bytes.length > LOGO_MAX_BYTES) throw new ApiError("VALIDATION", `A logo file is at most ${LOGO_MAX_BYTES / 1000} KB.`);
  const head = (n) => Array.from(bytes.slice(0, n));
  const ok = {
    "image/png": () => head(4).join(",") === "137,80,78,71",
    "image/jpeg": () => head(2).join(",") === "255,216",
    "image/webp": () => String.fromCharCode(...head(4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP",
    "image/svg+xml": () => {
      const text = new TextDecoder().decode(bytes);
      if (!/<svg[\s>]/i.test(text)) return false;
      // Links may point inside the file (#id) or embed a raster image (data:image/…); never outside.
      if (/<script|<foreignObject|\son[a-z]+\s*=|javascript:|(?:xlink:)?href\s*=\s*["'](?!#|data:image\/(?:png|jpe?g|webp|gif);)/i.test(text)) throw new ApiError("VALIDATION", "This SVG has scripts, event handlers or links to outside files. Use the plain official file.");
      return true;
    },
  }[contentType]();
  if (!ok) throw new ApiError("VALIDATION", "The file doesn't match its type.");
}

function cleanLogoRow(body, existing = null) {
  const name = String(body?.name ?? existing?.name ?? "").trim();
  if (name.length < 1 || name.length > 60) throw new ApiError("VALIDATION", "Tool name: 1 to 60 characters.");
  const domain = String(body?.domain ?? existing?.domain ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) throw new ApiError("VALIDATION", "Domain: like descript.com.");
  const source = body?.source_url === undefined ? existing?.source_url ?? null : String(body.source_url ?? "").trim() || null;
  if (source && !/^https:\/\/[^\s]+$/i.test(source)) throw new ApiError("VALIDATION", "Source: the https address of the company's press or brand page.");
  const notes = body?.notes === undefined ? existing?.notes ?? null : String(body.notes ?? "").trim().slice(0, 300) || null;
  return { name, domain, source_url: source, notes };
}

export function slideshowActions({ cm, files, kick, store, guard, now }) {
  /** Will a batch of this account fit today's caps? From the account's recent real costs (owner, 2026-10-19). */
  async function estimate(account, count) {
    const s = await store.readSettings();
    const today = localDay(now(), s.timezone);
    const summary = summarize(await store.ledgerSince(monthStart(today)), s, today);
    const recent = (await cm.listIdeas({ account, status: "done", limit: 12 })).filter((i) => !i.dry_run);
    const costs = recent.length ? await cm.ideaCosts(recent.map((i) => i.id)) : {};
    return batchCheck({ account, count, summary, recentCosts: Object.values(costs).map((c) => c.usd), dryRun: guard.envDryRun || Boolean(s.dry_run) });
  }
  const cleanAccount = (a) => {
    const v = String(a ?? "creator");
    if (!ACCOUNTS.includes(v)) throw new ApiError("VALIDATION", "Account: creator or zyvo.");
    return v;
  };

  async function startRun(user, { topic, count, kind, account = "creator" }) {
    const s = await store.readSettings();
    if (s.kill_switch) throw new ApiError("KILL_SWITCH", "The kill switch is on. Turn it off first.", 409);
    const n = count == null ? s.slideshows_per_day : Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 10) throw new ApiError("VALIDATION", "Make 1 to 10 slideshows at a time.");
    // Refused before it starts if it wouldn't fit today's caps (never stopped halfway).
    const check = await estimate(account, n);
    if (!check.fits) throw new ApiError("BUDGET", check.message, 409);
    const dry = guard.envDryRun || Boolean(s.dry_run);
    const run = await cm.createRun({ run_date: localDay(now(), s.timezone), kind, status: "pending", dry_run: dry, account, input: { topic, count: n, account }, started_at: now().toISOString() });
    await cm.enqueue([{ run_id: run.id, stage: "plan" }]);
    await store.audit(user.email, "slideshows.make", { runId: run.id, account, topic, count: n, dryRun: dry, estimateUsd: check.estimateUsd });
    await kick().catch(() => {});
    return { runId: run.id, count: n, dryRun: dry, account, estimateUsd: check.estimateUsd };
  }

  return {
    makeSlideshows: async ({ user, body }) => startRun(user, { topic: cleanTopic(body?.topic), count: body?.count ?? null, kind: "slideshows", account: cleanAccount(body?.account) }),

    /** The Queue's "about $X · $Y left" line, before Start. */
    batchEstimate: async ({ body }) => {
      const n = Number(body?.count);
      if (!Number.isInteger(n) || n < 1 || n > 10) throw new ApiError("VALIDATION", "1 to 10.");
      return estimate(cleanAccount(body?.account), n);
    },

    /* ─── the two accounts and the Zyvo fact sheet ─── */
    lanes: async () => ({ lanes: await cm.lanes() }),
    saveLane: async ({ user, body }) => {
      const key = cleanAccount(body?.key);
      const p = body?.patch ?? {};
      const patch = {};
      if (p.brand_rules != null) { const t = String(p.brand_rules).trim(); if (t.length < 20 || t.length > 5000) throw new ApiError("VALIDATION", "Brand rules: 20 to 5,000 characters."); patch.brand_rules = t; }
      if (p.cta_style != null) patch.cta_style = String(p.cta_style).trim().slice(0, 500);
      if (p.slideshows_per_day != null) { const v = Number(p.slideshows_per_day); if (!Number.isInteger(v) || v < 0 || v > 20) throw new ApiError("VALIDATION", "Slideshows per day: 0 to 20."); patch.slideshows_per_day = v; }
      if (p.post_times != null) {
        const out = {};
        for (const pl of ["tiktok", "instagram", "youtube"]) {
          const list = (Array.isArray(p.post_times[pl]) ? p.post_times[pl] : String(p.post_times[pl] ?? "").split(/[\s,]+/)).map((t) => String(t).trim()).filter(Boolean);
          if (!list.length || !list.every((t) => /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(t))) throw new ApiError("VALIDATION", `Posting times (${pl}): HH:MM, comma separated.`);
          out[pl] = list.slice(0, 8);
        }
        patch.post_times = out;
      }
      if (!Object.keys(patch).length) throw new ApiError("VALIDATION", "Nothing to save.");
      const saved = await cm.saveLane(key, { ...patch, updated_by: user.email });
      // The daily run's total (the minute tick reads it) follows the accounts' counts.
      if (patch.slideshows_per_day != null) { const all = await cm.lanes(); await cm.updateSettings({ slideshows_per_day: Object.values(all).reduce((t, l) => t + (Number(l.slideshows_per_day) || 0), 0) }); }
      await store.audit(user.email, "lane.save", { key, fields: Object.keys(patch) });
      return { lane: saved };
    },
    facts: async () => ({ facts: await cm.listFacts() }),
    saveFact: async ({ user, body }) => {
      const row = {};
      if (body?.id) row.id = String(body.id);
      if (body?.key != null || !row.id) { const k = String(body?.key ?? "").trim(); if (!/^[a-z][a-z0-9_]{1,40}$/.test(k)) throw new ApiError("VALIDATION", "Key: lowercase letters, digits and _ (e.g. lf_length)."); row.key = k; }
      if (body?.claim != null || !row.id) { const c = String(body?.claim ?? "").trim(); if (c.length < 5 || c.length > 200) throw new ApiError("VALIDATION", "Claim: 5 to 200 characters."); row.claim = c; }
      if (body?.source != null || !row.id) { const src = String(body?.source ?? "").trim(); if (src.length < 4) throw new ApiError("VALIDATION", "Source: where it's true (a repo path or a tryzyvo.com page)."); row.source = src.slice(0, 300); }
      if (body?.detail !== undefined) row.detail = String(body.detail ?? "").trim().slice(0, 400) || null;
      if (body?.category != null) row.category = String(body.category).trim().slice(0, 40) || "other";
      if (body?.status != null) { if (!["active", "retired"].includes(body.status)) throw new ApiError("VALIDATION", "Status: active or retired."); row.status = body.status; }
      if (!row.id) row.created_by = user.email;
      const saved = await cm.saveFact(row);
      await store.audit(user.email, row.id ? "fact.edit" : "fact.add", { key: saved.key, status: saved.status });
      return { fact: saved };
    },
    setAssetPrompt: async ({ user, body }) => {
      const [asset] = await cm.getAssets([String(body?.id ?? "")]);
      if (!asset) throw new ApiError("VALIDATION", "No such asset.");
      const prompt = String(body?.prompt ?? "").trim().slice(0, 300) || null;
      const saved = await cm.updateAsset(asset.id, { prompt });
      await store.audit(user.email, "asset.prompt", { ref: asset.ref, set: Boolean(prompt) });
      return { row: saved };
    },

    runs: async () => ({ runs: await cm.listRuns(20) }),

    ideas: async ({ body }) => {
      const filters = {};
      if (body?.runId) filters.runId = String(body.runId);
      for (const k of ["format", "style", "status"]) if (body?.[k]) filters[k] = String(body[k]);
      if (body?.account) filters.account = cleanAccount(body.account);
      if (body?.from) filters.from = `${String(body.from).slice(0, 10)}T00:00:00Z`;
      if (body?.to) filters.to = `${String(body.to).slice(0, 10)}T23:59:59Z`;
      // Today (owner, 2026-10-18): everything made since midnight Helsinki, across all runs.
      if (body?.today) { const s = await cm.settings(); filters.from = localToUtc(localDay(now(), s.timezone), s.timezone).toISOString(); }
      filters.limit = Math.min(100, Math.max(1, Number(body?.limit) || 40));
      const rows = await cm.listIdeas(filters);
      const costs = await cm.ideaCosts(rows.map((r) => r.id));
      const paths = rows.flatMap((r) => (r.cm_generations ?? []).flatMap((g) => [...(g.files?.pngs ?? []), g.files?.zip, g.files?.mp4,
        ...Object.values(g.source_assets?.heroes ?? {}).map((h) => h?.asset), ...Object.values(g.source_assets?.collages ?? {}).flat().map((h) => h?.asset), ...Object.values(g.source_assets?.galleries ?? {}).flat().map((h) => h?.asset)].filter(Boolean)));
      const urls = await files.signedUrls(paths, 900);
      const library = await cm.libraryAll();
      return {
        ideas: rows.map((r) => ideaView(r, costs, urls)),
        styles: Object.fromEntries(library.filter((l) => l.kind === "style").map((l) => [l.key, l.spec])),
        zyvoShot: await files.signedUrl(ZYVO_SHOT_PATH, 900),
        logos: await logosFor({ db: cm, files }, rows.flatMap((r) => r.script?.slides ?? [])),
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
      if (pkg.platform === "tiktok" && (patch.title ?? pkg.title ?? "").length > 90) throw new ApiError("VALIDATION", "A TikTok title is at most 90 characters.");
      if (pkg.platform === "instagram") delete patch.title;
      const saved = await cm.updatePackage(pkg.id, patch);
      await store.audit(user.email, "package.edit", { id: pkg.id, platform: pkg.platform, fields: Object.keys(patch) });
      return { package: saved };
    },

    logos: async () => {
      const rows = await cm.listLogos();
      const urls = await files.signedUrls(rows.map((r) => r.logo_path).filter(Boolean), 900);
      return { rows: rows.map((r) => ({ ...r, url: r.logo_path ? urls[r.logo_path] ?? null : null })) };
    },

    saveLogo: async ({ user, body }) => {
      const existing = body?.id ? await cm.getLogo(String(body.id)) : null;
      const row = cleanLogoRow(body, existing);
      // A changed source or domain means a different file: the owner approves it again.
      const reapprove = existing && (row.source_url !== existing.source_url || row.domain !== existing.domain);
      const saved = await cm.saveLogo({ ...(existing ? { id: existing.id } : {}), ...row, ...(reapprove ? { approved: false, approved_at: null, approved_by: null } : {}) });
      await store.audit(user.email, existing ? "logo.edit" : "logo.add", { domain: row.domain, reapprove: Boolean(reapprove) });
      return { row: saved };
    },

    uploadLogo: async ({ user, body }) => {
      const logo = await cm.getLogo(String(body?.id ?? ""));
      const contentType = String(body?.contentType ?? "");
      let bytes;
      try { bytes = decodeBase64(body?.dataBase64); } catch { throw new ApiError("VALIDATION", "The file couldn't be read."); }
      checkLogoFile(bytes, contentType);
      const path = `logos/${logo.domain}.${LOGO_TYPES[contentType]}`;
      await cm.uploadLogoFile(path, bytes, contentType);
      // A new file is never in use until the owner approves it.
      const saved = await cm.saveLogo({ id: logo.id, logo_path: path, content_type: contentType, approved: false, approved_at: null, approved_by: null });
      await store.audit(user.email, "logo.upload", { domain: logo.domain, bytes: bytes.length, contentType });
      return { row: saved };
    },

    approveLogo: async ({ user, body }) => {
      const logo = await cm.getLogo(String(body?.id ?? ""));
      const approved = body?.approved === true;
      if (approved && (!logo.logo_path || !logo.source_url)) throw new ApiError("VALIDATION", "Add the official file and the page you took it from before approving.");
      const saved = await cm.saveLogo({ id: logo.id, approved, approved_at: approved ? now().toISOString() : null, approved_by: approved ? user.email : null });
      await store.audit(user.email, approved ? "logo.approve" : "logo.unapprove", { domain: logo.domain, source: logo.source_url });
      return { row: saved };
    },

    /* ─── live progress and cancel (the Start button) ─── */
    runProgress: async ({ body }) => {
      const runId = String(body?.runId ?? "");
      const run = await cm.getRun(runId);
      const [ideas, jobs, past] = await Promise.all([cm.ideasOfRun(runId), cm.jobsOfRun(runId), cm.pastRuns(10)]);
      return runProgress({ run, ideas, jobs, pastRuns: past, now: now() });
    },

    cancelRun: async ({ user, body }) => {
      const run = await cm.getRun(String(body?.runId ?? ""));
      if (["done", "failed", "budget_stopped", "cancelled"].includes(run.status)) throw new ApiError("VALIDATION", "This run has already finished.");
      // No new paid step from here on (pipeline.js checks before every step); finished slideshows stay.
      await cm.updateRun(run.id, { status: "cancelled", finished_at: now().toISOString() });
      await cm.cancelQueuedJobs(run.id);
      // Slideshows with no step running now are cancelled here; one mid-step is cancelled when that step
      // finishes (its next step is refused by the pipeline), so a render already paid for is still kept.
      const running = new Set((await cm.jobsOfRun(run.id)).filter((j) => j.status === "running").map((j) => j.idea_id));
      for (const idea of await cm.ideasOfRun(run.id)) {
        if (!["done", "failed", "skipped_budget", "rejected", "cancelled"].includes(idea.status) && !running.has(idea.id)) await cm.updateIdea(idea.id, { status: "cancelled" });
      }
      await store.audit(user.email, "run.cancel", { runId: run.id });
      return { runId: run.id, status: "cancelled" };
    },

    /* ─── the style samples: one real slideshow per style (owner-ordered, paid, under $0.20) ─── */
    styleSamples: async ({ user }) => {
      const s = await store.readSettings();
      if (s.kill_switch) throw new ApiError("KILL_SWITCH", "The kill switch is on. Turn it off first.", 409);
      const assets = (await cm.activeAssets()) ?? [];
      const run = await cm.createRun({ run_date: localDay(now(), s.timezone), kind: "samples", status: "producing", dry_run: false, input: { live: true, count: STYLE_SAMPLES.length, samples: true }, started_at: now().toISOString() });
      const rows = STYLE_SAMPLES.map((sample) => {
        const script = resolveSample(sample, assets);
        return { run_id: run.id, status: "producing", source: "owner", format: sample.format, title: script.title, hook: script.hook, topic: script.topic, hypothesis: script.hypothesis, script,
          recipe: { format: sample.format, style: sample.style, mode: "sample", slide_count: script.slides.length }, dry_run: false, target_platforms: ["tiktok", "instagram", "youtube"] };
      });
      const ideas = await cm.createIdeas(rows);
      await cm.enqueue(ideas.map((i) => ({ run_id: run.id, idea_id: i.id, stage: "images" })));
      await store.audit(user.email, "samples.run", { runId: run.id, styles: STYLE_SAMPLES.map((x) => x.style) });
      await kick().catch(() => {});
      return { runId: run.id, count: ideas.length };
    },

    /* ─── the asset library ─── */
    assets: async ({ body }) => {
      const filters = {};
      for (const k of ["status", "tool", "kind"]) if (body?.[k]) filters[k] = String(body[k]);
      const rows = await cm.listAssets({ ...filters, limit: Math.min(600, Number(body?.limit) || 600) });
      const urls = await files.signedUrls(rows.map((r) => r.path), 900);
      const counts = rows.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {});
      return { rows: rows.map((r) => ({ ...r, url: urls[r.path] ?? null })), counts };
    },

    setAssetStatus: async ({ user, body }) => {
      const status = String(body?.status ?? "");
      if (!["active", "blocked"].includes(status)) throw new ApiError("VALIDATION", "Status: active or blocked.");
      const [asset] = await cm.getAssets([String(body?.id ?? "")]);
      if (!asset) throw new ApiError("VALIDATION", "No such asset.");
      const saved = await cm.updateAsset(asset.id, { status, blocked_by: status === "blocked" ? user.email : null });
      await store.audit(user.email, status === "blocked" ? "asset.block" : "asset.unblock", { ref: asset.ref, wasExcluded: asset.status === "excluded" ? asset.exclude_reason : null });
      return { row: saved };
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
    /** "Render again" (an Outdated slideshow): the same words and pictures with today's slide templates, then QA. */
    rerender: async ({ user, body }) => {
      const s = await store.readSettings();
      if (s.kill_switch) throw new ApiError("KILL_SWITCH", "The kill switch is on. Turn it off first.", 409);
      const idea = await cm.getIdea(String(body?.id ?? ""));
      if (!["done", "approved"].includes(idea.status) || !idea.script?.slides?.length) throw new ApiError("VALIDATION", "Only a finished slideshow can be rendered again.");
      if (idea.dry_run) throw new ApiError("VALIDATION", "A dry run has nothing to render.");
      const gen = await cm.ensureGeneration(idea.id);
      await cm.updateGeneration(gen.id, { status: "queued", error: null });
      await cm.enqueue([{ run_id: idea.run_id, idea_id: idea.id, stage: "render" }]);
      await store.audit(user.email, "idea.rerender", { id: idea.id });
      await kick().catch(() => {});
      return { queued: true };
    },

    remakeIdea: async ({ user, body }) => {
      const s = await store.readSettings();
      if (s.kill_switch) throw new ApiError("KILL_SWITCH", "The kill switch is on. Turn it off first.", 409);
      const idea = await cm.getIdea(String(body?.id ?? ""));
      if (!idea.recipe?.format) throw new ApiError("VALIDATION", "This idea has no recipe to remake.");
      const dry = guard.envDryRun || Boolean(s.dry_run);
      const run = await cm.createRun({ run_date: localDay(now(), s.timezone), kind: "manual", status: "ideating", dry_run: dry, input: { remakeOf: idea.id, count: 1 }, started_at: now().toISOString() });
      const [copy] = await cm.createIdeas([{ run_id: run.id, status: "producing", source: "owner", format: idea.format, title: "(being written)", recipe: idea.recipe, topic: idea.topic, dry_run: dry, target_platforms: idea.target_platforms, account: idea.account ?? idea.recipe?.account ?? "creator" }]);
      await cm.enqueue([{ run_id: run.id, idea_id: copy.id, stage: "write", payload: { note: `a remake of "${idea.title}": keep the recipe, write it differently` } }]);
      await store.audit(user.email, "idea.remake", { id: idea.id, newId: copy.id });
      await kick().catch(() => {});
      return { runId: run.id, ideaId: copy.id };
    },
  };
}
