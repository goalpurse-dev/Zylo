import { register } from "node:module";

register("./assetStub.loader.mjs", import.meta.url);

// Some _shared/*.ts modules read Deno.env.get(...) at module-load time
// (e.g. referenceQA.ts's OPENAI_KEY) — harmless under the real Deno Edge
// Runtime, but a ReferenceError under plain Node with no shim. Tests that
// import such a module for its pure/deterministic exports (never actually
// calling the functions that need a real key) just need the global to
// exist, not to return anything real.
if (typeof globalThis.Deno === "undefined") {
  globalThis.Deno = { env: { get: () => undefined } };
}
// 2026-09-16 "production invariants" pass: importing a real edge-function
// ENTRYPOINT file (not just a _shared/*.ts module) means its module-scope
// `Deno.serve(handler)` call executes at import time under plain Node — a
// no-op stub is enough, since no test here ever sends it a request; the
// handler function itself is simply never invoked.
if (typeof globalThis.Deno.serve === "undefined") {
  globalThis.Deno.serve = () => undefined;
}
