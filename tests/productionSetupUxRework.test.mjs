import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// 2026-10-02 "Create New Video" UX rework pass — one top-to-bottom
// progressively-unlocking form, a correctly-aligned Generate bar, real
// niche/style picker modals, and a sticky checkout-style summary panel.
// Source-pattern checks for the structural/behavioral requirements that
// don't reduce to a pure function (this file has no jsdom/React renderer
// available in this test runner — see the established convention in
// longFormRecipeAwareFlow.test.mjs).

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const PAGE = "src/pages/workspace/long-form/ProductionSetup.jsx";

test("the sticky Generate bar is offset by the real desktop sidebar width (220px, workspace/layout.jsx), and reserves MobileBottomNav's 78px + the safe-area inset as bottom PADDING (bottom:0 always, per final-polish round 3) — never just centered against the raw viewport", async () => {
  const text = await source(PAGE);
  const layoutText = await source("src/pages/workspace/layout.jsx");
  // The bar's own offset must match the sidebar's REAL width, not a guessed number.
  assert.match(layoutText, /w-\[220px\]/);
  const barFn = text.slice(text.indexOf("function GenerateBar("), text.indexOf("const DEFAULT_STYLE_ID"));
  assert.match(barFn, /lg:left-\[220px\]/);
  assert.match(barFn, /bottom-0/);
  assert.match(barFn, /pb-\[calc\(78px\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(barFn, /lg:pb-\[env\(safe-area-inset-bottom\)\]/);
});

test("final-polish round 3, Section 2: exactly one Generate surface exists at a time — the side-panel button when hasSidePanel, the sticky bottom bar otherwise — decided by the SAME hasSidePanel state that drives the two-column grid, never a separate breakpoint", async () => {
  const text = await source(PAGE);
  const mainReturn = text.slice(text.indexOf('return (\n    <div className="mx-auto max-w-[1180px]'));
  // The bar is now explicitly gated OFF when the side panel is showing.
  assert.match(mainReturn, /\{!hasSidePanel && \(\s*<GenerateBar/);
  // The side-panel button is gated ON exactly when the bar is gated off.
  assert.match(mainReturn, /\{hasSidePanel && \(\s*<aside/);
  assert.match(mainReturn, /<GenerateButton[\s\S]{0,200}onClick=\{handleGenerateVideo\}/);
  // Exactly one CALL SITE wires handleGenerateVideo to each surface — one
  // direct (the side-panel button), one via GenerateBar's onGenerate prop.
  const directWiring = mainReturn.match(/onClick=\{handleGenerateVideo\}/g) ?? [];
  assert.equal(directWiring.length, 1, "expected exactly one direct onClick wiring (the side-panel button)");
  const barWiring = text.match(/onGenerate=\{handleGenerateVideo\}/g) ?? [];
  assert.equal(barWiring.length, 1, "expected exactly one onGenerate wiring (the bottom bar)");
  const btnFn = text.slice(text.indexOf("function GenerateButton("), text.indexOf("function GenerateBar("));
  assert.match(btnFn, /onClick=\{onClick\}/);
});

test("sections are numbered in the exact required sequence: Niche(1) -> Visual Style(2) -> Topic(3) -> Length(4) -> Quality(5), and Quality is no longer inside Advanced Settings", async () => {
  const text = await source(PAGE);
  const order = ["<SectionLabel n={1}>Niche", "<SectionLabel n={2}>Visual Style", "<SectionLabel n={3}>Topic", "<SectionLabel n={4}>Length", "<SectionLabel n={5}>Quality"];
  let cursor = -1;
  for (const marker of order) {
    const idx = text.indexOf(marker);
    assert.ok(idx > cursor, `expected to find "${marker}" after the previous section`);
    cursor = idx;
  }
  // Quality's own RENDER_TIER_OPTIONS block must render OUTSIDE the collapsed
  // Advanced Settings panel — i.e. before the "Advanced Settings" toggle button.
  const qualityIdx = text.indexOf("<SectionLabel n={5}>Quality");
  const advancedIdx = text.indexOf("Advanced Settings</span>");
  assert.ok(qualityIdx < advancedIdx, "Quality must render before (outside) the Advanced Settings panel");
});

test("sections 2-5 and Advanced Settings are wrapped in LockedSection, which uses `inert` + aria-disabled + pointer-events-none/opacity-40 — never just a visual dim with no real interaction block", async () => {
  const text = await source(PAGE);
  assert.match(text, /function LockedSection\(\{ locked, children \}\)/);
  assert.match(text, /inert=\{locked \? true : undefined\}/);
  assert.match(text, /aria-disabled=\{locked\}/);
  assert.match(text, /pointer-events-none opacity-40/);
  // Everything from Topic through Advanced Settings must be nested inside one LockedSection.
  const lockedOpen = text.indexOf("<LockedSection locked={nicheLocked}>");
  const lockedClose = text.indexOf("</LockedSection>");
  assert.ok(lockedOpen > -1 && lockedClose > lockedOpen);
  const lockedBody = text.slice(lockedOpen, lockedClose);
  for (const marker of ["<SectionLabel n={2}>Visual Style", "<SectionLabel n={3}>Topic", "<SectionLabel n={4}>Length", "<SectionLabel n={5}>Quality", "Advanced Settings</span>"]) {
    assert.ok(lockedBody.includes(marker), `expected "${marker}" inside the locked wrapper`);
  }
  // The Niche section itself must be OUTSIDE the lock (it's what unlocks everything else).
  assert.ok(text.indexOf("<SectionLabel n={1}>Niche") < lockedOpen);
});

test("the helper line 'Choose a niche to unlock the rest.' only shows while locked, and the prominent unselected niche card carries the Start here tag plus a chevron", async () => {
  const text = await source(PAGE);
  assert.match(text, /\{nicheLocked && <p[^>]*>Choose a niche to unlock the rest\.<\/p>\}/);
  assert.match(text, /Start here/);
  assert.match(text, /ChevronRight/);
});

test("both the niche picker and style picker use the existing headlessui Dialog/DialogPanel/DialogTitle component (real focus trap + Esc + backdrop-click, not a hand-rolled modal div)", async () => {
  const text = await source(PAGE);
  assert.match(text, /import \{ Dialog, DialogPanel, DialogTitle \} from "@headlessui\/react"/);
  assert.match(text, /function NichePickerModal/);
  assert.match(text, /function StylePickerModal/);
  const nicheModalBody = text.slice(text.indexOf("function NichePickerModal"), text.indexOf("function StylePickerModal"));
  assert.match(nicheModalBody, /<Dialog open=\{open\} onClose=\{close\}/);
  assert.match(nicheModalBody, /<DialogPanel/);
});

test("the niche picker has a search input and category chips including 'All', filtering the real NICHE_GROUPS/ALL_NICHES data — never a separate hardcoded list", async () => {
  const text = await source(PAGE);
  assert.match(text, /placeholder="Search niches…"/);
  assert.match(text, /\{ id: "all", label: "All" \}/);
  assert.match(text, /ALL_NICHES\.filter/);
});

test("an unavailable (non-production-ready) style is disabled with a lock icon and 'Coming soon' badge in the style picker, and can never be selected", async () => {
  const text = await source(PAGE);
  const styleModalBody = text.slice(text.indexOf("function StylePickerModal"), text.indexOf("function LockedSection"));
  assert.match(styleModalBody, /disabled=\{!selectable\}/);
  assert.match(styleModalBody, /Coming soon/);
  assert.match(styleModalBody, /<Lock className/);
});

test("Topic is one field with a segmented control (Write my own / Get ideas for me) inside the Topic section — no separate top-level mode tabs", async () => {
  const text = await source(PAGE);
  assert.match(text, /Write my own/);
  assert.match(text, /Get ideas for me/);
  // The old top-level "Start with a topic" / "Discover ideas" tabs must be gone.
  assert.doesNotMatch(text, /Start with a topic/);
  assert.doesNotMatch(text, /"discovery"\)/); // no leftover creationMode==="discovery" branching
});

test("selecting a generated idea fills the SAME topic textarea (editable, via Edit this idea) and keeps the ideas grid open with the card selected", async () => {
  const text = await source(PAGE);
  const fn = text.slice(text.indexOf("const handleUseIdea = (idea) =>"), text.indexOf("const handleGenerateVideo ="));
  assert.match(fn, /setTopic\(idea\.topic\);/);
  assert.doesNotMatch(fn, /setTopicMode\("write"\);/);
  assert.match(text, /data-testid="selected-idea"/);
});

test("the idea list shows loading skeletons while generating and offers Regenerate afterward", async () => {
  const text = await source(PAGE);
  assert.match(text, /function IdeaSkeleton/);
  assert.match(text, /ideasLoading &&/);
  assert.match(text, /Regenerate/);
});

test("the topic placeholder is always niche-specific (exampleTopicForNiche), never a generic rotating example unrelated to the chosen niche", async () => {
  const text = await source(PAGE);
  assert.match(text, /placeholder=\{nicheId \? exampleTopicForNiche\(nicheId\) : ""\}/);
  const niches = await source("src/pages/workspace/long-form/niches.js");
  assert.match(niches, /export function exampleTopicForNiche/);
});

test("the large inline Visual Style grid is gone from the main page — it's a compact single row that opens a modal", async () => {
  const text = await source(PAGE);
  const mainBody = text.slice(text.indexOf("return (\n    <div className=\"mx-auto max-w-[1180px]"));
  // The full multi-card grid (sm:grid-cols-2 style grid) must not appear inline in the page body outside the modal.
  const beforeModalFns = text.slice(0, text.indexOf("function LockedSection"));
  assert.doesNotMatch(mainBody.slice(mainBody.indexOf("Visual Style</p>".length)), /grid-cols-1 gap-3 sm:grid-cols-2[\s\S]{0,80}VISUAL_STYLES\.map/);
  assert.match(text, /onClick=\{\(\) => setStyleModalOpen\(true\)\}/);
});

test("Quality renders as three primary option cards (not chips inside Advanced Settings) using the exact required copy, with the V3 tier marked recommended", async () => {
  const text = await source(PAGE);
  assert.match(text, /"Quickest and cheapest\. Good for drafts\."/);
  assert.match(text, /"Best balance of detail and cost\."/);
  assert.match(text, /"Maximum detail\. Slowest\."/);
  const v3 = /\{ value: "v3", label: "V3 High Quality", description: "Best balance of detail and cost\.", quality: \d, cost: \d, recommended: true \}/; // price per minute comes from tool_prices (lib/longFormTiers)
  assert.match(text, v3);
});

test("the Quality indicator is labeled 'Quality' (not 'Speed'), with V2=1/3, V3=2/3, V4=3/3, and a separate Cost indicator is kept", async () => {
  const text = await source(PAGE);
  assert.match(text, /\{ value: "v2", label: "V2 Fast", description: "Quickest and cheapest\. Good for drafts\.", quality: 1, cost: 1 \}/);
  assert.match(text, /\{ value: "v4", label: "V4 Ultra", description: "Maximum detail\. Slowest\.", quality: 3, cost: 3 \}/);
  assert.match(text, />Quality \{\[1, 2, 3\]\.map/);
  assert.match(text, />Cost \{\[1, 2, 3\]\.map/);
  assert.doesNotMatch(text, />Speed \{/);
});

test("On-Screen Text copy is plain human language, never an internal enum token like SHORT_TEXT_ALLOWED shown to users", async () => {
  // Narrowed to the actual rendered field values (never the file's own
  // explanatory comments, which legitimately name the internal enum tokens
  // to document that they must NOT appear in the description copy below).
  const { ON_SCREEN_TEXT_GUIDANCE } = await import("../src/pages/workspace/long-form/onScreenTextGuidance.js");
  for (const [key, opt] of Object.entries(ON_SCREEN_TEXT_GUIDANCE)) {
    assert.doesNotMatch(opt.description, /SHORT_TEXT_ALLOWED|NO_TEXT|PROGRAMMATIC_TEXT_REQUIRED/, `${key}'s description must be plain copy`);
  }
  assert.equal(ON_SCREEN_TEXT_GUIDANCE.minimal.description, "Text on about 1 in 10 scenes.");
  assert.equal(ON_SCREEN_TEXT_GUIDANCE.balanced.description, "About 1 in 5 scenes: numbers, names and questions.");
  assert.equal(ON_SCREEN_TEXT_GUIDANCE.frequent.description, "About 1 in 3 scenes, with more labels and highlights.");

  const pageText = await source(PAGE);
  assert.doesNotMatch(pageText, /stickman_doodle_explainer"|STICKMAN_DOODLE_EXPLAINER_V1"/);
});

test("the estimate is shown as soon as a niche is picked (a style is always preselected) — the old 'Choose a Visual Style to see your quote' gate is gone", async () => {
  const text = await source(PAGE);
  assert.doesNotMatch(text, /Choose a Visual Style to see your quote/);
  assert.match(text, /const \[visualStyleId, setVisualStyleId\] = useState\(DEFAULT_STYLE_ID\)/);
  assert.match(text, /Pick a niche to see your estimate\./);
});

test("Generate is disabled until niche + topic are both set, and the exact reason is shown next to it", async () => {
  const text = await source(PAGE);
  assert.match(text, /"Pick a niche to continue"/);
  assert.match(text, /"Add a topic to continue"/);
  assert.match(text, /canGenerate = Boolean\(discoverySessionId\) && Boolean\(nicheId\) && topic\.trim\(\)\.length > 0 && Boolean\(selectedStyle\)/);
});

test("niches.js supplies a description, an example topic, and a stable machine-readable id for every niche, plus the 5 required category accent colors", async () => {
  const { ALL_NICHES, NICHE_CATEGORY_COLORS } = await import("../src/pages/workspace/long-form/niches.js");
  for (const niche of ALL_NICHES) {
    assert.ok(niche.description && niche.description.length > 0, `${niche.id} needs a description`);
    assert.ok(niche.exampleTopic && niche.exampleTopic.length > 0, `${niche.id} needs an exampleTopic`);
  }
  for (const groupId of ["history", "mind_body", "animals_nature", "science_universe", "money_modern_life"]) {
    assert.ok(NICHE_CATEGORY_COLORS[groupId]?.from && NICHE_CATEGORY_COLORS[groupId]?.to, `${groupId} needs a category color`);
  }
});

test("this pass makes no DIRECT provider calls from the client — thumbnail generation goes through the dedicated generate-long-form-idea-thumbnails edge function + the standard watchJob poller, never a raw runware/thirty-days/cooking- invoke", async () => {
  const text = await source(PAGE);
  // "elevenlabs" legitimately appears once, as the already-approved
  // voiceProvider metadata string forwarded to createProductionSetup (an
  // existing, previously-reviewed call).
  assert.doesNotMatch(text, /supabase\.functions\.invoke\("runware|invoke\("thirty-days|invoke\("cooking-/i);
  assert.match(text, /voiceProvider: "elevenlabs"/);
  // Final-polish round 4, Section 4 — thumbnail generation legitimately
  // reuses the standard job pipeline now (watchJob + the dedicated edge
  // function client), same as every other Zyvo image tool.
  assert.match(text, /import \{ watchJob \} from "\.\.\/\.\.\/\.\.\/lib\/jobs";/);
  assert.match(text, /import \{ submitIdeaThumbnailJobs, IDEA_THUMBNAIL_ERROR \} from "\.\/ideaThumbnailJobs";/);
});

// 2026-10-02 "Create New Video" follow-up polish pass.

test("the unselected niche card has no thick border/glow — a 1px ~35% lime border, a faint ~3.5% lime tint layer, no box-shadow — and reverts to the plain neutral card border once a niche is picked", async () => {
  const text = await source(PAGE);
  // Anchored on "Choose your niche" (unique to the real rendered card) rather
  // than the bare "{nicheLocked ? (" token, which also appears earlier in
  // the file inside the `summary` JS expression (built before the JSX
  // return) and would otherwise be matched first.
  const cardTextIdx = text.indexOf("Choose your niche");
  const startIdx = text.lastIndexOf("{nicheLocked ? (", cardTextIdx);
  const middleIdx = text.indexOf(") : (", cardTextIdx);
  const endIdx = text.indexOf("{nicheLocked && <p", middleIdx);
  const startCardBlock = text.slice(startIdx, middleIdx);
  assert.match(startCardBlock, /border border-lime-300\/35/);
  assert.doesNotMatch(startCardBlock, /border-2 border-lime-300\/50|shadow-\[/);
  assert.match(startCardBlock, /bg-lime-300\/\[0\.035\]/);
  assert.match(startCardBlock, /hover:border-lime-300\/60/);
  assert.match(startCardBlock, /group-hover:translate-x-0\.5/);
  const selectedCardBlock = text.slice(middleIdx, endIdx);
  assert.match(selectedCardBlock, /border border-white\/\[0\.08\] bg-\[#151719\]/);
});

test("the niche start-here sweep animation runs once (~1.5s) on mount and is fully disabled under prefers-reduced-motion", async () => {
  const text = await source(PAGE);
  assert.match(text, /animation: zyvoNicheSweep 1\.5s ease-out 1;/);
  assert.match(text, /@media \(prefers-reduced-motion: reduce\) \{\s*\.zyvo-niche-start-sweep \{ animation: none; display: none; \}/);
});

test("the 'Start here' pill is lighter weight, lime-on-faint-lime, with no heavy border", async () => {
  const text = await source(PAGE);
  const pillMatch = text.match(/<span className="mb-1 inline-flex items-center rounded-full ([^"]+)">\s*Start here/);
  assert.ok(pillMatch, "expected to find the Start here pill");
  assert.match(pillMatch[1], /bg-lime-300\/10/);
  assert.doesNotMatch(pillMatch[1], /border\b/);
  assert.doesNotMatch(pillMatch[1], /font-bold/);
});

test("an unavailable style's IMAGE gets grayscale(70%)/brightness(50%) via the `dim` prop, its title/description are muted, it has no hover border/lift, and it exposes aria-disabled + a 'Coming soon' tooltip instead of the native disabled attribute (so a tooltip can still show)", async () => {
  const text = await source(PAGE);
  assert.match(text, /style=\{dim \? \{ filter: "grayscale\(70%\) brightness\(50%\)" \} : undefined\}/);
  const styleModalBody = text.slice(text.indexOf("function StylePickerModal"), text.indexOf("function LockedSection"));
  assert.match(styleModalBody, /dim=\{!selectable\}/);
  assert.match(styleModalBody, /aria-disabled=\{!selectable\}/);
  assert.match(styleModalBody, /title=\{!selectable \? "Coming soon" : undefined\}/);
  assert.doesNotMatch(styleModalBody, /\sdisabled=\{!selectable\}/);
  assert.match(styleModalBody, /selectable \? "text-white" : "text-white\/35"/);
  assert.match(styleModalBody, /selectable \? "text-white\/45" : "text-white\/25"/);
  // Unavailable cards must not carry the same hover:border-white/20 an available card gets.
  assert.match(styleModalBody, /: "cursor-not-allowed border-white\/\[0\.06\]"/);
});

test("final-polish round 4, Section 4 — the ideas grid is a responsive 1/2/3-column grid of thumbnail-topped cards (matching the style-modal card design: 16:9 image, 2-line title, 1-line hook), clicking a card marks it selected with a check icon", async () => {
  const text = await source(PAGE);
  assert.match(text, /grid grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3/);
  assert.match(text, /<IdeaThumbnail\s/);
  assert.match(text, /line-clamp-2 text-\[13px\] font-bold leading-snug text-white/);
  assert.match(text, /line-clamp-1 text-\[11\.5px\] text-white\/45/);
  assert.match(text, /selected && <Check className="h-4 w-4 shrink-0 text-lime-300" \/>/);
});

test("the ideas scroll container is capped to a '2 rows + partial 3rd row' peek height with overflow-y auto, has a themed slim scrollbar, and shows/hides top and bottom fades based on real scroll position", async () => {
  const text = await source(PAGE);
  // Final-polish round 4, Section 4 — the cards are now thumbnail-topped
  // (taller, and a different height at each breakpoint since a 16:9
  // thumbnail's height tracks the card's own width) so the peek height can
  // no longer be one hardcoded px constant — it's measured off the first
  // real card via a ResizeObserver instead.
  assert.match(text, /style=\{\{ maxHeight: `\$\{ideasMaxHeight\}px` \}\}/);
  assert.match(text, /const \[ideasMaxHeight, setIdeasMaxHeight\] = useState\(259\);/);
  assert.match(text, /setIdeasMaxHeight\(Math\.round\(2 \* h \+ 2 \* IDEA_GRID_GAP \+ 0\.35 \* \(h \+ IDEA_GRID_GAP\)\)\)/);
  assert.match(text, /zyvo-ideas-scroll/);
  assert.match(text, /::-webkit-scrollbar \{ width: 6px; \}/);
  assert.match(text, /ideasScrollState\.atTop \? "opacity-0" : "opacity-100"/);
  assert.match(text, /ideasScrollState\.atBottom \? "opacity-0" : "opacity-100"/);
});

test("the 'Scroll for N more ideas' hint only shows while there ARE more (not at the bottom, and hiddenCount > 0), and the scroll state is recomputed on scroll, resize, and whenever the idea list changes", async () => {
  const text = await source(PAGE);
  assert.match(text, /!ideasScrollState\.atBottom && ideasScrollState\.hiddenCount > 0/);
  assert.match(text, /Scroll for \{ideasScrollState\.hiddenCount\} more idea/);
  assert.match(text, /el\.addEventListener\("scroll", recomputeIdeasScrollState/);
  assert.match(text, /new ResizeObserver\(recomputeIdeasScrollState\)/);
  assert.match(text, /window\.addEventListener\("resize", recomputeIdeasScrollState\)/);
  assert.match(text, /\}, \[ideas\]\);/);
});

test("a fully-visible short idea list (fits within 2 rows) naturally shows no scroll/fades/hint — the same real scrollHeight<=clientHeight math handles it without a special case", async () => {
  const text = await source(PAGE);
  const fn = text.slice(text.indexOf("const recomputeIdeasScrollState ="), text.indexOf("useEffect(() => {\n    recomputeIdeasScrollState();"));
  assert.match(fn, /const atBottom = scrollHeight - scrollTop - clientHeight <= 2;/);
  assert.match(fn, /const atTop = scrollTop <= 2;/);
  assert.match(fn, /const hiddenCount = atBottom \? 0 : Math\.max\(1, Math\.round\(hiddenRatio \* ideas\.length\)\);/);
});

test("loading state renders exactly 6 skeleton cards (2 full rows at 3 columns) shaped like the real thumbnail-topped card in the same grid, so loading -> loaded never jumps the layout, and the Generate/Regenerate button never disappears mid-flow logic", async () => {
  const text = await source(PAGE);
  assert.match(text, /Array\.from\(\{ length: 6 \}\)\.map\(\(_, i\) => <IdeaSkeleton key=\{i\} \/>\)/);
  const skeletonFn = text.slice(text.indexOf("function IdeaSkeleton"), text.indexOf("function IdeaThumbnail"));
  assert.match(skeletonFn, /aspect-video w-full animate-pulse bg-white\/\[0\.06\]/);
  assert.match(text, /label=\{isRegenerate \? "Regenerate" : "Generate 10 ideas"\}/);
});

test("idea generation errors show an inline 'Try again' button in the same area, never just a dead-end message", async () => {
  const text = await source(PAGE);
  const errorBlock = text.slice(text.indexOf("{ideasError && ("), text.indexOf("{(ideasLoading || ideas.length > 0) && ("));
  assert.match(errorBlock, /Try again/);
  assert.match(errorBlock, /onClick=\{\(\) => runGenerateIdeas\(ideas\)\}/);
});

// 2026-10-03 "fixes round 3" pass.

test("opening the page never creates a visible project — only a disposable discovery session; the real project is created (as status:'draft') only inside handleGenerateVideo, and only becomes visible once the reservation succeeds", async () => {
  const text = await source(PAGE);
  const mountEffectEnd = text.indexOf("// Persists the rest of the draft");
  const mountArea = text.slice(0, mountEffectEnd);
  assert.doesNotMatch(mountArea, /createLongFormProject\(/);
  assert.match(text, /initialStatus: "draft"/);
  const setupText = await source("supabase/functions/create-long-form-production-setup/index.ts");
  assert.match(setupText, /if \(project\.status === "draft"\) \{/);
  assert.match(setupText, /status: "planning" \}\)\.eq\("id", projectId\)/);
});

test("the discovery session is persisted to localStorage and reused across mounts — refreshing/reopening never mints a new session (and never a new draft project) when a valid one is already saved", async () => {
  const text = await source(PAGE);
  assert.match(text, /const DRAFT_STORAGE_KEY = "zyvo:long-form:production-setup-draft:v1";/);
  assert.match(text, /const existing = await fetchDiscoverySession\(saved\.discoverySessionId\);/);
  assert.match(text, /setDiscoverySessionId\(existing\.id\);/);
  // Falls back to minting a fresh session only when the saved one doesn't resolve.
  assert.match(text, /const result = await createDiscoverySession\(\);/);
});

test("the persisted draft is cleared once Generate actually succeeds, so a finished commitment's inputs never resurrect on the next fresh visit", async () => {
  const text = await source(PAGE);
  const generateFn = text.slice(text.indexOf("const handleGenerateVideo ="), text.indexOf("const summary = ("));
  assert.match(generateFn, /clearPersistedDraft\(\);/);
  assert.match(generateFn, /navigate\(`\/long-form\/project\/\$\{projectId\}\/story`\);/);
});

test("session-creation failures show an inline message with a real 'Try again' retry (bootstrapSession) inside the one sticky Generate bar, never 'Refresh to try again' or a bare paragraph orphaned at the bottom of the form", async () => {
  const text = await source(PAGE);
  assert.doesNotMatch(text, /Refresh to try again/);
  // Final-polish pass, Section 1: consolidated from two mutually-exclusive
  // render paths (each needing its own retry wiring) down to the one bar —
  // exactly one occurrence now, not orphaned and not duplicated. GenerateBar
  // receives bootstrapSession once, via its onRetrySession prop, and wires
  // it to the real "Try again" button internally.
  const occurrences = text.match(/onRetrySession=\{bootstrapSession\}/g) ?? [];
  assert.equal(occurrences.length, 1, "expected exactly one Try-again retry wired to bootstrapSession, inside the single Generate bar");
  const barFn = text.slice(text.indexOf("function GenerateBar("), text.indexOf("const DEFAULT_STYLE_ID"));
  assert.match(barFn, /onClick=\{onRetrySession\}/);
});

test("the two-column layout turns on from this component's OWN measured content width (ResizeObserver), never a raw xl: viewport media query — so a viewport wide enough to trigger xl: but with the real sidebar eating into it no longer overflows the summary panel/Generate button off-screen", async () => {
  const text = await source(PAGE);
  assert.match(text, /const SIDE_PANEL_MIN_CONTAINER_WIDTH = 1080;/);
  assert.match(text, /new ResizeObserver\(measure\)/);
  assert.match(text, /setHasSidePanel\(el\.getBoundingClientRect\(\)\.width >= SIDE_PANEL_MIN_CONTAINER_WIDTH\)/);
  assert.doesNotMatch(text, /xl:grid xl:grid-cols/);
  assert.match(text, /className=\{hasSidePanel \? "grid grid-cols-\[1fr_340px\]/);
});

test("the sticky summary panel binds to #workspace-scroll (the real, nearest, correctly-scrolling ancestor) — no intermediate ancestor between it and the viewport sets its own overflow that would break sticky positioning", async () => {
  const layoutText = await source("src/pages/workspace/layout.jsx");
  // #workspace-scroll must be the ancestor a sticky child inside <Outlet/> hits FIRST.
  const scrollIdx = layoutText.indexOf('id="workspace-scroll"');
  const outletIdx = layoutText.indexOf("<Outlet");
  assert.ok(scrollIdx > -1 && outletIdx > scrollIdx, "Outlet must render inside #workspace-scroll");
  // The nearest wrapping div with its own overflow (MAIN, overflow-x-hidden) must be
  // an ANCESTOR of #workspace-scroll, never sit between it and the Outlet/sticky child.
  const mainOverflowIdx = layoutText.indexOf("overflow-x-hidden");
  assert.ok(mainOverflowIdx > -1 && mainOverflowIdx < scrollIdx, "overflow-x-hidden must wrap #workspace-scroll from outside, not sit between it and the page content");
  const pageText = await source(PAGE);
  // Final-polish round 4, Section 1 — the jitter fix drops the JS-computed
  // `--zyvo-content-top` var from the sticky panel entirely (see the report):
  // `top-6` alone is already correct (sticky resolves against #workspace-scroll,
  // not the true viewport), and max-height is now built from constants that
  // don't change while scrolling.
  assert.match(pageText, /className="sticky top-6 flex flex-col"/);
  assert.match(pageText, /maxHeight: "calc\(100dvh - 56px - var\(--zyvo-notice-height, 0px\) - 24px - 24px\)"/);
  assert.doesNotMatch(pageText, /zyvo-content-top/, "the sticky panel must not depend on the scroll-adjacent --zyvo-content-top var");
});

test("the Visual Style row preview is a real 200px-wide (desktop) 16:9 thumbnail, scaling down on mobile — not the old 96px (w-24) thumbnail, and shares its exact class with the selected-niche row thumbnail (final-polish round 4, Section 3)", async () => {
  const text = await source(PAGE);
  assert.match(text, /const SELECTED_ROW_THUMB_CLASS = "aspect-video w-28 shrink-0 rounded-lg object-cover sm:w-36 lg:w-\[200px\]"/);
  const usages = text.match(/className=\{SELECTED_ROW_THUMB_CLASS\}/g) ?? [];
  assert.equal(usages.length, 2, "expected exactly two usages: the niche row and the Visual Style row");
});

test("the summary panel shows the selected idea's own thumbnail (highest priority), then the selected NICHE's image (with a small style-label overlay), then falls back to the style preview — never a broken/missing preview", async () => {
  const text = await source(PAGE);
  assert.match(text, /function SummaryPreviewImage\(\{ niche, style, ideaThumbnailUrl \}\)/);
  const fn = text.slice(text.indexOf("function SummaryPreviewImage"), text.indexOf("function NichePickerModal"));
  // Final-polish round 4, Section 4 — the idea's own thumbnail outranks the niche image.
  assert.match(fn, /if \(ideaThumbnailUrl\) \{/);
  assert.match(fn, /src=\{`\/images\/niches\/\$\{niche\.id\}\.webp`\}/);
  assert.match(fn, /onError=\{\(\) => setNicheFailed\(true\)\}/);
  assert.match(fn, /\{style\.label\}/);
  assert.match(text, /<SummaryPreviewImage key=\{selectedIdeaThumbnailUrl \?\? niche\?\.id \?\? "none"\}/);
});

test("project cards: thumbnail priority is finished-scene > concept-preview > locked-style-preview > clapperboard, status uses the 7-bucket human vocabulary (never raw topLevel/statusLabel), title clamps to 2 lines, and there's a real ⋯ menu with Open/Rename/Delete", async () => {
  const sharedText = await source("src/pages/workspace/long-form/shared.jsx");
  assert.match(sharedText, /project\._thumbnailUrl/);
  assert.match(sharedText, /humanizeProjectStatus\(stage\)/);
  assert.doesNotMatch(sharedText, /\$\{stage\.topLevel\} · \$\{stage\.statusLabel\}/);
  assert.match(sharedText, /line-clamp-2 min-h-\[2\.6em\]/);
  assert.match(sharedText, /<Menu>/);
  assert.match(sharedText, /onClick=\{open\}[\s\S]{0,400}?Open/);
  assert.match(sharedText, /onClick=\{handleRename\}[\s\S]{0,400}?Rename/);
  assert.match(sharedText, /onClick=\{handleDelete\}[\s\S]{0,400}?Delete/);

  const projectText = await source("src/pages/workspace/long-form/project.js");
  // V2 launch fixes: no style/niche art as a cover — the chosen idea's thumbnail, else a neutral title cover.
  assert.match(projectText, /finishedSceneUrl \?\? conceptPreviewUrl \?\? null/);
  assert.doesNotMatch(projectText, /stylePreviewUrl/);
  assert.match(sharedText, /<NeutralCover title=\{title\} \/>/);

  const stageText = await source("src/pages/workspace/long-form/projectStage.js");
  assert.match(stageText, /export function humanizeProjectStatus/);
  for (const bucket of ["Writing script", "Ready to review", "Generating visuals", "Needs your review", "Rendering", "Done", "Failed"]) {
    assert.ok(stageText.includes(bucket), `missing human status bucket: ${bucket}`);
  }
});

test("fetchUserLongFormProjects excludes drafts and soft-deleted rows from 'Your Long Form Videos'", async () => {
  const text = await source("src/pages/workspace/long-form/project.js");
  assert.match(text, /\.is\("deleted_at", null\)\.neq\("status", "draft"\)/);
});

test("delete-long-form-project is a soft delete (sets deleted_at) with an ownership check — never a real DELETE FROM, and idempotent on an already-deleted project", async () => {
  const text = await source("supabase/functions/delete-long-form-project/index.ts");
  assert.doesNotMatch(text, /\.delete\(\)/);
  assert.match(text, /update\(\{ deleted_at: new Date\(\)\.toISOString\(\) \}\)/);
  assert.match(text, /project\.user_id !== user\.id/);
  assert.match(text, /if \(project\.deleted_at\) return ok/);
});

test("the hero banner subtitle no longer duplicates the heading's 'Turn any topic into...' opening", async () => {
  // Lobby redesign: the compact create card's supporting line sits next to the button.
  const text = await source("src/pages/workspace/long-form/index.jsx");
  assert.match(text, /8–15 min · script, voice, scenes and thumbnails/);
  const subtitleLine = text.split("\n").find((l) => l.includes("8–15 min · script"));
  assert.ok(!subtitleLine.includes("Turn any topic into"));
});

// Final-polish round — sticky Generate bar, premium Generate button, fanned
// niche empty state, and the step-number circle fix.

test("the price block shows the live credit quote and a live balance projection ('Balance N -> N-cost') via the real useProfileCredits hook — never a hardcoded balance number", async () => {
  const text = await source(PAGE);
  assert.match(text, /import \{ useProfileCredits \} from "\.\.\/\.\.\/\.\.\/hooks\/useProfileCredits";/);
  assert.match(text, /const credits = useProfileCredits\(\);/);
  const barFn = text.slice(text.indexOf("function GenerateBar("), text.indexOf("const DEFAULT_STYLE_ID"));
  assert.match(barFn, /const projectedBalance = quote && typeof credits === "number" \? Math\.max\(0, credits - quote\.totalCredits\) : null;/);
  assert.match(barFn, /Balance \{credits\.toLocaleString\(\)\} → \{projectedBalance\.toLocaleString\(\)\}/);
});

test("final-polish round 3, Section 2: the bottom bar is now just the button plus one context line below it (the disabled reason, or the balance line when enabled/available) — no niche recap, no separate price display outside the button", async () => {
  const text = await source(PAGE);
  const barFn = text.slice(text.indexOf("function GenerateBar("), text.indexOf("const DEFAULT_STYLE_ID"));
  assert.doesNotMatch(barFn, /niche/i);
  assert.doesNotMatch(barFn, /lengthMinutes/);
  assert.doesNotMatch(barFn, /renderTier/);
  assert.match(barFn, /showReason \? \(/);
  assert.match(barFn, /<p className="mt-2 text-center text-\[12px\] text-white\/35">\{disabledReason\}<\/p>/);
  assert.match(barFn, /projectedBalance != null && \(/);
});

test("final-polish round 3, Section 1: the Generate button matches the Short Form generator's own recipe — 'Generate video', the credit icon + live amount INSIDE the button, and a trailing chevron — the credit cost is now baked into the button, not shown beside it", async () => {
  const text = await source(PAGE);
  const btnFn = text.slice(text.indexOf("function GenerateButton("), text.indexOf("function GenerateBar("));
  // Final-polish round 4, Section 4 — label/loadingLabel are now props
  // (default "Generate video"/"Starting…", unchanged for every existing
  // call site) so the SAME component/animations can be reused verbatim for
  // the ideas panel's Generate/Regenerate and Refresh-thumbnails buttons.
  assert.match(btnFn, /label = "Generate video", loadingLabel = "Starting…"/);
  assert.match(btnFn, /<span>\{label\}<\/span>/);
  assert.match(btnFn, /const showPrice = typeof credits === "number";/);
  assert.match(btnFn, /WebkitMaskImage: "url\('\/icons\/credits\.png'\)"/);
  assert.match(btnFn, /<AnimatedNumber value=\{credits\} play=\{justUnlocked\} duration=\{500\} reducedMotion=\{reducedMotion\} \/>/);
  assert.match(btnFn, /<ChevronRight className="h-4 w-4 shrink-0" \/>/);
  // Loading state morphs the button itself (never a second spinner elsewhere).
  assert.match(btnFn, /Starting…/);
  assert.doesNotMatch(text, /GENERATE VIDEO/);
});

test("final-polish round 3, Section 1: disabled state keeps the same shape/layout with a MUTED/DESATURATED lime fill (never the old dark-grey bg-[#202224]) and cursor-not-allowed; enabled state keeps the lime gradient + glow + hover lift + press scale", async () => {
  const text = await source(PAGE);
  const btnFn = text.slice(text.indexOf("function GenerateButton("), text.indexOf("function GenerateBar("));
  assert.doesNotMatch(btnFn, /bg-\[#202224\]/);
  assert.match(btnFn, /cursor-not-allowed text-\[#20241a\]\/70/);
  assert.match(btnFn, /background: enabled \? "linear-gradient\(135deg, #ddfa9a, #a3e635\)" : "linear-gradient\(135deg, #9aa383, #727a5e\)"/);
  assert.match(btnFn, /cursor-pointer text-\[#0D1206\]/);
  assert.match(btnFn, /hover:-translate-y-px/);
  assert.match(btnFn, /active:scale-\[0\.97\]/);
  // The reason text renders in normal document flow directly below the
  // button everywhere it's used (never absolutely positioned, never inside
  // a fixed-height/overflow-hidden ancestor), so it can never be clipped.
  const barFn = text.slice(text.indexOf("function GenerateBar("), text.indexOf("const DEFAULT_STYLE_ID"));
  assert.match(barFn, /const showReason = !canGenerate && !generating && !sessionError && disabledReason;/);
  assert.match(barFn, /<GenerateButton[\s\S]{0,700}?showReason \? \(\s*<p className="mt-2 text-center text-\[12px\] text-white\/35">\{disabledReason\}<\/p>/);
  const mainReturn = text.slice(text.indexOf('return (\n    <div className="mx-auto max-w-[1180px]'));
  assert.match(mainReturn, /<GenerateButton[\s\S]{0,700}?showGenerateReason && <p className="mt-2 text-center text-\[12px\] text-white\/35">\{disabledReason\}<\/p>/);
});

test("the unlock moment (disabled -> enabled) fires once via a ref-tracked previous value, driving a one-shot scale-spring + expanding pulse ring plus a 0->value credit count-up, with a continuously-looping shine while enabled — all of it dropped under prefers-reduced-motion", async () => {
  const text = await source(PAGE);
  assert.match(text, /const prevCanGenerateRef = useRef\(canGenerate\);/);
  assert.match(text, /if \(canGenerate && !prevCanGenerateRef\.current\) \{/);
  assert.match(text, /setJustUnlocked\(true\);/);
  // Renamed to AnimatedNumber in the length-slider pass: the same component
  // now also tweens on ordinary length/quality changes (previous -> new
  // value), not just the one-time 0 -> value unlock burst.
  assert.match(text, /function AnimatedNumber\(\{ value, play = false, duration = 200, reducedMotion \}\)/);
  const btnFn = text.slice(text.indexOf("function GenerateButton("), text.indexOf("function GenerateBar("));
  assert.match(btnFn, /zyvoUnlockScale 0\.5s cubic-bezier/);
  assert.match(btnFn, /zyvoPulseRing 0\.7s ease-out 1/);
  assert.match(btnFn, /zyvoShineSweep 4s ease-in-out infinite/);
  assert.match(btnFn, /@media \(prefers-reduced-motion: reduce\) \{\s*\.zyvo-shine, \.zyvo-unlock, \.zyvo-pulse-ring \{ animation: none !important; \}/);
  assert.match(text, /function usePrefersReducedMotion\(\)/);
});

test("clicking Generate morphs the button into a disabled loading state ('Starting…' + spinner) so it can never be double-clicked into a double charge", async () => {
  const text = await source(PAGE);
  const btnFn = text.slice(text.indexOf("function GenerateButton("), text.indexOf("function GenerateBar("));
  assert.match(btnFn, /disabled=\{!enabled \|\| loading\}/);
  assert.match(btnFn, /loading \? \(/);
  assert.match(btnFn, /<RotateCw className="h-4 w-4 animate-spin" \/>\s*\{loadingLabel\}/);
});

test("the page's bottom padding is measured from the Generate bar's real rendered position (ResizeObserver + window resize), not a guessed/hardcoded pb-N class, so the bar can never overlap the last form section", async () => {
  const text = await source(PAGE);
  assert.match(text, /const barRef = useRef\(null\);/);
  assert.match(text, /const \[barSpace, setBarSpace\] = useState\(140\);/);
  assert.match(text, /setBarSpace\(Math\.ceil\(window\.innerHeight - el\.getBoundingClientRect\(\)\.top\) \+ 24\)/);
  assert.match(text, /style=\{\{ paddingBottom: barSpace \}\}/);
  assert.doesNotMatch(text, /\$\{hasSidePanel \? "pb-12" : "pb-28"\}/);
});

test("the empty niche-picker button shows a fanned stack of 3 real niche preview images (one per the exact example categories) instead of a generic icon tile, that spreads further on hover", async () => {
  const text = await source(PAGE);
  assert.match(text, /const NICHE_STACK_PREVIEW = \["ancient_humans_prehistory", "space_cosmic_scale", "psychology_human_behavior"\]\.map\(\(id\) => findNiche\(id\)\);/);
  assert.match(text, /function FannedNicheStack\(\)/);
  assert.match(text, /<FannedNicheStack \/>/);
  const stackFn = text.slice(text.indexOf("function FannedNicheStack("), text.indexOf("// 2026-10-03 \"fixes round 3\" pass, Section 4"));
  assert.match(stackFn, /rotate-\[-10deg\]/);
  assert.match(stackFn, /rotate-\[10deg\]/);
  assert.match(stackFn, /group-hover:rotate-\[-14deg\]/);
  assert.match(stackFn, /group-hover:rotate-\[14deg\]/);
  assert.match(stackFn, /transition-transform duration-200 ease-out/);
  // The old generic Sparkles icon tile must be gone from this specific card.
  assert.doesNotMatch(text, /grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-white\/10 text-lime-200/);
});

test("SectionLabel's step-number circle is a fixed 22x22 inline-flex with zero padding, centered content, line-height 1, and tabular-nums — never the old 16x16 grid badge", async () => {
  const text = await source(PAGE);
  const fn = text.slice(text.indexOf("function SectionLabel("), text.indexOf("// Matches the real idea card's fixed h-[100px]"));
  assert.match(fn, /inline-flex h-\[22px\] w-\[22px\] shrink-0 items-center justify-center rounded-full bg-white\/10 p-0 text-\[10px\] font-bold leading-none text-white\/60/);
  assert.match(fn, /fontVariantNumeric: "tabular-nums"/);
  assert.doesNotMatch(text, /grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white\/10 text-\[9px\] font-bold text-white\/60/);
});

// Length slider pass — 8-15 min, any whole minute (Part A).

test("estimateForLength computes words/scenes for ANY whole minute (never a table lookup that can miss a value), using the ONE shared per-minute rates (Phase 0, Section C.2: 15 scenes/min from RECIPE_BEATS_PER_MINUTE, not the old locally-guessed 16.25)", async () => {
  const { estimateForLength, LENGTH_MIN_MINUTES, LENGTH_MAX_MINUTES, DEFAULT_LENGTH_MINUTES } = await import("../src/pages/workspace/long-form/lengthEstimates.js");
  assert.equal(LENGTH_MIN_MINUTES, 8);
  assert.equal(LENGTH_MAX_MINUTES, 15);
  assert.equal(DEFAULT_LENGTH_MINUTES, 10);
  // The 4 preset minutes, at 145 words/min and 15 scenes/min (both floor'd/
  // rounded the same way estimateForLength itself does).
  const known = [
    [8, 1160, 120],
    [10, 1450, 150],
    [12, 1740, 180],
    [15, 2175, 225],
  ];
  for (const [minutes, words, scenes] of known) {
    const est = estimateForLength(minutes);
    assert.equal(est.estimatedWords, words, `${minutes} min words`);
    assert.equal(est.typicalScenes, scenes, `${minutes} min scenes`);
  }
  // Every non-preset whole minute in range must ALSO resolve correctly —
  // never silently fall back to the 10-minute (or any other) preset's numbers.
  for (const minutes of [9, 11, 13, 14]) {
    const est = estimateForLength(minutes);
    assert.equal(est.estimatedWords, minutes * 145, `${minutes} min words`);
    assert.equal(est.typicalScenes, Math.floor(minutes * 15), `${minutes} min scenes`);
    assert.notEqual(est.estimatedWords, estimateForLength(10).estimatedWords, `${minutes} min must not silently equal the 10-minute fallback`);
  }
});

test("estimateForLength clamps out-of-range input rather than producing a nonsensical estimate", async () => {
  const { estimateForLength, LENGTH_MIN_MINUTES, LENGTH_MAX_MINUTES } = await import("../src/pages/workspace/long-form/lengthEstimates.js");
  assert.equal(estimateForLength(1).minutes, LENGTH_MIN_MINUTES);
  assert.equal(estimateForLength(999).minutes, LENGTH_MAX_MINUTES);
});

test("visualsRange returns real numbers (low/high), not a pre-formatted string, so each number can be animated independently", async () => {
  const { visualsRange } = await import("../src/pages/workspace/long-form/lengthEstimates.js");
  const { low, high } = visualsRange(178);
  assert.equal(typeof low, "number");
  assert.equal(typeof high, "number");
  assert.ok(low < high);
});

test("the backend already accepts any whole minute 8-15 with no preset restriction — quote-long-form-project and create-long-form-production-setup only validate '> 0', and create-long-form-project clamps to [5,20], a strictly wider range than the slider ever produces", async () => {
  const quoteText = await source("supabase/functions/quote-long-form-project/index.ts");
  assert.match(quoteText, /!\(targetDurationMinutes > 0\)/);
  assert.doesNotMatch(quoteText, /\[8,\s*10,\s*12,\s*15\]/);
  const setupText = await source("supabase/functions/create-long-form-production-setup/index.ts");
  assert.match(setupText, /!\(targetDurationMinutes > 0\)/);
  const createText = await source("supabase/functions/create-long-form-project/index.ts");
  assert.match(createText, /Math\.min\(20, Math\.max\(5, Math\.round\(Number\(body\.customLengthMinutes\)\)\)\)/);
  // The real credit/beat math itself takes targetDurationMinutes as a raw
  // number, never a lookup keyed to specific preset values.
  const quoteLogic = await source("supabase/functions/_shared/longFormProjectQuote.ts");
  assert.match(quoteLogic, /Math\.round\(targetDurationMinutes \* beatsPerMinute\)/);
});

test("the 4 preset buttons are unchanged, and a LengthSlider renders directly beneath them driving the SAME lengthMinutes state (single source of truth)", async () => {
  const text = await source(PAGE);
  assert.match(text, /LENGTH_OPTIONS\.map\(\(opt\) => \(/);
  // Phase 2c: the slider's "about N words" uses the selected voice's measured pace.
  assert.match(text, /<LengthSlider value=\{lengthMinutes\} onChange=\{setLengthMinutes\} reducedMotion=\{reducedMotion\} wordsPerMinute=\{voicePace\.wordsPerMinute\} \/>/);
  assert.match(text, /function LengthSlider\(\{ value, onChange, reducedMotion, wordsPerMinute \}\)/);
});

test("LengthSlider is built on a real native <input type=range> (min 8, max 15, step 1) with correct accessibility wiring — aria-label, aria-valuetext naming the word count, and a >=44px tall hit area for touch", async () => {
  const text = await source(PAGE);
  const fn = text.slice(text.indexOf("function LengthSlider("), text.indexOf("const DEFAULT_STYLE_ID"));
  assert.match(fn, /type="range"/);
  assert.match(fn, /min=\{LENGTH_MIN_MINUTES\}/);
  assert.match(fn, /max=\{LENGTH_MAX_MINUTES\}/);
  assert.match(fn, /step=\{1\}/);
  assert.match(fn, /aria-label="Video length in minutes"/);
  assert.match(fn, /aria-valuetext=\{`\$\{value\} minutes, about \$\{wordsForValue\.toLocaleString\(\)\} words`\}/);
  assert.match(fn, /h-11 w-full/); // 44px (h-11 = 2.75rem = 44px in this Tailwind config)
});

test("LengthSlider's thumb/bubble positioning is transform-only (translateX from a measured pixel width), never `left` as an animated percentage — so dragging only triggers compositing, never layout", async () => {
  const text = await source(PAGE);
  const fn = text.slice(text.indexOf("function LengthSlider("), text.indexOf("const DEFAULT_STYLE_ID"));
  assert.match(fn, /const thumbTransform = `translate\(\$\{thumbX\}px, -50%\) translateX\(-50%\)`;/);
  assert.match(fn, /style=\{\{ transform: thumbTransform \}\}/);
  // The fill bar is the one legitimate use of an animated `width` (a plain
  // percentage of the track, not a per-frame drag-driven layout thrash) —
  // the thumb and bubble specifically must never use `left` for animation.
  assert.doesNotMatch(fn, /style=\{\{ left:/);
});

test("dragging the slider gives a real snap-bump (1.15 -> 1.22 -> 1.15, ~120ms) via the Web Animations API on every integer step, baking the NEW position into the keyframes so the thumb never visually snaps back to center mid-pulse — and never fires under prefers-reduced-motion", async () => {
  const text = await source(PAGE);
  const fn = text.slice(text.indexOf("function LengthSlider("), text.indexOf("const DEFAULT_STYLE_ID"));
  assert.match(fn, /scale\(1\.15\)/);
  assert.match(fn, /scale\(1\.22\)/);
  assert.match(fn, /duration: 120, easing: "ease-out"/);
  assert.match(fn, /if \(dragging && !reducedMotion && thumbRef\.current\)/);
  assert.match(fn, /\$\{newTransform\} scale\(1\.15\)/); // position baked into the keyframe, not a bare scale
});

test("clicking a preset (or any non-drag change) eases the thumb over ~250ms; active dragging suppresses that transition so the thumb tracks the pointer instantly; reduced motion also suppresses it", async () => {
  const text = await source(PAGE);
  const fn = text.slice(text.indexOf("function LengthSlider("), text.indexOf("const DEFAULT_STYLE_ID"));
  assert.match(fn, /const thumbTransitionClass = reducedMotion \|\| dragging \? "" : "transition-transform duration-\[250ms\] ease-out";/);
});

test("the value bubble is hidden when idle and shown on drag/hover/focus with a spring-in (scale 0.8 -> 1, opacity 0 -> 1, ~150ms), suppressed under prefers-reduced-motion", async () => {
  const text = await source(PAGE);
  const fn = text.slice(text.indexOf("function LengthSlider("), text.indexOf("const DEFAULT_STYLE_ID"));
  assert.match(fn, /const showBubble = dragging \|\| hovering \|\| focused;/);
  assert.match(fn, /zyvoBubbleIn 150ms ease-out/);
  assert.match(fn, /scale\(0\.8\); opacity: 0;/);
  assert.match(fn, /@media \(prefers-reduced-motion: reduce\) \{\s*\.zyvo-bubble-in \{ animation: none; \}/);
});

test("ticks: 8 marks (one per whole minute 8-15), lit lime at-or-below the current value, with only the current value's label bold/bright", async () => {
  const text = await source(PAGE);
  assert.match(text, /const LENGTH_TICKS = Array\.from\(\{ length: LENGTH_MAX_MINUTES - LENGTH_MIN_MINUTES \+ 1 \}, \(_, i\) => LENGTH_MIN_MINUTES \+ i\);/);
  const fn = text.slice(text.indexOf("function LengthSlider("), text.indexOf("const DEFAULT_STYLE_ID"));
  assert.match(fn, /m <= value \? "bg-lime-300" : "bg-white\/15"/);
  assert.match(fn, /m === value \? "font-bold text-lime-300" : "font-medium text-white\/30"/);
});

test("the helper line under the slider is computed live from estimateForLength/visualsRange for the CURRENT value (never a stale preset lookup), with each number wrapped in AnimatedNumber so it counts up/down on change", async () => {
  const text = await source(PAGE);
  assert.match(text, /const lengthEstimate = estimateForLength\(lengthMinutes, voicePace\.wordsPerMinute\);/);
  assert.match(text, /const lengthVisuals = visualsRange\(lengthEstimate\.typicalScenes\);/);
  const helperLineIdx = text.indexOf("≈<AnimatedNumber value={lengthEstimate.estimatedWords}");
  assert.ok(helperLineIdx > -1, "expected the helper line to read live off lengthEstimate/lengthVisuals");
  const helperLine = text.slice(helperLineIdx, helperLineIdx + 300);
  assert.match(helperLine, /<AnimatedNumber value=\{lengthVisuals\.low\}/);
  assert.match(helperLine, /<AnimatedNumber value=\{lengthVisuals\.high\}/);
});

test("AnimatedNumber drives the credit amount INSIDE the Generate button (one shared definition used by both the side-panel and bottom-bar placements) and the visuals count in the summary panel and mobile estimate card, so all of them count up/down together as length/quality change — not just the one-time unlock burst", async () => {
  const text = await source(PAGE);
  // Final-polish round 3, Section 1/2: the big standalone credits line is
  // gone from both price sections — the ONE remaining credits AnimatedNumber
  // lives inside GenerateButton itself (`value={credits}`, the prop), shared
  // by both the desktop side-panel button and the mobile bar button since
  // they're the same component; the mobile "Project Estimate" card (shown
  // only when there's no side panel at all) keeps its own for reference.
  const creditsPropOccurrences = text.match(/<AnimatedNumber value=\{credits\} play=\{justUnlocked\}/g) ?? [];
  assert.equal(creditsPropOccurrences.length, 1, "expected exactly one AnimatedNumber definition for the credit amount, inside GenerateButton");
  const estimateCardCredits = text.match(/<AnimatedNumber value=\{quote\.totalCredits\}/g) ?? [];
  assert.equal(estimateCardCredits.length, 1, "expected the mobile 'Project Estimate' card to keep its own credits AnimatedNumber");
  const visualsOccurrences = text.match(/<AnimatedNumber value=\{quote\.estimatedBeatCount\}/g) ?? [];
  assert.equal(visualsOccurrences.length, 2, "expected the visuals count animated in both the summary panel and the mobile estimate card");
});

test("the project-creation payload still forwards the chosen length exactly as before (customLengthMinutes / targetDurationMinutes), now simply allowed to be any integer 8-15 — no payload shape change", async () => {
  const text = await source(PAGE);
  assert.match(text, /customLengthMinutes: lengthMinutes,/);
  assert.match(text, /targetDurationMinutes: lengthMinutes,/);
});

// Final-polish round 3 — checkout-style placement: the Generate button moves
// into the sticky side panel on desktop (no more full-width bottom bar
// there), and the bottom bar simplifies to just the button + one context
// line for tablet/mobile.

test("desktop (side panel visible): the Generate button lives at the bottom of the panel, pinned below a scrollable top section, with `100dvh` (never `vh`) driving the panel's own max-height so it can never run off-screen", async () => {
  const text = await source(PAGE);
  const asideIdx = text.indexOf("{hasSidePanel && (\n          <aside");
  const asideBlock = text.slice(asideIdx, text.indexOf("{/* Final-polish round 3, Section 2 — the sticky bottom bar"));
  assert.match(asideBlock, /maxHeight: "calc\(100dvh - 56px - var\(--zyvo-notice-height, 0px\) - 24px - 24px\)"/);
  assert.doesNotMatch(asideBlock, /\d+vh/); // never a plain vh unit alongside the dvh one
  assert.match(asideBlock, /flex min-h-0 flex-1 flex-col overflow-hidden/);
  assert.match(asideBlock, /min-h-0 flex-1 overflow-y-auto p-5">\{summary\}/); // scrollable top section
  assert.match(asideBlock, /shrink-0 border-t border-white\/\[0\.08\] p-5 pt-4">\s*<GenerateButton/); // pinned bottom section
});

test("the panel's price section drops the old standalone big credits line (now inside the button) and keeps visuals/max-charge, adding a live balance projection", async () => {
  const text = await source(PAGE);
  const summaryIdx = text.indexOf("const summary = (");
  const summaryBlock = text.slice(summaryIdx, text.indexOf('return (\n    <div className="mx-auto max-w-[1180px]'));
  assert.doesNotMatch(summaryBlock, /text-\[16px\] font-bold text-white"><AnimatedNumber value=\{quote\.totalCredits\}/);
  assert.match(summaryBlock, /~<AnimatedNumber value=\{quote\.estimatedBeatCount\}/);
  assert.match(summaryBlock, /Fixed price — everything included\. Fully refunded if the video can't be made\./); // Phase 7 fixed quote
  assert.match(summaryBlock, /Balance \{credits\.toLocaleString\(\)\} → \{projectedBalance\.toLocaleString\(\)\}/);
});

test("tablet/mobile (no side panel): the sticky bottom bar is constrained to the SAME max-w-[1180px] content container the form uses (never wider, never a separate width), and hosts the one full-width Generate button", async () => {
  const text = await source(PAGE);
  const barFn = text.slice(text.indexOf("function GenerateBar("), text.indexOf("const DEFAULT_STYLE_ID"));
  assert.match(barFn, /mx-auto max-w-\[1180px\] px-4 py-3 lg:px-8/);
  assert.match(barFn, /<GenerateButton\s/);
});

test("the Generate bar and the side-panel button are mutually exclusive, gated by the SAME hasSidePanel state — never both, never neither, and never a separate 768px breakpoint deciding it", async () => {
  const text = await source(PAGE);
  const mainReturn = text.slice(text.indexOf('return (\n    <div className="mx-auto max-w-[1180px]'));
  assert.match(mainReturn, /\{hasSidePanel && \(/);
  assert.match(mainReturn, /\{!hasSidePanel && \(\s*<GenerateBar/);
  assert.doesNotMatch(text, /hidden md:grid|md:hidden/); // the old internal 768px split inside the bar is gone
});

test("root cause of missing mobile style/niche images: ImageWithFallback no longer sets loading=\"lazy\" — native lazy-loading inside a transitioning/position:fixed Headless UI Dialog is a known WebKit correctness bug, and every image here is small and only fetched once the user opens a picker, so there's no real benefit worth that risk", async () => {
  const text = await source(PAGE);
  const fn = text.slice(text.indexOf("function ImageWithFallback("), text.indexOf("// Final-polish pass, Section 3"));
  assert.doesNotMatch(fn, /loading="lazy"/);
  // No real <img> anywhere in the page carries the attribute either (the one
  // remaining match in the full file is this test's own describing comment).
  const realAttrOccurrences = text.match(/\sloading="lazy"/g) ?? [];
  assert.equal(realAttrOccurrences.length, 0, "no <img> should carry loading=\"lazy\" anywhere on this page");
});

test("Phase 6b: Voice is its own step (6 · Voice) with NO preselection; Generate waits for a voice; Advanced Settings has no voice", async () => {
  const text = await source(PAGE);
  const advancedIdx = text.indexOf('<span className="text-[13px] font-semibold text-white">Advanced Settings</span>');
  const advancedBodyEnd = text.indexOf("</LockedSection>");
  const advancedBody = text.slice(advancedIdx, advancedBodyEnd);
  assert.doesNotMatch(advancedBody, />Voice</);
  assert.match(advancedBody, />Explanation Depth</);
  assert.match(advancedBody, />On-Screen Text</);
  // Section 6 comes after Quality (5), opens the voice library, and nothing is preselected.
  assert.ok(text.indexOf("<SectionLabel n={6}>Voice</SectionLabel>") > text.indexOf("<SectionLabel n={5}>Quality</SectionLabel>"));
  assert.match(text, /const \[voice, setVoice\] = useState\(null\);/);
  assert.match(text, />Choose a voice</);
  assert.match(text, /<VoiceLibraryDialog/);
  assert.match(text, /&& Boolean\(voice\);/);
  assert.match(text, /"Pick a voice to continue"/);
  assert.match(text, /data-testid="summary-voice"/);
  // The chosen voice is forwarded into the real creation payload.
  assert.match(text, /voiceId: voice\.voiceId,/);
  assert.match(text, /voiceModel: voice\.voiceModel,/);
});
test("the Advanced Settings toggle uses a subtle inset focus-visible ring only (never a heavy border on tap/click)", async () => {
  const text = await source(PAGE);
  const idx = text.indexOf("setAdvancedOpen((v) => !v)");
  const btnTag = text.slice(idx, text.indexOf("Advanced Settings", idx));
  assert.match(btnTag, /focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-lime-300\/50/);
  assert.doesNotMatch(btnTag, /focus-visible:ring-2/);
});

test("below 768px, the full step progress bar is replaced with a compact 'Step N of M · Label' line next to the back link — the full stepper only renders at md and up", async () => {
  const text = await source("src/pages/workspace/long-form/shared.jsx");
  const fn = text.slice(text.indexOf("export function LongFormProgress("), text.indexOf("// Deterministic, non-lime tint"));
  assert.match(fn, /text-\[12px\] font-semibold text-white\/50 md:hidden/);
  assert.match(fn, /Step \{currentIndex \+ 1\} of \{stages\.length\} · \{currentStage\.label\}/);
  assert.match(fn, /hidden min-w-0 items-center gap-2 overflow-x-auto md:flex/);
});

// ============================================================================
// Final-polish round 4 — sticky panel jitter, step reorder, thumbnail size
// unification, and idea thumbnails (Sections 1-4). See the deliverable
// report for the jitter root cause, whether a prior idea-image flow existed,
// the Flux model id, and the IN_IMAGE headline-spelling test results.
// ============================================================================

test("Section 4 — a real prior idea+image pipeline exists and IS reused: the same jobs table + watchJob poller (src/lib/jobs.ts) every other Zyvo image tool uses, not a new bespoke mechanism", async () => {
  const text = await source(PAGE);
  assert.match(text, /import \{ watchJob \} from "\.\.\/\.\.\/\.\.\/lib\/jobs";/);
  const jobsText = await source("src/lib/jobs.ts");
  assert.match(jobsText, /export function watchJob\(/);
});

test("generate-long-form-ideas: thumbnailConcept (headline + scene) is now a REQUIRED schema field, validated, and threaded through to the returned idea — the LLM writes only the concept, never a style block", async () => {
  const text = await source("supabase/functions/generate-long-form-ideas/index.ts");
  assert.match(text, /required: \["title", "topic", "angle", "category", "direction", "narrativeArchetype", "visualDirection", "thumbnailConcept"\]/);
  assert.match(text, /const THUMBNAIL_CONCEPT_SCHEMA = \{/);
  assert.match(text, /if \(!concept \|\| typeof concept !== "object"\) return false;/);
  assert.match(text, /thumbnailConcept: \{\s*headline: idea\.thumbnailConcept\.headline\.trim\(\),\s*scene: idea\.thumbnailConcept\.scene\.trim\(\),\s*\},/);
  // Title format rules (proven formats, <=60 chars, no colons, never gives away the answer).
  assert.match(text, /TITLE FORMAT RULES/);
  assert.match(text, /What Did \[Group\] Do \[X\]\?/);
  assert.match(text, /How Did \[Group\] Survive \[X\]\?/);
  assert.match(text, /Why Don't We \[X\]\?/);
  assert.match(text, /What If \[X\]\?/);
  assert.match(text, /60 characters or fewer, contain NO colon, and never give away the answer/);
});

test("generate-long-form-ideas: the old session-wide cooldown gate is REPLACED by a per-draft free-then-charge model — free_idea_batch_used decides free vs. a real deduct_credits(2) charge, refunded on any generation failure, never a client-trusted flag", async () => {
  const text = await source("supabase/functions/generate-long-form-ideas/index.ts");
  assert.match(text, /import \{ FIRST_IDEA_BATCH_IS_FREE, REGENERATE_IDEAS_COST \} from "\.\.\/\.\.\/\.\.\/src\/lib\/longFormIdeaThumbnails\.ts";/);
  assert.match(text, /const isChargeableBatch = !\(FIRST_IDEA_BATCH_IS_FREE && !session\.free_idea_batch_used\);/);
  assert.match(text, /admin\.rpc\("deduct_credits", \{ uid: user\.id, amount: REGENERATE_IDEAS_COST \}\)/);
  assert.match(text, /return err\(req, "Not enough credits to regenerate ideas\.", 402, \{ code: "INSUFFICIENT_CREDITS" \}\)/);
  // Refunded on every failure path after a charge, never just the happy path.
  const refundCalls = text.match(/await refundIfCharged\(/g) ?? [];
  assert.ok(refundCalls.length >= 3, "expected refundIfCharged called on candidate failure, no-ideas-survived, and the catch-all error path");
  assert.match(text, /amount: -REGENERATE_IDEAS_COST/);
  // Real state stamped server-side only, never in the client-writable ALLOWED_FIELDS.
  assert.match(text, /free_idea_batch_used: true,/);
  assert.match(text, /last_idea_batch_id: batchId,/);
  assert.match(text, /return ok\(req, \{\s*ideas,\s*batchId,\s*charged: isChargeableBatch \? REGENERATE_IDEAS_COST : 0,/);
});

test("generate-long-form-idea-thumbnails: a new dedicated edge function submits real Runware jobs (Flux 9B) using a deterministic style-header + concept prompt, never an LLM-assembled one, and never double-charges a batch already paid for by generate-long-form-ideas", async () => {
  const text = await source("supabase/functions/generate-long-form-idea-thumbnails/index.ts");
  assert.match(text, /import \{\s*buildThumbnailPrompt,/);
  assert.match(text, /const prompt = buildThumbnailPrompt\(styleId, \{ headline: concept\.headline, scene: concept\.scene \}, mode\);/);
  assert.match(text, /tool_key: THUMBNAIL_IMAGE_TOOL_KEY,/);
  // Free-ride-on-a-real-batch logic, never trusting a bare client flag.
  assert.match(text, /const belongsToRealBatch = Boolean\(requestedBatchId\) && requestedBatchId === session\.last_idea_batch_id;/);
  assert.match(text, /const ridesFreeIdeaBatch = belongsToRealBatch && !session\.last_idea_batch_thumbnails_claimed;/);
  assert.match(text, /const charge = ridesFreeIdeaBatch \|\| isFreeRetry \? 0 : REFRESH_THUMBNAILS_COST;/);
  assert.match(text, /admin\.rpc\("deduct_credits", \{ uid: user\.id, amount: charge \}\)/);
  // Every individual job is booked charge_credits:0 — the real charge (if
  // any) already happened once for the whole batch, never per-image.
  assert.match(text, /charge_credits: 0,/);
});

test("src/lib/longFormIdeaThumbnails.ts: the shared config the client, generate-long-form-ideas, and generate-long-form-idea-thumbnails all import from — cost, model, and headline mode are named constants, not magic numbers duplicated per call site", async () => {
  const text = await source("src/lib/longFormIdeaThumbnails.ts");
  assert.match(text, /export const FIRST_IDEA_BATCH_IS_FREE = true;/);
  assert.match(text, /export const REGENERATE_IDEAS_COST = 2;/);
  assert.match(text, /export const REFRESH_THUMBNAILS_COST = 2;/);
  assert.match(text, /export const THUMBNAIL_IMAGE_TOOL_KEY = "image:flux2\.klein9bkv";/);
  assert.match(text, /export const THUMBNAIL_HEADLINE_MODE = "OVERLAY";/);
  // Classic Flat Stickman's header, verbatim, per the task's exact text.
  assert.match(text, /a perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet/);
  assert.match(text, /large round white eyes with black pupils, thick strongly angled eyebrows, and a big expressive mouth/);
  // Deterministic assembly: the LLM's concept is interpolated, the style
  // block and text rules are fixed code — never combined by the model itself.
  assert.match(text, /export function buildThumbnailPrompt\(/);
  assert.match(text, /if \(mode === "IN_IMAGE"\) \{/);
  assert.match(text, /No text, letters, words, or numbers anywhere in the image\. Keep the top third/);
});

test("Confirmed against src/lib/providers.ts: image:flux2.klein9bkv is the real, previously-verified Flux 9B entry (airTag runware:400@6) — the thumbnail config references the exact same tool key, not a re-guessed one", async () => {
  const providersText = await source("src/lib/providers.ts");
  assert.match(providersText, /"image:flux2\.klein9bkv":\s*\{[\s\S]{0,300}airTag:\s*"runware:400@6"/);
  const configText = await source("src/lib/longFormIdeaThumbnails.ts");
  assert.match(configText, /THUMBNAIL_IMAGE_TOOL_KEY = "image:flux2\.klein9bkv"/);
});

test("discoverIdeas.js: createIdea now carries thumbnailConcept plus a new `thumbnail` lifecycle field (status/imageUrl/jobId, reusing the existing PREVIEW_STATUS enum) — kept separate from the OLD page's `conceptPreview`, never overloading its documented meaning", async () => {
  const text = await source("src/pages/workspace/long-form/discoverIdeas.js");
  assert.match(text, /export function createIdea\(\{ id, title, topic, angle, visualDirection, category, direction, narrativeArchetype, thumbnailConcept \}\)/);
  assert.match(text, /thumbnailConcept: thumbnailConcept \?\? undefined,/);
  assert.match(text, /thumbnail: \{ status: PREVIEW_STATUS\.PENDING, imageUrl: null, jobId: null \},/);
  assert.match(text, /conceptPreview: \{ status: PREVIEW_STATUS\.PENDING, imageUrl: null, jobId: null \},/);
});

test("migration 20261004100000 adds the 4 billing/caching columns (additive only, all nullable/defaulted) and none of them are added to update-long-form-discovery-session's client-writable ALLOWED_FIELDS", async () => {
  const migrationText = await source("supabase/migrations/20261004100000_long_form_idea_thumbnail_billing.sql");
  assert.match(migrationText, /add column if not exists free_idea_batch_used boolean not null default false/);
  assert.match(migrationText, /add column if not exists last_idea_batch_id uuid null/);
  assert.match(migrationText, /add column if not exists last_idea_batch_style_id text null/);
  assert.match(migrationText, /add column if not exists last_idea_batch_thumbnails_claimed boolean not null default false/);
  const updateFnText = await source("supabase/functions/update-long-form-discovery-session/index.ts");
  const allowedFieldsMatch = updateFnText.match(/ALLOWED_FIELDS = \[([^\]]+)\]/);
  assert.ok(allowedFieldsMatch, "expected to find ALLOWED_FIELDS");
  for (const billingField of ["free_idea_batch_used", "last_idea_batch_id", "last_idea_batch_style_id", "last_idea_batch_thumbnails_claimed"]) {
    assert.ok(!allowedFieldsMatch[1].includes(billingField), `${billingField} must never be client-writable via the generic patch endpoint`);
  }
  // "ideas" and "selected_idea_id" ARE allowed — that's how caching/selection persist.
  assert.ok(allowedFieldsMatch[1].includes('"ideas"'));
  assert.ok(allowedFieldsMatch[1].includes('"selected_idea_id"'));
});

test("ProductionSetup.jsx: cached ideas + thumbnails hydrate straight from the session row on mount (never re-generating or re-charging on tab-switch/reopen), and any thumbnail still mid-flight resumes its watcher rather than a lost jobId spinning forever", async () => {
  const text = await source(PAGE);
  const bootstrapFn = text.slice(text.indexOf("const bootstrapSession = async"), text.indexOf("useEffect(() => {\n    let cancelled = false;"));
  assert.match(bootstrapFn, /const hydratedIdeas = Array\.isArray\(existing\.ideas\) \? existing\.ideas : \[\];/);
  assert.match(bootstrapFn, /if \(hydratedIdeas\.length > 0\) \{/);
  assert.match(bootstrapFn, /setIdeas\(hydratedIdeas\);/);
  assert.match(bootstrapFn, /resumeIdeaThumbnailWatchers\(hydratedIdeas\);/);
  assert.match(text, /const resumeIdeaThumbnailWatchers = \(hydratedIdeas\) => \{/);
  assert.match(text, /if \(idea\.thumbnail\.jobId\) watchIdeaThumbnailJob\(idea\.id, idea\.thumbnail\.jobId\);\s*else updateIdeaThumbnail\(idea\.id, \{ status: PREVIEW_STATUS\.FAILED \}\);/);
  // Every idea mutation is debounce-persisted via the existing whitelisted `ideas` field.
  assert.match(text, /const schedulePersistIdeas = \(\) => \{/);
  assert.match(text, /persistDiscoverySession\(discoverySessionId, \{ ideas: ideasRef\.current \}\);/);
});

// V2 launch fixes: picking an idea STAYS on "Get ideas for me" (card selected, summary shows it);
// "Edit this idea" is the way into Write my own.
test("ProductionSetup.jsx: selecting an idea fills the topic, stays on Get ideas for me, sets the summary-panel preview to that idea's own thumbnail once ready, and it's persisted (selected_idea_id) so it survives a reload", async () => {
  const text = await source(PAGE);
  const fn = text.slice(text.indexOf("const handleUseIdea = (idea) => {"), text.indexOf("// Scroll affordances for the ideas grid"));
  assert.match(fn, /setTopic\(idea\.topic\);/);
  assert.doesNotMatch(fn, /setTopicMode\(/);
  assert.match(text, /data-testid="edit-idea" onClick=\{\(\) => setTopicMode\("write"\)\}/);
  assert.match(text, /existing\.selected_idea_id && !nicheChangedByLink \? "ideas" : prevMode/);
  assert.match(fn, /setSelectedIdeaThumbnailUrl\(idea\.thumbnail\?\.status === PREVIEW_STATUS\.READY \? idea\.thumbnail\.imageUrl : null\);/);
  assert.match(fn, /persistDiscoverySession\(discoverySessionId, \{ selected_idea_id: idea\.id \}\);/);
});

test("ProductionSetup.jsx: a style change after ideas exist shows a non-auto-regenerating notice with a paid 'Refresh thumbnails' action (same GenerateButton component/price rule as Regenerate), and never touches the idea text", async () => {
  const text = await source(PAGE);
  assert.match(text, /ideasStyleId && ideasStyleId !== visualStyleId && ideas\.length > 0/);
  assert.match(text, /Thumbnails use the previous style\./);
  const refreshFn = text.slice(text.indexOf("const refreshThumbnails = async () => {"), text.indexOf("const handleUseIdea = (idea) => {"));
  assert.match(refreshFn, /submitIdeaThumbnailJobs\(\{ discoverySessionId, styleId: visualStyleId, ideas: payloadIdeas \}\)/); // no batchId => always charged on its own
  assert.doesNotMatch(refreshFn, /setTopic\(/);
  assert.doesNotMatch(refreshFn, /setIdeas\(result\.ideas/);
  assert.match(text, /label="Refresh thumbnails"/);
  assert.match(text, /credits=\{REFRESH_THUMBNAILS_COST\}/);
});

test("ProductionSetup.jsx: Regenerate and Refresh-thumbnails both reuse the exact GenerateButton component (lime fill, credits icon+amount inside, same disabled/loading states) — never a separate hand-rolled button — and both disable with 'Not enough credits' when the balance is short", async () => {
  const text = await source(PAGE);
  const ideasTabRegion = text.slice(text.indexOf("Get ideas for me"), text.indexOf("Scroll for {ideasScrollState.hiddenCount}"));
  const generateButtonUsages = ideasTabRegion.match(/<GenerateButton/g) ?? [];
  assert.equal(generateButtonUsages.length, 2, "expected exactly two GenerateButton usages in the ideas tab: Generate/Regenerate and Refresh thumbnails");
  assert.match(ideasTabRegion, /const shortOnCredits = isRegenerate && typeof credits === "number" && credits < REGENERATE_IDEAS_COST;/);
  assert.match(ideasTabRegion, /Not enough credits/);
  assert.match(ideasTabRegion, /const shortOnCredits = typeof credits === "number" && credits < REFRESH_THUMBNAILS_COST;/);
});

test("ProductionSetup.jsx: a failed idea thumbnail shows the selected niche's image dimmed with a retry icon (never a broken image), and retrying is free (it's completing an already-paid/free batch, not new paid content)", async () => {
  const text = await source(PAGE);
  const thumbFn = text.slice(text.indexOf("function IdeaThumbnail("), text.indexOf("function ThumbnailHeadlineOverlay("));
  assert.match(thumbFn, /if \(status === PREVIEW_STATUS\.FAILED\) \{/);
  assert.match(thumbFn, /<ImageWithFallback src=\{fallbackSrc\} alt="" groupId=\{fallbackGroupId\} className="h-full w-full object-cover" dim \/>/);
  assert.match(thumbFn, /<RefreshCw className="h-3 w-3" \/>/);
  const retryFn = text.slice(text.indexOf("const retryIdeaThumbnail = (idea) => {"), text.indexOf("const handleUseIdea = (idea) => {"));
  assert.match(retryFn, /retry: true,/);
  const thumbnailFnText = await source("supabase/functions/generate-long-form-idea-thumbnails/index.ts");
  assert.match(thumbnailFnText, /const isFreeRetry = isRetry && belongsToRealBatch;/);
});

test("ProductionSetup.jsx: OVERLAY mode renders the headline in code on top of the image (heavy bold rounded all-caps yellow with a thick black outline, top third, width-fit via SVG textLength to ~80%) — never relying on the model to draw text", async () => {
  const text = await source(PAGE);
  const overlayFn = text.slice(text.indexOf("function ThumbnailHeadlineOverlay("), text.indexOf("// ======================= Sticky Generate bar (final polish) ======================="));
  assert.match(overlayFn, /textLength="80"/);
  assert.match(overlayFn, /lengthAdjust="spacingAndGlyphs"/);
  assert.match(overlayFn, /fill="#FFE14D"/);
  assert.match(overlayFn, /paintOrder="stroke"/);
  assert.match(overlayFn, /fontWeight="900"/);
});

test("selected-niche/selected-style row thumbnails and idea-card thumbnails all give their <img> a fixed aspect-ratio (aspect-video) so no image load ever reflows the sticky panel or the ideas grid", async () => {
  const text = await source(PAGE);
  const summaryPreviewFn = text.slice(text.indexOf("function SummaryPreviewImage"), text.indexOf("function NichePickerModal"));
  assert.match(summaryPreviewFn, /aspect-video w-full/);
  const thumbFn = text.slice(text.indexOf("function IdeaThumbnail("), text.indexOf("function ThumbnailHeadlineOverlay("));
  assert.match(thumbFn, /aspect-video w-full/g);
});

// ============================================================================
// Phase 0, Section A — picker-image regression: every style/niche slug
// referenced in code must have a matching file on disk (the file-existence
// half of "prevent regression"), plus structural checks on the hardened
// ImageWithFallback (loading skeleton, decoding=async, no reintroduced
// loading="lazy", preload-on-open in both modals).
// ============================================================================

test("every visual style id in visualStyles.js has a matching /public/images/styles/<id>.webp file on disk", async () => {
  const stylesText = await source("src/pages/workspace/long-form/visualStyles.js");
  const ids = [...stylesText.matchAll(/id: "([a-z_]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 10, "expected at least 10 style ids");
  const missing = ids.filter((id) => !existsSync(fileURLToPath(new URL(`../public/images/styles/${id}.webp`, import.meta.url))));
  assert.deepEqual(missing, [], `missing style image files for: ${missing.join(", ")}`);
});

test("every niche id in niches.js has a matching /public/images/niches/<id>.webp file on disk", async () => {
  const nichesText = await source("src/pages/workspace/long-form/niches.js");
  // Niches are nested inside NICHE_GROUPS[].niches[], each carrying its own
  // `id: "..."` alongside the 5 GROUP ids themselves (history, mind_body,
  // animals_nature, science_universe, money_modern_life) — excluding those
  // 5 known group ids isolates the real (25) niche ids without depending on
  // exactly how ALL_NICHES is derived from the groups.
  const groupIdMatch = nichesText.match(/const NICHE_GROUPS = \[([\s\S]*?)\n\];/);
  assert.ok(groupIdMatch, "expected to find NICHE_GROUPS");
  const groupIds = new Set([...groupIdMatch[1].matchAll(/^\s{2}\{\s*\n\s*id: "([a-z_]+)"/gm)].map((m) => m[1]));
  assert.equal(groupIds.size, 5, "expected exactly 5 niche group ids");
  const allIds = [...nichesText.matchAll(/id: "([a-z_]+)"/g)].map((m) => m[1]);
  const nicheIds = allIds.filter((id) => !groupIds.has(id));
  assert.ok(nicheIds.length >= 25, `expected at least 25 niche ids, got ${nicheIds.length}`);
  const missing = nicheIds.filter((id) => !existsSync(fileURLToPath(new URL(`../public/images/niches/${id}.webp`, import.meta.url))));
  assert.deepEqual(missing, [], `missing niche image files for: ${missing.join(", ")}`);
});

test("ImageWithFallback shows a real loading skeleton while pending (never the category-gradient fallback until onError actually fires), uses decoding=async, and both picker modals preload every real image URL the instant they open", async () => {
  const text = await source(PAGE);
  const fn = text.slice(text.indexOf("function ImageWithFallback("), text.indexOf("// Final-polish pass, Section 3 — three real niche images"));
  assert.match(fn, /const \[status, setStatus\] = useState\(src \? "loading" : "empty"\);/);
  assert.match(fn, /status === "empty" \|\| status === "failed"/); // fallback tile renders ONLY for these — never while "loading"
  assert.match(fn, /status === "loading" && <div className="absolute inset-0 animate-pulse/);
  assert.match(fn, /decoding="async"/);
  assert.match(fn, /onLoad=\{\(\) => setStatus\("loaded"\)\}/);
  assert.match(fn, /onError=\{\(\) => setStatus\("failed"\)\}/);
  // The proven WebKit fix from the previous round must not be reverted —
  // no loading="lazy" JSX attribute anywhere (comments discussing it wrap
  // it in backticks, so a real attribute usage is the only un-backticked match).
  assert.doesNotMatch(text, /(?<!`)loading="lazy"(?!`)/);

  assert.match(text, /function preloadImages\(urls\) \{/);
  const nicheModalFn = text.slice(text.indexOf("function NichePickerModal("), text.indexOf("function StylePickerModal("));
  assert.match(nicheModalFn, /useEffect\(\(\) => \{\s*if \(!open\) return;\s*preloadImages\(ALL_NICHES\.map/);
  const styleModalFn = text.slice(text.indexOf("function StylePickerModal("), text.indexOf("// ============================== Locked wrapper =============================="));
  assert.match(styleModalFn, /useEffect\(\(\) => \{\s*if \(!open\) return;\s*preloadImages\(VISUAL_STYLES\.map/);
});
