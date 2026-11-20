// LOCAL DEV ONLY (?mock=1, loaded by zyvoConnector.js only when import.meta.env.DEV): a fake of the connector's
// account routes, so the Connect Claude page, the consent screen and the Studio projects tab can be looked at on
// localhost. Every card here is sample data (the pages show a TEST MODE banner); nothing is called or charged.
// ?consent=expired|closed shows the consent screen's error states.
import { TOWN_STORIES } from "../data/inThisTownLanding.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ago = (min) => new Date(Date.now() - min * 60_000).toISOString();
const lines = (texts) => texts.map((t) => (Array.isArray(t) ? { text: t[1], speaker: t[0] } : { text: t }));
const milo = TOWN_STORIES.find((s) => s.id === "milo") ?? TOWN_STORIES[0];
const tower = TOWN_STORIES.find((s) => s.id === "tower") ?? TOWN_STORIES[0];

const state = {
  balance: 480,
  freeFinish: true,
  connections: [
    { id: "f1", client: "Claude", scopes: ["ideas", "scripts", "videos", "spend"], since: ago(60 * 26), lastUsed: ago(12) },
    { id: "f2", client: "Claude Code", scopes: ["ideas", "scripts", "videos", "spend"], since: ago(60 * 24 * 3), lastUsed: ago(60 * 5) },
  ],
  projects: [
    {
      id: "p-bedtime", kitProjectId: "bedtime-story", title: "In this town, bedtime is decided by the moon", status: "voice_needed", updatedAt: ago(8), createdAt: ago(40), kitVersion: "1.0.0",
      lines: lines([
        "In this town, the moon decides when you go to bed.",
        "When it turns orange, every kid has ten seconds to get home.",
        "I'm Lena, and I have never once made it in time.",
        "But tonight, the moon turned orange at lunch.",
        ["Grandpa", "Nobody panic. Everybody run."],
      ]),
      estimatedSeconds: 74, shots: 18, voice: null, recording: null, final: null,
      prices: { voice: 13, finish: 23, finishFree: true }, job: null, busy: false,
    },
    {
      id: "p-shadow", kitProjectId: "shadow-talk", title: "In this town, your shadow tells everyone how you feel", status: "voice_needed", updatedAt: ago(3), createdAt: ago(90), kitVersion: "1.0.0",
      lines: lines(["In this town, your shadow says out loud how you feel.", "Mine just told the whole class I like Mia.", "So I did the only thing I could. I stood in the dark."]),
      estimatedSeconds: 61, shots: 14, voice: null, recording: null, final: null,
      prices: { voice: 11, finish: 21, finishFree: true },
      job: { id: "j1", kind: "voice", status: "running", stage: "voice", pct: 40, free: false, credits: 11, refunded: false, error: null, createdAt: ago(1) }, busy: true,
    },
    {
      id: "p-tower", kitProjectId: "coin-tower", title: tower.title, status: "voice_ready", updatedAt: ago(60 * 3), createdAt: ago(60 * 20), kitVersion: "1.0.0",
      lines: lines([tower.hook, tower.rule, "My little brother lives on the ground floor.", "So I built him a tower of our own."]),
      estimatedSeconds: 88, shots: 22, voice: { seconds: 87.4, madeAt: ago(60 * 3), mp3: "/media/sample-voice.mp3", words: "#" }, recording: null, final: null,
      prices: { voice: 16, finish: 10, finishFree: true }, job: null, busy: false,
    },
    {
      id: "p-milo", kitProjectId: "ticklish-milo", title: milo.title, status: "finished", updatedAt: ago(60 * 24), createdAt: ago(60 * 48), kitVersion: "1.0.0",
      lines: lines([milo.hook, milo.rule, "And Grandpa tells the worst jokes in the world."]),
      estimatedSeconds: 96, shots: 26, voice: { seconds: 95.6, madeAt: ago(60 * 30), mp3: "/media/sample-voice.mp3", words: "#" }, recording: { bytes: 212_000_000, uploadedAt: ago(60 * 25) },
      final: { seconds: 95.6, madeAt: ago(60 * 24), video: milo.video, download: milo.video, noMusic: milo.video, poster: milo.poster, notes: ["Sped up 3% to fit the voice."] },
      prices: { voice: 17, finish: 10, finishFree: true }, job: { id: "j2", kind: "finish", status: "done", stage: "done", pct: 100, free: true, credits: 0, refunded: false, error: null, createdAt: ago(60 * 24) }, busy: false,
    },
  ],
};

const fail = (code, message, extra = {}) => { throw Object.assign(new Error(message), { code, ...extra }); };

export async function mockConnector(path, { body = {}, query = {} } = {}) {
  await sleep(250);
  const params = new URLSearchParams(window.location.search);
  if (path === "/authorize/request") {
    if (params.get("consent") === "expired") fail("expired", "This sign-in link expired. Go back to Claude and connect again.");
    return { client: params.get("client") ?? "Claude", redirectHost: "claude.ai", scopes: ["ideas", "scripts", "videos", "spend"], expiresAt: new Date(Date.now() + 600_000).toISOString(), allowed: params.get("consent") !== "closed", email: "you@example.com" };
  }
  if (path === "/authorize/decision") return { redirect: "/connect-claude?mock=1&connected=1" };
  if (path === "/account/connections") return { connections: state.connections };
  if (path === "/account/connections/revoke") { state.connections = state.connections.filter((c) => c.id !== body.id); return { ok: true }; }
  if (path === "/account/studio") return query.peek ? { open: true } : { open: true, balance: state.balance, freeFinish: state.freeFinish, projects: state.projects };
  const p = state.projects.find((x) => x.id === body.id);
  if (path === "/account/studio/voice") {
    if (body.credits !== p.prices.voice) fail("PRICE_CHANGED", `The price is now ${p.prices.voice} credits. Press the button again to pay that.`);
    state.balance -= p.prices.voice;
    p.job = { id: `j${Date.now()}`, kind: "voice", status: "queued", stage: null, pct: 0, free: false, credits: p.prices.voice, refunded: false, error: null, createdAt: new Date().toISOString() };
    p.busy = true;
    return { ok: true, job: p.job };
  }
  if (path === "/account/studio/upload") return { url: "mock://upload", method: "PUT", contentType: "video/mp4", maxBytes: 500 * 1024 * 1024 };
  if (path === "/account/studio/uploaded") { p.recording = { bytes: 180_000_000, uploadedAt: new Date().toISOString() }; p.status = "recorded"; return { ok: true }; }
  if (path === "/account/studio/finish") {
    const free = p.prices.finishFree;
    if (!free) state.balance -= p.prices.finish;
    state.freeFinish = false;
    for (const x of state.projects) x.prices.finishFree = false;
    p.job = { id: `j${Date.now()}`, kind: "finish", status: "queued", stage: null, pct: 0, free, credits: free ? 0 : p.prices.finish, refunded: false, error: null, createdAt: new Date().toISOString() };
    p.busy = true;
    return { ok: true, job: p.job };
  }
  if (path === "/account/studio/remove") { state.projects = state.projects.filter((x) => x.id !== body.id); return { ok: true }; }
  if (path === "/account/kit") return { url: "#mock-kit-download", version: "1.0.0", fileName: "zyvo-studio-kit.zip" };
  return fail("not_found", "Unknown mock route.");
}
