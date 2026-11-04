// Blocky Worlds: the shared catalog of the coverage kit (owner: COVERAGE, 2026-11-04). Pure data, Node + browser.
// One source for both sides: page/kit/objects.js builds these (page/kit/things.js), lib/visuals.js plans them, and
// page/kit/props.js draws the hand props. Added so the 130 library ideas show their nouns for real instead of on
// picture cards (dev/coverage.mjs measures it).
//
//   THINGS[name] = { aliases, big, place, states, state, sets?, icon }
//     aliases  the words a script says for it (singular + plural; the planner matches a line's nouns against them)
//     big      set-sized (a castle, a barn): wide shots, behind everybody, clears the street clutter
//     sets     where it belongs (the planner moves an untied shot there; first = preferred)
//   HELD[name] = [aliases]       hand props (makeHeld): the planner's HOLDABLE words
//   CREATURES[variant] = { base: "tall" | "furry", words: [...] }   monster looks (kit/monsters.js) chosen by the
//     monster's name / description ("the Detention Dragon" -> dragon)

const A = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);

/** Animals as scene objects (one builder, a species per name). */
export const ANIMALS = Object.freeze({
  dog: A("dog,dogs,puppy,puppies,hound,pet,pets,snowdog,snowdogs,snow-dogs"), cat: A("cat,cats,kitten,kittens,kitty"),
  goat: A("goat,goats"), sheep: A("sheep,lamb,lambs"), cow: A("cow,cows,calf,bull,animal,animals,critter,critters,livestock"), pig: A("pig,pigs,hog,hogs,piglet"),
  horse: A("horse,horses,pony,ponies"), bear: A("bear,bears,cub"), moose: A("moose,elk,deer,reindeer,antlers"),
  mouse: A("mouse,mice,rat,rats,hamster,hamsters"), squirrel: A("squirrel,squirrels,chipmunk"), mole: A("mole,moles"),
  rabbit: A("rabbit,rabbits,bunny,bunnies,hare"), skunk: A("skunk,skunks"), fox: A("fox,foxes"), wolf: A("wolf,wolves"),
  chicken: A("chicken,chickens,hen,hens,rooster,roosters,chick,chicks"), duck: A("duck,ducks,duckling,ducklings,goose,geese"),
  pigeon: A("pigeon,pigeons,bird,birds,crow,crows,seagull,seagulls,parrot,parrots,owl,owls,dove"),
  fish: A("fish,fishes,goldfish,anglerfish,lanternfish,eel,eels"), frog: A("frog,frogs,toad,toads"),
  snail: A("snail,snails,slug,slugs"), worm: A("worm,worms,snake,snakes,serpent,caterpillar"),
  bat: A("bat,bats"), moth: A("moth,moths,butterfly,butterflies,bug,bugs,beetle"), firefly: A("firefly,fireflies,glowworm,glowworms"),
  whale: A("whale,whales"), squid: A("squid,octopus,octopuses,tentacle,tentacles"), spider: A("spider,spiders"),
  bee: A("bee,bees,wasp,wasps"), turtle: A("turtle,turtles,tortoise"),
});
export const ANIMAL_SETS = { fish: ["street"], whale: ["street"], squid: ["street"], mole: ["woods"], worm: ["woods"], firefly: ["woods"] };

/** Creatures as scene objects (a small one of the monster looks, for a line that names one that is not the monster). */
export const CREATURE_OBJECTS = Object.freeze({
  dragon: A("dragon,dragons"), goblin: A("goblin,goblins,imp,imps,gremlin,gremlins,elf,elves"),
  yeti: A("yeti,yetis,bigfoot,sasquatch"), troll: A("troll,trolls,ogre,ogres"), ghost: A("ghost,ghosts,spirit,spirits,phantom"),
  giant: A("giant,giants"), scarecrow: A("scarecrow,scarecrows"), robot: A("robot,robots"), alien: A("alien,aliens"),
  mannequin: A("mannequin,mannequins,dummy"), unicorn: A("unicorn,unicorns"),
});

/** Scene objects (beyond the first catalog in kit/objects.js). */
export const THINGS = Object.freeze({
  // weather / sky
  cloud: { aliases: A("cloud,clouds,rain cloud,raincloud,storm cloud,thundercloud,rain,rains,raining,drizzle,storm,storms,thunder,lightning,downpour,blizzard,snowstorm"), place: "floor", states: ["plain", "rain", "snow", "storm"], state: "rain", icon: "🌧️" },
  snow_pile: { aliases: A("snow,snowdrift,snowdrifts,drift,drifts,snowbank,snowball,snowballs,snowflake,snowflakes,frost,ice,icicle,icicles,sled,sleds"), place: "floor", states: ["on"], state: "on", sets: ["street", "woods"], icon: "❄️" },
  snowman: { aliases: A("snowman,snowmen,snowwoman"), place: "floor", states: ["on"], state: "on", sets: ["street", "woods"], icon: "⛄" },
  wind_gust: { aliases: A("wind,winds,gust,gusts,breeze,gale,whirlwind,tornado"), place: "floor", states: ["on"], state: "on", icon: "🌬️" },
  fog_bank: { aliases: A("fog,mist,smoke,steam,haze,cloud of dust"), place: "floor", states: ["on"], state: "on", icon: "🌫️" },
  // town
  fountain: { aliases: A("fountain,fountains,town fountain,pool"), place: "street", states: ["on", "off"], state: "on", sets: ["street"], icon: "⛲" },
  statue: { aliases: A("statue,statues,monument,sculpture"), place: "street", states: ["on"], state: "on", sets: ["street"], icon: "🗿" },
  mailbox: { aliases: A("mailbox,mailboxes,letterbox,mail slot,letter slot"), place: "street", states: ["down", "up"], state: "up", sets: ["street"], icon: "📬" },
  fence: { aliases: A("fence,fences,fence post,fencepost,gate,gates,railing,picket fence,post,posts"), place: "street", states: ["on"], state: "on", icon: "🚧" },
  wall: { aliases: A("wall,walls,brick wall,stone wall"), place: "floor", states: ["on", "crack"], state: "on", icon: "🧱" },
  bridge: { aliases: A("bridge,bridges,drawbridge,rope bridge,footbridge"), big: true, place: "street", states: ["on"], state: "on", icon: "🌉" },
  castle: { aliases: A("castle,castles,palace,fortress,tower window,throne room,keep,moat"), big: true, place: "street", states: ["on"], state: "on", icon: "🏰" },
  trash_can: { aliases: A("trash,trash can,trashcan,garbage,garbage can,bin,bins,dumpster,dump,rubbish,litter"), place: "street", states: ["on"], state: "on", sets: ["street"], icon: "🗑️" },
  clock: { aliases: A("clock,clocks,clock tower,alarm clock,watch,watches,wristwatch,timer"), place: "street", states: ["on"], state: "on", icon: "🕰️" },
  lamp: { aliases: A("lamp,lamps,lamppost,lampposts,street lamp,streetlight,streetlights,light,lightbulb,bulb,bulbs,porch light,glow"), place: "floor", states: ["on", "off"], state: "on", icon: "💡" },
  bell: { aliases: A("bell,bells,big bell,church bell,school bell,doorbell,handbell,bell tower"), place: "floor", states: ["on"], state: "on", icon: "🔔" },
  // country
  barn: { aliases: A("barn,barns,barnyard,farm,farms,henhouse,coop,stable,shed,sheds,farmhouse"), big: true, place: "street", states: ["on"], state: "on", sets: ["woods"], icon: "🛖" },
  windmill: { aliases: A("windmill,windmills,mill"), big: true, place: "street", states: ["on"], state: "on", sets: ["woods"], icon: "🌬️" },
  haystack: { aliases: A("haystack,haystacks,hay,haybale,haybales,hay bale,hay-bale,bale,bales,straw"), place: "floor", states: ["on"], state: "on", sets: ["woods"], icon: "🌾" },
  tractor: { aliases: A("tractor,tractors,wheelbarrow,wheelbarrows,cart,carts,wagon,wagons"), place: "street", states: ["on"], state: "on", icon: "🚜" },
  garden: { aliases: A("garden,gardens,flower,flowers,tulip,tulips,vegetable,vegetables,veggies,carrot,carrots,lettuce,cabbage,cornfield,corn,crops,houseplant,houseplants,plant,plants"), place: "floor", states: ["on"], state: "on", icon: "🌷" },
  pumpkin: { aliases: A("pumpkin,pumpkins,gourd"), place: "floor", states: ["on"], state: "on", icon: "🎃" },
  // wild / underground
  hole: { aliases: A("hole,holes,drain,drains,pit,pits,shaft,mine,mines,mine shaft,tunnel,tunnels,crack,cracks,gap,gaps,burrow,sinkhole,well,manhole,sewer"), place: "floor", states: ["on"], state: "on", icon: "🕳️" },
  rock: { aliases: A("rock,rocks,boulder,boulders,stone,stones,pebble,pebbles,rubble,cliff post,ledge,ledges"), place: "floor", states: ["on"], state: "on", icon: "🪨" },
  stump: { aliases: A("stump,stumps,log,logs,tree stump"), place: "floor", states: ["on"], state: "on", sets: ["woods"], icon: "🪵" },
  mushroom: { aliases: A("mushroom,mushrooms,toadstool,toadstools,fungus"), place: "floor", states: ["on"], state: "on", icon: "🍄" },
  crystal: { aliases: A("crystal,crystals,gem,gems,jewel,jewels,diamond,diamonds"), place: "floor", states: ["on"], state: "on", icon: "💎" },
  porthole: { aliases: A("porthole,portholes,hatch,hatches,submarine,submarines,sub,subs,aquarium,underwater,ocean,sea"), place: "floor", states: ["on", "covered"], state: "on", icon: "🌊" },
  // home
  chair: { aliases: A("chair,chairs,seat,seats,stool,stools,armchair,armchairs,throne,thrones,bench,benches,cushion,cushions,beanbag"), place: "floor", states: ["chair", "throne", "pile"], state: "chair", icon: "🪑" },
  couch: { aliases: A("couch,couches,sofa,sofas,living room"), place: "floor", states: ["on"], state: "on", sets: ["bedroom"], icon: "🛋️" },
  table: { aliases: A("table,tables,desk,desks,counter,counters,kitchen counter,dinner table,workbench,cubby,cubbies"), place: "floor", states: ["on"], state: "on", icon: "🍽️" },
  fridge: { aliases: A("fridge,fridges,refrigerator,refrigerators,freezer,freezers,icebox,pantry"), place: "floor", states: ["closed", "open"], state: "closed", sets: ["bedroom"], icon: "🧊" },
  stove: { aliases: A("stove,stoves,oven,ovens,cooker,fireplace,hearth,furnace"), place: "floor", states: ["on"], state: "on", sets: ["bedroom"], icon: "🔥" },
  drawer: { aliases: A("drawer,drawers,sock drawer,dresser,dressers,cabinet,cabinets,cupboard,cupboards,shelf,shelves,bookshelf,wardrobe,closet,closets"), place: "floor", states: ["closed", "open"], state: "open", sets: ["bedroom"], icon: "🗄️" },
  laundry: { aliases: A("laundry,clothesline,washing,washing machine,dryer,dryers,hamper,laundry basket,clothes"), place: "floor", states: ["on"], state: "on", icon: "🧺" },
  ladder: { aliases: A("ladder,ladders,rope ladder,stepladder"), place: "floor", states: ["on"], state: "on", icon: "🪜" },
  stairs: { aliases: A("stairs,staircase,stairway,steps,step,stairwell"), place: "floor", states: ["on"], state: "on", icon: "🪜" },
  footprints: { aliases: A("footprint,footprints,footstep,footsteps,track,tracks,trail of prints,pawprint,pawprints,prints"), place: "floor", states: ["on"], state: "on", icon: "👣" },
});

/** Hand props (kit/props.js makeHeld). The first word is the builder's name. */
export const HELD = Object.freeze({
  hat: A("hat,hats,cap,caps,bonnet,beret,top hat,wig"), shoe: A("shoe,shoes,sneaker,sneakers,boot,boots,slipper,slippers,skate,skates,ice skates,sandal,sandals"),
  scarf: A("scarf,scarves,ribbon,bow tie,bowtie,tie,bow,bows,necktie"), helmet: A("helmet,helmets"), mitten: A("mitten,mittens,glove,gloves,mitt"),
  crown: A("crown,crowns,tiara"), handbell: A("handbell"), bucket: A("bucket,buckets,pail,pails"),
  soup: A("soup,soups,bowl,bowls,broth,stew,porridge,cereal,oats,noodles,spaghetti"), pot: A("pot,pots,pan,pans,cauldron,kettle,teakettle,teapot"),
  cheese: A("cheese,cheeses,cheese wheel,butter"), pie: A("pie,pies,tart"), toast: A("toast,slice,slices,waffle,bagel,bagels,biscuit,biscuits,cracker,crackers,crumb,crumbs"),
  pancake: A("pancake,pancakes"), egg: A("egg,eggs"), basket: A("basket,baskets,egg basket,picnic basket"), potato: A("potato,potatoes,lemon,onion,turnip"),
  cookie: A("cookie,cookies"), apple: A("apple,apples,fruit,pear,orange"), cake: A("cake,cakes,cupcake,cupcakes,muffin,muffins"),
  jar: A("jar,jars,jam,tin,tins,can,cans,bottle,bottles,cocoa,honey,pickle,pickles,pepper,salt,spice,spices,water,juice,milk,potion,potions,soda,lemonade,paint,paints,glue,syrup"), spoon: A("spoon,spoons,fork,forks,ladle,knife"),
  pencil: A("pencil,pencils,crayon,crayons,chalk,pen,pens,marker,paintbrush,brush"), flag: A("flag,flags,banner,pennant"),
  ring: A("ring,rings"), star: A("star,stars,gold star,medal,medals,badge,badges,coin,coins,gold,trophy"),
  pebble: A("acorn,acorns,nut,nuts,seed,seeds,marble,marbles,bean,beans,pea,peas"), toaster: A("toaster,toasters,radio,radios"),
  horn: A("horn,horns,bugle,trumpet,megaphone"), kite: A("kite,kites"), teddy: A("teddy,toy,toys,doll,dolls,teddy bear,stuffed animal,plush"),
  rubber_duck: A("rubber duck,rubber ducks"), feather: A("feather,feathers,quill"), shovel: A("shovel,shovels,spade,rake"),
  mop: A("mop,mops,broom,brooms,vacuum,duster"), drum: A("drum,drums"), lightbulb: A("lightbulb,lightbulbs"), magnet: A("magnet,magnets"),
  pillow: A("pillow,pillows,pillowcase"), blanket: A("blanket,blankets,quilt,towel"), net: A("net,nets,fishing net"),
  tape: A("tape,roll of tape,duct tape"), sandwich: A("sandwich,sandwiches,burger,lunch,lunches,meal,meals,dinner,supper,breakfast,snack,snacks,leftovers,pizza,food"),
  plate: A("plate,plates,dish,dishes,tray"), glasses: A("glasses,goggles,sunglasses,spectacles"), backpack: A("backpack,backpacks,schoolbag,satchel"),
  anchor: A("anchor"), wand: A("wand,wands,stick,sticks,cane,staff"), clipboard: A("clipboard,list,lists,rulebook,checklist,homework,drawing,drawings,page,pages,contract,decree"),
  envelope: A("envelope,envelopes,letter,letters,mail,postcard,postcards,invitation"),
  coat: A("coat,coats,raincoat,raincoats,jacket,jackets,sweater,sweaters,hoodie,hoodies,cape,capes,cloak,cloaks,apron,aprons,pajamas,costume,costumes,uniform"),
  skateboard: A("skateboard,skateboards,wheel,wheels,tricycle,tricycles,scooter,scooters,roller skates"),
  sign: A("sign,signs,label,labels,tag,tags,poster,posters,notice,sticker,stickers"),
});

/** Monster looks: the name's head word (or the idea's words) picks one. base = which rig it builds on. */
export const CREATURES = Object.freeze({
  dragon: { base: "furry", words: A("dragon,dragons,wyrm,drake") },
  bird: { base: "tall", words: A("pigeon,pigeons,goose,geese,crow,raven,owl,bird,birds,moth,moths,bat,gull,seagull,hen,rooster") },
  serpent: { base: "tall", words: A("worm,worms,serpent,snake,eel,wyrm,tickler,sea serpent") },
  squid: { base: "tall", words: A("squid,octopus,kraken,tentacle,tentacles") },
  fish: { base: "tall", words: A("anglerfish,fish,whale,shark") },
  goblin: { base: "tall", words: A("goblin,goblins,imp,gremlin,elf,gnome") },
  stump: { base: "furry", words: A("stump,tree,treant,log,hollow king") },
  giant: { base: "tall", words: A("giant,giants,titan") },
  scarecrow: { base: "tall", words: A("scarecrow,scarecrows,bale man") },
  beast: { base: "furry", words: A("goat,moose,bear,hog,pig,cat,wolf,dog,bull,ram,boar,deer,elk") },
  boxy: { base: "furry", words: A("refrigerator,fridge,mailbox,vacuum,eraser,drum,clock,stomach,mural") },
  yeti: { base: "furry", words: A("yeti,bigfoot,sasquatch,snowbeast") },
  troll: { base: "furry", words: A("troll,trolls,ogre,ogres") },
  ghost: { base: "tall", words: A("ghost,phantom,spirit,shade,shadow,hush,echo,fog,mist,wind,gale,dark,night,dim") },
});

/** The creature look for a monster: its name words first (head noun last-to-first), then the idea's description. */
export function creatureFor(nameWords = [], aboutText = "") {
  const words = nameWords.map((w) => String(w).toLowerCase());
  for (const w of [...words].reverse()) for (const [k, c] of Object.entries(CREATURES)) if (c.words.includes(w)) return k;
  const low = String(aboutText).toLowerCase();
  for (const [k, c] of Object.entries(CREATURES)) if (c.words.some((x) => new RegExp(`\\b${x}\\b`).test(low))) return k;
  return null;
}

/** Every scene-object name of this catalog, with its planner fields. */
export function catalogObjects() {
  const out = { item: { aliases: [], place: "floor", states: [...Object.keys(HELD), ...BASE_ITEMS], state: "box", item: true, icon: "📦" } };
  for (const [k, v] of Object.entries(THINGS)) out[k] = { ...v };
  for (const [k, al] of Object.entries(ANIMALS)) out[k] = { aliases: al, place: "floor", states: ["on"], state: "on", animal: true, ...(ANIMAL_SETS[k] ? { sets: ANIMAL_SETS[k] } : {}) };
  for (const [k, al] of Object.entries(CREATURE_OBJECTS)) out[`${k}_creature`] = { aliases: al, place: "floor", states: ["on"], state: "on", creature: k };
  return out;
}

/** The hand props kit/props.js had before the coverage kit (makeHeld's own kinds). */
export const BASE_ITEMS = ["sock", "flashlight", "candle", "book", "phone", "bag", "key", "ball", "box", "bread", "cup", "lantern", "rope", "umbrella", "paper", "whistle", "camera", "tissues", "string"];

/** Every hand-prop word -> its builder. */
export function heldIndex() {
  const m = new Map();
  for (const [k, al] of Object.entries(HELD)) for (const a of al) if (!m.has(a)) m.set(a, k);
  return m;
}
