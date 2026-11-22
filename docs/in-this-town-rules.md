# In This Town: the rules (round 4, 2026-11-22)

Before round 4 there were about 60 rules spread over five places: the writer (`writer2.js`), the plan (`director2.mjs`
PLAN_SYSTEM), the scene cards (`sceneCards.mjs` SCENE_SYSTEM + `sceneProblems`), the picture check (`storyboard3.mjs`
vision prompt) and the engine (`worlds.py`). Some were craft basics, some were fixes for a single test, and a few
contradicted each other. Now there are **12 global rules** (`supabase/functions/_shared/blockyWorlds/rules.js`, the same text
in every step) plus **story rules** that the plan writes fresh for every story.

## The 12 global rules

1. **Simple + kid-safe:** words a 9-year-old learning English knows, short lines; scary is fine, nobody gets hurt.
2. **One town rule:** said in the first line, every line follows from the one before, the ending uses that same rule.
3. **Showable:** every line is something the engine can show (the engine kit).
4. **Named = seen:** what a line names (a person, a thing, an action, the monster) is in the frame, big enough to read, and the one the line is about does it.
5. **Faces:** never cut by the frame, never under the captions; close-ups only for a reaction or a speaker, at most 1 shot in 4.
6. **Camera:** never inside a wall or a body, never under the ground, never just one flat surface or a glare blob.
7. **Alive:** nobody is frozen (everyone breathes, blinks and moves), every action blends into the next, walking feet move with the ground.
8. **Show the place:** the first shot of every place moves through it (a street glide, a low drone or a follow walk), never just one house.
9. **The story's world:** nothing on screen contradicts the story rules (who is outside, what moves, what is lit).
10. **Same cast:** a character keeps one look and one voice all story; only the one speaking moves their mouth.
11. **One scene, one place:** a scene stays in one of the story's own places.
12. **Every line a new picture:** each line changes what we see (a new shot or a new action), never the same shot twice in a row.

Which step reads which: writer 1, 2, 3, 12 · plan 2, 8, 9, 10, 11 · scene cards 4–9, 11, 12 · picture check 4, 5, 6, 9.
The engine enforces 5, 6, 7 and 8 in code, whatever a card asks for.

## Story rules (the plan writes them fresh for each story)

`plan.story_rules` + `plan.town` + every line's `world`:

- **mood** and **colours**
- **camera_style**: glide / drone / follow / handheld / still
- **cut_every_s**: the pace
- **places_why**: which places, and why
- **outside**: who is outdoors when
- **the town's habits** and **effects**: what the rule means per time of day
- **a world state per line**: busy / walkers / extras / cars / windows / curtains / threat

## Every rule before round 4, and what happened to it

| Where | Rule | Now |
|---|---|---|
| writer | Two openings (rule first / result first), pick one | kept as writer craft (it serves rule 2) |
| writer | Four story types | kept as writer craft |
| writer | Simple English, no rare words (list), no idioms | global 1 (the hard-word list stays as its code check) |
| writer | Short common names, at most 3 named characters | writer craft (serves 1) |
| writer | One rule, said again in other words within 4 lines, no new rules, the ending uses it | global 2 (the "again within 4 lines" stays as craft) |
| writer | Every line showable by the engine kit | global 3 |
| writer | Shape: hook, examples, problem, worse, fix, funny end | writer craft |
| writer | 32–38 lines / about 90 s | REMOVED as a rule: the length comes from the request (a word budget: about 3 words a second) |
| writer | Speaking line: speaker + double quotes | writer craft (format) |
| writer | Self-test (3 sentences, would a 10-year-old get it) | writer craft (serves 1, 2) |
| writer | "WHEN: the whole story happens in the day / at night" | REMOVED as a fixed rule: the plan's per-line time (story rules) |
| plan | Exact looks per cast member, clearly different colours | global 10 |
| plan | At most 3 places, every line a place + time | global 11 + story rules (places) |
| plan | "Never an unrelated set (a classroom, a bedroom, a shop)" | REMOVED (a one-test fix; global 11 covers it) |
| plan | Props with sizes | plan craft |
| plan | One monster look, size 3–4 | global 10 (same look) + engine |
| plan | One voice type per speaking character | global 10 |
| plan | World state per line, lively defaults, the town's habits override | STORY RULES (the defaults are the plan's starting point, not rules) |
| plan | The threat arc (calm, near, react, after) | story rules (the plan writes it); the engine plays it |
| scene | Start frame shows what the words name | global 4 |
| scene | Another character's action = that character does it | global 4 |
| scene | Close only for a reaction or speech | global 5 |
| scene | **A new place starts with a WIDE camera** | REPLACED by global 8 (a moving establishing shot); it contradicted "the monster's first look is a reveal" when a place began with the monster |
| scene | Stay in the story's places | global 11 |
| scene | Monster in frame when the words are about it, first look = reveal, never just its legs | global 4 (the reveal camera is card craft) |
| scene | Motion steps on words, only engine actions | card craft (format) |
| scene | Things keep their kind, people from the plan only | global 10 |
| scene | SFX on a word | card craft |
| scene | People outdoors only if the world state lists them | global 9 |
| scene | Close-ups max 25% (code cap) | global 5 |
| check | Shows its words, not blurry, dark, a flat wall, a glare blob, a cut-off subject | global 4, 6 |
| check | Fits the world state | global 9 |
| engine | Faces inside the safe area, above the captions (the framing gate) | global 5 |
| engine | The camera never inside a body (cam guard), never under the ground, clears trees in front | global 6 |
| engine | Medium = "as big as fits" | REMOVED (made giant heads); framing is measured to a size |
| engine | A lamp bulb prop on a street is dropped (glare blob) | REMOVED as a rule: a one-test fix, kept in code |
| engine | Copy mode (replica only) | kept, replica only |
| engine | Dot faces by default, the old face as an option | global 10 (the style is the default look) |
| engine | Idle life, blending, no sliding feet (new) | global 7 |
| engine | The first shot of a place moves (new) | global 8 |

## Example: the story rules the plan wrote for "Nobody Goes Out After Dark"

- **mood:** cozy then spooky, with a funny ending
- **colours:** warm yellow day, orange sunset, deep blue night with lamp glow, green slime
- **camera_style:** glide · **cut_every_s:** 1.4
- **places_why:** a suburb street shows the town by day and empty at night, the living room is where the kids hide indoors, the porch is where Me goes out and comes back
- **outside:** by day kids, dogs and neighbours are out; at sunset everyone hurries home; at night nobody is outside except Me, and then the monster
- **town:** "Nobody goes outside after dark, because a monster comes for anyone out at night."; habits: in the day the street is happy and busy · at sunset everyone hurries home · at night doors are shut, curtains closed, the street is empty · people only peek from windows; effects at night: no people outside, no moving cars, curtains closed (some windows lit behind them); at sunset: everyone hurries home
