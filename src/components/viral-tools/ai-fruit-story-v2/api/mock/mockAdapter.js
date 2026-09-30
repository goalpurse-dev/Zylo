// In-memory mock of the AI Fruit Story v2 backend (Phase 2).
//
// Implements every function of the contract in ../fruitStoryV2Api.js with
// simulated timing close to the approved prototype. Nothing is charged or
// saved: state lives in memory and resets on reload.
//
// Options:
//   timeScale  multiply every delay (tests use a tiny value)
//   fail       inject failures per step, e.g. "scene3" (picture of scene 3),
//              "clip2", "ideas", "story", "final", "plan". Each fires once, so
//              the retry path works; "ideas*2" fires twice (React StrictMode
//              runs mount effects twice in dev, so on-load calls need 2).
//
// System failures throw code "…_FAILED" (the UI shows its own copy with the
// next step); validation errors throw a plain-language message shown as-is.
//   paint      scene picture painter (default: canvas; null in node)

import { LIMITS } from "../limits.js";
import {
  CHARACTERS, IDEA_SETS, LINES, LOCATIONS, EPISODE_TEMPLATES, SAMPLE_CLIPS, SAMPLE_FINAL,
  characterById, firstName, ideaById,
} from "./mockData.js";
import { paintScene } from "./mockArt.js";

const DEFAULT_TIMINGS = {
  ideas: 700,
  writeStory: 900,
  pictureStagger: 650,
  pictureDuration: 900,
  sceneEdit: 1200,
  clipStagger: 300,
  clipBase: 1600,
  clipPerScene: 550,
  clipRegen: 1800,
  final: 1600,
  seriesPlan: 1800,
  read: 150,
};

export function sceneCountForLength(lengthSec) {
  return Math.max(3, Math.round(lengthSec / 5));
}

export function lineDurationSec(line) {
  const words = String(line).trim().split(/\s+/).filter(Boolean).length;
  return words > 7 ? 6 : words > 4 ? 5 : 4;
}

const clone = (value) => JSON.parse(JSON.stringify(value));

class MockError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function createMockAdapter({ timeScale = 1, fail = "", paint = paintScene, empty = false } = {}) {
  const stories = new Map();
  const series = new Map();
  const listeners = new Map();
  const pendingFailures = new Map(
    String(fail || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).map((entry) => {
      const [key, times] = entry.split("*");
      return [key, Math.max(1, Number(times) || 1)];
    }),
  );
  let seq = 0;
  let seeding = null;

  const nextId = (prefix) => `${prefix}_${Date.now().toString(36)}${(++seq).toString(36)}`;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms * timeScale)));
  const later = (ms, fn) => setTimeout(fn, Math.max(0, ms * timeScale));
  const takeFailure = (key) => {
    const left = pendingFailures.get(key);
    if (!left) return false;
    if (left <= 1) pendingFailures.delete(key); else pendingFailures.set(key, left - 1);
    return true;
  };

  function publicStory(story) {
    const { _scenesMeta, ...rest } = story; // internal fields stay private
    void _scenesMeta;
    return clone(rest);
  }

  function emit(story) {
    const snapshot = publicStory(story);
    listeners.get(story.id)?.forEach((fn) => fn(snapshot));
  }

  function requireStory(storyId) {
    const story = stories.get(storyId);
    if (!story) throw new MockError("NOT_FOUND", "This video doesn't exist anymore.");
    return story;
  }

  function findScene(sceneId) {
    for (const story of stories.values()) {
      const scene = story.scenes.find((s) => s.id === sceneId);
      if (scene) return { story, scene };
    }
    throw new MockError("NOT_FOUND", "This scene doesn't exist anymore.");
  }

  function sceneFigures(scene) {
    return scene.presentIds.map((id) => characterById(id)).filter(Boolean);
  }

  async function paintFor(story, scene, variant = 0) {
    const meta = story._scenesMeta[scene.index];
    try {
      return (await paint?.({ aspect: story.aspect, location: LOCATIONS[meta.loc], figures: sceneFigures(scene), variant })) ?? null;
    } catch {
      return null;
    }
  }

  function describeScene(story, scene) {
    const speaker = characterById(scene.speakerId);
    const others = scene.presentIds.filter((id) => id !== scene.speakerId).map((id) => characterById(id)?.name).filter(Boolean);
    const place = LOCATIONS[story._scenesMeta[scene.index].loc].name;
    const facing = others.length ? `, facing ${others.join(" and ")}` : "";
    return `${speaker?.name ?? "A character"} stands in the ${place}${facing}, saying "${scene.line}" Dramatic lighting, ${story.aspect === "9:16" ? "vertical" : "wide"} framing.`;
  }

  function buildScenes({ castIds, lines, lengthSec, cliffhanger }) {
    const count = lines ? lines.length : sceneCountForLength(lengthSec);
    return Array.from({ length: count }, (_, index) => {
      const source = lines
        ? { title: `Line ${index + 1}`, line: lines[index].line, speakerId: lines[index].speakerId }
        : (() => {
          const bank = LINES[index % LINES.length];
          const isLast = index === count - 1 && cliffhanger;
          return {
            title: isLast ? "Cliffhanger" : bank.title,
            line: isLast ? cliffhanger.replace(/"/g, "") : bank.line,
            speakerId: castIds[(isLast ? 2 : bank.s) % castIds.length],
          };
        })();
      // Speaker plus one listener; every 4th scene with 3+ cast brings in a third.
      const others = castIds.filter((id) => id !== source.speakerId);
      const present = [source.speakerId, others[index % Math.max(1, others.length)]].filter(Boolean);
      if (index % 4 === 3 && others.length >= 2) present.push(others[(index + 1) % others.length]);
      const presentIds = [...new Set(present)].slice(0, LIMITS.maxCharactersPerScene);
      return {
        id: nextId("scene"),
        index,
        title: source.title,
        speakerId: source.speakerId,
        line: source.line,
        presentIds,
        durationSec: lineDurationSec(source.line),
        imageStatus: "queued",
        imageUrl: null,
        imagePrompt: "",
        clipStatus: "none",
        clipUrl: null,
        error: null,
      };
    });
  }

  function newStory({ title, castIds, quality, lengthSec, aspect, lines, seriesId, episodeNumber, cliffhanger }) {
    const scenes = buildScenes({ castIds, lines, lengthSec, cliffhanger });
    const story = {
      id: nextId("story"),
      title,
      castIds,
      quality,
      lengthSec: lines ? Math.max(LIMITS.minLengthSec, scenes.reduce((sum, s) => sum + s.durationSec, 0)) : lengthSec,
      aspect,
      status: "draft",
      scenes,
      final: { status: "none", url: null, trimmedSec: 0, captions: true, trimmedPerClipSec: [], error: null },
      createdAt: new Date().toISOString(),
      _scenesMeta: scenes.map((_, i) => ({ loc: Math.floor(i / 2) % LOCATIONS.length, variant: 0 })),
      ...(seriesId ? { seriesId, episodeNumber } : {}),
    };
    story.scenes.forEach((scene) => { scene.imagePrompt = describeScene(story, scene); });
    stories.set(story.id, story);
    return story;
  }

  function refreshPictureStatus(story) {
    if (story.status === "pictures" && story.scenes.every((s) => s.imageStatus === "ready" || s.imageStatus === "failed")) {
      story.status = "pictures_ready";
    }
  }

  function refreshClipStatus(story) {
    if (story.status === "animating" && story.scenes.every((s) => s.clipStatus === "ready" || s.clipStatus === "failed")) {
      story.status = "clips_ready";
    }
  }

  function validateCast(castIds, min, max) {
    if (!Array.isArray(castIds) || castIds.length < min || castIds.length > max) {
      throw new MockError("INVALID_CAST", min === max ? `Pick ${min} characters.` : `Pick ${min} to ${max} characters.`);
    }
    for (const id of castIds) {
      if (!characterById(id)) throw new MockError("INVALID_CAST", "One of those characters isn't in the library.");
    }
  }

  // ── Seed data: a few finished videos and two series, so Recent isn't empty ──
  function seed() {
    if (empty) return Promise.resolve();   // dev preview &recent=empty: a new account's view
    if (seeding) return seeding;
    seeding = (async () => {
      const singles = [
        { title: "The perfect revenge dinner", castIds: ["mia", "marco", "pia"], lengthSec: 45, daysAgo: 0 },
        { title: "Snitches get spots", castIds: ["pina", "benny", "coco"], lengthSec: 30, daysAgo: 1 },
        { title: "HR has entered the chat", castIds: ["linda", "rick", "gloria"], lengthSec: 60, daysAgo: 5 },
      ];
      for (const s of singles) {
        const story = newStory({ ...s, quality: "v2", aspect: "9:16" });
        story.createdAt = new Date(Date.now() - s.daysAgo * 86400000 - 3600000).toISOString();
        await finishInstantly(story);
      }
      const plans = [
        { title: "Rotten to the Core", logline: "A CEO, an intern, a glass office, and a wife who owns 51% of the company.", castIds: ["rick", "bella", "gloria", "marg", "linda"], episodeCount: 10, made: 2, daysAgo: 2 },
        { title: "Cellblock D", logline: "The kingpin's trial goes wrong when his own crown starts beeping.", castIds: ["pina", "benny", "coco"], episodeCount: 5, made: 5, daysAgo: 8 },
      ];
      for (const p of plans) {
        const s = makeSeries(p);
        s.createdAt = new Date(Date.now() - p.daysAgo * 86400000).toISOString();
        for (const ep of s.episodes.slice(0, p.made)) {
          const story = newStory({ title: `Ep ${ep.number}: ${ep.title}`, castIds: s.castIds.slice(0, 3), quality: "v2", lengthSec: 30, aspect: "9:16", seriesId: s.id, episodeNumber: ep.number, cliffhanger: ep.cliffhanger });
          story.createdAt = s.createdAt;
          await finishInstantly(story);
          ep.storyId = story.id;
        }
        unlockEpisodes(s);
      }
    })();
    return seeding;
  }

  async function finishInstantly(story) {
    for (const scene of story.scenes) {
      scene.imageStatus = "ready";
      scene.imageUrl = await paintFor(story, scene);
      scene.clipStatus = "ready";
      scene.clipUrl = SAMPLE_CLIPS[scene.index % SAMPLE_CLIPS.length];
    }
    story.status = "final_ready";
    story.final = finalFor(story, true);
  }

  function finalFor(story, captions) {
    const trimmedPerClipSec = story.scenes.map((s) => [0.4, 0.7, 1.0][s.index % 3]);
    const trimmedSec = Math.round(trimmedPerClipSec.reduce((a, b) => a + b, 0) * 10) / 10;
    return { status: "ready", url: SAMPLE_FINAL, trimmedSec, captions, trimmedPerClipSec, error: null };
  }

  function makeSeries({ title, logline, castIds, episodeCount }) {
    const [a, b, c] = [castIds[0], castIds[1], castIds[2] ?? castIds[0]].map(firstName);
    const fill = (text) => text.replace(/\{a\}/g, a).replace(/\{b\}/g, b).replace(/\{c\}/g, c);
    const s = {
      id: nextId("series"),
      title,
      logline,
      castIds,
      createdAt: new Date().toISOString(),
      episodes: Array.from({ length: episodeCount }, (_, i) => {
        const t = EPISODE_TEMPLATES[i % EPISODE_TEMPLATES.length];
        return {
          number: i + 1,
          title: i === episodeCount - 1 ? "Season finale" : t.title,
          summary: fill(t.summary),
          cliffhanger: fill(t.cliffhanger),
          status: "locked",
        };
      }),
    };
    unlockEpisodes(s);
    series.set(s.id, s);
    return s;
  }

  /** Episodes unlock in order: every made one, then exactly one "next". */
  function unlockEpisodes(s) {
    let nextGiven = false;
    for (const ep of s.episodes) {
      const story = ep.storyId ? stories.get(ep.storyId) : null;
      if (story?.status === "final_ready") ep.status = "made";
      else if (!nextGiven) { ep.status = "next"; nextGiven = true; }
      else ep.status = "locked";
    }
  }

  function seriesSummary(s) {
    const madeCount = s.episodes.filter((e) => e.status === "made").length;
    const thumbs = s.episodes
      .map((e) => (e.storyId ? stories.get(e.storyId) : null))
      .filter(Boolean)
      .flatMap((story) => story.scenes.map((sc) => sc.imageUrl).filter(Boolean))
      .slice(0, 3);
    return { type: "series", id: s.id, title: s.title, castIds: s.castIds, episodeCount: s.episodes.length, madeCount, thumbUrls: thumbs, createdAt: s.createdAt };
  }

  // ── Contract ─────────────────────────────────────────────────────────────
  const api = {
    isMock: true,

    async listCharacters() {
      await sleep(DEFAULT_TIMINGS.read);
      return clone(CHARACTERS);
    },

    async getIdeas({ seed: page = 0 } = {}) {
      await sleep(DEFAULT_TIMINGS.ideas);
      if (takeFailure("ideas")) throw new MockError("IDEAS_FAILED", "We couldn't load new ideas.");
      return clone(IDEA_SETS[Math.abs(page) % IDEA_SETS.length]);
    },

    async createStory(input) {
      await sleep(DEFAULT_TIMINGS.writeStory);
      if (takeFailure("story")) throw new MockError("STORY_FAILED", "We couldn't write the script.");
      const quality = ["v2", "v3", "v4"].includes(input.quality) ? input.quality : "v2";
      const aspect = input.aspect === "16:9" ? "16:9" : "9:16";
      const lengthSec = Math.min(LIMITS.maxLengthSec, Math.max(LIMITS.minLengthSec, Math.round((input.lengthSec || 30) / LIMITS.lengthStepSec) * LIMITS.lengthStepSec));
      const base = { quality, aspect, lengthSec, seriesId: input.seriesId, episodeNumber: input.episodeNumber };

      if (input.seriesId) {
        const s = series.get(input.seriesId);
        if (!s) throw new MockError("NOT_FOUND", "This series doesn't exist anymore.");
        const ep = s.episodes.find((e) => e.number === input.episodeNumber);
        if (!ep || ep.status === "locked") throw new MockError("EPISODE_LOCKED", "Make the earlier episodes first.");
        const castIds = s.castIds.slice(0, LIMITS.maxCharactersPerScene);
        const story = newStory({ ...base, title: `Ep ${ep.number}: ${ep.title}`, castIds, cliffhanger: ep.cliffhanger });
        ep.storyId = story.id;
        return publicStory(story);
      }

      if (input.source === "idea") {
        const idea = ideaById(input.ideaId);
        if (!idea) throw new MockError("INVALID_IDEA", "That idea isn't available anymore. Pick another one.");
        return publicStory(newStory({ ...base, title: idea.title, castIds: idea.castIds }));
      }

      if (input.source === "script") {
        // The cast is whoever speaks; castIds is optional and derived when missing.
        const lines = (input.script || []).map((r) => ({ speakerId: r.speakerId, line: String(r.line || "").trim() })).filter((r) => r.line);
        if (lines.length < 2) throw new MockError("SCRIPT_TOO_SHORT", "Write at least two lines, each starting with who's talking.");
        if (lines.some((r) => !characterById(r.speakerId))) throw new MockError("INVALID_SPEAKER", "Every line needs a speaker from the character library.");
        const speakers = [...new Set(lines.map((r) => r.speakerId))];
        if (speakers.length > LIMITS.maxCharactersPerScene) {
          throw new MockError("TOO_MANY_SPEAKERS", `Use at most ${LIMITS.maxCharactersPerScene} different speakers. This script has ${speakers.length}.`);
        }
        const castIds = Array.isArray(input.castIds) && input.castIds.length ? input.castIds : speakers;
        if (speakers.some((id) => !castIds.includes(id))) throw new MockError("INVALID_SPEAKER", "Every speaker must be in the cast.");
        validateCast(castIds, 1, LIMITS.maxCastSingle);
        return publicStory(newStory({ ...base, title: "My script", castIds, lines }));
      }

      validateCast(input.castIds, 1, LIMITS.maxCastSingle);
      if (input.source === "prompt") {
        const prompt = String(input.prompt || "").trim();
        if (prompt.length < 10) throw new MockError("PROMPT_TOO_SHORT", "Describe the story in a sentence or two.");
        if (prompt.length > LIMITS.maxPromptChars) throw new MockError("PROMPT_TOO_LONG", `Keep the story under ${LIMITS.maxPromptChars} characters.`);
        const title = prompt.length > 48 ? `${prompt.slice(0, 47).trimEnd()}…` : prompt;
        return publicStory(newStory({ ...base, title, castIds: input.castIds }));
      }

      throw new MockError("INVALID_SOURCE", "Pick an idea, describe a story, or write a script.");
    },

    async generateScenePictures(storyId) {
      await sleep(DEFAULT_TIMINGS.read);
      const story = requireStory(storyId);
      if (story.status !== "draft") return publicStory(story);
      story.status = "pictures";
      story.scenes.forEach((scene, i) => {
        scene.imageStatus = "queued";
        later(i * DEFAULT_TIMINGS.pictureStagger, () => { scene.imageStatus = "generating"; emit(story); });
        later(i * DEFAULT_TIMINGS.pictureStagger + DEFAULT_TIMINGS.pictureDuration, async () => {
          if (takeFailure(`scene${i + 1}`)) {
            scene.imageStatus = "failed";
            scene.error = "The picture couldn't be made.";
          } else {
            scene.imageUrl = await paintFor(story, scene);
            scene.imageStatus = "ready";
            scene.error = null;
          }
          refreshPictureStatus(story);
          emit(story);
        });
      });
      emit(story);
      return publicStory(story);
    },

    async editScene(sceneId, instruction) {
      const { story, scene } = findScene(sceneId);
      const text = String(instruction || "").trim();
      if (!text) throw new MockError("EMPTY_EDIT", "Say what should change.");
      if (!["pictures_ready", "pictures"].includes(story.status)) throw new MockError("TOO_LATE", "Scenes can't be edited after animating.");
      scene.imagePrompt = `${scene.imagePrompt} Change: ${text}`;
      return regeneratePicture(story, scene);
    },

    async regenerateScene(sceneId, prompt) {
      const { story, scene } = findScene(sceneId);
      const text = String(prompt || "").trim();
      if (!text) throw new MockError("EMPTY_PROMPT", "The scene description can't be empty.");
      if (!["pictures_ready", "pictures"].includes(story.status)) throw new MockError("TOO_LATE", "Scenes can't be regenerated after animating.");
      scene.imagePrompt = text;
      return regeneratePicture(story, scene);
    },

    async animateAll(storyId) {
      await sleep(DEFAULT_TIMINGS.read);
      const story = requireStory(storyId);
      if (story.status !== "pictures_ready") throw new MockError("NOT_READY", "Finish the scene pictures first.");
      if (story.scenes.some((s) => s.imageStatus !== "ready")) throw new MockError("PICTURES_MISSING", "Every scene needs a picture before animating.");
      story.status = "animating";
      story.scenes.forEach((scene, i) => {
        scene.clipStatus = "queued";
        later(i * DEFAULT_TIMINGS.clipStagger, () => { scene.clipStatus = "generating"; emit(story); });
        later(DEFAULT_TIMINGS.clipBase + i * DEFAULT_TIMINGS.clipPerScene, () => {
          if (takeFailure(`clip${i + 1}`)) {
            scene.clipStatus = "failed";
            scene.error = "The clip couldn't be animated.";
          } else {
            scene.clipStatus = "ready";
            scene.clipUrl = SAMPLE_CLIPS[i % SAMPLE_CLIPS.length];
            scene.error = null;
          }
          refreshClipStatus(story);
          emit(story);
        });
      });
      emit(story);
      return publicStory(story);
    },

    async regenerateClip(sceneId) {
      const { story, scene } = findScene(sceneId);
      if (!["clips_ready", "animating"].includes(story.status)) throw new MockError("NOT_READY", "Animate the scenes first.");
      if (story.status === "clips_ready") story.status = "animating";
      scene.clipStatus = "generating";
      scene.error = null;
      emit(story);
      later(DEFAULT_TIMINGS.clipRegen, () => {
        scene.clipStatus = "ready";
        scene.clipUrl = SAMPLE_CLIPS[(scene.index + 1) % SAMPLE_CLIPS.length];
        refreshClipStatus(story);
        emit(story);
      });
      return publicStory(story);
    },

    async buildFinal(storyId, { captions = true } = {}) {
      await sleep(DEFAULT_TIMINGS.read);
      const story = requireStory(storyId);
      if (!["clips_ready", "final_ready"].includes(story.status)) throw new MockError("NOT_READY", "Animate every scene first.");
      if (story.scenes.some((s) => s.clipStatus !== "ready")) throw new MockError("CLIPS_MISSING", "Every scene needs a clip before the final video.");
      story.status = "building";
      story.final = { ...story.final, status: "building", captions, error: null };
      emit(story);
      later(DEFAULT_TIMINGS.final, () => {
        if (takeFailure("final")) {
          story.status = "clips_ready";
          story.final = { ...story.final, status: "failed", error: "We couldn't join your clips." };
        } else {
          story.status = "final_ready";
          story.final = finalFor(story, captions);
          if (story.seriesId) {
            const s = series.get(story.seriesId);
            if (s) unlockEpisodes(s);
          }
        }
        emit(story);
      });
      return publicStory(story);
    },

    async getStory(storyId) {
      await seed();
      await sleep(DEFAULT_TIMINGS.read);
      return publicStory(requireStory(storyId));
    },

    subscribeStory(storyId, onChange) {
      if (!listeners.has(storyId)) listeners.set(storyId, new Set());
      listeners.get(storyId).add(onChange);
      return () => listeners.get(storyId)?.delete(onChange);
    },

    async listSeries() {
      await seed();
      await sleep(DEFAULT_TIMINGS.read);
      return [...series.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(seriesSummary);
    },

    async createSeriesPlan({ concept, castIds, opener, tone, episodeCount }) {
      await seed();
      const text = String(concept || "").trim();
      if (text.length < 6) throw new MockError("CONCEPT_TOO_SHORT", "Describe the series in a sentence or two.");
      if (text.length > LIMITS.maxPromptChars) throw new MockError("CONCEPT_TOO_LONG", `Keep it under ${LIMITS.maxPromptChars} characters.`);
      validateCast(castIds, LIMITS.minCastSeries, LIMITS.maxCastSeries);
      const count = Math.round(Number(episodeCount));
      if (!(count >= LIMITS.minEpisodes && count <= LIMITS.maxEpisodes)) throw new MockError("INVALID_EPISODES", `Choose ${LIMITS.minEpisodes} to ${LIMITS.maxEpisodes} episodes.`);
      await sleep(DEFAULT_TIMINGS.seriesPlan);
      if (takeFailure("plan")) throw new MockError("PLAN_FAILED", "We couldn't write the series plan.");
      const firstSentence = text.split(/(?<=[.!?])\s/)[0].replace(/[.!?]+$/, "");
      const short = firstSentence.length <= 40 ? firstSentence : `${firstSentence.split(/\s+/).slice(0, 6).join(" ")}…`;
      const title = short.charAt(0).toUpperCase() + short.slice(1);
      const sentence = /[.!?]$/.test(text) ? text : `${text}.`;
      const logline = opener ? `${sentence} Episode 1 opens: ${String(opener).charAt(0).toLowerCase()}${String(opener).slice(1)}.` : sentence;
      void tone; // Phase 3: the tone shapes every line; the mock plan doesn't use it.
      return clone(makeSeries({ title, logline, castIds, episodeCount: count }));
    },

    async getSeries(seriesId) {
      await seed();
      await sleep(DEFAULT_TIMINGS.read);
      const s = series.get(seriesId);
      if (!s) throw new MockError("NOT_FOUND", "This series doesn't exist anymore.");
      unlockEpisodes(s);
      return clone(s);
    },

    async listRecent({ type = "single" } = {}) {
      await seed();
      await sleep(DEFAULT_TIMINGS.read);
      if (type === "series") return api.listSeries();
      return [...stories.values()]
        .filter((s) => !s.seriesId && s.status !== "draft")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((s) => ({
          type: "single",
          id: s.id,
          title: s.title,
          castIds: s.castIds,
          lengthSec: s.lengthSec,
          thumbUrls: s.scenes.map((sc) => sc.imageUrl).filter(Boolean).slice(0, 3),
          status: s.status,
          createdAt: s.createdAt,
        }));
    },
  };
  return api;

  async function regeneratePicture(story, scene) {
    const meta = story._scenesMeta[scene.index];
    meta.variant += 1;
    scene.imageStatus = "generating";
    scene.error = null;
    if (story.status === "pictures_ready") story.status = "pictures";
    emit(story);
    later(DEFAULT_TIMINGS.sceneEdit, async () => {
      scene.imageUrl = await paintFor(story, scene, meta.variant);
      scene.imageStatus = "ready";
      refreshPictureStatus(story);
      emit(story);
    });
    return publicStory(story);
  }
}
