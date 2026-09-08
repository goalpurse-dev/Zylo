# Visual World implementation and validation report

Date: 8 September 2026. Frontend deployment: **NOT performed**. Reason: no connected Vercel deployment route and no authorization to push main; the user explicitly requested local frontend verification.

The existing commit `1004f0a` had already generated four real images for this exact task. Those four persisted jobs were verified and reused. **No additional real image was generated during this continuation. Incremental Runware spend: $0. OpenAI calls in this continuation: 0.** The original four cost **$0.0024 total**.

The UI implementation and scoped backend lifecycle work are complete, with local desktop/mobile verification. The original paid smoke test did not link its jobs to ReferenceAsset rows. That limitation is explicitly retained in the evidence: production persistence was tested with transaction rollback and mocks rather than by creating a fifth image or a fake durable production project.

| Reference | Real job ID | Saved result | Provider cost | Observed job latency |
|---|---|---|---:|---:|
| Erik — 3/4 | `141c711f-d8b1-46b4-b1b7-aed320e1bfa8` | [Persisted PNG](https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/141c711f-d8b1-46b4-b1b7-aed320e1bfa8.png) | $0.0006 | 7.042 s |
| Erik — profile | `88ffadfc-e69d-46f7-8738-9bc2fa6d4484` | [Persisted PNG](https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/88ffadfc-e69d-46f7-8738-9bc2fa6d4484.png) | $0.0006 | 6.534 s |
| Longhouse — hearth-facing wide | `97a5ab84-4110-4fef-96c9-065fc5ee561d` | [Persisted PNG](https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/97a5ab84-4110-4fef-96c9-065fc5ee561d.png) | $0.0006 | 6.108 s |
| Longship — 3/4 | `ba9887cc-6216-41c1-ba7d-763bb374bd6c` | [Persisted PNG](https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/ba9887cc-6216-41c1-ba7d-763bb374bd6c.png) | $0.0006 | 5.843 s |

Latency is elapsed time from the original job creation to completion/update, captured before tagging the jobs as internal. It includes queue/worker/storage overhead; it is not a provider-only inference timer. Original timestamps and exact prompts are retained in [smoke-results.json](C:/Users/Public/Zylo/artifacts/visual-world/smoke-results.json). The jobs now also retain their original completion timestamp and latency in settings.

1. **Code discovered before changes.** Current HEAD was `1004f0a0f6d99c020bbcf3d01d732a143ebf3536`, following `b8dc21b`. Existing code already included the split-UI attempt, visual-world client, deterministic view planner, StyleSpec/compiler, start/advance/regenerate Edge Functions, and parent/child reference tables. Problems found included a full-width controls wrapper starving the results, failed assets counted as ready, inaccessible failure retry, destructive in-place regeneration, non-atomic job linking, polling consuming claim budgets, missing reference-stage recovery scheduling, and incomplete gallery isolation.

2. **Existing layout/components reused.** Reused `LongFormCreationHeader`, `LongFormSelect` and installed Headless UI dialog components. Inspected `TwoAm.jsx` / `TwoAmGenerator.jsx` for independent desktop scrolling and the shrink-0 footer; followed existing Long Form mobile navigation clearance. `GenerationExperience` and the Story/Research centered screens were preserved.

3. **Files changed.** Frontend: `visualWorld.jsx`, `visualWorld.js`, `visualWorldPlanning.js`, new `VisualWorldWorkspace.jsx`, and `src/components/creations/library.jsx`. Backend: `_shared/visualWorldStyle.ts`, new `_shared/visualWorldJobs.ts`, and the start/advance/regenerate Visual World functions. Migrations: `20260920120000_long_form_reference_lifecycle_safety.sql`, `20260920120500_long_form_recovery_gateway_auth.sql`, and the separately prepared claim-permission migration described below. Tests/review: `tests/visualWorld.test.mjs`, `tests/visualWorld.lifecycle.sql`, `tests/fixtures/visualWorldFixture.js`, `dev/visual-world.html`, `dev/visual-world.jsx`, and audit artifacts under `artifacts/visual-world/`. Pre-existing unrelated changes, including `project.js`, providers, jobs, shared Runware worker code, and Thirty Days work, were preserved.

4. **Exact renderer configuration.** Existing `src/lib/providers.ts`: ToolKey `image:flux.base`; provider `runware`; generator `Flux Base by RunDiffusion`; AIR tag `runware:400@4`; existing `RUNWARE_API_KEY`; `/functions/v1/runware-image`. Registry cost is $0.0006/image. Normal retail pricing remains 1 credit/$0.02; internal reference jobs are explicitly zero-credit. The smoke renders use 1024×1024 images.

5. **Premium models.** None added or called. No FLUX.2 9B KV, Kling, Seedream, Qwen Edit, or Recraft registration or benchmark was performed.

6. **Split workspace.** The production page handles persistence/polling; the reusable workspace renders controls and assets. Polling reads stored world/asset state, keeps prior results during connection errors, retries with backoff, and cancels correctly on unmount/route change. The fixture uses the same workspace without invoking backend generation.

7. **Left rail.** 350px desktop width, fixed as a flex sibling within the available viewport height. Controls scroll independently. The footer stays a shrink-0 sibling and does not drift when results scroll.

8. **Style selector.** Existing custom `LongFormSelect`, with one real option: Zyvo Illustrated Documentary. It corresponds to the existing machine-readable StyleSpec.

9. **Model selector.** One real option: FLUX Base, with “Fastest · Lowest cost”. No provider IDs or inactive premium choices in normal UI. Renderer selection remains version-backed.

10. **References-to-create UX.** Grouped Characters, Locations, Important Objects, Vehicles / Machines. Human-readable entity names and reference counts. Views come from the persisted ReferencePlan where available, otherwise deterministic EntityRegistry/continuity rules.

11. **Asset toggles.** Expand an entity to inspect automatic views. All planned views are selected initially; individual views can be unchecked before generation. Selection locks once the world exists. Desktop browser validation confirmed unchecking Face changed the total from seven to six and the character card from three views to two.

12. **CTA.** Build Visual World, Creating References…, Generate Remaining, and Continue states. “Generate Remaining” replaces failed slots individually rather than creating another whole world/planner call. Continue stays disabled with an explicit scene-creation-coming-next explanation; no scene pipeline was added.

13. **Planned state.** Polished entity placeholders populate the results before generation: role, entity name, and selected reference count. No empty results expanse or AI-generated board cover.

14. **Progressive state.** The split workspace stays present. Individual slots show Planned, Queued, Generating, Ready or Failed. Ready images remain usable during partial failures.

15. **Real progress.** Only current assets with `status=succeeded` AND a result URL count as ready. Superseded rows and failures do not inflate the count. Browser checks confirmed 3/4 after one failure and 3/4 while retrying that one slot.

16. **Reference board.** Off-white HTML/CSS sheet composed directly from persisted image URLs. Thin dividers, entity headings, view labels, no canvas or separately generated composite. The board updates before final world metadata is finalized.

17. **All References.** Grouped using entity categories, so vehicles no longer appear under objects. Cards show name, view, status and model display name; internal entity IDs are not rendered.

18. **Preview modal.** Large Headless UI dialog with contained full-image preview, entity/view/style/model, close button, focus handling and Escape dismissal. Saved history thumbnails are shown when multiple successful versions of a slot exist. No full image editor or new download subsystem.

19. **Single-asset regeneration.** Atomic SQL creates a new child row with `replaces_asset_id`, preserving old job/prompt/result/cost. A unique replacement index and row locks deduplicate repeated requests. Each replacement gets a new job identity. Pending work cannot be regenerated in place. Enqueue atomically commits job + asset link, fences expired claims, uses a stable ID, and limits provider jobs to three attempts. Cost rollup includes historical assets while the visible board counts current slots only.

20. **Mobile.** Verified at 390×844. Collapsible controls above results, no squeezed desktop columns. Fixed CTA sits above the established 78px navigation/safe-area clearance. Desktop was verified at the browser’s 1280×720 viewport, including independent scroll areas and visible footer. Temporary viewport overrides were reset.

21. **Fixture.** A hand-authored winter documentary registry includes Erik (HERO), Longhouse, Hearth, Longship, a winter-evening continuity group, hearth-facing/reverse camera anchors, fixed spatial relationships, canonical descriptions, factual constraints and forbidden elements. Seven planned views exercise all groups; four selected smoke slots correspond to the saved real jobs. No fake production project or world was persisted.

22. **Deterministic prompts.** Exact originally submitted prompts are in [smoke-results.json](C:/Users/Public/Zylo/artifacts/visual-world/smoke-results.json). The improved compiler’s exact four fixture outputs are in [compiled-prompts.json](C:/Users/Public/Zylo/artifacts/visual-world/compiled-prompts.json). Improvements specify full-body margins, strict profile, consistent identity, no logos/text, and a reusable empty location set instead of a studio background. These improved prompts were statically tested, **not rerendered**; the quality assessment below applies to the original four images.

23. **Four job IDs.** Listed in the table above and verified in the connected production jobs table. All succeeded.

24. **Four result URLs.** Linked above. These are persisted Supabase Storage results, not transient browser blobs.

25. **Per-image costs.** Actual `jobs.output.data[0].cost`: $0.0006 each. No estimate substituted for provider telemetry.

26. **Total cost.** $0.0024 for the original four. $0 additional Runware spending during this continuation.

27. **Latency.** 7.042s, 6.534s, 6.108s, 5.843s respectively. The four original jobs completed concurrently within approximately 7.1 seconds of the earliest submission. These are job-level elapsed times.

28. **Character consistency.** Partial success. Similar red hair, beard, build, facial archetype and silhouette. Exact identity is not established: face/beard contours, cloak construction/fastening and proportions vary. Suitable for cheap UX evidence, not a production continuity approval.

29. **Style consistency.** Good coarse consistency across all four: controlled dark linework, muted greys/browns, flat shading, subtle paper texture. Characters have more illustrated charm; the ship is more exaggerated. Not photorealistic.

30. **Location usability.** The camera faces the central hearth; benches and a clear floor/wall/roof arrangement make it a usable starting set. The architecture reads generically timber-framed and needs historical/art-direction review. Only one anchor was rendered, so cross-angle location consistency remains untested.

31. **Prompt adherence.** Characters are fully visible, with a recognizable side-profile reference. The nominal 3/4 character is near frontal. The ship is largely side-on with exaggerated curved hull/prow and an open sail despite “furled” in the submitted prompt. This is a meaningful failure for canonical references.

32. **Text artifacts.** No obvious random lettering, labels, watermark, logo or UI observed in any of the four images.

33. **Generic Creations.** The existing gallery reads `jobs`, not merely `creations`. Added a server-query filter for `settings.long_form_internal`; new reference jobs set this marker. The four prior smoke jobs were tagged internal without altering their cost/credit/result, with original latency retained. A database check confirms zero of those jobs match the new gallery query. The gallery filter is local until frontend deployment, per user instruction.

34. **Project covers.** No real project cover changed; no additional AI cover generated. Board rendering uses real references. Cover promotion is left for real production worlds.

35. **User credits.** All four real jobs have `charge_credits=0`. New internal reference payloads and atomic enqueue also use zero. No user credit charge was requested.

36. **OpenAI spend.** Zero OpenAI generation calls in this continuation. No Story, Research, Script, Visual Plan or Reference Planner invocation. The real Viking project was not advanced, and the Research ceiling was not changed.

37. **Tests.** Seven new Visual World tests pass. SQL integration checks passed inside BEGIN/ROLLBACK: claim increment/lease, atomic free job/link, lost-response idempotency, no paid claim consumed while observing a job, immutable replacement history, ownership denial, exhausted-claim reaping and new RPC access restrictions. No test project/job was committed or visible to workers. Full existing suite: 107 tests, 99 pass, 8 fail in existing unrelated Thirty Days/series checks. Scoped ESLint passes. Browser checks covered planned/ready/partial/generating states, view toggle, single retry, preview modal, desktop scroll and mobile placement.

38. **Vite build.** Client production build passes. SSR build passes. Existing warnings concern large chunks, dynamic/static import mixing, and stale browser compatibility data. Full SEO generation/postbuild was not run because this task changes no public SEO content.

39. **Deployment.** Supabase lifecycle and recovery-gateway migrations applied. Edge Functions deployed: advance-long-form-visual-world v4; start-long-form-visual-world v4; regenerate-long-form-reference-asset v2. JWT verification remains enabled on all three. The recovery cron is active; a real authenticated no-work probe returned HTTP 200 with `claimed:false`. **Frontend deployment: NOT performed. Reason: no connected Vercel deployment route and no authorization to push main; user explicitly required local-only frontend work.** A separate legacy claim-permission migration remains pending explicit approval, as described below.

40. **Git.** No push or merge. No new local commit created; the changes remain reviewable in the existing dirty workspace. Starting/current HEAD: `1004f0a0f6d99c020bbcf3d01d732a143ebf3536`. Unrelated staged/unstaged work was not discarded or bundled. Migration files were created with the CLI and ordered after the repository’s existing future-dated Visual World schema migrations.

41. **Same four references later with FLUX.2 9B KV.** GO for a separately authorized, four-image comparison after UI approval and verification of the actual new model mapping/pricing. This is a recommendation, not an implementation or generation authorization. Keep the same canonical identities/views and compare face, outfit, camera anchor and ship geometry. No premium model was added here.

42. **Real Viking project.** NO-GO for automatic advancement in this task. The user must approve the UI first, and the reference identity/adherence limitations must be addressed. A future paid end-to-end test should prove real ReferenceAsset→job→reconciliation completion with the browser closed; the old four jobs alone did not prove that link. No real Script, VisualPlan, scene, audio, timeline or video generation was started.

**Remaining access review.** Supabase advisors confirmed explicit anon/authenticated EXECUTE grants on four older claim RPCs, contrary to their worker-only intent. New enqueue/replace/scoped-claim RPCs correctly deny those roles. A scoped migration at [long_form_worker_claim_permissions.sql](C:/Users/Public/Zylo/supabase/migrations/20260920121000_long_form_worker_claim_permissions.sql) is prepared. Automatic approval review rejected applying this privilege change without explicit authorization; approval was requested and remains pending. Worker service_role access would remain intact. See [Supabase function-access guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable). Other pre-existing project advisor findings were outside this task and were not changed.

**Local review.** Open [Visual World fixture](http://127.0.0.1:5177/dev/visual-world.html). It uses the actual production workspace component and the four saved images. Clearly labeled fixture state buttons simulate lifecycle snapshots without issuing generation calls. The fixture entry is not part of the production bundle.

