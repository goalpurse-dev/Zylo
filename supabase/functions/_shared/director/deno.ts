// deno-lint-ignore-file no-explicit-any
// The Director's Deno glue, shared by director-api (the Create pages) and maestro-api (Maestro's make_plan /
// change_plan): the tables, the user's plan, and THE PLANNER. The planner is Claude Sonnet 5.5 (owner 2026-11-26:
// "Sonnet always writes the plans and hooks") with structured outputs on the storyboard schema and the server-side
// refusal fallback; when Claude can't answer, the same request goes to OpenAI (gpt-5-mini, openaiFetch) as the backup.
import Anthropic from "npm:@anthropic-ai/sdk@1.14.0";
import { openaiFetch } from "../openaiBackup.js";
import { makeDirector } from "./api.js";
import { canWrite } from "../blockyWorlds/access.js";

export const PLANNER_MODEL = "claude-sonnet-5-5";
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const anthropic = Deno.env.get("ANTHROPIC_API_KEY") ? new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! }) : null;
const must = (r: any) => { if (r.error) throw new Error(r.error.message); return r.data; };

export function directorStore(admin: any) {
  return {
    async getDraft(userId: string, id: string) { return (await admin.from("director_drafts").select("*").eq("id", id).eq("user_id", userId).is("deleted_at", null).maybeSingle()).data ?? null; },
    async countDrafts(userId: string) { const { count } = await admin.from("director_drafts").select("id", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null); return count ?? 0; },
    async listDrafts(userId: string, n: number) { return (await admin.from("director_drafts").select("*").eq("user_id", userId).is("deleted_at", null).order("updated_at", { ascending: false }).limit(n)).data ?? []; },
    async insertDraft(row: any) { return must(await admin.from("director_drafts").insert(row).select("*").single()); },
    async updateDraft(userId: string, id: string, patch: any) { return must(await admin.from("director_drafts").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId).select("*").single()); },
    // only plans / changes that worked count toward the daily cap
    async countUsage(userId: string, kind: string, since: string) { const { count } = await admin.from("director_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("kind", kind).eq("ok", true).gte("created_at", since); return count ?? 0; },
    async logUsage(row: any) { return must(await admin.from("director_usage").insert(row).select("id").single()).id; },
    async markUsage(id: number, okFlag: boolean) { await admin.from("director_usage").update({ ok: okFlag }).eq("id", id); },
    async countClaudeVideos(userId: string, since: string) { const { count } = await admin.from("director_claude_videos").select("draft_id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since); return count ?? 0; },
  };
}

/** the OpenAI-shaped plan / revise request (storyboard.js) -> Claude Sonnet 5.5 with the same JSON schema */
async function viaClaude(request: any) {
  if (!anthropic) throw new Error("no Anthropic key");
  const [sys, usr] = request.messages;
  const res: any = await anthropic.beta.messages.create({
    model: PLANNER_MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: sys.content,
    messages: [{ role: "user", content: usr.content }],
    output_config: { effort: "medium", format: { type: "json_schema", schema: request.response_format.json_schema.schema } },
  } as any);
  if (res.stop_reason === "refusal") throw new Error("planner refused");
  const text = (res.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return JSON.parse(text);
}
async function viaOpenAI(request: any, kind: string) {
  if (!OPENAI_KEY) throw new Error("no OpenAI key");
  const res = await openaiFetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(90_000),
  }, { caller: `director:${kind}` });
  if (!res.ok) throw new Error(`model ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const raw = (await res.json())?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("empty answer");
  return JSON.parse(raw);
}
export async function plannerLlm(request: any, kind: string) {
  try { return await viaClaude(request); }
  catch (e) { console.error("[director] Claude planner failed, using the backup:", (e as any)?.message ?? e); return await viaOpenAI(request, kind); }
}

export function directorUser(admin: any) {
  return async (userId: string) => {
    const { data } = await admin.from("profiles").select("plan_code").eq("id", userId).maybeSingle();
    const plan = String(data?.plan_code ?? "free").toLowerCase();
    return { plan, paid: canWrite(plan) };
  };
}

// a scanned reference video: only the user's own finished scan (reference_scans, owner 2026-11-26)
const directorReferences = (admin: any) => ({
  async get(userId: string, id: string) {
    const { data } = await admin.from("reference_scans").select("breakdown").eq("id", id).eq("user_id", userId).eq("status", "done").maybeSingle();
    return data?.breakdown ?? null;
  },
});
export const makeDirectorFor = (admin: any) => makeDirector({ store: directorStore(admin), llm: plannerLlm, user: directorUser(admin), references: directorReferences(admin) });
