// THE RENDER GATE (owner 2026-11-18, after two live runs were blocked: "the checker is too strict"; replaces the
// 2026-11-16 rules block that stopped a run when more than 10% of its shots still failed). Calibrated on Milo, the
// owner's quality bar: at its last fix round the checker still flagged 14 of 70 shots (3 a wall / an empty room, 4 a
// prop or body filling the frame, 7 weak framing), and the video was loved. After the fix rounds:
//   UNWATCHABLE shots (black, blank, an empty frame, a flat wall, something filling the frame, a pixel-check fail) are
//     CUT: their words go to the neighbour shot (like a crash); at most MAX_CUT_SHARE of the shots
//   WEAK shots (everything else the checker still flags) are KEPT and logged
//   the free shot check's rule notes that the vision checker did not confirm are NOT failures (they were 29 of the
//     73 "still failing" shots of "The Sock That Heard ...")
//   RENDER the best version (since 2026-11-21 ALWAYS, owner: "the run must never stop over weak shots"): below PASS_MIN,
//     or a hero line without the hero, is logged in the run's report, never a stop
export const PASS_MIN = 0.85;
export const MAX_CUT_SHARE = 0.15;
const UNWATCHABLE_RE = /\b(black|blank|empty (?:frame|room|street|set|place)|EMPTY FRAME|flat (?:[\w-]+ ){0,2}(?:colou?r|wall)|(?:mostly|just|only) (?:a |the |an )?(?:[\w-]+ )?(?:wall|sky|floor|ceiling|legs?)|(?:fills?|filling|covers?|covering) (?:most of |much of |all of )?the (?:whole )?frame|nothing (?:is )?(?:visible|readable)|not readable at all|only the place)\b/i;

// FIX-ONLY NOTES go to the fix rounds but never count against the final: FRAMING (owner 2026-11-18: faces, the face
// share) and CREATURE (owner 2026-11-21: a monster / villain the desc names but the checker can't read: re-aim or
// rebuild it in the fix rounds; the 2120c23d run had 43 of its 51 failing shots on this rule alone)
const FIX_ONLY_RE = /^(?:the checker saw:\s*)?(?:FRAMING|CREATURE):/;

/** one failing entry ({ kind, text }) -> "cut" | "weak" | "ignore" */
export function classify(f) {
  if (!f) return "ignore";
  if (f.kind === "crash" || f.kind === "pixel") return "cut";
  if (f.kind === "shotcheck" || f.kind === "owner") return "ignore"; // not seen by the vision checker: never a failure
  const rest = String(f.text ?? "").split(/;\s*/).filter((p) => p.trim() && !FIX_ONLY_RE.test(p.trim())).join("; ");
  if (!rest || /^the checker saw:\s*$/.test(rest.trim())) return "ignore";
  f = { ...f, text: rest };
  return UNWATCHABLE_RE.test(String(f.text ?? "")) ? "cut" : "weak";
}

/**
 * shots: the plan's shots; failing: { id: { kind, text } } after the fix rounds -> { cut: [id], weak: [{ id, text }],
 * ignored: [id], shareAfter, ok, belowBar, reason }. The caller cuts (mergeOut), then checks the hero lines.
 * NEVER A STOP OVER WEAK SHOTS (owner 2026-11-21, "our earlier rule": after the fix rounds the best version is rendered
 * and the weak shots are logged): below PASS_MIN is a logged note (belowBar), not a block; at most MAX_CUT_SHARE of the
 * shots are cut (the rest of the unwatchable ones are kept as weak, so the video never turns into a few long holds);
 * ok is false only when not one shot is left to show.
 */
export function renderGate({ shots, failing }) {
  const ids = new Set(shots.map((s) => s.id));
  let cut = [], weak = [];
  const ignored = [];
  for (const [k, f] of Object.entries(failing ?? {})) {
    const id = Number(k);
    if (!ids.has(id)) continue;
    const c = classify(f);
    if (c === "cut") cut.push(id); else if (c === "weak") weak.push({ id, text: String(f.text ?? "").slice(0, 200) }); else ignored.push(id);
  }
  const n = shots.length;
  const maxCut = Math.floor(n * MAX_CUT_SHARE);
  const notes = [];
  if (cut.length > maxCut) {
    // the hard ones (crash / pixel) first, then in story order; the rest stay in as weak shots
    const hard = (id) => (["crash", "pixel"].includes(failing[id]?.kind) ? 0 : 1);
    const order = [...cut].sort((a, b) => hard(a) - hard(b) || a - b);
    const keep = order.slice(maxCut);
    notes.push(`${cut.length} of ${n} shots look unwatchable: ${maxCut} cut, ${keep.length} kept as weak`);
    cut = order.slice(0, maxCut).sort((a, b) => a - b);
    weak = [...weak, ...keep.map((id) => ({ id, text: String(failing[id]?.text ?? "").slice(0, 200) }))].sort((a, b) => a.id - b.id);
  }
  const kept = n - cut.length;
  const shareAfter = kept > 0 ? +((kept - weak.length) / kept).toFixed(3) : 0;
  const belowBar = shareAfter < PASS_MIN;
  if (belowBar) notes.push(`only ${Math.round(shareAfter * 100)}% of the shots pass after the fix rounds (${weak.length} weak of ${kept}); the bar is ${Math.round(PASS_MIN * 100)}%: rendering the best version, the weak shots logged`);
  const ok = kept > 0;
  return { cut, weak, ignored, shareAfter, ok, belowBar, reason: ok ? (notes.join("; ") || null) : `not one of the ${n} shots is watchable` };
}

/**
 * THE FULL WEAK-SHOT LIST (owner 2026-11-18: every run's report keeps all of them, not the first 8 of a log line):
 * gate (state.gate) + the plan's shots -> [{ id, status: "cut" | "weak", at, desc, why }]
 */
export function weakShotList(gate, shots = []) {
  if (!gate) return [];
  const byId = new Map(shots.map((s) => [s.id, s]));
  const row = (id, status, why) => { const s = byId.get(id); return { id, status, at: s?.w0 ?? null, desc: String(s?.desc ?? "").slice(0, 160), why: String(why ?? "").slice(0, 200) }; };
  return [...(gate.cut ?? []).map((id) => row(id, "cut", "unwatchable: cut from the final")), ...(gate.weak ?? []).map((w) => row(w.id, "weak", w.text))].sort((a, b) => a.id - b.id);
}

/** the lines that name the hero but show the hero in none of their (checked) shots -> [{ line, text, shots }] */
export function heroLinesMissing({ lines, seen = {}, hero, mentions }) {
  if (!hero) return [];
  const has = (id) => (seen[id] ?? []).some((p) => mentions(String(p), hero) || String(p).toLowerCase().includes(String(hero).toLowerCase()));
  return lines.filter((l) => mentions(l.text, hero) && l.shots.length && l.shots.every((id) => Array.isArray(seen[id])) && !l.shots.some(has));
}
