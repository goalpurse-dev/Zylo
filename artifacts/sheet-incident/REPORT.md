# Face / Profile sheet incident — 2026-09-11

Status: diagnosis and local fixes complete; production rollout BLOCKED by automatic approval review. No new provider calls. This is not a claim that the live three-sheet flow is fixed.

## Current protagonist (audited live)
World: 973ec40c-82d2-42d8-9090-c6cf469dd3f4

| Role | Asset / job / provider task ID | Generation | QA | Stale | Reference IDs |
|---|---|---|---|---|---|
| Identity / Outfit | cb5a59e6-0b40-487a-96a6-4a136340e930 | succeeded | approved | false | [] |
| Face | 286f7cde-4092-4622-8f0b-e8636d89a1bc | succeeded | rejected | false | [cb5a59e6-0b40-487a-96a6-4a136340e930] |
| Profile / Silhouette | 323e15d7-44f7-4a92-8997-784782132fa8 | succeeded | approved | false | [cb5a59e6-0b40-487a-96a6-4a136340e930] |

Full asset/job rows, immutable prompts, reference URLs, errors, timestamps, provider task responses and seeds: [audit.json](audit.json). These are read-only snapshots; no rows were changed.

Current prompt SHA-256:
- Identity: a1dc8cb6737c06f952a57d371b2d6801e0ed70165f4f06aa77a5fd292c12ea57
- Face: 85efde77a08670f6f74d7f1fd9e874823b47cd6df0d3ac2a8d79c137d2832f1c
- Profile: 7711031c6ccbdf44cdbb8b3d38b18759cfc1d2e7fca5fb42a9f11e15bb27360f

Current Identity created 19:58:30.405738Z, updated 19:59:06.262941Z, replaces f386b9ea-5f0f-4a85-b24a-9a6cbf754384. Seed 1001391597, 1536x1024, runware:400@4, cost $0.0013.
Current Face created 20:00:09.383378Z, updated 20:01:05.616105Z, replaces 04cf3c25-a973-4e4e-a40d-7c37d7b0a799. Seed 1659504334, 1024x1024, runware:108@22, cost $0.007.
Current Profile created 19:59:06.262941Z, updated 20:00:13.945214Z, replaces b078fae0-bffd-44dc-be84-55b5c19dd413. Seed 264433692, 1024x1024, runware:108@22, cost $0.0077.
All dates above are 2026-09-11 UTC.

## Answers to requested report
1. Current canonical Identity ID: cb5a59e6-0b40-487a-96a6-4a136340e930.
2. Current Face ID: 286f7cde-4092-4622-8f0b-e8636d89a1bc.
3. Current Profile ID: 323e15d7-44f7-4a92-8997-784782132fa8.
4–5. Both derived rows store exactly [cb5a59e6-0b40-487a-96a6-4a136340e930].
6–7. Both jobs contain exactly that anchor's public image URL in input.ref_images. Deployed runware-image forwards reference images through upload and task.inputs.referenceImages and fails if upload loses a reference. Historical raw HTTP request bodies were not available; the stored input and deployed forwarding path agree.
8. No evidence of Face selecting a Profile row: the tile selector uses entity_id + exact angle_or_view. Historical live DOM wasn't captured, so an absolute claim about what the user saw is not possible. An actual selector weakness was found: multiple unsuperseded rows for the same role are resolved by first array order. Fixed locally.
9. No crossed completion found in audited jobs: asset.job_id, job.id, settings.long_form_reference_asset_id, provider_job_id, output.taskUUID and saved URL all match each individual role's asset. Additional assertions now reject mismatched identity/role/prompt/task before writing output.
10–12. Replacement generations have genuinely new asset, job and provider task IDs. SQL replace RPC inserts a fresh row omitting job_id/result_url/provider fields; existing pipeline uses job.id as taskUUID. A repeated request on an already-replaced OLD row returns its existing child (deduplication), not a second replacement.
13. No old result URL or provider image UUID reuse in the audited sequence. The automatic Face fallback did reuse the same truncated prompt; that is prompt reuse, not output reuse.
14. Face QA rejected 04cf3c25 at 20:00:09.284Z and automatically inserted fallback 286f7cde at 20:00:09.383Z. Profile QA approved at 20:00:13.945Z; the Face fallback job started at 20:00:15.052Z. This timing explains the perceived restart following Profile completion. Earlier accepted-identity changes also queued new derived rows.
15. Visual inspection confirms Profile drift: darker/heavier beard, clothing/background color drift and different proportions. The anchor itself is inconsistent: a beard in the front view, nearly clean-shaven side view. Qwen received the intended anchor but returned a different interpretation. QA falsely approved exact-identity consistency.
16. Bugs: conflicting Face instructions (portrait framing plus standing figures/shoes); square derived canvas; repeated truncation at 1900 characters; QA image roles not explicitly labeled per image; weak low-detail identity judgment; automatic sheet retry; null QA turning Ready after 15 seconds; QA recovery skipped succeeded rows after an interrupted checkpoint; nondeterministic same-role row selection; no explicit role/task assertions at completion.
17. Fixes: concise role-specific derived compiler with immutable role marker, source-image-only identity, landscape 1536x1024; one exact approved identity sheet; persisted job role/entity/contract metadata; SQL role/reference/QA-provenance guards; completion assertions; explicitly labeled high-detail QA inputs with stricter identity criteria; no automatic sheet fallback; QA recovery over succeeded unchecked rows; deterministic role-scoped selection; actual provider status fetched for active assets; no timed QA-to-Ready promotion.
18. Changed files listed below.
19. Migration: supabase/migrations/20260911200936_sheet_role_isolation.sql. NOT applied.
20. No functions redeployed because the migration was rejected. Affected shared-module consumers: advance-long-form-visual-world, character-turnaround, reference-profile-test. Only advance-long-form-visual-world serves the normal three-sheet workflow; the other two carry shared dependencies and must be kept aligned.
21. Live versions inspected (not newly deployed):
   - advance-long-form-visual-world: v29, 2026-09-11T19:53:24.803Z, verify_jwt=true
   - runware-image: v218, 2026-09-08T16:50:46.020Z, verify_jwt=false
   - job-worker: v419, 2026-09-10T20:40:52.726Z, verify_jwt=false
   - regenerate-long-form-reference-asset: v10, 2026-09-11T09:07:01.710Z, verify_jwt=true
   - character-turnaround: v10, 2026-09-11T15:09:24.856Z, verify_jwt=true
   - reference-profile-test: v10, 2026-09-11T19:53:24.803Z, verify_jwt=true
22. 33 relevant Node regression tests passed. Coverage includes role-specific prompts, exact one-anchor payloads, fresh job IDs, task/role mismatch rejection, role selectors, independent completion and truthful lifecycle labels. Database lifecycle execution of the new migration remains blocked; existing live replacement definition was audited read-only.
23. Scoped ESLint passed.
24. Vite client build passed; see final response for latest run. Normal bundle-size and browser-data-age warnings only.
25. Provider calls during this incident task: 0 image generation, 0 paid QA.
26. New provider cost: $0. Existing three current jobs cost $0.016 combined, already recorded before this task.

## Changed source files in this task
- supabase/functions/_shared/characterSheetContract.js (new)
- supabase/functions/_shared/referenceRendererPolicy.js
- supabase/functions/_shared/visualWorldStyle.ts
- supabase/functions/_shared/visualWorldJobs.ts
- supabase/functions/_shared/referenceQA.ts
- supabase/functions/advance-long-form-visual-world/index.ts
- src/pages/workspace/long-form/visualWorldPlanning.js
- src/pages/workspace/long-form/visualWorld.js
- src/pages/workspace/long-form/VisualWorldWorkspace.jsx
- tests/sheetRoleIsolation.test.mjs (new)
- tests/characterSheetPack.test.mjs
- tests/referenceRendererPolicy.test.mjs
- tests/visualWorld.test.mjs
- tests/fixtures/visualWorldFixture.js
- artifacts/visual-world/compiled-prompts.json (test output)

Pre-existing staged/unstaged work remains preserved. No commit, push or merge performed. HEAD at inspection: 33345a3a2367208f10998552efaae81d000c0337.

Frontend deployment: NOT performed.
Reason: no connected Vercel deployment route and no authorization to push main.

## Salvage and remaining work
Current jobs already completed and are attached to their proper rows. Reconciliation cannot transform wrong pixels into correct sheets. Preserve all history. The current Face must remain rejected; Profile's visual identity consistency and the anchor's beard inconsistency require review. No fresh generation was triggered against an inconsistent anchor.

The production migration replaces existing enqueue/QA functions while preserving their model/attempt rules and adding provenance guards. Automatic approval review rejected it twice, most recently explicitly requiring renewed approval for these exact production function replacements. No alternate SQL path was used. Deployment, database lifecycle validation, live salvage and the optional single generation remain unfinished.
