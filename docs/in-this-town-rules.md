# In This Town: the rules (round 8, 2026-11-23)

Round 8 rule of the rules: **a rule no step checks is removed.** Every rule below names the step that checks or enforces
it. "Code" means it is measured or enforced in code (the card is rejected or fixed, or the engine always does it). "AI
check" means the paid picture check judges it on the rendered stills. Round 4's 12 global rules are kept in
`rules.js` for the old (round 7) pipeline. Round 8 runs on `writer3.js`, `director3.mjs`, `takes.mjs` and
`worlds/stage.py`.

## The rules and who checks them

| # | Rule | Checked by |
|---|---|---|
| 1 | **Simple + kid-safe:** words a 9-year-old knows, lines of at most 13 words, no rare words; scary is fine, nobody gets hurt | code: writer (`writer2Problems`: hard-word list, line length) |
| 2 | **A kid telling a friend:** contractions, short lively lines, at least one sound word | code: writer (`writer3Problems`) |
| 3 | **One line = one subject doing one thing we can see;** no line with nothing to see | code: writer (every line has a subject, a "does" and something it shows) |
| 4 | **Only what the engine can show:** every noun and action is on the generated engine list (`genEngineKit.mjs`, read from the code) | code: writer (`shows` against the list), cards (the action list is the schema; `applyCard` rejects the rest) |
| 5 | **The story tests:** the danger is to someone the narrator loves; the rule's key sentence word for word early (line 1-3) AND at the climax; the hero wins by using the rule in an unexpected way; the last line is a twist or a joke | code: writer (key sentence found twice, the loved one, the danger / trick / twist lines in order) |
| 6 | **Speech is rare:** at most one quoted line, introduced by the narrator on the line before | code: writer (`writer2Problems`) |
| 7 | **One stage, few people:** one main place + at most one side place; 2-3 named characters with the narrator; extras / crowds / traffic only when a line is about them | code: plan (`plan3Problems`), writer (cast count); the engine's living world defaults to quiet (`zs_quiet`) |
| 8 | **The rule is one physical thing** on or next to people (in a hand / next to someone / on the ground), in line 1's opening WIDE with someone doing it, and in most shots | code: story checks (`storyChecks`: line 1's first cut, the share of cuts that show it) |
| 9 | **One continuous take per scene:** the scene is built once; every line adds actions to one timeline; nobody is re-placed between cards; anything that came in stays until a line removes it; a new place or time is a new scene that starts from that place's last state | code: the take compiler (`compileTakes`: one take function per scene, every shot only puts a camera on it) |
| 10 | **The state is the truth:** who is where, facing what, holding what, what is on / off / open, where the monster is, saved after every line and given to the next card; a card that contradicts it is rejected before rendering | code: `applyCard` (rejected, written again once, then only the valid actions are kept) |
| 11 | **Same cast:** a character keeps one look (locked in code, one bold colour each) and one voice all story | code: `lockLooks` (no card can set a look); AI check: the continuity check (same clothes) |
| 12 | **Continuity between cards:** each line's first frame matches the line before's last frame (the same people, clothes, sides, props) unless the scene changed | AI check: the continuity pairs (counted as continuity breaks; a break fails the card) |
| 13 | **Named = seen (wins over every other rule):** every person, thing and the monster a line names gets its own clear shot | code: `cutProblems` + `fixCuts` (a named thing nobody shows is added); AI check: "it must show ..." per still |
| 14 | **The cuts:** about one every 1.4 s, on the start of a word; each shows ONE thing; actions read cause -> effect -> reaction | code: `cutProblems` (the count per line, word starts, a subject per cut) |
| 15 | **Every shot shows something new:** never the same shot of the same thing twice in a row (also across lines) | code: `cutProblems` |
| 16 | **The camera moves:** a slow push-in by default (about half the shots); tilt up for big things, a short track for walking, top-down for things on the ground; no glide or drone tours | code: the moves are the schema (no tour exists), `storyChecks` measures the push-in share |
| 17 | **The camera stays on one side** of the stage (the stage map's camera side), never inside a wall or a body, never under the ground | code: engine (`zc_cut` only looks from the stage side; `zw_cam_guard`) |
| 18 | **The monster:** a shadow (a tall black silhouette, two glowing eyes, long thin limbs) for scary stories, shot from low with a person tiny beside it; its drain is big and in the open | code: engine (style "shadow", the `low` shot, `zs_hole`); `storyChecks` (the drain's mark is center / front) |
| 19 | **The light follows the story:** day setup, night or storm danger, morning ending | AI check: `world_ok` (the time of day per scene, from the plan) |
| 20 | **Readable pictures:** no flat surface filling the frame (a wall, the pavement, the sky), no glare blob, the subject never too small, covered or cut off | code: the free checks (flat surface over 45 %, a cast member too small / covered, a crash), then the AI check |
| 21 | **The action is seen at its moment:** the checker also looks at the frame where the action happens (a pop / an appearing thing at its pop moment) | code: the stills (FIRST / ACTION / LAST per line); AI check |
| 22 | **Alive:** nobody is frozen (breathing, blinking), the speaker's lips move | code: engine (`zm_alive_all`, `zw_emote` talk), always on |

## Removed in round 8 (no step checks them, or round 8 replaced them)

| Rule | Why |
|---|---|
| "The first shot of every place moves through it" (round 4 global 8) | The owner dropped it: one opening wide that already shows the rule is enough |
| The story rules camera_style (glide / drone / follow) and cut_every_s | No tours any more. The pace is rule 14, checked in code |
| "Close-ups at most 1 shot in 4" (round 4 global 5) | No round 8 step checks it. The cuts' subject rule (rule 14) and the picture check cover reactions |
| A world state per line (busy / walkers / cars / curtains per line) | One stage + quiet by default (rule 7). The scene state (rule 10) is what carries over now |
| "Every line a new picture" as a line rule | Became rule 15, per shot, checked in code |

## The engine's new pieces (round 8)

- **Object blocks:** appear, disappear, move A to B, on / off, open / closed, held / given / dropped. These work on any prop.
- **Switches:** all street lamps or all windows at once, or the houses' windows opening.
- **Face and impact effects:** star eyes, X eyes, a sweat drop, a splat, a held sign with big text.
- **The shadow monster.**
- **Light:** storm (night rain + lightning) and morning (a warm low sun).
- **Cameras:** wide / medium / two / close / insert / low / top, with the moves push_in / tilt_up / track / top_down /
  static.
