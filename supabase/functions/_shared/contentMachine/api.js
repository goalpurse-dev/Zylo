// Content Machine: the admin API (content-machine-api). One action-routed POST endpoint, like
// blocky-story-api. Order for every request:
//   1. OPTIONS (CORS preflight): answered normally, it carries no token.
//   2. The admin check (adminGuard.js): anyone else gets a plain 404, whatever they send.
//   3. POST only, then the action.
// Every change (settings, kill switch, a guard test) is written to cm_audit_log with the admin's email.
//
// Response: {ok: true, data} or {ok: false, code, message} (message is shown as-is).
import { NOT_FOUND_BODY, adminFromRequest } from "./adminGuard.js";
import { BudgetStopped, PROVIDERS, REASON_TEXT } from "./budgetGuard.js";
import { SettingsError, cleanSettingsPatch, settingsDiff } from "./settings.js";
import { dailySeries, daysBack, localDay, monthStart, summarize } from "./spendSummary.js";
import { ApiError } from "./errors.js";
import { slideshowActions } from "./apiSlideshows.js";
import { postsActions } from "./apiPosts.js";
import { learningActions } from "./apiLearning.js";


const PUBLIC_SETTINGS = [
  "daily_budget_usd", "monthly_budget_usd", "per_provider_daily_caps", "lane_daily_caps", "daily_video_target",
  "slideshows_per_day", "format_mix", "auto_produce", "end_card", "kill_switch", "dry_run", "run_time_local",
  "timezone", "watchlist", "brand_rules", "models", "updated_at", "updated_by",
  "experiment_days", "experiment_started_on", "daily_auto_run", "winners_per_day", "experiments_per_day", "use_batch_for_daily",
  "half_life_days", "winner_min_successes", "analysis_suggest_after", "daily_scout",
];
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o?.[k] ?? null]));
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function createHandler({ getUser, emails, store, guard, cors, env = {}, now = () => new Date(), cm = null, files = null, kick = async () => {}, ai = null }) {
  const models = (s) => ({
    main: s.models?.main || env.CM_MODEL_MAIN || "claude-sonnet-5-5",
    fast: s.models?.fast || env.CM_MODEL_FAST || "claude-haiku-5-5",
  });

  async function status() {
    const s = await store.readSettings();
    const today = localDay(now(), s.timezone);
    const rows = await store.ledgerSince(monthStart(today));
    return {
      settings: pick(s, PUBLIC_SETTINGS),
      models: models(s),
      spend: summarize(rows, s, today),
      dryRun: { env: guard.envDryRun, settings: Boolean(s.dry_run), effective: guard.envDryRun || Boolean(s.dry_run) },
      latestRun: cm ? (await cm.listRuns(1))[0] ?? null : null,
    };
  }

  const ACTIONS = {
    ...(cm ? slideshowActions({ cm, files, kick, store, guard, now }) : {}),
    ...(cm ? learningActions({ cm, store, kick, now }) : {}),
    ...(cm ? postsActions({ cm, files, store, guard, now, ai, env: { anthropicKey: env.ANTHROPIC_API_KEY }, models }) : {}),
    whoami: async ({ user }) => ({ email: user.email }),
    status: async () => status(),

    saveSettings: async ({ user, body }) => {
      const patch = cleanSettingsPatch(body?.patch);
      const before = await store.readSettings();
      const daily = patch.daily_budget_usd ?? Number(before.daily_budget_usd);
      const monthly = patch.monthly_budget_usd ?? Number(before.monthly_budget_usd);
      if (daily > monthly) throw new SettingsError("The daily budget can't be more than the monthly budget.");
      const diff = settingsDiff(before, patch);
      if (Object.keys(diff).length) {
        await store.updateSettings(patch, user.email);
        await store.audit(user.email, "settings.save", { changes: diff });
      }
      return status();
    },

    setKillSwitch: async ({ user, body }) => {
      if (typeof body?.on !== "boolean") throw new ApiError("VALIDATION", "Say on or off.");
      await store.updateSettings({ kill_switch: body.on }, user.email);
      await store.audit(user.email, body.on ? "kill_switch.on" : "kill_switch.off", {});
      return status();
    },

    ledger: async ({ body }) => {
      const s = await store.readSettings();
      const today = localDay(now(), s.timezone);
      const day = body?.day ? String(body.day) : null;
      if (day && !DAY.test(day)) throw new ApiError("VALIDATION", "Day: YYYY-MM-DD.");
      const provider = body?.provider ? String(body.provider) : null;
      if (provider && !PROVIDERS.includes(provider)) throw new ApiError("VALIDATION", "Unknown provider.");
      const limit = Math.min(500, Math.max(1, Number(body?.limit) || 200));
      const rows = await store.ledgerSince(day ?? daysBack(today, 31)[0], { provider, day, limit });
      return { rows };
    },

    history: async () => {
      const s = await store.readSettings();
      const today = localDay(now(), s.timezone);
      const rows = await store.ledgerSince(daysBack(today, 30)[0]);
      return { days: dailySeries(rows, today, 30) };
    },

    auditLog: async ({ body }) => ({ rows: await store.auditLog(Math.min(200, Math.max(1, Number(body?.limit) || 50))) }),

    // Shows the guard at work on the live caps without spending anything: always a dry run.
    guardTest: async ({ user, body }) => {
      const provider = String(body?.provider ?? "");
      if (!PROVIDERS.includes(provider)) throw new ApiError("VALIDATION", "Unknown provider.");
      const estimatedUsd = Number(body?.estimatedUsd);
      if (!Number.isFinite(estimatedUsd) || estimatedUsd < 0 || estimatedUsd > 1000) throw new ApiError("VALIDATION", "Estimate: dollars from 0 to 1000.");
      const lane = body?.lane ? String(body.lane) : null;
      let outcome;
      try {
        const r = await guard.spend(provider, "guard.test", estimatedUsd, async () => { throw new Error("a guard test never makes a real call"); },
          { lane, forceDryRun: true, mock: async () => ({ mocked: true }) });
        outcome = { allowed: true, ledgerId: r.ledgerId };
      } catch (e) {
        if (!(e instanceof BudgetStopped)) throw e;
        outcome = { allowed: false, reason: e.reason, message: REASON_TEXT[e.reason] ?? e.reason };
      }
      await store.audit(user.email, "guard.test", { provider, estimatedUsd, lane, ...outcome });
      return outcome;
    },
  };

  return async function handle(req) {
    const headers = cors(req);
    if (req.method === "OPTIONS") return new Response("ok", { headers });
    const user = await adminFromRequest(req, { getUser, emails });
    if (!user) return new Response(JSON.stringify(NOT_FOUND_BODY), { status: 404, headers });
    const reply = (body, s = 200) => new Response(JSON.stringify(body), { status: s, headers });
    if (req.method !== "POST") return reply({ ok: false, code: "VALIDATION", message: "POST only." }, 405);
    try {
      const body = await req.json().catch(() => ({}));
      const action = ACTIONS[body?.action];
      if (!action) throw new ApiError("VALIDATION", "Unknown action.");
      return reply({ ok: true, data: await action({ user, body }) });
    } catch (e) {
      if (e instanceof SettingsError) return reply({ ok: false, code: "VALIDATION", message: e.message }, 400);
      if (e instanceof ApiError) return reply({ ok: false, code: e.code, message: e.message }, e.status);
      if (e instanceof BudgetStopped) return reply({ ok: false, code: "BUDGET_STOPPED", message: REASON_TEXT[e.reason] ?? e.reason }, 409);
      console.error("[content-machine-api] unexpected:", e?.message ?? e);   // raw text is logged, never returned
      return reply({ ok: false, code: "SERVER_FAILED", message: "Something went wrong. Try again." }, 500);
    }
  };
}
