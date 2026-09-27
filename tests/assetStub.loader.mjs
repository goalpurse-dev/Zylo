// ESM loader hook so `node --test` can import modules that transitively pull
// in binary asset files (stylePresets.js's PNG imports, via
// visualWorldPlanning.js -> getStylePreset) without a bundler. Vite resolves
// these at build time into hashed URL strings; plain Node has no built-in
// handling for a raw `import x from "./y.png"`, so every test file that
// touches visualWorldPlanning.js (nearly all of them — deriveRequiredViews,
// selectCurrentVisualWorldAssets, referenceProgress all live there) crashed
// before it could run a single assertion. This stub keeps the two module
// graphs (Vite runtime vs plain-Node test runner) working from the exact
// same source files rather than forking a test-only copy that could drift.
const ASSET_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp"]);

// Deno-only shared modules (sceneCompositor.ts) import binary-image codecs
// via Deno's `npm:package@version` specifier syntax, which plain Node's ESM
// loader rejects outright (ERR_UNSUPPORTED_ESM_URL_SCHEME). Tests that only
// exercise the PURE/deterministic pieces of a module built on top of it
// (e.g. sceneReferenceBundle.ts's sortCanonicalReferences/computeBundleHash/
// bundlePromptInstruction/buildReferenceBundleImage — none of which decode
// or encode an actual image file) never need the real codec to work, only
// for the import graph to resolve — so these are stubbed with minimal fakes
// rather than pulling in `jpeg-js` as a real, unused test-only dependency.
const NPM_STUBS = new Set(["npm:pngjs@7.0.0", "npm:jpeg-js@0.4.4"]);

// 2026-09-16 "production invariants" pass: extends the SAME pattern above to
// real edge-function ENTRYPOINT files (advance-long-form-scene-generation/
// index.ts), not just _shared/*.ts modules — needed to directly unit-test
// cropRegion/fitTextToZone/renderProgrammaticGraphicCard's real pixel math
// (the 16:9-invariant fix) rather than only a static/regex source check.
// `jsr:@supabase/functions-js/edge-runtime.d.ts` is a TYPE-ONLY import (it
// only ever declares ambient `Deno.*` types for the TS compiler) — safe to
// resolve to a genuinely empty module. `https://esm.sh/@supabase/supabase-js@2`
// is used as `createClient(...)` INSIDE the Deno.serve handler body, never
// at module load time or by any test here, so a throwing stub is enough for
// the import graph to resolve, exactly like the pngjs/jpeg-js stubs above.
const JSR_TYPE_ONLY_STUBS = new Set(["jsr:@supabase/functions-js/edge-runtime.d.ts"]);
const ESM_SH_STUBS = new Set(["https://esm.sh/@supabase/supabase-js@2"]);

export async function resolve(specifier, context, nextResolve) {
  if (NPM_STUBS.has(specifier)) {
    return { url: "test-npm-stub:" + encodeURIComponent(specifier), shortCircuit: true };
  }
  if (JSR_TYPE_ONLY_STUBS.has(specifier)) {
    return { url: "test-jsr-type-stub:" + encodeURIComponent(specifier), shortCircuit: true };
  }
  if (ESM_SH_STUBS.has(specifier)) {
    return { url: "test-esmsh-stub:" + encodeURIComponent(specifier), shortCircuit: true };
  }
  const dot = specifier.lastIndexOf(".");
  const ext = dot === -1 ? "" : specifier.slice(dot);
  if (ASSET_EXTENSIONS.has(ext)) {
    return { url: "test-asset-stub:" + encodeURIComponent(specifier), shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith("test-asset-stub:")) {
    const specifier = decodeURIComponent(url.slice("test-asset-stub:".length));
    return { format: "module", shortCircuit: true, source: `export default ${JSON.stringify(specifier)};` };
  }
  if (url.startsWith("test-jsr-type-stub:")) {
    return { format: "module", shortCircuit: true, source: "export {};" };
  }
  if (url.startsWith("test-esmsh-stub:")) {
    return { format: "module", shortCircuit: true, source: `export function createClient() { throw new Error("supabase-js stub: not implemented in tests"); }` };
  }
  if (url.startsWith("test-npm-stub:")) {
    const specifier = decodeURIComponent(url.slice("test-npm-stub:".length));
    // Both real modules are used as named exports (`import { PNG } from
    // "npm:pngjs@7.0.0"`, `import jpeg from "npm:jpeg-js@0.4.4"`) — the
    // stub only needs to exist, never to actually decode/encode real
    // pixels, for a test that never calls fetchAndDecodeImage/decodeImage/
    // encodePng to still import cleanly.
    const source = specifier.includes("jpeg-js")
      ? `export default { decode() { throw new Error("jpeg-js stub: not implemented in tests"); }, encode() { throw new Error("jpeg-js stub: not implemented in tests"); } };`
      : `export const PNG = { sync: { read() { throw new Error("pngjs stub: not implemented in tests"); }, write() { throw new Error("pngjs stub: not implemented in tests"); } } };`;
    return { format: "module", shortCircuit: true, source };
  }
  return nextLoad(url, context);
}
