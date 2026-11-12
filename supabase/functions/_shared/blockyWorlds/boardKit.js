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
  creatures: Object.freeze([{ id: "monster", what: "one tall dark blocky creature with ONE huge glowing eye (lurks, presses its eye to windows, licks glass, turns, blinks, backs away)" }]),
  animals: Object.freeze(["dog", "cat", "rabbit", "bird", "duck", "cow", "pig", "sheep", "chicken", "fox", "bear", "deer", "frog", "owl", "mouse", "goat", "turtle", "wolf"]),
  weather: Object.freeze(["rain", "snow", "wind"]),
  crowds: "people on the street (street slots 0-9) or in a place: stand, walk, run, cheer, wave, look up, cover their eyes",
  actions: Object.freeze(["lights_on:windows", "peek:curtains", "lurk:monster", "press:eye", "glow:windows", "stare:ceiling", "bulge:curtains", "poke_out:cat", "stack:bricks", "tremble:curtains", "wave", "peek:sock", "stare:cat", "catch:peeking", "talk", "rip:curtains", "fly:curtains", "grab:boards", "nail:boards", "smear:batter", "lick:glass", "huddle:blanket", "herd", "sneeze", "blow_off:blanket", "look_up", "turn:monster", "pull:sock", "blink:eye", "back_away:monster", "dark:windows", "sleep", "cover:eyes", "walk", "stare", "twitch:eye", "arrive:monster", "hide:curtains", "rain:falls", "snow:falls", "cheer", "run", "animal:move"]),
  notYet: Object.freeze(["creatures other than the one-eyed monster", "inside a giant thing (a world kind)", "vehicles", "fog / storms / lightning", "snow-covered ground", "the beach, the city, space, castles, underwater", "held props other than a hammer, boards, a bowl, a brick"]),
});
