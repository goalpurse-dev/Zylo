// Blocky Worlds: what the page says while a video waits for a free video machine or is being made (the run view's
// queuePosition / etaSec / doneEtaSec from blocky-worlds-api, _shared/blockyWorlds/renderQueue.js). Pure, so the
// tests can check every state. The page counts down from the moment the reply arrived (seenAt); an ETA that has
// passed never shows 0 or a negative number: it says "almost there".

/** "less than a minute" | "about 1 minute" | "about 4 minutes" */
export function aboutTime(sec) {
  const s = Math.max(0, Number(sec) || 0);
  if (s < 60) return "less than a minute";
  const m = Math.round(s / 60);
  return `about ${m} minute${m === 1 ? "" : "s"}`;
}

const left = (sec, nowMs, seenAt) => (Number.isFinite(sec) ? sec - Math.max(0, (nowMs - (seenAt ?? nowMs)) / 1000) : null);

/**
 * -> { inLine, position, title, sub, done }
 *   inLine: the run waits for a free machine (show the place in line instead of the progress)
 *   title / sub: the line's words (inLine) ; done: "Ready in about 3 minutes" | "Almost there" | null (no forecast)
 */
export function waitInfo(run, nowMs = Date.now(), seenAt = nowMs) {
  const out = { inLine: false, position: null, title: null, sub: null, done: null };
  if (!run || ["done", "failed"].includes(run.status)) return out;
  const startLeft = left(run.etaSec, nowMs, seenAt), doneLeft = left(run.doneEtaSec, nowMs, seenAt);
  if (doneLeft != null) out.done = doneLeft > 20 ? `Ready in ${aboutTime(doneLeft)}` : "Almost there";
  const pos = Number(run.queuePosition);
  // in line: still "queued" with a place, and not about to start (a run that starts within ~40 s shows the progress)
  if (run.status === "queued" && pos >= 1 && startLeft != null && (startLeft > 40 || pos > 1 || startLeft <= 0)) {
    out.inLine = true; out.position = pos;
    if (startLeft > 40) { out.title = `You're #${pos} in line`; out.sub = `Starts in ${aboutTime(startLeft)}`; }
    else if (startLeft > 0) { out.title = pos === 1 ? "You're next" : `You're #${pos} in line`; out.sub = "Starting in a moment"; }
    else { out.title = "Almost there"; out.sub = "Your video starts any moment now"; }
  }
  return out;
}
