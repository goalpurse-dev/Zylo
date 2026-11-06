// Blocky Worlds: the line's MEANING over its nouns (human-eye review of run 7b4c0d8b, 2026-11-06). A pass over the
// planned shots, after the director's worlds / crowds are in (plan.mjs), before the last visual + subject fixes:
//   1. an army's gear is shown by the army: a loose "item" (a boot / helmet / torch lying on the ground) next to the
//      marching soldiers that wear it is dropped (the crowd's aliases cover the word)
//   2. a place "was empty" / "deserted", people "were gone": absent means absent: the townsfolk extras and the town's crowd leave
//      the line's shots ("At dawn, the street was quiet and empty" showed a crowd)
//   3. a thing left behind ("Her chair still sits there, waiting"): its owner is not in it: the people leave that shot
//   4. a line at home ("down our street", "outside our door", "the shutters") in a story that lives inside / on a
//      creature plays inside it, not on the land outside (the army marching down OUR street: run 7b4c0d8b showed a
//      field with a "DOOR" badge)
//   5. "carried off" / "dragged away": never an empty carry pose; the army that takes them is in the shot
//   meaningPass(shots, lines, { worlds }) -> number of changes (mutates)
const TOWN = /^town\d$/;
const ABSENT = /\b(was|were|is|are|stood|lay|lies|sat|looked|went|got) (quiet and |completely |totally |all |so )?(empty|deserted|abandoned)\b|\b(everyone|everybody|they) (was|were|is|are) (all )?gone\b|\bempty (street|streets|town|square|room|house|houses|shell)\b/;
const LEFT_BEHIND = /\b(still (sits|sat|stands|stood|waits|waited|lies|lay)|sits empty|stood empty|sat empty|untouched)\b/;
const CARRIED = /\b(carried|dragged|taken|hauled|marched|snatched) (off|away)\b|\bmarch (you|her|him|them|us) off\b/;
const AT_HOME = /\b(our|my|the) (street|streets|door|doors|house|houses|home|shutters?|windows?|porch|bunk|room|roof|alley)\b/;

export function meaningPass(shots, lines, { worlds = null } = {}) {
  let n = 0;
  const textOf = (s) => (s.lines ?? [s.line]).map((i) => lines[i]?.text ?? "").join(" ").toLowerCase();
  const insideId = Object.entries(worlds ?? {}).find(([, w]) => w?.view === "inside")?.[0] ?? Object.entries(worlds ?? {}).find(([, w]) => w?.view === "on")?.[0];
  const army = (shots.find((s) => (s.crowds ?? []).some((c) => /soldier/.test(c.kind ?? "")))?.crowds ?? []).find((c) => /soldier/.test(c.kind ?? ""));
  const viewOf = (s) => worlds?.[String(s.set ?? "").slice(9)]?.view;
  for (const s of shots) {
    if (s.camera === "insert") continue;
    const t = textOf(s);
    // 1. the army wears its gear
    const crowdWords = new Set((s.crowds ?? []).flatMap((c) => c.aliases ?? []));
    if (crowdWords.size && (s.objects ?? []).some((o) => o.name === "item" && GEAR_STATE[o.state] && GEAR_STATE[o.state].some((w) => crowdWords.has(w)))) {
      s.objects = s.objects.filter((o) => !(o.name === "item" && GEAR_STATE[o.state] && GEAR_STATE[o.state].some((w) => crowdWords.has(w)))); n++;
    }
    // 2. absent means absent
    if (ABSENT.test(t) && !/\b(not empty|never empty)\b/.test(t)) {
      const before = (s.actors ?? []).length + (s.crowds ?? []).length;
      s.actors = (s.actors ?? []).filter((a) => !TOWN.test(a.id));
      if (s.crowds) { s.crowds = s.crowds.filter((c) => c.kind !== "townsfolk"); if (!s.crowds.length) delete s.crowds; }
      if ((s.actors ?? []).length + (s.crowds ?? []).length !== before) {
        if (TOWN.test(s.focus ?? "") || (s.focus === "group" && !(s.actors ?? []).length)) s.focus = s.actors[0]?.id ?? "group";
        if (s.subject === "group" && !(s.actors ?? []).length) s.subject = null;
        n++;
      }
    }
    // 3. a thing left behind: nobody in it (its verb, "sits" / "waits", is the thing's own: shown by the thing)
    if (String(s.subject ?? "").startsWith("thing:") && LEFT_BEHIND.test(t) && (s.objects ?? []).length) {
      if ((s.actors ?? []).length) { s.actors = []; s.focus = "object"; n++; }
      s.waived = [...new Set([...(s.waived ?? []), "sit", "sits", "wait", "waiting", "stand", "lie"])];
    }
    // 5. "carried off" / "dragged away": someone takes them. Never an empty carry pose: the taken person is scared and
    // the army that takes them is in the shot (when the story has one)
    if (CARRIED.test(t) && army) {
      // a townsperson in an empty carry pose is a stand-in for the takers: they leave; anyone else is scared
      if (army && (s.actors ?? []).some((a) => TOWN.test(a.id) && a.pose === "carry" && !a.hold) && (s.actors ?? []).some((a) => !TOWN.test(a.id))) { s.actors = s.actors.filter((a) => !(TOWN.test(a.id) && a.pose === "carry" && !a.hold)); n++; }
      for (const a of s.actors ?? []) if (a.pose === "carry" && !a.hold) { a.pose = "scared"; a.expr = "scared"; n++; }
      if (!s.crowds?.length && army && !["insert"].includes(s.camera)) { s.crowds = [{ ...army, count: Math.min(army.count ?? 40, 40), action: "march", formation: "column", spot: "back", facing: "right" }]; n++; }
      // the taking is the army's (no townsperson in a carry pose stands in for it)
      if (s.crowds?.length) s.waived = [...new Set([...(s.waived ?? []), "carry", "carried", "grab"])];
    }
    // 4. at home: inside the creature
    if (insideId && ["outside"].includes(viewOf(s)) && AT_HOME.test(t)) {
      s.worldBase ??= s.set; s.set = `creature:${insideId}`;
      if (s.giants) { s.giants = s.giants.filter((g) => g.id !== "world"); if (!s.giants.length) delete s.giants; }
      if (s.focus === "world") s.focus = (s.actors ?? [])[0]?.id ?? (s.crowds?.length ? "crowd" : "group");
      if (["establish", "aerial", "track", "behind_army"].includes(s.camera)) s.camera = "wide";
      // the shell's street is narrow: a smaller column of the army marching down it (the camera stays inside the shell)
      for (const c of s.crowds ?? []) { c.count = Math.min(c.count ?? 40, 48); c.formation = "column"; }
      n++;
    }
  }
  return n;
}

/** the item states (kit/props.js kinds) that are an army's gear, with the words the crowd's aliases use */
const GEAR_STATE = { shoe: ["boots", "boot"], helmet: ["helmet", "helmets"], flashlight: ["torch", "torches"], torch: ["torch", "torches"], spear: ["spear", "spears"], shield: ["shield", "shields"] };
