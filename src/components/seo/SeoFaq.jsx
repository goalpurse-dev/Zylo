export default function SeoFaq({ items }) {
  if (!items?.length) return null;
  return (
    <section className="mx-auto max-w-[820px] px-4 py-16 sm:px-6">
      <h2 className="text-[26px] font-black tracking-[-0.02em] text-white sm:text-[32px]">Frequently asked questions</h2>
      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <details key={item.q} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-4">
            <summary className="cursor-pointer list-none text-[15px] font-bold text-white">{item.q}</summary>
            <p className="pt-3 text-[14px] leading-relaxed text-white/55">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
