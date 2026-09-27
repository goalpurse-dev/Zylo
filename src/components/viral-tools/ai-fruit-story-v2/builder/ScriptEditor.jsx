import { AlertTriangle, UserRoundSearch } from "lucide-react";
import { FOCUS, SectionLabel, cx } from "../../../ui/zyvo";
import { LONG_LINE_WORDS, MAX_SCRIPT_SPEAKERS } from "../script/parseScript";
import { Avatar } from "../shared/Avatar";

const PLACEHOLDER = "Mia: Tonight has to be perfect.\nMarco: Work was crazy, sorry I'm late.";

/**
 * "My own script": one textarea, one scene per line, written as "Name: line".
 * Parsed live (parseScript); names are matched to library characters, and
 * any name that isn't gets a "Who is …?" picker.
 */
export default function ScriptEditor({ text, parse, byId, onChange, onAssign }) {
  const hasText = text.trim().length > 0;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionLabel htmlFor="fv2-script" hint={hasText ? `${parse.sceneCount} ${parse.sceneCount === 1 ? "scene" : "scenes"} found` : "Used exactly as written"}>
          Write the script
        </SectionLabel>
        <textarea
          id="fv2-script"
          rows={7}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={PLACEHOLDER}
          aria-describedby="fv2-script-help"
          spellCheck
          className="min-h-[160px] w-full resize-y rounded-2xl border border-white/[0.08] bg-[#111315] px-4 py-3 font-mono text-[13px] leading-relaxed text-white outline-none transition placeholder:text-white/20 focus:border-lime-300/35 focus:ring-1 focus:ring-lime-300/30"
        />
        <p id="fv2-script-help" className="mt-2 text-[10px] leading-relaxed text-white/30">
          One line per scene. Start each line with who&apos;s talking. Up to {MAX_SCRIPT_SPEAKERS} different characters, from the library so they look the same in every scene.
        </p>
      </div>

      {parse.names.length > 0 && (
        <div>
          <SectionLabel hint={`${parse.speakerIds.length} of ${MAX_SCRIPT_SPEAKERS}`}>Who&apos;s who</SectionLabel>
          <ul className="flex flex-col gap-1.5">
            {parse.names.map((n) => {
              const c = n.speakerId ? byId(n.speakerId) : null;
              return (
                <li key={n.key} className={cx(
                  "flex items-center gap-2.5 rounded-xl border px-3 py-2",
                  c ? "border-white/[0.07] bg-white/[0.035]" : "border-orange-300/25 bg-orange-300/[0.06]",
                )}>
                  {c ? (
                    <>
                      <Avatar character={c} size="h-7 w-7" ring={false} />
                      <span className="min-w-0 flex-1 text-[11px] font-bold text-white/80">
                        <span className="text-lime-300">{n.name}</span>
                        <span className="text-white/35"> is </span>
                        {c.name}
                        <span className="font-semibold text-white/35"> · {c.tag}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onAssign(n)}
                        aria-label={`Change who ${n.name} is`}
                        className={cx("shrink-0 rounded-lg px-1.5 py-0.5 text-[10px] font-bold text-white/45 transition hover:text-lime-300", FOCUS)}
                      >
                        Change
                      </button>
                    </>
                  ) : (
                    <>
                      <UserRoundSearch className="h-4 w-4 shrink-0 text-orange-300" aria-hidden="true" />
                      <span className="min-w-0 flex-1 text-[11px] font-bold text-orange-200">Who is &ldquo;{n.name}&rdquo;?</span>
                      <button
                        type="button"
                        onClick={() => onAssign(n)}
                        className={cx("shrink-0 rounded-lg bg-lime-300 px-2.5 py-1 text-[10px] font-black text-[#11150D] transition hover:bg-lime-200", FOCUS)}
                      >
                        Choose character
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {parse.tooManySpeakers && (
            <p role="alert" className="mt-2 text-[11px] font-semibold leading-relaxed text-orange-300/80">
              This script has {parse.speakerIds.length} speakers. Use at most {MAX_SCRIPT_SPEAKERS}, so every scene fits.
            </p>
          )}
        </div>
      )}

      {parse.lines.length > 0 && (
        <div>
          <SectionLabel>Preview</SectionLabel>
          <ol className="flex flex-col gap-1.5" aria-label="Scenes in your script">
            {parse.lines.map((l) => (
              <ScriptLine key={l.lineNo} line={l} character={l.speakerId ? byId(l.speakerId) : null} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function ScriptLine({ line, character }) {
  if (line.status !== "ok") {
    return (
      <li className="flex items-start gap-2 rounded-xl border border-dashed border-white/10 px-3 py-2 text-[11px] leading-relaxed">
        <span className="shrink-0 font-bold tabular-nums text-white/25">Line {line.lineNo}</span>
        <span className="min-w-0 text-orange-300/80">
          {line.status === "no-name"
            ? "Start each line with who's talking, like Mia: ..."
            : `Add what ${line.name} says after the colon.`}
          <span className="mt-0.5 block truncate text-white/30">{line.raw.trim()}</span>
        </span>
      </li>
    );
  }
  return (
    <li className="flex items-start gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2">
      {character ? <Avatar character={character} size="h-6 w-6" ring={false} /> : <span className="h-6 w-6 shrink-0 rounded-full border border-dashed border-orange-300/40" aria-hidden="true" />}
      <span className="min-w-0 flex-1 text-[11px] leading-relaxed text-white/70">
        <span className={cx("font-black", character ? "text-lime-300" : "text-orange-300")}>{character ? character.name.split(" ")[0] : line.name}:</span>{" "}
        {line.text}
        {line.long && (
          <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-orange-300/80">
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
            Long lines may be cut to fit one clip (keep it under {LONG_LINE_WORDS} words).
          </span>
        )}
      </span>
    </li>
  );
}
