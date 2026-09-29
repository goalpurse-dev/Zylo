// deno-lint-ignore-file no-explicit-any
// anthropic-director-proxy/index.ts — internal, service-key only (Phase 4d).
// Runs ONE Beat Director tool call (Claude Sonnet 5, forced tool, cached
// system prompt) for local targeted re-direct scripts, so the
// ANTHROPIC_API_KEY stays server-side. Returns the full response (the caller
// records it) and latency. Model allow-list: Sonnet 5 only. Never retries.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ok, err, cors } from "../shared/cors.ts";

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const ALLOWED = new Set(["claude-sonnet-5"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.headers.get("Authorization") !== `Bearer ${SERVICE_KEY}`) return err(req, "Unauthorized", 401);
  const b = await req.json().catch(() => ({}));
  if (!ALLOWED.has(b?.model) || !b?.system || !b?.user || !b?.schema || !b?.toolName) return err(req, "model/system/user/schema/toolName required", 400);
  const request = {
    model: b.model,
    max_tokens: Math.min(Number(b.maxTokens) || 8000, 12000),
    // cache: false for one-off calls (a cache write costs 1.25x and would never be read).
    system: b.cache === false ? b.system : [{ type: "text", text: b.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: b.user }],
    tools: [{ name: b.toolName, description: "Returns the beats.", input_schema: b.schema }],
    tool_choice: { type: "tool", name: b.toolName },
  };
  const t0 = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(150_000),
  });
  const j: any = await res.json().catch(() => null);
  return ok(req, { ok: res.ok, status: res.status, latencyMs: Date.now() - t0, request, response: j });
});
