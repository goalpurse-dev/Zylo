// The AI Fruit Story v2 character library: 150 adult fruit characters.
// `node scripts/fruit-characters/roster.mjs` writes
// data/fruit-characters/characters.json and prints the balance report.
//
// Row: id | name | fruit | F/M | age | tag | one-line role | story types | voice | face | build | outfit | overrides?
// The first 14 are the existing v2 characters (ids kept); ana, sally and andy
// already have v1 art, so they keep their ids too.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { FRUITS, ageText, buildPrompt, legsMode } from "./prompt.mjs";

export const STORY_TYPES = {
  marriage: "Marriage & cheating",
  office: "Office drama",
  crime: "Prison & crime",
  law: "Cops, lawyers & courts",
  family: "Family & in-laws",
  dating: "Dating & friends",
  money: "Money & inheritance",
  neighbors: "Neighbors & roommates",
  social: "Influencers & fame",
  wedding: "Weddings",
  service: "Restaurants & shops",
  hospital: "Hospital",
  school: "School & college",
  sports: "Gym & sports",
};

const ROWS = [
  // ── existing 14 ──
  ["mia", "Mia Mango", "mango", "F", 38, "Wife", "Calm, patient schemer", "marriage family", "low, smooth, unhurried", "Calm knowing eyes and a small closed-mouth smile", "Slim, poised build", "an elegant emerald wrap dress, gold hoop earrings and nude heels"],
  ["marco", "Marco Mango", "mango", "M", 41, "Husband", "Charming, smooth liar", "marriage money", "warm baritone, smooth, even pace", "Charming half-lidded eyes and a smooth grin", "Tall, fit build", "a fitted charcoal suit with an open-collar black shirt and a thin gold chain"],
  ["pia", "Pia Peach", "peach", "F", 29, "Rival", "Glamorous other woman", "marriage dating", "light, airy, lilting", "Long-lashed flirty eyes and a teasing smile", "Curvy build", "a red satin slip dress, a cropped white faux-fur jacket and strappy red heels"],
  ["rick", "Rick Crisp", "apple", "M", 52, "Boss", "Loud CEO, bad liar", "office marriage", "loud, booming baritone", "Confident grinning eyes, strong brows and a smiling mouth", "Tall, solid build", "a navy three-piece suit, a red tie and a gold watch"],
  ["bella", "Bella Berry", "strawberry", "F", 25, "Intern", "Sweet intern with secrets", "office dating", "bright, quick, slightly high", "Bright eyes and a small shy smile", "Slim build", "a pastel-pink blazer, a white blouse, a black pencil skirt, oversized round glasses and a pink lanyard"],
  ["marg", "Margaret Crisp", "green apple", "F", 55, "Wife", "Icy co-founder", "office marriage money", "thin, crisp, precise diction", "Cool composed eyes, arched brows and a thin smile, with pearl earrings", "Slim, upright build", "a white tailored coat over a black dress", { skin: "matte green", finish: "matte" }],
  ["gloria", "Gloria Grape", "grape", "F", 58, "Receptionist", "Office gossip, 19 years", "office", "quick, chirpy, mid-pitched", "Knowing eyes behind cat-eye glasses on a chain, and a small smile", "Plump build", "a leopard-print cardigan and black slacks"],
  ["linda", "Linda Lemon", "lemon", "F", 50, "HR", "Sour HR director", "office", "clipped, crisp, mid-pitched", "Narrowed eyes behind thin reading glasses and pursed lips", "Straight, narrow build", "a mustard-yellow skirt suit, a white blouse and an ID badge on a clip"],
  ["benny", "Benny Banana", "banana", "M", 28, "Boyfriend", "Nervous over-explainer", "dating family", "quick, thin, a little breathy", "Nervous wide eyes and a worried half-smile", "Lanky build", "a grey hoodie, blue jeans and white sneakers"],
  ["pina", "Big Pina", "pineapple", "M", 45, "Kingpin", "Cellblock kingpin", "crime", "very deep, slow, gravelly bass", "Tough heavy-lidded eyes and a grin showing one gold tooth", "Big barrel build", "an orange prison jumpsuit with rolled sleeves and black boots"],
  ["coco", "Coco", "coconut", "M", 35, "Enforcer", "Silent enforcer", "crime", "low, gravelly, sparse", "Small serious eyes and a firm straight mouth", "Huge muscular build", "a grey beanie, a black tank top, cargo pants and black boots"],
  ["olive", "Olivia Orange", "orange", "F", 45, "Mom", "Protective mom", "family", "warm, full, mid-pitched", "Warm eyes and a gentle smile", "Medium build", "a cream knit sweater, dark jeans and an apron"],
  ["kiki", "Kiki Kiwi", "kiwi", "F", 32, "Friend", "Loyal best friend", "dating", "bright, upbeat, quick", "Bright green eyes and a cheerful smile", "Athletic build", "a denim jacket, a white tee, black leggings and white sneakers"],
  ["walt", "Walt Melon", "watermelon", "M", 62, "Husband", "Rich, clueless husband", "marriage money", "hearty, warm, older baritone", "Friendly eyes under bushy brows and a broad smile", "Round build", "a pastel golf polo, beige chinos and a flat cap"],
  // ── existing v1 art ──
  ["ana", "Ana Pineapple", "pineapple", "F", 24, "Influencer", "Lives for the drama", "social dating", "bright, bubbly, high", "Big sparkly eyes with long lashes and a wide camera-ready smile", "Slim build", "a lime-green crop hoodie, white high-waisted shorts and chunky sneakers"],
  ["sally", "Sally Strawberry", "strawberry", "F", 64, "Mother-in-law", "Never leaves, never forgets", "family marriage", "soft, sugary, older", "Sweet smiling eyes that don't match the tight smile", "Short, round build", "a lilac twin-set cardigan, a pleated grey skirt, pearls and sensible shoes"],
  ["andy", "Andy Apple", "apple", "M", 22, "Son", "Spoiled only child", "family money", "nasal, reedy, young", "Bored half-closed eyes and a smug pout", "Skinny build", "a red bomber jacket, ripped black jeans and expensive white sneakers"],
  // ── apple ──
  ["adam", "Adam Apple", "apple", "M", 31, "Trainer", "Personal trainer the wife keeps booking", "marriage sports", "loud, punchy, fast", "Intense eager eyes and a huge grin", "Very muscular build", "a tight red athletic tee, black joggers, a whistle and running shoes"],
  ["abby", "Abby Apple", "apple", "F", 27, "Nurse", "Kind nurse who hears everything", "hospital", "soft, gentle, quick", "Kind tired eyes and a soft smile", "Medium build", "light blue scrubs, a stethoscope around the neck and white clogs"],
  ["gus", "Gus Gala", "apple", "M", 67, "Grandpa", "Grumpy grandpa rewriting his will", "family money", "gravelly, low, older, slow", "Squinting eyes under thick white brows and a grumpy frown", "Stooped, thin build", "a brown cardigan over a plaid shirt, grey trousers, suspenders and slippers"],
  ["fiona", "Fiona Fuji", "apple", "F", 36, "Wife", "Teacher wife who found the receipts", "marriage school", "crisp, clear, measured", "Sharp eyes behind rectangular glasses and a tight smile", "Slim build", "a mustard turtleneck, a brown plaid midi skirt with black tights and loafers"],
  ["candy", "Candy Cortland", "apple", "F", 44, "Realtor", "Pushy realtor who lies about everything", "office money", "bright, glossy, quick", "Wide sales-pitch eyes and a huge fake smile", "Medium build", "a hot-pink skirt suit, a name badge and pointy heels"],
  // ── green apple ──
  ["grace", "Grace Smith", "green apple", "F", 69, "Grandma", "Sweet grandma, sharp tongue", "family", "soft, sweet-toned, older", "Twinkly eyes behind round glasses and a sly smile", "Small, soft build", "a floral house dress, a pale blue cardigan and comfy shoes"],
  ["greg", "Greg Green", "green apple", "M", 38, "Accountant", "Nervous accountant cooking the books", "office money", "soft, mumbly, quick", "Darting eyes behind thick glasses and a sweaty grimace", "Soft, narrow build", "a short-sleeved white button-up shirt, a green tie, khaki trousers and a pocket protector"],
  ["vic", "Vic Sour", "green apple", "M", 46, "Rival VP", "Rival VP gunning for the CEO job", "office", "nasal, thin, drawling", "Pinched scheming eyes and a smug smile", "Thin, stiff build", "a slim sage-green suit, a black tie and polished loafers"],
  ["jade", "Jade Apple", "green apple", "F", 23, "Student", "Overachiever with a secret TikTok", "school social", "quick, bright, light", "Big alert eyes and an eager smile", "Petite build", "a cropped varsity jacket, a white tee, wide-leg jeans and a small backpack"],
  // ── mango ──
  ["manny", "Manny Mango", "mango", "M", 63, "Father-in-law", "Old-school dad who hates the groom", "family wedding", "booming, rich, older", "Stern eyes under heavy brows and a big frown", "Broad, heavy build", "a cream linen suit, an open-collar shirt and a straw fedora"],
  ["maya", "Maya Mango", "mango", "F", 26, "Sister", "Little sister who spills everything", "family dating", "bubbly, fast, high", "Wide excited eyes and an open-mouthed grin", "Petite build", "a yellow sundress, a denim jacket and white sneakers"],
  ["milo", "Milo Mango", "mango", "M", 33, "Brother", "Freeloading brother on the couch", "family money", "relaxed drawl, warm, low", "Sleepy eyes and a lazy grin", "Soft, slouchy build", "a stretched-out plain black tee, plaid pajama pants and slides with socks"],
  ["ali", "Ali Alphonso", "mango", "M", 40, "Chef", "Hot-tempered celebrity chef", "service social", "loud, hard-edged, fast", "Furious narrowed eyes and a shouting-ready mouth", "Stocky build", "a white double-breasted chef jacket, black chef trousers, a tall chef hat and black clogs"],
  ["dina", "Dina Dulce", "mango", "F", 57, "Wedding planner", "Wedding planner who's seen it all", "wedding", "brisk, full, projecting", "Sharp eyes with bold eyeliner and a professional smile", "Slim, energetic build", "a sleek black jumpsuit, a headset and low heels"],
  // ── peach ──
  ["paige", "Paige Peach", "peach", "F", 31, "Influencer", "Brand-deal queen, fake perfect life", "social", "breathy, light, bright", "Glittery eyes and a perfect ring-light smile", "Slim build", "a matching cream knit lounge set, gold jewelry and fluffy slides"],
  ["pete", "Pete Peach", "peach", "M", 48, "Dad", "Dad-joke dad hiding a second phone", "family marriage", "warm, round, mid-pitched", "Twinkly eyes and a goofy grin", "Dad-bod build", "a tucked-in striped polo, cargo shorts, a fanny pack and white sneakers"],
  ["georgia", "Georgia Peach", "peach", "F", 66, "Rich widow", "Southern widow, five husbands", "money marriage", "slow, soft, sugary drawl", "Heavy-lidded glamorous eyes, dramatic lashes and a sugary smile", "Curvy build", "a peach silk kaftan, a wide-brim sun hat, big pearls and gold sandals"],
  ["percy", "Percy Peach", "peach", "M", 27, "Waiter", "Actor-slash-waiter, always auditioning", "service dating", "projecting, rich, rolling", "Expressive dramatic eyes and a stagey smile", "Slim build", "a black vest over a white shirt, a black bow tie, black trousers and a waiter's apron"],
  ["penny", "Penny Peach", "peach", "F", 42, "Divorce lawyer", "Shark divorce lawyer", "law marriage", "low, crisp, cool-toned", "Cold calculating eyes and a thin smirk", "Tall, sleek build", "a sharp charcoal pantsuit, a silk blouse, a gold watch and stilettos"],
  ["hank", "Hank Peach", "peach", "M", 58, "Security guard", "Night guard who watches all the cameras", "office crime", "slow, dry, low", "Droopy watchful eyes and a flat mouth", "Heavy build", "a navy security guard uniform with a badge, a radio on the belt and black boots"],
  // ── strawberry ──
  ["stan", "Stan Straw", "strawberry", "M", 35, "Mailroom guy", "Mailroom guy who reads the memos", "office", "casual, mid-pitched, quick", "Curious raised-brow eyes and a crooked grin", "Wiry build", "a red polo shirt, khaki cargo pants, sneakers and a lanyard"],
  ["rosa", "Rosa Red", "strawberry", "F", 30, "Bride", "Bridezilla counting every gift", "wedding", "shrill, high, fast", "Intense wide eyes and a clenched smile", "Slim build", "a huge floor-length white ballgown wedding dress and a short veil", { legs: "covered" }],
  ["stella", "Stella Berry", "strawberry", "F", 47, "Hairdresser", "Salon owner, knows every secret", "service neighbors", "loud, quick, chatty rhythm", "Winged-liner eyes and a gossipy grin", "Curvy build", "a black salon smock over a leopard top, black leggings and platform sneakers"],
  ["jimmy", "Jimmy Jam", "strawberry", "M", 24, "Streamer", "Loud gaming streamer", "social", "loud, high-energy, fast", "Wild wide eyes and an open shouting grin", "Skinny build", "an oversized plain red gaming jersey, black shorts, gaming headphones around the neck and slides"],
  ["sid", "Sid Shortcake", "strawberry", "M", 53, "Judge", "Stern judge with a soft heart", "law", "deep, measured, even", "Stern eyes over half-moon glasses and a firm mouth", "Tall, heavy build", "a black judge's robe over a white collar and black shoes"],
  // ── grape ──
  ["greta", "Greta Grape", "grape", "F", 34, "Maid of honor", "Maid of honor in love with the groom", "wedding dating", "soft, light, mid-pitched", "Guilty sideways eyes and a nervous smile", "Slim build", "a lavender satin bridesmaid gown and silver heels"],
  ["vinny", "Vinny Vine", "grape", "M", 49, "Con artist", "Smooth con man with ten names", "crime money", "silky, fast, smooth", "Sly narrow eyes and a slick smile", "Lean build", "a burgundy velvet blazer, a black turtleneck, black trousers and loafers"],
  ["gordon", "Gordon Grape", "grape", "M", 61, "Mayor", "Small-town mayor with big secrets", "social neighbors", "booming, smooth, resonant", "Wide politician eyes and a practiced grin", "Big-bellied build", "a navy suit, a purple tie, a mayor's sash and polished shoes"],
  ["connie", "Connie Concord", "grape", "F", 43, "Stepmom", "Stepmom who wants the house", "family money", "soft, smooth, cool-toned", "Sweet eyes and a tight icy smile", "Slim, toned build", "a white tennis dress, a pastel sweater tied over the shoulders and white sneakers"],
  ["gabe", "Gabe Grape", "grape", "M", 26, "Bartender", "Bartender who hears every confession", "service dating", "low, smooth, relaxed", "Relaxed half-lidded eyes and a knowing smirk", "Lean build", "a black button-up shirt with rolled sleeves, a black apron and dark jeans"],
  // ── lemon ──
  ["lenny", "Lenny Lemon", "lemon", "M", 57, "Landlord", "Landlord who raises rent every scene", "neighbors money", "gruff, rough, low", "Greedy squinting eyes and a sour frown", "Stocky build", "a yellow short-sleeved shirt, a gold chain, grey slacks and a ring of keys on the belt"],
  ["lola", "Lola Lemon", "lemon", "F", 28, "Barista", "Sarcastic barista, remembers every order", "service dating", "dry, flat, low", "Unimpressed half-lidded eyes and a smirk", "Slim build", "a green barista apron over a striped tee, black jeans and a beanie"],
  ["larry", "Larry Zest", "lemon", "M", 39, "Cop", "Sour cop who never smiles", "law crime", "flat, low, rough", "Hard squinting eyes and a flat mouth", "Solid build", "a dark blue police uniform with a badge, a duty belt and black boots"],
  ["lucy", "Lucy Lemon", "lemon", "F", 23, "Intern", "Intern who wants the boss's job", "office dating", "light, sweet-toned, clear", "Innocent wide eyes and a calculating little smile", "Petite build", "a yellow knit vest over a white shirt, grey trousers and loafers"],
  ["martin", "Martin Meyer", "lemon", "M", 66, "Founder", "Retired founder who shows up unannounced", "office money", "slow, formal diction, older, soft", "Weary eyes behind bifocals and a patient frown", "Thin, stooped build", "a brown tweed jacket with elbow patches, a knit vest, a bow tie and grey trousers"],
  // ── lime ──
  ["lionel", "Lionel Lime", "lime", "M", 44, "Private eye", "PI hired to follow the husband", "law marriage", "low, smoky, unhurried", "Shadowed watchful eyes and a cynical half-smile", "Lean build", "a tan trench coat, a grey fedora, a dark suit and black shoes"],
  ["lila", "Lila Lime", "lime", "F", 33, "Marketing lead", "Marketing lead who steals ideas", "office social", "peppy, high, bright", "Bright eyes and a too-wide smile", "Toned build", "a lime-green blazer, a white tee, cropped black trousers and white sneakers"],
  ["kay", "Kay Key", "lime", "F", 61, "Secretary", "Executive secretary for 30 years", "office", "whispery, thin, older", "Sharp watchful eyes behind half-moon glasses and a thin smile", "Small, wiry build", "a lime tweed skirt suit, a pearl brooch and low pumps"],
  ["leo", "Leo Lime", "lime", "M", 21, "Young lover", "Wife's much younger secret lover", "marriage dating", "loud, drawling, young", "Goofy half-open eyes and a big dumb grin", "Tall, gangly build", "a backwards green cap, a tank top, board shorts and flip-flops"],
  // ── banana ──
  ["bruno", "Bruno Banana", "banana", "M", 42, "Sales rep", "Top sales rep who fakes his numbers", "office", "loud, heavy, fast", "Overconfident eyes and a salesman's grin", "Broad, muscular build", "a shiny grey suit, an open-collar yellow shirt and pointed shoes"],
  ["bea", "Bea Banana", "banana", "F", 37, "Flight attendant", "Flight attendant with a man in every city", "service dating", "soft, light, sweet-toned", "Friendly practiced eyes and a sly smile", "Slim build", "a navy flight attendant uniform with a pencil skirt, a silk neck scarf and navy heels"],
  ["barb", "Barb Bunch", "banana", "F", 68, "Aunt", "Aunt who brings drama to every holiday", "family", "loud, older, carrying", "Wide nosy eyes and an open gossiping mouth", "Round build", "a loud Christmas sweater, purple velour pants and white orthopedic sneakers"],
  ["buddy", "Buddy Banana", "banana", "M", 55, "Taxi driver", "Taxi driver who knows every affair", "service marriage", "gravelly, warm, chatty rhythm", "Amused tired eyes and a gap-toothed grin", "Heavy build", "a checked flat cap, a brown leather jacket over a yellow shirt and jeans"],
  ["bonnie", "Bonnie Banana", "banana", "F", 22, "Pop star", "Pop star with a secret boyfriend", "social dating", "high, sing-song lilt, young", "Big glittery eyes and a pouty smile", "Petite build", "a sparkly silver crop top, a yellow miniskirt and white platform boots"],
  ["chip", "Chip Cavendish", "banana", "M", 30, "Groom", "Groom with cold feet", "wedding", "soft, light, slightly shaky", "Panicked eyes and a shaky smile", "Tall, lanky build", "a black tuxedo, a white boutonniere and polished shoes"],
  // ── pineapple ──
  ["pablo", "Pablo Pine", "pineapple", "M", 36, "Inmate", "New inmate who talks too much", "crime", "quick, light, a little breathy", "Jittery wide eyes and a nervous grin", "Wiry build", "an orange prison jumpsuit, white socks and slip-on shoes"],
  ["pam", "Pam Pineapple", "pineapple", "F", 52, "Warden", "Warden with a soft spot", "crime law", "firm, low, slightly raspy", "Tired stern eyes and a flat mouth", "Sturdy build", "a grey warden's uniform with a badge, a black belt and black boots"],
  ["tony", "Tony Tropic", "pineapple", "M", 60, "Resort owner", "Resort owner hiding debt", "money", "smooth, warm, older baritone", "Jovial crinkled eyes and a wide showman grin", "Big-bellied build", "a loud tropical print shirt, white linen trousers, a panama hat and boat shoes"],
  ["piper", "Piper Pine", "pineapple", "F", 30, "Reality star", "Reality-show villain", "social dating", "loud, bright, quick", "Dramatic eyes with thick lashes and a smirk", "Curvy build", "a gold sequin minidress and clear heels"],
  // ── coconut ──
  ["carl", "Carl Coconut", "coconut", "M", 50, "Prison guard", "Prison guard taking bribes", "crime", "gruff, flat, low", "Bored heavy-lidded eyes and a crooked smirk", "Heavy build", "a khaki prison guard uniform, a baton on the belt and black boots"],
  ["cora", "Cora Coconut", "coconut", "F", 45, "Surgeon", "Cold-blooded star surgeon", "hospital", "clipped, even, mid-pitched", "Focused cold eyes and a thin line of a mouth", "Tall, lean build", "dark green surgical scrubs, a surgical cap and white clogs"],
  ["kai", "Kai Coconut", "coconut", "M", 27, "Lifeguard", "Lifeguard dating a married woman", "marriage sports", "relaxed, mellow, low", "Relaxed eyes and an easy grin", "Athletic surfer build", "red lifeguard swim shorts, a white tank top, a whistle on a cord and flip-flops"],
  ["hazel", "Hazel Husk", "coconut", "F", 63, "Fortune teller", "Fortune teller who's always right", "social family", "slow, airy, older, soft", "Knowing half-closed eyes and a calm smile", "Soft, round build", "a tailored plum blazer, a cream silk blouse, wide black trousers and low black heels"],
  // ── orange ──
  ["oscar", "Oscar Orange", "orange", "M", 47, "Dad", "Dad having a midlife crisis", "family marriage", "hearty, bright, mid-pitched", "Excited eyes and a too-young grin", "Soft middle-aged build", "a black leather jacket, a white v-neck tee, skinny jeans and brand-new red sneakers"],
  ["clara", "Clara Clementine", "orange", "F", 21, "Daughter", "Daughter who brought home a 50-year-old", "family dating", "bright, clear, young", "Defiant raised-brow eyes and a confident smile", "Slim build", "an orange corduroy overall dress over a striped tee, white socks and platform boots"],
  ["otto", "Otto Orange", "orange", "M", 69, "Butler", "Butler who knows where bodies are buried", "money family", "dry, formal diction, older, slow", "Heavy-lidded discreet eyes and a tiny smirk", "Tall, thin, upright build", "a black tailcoat, a grey waistcoat, black trousers, white gloves and polished black shoes"],
  ["tanya", "Tanya Tangerine", "orange", "F", 38, "Cashier", "Cashier who judges your groceries", "service", "flat, drawling, low", "Judging side-eye and a popping-gum smirk", "Medium build", "a red supermarket vest over a black long-sleeve top, black jeans and a name tag"],
  ["jojo", "Jojo Juice", "orange", "M", 29, "Best man", "Best man with a terrible speech", "wedding dating", "loud, loose, quick", "Tipsy happy eyes and a lopsided grin", "Stocky build", "a grey suit with a loosened tie, an untucked shirt and scuffed dress shoes"],
  ["mandy", "Mandy Mandarin", "orange", "F", 56, "Talk show host", "Daytime talk show host", "social", "bright, projecting, mid-pitched", "Big TV-bright eyes and a dazzling smile", "Curvy build", "a fitted tangerine sheath dress, a chunky gold necklace and gold heels"],
  // ── kiwi ──
  ["ken", "Ken Kiwi", "kiwi", "M", 41, "IT guy", "IT guy who reads everyone's email", "office", "monotone, flat, mid-pitched", "Smug half-lidded eyes and a tiny smirk", "Soft build", "a wrinkled plain green tee, a zip hoodie, cargo shorts and sandals with socks"],
  ["nora", "Nora Kiwi", "kiwi", "F", 58, "Counselor", "Marriage counselor who takes sides", "marriage", "soft, soothing, older", "Soft sympathetic eyes and a patient smile", "Medium build", "a sage knit cardigan, a cream blouse, wide trousers and a long beaded necklace"],
  ["kurt", "Kurt Kiwi", "kiwi", "M", 24, "Rookie cop", "Rookie cop, first week", "law", "squeaky, high, quick", "Eager wide eyes and a nervous grin", "Slim build", "a light blue police shirt with a badge, dark trousers, a duty belt and a police cap"],
  // ── watermelon ──
  ["wanda", "Wanda Melon", "watermelon", "F", 59, "Trophy wife", "Rich housewife with a pool boy", "marriage money", "slow, soft, drawling", "Lazy glamorous eyes behind big sunglasses pushed up on the head and a sweet smile", "Curvy build", "a short pink silk robe over a swimsuit, gold jewelry and feathered slippers", { legs: "bare" }],
  ["mel", "Mel Melon", "watermelon", "M", 34, "Pool guy", "Pool guy with too many clients", "dating money", "relaxed, smooth, low", "Flirty eyes and a lazy grin", "Fit build", "a white polo with rolled sleeves, blue swim shorts and slides"],
  ["rhonda", "Rhonda Rind", "watermelon", "F", 40, "Wife", "PTA mom who suspects her husband", "marriage school", "shrill, loud, fast", "Intense suspicious eyes and a tight smile", "Slim, brisk build", "a quilted green vest over a white long-sleeve tee, yoga pants and white sneakers"],
  ["wes", "Wes Watermelon", "watermelon", "M", 25, "Athlete", "Athlete caught with the coach's wife", "marriage sports", "clear, mid-pitched, quick", "Cocky eyes and a confident smirk", "Tall athletic build", "a red-and-white basketball jersey with no text, basketball shorts and high-top sneakers"],
  // ── cherry ──
  ["chloe", "Chloe Cherry", "cherry", "F", 26, "Girlfriend", "Jealous girlfriend who checks his phone", "dating", "light, sweet-toned, crisp", "Suspicious narrowed eyes and a sweet smile", "Petite build", "a red cropped cardigan, a black pleated miniskirt and white sneakers"],
  ["charlie", "Charlie Cherry", "cherry", "M", 39, "Husband", "Cheating husband on a 'work trip'", "marriage", "smooth, mid-pitched, a little quick", "Shifty eyes and a too-wide smile", "Fit build", "a navy quarter-zip sweater, grey chinos, a smartwatch and loafers"],
  ["carmen", "Carmen Cherry", "cherry", "F", 41, "Mistress", "Other woman who wants a ring", "marriage dating", "low, husky, rich", "Sultry smoky eyes and a bold red smile", "Curvy build", "a deep red bodycon dress, a black leather jacket and black heels"],
  ["chuck", "Chuck Cherry", "cherry", "M", 66, "Husband", "Retired husband who suspects everyone", "marriage neighbors", "grumbly, low, older", "Grumpy suspicious eyes and a deep frown", "Stocky build", "a white undershirt, a red flannel shirt open over it, grey work pants and a trucker cap"],
  ["bing", "Bing Cherry", "cherry", "M", 23, "Blind date", "Dating-app date with fake photos", "dating", "high, halting rhythm, quick", "Awkward hopeful eyes and a nervous smile", "Short, skinny build", "a too-big maroon blazer over a black tee, dark jeans and sneakers"],
  ["tara", "Tara Cherry", "cherry", "F", 52, "Hotel manager", "Hotel manager covering scandals", "service money", "smooth, clear, mid-pitched", "Polished calm eyes and a professional smile", "Slim build", "a black fitted blazer with a gold name pin, a white blouse, a black pencil skirt and black heels"],
  // ── pear ──
  ["perry", "Perry Pear", "pear", "M", 45, "Manager", "Middle manager who takes credit", "office", "nasal, reedy, thin", "Smug eyes and a self-satisfied grin", "Pear-shaped build", "a light blue shirt, a yellow tie, grey slacks and a lanyard"],
  ["paula", "Paula Pear", "pear", "F", 38, "Neighbor", "Perfect neighbor with a dark secret", "neighbors marriage", "soft, whispery, light", "Too-perfect sweet eyes and a frozen smile", "Slim build", "a pastel yellow gingham dress, a white cardigan and ballet flats"],
  ["bart", "Bart Bartlett", "pear", "M", 61, "Billionaire", "Billionaire who fakes being broke", "money", "dry, low, older", "Amused shrewd eyes and a thin smile", "Thin build", "a worn beige cardigan, old corduroys and scuffed loafers, with a very expensive watch"],
  ["anya", "Anya Anjou", "pear", "F", 27, "Assistant", "Assistant who secretly runs the company", "office", "clear, even pace, mid-pitched", "Calm sharp eyes and a polite smile", "Slim build", "a cream turtleneck, a tailored grey blazer, black trousers and black loafers"],
  ["boris", "Boris Bosc", "pear", "M", 50, "Heist planner", "Heist planner, always has a plan B", "crime", "slow, deep, measured", "Calculating narrowed eyes and a faint smirk", "Solid build", "a black turtleneck, a dark grey peacoat, black gloves and black trousers"],
  // ── plum ──
  ["polly", "Polly Plum", "plum", "F", 70, "Grandma", "Grandma with a secret boyfriend", "family dating", "high, trilling, older", "Twinkling mischievous eyes and a giggly smile", "Tiny, round build", "a lavender tweed jacket, a pleated plum skirt, a brooch and low heels"],
  ["philip", "Philip Plum", "plum", "M", 58, "CFO", "CFO hiding the real numbers", "office money", "rich, plummy, formal diction", "Condescending eyes over wire glasses and a pursed mouth", "Tall, thin build", "a plum three-piece suit, a gold tie pin and black oxfords"],
  ["priya", "Priya Plum", "plum", "F", 35, "Doctor", "ER doctor, no patience", "hospital", "fast, crisp, clear", "Tired sharp eyes and a no-nonsense mouth", "Slim build", "a white doctor's coat over navy scrubs, a stethoscope and white sneakers"],
  ["dan", "Dan Damson", "plum", "M", 30, "Mechanic", "Mechanic who overcharges everyone", "service", "mellow, mid-pitched, relaxed pace", "Easygoing eyes and a shady grin", "Stocky build", "grease-stained navy coveralls, a red rag in the pocket and work boots"],
  // ── blueberry ──
  ["betty", "Betty Blue", "blueberry", "F", 48, "Single mom", "Divorced mom back on the dating apps", "dating family", "quick, breathy, mid-pitched", "Hopeful tired eyes and a nervous smile", "Soft build", "a blue wrap top, dark jeans, ankle boots and big hoop earrings"],
  ["barry", "Barry Blue", "blueberry", "M", 56, "Car salesman", "Car salesman who lies with a smile", "service money", "fast, smooth, silky", "Slick wide eyes and a salesman's grin", "Round build", "a shiny royal-blue suit, a loud striped tie and white loafers"],
  ["bree", "Bree Blueberry", "blueberry", "F", 22, "Babysitter", "Babysitter who knows too much", "family", "chirpy, high, quick", "Sly bright eyes and a secretive smile", "Petite build", "a baby-blue hoodie, denim shorts over black tights and sneakers"],
  ["jay", "Jay Blue", "blueberry", "M", 32, "Paramedic", "Paramedic, calm in any crisis", "hospital", "steady, even, mid-pitched", "Steady calm eyes and a reassuring smile", "Fit build", "a navy paramedic uniform with reflective stripes, cargo pants and black boots"],
  ["violet", "Violet Blue", "blueberry", "F", 65, "Gossip columnist", "Gossip columnist with a big mouth", "social", "low, purring, older", "Gleeful gossiping eyes behind jeweled glasses and a sly smile", "Slim build", "a blue velvet blazer, a silk scarf, black trousers and pointed flats"],
  ["moe", "Moe Blue", "blueberry", "M", 43, "Bouncer", "Bouncer who never lets anyone in", "crime service", "deep, flat, heavy", "Unimpressed heavy eyes and a flat mouth", "Huge broad build", "a black bomber jacket, a black tee, black jeans and an earpiece"],
  // ── raspberry ──
  ["remy", "Remy Raspberry", "raspberry", "M", 27, "Sous-chef", "Sous-chef plotting to take over", "service", "quiet, low, soft", "Scheming narrowed eyes and a small smile", "Lean build", "a black chef jacket, a black cap, black trousers and kitchen clogs"],
  ["rita", "Rita Raspberry", "raspberry", "F", 54, "Inmate", "Cellblock queen", "crime", "raspy, rough, low", "Tough knowing eyes and a crooked smirk", "Sturdy build", "a khaki prison uniform shirt and trousers, sleeves rolled, and white sneakers"],
  ["ron", "Ron Raspberry", "raspberry", "M", 64, "Chairman", "Company chairman who hates change", "office money", "slow, booming, older", "Heavy unimpressed eyes and a stern mouth", "Round build", "a grey double-breasted suit, a raspberry pocket square and black oxfords"],
  ["rae", "Rae Raspberry", "raspberry", "F", 31, "Tattoo artist", "Tattoo artist who covers exes' names", "service dating", "low, smooth, cool-toned", "Cool heavy-lidded eyes and a half-smile", "Slim build", "a black sleeveless denim vest over a plain grey tee, black ripped jeans and combat boots"],
  // ── avocado ──
  ["ava", "Ava Avocado", "avocado", "F", 29, "Tenant", "Millennial who can't afford a house", "neighbors money", "nasal, bright, quick", "Exasperated eyes and a wry smile", "Medium build", "a green oversized knit sweater, mom jeans and white sneakers"],
  ["al", "Al Avocado", "avocado", "M", 57, "Mob accountant", "Mob accountant, knows every number", "crime money", "quiet, breathy, soft", "Nervous eyes behind thick glasses and a tight mouth", "Soft, round build", "a rumpled brown suit, a loosened tie and scuffed shoes"],
  ["hector", "Hector Hass", "avocado", "M", 45, "Lawyer", "Flashy lawyer, never lost a case", "law office", "smooth, loud, resonant", "Confident gleaming eyes and a flashy grin", "Tall build", "a shiny olive three-piece suit, a gold tie clip and pointed shoes"],
  ["addie", "Addie Avocado", "avocado", "F", 40, "Wellness guru", "Wellness guru selling nonsense", "social", "airy, soft, light", "Serene half-closed eyes and a blissful smile", "Slim build", "a flowing cream linen set, many crystal necklaces and barefoot-style sandals"],
  ["andre", "Andre Avocado", "avocado", "M", 34, "Ex-husband", "Ex-husband who wants her back", "marriage dating", "soft, warm, low", "Sad puppy eyes and a hopeful smile", "Fit build", "a dark green henley, a brown suede jacket, jeans and boots"],
  ["edna", "Edna Avocado", "avocado", "F", 67, "Mother of the bride", "Mother of the bride, hates everyone", "wedding family", "shrill, high, older", "Disapproving eyes and a pinched smile", "Stout build", "a green satin mother-of-the-bride dress with a matching jacket and a fascinator"],
  // ── pomegranate ──
  ["priscilla", "Priscilla Pom", "pomegranate", "F", 60, "Heiress", "Old-money heiress", "money family", "rich, crisp, older, formal diction", "Icy regal eyes and a thin smile", "Tall, slim build", "a deep red silk evening gown, long black gloves and a diamond necklace"],
  ["pedro", "Pedro Pom", "pomegranate", "M", 37, "Detective", "Detective on the affair case", "law crime", "slow, sharp, low", "Sharp tired eyes and a thoughtful frown", "Solid build", "a rumpled grey suit, a loose burgundy tie and a detective badge on the belt"],
  ["ruby", "Ruby Pom", "pomegranate", "F", 26, "Nail tech", "Nail tech who spreads rumors", "service", "quick, bright, chatty rhythm", "Excited gossiping eyes and a big grin", "Petite build", "a pink salon tunic, black leggings and sneakers"],
  ["omar", "Omar Pom", "pomegranate", "M", 48, "Restaurant owner", "Restaurant owner in debt to the mob", "service crime", "warm, soft, mid-pitched", "Warm worried eyes and a strained smile", "Heavy build", "a white shirt with rolled sleeves, a burgundy vest, black trousers and a towel over the shoulder"],
  // ── fig ──
  ["felix", "Felix Fig", "fig", "M", 29, "Barber", "Barber who gives life advice", "service dating", "smooth, warm, even pace", "Wise calm eyes and an easy smile", "Lean build", "a black barber smock, a white tee, dark jeans and white sneakers"],
  ["fran", "Fran Fig", "fig", "F", 69, "Widow", "Widow with eyes on the neighbor", "neighbors dating", "slow, husky, older", "Flirty eyes with blue eyeshadow and a coy smile", "Round build", "a purple tracksuit, gold earrings and white sneakers"],
  ["farrah", "Farrah Fig", "fig", "F", 33, "Designer", "Fashion designer, no filter", "social", "crisp, posh British accent", "Cutting unimpressed eyes and a pout", "Tall, slim build", "an asymmetric black designer dress, huge sunglasses on the head and platform heels"],
  // ── papaya ──
  ["pappy", "Pappy Papaya", "papaya", "M", 70, "Grandpa", "Grandpa who says the quiet part loud", "family", "loud, crackly, older", "Cheeky squinting eyes and a toothy grin", "Small, bony build", "a Hawaiian shirt, beige shorts, knee socks and sandals"],
  ["paco", "Paco Papaya", "papaya", "M", 32, "Food truck owner", "Food truck owner, loud and proud", "service", "loud, bright, quick", "Happy crinkled eyes and a huge grin", "Stocky build", "an orange tee, a stained white apron, a backwards cap and jeans"],
  ["pilar", "Pilar Papaya", "papaya", "F", 44, "Housekeeper", "Housekeeper who sees everything", "money family", "quiet, low, soft", "Quiet knowing eyes and a small smile", "Medium build", "a grey housekeeper dress with a white apron and black flats"],
  ["patty", "Patty Papaya", "papaya", "F", 25, "Cheer coach", "Cheer coach, extremely intense", "sports school", "loud, high, fast", "Intense wide eyes and a huge grin", "Athletic build", "an orange-and-white tracksuit, a whistle and white trainers"],
  // ── dragon fruit ──
  ["dex", "Dex Dragon", "dragon fruit", "M", 38, "Club owner", "Nightclub owner with shady friends", "crime money", "smooth, low, relaxed", "Cool narrowed eyes and a sly smirk", "Lean build", "a hot-pink velvet suit, a black silk shirt and black loafers"],
  ["daria", "Daria Dragon", "dragon fruit", "F", 31, "Rock star", "Rock star on a comeback", "social", "raspy, loud, fast", "Wild smudged-eyeliner eyes and a rebellious grin", "Slim build", "a studded black leather jacket, a pink mesh top, black leather pants and platform boots"],
  ["dot", "Dot Dragon", "dragon fruit", "F", 64, "Rich aunt", "Rich aunt who controls the family money", "money family", "sharp, thin, older", "Sly sharp eyes and a tiny smile", "Small build", "a pink silk qipao-style dress with a jade necklace and embroidered flats"],
  ["ty", "Ty Dragon", "dragon fruit", "M", 26, "Rapper", "Rapper who's never left the suburbs", "social", "loud, clear, quick", "Cocky squinting eyes and a grin", "Slim build", "an oversized pink puffer jacket, baggy black jeans, chunky sneakers and a thick chain"],
  // ── grapefruit ──
  ["gail", "Gail Grapefruit", "grapefruit", "F", 50, "Office manager", "Office manager who controls the snacks", "office", "tight, clipped, mid-pitched", "Strict eyes and a tight smile", "Medium build", "a coral cardigan over a white blouse, grey trousers and a lanyard with many keys"],
  ["grant", "Grant Grapefruit", "grapefruit", "M", 55, "Politician", "Politician with a hidden family", "social marriage", "booming, smooth, resonant", "Practiced trustworthy eyes and a fake smile", "Tall build", "a navy suit, a pink tie, a small gold lapel pin and polished shoes"],
  ["ruth", "Ruth Grapefruit", "grapefruit", "F", 68, "Grandma", "Grandma who hates every girlfriend", "family dating", "sharp, dry, older", "Sharp suspicious eyes and a tight frown", "Thin build", "a coral twin-set, a knee-length grey skirt, pearls and sensible shoes"],
  ["hal", "Hal Grapefruit", "grapefruit", "M", 43, "Gym teacher", "Gym teacher who peaked in high school", "school sports", "loud, rough, barking", "Intense eyes and a whistle-ready grin", "Stocky build", "a red polo, navy track pants, a whistle and white sneakers"],
  // ── apricot ──
  ["april", "April Apricot", "apricot", "F", 27, "Makeup artist", "Makeup artist to the stars", "social service", "chatty rhythm, bright, quick", "Dramatic glittery eyes and a big smile", "Slim build", "a black apron with brush pockets over a peach tee, black jeans and sneakers"],
  ["archie", "Archie Apricot", "apricot", "M", 65, "Dad", "Retired army dad, very strict", "family wedding", "barking, gruff, older", "Stern squinting eyes and a clipped frown", "Upright, solid build", "a pressed khaki shirt, a sweater vest, creased trousers and polished boots"],
  ["aria", "Aria Apricot", "apricot", "F", 36, "Pilot", "Airline pilot, cool under pressure", "service dating", "cool-toned, clear, even", "Cool confident eyes and a slight smile", "Tall build", "a navy pilot uniform with gold stripes on the sleeves, a pilot cap and black shoes"],
  ["arlo", "Arlo Apricot", "apricot", "M", 24, "Intern", "Overconfident intern", "office", "loud, quick, young", "Overconfident bright eyes and a grin", "Slim build", "a slightly too-big grey suit, a skinny orange tie and brown shoes"],
  // ── lychee ──
  ["lily", "Lily Lychee", "lychee", "F", 30, "Dentist", "Dentist with a scary smile", "hospital", "bubbly, high, light", "Bright unblinking eyes and a huge perfect smile", "Slim build", "a pink dental tunic, white trousers and white clogs"],
  ["lee", "Lee Lychee", "lychee", "M", 52, "Casino owner", "Casino owner, calm and dangerous", "money crime", "low, quiet, even", "Calm cold eyes and a faint smile", "Slim build", "a white dinner jacket, a black bow tie, black trousers and a gold ring"],
  ["lulu", "Lulu Lychee", "lychee", "F", 46, "Spa owner", "Spa owner who runs a gossip ring", "service neighbors", "silky, smooth, low", "Silky knowing eyes and a gentle smile", "Curvy build", "a white spa tunic, wide white trousers and slippers"],
  // ── blackberry ──
  ["brad", "Brad Bramble", "blackberry", "M", 40, "Husband", "Firefighter husband with a second phone", "marriage dating", "deep, even, unhurried", "Calm steady eyes and a too-innocent smile", "Big, strong build", "a navy firefighter tee, tan turnout pants with suspenders and black boots"],
  ["bianca", "Bianca Bramble", "blackberry", "F", 34, "Ex-wife", "Ex-wife who won everything", "marriage money", "low, crisp, cool-toned", "Icy amused eyes and a smirk", "Slim build", "a black fitted blazer dress, oversized sunglasses pushed up and black heels"],
  ["mac", "Mac Black", "blackberry", "M", 60, "Mob boss", "Old-school mob boss", "crime", "whispery, low, flat", "Cold heavy-lidded eyes and an unreadable mouth", "Heavy build", "a black pinstripe suit, a black shirt, a white tie and a fedora"],
  ["dolly", "Dolly Bramble", "blackberry", "F", 57, "Cleaner", "Night cleaner who reads every desk", "office", "gruff, low, older", "Sly half-lidded eyes and a flat mouth", "Stout build", "a navy cleaning uniform tunic, black trousers, yellow rubber gloves and rubber clogs"],
  // ── honeydew ──
  ["harriet", "Harriet Honeydew", "honeydew", "F", 62, "Librarian", "Librarian who shushes everyone", "school", "whispery, crisp, older", "Strict eyes over cat-eye glasses and pursed lips", "Thin build", "a mint cardigan, a long tweed skirt with thick tights and oxford shoes"],
  ["hugh", "Hugh Honeydew", "honeydew", "M", 29, "Nurse", "Male nurse everyone flirts with", "hospital dating", "gentle, soft, mid-pitched", "Gentle kind eyes and a shy smile", "Fit build", "teal scrubs, a stethoscope and white sneakers"],
  ["dewey", "Dewey Honeydew", "honeydew", "M", 47, "Weatherman", "TV weatherman, always wrong", "social", "bright, bouncy rhythm, mid-pitched", "Cheesy bright eyes and a TV grin", "Medium build", "a mint green suit, a yellow tie and brown shoes"],
  // ── durian ──
  ["duke", "Duke Durian", "durian", "M", 58, "Loan shark", "Loan shark nobody can stand", "crime money", "slow, deep, gravelly", "Menacing narrow eyes and a sneer", "Heavy build", "a green silk shirt, a white suit jacket, gold rings and white trousers"],
  ["doris", "Doris Durian", "durian", "F", 66, "Mother-in-law", "Mother-in-law who moved in", "family marriage", "shrill, high, older", "Disapproving squinting eyes and a sour mouth", "Short, stout build", "an olive floral blouse, polyester slacks and orthopedic shoes"],
  ["dusty", "Dusty Durian", "durian", "M", 33, "Husband", "Lazy husband who hides the bills", "marriage money", "loud, drawling, lazy pace", "Sleepy guilty eyes and a lazy grin", "Slouchy build", "a stained olive hoodie, grey sweatpants and flip-flops"],
];

// ── Collection "uk-roadman": modern London streetwear, bright fruits only ──
// Row: id | name | fruit | F/M | age | tag | role | story types | voice | face | build | outfit | settings
export const SETTINGS = {
  "london-estate": "London estate",
  "chicken-shop": "Chicken shop",
  "corner-shop": "Corner shop",
  barbershop: "Barbershop",
  "night-bus": "Night bus",
  "rainy-street": "Rainy street",
};
const ROADMAN_AVOID = "No real brand logos or brand patterns, no weapons, no drugs, no gang signs or hand signs, no money. Any balaclava is rolled down around the neck like a neck warmer, face fully visible.";
const ROADMAN_ROWS = [
  ["lemz", "Lemz", "lemon", "M", 23, "Crew leader", "Mandem leader, always has a plan", "dating neighbors", "low, unhurried London accent", "Confident half-lidded eyes and a small knowing smirk", "Lean build", "a plain grey tech-fleece tracksuit, a black crossbody bag, a thin gold chain and chunky white trainers", "london-estate rainy-street"],
  ["zesty", "Zesty", "lime", "M", 19, "Youngest", "Youngest in the crew, trying too hard", "neighbors family", "fast, high, young London accent", "Eager wide eyes and a cheeky grin", "Skinny build", "an oversized black puffer jacket, lime-green tracksuit bottoms, a black beanie and white trainers", "london-estate night-bus"],
  ["tomzy", "Tomzy", "tomato", "M", 24, "Mandem", "Crew joker, turns everything into a bit", "dating neighbors", "loud, bouncy London accent", "Bright mischievous eyes and a wide grin", "Stocky build", "a plain red tech-fleece tracksuit, a black bucket hat, a gold chain and black chunky trainers", "london-estate chicken-shop"],
  ["razz", "Razz", "raspberry", "M", 23, "Rival", "Rival from the other estate", "neighbors dating", "low, clipped London accent", "Cold narrowed eyes and a confident smirk", "Athletic build", "a plain all-black tracksuit, a black balaclava rolled down around the neck as a neck warmer with the face fully visible, a crossbody bag and grey trainers", "london-estate rainy-street"],
  ["pinesy", "Pinesy", "pineapple", "M", 21, "Rapper", "Aspiring rapper, one freestyle from fame", "social dating", "rhythmic, smooth London accent", "Bold confident eyes and a big grin", "Slim build", "a cropped yellow puffer jacket, black cargo trousers, two thick gold chains and chunky white trainers", "london-estate night-bus"],
  ["pez", "Pez", "pear", "M", 27, "Producer", "Bedroom music producer, hears beats everywhere", "social", "soft, mellow, slow London accent", "Sleepy creative eyes and a relaxed smile", "Soft build", "an oversized cream hoodie, grey joggers, over-ear headphones around the neck and grey trainers", "london-estate night-bus"],
  ["wedge", "Wedge", "watermelon", "M", 25, "Delivery rider", "Delivery rider who sees every drama", "service neighbors", "bright, quick London accent", "Friendly quick eyes and an easy grin", "Lean build", "a green waterproof jacket, black joggers, a plain square insulated delivery backpack and black trainers", "rainy-street chicken-shop"],
  ["blu", "Blu", "blueberry", "M", 26, "Reseller", "Trainer reseller, always has a deal", "money service", "smooth, silky London accent", "Sharp dealmaker eyes and a slick smile", "Slim build", "a navy puffer gilet over a white hoodie, pale blue jeans and chunky trainers in mixed colours", "london-estate corner-shop"],
  ["grapz", "Grapz", "grape", "M", 20, "Mandem", "The quiet one who notices everything", "neighbors dating", "quiet, deep, sparse London accent", "Calm watchful eyes and a flat mouth", "Tall, lean build", "a plain purple tech-fleece tracksuit, a black durag tied on the fruit head, a small silver chain and white trainers", "london-estate night-bus"],
  ["chez", "Chez", "cherry", "M", 22, "Chicken shop", "Chicken shop worker who knows everyone's order", "service dating", "warm, chatty-rhythm London accent", "Friendly tired eyes and a lopsided grin", "Wiry build", "a plain red work polo, a black cap, a short black apron, black trousers and black trainers", "chicken-shop"],
  ["uncle", "Uncle Tay", "tomato", "M", 52, "Shop owner", "Uncle who runs the chicken shop, knows every secret", "service family", "warm, booming, older London accent", "Warm crinkled eyes and a big fatherly smile", "Big, round build", "a white short-sleeved shirt, a plain red apron, grey trousers, a gold watch and comfortable black shoes", "chicken-shop"],
  ["trims", "Trims", "pear", "M", 44, "Barber", "Barber who gives the best advice on the ends", "service family", "low, measured, even London accent", "Wise calm eyes and a knowing smile", "Solid build", "a black barber tunic over a grey tee, dark jeans, a gold chain and clean white trainers", "barbershop"],
  ["rasco", "Rasco", "raspberry", "M", 28, "Mandem", "Gym-obsessed crew member, protein at all times", "sports dating", "loud, punchy London accent", "Intense proud eyes and a big grin", "Very muscular build", "a fitted black tank top, grey tech-fleece joggers, a black crossbody bag and white trainers", "london-estate barbershop"],
  ["jito", "Jito", "lime", "M", 27, "Mandem", "Always late, always has an excuse", "dating neighbors", "soft, mellow London accent", "Guilty sideways eyes and an easy smile", "Medium build", "an olive puffer jacket, a plain black tracksuit, a grey beanie and black trainers", "night-bus rainy-street"],
  ["roxy", "Roxy", "cherry", "F", 22, "Girlfriend", "Roadgyal who runs the relationship", "dating", "quick, crisp London accent", "Confident lashed eyes and a sure smile", "Slim build", "a cropped white puffer jacket over a matching red tracksuit set, gold hoop earrings and chunky white trainers", "london-estate rainy-street"],
  ["tia", "Tia", "grape", "F", 24, "Ex", "The ex who still shows up everywhere", "dating", "dry, low, cool-toned London accent", "Unimpressed half-lidded eyes and a small smirk", "Slim build", "a black cropped zip hoodie, black cargo trousers, gold hoop earrings, long nails and white platform trainers", "night-bus rainy-street"],
  ["chatty", "Chatty", "watermelon", "F", 26, "Estate gossip", "Estate gossip who hears it first", "neighbors", "fast, bright, chatty-rhythm London accent", "Wide excited eyes and an open gossiping grin", "Curvy build", "a fluffy pink zip jacket over a grey tracksuit and fluffy pink sliders with white socks", "london-estate corner-shop"],
  ["nessa", "Nessa", "lime", "F", 29, "Mum", "Young mum who takes no nonsense", "family dating", "firm, warm London accent", "Tired but sharp eyes and a firm smile", "Medium build", "a long black puffer coat, grey leggings, a cream beanie and white trainers", "london-estate corner-shop"],
  ["auntie", "Auntie Rubes", "raspberry", "F", 56, "Shop owner", "Auntie who runs the corner shop, sees everything", "service neighbors", "warm, crisp, older London accent", "Sharp caring eyes behind reading glasses and a patient smile", "Short, round build", "a burgundy cardigan over a patterned blouse, black trousers and comfortable black shoes", "corner-shop"],
  ["tizzy", "Tizzy", "tomato", "F", 21, "Roadgyal", "Roadgyal in the crew, always filming", "social dating", "loud, bubbly, fast London accent", "Big lively eyes and a wide grin", "Petite build", "a plain lilac tech-fleece tracksuit, a black bucket hat, a small crossbody bag and chunky white trainers", "london-estate night-bus"],
];

const [, , outArg] = process.argv;
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = outArg ?? path.join(here, "../../data/fruit-characters/characters.json");

const core = ROWS.map((r, i) => ({ r, collection: "core", existing: i < 14 }));
const roadman = ROADMAN_ROWS.map(([id, name, fruit, g, age, tag, role, types, voiceStyle, face, build, outfit, settings]) =>
  ({ r: [id, name, fruit, g, age, tag, role, types, voiceStyle, face, build, outfit, { settings: settings.split(" "), avoid: ROADMAN_AVOID }], collection: "uk-roadman", existing: false }));

export const CHARACTERS = [...core, ...roadman].map(({ r: [id, name, fruit, g, age, tag, role, types, voiceStyle, face, build, outfit, extra = {}], collection, existing }) => {
  const f = FRUITS[fruit];
  const c = {
    id, name, fruit, emoji: f.emoji, hue: f.hue,
    gender: g === "F" ? "female" : "male", age, ageText: ageText(age),
    collection, tag, role, storyTypes: types.split(" "), voiceStyle,
    face, build, outfit, ...extra,
    existing,
    checkFirst: Boolean(f.body), // brown-bodied: body must read as fruit, not skin
  };
  c.prompt = buildPrompt(c);
  return c;
});

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const problems = [];
  const ids = new Set(), firsts = new Map();
  for (const c of CHARACTERS) {
    if (ids.has(c.id)) problems.push(`duplicate id ${c.id}`);
    ids.add(c.id);
    const first = c.name.split(" ")[0].toLowerCase();
    if (firsts.has(first)) problems.push(`duplicate first name ${first}: ${firsts.get(first)} / ${c.id}`);
    firsts.set(first, c.id);
    if (c.age < (c.collection === "uk-roadman" ? 19 : 20) || c.age > 70) problems.push(`${c.id} age ${c.age}`);
    for (const t of c.settings ?? []) if (!SETTINGS[t]) problems.push(`${c.id} unknown setting ${t}`);
    for (const t of c.storyTypes) if (!STORY_TYPES[t]) problems.push(`${c.id} unknown story type ${t}`);
    if (c.name.split(" ").length > 2) problems.push(`${c.id} name > 2 words`);
  }
  const count = (fn) => CHARACTERS.reduce((m, c) => { for (const k of [].concat(fn(c))) m[k] = (m[k] ?? 0) + 1; return m; }, {});
  const band = (a) => (a >= 60 ? "60–70" : `${Math.floor(a / 10) * 10}s`);
  const report = {
    total: CHARACTERS.length,
    collection: count((c) => c.collection),
    gender: count((c) => c.gender),
    ageBand: count((c) => band(c.age)),
    fruit: count((c) => c.fruit),
    storyType: count((c) => c.storyTypes),
    tag: count((c) => c.tag),
    bareLegs: CHARACTERS.filter((c) => legsMode(c) === "bare").map((c) => c.id),
    problems,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ version: 2, storyTypes: STORY_TYPES, settings: SETTINGS, characters: CHARACTERS }, null, 1));
  console.log(JSON.stringify(report, null, 1));
}
