import { Dialog as HeadlessDialog, DialogBackdrop, DialogPanel, DialogTitle, Description } from "@headlessui/react";
import { X } from "lucide-react";
import { FOCUS, cx } from "./styles";

/**
 * Lime-family modal. Built on Headless UI, so focus is trapped inside the
 * panel, Esc closes it and focus returns to the opener.
 *
 *   footer: action buttons, rendered in a bottom row
 *   size: "sm" (confirm / upgrade) | "md" (forms) | "lg" (character library)
 */
export default function Dialog({ open, onClose, title, description, children, footer, size = "md", initialFocus, hideTitle = false }) {
  const width = size === "lg" ? "max-w-2xl" : size === "sm" ? "max-w-sm" : "max-w-md";
  return (
    <HeadlessDialog open={open} onClose={onClose} initialFocus={initialFocus} className="relative z-[300]">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200 ease-out data-[closed]:opacity-0 motion-reduce:transition-none"
      />
      <div className="fixed inset-0 flex items-end justify-center p-3 sm:items-center sm:p-4">
        <DialogPanel
          transition
          className={cx(
            "relative flex max-h-[calc(100dvh-24px)] w-full flex-col overflow-hidden rounded-3xl border border-lime-300/[0.13] bg-[#0C0F0D] shadow-2xl",
            "transition duration-200 ease-out data-[closed]:translate-y-3 data-[closed]:opacity-0 motion-reduce:transition-none",
            width,
          )}
        >
          <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-5">
            <div className="min-w-0">
              <DialogTitle className={cx("text-[18px] font-black tracking-[-0.03em] text-white", hideTitle && "sr-only")}>{title}</DialogTitle>
              {description && <Description className="mt-1 text-[12px] leading-relaxed text-white/45">{description}</Description>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/60 transition hover:text-white", FOCUS)}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">{children}</div>}
          {footer && <div className="flex gap-2 border-t border-white/[0.07] px-5 py-4">{footer}</div>}
        </DialogPanel>
      </div>
    </HeadlessDialog>
  );
}
