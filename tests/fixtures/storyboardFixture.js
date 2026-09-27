const entities = [
  { id: "person", name: "The mission specialist", category: "CHARACTER", importance: "HERO" },
  { id: "habitat", name: "Habitat interior", category: "LOCATION", importance: "RECURRING" },
  { id: "greenhouse", name: "Greenhouse", category: "LOCATION", importance: "RECURRING" },
  { id: "tablet", name: "Status tablet", category: "IMPORTANT_OBJECT", importance: "RECURRING" },
  { id: "rover", name: "Survey rover", category: "VEHICLE_MACHINE", importance: "RECURRING" },
  { id: "water", name: "Water recycling", category: "DIAGRAM_SUBJECT", importance: "RECURRING" },
];
const descriptions = ["Morning lights reveal the sleeping module, with the specialist framed against the habitat's curved walls.", "A close view of the tablet shows the habitat's overnight energy budget.", "A simple flow diagram follows water through the recycling loop.", "The specialist returns to the same habitat workstation to review the day's tasks.", "Inside the greenhouse, the specialist checks a row of leafy crops.", "A map connects the habitat, greenhouse and rover route.", "A detail of gloved hands inspecting an irrigation valve.", "The greenhouse is shown from the same camera position as the lights dim."];
export const fixtureScript = {
  chapters: [{ chapterId: "morning", title: "Waking the Sol" }, { chapterId: "food", title: "A Living System" }],
  narrationSegments: descriptions.map((_, i) => ({ id: `segment-${i}`, text: ["The habitat wakes before its crew.", "Power is measured against the work ahead.", "Almost every drop begins another journey.", "The day's routine depends on systems working together.", "Plants turn careful tending into tomorrow's food.", "Each part of the settlement is connected.", "Small inspections prevent larger problems.", "Another cycle ends inside the greenhouse."][i] })),
};
export const fixtureStoryboard = {
  id: "fixture-storyboard", version: 1, status: "ready", stage: "finalizing", script_version_id: "fixture-script", visual_mode: "HYBRID", entity_registry: entities,
  visual_plan: { entityRegistry: entities, continuityGroups: [], visualBeats: descriptions.map((text,i) => ({ id: `beat-${i}`, chapterId: i < 4 ? "morning" : "food", sequenceIndex:i, narrationSegmentIds:[`segment-${i}`], estimatedStartSeconds:i*10, estimatedEndSeconds:(i+1)*10, informationToCommunicate:text, shotSize: i===1 ? "CLOSE" : i===6 ? "DETAIL" : "WIDE", visualType:i===2 ? "DIAGRAM" : i===5 ? "MAP" : i===6 ? "OBJECT_DETAIL" : "STORY_ILLUSTRATION", shotStrategy:i===3 || i===7 ? "REUSE_WITH_DELTA" : i===2 ? "DIAGRAM" : i===5 ? "MAP" : i===6 ? "DETAIL" : "NEW_SETUP", renderMethod:"GENERATE", locationId:i<4?"habitat":"greenhouse", baseSetupKey:i<4?"habitat-angle":"greenhouse-angle", continuityGroupId:null, primaryEntityIds:["person"], supportingEntityIds:["tablet"], factualVisualConstraints:[{description:"Keep the habitat sealed from the outside atmosphere.",factIds:["pressure"]}], forbiddenElements:["open exterior window"], revealConstraints:[], deltaInstruction:null })) },
};
