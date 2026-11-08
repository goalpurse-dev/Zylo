// Blocky Worlds builder: the SHARED LIBRARY of things built for earlier videos (the kit grows with every video).
// One interface, four stores:
//   memoryCache(seed?)                  tests
//   fileCache(dir)                      local runs: <dir>/index.json + <dir>/stills/<id>.jpg
//   snapshotCache(rows, { onSave })     the RunPod prepare job: a read-only snapshot of the library handed in by the server
//                                       (the worker never gets a Supabase key); new assets are collected (and posted
//                                       back through onSave -> the job's "built" event) for the server to insert
//   supabaseCache({ url, serviceKey })  server side / admin scripts: table blocky_worlds_assets + storage
//                                       (supabase/migrations/20261203100000_blocky_worlds_assets.sql)
// Interface:
//   lookup(kind, names[]) -> asset | null      by normalized name or alias, singular/plural ("ladders" = "ladder")
//   save({ kind, name, aliases, blueprint, still?: Buffer, verdict, model, costUsd }) -> asset (with id, still_path)
//   used(id)                                   counts a reuse
// asset = { id, kind, name, aliases, keys, blueprint (the object blueprint or the world spec), still_path, verdict,
//           model, cost_usd, uses, created_at }
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { normName } from "./spec.js";
import { cleanAliases, sameThing } from "./names.js";

export const keysOf = (name, aliases = []) => [...new Set([name, ...aliases].map(normName).filter(Boolean))];
const newId = () => crypto.randomUUID();
/**
 * a key hit is a match only when the asset is the same thing as the request (objects: names.js sameThing, the head
 * noun and the defining nouns; 2026-11-09: a "clock tower" request took the bell tower through its old "clock tower"
 * alias). Rows saved before the fix still carry broad keys: this guard covers them too.
 */
export const matches = (asset, kind, names) => {
  if (asset.kind !== kind || asset.status === "retired") return false;
  const have = asset.keys ?? keysOf(asset.name, asset.aliases);
  // a request name that hits a key must also be the same thing (any one of them: the need's name, a phrase)
  return names.some((n) => n && have.includes(normName(n)) && (kind !== "object" || sameThing(n, asset.name)));
};
/** the names a new asset is saved under: objects keep only names of THAT thing (names.js), no long phrases */
export const savedAliases = (a) => (a.kind === "object" ? cleanAliases(a.name, a.aliases ?? []) : (a.aliases ?? []).filter((x) => typeof x === "string" && x.length <= 40 && x.split(/\s+/).length <= 6));
const row = (a, id) => ({
  id, kind: a.kind, name: a.name, name_key: normName(a.name), aliases: savedAliases(a), keys: keysOf(a.name, savedAliases(a)),
  blueprint: a.blueprint, still_path: a.still_path ?? null, verdict: a.verdict ?? null, model: a.model ?? null,
  cost_usd: Number(a.costUsd ?? a.cost_usd ?? 0), uses: 0, status: "live", created_at: new Date().toISOString(),
});

export function memoryCache(seed = []) {
  const list = seed.map((a) => ({ ...a, keys: a.keys ?? keysOf(a.name, a.aliases) }));
  return {
    name: "memory", list,
    async lookup(kind, names) { return list.find((a) => matches(a, kind, names)) ?? null; },
    async save(a) {
      const hit = list.find((x) => x.kind === a.kind && x.name_key === normName(a.name));
      if (hit) return hit; // the first one built wins (two videos building the same thing at once)
      const r = row(a, newId()); list.push(r); return r;
    },
    async used(id) { const a = list.find((x) => x.id === id); if (a) a.uses++; },
  };
}

export function fileCache(dir) {
  const idx = path.join(dir, "index.json");
  const read = () => { try { return JSON.parse(fs.readFileSync(idx, "utf8")); } catch { return []; } };
  const write = (l) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(idx, JSON.stringify(l, null, 1)); };
  return {
    name: "file", dir,
    async lookup(kind, names) { return read().find((a) => matches(a, kind, names)) ?? null; },
    async save(a) {
      const l = read(), hit = l.find((x) => x.kind === a.kind && x.name_key === normName(a.name));
      if (hit) return hit;
      const id = newId(), r = row(a, id);
      if (a.still) { const p = path.join(dir, "stills", `${a.kind}-${id}.jpg`); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, a.still); r.still_path = path.relative(dir, p).split(path.sep).join("/"); }
      l.push(r); write(l); return r;
    },
    async used(id) { const l = read(), a = l.find((x) => x.id === id); if (a) { a.uses++; write(l); } },
  };
}

/** the prepare job's view: the server's snapshot of the library (rows), plus what this video built (added) */
export function snapshotCache(rows = [], { onSave = null } = {}) {
  const base = memoryCache(rows), added = [], usedIds = new Set();
  return {
    name: "snapshot", added, usedIds,
    lookup: base.lookup,
    /** synchronous lookup (planVideo's library(name) for the story-critical gate): the snapshot + what this video built */
    find(kind, names) { return base.list.find((a) => matches(a, kind, names)) ?? null; },
    async save(a) {
      const r = await base.save(a);
      if (!added.includes(r) && !rows.includes(r)) { added.push(r); try { await onSave?.(r, a.still ?? null); } catch { /* the library never fails a run */ } }
      return r;
    },
    async used(id) { usedIds.add(id); },
  };
}

/** PostgREST + storage with the service-role key (edge functions / admin scripts; never the worker) */
export function supabaseCache({ url, serviceKey, bucket = "blocky-worlds-renders", fetchFn = fetch }) {
  const h = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
  const rest = `${url.replace(/\/$/, "")}/rest/v1`;
  const arr = (l) => `{${l.map((k) => `"${k.replace(/"/g, "")}"`).join(",")}}`;
  return {
    name: "supabase",
    async lookup(kind, names) {
      const keys = keysOf(names[0] ?? "", names.slice(1));
      if (!keys.length) return null;
      const r = await fetchFn(`${rest}/blocky_worlds_assets?kind=eq.${kind}&status=eq.live&keys=ov.${encodeURIComponent(arr(keys))}&select=*&order=uses.desc&limit=10`, { headers: h });
      if (!r.ok) throw new Error(`library lookup ${r.status}`);
      return (await r.json()).find((a) => matches(a, kind, names)) ?? null;
    },
    async save(a) {
      const id = newId(), rec = row(a, id);
      if (a.still) {
        rec.still_path = `assets/${a.kind}/${id}.jpg`;
        const up = await fetchFn(`${url.replace(/\/$/, "")}/storage/v1/object/${bucket}/${rec.still_path}`, { method: "POST", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "image/jpeg", "x-upsert": "true" }, body: a.still });
        if (!up.ok) rec.still_path = null;
      }
      const r = await fetchFn(`${rest}/blocky_worlds_assets?on_conflict=kind,name_key`, { method: "POST", headers: { ...h, Prefer: "return=representation,resolution=ignore-duplicates" }, body: JSON.stringify(rec) });
      if (!r.ok) throw new Error(`library save ${r.status}`);
      return (await r.json())[0] ?? (await this.lookup(a.kind, [a.name])) ?? rec;
    },
    async used(id) { await fetchFn(`${rest}/rpc/blocky_worlds_asset_used`, { method: "POST", headers: h, body: JSON.stringify({ p_id: id }) }).catch(() => {}); },
  };
}
