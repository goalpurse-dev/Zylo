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
