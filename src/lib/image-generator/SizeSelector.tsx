import { IMAGE_SIZES } from "../../lib/image-generator/sizes";

type Props = {
  value: string;
  onChange: (size: string) => void;
};

export default function SizeSelector({ value, onChange }: Props) {
  return (
    <div className="relative">
      <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
        {Object.values(IMAGE_SIZES).map((s) => (
          <button
            key={s.label}
            onClick={() => onChange(s.label)}
            className={`
              w-full px-3 py-2 text-left text-sm
              hover:bg-white/5
              ${value === s.label ? "bg-white/10" : ""}
            `}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
