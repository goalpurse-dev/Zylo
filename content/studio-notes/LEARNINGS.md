# Studio learnings

## Round 1: 11 reference videos against our 5 Studio v2 videos (2026-11-02)

**What was studied:** the 11 `snaptik_*` videos in `content/reference-videos/` and our 5 videos in `content/studio-previews/v2/`. All local, $0: a local Whisper transcript, every frame compared with the one before it to find the cuts, contact sheets checked by eye, loudness and level measured from the audio.

**Limits of this study:**
- We have no likes per video, so nothing here says which pattern earned the likes. These are patterns all or most of them share.
- Whisper mishears names ("Claude" comes out as "God", "Vlad", "Clot"). Openings were checked against the frames.
- We learn their format only. Their numbers and claims ("35 million views", "$20 plan") are theirs and never go in our videos. We don't copy their lines, characters or look.

### The numbers

| | References (11) | Ours (5) | Change made |
|---|---|---|---|
| Loudness | -14.7 to -20.1 LUFS, the 60 s ones about -15 | -21.3 to -22.4 | Mastered to -16 with a soft limiter |
| Quiet floor (5th percentile) | -30 to -37 dB | -38 to -46 dB | The music never stops, except on purpose |
| Bass share of the sound | 11 to 16% | 5 to 6.5% | A new bed with a kick and bass |
| Speech against pauses | About 7 dB (2 to 10) | About 9 dB | The bed sits higher |
| Words per minute | 160 to 173 in the long ones, 140 to 143 in the 60 s ones | 131 to 159 | No change |
| Length | 8 at 2:00 to 2:36, 3 at about 1:02 | 33 to 87 s | No change: this round doesn't test length |

### What the references do

1. **They open on emotion plus a problem.** 6 of 11 start by saying the AI's name with a complaint: "Claude, why do you forget everything…". 3 start on a personal disaster ("Six hours…"). The name lands in the first second, on a character close-up with a worried or let-down face.
2. **The sound swings in the short ones.** The music drops out for about 0.3 to 0.5 s right before a reveal (bass falls to -50 dB or lower), then comes back on the reveal. Measured at the "this one got…" moments in two of the 60 s videos. The long tutorials stay much steadier at the moments checked, so swings suit reveals, not every line.
3. **They explain like a friend.**
   - A stranger's question gets an everyday comparison: a folder online, "stars are like likes", "same brain, different hands", a blank whiteboard.
   - One character asks what the viewer would ask ("What's a terminal?"). The other answers in a line or two. Typical lines are about 7 to 8 words.
4. **They show the example.** The exact words typed sit beside what came out, using one small, concrete example all the way through.
5. **They state the cost plainly**, every time it matters.
6. **They repeat two beats.** "That's the mistake everybody makes" appears in 8 of 11, and "the tip most people skip" in 7 of 11.
7. **They end on a joke that calls back to the start**, often after the link line.

### Where ours fell short

- Hooks were clever questions with no feeling, and a stranger heard no name until the end.
- Our six-step tutorial named menus aloud ("Short Form, then AI Fruit Story") and never said what Zyvo is.
- Our music was quiet and soft, about 6 dB under theirs overall, with a third of their bass.
- Almost no "typed next to what came out" moment.

## The owner's yelling Fruit video (2026-11-02)

Written by the owner line by line, made by hand, not in the Queue: `content/studio-previews/fruit-yell/` (bleep and uncensored, 28.2 s, voices $0.053).

- **Yelling needs ElevenLabs `eleven_v3` with tags** (`[shouting] [furious]`). The usual model at its most extreme measured -19 to -23 LUFS and 122-158 Hz; v3 measured -13.9 LUFS and 262 Hz, same voice. Nobody has listened yet: these are measurements.
- New script options, all off unless a script asks: `bleep`, `energy.hard_stop`, `energy.from_frame0`, `shake`, `snap_start`, expression `angry`, pose `rage`, shot `rage_hook`, prop `none`, roll `format: "clock"`, cues `tap|x|y` and `flip|file`, `screen.chip`.
- Whisper ends words early: a bleep needs padding, or the "-ing" stays audible.

## Rage hook, the recipe (2026-11-02)

The owner called the yelling Fruit video the best yet and asked to keep it as a recipe: `scripts/studio/rageHook.mjs`, one JSON per video in `scripts/studio/recipes/` (README there). Second video: Cutaway, French drain, 29.85 s, voices $0.054. Line 1 took 3 v3 takes; the score (loudness + pitch) picked one. Time from the job log: 4:48, a premade topic; custom topics took much longer.

## Round 3: one story per video (2026-11-02)

The owner read the last 2 scripts as incoherent: "Ditches shouldn't be this addictive", then "Zyvo is a website…", then "why it's called French". Each stacked rule forced in its own line, so nothing followed from the line before.

**What replaced the rules:**

- One template per angle (`scripts/studio/storyTemplates.mjs`): 4-6 lines that follow one thread.
- A video is about the TOPIC (Zyvo only in the caption and on the end card) or about MAKING IT WITH ZYVO. Never both.
- The owner approves or edits each script in the Studio tab before anything renders. The worker refuses to render a job without that approval.
- A script appears in about a minute, even for a new creation: the slow frame work now comes after the approval.

**Gone:** the "say what Zyvo is before any step" line, the 2-question rule, the required typed-next-to-result card, big moments, the fresh-viewer check (the owner's read replaces it) and the conveyor prop (it rendered cut off).

**Kept:** the first-second rules for line 1 and frame 0, 15-25 s by default, no music bed, the word budget, honesty rules.

**Clips** now end on a shot boundary where they can, and the writer is told what the clip says, so the lines around it follow from it.

Not rendered yet at the time of writing: the first approved script is the first real test.

## Round 2: the first second (2026-11-02)

**The owner's numbers:** every video stalls at about 300 views, TikTok says most viewers stop at 0:01 on all of them, and average watch is 4 to 8 s on 50 to 100 s videos, with likes at about 3% of views. These come from the owner's TikTok screens. Whether the first second is the whole cause is a hypothesis these tests will check.

**What the first 0.5 s of our videos measured** (the 5 v2 videos, the 2 Studio shorts marked posted, and the friend test):

- No video fade and no audio fade on the voice, but the voice started at about 0.15 s, after a sound effect.
- The first word was sometimes followed by near silence ("Wait." then -39 dB at 0.4 to 0.6 s).
- The characters were small, with a face about a tenth of the frame.
- The prop scaled in until about 0.3 s, and the captions popped in small.
- The headline was large at the top, which reads like a title card.
- Most rows marked posted in the database (slideshows of 14 to 16 s) have no sound track at all and don't move in the first second. The v2 videos aren't marked as posted there, so their stats aren't in the database.

**New rules** (these replace rule 1 below, and "Zyvo…" as an opener is gone):

- Line 1 never says Zyvo or Zee. It starts with a known name or a universal pain or curiosity, stays true, and never starts with "How to", "How do I", "Wait", "So" or "Okay". The how-to phrase goes in the caption and search title.
- Frame 0 is whole at once: the creator's face at about half the frame (`face_hook` shot), the creation's real picture as a wide card, a small headline, and the voice on the first sample with a louder first word.
- Default length is 15-25 s, one idea, ending on words that lead back to line 1. 60-90 s only when asked for by name.
- No music bed, because the owner didn't like it. Sound effects stay.

**The 2 tests** ($0.148 in total), both in the Queue:

| Video | Hook | Length | Cost |
|---|---|---|---|
| `studio_d3be4768_A5.mp4` (Blocky) | "I can't animate. At all." | 23.4 s | $0.079 |
| `studio_45051bb3_A1.mp4` (Cutaway) | "Ditches shouldn't be this addictive. Why?" | 23.5 s | $0.069 |

Both passed the fresh-viewer check first time, and both measure -7 dB in the first 50 ms.

**Seen in their frames, not fixed:** the second line's conveyor prop is cut off at the left edge and shows an empty box, in both videos and in the earlier test.

**What to watch once posted:** the 3-second hold and the average watch, against about 300 views. Recipe tag: `studio_first_second_v4`.

## The Studio rules now (all in the code)

Written scripts must pass these or get rewritten (`validateFriend` in `scripts/studio/storyScripts.mjs`, prompt in `scripts/studio/storyWriter.mjs`):

1. **Opening.** Line 1 is the creator, let down, saying "Zyvo…" or "Zee…" and then the problem. "Claude…" only in angle A2, where the video is really about using Claude. The delivery is steered with a disappointed tone. This replaces the old rule "Zyvo is never in the hook"; the headline still has no Zyvo.
2. **No invented frustration numbers.** The references use lines like "11 views". We can't, because our rule is real numbers only.
3. **Plain words first.** A line says what Zyvo is (a website that makes the video) before any step or screen.
4. **Steps.** What you do and why, in everyday words. Menu names only on stickers, never spoken.
5. **Questions.** The creator asks at least 2 of the viewer's confused questions. Zee answers simply.
6. **At most 3 big moments:** the real clip plus up to 2 lines.
7. **"What I typed" next to "what came out"** in every video, using the creation's real idea and real picture (`typed_result` prop).
8. **Fresh-viewer check.** A fast model reads only the transcript and must say what Zyvo is and what to do next. One rewrite if it can't, then the job fails. Its answers are saved in the script.

Sound (`scripts/studio/audio.py`, on for every written script):

- A high-energy bed made in code, so there's nothing to license, from frame 0.
- Filtered until a drop on the hook, the first word after the name.
- The music cuts for 0.4 s before each big moment, with a bass hit on it. The last one also gets a record scratch.
- A sound on every short reaction line: up for surprise, down for let-down, a quick pop otherwise.

## The first test video (2026-11-02)

`content/studio-previews/worker/studio_6457750b_A6.mp4`: Cutaway, A6 tutorial, idea `8a6699d6-5db1-4b08-8f0a-90d8778f4bbb` in the Queue. Real cost $0.1754, against an estimate of $0.10.

| | Result | References |
|---|---|---|
| Loudness | -16.1 LUFS | -14.7 to -20.1 |
| Speech against pauses | 7.0 dB | About 7 |
| Quiet floor | -26.6 dB | -30 to -37 |
| Bass share | 19.8% | 11 to 16% (still high) |

The fresh viewer passed first time. Measured only: nobody has yet listened and judged the disappointed "Zyvo…" or the energy of the bed.

**Problems seen in its frames.** The first three are fixed in the code but not yet shown in a render:
- It ran 101 s against the 60-90 s bucket. The writer now has a word budget that leaves room for the clip.
- The opening bubble was labelled "creator".
- The headline vanished after frame 0, covered by the first prop.
- Line 1 was mild ("how do I make an explainer video?") and the face was small, more curious than let down. This is not fixed.

## Still open

- **Which of this actually works.** Only post numbers can say. These videos carry the recipe tag `studio_friend_v3`, so the Studio score can compare them with `studio_v2` once enough are posted.
- **Length.** Most references run past 2 minutes. Our buckets stop at 90 s, and that hasn't been tested.
- **Visual pace.** Several references cut much faster (25 to 37 cuts a minute against our 5 to 16). This round changed sound and script, not camera pace.
