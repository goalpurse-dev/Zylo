// Content Machine: what the owner may change in Settings and Budget, checked before it is saved. The kill
// switch has its own action (setKillSwitch); everything else goes through cleanSettingsPatch.

export class SettingsError extends Error {
  constructor(message) { super(message); this.name = "SettingsError"; }
}

const MAX_USD = 1000;
const FORMATS = ["zyvo_native", "listicle_slideshow", "long_form_cutdown", "pov_skit", "before_after", "series_episode", "challenge"];
const CAP_KEYS = /^[a-z][a-z0-9_]{0,31}$/;

function usd(v, label, max = MAX_USD) {
  const n = Number(v);
  if (v === "" || v === null || !Number.isFinite(n) || n < 0 || n > max) throw new SettingsError(`${label}: a number of dollars from 0 to ${max}.`);
  return Math.round(n * 100) / 100;
}
function int(v, label, min, max) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new SettingsError(`${label}: a whole number from ${min} to ${max}.`);
  return n;
}
function caps(v, label) {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new SettingsError(`${label}: a list of name → dollars.`);
  const out = {};
  for (const [k, x] of Object.entries(v)) {
    if (!CAP_KEYS.test(k)) throw new SettingsError(`${label}: "${k}" is not a valid name.`);
    out[k] = usd(x, `${label} (${k})`);
  }
  return out;
}
function bool(v, label) {
  if (typeof v !== "boolean") throw new SettingsError(`${label}: on or off.`);
  return v;
}
export function validTimezone(tz) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}
const modelName = (v) => {
  const s = String(v ?? "").trim();
  if (s && !/^[a-z0-9][a-z0-9.\-_:]{1,80}$/i.test(s)) throw new SettingsError(`Model name "${s}" doesn't look like a model id.`);
  return s;
};

const FIELDS = {
  daily_budget_usd: (v) => usd(v, "Daily budget"),
  monthly_budget_usd: (v) => usd(v, "Monthly budget", 10000),
  per_provider_daily_caps: (v) => caps(v, "Provider caps"),
  lane_daily_caps: (v) => caps(v, "Caps per kind of work"),
  daily_video_target: (v) => int(v, "Daily video target", 0, 100),
  slideshows_per_day: (v) => int(v, "Slideshows per day", 0, 50),
  format_mix: (v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new SettingsError("Format mix: a list of format → number of ideas.");
    const out = {};
    for (const [k, n] of Object.entries(v)) {
      if (!FORMATS.includes(k)) throw new SettingsError(`Format mix: unknown format "${k}".`);
      out[k] = int(n, `Format mix (${k})`, 0, 30);
    }
    return out;
  },
  auto_produce: (v) => bool(v, "Auto-produce"),
  end_card: (v) => bool(v, "End card"),
  dry_run: (v) => bool(v, "Dry run"),
  run_time_local: (v) => {
    const s = String(v ?? "").trim();
    if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(s)) throw new SettingsError("Run time: HH:MM, 24-hour.");
    return s;
  },
  timezone: (v) => {
    const s = String(v ?? "").trim();
    if (!validTimezone(s)) throw new SettingsError(`Time zone "${s}" is not known.`);
    return s;
  },
  brand_rules: (v) => {
    const s = String(v ?? "").trim();
    if (s.length < 20 || s.length > 5000) throw new SettingsError("Brand rules: 20 to 5,000 characters.");
    return s;
  },
  experiment_days: (v) => int(v, "Experiment phase (days)", 0, 365),
  daily_auto_run: (v) => bool(v, "Automatic daily run"),
  winners_per_day: (v) => int(v, "Proven winners per day", 0, 50),
  experiments_per_day: (v) => int(v, "New experiments per day", 0, 50),
  use_batch_for_daily: (v) => bool(v, "Batch API for the daily run"),
  models: (v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new SettingsError("Models: main and fast.");
    return { main: modelName(v.main), fast: modelName(v.fast) };
  },
};
export const EDITABLE = Object.keys(FIELDS);

/** Only known fields, each checked; throws SettingsError with a message the page shows as-is. */
export function cleanSettingsPatch(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new SettingsError("Nothing to save.");
  const out = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!FIELDS[k]) throw new SettingsError(`"${k}" can't be changed here.`);
    out[k] = FIELDS[k](v);
  }
  if (!Object.keys(out).length) throw new SettingsError("Nothing to save.");
  const daily = out.daily_budget_usd, monthly = out.monthly_budget_usd;
  if (daily != null && monthly != null && daily > monthly) throw new SettingsError("The daily budget can't be more than the monthly budget.");
  return out;
}

/** {field: [before, after]} for the audit log: only what actually changed. */
export function settingsDiff(before, after) {
  const out = {};
  for (const k of EDITABLE) {
    if (!(k in after)) continue;
    if (JSON.stringify(before?.[k]) !== JSON.stringify(after[k])) out[k] = [before?.[k] ?? null, after[k]];
  }
  return out;
}
