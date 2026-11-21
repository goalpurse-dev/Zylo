// THE CUSTOMER GATE (owner 2026-11-21, after a live video was delivered at 21% passing shots): under 70% of the shots
// passing after the fix rounds -> ONE extra fix round for the failing shots -> still under -> refund, never a "best
// version". Free: no network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { customerGate, passShareOf, topReasons, reasonsLine, DELIVER_MIN_PASS, PASS_MIN } from "./renderGate.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const shotsOf = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

test("the bar: 70% to deliver; the 85% 'good' bar stays as it was", () => {
  assert.equal(DELIVER_MIN_PASS, 0.7);
  assert.equal(PASS_MIN, 0.85);
});

test("the decision: 0.69 -> retry; 0.69 after the extra round -> refund; 0.70 -> deliver", () => {
  assert.equal(customerGate({ passShare: 0.69 }), "retry");
  assert.equal(customerGate({ passShare: 0.69, extraRoundDone: false }), "retry");
  assert.equal(customerGate({ passShare: 0.69, extraRoundDone: true }), "refund");
  assert.equal(customerGate({ passShare: 0.7 }), "deliver");
  assert.equal(customerGate({ passShare: 0.7, extraRoundDone: true }), "deliver");
  assert.equal(customerGate({ passShare: 7 / 10 }), "deliver");
  assert.equal(customerGate({ passShare: 35 / 50, extraRoundDone: true }), "deliver");
  assert.equal(customerGate({ passShare: 34 / 50, extraRoundDone: true }), "refund");
  assert.equal(customerGate({ passShare: 0.21, extraRoundDone: true }), "refund", "video 1 (21%) is never delivered again");
  assert.equal(customerGate({ passShare: 0 }), "retry");
  assert.equal(customerGate({ passShare: 1, extraRoundDone: true }), "deliver");
});

test("the share counts ALL the video's shots: a crash, a black frame, an unwatchable and a weak shot fail; unconfirmed / fix-only notes do not", () => {
  const failing = {
    1: { kind: "crash", text: "the shot CRASHED in Blender: NameError: name 'foo' is not defined" },
    2: { kind: "pixel", text: "the frame is black (mean 3)" },
    3: { kind: "vision", text: "the checker saw: A giant bank facade fills the frame" },
    4: { kind: "vision", text: "the checker saw: A big tree blocks most of the view" },
    5: { kind: "shotcheck", text: "THE SHOT CHECK: no character in 2 or more of 6 shots" },
    6: { kind: "vision", text: "the checker saw: CREATURE: Monster named but not readable" },
    7: { kind: "owner", text: "the owner asked for this shot to be fixed" },
  };
  const s = passShareOf({ shots: shotsOf(10), failing });
  assert.equal(s.shots, 10);
  assert.equal(s.pass, 6);
  assert.equal(s.passShare, 0.6);
  assert.deepEqual(s.failing.map((r) => [r.id, r.status]), [[1, "cut"], [2, "cut"], [3, "cut"], [4, "weak"]]);
  // a failing entry for a shot no longer in the plan (merged out) never counts
  assert.equal(passShareOf({ shots: shotsOf(3), failing: { 9: { kind: "crash", text: "x" } } }).passShare, 1);
  assert.equal(passShareOf({ shots: [], failing: {} }).passShare, 0);
  // the live video 1: 11 of 52 passing = 21% -> retry, then refund
  const v1 = Object.fromEntries(shotsOf(52).slice(11).map((s) => [s.id, { kind: "vision", text: `the checker saw: line ${s.id} "x" is not shown literally: its key thing "the bus" must be clearly on screen in this shot` }]));
  const g = passShareOf({ shots: shotsOf(52), failing: v1 });
  assert.equal(Math.round(g.passShare * 100), 21);
  assert.equal(customerGate({ passShare: g.passShare }), "retry");
  assert.equal(customerGate({ passShare: g.passShare, extraRoundDone: true }), "refund");
});

test("the owner's email names the top failing reasons, the biggest group first, with an example shot", () => {
  const failing = {
    1: { kind: "crash", text: "the shot CRASHED in Blender: NameError: boom" },
    2: { kind: "vision", text: "the checker saw: line 2 \"Pip ran\" is not shown literally: its key thing \"Pip\" must be clearly on screen" },
    3: { kind: "vision", text: "the checker saw: line 3 \"the bus came\" is not shown literally: its key thing \"bus\" must be clearly on screen" },
    4: { kind: "vision", text: "the checker saw: Grandpa is not visible; CREATURE: the monster is not readable" },
    5: { kind: "vision", text: "the checker saw: line 5 \"x\" is not shown literally: its key thing \"x\" must be clearly on screen" },
  };
  const top = topReasons(passShareOf({ shots: shotsOf(8), failing }).failing);
  assert.equal(top.length, 3);
  assert.deepEqual(top[0], { reason: "a line's key thing not on screen", count: 3, example: { id: 2, text: "line 2 \"Pip ran\" is not shown literally: its key thing \"Pip\" must be clearly on screen" } });
  assert.deepEqual(top.slice(1).map((t) => [t.reason, t.count]).sort(), [["a named character or thing not visible", 1], ["crashed in Blender", 1]].sort());
  assert.equal(top.find((t) => t.reason === "a named character or thing not visible").example.text, "Grandpa is not visible", "the fix-only CREATURE note is left out");
  assert.match(reasonsLine(top), /^a line's key thing not on screen \(3, e\.g\. shot 2: line 2/);
  assert.deepEqual(topReasons([]), []);
});

test("the pipeline: the customer gate runs after the fix rounds, before any final money; one extra round on the failing shots; QUALITY_GATE + the stop note", () => {
  const p = fs.readFileSync(path.join(HERE, "pipeline.mjs"), "utf8");
  const gate = p.indexOf("3c. THE CUSTOMER GATE"), recheck = p.indexOf("3b. no stale verdicts"), final = p.indexOf("5. the final (parallel)"), fit = p.indexOf("const fit = fitLimits(");
  assert.ok(recheck > 0 && gate > recheck && gate < final && gate < fit, "after the recheck, before the final's limits and jobs");
  const block = p.slice(gate, p.indexOf("4. no holes"));
  assert.match(block, /customerGate\(\{ passShare: share\.passShare, extraRoundDone: state\.extraRound\?\.retries === \(state\.retries \?\? 0\) \}\)/);
  assert.match(block, /const ids = share\.failing\.map\(\(r\) => r\.id\)/, "only the failing shots get the extra round");
  assert.match(block, /await fixRound\(\{ round, ids, tag: .*extra: true \}\)/, "the same fix-round code");
  assert.match(block, /customerGate\(\{ passShare: share\.passShare, extraRoundDone: true \}\)/);
  assert.match(block, /fs\.writeFileSync\(path\.join\(OUT, "stop\.json"\), JSON\.stringify\(\{ code: "QUALITY_GATE"/);
  assert.match(block, /throw Object\.assign\(new Error\(message\), \{ code: "QUALITY_GATE" \}\)/);
  assert.match(block, /if \(verdict === "refund" && FORCE\)/, "only the owner's own test flag renders under the bar");
  // the normal rounds go through the same function
  assert.match(p, /const r = await fixRound\(\{ round, ids, tag: `r\$\{round\}\$\{state\.retries \? `x\$\{state\.retries\}` : ""\}`, heading: `FIX ROUND \$\{round\} of \$\{ROUNDS\}` \}\);/);
  assert.doesNotMatch(p, /rendering the best version, every weak shot logged/);
});
