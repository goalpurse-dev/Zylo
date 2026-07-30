export default function SeoHowItWorks({ steps }) {
  if (!steps?.length) return null;
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
      <h2 className="text-center text-[26px] font-black tracking-[-0.02em] text-white sm:text-[32px]">How it works</h2>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step.title} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6">
            <div className="grid h-9 w-9 place-items-center rounded-full border border-lime-300/30 bg-lime-300/[0.08] text-[13px] font-black text-lime-300">
              {index + 1}
            </div>
            <h3 className="mt-4 text-[16px] font-bold text-white">{step.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-white/50">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
