// Content Machine, Part 2: reading a pasted analytics screenshot (TikTok / Instagram / YouTube) with
// CM_MODEL_FAST. It only proposes numbers: the owner checks them in the form and saves. A number that isn't
// clearly visible comes back null, never guessed.

export const STAT_FIELDS = Object.freeze([
  ["views", "Views", "int"], ["likes", "Likes", "int"], ["comments", "Comments", "int"], ["shares", "Shares", "int"], ["saves", "Saves", "int"],
  ["avg_watch_sec", "Average watch time (s)", "dec"], ["watched_full_pct", "Watched full (%)", "pct"],
  ["profile_visits", "Profile visits", "int"], ["new_followers", "New followers", "int"],
]);

const nullableNumber = { type: ["number", "null"] };
export const STATS_SCHEMA = {
  type: "object", additionalProperties: false,
  required: [...STAT_FIELDS.map(([k]) => k), "platform", "note"],
  properties: {
    ...Object.fromEntries(STAT_FIELDS.map(([k]) => [k, nullableNumber])),
    platform: { type: ["string", "null"], enum: ["tiktok", "instagram", "youtube", null] },
    note: { type: ["string", "null"] },
  },
};

export const STATS_SYSTEM = `You read the numbers off a screenshot of a social media post's analytics (TikTok, Instagram or YouTube), for the account owner's own records.
Return each number exactly as shown, as a plain number: "1.2K" → 1200, "3,4 t." or "3.4M" → 3400000, "12.5%" → 12.5, "4.2s" → 4.2, "1:05" (watch time) → 65.
- views: video views / plays / post views. likes, comments, shares, saves (also "favorites" / "bookmarks").
- avg_watch_sec: average watch time in seconds. watched_full_pct: "watched full video" / "completion rate" in %.
- profile_visits: profile views / visits from this post. new_followers: followers gained from this post.
- platform: which app the screenshot is from, if you can tell.
A number that is not clearly visible is null. Never estimate, add up or infer a number. note: one short line if anything is unclear, else null.
Return only the JSON object.`;

export function statsRequest({ model, contentType, dataBase64 }) {
  return {
    model, max_tokens: 600,
    system: [{ type: "text", text: STATS_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: contentType, data: dataBase64 } }, { type: "text", text: "Read the numbers." }] }],
    output_config: { effort: "low", format: { type: "json_schema", schema: STATS_SCHEMA } },
  };
}

/**
 * A count as people type it: "12 500", "12,500", "12.500" → 12500; "1.2K" / "1,2k" → 1200; "3M" → 3000000.
 * Without K/M, commas, dots and spaces are thousands separators (a view count has no decimals).
 */
export function countValue(raw) {
  const t = String(raw).trim().replace(/\s/g, "");
  const m = /^(\d+(?:[.,]\d+)?)([kKmM])$/.exec(t);
  if (m) return Math.round(Number(m[1].replace(",", ".")) * (/[kK]/.test(m[2]) ? 1_000 : 1_000_000));
  return /^\d{1,3}([.,']\d{3})+$|^\d+$/.test(t) ? Number(t.replace(/[.,']/g, "")) : NaN;
}

/** A form's numbers → the row's fields, checked. Throws a short message for the owner on a bad value. */
export function cleanStats(input) {
  const out = {};
  for (const [k, label, kind] of STAT_FIELDS) {
    const raw = input?.[k];
    if (raw == null || String(raw).trim() === "") { out[k] = null; continue; }
    const v = kind === "int" ? countValue(raw) : Number(String(raw).replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(v) || v < 0) throw new Error(`${label}: a number of 0 or more.`);
    if (kind === "pct" && v > 100) throw new Error(`${label}: at most 100.`);
    out[k] = kind === "int" ? Math.round(v) : Math.round(v * 100) / 100;
  }
  if (Object.values(out).every((v) => v == null)) throw new Error("Enter at least one number.");
  return out;
}
