// M2: the kit verbs a planner's beat list may use, per part kind, and their default timing on the word that triggers
// them (the account's measured timing, ANIMATION_STUDY.md: a part appears on the word that names it; pops 0.4 s
// with overshoot; grow-alongs and fills about 1 s; wipes 0.6 s; a light dip 0.4 s).
// A beat: { s: role, do: [{ p: partId, v: verb, w?: word (default: the sentence start), n?, o?, d?, amp?, ch? (panels) }],
//   shot?: { focus: [partIds] | "home", view?, width?, zone?, scale? (home only), at? }, shots?: [more shots] }
// expandBeats(layout) -> cues in the layout cue format. `d` stretches a verb's main ramp; `amp` scales it.

// [channel, a (s after the word), b (s after the word) | null for a step, amp, easing, { d: true if d stretches b }]
const R = (c, a, b, amp = 1, e = "lin", stretch = true) => ({ c, a, b, amp, e, stretch });
const POP = { show: [R("pop", -0.1, 0.3, 1, "back")] };
const ONOFF = (c = "on") => ({ show: [R(c, -0.2, 0.1)], hide: [R(c, -0.25, 0.05, -1)] });

export const VERBS = {
  dig: { dig: [R("dig", 0.02, 1.0)], refill: [R("refill", 0, 0.8)] },
  panels: {}, // channels are its own panel names: { v: "grow", ch: "linerFloor" }
  box: {},
  bags: { drop: [R("drop", 0.2, null, 1, "step")], lift: [R("lift", 0.02, 0.35, 2.6, "out")], lower: [R("lift", 0.8, 1.2, -2.6, "in2")] },
  dumpTruck: { arrive: [R("z", 0, 1.0, 27.4, "out")], tip: [R("tip", 0.02, 0.45, 0.75, "inOut"), R("load", 0.25, null, -1, "step")], untip: [R("tip", -0.1, 0.5, -0.75, "inOut")], leave: [R("z", 0.6, 2.8, -36, "inOut")] },
  pipeRun: { grow: [R("grow", -0.05, 1.0, 1, "inOut")] },
  pipeRunFlow: ONOFF(),
  tank: POP, riser: { grow: [R("grow", -0.05, 0.9, 1, "inOut")] }, boxPop: POP, flare: POP, machine: POP, youngTrees: { show: [R("pop", -0.25, 0.2, 1, "back")] },
  bubbles: ONOFF(),
  fence: { show: [R("pop", -0.1, 0.2, 1, "back"), R("rails", 0.45, null, 1, "step")] },
  sheet: { show: [R("up", -0.1, 0.6, 1, "out"), R("pop", -0.1, 0.35, 1, "back")], hide: [R("down", -0.1, 0.4, 1, "in2")] },
  book: { show: [R("up", -0.05, null, 1, "step")], hide: [R("down", 0, null, 1, "step")] },
  flag: { show: [R("show", -0.1, null, 1, "step")], cross: [R("cross", 0, null, 1, "step")], hide: [R("gone", -0.05, null, 1, "step")] },
  shrubs: { show: [R("start", -0.05, null, 1, "step")] },
  sign: {}, // the compiler adds its pop at signPop
  crack: { grow: [R("grow", -0.05, 0.35, 1, "out")] },
  drops: { fall: [R("fall", -0.1, 0.35)], hide: [R("gone", -0.1, 0.3)] },
  water: { trickle: [R("flood", 0, 2.0, 0.22)], flood: [R("flood", -0.05, 0.45, 0.78, "out")], hide: [R("gone", 0.3, null, 1, "step")] },
  gravel: { fill: [R("fill", 0.1, 0.8), R("pour", 0, 0.75)], lift: [R("lift", 0.02, 0.36, 2.6, "out")], lower: [R("lift", -0.15, 0.22, -2.6, "in2"), R("squash", 0.22, 0.48, 0.04, "bump", false)], drain: [R("drain", 0.2, 2.9, 1, "inOut")] },
  soakPit: { grow: [R("grow", 0.25, 0.6, 1, "out")], wet: [R("wetY", -0.1, 0.9, 2.25, "out"), R("wetOn", -0.1, null, 1, "step")], dry: [R("wetY", 0, 2.5, -1.35)] },
  wipe: { grow: [R("grow", 0.05, 0.55, 1, "out")] },
  wrap: { show: [R("start", 0.05, null, 1, "step")] },
  pipe: { grow: [R("grow", -0.1, 0.7)] },
  pipeFlow: ONOFF(),
  puddles: { rise: [R("rise", 0, 2.3, 1, "out")], dry: [R("fall", 0, 2.4, 1, "inOut")] },
  rain: { start: [R("on", 0, 0.4, 1, "out")], stop: [R("on", 0, 1.7, -1)] },
  stream: { start: [R("on", -0.1, 0.25)], stop: [R("on", -0.2, 0.4, -1)] },
  light: { storm: [R("storm", -0.1, 0.5, 1, "inOut")], clear: [R("storm", 0, 2.8, -1, "inOut")], dip: [R("dip", -0.05, 0.35, 1, "bump", false), R("dip", 0.4, 0.8, 1, "bump", false)] },
  lawnWet: { wet: [R("amount", 0.3, 3.0, 0.9)], dry: [R("amount", 0, 9.0, -0.9)] },
  soilLeak: {
    seep1: [R("y1", 0, 1.53, -5.3, "out"), R("a1", 0, null, 0.9, "step")], seep2: [R("y2", 0, 0.84, -3.6, "out"), R("a2", 0, null, 0.85, "step")],
    murk: [R("murk", -0.1, 99.9, 900, "lin", false), R("murkA", -0.1, null, 0.9, "step")],
    clear1: [R("a1", 0.05, 0.94, -0.9), R("murkA", 0.05, 0.94, -0.9)], clear2: [R("a2", 0, 0.75, -0.85)],
  },
  wetBand: { wet: [R("amount", -0.4, 1.6, 0.75)], dry: [R("amount", 0, 3.9, -0.75)] },
  soak: { show: [R("on", 0.1, 0.5), R("front", 0.2, 3.7, -4.6, "out")], hide: [R("on", 0, 5.2, -1)] },
  arrows: ONOFF(), outline: { show: [R("on", -0.175, 0.075)], hide: [R("on", 0.025, 0.275, -1)] }, seepFlow: ONOFF(),
};

/** the cues for one beat action. at: the anchor of its word (or its sentence start) */
export function verbCues(part, act, at) {
  const table = VERBS[part.kind] ?? {};
  let list = table[act.v];
  if (!list && part.kind === "panels") list = act.v === "grow" ? [R(act.ch, 0.02, 0.45, 1, "out")] : act.v === "pop" ? [R(act.ch, 0, 0.3, 1, "back")] : null;
  if (!list) throw new Error(`${part.kind} ${part.id} has no verb ${act.v}`);
  const o = Number(act.o ?? 0), first = list[0];
  return list.map((r) => {
    const a = { ...at, o: +((at.o ?? 0) + o + r.a).toFixed(4) };
    const cue = { p: part.id, c: r.c, a, amp: r.amp * (act.amp ?? 1), e: r.e };
    if (r.b != null) {
      const k = act.d != null && first.b != null ? Number(act.d) / (first.b - first.a) : 1, len = r.b - r.a, scaled = r.stretch ? len * k : len;
      cue.b = { ...at, o: +((at.o ?? 0) + o + r.a + scaled).toFixed(4) };
    }
    return cue;
  });
}

/** a layout's beats -> cues (added to its own cues) and shots for the camera director */
export function expandBeats(layout) {
  const parts = new Map(layout.parts.map((p) => [p.id, p]));
  const cues = [], shots = [];
  for (const beat of layout.beats ?? []) {
    for (const act of beat.do ?? []) {
      const part = parts.get(act.p);
      if (!part) throw new Error(`beat ${beat.s}: no part ${act.p}`);
      const at = act.w ? { s: beat.s, w: act.w, ...(act.n ? { n: act.n } : {}) } : act.at ?? { s: beat.s };
      cues.push(...verbCues(part, act, at));
    }
    for (const shot of [beat.shot, ...(beat.shots ?? [])].filter(Boolean)) shots.push({ ...shot, at: shot.at ?? { s: beat.s } });
  }
  return { cues, shots };
}
