# V1 reliability handoff

Status: **NO-GO for a new Mars test VisualPlan under the requested acceptance criteria.** Local implementation and focused verification are complete; current saved Mars inputs cannot pass preflight. No deployment, inference, generation, credit charge, adoption, or active-pointer change was performed.

## Recovered work

- DONE before this handoff: initial contract reuse/compilation wiring, some EDIT/diversity rules, expanded style helper, tier/progress provider-label removal, regression tests.
- PARTIAL before this handoff: ready-plan gate checked only missing graphic IDs; SQL checked graphic IDs rather than compiling; cast reuse was prompt guidance; graphic cap had unbounded exceptions; asset rows/viewer exposed saved models; scene references requested sheets.
- Completed locally: pinned-contract validation for every beat; reject incomplete contract compilation; canonical role alias resolution and episode cast ledger; 3/5/8 sequencing with meaningful camera changes and bounded graphics/EDITs; shared deterministic compiler at charge and persistence boundaries; locked billing snapshot check; isolated-reference requirement; full compact style lock and prompt-length rejection; exact-text space/character/width checks; remaining model-label and diagnostic-message protection.

## Read-only Mars replay

Source VisualPlan v5: `56a0e0b5-3f91-4efc-af2f-c86f2a9238df`.
Existing contract v4: `94f119e7-9b4f-433d-8d28-529c57666365`, 61 stored claims. It was reused, **not freshly compiled** during this task.

Replaying the existing macro proposals with current semantics creates 128 candidate beats in memory. This is not a new LLM-authored plan or an adopted database version.

| Check | Result |
|---|---|
| GENERATE | 97 |
| EDIT | 7 |
| REUSE/HOLD | 7 |
| CROP | 0 |
| GRAPHIC | 17 |
| Claim linkage | 95/128 beats; 33 uncovered |
| Longest EDIT chain | 2; no 3+ chain |
| Longest repeated-composition chain | 2 |
| Longest graphic chain | 1 |
| Exact-text reservations | 38 beats |
| Compilable with current saved data | 34/128 |
| Generate preflight | FAIL, before charging |

Remaining failures: 33 uncovered beats; 54 compilation failures requiring isolated character references; six prompts exceeding the enforced renderer budget; one graphic claim lacking a safe structured treatment. Gate and per-beat errors may repeat the same failure in the JSON report; these counts identify distinct affected beats per cause. Full style fields are required in every fresh-generation compiler call, but this does not imply current blocked scenes have rendered or passed visual QA.

Canonical alias checks pass: farmer/greenhouse → `e_agri_specialist`; battery/solar/power → `e_power_officer`; suit/mechanical/repairs → `e_technician`.

- Agricultural specialist: shots 17, 33, 37, 38, 70, 71, 89, 90, 126; chapters c1, c3, c5, c7.
- Power officer: shots 43, 44, 64, 65, 88, 117, 123, 124; chapters c3, c5, c7.
- Maintenance technician: shots 4, 5, 6, 19, 30, 31, 32, 75, 76, 77, 109, 110, 111; chapters c1, c2, c4, c6.
- Protagonist: recurs across c1, c2, c3, c4, c6, c7.

Shot numbers refer to the 128-beat local replay, not the 136-shot production v5. Exact missing-claim shots, graphic positions, text strings and per-beat errors are in `v1-reliability-dry-run.json` alongside this file.

## Verification

- 55 focused tests pass: episodePreflightV1, narrationContractMandatoryV1, visualShotPlanningV1Reliability, v1ReliabilityStyleAndProviderNames, visualDirectorRenderStrategy.
- Additional older visualShotPlanning suite: seven pass, two fail on historical timing expectations (895 seconds/macro-authored times versus the existing narration-word timing). Left unchanged per scope.
- Local PGlite/PostgreSQL: migration applies twice; unchecked legacy endpoint rejects; missing/stale/incomplete preflight does not debit; a valid synthetic local fixture charges once; replay is idempotent; authenticated role cannot bypass Edge preflight. No production balance was used.
- Edge entry modules import under the test harness without invoking handlers. Full Deno type checking was not available.
- One production `vite build`: PASS, 16.06 seconds; existing large-chunk warning.
- Long Form model labels removed from tier descriptions, progress, reference panel, asset rows, viewer and known QA/error display paths. Production frontend deployment parity is not asserted.

## Files edited in this continuation

Backend:
- `supabase/functions/advance-long-form-visual-plan/index.ts`
- `supabase/functions/charge-long-form-episode-generation/index.ts`
- `supabase/functions/start-long-form-scene-generation/index.ts`
- `supabase/functions/_shared/visualDirectorReliability.js` (new)
- `supabase/functions/_shared/episodePreflight.ts` (new)
- `supabase/functions/_shared/narrationVisualContract.ts`
- `supabase/functions/_shared/visualShotPlanning.js`
- `supabase/functions/_shared/sceneRenderPlan.ts`
- `supabase/functions/_shared/visualWorldStyle.ts`
- `supabase/functions/_shared/sceneCompositor.ts`
- `supabase/functions/_shared/graphicTemplates.ts`
- `supabase/migrations/20260930390000_long_form_generate_preflight.sql` (existing pending migration completed, not applied remotely)

UI:
- `src/pages/workspace/long-form/VisualWorldWorkspace.jsx`
- `src/pages/workspace/long-form/GenerateWorkspace.jsx`
- `src/pages/workspace/long-form/visualWorldPlanning.js`
- `src/pages/workspace/long-form/sceneCardModel.js`
- `src/pages/workspace/long-form/customerVisualMessage.js` (new)

Verification:
- `tests/episodePreflightV1.test.mjs` (new)
- `tests/visualDirectorRenderStrategy.test.mjs` (updated obsolete EDIT expectation)
- `scripts/marsV1ReliabilityDryRun.mjs` (new; file-only, network blocked)
- `scripts/checkLongFormPreflightSql.mjs` (new; ephemeral local PostgreSQL)
- Local evidence/logs under `artifacts/mars-forensic/`; SQL test runtime installed under its `sql-check` directory, not an application dependency.

## Deployment handoff — NOT performed

After resolving the listed acceptance blockers, deploy together:
1. Migration `supabase/migrations/20260930390000_long_form_generate_preflight.sql`.
2. Edge Functions `advance-long-form-visual-plan`, `charge-long-form-episode-generation`, `start-long-form-scene-generation`, `advance-long-form-scene-generation`, including their shared dependencies.

The migration intentionally disables the unchecked three-argument billing entry point; it must be coordinated with the updated charge endpoint. Do not regenerate or adopt Mars automatically.

Frontend deployment: **NOT performed**. Reason: no connected Vercel deployment route and no authorization to push main. Build: PASS. No commit or push created; HEAD remains `33345a3`, with existing unrelated and Long Form changes still local.

Provider calls = **0**. Production credits charged = **0**. Production DB mutations = **0**.
