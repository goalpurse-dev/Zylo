// Blocky Worlds INSERT KIT (INSERTS agent, 2026-11-10; owner: "bold designed props and screens like the reference: big
// clock faces, neon screens with text, signs" + "build the music box"). Pure, Node + browser.
// The reference's inserts are REAL in-world objects framed full-frame with a slow push in: a wall clock at 7:00, a
// digital watch counting 23:59:47, a "ONE DAY REMAINING" screen, a countdown 00:11 -> 00:03, WANTED posters, carved
// text. page/kit/inserts.js builds them; lib/shotGrammar.js picks them when a line names a time / countdown / sign /
// poster / screen / notice (designedInsertFor), and a story's music box is the music_box object.
//
//   INSERT_THINGS[name] = { aliases, place, states, state, insert: true, backdrop?, icon }   (merged into catalogObjects)
//   designedInsertFor(text, { cast }) -> { name, state, text?, look?, why } | null      the insert a line asks for
//   clockTime(text) -> "H:MM" | null      countdownOf(text) -> { secs, unit, words } | null
//   countdownText(secs, t, { style }) -> "HH:MM:SS" / "MM:SS" at shot time t (whole seconds, never below 0)
//   insertText(text) -> the short text a line says a screen / sign reads (quoted, ALL CAPS, after "read" / "said") | null

const A = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);

/**
 * The designed props. Aliases stay narrow on purpose (the planner's noun matching must not swap a story's "clock tower"
 * or a held "sign" for a wall insert): only the music box is reached by its name; the rest are chosen by
 * designedInsertFor from the line.
 */
export const INSERT_THINGS = Object.freeze({
  wall_clock: { aliases: [], place: "floor", states: ["on"], state: "on", insert: true, icon: "🕰️" },
  alarm_clock: { aliases: [], place: "floor", states: ["on", "ring"], state: "on", insert: true, icon: "⏰" },
  digital_watch: { aliases: [], place: "floor", states: ["count", "time"], state: "count", insert: true, icon: "⌚" },
  countdown_screen: { aliases: [], place: "floor", states: ["count", "text"], state: "count", insert: true, icon: "⏱️" },
  neon_screen: { aliases: [], place: "floor", states: ["on", "flicker"], state: "on", insert: true, icon: "📺" },
  wanted_poster: { aliases: [], place: "floor", states: ["wanted", "missing"], state: "wanted", insert: true, icon: "🪧" },
  notice_board: { aliases: [], place: "floor", states: ["on"], state: "on", insert: true, icon: "📌" },
  sign_board: { aliases: [], place: "floor", states: ["wood", "stone"], state: "wood", insert: true, icon: "🪧" },
  music_box: { aliases: A("music box,music boxes,musical box,musical boxes,musicbox,wind-up music box,windup music box,jewelry box,jewellery box"), place: "floor", states: ["play", "closed"], state: "play", insert: true, icon: "🎶" },
});
export const INSERT_NAMES = Object.keys(INSERT_THINGS);
export const isDesignedInsert = (name) => Object.prototype.hasOwnProperty.call(INSERT_THINGS, String(name ?? ""));

// ------------------------------------------------------------------------------------------------ numbers + times
const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40,
  fifty: 50, sixty: 60, ninety: 90, hundred: 100 };
const NUMW = Object.keys(NUM).join("|");
const numOf = (w) => { const s = String(w ?? "").toLowerCase(); if (/^\d+$/.test(s)) return Number(s); const p = s.split(/[-\s]+/); let n = 0; for (const x of p) { if (NUM[x] == null) return null; n += NUM[x]; } return n || null; };
const low = (t) => ` ${String(t ?? "").toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ")} `;

/** a clock time the line says ("at 7:30", "seven o'clock", "midnight", "at six in the morning") -> "H:MM" (12 h) */
export function clockTime(text) {
  const t = low(text);
  let m = t.match(/\b(\d{1,2}):(\d{2})\b/);
  if (m && Number(m[1]) <= 23 && Number(m[2]) < 60) return `${((Number(m[1]) + 11) % 12) + 1}:${m[2]}`;
  m = t.match(new RegExp(`\\b(\\d{1,2}|${NUMW})(?:[- ](thirty|fifteen|forty-five|forty five))? o'?clock\\b`));
  if (m) { const h = numOf(m[1]); if (h && h <= 12) return `${h}:${m[2] ? String(numOf(m[2])).padStart(2, "0") : "00"}`; }
  if (/\bmidnight\b/.test(t) || /\bnoon\b|\bmidday\b/.test(t)) return "12:00";
  m = t.match(new RegExp(`\\b(?:at|by|until|till|before|after) (\\d{1,2}|${NUMW})(?:[ ]?(am|pm|a\\.m\\.|p\\.m\\.)| in the (?:morning|evening|afternoon)| at night| sharp)\\b`));
  if (m) { const h = numOf(m[1]); if (h && h <= 12) return `${h}:00`; }
  m = t.match(new RegExp(`\\bhalf past (\\d{1,2}|${NUMW})\\b`)); if (m) { const h = numOf(m[1]); if (h && h <= 12) return `${h}:30`; }
  m = t.match(new RegExp(`\\bquarter (past|to) (\\d{1,2}|${NUMW})\\b`)); if (m) { const h = numOf(m[2]); if (h && h <= 12) return m[1] === "past" ? `${h}:15` : `${((h + 10) % 12) + 1}:45`; }
  return null;
}

const UNIT = { second: 1, seconds: 1, sec: 1, secs: 1, minute: 60, minutes: 60, min: 60, mins: 60, hour: 3600, hours: 3600, day: 86400, days: 86400, week: 604800, weeks: 604800 };
/** a countdown the line names ("ten seconds left", "one day remaining", "24 hours to", "the timer hit 11") */
export function countdownOf(text) {
  const t = low(text);
  const re = new RegExp(`\\b(\\d{1,3}|${NUMW}(?:[- ](?:${NUMW}))?) (seconds?|secs?|minutes?|mins?|hours?|days?|weeks?) (left|remaining|to go|until|till|before|away|later|from now)\\b`);
  let m = t.match(re);
  if (!m) m = t.match(new RegExp(`\\b(?:only|just|in|within) (\\d{1,3}|${NUMW}(?:[- ](?:${NUMW}))?) (seconds?|secs?|minutes?|mins?|hours?|days?|weeks?)\\b`));
  if (!m) m = t.match(new RegExp(`\\b(?:had|have|has|got|get|gets|given|gave us|gave me|gave them|leaves|left us|left me) (?:only |just )?(\\d{1,3}|${NUMW}(?:[- ](?:${NUMW}))?) (seconds?|secs?|minutes?|mins?|hours?|days?|weeks?)\\b`));
  const hm = t.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))? (left|remaining|to go)\b/);
  if (!m && hm) return { secs: hm[3] != null ? Number(hm[1]) * 3600 + Number(hm[2]) * 60 + Number(hm[3]) : Number(hm[1]) * 60 + Number(hm[2]), n: null, unit: "second", words: null };
  if (m) {
    const n = numOf(m[1]); if (!n) return null;
    const unit = m[2].replace(/s$/, "").replace(/^sec$/, "second").replace(/^min$/, "minute");
    return { secs: n * (UNIT[m[2]] ?? 1), n, unit, words: `${m[1]} ${m[2]} ${m[3] && !/^(only|just|in|within)$/.test(m[3]) ? m[3] : "left"}`.toUpperCase().replace(/^A /, "ONE ").replace(/^AN /, "ONE ") };
  }
  m = t.match(/\b(?:countdown|timer|clock) (?:hit|hits|showed|shows|read|reads|said|says|at|on) (\d{1,2}):(\d{2})\b/);
  if (m) return { secs: Number(m[1]) * 60 + Number(m[2]), n: null, unit: "second", words: null };
  if (/\b(countdown|count down|counting down|counted down|timer|stopwatch|ticking down)\b/.test(t)) return { secs: 10, n: 10, unit: "second", words: null };
  return null;
}

/** "HH:MM:SS" (an hour or more) / "MM:SS" at shot time t of a countdown that starts at secs (style "hms" forces hours) */
export function countdownText(secs, t = 0, { style = null } = {}) {
  const left = Math.max(0, Math.floor(Number(secs) || 0) - Math.floor(Math.max(0, t)));
  const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), s = left % 60, p = (x) => String(x).padStart(2, "0");
  return h || style === "hms" ? `${p(Math.min(99, h))}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

/** the short text a line says a screen / sign / notice reads, or null (never the whole sentence) */
export function insertText(text) {
  const s = String(text ?? "").replace(/[’‘]/g, "'");
  let m = s.match(/["“]([^"”]{1,40})["”]/) ?? s.match(/(?:^|\s)'([^']{2,40})'(?=[\s.,!?;:]|$)/);
  if (m) return clean(m[1]);
  m = s.match(/\b([A-Z][A-Z0-9!?'-]+(?:[ :][A-Z0-9!?'-]+){0,4})\b/);
  if (m && m[1].replace(/[^A-Z]/g, "").length >= 3 && m[1] !== "I") return clean(m[1]);
  m = s.match(/\b(?:read|reads|said|says|saying|spelled|spells|flashed|flashes|showed|shows|blinked|blinks|glowed|glows)[:,]?\s+(?!the\b|a\b|an\b|that\b|it\b|nothing\b|something\b)([A-Za-z0-9][^.,;!?]{1,32})/);
  if (m) { const w = m[1].trim().split(/\s+/).slice(0, 4).join(" "); return clean(w); }
  return null;
}
const clean = (x) => String(x).replace(/\s+/g, " ").trim().replace(/[.,;:]+$/, "").toUpperCase().slice(0, 32) || null;

// ------------------------------------------------------------------------------------------------ the choice
const W = (re) => new RegExp(`\\b(?:${re})\\b`);
const RX = {
  watch: W("watch|wristwatch|wrist watch|smartwatch"),
  alarm: W("alarm clock|alarm clocks|alarm|alarms|woke|wake|wakes|waking"),
  clock: W("clock|clocks|o'clock|midnight|noon"),
  screen: W("screen|screens|monitor|monitors|tv|television|display|scoreboard|billboard|neon|neon sign"),
  poster: W("poster|posters|wanted|reward"),
  missing: W("missing poster|missing posters|missing"),
  notice: W("notice|notices|notice board|noticeboard|bulletin|bulletin board|announcement|announcements"),
  carved: W("carved|carving|carvings|engraved|engraving|inscription|inscribed|chiselled|chiseled|etched|stone sign|plaque"),
  sign: W("sign|signs|signpost|road sign|placard"),
};

/**
 * The designed insert a line asks for (or null): a time -> a wall / alarm clock at it, a countdown -> a digital timer
 * (or the watch the line names) ticking down from it, days left -> the "ONE DAY REMAINING" screen, a screen with text ->
 * the neon screen, a wanted / missing poster -> the poster with the named character's blocky portrait, a notice -> the
 * notice board, carved words -> the stone sign, a sign with text -> the wooden sign board.
 *   cast: tl.cast ({ id: { name, look } }) for the poster's portrait
 */
export function designedInsertFor(text, { cast = null } = {}) {
  const t = low(text);
  if (!t.trim()) return null;
  // a sign language / a "sign" of something / a "watch" = look: never an object
  const signWord = RX.sign.test(t) && !/\bsign(s|ed|ing)? (language|to|of)\b|\bsigned\b/.test(t);
  const watchObj = RX.watch.test(t) && !/\b(watch|watched|watching|watches) (the|a|an|as|out|over|me|him|her|them|us|it|from|him|my|his|our|their)\b/.test(t.replace(/\b(my|his|her|our|their|the|a) watch\b/g, "WATCHOBJ"));
  const cd = countdownOf(text);
  if (cd) {
    if (cd.unit === "day" || cd.unit === "week") return { name: "countdown_screen", state: "text", text: cd.words ?? `${cd.n} ${cd.unit.toUpperCase()}S LEFT`, why: "days left" };
    if (watchObj || RX.watch.test(t)) return { name: "digital_watch", state: "count", secs: cd.secs, why: "countdown on a watch" };
    return { name: "countdown_screen", state: "count", secs: cd.secs, why: "countdown" };
  }
  const time = clockTime(text);
  if (time) {
    if (/\b(my|his|her|our|their|the|a) watch\b/.test(t)) return { name: "digital_watch", state: "time", text: time, why: "time on a watch" };
    return { name: RX.alarm.test(t) ? "alarm_clock" : "wall_clock", state: RX.alarm.test(t) && /\b(rang|ring|rings|ringing|went off|buzz|buzzed|beeped)\b/.test(t) ? "ring" : "on", text: time, why: "time" };
  }
  if (RX.alarm.test(t) && /\balarm clock|\balarm (rang|went off|buzzed)/.test(t)) return { name: "alarm_clock", state: "ring", text: "7:00", why: "alarm" };
  const said = insertText(text);
  if (RX.poster.test(t) && /\b(wanted|reward|missing)\b/.test(t) || /\b(posters?)\b/.test(t) && RX.missing.test(t)) {
    const who = castNamed(text, cast);
    return { name: "wanted_poster", state: /\bmissing\b/.test(t) ? "missing" : "wanted", text: who?.name ? String(who.name).toUpperCase() : null, look: who?.look ?? null, who: who?.id ?? null, why: "poster" };
  }
  if (RX.screen.test(t) && said) return { name: "neon_screen", state: /\b(flicker|flickered|flickering|glitch|glitched|buzzing)\b/.test(t) ? "flicker" : "on", text: said, why: "screen text" };
  if (RX.notice.test(t)) return { name: "notice_board", state: "on", text: said ?? "NOTICE", why: "notice" };
  if (RX.carved.test(t) && said) return { name: "sign_board", state: "stone", text: said, why: "carved text" };
  if (signWord && said) return { name: "sign_board", state: /\b(stone|rock)\b/.test(t) ? "stone" : "wood", text: said, why: "sign text" };
  return null;
}

/** the cast member a line names (first name word), else null */
function castNamed(text, cast) {
  const t = low(text);
  for (const [id, c] of Object.entries(cast ?? {})) {
    const n = String(c?.name ?? "").toLowerCase().trim(); if (!n) continue;
    const first = n.split(/\s+/).at(-1);
    if (new RegExp(`\\b${first.replace(/[^a-z0-9]/g, "")}('s)?\\b`).test(t)) return { id, name: c.name, look: c.look ?? null };
  }
  return null;
}
