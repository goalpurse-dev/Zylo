# AI Fruit Story — UI/UX Audit

Read-only audit of the current AI Fruit Story feature (working tree as of 2026-09-26, branch `main`).
No code was changed. Line numbers point to the current working copy.

**Core files**

| Role | File |
|---|---|
| Page / orchestrator | `src/pages/workspace/AIFruitStory.jsx` |
| Left panel (steps, footer, cost) | `src/components/viral-tools/ai-fruit-story/AIFruitStoryBuilder.jsx` |
| Step 1 "Idea" | `src/components/viral-tools/ai-fruit-story/steps/FruitStepStory.jsx` |
| Step 2 "Generate" | `src/components/viral-tools/ai-fruit-story/steps/FruitStepScenes.jsx` |
| Right panel (preview, results, history, regen modal) | `src/components/viral-tools/ai-fruit-story/AIFruitStoryResults.jsx` |
| Generation state machine | `src/components/viral-tools/ai-fruit-story/hooks/useFruitStoryJob.js` |
| API, models, pricing, prompts, persistence | `src/components/viral-tools/ai-fruit-story/api/fruitStoryApi.js` |
| Subscription paywall | `src/components/viral-tools/ai-fruit-story/FruitStoryPaywall.jsx` |
| Locked-model upsell | `src/components/viral-tools/ai-fruit-story/FruitStoryUpgradeModal.jsx` |
| Out-of-credits modal (shared) | `src/components/viral-tools/shared/NoCreditsModal.jsx` |
| Two-column shell (shared) | `src/pages/viral/shared/ToolGenerationLayout.jsx` |
| Edge functions | `supabase/functions/fruit-story-ideas`, `fruit-story-planner`, `fruit-story-video-prompts` |
| DB table | `supabase/migrations/20260509000000_fruit_story_generations.sql` |

---

## 1. Entry points & routes

### 1.1 Routes

| URL | Component | Notes |
|---|---|---|
| `/workspace/ai-fruit-story` | `src/pages/workspace/AIFruitStory.jsx` (`src/App.jsx:873`) | The tool itself. Listed under "PUBLIC ROUTES" in `App.jsx`; access is gated in-page by the paywall rather than by the router. SEO policy is `noindex`, `routeType: "paid-template"` (`src/data/routeSeoPolicy.js:15`). |
| `/ai-fruit-story-maker` | `src/pages/landing/AIFruitStoryLanding.jsx` (`src/App.jsx:731`) | Public marketing landing page. |
| `/blog/ai-fruit-story-maker` | Redirect → `/ai-fruit-story-maker` (`src/App.jsx:653`, `vercel.json:24`) | |
| `/blog/category/fruit-stories` + ~30 `/blog/ai-fruit-story-*` posts | `src/app/blog/imagegenerator/*.jsx` (`src/App.jsx:143-177, 237, 273, 294, 654-799`) | SEO content that links to the landing page or tool. |

The page title in the workspace top bar is "AI Fruit Story" (`src/pages/workspace/layout.jsx:115`).

### 1.2 How users navigate in

| Entry | File | Behaviour |
|---|---|---|
| Create menu tile "AI Fruit Story" (preview `bossmango.png`) | `src/components/workspace/CreateMenu.jsx:19-26` | Opens `/workspace/ai-fruit-story`. Used by both the desktop sidebar Create panel and the mobile Create sheet. |
| Desktop sidebar "Create" highlight | `src/components/workspace/toolshell.jsx:77` | Create item shows as active while on the route. |
| Mobile bottom nav "Create" highlight | `src/components/workspace/MobileBottomNav.jsx:168` | Same, for mobile. |
| Home page promo card (CTA button) | `src/components/workspace/AIFruitPromo.jsx:240-247`, mounted in `src/pages/home/home.jsx:47` | `navigate("/workspace/ai-fruit-story")`. Shows animated counters (4.7M views, 847K likes). |
| "What's Hot" rank #5 card | `src/components/workspace/WhatsHot.jsx:42-49` | Links to the tool; shows "4.7M" views. |
| Zyvo Suite carousel card (badge "NEW") | `src/components/workspace/ZyvoSuiteCarousel.jsx:14` | Links to the tool. |
| Announcements list "🍊 AI Fruit Story is Live" (2026.05.10) | `src/components/workspace/toprow.jsx:37-41` | Text only; no link. |
| Workspace footer "AI Fruit Story" | `src/components/workspace/footer.jsx:53, 155` | Links to the **landing page** `/ai-fruit-story-maker`, not the tool. |
| Landing page CTAs (4 buttons) | `src/pages/landing/AIFruitStoryLanding.jsx:145, 211, 258, 438` | All `navigate("/workspace/ai-fruit-story")`. |
| Public gallery category "AI Fruit Story" | `src/components/public-gallery/gallery.jsx:39-49` | Example videos (`/library/aifruit*.mp4`). |

### 1.3 Layout wrappers

- **Workspace layout** (`src/pages/workspace/layout.jsx`): top bar, sidebar (`toolshell.jsx`), mobile bottom nav, and the scroll container `#workspace-scroll`. The page scrolls this container directly to reset position (`AIFruitStory.jsx:154, 202`).
- **`ToolGenerationLayout`** (`src/pages/viral/shared/ToolGenerationLayout.jsx`): at `lg` and up, a two-column grid, left `460px` (`500px` at `xl`) and right `minmax(0,1fr)`. The left `<aside>` is sticky with height `calc(100dvh-96px)`. Below `lg` the right `<main>` is hidden, and the page renders its own mobile tab switcher inside `left`.
- **Portals**: `FruitStoryPaywall` (z-500), `FruitStoryUpgradeModal` (z-300) and `NoCreditsModal` (z-300) render into `document.body`. `RegenerateSceneModal` (z-120) is a fixed overlay rendered inline.

---

## 2. Screen-by-screen flow

### 2.0 Gate: paywall (before anything else)

**Component:** `FruitStoryPaywall.jsx`, controlled by `AIFruitStory.jsx:28-41, 94-119, 254-265`

- **Plan resolution:** the page reads `profiles.plan_code` (`AIFruitStory.jsx:104`) and caches it in localStorage `zyvo_fruit_plan` as `{id, code}` (`:12-18`). The cached value is used on first render so paid users don't see a flash of paywall.
- **Guest** (`!user`): the paywall opens immediately in guest mode.
  - Header: **"Sign in to continue"** / "Create an account, then pick a plan to use AI Fruit Story."
  - A looping phone video `/viral-builder/ai-fruit/result.mp4`
  - **"Create Free Account →"** → `navigate("/signup")`
  - **"Already have an account? Log in"** → `navigate("/login")`
- **Free plan** (`plan_code === "free"`): the paywall opens in subscription mode.
  - Header: **"Subscription Required"** / "You need a paid plan to create AI Fruit Story videos."
  - Billing toggle **Annual (–17%)** / **Monthly**, defaulting to `yearly` (`:54`).
  - Three tier cards (`TIERS`, `:8-37`, hardcoded prices and Stripe price IDs):
    - Starter: $20/mo, or $16/mo yearly
    - Pro: $42/mo, or $35/mo yearly. Badge "Popular".
    - Generative: $85/mo, or $70/mo yearly
  - Each card has a **"Get {Tier}"** button → `handleSubscribe` → `startCheckout({type:"subscription", priceId, …})` from `src/lib/payments`. With no auth user it redirects to `/signup`.
  - Footer: "Instant access · Cancel anytime · Billed via Stripe".
- **Not dismissable** for guest, free and unknown (`null`) plans (`dismissable={!needsUpgrade}`). The ✕ button calls `onClose`, which **navigates to `/workspace/home`** (`AIFruitStory.jsx:256-262`). Backdrop click and Esc are disabled when not dismissable.
- **Paid plans** (`starter`/`pro`/`generative`/`affiliate`/any other non-free code) never see it.

### 2.1 Step 1: "Idea" (left) + "Video Preview" (right)

**Left: `AIFruitStoryBuilder.jsx` header (always visible)**

- Avatar `/viral-builder/ai-fruit/characters/ananasgirl.png` (hidden if it fails to load, `:211-228`)
- H1 **"AI Fruit Story"**, subtitle "Generate viral fruit drama scenes and clips in one go." (`:230-233`)
- **Step indicator** segmented pill: **① Idea**, **② Generate** (`:238-266`). Clicking goes to that step (`handleStepClick`). Moving forward from step 1 without an idea shows the error "Write or pick a story idea before continuing."
- Step heading **"Story Idea"** / "Set up the fruit drama idea, characters, and story direction." (`STEPS`, `:15-28`)
- Orange step-error banner (`stepError`), red job-error banner (`error`) and purple phase-loading pill (`phaseLabel`) (`:282-301`)

**Left body: `FruitStepStory.jsx`**

- **Card "Pick a story idea"** (background `/viral-builder/ai-fruit/presets/cheating.webp`)
  - Sub-copy: "15 viral fruit-drama ideas — tap one to build your story from it."
  - **"Regenerate"** button (RefreshCw icon, spinner while loading) → `fetchIdeas()` → `generateFruitStoryIdeas()` → edge fn `fruit-story-ideas` (`fruitStoryApi.js:1783`). Disabled while loading.
  - The idea list is a scrollable box (`max-h-[260px]`) with numbered buttons "1. …". Clicking one calls `pickIdea()`, which sets `storyIdea`, `storyPreset:"custom"`, `conflict:"Custom story conflict"` and `ideaSource:"suggested"`. The active idea gets a purple left border and a check badge.
  - While loading with no cached ideas, 6 pulsing skeleton rows are shown.
  - On error: red text with the server message, or "Could not generate ideas. Try again."
  - Auto-fetch runs once on mount unless ideas exist on `form` or in localStorage `zyvo_fruit_story_ideas_v1` (`:9-64`).
- **Card "Your story idea"** (background `/viral-builder/ai-fruit/presets/custom.webp`)
  - If `ideaSource === "suggested"`: a panel reading **"Suggested story is chosen"** with the button **"✕ Write my own instead"**. That button clears `storyIdea` and sets `ideaSource:"custom"`. The chosen idea text is not shown here, only highlighted in the list above.
  - Otherwise, a `<textarea>` bound to `form.storyIdea`, `min-h-[100px]`, no max length. Placeholder: *"Pick an idea above, or write your own — e.g. 'A poor strawberry is betrayed by his rich banana brother over family inheritance.'"* Typing sets `conflict` to "Custom story conflict" (or empty) and `ideaSource:"custom"`.
  - Helper text: "Characters, story, and scenes are generated automatically from this idea on the next step."

**Left footer (desktop):** the single button **"Next Step"** → `goNext()` (`AIFruitStoryBuilder.jsx:139-146, 334-341`). It validates `storyIdea.trim()` and on success sets `stepIndex = 1`. There is **no plan check on desktop** here; the plan is checked at Generate.

**Mobile footer (step 1 only):** `MobileFruitStoryFooter` (`AIFruitStory.jsx:351-393`), fixed 72px above the bottom nav.
- **←** Back: always disabled on step 1.
- **"Next Step"** → `goMobileNext()`. It is disabled when busy or when there's no idea. On mobile it also opens the paywall if `needsUpgrade` (`:208`).

**Right: `AIFruitStoryResults.jsx` (stepIndex 0, `:170-219`)**
- H2 **"Video Preview"** / "Example of what your fruit story can look like."
- `PhoneVideoMockup` (`:961-1023`): a phone frame auto-playing `/viral-builder/ai-fruit/result.mp4`, muted and looping. It includes:
  - floating hearts animation
  - a "9:41" status bar and a "Preview" chip
  - an "AI Fruit Story" badge
  - decorative ♥ 💬 ↗ icons
  - a caption card whose title is `form.storyIdea` (fallback "Your fruit story preview") and whose subtitle is `form.conflict` (fallback "Betrayal / drama preview")
  - "Live template preview" with a green dot

  The video is a static sample and does not reflect the user's input beyond the caption text.
- **Recent Generations** panel beside the phone (desktop only). See §6.

### 2.2 Step 2: "Generate" (left) + "Story Results" (right)

**Left heading:** **"Generate Story"** / "Choose the story length, video model, and size, then generate your story." When a saved story was loaded and has images, the heading becomes **"Story Ready"** / "Your story is already generated. Check the results panel." (`AIFruitStoryBuilder.jsx:107-114`)

**Left body: `FruitStepScenes.jsx`**

1. **Story length** card (`:136-236`)
   - Title "Story length" / "Choose how long the final story should be."
   - Top-right readout: `{label}` plus "`N` scenes / `N` clips"
   - 4 buttons: **15s · 30s · 45s · 60s**. The active one is wrapped in `ActiveGlow`.
   - A decorative "Duration" slider with 4 dots and tick labels 15/30/45/60. It is **not interactive**; only the buttons change the value.
2. **Video model** (`:239-298`)
   - "Video model" / "This model animates each scene into a clip."
   - Segmented pills built from `FRUIT_VIDEO_MODELS`:
     - **V2** "Cheapest"
     - **V3** "Premium"
     - **V4** "Professional"
   - Locked pills show a 🔒 icon, dimmed text and a gold plan badge ("Pro"/"Generative"), with a tooltip "`V3` requires the `Pro` plan". Clicking a locked pill opens `FruitStoryUpgradeModal`.
   - Audio badge: green **"Audio included"** if `withSound` (all three models are `true` today). The red **"No audio generated"** branch is currently unreachable.
3. **Size** (`:301-347`): two buttons, **9:16 "Vertical"** and **16:9 "Wide"**.
4. **Full story cost** card (read-only, `:350-360`)
   - Detail line: "`N` images (`X`cr) + `N` clips (`Y`cr) • `aspect` • `model`"
   - Large total: "`T` credits"
5. **"Story generated"** green note ("Your scene images and video clips are ready below.") when every expected scene image succeeded (`:362-371`).

All inputs in this step are ignored while generating (`updateFormValue` returns early when `isGenerating`, `:83-89`).

**Continuation mode:** when a story was loaded from Recent and all images succeeded, the step body is replaced by the **"Story Ready"** card (badge "Ready") and a **"Loaded story"** card reading "`N` scenes -> `N` animation clips" / "Scenes and clips are restored from Recent Generations." (`FruitStepScenes.jsx:100-130`). Note the literal `->` text.

**Left footer (desktop, and fixed above the bottom nav on mobile)** (`AIFruitStoryBuilder.jsx:323-388`)

- **"Back"** → `goBack()`. Disabled while busy. If `phase === "done"` it jumps to step 1.
- The primary button → `handleGenerateClick()` (`:169-192`). Its label depends on state:

  | State | Label | Style |
  |---|---|---|
  | Idle | **"Generate Story"** + credit chip `{totalCredits}` | Purple gradient |
  | All scenes succeeded but phase not `done` | **"Regenerate Story"** + credit chip | Purple gradient |
  | Busy | pulsing dot + **"Generating… N%"** | Disabled, grey |
  | `phase === "done"` | **"✓ Start New Story"** | Green. Calls `onReset()`, which clears job state and returns to step 1. |

  **Click sequence (idle):**
  1. If there's no idea → go to step 1 with "Write or pick a story idea before generating your story."
  2. If `creditBalance < totalCredits` → open `NoCreditsModal`.
  3. Otherwise, write the overrides to `form`: `storyLength`, `sceneCount`, `sceneImageModel:"zyvo-v2"`, `animationModel`, `sceneAspect`, `style:"cinematic"`, `creditsPerImage`, `sceneCredits`.
  4. `emitCreditSpend(totalCredits)` shows the header "-N credits" pop. This is cosmetic only.
  5. `onGenerateScenes(overrides)` → page `handleGenerateScenes` (`AIFruitStory.jsx:142-149`). This opens the paywall if `needsUpgrade`, otherwise calls `startSceneGeneration(overrides)` and switches mobile to the Results tab.

**Right: `AIFruitStoryResults.jsx` (stepIndex 1, `:226-373`)**. See §4 for detail.
- H2 **"Story Results"** + dynamic status line
- Chips: "`N` scenes" and an aspect badge ("9:16"/"16:9")
- Combined progress card, success banner, "all videos failed" banner
- Scene cards grid: 2 columns for 9:16, 1 column for 16:9

### 2.3 Modals reachable from the flow

| Modal | File | Trigger | Content / actions |
|---|---|---|---|
| Paywall | `FruitStoryPaywall.jsx` | Guest or free plan on load; Generate/Next when `needsUpgrade` | See §2.0 |
| Upgrade (locked model) | `FruitStoryUpgradeModal.jsx` | Clicking a locked V3/V4 pill | Titles "V3 is a Pro feature" / "V4 is a Generative feature" with model copy. **"Upgrade to {Plan}"** is a plain `<a href="/workspace/pricing">`, so it causes a full page load. **"Not now"** closes. Backdrop click closes. |
| No credits | `NoCreditsModal.jsx` | Generate with balance < estimated total | Title "0 credits" / "Not enough credits". Body: "You only have N credits. You need T credits to make this video." **"Get Credits"** → `<a href="/workspace/pricing">`; **"Close"**. |
| Regenerate scene | `AIFruitStoryResults.jsx:376-434` | "Regenerate image" on a scene card | See §4.3 |
| Delete confirm | `window.confirm("Delete this saved generation?")` (`AIFruitStoryResults.jsx:896`) | × on a Recent card | Native browser dialog |

---

## 3. User inputs

| Input | UI location | Allowed values | Default | Where defined | Sent to |
|---|---|---|---|---|---|
| Story idea (text) | Textarea in `FruitStepStory.jsx:192-205`, or a picked suggestion | Any non-empty string. **No max length** on client or server. | `""` | Form init `AIFruitStory.jsx:45`. Required check `AIFruitStoryBuilder.jsx:93`. Server check `fruit-story-planner/index.ts:1160` ("storyIdea is required"). | Planner `storyIdea` |
| Suggested idea | List in `FruitStepStory.jsx:131-157` | 5–15 one-sentence ideas from GPT-4o-mini | Auto-fetched | `fruit-story-ideas/index.ts` (slices to 15, rejects < 5) | Becomes `storyIdea` |
| Story length | `FruitStepScenes.jsx:13-18` | `15s`, `30s`, `45s`, `60s` | `30s` | Scene map `STORY_LENGTH_SCENE_COUNTS = {15s:3, 30s:5, 45s:7, 60s:10}` (`fruitStoryApi.js:162-167`) | Planner `storyLength` + `sceneCount` |
| Scene count | Derived only (not directly editable) | 3 / 5 / 7 / 10 | `5` | As above. Reverse map `SCENE_COUNT_TO_LENGTH` (`fruitStoryApi.js:2185`). The planner does **not** clamp `sceneCount`. | Planner, DB `scene_count` |
| Video model | `FruitStepScenes.jsx:245-285` | `fruit-v2` (V2), `fruit-v3` (V3), `fruit-v4` (V4) | `fruit-v2` (`DEFAULT_FRUIT_VIDEO_MODEL`, `fruitStoryApi.js:91`) | `FRUIT_VIDEO_MODELS` (`fruitStoryApi.js:39-90`). Gating in `FRUIT_VIDEO_MODEL_MIN_PLAN` (`:94-98`) | `animateClip` → `createVideoJobSimple` |
| Size / aspect | `FruitStepScenes.jsx:20-23` | `9:16`, `16:9` in the UI. `1:1` is supported by the dims tables but not offered. | `9:16` | Image dims `FRUIT_MODEL_DIMS` (`fruitStoryApi.js:141-147`, 720×1280 / 1280×720). Video dims per model (`:55-87`). | Planner, image jobs, video jobs |
| Image model | **Not user-selectable** | `zyvo-v2` only → toolKey `image:fruit-v2` (GPT Image 2 via Runware, `quality:"low"`) | `zyvo-v2` | Hardcoded `IMAGE_MODEL_ID` (`AIFruitStoryBuilder.jsx:30`), `FRUIT_IMAGE_MODEL_TO_TOOLKEY` (`fruitStoryApi.js:30-32`) | Image jobs |
| Style | **Not user-selectable** | Always `cinematic` | `cinematic` | Hardcoded `DEFAULT_STYLE_ID` (`AIFruitStoryBuilder.jsx:31`). Style bible in `config/fruitStoryStyles.js`. | Planner `styleId`, image master prompt |
| Characters | **Not user-selectable.** The AI invents the cast from the idea. | `selectedCharacters` is always `[]` | `[]` | Comments at `AIFruitStory.jsx:137-138`, `AIFruitStoryBuilder.jsx:91-92` | Planner (empty) |
| Scene image prompt (edit) | Regenerate modal textarea (`AIFruitStoryResults.jsx:406-411`) | Any non-empty string | The planner's `imagePrompt` | — | `regenerateSceneImage` → `generateSceneImage` |

Video model specs (`fruitStoryApi.js:39-90`):

| Model | Label / tag | Provider toolKey | Clip length | Credits/clip | Resolution (9:16) | Min plan |
|---|---|---|---|---|---|---|
| `fruit-v2` | V2 · Cheapest | `video:seedance15pro` | 5 s | 12 | 496×864 | starter |
| `fruit-v3` | V3 · Premium | `video:viduq3turbo720` | 5 s | 17 | 720×1280 | pro |
| `fruit-v4` | V4 · Professional | `video:fruitveo31lite` | 6 s | 29 | 1080×1920 | generative |

**There are no narration, voiceover, dialogue, caption, music or duration-per-scene inputs.** Dialogue is generated automatically: the planner provides `videoDialogue`, then the vision pass (`fruit-story-video-prompts`, GPT-4o) enhances it, and it is embedded in each video prompt with the model's native audio.

---

## 4. Generation & results UI

### 4.1 Pipeline (what runs after Generate)

Orchestrated by `startSceneGeneration` in `useFruitStoryJob.js:559-784`:

1. **Planning** (`phase:"planning"`) → `planFruitStory()` → edge fn `fruit-story-planner` (GPT-4o, JSON mode, 55 s abort). Returns `{title, hook, storyDNA, cast[], scenes[]}`.
2. **Character portraits** (`phase:"generating-characters"`): one image job per cast member, all in parallel (`generateCharacterPortrait`, `fruitStoryApi.js:1841`). Each is awaited with a 4.5 min timeout. Failures are non-fatal.
3. **Scene state initialised.** `setScenes(planned)` puts all N scenes in the results grid immediately (`phase:"generating-scenes"`).
4. **DB row created** in `fruit_story_generations` with status `generating_images` (non-fatal if this fails).
5. **Scene images run sequentially.** Each uses the previous scene's image as a continuity reference, plus character portraits as refs. Each is awaited up to 4.5 min.
6. **Per-scene video starts immediately** when that scene's image succeeds (`startSceneVideo`, `:344-452`):
   - It builds a text video prompt.
   - It then runs a best-effort vision pass (`fruit-story-video-prompts`).
   - `animateClip` → `createVideoJobSimple` is attempted up to 3 times, retrying only on idle-timeout/504 with 8 s and 16 s backoff.

   Videos therefore overlap later scene images.
7. **Phase transitions** (effects `:201-227`):
   - `scenes-done` when every image is terminal. This also triggers the catch-up `startAnimation`.
   - `done` when every image is terminal and every clip scene's video is terminal. The DB is then set to `completed`.

Job updates come from `watchJob` (`src/lib/jobs.ts:398`), which combines Supabase realtime on `jobs` with a **1.5 s polling loop**.

### 4.2 While generating

| Where | What the user sees | Source |
|---|---|---|
| Left panel pill | "Planning story…" (covers both planning and portraits) → "Generating scenes… N%" / "Generating your story… N%" (images + videos) / "Animating… N%" | `AIFruitStoryBuilder.jsx:195-203, 296-301` |
| Left Generate button | Disabled, "Generating… N%" | `:370-374` |
| `totalProgress` formula | Average over scenes of (image 0–50) + (video 0–50) | `useFruitStoryJob.js:232-240` |
| Right status line | "Planning your story…" → "Designing your characters…" → "Generating your scenes…" / "Generating scenes and clips…" / "Animating your clips…" → "Your fruit story is ready." | `AIFruitStoryResults.jsx:241-255` |
| Right, before scenes exist | `sceneCount` × `ScenePlaceholderCard`: "Scene N", a pulsing dot and a spinner in an aspect-correct box | `:307-316, 439-459` |
| Right progress card | Pulsing dot + status, plus two bars: **Images `done/total`** and **Clips `done/total`** | `:279-290, 758-774` |
| Scene card, no image yet | `ZyvoLoadingCard`: a "Z" mark, "GENERATING", pulsing dots, shimmer bars, the image progress bar and a "Scene N" chip | `:642-725` |
| Scene card, image ready, video queued/running | The image with a dark overlay "Animating… N%" and a progress bar | `:549, 622-639` |
| Scene card, image ready, no video job yet | Chip **"Preparing to animate…"** (passive) | `:550, 738-747` |
| Skeletons | Extra `SceneSkeleton` cards if fewer scenes than expected while images generate | `:354-357` |

There is **no cancel/stop button** anywhere in the flow.

### 4.3 Display & per-item actions

**Scene card** (`SceneVideoCard`, `AIFruitStoryResults.jsx:461-587`):
- Header: "Scene N" plus the planner's scene title.
- Badges:
  - "Needs re-animation" (orange; see §9, never set)
  - "Failed" (red, image or video failure)
- Media:
  - `<video controls playsInline preload="metadata">` with the scene image as the poster once `videoUrl` exists.
  - Before that, an `<img>` (Runware URLs get `?format=webp&width=800` appended).
- Per-item actions:

| Action | When shown | What it calls | Cost shown? |
|---|---|---|---|
| **Download** (⬇ icon, top-right) | `scene.videoUrl` exists | `saveMediaToDevice({url, filename:"fruit-story-scene-{N}.mp4"})` (`src/lib/downloadMedia`). Uses the Web Share sheet on mobile and a normal download elsewhere. | n/a |
| **"Regenerate image"** | No `videoUrl` yet (hidden once the clip exists) | Opens `RegenerateSceneModal` | **No** (charges 2 cr) |
| Modal **"Regenerate"** / **"Cancel"** (×2) | — | `regenerateScene(index, prompt)` → `regenerateSceneImage` → `generateSceneImage` with the edited prompt and the previous scene as continuity ref. Button text changes to "Regenerating..." while the job is *created*, not while it renders. Disabled when the prompt is empty. | No |
| **"Retry video"** (on the Failed overlay) | Video failed, no URL, and not all clips failed | `retryFailedClips([clipNumber])` | **No** (charges the model's credits again) |
| **"🔄 Regenerate All Videos"** (banner "All videos failed to generate" / "This is usually a provider issue…") | Every clip failed | `retryFailedClips(null)` | No |

There is **no delete, reorder, edit-dialogue, edit-video-prompt or image-download** action per scene.

### 4.4 Final assembly, preview, export

**There is no final assembled video.** Each scene is a separate 5–6 s clip, and the user downloads clips one at a time. There is no "stitch", "export all", "download all", "publish" or combined preview in the Fruit Story UI. The comment on `FULL_VIDEO_TOOL_KEY` in `src/lib/jobs.ts:244-250` calls out Fruit Story as a *future* consumer of a "combine these clips into one finished video" feature. Clay Rescue's ffmpeg.wasm stitch is the only existing implementation.

---

## 5. Credits & plan UI

### 5.1 Where costs are shown

- **Generate button chip**: `{totalCredits}` with a credit icon (`AIFruitStoryBuilder.jsx:377-381`).
- **"Full story cost"** card in step 2 (`FruitStepScenes.jsx:350-360`).
- **Header "-N credits" pop** on click (`emitCreditSpend`, `src/lib/creditPopEvents.js`). This is cosmetic, and the header balance from `useProfileCredits` is optimistically reduced by N.
- **Paywall tier features** list credits per month (750 / 1,600 / 3,200).
- **Pricing page** (`src/pages/Pricing.jsx:185, 326-343`) uses `V2_OUTPUT_COSTS.fruitStory` (`src/lib/pricingOutputs.js:49-58`): 15s = 42, 30s = 70, 45s = 98, 60s = 140.

### 5.2 How the UI calculates the estimate (`AIFruitStoryBuilder.jsx:118-133`)

```
scenes          = STORY_LENGTH_SCENE_COUNTS[length]           // 3 / 5 / 7 / 10
creditsPerImage = selectedCharacters.length >= 3 ? 3 : 2      // always 2 (selectedCharacters is [])
imageCredits    = scenes × creditsPerImage
videoCredits    = scenes × FRUIT_VIDEO_MODELS[model].credits  // 12 / 17 / 29
portraitCredits = 6                                           // hardcoded worst case: 3 chars × 2 cr
totalCredits    = imageCredits + videoCredits + portraitCredits
```

| Length | V2 | V3 | V4 |
|---|---|---|---|
| 15s (3 scenes) | 48 | 63 | 99 |
| 30s (5 scenes) | 76 | 101 | 161 |
| 45s (7 scenes) | 104 | 139 | 223 |
| 60s (10 scenes) | 146 | 196 | 316 |

**The estimate differs from actual charges.** Charges happen **per job, server-side, when each job is created**. Portraits are charged 2 cr each for the real cast size (usually 2, sometimes 3). Images are 2 cr each and videos are charged per model. Regenerations and retries are charged again with no UI disclosure.

### 5.3 Plan gating

- **Page-level:** guests and `free` are hard-blocked by the paywall (§2.0).
- **Model-level:** `getAllowedFruitVideoModels(planCode)` (`src/lib/planGating.js`) uses tier order `free < starter < pro < generative`. `affiliate` gets only starter-tier models (V2). Locked pills open `FruitStoryUpgradeModal`.
- **Server enforcement:** `PLAN_GATED_TOOLS` in `supabase/functions/job-worker/index.ts:63-66` covers V3 → pro and V4 → generative. The comment in `planGating.js` notes that the two copies must be kept in sync by hand.
- The edge functions `fruit-story-ideas` and `fruit-story-planner` check only authentication, not plan.

### 5.4 Running out of credits

- **Before starting:** `creditBalance < totalCredits` opens `NoCreditsModal` → "Get Credits" (`/workspace/pricing`). Nothing is submitted.
- **Mid-story:** each `createImageJobSimple`/`createVideoJobSimple` re-checks `balance − credits reserved by queued/running jobs` and throws `INSUFFICIENT_CREDITS` (`src/lib/jobs.ts`, e.g. `:750-752`). In the UI, that scene or clip just shows the red **"Failed"** badge and overlay. The error text is stored on `scene.error` but **never displayed**, and no "get credits" prompt is shown.
- There is no refund pop (`emitCreditRefund` is never called by Fruit Story).

---

## 6. History / recent creations

**Component:** `RecentGenerationsPanel` + `GenerationCard` in `AIFruitStoryResults.jsx:776-958`

- **Where it appears:**
  - Desktop: step 1, to the right of the phone mockup.
  - Mobile: the step-1 **"Recent"** tab.
  - It is **not shown on step 2**.
- **Data:** `listFruitStoryGenerations(20)` reads `fruit_story_generations` (RLS: owner only), newest first, **max 20, no pagination**. It loads on mount, after a generation's images are all submitted, and on `reset()`.
- **Panel:** H3 "Recent Generations" / "Continue from your saved fruit story scenes."
  - Loading: 3 pulsing skeletons.
  - Empty: 🍊 "No saved fruit stories yet" / "Generate scenes once and they'll appear here."
  - List area is scrollable (`max-h-[70vh]`).
- **Each card shows:**
  - The planner title, or the first 60 chars of the idea, or "Fruit Story"
  - "`scene_count` scenes - `aspect` - `timeAgo`"
  - A status pill (`STATUS_LABELS`, `:781-789`):
    - Queued
    - Provider busy
    - Generating
    - Ready to animate
    - Some scenes failed
    - Animating
    - Completed
  - A thumbnail strip of up to 4 scene images (9:16 boxes) with empty-slot fillers. Runware CDN thumbnails older than 24 h are suppressed, and the placeholder reads **"Images expired"**; otherwise it reads "No images yet".
- **Actions:**
  - **×** (Delete) → `window.confirm` → `deleteFruitStoryGeneration(id)`. This deletes the DB row only, not the underlying jobs or media.
  - **"Continue →"** → `handleContinueGeneration(id)` (`AIFruitStory.jsx:159-182`):
    - `loadGeneration()` restores scenes, cast and phase.
    - The form's length/aspect/models are restored from the row.
    - It jumps to step 2. On mobile it opens Results if any video exists, otherwise Options.
    - Enabled for statuses `generating_images`, `images_generated`, `partial_failed`, `animating` and `completed`.
- **Live status polling:** cards with status `generating_images`/`animating` poll `generation_queue` every 4 s by `parent_generation_id` (`:815-832`). See §9: nothing in the Fruit Story flow writes those rows, so this falls back to the DB status.
- Fruit Story clips are ordinary `jobs` rows, so they may also appear in the general `/workspace/creations` library. That page was not audited here.

---

## 7. States & edge cases

### 7.1 Empty states
- Results, step 2 with no story: 🎬 **"No story yet"** / "Once generated, your scenes and clips will show here." (`AIFruitStoryResults.jsx:301-306`)
- Recent, no rows: 🍊 "No saved fruit stories yet".
- Ideas, loading with no cache: 6 skeleton rows.

### 7.2 Errors & failures

| Situation | UI | Source |
|---|---|---|
| Ideas fetch fails | Red text in the ideas card | `FruitStepStory.jsx:42-44, 119-121` |
| Planner fails (OpenAI error, 55 s timeout, invalid JSON) | Red banner in the left panel with the server message (e.g. "Story planning failed: …"). `phase = "failed"`; the right panel shows "No story yet". The user can click Generate again. | `useFruitStoryJob.js:593-598`, `AIFruitStoryBuilder.jsx:289-293` |
| Portrait fails or times out | Silent; the scene falls back to a text-only character description | `useFruitStoryJob.js:612-623` |
| Scene image fails | Card shows the "Failed" badge + ⚠️ overlay, with no reason text. The next scene gets no continuity ref. No video is started for that scene. **"Regenerate image"** is available. | `:769-776`, `AIFruitStoryResults.jsx:469, 494-571` |
| Scene image exceeds 4.5 min | The loop moves on (treated as not succeeded) but the watcher keeps listening. If it succeeds later the image appears, **but no video is auto-started** for it. | `useFruitStoryJob.js:37-53, 746-768` |
| Video job creation fails (after 3 attempts on timeout/504) | Scene `videoStatus:"failed"` → "Failed" + **"Retry video"** | `:439-448` |
| All clips fail | Banner "All videos failed to generate" + **"🔄 Regenerate All Videos"** | `AIFruitStoryResults.jsx:319-330` |
| Vision prompt pass fails | Silent; falls back to the text prompt | `useFruitStoryJob.js:377-379` |
| DB save fails | Silent (console only); generation continues but won't appear in Recent | `:687-690` |
| Story finishes with 0 successful clips | Left button becomes "✓ Start New Story". The results status reads "Your fruit story appears below." (not "ready"). The DB status is still set to **`completed`**. | `:217-227` |

### 7.3 Responsive / mobile behaviour (breakpoint `lg` = 1024 px)

- **Desktop (≥ lg):** two panels side by side, both always visible. The left panel's body scrolls internally (`overscroll-contain`) and its footer is static.
- **Mobile (< lg):**
  - A sticky segmented switcher at the top (`AIFruitStory.jsx:271-304`): **Options | Recent** on step 1, **Options | Results** on step 2. It toggles between the builder and results panels in one column.
  - Step 1 uses `MobileFruitStoryFooter` (← + "Next Step"), fixed at `bottom: 72px + safe-area`.
  - Step 2 uses the builder footer (Back + Generate), fixed at `bottom: 70px + safe-area`.
  - Clicking Generate auto-switches to **Results** and scrolls to top. When `phase` becomes `done`, it auto-switches to Results again (`:122-127`).
  - The paywall renders as a bottom sheet (`items-end`, rounded top). Its left phone-video column is hidden below `md`, and the guest view shows its own small phone.
  - Download uses the native share sheet where supported.

### 7.4 Navigation during generation
- Back is disabled while busy, but the **step-indicator pills are not**. The user can jump to step 1 mid-generation. The generation keeps running in the background, and the right panel switches to the phone mockup.
- Leaving the page stops the client-driven sequential loop. See §9 for how resume behaves.

---

## 8. State management

| State | Lives in | Persisted? |
|---|---|---|
| `stepIndex`, `mobilePanel`, `mobileTab`, `loadedFromRecent`, `paywallOpen`, `paywallGuest` | `useState` in `AIFruitStory.jsx` | No; lost on refresh (always restarts at step 1) |
| `form` (idea, length, model, aspect, …) | `useState` in `AIFruitStory.jsx:43-57` | **No.** A typed idea and all selections are lost on refresh. |
| `form.generatedIdeas` (suggestion list) | `form` + localStorage `zyvo_fruit_story_ideas_v1` | **Yes**, indefinitely (no TTL) until "Regenerate" |
| Plan code | `useState` + localStorage `zyvo_fruit_plan` (`{id, code}`) | Yes (cache); re-verified from `profiles` on every mount |
| `phase`, `scenes`, `videoClips`, `error`, `generationId`, `recentGenerations` | `useState` in `useFruitStoryJob.js:161-167` | In memory; `scenes` is mirrored to the DB (below) |
| Cast bible, run id, in-flight locks, job watchers | `useRef` in `useFruitStoryJob.js:169-186` | No (cast bible is restored from `cast_data` on Continue) |
| Generation record | Supabase `fruit_story_generations`: `title`, `story_idea`, `scene_count`, `scene_aspect`, `image_model`, `animation_model`, `status`, `cast_data`, `planner_output`, `scenes` (jsonb, via `scenesForDB`, `useFruitStoryJob.js:133-154`) | **Yes.** Updated after each job creation and each terminal job update. |
| Job status/progress/URLs | Supabase `jobs` table, watched via realtime + 1.5 s polling | Yes |
| Credit balance | `useProfileCredits` (realtime + 10 s poll + optimistic pending delta) | Server-side |
| Regenerate-scene modal state | `useState` in `AIFruitStoryResults.jsx:134-136` | No |
| URL params | **None used**; the route has no query/path params | — |

**On refresh:** the user lands on step 1 with an empty form (ideas list restored from cache). An in-flight story is not auto-resumed; it must be reopened from Recent → Continue.

---

## 9. Known gaps

### 9.1 Missing features / half-built
1. **No final video assembly or export.** Only per-clip MP4 downloads (§4.4).
2. **No cancel** for an in-progress story.
3. **No image download**, and no per-scene delete/reorder/dialogue editing.
4. **Style picker removed.** `style` is hardcoded to `cinematic` (`AIFruitStoryBuilder.jsx:31`). Four styles exist in `config/fruitStoryStyles.js` (`FRUIT_STORY_STYLE_OPTIONS`) and `FRUIT_STYLE_OPTIONS` in `data/fruitStoryDefaults.js`, but neither options list is used by the UI.
5. **Character picker removed.** `selectedCharacters` is always `[]`, so the 3-character image price (`getFruitV2CreditsPerImage`, `fruitStoryApi.js:149-152`) can never trigger from the UI.
6. **1:1 aspect** is supported in all dimension tables and aspect-class ternaries but not offered in the Size selector.

### 9.2 Dead / unused code & state
- `MOCK_FRUIT_SCENES`, `MOCK_SCRIPT`, `MOCK_TITLE`, `MOCK_DESCRIPTION`, `MOCK_HASHTAGS` (`data/fruitStoryDefaults.js`) are not imported anywhere.
- Form fields `mainFruit:"Orange"`, `villainFruit:"Banana"`, `setting:"Fruit city"` (`AIFruitStory.jsx:48-50`) are never read. `sceneCredits` is written (`AIFruitStoryBuilder.jsx:189`) but never read.
- `STORY_LENGTH_DURATION_SEC`, `getFruitClipCountForLength`, `isFruitVideoPromptReady` and `updateFruitStoryGeneration` (`fruitStoryApi.js`) are never called from the UI. `updateFruitStoryGeneration` is imported by the hook but unused.
- The hook exposes `updateClipVoiceover`, `startAnimation`, `generationId`, `isDone` and `loadRecentGenerations`, which the page does not use.
- **"Needs re-animation" badge** (`AIFruitStoryResults.jsx:489-493`): `scene.needsReanimation` is never set anywhere.
- **"No audio generated" badge** (`FruitStepScenes.jsx:292-297`) is unreachable because all models have `withSound: true`.
- **Duration slider** (`FruitStepScenes.jsx:188-235`) is visual only and not draggable.
- **Recent card live queue status** (`AIFruitStoryResults.jsx:810-839`) polls `generation_queue.parent_generation_id`. Fruit Story never writes `generation_queue` rows (only `src/lib/generationQueue.ts` does, used by `QueueStatusModal`, which this feature doesn't mount). As a result, the "Queued"/"Provider busy" labels never appear.
- The `"animating"` DB status is never written in the current flow. `deriveScenesStatus` is only called without `videoPhase`, and the only other status written is `"completed"`. This leaves the `animating` branches in `loadGeneration` (`useFruitStoryJob.js:528-534`) and in `STATUS_LABELS` effectively dead.

### 9.3 Behaviour bugs / inconsistencies worth verifying
1. **Mobile retry buttons do nothing.** The mobile `AIFruitStoryResults` instance (`AIFruitStory.jsx:307-320`) doesn't pass `onRetryFailedClips`. Both **"Retry video"** and **"Regenerate All Videos"** still render, because their visibility doesn't depend on the callback, but they call `onRetryFailedClips?.()`, which is a no-op.
2. **Resume after leaving mid-generation:**
   - Scenes that were never submitted (no `imageJobId`) stay `queued` forever, and the story never reaches `scenes-done`/`done`.
   - Videos that were in flight when the user left are not re-watched unless the DB status is `animating`, which is never written (§9.2). Those cards can sit at "Animating…" indefinitely.
3. **Regenerated image doesn't re-animate.** `regenerateScene` resets image fields only, and the per-scene auto-animate lives only inside `startSceneGeneration`'s loop. After regenerating a failed-image scene there is no UI path to animate it; the "Regenerate image" button stays visible while `videoUrl` is empty.
4. **Late-succeeding images** (after the 4.5 min client timeout) are also never animated (§7.2).
5. **Stuck optimistic credit display.** `emitCreditSpend(total)` fires before planning. If planning fails, or actual charges are lower than the 6-credit portrait worst case, the header balance stays reduced until reload, because `useProfileCredits` only reconciles when the server balance actually drops.
6. **Estimate ≠ Pricing page.** The UI shows 76 cr for 30s V2; `pricingOutputs.js:55` says 70 (the difference is the portrait allowance). The comment in `creditPopEvents.js:7` says a 5-scene story is "-28 credits", which is stale.
7. **Length label ≠ output length.** V2/V3 clips are 5 s, so "30s" yields 25 s, "45s" 35 s and "60s" 50 s. V4 (6 s) yields 18/30/42/60 s. `buildVideoClipsFromScenes` hardcodes `duration: 6` (`fruitStoryApi.js:190`).
8. **Hidden per-action costs.** "Regenerate image" (2 cr), "Retry video" / "Regenerate All Videos" (12–29 cr per clip) and "Regenerate Story" (full cost) show no cost or confirmation.
9. **Failure reasons hidden.** `scene.error` (including `INSUFFICIENT_CREDITS`) is never rendered. The card only says "Failed".
10. **Desktop vs mobile gating differs.** Mobile "Next Step" opens the paywall for `needsUpgrade`; desktop "Next Step" doesn't. Both gate at Generate.
11. **Unknown plan codes** (anything not in `free/starter/pro/generative/affiliate`) are treated as tier 0 by `planTierIndex`. That locks every model pill, including the pre-selected V2, while the paywall stays closed.
12. **While `planCode` is still loading (`null`)**, `needsUpgrade` is true, so the paywall ✕ navigates home and Generate opens the paywall. This could affect paid users on a slow first load without a cached plan.
13. **Runware image expiry.** Recent thumbnails older than 24 h are hidden as "Images expired", but Continue still loads the same URLs into the result cards. The `<img>` hides itself on error, leaving blank dark cards with no message.
14. **Deleting the active generation** clears `scenes`/`phase` but not `videoClips` or active job watchers (`useFruitStoryJob.js:544-556`).
15. **Continuation "Loaded story" copy** renders a literal `->` (`FruitStepScenes.jsx:122`).
16. **`fruit-story-video-prompts` has no in-function user auth check** (unlike `fruit-story-ideas`/`-planner`). It relies on the Supabase gateway's JWT verification, if that is enabled.

### 9.4 Hardcoded values
- Paywall tier prices, features and Stripe price IDs (`FruitStoryPaywall.jsx:8-37`), duplicated from `src/pages/Pricing.jsx`.
- Plan gate map duplicated between `src/lib/planGating.js` / `fruitStoryApi.js:94-98` and `job-worker/index.ts:63-66`.
- Portrait credit estimate `6` (`AIFruitStoryBuilder.jsx:132`).
- V2 video credits (12) are flagged in code as an **unmeasured estimate** (`fruitStoryApi.js:47-51`).
- Recent list limit 20. Image-job wait timeout 4.5 min. Watch poll 1.5 s. Recent queue poll 4 s. Stagger 3 s / 5 s (V4) in `startAnimation`.
- Promo/marketing stats (4.7M views, 847K likes) in `AIFruitPromo.jsx` and `WhatsHot.jsx`.
- **No TODO/FIXME/HACK markers** exist in the Fruit Story files. The only "please fix" note is the V2 cost comment above.

---

## Appendix: user journey (ASCII)

```
 ENTRY
 ─────
  Home promo CTA ─┐  What's Hot #5 ─┐  Suite carousel ─┐  Create menu tile ─┐
  Landing /ai-fruit-story-maker (4 CTAs) ─┐   Blog posts → landing ─┐       │
                                          ▼                         ▼       ▼
                              ┌────────────────────────────────────────────────┐
                              │  /workspace/ai-fruit-story  (AIFruitStory.jsx) │
                              └───────────────────────┬────────────────────────┘
                                                      │ read profiles.plan_code
                    ┌─────────────────────────────────┼──────────────────────────────┐
                    ▼                                 ▼                              ▼
             guest (no user)                     plan = free                     paid plan
    Paywall "Sign in to continue"     Paywall "Subscription Required"             │
    [Create Free Account] → /signup   [Annual|Monthly] [Get Starter/Pro/Gen.]     │
    [Log in] → /login                  → Stripe checkout                          │
    [✕] → /workspace/home             [✕] → /workspace/home                       │
                                                                                  ▼
 STEP 1 · IDEA ──────────────────────────────────────────────────────────────────────────
  LEFT (FruitStepStory)                            RIGHT (Results, step 0)
  ┌──────────────────────────────┐                 ┌──────────────────────────────────┐
  │ Pick a story idea [Regenerate]│◄─ fruit-story-  │ Video Preview (phone mockup,     │
  │  1..15 ideas (tap to select)  │   ideas (cached)│  sample mp4 + idea as caption)   │
  │ Your story idea [textarea]    │                 │ Recent Generations (≤20)         │
  │  or "Suggested story is chosen│                 │  card: title·N scenes·aspect·age │
  │   [Write my own instead]"     │                 │  status · 4 thumbs               │
  └──────────────┬───────────────┘                 │  [×] delete   [Continue →] ──────┼──┐
                 │ [Next Step] (needs non-empty idea)                                │  │
                 ▼                                 (mobile: Options | Recent tabs)   │  │
 STEP 2 · GENERATE ◄──────────────────────────────── loadGeneration(): restore ──────┘  │
  LEFT (FruitStepScenes)                              scenes/cast/form, jump here  ◄────┘
  ┌───────────────────────────────────────────┐
  │ Story length [15s][30s][45s][60s] → 3/5/7/10 scenes
  │ Video model  [V2 Cheapest][🔒V3 Pro][🔒V4 Generative] ──locked──► Upgrade modal
  │ Size         [9:16 Vertical][16:9 Wide]            [Upgrade to X]→/workspace/pricing
  │ Full story cost: images + clips (+6 portrait) = T credits
  │ [Back]  [Generate Story ◉T]                                                  │
  └───────────────────┬───────────────────────┘                                  │
                      │ no idea → back to step 1 w/ error                        │
                      │ balance < T → NoCreditsModal [Get Credits]→/workspace/pricing
                      │ needsUpgrade → Paywall                                   │
                      ▼ emitCreditSpend(T); startSceneGeneration()
 GENERATION (useFruitStoryJob) ─────────────────── RIGHT: "Story Results"
   planning ─► fruit-story-planner (GPT-4o)         "Planning your story…"   N placeholder cards
      │ fail → red error banner, phase=failed ──► user can press Generate again
      ▼
   generating-characters ─► portrait image jobs ∥   "Designing your characters…"
      ▼
   create fruit_story_generations row
      ▼
   for each scene (sequential):                     Images x/N ▓▓░  Clips y/N ▓░░
     image job (prev scene + portraits as refs) ──► card: Z loader → image
       └─ on success ─► startSceneVideo (async):    "Preparing to animate…"
            text prompt → vision prompt (best-effort)
            → video job (V2/V3/V4, ≤3 tries) ─────► "Animating… N%" overlay → <video controls>
      ▼
   all images terminal → scenes-done (catch-up animate)
   all clips terminal  → done  (DB status=completed)
                                                    "Your fruit story is ready."
                                                    "k of N clips generated successfully."
 RESULTS / PER-SCENE ACTIONS ─────────────────────────────────────────────────────────────
   [⬇ Download] clip → fruit-story-scene-N.mp4 (share sheet on mobile)
   [Regenerate image] (before clip exists) → modal: edit prompt [Regenerate] → new image job
   [Retry video] on failed clip ─┐
   [🔄 Regenerate All Videos] ───┴─► retryFailedClips()   (no-op on mobile — not wired)
      ▼
 EXPORT
   ✗ No stitched/final video — user downloads each clip individually.
      ▼
   Left button → [✓ Start New Story] → reset() → STEP 1  (row stays in Recent Generations)
```
