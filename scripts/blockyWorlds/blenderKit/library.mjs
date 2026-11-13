// Blender kit engine: the ASSET LIBRARY of sets / props / vehicles / creatures the director BUILT in Blender (kit
// primitives, our code) that rendered and passed the checks. The approval idea of studio/library/: every new entry is
// PENDING; the owner approves or rejects it (node approve.mjs <id> [--reject | --pending] | --list); only APPROVED
// entries are offered to later runs (findAsset), and the brief lists them as reusable header code.
// Entry: blenderKit/library/items/<id>.json { id, name, kind, about, code (the Python builder function), source,
// status, approved, createdAt } + blenderKit/library/thumbs/<id>.jpg (a preview tile of a shot that uses it).
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const LIB = Object.freeze({ items: path.join(HERE, "library", "items"), thumbs: path.join(HERE, "library", "thumbs") });
export const KINDS = Object.freeze(["set", "prop", "vehicle", "creature"]);
const words = (s) => String(s ?? "").toLowerCase().replace(/_/g, " ").split(/[^a-z0-9]+/).filter(Boolean);

export function listAssets() {
  if (!fs.existsSync(LIB.items)) return [];
  return fs.readdirSync(LIB.items).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(LIB.items, f), "utf8"))).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/** a top-level Python function's source (def line + its indented body) from module code, or null */
export function functionSource(code, name) {
  const lines = String(code ?? "").replace(/\r/g, "").split("\n");
  let start = -1;
  for (let i = lines.length - 1; i >= 0; i--) if (new RegExp(`^def ${name}\\s*\\(`).test(lines[i])) { start = i; break; } // the last definition wins (fix rounds redefine)
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length && (lines[end].trim() === "" || /^\s/.test(lines[end]))) end++;
  while (end > start + 1 && !lines[end - 1].trim()) end--;
  return lines.slice(start, end).join("\n");
}

/** a new PENDING entry (an identical build already saved is returned as is) */
export function saveAsset({ name, kind, about = "", code, source = {}, thumbFrom = null }) {
  fs.mkdirSync(LIB.items, { recursive: true }); fs.mkdirSync(LIB.thumbs, { recursive: true });
  const hash = createHash("sha1").update(code).digest("hex").slice(0, 8);
  const id = `${words(name).join("-").slice(0, 40) || "asset"}-${hash}`;
  const file = path.join(LIB.items, `${id}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const e = { id, name, kind: KINDS.includes(kind) ? kind : "prop", about, code, source, status: "pending", approved: false, createdAt: new Date().toISOString() };
  fs.writeFileSync(file, JSON.stringify(e, null, 1));
  if (thumbFrom) spawnSync("ffmpeg", ["-v", "error", "-y", "-i", thumbFrom, "-vf", "scale=216:-2", "-q:v", "4", path.join(LIB.thumbs, `${id}.jpg`)]);
  return e;
}

export function setStatus(id, status) {
  const file = path.join(LIB.items, `${id}.json`);
  if (!fs.existsSync(file)) throw new Error(`no library entry ${id}`);
  const e = JSON.parse(fs.readFileSync(file, "utf8"));
  e.status = status; e.approved = status === "approved"; e.decidedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(e, null, 1));
  return e;
}

/** approved entries whose name shares a word with the query (best first): what a later run may reuse */
export function findAssets(query, { includePending = false } = {}) {
  const q = new Set(words(query));
  return listAssets().filter((a) => a.status !== "rejected" && (a.approved || includePending))
    .map((a) => ({ a, score: words(`${a.name} ${a.about}`).filter((w) => q.has(w)).length })).filter((x) => x.score > 0).sort((x, y) => y.score - x.score).map((x) => x.a);
}
