# AI Fruit Story v2: soft-launch plan (not done yet)

Status on 2026-09-30:
- The **backend is already live** on the production Supabase project: migrations, `fruit-story-api` and
  `fruit-worker`, the cron reconciler, prices, and the Fly image `zyvo-render:fruit-final`.
  v1 uses different functions and tool keys, so it is unaffected.
- The **v2 UI exists only on your machine.** Branch `laptop-transfer` is 35 commits ahead of
  `origin/laptop-transfer` and already contains `origin/main`, so main can fast-forward.
- Only your account has `fruit_v2`, and `FRUIT_PAID_CALLS` is `on` for your hands-on test.

## 1. Before pushing (local)

1. Tests: `node --test tests/fruit*.test.mjs` (108) and `cd render-worker && node --test test/*.test.mjs` (30).
2. `npx vite build` passes.
3. Check the pushed code contains no secrets or debug flags:
   - `git diff origin/laptop-transfer --stat`
   - `git grep -n "FRUIT_ALLOW_PAID\|service_role" -- src`: nothing in `src`.
4. The pricing page and the paywall now show v2 numbers for everyone (6 / 13 / 27 videos of 20 s). Ship them together with the rollout.

## 2. Push: laptop-transfer, then main

1. `git push origin laptop-transfer`. This deploys a Vercel preview only.
2. Open the preview URL signed in as a tester who has the flag (see step 3). Run one 15 s V2 story end to end: pictures, animate, final, download.
   - Cost: about 3 × 4 + 15 × 5 = 87 credits, about $0.87 real.
3. On the preview, also check:
   - the Pricing page shows 6 / 13 / 27;
   - a signed-out visitor still gets v1 at `/workspace/ai-fruit-story`;
   - an unflagged signed-in user still gets v1.
4. Merge to main, which deploys production:
   `git checkout main && git merge --ff-only laptop-transfer && git push origin main`, then `git checkout laptop-transfer`.
   Pushing to main needs your explicit go in that message.

## 3. Vercel env vars (Production and Preview)

| Var | Value | Why |
|---|---|---|
| `VITE_FRUIT_V2` | leave unset | Emergency override only: `false` turns v2 off for everyone in that build (needs a redeploy). Unset = follow the database switch below. |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | unchanged | Already set. |

Nothing else is needed on Vercel. Every Fruit secret is a Supabase edge secret.

## 4. Turn it on for a few testers

Per tester, run in the Supabase SQL editor:

```sql
INSERT INTO public.user_feature_flags (user_id, flags)
SELECT id, '{"fruit_v2": true}'::jsonb FROM auth.users WHERE email = 'tester@example.com'
ON CONFLICT (user_id) DO UPDATE SET flags = user_feature_flags.flags || '{"fruit_v2": true}', updated_at = now();
```

- Start with 3–5 paying testers. Only paid plans can generate; free and guest accounts see the example video and the paywall.
- Their browser caches flags. A tester who doesn't see v2 should reload once.

## 5. Paid calls in production

`FRUIT_PAID_CALLS` is the one server switch for every Fruit paid call (Runware, planner, word timestamps):

```sh
printf 'FRUIT_PAID_CALLS=on\n'  > /tmp/f.env && npx supabase secrets set --env-file /tmp/f.env && rm /tmp/f.env   # on
printf 'FRUIT_PAID_CALLS=off\n' > /tmp/f.env && npx supabase secrets set --env-file /tmp/f.env && rm /tmp/f.env   # off
```

It is `on` right now for your test. Leave it on for the soft launch.

## 6. Monitoring (daily in week 1)

**Real cost vs credits charged, per day:**

```sql
SELECT date_trunc('day', created_at) d, provider, purpose, count(*), round(sum(cost_usd), 4) usd
FROM public.fruit_ai_calls WHERE created_at > now() - interval '7 days' GROUP BY 1, 2, 3 ORDER BY 1 DESC, usd DESC;

SELECT date_trunc('day', created_at) d,
       sum(credits) FILTER (WHERE operation = 'charge') charged,
       sum(credits) FILTER (WHERE operation = 'refund') refunded
FROM public.fruit_credit_ledger WHERE created_at > now() - interval '7 days' GROUP BY 1 ORDER BY 1 DESC;
```

Clip and picture costs are in `fruit_jobs.cost_usd`. Target margin is about 50% at $0.02133 per credit (V2 is lower: 48%).

**Failures and refunds:**

```sql
SELECT kind, error_code, count(*) FROM public.fruit_jobs
WHERE created_at > now() - interval '1 day' AND status = 'failed' GROUP BY 1, 2 ORDER BY 3 DESC;

SELECT status, count(*) FROM public.fruit_stories
WHERE updated_at > now() - interval '1 day' GROUP BY 1;   -- stuck 'pictures' / 'animating' / 'building' > 15 min = look

SELECT purpose, ok, count(*) FROM public.fruit_ai_calls
WHERE created_at > now() - interval '1 day' AND purpose IN ('planner', 'planner_repair', 'final', 'caption_words') GROUP BY 1, 2;
```

**Out-of-credit alert:**
- An email goes to `CONTACT_TO_EMAIL` when an alert opens.
- It's also recorded in `SELECT * FROM public.fruit_provider_alerts;`. `last_seen_at` in the last 10 minutes means new paid steps are being refused.
- Fix: top up the provider. Nothing else is needed; refused items were already refunded.

**Provider balances:**
- Runware dashboard. Keep at least $50 in week 1: a 30 s V2 story is about $1.80, a V4 one about $4.70.
- Anthropic and OpenAI consoles (the planner costs about $0.01–0.03 per story).
- Fly (final videos cost about $0.001 each).

**Logs:** the Supabase function logs for `fruit-story-api` / `fruit-worker`, and `fly logs -a zyvo-render` for final videos.

## 7. Turn it off fast (fastest first)

| Speed | Action | Effect |
|---|---|---|
| ~10 s | `FRUIT_PAID_CALLS=off` (§5) | No new paid work: queued jobs are refunded, jobs already at the provider finish, and the UI says generation is switched off. Stories and finals stay viewable. |
| ~10 s | `UPDATE public.global_feature_flags SET enabled = false, updated_at = now() WHERE key = 'fruit_v2';` | Everyone falls back to v1 on their next page load (users with a per-user `fruit_v2` flag keep v2). Their v2 stories stay in the database. Back on: the same line with `enabled = true`. |
| ~2 min | Vercel env `VITE_FRUIT_V2=false`, then redeploy | v2 code is off for everyone, whatever the switch and flags say. |
| ~2 min | Vercel "Promote" the previous production deployment | Undoes the push entirely (UI and Pricing page). The backend stays; it only serves flagged v2. |
| Last resort | `select cron.unschedule('fruit-story-reconcile');` | Stops the reconciler. Only do this with paid calls off, because refunds for stuck jobs stop too. |

## 8. After a week of clean numbers

1. Rolled out to everyone on 2026-10-01 with `public.global_feature_flags.fruit_v2 = true` (switch above).
2. Remove v1 (`AIFruitStoryV1`) and retire the v1 tool keys once no v1 jobs remain.
3. Update `/blog/ai-fruit-story-pricing` (it still describes v1 costs).
4. Set `TUTORIAL_URL` when the tutorial is ready.
