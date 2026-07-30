export default function SeoPromptExamples({ prompts, onSelect, heading = "2AM World Ideas" }) {
  if (!prompts?.length) return null;
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
      <h2 className="text-center text-[26px] font-black tracking-[-0.02em] text-white sm:text-[32px]">{heading}</h2>
      <div className="mt-8 flex flex-wrap justify-center gap-2.5">
        {prompts.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => onSelect(text)}
            className="rounded-full border border-lime-300/[0.16] bg-lime-300/[0.05] px-4 py-2.5 text-[13px] font-semibold text-lime-100 transition hover:border-lime-300/40 hover:bg-lime-300/[0.09]"
          >
            {text}
          </button>
        ))}
      </div>
    </section>
  );
}
