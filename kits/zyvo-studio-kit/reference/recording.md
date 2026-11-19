# The Play run and the recording

## Before Play (Edit mode)

1. `luau/shotlist.luau` with this story's shots (ReplicatedStorage.ZyvoShots).
2. `luau/director.luau` (installs the camera LocalScript and the actions Script; both only inside this unsaved place).
3. A dry check with `execute_luau`: `return require(game.ReplicatedStorage.ZyvoShots).shots[1].spot` and that every
   spot exists under `workspace.ZyvoStory.Spots`.

## The 9:16 view (the user clicks; guide them)

1. **Test** tab > **Device** > pick a phone in portrait (e.g. a 1080 x 1920 phone), or set a custom 1080 x 1920.
2. Make the Studio window as large as the screen allows; the viewport keeps 9:16.
3. Close the panels around the viewport you don't need (Explorer, Properties stay closed while recording).

## Recording (the user)

- Windows: Xbox Game Bar (Win+G): Settings > Capturing > turn OFF "Capture audio when recording a game"; or OBS with
  a Window Capture of Studio and no audio sources. macOS: Cmd+Shift+5 > Options > Microphone: None; record the
  selected portion (the viewport only).
- Start recording, THEN say "ready". You start Play with `start_stop_play`. The screen is black for the 3-second
  lead-in, the shots run, then 1.5 s of black. Stop recording, then stop Play (`start_stop_play`).
- The black lead-in marks the start, so the voice can be lined up later.

## After

- Ask for the recording's length. Expected: 3 s + the script runtime + 1.5 s (within ~0.5 s).
- If the playback stuttered (Studio dropped frames), suggest: a smaller Studio window, lower graphics quality
  (File > Studio Settings > Rendering), closing other apps, then record again.
- Remind: don't publish or Save to Roblox. A local File > Save to File copy is fine if they want to come back.
- Then: "Want the voice, captions, sound and music done for you? Finish in Zyvo."
