# Zyvo Content Machine — Build Spec for Claude Code

> **How to use this file:** put it in the root of the Zyvo repo and tell Claude Code:
> *"Read CONTENT_MACHINE_SPEC.md and build it phase by phase. Start with Phase 0."*

---

## 0. Mission

Build an internal, admin-only **content machine** inside Zyvo (tryzyvo.com) that, every day, automatically:

1. **Scouts** social platforms for what is currently going viral in our space (AI video, faceless YouTube, AI fruit / clay / stickman / micro-camera style content, AI tool listicles).
2. **Ideates** ~15 unique short-form video concepts that promote Zyvo *indirectly*: entertaining content that "sneaks" Zyvo in, not straight ads. Every concept is optimized for virality (hook in the first 1–2 seconds, loopable, comment-bait, trend-aligned).
3. **Produces** the videos using Zyvo's own generation pipelines + the Runware API. For each core idea it produces **two videos**:
   - **Result video**: the finished Zyvo output (e.g. an AI Fruit Story episode) as pure entertainment, with a soft "made with Zyvo" touch.
   - **Making-of video**: "how I made this in 30 seconds": a screen recording of Zyvo's UI creating that exact video, ending on the result reveal.
4. **Packages** each video with platform-specific captions, titles, hashtags and a suggested posting time for **TikTok, Instagram Reels and YouTube Shorts**.
5. **Shows everything** in a private admin page that only the owner can access, ready to download and post.
6. **Never exceeds the budget.** Hard daily and monthly spend caps across all paid APIs.
7. **Learns.** The owner can log post URLs and view counts; tomorrow's scout uses that data.

Posting stays **manual in v1** (the owner downloads and posts). Auto-posting is an optional later phase.

---

## 1. Ground rules for Claude Code

- **Explore before building.** In Phase 0, inspect the repo and report: frontend framework, backend/API layer, database + ORM, auth provider, how existing Zyvo generators (Short Form templates, Long Form, AI Fruit Story, Clay Rescue, Micro Camera, Cartoon Drive By, 2AM Worlds, Behind the Scenes, Video Generator) are invoked, existing Runware client code, job queue/cron setup, file storage, and deployment target. **Reuse what exists**: same auth, same DB, same storage, same Runware client, same generation functions. Do not create parallel copies of the generators.
- **Ask before** destructive DB migrations, adding new paid services, or changing anything user-facing outside `/admin`.
- **Secrets** live in env vars only. Never send API keys to the browser.
- **Admin generations must not consume a real user's credits** and must not appear in public "Community creations" unless the owner explicitly publishes them.
- Write small, testable modules. Add a `DRY_RUN=true` mode that runs the entire pipeline with mocked paid calls (cost = 0) for testing.

---

## 2. Access control (critical)

- Route: **`/admin/content-machine`** (plus sub-routes).
- Only the account with email **`upwardlift6@gmail.com`** can access it.
- Implement with env var `ADMIN_EMAILS=upwardlift6@gmail.com` (comma-separated list, so more can be added later).
- Enforce **server-side** on every admin API endpoint and every admin page load (middleware / route guard using the existing auth session). Hiding a link in the UI is NOT security.
- Check that the email is **verified** in the auth provider before granting access.
- Non-admins hitting the route get a plain 404 (don't reveal the page exists).
- All admin API routes live under `/api/admin/content-machine/*` and return 404 for non-admins.
- Generated files are stored privately (signed URLs with short expiry), not public buckets.
- Log every admin action (approve, regenerate, budget change, kill switch) to an audit table.

---

## 3. Architecture overview

```
 ┌──────────┐   ┌──────────┐   ┌──────────────┐   ┌───────────┐   ┌──────────┐
 │  SCOUT   │──▶│  IDEATE  │──▶│   PRODUCE    │──▶│  PACKAGE  │──▶│  ADMIN   │
 │ (daily)  │   │ 15 ideas │   │ result +     │   │ captions  │   │  QUEUE   │
 └──────────┘   └──────────┘   │ making-of    │   │ per       │   │ (manual  │
      ▲                         └──────────────┘   │ platform  │   │  posting)│
      │                                ▲            └───────────┘   └────┬─────┘
      │                                │                                  │
      │                         ┌──────┴──────┐                           │
      │                         │ BUDGET GUARD│ (every paid call)         │
      │                         └─────────────┘                           │
      └──────────────── LEARN (post URLs + views logged) ◀────────────────┘
```

Daily cron (default **07:00 Europe/Helsinki**) runs: `scout → ideate → produce → package`. Each stage is a separate job so a failure in one idea doesn't kill the run. Jobs are idempotent and resumable (if the server restarts mid-run, it continues where it stopped).

Use the existing job queue if one exists; otherwise add a lightweight one (e.g. BullMQ + Redis, or a DB-backed job table with a worker) — propose the choice in Phase 0.

---

## 4. Data model

Adapt names/types to the existing ORM. Suggested tables:

**`cm_settings`** (single row)
- `daily_budget_usd` (default 8.00)
- `monthly_budget_usd` (default 150.00)
- `per_provider_daily_caps` JSON, e.g. `{ "runware": 6.00, "anthropic": 1.50, "apify": 0.50 }`
- `daily_video_target` (default 15)
- `format_mix` JSON (see §6)
- `auto_produce` boolean (default true: produce ideas without manual approval)
- `kill_switch` boolean (default false: when true, NO paid calls happen)
- `run_time_local` (default "07:00"), `timezone` (default "Europe/Helsinki")
- `watchlist` JSON: accounts/hashtags to scout (seed list in §5)
- `brand_rules` text (see §9)

**`cm_runs`**: one per daily run: `id, date, status (pending|scouting|ideating|producing|packaging|done|failed|budget_stopped), started_at, finished_at, spend_usd, notes`

**`cm_scout_reports`**: `id, run_id, raw_sources JSON, trend_brief markdown, top_formats JSON, created_at`

**`cm_ideas`**
- `id, run_id, status (proposed|approved|rejected|producing|done|failed|skipped_budget)`
- `format` (enum, §6), `zyvo_tool` (which Zyvo generator it uses, or null for slideshows)
- `title`, `hook` (first-2-second line), `concept` (1–3 sentences), `script` JSON (scenes/beats/slides)
- `why_it_could_go_viral` (references the scout brief)
- `zyvo_integration` (how Zyvo is snuck in)
- `target_platforms` array, `estimated_cost_usd`, `virality_score` (1–10, model's self-estimate)
- `similarity_hash` / embedding (for dedup, §8)

**`cm_generations`**
- `id, idea_id, kind (result|making_of|slideshow)`
- `status (queued|generating|rendering|done|failed)`
- `video_url` (private), `thumbnail_url`, `duration_s`, `aspect` (9:16)
- `source_assets` JSON (Runware image IDs, Zyvo job IDs, recording file)
- `cost_usd`, `error`, `created_at`

**`cm_packages`**: one per generation per platform
- `generation_id, platform (tiktok|instagram|youtube)`
- `caption`, `title` (YouTube), `hashtags` array, `on_screen_text` array
- `suggested_post_time`, `ai_label_required` boolean, `sound_suggestion` (text only, see §9)

**`cm_posts`**: owner logs these
- `package_id, platform, post_url, posted_at, views_24h, views_7d, likes, comments, shares, signups_attributed` (manual or via UTM)

**`cm_spend_ledger`**: EVERY paid call
- `id, run_id, idea_id nullable, provider (runware|anthropic|apify|youtube|other), operation, estimated_usd, actual_usd, request_ref (taskUUID etc), created_at`

**`cm_audit_log`**: `id, actor_email, action, payload JSON, created_at`

---

## 5. Stage 1 — SCOUT

**Goal:** a daily trend brief of what's working *right now*.

**Sources (pluggable; each enabled only if its key is set):**
1. **Claude API with the server-side web search tool**: search for this week's viral AI short-form formats, trending TikTok/Reels/Shorts formats in the AI-content space, new AI video trends. (Check Anthropic docs for the current web-search tool version string.) This works with no other keys, so it's the default.
2. **YouTube Data API** (`YOUTUBE_API_KEY`): `search.list` for recent high-view Shorts on seed queries ("AI fruit", "AI clay rescue", "stickman history", "AI tools", "faceless youtube automation"). Search costs 100 quota units; cap at ~20 searches/day.
3. **Apify** (`APIFY_TOKEN`, optional): TikTok/Instagram scrapers for the watchlist accounts' latest posts + view counts. Counts against the `apify` budget cap.
4. **Our own performance**: last 14 days of `cm_posts` (which formats/hooks got the most views per platform).

**Seed watchlist** (editable in admin):
- Accounts: `@aicenturyclips` and similar AI-tool listicle creators; top AI fruit / clay / micro-camera / stickman / skeleton channels the scout discovers (it may propose additions; the owner approves).
- Hashtags/queries: #aitools #aivideo #aifruit #faceless #youtubeautomation #stickman #claymation #aianimation

**Output (`cm_scout_reports.trend_brief`)**, structured markdown:
- Top 5 formats getting outsized views this week, each with 1–2 example links, the hook pattern, length, and why it works
- Rising sounds/trends (names only, as text)
- What our own posts taught us (best/worst performers)
- 3 "angles nobody is doing yet" for Zyvo

**Scout prompt (system):**
```
You are a short-form video trend analyst for Zyvo (tryzyvo.com), an AI video generator
that makes viral 9:16 clips (AI Fruit Story, Clay Rescue, Micro Camera, Cartoon Drive By,
2AM Worlds, Behind the Scenes, Skeleton, Anime) and 8–15 min stickman YouTube explainers.
Find what is going viral THIS WEEK on TikTok, Instagram Reels and YouTube Shorts in the
AI-content / faceless-creator / AI-tools space. Prioritize evidence (view counts, recency)
over opinions. Be specific about hooks, pacing, length, and on-screen text patterns.
Cite links for every example. Output the structured brief exactly as specified.
```

---

## 6. Stage 2 — IDEATE

**Goal:** generate the day's ideas that together fill `daily_video_target` (default 15 videos).

**Default `format_mix` (editable):**
| Format | Count of ideas | Videos produced | Notes |
|---|---|---|---|
| `zyvo_native` | 6 | 12 (6 result + 6 making-of) | Uses a Zyvo generator. Pure entertainment result + paired "how I made this" |
| `listicle_slideshow` | 2 | 2 | "3 AI tools that…" carousel/slideshow, Zyvo is one of the items (never always #1 — vary position) |
| `long_form_cutdown` | 1 | 1 | Short cut from a Long Form stickman video with "full video on YouTube" |
| **Total** | **9 ideas** | **15 videos** | |

Other allowed formats the model may rotate in (max 1/day each, replacing a slot): `pov_skit` (text-on-screen POV, e.g. "POV: you finally automated your channel"), `before_after` (manual editing vs Zyvo), `series_episode` (continuing an AI Fruit Story series with the same cast — use Zyvo's 10-episode series feature so viewers follow the story), `challenge` ("I let AI make my content for 7 days").

**Ideation prompt (system):**
```
You are the head of growth content for Zyvo. Using today's trend brief, our performance
data, and the list of ideas from the last 30 days (avoid repeating them), produce exactly
{N} video ideas following this format mix: {format_mix}.

Rules:
- Each idea must be ENTERTAINING or USEFUL on its own. Zyvo is snuck in, never the hook.
- Hook must land in the first 1–2 seconds (on-screen text + visual). Write it explicitly.
- Optimize for: watch-time, loops, comments (open questions, hot takes, "which one would
  you pick?"), shares, saves.
- For zyvo_native ideas: specify which Zyvo tool, the exact inputs (prompt, characters,
  preset, episode count) needed to generate it, and the making-of angle.
- For listicle_slideshow: 5–8 slides, real tools only (verify they exist via web search),
  Zyvo appears as one genuine entry with an accurate description.
- Vary characters, settings, tones, and hooks across ideas. No two ideas should feel alike.
- Follow BRAND RULES strictly: {brand_rules}
- Return JSON matching the schema. Include estimated_cost_usd using the cost table provided.
```

**Idea JSON schema** (validate with zod/pydantic; reject + retry once on invalid):
```json
{
  "format": "zyvo_native",
  "zyvo_tool": "ai_fruit_story",
  "title": "Strawberry gets kicked out of the fruit bowl",
  "hook": "She thought nobody would notice…",
  "concept": "...",
  "script": { "scenes": [ { "visual": "...", "on_screen_text": "...", "vo": "..." } ] },
  "generator_inputs": { "...": "exact params for the Zyvo tool" },
  "making_of_angle": "Typing one sentence into Zyvo → full 5-episode drama",
  "zyvo_integration": "End card 'made with Zyvo' + caption CTA + making-of video",
  "why_it_could_go_viral": "...",
  "target_platforms": ["tiktok", "instagram", "youtube"],
  "estimated_cost_usd": 0.0,
  "virality_score": 8
}
```

Model choice: use `claude-sonnet-5-5` for scout + ideation, `claude-haiku-5-5` for captions/packaging. (Make model names env-configurable.)

---

## 7. Stage 3 — PRODUCE

All paid calls go through the **Budget Guard** (§8). Ideas are produced in order of `virality_score` descending, so if the budget runs out, the best ideas got made.

### 7a. Result videos (`zyvo_native`)
- Call the **existing Zyvo generator functions** directly (server-side), with `generator_inputs`, under an internal "content-machine" account/flag that bypasses user credits.
- Output 9:16 MP4. Add a subtle end card (last ~1.5s): "made with Zyvo · tryzyvo.com". Make it tasteful and small. Configurable on/off per idea.
- Store result, generate a thumbnail (best frame or a Runware-generated cover).

### 7b. Making-of videos ("how I made this")
Goal: a 15–30s video that looks like a real creator showing their screen.

**Approach: automated screen recording with Playwright.**
1. Launch headless Chromium at a 1080×1920 or 1920×1080 viewport, logged into the internal admin account, `recordVideo` enabled.
2. Script the real Zyvo UI flow for that tool: open the template → type the prompt with human-like typing speed → pick the preset/characters → click generate.
3. **Don't wait for the real generation on camera.** Pre-generate the result (7a) first, then in the recording show the progress UI for ~2–3s and cut.
4. Render with ffmpeg:
   - Hook text overlay first 2s (e.g. "I made this whole fruit drama with ONE sentence 🍓")
   - Speed-ramped recording (typing at 1.5–2×, cuts on clicks)
   - Cursor highlight / click ripples (inject a CSS cursor overlay via Playwright)
   - Zoom-ins on key UI elements (crop/scale in ffmpeg using recorded click coordinates)
   - Final 5–8s: the actual result video playing, then "tryzyvo.com" end card
   - Burned-in captions (auto-generated from a short script)
5. Output 9:16 (if recording is 16:9, place it in the middle with blurred background fill + top/bottom text bars).

**Fallback** if Playwright recording fails: build a slideshow-style making-of from UI screenshots (step 1 → step 2 → step 3 → result) with the same overlays.

### 7c. Listicle slideshows
- Generate a cover slide + one slide per item. Visual style inspired by high-performing listicle accounts (bold condensed headline, yellow highlight bar, browser-window mockup of the tool's site, URL pill) but **use our own original template and branding**, not a copy of anyone's design or avatar.
- Tool screenshots: capture each tool's homepage with Playwright (public pages only).
- Backgrounds / cover characters: Runware image generation (cheap fast model; record cost).
- Export as **both**: (a) a sequence of 1080×1920 PNGs for TikTok/IG photo carousels, and (b) an MP4 with ~2.5s per slide + transitions for Shorts/Reels.

### 7d. Long-form cut-downs
- Take a Long Form stickman video (generate one if the budget allows; else reuse the latest), pick the most surprising 30–45s segment (Claude picks from the script), add hook text + "full video on our YouTube" end card.

### Rendering
- Use ffmpeg (server-side or worker). Standard output: H.264, AAC, 1080×1920, 30fps, ≤ 60s, loudness-normalized.
- **No copyrighted music baked in.** Leave audio as voiceover/SFX only, and give a `sound_suggestion` so the owner adds a trending sound inside the app when posting (that's also better for reach).

---

## 8. Budget Guard (non-negotiable)

Single module every paid call must go through. No direct calls to Runware/Anthropic/Apify outside it (add a lint rule or code review check).

```
guard.spend(provider, operation, estimated_usd, fn)
  1. If settings.kill_switch → throw BudgetStopped
  2. today_spend = SUM(actual_usd ?? estimated_usd) for today (Europe/Helsinki day)
     month_spend = same for this month
     provider_today = same filtered by provider
  3. If today_spend + estimated > daily_budget
     OR month_spend + estimated > monthly_budget
     OR provider_today + estimated > provider cap
       → throw BudgetStopped (idea marked skipped_budget, run continues with cheaper ideas)
  4. Insert ledger row with estimated_usd (reserve the money BEFORE calling)
  5. Call fn()
  6. Update the ledger row with actual_usd from the provider response
```

- **Runware:** always send `includeCost: true` on every task. The response returns the actual USD cost; write it to `actual_usd`.
- **Anthropic:** compute actual cost from the `usage` tokens in the response × configured per-token prices (env-configurable).
- **Estimates:** keep a cost table per operation (e.g. `runware.image.fast`, `runware.video.480p_per_second`, `zyvo.ai_fruit_story.episode`). After 10+ real calls, auto-update each estimate to the rolling average of actuals.
- **Video generation is the expensive part** (per-second pricing). The planner must check `estimated_cost_usd` of each idea against the remaining budget and fill leftover budget with cheap formats (slideshows) instead of skipping the day.
- Concurrency safety: reserve spend in a DB transaction / row lock so parallel workers can't overspend.
- Alerts: if spend hits 80% of daily or monthly cap, show a banner in admin (optional: email to the admin).
- Kill switch toggle in admin stops everything immediately, including in-flight queue items before their next paid call.

**Dedup:** before producing, compare each new idea's embedding/hash with the last 30 days of ideas. If too similar (e.g. cosine > 0.9), ask the model for a replacement (max 2 retries). Near-duplicate content gets suppressed by platforms.

---

## 9. Brand & platform rules (put into `brand_rules`, enforced in prompts + a final check)

- Promote Zyvo **softly and honestly**. Zyvo appears as the tool used, a listicle entry, a caption CTA, or an end card.
- **No fake testimonials, fake users, invented income claims or invented stats.** No "I made $20k/month with Zyvo" unless it's a real, verifiable number. Listicle entries must describe real tools accurately.
- No copyrighted characters, brands, logos, celebrity likenesses or real people. No copied designs from other creators.
- Flag `ai_label_required = true` for any realistic AI-generated visuals, so the owner turns on the platform's AI-generated content label when posting.
- No misleading "news" or fake events; no medical/financial advice.
- Vary content so it isn't mass-produced duplicates (YouTube can demonetize repetitive/mass-produced content; TikTok suppresses duplicates).
- A final **compliance check** pass (cheap Haiku call) reviews each package against these rules before it's marked ready; failures go back for one rewrite or get flagged in admin.

---

## 10. Stage 4 — PACKAGE

For each finished generation, create a package per target platform:

- **TikTok:** caption ≤ 150 chars with a curiosity hook + question to drive comments, 3–5 hashtags (mix of 1 broad + niche), on-screen text suggestions, sound suggestion, best time to post.
- **Instagram Reels:** caption with hook line + 1–2 lines value + CTA ("link in bio → tryzyvo.com"), 5–8 hashtags.
- **YouTube Shorts:** title ≤ 60 chars (hooky, searchable), description with tryzyvo.com link, 3 hashtags incl. #shorts.
- Making-of videos get a stronger CTA ("tool's in my bio", "comment ZYVO and I'll send the link"); result videos get a soft one.
- Add UTM links per platform (`tryzyvo.com/?utm_source=tiktok&utm_campaign=cm_{idea_id}`) so signups can be attributed. If the site has analytics, surface signups per idea in admin.

---

## 11. Admin UI — `/admin/content-machine`

Match Zyvo's existing design system. Mobile-friendly: the owner will often post from their phone, so download + copy must work great on mobile.

**Top bar:** today's spend vs cap (progress bar), month spend vs cap, run status, **Run now** button, **Kill switch** toggle.

**Tabs:**

1. **Today** (default)
   - Run timeline (scout → ideate → produce → package) with live status.
   - Grid of today's ideas. Each idea card shows: format badge, Zyvo tool, title, hook, virality score, est./actual cost, status.
   - Expanding an idea shows **its generations side by side**:
     - **Result video** (player) | **Making-of video** (player)
     - Under each: download MP4 button, download slides (ZIP) for slideshows, platform tabs (TikTok / IG / YouTube) with caption, title, hashtags, each with a **Copy** button, the AI-label reminder, and the sound suggestion.
     - **Mark as posted** per platform → paste post URL.
   - Actions: approve / reject idea, **Regenerate** (result or making-of, separately), edit caption inline.

2. **Ideas**: all ideas history with filters (date, format, status, tool). The owner can also **add their own idea** in plain text and have the machine produce it.

3. **Generations**: gallery of all finished videos, filter by kind (result / making-of / slideshow), platform readiness, posted/unposted.

4. **Scout**: daily trend briefs (rendered markdown with links), watchlist editor, proposed new accounts to watch (approve/reject).

5. **Performance**: table of posted content with views/likes/comments per platform (manual entry in v1; editable inline), charts of views by format and by Zyvo tool, signups via UTM. This feeds the scout.

6. **Budget**: ledger table (filterable by provider/day), daily and monthly charts, average cost per format/tool, cap settings.

7. **Settings**: daily video target, format mix, run time, auto-produce toggle, end-card toggle, brand rules text, model names.

---

## 12. Phase plan (build in this order; stop and show the owner after each phase)

**Phase 0 — Recon & plan.** Explore repo, report stack + where generators/Runware/auth/storage live, propose the queue/cron choice and the DB migration. Wait for approval.

**Phase 1 — Foundation.** Admin auth guard (server-side, email allowlist), DB tables, Budget Guard with ledger + kill switch + `DRY_RUN`, admin shell with Budget and Settings tabs. *Acceptance:* non-admin gets 404 on page and APIs; budget guard blocks a call that would exceed caps (unit tests).

**Phase 2 — Scout + Ideate.** Scout with Claude web search (+ YouTube if key present), trend brief, ideation with schema validation and dedup, Today + Ideas + Scout tabs. *Acceptance:* "Run now" creates a brief and the day's ideas within budget; ideas visible in admin.

**Phase 3 — Produce results + slideshows + packaging.** Wire existing Zyvo generators, slideshow renderer (PNG set + MP4), end card, packaging per platform, compliance check. *Acceptance:* full daily run produces downloadable result videos and slideshows with captions; spend matches ledger.

**Phase 4 — Making-of videos.** Playwright recording flow per Zyvo tool, ffmpeg edit (hook, speed ramp, cursor, zooms, captions, result reveal), screenshot-slideshow fallback. *Acceptance:* each zyvo_native idea has a paired making-of video that plays well on mobile.

**Phase 5 — Learn loop.** Posts logging, Performance tab, UTM attribution, scout uses performance data, cost estimates auto-calibrate.

**Phase 6 (optional) — Auto-posting.** Behind per-platform toggles, off by default:
- YouTube Shorts via YouTube Data API `videos.insert` (OAuth to owner's channel).
- TikTok via Content Posting API. Note: unaudited apps can only post privately, so use the "upload to inbox/drafts" mode first and only enable direct post after passing TikTok's audit. Respect TikTok's per-account daily API post cap.
- Instagram Reels via Instagram Graph API (requires a Business/Creator account linked to a Facebook Page).
- Or integrate a self-hosted tool like Postiz instead of building three integrations.

---

## 13. Environment variables

```
ADMIN_EMAILS=upwardlift6@gmail.com
ANTHROPIC_API_KEY=
CM_MODEL_MAIN=claude-sonnet-5-5
CM_MODEL_FAST=claude-haiku-5-5
RUNWARE_API_KEY=              # reuse existing if already present
YOUTUBE_API_KEY=              # optional (scout)
APIFY_TOKEN=                  # optional (scout)
CM_DAILY_BUDGET_USD=8
CM_MONTHLY_BUDGET_USD=150
CM_TIMEZONE=Europe/Helsinki
CM_RUN_TIME=07:00
DRY_RUN=false
```
(DB settings override env defaults once saved in the admin Settings tab.)

---

## 14. Definition of done (v1 = Phases 0–5)

- Every morning, without the owner doing anything, the admin page shows ~15 ready-to-post videos (result + making-of pairs + slideshows) with copy-ready captions for TikTok, IG and YouTube.
- Total spend never exceeds the configured daily/monthly caps, and every cent is visible in the ledger.
- Only `upwardlift6@gmail.com` can see or call any of it.
- Content is varied, trend-informed, and promotes Zyvo softly and honestly.