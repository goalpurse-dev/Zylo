// The four In This Town guides (/blog/<slug>), as markdown in plain JS so the browser (InThisTownBlogGuide.jsx) and
// the Node build scripts (structuredData.js FAQ, sitemap) read the same text. The markdown is the subset
// src/app/blog/MarkdownArticle.jsx renders: ## / ### headings, lists, > quotes, tables, **bold**, CTA lines
// "[Primary CTA: label → /path]", then "## FAQ" (### question + answer) and "## Related links" ("Title → /path").
// Facts only: no invented numbers, no other creator's scripts. The genre's name follows GENRE (inThisTownLanding.js).
import { GENRE, IN_THIS_TOWN_PATH, IN_THIS_TOWN_PRICE, TOWN_BLOG } from "./inThisTownLanding.js";
import { extractFaqs } from "../app/blog/markdownBlogUtils.js";

const R = GENRE ? `${GENRE.style} ` : "";            // "Roblox-style " or "" (owner, 2026-11-17: titles say "Roblox-style", never the bare name)
const RS = GENRE ? GENRE.style : "blocky";           // "Roblox-style" or "blocky"
const P = IN_THIS_TOWN_PRICE.credits;
const L = IN_THIS_TOWN_PATH;
const title = (slug) => TOWN_BLOG.find((b) => b.slug === slug).title;
const related = (skip) => TOWN_BLOG.filter((b) => b.slug !== skip).map((b) => `- ${b.title} → /blog/${b.slug}`).join("\n");

const HOW = `"In this town" videos are short, narrated stories set in a blocky ${RS} town where one strange rule controls everyone's life. A single storyteller voice explains the rule, introduces the one kid who doesn't fit, and drives the story to a twist, while big captions pop word by word over fast 3D shots. This guide walks through making one from scratch: the idea, the script, the visuals, the voice and the posting.

[Primary CTA: Make an "In this town" video from one sentence → ${L}]

## What an "In this town" video is

The format is simple to describe and hard to do well:

- **One rule.** "In this town, every time you laugh, you grow." The rule is stated as plain fact, never "imagine if".
- **One narrator.** Usually a kid telling their own story in first person.
- **Fast, literal pictures.** Every sentence gets a shot that shows exactly what it says.
- **A twist.** The ending uses the rule in a way nobody saw coming, then leaves a question open.

Most of them run about a minute to a minute and a half, vertical 9:16, made for TikTok, YouTube Shorts and Instagram Reels.

## Step 1: Pick a rule a kid could explain

The rule is the whole video, so spend the most time here. A strong rule has three things:

1. **It hangs on an everyday thing.** Laughing, stairs, birthdays, homework, burping. Viewers instantly picture it.
2. **It has a price.** Something annoying or dangerous happens when you break it.
3. **It can be shown.** If you can't picture the shot, the video can't show it either.

Compare two rules:

> In this town, people's emotions affect the economy.

> In this town, every time you burp, it rains on you and only you.

The first is an essay. The second is a picture, a price and a joke in one line. If you are stuck, our list of 50 ideas is a good place to start.

## Step 2: Write the hook first

The first line decides whether anyone watches the second one. The format's favourite trick is to **start with the result**, the craziest moment of the whole story, before explaining anything:

> I just caught the whole bank with one hand.

Then, within the first two sentences, the rule:

> You see, in this town, every time you laugh, you grow.

Now the viewer has a question ("how did a kid catch a bank?") and the tool to answer it (the rule). Everything after that is paying off the hook.

## Step 3: Build the story in seven beats

Almost every strong "In this town" story follows the same shape:

1. **The rule**, in one sentence.
2. **Life under it:** two or three quick examples that are real jokes. "My teacher is so boring, our whole class is hamster-sized."
3. **The one kid:** the narrator, who is the exception or the underdog.
4. **But one day:** the event that breaks the routine.
5. **The crisis:** things get worse in visible steps.
6. **The twist:** the kid wins using the rule itself, in a clever way.
7. **The cliffhanger:** a last line that flips the first one or opens a new problem.

We break this down line by line in our story formula guide.

[Secondary CTA: Read the full story formula → /blog/viral-blocky-story-formula]

## Step 4: Plan one shot per sentence

This is where most attempts fall apart. The narration says "my dad laughed at one cat video, now he walks the dog from the roof", and the picture shows… a street. Viewers notice. The rule of the format is: **every line is shown literally.** Dad, giant, roof, dog, leash.

A practical way to plan it:

| Line | What we see |
|---|---|
| Every time you laugh, you grow. | A kid laughs and pops one size bigger. |
| That's why clowns are illegal. | A police officer leads a clown away. |
| Me? I'm the most ticklish kid in town. | Close-up of the narrator, tape over the mouth. |

Keep shots short. Cut when the narration introduces a new image. Use close-ups for reactions and wide shots for the town.

## Step 5: Voice, captions and sound

- **Voice:** one consistent storyteller voice, a little fast. Trim the pauses between sentences.
- **Captions:** one or two words at a time, big, centred, with a thick outline. Many creators colour each speaker's words differently so dialogue is easy to follow.
- **Sound effects:** a pop when someone grows, a whoosh for wind, a gasp for the crowd. Small sounds make blocky scenes feel alive.
- **Music:** quiet, under the voice. Use music you have the rights to.

## Step 6: Make the 3D scenes

There are two routes:

**Do it yourself.** Build or download a blocky town in a 3D program, rig characters, animate every shot, render, edit. It gives you full control, and it takes a lot of time and skill per video.

**Use a maker.** Zyvo's In This Town tool does steps 2 to 6 for you. You type the rule, read and edit the script it writes, and it voices the story, directs each shot in 3D, checks that each shot matches its line, renders the video and adds captions. A video usually takes about 30–45 minutes and costs ${P} credits, refunded if it fails.

[Primary CTA: Turn your rule into a video → ${L}]

## Step 7: Post it

- **Title and caption:** reuse the hook. "I caught a whole bank with one hand" is a better caption than "new video".
- **Cover:** pick the most surprising frame, not the opening.
- **Series:** if a town works, make part two in the same town. Viewers like coming back to a world they know.
- **Read the comments:** viewers often suggest the next rule themselves.

## Common mistakes

- **Starting with the rule instead of the result.** Lead with the craziest moment.
- **A rule nobody can picture.** Keep it physical.
- **Shots that don't match the words.** The fastest way to lose a viewer.
- **A soft ending.** "And we all learned to be kind" is not a twist. Use the rule.
- **Copying another creator's story.** Use the format, write your own rules and characters.

## FAQ

### How long should an "In this town" video be?
Most run about one minute to a minute and a half. Long enough for the seven beats, short enough to keep the pace fast.

### Do I need to know Blender or animation?
No. You can animate it yourself if you want to, but a maker like Zyvo's In This Town writes, voices, directs and renders the video from one sentence.

### Can I use my own character?
In Zyvo you can upload a picture of an avatar or a cartoon character and the director builds a blocky hero in its colours. Avatars and cartoons only, no photos of real people.

### Where should I post these videos?
They are vertical 9:16, so TikTok, YouTube Shorts and Instagram Reels all fit. You can post the same video on all three.

### Is this format affiliated with any game?
${GENRE ? `No. "${GENRE.style}" only describes the blocky look. Zyvo is not affiliated with ${GENRE.owner}.` : "No. It is a storytelling format with a blocky look."}

## Related links

- The "In this town" story video maker → ${L}
${related("how-to-make-in-this-town-story-shorts")}
`;

const IDEA = (rule, note) => `- **In this town, ${rule}.** ${note}`;
const IDEAS = `Need a rule for your next "In this town" video? Here are 50 of our own, sorted by theme. Each one has the three things a strong rule needs: an everyday thing, a price for breaking it, and a picture you can see. Next to each, a quick note on where the story could go. Take one as it is, or twist it into your own.

[Primary CTA: Turn any of these into a video → ${L}]

## How to use this list

Read the rule out loud. If you can instantly picture a kid, a street and something going wrong, it works. Then ask: who is the one kid who doesn't fit this rule? That kid is your narrator. Every idea below is written so the story can be shown literally, line by line, in a blocky ${RS} town.

## School

${IDEA("whatever you doodle on your homework comes alive at midnight", "The one kid who only draws monsters. The twist: the monsters do the homework.")}
${IDEA("every wrong answer adds a brick to your desk", "Desks become towers. The kid at the top can see something nobody else can.")}
${IDEA("the teacher's voice gets louder every time someone yawns", "A sleepy class, shaking windows, a principal with earmuffs.")}
${IDEA("if you're late, your shadow goes to class without you", "The shadow starts getting better grades than you.")}
${IDEA("every time you raise your hand, it floats a little higher", "The smartest kid in class is now taped to the floor.")}
${IDEA("lunch tastes like whatever you're most scared of", "The kid who isn't scared of anything gets plain bread. Every day.")}
${IDEA("the school bell rings only when someone tells the truth", "Nobody has gone home in three days.")}

## Family and home

${IDEA("every time you skip a stair, the house builds one more", "A house that's now forty floors tall, and Grandma lives at the top.")}
${IDEA("every time you forget a birthday, that person shrinks until you remember", "A dad the size of a mug, and a calendar nobody can find.")}
${IDEA("whoever does the dishes gets to rename the family pet for a day", "A dog called Mister Thunderpants, and a fight over the sink.")}
${IDEA("your bedroom gets messier every time you say \"later\"", "The room has its own weather now.")}
${IDEA("siblings swap heights every Sunday", "The little brother finally reaches the cookie jar.")}
${IDEA("every lie you tell becomes a small, sticky frog", "One kid's house is quiet. The neighbour's house is croaking.")}

## Food

${IDEA("every time you burp, it rains on you and only you", "The kid who carries an umbrella to dinner.")}
${IDEA("whatever you eat for breakfast, you turn a little bit into", "Pancake Day is chaos.")}
${IDEA("if you leave food on your plate, it follows you home", "A trail of broccoli down Main Street.")}
${IDEA("the pizza shop delivers to whoever whistles loudest", "Whistling contests at every street corner.")}
${IDEA("every candy you eat makes your feet bounce higher", "Halloween night: the whole town on the rooftops.")}

## Weather and nature

${IDEA("the sun only comes up if someone in town is smiling", "The grumpiest kid in town gets a very important job.")}
${IDEA("every time it snows, everyone swaps houses", "Waking up in the mayor's bed.")}
${IDEA("trees grow toward whoever is the kindest person nearby", "One kid has a whole forest following them to school.")}
${IDEA("wind blows away whatever you were just thinking about", "Thoughts tumbling down the street like leaves.")}
${IDEA("puddles show what happens tomorrow", "Nobody jumps in puddles. Except one kid.")}

## Pets and animals

${IDEA("pets choose their owners, not the other way around", "The kid no pet has ever chosen. Until a very strange one does.")}
${IDEA("every time a dog barks, someone in town forgets their name", "Name tags on everyone, and a very noisy street.")}
${IDEA("pigeons deliver every secret you whisper", "The kid who must never whisper.")}
${IDEA("your pet becomes the size of how much you love it", "One girl's hamster is now taller than the school.")}

## Sports and games

${IDEA("every time you win a game, your shadow grows and starts giving orders", "The champion whose shadow wants the trophy.")}
${IDEA("whoever loses at tag has to be the town's mayor for a day", "Kids losing on purpose to fix the roads.")}
${IDEA("the ball goes wherever the crowd is looking", "A final match where nobody can look away from the twist.")}
${IDEA("every goal you score adds a floor to your house", "The best player lives in a tower. The worst player lives in a tent.")}
${IDEA("you can only run as fast as you can sing", "The quietest kid wins the race. Somehow.")}

## Night and dark twists

${IDEA("the last kid awake has to guard the moon until sunrise", "Something tries to take it. Tonight.")}
${IDEA("streetlights follow anyone who walks alone after dark", "The light behind you is not a streetlight.")}
${IDEA("every night, one house in town disappears until morning", "Tonight it's yours, and you're still inside.")}
${IDEA("your reflection goes to bed an hour after you do", "What does it do in that hour?")}
${IDEA("if you hear your name at night, you must not answer", "Grandma's rules, and the night Grandma calls you.")}
${IDEA("the town clock runs backwards for one minute every midnight", "One kid figures out how to stay inside that minute.")}

## Money and rules

${IDEA("you pay for things with compliments", "The meanest man in town can't afford bread.")}
${IDEA("every time you say \"I'm bored\", the town moves one street to the left", "The town is now in the ocean.")}
${IDEA("whoever finds a lost coin becomes rich for exactly one hour", "A coin hunt that turns the whole town upside down.")}
${IDEA("prices go up every time someone complains", "A single lollipop costs a house.")}
${IDEA("the mayor is whoever is wearing the silly hat", "A hat that won't stay on anyone's head.")}

## Strange bodies

${IDEA("if someone says your name wrong, you turn into what they said", "Kevin, who is now a cabin.")}
${IDEA("every time you blush, you light up like a lamp", "The kid who is useful during power cuts.")}
${IDEA("you shrink a little every time you say sorry", "The politest family in town fits in a shoebox.")}
${IDEA("your hair grows when you're nervous", "Test day. The classroom is full of hair.")}
${IDEA("you get one inch taller for every new friend", "The new kid in town is very, very small.")}
${IDEA("whoever laughs last gets stuck laughing for a week", "Nobody tells jokes at funerals. Or anywhere.")}
${IDEA("you can only whisper on Mondays", "A town where every argument waits for Tuesday.")}
${IDEA("your footsteps play music, and everyone's is different", "One kid's footsteps play the town's forbidden song.")}

[Secondary CTA: Try one in the free rule box → ${L}]

## How to turn an idea into a full story

A rule is a premise, not a story yet. To build it out:

1. **Start with the result.** What's the craziest thing that happens because of this rule? Open with that.
2. **Add two or three jokes about life under the rule.**
3. **Choose your narrator:** the kid who has it worst, or the kid it never affects.
4. **Plant one small object early** that will matter at the end.
5. **End with the rule itself** solving the problem, plus one last line that opens a new question.

## FAQ

### Can I use these ideas in my own videos?
Yes. We wrote them to be used. Change names, details and endings to make them your own.

### How do I know if an idea will do well?
Nobody can promise that. What helps is a rule people understand in one second, a hook that starts with the result, and pictures that match every line.

### What makes a good "In this town" rule?
An everyday thing, a price for breaking it, and something you can show on screen.

### Can Zyvo turn one of these into a video?
Yes. Paste the rule into the In This Town maker. It writes a full script you can edit, then makes the video. It costs ${P} credits, refunded if it fails.

## Related links

- The "In this town" story video maker → ${L}
${related("in-this-town-story-ideas")}
`;

const FORMULA = `Viral ${RS} story videos can look random: a giant kid, a flying grandma, a town inside a plane. But most of the good ones share the same skeleton underneath. This guide explains that skeleton beat by beat, with our own example story, so you can use the structure without copying anybody's script.

[Primary CTA: Let Zyvo write your story with this formula → ${L}]

## The seven beats

| Beat | What it does | How long |
|---|---|---|
| 1. The rule | Sets up the world in one sentence | 1 line |
| 2. Life under it | Makes the rule funny and real | 2–4 lines |
| 3. The one kid | Gives us someone to root for | 1–2 lines |
| 4. But one day | Breaks the routine | 1 line |
| 5. The crisis | Raises the stakes in steps | 4–8 lines |
| 6. The twist | Solves it with the rule | 2–3 lines |
| 7. The cliffhanger | Leaves the door open | 1 line |

Before beat 1 sits the **hook**: the craziest result from later in the story, said first. We'll use one example all the way through.

## The hook: start with the result

> I just tied the whole school to the ground with a skipping rope.

This sentence doesn't make sense yet, and that's the point. The viewer needs the next line to understand it.

## Beat 1: The rule

> You see, in this town, every time you get a compliment, you float a little.

Rules work best when they are said flatly, as a fact of life. The narrator is not amazed by it. To them, it's just Tuesday.

## Beat 2: Life under the rule

This is where you earn the laughs. Two or three examples, each one a small joke with a picture:

> That's why nobody here says "nice shoes".
> Mrs. Ambrose said her soup was "perfect" once. Now she cooks on the ceiling.
> Teachers grade in silence.

Notice that each example is something the camera can show: a ceiling kitchen, a silent teacher.

## Beat 3: The one kid

Every story needs the exception:

> And me? I'm Pax. Nobody has ever said one nice thing to me. I've never left the ground.

The one kid is usually the underdog: the one the rule ignores, the one it hits hardest, or the one who breaks it. That makes them easy to root for.

## Beat 4: But one day

> But one day, it was Compliment Day.

The routine breaks. In a good story the event comes straight out of the rule. If your rule is about compliments, the crisis should be about compliments too.

## Beat 5: The crisis

Escalate in steps the viewer can see:

> The principal told the whole school, "You're all wonderful."
> Thirty kids rose off the playground like balloons.
> The wind picked up.

Each step is bigger than the last, and each is a single image. Keep the lines short; let the pictures carry it.

## Beat 6: The twist

The best twists use the rule, not new magic:

> I was the only kid still on the ground. So I grabbed the skipping rope, and I tied every single one of them to the flagpole.

Our narrator wins precisely because the rule never touched them. The thing that made Pax the outsider is what saves everyone. This is also where a **planted object pays off**: if the skipping rope appeared in beat 3, the ending feels earned instead of convenient.

## Beat 7: The cliffhanger

> Then the principal looked at me and said, "Pax, that was amazing."
> And my feet left the ground.

A good last line flips the first one or opens a new problem. It's also what gets people commenting "part 2?".

## Two styles the formula supports

**Funny chaos:** big, silly consequences; lots of jokes in beat 2; a twist that's a punchline. Milo, the kid who grows every time he laughs, is this style.

**Dark twist:** the rule hides something unsettling; small details feel "slightly wrong"; the twist is a reveal. Our coin tower story, where every kid who rides the lift up makes a warm coin fall from the sky, is this style.

Both use the same seven beats. Only the tone changes.

## Plant and pay off

Strong stories mention three or more small things early that come back at the end: an object, a line of dialogue, a place. Viewers love noticing them on a second watch. Write the ending first, then go back and plant what it needs.

## What not to borrow

The formula is a structure, like a chorus in a song. It is fine to use. What isn't fine is copying another creator's rule, characters, jokes or twist. Write your own town. The structure will still hold it up.

[Secondary CTA: Need a rule? Get 50 of ours → /blog/in-this-town-story-ideas]

## Checklist before you record

- Does the first line show the result, not the setup?
- Is the rule said within the first two sentences?
- Is every line something the camera can show?
- Does the twist use the rule?
- Did you plant what the ending needs?
- Does the last line flip the first or open a new problem?

## FAQ

### Do all viral story videos follow this formula?
No, and nobody can promise a formula will go viral. This is the shape many of the strongest "In this town" stories share, and it is a reliable place to start.

### How many lines should the story have?
For a video of about a minute and a half, roughly 20 to 35 short sentences. One sentence per shot.

### What's the difference between the hook and the cliffhanger?
The hook opens a question at the start by showing a result. The cliffhanger opens a new one at the very end.

### Can Zyvo write the story for me?
Yes. The In This Town maker writes several versions of your story with this structure, picks the strongest, and lets you edit every line before the video is made.

## Related links

- The "In this town" story video maker → ${L}
${related("viral-blocky-story-formula")}
`;

const FACELESS = `Faceless videos let you run a channel without being on camera: no face, no voice of your own, no studio. ${RS} animated stories are a natural fit, because the characters are the stars. The hard part has always been the animation itself. This guide covers what a faceless blocky animation needs, the traditional way to make one, and how to make one with no 3D or animation skills at all.

[Primary CTA: Make a faceless ${RS} story video → ${L}]

## What a faceless ${RS} animation needs

Whatever tools you use, a finished video has the same parts:

1. **A story:** a script with a hook, a rule, characters and a twist.
2. **A world:** streets, houses, a school, shops, maybe a plane or a moon.
3. **Characters:** blocky bodies with simple faces that can show emotions.
4. **Animation:** walking, running, reacting, crowds, objects moving.
5. **Camera work:** wide shots, close-ups, reaction shots, cuts on the beat.
6. **A voice:** a narrator, usually a text-to-speech voice for faceless channels.
7. **Captions and sound:** word-by-word captions, sound effects and music.

## The traditional route: Blender and an editor

Many creators make these videos in Blender, the free 3D program:

- **Build or download** a blocky town and characters. Check every model's licence: many free models can't be used commercially or require credit.
- **Rig and animate** each character for each shot.
- **Set up cameras and lights**, then render every shot, which takes computer time.
- **Edit** in a video editor: cut the shots to the voice-over, add captions, sound effects and music.

This gives you full control. It also asks for 3D skills, a capable computer and many hours per video. Some creators use AI chatbots to write Blender scripts for them, which helps, but you still need to install, run, fix and render everything yourself.

## The no-skills route: a story video maker

Zyvo's In This Town maker does every part above from one sentence, in your browser:

1. **You type a rule**, for example "every time you skip a stair, the house builds one more". Or pick a ready idea.
2. **It writes the script.** You read it and change any line you like.
3. **It plans the scenes** from a library of places (a pastel downtown, a suburb with house interiors, a brick city, a classroom, a hallway, a shop, a plane and more), and builds missing places inside them.
4. **It records the voice** with a storyteller voice and trims the pauses.
5. **An AI director writes every shot in 3D**, renders previews, and a checker compares each shot with its line. Wrong shots go back for a fix.
6. **It renders the final video** on cloud GPUs in Blender, then adds captions coloured by speaker, sound effects and music.

There is nothing to install and no 3D skill needed. A video usually takes about 30–45 minutes and costs ${P} credits, refunded in full if it fails.

[Secondary CTA: Try a rule in the free preview box → ${L}]

## Make it yours: a custom hero

Faceless doesn't mean anonymous. A recurring hero makes a channel recognisable. In Zyvo you can upload a picture of an avatar or a cartoon character and the director builds a blocky hero in its colours and style. Avatars and cartoons only: no photos of real people and no logos.

## From one sentence to a finished video: an example

Say your rule is "every time you skip a stair, the house builds one more". The maker writes a script that opens on the result ("My grandma now lives on the forty-first floor"), states the rule in the second line, and introduces the kid who always skips stairs. You read it and change a line or two. It then plans the scenes: the house, the staircase, the street outside. The director shows each line literally: the kid skipping a stair, a new step appearing, Grandma waving from a tiny window far above. Captions pop word by word, a thud plays every time a stair appears, and the finished MP4 is waiting for you under Recent creations.

Your job was one sentence and one read-through. That is the whole point of a faceless workflow: you spend your time on ideas, not on keyframes.

## Tips for a faceless story channel

- **One format, many towns.** Viewers learn what to expect from you. Keep the format and change the rule.
- **Same narrator voice every time.** It becomes your channel's voice.
- **Series beat one-offs.** If a town works, give it a part two.
- **Hook in the first line.** Start with the craziest result, then explain the rule.
- **Post where vertical video lives:** TikTok, YouTube Shorts, Instagram Reels.
- **Write your own stories.** Use the format, never another creator's script.

## Rights and safety checklist

- Use your own scripts and characters.
- Only use 3D models, music and sounds you have the right to use commercially. Zyvo uses its own or public-domain (CC0) models and its own music track.
- Don't use game logos, screenshots or trademarks in your videos or thumbnails.
${GENRE ? `- "${GENRE.style}" describes a look. Make clear you are not affiliated with ${GENRE.owner}.` : ""}

## Blender vs a maker at a glance

| | Blender + editor | Zyvo In This Town |
|---|---|---|
| Skills needed | 3D modelling, animation, editing | Typing a sentence |
| Software | Blender and a video editor | A browser |
| Script | You write it | Written for you, you edit |
| Voice | Record or generate yourself | Included |
| Captions and sound | You add them | Included |
| Control over every frame | Full | You steer the script and scenes |

## FAQ

### What is a faceless ${RS} video?
A narrated animated story with blocky characters where the creator never appears on camera and often doesn't use their own voice.

### Can I make these without Blender?
Yes. Zyvo's In This Town maker uses Blender on its own cloud GPUs, so you don't install or learn it.

### Do I need a microphone?
No. The narration is generated with a storyteller voice.

### Can I monetise faceless story videos?
The videos you make with Zyvo are yours to post and monetise under Zyvo's terms. Each platform has its own monetisation rules, so check them for your channel.

### Can I use my own character?
Yes, upload an avatar or cartoon picture and a blocky hero is built from it.

## Related links

- The "In this town" story video maker → ${L}
${related("faceless-blocky-animations-without-blender")}
`;

const POST = (slug, o) => ({ slug, hero: `/in-this-town/blog/${slug}.webp`, heroWidth: 1600, heroHeight: 900, title: title(slug), category: "AI Video", author: "Zyvo Team", datePublished: "2026-11-17", dateModified: "2026-11-17", date: "November 17, 2026", ...o });

export const TOWN_GUIDES = [
  POST("how-to-make-in-this-town-story-shorts", {
    seoTitle: `How to Make "In This Town" ${R}Story Shorts`,
    description: `Make an "In this town" ${RS} story Short step by step: the rule, the hook, the 7-beat story, one shot per line, voice, captions and posting.`,
    readTime: "8 min read", heroAlt: "Milo, a blocky boy in a striped yellow shirt, from an In This Town story made with Zyvo",
    markdown: HOW,
  }),
  POST("in-this-town-story-ideas", {
    seoTitle: `50 "In This Town" Story Ideas for TikTok & YouTube Shorts`,
    description: `50 original "In this town" story rules for ${RS} story Shorts, sorted by theme, with a note on where each story could go.`,
    readTime: "10 min read", heroAlt: "A blocky plane cabin from an In This Town story made with Zyvo",
    markdown: IDEAS,
  }),
  POST("viral-blocky-story-formula", {
    seoTitle: `The Story Formula Behind Viral ${R}Story Videos`,
    description: `The 7-beat structure behind viral ${RS} story videos, from the rule to the twist and cliffhanger, explained with an original example.`,
    readTime: "8 min read", heroAlt: "A blocky boy by a glowing coin at the foot of a tower, from an In This Town story made with Zyvo",
    markdown: FORMULA,
  }),
  POST("faceless-blocky-animations-without-blender", {
    seoTitle: `Faceless ${GENRE ? "Roblox-style" : "Blocky"} Animations Without Blender or Skills`,
    description: `Make faceless ${RS} story animations: what they need, the Blender route, and how to make one from a sentence with no 3D or animation skills.`,
    readTime: "8 min read", heroAlt: "Blocky townspeople on a city street, from an In This Town story made with Zyvo",
    markdown: FACELESS,
  }),
];

export const getTownGuide = (slug) => TOWN_GUIDES.find((g2) => g2.slug === slug) ?? null;

/** [{ q, a }] of a guide's FAQ, for the server-side FAQPage JSON-LD (structuredData.js), or null */
export function townGuideFaq(pathname) {
  const guide = getTownGuide(String(pathname).replace(/^\/blog\//, ""));
  return guide ? extractFaqs(guide.markdown).map(([q, a]) => ({ q, a })) : null;
}
