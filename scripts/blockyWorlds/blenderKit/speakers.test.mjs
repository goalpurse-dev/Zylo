// node --test scripts/blockyWorlds/blenderKit/speakers.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { captionColors, PALETTE } from "./speakers.mjs";

const wordsOf = (script) => script.lines.flatMap((l) => l.text.trim().split(/\s+/)).map((w, i) => ({ word: w, start: i, end: i + 0.5 }));

test("narrator white, a quoted line coloured only inside the quotes, a whole-line speaker, fixed colours", () => {
  const script = {
    speakers: { Ott: "#7fe3ff" },
    lines: [
      { text: "In this town, we live in a plane." },
      { text: 'He said, "Kites always fly home."', speaker: "Ott" },
      { text: "Mo, buckle up now!", speaker: "Pell" },
      { text: "I tied the string.", speaker: "narrator" },
    ],
  };
  const { colors, legend, exact } = captionColors(script, wordsOf(script));
  assert.equal(exact, true);
  assert.deepEqual(colors.slice(0, 8), Array(8).fill(null));
  assert.deepEqual(colors.slice(8, 10), [null, null]);              // He said,
  assert.deepEqual(colors.slice(10, 14), Array(4).fill("#7FE3FF"));  // "Kites always fly home."
  assert.deepEqual(colors.slice(14, 18), Array(4).fill(PALETTE[0])); // Pell, no quotes: the whole line
  assert.deepEqual(colors.slice(18), Array(4).fill(null));           // narrator
  assert.deepEqual(legend, { Ott: "#7FE3FF", Pell: PALETTE[0] });
});

test("curly quotes and a one-word quote", () => {
  const script = { lines: [{ text: "She whispered “Run.” and left.", speaker: "Pip" }] };
  const { colors } = captionColors(script, wordsOf(script));
  assert.deepEqual(colors, [null, null, PALETTE[0], null, null]);
});

test("an exchange inside one line: line.quotes gives each quoted part its speaker", () => {
  const script = {
    speakers: { Grandpa: "#FFB04D", Milo: "#7FE3FF" },
    lines: [{ text: 'Too late. "What\'s taller than a skyscraper?" "...What?" "You. In five seconds."', speaker: "Grandpa", quotes: ["Grandpa", "Milo", "Grandpa"] }],
  };
  const { colors, legend } = captionColors(script, wordsOf(script));
  const G = "#FFB04D", M = "#7FE3FF";
  assert.deepEqual(colors, [null, null, G, G, G, G, G, M, G, G, G, G]);
  assert.deepEqual(legend, { Grandpa: G, Milo: M });
});

test("words that do not match the lines: every caption white", () => {
  const script = { lines: [{ text: "One two three", speaker: "Ott" }] };
  const { colors, exact } = captionColors(script, [{ word: "one" }, { word: "two" }]);
  assert.equal(exact, false);
  assert.deepEqual(colors, [null, null]);
});
