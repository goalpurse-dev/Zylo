import SeoGeneratorHero from "./SeoGeneratorHero.jsx";

/**
 * Bottom-of-page CTA — reuses SeoGeneratorHero's compact variant so the
 * visitor never has to scroll back up, and the prompt they've already typed
 * carries straight through (same lifted `prompt` state as the hero).
 */
export default function SeoFinalCTA({ config, prompt, onPromptChange }) {
  return (
    <section className="mx-auto max-w-[720px] px-4 py-16 sm:px-6">
      <SeoGeneratorHero config={config} prompt={prompt} onPromptChange={onPromptChange} variant="compact" id="seo-final-cta" />
    </section>
  );
}
