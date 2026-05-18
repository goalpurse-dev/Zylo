// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ─── ENV ─── */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY   = Deno.env.get("OPENAI_API_KEY")!;
const OPENAI_CHAT  = "https://api.openai.com/v1/chat/completions";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(data: any) {
  return new Response(JSON.stringify({ ok: true, ...data }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
function fail(msg: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/* ─── PRESET DETECTION ─── */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

type StoryPreset = "cheating" | "baby" | "cheats-back" | "secret-twin" | "kicked-out" | "custom";

interface BeatTemplate {
  beatType:         string; // machine-readable beat label
  title:            string; // scene title suggestion
  purpose:          string; // what this scene achieves narratively
  emotionDirection: string; // dominant emotion in this beat
  actionDirection:  string; // what is physically happening
  cameraDirection:  string; // framing / camera suggestion
  backgroundDetail: string; // environment context
  promptHint:       string; // image prompt context injected into appendStrictImageRules
}

/* ─── PRESET BEAT TEMPLATES ────────────────────────────────────────────────
 * Full beat maps for every supported preset × scene count.
 * These are the source-of-truth for story pacing, scene purpose, and
 * image/video prompt guidance.
 * ───────────────────────────────────────────────────────────────────────── */
const PRESET_BEATS: Record<StoryPreset, Record<number, BeatTemplate[]>> = {

  /* ── CHEATING ── */
  cheating: {
    4: [
      { beatType: "hook",          title: "Sweet Moment with Hidden Clue",     purpose: "Hook the viewer with a happy couple scene that has one subtle suspicious detail visible",                      emotionDirection: "surface happiness with underlying unease",  actionDirection: "couple together, one partner distracted or hiding phone",                  cameraDirection: "warm medium shot, couple in frame",                  backgroundDetail: "cozy home living room or kitchen, warm lighting",           promptHint: "Happy couple scene. One character shows subtle nervousness — slightly averted eyes, hidden phone, or distracted posture." },
      { beatType: "discovery",     title: "The Suspicious Discovery",          purpose: "Betrayed character finds hard evidence of the affair",                                                         emotionDirection: "shock and growing horror",                   actionDirection: "character finds message, gift, or visual proof",                           cameraDirection: "close-up on hands and face reaction",                backgroundDetail: "bedroom or home space, natural light",                       promptHint: "Character alone, discovering visual proof. Wide eyes, trembling hands, frozen in shock." },
      { beatType: "confrontation", title: "Face-to-Face Confrontation",        purpose: "Betrayed character confronts the cheater directly with the proof",                                             emotionDirection: "rage, hurt, or cold fury",                   actionDirection: "confrontation scene, evidence presented or accusation made",                cameraDirection: "dramatic two-shot or over-shoulder confrontation",   backgroundDetail: "shared space — living room or hallway, tense lighting",      promptHint: "Direct confrontation. One character holds evidence or points accusingly. Other character shows guilt or defensiveness." },
      { beatType: "payoff",        title: "Walk Away or Cliffhanger",          purpose: "Emotional payoff — betrayed character walks away or delivers a shocking final revelation",                    emotionDirection: "determination, devastation, or shocking twist", actionDirection: "character walks out, slams door, or reveals a secret",             cameraDirection: "wide shot showing departure or dramatic close-up for twist", backgroundDetail: "doorway, street, or charged room interior",                  promptHint: "Final powerful moment. Character walks away with dignity, or delivers a shocking reveal. Expression: resolved, broken, or triumphant." },
    ],
    6: [
      { beatType: "hook",          title: "Sweet Couple Moment",               purpose: "Open with a tender couple scene that immediately creates audience investment",                                emotionDirection: "happiness with subtle wrongness",           actionDirection: "couple close together, one partner slightly distracted",                    cameraDirection: "warm establishing two-shot",                         backgroundDetail: "cozy home, warm lighting",                                   promptHint: "Happy couple in warm domestic setting. One character has a hint of distraction or guilt not yet noticed by the other." },
      { beatType: "suspicion",     title: "First Suspicious Clue",             purpose: "Introduce the first concrete reason to be suspicious",                                                         emotionDirection: "curiosity turning to unease",               actionDirection: "character spots a clue — phone screen, receipt, lipstick, strange call",    cameraDirection: "close-up on the clue then character reaction",              backgroundDetail: "home space, slightly colder lighting",                       promptHint: "Betrayed character notices something wrong. Close on their face shifting from confusion to suspicion." },
      { beatType: "investigation", title: "Quiet Investigation",               purpose: "Betrayed character privately investigates the suspicious clue",                                               emotionDirection: "nervous determination",                     actionDirection: "character looks through phone, follows, or asks a mutual friend",          cameraDirection: "tight close-up on searching hands/face",             backgroundDetail: "bedroom or private space, muted lighting",                  promptHint: "Character alone searching for truth. Focused, nervous, determined expression. Phone or evidence in hand." },
      { beatType: "discovery",     title: "Hard Evidence Found",               purpose: "The betrayed character finds undeniable visual proof",                                                         emotionDirection: "shock and devastation",                     actionDirection: "character sees the proof clearly — photo, text, or catches them together",  cameraDirection: "dramatic close-up on reaction, tears optional",      backgroundDetail: "discovery location — hallway, bedroom, or street",          promptHint: "Moment of discovery. Character sees undeniable proof. Expression: shattered, wide-eyed, trembling." },
      { beatType: "confrontation", title: "The Confrontation",                 purpose: "Betrayed character confronts the cheater with the evidence",                                                  emotionDirection: "controlled rage or tearful anger",          actionDirection: "confrontation, evidence shown or accusation spoken through expression",    cameraDirection: "intense two-shot, characters close together",        backgroundDetail: "charged indoor space, dramatic lighting",                   promptHint: "Confrontation moment. One character holds evidence. Other shows guilt, shock, or defensiveness. High emotional tension." },
      { beatType: "payoff",        title: "Final Twist or Walk Away",          purpose: "Story resolves with a powerful emotional moment or shocking cliffhanger",                                    emotionDirection: "devastation, triumph, or shocking revelation", actionDirection: "character walks away with dignity or delivers a surprise reveal",          cameraDirection: "powerful wide shot or dramatic close-up",            backgroundDetail: "doorway, outside, or confrontation room",                   promptHint: "Story-ending moment. Character stands strong, walks away, or delivers a final reveal. Expression: resolved and powerful." },
    ],
    8: [
      { beatType: "hook",          title: "Happy Couple Scene",                purpose: "Establish the couple as seemingly happy to make the betrayal hit harder",                                    emotionDirection: "warmth and surface happiness",              actionDirection: "tender couple moment — holding hands, laughing, or sharing food",          cameraDirection: "warm close two-shot",                                backgroundDetail: "cozy kitchen or living room, golden lighting",              promptHint: "Couple appears happy and connected. Warm domestic scene. No visible conflict yet." },
      { beatType: "suspicious_behavior", title: "Something Feels Off",        purpose: "First hint of suspicious behavior that makes the viewer lean in",                                             emotionDirection: "background unease",                         actionDirection: "one partner seems distracted, secretive, or gets a call they leave for",    cameraDirection: "observational shot from betrayed character POV",     backgroundDetail: "home setting, slightly cooler lighting than scene 1",       promptHint: "One character acts subtly nervous or secretive. Stepping away, hiding screen, avoiding eye contact." },
      { beatType: "suspicious_clue",    title: "The Suspicious Clue",         purpose: "Viewer and betrayed character both spot a concrete suspicious detail",                                        emotionDirection: "suspicious curiosity",                      actionDirection: "character spots phone notification, gift receipt, lip mark, or strange photo", cameraDirection: "close-up on clue then pull to character face",     backgroundDetail: "bedroom or shared space, natural light",                    promptHint: "Betrayed character spots specific visual evidence. Close on clue — phone screen, unusual gift, something out of place." },
      { beatType: "investigation",      title: "Secret Investigation",        purpose: "Betrayed character quietly investigates on their own",                                                         emotionDirection: "nervous determination",                     actionDirection: "searching through evidence, following someone, or asking a trusted friend",  cameraDirection: "intimate close-up, solo character",                  backgroundDetail: "private space or public street following scene",            promptHint: "Character investigates alone. Focused, anxious, determined. Evidence or device in hands." },
      { beatType: "discovery",          title: "Undeniable Discovery",        purpose: "The hardest-hitting moment — undeniable proof is found",                                                       emotionDirection: "devastation and shock",                     actionDirection: "betrayed character sees proof that cannot be denied",                       cameraDirection: "dramatic face close-up capturing the moment of realization", backgroundDetail: "discovery location — their home, a hotel lobby, a street",  promptHint: "Full discovery. Visual proof undeniable. Character completely shattered. Wide eyes, trembling, silent scream." },
      { beatType: "explanation_defense","title": "Cheater's Excuse",          purpose: "Cheating partner tries to explain or deny, making situation worse",                                          emotionDirection: "guilt, defensiveness, or desperation",     actionDirection: "cheater gestures or pleads, betrayed character listens or turns away",     cameraDirection: "two-shot with emotional gap between characters",    backgroundDetail: "confrontation space — home hallway or living room",         promptHint: "Cheater tries to explain. Defensive posture, hands raised, guilty expression. Betrayed character unmoved or breaking further." },
      { beatType: "emotional_breakdown","title": "Emotional Breakdown",       purpose: "The emotional peak — the betrayed character's internal break",                                               emotionDirection: "grief, rage, or cold heartbreak",           actionDirection: "betrayed character alone or walking away, overwhelmed",                    cameraDirection: "solo emotional shot, profile or wide",              backgroundDetail: "private space — bedroom, street at night, or empty hallway", promptHint: "Betrayed character alone in their grief or rage. Shoulder shaking, tears, fists clenched, or eerily still and cold." },
      { beatType: "payoff",             title: "Final Revelation or Walk Away","purpose": "Story ends with a powerful emotional beat or shocking cliffhanger that makes viewer want more",          emotionDirection: "triumph, destruction, or shocking revelation", actionDirection: "character delivers final action — walk away, reveal a secret, or confront publicly", cameraDirection: "powerful dramatic shot — wide for walk-away or tight for reveal", backgroundDetail: "charged space or open area for departure",         promptHint: "Final beat. Character walks away with strength, delivers a shocking reveal, or leaves cheater exposed. Powerful posture." },
    ],
    10: [
      { beatType: "hook",                 title: "Perfect Couple Scene",     purpose: "Over-the-top happy couple moment to set up the fall",                                  emotionDirection: "surface joy",            actionDirection: "couple laughing or embracing, visibly happy",              cameraDirection: "warm two-shot",          backgroundDetail: "golden home interior",                 promptHint: "Happy couple. Joy and warmth. No conflict yet." },
      { beatType: "suspicious_setup",     title: "First Strange Moment",     purpose: "One small wrong detail that only attentive viewers notice",                            emotionDirection: "faint unease",           actionDirection: "partner glances at phone or pauses mid-conversation",      cameraDirection: "medium shot",            backgroundDetail: "domestic setting",                     promptHint: "Subtle suspicious moment. Partner seems briefly distracted." },
      { beatType: "suspicious_clue",      title: "Suspicious Clue",          purpose: "More concrete suspicious detail that confirms something is wrong",                     emotionDirection: "suspicion rising",       actionDirection: "betrayed character notices evidence",                      cameraDirection: "close on clue, then face", backgroundDetail: "shared home space",                  promptHint: "Physical evidence found. Betrayed character's expression shifts." },
      { beatType: "investigation",        title: "Secret Investigation",     purpose: "Betrayed character investigates privately without confrontation",                      emotionDirection: "anxious determination",  actionDirection: "character searches, questions, or follows",                cameraDirection: "tight solo shot",        backgroundDetail: "private space",                        promptHint: "Alone, investigating. Focused and nervous." },
      { beatType: "discovery",            title: "Proof Found",              purpose: "Hard evidence discovered — undeniable moment",                                         emotionDirection: "shock and devastation",  actionDirection: "sees visual proof",                                        cameraDirection: "dramatic face close-up", backgroundDetail: "discovery location",                   promptHint: "Discovery moment. Shattered expression. Undeniable proof." },
      { beatType: "attempt_confrontation","title": "Almost Confronted",       purpose: "Betrayed character almost confronts but holds back for bigger moment",                emotionDirection: "barely controlled fury", actionDirection: "starts to confront but stops themselves",                  cameraDirection: "tense two-shot",         backgroundDetail: "shared space",                         promptHint: "Betrayed character starts to speak but stops. Tears of rage held back." },
      { beatType: "emotional_breakdown",  title: "Private Breakdown",        purpose: "Alone moment of raw grief before the final confrontation",                             emotionDirection: "grief and rage",         actionDirection: "alone, breaking down or steeling themselves",              cameraDirection: "intimate solo shot",     backgroundDetail: "bedroom or bathroom",                  promptHint: "Raw private grief or fury. Tears or cold silence. Alone." },
      { beatType: "confrontation",        title: "Final Confrontation",      purpose: "The explosive main confrontation with evidence presented",                             emotionDirection: "controlled fury",        actionDirection: "presents evidence to cheater directly",                    cameraDirection: "intense two-shot",       backgroundDetail: "confrontation space",                  promptHint: "Evidence presented. Cheater caught. High emotional intensity." },
      { beatType: "twist_reveal",         title: "Shocking Twist",           purpose: "Unexpected revelation that recontextualizes the whole story",                         emotionDirection: "shock or irony",         actionDirection: "new information revealed from unexpected source",          cameraDirection: "dramatic close-up",      backgroundDetail: "charged location",                     promptHint: "Twist moment. New truth revealed. Both characters react to unexpected information." },
      { beatType: "payoff",               title: "Final Walk Away",          purpose: "Powerful closing image that leaves the viewer hooked",                                 emotionDirection: "triumph or devastation",  actionDirection: "final decisive action — walk away, public exposure, or revelation", cameraDirection: "wide powerful shot",  backgroundDetail: "open space or doorway",                promptHint: "Final moment. Strong walk-away or shocking public reveal. Character owns the scene." },
    ],
  },

  /* ── GETTING BABY ── */
  "baby": {
    4: [
      { beatType: "hook",          title: "Normal Family Moment",         purpose: "Establish the family/couple in a normal warm scene",                           emotionDirection: "warmth and normalcy",            actionDirection: "couple or family in regular home moment",          cameraDirection: "warm medium shot",       backgroundDetail: "cozy home, warm lighting",                         promptHint: "Normal warm family scene. No baby yet. Happy and comfortable." },
      { beatType: "baby_reveal",   title: "Baby Clue or Reveal",          purpose: "The baby is discovered, revealed, or the news is broken",                    emotionDirection: "surprise and wonder",            actionDirection: "baby item appears, news is given, or baby is seen",  cameraDirection: "close-up on reveal moment", backgroundDetail: "home space or hospital",                         promptHint: "Baby reveal moment. Tiny item, ultrasound, or baby character appears. Wonder and emotion." },
      { beatType: "reaction",      title: "Shock and Joy Reaction",       purpose: "Emotional reaction to the baby news or presence",                            emotionDirection: "shock, joy, or overwhelming emotion", actionDirection: "character reacts with big emotion to the news",   cameraDirection: "expressive face close-up",  backgroundDetail: "reaction location — home or hospital",           promptHint: "Big emotional reaction to baby news. Wide eyes, hands over mouth, tears of joy or shock." },
      { beatType: "payoff",        title: "Cute Payoff or Twist",         purpose: "Heartwarming resolution or unexpected sweet twist",                          emotionDirection: "joy, love, or sweet irony",      actionDirection: "baby bonding moment or sweet surprising twist",     cameraDirection: "warm wide shot or intimate close", backgroundDetail: "nursery, home, or hospital",                    promptHint: "Heartwarming final beat. Baby or family together. Sweet, emotional, wholesome." },
    ],
    6: [
      { beatType: "hook",          title: "Normal Family Life",           purpose: "Establish normal family life before the baby change",                        emotionDirection: "comfortable normalcy",           actionDirection: "couple in normal routine moment",                  cameraDirection: "warm medium shot",       backgroundDetail: "cozy home",                                        promptHint: "Normal family or couple scene. Comfortable and warm. No hint of change yet." },
      { beatType: "baby_hint",     title: "First Subtle Baby Hint",       purpose: "Drop the first hint that something new is coming",                           emotionDirection: "curiosity and suspense",         actionDirection: "small baby item appears in background or character notices something", cameraDirection: "subtle background clue shot", backgroundDetail: "home interior",                              promptHint: "Subtle hint. Tiny baby item in background. Character notices or pauses. Soft visual clue." },
      { beatType: "baby_reveal",   title: "The Baby Reveal",              purpose: "The big moment — baby news broken or baby character appears",               emotionDirection: "shock and overwhelming emotion", actionDirection: "news given, ultrasound shown, or baby fruit character appears", cameraDirection: "close-up on reveal then reaction", backgroundDetail: "home or hospital setting",                 promptHint: "Baby reveal. Ultrasound, baby item, or tiny baby fruit character shown. Emotional peak." },
      { beatType: "reaction",      title: "Emotional Reaction",           purpose: "Everyone's emotional reaction to the baby news",                            emotionDirection: "joy, shock, or sweet panic",     actionDirection: "character reacts with big visible emotion",        cameraDirection: "expressive face close-up",  backgroundDetail: "reaction space",                                promptHint: "Big emotional reaction. Tears of joy, shocked expression, or sweet overwhelmed face." },
      { beatType: "preparation",   title: "Chaotic Sweet Preparation",    purpose: "Funny or touching preparation for the baby's arrival",                      emotionDirection: "joyful chaos or gentle excitement", actionDirection: "setting up nursery, buying tiny things, or silly preparation moment", cameraDirection: "medium shot showing effort or chaos", backgroundDetail: "nursery or baby store",                      promptHint: "Preparation scene. Characters assembling crib, buying tiny items, or hilariously overwhelmed. Warm and sweet." },
      { beatType: "payoff",        title: "Heartwarming Final Moment",    purpose: "Sweet and emotional closing image with the baby",                           emotionDirection: "pure love and joy",              actionDirection: "baby bonding, first meeting, or sweet final twist",  cameraDirection: "intimate warm close-up",    backgroundDetail: "nursery or home",                               promptHint: "Final bonding moment. Baby and parent together. Overwhelmingly sweet and warm." },
    ],
    8: [
      { beatType: "hook",              title: "Normal Family Moment",        purpose: "Regular family or couple moment, no hint of change yet",                  emotionDirection: "warm comfort",               actionDirection: "ordinary home moment",                            cameraDirection: "warm medium shot",         backgroundDetail: "cozy home",                                    promptHint: "Normal comfortable family scene. Ordinary moment with warmth." },
      { beatType: "subtle_hint",       title: "Tiny Background Hint",        purpose: "First subtle clue planted in the background",                            emotionDirection: "slight curiosity",           actionDirection: "tiny baby item visible or character pauses oddly", cameraDirection: "wide shot with background detail", backgroundDetail: "home or kitchen",                            promptHint: "Background detail with tiny baby item. Character may or may not notice it yet." },
      { beatType: "baby_clue",         title: "Clear Baby Clue",             purpose: "A definite baby-related clue that the character notices",                emotionDirection: "growing realization",         actionDirection: "character picks up or discovers baby item clearly", cameraDirection: "close on item then face",  backgroundDetail: "bedroom or kitchen",                           promptHint: "Baby item clearly found. Character picks it up. Expression shifts from neutral to realization." },
      { beatType: "baby_reveal",       title: "The Big Baby Reveal",         purpose: "The main reveal moment — baby news given or baby appears",               emotionDirection: "shock and pure wonder",      actionDirection: "ultrasound shown, news broken, or baby fruit character appears", cameraDirection: "dramatic reveal close-up", backgroundDetail: "home or hospital",                           promptHint: "Big reveal moment. Undeniable baby news or tiny baby fruit character. Complete emotional peak." },
      { beatType: "reaction",          title: "Overwhelming Reaction",       purpose: "The full emotional reaction to the baby revelation",                     emotionDirection: "overwhelmed joy or shock",   actionDirection: "character reacts with maximum visible emotion",    cameraDirection: "face close-up, tears or laughter", backgroundDetail: "reveal space",                              promptHint: "Full emotional reaction. Tears streaming, hands over mouth, or falling to knees with joy." },
      { beatType: "preparation",       title: "Silly Preparation",           purpose: "Sweet or chaotic preparation scene showing love and overwhelm",          emotionDirection: "joyful overwhelm",           actionDirection: "assembling furniture, buying tiny clothes, chaotic shopping", cameraDirection: "medium shot in motion",  backgroundDetail: "nursery, baby store, or home",                 promptHint: "Preparation chaos. Characters overwhelmed but happy. Tiny items everywhere. Sweet and funny." },
      { beatType: "bonding",           title: "Touching Bonding Scene",      purpose: "Quiet emotional bonding moment — tender and real",                       emotionDirection: "pure love",                  actionDirection: "parent holds, talks to, or reads to baby/kid",     cameraDirection: "intimate warm close-up",   backgroundDetail: "nursery, couch, or bedroom",                   promptHint: "Quiet bonding moment. One character with the baby, tender and loving. Warm and intimate." },
      { beatType: "payoff",            title: "Sweet or Surprising Ending",  purpose: "Final heartwarming moment or sweet unexpected twist",                   emotionDirection: "joy and love",               actionDirection: "baby smiles, accepts them, or a sweet reveal completes the story", cameraDirection: "warm close shot or wide family shot", backgroundDetail: "home or nursery",                           promptHint: "Final sweet ending. Baby with family or sweet surprise. Heartwarming and smile-inducing." },
    ],
    10: [
      { beatType: "hook",           title: "Perfectly Normal Day",           purpose: "Establish the calm before the baby storm",                              emotionDirection: "comfortable normalcy",          actionDirection: "couple in regular morning routine",              cameraDirection: "warm medium",          backgroundDetail: "morning kitchen",                  promptHint: "Normal morning. Comfortable couple routine. Nothing unusual." },
      { beatType: "hint_setup",     title: "Odd Little Moment",              purpose: "A strange pause or small detail that doesn't quite fit",                emotionDirection: "mild curiosity",                actionDirection: "character pauses at something, doesn't react yet",cameraDirection: "observational",        backgroundDetail: "home space",                       promptHint: "Something feels slightly off. Character glances at something odd but continues." },
      { beatType: "baby_clue_1",    title: "First Real Clue",                purpose: "First undeniable baby-related clue appears",                           emotionDirection: "growing realization",            actionDirection: "tiny baby item noticed",                          cameraDirection: "close on item",        backgroundDetail: "bedroom or kitchen",               promptHint: "Baby item found. Character's face shifts. Close-up on tiny item." },
      { beatType: "baby_clue_2",    title: "More Clues Appear",              purpose: "Second clue confirms something significant is happening",               emotionDirection: "excitement mixed with nerves",   actionDirection: "another baby sign — morning sickness, tiny sock",  cameraDirection: "reaction close-up",    backgroundDetail: "bathroom or bedroom",              promptHint: "Second baby clue. Character putting pieces together. Expression: wonder and nerves." },
      { beatType: "baby_reveal",    title: "The Big Reveal",                 purpose: "Official baby reveal — the main emotional peak",                       emotionDirection: "shock and overwhelming joy",     actionDirection: "ultrasound, test result, or baby character appears", cameraDirection: "dramatic reveal",    backgroundDetail: "home or hospital",                 promptHint: "Full baby reveal. Undeniable. Complete emotional peak. Tears, wonder, shock." },
      { beatType: "reaction",       title: "Huge Emotional Reaction",        purpose: "The full emotional response from all characters",                      emotionDirection: "overwhelmed and joyful",         actionDirection: "characters react together or separately with full emotion", cameraDirection: "face close-up",  backgroundDetail: "reveal space",                     promptHint: "Full reaction scene. Multiple characters overwhelmed. Tears, laughter, hugging." },
      { beatType: "panic_prep",     title: "Chaotic Preparation Starts",     purpose: "Funny overwhelmed preparation mode begins",                            emotionDirection: "sweet panic",                    actionDirection: "ordering baby things, reading impossible manuals",  cameraDirection: "medium action shot",   backgroundDetail: "home being transformed",           promptHint: "Chaotic preparation begins. Overwhelmed but excited. Tiny items everywhere." },
      { beatType: "funny_chaos",    title: "Hilarious Baby Prep Fail",       purpose: "Funny moment of preparation going wrong",                              emotionDirection: "exasperated joy",                actionDirection: "crib assembly fail, mountain of boxes, or comical shopping disaster", cameraDirection: "wide comedic shot", backgroundDetail: "half-assembled nursery",          promptHint: "Something goes hilariously wrong with preparation. Exasperated but still happy." },
      { beatType: "bonding",        title: "Tender Quiet Moment",            purpose: "Emotional bonding moment before the final payoff",                     emotionDirection: "overwhelming love",               actionDirection: "quiet moment with baby or with partner about the baby", cameraDirection: "intimate close-up", backgroundDetail: "nursery or bedroom",              promptHint: "Quiet tender moment. Pure love. Peaceful and emotional." },
      { beatType: "payoff",         title: "Perfect Family Ending",          purpose: "Final heartwarming image or sweet surprise twist",                     emotionDirection: "complete joy and love",           actionDirection: "baby and family together, or sweet final twist",   cameraDirection: "warm wide or tight", backgroundDetail: "home or nursery",                  promptHint: "Perfect final moment. Complete family or sweet twist. Heartwarming and unforgettable." },
    ],
  },

  /* ── CHEATS BACK ── */
  "cheats-back": {
    4: [
      { beatType: "betrayal",      title: "Betrayal Discovery",           purpose: "Character discovers they have been cheated on",                               emotionDirection: "shock and heartbreak",             actionDirection: "discovers evidence of betrayal",                     cameraDirection: "dramatic close-up on shattered face",  backgroundDetail: "home or confrontation space",          promptHint: "Betrayal discovered. Character's heart breaking in the expression. Eyes wide or filling with tears." },
      { beatType: "glow_up",       title: "Confidence Transformation",    purpose: "Character rebuilds and transforms — glow up moment",                          emotionDirection: "confident determination",          actionDirection: "transformation visible — new look, new energy, head held high",  cameraDirection: "confident full-body shot",   backgroundDetail: "stylish modern setting",              promptHint: "Glow up. Character stands tall, new outfit, head high, no longer broken. Powerful energy." },
      { beatType: "cheater_regret","title": "Cheater Notices and Panics",  purpose: "The cheater sees the transformation and immediately regrets their choice",    emotionDirection: "jealousy and desperate regret",    actionDirection: "cheater spots the transformation and reacts with shock/jealousy", cameraDirection: "reaction shot — cheater's face",  backgroundDetail: "public setting or shared space",    promptHint: "Cheater spots the glow-up. Jealous, shocked, desperate expression. The tables have turned." },
      { beatType: "walk_away",     title: "Powerful Walk Away",           purpose: "Betrayed character walks away with complete power — final payoff",             emotionDirection: "triumph and freedom",              actionDirection: "character walks away without looking back",          cameraDirection: "wide powerful shot from behind",       backgroundDetail: "open space — street or lobby",         promptHint: "Final walk away. Confident, dignified, powerful. Not looking back. The ultimate win." },
    ],
    6: [
      { beatType: "betrayal",      title: "The Betrayal",                 purpose: "Opening with the betrayal or discovery of it",                                emotionDirection: "shock and heartbreak",             actionDirection: "character discovers or is confronted with the cheating", cameraDirection: "dramatic close-up",       backgroundDetail: "home interior",                        promptHint: "Discovery of betrayal. Shattered expression. Raw emotion." },
      { beatType: "heartbreak",    title: "Heartbroken Alone",            purpose: "Character is alone in their pain — the emotional low point",                   emotionDirection: "grief",                            actionDirection: "character alone, crying or staring into distance",   cameraDirection: "intimate solo shot",           backgroundDetail: "dark bedroom or rain-streaked window",  promptHint: "Character alone in grief. Tears, staring into nothing. The rock bottom moment." },
      { beatType: "glow_up",       title: "The Transformation",           purpose: "Character's glow-up and confidence transformation begins",                     emotionDirection: "rising determination",             actionDirection: "visible transformation — new energy, new look",      cameraDirection: "confident medium shot",        backgroundDetail: "stylish setting or mirror reveal",     promptHint: "Transformation begins. Character looks different and confident. Head up, new energy." },
      { beatType: "cheater_regret","title": "Cheater Gets Jealous",        purpose: "Cheater sees the transformation and realizes what they lost",                  emotionDirection: "jealousy and desperate longing",   actionDirection: "cheater spots transformation and visibly reacts",    cameraDirection: "cheater's face reaction shot",  backgroundDetail: "public space",                         promptHint: "Cheater's jealous reaction to the transformation. Desperate, regretful face." },
      { beatType: "betrayed_wins", title: "Betrayed Character Thrives",   purpose: "Betrayed character is visibly thriving — the revenge through success",         emotionDirection: "joy and power",                    actionDirection: "character successful, admired, or with someone new",  cameraDirection: "confident wide shot",          backgroundDetail: "public or social setting",             promptHint: "Betrayed character is thriving. Confident, joyful, admired. Complete power shift." },
      { beatType: "walk_away",     title: "Final Walk Away",              purpose: "Powerful final departure — the ultimate win",                                  emotionDirection: "triumphant freedom",               actionDirection: "character walks away or delivers final dismissal",   cameraDirection: "powerful wide or profile shot", backgroundDetail: "open space for departure",             promptHint: "Final powerful walk away. Not looking back. The ultimate win shot." },
    ],
    8: [
      { beatType: "betrayal_discovery","title": "Betrayal Discovery",     purpose: "Opening hit — character discovers the betrayal",                              emotionDirection: "shock",                            actionDirection: "discovers evidence",                                  cameraDirection: "close-up on realization",      backgroundDetail: "home",                                  promptHint: "Discovery moment. Raw shock and heartbreak visible on face." },
      { beatType: "heartbroken",    title: "Alone and Heartbroken",        purpose: "Character at their lowest emotional point",                                   emotionDirection: "grief and silence",                actionDirection: "alone, still, processing the pain",                   cameraDirection: "intimate solo",                backgroundDetail: "dark room or rain",                     promptHint: "Alone in grief. Still, tears or dry eyes. Total heartbreak." },
      { beatType: "glow_up_begins", title: "Rising from the Ashes",       purpose: "First signs of the transformation and confidence building",                   emotionDirection: "quiet determination",              actionDirection: "character makes a decision — looks in mirror or walks differently", cameraDirection: "mirror shot or rising shot", backgroundDetail: "bright private space",               promptHint: "First moment of reclaiming power. Standing taller, new resolve in their eyes." },
      { beatType: "confidence",     title: "The Full Glow Up",             purpose: "Peak transformation moment — visually stunning change",                       emotionDirection: "complete confidence",              actionDirection: "full transformation visible — outfit, posture, energy", cameraDirection: "full-body confident reveal", backgroundDetail: "stylish setting",                       promptHint: "Full glow up. Completely transformed. Radiates confidence and strength. Stunning." },
      { beatType: "cheater_notices","title": "Cheater Spots Them",         purpose: "Cheater sees the transformation and is immediately jealous",                  emotionDirection: "jealousy and regret",              actionDirection: "cheater spots the transformed character and freezes",  cameraDirection: "reaction split or profile",    backgroundDetail: "public or shared space",               promptHint: "Cheater spots the glow-up. Jaw drops. Jealous and desperate." },
      { beatType: "cheater_desperate","title": "Cheater Tries to Win Back", purpose: "Cheater desperately tries to reconnect and is rejected",                    emotionDirection: "cheater desperate, betrayed character cold", actionDirection: "cheater reaches out, betrayed character unmoved or turns away", cameraDirection: "two-shot with clear emotional gap", backgroundDetail: "public setting",                  promptHint: "Cheater desperate to win them back. Betrayed character looks away or past them. Ice cold." },
      { beatType: "done",           title: "I'm Done",                    purpose: "Betrayed character announces in expression they are completely over it",       emotionDirection: "total freedom and closure",        actionDirection: "character walks past or stands down the cheater",     cameraDirection: "profile or back-shot power walk", backgroundDetail: "confrontation space",                promptHint: "Character walks past the cheater without a glance. Completely done. Powerful." },
      { beatType: "walk_away",      title: "The Ultimate Walk Away",       purpose: "Final triumphant image — the ultimate payoff shot",                          emotionDirection: "triumph and freedom",              actionDirection: "walks away confidently, possibly with someone new",   cameraDirection: "wide cinematic shot",          backgroundDetail: "open beautiful space",                 promptHint: "Ultimate final walk away. Powerful, free, triumphant. Looking straight ahead." },
    ],
    10: [
      { beatType: "betrayal_discovery","title": "The Betrayal Hit",        purpose: "Hard opening with the discovery",                                            emotionDirection: "shock",                            actionDirection: "evidence discovered or confronted",                   cameraDirection: "close dramatic",               backgroundDetail: "home",                                  promptHint: "Hard hit. Discovery of betrayal. Raw shock." },
      { beatType: "full_breakdown",  title: "Complete Breakdown",          purpose: "Character fully breaks down alone",                                           emotionDirection: "total grief",                      actionDirection: "crying alone, sliding down wall, motionless",         cameraDirection: "intimate solo",                backgroundDetail: "dark bedroom",                          promptHint: "Full breakdown. Tears, collapsed, shattered." },
      { beatType: "alone_moment",    title: "Quiet Alone",                 purpose: "Character alone in silence — the calm before rebuilding",                    emotionDirection: "hollow silence",                   actionDirection: "sitting still, staring, processing",                  cameraDirection: "wide empty room shot",         backgroundDetail: "empty room",                            promptHint: "Quiet after the storm. Character still and empty. Processing." },
      { beatType: "glow_up_begins",  title: "Decision to Rise",            purpose: "The exact moment character decides to change",                               emotionDirection: "quiet determination ignites",      actionDirection: "stands up, looks in mirror, makes a decision",        cameraDirection: "mirror reflection or profile",  backgroundDetail: "bathroom or bedroom",                  promptHint: "Moment of decision. Standing up, new look in their eyes. Quiet fire." },
      { beatType: "confidence_peak", title: "Full Glow Up Revealed",       purpose: "Peak transformation — stunning visual reveal",                               emotionDirection: "complete confidence",              actionDirection: "fully transformed in public",                         cameraDirection: "full-body reveal",             backgroundDetail: "stylish public setting",               promptHint: "Peak glow up. Completely transformed. Radiates confidence. Turning heads." },
      { beatType: "cheater_notices", title: "Cheater Sees Them",           purpose: "Cheater spots the transformation",                                            emotionDirection: "jealousy",                         actionDirection: "cheater freezes seeing them",                         cameraDirection: "reaction shot",                backgroundDetail: "public space",                          promptHint: "Cheater spots the transformation. Frozen. Jaw dropped." },
      { beatType: "cheater_desperate","title": "Cheater Desperate",        purpose: "Cheater desperately tries to reconnect",                                      emotionDirection: "cheater desperate",                actionDirection: "reaching out or begging",                             cameraDirection: "two-shot gap",                 backgroundDetail: "confrontation",                         promptHint: "Cheater reaches out desperately. Betrayed character unmoved." },
      { beatType: "someone_new",     title: "Someone New Appears",         purpose: "New love interest or friend makes cheater even more jealous",                emotionDirection: "betrayed character joyful",        actionDirection: "character laughing with someone else or receiving attention", cameraDirection: "happy wide shot",         backgroundDetail: "social setting",                       promptHint: "Betrayed character with someone new. Happy, glowing. Cheater watching from distance." },
      { beatType: "final_confrontation","title": "Final Confrontation",    purpose: "Last words between betrayed and cheater",                                     emotionDirection: "complete power and closure",       actionDirection: "character faces cheater one last time and dismisses them",  cameraDirection: "powerful two-shot",           backgroundDetail: "confrontation space",                  promptHint: "Final face-to-face. Betrayed character completely in power. Cheater small and defeated." },
      { beatType: "triumphant_walk_away","title": "The Ultimate Win",      purpose: "Final triumphant departure — the story's most powerful image",               emotionDirection: "total triumph",                    actionDirection: "walks away into their new life",                      cameraDirection: "wide cinematic",               backgroundDetail: "open beautiful space",                 promptHint: "Ultimate win. Walking away into the light. Powerful. Free. Triumphant." },
    ],
  },

  /* ── SECRET TWIN ── */
  "secret-twin": {
    4: [
      { beatType: "off_feeling",    title: "Something Feels Off",         purpose: "Establish normal scene but something small is wrong",                         emotionDirection: "mild unease",                      actionDirection: "slight wrongness — wrong detail or odd behavior",    cameraDirection: "normal medium shot",           backgroundDetail: "familiar home or street",               promptHint: "Normal scene with one subtle wrong detail. A look or item out of place." },
      { beatType: "double_spotted", title: "Same Character Spotted Twice", purpose: "Character spotted in two places at once or in impossible situation",          emotionDirection: "confusion and disbelief",          actionDirection: "sees character in impossible location",              cameraDirection: "wide establishing confusion shot",  backgroundDetail: "public space",                         promptHint: "Impossible double sighting. Character seeing the 'same person' in two places. Confused expression." },
      { beatType: "twin_reveal",    title: "Twin Steps Forward",          purpose: "The secret twin is revealed — the main plot twist",                          emotionDirection: "shock and revelation",             actionDirection: "twin steps out or is identified clearly",            cameraDirection: "dramatic reveal shot",         backgroundDetail: "confrontation space",                   promptHint: "Twin revealed. Stepping forward from shadows. Near-identical but one visible difference." },
      { beatType: "final_twist",    title: "The Final Consequence",       purpose: "Story resolves with the twin's true purpose revealed",                       emotionDirection: "shock, irony, or resolution",     actionDirection: "true motive or connection revealed",                 cameraDirection: "dramatic close-up or wide reveal",  backgroundDetail: "confrontation space",                promptHint: "Twin's true motive revealed. Final twist. Expression of shock or ironic resolution." },
    ],
    6: [
      { beatType: "normal_off",     title: "Normal but Something's Off",  purpose: "Everything appears normal but one wrong detail exists",                       emotionDirection: "surface normalcy, background unease", actionDirection: "regular scene with one wrong detail",            cameraDirection: "normal shot",                  backgroundDetail: "home or familiar location",             promptHint: "Normal scene. One tiny wrong detail. The viewer almost misses it." },
      { beatType: "double_spotted", title: "Spotted in Two Places",       purpose: "Main character spotted somewhere they couldn't be",                           emotionDirection: "confusion",                        actionDirection: "double sighting or impossible location",             cameraDirection: "wide shot showing the impossible",  backgroundDetail: "public location",                      promptHint: "Double sighting. Character seen in impossible location. Complete confusion." },
      { beatType: "denial",         title: "Denial and Accusation",       purpose: "Main character denies being there, creating tension",                        emotionDirection: "defensive or genuinely confused",  actionDirection: "character denies presence, others accuse",           cameraDirection: "confrontation two-shot",        backgroundDetail: "shared space",                          promptHint: "Denial confrontation. One accuses, one genuinely denies. Who is lying?" },
      { beatType: "proof_found",    title: "Proof of Two",                purpose: "Evidence that there really are two — photo, video, or witness",              emotionDirection: "revelation and shock",             actionDirection: "proof shown — photo, recording, or witness confirms", cameraDirection: "close on proof then face",    backgroundDetail: "confrontation space",                   promptHint: "Proof revealed. Photo or recording shows two versions. Shock." },
      { beatType: "twin_reveal",    title: "Twin Revealed",               purpose: "The hidden twin steps forward for the first time",                           emotionDirection: "gasping shock",                    actionDirection: "twin emerges from shadows or other side of room",    cameraDirection: "dramatic reveal from shadows",  backgroundDetail: "dramatic space",                       promptHint: "Twin reveal. Stepping forward. Near-identical appearance but one clear visual difference." },
      { beatType: "trust_test",     title: "Who Do You Trust?",           purpose: "Others must choose which version to trust — the real and fake confront each other", emotionDirection: "tension and impossible choice", actionDirection: "both twins visible, others must choose",          cameraDirection: "two-shot of twins facing each other", backgroundDetail: "confrontation space",                 promptHint: "Both twins visible. Others must choose. Mirror-image confrontation." },
    ],
    8: [
      { beatType: "normal_off",     title: "Normal but Off",              purpose: "Establish normal scene with one small wrong detail",                          emotionDirection: "mild unease",                      actionDirection: "normal activity with wrong detail",                  cameraDirection: "normal medium shot",           backgroundDetail: "home",                                  promptHint: "Normal scene, one wrong detail. Almost unnoticeable." },
      { beatType: "odd_detail",     title: "Another Strange Detail",      purpose: "Second clue that something is deeply wrong",                                 emotionDirection: "growing unease",                   actionDirection: "another wrong detail appears",                        cameraDirection: "closer shot on wrong detail",  backgroundDetail: "home or work",                          promptHint: "Second wrong detail. Viewer now very curious." },
      { beatType: "double_spotted", title: "Seen in Two Places",          purpose: "Impossible double sighting — same character in two places",                  emotionDirection: "confusion and disbelief",          actionDirection: "character impossible sighting",                      cameraDirection: "wide establishing confusion",   backgroundDetail: "public space",                         promptHint: "Double sighting. Same character seen twice at once. Confused face." },
      { beatType: "confused",       title: "Confusion and Self-Doubt",    purpose: "Main character begins doubting their own perception",                        emotionDirection: "self-doubt and confusion",         actionDirection: "character questions themselves",                      cameraDirection: "solo intimate shot",           backgroundDetail: "private space",                         promptHint: "Self-doubt. Character alone, questioning their own memory. Unsettled face." },
      { beatType: "accusation",     title: "Confrontation and Accusation", purpose: "Others accuse the main character of lying or cheating",                    emotionDirection: "defensive shock",                  actionDirection: "accusation in front of others",                      cameraDirection: "accusation two-shot",          backgroundDetail: "shared space",                          promptHint: "Character accused. Defensive, genuinely shocked. Denying something they didn't do." },
      { beatType: "hidden_proof",   title: "Proof of the Twin",           purpose: "Evidence that there really are two of them",                                 emotionDirection: "revelation shock",                 actionDirection: "photo, recording, or witness reveals the twin",       cameraDirection: "close on proof then reaction",  backgroundDetail: "confrontation space",                  promptHint: "Proof found. Twin shown in evidence. Jaw drops." },
      { beatType: "twin_reveal",    title: "Twin Steps Forward",          purpose: "The hidden twin finally reveals themselves dramatically",                    emotionDirection: "gasping shock",                    actionDirection: "twin emerges dramatically",                          cameraDirection: "dramatic shadow-to-light reveal",  backgroundDetail: "dramatic space",                     promptHint: "Twin steps forward from shadows. Near-identical, one visible difference. Gasp moment." },
      { beatType: "final_twist",    title: "Bigger Revelation",           purpose: "Twin's true purpose or bigger secret revealed",                              emotionDirection: "shock or irony",                   actionDirection: "full twist revealed — motive, deeper secret",         cameraDirection: "wide reveal or dramatic close", backgroundDetail: "confrontation space",                  promptHint: "Final twist beyond the twin. Bigger secret or unexpected motivation revealed." },
    ],
    10: [
      { beatType: "normal_scene",  title: "Normal Day",                   purpose: "Everything normal to establish baseline",                              emotionDirection: "normalcy",            actionDirection: "regular activity",                               cameraDirection: "normal",         backgroundDetail: "home",          promptHint: "Completely normal day. No hint of anything wrong." },
      { beatType: "subtle_oddity", title: "Tiny Oddity",                  purpose: "Very subtle wrong detail most viewers would miss",                     emotionDirection: "vague unease",        actionDirection: "something very slightly off",                    cameraDirection: "normal with background detail", backgroundDetail: "home", promptHint: "One tiny thing that is wrong. Blink and miss it." },
      { beatType: "double_sighting","title": "Double Sighting Starts",    purpose: "First confusing sighting",                                            emotionDirection: "confusion",           actionDirection: "character seen somewhere odd",                   cameraDirection: "wide",           backgroundDetail: "public",        promptHint: "First confusing sighting. Not impossible yet, but strange." },
      { beatType: "denial",        title: "Denial",                       purpose: "Character denies being somewhere",                                     emotionDirection: "denial",              actionDirection: "genuinely denying",                              cameraDirection: "confrontation",  backgroundDetail: "shared space",  promptHint: "Denial. Genuinely confused by the accusation." },
      { beatType: "gathering_proof","title": "Gathering Proof",           purpose: "Someone starts collecting evidence",                                   emotionDirection: "investigative",       actionDirection: "collecting evidence",                            cameraDirection: "close on evidence", backgroundDetail: "various",     promptHint: "Evidence collection. Photos, videos, witnesses." },
      { beatType: "confrontation_attempt","title": "Confrontation Attempt", purpose: "First confrontation before full proof",                            emotionDirection: "tension",             actionDirection: "confrontation without full evidence",            cameraDirection: "two-shot",       backgroundDetail: "shared space",  promptHint: "Confrontation without full proof. Both frustrated." },
      { beatType: "twin_reveal",   title: "Twin Revelation",              purpose: "The twin is dramatically revealed",                                    emotionDirection: "gasping shock",       actionDirection: "twin emerges",                                   cameraDirection: "dramatic reveal", backgroundDetail: "dramatic space", promptHint: "Twin revealed. Gasp moment. Near-identical with one clear difference." },
      { beatType: "explanation",   title: "Twin Explains",                purpose: "Twin explains their secret purpose or history",                       emotionDirection: "revelation and shock", actionDirection: "twin speaks or shows proof of their story",      cameraDirection: "dramatic two-shot", backgroundDetail: "confrontation space", promptHint: "Twin explaining. Others listening in shock." },
      { beatType: "others_choose", title: "Who Do They Trust?",           purpose: "Others must decide who to trust",                                      emotionDirection: "impossible choice",   actionDirection: "choice must be made between twins",              cameraDirection: "triangle shot",  backgroundDetail: "confrontation space", promptHint: "The choice. Both twins. Others must decide." },
      { beatType: "final_consequence","title": "Final Consequence",        purpose: "The final revelation and consequence",                                 emotionDirection: "shock or resolution",  actionDirection: "final truth revealed and consequence played out",  cameraDirection: "wide dramatic",  backgroundDetail: "confrontation space", promptHint: "Final revelation. Bigger secret than just having a twin." },
    ],
  },

  /* ── KICKED OUT ── */
  "kicked-out": {
    4: [
      { beatType: "conflict",      title: "The Argument",                 purpose: "Explosive conflict that sets up the kicking out",                            emotionDirection: "heated anger and hurt",            actionDirection: "argument or accusation in full force",               cameraDirection: "intense two-shot",             backgroundDetail: "home interior",                         promptHint: "Heated argument. Both characters at peak emotion. Accusation and defense." },
      { beatType: "kicked_out",    title: "Thrown Out",                   purpose: "Character is physically thrown out or forced to leave",                      emotionDirection: "devastation and humiliation",      actionDirection: "character leaves with nothing or is pushed out",     cameraDirection: "wide sad shot showing exclusion",  backgroundDetail: "doorway or street at night",         promptHint: "Character standing outside with nothing. Alone in the street or rain. Door closed behind them." },
      { beatType: "determination", title: "Rising Determination",         purpose: "Character finds inner strength to move forward",                             emotionDirection: "quiet determination rising",       actionDirection: "character stands up straight, makes a decision",     cameraDirection: "profile shot with rising posture",  backgroundDetail: "street or empty space",               promptHint: "Character lifts their head. Quiet fierce determination. Standing tall despite pain." },
      { beatType: "payoff",        title: "Comeback or Confrontation",    purpose: "Character returns with power or truth is revealed",                          emotionDirection: "triumph or justice",               actionDirection: "character returns stronger or truth exposes wrongdoers", cameraDirection: "powerful wide or confrontation shot", backgroundDetail: "place they were rejected",         promptHint: "Character returns stronger. Or truth is revealed to those who rejected them. Power restored." },
    ],
    6: [
      { beatType: "conflict",      title: "Conflict Starts",              purpose: "Initial confrontation or accusation",                                        emotionDirection: "building anger",                   actionDirection: "argument or false accusation begins",                cameraDirection: "intense medium two-shot",       backgroundDetail: "home interior",                         promptHint: "Argument heating up. Accusation or confrontation at breaking point." },
      { beatType: "accusation",    title: "Accused and Blamed",           purpose: "Character is falsely accused or blamed",                                     emotionDirection: "shock and injustice",              actionDirection: "unjust accusation made in front of others",          cameraDirection: "character alone against accusers",  backgroundDetail: "home or workplace",                  promptHint: "Unjust accusation. Character shocked and hurt. Accused of something unfair." },
      { beatType: "kicked_out",    title: "Forced Out",                   purpose: "Character is kicked out into the cold",                                      emotionDirection: "devastation and humiliation",      actionDirection: "forced out with nothing, door closing",              cameraDirection: "wide lonely shot outside",      backgroundDetail: "night street or doorstep in rain",     promptHint: "Character alone outside. Door closed. Rain or cold night. Alone with nothing." },
      { beatType: "alone",         title: "Surviving Alone",              purpose: "Character persists alone — their determination begins",                      emotionDirection: "grief giving way to quiet determination", actionDirection: "alone but moving forward, finding small help",  cameraDirection: "solo shot with determined posture",  backgroundDetail: "street, shelter, or small room",    promptHint: "Alone but not broken. Character moving forward despite everything. Small determination." },
      { beatType: "rejecters_realize","title": "They Realize the Truth",  purpose: "Those who rejected the character begin to see they were wrong",              emotionDirection: "guilt and regret",                 actionDirection: "rejecters see proof of the character's innocence or success", cameraDirection: "reaction shot of rejecters",   backgroundDetail: "shared location",                    promptHint: "Rejecters realizing they were wrong. Guilt visible on their faces." },
      { beatType: "comeback",      title: "Confrontation or Forgiveness", purpose: "Character's comeback moment — confrontation, apology, or walk away",        emotionDirection: "justice, forgiveness, or final power", actionDirection: "confrontation with rejecters or dignified walk away", cameraDirection: "powerful confrontation or wide walk-away", backgroundDetail: "place of rejection",          promptHint: "Comeback confrontation. Character now in full power. Rejecters ashamed or apologetic." },
    ],
    8: [
      { beatType: "conflict_starts",  title: "Conflict Ignites",          purpose: "Conflict begins inside the home or community",                               emotionDirection: "building tension",                 actionDirection: "argument beginning or accusation being set up",       cameraDirection: "establishing tense medium shot",  backgroundDetail: "home or workplace",                  promptHint: "Conflict beginning. Tension visible. Accusation forming." },
      { beatType: "accusation",       title: "Unjust Accusation",         purpose: "Character is falsely accused and blamed",                                    emotionDirection: "shock and injustice",              actionDirection: "unjust blame placed on the character",               cameraDirection: "character isolated against group",  backgroundDetail: "confrontation space",               promptHint: "False accusation. Character stands alone against accusation. Injustice visible." },
      { beatType: "kicked_out",       title: "Kicked Out to the Street",  purpose: "Character forced out — the emotional low point",                             emotionDirection: "complete devastation",             actionDirection: "character physically pushed out or walks out in shock", cameraDirection: "wide sad outside shot",          backgroundDetail: "night street, rain, cold",           promptHint: "Character alone outside in the cold. Door closed. Rain or harsh weather. Completely alone." },
      { beatType: "alone",            title: "Struggling Alone",          purpose: "Character struggles alone in the streets or a shelter",                      emotionDirection: "grief and survival instinct",     actionDirection: "character navigating alone, finding shelter or help",  cameraDirection: "intimate solo journey shot",     backgroundDetail: "street, park bench, or humble shelter",              promptHint: "Alone in the world. Struggling but surviving. Small moments of help or kindness." },
      { beatType: "determination_rises","title": "Determination Rises",   purpose: "Character finds the resolve to fight back",                                  emotionDirection: "fierce quiet determination",      actionDirection: "character makes a firm decision, stands up straight",  cameraDirection: "profile power stance",           backgroundDetail: "open street or simple room",         promptHint: "Character finds their resolve. Standing straight, eyes clear, quiet fire." },
      { beatType: "work_hard",        title: "Working and Rising",        purpose: "Character rebuilds through hard work or helping others",                     emotionDirection: "focused determination and pride", actionDirection: "working hard, building something, or helping someone", cameraDirection: "medium action shot",             backgroundDetail: "work environment or community space",               promptHint: "Character working hard or helping others. Pride and determination visible." },
      { beatType: "rejecters_realize","title": "They See the Truth",      purpose: "Rejecters see the character's success or discover their innocence",          emotionDirection: "guilt and shame",                  actionDirection: "rejecters face truth — news, witness, or visible success", cameraDirection: "reaction shot of rejecters",   backgroundDetail: "shared or public space",             promptHint: "Rejecters confronted with truth. Guilt and shame visible on their faces." },
      { beatType: "payoff",           title: "Comeback Payoff",           purpose: "Character returns with power for final confrontation, forgiveness, or walk away", emotionDirection: "triumph, justice, or freedom",  actionDirection: "comeback confrontation, receives apology, or powerful walk away", cameraDirection: "powerful wide shot", backgroundDetail: "place of original rejection",     promptHint: "Final comeback. Full power restored. Rejecters face character's triumph." },
    ],
    10: [
      { beatType: "peaceful_start",   title: "Peaceful Normal Start",     purpose: "Establish normal peace before the conflict",                                 emotionDirection: "peace and comfort",                actionDirection: "character in normal comfortable role",               cameraDirection: "warm medium",            backgroundDetail: "home",                              promptHint: "Everything normal. Peaceful home. No conflict yet." },
      { beatType: "conflict_trigger", title: "Conflict Trigger",          purpose: "The event that starts the conflict",                                         emotionDirection: "building irritation",              actionDirection: "triggering event occurs",                             cameraDirection: "reaction shot",          backgroundDetail: "home",                              promptHint: "Trigger event. Small thing that starts the larger conflict." },
      { beatType: "accusation",       title: "Full Accusation",           purpose: "Character fully accused and blamed",                                         emotionDirection: "shock",                            actionDirection: "full accusation scene",                               cameraDirection: "character isolated",     backgroundDetail: "confrontation space",               promptHint: "Full accusation. Isolated character vs accusers." },
      { beatType: "kicked_out",       title: "Thrown Out",                purpose: "Character forced to leave",                                                  emotionDirection: "devastation",                      actionDirection: "forced out",                                          cameraDirection: "wide outside shot",      backgroundDetail: "night street",                      promptHint: "Alone outside. Cold and dark. Door shut." },
      { beatType: "street_alone",     title: "Alone in the Street",       purpose: "Character's lowest moment — completely alone",                               emotionDirection: "grief and survival",               actionDirection: "navigating alone on street",                          cameraDirection: "solo journey",           backgroundDetail: "street or shelter",                 promptHint: "Completely alone. Street or shelter. Survival mode." },
      { beatType: "finding_help",     title: "Finding an Unlikely Helper", purpose: "Character receives unexpected help or kindness",                            emotionDirection: "grateful relief",                  actionDirection: "helper appears or character finds unexpected resource",cameraDirection: "warm two-shot",          backgroundDetail: "public space or shelter",           promptHint: "Helper appears. Unexpected kindness. Small warmth in the cold." },
      { beatType: "rebuilding",       title: "Rebuilding",                purpose: "Character actively rebuilding their life",                                    emotionDirection: "focused determination",             actionDirection: "working, building, helping",                          cameraDirection: "action shot",            backgroundDetail: "work space",                        promptHint: "Active rebuilding. Working hard. Determination in every movement." },
      { beatType: "rejecters_see",    title: "Rejecters See Success",     purpose: "Rejecters become aware of the character's growth or success",                emotionDirection: "guilt and surprise",                actionDirection: "rejecters see the transformation",                    cameraDirection: "reaction shot",          backgroundDetail: "public or shared space",            promptHint: "Rejecters see the success. Surprise and guilt." },
      { beatType: "confrontation",    title: "Final Confrontation",       purpose: "Final face-to-face confrontation",                                           emotionDirection: "power and truth",                  actionDirection: "character faces rejecters one last time",             cameraDirection: "powerful two-shot",      backgroundDetail: "confrontation space",               promptHint: "Final confrontation. Character fully in power. Truth on the table." },
      { beatType: "payoff",           title: "Forgiveness or Walk Away",  purpose: "Final resolution — forgiveness granted or powerful walk away",               emotionDirection: "forgiveness or triumph",            actionDirection: "forgive with grace or walk away forever",              cameraDirection: "wide powerful",          backgroundDetail: "open space",                        promptHint: "Final resolution. Grace and forgiveness, or powerful final walk away." },
    ],
  },

  /* ── CUSTOM ── */
  "custom": {
    4: [
      { beatType: "hook",          title: "Strong Visual Hook",           purpose: "Instantly grab attention with a visually powerful opening moment",            emotionDirection: "intense or intriguing",            actionDirection: "striking opening action or revealing pose",           cameraDirection: "dramatic hook shot",           backgroundDetail: "story-appropriate environment",         promptHint: "Immediately attention-grabbing. Emotional or visually striking. Viewer must watch next scene." },
      { beatType: "problem",       title: "Problem Revealed",             purpose: "The main conflict or problem becomes clear",                                  emotionDirection: "tension or challenge",             actionDirection: "conflict or problem presented visually",             cameraDirection: "clear storytelling shot",       backgroundDetail: "conflict location",                    promptHint: "The core problem is visible. Stakes are clear. Tension." },
      { beatType: "confrontation", title: "Confrontation or Twist",       purpose: "Main confrontation or unexpected twist",                                      emotionDirection: "peak emotion",                     actionDirection: "confrontation or twist reveal",                      cameraDirection: "dramatic peak shot",            backgroundDetail: "confrontation or twist location",       promptHint: "Peak conflict moment or twist reveal. Full emotional intensity." },
      { beatType: "payoff",        title: "Payoff or Cliffhanger",        purpose: "Story resolves or leaves viewer demanding more",                             emotionDirection: "resolution or hunger for more",   actionDirection: "resolution moment or cliffhanger",                   cameraDirection: "powerful closing shot",         backgroundDetail: "story-appropriate finale setting",     promptHint: "Final moment. Resolution or cliffhanger. Viewer must see what happens next." },
    ],
    6: [
      { beatType: "hook",          title: "Strong Hook",                  purpose: "Instantly stop the scroll",                                                  emotionDirection: "intense or intriguing",            actionDirection: "striking opening",                                   cameraDirection: "hook shot",                     backgroundDetail: "opening environment",                  promptHint: "Stop-the-scroll opening. Maximum visual impact." },
      { beatType: "tension",       title: "Building Tension",             purpose: "Build curiosity and suspense",                                               emotionDirection: "suspense and curiosity",           actionDirection: "tension-building action",                            cameraDirection: "building tension shot",         backgroundDetail: "tension environment",                  promptHint: "Building tension. Viewer getting drawn in." },
      { beatType: "problem",       title: "First Problem",                purpose: "Core conflict introduced",                                                   emotionDirection: "problem established",              actionDirection: "first conflict moment",                              cameraDirection: "conflict establishing shot",    backgroundDetail: "conflict location",                    promptHint: "Core problem visible. Conflict established." },
      { beatType: "confrontation", title: "Confrontation",                purpose: "Characters face the conflict",                                               emotionDirection: "peak confrontation",               actionDirection: "direct confrontation",                               cameraDirection: "intense two-shot",              backgroundDetail: "confrontation space",                  promptHint: "Characters confronting each other or the situation. Full intensity." },
      { beatType: "peak",          title: "Emotional Peak",               purpose: "Highest emotional moment of the story",                                      emotionDirection: "peak emotion",                     actionDirection: "most emotional moment",                              cameraDirection: "maximum emotional close-up",    backgroundDetail: "peak moment location",                 promptHint: "The single most emotional moment of the story. Full impact." },
      { beatType: "payoff",        title: "Payoff or Cliffhanger",        purpose: "Story ends with power",                                                      emotionDirection: "resolution or intense curiosity",  actionDirection: "resolution or cliffhanger",                          cameraDirection: "powerful final shot",           backgroundDetail: "finale setting",                       promptHint: "Final moment. Resolution or cliffhanger. Must leave viewer hungry for more." },
    ],
    8: [
      { beatType: "hook",          title: "Visual Hook",                  purpose: "Stop-the-scroll opening",                                                    emotionDirection: "intense",             actionDirection: "striking opening",              cameraDirection: "hook",             backgroundDetail: "opening",       promptHint: "Maximum visual impact opening." },
      { beatType: "setup",         title: "Story Setup",                  purpose: "Establish characters and world",                                             emotionDirection: "establishment",       actionDirection: "normal or tense intro",         cameraDirection: "establishing",     backgroundDetail: "world setting",  promptHint: "World and characters established." },
      { beatType: "tension",       title: "Tension Builds",               purpose: "Pressure and curiosity build",                                               emotionDirection: "suspense",            actionDirection: "tension escalation",            cameraDirection: "building tension",  backgroundDetail: "tension space",  promptHint: "Tension building. Stakes becoming clear." },
      { beatType: "first_reveal",  title: "First Reveal",                 purpose: "First major plot revelation",                                                emotionDirection: "revelation shock",    actionDirection: "reveal moment",                 cameraDirection: "reveal close-up",  backgroundDetail: "reveal space",   promptHint: "First revelation. Viewer now knows something new." },
      { beatType: "confrontation", title: "Confrontation",                purpose: "Characters face the conflict",                                               emotionDirection: "confrontation",       actionDirection: "confrontation scene",           cameraDirection: "intense two-shot",  backgroundDetail: "confrontation space", promptHint: "Direct confrontation. High intensity." },
      { beatType: "twist",         title: "Unexpected Twist",             purpose: "Story goes in unexpected direction",                                         emotionDirection: "shock",               actionDirection: "twist event",                   cameraDirection: "dramatic twist",   backgroundDetail: "twist location",  promptHint: "Twist moment. Completely changes the story." },
      { beatType: "peak",          title: "Emotional Peak",               purpose: "Maximum emotional intensity",                                                emotionDirection: "peak emotion",        actionDirection: "most emotional moment",          cameraDirection: "peak close-up",    backgroundDetail: "peak location",  promptHint: "The maximum emotional moment. Everything comes together." },
      { beatType: "payoff",        title: "Payoff or Cliffhanger",        purpose: "Story ends powerfully",                                                     emotionDirection: "resolution or hunger", actionDirection: "final moment",                  cameraDirection: "powerful final",   backgroundDetail: "finale",         promptHint: "Final powerful moment. Resolution or cliffhanger." },
    ],
    10: [
      { beatType: "hook",          title: "Hook",              purpose: "Stop-the-scroll",            emotionDirection: "intense",             actionDirection: "striking opening",             cameraDirection: "hook",           backgroundDetail: "opening",                promptHint: "Maximum hook." },
      { beatType: "setup",         title: "Setup",             purpose: "Establish world",            emotionDirection: "establishing",        actionDirection: "character intro",              cameraDirection: "establishing",   backgroundDetail: "world setting",          promptHint: "World established." },
      { beatType: "mystery",       title: "Mystery Introduced", purpose: "Something unknown appears", emotionDirection: "curiosity",           actionDirection: "strange element introduced",   cameraDirection: "mystery shot",   backgroundDetail: "mystery space",          promptHint: "Strange element. Viewer curious." },
      { beatType: "escalation_1",  title: "Escalation 1",      purpose: "Stakes raise",               emotionDirection: "tension",             actionDirection: "first escalation",             cameraDirection: "building",       backgroundDetail: "tension space",          promptHint: "Stakes rising. Tension." },
      { beatType: "first_reveal",  title: "First Reveal",      purpose: "First revelation",           emotionDirection: "revelation",          actionDirection: "reveal event",                 cameraDirection: "reveal",         backgroundDetail: "reveal space",           promptHint: "First reveal." },
      { beatType: "confrontation",  title: "Confrontation",     purpose: "First confrontation",        emotionDirection: "confrontation",       actionDirection: "confrontation scene",           cameraDirection: "two-shot",       backgroundDetail: "confrontation space",    promptHint: "Direct confrontation." },
      { beatType: "twist",         title: "Twist",             purpose: "Unexpected turn",            emotionDirection: "shock",               actionDirection: "twist event",                  cameraDirection: "dramatic",       backgroundDetail: "twist location",         promptHint: "Twist." },
      { beatType: "peak",          title: "Emotional Peak",    purpose: "Maximum intensity",          emotionDirection: "peak",                actionDirection: "most emotional moment",          cameraDirection: "close-up",       backgroundDetail: "peak location",          promptHint: "Peak moment." },
      { beatType: "decision",      title: "Final Decision",    purpose: "Character makes final choice", emotionDirection: "decision",          actionDirection: "final choice made",             cameraDirection: "choice shot",    backgroundDetail: "decision space",         promptHint: "Final decision moment." },
      { beatType: "payoff",        title: "Final Payoff",      purpose: "Story resolves powerfully",  emotionDirection: "resolution",          actionDirection: "final payoff",                 cameraDirection: "powerful final", backgroundDetail: "finale",                 promptHint: "Final powerful payoff." },
    ],
  },
};

/* ─── PRESET DETECTION ─── */
const CHEATING_KEYWORDS  = /\b(cheat|cheating|affair|mistress|betray|betrayal|secret\s+lover|caught|infidelity)\b/i;
const BABY_KEYWORDS      = /\b(baby|born|pregnant|pregnancy|born\s+baby|newborn|infant|expecting|ultrasound)\b/i;
const CHEATSBACK_KEYWORDS = /\b(cheats?\s+back|revenge\s+cheat|cheat\s+revenge|get\s+back\s+at)\b/i;
const SECRETTWIN_KEYWORDS = /\b(secret\s+twin|hidden\s+twin|twin\s+reveal|look\s+alike|doppelganger)\b/i;
const KICKEDOUT_KEYWORDS  = /\b(kicked\s+out|thrown\s+out|homeless|evicted|rejected|forced\s+out)\b/i;

function detectPreset(input: { storyPreset?: string; storyIdea?: string; conflict?: string }): StoryPreset {
  const preset = (input.storyPreset ?? "").toLowerCase().trim() as StoryPreset;
  const text = `${input.storyPreset ?? ""} ${input.conflict ?? ""} ${input.storyIdea ?? ""}`;

  if (preset === "cheating" || CHEATING_KEYWORDS.test(text)) return "cheating";
  if (preset === "baby" || BABY_KEYWORDS.test(text)) return "baby";
  if (preset === "cheats-back" || CHEATSBACK_KEYWORDS.test(text)) return "cheats-back";
  if (preset === "secret-twin" || SECRETTWIN_KEYWORDS.test(text)) return "secret-twin";
  if (preset === "kicked-out" || KICKEDOUT_KEYWORDS.test(text)) return "kicked-out";
  if (preset === "custom") return "custom";
  return "custom";
}

function getBeatsForPresetAndCount(preset: StoryPreset, sceneCount: number): BeatTemplate[] {
  const presetBeats = PRESET_BEATS[preset] ?? PRESET_BEATS.custom;
  // Current product flow: 3/5/7/10 image scenes, one scene per 6s video clip.
  const supported = [3, 5, 7, 10];
  if (presetBeats[sceneCount]) return presetBeats[sceneCount];

  const oldTemplateCount =
    sceneCount <= 3 ? 4 :
    sceneCount <= 5 ? 6 :
    8;
  const baseBeats = presetBeats[oldTemplateCount] ?? presetBeats[8] ?? presetBeats[6] ?? PRESET_BEATS.custom[8] ?? PRESET_BEATS.custom[6]!;

  if (sceneCount === 3) {
    return [baseBeats[0], baseBeats[1] ?? baseBeats[2], baseBeats[baseBeats.length - 1]].filter(Boolean);
  }
  if (sceneCount === 5) {
    return [baseBeats[0], baseBeats[1], baseBeats[3] ?? baseBeats[2], baseBeats[4] ?? baseBeats[baseBeats.length - 2], baseBeats[baseBeats.length - 1]].filter(Boolean);
  }
  if (sceneCount === 7) {
    return [baseBeats[0], baseBeats[1], baseBeats[2], baseBeats[3], baseBeats[4], baseBeats[5] ?? baseBeats[4], baseBeats[baseBeats.length - 1]].filter(Boolean);
  }
  if (sceneCount <= baseBeats.length) return baseBeats.slice(0, sceneCount);

  // Pad by repeating escalation beats
  const result = [...baseBeats];
  while (result.length < sceneCount) {
    const insertAt = Math.max(1, result.length - 1);
    const escalation: BeatTemplate = {
      beatType: "escalation",
      title: `Escalation ${result.length - baseBeats.length + 1}`,
      purpose: "Additional story escalation and tension building",
      emotionDirection: "rising tension",
      actionDirection: "story escalates with new pressure or revelation",
      cameraDirection: "medium to close shot tracking tension",
      backgroundDetail: "same location as surrounding scenes",
      promptHint: "Tension rising. Characters under increasing pressure. Emotion escalating.",
    };
    result.splice(insertAt, 0, escalation);
  }
  return result.slice(0, sceneCount);
}

interface CharInput {
  id?: string;
  name?: string;
  role?: string;
  description?: string;
  image?: string;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/_+/g, "_");
}

function inferFruitType(c: CharInput): string {
  const text = `${c.id ?? ""} ${c.name ?? ""} ${c.role ?? ""}`.toLowerCase();
  const FRUIT_DETECTION_ORDER = [
    "pineapple",
    "strawberry",
    "watermelon",
    "blueberry",
    "raspberry",
    "blackberry",
    "banana",
    "orange",
    "lemon",
    "mango",
    "peach",
    "coconut",
    "apple",
    "pear",
    "kiwi",
  ];
  if (text.includes("ananas")) return "pineapple";
  for (const fruit of FRUIT_DETECTION_ORDER) {
    if (text.includes(fruit)) return fruit;
  }
  if (text.includes("brokkoli")  || text.includes("broccoli")) return "broccoli";
  return slug(c.name ?? c.id ?? "fruit") || "fruit";
}

// Lightweight fallback — only used when GPT doesn't assign a role from the images.
// Primary role assignment happens via GPT-4o Vision looking at the actual character images.
function inferNarrativeRole(c: CharInput, index: number, preset: StoryPreset): string {
  const text = `${c.id ?? ""} ${c.name ?? ""} ${c.role ?? ""} ${c.description ?? ""}`.toLowerCase();
  const cheating = preset === "cheating" || preset === "cheats-back";

  // Always a kid if name says so
  if (/\b(kid|son|child|baby|lemon kid|orange kid|apple son)\b/.test(text)) return "kid";

  if (cheating) {
    // Obvious affair partner markers
    if (/\b(mistress|affair|lover|hotpeach|hot peach)\b/.test(text)) return "affair_partner";
    if (/\bpeach\b/.test(text) && !/\b(mom|mother)\b/.test(text))    return "affair_partner";
    // Obvious cheater markers
    if (/\b(banana|gangster|villain|boss mango|bossmango)\b/.test(text)) return "cheater";
    // Index-based final fallback
    if (index === 0) return "victim";
    if (index === 1) return "cheater";
    if (index === 2) return "affair_partner";
    return "friend";
  }

  if (/\b(boss|authority)\b/.test(text))   return "boss";
  if (/\b(villain|gangster|rival)\b/.test(text)) return "villain";
  if (/\b(mom|mother|dad|father|parent)\b/.test(text)) return "parent";
  if (index === 0) return "protagonist";
  if (index === 1) return "antagonist";
  return "supporting";
}

function buildCanonicalCast(selectedCharacters: CharInput[], preset: StoryPreset) {
  const cheating = preset === "cheating" || preset === "cheats-back";
  return selectedCharacters.map((c, index) => {
    const fruitType      = inferFruitType(c);
    const narrativeRole  = inferNarrativeRole(c, index, preset);
    const roleForId      = narrativeRole === "victim" && cheating ? "wife"
      : narrativeRole === "cheater" && cheating ? "cheater"
      : narrativeRole === "affair_partner" ? "affair_partner"
      : narrativeRole;

    const displayName    = c.name ?? c.id ?? `Character ${index + 1}`;
    const nameSlug       = slug(displayName);
    const fruitSlug      = slug(fruitType);
    const id             = nameSlug.startsWith(fruitSlug)
      ? `${roleForId}_${nameSlug}`
      : `${roleForId}_${fruitSlug}_${nameSlug}`;
    const cleanId        = id.replace(/_+/g, "_");
    const referenceLabel = cleanId.toUpperCase();

    const narrativeFunction = {
      victim:        "main betrayed character — emotionally driven protagonist who discovers and reacts",
      cheater:       "cheating partner — secretive and defensive, the source of the conflict",
      affair_partner:"affair partner — visually distinct from the betrayed partner, never interchangeable",
      kid:           "child character — emotionally affected but never role-swapped into an adult",
      boss:          "authority figure — creates workplace pressure or is a power character",
      villain:       "antagonist — creates conflict and pressure",
      friend:        "supporting friend — trusted confidant or plot helper",
      sibling:       "sibling — emotionally connected family member",
      parent:        "parent character — protective or conflict-creating family authority",
      protagonist:   "main character driving the story",
      antagonist:    "opposing force creating conflict",
      supporting:    "supporting character with stable story function",
    }[narrativeRole] ?? "supporting character";

    const genderPresentation = /mom|wife|girl|mistress|mother|female/i.test(`${c.id ?? ""} ${c.name ?? ""} ${c.role ?? ""}`)
      ? "feminine-presenting"
      : /dad|husband|boy|son|male/i.test(`${c.id ?? ""} ${c.name ?? ""} ${c.role ?? ""}`)
        ? "masculine-presenting"
        : "unspecified";

    return {
      id:                 cleanId,
      sourceCharacterId:  c.id ?? cleanId,
      role:               narrativeRole,
      referenceLabel,
      label:              referenceLabel,
      displayName,
      narrativeRole,
      fruitType,
      genderPresentation,
      identityLock: `${fruitType} fruit character — same face, same peel color, same body shape, same outfit and accessories, identity locked across every scene`,
      visualIdentity: `${displayName} is a ${fruitType} fruit-human character; preserve exact appearance, colors, outfit, and face from the reference image`,
      appearance: `${displayName}: ${fruitType} fruit-human character, ${genderPresentation}`,
      clothing: `consistent outfit and accessories from the ${referenceLabel} reference image`,
      narrativeFunction,
      relationships: cheating
        ? "locked cheating-drama relationship map; betrayed partner, cheater, and affair partner are always visually and narratively distinct"
        : "locked relationship to selected cast — role never drifts",
      personality: narrativeRole === "victim"       ? "emotionally present, perceptive, and growing stronger through the story"
        : narrativeRole === "cheater"               ? "secretive, nervous when caught, defensive when confronted"
        : narrativeRole === "affair_partner"        ? "visually distinct from the betrayed partner; never visually or narratively interchangeable"
        : narrativeRole === "kid"                   ? "innocent child character; never role-swapped into an adult"
        : "supporting character with a stable personality and story function",
    };
  });
}

function mergeCastWithPlanner(canonicalCast: any[], plannedCast: any[] = []) {
  return canonicalCast.map((base) => {
    const match = plannedCast.find((c: any) =>
      c?.id === base.id ||
      c?.sourceCharacterId === base.sourceCharacterId ||
      c?.referenceLabel === base.referenceLabel ||
      c?.label === base.referenceLabel ||
      c?.displayName === base.displayName
    );
    return {
      ...base,
      appearance:    match?.appearance    || base.appearance,
      clothing:      match?.clothing      || base.clothing,
      personality:   match?.personality   || base.personality,
      narrativeRole: base.narrativeRole,
      role:          base.role,
      referenceLabel: base.referenceLabel,
      label:         base.label,
      visualIdentity: base.visualIdentity,
    };
  });
}

function labelsForIds(ids: string[], cast: any[]) {
  const byId = new Map(cast.map((c) => [c.id, c]));
  return ids.map((id) => byId.get(id)?.referenceLabel).filter(Boolean) as string[];
}

function resolveSceneIds(scene: any, index: number, cast: any[], beats: BeatTemplate[]): string[] {
  const validIds = new Set(cast.map((c) => c.id));
  const byLabel  = new Map(cast.map((c) => [c.referenceLabel, c.id]));
  const raw      = [...(scene.characterIdsInScene ?? []), ...(scene.charactersInScene ?? [])];

  const ids = raw
    .map((v: string) => validIds.has(v) ? v : byLabel.get(v))
    .filter((id: string | undefined): id is string => !!id && validIds.has(id));

  if (ids.length > 0) return Array.from(new Set(ids));

  // Fallback using beat template context
  const beat = beats[index];
  if (!beat) return [cast[0]?.id].filter(Boolean);

  const victim  = cast.find((c) => c.narrativeRole === "victim" || c.narrativeRole === "protagonist");
  const cheater = cast.find((c) => c.narrativeRole === "cheater" || c.narrativeRole === "antagonist");
  const affair  = cast.find((c) => c.narrativeRole === "affair_partner");
  const kid     = cast.find((c) => c.narrativeRole === "kid");
  const support = cast.find((c) => !["victim","protagonist","cheater","antagonist","affair_partner"].includes(c.narrativeRole));

  const present = (...opts: Array<any | undefined>) => opts.filter((c) => c?.id).map((c) => c.id) as string[];

  const fallbacks: Record<string, string[]> = {
    // Couple/happy scenes — victim + cheater together
    hook:               present(victim, cheater),
    off_feeling:        present(victim, cheater),
    normal_off:         present(victim, cheater),
    suspicious_clue:    present(victim, cheater),

    // Suspicion — victim notices something wrong, cheater may be present
    suspicion:          present(victim, cheater),

    // THE AFFAIR — cheater + affair_partner shown together (this is what the viewer wants to see)
    suspicious_behavior:present(cheater, affair),
    investigation:      present(cheater, affair),   // shows the actual affair happening
    affair_scene:       present(cheater, affair),
    cheater_regret:     present(cheater, affair),
    cheater_notices:    present(cheater, affair),

    // DISCOVERY — victim catches them, show all 3 or victim + affair_partner
    discovery:          present(victim, cheater, affair),
    twist_reveal:       present(victim, cheater, affair),
    cheating_caught:    present(victim, cheater, affair),

    // CONFRONTATION — all 3 or victim + cheater
    explanation_defense:present(victim, cheater),
    confrontation:      present(victim, cheater),
    cheater_desperate:  present(cheater, victim),

    // Emotional solo scenes
    emotional_breakdown:present(victim),
    glow_up:            present(victim),
    done:               present(victim),
    walk_away:          present(victim),
    betrayal:           present(victim),
    heartbreak:         present(victim),
    heartbroken:        present(victim),
    alone:              present(victim),
    determination:      present(victim),
    determination_rises:present(victim),

    // Twin / reveal scenes
    twin_reveal:        present(victim, affair ?? support),
    double_spotted:     present(victim, affair ?? support),

    // Baby / family scenes
    baby_hint:          present(victim),
    baby_clue:          present(victim),
    baby_reveal:        present(victim, cheater),
    reaction:           present(victim, cheater),
    preparation:        present(victim, cheater),
    bonding:            present(victim, kid),
    conflict:           present(victim, cheater),
    kicked_out:         present(victim),

    // Resolution
    payoff:             present(victim, cheater),
    comeback:           present(victim, cheater),
    rejecters_realize:  present(cheater),
  };

  return Array.from(new Set(fallbacks[beat.beatType] ?? present(victim ?? cast[0])));
}

function appendStrictImageRules(
  prompt: string,
  beat: BeatTemplate,
  presentIds: string[],
  forbiddenIds: string[],
  cast: any[],
) {
  const presentLabels  = labelsForIds(presentIds,  cast);
  const forbiddenLabels = labelsForIds(forbiddenIds, cast);
  const base = String(prompt ?? "")
    .replace(/STRICT RULES:[\s\S]*$/i, "")
    .replace(/STORY BEAT:[\s\S]*?(?=\n\S)/i, "")
    .replace(/CHEATING BEAT:[\s\S]*?(?=\n\S)/i, "")
    .trim();

  const scenePrompt = base || beat.promptHint ||
    `A cinematic 3D fruit drama scene. ${presentLabels.join(" and ")} in a ${beat.emotionDirection} moment.`;

  return [
    scenePrompt,
    "",
    `SCENE BEAT: ${beat.beatType.toUpperCase()} — ${beat.title}`,
    `Story purpose: ${beat.purpose}`,
    `Required emotion: ${beat.emotionDirection}`,
    `Required action: ${beat.actionDirection}`,
    `Camera/framing: ${beat.cameraDirection}`,
    `Background: ${beat.backgroundDetail}`,
    "",
    "STRICT SCENE RULES:",
    `- Show ONLY these characters: ${presentLabels.join(", ") || "listed cast"}`,
    `- Do NOT show: ${forbiddenLabels.length ? forbiddenLabels.join(", ") : "any other named recurring character"}`,
    "- No extra background main characters not in the scene cast",
    "- Keep all recurring characters visually identical to their reference images",
    "- Do not merge, swap, or redesign any character identity",
    "NO text, NO captions, NO subtitles, NO speech bubbles, NO watermarks, NO typography.",
  ].filter((l) => l !== null).join("\n");
}

function repairScenes(
  planScenes: any[],
  cast: any[],
  beats: BeatTemplate[],
  sceneCount: number,
) {
  const allIds = cast.map((c) => c.id);
  return Array.from({ length: sceneCount }).map((_, index) => {
    const source      = planScenes[index] ?? {};
    const beat        = beats[index] ?? beats[beats.length - 1];
    const presentIds  = resolveSceneIds(source, index, cast, beats);
    const forbiddenIds = allIds.filter((id) => !presentIds.includes(id));

    return {
      ...source,
      sceneNumber:           index + 1,
      title:                 source.title          || beat.title          || `Scene ${index + 1}`,
      durationSeconds:       source.durationSeconds ?? 6,
      beatType:              beat.beatType,
      storyPurpose:          source.scenePurpose   || source.storyPurpose || beat.purpose,
      scenePurpose:          source.scenePurpose   || beat.purpose,
      emotionDirection:      source.emotionDirection  || beat.emotionDirection,
      actionDirection:       source.actionDirection   || beat.actionDirection,
      cameraDirection:       source.cameraDirection   || beat.cameraDirection,
      backgroundDetail:      source.backgroundDetail  || beat.backgroundDetail,
      environment:           source.environment       || beat.backgroundDetail.split(" ")[0] || "home",
      continuityFromPrevious: Boolean(source.continuityFromPrevious),
      characterIdsInScene:   presentIds,
      charactersInScene:     presentIds,
      charactersNotInScene:  forbiddenIds,
      forbiddenCharacters:   forbiddenIds,
      emotionalBeat:         source.emotionalBeat || beat.emotionDirection,
      captionText:           source.captionText   || "",
      imagePrompt:           appendStrictImageRules(
        source.imagePrompt ?? "",
        beat,
        presentIds,
        forbiddenIds,
        cast,
      ),
      videoPrompt: String(source.videoPrompt ?? `SPOKEN DIALOGUE - SAY EXACTLY: FRUIT CHARACTER: "Say it now." Speech rules: Dialogue starts in the first second. Speak English only. Say exactly the quoted line. No silent intro. No background music. Action: ${beat.actionDirection}. Emotion: ${beat.emotionDirection}. Visual clue: one clear physical clue from the image. Movement: fast expressive gestures and mouth-synced speech. Camera: vertical 9:16 close-up with fast push-in. Audio: clear mouth-synced dialogue only, no background music, one small sound effect if useful, light room ambience only. Ending beat: mini cliffhanger reaction. Negative: no captions, no subtitles, no text overlays, no logos, no watermarks, no extra characters, no identity changes, no background music.`)
        .replace(/\s*No text overlays, no watermarks, no subtitles\.?$/i, "").trim() +
        " No text overlays, no watermarks, no subtitles.",
      negativePrompt: "text, letters, subtitles, watermark, logo, speech bubbles, collage, multiple panels, split screen, ui elements, captions, extra main characters, identity swap",
    };
  });
}

/* ─── SYSTEM PROMPT ─── */
const SYSTEM_BASE = `You are Fruit Movie Maker AI — a viral TikTok short-form story director for cinematic 3D fruit-human drama videos.

Your ONLY job: write ONE continuous story that plays like a real viral TikTok drama series when all clips are stitched together. Think of it as a mini TV episode split into 6-second clips — each clip ends on a cliffhanger, the next clip immediately resolves it.

════════════════════════════════════════
RULE 1 — LOCKED ROLES (ABSOLUTE — NEVER DRIFT)
════════════════════════════════════════

Roles are assigned ONCE in the cast bible and NEVER EVER change:
- victim stays victim in every single scene
- cheater stays cheater in every single scene
- affair_partner stays affair_partner in every single scene

A "gangster pineapple" character with narrativeRole="cheater" IS the cheating husband in EVERY scene. Their costume/title does not change their story role. NEVER let a character behave like a "boss" or "authority" if their narrativeRole is "cheater" — they are the cheating partner, period.

════════════════════════════════════════
RULE 2 — CHEATING STORY CHARACTER RULES
════════════════════════════════════════

In cheating/cheats-back stories with 3 characters:
- VICTIM (character 1): betrayed partner. In scenes: hook (with cheater), suspicion (alone), discovery (alone or catches all), confrontation (with cheater), payoff.
- CHEATER (character 2): cheating partner. In scenes: hook (with victim, loving but hiding something), AFFAIR SCENE (alone with affair_partner — THIS IS REQUIRED), confrontation (with victim), maybe payoff.
- AFFAIR_PARTNER (character 3): third party. MUST appear in AT LEAST 2 scenes: (1) alone with cheater = the actual affair scene, (2) discovery scene where victim catches them or finds proof of them.

HARD REQUIREMENT: Include ONE scene where cheater + affair_partner are shown TOGETHER without the victim. This is the "affair happening" scene. Without this, the story makes no sense visually.

════════════════════════════════════════
RULE 3 — ONE CONTINUOUS STORY (CRITICAL)
════════════════════════════════════════

All scenes happen in the SAME evening/night in the SAME primary location (their home/apartment).
The viewer must feel they are watching ONE story, not unrelated clips.

CONTINUITY REQUIREMENTS:
- Set all scenes in the same home unless a scene REQUIRES a new location
- Each scene's background/lighting matches adjacent scenes (same room = same furniture, same lighting)
- Emotional state carries forward: shattered in scene 3 → tear-streaked in scene 4
- Props carry forward: phone slammed in scene 3 → phone on floor in scene 4
- Scene N always visually references what just happened in scene N-1

PACING — think like a TV director:
- Scene 1: DROP INTO the drama immediately. First frame = viewer asks "wait what??"
- Scene 2-3: Escalate. Viewer says "oh no..."
- Scene 4-5: Discovery/confrontation. Viewer says "OH WOW"
- Final: Payoff or bigger twist. Viewer shares it.

Every scene: START LATE (mid-action), END EARLY (before resolution), HOOK THE VIEWER.

════════════════════════════════════════
VISION — YOU CAN SEE THE CHARACTER IMAGES
════════════════════════════════════════

The character reference images are attached to this message. Use what you SEE to assign narrative roles — do not guess from names alone.

Look at each character's:
- Visual energy: aggressive/dominant → cheater or villain. Soft/emotional → victim. Glamorous/flirtatious → affair_partner. Innocent/small → kid.
- Gender presentation: determines who plays which side of a romantic relationship.
- Outfit and posture: a character in a power pose with designer clothes reads differently from one looking worried in casual clothes.
- Fruit type is cosmetic only — a pineapple character can be a victim, a cheater, or anything. Look at their expression and energy, not just their fruit.

For cheating stories with 3 characters, look at the images and ask:
- Which one looks like the heartbroken/betrayed partner? → victim
- Which one looks like they're hiding something / dominant / secretive? → cheater
- Which one looks glamorous / flirtatious / the "other woman/man"? → affair_partner

This vision-based casting works for ALL characters including custom imported ones.

════════════════════════════════════════
PART 1 — CAST BIBLE (cast[])
════════════════════════════════════════

Define permanent cast ONCE. narrativeRole is LOCKED forever. Use the images above to determine roles.

════════════════════════════════════════
PART 2 — SCENE LIST (scenes[])
════════════════════════════════════════

IMAGE PROMPT RULES:
1. ONE single cinematic moment — no split panels, no collages
2. Reference characters ONLY by their UPPERCASE referenceLabel
3. ONLY characters in characterIdsInScene appear — all others completely absent
4. Background must visually match adjacent scenes (same room = same decor/lighting)
5. End EVERY imagePrompt with: "NO text, NO captions, NO subtitles, NO speech bubbles, NO watermarks, NO typography."
6. Structure: [characters+actions] → [exact emotion+body language] → [camera] → [environment+lighting matching previous scene] → [cinematic 3D fruit drama style] → [NO text rule]
7. SAFETY — image prompts are processed by OpenAI which has strict content filters. NEVER use these words in imagePrompt: seductive, sensual, sexy, intimate, flirtatious, kissing, embrace, tight dress, cleavage, body, curves, passionate, desire, lust, affair, mistress, infidelity, lipstick mark. Use safe alternatives: emotional, close, elegant, standing together, heartbroken, shocked, tense.

DIALOGUE RULES (for videoDialogue[] and videoPrompt):
- Generate 1-2 lines per scene based on who is in that scene (characterIdsInScene)
- Solo scene (1 character) → 1 line only
- 2+ characters → 1 line per character, alternating speakers
- Each line: 2-7 words, English only, short and dramatic
- Speaker label: character display name only, max 16 chars (e.g. "Boss Mango", "Hot Peach", "Orange Mom")
  DO NOT include role prefix ("CHEATER_", "VICTIM_") or fruit type duplicates in speaker names
- NO fruit-type words as dialogue addresses
- Lines MUST be 100% logical for the story preset:
  * BABY story → lines about pregnancy, parenthood, the baby news. NEVER "give me your phone" or cheating lines
  * CHEATING story → lines about suspicion, proof, confrontation, betrayal
  * SECRET TWIN → lines about confusion, identical appearances, the twin reveal
  * CHEATS-BACK → lines about heartbreak, transformation, cold revenge, power shift
  * KICKED-OUT → lines about rejection, leaving, determination, comeback
  * CUSTOM → lines matching whatever story idea was provided
- LOGICAL CONTINUITY: dialogue must flow from scene to scene. If scene 2 shows a character crying, scene 3 cannot pretend nothing happened.
- EMOTIONAL ESCALATION: each scene should feel one step more intense than the last. Hook → suspicion → discovery → confrontation → payoff.
- Make lines feel like real TikTok drama: short, punchy, emotionally charged, leave viewer wanting the next clip

VIDEO PROMPT RULES:
1. Animate FROM the still image as a viral TikTok drama clip
2. SPOKEN DIALOGUE - SAY EXACTLY: section — use the videoDialogue[] lines you generated
3. Dialogue starts in the FIRST SECOND. No silent intro, no waiting
4. ENGLISH ONLY. No French, Spanish, Finnish, or any other language
5. Fast movement, strong facial reaction, one visual clue, dramatic camera, mini cliffhanger
6. Audio: clear dialogue + one optional sound effect + light ambience. NO background music
7. End EVERY videoPrompt: "No captions, no subtitles, no text overlays, no logos, no watermarks, no extra characters, no identity changes, no background music."

STORY STRUCTURE — required beat flow for {{SCENE_COUNT}} scenes:
{{BEAT_FLOW}}

CHARACTER LABELS (locked cast — narrativeRoles NEVER change):
{{CHARACTER_BLOCK}}

STYLE (fixed internal — cinematic 3D viral fruit drama):
- Polished 3D anthropomorphic fruit-human characters with expressive faces
- Cinematic dramatic lighting with clean TikTok composition
- Every scene instantly readable without captions or text
- No realism drift, no random redesigns, no identity swaps

STORY VARIETY GUIDANCE:
Conflict bucket:  {{CONFLICT_BUCKET}}
Archetype:        {{ARCHETYPE}}
Hook type:        {{HOOK_TYPE}}
Reveal type:      {{REVEAL_TYPE}}
Setting:          {{SETTING}}
Ending type:      {{ENDING_TYPE}}
Twist:            {{TWIST_TYPE}}
Emotional tone:   {{EMOTIONAL_TONE}}
Pacing:           {{PACING_STYLE}}

Return ONLY valid JSON — no markdown fences, no text outside the JSON object.`;

/* ─── JSON SCHEMA ─── */
const JSON_SCHEMA = `{
  "storyTitle": "catchy viral TikTok title, max 60 chars",
  "title": "same as storyTitle",
  "storyAngle": "one-line description of the story angle",
  "hook": "grabby opening line that creates instant curiosity",
  "storySummary": "2-3 sentence summary of the complete story arc",
  "storyDNA": {
    "conflictBucket": "string",
    "archetype": "string",
    "hookType": "string",
    "revealType": "string",
    "setting": "string",
    "endingType": "string",
    "twistType": "string",
    "emotionalTone": "string",
    "pacingStyle": "string"
  },
  "cast": [
    {
      "id": "stable_snake_case_id used in characterIdsInScene, e.g. wife_orange_mom",
      "sourceCharacterId": "id from the selected character input",
      "role": "same as narrativeRole",
      "referenceLabel": "UPPERCASE_UNDERSCORE label from CHARACTER LABELS above",
      "label": "same as referenceLabel",
      "displayName": "human readable name",
      "narrativeRole": "victim | cheater | affair_partner | kid | friend | boss | villain | sibling | parent | protagonist | antagonist | supporting",
      "fruitType": "orange | banana | strawberry | apple | lemon | peach | mango | pineapple | broccoli",
      "genderPresentation": "feminine-presenting | masculine-presenting | unspecified",
      "visualIdentity": "stable visual description locked for the whole story",
      "appearance": "detailed visual appearance",
      "clothing": "consistent outfit description",
      "narrativeFunction": "locked story function, 1 sentence",
      "personality": "brief personality note, 1 sentence"
    }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "short scene title",
      "durationSeconds": 6,
      "beatType": "hook | suspicion | discovery | confrontation | payoff | etc — must match required beat flow",
      "storyPurpose": "specific story purpose: what this scene achieves in the narrative",
      "scenePurpose": "same as storyPurpose",
      "emotionDirection": "dominant emotion this scene must visually express",
      "actionDirection": "exactly what is physically happening in this scene",
      "cameraDirection": "camera angle and framing suggestion",
      "backgroundDetail": "specific environment description",
      "environment": "single-word: bedroom | kitchen | office | restaurant | hotel | street | park | living-room",
      "continuityFromPrevious": false,
      "characterIdsInScene": ["cast.id values that physically appear in this scene — no others"],
      "charactersNotInScene": ["cast.id values deliberately absent from this scene"],
      "forbiddenCharacters": ["cast.id values that MUST NOT appear"],
      "emotionalBeat": "dominant emotion keyword",
      "captionText": "short on-screen caption shown as app overlay — NOT inside the image",
      "imagePrompt": "generation-ready prompt: [characters+actions] [emotion+body language] [camera] [environment+lighting] [3D style] [NO text rule]",
      "videoDialogue": [
        {
          "speaker": "Character display name only — NO fruit type, NO role prefix, NO ID. Max 16 chars. E.g. 'Boss Mango' not 'CHEATER_MANGO_BOSS_MANGO'",
          "line": "2-7 word English line. No fruit-type names (mango/banana/pineapple etc) as dialogue addresses. Short, dramatic, viral."
        }
      ],
      "videoPrompt": "viral 6-second video prompt with SPOKEN DIALOGUE - SAY EXACTLY, immediate English dialogue, fast action, visual clue, camera, clear dialogue-only audio, no background music, and cliffhanger. End with strict no-text/no-music negative rules.",
      "negativePrompt": "text, letters, subtitles, watermark, logo, speech bubbles, collage, multiple panels, split screen, ui elements, captions, extra characters"
    }
  ]
}`;

/* ─── DNA POOLS ─── */
const ARCHETYPES      = ["betrayal-drama","secret-reveal","revenge-arc","love-triangle","comeback-story","jealousy-spiral","manipulation-exposed","hidden-identity","poor-to-rich","gold-digger-exposed","secret-child","fake-friend-unmasked"];
const HOOK_TYPES      = ["shocking-revelation","caught-in-the-act","secret-letter","mysterious-stranger","tearful-confrontation","unexpected-pregnancy","hidden-camera-proof","overheard-conversation","suspicious-phone","unexpected-visitor","late-night-secret"];
const REVEAL_TYPES    = ["climactic-reveal","slow-burn-reveal","false-reveal-then-real","visual-proof","witness-reveal","confession-reveal","public-broadcast-reveal"];
const SETTINGS        = ["modern-fruit-city","cozy-home-kitchen","fancy-restaurant","rainy-night-street","fruit-office-building","luxury-penthouse","school-hallway","park-at-sunset","hospital-waiting-room","shopping-mall","hotel-lobby","suburban-neighborhood"];
const ENDING_TYPES    = ["cliffhanger","bittersweet","triumphant","tragic","shocking-twist","open-ended","redemption","revenge-complete"];
const CONFLICT_BUCKETS= ["cheating","betrayal","kicked-out","secret-child","fake-friend","poor-to-rich","revenge","hidden-identity","boss-drama","family-drama","mistaken-accusation","public-embarrassment","gold-digger","inheritance","betrayal-by-best-friend"];
const EMOTIONAL_TONES = ["heartbroken-rage","cold-calculated-revenge","tearful-disbelief","shocked-silence","furious-confrontation","quiet-devastation","triumphant-justice","bitter-irony"];
const PACING_STYLES   = ["slow-burn-escalation","fast-explosive-hook","steady-dramatic-build","twist-every-two-scenes","late-reveal-payoff"];

/* ─── MAIN HANDLER ─── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST")    return fail("Method not allowed", 405);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const authHeader = req.headers.get("Authorization") ?? "";
  const { data: { user }, error: authErr } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) return fail("Unauthorized", 401);

  let body: any;
  try { body = await req.json(); } catch { return fail("Invalid JSON body"); }

  const {
    storyIdea,
    storyPreset,
    conflict,
    selectedCharacters = [],
    sceneCount         = 5,
    storyLength        = "30s",
    sceneAspect        = "9:16",
  } = body as {
    storyIdea: string;
    storyPreset?: string;
    conflict?: string;
    selectedCharacters: CharInput[];
    sceneCount: number;
    storyLength: string;
    sceneAspect: string;
  };

  if (!storyIdea?.trim())  return fail("storyIdea is required");
  if (!Array.isArray(selectedCharacters) || selectedCharacters.length < 2) {
    return fail("At least 2 characters are required");
  }

  const preset        = detectPreset({ storyPreset, storyIdea, conflict });
  const beats         = getBeatsForPresetAndCount(preset, sceneCount);
  const canonicalCast = buildCanonicalCast(selectedCharacters, preset);

  const isCheating = preset === "cheating" || preset === "cheats-back";

  const dna = {
    conflictBucket: isCheating ? "cheating" : (CONFLICT_BUCKETS.find((c) => c === preset) ?? pickRandom(CONFLICT_BUCKETS)),
    archetype:      isCheating ? "betrayal-drama" : pickRandom(ARCHETYPES),
    hookType:       isCheating ? pickRandom(["suspicious-phone","caught-in-the-act","hidden-camera-proof","overheard-conversation"]) : pickRandom(HOOK_TYPES),
    revealType:     isCheating ? pickRandom(["visual-proof","confession-reveal","witness-reveal"]) : pickRandom(REVEAL_TYPES),
    setting:        pickRandom(SETTINGS),
    endingType:     pickRandom(ENDING_TYPES),
    twistType:      "none",
    emotionalTone:  pickRandom(EMOTIONAL_TONES),
    pacingStyle:    pickRandom(PACING_STYLES),
  };

  const charBlock = canonicalCast.map((c) =>
    `  - referenceLabel: ${c.referenceLabel}  |  castId: ${c.id}  |  sourceCharacterId: ${c.sourceCharacterId}  |  narrativeRole: ${c.narrativeRole}  |  fruitType: ${c.fruitType}  |  gender: ${c.genderPresentation}  |  function: ${c.narrativeFunction}`
  ).join("\n");

  const beatFlow = beats.map((b, i) =>
    `  Scene ${i + 1}: beatType="${b.beatType}" | title="${b.title}" | purpose="${b.purpose}" | emotion="${b.emotionDirection}" | action="${b.actionDirection}"`
  ).join("\n");

  const aspectLabel  = sceneAspect === "9:16" ? "vertical 9:16 TikTok" : "horizontal 16:9";
  const charNames    = selectedCharacters.map((c) => c.name ?? c.id).join(", ");

  const system = SYSTEM_BASE
    .replace("{{SCENE_COUNT}}",     String(sceneCount))
    .replace("{{BEAT_FLOW}}",       beatFlow)
    .replace("{{CHARACTER_BLOCK}}", charBlock)
    .replace("{{CONFLICT_BUCKET}}", dna.conflictBucket)
    .replace("{{ARCHETYPE}}",       dna.archetype)
    .replace("{{HOOK_TYPE}}",       dna.hookType)
    .replace("{{REVEAL_TYPE}}",     dna.revealType)
    .replace("{{SETTING}}",         dna.setting)
    .replace("{{ENDING_TYPE}}",     dna.endingType)
    .replace("{{TWIST_TYPE}}",      dna.twistType)
    .replace("{{EMOTIONAL_TONE}}",  dna.emotionalTone)
    .replace("{{PACING_STYLE}}",    dna.pacingStyle);

  const userPrompt = [
    `Story idea: ${storyIdea.trim()}`,
    `Story preset: ${storyPreset ?? preset}`,
    `Conflict: ${conflict ?? dna.conflictBucket}`,
    `Format: ${storyLength} viral ${aspectLabel} video — EXACTLY ${sceneCount} scenes`,
    `Characters: ${charNames}`,
    `Locked cast: ${canonicalCast.map((c) => `${c.id}=${c.referenceLabel}/${c.narrativeRole}/${c.fruitType}`).join(", ")}`,
    ``,
    `Required scene beat flow (follow this EXACTLY):`,
    beatFlow,
    ``,
    `CRITICAL RULES:`,
    `1. Cast[] first — assign narrativeRoles EXACTLY as listed in locked cast above. Do NOT reassign roles.`,
    `2. Create EXACTLY ${sceneCount} scenes matching the beat flow above`,
    `3. NEVER swap, drift, or reinterpret narrative roles. cheater = cheater in EVERY scene. victim = victim in EVERY scene.`,
    `4. Each scene uses ONLY cast IDs listed in characterIdsInScene — no others`,
    `5. For cheating stories: ONE scene MUST show cheater + affair_partner together (the actual affair). ONE scene MUST show victim alone discovering proof.`,
    `6. All scenes happen in the SAME home/location unless a beat REQUIRES a change. Use same backgroundDetail/environment across connected scenes.`,
    `7. Each scene's beatType MUST exactly match the beat flow above`,
    `8. Every imagePrompt MUST end with: "NO text, NO captions, NO subtitles, NO speech bubbles, NO watermarks, NO typography."`,
    `9. forbiddenCharacters MUST list all cast IDs NOT in characterIdsInScene`,
    `10. This is ONE continuous story — scene N must visually reference what happened in scene N-1`,
    ``,
    `Return ONLY valid JSON matching this schema exactly:`,
    JSON_SCHEMA,
  ].join("\n");

  /* ── Build vision message: attach character reference images so GPT can SEE them ── */
  const charImageParts = selectedCharacters
    .map((c: any) => c.publicRefUrl ?? c.imageUrl ?? c.image ?? null)
    .filter((url: string | null): url is string => typeof url === "string" && url.startsWith("http"))
    .map((url: string) => ({
      type: "image_url",
      image_url: { url, detail: "low" },
    }));

  const userMessageContent = charImageParts.length > 0
    ? [{ type: "text", text: userPrompt }, ...charImageParts]
    : userPrompt;

  /* ── OpenAI ── */
  let planJson: any;
  try {
    const aiRes = await fetch(OPENAI_CHAT, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model:           "gpt-4o",
        messages:        [{ role: "system", content: system }, { role: "user", content: userMessageContent }],
        max_tokens:      5500,
        temperature:     0.55,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`OpenAI ${aiRes.status}: ${errText.slice(0, 300)}`);
    }

    const aiData  = await aiRes.json();
    const raw     = aiData.choices?.[0]?.message?.content ?? "";
    planJson      = JSON.parse(raw);
  } catch (e: any) {
    return fail(`Story planning failed: ${e?.message ?? "Unknown error"}`, 500);
  }

  if (!Array.isArray(planJson?.scenes)) return fail("Planner returned invalid scene structure", 500);

  /* ── Merge cast and repair scenes ── */
  const lockedCast = mergeCastWithPlanner(canonicalCast, planJson.cast ?? []);
  const repaired   = repairScenes(planJson.scenes, lockedCast, beats, sceneCount);

  return ok({
    title:        planJson.storyTitle ?? planJson.title ?? "Fruit Story",
    storyTitle:   planJson.storyTitle ?? planJson.title ?? "Fruit Story",
    hook:         planJson.hook         ?? "",
    storySummary: planJson.storySummary ?? "",
    storyAngle:   planJson.storyAngle   ?? preset,
    storyDNA:     { ...dna, ...(planJson.storyDNA ?? {}), conflictBucket: dna.conflictBucket },
    cast:         lockedCast,
    scenes:       repaired,
  });
});
