# Zyvo Look / Visual Director verification

Completed 2026-09-09. Scope: Visual Plan recovery, creator workspace, deterministic shot refinement. Script, Research and StoryPlan were not edited. Visual World was not started.

## Visual Director upgrade — 30 requested points

1. **Before:** the existing Mars plan had 14 coarse visual items across seven chapters and 895 estimated seconds. These were sequence-sized items, unsuitable as 14 static shots.
2. **Model:** `visualSequences` preserves the original macro items and their purpose, timing and grounding. `visualBeats` contains individual shots, with `sequenceId`, exact narration character ranges, timing, framing, visual evolution and independent render instructions. Sequence payoffs are preserved and shot references remapped.
3. **Real Mars sequences:** 14.
4. **Real Mars shots:** 137, created deterministically from the saved plan, without a provider call.
5. **Average duration:** 6.533 seconds; total remains 895 seconds.
6. **Longest shot:** 11.842 seconds.
7. **Distribution:** under 4 seconds: 16; 4–8 seconds: 87; 8–12 seconds: 34; 12–15 seconds: 0; over 15 seconds: 0.
8. **Density gate:** rejects overly sparse plans, long static/detail shots, invalid timing, gaps and missing narration ranges. The old coarse plan fails; the refined Mars plan passes. This is a deterministic structural gate, not a claim of complete editorial quality review.
9. **Variable pacing:** timings follow semantic units and relative narration length. Long units use uneven camera/graphic progression steps. Detail shots are limited to seven seconds; longer concepts receive wider framing or internal visual evolution. Shot count is not a fixed quota.
10. **Semantic splitting:** sentence, semicolon, em-dash and selected clause boundaries; short fragments merge with adjacent content. Exact source character offsets are retained. Tests check coverage of every non-whitespace narration character, preserved facts and contiguous timing. Audio reconciliation remains required after TTS.
11. **Expected base images:** seven established physical bases. This is a preliminary asset estimate, not an approved production budget; it is aggressive and needs review against the final Script.
12. **Reuse/edit:** 31 reuse shots, 29 crop shots and 11 edit shots, plus seven base generations. Camera cuts and shots are distinct from generated assets.
13. **Programmatic graphics:** 59 shots. Visual-type totals include 21 diagram shots and zero map shots; programmatic graphics also include other graphic types.
14. **Schematics:** deterministic SVG director sketches, rendered locally with no image service.
15. **Primitives:** environment/horizon framing, crew silhouettes, bunks/windows, tablet interfaces, plants/shelves, object mechanisms, flow nodes, comparison panels, data cards and map regions.
16. **Shot size:** wide frames emphasize environment; medium/close change subject scale; detail/insert emphasize objects. Unsupported camera choices are not exposed.
17. **Continuity:** stable setup-derived composition, real registry character counts, recurring environments and human-readable Setup labels; attention overlays vary within reused setups.
18. **Diagrams/maps:** diagrams use nodes, connections and progressive emphasis; maps have a schematic region treatment, not invented precise geography. Mars contains no map shots to verify as real content.
19. **Hero:** six-shot filmstrip with timing, sketch, description and friendly production badge; clicking opens a larger preview.
20. **Hierarchy:** Chapter → Sequence → Shot in the full storyboard, with chapter navigation, sequence purpose/timing and exact shot narration excerpts.
21. **Editing:** description, supported shot size/type, existing location and character assignment. Draft edits save as a new immutable READY version through an ownership-checked, stale-source-protected RPC. Narration ranges, timing, facts, reveal constraints and history remain preserved. Changed physical shots establish independent assets; first-use continuity is repaired. Forbidden-phrase warnings and grounding guidance are deterministic and do not detect every possible semantic contradiction.
22. **Storyboard AI images generated:** ZERO.
23. **Runware spend for this upgrade:** ZERO. No reference images, scene images, TTS or render were generated.
24. **Later image upgrade:** the renderer accepts a READY, reference-backed `productionFrame`; edits invalidate that frame. Actual reference generation is a later workflow and was not started here.
25. **Files:** see the scoped inventory below.
26. **Tests:** 24 scoped Node tests passed. SQL lifecycle and persistence tests passed in rolled-back transactions. Scoped frontend ESLint passed. Local Deno checking was unavailable because the installed runtime cannot resolve `jsr:`; successful Supabase deployment validated backend bundling.
27. **Vite:** final client `vite build` passed in 11.93 seconds; SSR build passed in 7.16 seconds. Existing chunk-size/dynamic-import warnings remain. Logs are saved beside this report.
28. **Browser:** local production components verified with the real Mars data: six-frame preview, full hierarchy, chapter navigation, draft editing/saving, refresh persistence, creating/starting/directing progress states. Native browser screenshots were inspected in the task; no screenshot files are claimed. This was a local review harness, not an authenticated production frontend session. Actual persistence was independently verified through SQL.
29. **Mobile:** 390×844 viewport verified: collapsed controls, full-screen storyboard, usable inline editor, visible shot sketches and footer clearance above bottom navigation. Desktop verified at 1280×720 with the 350-pixel controls rail and independent scrolling.
30. **Build Visual World:** NO-GO now. This plan depends on the existing Script version. After the duration fix produces a new Script version, Look must refresh its stale plan and recheck narration coverage, pacing, continuity and asset estimates. New paid generation is still globally paused and requires that operational pause to be lifted before a later authorized generation. Do not start Visual World merely because this architecture/UI work is complete.

## Recovery and original workspace request — 43 requested points

1. Confirmed current root cause: `LONG_FORM_VISUAL_PLAN_PAUSED=true` made the worker return before claiming; no recovery cron existed. A diagnostic returned `paused:true`, with both worker secret and OpenAI configuration present.
2. Historical invocation of the original dispatch could not be established: connected tools did not expose Edge logs and the dashboard was signed out. The later authenticated recovery invocation was observed successfully.
3. Gateway verification was originally disabled, so missing gateway JWT was not the demonstrated root cause. Dispatch now includes gateway and worker authentication, checks HTTP outcomes, and records claim diagnostics.
4. Attempt zero meant no worker claim had happened; the paused early return explains the observed unclaimed state.
5. Null stage-start time likewise meant no claim. A durable workflow timestamp is now initialized at first claim.
6. Recovery uses atomic claims, six-minute leases, bounded attempts, fenced checkpoints and a provider reservation cap. Saved output can finalize without another provider call.
7. A minute cron targets unclaimed/expired Visual Plan jobs using existing Vault-backed recovery credentials. Worker RPC access is restricted to service role.
8. The original Mars v1 was recovered, not replaced by another paid request. The user-created retry v2 was marked superseded with explicit user approval and preserved.
9. Original v1 planning attempt changed from zero to one. Its later free finalization also used one attempt in that stage.
10. Canonical workflow start: `2026-09-09T16:09:49.874277+00:00`. The first lease ended at 16:15:49.874277. The elapsed clock starts at the first claim and includes subsequent recovery wall time; it is not provider CPU time.
11. Exactly one OpenAI call for the original authorized continuation: gpt-5-mini, 8,465 input tokens and 7,329 output tokens, including 192 reasoning tokens. No paid repair call.
12. Estimated original continuation cost: $0.0168 (unrounded $0.01677425). Shot refinement and manual edits cost zero provider calls.
13. v1 READY; user retry v2 preserved as superseded/failed; deterministic child v3 READY and selected as the current Visual Plan at verification.
14. Existing Look used the shared generation experience; its result workspace required restructuring.
15. Reused shared generation presentation, existing Script/Visual Plan data and entity registry. Shared generation components were not modified by this task.
16. Replaced Look-specific result layout and request lifecycle; added independent storyboard components and deterministic planning helpers.
17. Desktop split workspace has a 350-pixel controls rail and independently scrolling content.
18. Controls show persisted style/approach and real entity counts; mobile controls collapse.
19. Footer actions remain visible with mobile navigation clearance.
20. Result hero now uses the six-shot filmstrip described above.
21. Full storyboard is an optional large modal/full-screen mobile sheet.
22. Seven navigable chapter groups contain the 14 sequences.
23. Cards show sketch, shot timing, narration excerpt, framing, description and friendly production labels.
24. Reuse/setup labels are readable; raw internal enums and IDs are not displayed as product copy.
25. Planned Visual World shows entity counts and entries without generating images.
26. Edit Storyboard enables inline shot editors and a save-all draft workflow.
27. Editable fields are whitelisted; narration and factual metadata cannot be supplied as edit patches.
28. Saving creates a parent-linked version and updates the project pointer; source rows remain unchanged. Stale writes are rejected.
29. Exact narration IDs/ranges, timing, grounding and reveal constraints are preserved; warning limitations are stated in point 21 above.
30. Edit RPC and local preview edits make zero AI calls. The browser save was a local harness simulation; real server save behavior was tested separately in a rolled-back fixture.
31. Original 14 macro items are preserved as sequences; current v3 contains 137 shots.
32. Chapter count remains seven.
33. Original summary estimated four NEW_SETUP bases (five distinct keys overall); refined plan establishes seven physical bases.
34. Original coarse plan had six reuse items. Refined render counts are 31 reuse, 29 crop and 11 edit shots.
35. Original plan had two diagrams, zero maps and four programmatic graphic items; refined counts are 21 diagram shots, zero map shots and 59 programmatic render steps.
36. Registry remains six characters, four locations, two important objects, three vehicles/machines and one diagram subject.
37. Lifecycle SQL checks cover atomic claim, active-lease exclusion, expired recovery, stable first timestamp, maximum attempts, provider cap, duplicate start and worker privileges. Persistence SQL checks cover immutable versions, exact narration/grounding preservation, project pointer, zero-call metadata, stale writes, non-owner rejection and protected-field injection. Fixture changes rolled back; no test projects remained.
38. Client and SSR build results are recorded above.
39. Browser verification is local; authenticated production UI and historical Edge logs were not verified.
40. Mobile verification is recorded above.
41. Scoped files are listed below; unrelated workspace changes were preserved.
42. Git status remains dirty with this task's modified/new files and substantial pre-existing work. No push or merge occurred.
43. No local commit created. Existing HEAD: `a7212331c389f33d8e7702c77273fef33ae8a276`.

## Deployment and persisted identifiers

- **Frontend deployment: NOT performed.** Reason: no connected Vercel deployment route and no authorization to push main. Frontend changes remain local.
- Backend deployed: `advance-long-form-visual-plan` version 14 and `start-long-form-visual-plan` version 11, both ACTIVE with JWT verification. All four deployed worker files were compared with local content and matched.
- Applied migrations: `20260921120000_long_form_visual_plan_recovery_and_edits.sql` and `20260921121000_storyboard_edit_continuity.sql`.
- Security advisors inspected. The authenticated edit RPC is intentionally SECURITY DEFINER with ownership/staleness checks; unrelated existing advisor findings were not changed.
- Project: `49a18b78-1d4b-4570-8113-5cd130687e1e`.
- Script dependency: `687c6e63-b41c-4a68-8b63-f275275eacff`.
- Original v1: `eb25a8ee-9785-4b16-9e48-0a44c723d2a0`.
- Superseded user retry v2: `95d8a835-0abb-440c-a2f7-fc1fa655f01a`.
- Deterministic current v3: `79ed9eed-3242-486d-afb6-a1208d31b2df`, parent v1, model `deterministic:semantic-shots-v1`, zero model calls/cost.
- Mars Visual World count remained zero at final database verification.
- Global generation pause remains enabled. New starts now report `VISUAL_PLAN_PAUSED` rather than silently creating stranded jobs. Existing ready plans remain accessible.

## Scoped file inventory

Modified tracked files:

- `src/pages/workspace/long-form/look.jsx`
- `src/pages/workspace/long-form/visualPlan.js`
- `supabase/functions/start-long-form-visual-plan/index.ts`
- `supabase/functions/advance-long-form-visual-plan/index.ts`

New implementation:

- `src/pages/workspace/long-form/StoryboardWorkspace.jsx`
- `src/pages/workspace/long-form/StoryboardSketch.jsx`
- `src/pages/workspace/long-form/storyboardModel.js`
- `supabase/functions/_shared/visualPlanDeterministic.js`
- `supabase/functions/_shared/visualShotPlanning.js`
- Both migrations named above.

Tests and review artifacts:

- `tests/storyboard.test.mjs`, `tests/visualShotPlanning.test.mjs`
- `tests/visualPlan.lifecycle.sql`, `tests/storyboard.persistence.sql`
- `tests/fixtures/storyboardFixture.js`
- `dev/storyboard.html`, `dev/storyboard.jsx`
- `artifacts/storyboard/mars-result.json`: original saved plan and read-only Script snapshot.
- `artifacts/storyboard/mars-shot-plan.json`: deterministic refined plan.
- `artifacts/storyboard/test-results.log`, `vite-build.log`, `vite-ssr-build.log`, this report.

Local review URL: http://127.0.0.1:5178/dev/storyboard.html . The harness never invokes a provider or builds Visual World. Its draft persistence uses localStorage; server persistence is covered by the SQL test.
