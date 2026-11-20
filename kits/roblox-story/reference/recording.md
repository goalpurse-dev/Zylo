# The Play run and the recording

## Before Play (Edit mode)

1. `luau/shotlist.luau` with this story's shots (ReplicatedStorage.ZyvoShots), with `leadIn = 4` and `roll = 90`.
2. `luau/install_director.luau` (installs the camera and life LocalScripts and the actions Script; only inside this
   unsaved place).
3. A dry check with `execute_luau`: `return require(game.ReplicatedStorage.ZyvoShots).shots[1].spot` and that every
   spot exists under `workspace.ZyvoStory.Spots`.
4. **The framing check (every shot, before any recording).** Replay each shot's camera move as the director does and
   check, at 11 moments of the shot: the camera is never inside or touching a visible part (a character, a prop, a
   wall, the ground); the shot's subjects are fully in the 9:16 frame with their hair or hat; no face is bigger than
   head-and-shoulders (head <= ~34% of the frame height); no face is cut by the frame edge; the main face sits in the
   upper third; the line to each subject's face is clear; the subjects face the camera (not their backs); no more than
   12% of the frame is covered by something right in front of the lens; the lower half is not one big flat surface.
   It also fails a shot when: sign text is cut by the frame edge; a glowing rule object covers a face; the world
   ends in view (a ray below the horizon meets nothing: add far ground / hills with `luau/backdrop.luau`); a WIDE is
   more than 40% bare ground (pack it: buildings, dressing, people); a prop fills the frame with no character in it
   while the line isn't about that prop (set the shot's `object` only when the line names it, else show a
   character); a character marked foreground hides the subject's face.
   Fix every failing shot (pull back, raise, change the angle or the lens, or change the move) and check again.
   Then MODE "story" once: every monster in the shot list's `monsters` is seen at its reveal, hinted before it, and
   in the last shot of a callback ending (`reference/shots.md` "Monsters on screen"). It must pass before approval.
   How: `luau/frame_check.luau` (needs `ZyvoFramer` installed, reference/setup.md step 4). Fill its PLAN from
   shots.json (each character spot: its subjects and size), run MODE "check" in batches of ~20 shots, then MODE
   "solve" for the failing close/medium spots (8 a call), then "check" again until every shot passes. Wide spots and
   the spots "solve" can't fix: move them by hand (a new spot position/target/lens) and check again.
5. **The contact sheet (fast: about 4 minutes for 65 shots).** A 9:16 still of every shot at its middle moment, in
   the scene state of that moment (who is shown or hidden), tiled with the shot number, time and line. Two passes,
   never more:
   - **Pass 1, capture everything without stopping.** `execute_luau`: `require(<clone of ZyvoPreview>).plan()`. It
     lists the stills in the fastest order: shots that share a spot, lens and scene state reuse ONE still
     ("REUSE"), and a `preview(K, 0.5)` call ("PREP K": sets the scene state, the lens, clears the selection) is
     needed only when the state or the lens changes. Then, line by line: for "PREP K" one `execute_luau`
     `preview(K, 0.5)`; for "CAP K" one `screen_capture` from the given position looking at the given point. Don't
     stop to judge, fix or comment on single stills in this pass, don't reset the editor camera between stills, and
     say only one line every ~15 stills ("Stills 30 of 52."). Note each still's image file (the capture's tool
     result names it). At the end: `restore()` once.
   - **Tile it:** write `zyvo-project/<slug>/sheet.tsv` (per shot: number, its image file or the reused shot's,
     "#K t0-t1s", the line's first words) and run `scripts/contact_sheet.sh zyvo-project/<slug>/sheet.tsv
     zyvo-project/<slug>/screenshots/sheet` (crops each still to its centre 9:16, 8 a row, 24 a sheet). Look at the
     sheets, list EVERY problem at once (framing, glow, empty corners, gizmos, cut text), fix them all in one batch,
     run the framing check on the changed shots only.
   - **Pass 2, only the changed shots:** `plan({ <the changed shot numbers> })`, capture those, re-tile. Shots that
     already passed are never captured again.
   The capture is the centered 9:16 crop: when the image is narrower than 9:16, set the FieldOfView to
   `ZyvoFramer.cropFov(<the shot's vertical fov>)` after each PREP.
6. **Text check on the sheet.** Every number, label and sign in the stills reads upright and whole (not cut by the
   frame, not two numbers on top of each other). Floating labels (BillboardGuis) are turned for the rolled camera by
   the Play run itself (runtime/ZyvoCamera: it turns each one 90 degrees clockwise with width and height swapped), so
   they look upright here in Edit and upright in the final video. Don't turn them by hand in the place (that would
   turn them twice); a label that must not be turned gets `ZyvoNoTurn = true`. Sign text on a part (SurfaceGui)
   turns with the world and needs nothing.

## The view: no phone emulator (the user clicks; guide them)

The phone emulator makes the viewport small and cuts it off. Instead the camera is ROLLED 90 degrees, so the tall
9:16 picture fills Studio's normal wide viewport, and the recording is turned upright and cropped afterwards.

1. **Test** tab > **Device**: choose **None** / turn the emulator off (the viewport is a normal wide rectangle).
2. Maximize the Studio window (double-click its title bar). Close the panels around the viewport (Explorer,
   Properties, Toolbox, Output, Assistant), or View > uncheck them, so the viewport is as big as possible.
3. Graphics: File > Studio Settings > Rendering > **Quality Level**: a fixed high level (not Automatic), so the
   quality doesn't drop mid-take.
4. The picture will look sideways in Studio during Play: that's expected.

## Recording (the user)

- Windows: Xbox Game Bar (Win+G): Settings > Capturing > turn OFF "Capture audio when recording a game", frame rate
  60 fps, video quality High. Win+Alt+R starts and stops. Or OBS with a Window Capture of Studio and no audio sources.
  macOS: Cmd+Shift+5 > Options > Microphone: None; record the Studio window.
- Recording the whole Studio window is fine: the crop script finds the viewport itself.
- **Do not disturb first.** Before recording, ask the user to turn on Windows **Do not disturb** (Win+N > Do not
  disturb, or Settings > System > Notifications > Do not disturb) or macOS Focus > Do Not Disturb, so no pop-up
  (mail, chat, Claude's own notifications) lands in the recording.
- Start recording, THEN say "ready". You start Play with `start_stop_play`. The run: ~3 s black, a half-second
  MAGENTA flash (the sync marker), 1 s of black, the story (with the end card when it's on), then 1.5 s of black.
  Don't move the mouse into the viewport.
- **No gizmos.** Right before Play: `execute_luau` `game:GetService("Selection"):Set({})` (move / rotate arrows and
  selection boxes would show in the recording).
- **Silent while Play runs.** Before starting Play, say everything you need to say (one line: "Recording starts now;
  I'll be quiet until it ends."). Then start Play and wait silently INSIDE Studio for the whole run: one
  `execute_luau` on the Server data model (`datamodel_type` "Server") with
  `local t = os.clock(); task.wait(<lead-in + runtime + tail + 3>); return os.clock() - t` (a run over ~110 s: two
  such waits back to back). A foreground `sleep` / `Start-Sleep` can be blocked by the app; never use a background
  task, a timer, polling, Monitor or a scheduled wake-up instead, and send no messages and no other tool calls until
  the wait ends. Then stop Play (`start_stop_play`) and tell the user to stop recording.
- The camera hides every Roblox UI it can (core UI, top bar, touch controls). The Roblox menu button in the
  viewport's corner can't be hidden; the 9:16 crop cuts it off, and no face or sign is framed in that corner.

## After (free, local)

- Ask for the file's path. Run `scripts/make_vertical.sh <recording> <runtime> <out.mp4> [voice.mp3]`: it finds the
  magenta marker, measures the viewport, crops, turns the picture upright, crops the 9:16 frame, scales to
  1080x1920 at 30 fps and trims it to start exactly at the voice's second 0 (marker + 1.0 s). With the voice it also
  writes `<out>_with_voice.mp4` for a quick check by ear and eye.
- Check: the output lasts the script's runtime (with the end card: + its 2 s); take 4-6 frames from it and look at
  them. In those frames every number and sign reads upright (not lying on its side); if one is sideways, stop and
  fix the place before anything else (it never fixes itself in post).
- **The free captioned video (postable):** run
  `scripts/add_captions.sh <out.mp4> zyvo-project/<slug>/voice.mp3 <timings> zyvo-project/<slug>/final_free.mp4`,
  where `<timings>` is `words.json` when it exists (a Zyvo voice: exact), else `narration.txt` (the exact text the
  voice reads: the script lines up the words with the voice's pauses; most land within a quarter second). It burns in
  simple white one-word captions (one word at a time, bold, black outline) and lays the voice under the picture.
  Take 3 frames where words are on screen and check one against the voice by ear. Tell the user plainly: the
  captions are simple on purpose; if a word sits visibly early or late, say so and offer the Zyvo finish.
- If the playback stuttered (Studio dropped frames), suggest: lower graphics quality, closing other apps, then
  record again.
- Remind: don't publish or Save to Roblox. A local File > Save to File copy is fine if they want to come back.
- Then: "Want our voice, coloured captions per speaker, sound effects and music? Finish in Zyvo."
