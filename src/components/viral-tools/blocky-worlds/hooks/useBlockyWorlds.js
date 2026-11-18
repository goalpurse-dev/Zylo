import { useCallback, useEffect, useRef, useState } from "react";
import { BlockyWorldsError, isWorking, worldsCall } from "../api/blockyWorldsApi";
import { clearTownTopic, peekTownTopic } from "../../../../lib/promptHandoff";

/** What a picked idea card puts into the prompt bar. */
export const ideaText = (card) => card?.opener ?? "";

const EMPTY_IDEAS = { status: "idle", items: [], error: null, fromLibrary: false, libraryDone: false };
const POLL_MS = 3000;
/** Below this many ideas for the picked mood, the page asks for more by itself (once per mood). */
const IDEAS_SHOWN = 6;

/** New cards added after the ones already shown (never twice: same id or same first line). */
function appendIdeas(items, more) {
  const seen = new Set(items.flatMap((i) => [i.id, i.opener.toLowerCase()]));
  return [...items, ...more.filter((i) => !seen.has(i.id) && !seen.has(i.opener.toLowerCase()))];
}

/**
 * The Blocky Worlds flow: idea -> script -> settings -> generate -> result (docs/blocky-worlds-protocol.md).
 * Every call goes through blocky-worlds-api (worldsCall); a refusal comes back as { error } with the contract's code,
 * and the studio maps it (sign up, upgrade, add credits, or a calm notice). Nothing is charged before Generate.
 */
export default function useBlockyWorlds({ enabled = true } = {}) {
  const [access, setAccess] = useState(null);
  const [tab, setTab] = useState("idea"); // "idea" (ideas + your topic) | "own"
  const [mood, setMood] = useState(null);
  const [ideas, setIdeas] = useState(EMPTY_IDEAS);
  // a rule typed on the public page (/in-this-town-story-video-maker) opens here, once
  const [topic, setTopic] = useState(() => peekTownTopic());
  useEffect(() => { clearTownTopic(); }, []);
  const [topicIdeas, setTopicIdeas] = useState(EMPTY_IDEAS);
  const [ownText, setOwnText] = useState("");
  const [lengthSec, setLengthSec] = useState(90);
  const [draft, setDraft] = useState(null);
  const [edited, setEdited] = useState(null); // the user's unsaved line edits (null = none)
  // every line edit bumps this; a save only clears the edits it saved (typing during a save is never lost)
  const editRev = useRef(0);
  // drafts already paid at "Write my script" with no video yet (the page offers "Continue" after a reload)
  const [paidDrafts, setPaidDrafts] = useState([]);
  const [busy, setBusy] = useState(null); // "writing" | "rewriting" | "saving" | "fixing" | "fix:<part>" | "starting" | "retrying" | null
  const [pickedId, setPickedId] = useState(null);
  const [pickedIdea, setPickedIdea] = useState(null); // the idea card tapped into the prompt bar
  const [takes, setTakes] = useState([]); // the topic's other worlds: optional "Try another take" on the script step
  const [run, setRun] = useState(null);
  // the SCENE PLAN (owner-only, access.scenePlan): each scene's location from the library; null until asked for
  const [scenePlan, setScenePlan] = useState(null);
  const [recent, setRecent] = useState([]);
  const [removeWatermark, setRemoveWatermark] = useState(false);
  // THE BLENDER UI (owner-only first): the user's character references (characterRef.js specs, never the pictures)
  const [characters, setCharacters] = useState([]);
  // THE BLENDER PAGE (BlenderMaker sets it): its writes and start carry flat: the ONE price, at most ~90 s (BLENDER_FLAT)
  const flatRef = useRef(false);
  const setFlat = useCallback((on) => { flatRef.current = Boolean(on); }, []);
  const flatBody = () => (flatRef.current ? { flat: true } : {});
  const poll = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    worldsCall("access").then((a) => { setAccess(a); setLengthSec(a.defaultLength ?? 90); }).catch((e) => setAccess({ visible: false, failed: true, error: e?.message ?? "" }));
  }, [enabled]);
  useEffect(() => {
    if (!access?.signedIn) return;
    worldsCall("list").then((r) => setRecent(r.runs ?? [])).catch(() => {});
    if (access?.flat?.charge === "script") worldsCall("drafts").then((r) => setPaidDrafts((r.drafts ?? []).filter((x) => x.flat?.paidAt))).catch(() => {});
  }, [access?.signedIn, access?.flat?.charge]);

  // A run being made is polled until it's done or failed. A poll that errors keeps polling (backing off to 15 s), and
  // coming back to the tab asks at once: before 2026-11-05 one failed poll stopped the loop for good, so a failed run
  // could show many minutes late (the owner saw it ~13 min after Generate; the run had failed at 6:40).
  const runId = run?.id, working = isWorking(run);
  useEffect(() => {
    if (!runId || !working) return undefined;
    let stopped = false, inFlight = false, misses = 0;
    const tick = async () => {
      if (stopped || inFlight) return;
      inFlight = true;
      clearTimeout(poll.current);
      let more = true;
      try {
        const next = await worldsCall("status", { runId });
        misses = 0;
        if (!stopped) { setRun((cur) => (cur?.id === next.id ? next : cur)); setRecent((list) => [next, ...list.filter((r) => r.id !== next.id)]); }
        more = isWorking(next);
      } catch { misses++; }
      inFlight = false;
      if (!stopped && more) poll.current = setTimeout(tick, misses ? Math.min(15000, POLL_MS * 2 ** misses) : POLL_MS);
    };
    poll.current = setTimeout(tick, POLL_MS);
    const wake = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => { stopped = true; clearTimeout(poll.current); document.removeEventListener("visibilitychange", wake); window.removeEventListener("focus", wake); };
  }, [runId, working]);

  const attempt = useCallback(async (label, fn) => {
    setBusy(label);
    try { return { ok: true, value: await fn() }; } catch (error) { return { ok: false, error }; } finally { setBusy(null); }
  }, []);

  // Ideas pile up as the user scrolls ("More ideas" adds a batch below); the mood chips filter what's loaded at once.
  const asking = useRef(false);
  const askIdeas = useCallback(async ({ more = false } = {}) => {
    if (asking.current) return { ok: true };
    asking.current = true;
    setIdeas((s) => ({ ...s, status: "loading", error: null }));
    try {
      const r = await worldsCall("ideas", { mood, more });
      // a batch from the live writer (not the judged library) means the library has nothing new: no more auto-loading
      setIdeas((s) => ({ status: "ready", items: appendIdeas(s.items, r.ideas), error: null, fromLibrary: Boolean(r.fromLibrary), libraryDone: !r.fromLibrary }));
      return { ok: true };
    } catch (error) { setIdeas((s) => ({ ...s, status: "error", error: error.message })); return { ok: false, error }; }
    finally { asking.current = false; }
  }, [mood]);

  // signed in: ideas are there when the page opens, and a mood with too few loaded asks for its own batch (once)
  const autoAsked = useRef(new Set());
  const shownIdeas = mood ? ideas.items.filter((i) => i.mood === mood) : ideas.items;
  useEffect(() => {
    if (!access?.signedIn || tab !== "idea") return;
    const key = mood ?? "any";
    if (shownIdeas.length >= IDEAS_SHOWN || autoAsked.current.has(key)) return;
    autoAsked.current.add(key);
    askIdeas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access?.signedIn, mood, tab]);

  const askTopic = useCallback(async () => {
    setTopicIdeas((s) => ({ ...s, status: "loading", error: null }));
    try { const r = await worldsCall("topicIdeas", { topic, mood }); setTopicIdeas({ status: "ready", items: r.ideas, error: null, fromLibrary: false, libraryDone: false }); return { ok: true }; }
    catch (error) { setTopicIdeas((s) => ({ ...s, status: "error", error: error.message })); return { ok: false, error }; }
  }, [topic, mood]);

  // owner 2026-11-18: a paid script is in Recent creations at once ("Script ready" + Continue), never lost
  const notePaid = useCallback((v) => { if (v?.id && v.flat?.paidAt) setPaidDrafts((list) => [v, ...list.filter((x) => x.id !== v.id)]); }, []);
  const writeFromIdea = useCallback(async (ideaId) => {
    setPickedId(ideaId);
    const r = await attempt("writing", () => worldsCall("writeScript", { ideaId, lengthSec, ...flatBody() }));
    if (r.ok) { setDraft(r.value); setEdited(null); notePaid(r.value); }
    return r;
  }, [attempt, lengthSec, notePaid]);

  // Tapping an idea puts it into the prompt bar; it stays "picked" only while the text is still the idea's own words
  // (an edit makes it the user's own topic).
  const pickIdea = useCallback((card) => { setPickedIdea(card); setTopic(ideaText(card)); setTab("idea"); }, []);
  const picked = pickedIdea && topic === ideaText(pickedIdea) ? pickedIdea : null;

  /**
   * Continue from the prompt bar: a picked library idea is written straight from its tuned card; typed words become a
   * story in one go (the topic's worlds, then the script from the first one). The other worlds stay as optional takes.
   */
  const continueStory = useCallback(async () => {
    if (picked) { setTakes([]); return writeFromIdea(picked.id); }
    const words = topic.trim();
    let worlds = null;
    const r = await attempt("turning", async () => {
      worlds = (await worldsCall("topicIdeas", { topic: words, mood })).ideas ?? [];
      if (!worlds.length) throw new BlockyWorldsError("WRITER", "We couldn't turn that into a story. Try other words.");
      setPickedId(worlds[0].id);
      return worldsCall("writeScript", { ideaId: worlds[0].id, lengthSec, ...flatBody() });
    });
    if (r.ok) { setDraft(r.value); setEdited(null); setTakes(worlds); setTopicIdeas(EMPTY_IDEAS); notePaid(r.value); }
    // the worlds came but the script didn't: show them, so they can be picked once the problem is solved
    else if (worlds?.length) setTopicIdeas({ status: "ready", items: worlds, error: null, fromLibrary: false, libraryDone: false });
    return r;
  }, [attempt, picked, topic, mood, lengthSec, writeFromIdea, notePaid]);

  /** One of the topic's other worlds, written instead of the current script (optional). */
  const tryTake = useCallback(async (card) => {
    setPickedId(card.id);
    const r = await attempt("writing", () => worldsCall("writeScript", { ideaId: card.id, lengthSec, ...flatBody() }));
    if (r.ok) { setDraft(r.value); setEdited(null); }
    return r;
  }, [attempt, lengthSec]);

  const saveOwn = useCallback(async () => {
    const r = await attempt("saving", () => worldsCall("saveScript", { text: ownText, lengthSec }));
    if (r.ok) { setDraft(r.value); setEdited(null); }
    return r;
  }, [attempt, ownText, lengthSec]);

  const editLine = useCallback((index, text) => {
    editRev.current++;
    setEdited((prev) => { const lines = (prev ?? draft?.lines ?? []).map((l) => ({ ...l })); lines[index] = { ...lines[index], text }; return lines; });
  }, [draft]);
  /** a draft from the server, keeping its paid state when an older reply didn't carry it */
  const takeDraft = useCallback((v) => setDraft((prev) => ({ ...v, ...(v?.flat || prev?.id !== v?.id ? {} : prev?.flat ? { flat: prev.flat } : {}) })), []);
  // owner 2026-11-17: a line edit is saved at once (on blur / Enter), re-checked by the server, and never reverted
  const saveEdits = useCallback(async () => {
    if (!draft || !edited) return { ok: true };
    const rev = editRev.current, lines = edited;
    const r = await attempt("saving", () => worldsCall("saveScript", { draftId: draft.id, lines, lengthSec: draft.lengthSec, title: draft.title }));
    if (r.ok) { takeDraft(r.value); if (editRev.current === rev) setEdited(null); }
    return r;
  }, [attempt, draft, edited, takeDraft]);
  /** "Fix this line": the server rewrites only the note's lines (free), then re-checks */
  const fixLines = useCallback(async (note) => {
    if (!draft || busy) return { ok: false };
    if (edited) { const s = await saveEdits(); if (!s.ok) return s; }
    const r = await attempt(`fixline:${note}`, () => worldsCall("fixLines", { draftId: draft.id, note }));
    if (r.ok) { takeDraft(r.value); setEdited(null); }
    return r;
  }, [attempt, draft, busy, edited, saveEdits, takeDraft]);
  /** reopen a paid script (after a reload): its lines, notes and paid state come from the server */
  const openDraft = useCallback((d) => { setDraft(d); setEdited(null); setTakes([]); setRun(null); }, []);

  const rewrite = useCallback(async (note = "") => {
    if (!draft) return { ok: false };
    const r = await attempt("rewriting", () => worldsCall("rewrite", { draftId: draft.id, note, lengthSec }));
    if (r.ok) { takeDraft(r.value); setEdited(null); }
    return r;
  }, [attempt, draft, lengthSec, takeDraft]);

  /**
   * "Move it to our town" (the board-only launch mode): the story needs a world the video can't film, so it is written
   * again inside the kit, keeping its rule and its hook (a normal rewrite: free, counts toward the daily script writes).
   */
  const moveToTown = useCallback(async () => {
    if (!draft || busy) return { ok: false };
    const r = await attempt("moving", () => worldsCall("rewrite", { draftId: draft.id, move: true, lengthSec }));
    if (r.ok) { setDraft(r.value); setEdited(null); }
    return r;
  }, [attempt, draft, busy, lengthSec]);

  const fixOpener = useCallback(async () => {
    if (!draft) return { ok: false };
    const r = await attempt("fixing", () => worldsCall("fixOpener", { draftId: draft.id }));
    if (r.ok) setDraft(r.value);
    return r;
  }, [attempt, draft]);

  /** "Fix it" on one blocked part: only that part's flagged lines are rewritten (the server re-checks the whole script). */
  const fixPart = useCallback(async (part) => {
    if (!draft || busy) return { ok: false };
    const r = await attempt(`fix:${part}`, () => worldsCall("fixPart", { draftId: draft.id, part }));
    if (r.ok) { setDraft(r.value); setEdited(null); }
    return r;
  }, [attempt, draft, busy]);

  /**
   * "Try again" on a failed video: the SAME script at the SAME length (the failed run was refunded, so this charges
   * normally once). The server refuses a second run of a script while one is being made, so a double tap can't charge twice.
   */
  const retryRun = useCallback(async (failed) => {
    if (!failed?.draftId || busy) return { ok: false };
    // a Studio video (owner 2026-11-18): "retry" continues from the failed run's saved parts and charges only when ready
    // its free retries used up (owner 2026-11-18: 2 per paid script): never a new paid start from Try again
    if (failed.engine === "studio" && !failed.canRetry) return { ok: false, error: new BlockyWorldsError("LIMIT", "We couldn't make this one, all credits are back. Try a new story.") };
    const r = await attempt("retrying", () => (failed.canRetry ? worldsCall("retry", { runId: failed.id }) : worldsCall("start", { draftId: failed.draftId, removeWatermark })));
    if (r.ok) { setRun(r.value); setRecent((list) => [r.value, ...list.filter((x) => x.id !== r.value.id)]); }
    return r;
  }, [attempt, busy, removeWatermark]);

  /** "Rewrite and try again": a fresh version of the script (same length); it starts only when it passes every check. */
  const rewriteAndRetry = useCallback(async (failed) => {
    if (!failed?.draftId || busy) return { ok: false };
    return attempt("rewriting", async () => {
      const fresh = await worldsCall("rewrite", { draftId: failed.draftId, lengthSec: failed.lengthSec, note: "The last video of this script failed to build. Keep the story, and show it with simple, everyday things." });
      setDraft(fresh); setEdited(null); setLengthSec(fresh.lengthSec);
      if (!fresh.ready) return { draft: fresh, started: null };
      const started = await worldsCall("start", { draftId: fresh.id, removeWatermark });
      setRun(started); setRecent((list) => [started, ...list.filter((x) => x.id !== started.id)]);
      return { draft: fresh, started };
    });
  }, [attempt, busy, removeWatermark]);

  // the scene plan belongs to one script: a new draft (or an edit) asks for a fresh one
  useEffect(() => { setScenePlan(null); }, [draft?.id]);
  const loadScenePlan = useCallback(async () => {
    if (!draft || !access?.scenePlan) return;
    try { setScenePlan({ ...(await worldsCall("scenePlan", { draftId: draft.id })), draftId: draft.id }); } catch { setScenePlan(null); }
  }, [draft, access]);
  /** the owner changes one scene: { location } from the list, or { typed } (mapped to a library place on the server) */
  const changeScene = useCallback((i, patch) => setScenePlan((p) => (p ? { ...p, scenes: p.scenes.map((sc, k) => (k === i ? { ...sc, ...patch, auto: false } : sc)) } : p)), []);
  const generate = useCallback(async () => {
    if (!draft) return { ok: false };
    if (edited) { const s = await saveEdits(); if (!s.ok) return s; }
    const plan = access?.scenePlan && scenePlan?.draftId === draft.id && !edited ? { scenePlan: { scenes: scenePlan.scenes } } : {};
    const r = await attempt("starting", () => worldsCall("start", { draftId: draft.id, removeWatermark, ...plan, ...(characters.length ? { characters } : {}), ...flatBody() }));
    if (r.ok) { setRun(r.value); setRecent((list) => [r.value, ...list]); setPaidDrafts((list) => list.filter((x) => x.id !== draft.id)); }
    return r;
  }, [attempt, draft, edited, saveEdits, removeWatermark, access, scenePlan, characters]);

  /** "Explain more": the user's long description / full narration, adapted to our rules on the server (adapt.js) */
  const adaptStory = useCallback(async (text) => {
    const r = await attempt("adapting", () => worldsCall("adaptStory", { text, characters, ...flatBody() }));
    if (r.ok) { setDraft(r.value); setEdited(null); setTakes([]); notePaid(r.value); }
    return r;
  }, [attempt, characters, notePaid]);
  /** one character picture -> our kit spec (one cheap vision call); the picture goes to that call only */
  const readCharacter = useCallback((image, role) => worldsCall("characterRef", { image, role }), []);

  const sendEvent = useCallback((kind) => (run ? worldsCall("event", { runId: run.id, kind }).catch(() => {}) : null), [run]);
  const openRun = useCallback((r) => setRun(r), []);
  const startOver = useCallback(() => { setDraft(null); setEdited(null); setPickedId(null); setTakes([]); setRun(null); }, []);

  return {
    access, tab, setTab, mood, setMood, ideas, shownIdeas, askIdeas, topic, setTopic, topicIdeas, askTopic, ownText, setOwnText,
    lengthSec, setLengthSec, draft, lines: edited ?? draft?.lines ?? [], edited: Boolean(edited), editLine, saveEdits,
    busy, pickedId, writeFromIdea, picked, pickIdea, continueStory, takes, tryTake, saveOwn, rewrite, moveToTown, fixOpener, fixPart, removeWatermark, setRemoveWatermark,
    run, recent, generate, retryRun, rewriteAndRetry, sendEvent, openRun, startOver, fixLines, paidDrafts, openDraft,
    scenePlan, loadScenePlan, changeScene,
    characters, setCharacters, adaptStory, readCharacter, setFlat,
  };
}
