// deno-lint-ignore-file no-explicit-any
// anthropic-vision-proxy/index.ts — internal, service-key only (Phase 4b).
// Runs ONE Claude Haiku 4.5 vision QA call (structured output via a forced
// tool) so the ANTHROPIC_API_KEY stays server-side. Returns the tool input,
// usage and latency. Model allow-list: Haiku 4.5 only. Never retries.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ok, err, cors } from "../shared/cors.ts";

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const ALLOWED = new Set(["claude-haiku-4-5-20251001"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.headers.get("Authorization") !== `Bearer ${SERVICE_KEY}`) return err(req, "Unauthorized", 401);
  const b = await req.json().catch(() => ({}));
  if (!ALLOWED.has(b?.model) || !b?.imageBase64 || !b?.prompt || !b?.schema) return err(req, "model/image/prompt/schema required", 400);
  const t0 = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: b.model, max_tokens: 700, system: b.system ?? undefined,
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: b.mediaType ?? "image/jpeg", data: b.imageBase64 } }, { type: "text", text: b.prompt }] }],
      tools: [{ name: "qa", description: "Report the QA verdict.", input_schema: b.schema }],
      tool_choice: { type: "tool", name: "qa" },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const j: any = await res.json().catch(() => null);
  const latencyMs = Date.now() - t0;
  if (!res.ok) return ok(req, { ok: false, latencyMs, status: res.status, error: j });
  const block = (j?.content ?? []).find((c: any) => c.type === "tool_use");
  return ok(req, { ok: true, latencyMs, input: block?.input ?? null, usage: j?.usage ?? null });
});
