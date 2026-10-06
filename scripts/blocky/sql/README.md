# Blocky Stories: where its SQL came from, and how it is checked

| File | What it is |
|---|---|
| `readFruitLiveSchema.sql` | Read-only query: every definition of AI Fruit Story's backend on the real database, as one JSON value |
| `fruit_live_schema.json` | Its answer on 2026-10-06 (definitions, row counts, the price rows; no user data, no secrets) |
| `platform_functions.json` | The real `deduct_credits` and `compute_tool_price` on the same day (the platform's; Blocky and Fruit both charge through them) |
| `generateBackend.cjs` | Wrote `supabase/pending/20261026100000_blocky_stories_backend.sql` from the snapshot, under Blocky's names. A one-time copy: the record of where that SQL came from, not something to run again |
| `dryRun.mjs` | Runs both pending files in a throwaway in-process Postgres: 45 checks, no real database, no keys (`npm i --no-save @electric-sql/pglite` once) |
| `fruitShapeCheck.sql` | Read-only, on the real database: what the Fruit undo changes, and whether anything is in flight. Before and after |
| `fruitCreateStoryDryRun.sql` | On the real database, always rolled back: an idea batch and a story creation, the way the live API calls them. Before and after |

The undo, when it has its go (one quiet minute, nothing in flight):

```
npx supabase db query --linked -f scripts/blocky/sql/fruitShapeCheck.sql            # jobs_in_flight 0, finals_building 0
node scripts/blocky/smokeFruitLive.mjs                                             # PASS
npx supabase db query --linked -f scripts/blocky/sql/fruitCreateStoryDryRun.sql     # DRY RUN OK (rolled back)
npx supabase db query --linked -f supabase/pending/20261026090000_story_niches_undo.sql
npx supabase db query --linked -f scripts/blocky/sql/fruitShapeCheck.sql            # no template columns, same row counts
node scripts/blocky/smokeFruitLive.mjs                                             # PASS
npx supabase db query --linked -f scripts/blocky/sql/fruitCreateStoryDryRun.sql     # DRY RUN OK (rolled back)
```

Then the file moves from `supabase/pending/` to `supabase/migrations/`.
