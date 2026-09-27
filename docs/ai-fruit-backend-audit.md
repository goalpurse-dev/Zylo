# AI Fruit Story — Backend & Prompt-Layer Audit

Read-only audit of the server side and the API/prompt layer of AI Fruit Story (working tree on `main`, 2026-09-26). No code was changed.
It builds on [ai-fruit-ui-audit.md](ai-fruit-ui-audit.md) and doesn't repeat the UI; UI facts appear only where a backend path needs them.

**Conventions**
- `path:line` references point at the current working copy.
- Verbatim prompt text is pulled straight from source by line range, so it is exact. Each block is collapsed under a `<details>` heading that names the file and lines.
- "Rendered example" blocks come from running the **real builder functions** from `fruitStoryApi.js` against a sample scene. The scene values are illustrative (a 5-scene cheating story with an AI-invented cast); the code paths and truncation are real.
- Only env var **names** appear here. No secret values.

---

## Contents

- [0. Key findings](#0-key-findings)
- [1. Full prompt chain](#1-full-prompt-chain)
- [2. Edge functions](#2-edge-functions)
- [3. Job system & provider calls](#3-job-system--provider-calls)
- [4. Credits (server side)](#4-credits-server-side)
- [5. Plan gating (server side)](#5-plan-gating-server-side)
- [6. Database](#6-database)
- [7. Media storage](#7-media-storage)
- [8. Video stitching (existing code)](#8-video-stitching-existing-code)
- [9. Shared vs Fruit-specific code](#9-shared-vs-fruit-specific-code)
- [10. Config & env](#10-config--env)
- [11. Known backend gaps](#11-known-backend-gaps)
- [Appendix: sequence diagram](#appendix-sequence-diagram-generate-story--finished-clips)

---

## 0. Key findings

> **Corrections and status (2026-09-26, after the billing hotfix):**
> - **Finding 3 was wrong for two keys.** A live-only trigger, `jobs_enforce_cooking_pricing` (now captured in `20261007100000`), already re-priced `image:fruit-v2` (2 cr) and every `video:seedance15pro` job (`ceil(s × 5.25)` with sound). So Fruit V2 clips were charged **27**, not 12: 291 clips, 4,365 credits over the advertised price.
> - **`image:fruit-v2` isn't Fruit-only.** Clay Rescue, Face ASMR, Footballer, Micro Camera and Cooking Matic also use it (§9.1 is wrong on this).
> - **`jobs` RLS (§6.2) is now documented.** Owners could INSERT and UPDATE every column, including `charged`.
> - **Fixed by migrations `20261007100000`–`20261007120000`:**
>   - Fruit video now uses dedicated keys `video:fruit-v2/v3/v4`, priced server-side from `tool_prices`.
>   - A guard on `jobs` stops browser writes to billing and lifecycle columns.
>   - `deduct_credits` is hardened.
>   - Service-only billing RPCs are revoked from `anon`/`authenticated`.
>   - The three Fruit edge functions have auth, a paid-plan check, input limits, timeouts and rate limits.
> - Rollback: `supabase/rollbacks/20261007_billing_hotfix_rollback.sql`.

These are the issues most likely to affect output quality, cost, or billing. All are covered in detail in §11.

1. **Scene images never receive the scene description.** `runware-image` truncates every positive prompt to **2,000 chars** (`supabase/functions/runware-image/index.ts:508`, applied at `:673`). A typical Fruit scene prompt is **~7,800 chars**. The part that is actually sent ends inside the generic style preamble:
   - "REFERENCE RULES" starts at char ~3,150.
   - "SCENE BEAT CONTEXT" starts at ~6,100.
   - The planner's "SCENE DESCRIPTION" starts at ~6,550.

   Every scene image is therefore generated from the same generic text plus the character portrait refs. The "Regenerate image" prompt editor edits text that is never sent (§1.5).
2. **Video prompts lose their required sections and garble dialogue.** The client caps video prompts at 1,450 chars (`fruitStoryApi.js:107`). The `Cast:` block now sits *before* dialogue, so in a typical 2-character scene the cap cuts:
   - mid-dialogue line;
   - all of `Action:`, `Speech rules:`, `Audio:`, `Emotion:`, `Voice:`, `Camera:`, `Style:` and `Ending beat:`.

   `animateClip` then **rebuilds** the prompt from that already-cut text (`fruitStoryApi.js:2153-2154`). Dialogue lines without a closing quote are dropped and replaced with canned fallback lines, so the dialogue sent to Runware differs from the dialogue saved on the scene. The per-character "voice" descriptions never reach the model (§1.8).
3. **Prices are client-declared.** For Fruit tool_keys, `jobs.charge_credits` comes straight from the browser insert (`src/lib/jobs.ts:214`). Nothing server-side validates it; the one correction table in `runware-video/index.ts:277-285` doesn't match any Fruit signature.
4. **The Fruit paywall is client-only.** The server gates only V3 and V4 video (`job-worker/index.ts:63-66`). `image:fruit-v2`, `video:seedance15pro`, and both OpenAI edge functions are open to any signed-in user; the planner and ideas functions check only auth. `fruit-story-video-prompts` has **no user auth check** at all and makes one GPT-4o vision call per scene in its input (§2.3).
5. **An image can succeed at the provider but never complete.** Images are charged at *completion* (`complete_generation_job` → `charge_job_credits`). If the balance was used up meanwhile (Fruit videos charge at launch), `complete_generation_job` returns `false` and leaves the job `processing` forever. The image is paid for at Runware but never delivered, and the UI waits indefinitely (§4.4).
6. **Jobs re-queued by job-worker's rate-limit path may never be dispatched.** `job-worker` re-queues Runware 402/rate-limit rejections with a `retry_after`. No dispatcher for `jobs` rows exists in the repo: `queue-worker` only dispatches `generation_queue` rows and only recovers `running`/`processing` rows. Unless an external cron calls `job-worker` without a `jobId`, these jobs stay `queued` (§3.7).
7. **Runware's real cost is never tracked.** `includeCost: true` is sent on every task. Image responses are stored raw in `jobs.output` but never read; video completion passes `p_output: null`, so the cost is discarded (§4.6).
8. **Generated media is permanent, not expiring.** Every image and video is copied into the public Supabase bucket `generated` (`runware-image/index.ts:323-355`, `runware-video/index.ts:192-220`). The UI's "Runware thumbnails expire after 24 h" heuristic only applies when that copy failed (§7).

---

## 1. Full prompt chain

### 1.0 All AI calls in one story, in order

The table traces one story of N scenes and a cast of C (2 or 3 characters). It covers every AI call from one "Generate Story" click to the finished clips.

| # | Stage | Built in | Executed in | Model | Parameters | Calls per story |
|---|---|---|---|---|---|---|
| 0 | Idea list (step 1, before Generate) | `fruit-story-ideas/index.ts:31-58` | edge fn → OpenAI | `gpt-4o-mini` | `temperature: 1`; **no** JSON mode, **no** `max_tokens`, **no** timeout | 1 per Regenerate or empty cache |
| 1 | Story plan | `fruit-story-planner/index.ts:842-1279` | edge fn → OpenAI | `gpt-4o` | `temperature: 0.55`, `response_format: json_object`, `max_tokens: 5500`, `AbortSignal.timeout(55_000)` | 1 |
| 2 | Character portraits | `fruitStoryApi.js:1813-1872` | browser → `jobs` → job-worker → runware-image → Runware | `openai:gpt-image@2` (GPT Image 2) | `quality: "low"`, requested 720×1280 / 1280×720 (snapped to a GPT-Image-2 approved size), no refs, `outputQuality: 85` | C (in parallel) |
| 3 | Scene images | `fruitStoryApi.js:1467-1494, 1496-1776, 1875-2028` | same path | `openai:gpt-image@2` | as above, plus up to 4 `inputs.referenceImages` (the portraits) | N (one after another) |
| 4 | Vision dialogue pass | `fruit-story-video-prompts/index.ts:93-150` | edge fn → OpenAI | `gpt-4o` (vision) | `temperature: 0.8`, `json_object`, `max_tokens: 400`, image `detail: "high"`, **no** timeout | N (one per scene, fired when that scene's image succeeds) |
| 5 | Video clip | `fruitStoryApi.js:975-1152, 2139-2177` | browser → `jobs` → job-worker → runware-video → Runware | Seedance 1.5 Pro / Vidu Q3 Turbo / Veo 3.1 Lite | See §3.4 | N |
| 6 | *(conditional)* Content-policy rewrite | `runware-video/index.ts:369-444` | runware-video → OpenAI | `gpt-4o-mini` | `temperature: 0.4`, `max_tokens: 800`, no timeout | 0–2 per clip, only when a video is rejected by a content filter |

The orchestration lives in the browser: `startSceneGeneration` in `useFruitStoryJob.js:559-784` and `startSceneVideo` at `:344-452`. The server has no end-to-end "story" job; every step is driven by the open tab.

---

### 1.1 `fruit-story-ideas` (story idea list)

- **Request:** `supabase.functions.invoke("fruit-story-ideas", { body: {} })` (`fruitStoryApi.js:1783-1792`). There are no user inputs.
- **Model call:** `fruit-story-ideas/index.ts:83-94`. A single `user` message containing the prompt below. No system prompt and no few-shot examples, apart from the one example sentence inside the prompt.
- **Parsing** (`:62-70`): split on newlines, strip leading `1.` / `1)` numbering, keep the first 15. Fewer than 5 ideas → `502 "Idea generation returned an unusable response"`.
- **Response:** `{ ok: true, ideas: string[] }` (5–15 strings). The client caches it in localStorage (see UI audit §8).

<details>
<summary><code>supabase/functions/fruit-story-ideas/index.ts:31-58</code> — IDEATION_PROMPT (sent verbatim as the only user message)</summary>

```ts
const IDEATION_PROMPT = `You are a viral AI content ideation expert.

Your task is to generate 15 highly engaging short video ideas for AI animated videos featuring human-like fruit characters.

IMPORTANT:

ONLY generate ideas (NO story, NO explanation, NO descriptions)
Each idea must be ONE single sentence
Keep each idea clear, simple, and emotionally strong
Focus on conflict, drama, or curiosity

STYLE:

Viral YouTube Shorts / TikTok style
Emotional triggers: betrayal, love, jealousy, revenge, sacrifice, injustice
Easy to visualize in animation
Use fruit characters as humans (banana, strawberry, apple, mango, etc.)

FORMAT:

Numbered list (1–15)
One line per idea
No extra text before or after

EXAMPLE STYLE:
A poor strawberry is betrayed by his rich banana brother over family inheritance

Now generate 15 unique ideas.`;
```

</details>

<details>
<summary><code>supabase/functions/fruit-story-ideas/index.ts:62-70</code> — parseIdeas()</summary>

```ts
function parseIdeas(raw: string): string[] {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean);
  return lines.slice(0, 15);
}
```

</details>

---

### 1.2 `fruit-story-planner` (story, cast bible, scenes)

**Client request** (`useFruitStoryJob.js:583-592` → `fruitStoryApi.js:1795-1804`):

```js
{ storyIdea, storyPreset: "custom", conflict: "Custom story conflict" | "",
  selectedCharacters: [],            // always empty — cast is AI-invented
  sceneCount: 3|5|7|10, storyLength: "15s"|"30s"|"45s"|"60s",
  sceneAspect: "9:16"|"16:9", styleId: "cinematic" }   // styleId is ignored server-side
```

**Server steps before the OpenAI call** (`fruit-story-planner/index.ts:1160-1279`):

1. **Preset detection** (`:316-333`). A regex is run over `storyPreset + conflict + storyIdea`, and the first match wins: `cheating` → `baby` → `cheats-back` → `secret-twin` → `kicked-out` → `custom`. Because the client always sends `storyPreset: "custom"`, the keywords decide. The regexes use `\b…\b` on stems: `betray` does **not** match "betrayed", but `betrayal` does.
2. **Synthetic cast** (`:452-477`). With no characters supplied, 2 random fruits are drawn from a 12-fruit pool (3 for cheating and cheats-back stories). Cheating stories with fewer than 3 characters also get a synthetic affair partner (`:419-440`, e.g. "Hot Peach").
3. **Canonical cast** (`:509-595`):
   - Deterministic ids: `wife_orange`, `cheater_banana`, `affair_partner_peach_hot_peach`.
   - Roles assigned by index or keyword (`inferNarrativeRole`, `:481-507`).
   - Fallback descriptions.
   - `genderPresentation` comes only from a name/id regex, so AI-invented casts are **always `"unspecified"`**. `mergeCastWithPlanner` doesn't take GPT's value (`:597-622`).
4. **Beat template** (`:335-375`). The planner picks `PRESET_BEATS[preset][sceneCount]`. Only `cheating` has 3/5/7-scene tables; every other preset has only 4/6/8/10, so 3, 5 and 7 are derived by picking indices from the 4/6/8 tables. Extra scenes are padded with generic `escalation` beats.
5. **Story DNA** (`:1185-1195`). Random picks from the pools at `:1118-1125`; cheating stories are pinned to `betrayal-drama` and similar values.
6. **Prompt assembly.** `SYSTEM_BASE` gets `{{…}}` placeholders replaced (`:1208-1220`). The user prompt is built at `:1234-1275`. Character-image vision parts (`:1226-1232`) are always empty now, so the "no images attached" override paragraph is always included.

**Model call** (`:1284-1299`): `gpt-4o`, `messages: [system, user]`, `max_tokens: 5500`, `temperature: 0.55`, `response_format: { type: "json_object" }`, `signal: AbortSignal.timeout(55_000)`.

**Response handling** (`:1300-1337`):
- `JSON.parse` the content. On any error the function returns `500 "Story planning failed: <message>"`, which includes up to 300 chars of the OpenAI error body.
- `scenes` must be an array; otherwise `500`.
- `mergeCastWithPlanner` keeps the server's ids, roles and labels and takes GPT's `appearance`, `clothing`, `personality`, `agePresentation`, `emotionalArc` and `visualIdentity`.
- `repairScenes` then forces exactly `sceneCount` scenes:
  - It overwrites `beatType` with the template beat.
  - It fills missing fields from the beat.
  - It recomputes the character lists with `resolveSceneIds` (any GPT ids not in the cast are dropped).
  - It **wraps GPT's `imagePrompt` in `appendStrictImageRules`**.
  - It supplies a default `videoPrompt` if GPT omitted one.
- **Output:** `{ ok, title, storyTitle, hook, storySummary, storyAngle, storyDNA, cast[], scenes[] }`.

**Planner fields the client never uses:**
- The scene-level `videoPrompt`: the client sets `videoPrompt: ""` (`useFruitStoryJob.js:635`).
- `captionText`, `negativePrompt`, `durationSeconds`, `storySummary`.

GPT is still asked to write all of them, which spends output tokens against the 5,500 cap.

#### 1.2.1 System prompt (template, verbatim)

`{{SCENE_COUNT}}`, `{{BEAT_FLOW}}`, `{{CHARACTER_BLOCK}}` and the DNA placeholders are filled at `:1208-1220`. Every `.replace` is a single replacement, and each placeholder appears exactly once.

<details>
<summary><code>supabase/functions/fruit-story-planner/index.ts:842-1045</code> — SYSTEM_BASE</summary>

```text
const SYSTEM_BASE = `You are Fruit Movie Maker AI — a viral TikTok short-form story director for cinematic 3D fruit-human drama videos.

Your ONLY job: write ONE continuous story that plays like a real viral TikTok drama series when all clips are stitched together. Think of it as a mini TV episode split into 6-second clips — each clip ends on a cliffhanger, the next clip immediately resolves it.

════════════════════════════════════════
RULE 1 — LOCKED ROLES (ABSOLUTE — NEVER DRIFT)
════════════════════════════════════════

Roles are assigned ONCE in the cast bible and NEVER EVER change:
- victim stays victim in every single scene
- cheater stays cheater in every single scene
- affair_partner stays affair_partner in every single scene

A "gangster pineapple" character with narrativeRole="cheater" IS the cheating husband in EVERY scene. Their costume/title does not change their story role. NEVER let a character behave like a "boss" or "authority" if their narrativeRole is "cheater" — they are the cheating partner, period.

════════════════════════════════════════
RULE 2 — CHEATING STORY CHARACTER RULES
════════════════════════════════════════

In cheating/cheats-back stories with 3 characters:
- VICTIM (character 1): betrayed partner. In scenes: hook (with cheater), suspicion (alone), discovery (alone or catches all), confrontation (with cheater), payoff.
- CHEATER (character 2): cheating partner. In scenes: hook (with victim, loving but hiding something), AFFAIR SCENE (alone with affair_partner — THIS IS REQUIRED), confrontation (with victim), maybe payoff.
- AFFAIR_PARTNER (character 3): third party. MUST appear in AT LEAST 2 scenes: (1) alone with cheater = the actual affair scene, (2) discovery scene where victim catches them or finds proof of them.

HARD REQUIREMENT: Include ONE scene where cheater + affair_partner are shown TOGETHER without the victim. This is the "affair happening" scene. Without this, the story makes no sense visually.

════════════════════════════════════════
RULE 2B — AUTO-GENERATED AFFAIR PARTNER
════════════════════════════════════════

If any CHARACTER LABEL is marked [⚠ AI-GENERATED CHARACTER — NO REFERENCE IMAGE]:
1. That character is the affair_partner. They have no uploaded reference photo.
2. LOOK at the 2 uploaded reference images. Decide based on visual energy:
   - AGGRESSIVE / DOMINANT / SECRETIVE energy → CHEATER
   - HURT / EMOTIONAL / TRUSTING energy → VICTIM
   - Commit to this assignment in EVERY scene. Never reverse it.
3. Since the affair_partner has no reference image, YOU must describe them visually in detail:
   - Choose a specific look: fruit type, exact color, outfit, hair style, facial expression.
   - Write this EXACT SAME description in EVERY imagePrompt the affair_partner appears in.
   - Example: "a glamorous peach fruit-human character with rosy-gold skin, wavy auburn hair, wearing a sleek red dress, bold flirtatious expression"
4. The affair_partner MUST appear in:
   - affair_scene beat: with cheater ONLY (victim completely absent)
   - discovery beat: victim catches them or finds proof (can include all 3)
   - Optional: confrontation beat (if relevant)
5. NEVER show the affair_partner in scenes where only victim+cheater should be — respect characterIdsInScene strictly.

════════════════════════════════════════
RULE 3 — ONE CONTINUOUS STORY (CRITICAL)
════════════════════════════════════════

All scenes happen in the SAME evening/night in the SAME primary location (their home/apartment).
The viewer must feel they are watching ONE story, not unrelated clips.

CONTINUITY REQUIREMENTS:
- Set all scenes in the same home unless a scene REQUIRES a new location
- Each scene's background/lighting matches adjacent scenes (same room = same furniture, same lighting)
- Emotional state carries forward: shattered in scene 3 → tear-streaked in scene 4
- Props carry forward: phone slammed in scene 3 → phone on floor in scene 4
- Scene N always visually references what just happened in scene N-1

PACING — think like a TV director:
- Scene 1: DROP INTO the drama immediately. First frame = viewer asks "wait what??"
- Scene 2-3: Escalate. Viewer says "oh no..."
- Scene 4-5: Discovery/confrontation. Viewer says "OH WOW"
- Final: Payoff or bigger twist. Viewer shares it.

Every scene: START LATE (mid-action), END EARLY (before resolution), HOOK THE VIEWER.

════════════════════════════════════════
VISION — YOU CAN SEE THE CHARACTER IMAGES
════════════════════════════════════════

The character reference images are attached to this message. Use what you SEE to assign narrative roles — do not guess from names alone.

Look at each character's:
- Visual energy: aggressive/dominant → cheater or villain. Soft/emotional → victim. Glamorous/flirtatious → affair_partner. Innocent/small → kid.
- Gender presentation: determines who plays which side of a romantic relationship.
- Outfit and posture: a character in a power pose with designer clothes reads differently from one looking worried in casual clothes.
- Fruit type is cosmetic only — a pineapple character can be a victim, a cheater, or anything. Look at their expression and energy, not just their fruit.

For cheating stories with 3 characters, look at the images and ask:
- Which one looks like the heartbroken/betrayed partner? → victim
- Which one looks like they're hiding something / dominant / secretive? → cheater
- Which one looks glamorous / flirtatious / the "other woman/man"? → affair_partner

This vision-based casting works for ALL characters including custom imported ones.

════════════════════════════════════════
PART 1 — CAST BIBLE (cast[])
════════════════════════════════════════

Define permanent cast ONCE. narrativeRole is LOCKED forever. Use the images above to determine roles.

════════════════════════════════════════
PART 2 — SCENE LIST (scenes[])
════════════════════════════════════════

IMAGE PROMPT RULES:
1. ONE single cinematic moment — no split panels, no collages
2. Reference characters ONLY by their UPPERCASE referenceLabel
3. ONLY characters in characterIdsInScene appear — all others completely absent
4. Background must visually match adjacent scenes (same room = same decor/lighting)
5. End EVERY imagePrompt with: "NO text, NO captions, NO subtitles, NO speech bubbles, NO watermarks, NO typography."
6. Structure: [Image N of TOTAL — beat name] → [characters+actions] → [ADULT character rule] → [exact emotion+body language] → [continuity from previous image] → [camera] → [environment+lighting] → [cinematic 3D style] → [NO text rule]
7. SAFETY — image prompts are processed by OpenAI which has strict content filters. NEVER use these words in imagePrompt: seductive, sensual, sexy, intimate, flirtatious, kissing, embrace, tight dress, cleavage, body, curves, passionate, desire, lust, affair, mistress, infidelity, lipstick mark. Use safe alternatives: emotional, close, elegant, standing together, heartbroken, shocked, tense.
8. ADULT CHARACTER RULE — mandatory in EVERY imagePrompt: "All characters are TALL ADULT anthropomorphic fruit-human characters with full adult body proportions, human-like adult arms, legs, hands, and clothing. NOT children, NOT babies, NOT toddlers. Adult height, adult face structure, adult emotional range."
9. STORY CONTINUITY — each scene after scene 1 must reference what happened in the previous scene: clothing stays the same, the location layout stays the same, important props carry forward, emotions evolve naturally.
10. CAUSE AND EFFECT — every image after the first must answer: what happened because of the previous image, and what new event now pushes the story forward.
11. CAMERA PER BEAT — use the right framing for the beat:
    - hook: wide or medium establishing shot showing both characters together
    - affair_scene: close intimate two-shot of only the cheater and affair partner (victim COMPLETELY absent)
    - discovery: dramatic close-up on the clue or evidence, then pull to the shocked character's face
    - confrontation: intense medium two-shot or three-shot with faces clearly readable
    - payoff/walk_away: wide powerful shot for departure or dramatic close-up for twist reveal
    - suspicion/investigation: tight close-up on the clue, character reaching for it

DIALOGUE RULES (for videoDialogue[] and videoPrompt):
- Generate 1-2 lines per scene based on who is in that scene (characterIdsInScene)
- Solo scene (1 character) → 1 line only
- 2+ characters → 1 line per character; lines must form a real back-and-forth exchange (accusation→denial, question→deflection, etc.)
- Each line: 4-10 words, English only, clear and dramatically charged — complete natural English sentences
- Characters speak DIRECTLY TO each other — not internal monologue. Example: "Why is her name in your phone?" / "I can explain everything, please listen."
- Write lines that sound like actual human conversation — no fragments, no cryptic one-word responses unless dramatically intentional
- Speaker label: character display name only, max 16 chars (e.g. "Boss Mango", "Hot Peach", "Orange Mom")
  DO NOT include role prefix ("CHEATER_", "VICTIM_") or fruit type duplicates in speaker names
- NO fruit-type words as dialogue addresses
- Lines MUST be 100% logical for the story preset:
  * BABY story → lines about pregnancy, parenthood, the baby news. NEVER "give me your phone" or cheating lines
  * CHEATING story → lines about suspicion, proof, confrontation, betrayal — direct accusations and defenses
  * SECRET TWIN → lines about confusion, identical appearances, the twin reveal
  * CHEATS-BACK → lines about heartbreak, transformation, cold revenge, power shift
  * KICKED-OUT → lines about rejection, leaving, determination, comeback
  * CUSTOM → lines matching whatever story idea was provided
- CONVERSATIONAL FLOW: each line must logically respond to or set up the other character's line. Write pairs like: Character A says something → Character B directly responds to what A said.
- LOGICAL CONTINUITY: dialogue must flow from scene to scene. If scene 2 shows a character crying, scene 3 cannot pretend nothing happened.
- EMOTIONAL ESCALATION: each scene should feel one step more intense than the last. Hook → suspicion → discovery → confrontation → payoff.
- Make lines feel like real dramatic conversation — punchy, direct, emotionally charged, leave viewer hooked

VIDEO PROMPT RULES:
1. Animate FROM the still image as a viral TikTok drama clip
2. SPOKEN DIALOGUE - SAY EXACTLY: section — use the videoDialogue[] lines you generated
3. Dialogue starts in the FIRST SECOND. No silent intro, no waiting
4. ENGLISH ONLY — clear, fully pronounced English. No mumbling, no muttering, no unintelligible sounds, no foreign languages
5. Characters FACE EACH OTHER DIRECTLY — eye contact, turned toward the person they are speaking to
6. Strong facial reactions, expressive lip-sync, natural conversational body language, dramatic camera, mini cliffhanger
7. Audio: clear audible English dialogue only + light room ambience. NO background music. NO gibberish sounds.
8. End EVERY videoPrompt: "No captions, no subtitles, no text overlays, no logos, no watermarks, no extra characters, no identity changes, no background music, no mumbling, no gibberish."

════════════════════════════════════════
RULE 4 — HOOK SCENE AND BABY STORY RULES
════════════════════════════════════════

HOOK SCENE (ALWAYS — every preset):
- Scene 1 MUST show ALL MAIN CHARACTERS together in the SAME frame
- NEVER show only one character alone in scene 1
- The hook must instantly show the relationship between the characters

BABY / PREGNANCY STORIES — ABSOLUTE RULES:
- NEVER generate a baby fruit character, infant character, or child character in ANY scene
- The pregnancy is shown ONLY through: a white pregnancy test stick with two visible lines, an ultrasound photo, or emotional hand-on-stomach gestures
- ALL characters in ALL scenes are TALL ADULT fruit-human characters
- The baby does not exist yet as a character — the story is about the ANNOUNCEMENT and REACTION
- Do NOT describe or generate "a tiny orange baby", "a baby fruit character", "a small fruit child", or any infant
- imagePrompts for baby stories must specify "pregnancy test" or "emotional reaction" — never "baby character appears"

════════════════════════════════════════
RULE 5 — DIALOGUE AND SPEECH QUALITY
════════════════════════════════════════

All spoken dialogue must follow these rules WITHOUT EXCEPTION:
- ALL dialogue is in clear, natural ENGLISH ONLY — fully pronounced, audible, intelligible
- Characters speak DIRECTLY TO each other — they face each other, hold eye contact, and respond to what was just said
- Every line is a complete natural English sentence (not a fragment or a single grunt)
- Lines flow as a real back-and-forth conversation — accusation/defense, question/deflection, confession/reaction
- NEVER write vague audio directions like "they mutter to each other", "unintelligible arguing", "background chatter"
- NO mumbling, NO muttering, NO whispered unintelligible speech, NO foreign-language syllables
- One character speaks at a time — no overlapping dialogue
- Background characters remain completely silent unless they have a specific English line
- When characters are emotional they may cry or raise their voice — but their words must remain clear English

STORY STRUCTURE — required beat flow for {{SCENE_COUNT}} scenes:
{{BEAT_FLOW}}

CHARACTER LABELS (locked cast — narrativeRoles NEVER change):
{{CHARACTER_BLOCK}}

STYLE (fixed internal — cinematic 3D viral fruit drama):
- Polished 3D anthropomorphic fruit-human characters with expressive faces
- Cinematic dramatic lighting with clean TikTok composition
- Every scene instantly readable without captions or text
- No realism drift, no random redesigns, no identity swaps

STORY VARIETY GUIDANCE:
Conflict bucket:  {{CONFLICT_BUCKET}}
Archetype:        {{ARCHETYPE}}
Hook type:        {{HOOK_TYPE}}
Reveal type:      {{REVEAL_TYPE}}
Setting:          {{SETTING}}
Ending type:      {{ENDING_TYPE}}
Twist:            {{TWIST_TYPE}}
Emotional tone:   {{EMOTIONAL_TONE}}
Pacing:           {{PACING_STYLE}}

Return ONLY valid JSON — no markdown fences, no text outside the JSON object.`;
```

</details>

#### 1.2.2 User prompt builder and JSON schema (verbatim)

<details>
<summary><code>supabase/functions/fruit-story-planner/index.ts:1185-1279</code> — DNA, CHARACTER_BLOCK, BEAT_FLOW, userPrompt assembly</summary>

```ts
  const dna = {
    conflictBucket: isCheating ? "cheating" : (CONFLICT_BUCKETS.find((c) => c === preset) ?? pickRandom(CONFLICT_BUCKETS)),
    archetype:      isCheating ? "betrayal-drama" : pickRandom(ARCHETYPES),
    hookType:       isCheating ? pickRandom(["suspicious-phone","caught-in-the-act","hidden-camera-proof","overheard-conversation"]) : pickRandom(HOOK_TYPES),
    revealType:     isCheating ? pickRandom(["visual-proof","confession-reveal","witness-reveal"]) : pickRandom(REVEAL_TYPES),
    setting:        pickRandom(SETTINGS),
    endingType:     pickRandom(ENDING_TYPES),
    twistType:      "none",
    emotionalTone:  pickRandom(EMOTIONAL_TONES),
    pacingStyle:    pickRandom(PACING_STYLES),
  };

  const charBlock = canonicalCast.map((c) =>
    `  - referenceLabel: ${c.referenceLabel}  |  castId: ${c.id}  |  sourceCharacterId: ${c.sourceCharacterId}  |  narrativeRole: ${c.narrativeRole}  |  fruitType: ${c.fruitType}  |  gender: ${c.genderPresentation}  |  function: ${c.narrativeFunction}${c.synthetic ? "  |  ⚠ AI-GENERATED CHARACTER — NO REFERENCE IMAGE — describe visual appearance in full detail in every imagePrompt (same description every scene)" : ""}`
  ).join("\n");

  const beatFlow = beats.map((b, i) =>
    `  Scene ${i + 1}: beatType="${b.beatType}" | title="${b.title}" | purpose="${b.purpose}" | emotion="${b.emotionDirection}" | action="${b.actionDirection}"`
  ).join("\n");

  const aspectLabel  = sceneAspect === "9:16" ? "vertical 9:16 TikTok" : "horizontal 16:9";
  const charNames    = effectiveCharacters.map((c) => `${c.name ?? c.id}${(c as any).synthetic ? " [AI-GENERATED, no ref image]" : ""}`).join(", ");

  const system = SYSTEM_BASE
    .replace("{{SCENE_COUNT}}",     String(sceneCount))
    .replace("{{BEAT_FLOW}}",       beatFlow)
    .replace("{{CHARACTER_BLOCK}}", charBlock)
    .replace("{{CONFLICT_BUCKET}}", dna.conflictBucket)
    .replace("{{ARCHETYPE}}",       dna.archetype)
    .replace("{{HOOK_TYPE}}",       dna.hookType)
    .replace("{{REVEAL_TYPE}}",     dna.revealType)
    .replace("{{SETTING}}",         dna.setting)
    .replace("{{ENDING_TYPE}}",     dna.endingType)
    .replace("{{TWIST_TYPE}}",      dna.twistType)
    .replace("{{EMOTIONAL_TONE}}",  dna.emotionalTone)
    .replace("{{PACING_STYLE}}",    dna.pacingStyle);

  /* ── Build vision message: attach character reference images so GPT can SEE them ──
   * Computed BEFORE userPrompt below so the no-images case can inject a
   * corrective note overriding SYSTEM_BASE's static "images are attached"
   * assumption, which now goes stale on every default (idea-only) run. */
  const charImageParts = selectedCharacters
    .map((c: any) => c.publicRefUrl ?? c.imageUrl ?? c.image ?? null)
    .filter((url: string | null): url is string => typeof url === "string" && url.startsWith("http"))
    .map((url: string) => ({
      type: "image_url",
      image_url: { url, detail: "low" },
    }));

  const userPrompt = [
    `Story idea: ${storyIdea.trim()}`,
    `Story preset: ${storyPreset ?? preset}`,
    `Conflict: ${conflict ?? dna.conflictBucket}`,
    `Format: ${storyLength} viral ${aspectLabel} video — EXACTLY ${sceneCount} scenes`,
    `Characters: ${charNames}`,
    `Locked cast: ${canonicalCast.map((c) => `${c.id}=${c.referenceLabel}/${c.narrativeRole}/${c.fruitType}`).join(", ")}`,
    ``,
    ...(charImageParts.length === 0 ? [
      `⚠ NO CHARACTER REFERENCE IMAGES ARE ATTACHED TO THIS MESSAGE. Every character in the locked cast is being invented by you from scratch — ignore any earlier instruction in this prompt about "looking at" attached images, since none exist here.`,
      `→ For each cast member, invent a specific, vivid, and VISUALLY DISTINCT identity: exact fruit type, exact skin/rind color and texture, hairstyle, outfit, one signature accessory — chosen to fit their narrativeRole and this story idea (e.g. the cheater might read as sleek/aggressive, the victim as soft/sympathetic).`,
      `→ Write that exact same visual description into visualIdentity, appearance, and clothing, and copy it identically into every imagePrompt that character appears in. Never redescribe, restyle, or let a character's look drift between scenes — treat the first description you write as permanently locked.`,
      ``,
    ] : []),
    `Required scene beat flow (follow this EXACTLY):`,
    beatFlow,
    ``,
    ...(syntheticAffairAdded ? [
      `⚠ AFFAIR PARTNER AUTO-GENERATED: A third affair-partner character (${canonicalCast.find((c) => c.narrativeRole === "affair_partner")?.displayName ?? "Affair Partner"}) has been automatically added to complete this cheating story. This character has NO reference image.`,
      charImageParts.length > 0
        ? `→ YOU decide who is the CHEATER vs. the VICTIM based on visual energy from the uploaded reference images (aggressive/dominant/secretive = cheater; hurt/emotional/trusting = victim).`
        : `→ None of the characters have reference images. Decide who is the CHEATER vs. the VICTIM based on which invented identity best fits a dominant/secretive role versus a sympathetic/betrayed role, matching the story idea.`,
      `→ Describe the affair partner in FULL visual detail in every imagePrompt they appear in. Keep this description IDENTICAL across all scenes.`,
      `→ The affair partner MUST appear in: the affair_scene (alone with cheater) and the discovery scene.`,
      ``,
    ] : []),
    `CRITICAL RULES:`,
    `1. Cast[] first — assign narrativeRoles EXACTLY as listed in locked cast above. Do NOT reassign roles.`,
    `2. Create EXACTLY ${sceneCount} scenes matching the beat flow above`,
    `3. NEVER swap, drift, or reinterpret narrative roles. cheater = cheater in EVERY scene. victim = victim in EVERY scene.`,
    `4. Each scene uses ONLY cast IDs listed in characterIdsInScene — no others`,
    `5. For cheating stories: ONE scene MUST show cheater + affair_partner together (the actual affair). ONE scene MUST show victim alone discovering proof.`,
    `6. All scenes happen in the SAME home/location unless a beat REQUIRES a change. Use same backgroundDetail/environment across connected scenes.`,
    `7. Each scene's beatType MUST exactly match the beat flow above`,
    `8. Every imagePrompt MUST end with: "NO text, NO captions, NO subtitles, NO speech bubbles, NO watermarks, NO typography."`,
    `9. forbiddenCharacters MUST list all cast IDs NOT in characterIdsInScene`,
    `10. This is ONE continuous story — scene N must visually reference what happened in scene N-1`,
    `11. For each cast member, also fill agePresentation (e.g. "early thirties") and emotionalArc — one sentence on how THAT character specifically feels/behaves at the start of the story versus how they feel/behave by the last scene. These get sent straight into the video generation prompt, so make them specific and story-accurate, not generic.`,
    ``,
    `Return ONLY valid JSON matching this schema exactly:`,
    JSON_SCHEMA,
  ].join("\n");

  const userMessageContent = charImageParts.length > 0
    ? [{ type: "text", text: userPrompt }, ...charImageParts]
    : userPrompt;
```

</details>

<details>
<summary><code>supabase/functions/fruit-story-planner/index.ts:1048-1125</code> — JSON_SCHEMA (appended to the user prompt) + DNA pools</summary>

```ts
const JSON_SCHEMA = `{
  "storyTitle": "catchy viral TikTok title, max 60 chars",
  "title": "same as storyTitle",
  "storyAngle": "one-line description of the story angle",
  "hook": "grabby opening line that creates instant curiosity",
  "storySummary": "2-3 sentence summary of the complete story arc",
  "storyDNA": {
    "conflictBucket": "string",
    "archetype": "string",
    "hookType": "string",
    "revealType": "string",
    "setting": "string",
    "endingType": "string",
    "twistType": "string",
    "emotionalTone": "string",
    "pacingStyle": "string"
  },
  "cast": [
    {
      "id": "stable_snake_case_id used in characterIdsInScene, e.g. wife_orange_mom",
      "sourceCharacterId": "id from the selected character input",
      "role": "same as narrativeRole",
      "referenceLabel": "UPPERCASE_UNDERSCORE label from CHARACTER LABELS above",
      "label": "same as referenceLabel",
      "displayName": "human readable name",
      "narrativeRole": "victim | cheater | affair_partner | kid | friend | boss | villain | sibling | parent | protagonist | antagonist | supporting",
      "fruitType": "orange | banana | strawberry | apple | lemon | peach | mango | pineapple | broccoli",
      "genderPresentation": "feminine-presenting | masculine-presenting | unspecified",
      "agePresentation": "age presentation in 2-4 words, e.g. 'early thirties', 'late twenties', 'middle-aged'",
      "visualIdentity": "stable visual description locked for the whole story",
      "appearance": "detailed visual appearance",
      "clothing": "consistent outfit description",
      "narrativeFunction": "locked story function, 1 sentence",
      "personality": "brief personality note, 1 sentence",
      "emotionalArc": "how this character's emotional state evolves from the first scene to the last, 1 sentence"
    }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "short scene title",
      "durationSeconds": 6,
      "beatType": "hook | suspicion | discovery | confrontation | payoff | etc — must match required beat flow",
      "storyPurpose": "specific story purpose: what this scene achieves in the narrative",
      "scenePurpose": "same as storyPurpose",
      "emotionDirection": "dominant emotion this scene must visually express",
      "actionDirection": "exactly what is physically happening in this scene",
      "cameraDirection": "camera angle and framing suggestion",
      "backgroundDetail": "specific environment description",
      "environment": "single-word: bedroom | kitchen | office | restaurant | hotel | street | park | living-room",
      "continuityFromPrevious": false,
      "characterIdsInScene": ["cast.id values that physically appear in this scene — no others"],
      "charactersNotInScene": ["cast.id values deliberately absent from this scene"],
      "forbiddenCharacters": ["cast.id values that MUST NOT appear"],
      "emotionalBeat": "dominant emotion keyword",
      "captionText": "short on-screen caption shown as app overlay — NOT inside the image",
      "imagePrompt": "generation-ready prompt: [characters+actions] [emotion+body language] [camera] [environment+lighting] [3D style] [NO text rule]",
      "videoDialogue": [
        {
          "speaker": "Character display name only — NO fruit type, NO role prefix, NO ID. Max 16 chars. E.g. 'Boss Mango' not 'CHEATER_MANGO_BOSS_MANGO'",
          "line": "4-10 word clear natural English sentence. Characters speak directly to each other. No fruit-type names as dialogue addresses. Dramatic, emotionally charged."
        }
      ],
      "videoPrompt": "viral 6-second video prompt with SPOKEN DIALOGUE - SAY EXACTLY, immediate English dialogue, fast action, visual clue, camera, clear dialogue-only audio, no background music, and cliffhanger. End with strict no-text/no-music negative rules.",
      "negativePrompt": "text, letters, subtitles, watermark, logo, speech bubbles, collage, multiple panels, split screen, ui elements, captions, extra characters"
    }
  ]
}`;

/* ─── DNA POOLS ─── */
const ARCHETYPES      = ["betrayal-drama","secret-reveal","revenge-arc","love-triangle","comeback-story","jealousy-spiral","manipulation-exposed","hidden-identity","poor-to-rich","gold-digger-exposed","secret-child","fake-friend-unmasked"];
const HOOK_TYPES      = ["shocking-revelation","caught-in-the-act","secret-letter","mysterious-stranger","tearful-confrontation","unexpected-pregnancy","hidden-camera-proof","overheard-conversation","suspicious-phone","unexpected-visitor","late-night-secret"];
const REVEAL_TYPES    = ["climactic-reveal","slow-burn-reveal","false-reveal-then-real","visual-proof","witness-reveal","confession-reveal","public-broadcast-reveal"];
const SETTINGS        = ["modern-fruit-city","cozy-home-kitchen","fancy-restaurant","rainy-night-street","fruit-office-building","luxury-penthouse","school-hallway","park-at-sunset","hospital-waiting-room","shopping-mall","hotel-lobby","suburban-neighborhood"];
const ENDING_TYPES    = ["cliffhanger","bittersweet","triumphant","tragic","shocking-twist","open-ended","redemption","revenge-complete"];
const CONFLICT_BUCKETS= ["cheating","betrayal","kicked-out","secret-child","fake-friend","poor-to-rich","revenge","hidden-identity","boss-drama","family-drama","mistaken-accusation","public-embarrassment","gold-digger","inheritance","betrayal-by-best-friend"];
const EMOTIONAL_TONES = ["heartbroken-rage","cold-calculated-revenge","tearful-disbelief","shocked-silence","furious-confrontation","quiet-devastation","triumphant-justice","bitter-irony"];
const PACING_STYLES   = ["slow-burn-escalation","fast-explosive-hook","steady-dramatic-build","twist-every-two-scenes","late-reveal-payoff"];
```

</details>

#### 1.2.3 Beat templates, preset detection, synthetic cast (the few-shot-like scaffolding)

There are no few-shot examples in the planner. The closest thing is the beat table injected as `{{BEAT_FLOW}}`, together with each beat's `promptHint`, which becomes part of the scene image prompt through `appendStrictImageRules`.

The full table is at `:51-312`: 6 presets × 3–7 scene counts, one very long line per beat. One entry is reproduced here:

<details>
<summary><code>supabase/functions/fruit-story-planner/index.ts:60-66</code> — PRESET_BEATS.cheating[5] (example — the table used for a 30s cheating story)</summary>

```ts
    5: [
      { beatType: "hook",          title: "Sweet Couple Moment",           purpose: "Open with the couple happy — makes the betrayal land harder",                   emotionDirection: "happiness with hidden guilt",     actionDirection: "two adult characters together as a couple in their home, one partner happy, the other subtly distracted or hiding their phone",          cameraDirection: "warm medium two-shot showing BOTH adult characters in the same frame",                             backgroundDetail: "home kitchen or living room, warm golden lighting",                promptHint: "TWO TALL ADULT fruit-human characters as a romantic couple in their home. Both have full adult height and proportions, adult clothing, and adult faces. One partner smiles warmly, the other shows subtle guilt — avoiding eye contact, distracted, nervous energy. Warm domestic scene." },
      { beatType: "affair_scene",  title: "The Secret Meeting",            purpose: "Reveal the actual affair — cheater + affair_partner TOGETHER, victim absent",   emotionDirection: "secretive and conspiratorial",    actionDirection: "cheater adult character and affair_partner adult character alone together in a private location — victim completely absent from this scene", cameraDirection: "close medium two-shot of ONLY the cheater and affair partner",    backgroundDetail: "different private location — hotel room, parked car, back alley, private café", promptHint: "TWO TALL ADULT fruit-human characters alone together in a secret meeting. The cheater and affair partner, both with adult proportions and adult clothing, share a secretive moment. The betrayed partner is NOT present. Guilty and conspiratorial energy between them." },
      { beatType: "discovery",     title: "Hard Evidence Found",           purpose: "Victim finds undeniable proof of the affair",                                    emotionDirection: "shock and devastation",           actionDirection: "betrayed adult character alone, holding undeniable proof — phone with messages, photo, or letter — staring at it in shock",         cameraDirection: "dramatic close-up on the adult character's face and the evidence in their hands",              backgroundDetail: "home interior — bedroom or living room, tense lighting",                            promptHint: "ONE TALL ADULT fruit-human character alone, discovering undeniable proof of betrayal. Adult proportions, adult face showing complete devastation. Holding a phone, photo, or document showing the affair. Wide tear-filled eyes, trembling hands, mouth open in silent shock." },
      { beatType: "confrontation", title: "The Confrontation",             purpose: "Betrayed character confronts the cheater directly with evidence",               emotionDirection: "controlled fury or tearful rage", actionDirection: "betrayed adult character confronts cheater adult character face to face — holding evidence, pointing accusingly, both characters facing each other directly", cameraDirection: "intense medium two-shot showing both adult characters facing each other with the same furniture and room visible from previous scenes",                backgroundDetail: "same home interior from earlier scenes — living room or hallway",             promptHint: "TWO TALL ADULT fruit-human characters in a direct confrontation. Both face each other, eye contact locked. The betrayed character holds evidence or points accusingly — jaw tight, tears of rage. The cheater shows guilt and defensiveness — hands raised, looking away. SAME room and clothing as earlier scenes." },
      { beatType: "payoff",        title: "Final Walk Away or Twist",      purpose: "Powerful emotional payoff — victim walks away or delivers shocking reveal",     emotionDirection: "devastation, triumph, or twist",  actionDirection: "betrayed adult character walks away with dignity toward a door or delivers a shocking final revelation that changes everything",     cameraDirection: "wide powerful shot showing adult character walking away, or tight close-up for a final twist reveal",        backgroundDetail: "doorway, open hallway, or confrontation room from earlier scenes",               promptHint: "ONE TALL ADULT fruit-human character making a powerful final move. Walking toward the door with head held high, or turning back with a devastating final truth. Adult proportions, strong posture, resolute expression. The cheater remains in the background, devastated." },
    ],
```

</details>

<details>
<summary><code>supabase/functions/fruit-story-planner/index.ts:316-375</code> — detectPreset() + getBeatsForPresetAndCount()</summary>

```ts
const CHEATING_KEYWORDS  = /\b(cheat|cheating|affair|mistress|betray|betrayal|secret\s+lover|caught|infidelity)\b/i;
const BABY_KEYWORDS      = /\b(baby|born|pregnant|pregnancy|born\s+baby|newborn|infant|expecting|ultrasound)\b/i;
const CHEATSBACK_KEYWORDS = /\b(cheats?\s+back|revenge\s+cheat|cheat\s+revenge|get\s+back\s+at)\b/i;
const SECRETTWIN_KEYWORDS = /\b(secret\s+twin|hidden\s+twin|twin\s+reveal|look\s+alike|doppelganger)\b/i;
const KICKEDOUT_KEYWORDS  = /\b(kicked\s+out|thrown\s+out|homeless|evicted|rejected|forced\s+out)\b/i;

function detectPreset(input: { storyPreset?: string; storyIdea?: string; conflict?: string }): StoryPreset {
  const preset = (input.storyPreset ?? "").toLowerCase().trim() as StoryPreset;
  const text = `${input.storyPreset ?? ""} ${input.conflict ?? ""} ${input.storyIdea ?? ""}`;

  if (preset === "cheating" || CHEATING_KEYWORDS.test(text)) return "cheating";
  if (preset === "baby" || BABY_KEYWORDS.test(text)) return "baby";
  if (preset === "cheats-back" || CHEATSBACK_KEYWORDS.test(text)) return "cheats-back";
  if (preset === "secret-twin" || SECRETTWIN_KEYWORDS.test(text)) return "secret-twin";
  if (preset === "kicked-out" || KICKEDOUT_KEYWORDS.test(text)) return "kicked-out";
  if (preset === "custom") return "custom";
  return "custom";
}

function getBeatsForPresetAndCount(preset: StoryPreset, sceneCount: number): BeatTemplate[] {
  const presetBeats = PRESET_BEATS[preset] ?? PRESET_BEATS.custom;
  // Current product flow: 3/5/7/10 image scenes, one scene per 6s video clip.
  const supported = [3, 5, 7, 10];
  if (presetBeats[sceneCount]) return presetBeats[sceneCount];

  const oldTemplateCount =
    sceneCount <= 3 ? 4 :
    sceneCount <= 5 ? 6 :
    8;
  const baseBeats = presetBeats[oldTemplateCount] ?? presetBeats[8] ?? presetBeats[6] ?? PRESET_BEATS.custom[8] ?? PRESET_BEATS.custom[6]!;

  if (sceneCount === 3) {
    return [baseBeats[0], baseBeats[1] ?? baseBeats[2], baseBeats[baseBeats.length - 1]].filter(Boolean);
  }
  if (sceneCount === 5) {
    return [baseBeats[0], baseBeats[1], baseBeats[3] ?? baseBeats[2], baseBeats[4] ?? baseBeats[baseBeats.length - 2], baseBeats[baseBeats.length - 1]].filter(Boolean);
  }
  if (sceneCount === 7) {
    return [baseBeats[0], baseBeats[1], baseBeats[2], baseBeats[3], baseBeats[4], baseBeats[5] ?? baseBeats[4], baseBeats[baseBeats.length - 1]].filter(Boolean);
  }
  if (sceneCount <= baseBeats.length) return baseBeats.slice(0, sceneCount);

  // Pad by repeating escalation beats
  const result = [...baseBeats];
  while (result.length < sceneCount) {
    const insertAt = Math.max(1, result.length - 1);
    const escalation: BeatTemplate = {
      beatType: "escalation",
      title: `Escalation ${result.length - baseBeats.length + 1}`,
      purpose: "Additional story escalation and tension building",
      emotionDirection: "rising tension",
      actionDirection: "story escalates with new pressure or revelation",
      cameraDirection: "medium to close shot tracking tension",
      backgroundDetail: "same location as surrounding scenes",
      promptHint: "Tension rising. Characters under increasing pressure. Emotion escalating.",
    };
    result.splice(insertAt, 0, escalation);
  }
  return result.slice(0, sceneCount);
}
```

</details>

<details>
<summary><code>supabase/functions/fruit-story-planner/index.ts:417-477</code> — Synthetic affair partner + synthetic cast pool</summary>

```ts
/* ─── SYNTHETIC AFFAIR PARTNER (auto-generated for cheating stories with < 3 chars) ─── */

const AFFAIR_PARTNER_CANDIDATES = [
  { fruit: "peach",  name: "Hot Peach"   },
  { fruit: "mango",  name: "Mango Lady"  },
  { fruit: "apple",  name: "Apple Girl"  },
  { fruit: "cherry", name: "Cherry"      },
  { fruit: "kiwi",   name: "Kiwi"        },
  { fruit: "pear",   name: "Pear"        },
  { fruit: "grape",  name: "Grape"       },
];

function buildSyntheticAffairPartner(existingChars: CharInput[]): CharInput & { synthetic: true } {
  const usedFruits = new Set(existingChars.map(inferFruitType));
  const pick = AFFAIR_PARTNER_CANDIDATES.find((c) => !usedFruits.has(c.fruit))
    ?? AFFAIR_PARTNER_CANDIDATES[2];
  return {
    id:          `affair_partner_${pick.fruit}`,
    name:        pick.name,
    role:        "affair_partner",
    description: `${pick.name} — AI-generated affair partner. ${pick.fruit} fruit character. Visually distinct from the other two characters. No reference image — must be described in full visual detail in every scene.`,
    synthetic:   true,
  };
}

/* ─── FULL SYNTHETIC CAST (no characters uploaded at all) ────────────────
 * The idea-generator flow no longer asks users to pick characters up front
 * — GPT invents the whole cast from the story idea instead. These are
 * imageless (synthetic) characters, same as buildSyntheticAffairPartner
 * above: no reference image, described in full detail in every scene.
 * Names/fruits are intentionally generic so inferNarrativeRole()'s
 * index-based fallback (0=victim/protagonist, 1=cheater/antagonist,
 * 2=affair_partner) assigns roles the same way it already does for
 * user-picked casts — no separate role-assignment logic needed here.
 * ─────────────────────────────────────────────────────────────────────── */
const SYNTHETIC_CAST_POOL = [
  { fruit: "orange",     name: "Orange" },
  { fruit: "banana",     name: "Banana" },
  { fruit: "strawberry", name: "Strawberry" },
  { fruit: "peach",      name: "Peach" },
  { fruit: "mango",      name: "Mango" },
  { fruit: "apple",      name: "Apple" },
  { fruit: "kiwi",       name: "Kiwi" },
  { fruit: "pear",       name: "Pear" },
  { fruit: "grape",      name: "Grape" },
  { fruit: "cherry",     name: "Cherry" },
  { fruit: "pineapple",  name: "Pineapple" },
  { fruit: "watermelon", name: "Watermelon" },
];

function buildSyntheticCast(preset: StoryPreset): (CharInput & { synthetic: true })[] {
  const count = (preset === "cheating" || preset === "cheats-back") ? 3 : 2;
  const shuffled = [...SYNTHETIC_CAST_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((pick, index) => ({
    id:          `ai_cast_${pick.fruit}_${index}`,
    name:        pick.name,
    role:        "",
    description: `${pick.name} — AI-generated character invented for this story. ${pick.fruit} fruit character. Visually distinct from every other character in the cast. No reference image — must be described in full, consistent visual detail (fruit head texture, human body proportions, skin tone, clothing, expression style) in every scene's imagePrompt, and that description must stay identical across all scenes.`,
    synthetic:   true,
  }));
}
```

</details>

<details>
<summary><code>supabase/functions/fruit-story-planner/index.ts:509-622</code> — buildCanonicalCast() fallback descriptions + mergeCastWithPlanner()</summary>

```ts
function buildCanonicalCast(selectedCharacters: CharInput[], preset: StoryPreset) {
  const cheating = preset === "cheating" || preset === "cheats-back";
  return selectedCharacters.map((c, index) => {
    const fruitType      = inferFruitType(c);
    const narrativeRole  = inferNarrativeRole(c, index, preset);
    const roleForId      = narrativeRole === "victim" && cheating ? "wife"
      : narrativeRole === "cheater" && cheating ? "cheater"
      : narrativeRole === "affair_partner" ? "affair_partner"
      : narrativeRole;

    const displayName    = c.name ?? c.id ?? `Character ${index + 1}`;
    const nameSlug       = slug(displayName);
    const fruitSlug      = slug(fruitType);
    const id             = nameSlug.startsWith(fruitSlug)
      ? `${roleForId}_${nameSlug}`
      : `${roleForId}_${fruitSlug}_${nameSlug}`;
    const cleanId        = id.replace(/_+/g, "_");
    const referenceLabel = cleanId.toUpperCase();

    const narrativeFunction = {
      victim:        "main betrayed character — emotionally driven protagonist who discovers and reacts",
      cheater:       "cheating partner — secretive and defensive, the source of the conflict",
      affair_partner:"affair partner — visually distinct from the betrayed partner, never interchangeable",
      kid:           "child character — emotionally affected but never role-swapped into an adult",
      boss:          "authority figure — creates workplace pressure or is a power character",
      villain:       "antagonist — creates conflict and pressure",
      friend:        "supporting friend — trusted confidant or plot helper",
      sibling:       "sibling — emotionally connected family member",
      parent:        "parent character — protective or conflict-creating family authority",
      protagonist:   "main character driving the story",
      antagonist:    "opposing force creating conflict",
      supporting:    "supporting character with stable story function",
    }[narrativeRole] ?? "supporting character";

    const genderPresentation = /mom|wife|girl|mistress|mother|female/i.test(`${c.id ?? ""} ${c.name ?? ""} ${c.role ?? ""}`)
      ? "feminine-presenting"
      : /dad|husband|boy|son|male/i.test(`${c.id ?? ""} ${c.name ?? ""} ${c.role ?? ""}`)
        ? "masculine-presenting"
        : "unspecified";

    // Default templates below are only a fallback — GPT's own appearance/
    // clothing/personality/visualIdentity from the plan response take
    // priority in mergeCastWithPlanner(). Still, this fallback must not
    // reference "the reference image" for a synthetic (no-image) character,
    // which is now the common case since characters are AI-invented from
    // the story idea rather than uploaded.
    const hasRefImage = c.synthetic !== true;

    return {
      id:                 cleanId,
      sourceCharacterId:  c.id ?? cleanId,
      role:               narrativeRole,
      referenceLabel,
      label:              referenceLabel,
      displayName,
      narrativeRole,
      fruitType,
      genderPresentation,
      identityLock: `${fruitType} fruit character — same face, same peel color, same body shape, same outfit and accessories, identity locked across every scene`,
      visualIdentity: hasRefImage
        ? `${displayName} is a ${fruitType} fruit-human character; preserve exact appearance, colors, outfit, and face from the reference image`
        : `${displayName} is a ${fruitType} fruit-human character with an invented, consistent design — same face, peel color, body shape, outfit and accessories in every scene`,
      appearance: hasRefImage
        ? `${displayName}: ${fruitType} fruit-human character, ${genderPresentation}`
        : `${displayName}: ${fruitType} fruit-human character, ${genderPresentation} — invent a specific, memorable look (exact peel/skin color, hairstyle, one signature accessory) and keep it identical in every scene`,
      clothing: hasRefImage
        ? `consistent outfit and accessories from the ${referenceLabel} reference image`
        : `invent a specific, consistent outfit for ${displayName} and reuse it identically in every scene`,
      narrativeFunction,
      relationships: cheating
        ? "locked cheating-drama relationship map; betrayed partner, cheater, and affair partner are always visually and narratively distinct"
        : "locked relationship to selected cast — role never drifts",
      personality: narrativeRole === "victim"       ? "emotionally present, perceptive, and growing stronger through the story"
        : narrativeRole === "cheater"               ? "secretive, nervous when caught, defensive when confronted"
        : narrativeRole === "affair_partner"        ? "visually distinct from the betrayed partner; never visually or narratively interchangeable"
        : narrativeRole === "kid"                   ? "innocent child character; never role-swapped into an adult"
        : "supporting character with a stable personality and story function",
      agePresentation: "adult",
      emotionalArc: narrativeRole === "victim"       ? "begins uneasy and unaware, ends confronting the truth with strength"
        : narrativeRole === "cheater"               ? "begins confident and secretive, ends cornered and exposed"
        : narrativeRole === "affair_partner"        ? "begins hidden and evasive, ends exposed and confronted"
        : narrativeRole === "kid"                   ? "begins innocent and confused, ends comforted once the truth settles"
        : "experiences the story's emotional turn alongside the main characters",
      synthetic: c.synthetic === true,
    };
  });
}

function mergeCastWithPlanner(canonicalCast: any[], plannedCast: any[] = []) {
  return canonicalCast.map((base) => {
    const match = plannedCast.find((c: any) =>
      c?.id === base.id ||
      c?.sourceCharacterId === base.sourceCharacterId ||
      c?.referenceLabel === base.referenceLabel ||
      c?.label === base.referenceLabel ||
      c?.displayName === base.displayName ||
      // Match synthetic affair_partner by narrativeRole when GPT uses a different ID
      (base.synthetic && base.narrativeRole === "affair_partner" && c?.narrativeRole === "affair_partner")
    );
    return {
      ...base,
      appearance:    match?.appearance    || base.appearance,
      clothing:      match?.clothing      || base.clothing,
      personality:   match?.personality   || base.personality,
      agePresentation: match?.agePresentation || base.agePresentation,
      emotionalArc:    match?.emotionalArc    || base.emotionalArc,
      narrativeRole: base.narrativeRole,
      role:          base.role,
      referenceLabel: base.referenceLabel,
      label:         base.label,
      visualIdentity: match?.visualIdentity || base.visualIdentity,
    };
  });
}
```

</details>

#### 1.2.4 Server-side post-processing of each scene (verbatim)

`appendStrictImageRules` is what `scene.imagePrompt` actually contains when it reaches the browser. It wraps GPT's own image prompt, and the result is typically 1,500–2,500 chars.

<details>
<summary><code>supabase/functions/fruit-story-planner/index.ts:716-839</code> — appendStrictImageRules() + repairScenes()</summary>

```ts
function appendStrictImageRules(
  prompt: string,
  beat: BeatTemplate,
  presentIds: string[],
  forbiddenIds: string[],
  cast: any[],
  sceneIndex: number = 0,
  totalScenes: number = 3,
  previousBeat?: BeatTemplate,
) {
  const presentLabels   = labelsForIds(presentIds,  cast);
  const forbiddenLabels = labelsForIds(forbiddenIds, cast);
  const sceneNum        = sceneIndex + 1;

  const base = String(prompt ?? "")
    .replace(/STRICT RULES:[\s\S]*$/i, "")
    .replace(/STORY BEAT:[\s\S]*?(?=\n\S)/i, "")
    .replace(/CHEATING BEAT:[\s\S]*?(?=\n\S)/i, "")
    .trim();

  const scenePrompt = base || beat.promptHint ||
    `${presentLabels.join(" and ")} in a ${beat.emotionDirection} dramatic moment.`;

  // Camera framing guidance per beat type
  const cameraGuidance =
    beat.beatType === "hook"                              ? "Wide or medium two-shot establishing both characters together in the same frame. Show their relationship clearly." :
    beat.beatType === "affair_scene"                      ? "Intimate medium two-shot showing ONLY the two characters in this scene together. Close conspiratorial framing." :
    beat.beatType === "discovery" || beat.beatType === "confrontation" ? "Dramatic confrontation framing — medium close-up two-shot or three-shot with faces clearly readable and expressive." :
    beat.beatType === "payoff"   || beat.beatType === "walk_away"      ? "Wide powerful shot for walk-away OR tight dramatic close-up for a final reveal twist." :
    beat.beatType === "suspicion" || beat.beatType === "investigation"  ? "Close-up on the clue or evidence in the character's hand, then pull to their reaction face." :
    beat.beatType === "twin_reveal"                       ? "Dramatic split-reveal shot showing both identical characters side by side for maximum visual impact." :
    beat.beatType === "baby_reveal" || beat.beatType === "reaction"    ? "Expressive close-up on the character's face capturing the full emotional reaction." :
    beat.cameraDirection;

  // Continuity line linking this scene to the previous
  const continuityLine = sceneIndex > 0 && previousBeat
    ? `Scene ${sceneNum} of ${totalScenes} — continuing the story from scene ${sceneNum - 1} ("${previousBeat.title}"). CHARACTER CLOTHING must stay identical to the reference images — this is locked. However THIS scene happens in a NEW moment: ${beat.backgroundDetail}. The POSES, EXPRESSIONS, and LOCATION must reflect this scene's beat (${beat.beatType.toUpperCase()}) — do NOT reuse the same composition or room layout from the previous scene. Each scene must look VISUALLY DISTINCT while keeping the same character appearances.`
    : `Opening scene: establish the characters, their relationship, and the setting clearly. This is the visual hook that draws the viewer in.`;

  return [
    `Image ${sceneNum} of ${totalScenes} — ${beat.beatType.toUpperCase()}: ${beat.title}`,
    "",
    scenePrompt,
    "",
    `SCENE BEAT: ${beat.beatType.toUpperCase()} — ${beat.title}`,
    `Story purpose: ${beat.purpose}`,
    `REQUIRED EMOTION (characters MUST show this): ${beat.emotionDirection}`,
    `REQUIRED ACTION (characters MUST be doing this): ${beat.actionDirection}`,
    `Camera: ${cameraGuidance || beat.cameraDirection}`,
    `Background/Location: ${beat.backgroundDetail}`,
    `IMPORTANT: Reference images show the character APPEARANCE ONLY. Pose, expression, and body language must match the REQUIRED EMOTION and REQUIRED ACTION above — not the reference image's default pose.`,
    "",
    `STORY CONTINUITY: ${continuityLine}`,
    "",
    "CHARACTER RULES — NON-NEGOTIABLE:",
    "- ALL characters are TALL ADULT anthropomorphic fruit-human characters",
    "- FULL ADULT body proportions — NOT children, NOT babies, NOT toddlers",
    "- Adult height, adult face structure, adult clothing, adult emotional expressions",
    "- Human-like adult arms, legs, hands — dressed in adult clothing appropriate to the scene",
    `- Show ONLY these characters: ${presentLabels.join(", ") || "listed cast"}`,
    `- Do NOT show: ${forbiddenLabels.length ? forbiddenLabels.join(", ") : "any other named recurring character"}`,
    "- Keep all recurring characters visually identical to their reference images",
    "- Do not merge, swap, or redesign any character identity",
    ...(["baby_reveal","baby_hint","baby_clue","reaction","bonding","preparation","payoff","subtle_hint"].includes(beat.beatType)
      ? [
          "BABY STORY RULE — CRITICAL: Do NOT generate a baby fruit character, infant, or child character in this image.",
          "Show the pregnancy through a white PREGNANCY TEST stick with two visible lines, or through the characters' emotional reactions.",
          "There is NO baby character yet. ALL characters in this image are TALL ADULT fruit-human characters ONLY.",
        ]
      : []),
    "NO text, NO captions, NO subtitles, NO speech bubbles, NO watermarks, NO typography.",
  ].filter((l) => l !== null).join("\n");
}

function repairScenes(
  planScenes: any[],
  cast: any[],
  beats: BeatTemplate[],
  sceneCount: number,
) {
  const allIds = cast.map((c) => c.id);
  return Array.from({ length: sceneCount }).map((_, index) => {
    const source      = planScenes[index] ?? {};
    const beat        = beats[index] ?? beats[beats.length - 1];
    const presentIds  = resolveSceneIds(source, index, cast, beats);
    const forbiddenIds = allIds.filter((id) => !presentIds.includes(id));

    return {
      ...source,
      sceneNumber:           index + 1,
      title:                 source.title          || beat.title          || `Scene ${index + 1}`,
      durationSeconds:       source.durationSeconds ?? 6,
      beatType:              beat.beatType,
      storyPurpose:          source.scenePurpose   || source.storyPurpose || beat.purpose,
      scenePurpose:          source.scenePurpose   || beat.purpose,
      emotionDirection:      source.emotionDirection  || beat.emotionDirection,
      actionDirection:       source.actionDirection   || beat.actionDirection,
      cameraDirection:       source.cameraDirection   || beat.cameraDirection,
      backgroundDetail:      source.backgroundDetail  || beat.backgroundDetail,
      environment:           source.environment       || beat.backgroundDetail.split(" ")[0] || "home",
      continuityFromPrevious: Boolean(source.continuityFromPrevious),
      characterIdsInScene:   presentIds,
      charactersInScene:     presentIds,
      charactersNotInScene:  forbiddenIds,
      forbiddenCharacters:   forbiddenIds,
      emotionalBeat:         source.emotionalBeat || beat.emotionDirection,
      captionText:           source.captionText   || "",
      imagePrompt:           appendStrictImageRules(
        source.imagePrompt ?? "",
        beat,
        presentIds,
        forbiddenIds,
        cast,
        index,
        sceneCount,
        index > 0 ? beats[index - 1] : undefined,
      ),
      videoPrompt: String(source.videoPrompt ?? `SPOKEN DIALOGUE - SAY EXACTLY: FRUIT CHARACTER: "I know what you did." FRUIT CHARACTER 2: "Let me explain everything." Speech rules: ENGLISH WORDS ONLY. Speak exactly the quoted lines with clear natural pronunciation — no mumbling, no muttering, no foreign sounds. Dialogue starts in the first second. Action: ${beat.actionDirection}. Emotion: ${beat.emotionDirection}. Movement: characters turn to face each other directly, eye contact locked, expressive lip-sync, natural conversational gestures. Camera: vertical 9:16 tight two-shot then push-in close-up. Audio: clear audible English dialogue only, light room ambience, no background music. Ending beat: mini cliffhanger reaction. Negative: no captions, no subtitles, no text overlays, no logos, no watermarks, no extra characters, no identity changes, no background music, no mumbling, no gibberish.`)
        .replace(/\s*No text overlays, no watermarks, no subtitles\.?$/i, "").trim() +
        " No text overlays, no watermarks, no subtitles.",
      negativePrompt: "text, letters, subtitles, watermark, logo, speech bubbles, collage, multiple panels, split screen, ui elements, captions, extra main characters, identity swap",
    };
  });
}
```

</details>

---

### 1.3 Style bible — `config/fruitStoryStyles.js`

- **Only `cinematic` is ever used.** The UI hardcodes `style: "cinematic"` (`AIFruitStoryBuilder.jsx:31`).
- **Image prompt:** `buildMasterImagePrompt` (`fruitStoryApi.js:1649-1671`) reads `masterPrompt`, `label`, `visualRules`, `storytellingRules`, `characterConsistencyRules`, `sceneRules` and `negativeRules`.
- **Video prompt:** only `style.id` is used, to pick one of four hardcoded style lines (`fruitStoryApi.js:1048-1055`).
- **`animationRules` and `shortDescription` are never read.**
- **The planner doesn't receive the style.** It has its own fixed "STYLE (fixed internal …)" block (`fruit-story-planner/index.ts:1028-1032`).

<details>
<summary><code>src/components/viral-tools/ai-fruit-story/config/fruitStoryStyles.js:1-36</code> — cinematic3d (the only style in use)</summary>

```js
const cinematic3d = {
  id: "cinematic",
  label: "Cinematic 3D",
  shortDescription: "Premium drama lighting with readable TikTok storytelling.",
  masterPrompt: "Create a high-quality viral-ready 3D AI fruit story scene with polished anthropomorphic fruit characters, cinematic lighting, strong emotion, clean composition, and no text of any kind.",
  visualRules: [
    "Polished 3D anthropomorphic fruit characters with expressive faces and clear body language.",
    "Cinematic lighting with premium short-form drama contrast.",
    "Clean, readable foreground action with a strong focal point.",
    "TikTok-optimized framing that is instantly understandable without captions.",
  ],
  storytellingRules: [
    "The image must clearly communicate the scene purpose in a short viral drama sequence.",
    "Use strong facial expressions, readable staging, and visual cause-and-effect.",
    "Avoid filler moments; every scene should escalate, reveal, confront, or resolve.",
  ],
  characterConsistencyRules: [
    "Preserve exact identity of all referenced characters.",
    "Only include the characters listed for this scene.",
    "Do not invent extra foreground characters.",
    "Do not merge identities or change one character into another.",
  ],
  sceneRules: [
    "One cinematic moment only; no split panels or collages.",
    "Keep the environment simple enough that the emotion reads immediately.",
    "Use dramatic camera angle, lighting, and staging to make the story beat obvious.",
  ],
  animationRules: [
    "Animate with one clear camera move and one clear character reaction.",
    "Keep motion readable for short-form vertical video.",
  ],
  negativeRules: [
    "No text, captions, subtitles, speech bubbles, title cards, logos, UI overlays, or watermarks.",
    "No random background cast, identity swaps, extra limbs, unreadable clutter, or realism drift.",
  ],
};
```

</details>

<details>
<summary><code>src/components/viral-tools/ai-fruit-story/config/fruitStoryStyles.js:136-155</code> — Style id aliases</summary>

```js
export const FRUIT_STORY_STYLES = {
  cinematic: cinematic3d,
  cinematic_3d: cinematic3d,
  cute_pixar_like: cute3d,
  pixar: cute3d,
  "cute-chaos": dramaComedy,
  dramatic_comedy: dramaComedy,
  "dark-drama": darkDrama,
};

export const FRUIT_STORY_STYLE_OPTIONS = [
  cinematic3d,
  cute3d,
  dramaComedy,
  darkDrama,
];

export function getFruitStoryStyle(styleId = "cinematic") {
  return FRUIT_STORY_STYLES[styleId] ?? FRUIT_STORY_STYLES.cinematic;
}
```

</details>

`cute3d` (`:38-70`), `dramaComedy` (`:72-103`) and `darkDrama` (`:105-134`) follow the same shape and are unreachable from the UI.

---

### 1.4 Character portrait prompts (one per cast member, before any scene)

`generateCharacterPortrait` (`fruitStoryApi.js:1841-1872`) is called for every `plan.cast` member in parallel (`useFruitStoryJob.js:609-623`).
- It is text-to-image with **no reference images**, a flat 2 credits, and `quality: "low"`.
- The resulting URL is **mutated onto the cast member** (`member.portraitUrl = url`) and later persisted inside `cast_data`.
- A failed or timed-out portrait (4.5 min client wait) is silently skipped. That character's scenes then have no reference image.

<details>
<summary><code>src/components/viral-tools/ai-fruit-story/api/fruitStoryApi.js:1813-1872</code> — buildCharacterPortraitPrompt() + generateCharacterPortrait()</summary>

```js
function buildCharacterPortraitPrompt(member) {
  const name = member.displayName || member.name || "the character";
  const fruit = member.fruitType || "fruit";
  const genderNoun =
    member.genderPresentation === "feminine-presenting" ? "woman"
    : member.genderPresentation === "masculine-presenting" ? "man"
    : "person";

  // Deliberately NEUTRAL pose/expression — this portrait becomes the image
  // reference for every scene the character appears in. A dramatic pose or
  // emotion baked in here (e.g. "arms crossed, pointing accusingly") gets
  // copied into every scene by the image model regardless of that scene's
  // actual action, which is what caused different scenes to render as
  // near-duplicates of each other. Identity (face/fruit/outfit) must be
  // locked; pose/expression must come from each scene's own direction.
  return sanitizeImagePromptForGPT([
    `Place ${name} alone against a simple plain neutral studio background, centered, nothing else in frame.`,
    `${name} is an anthropomorphic fruit-human ${genderNoun} with a realistic ${fruit} as their head, glossy detailed fruit skin, while the rest of the body has natural adult human proportions.`,
    member.visualIdentity ? `Locked visual identity: ${member.visualIdentity}.` : "",
    member.appearance ? `Appearance: ${member.appearance}.` : "",
    member.clothing ? `Wearing: ${member.clothing}. This exact outfit, these exact colors and proportions must stay identical in every future scene.` : "",
    "Neutral relaxed standing pose, arms loosely at sides, calm neutral facial expression — this is an identity reference photo, not a dramatic story moment.",
    "Frame as a three-quarter mid-shot at eye level, soft even studio lighting, shallow depth of field.",
    "Feature-film-quality stylized 3D animation, hyper-detailed materials, realistic fabric, expressive facial rigging, polished cinematic rendering, fruit head only with a fully human-shaped body.",
    "No text, no letters, no captions, no watermark, no logo, no other characters in frame.",
  ].filter(Boolean).join(" "));
}

export async function generateCharacterPortrait({ member, form }) {
  const imageToolKey = form.sceneImageModel ?? "zyvo-v2";
  const toolKey = FRUIT_IMAGE_MODEL_TO_TOOLKEY[imageToolKey] ?? "image:fruit-v2";
  const aspect  = form.sceneAspect ?? "9:16";
  const dimMap  = FRUIT_MODEL_DIMS[imageToolKey] ?? FRUIT_MODEL_DIMS["zyvo-v2"];
  const dims    = dimMap[aspect] ?? dimMap["9:16"];
  const creditsPerImage = getFruitImageCreditsPerImage(imageToolKey, []);
  const isFruitImageModel = toolKey === "image:fruit-v2";

  const job = await createImageJobSimple({
    subject:      buildCharacterPortraitPrompt(member),
    toolKey,
    size:         dims.size,
    width:        dims.width,
    height:       dims.height,
    project_id:   form.project_id ?? null,
    refImages:    [],
    expectedRefSlotCount: 0,
    chargeCreditsOverride: creditsPerImage,
    providerHint: {
      engine:   "runware",
      mode:     "t2i",
      edgeFn:   "/functions/v1/runware-image",
      airTag:   "openai:gpt-image@2",
      settings: isFruitImageModel
        ? { quality: "low", fruitModel: imageToolKey, skipResponse: true, deliveryMethod: "async", outputQuality: 85 }
        : {},
    },
  });

  return job;
}
```

</details>

**Rendered example** (1,144 chars, which fits under the 2,000-char cap):

<details open>
<summary>Portrait prompt for the "Orange" cast member (after sanitizeImagePromptForGPT)</summary>

```text
Place Orange alone against a simple plain neutral studio background, centered, nothing else in frame. Orange is an anthropomorphic fruit-human person with a realistic orange as their head, glossy detailed fruit skin, while the rest of the figure has natural adult human proportions. Locked visual identity: glossy bright-orange citrus head with dimpled peel, soft amber eyes. Appearance: tall adult woman, orange citrus head, auburn bob, small gold hoop earrings. Wearing: cream cable-knit sweater and dark jeans. This exact outfit, these exact colors and proportions must stay identical in every future scene. Neutral relaxed standing pose, arms loosely at sides, calm neutral facial expression — this is an identity reference photo, not a dramatic story moment. Frame as a three-quarter mid-shot at eye level, soft even studio lighting, shallow depth of field. Feature-film-quality stylized 3D animation, hyper-detailed materials, realistic fabric, expressive facial rigging, polished cinematic rendering, fruit head only with a fully human-shaped figure. No text, no letters, no captions, no watermark, no logo, no other characters in frame.
```

</details>

---

### 1.5 Scene image prompts

**Assembly** (`generateSceneImage`, `fruitStoryApi.js:1875-2028`):

1. **Reference slots** (`buildSceneRefSlots`, `:1496-1624`). For each id in `scene.characterIdsInScene`, the matching cast entry's `portraitUrl` becomes slot A, B, C, and so on. The **previous-scene continuity image is deliberately not sent** (`:1596-1608`), even though the hook still passes it. The UI audit's "previous scene as continuity ref" no longer happens.
2. **Master prompt** (`buildMasterImagePrompt`, `:1642-1776`). The sections, in order:
   1. Adult-proportions preamble
   2. Style bible
   3. Global role lock
   4. Style rule
   5. REFERENCE RULES (one `buildCharacterPromptText` block per slot)
   6. STRICT SCENE RULES
   7. SCENE BEAT CONTEXT
   8. SCENE DESCRIPTION (the planner's `imagePrompt`)
   9. FINAL ENFORCEMENT
   10. ABSOLUTE NO-TEXT rule
3. **`sanitizeImagePromptForGPT`** (`:2054-2114`) rewrites filter-trigger words, e.g. `affair` → `secret`, `betrayed` → `shocked`, `body` → `figure`.
4. **Client validations** (`:1937-1974`). Each of these throws, and the throw marks the scene `failed` client-side:
   - The count of "Reference Image X" mentions must equal the ref count.
   - No `localhost` refs.
   - No app-hosted character assets.
   - Refs must be raw image URLs.
5. **Job:** `createImageJobSimple({ subject: safePrompt, toolKey: "image:fruit-v2", size: "720x1280", refImages, chargeCreditsOverride: 2, providerHint: { settings: { quality: "low", fruitModel: "zyvo-v2", skipResponse: true, deliveryMethod: "async", outputQuality: 85 } } })`.
6. **Prompt suffix.** `createImageJobSimple` stores `jobs.prompt = subject + ", clean composition, sharp focus, high detail"` (`src/lib/jobs.ts:162-170, 638`). job-worker forwards `job.prompt` (`job-worker/index.ts:488`).
7. **Hard cut.** `runware-image` whitespace-collapses the prompt and **truncates it to 2,000 chars** (`safeImagePositivePrompt(prompt)` with default `max = 2000`, `runware-image/index.ts:508-519, 673`). The cap has been in committed code since `9bbd306` (2026-06-07).

> ⚠ **Measured consequence** (from the real builder functions, 2-character hook scene):
>
> | | Chars |
> |---|---|
> | Full prompt | ~7,790 |
> | Sent to Runware | 2,000 |
> | "REFERENCE RULES:" starts at | ~3,151 |
> | "SCENE BEAT CONTEXT:" starts at | ~6,103 |
> | "SCENE DESCRIPTION:" starts at | ~6,552 |
>
> GPT Image 2 therefore sees only the adult-proportions preamble and part of the style bible, which is identical for every scene, plus the portrait images. Nothing scene-specific is sent: not the beat, action, camera, location, which characters are present, or the planner's description. The only thing that varies between scenes is which portraits are attached.
>
> This is also why the "Regenerate image" modal (UI audit §4.3) has no effect. It edits `scene.imagePrompt`, which lands at char ~6,500.

<details>
<summary><code>src/components/viral-tools/ai-fruit-story/api/fruitStoryApi.js:1467-1494</code> — buildCharacterPromptText() — one block per reference slot</summary>

```js
function buildCharacterPromptText({ slot, selected, castEntry, label }) {
  const roleDesc = castEntry?.narrativeRole
    ? `the ${castEntry.narrativeRole} in this story`
    : (selected.role ?? "a character in this story");

  const fruitNote = castEntry?.fruitType
    ? `Fruit type: ${castEntry.fruitType}.`
    : "";
  const appearanceNote = castEntry?.appearance
    ? `Appearance: ${castEntry.appearance}.`
    : "";
  const visualIdentityNote = castEntry?.visualIdentity
    ? `Visual identity: ${castEntry.visualIdentity}.`
    : "";
  const clothingNote = castEntry?.clothing
    ? `Clothing: ${castEntry.clothing}.`
    : "";

  return (
    `Reference Image ${slot} = ${label}.\n` +
    `This character is ${roleDesc}.\n` +
    `${fruitNote} ${appearanceNote} ${visualIdentityNote} ${clothingNote}\n`.trim() + "\n" +
    "PRESERVE EXACTLY FROM THIS REFERENCE: fruit type, face, body shape, outfit, accessories, color palette, and overall identity.\n" +
    "This identity is LOCKED for the entire story - never confuse this character with any other.\n" +
    "DO NOT COPY FROM THIS REFERENCE: pose, body position, arm/hand placement, facial expression, camera angle, or background. " +
    "This reference is a neutral identity photo, not this scene's action — the pose, expression, framing and environment for THIS image come entirely from the scene description below, not from this reference."
  );
}
```

</details>

<details>
<summary><code>src/components/viral-tools/ai-fruit-story/api/fruitStoryApi.js:1637-1776</code> — buildMasterImagePrompt()</summary>

```js
function formatRuleList(title, rules = []) {
  if (!rules.length) return "";
  return `${title}:\n${rules.map((rule) => `- ${rule}`).join("\n")}`;
}

function buildMasterImagePrompt({
  scene,
  refSlots,
  castBible = [],
  styleId = "cinematic",
}) {
  const parts = [];
  const style = getFruitStoryStyle(styleId);
  const charSlots = refSlots.filter((slot) => slot.type === "character");
  const continuitySlots = refSlots.filter((slot) => slot.type === "continuity");
  const hasContinuityRef = continuitySlots.length > 0;

  /* ── 1. Global Zyvo style ── */
  parts.push(
    "CRITICAL CHARACTER REQUIREMENT — READ FIRST:\n" +
    "ALL characters in this image MUST be TALL ADULT anthropomorphic fruit-human characters.\n" +
    "FULL ADULT body proportions — NOT children, NOT babies, NOT toddlers, NOT small figures.\n" +
    "Characters must have: adult height, adult face structure with mature features, adult clothing,\n" +
    "human-like adult arms/legs/hands, and adult emotional expressions.\n" +
    "If the reference image shows a character with adult proportions, replicate those adult proportions exactly.\n" +
    "Do NOT shrink characters into baby or child size. Do NOT give them baby faces or child heads.\n\n" +
    `${style.masterPrompt}\n\n` +
    `SELECTED STYLE: ${style.label}\n` +
    [
      formatRuleList("VISUAL RULES", style.visualRules),
      formatRuleList("TIKTOK STORYTELLING RULES", style.storytellingRules),
      formatRuleList("CHARACTER CONSISTENCY RULES", style.characterConsistencyRules),
      formatRuleList("SCENE COMPOSITION RULES", style.sceneRules),
      formatRuleList("NEGATIVE RULES", style.negativeRules),
    ].filter(Boolean).join("\n\n") + "\n\n" +
    "GLOBAL ROLE LOCK:\n" +
    "- Preserve exact identity of all referenced characters.\n" +
    "- Only include the characters listed for this scene.\n" +
    "- Do not invent extra foreground characters.\n" +
    "- Do not merge identities.\n" +
    "- Do not change one character into another.\n" +
    "- If continuity reference is provided, use it only for environment, camera, lighting, and mood continuity, not for adding previous scene characters.\n\n" +
    "STYLE RULE:\n" +
    "Always use the Zyvo 3D AI fruit story visual style:\n" +
    "- Polished 3D anthropomorphic ADULT fruit characters with expressive adult faces\n" +
    "- Cinematic lighting, dramatic storytelling, and clean composition\n" +
    "- TikTok-optimized vertical framing when requested\n" +
    "- Preserve exact identity of all referenced characters\n" +
    "- Only include the characters listed for this scene\n" +
    "- Do not invent extra characters, merge identities, or change one character into another\n" +
    "- Clean, TikTok-ready framing — scroll-stopping premium quality\n" +
    "- NO realism drift, NO random character redesigns, NO child or baby proportions\n" +
    "- NO text, captions, subtitles, speech bubbles, logos, or watermarks"
  );

  /* ── 2. Character reference rules — identity + role locked ── */
  const castLine = charSlots.map((slot) =>
    `${slot.slot}=${getSlotReferenceLabel(slot, castBible)}`,
  ).join(", ");
  const referencePromptText = refSlots
    .map((slot) => slot.promptText)
    .filter(Boolean)
    .join("\n\n");

  if (referencePromptText) {
    parts.push(
      "REFERENCE RULES:\n" +
      referencePromptText + "\n\n" +
      `SCENE CAST - ONLY these characters may visually appear: ${castLine}.\n` +
      "Any character NOT in the scene cast above must be completely absent from this image.\n" +
      "Do NOT add random background characters or extras.\n\n" +
      "⚠ CRITICAL — REFERENCE IMAGES ARE FOR IDENTITY ONLY: the character reference images are neutral identity photos, " +
      "each one from a DIFFERENT, unrelated moment. Do NOT reproduce their pose, framing, camera angle, or background in this image. " +
      "Every scene in this story must look visually DISTINCT from every other scene — different pose, different body position, " +
      "different camera angle, different framing — driven entirely by THIS scene's specific action and camera direction below, " +
      "never by what the reference image happens to show."
    );
  }

  const allowedLabels = charSlots.map((slot) => getSlotReferenceLabel(slot, castBible));
  const sceneIds = new Set(normalizeSceneCharacterIds(scene));
  const forbiddenLabels = getCastEntries(castBible)
    .filter((c) => c?.id && !sceneIds.has(c.id))
    .map((c) => c.referenceLabel)
    .filter(Boolean);

  if (allowedLabels.length > 0) {
    parts.push(
      "STRICT SCENE RULES:\n" +
      `- Show ONLY these characters: ${allowedLabels.join(", ")}.\n` +
      `- Do NOT show: ${forbiddenLabels.length ? forbiddenLabels.join(", ") : "any other recurring character"}.\n` +
      "- No extra background main characters not in the scene cast.\n" +
      "- Do not merge identities or change one character into another.\n" +
      "- Keep each recurring character's FACE, FRUIT TYPE, and OUTFIT identical to their reference image — but their pose, " +
      "expression, and body position in THIS image must match THIS scene's action, not the reference image's pose."
    );
  }

  /* ── 5. Scene beat metadata from planner ── */
  // Use the structured scene fields from Fruit Movie Maker AI output to enrich
  // the prompt with specific story beat context — emotion, action, framing, background.
  const beatMeta = [];
  if (scene.beatType)         beatMeta.push(`Beat type: ${scene.beatType.toUpperCase()}`);
  if (scene.storyPurpose || scene.scenePurpose) beatMeta.push(`Story purpose: ${scene.storyPurpose ?? scene.scenePurpose}`);
  if (scene.emotionDirection) beatMeta.push(`Required emotion: ${scene.emotionDirection}`);
  if (scene.actionDirection)  beatMeta.push(`Required action: ${scene.actionDirection}`);
  if (scene.cameraDirection)  beatMeta.push(`Camera/framing: ${scene.cameraDirection}`);
  if (scene.backgroundDetail) beatMeta.push(`Background: ${scene.backgroundDetail}`);

  if (beatMeta.length > 0) {
    parts.push("SCENE BEAT CONTEXT:\n" + beatMeta.join("\n"));
  }

  /* ── 6. Scene image prompt from planner ── */
  if (scene.imagePrompt) {
    parts.push("SCENE DESCRIPTION:\n" + scene.imagePrompt);
  }

  /* ── 7. Adult character + continuity final enforcement ── */
  parts.push(
    "FINAL ENFORCEMENT:\n" +
    "- Characters MUST be TALL ADULT fruit-human characters — full adult height and adult body proportions.\n" +
    "- No child-sized characters, no baby proportions, no toddler features.\n" +
    "- Character CLOTHING and FRUIT TYPE must stay identical to their reference images — this is locked.\n" +
    "- Character POSE, EXPRESSION, and BODY LANGUAGE must match THIS scene's Required emotion and Required action — NOT the reference image's default pose.\n" +
    "- The BACKGROUND and ENVIRONMENT must reflect the scene's story beat and location (see SCENE BEAT CONTEXT above) — each scene should look visually DISTINCT.\n" +
    "- Characters positioned in this scene must face and interact with each other naturally.\n" +
    "- Reference images are for APPEARANCE ONLY (face, outfit, fruit type, body shape). Do not copy their pose or background."
  );

  /* ── 8. Absolute no-text rule ── */
  parts.push(
    "ABSOLUTE RULE — NO TEXT OF ANY KIND:\n" +
    "NO text, NO captions, NO subtitles, NO speech bubbles, NO dialogue boxes,\n" +
    "NO signs with readable words, NO watermarks, NO logos, NO UI overlays,\n" +
    "NO title cards, NO typography, NO letters or numbers anywhere in this image."
  );

  return parts.join("\n\n");
}
```

</details>

<details>
<summary><code>src/components/viral-tools/ai-fruit-story/api/fruitStoryApi.js:2052-2114</code> — sanitizeImagePromptForGPT()</summary>

```js
// GPT Image 2 safety filter — replaces words that trigger safety_violations=[sexual].
// "Hot Peach" + affair/drama context is the main trigger. Remove ALL sexual-adjacent words.
function sanitizeImagePromptForGPT(prompt) {
  return prompt
    // Character names with sexual connotation
    .replace(/\bhot\s+peach\b/gi,          "peach character")
    .replace(/\bhotpeach\b/gi,             "peach character")
    .replace(/\bhot\b(?=\s+\w*character)/gi, "")

    // Story / relationship words that trigger filters
    .replace(/\bcheating\b/gi,             "hiding a secret")
    .replace(/\bcheated?\b/gi,             "made a discovery")
    .replace(/\bcheater\b/gi,              "character")
    .replace(/\bcheats?\b/gi,              "hides something")
    .replace(/\baffair\b/gi,               "secret")
    .replace(/\baffair[_\s]partner\b/gi,   "character")
    .replace(/\bmistress\b/gi,             "character")
    .replace(/\binfidelity\b/gi,           "secret")
    .replace(/\blover\b/gi,                "character")
    .replace(/\bbetrayal\b/gi,             "revelation")
    .replace(/\bbetrayed\b/gi,             "shocked")
    .replace(/\bbetrays?\b/gi,             "reveals")

    // Body / appearance words that can trigger sexual filter
    .replace(/\bseductive\b/gi,            "stylish")
    .replace(/\bseductively\b/gi,          "confidently")
    .replace(/\bsensual\b/gi,              "elegant")
    .replace(/\bsensually\b/gi,            "gracefully")
    .replace(/\bflirtatious\b/gi,          "confident")
    .replace(/\bflirting\b/gi,             "smiling")
    .replace(/\bintimate\b/gi,             "close")
    .replace(/\bintimately\b/gi,           "closely")
    .replace(/\btight\s+dress\b/gi,        "elegant dress")
    .replace(/\bform[- ]fitting\b/gi,      "elegant")
    .replace(/\bskin[- ]tight\b/gi,        "fitted")
    .replace(/\bcleavage\b/gi,             "outfit")
    .replace(/\bbody\b/gi,                 "figure")
    .replace(/\bcurves?\b/gi,              "silhouette")

    // Action words near romantic/physical context
    .replace(/\bkissing\b/gi,              "standing close together")
    .replace(/\bembracing\b/gi,            "standing together")
    .replace(/\bcuddle\b/gi,               "sit close together")
    .replace(/\blipstick\s*mark\b/gi,      "mysterious mark")
    .replace(/\blipstick\b/gi,             "makeup")

    // Emotion/drama words that in combination can trigger flags
    .replace(/\bpassionate(ly)?\b/gi,      "emotional")
    .replace(/\bdesire\b/gi,               "longing")
    .replace(/\blust\b/gi,                 "emotion")
    .replace(/\btempt(ing|ation)?\b/gi,    "persuade")
    .replace(/\bseduce[sd]?\b/gi,          "convince")

    // Baby story: prevent "baby fruit character" from generating an infant
    // Keep "pregnancy test" and "two lines" intact (they are safe and specific)
    .replace(/\bbaby\s+fruit\s+character\b/gi, "tiny item")
    .replace(/\binfant\s+character\b/gi,        "tiny prop")
    .replace(/\btiny\s+baby\s+fruit\b/gi,       "small item")

    // Clean up any double spaces
    .replace(/\s{2,}/g, " ")
    .trim();
}
```

</details>

**Rendered example: full master prompt as stored on the job** (before the provider cut):

<details open>
<summary>buildMasterImagePrompt() output for scene 1 (2 refs), after sanitizeImagePromptForGPT</summary>

```text
CRITICAL CHARACTER REQUIREMENT — READ FIRST:
ALL characters in this image MUST be TALL ADULT anthropomorphic fruit-human characters.
FULL ADULT figure proportions — NOT children, NOT babies, NOT toddlers, NOT small figures.
Characters must have: adult height, adult face structure with mature features, adult clothing,
human-like adult arms/legs/hands, and adult emotional expressions.
If the reference image shows a character with adult proportions, replicate those adult proportions exactly.
Do NOT shrink characters into baby or child size. Do NOT give them baby faces or child heads. Create a high-quality viral-ready 3D AI fruit story scene with polished anthropomorphic fruit characters, cinematic lighting, strong emotion, clean composition, and no text of any kind. SELECTED STYLE: Cinematic 3D
VISUAL RULES:
- Polished 3D anthropomorphic fruit characters with expressive faces and clear figure language.
- Cinematic lighting with premium short-form drama contrast.
- Clean, readable foreground action with a strong focal point.
- TikTok-optimized framing that is instantly understandable without captions. TIKTOK STORYTELLING RULES:
- The image must clearly communicate the scene purpose in a short viral drama sequence.
- Use strong facial expressions, readable staging, and visual cause-and-effect.
- Avoid filler moments; every scene should escalate, reveal, confront, or resolve. CHARACTER CONSISTENCY RULES:
- Preserve exact identity of all referenced characters.
- Only include the characters listed for this scene.
- Do not invent extra foreground characters.
- Do not merge identities or change one character into another. SCENE COMPOSITION RULES:
- One cinematic moment only; no split panels or collages.
- Keep the environment simple enough that the emotion reads immediately.
- Use dramatic camera angle, lighting, and staging to make the story beat obvious. NEGATIVE RULES:
- No text, captions, subtitles, speech bubbles, title cards, logos, UI overlays, or watermarks.
- No random background cast, identity swaps, extra limbs, unreadable clutter, or realism drift. GLOBAL ROLE LOCK:
- Preserve exact identity of all referenced characters.
- Only include the characters listed for this scene.
- Do not invent extra foreground characters.
- Do not merge identities.
- Do not change one character into another.
- If continuity reference is provided, use it only for environment, camera, lighting, and mood continuity, not for adding previous scene characters. STYLE RULE:
Always use the Zyvo 3D AI fruit story visual style:
- Polished 3D anthropomorphic ADULT fruit characters with expressive adult faces
- Cinematic lighting, dramatic storytelling, and clean composition
- TikTok-optimized vertical framing when requested
- Preserve exact identity of all referenced characters
- Only include the characters listed for this scene
- Do not invent extra characters, merge identities, or change one character into another
- Clean, TikTok-ready framing — scroll-stopping premium quality
- NO realism drift, NO random character redesigns, NO child or baby proportions
- NO text, captions, subtitles, speech bubbles, logos, or watermarks REFERENCE RULES:
Reference Image A = WIFE_ORANGE.
This character is the victim in this story.
Fruit type: orange. Appearance: tall adult woman, orange citrus head, auburn bob, small gold hoop earrings. Visual identity: glossy bright-orange citrus head with dimpled peel, soft amber eyes. Clothing: cream cable-knit sweater and dark jeans.
PRESERVE EXACTLY FROM THIS REFERENCE: fruit type, face, figure shape, outfit, accessories, color palette, and overall identity.
This identity is LOCKED for the entire story - never confuse this character with any other.
DO NOT COPY FROM THIS REFERENCE: pose, figure position, arm/hand placement, facial expression, camera angle, or background. This reference is a neutral identity photo, not this scene's action — the pose, expression, framing and environment for THIS image come entirely from the scene description below, not from this reference. Reference Image B = CHEATER_BANANA.
This character is the character in this story.
Fruit type: banana. Appearance: tall adult man, banana head, slicked-back look. Visual identity: curved yellow banana head with brown freckles, sharp eyebrows. Clothing: navy blazer over white shirt.
PRESERVE EXACTLY FROM THIS REFERENCE: fruit type, face, figure shape, outfit, accessories, color palette, and overall identity.
This identity is LOCKED for the entire story - never confuse this character with any other.
DO NOT COPY FROM THIS REFERENCE: pose, figure position, arm/hand placement, facial expression, camera angle, or background. This reference is a neutral identity photo, not this scene's action — the pose, expression, framing and environment for THIS image come entirely from the scene description below, not from this reference. SCENE CAST - ONLY these characters may visually appear: A=WIFE_ORANGE, B=CHEATER_BANANA.
Any character NOT in the scene cast above must be completely absent from this image.
Do NOT add random background characters or extras. ⚠ CRITICAL — REFERENCE IMAGES ARE FOR IDENTITY ONLY: the character reference images are neutral identity photos, each one from a DIFFERENT, unrelated moment. Do NOT reproduce their pose, framing, camera angle, or background in this image. Every scene in this story must look visually DISTINCT from every other scene — different pose, different figure position, different camera angle, different framing — driven entirely by THIS scene's specific action and camera direction below, never by what the reference image happens to show. STRICT SCENE RULES:
- Show ONLY these characters: WIFE_ORANGE, CHEATER_BANANA.
- Do NOT show: AFFAIR_PARTNER_PEACH_HOT_PEACH.
- No extra background main characters not in the scene cast.
- Do not merge identities or change one character into another.
- Keep each recurring character's FACE, FRUIT TYPE, and OUTFIT identical to their reference image — but their pose, expression, and figure position in THIS image must match THIS scene's action, not the reference image's pose. SCENE BEAT CONTEXT:
Beat type: HOOK
Story purpose: Open with the couple happy — makes the revelation land harder
Required emotion: happiness with hidden guilt
Required action: two adult characters together as a couple in their home, one partner happy, the other subtly distracted or hiding their phone
Camera/framing: warm medium two-shot showing BOTH adult characters in the same frame
Background: home kitchen or living room, warm golden lighting SCENE DESCRIPTION:
<planner imagePrompt for scene 1 — output of appendStrictImageRules(), typically 1,500-2,500 chars> FINAL ENFORCEMENT:
- Characters MUST be TALL ADULT fruit-human characters — full adult height and adult figure proportions.
- No child-sized characters, no baby proportions, no toddler features.
- Character CLOTHING and FRUIT TYPE must stay identical to their reference images — this is locked.
- Character POSE, EXPRESSION, and figure LANGUAGE must match THIS scene's Required emotion and Required action — NOT the reference image's default pose.
- The BACKGROUND and ENVIRONMENT must reflect the scene's story beat and location (see SCENE BEAT CONTEXT above) — each scene should look visually DISTINCT.
- Characters positioned in this scene must face and interact with each other naturally.
- Reference images are for APPEARANCE ONLY (face, outfit, fruit type, figure shape). Do not copy their pose or background. ABSOLUTE RULE — NO TEXT OF ANY KIND:
NO text, NO captions, NO subtitles, NO speech bubbles, NO dialogue boxes,
NO signs with readable words, NO watermarks, NO logos, NO UI overlays,
NO title cards, NO typography, NO letters or numbers anywhere in this image.
```

</details>

**Rendered example: what Runware actually receives** (first 2,000 chars after whitespace collapse):

<details open>
<summary>positivePrompt as sent to Runware (one line; hard-wrapped at 110 chars for display)</summary>

```text
CRITICAL CHARACTER REQUIREMENT — READ FIRST: ALL characters in this image MUST be TALL ADULT anthropomorphic f
ruit-human characters. FULL ADULT figure proportions — NOT children, NOT babies, NOT toddlers, NOT small figur
es. Characters must have: adult height, adult face structure with mature features, adult clothing, human-like 
adult arms/legs/hands, and adult emotional expressions. If the reference image shows a character with adult pr
oportions, replicate those adult proportions exactly. Do NOT shrink characters into baby or child size. Do NOT
 give them baby faces or child heads. Create a high-quality viral-ready 3D AI fruit story scene with polished 
anthropomorphic fruit characters, cinematic lighting, strong emotion, clean composition, and no text of any ki
nd. SELECTED STYLE: Cinematic 3D VISUAL RULES: - Polished 3D anthropomorphic fruit characters with expressive 
faces and clear figure language. - Cinematic lighting with premium short-form drama contrast. - Clean, readabl
e foreground action with a strong focal point. - TikTok-optimized framing that is instantly understandable wit
hout captions. TIKTOK STORYTELLING RULES: - The image must clearly communicate the scene purpose in a short vi
ral drama sequence. - Use strong facial expressions, readable staging, and visual cause-and-effect. - Avoid fi
ller moments; every scene should escalate, reveal, confront, or resolve. CHARACTER CONSISTENCY RULES: - Preser
ve exact identity of all referenced characters. - Only include the characters listed for this scene. - Do not 
invent extra foreground characters. - Do not merge identities or change one character into another. SCENE COMP
OSITION RULES: - One cinematic moment only; no split panels or collages. - Keep the environment simple enough 
that the emotion reads immediately. - Use dramatic camera angle, lighting, and staging to make the story beat 
obvious. NEGATIVE RULES: - No text, captions, subtitles, speech bubbles, title cards, logos, UI overlays, or w
atermarks. - No rand
```

</details>

---

### 1.6 How dialogue is created, inserted, and voiced

**Sources.** The first non-empty source wins, per scene:

| Priority | Source | Where | When it's used |
|---|---|---|---|
| 1 | **Vision pass** — `fruit-story-video-prompts` writes 3–4 alternating lines from the actual scene image | `useFruitStoryJob.js:362-379` → `buildSceneVideoPromptWithDialogue` | When the vision call returns ≥1 line |
| 2 | **Planner** `scene.videoDialogue[]` (1–2 lines, 4–10 words) | `buildSceneDialogueLines`, `fruitStoryApi.js:664-667` | Vision failed or returned nothing |
| 3 | Lines parsed out of `scene.videoPrompt` text (`SPEAKER: "line"`) | `:669-676`, `extractPromptDialogueLines` `:739-751` | Always empty in the live flow (`videoPrompt` starts `""`) |
| 4 | Hardcoded generic lines by beat ("Wait. What is this?", "I found everything.", …) | `:678-697` | No usable lines above |
| 5 | **Canned line pools** (`SCENE_1_HOOKS_BY_PRESET`, `BEAT_LINE_POOLS`, `VIRAL_LINE_POOLS`), picked by scene number, beat and role keywords | `:337-534` via `sanitizeDialogueLine` fallback | Any line that is non-English, fewer than 2 words, empty, or a missing second speaker |

**Sanitizing:**
- `sanitizeSpeakerName` (`:782-791`) strips role and fruit prefixes, uppercases, and cuts to 16 chars.
- `sanitizeDialogueLine` (`:797-814`) replaces non-ASCII or "non-English" lines with a pool line, strips `, <fruit>` addresses, caps at 10 words and 80 chars.
- `getProviderDialogue` (`:816-865`) removes consecutive same-speaker lines and forces a second speaker when a scene has 2+ characters.
- The vision **override path skips `sanitizeDialogueLine`** (`:984-994`). Vision lines keep their length and punctuation and are only speaker-sanitized.

**Insertion.** Dialogue is written into the `SPOKEN DIALOGUE - SAY EXACTLY THESE ENGLISH WORDS ONLY:` block, formatted as `SPEAKER: "line"` (`formatDialogueBlock`, `:867-869`). The block comes right after the opening, pacing, character-lock, `Cast:` and `Story beat:` lines (`:1086-1127`). With the current ordering it usually falls on the 1,450-char boundary (§1.8).

**Voices.** Each speaker gets a keyword-derived voice line from `inferFruitVoiceStyle` (`:580-604`), written as `Voice:\n<NAME>: <style>.` (`:1017-1020, 1115`). For AI-invented casts:
- the name ("Orange", "Banana") matches no keywords;
- the role is only matched when it contains `cheater` or `mistress`/`affair`.

So most characters get the generic `"expressive fruit-character voice with clear TikTok-drama emotion"`. In any case the `Voice:` section sits after the 1,450-char cut and is never sent.

**Persistence mismatch.** The saved `scene.videoDialogue` / `clip.dialogue` is the **planner's** dialogue (`useFruitStoryJob.js:391-392, 430`). The dialogue actually sent is the vision pass's, after rebuild and truncation (see below). Vision dialogue and `imageObservations` are not persisted.

<details>
<summary><code>src/components/viral-tools/ai-fruit-story/api/fruitStoryApi.js:580-604</code> — inferFruitVoiceStyle() — voice descriptions</summary>

```js
function inferFruitVoiceStyle(nameOrId, roleText = "") {
  const text = `${nameOrId ?? ""} ${roleText ?? ""}`.toLowerCase();
  if (/(boss|gangster|villain|mafia|kingpin|threat|evil)/.test(text)) {
    return "deep, confident, slightly threatening voice with controlled dramatic pauses";
  }
  if (/(mom|mother|wife|aunt|grandma)/.test(text)) {
    return "warm, emotional, dramatic voice with a shaky betrayed edge";
  }
  if (/(kid|baby|son|daughter|child)/.test(text)) {
    return "cute, innocent, slightly higher-pitched voice with anxious timing";
  }
  if (/(cheater|mistress|secret|guilty|affair|hot peach|hotpeach)/.test(text)) {
    return "nervous, defensive voice that tries to sound innocent but cracks under pressure";
  }
  if (/(betrayed|cry|sad|heartbroken|shocked)/.test(text)) {
    return "shaky, emotional voice with wounded dramatic delivery";
  }
  if (/(twin|antagonist|rival|smug)/.test(text)) {
    return "mysterious, smug voice with teasing villain energy";
  }
  if (/(rich|business|ceo|luxury|polished)/.test(text)) {
    return "polished, arrogant voice with expensive confidence";
  }
  return "expressive fruit-character voice with clear TikTok-drama emotion";
}
```

</details>

<details>
<summary><code>src/components/viral-tools/ai-fruit-story/api/fruitStoryApi.js:664-698</code> — buildSceneDialogueLines() — planner → prompt-text → generic fallback</summary>

```js
function buildSceneDialogueLines(scene, form) {
  // 1. Use GPT-generated videoDialogue first (from planner)
  const fromGpt = normalizeClipDialogue(scene?.videoDialogue ?? []);
  if (fromGpt.length) return fromGpt;

  // 2. Try to extract dialogue from GPT's videoPrompt text
  const fromPrompt = scene?.videoPrompt
    ? normalizeClipDialogue(extractPromptDialogueLines(scene.videoPrompt).map((r) => ({
        speaker: r.speaker,
        line: r.line,
      })))
    : [];
  if (fromPrompt.length) return fromPrompt;

  // 3. Last resort: derive a single contextual line from scene metadata
  //    (no hardcoded pools — just a generic dramatic line)
  const characters = getSceneCharacterNames(scene, form);
  const first = characters[0]?.name ?? "Character";
  const second = characters[1]?.name ?? null;
  const beatText = `${scene?.beatType ?? ""} ${scene?.emotionDirection ?? ""}`.toLowerCase();

  const line0 = beatText.includes("hook")        ? "Wait. What is this?"
              : beatText.includes("discovery")    ? "I found everything."
              : beatText.includes("confrontation")? "Tell me the truth now."
              : beatText.includes("payoff")       ? "I am done with you."
              : "Say it. Right now.";
  const line1 = beatText.includes("cheater") || beatText.includes("guilty")
              ? "I can explain, please."
              : "You don't understand this.";

  return normalizeClipDialogue([
    { speaker: first, line: line0 },
    ...(second ? [{ speaker: second, line: line1 }] : []),
  ]);
}
```

</details>

<details>
<summary><code>src/components/viral-tools/ai-fruit-story/api/fruitStoryApi.js:782-869</code> — sanitizeSpeakerName / sanitizeDialogueLine / getProviderDialogue / formatDialogueBlock</summary>

```js
function sanitizeSpeakerName(value, fallback = "Fruit Character") {
  const stripped = stripCompoundId(value);
  return readableCharacterName(stripped || value || fallback)
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // Keep speaker names short — long names bloat the prompt and confuse the model
    .slice(0, 16) || "CHARACTER";
}

// Fruit type names in dialogue cause the video model to generate that fruit character
// from scratch instead of using the reference image. Strip them as addresses.
const FRUIT_ADDRESS_RE = /,\s*(mango|peach|orange|banana|apple|lemon|strawberry|pineapple|ananas|broccoli|cherry|melon)\b\.?/gi;

function sanitizeDialogueLine(value, scene, index = 0) {
  const fallback = buildShortViralLine("", scene, index);
  const raw = normalizeWhitespace(normalizePromptQuotes(value)).replace(/^["']|["']$/g, "");
  let line = looksNonEnglishDialogue(raw) ? fallback : raw
    .replace(/[^\x20-\x7E]/g, "")
    // Remove fruit-type addresses ("you fool, pineapple" → "you fool")
    .replace(FRUIT_ADDRESS_RE, "")
    .trim();
  const words = line.split(/\s+/).filter(Boolean);
  // Max 10 words — natural sentence length for clear spoken dialogue
  if (words.length < 2 || words.length > 10) {
    line = (words.length >= 2 ? words.slice(0, 10).join(" ") : fallback);
  }
  if (line.length > MAX_PROVIDER_DIALOGUE_LINE_CHARS) {
    line = line.slice(0, MAX_PROVIDER_DIALOGUE_LINE_CHARS).replace(/\s+\S*$/, "").trim();
  }
  return line || fallback;
}

function getProviderDialogue({ scenePrompt = "", scene = {}, form = {} }) {
  const characters = getSceneCharacterNames(scene, form);
  const parsed = extractPromptDialogueLines(scenePrompt || scene.videoPromptProvider || scene.videoPrompt);
  const base = parsed.length
    ? parsed
    : buildSceneDialogueLines(scene, form).map((row) => ({ speaker: row.speaker, line: row.line }));

  const speakerCount = Math.max(
    1,
    new Set([
      ...characters.map((char) => sanitizeSpeakerName(char.name || char.id)),
      ...base.map((row) => sanitizeSpeakerName(row.speaker)),
    ]).size,
  );
  const maxLines = speakerCount <= 1 ? 1 : MAX_PROVIDER_DIALOGUE_LINES;

  const rawRows = base.slice(0, maxLines).map((row, index) => ({
    speaker: sanitizeSpeakerName(row.speaker || characters[index]?.name || `Fruit ${index + 1}`),
    line: sanitizeDialogueLine(row.line, scene, index),
  }));

  // Block consecutive same-speaker runs (A,A,B → drop duplicate A) but allow
  // alternating A,B,A,B so the dialogue reads as a real back-and-forth exchange.
  const rows = [];
  for (const row of rawRows) {
    if (rows.length === 0 || row.speaker !== rows[rows.length - 1].speaker) {
      rows.push(row);
    }
  }
  const seenSpeakers = new Set(rows.map((r) => r.speaker));

  // If deduplication left only one row but we have 2+ characters, add the second character's line
  if (rows.length === 1 && characters.length >= 2) {
    const secondName = sanitizeSpeakerName(characters.find(
      (c) => sanitizeSpeakerName(c.name || c.id) !== rows[0].speaker
    )?.name || characters[1]?.name || "Fruit 2");
    if (!seenSpeakers.has(secondName)) {
      rows.push({
        speaker: secondName,
        line: sanitizeDialogueLine("", scene, 1),
      });
    }
  }

  if (rows.length) return rows;
  return [{
    speaker: sanitizeSpeakerName(characters[0]?.name || "Fruit Character"),
    line: sanitizeDialogueLine("", scene, 0),
  }];
}

function formatDialogueBlock(dialogue) {
  return dialogue.map((row) => `${row.speaker.toUpperCase()}: "${row.line}"`).join("\n");
}
```

</details>

<details>
<summary><code>src/components/viral-tools/ai-fruit-story/api/fruitStoryApi.js:484-534</code> — Scene-1 hooks + pickViralLine() (fallback pool selection; pools themselves at :337-482)</summary>

```js
// Scene 1 hooks by preset type
const SCENE_1_HOOKS_BY_PRESET = {
  baby:          ["I have something really important to tell you tonight.", "You are scaring me. What is going on?"],
  "baby":        ["I have something really important to tell you tonight.", "You are scaring me. What is going on?"],
  cheating:      ["Wait — whose number is this in your phone?",            "Do not touch my phone right now."],
  "cheats-back": ["I know exactly what you did to me.",                    "You do not know everything that happened."],
  "secret-twin": ["Something is very seriously wrong here.",               "Everything is completely fine. Just trust me."],
  "kicked-out":  ["This situation cannot keep going on like this.",        "What exactly do you mean by that?"],
  custom:        ["We need to have a serious talk right now.",              "Is everything okay with you? What happened?"],
};

const SCENE_1_HOOK_DEFAULT = ["Wait — whose number is this in your phone?", "Do not touch my phone right now."];

function pickViralLine(name, scene, index) {
  const sceneNum  = Number(scene?.sceneNumber ?? 1);
  const beatType  = String(scene?.beatType ?? "").toLowerCase();
  const storyPreset = String(scene?.storyPreset ?? scene?.preset ?? "").toLowerCase();

  // Scene 1: use preset-specific hook
  if (sceneNum === 1) {
    const row = SCENE_1_HOOKS_BY_PRESET[storyPreset] ?? SCENE_1_HOOK_DEFAULT;
    return row[index === 0 ? 0 : 1];
  }

  // Beat-type pool takes priority over character-role pool
  if (BEAT_LINE_POOLS[beatType]) {
    const pool = BEAT_LINE_POOLS[beatType];
    const row  = pool[sceneNum % pool.length];
    return row[index === 0 ? 0 : 1];
  }

  // Fall back to character-role pools for cheating/drama scenes
  const text = `${name ?? ""} ${beatType} ${scene?.emotionDirection ?? ""} ${scene?.storyPurpose ?? ""} ${scene?.title ?? ""}`.toLowerCase();
  let pool;
  if (/(boss|gangster|mafia|kingpin|brokkolib|broccoli)/.test(text))       pool = VIRAL_LINE_POOLS.boss;
  else if (/(villain|antagonist|gangster pineapple)/.test(text))           pool = VIRAL_LINE_POOLS.villain;
  else if (/(twin|double|copy|doppelganger)/.test(text))                   pool = VIRAL_LINE_POOLS.twin;
  else if (/(cheater|mistress|affair|guilty|hot peach|hotpeach)/.test(text)) pool = VIRAL_LINE_POOLS.cheater;
  else if (/(mom|mother|wife|orange mom|strawberry mom|betrayed|heartbreak)/.test(text)) pool = VIRAL_LINE_POOLS.wife;
  else if (/(grandma|aunt|mama|matriarch)/.test(text))                     pool = VIRAL_LINE_POOLS.mom;
  else if (/(kid|baby|son|daughter|child)/.test(text))                     pool = VIRAL_LINE_POOLS.kid;
  else if (/(shock|twist|reveal|discovery|confrontation)/.test(text))      pool = VIRAL_LINE_POOLS.shock;
  else                                                                       pool = VIRAL_LINE_POOLS.default;

  const row = pool[sceneNum % pool.length];
  return row[index === 0 ? 0 : 1];
}

function buildShortViralLine(name, scene, index = 0) {
  return pickViralLine(name, scene, index);
}
```

</details>

---

### 1.7 `fruit-story-video-prompts` (vision pass)

- **Trigger.** `startSceneVideo` calls it once per scene, right after that scene's image succeeds, with `scenes: [workingScene]` (`useFruitStoryJob.js:362-379`). The request body is built at `fruitStoryApi.js:1154-1175`: `{ scenes: [{ sceneNumber, imageUrl, title, storyPurpose, beatType, emotionDirection, characterIdsInScene }], form: { castBible, storyPreset } }`.
- **Model call** (`:131-151`): `gpt-4o`. The system prompt is followed by one user message that holds the image (`detail: "high"`) and the text below. Parameters: `max_tokens: 400`, `temperature: 0.8`, `response_format: json_object`. There is no timeout.
- **Parsing** (`:159-179`): `JSON.parse`, keep rows that have both `speaker` and `line`, first 4 rows, `imageObservations` capped at 200 chars. **Every failure returns `dialogue: []` with HTTP 200**, so the client silently falls back to planner dialogue.
- **Response:** `{ ok: true, scenes: [{ sceneNumber, dialogue: [{speaker, line}], imageObservations }] }`. The client uses only `dialogue`.
- **Content risk.** The system prompt tells GPT that a species mismatch between image and cast is "the most important rule" and that the characters **must** react to it. A GPT Image 2 render that drifts on fruit type therefore produces dialogue about the wrong fruit ("Why is this baby an orange?!") instead of the story beat.

<details>
<summary><code>supabase/functions/fruit-story-video-prompts/index.ts:69-183</code> — generateSceneDialogue() — full system prompt, user prompt, call, parsing</summary>

```ts
async function generateSceneDialogue(
  scene: SceneInput,
  castBible: CastEntry[],
  storyPreset: string,
): Promise<{ sceneNumber: number; dialogue: DialogueLine[]; imageObservations: string }> {
  const sceneNum = Number(scene.sceneNumber ?? 1);
  if (!scene.imageUrl) return { sceneNumber: sceneNum, dialogue: [], imageObservations: "" };

  const sceneCharIds = scene.characterIdsInScene ?? [];
  const sceneCast = castBible.filter((e) => sceneCharIds.includes(e.id));

  const castLines = sceneCast.length > 0
    ? sceneCast.map((e) => {
        const name = e.displayName ?? e.referenceLabel ?? e.id;
        const fruit = e.fruitType ?? "unknown fruit";
        const role = e.narrativeRole ?? e.role ?? "";
        return `- "${name}" — expected species: ${fruit}${role ? ` (${role})` : ""}`;
      }).join("\n")
    : "- (no cast info)";

  const speakerNames = sceneCast
    .map((e) => `"${e.displayName ?? e.referenceLabel ?? e.id}"`)
    .join(" and ");

  const systemPrompt =
    `You are a dialogue writer for a fruit character drama. Write dialogue based on what you ACTUALLY SEE in the scene image.

RULES:
- Carefully look at every character: count them, identify each one's fruit species (orange, pineapple, banana, etc.)
- If any character looks DIFFERENT from expected (wrong species, unexpected appearance), the other characters MUST notice and react — this is the most important rule
- Example: if pineapple parents have an orange baby, they say "Why is this baby an orange?! We are pineapples!"
- Dialogue must feel like a real back-and-forth conversation
- 3-4 lines total, alternating speakers (A, B, A, B)
- Each line: max 8 words, punchy and dramatic
- Use the exact character names provided
- Return JSON only`;

  const userText =
    `Scene ${sceneNum}: "${scene.title ?? ""}"
Story type: ${storyPreset}
Scene purpose: ${scene.storyPurpose ?? ""}
Emotional tone: ${scene.emotionDirection ?? "shock and drama"}

Expected cast in this scene:
${castLines}

Speaker names to use: ${speakerNames || "the visible characters"}

Look carefully at the image. Do the characters match their expected fruit species?
Write dialogue where the characters react to what's actually happening in the scene.

Return JSON:
{
  "imageObservations": "one sentence: what you see, noting any species mismatches or surprises",
  "dialogue": [
    {"speaker": "Character Name", "line": "short punchy line"},
    {"speaker": "Other Character", "line": "short punchy line"},
    {"speaker": "Character Name", "line": "short punchy line"},
    {"speaker": "Other Character", "line": "short punchy line"}
  ]
}`;

  try {
    const response = await fetch(OPENAI_CHAT, {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: scene.imageUrl, detail: "high" } },
              { type: "text", text: userText },
            ],
          },
        ],
        max_tokens: 400,
        temperature: 0.8,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error(`[fruit-video-prompts] scene ${sceneNum} GPT error`, txt.slice(0, 200));
      return { sceneNumber: sceneNum, dialogue: [], imageObservations: "" };
    }

    const gpt = await response.json();
    const raw = gpt.choices?.[0]?.message?.content ?? "";

    let parsed: any;
    try { parsed = JSON.parse(raw); } catch {
      console.warn(`[fruit-video-prompts] scene ${sceneNum} parse error`, raw.slice(0, 200));
      return { sceneNumber: sceneNum, dialogue: [], imageObservations: "" };
    }

    const dialogue: DialogueLine[] = Array.isArray(parsed.dialogue)
      ? parsed.dialogue
          .filter((r: any) => r?.speaker && r?.line)
          .map((r: any) => ({ speaker: String(r.speaker).trim(), line: String(r.line).trim() }))
          .slice(0, 4)
      : [];

    return {
      sceneNumber: sceneNum,
      dialogue,
      imageObservations: String(parsed.imageObservations ?? "").trim().slice(0, 200),
    };
  } catch (e) {
    console.error(`[fruit-video-prompts] scene ${sceneNum} error`, e);
    return { sceneNumber: sceneNum, dialogue: [], imageObservations: "" };
  }
```

</details>

---

### 1.8 Text video-prompt builder (`buildStrictFruitVideoPrompt`)

The same builder runs up to **three times per clip**:

1. **Fast text prompt** (`useFruitStoryJob.js:356`): `buildSceneVideoPrompt` uses planner dialogue and is capped at 1,450 chars.
2. **Vision prompt** (`:368-376`): `buildSceneVideoPromptWithDialogue` uses the vision dialogue and is capped at 1,450. It is stored as `clip.videoPrompt` / `scene.videoPrompt`.
3. **Inside `animateClip`** (`fruitStoryApi.js:2153-2155`): `buildFruitVideoPrompt` returns the stored prompt, and then **`buildRunwareVideoPrompt(fullPrompt, startScene, form)` rebuilds a fresh prompt from scratch**. The stored prompt is used only as `scenePrompt`, a source for re-extracting dialogue (`getProviderDialogue`, `:818-821`). Lines cut mid-sentence have no closing quote and aren't matched by the extraction regex. Missing second-speaker lines are refilled from the canned pools. For V4 the result then goes through `sanitizePromptForVeo`.

**Ordering and the 1,450-char budget.** The code comment at `:1072` says the required sections come first "so they survive the 1450-char trim". Since the `Cast:` profile block (≤130 chars per character) and the `Story beat:` line were added *before* `SPOKEN DIALOGUE`, this no longer holds. `trimProviderPrompt` (`:1132-1140`) keeps the first `1450 − 263` chars and appends a short `Negative:` line.

In the rendered 2-character example below, everything after the dialogue is lost: `Action`, `Speech rules`, `Audio` (including "No background music"), `Emotion`, `Visual clue`, `Movement`, `Voice`, `Camera`, `Style` and `Ending beat`. The last dialogue line is also cut mid-word. `runware-video` and `runware.ts` then whitespace-collapse the text and cap it at 1,450 again (`runware-video/index.ts:103-114`, `runware.ts:133-145`).

`isFruitVideoPromptReady` (`fruitStoryApi.js:127-138`) would catch this, but it is never called. `pickSoundEffect` (`:887-897`) and `deriveAmbience` (`:899-906`) are also dead.

<details>
<summary><code>src/components/viral-tools/ai-fruit-story/api/fruitStoryApi.js:536-578</code> — getScenePacingRole / deriveVisualClue / deriveEndingBeat</summary>

```js
function getScenePacingRole(scene, form = {}) {
  const sceneNumber = Number(scene?.sceneNumber ?? 1);
  const sceneCount = Number(form.sceneCount ?? 5);
  if (sceneCount <= 3) {
    return ["Instant hook", "Discovery / confrontation", "Twist / cliffhanger"][sceneNumber - 1] ?? "Twist / cliffhanger";
  }
  if (sceneCount <= 5) {
    return ["Instant hook", "Suspicious clue", "Discovery", "Confrontation / twist", "Final shock / cliffhanger"][sceneNumber - 1] ?? "Final shock / cliffhanger";
  }
  return [
    "Instant hook",
    "Suspicious clue",
    "Discovery",
    "Confrontation",
    "Twist",
    "Chaos / escalation",
    "Emotional peak",
    "Last-second proof",
    "Explosive reaction",
    "Final shock / cliffhanger",
  ][sceneNumber - 1] ?? "Final shock / cliffhanger";
}

function deriveVisualClue(scene) {
  const text = `${scene?.title ?? ""} ${scene?.beatType ?? ""} ${scene?.storyPurpose ?? ""} ${scene?.actionDirection ?? ""}`.toLowerCase();
  if (/(phone|text|message|call|dm|screen)/.test(text)) return "a glowing phone with a suspicious unread message";
  if (/(baby|kid|basket|crib|cry)/.test(text)) return "a baby item or basket that changes the whole story";
  if (/(suitcase|kicked|leave|walk away|door)/.test(text)) return "a dropped suitcase by the open door";
  if (/(photo|picture|camera|security|proof)/.test(text)) return "a photo or security footage frame that proves the secret";
  if (/(flower|gift|receipt|lipstick)/.test(text)) return "a suspicious gift, receipt, or mark that exposes the lie";
  if (/(twin|double|copy)/.test(text)) return "a reflected double or hidden matching character reveal";
  return "one clear physical clue from the image that proves the drama";
}

function deriveEndingBeat(scene) {
  const text = `${scene?.beatType ?? ""} ${scene?.title ?? ""} ${scene?.storyPurpose ?? ""}`.toLowerCase();
  if (/(final|payoff|cliff|shock)/.test(text)) return "end on a tight freeze-frame of the most shocked face as the next secret is about to drop";
  if (/(baby|kid)/.test(text)) return "end as the baby item is revealed and everyone freezes";
  if (/(phone|message|text)/.test(text)) return "end as a second notification hits and both characters gasp";
  if (/(door|kicked|walk)/.test(text)) return "end as the door opens or the suitcase drops mid-argument";
  if (/(twin|twist)/.test(text)) return "end as the hidden character steps forward into frame";
  return "end with a sudden gasp, sharp turn, or freeze-frame that makes the viewer want the next clip";
}
```

</details>

<details>
<summary><code>src/components/viral-tools/ai-fruit-story/api/fruitStoryApi.js:871-885</code> — ensureImmediateAction()</summary>

```js
function ensureImmediateAction(value, scene, max = 190) {
  const visualClue = deriveVisualClue(scene);
  // Use in-place reactions only — no "storms forward" or directional movement
  // that causes the model to create a new scene instead of animating the reference
  const fallback = `Character reacts with shock, eyes wide, pointing at ${visualClue} in disbelief. Stays in place.`;
  const action = cleanSectionText(value, fallback, max);
  // Strip directional movement verbs that cause scene changes
  const safe = action
    .replace(/\bstorms?\s+(forward|in|out|away)\b/gi, "reacts")
    .replace(/\bwalks?\s+(away|out|off)\b/gi, "steps back")
    .replace(/\bruns?\b/gi, "reacts")
    .replace(/\bslams?\s+door\b/gi, "reacts to the door");
  if (hasActionVerb(safe) && !hasVagueSlowSceneLanguage(safe)) return cleanSectionText(safe, fallback, max);
  return cleanSectionText(fallback, fallback, max);
}
```

</details>

<details>
<summary><code>src/components/viral-tools/ai-fruit-story/api/fruitStoryApi.js:908-973</code> — Cast profile block + per-character emotion block</summary>

```js
// One compact line per visible character — fruit type, gender/age presentation,
// personality, story role, and emotional arc — so the video model actually knows
// WHO it's animating, not just what they're saying. Mirrors the "Main Characters"
// block from the manual ChatGPT workflow this pipeline is modeled on.
function formatCharacterProfileLine(char, max) {
  const p = char?.profile;
  if (!p) return null;
  const name = sanitizeSpeakerName(char.name || char.id);
  const idBits = [p.fruitType && `${p.fruitType} fruit character`, p.genderPresentation, p.agePresentation]
    .filter(Boolean)
    .join(", ");
  const roleLabel = p.narrativeRole ? p.narrativeRole.replace(/_/g, " ") : "";
  const line = [
    idBits ? `${name} (${idBits})` : name,
    p.personality ? `Personality: ${p.personality}.` : "",
    roleLabel ? `Role: ${roleLabel}.` : "",
    p.emotionalArc ? `Arc: ${p.emotionalArc}.` : "",
  ].filter(Boolean).join(" ");
  return line ? cleanSectionText(line, name, max) : null;
}

function buildCharacterProfileBlock(characters, max) {
  const lines = characters.slice(0, 2)
    .map((char) => formatCharacterProfileLine(char, max))
    .filter(Boolean);
  return lines.length ? lines.join("\n") : null;
}

function buildPerCharacterEmotionBlock(characters, scene, max) {
  const emotionBase = (scene?.emotionDirection || scene?.emotionalBeat || "").toLowerCase();
  if (!characters.length) {
    return cleanSectionText(
      scene?.emotion || scene?.emotionDirection || scene?.emotionalBeat,
      "glossy eyes, clenched jaw, trembling fingers, and a shocked freeze",
      max,
    );
  }
  const lines = characters.slice(0, 3).map((char, idx) => {
    const name = sanitizeSpeakerName(char.name || char.id);
    const roleText = `${char.role || char.id || ""}`.toLowerCase();
    if (idx === 0) {
      if (/(wife|mom|betrayed|hurt|heartbroken|victim)/.test(roleText) || emotionBase.includes("betray") || emotionBase.includes("heartbreak")) {
        return `${name}: betrayed and furious — jaw tight, eyes locked, hands shaking`;
      }
      if (/(husband|cheater|guilty|caught)/.test(roleText) || emotionBase.includes("guilt")) {
        return `${name}: terrified and defensive — frozen still, eyes darting, hands raised`;
      }
      if (emotionBase.includes("shock") || emotionBase.includes("reveal")) {
        return `${name}: in shock — eyes wide, mouth open, stepping back`;
      }
      return `${name}: overwhelmed — ${emotionBase || "intense emotional reaction"}, body frozen`;
    }
    if (idx === 1) {
      if (/(mistress|affair|third|secret)/.test(roleText)) {
        return `${name}: panicked — forced smile, hand reaching to hide evidence`;
      }
      if (/(kid|child|baby|son|daughter)/.test(roleText)) {
        return `${name}: confused — wide innocent eyes, not understanding`;
      }
      return `${name}: stunned — caught completely off guard, stepping back`;
    }
    return `${name}: shocked bystander — staring in disbelief`;
  });
  const result = lines.join(". ");
  return result.length <= max ? result : result.slice(0, max).replace(/\s+\S*$/, "").trim() || lines[0];
}
```

</details>

<details>
<summary><code>src/components/viral-tools/ai-fruit-story/api/fruitStoryApi.js:975-1152</code> — buildStrictFruitVideoPrompt() + trimProviderPrompt() + exported wrappers</summary>

```js
function buildStrictFruitVideoPrompt({ scenePrompt = "", scene = {}, form = {}, max = null, overrideDialogue = null } = {}) {
  const isProviderPrompt = Boolean(max);
  const sceneNumber = Number(scene?.sceneNumber ?? 1);
  const totalScenes = Number(form?.sceneCount ?? 5);
  const pacingRole = getScenePacingRole(scene, form);

  // When vision-generated dialogue is provided, sanitize + deduplicate it;
  // otherwise fall back to the text-based getProviderDialogue.
  let dialogue;
  if (Array.isArray(overrideDialogue) && overrideDialogue.length > 0) {
    const rows = [];
    for (const row of overrideDialogue) {
      const speaker = sanitizeSpeakerName(String(row.speaker ?? ""));
      const line = String(row.line ?? "").trim();
      if (!speaker || !line) continue;
      if (rows.length === 0 || speaker !== rows[rows.length - 1].speaker) {
        rows.push({ speaker, line });
      }
    }
    dialogue = rows.length > 0 ? rows : getProviderDialogue({ scenePrompt, scene, form });
  } else {
    dialogue = getProviderDialogue({ scenePrompt, scene, form });
  }
  const characters = getSceneCharacterNames(scene, form);
  const visualClue = cleanSectionText(scene.visualClue || deriveVisualClue(scene), "one clear physical clue from the image", isProviderPrompt ? 90 : 110);
  const action = ensureImmediateAction(
    scene.action || scene.videoAction || scene.actionDirection || scene.storyPurpose || scene.scenePurpose || scene.title,
    scene,
    isProviderPrompt ? 145 : 190,
  );
  const emotion = buildPerCharacterEmotionBlock(
    characters,
    scene,
    isProviderPrompt ? 110 : 145,
  );
  const camera = cleanSectionText(
    scene.cameraDirection,
    "Vertical 9:16 tight close-up, fast push-in, whip-pan, snap zoom, reaction close-up.",
    isProviderPrompt ? 110 : 135,
  );
  const endingBeat = cleanSectionText(scene.endingBeat || deriveEndingBeat(scene), "end on a shocked freeze-frame before the next secret drops", isProviderPrompt ? 100 : 125);

  // Per-character voice directions — each character speaks with their own distinct style
  const voiceLines = characters.slice(0, 2)
    .map((char) => `${sanitizeSpeakerName(char.name || char.id)}: ${inferFruitVoiceStyle(char.name || char.id, char.role)}.`)
    .join("\n");

  // Scene-aware movement derived from emotion, action data, and character roles
  const emotionHint = cleanSectionText(scene.emotionDirection || scene.emotionalBeat, "", 55);
  const movementFallback = isProviderPrompt
    ? "Reactive in-place animation: intense facial close-ups, expressive eye movement, lip sync, micro-expressions, small defensive or reaching hand gestures. No character leaves or enters frame."
    : "Expressive in-place animation: lip sync, eye reactions, subtle head turns, micro-expressions, small gestures. Characters stay in location.";
  const charMovements = characters.slice(0, 2).map((char) => {
    const name = sanitizeSpeakerName(char.name || char.id);
    const roleText = `${char.role || char.id || ""}`.toLowerCase();
    if (/(wife|mom|betrayed|victim)/.test(roleText)) return `${name}: turns to face partner directly, jaw clenched, points accusingly, eyes locked on them`;
    if (/(husband|cheater|guilty)/.test(roleText)) return `${name}: turns toward partner, raises hands defensively, eyes darting guiltily`;
    if (/(mistress|third|secret)/.test(roleText)) return `${name}: shrinks back, avoids eye contact, reaches to grab phone or bag`;
    if (/(kid|child|baby)/.test(roleText)) return `${name}: looks between the adults, head tilted, innocent confused gesture`;
    return `${name}: turns to face the other character, reacts with ${emotionHint || "shock"}, direct eye contact`;
  });
  const movementSource = charMovements.length >= 2
    ? charMovements.join(". ") + ". Characters face each other directly throughout — no exits."
    : (emotionHint
      ? `Character reacts with ${emotionHint} — expressive face, clear lip sync, strong eye contact toward the other person. No exits.`
      : null);
  const movement = cleanSectionText(
    movementSource,
    movementFallback,
    isProviderPrompt ? 145 : 190,
  );

  // Style descriptor based on the chosen story style
  const storyStyle = getFruitStoryStyle(form.style || form.visualStyle || form.storyStyle);
  const styleLine = storyStyle?.id === "dark-drama"
    ? "Dark cinematic 3D, intense emotional acting, moody atmospheric lighting, controlled dramatic motion, realistic micro-expressions."
    : storyStyle?.id === "cute_pixar_like"
    ? "Cute stylized 3D, warm expressive acting, bright rounded character forms, smooth cheerful motion, big emotive eyes."
    : storyStyle?.id === "dramatic_comedy"
    ? "Stylized 3D comedy-drama, punchy exaggerated reactions, clean expressive motion, strong comedic timing."
    : "Cinematic stylized 3D, highly detailed, expressive character acting, smooth natural motion, realistic micro-expressions.";

  // The reference image IS the scene — animate it, don't create a new one
  const opening = isProviderPrompt
    ? "IMAGE-TO-VIDEO: Animate the EXACT reference image provided. FIRST FRAME = reference image. Keep the IDENTICAL background, room, furniture, and lighting. Characters may turn to face each other directly and hold eye contact. Add expressive facial reactions, clear lip-sync dialogue, and natural conversational gestures. Do NOT move characters out of frame. Do NOT add new environments or locations."
    : "IMAGE-TO-VIDEO: Animate this exact reference image. First frame must match the reference. Keep the same background, room, and lighting. Characters turn toward each other, hold direct eye contact, and speak with clear natural lip-sync. Do not change the scene or add new locations.";
  const sceneTitleNote = scene.title ? ` — "${scene.title}"` : "";
  const storyArcNote = `Scene ${sceneNumber} of ${totalScenes}`;
  const pacingLine = isProviderPrompt
    ? `${storyArcNote}${sceneTitleNote}: ${pacingRole}. Dramatic emotional moment. Characters react and speak — no location change.`
    : `${storyArcNote}${sceneTitleNote}: ${pacingRole}. Emotional dramatic reaction. Characters stay in the same location as the reference image.`;
  // Build per-speaker mouth-control rule from the actual dialogue speakers.
  // Put "ENGLISH WORDS ONLY" first so it survives the 1450-char budget trim.
  const dialogueSpeakers = [...new Set(dialogue.map((r) => r.speaker.toUpperCase()))].slice(0, 2);
  const speechRules = dialogueSpeakers.length >= 2
    ? `ENGLISH WORDS ONLY. ${dialogueSpeakers[0]} lines: ONLY ${dialogueSpeakers[0]} speaks — ${dialogueSpeakers[1]} mouth COMPLETELY CLOSED. ${dialogueSpeakers[1]} lines: ONLY ${dialogueSpeakers[1]} speaks — ${dialogueSpeakers[0]} mouth COMPLETELY CLOSED. Clear full pronunciation. No mumbling.`
    : "ENGLISH WORDS ONLY. Speaker's mouth moves — silent character mouth COMPLETELY CLOSED. Clear full pronunciation. No mumbling.";
  // Required sections come FIRST so they survive the 1450-char trim.
  const audioLine = `Clear English dialogue only — fully pronounced, audible, and intelligible. No background music. Natural room ambience only. No gasps, no mumbling, no muttering, no gibberish, no unintelligible sounds, no foreign words, no singing.`;
  const identityLock = isProviderPrompt
    ? "CHARACTER LOCK: Use ONLY the characters from the reference image. Same fruit type, same face, same hair, same outfit. No redesigns, no new characters, no location change."
    : "CHARACTER LOCK: Animate ONLY the characters shown in the reference image. Same fruit type, same face, same hair, same outfit, same background. No redesigns, no new characters.";
  const negativeLine = isProviderPrompt
    ? "No captions, no subtitles, no text overlays, no watermarks, no new characters, no identity changes, no location change, no background music, no gasps, no sighs, no mumbling, no muttering, no gibberish, no non-English words, no Spanish, no French, no Arabic, no Mandarin, no random foreign syllables, no improvised speech, no unintelligible sounds, no singing, no characters avoiding eye contact."
    : "No captions, no subtitles, no text overlays, no watermarks, no new characters, no identity changes, no location change, no background music, no gasps, no mumbling, no muttering, no gibberish, no non-English words, no Spanish, no French, no Arabic, no random foreign syllables, no improvised speech, no unintelligible sounds, no singing.";

  const storyContextLine = scene.storyPurpose || scene.scenePurpose
    ? cleanSectionText(scene.storyPurpose || scene.scenePurpose, "", isProviderPrompt ? 80 : 100)
    : null;
  const characterProfileBlock = buildCharacterProfileBlock(characters, isProviderPrompt ? 130 : 170);

  const prompt = [
    opening,
    pacingLine,
    identityLock,
    ...(characterProfileBlock ? ["Cast:", characterProfileBlock] : []),
    ...(storyContextLine ? [`Story beat: ${storyContextLine}`] : []),
    "",
    "SPOKEN DIALOGUE - SAY EXACTLY THESE ENGLISH WORDS ONLY:",
    formatDialogueBlock(dialogue),
    "",
    "Action:",
    action,
    "",
    "Speech rules:",
    speechRules,
    "",
    "Audio:",
    audioLine,
    "",
    // Optional sections below — may be trimmed if prompt is too long
    "Emotion:",
    emotion,
    "",
    "Visual clue:",
    visualClue,
    "",
    "Movement:",
    movement,
    "",
    ...(voiceLines ? ["Voice:", voiceLines, ""] : []),
    "Camera:",
    camera,
    "",
    "Style:",
    styleLine,
    "",
    "Ending beat:",
    endingBeat,
    "",
    "Negative:",
    negativeLine,
  ].join("\n");

  return max ? trimProviderPrompt(prompt, max) : prompt;
}

function trimProviderPrompt(prompt, max) {
  if (prompt.length <= max) return prompt;
  const negative = "\nNegative: No captions, no subtitles, no text overlays, no watermarks, no extra characters, no identity changes, no background music, no mumbling, no gibberish, no non-English words, no Spanish, no French, no Arabic, no random foreign syllables, no improvised speech.";
  const budget = max - negative.length;
  // Slice raw string — do NOT use normalizeWhitespace here because it strips newlines
  // which breaks dialogue parsing in extractPromptDialogueLines (it splits on \n)
  const trimmed = prompt.slice(0, budget).replace(/[\s]+$/, "").replace(/\nNegative:[\s\S]*$/, "");
  return (trimmed + negative).slice(0, max);
}

export function buildRunwareVideoPrompt(scenePrompt, scene = {}, form = {}, max = MAX_RUNWARE_VIDEO_PROMPT_CHARS) {
  return buildStrictFruitVideoPrompt({ scenePrompt, scene, form, max });
}

export function buildSceneVideoPrompt({ scene, form = {} }) {
  return buildStrictFruitVideoPrompt({ scene, form, max: MAX_RUNWARE_VIDEO_PROMPT_CHARS });
}

export function buildSceneVideoPromptWithDialogue({ scene, form = {}, dialogue }) {
  return buildStrictFruitVideoPrompt({ scene, form, max: MAX_RUNWARE_VIDEO_PROMPT_CHARS, overrideDialogue: dialogue ?? null });
}
```

</details>

<details>
<summary><code>src/components/viral-tools/ai-fruit-story/api/fruitStoryApi.js:1177-1187</code> — buildFruitVideoPrompt() (returns the stored prompt, which animateClip then rebuilds)</summary>

```js
export function buildFruitVideoPrompt({ clip, startScene, endScene, form }) {
  if (String(clip?.videoPrompt ?? "").trim()) {
    return String(clip.videoPrompt).trim();
  }

  if (String(startScene?.videoPrompt ?? "").trim()) {
    return String(startScene.videoPrompt).trim();
  }

  return buildSceneVideoPrompt({ scene: startScene, form });
}
```

</details>

<details>
<summary><code>src/components/viral-tools/ai-fruit-story/api/fruitStoryApi.js:2116-2177</code> — sanitizePromptForVeo() + animateClip()</summary>

```js
// Veo 3.1 has strict content policy — replaces words that trigger invalidProviderContent.
// Keeps the story structure intact while removing the specific words Veo rejects.
function sanitizePromptForVeo(prompt) {
  return prompt
    .replace(/\bcheating\b/gi,      "hiding a secret")
    .replace(/\bcheated?\b/gi,      "discovered the truth")
    .replace(/\bcheater\b/gi,       "character")
    .replace(/\bcheats?\b/gi,       "reveals")
    .replace(/\baffair\b/gi,        "secret")
    .replace(/\bbetrayal\b/gi,      "revelation")
    .replace(/\bbetrayed\b/gi,      "shocked")
    .replace(/\bbetrays?\b/gi,      "reveals")
    .replace(/\bmistress\b/gi,      "mystery person")
    .replace(/\baffair.partner\b/gi,"character")
    .replace(/\bhot peach\b/gi,     "character")
    .replace(/\bhotpeach\b/gi,      "character")
    .replace(/\binfidelity\b/gi,    "secret")
    .replace(/\bconfront(ation)?\b/gi, "reveal")
    .replace(/\brage\b/gi,          "shock")
    .replace(/\bfurious\b/gi,       "stunned")
    .replace(/\bfury\b/gi,          "disbelief");
}

export async function animateClip({ clip, startScene, endScene, form, videoModel }) {
  const initImageUrls = [clip?.startImageUrl || startScene?.imageUrl].filter(Boolean);

  if (!clip?.startImageUrl || initImageUrls.length === 0) {
    throw new Error(`Clip ${clip?.clipNumber ?? ""} is missing a scene image`);
  }

  const model       = FRUIT_VIDEO_MODELS[videoModel] ?? FRUIT_VIDEO_MODELS[DEFAULT_FRUIT_VIDEO_MODEL];
  const toolKey     = model.toolKey;
  const isVeo       = toolKey === "video:fruitveo31lite";
  const withSound   = model.withSound;
  const aspect      = form.sceneAspect ?? "9:16";
  const dims        = model.dims[aspect] ?? model.dims["9:16"];
  const durationSec = model.duration;
  const fullPrompt  = buildFruitVideoPrompt({ clip, startScene, endScene, form });
  const rawPrompt   = buildRunwareVideoPrompt(fullPrompt, startScene, form);
  const prompt      = isVeo ? sanitizePromptForVeo(rawPrompt) : rawPrompt;

  console.log("[AI FRUIT] create animation clip job", {
    clipNumber: clip.clipNumber,
    startSceneNumber: clip.startSceneNumber,
    toolKey,
    withSound,
    durationSec,
    referenceImages: initImageUrls,
  });

  return createVideoJobSimple({
    subject:           prompt,
    toolKey,
    width:             dims.width,
    height:            dims.height,
    durationSec,
    initImageUrls,
    calculatedCredits: model.credits,
    project_id:        form.project_id ?? null,
    withSound,
  });
}
```

</details>

<details>
<summary><code>src/components/viral-tools/ai-fruit-story/hooks/useFruitStoryJob.js:344-414</code> — startSceneVideo() — text prompt → vision prompt → animateClip with retry</summary>

```js
  const startSceneVideo = useCallback(async (scene, formArg, castBible, videoModel) => {
    const key = `clip:${scene.sceneNumber}`;
    if (inFlightClipKeysRef.current.has(key)) return;
    inFlightClipKeysRef.current.add(key);

    // Carry the cast bible on the form so every video prompt builder can embed
    // each visible character's fruit type/gender/age/personality/role/arc —
    // not just their name and dialogue.
    const f = { ...formArg, castBible };

    try {
      // Phase 1: fast text-based prompt — unblocks launch immediately
      let workingScene = { ...scene, videoPrompt: buildSceneVideoPrompt({ scene, form: f }) };
      setScenes((prev) => prev.map((s) =>
        s.sceneNumber === scene.sceneNumber ? { ...s, videoPrompt: workingScene.videoPrompt } : s,
      ));

      // Phase 2: vision-enhance this one scene (best-effort, keeps text prompt on failure)
      try {
        const visionData = await generateVisionVideoPrompts({
          scenes: [workingScene],
          form: f,
        });
        const v = visionData?.scenes?.[0];
        if (v?.dialogue?.length) {
          workingScene = {
            ...workingScene,
            videoPrompt: buildSceneVideoPromptWithDialogue({ scene: workingScene, form: f, dialogue: v.dialogue }),
          };
          setScenes((prev) => prev.map((s) =>
            s.sceneNumber === scene.sceneNumber ? { ...s, videoPrompt: workingScene.videoPrompt } : s,
          ));
        }
      } catch (err) {
        console.warn(`[AI FRUIT] vision prompt failed for scene ${scene.sceneNumber}, keeping text prompt`, err);
      }

      const modelInfo = FRUIT_VIDEO_MODELS[videoModel] ?? FRUIT_VIDEO_MODELS[DEFAULT_FRUIT_VIDEO_MODEL];
      const clip = {
        clipNumber:         scene.sceneNumber,
        outputLabel:        `Video ${scene.sceneNumber}`,
        displaySceneNumber: scene.sceneNumber,
        startSceneNumber:   scene.sceneNumber,
        startImageUrl:      scene.imageUrl,
        duration:            modelInfo.duration,
        startPrompt:         workingScene.videoPrompt,
        videoPrompt:         workingScene.videoPrompt,
        dialogue:            normalizeClipDialogue(workingScene.videoDialogue ?? []),
        voiceover:           normalizeClipVoiceover(workingScene.videoVoiceover ?? ""),
      };

      setVideoClips((prev) => prev.some((c) => c.clipNumber === clip.clipNumber)
        ? prev.map((c) => (c.clipNumber === clip.clipNumber ? { ...c, ...clip } : c))
        : [...prev, clip]);

      let job, lastErr;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          job = await animateClip({ clip, startScene: workingScene, form: f, videoModel });
          break;
        } catch (err) {
          lastErr = err;
          const isTimeout = /idle.?timeout|504/i.test(err?.message ?? "");
          if (isTimeout && attempt < 2) {
            await new Promise((r) => setTimeout(r, (attempt + 1) * 8000));
          } else {
            throw err;
          }
        }
      }
      if (!job) throw lastErr;
```

</details>

**Rendered example A: the stored prompt (step 2)**, vision dialogue with 4 lines, as stored on `scene.videoPrompt`:

<details open>
<summary>buildSceneVideoPromptWithDialogue() output (1,450 chars)</summary>

```text
IMAGE-TO-VIDEO: Animate the EXACT reference image provided. FIRST FRAME = reference image. Keep the IDENTICAL background, room, furniture, and lighting. Characters may turn to face each other directly and hold eye contact. Add expressive facial reactions, clear lip-sync dialogue, and natural conversational gestures. Do NOT move characters out of frame. Do NOT add new environments or locations.
Scene 1 of 5 — "Sweet Couple Moment": Instant hook. Dramatic emotional moment. Characters react and speak — no location change.
CHARACTER LOCK: Use ONLY the characters from the reference image. Same fruit type, same face, same hair, same outfit. No redesigns, no new characters, no location change.
Cast:
ORANGE (orange fruit character, unspecified, early thirties) Personality: warm and perceptive, slow to anger. Role: victim. Arc:
BANANA (banana fruit character, unspecified, mid thirties) Personality: charming but evasive. Role: cheater. Arc: starts smug and
Story beat: Open with the couple happy — makes the betrayal land harder

SPOKEN DIALOGUE - SAY EXACTLY THESE ENGLISH WORDS ONLY:
ORANGE: "Why is your phone face down?"
BANANA: "No reason, babe. Relax."
ORANGE: "Then flip i
Negative: No captions, no subtitles, no text overlays, no watermarks, no extra characters, no identity changes, no background music, no mumbling, no gibberish, no non-English words, no Spanish, no French, no Arabic, no random foreign syllables, no improvised speech.
```

</details>

**Rendered example B: what Runware actually receives (step 3, V2/V3)**. This is the rebuild from example A, whitespace-collapsed and capped. Only 2 of the 4 vision lines survive, and `Action:` is cut to "Character r":

<details open>
<summary>positivePrompt sent to Runware (hard-wrapped at 110 chars for display)</summary>

```text
IMAGE-TO-VIDEO: Animate the EXACT reference image provided. FIRST FRAME = reference image. Keep the IDENTICAL 
background, room, furniture, and lighting. Characters may turn to face each other directly and hold eye contac
t. Add expressive facial reactions, clear lip-sync dialogue, and natural conversational gestures. Do NOT move 
characters out of frame. Do NOT add new environments or locations. Scene 1 of 5 — "Sweet Couple Moment": Insta
nt hook. Dramatic emotional moment. Characters react and speak — no location change. CHARACTER LOCK: Use ONLY 
the characters from the reference image. Same fruit type, same face, same hair, same outfit. No redesigns, no 
new characters, no location change. Cast: ORANGE (orange fruit character, unspecified, early thirties) Persona
lity: warm and perceptive, slow to anger. Role: victim. Arc: BANANA (banana fruit character, unspecified, mid 
thirties) Personality: charming but evasive. Role: cheater. Arc: starts smug and Story beat: Open with the cou
ple happy — makes the betrayal land harder SPOKEN DIALOGUE - SAY EXACTLY THESE ENGLISH WORDS ONLY: ORANGE: "Wh
y is your phone face down?" BANANA: "No reason, babe. Relax." Action: Character r Negative: No captions, no su
btitles, no text overlays, no watermarks, no extra characters, no identity changes, no background music, no mu
mbling, no gibberish, no non-English words, no Spanish, no French, no Arabic, no random foreign syllables, no 
improvised speech.
```

</details>

**Rendered example C: when the vision pass fails.** The planner's second line was cut in step 1, so the rebuild substitutes a canned scene-1 hook line (`SCENE_1_HOOKS_BY_PRESET.custom[1]`, itself cut mid-word):

<details open>
<summary>positivePrompt sent to Runware when vision returned no dialogue</summary>

```text
IMAGE-TO-VIDEO: Animate the EXACT reference image provided. FIRST FRAME = reference image. Keep the IDENTICAL 
background, room, furniture, and lighting. Characters may turn to face each other directly and hold eye contac
t. Add expressive facial reactions, clear lip-sync dialogue, and natural conversational gestures. Do NOT move 
characters out of frame. Do NOT add new environments or locations. Scene 1 of 5 — "Sweet Couple Moment": Insta
nt hook. Dramatic emotional moment. Characters react and speak — no location change. CHARACTER LOCK: Use ONLY 
the characters from the reference image. Same fruit type, same face, same hair, same outfit. No redesigns, no 
new characters, no location change. Cast: ORANGE (orange fruit character, unspecified, early thirties) Persona
lity: warm and perceptive, slow to anger. Role: victim. Arc: BANANA (banana fruit character, unspecified, mid 
thirties) Personality: charming but evasive. Role: cheater. Arc: starts smug and Story beat: Open with the cou
ple happy — makes the betrayal land harder SPOKEN DIALOGUE - SAY EXACTLY THESE ENGLISH WORDS ONLY: ORANGE: "Wh
o keeps texting you this late at night?" BANANA: "Is everything okay with you? Wha Negative: No captions, no s
ubtitles, no text overlays, no watermarks, no extra characters, no identity changes, no background music, no m
umbling, no gibberish, no non-English words, no Spanish, no French, no Arabic, no random foreign syllables, no
 improvised speech.
```

</details>

---

### 1.9 Server-side content-policy rewrite (video only)

When a video poll fails with a content-policy code or keyword, `runware-video` asks `gpt-4o-mini` to rewrite the prompt and relaunches. This happens at most 2 times per clip, and only if at least 45 s of runtime remain (`runware-video/index.ts:340-367, 686-723`). The rewrite has no length cap, so it is truncated to 1,450 again at launch.

<details>
<summary><code>supabase/functions/runware-video/index.ts:369-418</code> — sanitizePromptWithOpenAI() — system prompt + call</summary>

```ts
async function sanitizePromptWithOpenAI(
  originalPrompt: string,
  attempt: number,
  jobId?: string,
  providerMessage?: string,
): Promise<string> {
  if (!OPENAI_KEY) {
    logEvent("warn", "sanitize_skipped_no_key", { jobId });
    return originalPrompt;
  }

  // Copyright rejections need a different rewrite than safety rejections —
  // stripping "violent/unsafe" wording does nothing for a prompt that got
  // flagged for naming a specific trademarked character, franchise, or
  // place (e.g. "Pokemon Center"). Describe the same silhouette/shape/color
  // in generic, real-world visual terms instead of naming the IP.
  const strictness = isCopyrightFailure(providerMessage)
    ? "The rejection was for referencing copyrighted or trademarked material (a specific character, franchise, brand, or fictional place). " +
      "Find every such named reference and replace ONLY that reference with a purely descriptive, generic real-world visual " +
      "equivalent — its shape, color, materials, and silhouette — without naming the IP, character, or franchise anywhere. " +
      "For example, replace \"Pokemon Center\" with something like \"a rounded building with a large red-and-white " +
      "ball-shaped dome on the roof\". Keep the description vivid and specific about what it visually looks like, just " +
      "never name the source. Leave every other part of the prompt (camera direction, motion, lighting, everything else) unchanged."
    : attempt >= 2
      ? "Be very conservative: strip out anything that could remotely be read as violent, dangerous, harmful to a person, sexual, or otherwise sensitive, even if it seems like a stretch. Keep only the safest possible interpretation of the scene."
      : "Remove or soften wording likely to trigger an automated content-safety filter (references to real harm, weapons, blood, distress, or anything that could be misread as violent or unsafe), while keeping the scene's core action and characters recognizable.";

  const systemMessage =
    `You rewrite AI video generation prompts that were rejected by a provider's content-safety filter (e.g. Google Vertex AI). ` +
    `${strictness} ` +
    `Preserve the overall structure, camera direction, and any dialogue formatting exactly — only change the parts likely causing the rejection. ` +
    `Output ONLY the rewritten prompt text. No explanation, no quotes, no markdown.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: originalPrompt },
        ],
        max_tokens: 800,
        temperature: 0.4,
      }),
    });
```

</details>

---

## 2. Edge functions

### 2.1 Summary

| Function | Called by | Auth | Plan check | JWT at gateway (`supabase/config.toml`) | Timeout |
|---|---|---|---|---|---|
| `fruit-story-ideas` | browser | `auth.getUser(bearer)` via service client → 401 | **none** | default (not listed → `verify_jwt = true`) | none on OpenAI fetch |
| `fruit-story-planner` | browser | `auth.getUser(bearer)` → 401 | **none** | default | OpenAI `AbortSignal.timeout(55_000)` |
| `fruit-story-video-prompts` | browser | **none in function** | **none** | default. Any valid project JWT passes, including the public anon key. | none |
| `job-worker` (shared) | browser `simulateJob` / queue-worker | bearer = service key, or `auth.getUser` + job ownership | `PLAN_GATED_TOOLS` (V3/V4 only) | `verify_jwt = false` (`config.toml:52-53`) | provider handoff not awaited |
| `runware-image` (shared) | job-worker | header `x-job-worker-key === SERVICE_ROLE_KEY` | — | `verify_jwt = false` (`:49-50`) | 5 min polling, 30 s per fetch |
| `runware-video` (shared) | job-worker | same | — | `verify_jwt = false` (`:55-56`) | 350 s runtime, 4 s polls |

### 2.2 `fruit-story-ideas` — `supabase/functions/fruit-story-ideas/index.ts`

- **Input:** POST, empty body. **Output:** `{ ok: true, ideas: string[] }`.
- **Errors:** `405` non-POST, `401` bad token, `502` OpenAI non-2xx or fewer than 5 ideas, `500` unexpected error.
- **Validation:** none needed (no inputs). **Rate limiting:** none. Each call is a fresh gpt-4o-mini call paid by the platform; users are not charged credits.

### 2.3 `fruit-story-planner` — `supabase/functions/fruit-story-planner/index.ts`

- **Input:** see §1.2.
  - `storyIdea` is the only required field (`:1160`), with no length cap.
  - `sceneCount` is **not validated**. A non-number yields `Array.from({length: NaN})` → 0 scenes; a large number inflates the prompt, but output is capped by `max_tokens: 5500`.
  - `selectedCharacters[].image*` URLs would be sent to OpenAI as vision inputs (currently always empty).
- **Output:** see §1.2.
- **Errors:**
  - `400` missing idea or invalid JSON
  - `401`
  - `500` OpenAI error, 55 s timeout, JSON parse failure (including `finish_reason: "length"` truncation) or bad structure
- **Logging:** the first 60 chars of `storyIdea` and the user id go to function logs (`:1158, 1283`).
- **No retry.** The client shows the error and the user clicks Generate again.

### 2.4 `fruit-story-video-prompts` — `supabase/functions/fruit-story-video-prompts/index.ts`

- **Input:** `{ scenes: SceneInput[], form: { castBible, storyPreset } }`. Only a non-empty `scenes` array is required (`:57`). There is **no cap on `scenes.length`**, and all scenes run in parallel with `Promise.all` (`:62-64`). Each scene is one GPT-4o vision call at `detail: "high"`.
- **Auth:** none in the function. `OPENAI_API_KEY` presence is the only check (`:51`). It is callable by anyone holding the public anon key, so it is an **open GPT-4o spend endpoint** that also fetches an arbitrary `imageUrl` via OpenAI.
- **Errors:** per-scene failures are swallowed (`dialogue: []`); `400` for bad JSON or an empty `scenes` array.
- **Timeout:** none. A hung OpenAI request holds the client's `startSceneVideo` until the platform kills the function.

### 2.5 Shared pipeline functions

`job-worker`, `runware-image` and `runware-video` are documented in §3. They are shared by every generation tool.

---

## 3. Job system & provider calls

### 3.1 Job creation (browser, `src/lib/jobs.ts`)

| Step | Image (`createImageJobSimple`, `:453-680`) | Video (`createVideoJobSimple`, `:683-817`) |
|---|---|---|
| Price | `link.credits` (2) → overridden by `chargeCreditsOverride` (2); `priceUSD = credits × 0.02` | `calculatedCredits` from `FRUIT_VIDEO_MODELS` (12 / 17 / 29) |
| Profile read | `plan_code, credit_balance` | same, plus the sum of `charge_credits` on the user's `queued`/`running` jobs |
| Plan rule | `free`/`trial` → only `image:flux.base`, otherwise `LOCKED_GENERATOR` (**client code**) | none |
| Balance rule | `credit_balance < credits` → `INSUFFICIENT_CREDITS` (**pending jobs are not subtracted**) | `balance − pending < credits` → `INSUFFICIENT_CREDITS` |
| Row insert | `createJob` (`:174-242`) via `simulateJob` (`:443-448`) | same |

**`createJob` inserts** `{ id, user_id, type, tool_key, project_id, prompt, settings, input, status: "queued", progress: 0, charge_credits: settings.credits, charged: false, priority, plan_code, provider: "runware", attempts: 0, max_attempts: 5, retry_after: now }`. It first calls `normalizeReferencePayload`, which uploads non-URL refs to `generation-references`. Fruit refs are already public URLs, so nothing is uploaded.

**Priority** comes from `getPlanPriority` (`src/lib/queuePriority.*`): generative 1, pro 2, starter 3, else 9.

**Dispatch.** `simulateJob` then calls `supabase.functions.invoke("job-worker", { body: { jobId } })` fire-and-forget (`jobs.ts:429-448`).

**Stored job shapes for Fruit:**

```jsonc
// image job (portrait or scene)
input:    { tool: "image", subject: "<master prompt>", style: null, creation_type: "photo",
            negative: "text, letters, watermark, logo, caption, blurry, low-res, oversharpen, artifact",
            brand: { id: null, use_palette: false }, init_image_url: null,
            ref_images: ["https://…/generated/runware/images/<portraitJobId>.png", …],   // omitted for portraits
            width: 720, height: 1280 }
settings: { tool_key: "image:fruit-v2", size: "720x1280", credits: 2, priceUSD: 0.04, creation_type: "photo",
            provider_hint: { engine: "runware", mode: "t2i", edgeFn: "/functions/v1/runware-image",
                             airTag: "openai:gpt-image@2",
                             settings: { quality: "low", fruitModel: "zyvo-v2", skipResponse: true,
                                         deliveryMethod: "async", outputQuality: 85 } } }
prompt:   "<subject>, clean composition, sharp focus, high detail"

// video job
input:    { tool: "video", creation_type: "video", subject: "<video prompt>", durationSec: 5|6,
            ref_images: ["<scene image URL>"], withSound: true, width, height }
settings: { tool_key, credits: 12|17|29, charged: true /* "credit check passed" only */, priceUSD,
            creation_type: "video", provider_hint: { engine: "runware", mode: "t2v", edgeFn, airTag } }
prompt:   "<video prompt>"
```

### 3.2 Dispatch — `supabase/functions/job-worker/index.ts`

1. **Auth** (`:167-179`). A service-key bearer, or a user JWT validated with `auth.getUser`. A user caller must own the job (`:207-217`).
2. **Concurrency gate** (`:181-198, 249-277`):
   - "Live" jobs are `running`/`processing` rows with an unexpired lease and a heartbeat under 5 min old.
   - Limits come from env, defaults image 8, video 8, total 15, and are **global across all users and tools**.
   - If the gate is full, job-worker schedules itself again after 15 s (`EdgeRuntime.waitUntil`) and returns `202`.
3. **Claim** (`:329-355`). `claim_generation_job` RPC sets `status → running`, a 180 s lease, and `submission_state = pending`. A duplicate claim is a no-op.
4. **Validation.** Job type, tool_key, provider link (`:357-374`).
5. **Plan gate** (`:376-389`). See §5.
6. **30 Days reservation check** (`:391-418`). Not applicable to Fruit.
7. **Reference materialization** (`:420-450`, `_shared/referenceImages.ts`). `storage://` refs become 2-hour signed URLs, and every ref is checked to be public HTTPS, not private or loopback, and not expired.
8. **Progress 10 %** via `bump_job_progress` (`:452-460`).
9. **Handoff** (`:482-632`). The payload below is POSTed to `SUPABASE_URL + provider.edgeFn` with the `x-job-worker-key` header, **without awaiting generation**:
   - **Non-2xx, retryable** (Runware `insufficientCredits`, concurrency or rate-limit): re-queue with backoff 5/10/20/45/90 s, up to `max_attempts` (5), then `fail_and_refund` with `PROVIDER_BUSY`.
   - **Other non-2xx:** `fail_and_refund` with `PROVIDER_HANDOFF_REJECTED`.
   - **Fetch threw:** `mark_generation_reconciliation_required`.

<details>
<summary><code>supabase/functions/job-worker/index.ts:482-511</code> — Handoff payload job-worker → runware-image / runware-video</summary>

```ts
    const payload =
  job.type === "image"
    ? {
        ...(providerInput ?? {}),
        jobId,
        airTag: provider.airTag,
        prompt: job.prompt ?? providerInput?.subject ?? "",
        referenceImages,
        settings: {
          ...(job.settings ?? {}),
          width: providerInput?.width,
          height: providerInput?.height,
        },
        recoverExistingProvider,
        workerId,
      }
    : {
        ...(providerInput ?? {}),
        jobId,
        airTag: provider.airTag,
        prompt: job.prompt ?? providerInput?.subject ?? "",
        width: providerInput?.width,
        height: providerInput?.height,
        durationSec: providerInput?.durationSec,
        referenceImages,
        withSound: providerInput?.withSound ?? false,
        workerId,
        recoverExistingProvider,
        existingProviderTaskId: job.provider_task_id ?? (job.settings as any)?.provider_job_id ?? null,
      };
```

</details>

### 3.3 toolKey → provider → model

| Fruit use | toolKey | Provider fn | Runware `model` (AIR) | Generator | Defined |
|---|---|---|---|---|---|
| Portraits + scene images ("zyvo-v2") | `image:fruit-v2` | `runware-image` | `openai:gpt-image@2` | GPT Image 2 | `src/lib/providers.ts:533-544` |
| V2 clips | `video:seedance15pro` | `runware-video` | `bytedance:seedance@1.5-pro` | Seedance 1.5 Pro | `providers.ts:649-660` |
| V3 clips | `video:viduq3turbo720` | `runware-video` | `vidu:4@2` | Vidu Q3 Turbo | `providers.ts:868-879` |
| V4 clips | `video:fruitveo31lite` | `runware-video` | `google:veo@3.1-lite` | Veo 3.1 Lite | `providers.ts:821-832` |
| Planner / vision / ideas / content rewrite | — (direct OpenAI) | edge fns | `gpt-4o`, `gpt-4o-mini` | OpenAI Chat Completions | hardcoded in each fn |

Client model map: `FRUIT_IMAGE_MODEL_TO_TOOLKEY` (`fruitStoryApi.js:30-32`) and `FRUIT_VIDEO_MODELS[*].toolKey` (`:39-90`). `src/lib/providers.ts` is imported **by the Deno job-worker too** (`job-worker/index.ts:5`), so it is the one registry both sides share.

### 3.4 Exact Runware payloads

**Image task** (`runware-image/index.ts:767-811`), shown with the values a Fruit scene job resolves to:

```jsonc
[{
  "taskType": "imageInference",
  "taskUUID": "<jobs.id>",                 // deterministic per DB job (settings.provider_job_id || jobId)
  "model": "openai:gpt-image@2",
  "positivePrompt": "<job.prompt, whitespace-collapsed, sliced to 2000 chars>",
  "negativePrompt": "text, letters, watermark, logo, caption, blurry, low-res, oversharpen, artifact",
  "width": <snapToSupportedDimensions(720,1280)>, "height": <…>,   // 720×1280 is not an approved GPT-Image-2 size; snapped (e.g. toward 768×1360)
  "numberResults": 1,
  "includeCost": true,
  "deliveryMethod": "async",
  "outputType": ["URL"],
  "skipResponse": true,
  "outputQuality": 85,
  "inputs": { "referenceImages": ["<Runware imageUpload URL of portrait A>", "<… B>", …] },  // omitted for portraits; capped at 4 (imageDimensionPolicy.ts:169)
  "providerSettings": { "openai": { "quality": "low" } }
}]
```

- **References** are re-hosted first. Each portrait URL goes through a Runware `imageUpload` task (`uploadImageToRunware`, `:414-440`; default `referenceInputMode: "upload"`).
- **Any upload failure fails the job** with `REFERENCE_TRANSPORT_FAILED` (`:736-747`).
- **Stale comment:** the comment "GPT Image 2 allows only 1" (`:793-794`) is stale. The policy table allows 4.
- **No steps or seed parameters are sent.**

**Video tasks** (`supabase/functions/runware-video/runware.ts`). `positivePrompt` is whitespace-collapsed and ≤ 1,450 chars. `inputs.frameImages` is the scene image URL (a public Supabase `generated` URL), passed directly with no re-upload.

| Field | V2 `bytedance:seedance@1.5-pro` (`:311-332`) | V3 `vidu:4@2` (`:346-366`) | V4 `google:veo@3.1-lite` (`:155-176`) |
|---|---|---|---|
| `taskType` | `videoInference` | `videoInference` | `videoInference` |
| `width×height` (9:16) | 496×864 | 720×1280 | 1080×1920 |
| `duration` | `clamp(4..12, round(5))` = 5 | 5 | 6 |
| `fps` | 24 | — | — |
| audio | `providerSettings.bytedance: { cameraFixed: false, audio: true }` | `providerSettings.vidu: { audio: true }` | `providerSettings.google: { generateAudio: true, personGeneration: "allow_all" }` |
| `outputFormat` / `outputQuality` | `mp4` / 85 | `MP4` / 95, `outputType: "URL"` | — / — |
| `deliveryMethod` | — (not set) | `async` | — (not set) |
| `includeCost` | true | true | true |
| refs | `inputs.frameImages: refs.slice(0,2)` | `inputs.frameImages: refs.slice(0,2)` | `inputs.frameImages: refs.slice(0,2)` |
| `taskUUID` | jobId (content retries: jobId with last 2 hex chars = attempt) | same | same |

Negative prompts are not supported or sent for video; negatives live inside the positive text.

### 3.5 How results come back

**No webhooks.** Every stage is polled.

| Hop | Mechanism |
|---|---|
| Runware → runware-image | `getResponse` every 1.5 s for up to 5 min. On timeout, one `getTaskDetails` recovery attempt (`runware-image/index.ts:905-1005`). |
| Runware → runware-video | `getResponse` every 4 s within a 350 s budget (`runware-video/index.ts:615-750`; `pollRunware` in `runware.ts:552-613`). |
| Provider fn → DB | Result copied to Storage, then `complete_generation_job` RPC (§4). Failures go through `fail_and_refund_generation_job`. |
| DB → browser | `watchJob` (`src/lib/jobs.ts:398-428`): Supabase **realtime** `postgres_changes` on `jobs` **plus** a 1.5 s `getJob` polling loop until terminal. |
| Stuck jobs | `queue-worker` `recoverStaleJobs` (`queue-worker/index.ts:98-139`). Leases expired with a heartbeat older than 30 s: submitted rows go to job-worker `recoverExistingProvider`, and unsubmitted rows are re-queued. Its schedule is not defined in this repo. |

### 3.6 Job progress values written

| Stage | Image | Video |
|---|---|---|
| Claimed | 10 | 10 |
| Accepted | 5 → 10 (refs uploaded) → 15 (task accepted) | 25 |
| Polling | 15–90: synthetic from elapsed time, or `15 + 0.75 × provider progress` | 25–95, eased over 350 s (`computeProgress`, `:116-128`) |
| Storing result | 95 / 98 | — |
| Done | 100 | 100 |

The client turns these into per-scene bars. See UI audit §4.2.

### 3.7 Retries, timeouts, concurrency, rate limits

| Layer | Behaviour | Where |
|---|---|---|
| Client, planner | No retry. Server abort after 55 s. | `useFruitStoryJob.js:593-598` |
| Client, portrait / scene wait | 4.5 min per job, then treated as failed for sequencing; the watcher keeps listening | `useFruitStoryJob.js:37-53` |
| Client, video job creation | 3 attempts, only on `idle timeout` / `504`, with 8 s and 16 s backoff | `useFruitStoryJob.js:399-414, 921-935` |
| Client, vision pass | No timeout. Failure falls back to text prompt. | `:361-379` |
| job-worker, concurrency | Global 8 image / 8 video / 15 total (env). Full → self re-invoke after 15 s. | `job-worker/index.ts:183-277` |
| job-worker, provider 402 / rate limit | Re-queue with backoff 5→90 s, max 5 attempts. **No in-repo dispatcher re-sends these `jobs` rows** (§0.6). | `:564-619` |
| runware-image, submit | Single attempt with deterministic `taskUUID`. A lost response enters polling. `taskNotFound` and `failedTaskTimeout` are tolerated while polling. | `:844-885, 957-965` |
| runware-image, timeout | 5 min, then `getTaskDetails`, then `reconciliation_required` (the job stays `processing`) | `:980-1005` |
| runware-video, 402 at launch | Sets `queued` and **sleeps 3 min inside the same invocation** (`waitUntil`), then retries once. That uses most of the 350 s budget and the ~400 s platform limit. | `runware-video/index.ts:224-264` |
| runware-video, content policy | Up to 2 GPT-4o-mini rewrites and relaunches if ≥45 s remain | `:686-723` |
| runware-video, polling | 8 consecutive poll errors, or 350 s elapsed → `reconciliation_required`. The client can call `action: "reconcile"` via job-worker (`reconcileVideoJob`, `jobs.ts:365-374`); **Fruit never calls it**. | `:617-760, 776-837` |
| Rate limiting of Fruit endpoints | **None** (ideas, planner, vision) | — |

---

## 4. Credits (server side)

### 4.1 Cost per toolKey

| Item | Credits | Defined in | Server check? |
|---|---|---|---|
| Portrait image (`image:fruit-v2`) | 2 | `fruitStoryApi.js:1847` → `getFruitImageCreditsPerImage(…, [])`; fallback `providers.ts:542` | none (client-declared) |
| Scene image (`image:fruit-v2`) | 2 (3 if `selectedCharacters.length ≥ 3`, which never happens) | `fruitStoryApi.js:149-156, 1888` | none |
| V2 clip (`video:seedance15pro`, 5 s, audio) | 12 (marked "ESTIMATE, not measured") | `fruitStoryApi.js:47-52` | `KNOWN_VIDEO_PRICES` covers only the **no-sound** 496×864 signature (6 cr), so it doesn't apply |
| V3 clip (`video:viduq3turbo720`, 5 s) | 17 | `fruitStoryApi.js:67` | none |
| V4 clip (`video:fruitveo31lite`, 6 s) | 29 | `fruitStoryApi.js:82` | none |
| OpenAI calls (ideas, planner, vision, content rewrite) | 0 (not billed to the user) | — | — |

The `providers.ts` per-second fields (`baseCreditsPerSecond`, `soundCreditsPerSecond`) are not used by Fruit: the client passes `calculatedCredits` explicitly. `jobs.charge_credits = settings.credits` is taken from the browser insert (`jobs.ts:214`). No trigger or RPC re-prices Fruit jobs; the only re-pricing trigger in migrations is for 30 Days (`20260824000000_thirty_days_video_reservation_pricing.sql:44`).

### 4.2 When credits move

| Event | Image jobs | Video jobs |
|---|---|---|
| Creation (browser) | Balance **check** only | Balance − pending **check** only |
| Provider launch | — | **`charge_job_credits` before the Runware submit** (`runware-video/index.ts:553-569`). If it fails, the job fails with `INSUFFICIENT_CREDITS`. |
| Success | **`complete_generation_job` → `charge_job_credits` → `deduct_credits`** (`20260802010000_generation_job_safety.sql:247-290`) | `complete_generation_job` (already charged, idempotent) |
| Failure | `fail_and_refund_generation_job`. Nothing was charged, so the job is only marked failed. | `fail_and_refund_generation_job` refunds `charge_credits` to `profiles.credit_balance`, decrements `credits_spent_today`, and writes a ledger `refund` row (`:292-318`) |
| Reconciliation required (timeouts, ambiguous submits) | Not charged; stays `processing` | **Charged, not refunded** until a reconcile or sweep resolves it |

### 4.3 Idempotency and ledger

- `generation_credit_ledger` has `UNIQUE(job_id, operation)` and `UNIQUE(idempotency_key)`, with keys like `"<jobId>:charge"` (`generation_job_safety.sql:78-96`).
- `charge_job_credits` returns `true` if a charge already exists; it holds a row lock (`FOR UPDATE`) and refuses refunded jobs.
- `deduct_credits` (`20260427000000_deduct_credits_track_spent_today.sql`) atomically decrements with a `credit_balance >= amount` guard and raises `INSUFFICIENT_CREDITS`.
- The trigger `enforce_generation_job_terminal_state` blocks any status change out of a terminal state and blocks refunded jobs from becoming `succeeded` (`:338-352`).

### 4.4 What happens on failure or low balance

- **Image generated but balance too low at completion.** `charge_job_credits` returns `false`, so `complete_generation_job` returns `false` **without changing status**. The job stays `processing`, holding no charge. The Runware image exists and was paid for by the platform. `runware-image` only logs `accepted: false` (`:545-567`), and the client never sees a terminal state. Fruit makes this likely: video clips charge **at launch** while later scene images are still rendering, and the image pre-check doesn't subtract pending jobs.
- **Video launch with insufficient balance:** the job fails with `INSUFFICIENT_CREDITS` and no refund is needed. The UI shows only "Failed" (UI audit §5.4).
- The client's optimistic "−N credits" pop has no server counterpart (UI audit §9.3 #5).

### 4.5 Where the per-story total comes from

The Generate-button total (UI audit §5.2) is purely a client estimate. The server only ever sees individual job rows. There is no story-level reservation, as 30 Days has (`billing_reservation`, `job-worker/index.ts:391-418`). A Fruit story can therefore be **partially** paid for and partially fail with `INSUFFICIENT_CREDITS`.

### 4.6 Is Runware's real cost logged?

| Channel | Behaviour |
|---|---|
| Request | `includeCost: true` on every image and video task |
| Image jobs | The raw Runware poll or create response (which carries `cost` when Runware returns it) is stored as `jobs.output` via `complete_generation_job(p_output)` (`runware-image/index.ts:545-550`). **Nothing reads it.** |
| Video jobs | `complete_generation_job(p_output: null)` (`runware-video/index.ts:148-153`), so the cost is **discarded** |
| Other | `system_logs` entries (`_shared/systemLog.ts`) don't include cost |

Margin figures in `providers.ts` and `fruitStoryApi.js` comments come from manual invoice checks.

---

## 5. Plan gating (server side)

**Enforcement point:** `isToolAllowedForUser` in `job-worker/index.ts:94-118`, called before any charge (`:380-389`). A blocked job goes to `fail_and_refund_generation_job(..., "PLAN_UPGRADE_REQUIRED", …)` and the caller gets `403`.

| toolKey | Required plan | Fruit tier |
|---|---|---|
| `video:viduq3turbo720` | `pro` | V3 (shared with Clay Rescue V3 and Face ASMR V3) |
| `video:fruitveo31lite` | `generative` | V4 (Fruit-only key) |
| `image:fruit-v2`, `video:seedance15pro` | — (not listed, so allowed for every plan including `free`) | images, V2 |

- **Tier order** is `["free","starter","pro","generative"]` (`:60`). Unknown codes, including `affiliate`, rank as `free`.
- **Duplicated order.** The same order is duplicated client-side in `src/lib/planGating.js:8`, and the comment asks for the two copies to be kept in sync by hand.

**Endpoint matrix:**

| Endpoint | Auth | Plan |
|---|---|---|
| `fruit-story-ideas` | user JWT | ✗ |
| `fruit-story-planner` | user JWT | ✗ |
| `fruit-story-video-prompts` | ✗ (gateway JWT only) | ✗ |
| `job-worker` | user JWT + ownership, or service key | ✓ V3/V4 only |
| `runware-image`, `runware-video` | shared secret header | (inherits job-worker) |
| `createImageJobSimple` free/trial lock | **client-side only** | — |
| AI Fruit Story paywall (guest/free) | **client-side only** (`AIFruitStory.jsx`) | — |

A free-plan user with a credit balance can therefore generate Fruit images and V2 clips by creating `jobs` rows directly, paying the client-declared price.

---

## 6. Database

### 6.1 `public.fruit_story_generations`

<details>
<summary><code>supabase/migrations/20260509000000_fruit_story_generations.sql:1-48</code> — Full migration (schema, index, RLS, trigger)</summary>

```sql
-- fruit_story_generations
-- Persists every AI Fruit Story image-generation session so users can
-- return, restore, and animate their saved scene packs.

create table if not exists public.fruit_story_generations (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  title          text,
  story_angle    text,
  story_idea     text,
  scene_count    int         default 6,
  scene_aspect   text        default '9:16',
  image_model    text        default 'zyvo-v2',
  animation_model text,
  status         text        default 'generating_images',
  cast_data      jsonb       default '[]'::jsonb,
  planner_output jsonb       default '{}'::jsonb,
  scenes         jsonb       default '[]'::jsonb,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Index for fast per-user queries ordered by newest first
create index if not exists fruit_story_generations_user_created
  on public.fruit_story_generations (user_id, created_at desc);

-- RLS
alter table public.fruit_story_generations enable row level security;

-- Users can only read, write, and delete their own rows
create policy "fruit_story_generations_owner_all"
  on public.fruit_story_generations
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at on every row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger fruit_story_generations_updated_at
  before update on public.fruit_story_generations
  for each row execute procedure public.set_updated_at();
```

</details>

- **Only migration** touching this table. There is no later ALTER.
- **Default mismatch.** `scene_count` defaults to `6`; the client always writes 3, 5, 7 or 10.
- **Status.** `status` is free text with no CHECK. Values actually written by the client: `generating_images`, `images_generated`, `partial_failed`, `completed`. `animating` is never written (UI audit §9.2).
- **Writes.** All writes come from the browser with the user's JWT: `createFruitStoryGeneration`, `updateGenerationScenes`, `deleteFruitStoryGeneration` (`fruitStoryApi.js:2192-2273`). No edge function reads or writes this table.
- **Delete** removes only this row. The `jobs` rows and Storage objects remain.

**jsonb shapes:**

```jsonc
// scenes[] — written by scenesForDB (useFruitStoryJob.js:133-154), whole array replaced on every update
{ "sceneNumber": 1, "title": "…", "beatType": "hook", "storyPurpose": "…",
  "charactersInScene": ["wife_orange","cheater_banana"], "forbiddenCharacters": ["affair_partner_…"],
  "imagePrompt": "<planner imagePrompt (appendStrictImageRules output)>",
  "videoPrompt": "<stored video prompt — NOT the one actually sent, see §1.8>",
  "videoVoiceover": "ORANGE: \"…\"\nBANANA: \"…\"" | null,       // derived from planner dialogue
  "videoDialogue": [{ "speaker": "Orange", "line": "…", "emotion": "dramatic" }] | null,   // planner's, not vision's
  "imageJobId": "<jobs.id>" | null, "imageUrl": "https://…/generated/runware/images/<id>.png" | null,
  "imageStatus": "queued|running|processing|succeeded|failed|canceled",
  "videoClipNumber": 1 | null, "videoEndSceneNumber": null,
  "videoJobId": "<jobs.id>" | null, "videoUrl": "https://…/generated/runware/videos/<id>.mp4" | null,
  "videoStatus": "idle|queued|running|processing|succeeded|failed|canceled" }
// NOT persisted: emotionDirection, actionDirection, cameraDirection, backgroundDetail, environment,
// continuityFromPrevious, negativePrompt, captionText, error, progress — restore fills them with ""/defaults
// (useFruitStoryJob.js:476-492), so a regenerated image after "Continue" loses its beat context.

// cast_data[] — plan.cast after mergeCastWithPlanner, plus portraitUrl mutated in by the client before insert
{ "id": "wife_orange", "sourceCharacterId": "ai_cast_orange_0", "role": "victim",
  "referenceLabel": "WIFE_ORANGE", "label": "WIFE_ORANGE", "displayName": "Orange",
  "narrativeRole": "victim", "fruitType": "orange", "genderPresentation": "unspecified",
  "identityLock": "…", "visualIdentity": "…", "appearance": "…", "clothing": "…",
  "narrativeFunction": "…", "relationships": "…", "personality": "…",
  "agePresentation": "early thirties", "emotionalArc": "…", "synthetic": true,
  "portraitUrl": "https://…/generated/runware/images/<portraitJobId>.png" }

// planner_output — only three planner fields are kept (useFruitStoryJob.js:683)
{ "title": "…", "hook": "…", "storyDNA": { "conflictBucket", "archetype", "hookType", "revealType",
  "setting", "endingType", "twistType", "emotionalTone", "pacingStyle" } }
// storySummary and per-scene imageObservations are discarded; storyAngle goes to the story_angle column.
```

### 6.2 `public.jobs` (shared)

**Not created by any migration in this repo.** The base table predates the migrations folder. Columns known from `createJob` and later migrations:

| Group | Columns |
|---|---|
| Identity | `id` uuid PK, `user_id`, `type` (`image`/`video`/…), `tool_key`, `project_id`, `provider` (default `runware`) |
| Content | `prompt`, `settings` jsonb, `input` jsonb, `output` jsonb, `result_url`, `error`, `error_code` |
| State | `status` (`queued`/`running`/`processing`/`succeeded`/`failed`/`canceled`), `progress`, `submission_state` (CHECK: pending/submitting/submitted/reconciliation_required/completed/failed/canceled), `reconciliation_reason` |
| Billing | `charge_credits`, `charged`, `credits_charged_at`, `credits_refunded_at` |
| Queue | `priority` (default 9), `plan_code` (default `free`), `attempts`, `max_attempts` (5), `retry_after` |
| Leases | `claimed_at`, `claimed_by`, `heartbeat_at`, `lease_expires_at`, `locked_at`, `locked_by` |
| Provider | `provider_task_id`, `dispatch_key` uuid (unique) |
| Timestamps | `created_at`, `updated_at`, `started_at`, `completed_at`, `failed_at` |

- **Migrations:** `20260723000000_jobs_worker_schema_repair.sql` (queue columns and indexes `jobs_worker_pick_idx`, `jobs_processing_provider_idx`, `jobs_user_created_idx`, `jobs_plan_priority_idx`) and `20260802010000_generation_job_safety.sql` (lease, submission and ledger columns; unique `jobs_dispatch_key_uidx`; partial unique `jobs_provider_task_uidx (provider, provider_task_id)`; `jobs_expired_lease_idx`; trigger `enforce_generation_job_terminal_state`).
- **RLS on `jobs` is not defined anywhere in the repo.** The browser inserts, selects and subscribes to it, so policies and the realtime publication exist only in the live database. **Verify** which columns `authenticated` may set on insert. This is the root of the client-declared price issue (§0.3).

**RPCs used by Fruit jobs**, all `SECURITY DEFINER` and granted to `service_role` only (`generation_job_safety.sql:108-331, 354-369`):
- `claim_generation_job`
- `heartbeat_generation_job`
- `adopt_expired_generation_job`
- `requeue_expired_unsubmitted_job`
- `reserve_provider_submission`
- `record_provider_submission`
- `replace_provider_submission_for_retry`
- `mark_generation_reconciliation_required`
- `charge_job_credits`
- `complete_generation_job`
- `fail_and_refund_generation_job`
- `refund_job_credits`
- `bump_job_progress` (defined outside this migration)

### 6.3 Other tables touched

| Table | Use by Fruit | Defined |
|---|---|---|
| `profiles` | `plan_code`, `credit_balance`, `credits_spent_today`; read by the client, job-worker and the RPCs, written by `deduct_credits` and refunds | base table (not in repo) |
| `generation_credit_ledger` | charge/refund rows per job; RLS on, no policies, revoked from `anon`/`authenticated` | `generation_job_safety.sql:78-96` |
| `generation_late_events` | rejected late completions and failures | `:98-104` |
| `system_logs` | structured logs from job-worker, runware-image and runware-video | `20260707000000_system_logs.sql` |
| `image_generations` | free-plan usage row on image success (`runware-image/index.ts:551-559`), not relevant to paid Fruit users | base |
| `generation_queue` | **not used by Fruit**. The UI polls it by `parent_generation_id` but nothing writes Fruit rows (UI audit §9.2). | `20260620000000_generation_queue.sql` |

---

## 7. Media storage

| Asset | Final location | Written by | Expiry |
|---|---|---|---|
| Portraits and scene images | Supabase Storage bucket **`generated`** (public), path `runware/images/<jobId>.<png|jpg|webp>`, `cacheControl: 31536000`, `upsert: true` | `persistImageResult`, `runware-image/index.ts:323-355` | none. Never deleted by any Fruit code path. |
| Video clips | bucket **`generated`**, `runware/videos/<jobId>.<mp4|webm|mov>` | `persistVideoResult`, `runware-video/index.ts:192-220` | none |
| Fallback | If download or upload fails, the **Runware CDN URL** (`im.runware.ai/…`) is stored instead | same functions (`catch` → `return sourceUrl`) | Runware URLs are not durable. The UI's 24-hour thumbnail heuristic (`AIFruitStoryResults.jsx:105-117`) targets this case. |
| Runware-side ref copies | `imageUpload` re-hosts each portrait on Runware before every scene | `runware-image/index.ts:414-440` | provider-managed |
| `generation-references` bucket | private, 2-hour signed URLs for uploaded refs | `_shared/referenceImages.ts:78-147`, cleanup cron `20260802020000_generation_reference_cleanup_cron.sql` | Not used by Fruit: its refs are already public `generated` URLs |
| Stitched videos (Clay Rescue only) | bucket **`public-assets`**, `published/<uid>/clay-rescue-final/<ts>.mp4` | `useClayRescueEditor.js` `uploadFinalVideo` | none |

All Fruit media URLs are **public and guessable by job id**. They are not signed. Deleting a Recent generation deletes none of it.

---

## 8. Video stitching (existing code)

**Files:**
- `src/components/viral-tools/clay-rescue/videoEditor/ffmpegStitcher.js` (178 lines)
- `useClayRescueEditor.js` (227 lines)
- `ClayRescueTimeline.jsx` (164 lines)
- Engine: `@ffmpeg/ffmpeg ^0.12.15` and `@ffmpeg/util ^0.12.2` (`package.json:24-25`), self-hosted core at `public/ffmpeg/ffmpeg-core.js` and `ffmpeg-core.wasm`. Excluded from Vite dep optimisation (`vite.config.js:39-44`).

**How it works (all in the browser):**

1. `getFFmpeg()` lazy-imports ffmpeg.wasm and loads the core from `/ffmpeg/*` as blob URLs. It is cached as a singleton promise and reset on a load failure.
2. `stitchClips(clips, onProgress)` handles each `{ url, trimStart, trimEnd }` in order:
   - `fetch` the clip into memory;
   - `ffmpeg -i in -ss trimStart -to trimEnd -c:v libx264 -preset ultrafast -c:a aac -avoid_negative_ts make_zero trimN.mp4`, a re-encode so every segment shares codec parameters.

   It then writes a concat list and runs `-f concat -safe 0 -i list.txt -c copy output.mp4`, returning a Blob and an object URL. Progress runs 0–90 % across clips, then 100.
3. `probeDuration(url)` reads each clip's duration with an off-DOM `<video>` element and falls back to 6 s after 10 s.
4. `useClayRescueEditor` seeds the clip list (order, trims, deletions) and **auto-renders once** when clips arrive. After each render it uploads to `public-assets` and upserts a `jobs` row through `saveFullVideo` (`src/lib/jobs.ts:250-311`). That row has `tool_key: "full-video"`, `status: "succeeded"`, `charge_credits: 0` and `provider: "client"`, so it appears under Publish → My Exports.

**Limits and constraints relevant to Fruit:**
- **Single-threaded ffmpeg.wasm.** The core is not `-mt`, so no COOP/COEP headers are needed. Every clip is re-encoded on the user's CPU: 10 × 5–6 s clips at up to 1080×1920 (V4) is slow on phones.
- **Memory.** All inputs, outputs and the final file sit in wasm memory at once, and wasm memory has a hard ceiling.
- **Resolution and audio.** Concat uses `-c copy`, so segments must also share resolution and audio layout. Re-encoding doesn't rescale. Within one Fruit story all clips come from one model, but a clip with no audio stream mixed with clips that have one would break the copy concat.
- **Dependencies.** Needs CORS-readable clip URLs; the public `generated` bucket works. There are no captions, transitions or music; trims and order only.

**Reuse:**
- **`FULL_VIDEO_TOOL_KEY`.** `FULL_VIDEO_TOOL_KEY = "full-video"` and `saveFullVideo` (`src/lib/jobs.ts:244-311`) are tool-agnostic by design. The comment explicitly names Fruit Story as a future consumer.
- **Forked copies.** There are three more copies of the stitcher, already diverged from Clay Rescue's:

  | Copy | `diff` lines vs Clay Rescue |
  |---|---|
  | `ai-cooking-matic/videoEditor/ffmpegStitcher.js` | 661 |
  | `thirty-days/videoEditor/ffmpegStitcher.js` | 399 |
  | `footballer-nationality-swap/videoEditor/ffmpegStitcher.js` | 95 |

  There is no shared module. Diff them before choosing a base for Fruit.

---

## 9. Shared vs Fruit-specific code

### 9.1 Fruit-specific

- **Client:** `src/components/viral-tools/ai-fruit-story/**` and `src/pages/workspace/AIFruitStory.jsx`.
- **Edge functions:** `fruit-story-ideas`, `fruit-story-planner`, `fruit-story-video-prompts`.
- **Migration:** `20260509000000_fruit_story_generations.sql`.
- **Registry entries:** `image:fruit-v2` and `video:fruitveo31lite` in `providers.ts`; the `video:fruitveo31lite` row in `PLAN_GATED_TOOLS`.
- **Fruit branches inside shared files:** `runware-image` `isFruitModel` (`:657-660, 749-754, 778-783, 809, 813-820`) and the "[AI FRUIT refs]" mismatch log in `jobs.ts:649-657`.

### 9.2 Shared, and what could break elsewhere

| Shared piece | Also used by | Risk if changed for Fruit |
|---|---|---|
| `src/lib/jobs.ts` (`createJob`, `createImageJobSimple`, `createVideoJobSimple`, `watchJob`, `saveFullVideo`) | every generation tool | Changing the preview-prompt suffix, balance rules or insert shape affects every tool |
| `job-worker` (dispatch, concurrency, plan gate, handoff payload) | every tool, queue-worker | Concurrency caps are global; a Fruit-only change to payload keys breaks the other providers |
| `runware-image` (2,000-char cap, ref upload mode, output persistence) | all image tools including Long Form and Visual World | **Raising the 2,000 cap globally** changes prompts for every image model. Some models reject longer prompts; the comment cites 2,500 for GPT Image 2. Scope it by `airTag` or `isFruitModel`. |
| `runware-video` + `runware.ts` (per-airTag payloads, 1,450 cap, charge at launch, content rewrite) | all video tools | `bytedance:seedance@1.5-pro` and `vidu:4@2` payload branches serve Clay Rescue, Face ASMR, Micro Camera, Footballer, Cartoon Drive-By and more |
| `video:seedance15pro` toolKey | Clay Rescue, Face ASMR, Micro Camera, Footballer V2 | `KNOWN_VIDEO_PRICES` pins the no-sound 496×864/5 s signature to 6 cr for all of them |
| `video:viduq3turbo720` toolKey + its `PLAN_GATED_TOOLS` entry | Clay Rescue V3, Face ASMR V3 | Changing its gate or price moves all three templates |
| `src/lib/providers.ts` | client **and** Deno job-worker (`import …/src/lib/providers.ts`) | A browser-only import added here breaks job-worker deploys |
| `src/lib/planGating.js` + job-worker tier order | Clay Rescue, Face ASMR, Micro Camera, Footballer, 2AM, Cartoon Drive-By, BTS, 30 Days | Must stay in sync by hand |
| Credit RPCs and `generation_credit_ledger` | all tools | Any change applies platform-wide |
| `_shared/referenceImages.ts`, `_shared/imageDimensionPolicy.ts` | all image tools | Changing the GPT-Image-2 policy (`maxReferenceImages: 4`, approved sizes) affects any other `openai:gpt-image@2` caller |
| `NoCreditsModal`, `ToolGenerationLayout`, `useProfileCredits`, `creditPopEvents`, `downloadMedia` | all viral tools | UI only (see UI audit) |
| Clay Rescue `ffmpegStitcher.js` | Clay Rescue (forks elsewhere) | Import it rather than fork it again, or move it into a shared module first |

---

## 10. Config & env

### 10.1 Environment variable names

| Name | Used by |
|---|---|
| `OPENAI_API_KEY` | `fruit-story-ideas`, `fruit-story-planner`, `fruit-story-video-prompts`, `runware-video` (content rewrite) |
| `RUNWARE_API_KEY` | `runware-image`, `runware-video/runware.ts`; named as `secret` in `providers.ts` entries |
| `RUNWARE_BASE_URL` (optional, default `https://api.runware.ai`) | `runware-video/runware.ts:47` (`runware-image` hardcodes `https://api.runware.ai/v1`) |
| `SUPABASE_URL` / `PROJECT_URL` | all edge functions |
| `SUPABASE_SERVICE_ROLE_KEY` / `SERVICE_ROLE_KEY` | all edge functions; also the `x-job-worker-key` shared secret |
| `SUPABASE_ANON_KEY` | job-worker (fallback `apikey` header) |
| `RUNWARE_IMAGE_MAX_CONCURRENT` (8), `RUNWARE_VIDEO_MAX_CONCURRENT` (8), `RUNWARE_TOTAL_MAX_CONCURRENT` (15) | job-worker, queue-worker |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | browser Supabase client |
| `VITE_PUBLIC_APP_ORIGIN`, `VITE_SITE_URL` (fallback `https://tryzyvo.com`) | `fruitStoryApi.js:1189-1192` (`toPublicAssetUrl`, for legacy app-hosted character images) |

### 10.2 Hardcoded values

| Kind | Value | Location |
|---|---|---|
| OpenAI models | `gpt-4o-mini` (ideas, content rewrite), `gpt-4o` (planner, vision) | `fruit-story-ideas:90`, `runware-video/index.ts:410`, `fruit-story-planner:1289`, `fruit-story-video-prompts:136` |
| OpenAI endpoint | `https://api.openai.com/v1/chat/completions` | each fn |
| Runware AIRs | `openai:gpt-image@2`, `bytedance:seedance@1.5-pro`, `vidu:4@2`, `google:veo@3.1-lite` | `providers.ts` |
| Credits | 2 / image, 12 / 17 / 29 per clip, 6 portrait estimate in UI | `fruitStoryApi.js`, `AIFruitStoryBuilder.jsx:132` |
| Provider costs (comments/config) | GPT Image 2 $0.010423; Seedance 1.5 Pro $0.052529/s (720p audio); Vidu Q3 Turbo 720 $0.03575/s; Veo Lite "$0.30/6s" | `providers.ts`, `fruitStoryApi.js:47-82` |
| Scene counts | 15s→3, 30s→5, 45s→7, 60s→10 | `fruitStoryApi.js:162-167` |
| Clip durations | 5 s (V2/V3), 6 s (V4) | `fruitStoryApi.js:46, 66, 81` |
| Dimensions | image 720×1280 / 1280×720 / 720×720; V2 496×864; V3 720×1280; V4 1080×1920 | `fruitStoryApi.js:55-87, 141-147` |
| Prompt caps | image 2,000 (server); video 1,450 (client and server); dialogue 4 lines × 80 chars; speaker 16 chars | `runware-image:508`, `fruitStoryApi.js:104-109`, `runware-video:103` |
| Planner | `max_tokens` 5500, `temperature` 0.55, 55 s timeout; ideas 15 (min 5) | see §1 |
| Vision | `max_tokens` 400, `temperature` 0.8, `detail: "high"`, ≤4 lines | `fruit-story-video-prompts:142-149` |
| Timeouts | client job wait 4.5 min; runware-image 5 min / 1.5 s poll / 30 s fetch; runware-video 350 s / 4 s poll / 3 min 402 wait; lease 180 s | see §3.7 |
| Retries | client video create 3×; job-worker 5 attempts with 5–90 s backoff; content rewrite 2× | see §3.7 |
| Paywall prices / Stripe price ids | Starter $20/$16, Pro $42/$35, Generative $85/$70 | `FruitStoryPaywall.jsx:8-37` (UI) |

---

## 11. Known backend gaps

Severity: **H** = wrong output, lost money, or security; **M** = reliability or cost; **L** = hygiene.

### 11.1 Prompt layer

| # | Sev | Issue | Where |
|---|---|---|---|
| P1 | **H** | Scene image prompts are truncated to 2,000 of ~7,800 chars. The model never receives reference rules, scene cast, beat context or the scene description, and "Regenerate image" edits are ignored. Candidate fixes: put scene content first, shorten the preamble, and/or raise the cap for `openai:gpt-image@2` only. | `runware-image/index.ts:508, 673`; `fruitStoryApi.js:1642-1776` |
| P2 | **H** | Video prompts lose Action, Speech rules, Audio ("no background music"), Voice, Camera and Style, and cut dialogue mid-word. The `Cast:` block pushed required sections past 1,450 despite the "required first" comment. | `fruitStoryApi.js:1086-1130` |
| P3 | **H** | `animateClip` rebuilds the prompt from the stored, already-truncated prompt. Dialogue is re-extracted, cut lines are dropped, and canned pool lines are substituted, so the dialogue sent ≠ the dialogue stored ≠ the vision output. | `fruitStoryApi.js:2153-2155, 816-865` |
| P4 | M | The vision system prompt forces characters to react to any "species mismatch". Image drift becomes dialogue about the wrong fruit. | `fruit-story-video-prompts/index.ts:98-99` |
| P5 | M | Vision dialogue bypasses `sanitizeDialogueLine`: no length cap, fruit-address stripping or English check. | `fruitStoryApi.js:984-994` |
| P6 | M | The planner writes `videoPrompt`, `captionText`, `negativePrompt` and `durationSeconds` per scene, and the client discards them. That wastes output tokens against `max_tokens: 5500` and risks `finish_reason: length` on 10-scene stories, which surfaces as a JSON parse error. | `fruit-story-planner/index.ts:1104-1112`; `useFruitStoryJob.js:635` |
| P7 | M | The system prompt still says "The character reference images are attached … LOOK at the 2 uploaded reference images". A user-prompt paragraph contradicts it on every run. | `fruit-story-planner/index.ts:872-927, 1242-1247` |
| P8 | M | AI-invented casts always have `genderPresentation: "unspecified"`; GPT's value is ignored. Portraits say "person", and the video Cast line says "unspecified". | `fruit-story-planner/index.ts:543-547, 597-622` |
| P9 | M | The planner's beat context (emotion, action, camera, background, environment) isn't persisted. A regenerated image after Continue loses it. | `useFruitStoryJob.js:133-154, 476-492` |
| P10 | L | Retried clips (`retryFailedClips`) use `formRef.current` without `castBible`, so their prompts differ from first-run prompts. | `useFruitStoryJob.js:880-953` |
| P11 | L | `sanitizeImagePromptForGPT` replaces `affair` before `affair[_\s]partner`, so the second rule never matches. | `fruitStoryApi.js:2066-2067` |
| P12 | L | Dead code: `isFruitVideoPromptReady`, `pickSoundEffect`, `deriveAmbience`, `deriveClipDialogue`, `STORY_LENGTH_DURATION_SEC`, style `animationRules`, `styleId` sent to the planner, and the previous-scene ref plumbing. | `fruitStoryApi.js` |

### 11.2 Security and billing

| # | Sev | Issue | Where |
|---|---|---|---|
| S1 | **H** | `charge_credits` for Fruit jobs is client-declared with no server re-pricing. Verify the live `jobs` insert RLS; the policy is not in the repo. | `jobs.ts:214`; `runware-video/index.ts:277-305` |
| S2 | **H** | `fruit-story-video-prompts` has no user auth or input cap. Anyone with the public anon key can trigger unbounded parallel GPT-4o vision calls. | `fruit-story-video-prompts/index.ts:48-67` |
| S3 | M | The Fruit paywall and free-plan image lock are client-only. Planner and ideas require auth but not a paid plan; `image:fruit-v2` and `video:seedance15pro` aren't in `PLAN_GATED_TOOLS`. | §5 |
| S4 | M | No rate limiting on ideas, planner or vision. These are platform-paid OpenAI calls. | §2 |
| S5 | L | The planner returns raw OpenAI error text (up to 300 chars) to the client. | `fruit-story-planner/index.ts:1303-1315` |
| S6 | L | Generated media is public and addressed by job id. There is no deletion path. | §7 |

### 11.3 Reliability and races

| # | Sev | Issue | Where |
|---|---|---|---|
| R1 | **H** | Image completion needs a charge at completion time. With low balance (videos charge at launch), `complete_generation_job` returns false and the job stays `processing` forever: a platform-paid image the user never gets. | `generation_job_safety.sql:269-290`; `runware-image/index.ts:545-567` |
| R2 | M | The image pre-check ignores pending jobs (the video pre-check doesn't). There is no story-level reservation, so stories can be partially billed and then fail. | `jobs.ts:558`; §4.5 |
| R3 | M | Jobs re-queued by job-worker's 402/rate-limit path aren't picked up by anything in the repo. Confirm whether an external cron calls job-worker without `jobId`. | `job-worker/index.ts:583-619`; `queue-worker/index.ts` |
| R4 | M | `reconciliation_required` jobs stay `processing`. Fruit never calls `reconcileVideoJob`, and the queue-worker schedule isn't in the repo. The client's scene then never reaches a terminal state, so the story never reaches "done". | §3.7 |
| R5 | M | runware-video's 402 path sleeps 3 min inside a 350 s budget and ~400 s platform limit. Later polling has ~170 s or less, and the invocation can be killed while the job is `running` and charged. | `runware-video/index.ts:224-264` |
| R6 | M | The whole story pipeline runs in the browser tab. Closing the tab stops scene submission mid-story; no server continues it (UI audit §9.3 #2). | `useFruitStoryJob.js:559-784` |
| R7 | M | Global concurrency caps (8 image / 8 video / 15 total across **all users**). One 10-scene story with portraits can occupy a large share. | `job-worker/index.ts:183-185` |
| R8 | L | `fruit-story-ideas` and `fruit-story-video-prompts` have no fetch timeout on OpenAI. | §2 |
| R9 | L | A client-generated `taskUUID` equal to `jobs.id` is reused for Runware image tasks. It is safe thanks to `reserve_provider_submission`, but a manual re-dispatch of the same job id can't create a fresh task. | `runware-image/index.ts:756-759` |

### 11.4 Data, config and observability

| # | Sev | Issue | Where |
|---|---|---|---|
| D1 | M | Runware `cost` is requested but never read (images) or dropped (videos). There is no per-job provider cost for margin tracking. | §4.6 |
| D2 | M | The `jobs` base schema and RLS aren't in migrations, so schema drift is invisible in the repo. | §6.2 |
| D3 | L | `fruit_story_generations.scene_count` defaults to 6 against client values 3/5/7/10. There's no CHECK on `status`, and `animating` is never written. | migration `:12, 16` |
| D4 | L | V2 clip price (12 cr) is flagged in code as an unmeasured estimate. | `fruitStoryApi.js:47-51` |
| D5 | L | The runware-image comment "GPT Image 2 allows only 1" contradicts the policy (4). | `runware-image/index.ts:793-795` |
| D6 | L | Four diverging copies of `ffmpegStitcher.js`. | §8 |

---

## Appendix: sequence diagram (Generate Story → finished clips)

Legend: **BR** = browser (`useFruitStoryJob`), **EF** = Fruit edge function, **JW** = `job-worker`, **RI** = `runware-image`, **RV** = `runware-video`, **OA** = OpenAI, **RW** = Runware, **DB** = Supabase Postgres (+ Storage).

```
 BR                     EF                 JW              RI / RV                 OA            RW                 DB / Storage
 │ click "Generate Story" (credit estimate check only, client side)
 │── planFruitStory ───▶│ fruit-story-planner
 │                      │── auth.getUser ───────────────────────────────────────────────────────────────────────────▶│ auth
 │                      │── chat.completions(gpt-4o, json, 5500 tok, 55s) ───────────────▶│
 │                      │◀─ plan JSON ────────────────────────────────────────────────────│
 │                      │ merge cast, repairScenes, appendStrictImageRules
 │◀─ {title,cast,scenes}│
 │
 │ ── PORTRAITS (parallel, one per cast member) ─────────────────────────────────────────────────────────────────────
 │── createImageJobSimple: read profile, INSERT jobs(queued, charge_credits=2) ──────────────────────────────────────▶│
 │── invoke job-worker {jobId} ─────────▶│ auth+ownership, concurrency, claim(→running), plan gate, validate refs
 │                                       │── POST (x-job-worker-key) ─▶│ RI: 202; background:
 │                                       │                             │── imageInference(gpt-image@2, ≤2000 chars) ────────▶│
 │                                       │                             │── poll getResponse /1.5s ──────────────────────────▶│
 │                                       │                             │◀─ image URL ────────────────────────────────────────│
 │                                       │                             │── copy to Storage generated/ ─────────────────────────────────────────▶│
 │                                       │                             │── complete_generation_job → charge 2cr ───────────────────────────────▶│
 │◀══ watchJob (realtime + 1.5s poll) ═══════════════════════════════════════════════════════════════════════════════│ jobs row succeeded
 │ member.portraitUrl = result_url
 │
 │── INSERT fruit_story_generations(status=generating_images, cast_data, scenes) ────────────────────────────────────▶│
 │
 │ ── FOR EACH SCENE (sequential) ───────────────────────────────────────────────────────────────────────────────────
 │ buildSceneRefSlots(portraits) + buildMasterImagePrompt (~7.8k chars) + sanitize
 │── image job (same path as portraits, refs → imageUpload re-host, prompt cut to 2000) ─────────────────────────────▶│
 │◀══ watchJob … succeeded (charged at completion) ══════════════════════════════════════════════════════════════════│
 │── UPDATE fruit_story_generations.scenes ─────────────────────────────────────────────────────────────────────────▶│
 │
 │   ┌─ startSceneVideo(scene)  [fire-and-forget; overlaps the next scene's image]
 │   │ buildSceneVideoPrompt (text, 1450)
 │   │── invoke fruit-story-video-prompts ─▶│ (no auth)
 │   │                                      │── chat.completions(gpt-4o vision, high, 400 tok) ───────▶│
 │   │◀─ {dialogue[], imageObservations} ───│◀────────────────────────────────────────────────────────│
 │   │ buildSceneVideoPromptWithDialogue (1450) → animateClip → buildRunwareVideoPrompt (REBUILD, 1450) [→ Veo sanitize]
 │   │── createVideoJobSimple: balance−pending check, INSERT jobs(charge_credits=12|17|29) ──────────────────────────▶│
 │   │── invoke job-worker ────────────────▶│ claim, plan gate (V3 pro / V4 generative)
 │   │                                      │── POST ─────────────────▶│ RV: 202; background:
 │   │                                      │                          │── charge_job_credits (AT LAUNCH) ──────────────────────────────────▶│
 │   │                                      │                          │── videoInference(model, frameImages=[scene img], audio) ─▶│
 │   │                                      │                          │── poll getResponse /4s (≤350s) ─────────────────────────▶│
 │   │                                      │                          │   [content-policy fail → gpt-4o-mini rewrite → relaunch ×≤2] ──▶ OA / RW
 │   │                                      │                          │◀─ video URL ────────────────────────────────────────────│
 │   │                                      │                          │── copy to Storage generated/ ; complete_generation_job ───────────▶│
 │   │◀══ watchJob … succeeded ══════════════════════════════════════════════════════════════════════════════════════│
 │   └─ UPDATE fruit_story_generations.scenes (videoUrl) ───────────────────────────────────────────────────────────▶│
 │
 │ all images terminal → UPDATE status images_generated|partial_failed
 │ all clips terminal  → UPDATE status completed                                                                     │
 │ (no server-side assembly; clips are downloaded one by one)
```
