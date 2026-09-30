// How each fruit head looks, from the character library (scripts/fruit-characters/prompt.mjs FRUITS;
// a test keeps them equal). Used so pictures and the picture check name the exact head
// ("green young coconut", not just "coconut": the check flagged Kai for not being brown).
// Regenerate: node scripts/fruit-characters/exportLooks.mjs

export const FRUIT_LOOKS = Object.freeze({
  "apple": {
    "label": "red apple",
    "skin": "glossy red",
    "top": "a short stem"
  },
  "green apple": {
    "label": "green apple",
    "skin": "glossy green",
    "top": "a short stem"
  },
  "mango": {
    "label": "mango",
    "skin": "golden-orange mango with a red blush",
    "top": null
  },
  "peach": {
    "label": "peach",
    "skin": "deep coral-red peach with a golden-orange blush",
    "top": null
  },
  "strawberry": {
    "label": "strawberry",
    "skin": "strawberry-red",
    "top": "a crown of green leaves"
  },
  "grape": {
    "label": "purple grape-cluster",
    "skin": "deep purple",
    "top": null
  },
  "lemon": {
    "label": "lemon",
    "skin": "bright lemon-yellow",
    "top": null
  },
  "lime": {
    "label": "lime",
    "skin": "bright lime-green",
    "top": null
  },
  "banana": {
    "label": "banana",
    "skin": "yellow banana",
    "top": "a short real banana stem tip"
  },
  "pineapple": {
    "label": "pineapple",
    "skin": "golden-brown pineapple",
    "top": "a crown of green leaves"
  },
  "coconut": {
    "label": "green young coconut",
    "skin": "smooth green young-coconut",
    "top": null
  },
  "orange": {
    "label": "orange",
    "skin": "bright orange peel-textured",
    "top": null
  },
  "kiwi": {
    "label": "kiwi",
    "skin": "fuzzy olive-brown kiwi",
    "top": null
  },
  "watermelon": {
    "label": "watermelon",
    "skin": "green striped watermelon-rind",
    "top": null
  },
  "cherry": {
    "label": "cherry",
    "skin": "deep cherry-red",
    "top": "a short stem"
  },
  "pear": {
    "label": "pear",
    "skin": "yellow-green pear",
    "top": "a short stem"
  },
  "plum": {
    "label": "plum",
    "skin": "deep plum-purple",
    "top": null
  },
  "blueberry": {
    "label": "blueberry",
    "skin": "dusty indigo-blue",
    "top": "a small star-shaped blueberry crown"
  },
  "raspberry": {
    "label": "raspberry",
    "skin": "deep pink-red raspberry",
    "top": null
  },
  "avocado": {
    "label": "avocado",
    "skin": "dark green pebbly avocado",
    "top": null
  },
  "pomegranate": {
    "label": "pomegranate",
    "skin": "deep ruby-red pomegranate",
    "top": "a small real pomegranate calyx crown"
  },
  "fig": {
    "label": "fig",
    "skin": "deep purple-brown fig",
    "top": "a short stem"
  },
  "papaya": {
    "label": "papaya",
    "skin": "green-to-orange papaya",
    "top": null
  },
  "dragon fruit": {
    "label": "dragon fruit",
    "skin": "hot-pink dragon fruit",
    "top": null
  },
  "grapefruit": {
    "label": "grapefruit",
    "skin": "golden-yellow grapefruit with a pink-red blush",
    "top": null
  },
  "apricot": {
    "label": "apricot",
    "skin": "golden-orange apricot",
    "top": null
  },
  "lychee": {
    "label": "lychee",
    "skin": "rose-red lychee",
    "top": null
  },
  "blackberry": {
    "label": "blackberry",
    "skin": "deep glossy purple blackberry",
    "top": null
  },
  "honeydew": {
    "label": "honeydew melon",
    "skin": "pale green honeydew",
    "top": null
  },
  "durian": {
    "label": "durian",
    "skin": "olive-green durian",
    "top": null
  },
  "tomato": {
    "label": "tomato",
    "skin": "glossy tomato-red",
    "top": "a small green star-shaped tomato calyx and stem"
  }
});

/** "a green young coconut head" / "a pineapple head with a crown of green leaves (leaves, not hair)" */
export function headLook(fruit) {
  const f = FRUIT_LOOKS[fruit];
  const label = f?.label ?? fruit;
  const art = /^[aeiou]/i.test(label) ? "an" : "a";
  return f?.top ? `${art} ${label} head with ${f.top} (part of the fruit, not hair)` : `${art} ${label} head`;
}
