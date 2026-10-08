// Review page for the avatar-library test (testAvatarModels.mjs) and the proposed list of 52 avatars
// (rosterProposal.mjs): FLUX.2 [klein] 9B against the library's Nano Banana Pro pictures, the reference
// check's verdict on each, one scene made from the Klein pictures, and the list to approve.
//   node scripts/blocky/pageAvatars.mjs <outDir>     writes <outDir>/index.html
import fs from "fs";
import path from "path";
import { renderResultsPage } from "./resultsPage.mjs";
import { ROOT } from "./lib.mjs";
import { ROSTER, avatarPrompt } from "./roster.mjs";
import { FULL_ROSTER, PROPOSED } from "./rosterProposal.mjs";

const [outDir] = process.argv.slice(2);
const dir = path.join(ROOT, "data/blocky-tests/klein");
const r = JSON.parse(fs.readFileSync(path.join(dir, "results.json"), "utf8"));
fs.mkdirSync(outDir, { recursive: true });
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const usd = (n, d = 4) => `$${Number(n).toFixed(d)}`;
const IDS = ["noob", "vex", "lux"];
const yes = (b) => (b ? "yes" : "no");

// What the owner asked to compare: hands, legs, neck, cube head, colours, accessories.
const rubric = (a) => [
  ["Hands", a.hands ? "hands or claws" : "flat block ends"],
  ["Legs", !a.twoLegBlocks ? "not two blocks" : a.hipOrFeet ? "two blocks, with a hip piece or feet" : "two plain blocks"],
  ["Neck", a.neck ? "a neck" : "none"],
  ["Cube head", yes(a.cubeHead)],
  ["Colours", a.headColourRight && a.torsoRight && a.legsRight ? "right" : "off"],
  ["Accessory", a.accessoryRight ? (a.accessoryBlocky ? "right, built from blocks" : "right, not built from blocks") : "missing or wrong"],
  ["Face", a.teethTongueLipsNose ? "teeth, tongue, lips or nose" : a.flatFace ? "flat decal" : "not flat"],
  ["Front view", yes(a.frontView)],
];
const card = (key, title) => {
  const item = r.items[key], check = r.checks[key];
  if (!item?.file) return { title, tone: "warn", note: `No picture came back (${item?.state ?? "not sent"}; ${usd(item?.cost ?? 0)}). Not sent again.` };
  const v = check?.verdict;
  return {
    image: path.join(dir, item.file), title, tone: v?.ok ? "good" : "bad",
    meta: [["Check score", v ? `${v.score} of 100${v.ok ? "" : " (fails)"}` : "the check did not run"], ...(check?.answer ? rubric(check.answer) : []), ...(item.cost != null ? [["Cost", usd(item.cost, 5)], ["Time to make", `${item.seconds} s`]] : [])],
    note: v?.problems?.length ? `The check: ${v.problems.join("; ")}.` : "",
  };
};
const sections = IDS.map((id) => {
  const a = ROSTER.find((x) => x.id === id);
  const picked = r.picked[id];
  return {
    heading: `${a.name}: the library's Pro picture, then the four Klein pictures`,
    text: `${esc(a.name)} should have ${esc(a.look)}; the face: ${esc(a.face)}. ${picked ? `Picked by the check: <b>${esc(picked.replace(`klein-${id}-`, "Klein "))}</b>.` : ""}`,
    cards: [card(`pro-${id}`, "Nano Banana Pro (in the library today; made before the four fixes)"), ...[1, 2, 3, 4].map((k) => card(`klein-${id}-${k}`, `Klein ${k}${picked === `klein-${id}-${k}` ? " · picked" : ""}`))],
  };
});

const klein = Object.values(r.items).filter((x) => x.key.startsWith("klein-"));
const made = klein.filter((x) => x.file);
const kleinChecks = made.map((x) => r.checks[x.key]?.answer).filter(Boolean);
const count = (f) => kleinChecks.filter(f).length;
const spent = [...Object.values(r.items), ...Object.values(r.checks), r.scene ?? {}].reduce((n, x) => n + (Number(x.cost) || 0), 0);

const rosterTable = `<table><thead><tr>${["", "Name", "Role", "Personality", "Main colour", "Torso", "Legs", "Signature accessory", "Voice"].map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${FULL_ROSTER.map((a, i) => `<tr><td>${i + 1}${PROPOSED.includes(a) ? " · new" : ""}</td>${[a.name, a.tag, a.role, a.head, a.torso.replace(/^an? /, ""), a.legs, a.accessory ?? "none", a.voice].map((x, k) => `<td>${k === 0 ? `<b>${esc(x)}</b>` : esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

const html = await renderResultsPage({
  title: "Blocky Avatar Library",
  intro: `Can FLUX.2 [klein] 9B draw the library's reference pictures as well as Nano Banana Pro, at about a hundredth of the price? Noob, Vex and Lux, four Klein pictures each, with the reference prompt and its four fixes (cube head with flat faces, front view, flat mouth with no tongue, blocky hair and accessories). Every picture went through the new reference check, which picks the best of each four. Then one real scene was made with the picked Klein pictures as its references. <b>Short answer: no.</b> Klein gets the colours, the cube head, the front view and the flat face right, but it builds every body like a brick-toy figure: clip hands, a neck piece, a hip piece and feet. That is the one look Blocky must never have, and it carries into the scene.`,
  stats: [
    { value: `${made.length} of ${klein.length}`, label: "Klein pictures came back (2 timed out, $0)" },
    { value: `${count((a) => a.hands)} of ${kleinChecks.length}`, label: "with hands or claws", tone: "bad" },
    { value: `${count((a) => a.neck)} of ${kleinChecks.length}`, label: "with a neck", tone: "bad" },
    { value: `${count((a) => a.hipOrFeet)} of ${kleinChecks.length}`, label: "with a hip piece or feet", tone: "bad" },
    { value: `${count((a) => a.cubeHead)} of ${kleinChecks.length}`, label: "with a cube head", tone: "good" },
    { value: `${count((a) => a.headColourRight && a.torsoRight && a.legsRight)} of ${kleinChecks.length}`, label: "with the right colours", tone: "good" },
    { value: usd(made[0]?.cost ?? 0, 5), label: "a Klein picture" },
    { value: usd(spent), label: "spent on this test" },
  ],
  sections: [
    ...sections,
    ...(r.scene?.file ? [{
      heading: "One scene: the library's references (left) against the Klein references (right)",
      text: "The first real story's scene 2, made again by the real picture builder with the picked Klein pictures as the references. The clip hand, the neck piece and the hip piece come along into the scene. (The Klein references do bring a flatter mouth and a squarer head than the first Pro picture of Vex did: that is what the four fixes are for, on whichever model draws the library.)",
      cards: [
        { image: path.join(dir, "scene-pro.jpg"), title: "With the library's Pro references (the story's own picture)", tone: "warn", note: "The body is right. The head is rounded and the mouth has a tongue: the first Pro picture of Vex, made before the fixes." },
        { image: path.join(dir, "scene-klein.jpg"), title: "With the Klein references", tone: "bad", note: `A neck piece under the head, a clip hand at the bottom edge, a hip piece between the legs. Cost ${usd(r.scene.cost)}.` },
      ],
    }] : []),
    {
      heading: "The reference prompt that was used (Vex)",
      cards: [{ title: "Sent to Klein exactly like this, 768 × 1376, 4 steps", prompt: avatarPrompt(ROSTER.find((a) => a.id === "vex")) }],
    },
    {
      heading: `The list to approve: ${FULL_ROSTER.length} avatars (the ${ROSTER.length} already in the roster and ${PROPOSED.length} new)`,
      text: "Every avatar has its own name, role, personality line, voice, main colour and signature accessory: no two share a colour or an accessory, so each silhouette is its own. Names are invented or everyday words, checked against the banned real names. Accessories are worn, never held, and none is a weapon. No picture is made from this list until you approve it.",
      html: rosterTable,
    },
  ],
  decisions: [
    "<b>Klein or Pro for the library.</b> By your rule (\"if Klein matches Pro, use it; if not, use Pro\"): Pro. One thing could still change that, for about 3 cents: Klein seems to draw the very parts the prompt tells it to leave out (the prompt names clip hands, neck studs and minifigures in its leave-out list). A second round with a prompt that only says what the body IS would show whether Klein can do it at all. Say if you want it.",
    "<b>Pro pictures with the four fixes.</b> The three Pro pictures in the library were made before the fixes (Vex's rounded head and tongue, Lux turned to the side). A fair like-for-like is three Pro pictures with today's prompt: about $0.40.",
    `<b>The list of ${FULL_ROSTER.length}.</b> Approve it, or tell me which names, roles, colours or accessories to change. On Pro the ${FULL_ROSTER.length} pictures are about $${(FULL_ROSTER.length * 0.134).toFixed(2)} at one each, or about $${(FULL_ROSTER.length * 0.134 * 2).toFixed(2)} at two each with the check picking the better one.`,
  ],
});
fs.writeFileSync(path.join(outDir, "index.html"), html);
console.log(`wrote ${path.join(outDir, "index.html")} (${(html.length / 1e6).toFixed(2)} MB)`);
