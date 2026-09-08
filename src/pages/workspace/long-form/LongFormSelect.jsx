import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { Check, ChevronDown } from "lucide-react";

// Reusable Long Form dropdown — replaces native <select> (which rendered
// with jarring OS-native menu chrome on Windows/Chrome). Built on Headless
// UI's Listbox (already an installed dependency, unused elsewhere): it
// supplies full keyboard nav, outside-click/Escape close, and ARIA
// listbox semantics for free, and its `anchor` prop handles floating
// position + viewport-clipping + width-matching automatically.
export default function LongFormSelect({ label, options, value, onChange }) {
  const selected = options.find((opt) => opt.value === value) ?? options[0];

  return (
    <Listbox value={value} onChange={onChange}>
      {({ open }) => (
        <div className="rounded-xl border border-white/[0.08] bg-[#101213] px-4 py-2.5 transition hover:border-white/[0.16] focus-within:border-lime-300/40 focus-within:ring-1 focus-within:ring-lime-300/20">
          <ListboxButton className="flex w-full items-center justify-between gap-2 text-left outline-none">
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-white/30">{label}</span>
              <span className="mt-0.5 block truncate text-[14px] font-semibold text-white">{selected?.label}</span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-white/35 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
            />
          </ListboxButton>

          <ListboxOptions
            anchor={{ to: "bottom start", gap: 8 }}
            transition
            className="z-[200] w-[var(--button-width)] rounded-xl border border-white/10 bg-[#16181a] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.55)] outline-none transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
          >
            {options.map((opt) => (
              <ListboxOption
                key={opt.value}
                value={opt.value}
                className={({ focus, selected: isSelected }) =>
                  `flex cursor-pointer select-none items-start gap-2 rounded-lg px-3 py-3 transition-colors ${
                    isSelected ? "bg-lime-300/[0.08]" : focus ? "bg-white/[0.06]" : ""
                  }`
                }
              >
                {({ selected: isSelected }) => (
                  <>
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center ${isSelected ? "text-lime-300" : "text-transparent"}`}>
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[13.5px] font-semibold ${isSelected ? "text-white" : "text-white/75"}`}>{opt.label}</span>
                      {opt.description && (
                        <span className="mt-0.5 block text-[11.5px] leading-snug text-white/40">{opt.description}</span>
                      )}
                    </span>
                  </>
                )}
              </ListboxOption>
            ))}
          </ListboxOptions>
        </div>
      )}
    </Listbox>
  );
}
