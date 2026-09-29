// Runware transport helpers for AI Fruit Story v2 (no network here; the
// worker passes these results to fetch). The stored job.request is sent
// byte-for-byte; only transport fields are added per attempt.

/** The exact task body for one attempt. */
export function buildEnvelope(request, { taskUUID, webhookURL }) {
  return {
    ...request,
    taskUUID,
    deliveryMethod: "async",
    includeCost: true,
    ...(webhookURL ? { webhookURL } : {}),
  };
}

/** Copy of the envelope that is safe to log (webhook token removed). */
export function redactEnvelope(envelope) {
  if (!envelope.webhookURL) return envelope;
  return { ...envelope, webhookURL: envelope.webhookURL.replace(/([?&]t=)[^&]+/, "$1<redacted>") };
}

export const getResponseTask = (taskUUID) => ({ taskType: "getResponse", taskUUID });

const CONTENT_POLICY = /moderat|safety|policy|nsfw|inappropriate|prohibited|violat|content.?filter|sensitive|blocked/i;
const RETRYABLE = /insufficient.?credits|rate.?limit|concurren|too many|timeout|timed out|temporar|unavailable|overloaded|busy|try again|internal|server error|capacity/i;

function classify(code, message, httpStatus) {
  const text = `${code ?? ""} ${message ?? ""}`;
  if (CONTENT_POLICY.test(text)) return { retryable: false, contentPolicy: true };
  if (RETRYABLE.test(text) || httpStatus === 429 || (httpStatus >= 500 && httpStatus < 600) || httpStatus === 402) {
    return { retryable: true, contentPolicy: false };
  }
  return { retryable: false, contentPolicy: false };
}

function itemFor(body, taskUUID) {
  if (Array.isArray(body?.data)) return body.data.find((d) => !taskUUID || d?.taskUUID === taskUUID) ?? null;
  if (body && typeof body === "object" && (body.taskUUID || body.imageURL || body.videoURL)) return body;
  return null;
}

function errorFor(body, taskUUID) {
  const list = Array.isArray(body?.errors) ? body.errors : body?.error ? [body.error] : [];
  return list.find((e) => !taskUUID || !e?.taskUUID || e.taskUUID === taskUUID) ?? null;
}

/**
 * Normalizes any Runware reply (submit ack, webhook body, getResponse) for one task.
 * @returns {{state:"success"|"pending"|"error"|"accepted"|"unknown", url?:string, cost?:number,
 *            code?:string, message?:string, retryable?:boolean, contentPolicy?:boolean}}
 */
export function parseRunware(body, taskUUID, httpStatus = 200) {
  const err = errorFor(body, taskUUID);
  if (err) {
    const code = String(err.code ?? err.errorCode ?? "error");
    const message = String(err.message ?? err.errorMessage ?? "");
    return { state: "error", code, message, cost: Number(err.cost ?? 0) || 0, ...classify(code, message, httpStatus) };
  }
  if (httpStatus >= 400) {
    return { state: "error", code: `http_${httpStatus}`, message: "", cost: 0, ...classify("", "", httpStatus) };
  }
  const item = itemFor(body, taskUUID);
  if (!item) return { state: "unknown" };
  const status = String(item.status ?? "").toLowerCase();
  const url = item.videoURL ?? item.imageURL ?? null;
  const cost = Number(item.cost ?? 0) || 0;
  if (["error", "failed"].includes(status)) {
    const message = String(item.message ?? item.error ?? "");
    return { state: "error", code: status, message, cost, ...classify(status, message, httpStatus) };
  }
  if (url) return { state: "success", url, cost };
  if (["processing", "pending", "queued", "in_progress"].includes(status)) return { state: "pending", cost };
  return { state: "accepted", cost };
}

/** Webhook token: HMAC-SHA256(secret, taskUUID), hex. Web Crypto (Deno + node). */
export async function webhookToken(secret, taskUUID) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`fruit-webhook:${taskUUID}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string compare. */
export function sameToken(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
