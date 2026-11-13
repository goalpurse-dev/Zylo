// Blocky Worlds STUDIO WORKER: the real steps of one run, as the Studio v3 drivers do them (engine/dev/studio/prepare.mjs
// + direct.mjs), but with the run's own script and the worker's keys. The Studio code in scripts/blockyWorlds/studio/ is
// IMPORTED, never changed here. Each step books its money on the Studio ledger L (studio/ledger.mjs) and every paid call
// is checked against the caps first (L.check, wrapped by runner.mjs).
//   makeSteps({ anthropicKey, elevenKey, cfg }) -> { voice, plan, mix, direct, final, outputs }
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { STUDIO } from "../../../supabase/functions/_shared/blockyWorlds/studio.js";
import { elevenVoice, narratorFor } from "../engine/voice/eleven.mjs";
import { planVideo, checkTimeline, checkVisuals, checkSubjects } from "../engine/plan.mjs";
import { directStory } from "../engine/lib/director/index.js";
import { bedFromLoop, mixAudio } from "../engine/audio/mix.mjs";
import { sfxCues } from "../engine/lib/sfx.js";
import { simpleCues, AUDIO_SIMPLE } from "../engine/lib/audioPlan.js";
import { processTake } from "../studio/pace.mjs";
import { fixAnimalCast } from "../studio/castFix.mjs";
import { directVideo, derive, MODELS } from "../studio/agent.mjs";
import { assemble, allChecks } from "../studio/assemble.mjs";
import { shotMix } from "../studio/shotMix.mjs";
import { makeStudioBundle } from "../studio/bundle.mjs";
import { renderFinal, finalLimits, sheetMaxSec, RATE } from "../studio/render.mjs";
import { StudioStop } from "./runner.mjs";

const FF = process.env.FFMPEG ?? "ffmpeg";
const probe = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString()) || null;

export function makeSteps({ anthropicKey, elevenKey, cfg = STUDIO }) {
  if (MODELS.sonnet !== cfg.model) throw new Error(`studio/agent.mjs's Sonnet is ${MODELS.sonnet}, the launch config says ${cfg.model}`);
  return {
    /** the ONE paid take (Scruffy Duck on eleven_v3), then the pace: always 1.25x, the pause cuts (studio/pace.mjs) */
    async voice({ script, dir, L }) {
      const narrator = narratorFor(cfg.narrator);
      const chars = script.lines.map((l) => String(l.text).trim()).join("\n").length;
      L.check("voice", +(chars * 0.5 * 0.0002).toFixed(4)); // worst case: 0.5 ElevenLabs credits a character
      const out = path.join(dir, "voice");
      await elevenVoice({ lines: script.lines, outDir: out, narrator, apiKey: elevenKey });
      const v = await processTake({ outDir: out });
      L.add("voice", v.costUsd ?? +(chars * 0.44 * 0.0002).toFixed(4));
      L.log({ step: "voice", chars, voice: narrator.voiceName, model: narrator.model, speed: v.speed, duration: v.duration, pace: v.pace });
      return { wav: v.wav, words: v.words, duration: v.duration, chars };
    },
    /** the base plan (free): the real word timings + the free mock director; an animal cast as a person -> the pet */
    async plan({ script, card, words, lengthSec, dir }) {
      const direction = await directStory({ script, idea: card, provider: "mock" });
      const tl0 = await planVideo({ script, words, idea: card, lengthSec, direction, criticalMode: "report" });
      const castFixes = fixAnimalCast(tl0, script);
      fs.writeFileSync(path.join(dir, "base-timeline.json"), JSON.stringify(tl0));
      return { tl0, castFixes, checks: { timeline: checkTimeline(tl0).length, visuals: checkVisuals(tl0, script).length, subjects: checkSubjects(tl0).length } };
    },
    /** music A + the simple-look cues + the mix (local ffmpeg, audio only) */
    async mix({ tl0, script, voiceWav, dir }) {
      const music = path.join(dir, "music.wav"), file = path.join(dir, "mix.m4a");
      await bedFromLoop("A", tl0.duration, music, { tempo: AUDIO_SIMPLE.bedTempo });
      const cues = simpleCues(tl0, sfxCues(tl0), script);
      const a = await mixAudio({ voice: voiceWav, music, out: file, duration: tl0.duration, sfxCues: cues, musicUnderVoiceDb: AUDIO_SIMPLE.musicUnderVoiceDb });
      return { file, lufs: a?.lufs ?? null, cues: cues.length };
    },
    /** ONE Sonnet director for the whole story, ONE fix round (studio/agent.mjs); the reserve keeps the checks, the fix
     *  round and the final render funded inside the caps */
    async direct({ tl0, script, dir, L, log, briefNote = null }) {
      const nCuts = Math.round((tl0.duration / 60) * 58);
      const reserve = { finalUsd: finalLimits(tl0, cfg.finalJobs).worstUsd, previewUsd: +(sheetMaxSec(nCuts) * RATE).toFixed(4), checkUsd: 0.06, fixUsd: 0.08 };
      // briefNote: the Studio builds (assets.mjs: names + lines only, marked as DATA) after the brief
      return directVideo({ tl0, script, out: dir, L, apiKey: anthropicKey, model: cfg.model, rounds: cfg.rounds, minutes: cfg.directorMinutes, effort: cfg.effort, reserve, log, ...(briefNote ? { briefNote } : {}) });
    },
    /** the final timeline + every check; a line without a cut or a cut with invalid code never renders; then the final
     *  on RunPod (parallel frame-pack jobs) + the local encode and mux */
    async final({ plan, tl0, script, dir, L, mix }) {
      const shotRes = derive(plan, tl0);
      const badCode = Object.entries(shotRes).filter(([, r]) => !r.ok && !r.motionOnly);
      const { tl, problems } = assemble(tl0, plan);
      const ac = allChecks(tl, script, plan), mixStats = shotMix(plan, tl, shotRes);
      fs.writeFileSync(path.join(dir, "checks.json"), JSON.stringify({ ...ac, mix: mixStats }));
      const uncovered = problems.filter((p) => /no shot|no word|no line/.test(p));
      if (uncovered.length) throw new StudioStop("UNCOVERED", `${uncovered.length} line(s) without a cut: ${uncovered.slice(0, 5).join("; ")}`.slice(0, 600));
      if (badCode.length) throw new StudioStop("BAD_CODE", `${badCode.length} cut(s) with invalid code: ${badCode.map(([id, r]) => `${id}: ${r.errors?.[0]}`).join("; ")}`.slice(0, 600));
      const code = await makeStudioBundle({ timeline: tl, shots: Object.fromEntries(plan.shots.map((s) => [s.id, s.code])), assets: plan.assets, homes: plan.bible?.homes ?? {}, creatures: plan.creatures ?? [], captions: true });
      const fin = await renderFinal({ code, tl, out: path.join(dir, "final"), mix, jobs: cfg.finalJobs, L });
      if (!fin.ok) throw new StudioStop("RENDER_FAILED", String(fin.error ?? "the final render failed").slice(0, 1200));
      return { final: fin.final, frames: fin.frames, jobs: fin.jobs, wallSec: fin.wallSec, gate: ac.gate, cuts: ac.cuts, mix: mixStats.stats };
    },
    /** the files the page shows: the full final (re-encoded under the upload limit when needed), a light 720p copy, a poster */
    async outputs({ final, dir, maxBytes = cfg.maxUploadBytes }) {
      let file = final;
      for (const crf of [23, 26, 29, 32]) {
        if (fs.statSync(file).size <= maxBytes) break;
        const next = path.join(dir, `final_crf${crf}.mp4`);
        execFileSync(FF, ["-v", "error", "-y", "-i", final, "-c:v", "libx264", "-preset", "veryfast", "-crf", String(crf), "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", next]);
        file = next;
      }
      if (fs.statSync(file).size > maxBytes) throw new StudioStop("RENDER_FAILED", `the final is ${fs.statSync(file).size} bytes even at crf 32`);
      const web = path.join(dir, "web.mp4"), poster = path.join(dir, "poster.jpg");
      execFileSync(FF, ["-v", "error", "-y", "-i", file, "-vf", "scale=720:-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", web]);
      execFileSync(FF, ["-v", "error", "-y", "-ss", "0.8", "-i", file, "-frames:v", "1", "-vf", "scale=720:-2", "-q:v", "3", poster]);
      return { final: file, web, poster, durationSec: probe(file), bytes: fs.statSync(file).size };
    },
  };
}
