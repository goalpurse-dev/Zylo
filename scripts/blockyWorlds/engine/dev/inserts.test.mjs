// INSERT KIT (INSERTS agent, 2026-11-10): the designed hero-insert props (lib/insertKit.js + page/kit/inserts.js), the
// planner's choice (lib/shotGrammar.js designedPass), the music box mapping (#3), the sea camera (page/cameraEpic.js
// giantFillView). Free: no render, no Chrome (a no-op 2D canvas stands in for the page's canvases).
//   node --test dev/inserts.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

// a no-op canvas for the kit's canvas textures (the page draws them for real)
const PROPS = new Set(["fillStyle", "strokeStyle", "font", "textAlign", "textBaseline", "lineWidth", "lineCap", "lineJoin", "shadowColor", "shadowBlur", "globalAlpha"]);
const ctx2d = new Proxy({ measureText: (s) => ({ width: String(s).length * 40 }) }, { get: (o, k) => (k in o ? o[k] : PROPS.has(k) ? "" : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };

const { INSERT_THINGS, INSERT_NAMES, designedInsertFor, clockTime, countdownOf, countdownText, insertText } = await import("../lib/insertKit.js");
const { INSERT_BUILD } = await import("../page/kit/inserts.js");
const { OBJECT_CATALOG, heldKind } = await import("../lib/visuals.js");
const { kitFor } = await import("../lib/critical.js");
const { nodeKit } = await import("../lib/director/match.js");
const { shotGrammarPass, GRAMMAR, classOf } = await import("../lib/shotGrammar.js");
const { giantFillView } = await import("../page/cameraEpic.js");

const OPTS = { text: "7:00", secs: 11, look: { top: "#e8443a", hairColor: "#222222" } };

test("insert kit: every designed prop is in the catalog and builds in every state (framing data, deterministic anim)", () => {
  for (const name of INSERT_NAMES) {
    assert.ok(OBJECT_CATALOG[name], `${name} in OBJECT_CATALOG`);
    assert.equal(typeof INSERT_BUILD[name], "function", `${name} builder`);
    for (const state of INSERT_THINGS[name].states) {
      const g = new THREE.Group(); g.userData = {};
      INSERT_BUILD[name](g, state, { ...OPTS, text: name.includes("clock") || name === "digital_watch" ? "7:00" : "KEEP OUT" });
      const u = g.userData;
      for (const k of ["height", "width", "fitW", "fitH", "fitY"]) assert.ok(Number.isFinite(u[k]) && u[k] > 0, `${name}/${state} ${k}`);
      assert.ok(u.designed, `${name} is marked designed`);
      const box = new THREE.Box3().setFromObject(g);
      assert.ok(!box.isEmpty() && box.max.y > u.fitY, `${name}/${state}: geometry above its face centre`);
      // the frame of the hero insert ("wide" object framing at designedFit) stays inside the backdrop / the object
      const frameW = u.fitW / GRAMMAR.designedFit;
      if (name !== "music_box" && name !== "sign_board") assert.ok(box.max.x - box.min.x >= frameW * 1.4, `${name}: the backdrop is wider than the frame (${(box.max.x - box.min.x).toFixed(2)} vs ${frameW.toFixed(2)})`);
      if (u.anim) { u.anim(0); u.anim(1.37); u.anim(5.2); }
    }
  }
});

test("music box: lid open + the dancer turning while it plays; closed: shut and still", () => {
  const play = new THREE.Group(); play.userData = {}; INSERT_BUILD.music_box(play, "play");
  const shut = new THREE.Group(); shut.userData = {}; INSERT_BUILD.music_box(shut, "closed");
  const h = (g) => new THREE.Box3().setFromObject(g).max.y;
  assert.ok(h(play) > h(shut) + 0.2, `the open lid stands up (${h(play).toFixed(2)} vs ${h(shut).toFixed(2)})`);
  const rotY = (g) => { let r = []; g.traverse((o) => { if (o.isGroup && o.rotation.y) r.push(o.rotation.y); }); return r; };
  play.userData.anim(0.5); const a = rotY(play); play.userData.anim(1.5); const b = rotY(play);
  assert.notDeepEqual(a, b, "the dancer turns");
  play.userData.anim(1.5); assert.deepEqual(rotY(play), b, "deterministic in t");
  // #3: "tin wind-up music box" is the music box (scene object + hand prop), never the crate
  assert.deepEqual(kitFor("tin wind-up music box"), { kind: "object", name: "music_box" });
  assert.equal(nodeKit().heldFor("tin wind-up music box").name, "music_box");
  assert.equal(nodeKit().objectFor("tin wind-up music box").name, "music_box");
  assert.equal(heldKind("music box"), "music_box");
  assert.equal(nodeKit().heldFor("shoe box").name, "box"); // a box is still a box
});

test("line parsing: times, countdowns, screen / sign words", () => {
  assert.equal(clockTime("At seven o'clock the bell rang."), "7:00");
  assert.equal(clockTime("It was 19:45 already"), "7:45");
  assert.equal(clockTime("by midnight"), "12:00");
  assert.equal(clockTime("half past six"), "6:30");
  assert.equal(clockTime("The wolf howled."), null);
  assert.equal(countdownOf("Only ten seconds left!").secs, 10);
  assert.equal(countdownOf("One day remaining.").unit, "day");
  assert.equal(countdownOf("We had 24 hours to fix it.").secs, 86400);
  assert.equal(countdownText(86400 - 13, 0), "23:59:47");
  assert.equal(countdownText(11, 0), "00:11");
  assert.equal(countdownText(11, 8.6), "00:03");
  assert.equal(countdownText(3, 9), "00:00");
  assert.equal(insertText('The sign said "NO HOWLING".'), "NO HOWLING");
  assert.equal(insertText("The screen flashed GAME OVER."), "GAME OVER");
  const pick = (s) => designedInsertFor(s, { cast: { me: { name: "Pip", look: {} } } })?.name ?? null;
  assert.equal(pick("At seven o'clock the bell rang."), "wall_clock");
  assert.equal(pick("My alarm clock rang at 6:45."), "alarm_clock");
  assert.equal(pick("Only ten seconds left!"), "countdown_screen");
  assert.equal(pick("I checked my watch: 23:59 left"), "digital_watch");
  assert.equal(pick("One day remaining."), "countdown_screen");
  assert.equal(pick("The screen flashed GAME OVER."), "neon_screen");
  assert.equal(pick("Wanted posters of Pip covered every wall."), "wanted_poster");
  assert.equal(pick('A notice on the board said "NO HOWLING".'), "notice_board");
  assert.equal(pick('The stone was carved with the words "TURN BACK".'), "sign_board");
  // no insert for plain lines, a watched turtle, a signed card, a sign with no words
  for (const s of ["I watched the turtle.", "Everyone signed the card.", "Old Tobin was right all along.", "We passed a sign."]) assert.equal(pick(s), null, s);
});

const A = (id, extra = {}) => ({ id, spot: "center", pose: "stand", expr: "happy", facing: "camera", hold: null, ...extra });
test("planner: a line that names a time gets the designed clock (wide object framing, ~full frame push, its time)", () => {
  const texts = ["We woke up early.", "At seven o'clock the bell rang.", "Then we ran.", "Only ten seconds left!", "We made it."];
  const tl = {
    cast: { me: { name: "Pip", role: "kid" } },
    lines: texts.map((text, i) => ({ text, part: "tour", start: i * 2, end: i * 2 + 2 })),
    captions: texts.flatMap((t, i) => t.split(" ").map((w, k) => ({ word: w.replace(/[^A-Za-z']/g, ""), start: i * 2 + k * 0.3, end: i * 2 + k * 0.3 + 0.25 }))),
    shots: texts.map((text, i) => ({ start: i * 2, end: i * 2 + 2, line: i, lines: [i], part: "tour", set: "street", light: "day", camera: i % 2 ? "medium" : "wide", focus: "me", actors: [A("me")], insert: null, marker: null, seed: i, text, subject: "me" })),
  };
  const r = shotGrammarPass(tl, {});
  const des = tl.shots.filter((s) => s.hero?.designed);
  assert.ok(des.length >= 2, JSON.stringify(r.inserts));
  const clock = des.find((s) => s.objects[0].name === "wall_clock");
  assert.ok(clock, "the wall clock insert");
  assert.equal(clock.objects[0].text, "7:00");
  assert.equal(clock.camera, "wide");
  assert.equal(clock.camMove.fit, GRAMMAR.designedFit);
  assert.equal(classOf(clock), "insert");
  const timer = des.find((s) => s.objects[0].name === "countdown_screen");
  assert.ok(timer && timer.objects[0].secs === 10, "the countdown from the line");
  // the line keeps a shot of its people
  assert.ok(tl.shots.some((s) => (s.lines ?? [s.line]).includes(1) && !s.hero));
});

test("sea camera: the giant fills the narrow frame (not a speck), low, aimed at its middle", () => {
  const box = new THREE.Box3(new THREE.Vector3(-60, -10, -30), new THREE.Vector3(60, 45, 30)); // a 120 m turtle + town, half sunk
  const v = giantFillView({ THREE, box, dir: new THREE.Vector3(0, 0, 1), aspect: 9 / 16 });
  const cam = new THREE.PerspectiveCamera(v.fov, 9 / 16, 1, 10000); cam.position.copy(v.pos); cam.lookAt(v.aim); cam.updateMatrixWorld();
  const xs = [], ys = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) { const p = new THREE.Vector3(x, y, z).project(cam); xs.push(p.x); ys.push(p.y); }
  const wShare = (Math.max(...xs) - Math.min(...xs)) / 2;
  assert.ok(wShare > 0.7 && wShare < 1.25, `width share ${wShare.toFixed(2)}`);
  assert.ok(v.pos.y < box.min.y + (box.max.y - box.min.y) * 0.5, "a low camera (the creature against the sky)");
  assert.ok(Math.abs(v.aim.y - (box.min.y + box.max.y) / 2) < 1e-6);
});
