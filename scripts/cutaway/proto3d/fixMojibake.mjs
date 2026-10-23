// Repairs text that was UTF-8 but got read as Windows-1252 and written back as UTF-8 (PowerShell 5.1 Get-Content).
// Only sequences that form a valid UTF-8 multi-byte character when mapped back to cp1252 bytes are replaced, so
// correct characters added later are left alone. Repeats until stable (files that were re-encoded twice).
import fs from "node:fs";
const CP = { 0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f };
const byteOf = (ch) => { const c = ch.codePointAt(0); if (c < 0x100) return c; return CP[c] ?? -1; };
function pass(t) {
  const chars = [...t]; let out = "", i = 0, changed = 0;
  while (i < chars.length) {
    const b0 = byteOf(chars[i]);
    const need = b0 >= 0xc2 && b0 <= 0xdf ? 1 : b0 >= 0xe0 && b0 <= 0xef ? 2 : b0 >= 0xf0 && b0 <= 0xf4 ? 3 : 0;
    if (need) {
      const bytes = [b0]; let ok = true;
      for (let k = 1; k <= need; k++) { const b = i + k < chars.length ? byteOf(chars[i + k]) : -1; if (b < 0x80 || b > 0xbf) { ok = false; break; } bytes.push(b); }
      if (ok) { const s = Buffer.from(bytes).toString("utf8"); if (!s.includes("�")) { out += s; i += need + 1; changed++; continue; } }
    }
    out += chars[i]; i++;
  }
  return [out, changed];
}
for (const f of process.argv.slice(2)) {
  let t = fs.readFileSync(f, "utf8"), total = 0;
  for (let round = 0; round < 4; round++) { const [n, c] = pass(t); if (!c) break; t = n; total += c; }
  if (total) { fs.writeFileSync(f, t, "utf8"); console.log(`${total} fixed  ${f}`); }
  const left = t.match(/Ã.|Â.|â€./g); if (left) console.log(`  still suspicious: ${left.slice(0, 5).join(" ")}`);
}
