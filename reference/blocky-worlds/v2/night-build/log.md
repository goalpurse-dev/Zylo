# Night build 2026-11-25 (log)

## Step 0: inspiration (10 contact sheets, 1 frame / 3 s, in inspiration/). WHAT to build only; every design is our own.
1. Places: bright city main streets (towers behind, coloured shop fronts, plaza with fountain + big screen), suburb streets, cul-de-sacs.
2. Inside: classroom, school hallway with lockers, cafeteria, kid bedroom, grandma's living room, bathroom, office/control room, a train carriage.
3. A dark control room with a wall of screens showing the town, a desk with levers, a huge red button under a dome.
4. Fantasy sets reached by a cut: castle square with banners, desert with pyramid, cave, futuristic neon city, time-machine room.
5. Crowds are 3-14 people in a row or loose arc, mostly standing, always behind the hero.
6. Vehicles: parked cars, a yellow school bus side-on, a city bus at a stop, a taxi, a delivery truck, a train.
7. Weather: things raining from the sky (money, toys, keys piling into a carpet of gold), storm cloud with rain over one person, rainbow, lightning bolt, falling fire streaks at dusk.
8. Ground effects: lava covering the street up to the pavement, keys piled ankle-deep on the road.
9. Time looks: bright noon, deep blue night with lit windows, orange-red danger dusk, grey overcast.
10. Props as text carriers: phone screens with a big readable message, billboards, a big digital clock, a sign over a giant door, a paper list, banners.
11. Big middle things: a lone giant black door with a sign over it, a giant clock, a giant statue-like figure, a glowing machine/portal.
12. Creatures: a tall thin black figure with white eyes (silhouette under a lamp), a giant furry beast on the street, a purple monster on lava.
13. Signature looks read from one piece: police cap, chef/conductor hat, top hat, lab coat, scarf, hood.
14. Camera: high aerial down the main street opens many videos; then medium on the hero with the town behind.
15. Close-up inserts carry the plot: a key in the keyhole, the red button, a clock face, a phone message.

## Build notes
- One builder for every place: v2/set_v2.py (python) + v2/places/*.mjs (data: prefabs expand to boxes/cylinders/spheres/texts/lights; obstacles for the free checks come from the same shapes). Runner: v2/placeTest.mjs (free checks + free local mock + one RunPod job + one sheet per place). Kit: v2/placeKit.mjs (checks, camera solver).
- towns1 ($0.09, 72 stills): builder works; 66/72 pass. Fixed after it: my night/dusk/storm skies were far too light (linear colours), medium/close cameras sat too close (solver now aims at a head size per shot type), clock faces hid behind their rims.
- Step 1 done: 3 towns, 72/72 stills pass (r2). Step 3 done: 21 side sets, 218/218 + inserts re-shot 1.8x farther (24/24). Sheets: sheet_<set>_r2.jpg, side_overview.jpg, inserts_overview.jpg.
- Step 4 done: 6 big things on the old town square (29/29 + closes pulled back 4/4). sheet_big_things.jpg, fixes2.jpg.
- Step 5: people 12/13 then 4/4 fixes: 6 roles (teacher, shopkeeper, police, doctor, bus driver, chef), 4 classmates, 6 neighbours (nb1-nb6), baby, villain Mayor, dog/cat/bird; stretch legs + neck pass. SKIPPED stretch arms: 3 tries (scaling the arm along each axis) never made the arms longer, only wider; needs the arm's own bone length in char_v2 (next time).
- Step 6: 10 entities x 6 states + silhouette 70/70; Many-Arms redone (arms bend round the frame, try 2); Hollow void pushed over the face (try 2); far shots in the towns 3/3.
- Step 7: props 11/11 (phone + key readable close, held in hand after the hold-scale fix), effects: glow, smoke, sparks, grow, lava, water, confetti, lights_out (windows go dark too, try 2). Strips: fixes2.jpg, fixes3.jpg, lightsout.jpg, sheet_people_people.jpg, sheet_props_props.jpg, sheet_entities_entities.jpg.
- Step 2 done: 6 times x 3 towns + 8 weathers x 3 towns (43/43) + fixes: fog = haze cards (world volume rendered black), rain streaks thicker, particles start 6 away from the lens, the lightning flash light (a white ball) replaced by a sun flash. Known: a small white cube in storm shots (cause not found); on the suburb use time storm with weather storm (a day storm looks sunny). Raining keys/frogs/pillows with piles + people reacting pass. Sheets: sheet_weather.jpg, sheet_weather2-4.jpg.
