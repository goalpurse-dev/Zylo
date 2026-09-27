# Deployed code excerpts inspected read-only

Worker version 20. These are current code, not proof that every historical output was rendered by this version.

## functions/advance-long-form-scene-generation/index.ts:318

```text
318: async function processZeroCostScene(admin: any, scene: any, plan: any) {
319:   if (plan.render_strategy === "REUSE") {
320:     const source = await admin.rpc("current_scene_for_render_plan", { p_scene_render_plan_id: plan.source_scene_render_plan_id }).then((r: any) => r.data);
321:     if (!source || source.status !== "succeeded" || !source.result_url) throw new Error("REUSE_SOURCE_NOT_READY");
322:     await admin.from("long_form_scenes").update({ status: "succeeded", result_url: source.result_url, base_result_url: source.base_result_url ?? source.result_url, final_result_url: source.result_url, qa_status: "approved", qa_result: { inheritedFrom: source.id, reason: "zero-cost reuse of an already-approved scene" }, cost_usd: 0, render_model: source.render_model, updated_at: new Date().toISOString() }).eq("id", scene.id);
323:     return;
324:   }
```

## functions/advance-long-form-scene-generation/index.ts:349

```text
349:   if (plan.render_strategy === "PROGRAMMATIC_GRAPHIC") {
350:     const { data: project } = await admin.from("long_form_projects").select("visual_style_preset").eq("id", plan.project_id).maybeSingle();
351:     const styleSpec = getStylePresetForProject(project?.visual_style_preset);
352:     const spec = plan.overlay_spec;
353:     // 2026-09-17 "long-form quality pass" (Part 2/3): a NEW-shape structured
354:     // spec (version:1, a real `template`) goes through the six-template
355:     // engine; any OLDER-shape row (from before this pass — {type:"BIG_TEXT"|
356:     // "LABEL", text, ...}) still renders exactly as before via the
357:     // pre-existing generic card, so no historical Mars row's stored plan
358:     // needs touching. Never a silent third shape — anything that's neither
359:     // is a genuine compile-time bug, not something this dispatch guesses at.
360:     const isStructuredSpec = spec && typeof spec === "object" && spec.version === 1 && typeof spec.template === "string";
361:     const { card, overflowed, issues } = isStructuredSpec
362:       ? (() => { const r = renderGraphicCard(spec); return { card: r.img, overflowed: false, issues: r.issues }; })()
363:       : (() => { const r = renderProgrammaticGraphicCard(spec, styleSpec); return { card: r.img, overflowed: r.overflowed, issues: r.overflowed ? ["legacy card overflowed even at minimum layout scale"] : [] }; })();
364:     if (!isValidFinalAspectRatio(card.width, card.height)) throw new Error(`INVALID_FINAL_FRAME_GEOMETRY: graphic card produced ${card.width}x${card.height}, not 16:9`);
365:     const png = encodePng(card);
366:     const path = `long-form/scenes/${scene.id}.png`;
367:     const { error: uploadError } = await admin.storage.from("generated").upload(path, png, { contentType: "image/png", upsert: true });
368:     if (uploadError) throw uploadError;
369:     const { data: publicUrl } = admin.storage.from("generated").getPublicUrl(path);
370:     // Part 5/7: a programmatic graphic should almost never require human
371:     // review — the auto-shrink-to-fit layout (both the legacy card and the
372:     // new templates) handles the ordinary case automatically. The real
373:     // deterministic validation Part 7 asks for (no clipped text, exact
374:     // values preserved, no unsupported-template fallback shipped silently)
375:     // is `issues` — non-empty only when a real defect survived layout
376:     // (severe overflow/truncation), which now maps to requiresReview rather
377:     // than the old blanket "rejected", matching Part 5's rule that
378:     // uncertainty is tracked separately from severity.
379:     const hasIssues = overflowed || issues.length > 0;
380:     await admin.from("long_form_scenes").update({
381:       status: "succeeded", result_url: publicUrl.publicUrl, base_result_url: publicUrl.publicUrl, final_result_url: publicUrl.publicUrl, overlay_applied: true,
382:       qa_status: hasIssues ? "rejected" : "approved",
383:       qa_result: hasIssues
384:         ? { approved: false, severity: "AUTO_READY", requiresReview: true, failureType: "GRAPHIC_LAYOUT_ISSUE", repairStrategy: "shorten the overlay text/values or split across beats", reasons: issues.length ? issues : ["Overlay text did not fit even at the minimum layout scale and was truncated."] }
385:         : { approved: true, severity: "AUTO_READY", requiresReview: false, reason: "deterministic programmatic graphic — no generative content to QA" },
386:       cost_usd: 0, updated_at: new Date().toISOString(),
387:     }).eq("id", scene.id);
388:     return;
389:   }
```

## functions/advance-long-form-scene-generation/index.ts:500

```text
500: // PROGRESS/BUDGET, CAUSE_EFFECT, TIMELINE, MAP, FLOW, SIMPLE_CHART,
501: // ANNOTATED_OBJECT) still falls back to the BIG_TEXT/LABEL layout below —
502: // real, deliberate follow-up work, not silently claimed as done (see the
503: // final report).
504: export function renderProgrammaticGraphicCard(overlaySpec: any, styleSpec: any): { img: RawImage; overflowed: boolean } {
505:   const width = 2720, height = 1536;
506:   const bg: [number, number, number] = [24, 26, 32];
507:   const data = new Uint8Array(width * height * 4);
508:   const img: RawImage = { width, height, data };
509:   drawRect(img, 0, 0, width, height, bg, 255);
510: 
511:   const rawText = String(overlaySpec?.text ?? "");
512:   if (!rawText) return { img, overflowed: false };
513: 
514:   const textStyle = overlaySpec?.textStyle ?? {};
515:   const safeZone = overlaySpec?.safeZone ?? { xPct: 6, yPct: 6, widthPct: 88, heightPct: 26 };
516:   const placement = overlaySpec?.placement ?? "upper_third";
517:   const isPrimary = overlaySpec?.hierarchy === "primary" || textStyle.weight === "bold";
518:   const text = textStyle.casing === "sentence" ? rawText : rawText.toUpperCase();
519: 
```

## functions/_shared/sceneRenderPlan.ts:386

```text
386:   const trimmed = String(baseInstruction ?? "").trim().slice(0, 300);
387:   // Real gap found auditing Mars (Part 1C/4/9, 2026-09-15): compileScenePrompt
388:   // (GENERATE) already tells the model to render any screen/console/tablet
389:   // BLANK/abstract rather than risk legible text — that instruction was
390:   // never carried into the EDIT (Qwen) path, so an edit that touches a
391:   // device/tablet had nothing stopping it from inventing or preserving
392:   // gibberish UI copy. Same rule, same wording intent, applied here too.
393:   const base = `${trimmed} Preserve the exact ${styleSpec.name} illustration style, all characters' identity/outfit, composition and framing except for the described change. If the scene includes a screen, console, tablet, sign, or display panel, keep it BLANK, powered-off-looking, or showing only abstract icons/shapes/color blocks — never legible words, numbers or labels of any kind.`;
394:   // Part 10 (semantic-grounding pass): an EDIT beat can carry a claim too
395:   // (e.g. a state-change edit that also needs a negation preserved) — same
```

## functions/_shared/sceneReferenceBundle.ts:60

```text
60: export function buildReferenceBundleImage(sourceImages: RawImage[]): RawImage {
61:   const n = sourceImages.length;
62:   if (n === 0) throw new Error("REFERENCE_BUNDLE_EMPTY");
63:   const cols = Math.ceil(Math.sqrt(n));
64:   const rows = Math.ceil(n / cols);
65:   const board: RawImage = { width: cols * CELL_SIZE, height: rows * CELL_SIZE, data: new Uint8Array(cols * CELL_SIZE * rows * CELL_SIZE * 4) };
66:   drawRect(board, 0, 0, board.width, board.height, BOARD_BACKGROUND, 255);
67:   sourceImages.forEach((img, i) => {
68:     const col = i % cols, row = Math.floor(i / cols);
69:     // Fit the source into its cell preserving aspect ratio (letterboxed on
70:     // the shorter axis) rather than stretching — a squashed character
71:     // reference would itself corrupt the very identity this exists to
72:     // preserve.
73:     const scale = Math.min(CELL_SIZE / img.width, CELL_SIZE / img.height);
74:     const fitted = resizeImage(img, Math.max(1, Math.round(img.width * scale)), Math.max(1, Math.round(img.height * scale)));
75:     const offsetX = col * CELL_SIZE + Math.round((CELL_SIZE - fitted.width) / 2);
76:     const offsetY = row * CELL_SIZE + Math.round((CELL_SIZE - fitted.height) / 2);
77:     blitImage(board, fitted, offsetX, offsetY);
78:   });
79:   return board;
80: }
81: 
82: // Explicit reference-board framing (Part 2's exact requirement) — tells the
83: // model the supplied image is conditioning material, not a layout to
84: // reproduce, and maps each grid position to what it must preserve.
85: export function bundlePromptInstruction(assets: CanonicalReferenceAsset[]): string {
86:   const lines = [
87:     "REFERENCE BOARD: The supplied image contains canonical reference material for this scene, arranged as a grid. It is source material ONLY.",
88:     "Do NOT reproduce the board/collage/grid layout. Output ONE finished cinematic 16:9 scene.",
89:     "Preserve, from each reference panel in the board:",
90:   ];
91:   assets.forEach((a, i) => {
92:     const kind = a.reference_type === "character_reference" ? "character identity/outfit" : a.reference_type === "location_reference" ? "location geometry/design" : a.reference_type === "object_reference" ? "object/machine design" : "visual identity";
93:     lines.push(`- Panel ${i + 1} (${a.entity_name ?? a.entity_id ?? a.id}): ${kind}, exactly as shown.`);
94:   });
```

