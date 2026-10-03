// $0: candidate scenes for the Long Form landing gallery from ONE project —
// ready, people-led treatments, no planned in-picture text, no split frame —
// with a 480 px thumbnail each (saved to <outDir>) and a JSON list.
//   deno run -A --env-file=.env.local scripts/lpCandidates.ts <projectId> <outDir>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { splitDivider } from "../supabase/functions/_shared/stickman/imageChecks.ts";

const [P, OUT] = Deno.args;
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const { data: sc } = await admin.from("long_form_scene_images").select("beat_sequence, image_url, beat_plan_version_id, warnings, overlay_text, qa").eq("project_id", P).eq("is_current", true).eq("status", "ready").order("beat_sequence");
const { data: beats } = await admin.from("long_form_beats").select("sequence, narration_text, contract").eq("beat_plan_version_id", sc![0].beat_plan_version_id);
const beat = new Map(beats!.map((b: any) => [b.sequence, b]));
const PEOPLE = new Set(["STORY_SCENE", "REACTION", "CROWD", "POV", "ESTABLISHING", "SYMBOLIC"]);
await Deno.mkdir(OUT, { recursive: true });
const out: any[] = [];
for (const s of sc!) {
  const b: any = beat.get(s.beat_sequence);
  const c = b?.contract ?? {};
  if (!PEOPLE.has(c.treatment) || !(c.subjects ?? []).length) continue;
  if (c.textIntent?.mode === "SHORT_TEXT" && c.textIntent?.kind === "IN_SCENE") continue;
  if ((s.warnings ?? []).length || s.qa?.safeFallback) continue;
  const url = s.image_url.replace("/object/public/", "/render/image/public/") + "?width=480&height=270&resize=contain";
  const r = await fetch(url); if (!r.ok) continue;
  const bytes = new Uint8Array(await r.arrayBuffer());
  const img = await Image.decode(bytes) as Image;
  if (splitDivider(img) != null) continue;
  const n = String(s.beat_sequence).padStart(3, "0");
  await Deno.writeFile(`${OUT}/${n}.img`, bytes);
  out.push({ n: s.beat_sequence, treatment: c.treatment, summary: c.userSummary ?? c.visualConcept, concept: c.visualConcept, narration: b.narration_text, url: s.image_url });
}
await Deno.writeTextFile(`${OUT}/candidates.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ project: P.slice(0, 8), ready: sc!.length, candidates: out.length }));
