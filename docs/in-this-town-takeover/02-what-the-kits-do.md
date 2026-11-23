# What the four creator kits do that we don't

Study only. No kit code or text was copied. One kit's licence is students-only, so only ideas are described here.

Note: `roblox-story.zip` is our own free Zyvo Studio Kit (ZyvoCamera, ZyvoFramer), not a third party's.

## The four kits in one line each

| Kit | How it makes a video | What it deliberately does not do |
|---|---|---|
| roblox-shorts v3.5 (three.js) | The AI writes one small code block per spoken line: who is visible, where, with which face, and one camera preset. Code then repairs and checks every frame. | No plan or state between lines, no hand-overs, no walking between rooms, no rule check |
| ai-with-shane (three.js) | One open town square. The AI places people by coordinates. The camera distance is solved so that named things fit above the caption band. | No collisions, no second set, no walking system |
| BlockFrame (Blender) | Three seeded sets (street, city, bedroom). Each shot rebuilds the world from scratch. Characters are saved specs. Walks start 10 frames before the cut. | No automatic placement, no automatic camera, no content checks |
| roblox-story (ours, Studio) | Each character is a pre-posed "statue" per place and per look; the only state is show/hide. Camera spots are named per set, a framer checks 11 moments per shot, and a contact sheet goes to a human. | No real performed action, no hand-overs, no carrying, no doors, no moving between places, at most 3 characters plus "me" |

## What they all share, and we don't

1. **No placement solver and no acting layer.** People stand where the line puts them. Each set offers a stage area or a few named spots.
2. **Each shot or line restates its cast** (who is visible, where, which face), and everyone else is hidden. Nothing is carried over silently, so a missing person shows up in that line's own data.
3. **The camera is computed from what must be visible**: the subject's box, or the head size for close shots. If something blocks it, the camera swings and the check is run again. If it still fails, the shot is refused. Our engine only logs "clear False" and renders anyway.
4. **Checks are free and geometric** and run before any render: body inside a solid, bodies overlapping, floating, camera inside a wall, face cut off, a large surface near the lens. None of the kits uses a paid vision model. A human looks at one contact sheet.
5. **Short preset camera lists** (5-7 shot types) and plain count rules ("the same setup at most twice in a row").
6. **The writer is boxed in** by a fixed story shape and a "what we see" column for every line. One kit requires each idea to say which existing sets and characters it reuses.
7. **They do not try** hand-overs, contact, doors or travel between places. They fake these with cuts, just as the viral videos do.

## The simplest ideas worth taking, best first

1. **One tested stage with named spots and named camera spots.** People stand on spots; nobody needs solving. This fixes people inside walls and inside each other, and porches with no zones.
2. **Camera from the subject, and fail rather than log.** Compute the distance from the subject's box, cast a ray from the lens to the face, then swing or refuse. This fixes monster legs in the lens and backs of heads.
3. **One shot = one small data row**: spot set, who (at most 2), pose, face, camera preset, prop state. Each row is built fresh. This fixes missing people and lost props.
4. **The writer picks from a menu** of the stage's spots, props and actions, read live when the call is made. This fixes the writer ignoring the engine.
5. **The face drives the body.** One feeling word picks a pose family, and an idle sway is always on. This fixes characters standing like NPCs without a separate acting system.
6. **Free geometry pass first, contact sheet second, paid vision last (or never).**
7. **Each character is built once from its own parameter object.** This fixes one character wearing another's features.
8. **Walks start before the cut, and contact is faked with cuts.**

## Where the kits are weaker than a product must be

- A human approves every step; there is no unattended path.
- Nothing checks that the narrated thing is on screen or that the rule is obeyed.
- Coordinates are typed by hand.

We need the kits' simplicity plus our own "named = shown" and rule checks, all in code.
