# The shot list (shots.json)

## Timing

- With a Zyvo voice (word timings JSON): every shot starts on a word: `t0` = that word's start. Exact.
- Without one: estimate 4.3 spoken words a second, from the script; the user reads the script aloud later or Zyvo
  times it. Say plainly that the cut points are estimates.
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
  `hide` (an instance under `workspace.ZyvoStory`, for the rule object's changes).
- Before the Play run, check the file: every shot has a spot that exists, the times touch, the shares above hold.
  Fix what fails before recording.
