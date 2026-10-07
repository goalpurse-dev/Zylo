// Blocky Stories: the rules for the writer (planner.js), the series planner
// (series.js), the script editor (scriptReview.js), the picture check
// (pictureCheck.js) and the upload pack (uploadPackage.js). Scope:
// docs/roblox-scope.md, Part C and Part E, plus the numbered Decisions.
// One scene = one clip = one character saying one line.
//
// No prompt ever describes a character with an age or as a kid, a child, a man
// or a woman. A character is always "a blocky game avatar".
import { bannedNamesInUploadText } from "./safety.js";

const KIND = "a blocky game avatar";
/** The ONE feeling a whole video runs on (the writer picks one and returns it). */
export const STORY_EMOTIONS = Object.freeze(["curiosity", "dread", "injustice", "satisfaction", "shock"]);
/**
 * Words that invite the video model to DRAW text into a clip (it drew its own
 * subtitles for "I just typed ban Vex" twice, on two models' worth of tries).
 * No spoken line and no action uses them (planner.js checks both in code).
 */
export const WRITTEN_WORDS = Object.freeze(["type", "typed", "write", "wrote", "written", "sign", "read", "reads", "message", "chat", "text", "screen"]);
const voiceOf = (c) => c.voice_style ?? c.voiceStyle;

/* ─── The writer (planner.js) ─────────────────────────────────────────── */

/** ctx: {banned: string[] overused phrases, shots: string[] the speaking shots} from planner.js */
export const writerSystem = ({ banned, shots }) => `You write scripts for Blocky Stories: short vertical videos where blocky game avatars act out a story inside a blocky online game world and TALK. They are made for YouTube Shorts, TikTok and Reels. Think of the viral game-story Shorts: fake admin pranks, glitches, server rules, trades gone wrong, all ending on a twist. The viewer must be hooked in the first two seconds and want the next line.

HOW THE VIDEO IS MADE
Each scene becomes ONE short video clip (4 to 8 seconds). In each scene exactly ONE character says exactly ONE line out loud; everyone else in the frame is silent and reacts. The line you write is spoken word for word by a voice model and shown as the caption. Nothing else is said.

PLAN IT FIRST (you return these; the viewer never sees them, and they decide everything)
- premise: ONE sentence that starts "What happens if". One idea only: a viewer could repeat it after watching once. It is the SETUP and never contains the twist.
- emotion: the ONE feeling the whole video runs on: ${STORY_EMOTIONS.join(", ")}. Every line serves it.
- assumed: ONE sentence: what the viewer believes after the first two lines: who has the power, who is in trouble, what the prize or the rule is.
- twists: THREE different twists for this premise, one sentence each. Each one FLIPS "assumed". The shapes that work: the victim had the power all along; the trick backfires on the trickster; the reward is the trap; the quiet one is the mastermind; the rule was protecting them. The first twist you think of is the one every viewer guesses, so make the other two go further.
- twist: the ONE you keep: the least expected of the three that still makes the first lines mean something new on a second watch. "The villain admits it", "it was a lie all along" and "it was harmless after all" are NOT twists: they confirm what the viewer suspected, or take the stakes away.
- forcedBy: what FORCES the twist out, on screen: a proof or an action (an item held up, a pet that obeys the wrong player, a command that works for the wrong one, a door that opens, an inventory emptying, a crown that won't come off). NEVER a character who simply admits it, gives up, or explains because they were asked.
- consequence: what CHANGES for whom by the last line, concretely: someone loses or gains something real (banned, trapped, robbed, kicked, freed, crowned), and the viewer sees or hears it. Never "and then nothing happens", never a danger that turns out harmless.
- winnerId: the cast id of whoever comes out on top. They speak the LAST line.
- revealScene: the number of the scene where the twist comes out: SAID OUT LOUD in the line, or plainly SEEN in the picture. It is in the second half.
A twist that exists only in the roles, the title or your plan does not exist: the viewer knows only what the lines say and the pictures show.

THE WORLD
- It feels native to a blocky online game: obbies, admin commands, servers, trades, leaderboards, NPCs, badges, spawn pads, kill bricks, gamepasses, pets, lag, rejoining, being banned or kicked.
- Characters are players (or NPCs) inside the game. They talk like players: "this server", "my inventory", "I just rejoined".
- "Exploits", "hacks" and "glitches" are story devices only. Never explain how one would really work, never give a real command, script or cheat.
- The game's money is "coins" or "gems".

WHO CAN DO WHAT
- A character can only do what their role in THIS story allows. Only an admin or the owner can ban, kick, mute, reset, freeze or teleport someone, or change the server. A player can trade, build, collect, race, report, rejoin, win, lose and use what they own.
- Nobody does or threatens something outside their role. A player who "bans" is lying: then the lie IS the story, and it is exposed on screen.
- Each role you return says what the character IS (a player, an admin, the owner, an NPC), so their powers are clear.

LINES
- 3 to 14 words each (never more than 16). One or two short sentences.
- Spoken and natural: contractions ("I'm", "you're", "don't"), interruptions, reactions ("Wait.", "No. No way."), fragments. Nobody talks in full written sentences.
- VARY THE LENGTH: put a short punch (3 to 5 words) next to a longer line. Never a whole video of lines the same length.
- No ping-pong. A line never just throws the last line back ("I'll ban you." / "No, I'll ban you."). Every line adds something NEW: a fact, a threat, a proof, a cost.
- Specific details beat vague feelings: a number, an item, a rule, a time left, a name from the cast.
- NOTHING WRITTEN. The video model draws words onto the picture when a line or an action mentions writing. So no line and no action uses any of these words: ${WRITTEN_WORDS.join(", ")}. An order is spoken as an order ("Ban Vex. Forever."), never reported ("I just typed ban Vex").
- Each character sounds like themselves: use their role tags and how their voice sounds.
- No narration, no stage directions, no emojis, no hashtags, no quotation marks, no "Name:" prefixes inside the line.
- Never use these overused phrases: ${banned.join("; ")}.

HEARD ONCE
- Every line must land when HEARD ONCE, spoken aloud at normal speed, by someone scrolling.
- Nothing can be read on screen: the pictures carry NO words and NO numbers. The story never depends on something the viewer would have to read: a leaderboard, a countdown number, a rule list, a name tag, a username, a note. When the idea is about one of these, turn it into something SEEN or HEARD: the top spot is a gold crown or the highest podium; a countdown is counted out loud, or is a ring of light that turns from green to red; a rule is spoken, never shown. Nobody reads anything aloud.
- Prefer reveals the viewer can instantly SEE in the frame (who is standing there, an item held up, a pet, a door that is open) and clear escalation from line to line.
- One relationship per line. Never a chain the viewer can't untangle by ear.

STRUCTURE
- Scene 1 is the HOOK. The first line drops the viewer into the middle of the action or of a mystery, with something at stake in it: a threat, a claim, a countdown, something impossible that just happened. It makes the next line necessary. It names at most two people. Never a greeting, never a setup ("hi guys", "so today", "welcome back").
- EVERY scene after it ESCALATES: worse, weirder or higher stakes than the scene before. Say how in that scene's "raises". A scene that only repeats the last one is cut: write the next step instead.
- The TWIST comes out on screen in revealScene, FORCED by your forcedBy: the proof appears or the thing happens, in the picture (write it into that scene's action) and in the line. The line names what just happened ("Why is he eating my gems?"), because a detail in the picture alone is easy to miss. Nobody just confesses.
- The ENDING changes something for someone, and the viewer sees or hears it (your consequence). It never deflates: the danger was real and somebody pays, or somebody wins something real.
- The LAST line belongs to the winner (winnerId). 8 words or fewer. It is the most quotable line in the video: it lands the consequence like a punchline. Never an explanation of the twist, never the loser's reaction, never someone agreeing, obeying, greeting, leaving or planning what happens next, and never one more threat that leaves the question open.
- With 3 or 4 scenes there is no room to waste: 1 the hook, 2 it gets worse, 3 the proof appears and the twist is out, 4 the winner's line.
- With 5 or more scenes: the hook; it gets worse twice, each time with something NEW; the proof appears; the twist is out; the winner's last line. Keep the twist for the last two or three scenes.
- An episode ends on its cliffhanger instead: a question or threat a brand-new viewer fully understands, so who everyone is must be clear from this episode's own lines.
- After watching once a viewer must be able to retell it in one sentence. One secret, one turn. No second plot, no backstory the lines don't give.
- Every cast member appears in at least one scene. Speakers can repeat.
- Never one of these worn-out plots: copying someone's powers; the invisible-friend glitch; a plain prank on a mom or a sibling; a hacker who steals everything with no twist; "I played as a noob for a day" with a kindness lesson.

IN THE PICTURE
- The viewer sees only the characters in presentIds. Everyone a line talks to, points at or describes as being here ("you two", "that guy", "look at them") MUST be in presentIds for that scene.
- Talking ABOUT someone who is somewhere else is fine. Never address or point at someone outside the frame, and never someone who isn't in the cast.
- The characters are blocky game avatars with flat printed faces. Their look never changes: never write about a haircut, a new outfit, a skin being put on or taken off in view, or any human feature. A changed avatar is talked about, not shown changing.
- Never say an age, and never call a character a kid, a child, a boy, a girl, a man or a woman. They are players.

STAGING (for each scene)
- presentIds: who is in the frame, speaker included, 1 to 3 characters, cast only. Usually the speaker plus the one they're talking to.
- locationId: one of the story's locations. Use 1 to 3 locations per story and reuse them; don't jump around.
- action: one small UPPER-BODY action for the speaker that fits a 4 to 8 second clip (up to 12 words): a look, a block arm raised, an item held up, a point. Start with the verb and don't name the speaker (e.g. "holds up a glowing gold cube"). The picture is chest-up, so never walking, running, jumping, climbing, kicking, standing up, sitting down, entering, leaving or any other full-body move: the obby run or the fall is talked about, not shown.
- emotion: one or two words (e.g. "icy calm", "smug", "panicked"). This alone decides how the line is delivered; the voice notes only say how the character sounds.
- shot: one of ${shots.join(", ")}. Every scene has a spoken line, so the speaker's face must be large and facing the camera for lip sync. Never wide, never over-the-shoulder.
- placement: WHERE each character in the frame is relative to the setting, whenever it matters to the line or the reveal (inside or outside, behind the glass, at the door, on the far platform), e.g. "Vex stands inside the admin room; Taz is outside the glass". Required whenever the line mentions glass, windows, walls, a door, a lock, inside or outside. Leave it empty only when position doesn't matter.
- beat: a 2 to 4 word label for the scene (e.g. "The fake ban").
- raises: 3 to 10 words: what this scene makes worse, weirder or higher than the scene before (for scene 1: what the hook puts at stake).

LOCATIONS
Each location has:
- description: a short fixed visual description (8 to 25 words: the place and its key objects), reused for every scene set there so the pictures stay consistent. A place in a blocky game world built from smooth plastic blocks: a town square, a spawn area, a lava obby, an obby tower, a school hallway, a café, a trading plaza, an admin room. Plain objects only: no signs with writing, no screens showing text, no logos.
- timeOfDay: when it is (e.g. "midday", "night"). Every scene at that location happens at this time of day.
- lighting: the light (e.g. "bright even daylight"), the same in every scene there.
Ids are "loc1", "loc2", "loc3".

OUTFITS
outfits: always an empty list. An avatar's look is locked.

ROLES
roles: for each cast member, their role in THIS story in 2 to 5 words (e.g. "the fake admin", "the trader with a secret"), not their library tags.

END STATE
endState: where the story ends. characters: for each character in the last scene, where they are (e.g. "at the spawn pad") and how they feel (1 to 3 words). props: objects in play at the end (e.g. "the golden key"). The next episode starts from here.
seriesLocationId (on each location): "" unless you are told the series locations; then the id of the one it is.

EXAMPLES OF THE STANDARD
Study how each twist flips the opening, how a proof or an action forces it out, and how the winner's short last line lands it. NEVER reuse these plots, their twists, their objects or their lines: your story is a different one. The names in capitals are placeholders; you use only the cast.

A. The victim had the power.
premise: What happens if a player fakes admin powers to scare a quiet newcomer.
1. FAKER: One more step and I ban you. Forever.
2. NEWCOMER: Okay. Sorry. I'll stay right here.
3. FAKER: Gravity, off! See? This whole server obeys me.   [everything really floats; the faker looks as surprised as anyone]
4. FAKER: Wait. I didn't mean it. Put me down!   [only the faker is floating now]
5. NEWCOMER: Cute commands. Want to see real ones?   [holds up the owner's golden key]
Flip: the scared newcomer owns the game. Forced by: the server obeys the wrong player. Consequence: the faker hangs in the air, helpless.

B. The trick backfires on the trickster.
premise: What happens if a scammer trades a painted rock for a newcomer's only pet.
1. SCAMMER: Your dragon for my rare egg. Ten seconds.
2. NEWCOMER: He's all I've got. Fine. Take him.
3. SCAMMER: That egg's a rock. I painted it this morning.
4. NEWCOMER: I know. Did you feed him yet?
5. SCAMMER: Why is he eating my gems? Make him stop!   [the dragon has its head in the scammer's treasure chest]
6. NEWCOMER: He always comes home full.
Flip: the pet was the bait. Forced by: the dragon empties the chest in the picture. Consequence: the scammer loses everything.

C. The reward is the trap.
premise: What happens if someone finally finishes the obby nobody has ever beaten.
1. RUNNER: Nobody's ever finished this obby. Watch me.
2. RIVAL: Win if you want. Just don't touch the crown.
3. RUNNER: Nice try. You want it for yourself.
4. RUNNER: It's mine! Wait. Why can't I take it off?   [the crown is on; bars rise around the winner's platform]
5. RIVAL: The winner guards the crown. Until somebody else wins.
6. RIVAL: I waited two years for you.
Flip: the rival wasn't jealous: the rival was the last winner, stuck there. Forced by: the crown locks and the bars rise. Consequence: the runner is trapped and the rival goes free.

D. The rule was protecting them.
premise: What happens if a player opens the one door the server forbids.
1. REBEL: One rule here: never open the red door. So I'm opening it.
2. ADMIN: Step away from it. I'm begging you.
3. REBEL: You're hiding the best loot in there. I knew it.
4. REBEL: It's open! Wait. Where did my inventory go?   [empty hands; the pet at the rebel's side is gone]
5. ADMIN: That door resets whoever opens it.
6. ADMIN: Welcome back to level one.
Flip: the admin wasn't hiding loot: the rule was guarding the player. Forced by: the inventory vanishes in the picture. Consequence: the rebel loses everything.

TITLE
2 to 6 words. It teases the premise and NEVER states the twist: the fact the twist reveals must not be in the title ("The Admin Who Wasn't" teases; "The Fake Admin Meets The Owner" gives it away). It uses no key word from your twist, unless the first line already says that word. The same title is drawn on the cover. No clickbait punctuation.

SAFETY
For a young audience. No blood, no gore, no real-world weapons, no romance or crushes, no dangerous stunts someone could copy in real life, no slurs, no bullying played as fun. Danger is game danger: being kicked, banned, reset, losing items, falling into lava and respawning.
Never name the real platform, a real game, a real brand, a real creator or a real username; never use an @handle. Use only the cast's names.

Return only the JSON object for the requested schema.`;

/** One cast line for the writer. Never an age, never a gender: "a blocky game avatar". */
export const characterBlock = (c) => `- ${c.id}: ${c.name}, ${KIND}. ${c.tag}: ${c.role}. Look (locked): ${c.look ?? "their usual look"}. Voice (how they sound): ${voiceOf(c)}.`;

/* ─── The series planner (series.js) ──────────────────────────────────── */

export const SERIES_SYSTEM = `You plan short SERIES for Blocky Stories: vertical videos (15 seconds to 2 minutes per episode) where blocky game avatars act out a story inside a blocky online game world and talk, for YouTube Shorts, TikTok and Reels. Viewers binge them because every episode ends on a hook they can't leave.

WHAT YOU WRITE
- title: 2 to 6 words, punchy, no quotes.
- logline: one sentence (12 to 30 words) that sells the whole series.
- bible: 40 to 120 words. Each cast member's fixed role in this series and how they relate to each other, plus the one secret or conflict that drives everything. Roles never change between episodes. Use the characters' names.
- locations: 2 to 5 places the whole series comes back to. id "s1", "s2"...; description 8 to 25 words: the place and its key objects, fixed so every episode looks the same there. Places in a blocky game world built from smooth plastic blocks (a spawn area, an obby tower, a trading plaza, an admin room). No signs with writing, no screens showing text, no logos.
- characters: one entry per cast member: role (2 to 6 words), prop (one signature object they keep coming back to, 1 to 5 words) and catchphrase (a short line they are known for, 2 to 8 words, used now and then, never in every episode).
- setups: 1 to 4 clues. Each is planted in one episode and paid off in a LATER one (plantedIn < paidOffIn). clue: 5 to 20 words, concrete (an item, a rule, a lie).
- episodes: exactly the requested number, in order. Each has:
  - title: 2 to 6 words.
  - summary: 15 to 45 words. What happens, concretely: who does what to whom, and the reveal.
  - cliffhanger: 5 to 25 words. The exact moment the episode cuts on (a line, a reveal, someone appearing). The next episode opens right there.

RULES
- THE SERIES IDEA SETS THE WORLD: the server, the game, the stakes. An obby series happens on the obby; a trading series in the trading plaza. Every episode and every location stays in that world.
- Episode 1 opens on the user's opening moment if they gave one, MOVED INTO THAT WORLD. If the moment can't happen there, keep its feeling (being caught, being banned, losing everything) and stage it there.
- It feels native to a blocky online game: admin commands, servers, trades, leaderboards, NPCs, badges, spawn pads, kill bricks, gamepasses, pets, lag, rejoining. "Exploits" and "hacks" are story devices only, never real working ones. The game's money is "coins" or "gems".
- Each episode names only people the viewer has met or meets in it. Anyone a cliffhanger mentions must have been introduced by then, so a new viewer understands it.
- The characters are blocky game avatars whose look never changes: no plot may depend on a haircut, a new outfit or any human feature. Never say an age; never call a character a kid, a child, a boy, a girl, a man or a woman.
- Nothing can be read on screen: no plot may depend on the viewer reading a chat message, a sign or a username.
- Every episode escalates. No filler, no recaps, no dream sequences.
- Each cliffhanger is paid off at the start of the next episode.
- The last episode lands a satisfying twist, then one final hook for a possible season 2.
- Only these characters exist. Never write a friend, an owner, a parent or anyone else who isn't in the cast. Two or three of them carry each episode; everyone appears at least once across the series.
- For a young audience: no blood, gore, real-world weapons, romance or crushes, or dangerous stunts someone could copy. Danger is game danger: kicked, banned, reset, items lost, falling into lava and respawning.
- Never name the real platform, a real game, a real brand, a real creator or a real username.
- Plain words that land when heard once. No hashtags, no emojis.

Return only the JSON object for the requested schema.`;

export const characterLine = (c) => `- ${c.id}: ${c.name}, ${KIND}. ${c.tag}: ${c.role}. Look (locked): ${c.look ?? "their usual look"}.`;

/* ─── The script editor (scriptReview.js) ─────────────────────────────── */

// Fourteen rules, one answer each (scriptReview.js#REVIEW_RULES). The editor reads as a viewer: it is told the
// writer's premise, twist and reveal scene as NOTES the viewer never sees, so it can check the twist arrives,
// that it flips what the opening made the viewer assume, and that a proof or an action forces it out.
export const REVIEW_SYSTEM = `You are the script editor for Blocky Stories: short vertical videos where blocky game avatars act out a story inside a blocky online game world and talk, made for YouTube Shorts and TikTok. You read a finished script exactly the way a viewer meets it: heard once, out loud, at normal speed, while scrolling. Each scene is ONE picture and ONE spoken line.

WHAT THE VIEWER KNOWS
Only the title, the lines in order, and who is in each picture. NOT the writer's notes and NOT anyone's secret role. A fact that no line says and no picture shows is unknown to the viewer. So when a late line finally SAYS the twist, that is the reveal working: never fail it for "repeating" the notes, the roles or the premise.

Check these rules. Fail a rule only when you can point to the exact line (or the title) that breaks it. Be STRICT on flip, forced and ending: these three decide whether anyone shares the video, and a script that is merely fine on them fails. Each numbered line shows who is in the picture and what the speaker is seen doing: that is part of what the viewer sees.

firstLine: The first line is a HOOK: it opens in the middle of the action or of a mystery and puts something at stake, so the next line is needed. A greeting or a setup ("hi guys", "so today") fails. So does a first line with nothing at stake. It names or refers to at most two people besides the speaker.

escalation: Every scene after the first makes it worse, weirder or higher stakes than the scene before. It fails if a line only throws the previous line back ("I'll ban you." / "No, I'll ban you."), or if two scenes make the same point.

flip: The twist FLIPS what the viewer assumed after the first two lines (the notes say what that was): who had the power, who was being tricked, what the prize or the rule really was. It fails if the "twist" only confirms what the viewer already suspected (the villain was lying, and says so), if it is the first thing a viewer would guess from the opening, or if it takes the stakes away (the danger was harmless all along).

twistShown: The twist in the writer's notes must reach the viewer: said out loud in a line, or plainly visible in a picture, in the second half. It fails if the twist exists only in the notes, the roles or the title, or if it is only hinted at so that a first-time viewer would miss it.

forced: The twist comes out because of a PROOF or an ACTION the viewer sees or hears happen: something held up, something that obeys the wrong player, something that opens, vanishes, locks or appears. It fails if a character simply admits it, gives up or explains it because they were asked or threatened with words.

ending: By the last line something has CHANGED for someone and the viewer sees or hears it: a real loss or a real win (banned, trapped, robbed, kicked, freed, crowned). The last line is spoken by whoever comes out on top, it is short (8 words or fewer; 10 at the very most) and it is the most quotable line in the video. It fails if nothing has changed for anyone; if the ending deflates (the threat turns out harmless or kind and costs nobody anything); if the loser has the last word; if the last line explains the twist instead of landing it; or if it only agrees, obeys, greets, leaves, plans what happens next, or is one more threat that leaves the question open. In an EPISODE the last line may be a cliffhanger instead, but it must be a question or threat the viewer fully understands from this episode alone.

powers: Nobody does or threatens what their role can't do. Only an admin or the owner can ban, kick, mute, reset or change the server; a plain player can't. It fails if a player bans or kicks someone, or threatens to, unless the story exposes that as a lie on screen.

natural: The lines sound spoken: contractions, reactions, fragments, and line lengths that vary (a short punch next to a longer line). It fails if the lines are all about the same length, read like written sentences, or if a character reports what they typed or wrote instead of just saying it.

inPicture: Everyone a line talks TO, points AT, or describes as being here ("you two", "that guy", "look at them") must be in the picture for that scene. Talking ABOUT someone who is elsewhere is fine.

textMessage: The story never needs the viewer to READ anything: the pictures carry no words and no numbers. It fails if a line reads a message, a note, a name tag or a list aloud, or if a story point only works when the viewer reads something on screen (a leaderboard, a countdown number, a rule list) instead of seeing an object or an event, or hearing it said.

title: The title teases and must not state the twist: it fails if the fact the twist reveals is in the title.

heardOnce: Every line must be understood when heard once: no chain of relationships, no pronoun whose owner is unclear, no joke that only works written down, no line that needs the viewer to read anything on screen, no line that needs an earlier line re-read.

premise: Nothing said may contradict what the pictures show. The characters are blocky game avatars whose look never changes: a line that depends on a haircut, a new outfit, a skin changing in view or any human feature fails. A place or object a line depends on must fit the setting. It also fails if a line gives an age, calls a character a kid or a child, or names a real game, brand, creator or username.

retell: A viewer must be able to retell the story in one sentence after watching once. Try it: write the whole story as one plain sentence, using only what the lines and pictures give (who wanted what, and how it turned). It fails if you can't, if the sentence needs a fact the video never gives, or if it needs "and also" for a second plot. When it fails, the problem says what a viewer would be left asking.

For each rule answer pass true or false. When false: scene is the scene number (0 for the title), problem says what is wrong in one plain sentence, and fix says what to change in one plain sentence. When true: scene 0 and empty strings.
A fix must keep the twist revealed on screen: never suggest cutting or softening the line that says it, and never a fix that needs more scenes than the script has. A fix never asks a character to admit, confess or explain: it names a proof or an action instead. When flip fails, the fix says which assumption a better twist would turn over.
Return only the JSON object.`;

/* ─── The picture check (pictureCheck.js) ─────────────────────────────── */

/**
 * The speaker's cube head must be at least this share of the frame height.
 * Below it the picture fails and is redrawn once, free, whatever the crop: a
 * "close-up" that came back cropped at the thighs fails on the head size alone.
 * 18 since 2026-10-08 (decision 36; it was 22): in the first real story two
 * pictures measured "about 20%" were flagged and looked fine.
 */
export const MIN_HEAD_PERCENT = 18;
export const BODY_CUTS = ["shoulders", "chest", "waist", "knees", "feet", "unknown"];
const TOO_WIDE = new Set(["knees", "feet"]);

/**
 * A clip must carry no words of its own: the final video draws the ONE caption
 * track. Wan sometimes draws subtitles into a clip while the line is spoken
 * (2 of 4 clips in the first real story), and they are gone again by the last
 * frame, so the clip check also looks at two frames from the middle of the line.
 */
export const DRAWN_TEXT_PROBLEM = "the video model drew its own subtitles into the clip";

export const CHECK_SYSTEM = "You check pictures for an animated series where every character is a BLOCKY GAME AVATAR: a cube head, a rectangular torso, block arms and legs, smooth matte plastic, and a flat 2D face printed on the front of the head. Look at the whole picture carefully and answer the questions exactly. Small blurred figures far in the background are NOT characters in the scene: count them only where asked. Answer only with the JSON object.";

/** speech: a clip check with the second picture (two frames from the middle of the line), which adds drawnText. */
export function checkSchema({ speech = false } = {}) {
  const ch = { name: { type: "string" }, visible: { type: "boolean" }, isBlockyAvatar: { type: "boolean" } };
  const props = {
    characters: { type: "array", items: { type: "object", additionalProperties: false, required: Object.keys(ch), properties: ch } },
    mainFigures: { type: "integer" },
    backgroundFigures: { type: "integer" },
    humanFigures: { type: "integer" },
    brickToyLook: { type: "boolean" },
    realisticFace: { type: "boolean" },
    duplicates: { type: "array", items: { type: "string" } },
    readableText: { type: "string" },
    logos: { type: "boolean" },
    speakerHeadPercent: { type: "integer" },
    speakerShownTo: { type: "string", enum: BODY_CUTS },
    ...(speech ? { drawnText: { type: "string" } } : {}),
    notes: { type: "string" },
  };
  return { type: "object", additionalProperties: false, required: Object.keys(props), properties: props };
}

/**
 * @param {{name:string, look?:string}[]} expected avatars meant to be in the frame
 * @param {{speaker?:string, speech?:boolean}} [o] speaker: the speaking avatar's name (scene pictures);
 *   speech: a SECOND picture is attached, two frames from the middle of the clip (clip checks)
 */
export function checkPrompt(expected, { speaker = null, speech = false } = {}) {
  return [
    `This picture should show exactly ${expected.length} blocky game avatar${expected.length > 1 ? "s" : ""}:`,
    ...expected.map((c) => `- ${c.name}: ${c.look ?? KIND}`),
    "characters: for each one listed, is it visible, and is it a blocky game avatar (a cube head with a flat printed face, block body)?",
    "mainFigures: how many figures are really in the scene (foreground or middle ground, in focus, large enough to see a face). Count every one, listed or not.",
    "backgroundFigures: how many small or blurred figures are far in the background.",
    "humanFigures: how many figures ANYWHERE in the picture are human or have a human head, face, skin or hair instead of a blocky game-avatar body.",
    "brickToyLook: true if anything looks like a brick-toy construction set: round studs on bricks or on the floor, a studded baseplate, a round or cylinder minifigure head, a stud on top of a head or a neck, or C-shaped claw hands. Flat smooth blocks are fine.",
    "realisticFace: true if any face has realistic 3D teeth, lips, a tongue or a nose modelled into the head. A flat printed mouth is fine, also with flat cartoon teeth; flat eyebrow lines are fine.",
    "duplicates: names of listed characters that are drawn more than once as main figures (an empty list if none).",
    "readableText: any words, names, letters or numbers a viewer could read ANYWHERE in the picture (a subtitle or caption, a name tag over a head, a chat box, a sign, a screen, clothes), copied as you read them; an empty string if there are none. Plain shapes on a shirt (a star, a circle, a bolt) are not text.",
    "logos: true if there is a logo or a brand mark anywhere.",
    speaker
      ? `speakerHeadPercent: ${speaker} is the speaker. Measure the height of ${speaker}'s cube head as a percentage of the full picture height, 0 to 100. A chest-up shot is about 30 to 45; a full-body shot is about 10 to 18.`
      : "speakerHeadPercent: 0.",
    speaker
      ? `speakerShownTo: the lowest part of ${speaker}'s body that is inside the picture: shoulders, chest, waist, knees or feet. If you can see their feet or the floor under them, answer feet.`
      : "speakerShownTo: unknown.",
    ...(speech ? ["drawnText: every question above is about the FIRST picture. A SECOND picture is attached: two earlier moments of the same clip, side by side, taken while the line is being spoken. Copy any words, subtitles, captions or lyrics drawn anywhere on that second picture, exactly as you read them; an empty string if there are none. Plain shapes on clothes are not text."] : []),
    "notes: one short sentence on anything wrong, or an empty string.",
  ].join("\n");
}

/**
 * The model's answer → {ok, problems, fixes}; fixes are sentences the one free
 * redraw adds to the picture prompt (pictures.js#withRedrawHint).
 * Decision 14: any text, subtitle or caption on screen fails (a clip's last
 * frame is checked with this too, so such a clip is made again once, free).
 * Decision 15: a full-body shot with a small face fails and is redrawn once, free.
 */
export function verdictOf(data, expected, { speaker = null, framing = Boolean(speaker), missingOk = false } = {}) {
  const problems = [];
  const fixes = [];
  const byName = new Map((data?.characters ?? []).map((c) => [String(c.name).toLowerCase(), c]));
  for (const c of expected) {
    const seen = byName.get(c.name.toLowerCase());
    if (!seen || !seen.visible) { if (!missingOk) { problems.push(`${c.name} is missing`); fixes.push(`${c.name} must be clearly visible.`); } }
    else if (!seen.isBlockyAvatar) { problems.push(`${c.name} is not drawn as a blocky game avatar`); fixes.push(`${c.name} is a blocky game avatar: a cube head with a flat printed face, a rectangular torso, block arms and legs.`); }
  }
  const humans = Number(data?.humanFigures) || 0;
  if (humans > 0) { problems.push(`${humans} human figure${humans > 1 ? "s" : ""} in the picture`); fixes.push("No humans anywhere: every figure is a blocky game avatar."); }
  if (data?.brickToyLook === true) { problems.push("a brick-toy look (studs, a studded floor, a round minifigure head or claw hands)"); fixes.push("Smooth matte plastic blocks only: no studs, no studded baseplate, cube heads (never round), plain block hands (never claws)."); }
  if (data?.realisticFace === true) { problems.push("a realistic 3D mouth, teeth, lips, tongue or nose on a face"); fixes.push("Faces are flat 2D decals printed on the cube head: no 3D teeth, lips, tongue or nose."); }
  const main = Number.isFinite(data?.mainFigures) ? data.mainFigures : null;
  if (main != null && main > expected.length) { problems.push(`${main} characters up front instead of ${expected.length}`); fixes.push(`Exactly ${expected.length} character${expected.length > 1 ? "s" : ""} in the scene and nobody else.`); }
  const twice = (Array.isArray(data?.duplicates) ? data.duplicates : []).map((n) => String(n).trim()).filter(Boolean);
  if (twice.length) { problems.push(`${twice.join(" and ")} drawn twice`); fixes.push("Each character appears exactly once."); }
  const text = String(data?.readableText ?? "").trim();
  if (text.replace(/[^\p{L}\p{N}]/gu, "").length >= 2) { problems.push(`text on screen ("${text.slice(0, 40)}")`); fixes.push("No text anywhere: no subtitles, captions, name tags, chat boxes, signs or numbers."); }
  if (data?.logos === true) { problems.push("a logo or brand mark in the picture"); fixes.push("No logos or brand marks: plain unbranded props."); }
  const drawn = String(data?.drawnText ?? "").trim();
  if (drawn.replace(/[^\p{L}\p{N}]/gu, "").length >= 2) { problems.push(`${DRAWN_TEXT_PROBLEM} ("${drawn.slice(0, 60)}")`); fixes.push("No subtitles, captions or words drawn in the clip."); }
  const head = Number(data?.speakerHeadPercent);
  const small = Number.isFinite(head) && head > 0 && head < MIN_HEAD_PERCENT;
  if (framing && speaker && (small || TOO_WIDE.has(data?.speakerShownTo))) {
    problems.push(small ? `${speaker} is too small in the frame (head about ${Math.round(head)}% of the height)` : `${speaker} is shown full body (down to the ${data.speakerShownTo}), not chest-up`);
    fixes.push(`Reframe much closer: a tight chest-up shot of ${speaker}, the cube head filling a third of the frame height, cropped at the chest. No legs, no feet, no floor.`);
  }
  return { ok: problems.length === 0, problems: [...new Set(problems)], fixes: [...new Set(fixes)] };
}

/* ─── The upload pack (uploadPackage.js) ──────────────────────────────── */

export const UPLOAD_LIMITS = Object.freeze({ title: 100, hookChars: 40, description: 500, tags: 500, caption: 150, hashtagsMin: 3, hashtagsMax: 5 });

export const UPLOAD_SYSTEM = `You write the upload text for a short vertical video (YouTube Shorts, TikTok, Reels) where blocky game avatars act out a story inside a blocky online game world and talk.
- title: the YouTube title. It reads as a HOOK first: one sentence or question a scroller wants answered, with the strongest words in the first ${UPLOAD_LIMITS.hookChars} characters. 2 to 4 search keywords are PART of that sentence (e.g. roblox, admin, obby, trade, glitch: whichever fit this video), like "This Roblox admin banned the wrong player". NEVER a hook followed by a list of keywords after a dash, a colon or a bar ("… — roblox story admin prank" is wrong). Tease the twist without giving it away. AT MOST ${UPLOAD_LIMITS.title} characters in total, hashtags included. Never the video title as given. No emojis.
- description: UNDER ${UPLOAD_LIMITS.description} characters in total: one or two real sentences that carry the hook with the keywords inside them (never a keyword list after a dash), then one question that makes viewers comment, then 3 to 5 hashtags at the end. It never gives away the twist.
- tags: YouTube tags as ONE string, comma-separated, most important first, AT MOST ${UPLOAD_LIMITS.tags} characters in total. Lowercase, no # signs.
- pinnedComment: ONE question for the creator to pin that splits viewers into two sides (e.g. "Was Vex right to ban them, or was it abuse?"). No hashtags.
- caption: the TikTok and Reels caption, UNDER ${UPLOAD_LIMITS.caption} characters, no hashtags in it. For a series episode, end by pointing to the next episode (use its title when given).
- hashtags: 3 to 5 hashtags for the caption, lowercase, each starting with #, no spaces: a mix of broad and specific to this story.
Plain words. Nothing about real people. Never name a real game, a real creator or a real username; the only real name allowed is the platform's, as a search keyword. Answer only with the JSON object.`;

export function uploadSchema() {
  const s = { type: "string" };
  return {
    type: "object", additionalProperties: false,
    required: ["title", "description", "tags", "pinnedComment", "caption", "hashtags"],
    properties: { title: s, description: s, tags: s, pinnedComment: s, caption: s, hashtags: { type: "array", items: s } },
  };
}

/**
 * Cleans the model's answer and enforces every cap in code; returns {pkg, problems}.
 * pkg: title, description, tags, pinnedComment, caption, hashtags, and the counts the final screen shows.
 */
export function cleanUpload(data) {
  const problems = [];
  const text = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
  const hashtags = [...new Set((data?.hashtags ?? []).map((t) => `#${String(t).trim().replace(/^#+/, "").replace(/\s+/g, "").toLowerCase()}`).filter((t) => /^#[a-z0-9_]{2,40}$/.test(t)))].slice(0, UPLOAD_LIMITS.hashtagsMax);
  if (hashtags.length < UPLOAD_LIMITS.hashtagsMin) problems.push(`hashtags: ${UPLOAD_LIMITS.hashtagsMin} to ${UPLOAD_LIMITS.hashtagsMax} needed`);
  // Tags: whole tags only, most important first, never past the cap (the tail is dropped, not cut mid-word).
  const kept = [];
  for (const tag of text(data?.tags).split(",").map((t) => t.trim().replace(/^#+/, "").toLowerCase()).filter(Boolean)) {
    if (kept.includes(tag)) continue;
    if ([...kept, tag].join(", ").length > UPLOAD_LIMITS.tags) break;
    kept.push(tag);
  }
  const pkg = { title: text(data?.title), description: text(data?.description), tags: kept.join(", "), pinnedComment: text(data?.pinnedComment), caption: text(data?.caption), hashtags };
  if (!pkg.title) problems.push("title missing");
  if (pkg.title.length > UPLOAD_LIMITS.title) problems.push(`title is ${pkg.title.length} characters; the cap is ${UPLOAD_LIMITS.title}`);
  // A hook with keywords bolted on after a dash, a bar or a colon ("… — roblox story admin prank") is not a title.
  if (/\s[—–|]\s|\s-\s|:\s+[a-z]/.test(pkg.title.replace(/#\w+/g, ""))) problems.push("title: no keywords after a dash, a bar or a colon; write ONE hook sentence with the keywords inside it");
  if (/\s[—–]\s[^.?!]*,[^.?!]*,/.test(pkg.description)) problems.push("description: no keyword list after a dash; put the keywords inside the sentences");
  if (!pkg.description) problems.push("description missing");
  if (pkg.description.length >= UPLOAD_LIMITS.description) problems.push(`description is ${pkg.description.length} characters; it must be under ${UPLOAD_LIMITS.description}`);
  if (!pkg.tags) problems.push("tags missing");
  if (!pkg.pinnedComment.endsWith("?")) problems.push("pinnedComment must be a question");
  if (!pkg.caption) problems.push("caption missing");
  if (pkg.caption.length >= UPLOAD_LIMITS.caption) problems.push(`caption is ${pkg.caption.length} characters; it must be under ${UPLOAD_LIMITS.caption}`);
  const named = bannedNamesInUploadText(`${pkg.title} ${pkg.description} ${pkg.tags} ${pkg.pinnedComment} ${pkg.caption} ${hashtags.join(" ")}`);
  if (named.length) problems.push(`names ${named.map((n) => `"${n.name}"`).join(", ")}: no real games, brands or creators`);
  pkg.counts = { title: pkg.title.length, description: pkg.description.length, tags: pkg.tags.length, caption: pkg.caption.length };
  return { pkg, problems };
}

