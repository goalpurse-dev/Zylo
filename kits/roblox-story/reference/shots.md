# The shot list (shots.json)

## Timing

The timing source comes from the voice step (`reference/voice.md`), best first:
- With a Zyvo voice (`words.json` from Zyvo → MCP Studio → Create voice): every shot starts on a word: `t0` = that
  word's start. Exact. The last shot ends at the last word's end + 0.3 s.
- With the user's own file (`voice.mp3` they made): line starts from the file's pauses (or the estimates scaled to the
  file's length). Say plainly that the cut points come from the pauses, not word timings.
- Without any voice: estimate 3.25 spoken words a second (the recommended pace), from the script. Say plainly that the cut points are
  estimates and that the voice made later must be timed again.
- About 50 cuts a minute (~1.2 s a shot), never more than 85 shots, plus 1-2 HOLDS of 4-6 s at the twist or the ending.
  The last 15 seconds are paced differently from the rest (longer holds after a fast run, or the other way round).
- Shots start on the first word of a sentence or on the key word.

## Framing rules

- **Every line shown literally.** The key noun or action of each line is on screen while it is said.
- **Mix:** at least 25% close-ups (close + reaction), at most 40% medium, 15-30% wide, about 10% inserts (a prop, a
  sign, the rule object up close).
- **Variety:** no location over 40% of the time; at least 4 locations for ~90 s; at most 2 close-ups in a row; never
  3 shots of one size in a row; the same setup (place + size + angle) at most twice; every new location opens wide.
- **Faces:** a readable face (front or three-quarter) in at least 60% of the shots and in every key shot (the rule
  line, the twist, the last line, the big reactions). Never a key line on the back of a head. Faces stay in the top
  two thirds (captions go in the bottom third).
- **Angles:** at least 35% not at eye level: low (a threat, power), high (loneliness, being small), top-down (crowds).
- **Lenses:** close-ups narrow (45-70) from further back; wides 18-28; mediums 30-40.
- **Moves:** most shots move; no move type over 40%; a slow push on emotion, a fast punch-in on a key word, a slow
  pull-out on the last shot. The twist shot gets a dolly zoom or a rack focus.
- **Shot 1** shows the rule as a big sign / banner / tag in the top third, readable in the first second. The rule
  object is in at least half of the shots, and every change of it is shown right away.
- **The cast:** the hero on screen in at least half the shots; a named character is shown clearly (face or full body)
  on the line that names them; nobody walks through anybody; walkers never cross between the camera and the subject.
- **Effects** (smoke, sparkles) go beside or behind a character, never over a face.
- **No empty shots:** every shot shows a character or the thing its line names.

## The file

```json
{
  "title": "The Nose That Honked",
  "leadIn": 3,
  "shots": [
    { "id": 1, "t0": 0.0, "t1": 1.6, "line": 1, "location": "street", "size": "wide", "angle": "low",
      "move": "push_slow", "spot": "street_sign", "lens": 24, "subject": "Mo", "key": true,
      "desc": "the big RULE sign over Main Street, Mo below it, nose honking",
      "actions": [ { "who": "Mo", "at": 0.2, "do": "walk", "to": "street_mark_2" } ] }
  ]
}
```

- `t0` / `t1`: seconds from the end of the lead-in (the voice's time). Shots touch: each `t0` is the previous `t1`.
- `size`: wide / medium / close / reaction / insert. `angle`: eye / low / high / top.
- `move`: static, push_slow, push_fast, pull_slow, orbit, track, whip, crash, handheld, dolly_zoom, rack_focus.
- `spot`: a camera spot (Part in `workspace.ZyvoStory.Spots`); `spotEnd` (optional) glides to a second spot.
- `lens`: mm (24 mm sensor height): the director turns it into Roblox's FieldOfView.
- `actions` (optional, times inside the shot): `walk` (to a spot / mark name), `face` (a name), `jump`, `show` /
  `hide` (an instance under `workspace.ZyvoStory`, for the rule object's changes). In Luau (`luau/shotlist.luau`)
  the key is written `["do"] = "show"` (`do` is a reserved word; the shot list writes it that way itself).
- **Show / hide is per named thing.** A part is visible only while nothing it sits in is hidden. Showing a whole
  statue does NOT show a plate inside it that is in `startHidden` or was hidden: that plate needs its own `show`.
  So a number that changes (40 → 41) is two plates inside the statue: `"num41"` in `startHidden`, then at the change
  `hide num40` + `show num41`.
- Before the Play run, check the file: every shot has a spot that exists, the times touch, the shares above hold.
  Fix what fails before recording.

## The rule object over a head, hollow sets

- A floating number, a plate or a thing on a head belongs INSIDE that character's statue model (or carries the
  attribute `RuleFor = "<statue name>"`); its parts carry `Rule = true`. The framer then keeps it inside the frame
  (a close-up pulls back or sits the face lower so the number fits) and fails a shot where it's cut.
- A set you film from INSIDE (a bus, a room, a shop, a car) that is one big mesh: set `Hollow = true` on its model or
  folder. The framer then tests its real shape instead of its bounding box (otherwise every camera inside it "is
  inside a part"). A mesh with a character's head inside its box counts as hollow by itself.

## The end card (Free and Starter plans)

When the end card is ON (SKILL.md step 8: the plan from `get_my_plan`; Zyvo not connected = ON), the LAST shot is the
end card: `{ "id": <n>, "kind": "endcard", "location": "endcard", "spot": "endcard", "size": "wide", "lens": 32,
"move": "push_slow", "t0": <the story's last t1>, "t1": <t0 + 2.0>, "actions": [] }`. Build its set first with
`luau/endcard.luau` (the cast lined up on a dark stage, the top third empty). The words "Made with Zyvo AI ·
tryzyvo.com" are NOT built in Studio: `scripts/add_captions.sh` (free) or Zyvo's finish draws them. The runtime of
the Play run then includes these 2 s. Off (Pro and higher): no end card shot.
