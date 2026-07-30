export default function SeoIntro({ heading = "What is a 2AM World?", text }) {
  if (!text) return null;
  return (
    <section className="mx-auto max-w-[820px] px-4 py-16 sm:px-6">
      <h2 className="text-[24px] font-black tracking-[-0.02em] text-white sm:text-[28px]">{heading}</h2>
      <p className="mt-4 text-[15px] leading-[1.75] text-white/55">{text}</p>
    </section>
  );
}
