import { useCallback, useEffect, useRef, useState } from "react";
import { isWorking, worldsCall } from "../api/blockyWorldsApi";

const EMPTY_IDEAS = { status: "idle", items: [], error: null, fromLibrary: false };
const POLL_MS = 4000;

/**
 * The Blocky Worlds flow: idea -> script -> settings -> generate -> result (docs/blocky-worlds-protocol.md).
 * Every call goes through blocky-worlds-api (worldsCall); a refusal comes back as { error } with the contract's code,
 * and the studio maps it (sign up, upgrade, add credits, or a calm notice). Nothing is charged before Generate.
 */
export default function useBlockyWorlds({ enabled = true } = {}) {
  const [access, setAccess] = useState(null);
  const [tab, setTab] = useState("idea"); // "idea" | "topic" | "own"
  const [mood, setMood] = useState(null);
  const [ideas, setIdeas] = useState(EMPTY_IDEAS);
  const [topic, setTopic] = useState("");
  const [topicIdeas, setTopicIdeas] = useState(EMPTY_IDEAS);
  const [ownText, setOwnText] = useState("");
  const [lengthSec, setLengthSec] = useState(90);
  const [draft, setDraft] = useState(null);
  const [edited, setEdited] = useState(null); // the user's unsaved line edits (null = none)
  const [busy, setBusy] = useState(null); // "writing" | "rewriting" | "saving" | "fixing" | "starting" | null
  const [pickedId, setPickedId] = useState(null);
  const [run, setRun] = useState(null);
  const [recent, setRecent] = useState([]);
  const [removeWatermark, setRemoveWatermark] = useState(false);
  const poll = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    worldsCall("access").then((a) => { setAccess(a); setLengthSec(a.defaultLength ?? 90); }).catch(() => setAccess({ visible: false }));
  }, [enabled]);
  useEffect(() => {
    if (!access?.signedIn) return;
    worldsCall("list").then((r) => setRecent(r.runs ?? [])).catch(() => {});
  }, [access?.signedIn]);

  // a run being made is polled until it's done or failed
  useEffect(() => {
    clearTimeout(poll.current);
    if (!run || !isWorking(run)) return undefined;
    poll.current = setTimeout(async () => {
      try { const next = await worldsCall("status", { runId: run.id }); setRun(next); setRecent((list) => [next, ...list.filter((r) => r.id !== next.id)]); } catch { /* the next tick tries again */ }
    }, POLL_MS);
    return () => clearTimeout(poll.current);
  }, [run]);

  const attempt = useCallback(async (label, fn) => {
    setBusy(label);
    try { return { ok: true, value: await fn() }; } catch (error) { return { ok: false, error }; } finally { setBusy(null); }
  }, []);

  const askIdeas = useCallback(async ({ more = false } = {}) => {
    setIdeas((s) => ({ ...s, status: "loading", error: null }));
    try { const r = await worldsCall("ideas", { mood, more }); setIdeas({ status: "ready", items: r.ideas, error: null, fromLibrary: Boolean(r.fromLibrary) }); return { ok: true }; }
    catch (error) { setIdeas((s) => ({ ...s, status: "error", error: error.message })); return { ok: false, error }; }
  }, [mood]);

  const askTopic = useCallback(async () => {
    setTopicIdeas((s) => ({ ...s, status: "loading", error: null }));
    try { const r = await worldsCall("topicIdeas", { topic, mood }); setTopicIdeas({ status: "ready", items: r.ideas, error: null, fromLibrary: false }); return { ok: true }; }
    catch (error) { setTopicIdeas((s) => ({ ...s, status: "error", error: error.message })); return { ok: false, error }; }
  }, [topic, mood]);

  const writeFromIdea = useCallback(async (ideaId) => {
    setPickedId(ideaId);
    const r = await attempt("writing", () => worldsCall("writeScript", { ideaId, lengthSec }));
    if (r.ok) { setDraft(r.value); setEdited(null); }
    return r;
  }, [attempt, lengthSec]);

  const saveOwn = useCallback(async () => {
    const r = await attempt("saving", () => worldsCall("saveScript", { text: ownText, lengthSec }));
    if (r.ok) { setDraft(r.value); setEdited(null); }
    return r;
  }, [attempt, ownText, lengthSec]);

  const editLine = useCallback((index, text) => {
    setEdited((prev) => { const lines = (prev ?? draft?.lines ?? []).map((l) => ({ ...l })); lines[index] = { ...lines[index], text }; return lines; });
  }, [draft]);
  const saveEdits = useCallback(async () => {
    if (!draft || !edited) return { ok: true };
    const r = await attempt("saving", () => worldsCall("saveScript", { draftId: draft.id, lines: edited, lengthSec: draft.lengthSec, title: draft.title }));
    if (r.ok) { setDraft(r.value); setEdited(null); }
    return r;
  }, [attempt, draft, edited]);

  const rewrite = useCallback(async (note = "") => {
    if (!draft) return { ok: false };
    const r = await attempt("rewriting", () => worldsCall("rewrite", { draftId: draft.id, note, lengthSec }));
    if (r.ok) { setDraft(r.value); setEdited(null); }
    return r;
  }, [attempt, draft, lengthSec]);

  const fixOpener = useCallback(async () => {
    if (!draft) return { ok: false };
    const r = await attempt("fixing", () => worldsCall("fixOpener", { draftId: draft.id }));
    if (r.ok) setDraft(r.value);
    return r;
  }, [attempt, draft]);

  const generate = useCallback(async () => {
    if (!draft) return { ok: false };
    if (edited) { const s = await saveEdits(); if (!s.ok) return s; }
    const r = await attempt("starting", () => worldsCall("start", { draftId: draft.id, removeWatermark }));
    if (r.ok) { setRun(r.value); setRecent((list) => [r.value, ...list]); }
    return r;
  }, [attempt, draft, edited, saveEdits, removeWatermark]);

  const sendEvent = useCallback((kind) => (run ? worldsCall("event", { runId: run.id, kind }).catch(() => {}) : null), [run]);
  const openRun = useCallback((r) => setRun(r), []);
  const startOver = useCallback(() => { setDraft(null); setEdited(null); setPickedId(null); setRun(null); }, []);

  return {
    access, tab, setTab, mood, setMood, ideas, askIdeas, topic, setTopic, topicIdeas, askTopic, ownText, setOwnText,
    lengthSec, setLengthSec, draft, lines: edited ?? draft?.lines ?? [], edited: Boolean(edited), editLine, saveEdits,
    busy, pickedId, writeFromIdea, saveOwn, rewrite, fixOpener, removeWatermark, setRemoveWatermark,
    run, recent, generate, sendEvent, openRun, startOver,
  };
}
