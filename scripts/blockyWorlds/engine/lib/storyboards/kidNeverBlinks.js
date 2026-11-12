// THE OWNER'S STORYBOARD for test video #2 "The Kid Who Never Blinks" (owner 2026-11-11), hand-written: each line =
// what we SEE happening. It drives the scene list and the shots (lib/storyboard.js applyStoryboard) and is the
// few-shot example the AI director is given for every story.
//   bible.homes       who lives where (houses on the street, left to right; each house has its own room)
//   bible.houses      each house's windows at the start (cover: curtained | bulging | thin | sock | bare; bricks)
//   bible.events      world-state changes from a line on (the wind strips every house but Nell's sock; the sock off)
//   bible.rule        the rule + its CONSTRAINTS on the world (checked on every shot: lib/storyboard.js checkRule)
//   lines[n]          { place, shots: [{ at?: first word of the cut, loc, light, cam, people, monster, acts }] }
//                     | { keep: true, replace?: { k: shot } } (the planned engine shots, the k-th one replaced)
// loc: street | house:<owner> (outside, at the house) | room:<owner> (inside the owner's room)
// people[].where: window:<owner>:<i> (behind a house window) | room:<mark> (window, center, door, bed, sofa, painting)
export const KID_NEVER_BLINKS = {
  id: "kid_never_blinks",
  title: "The Kid Who Never Blinks",
  // the narration (the few-shot example of lib/storyboardDirector.js shows each line with what we see)
  exampleLines: ["In this town, there's one rule. Never look out your window after dark.","You see, the Peeker only finds people who look at it.","Its eye presses your glass, your window glows white, and nobody sleeps for a week.","Dottie Pell has forty curtains bulging off her house like a cloud.","Dottie lost her cat in them for three days.","Mr. Hollis has ten curtains and a wall of bricks.","Mrs. Fenwick has only three thin curtains.","There's me, Nell, with zero curtains and one sock.","The sock has a hole in it, because I'm nosy.","I've never lost a staring contest, not even to the cat.","Grandpa Wim caught me peeking and didn't even scold me.","He said, \"Stare at rude things longer. Rude things blink first.\"","One night a wild wind ripped off every curtain.","They flew away like kites. Every window went bare.","Mr. Hollis grabbed boards and a hammer.","He nailed them perfectly, over a painting of a boat.","The real window was behind him, filled with one giant eye.","Dottie Pell slapped pancake batter on every pane.","The Peeker licked the glass clean.","Mrs. Fenwick herded the grown-ups under one blanket, eyes shut.","She sneezed and the blanket flew away.","Every grown-up looked straight up at it.","Every window glowed white, and it turned toward my house.","Its eye filled my window, right behind the sock.","I remembered Grandpa. Rude things blink first.","I pulled the sock off.","I walked outside and looked right at it.","It stared, I stared, the whole street peeked through fingers.","My eyes watered, my nose itched, I did not blink.","Its giant eyelid twitched.","Rude things blink first.","It blinked, flinched, and backed away into the dark.","Every glowing window went dark, and the town finally slept.","Now the town leaves one window bare, mine, in case.","Grandpa says I'm the rudest thing in town.","And Dottie found her cat. It was in my sock."],
  bible: {
    // Pell is Dottie's surname: ONE person, Dottie Pell (the planner's extra kid "Pell" is dropped from the cast)
    drop: ["pell"],
    rooms: { me: { props: ["bed:side", "shelf", "rug", "cat"] }, town1: { props: ["bed", "nightstand"] }, hollis: { props: ["painting", "boards", "table", "bricks"] }, dottie: { props: ["counter", "bowl", "table"] }, fenwick: { props: ["sofa", "rug:red", "lamp"] } },
    homes: { town1: 0, town2: 1, dottie: 2, hollis: 3, fenwick: 4, town3: 5, me: 6 },
    // the houses' windows (the scene list's format, lib/scenes.js): "*" = every other house; events change them from a
    // line on (during that line the change happens on screen: the wind's rip, the sock pulled off, the batter licked)
    houses: { "*": { cover: "curtained", bricks: false, painting: "none", light: "default" }, dottie: { cover: "bulging", bricks: false, painting: "none", light: "default" }, fenwick: { cover: "thin", bricks: false, painting: "none", light: "default" }, hollis: { cover: "curtained", bricks: true, painting: "none", light: "default" }, me: { cover: "sock", bricks: false, painting: "none", light: "default" } },
    events: [
      { line: 2, owners: ["town1"], set: { light: "eye" }, why: "the eye presses a window, it glows white" }, { line: 3, owners: ["town1"], set: { light: "default" } },
      { line: 12, owners: ["*"], except: ["me"], set: { cover: "bare", bricks: false }, why: "the wild wind rips off every curtain (Nell's taped sock stays)" },
      { line: 15, owners: ["hollis"], set: { painting: "boarded" }, why: "boards nailed over a painting of a boat" }, { line: 16, owners: ["hollis"], set: { light: "eye" }, why: "the real window, filled with the eye" }, { line: 17, owners: ["hollis"], set: { light: "default" } },
      { line: 17, owners: ["dottie"], set: { cover: "smeared" }, why: "pancake batter on every pane" }, { line: 18, owners: ["dottie"], set: { cover: "bare" }, why: "licked clean" },
      { line: 22, owners: ["*"], set: { light: "glow_white" }, why: "every window glowed white" }, { line: 25, owners: ["me"], set: { cover: "bare" }, why: "Nell pulls the sock off" },
      { line: 32, owners: ["*"], set: { light: "dark" }, why: "every glowing window went dark" }, { line: 33, owners: ["*"], set: { light: "default" } },
    ],
    rule: {
      text: "Never look out your window after dark.",
      constraints: [{ when: ["night", "dusk"], outside: "empty", people: "indoors", except: [{ who: "me", fromLine: 26 }], why: "after dark nobody is outside: the streets are empty, people stay behind their windows" }],
    },
  },
  // the production list's items as this storyboard shows them (lib/storyboard.js applyStoryboard): the white glow is
  // the windows turning white (not a ring), the batter is pancake batter (not soup), the neighbours / grown-ups are
  // people at their windows / in the living room (no crowd on the street after dark), the sock is Nell's window cover
  kit: {
    white_glow: { kitName: "act:glow:windows|dark:windows" }, flying_curtains: { kitName: "act:fly:curtains" }, wild_wind: { kitName: "act:rip:curtains|fly:curtains" },
    batter: { kitName: "act:smear:batter|lick:glass" }, blanket: { kitName: "act:huddle:blanket|blow_off:blanket" }, sock: { kitName: "board:cover:sock" },
    window_nell: { kitName: "board:window" }, neighbours: { crowdKind: null }, grownups: { crowdKind: null },
  },
  lines: [
    { line: 0, place: "street", shots: [
      { loc: "street", light: "dusk", cam: "town_wide", acts: [{ k: "lights_on:windows" }] },
      { at: "Never", loc: "house:town1", light: "dusk", cam: "window:town1:0", people: [{ id: "town1", where: "window:town1:0", face: "worried" }], acts: [{ k: "peek:curtains", who: "town1" }] }] },
    { line: 1, place: "street", shots: [
      { loc: "street", light: "night", cam: "street_end", people: [{ id: "town1", where: "window:town1:0", face: "scared" }, { id: "town2", where: "window:town2:0", face: "scared" }, { id: "town3", where: "window:town3:2", face: "scared" }], monster: { where: "end", state: "lurk" }, acts: [{ k: "lurk:monster" }, { k: "hide:curtains" }] }] }, // the townsfolk ALMOST look, then hide behind the curtain (looking = being taken)
    { line: 2, place: "home:town1", shots: [
      { loc: "house:town1", light: "night", cam: "window:town1:1", monster: { where: "window:town1:1", eye: "press" }, acts: [{ k: "press:eye" }, { k: "glow:windows", at: "glows", only: "town1:1" }] },
      { at: "and", loc: "room:town1", light: "night", cam: "bed_top", people: [{ id: "town1", where: "room:bed", face: "scared", awake: true }], acts: [{ k: "stare:ceiling", who: "town1" }, { k: "glow:windows", only: "room" }] }] },
    { line: 3, place: "home:dottie", shots: [
      { loc: "house:dottie", light: "night", cam: "house:dottie", people: [{ id: "dottie", where: "window:dottie:2", face: "happy" }], acts: [{ k: "bulge:curtains" }] }] },
    { line: 4, place: "home:dottie", shots: [
      { loc: "house:dottie", light: "night", cam: "cat:dottie", people: [{ id: "dottie", where: "window:dottie:0", face: "sad" }], acts: [{ k: "poke_out:cat" }] }] },
    { line: 5, place: "home:hollis", shots: [
      { loc: "room:hollis", light: "night", cam: "room_window", people: [{ id: "hollis", where: "room:window", pose: "carry", face: "worried" }], acts: [{ k: "stack:bricks", who: "hollis" }] }] },
    { line: 6, place: "home:fenwick", shots: [
      { loc: "house:fenwick", light: "night", cam: "window:fenwick:0", people: [{ id: "fenwick", where: "window:fenwick:0", face: "worried" }], acts: [{ k: "tremble:curtains" }] }] },
    { line: 7, place: "home:me", shots: [
      { loc: "room:me", light: "night", cam: "room_me", people: [{ id: "me", where: "room:window", pose: "wave", face: "happy" }], acts: [{ k: "wave", who: "me" }] }] },
    { line: 8, place: "home:me", shots: [
      { loc: "room:me", light: "night", cam: "peek:me", people: [{ id: "me", where: "room:window", face: "smirk", peek: true }], acts: [{ k: "peek:sock", who: "me" }] }] },
    { line: 9, place: "home:me", shots: [
      { loc: "room:me", light: "night", cam: "cat_stare", people: [{ id: "me", where: "room:center", face: "neutral" }], acts: [{ k: "stare:cat", who: "me" }] }] },
    { line: 10, place: "home:me", shots: [
      { loc: "room:me", light: "night", cam: "room_door", people: [{ id: "me", where: "room:window", face: "smirk", peek: true }, { id: "wim", where: "room:door", face: "happy" }], acts: [{ k: "catch:peeking", who: "wim" }, { k: "peek:sock", who: "me" }] }] },
    { line: 11, place: "home:me", shots: [
      { loc: "room:me", light: "night", cam: "face:wim", people: [{ id: "wim", where: "room:center", pose: "talk", face: "smirk" }], acts: [{ k: "talk", who: "wim" }] }] },
    { line: 12, place: "street", shots: [
      { loc: "street", light: "night", cam: "street_wide", acts: [{ k: "rip:curtains" }] }] },
    { line: 13, place: "street", shots: [
      { loc: "street", light: "night", cam: "sky_up", acts: [{ k: "fly:curtains" }] },
      { at: "Every", loc: "street", light: "night", cam: "street_wide", people: [{ id: "town1", where: "window:town1:0", pose: "look_up", face: "shocked" }, { id: "town2", where: "window:town2:0", pose: "look_up", face: "shocked" }, { id: "dottie", where: "window:dottie:0", pose: "look_up", face: "sad" }], acts: [{ k: "look_up" }] }] },
    { line: 14, place: "home:hollis", shots: [
      { loc: "room:hollis", light: "night", cam: "room_wide", people: [{ id: "hollis", where: "room:center", pose: "carry", face: "angry" }], acts: [{ k: "grab:boards", who: "hollis" }] }] },
    { line: 15, place: "home:hollis", shots: [
      { loc: "room:hollis", light: "night", cam: "painting", people: [{ id: "hollis", where: "room:painting", face: "angry" }], acts: [{ k: "nail:boards", who: "hollis" }] }] },
    { line: 16, place: "home:hollis", shots: [
      { loc: "room:hollis", light: "night", cam: "behind_window", people: [{ id: "hollis", where: "room:painting", face: "happy" }], monster: { where: "roomwindow:hollis", eye: "press" }, acts: [{ k: "nail:boards", who: "hollis" }, { k: "press:eye" }, { k: "glow:windows", only: "room" }] }] },
    { line: 17, place: "home:dottie", shots: [
      { loc: "room:dottie", light: "night", cam: "room_side", people: [{ id: "dottie", where: "room:window", face: "angry" }], acts: [{ k: "smear:batter", who: "dottie" }] },
      { at: "every", loc: "house:dottie", light: "night", cam: "arrive:dottie", monster: { where: "window:dottie:0", eye: "stare" }, acts: [{ k: "arrive:monster" }] }] }, // the Peeker ARRIVES before the lick (the state chain: absent -> at the window)
    { line: 18, place: "home:dottie", shots: [
      { loc: "house:dottie", light: "night", cam: "window:dottie:0", monster: { where: "window:dottie:0", eye: "stare" }, acts: [{ k: "lick:glass" }] }] },
    { line: 19, place: "home:fenwick", shots: [
      { loc: "house:fenwick", light: "night", cam: "arrive:fenwick", people: [{ id: "fenwick", where: "window:fenwick:0", face: "scared" }], monster: { where: "window:fenwick:1", eye: "stare" }, acts: [{ k: "arrive:monster" }, { k: "hide:curtains", who: "fenwick" }] },
      { at: "herded", loc: "room:fenwick", light: "night", cam: "room_wide", people: [{ id: "fenwick", where: "room:door", pose: "wave", face: "angry" }, { id: "town1", where: "room:huddle0", shut: true }, { id: "dottie", where: "room:huddle1", shut: true }, { id: "hollis", where: "room:huddle2", shut: true }, { id: "wim", where: "room:huddle3", shut: true }], acts: [{ k: "huddle:blanket" }, { k: "herd", who: "fenwick" }] }] },
    { line: 20, place: "home:fenwick", shots: [
      { loc: "room:fenwick", light: "night", cam: "room_door", people: [{ id: "fenwick", where: "room:door", pose: "sneeze", face: "surprised" }, { id: "town1", where: "room:huddle0", shut: true }, { id: "dottie", where: "room:huddle1", shut: true }, { id: "hollis", where: "room:huddle2", shut: true }, { id: "wim", where: "room:huddle3", shut: true }], acts: [{ k: "sneeze", who: "fenwick" }, { k: "blow_off:blanket", at: "blanket" }] }] },
    { line: 21, place: "home:fenwick", shots: [
      { loc: "room:fenwick", light: "night", cam: "pov_eye", people: [{ id: "town1", where: "room:huddle0", pose: "look_up", face: "shocked" }, { id: "dottie", where: "room:huddle1", pose: "look_up", face: "scared" }, { id: "hollis", where: "room:huddle2", pose: "look_up", face: "shocked" }, { id: "wim", where: "room:huddle3", pose: "look_up", face: "scared" }, { id: "fenwick", where: "room:door", pose: "look_up", face: "scared" }], acts: [{ k: "look_up" }, { k: "glow:windows", only: "room" }] },
      { at: "straight", loc: "room:fenwick", light: "night", cam: "window_in", monster: { where: "roomwindow:fenwick", eye: "stare" }, acts: [] }] }, // the eye's view of their upturned faces, then the eye itself
    { line: 22, place: "street", shots: [
      { loc: "street", light: "night", cam: "street_wide", monster: { where: "street:hollis", state: "lurk", turnTo: "me" }, acts: [{ k: "glow:windows" }, { k: "turn:monster", at: "turned" }] }] },
    { line: 23, place: "home:me", shots: [
      { loc: "room:me", light: "night", cam: "room_window", people: [{ id: "me", where: "room:center", face: "scared" }], monster: { where: "roomwindow:me", eye: "press" }, acts: [{ k: "press:eye" }] }] },
    { line: 24, place: "home:me", shots: [
      { loc: "room:me", light: "night", cam: "face:me", people: [{ id: "me", where: "room:center", face: "thinking" }, { id: "wim", where: "room:door", face: "smirk" }], monster: { where: "roomwindow:me", eye: "stare" }, acts: [] },
      { at: "Rude", loc: "room:me", light: "night", cam: "face:me", people: [{ id: "me", where: "room:center", face: "angry" }], monster: { where: "roomwindow:me", eye: "stare" }, acts: [] }] },
    { line: 25, place: "home:me", shots: [
      { loc: "room:me", light: "night", cam: "room_window", people: [{ id: "me", where: "room:window", face: "angry" }], monster: { where: "roomwindow:me", eye: "stare" }, acts: [{ k: "pull:sock", who: "me" }] }] },
    { line: 26, keep: true, faces: { me: "determined" } },
    { line: 27, keep: true, drop: ["crowds"], replace: { 2: [...["dottie", "hollis"].map((h) => ({ loc: "street", light: "night", cam: `window:${h}:0`, people: [{ id: h, where: `window:${h}:0`, pose: "cover_mouth", face: "scared" }], acts: [{ k: "cover:eyes" }] })), { loc: "street", light: "night", cam: "front:fenwick", people: [{ id: "fenwick", where: "window:fenwick:0", pose: "cover_mouth", face: "scared" }, { id: "wim", where: "window:fenwick:2", pose: "cover_mouth", face: "scared" }, { id: "town3", where: "window:fenwick:3", pose: "cover_mouth", face: "scared" }], acts: [{ k: "cover:eyes" }] }] } }, // three DIFFERENT houses in quick cuts, each owner peeking through fingers
    { line: 28, keep: true, faces: { me: "determined" }, shotFaces: { 0: { me: "teary" } } }, // "My eyes watered": tears, still determined
    { line: 29, keep: true },
    { line: 30, keep: true },
    { line: 31, place: "street", shots: [
      { loc: "street", light: "night", cam: "eye_close", monster: { where: "street:fenwick", eye: "blink" }, acts: [{ k: "blink:eye", at: "blinked" }] },
      { at: "and", loc: "street", light: "night", cam: "street_back", monster: { where: "street:fenwick", state: "flee" }, acts: [{ k: "back_away:monster" }] }] },
    { line: 32, keep: true, drop: ["crowds"], replace: { 0: { loc: "street", light: "night", cam: "street_wide", people: [{ id: "town1", where: "window:town1:0", face: "sleepy" }, { id: "town2", where: "window:town2:0", face: "sleepy" }, { id: "town3", where: "window:town3:0", face: "sleepy" }], acts: [{ k: "dark:windows" }] } } },
    { line: 33, keep: true },
    { line: 34, keep: true },
    { line: 35, keep: true },
  ],
};
