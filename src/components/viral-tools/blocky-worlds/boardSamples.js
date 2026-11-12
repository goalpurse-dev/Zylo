// Blocky Worlds: the signed-out sample cards in the board-only launch mode (2026-11-12). Only 2 of the 6 example ideas
// (examples.js) fit the board kit (the others need a water tower, lava, a storm, a clock tower, floating), so these are
// six judged LIVE library ideas that fit it (boardFit.js kitFit, no planted-object swap needed), one or two per mood.
// Copied from the library fixture (src/components/viral-tools/blocky-worlds/dev/libraryFixture.json; libraryId kept).
// tests/blockyWorldsBoardSwap.test.mjs keeps every card fitting the kit.
export const BOARD_SAMPLE_IDEAS = Object.freeze([
  {
    "libraryId": "9d9c2e56-9d11-4b6e-af2a-eaeb55041f6d",
    "opener": "In this town, everyone has their own personal rain cloud that follows them around, except me.",
    "title": "No Cloud Kid",
    "premise": "In our house everyone has a personal rain cloud that follows them room to room, and I'm the only one with nothing but a dry, sad sock of a sky.",
    "price": "Cloud-owners must stay damp, or their cloud floats off and sulks.",
    "examples": [
      "Dad's cloud rains on his cereal every single morning.",
      "Grandma's cloud only drizzles when she's telling the same story.",
      "My sister's cloud thunders every time she loses a board game."
    ],
    "narrator": "A kid with no cloud, who is always the one stuck holding everyone's umbrellas.",
    "prop": "A big yellow umbrella",
    "twist": "A dry spell wilts the houseplants and nothing else works, but my cloudless dry self is the only one who can carry the soggy family's clouds outside to water the garden. Dry was the point.",
    "teaser": "Everyone's cloud made a mess, but a dry kid saved dinner.",
    "closer": "Everyone here has a cloud. But now, when the kitchen floods, they call me.",
    "formula": "F1",
    "twistType": "T3",
    "mood": "funny",
    "setting": "house (bedroom, kitchen, living room)"
  },
  {
    "libraryId": "eba10ab4-2634-449c-8316-8ebdd6791e85",
    "opener": "In this town, every kid leaves one sock on the porch every night for the Lamp Walker.",
    "title": "The Lamp Walker's Sock",
    "premise": "A street gives a sock a night to a tall glowing walker, and the quietest kid on the block has only a hole-riddled sock to give.",
    "price": "Last winter, the Hendersons forgot. Their porch light went dark and stayed dark for a week.",
    "examples": [
      "Mr. Olsen leaves silk socks, folded in neat triangles.",
      "The twins leave one each so nobody argues.",
      "Last winter the Hendersons forgot. Their porch stayed dark all week."
    ],
    "narrator": "Wren, the smallest kid on the street, mocked for her patched, holey socks.",
    "prop": "A sock with a hole in the toe",
    "twist": "The Lamp Walker is a lantern with no feet, and every neat sock slides off. Only Wren's holey sock hooks onto its handle, so it can finally walk and light the street.",
    "teaser": "Everyone's gift was perfect. Only hers was ridiculed.",
    "closer": "Everyone gives the Lamp Walker a perfect sock. Only mine ever stayed on.",
    "formula": "F3",
    "twistType": "T3",
    "mood": "wholesome",
    "setting": "suburb street"
  },
  {
    "libraryId": "a6fb5380-f869-4738-a069-067fc2e00708",
    "opener": "In this town, every night each house leaves its porch light on, and the Dark promises not to come inside.",
    "title": "The Promise of Light",
    "premise": "Every porch light on Maple Street stays on all night for the Dark, and Cleo's bulb is the only one that keeps flickering.",
    "price": "The Hendersons' bulb burned out once. Their house is still there, but nobody is.",
    "examples": [
      "Mr. Gray buys bulbs by the crate and sleeps on his porch.",
      "The Parkers have seventeen lamps for one tiny porch.",
      "The mailman wears a headlamp and a small flag."
    ],
    "narrator": "Cleo, whose family's porch bulb is the one sad bulb that always flickers.",
    "prop": "A box of birthday candles",
    "twist": "The Dark promised not to come inside, so it only takes what's outside. Cleo lights her candles and goes in and shuts the door, and the Dark can't take a single step in.",
    "teaser": "The promise had one small, unspoken gap.",
    "closer": "In this town, we leave the light on for the Dark. Now we keep ourselves inside.",
    "formula": "F3",
    "twistType": "T4",
    "mood": "horror",
    "setting": "suburb street"
  },
  {
    "libraryId": "4a07a08b-acaa-420e-b423-6641da45aa1d",
    "opener": "In this town, everyone in the town square has a clock over their head counting down their bedtime, except me.",
    "title": "No Clock for Me",
    "premise": "Everyone's bedtime clock stops them dead at zero, and Dex, who has no clock, is the only one awake when the Midnight Sweeper arrives.",
    "price": "When a clock hits zero, that person freezes like a statue until morning.",
    "examples": [
      "Mr. Lund froze mid-sneeze next to the fountain.",
      "The mayor froze holding a cake, and the pigeons ate it.",
      "Mrs. Bix froze on a ladder and stayed there all night."
    ],
    "narrator": "Dex, the only kid in the square with no clock over his head.",
    "prop": "A brass alarm bell",
    "twist": "The Midnight Sweeper sweeps up anyone who is frozen at zero. Dex rings the bell, and the Sweeper must obey the rule: anyone who is awake at midnight is not frozen, so it passes by the whole square and sweeps nothing.",
    "teaser": "He can't be frozen. But everyone else can be woken.",
    "closer": "In this town, everyone has a clock. Tonight, mine rang for all of them.",
    "formula": "F1",
    "twistType": "T1",
    "mood": "epic",
    "setting": "town square"
  },
  {
    "libraryId": "13c84251-1e6f-4100-b4d5-82db0c7ec008",
    "opener": "In this town, everyone gets one wish granted the first night they hear the woods whisper their name.",
    "title": "The Whispering Wish",
    "premise": "Every kid at the woods edge gets a wish from the whispering trees, and Moss, who wished for a warm blanket, is the only one still home.",
    "price": "Kids who wished big were gone by morning, with only their shoes left at the treeline.",
    "examples": [
      "Tommy wished to be tall. His shoes are still at the treeline.",
      "Mrs. Park wished for endless cookies. Her kitchen is empty.",
      "Dara wished for a thousand friends. Now the trees stand very close."
    ],
    "narrator": "Moss, who wished for only a small warm blanket, and everyone laughed.",
    "prop": "a warm blanket",
    "twist": "The trees grant wishes word for word, and take the wisher to fit the wish. Moss wished for the blanket to keep everyone warm, and the trees must wrap everyone, so the taken kids come home wrapped in it.",
    "teaser": "The trees always give exactly what you say.",
    "closer": "In this town, everyone gets a wish. Mine was small, so everyone came back.",
    "formula": "F5",
    "twistType": "T4",
    "mood": "horror",
    "setting": "woods edge"
  },
  {
    "libraryId": "ed0a4ca6-3f36-47b5-8f68-a0818151c0a8",
    "opener": "In this town, the louder your socks squeak, the higher your rank, so the Squeakers rule the living room.",
    "title": "Silent Socks",
    "premise": "In a living room ruled by squeaky socks, the narrator wears the quietest pair, which everyone mocks, until a giant vacuum starts hunting for squeaks.",
    "price": "Anyone squeaky enough gets sucked into the vacuum's hallway for the night.",
    "examples": [
      "Lord Dennis squeaks so loudly the cat hides under the couch.",
      "The royal guards polish their socks with olive oil.",
      "Aunt Priya tiptoes just to avoid being promoted."
    ],
    "narrator": "Mo, whose silent socks have never squeaked once and get mocked daily.",
    "prop": "a pair of silent socks",
    "twist": "The vacuum only hunts squeaks, and the Squeakers can't hide. Mo's silent socks are the only way across the carpet unnoticed, so he sneaks to the plug and pulls it, saving everyone.",
    "teaser": "The thing they mocked is the only thing the vacuum can't hear.",
    "closer": "Everyone here ranks by squeak. Now they all beg me for quiet.",
    "formula": "F6",
    "twistType": "T3",
    "mood": "funny",
    "setting": "house (bedroom, kitchen, living room)"
  }
]);
