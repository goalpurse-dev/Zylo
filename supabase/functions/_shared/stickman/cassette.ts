// deno-lint-ignore-file no-explicit-any
// stickman/cassette.ts — record/replay of the Script Engine's external calls.
//
// RECORD (edge function, env-gated): wraps globalThis.fetch so every model
// call (OpenAI Responses, Anthropic Messages) and every claim-URL liveness
// check made during one stage invocation is captured with its full request
// and response, then saved per stage. Supabase's own REST/storage traffic
// passes through untouched and is never recorded.
//
// REPLAY (offline tests): replaces globalThis.fetch with a player that
// answers each request from recorded entries — matched by kind + key
// (Anthropic: the forced tool name; OpenAI: the json_schema format name;
// URL checks: the URL) in recorded order — so the real stage code runs end
// to end with zero API spend.

export type CassetteKind = "anthropic" | "openai" | "url";
export type CassetteEntry = {
  seq: number;
  stage: string;
  kind: CassetteKind;
  key: string;
  request: any;
  status: number;
  response: any;
};

const ANTHROPIC_HOST = "api.anthropic.com";
const OPENAI_HOST = "api.openai.com";

function urlOf(input: any): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input?.url ?? String(input);
}

export function classifyRequest(url: string, body: any): { kind: CassetteKind; key: string } {
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "";
    }
  })();
  if (host === ANTHROPIC_HOST) return { kind: "anthropic", key: body?.tool_choice?.name ?? "messages" };
  if (host === OPENAI_HOST) return { kind: "openai", key: body?.text?.format?.name ?? "text" };
  return { kind: "url", key: url };
}

function parseBody(init: any): any {
  if (!init?.body || typeof init.body !== "string") return null;
  try {
    return JSON.parse(init.body);
  } catch {
    return init.body;
  }
}

/* ============================ Record ============================ */

export function installCassetteRecorder(passThroughHosts: string[]) {
  const realFetch = globalThis.fetch.bind(globalThis);
  let stage = "unknown";
  let seq = 0;
  let entries: CassetteEntry[] = [];

  globalThis.fetch = (async (input: any, init?: any) => {
    const url = urlOf(input);
    let host = "";
    try {
      host = new URL(url).host;
    } catch { /* not a URL — pass through */ }
    if (!host || passThroughHosts.includes(host)) return realFetch(input, init);

    const body = parseBody(init);
    const { kind, key } = classifyRequest(url, body);
    const response = await realFetch(input, init);
    // Liveness checks only need the status — never store arbitrary page bodies.
    const text = kind === "url" ? "" : await response.clone().text();
    let parsed: any = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    entries.push({ seq: seq++, stage, kind, key, request: kind === "url" ? { method: init?.method ?? "GET" } : body, status: response.status, response: parsed });
    return response;
  }) as typeof fetch;

  return {
    setStage(next: string) {
      stage = next;
    },
    drain(): CassetteEntry[] {
      const out = entries;
      entries = [];
      return out;
    },
  };
}

/* ============================ Replay ============================ */

export type PlayerOptions = {
  // Unmatched liveness checks answer 200 (live) by default — a replay
  // should only fail on a missing MODEL response, never on a URL probe.
  urlDefaultStatus?: number;
  // Hosts answered with an empty 200 (Supabase log/REST traffic in tests).
  ignoreHosts?: string[];
};

export function installCassettePlayer(entries: CassetteEntry[], options: PlayerOptions = {}) {
  const realFetch = globalThis.fetch;
  const remaining = [...entries].sort((a, b) => a.seq - b.seq);
  const calls: { kind: CassetteKind; key: string; request: any; url: string }[] = [];

  globalThis.fetch = (async (input: any, init?: any) => {
    const url = urlOf(input);
    let host = "";
    try {
      host = new URL(url).host;
    } catch { /* ignore */ }
    if (options.ignoreHosts?.includes(host)) {
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    }
    const body = parseBody(init);
    const { kind, key } = classifyRequest(url, body);
    calls.push({ kind, key, request: body, url });
    const index = remaining.findIndex((e) => e.kind === kind && e.key === key);
    if (index === -1) {
      if (kind === "url") return new Response("", { status: options.urlDefaultStatus ?? 200 });
      throw new Error(`[cassette] no recorded ${kind} response left for "${key}" (call #${calls.length})`);
    }
    const [entry] = remaining.splice(index, 1);
    // Handwritten stubs may answer from the request (e.g. verdicts for
    // whichever claim ids a verify batch actually contains).
    const response = typeof entry.response === "function" ? entry.response(body) : entry.response;
    const payload = typeof response === "string" ? response : JSON.stringify(response ?? {});
    return new Response(payload, { status: entry.status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  return {
    calls,
    remaining,
    restore() {
      globalThis.fetch = realFetch;
    },
  };
}

/* ============================ Builders (handwritten stubs) ============================ */

export function anthropicToolResponse(toolName: string, input: any, usage: Partial<{ input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }> = {}) {
  return {
    id: "msg_replay",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5",
    stop_reason: "tool_use",
    content: [{ type: "tool_use", id: "toolu_replay", name: toolName, input }],
    usage: { input_tokens: 10000, output_tokens: 8000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, ...usage },
  };
}

export function openAIJsonResponse(json: any, usage: Partial<{ input_tokens: number; output_tokens: number }> = {}, extraOutput: any[] = []) {
  return {
    id: "resp_replay",
    object: "response",
    status: "completed",
    output: [...extraOutput, { type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(json), annotations: [] }] }],
    usage: { input_tokens: 3000, output_tokens: 800, output_tokens_details: { reasoning_tokens: 0 }, ...usage },
  };
}

export function entry(seq: number, stage: string, kind: CassetteKind, key: string, response: any, status = 200): CassetteEntry {
  return { seq, stage, kind, key, request: null, status, response };
}
