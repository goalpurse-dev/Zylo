# Character turnaround V2 — controlled Mars test

**Result: visual QA FAILED. One Runware generation, $0.00247. No retries and no current assets replaced.** The job, deterministic crops and provenance work, but this model did not obey the required orientations or cell layout. MULTIVIEW_MASTER remains opt-in, not the default. No OpenAI, Visual Plan, world restart or Scene Generation call was made.

## Requested 27-point report

1. **Why Profile copied the anchor:** the persisted derived requests passed the same full 3/4 image through `input.ref_images`; job-worker materializes it as `referenceImages`, and runware-image uploads/attaches it under `inputs.referenceImages`. The latest saved Profile visibly repeats the anchor's face angle, room, pose and badge lettering despite an explicit strict-profile prompt. Composition copying under reference conditioning is the evidence-backed diagnosis; the model's internal mechanism cannot be proven from these outputs. The anchor's identity is readable, but its room and fake badge lettering fail the new canonical-reference contract.
2. **Provider controls:** the current adapter passes reference images without a separate composition/identity weight. The model-specific Runware contract lists reference inputs, CFG, steps, seed and LoRA weights; no dedicated reference-strength or composition-lock control was found. CFG/LoRA weights are not interchangeable with identity-only conditioning. Width and height support 128–2048 in steps of 16, so 1536×1024 is valid. [Runware model contract](https://runware.ai/docs/models/bfl-flux-2-klein-9b-kv).
3. **Architecture:** dedicated compiler → atomic master asset/job reservation → existing job-worker/runware-image → one saved PNG → server-side PNG decode and deterministic RGBA cell copies → five separately stored ReferenceAssets → explicit review gate. The master uses text only, with a concrete appearance lock transcribed from the existing character; the old image is recorded as a comparison source, not conditioning input. Existing independent/reference-conditioned paths remain available.
4. **HERO roles:** IDENTITY_3Q (`three_quarter_neutral`), PROFILE (`profile`), BACK (`back`), FACE (`face_closeup`), OUTFIT_DETAIL (`outfit_detail`). ACTION_POSE (`action_pose`) is optional and was not requested in this test; its cell was instructed to remain empty.
5. **Recurring policy:** retain the existing cheaper identity/face approach. Incidental characters receive no references under the existing planner policy. Five/six views are not a universal quota. The strategy resolver supports MULTIVIEW_MASTER, INDEPENDENT and REFERENCE_CONDITIONED; rollout requires explicit approval and this failed test does not enable it.
6. **Master resolution:** requested and received 1536×1024 PNG.
7. **Master prompt:** exact persisted prompt is in `master-prompt.txt`, and in `after.json` on the master asset. It specifies equal 3×2 cells, different orientations, a consistent appearance lock, neutral background and no readable/fake text, labels, logos, arrows or UI. It does not send the old 3/4 image. The prompt's appearance lock takes precedence over the older, ambiguous canonical costume notes.
8. **Crop geometry:** five 512×512 rectangles: 3/4 `(0,0,512,512)`; Profile `(512,0,512,512)`; Back `(1024,0,512,512)`; Face `(0,512,512,512)`; Outfit `(512,512,512,512)`. Optional Pose is `(1024,512,512,512)`. Cropping uses `pngjs@7.0.0` and exact RGBA copies, without resampling or another AI call. The model failed to respect these cells, so mechanically correct crops are visually invalid.
9. **Provenance:** `generation_type`, `source_master_asset_id`, `source_crop_key`, `source_crop_rect`; master QA metadata records strategy, comparison anchor, appearance lock, expected previous role assets and review. Each crop has its own asset ID, public storage URL and QA expectations. Approval validates expected role/geometry, checks that current roles have not changed, and only then establishes replacement links. Rejected/pending crops and the master are excluded from canonical board counts and normal reference selection.
10. **Cost accounting:** the master alone owns the provider job and $0.00247 cost. All five crops have `cost_usd=0`, no job, and generation type `deterministic_crop`. Provider spend, including rejected experiments, is included once in the world's cost total. Jobs remain zero user credits. The reservation is unique per character/world experiment, including failed attempts, and the job has `max_attempts=1`.
11. **Mars master job/asset:** `af9eabbd-ac85-4f64-9f8e-341f55b59db5`. World: `973ec40c-82d2-42d8-9090-c6cf469dd3f4`; entity: `e_protagonist`; project: `49a18b78-1d4b-4570-8113-5cd130687e1e`.
12. **Runware result:** API success, visual QA rejected. Model `runware:400@6`; image UUID `89a2f3f3-3b55-42d9-a8bd-cc4de15678f9`; seed `47339965`. The image has three almost identical frontal figures, each spanning both rows, with drawn panel borders. [Saved master](https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/af9eabbd-ac85-4f64-9f8e-341f55b59db5.png).
13. **Runware cost:** $0.00247, exactly one new generation. No additional OpenAI or image-review calls.
14. **Latency:** worker claim `18:51:58.225887 UTC` → completion `18:52:06.037114 UTC`: **7.811 seconds**. Job creation → completion: **122.102 seconds**, including queue/dispatch wait. Pure provider inference latency is not separately persisted and is not claimed. The asset's existing latency field measures creation-to-completion.
15. **Identity across panels:** internally similar/repeated character, but the hair shape, beard density, face and outfit treatment drift from the original anchor. Existing-identity match did not pass.
16. **Profile:** FAIL — frontal face with both eyes visible.
17. **Back:** FAIL — frontal face visible; no rear view.
18. **Face:** FAIL — the expected bottom-left face crop contains lower body/legs, not head and shoulders.
19. **Background:** PASS — plain neutral/white, no Mars room. Layout itself fails: figures cross row boundaries and the optional cell is occupied despite being unrequested.
20. **Generated text:** PASS on inspected output — blank patches, no visible generated letters/numbers or captions. Fake text remains a hard QA failure, never a minor issue. This was manual visual review; no OCR/computer-vision service is claimed.
21. **Crops made current:** NONE. All five are stored with `reviewStatus=rejected` and null `replaces_asset_id`. They cannot displace current references.
22. **Previous generations:** all 31 pre-existing asset rows were compared field-for-field and remained unchanged, including all location/object assets and four historical Profile generations. The current board still has 27 canonical roles. Old Profile history is preserved.
23. **Hover/pointer:** ready tiles are real buttons with `cursor:pointer`, subtle elevation, brighter border, 1.02 image scale, a small expand icon, and a 0.2-second transition. History thumbnails also receive pointer/focus/hover treatment. Browser checks confirmed actual hovered computed style for protagonist 3/4, Profile, Face and a habitat reference, plus correct modal contents.
24. **Keyboard:** tab order includes ready tiles; visible lime focus ring verified. Enter opened Profile; Tab moved to Face and Space opened Face. Native button behavior is retained. Opening/closing a preview has no provider side effect.
25. **Mobile:** tested at 390×844. Controls collapse; references remain tappable with a small corner affordance; Profile opens the large modal with usable Regenerate/Edit controls and scrollable history. Temporary viewport was reset. Browser tests used the local production component with saved real data and no-op generation callbacks.
26. **Tests:** all **12 relevant Node tests pass**, scoped ESLint passes. The existing tests had two stale expectations (seven instead of nine fixture views and case-sensitive older profile copy); these were updated to the established five-HERO-role and strict single-eye contracts. Added tests cover strategy rollout, optional pose, crop pixels/bounds, no-text/layout prompt, and review exclusion. SQL tests verified duplicate-start idempotency, no reference-image input, 1536×1024 payload, one-attempt cap, zero credits, service-only RPCs and unready rejection. A separate rolled-back positive-review test verified atomic role replacement and correct role ordering; real rejected assets were not promoted. Real execution verified PNG decode/crop/upload and five zero-cost child rows. Security advisors were inspected; the new RPCs are not executable by anon/authenticated. Existing unrelated advisor findings were left untouched.
27. **Vite build:** PASS, final build 14.32 seconds. Existing bundle warnings remain. See `vite-build.log`; test results are in `tests.log`.

## Exact existing request trace

All listed rows are in `before.json`; their complete prompt snapshots and reference relationships are preserved there. `prior-jobs.json` contains the corresponding persisted input/settings/output records. All used `image:flux2.klein9bkv`.

| Asset/job ID | View | Conditioning asset |
|---|---|---|
| `5ee488d5-3155-4985-8f53-591d19507bdc` | Original 3/4 | None |
| `a5fd4c3c-b1d7-4fea-80a6-898132bd54ae` | Current 3/4 | None |
| `e3d9b305-afea-48b2-a5df-eca285dbfb74` | Original Profile | None |
| `f1583458-4c6b-4227-b7f6-a6566bb8e876` | Profile retry | `a5fd4c3c-b1d7-4fea-80a6-898132bd54ae` |
| `38f7ab6b-53c9-4a61-afaa-0b690f985c67` | Profile retry | Same current 3/4 |
| `6a3f1f89-eb88-4313-92fb-c1acfdf717de` | Current Profile | Same current 3/4 |
| `a4720539-92a1-4f5d-8e41-d46841034b45` | Current Face | None |

Path: ReferenceAsset → claim RPC → role compiler and immutable prompt snapshot → atomic job enqueue → job-worker's reference materialization → runware-image → `runware:400@6`.

The old payload has `taskType:imageInference`, stable task UUID, `model:runware:400@6`, saved positive prompt, 1024×1024, one result, cost included, async delivery, PNG/URL output, and `inputs.referenceImages` containing the uploaded anchor reference. The new master uses the same shape at 1536×1024 **without `inputs.referenceImages`**. `audit.json` records the shape reconstructed from persisted job input and the adapter; a captured raw wire request or uploaded reference UUID is not claimed.

## Stored rejected crop assets

| Role | Asset ID |
|---|---|
| 3/4 | `6437d0ea-9de8-4ba8-abd6-2334e1f24631` |
| Profile | `6b8c9166-3f3a-4a4e-b76e-343b471b9008` |
| Back | `2c6b03a7-cd56-44c5-8896-5fc5d39c8e0a` |
| Face | `e155d391-9e30-427e-a43b-929aaff04580` |
| Outfit | `d8f1847d-32db-4be1-90e1-7f6474bf0dcc` |

## Deployment, limits and files

**Frontend deployment: NOT performed.** Reason: no connected Vercel deployment route and no authorization to push main. Local build passed. No commit or push created; HEAD remains `a7212331c389f33d8e7702c77273fef33ae8a276`. Workspace is dirty with this task and pre-existing changes.

Deployed backend: `character-turnaround` v2 and `advance-long-form-visual-world` v12, JWT verification enabled. Applied migrations: `20260926120000_character_turnaround_master.sql`, `20260926121000_character_turnaround_review_geometry.sql`. The worker diff against deployed v11 was reviewed to ensure only this task's changes were added.

The controlled service endpoint supports start and free reconciliation/cropping. **Persistent automatic recovery was NOT deployed:** automatic approval review rejected a proposed minute cron because recurring authenticated production calls exceeded the single-test authorization. Its SQL was moved out of the migrations directory to `NOT-DEPLOYED-recovery-proposal.sql`. The current test has no pending recovery work. Future unattended rollout still needs an authorized recovery route and successful visual validation; this task does not enable it.

Changed implementation: `src/pages/workspace/long-form/VisualWorldWorkspace.jsx`, `visualWorldPlanning.js`, `supabase/functions/_shared/visualWorldStyle.ts`, `advance-long-form-visual-world/index.ts`. New implementation: `_shared/characterTurnaround.js`, `character-turnaround/index.ts`, the two applied migrations. Tests: `tests/characterTurnaround.test.mjs`, `characterTurnaround.lifecycle.sql`, `browserAssets.loader.mjs`, updated `visualWorld.test.mjs`. Review harness: `dev/turnaround.html`, `dev/turnaround.jsx`. Artifacts: this directory and refreshed `artifacts/visual-world/compiled-prompts.json` from the regression test.

Local review: http://127.0.0.1:5178/dev/turnaround.html . It displays the saved current board and excludes the rejected experiment. No further generation should run under this task's authorization.
