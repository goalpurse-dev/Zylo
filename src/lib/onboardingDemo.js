// What the owner's walk-through shows instead of the server's answers (lib/onboarding.js: adminPreviewMode). Our own example
// videos and their real scripts, in the order the server would give these survey answers.
import { PREVIEW_TOPIC_KEYS, topicsForGoals } from "../../supabase/functions/_shared/cutaway/freePreview.js";
import { DEMO_NARRATION, FRENCH_DRAIN_NARRATION } from "../components/viral-tools/cutaway-explainer/api/cutawayApi";
import { lastSurveyGoals } from "./onboarding";

const CAR_WASH_NARRATION = "If you spray soapy water on a slab, you have a car wash. But soap and grease run down the storm drain and into the creek. So you slope the pad to a drain, but oily sludge pours through. So you bury a tank under the slot, where sand sinks and oil floats. This is an oil-water separator. A pump then sends the clean water back up to the spray nozzles.";
const TOPICS = {
  landfill: { topic: "Landfill", video: "/cutaway-explainer/demo-landfill-clean.mp4", narration: DEMO_NARRATION },
  french_drain: { topic: "French drain", video: "/cutaway-explainer/example-french-drain-clean.mp4", narration: FRENCH_DRAIN_NARRATION },
  car_wash: { topic: "Car wash", video: "/onboarding/demo/car_wash-preview.mp4", narration: CAR_WASH_NARRATION },
};

export const DEMO_POSTER = "/onboarding/demo/french_drain.jpg";

export function demoPreviewRun(key) {
  const known = TOPICS[key] ? key : "french_drain", t = TOPICS[known];
  return { id: "demo", step: "done", topic: t.topic, finalUrl: t.video, poster: `/onboarding/demo/${known}.jpg`, narration: t.narration, lengthSec: 30 };
}

export function demoStateFor(goals = lastSurveyGoals()) {
  const keys = topicsForGoals(goals, PREVIEW_TOPIC_KEYS.length).filter((k) => TOPICS[k]).slice(0, 3);
  return {
    on: true, plan: "free", preview: null, finish: null, demo: true,
    topics: keys.map((key) => ({ key, topic: TOPICS[key].topic, poster: `/onboarding/demo/${key}.jpg`, clipUrl: `/onboarding/demo/${key}-loop.mp4` })),
  };
}
