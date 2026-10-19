// Content Machine, Phase 3: the two agent calls of the learning loop (CM_MODEL_MAIN, through the Budget Guard).
//   analyst  "Let the agent analyze": reads every post's recipe and stats timeline, the program's own numbers
//            (learning.js) and the current playbook; writes a report and a proposed playbook. It proposes; the
//            owner edits and applies.
//   scout    the daily trend check: web search for what is working in faceless / AI video short-form content
//            right now (formats, hooks, sounds), with sources. Feeds the writer and the analyst.
import { WEB_SEARCH_TOOL } from "./providers/anthropic.js";

const str = { type: "string" };
const strs = { type: "array", items: str };
const obj = (properties) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });

export const ANALYSIS_SCHEMA = obj({
  summary: str,
  what_works: strs,
  what_doesnt: strs,
  playbook: str,
  experiments: { type: "array", items: obj({ format: str, style: str, hook_type: str, why: str }) },
  retire: { type: "array", items: obj({ kind: { type: "string", enum: ["format", "style", "hook"] }, key: str, why: str }) },
  trend_notes: str,
  confidence: { type: "string", enum: ["low", "medium", "high"] },
});

export const ANALYST_SYSTEM = `You are the analyst of Zyvo's own short-form slideshow experiments (TikTok, Instagram, YouTube). Each post was made from a recipe (format, style, hook type, where Zyvo appears, CTA, text density, platform, post time) and has a timeline of stats snapshots.
Your job: find what actually drives views, saves, shares and profile visits FOR THIS ACCOUNT, and turn it into a short playbook the writer follows.
Rules:
- Use only the numbers given. Never invent stats. Say when there is too little data (few posts, few snapshots) and set confidence accordingly.
- Recent posts matter more (each post has a freshness weight: it halves every half-life). Trends change; don't lock onto old wins.
- A winner needs repeated success (the program's own "winners" list shows which recipes qualify); one lucky post is a lead for an experiment, not a rule.
- Compare like with like: views at 24 h for all posts, 7 d where it exists.
- playbook: the full proposed playbook as short imperative lines (max ~25 lines), grouped under headings like "Hooks", "Formats", "Styles", "Zyvo placement", "Posting". Keep what still holds from the current playbook; drop what the data contradicts. Never weaken the brand and honesty rules (they are separate and always apply).
- experiments: exactly 2 new format × style × hook combinations worth testing next, with why (use keys from the library).
- retire: formats, styles or hooks to retire, only with evidence (the program's own retire list is a strong hint), with why.
- trend_notes: what the latest scout report suggests trying, if one is given, else "".
Return only the JSON object.`;

export function analysisRequest({ model, posts, learning, playbook, rules, library, scout, account = "creator" }) {
  const keys = (kind) => library.filter((l) => l.kind === kind && l.status === "active").map((l) => l.key).join(", ");
  const user = [
    `ACCOUNT: ${{ creator: "the creator account (go-viral / faceless-creator education, a soft Zyvo mention)", zyvo: "Zyvo's brand account (product carousels; claims only from the fact sheet). The program's numbers include \"features\": per cited fact, per hook and per format: posts, score, profile visits per 1,000 views and link clicks. In what_works, say which features and hooks drive profile visits and link clicks", both: "both accounts together: a combined report; the playbook you propose is a reading aid, not applied" }[account] ?? account}`,
    `LEARNING RULES: ${rules}`,
    `LIBRARY (active keys) · formats: ${keys("format")} · styles: ${keys("style")} · hooks: ${keys("hook")}`,
    `CURRENT PLAYBOOK:\n${playbook?.trim() || "(empty)"}`,
    `THE PROGRAM'S OWN NUMBERS (score: 100 = this account's median post):\n${JSON.stringify(learning)}`,
    `POSTS (newest first; hours → views/likes/... snapshots):\n${JSON.stringify(posts)}`,
    scout ? `LATEST SCOUT REPORT (${scout.created_at}):\n${scout.trend_brief}` : "LATEST SCOUT REPORT: none yet",
  ].join("\n\n");
  return {
    model, max_tokens: 6000,
    system: [{ type: "text", text: ANALYST_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    output_config: { effort: "medium", format: { type: "json_schema", schema: ANALYSIS_SCHEMA } },
  };
}

/** The posts as the analyst reads them: compact, no links or ids it doesn't need. */
export function analystPosts(rows) {
  return rows.map((r) => ({
    title: r.post.idea?.title ?? null, platform: r.post.platform, posted: r.post.posted_at?.slice(0, 16),
    recipe: Object.fromEntries(["format", "style", "hook_type", "zyvo_position", "cta_type", "text_density", "post_time", "mode"].map((k) => [k, r.recipe?.[k] ?? null])),
    score: r.m.score, freshness: r.w != null ? Math.round(r.w * 100) / 100 : null, views24: r.m.views24, views7d: r.m.views7d,
    engagement: r.m.engagementRate != null ? Math.round(r.m.engagementRate * 1000) / 1000 : null,
    account: r.post.account ?? r.post.idea?.account ?? "creator",
    snapshots: (r.post.stats ?? []).map((s) => [Number(s.hours_since_post), s.views, s.likes, s.comments, s.shares, s.saves, s.profile_visits, s.new_followers, s.avg_watch_sec, s.watched_full_pct, s.link_clicks ?? null]),
  }));
}
export const SNAPSHOT_COLUMNS = "hours, views, likes, comments, shares, saves, profile_visits, new_followers, avg_watch_sec, watched_full_pct, link_clicks";

export const SCOUT_SCHEMA = obj({
  trend_brief: str,
  top_formats: { type: "array", items: obj({ name: str, why: str, example: str }) },
  hooks: strs,
  sounds: strs,
  sources: { type: "array", items: obj({ title: str, url: str }) },
});

export const SCOUT_SYSTEM = `You scout short-form content trends for Zyvo's own accounts (faceless YouTube / TikTok creators, AI video and AI tools; photo carousels and slideshows on TikTok and Instagram, YouTube Shorts).
Use web search to find what is working RIGHT NOW (the last 2–4 weeks): slideshow and carousel formats, hook patterns, topics, and trending sounds for photo posts. Prefer recent articles, creator newsletters and platform trend pages; skip anything older than 2 months.
- trend_brief: 6–10 short lines a writer can act on today, each concrete.
- top_formats: up to 5, each with why it works and one example description (no links to copyrighted material needed).
- hooks: up to 8 hook patterns. sounds: up to 5 sound / audio trends for photo posts, if any are reported.
- sources: every page you used (title, url).
Never invent numbers or trends; if search finds little, say so in trend_brief. Return only the JSON object.`;

export function scoutRequest({ model, today, maxSearches = 5 }) {
  return {
    model, max_tokens: 5000,
    system: [{ type: "text", text: SCOUT_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `TODAY: ${today}. Scout today's trends.` }],
    tools: [{ type: WEB_SEARCH_TOOL, name: "web_search", max_uses: maxSearches }],
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCOUT_SCHEMA } },
  };
}
