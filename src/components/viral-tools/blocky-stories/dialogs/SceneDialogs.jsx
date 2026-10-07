import { useEffect, useRef, useState } from "react";
import { Dialog, ErrorBanner, PrimaryButton } from "../../../ui/zyvo";

const TEXTAREA =
  "w-full resize-none rounded-2xl border border-white/[0.08] bg-[#111315] px-4 py-3 text-[13px] leading-relaxed text-white outline-none transition placeholder:text-white/20 focus:border-lime-300/35 focus:ring-1 focus:ring-lime-300/30";

/**
 * One dialog for the three scene actions.
 *   kind: "edit" | "regenerate" | "clip"
 *   onSubmit(text) → Promise; errors are shown inside the dialog.
 */
export default function SceneActionDialog({ kind, scene, speakerName, price, onClose, onSubmit }) {
  const open = Boolean(kind && scene);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fieldRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setText(kind === "regenerate" ? scene.imagePrompt : "");
    setBusy(false);
    setError("");
  }, [open, kind, scene]);

  if (!open) return <Dialog open={false} onClose={onClose} title="" />;
  const number = scene.index + 1;
  const needsText = kind !== "clip";
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await onSubmit(text.trim());
      onClose();
    } catch (err) {
      setError(err?.message || "That didn't work. Nothing was charged. Try again.");
      setBusy(false);
    }
  };

  const copy = {
    edit: { title: `Edit scene ${number}`, description: "Say what to change. Everything else stays the same.", action: "Apply edit" },
    regenerate: { title: `Regenerate scene ${number}`, description: "This is the description we used. Change anything, then regenerate.", action: "Regenerate" },
    clip: { title: `Regenerate clip ${number}?`, description: `We'll animate the same picture again. The line stays: “${scene.line}”`, action: "Regenerate clip" },
  }[kind];

  return (
    <Dialog
      open={open}
      onClose={busy ? () => {} : onClose}
      size={kind === "clip" ? "sm" : "md"}
      title={copy.title}
      description={copy.description}
      initialFocus={needsText ? fieldRef : undefined}
      footer={
        <>
          <PrimaryButton variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>Cancel</PrimaryButton>
          <PrimaryButton className="flex-1" price={price} busy={busy ? "Starting…" : null} disabled={needsText && !text.trim()} onClick={submit}>
            {copy.action}
          </PrimaryButton>
        </>
      }
    >
      {needsText && (
        <textarea
          ref={fieldRef}
          rows={kind === "regenerate" ? 6 : 4}
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={kind === "edit" ? "What should change?" : "Scene description"}
          placeholder={kind === "edit" ? `e.g. Make ${speakerName} look angrier and move them to the balcony` : ""}
          className={TEXTAREA}
        />
      )}
      {error && <ErrorBanner className="mt-3">{error}</ErrorBanner>}
    </Dialog>
  );
}
