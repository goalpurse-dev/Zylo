// STUDIO MODE: after the final render. Local ffmpeg only (frames out of the finished mp4, light):
//   contactSheet({ mp4, tl, out })  one frame per cut (at 40% of it), labelled "cut id L<line>: its words" -> contact_sheet.jpg
//   visionAudit({ mp4, tl, mustShow, out, L, apiKey })  ONE Sonnet vision call on labelled sheets of the FINAL frames:
//     per cut, which of its line's must-show things are not clearly visible, and framing problems (JSON output). This is
//     the independent pixel check next to the code checks (which read the cuts' declarations).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tileProblems } from "./pixel.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { costOf } = await import(pathToFileURL(path.resolve(HERE, "../../../supabase/functions/_shared/blockyWorlds/llm.js")).href);
const wrap = (s, n, k = 3) => { const out = []; let cur = ""; for (const w of String(s).split(/\s+/)) { if ((cur + " " + w).trim().length > n) { out.push(cur.trim()); cur = w; } else cur += " " + w; } if (cur.trim()) out.push(cur.trim()); return out.slice(0, k).join("\n"); };

function tiles({ mp4, tl, dir, w, h, labelH, text, font = 13 }) {
  fs.mkdirSync(dir, { recursive: true });
  return tl.shots.map((s, i) => {
    const t = (s.start + (s.end - s.start) * 0.4).toFixed(3), f = path.join(dir, `${String(i).padStart(3, "0")}.jpg`), txt = path.join(dir, `${i}.txt`);
    fs.writeFileSync(txt, text(s, i));
    const tf = txt.replace(/\\/g, "/").replace(":", "\\:");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", t, "-i", mp4, "-frames:v", "1", "-vf", `scale=${w}:${h},pad=${w}:${h + labelH}:0:0:#111111,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':textfile='${tf}':fontcolor=white:fontsize=${font}:line_spacing=2:x=5:y=${h + 4}`, f]);
    return f;
  });
}
function grid(files, cols, out) {
  const dir = path.dirname(files[0]), list = path.join(dir, "list");
  fs.mkdirSync(list, { recursive: true });
  for (const f of fs.readdirSync(list)) fs.unlinkSync(path.join(list, f));
  files.forEach((f, i) => fs.copyFileSync(f, path.join(list, `${String(i).padStart(3, "0")}.jpg`)));
  const rows = Math.ceil(files.length / cols);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", "1", "-i", path.join(list, "%03d.jpg"), "-vf", `tile=${cols}x${rows}:color=#111111`, "-frames:v", "1", out]);
  return out;
}

export function contactSheet({ mp4, tl, out }) {
  const files = tiles({ mp4, tl, dir: path.join(out, "cs"), w: 200, h: 356, labelH: 64, text: (s, i) => `${i} ${s.studio} L${s.line}: ${wrap(s.text, 24)}` });
  return grid(files, 11, path.join(out, "contact_sheet.jpg"));
}

export async function visionAudit({ mp4, tl, mustShow, out, L, apiKey, model = "claude-sonnet-5-5" }) {
  const dir = path.join(out, "audit");
  const files = tiles({ mp4, tl, dir, w: 270, h: 480, labelH: 70, font: 14, text: (s, i) => `#${i} L${s.line}\n${wrap(`must: ${(mustShow[s.line] ?? []).join(", ") || "-"}`, 30, 2)}` });
  const sheets = []; for (let i = 0; i < files.length; i += 18) sheets.push(grid(files.slice(i, i + 18), 6, path.join(dir, `sheet${i / 18}.jpg`)));
  const lines = tl.lines.map((l, n) => `L${n}: ${l.text} | must show: ${(mustShow[n] ?? []).join(", ") || "-"}`).join("\n");
  const content = [{ type: "text", text: `These sheets are frames of a finished vertical video, one frame per cut (label: #cut L<line>, then what the line must show). The narration lines:\n${lines}\n\nFor EVERY cut, judge the frame: which of the line's must-show things are NOT clearly visible (a thing is visible if a viewer would recognise it at phone size), and any framing problem (subject hidden by the caption area at ~70% down is fine; blocked lens, inside a wall, black frame, wrong place). Then, per LINE, say whether the line's must-show things appear in at least one of its cuts.` }];
  for (const f of sheets) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(f).toString("base64") } });
  const schema = { type: "object", additionalProperties: false, required: ["cuts", "lines"], properties: {
    cuts: { type: "array", items: { type: "object", additionalProperties: false, required: ["cut", "missing", "problem"], properties: { cut: { type: "integer" }, missing: { type: "array", items: { type: "string" } }, problem: { type: "string" } } } },
    lines: { type: "array", items: { type: "object", additionalProperties: false, required: ["line", "allShown", "missing"], properties: { line: { type: "integer" }, allShown: { type: "boolean" }, missing: { type: "array", items: { type: "string" } } } } } } };
  const maxTokens = 12000, worst = +((maxTokens * 10 + (sheets.length * 1800 + lines.length / 3) * 2.5) / 1e6).toFixed(4);
  L.check("vision audit", worst, { agent: true });
  const a = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json", "anthropic-beta": "server-side-fallback-2026-07-01" }, body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "user", content }], output_config: { effort: "low", format: { type: "json_schema", schema } }, fallbacks: "default" }), signal: AbortSignal.timeout(600_000) });
  const j = await res.json();
  const usd = costOf(j?.model ?? model, j?.usage ?? {});
  L.add("agent_audit", usd);
  L.log({ step: "vision_audit", sec: +((Date.now() - a) / 1000).toFixed(1), usd, usage: j?.usage ?? null, stop: j?.stop_reason ?? null });
  if (!res.ok) throw new Error(`audit ${res.status} ${JSON.stringify(j?.error ?? j).slice(0, 300)}`);
  const text = (j.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const data = JSON.parse(text);
  fs.writeFileSync(path.join(out, "vision-audit.json"), JSON.stringify(data, null, 1));
  return { ...data, usd, sheets };
}

/** the free frame check of the FINAL (the preview thresholds, studio/pixel.mjs) on the contact sheet's tiles (one frame
 *  per cut, the label strip cropped off): -> { tiles, blocked: [{ i, id, problems }] } */
export function finalFrameCheck({ dir, tl }) {
  const tiles = [], blocked = [];
  tl.shots.forEach((s, i) => {
    const f = path.join(dir, `${String(i).padStart(3, "0")}.jpg`);
    if (!fs.existsSync(f)) return;
    const buf = execFileSync("ffmpeg", ["-v", "error", "-i", f, "-vf", "crop=200:356:0:0,scale=72:128,format=gray", "-f", "rawvideo", "-"]);
    const n = 72 * 128, hist = new Map(); let s1 = 0, s2 = 0, e = 0, ec = 0;
    for (let p = 0; p < n; p++) { const v = buf[p]; s1 += v; s2 += v * v; hist.set(v >> 4, (hist.get(v >> 4) ?? 0) + 1); }
    for (let y = 0; y < 128; y++) for (let x = 0; x < 71; x++) { ec++; if (Math.abs(buf[y * 72 + x] - buf[y * 72 + x + 1]) > 14) e++; }
    const mean = s1 / n, tile = { mean: +mean.toFixed(1), sd: +Math.sqrt(Math.max(0, s2 / n - mean * mean)).toFixed(1), edge: +(e / ec).toFixed(3), flat: +(Math.max(...hist.values()) / n).toFixed(2) };
    tiles.push({ i, id: s.studio, ...tile });
    const problems = tileProblems(tile);
    if (problems.length) blocked.push({ i, id: s.studio, problems });
  });
  return { tiles, blocked };
}
