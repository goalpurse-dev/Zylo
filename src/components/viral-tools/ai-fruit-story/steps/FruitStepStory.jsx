import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const STORY_PRESETS = [
  {
    id: "cheating",
    label: "Cheating",
    description: "A fruit catches their partner cheating.",
    storyIdea:
      "A fruit finds out their partner is cheating and plans an emotional reveal.",
    conflict: "Cheating betrayal",
    image: "/viral-builder/ai-fruit/presets/cheating.webp",
    guideTitle: "Cheating story format",
    guideText:
      "This is one of the strongest fruit drama formats. The story usually starts with suspicion, then a reveal, then a confrontation or emotional twist.",
    guideBullets: [
      "Hook: fruit notices strange behavior",
      "Middle: secret gets revealed",
      "Twist: confrontation or proof",
      "Ending: betrayal, revenge, or sadness",
    ],
  },
  {
    id: "baby",
    label: "Getting a baby",
    description: "A fruit reveals they are having a baby.",
    storyIdea:
      "A fruit tells their partner they are having a baby, but the reaction is not what they expected.",
    conflict: "Unexpected baby reveal",
    image: "/viral-builder/ai-fruit/presets/baby.webp",
    guideTitle: "Getting a baby format",
    guideText:
      "This format works because it creates instant emotion and curiosity. It often starts with a serious setup and then reveals the baby twist.",
    guideBullets: [
      "Hook: serious conversation setup",
      "Middle: surprise baby reveal",
      "Twist: shocking reaction",
      "Ending: emotional or dramatic outcome",
    ],
  },
  {
    id: "cheats-back",
    label: "Cheats back",
    description: "A betrayed fruit gets dramatic revenge.",
    storyIdea:
      "A fruit gets cheated on, acts heartbroken, then secretly cheats back and shocks everyone.",
    conflict: "Revenge after betrayal",
    image: "/viral-builder/ai-fruit/presets/cheats-back.webp",
    guideTitle: "Cheats back format",
    guideText:
      "This is a revenge-based story format. It keeps retention high because viewers want to see how the betrayed fruit gets even.",
    guideBullets: [
      "Hook: fruit gets hurt",
      "Middle: acts innocent / hides plan",
      "Twist: revenge reveal",
      "Ending: shocked reaction from everyone",
    ],
  },
  {
    id: "secret-twin",
    label: "Secret twin",
    description: "A hidden twin changes the whole story.",
    storyIdea:
      "A fruit discovers their partner has been hiding a secret twin who has been causing all the drama.",
    conflict: "Secret twin reveal",
    image: "/viral-builder/ai-fruit/presets/secret-twin.webp",
    guideTitle: "Secret twin format",
    guideText:
      "This one performs well because it adds a crazy reveal. The twin twist makes people re-think everything they just watched.",
    guideBullets: [
      "Hook: weird confusing behavior",
      "Middle: tension builds",
      "Twist: twin reveal",
      "Ending: everything suddenly makes sense",
    ],
  },
  {
    id: "kicked-out",
    label: "Kicked out",
    description: "A fruit gets kicked out, then returns.",
    storyIdea:
      "A fruit gets kicked out of the house during an argument, then returns with a shocking secret.",
    conflict: "Kicked out and betrayed",
    image: "/viral-builder/ai-fruit/presets/kicked-out.webp",
    guideTitle: "Kicked out format",
    guideText:
      "This story format is good for emotional tension. It starts sad, builds sympathy, and usually ends with a comeback or dramatic reveal.",
    guideBullets: [
      "Hook: argument or betrayal",
      "Middle: fruit gets kicked out",
      "Twist: returns with proof or power",
      "Ending: emotional revenge or closure",
    ],
  },
  {
    id: "custom",
    label: "Custom",
    description: "Write your own fruit story from scratch.",
    storyIdea: "",
    conflict: "",
    image: "/viral-builder/ai-fruit/presets/custom.webp",
    guideTitle: "Custom format",
    guideText:
      "Use this when you already have your own fruit story idea. You’ll be able to write your own story prompt instead of using a preset.",
    guideBullets: [
      "Use your own story angle",
      "Best for unique ideas",
      "Good if none of the presets fit",
      "Unlocks custom prompt input",
    ],
  },
];

const REFERENCE_IMAGE_BASE =
  "https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/reference-images/ai-fruit";

const CHARACTER_OPTIONS = [
  {
    id: "orangemom",
    name: "Orange Mom",
    role: "Emotional main character",
    image: "/viral-builder/ai-fruit/characters/orangemom.png",
    publicRefUrl: `${REFERENCE_IMAGE_BASE}/orangemom.png`,
  },
  {
    id: "orangekid",
    name: "Orange Kid",
    role: "Innocent child character",
    image: "/viral-builder/ai-fruit/characters/orangekid.webp",
    publicRefUrl: `${REFERENCE_IMAGE_BASE}/orangekid.webp`,
  },
  {
    id: "lemonkid",
    name: "Lemon Kid",
    role: "Cute side character",
    image: "/viral-builder/ai-fruit/characters/lemonkid.webp",
    publicRefUrl: `${REFERENCE_IMAGE_BASE}/lemonkid.webp`,
  },
  {
    id: "strawberrymom",
    name: "Strawberry Mom",
    role: "Drama / relationship character",
    image: "/viral-builder/ai-fruit/characters/strawberrymom.png",
    publicRefUrl: `${REFERENCE_IMAGE_BASE}/strawberrymom.png`,
  },
  {
    id: "banana",
    name: "Banana",
    role: "Villain / rival character",
    image: "/viral-builder/ai-fruit/characters/banana.png",
    publicRefUrl: `${REFERENCE_IMAGE_BASE}/banana.png`,
  },
  {
    id: "appleson",
    name: "Apple Son",
    role: "Young supporting character",
    image: "/viral-builder/ai-fruit/characters/appleson.png",
    publicRefUrl: `${REFERENCE_IMAGE_BASE}/appleson.png`,
  },
  {
    id: "hotpeach",
    name: "Hot Peach",
    role: "Popular twist character",
    image: "/viral-builder/ai-fruit/characters/hotpeach.webp",
    publicRefUrl: `${REFERENCE_IMAGE_BASE}/hotpeach.webp`,
  },
  {
    id: "ananasgirl",
    name: "Ananas Girl",
    role: "Stylish supporting character",
    image: "/viral-builder/ai-fruit/characters/ananasgirl.png",
    publicRefUrl: `${REFERENCE_IMAGE_BASE}/ananasgirl.png`,
  },
  {
    id: "bossmango",
    name: "Boss Mango",
    role: "Authority / boss character",
    image: "/viral-builder/ai-fruit/characters/bossmango.png",
    publicRefUrl: `${REFERENCE_IMAGE_BASE}/bossmango.png`,
  },
  {
    id: "brokkoliboss",
    name: "Brokkoli Boss",
    role: "Funny boss / strict character",
    image: "/viral-builder/ai-fruit/characters/brockolliboss.png",
    publicRefUrl: `${REFERENCE_IMAGE_BASE}/brockolliboss.png`,
  },
  {
    id: "gangsterpineapple",
    name: "Gangster Pineapple",
    role: "Crazy villain / gangster character",
    image: "/viral-builder/ai-fruit/characters/gangsterpineapple.png",
    publicRefUrl: `${REFERENCE_IMAGE_BASE}/gangsterpineapple.png`,
  },
];

const CHARACTER_PREVIEW_IDS = ["orangemom", "orangekid", "banana", "hotpeach"];

export default function FruitStepStory({ form, setForm }) {
  const [openGuide, setOpenGuide] = useState(null);
  const [hoveredGuide, setHoveredGuide] = useState(null);
  const [charactersOpen, setCharactersOpen] = useState(false);
  const [draftCharacters, setDraftCharacters] = useState(
    form.selectedCharacters || []
  );
 const [characterSearch, setCharacterSearch] = useState("");
const [characterSearchOpen, setCharacterSearchOpen] = useState(false);
const [characterTab, setCharacterTab] = useState("all");
const [favoriteIds, setFavoriteIds] = useState([]);

  const selectedPreset = form.storyPreset || "cheating";
  const isCustom = selectedPreset === "custom";
  const selectedCharacters = form.selectedCharacters || [];

  const previewCharacters = useMemo(() => {
  return CHARACTER_PREVIEW_IDS.map((id) =>
    CHARACTER_OPTIONS.find((character) => character.id === id)
  ).filter(Boolean);
}, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ai-fruit-favorite-characters");
      if (stored) {
        setFavoriteIds(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load favorite characters", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "ai-fruit-favorite-characters",
        JSON.stringify(favoriteIds)
      );
    } catch (error) {
      console.error("Failed to save favorite characters", error);
    }
  }, [favoriteIds]);

  const activeGuide = useMemo(() => {
    return STORY_PRESETS.find((p) => p.id === openGuide);
  }, [openGuide]);

  const filteredCharacters = useMemo(() => {
    let items = [...CHARACTER_OPTIONS];

    if (characterTab === "favorites") {
      items = items.filter((character) => favoriteIds.includes(character.id));
    }

    if (characterSearch.trim()) {
      const query = characterSearch.toLowerCase().trim();
      items = items.filter(
        (character) =>
          character.name.toLowerCase().includes(query) ||
          character.role.toLowerCase().includes(query)
      );
    }

    return items;
  }, [characterSearch, characterTab, favoriteIds]);

  const handlePresetClick = (preset) => {
    setForm({
      ...form,
      storyPreset: preset.id,
      storyIdea: preset.storyIdea,
      conflict: preset.conflict,
    });
  };

 const openCharacterModal = () => {
  setDraftCharacters(selectedCharacters);
  setCharacterSearch("");
  setCharacterSearchOpen(false);
  setCharacterTab("all");
  setCharactersOpen(true);
};

  const toggleDraftCharacter = (character) => {
    const exists = draftCharacters.some((item) => item.id === character.id);

    if (exists) {
      setDraftCharacters((prev) =>
        prev.filter((item) => item.id !== character.id)
      );
      return;
    }

    if (draftCharacters.length >= 3) return;

    setDraftCharacters((prev) => [...prev, character]);
  };

  const toggleFavoriteCharacter = (characterId) => {
    setFavoriteIds((prev) =>
      prev.includes(characterId)
        ? prev.filter((id) => id !== characterId)
        : [...prev, characterId]
    );
  };

  const confirmCharacters = () => {
    if (draftCharacters.length < 2) return;

    const selectedWithImages = draftCharacters.map((character) => ({
      ...character,
      publicRefUrl: character.publicRefUrl || character.generationRefUrl || character.referenceUrl || "",
      imageUrl:
        character.imageUrl ||
        character.image ||
        character.src ||
        character.previewUrl ||
        character.url ||
        character.thumbnail ||
        character.assetUrl ||
        "",
    }));

    console.log("[AI FRUIT selected characters]", selectedWithImages.map((c) => ({
      id: c.id,
      name: c.name,
      label: c.label,
      publicRefUrl: c.publicRefUrl,
      generationRefUrl: c.generationRefUrl,
      referenceUrl: c.referenceUrl,
      imageUrl: c.imageUrl,
      image: c.image,
      src: c.src,
      previewUrl: c.previewUrl,
      url: c.url,
      full: c,
    })));

    setForm({
      ...form,
      selectedCharacters: selectedWithImages,
      mainFruit: selectedWithImages[0]?.name || form.mainFruit,
      villainFruit: selectedWithImages[1]?.name || form.villainFruit,
    });

    setCharactersOpen(false);
  };

  const removeCharacter = (characterId) => {
    setForm({
      ...form,
      selectedCharacters: selectedCharacters.filter(
        (character) => character.id !== characterId
      ),
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-3 block text-sm font-black text-white">
          Choose a viral story angle
        </label>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {STORY_PRESETS.map((preset, index) => {
            const active = selectedPreset === preset.id;
            const hoverOpen = hoveredGuide === preset.id;

            return (
              <div key={preset.id} className="relative">
                <button
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className={`group relative h-[128px] w-full overflow-hidden rounded-2xl border text-left transition-all duration-200 hover:-translate-y-0.5 sm:h-[152px] ${
                    active
                      ? "border-transparent shadow-[0_0_0_1px_rgba(168,85,247,0.08),0_0_24px_rgba(168,85,247,0.18)]"
                      : "border-white/10 hover:border-white/20"
                  }`}
                >
                  <img
                    src={preset.image}
                    alt={preset.label}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.035]"
                    loading="lazy"
                  />

                  <div className="absolute inset-0 bg-black/12" />
                  <div className="absolute inset-x-0 top-0 h-[58px] bg-gradient-to-b from-black/95 via-black/82 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 h-[74px] bg-gradient-to-t from-black/95 via-black/84 to-transparent" />
                  <div className="absolute inset-y-0 left-0 w-[30%] bg-gradient-to-r from-black/30 to-transparent" />
                  <div className="absolute inset-y-0 right-0 w-[26%] bg-gradient-to-l from-black/28 to-transparent" />

                  {active && <div className="absolute inset-0 bg-purple-500/6" />}

                  {active && (
                    <div className="pointer-events-none absolute inset-0 z-20 rounded-2xl">
                      <div className="absolute left-[1px] right-[1px] top-0 h-[2px] rounded-t-2xl bg-[#A855F7]" />
                      <div className="absolute bottom-0 left-[1px] right-[1px] h-[2px] rounded-b-2xl bg-white" />
                      <div className="absolute bottom-[1px] left-0 top-[1px] w-[2px] bg-gradient-to-b from-[#A855F7] to-white" />
                      <div className="absolute bottom-[1px] right-0 top-[1px] w-[2px] bg-gradient-to-b from-[#A855F7] to-white" />
                    </div>
                  )}

                  <div className="relative z-10 flex h-full flex-col justify-between p-3 sm:p-4">
                    <div className="pr-8 sm:pr-10">
                      <h3 className="line-clamp-1 text-[13px] font-black leading-tight text-white [text-shadow:0_3px_14px_rgba(0,0,0,0.95)] sm:text-[17px]">
                        {preset.label}
                      </h3>
                    </div>

                    <div className="pr-2">
                      <p className="line-clamp-2 text-[11px] leading-snug text-white/95 [text-shadow:0_3px_14px_rgba(0,0,0,0.95)] sm:text-[13px] sm:leading-relaxed">
                        {preset.description}
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenGuide(preset.id);
                  }}
                  onMouseEnter={() => setHoveredGuide(preset.id)}
                  onMouseLeave={() => setHoveredGuide(null)}
                  className="absolute right-2.5 top-2.5 z-[5] flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/60 text-[12px] font-black text-white/95 shadow-lg backdrop-blur-md transition hover:scale-105 hover:bg-black/75 sm:right-3 sm:top-3 sm:h-8 sm:w-8 sm:text-[13px]"
                  aria-label={`Open ${preset.label} guide`}
                >
                  ?
                </button>

                <div
                  className={`pointer-events-none absolute top-11 z-[999] hidden w-[250px] rounded-2xl border border-white/10 bg-[#121416] p-2 shadow-2xl shadow-black/50 transition lg:block ${
                    index % 2 === 0 ? "left-0" : "right-0"
                  } ${
                    hoverOpen
                      ? "translate-y-0 scale-100 opacity-100"
                      : "translate-y-1 scale-[0.98] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden rounded-xl border border-white/10">
                    <img
                      src={preset.image}
                      alt={preset.label}
                      className="aspect-[4/3] w-full object-cover"
                    />
                  </div>

                  <div className="p-2">
                    <div className="text-sm font-black text-white">
                      {preset.guideTitle}
                    </div>

                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-white/60">
                      {preset.guideText}
                    </p>

                    <ul className="mt-2 space-y-1">
                      {preset.guideBullets.slice(0, 3).map((item) => (
                        <li
                          key={item}
                          className="text-[11px] leading-relaxed text-white/70"
                        >
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isCustom && (
        <div className="animate-[fadeUp_0.25s_ease-out_both]">
          <label className="mb-2 block text-sm font-black text-white">
            Describe your custom story
          </label>

          <textarea
            value={form.storyIdea}
            onChange={(e) =>
              setForm({
                ...form,
                storyIdea: e.target.value,
                conflict: e.target.value ? "Custom story conflict" : "",
              })
            }
            placeholder="Example: An orange gets betrayed by his best friend apple, then discovers the banana planned everything..."
            className="min-h-[140px] w-full resize-none rounded-2xl border border-white/10 bg-[#0D0F10] px-4 py-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-purple-400/60"
          />
        </div>
      )}

  

      <div className="rounded-2xl border border-white/10 bg-[#0D0F10] p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-black text-white">
              Choose characters
            </div>
            <p className="mt-1 text-xs text-white/45">
              Select at least 2 characters. Max 3.
            </p>
          </div>

          <button
            type="button"
            onClick={openCharacterModal}
            className="shrink-0 rounded-xl border border-purple-400/30 bg-purple-500/15 px-3 py-2 text-xs font-black text-purple-100 transition hover:bg-purple-500/25"
          >
            Add characters
          </button>
        </div>

        {selectedCharacters.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {selectedCharacters.map((character) => (
              <div
                key={character.id}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
              >
                <div className="aspect-[9/12] overflow-hidden">
                  <img
                    src={character.image}
                    alt={character.name}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3">
                  <div className="line-clamp-1 text-xs font-black text-white">
                    {character.name}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeCharacter(character.id)}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/60 text-sm font-black text-white shadow-lg backdrop-blur-md transition hover:bg-red-500"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
    ) : (
  <button
    type="button"
    onClick={openCharacterModal}
    className="group relative flex h-[145px] w-full items-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 text-left transition hover:border-purple-400/40 hover:bg-purple-500/[0.04] sm:h-[152px]"
  >
    {/* soft glow */}
    <div className="pointer-events-none absolute right-8 top-1/2 h-[80px] w-[140px] -translate-y-1/2 rounded-full bg-purple-500/10 blur-3xl" />

    <div className="relative z-10 flex w-full items-center justify-between gap-4">
      {/* LEFT TEXT */}
      <div className="min-w-0 flex-1">
        <div className="text-[16px] font-black text-white">
          Add characters
        </div>

        <p className="mt-1.5 line-clamp-1 text-sm text-white/50 group-hover:text-white/65 sm:line-clamp-2">
          Pick 2–3 fruit characters for the story.
        </p>

      
      </div>

      {/* RIGHT SMALL FLOATING PREVIEW */}
      <div className="pointer-events-none relative h-[70px] w-[120px] shrink-0 sm:h-[7px] sm:w-[132px]">
        {previewCharacters.map((character, index) => (
          <div
            key={character.id}
            className={`absolute top-1/2 overflow-hidden rounded-[12px] border border-white/10 bg-[#111315] shadow-[0_10px_22px_rgba(0,0,0,0.40)] ${
              index === 0
                ? "left-0 z-40 h-[52px] w-[38px] -translate-y-1/2 rotate-[-9deg]"
                : index === 1
                ? "left-[25px] z-30 h-[58px] w-[42px] -translate-y-1/2 rotate-[-3deg]"
                : index === 2
                ? "left-[52px] z-20 h-[58px] w-[42px] -translate-y-1/2 rotate-[4deg]"
                : "left-[79px] z-10 h-[52px] w-[38px] -translate-y-1/2 rotate-[10deg]"
            } sm:${
              index === 0
                ? "left-0 h-[56px] w-[40px]"
                : index === 1
                ? "left-[28px] h-[62px] w-[44px]"
                : index === 2
                ? "left-[58px] h-[62px] w-[44px]"
                : "left-[88px] h-[56px] w-[40px]"
            }`}
          >
            <img
              src={character.image}
              alt={character.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
          </div>
        ))}
      </div>
    </div>
  </button>
)}

        {selectedCharacters.length > 0 && selectedCharacters.length < 2 && (
          <p className="mt-3 text-xs font-semibold text-orange-300">
            Add at least one more character to continue.
          </p>
        )}
      </div>

      {activeGuide &&
        createPortal(
          <div className="fixed inset-0 z-[2147483646] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm lg:hidden">
            <div className="max-h-[60vh] w-full max-w-[360px] overflow-hidden rounded-[24px] border border-white/10 bg-[#111315] shadow-2xl shadow-black/50">
              <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
                <div className="min-w-0">
                  <h3 className="line-clamp-1 text-lg font-black text-white">
                    {activeGuide.guideTitle}
                  </h3>
                  <p className="mt-1 text-xs text-white/45">
                    Quick guide for this story format.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOpenGuide(null)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-lg text-white/70"
                >
                  ×
                </button>
              </div>

              <div className="max-h-[calc(60vh-72px)] overflow-y-auto p-4">
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <img
                    src={activeGuide.image}
                    alt={activeGuide.label}
                    className="aspect-[4/3] w-full object-cover"
                  />
                </div>

                <p className="mt-4 text-sm leading-relaxed text-white/65">
                  {activeGuide.guideText}
                </p>

                <ul className="mt-4 space-y-2">
                  {activeGuide.guideBullets.map((item) => (
                    <li key={item} className="text-sm text-white/75">
                      • {item}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => setOpenGuide(null)}
                  className="mt-5 h-11 w-full rounded-2xl bg-white text-sm font-black text-black"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {charactersOpen &&
        createPortal(
          <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="relative z-[2147483647] flex max-h-[84vh] w-full max-w-[860px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#111315] shadow-2xl shadow-black/60">
              <div className="border-b border-white/10 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black text-white">
                      Choose your characters
                    </h3>
                    <p className="mt-1 text-sm text-white/45">
                      Select 2–3 characters for this fruit story.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCharactersOpen(false)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-lg text-white/70 transition hover:bg-white/[0.08]"
                  >
                    ×
                  </button>
                </div>

           <div className="mt-4">
  <div className="flex items-center gap-2">
    <button
      type="button"
      onClick={() => setCharacterTab("all")}
      className={`rounded-xl px-3 py-2 text-xs font-black transition ${
        characterTab === "all"
          ? "bg-gradient-to-r from-[#7C3AED] to-[#C084FC] text-white shadow-[0_8px_24px_rgba(124,58,237,0.28)]"
          : "border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
      }`}
    >
      All
    </button>

    <button
      type="button"
      onClick={() => setCharacterTab("favorites")}
      className={`rounded-xl px-3 py-2 text-xs font-black transition ${
        characterTab === "favorites"
          ? "bg-gradient-to-r from-[#7C3AED] to-[#C084FC] text-white shadow-[0_8px_24px_rgba(124,58,237,0.28)]"
          : "border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
      }`}
    >
      ★ Favorites
    </button>

<button
  type="button"
  onClick={() => setCharacterSearchOpen((prev) => !prev)}
  className={`ml-auto flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-black leading-none transition ${
    characterSearchOpen || characterSearch
      ? "border-purple-400/40 bg-purple-500/20 text-purple-100"
      : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
  }`}
  aria-label="Search characters"
>
  <span className="flex h-3.5 w-3.5 items-center justify-center text-[13px] leading-none">
    ⌕
  </span>
  <span className="leading-none">Search</span>
</button>
  </div>

  {characterSearchOpen && (
    <div className="mt-3">
      <input
        autoFocus
        type="text"
        value={characterSearch}
        onChange={(e) => setCharacterSearch(e.target.value)}
        placeholder="Search characters..."
        className="h-10 w-full rounded-xl border border-white/10 bg-[#0D0F10] px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-purple-400/60"
      />
    </div>
  )}
</div>
              </div>

              <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
                {filteredCharacters.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {filteredCharacters.map((character) => {
                      const selected = draftCharacters.some(
                        (item) => item.id === character.id
                      );

                      const isFavorite = favoriteIds.includes(character.id);

                      const disabled =
                        !selected && draftCharacters.length >= 3;

                      return (
                      <div
  key={character.id}
  role="button"
  tabIndex={disabled ? -1 : 0}
  aria-disabled={disabled}
  onClick={() => {
    if (!disabled) toggleDraftCharacter(character);
  }}
  onKeyDown={(e) => {
    if (disabled) return;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleDraftCharacter(character);
    }
  }}
  className={`group relative aspect-[9/16] overflow-hidden rounded-2xl border text-left transition ${
    selected
      ? "border-purple-400 shadow-[0_0_0_1px_rgba(168,85,247,0.35)]"
      : disabled
      ? "cursor-not-allowed border-white/5 opacity-40"
      : "cursor-pointer border-white/10 hover:border-white/25"
  }`}
>
                          <img
                            src={character.image}
                            alt={character.name}
                            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.035]"
                          />

                          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-black/20" />

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavoriteCharacter(character.id);
                            }}
                            className={`absolute left-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border text-sm shadow-lg backdrop-blur-md transition ${
                              isFavorite
                                ? "border-yellow-300/60 bg-yellow-300 text-black"
                                : "border-white/20 bg-black/55 text-white hover:bg-black/75"
                            }`}
                          >
                            ★
                          </button>

                          {selected && (
                            <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-purple-500 text-sm font-black text-white shadow-lg">
                              ✓
                            </div>
                          )}

                          <div className="absolute inset-x-0 bottom-0 p-3">
                            <div className="line-clamp-1 text-sm font-black text-white">
                              {character.name}
                            </div>
                            <div className="mt-1 line-clamp-2 text-xs leading-snug text-white/55">
                              {character.role}
                            </div>
                          </div>
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center">
                    <div className="text-lg font-black text-white">
                      No characters found
                    </div>
                    <p className="mt-2 max-w-[320px] text-sm leading-relaxed text-white/45">
                      {characterTab === "favorites"
                        ? "You do not have any favorite characters yet. Click the star on a character to save it to favorites."
                        : "Try another search term or clear the search field."}
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-bold text-white/65">
                    {draftCharacters.length}/3 selected
                  </div>

                  <div
                    className={`text-xs font-black ${
                      draftCharacters.length >= 2
                        ? "text-green-300"
                        : "text-orange-300"
                    }`}
                  >
                    {draftCharacters.length >= 2
                      ? "Ready to continue"
                      : "Choose at least 2"}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={draftCharacters.length < 2}
                  onClick={confirmCharacters}
                  className={`h-12 w-full rounded-2xl text-sm font-black transition ${
                    draftCharacters.length >= 2
                      ? "bg-white text-black hover:bg-white/90"
                      : "cursor-not-allowed bg-white/10 text-white/30"
                  }`}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <style>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
