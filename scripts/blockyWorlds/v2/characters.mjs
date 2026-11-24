// IN THIS TOWN v2: THE CHARACTER LIBRARY (data). Every person is a spec on ONE base (char_v2.py ZChar): the same body
// build, face system (12 expressions, blinks), finish and checks; a spec picks proportions, hair, outfit, colours.
// "me" is the FIXED main character: the narrator of every story (ours and customers'). Our own design.
//   body: thigh / shin / upper_arm / fore_arm / torso_w / torso_d / torso_h in local units; head = the head's scale
//   height: world units on the town stage (a kid 3.04, an adult 3.5: the measured stage scale)

export const CHARACTERS = {
  me: {
    id: "me", role: "the narrator (main character, every story)", fixed: true,
    height: 3.04, outfit: "hoodie", hair: "swoop", hair_top: 0.7, badge_ok: true,
    body: { thigh: 0.95, shin: 0.8, upper_arm: 0.85, fore_arm: 0.75, torso_w: 1.9, torso_d: 1.0, torso_h: 1.8, head: 1.14 },
    colors: {
      skin: "#F3C9A1", skin_dark: "#E2AC84", eyes: "#1B1410", brows: "#3A2216",
      hair: "#4A2C1C", hair_light: "#9A6440",
      top: "#FF7A1A", top_dark: "#DE5E0A", trim: "#FFF3D6",    // the signature colour: a bold tangerine hoodie
      legs: "#2D4A7A", legs_dark: "#21385E",
      shoe: "#F4F2EC", sole: "#CFC8BC",
    },
  },
  dad: {
    id: "dad", role: "an adult (dad / neighbour / teacher): proves the base", fixed: false,
    height: 3.5, outfit: "shirt", hair: "short", hair_top: 0.3, mustache: true, badge_ok: false,
    body: { thigh: 1.3, shin: 1.12, upper_arm: 1.1, fore_arm: 1.0, torso_w: 2.1, torso_d: 1.1, torso_h: 2.4, head: 0.92 },
    colors: {
      skin: "#C68642", skin_dark: "#A86C32", eyes: "#1B1410", brows: "#1E1A18",
      hair: "#1E1A18", hair_light: "#4E443C",
      top: "#2FA37A", top_dark: "#23805F", trim: "#F2F2EE",
      legs: "#B59B72", legs_dark: "#8F7A58",
      shoe: "#5A3A24", sole: "#2A2A2A",
    },
  },
};
export const EXPRESSIONS = ["neutral", "happy", "big_smile", "worried", "scared", "terrified", "sad", "crying", "angry", "sleepy", "smug", "thinking"];
export const POSES = ["stand", "walk", "run", "sit", "crouch", "point", "hold_up", "look_back"];
