import { CARD, TEXT } from "./tokens";
import { RULES_SECTIONS } from "./data";

export function RulesTab() {
  return (
    <div className="space-y-4">
      {RULES_SECTIONS.map((section) => (
        <div key={section.title} className={`${CARD} p-6`}>
          <p className={`text-[17px] font-semibold ${TEXT.primary}`}>{section.title}</p>
          <p className={`mt-2 text-[14px] leading-[1.6] ${TEXT.secondary}`}>{section.body}</p>
        </div>
      ))}
    </div>
  );
}
