// The five sound effects code can't make well, from ElevenLabs Sound Effects (owner's go, 2026-11-04: scream, sneeze,
// monster growl, crowd cheer, crowd murmur; ~$0.20 approved). A PAID call per take (~40 credits a second with a set
// duration; one credit = $0.0002). A take already in assets/sfx-src/eleven/ is never bought again.
// audio/sfxBuild.mjs then uses these takes (trimmed + normalized like every other sound) instead of the stand-ins.
//   node audio/elevenSfx.mjs --yes [name,name]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ELEVEN_DIR = path.join(here, "..", "assets", "sfx-src", "eleven");

// kid-friendly, short, no words; set durations keep them cheap
export const TAKES = {
  scream: { seconds: 1.5, text: "a small child screams loudly in a cartoon way, short high-pitched scream, no words, dry, close" },
  sneeze: { seconds: 1.6, text: "a man does one big comedic sneeze, ah... ah... CHOO!, close, dry, no background" },
  growl: { seconds: 2.5, text: "a deep eerie creature growl, low and slow, creepy but not gory, close, slight reverb" },
  crowd_cheer: { seconds: 2.5, text: "a small-town crowd of people cheer and shout together, short burst, outdoors at night" },
  crowd_murmur: { seconds: 4, text: "a small crowd murmuring quietly outdoors, indistinct chatter, steady, loopable ambience" },
  // the writer's sound words code can't make (2026-11-12): NOT BOUGHT until the owner OKs it. The owner's real rate on the
  // five takes above: billed credits = ceil(11 x seconds) -> these 9 = 116 credits = $0.0232 (list rate 40/s: $0.0824)
  meow: { seconds: 1.2, text: "a cute cartoon cat meows once, short, close, dry, no background" },
  woof: { seconds: 1.0, text: "a friendly dog barks once, woof, close, dry, no background" },
  moo: { seconds: 1.6, text: "a cow moos once, short and comic, close, dry, no background" },
  quack: { seconds: 1.0, text: "a duck quacks once, close, dry, no background" },
  oink: { seconds: 1.0, text: "a pig oinks once, short and comic, close, dry, no background" },
  ribbit: { seconds: 1.0, text: "a frog croaks once, ribbit, close, dry, no background" },
  gulp: { seconds: 0.8, text: "a cartoon gulp, one big swallow, close, dry, no background" },
  munch: { seconds: 1.5, text: "a cartoon character munches food, three quick crunchy bites, close, dry" },
  slurp: { seconds: 1.2, text: "a loud cartoon slurp through a straw, close, dry, no background" },
};

function envKey(name) {
  const line = fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv.includes("--yes")) { console.log("paid ElevenLabs takes: add --yes"); process.exit(1); }
  const only = process.argv.slice(2).find((a) => !a.startsWith("--"))?.split(",");
  const key = envKey("ELEVENLABS_KEY");
  if (!key) throw new Error("ELEVENLABS_KEY missing");
  fs.mkdirSync(ELEVEN_DIR, { recursive: true });
  let credits = 0;
  for (const [name, t] of Object.entries(TAKES)) {
    if (only && !only.includes(name)) continue;
    const mp3 = path.join(ELEVEN_DIR, `${name}.mp3`);
    if (fs.existsSync(mp3)) { console.log(`${name}: already have it (not bought again)`); continue; }
    const r = await fetch("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128", {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text: t.text, duration_seconds: t.seconds, prompt_influence: 0.6 }),
    });
    if (!r.ok) throw new Error(`${name}: ${r.status} ${(await r.text()).slice(0, 300)}`);
    fs.writeFileSync(mp3, Buffer.from(await r.arrayBuffer()));
    const billed = Number(r.headers.get("character-cost"));
    if (Number.isFinite(billed)) credits += billed;
    fs.writeFileSync(path.join(ELEVEN_DIR, `${name}.json`), JSON.stringify({ name, ...t, billedCredits: Number.isFinite(billed) ? billed : null, at: new Date().toISOString() }, null, 1));
    console.log(`${name}: ${t.seconds} s, billed ${Number.isFinite(billed) ? billed : "?"} credits`);
  }
  console.log(`total billed: ${credits} credits = $${(credits * 0.0002).toFixed(4)}`);
}
