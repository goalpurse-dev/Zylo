// supabase/functions/job-worker/runware.ts
// Shared modern Runware helpers for job-worker.

// --------------------- ENV ---------------------

const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY") || "";
const RUNWARE_BASE_URL =
  (Deno.env.get("RUNWARE_BASE_URL") ||
    "https://api.runware.ai").replace(/\/+$/, "");

if (!RUNWARE_API_KEY) {
  throw new Error("RUNWARE_API_KEY missing in environment");
}

export const BASE_V1 = `${RUNWARE_BASE_URL}/v1`;

// ------------------ Fetch Helpers ------------------

function makeHeaders(method: "GET" | "POST"): Headers {
  const h = new Headers();
  h.set("Authorization", `Bearer ${RUNWARE_API_KEY}`);
  if (method === "POST") {
    h.set("Content-Type", "application/json");
  }
  return h;
}

export type FetchJsonResult = {
  json: any;
  status: number;
  ok: boolean;
  text: string;
};

export async function fetchJson(
  method: "GET" | "POST",
  url: string,
  body?: any,
): Promise<FetchJsonResult> {
  const r = await fetch(url, {
    method,
    headers: makeHeaders(method),
    body: method === "POST" ? JSON.stringify(body || {}) : undefined,
  });

  const text = await r.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // JSON parse failed → keep text as raw
  }

  return { json, status: r.status, ok: r.ok, text };
}

// ------------------ Utilities ------------------

export function pick<T = any>(...vals: Array<T | undefined | null>): T | undefined {
  for (const v of vals) {
    if (v !== undefined && v !== null) return v as T;
  }
  return undefined;
}

// ------------------ Runware: Create Task ------------------

/**
 * Create a Runware AIR task (video inference)
 * This matches the newer Runware API used in /runware-video.
 */
export async function launchRunwareVideo(
  tasks: any[], // must be array of task requests
): Promise<FetchJsonResult> {
  return fetchJson("POST", `${BASE_V1}/air/tasks`, tasks);
}

// ------------------ Runware: Poll Task ------------------

/**
 * Poll Runware AIR tasks.
 * Accepts one UUID or an array.
 */
export async function pollRunware(
  taskUUID: string | string[],
): Promise<FetchJsonResult> {
  const ids = Array.isArray(taskUUID) ? taskUUID : [taskUUID];

  const body = ids.map((id) => ({
    taskType: "getResponse",
    taskUUID: id,
  }));

  return fetchJson("POST", `${BASE_V1}/air/tasks`, body);
}
