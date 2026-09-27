# Mars active-episode forensic audit

Audit completed 2026-09-17. Diagnosis only. **The current episode is not publishable: 37 usable shots, 89 unacceptable images, and 10 missing outputs.** A successful render or a Ready badge is not evidence that a frame explains the narration.

[Open the visual per-shot audit](audit-gallery.html) · [CSV](per-shot-audit.csv) · [Full JSON](per-shot-audit.json) · [Raw snapshot](snapshot.json) · [Measurements](measurements.json) · [Source/result edits](edit-audit.json) · [Window analysis](windows-3-5-8.json)

“Good” means usable in an illustrated explainer, potentially with minor polish; it does not mean pixel-perfect or ready to rescue the surrounding sequence. Bad-image judgments are manual, not a newly run QA model. Dimensions and pixel equality are measured facts. Character identity assessments are visual judgments, not biometric identification. Borderline examples are called out rather than silently counted as cloning.

## 1. Active run and population inspected

- Project: `49a18b78-1d4b-4570-8113-5cd130687e1e`.
- Active generation run: `7b045213-7d27-4a7a-a857-64d2a672a1b5`.
- Active VisualPlan v4: `e65b6e53-489d-4b79-b6c0-b281699a2a18`.
- Visual World: `973ec40c-82d2-42d8-9090-c6cf469dd3f4`.
- Script: `63c3df8b-5c84-4e1b-8da4-922535064c0f`.
- 136 current shots; 126 existing final image files inspected chronologically; 10 failed tasks have no image to inspect.
- 66 GENERATE / 22 EDIT / 13 CROP / 7 REUSE / 28 PROGRAMMATIC_GRAPHIC.
- Timeline: **00:00–13:31.200**, 811.2 seconds. These are plan-estimated timings, not a watched rendered video or audio-reconciled timings.

Selection is one latest row per visual beat inside the active generation run and active VisualPlan, ordered by plan version, scene creation time, then scene ID. Historical attempts are excluded from all primary counts. Source images are used only for lineage diagnosis. The gallery identifies every selected scene UUID.

The intended narration contract is `9a3826cd-9a2d-4b48-8275-0b5a8489950e`, explicitly named in v4 metadata. All 136 stored plans have a null contract-version column, and the project current-contract pointer is null. Claim keys such as `s8__c1` are reused across versions with different meanings, so this audit attaches claims to the intended version rather than guessing from the newest contract.

## 2. Exact pixel-dimension report

Tolerance: `abs((width / height) / (16 / 9) - 1) <= 0.01`.

| Population / class | Count |
| --- | --- |
| Current shots | 136 |
| Images with measurable output | 126 |
| Valid 16:9 within 1% | 123 |
| Strict mathematical 16:9 subset | 22 |
| Invalid ratio | 3 |
| No output; not counted valid or invalid | 10 |
| Portrait | 2 |
| Square | 0 |
| 3:2 | 0 |
| 4:3 | 0 |
| Other invalid: extra-wide | 1 |

Every invalid output:

| Shot / scene UUID | Final pixels | Ratio | Strategy / provider | Origin |
| --- | --- | --- | --- | --- |
| 19 / 461d0b1c-d7ac-47b0-97e0-0917616c4db1 | 907×1536 | 0.59049479 | CROP / local compositor; Kling O3 source | Right-third crop retains full height |
| 45 / b748de24-73d2-4311-b23c-d301065b8a81 | 907×1536 | 0.59049479 | CROP / local compositor; Kling O3 source | Right-third crop retains full height |
| 113 / e7d41d42-c402-43d8-9b98-f157c0ce302a | 2720×768 | 3.54166667 | CROP / local compositor; Kling O3 source | Top-half crop retains full width |

Measured dimension distribution: 91 × 2720×1536; 22 × 1536×864; 10 × 1360×768; 2 × 907×1536; 1 × 2720×768. The 2720/1536 and 1360/768 frames deviate by 0.390625%, so they pass the specified tolerance but are not mathematically exact 16:9.

All **88 original provider result files** were also downloaded read-only: 66 Kling O3 outputs at 2720×1536 and 22 Qwen `runware:108@22` outputs at 1536×864. Every one matches its stored final decoded RGB pixels exactly. No resize, storage corruption or frontend-only distortion explains the three invalid frames. CROP is a local operation and has no separate provider output; its source lineage is included per shot. REUSE similarly has no new provider request. [Full raw dimensions](raw-dimensions.json).

The dimensions match the old literal crop rectangles: roughly one-third width/full height, or full width/half height. The currently inspected worker contains a 16:9 crop guard, but those existing historical outputs remain invalid. This is not evidence that the current guard was executed on them.

## 3. One scene per image

**6 violations: Shots 18, 32, 131, 132, 133, 134.** None of their active beats explicitly requests COMPARISON, BEFORE_AFTER or MULTI_PANEL_GRAPHIC; their plans forbid multi-panel layout.

- 102 generated/derived illustrations depict one spatially coherent scene.
- 6 illustrations contain unintentional panels/reference-sheet layouts.
- 12 nonblank programmatic frames have one graphic canvas, but fail quality/semantics separately.
- 6 graphics are blank and contain no scene at all.
- 10 tasks have no output.
- Intentional multi-panel outputs: 0.

Coherent illustrated cutaways are allowed: a view into a habitat is not automatically a montage. Shot 133 is different: it combines a cutaway with a separate lab scene and a headless reference-outfit fragment. Shot 132 preserves the storyboard layout from 131.

## 4. Character count, cloning and identity

**14 clear/probable-high-confidence physical-cast duplication cases:** 16, 110, 111, 112, 114, 115, 116, 117, 118, 119, 120, 121, 122, 130. **One additional probable case, Shot 109**, is kept outside that count because its background face is small. **28 identity-drift cases** are tracked separately; they overlap with cloning.

Shot 130 is decisive: **five protagonist-like men versus three distinct requested roles**. The same face family and uniform repeat around the table. The scene also depicts melting wax and ordinary-looking flames despite the synthetic-candle requirement.

Six extra-character cases: 16, 114, 115, 116, 117, 130. Ten missing-role cases: 109, 118, 119, 130, 131, 132, 133, 134, 135, 136. A missing role can coexist with extra people: extra protagonist copies do not supply the absent agricultural specialist or maintenance officer.

Sheet drawings in 18/32 are counted as reference leakage, not additional physical crew. Repetition across panels in 131/132/134 is counted as composition leakage, not proof of several people in a single room. The three helmeted crew in 106 are not called clones. Shot 23 and the two rear heads in 103 lack enough facial information to prove cloning. Hands-only detail shots are not required to show a whole person. Shots 76–78 have three visible hands with unclear ownership: this is awkward anatomy/composition, not a confident count of three people.

The per-shot records include requested character names, observed count/partial-body description, classification and uncertainty. This is why the totals are conservative rather than treating every repeated brown hairstyle as a duplicate.

## 5. Reference usage and leakage

**3 definite visible-reference leaks:** 18 and 32 show complete sheets; 133 contains a headless outfit fragment plus the reference-like split composition. **3 further board-associated composition leaks:** 131, 132, 134. Those outputs share the risky lineage, but literal pasting of the entire board is not proven for them.

All 66 GENERATE and 22 EDIT jobs were checked for supplied image URLs. GENERATE routing: **35 composite-board jobs; 31 single/direct-reference jobs**. EDIT jobs use their source scene as the reference. The offending GENERATEs use Kling O3 with `reference-bundle-v1`: protagonist sheet plus habitat reference merged into one image. The prompt says not to reproduce the grid, but that prohibition does not reliably overcome the visual conditioning.

| Offender | Bundle / path | Observed result |
| --- | --- | --- |
| 18 | 36a568c5-7d16-403d-9e94-fd2ea8b41428 | Full sheet remains visible |
| 32 | a9c245e9-b8a0-4432-9378-fa31d141dcd5 | Full sheet remains visible; QA approves |
| 131, 133 | 5bcfad7b-ec84-47e5-88de-580726f5b8b9 | Storyboard/split layout; outfit fragment in 133 |
| 134 | 7995ea09-4204-4446-b47b-0592ed1478bb | Three meal panels |
| 132 | Qwen EDIT from 131 output | Inherits panels and erases checklist |

These bundles supply the protagonist and location, not a complete distinct cast. For example, 131’s prompt names the agricultural specialist without a dedicated reference and omits the maintenance-officer identity despite QA expecting it. The registry marks the maintenance officer `referenceNeeded:false`, while the protagonist sheet is repeatedly used. The same sheet itself contains white-suit views plus grey/teal outfit detail, increasing ambiguity. Location references are cutaway pods/cabinets rather than full usable interiors; the greenhouse reference can encourage a cabinet sitting on Martian ground. These are supported causal mechanisms, not proof that every similar face arose from precisely the same mechanism. [Bundle records](bundles.json).

## 6. Qwen EDIT effectiveness

**22 edits: 8 meaningful local changes, 14 failed or incomplete requested deltas.** The 8 include one partial/medium-confidence success, Shot 102. Local success does not make a bad source scene acceptable: 90 labels the wrong object; 115/117/119 retain duplicated characters.

**2 predominantly lighting/color edits: 43 and 80. Strictly lighting-only edits: 0**, because both also erase screen content. They are tagged LIGHTING_ONLY_EDIT as the practical cosmetic-edit failure class, with that qualification recorded explicitly.

| Shot | Difference strength | Requested delta | Visible result |
| --- | --- | --- | --- |
| 6 | MEANINGFUL | Accomplished / partial for 102 | Edit substantially supplies the requested checklist; punctuation is awkward but the three important items are readable. |
| 7 | MINOR | Failed / incomplete | Checklist edit introduces misspelled readiness/review lettering, making required text unreliable. |
| 25 | MEANINGFUL | Accomplished / partial for 102 | Edit changes a humidity reading to a pressure trace/anomaly: a real object-state/content change. |
| 27 | MEANINGFUL | Accomplished / partial for 102 | The requested cartridge tag appears; screens are unnecessarily blanked, but the maintenance subject remains clear. |
| 30 | MINOR | Failed / incomplete | Exception label is visibly truncated/misspelled; the targeted log entry is not dependable. |
| 35 | MINOR | Failed / incomplete | The important unresolved-anomaly label contains malformed spelling. |
| 36 | MINOR | Failed / incomplete | Tiny malformed handoff-confirmation lettering does not reliably communicate the required confirmation. |
| 43 | COSMETIC_ONLY | Failed / incomplete | Edit largely changes brightness and blanks the alert; wrong specialist remains and no explanatory action is added. |
| 77 | MINOR | Failed / incomplete | Valve-position/wear change is not demonstrated; the bag and three-hand setup remain while the alert screen is erased. |
| 78 | MINOR | Failed / incomplete | Requested gasket gap is not clearly shown; the same bag composition persists with screen erasure. |
| 80 | COSMETIC_ONLY | Failed / incomplete | Orange grading and blank monitor dominate the edit; the requested sample-label/bag improvement is absent. |
| 85 | MINOR | Failed / incomplete | Red warning is added, but the diagnostic display is blanked instead of showing the requested regulator-fault icon. |
| 87 | MINOR | Failed / incomplete | Gauge turns green, but the filter is not visibly swapped and the needle/state evidence is inadequate for the requested repair result. |
| 90 | MEANINGFUL | Accomplished / partial for 102 | Serviceable label edit succeeds locally, but it labels the wrong underlying object/door scene. |
| 101 | MINOR | Failed / incomplete | Edit softens and smears the hands/line work despite requesting increased sharpness; monitor is blanked. |
| 102 | MEANINGFUL | Accomplished / partial for 102 | Green indicators and a changed hand position provide a partial but usable verification cue; actuator-open state remains uncertain. Partial/medium confidence: green state is visible; actuator rotation cannot be verified. |
| 115 | MEANINGFUL | Accomplished / partial for 102 | Meal props are added meaningfully, but the duplicated-cast problem remains. |
| 117 | MEANINGFUL | Accomplished / partial for 102 | A red table alarm is added, but duplicated characters remain; the image does not depict automated mitigation. |
| 119 | MEANINGFUL | Accomplished / partial for 102 | Handheld tester is added, a real local delta; duplicated characters and missing role identity remain. |
| 121 | MINOR | Failed / incomplete | Signed-by field appears on the wall rather than clearly on a fault ticket; cast duplication persists. |
| 122 | MINOR | Failed / incomplete | Stylus is added, but no close-up or signed/saved indicator is delivered; the screen becomes blank. |
| 132 | MINOR | Failed / incomplete | Edit preserves the multi-panel layout and blacks out the checklist it was supposed to make legible. |

No edit delivers a material camera/composition change. Limited hand/pose changes occur in 7, 78, 102, 119 and 122; no clear head-direction or expression change is established. The [edit audit](edit-audit.json) records all eight requested axes individually. Many prompts expressly say to preserve pose/camera, so this is partly a planning limitation, not solely model refusal.

A direct prompt contradiction recurs: an instruction requests exact readable UI, then the shared suffix says every screen must be blank or contain no legible labels. This explains why screen erasure is frequent and why asking Qwen to fix a label does not reliably fix it. The source/result pages (`edits-01.jpg` through `edits-21.jpg`) show every pair.

## 7. Exact and near-duplicate sequence analysis

Pixel-identical groups, comparing decoded RGB plus dimensions:

- 3, 4
- 5, 8
- 28, 29
- 46, 47
- 63, 64, 65, 66, 72, 73
- 67, 68
- 89, 91
- 114, 116

That is **8 groups, 20 participating shots, 12 repeats beyond each group's first image, and 8 exact adjacent transitions**. Blank-image equality is real but reported separately from illustrated holds.

There are **16 manually confirmed stagnant/repeated-setup runs covering 50 shots**. Not every frame in a run is an identical image. For example, 26–30 contains two related setups, and 109–113 has exercise/standing/crop variants. These are editorial stagnation, not claimed hash matches.

All rolling windows were evaluated: **134 three-shot windows / 132 five-shot windows / 129 eight-shot windows**. Respectively **29 / 53 / 78** contain a strict similar pair or at least a three-shot overlap with a reviewed stagnant run. These overlapping window counts must not be summed into a number of independent defects. The numeric screen uses dHash ≤10 and grayscale correlation ≥0.85, plus exact pixel equality; blank frames are handled by equality because correlation is undefined. Hashes are a screening aid, not proof of narrative redundancy. [All 395 windows](windows-3-5-8.json), [pair metrics](similarity.json), [all 16 runs](stagnant-runs.json).

Across 135 timeline boundaries, the visual-change classification is 61 MAJOR, 10 MEANINGFUL, 39 MINOR, 2 COSMETIC_ONLY, 8 NONE, and 15 unavailable boundaries. Thus 71/120 inspectable transitions provide substantial visual novelty, but many novel images still fail meaning or identity. This is not a claim that 71 transitions are educationally successful.

## 8. Blur and image quality

**One clear degraded/blurred final: Shot 101.** Its edited hands and contours are visibly softer/smeared than the source, despite a sharpening instruction. This is not background depth-of-field. **10 corrupted-looking graphic outputs** are isolated from generative blur, and **9 bad crops** are separately recorded.

The final assets are generally large enough; no low-resolution-looking global failure, additional major blur cluster or accidental upscale was established. Raw-provider/final equality argues against storage-induced compression damage. It does not prove that the provider performed no internal resizing. Mixed realism is clearest in 135: realistic face/food rendering sits beside flat cartoon faces. Shot 38 also departs from the intended character/style family.

## 9. Text and gibberish

**18 images have materially bad generated text:** 5, 7, 8, 16, 17, 30, 35, 36, 51, 67, 68, 69, 76, 82, 83, 94, 95, 129. **10 additional images have minor incidental glyph defects:** 14, 15, 23, 28, 29, 31, 33, 49, 86, 128. These counts exclude corrupted programmatic lettering.

Important correct text/examples include 3/4’s oxygen-water-power indicators, 6’s checklist, 27’s cartridge label, 75’s corrective-action log, and 108’s dose-accounting heading. Shot 90’s Serviceable wording is correct but on the wrong object. Shot 103’s CO2 NOMINAL is spelled correctly but its graph gives ambiguous recovery evidence. Correct spelling alone is not semantic correctness.

“Expention Note” in 16/17, malformed exception/anomaly labels, and the suit-fault misspelling in 82/83 are central explanatory evidence and matter. Tiny background glyphs in 14/15/31/49 do not justify a hard fail. Six images erase/fail the required text/evidence: 77, 78, 85, 121, 122, 132. No separate confirmed cohort of harmless readable words was classified as a hard failure merely for being readable.

## 10. Programmatic graphics

**All 28 graphic shots are currently unacceptable: 18 bad images plus 10 missing outputs.** Breakdown:

| Class | Count | Shots |
| --- | --- | --- |
| Blank | 6 | 63, 64, 65, 66, 72, 73 |
| Clipped/color-fringed bitmap output | 10 | 54, 55, 60, 92, 93, 97, 123, 124, 125, 127 |
| Readable but insufficient label-only graphic | 2 | 53, 96 |
| Failed / no output | 10 | 56, 57, 58, 59, 61, 62, 70, 71, 98, 126 |

All 18 available graphic frames pass the ratio tolerance. They fail pixels, semantics or both. The six blank outputs have null overlay specs. The remaining stored plans use legacy BIG_TEXT/LABEL specs rather than a structured visual relationship. A title such as “Max EVA time” does not show the budget conversion; “ISRU staggered” does not show load staggering. Required diagrams/symbols/relationships are absent, regardless of whether a short title is readable.

The current worker still routes old-shaped specs to the legacy renderer. Its empty-text branch returns an empty image without an issue, and deterministic success can be auto-approved. Current structured templates do not retroactively upgrade these stored plans. Ten missing tasks have `CLAIMS_EXHAUSTED`; that is the terminal symptom. The precise initial timeout/error for each of those tasks was not established from the retained scene evidence, so it is not attributed to an image provider or a specific loop without proof.

## 11. Narration match

**40 nongraphic shots have a material semantic mismatch**, plus the 28 failed/unusable graphic tasks. Counts overlap with identity/text/crop problems. These 68 shots do not communicate their assigned claim adequately in the current sequence.

The most consequential failures are mechanism substitution: a worried face for scheduling drift (9–10), a repeated checklist for sol length (8), generic console screens for allocation priorities (67–69), a suit panel for a rover drill (81), a green door for repaired-suit availability (88–91), and an uninformative generic stability panel for automated containment (104–105). The closing systems resolution is asserted in narration but not demonstrated in 133/136.

By contrast, valve handling, pruning, lamp adjustment, seal reseating and rock sampling are understandable actions. Those stronger shots show that the pipeline can produce useful illustrations when the subject/action is concrete and the framing actually isolates it.

## 12. QA confusion table

| Current status + manual assessment | Count |
| --- | --- |
| Ready + good | 4 |
| Ready + bad | 30 |
| Review + good | 33 |
| Review + bad | 59 |
| Failed / no image | 10 |

**33 false positives and 30 false negatives**, using the user's definitions. Ready-good shots are 4, 13, 26 and 29. Ready is therefore unreliable in this snapshot: 30/34 Ready outputs are unacceptable. Review is also noisy: 33/92 are usable.

The major calibration problems:

1. All 18 graphic outputs are approved through deterministic trust despite blank/corrupted/insufficient content.
2. REUSE checks source success, not source QA, and writes approved. Six of seven reused current sources are rejected: 4←3, 8←5, 29←28, 47←46, 68←67, 91←89. Some rejected sources are actually usable, but the unconditional approval is still unsound; changed narration also needs checking.
3. Broad inherited cast requirements penalize useful object-only detail/establishing shots. Shot 3 is explicitly rejected for missing protagonist and readable text even though it communicates the three status icons correctly.
4. Blanket generated-text policy confuses useful/incidental lettering with factual errors.
5. Shot 32 is an unambiguous vision-QA false negative: its result says no sheet/no leakage while the left half is a sheet.
6. Current code contains newer safeguards, but existing stored verdicts do not prove those checks were run. QA must be interpreted together with its actual result/version and source lineage.

Fault totals below overlap; do not add them to obtain a scene count.

| Fault | Count / scope |
| --- | --- |
| Definite visible-reference leakage | 3; 3 further board-associated composition leaks |
| Unintentional multi-scene composition | 6 |
| Physical character cloning | 14 + 1 additional probable |
| Identity drift | 28 |
| Semantic mismatch | 40 nongraphic + 28 unusable graphic tasks |
| Wrong location | 3 |
| Failed visual delta | 14 |
| Predominantly lighting/color edit | 2; strictly lighting-only 0 |
| Repeated/stagnant sequence | 16 runs / 50 shots |
| Near-duplicate neighboring transitions | 22 |
| Blurry output | 1 |
| Bad generated text | 18 major + 10 minor |
| Bad graphics | 18 bad images + 10 missing |
| Bad crops | 9 |
| Invalid final aspect ratio | 3 |

## 13. Top 25 worst shots

Critical failures tie; this ranking emphasizes episode-breaking examples and every no-output task. Full UUIDs and all other failures remain in the per-shot dataset.

| Rank / shot | Start | Severity | Why |
| --- | --- | --- | --- |
| 1 / 130 | 12:43.200 | CRITICAL | Five near-identical protagonists surround the table where three distinct crew are requested; melted wax/flames also contradict synthetic candles. |
| 2 / 132 | 12:54.197 | CRITICAL | Edit preserves the multi-panel layout and blacks out the checklist it was supposed to make legible. |
| 3 / 32 | 02:55.180 | CRITICAL | A full reference sheet occupies the left half, yet current QA explicitly says no leakage and approves it. |
| 4 / 18 | 01:37.976 | CRITICAL | A complete protagonist turnaround remains visibly pasted beside the habitat scene. |
| 5 / 133 | 13:00.578 | CRITICAL | Split habitat/lab composition includes a headless reference-outfit fragment and fails to show the intended restored systems clearly. |
| 6 / 134 | 13:07.050 | CRITICAL | Three separate meal mini-scenes replace one coherent communal moment; repeated protagonist representations leak across panels. |
| 7 / 19 | 01:44.266 | CRITICAL | A narrow right-side crop of Shot 18 produces a portrait frame and loses the forecast explanation. |
| 8 / 45 | 04:08.193 | CRITICAL | Right-third crop becomes portrait and cuts away useful lamp-adjustment context. |
| 9 / 113 | 10:47.498 | CRITICAL | Top-half crop is extra-wide and cuts bodies/heads, violating final-frame geometry. |
| 10 / 56 | 05:09.446 | CRITICAL | No current image; worker exhausted its claims. This is a failed graphic task, not a provider generation failure. |
| 11 / 57 | 05:12.899 | CRITICAL | No current image; worker exhausted its claims. This is a failed graphic task, not a provider generation failure. |
| 12 / 58 | 05:19.200 | CRITICAL | No current image; worker exhausted its claims. This is a failed graphic task, not a provider generation failure. |
| 13 / 59 | 05:22.860 | CRITICAL | No current image; worker exhausted its claims. This is a failed graphic task, not a provider generation failure. |
| 14 / 61 | 05:41.034 | CRITICAL | No current image; worker exhausted its claims. This is a failed graphic task, not a provider generation failure. |
| 15 / 62 | 05:50.400 | CRITICAL | No current image; worker exhausted its claims. This is a failed graphic task, not a provider generation failure. |
| 16 / 70 | 06:38.694 | CRITICAL | No current image; worker exhausted its claims. This is a failed graphic task, not a provider generation failure. |
| 17 / 71 | 06:47.026 | CRITICAL | No current image; worker exhausted its claims. This is a failed graphic task, not a provider generation failure. |
| 18 / 98 | 09:21.701 | CRITICAL | No current image; worker exhausted its claims. This is a failed graphic task, not a provider generation failure. |
| 19 / 126 | 12:17.439 | CRITICAL | No current image; worker exhausted its claims. This is a failed graphic task, not a provider generation failure. |
| 20 / 63 | 05:58.244 | CRITICAL | Uniform dark frame: no symbols, relationships or text explain the narration; automatically marked Ready. |
| 21 / 54 | 04:56.601 | CRITICAL | Clipped, oversized, color-fringed bitmap lettering makes the deterministic graphic unusable; automatically marked Ready. |
| 22 / 55 | 05:03.794 | CRITICAL | Clipped, oversized, color-fringed bitmap lettering makes the deterministic graphic unusable; automatically marked Ready. |
| 23 / 60 | 05:32.288 | CRITICAL | Clipped, oversized, color-fringed bitmap lettering makes the deterministic graphic unusable; automatically marked Ready. |
| 24 / 123 | 11:56.400 | CRITICAL | Clipped, oversized, color-fringed bitmap lettering makes the deterministic graphic unusable; automatically marked Ready. |
| 25 / 124 | 12:01.000 | CRITICAL | Clipped, oversized, color-fringed bitmap lettering makes the deterministic graphic unusable; automatically marked Ready. |

## 14. Top 10 stagnant sequences

| Shots | Length / duration | Similarity / difference | Edits | What actually changes |
| --- | --- | --- | --- | --- |
| 63–66 | 4 / 22.823s | EXACT / NONE | 0 | Four identical blank frames replace several different power concepts. |
| 5–8 | 4 / 24.671s | HIGH / MINOR | 2 | Checklist wording changes; same pose/camera; final reuse crosses into sol-length claim. |
| 114–117 | 4 / 27.281s | HIGH / MINOR | 2 | Same seated crew; plates and alarm added; exact source reused between them. |
| 120–122 | 3 / 23.560s | HIGH / MINOR | 2 | Same typing/gym layout; small field/stylus changes fail to show signed log. |
| 109–113 | 5 / 27.811s | MEDIUM / MINOR | 0 | Exercise and standing variants/crops retain repeated protagonist figures; little conceptual progress. |
| 26–30 | 5 / 28.203s | MEDIUM / MINOR | 2 | Two related work/tablet setups; only a tag and log text change, then a reuse. |
| 76–78 | 3 / 17.053s | HIGH / MINOR | 2 | Bag and three-hand composition stays; requested valve/gasket changes absent. |
| 34–36 | 3 / 17.580s | HIGH / MINOR | 2 | Identical hands/port; only faulty log labels change. |
| 67–69 | 3 / 17.627s | HIGH / MINOR | 0 | One exact repeat plus a near-identical console variation; priorities remain unexplained. |
| 131–132 | 2 / 14.502s | HIGH / NONE | 1 | Same storyboard panels; edit erases the checklist instead of isolating it. |

Small state changes can be narratively valid, such as adding a meal or alarm. The problem is asking them to carry long stretches of new claims while camera, cast and action remain substantially fixed. The 131–132 run has no useful improvement: screen erasure is a change, but not an explanatory delta.

## 15. Overall episode quality

The episode currently feels like an AI slideshow interrupted by broken title cards, rather than an intentional illustrated explainer. The hook begins with a misleading oxygen-like wake effect. The opening then spends 24.671 seconds on one checklist setup and another 17.838 seconds on worried faces while important time-management concepts go unexplained.

The hands-on maintenance, pruning and EVA inserts are the strongest material. They use clear objects/actions and need less face-driven storytelling. The middle power-budget section is severely disrupted by blank, corrupt and absent graphics. The health/autonomy section repeats exercise, table and typing layouts while losing distinct crew identities. The ending—the intended emotional payoff—contains clones and storyboard panels.

Graphics occupy **170.035 seconds, 21.0% of the planned episode**, and none currently works at the required standard. More graphics would not solve this; actual diagrams showing cause, comparison and allocation would. Characters are overused where mechanisms are needed, especially screens-with-people standing in for explanations. Only **206.725 seconds, 25.5% of runtime**, is currently assigned a usable image under this review. This is image-level usability, not approval of a complete edited video.

## 16. Ten systemic root causes, ranked by practical impact

Affected populations overlap. A structural exposure count is not a count of proven bad images. Improvement estimates are not additive.

| Priority | Root cause / affected population | Severity | Expected benefit | Complexity |
| --- | --- | --- | --- | --- |
| 1 | Legacy graphic plan/renderer/acceptance contract: 28 tasks; 18 bad pixels and 10 missing | Critical | Recover the broken 21% graphic portion when content and lifecycle both work | Medium–high |
| 2 | Reference routing and distinct-cast coverage: 31 shots with identity/composition/reference defects; 35 GENERATE jobs use boards | Critical | Prevent sheet/panel conditioning and replace repeated protagonist identities with intended roles | High |
| 3 | Edit/text instruction contract contradicts itself: 22 EDITs exposed; 14 incomplete deltas; 18 major generated-text cases overall | Major–critical | Stop erasing required evidence and make small state changes readable | Medium |
| 4 | Claim-to-visual planning substitutes generic scenes for mechanisms: 40 nongraphic mismatches | Major | Show time drift, allocation, failure and recovery as observable relationships | High |
| 5 | Sequence strategy underprices repetition: 16 runs / 50 shots | Major | Use true reframing/action/visual-form change where edits/crops do not progress meaning | Medium–high |
| 6 | QA calibrated to inherited requirements, not useful shot evidence: 33 false positives / 30 false negatives | Critical trust failure | Reduce needless review and expose bad Ready images; changes classification, not pixels | Medium–high |
| 7 | Derivation trusts source success and loses semantic/geometry guarantees: 7 REUSE, 13 CROP; 9 bad crops, 3 invalid ratios | Critical for affected frames | Preserve valid final geometry, focal subject and current-claim fitness | Medium |
| 8 | Location references model props/cutaways rather than usable spaces: 3 clear wrong-location shots, broader continuity exposure | Major | Avoid greenhouse-on-Mars-ground and reduce unrelated room changes | Medium |
| 9 | Plan/contract/output version identity is not pinned end-to-end: all 136 plan contract pointers null | Critical latent risk | Make diagnosis, QA and replay evaluate the intended claim/version | Medium |
| 10 | Output quality/style evidence is incomplete or stale: 1 clear blurred edit, 2 style-drift cases; existing verdicts predate safeguards | Major localized / systemic escape risk | Catch degraded hands, mixed realism and obsolete verdicts at the actual output boundary | Medium |

Code evidence was read in the deployed worker (version 20), start endpoint (version 13), shared compiler/reference/QA/compositor files, and local UI. [Deployed excerpts](deployed-code-evidence.md). The UI's per-beat Map selection is order-dependent when multiple unreplaced rows exist; this is a reproducibility risk, not a proven cause of an individual image defect. The audit therefore uses an explicit latest-row ordering.

The original renderer revision that made every corrupt graphic was not fully reconstructed. The visible output defect is proven; a specific byte-level corruption mechanism is not. Similarly, `CLAIMS_EXHAUSTED` proves exhaustion, not its initiating cause. These are the remaining forensic uncertainties, not reasons to call those outputs acceptable.

## 17. Recommended fix order — no implementation performed

1. First establish an immutable run/plan/contract/source manifest and acceptance fixtures from this audit. This is a prerequisite for judging fixes, not a new generation request.
2. Fix the legacy graphic contract end-to-end: required semantic template, populated data, bounded rendering, final pixel validation, and truthful failure reporting. Do not assume the new template code upgrades old rows.
3. Fix reference/cast routing: role-specific identity coverage, no sheet/board layout as scene conditioning, and safe scene-space location references.
4. Resolve required-text ownership and edit contradictions; separate deterministic labels from image edits and prove the requested source→result delta.
5. Correct mechanism planning and then sequence freshness; use different visual forms when a new claim cannot be explained by a small edit.
6. Enforce crop/source/REUSE invariants and claim fitness at the final output boundary.
7. Recalibrate QA on the good/bad examples here, including deterministic outputs and reused scenes. Validate image quality and version every verdict.
8. Only after those checks, consider a separately authorized, bounded recovery of current failing shots. Do not bulk-regenerate the episode as a substitute for fixing the contracts.

No code changes, retries or migrations were performed in this audit.

## 18. Improvement estimate for the top three root causes

**Code changes alone make zero existing images acceptable**: already stored pixels do not change. With subsequently authorized repair/re-rendering/recomposition, a conservative planning estimate is **40–50 additional usable shots**, raising the current 37 to roughly **77–87 of 136**.

The estimate assumes 24–28 of the 28 graphic tasks become useful after both semantics and reliability are repaired; 12–16 additional cast/reference-dominated shots recover after residual semantic/crop defects are excluded; and 4–6 additional text/edit-dominated shots recover after overlap is removed. The ranges sum to 40–50. These are judgment-based scenario estimates, not measured model success rates or a guarantee. The remaining scene-planning, crop, repetition and QA problems prevent claiming that the top three fixes would finish the episode.

## 19. Provider calls = 0

No inference, generation, Qwen edit, Runware submission, or external QA-model call was made. Only existing image files were fetched from storage/CDN and decoded locally.

## 20. Credits charged = 0

No paid generation, retry, reservation or credit mutation was triggered by this audit.

## 21. Production mutations = 0

Supabase reads only. No scene changes, migrations, deploys, pushes or merges. Only local audit scripts, evidence and reports under `artifacts/mars-forensic` were written. The repository already contains unrelated modifications; this audit does not claim a clean checkout or create a commit. Frontend deployment: **NOT performed**; there is no connected Vercel route and no authorization to push main. A build is not relevant validation of this read-only image audit and was not rerun.

**Deploy: nothing for this audit. Migration to run: none.**

## Appendix: issue index

| Issue | Count | Every tagged shot |
| --- | --- | --- |
| ASPECT_RATIO_INVALID | 3 | 19, 45, 113 |
| BAD_CROP | 9 | 12, 17, 19, 45, 52, 83, 95, 113, 129 |
| BAD_GRAPHIC | 28 | 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 70, 71, 72, 73, 92, 93, 96, 97, 98, 123, 124, 125, 126, 127 |
| BLANK_GRAPHIC | 6 | 63, 64, 65, 66, 72, 73 |
| BLURRY_OUTPUT | 1 | 101 |
| CAMERA_STAGNATION | 34 | 6, 7, 8, 10, 27, 28, 29, 30, 35, 36, 64, 65, 66, 68, 69, 77, 78, 80, 87, 90, 91, 101, 102, 110, 111, 112, 113, 115, 116, 117, 119, 121, 122, 132 |
| CHARACTER_DUPLICATION | 14 | 16, 110, 111, 112, 114, 115, 116, 117, 118, 119, 120, 121, 122, 130 |
| COMPOSITION_AWKWARD | 3 | 76, 77, 78 |
| CORRUPTED_IMAGE | 10 | 54, 55, 60, 92, 93, 97, 123, 124, 125, 127 |
| EXACT_DUPLICATE_NEIGHBOR | 8 | 4, 29, 47, 64, 65, 66, 68, 73 |
| EXCESSIVE_SAME_SETUP_RUN | 50 | 5, 6, 7, 8, 9, 10, 26, 27, 28, 29, 30, 34, 35, 36, 63, 64, 65, 66, 67, 68, 69, 76, 77, 78, 79, 80, 86, 87, 89, 90, 91, 100, 101, 102, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 131, 132 |
| EXTRA_CHARACTER | 6 | 16, 114, 115, 116, 117, 130 |
| FAILED_VISUAL_DELTA | 14 | 7, 30, 35, 36, 43, 77, 78, 80, 85, 87, 101, 121, 122, 132 |
| GRAPHIC_SEMANTIC_MISMATCH | 28 | 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 70, 71, 72, 73, 92, 93, 96, 97, 98, 123, 124, 125, 126, 127 |
| GRAPHIC_TOO_TEXT_HEAVY | 2 | 53, 96 |
| IDENTITY_DRIFT | 28 | 38, 39, 42, 43, 46, 47, 48, 99, 109, 110, 111, 112, 114, 115, 116, 117, 118, 119, 120, 121, 122, 130, 131, 132, 133, 134, 135, 136 |
| LIGHTING_ONLY_EDIT | 2 | 43, 80 |
| LONG_DUPLICATE_RUN | 40 | 5, 6, 7, 8, 26, 27, 28, 29, 30, 34, 35, 36, 63, 64, 65, 66, 67, 68, 69, 76, 77, 78, 89, 90, 91, 100, 101, 102, 109, 110, 111, 112, 113, 114, 115, 116, 117, 120, 121, 122 |
| MISSING_CHARACTER | 10 | 109, 118, 119, 130, 131, 132, 133, 134, 135, 136 |
| MISSING_REQUIRED_OBJECT | 12 | 51, 52, 77, 78, 80, 81, 88, 89, 90, 91, 133, 136 |
| MISSING_REQUIRED_TEXT | 6 | 77, 78, 85, 121, 122, 132 |
| MULTI_SCENE_COMPOSITION_LEAK | 6 | 18, 32, 131, 132, 133, 134 |
| NEAR_DUPLICATE_NEIGHBOR | 22 | 6, 7, 8, 10, 35, 36, 69, 77, 78, 80, 87, 90, 91, 101, 102, 115, 116, 117, 119, 121, 122, 132 |
| PHOTOREALISM_DRIFT | 1 | 135 |
| PORTRAIT_OUTPUT | 2 | 19, 45 |
| POSE_STAGNATION | 34 | 6, 7, 8, 10, 27, 28, 29, 30, 35, 36, 64, 65, 66, 68, 69, 77, 78, 80, 87, 90, 91, 101, 102, 110, 111, 112, 113, 115, 116, 117, 119, 121, 122, 132 |
| REFERENCE_BOARD_VISIBLE | 1 | 133 |
| REFERENCE_SHEET_VISIBLE | 2 | 18, 32 |
| SEMANTIC_MISMATCH | 40 | 1, 8, 9, 10, 12, 18, 19, 32, 38, 39, 43, 47, 51, 52, 67, 68, 69, 76, 77, 78, 79, 80, 81, 87, 88, 89, 90, 91, 103, 104, 105, 112, 116, 117, 121, 122, 129, 132, 133, 136 |
| SUBJECT_CROPPED_OUT | 4 | 19, 45, 52, 113 |
| TEXT_CLIPPING | 12 | 30, 54, 55, 60, 83, 92, 93, 97, 123, 124, 125, 127 |
| TEXT_GIBBERISH_MAJOR | 18 | 5, 7, 8, 16, 17, 30, 35, 36, 51, 67, 68, 69, 76, 82, 83, 94, 95, 129 |
| TEXT_GIBBERISH_MINOR | 10 | 14, 15, 23, 28, 29, 31, 33, 49, 86, 128 |
| TEXT_OVERFLOW | 10 | 54, 55, 60, 92, 93, 97, 123, 124, 125, 127 |
| WRONG_ACTION | 9 | 1, 39, 77, 78, 81, 87, 88, 122, 132 |
| WRONG_LOCATION | 3 | 38, 79, 80 |
| WRONG_OBJECT | 3 | 89, 90, 91 |
| WRONG_STYLE | 2 | 38, 135 |
