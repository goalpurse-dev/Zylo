// Blocky Worlds SIMPLE-LOOK AUDIO (owner 2026-11-10, step 5b): pure, Node + browser.
//   - no pauses: the voice's own silences are trimmed (voice/eleven.mjs keepRanges: any pause over 0.18 s is cut to
//     0.1 s; never a speed-up), so no gap between words is over 0.3 s; ~220-225 wpm comes from the narrator's speed 1.2
//     + the trimmed gaps. pauseReport(words) measures it.
//   - music ~12 dB under the voice (mixAudio musicUnderVoiceDb: AUDIO_SIMPLE.musicUnderVoiceDb)
//   - almost no sound effects: ONE low boom on the rule's key word, + at most AUDIO_SIMPLE.maxStoryCues of the plan's
//     strongest story cues (a sneeze, a reveal sting), spaced far apart. No whooshes, no footsteps.
//   simpleCues(tl, planCues) -> cues (lib/sfx.js shape: { t, at, name, gainDb, why })
export const AUDIO_SIMPLE = Object.freeze({ musicUnderVoiceDb: 12, maxGap: 0.3, boom: "impact", boomGainDb: -4, maxStoryCues: 2, storyGapSec: 20 });
const STORY = new Set(["sneeze", "stinger", "scream", "crash", "door_slam", "thunder", "growl", "crowd_cheer"]);
const KEY = /^(never|always|nobody|no|don't|dont|can't|cant|must|everyone|every|only|nothing)$/;
const clean = (w) => String(w ?? "").toLowerCase().replace(/[^a-z']/g, "");

/** the rule's key word: the first rule word (never / always / nobody / must / only...) of the rule line, else its
 *  first word after "rule", else the rule line's last word. -> caption { word, start, end } | null */
export function ruleKeyWord(tl) {
  const caps = tl?.captions ?? [];
  const L = (tl?.lines ?? [])[0];
  if (!caps.length) return null;
  const inLine = L ? caps.filter((w) => w.start >= (L.start ?? 0) - 1e-6 && w.start < (L.end ?? Infinity) - 1e-6) : caps.slice(0, 16);
  if (!inLine.length) return null;
  const ri = inLine.findIndex((w) => /^rules?$/.test(clean(w.word)));
  const after = ri >= 0 ? inLine.slice(ri + 1) : inLine;
  return after.find((w) => KEY.test(clean(w.word))) ?? (ri >= 0 ? after[0] : null) ?? inLine.at(-1);
}

export function simpleCues(tl, planCues = []) {
  const out = [];
  const k = ruleKeyWord(tl);
  if (k) out.push({ t: +Math.max(0, k.start - 0.02).toFixed(3), at: +k.start.toFixed(3), name: AUDIO_SIMPLE.boom, gainDb: AUDIO_SIMPLE.boomGainDb, why: `the rule's key word "${clean(k.word)}" (one low boom)` });
  for (const c of [...(planCues ?? [])].filter((c) => STORY.has(c.name)).sort((a, b) => (b.gainDb ?? -99) - (a.gainDb ?? -99))) {
    if (out.length > AUDIO_SIMPLE.maxStoryCues) break;
    if (out.some((x) => Math.abs(x.at - c.at) < AUDIO_SIMPLE.storyGapSec)) continue;
    out.push({ ...c, gainDb: Math.min(c.gainDb ?? -8, -8) });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** the voice's pace: words per minute over the spoken span, the longest gap between words, gaps over maxGap */
export function pauseReport(words = [], maxGap = AUDIO_SIMPLE.maxGap) {
  if (!words.length) return { words: 0, wpm: 0, maxGap: 0, over: 0 };
  let mx = 0, over = 0;
  for (let i = 1; i < words.length; i++) { const g = words[i].start - words[i - 1].end; if (g > mx) mx = g; if (g > maxGap + 1e-6) over++; }
  const span = words.at(-1).end - words[0].start;
  return { words: words.length, wpm: span > 0 ? Math.round((words.length / span) * 60) : 0, maxGap: +mx.toFixed(3), over };
}
