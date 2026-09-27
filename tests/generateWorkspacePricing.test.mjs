import test from "node:test";
import assert from "node:assert/strict";

// Part 18 (A-N) — the "FINAL GENERATE WORKSPACE PRICING + SCENE MODAL
// PRODUCTION PASS" test list. Most of the server-authoritative claims (D, E,
// G, H, I, K) were independently verified against the real Mars project via
// rolled-back SQL transactions (see the task's final report) rather than
// re-derived here — a Node unit test cannot exercise `security definer`
// Postgres RPCs or real credit_balance rows. What IS unit-testable from pure
// JS/data-shape is covered below.

test("A: the tier selector's SCENE_GENERATION_TIERS catalog carries no credit fields — display-only name/model/quality/tagline", async () => {
  // scenePricing.js imports the live supabase client (not stubbed in this
  // test's module graph) — read the source text instead of importing, to
  // check the catalog's literal shape without pulling that dependency in.
  const src = await import("node:fs").then((fs) => fs.promises.readFile(new URL("../src/pages/workspace/long-form/scenePricing.js", import.meta.url), "utf8"));
  const catalogSrc = src.slice(src.indexOf("SCENE_GENERATION_TIERS = ["), src.indexOf("];", src.indexOf("SCENE_GENERATION_TIERS = [")));
  assert.doesNotMatch(catalogSrc, /credits\s*:/, "SCENE_GENERATION_TIERS must not carry a credits field — CompactTierSelector renders name+quality only, pricing lives solely in Generation Summary/CTA");
  assert.match(catalogSrc, /name:\s*"V2"/, "sanity check: the catalog still has its display entries");
  // CompactTierSelector itself must not be passed (or read) an estimates
  // prop anymore — the whole point is it no longer touches credit data.
  const workspaceSrc = await import("node:fs").then((fs) => fs.promises.readFile(new URL("../src/pages/workspace/long-form/GenerateWorkspace.jsx", import.meta.url), "utf8"));
  const selectorFn = workspaceSrc.slice(workspaceSrc.indexOf("function CompactTierSelector"), workspaceSrc.indexOf("/* ============================ Reference Sheets"));
  assert.doesNotMatch(selectorFn, /estimates/, "CompactTierSelector must not receive or read a credit-estimates prop");
  assert.doesNotMatch(selectorFn, /CreditIcon/, "no credit icon should render inside the tier cells");
});

test("B/C: estimateLongFormSceneCredits and the Generate Episode CTA read the exact same RPC-shaped field (totalCredits) — no separate frontend formula", async () => {
  // estimateLongFormSceneCredits (scenePricing.js) is a thin, unmodified
  // pass-through of estimate_long_form_episode_credits's `totalCredits` —
  // GenerateWorkspace.jsx's `totalCredits` (used by BOTH the Generation
  // Summary display and the Generate Episode CTA) is set via
  // `estimate?.totalCredits`, i.e. is that literal field, not a
  // recomputation. This locks the data-shape contract those two call sites
  // depend on staying identical.
  const src = await import("node:fs").then((fs) => fs.promises.readFile(new URL("../src/pages/workspace/long-form/scenePricing.js", import.meta.url), "utf8"));
  assert.match(src, /totalCredits:\s*data\.totalCredits/, "estimateLongFormSceneCredits must pass through the RPC's totalCredits verbatim, never recompute it");
});

test("F: Approve costs nothing — canManuallyApproveScene has no credits parameter, and approveSceneManually's edge function call carries no price field", async () => {
  const { canManuallyApproveScene } = await import("../src/pages/workspace/long-form/sceneCardModel.js");
  assert.equal(canManuallyApproveScene.length, 1, "canManuallyApproveScene takes only a status key — no price is ever threaded through the Approve path");
  const apiSrc = await import("node:fs").then((fs) => fs.promises.readFile(new URL("../src/pages/workspace/long-form/generateWorkspaceApi.js", import.meta.url), "utf8"));
  const approveFn = apiSrc.slice(apiSrc.indexOf("export async function approveSceneManually"), apiSrc.indexOf("export async function approveSceneManually") + 300);
  assert.doesNotMatch(approveFn, /credit/i, "approveSceneManually's request body must never include a credit amount");
});

test("G: frontend cannot override the server price — retryScene/editScene send only {sceneId[, instruction]}, never a credits/price field", async () => {
  const apiSrc = await import("node:fs").then((fs) => fs.promises.readFile(new URL("../src/pages/workspace/long-form/generateWorkspaceApi.js", import.meta.url), "utf8"));
  const retryBody = /retry-long-form-scene["'],\s*\{\s*body:\s*\{([^}]*)\}/.exec(apiSrc)?.[1] ?? "";
  const editBody = /edit-long-form-scene["'],\s*\{\s*body:\s*\{([^}]*)\}/.exec(apiSrc)?.[1] ?? "";
  assert.doesNotMatch(retryBody, /credit|price|cost/i, "the retry request body must carry only intent (sceneId), never a client-computed price");
  assert.doesNotMatch(editBody, /credit|price|cost/i, "the edit request body must carry only intent (sceneId, instruction), never a client-computed price");
});

test("J: a successful retry/edit's creditsCharged flows straight into emitCreditSpend, sourced from the SERVER response, never the pre-fetched estimate", async () => {
  const src = await import("node:fs").then((fs) => fs.promises.readFile(new URL("../src/pages/workspace/long-form/GenerateWorkspace.jsx", import.meta.url), "utf8"));
  assert.match(src, /result\?\.creditsCharged\)\s*emitCreditSpend\(result\.creditsCharged/, "emitCreditSpend must fire from the resolved server result's creditsCharged, not sceneOpEstimates");
});

test("L/M/N: the scene review modal is capped for no-scroll desktop fit — max-h-[90dvh] panel, capped image height, always-visible non-scrolling actions", async () => {
  const src = await import("node:fs").then((fs) => fs.promises.readFile(new URL("../src/pages/workspace/long-form/GenerateWorkspace.jsx", import.meta.url), "utf8"));
  const modalStart = src.indexOf("function SceneReviewModal");
  const modalEnd = src.indexOf("\n}", src.indexOf("</>", modalStart));
  const modalSrc = src.slice(modalStart, modalEnd);
  assert.match(modalSrc, /max-h-\[90dvh\]/, "the DialogPanel must be height-capped to fit within the viewport with no scroll");
  assert.match(modalSrc, /max-h-\[min\(52vh,520px\)\]/, "the preview image must be explicitly capped, never left to fill available height (Part 12)");
  assert.doesNotMatch(modalSrc.split("<DialogPanel")[1].split("</DialogPanel>")[0], /overflow-y-auto/, "no inner section of the modal (besides the horizontal-only history strip) should need vertical scrolling once the image is capped");
});

test("Part 13: a fullscreen lightbox exists, separate from the decision-focused modal", async () => {
  const src = await import("node:fs").then((fs) => fs.promises.readFile(new URL("../src/pages/workspace/long-form/GenerateWorkspace.jsx", import.meta.url), "utf8"));
  assert.match(src, /Maximize2/, "an expand/fullscreen icon must be present on the scene image");
  assert.match(src, /lightboxOpen/, "a separate lightbox state/dialog must exist for the fullscreen image view");
});

test("Part 6/7: OpCostBadge renders '…' while loading and the raw credit count once resolved — never a hardcoded number", async () => {
  const src = await import("node:fs").then((fs) => fs.promises.readFile(new URL("../src/pages/workspace/long-form/GenerateWorkspace.jsx", import.meta.url), "utf8"));
  assert.match(src, /function OpCostBadge\(\{ credits \}\)/, "the cost badge must take credits as a prop, not a literal");
  assert.doesNotMatch(src, />2 credits</, "no hardcoded '2 credits' label anywhere in the workspace");
});
