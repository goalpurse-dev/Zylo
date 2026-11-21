# Zyvo Studio Kit + Zyvo MCP connector: plan

Status: APPROVED by the owner 2026-11-19. Building A1 + A2 first (the free kit), then STOP for the owner's A3 test.
Date: 2026-11-19.

## Phase 2 (2026-11-20, local, not deployed)

- **Site pages:**
  - `/workspace/studio-projects` (Studio projects tab: cards, Create voice at the shown price, recording upload, Finish my video, downloads).
  - `/connect-claude` (how to connect, tools and prices, your connections + Sign out).
  - `/connect/authorize` (the consent screen).
  - The "Make it in Roblox Studio (free)" section on the In This Town page.
  - A Studio projects link in the In This Town header.
  - Everything is owner-only until `STUDIO_KIT_PUBLIC` (src/data/studioKit.js) and the connector's ZYVO_MCP_ACCESS open.
  - `?mock=1` on localhost shows sample data.
- **Server:**
  - `_shared/zyvoMcp/site.js`: the site's account routes. Paid clicks run the same tool code: price first, must match the card, then the tool's own start.
  - Migration `20261220110000_zyvo_kit_downloads.sql` (not run).
  - Kit zip: `node scripts/studioKit/packKit.mjs` -> `dist-kit/` (phase 3 uploads it to `kit/` in the zyvo-studio bucket).
- **Free kit captions (owner 2026-11-20):** `kits/zyvo-roblox-story/scripts/add_captions.sh` (bash + awk + ffmpeg) burns simple white one-word captions and lays the voice under the picture.
  - With `words.json`: exact timings.
  - From `narration.txt`: lined up with the voice's pauses. Measured against whisper on 3 real voices: 89-92 % of words within 0.25 s, 95 % within 0.4 s.
- **Worker order (owner 2026-11-20):** connector voice/finish jobs run in the studio lane (`studioLane.mjs`).
  - It is a child process at nice 19 beside the video loop, so a full video is claimed at the next poll and gets the CPU first.
  - $0 extra, versus a second always-on Fly machine.

## What it is, in one paragraph

A free way to make In This Town videos yourself in Roblox Studio, with Zyvo as the honest "finish it for me" option at each step:

- **A) The Studio Kit:** a free Claude skill for Claude Code. It drives the user's own Roblox Studio through Roblox's official Studio MCP, from idea to a Play run the user screen-records.
- **B) The Zyvo connector:** a remote MCP server with Zyvo login. It sells the parts the kit can't do well locally: script, voice, finishing the recording (voice, captions, SFX, music) or the whole video, each priced at 2x our cost and confirmed before charging.
- **C) The website section:** download the kit, add the connector, see the requirements, or "No Studio? Make it in Zyvo".

## Ground rules

- **Clean room.** Every instruction, prompt and line of code is written fresh in our words. Nothing is copied from the kits the owner shared (roblox-story-kit or others), neither text nor code. What we learned ourselves stays usable, written our way: the story shape, the beat sheet and craft rules, the camera and framing rules, the render-gate thinking and the caption style.
- **Roblox rules, built into the skill as hard rules:**
  - Free Creator Store models only (no paid items, no Robux).
  - Every Script, LocalScript and ModuleScript inside an inserted model is deleted on insert (free models can carry malicious or backdoor scripts).
  - No Roblox licensed audio, and no audio in the footage at all (all sound comes later, from us or the user).
  - Never Save to Roblox or Publish the place. The skill never calls save or publish, and it tells the user not to.
  - No Roblox logos or UI in shots: the core UI and the player list are hidden in the Play run, and there are no Roblox brand marks in signs or textures.
  - Custom avatars only, built from free items and colours, never the default classic avatar.
- **Honest Zyvo option.** Each step ends with one plain line, never hype: "Want the voice, captions, sound and music done for you? Finish in Zyvo." (The wording varies by step.)

## A) The free local kit (Claude skill: `zyvo-roblox-story`)

Named `zyvo-studio-kit` (1.0), then `roblox-story` (1.1-1.3), renamed `zyvo-roblox-story` in 1.4.0 (2026-11-21): another creator's popular skill also installs into `~/.claude/skills/roblox-story`, so installing one overwrote the other. The 1.4.0 kit tells users of our old `roblox-story` folder once that they can delete it (only when that folder is ours); the server takes any `kit_version` text, so old kits keep reporting.

### What the user installs

- Roblox Studio, with "Studio as MCP server" enabled in Studio Assistant.
- Claude Code.
- Our skill folder: a SKILL.md plus small helper files, downloaded from our site after login.
- Optionally our connector (B), for the paid steps.

### Setup, guided step by step by the skill

1. Check Claude Code can see the Studio MCP server (list its tools). If not, walk through enabling it, with one screenshot per step on our help page.
2. A test call: read the place's Explorer root and run one harmless edit-mode command (create and delete a part). It reports "connected" or exactly what failed.
3. Our first build task: confirm Roblox's Studio MCP tool list on the owner's PC. The plan assumes it can:
   - run Luau in edit mode;
   - insert Creator Store models;
   - read the Explorer and selection;
   - start and stop Play;
   - take a viewport screenshot.

   If a capability is missing, the step falls back to "you do this click, I check it".

### System check (plain words, before any work)

- **What it checks:**
  - Windows 10+/macOS, Studio installed and updated.
  - The MCP connection works.
  - At least 8 GB RAM (16 GB recommended) and a GPU that keeps Studio smooth at 1080p.
  - About 10 GB free disk for recordings.
  - A screen recorder is available (Xbox Game Bar or OBS on Windows, Cmd+Shift+5 on Mac).
- **If it can't work:** the user hears it plainly ("Your PC can't record Studio smoothly at 1080p: the video would stutter"), plus the option: "Make it in Zyvo instead: we build and render it for you."

### The flow (each step ends with an approval and the Zyvo line)

1. **Topic or idea.** The user's topic, or 3 ideas from `suggest_ideas` (free, via the connector) or written locally. The rule must pass the six rule tests (9+/12), as in our writer.
2. **Script.** Our story shape (rule, life under it, the one kid, "But...", trouble, adults fail, the save, the button), the beat timings, a motif, 2 fair clues and the logic answers. The skill writes it locally from our own instructions, or the user buys our writer (`write_script`).
   - Zyvo line: "Want our tested writer to write it? 25 credits."
3. **Grey blockout and approval.** Plain parts for each location (the skill builds a 9:16 camera frame marker), the camera spots placed, and Studio screenshots for each. The user approves or asks for changes.
4. **World.** Free Creator Store models only, searched by our keywords. Every script is stripped on insert, and each model is logged (asset id, name, creator) to a credits file for the user. Nothing paid, nothing with audio.
5. **Cast.** Custom avatars (a rig plus free clothing and colours from our style sheet). The hero has one striking outfit and every character gets their own colours. Never the default classic avatar.
6. **Lighting.** Our look: a warm low sun with long shadows, saturated sky, readable faces. Implemented as Lighting properties in our words.
7. **Shot list.** From the script, with our framing rules:
   - The shot mix, angles, moves and holds, and the rule sign in shot 1.
   - If the user ran `make_voice` first, every shot gets exact seconds from the word timings (recommended: that's what makes finishing line up).
   - **The voice step comes first (owner, 2026-11-19):** the free kit can't make the voice. It (1) gives the full narration as clean paste-ready text + our recommended settings (ElevenLabs Scruffy Duck `8VJBrRk4O7tFoB5kqxa6` or any voice, 1.25x at the same pitch with natural pauses kept, about 195 wpm; or a free TTS / their own voice) and how to bring the file back; (2) with the Zyvo connector, reports the project to Zyvo right away and says "Open Zyvo → Studio projects → '[project title]' → Create voice", then picks up the voice + word timings; (3) without a voice, times from estimated word timings and says so. Kit files: `SKILL.md` Step 7, `reference/voice.md`, `reference/shots.md`.
8. **Play run.** The skill sets the 9:16 view (Studio's device emulator at a phone size), hides the core UI, mutes all sound, and runs the shots as a scripted camera sequence in Play. That code lives only in this unsaved place, never published. The user screen-records it.
   - The skill says where the file went and checks its length against the voice.
   - Zyvo line: "Want the voice, captions, sound and music done for you? Finish in Zyvo."

What the kit never does: save or publish the place, buy anything, add audio, or keep scripts from inserted models.

## B) The Zyvo MCP connector (remote, OAuth with Zyvo accounts)

### Shape

- One remote MCP server (streamable HTTP) at `https://mcp.tryzyvo.com/mcp`. It runs as a new Supabase edge function, `zyvo-mcp`, that calls the same internals as `blocky-worlds-api`; no second copy of the business logic.
- It works in Claude Code (`claude mcp add --transport http zyvo <url>`) and in claude.ai (Settings, Connectors, Add custom connector).
- **The prompt:** `/in-this-town` (Claude Code shows it as `/mcp__zyvo__in-this-town`). It walks the same flow as the kit and offers each paid tool at its step.

### Tools

| Tool | What | Price (90 s video) |
|---|---|---|
| `suggest_ideas` | 3 to 10 ideas (our idea engine; rule tests 9+) | free (the existing daily idea limit) |
| `write_script` | our writer, from a topic or an idea (beat sheet, craft rules, twist rotation) | **25 credits** ($0.50) |
| `make_voice` | Scruffy Duck voice + word timings (JSON) + mp3 | **16 credits** ($0.32); 11 for 60 s, 21 for 120 s |
| `report_studio_project` | the kit reports a Studio project (title, script, shot plan, status) to the user's Zyvo account; creates or updates its row in **Studio projects** | free |
| `get_studio_voice` | the voice made in Zyvo for that project: mp3 link + word timings (JSON); `not_ready` until it exists | free |
| `finish_my_video` | the user's Studio recording -> our voice, captions, SFX, music, -14 LUFS, 9:16 | **10 credits** ($0.20) + the voice if not made yet |
| `make_video_in_zyvo` | the full Blender video (today's In This Town) | **313 credits** ($6.26, today's price, script included) |
| `check_progress` | the state of a job (progress, ETA, link when done) | free |
| `list_my_videos` | the user's recent videos and scripts, with links | free |

**How the prices are set.** Our existing rule is 1 credit = $0.01 of our full cost, and the user pays $0.02 a credit, so 2x cost:

- **Script:** $0.25, the max we've measured.
- **Voice:** $0.00173 a second, measured.
- **Full video:** `blenderPricing.js`, unchanged.
- **finish_my_video:** an estimate until measured:
  - The worker's CPU time: about 5 minutes of ffmpeg.
  - Storage and egress.
  - A cheap safety look at about 8 frames, about $0.01.
  - A failure allowance.

  That comes to about $0.05 to $0.10, rounded up to 10 credits. We confirm it on the first 3 real runs and adjust (with your OK) before launch.

### The Studio projects tab + "Create voice" (owner, 2026-11-19)

The kit's voice step hands off to the site, so the money step happens in Zyvo, never inside the free kit:

1. **Report.** At the kit's voice step, `report_studio_project` (free) stores the project in the user's account: title, approved script, shot plan (locations, cast, planned shots, `shots.json` when it exists), status (`voice_needed` → `voice_ready` → `recorded` → `finished`), and the kit version. Re-reporting updates the same row (key: user + kit project id). The script and shot plan are DATA (the `safety.js` / `topicProblem` checks; never echoed as instructions); max sizes on every field.
2. **The tab.** A new **Studio projects** tab on the site (signed in): one card per reported project with its title, status, last update, the script (read-only, with a copy button) and the next step.
3. **Create voice.** On a project card in `voice_needed`, a **Create voice** button shows the price (the `make_voice` price for the script's length) and the balance, and takes credits only after the user's click (the site's normal prepay). It runs the same voice pipeline as Blocky Worlds: Scruffy Duck on Eleven v3, pauses trimmed, 1.25x at the same pitch, word timings re-timed on the result. Done → status `voice_ready`, with a player and a download.
4. **Pick-up.** `get_studio_voice` (free) gives the kit the mp3 link and `words.json`; the kit saves both in the user's project folder and times the shot list exactly. Failed voice = the site's normal full refund, once.
5. **Later:** the same card gets "Finish my video" (`finish_my_video`) when the recording is uploaded.

**The recommended pace (owner, 2026-11-19): "voice A" style.** Scruffy Duck v3, 1.25x at the same pitch, the voice's natural pauses kept (only the existing long-pause trim), about **195 wpm**, so Studio stories stay easy to follow. In the owner's test a 264-word script came out at 82.4 s this way; tighter and faster versions (232 wpm / 69 s and 259 wpm / 61.8 s) were made and rejected by ear. So Create voice runs the existing Blocky Worlds voice pipeline unchanged (no extra squeeze), and the kit sizes scripts at ~3.25 words a second (a 60 s story is about 195 words; `reference/story.md`).

### Paid tools: price first, then confirm (works in every client)

1. The first call never charges. It returns the price in credits and dollars, the balance, what you get and a `confirm_token` (valid for 10 minutes, single use, tied to user, tool and inputs).
2. The client shows that to the user. Only a second call with the `confirm_token` takes the credits, through the same prepay RPC as the site.
3. Where the client supports MCP elicitation, we also ask for a yes there. The token rule stays, so no client can skip it.

**Same refund rules as the site.** A failed job refunds in full, once. A script bought and never used keeps its part after 7 days, as on the site (`keepCredits`). A failed `make_video_in_zyvo` gets the site's "Try again" from its saved parts.

### finish_my_video: the new piece

1. **Upload.** The tool returns a signed upload link: the user opens it in the browser, or Claude Code uploads with curl. Limits: 500 MB, 3 minutes, mp4/mov/webm.
2. **Checks.**
   - ffprobe in a sandbox: real video, length, size.
   - Re-encoded on our worker (never played as-is).
   - About 8 frames go through a cheap vision check: is this a blocky 3D scene, and is nothing unsafe, no Roblox UI or logos, no real faces? A fail refunds and says why.
3. **Fit to the voice.** The recording is cut or stretched to the voice length: at most ±8% speed. Otherwise we hold the last frame or trim, and say so. Then it is cropped or scaled to 1080x1920.
4. **Finish.** Our caption style (per-speaker colours, from the word timings), SFX at the script's sound words (needs OUR OWN CC0 SFX set: the kit's sound files can't be used here), our music track at the In This Town mix (~14 dB under the voice, ducked, -14 LUFS). A "without music" copy too.
5. **Where it runs.** It's a new job type on the Fly studio worker (CPU only, no GPU).

### Safety and limits

- **Untrusted input.** Topic text, idea text, script edits and uploads are all DATA:
  - They go through our existing `safety.js` / `topicProblem` checks.
  - They are marked as data in every prompt.
  - Never echoed back as instructions.
  - Tool results carry no text that a model could follow as an instruction.
- **Rate limits per user.** Reuse `guard.js`: 3 running and 6 video starts a day. Per user on top of that:
  - ideas: the existing daily batches;
  - `write_script`: 10 a day;
  - `make_voice`: 10 a day;
  - `finish_my_video`: 6 a day;
  - free tools: 60 calls a minute.

  The global $50/day cap and the $25 alert cover MCP spend too.
- **The owner's one switch.** `paid_calls=false` pauses MCP paid tools as well.

## C) Website section: "Make it in Roblox Studio (free)"

On the In This Town page (and a short landing block):

1. **Download the kit.** Login required (a free account); downloads are counted. The zip holds the skill folder and a README.
2. **Add the connector.** Claude.ai: Settings, Connectors, Add custom connector, paste `https://mcp.tryzyvo.com/mcp`, then log in with Zyvo. Claude Code: the one `claude mcp add` line.
3. **Requirements.** The system-check list in plain words.
4. **"No Studio? Make it in Zyvo."** The normal In This Town flow.
5. **A small FAQ.** What's free, what costs credits, refunds, and "we never publish your place".

## Security notes

- **OAuth 2.1 with PKCE.**
  - If Supabase Auth's OAuth server feature is available on our plan, use it.
  - If not, a small authorization server in `zyvo-mcp`: dynamic client registration (claude.ai needs it), consent screen on tryzyvo.com, Supabase login.
  - Tokens: short-lived access tokens (1 h), refresh tokens stored only as hashes and revocable from the account page.
  - One scope per kind: `ideas`, `scripts`, `videos`, `spend`. A client without `spend` can never charge.
- **No keys in the kit.** The free skill holds no secrets; everything paid goes through the connector under the user's own login.
- **Confirm tokens.** Single use, 10 minutes, bound to user, tool and an input hash, so nothing can be replayed onto another input.
- **Uploads.** Signed, size-capped, one per job, deleted after 7 days, processed in the sandboxed worker.
- **Logs.** Each MCP call is logged with user, tool, cost and result (no full scripts, no secrets), next to the existing ledgers.
- **Roblox side.** The kit strips scripts from inserted models (backdoor risk) and runs only edit-mode code we wrote. It never saves or publishes, never calls HTTP from the place, and never asks for the user's Roblox login.

## Effort (one agent, lean)

| Part | Work | Estimate |
|---|---|---|
| A1 | Confirm the Studio MCP tools on the owner's PC; system check; setup guide | 1 day |
| A2 | The skill: flow, rules, Luau helpers (blockout, strip scripts, avatars, lighting, camera sequence, 9:16 + hidden UI) | 3-4 days |
| A3 | One full test topic end to end on the owner's PC (owner records) | 1 day |
| B1 | `zyvo-mcp`: OAuth (or Supabase's), free tools (incl. `report_studio_project`, `get_studio_voice`), `/in-this-town` | 3-4 days |
| B2 | Paid tools with the quote-and-confirm tokens, ledgers, refunds, rate limits; the **Studio projects** tab + **Create voice** button (table, migration, card UI, voice job reusing the Blocky Worlds voice) | 3-4 days |
| B3 | `finish_my_video` (upload, checks, fit to voice, captions, our CC0 SFX set, music) | 3-4 days |
| C | Website section + kit download + help page with screenshots | 1-2 days |
| | **Total** | **about 15-20 working days** |

Paid test calls are needed for B2/B3 (script, voice, a finish). Each one is asked first, with its exact cost; the whole testing should be under $3.

## What I'd build first

1. **A1 + A2 + A3, the free kit.** No backend, no money, and it tells us within a week whether Studio + MCP is good enough for real videos on a normal PC. If it isn't, B and C change shape.
2. **B1, the connector with only the free tools** (ideas, progress, my videos) and OAuth: the risky security part, done without any money flow.
3. **B2, then B3.** Paid tools on the existing pipeline first (script, voice, full video), then `finish_my_video`, the one new pipeline.
4. **C last,** when there's something real to download and connect.

## The owner's answers (2026-11-19)

1. Connector address: **mcp.tryzyvo.com**.
2. SFX: our existing CC0 packs + our own generated animal / eating sounds.
3. The kit writes scripts locally for free; our writer (`write_script`) is the optional upgrade.
4. `finish_my_video`: 10 credits at launch; the first 3 runs are measured and reported.
5. New users get ONE free `finish_my_video` (voice + finish) per account, once.

## Open questions for the owner (answered above)

1. The connector URL: `mcp.tryzyvo.com` (needs a DNS record) or a path on the Supabase functions domain?
2. Our own CC0 SFX set for `finish_my_video`: pick from the CC0 packs we already have, or a new search?
3. Should the kit's local script writing exist at all, or is the script always our paid writer (simpler, better quality, 25 credits)?
4. Does `finish_my_video` at 10 credits sound right as a launch price until it's measured?
