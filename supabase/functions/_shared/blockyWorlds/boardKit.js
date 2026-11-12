// Blocky Worlds BOARD KIT MANIFEST (2026-11-12): the ONE list of what the storyboard board kit can show, for the
// server (the idea picker, the script writer, a launch-mode check) and the engine (scripts/blockyWorlds/engine/lib/
// storyboardDirector.js reads its places / animals / weather from here; dev/autoPipeline.test.mjs checks that the
// actions here are exactly the engine's animated ones, lib/boardActions.js BOARD_ACTIONS). Pure data.
export const BOARD_KIT = Object.freeze({
  version: 2,
  places: Object.freeze([
    { id: "street", what: "a suburban street of up to 7 houses: real windows, a room inside each house; day, dusk or night", outdoor: true },
    { id: "room", what: "the room inside a house (furniture from the story: bed, shelf, rug, cat, painting, boards, bricks, counter, bowl, sofa, lamp, table, nightstand)", outdoor: false },
    { id: "park", what: "a park / town square: grass, a path, trees, benches, a pond, lamps", outdoor: true },
    { id: "woods", what: "a woods path between trees", outdoor: true },
    { id: "school", what: "a classroom", outdoor: false },
    { id: "shop", what: "a shop: shelves of goods, a counter with a till, a shop window", outdoor: false },
  ]),
  // the monster VARIANTS on the same tall body (page/simple/monsters.js MONSTER_VARIANTS): the script must describe the one drawn
  // (engine lib/storyboard.js creatureCheck: the words pick the variant; words no variant can show fail cleanly)
  creatures: Object.freeze([
    { id: "peeker", what: "one huge glowing eye", signature: "the eye presses glass, stares, twitches, blinks" },
    { id: "shadow", what: "a faceless tall shadow", signature: "stretches taller, flickers out, shivers" },
    { id: "grin", what: "a wide glowing grin", signature: "the grin widens, flickers, jitters" },
    { id: "hat", what: "a tall figure in a tall hat, one dim eye", signature: "tips its hat, the hat wobbles" },
    { id: "many_eyes", what: "six small glowing eyes", signature: "the eyes open in turn, close in turn, dart" },
  ]),
  creatureMoves: "lurks, strides in and kneels at a window, presses to the glass, licks the glass, turns toward a house, backs away into the dark",
  // the PROPS KIT (2026-11-12): small things held in a hand, set on a table or on the ground (engine page/simple/boardProps.js)
  props: Object.freeze([{"id":"cup","aliases":["cups","teacup"]},{"id":"mug","aliases":[]},{"id":"saucer","aliases":["saucer of milk","dish"]},{"id":"bowl","aliases":["bowl of soup"]},{"id":"plate","aliases":[]},{"id":"spoon","aliases":["fork"]},{"id":"bottle","aliases":[]},{"id":"jar","aliases":["jam jar"]},{"id":"book","aliases":["diary","notebook"]},{"id":"letter","aliases":["envelope","postcard"]},{"id":"note","aliases":["sticky note","message"]},{"id":"map","aliases":["treasure map"]},{"id":"phone","aliases":["cellphone","mobile"]},{"id":"ball","aliases":["football","soccer ball","basketball"]},{"id":"kazoo","aliases":[]},{"id":"whistle","aliases":[]},{"id":"bell","aliases":["handbell"]},{"id":"bag","aliases":["purse","sack"]},{"id":"backpack","aliases":["schoolbag","rucksack"]},{"id":"box","aliases":["cardboard box","crate"]},{"id":"present","aliases":["gift","parcel","package"]},{"id":"key","aliases":["keys"]},{"id":"lantern","aliases":["candle"]},{"id":"flashlight","aliases":["torch"]},{"id":"umbrella","aliases":[]},{"id":"pencil","aliases":["pen"]},{"id":"crayon","aliases":["marker"]},{"id":"coin","aliases":["coins","money","penny"]},{"id":"candy","aliases":["sweets","lollipop","chocolate"]},{"id":"cake","aliases":["birthday cake","cupcake"]},{"id":"cookie","aliases":["biscuit"]},{"id":"sandwich","aliases":["lunch"]},{"id":"apple","aliases":["banana","fruit"]},{"id":"egg","aliases":[]},{"id":"pumpkin","aliases":[]},{"id":"teddy","aliases":["teddy bear","stuffed bear"]},{"id":"doll","aliases":[]},{"id":"toy","aliases":["toy car","toys"]},{"id":"balloon","aliases":[]},{"id":"kite","aliases":[]},{"id":"bucket","aliases":["pail"]},{"id":"broom","aliases":["mop"]},{"id":"shovel","aliases":["spade"]},{"id":"stick","aliases":["branch","wand of wood"]},{"id":"rock","aliases":["stone","pebble"]},{"id":"flower","aliases":["flowers","rose"]},{"id":"clock","aliases":["alarm clock"]},{"id":"camera","aliases":[]},{"id":"wand","aliases":["magic wand"]},{"id":"crown","aliases":[]},{"id":"mask","aliases":[]},{"id":"trophy","aliases":["medal","cup trophy"]},{"id":"drum","aliases":[]},{"id":"basket","aliases":[]},{"id":"gate","aliases":["gates","fence","fences","garden gate","picket fence","latch"]},{"id":"leash","aliases":["leashes","dog leash"]},{"id":"hat_stack","aliases":["hat tower","hat towers","tower of hats","stack of hats","hat stack"]},{"id":"hat","aliases":["cap","bonnet","beanie","top hat"]},{"id":"statue","aliases":["monument","statue's nose"]},{"id":"fountain","aliases":["fountain edge","water fountain"]}]),
  animals: Object.freeze(["dog", "cat", "rabbit", "bird", "duck", "cow", "pig", "sheep", "chicken", "fox", "bear", "deer", "frog", "owl", "mouse", "goat", "turtle", "wolf"]),
  weather: Object.freeze(["rain", "snow", "wind"]),
  crowds: "people on the street (street slots 0-9) or in a place: stand, walk, run, cheer, wave, look up, cover their eyes",
  actions: Object.freeze(["lights_on:windows", "peek:curtains", "lurk:monster", "press:eye", "glow:windows", "stare:ceiling", "bulge:curtains", "poke_out:cat", "stack:bricks", "tremble:curtains", "wave", "peek:sock", "stare:cat", "catch:peeking", "talk", "rip:curtains", "fly:curtains", "grab:boards", "nail:boards", "smear:batter", "lick:glass", "huddle:blanket", "herd", "sneeze", "blow_off:blanket", "look_up", "turn:monster", "pull:sock", "blink:eye", "back_away:monster", "dark:windows", "sleep", "cover:eyes", "walk", "stare", "twitch:eye", "arrive:monster", "hide:curtains", "rain:falls", "snow:falls", "cheer", "run", "animal:move", "touch", "bird:land", "bird:fly_off"]),
  notYet: Object.freeze(["creatures other than the 5 tall-body variants (no wings, tentacles, slime, spiders, swimmers)", "inside a giant thing (a world kind)", "vehicles", "fog / storms / lightning", "snow-covered ground", "the beach, the city, space, castles, underwater", "held props outside the props kit (swords, computers, instruments, ropes, ladders)"]),
});
