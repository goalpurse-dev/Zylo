// stickman/nicheGuidance.ts — Phase 1 "Stickman Script Mode" pass.
//
// One editable config map, keyed by the exact niche slugs in
// src/pages/workspace/long-form/niches.js (25 niches, 5 groups) — the same
// "map keyed by id + a default fallback" shape that file's own
// RECOMMENDED_STYLES_BY_NICHE already established for a different purpose.
// Adding/tuning a niche's guidance is a data change here, never a prompt-code
// change in generate-long-form-story-plan or advance-long-form-script.
//
// `tone` steers voice/energy; `evidenceTypes` tells the writer what KIND of
// source/evidence a viewer would find credible for this niche, so the Draft
// prompt's "named source" instruction (site, study, researcher, event) reads
// as natural genre convention instead of one generic academic register for
// every video. Neither field is a fact — both are prompt guidance only, and
// carry no bearing on the evidence-discipline/factId rules, which stay
// unchanged regardless of niche.
//
// Phase 1 FINAL adds four fields so the universal beat structure (cold open
// -> stakes -> one question -> evidence -> optional twist -> callback payoff
// -> closer, identical for every niche) gets niche-SPECIFIC content without
// touching the shared prompt code:
// - titleFormulas: 2-4 proven title patterns for THIS niche specifically
//   (the shared STICKMAN_STORY_INSTRUCTIONS gives generic formulas; these
//   are the ones that actually work for this niche's own conventions).
// - coldOpenStyle: a concrete example of how the second-person cold-open
//   scene opens for this niche (a body/place/sensation specific to the
//   niche's subject matter, never a generic template).
// - evidenceShape: the niche-specific INTERNAL structure of the evidence
//   beats (e.g. Myth vs Reality is myth -> why people believe it -> what
//   evidence shows; You vs X is head-to-head rounds; Timeline is eras in
//   strict order; What If is step-by-step projected consequences, clearly
//   flagged as speculation). For niches with no distinctive internal shape,
//   this states the natural default (claim -> source -> number -> meaning)
//   explicitly rather than leaving it implicit.
// - typicalSources: concrete, NAMED examples of real institutions/publication
//   types this niche's viewer would find credible (e.g. "IUCN Red List,
//   peer-reviewed ecology journals, field biologists") — more concrete than
//   evidenceTypes' genre-level description, meant to give the model actual
//   names to reach for instead of a vague "credible sources" instruction.
// - pitfalls: 2-3 specific failure modes this niche is prone to, distinct
//   from the universal checks (screen narration, listicle closers, etc,
//   which already apply everywhere) — the niche-specific ways a script can
//   go wrong even while passing every universal check.

export type NicheGuidance = {
  tone: string;
  evidenceTypes: string;
  titleFormulas: string[];
  coldOpenStyle: string;
  evidenceShape: string;
  typicalSources: string;
  pitfalls: string[];
};

const DEFAULT_EVIDENCE_SHAPE = "Standard evidence-unit shape: claim -> named source -> a precise number -> plain-language meaning, one angle per evidence section, ordered from solid-but-expected to most surprising.";

export const NICHE_GUIDANCE: Record<string, NicheGuidance> = {
  // History & The Past
  ancient_humans_prehistory: {
    tone: "Awe at deep time and human ingenuity working with almost nothing — treat reconstructions as informed best guesses, not certainty.",
    evidenceTypes: "archaeological finds, dated tools/fossils, genetic studies, named archaeologists/anthropologists",
    titleFormulas: ["What Did [Group] Do [X]?", "How Did Early Humans Survive [X]?", "The [Number]-Year-Old [Discovery] That Changed Everything", "Why Did Humans Start [Behavior]?"],
    coldOpenStyle: "You're crouched by a dying fire, cold stone under your feet, deep dark pressing in past the firelight — put the viewer's body directly into a specific prehistoric moment (a cave, a hunt, a long walk) with sensory, physical detail, never a narrated overview of 'early humans.'",
    evidenceShape: "Each evidence section is one dated discovery or named site (a cave, a burial, a tool cache) -> what the physical evidence actually shows -> the reasonable inference drawn from it, explicitly separating SUPPORTED_FACT (the artifact/dating) from REASONABLE_INFERENCE (what it implies about behavior).",
    typicalSources: "named archaeological sites (with country/region), radiocarbon or genetic dating studies, named paleoanthropologists, peer-reviewed journals (Nature, Journal of Human Evolution)",
    pitfalls: ["Stating an inferred behavior as flatly certain when the evidence only supports a plausible reconstruction", "Generic 'early humans' language instead of a specific site, dating, and named researcher", "Modern moralizing about prehistoric people's choices"],
  },
  dark_brutal_history: {
    tone: "Sober and unflinching, never gratuitous — specific and vivid while respecting that real people suffered.",
    evidenceTypes: "primary historical records, court/inquiry documents, firsthand accounts, historian consensus",
    titleFormulas: ["The Real Story Behind [Event]", "What Actually Happened During [Event]?", "How [Group/Person] Got Away With [Act]", "The [Practice] Nobody Talks About"],
    coldOpenStyle: "You're standing in the actual physical place it happened — a specific room, road, or dock, at a specific hour — grounded in one real person's specific, documented experience, never a generalized 'imagine the horror.'",
    evidenceShape: "Each evidence section centers one documented incident or primary record -> the specific human stakes -> what the historical record establishes, moving from context to the starkest, best-documented specifics — never inventing a victim's inner thoughts beyond what records support.",
    typicalSources: "primary documents (court records, letters, official inquiries), named historians, contemporaneous newspaper accounts, museum/archive collections",
    pitfalls: ["Gratuitous detail that doesn't serve understanding", "Flattening real victims into narrative props", "Overstating certainty on disputed historical death tolls or motives"],
  },
  daily_life_past_eras: {
    tone: "Immersive and curious — make the mundane vivid with 'imagine doing this every single day' specificity.",
    evidenceTypes: "household/estate records, archaeological and material evidence, period diaries, historian reconstructions",
    titleFormulas: ["What It Was Actually Like to [Daily Task] in [Era]", "The Daily Routine of a [Role] in [Era]", "Why [Everyday Modern Thing] Didn't Exist Until [Date]", "How People [Activity] Before [Invention]"],
    coldOpenStyle: "You wake up inside a specific historical routine — the cold of the room, the smell, the first task of the day — before the viewer even knows the era, so the ordinariness itself becomes the hook.",
    evidenceShape: "Each evidence section is one facet of daily life (food, hygiene, work, leisure) -> a specific documented detail (a price, a duration, a tool) -> the felt difference from the viewer's own version of that same task today.",
    typicalSources: "household account books, guild/estate records, period diaries and letters, museum reconstructions, named social historians",
    pitfalls: ["Treating one class's experience (usually the wealthy) as universal for the whole era", "Vague 'life was hard' summary instead of one specific, countable detail", "Anachronistic assumptions about what people found difficult or strange"],
  },
  military_logistics_history: {
    tone: "Systems-minded and tactical — the 'how it actually worked' angle behind the battle, not just drama.",
    evidenceTypes: "military and supply records, campaign logs, historian analysis, primary accounts",
    titleFormulas: ["The Logistics Problem That Decided [Battle/War]", "How [Army/Commander] Actually Supplied [Number] Troops", "Why [Famous Battle] Really Came Down to [Logistics Factor]", "The Boring Reason [Empire/Army] Won"],
    coldOpenStyle: "You're a quartermaster or soldier facing one concrete logistics problem — counting rations, waiting on a supply line, staring at a map of roads — not the battle itself but the machinery behind it.",
    evidenceShape: "Each evidence section is one logistics constraint (supply, transport, terrain, timing) -> the specific numbers behind it (troops fed, miles marched, days of rations) -> how that constraint actually shaped the campaign's outcome.",
    typicalSources: "campaign records and quartermaster logs, named military historians, primary accounts from officers, peer-reviewed military history journals",
    pitfalls: ["Drifting into battle-drama narration and losing the systems angle", "Presenting one historian's logistics theory as unanimous consensus", "Numbers without a felt comparison (state a ration figure, then relate it to something the viewer can feel)"],
  },
  ancient_medicine_science: {
    tone: "Wince-worthy curiosity — 'they actually did this' — balanced with real explanation of what was (or wasn't) understood.",
    evidenceTypes: "historical medical texts, archaeological evidence, modern scholarly analysis of the practice",
    titleFormulas: ["The [Practice] Ancient [Culture] Used to Treat [Ailment]", "What Ancient Doctors Got Right About [Topic]", "The Terrifying Ancient Cure for [Ailment]", "Why Ancient [Culture] Believed [Practice] Worked"],
    coldOpenStyle: "You're the patient, on the table, about to receive a specific real ancient treatment — the exact tool, the exact sensation — before any explanation of what era or culture this is.",
    evidenceShape: "Each evidence section is one specific documented practice -> the historical medical text or archaeological evidence for it -> a modern scientific read on whether/why it sometimes worked, explicitly separating what genuinely helped from what was pure ritual belief.",
    typicalSources: "named historical medical texts (e.g. Ebers Papyrus, Hippocratic corpus), archaeological/skeletal evidence, modern medical historians analyzing the practice",
    pitfalls: ["Mocking ancient practitioners rather than explaining their internally logical reasoning", "Claiming a practice 'worked' without the modern evidence to support that specific claim", "Overstating how much was understood vs. how much was trial-and-error ritual"],
  },
  timeline_history: {
    tone: "Momentum-driven cause-and-effect — each event visibly and specifically causes the next.",
    evidenceTypes: "dated historical records, established chronologies, historian consensus",
    titleFormulas: ["How [Starting Event] Led to [Ending Event]", "The [Number]-Year Chain of Events That Caused [Outcome]", "From [Event A] to [Event B]: What Actually Happened", "The Timeline Nobody Explains: [Topic]"],
    coldOpenStyle: "You're dropped into the FIRST link in the chain — the specific originating moment — with the rest of the timeline still ahead, unknown to the person living it.",
    evidenceShape: "Each evidence section is ONE era/event in strict chronological order (never reordered for drama) -> the specific date/figures that anchor it -> the direct causal link (not just correlation) it forges to the NEXT era — the chain of causation is the whole point, so each section must end by handing off clearly to what comes next.",
    typicalSources: "dated primary records, established historical chronologies, named historians, archives/treaties/official records",
    pitfalls: ["Reordering events for narrative punch instead of true chronology", "Implying a cause without evidence it actually caused the next event (mere sequence isn't causation)", "Skipping an important intermediate link that breaks the causal chain's honesty"],
  },
  myth_vs_reality: {
    tone: "Mythbusting energy — state the popular belief plainly, then reveal what the evidence actually shows.",
    evidenceTypes: "primary records or research that supports or debunks the claim, named historians/experts",
    titleFormulas: ["The Truth About [Popular Myth]", "[Myth] Is a Myth — Here's What Really Happened", "You've Been Told [Myth]. Here's the Truth.", "Debunking the Biggest Myth About [Topic]"],
    coldOpenStyle: "You're living out the popular myth AS IF it were true — the viewer briefly inside the false version — right before the rug gets pulled by the actual evidence.",
    evidenceShape: "Structure is fixed: (1) state the myth plainly and vividly, as most people actually believe it; (2) explain WHY people believe it (where the myth came from — often a real but misunderstood or exaggerated source); (3) present what the evidence actually shows, point by point, building to the most surprising correction last. Never a strawman version of the myth — steelman it before debunking it.",
    typicalSources: "the ORIGINAL source of the myth (a book, film, or historical claim) alongside the actual primary evidence/named historians that correct it",
    pitfalls: ["Debunking a strawman nobody actually believes instead of the real popular version", "Overcorrecting into an equally oversimplified 'actually the opposite is true'", "Not explaining WHY the myth took hold, which is often the most interesting part"],
  },

  // Mind & Body
  psychology_human_behavior: {
    tone: "Personal and self-recognizing ('this is you') — grounded in real findings, never pop-psychology myth.",
    evidenceTypes: "peer-reviewed psychology studies, named researchers/institutions, replication status",
    titleFormulas: ["Why Your Brain [Does X]", "The Psychology of [Behavior]", "Why You [Common Behavior] (And Can't Stop)", "What [Behavior] Really Says About You"],
    coldOpenStyle: "It's a specific moment the viewer has actually lived — 2 a.m., replaying a conversation; frozen mid-decision in a doorway — described so precisely they recognize themselves before any explanation begins.",
    evidenceShape: "Each evidence section is one psychological mechanism -> the named study/researcher that established it -> the precise finding (a percentage, an effect size, a sample description) -> what it actually feels like from the inside, connecting the abstract mechanism back to the viewer's own experience.",
    typicalSources: "named peer-reviewed studies with a replication note where relevant, named psychologists/institutions, meta-analyses",
    pitfalls: ["Citing a popular but unreplicated finding (e.g. classic 'debunked' studies) as if still solid — check replication status", "Diagnosing the viewer ('you have anxiety') instead of describing a mechanism", "Pop-psychology overclaiming beyond what the actual study found"],
  },
  the_body_explained: {
    tone: "Visceral 'your body is doing this right now' wonder — concrete mechanism, not a biology-class recap.",
    evidenceTypes: "physiological and medical research, clinical studies, named researchers",
    titleFormulas: ["What's Actually Happening Inside Your Body When You [Action]", "The Real Reason Your Body [Does X]", "Your [Body Part] Is Doing Something Incredible Right Now", "Why Your Body [Involuntary Response]"],
    coldOpenStyle: "A precise physical sensation the viewer has right now or very recently — a racing heart, a yawn, goosebumps — described from the inside, at the cellular/mechanical level, before naming what it is.",
    evidenceShape: "Each evidence section is one step of the actual physiological mechanism, in the order the body performs it -> the specific measurement (a duration, a chemical, a rate) -> why evolution or biology produces it, moving from the immediate sensation to the deeper mechanism.",
    typicalSources: "named physiological/clinical studies, medical researchers, textbook-established mechanisms with a specific study behind any exact number",
    pitfalls: ["Textbook-recap tone instead of visceral immediacy", "Stating an exact number (e.g. a hormone level) without a real source behind it", "Explaining WHAT happens without ever explaining WHY (the evolutionary/functional reason)"],
  },
  sleep_health_habits: {
    tone: "Practical and a little urgent — 'this is why you feel like this' — actionable but evidence-first, never preachy.",
    evidenceTypes: "sleep and health studies, clinical research, explicit note where findings are still debated",
    titleFormulas: ["Why You Wake Up at [Time] Every Night", "What Actually Happens to Your Body When You [Habit]", "The Real Reason You're Always Tired", "Why [Common Habit] Is Wrecking Your [Health Aspect]"],
    coldOpenStyle: "The exact felt moment of the problem — staring at the ceiling at 3 a.m., the fog of a bad night's sleep at your desk — before any science begins.",
    evidenceShape: "Each evidence section is one mechanism behind the habit/symptom -> the specific study/finding -> the practical, felt consequence, explicitly flagging any finding that's still debated or has mixed replication rather than presenting all sleep science as equally settled.",
    typicalSources: "named sleep researchers and labs, clinical trials, meta-analyses, explicit debate/uncertainty notes where the science is genuinely unsettled",
    pitfalls: ["Preachy 'you should' tone instead of explaining the mechanism and letting the viewer draw the conclusion", "Presenting contested sleep-hygiene advice as settled science", "Fear-mongering about a habit without the actual effect-size context"],
  },
  evolution_quirks: {
    tone: "Delighted amazement at weird adaptations — 'evolution actually did this.'",
    evidenceTypes: "evolutionary biology research, comparative studies, fossil or genetic evidence",
    titleFormulas: ["The Bizarre Reason [Animal] Evolved [Trait]", "Why Evolution Gave [Animal] [Trait]", "The Weirdest Adaptation in Nature: [Trait]", "How [Animal] Evolved to [Ability]"],
    coldOpenStyle: "You ARE the animal for a moment, mid-action, using the strange adaptation — inside its body, its sensory experience — before the viewer knows what species or trait this is.",
    evidenceShape: "Each evidence section is one stage of the adaptation's evolutionary logic (the problem it solved, the mechanism, the comparative evidence across related species) -> a specific measurement or comparative study -> why this specific solution won out over alternatives.",
    typicalSources: "named evolutionary biologists, comparative anatomy/genetics studies, fossil evidence where relevant",
    pitfalls: ["Teleological framing ('evolution wanted to') instead of selection-pressure framing", "Just-so-story explanations without the comparative evidence to back them", "Treating a single dramatic trait as evolution's 'goal' rather than one adaptive solution among many"],
  },

  // Animals & Nature
  why_dont_we_eat_x: {
    tone: "Playful, myth-busting curiosity about a specific food taboo — never squeamish or preachy.",
    evidenceTypes: "toxicology/nutrition data, cultural and historical records, biological reasoning",
    titleFormulas: ["Why Don't We Eat [Animal]?", "The Real Reason [Animal] Isn't on Your Plate", "Why [Animal] Is Illegal to Eat in [Place]", "What Would Happen If You Ate [Animal]?"],
    coldOpenStyle: "You're staring at the animal (or its carcass/meat) in a specific, concrete scene — a market, a kitchen — with the taboo already visibly in the air, before any explanation.",
    evidenceShape: "Biology/energy (why the animal is a poor food source ecologically) -> danger (risk of acquiring it) -> taste/safety (practical eating barriers) -> culture (taboo/symbolic meaning) -> economics (it's worth more alive/as something else) — save the single most surprising angle (usually biology or economics) for the twist or callback, never spend it early.",
    typicalSources: "IUCN/conservation data, food-safety agencies (FAO, national health bodies), named anthropologists on food taboos, wildlife trade bodies (CITES, TRAFFIC)",
    pitfalls: ["Squeamish or moralizing tone about eating the animal", "Listing all 5 reasons as a flat, equal-weight checklist instead of building to the best one", "Citation tags leaking into narration ('(IUCN: ...)') instead of naming the source in spoken language"],
  },
  animal_behavior_predator_prey: {
    tone: "Nature-documentary tension and specificity — real stakes and real behavior, not anthropomorphized cliché.",
    evidenceTypes: "field studies, ethology research, documented observations, named researchers",
    titleFormulas: ["The Brutal Strategy [Predator] Uses to Hunt [Prey]", "How [Prey] Actually Survives [Predator]", "The Real Reason [Animal Behavior]", "Inside a [Predator] Hunt: What Actually Happens"],
    coldOpenStyle: "You ARE the predator or the prey, mid-hunt, in a specific real habitat, sensory and immediate — the chase, the wait, the decision — before any species names or study citations.",
    evidenceShape: "Each evidence section is one documented behavioral strategy or adaptation -> the specific field study/observation that established it (success rate, speed, timing) -> the evolutionary logic behind why it works, building toward the most surprising or counterintuitive behavior.",
    typicalSources: "named field biologists/ethologists, long-term field studies (e.g. Serengeti lion projects), peer-reviewed ethology journals",
    pitfalls: ["Anthropomorphizing motives ('the lion wanted revenge') instead of behavioral/evolutionary explanation", "Generic nature-documentary cliché phrasing instead of specific, sourced numbers", "Overstating a single observation as universal species behavior"],
  },
  survival_scenarios: {
    tone: "Second-person, high-stakes 'what would actually happen to you' — grounded in real physiology and physics, not movie logic.",
    evidenceTypes: "physiological limits data, documented survival cases, expert consensus",
    titleFormulas: ["What Would Actually Happen If You [Scenario]?", "How Long Could You Actually Survive [Situation]?", "The Real Science of Surviving [Scenario]", "What Really Happens to Your Body When You [Extreme Situation]"],
    coldOpenStyle: "You're already IN the survival scenario — the cold, the water, the altitude — mid-crisis, feeling the first physiological signs, before any framing of what's about to be explained.",
    evidenceShape: "Each evidence section is one stage of physiological breakdown or survival response, in the actual TIME ORDER the body experiences it -> the specific physiological limit/timeframe (a documented case or study) -> what it would actually feel like, correcting a common movie-logic misconception along the way.",
    typicalSources: "physiology/medicine researchers, documented real survival cases (with names/dates where ethical), military/wilderness-medicine research",
    pitfalls: ["Movie-logic physiology instead of real documented limits", "Melodrama that overtakes the actual science", "Vague timeframes ('you'd die quickly') instead of the real, specific documented range"],
  },
  extinct_animals: {
    tone: "Wonder and mystery — reconstructing a lost world from clues, honest about what's inferred versus known.",
    evidenceTypes: "fossil evidence, paleontological studies, dating methods, named paleontologists, noted scientific debate",
    titleFormulas: ["The Terrifying Animal That Went Extinct [Timeframe] Ago", "What Killed Off [Animal]?", "The [Animal] That Was Bigger Than You Think", "Why [Animal] Really Went Extinct"],
    coldOpenStyle: "You're standing in the extinct animal's actual lost habitat, encountering it directly — its size, sound, movement — reconstructed vividly from real fossil evidence, before any names or dates.",
    evidenceShape: "Each evidence section is one piece of fossil/paleontological evidence -> what it directly shows (size, diet, injury, dating) -> the reasonable inference built from it, explicitly flagging ongoing scientific debate (e.g. extinction cause) as debate rather than settled fact.",
    typicalSources: "named fossil sites and specimens, radiometric/other dating methods, named paleontologists, peer-reviewed paleontology journals",
    pitfalls: ["Presenting a contested extinction theory (e.g. one specific cause) as the sole settled answer", "Overstating soft-tissue/behavioral reconstructions beyond what fossils actually show", "Generic dinosaur-documentary cliché instead of the specific fossil evidence"],
  },

  // Science & Universe
  space_cosmic_scale: {
    tone: "Scale-vertigo awe — make huge or tiny numbers viscerally felt, never just stated.",
    evidenceTypes: "astrophysics research, space agency data, peer-reviewed measurements",
    titleFormulas: ["How Big Is [Cosmic Object], Really?", "What Would Happen If [Cosmic Event]?", "The Terrifying Scale of [Cosmic Object]", "Why [Cosmic Fact] Should Break Your Brain"],
    coldOpenStyle: "You're physically placed at the scale in question — floating beside the object, or shrunk/enlarged to feel its size — a bodily, sensory placement into cosmic scale before any numbers are given.",
    evidenceShape: "Each evidence section builds the scale comparison in escalating steps -> a specific measurement (distance, mass, temperature, time) -> an immediately felt comparison (a familiar object/distance/duration) that makes the raw number viscerally real, saving the most mind-bending comparison for last.",
    typicalSources: "space agency data (NASA, ESA), peer-reviewed astrophysics measurements, named astronomers/astrophysicists",
    pitfalls: ["Stating a huge number without a felt comparison, leaving it abstract", "Losing the second-person 'you' framing amid the physics", "Overstating a still-debated cosmological theory as settled"],
  },
  what_if_hypotheticals: {
    tone: "Playful thought-experiment energy — clearly framed as hypothetical, following a real chain of physical/causal reasoning.",
    evidenceTypes: "real physical/scientific principles applied to the hypothetical, expert extrapolation — every such claim is a HYPOTHETICAL_ASSUMPTION, never asserted as settled fact",
    titleFormulas: ["What If [Hypothetical Event]?", "What Would Actually Happen If [Hypothetical]?", "Here's What Happens the Moment [Hypothetical] Occurs", "What If [Thing] Just Disappeared?"],
    coldOpenStyle: "You're living the FIRST moment the hypothetical becomes real — the exact instant, the first physical sign — grounded and sensory even though the premise is speculative.",
    evidenceShape: "Step-by-step projected CONSEQUENCES in strict causal/chronological order (seconds, then hours, then years) -> each step grounded in a REAL physical/scientific principle -> honestly phrased as projection ('would', 'scientists estimate', 'the physics suggests') never as settled fact, since the premise itself is speculative even when each individual step's underlying science is real.",
    typicalSources: "real physics/astronomy/biology principles applied to the scenario, named scientists' actual extrapolations/calculations where they exist",
    pitfalls: ["Stating a speculative consequence as flat fact instead of clearly hedged projection", "Movie-logic instead of real physics for the causal chain", "Losing the step-by-step time structure and jumping straight to the dramatic ending"],
  },
  mysteries_unexplained: {
    tone: "Genuine intrigue without credulity — present competing explanations honestly, never overclaim a tidy solution.",
    evidenceTypes: "documented evidence, competing named expert theories, explicit disputed/uncertain framing",
    titleFormulas: ["The Mystery of [Event/Phenomenon] Nobody Can Fully Explain", "What Really Happened to [Subject]?", "The [Number] Theories That Try to Explain [Mystery]", "Why [Mystery] Still Doesn't Have an Answer"],
    coldOpenStyle: "You're at the exact scene of the mystery, encountering the strange, documented anomaly firsthand — grounded in the real, specific circumstances, not vague spookiness.",
    evidenceShape: "Present the documented facts of the mystery first (what's actually known and verified) -> then each evidence section is ONE competing expert theory -> the evidence for and against it, explicitly marked DISPUTED/UNCERTAIN rather than picking a favorite — the honest 'we don't fully know' is itself the payoff, not a cop-out.",
    typicalSources: "documented primary evidence/records, named researchers on each competing theory, explicit note of scientific consensus (or lack thereof)",
    pitfalls: ["Overclaiming a tidy 'solved' answer that the actual evidence doesn't support", "Presenting fringe theories with the same credibility as well-evidenced ones", "Credulous tone that undercuts the 'genuine intrigue without credulity' voice"],
  },
  everyday_science: {
    tone: "'Wait, THAT'S why that happens?' — familiar objects and moments revealed to be more interesting than assumed.",
    evidenceTypes: "physics/chemistry/biology research, engineering explanation, named scientists where relevant",
    titleFormulas: ["The Real Reason [Everyday Object/Event]", "Why [Everyday Thing] Actually Works Like That", "What's Actually Happening When You [Everyday Action]", "The Science You Never Learned About [Everyday Thing]"],
    coldOpenStyle: "The viewer's own hands are doing the everyday action right now (pouring, plugging in, stepping outside) — completely ordinary, before the hidden mechanism is revealed.",
    evidenceShape: "Each evidence section is one step of the actual physical/chemical mechanism, in the order it happens -> the specific measurement or principle behind it -> why it's counterintuitive or surprising relative to what most people assume, building to the single most surprising mechanism step last.",
    typicalSources: "physics/chemistry/engineering research, named scientists/engineers, manufacturer or standards-body technical documentation where relevant",
    pitfalls: ["Oversimplifying the mechanism to the point of being technically wrong", "Losing the 'wait, really?' hook in dry technical explanation", "Assuming prior technical knowledge the general viewer won't have"],
  },

  // Money & Modern Life
  money_psychology_economics: {
    tone: "Sharp, slightly conspiratorial 'here's what's actually going on with your money' framing.",
    evidenceTypes: "economic research, behavioral economics studies, industry/market data",
    titleFormulas: ["Why You're Bad at [Money Behavior]", "The Real Reason [Financial Product/Practice] Exists", "How [Company/Industry] Profits From Your [Behavior]", "Your Bank Buzzes: Here's What's Actually Happening"],
    coldOpenStyle: "Your phone buzzes: your bank balance, a price tag, a subscription charge — a specific, small, relatable financial moment that opens a much bigger mechanism.",
    evidenceShape: "Each evidence section is one behavioral-economics mechanism or industry practice -> the named study/data behind it (a percentage, a dollar figure, an experiment) -> exactly how it plays out in the viewer's own financial life, building to the mechanism that costs (or could save) the viewer the most money.",
    typicalSources: "named behavioral economists and studies, government/industry financial data, named journalists/whistleblowers on industry practice",
    pitfalls: ["Vague 'companies are greedy' framing instead of the specific documented mechanism", "Financial advice framing instead of explanation (this is an explainer, not personal-finance advice)", "Citing a dollar figure without a real source or date behind it"],
  },
  technology_attention_economy: {
    tone: "Alert, slightly unsettling 'here's what's actually happening to your attention' framing.",
    evidenceTypes: "tech industry research, behavioral studies, documented design practices, named researchers/whistleblowers",
    titleFormulas: ["Why [App/Platform] Is Designed to [Behavior]", "The Real Reason You Can't Put Your Phone Down", "How [Tech Company] Engineers Your [Behavior]", "What [App Feature] Is Actually Doing to Your Brain"],
    coldOpenStyle: "Your phone buzzes and your thumb is already moving before you decided to check it — a precise, physical moment of involuntary reaching, before any explanation of the design behind it.",
    evidenceShape: "Each evidence section is one specific, named design mechanism (a documented feature, pattern, or internal practice) -> the behavioral-science principle it exploits, with a named study -> the measurable effect on user behavior (a documented statistic), building toward the most deliberately engineered mechanism last.",
    typicalSources: "named tech-industry whistleblowers/insiders, documented design patents or practices, behavioral psychology studies, tech journalism investigations",
    pitfalls: ["Vague 'social media is bad for you' framing instead of naming the SPECIFIC design mechanism", "Treating every negative tech story as equally well-documented", "Losing the second-person immediacy in industry-jargon explanation"],
  },
  how_systems_work: {
    tone: "Systems-thinking curiosity — pulling back the curtain on something everyone uses but nobody understands.",
    evidenceTypes: "technical/engineering documentation, industry data, named engineers/experts",
    titleFormulas: ["What Actually Happens When You [Common Action]?", "How [System] Actually Works (Nobody Explains This)", "The Hidden System Behind [Everyday Thing]", "Why [System] Is More Complicated Than You Think"],
    coldOpenStyle: "The viewer performs the ordinary trigger action (tapping a card, flushing a toilet, sending a text) — completely mundane — right before the hidden system springs into motion behind the scenes.",
    evidenceShape: "Each evidence section is one stage of the system, in the ACTUAL OPERATIONAL ORDER it happens -> the specific technical detail (a number, a named component, a timing) -> why that stage exists (what would break without it), building end-to-end so the viewer could explain the whole pipeline afterward.",
    typicalSources: "technical/engineering documentation, named engineers or industry experts, standards-body publications",
    pitfalls: ["Getting the operational order wrong (a genuine factual error, not just a style issue)", "Oversimplifying to the point of technical inaccuracy", "Dry technical tone that loses the 'nobody explains this' curiosity hook"],
  },
  countries_cultures: {
    tone: "Respectful curiosity about real cultural difference — specific, never stereotyped.",
    evidenceTypes: "cultural and historical research, demographic data, ethnographic sources",
    titleFormulas: ["Why [Culture] Does [Practice] Differently", "The Real Reason [Country] [Cultural Fact]", "What [Country/Culture] Gets Right About [Topic]", "The Cultural Difference That Surprises Everyone About [Place]"],
    coldOpenStyle: "You're physically present in a specific, real place doing the specific cultural practice — a meal, a greeting, a ritual — grounded in one concrete scene, never a generalized 'in this culture...' summary.",
    evidenceShape: "Each evidence section is one specific documented cultural practice or difference -> its historical/social origin (a named source or historical event) -> what it reveals about different but equally valid ways of solving the same human problem, never framed as one culture being 'right' and another 'wrong.'",
    typicalSources: "named cultural anthropologists/historians, demographic and government data, ethnographic field studies",
    pitfalls: ["Stereotyping or flattening a whole culture into one trait", "Exoticizing framing that treats the culture as 'strange' rather than differently logical", "Presenting a dated or minority practice as representative of the whole modern culture"],
  },
  jobs_careers: {
    tone: "Insider 'here's what this job is actually like' specificity — concrete, never a generic career-day description.",
    evidenceTypes: "labor market data, industry reporting, named firsthand professional accounts",
    titleFormulas: ["What It's Actually Like to Be a [Job]", "The Truth About Working as a [Job]", "What They Don't Tell You About Being a [Job]", "The Hardest Part of Being a [Job] Nobody Talks About"],
    coldOpenStyle: "You're mid-shift in the specific job — the exact task, tool, or moment of pressure — before any framing of what the job title even is.",
    evidenceShape: "Each evidence section is one specific, concrete facet of the job (a task, a risk, a piece of pay/hours data) -> the specific documented number or firsthand account behind it -> what it actually feels like day to day, building toward the single most surprising or hardest truth about the job.",
    typicalSources: "labor statistics agencies, industry/trade reporting, named professionals' firsthand accounts or interviews",
    pitfalls: ["Generic career-day description instead of specific, insider detail", "Outdated pay/labor data presented as current", "Romanticizing or unfairly trashing the job instead of an honest, specific portrait"],
  },
  you_vs_x: {
    tone: "Direct second-person comparison/challenge framing — 'here's how you actually stack up against X.'",
    evidenceTypes: "comparative scientific or statistical data, physiological or performance research",
    titleFormulas: ["You vs [Animal/Machine/Historical Figure]: Who Actually Wins?", "Could You Actually Beat [X] at [Task]?", "You vs [X]: The Science of Who's Really Stronger/Faster/Smarter", "How You Compare to [X] in [Category]"],
    coldOpenStyle: "You're standing directly next to X, about to compete — the physical size/speed/power difference immediately, viscerally apparent — before any numbers are given.",
    evidenceShape: "Structured as head-to-head ROUNDS, each one a specific measurable category (speed, strength, senses, endurance) -> the actual comparative data for you vs X in that category -> a clear round 'winner,' building to an overall verdict that's often more surprising than the obvious assumption (you win a round you shouldn't, or lose one you should've won).",
    typicalSources: "physiology and performance research, named scientists' comparative studies, documented animal/machine performance data",
    pitfalls: ["Comparing incompatible units instead of a fair, specific head-to-head metric", "Making every round predictably go the same way (no genuine surprise)", "Losing the direct 'you' framing in third-person comparison stats"],
  },
};

export const DEFAULT_NICHE_GUIDANCE: NicheGuidance = {
  tone: "Curious, confident, and specific — a genuinely good narrator explaining something fascinating to one person, never generic or encyclopedia-flat.",
  evidenceTypes: "named studies, documented events, credible experts or institutions — whatever kind of source this specific topic would realistically be backed by",
  titleFormulas: ["Why [Topic]?", "The Real Reason [Topic]", "What Actually Happens When [Topic]", "How [Topic] Actually Works"],
  coldOpenStyle: "Drop the viewer into one specific, sensory, physical moment directly connected to the topic — a body, a place, an object — never a generalized overview of the subject.",
  evidenceShape: DEFAULT_EVIDENCE_SHAPE,
  typicalSources: "named studies, credible institutions, documented events, expert consensus appropriate to this specific topic",
  pitfalls: ["Generic, encyclopedia-flat tone", "Vague sourcing instead of a named study/institution/expert", "Losing the second-person viewer connection in dense explanation"],
};

export function nicheGuidanceFor(nicheId: string | null | undefined): NicheGuidance {
  if (nicheId && Object.prototype.hasOwnProperty.call(NICHE_GUIDANCE, nicheId)) return NICHE_GUIDANCE[nicheId];
  return DEFAULT_NICHE_GUIDANCE;
}
