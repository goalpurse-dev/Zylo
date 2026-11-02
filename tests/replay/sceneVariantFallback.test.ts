// The setting variant a scene asks for, with a safe fallback (2026-10-26). A model-made bible may
// name its variants freely with none called "default"; picking "default" there read a missing
// variant and crashed the scene ("reading 'midground'"), which the scene ladder then took for a
// Runware outage and paused drawing for everyone.
import { assertEquals, assert } from "jsr:@std/assert@1";
import { pickVariant, settingBlock } from "../../supabase/functions/_shared/stickman/promptCompiler.ts";

const v = (name: string) => ({ background: `${name} bg`, midground: `${name} mid`, foreground: `${name} fg`, palette: "p", signatureObjects: "o", lighting: "l" });

Deno.test("pickVariant: the asked-for variant, else default, else the first one", () => {
  const withDefault = { default: v("default"), cold_night_freeze: v("cold") };
  assertEquals(pickVariant(withDefault, "cold_night_freeze at dusk"), "cold_night_freeze");
  assertEquals(pickVariant(withDefault, "something else"), "default");
  assertEquals(pickVariant(withDefault, null), "default");
  const noDefault = { sun_rocks: v("sun"), hot_spring_ground: v("spring") };
  assertEquals(pickVariant(noDefault, "hot_spring_ground"), "hot_spring_ground");
  assertEquals(pickVariant(noDefault, "the river bank"), "sun_rocks", "no default: the first variant, never a missing one");
  assertEquals(pickVariant(noDefault, undefined), "sun_rocks");
  assert(settingBlock("Landscape", noDefault[pickVariant(noDefault, "x") as keyof typeof noDefault]).includes("midground sun mid"));
  assertEquals(pickVariant({}, "x"), "default", "an empty setting gives a name the caller treats as missing");
});
