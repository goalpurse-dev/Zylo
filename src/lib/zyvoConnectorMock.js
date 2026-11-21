// LOCAL DEV ONLY (?mock=1, loaded by zyvoConnector.js only when import.meta.env.DEV): a fake of the connector's
// account routes, so the Connect Claude page, the consent screen and the Studio projects tab can be looked at on
// localhost. Every card here is sample data (the pages show a TEST MODE banner); nothing is called or charged.
// Jobs move on their own (a voice ~8 s, a finish ~7 s) so the animations can be seen. Pictures: the owner's real
// Studio test only (public/media/studio-kit).
//   &empty=1           no projects (the empty state)
//   &done=1            the Bedtime Story card starts finished
//   &credits=0         the balance (default 480): low credits = the paid buttons say "Not enough credits"
//   &free=0            the first finish is used up (Finish my video costs credits)
//   &conn=0            no Claude connection (the Connect tab shows the setup steps)
//   &consent=expired|closed   the consent screen's error states
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ago = (min) => new Date(Date.now() - min * 60_000).toISOString();
const lines = (texts) => texts.map((t) => (Array.isArray(t) ? { text: t[1], speaker: t[0] } : { text: t }));
const params = () => new URLSearchParams(window.location.search);
const VOICE_MS = 8000, FINISH_MS = 7000;

const BEDTIME_FINAL = { seconds: 82.7, video: "/media/studio-kit/bedtime-zyvo.mp4", download: "/media/studio-kit/bedtime-zyvo.mp4", noMusic: "/media/studio-kit/bedtime-zyvo.mp4", poster: "/media/studio-kit/bedtime-zyvo.webp", notes: ["Fitted to the voice: 0.1% faster."] };
const job = (kind, status, extra = {}) => ({ id: `j-${kind}-${Math.random().toString(36).slice(2, 7)}`, kind, status, stage: status === "running" ? kind : null, pct: 0, free: false, credits: 0, refunded: false, error: null, createdAt: new Date().toISOString(), ...extra });

function initial() {
  const done = params().get("done") === "1";
  const credits = Number(params().get("credits"));
  const freeLeft = !done && params().get("free") !== "0";
  return {
    balance: params().has("credits") && Number.isFinite(credits) ? Math.max(0, Math.round(credits)) : 480,
    freeFinish: freeLeft,
    connections: params().get("conn") === "0" ? [] : [
      { id: "f1", client: "Claude", scopes: ["ideas", "scripts", "videos", "spend"], since: ago(60 * 26), lastUsed: ago(12) },
      { id: "f2", client: "Claude Code", scopes: ["ideas", "scripts", "videos", "spend"], since: ago(60 * 24 * 3), lastUsed: ago(60 * 5) },
    ],
    projects: params().get("empty") === "1" ? [] : [
      {
        id: "p-bedtime", kitProjectId: "bedtime-story", title: "The Town's Bedtime Story", status: done ? "finished" : "recorded", updatedAt: ago(4), createdAt: ago(60 * 5), kitVersion: "1.0.0",
        lines: lines([
          "And the Mayor just thanked me for knocking out the whole town.",
          "You see, in this town, when you yawn, everyone around you falls asleep.",
          "Pop, pop, pop. A sleepy purple cloud on every head but yours.",
          "Our bus driver drinks nine coffees before lunch.",
          "The barber yawned once. His queue snored till Tuesday.",
        ]),
        estimatedSeconds: 82, shots: 60,
        voice: { seconds: 82.4, madeAt: ago(60 * 3), mp3: "#", words: "#" }, recording: { bytes: 120_000_000, uploadedAt: ago(4) },
        final: done ? { ...BEDTIME_FINAL, madeAt: ago(2) } : null,
        prices: { voice: 15, finish: 10, finishFree: freeLeft }, job: null, busy: false,
      },
      {
        id: "p-shadow", kitProjectId: "shadow-talk", title: "In this town, your shadow tells everyone how you feel", status: "voice_needed", updatedAt: ago(3), createdAt: ago(90), kitVersion: "1.0.0",
        lines: lines(["In this town, your shadow says out loud how you feel.", "Mine just told the whole class I like Mia.", "So I did the only thing I could. I stood in the dark."]),
        estimatedSeconds: 61, shots: 14, voice: null, recording: null, final: null,
        prices: { voice: 11, finish: 21, finishFree: freeLeft }, job: job("voice", "running", { stage: "voice", pct: 35, credits: 11, startedAt: Date.now() - 2500 }), busy: true,
      },
      {
        id: "p-rain", kitProjectId: "dream-rain", title: "In this town, it rains whatever you dreamed", status: "voice_needed", updatedAt: ago(8), createdAt: ago(40), kitVersion: "1.0.0",
        lines: lines(["In this town, it rains whatever you dreamed last night.", "Mostly socks. Sometimes pancakes.", "But last night, I dreamed about my sister's goldfish.", ["Mom", "Everybody, umbrellas up."]]),
        estimatedSeconds: 74, shots: 18, voice: null, recording: null, final: null,
        prices: { voice: 13, finish: 23, finishFree: freeLeft }, job: null, busy: false,
      },
      {
        id: "p-tower", kitProjectId: "coin-tower", title: "In this town, the higher you live, the richer you are", status: "voice_ready", updatedAt: ago(60 * 3), createdAt: ago(60 * 20), kitVersion: "1.0.0",
        lines: lines(["Every time a kid rides the lift up, a warm coin falls from the sky.", "You see, in this town, the higher you live, the richer you are.", "My little brother lives on the ground floor.", "So I built him a tower of our own."]),
        estimatedSeconds: 88, shots: 22, voice: { seconds: 87.4, madeAt: ago(60 * 3), mp3: "#", words: "#" }, recording: null, final: null,
        prices: { voice: 16, finish: 10, finishFree: freeLeft }, job: null, busy: false,
      },
    ],
  };
}
let state = null;

/** jobs move with time: running -> done (the voice makes the project voice_ready, a finish makes it finished) */
function advance() {
  for (const p of state.projects) {
    const j = p.job;
    if (!j || (j.status !== "queued" && j.status !== "running")) continue;
    const span = j.kind === "voice" ? VOICE_MS : FINISH_MS;
    const t = Date.now() - (j.startedAt ?? Date.now());
    j.status = "running";
    j.stage = j.kind === "voice" ? "voice" : ["upright", "fit_to_voice", "captions", "sound", "mix"][Math.min(4, Math.floor((t / span) * 5))];
    j.pct = Math.min(99, Math.round((t / span) * 100));
    if (t >= span) {
      j.status = "done"; j.pct = 100; j.stage = "done"; p.busy = false;
      if (j.kind === "voice") { p.voice = { seconds: p.estimatedSeconds, madeAt: new Date().toISOString(), mp3: "#", words: "#" }; p.status = "voice_ready"; p.prices.finish = 10; }
      else { p.final = { ...BEDTIME_FINAL, madeAt: new Date().toISOString() }; p.status = "finished"; }
      p.updatedAt = new Date().toISOString();
    }
  }
}

const fail = (code, message, extra = {}) => { throw Object.assign(new Error(message), { code, ...extra }); };

export async function mockConnector(path, { body = {}, query = {} } = {}) {
  if (!state) state = initial();
  await sleep(220);
  const q = params();
  if (path === "/authorize/request") {
    if (q.get("consent") === "expired") fail("expired", "This sign-in link expired. Go back to Claude and connect again.");
    return { client: q.get("client") ?? "Claude", redirectHost: "claude.ai", scopes: ["ideas", "scripts", "videos", "spend"], expiresAt: new Date(Date.now() + 600_000).toISOString(), allowed: q.get("consent") !== "closed", email: "you@example.com" };
  }
  if (path === "/authorize/decision") return { redirect: "/workspace/mcp/connect?mock=1&connected=1" };
  if (path === "/account/connections") return { connections: state.connections };
  if (path === "/account/connections/revoke") { state.connections = state.connections.filter((c) => c.id !== body.id); return { ok: true }; }
  if (path === "/account/studio") {
    if (query.peek) return { open: true };
    advance();
    return JSON.parse(JSON.stringify({ open: true, balance: state.balance, freeFinish: state.freeFinish, projects: state.projects }));
  }
  const p = state.projects.find((x) => x.id === body.id);
  if (path === "/account/studio/voice") {
    if (body.credits !== p.prices.voice) fail("PRICE_CHANGED", `The price is now ${p.prices.voice} credits. Press the button again to pay that.`);
    if (state.balance < p.prices.voice) fail("CREDITS", `You need ${p.prices.voice} credits. Nothing was charged.`, { credits: p.prices.voice, balance: state.balance });
    state.balance -= p.prices.voice;
    p.job = job("voice", "queued", { credits: p.prices.voice, startedAt: Date.now() });
    p.busy = true;
    return { ok: true, job: p.job };
  }
  if (path === "/account/studio/upload") return { url: "mock://upload", method: "PUT", contentType: "video/mp4", maxBytes: 500 * 1024 * 1024 };
  if (path === "/account/studio/uploaded") { p.recording = { bytes: 180_000_000, uploadedAt: new Date().toISOString() }; p.status = "recorded"; return { ok: true }; }
  if (path === "/account/studio/finish") {
    const free = p.prices.finishFree;
    if (!free && state.balance < p.prices.finish) fail("CREDITS", `You need ${p.prices.finish} credits. Nothing was charged.`, { credits: p.prices.finish, balance: state.balance });
    if (!free) state.balance -= p.prices.finish;
    state.freeFinish = false;
    for (const x of state.projects) x.prices.finishFree = false;
    p.job = job("finish", "queued", { free, credits: free ? 0 : p.prices.finish, startedAt: Date.now() });
    p.busy = true;
    return { ok: true, job: p.job };
  }
  if (path === "/account/studio/remove") { state.projects = state.projects.filter((x) => x.id !== body.id); return { ok: true }; }
  if (path === "/account/kit") return { url: "#mock-kit-download", version: "1.4.0", fileName: "zyvo-roblox-story.zip" };
  return fail("not_found", "Unknown mock route.");
}
