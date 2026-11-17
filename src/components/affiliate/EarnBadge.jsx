// The small lime "Earn" pill next to Affiliate in the sidebar and the mobile More sheet.
export default function EarnBadge({ className = "" }) {
  return (
    <span className={`inline-flex items-center rounded-full bg-lime-300 px-1.5 py-[1.5px] text-[9.5px] font-black uppercase leading-none tracking-[0.06em] text-[#11150D] shadow-[0_0_12px_rgba(190,242,100,.35)] ${className}`}>
      Earn
    </span>
  );
}
