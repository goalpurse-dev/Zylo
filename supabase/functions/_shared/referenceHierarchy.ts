// Episode-level visual casting. This sits between entity extraction and
// reference rendering so the board represents the story's visual spine,
// rather than treating every recurring noun as equally important.
// deno-lint-ignore-file no-explicit-any

export type ReferenceBudget = {
  characterSheets: number; locationSheets: number; objectSheets: number;
  styleAnchors: number; diagramStyleSheets: number; maxAssets: number;
};

const STOP = new Set(["a","an","and","are","as","at","became","become","did","do","does","for","from","how","if","in","into","is","it","of","on","or","really","the","to","was","what","when","where","who","why","with","you","your","tomorrow"]);
const TOOL_WORDS = /\b(tool|instrument|sonar|radiocarbon|microscope|sensor|scanner|dating|evidence|probe|meter|tablet)\b/i;
const LOCATION_WORDS = /\b(city|civilization|country|empire|habitat|island|kingdom|location|mars|place|planet|region|rome|settlement|world|atlantis)\b/i;
const PROCESS_WORDS = /\b(flow|how .+ works|pipeline|process|system|cycle|mechanism)\b/i;
const HYPOTHETICAL_WORDS = /\b(could|future|hypothetical|if|imagined|might|reconstruct|reconstructed|speculative|what if)\b/i;
const COMPARISON_WORDS = /\b(compare|comparison|versus|vs\.?|unlike|alternative)\b/i;

const words = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
const uniq = <T>(items: T[]) => [...new Set(items)];

function topicOverlap(topic: string, name: string) {
  const topicWords = new Set(words(topic));
  return uniq(words(name)).filter((word) => topicWords.has(word)).length;
}

function inferCoreLabel(topic: string) {
  const cleaned = String(topic ?? "").replace(/[?!.,:;]+$/g, "").trim();
  const patterns = [
    /what (?:really )?happened to\s+(.+)/i,
    /what if\s+(.+)/i,
    /(?:mystery|rise|fall|story|history) of\s+(.+)/i,
    /^how\s+(.+?)(?:\s+works)?$/i,
  ];
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/^(?:a|an|the)\s+/i, "");
  }
  return cleaned || "Episode visual core";
}

function inferSyntheticCore(centralText: string, label: string, viewerStory: boolean) {
  // Strategy copy often says "you will discover" even when the episode's
  // visual subject is a place or mechanism. Only title/topic wording may
  // elect a viewer proxy; a viewer-facing promise must never steal CORE.
  if (viewerStory || /\bday in the life\b/i.test(label)) return { id: "__episode_hero__", name: viewerStory ? "Viewer protagonist" : "Episode protagonist", category: "CHARACTER", importance: "HERO", referenceNeeded: true, referencePriority: "high", synthetic: true };
  // A mechanism/system still needs its own reusable visual identity. It is
  // intentionally an IMPORTANT_OBJECT here rather than DIAGRAM_SUBJECT:
  // diagram subjects are represented by the shared diagram-language sheet,
  // while the episode's actual central mechanism must remain a first-class
  // CORE reference.
  const category = PROCESS_WORDS.test(centralText) ? "IMPORTANT_OBJECT" : LOCATION_WORDS.test(`${centralText} ${label}`) ? "LOCATION" : "IMPORTANT_OBJECT";
  return { id: "__episode_hero__", name: `${label} visual identity`, category, importance: "HERO", referenceNeeded: true, referencePriority: "high", synthetic: true };
}

function occurrenceStats(entity: any, beats: any[]) {
  let primary = 0, supporting = 0, location = 0, seconds = 0;
  const chapters = new Set<string>();
  const sourceBeatIds = new Set<string>();
  const sourceSequenceIds = new Set<string>();
  let comparisonHits = 0;
  for (const beat of beats ?? []) {
    const primaryIds = beat.primaryEntityIds ?? [];
    const supportIds = beat.supportingEntityIds ?? [];
    const present = primaryIds.includes(entity.id) || supportIds.includes(entity.id) || beat.locationId === entity.id;
    if (!present) continue;
    if (beat.id) sourceBeatIds.add(String(beat.id));
    if (beat.sequenceId) sourceSequenceIds.add(String(beat.sequenceId));
    if (primaryIds.includes(entity.id)) primary += 1;
    if (supportIds.includes(entity.id)) supporting += 1;
    if (beat.locationId === entity.id) location += 1;
    if (beat.chapterId) chapters.add(beat.chapterId);
    const start = Number(beat.estimatedStartSeconds ?? 0), end = Number(beat.estimatedEndSeconds ?? start);
    seconds += Math.max(0, end - start);
    if (COMPARISON_WORDS.test(`${beat.informationToCommunicate ?? ""} ${beat.shotPurpose ?? ""}`)) comparisonHits += 1;
  }
  return { primary, supporting, location, reuse: primary + supporting + location, seconds, chapters: chapters.size, comparisonHits, sourceBeatIds: [...sourceBeatIds], sourceSequenceIds: [...sourceSequenceIds] };
}

function roleFor(entity: any, stats: any, core: boolean) {
  if (core) {
    if (entity.category === "CHARACTER") return "protagonist";
    if (entity.category === "LOCATION") return "main_world_anchor";
    if (entity.category === "DIAGRAM_SUBJECT") return "main_concept";
    return "main_concept";
  }
  if (entity.category === "CHARACTER") return "recurring_character";
  if (entity.category === "LOCATION") return "recurring_location";
  if (entity.category === "DIAGRAM_SUBJECT") return "diagram_subject";
  if (TOOL_WORDS.test(entity.name ?? "") || (stats.primary === 0 && stats.supporting > 0)) return "tool_instrument";
  if (stats.comparisonHits > 0) return "comparison_subject";
  return "recurring_object";
}

function formatFor(entity: any, tier: string) {
  if (entity.category === "CHARACTER") return "character_board";
  if (entity.category === "LOCATION") return tier === "CORE" || tier === "MAJOR" ? "location_board" : "single_reference";
  if (entity.category === "DIAGRAM_SUBJECT") return "diagram_board";
  if (entity.category === "IMPORTANT_OBJECT" || entity.category === "VEHICLE_MACHINE") return tier === "CORE" || tier === "MAJOR" ? "object_board" : "single_reference";
  return "single_reference";
}

export function analyzeReferenceHierarchy(args: { topic: string; title?: string; narrativeStrategy?: any; entities: any[]; continuityGroups?: any[]; visualBeats?: any[]; budget: ReferenceBudget }) {
  const beats = args.visualBeats ?? [];
  const raw = [...(args.entities ?? [])];
  const strategy = args.narrativeStrategy ?? {};
  const centralLabel = inferCoreLabel(args.title || args.topic);
  const centralText = [args.title, args.topic, strategy.centralThesis, strategy.viewerQuestion, strategy.viewerPromise, strategy.primaryNarrativeMode].filter(Boolean).join(" ");
  const viewerStory = /\b(you|your)\b/i.test(`${args.title ?? ""} ${args.topic}`);
  const viewerHero = viewerStory
    ? raw.find((e) => e.category === "CHARACTER" && /\b(you|viewer|protagonist|avatar|lead)\b/i.test(e.name ?? ""))
    : null;
  const namedHeroCharacter = raw.find((e) => e.category === "CHARACTER"
    && !PROCESS_WORDS.test(centralText)
    && String(e.importance).toUpperCase() === "HERO"
    && topicOverlap(args.title || args.topic, e.name ?? "") > 0);
  const semanticCoreCandidates = raw
    .map((entity) => ({ entity, overlap: topicOverlap(centralLabel, entity.name ?? "") }))
    .filter((candidate) => candidate.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap
      || Number(String(b.entity.importance).toUpperCase() === "HERO") - Number(String(a.entity.importance).toUpperCase() === "HERO")
      || Number(b.entity.category === "CHARACTER") - Number(a.entity.category === "CHARACTER")
      || String(a.entity.id).localeCompare(String(b.entity.id)));
  let designatedCoreId = viewerHero?.id ?? namedHeroCharacter?.id ?? semanticCoreCandidates[0]?.entity?.id ?? null;
  if (!designatedCoreId) {
    const syntheticCore = inferSyntheticCore(centralText, centralLabel, viewerStory);
    raw.push(syntheticCore);
    designatedCoreId = syntheticCore.id;
  }

  const continuityEntityIds = new Set((args.continuityGroups ?? []).flatMap((g: any) => [g.locationId, ...(g.entityIds ?? [])]).filter(Boolean));
  const scored = raw.map((entity) => {
    const stats = occurrenceStats(entity, beats);
    const overlap = topicOverlap(centralText, entity.name ?? "");
    const narrativeOverlap = topicOverlap(centralLabel, entity.name ?? "");
    const viewerMatch = viewerStory && entity.category === "CHARACTER" && /\b(you|viewer|protagonist|avatar|lead)\b/i.test(entity.name ?? "");
    const coreSignal = entity.id === designatedCoreId;
    const toolOnly = TOOL_WORDS.test(entity.name ?? "") || ((entity.category === "IMPORTANT_OBJECT" || entity.category === "VEHICLE_MACHINE") && stats.primary === 0 && stats.supporting > 0);
    const comparisonOnly = stats.comparisonHits > 0 && stats.primary === 0;
    const importanceBase = ({ HERO: 30, RECURRING: 16, INCIDENTAL: 3 } as Record<string, number>)[String(entity.importance ?? "").toUpperCase()] ?? 0;
    const priorityBase = ({ high: 14, medium: 7, low: 2 } as Record<string, number>)[String(entity.referencePriority ?? "").toLowerCase()] ?? 0;
    const score = Math.max(0, Math.min(100, importanceBase + priorityBase + Math.min(22, stats.primary * 3) + Math.min(10, stats.supporting) + Math.min(14, stats.location * 3) + Math.min(12, stats.chapters * 3) + Math.min(15, overlap * 5) + Math.min(24, narrativeOverlap * 12) + (continuityEntityIds.has(entity.id) ? 7 : 0) + (coreSignal ? 40 : 0) - (toolOnly ? 16 : 0) - (comparisonOnly ? 12 : 0)));
    return { entity, stats, overlap, narrativeOverlap, score, coreSignal, toolOnly, comparisonOnly };
  }).sort((a, b) => b.score - a.score || String(a.entity.id).localeCompare(String(b.entity.id)));

  const core = scored.find((item) => item.entity.id === designatedCoreId) ?? scored[0];
  const enriched = scored.map((item, index) => {
    const isCore = item === core;
    const tier = isCore ? "CORE" : String(item.entity.importance).toUpperCase() === "HERO" ? "HERO" : item.score >= 55 ? "MAJOR" : item.score >= 25 || item.stats.reuse >= 2 ? "SUPPORTING" : "OPTIONAL";
    const role = roleFor(item.entity, item.stats, isCore);
    return {
      ...item.entity,
      subjectRole: role,
      importanceTier: tier,
      importanceScore: item.score,
      expectedReuseCount: item.stats.reuse,
      expectedSceneUsage: item.stats.reuse,
      estimatedSceneCoverage: beats.length ? Number((item.stats.reuse / beats.length).toFixed(4)) : 0,
      sourceBeatIds: item.stats.sourceBeatIds,
      sourceSequenceIds: item.stats.sourceSequenceIds,
      chapterCoverage: item.stats.chapters,
      screenTimeEstimate: Number(item.stats.seconds.toFixed(1)),
      identitySensitivity: item.entity.category === "CHARACTER" || isCore ? "high" : item.score >= 55 ? "medium" : "low",
      continuityImportance: Math.round(item.score),
      storyImportance: isCore ? 100 : Math.round(Math.min(100, item.score + item.narrativeOverlap * 8)),
      visualIdentityImportance: isCore || item.entity.category === "CHARACTER" ? "high" : item.score >= 55 ? "medium" : "low",
      referenceCostEstimate: 0.028,
      referenceFormat: formatFor(item.entity, tier),
      requiredForCompletion: tier !== "OPTIONAL",
      isCoreIdentity: isCore,
      isComparisonOnly: item.comparisonOnly,
      isToolOnly: item.toolOnly,
      isHypotheticalReconstruction: HYPOTHETICAL_WORDS.test(args.topic) || Boolean(item.entity.synthetic && item.entity.category === "LOCATION"),
      uiPriority: Math.max(1, 100 - index * 5),
      selectionReason: isCore ? "Episode visual spine" : `${tier.toLowerCase()} continuity value; expected in ${item.stats.reuse} beat(s)`,
    };
  });

  const diagramNeeded = enriched.some((e) => e.category === "DIAGRAM_SUBJECT" && (e.referenceNeeded || e.isCoreIdentity || e.expectedReuseCount > 0));
  const reserved = args.budget.styleAnchors + (diagramNeeded ? args.budget.diagramStyleSheets : 0);
  const caps: Record<string, number> = { CHARACTER: args.budget.characterSheets, LOCATION: args.budget.locationSheets, SUPPORT: args.budget.objectSheets };
  const used = { CHARACTER: 0, LOCATION: 0, SUPPORT: 0 };
  const selected: any[] = [], excluded: any[] = [];
  for (const candidate of enriched) {
    if (candidate.category === "DIAGRAM_SUBJECT") {
      excluded.push({ ...candidate, exclusionReason: "Represented by the shared diagram style board" });
      continue;
    }
    const bucket = candidate.category === "CHARACTER" ? "CHARACTER" : candidate.category === "LOCATION" ? "LOCATION" : "SUPPORT";
    const budgetRoom = selected.length < Math.max(0, args.budget.maxAssets - reserved) && used[bucket] < caps[bucket];
    // Storyboard repetition is evidence for priority, never permission to
    // override the entity registry's explicit referenceNeeded=false. That
    // flag is how generic headlines, one-off comparison examples and
    // disposable instruments avoid becoming expensive canonical assets
    // merely because a storyboard template repeats them many times.
    const valuable = candidate.isCoreIdentity
      || candidate.referenceNeeded && candidate.importanceTier !== "OPTIONAL"
      || continuityEntityIds.has(candidate.id) && candidate.importanceTier !== "OPTIONAL";
    if (budgetRoom && valuable) {
      selected.push(candidate); used[bucket] += 1;
    } else {
      excluded.push({ ...candidate, exclusionReason: !valuable ? "Low visual continuity value" : `Reference budget exhausted for ${bucket.toLowerCase()} subjects` });
    }
  }

  const summary = (items: any[]) => items.map((e) => ({ subjectId: e.id, displayName: e.name, subjectRole: e.subjectRole, importanceTier: e.importanceTier, importanceScore: e.importanceScore, expectedReuseCount: e.expectedReuseCount, expectedSceneUsage: e.expectedSceneUsage, estimatedSceneCoverage: e.estimatedSceneCoverage, sourceBeatIds: e.sourceBeatIds, sourceSequenceIds: e.sourceSequenceIds, identitySensitivity: e.identitySensitivity, continuityImportance: e.continuityImportance, storyImportance: e.storyImportance, visualIdentityImportance: e.visualIdentityImportance, referenceCostEstimate: e.referenceCostEstimate, referenceFormat: e.referenceFormat, requiredForCompletion: e.requiredForCompletion, isCoreIdentity: e.isCoreIdentity, isComparisonOnly: e.isComparisonOnly, isToolOnly: e.isToolOnly, isHypotheticalReconstruction: e.isHypotheticalReconstruction, uiPriority: e.uiPriority, selectionReason: e.selectionReason, ...(e.exclusionReason ? { exclusionReason: e.exclusionReason } : {}) }));
  return {
    selectedEntities: selected,
    excludedEntities: excluded,
    diagramStyleNeeded: diagramNeeded,
    heroSubjects: summary(enriched.filter((e) => e.importanceTier === "CORE")),
    majorRecurringSubjects: summary(enriched.filter((e) => e.importanceTier === "MAJOR")),
    secondarySubjects: summary(enriched.filter((e) => e.importanceTier === "SUPPORTING")),
    optionalSubjects: summary(enriched.filter((e) => e.importanceTier === "OPTIONAL")),
    selectedReferences: summary(selected),
    excludedReferences: summary(excluded),
  };
}
