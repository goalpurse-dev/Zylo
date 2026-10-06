// READ-ONLY: Wan 2.6 Flash clips blocked by Alibaba's output content filter
// ("Green net check failed … DataInspectionFailed") since launch: how often,
// whether the Seedance fallback caught them, what the user was charged, what
// it cost us, and which lines/prompts triggered it.
//   node scripts/fruit-story/wanFilterAudit.mjs <out.json>
import fs from "fs";
import { admin } from "./lib.mjs";

const [out] = process.argv.slice(2);
const SINCE = "2026-09-30T22:00:00Z";
const a = admin();
async function all(table, select, filter = (q) => q) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(a.from(table).select(select)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}
const calls = await all("fruit_ai_calls", "id,job_id,story_id,scene_id,user_id,model,ok,error,http_status,cost_usd,attempt,created_at,response,request", (q) => q.eq("purpose", "clip").gte("created_at", SINCE).order("created_at"));
const isFilter = (c) => /DataInspectionFailed|Green net/i.test(`${c.error ?? ""} ${JSON.stringify(c.response?.errors ?? "")}`);
const wan = calls.filter((c) => c.model === "alibaba:wan@2.6-flash");
const blocked = wan.filter(isFilter);
const errKinds = {};
for (const c of calls.filter((x) => !x.ok)) {
  const k = `${c.model} | ${isFilter(c) ? "DataInspectionFailed (content filter)" : String(c.error ?? "").replace(/\s+/g, " ").slice(0, 70)}`;
  errKinds[k] = (errKinds[k] || 0) + 1;
}

const jobIds = [...new Set(blocked.map((c) => c.job_id).filter(Boolean))];
const rows = [];
for (const id of jobIds) {
  const { data: j } = await a.from("fruit_jobs").select("id,story_id,scene_id,user_id,kind,status,credits,cost_usd,attempt,error_code,error,request,result,refunded_at,created_at,finished_at,task_uuid").eq("id", id).maybeSingle();
  const { data: scene } = j?.scene_id ? await a.from("fruit_story_scenes").select("idx,line,speaker_id,action,emotion,shot,duration_sec,clip_status,clip_prompt").eq("id", j.scene_id).maybeSingle() : { data: null };
  const { data: story } = j?.story_id ? await a.from("fruit_stories").select("title,quality,status,final_status").eq("id", j.story_id).maybeSingle() : { data: null };
  const { data: p } = j?.user_id ? await a.from("profiles").select("email").eq("id", j.user_id).maybeSingle() : { data: null };
  const { data: ledger } = await a.from("fruit_credit_ledger").select("operation,credits,reason,created_at").eq("job_id", id).order("created_at");
  const jobCalls = calls.filter((c) => c.job_id === id);
  rows.push({
    job: id, email: p?.email, internal: String(p?.email ?? "").endsWith("@zyvo-internal.test"), story: story?.title, quality: story?.quality, storyStatus: story?.status, finalStatus: story?.final_status,
    sceneIdx: scene?.idx, speaker: scene?.speaker_id, line: scene?.line, action: scene?.action, emotion: scene?.emotion, shot: scene?.shot, durationSec: scene?.duration_sec,
    prompt: scene?.clip_prompt ?? jobCalls[0]?.request?.positivePrompt ?? j?.request?.positivePrompt ?? null,
    jobStatus: j?.status, jobAttempt: j?.attempt, jobCredits: j?.credits, jobCostUsd: Number(j?.cost_usd || 0), finalModel: j?.request?.model, refunded: Boolean(j?.refunded_at), errorCode: j?.error_code,
    calls: jobCalls.map((c) => ({ at: c.created_at, model: c.model, ok: c.ok, filter: isFilter(c), cost: Number(c.cost_usd || 0), err: c.ok ? null : String(c.error ?? "").slice(0, 60), task: c.response?.errors?.[0]?.taskUUID ?? c.response?.data?.[0]?.taskUUID ?? null })),
    ledger: (ledger ?? []).map((l) => `${l.operation} ${Math.abs(l.credits)} (${l.reason})`),
    charged: (ledger ?? []).filter((l) => l.operation === "charge").reduce((s, l) => s + Math.abs(l.credits), 0),
    refundedCr: (ledger ?? []).filter((l) => l.operation === "refund").reduce((s, l) => s + Math.abs(l.credits), 0),
  });
}
// Reference rates: what a Wan clip and a Seedance clip cost us per second in this window.
const rate = (model) => {
  const js = calls.filter((c) => c.model === model && c.ok && Number(c.cost_usd) > 0);
  const sec = js.reduce((s, c) => s + Number(c.request?.duration ?? 0), 0);
  return { n: js.length, usd: js.reduce((s, c) => s + Number(c.cost_usd), 0), sec, perSec: sec ? js.reduce((s, c) => s + Number(c.cost_usd), 0) / sec : null };
};
const result = {
  since: SINCE, until: new Date().toISOString(),
  clipCalls: calls.length, wanCalls: wan.length, wanOk: wan.filter((c) => c.ok).length, wanBlocked: blocked.length, blockedJobs: jobIds.length,
  wanJobs: new Set(wan.map((c) => c.job_id)).size, errKinds, rates: { wan: rate("alibaba:wan@2.6-flash"), seedance: rate("bytedance:seedance@2.0-mini") }, rows,
};
fs.writeFileSync(out, JSON.stringify(result, null, 1));
console.log(JSON.stringify({ ...result, rows: undefined }, null, 1));
