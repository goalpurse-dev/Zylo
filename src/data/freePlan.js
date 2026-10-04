// What a free Zyvo account gets, said the same way everywhere: Home, the
// "Is Zyvo free" post and its JSON-LD. It matches the Free block on /pricing
// (5 AI images every 30 days; making videos needs a plan).
//
// Plain JS (no JSX, no import.meta, no JSON imports): Node build scripts
// import this file too.
//
// Rule: no page may suggest a video template (AI Fruit Story and the others)
// is free. Only the image generator has free generations.

export const FREE_PLAN_LINE = "Start free with 5 image generations. Video tools like AI Fruit Story need a paid plan.";

// FAQ on /blog/is-zyvo-free (the post and its JSON-LD).
export const IS_ZYVO_FREE_FAQ = [
  {
    q: "Is Zyvo actually free?",
    a: "Zyvo is free to start. A free account gets 5 image generations in the AI image generator every 30 days, with no card needed. Video tools like AI Fruit Story need a paid plan.",
  },
  {
    q: "What can I do without paying?",
    a: "Generate 5 images every 30 days in the AI image generator and look around every tool to see how it works. Making videos needs a paid plan.",
  },
  {
    q: "How does the credit system work?",
    a: "Paid plans add credits to your balance every month. Every generation uses credits based on the tool, the length or number of scenes and the quality you choose, and you see the cost before you start.",
  },
  {
    q: "What happens if I don't have enough credits?",
    a: "The generator lets you know before starting if your balance isn't enough to complete the generation you've configured — you won't be charged partway through and left with an incomplete result.",
  },
  {
    q: "Do unused credits expire?",
    a: "Monthly credits add to your balance; they don't reset to zero. One-time credit packs never expire.",
  },
];
