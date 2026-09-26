/** Title row for the right panel ("Check your scenes"). */
export default function WorkspaceHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[22px] font-black leading-tight tracking-[-0.04em] text-white sm:text-[26px]">{title}</h2>
        {subtitle && <p className="mt-1 max-w-[640px] text-[12px] font-medium leading-relaxed text-white/45">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
