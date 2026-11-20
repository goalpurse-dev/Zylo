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
   Fix every failing shot (pull back, raise, change the angle or the lens, or change the move) and check again.
   How: `luau/frame_check.luau` (needs `ZyvoFramer` installed, reference/setup.md step 4). Fill its PLAN from
   shots.json (each character spot: its subjects and size), run MODE "check" in batches of ~20 shots, then MODE
   "solve" for the failing close/medium spots (8 a call), then "check" again until every shot passes. Wide spots and
   the spots "solve" can't fix: move them by hand (a new spot position/target/lens) and check again.
5. **The contact sheet.** Render a 9:16 still of EVERY shot at its middle moment, in the scene state of that moment
   (who is shown or hidden), tile them with the shot number, time and line, and show it to the user. Fix what reads
   badly. The still must be the centered 9:16 crop of the capture (set the FieldOfView so the crop shows the shot's
   real lens). Take the captures one at a time, and reset the editor camera after each.
   How, per shot K: `execute_luau` `require(<clone of ZyvoPreview>).preview(K, 0.5)` (sets the scene state and the
   lens), set `workspace.CurrentCamera.FieldOfView` to `ZyvoFramer.cropFov(<the shot's vertical fov>)`,
   `screen_capture` with the spot's position and its Target attribute, crop the centre 9:16 of the image, then
   `preview.restore()` at the end. Tile the stills (6 a row) with ffmpeg or any image tool, label each with
   "#K t0-t1 + the line's first words", and show the sheet.

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
- Start recording, THEN say "ready". You start Play with `start_stop_play`. The run: ~3 s black, a half-second
  MAGENTA flash (the sync marker), 1 s of black, the story, then 1.5 s of black. Don't move the mouse into the
  viewport. Stop recording at the end, then stop Play (`start_stop_play`).
- The camera hides every Roblox UI it can (core UI, top bar, touch controls). The Roblox menu button in the
  viewport's corner can't be hidden; the 9:16 crop cuts it off, and no face or sign is framed in that corner.

## After (free, local)

- Ask for the file's path. Run `scripts/make_vertical.sh <recording> <runtime> <out.mp4> [voice.mp3]`: it finds the
  magenta marker, measures the viewport, crops, turns the picture upright, crops the 9:16 frame, scales to
  1080x1920 at 30 fps and trims it to start exactly at the voice's second 0 (marker + 1.0 s). With the voice it also
  writes `<out>_with_voice.mp4` for a quick check by ear and eye.
- Check: the output lasts the script's runtime; take 4-6 frames from it and look at them.
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
